import * as XLSX from "xlsx";

/** Error con mensaje claro y orientado al usuario (en español). */
export class ArchivoInvalidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArchivoInvalidoError";
  }
}

/** Estado de una habitación, derivado del COLOR de relleno de su celda en el Excel. */
export type Estado = "Bien" | "Más o menos" | "Mal" | "No revisado";

/** Una fila de salida: una habitación con todos sus campos ya "aplanados". */
export interface RelevRow {
  /** Nombre de la pestaña de origen (ej. "Pintura general habt."). */
  pestana: string;
  /** Piso, derivado del número de habitación (101 → "1", 1001 → "10"). */
  piso: string;
  /** Número de habitación tal como aparece en el Excel. */
  habitacion: string;
  /** Campo → valor (ej. Estado, Detalle, Auditada, Realizado, Observación, …). */
  campos: Record<string, string>;
}

/** Resultado de procesar un archivo completo: las listas y de qué sede es. */
export interface ResultadoArchivo {
  resultados: SheetResult[];
  /** Sede usada para normalizar las habitaciones. */
  hotel: string;
  /** Cómo se determinó esa sede. */
  deteccion: OrigenDeteccion;
}

/** Resultado de despivotar una pestaña. */
export interface SheetResult {
  /** Nombre de la pestaña de origen. */
  pestana: string;
  /**
   * Columnas de campo que esta pestaña realmente tiene con datos, en orden.
   * Se calculan de los valores reales: nunca incluye columnas vacías.
   */
  columnas: string[];
  filas: RelevRow[];
}

/** Columnas fijas que llevan siempre las listas. */
export const COLUMNAS_BASE = ["Pestaña", "Piso", "Habitación"] as const;

/** Orden preferido de las columnas de campo. Estado primero; el resto detrás, alfabético. */
const ORDEN_CAMPOS = ["Estado", "Estado N°", "Detalle", "Auditada", "Realizado", "Observación"];

/** Estado → número, para importar más fácil. "No revisado" queda en blanco. */
const ESTADO_NUM: Record<Estado, string> = {
  Bien: "5",
  "Más o menos": "3",
  Mal: "1",
  "No revisado": "",
};

/**
 * Grilla real de un hotel: cuántas habitaciones tiene cada piso, y las que NO existen
 * (a descartar aunque aparezcan por error en el Excel). Cada hotel tiene su grilla.
 */
export interface Grilla {
  pisos: Record<number, number>;
  excluidas: Set<number>;
}

/**
 * Grillas por hotel (deducidas de la tabla Espacios de Airtable):
 *  - Urbano: pisos 1–8 con X01–X09, piso 9 con 901–907, piso 10 con 1001/1003/1004 (la 1002 no existe).
 *  - 9 de Julio: pisos 2–6 con X01–X10, piso 7 con 701–707.
 *  - City Baires: pisos 2–12 con X01–X06, piso 13 con 1301–1304.
 * Todas las listas se normalizan a la grilla del hotel: corrige typos, rellena
 * faltantes, descarta números sueltos y evita duplicados.
 */
export const GRILLAS: Record<string, Grilla> = {
  "HTL Urbano": {
    pisos: { 1: 9, 2: 9, 3: 9, 4: 9, 5: 9, 6: 9, 7: 9, 8: 9, 9: 7, 10: 4 },
    excluidas: new Set([1002]),
  },
  "HTL 9 de Julio": {
    pisos: { 2: 10, 3: 10, 4: 10, 5: 10, 6: 10, 7: 7 },
    excluidas: new Set(),
  },
  "HTL City Baires": {
    pisos: { 2: 6, 3: 6, 4: 6, 5: 6, 6: 6, 7: 6, 8: 6, 9: 6, 10: 6, 11: 6, 12: 6, 13: 4 },
    excluidas: new Set(),
  },
};

const GRILLA_DEFAULT = GRILLAS["HTL Urbano"];

/** Cómo se determinó el hotel de un archivo. */
export type OrigenDeteccion = "nombre" | "contenido" | "manual";

/** Quita acentos y pasa a minúsculas, para comparar nombres sin sorpresas. */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Intenta deducir la sede del NOMBRE del archivo (ej. "Relevamiento 9j - 2025.xlsx").
 * Devuelve null si el nombre no menciona ninguna sede conocida.
 */
export function hotelPorNombre(fileName: string): string | null {
  const n = normalizar(fileName);
  if (/\burbano\b/.test(n)) return "HTL Urbano";
  if (/\bcity\b/.test(n)) return "HTL City Baires";
  if (/\b9\s*j\b|9\s*de\s*julio|nueve\s*de\s*julio|\b9j\b/.test(n)) return "HTL 9 de Julio";
  return null;
}

/**
 * Deduce la sede por el CONTENIDO: cada hotel tiene su propia numeración de
 * habitaciones (Urbano arranca en 101, 9 de Julio tiene X10, City llega al piso 13),
 * así que se elige la grilla donde encajan mejor los números del archivo.
 * Sirve aunque el archivo esté renombrado. Devuelve null si ninguna encaja claro.
 */
function hotelPorContenido(rooms: Set<number>): string | null {
  if (rooms.size === 0) return null;
  let mejor: string | null = null;
  let mejorPuntaje = 0;
  let segundo = 0;
  for (const [hotel, grid] of Object.entries(GRILLAS)) {
    const canonicas = habitacionesCanonicas(grid);
    let comunes = 0;
    for (const n of canonicas) if (rooms.has(n)) comunes++;
    // Parecido entre conjuntos (Jaccard): cuenta tanto las habitaciones que
    // coinciden como las que sobran o faltan. Comparar solo "cuántas encajan" no
    // alcanza: las de 9 de Julio casi todas existen también en Urbano, y lo que
    // realmente distingue a cada sede es qué habitaciones NO tiene.
    const union = canonicas.length + rooms.size - comunes;
    const puntaje = union > 0 ? comunes / union : 0;
    if (puntaje > mejorPuntaje) {
      segundo = mejorPuntaje;
      mejorPuntaje = puntaje;
      mejor = hotel;
    } else if (puntaje > segundo) {
      segundo = puntaje;
    }
  }
  // Exigimos que se parezca bastante y que le gane con claridad a la segunda opción.
  if (mejorPuntaje < 0.5 || mejorPuntaje - segundo < 0.1) return null;
  return mejor;
}

/** Número de habitación a partir de piso + índice (piso·100 + índice). */
function numeroHab(piso: number, idx: number): number {
  return piso * 100 + idx;
}

/** Piso de un número de habitación (1001 → 10, 1306 → 13, 305 → 3). */
function pisoDeNum(n: number): number {
  return Math.floor(n / 100);
}

/** Índice dentro del piso (1001 → 1, 1306 → 6, 305 → 5). */
function idxDeNum(n: number): number {
  return n % 100;
}

/** ¿El número corresponde a una habitación real de la grilla dada? */
function esCanonica(n: number, grid: Grilla): boolean {
  if (grid.excluidas.has(n)) return false;
  const piso = pisoDeNum(n);
  const idx = idxDeNum(n);
  return piso in grid.pisos && idx >= 1 && idx <= grid.pisos[piso];
}

/** Lista de todas las habitaciones canónicas del hotel, en orden numérico. */
function habitacionesCanonicas(grid: Grilla): number[] {
  const rooms: number[] = [];
  for (const piso of Object.keys(grid.pisos).map(Number)) {
    for (let idx = 1; idx <= grid.pisos[piso]; idx++) {
      const n = numeroHab(piso, idx);
      if (!grid.excluidas.has(n)) rooms.push(n);
    }
  }
  return rooms.sort((a, b) => a - b);
}

/** Valor más frecuente de una lista (para inferir piso y offset de un bloque). */
function moda(xs: number[]): number {
  const cuenta = new Map<number, number>();
  let mejor = xs[0];
  let mejorN = 0;
  for (const x of xs) {
    const n = (cuenta.get(x) ?? 0) + 1;
    cuenta.set(x, n);
    if (n > mejorN) {
      mejorN = n;
      mejor = x;
    }
  }
  return mejor;
}

/**
 * Clasifica el color de relleno de una celda en un estado.
 * Verde = Bien, amarillo = Más o menos, rojo = Mal, gris/sin color = No revisado.
 * Se clasifica por canales RGB (no por un hex exacto) para tolerar variantes de tono.
 */
function estadoDeFill(estilo: unknown): Estado {
  const s = estilo as { patternType?: string; fgColor?: { rgb?: string } } | undefined;
  const rgb = s?.patternType === "solid" ? s?.fgColor?.rgb : undefined;
  if (!rgb) return "No revisado";
  const hex = String(rgb).slice(-6);
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return "No revisado";
  // Blanco/gris/negro (canales parejos): sin estado.
  if (Math.max(r, g, b) - Math.min(r, g, b) < 40) return "No revisado";
  if (r > 150 && g < 110 && b < 110) return "Mal"; // rojo
  if (g > 110 && r < 160 && b < 150) return "Bien"; // verde
  if (r > 180 && g > 150) return "Más o menos"; // amarillo / ámbar
  return "No revisado";
}

/**
 * ¿La celda parece un número de habitación? Aceptamos 3 dígitos (101–999) y
 * 4 dígitos para el piso 10 (1001–1099). Descarta 2 dígitos (conteos como "10").
 */
function esHabitacion(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 100 && value <= 9999 && esHabitacion(String(value));
  }
  const s = String(value).trim();
  return /^[1-9]\d{2,3}$/.test(s);
}

/** Número de una celda-habitación (asume que esHabitacion(value) es true). */
function numDeCelda(value: unknown): number {
  return typeof value === "number" ? Math.trunc(value) : parseInt(String(value).trim(), 10);
}

/** Formatea una fecha a "dd/mm/aaaa". */
function formatFecha(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** Texto legible de una celda (Date → dd/mm/aaaa, resto → string recortado). */
function celdaTexto(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : formatFecha(value);
  }
  return String(value).replace(/\s+/g, " ").trim();
}

/**
 * Normaliza la etiqueta de la columna A a un nombre de campo canónico.
 * Las variantes conocidas (auditada/o, realizado/a, observación…) se unifican;
 * cualquier otra etiqueta se conserva tal cual (capitalizada), sin perder datos.
 */
function normalizarEtiqueta(raw: string): string {
  const s = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
  if (s.startsWith("detalle")) return "Detalle";
  if (s.startsWith("auditad") || s.startsWith("actualizad")) return "Auditada";
  if (s.startsWith("realizad")) return "Realizado";
  if (s.startsWith("observ")) return "Observación";
  if (s.startsWith("condicion")) return "Condición";
  if (s.startsWith("colocad")) return "Colocada";
  if (s.startsWith("cambio")) return "Cambio";
  // Etiqueta desconocida: la dejamos, capitalizando la primera letra.
  const limpio = raw.replace(/\s+/g, " ").trim();
  return limpio.charAt(0).toUpperCase() + limpio.slice(1).toLowerCase();
}

/**
 * Nombre del campo para los valores SIN etiqueta de una pestaña. Normalmente "Detalle",
 * pero en "Cambio Cerradura Hab" los valores son fechas de cambio → "Fecha cambio".
 */
function campoPorDefecto(pestana: string): string {
  const s = pestana
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return s.includes("cambio cerradura") ? "Fecha cambio" : "Detalle";
}

/** Agrega un valor a un campo, uniendo (sin duplicar) si ya había algo cargado. */
function agregarCampo(campos: Record<string, string>, campo: string, valor: string): void {
  if (!valor) return;
  const previo = campos[campo];
  if (!previo) {
    campos[campo] = valor;
  } else if (!previo.split(" / ").includes(valor)) {
    campos[campo] = `${previo} / ${valor}`;
  }
}

/**
 * Lee una hoja como dos matrices alineadas a la grilla real (misma fila/columna):
 * `valores` con el contenido de cada celda y `estados` con el estado (color) de cada
 * celda. Mantener los índices reales permite mirar el color de la celda de cada
 * habitación (que es donde el Excel marca verde/amarillo/rojo).
 */
function leerHoja(ws: XLSX.WorkSheet): { valores: unknown[][]; estados: Estado[][] } {
  const ref = ws["!ref"];
  if (!ref) return { valores: [], estados: [] };
  const range = XLSX.utils.decode_range(ref);
  const valores: unknown[][] = [];
  const estados: Estado[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const filaV: unknown[] = [];
    const filaE: Estado[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      filaV.push(cell ? cell.v : "");
      filaE.push(cell ? estadoDeFill(cell.s) : "No revisado");
    }
    valores.push(filaV);
    estados.push(filaE);
  }
  return { valores, estados };
}

/** Datos de una fila-cabecera detectada: qué piso es y su desfase columna→índice. */
interface Cabecera {
  fila: number;
  piso: number;
  /** offset tal que: columna = offset + índice (índice 1..N del piso). */
  offset: number;
}

/**
 * Decide si una fila es una CABECERA de bloque (la fila con los números de habitación
 * de un piso) y, si lo es, con qué piso y desfase. Es tolerante a typos y a un número
 * suelto, pero rechaza las filas "desordenadas" (como las de Cambio Cerradura, donde
 * los números no van en orden ni alineados a su columna): esas son datos, no cabeceras.
 */
function detectarCabecera(fila: number, row: unknown[], grid: Grilla): Cabecera | null {
  const celdas: { col: number; n: number }[] = [];
  for (let c = 0; c < row.length; c++) {
    if (esHabitacion(row[c])) celdas.push({ col: c, n: numDeCelda(row[c]) });
  }
  if (celdas.length < 3) return null;

  const piso = moda(celdas.map((x) => pisoDeNum(x.n)));
  if (!(piso in grid.pisos)) return null;

  // Solo las celdas del piso mayoritario definen la grilla; el resto son sueltos.
  const delPiso = celdas.filter((x) => pisoDeNum(x.n) === piso);
  if (delPiso.length < 3 || delPiso.length < celdas.length * 0.5) return null;

  // Una cabecera va en orden ascendente de izquierda a derecha (permite typos iguales).
  for (let i = 1; i < delPiso.length; i++) {
    if (delPiso[i].n < delPiso[i - 1].n) return null;
  }

  const offset = moda(delPiso.map((x) => x.col - idxDeNum(x.n)));
  return { fila, piso, offset };
}

/** Ordena un conjunto de columnas: primero las comunes, luego el resto alfabético. */
function ordenarColumnas(set: Set<string>): string[] {
  return [...set].sort((a, b) => {
    const ia = ORDEN_CAMPOS.indexOf(a);
    const ib = ORDEN_CAMPOS.indexOf(b);
    if (ia !== -1 || ib !== -1) {
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    }
    return a.localeCompare(b, "es");
  });
}

/**
 * Columnas de campo que aparecen con datos en las filas. Como `campos` solo
 * contiene valores no vacíos, esto garantiza que NO haya columnas vacías: cada
 * pestaña muestra únicamente las columnas que su formato realmente usó.
 */
function columnasDeFilas(filas: RelevRow[]): string[] {
  const set = new Set<string>();
  for (const f of filas) for (const k of Object.keys(f.campos)) set.add(k);
  return ordenarColumnas(set);
}

/**
 * La columna "Estado" solo tiene sentido si la pestaña usa colores. Si ninguna
 * habitación tiene color (todas "No revisado"), se quita para no ensuciar la lista.
 * Si sí aplica, agrega también la columna numérica "Estado N°" (Bien=5, Más o
 * menos=3, Mal=1, No revisado en blanco) para importar más fácil.
 */
function completarEstado(filas: RelevRow[]): void {
  const hayColor = filas.some((f) => f.campos["Estado"] && f.campos["Estado"] !== "No revisado");
  if (!hayColor) {
    for (const f of filas) delete f.campos["Estado"];
    return;
  }
  for (const f of filas) {
    const num = ESTADO_NUM[(f.campos["Estado"] as Estado) ?? "No revisado"];
    if (num) f.campos["Estado N°"] = num;
  }
}

/** Ensambla el resultado final: rellena habitaciones faltantes y ordena por número. */
function armarResultado(pestana: string, mapa: Map<number, RelevRow>, grid: Grilla): SheetResult {
  const filas: RelevRow[] = [];
  for (const room of habitacionesCanonicas(grid)) {
    const existente = mapa.get(room);
    if (existente) {
      filas.push(existente);
    } else {
      // Habitación de la grilla que la pestaña no traía: se incluye vacía (No revisado)
      // para saber que falta revisar.
      filas.push({
        pestana,
        piso: String(pisoDeNum(room)),
        habitacion: String(room),
        campos: { Estado: "No revisado" },
      });
    }
  }
  completarEstado(filas);
  return { pestana, columnas: columnasDeFilas(filas), filas };
}

/**
 * Despivota una hoja con formato de GRILLA horizontal, normalizándola a la grilla
 * canónica del hotel. Por cada bloque (piso) reconstruye las habitaciones por su
 * POSICIÓN de columna, no por el número escrito: así arregla typos, rellena faltantes
 * y descarta números sueltos. El estado (color) se toma de la celda del número.
 */
function despivotarGrilla(
  pestana: string,
  valores: unknown[][],
  estados: Estado[][],
  cabeceras: Cabecera[],
  grid: Grilla
): SheetResult {
  const mapa = new Map<number, RelevRow>();
  const campoDefault = campoPorDefecto(pestana);

  const obtener = (room: number): RelevRow => {
    let fila = mapa.get(room);
    if (!fila) {
      fila = {
        pestana,
        piso: String(pisoDeNum(room)),
        habitacion: String(room),
        campos: { Estado: "No revisado" },
      };
      mapa.set(room, fila);
    }
    return fila;
  };

  for (let b = 0; b < cabeceras.length; b++) {
    const { fila: hr, piso, offset } = cabeceras[b];
    const finBloque = b + 1 < cabeceras.length ? cabeceras[b + 1].fila : valores.length;
    const nIdx = grid.pisos[piso];

    // Columna de la primera habitación del piso; si es >0, la col 0 es la etiqueta.
    const minCol = offset + 1;
    const labelCol = minCol >= 1 ? 0 : -1;

    // Estado (color) de cada habitación, desde la celda de su número.
    for (let idx = 1; idx <= nIdx; idx++) {
      const col = offset + idx;
      if (col < 0) continue;
      const room = numeroHab(piso, idx);
      if (grid.excluidas.has(room)) continue; // habitación inexistente
      const fila = obtener(room);
      const est = estados[hr]?.[col] ?? "No revisado";
      if (est !== "No revisado") fila.campos["Estado"] = est;
    }

    // Filas de atributos del bloque.
    for (let r = hr + 1; r < finBloque; r++) {
      const row = valores[r];
      if (!row) continue;
      const etiquetaRaw = labelCol >= 0 ? celdaTexto(row[labelCol]) : "";
      const campo = etiquetaRaw ? normalizarEtiqueta(etiquetaRaw) : campoDefault;
      for (let idx = 1; idx <= nIdx; idx++) {
        const col = offset + idx;
        if (col < 0) continue;
        const room = numeroHab(piso, idx);
        if (grid.excluidas.has(room)) continue; // habitación inexistente
        const valor = celdaTexto(row[col]);
        if (!valor) continue;
        // Un valor que es solo un número de habitación es basura (ej. filas
        // desordenadas de Cambio Cerradura): no es un dato real, se ignora.
        if (esHabitacion(valor)) continue;
        agregarCampo(obtener(room).campos, campo, valor);
      }
    }
  }

  return armarResultado(pestana, mapa, grid);
}

/**
 * Despivota una hoja VERTICAL (tipo "Generales"): la habitación está en la
 * columna A y el detalle en la B. Se normaliza igual a la grilla del hotel.
 */
function despivotarVertical(
  pestana: string,
  valores: unknown[][],
  estados: Estado[][],
  grid: Grilla
): SheetResult {
  const mapa = new Map<number, RelevRow>();
  for (let r = 0; r < valores.length; r++) {
    const row = valores[r];
    if (!esHabitacion(row[0])) continue;
    const n = numDeCelda(row[0]);
    if (!esCanonica(n, grid)) continue; // descarta números sueltos / fuera de grilla
    let fila = mapa.get(n);
    if (!fila) {
      fila = { pestana, piso: String(pisoDeNum(n)), habitacion: String(n), campos: { Estado: "No revisado" } };
      mapa.set(n, fila);
    }
    const est = estados[r]?.[0] ?? "No revisado";
    if (est !== "No revisado") fila.campos["Estado"] = est;
    const detalle = celdaTexto(row[1]);
    if (detalle && !esHabitacion(detalle)) agregarCampo(fila.campos, "Detalle", detalle);
  }
  return armarResultado(pestana, mapa, grid);
}

/** Despivota una sola hoja, eligiendo el modo (grilla o vertical) automáticamente. */
export function despivotarHoja(pestana: string, ws: XLSX.WorkSheet, grid: Grilla = GRILLA_DEFAULT): SheetResult {
  const { valores, estados } = leerHoja(ws);

  // Cabeceras = filas con los números de habitación de un piso (en orden y alineados).
  const cabeceras: Cabecera[] = [];
  for (let i = 0; i < valores.length; i++) {
    const cab = detectarCabecera(i, valores[i], grid);
    if (cab) cabeceras.push(cab);
  }
  if (cabeceras.length > 0) return despivotarGrilla(pestana, valores, estados, cabeceras, grid);

  // Sin bloques horizontales: ¿hay habitaciones en la columna A (vertical)?
  const habsColA = valores.filter((r) => esHabitacion(r[0])).length;
  if (habsColA >= 3) return despivotarVertical(pestana, valores, estados, grid);

  // No se reconoció el formato: hoja sin habitaciones.
  return { pestana, columnas: [], filas: [] };
}

/**
 * Despivota todo un archivo Excel: procesa cada pestaña y devuelve una lista por
 * pestaña. Lanza ArchivoInvalidoError si el archivo es ilegible o no tiene
 * ninguna habitación reconocible en ninguna pestaña.
 */
export async function despivotarArchivo(
  file: File,
  hotelForzado?: string
): Promise<ResultadoArchivo> {
  const buffer = await file.arrayBuffer();
  let workbook: XLSX.WorkBook;
  try {
    // cellStyles: true → necesario para leer el color de relleno (el estado).
    workbook = XLSX.read(buffer, { type: "array", cellDates: true, cellStyles: true, codepage: 65001 });
  } catch {
    throw new ArchivoInvalidoError(
      "No se pudo leer el archivo. Asegurate de que sea un Excel (.xlsx / .xls) válido."
    );
  }

  // Qué sede es: lo que eligió el usuario, o el nombre del archivo, o su contenido.
  let hotel = hotelForzado ?? null;
  let deteccion: OrigenDeteccion = "manual";
  if (!hotel) {
    hotel = hotelPorNombre(file.name);
    deteccion = "nombre";
  }
  if (!hotel) {
    const rooms = new Set<number>();
    for (const nombre of workbook.SheetNames) {
      const ws = workbook.Sheets[nombre];
      const ref = ws["!ref"];
      if (!ref) continue;
      const range = XLSX.utils.decode_range(ref);
      for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r, c })];
          if (cell && esHabitacion(cell.v)) rooms.add(numDeCelda(cell.v));
        }
      }
    }
    hotel = hotelPorContenido(rooms);
    deteccion = "contenido";
  }
  if (!hotel) {
    hotel = "HTL Urbano";
    deteccion = "manual";
  }

  const grid = GRILLAS[hotel] ?? GRILLA_DEFAULT;
  const resultados: SheetResult[] = [];
  for (const nombre of workbook.SheetNames) {
    const res = despivotarHoja(nombre.trim(), workbook.Sheets[nombre], grid);
    if (res.filas.length > 0) resultados.push(res);
  }

  if (resultados.length === 0) {
    throw new ArchivoInvalidoError(
      "No se reconoció ninguna habitación en el archivo. Esperaba una grilla de habitaciones (101, 102, …) por pestaña."
    );
  }
  return { resultados, hotel, deteccion };
}

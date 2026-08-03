import { listarTodos } from "./airtableClient";
import { MAPEO_PESTANA_ITEMS } from "./mapeoAirtable";
import type { Hotel } from "./mapeoAirtable";
import type { SheetResult } from "../unpivot";

// Tablas de Airtable que se cruzan para resolver los campos linkeados.
export const T_ESPACIOS = "Espacios";
export const T_ITEMS = "Items";

// Campos de "Equipamiento por Espacio" que se comparan y se actualizan.
// Calificación = estrellas 1–5 (número). Observación = texto.
const CAMPO_CALIFICACION = "Calificación actual";
const CAMPO_OBSERVACION = "Observación";

// Estado del relevamiento (color) -> calificación 1–5. "No revisado" queda sin
// calificar: NO se toca la calificación de Airtable si el relevamiento no tiene color.
const ESTADO_A_ESTRELLAS: Record<string, number> = {
  Bien: 5,
  "Más o menos": 3,
  Mal: 1,
};

export type CampoDiff = "Calificación" | "Observación";

/** Una diferencia entre el relevamiento y Airtable, en un campo puntual. */
export interface Diff {
  habitacion: string;
  item: string;
  recordId: string;
  campo: CampoDiff; // para mostrar
  campoAirtable: string; // nombre real del campo a escribir
  enAirtable: string; // valor actual (para mostrar)
  quedaria: string; // valor nuevo (para mostrar)
  valorNuevo: unknown; // valor a enviar a Airtable
}

export interface ResultadoComparacion {
  diffs: Diff[];
  comparados: number; // pares (ítem × habitación) que se cruzaron con Airtable
  sinEnAirtable: number; // pares del relevamiento que no existen en Airtable
}

const texto = (v: unknown): string => (v == null ? "" : String(v).trim());
const primerLink = (v: unknown): string | undefined =>
  Array.isArray(v) && v.length ? String(v[0]) : undefined;
const clave = (item: string, room: string): string => `${item.toLowerCase()}|${room}`;

/** Sede a partir del Identificador del espacio ("Habitación 201 - HTL Urbano" → "HTL Urbano"). */
function hotelDeIdentificador(id: string): string {
  const partes = id.split(" - ");
  return partes.length > 1 ? partes[partes.length - 1].trim() : "";
}

/**
 * Compara el relevamiento procesado contra Airtable, para el hotel elegido.
 * Trae Espacios (para saber la habitación y la sede de cada registro) e Items
 * (para resolver el nombre del ítem), trae el Equipamiento del hotel, y arma la
 * lista de diferencias en Calificación (1–5) y Observación.
 */
export async function compararConAirtable(
  cfg: { token: string; baseId: string; tablaEquip: string; hotel: Hotel },
  resultados: SheetResult[],
  onProgreso?: (msg: string) => void
): Promise<ResultadoComparacion> {
  const { token, baseId, tablaEquip, hotel } = cfg;

  onProgreso?.("Trayendo espacios…");
  const espacios = await listarTodos(token, baseId, T_ESPACIOS, {
    campos: ["Identificador", "Número de Habitación"],
  });
  // Solo los espacios de este hotel: id de registro -> número de habitación.
  const habDeEspacio = new Map<string, string>();
  for (const e of espacios) {
    const room = texto(e.fields["Número de Habitación"]);
    const sede = hotelDeIdentificador(texto(e.fields["Identificador"]));
    if (room && sede === hotel) habDeEspacio.set(e.id, room);
  }

  onProgreso?.("Trayendo ítems…");
  const items = await listarTodos(token, baseId, T_ITEMS, { campos: ["Name"] });
  const itemById = new Map<string, string>();
  for (const it of items) itemById.set(it.id, texto(it.fields["Name"]));

  // Índice de Airtable: (ítem, habitación) -> valores actuales, ya filtrado al hotel.
  const airByKey = new Map<string, { recordId: string; calif: string; obs: string }>();
  const equip = await listarTodos(token, baseId, tablaEquip, {
    campos: ["Espacio", "Ítem", CAMPO_CALIFICACION, CAMPO_OBSERVACION],
    onProgreso: (n) => onProgreso?.(`Trayendo equipamiento… ${n} registros`),
  });
  for (const r of equip) {
    const room = habDeEspacio.get(primerLink(r.fields["Espacio"]) ?? "");
    if (!room) continue; // el espacio no es de este hotel
    const itemName = itemById.get(primerLink(r.fields["Ítem"]) ?? "");
    if (!itemName) continue;
    airByKey.set(clave(itemName, room), {
      recordId: r.id,
      calif: texto(r.fields[CAMPO_CALIFICACION]),
      obs: texto(r.fields[CAMPO_OBSERVACION]),
    });
  }

  const mapa = MAPEO_PESTANA_ITEMS[hotel] ?? {};
  const porPestana = new Map(resultados.map((r) => [r.pestana, r]));
  const diffs: Diff[] = [];
  let comparados = 0;
  let sinEnAirtable = 0;

  for (const [pestana, itemsMap] of Object.entries(mapa)) {
    const res = porPestana.get(pestana);
    if (!res) continue;
    for (const fila of res.filas) {
      const estrellas = ESTADO_A_ESTRELLAS[texto(fila.campos["Estado"])]; // undefined si "No revisado"
      const relObs = texto(fila.campos["Detalle"]);
      for (const item of itemsMap) {
        const air = airByKey.get(clave(item, fila.habitacion));
        if (!air) {
          sinEnAirtable++;
          continue;
        }
        comparados++;
        const base = { habitacion: fila.habitacion, item, recordId: air.recordId };
        // Calificación: solo si el relevamiento tiene color y difiere de Airtable.
        if (estrellas !== undefined && String(estrellas) !== air.calif) {
          diffs.push({
            ...base,
            campo: "Calificación",
            campoAirtable: CAMPO_CALIFICACION,
            enAirtable: air.calif || "(sin calificar)",
            quedaria: `${estrellas} ★`,
            valorNuevo: estrellas,
          });
        }
        // Observación: solo si el relevamiento trae algo distinto (no pisar con vacío).
        if (relObs && relObs !== air.obs) {
          diffs.push({
            ...base,
            campo: "Observación",
            campoAirtable: CAMPO_OBSERVACION,
            enAirtable: air.obs || "(vacío)",
            quedaria: relObs,
            valorNuevo: relObs,
          });
        }
      }
    }
  }
  return { diffs, comparados, sinEnAirtable };
}

/** Resumen de lo que se va a subir, para mostrar antes de confirmar. */
export interface ResumenCambios {
  /** Registros de Airtable que se van a modificar. */
  registros: number;
  /** Cantidad de calificaciones (estrellas) a escribir. */
  calificaciones: number;
  /** Cantidad de observaciones (texto) a escribir. */
  observaciones: number;
  /** Habitaciones distintas afectadas. */
  habitaciones: number;
  /** Detalle por ítem, ordenado de mayor a menor. */
  porItem: { item: string; cambios: number }[];
}

/** Calcula el resumen de los cambios seleccionados (para la confirmación). */
export function resumirCambios(diffs: Diff[]): ResumenCambios {
  const habitaciones = new Set<string>();
  const registros = new Set<string>();
  const porItem = new Map<string, number>();
  let calificaciones = 0;
  let observaciones = 0;

  for (const d of diffs) {
    habitaciones.add(d.habitacion);
    registros.add(d.recordId);
    porItem.set(d.item, (porItem.get(d.item) ?? 0) + 1);
    if (d.campo === "Calificación") calificaciones++;
    else observaciones++;
  }

  return {
    registros: registros.size,
    calificaciones,
    observaciones,
    habitaciones: habitaciones.size,
    porItem: [...porItem.entries()]
      .map(([item, cambios]) => ({ item, cambios }))
      .sort((a, b) => b.cambios - a.cambios || a.item.localeCompare(b.item, "es")),
  };
}

/** Agrupa los diffs seleccionados por registro, para el PATCH a Airtable. */
export function armarUpdates(diffs: Diff[]): { id: string; fields: Record<string, unknown> }[] {
  const porRecord = new Map<string, Record<string, unknown>>();
  for (const d of diffs) {
    const f = porRecord.get(d.recordId) ?? {};
    f[d.campoAirtable] = d.valorNuevo;
    porRecord.set(d.recordId, f);
  }
  return [...porRecord.entries()].map(([id, fields]) => ({ id, fields }));
}

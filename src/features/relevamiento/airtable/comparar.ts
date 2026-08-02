import { listarTodos } from "./airtableClient";
import { MAPEO_PESTANA_ITEMS } from "./mapeoAirtable";
import type { Hotel } from "./mapeoAirtable";
import type { SheetResult } from "../unpivot";

// Tablas de Airtable que se cruzan para resolver los campos linkeados.
export const T_ESPACIOS = "Espacios";
export const T_ITEMS = "Items";

// Estado del relevamiento -> opción de "Estado" en Airtable. "No revisado" NO se
// mapea a propósito: si el relevamiento no tiene color, no se toca el estado de
// Airtable (no se pisa una calificación existente con "Sin calificar").
const ESTADO_A_AIRTABLE: Record<string, string> = {
  Bien: "Excelente",
  "Más o menos": "Regular",
  Mal: "Malo",
};

export type CampoAirtable = "Estado" | "Observación" | "Fecha último rankeo";

/** Una diferencia entre el relevamiento y Airtable, en un campo puntual. */
export interface Diff {
  habitacion: string;
  item: string;
  recordId: string;
  campo: CampoAirtable;
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

/** dd/mm/aaaa -> yyyy-mm-dd (formato que espera Airtable en fechas). */
function ddmmAISO(s: string): string {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : s;
}
/** Valor de fecha de Airtable (ISO con o sin hora, o dd/mm/aaaa) -> yyyy-mm-dd. */
function airISO(v: unknown): string {
  const s = texto(v);
  if (!s) return "";
  if (s.includes("T")) return s.slice(0, 10);
  return ddmmAISO(s);
}
/** El campo "Hotel" puede venir como texto o como registro linkeado (array). */
const normHotel = (v: unknown): string => (Array.isArray(v) ? texto(v[0]) : texto(v));

/**
 * Compara el relevamiento procesado contra Airtable, para el hotel elegido.
 * Trae Espacios e Items para resolver los IDs de los campos linkeados, trae todo
 * el Equipamiento, y arma la lista de diferencias en Estado, Observación y Fecha.
 */
export async function compararConAirtable(
  cfg: { token: string; baseId: string; tablaEquip: string; hotel: Hotel },
  resultados: SheetResult[],
  onProgreso?: (msg: string) => void
): Promise<ResultadoComparacion> {
  const { token, baseId, tablaEquip, hotel } = cfg;

  onProgreso?.("Trayendo espacios…");
  const espacios = await listarTodos(token, baseId, T_ESPACIOS, {
    campos: ["Número de Habitación", "Hotel"],
  });
  const espacioById = new Map<string, { room: string; hotel: string }>();
  for (const e of espacios) {
    const room = texto(e.fields["Número de Habitación"]);
    if (room) espacioById.set(e.id, { room, hotel: normHotel(e.fields["Hotel"]) });
  }

  onProgreso?.("Trayendo ítems…");
  const items = await listarTodos(token, baseId, T_ITEMS, { campos: ["Name"] });
  const itemById = new Map<string, string>();
  for (const it of items) itemById.set(it.id, texto(it.fields["Name"]));

  // Índice de Airtable: (ítem, habitación) -> valores actuales, filtrado al hotel.
  const airByKey = new Map<string, { recordId: string; estado: string; obs: string; fecha: string }>();
  const equip = await listarTodos(token, baseId, tablaEquip, {
    campos: ["Espacio", "Ítem", "Estado", "Observación", "Fecha último rankeo"],
    onProgreso: (n) => onProgreso?.(`Trayendo equipamiento… ${n} registros`),
  });
  for (const r of equip) {
    const esp = espacioById.get(primerLink(r.fields["Espacio"]) ?? "");
    if (!esp || esp.hotel !== hotel) continue;
    const itemName = itemById.get(primerLink(r.fields["Ítem"]) ?? "");
    if (!itemName) continue;
    airByKey.set(clave(itemName, esp.room), {
      recordId: r.id,
      estado: texto(r.fields["Estado"]),
      obs: texto(r.fields["Observación"]),
      fecha: texto(r.fields["Fecha último rankeo"]),
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
      const relEstado = ESTADO_A_AIRTABLE[texto(fila.campos["Estado"])]; // undefined si "No revisado"
      const relObs = texto(fila.campos["Detalle"]);
      const relFecha = texto(fila.campos["Auditada"]);
      for (const item of itemsMap) {
        const air = airByKey.get(clave(item, fila.habitacion));
        if (!air) {
          sinEnAirtable++;
          continue;
        }
        comparados++;
        const base = { habitacion: fila.habitacion, item, recordId: air.recordId };
        if (relEstado && relEstado !== air.estado) {
          diffs.push({ ...base, campo: "Estado", enAirtable: air.estado || "(vacío)", quedaria: relEstado, valorNuevo: relEstado });
        }
        if (relObs && relObs !== air.obs) {
          diffs.push({ ...base, campo: "Observación", enAirtable: air.obs || "(vacío)", quedaria: relObs, valorNuevo: relObs });
        }
        if (relFecha && ddmmAISO(relFecha) !== airISO(air.fecha)) {
          diffs.push({ ...base, campo: "Fecha último rankeo", enAirtable: air.fecha || "(vacío)", quedaria: relFecha, valorNuevo: ddmmAISO(relFecha) });
        }
      }
    }
  }
  return { diffs, comparados, sinEnAirtable };
}

/** Agrupa los diffs seleccionados por registro, para el PATCH a Airtable. */
export function armarUpdates(diffs: Diff[]): { id: string; fields: Record<string, unknown> }[] {
  const porRecord = new Map<string, Record<string, unknown>>();
  for (const d of diffs) {
    const f = porRecord.get(d.recordId) ?? {};
    f[d.campo] = d.valorNuevo;
    porRecord.set(d.recordId, f);
  }
  return [...porRecord.entries()].map(([id, fields]) => ({ id, fields }));
}

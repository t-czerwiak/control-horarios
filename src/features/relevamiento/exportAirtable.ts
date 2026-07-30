import * as XLSX from "xlsx";
import { COLUMNAS_BASE } from "./unpivot";
import type { RelevRow, SheetResult } from "./unpivot";

// BOM UTF-8: hace que Excel abra los CSV con tildes/ñ correctamente. Airtable
// también lo acepta sin problemas al importar.
const BOM = "﻿";

/** Escapa un valor para CSV (comillas, comas y saltos de línea). */
function escaparCSV(valor: string): string {
  if (/[",\n\r]/.test(valor)) {
    return `"${valor.replace(/"/g, '""')}"`;
  }
  return valor;
}

/** Valor de una columna para una fila (columnas base + campos despivotados). */
export function valorCelda(fila: RelevRow, columna: string): string {
  switch (columna) {
    case "Pestaña":
      return fila.pestana;
    case "Piso":
      return fila.piso;
    case "Habitación":
      return fila.habitacion;
    default:
      return fila.campos[columna] ?? "";
  }
}

/** Columnas completas de una pestaña: base + solo sus campos con datos. */
export function columnasDePestana(res: SheetResult): string[] {
  return [...COLUMNAS_BASE, ...res.columnas];
}

/** Genera el texto CSV a partir de columnas y filas. */
function construirCSV(columnas: string[], filas: RelevRow[]): string {
  const lineas = [columnas.map(escaparCSV).join(",")];
  for (const fila of filas) {
    lineas.push(columnas.map((c) => escaparCSV(valorCelda(fila, c))).join(","));
  }
  return BOM + lineas.join("\r\n");
}

/** Dispara la descarga de un blob con el nombre indicado. */
function descargar(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Nombre de archivo seguro a partir del nombre de la pestaña. */
function nombreArchivo(pestana: string): string {
  const limpio = pestana
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${limpio || "pestana"}.csv`;
}

/**
 * Descarga el CSV de UNA sola pestaña, con solo sus columnas con datos.
 * Ideal para importar esa pestaña como una tabla en Airtable.
 */
export function descargarPestana(res: SheetResult): void {
  const csv = construirCSV(columnasDePestana(res), res.filas);
  descargar(new Blob([csv], { type: "text/csv;charset=utf-8" }), nombreArchivo(res.pestana));
}

/**
 * Nombre de hoja de Excel válido: máx 31 caracteres, sin `\ / ? * [ ] :`, y único
 * dentro del libro (Excel rechaza nombres repetidos o inválidos).
 */
function nombreHoja(pestana: string, usados: Set<string>): string {
  const base = (pestana.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Hoja");
  let nombre = base;
  let i = 2;
  while (usados.has(nombre.toLowerCase())) {
    const sufijo = ` (${i})`;
    nombre = base.slice(0, 31 - sufijo.length) + sufijo;
    i++;
  }
  usados.add(nombre.toLowerCase());
  return nombre;
}

/**
 * Descarga UN Excel con una hoja por pestaña (cada hoja con solo sus columnas con
 * datos). Es el "descargar todas": todas las listas juntas en un solo archivo, cada
 * pestaña en su propia hoja.
 */
export function descargarExcelPorPestana(resultados: SheetResult[]): void {
  const wb = XLSX.utils.book_new();
  const usados = new Set<string>();

  for (const res of resultados) {
    const columnas = columnasDePestana(res);
    const aoa = [columnas, ...res.filas.map((f) => columnas.map((c) => valorCelda(f, c)))];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = columnas.map((c) => ({ wch: Math.max(c.length + 2, 12) }));
    XLSX.utils.book_append_sheet(wb, ws, nombreHoja(res.pestana, usados));
  }

  XLSX.writeFile(wb, "reportes-habitaciones.xlsx");
}

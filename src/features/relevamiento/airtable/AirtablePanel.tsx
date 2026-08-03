import { useEffect, useMemo, useState } from "react";
import { MAPEO_PESTANA_ITEMS } from "./mapeoAirtable";
import type { Hotel } from "./mapeoAirtable";
import {
  probarConexion,
  actualizarRegistros,
  AirtableError,
  TABLA_EQUIPAMIENTO,
} from "./airtableClient";
import type { AirtableRecord } from "./airtableClient";
import { compararConAirtable, armarUpdates } from "./comparar";
import type { ResultadoComparacion } from "./comparar";
import type { SheetResult } from "../unpivot";

const PASSPHRASE = "servicio-htl";
const LS_BASE = "sh_airtable_base";
const LS_TOKEN = "sh_airtable_token";

interface Props {
  /** Relevamiento ya procesado (para comparar). Null si todavía no subieron el Excel. */
  resultados: SheetResult[] | null;
  /** Hotel elegido en el conversor (define grilla y mapeo). */
  hotel: Hotel;
}

/**
 * "Conectar con Airtable" — botón flotante que abre una ventanita para ingresar la
 * clave y las credenciales, probar la conexión, COMPARAR el relevamiento con Airtable
 * (con vista previa de cómo quedaría) y APLICAR los cambios elegidos.
 */
export default function AirtablePanel({ resultados, hotel }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [desbloqueado, setDesbloqueado] = useState(false);
  const [frase, setFrase] = useState("");
  const [claveMal, setClaveMal] = useState(false);

  const [baseId, setBaseId] = useState("");
  const [token, setToken] = useState("");
  const [tabla, setTabla] = useState(TABLA_EQUIPAMIENTO);
  const [recordar, setRecordar] = useState(false);

  const [probando, setProbando] = useState(false);
  const [error, setError] = useState("");
  const [conexion, setConexion] = useState<{ muestra: AirtableRecord[]; hayMas: boolean; campos: string[] } | null>(null);

  // Comparación
  const [comparando, setComparando] = useState(false);
  const [progreso, setProgreso] = useState("");
  const [comp, setComp] = useState<ResultadoComparacion | null>(null);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [aplicando, setAplicando] = useState(false);
  const [aplicaMsg, setAplicaMsg] = useState("");

  useEffect(() => {
    const b = localStorage.getItem(LS_BASE);
    const t = localStorage.getItem(LS_TOKEN);
    if (b) setBaseId(b);
    if (t) {
      setToken(t);
      setRecordar(true);
    }
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierto]);

  const intentarEntrar = () => {
    if (frase === PASSPHRASE) setDesbloqueado(true);
    else setClaveMal(true);
  };

  const pestanasMapeadas = Object.keys(MAPEO_PESTANA_ITEMS[hotel] ?? {}).length;
  const credencialesOk = Boolean(baseId.trim() && token.trim());
  const hayRelevamiento = Boolean(resultados && resultados.length);

  const guardarPref = () => {
    if (recordar) {
      localStorage.setItem(LS_BASE, baseId.trim());
      localStorage.setItem(LS_TOKEN, token.trim());
    } else {
      localStorage.removeItem(LS_BASE);
      localStorage.removeItem(LS_TOKEN);
    }
  };

  const probar = async () => {
    setError("");
    setConexion(null);
    if (!credencialesOk) return setError("Completá el Base ID y el token.");
    guardarPref();
    setProbando(true);
    try {
      setConexion(await probarConexion(token.trim(), baseId.trim(), tabla.trim()));
    } catch (e) {
      setError(e instanceof AirtableError ? e.message : "Error inesperado al conectar.");
    } finally {
      setProbando(false);
    }
  };

  const comparar = async () => {
    setError("");
    setComp(null);
    setAplicaMsg("");
    if (!credencialesOk) return setError("Completá el Base ID y el token.");
    if (!resultados || !resultados.length) return setError("Subí primero el Excel del relevamiento (arriba).");
    guardarPref();
    setComparando(true);
    setProgreso("Empezando…");
    try {
      const r = await compararConAirtable(
        { token: token.trim(), baseId: baseId.trim(), tablaEquip: tabla.trim(), hotel },
        resultados,
        setProgreso
      );
      setComp(r);
      setSel(new Set(r.diffs.map((_, i) => i))); // por defecto, todos seleccionados
    } catch (e) {
      setError(e instanceof AirtableError ? e.message : "Error inesperado al comparar.");
    } finally {
      setComparando(false);
      setProgreso("");
    }
  };

  const diffsSeleccionados = useMemo(
    () => (comp ? comp.diffs.filter((_, i) => sel.has(i)) : []),
    [comp, sel]
  );
  const registrosAAfectar = useMemo(() => armarUpdates(diffsSeleccionados).length, [diffsSeleccionados]);

  const toggle = (i: number) =>
    setSel((s) => {
      const n = new Set(s);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  const toggleTodos = () =>
    setSel((s) => (comp && s.size === comp.diffs.length ? new Set() : new Set(comp!.diffs.map((_, i) => i))));

  const aplicar = async () => {
    if (!comp || !diffsSeleccionados.length) return;
    const n = registrosAAfectar;
    if (!window.confirm(`Vas a actualizar ${n} registro(s) en Airtable. Esto modifica la base real. ¿Confirmás?`)) return;
    setAplicando(true);
    setError("");
    setAplicaMsg("");
    try {
      await actualizarRegistros(
        token.trim(),
        baseId.trim(),
        tabla.trim(),
        armarUpdates(diffsSeleccionados),
        (hechos) => setAplicaMsg(`Actualizando… ${hechos}/${n}`)
      );
      setAplicaMsg(`✅ Listo. Se actualizaron ${n} registro(s) en Airtable.`);
      // Quitar de la vista los diffs ya aplicados.
      const restantes = comp.diffs.filter((_, i) => !sel.has(i));
      setComp({ ...comp, diffs: restantes });
      setSel(new Set());
    } catch (e) {
      setError(
        e instanceof AirtableError
          ? e.message + " (para actualizar, el token necesita el permiso data.records:write)"
          : "Error inesperado al actualizar."
      );
    } finally {
      setAplicando(false);
    }
  };

  return (
    <>
      <button type="button" className="airtable-fab" onClick={() => setAbierto(true)} aria-haspopup="dialog">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            d="M12 2 2 7l10 5 10-5-10-5Zm0 7.5L4.5 6 12 3l7.5 3L12 9.5ZM2 12l10 5 10-5M2 17l10 5 10-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Conectar con Airtable
      </button>

      {abierto && (
        <div className="modal-overlay" onClick={() => setAbierto(false)}>
          <div
            className={`modal${comp ? " modal--ancho" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label="Conectar con Airtable"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal__cabecera">
              <h2 className="modal__titulo">Conectar con Airtable</h2>
              <button type="button" className="modal__cerrar" onClick={() => setAbierto(false)} aria-label="Cerrar">
                ×
              </button>
            </div>

            <div className="modal__cuerpo">
              {!desbloqueado ? (
                <div className="gate">
                  <div className="gate__icono" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="26" height="26">
                      <path
                        d="M6 10V8a6 6 0 1 1 12 0v2m-9 0h6a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3Z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <p className="gate__texto">Esta sección es privada. Ingresá la clave de acceso para continuar.</p>
                  <div className="airtable__campo">
                    <label htmlFor="at-frase" className="sr-only">
                      Clave de acceso
                    </label>
                    <input
                      id="at-frase"
                      type="password"
                      value={frase}
                      autoFocus
                      onChange={(e) => {
                        setFrase(e.target.value);
                        setClaveMal(false);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && intentarEntrar()}
                      placeholder="Clave de acceso"
                      aria-invalid={claveMal}
                    />
                  </div>
                  {claveMal && (
                    <p className="gate__error" role="alert">
                      Clave incorrecta.
                    </p>
                  )}
                  <button type="button" className="boton boton--primario boton--full" onClick={intentarEntrar}>
                    Entrar
                  </button>
                </div>
              ) : (
                <>
                  <p className="deteccion">
                    Token y Base ID quedan <strong>solo en tu navegador</strong>. Para comparar,
                    subí primero el Excel del relevamiento (arriba) y elegí el hotel que corresponde.
                  </p>

                  <p className="airtable__hotel">
                    Hotel: <strong>{hotel}</strong> · {pestanasMapeadas} pestañas mapeadas
                    <span className="airtable__hint"> (se elige arriba, en el conversor)</span>
                  </p>

                  <div className="airtable__grid">
                    <div className="airtable__campo airtable__campo--ancho">
                      <label htmlFor="at-base">Base ID (empieza con app…)</label>
                      <input id="at-base" type="text" value={baseId} onChange={(e) => setBaseId(e.target.value)} placeholder="appXXXXXXXXXXXXXX" autoComplete="off" />
                    </div>
                    <div className="airtable__campo airtable__campo--ancho">
                      <label htmlFor="at-token">Personal Access Token</label>
                      <input id="at-token" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="patXXXXXXXXXXXXXX…" autoComplete="off" />
                    </div>
                    <div className="airtable__campo airtable__campo--ancho">
                      <label htmlFor="at-tabla">Tabla</label>
                      <input id="at-tabla" type="text" value={tabla} onChange={(e) => setTabla(e.target.value)} />
                    </div>
                  </div>

                  <label className="airtable__recordar">
                    <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} />
                    Recordar token y Base ID en este dispositivo
                  </label>

                  <div className="acciones">
                    <button type="button" className="boton boton--secundario" onClick={probar} disabled={probando || comparando}>
                      {probando ? "Conectando…" : "Probar conexión"}
                    </button>
                    <button type="button" className="boton boton--primario" onClick={comparar} disabled={comparando || probando || !hayRelevamiento} title={!hayRelevamiento ? "Subí primero el Excel del relevamiento" : undefined}>
                      {comparando ? "Comparando…" : "Comparar con el relevamiento"}
                    </button>
                  </div>

                  {!hayRelevamiento && <p className="airtable__hint">Para comparar, subí primero el Excel del relevamiento arriba.</p>}
                  {comparando && (
                    <p className="cargando-msg">
                      <span className="spinner" aria-hidden="true" />
                      {progreso || "Comparando…"}
                    </p>
                  )}
                  {error && (
                    <p className="alerta" role="alert">
                      ⚠️ {error}
                    </p>
                  )}

                  {conexion && !comp && (
                    <p className="aviso aviso--info">
                      ✅ Conexión OK. Traje {conexion.muestra.length} registro(s) de ejemplo
                      {conexion.hayMas ? " (hay más)" : ""}.
                    </p>
                  )}

                  {comp && (
                    <div className="airtable__resultado">
                      <p className="aviso aviso--info">
                        Comparé <strong>{comp.comparados}</strong> ítem×habitación · encontré{" "}
                        <strong>{comp.diffs.length}</strong> diferencia(s)
                        {comp.sinEnAirtable ? ` · ${comp.sinEnAirtable} sin registro en Airtable` : ""}.
                      </p>

                      {comp.diffs.length === 0 ? (
                        <p className="info-card">No hay diferencias: Airtable ya coincide con el relevamiento. 🎉</p>
                      ) : (
                        <>
                          <p className="deteccion">
                            Vista previa de cómo quedaría. Destildá lo que no quieras aplicar.
                          </p>
                          <div className="tabla-wrap diff-wrap">
                            <table className="tabla diff-tabla">
                              <thead>
                                <tr>
                                  <th>
                                    <input
                                      type="checkbox"
                                      checked={sel.size === comp.diffs.length}
                                      onChange={toggleTodos}
                                      aria-label="Seleccionar todo"
                                    />
                                  </th>
                                  <th>Hab.</th>
                                  <th>Ítem</th>
                                  <th>Campo</th>
                                  <th>En Airtable</th>
                                  <th>Quedaría</th>
                                </tr>
                              </thead>
                              <tbody>
                                {comp.diffs.map((d, i) => (
                                  <tr key={`${d.recordId}-${d.campo}`}>
                                    <td>
                                      <input type="checkbox" checked={sel.has(i)} onChange={() => toggle(i)} />
                                    </td>
                                    <td className="num">{d.habitacion}</td>
                                    <td>{d.item}</td>
                                    <td>{d.campo}</td>
                                    <td className="diff-viejo">{d.enAirtable}</td>
                                    <td className="diff-nuevo">{d.quedaria}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="acciones">
                            <button type="button" className="boton boton--primario" onClick={aplicar} disabled={aplicando || !diffsSeleccionados.length}>
                              {aplicando ? "Aplicando…" : `Aplicar ${registrosAAfectar} registro(s) a Airtable`}
                            </button>
                          </div>
                          <p className="airtable__hint">
                            Para aplicar, el token necesita el permiso <strong>data.records:write</strong>. Esto
                            modifica la base real.
                          </p>
                        </>
                      )}

                      {aplicaMsg && <p className="aviso aviso--info">{aplicaMsg}</p>}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

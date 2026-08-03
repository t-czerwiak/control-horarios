import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { MAPEO_PESTANA_ITEMS } from "./mapeoAirtable";
import type { Hotel } from "./mapeoAirtable";
import { actualizarRegistros, AirtableError, TABLA_EQUIPAMIENTO } from "./airtableClient";
import { compararConAirtable, armarUpdates, resumirCambios } from "./comparar";
import type { ResultadoComparacion } from "./comparar";
import { observarSesion, obtenerCredenciales, cerrarSesion, AuthError } from "./firebase";
import type { CredencialesAirtable } from "./firebase";
import type { SheetResult } from "../unpivot";
import LoginForm from "./LoginForm";
import DiffTable from "./DiffTable";
import ConfirmarAplicar from "./ConfirmarAplicar";

interface Props {
  /** Relevamiento ya procesado (para comparar). Null si todavía no subieron el Excel. */
  resultados: SheetResult[] | null;
  /** Hotel elegido en el conversor (define grilla y mapeo). */
  hotel: Hotel;
}

/** Pasos de la pantalla, para no mezclar estados. */
type Vista = "cargando" | "login" | "listo" | "confirmar";

/**
 * "Conectar con Airtable": botón flotante que abre una ventanita donde el empleado
 * inicia sesión, compara el relevamiento con Airtable y aplica los cambios elegidos.
 * Las credenciales de Airtable no las escribe el usuario: se leen de Firestore y solo
 * están disponibles con sesión iniciada.
 */
export default function AirtablePanel({ resultados, hotel }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [usuario, setUsuario] = useState<User | null>(null);
  const [vista, setVista] = useState<Vista>("cargando");
  const [cred, setCred] = useState<CredencialesAirtable | null>(null);

  const [error, setError] = useState("");
  const [comparando, setComparando] = useState(false);
  const [progreso, setProgreso] = useState("");
  const [comp, setComp] = useState<ResultadoComparacion | null>(null);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [aplicando, setAplicando] = useState(false);
  const [aplicaMsg, setAplicaMsg] = useState("");

  // Sesión: al iniciarla, se traen las credenciales compartidas desde Firestore.
  useEffect(
    () =>
      observarSesion(async (u) => {
        setUsuario(u);
        if (!u) {
          setCred(null);
          setVista("login");
          return;
        }
        try {
          setCred(await obtenerCredenciales());
          setVista("listo");
        } catch (e) {
          setError(e instanceof AuthError ? e.message : "No se pudieron leer las credenciales.");
          setVista("listo");
        }
      }),
    []
  );

  // Cerrar con Escape (salvo mientras hay una operación en curso).
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !comparando && !aplicando) setAbierto(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierto, comparando, aplicando]);

  const pestanasMapeadas = Object.keys(MAPEO_PESTANA_ITEMS[hotel] ?? {}).length;
  const hayRelevamiento = Boolean(resultados?.length);

  const diffsSeleccionados = useMemo(
    () => (comp ? comp.diffs.filter((_, i) => sel.has(i)) : []),
    [comp, sel]
  );
  const resumen = useMemo(() => resumirCambios(diffsSeleccionados), [diffsSeleccionados]);

  const comparar = useCallback(async () => {
    if (!cred || !resultados?.length) return;
    setError("");
    setComp(null);
    setAplicaMsg("");
    setComparando(true);
    setProgreso("Empezando…");
    try {
      const r = await compararConAirtable(
        {
          token: cred.token,
          baseId: cred.baseId,
          tablaEquip: cred.tabla || TABLA_EQUIPAMIENTO,
          hotel,
        },
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
  }, [cred, resultados, hotel]);

  const aplicar = useCallback(async () => {
    if (!cred || !comp || !diffsSeleccionados.length) return;
    const updates = armarUpdates(diffsSeleccionados);
    setVista("listo");
    setAplicando(true);
    setError("");
    setAplicaMsg("");
    try {
      await actualizarRegistros(
        cred.token,
        cred.baseId,
        cred.tabla || TABLA_EQUIPAMIENTO,
        updates,
        (hechos) => setAplicaMsg(`Actualizando… ${hechos}/${updates.length}`)
      );
      setAplicaMsg(`✅ Listo. Se actualizaron ${updates.length} registro(s) en Airtable.`);
      setComp({ ...comp, diffs: comp.diffs.filter((_, i) => !sel.has(i)) });
      setSel(new Set());
    } catch (e) {
      setError(
        e instanceof AirtableError
          ? `${e.message} (para escribir, el token necesita el permiso data.records:write)`
          : "Error inesperado al actualizar."
      );
      setAplicaMsg("");
    } finally {
      setAplicando(false);
    }
  }, [cred, comp, diffsSeleccionados, sel]);

  const toggle = (i: number) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  const toggleTodos = () =>
    setSel((s) => (comp && s.size === comp.diffs.length ? new Set() : new Set(comp?.diffs.map((_, i) => i) ?? [])));

  const salir = async () => {
    await cerrarSesion();
    setComp(null);
    setSel(new Set());
    setAplicaMsg("");
    setError("");
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
        <div className="modal-overlay" onClick={() => !comparando && !aplicando && setAbierto(false)}>
          <div
            className={`modal${comp && vista === "listo" ? " modal--ancho" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label="Conectar con Airtable"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal__cabecera">
              <h2 className="modal__titulo">Conectar con Airtable</h2>
              <button
                type="button"
                className="modal__cerrar"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <div className="modal__cuerpo">
              {vista === "cargando" && <p className="info-card">Cargando…</p>}

              {vista === "login" && <LoginForm />}

              {vista === "confirmar" && usuario && (
                <ConfirmarAplicar
                  resumen={resumen}
                  hotel={hotel}
                  usuario={usuario.email ?? "usuario"}
                  onConfirmar={aplicar}
                  onCancelar={() => setVista("listo")}
                />
              )}

              {vista === "listo" && (
                <>
                  <p className="airtable__sesion">
                    <span>
                      Sesión: <strong>{usuario?.email}</strong>
                    </span>
                    <button type="button" className="link" onClick={salir}>
                      Salir
                    </button>
                  </p>
                  <p className="airtable__hotel">
                    Hotel: <strong>{hotel}</strong> · {pestanasMapeadas} pestañas mapeadas
                    <span className="airtable__hint"> (se elige arriba, en el conversor)</span>
                  </p>

                  <div className="acciones">
                    <button
                      type="button"
                      className="boton boton--primario"
                      onClick={comparar}
                      disabled={comparando || !hayRelevamiento || !cred}
                      title={!hayRelevamiento ? "Subí primero el Excel del relevamiento" : undefined}
                    >
                      {comp ? "Volver a comparar" : "Comparar con el relevamiento"}
                    </button>
                  </div>

                  {!hayRelevamiento && (
                    <p className="airtable__hint">
                      Para comparar, subí primero el Excel del relevamiento arriba.
                    </p>
                  )}

                  {error && (
                    <p className="alerta" role="alert">
                      ⚠️ {error}
                    </p>
                  )}
                  {aplicaMsg && <p className="aviso aviso--info">{aplicaMsg}</p>}

                  {comp && (
                    <div className="airtable__resultado">
                      <p className="aviso aviso--info">
                        Comparé <strong>{comp.comparados}</strong> ítem×habitación · encontré{" "}
                        <strong>{comp.diffs.length}</strong> diferencia(s)
                        {comp.sinEnAirtable ? ` · ${comp.sinEnAirtable} sin registro en Airtable` : ""}.
                      </p>

                      {comp.diffs.length === 0 ? (
                        <p className="info-card">
                          No hay diferencias: Airtable ya coincide con el relevamiento. 🎉
                        </p>
                      ) : (
                        <>
                          <p className="deteccion">
                            Vista previa de cómo quedaría. Destildá lo que no quieras aplicar.
                          </p>
                          <DiffTable
                            diffs={comp.diffs}
                            seleccion={sel}
                            onToggle={toggle}
                            onToggleTodos={toggleTodos}
                          />
                          <div className="acciones">
                            <button
                              type="button"
                              className="boton boton--primario"
                              onClick={() => setVista("confirmar")}
                              disabled={!diffsSeleccionados.length}
                            >
                              Revisar y aplicar ({resumen.registros} registro
                              {resumen.registros === 1 ? "" : "s"})
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {(comparando || aplicando) && (
        <div className="carga-overlay" role="alert" aria-busy="true">
          <div className="carga-overlay__box">
            <span className="spinner spinner--grande" aria-hidden="true" />
            <p className="carga-overlay__titulo">
              {comparando ? "Comparando con Airtable…" : "Actualizando Airtable…"}
            </p>
            <p className="carga-overlay__msg">
              {comparando ? progreso || "Trayendo datos…" : aplicaMsg || "Aplicando cambios…"}
            </p>
            <p className="carga-overlay__nota">
              Esto puede tardar un minuto. No cierres ni toques la página hasta que termine.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

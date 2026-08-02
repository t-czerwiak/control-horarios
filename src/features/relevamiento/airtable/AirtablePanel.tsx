import { useEffect, useState } from "react";
import { HOTELES, MAPEO_PESTANA_ITEMS } from "./mapeoAirtable";
import type { Hotel } from "./mapeoAirtable";
import { probarConexion, AirtableError, TABLA_EQUIPAMIENTO } from "./airtableClient";
import type { AirtableRecord } from "./airtableClient";

// Gate suave (no es seguridad real: el código es visible). Solo evita que un
// visitante casual entre a la sección de Airtable. La protección real es que el
// token lo trae el usuario y nunca se guarda en el código.
const PASSPHRASE = "servicio-htl";

const LS_BASE = "sh_airtable_base";
const LS_TOKEN = "sh_airtable_token";

/**
 * Panel "Conectar con Airtable" — PRIMERA ETAPA: prueba de conexión y credenciales.
 * Permite pegar token + Base ID (quedan solo en el navegador), elegir hotel y probar
 * la conexión. Muestra un diagnóstico de lo que trae Airtable. La comparación completa
 * se agrega una vez confirmada la conexión.
 */
export default function AirtablePanel() {
  const [desbloqueado, setDesbloqueado] = useState(false);
  const [frase, setFrase] = useState("");

  const [hotel, setHotel] = useState<Hotel>(HOTELES[0]);
  const [baseId, setBaseId] = useState("");
  const [token, setToken] = useState("");
  const [tabla, setTabla] = useState(TABLA_EQUIPAMIENTO);
  const [recordar, setRecordar] = useState(false);

  const [probando, setProbando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<{
    muestra: AirtableRecord[];
    hayMas: boolean;
    campos: string[];
  } | null>(null);

  // Cargar Base ID / token recordados en este dispositivo (si el usuario lo pidió).
  useEffect(() => {
    const b = localStorage.getItem(LS_BASE);
    const t = localStorage.getItem(LS_TOKEN);
    if (b) setBaseId(b);
    if (t) {
      setToken(t);
      setRecordar(true);
    }
  }, []);

  const pestanasMapeadas = Object.keys(MAPEO_PESTANA_ITEMS[hotel] ?? {}).length;

  const probar = async () => {
    setError("");
    setResultado(null);
    if (!baseId.trim() || !token.trim()) {
      setError("Completá el Base ID y el token.");
      return;
    }
    // Guardar / borrar según la preferencia (solo en este dispositivo).
    if (recordar) {
      localStorage.setItem(LS_BASE, baseId.trim());
      localStorage.setItem(LS_TOKEN, token.trim());
    } else {
      localStorage.removeItem(LS_BASE);
      localStorage.removeItem(LS_TOKEN);
    }

    setProbando(true);
    try {
      const r = await probarConexion(token.trim(), baseId.trim(), tabla.trim());
      setResultado(r);
    } catch (e) {
      setError(e instanceof AirtableError ? e.message : "Error inesperado al conectar.");
      if (!(e instanceof AirtableError)) console.error(e);
    } finally {
      setProbando(false);
    }
  };

  if (!desbloqueado) {
    return (
      <section className="card">
        <h2 className="airtable__titulo">Conectar con Airtable</h2>
        <p className="deteccion">Esta sección es privada. Ingresá la clave de acceso para continuar.</p>
        <div className="airtable__campo">
          <label htmlFor="at-frase">Clave de acceso</label>
          <input
            id="at-frase"
            type="password"
            value={frase}
            onChange={(e) => setFrase(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && frase === PASSPHRASE) setDesbloqueado(true);
            }}
            placeholder="clave"
          />
        </div>
        {frase && frase !== PASSPHRASE && <p className="alerta" role="alert">Clave incorrecta.</p>}
        <button
          type="button"
          className="boton boton--primario"
          onClick={() => frase === PASSPHRASE && setDesbloqueado(true)}
        >
          Entrar
        </button>
      </section>
    );
  }

  return (
    <section className="card">
      <h2 className="airtable__titulo">
        Conectar con Airtable <span className="badge-beta">prueba de conexión</span>
      </h2>
      <p className="deteccion">
        Pegá tu token y Base ID de Airtable y probá la conexión. El token queda{" "}
        <strong>solo en tu navegador</strong> (no se guarda en ningún servidor ni en el código).
        Recomendado: usar un token con permisos mínimos (solo esa base, lectura de registros).
      </p>

      <div className="airtable__grid">
        <div className="airtable__campo">
          <label htmlFor="at-hotel">Hotel</label>
          <select id="at-hotel" value={hotel} onChange={(e) => setHotel(e.target.value as Hotel)}>
            {HOTELES.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          <span className="airtable__hint">{pestanasMapeadas} pestañas mapeadas para comparar</span>
        </div>

        <div className="airtable__campo">
          <label htmlFor="at-base">Base ID (empieza con app…)</label>
          <input
            id="at-base"
            type="text"
            value={baseId}
            onChange={(e) => setBaseId(e.target.value)}
            placeholder="appXXXXXXXXXXXXXX"
            autoComplete="off"
          />
        </div>

        <div className="airtable__campo airtable__campo--ancho">
          <label htmlFor="at-token">Personal Access Token</label>
          <input
            id="at-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="patXXXXXXXXXXXXXX…"
            autoComplete="off"
          />
        </div>

        <div className="airtable__campo airtable__campo--ancho">
          <label htmlFor="at-tabla">Tabla</label>
          <input id="at-tabla" type="text" value={tabla} onChange={(e) => setTabla(e.target.value)} />
        </div>
      </div>

      <label className="airtable__recordar">
        <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} />
        Recordar token y Base ID en este dispositivo (usa el almacenamiento local del navegador)
      </label>

      <div className="acciones">
        <button type="button" className="boton boton--primario" onClick={probar} disabled={probando}>
          {probando ? "Conectando…" : "Probar conexión"}
        </button>
      </div>

      {error && (
        <p className="alerta" role="alert">
          ⚠️ {error}
        </p>
      )}

      {resultado && (
        <div className="airtable__resultado">
          <p className="aviso aviso--info">
            ✅ Conexión OK. Traje {resultado.muestra.length} registro(s) de ejemplo
            {resultado.hayMas ? " (hay más)" : ""}. Campos detectados:{" "}
            <strong>{resultado.campos.join(", ") || "—"}</strong>.
          </p>
          <details>
            <summary>Ver registros de ejemplo (crudo)</summary>
            <pre className="airtable__json">
              {JSON.stringify(
                resultado.muestra.map((r) => r.fields),
                null,
                2
              )}
            </pre>
          </details>
          <p className="deteccion">
            Esto es la prueba de conexión. Con esto confirmado, el próximo paso es mostrar la
            comparación (Estado, Observación y Fecha) contra el relevamiento.
          </p>
        </div>
      )}
    </section>
  );
}

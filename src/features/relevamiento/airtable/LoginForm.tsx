import { useState } from "react";
import { iniciarSesion, AuthError } from "./firebase";

/**
 * Formulario de inicio de sesión (Firebase Authentication).
 * Cada empleado entra con su propio email y contraseña; las credenciales de
 * Airtable NO se piden acá: las trae la app desde Firestore una vez logueado.
 */
export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [entrando, setEntrando] = useState(false);

  const entrar = async () => {
    if (!email.trim() || !password) {
      setError("Completá tu email y contraseña.");
      return;
    }
    setError("");
    setEntrando(true);
    try {
      await iniciarSesion(email, password);
      // El cambio de sesión lo detecta el panel (observarSesion): no hace falta más.
    } catch (e) {
      setError(e instanceof AuthError ? e.message : "No se pudo iniciar sesión.");
    } finally {
      setEntrando(false);
    }
  };

  return (
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
      <p className="gate__texto">
        Ingresá con tu usuario para conectarte a Airtable. Si no tenés uno, pedíselo al
        responsable.
      </p>

      <div className="airtable__campo">
        <label htmlFor="at-email">Email</label>
        <input
          id="at-email"
          type="email"
          value={email}
          autoFocus
          autoComplete="username"
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && entrar()}
          placeholder="nombre@empresa.com"
        />
      </div>

      <div className="airtable__campo">
        <label htmlFor="at-pass">Contraseña</label>
        <input
          id="at-pass"
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(e) => {
            setPassword(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && entrar()}
          placeholder="Tu contraseña"
        />
      </div>

      {error && (
        <p className="gate__error" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        className="boton boton--primario boton--full"
        onClick={entrar}
        disabled={entrando}
      >
        {entrando ? "Entrando…" : "Entrar"}
      </button>
    </div>
  );
}

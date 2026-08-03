import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";

// Config pública de Firebase. NO son secretos: identifican al proyecto y están
// pensados para vivir en el cliente. Lo que protege los datos son las reglas de
// seguridad de Firestore (solo usuarios autenticados leen las credenciales).
const firebaseConfig = {
  apiKey: "AIzaSyC7hQqAPulVCkquSCBCR62ps3fv5oLnlWc",
  authDomain: "control-horarios-9cf4d.firebaseapp.com",
  projectId: "control-horarios-9cf4d",
  storageBucket: "control-horarios-9cf4d.firebasestorage.app",
  messagingSenderId: "1068992488508",
  appId: "1:1068992488508:web:456185f421d4a2795c8f39",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/** Documento de Firestore donde vive la credencial compartida de Airtable. */
const DOC_CONFIG = doc(db, "config", "airtable");

/** Credenciales de Airtable que usa el equipo (guardadas en Firestore). */
export interface CredencialesAirtable {
  token: string;
  baseId: string;
  /** Nombre de la tabla; si no está, se usa el valor por defecto. */
  tabla?: string;
}

/** Error con mensaje claro y orientado al usuario (en español). */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/** Traduce los códigos de error de Firebase Auth a mensajes entendibles. */
function mensajeDeError(code: string): string {
  switch (code) {
    case "auth/invalid-email":
      return "El email no tiene un formato válido.";
    case "auth/user-disabled":
      return "Ese usuario está deshabilitado. Hablá con el responsable.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Email o contraseña incorrectos.";
    case "auth/too-many-requests":
      return "Demasiados intentos fallidos. Esperá unos minutos y probá de nuevo.";
    case "auth/network-request-failed":
      return "No hay conexión. Revisá tu internet e intentá de nuevo.";
    case "auth/operation-not-allowed":
    case "auth/configuration-not-found":
      // Falta habilitar Email/Password en la consola de Firebase (ver docs/CONFIGURACION-ADMIN.md).
      return "El inicio de sesión todavía no está configurado en el sistema. Avisá al responsable.";
    default:
      return "No se pudo iniciar sesión. Intentá de nuevo.";
  }
}

/** Inicia sesión con email y contraseña. */
export async function iniciarSesion(email: string, password: string): Promise<User> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    return cred.user;
  } catch (e) {
    const code = (e as { code?: string })?.code ?? "";
    throw new AuthError(mensajeDeError(code));
  }
}

/** Cierra la sesión del usuario actual. */
export function cerrarSesion(): Promise<void> {
  return fbSignOut(auth);
}

/** Avisa cuando cambia el usuario logueado (null = sin sesión). */
export function observarSesion(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

/**
 * Trae las credenciales de Airtable desde Firestore. Solo funciona con sesión
 * iniciada: las reglas de seguridad bloquean la lectura a usuarios anónimos.
 */
export async function obtenerCredenciales(): Promise<CredencialesAirtable> {
  let snap;
  try {
    snap = await getDoc(DOC_CONFIG);
  } catch {
    throw new AuthError(
      "No se pudieron leer las credenciales de Airtable. Revisá tu conexión o avisá al responsable."
    );
  }
  if (!snap.exists()) {
    throw new AuthError(
      "Todavía no están cargadas las credenciales de Airtable en el sistema. Avisá al responsable."
    );
  }
  const data = snap.data() as Partial<CredencialesAirtable>;
  if (!data.token || !data.baseId) {
    throw new AuthError(
      "Las credenciales de Airtable están incompletas (falta token o baseId). Avisá al responsable."
    );
  }
  return { token: data.token, baseId: data.baseId, tabla: data.tabla };
}

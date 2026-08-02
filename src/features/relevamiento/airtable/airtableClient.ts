// Cliente mínimo de la API de Airtable, para correr 100% en el navegador.
// El token NUNCA se guarda en el código ni se envía a otro lado que no sea
// api.airtable.com. Lo provee el usuario en tiempo de ejecución.

const API = "https://api.airtable.com/v0";

/** Nombre por defecto de la tabla a consultar (el usuario puede cambiarlo). */
export const TABLA_EQUIPAMIENTO = "Equipamiento por Espacio";

/** Un registro crudo de Airtable. */
export interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

/** Error con mensaje claro y orientado al usuario (en español). */
export class AirtableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AirtableError";
  }
}

/** Traduce una respuesta HTTP fallida a un mensaje entendible. */
async function errorDeRespuesta(resp: Response): Promise<AirtableError> {
  let detalle = "";
  try {
    const body = await resp.json();
    detalle = (body?.error?.message || body?.error?.type || "").toString();
  } catch {
    /* sin cuerpo JSON */
  }
  switch (resp.status) {
    case 401:
      return new AirtableError("Token inválido o vencido. Revisá el Personal Access Token.");
    case 403:
      return new AirtableError(
        "El token no tiene permiso sobre esta base. Revisá que el token incluya esta base y los scopes de lectura de registros."
      );
    case 404:
      return new AirtableError(
        "No se encontró la base o la tabla. Revisá el Base ID y el nombre de la tabla."
      );
    case 422:
      return new AirtableError(`Pedido inválido${detalle ? ": " + detalle : ""}. Revisá nombres de tabla/campos.`);
    case 429:
      return new AirtableError("Airtable pidió esperar (límite de velocidad). Probá de nuevo en unos segundos.");
    default:
      return new AirtableError(`Error de Airtable (HTTP ${resp.status})${detalle ? ": " + detalle : ""}.`);
  }
}

/**
 * Trae una página de registros de una tabla. Devuelve los registros y el `offset`
 * para la próxima página (o undefined si no hay más).
 * Lanza AirtableError con un mensaje claro si algo falla (incluido posible CORS).
 */
export async function listarPagina(
  token: string,
  baseId: string,
  tabla: string,
  opts: { campos?: string[]; maxRecords?: number; pageSize?: number; offset?: string } = {}
): Promise<{ records: AirtableRecord[]; offset?: string }> {
  const params = new URLSearchParams();
  if (opts.maxRecords) params.set("maxRecords", String(opts.maxRecords));
  if (opts.pageSize) params.set("pageSize", String(opts.pageSize));
  if (opts.offset) params.set("offset", opts.offset);
  for (const c of opts.campos ?? []) params.append("fields[]", c);

  const url = `${API}/${encodeURIComponent(baseId)}/${encodeURIComponent(tabla)}?${params.toString()}`;

  let resp: Response;
  try {
    resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    // fetch solo tira TypeError por red o por CORS (política del navegador).
    throw new AirtableError(
      "No se pudo conectar con Airtable desde el navegador. Puede ser un problema de red o que Airtable bloquee las llamadas desde el navegador (CORS). Avisá para resolverlo."
    );
  }
  if (!resp.ok) throw await errorDeRespuesta(resp);

  const body = (await resp.json()) as { records: AirtableRecord[]; offset?: string };
  return { records: body.records ?? [], offset: body.offset };
}

/**
 * Prueba de conexión: trae unos pocos registros de la tabla indicada y devuelve un
 * diagnóstico (cuántos trajo, si hay más, y una muestra de los campos crudos). Sirve
 * para verificar token + Base ID + CORS antes de armar la comparación completa.
 */
export async function probarConexion(
  token: string,
  baseId: string,
  tabla = TABLA_EQUIPAMIENTO
): Promise<{ muestra: AirtableRecord[]; hayMas: boolean; campos: string[] }> {
  const { records, offset } = await listarPagina(token, baseId, tabla, { maxRecords: 5 });
  const campos = new Set<string>();
  for (const r of records) for (const k of Object.keys(r.fields)) campos.add(k);
  return { muestra: records, hayMas: Boolean(offset), campos: [...campos] };
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Trae TODOS los registros de una tabla, paginando. Entre páginas espera un poco
 * para no pasarse del límite de Airtable (5 req/s) y reintenta una vez si hay 429.
 */
export async function listarTodos(
  token: string,
  baseId: string,
  tabla: string,
  opts: { campos?: string[]; onProgreso?: (n: number) => void } = {}
): Promise<AirtableRecord[]> {
  const todos: AirtableRecord[] = [];
  let offset: string | undefined;
  let guard = 0;
  do {
    let pagina;
    try {
      pagina = await listarPagina(token, baseId, tabla, {
        campos: opts.campos,
        pageSize: 100,
        offset,
      });
    } catch (e) {
      if (e instanceof AirtableError && /límite de velocidad/.test(e.message)) {
        await dormir(1500);
        pagina = await listarPagina(token, baseId, tabla, { campos: opts.campos, pageSize: 100, offset });
      } else {
        throw e;
      }
    }
    todos.push(...pagina.records);
    offset = pagina.offset;
    opts.onProgreso?.(todos.length);
    if (offset) await dormir(220);
  } while (offset && ++guard < 2000);
  return todos;
}

/**
 * Actualiza registros en lotes de 10 (máximo que acepta Airtable por request).
 * Requiere que el token tenga el scope data.records:write.
 */
export async function actualizarRegistros(
  token: string,
  baseId: string,
  tabla: string,
  updates: { id: string; fields: Record<string, unknown> }[],
  onProgreso?: (n: number) => void
): Promise<void> {
  const url = `${API}/${encodeURIComponent(baseId)}/${encodeURIComponent(tabla)}`;
  for (let i = 0; i < updates.length; i += 10) {
    const lote = updates.slice(i, i + 10);
    let resp: Response;
    try {
      resp = await fetch(url, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ records: lote }),
      });
    } catch {
      throw new AirtableError("No se pudo conectar con Airtable para actualizar (red o CORS).");
    }
    if (!resp.ok) throw await errorDeRespuesta(resp);
    onProgreso?.(Math.min(i + 10, updates.length));
    if (i + 10 < updates.length) await dormir(220);
  }
}

# Guía para el personal — Comparar y actualizar Airtable

Esta guía explica, paso a paso, cómo pasar los datos de un **relevamiento de habitaciones**
(el Excel) a la base de **Airtable**, usando la herramienta web, sin tocar Airtable a mano.

**Página:** la dirección de la herramienta → pestaña **"Convertidor de Reportes de Habitaciones → Airtable"**

---

## ¿Qué hace?

1. Lee el Excel del relevamiento.
2. Lo **compara** con lo que hay hoy en Airtable.
3. Te muestra **qué cambiaría** (una vista previa).
4. Vos elegís qué aplicar, y la herramienta **actualiza Airtable** por vos.

Solo toca la tabla **Equipamiento por Espacio**, y de ella solo dos cosas:
- **Calificación** (las estrellas del 1 al 5).
- **Observación** (el texto).

**Las calificaciones salen del color de cada habitación en el Excel:**

| Color en el Excel | Calificación |
| --- | --- |
| Verde (Bien) | 5 estrellas |
| Amarillo (Más o menos) | 3 estrellas |
| Rojo (Mal) | 1 estrella |
| Sin color (No revisado) | *no se toca* |

> Si una habitación no tiene color, la herramienta **no cambia** su calificación en Airtable
> (no borra lo que ya estaba).

---

## Lo que necesitás antes de empezar

1. **El Excel** del relevamiento de la sede.
2. **La clave de acceso** de la herramienta (pedísela al responsable).
3. De tu base de Airtable:
   - El **Base ID** (empieza con `app…`).
   - Un **token** (Personal Access Token, empieza con `pat…`).

### Cómo sacar el Base ID
Abrí tu base en Airtable y mirá la dirección (URL) del navegador:
`https://airtable.com/` **`appXXXXXXXXXXXXXX`** `/tbl…/viw…` → copiá la parte que empieza con `app`.

### Cómo crear el token
1. En Airtable, entrá a **airtable.com/create/tokens**.
2. **Create new token** → ponele un nombre (por ejemplo *Relevamientos*).
3. **Scopes** (permisos): agregá
   - `data.records:read` (para comparar)
   - `data.records:write` (para poder **actualizar**)
4. **Access**: dale acceso a **tu base**.
5. **Create token** → copiá el token (empieza con `pat…`). **Se muestra una sola vez.**

> El token es como una llave: no lo compartas por chat/mail. La herramienta lo guarda
> **solo en tu navegador**, no lo manda a ningún otro lado.

---

## Paso a paso

1. Entrá a la página y andá a la pestaña **"Convertidor de Reportes de Habitaciones → Airtable"**.
2. Arriba, en **"Hotel del relevamiento"**, elegí la **sede** que corresponde al Excel.
   *Importante: elegí la sede correcta antes de subir el archivo.*
3. **Subí el Excel** (clic o arrastrándolo).
4. Abajo a la derecha, tocá el botón **"Conectar con Airtable"**.
5. Ingresá la **clave de acceso** y tocá **Entrar**.
6. Pegá el **Base ID** y el **token**. (Podés tildar *"Recordar en este dispositivo"* para no
   pegarlos cada vez, si es tu computadora.)
7. Tocá **"Comparar con el relevamiento"**. Va a tardar un rato (alrededor de **un minuto**)
   mientras trae los datos; vas a ver una pantalla de carga. **Esperá a que termine.**
8. Aparece la **vista previa**: una tabla con `Habitación · Ítem · Campo · En Airtable → Quedaría`.
   - En rojo tachado, lo que hay hoy en Airtable; en verde, cómo quedaría.
   - **Destildá** las filas que **no** quieras cambiar.
9. Tocá **"Aplicar … a Airtable"**, confirmá, y listo: se actualizan los registros elegidos.

---

## Consejos importantes

- **Comparar no cambia nada** (es solo lectura). Podés comparar tranquilo para ver las diferencias.
- La **primera vez que apliques**, probá con **1 o 2 filas** (destildá el resto) y verificá en
  Airtable que quedó bien. Después aplicá el resto.
- Para **aplicar** hace falta que el token tenga el permiso `data.records:write` (ver arriba).
- Si dice **"No hay diferencias"**, es que Airtable ya coincide con el Excel.

---

## Si algo sale mal

| Mensaje | Qué significa / qué hacer |
| --- | --- |
| *Token inválido o vencido* | Revisá el token, o creá uno nuevo. |
| *El token no tiene permiso sobre esta base* | Al token le falta acceso a tu base (o el permiso de escritura, si estás aplicando). |
| *No se encontró la base o la tabla* | Revisá el **Base ID** (empieza con `app…`). |
| *No se pudo conectar…* | Problema de internet. Reintentá. |
| Tarda mucho | Es normal la primera vez (trae toda la base). Esperá a que termine la pantalla de carga. |

Ante cualquier duda o error que no figure acá, avisá al responsable con una captura de pantalla.

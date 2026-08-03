# Guía para el personal de HTL — Comparar y actualizar Airtable

Esta guía explica, paso a paso, cómo pasar los datos de un **relevamiento de habitaciones**
(el Excel) a la base de **Airtable (Ticketera)**, usando la herramienta web, sin tocar
Airtable a mano.

**Página:** https://servicio-hoteleria.web.app → pestaña **"Convertidor de Reportes de Habitaciones → Airtable"**

Sedes cubiertas: **HTL Urbano**, **HTL 9 de Julio** y **HTL City Baires**.

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

## Lo que necesitás

- **El Excel** del relevamiento de la sede.
- **Tu usuario y contraseña** de la herramienta (te los da el responsable).

Eso es todo: **no tenés que manejar ningún token ni configurar nada de Airtable**. La conexión
ya está cargada en el sistema y se usa sola cuando iniciás sesión.

> Tu usuario es personal: no lo compartas. Si te olvidaste la contraseña, pedile al
> responsable que te la restablezca.

---

## Paso a paso

1. Entrá a la página y andá a la pestaña **"Convertidor de Reportes de Habitaciones → Airtable"**.
2. **Subí el Excel** (clic o arrastrándolo). La herramienta **detecta sola la sede**, por el
   nombre del archivo o, si no lo dice, por las habitaciones que contiene.
3. Fijate en el cartel **"Sede"** que aparece arriba de la tabla: dice cuál detectó. Si por
   algún motivo no es la correcta, cambiala ahí y se recalcula todo.
4. Abajo a la derecha, tocá el botón **"Conectar con Airtable"**.
5. Ingresá tu **email y contraseña**, y tocá **Entrar**.
6. Tocá **"Comparar con el relevamiento"**. Tarda alrededor de **un minuto** mientras trae los
   datos; vas a ver una pantalla de carga. **Esperá a que termine.**
7. Aparece la **vista previa**: una tabla con `Habitación · Ítem · Campo · En Airtable → Quedaría`.
   - En rojo tachado, lo que hay hoy en Airtable; en verde, cómo quedaría.
   - **Destildá** las filas que **no** quieras cambiar.
8. Tocá **"Revisar y aplicar"**. Vas a ver un **resumen** con cuántos registros, habitaciones,
   calificaciones y observaciones se van a modificar, y el detalle por ítem.
9. Si está todo bien, tildá **"Revisé los cambios y confirmo…"** y tocá **"Aplicar a Airtable"**.

---

## Consejos importantes

- **Comparar no cambia nada** (es solo lectura). Podés comparar tranquilo para ver las diferencias.
- La **primera vez que apliques**, probá con **1 o 2 filas** (destildá el resto) y verificá en
  Airtable que quedó bien. Después aplicá el resto.
- **Revisá el resumen** antes de confirmar: ahí ves exactamente qué se va a subir.
- Los cambios aplicados **no se pueden deshacer** desde la herramienta.
- Si dice **"No hay diferencias"**, es que Airtable ya coincide con el Excel.
- Cuando termines, si estás en una computadora compartida, tocá **"Salir"** para cerrar tu sesión.

---

## Si algo sale mal

| Mensaje | Qué significa / qué hacer |
| --- | --- |
| *Email o contraseña incorrectos* | Revisá tus datos. Si no los recordás, pedile al responsable que te los restablezca. |
| *Demasiados intentos fallidos* | Esperá unos minutos antes de volver a probar. |
| *Todavía no están cargadas las credenciales…* | Falta configurar la conexión. Avisá al responsable. |
| *El token no tiene permiso sobre esta base* | La credencial cargada no permite escribir. Avisá al responsable. |
| *No se pudo conectar…* | Problema de internet. Reintentá. |
| Tarda mucho | Es normal la primera vez (trae toda la base). Esperá a que termine la pantalla de carga. |

Ante cualquier duda o error que no figure acá, avisá al responsable con una captura de pantalla.

# Configuración inicial (para el administrador)

Esta guía es para quien administra el sistema. Explica cómo dejar lista la conexión con
Airtable para que **los empleados no tengan que manejar ningún token**: entran con su
usuario y contraseña, y la app usa la credencial compartida guardada en Firestore.

> Solo hace falta hacerlo **una vez**. Después, dar de alta un empleado son 30 segundos.

---

## Cómo está pensada la seguridad

| Qué | Dónde vive | Quién lo ve |
| --- | --- | --- |
| Usuarios y contraseñas | Firebase Authentication | Nadie (los administra Firebase) |
| Token de Airtable | Firestore, documento `config/airtable` | Solo empleados **autorizados** |
| Lista de autorizados | Firestore, colección `empleados` | Cada uno ve solo su entrada |
| Config de Firebase (apiKey, etc.) | En el código | Es pública por diseño, no es un secreto |

La clave del diseño: **el token de Airtable nunca está en el código ni en el repositorio**.
Vive en Firestore y las reglas de seguridad (`firestore.rules`) solo permiten **leerlo**, y
solo a un empleado autorizado; **escribirlo desde la app está bloqueado** (se carga a mano
desde la consola). Si alguien deja de trabajar, se le borra el usuario y pierde el acceso al
instante, sin tener que cambiar el token.

> **Por qué hay una lista de autorizados y no alcanza con tener cuenta.** Firebase permite el
> **auto-registro**: como la `apiKey` es pública, cualquiera podría crearse una cuenta desde
> afuera. Por eso las reglas exigen, además de la sesión, que el email tenga su documento en
> la colección `empleados` (que solo creás vos). Sin esa entrada, la persona puede iniciar
> sesión pero **no puede leer nada**.

---

## Paso 1 — Habilitar el inicio de sesión

1. Entrá a la [consola de Firebase](https://console.firebase.google.com/) → proyecto
   **control-horarios-9cf4d**.
2. Menú **Build → Authentication** → botón **Get started**.
3. Pestaña **Sign-in method** → elegí **Email/Password** → **Enable** → **Save**.
   (Dejá *Email link* desactivado.)

## Paso 2 — Crear la base de datos Firestore

1. Menú **Build → Firestore Database** → **Create database**.
2. Elegí la región (ej. `southamerica-east1`) y **Start in production mode**
   (las reglas correctas se despliegan en el paso 4).

## Paso 3 — Cargar la credencial de Airtable

1. En **Firestore Database → Data**, creá una colección llamada **`config`**.
2. Dentro, creá un documento con ID **`airtable`**.
3. Agregale estos campos (tipo *string*):

   | Campo | Valor |
   | --- | --- |
   | `token` | El Personal Access Token de Airtable (empieza con `pat…`) |
   | `baseId` | El Base ID de la base Ticketera (empieza con `app…`) |
   | `tabla` | *(opcional)* Nombre de la tabla. Por defecto: `Equipamiento por Espacio` |

   El token de Airtable necesita los permisos **`data.records:read`** (comparar) y
   **`data.records:write`** (aplicar), y acceso a la base Ticketera.

## Paso 4 — Desplegar las reglas de seguridad

Desde la carpeta del proyecto:

```bash
npx firebase-tools deploy --only firestore:rules
```

Esto aplica `firestore.rules`: lectura de `config/*` solo con sesión iniciada, escritura
bloqueada, y todo lo demás cerrado.

## Paso 5 — Cerrar el auto-registro (recomendado)

En **Authentication → Settings → User actions**, destildá **“Enable create (sign-up)”** y
guardá. Así nadie puede crearse una cuenta por su cuenta; los usuarios los creás vos.
(Aunque no lo hagas, la lista de autorizados del Paso 6 ya bloquea el acceso a los datos:
esto es una segunda barrera.)

## Paso 6 — Dar de alta a los empleados

Por cada persona hay que hacer **dos cosas**:

1. **Crear el usuario**: Authentication → **Users → Add user**. Poné su email y una
   contraseña provisoria, y pasásela.
2. **Autorizarla**: Firestore → colección **`empleados`** → **Add document** con
   **ID de documento = el email exacto de la persona** (ej. `juan@htl.com`).
   El documento puede ir vacío, o con un campo `nombre` (string) para acordarte de quién es.

> Si te olvidás del segundo paso, la persona va a poder iniciar sesión pero le va a aparecer
> *“Tu usuario todavía no está habilitado para usar esta función”*.

**Para quitarle el acceso a alguien**: borrá su documento de `empleados` (corta el acceso a
los datos al instante) y, si además no debe poder entrar, borrá o deshabilitá su usuario en
Authentication.

---

## Mantenimiento

- **Rotar el token de Airtable**: cambiá el campo `token` en `config/airtable`. No hace falta
  tocar el código ni volver a desplegar.
- **Ver quién entró**: Authentication → Users muestra la fecha del último inicio de sesión.
- **Cambiar la tabla**: campo `tabla` del mismo documento.

## Si algo falla

| Síntoma | Causa probable |
| --- | --- |
| “El inicio de sesión todavía no está configurado…” | Falta el Paso 1. |
| “Tu usuario todavía no está habilitado…” | Falta su documento en `empleados` (Paso 6.2), o el ID no coincide **exactamente** con su email. |
| “Todavía no están cargadas las credenciales…” | Falta el Paso 3 (o el ID del documento no es `airtable`). |
| “No se pudieron leer las credenciales…” | Faltan las reglas (Paso 4) o Firestore no está creado (Paso 2). |
| “El token no tiene permiso sobre esta base” | Al token de Airtable le falta acceso a la base o el scope `data.records:write`. |

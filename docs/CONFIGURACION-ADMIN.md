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
| Token de Airtable | Firestore, documento `config/airtable` | Solo usuarios con sesión iniciada |
| Config de Firebase (apiKey, etc.) | En el código | Es pública por diseño, no es un secreto |

La clave del diseño: **el token de Airtable nunca está en el código ni en el repositorio**.
Vive en Firestore y las reglas de seguridad (`firestore.rules`) solo permiten **leerlo** a un
usuario autenticado, y **no permiten escribirlo desde la app** (se carga a mano desde la
consola). Si un empleado deja de trabajar, se le borra el usuario y pierde el acceso al
instante, sin tener que cambiar el token.

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

## Paso 5 — Dar de alta a los empleados

1. **Authentication → Users → Add user**.
2. Poné el email y una contraseña provisoria; pasásela a la persona.
3. Para quitarle el acceso a alguien: **Delete user** (o *Disable*). El cambio es inmediato.

---

## Mantenimiento

- **Rotar el token de Airtable**: cambiá el campo `token` en `config/airtable`. No hace falta
  tocar el código ni volver a desplegar.
- **Ver quién entró**: Authentication → Users muestra la fecha del último inicio de sesión.
- **Cambiar la tabla**: campo `tabla` del mismo documento.

## Si algo falla

| Síntoma | Causa probable |
| --- | --- |
| “El inicio de sesión con email no está habilitado” | Falta el Paso 1. |
| “Todavía no están cargadas las credenciales…” | Falta el Paso 3 (o el ID del documento no es `airtable`). |
| “No se pudieron leer las credenciales…” | Faltan las reglas (Paso 4) o Firestore no está creado (Paso 2). |
| “El token no tiene permiso sobre esta base” | Al token de Airtable le falta acceso a la base o el scope de escritura. |

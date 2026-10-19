# Control de Operaciones · Clase Alpha

Aplicación de logística para el control de vehículos, préstamos de carros y equipos,
mantenimiento, inventario y despachos.

Este repositorio es la **versión en Vue 3 + Vite** de la app que originalmente estaba
hecha en HTML con JavaScript vanilla (una página por pantalla, Firebase por CDN y
mucho `innerHTML`). La app original vive fuera de este repo y se usa solo como
referencia.

## Requisitos

- Node.js 22.18+ o 24.12+ (probado con Node 24).
- Una cuenta con permisos en el proyecto Firebase `prestamo-revision--carro-alpha`.

## Puesta en marcha

```sh
npm install
```

Copia `.env.example` a `.env` y completa los valores del proyecto Firebase
(Consola de Firebase → Configuración del proyecto → Tus apps → Configuración del SDK).
Si no creas el `.env`, la app usa la configuración que ya está como respaldo en
`src/firebase/config.js`.

Las llaves de una app **Web** de Firebase no son secretas: viajan siempre al navegador.
El `.env` sirve para poder apuntar a otro proyecto (por ejemplo, uno de pruebas) sin
tocar el código.

```sh
npm run dev      # desarrollo
npm run build    # compilar a dist/
npm run preview  # probar lo compilado
npm run lint     # revisar estilo
```

## Cómo está organizado

```
src/
  firebase/        Inicialización del SDK modular de Firebase (db, auth)
  services/        Acceso a Firestore (listar, crear, actualizar, eliminar)
  stores/          Pinia: auth (sesión y roles) y datos (las colecciones)
  components/
    layout/        Sidebar, nav móvil, barra de sesión, login
    ui/            BaseModal y FirmaCanvas
  views/           Una vista por pantalla
  utils/           Helpers compartidos (fechas, inventario)
  assets/base.css  Estilos compartidos
```

El detalle de la migración (equivalencias HTML→Vue, estado y pendientes) está en
[`docs/migracion.md`](docs/migracion.md).

## Roles

El acceso se administra por correo electrónico:

| Rol | Correo | Puede ver |
| --- | --- | --- |
| Admin | `VITE_ADMIN_EMAIL` | Todo |
| Editor de equipos | `VITE_EDITOR_EQUIPOS_EMAIL` | Equipos Asignados |
| Mantenimiento | `VITE_VISITANTE_MANT_EMAIL` | Mant. Equipos |
| Visitante | (anónimo) | Muro Público |

## Despliegue

`firebase.json` publica la carpeta `dist` y redirige todas las rutas a `index.html`
(la app usa el router de Vue, no páginas separadas):

```sh
npm run build
npx firebase deploy --only hosting
```

## Seguridad

- **Nunca** subir a este repositorio `service-account.json` ni la librería
  `firebase-admin`: son del lado servidor. Si alguna vez se subieron a algún repo,
  hay que **rotar la clave** desde la Consola de Firebase (Configuración del proyecto →
  Cuentas de servicio) y borrarla del historial de git.
- Las reglas de Firestore están en `firestore.rules`. Revisar que `/prestamos` no
  quede abierto a escritura pública.

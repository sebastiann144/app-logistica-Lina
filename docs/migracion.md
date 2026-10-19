# Migración de la app de Lina: de HTML + JS vanilla a Vue 3

Documento de trabajo. Explica **cómo** se traduce cada pantalla y en qué estado va
la migración. La app original está en
`C:\Users\sebas\Desktop\PROYECTOS LINA\firebase-app\public\` y es **solo lectura**.

## Estructura

| Ruta | Qué contiene |
| --- | --- |
| `src/firebase/` | Inicialización del SDK **modular** de Firebase (`app`, `db`, `auth`) y la configuración. Reemplaza los `<script>` compat que el original cargaba por CDN en cada página. |
| `src/services/firestore.js` | `listar`, `crear`, `actualizar`, `eliminar`, `obtener`. Punto único de acceso a Firestore. |
| `src/stores/auth.js` | Sesión, roles (`esAdmin`, `esEditorEquipos`, `esVisitanteMant`) y modal de login. |
| `src/stores/datos.js` | Las 14 colecciones que el original cargaba en variables globales, ahora en un store de Pinia. |
| — | Hay colecciones que el original **no** cargaba al inicio y que se piden dentro de su vista: `mantEquipos` (Mant. Equipos) y `personasEquipos`, `asignacionesEquipos`, `devolucionesEquipos`, `movimientosEquipos`, `equiposOficina` (Equipos Asignados). Se leen con `listar()` en `onMounted` y se guardan en `ref([])` locales. |
| `src/assets/base.css` | El CSS compartido extraído del `<style>` de `index.html`. |
| `src/components/layout/` | Shell: sidebar, nav móvil, barra de sesión, modal de login. |
| `src/components/ui/` | `BaseModal` (reemplaza `cerrarModal(id)`) y `FirmaCanvas` (reemplaza `initFirma`/`capturarFirma`). |
| `src/nav.js` | Los items del menú con el rol que los puede ver. |
| `src/views/` | Una vista `.vue` por cada "tab"/página del original. |
| `src/utils/` | Helpers compartidos (`fechas`, `inventario`). |

## Equivalencias al traducir

| Original (HTML + JS vanilla) | Vue |
| --- | --- |
| `document.getElementById('x').value` | `v-model="form.x"` |
| `document.getElementById('x').textContent = v` | `{{ v }}` |
| `onclick="fn()"` / `onchange="fn(this.value)"` | `@click="fn"` / `v-model` |
| `onclick="abrirModalX(3)"` (índice) | `@click="abrirModalX(item)"` (el objeto) |
| `div.innerHTML = arr.map(...).join('')` | `v-for="item in arr" :key="item.id"` |
| `let arr = []` (global) | `useDatosStore()` → `datos.arr` |
| `db.collection('x').doc(ref).set(obj)` | `await crear('x', obj)` |
| `db.collection('x').doc(id).update(obj)` | `await actualizar('x', id, obj)` |
| `db.collection('x').doc(id).delete()` | `await eliminar('x', id)` |
| `db.collection('x').orderBy('createdAt').get()` | `datos.recargar('x')` |
| `[...arr].reverse()` (lo último primero) | `computed(() => [...arr].reverse())` |
| `usuarioActual.uid` | `auth.usuario?.uid` |
| `localStorage` | se elimina: Firestore es la única fuente de verdad |
| `iframe` a otra página | ruta del router + vista de Vue |

## Reglas

1. **Nada de `document.*`, `innerHTML`, `onclick=` ni `localStorage`** en las vistas.
2. Los textos, emojis y clases CSS se copian **igual** al original.
3. Los `id` del original que sólo servían para el JS desaparecen; las clases CSS se conservan.
4. Las listas que el original ordenaba con `.reverse()` se leen con un `computed`.
5. Después de crear/editar/eliminar: `await datos.recargar('coleccion')`
   (o `datos.recargarVarias(['a','b'])` si afecta varias).
6. `<style scoped>` para lo propio de la vista; lo compartido va en `base.css`.
7. Un commit por vista terminada.

## API de los componentes compartidos

```vue
<!-- BaseModal: reemplaza .modal-overlay + cerrarModal(id) -->
<BaseModal :abierto="modalAbierto" ancho="680px" @cerrar="modalAbierto = false"> ... </BaseModal>

<!-- FirmaCanvas: reemplaza initFirma/capturarFirma/limpiarFirma/cargarFirma -->
<FirmaCanvas v-model="form.firma" :alto="120" />
```

```js
import { actualizar, crear, eliminar, listar } from '@/services/firestore'
import { useAuthStore } from '@/stores/auth'
import { useDatosStore } from '@/stores/datos'
import { ahora, diffDias, hoy, formatearFecha } from '@/utils/fechas'
import { INV_ICONOS, INV_TIPOS, invIcono, invTipoIcono, invRef, normalizarInventario } from '@/utils/inventario'
```

- `crear(nombre, datos)` agrega `createdAt: serverTimestamp()` solo.
- `datos` expone: `vehiculos, mantenimientos, gasolina, liquidos, permisos, revisionGas,
  soat, kilometraje, prestamos, reservas, equipos, reservasEquipos, inventario,
  checklistDespacho, cargando, error` + `recargar, recargarVarias, aplicar, toma`.
- `auth` expone: `esAdmin, esEditorEquipos, esVisitanteMant, puedeVerMantEquipos,
  puedeVerEquiposAsignados, puedeEditarEquipos, usuario, etiquetaUsuario`.

## Rutas

| Ruta | Vista | Origen original |
| --- | --- | --- |
| `/muro-publico` | `MuroPublicoView` | tab Muro de `index.html` + `muro-publico.html` |
| `/vehiculos` | `VehiculosView` | tab Vehiculos (8 sub-tabs) |
| `/prestamo-carros` | `PrestamoCarrosView` | tab Prestamo Carros |
| `/prestamo-equipos` | `PrestamoEquiposView` | tab Prestamo Equipos |
| `/checklist-despacho` | `ChecklistDespachoView` | `checklist-despacho.html` |
| `/mant-equipos` | `MantEquiposView` | `mant-equipos.html` |
| `/equipos-asignados` | `EquiposAsignadosView` | tab Equipos Asignados (`asig*`) |
| `/inventario` | `InventarioView` | tab Inventario (`inv*`) |
| `/home` | `HomeView` | tab Home (`renderHome`, alertas) |
| `/` | redirige a `/muro-publico` | era el tab activo por defecto |
| `/asignaciones-equipos` | redirige a `/equipos-asignados` | URL de la pagina suelta equivalente |
| `/equipos-oficina` | redirige a `/equipos-asignados` | URL del modulo anterior (registros legados) |

## Cambios de comportamiento (a propósito)

- **Filtro por vehículo**: en el original `filtroVehiculo` era una variable global que
  filtraba también las tablas de otros tabs (un efecto oculto). Ahora el selector vive
  sólo dentro de `VehiculosView` y filtra esa pantalla; las demás muestran todo.
- **Reservas de equipos**: existían en el Muro y en el tab de equipos (`muroReservasEquiposList`).
  Quedaron en un solo lugar: `MuroPublicoView`.
- **Sin `localStorage`**: Firestore es la única fuente de verdad.
- **`menu`**: el item "Home" apunta a `/home`, no a `/`, porque `/` abre el Muro Público
  igual que el original (el panel `active` por defecto).

## Paginas sueltas del sitio original

En el `firebase.json` original habia rewrites a estas paginas, aunque el menu no las
enlazaba. Estado de cada una:

| Pagina | Que era | Decision |
| --- | --- | --- |
| `muro-publico.html` | Muro publico con reservas | Cubierta por `MuroPublicoView` (`/muro-publico`). |
| `checklist-despacho.html` | Formulario de fichas de despacho | Cubierta por `ChecklistDespachoView` (`/checklist-despacho`). |
| `mant-equipos.html` | Mantenimiento de equipos (iframe) | Cubierta por `MantEquiposView` (`/mant-equipos`). |
| `asignaciones-equipos.html` | Modulo de asignaciones basado en inventario | Es el mismo modulo que `EquiposAsignadosView`; no se migra aparte. |
| `equipos-oficina.html` | Modulo **anterior**: CRUD sobre `equiposOficina` | No se migra: esta en desuso (ver abajo). Sus registros se ven en `EquiposAsignadosView`. |

### Evidencia de que `equipos-oficina.html` esta en desuso

Consulta del 2026-10-19 (lectura anonima, como hace la app):

- `equiposOficina`: 17 registros, **todos creados entre el 2026-06-18 y el 2026-07-21**.
  Solo 1 tiene devolucion y 1 tiene `updatedAt` (2026-08-31).
- El modulo nuevo si tiene actividad: `asignacionesEquipos` hasta 2026-09-24 y
  `movimientosEquipos` hasta 2026-09-24.

Es decir: no se crean equipos desde esa pantalla hace ~3 meses; los 17 registros son
la carga historica que el modulo nuevo ya muestra como "registros anteriores". Aun
asi, sus datos siguen visibles y se les puede registrar la devolucion desde
`EquiposAsignadosView`.

## Pendientes / decisiones abiertas

- `firebase.json` ya apunta `hosting.public` a `dist` con el rewrite `** → /index.html` (SPA).
- **Atencion: `firestore.rules` no coincide con lo desplegado.** El archivo del repo
  original dice `allow read: if true`, pero las reglas en produccion exigen sesion
  (`request.auth != null`): sin autenticarse, toda lectura da `permission-denied`. Por
  eso la app original carga los datos recien despues del login y `muro-publico.html`
  entraba de forma anonima. **Antes de tocar reglas, alinear `firestore.rules` con las
  reglas reales** (o desplegar solo `--only hosting`) para no abrir la base de datos
  por accidente.
- **Seguridad:** el original tiene `service-account.json` y `firebase-admin` en
  `package.json` (sin uso). `service-account.json` esta en su `.gitignore` y nunca se
  subio al repositorio; aun asi conviene borrarlo del disco.
- **`checklistDespacho` esta vacia**: los datos reales del checklist estan en
  `checklistDespachoRutas` (10 fichas). De ahi que `ChecklistDespachoView` lea/guarde
  en `checklistDespachoRutas` y no en el store.
- El respaldo en `localStorage` se eliminó a propósito.
- `src/utils/inventario.js` incluye los iconos completos de `INV_ICONOS`/`INV_TIPOS`
  tal cual el original (`Computador`, `Router`, `Teléfono`, …).

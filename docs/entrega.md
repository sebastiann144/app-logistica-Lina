# Entrega del proyecto · Clase Alpha

Fecha prevista de entrega: **2026-11-03**.

## Estado actual

- Rama de trabajo: `dev`.
- Último commit de la app: `a341474` (corregida la sesión anónima de la barra de acceso).
- `main` queda intacta.
- Producción **todavía** muestra la app vieja; el despliegue se hace el día de la entrega.
- `npm run lint` y `npm run build` pasan.
- No se migraron datos de Firestore: los 26 registros actuales siguen igual.

## Antes de salir de casa

- [ ] Confirmar que la cuenta tiene permiso **Editor** o **Owner** en el proyecto Firebase
      `prestamo-revision--carro-alpha`.
- [ ] Confirmar el correo y la contraseña del administrador para la demostración.
- [ ] Confirmar que el equipo tiene Node.js 22.18+ o 24.12+.
- [ ] Opcional: cambiar la rama por defecto de GitHub a `dev`.

## 1. Validar la versión local

```powershell
cd C:\Users\sebas\app-logistica-Lina
git switch dev
git pull origin dev
npm install
npm run lint
npm run build
npm run preview
```

Abrir `http://localhost:4173/` y probar:

- [ ] El Muro Público carga datos.
- [ ] La barra muestra `Visitante` y el botón `Iniciar sesión como admin`.
- [ ] El botón abre el login; no se queda cambiando entre “Iniciar sesión” y “Cerrar sesión”.
- [ ] El admin puede iniciar sesión y cerrar sesión.
- [ ] Inventario: los monitores no salen en “Uso común”.
- [ ] Inventario: “Uso común” incluye escritorios, impresoras y “Otros”.
- [ ] Las sillas de oficina asignadas muestran su responsable.
- [ ] Equipos Asignados: el selector no muestra equipos de uso común.
- [ ] El formulario de asignación muestra los accesorios.
- [ ] El filtro `Disponible / Asignado / Devuelto` funciona.
- [ ] La pestaña `Devoluciones` muestra los registros devueltos.
- [ ] Al asignar un equipo, el responsable se refleja en Inventario.
- [ ] Al devolverlo, vuelve a quedar disponible.
- [ ] Checklist de Despacho y navegación móvil cargan sin errores.

## 2. Desplegar a Firebase Hosting

La CLI de Firebase no está instalada globalmente en este equipo. Se puede usar con `npx`:

```powershell
npx firebase-tools@latest login
npx firebase-tools@latest projects:list
npx firebase-tools@latest use prestamo-revision--carro-alpha
npx firebase-tools@latest deploy --only hosting
```

Alternativa, si se prefiere instalar la CLI:

```powershell
npm install -g firebase-tools
firebase login
firebase use prestamo-revision--carro-alpha
firebase deploy --only hosting
```

> **Importante:** usar siempre `--only hosting`.
> No ejecutar `firebase deploy` sin esa opción ni desplegar reglas de Firestore.
> Las reglas reales de producción no coinciden con el archivo del repositorio.

Si aparece un error de permisos, pedir acceso **Editor/Owner** en Firebase Console antes de
seguir. No cambiar las reglas para “hacer que funcione”.

## 3. Verificar producción

Abrir:

- `https://prestamo-revision--carro-alpha.web.app`
- `https://prestamo-revision--carro-alpha.firebaseapp.com`

Hacer una recarga forzada con `Ctrl + Shift + R` y repetir el checklist corto:

- [ ] Muro Público como visitante.
- [ ] Login del administrador.
- [ ] Inventario y equipos asignados.
- [ ] Devoluciones.
- [ ] Consola del navegador sin errores rojos.

## 4. Demostración para Lina y el jefe

Orden sugerido, aproximadamente 5 minutos:

1. Abrir el Muro Público como visitante y mostrar que no hace falta cuenta para consultar.
2. Entrar como administrador.
3. Mostrar Inventario: uso común separado de equipos asignables.
4. Mostrar una silla de oficina con su responsable.
5. Crear una asignación con accesorios y ver el cambio reflejado en Inventario.
6. Registrar una devolución y mostrar el filtro `Devuelto` y la pestaña `Devoluciones`.
7. Mostrar Checklist de Despacho y la navegación móvil.

## 5. Si algo falla después de publicar

Firebase Hosting conserva versiones anteriores:

1. Ir a Firebase Console → Hosting → Historial de versiones.
2. Elegir la versión anterior y usar **Rollback**.

El despliegue no toca Firestore, así que los datos no se pierden al revertir el hosting.

## Pendientes no bloqueantes

- La “C” de Clase Alpha cuando el menú lateral está colapsado.
- Mejora opcional de la vista de visitante.
- Tema de Diana / préstamo del carro: descartado por ahora.
- Sincronización en tiempo real entre pestañas: no está implementada; el flujo actual
  recarga al asignar o devolver.

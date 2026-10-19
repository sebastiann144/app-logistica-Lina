// Menu lateral y de movil.
// Es la traduccion de los <nav class="sidebar"> y <nav class="mobile-nav"> de
// index.html (lineas 488-516). `requiere` reproduce los items que el original
// mostraba u ocultaba segun el rol (toggleAdminUI).
export const ITEMS_MENU = [
  // Ojo: la app original abre en el Muro Publico (el panel con class "active"),
  // por eso la ruta "/" redirige al muro y el Home vive en "/home".
  { to: '/home', icono: '🏠', etiqueta: 'Home', corto: 'Home', requiere: 'admin' },
  { to: '/vehiculos', icono: '🚗', etiqueta: 'Vehiculos', corto: 'Veh.', requiere: 'admin' },
  {
    to: '/prestamo-carros',
    icono: '🔑',
    etiqueta: 'Prestamo Carros',
    corto: 'Prest.',
    requiere: 'admin',
  },
  {
    to: '/prestamo-equipos',
    icono: '📦',
    etiqueta: 'Prestamo Equipos',
    corto: 'Equip.',
    requiere: 'admin',
  },
  {
    to: '/checklist-despacho',
    icono: '✅',
    etiqueta: 'Checklist Despacho',
    corto: 'Checklist',
    requiere: 'admin',
  },
  { to: '/muro-publico', icono: '🌐', etiqueta: 'Muro Publico', corto: 'Muro' },
  {
    to: '/mant-equipos',
    icono: '⚙️',
    etiqueta: 'Mant. Equipos',
    corto: 'M.Eq.',
    requiere: 'mant',
  },
  {
    to: '/equipos-asignados',
    icono: '🖥️',
    etiqueta: 'EQUIPOS ASIGNADOS',
    corto: 'Eq.O.',
    requiere: 'equipos',
  },
  {
    to: '/inventario',
    icono: '📋',
    etiqueta: 'Inventario Eq.',
    corto: 'Inv.Eq.',
    requiere: 'admin',
  },
]

import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import MuroPublicoView from '@/views/MuroPublicoView.vue'

// Cada "tab" del index.html original ahora es una ruta.
// Las rutas con meta.requiere replican las comprobaciones de cambiarTab():
//  - 'admin'  -> solo la cuenta de operaciones
//  - 'mant'   -> admin o la cuenta de mantenimiento
//  - 'equipos'-> admin o la cuenta de gestion humana
// meta.sinShell oculta la cabecera y la barra de sesion, igual que hacia el
// original con los tabs "de iframe" (Mant. Equipos y Equipos Asignados).
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/muro-publico' },
    {
      path: '/home',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { requiere: 'admin' },
    },
    {
      path: '/muro-publico',
      name: 'muro-publico',
      component: MuroPublicoView,
    },
    {
      path: '/vehiculos',
      name: 'vehiculos',
      component: () => import('@/views/VehiculosView.vue'),
      meta: { requiere: 'admin' },
    },
    {
      path: '/prestamo-carros',
      name: 'prestamo-carros',
      component: () => import('@/views/PrestamoCarrosView.vue'),
      meta: { requiere: 'admin' },
    },
    {
      path: '/prestamo-equipos',
      name: 'prestamo-equipos',
      component: () => import('@/views/PrestamoEquiposView.vue'),
      meta: { requiere: 'admin' },
    },
    {
      path: '/checklist-despacho',
      name: 'checklist-despacho',
      component: () => import('@/views/ChecklistDespachoView.vue'),
      meta: { requiere: 'admin' },
    },
    {
      path: '/mant-equipos',
      name: 'mant-equipos',
      component: () => import('@/views/MantEquiposView.vue'),
      meta: { requiere: 'mant', sinShell: true },
    },
    {
      path: '/equipos-asignados',
      name: 'equipos-asignados',
      component: () => import('@/views/EquiposAsignadosView.vue'),
      meta: { requiere: 'equipos', sinShell: true },
    },
    {
      path: '/inventario',
      name: 'inventario',
      component: () => import('@/views/InventarioView.vue'),
      meta: { requiere: 'admin' },
    },
    // URLs de las paginas sueltas del sitio original que ya no existen como
    // pantalla propia. Se mantienen para no romper enlaces guardados:
    //  - /asignaciones-equipos.html era el mismo modulo que EquiposAsignadosView.
    //  - /equipos-oficina.html era el modulo anterior; sus registros se ven como
    //    "registros anteriores" dentro de Equipos Asignados.
    { path: '/asignaciones-equipos', redirect: '/equipos-asignados' },
    { path: '/equipos-oficina', redirect: '/equipos-asignados' },
    // Ruta comodin: cualquier URL desconocida vuelve al muro publico.
    { path: '/:pathMatch(.*)*', redirect: '/muro-publico' },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  // Espera a que Firebase diga si hay sesion antes de decidir (si no, un admin
  // que recarga la pagina seria enviado al muro publico).
  await auth.esperarListo()
  if (!auth.puede(to.meta.requiere)) {
    return { name: 'muro-publico' }
  }
  return true
})

export default router

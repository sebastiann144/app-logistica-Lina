// Datos de Firestore compartidos por todas las pantallas.
//
// Es la traduccion de las variables globales + cargarDatos() de index.html
// (lineas 1215-1255 y 1391-1454). El original cargaba las 14 colecciones de una
// sola vez al iniciar; aqui se conserva esa idea para que cualquier vista pueda
// leer datos.heroe sin volver a consultar Firestore.
//
// (El respaldo en localStorage del original se elimino a proposito: Firestore es
// la unica fuente de verdad.)
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { listar } from '@/services/firestore'
import { normalizarInventario } from '@/utils/inventario'

export const COLECCIONES = [
  'vehiculos',
  'mantenimientos',
  'gasolina',
  'liquidos',
  'permisos',
  'revisionGas',
  'soat',
  'kilometraje',
  'prestamos',
  'reservas',
  'equipos',
  'reservasEquipos',
  'inventario',
  'checklistDespacho',
]

export const useDatosStore = defineStore('datos', () => {
  const vehiculos = ref([])
  const mantenimientos = ref([])
  const gasolina = ref([])
  const liquidos = ref([])
  const permisos = ref([])
  const revisionGas = ref([])
  const soat = ref([])
  const kilometraje = ref([])
  const prestamos = ref([])
  const reservas = ref([])
  const equipos = ref([])
  const reservasEquipos = ref([])
  const inventario = ref([])
  const checklistDespacho = ref([])

  const cargando = ref(false)
  const error = ref('')

  // Permite leer/escribir una coleccion por su nombre (como ESTADOS[nombre] del original).
  const refs = {
    vehiculos,
    mantenimientos,
    gasolina,
    liquidos,
    permisos,
    revisionGas,
    soat,
    kilometraje,
    prestamos,
    reservas,
    equipos,
    reservasEquipos,
    inventario,
    checklistDespacho,
  }

  function toma(nombre) {
    return refs[nombre] || null
  }

  function aplicar(nombre, arr) {
    const r = toma(nombre)
    if (!r) return
    r.value = nombre === 'inventario' ? arr.map(normalizarInventario) : arr
  }

  // Recarga una sola coleccion (se usa despues de crear/editar/eliminar).
  async function recargar(nombre) {
    try {
      aplicar(nombre, await listar(nombre))
    } catch (e) {
      console.warn(`No se pudo recargar ${nombre}`, e)
    }
  }

  async function recargarVarias(nombres) {
    await Promise.all(nombres.map((n) => recargar(n)))
  }

  async function cargarTodo() {
    cargando.value = true
    error.value = ''
    const resultados = await Promise.allSettled(COLECCIONES.map((n) => listar(n)))
    resultados.forEach((res, i) => {
      const nombre = COLECCIONES[i]
      if (res.status === 'fulfilled') {
        aplicar(nombre, res.value)
      } else {
        console.warn(`No se pudo cargar la coleccion "${nombre}"`, res.reason)
        error.value = 'Algunos datos no se pudieron cargar. Revisa la conexion.'
      }
    })
    cargando.value = false
  }

  return {
    vehiculos,
    mantenimientos,
    gasolina,
    liquidos,
    permisos,
    revisionGas,
    soat,
    kilometraje,
    prestamos,
    reservas,
    equipos,
    reservasEquipos,
    inventario,
    checklistDespacho,
    cargando,
    error,
    toma,
    aplicar,
    recargar,
    recargarVarias,
    cargarTodo,
  }
})

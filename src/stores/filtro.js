// Filtro global por vehiculo.
//
// En index.html el filtro vivia en el tab Vehiculos (filterBar, 566-572) pero
// cambiarFiltroVehiculo() llamaba a renderTodo(), asi que tambien afectaba las
// tablas de Prestamo Carros y las alertas/stats de Vehiculos. Al migrar quedo
// aislado en VehiculosView y Lina lo perdio en las demas pestanas.
//
// Ahora es un estado compartido (Pinia) que usan Home, Vehiculos y Prestamo
// Carros. La barra visible vive en App.vue, solo para admin y solo en las
// rutas con meta.filtroVehiculo.
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useDatosStore } from '@/stores/datos'

export const useFiltroStore = defineStore('filtro', () => {
  const datos = useDatosStore()

  // Placa seleccionada. Cadena vacia = "todos los vehiculos".
  const vehiculo = ref('')

  const activo = computed(() => vehiculo.value !== '')

  const opciones = computed(() =>
    datos.vehiculos.map((v) => ({
      placa: v.placa,
      texto: `${v.placa} - ${v.marca || ''} ${v.modelo || ''}`.trim(),
    })),
  )

  const etiqueta = computed(() => {
    if (!vehiculo.value) return ''
    const v = datos.vehiculos.find((x) => x.placa === vehiculo.value)
    return v ? `${v.placa} - ${v.marca || ''} ${v.modelo || ''}`.trim() : vehiculo.value
  })

  // Filtra una lista por placa. `campo` permite usar el filtro en colecciones
  // que guardan la placa con otro nombre.
  function filtrar(lista, campo = 'vehiculo') {
    if (!vehiculo.value) return lista
    return lista.filter((item) => item && item[campo] === vehiculo.value)
  }

  function coincide(item, campo = 'vehiculo') {
    if (!vehiculo.value) return true
    return item?.[campo] === vehiculo.value
  }

  function seleccionar(valor) {
    vehiculo.value = valor || ''
  }

  function limpiar() {
    vehiculo.value = ''
  }

  return { vehiculo, activo, opciones, etiqueta, filtrar, coincide, seleccionar, limpiar }
})

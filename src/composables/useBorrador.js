// Borrador automatico de formularios en localStorage.
//
// Firestore sigue siendo la unica fuente de verdad: esto solo guarda lo que el
// usuario esta escribiendo (sin enviar) para que una recarga accidental no
// borre el formulario. Los borradores caducan a los 7 dias y se eliminan al
// guardar el registro.
//
// Uso tipico en un modal:
//
//   const borrador = useBorrador({
//     clave: 'prestamo-carro',
//     fuente: formPrestamo,
//     activo: () => modalPrestamo.value && !formPrestamo.value.id,
//     alRestaurar: () => { modalPrestamo.value = true },
//   })
//
//   abrirModal() { formPrestamo.value = { ... }; modalPrestamo.value = true; borrador.reiniciar() }
//   guardar()    { ...; await crear(...); borrador.limpiar() }
import { isRef, onBeforeUnmount, onMounted, ref, toValue, watch } from 'vue'

const PREFIJO = 'lina:borrador:'
const VIGENCIA_MS = 7 * 24 * 60 * 60 * 1000
const RETARDO_MS = 400

function copia(valor) {
  return JSON.parse(JSON.stringify(valor))
}

export function useBorrador({
  clave,
  fuente,
  obtener,
  aplicar,
  activo = () => true,
  alRestaurar,
}) {
  const llave = PREFIJO + clave
  const restaurado = ref(false)
  let base = null
  let temporizador = null

  function instantanea() {
    return obtener ? obtener() : copia(toValue(fuente))
  }

  function quitar() {
    try {
      localStorage.removeItem(llave)
    } catch {
      // localStorage no disponible (modo privado): se ignora.
    }
  }

  // Marca el estado actual como "formulario nuevo" y borra cualquier borrador
  // anterior. Se llama al abrir un modal para que el formulario vacio no se
  // guarde como borrador.
  function reiniciar() {
    quitar()
    restaurado.value = false
    base = JSON.stringify(instantanea())
  }

  // Se llama despues de guardar en Firestore: el formulario deja de ser un
  // borrador y no se vuelve a escribir al desmontar la vista.
  function limpiar() {
    reiniciar()
  }

  function guardar() {
    if (!activo()) return
    let datos
    try {
      datos = instantanea()
    } catch {
      return
    }
    const texto = JSON.stringify(datos)
    if (base !== null && texto === base) {
      quitar()
      return
    }
    try {
      localStorage.setItem(llave, JSON.stringify({ v: 1, guardadoEn: Date.now(), datos }))
    } catch {
      // Cuota llena o modo privado: no se interrumpe al usuario.
    }
  }

  function programar() {
    if (!activo()) return
    clearTimeout(temporizador)
    temporizador = setTimeout(guardar, RETARDO_MS)
  }

  function restaurar() {
    let crudo
    try {
      crudo = localStorage.getItem(llave)
    } catch {
      return
    }
    if (!crudo) return
    try {
      const sobre = JSON.parse(crudo)
      if (!sobre || sobre.v !== 1 || !sobre.datos) {
        quitar()
        return
      }
      if (Date.now() - (sobre.guardadoEn || 0) > VIGENCIA_MS) {
        quitar()
        return
      }
      if (aplicar) {
        aplicar(sobre.datos)
      } else if (isRef(fuente)) {
        fuente.value = { ...fuente.value, ...sobre.datos }
      } else {
        Object.assign(fuente, sobre.datos)
      }
      restaurado.value = true
      alRestaurar?.()
    } catch {
      quitar()
    }
  }

  onMounted(() => {
    // La base es el formulario inicial, ANTES de aplicar el borrador. Así el
    // cambio que produce la restauración sí se vuelve a guardar y el borrador
    // no se borra solo a los 400 ms (seguiría disponible si se recarga otra vez).
    base = JSON.stringify(instantanea())
    restaurar()
  })

  watch(fuente, programar, { deep: true })

  onBeforeUnmount(() => {
    clearTimeout(temporizador)
    guardar()
  })

  return { restaurado, reiniciar, limpiar, restaurar, guardar }
}

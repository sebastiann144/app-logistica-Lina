<script setup>
// Checklist de Despacho - hoja fisica que acompaña la canasta.
//
// Cada operario maneja un servicio diferente y es responsable de todo lo que
// recibe, entrega y devuelve. La hoja sirve de guia entre operarios y
// deja trazabilidad por referencia del elemento (sin codigos de equipos).
//
// La ruta Empresa -> conjunto -> conjunto -> Empresa se vence 4 dias despues de
// su fecha: se asume que el carro ya regreso y la siguiente hoja sale en blanco.
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import FirmaCanvas from '@/components/ui/FirmaCanvas.vue'
import ItemsChecklist from '@/components/checklist/ItemsChecklist.vue'
import { useAuthStore } from '@/stores/auth'
import { useBorrador } from '@/composables/useBorrador'
import {
  catalogoBase,
  estaVencida,
  fechaVencimiento,
  filaDesdeCatalogo,
  itemsDePlantilla,
  nombreTipo,
  PLANTILLAS,
  TIPOS_SERVICIO,
  totalFila,
} from '@/utils/checklistPlantillas'
import {
  fechaHoraLocal,
  guardarRuta,
  listarMovimientos,
  listarRutas,
  registrarMovimientos,
} from '@/services/checklistFirestore'

const auth = useAuthStore()
const catalogo = catalogoBase()

const CONTENIDO_RETANQUEO = {
  1: 'Paquete 1: 50 hojas de asistencia, 10 actas de entrega, 10 hojas de vida / Fichos: 10, bandas/ganchos/lapiceros',
  2: 'Paquete 2: 50 hojas de asistencia, 10 actas de entrega, 10 hojas de vida / Fichos: 10, bandas/ganchos/lapiceros',
  3: 'Paquete 3: 50 hojas de asistencia, 10 actas de entrega, 10 hojas de vida / Fichos: 10, bandas/ganchos/lapiceros',
  4: 'Paquete 4: 50 hojas de asistencia, 10 actas de entrega, 10 hojas de vida / Fichos: 10, bandas/ganchos/lapiceros',
}

const vista = ref('ruta')
const cargandoDatos = ref(true)
const guardando = ref(false)
const mensaje = ref('')
const error = ref('')
const sinInternet = ref(typeof navigator === 'undefined' ? false : !navigator.onLine)
const rutaId = ref('')
const paradaActual = ref(0)
const historial = ref([])
const movimientos = ref([])
const filtros = reactive({ texto: '', fecha: '', conjunto: '', equipo: '' })
const urlDescarga = ref('')
const nombreDescarga = ref('')
const enlaceDescarga = ref(null)

const ruta = reactive(crearRutaVacia('sonido'))

// ---------------------------------------------------------------
// Derivados
// ---------------------------------------------------------------

const plantilla = computed(() => PLANTILLAS[ruta.tipoServicio] || PLANTILLAS.sonido)
const especiales = computed(() => plantilla.value.especiales || [])
const itemsPlantilla = computed(() => itemsDePlantilla(ruta.tipoServicio, catalogo))

const grupos = computed(() =>
  plantilla.value.grupos.map((g) => ({
    key: g.key,
    nombre: g.nombre,
    icono: g.icono,
    items: itemsPlantilla.value.filter((i) => i.grupo === g.nombre),
  })),
)

const numerosEquipo = [1, 2, 3, 4, 5, 6, 7, 8]
const parada = computed(() => ruta.paradas[paradaActual.value] || null)
const rutaVencida = computed(() => estaVencida(ruta.fecha))
const paradasAtendidas = computed(
  () => ruta.paradas.filter((p) => p.estado === 'Confirmada' || p.estado === 'En traslado').length,
)
const rutaCerrada = computed(() => ruta.estado === 'Cerrada')

const rutasFiltradas = computed(() => {
  const texto = filtros.texto.trim().toLowerCase()
  const conjunto = filtros.conjunto.trim().toLowerCase()
  return historial.value.filter((r) => {
    if (filtros.fecha && r.fecha !== filtros.fecha) return false
    if (
      texto &&
      !`${nombreTipo(r.tipoServicio)} ${r.estado || ''} ${(r.paradas || [])
        .map((p) => p.conjunto || '')
        .join(' ')}`
        .toLowerCase()
        .includes(texto)
    )
      return false
    if (conjunto && !(r.paradas || []).some((p) => (p.conjunto || '').toLowerCase().includes(conjunto)))
      return false
    return true
  })
})

const movimientosFiltrados = computed(() => {
  const equipo = filtros.equipo.trim().toLowerCase()
  const conjunto = filtros.conjunto.trim().toLowerCase()
  return movimientos.value.filter((m) => {
    if (
      equipo &&
      !`${m.referencia || ''} ${m.itemId || ''}`.toLowerCase().includes(equipo)
    )
      return false
    if (conjunto && !(m.conjunto || '').toLowerCase().includes(conjunto)) return false
    if (filtros.fecha && !String(m.fechaHora || '').startsWith(filtros.fecha)) return false
    return true
  })
})

const totalAlertas = computed(() => {
  if (!parada.value) return 0
  return alertasParada(parada.value).filter((a) => a.bloquea).length
})

// ---------------------------------------------------------------
// Construccion de la hoja
// ---------------------------------------------------------------

function crearRutaVacia(tipo = 'sonido') {
  const fecha = new Date().toISOString().slice(0, 10)
  return {
    id: '',
    fecha,
    fechaVencimiento: fechaVencimiento(fecha),
    tipoServicio: tipo,
    colorEquipo: '',
    numeroEquipo: '',
    origen: 'Empresa',
    destinoFinal: 'Empresa',
    estado: 'Preparando',
    preparacion: {
      operario: '',
      items: itemsDePlantilla(tipo, catalogo).map((i) => filaDesdeCatalogo(i, 'empresa')),
    },
    paradas: [],
    traslados: [],
    creadoPor: '',
    cerradoPor: '',
    cerradoEn: '',
  }
}

function crearRetanqueos() {
  return [1, 2, 3, 4].map((numero) => ({
    bloque: numero <= 2 ? 1 : 2,
    paquete: numero,
    contenido: CONTENIDO_RETANQUEO[numero],
    fecha: '',
    nombreOperario: '',
    reportadoQR: false,
    observaciones: '',
  }))
}

function nuevaFirma() {
  return { nombre: '', hora: '', dibujo: '' }
}

function nuevoRespaldoAudio() {
  return {
    iniciadoConIdentificacion: false,
    guardadoConCOT: false,
    compartidoDriveMega: false,
    verificadoMontaje: false,
    celularApagado: false,
    numeroCOT: '',
    nombreUnidad: '',
    numeroCanasta: '',
    observaciones: '',
  }
}

function agregarParada() {
  const id = `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  ruta.paradas.push({
    id,
    orden: ruta.paradas.length + 1,
    conjunto: '',
    operario: '',
    tipoServicio: ruta.tipoServicio,
    horaLlegada: '',
    horaSalida: '',
    horaInicioAsamblea: '',
    horaFinAsamblea: '',
    firma: nuevaFirma(),
    novedad: '',
    destino: 'otro_conjunto',
    estado: 'Pendiente',
    items: itemsPlantilla.value.map((i) => filaDesdeCatalogo(i, 'parada')),
    retanqueos: crearRetanqueos(),
    respaldoPlataforma: { subido: false, detalles: '', observaciones: '' },
    respaldoAudio: nuevoRespaldoAudio(),
    confirmadaEn: '',
    confirmadaPor: '',
  })
  const pendiente = [...ruta.traslados].reverse().find((t) => !t.hacia || t.hacia === '(pendiente)')
  if (pendiente) pendiente.hacia = ''
  sincronizarEnviados()
  paradaActual.value = ruta.paradas.length - 1
  mensaje.value = `Parada ${ruta.paradas.length} agregada.`
}

function eliminarParada(id) {
  ruta.paradas = ruta.paradas.filter((p) => p.id !== id)
  ruta.paradas.forEach((p, i) => {
    p.orden = i + 1
  })
  ruta.traslados = ruta.traslados.filter((t) => t.paradaId !== id)
  paradaActual.value = Math.min(paradaActual.value, Math.max(ruta.paradas.length - 1, 0))
  sincronizarEnviados()
}

function cambiarTipo() {
  ruta.colorEquipo = ''
  ruta.numeroEquipo = ''
  ruta.preparacion.items = itemsDePlantilla(ruta.tipoServicio, catalogo).map((i) =>
    filaDesdeCatalogo(i, 'empresa'),
  )
  ruta.paradas.forEach((p) => {
    p.tipoServicio = ruta.tipoServicio
    p.items = itemsDePlantilla(ruta.tipoServicio, catalogo).map((i) =>
      filaDesdeCatalogo(i, 'parada'),
    )
    p.respaldoAudio = nuevoRespaldoAudio()
    p.respaldoPlataforma = { subido: false, detalles: '', observaciones: '' }
    p.retanqueos = crearRetanqueos()
  })
  sincronizarEnviados()
  mensaje.value = `Hoja cambiada a ${nombreTipo(ruta.tipoServicio)}.`
}

function sincronizarEnviados() {
  const base = ruta.preparacion.items
  ruta.paradas.forEach((p, i) => {
    const origen = i === 0 ? base : ruta.paradas[i - 1].items
    const mapa = Object.fromEntries(origen.map((f) => [f.itemId, f]))
    p.items.forEach((f) => {
      const previo = mapa[f.itemId]
      if (!previo) return
      if (f.enviado === '' || f.enviado === null || f.enviado === undefined) {
        f.enviado = totalFila(previo, 'devuelto') ?? totalFila(previo, 'enviado') ?? ''
      }
      if (f.dosCantidades) {
        if (f.enviadoNuevas === '') f.enviadoNuevas = previo.devueltoNuevas ?? previo.enviadoNuevas ?? ''
        if (f.enviadoUsadas === '') f.enviadoUsadas = previo.devueltoUsadas ?? previo.enviadoUsadas ?? ''
      }
    })
  })
}

function reiniciarRuta() {
  const tipo = ruta.tipoServicio || 'sonido'
  Object.keys(ruta).forEach((k) => delete ruta[k])
  Object.assign(ruta, crearRutaVacia(tipo))
  rutaId.value = ''
  paradaActual.value = 0
  vista.value = 'ruta'
  mensaje.value = 'Hoja limpia. Lista para empezar.'
  error.value = ''
  borrador.reiniciar()
}

watch(
  () => ruta.fecha,
  (fecha) => {
    ruta.fechaVencimiento = fechaVencimiento(fecha)
  },
)

// ---------------------------------------------------------------
// Reglas de control
// ---------------------------------------------------------------

function alertasDeFila(fila) {
  const lista = []
  const enviado = totalFila(fila, 'enviado')
  const recibido = totalFila(fila, 'recibido')
  const devuelto = totalFila(fila, 'devuelto')

  if (recibido !== null && enviado !== null && recibido !== enviado) {
    lista.push({
      bloquea: false,
      tipo: 'info',
      texto: `${fila.referencia}: recibido (${recibido}) vs enviado (${enviado})`,
    })
  }
  if (devuelto !== null && enviado !== null && devuelto !== enviado) {
    const delta = devuelto - enviado
    lista.push({
      bloquea: false,
      tipo: fila.esConsumible ? 'consumible' : delta < 0 ? 'faltante' : 'sobrante',
      texto: fila.esConsumible
        ? `${fila.referencia}: consumible (${delta > 0 ? '+' : ''}${delta})`
        : delta < 0
          ? `${fila.referencia}: Faltante (${delta})`
          : `${fila.referencia}: Sobrante (+${delta})`,
    })
  }
  if (lista.length && !String(fila.observacion || '').trim()) {
    lista.push({
      bloquea: true,
      tipo: 'observacion',
      texto: `${fila.referencia}: escribe una observación para justificar la diferencia`,
    })
  }
  return lista
}

function alertasParada(p) {
  if (!p) return []
  const lista = p.items.flatMap(alertasDeFila)

  if (!String(p.conjunto || '').trim())
    lista.push({ bloquea: true, tipo: 'firma', texto: 'Escribe el nombre del conjunto.' })
  if (!String(p.operario || '').trim())
    lista.push({ bloquea: true, tipo: 'firma', texto: 'Escribe el nombre del operario responsable.' })
  if (!p.firma.nombre || !p.firma.hora || !p.firma.dibujo)
    lista.push({
      bloquea: true,
      tipo: 'firma',
      texto: 'Falta nombre, hora o firma del operario responsable.',
    })

  if (especiales.value.includes('respaldoPlataforma') && !p.respaldoPlataforma.subido) {
    lista.push({
      bloquea: true,
      tipo: 'respaldo',
      texto: 'Confirma que el respaldo (quorum / resultados) fue subido a la plataforma.',
    })
  }

  if (especiales.value.includes('respaldoAudio')) {
    const r = p.respaldoAudio
    const pasos = [
      ['iniciadoConIdentificacion', 'Audio iniciado con unidad, fecha y hora'],
      ['guardadoConCOT', 'Archivo guardado con # COT y nombre de la unidad'],
      ['compartidoDriveMega', 'Archivo compartido en DRIVE / MEGA'],
      ['verificadoMontaje', 'Audio verificado una vez montado'],
      ['celularApagado', 'Celular apagado antes de guardarlo'],
    ]
    pasos.forEach(([clave, etiqueta]) => {
      if (!r[clave]) lista.push({ bloquea: true, tipo: 'respaldo', texto: `Falta: ${etiqueta}.` })
    })
  }

  if (lista.some((a) => a.bloquea) && !String(p.novedad || '').trim()) {
    lista.push({ bloquea: true, tipo: 'observacion', texto: 'Escribe la novedad de la parada.' })
  }
  return lista
}

function alertasCierre() {
  const lista = []
  if (!ruta.paradas.length) {
    lista.push('La hoja no tiene paradas.')
    return lista
  }
  const pendientes = ruta.paradas.filter((p) => p.estado === 'Pendiente')
  if (pendientes.length) lista.push(`Hay ${pendientes.length} parada(s) sin confirmar.`)

  const iniciales = Object.fromEntries(
    ruta.preparacion.items.map((f) => [f.itemId, totalFila(f, 'enviado') || 0]),
  )
  const ultima = ruta.paradas[ruta.paradas.length - 1]
  ultima.items.forEach((f) => {
    if (f.esConsumible) return
    const final = totalFila(f, 'devuelto')
    if (final !== null && final !== iniciales[f.itemId]) {
      lista.push(
        `${f.referencia}: salió ${iniciales[f.itemId]} y regresó ${final}. Explícalo en la novedad final.`,
      )
    }
  })
  if (lista.length && !String(ultima.novedad || '').trim()) {
    lista.push('Escribe la novedad final para explicar las diferencias.')
  }
  return lista
}

// ---------------------------------------------------------------
// Persistencia y movimientos
// ---------------------------------------------------------------

function movimiento(fila, tipoEvento, cantidad, p, s) {
  return {
    itemId: fila.itemId,
    referencia: fila.referencia,
    fijo: !!fila.fijo,
    tipoServicio: ruta.tipoServicio,
    tipoEvento,
    cantidad,
    nuevas: fila.dosCantidades ? fila[`${eventoColumna(tipoEvento)}Nuevas`] : '',
    usadas: fila.dosCantidades ? fila[`${eventoColumna(tipoEvento)}Usadas`] : '',
    rutaId: ruta.id,
    paradaId: p.id,
    conjunto: p.conjunto,
    fechaHora: `${s.fecha}T${s.hora}:00`,
    responsable: p.operario,
    observacion: fila.observacion || p.novedad || '',
    sincronizado: !sinInternet.value,
  }
}

function eventoColumna(tipoEvento) {
  return tipoEvento === 'recibido' ? 'recibido' : 'devuelto'
}

async function persistir(movs = []) {
  guardando.value = true
  error.value = ''
  try {
    if (!auth.usuario) throw new Error('No hay una sesión activa.')
    ruta.creadoPor = ruta.creadoPor || auth.usuario.uid
    const id = await guardarRuta(JSON.parse(JSON.stringify(ruta)))
    ruta.id = id
    if (movs.length) await registrarMovimientos(id, movs)
    borrador.limpiar()
    await Promise.all([cargarHistorial(), cargarMovimientos()])
    return true
  } catch (e) {
    console.error(e)
    error.value = 'No se pudo guardar. Si no hay internet, el cambio queda en el borrador local.'
    return false
  } finally {
    guardando.value = false
  }
}

async function guardarParcial() {
  borrador.guardar()
  const ok = await persistir([])
  if (ok)
    mensaje.value = sinInternet.value
      ? 'Guardado en el dispositivo. Se sincronizará al volver la red.'
      : 'Hoja guardada.'
}

async function confirmarParada(p) {
  const bloquea = alertasParada(p).filter((a) => a.bloquea)
  if (bloquea.length) {
    error.value = `No se puede confirmar: ${bloquea[0].texto}`
    return
  }
  const s = fechaHoraLocal()
  p.confirmadaEn = `${s.fecha}T${s.hora}:00`
  p.confirmadaPor = p.operario
  p.estado = p.destino === 'otro_conjunto' ? 'En traslado' : 'Confirmada'

  if (p.destino === 'otro_conjunto') {
    const siguiente = ruta.paradas[p.orden]
    ruta.traslados.push({
      paradaId: p.id,
      desde: p.conjunto,
      hacia: siguiente?.conjunto || '(pendiente)',
      confirmadoPor: p.operario,
      fechaHora: p.confirmadaEn,
    })
  }

  const movs = []
  p.items.forEach((f) => {
    const recibido = totalFila(f, 'recibido')
    const devuelto = totalFila(f, 'devuelto')
    if (recibido !== null) movs.push(movimiento(f, 'recibido', recibido, p, s))
    if (devuelto !== null) movs.push(movimiento(f, 'devuelto', devuelto, p, s))
    if (p.destino === 'otro_conjunto' && devuelto !== null)
      movs.push(movimiento(f, 'traslado', devuelto, p, s))
  })
  p.retanqueos.forEach((r) => {
    if (r.nombreOperario && r.fecha) {
      movs.push({
        itemId: 'retanqueo',
        referencia: `Retanqueo paquete ${r.paquete}`,
        tipoServicio: ruta.tipoServicio,
        tipoEvento: 'retanqueo',
        cantidad: 1,
        rutaId: ruta.id,
        paradaId: p.id,
        conjunto: p.conjunto,
        fechaHora: `${r.fecha}T12:00:00`,
        responsable: r.nombreOperario,
        observacion: r.observaciones || r.contenido,
        sincronizado: !sinInternet.value,
      })
    }
  })

  ruta.estado = p.destino === 'otro_conjunto' ? 'En traslado' : 'Regresando'
  sincronizarEnviados()
  const ok = await persistir(movs)
  if (!ok) return
  mensaje.value =
    p.destino === 'otro_conjunto'
      ? `Parada confirmada. Responsable: ${p.operario}. Equipo en traslado.`
      : `Parada confirmada. Responsable: ${p.operario}. Equipo regresa a la empresa.`
  const siguiente = ruta.paradas.findIndex((x) => x.estado === 'Pendiente')
  if (siguiente >= 0) paradaActual.value = siguiente
}

async function cerrarRuta() {
  if (!auth.esAdmin) {
    error.value = 'Solo el Admin puede cerrar la hoja.'
    return
  }
  const problemas = alertasCierre()
  if (problemas.length) {
    error.value = `No se puede cerrar: ${problemas[0]}`
    return
  }
  const s = fechaHoraLocal()
  const ultima = ruta.paradas[ruta.paradas.length - 1]
  const movs = []
  ultima.items.forEach((f) => {
    const devuelto = totalFila(f, 'devuelto')
    if (devuelto !== null) movs.push(movimiento(f, 'regreso_empresa', devuelto, ultima, s))
  })
  ruta.estado = 'Cerrada'
  ruta.destinoFinal = 'Empresa'
  ruta.cerradoPor = auth.usuario?.email || auth.usuario?.uid || ''
  ruta.cerradoEn = `${s.fecha}T${s.hora}:00`
  const ok = await persistir(movs)
  if (ok) mensaje.value = 'Hoja cerrada. El historial y la trazabilidad ya están actualizados.'
}

// ---------------------------------------------------------------
// Historial, trazabilidad y exportacion
// ---------------------------------------------------------------

async function cargarHistorial() {
  try {
    historial.value = await listarRutas()
  } catch (e) {
    console.warn('No se pudo cargar el historial', e)
  }
}
async function cargarMovimientos() {
  try {
    movimientos.value = await listarMovimientos()
  } catch (e) {
    console.warn('No se pudieron cargar los movimientos', e)
  }
}

function abrirRuta(registro) {
  if (estaVencida(registro.fecha) && registro.estado !== 'Cerrada') {
    reiniciarRuta()
    mensaje.value = `La hoja del ${registro.fecha} estaba vencida. Se limpió y salió una en blanco.`
    return
  }
  Object.keys(ruta).forEach((k) => delete ruta[k])
  Object.assign(ruta, JSON.parse(JSON.stringify(registro)))
  if (!ruta.fechaVencimiento) ruta.fechaVencimiento = fechaVencimiento(ruta.fecha)
  rutaId.value = registro.id
  paradaActual.value = 0
  vista.value = 'ruta'
  mensaje.value = estaVencida(ruta.fecha)
    ? 'Hoja vencida: se muestra solo para consulta.'
    : `Hoja ${registro.id} abierta.`
  error.value = ''
}

function descargar(nombre, contenido) {
  const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }))
  urlDescarga.value = url
  nombreDescarga.value = nombre
  setTimeout(() => {
    enlaceDescarga.value?.click()
    URL.revokeObjectURL(url)
  }, 30)
}

function csv(valor) {
  return `"${String(valor ?? '').replace(/"/g, '""')}"`
}

function filaCsv(valores) {
  return valores.map(csv).join(';')
}

function exportarRuta() {
  const filas = [
    ['Hoja', ruta.id, ruta.fecha, nombreTipo(ruta.tipoServicio)],
    ['Conjunto', 'Enviado', 'Recibido', 'Devuelto', 'Elemento', 'Observación'],
  ]
  ;(parada.value?.items || ruta.preparacion.items).forEach((f) => {
    filas.push([
      parada.value?.conjunto || 'Preparación empresa',
      totalFila(f, 'enviado') ?? '',
      totalFila(f, 'recibido') ?? '',
      totalFila(f, 'devuelto') ?? '',
      f.referencia,
      f.observacion,
    ])
  })
  descargar(`checklist-${ruta.tipoServicio}-${ruta.fecha}.csv`, '\ufeff' + filas.map(filaCsv).join('\n'))
}

function imprimir() {
  window.print()
}

function actualizarRed() {
  sinInternet.value = !navigator.onLine
}

// ---------------------------------------------------------------
// Borrador y ciclo de vida
// ---------------------------------------------------------------

const borrador = useBorrador({
  clave: 'checklist-ruta-activa',
  fuente: ruta,
  obtener: () => JSON.parse(JSON.stringify(ruta)),
  aplicar: (datos) => {
    Object.keys(ruta).forEach((k) => delete ruta[k])
    Object.assign(ruta, datos)
    if (!ruta.fechaVencimiento) ruta.fechaVencimiento = fechaVencimiento(ruta.fecha)
    rutaId.value = datos.id || ''
    paradaActual.value = 0
  },
  alRestaurar: () => {
    mensaje.value = 'Se recuperó la hoja que tenías sin guardar.'
  },
})

onMounted(async () => {
  window.addEventListener('online', actualizarRed)
  window.addEventListener('offline', actualizarRed)
  try {
    await Promise.all([cargarHistorial(), cargarMovimientos()])
  } finally {
    cargandoDatos.value = false
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('online', actualizarRed)
  window.removeEventListener('offline', actualizarRed)
})
</script>

<template>
  <div class="checklist-nuevo">
    <header class="top">
      <div class="top-inner">
        <div class="title-row">
          <img class="title-mark" src="/ICONO%20DE%20USUARIO.jpg" alt="Icono Clase Alpha" />
          <div>
            <div class="eyebrow">Operaciones · hoja física de la canasta</div>
            <h1>Checklists por servicio</h1>
            <p class="subtitle">
              Guía entre operarios: cada uno es responsable de lo que recibe, entrega y devuelve.
              La hoja va en la canasta y se vence 4 días después de su fecha.
            </p>
          </div>
        </div>
        <div class="top-badges">
          <span class="badge">Admin</span>
          <span class="badge">{{ nombreTipo(ruta.tipoServicio) }}</span>
          <span class="badge" :class="sinInternet ? 'badge-off' : 'badge-on'">
            {{ sinInternet ? 'Sin internet · guardando local' : 'En línea' }}
          </span>
          <span v-if="rutaVencida" class="badge badge-off">Vencida · se asume regreso</span>
          <span class="badge" :class="rutaCerrada ? 'badge-on' : 'badge-warn'">{{ ruta.estado }}</span>
        </div>
      </div>
    </header>

    <div class="contenedor">
      <nav class="tabs" aria-label="Secciones del checklist">
        <button type="button" :class="{ active: vista === 'ruta' }" @click="vista = 'ruta'">Hoja</button>
        <button type="button" :class="{ active: vista === 'historial' }" @click="vista = 'historial'">
          Historial
        </button>
        <button type="button" :class="{ active: vista === 'trazabilidad' }" @click="vista = 'trazabilidad'">
          Trazabilidad
        </button>
      </nav>

      <div v-if="mensaje" class="mensaje ok">{{ mensaje }}</div>
      <div v-if="error" class="mensaje error">{{ error }}</div>

      <!-- ---------------- HOJA ---------------- -->
      <template v-if="vista === 'ruta'">
        <div class="toolbar">
          <button type="button" class="btn" @click="reiniciarRuta">＋ Hoja en blanco</button>
          <button type="button" class="btn" :disabled="guardando" @click="guardarParcial">
            {{ guardando ? 'Guardando…' : '💾 Guardar' }}
          </button>
          <button type="button" class="btn" @click="exportarRuta">▣ Exportar CSV</button>
          <button type="button" class="btn" @click="imprimir">🖨 Imprimir</button>
          <span class="toolbar-nota">Borrador automático: no se pierde al recargar.</span>
        </div>

        <section class="panel">
          <div class="panel-head">
            <span class="num">1</span>
            <div>
              <h2>Datos de la hoja</h2>
              <p>Elige el servicio. El operario es el responsable de todo lo que anota aquí.</p>
            </div>
          </div>
          <div class="grid">
            <label>Fecha<input v-model="ruta.fecha" type="date" /></label>
            <label>
              Tipo de checklist
              <select v-model="ruta.tipoServicio" @change="cambiarTipo">
                <option v-for="tipo in TIPOS_SERVICIO" :key="tipo" :value="tipo">
                  {{ nombreTipo(tipo) }}
                </option>
              </select>
            </label>
            <label v-if="especiales.includes('colorEquipo')">
              Color del equipo<input v-model="ruta.colorEquipo" placeholder="Ej. VERDE" />
            </label>
            <label v-if="especiales.includes('numeroEquipo')">
              Número del equipo
              <select v-model="ruta.numeroEquipo">
                <option value="">Selecciona 1-8</option>
                <option v-for="n in numerosEquipo" :key="n" :value="n">{{ n }}</option>
              </select>
            </label>
            <label>
              Operario que empaca
              <input v-model="ruta.preparacion.operario" placeholder="Nombre del operario" />
            </label>
          </div>
          <div class="origen-destino">
            <span class="punto">🏢 Empresa</span>
            <span class="linea"></span>
            <span class="punto">{{ ruta.paradas.length }} parada(s)</span>
            <span class="linea"></span>
            <span class="punto">🏢 Empresa</span>
          </div>
          <div class="vencimiento" :class="{ vencida: rutaVencida }">
            Vence: <strong>{{ ruta.fechaVencimiento }}</strong>
            <span v-if="rutaVencida">· Se da por hecho que el carro llegó a la empresa.</span>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <span class="num">2</span>
            <div>
              <h2>Preparación en empresa</h2>
              <p>El Enviado inicial de la primera parada sale de estos valores.</p>
            </div>
          </div>
          <div class="tabla-wrap">
            <ItemsChecklist
              v-model:items="ruta.preparacion.items"
              :grupos="grupos"
              modo="preparacion"
            />
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <span class="num">3</span>
            <div>
              <h2>Paradas del servicio</h2>
              <p>Máximo recomendado: 4. Se permite más solo como excepción.</p>
            </div>
            <button type="button" class="btn" @click="agregarParada">＋ Agregar parada</button>
          </div>

          <div v-if="ruta.paradas.length > 4" class="aviso-excepcion">
            ⚠ Esta hoja tiene {{ ruta.paradas.length }} paradas. Verifica que sea una excepción
            autorizada.
          </div>

          <div v-if="!ruta.paradas.length" class="vacio">
            Agrega la primera parada para empezar la hoja.
          </div>

          <template v-else>
            <div class="parada-tabs">
              <button
                v-for="(p, i) in ruta.paradas"
                :key="p.id"
                type="button"
                :class="{ active: i === paradaActual }"
                @click="paradaActual = i"
              >
                {{ i + 1 }}. {{ p.conjunto || 'Sin nombre' }}
                <small :class="`estado-${p.estado.toLowerCase().replace(' ', '-')}`">
                  {{ p.estado }}
                </small>
              </button>
            </div>

            <template v-if="parada">
              <div class="parada-header grid">
                <label>Conjunto residencial<input v-model="parada.conjunto" /></label>
                <label>Nombre del operario<input v-model="parada.operario" /></label>
                <label>Hora llegada<input v-model="parada.horaLlegada" type="time" /></label>
                <label>Hora salida<input v-model="parada.horaSalida" type="time" /></label>
                <template
                  v-if="especiales.includes('respaldoPlataforma') || especiales.includes('respaldoAudio')"
                >
                  <label>Hora inicio asamblea<input v-model="parada.horaInicioAsamblea" type="time" /></label>
                  <label>Hora fin asamblea<input v-model="parada.horaFinAsamblea" type="time" /></label>
                </template>
                <label>
                  Después de esta parada
                  <select v-model="parada.destino">
                    <option value="otro_conjunto">Sigue en ruta a otro conjunto</option>
                    <option value="empresa">Regresa a la empresa</option>
                    <option value="se_queda">Se queda en el conjunto (novedad)</option>
                  </select>
                </label>
              </div>

              <div class="firmas">
                <div class="firma-card">
                  <h3>Operario responsable</h3>
                  <div class="grid">
                    <label>Nombre<input v-model="parada.firma.nombre" /></label>
                    <label>Hora<input v-model="parada.firma.hora" type="time" /></label>
                  </div>
                  <FirmaCanvas v-model="parada.firma.dibujo" :alto="100" />
                </div>
              </div>

              <div class="tabla-wrap">
                <ItemsChecklist v-model:items="parada.items" :grupos="grupos" modo="parada" />
              </div>

              <div v-if="especiales.includes('retanqueo')" class="sub-panel">
                <h3>Elementos de retanqueo</h3>
                <div v-for="r in parada.retanqueos" :key="r.paquete" class="retanqueo">
                  <div>
                    <strong>Paquete {{ r.paquete }} · Bloque {{ r.bloque }}</strong>
                    <small>{{ r.contenido }}</small>
                  </div>
                  <label>Fecha<input v-model="r.fecha" type="date" /></label>
                  <label>Nombre operario<input v-model="r.nombreOperario" /></label>
                  <label class="check-label">
                    <input v-model="r.reportadoQR" type="checkbox" />
                    Reportado por QR
                  </label>
                </div>
              </div>

              <div v-if="especiales.includes('respaldoPlataforma')" class="sub-panel">
                <h3>Respaldo de votación</h3>
                <label class="check-label">
                  <input v-model="parada.respaldoPlataforma.subido" type="checkbox" />
                  Respaldo (quorum y resultados) subido a la plataforma
                </label>
                <label>Detalle<input v-model="parada.respaldoPlataforma.detalles" /></label>
                <label>Observaciones<textarea v-model="parada.respaldoPlataforma.observaciones" /></label>
              </div>

              <div v-if="especiales.includes('respaldoAudio')" class="sub-panel">
                <h3>Respaldo de audio</h3>
                <div class="grid">
                  <label class="check-label">
                    <input v-model="parada.respaldoAudio.iniciadoConIdentificacion" type="checkbox" />
                    Audio iniciado con unidad, fecha y hora
                  </label>
                  <label class="check-label">
                    <input v-model="parada.respaldoAudio.guardadoConCOT" type="checkbox" />
                    Guardado con # COT y nombre de la unidad
                  </label>
                  <label class="check-label">
                    <input v-model="parada.respaldoAudio.compartidoDriveMega" type="checkbox" />
                    Compartido en DRIVE / MEGA
                  </label>
                  <label class="check-label">
                    <input v-model="parada.respaldoAudio.verificadoMontaje" type="checkbox" />
                    Audio verificado una vez montado
                  </label>
                  <label class="check-label">
                    <input v-model="parada.respaldoAudio.celularApagado" type="checkbox" />
                    Celular apagado antes de guardarlo
                  </label>
                </div>
                <div class="grid">
                  <label># COT<input v-model="parada.respaldoAudio.numeroCOT" /></label>
                  <label>Nombre de la unidad<input v-model="parada.respaldoAudio.nombreUnidad" /></label>
                  <label># Canasta<input v-model="parada.respaldoAudio.numeroCanasta" /></label>
                </div>
                <p v-if="especiales.includes('referenciaVotacion')" class="nota">
                  Si también se hizo votación, regístrala en una hoja de Votación aparte. “Elementos
                  de Votación” de esta planilla es solo una referencia, no se cuenta aquí.
                </p>
              </div>

              <label class="novedad">
                Novedad de la parada
                <textarea
                  v-model="parada.novedad"
                  placeholder="Qué pasó con lo que no sigue, cambio de responsable, daños, etc."
                />
              </label>

              <div class="alertas">
                <div v-for="(a, i) in alertasParada(parada)" :key="i" class="alerta" :class="a.tipo">
                  <span>{{ a.bloquea ? '⛔' : 'ℹ️' }}</span>
                  {{ a.texto }}
                </div>
                <div v-if="!alertasParada(parada).length" class="alerta ok">
                  ✅ Sin novedades. Lista para confirmar.
                </div>
              </div>

              <div class="acciones-parada">
                <button
                  type="button"
                  class="btn primario"
                  :disabled="parada.estado !== 'Pendiente' || totalAlertas > 0 || guardando"
                  @click="confirmarParada(parada)"
                >
                  {{
                    parada.estado !== 'Pendiente'
                      ? 'Parada confirmada'
                      : parada.destino === 'otro_conjunto'
                        ? 'Confirmar y marcar traslado →'
                        : 'Confirmar y registrar regreso'
                  }}
                </button>
                <button type="button" class="btn" @click="eliminarParada(parada.id)">
                  Eliminar parada
                </button>
                <span v-if="parada.confirmadaPor" class="confirmado">
                  Confirmada por {{ parada.confirmadaPor }} el {{ parada.confirmadaEn }}
                </span>
              </div>
            </template>
          </template>
        </section>

        <section class="panel">
          <div class="panel-head">
            <span class="num">4</span>
            <div>
              <h2>Cierre de la hoja</h2>
              <p>El Admin revisa que no queden diferencias sin justificar y cierra.</p>
            </div>
          </div>
          <div class="resumen">
            <div><strong>{{ ruta.paradas.length }}</strong><span>paradas</span></div>
            <div><strong>{{ paradasAtendidas }}</strong><span>atendidas</span></div>
            <div><strong>{{ ruta.traslados.length }}</strong><span>traslados</span></div>
            <div><strong>{{ ruta.estado }}</strong><span>estado</span></div>
          </div>
          <div v-if="alertasCierre().length" class="alertas">
            <div v-for="(a, i) in alertasCierre()" :key="i" class="alerta faltante">⛔ {{ a }}</div>
          </div>
          <button
            type="button"
            class="btn primario"
            :disabled="!auth.esAdmin || rutaCerrada || alertasCierre().length > 0 || guardando"
            @click="cerrarRuta"
          >
            {{ rutaCerrada ? 'Hoja cerrada' : 'Cerrar hoja (Admin)' }}
          </button>
        </section>
      </template>

      <!-- ---------------- HISTORIAL ---------------- -->
      <template v-else-if="vista === 'historial'">
        <section class="panel">
          <div class="panel-head">
            <span class="num">H</span>
            <div>
              <h2>Historial de hojas</h2>
              <p>Las hojas vencidas se limpian y salen en blanco al abrirlas.</p>
            </div>
          </div>
          <div class="grid filtros">
            <label>Texto<input v-model="filtros.texto" placeholder="Tipo, estado, conjunto…" /></label>
            <label>Conjunto<input v-model="filtros.conjunto" placeholder="Nombre del conjunto" /></label>
            <label>Fecha<input v-model="filtros.fecha" type="date" /></label>
          </div>
          <div v-if="cargandoDatos" class="vacio">Cargando hojas…</div>
          <div v-else-if="!rutasFiltradas.length" class="vacio">No hay hojas con esos filtros.</div>
          <div v-else class="lista">
            <div v-for="r in rutasFiltradas" :key="r.id" class="item-lista">
              <div>
                <strong>
                  {{ r.fecha }} · {{ nombreTipo(r.tipoServicio) }}
                  <span v-if="estaVencida(r.fecha)" class="chip-vencida">vencida</span>
                </strong>
                <p>
                  {{ (r.paradas || []).length }} parada(s) ·
                  {{ (r.paradas || []).map((p) => p.conjunto).join(' → ') }}
                </p>
                <small>Vence {{ r.fechaVencimiento || fechaVencimiento(r.fecha) }}</small>
              </div>
              <span class="badge" :class="r.estado === 'Cerrada' ? 'badge-on' : 'badge-warn'">
                {{ r.estado }}
              </span>
              <button type="button" class="btn" @click="abrirRuta(r)">Abrir</button>
            </div>
          </div>
        </section>
      </template>

      <!-- ---------------- TRAZABILIDAD ---------------- -->
      <template v-else-if="vista === 'trazabilidad'">
        <section class="panel">
          <div class="panel-head">
            <span class="num">T</span>
            <div>
              <h2>Trazabilidad por referencia</h2>
              <p>Busca por elemento, conjunto o fecha para ver por dónde ha pasado.</p>
            </div>
          </div>
          <div class="grid filtros">
            <label>Elemento<input v-model="filtros.equipo" placeholder="Ej. Micrófono" /></label>
            <label>Conjunto<input v-model="filtros.conjunto" placeholder="Nombre del conjunto" /></label>
            <label>Fecha<input v-model="filtros.fecha" type="date" /></label>
          </div>
          <div v-if="!movimientosFiltrados.length" class="vacio">No hay movimientos con esos filtros.</div>
          <div v-else class="tabla-wrap">
            <table class="trazas">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Elemento</th>
                  <th>Fijo</th>
                  <th>Evento</th>
                  <th>Conjunto</th>
                  <th>Responsable</th>
                  <th>Cant.</th>
                  <th>Observación</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(m, i) in movimientosFiltrados" :key="`${m.rutaId}-${m.secuencia}-${i}`">
                  <td>{{ String(m.fechaHora || '').slice(0, 16).replace('T', ' ') }}</td>
                  <td>{{ m.referencia }}</td>
                  <td>{{ m.fijo ? '🔴 fijo' : '—' }}</td>
                  <td>{{ m.tipoEvento.replaceAll('_', ' ') }}</td>
                  <td>{{ m.conjunto || 'Empresa' }}</td>
                  <td>{{ m.responsable || '—' }}</td>
                  <td>{{ m.cantidad ?? '—' }}</td>
                  <td>{{ m.observacion || '' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </div>

    <a ref="enlaceDescarga" :href="urlDescarga" :download="nombreDescarga" hidden></a>
  </div>
</template>

<style scoped>
.checklist-nuevo {
  --navy: #102a43;
  --blue: #155b87;
  --line: #d5dee8;
  --muted: #667085;
  background: #eef2f6;
  color: #172b3a;
  min-height: 100vh;
}
.top {
  background: linear-gradient(120deg, #102a43, #155b87);
  color: #fff;
  padding: 1.3rem clamp(1rem, 4vw, 3rem);
}
.top-inner {
  margin: auto;
  max-width: 1400px;
}
.title-row {
  align-items: center;
  display: flex;
  gap: 1rem;
}
.title-mark {
  background: #fff;
  border-radius: 10px;
  flex: 0 0 58px;
  height: 58px;
  object-fit: contain;
  padding: 0.2rem;
  width: 58px;
}
.eyebrow {
  color: #9dd7ff;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
h1 {
  font-size: clamp(1.35rem, 2.4vw, 2rem);
  margin: 0.25rem 0 0;
}
.subtitle {
  color: #d5e9f7;
  font-size: 0.86rem;
  margin: 0.35rem 0 0;
}
.top-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.9rem;
}
.badge {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 99px;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.25rem 0.6rem;
}
.badge-on {
  background: #d8f5e4;
  color: #166a43;
}
.badge-off {
  background: #ffe0dc;
  color: #a42d22;
}
.badge-warn {
  background: #fff0cf;
  color: #8a5a00;
}
.contenedor {
  margin: 0 auto;
  max-width: 1400px;
  padding: 1rem;
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.9rem;
}
.tabs button {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 8px;
  cursor: pointer;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  padding: 0.55rem 0.9rem;
}
.tabs button.active {
  background: var(--navy);
  border-color: var(--navy);
  color: #fff;
}
.mensaje {
  border-radius: 8px;
  font-size: 0.82rem;
  margin-bottom: 0.75rem;
  padding: 0.7rem 0.9rem;
}
.mensaje.ok {
  background: #ecfdf3;
  border: 1px solid #86d5a8;
  color: #166a43;
}
.mensaje.error {
  background: #fff1f0;
  border: 1px solid #f0a8a0;
  color: #a42d22;
}
.toolbar {
  align-items: center;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.9rem;
  padding: 0.7rem;
}
.toolbar-nota {
  color: var(--muted);
  font-size: 0.75rem;
  margin-left: auto;
}
.btn {
  background: #fff;
  border: 1px solid #c9d5e2;
  border-radius: 8px;
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 0.5rem 0.8rem;
}
.btn:hover:not(:disabled) {
  border-color: var(--blue);
}
.btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.btn.primario {
  background: var(--blue);
  border-color: var(--blue);
  color: #fff;
}
.panel {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  box-shadow: 0 10px 26px rgba(16, 42, 67, 0.06);
  margin-bottom: 1rem;
  overflow: hidden;
}
.panel-head {
  align-items: center;
  background: #fbfdff;
  border-bottom: 1px solid var(--line);
  display: flex;
  gap: 0.7rem;
  padding: 0.9rem 1.1rem;
}
.panel-head > div {
  flex: 1;
}
.panel-head h2 {
  color: var(--navy);
  font-size: 0.98rem;
  margin: 0;
}
.panel-head p {
  color: var(--muted);
  font-size: 0.76rem;
  margin: 0.15rem 0 0;
}
.num {
  align-items: center;
  background: #eaf4fc;
  border-radius: 50%;
  color: var(--blue);
  display: flex;
  flex: 0 0 28px;
  font-size: 0.8rem;
  font-weight: 800;
  height: 28px;
  justify-content: center;
}
.grid {
  display: grid;
  gap: 0.8rem;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  padding: 1rem 1.1rem;
}
label {
  color: #344054;
  display: block;
  font-size: 0.74rem;
  font-weight: 700;
}
input,
select,
textarea {
  background: #fff;
  border: 1px solid #c9d5e2;
  border-radius: 7px;
  color: #172b3a;
  font: inherit;
  font-size: 0.83rem;
  margin-top: 0.3rem;
  min-height: 38px;
  outline: none;
  padding: 0.55rem 0.6rem;
  width: 100%;
}
textarea {
  min-height: 80px;
  resize: vertical;
}
input:focus,
select:focus,
textarea:focus {
  border-color: var(--blue);
  box-shadow: 0 0 0 3px rgba(22, 119, 200, 0.12);
}
.check-label {
  align-items: center;
  display: flex;
  gap: 0.45rem;
}
.check-label input {
  min-height: auto;
  width: auto;
}
.origen-destino {
  align-items: center;
  background: #f8fbfe;
  border-top: 1px solid var(--line);
  display: flex;
  gap: 0.6rem;
  padding: 0.7rem 1.1rem;
}
.linea {
  background: #b8c9d8;
  flex: 1;
  height: 2px;
}
.punto {
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
}
.vencimiento {
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 0.76rem;
  padding: 0.6rem 1.1rem;
}
.vencimiento.vencida {
  background: #fff1f0;
  color: #a42d22;
}
.tabla-wrap {
  padding: 0.9rem 1.1rem;
}
.aviso-excepcion {
  background: #fff7e6;
  color: #8a5a00;
  font-size: 0.8rem;
  margin: 0 1.1rem 0.8rem;
  padding: 0.6rem 0.8rem;
}
.vacio {
  color: var(--muted);
  font-size: 0.85rem;
  padding: 1.2rem;
}
.parada-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding: 0.8rem 1.1rem 0;
}
.parada-tabs button {
  align-items: center;
  background: #f8fbfe;
  border: 1px solid var(--line);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  gap: 0.4rem;
  padding: 0.45rem 0.6rem;
}
.parada-tabs button.active {
  background: #eaf4fc;
  border-color: var(--blue);
}
.parada-tabs small {
  border-radius: 99px;
  font-size: 0.62rem;
  padding: 0.05rem 0.35rem;
}
.estado-pendiente {
  background: #fff0cf;
  color: #8a5a00;
}
.estado-confirmada {
  background: #d8f5e4;
  color: #166a43;
}
.estado-en-traslado {
  background: #e6f4ff;
  color: #155b87;
}
.firmas {
  display: grid;
  gap: 0.9rem;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  padding: 1rem 1.1rem;
}
.firma-card {
  background: #fbfdff;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 0.8rem;
}
.firma-card h3,
.sub-panel h3 {
  color: var(--navy);
  font-size: 0.86rem;
  margin: 0 0 0.6rem;
}
.firma-card .grid {
  padding: 0;
}
.sub-panel {
  border-top: 1px solid var(--line);
  padding: 1rem 1.1rem;
}
.retanqueo {
  align-items: end;
  background: #f8fbfe;
  border: 1px solid var(--line);
  border-radius: 8px;
  display: grid;
  gap: 0.7rem;
  grid-template-columns: 2fr 1fr 1fr auto;
  margin-bottom: 0.6rem;
  padding: 0.7rem;
}
.retanqueo small {
  color: var(--muted);
  display: block;
  font-size: 0.7rem;
  margin-top: 0.2rem;
}
.nota {
  color: var(--muted);
  font-size: 0.75rem;
}
.novedad {
  display: block;
  padding: 0 1.1rem 1rem;
}
.alertas {
  display: grid;
  gap: 0.35rem;
  padding: 0 1.1rem 1rem;
}
.alerta {
  border-radius: 6px;
  font-size: 0.76rem;
  padding: 0.5rem 0.7rem;
}
.alerta.ok {
  background: #ecfdf3;
  color: #166a43;
}
.alerta.faltante,
.alerta.observacion,
.alerta.firma,
.alerta.respaldo {
  background: #fff1f0;
  color: #a42d22;
}
.alerta.sobrante {
  background: #fff7e6;
  color: #8a5a00;
}
.alerta.consumible,
.alerta.info {
  background: #e6f4ff;
  color: #155b87;
}
.acciones-parada {
  align-items: center;
  border-top: 1px solid var(--line);
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  padding: 0.9rem 1.1rem;
}
.confirmado {
  color: var(--muted);
  font-size: 0.74rem;
}
.resumen {
  display: grid;
  gap: 0.6rem;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  padding: 1rem 1.1rem;
}
.resumen div {
  background: #f8fbfe;
  border: 1px solid var(--line);
  border-radius: 9px;
  padding: 0.7rem;
}
.resumen strong,
.resumen span {
  display: block;
}
.resumen strong {
  color: var(--navy);
  font-size: 1.1rem;
}
.resumen span {
  color: var(--muted);
  font-size: 0.7rem;
  margin-top: 0.15rem;
}
.panel > .btn.primario {
  margin: 0 1.1rem 1.1rem;
}
.filtros {
  border-bottom: 1px solid var(--line);
}
.lista {
  padding: 0.5rem 1.1rem 1rem;
}
.item-lista {
  align-items: center;
  border-bottom: 1px solid var(--line);
  display: grid;
  gap: 0.8rem;
  grid-template-columns: 1fr auto auto;
  padding: 0.8rem 0;
}
.item-lista p,
.item-lista small {
  color: var(--muted);
  font-size: 0.74rem;
  margin: 0.2rem 0 0;
}
.chip-vencida {
  background: #ffe7e4;
  border-radius: 99px;
  color: #a42d22;
  font-size: 0.62rem;
  margin-left: 0.35rem;
  padding: 0.1rem 0.4rem;
  text-transform: uppercase;
}
.trazas {
  font-size: 0.78rem;
  min-width: 900px;
}
.trazas th {
  background: var(--navy);
  color: #fff;
  font-size: 0.68rem;
  padding: 0.55rem;
  text-align: left;
}
.trazas td {
  border-bottom: 1px solid #e7edf3;
  padding: 0.45rem 0.55rem;
}
@media (max-width: 720px) {
  .retanqueo {
    grid-template-columns: 1fr;
  }
  .item-lista {
    grid-template-columns: 1fr;
  }
}
@media print {
  .tabs,
  .toolbar,
  .parada-tabs,
  .acciones-parada,
  .top-badges {
    display: none !important;
  }
}
</style>

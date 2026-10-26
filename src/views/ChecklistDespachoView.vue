<script setup>
// Checklist de Despacho de Equipos.
//
// Migracion de la pagina suelta checklist-despacho.html (560 lineas). Se conservan
// los mismos textos, emojis, clases CSS y el orden de los campos. Los id del
// original que solo existian para el JS (count, message, alerts, groups,
// route-services-list, movement-rows, history-list, ...) desaparecen: su lugar lo
// ocupan v-model, v-for y computed.
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import FirmaCanvas from '@/components/ui/FirmaCanvas.vue'
import { collection, crear, db, doc, serverTimestamp, writeBatch } from '@/services/firestore'
import { useAuthStore } from '@/stores/auth'
import { useDatosStore } from '@/stores/datos'
import { useBorrador } from '@/composables/useBorrador'

const auth = useAuthStore()
const datos = useDatosStore()

// Coleccion real de esta pantalla (checklist-despacho.html: 376, 498 y 528).
// Ojo: el original guarda y consulta en `checklistDespachoRutas`, NO en
// `checklistDespacho` (esa era una lista simple de index.html que ningun elemento
// del DOM llegaba a mostrar).
//
// La coleccion vive en useDatosStore para que Home y el propio historial lean
// exactamente los mismos registros (y los contadores no salgan en cero).
const COLECCION_FICHAS = 'checklistDespachoRutas'
const fichas = computed(() => datos.checklistDespachoRutas)
async function cargarFichas() {
  await datos.recargar(COLECCION_FICHAS)
}

// El original llama a loadAutocompletionCatalog() al arrancar (linea 557).
onMounted(cargarFichas)

// ---------------------------------------------------------------
// Constantes del original
// ---------------------------------------------------------------

// Constante "groups" (lineas 264-273). Se vuelve un arreglo para respetar el orden
// en el v-for.
const GRUPOS = [
  {
    key: 'registro',
    name: 'REGISTRO',
    icon: '📋',
    items: ['Hoja de asistencia', 'Elementos de votación', 'Actas de Entrega', 'Ficho', 'Impresora', 'Lapiceros'],
  },
  {
    key: 'sonido',
    name: 'SONIDO',
    icon: '🔊',
    items: ['Pantalla con trípode + Pendón', 'Bafle con trípode'],
  },
  {
    key: 'tula',
    name: 'TULA CON',
    icon: '👜',
    items: ['Extensiones sonido', 'Cables Canon XLR', 'Regleta'],
  },
  {
    key: 'canasta',
    name: 'CANASTA',
    icon: '🧺',
    items: ['Jumbolon inferior y superior', 'Micrófono cableado', 'Micrófono inalámbrico', 'Interfaz micrófonos inalámbricos'],
  },
  {
    key: 'video',
    name: 'VIDEO',
    icon: '📺',
    items: ['Video Beam + cable poder + HDMI', 'Transmisores inalámbricos HDMI + cables USB', 'Mini HUB', 'Transformador', 'Paletas para dar la palabra', 'Trapos'],
  },
  {
    key: 'caja',
    name: 'CAJA',
    icon: '📦',
    items: ['Gancho seguridad celular', 'Celular + HUB', 'Cargador celular', 'Interfaz Behringer', 'Grabadora de periodista', 'Cable 2 x 1', 'Cable Plug a Plug', 'Cable USB puerto cuadrado', 'Cable Canon XLR a Plug', 'Cable de poder', 'Transformador micrófono inalámbrico', 'Memoria USB con música', 'Bolsa plástica'],
  },
  {
    key: 'accesorios',
    name: 'ACCESORIOS',
    icon: '🧰',
    items: ['Botón', 'Lapiceros', 'Fusibles de repuesto', 'Bandas elásticas', 'Rótulos redondos', 'Tarjetas de la empresa', 'Correas plásticas', 'Cinta de enmascarar', 'Tiras', 'Pilas AA nuevas', 'Pilas AAA usadas'],
  },
  {
    key: 'proyeccion',
    name: 'TULA: ELEMENTOS PROYECCIÓN DOBLE',
    icon: '📽️',
    items: ['Video Beam + cable poder + HDMI', 'Computador + cable poder', 'Cable RJ45 UTP', 'Splitter + cable poder', 'Extensor HD-RJ45 TX-RX', 'Cable HDMI de 1 metro', 'Extensión', 'Regleta'],
  },
]

// Constante "locations" (linea 279). El primer valor es el que queda seleccionado
// por defecto, igual que en el <select> del original.
const UBICACIONES = ['Empresa / Bodega', 'En tránsito', 'Servicio 1', 'Servicio 2', 'Servicio 3', 'Retorno final a empresa']

// "serviceOptions" de addMovement() (linea 389).
const OPCIONES_SERVICIO = ['Servicio 1', 'Servicio 2', 'Servicio 3', 'Empresa / Bodega']

// Verificaciones previas (seccion 4, lineas 208-215).
const PRECHECKS = [
  'Registro completo',
  'Sonido probado',
  'Tula completa',
  'Canasta revisada',
  'Video revisado',
  'Caja completa',
  'Accesorios completos',
  'Proyección doble incluida',
]

// La constante "states" del original (linea 277) no se usaba en ninguna parte
// (no hay columna de estado en la tabla); por eso no se porta.

// ---------------------------------------------------------------
// Helpers de filas
// ---------------------------------------------------------------

let contador = 0
function nuevoId() {
  return ++contador
}

// addEquipment() (linea 284): una fila de la tabla de equipos.
function nuevaFila(reference = '') {
  return {
    id: nuevoId(),
    reference,
    location: 'Empresa / Bodega',
    model: '',
    code: '',
    sent: 1,
    received: '',
    returned: '',
    observations: '',
  }
}

// Tarjeta de firma (seccion 6, lineas 231-233).
function nuevaFirma() {
  return { name: '', date: '', time: '', signature: '' }
}

// Ruta inicial del original: Servicio 1, 2 y 3 (linea 544).
function serviciosRutaIniciales() {
  return ['Servicio 1', 'Servicio 2', 'Servicio 3'].map((property) => ({
    id: nuevoId(),
    property,
    responsible: '',
    date: '',
  }))
}

// addMovement() (linea 387): una fila de transferencia. Los dos selects arrancan
// en "Servicio 1", que es la primera opcion.
function nuevoMovimiento() {
  return {
    id: nuevoId(),
    origin: 'Servicio 1',
    destination: 'Servicio 1',
    deliverer: '',
    receiver: '',
    date: '',
    time: '',
    notes: '',
  }
}

// El original distinguia "vacio" ('') de 0; se conserva ese matiz.
function vacio(valor) {
  return valor === '' || valor === null || valor === undefined
}
function numeroODefecto(valor, porDefecto) {
  return vacio(valor) ? porDefecto : Number(valor)
}
function unicos(valores) {
  return [...new Set(valores.filter(Boolean))].sort()
}

// ---------------------------------------------------------------
// Estado
// ---------------------------------------------------------------

// Render de los grupos (lineas 539-543): cada grupo arranca con sus items.
const grupos = ref(
  GRUPOS.map((g) => ({
    key: g.key,
    name: g.name,
    icon: g.icon,
    items: g.items,
    abierto: true,
    filas: g.items.map((item) => nuevaFila(item)),
  })),
)

// Formulario (secciones 1, 2, 4, 6 y 7).
const form = reactive({
  formatCode: 'FO-CHLS - V9',
  equipmentColor: '',
  property: '',
  serviceDate: '',
  packedBy: '',
  vehicle: '',
  serviceStatus: 'Preparando',
  novelties: '',
  precheck: PRECHECKS.map(() => false),
  serviciosRuta: serviciosRutaIniciales(),
  movimientos: [],
  revisedBy: nuevaFirma(),
  returnedBy: nuevaFirma(),
  receivedBy: nuevaFirma(),
})

// #message
const mensaje = ref('')

// ---------------------------------------------------------------
// Borrador automatico (formulario + filas) en localStorage
// ---------------------------------------------------------------
// El checklist es el formulario mas largo de la app: si se recarga la pagina a
// mitad de la ficha no se debe perder nada. El borrador se elimina al guardar
// o al limpiar el formulario, y caduca a los 7 dias (useBorrador).
function instantaneaBorrador() {
  return {
    form: JSON.parse(JSON.stringify(form)),
    grupos: grupos.value.map((g) => ({
      key: g.key,
      abierto: g.abierto,
      filas: g.filas.map((f) => ({ ...f })),
    })),
  }
}

function aplicarBorrador(datosGuardados) {
  if (datosGuardados.form) Object.assign(form, datosGuardados.form)
  if (Array.isArray(datosGuardados.grupos)) {
    grupos.value = datosGuardados.grupos.map((g) => {
      const def = GRUPOS.find((x) => x.key === g.key)
      return {
        key: g.key,
        name: def?.name || g.key,
        icon: def?.icon || '',
        items: def?.items || [],
        abierto: g.abierto !== false,
        // Se regeneran los id para que no choquen con los que cree contador.
        filas: (g.filas || []).map((f) => ({ ...f, id: nuevoId() })),
      }
    })
  }
  form.serviciosRuta = (form.serviciosRuta || []).map((s) => ({ ...s, id: nuevoId() }))
  form.movimientos = (form.movimientos || []).map((m) => ({ ...m, id: nuevoId() }))
  if (!Array.isArray(form.precheck) || form.precheck.length !== PRECHECKS.length) {
    form.precheck = PRECHECKS.map((_, i) => !!form.precheck?.[i])
  }
}

const borrador = useBorrador({
  clave: 'checklist-despacho',
  fuente: [form, grupos],
  obtener: instantaneaBorrador,
  aplicar: aplicarBorrador,
  alRestaurar: () => {
    mensaje.value = 'Se recuperó el borrador que tenías sin guardar.'
  },
})

// #search-property y #search-date
const busqueda = reactive({ property: '', date: '' })
// #history-list: null = aun sin consultar.
const historial = ref(null)
const historialCargando = ref(false)
const historialError = ref('')
// #template-type y las plantillas. El original las guardaba en localStorage con
// la clave `checklist-template-<tipo>`; se conserva esa misma clave para no
// perder las plantillas que Lina ya tenga guardadas.
const plantillaTipo = ref('50')
function llavePlantilla(tipo) {
  return `checklist-template-${tipo}`
}
// Descarga del CSV (reemplaza a downloadFile(), linea 447).
const urlDescarga = ref('')
const nombreDescarga = ref('')
const enlaceDescarga = ref(null)
// Referencias al DOM propio: el original hacia property.focus() / form.checkValidity().
const formulario = ref(null)
const campoProperty = ref(null)

// ---------------------------------------------------------------
// Derivados (reemplazan a validateEquipment / updateSummary / updateCount)
// ---------------------------------------------------------------

// Todas las filas con el nombre de su grupo.
const filasConGrupo = computed(() =>
  grupos.value.flatMap((g) => g.filas.map((f) => ({ ...f, groupName: g.name }))),
)

const totalEquipos = computed(() => filasConGrupo.value.length)

// Catalogo de equipos para el autocompletado (loadAutocompletionCatalog, linea 372).
const catalogoEquipos = computed(() =>
  fichas.value.flatMap((registro) =>
    (registro.equipment || []).map((item) => {
      const valores = item.values || []
      return { reference: valores[0], location: valores[1], model: valores[2], code: valores[3] }
    }),
  ),
)

// fillDatalist() (linea 342): unicos y ordenados alfabeticamente.
const sugerenciasCopropiedad = computed(() =>
  unicos(
    fichas.value
      .map((r) => r.property)
      .concat(fichas.value.flatMap((r) => (r.routeServices || []).map((s) => s.property))),
  ),
)
const sugerenciasResponsable = computed(() =>
  unicos(fichas.value.flatMap((r) => [r.packedBy, ...(r.routeServices || []).map((s) => s.responsible)])),
)
const sugerenciasReferencia = computed(() => unicos(catalogoEquipos.value.map((i) => i.reference)))

// validateEquipment() (linea 302): alertas de control.
const validacion = computed(() => {
  const issues = { missing: [], different: [], damaged: [], pending: [], observations: [] }
  const filas = filasConGrupo.value
  // finalReturn: alguna fila ya registra devolucion (linea 304).
  const hayDevolucionParcial = filas.some((f) => Number(f.returned || 0) > 0)

  filas.forEach((f) => {
    const etiqueta = `${f.groupName} · ${f.reference || 'Equipo sin referencia'}`
    const enviado = Number(f.sent || 0)
    const recibido = vacio(f.received) ? null : Number(f.received)
    const devuelto = vacio(f.returned) ? null : Number(f.returned)

    if (recibido !== null && recibido < enviado) issues.missing.push(`${etiqueta}: faltan ${enviado - recibido}`)
    if (recibido !== null && recibido > enviado)
      issues.different.push(`${etiqueta}: recibidos (${recibido}) vs enviados (${enviado})`)
    if (recibido !== null && devuelto !== null && devuelto > recibido)
      issues.different.push(`${etiqueta}: devueltos (${devuelto}) superan los recibidos (${recibido})`)
    if (hayDevolucionParcial && recibido !== null && devuelto !== null && devuelto < recibido)
      issues.pending.push(`${etiqueta}: pendientes ${recibido - devuelto} por devolver a la empresa`)

    const observacion = String(f.observations || '').trim()
    if (observacion) issues.observations.push(`${etiqueta}: ${observacion}`)
    if (/dañ|roto|aver[ií]a|mal estado/i.test(observacion)) issues.damaged.push(etiqueta)
  })

  const secciones = [
    ['Equipos faltantes', issues.missing],
    ['Cantidades diferentes', issues.different],
    ['Equipos dañados', issues.damaged],
    ['Equipos pendientes por devolver', issues.pending],
    ['Observaciones registradas', issues.observations],
  ].filter(([, items]) => items.length)

  return { issues, secciones }
})

// updateSummary() (linea 394).
const resumen = computed(() => {
  let enviados = 0
  let devueltos = 0
  filasConGrupo.value.forEach((f) => {
    enviados += Number(f.sent || 0)
    devueltos += Number(f.returned || 0)
  })
  const faltantes = Math.max(enviados - devueltos, 0)
  const porcentaje = enviados ? Math.round((devueltos / enviados) * 100) : 0
  const todosPrechecks = form.precheck.every(Boolean)
  const hayDevolucion = devueltos > 0
  const { issues } = validacion.value
  const conNovedades =
    form.novelties.trim() || issues.observations.length || issues.damaged.length || issues.different.length
  const estado = conNovedades
    ? 'Con novedades'
    : todosPrechecks && enviados > 0 && hayDevolucion && devueltos >= enviados
      ? 'Completo'
      : 'Pendiente'
  return { totalEnviados: enviados, totalDevueltos: devueltos, faltantes, porcentaje, estado }
})

// ---------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------

// addEquipment() (linea 284) via el boton "+ Agregar equipo" (linea 548).
function agregarEquipo(key) {
  const grupo = grupos.value.find((g) => g.key === key)
  if (grupo) grupo.filas.push(nuevaFila(''))
}

// Boton "×" de cada fila (linea 550).
function eliminarFila(grupo, indice) {
  grupo.filas.splice(indice, 1)
}

// toggleGroup() (linea 293) via el boton .group-toggle (linea 549).
function alternarGrupo(grupo) {
  grupo.abierto = !grupo.abierto
}

// addRouteService() (linea 334).
function agregarServicioRuta() {
  form.serviciosRuta.push({ id: nuevoId(), property: '', responsible: '', date: '' })
}
function eliminarServicioRuta(id) {
  form.serviciosRuta = form.serviciosRuta.filter((s) => s.id !== id)
}

// addMovement() (linea 387).
function agregarMovimiento() {
  form.movimientos.push(nuevoMovimiento())
}
function eliminarMovimiento(id) {
  form.movimientos = form.movimientos.filter((m) => m.id !== id)
}

// autofillEquipment() (linea 343).
function autocompletarEquipo(fila) {
  const referencia = String(fila.reference || '').trim().toLowerCase()
  const match = catalogoEquipos.value.find((item) => (item.reference || '').toLowerCase() === referencia)
  if (match) {
    if (!fila.model) fila.model = match.model || ''
    if (!fila.code) fila.code = match.code || ''
    if (fila.location === 'Empresa / Bodega' && match.location) fila.location = match.location
  }
  if (fila.location !== 'Empresa / Bodega' && vacio(fila.received)) fila.received = fila.sent
  if (fila.location === 'Retorno final a empresa' && vacio(fila.returned)) fila.returned = fila.received || fila.sent
}

// autofillRouteService() (linea 362).
function autocompletarServicioRuta(servicio) {
  const property = String(servicio.property || '').trim().toLowerCase()
  const match = fichas.value.find((r) => (r.property || '').toLowerCase() === property)
  const routeMatch = match && (match.routeServices || []).find((s) => (s.property || '').toLowerCase() === property)
  if (!match && !routeMatch) return
  if (!servicio.responsible) servicio.responsible = routeMatch?.responsible || match?.packedBy || ''
  if (!servicio.date) servicio.date = routeMatch?.date || match?.serviceDate || ''
}

// Listener "change" de #property (linea 547).
function alCambiarCopropiedad() {
  const match = fichas.value.find(
    (r) => (r.property || '').toLowerCase() === form.property.trim().toLowerCase(),
  )
  if (!match) return
  if (!form.packedBy) form.packedBy = match.packedBy || ''
  if (!form.equipmentColor) form.equipmentColor = match.equipmentColor || ''
}

// getRowsSnapshot() (linea 433): los valores se guardan como texto, igual que el
// original (leidos de los inputs).
function snapshotFilas() {
  return grupos.value.flatMap((g) =>
    g.filas.map((f) => ({
      group: g.key,
      values: [
        f.reference,
        f.location,
        f.model,
        f.code,
        String(f.sent ?? ''),
        String(f.received ?? ''),
        String(f.returned ?? ''),
        f.observations,
      ],
    })),
  )
}

// setRowsSnapshot() (linea 437), incluida la normalizacion de snapshots viejos de
// 9, 10 u 11 valores.
function normalizarValores(item) {
  const v = item.values || []
  if (v.length === 11) return [v[1], 'Empresa / Bodega', v[2], v[3], v[5], v[6], v[7], v[10]]
  if (v.length === 10) return [v[0], v[1], v[2], v[3], v[4], v[5], v[6], v[9]]
  if (v.length === 9) return [v[0], 'Empresa / Bodega', v[1], v[2], v[3], v[4], v[5], v[8]]
  return v
}
function aplicarSnapshot(snapshot) {
  const porGrupo = {}
  ;(snapshot || []).forEach((item) => {
    const valores = normalizarValores(item)
    if (!porGrupo[item.group]) porGrupo[item.group] = []
    porGrupo[item.group].push(valores)
  })
  grupos.value.forEach((g) => {
    g.filas = (porGrupo[g.key] || []).map((v) => ({
      id: nuevoId(),
      reference: v[0] || '',
      location: v[1] || 'Empresa / Bodega',
      model: v[2] || '',
      code: v[3] || '',
      sent: numeroODefecto(v[4], ''),
      received: numeroODefecto(v[5], ''),
      returned: numeroODefecto(v[6], ''),
      observations: v[7] || '',
    }))
  })
}

// ---------------------------------------------------------------
// Exportar / imprimir / duplicar / plantillas
// ---------------------------------------------------------------

// downloadFile() (linea 447). El original creaba un <a> con document.createElement;
// aqui se reutiliza un <a> oculto de la plantilla mediante una ref.
function descargarArchivo(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  urlDescarga.value = url
  nombreDescarga.value = nombre
  nextTick(() => {
    enlaceDescarga.value?.click()
    URL.revokeObjectURL(url)
  })
}

// csvValue() (linea 452).
function valorCsv(valor) {
  return `"${String(valor ?? '').replace(/"/g, '""')}"`
}

// exportExcel() (linea 453).
function exportarExcel() {
  const camposServicio = [
    ['Código de formato', form.formatCode],
    ['Color de equipo', form.equipmentColor],
    ['Copropiedad', form.property],
    ['Fecha', form.serviceDate],
    ['Empacado por', form.packedBy],
    ['Vehículo asignado', form.vehicle],
    ['Estado del servicio', form.serviceStatus],
  ]
  const filas = [
    ['Checklist de Despacho de Equipos'],
    ...camposServicio.map(([etiqueta, valor]) => [etiqueta, valor]),
    ['Novedades', form.novelties],
    [],
    ['Referencia', 'Ubicación actual', 'Modelo', 'Código interno', 'Enviado desde empresa', 'Recibido al desempacar', 'Devuelto al empacar', 'Observaciones'],
  ]
  snapshotFilas().forEach((item) => filas.push(item.values))
  descargarArchivo(
    'checklist-despacho.csv',
    '\ufeff' + filas.map((fila) => fila.map(valorCsv).join(';')).join('\n'),
    'text/csv;charset=utf-8',
  )
}

// Listener de #print-checklist (linea 533).
function imprimir() {
  window.print()
}

// duplicateChecklist() (linea 459). form.reset() deja cada campo en su valor
// inicial; luego el original vacia explicitamente la cabecera y las firmas.
function duplicarChecklist() {
  const snapshot = snapshotFilas()
  form.formatCode = ''
  form.equipmentColor = ''
  form.property = ''
  form.serviceDate = ''
  form.packedBy = ''
  form.vehicle = ''
  form.serviceStatus = 'Preparando'
  form.novelties = ''
  form.precheck = PRECHECKS.map(() => false)
  form.revisedBy = nuevaFirma()
  form.returnedBy = nuevaFirma()
  form.receivedBy = nuevaFirma()
  form.serviciosRuta = serviciosRutaIniciales()
  form.movimientos = []
  aplicarSnapshot(snapshot)
  mensaje.value = 'Checklist duplicado. Completa la información del nuevo servicio.'
}

// Listener de #save-template (linea 536). El original usaba localStorage.
function guardarPlantilla() {
  try {
    localStorage.setItem(llavePlantilla(plantillaTipo.value), JSON.stringify(snapshotFilas()))
    mensaje.value = 'Plantilla guardada correctamente.'
  } catch (e) {
    console.error('No se pudo guardar la plantilla', e)
    mensaje.value = 'No se pudo guardar la plantilla en este navegador.'
  }
}

// Listener de #load-template (linea 537).
function cargarPlantilla() {
  let crudo
  try {
    crudo = localStorage.getItem(llavePlantilla(plantillaTipo.value))
  } catch {
    crudo = null
  }
  if (!crudo) {
    mensaje.value = 'No existe una plantilla guardada para este tipo de servicio.'
    return
  }
  try {
    aplicarSnapshot(JSON.parse(crudo))
    mensaje.value = 'Plantilla cargada correctamente.'
  } catch (e) {
    console.error('No se pudo cargar la plantilla', e)
    mensaje.value = 'La plantilla guardada no se pudo leer.'
  }
}

// Listener de #clear (linea 555): form.reset() + volver a los items por defecto.
function limpiarFicha() {
  form.formatCode = 'FO-CHLS - V9'
  form.equipmentColor = ''
  form.property = ''
  form.serviceDate = ''
  form.packedBy = ''
  form.vehicle = ''
  form.serviceStatus = 'Preparando'
  form.novelties = ''
  form.precheck = PRECHECKS.map(() => false)
  form.revisedBy = nuevaFirma()
  form.returnedBy = nuevaFirma()
  form.receivedBy = nuevaFirma()
  form.serviciosRuta = serviciosRutaIniciales()
  form.movimientos = []
  grupos.value.forEach((g) => {
    g.filas = g.items.map((item) => nuevaFila(item))
  })
  mensaje.value = ''
  borrador.limpiar()
}

// ---------------------------------------------------------------
// Guardar e historial
// ---------------------------------------------------------------

// collectChecklist() (linea 472).
function recogerFicha() {
  return {
    formatCode: form.formatCode.trim(),
    equipmentColor: form.equipmentColor.trim(),
    property: form.property.trim(),
    serviceDate: form.serviceDate,
    packedBy: form.packedBy.trim(),
    vehicle: form.vehicle.trim(),
    serviceStatus: form.serviceStatus,
    routeServices: form.serviciosRuta.map((s) => ({
      property: s.property,
      responsible: s.responsible,
      date: s.date,
    })),
    movements: form.movimientos.map((m) => [m.origin, m.destination, m.deliverer, m.receiver, m.date, m.time, m.notes]),
    equipment: snapshotFilas(),
    precheck: [...form.precheck],
    novelties: form.novelties,
    revisedBy: { ...form.revisedBy },
    returnedBy: { ...form.returnedBy },
    receivedBy: { ...form.receivedBy },
    savedAt: serverTimestamp(),
  }
}

// saveChecklist() (linea 492). El original creaba la referencia, le ponia
// checklistId y escribia el documento principal junto con las subcolecciones
// equipment / movements / audit en un writeBatch. Aqui el documento principal va
// con crear(COLECCION_FICHAS, ...) y las subcolecciones con writeBatch, para
// conservar el mismo modelo de datos.
async function guardarFicha() {
  const record = recogerFicha()
  if (!record.property || !record.serviceDate) {
    mensaje.value = 'Completa la copropiedad y la fecha para guardar.'
    return
  }
  try {
    if (!auth.usuario) throw new Error('No hay un usuario autenticado.')
    record.createdBy = auth.usuario.uid
    const id = await crear(COLECCION_FICHAS, record)

    const batch = writeBatch(db)
    const padre = doc(db, COLECCION_FICHAS, id)
    record.equipment.forEach((equipo, index) => {
      batch.set(doc(padre, 'equipment', `equipment_${index + 1}`), {
        checklistId: id,
        equipmentIndex: index + 1,
        ...equipo,
        createdAt: serverTimestamp(),
      })
    })
    record.movements.forEach((movement, index) => {
      batch.set(doc(padre, 'movements', `movement_${index + 1}`), {
        checklistId: id,
        sequence: index + 1,
        origin: movement[0],
        destination: movement[1],
        deliverer: movement[2],
        receiver: movement[3],
        date: movement[4],
        time: movement[5],
        notes: movement[6],
        createdBy: auth.usuario.uid,
        createdAt: serverTimestamp(),
      })
    })
    batch.set(doc(collection(padre, 'audit')), {
      checklistId: id,
      action: 'created',
      userId: auth.usuario.uid,
      occurredAt: serverTimestamp(),
    })
    await batch.commit()

    mensaje.value = `Checklist guardado correctamente. ID: ${id}`
    borrador.limpiar()
    await buscarHistorial()
  } catch (error) {
    console.error(error)
    mensaje.value = 'No fue posible guardar el checklist.'
  }
}

// searchHistory() (linea 521). El original consultaba checklistDespachoRutas con
// orderBy('serviceDate','desc').limit(100); aqui se recarga la coleccion y se
// filtra/ordena igual en memoria.
async function buscarHistorial() {
  historialCargando.value = true
  historialError.value = ''
  try {
    await cargarFichas()
    const propiedad = busqueda.property.trim().toLowerCase()
    const fecha = busqueda.date
    historial.value = fichas.value
      .filter(
        (r) =>
          (!propiedad || (r.property || '').toLowerCase().includes(propiedad)) &&
          (!fecha || r.serviceDate === fecha),
      )
      .slice()
      .sort((a, b) => String(b.serviceDate || '').localeCompare(String(a.serviceDate || '')))
      .slice(0, 100)
  } catch (error) {
    console.error(error)
    historialError.value = 'No fue posible consultar el historial.'
  } finally {
    historialCargando.value = false
  }
}

// Listener "submit" de #checklist-form (linea 556).
async function enviarFicha() {
  if (!form.property.trim() || !form.serviceDate) {
    mensaje.value = 'Completa Nombre de la copropiedad y Fecha antes de guardar.'
    campoProperty.value?.focus()
    return
  }
  if (formulario.value && !formulario.value.checkValidity()) {
    formulario.value.reportValidity()
    return
  }
  if (!form.precheck.some(Boolean)) {
    mensaje.value = 'Marca al menos una verificación antes de guardar.'
    return
  }
  await guardarFicha()
}

// renderHistory() (linea 512): texto de la ruta y de las transferencias de un
// registro del historial.
function rutaTexto(record) {
  return (record.routeServices || []).map((s) => s.property).join(' → ')
}
function movimientosTexto(record) {
  return (record.movements || [])
    .map(
      (m) =>
        `${m[0]} → ${m[1]} (${m[4] || 'Sin fecha'} ${m[5] || ''}; entrega: ${m[2] || '—'}; recibe: ${m[3] || '—'})`,
    )
    .join(' · ')
}
</script>
<template>
  <div class="checklist">
    <!-- Encabezado .top del original (linea 160). -->
    <header class="top">
      <div class="top-inner">
        <div class="title-row">
          <img class="title-mark" src="/ICONO%20DE%20USUARIO.jpg" alt="Icono Clase Alpha" />
          <div>
            <div class="eyebrow">Operaciones · Logística audiovisual</div>
            <h1>Checklist de Despacho de Equipos</h1>
            <p class="subtitle">Ficha digital de control para despacho, servicio y devolución.</p>
          </div>
        </div>
      </div>
    </header>

    <!-- Enlace .back (linea 162). -->
    <RouterLink class="back" to="/">← Volver a la página principal</RouterLink>

    <!-- Toolbar (lineas 163-175). -->
    <div class="toolbar" aria-label="Acciones del checklist">
      <div class="toolbar-actions">
        <button class="button primary" type="button" @click="imprimir">🖨 Imprimir / PDF</button>
        <button class="button secondary" type="button" @click="exportarExcel">▣ Exportar Excel</button>
        <button class="button secondary" type="button" @click="duplicarChecklist">⧉ Duplicar checklist</button>
      </div>
      <div class="template-actions">
        <span class="template-label">Plantilla</span>
        <select v-model="plantillaTipo" aria-label="Tipo de plantilla">
          <option value="50">Servicio 50 personas</option>
          <option value="100">Servicio 100 personas</option>
          <option value="300">Servicio 300 personas</option>
          <option value="custom">Personalizada</option>
        </select>
        <button class="button secondary" type="button" @click="guardarPlantilla">Guardar plantilla</button>
        <button class="button secondary" type="button" @click="cargarPlantilla">Cargar plantilla</button>
      </div>
    </div>

    <!-- Historial de rutas guardadas (lineas 176-180). -->
    <section class="history">
      <strong>Historial de rutas guardadas</strong>
      <div class="history-tools">
        <div>
          <label>Copropiedad</label>
          <input v-model="busqueda.property" placeholder="Buscar por copropiedad" />
        </div>
        <div>
          <label>Fecha del servicio</label>
          <input v-model="busqueda.date" type="date" />
        </div>
        <button class="button secondary" type="button" @click="buscarHistorial">🔎 Buscar registros</button>
      </div>
      <div class="history-list">
        <div v-if="historialCargando" class="history-empty">Consultando registros...</div>
        <div v-else-if="historialError" class="history-empty">{{ historialError }}</div>
        <div v-else-if="historial === null" class="history-empty">Usa los filtros para consultar registros guardados.</div>
        <div v-else-if="!historial.length" class="history-empty">No se encontraron registros con esos criterios.</div>
        <template v-else>
          <!-- renderHistory() (linea 512). -->
          <div v-for="r in historial" :key="r.id || r.checklistId" class="history-item">
            <div>
              <strong>{{ r.property }} · ID: {{ r.checklistId || r.id || 'Sin ID' }}</strong>
              <small>
                {{ r.serviceDate }} · Ruta: {{ rutaTexto(r) || 'Sin servicios definidos' }}
              </small>
              <br />
              <small>Ruta cronológica: {{ movimientosTexto(r) || 'Sin transferencias registradas' }}</small>
            </div>
            <span class="button secondary">{{ r.serviceStatus || 'Pendiente' }}</span>
          </div>
        </template>
      </div>
    </section>

    <!-- Formulario #checklist-form (linea 181). -->
    <form ref="formulario" @submit.prevent="enviarFicha">
      <!-- Seccion 1: Informacion del servicio inicial (lineas 182-193). -->
      <section class="section">
        <div class="section-title">
          <span class="number">1</span>
          <div>
            <h2>Información del servicio inicial</h2>
            <p>Identifica la operación y sus responsables.</p>
          </div>
        </div>
        <div class="fields">
          <div class="field"><label>Código de formato</label><input v-model="form.formatCode" /></div>
          <div class="field"><label>Color de equipo</label><input v-model="form.equipmentColor" placeholder="Ej. Azul / Rojo" /></div>
          <div class="field">
            <label>Nombre de la copropiedad <span class="required">*</span></label>
            <input
              ref="campoProperty"
              v-model="form.property"
              list="property-suggestions"
              required
              placeholder="Nombre de la copropiedad"
              @change="alCambiarCopropiedad"
            />
          </div>
          <div class="field"><label>Fecha <span class="required">*</span></label><input v-model="form.serviceDate" type="date" required /></div>
          <div class="field"><label>Empacado por</label><input v-model="form.packedBy" list="responsible-suggestions" placeholder="Nombre completo" /></div>
          <div class="field"><label>Vehículo asignado</label><input v-model="form.vehicle" placeholder="Placa o identificación" /></div>
          <div class="field">
            <label>Estado del servicio</label>
            <select v-model="form.serviceStatus">
              <option>Preparando</option>
              <option>Despachado</option>
              <option>En ejecución</option>
              <option>Finalizado</option>
            </select>
          </div>
        </div>
      </section>

      <!-- Seccion 2: Ruta continua de servicios (lineas 194-198). -->
      <section class="section">
        <div class="section-title">
          <span class="number">2</span>
          <div>
            <h2>Ruta continua de servicios</h2>
            <p>Registra la secuencia de servicios sin devolver los equipos a bodega entre etapas.</p>
          </div>
        </div>
        <div class="route-services">
          <label>Servicios incluidos en la ruta</label>
          <div>
            <!-- addRouteService() (linea 334). -->
            <div v-for="s in form.serviciosRuta" :key="s.id" class="route-service">
              <div>
                <label>Nombre Copropiedad</label>
                <input v-model="s.property" list="property-suggestions" placeholder="Ej. Asamblea Edificio A" @change="autocompletarServicioRuta(s)" />
              </div>
              <div>
                <label>Responsable del servicio</label>
                <input v-model="s.responsible" list="responsible-suggestions" placeholder="Nombre completo" />
              </div>
              <div><label>Fecha</label><input v-model="s.date" type="date" /></div>
              <button class="button secondary" type="button" @click="eliminarServicioRuta(s.id)">Eliminar</button>
            </div>
          </div>
          <button class="button secondary" type="button" @click="agregarServicioRuta">+ Agregar servicio</button>
        </div>
        <div class="movement-wrap">
          <label>Historial de transferencias</label>
          <table class="movement-table">
            <thead>
              <tr>
                <th>Servicio origen</th>
                <th>Servicio destino</th>
                <th>Quién entrega</th>
                <th>Quién recibe</th>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Novedades</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <!-- addMovement() (linea 387). -->
              <tr v-for="m in form.movimientos" :key="m.id">
                <td>
                  <select v-model="m.origin">
                    <option v-for="o in OPCIONES_SERVICIO" :key="o">{{ o }}</option>
                  </select>
                </td>
                <td>
                  <select v-model="m.destination">
                    <option v-for="o in OPCIONES_SERVICIO" :key="o">{{ o }}</option>
                  </select>
                </td>
                <td><input v-model="m.deliverer" placeholder="Nombre" /></td>
                <td><input v-model="m.receiver" placeholder="Nombre" /></td>
                <td><input v-model="m.date" type="date" /></td>
                <td><input v-model="m.time" type="time" /></td>
                <td><input v-model="m.notes" placeholder="Novedades" /></td>
                <td><button class="button secondary" type="button" @click="eliminarMovimiento(m.id)">×</button></td>
              </tr>
            </tbody>
          </table>
          <button class="button secondary" type="button" style="margin-top: 0.75rem" @click="agregarMovimiento">
            + Registrar transferencia
          </button>
        </div>
      </section>
      <!-- Seccion 3: Equipos del despacho (lineas 199-204). -->
      <section class="section">
        <div class="section-title">
          <span class="number">3</span>
          <div>
            <h2>Equipos del despacho</h2>
            <p>Organiza los elementos por grupo y verifica su retorno.</p>
          </div>
        </div>
        <!-- #alerts (linea 201): validateEquipment() (linea 302). -->
        <div class="alert-box" :class="{ show: validacion.secciones.length }" role="alert" aria-live="polite">
          <template v-if="validacion.secciones.length">
            <strong>⚠ Alertas de control</strong>
            <ul>
              <li v-for="[titulo, items] in validacion.secciones" :key="titulo">
                <b>{{ titulo }}:</b> {{ items.join('; ') }}
              </li>
            </ul>
          </template>
        </div>
        <!-- #groups (linea 202): render de los grupos (lineas 539-543). -->
        <div class="groups">
          <div v-for="g in grupos" :key="g.key" class="equipment-group">
            <div class="group-header">
              <span class="group-name"><span class="group-icon">{{ g.icon }}</span>{{ g.name }}</span>
              <span class="group-tools">
                <button class="button secondary group-add" type="button" @click.stop="agregarEquipo(g.key)">
                  + Agregar equipo
                </button>
                <button
                  class="group-toggle"
                  type="button"
                  :aria-label="g.abierto ? 'Contraer grupo' : 'Expandir grupo'"
                  :aria-expanded="String(g.abierto)"
                  @click="alternarGrupo(g)"
                >
                  {{ g.abierto ? '⌃' : '⌄' }}
                </button>
              </span>
            </div>
            <div class="group-body" :class="{ collapsed: !g.abierto }">
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th class="reference">Referencia</th>
                      <th class="location">Ubicación actual</th>
                      <th class="model">Modelo</th>
                      <th class="code">Código interno</th>
                      <th class="quantity">Enviado desde empresa</th>
                      <th class="quantity">Recibido al desempacar</th>
                      <th class="quantity">Devuelto al empacar</th>
                      <th class="observation">Observaciones</th>
                      <th class="remove"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <!-- addEquipment() (linea 284). -->
                    <tr v-for="(fila, indice) in g.filas" :key="fila.id">
                      <td>
                        <input
                          v-model="fila.reference"
                          list="equipment-references"
                          aria-label="Referencia"
                          placeholder="Elemento"
                          @change="autocompletarEquipo(fila)"
                        />
                      </td>
                      <td>
                        <select v-model="fila.location" aria-label="Ubicación actual" @change="autocompletarEquipo(fila)">
                          <option v-for="u in UBICACIONES" :key="u">{{ u }}</option>
                        </select>
                      </td>
                      <td><input v-model="fila.model" aria-label="Modelo" placeholder="Modelo" /></td>
                      <td><input v-model="fila.code" aria-label="Código interno" placeholder="Código" /></td>
                      <td><input v-model="fila.sent" aria-label="Enviado desde empresa" type="number" min="0" /></td>
                      <td><input v-model="fila.received" aria-label="Recibido al desempacar" type="number" min="0" /></td>
                      <td><input v-model="fila.returned" aria-label="Devuelto al empacar" type="number" min="0" /></td>
                      <td><textarea v-model="fila.observations" aria-label="Observaciones" rows="1" placeholder="Notas del equipo"></textarea></td>
                      <td class="remove">
                        <button type="button" title="Eliminar equipo" aria-label="Eliminar equipo" @click="eliminarFila(g, indice)">
                          ×
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div class="actions">
          <!-- updateCount() (linea 292). -->
          <span class="count">{{ totalEquipos }} {{ totalEquipos === 1 ? 'equipo registrado' : 'equipos registrados' }}</span>
        </div>
      </section>

      <!-- Seccion 4: Verificacion antes del despacho (lineas 205-217). -->
      <section class="section">
        <div class="section-title">
          <span class="number">4</span>
          <div>
            <h2>Verificación antes del despacho</h2>
            <p>Confirma que cada grupo esté completo antes de salir de bodega.</p>
          </div>
        </div>
        <div class="precheck-grid">
          <label v-for="(etiqueta, i) in PRECHECKS" :key="etiqueta" class="precheck-item">
            <input v-model="form.precheck[i]" type="checkbox" /> {{ etiqueta }}
          </label>
        </div>
      </section>

      <!-- Seccion 5: Resumen de control (lineas 218-227). -->
      <section class="section">
        <div class="section-title">
          <span class="number">5</span>
          <div>
            <h2>Resumen de control</h2>
            <p>Indicadores calculados automáticamente.</p>
          </div>
        </div>
        <div class="summary-grid">
          <div class="summary-card"><div class="value">{{ resumen.totalEnviados }}</div><div class="label">Total enviados desde empresa</div></div>
          <div class="summary-card"><div class="value">{{ resumen.totalDevueltos }}</div><div class="label">Total devueltos al empacar</div></div>
          <div class="summary-card"><div class="value">{{ resumen.faltantes }}</div><div class="label">Equipos faltantes</div></div>
          <div class="summary-card"><div class="value">{{ resumen.porcentaje }}%</div><div class="label">Porcentaje de devolución</div></div>
          <div
            class="summary-card status-card"
            :class="{ complete: resumen.estado === 'Completo', novelty: resumen.estado === 'Con novedades' }"
          >
            <div class="value">{{ resumen.estado }}</div>
            <div class="label">Estado del checklist</div>
          </div>
        </div>
      </section>

      <!-- Seccion 6: Control de entrega y devolucion (lineas 228-235). -->
      <section class="section">
        <div class="section-title">
          <span class="number">6</span>
          <div>
            <h2>Control de entrega y devolución</h2>
            <p>Registra las personas responsables en cada momento.</p>
          </div>
        </div>
        <div class="signatures">
          <div class="signature-card">
            <h3>Revisó</h3>
            <div class="signature-fields">
              <div class="full"><label>Nombre</label><input v-model="form.revisedBy.name" /></div>
              <div><label>Fecha</label><input v-model="form.revisedBy.date" type="date" /></div>
              <div><label>Hora</label><input v-model="form.revisedBy.time" type="time" /></div>
              <div class="full">
                <label>Firma digital</label>
                <FirmaCanvas v-model="form.revisedBy.signature" :alto="120" />
              </div>
            </div>
          </div>
          <div class="signature-card">
            <h3>Devolvió</h3>
            <div class="signature-fields">
              <div class="full"><label>Nombre</label><input v-model="form.returnedBy.name" /></div>
              <div><label>Fecha</label><input v-model="form.returnedBy.date" type="date" /></div>
              <div><label>Hora</label><input v-model="form.returnedBy.time" type="time" /></div>
              <div class="full">
                <label>Firma digital</label>
                <FirmaCanvas v-model="form.returnedBy.signature" :alto="120" />
              </div>
            </div>
          </div>
          <div class="signature-card">
            <h3>Recibió</h3>
            <div class="signature-fields">
              <div class="full"><label>Nombre</label><input v-model="form.receivedBy.name" /></div>
              <div><label>Fecha</label><input v-model="form.receivedBy.date" type="date" /></div>
              <div><label>Hora</label><input v-model="form.receivedBy.time" type="time" /></div>
              <div class="full">
                <label>Firma digital</label>
                <FirmaCanvas v-model="form.receivedBy.signature" :alto="120" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Seccion 7: Novedades (lineas 236-239). -->
      <section class="section">
        <div class="section-title">
          <span class="number">7</span>
          <div>
            <h2>Novedades</h2>
            <p>Registra daños, faltantes, cambios o cualquier situación del servicio.</p>
          </div>
        </div>
        <div class="novelties">
          <label>Novedades del despacho, servicio y devolución</label>
          <textarea v-model="form.novelties" placeholder="Escribe aquí las novedades..."></textarea>
        </div>
      </section>

      <!-- Footer (linea 240). -->
      <div class="footer">
        <span class="message" role="status">{{ mensaje }}</span>
        <button class="button secondary" type="button" @click="limpiarFicha">Limpiar ficha</button>
        <button class="button primary" type="submit">Guardar ficha</button>
      </div>
    </form>

    <!-- datalists (lineas 242-244). -->
    <datalist id="property-suggestions">
      <option v-for="v in sugerenciasCopropiedad" :key="v" :value="v"></option>
    </datalist>
    <datalist id="responsible-suggestions">
      <option v-for="v in sugerenciasResponsable" :key="v" :value="v"></option>
    </datalist>
    <datalist id="equipment-references">
      <option v-for="v in sugerenciasReferencia" :key="v" :value="v"></option>
    </datalist>

    <!-- Enlace oculto que reemplaza el <a> que creaba downloadFile() (linea 447). -->
    <a ref="enlaceDescarga" :href="urlDescarga" :download="nombreDescarga" style="display: none"></a>
  </div>
</template>
<style scoped>
/* ============================================================
   CSS propio de la pagina checklist-despacho.html (lineas 7-157).
   Las variables del original se declaran en el contenedor porque
   :root no alcanza a los componentes con <style scoped>.
   ============================================================ */
.checklist {
  --navy: #102a43;
  --blue: #183b56;
  --blue-light: #e9f0f6;
  --orange: #e98225;
  --orange-dark: #c96816;
  --pale: #eaf4fc;
  --bg: #eef2f6;
  --line: #d5dee8;
  --text: #172b3a;
  --muted: #667085;
}

/* base.css define form como grid de 2 columnas; aqui el original no lo hace. */
form {
  display: block;
}

.top {
  background: linear-gradient(120deg, #102a43, #155b87);
  color: #fff;
  padding: 1.4rem clamp(1rem, 4vw, 3rem);
}
.top-inner {
  max-width: 1400px;
  margin: auto;
}
.title-row {
  align-items: center;
  display: flex;
  gap: 1rem;
}
.title-mark {
  background: #fff;
  border-radius: 10px;
  flex: 0 0 64px;
  height: 64px;
  object-fit: contain;
  padding: 0.2rem;
  width: 64px;
}
.eyebrow {
  color: #9dd7ff;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
h1 {
  font-size: clamp(1.35rem, 2.5vw, 2rem);
  margin: 0.35rem 0 0;
}
.subtitle {
  color: #d5e9f7;
  font-size: 0.92rem;
  margin: 0.45rem 0 0;
}
.back {
  color: #105c91;
  display: inline-block;
  font-size: 0.84rem;
  font-weight: 700;
  margin-bottom: 1rem;
  text-decoration: none;
}
.back:hover {
  text-decoration: underline;
}
.section {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: 0 12px 32px rgba(16, 42, 67, 0.08);
  margin-bottom: 1.25rem;
  overflow: hidden;
}
.section-title {
  align-items: center;
  background: #fbfdff;
  border-bottom: 1px solid var(--line);
  display: flex;
  gap: 0.7rem;
  padding: 1rem 1.25rem;
}
.section-title h2 {
  color: var(--navy);
  font-size: 1rem;
  margin: 0;
}
.section-title p {
  color: var(--muted);
  font-size: 0.78rem;
  margin: 0.2rem 0 0;
}
.number {
  align-items: center;
  background: var(--pale);
  border-radius: 50%;
  color: var(--blue);
  display: flex;
  flex: 0 0 28px;
  font-size: 0.82rem;
  font-weight: 800;
  height: 28px;
  justify-content: center;
}
.fields {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  padding: 1.25rem;
}
.field {
  min-width: 0;
}
.wide {
  grid-column: span 2;
}
label {
  color: #344054;
  display: block;
  font-size: 0.76rem;
  font-weight: 750;
  margin-bottom: 0.38rem;
}
.required {
  color: var(--blue);
}
input,
select,
textarea {
  background: #fff;
  border: 1px solid #c9d5e2;
  border-radius: 8px;
  color: var(--text);
  font: inherit;
  font-size: 0.86rem;
  min-height: 40px;
  outline: none;
  padding: 0.6rem 0.7rem;
  width: 100%;
}
textarea {
  min-height: 40px;
  resize: vertical;
}
input:focus,
select:focus,
textarea:focus {
  border-color: var(--blue);
  box-shadow: 0 0 0 3px rgba(22, 119, 200, 0.12);
}
.groups {
  padding: 0 1.25rem 1.25rem;
}
.equipment-group {
  border: 1px solid var(--line);
  border-radius: 10px;
  margin-top: 0.85rem;
  overflow: hidden;
}
.group-header {
  align-items: center;
  background: #f8fbfe;
  color: var(--navy);
  display: flex;
  justify-content: space-between;
  padding: 0.85rem 1rem;
  text-align: left;
  width: 100%;
}
.group-header:hover {
  background: var(--pale);
}
.group-name {
  align-items: center;
  display: flex;
  font-size: 0.9rem;
  font-weight: 800;
  gap: 0.55rem;
}
.group-icon {
  color: var(--blue);
  font-size: 1rem;
}
.group-tools {
  align-items: center;
  display: flex;
  gap: 0.75rem;
}
.group-toggle {
  background: transparent;
  border: 0;
  color: var(--blue);
  cursor: pointer;
  font-size: 1rem;
  font-weight: 800;
  padding: 0.25rem 0.5rem;
}
.group-body {
  border-top: 1px solid var(--line);
}
.group-body.collapsed {
  display: none;
}
.table-wrap {
  overflow-x: auto;
  padding: 0 0.75rem 0.75rem;
}
table {
  border-collapse: collapse;
  min-width: 1330px;
  width: 100%;
}
th {
  background: var(--navy);
  color: #fff;
  font-size: 0.7rem;
  padding: 0.75rem 0.55rem;
  text-align: left;
  white-space: nowrap;
}
td {
  border-bottom: 1px solid #e7edf3;
  padding: 0.5rem 0.35rem;
  vertical-align: top;
}
td input,
td select {
  font-size: 0.78rem;
  min-height: 36px;
  padding: 0.45rem 0.5rem;
}
.category { min-width: 140px; }
.reference { min-width: 135px; }
.location { min-width: 155px; }
.model { min-width: 135px; }
.code { min-width: 125px; }
.serial { min-width: 135px; }
.quantity { min-width: 92px; }
.state { min-width: 135px; }
.observation { min-width: 190px; }
.remove {
  text-align: center;
  width: 44px;
}
.remove button {
  background: transparent;
  border: 0;
  color: #c0392b;
  cursor: pointer;
  font-size: 1.1rem;
  padding: 0.4rem;
}
.group-add {
  font-size: 0.75rem;
  padding: 0.45rem 0.7rem;
}
.actions {
  align-items: center;
  display: flex;
  gap: 0.75rem;
  justify-content: space-between;
  padding: 0 1.25rem 1.25rem;
}
.precheck-grid {
  display: grid;
  gap: 0.65rem;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  padding: 1.25rem;
}
.precheck-item {
  align-items: center;
  background: #f8fbfe;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: #344054;
  display: flex;
  font-size: 0.82rem;
  gap: 0.5rem;
  padding: 0.75rem;
}
.precheck-item input {
  accent-color: var(--blue);
  min-height: auto;
  width: auto;
}
.alert-box {
  background: #fff1f0;
  border: 1px solid #f0a8a0;
  border-left: 4px solid #c0392b;
  border-radius: 8px;
  color: #8e2419;
  display: none;
  font-size: 0.82rem;
  margin: 0 1.25rem 1rem;
  padding: 0.85rem 1rem;
}
.alert-box.show {
  display: block;
}
.alert-box strong {
  display: block;
  margin-bottom: 0.35rem;
}
.alert-box ul {
  margin: 0.25rem 0 0 1.1rem;
  padding: 0;
}
.summary-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  padding: 1.25rem;
}
.summary-card {
  background: #f8fbfe;
  border: 1px solid var(--line);
  border-radius: 9px;
  padding: 0.8rem;
}
.summary-card .value {
  color: var(--navy);
  font-size: 1.35rem;
  font-weight: 800;
}
.summary-card .label {
  color: var(--muted);
  font-size: 0.72rem;
  margin-top: 0.15rem;
}
.status-card {
  background: #fff8e8;
  border-color: #f0c36d;
}
.status-card.complete {
  background: #ecfdf3;
  border-color: #86d5a8;
}
.status-card.novelty {
  background: #fff1f0;
  border-color: #f0a8a0;
}
.status-card .value {
  color: #a15c00;
  font-size: 1rem;
}
.status-card.complete .value {
  color: #237a52;
}
.status-card.novelty .value {
  color: #a42d22;
}
.signatures {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: 1.25rem;
}
.signature-card {
  background: #fbfdff;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 1rem;
}
.signature-card h3 {
  color: var(--navy);
  font-size: 0.9rem;
  margin: 0 0 0.85rem;
}
.signature-fields {
  display: grid;
  gap: 0.65rem;
  grid-template-columns: 1fr 1fr;
}
.signature-fields .full {
  grid-column: 1/-1;
}
.novelties {
  padding: 1.25rem;
}
.novelties textarea {
  min-height: 150px;
}
.toolbar {
  align-items: center;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 3px 10px rgba(16, 42, 67, 0.05);
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  justify-content: space-between;
  margin-bottom: 1rem;
  padding: 0.7rem;
}
.toolbar-actions,
.template-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}
.toolbar .button {
  padding: 0.55rem 0.7rem;
}
.toolbar select {
  min-height: 34px;
  padding: 0.4rem 0.55rem;
  width: auto;
}
.template-label {
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
}
@media print {
  .top { border: 0; }
  .back,
  .toolbar,
  .footer,
  .remove,
  .group-add,
  .group-toggle {
    display: none !important;
  }
  .section {
    box-shadow: none;
    break-inside: avoid;
  }
  .group-body {
    display: block !important;
  }
  input,
  select,
  textarea {
    border-color: #aaa;
  }
}
.button {
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 750;
  padding: 0.7rem 1rem;
}
.primary {
  background: var(--blue);
  color: #fff;
}
.secondary {
  background: var(--pale);
  color: #105c91;
}
.count,
.message {
  color: var(--muted);
  font-size: 0.78rem;
}
.message {
  color: #237a52;
  min-height: 1.2em;
}
.footer {
  align-items: center;
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}
@media (max-width: 900px) {
  .fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .wide { grid-column: span 1; }
  .precheck-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .signatures { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  .fields { grid-template-columns: 1fr; padding: 1rem; }
  .wide { grid-column: span 1; }
  .section-title { padding: 0.9rem 1rem; }
  .precheck-grid { grid-template-columns: 1fr; padding: 1rem; }
  .summary-grid,
  .signatures { grid-template-columns: 1fr; padding: 1rem; }
  .alert-box { margin: 0 1rem 1rem; }
  .groups { padding: 0 0.75rem 0.75rem; }
  .group-header { padding: 0.75rem; }
  .group-tools { gap: 0.4rem; }
  .group-add { font-size: 0.7rem; padding: 0.4rem 0.5rem; }
  .table-wrap { padding: 0 0.5rem 0.5rem; }
  .actions,
  .footer {
    align-items: stretch;
    flex-direction: column;
    padding: 0 0.75rem 0.75rem;
  }
  .actions .button,
  .footer .button { width: 100%; }
}
/* ERP visual language (lineas 92-156). El segundo bloque del original pisa al
   primero en el orden de la cascada. */
.top {
  background: var(--navy);
  border-bottom: 4px solid var(--orange);
  padding: 1.25rem clamp(1rem, 4vw, 3rem);
}
.eyebrow {
  color: #f6b36e;
  letter-spacing: 0.14em;
}
.subtitle {
  color: #c8d8e5;
}
.title-mark {
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.15);
}
.back {
  color: var(--orange-dark);
  font-size: 0.8rem;
}
.section {
  border-color: #ccd7e2;
  border-radius: 10px;
  box-shadow: 0 4px 14px rgba(16, 42, 67, 0.06);
}
.section-title {
  background: #fff;
  border-bottom: 1px solid var(--line);
  border-left: 4px solid var(--orange);
  padding: 1rem 1.1rem;
}
.section-title h2 {
  color: var(--navy);
  font-size: 0.95rem;
  letter-spacing: 0.01em;
  text-transform: uppercase;
}
.section-title p {
  color: #7a8b9b;
}
.number {
  background: var(--orange);
  color: #fff;
}
label {
  color: #435466;
  font-size: 0.72rem;
  letter-spacing: 0.01em;
  text-transform: uppercase;
}
input,
select,
textarea {
  border-color: #c4d0dc;
  border-radius: 5px;
  min-height: 38px;
}
input:focus,
select:focus,
textarea:focus {
  border-color: var(--orange);
  box-shadow: 0 0 0 3px rgba(233, 130, 37, 0.14);
}
.precheck-item {
  background: #f7f9fb;
  border-color: #d4dee8;
  border-radius: 5px;
}
.precheck-item input {
  accent-color: var(--orange);
}
.equipment-group {
  border-color: #cbd7e2;
  border-radius: 7px;
  box-shadow: 0 2px 7px rgba(16, 42, 67, 0.04);
}
.group-header {
  background: var(--navy);
  color: #fff;
  border-left: 4px solid var(--orange);
  padding: 0.7rem 0.9rem;
}
.group-header:hover {
  background: #183b56;
}
.group-name {
  font-size: 0.82rem;
  letter-spacing: 0.04em;
}
.group-icon {
  color: #f6b36e;
}
.group-toggle {
  color: #fff;
}
.group-body {
  background: #fff;
}
table {
  border: 1px solid #cbd7e2;
  border-collapse: separate;
  border-spacing: 0;
}
th {
  background: #e8eef4;
  border-bottom: 2px solid var(--orange);
  color: var(--navy);
  font-size: 0.68rem;
  text-transform: uppercase;
}
td {
  background: #fff;
  border-bottom: 1px solid #e3e9ef;
  border-right: 1px solid #edf1f5;
}
tbody tr:nth-child(even) td {
  background: #f8fafc;
}
tbody tr:hover td {
  background: #fff6ec;
}
td input,
td select,
td textarea {
  background: transparent;
  border-color: #d9e2ea;
  border-radius: 4px;
}
.button {
  border-radius: 5px;
  font-size: 0.76rem;
  letter-spacing: 0.01em;
}
.primary {
  background: var(--orange);
  color: #fff;
}
.primary:hover {
  background: var(--orange-dark);
}
.secondary {
  background: var(--blue-light);
  color: var(--navy);
}
.secondary:hover {
  background: #dbe6ef;
}
.group-add {
  background: var(--orange);
  color: #fff;
}
.group-add:hover {
  background: var(--orange-dark);
}
.summary-card {
  background: #f7f9fb;
  border-color: #d4dee8;
  border-radius: 6px;
}
.summary-card .value {
  color: var(--navy);
}
.status-card {
  background: #fff8e8;
  border-color: #efbf7b;
}
.signature-card {
  background: #f8fafc;
  border-color: #d4dee8;
  border-radius: 7px;
}
.signature-card h3 {
  border-bottom: 2px solid var(--orange);
  padding-bottom: 0.45rem;
}
.novelties textarea {
  background: #fffdfb;
  border-color: #e7c39f;
}
.route-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  padding: 1.25rem;
}
.route-wide {
  grid-column: span 2;
}
.route-services {
  border-top: 1px solid var(--line);
  padding: 1.25rem;
}
.route-service {
  align-items: end;
  background: #f8fafc;
  border: 1px solid var(--line);
  border-radius: 6px;
  display: grid;
  gap: 0.65rem;
  grid-template-columns: 1.35fr 1.2fr 1fr auto;
  margin-bottom: 0.6rem;
  padding: 0.7rem;
}
.route-service:last-child {
  margin-bottom: 0;
}
.movement-wrap {
  border-top: 1px solid var(--line);
  overflow-x: auto;
  padding: 1.25rem;
}
.movement-table {
  min-width: 980px;
}
.movement-table input {
  min-height: 35px;
}
.history {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 3px 10px rgba(16, 42, 67, 0.05);
  margin-bottom: 1rem;
  padding: 1rem;
}
.history-tools {
  align-items: end;
  display: grid;
  gap: 0.65rem;
  grid-template-columns: 1fr 1fr auto;
}
.history-list {
  margin-top: 0.8rem;
}
.history-item {
  align-items: center;
  border-top: 1px solid var(--line);
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  padding: 0.75rem 0;
}
.history-item strong {
  color: var(--navy);
  display: block;
}
.history-item small {
  color: var(--muted);
}
.history-empty {
  color: var(--muted);
  font-size: 0.82rem;
  padding: 0.5rem 0;
}
@media (max-width: 900px) {
  .history-tools { grid-template-columns: 1fr 1fr; }
  .history-tools .button { grid-column: 1/-1; }
}
@media (max-width: 560px) {
  .history-tools { grid-template-columns: 1fr; }
  .history-item { align-items: flex-start; flex-direction: column; gap: 0.45rem; }
}
.alert-box {
  border-left-color: var(--orange-dark);
}
@media (max-width: 900px) {
  .fields,
  .precheck-grid { gap: 0.75rem; }
  .route-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .route-wide { grid-column: span 1; }
  .route-service { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 560px) {
  .top { padding: 1rem; }
  .title-row { gap: 0.7rem; }
  .title-mark { flex-basis: 48px; height: 48px; width: 48px; }
  .section-title h2 { font-size: 0.85rem; }
  .group-header { padding: 0.65rem 0.7rem; }
  .route-grid,
  .route-services { padding: 1rem; }
  .route-grid { grid-template-columns: 1fr; }
  .route-wide { grid-column: span 1; }
  .route-service { grid-template-columns: 1fr; }
  .route-service .remove { width: auto; }
}
</style>

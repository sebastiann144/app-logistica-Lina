<script setup>
// Tab "Vehiculos" con sus 8 sub-pestanas.
//
// Origen: index.html
//  - HTML del tab y sub-paneles: lineas 553-668
//  - Modales: modalVehiculo 863-881, modalMantenimiento 881-912,
//    modalGasolina 912-930, modalLiquido 930-951, modalRevisionGas 1073-1096,
//    modalSoat 1096-1116, modalKm 1116-1134, modalPermiso 1134-1170
//  - JS: filtro 1270-1301; CRUD de cada sub-tab 1648-2350; kilometraje 3021-3137;
//    stats 3349-3365 y alertas 3370-3494 (sus elementos viven dentro de este tab)
import { computed, ref } from 'vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { actualizar, crear, eliminar } from '@/services/firestore'
import { useAuthStore } from '@/stores/auth'
import { useDatosStore } from '@/stores/datos'
import { diffDias, hoy } from '@/utils/fechas'

const auth = useAuthStore()
const datos = useDatosStore()

// ---------------------------------------------------------------
// Sub-pestanas (original: cambiarSubTab, lineas 1609-1614)
// ---------------------------------------------------------------
const SUB_TABS = [
  { id: 'subInfo', texto: 'Info' },
  { id: 'subMantenimiento', texto: 'Mantenimiento' },
  { id: 'subGasolina', texto: 'Gasolina' },
  { id: 'subLiquidos', texto: 'Aceite' },
  { id: 'subPicoPlaca', texto: 'Pico y Placa' },
  { id: 'subRevisionGas', texto: 'Gas' },
  { id: 'subSoat', texto: 'SOAT' },
  { id: 'subKilometraje', texto: 'Kilometraje' },
]
const subTab = ref('subInfo')

// ---------------------------------------------------------------
// Filtro por vehiculo
// (original: filtrarPorVehiculo/cambiarFiltroVehiculo/poblarFiltrosVehiculo,
//  lineas 1270-1301). En Vue el <select> usa v-model, sin tocar el DOM.
// VEHICULO_CAMPOS (1258-1268): en estas colecciones el campo siempre es "vehiculo".
// ---------------------------------------------------------------
const filtro = ref('')

function filtrar(arr) {
  if (!filtro.value) return arr
  return arr.filter((e) => e.vehiculo === filtro.value)
}

// Vehiculos que se usan en stats, fluidos, km y en las alertas por km (linea 2023).
const vehiculosFiltrados = computed(() =>
  filtro.value ? datos.vehiculos.filter((v) => v.placa === filtro.value) : datos.vehiculos,
)

// Listas "lo ultimo primero" (original: [...datos].reverse()).
const mantenimientosFiltrados = computed(() => [...filtrar(datos.mantenimientos)].reverse())
const gasolinaFiltrada = computed(() => [...filtrar(datos.gasolina)].reverse())
const liquidosFiltrados = computed(() => [...filtrar(datos.liquidos)].reverse())
const permisosFiltrados = computed(() => [...filtrar(datos.permisos)].reverse())
const revisionesGasFiltradas = computed(() => [...filtrar(datos.revisionGas)].reverse())
const soatFiltrado = computed(() => [...filtrar(datos.soat)].reverse())

// Opciones de los <select> de vehiculo (original: llenarSelectVehiculos, 4159-4172).
const opcionesVehiculos = computed(() =>
  datos.vehiculos.map((v) => ({ placa: v.placa, texto: `${v.placa} - ${v.marca} ${v.modelo}` })),
)

// Opciones de los demas <select> de los modales.
const TIPOS_MANTENIMIENTO = [
  'Cambio de Aceite',
  'Frenos',
  'Llantas',
  'Filtros',
  'Bateria',
  'Suspension',
  'Motor',
  'Transmision',
  'Revision General',
  'Otro',
]
const ESTADOS_FLUIDO = ['OK', 'Bajo', 'Cambiar']
const MUNICIPIOS = [
  'Medellin',
  'Envigado',
  'Itagui',
  'Bello',
  'Sabaneta',
  'La Estrella',
  'Caldas',
  'Copacabana',
  'Girardota',
  'Barbosa',
]
const TIPOS_PERMISO = [
  'Pico y Placa Solidario',
  'Pico y Placa Ambiental',
  'Exencion Temporal',
  'Permiso Especial',
]
const RESULTADOS_GAS = ['Aprobado', 'Reprobado', 'Pendiente']

// ---------------------------------------------------------------
// Stats (original: renderStats, lineas 3349-3365)
// ---------------------------------------------------------------
const statVehiculos = computed(() => (filtro.value ? 1 : datos.vehiculos.length))

const statPendientes = computed(() => {
  const limite = new Date(Date.now() + 30 * 86400000)
  return filtrar(datos.mantenimientos).filter(
    (m) => m.proxFecha && new Date(m.proxFecha) <= limite,
  ).length
})

const statKm = computed(() => {
  let total = 0
  vehiculosFiltrados.value.forEach((v) => {
    const ult = [...datos.kilometraje].reverse().find((k) => k.vehiculo === v.placa)
    if (ult) total += ult.km
  })
  return total
})

const statGas = computed(() => {
  let total = 0
  filtrar(datos.gasolina).forEach((g) => (total += g.litros))
  return total
})

// ---------------------------------------------------------------
// Alertas (original: renderAlertas, lineas 3370-3494)
// Nota: el original repetia el bloque de liquidos dos veces (3405-3412 y
// 3438-3445). Aqui se deja una sola vez para no duplicar el aviso.
// ---------------------------------------------------------------
const alertas = computed(() => {
  const out = []
  const hoyDate = new Date()
  const mantAlert = filtrar(datos.mantenimientos)

  mantAlert.forEach((m) => {
    if (m.proxFecha && new Date(m.proxFecha) <= hoyDate) {
      out.push({ msg: `${m.vehiculo} - ${m.tipo} vencido el ${m.proxFecha}`, tipo: 'danger' })
    } else if (m.proxFecha) {
      const dias = diffDias(hoy(), m.proxFecha)
      if (dias >= -30 && dias < 0) {
        out.push({
          msg: `${m.vehiculo} - ${m.tipo} vence en ${Math.abs(dias)} dias (${m.proxFecha})`,
          tipo: 'warning',
        })
      }
    }
    if (m.proxKm) {
      const ultKm = mantAlert
        .filter((x) => x.vehiculo === m.vehiculo && x.km)
        .sort((a, b) => b.km - a.km)[0]
      if (ultKm && ultKm.proxKm && ultKm.km >= ultKm.proxKm) {
        out.push({
          msg: `${m.vehiculo} - ${m.tipo} excedio el kilometraje (${ultKm.km}/${ultKm.proxKm})`,
          tipo: 'danger',
        })
      }
    }
  })

  filtrar(datos.revisionGas).forEach((r) => {
    if (new Date(r.vence) <= hoyDate) {
      out.push({ msg: `Revision Gas: ${r.vehiculo} vencida el ${r.vence}`, tipo: 'danger' })
    } else {
      const dias = diffDias(hoy(), r.vence)
      if (dias >= -30 && dias < 0) {
        out.push({
          msg: `Revision Gas: ${r.vehiculo} vence en ${Math.abs(dias)} dias (${r.vence})`,
          tipo: 'warning',
        })
      }
    }
  })

  const CAMPOS_FLUIDO = ['aceite', 'refrigerante', 'frenos', 'direccion', 'limpia']
  filtrar(datos.liquidos).forEach((l) => {
    CAMPOS_FLUIDO.filter((f) => l[f] && l[f] !== 'OK').forEach((f) => {
      out.push({ msg: `Aceite: ${l.vehiculo} — ${f} en ${l[f]}`, tipo: 'warning' })
    })
  })

  filtrar(datos.prestamos).forEach((p) => {
    if (p.estado === 'En uso') {
      const salida = new Date(p.fechaSalida + 'T' + (p.horaSalida || '00:00'))
      const horas = (new Date() - salida) / (1000 * 60 * 60)
      if (horas > 24) {
        out.push({
          msg: `Prestamo: ${p.vehiculo} - ${p.solicitante} lleva ${Math.floor(horas)}h en uso sin devolver`,
          tipo: 'danger',
        })
      } else if (horas > 12) {
        out.push({
          msg: `Prestamo: ${p.vehiculo} - ${p.solicitante} lleva ${Math.floor(horas)}h en uso`,
          tipo: 'warning',
        })
      }
    }
  })

  filtrar(datos.soat).forEach((s) => {
    const vence = new Date(s.vence)
    if (vence <= hoyDate) {
      out.push({ msg: `SOAT: ${s.vehiculo} vencido el ${s.vence}`, tipo: 'danger' })
    } else {
      const dias = diffDias(hoy(), s.vence)
      if (dias >= 0 && dias <= 30) {
        out.push({
          msg: `SOAT: ${s.vehiculo} próximo a vencer (${dias} días - ${s.vence})`,
          tipo: 'warning',
        })
      }
    }
  })

  filtrar(datos.permisos).forEach((p) => {
    if (new Date(p.fin) <= hoyDate) {
      out.push({
        msg: `Pico y Placa: ${p.vehiculo} - ${p.municipio} vencido el ${p.fin}`,
        tipo: 'danger',
      })
    } else {
      const dias = diffDias(hoy(), p.fin)
      if (dias >= 0 && dias <= 15) {
        out.push({
          msg: `Pico y Placa: ${p.vehiculo} - ${p.municipio} próximo a vencer (${dias} días - ${p.fin})`,
          tipo: 'warning',
        })
      }
    }
  })

  filtrar(datos.reservas).forEach((r) => {
    if (r.estado !== 'Solicitado') {
      out.push({
        msg: `Reserva: ${r.solicitante} - ${r.vehiculo} el ${r.fecha} a las ${r.hora}`,
        tipo: 'warning',
      })
    }
  })

  // Alertas de kilometraje (cada 10.000 km + vencimiento personalizado).
  vehiculosFiltrados.value.forEach((v) => {
    const regs = datos.kilometraje
      .filter((k) => k.vehiculo === v.placa)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
    if (!regs.length) return
    const actual = regs[regs.length - 1].km
    const proxMeta = Math.ceil(actual / 10000) * 10000
    const diff = proxMeta - actual
    if (diff <= 0) {
      out.push({
        msg: `KM: ${v.placa} alcanzó ${actual.toLocaleString()} km — registrar próxima meta ${proxMeta.toLocaleString()} km`,
        tipo: 'danger',
      })
    } else if (diff <= 1000) {
      out.push({
        msg: `KM: ${v.placa} próximo a ${proxMeta.toLocaleString()} km (${diff} km restantes)`,
        tipo: 'warning',
      })
    }
    const vencKm = [...regs].reverse().find((k) => k.alertaKm)
    if (vencKm && vencKm.alertaKm) {
      const diffV = vencKm.alertaKm - actual
      if (diffV <= 0) {
        out.push({
          msg: `KM Venc: ${v.placa} — vencimiento por km alcanzado (${vencKm.alertaKm.toLocaleString()} km)`,
          tipo: 'danger',
        })
      } else if (diffV <= 1000) {
        out.push({
          msg: `KM Venc: ${v.placa} — próximo vencimiento en ${diffV} km (${vencKm.alertaKm.toLocaleString()} km)`,
          tipo: 'warning',
        })
      }
    }
  })

  return out
})

// ---------------------------------------------------------------
// Estado de fluidos por vehiculo (original: renderFluidos, 2018-2038)
// ---------------------------------------------------------------
const fluidos = computed(() => {
  const liq = filtrar(datos.liquidos)
  return vehiculosFiltrados.value.map((v) => {
    const ult = [...liq].reverse().find((l) => l.vehiculo === v.placa)
    const item = (name, valor) => ({ name, value: ult ? valor : 'Sin revision', ok: valor === 'OK' && !!ult })
    return {
      placa: v.placa,
      items: [
        item('Aceite', ult?.aceite),
        item('Refrigerante', ult?.refrigerante),
        item('Frenos', ult?.frenos),
        item('Direccion', ult?.direccion),
        item('Limpiaparabrisas', ult?.limpia),
      ],
    }
  })
})

// ---------------------------------------------------------------
// Kilometraje por vehiculo (original: renderKm, 3021-3073)
// ---------------------------------------------------------------
const kmPorVehiculo = computed(() =>
  vehiculosFiltrados.value.map((v) => {
    const registros = datos.kilometraje
      .filter((k) => k.vehiculo === v.placa)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
    const actual = registros.length ? registros[registros.length - 1].km : 0
    const proxMeta = Math.ceil(actual / 10000) * 10000
    const diff = proxMeta - actual

    let alertaMeta = null
    if (registros.length) {
      if (diff <= 0) {
        alertaMeta = { texto: `⚠ Meta de ${proxMeta} km alcanzada — registrar próxima`, color: '#dc2626', peso: 700 }
      } else if (diff <= 1000) {
        alertaMeta = { texto: `⚠ Próxima meta ${proxMeta} km en ${diff} km`, color: '#f59e0b', peso: 600 }
      } else {
        alertaMeta = { texto: `Próxima meta ${proxMeta} km en ${diff} km`, color: '#16a34a', peso: 400 }
      }
    }

    const vencKm = registros.filter((k) => k.alertaKm).sort((a, b) => b.km - a.km)[0]
    let alertaVenc = null
    if (vencKm && vencKm.alertaKm) {
      const diffV = vencKm.alertaKm - actual
      if (diffV <= 0) {
        alertaVenc = { texto: `⚠ Vencimiento por km alcanzado (${vencKm.alertaKm.toLocaleString()} km)`, color: '#dc2626', peso: 700 }
      } else if (diffV <= 1000) {
        alertaVenc = { texto: `⚠ Próximo vencimiento en ${diffV} km (${vencKm.alertaKm.toLocaleString()} km)`, color: '#f59e0b', peso: 600 }
      }
    }

    return {
      placa: v.placa,
      marca: v.marca,
      modelo: v.modelo || '',
      actual,
      alertaMeta,
      alertaVenc,
      registros: [...registros].reverse(),
    }
  }),
)

// ---------------------------------------------------------------
// Estado (badges) de permisos, revision de gas y SOAT
// (original dentro de renderPermisos 2051-2056, renderRevisionGas 2155-2160,
//  renderSoat 2257-2264). Se conserva la logica tal cual.
// ---------------------------------------------------------------
function estadoPermiso(p) {
  const vence = new Date(p.fin)
  const diff = diffDias(hoy(), p.fin)
  if (vence < new Date()) return { texto: 'Vencido', clase: 'badge-gray' }
  if (diff >= -15) return { texto: 'Por vencer', clase: 'badge-yellow' }
  return { texto: 'Vigente', clase: 'badge-green' }
}

function estadoRevisionGas(r) {
  const vence = new Date(r.vence)
  const diff = diffDias(hoy(), r.vence)
  if (vence < new Date()) return { texto: 'Vencido', clase: 'badge-gray' }
  if (diff >= -30) return { texto: 'Por vencer', clase: 'badge-yellow' }
  return { texto: 'Vigente', clase: 'badge-green' }
}

function estadoSoat(s) {
  const vence = new Date(s.vence)
  if (vence < new Date()) return { texto: 'Vencido', clase: 'badge-gray' }
  const diff = diffDias(hoy(), s.vence)
  if (diff >= -30) return { texto: 'Por vencer', clase: 'badge-yellow' }
  return { texto: 'Vigente', clase: 'badge-green' }
}

// ---------------------------------------------------------------
// Modales y formularios
// ---------------------------------------------------------------
const modalVehiculo = ref(false)
const modalMantenimiento = ref(false)
const modalGasolina = ref(false)
const modalLiquido = ref(false)
const modalPermiso = ref(false)
const modalRevisionGas = ref(false)
const modalSoat = ref(false)
const modalKm = ref(false)

const formVehiculo = ref({})
const formMantenimiento = ref({})
const formGasolina = ref({})
const formLiquido = ref({})
const formPermiso = ref({})
const formRevisionGas = ref({})
const formSoat = ref({})
const formKm = ref({})

// --- Abrir modales (original: abrirModalVehiculo 1669, abrirModalMantenimiento
// 1759, abrirModalGasolina 1854, abrirModalLiquido 1946, abrirModalPermiso 2076,
// abrirModalRevisionGas 2180, abrirModalSoat 2284, abrirModalKm 3075) ---
function abrirModalVehiculo(item) {
  formVehiculo.value = item
    ? {
        id: item.id,
        placa: item.placa || '',
        marca: item.marca || '',
        modelo: item.modelo || '',
        color: item.color || '',
        obs: item.obs || '',
      }
    : { id: null, placa: '', marca: '', modelo: '', color: '', obs: '' }
  modalVehiculo.value = true
}

function abrirModalMantenimiento(item) {
  formMantenimiento.value = item
    ? {
        id: item.id,
        vehiculo: item.vehiculo || '',
        tipo: item.tipo || 'Cambio de Aceite',
        fecha: item.fecha || '',
        km: item.km ?? '',
        proxKm: item.proxKm ?? '',
        proxFecha: item.proxFecha || '',
        obs: item.obs || '',
      }
    : {
        id: null,
        vehiculo: '',
        tipo: 'Cambio de Aceite',
        fecha: hoy(),
        km: '',
        proxKm: '',
        proxFecha: '',
        obs: '',
      }
  modalMantenimiento.value = true
}

function abrirModalGasolina(item) {
  formGasolina.value = item
    ? {
        id: item.id,
        vehiculo: item.vehiculo || '',
        fecha: item.fecha || '',
        litros: item.litros ?? '',
        km: item.km ?? '',
        valor: item.valor || '',
      }
    : { id: null, vehiculo: '', fecha: hoy(), litros: '', km: '', valor: '' }
  modalGasolina.value = true
}

function abrirModalLiquido(item) {
  formLiquido.value = item
    ? {
        id: item.id,
        vehiculo: item.vehiculo || '',
        fecha: item.fecha || '',
        aceite: item.aceite || 'OK',
        refrigerante: item.refrigerante || 'OK',
        frenos: item.frenos || 'OK',
        direccion: item.direccion || 'OK',
        limpia: item.limpia || 'OK',
        obs: item.obs || '',
      }
    : {
        id: null,
        vehiculo: '',
        fecha: hoy(),
        aceite: 'OK',
        refrigerante: 'OK',
        frenos: 'OK',
        direccion: 'OK',
        limpia: 'OK',
        obs: '',
      }
  modalLiquido.value = true
}

function abrirModalPermiso(item) {
  formPermiso.value = item
    ? {
        id: item.id,
        vehiculo: item.vehiculo || '',
        municipio: item.municipio || 'Medellin',
        tipo: item.tipo || 'Pico y Placa Solidario',
        inicio: item.inicio || '',
        fin: item.fin || '',
        correo: item.correo || '',
        obs: item.obs || '',
      }
    : {
        id: null,
        vehiculo: '',
        municipio: 'Medellin',
        tipo: 'Pico y Placa Solidario',
        inicio: hoy(),
        fin: '',
        correo: '',
        obs: '',
      }
  modalPermiso.value = true
}

function abrirModalRevisionGas(item) {
  formRevisionGas.value = item
    ? {
        id: item.id,
        vehiculo: item.vehiculo || '',
        fecha: item.fecha || '',
        vence: item.vence || '',
        km: item.km ?? '',
        resultado: item.resultado || 'Pendiente',
        obs: item.obs || '',
      }
    : {
        id: null,
        vehiculo: '',
        fecha: hoy(),
        vence: '',
        km: '',
        resultado: 'Aprobado',
        obs: '',
      }
  modalRevisionGas.value = true
}

function abrirModalSoat(item) {
  formSoat.value = item
    ? {
        id: item.id,
        vehiculo: item.vehiculo || '',
        aseguradora: item.aseguradora || '',
        poliza: item.poliza || '',
        fecha: item.fecha || '',
        vence: item.vence || '',
        valor: item.valor || '',
        obs: item.obs || '',
      }
    : {
        id: null,
        vehiculo: '',
        aseguradora: '',
        poliza: '',
        fecha: hoy(),
        vence: '',
        valor: '',
        obs: '',
      }
  modalSoat.value = true
}

function abrirModalKm(item) {
  formKm.value = item
    ? {
        id: item.id,
        vehiculo: item.vehiculo || '',
        fecha: item.fecha || '',
        km: item.km ?? '',
        alertaKm: item.alertaKm || '',
        obs: item.obs || '',
      }
    : { id: null, vehiculo: '', fecha: hoy(), km: '', alertaKm: '', obs: '' }
  modalKm.value = true
}

// --- Guardar (original: guardarVehiculo 1685, guardarMantenimiento 1779,
// guardarGasolina 1871, guardarLiquido 1967, guardarPermiso 2096,
// guardarRevisionGas 2200, guardarSoat 2304, guardarKm 3093) ---
async function guardarVehiculo() {
  if (!auth.esAdmin) return
  const f = formVehiculo.value
  const obj = {
    placa: (f.placa || '').toUpperCase(),
    marca: f.marca,
    modelo: f.modelo,
    color: f.color,
    obs: f.obs,
  }
  if (f.id) await actualizar('vehiculos', f.id, obj)
  else await crear('vehiculos', obj)
  await datos.recargar('vehiculos')
  modalVehiculo.value = false
}

async function guardarMantenimiento() {
  if (!auth.esAdmin) return
  const f = formMantenimiento.value
  const obj = {
    vehiculo: f.vehiculo,
    tipo: f.tipo,
    fecha: f.fecha,
    km: parseInt(f.km),
    proxKm: f.proxKm ? parseInt(f.proxKm) : null,
    proxFecha: f.proxFecha || null,
    obs: f.obs,
  }
  if (f.id) await actualizar('mantenimientos', f.id, obj)
  else await crear('mantenimientos', obj)
  await datos.recargar('mantenimientos')
  modalMantenimiento.value = false
}

async function guardarGasolina() {
  if (!auth.esAdmin) return
  const f = formGasolina.value
  const obj = {
    vehiculo: f.vehiculo,
    fecha: f.fecha,
    litros: parseFloat(f.litros),
    km: parseInt(f.km),
    valor: f.valor ? parseFloat(f.valor) : null,
  }
  if (f.id) await actualizar('gasolina', f.id, obj)
  else await crear('gasolina', obj)
  await datos.recargar('gasolina')
  modalGasolina.value = false
}

async function guardarLiquido() {
  if (!auth.esAdmin) return
  const f = formLiquido.value
  const obj = {
    vehiculo: f.vehiculo,
    fecha: f.fecha,
    aceite: f.aceite,
    refrigerante: f.refrigerante,
    frenos: f.frenos,
    direccion: f.direccion,
    limpia: f.limpia,
    obs: f.obs,
  }
  if (f.id) await actualizar('liquidos', f.id, obj)
  else await crear('liquidos', obj)
  await datos.recargar('liquidos')
  modalLiquido.value = false
}

async function guardarPermiso() {
  if (!auth.esAdmin) return
  const f = formPermiso.value
  const obj = {
    vehiculo: f.vehiculo,
    municipio: f.municipio,
    tipo: f.tipo,
    inicio: f.inicio,
    fin: f.fin,
    correo: f.correo,
    obs: f.obs,
  }
  if (f.id) await actualizar('permisos', f.id, obj)
  else await crear('permisos', obj)
  await datos.recargar('permisos')
  modalPermiso.value = false
}

async function guardarRevisionGas() {
  if (!auth.esAdmin) return
  const f = formRevisionGas.value
  const obj = {
    vehiculo: f.vehiculo,
    fecha: f.fecha,
    vence: f.vence,
    km: f.km ? parseInt(f.km) : null,
    resultado: f.resultado,
    obs: f.obs,
  }
  if (f.id) await actualizar('revisionGas', f.id, obj)
  else await crear('revisionGas', obj)
  await datos.recargar('revisionGas')
  modalRevisionGas.value = false
}

async function guardarSoat() {
  if (!auth.esAdmin) return
  const f = formSoat.value
  const obj = {
    vehiculo: f.vehiculo,
    aseguradora: f.aseguradora,
    poliza: f.poliza || '',
    fecha: f.fecha,
    vence: f.vence,
    valor: f.valor ? parseFloat(f.valor) : null,
    obs: f.obs,
  }
  if (f.id) await actualizar('soat', f.id, obj)
  else await crear('soat', obj)
  await datos.recargar('soat')
  modalSoat.value = false
}

async function guardarKm() {
  if (!auth.esAdmin) return
  const f = formKm.value
  const obj = {
    vehiculo: f.vehiculo,
    fecha: f.fecha,
    km: parseInt(f.km),
    alertaKm: f.alertaKm ? parseInt(f.alertaKm) : null,
    obs: f.obs,
  }
  if (f.id) await actualizar('kilometraje', f.id, obj)
  else await crear('kilometraje', obj)
  await datos.recargar('kilometraje')
  modalKm.value = false
}

// --- Eliminar (original: eliminarVehiculo 1719, eliminarMantenimiento 1815,
// eliminarGasolina 1905, eliminarLiquido 2004, eliminarPermiso 2132,
// eliminarRevisionGas 2235, eliminarSoat 2341, eliminarKm 3128) ---
async function eliminarVehiculo(item) {
  if (!confirm('Eliminar vehiculo?')) return
  await eliminar('vehiculos', item.id)
  await datos.recargar('vehiculos')
}

async function eliminarMantenimiento(item) {
  if (!confirm('Eliminar registro?')) return
  await eliminar('mantenimientos', item.id)
  await datos.recargar('mantenimientos')
}

async function eliminarGasolina(item) {
  if (!confirm('Eliminar registro?')) return
  await eliminar('gasolina', item.id)
  await datos.recargar('gasolina')
}

async function eliminarLiquido(item) {
  if (!confirm('Eliminar revision?')) return
  await eliminar('liquidos', item.id)
  await datos.recargar('liquidos')
}

async function eliminarPermiso(item) {
  if (!auth.esAdmin) return
  if (!confirm('Eliminar permiso?')) return
  await eliminar('permisos', item.id)
  await datos.recargar('permisos')
}

async function eliminarRevisionGas(item) {
  if (!confirm('Eliminar revision de gas?')) return
  await eliminar('revisionGas', item.id)
  await datos.recargar('revisionGas')
}

async function eliminarSoat(item) {
  if (!confirm('Eliminar registro SOAT?')) return
  await eliminar('soat', item.id)
  await datos.recargar('soat')
}

async function eliminarKm(item) {
  if (!confirm('Eliminar registro de kilometraje?')) return
  await eliminar('kilometraje', item.id)
  await datos.recargar('kilometraje')
}
</script>

<template>
  <div>
    <!-- Alertas (original: alertBarVehiculos/alertListVehiculos, 554-557) -->
    <div v-if="alertas.length" class="alert-bar show">
      <h3>Alertas</h3>
      <div>
        <div v-for="(a, i) in alertas" :key="i" class="alert-item">
          <span>
            <span class="tag" :class="a.tipo === 'danger' ? 'tag-danger' : 'tag-warning'">
              {{ a.tipo === 'danger' ? 'Vencido' : 'Proximo' }}
            </span>
            {{ a.msg }}
          </span>
        </div>
      </div>
    </div>

    <!-- Stats (original: lineas 559-564) -->
    <div class="stats">
      <div class="stat">
        <div class="num">{{ statVehiculos }}</div>
        <div class="lbl">Vehiculos</div>
      </div>
      <div class="stat">
        <div class="num">{{ statPendientes }}</div>
        <div class="lbl">Mant. Pendientes</div>
      </div>
      <div class="stat">
        <div class="num">{{ statKm.toLocaleString() }}</div>
        <div class="lbl">Km Totales</div>
      </div>
      <div class="stat">
        <div class="num">{{ statGas.toFixed(1) }}</div>
        <div class="lbl">Gas (Lts)</div>
      </div>
    </div>

    <!-- Filtro por vehiculo (original: filterBar, 566-572) -->
    <div class="filter-bar">
      <label>Filtrar por vehiculo:</label>
      <select v-model="filtro">
        <option v-if="!opcionesVehiculos.length" value="">No hay vehiculos</option>
        <option v-else value="">Todos los vehiculos</option>
        <option v-for="v in opcionesVehiculos" :key="v.placa" :value="v.placa">
          {{ v.texto }}
        </option>
      </select>
      <span v-if="filtro" style="font-size: 0.75rem; color: #6b7280">
        Mostrando solo: {{ filtro }}
      </span>
    </div>

    <!-- Sub-pestanas (original: 574-583) -->
    <div class="sub-tabs">
      <button
        v-for="t in SUB_TABS"
        :key="t.id"
        class="sub-tab"
        :class="{ active: subTab === t.id }"
        @click="subTab = t.id"
      >
        {{ t.texto }}
      </button>
    </div>

    <!-- ================= subInfo (585-593) ================= -->
    <div class="sub-panel" :class="{ active: subTab === 'subInfo' }">
      <div class="card">
        <div
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
          "
        >
          <h2 style="margin: 0">Mis Vehiculos</h2>
          <button v-if="auth.esAdmin" class="btn btn-primary btn-sm" @click="abrirModalVehiculo()">
            + Agregar
          </button>
        </div>
        <div v-if="!datos.vehiculos.length" class="empty">No hay vehiculos registrados</div>
        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Placa</th>
                <th>Marca</th>
                <th>Modelo</th>
                <th>Color</th>
                <th v-if="auth.esAdmin">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="v in datos.vehiculos" :key="v.id">
                <td><strong>{{ v.placa }}</strong></td>
                <td>{{ v.marca }}</td>
                <td>{{ v.modelo }}</td>
                <td>{{ v.color || '-' }}</td>
                <td v-if="auth.esAdmin" class="actions">
                  <button class="btn btn-sm btn-outline" @click="abrirModalVehiculo(v)">
                    Editar
                  </button>
                  <button class="btn btn-sm btn-danger" @click="eliminarVehiculo(v)">
                    Eliminar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ================= subMantenimiento (595-603) ================= -->
    <div class="sub-panel" :class="{ active: subTab === 'subMantenimiento' }">
      <div class="card">
        <div
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
          "
        >
          <h2 style="margin: 0">Historial de Mantenimiento</h2>
          <button
            v-if="auth.esAdmin"
            class="btn btn-primary btn-sm"
            @click="abrirModalMantenimiento()"
          >
            + Registrar
          </button>
        </div>
        <div v-if="!mantenimientosFiltrados.length" class="empty">
          No hay registros de mantenimiento
        </div>
        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Vehiculo</th>
                <th>Tipo</th>
                <th>Km</th>
                <th>Prox Km</th>
                <th>Prox Fecha</th>
                <th v-if="auth.esAdmin">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in mantenimientosFiltrados" :key="m.id">
                <td>{{ m.fecha }}</td>
                <td>{{ m.vehiculo }}</td>
                <td>{{ m.tipo }}</td>
                <td>{{ m.km?.toLocaleString() }}</td>
                <td>{{ m.proxKm ? m.proxKm.toLocaleString() : '-' }}</td>
                <td>{{ m.proxFecha || '-' }}</td>
                <td v-if="auth.esAdmin" class="actions">
                  <button class="btn btn-sm btn-outline" @click="abrirModalMantenimiento(m)">
                    Editar
                  </button>
                  <button class="btn btn-sm btn-danger" @click="eliminarMantenimiento(m)">
                    Eliminar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ================= subGasolina (605-613) ================= -->
    <div class="sub-panel" :class="{ active: subTab === 'subGasolina' }">
      <div class="card">
        <div
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
          "
        >
          <h2 style="margin: 0">Control de Gasolina</h2>
          <button v-if="auth.esAdmin" class="btn btn-primary btn-sm" @click="abrirModalGasolina()">
            + Registrar
          </button>
        </div>
        <div v-if="!gasolinaFiltrada.length" class="empty">No hay registros de gasolina</div>
        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Vehiculo</th>
                <th>Litros</th>
                <th>Km</th>
                <th>Valor</th>
                <th v-if="auth.esAdmin">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="g in gasolinaFiltrada" :key="g.id">
                <td>{{ g.fecha }}</td>
                <td>{{ g.vehiculo }}</td>
                <td>{{ g.litros }}</td>
                <td>{{ g.km?.toLocaleString() }}</td>
                <td>{{ g.valor ? '$' + parseFloat(g.valor).toLocaleString() : '-' }}</td>
                <td v-if="auth.esAdmin" class="actions">
                  <button class="btn btn-sm btn-outline" @click="abrirModalGasolina(g)">
                    Editar
                  </button>
                  <button class="btn btn-sm btn-danger" @click="eliminarGasolina(g)">
                    Eliminar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ================= subLiquidos (615-627) ================= -->
    <div class="sub-panel" :class="{ active: subTab === 'subLiquidos' }">
      <div class="card">
        <div
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
          "
        >
          <h2 style="margin: 0">Revision de Liquidos</h2>
          <button v-if="auth.esAdmin" class="btn btn-primary btn-sm" @click="abrirModalLiquido()">
            + Revisar
          </button>
        </div>
        <div v-if="!liquidosFiltrados.length" class="empty">No hay revisiones de liquidos</div>
        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Vehiculo</th>
                <th>Aceite</th>
                <th>Refrig</th>
                <th>Frenos</th>
                <th>Direc</th>
                <th>Limpia</th>
                <th v-if="auth.esAdmin">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="l in liquidosFiltrados" :key="l.id">
                <td>{{ l.fecha }}</td>
                <td>{{ l.vehiculo }}</td>
                <td><span :class="l.aceite === 'OK' ? 'ok' : 'alert'">{{ l.aceite }}</span></td>
                <td>
                  <span :class="l.refrigerante === 'OK' ? 'ok' : 'alert'">{{ l.refrigerante }}</span>
                </td>
                <td><span :class="l.frenos === 'OK' ? 'ok' : 'alert'">{{ l.frenos }}</span></td>
                <td><span :class="l.direccion === 'OK' ? 'ok' : 'alert'">{{ l.direccion }}</span></td>
                <td><span :class="l.limpia === 'OK' ? 'ok' : 'alert'">{{ l.limpia }}</span></td>
                <td v-if="auth.esAdmin" class="actions">
                  <button class="btn btn-sm btn-outline" @click="abrirModalLiquido(l)">Editar</button>
                  <button class="btn btn-sm btn-danger" @click="eliminarLiquido(l)">Eliminar</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Estado Actual (original: fluidGrid, 623-626 y renderFluidos 2018-2038) -->
      <div class="card">
        <h2>Estado Actual</h2>
        <div class="fluid-grid">
          <div v-if="!datos.vehiculos.length" class="empty">Agrega un vehiculo primero</div>
          <div v-for="f in fluidos" :key="f.placa" style="margin-bottom: 1rem">
            <strong style="font-size: 0.9rem">{{ f.placa }}</strong>
            <div class="fluid-grid" style="margin-top: 0.5rem">
              <div v-for="it in f.items" :key="it.name" class="fluid-item">
                <div class="name">{{ it.name }}</div>
                <div class="status" :class="it.ok ? 'ok' : 'alert'">{{ it.value }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ================= subPicoPlaca (629-637) ================= -->
    <div class="sub-panel" :class="{ active: subTab === 'subPicoPlaca' }">
      <div class="card">
        <div
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
          "
        >
          <h2 style="margin: 0">Permisos Pico y Placa</h2>
          <button v-if="auth.esAdmin" class="btn btn-primary btn-sm" @click="abrirModalPermiso()">
            + Agregar
          </button>
        </div>
        <div v-if="!permisosFiltrados.length" class="empty">No hay permisos registrados</div>
        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Vehiculo</th>
                <th>Municipio</th>
                <th>Tipo</th>
                <th>Inicio</th>
                <th>Vence</th>
                <th>Correo/Web</th>
                <th>Estado</th>
                <th v-if="auth.esAdmin">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in permisosFiltrados" :key="p.id">
                <td><strong>{{ p.vehiculo }}</strong></td>
                <td>{{ p.municipio }}</td>
                <td>{{ p.tipo }}</td>
                <td>{{ p.inicio }}</td>
                <td>{{ p.fin }}</td>
                <td>{{ p.correo || '-' }}</td>
                <td>
                  <span class="badge" :class="estadoPermiso(p).clase">
                    {{ estadoPermiso(p).texto }}
                  </span>
                </td>
                <td v-if="auth.esAdmin" class="actions">
                  <button class="btn btn-sm btn-outline" @click="abrirModalPermiso(p)">Editar</button>
                  <button class="btn btn-sm btn-danger" @click="eliminarPermiso(p)">Eliminar</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ================= subRevisionGas (639-647) ================= -->
    <div class="sub-panel" :class="{ active: subTab === 'subRevisionGas' }">
      <div class="card">
        <div
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
          "
        >
          <h2 style="margin: 0">Revision Periodica de Gas</h2>
          <button
            v-if="auth.esAdmin"
            class="btn btn-primary btn-sm"
            @click="abrirModalRevisionGas()"
          >
            + Registrar
          </button>
        </div>
        <div v-if="!revisionesGasFiltradas.length" class="empty">
          No hay revisiones de gas registradas
        </div>
        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Vehiculo</th>
                <th>Vence</th>
                <th>Km</th>
                <th>Resultado</th>
                <th>Estado</th>
                <th v-if="auth.esAdmin">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in revisionesGasFiltradas" :key="r.id">
                <td>{{ r.fecha }}</td>
                <td><strong>{{ r.vehiculo }}</strong></td>
                <td>{{ r.vence }}</td>
                <td>{{ r.km ? r.km.toLocaleString() : '-' }}</td>
                <td>
                  <span :class="r.resultado === 'Aprobado' ? 'ok' : 'alert'">
                    {{ r.resultado || 'Pendiente' }}
                  </span>
                </td>
                <td>
                  <span class="badge" :class="estadoRevisionGas(r).clase">
                    {{ estadoRevisionGas(r).texto }}
                  </span>
                </td>
                <td v-if="auth.esAdmin" class="actions">
                  <button class="btn btn-sm btn-outline" @click="abrirModalRevisionGas(r)">
                    Editar
                  </button>
                  <button class="btn btn-sm btn-danger" @click="eliminarRevisionGas(r)">
                    Eliminar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ================= subSoat (649-657) ================= -->
    <div class="sub-panel" :class="{ active: subTab === 'subSoat' }">
      <div class="card">
        <div
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
          "
        >
          <h2 style="margin: 0">SOAT</h2>
          <button v-if="auth.esAdmin" class="btn btn-primary btn-sm" @click="abrirModalSoat()">
            + Registrar
          </button>
        </div>
        <div v-if="!soatFiltrado.length" class="empty">No hay registros SOAT</div>
        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Vehículo</th>
                <th>Aseguradora</th>
                <th>Póliza</th>
                <th>Expedición</th>
                <th>Vence</th>
                <th>Valor</th>
                <th>Estado</th>
                <th v-if="auth.esAdmin">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in soatFiltrado" :key="s.id">
                <td><strong>{{ s.vehiculo }}</strong></td>
                <td>{{ s.aseguradora }}</td>
                <td>{{ s.poliza || '-' }}</td>
                <td>{{ s.fecha }}</td>
                <td>{{ s.vence }}</td>
                <td>{{ s.valor ? '$' + parseFloat(s.valor).toLocaleString() : '-' }}</td>
                <td>
                  <span class="badge" :class="estadoSoat(s).clase">{{ estadoSoat(s).texto }}</span>
                </td>
                <td v-if="auth.esAdmin" class="actions">
                  <button class="btn btn-sm btn-outline" @click="abrirModalSoat(s)">Editar</button>
                  <button class="btn btn-sm btn-danger" @click="eliminarSoat(s)">Eliminar</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ================= subKilometraje (659-667) ================= -->
    <div class="sub-panel" :class="{ active: subTab === 'subKilometraje' }">
      <div class="card">
        <div
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
          "
        >
          <h2 style="margin: 0">Kilometraje</h2>
          <button v-if="auth.esAdmin" class="btn btn-primary btn-sm" @click="abrirModalKm()">
            + Registrar
          </button>
        </div>

        <div v-if="!datos.vehiculos.length" class="empty">Agrega un vehículo primero</div>
        <div v-for="v in kmPorVehiculo" :key="v.placa" class="card" style="margin-bottom: 1rem">
          <h3 style="margin: 0 0 0.5rem">
            {{ v.placa }} — {{ v.marca }} {{ v.modelo }}
            <span style="font-weight: 400; font-size: 0.85rem">
              Km actual: <strong>{{ v.actual.toLocaleString() }}</strong>
            </span>
            <span
              v-if="v.alertaMeta"
              :style="{ color: v.alertaMeta.color, fontWeight: v.alertaMeta.peso }"
            >
              {{ v.alertaMeta.texto }}
            </span>
            <span
              v-if="v.alertaVenc"
              :style="{ color: v.alertaVenc.color, fontWeight: v.alertaVenc.peso }"
            >
              {{ v.alertaVenc.texto }}
            </span>
          </h3>
          <div v-if="v.registros.length">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>KM</th>
                  <th>Vence km</th>
                  <th>Obs</th>
                  <th v-if="auth.esAdmin">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="k in v.registros" :key="k.id">
                  <td>{{ k.fecha }}</td>
                  <td>{{ k.km.toLocaleString() }}</td>
                  <td>{{ k.alertaKm ? k.alertaKm.toLocaleString() : '-' }}</td>
                  <td>{{ k.obs || '-' }}</td>
                  <td v-if="auth.esAdmin" class="actions">
                    <button class="btn btn-sm btn-outline" @click="abrirModalKm(k)">Editar</button>
                    <button class="btn btn-sm btn-danger" @click="eliminarKm(k)">Eliminar</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="empty">Sin registros de kilometraje</div>
        </div>
      </div>
    </div>

    <!-- ================= MODAL VEHICULO (863-879) ================= -->
    <BaseModal :abierto="modalVehiculo" @cerrar="modalVehiculo = false">
      <h2>{{ formVehiculo.id ? 'Editar Vehiculo' : 'Agregar Vehiculo' }}</h2>
      <form @submit.prevent="guardarVehiculo">
        <div><label>Placa</label><input v-model="formVehiculo.placa" required /></div>
        <div><label>Marca</label><input v-model="formVehiculo.marca" required /></div>
        <div><label>Modelo</label><input v-model="formVehiculo.modelo" required /></div>
        <div><label>Color</label><input v-model="formVehiculo.color" /></div>
        <div class="full">
          <label>Observaciones</label>
          <textarea v-model="formVehiculo.obs" rows="2"></textarea>
        </div>
        <div class="full" style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.5rem">
          <button type="button" class="btn btn-outline" @click="modalVehiculo = false">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>
    </BaseModal>

    <!-- ================= MODAL MANTENIMIENTO (881-910) ================= -->
    <BaseModal :abierto="modalMantenimiento" @cerrar="modalMantenimiento = false">
      <h2>{{ formMantenimiento.id ? 'Editar Mantenimiento' : 'Registrar Mantenimiento' }}</h2>
      <form @submit.prevent="guardarMantenimiento">
        <div>
          <label>Vehiculo</label>
          <select v-model="formMantenimiento.vehiculo" required>
            <option value="">Seleccione vehiculo</option>
            <option v-for="v in opcionesVehiculos" :key="v.placa" :value="v.placa">
              {{ v.texto }}
            </option>
          </select>
        </div>
        <div>
          <label>Tipo</label>
          <select v-model="formMantenimiento.tipo" required>
            <option v-for="t in TIPOS_MANTENIMIENTO" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div><label>Fecha</label><input v-model="formMantenimiento.fecha" type="date" required /></div>
        <div><label>Kilometraje</label><input v-model="formMantenimiento.km" type="number" required /></div>
        <div>
          <label>Proximo vencimiento (km)</label>
          <input v-model="formMantenimiento.proxKm" type="number" />
        </div>
        <div>
          <label>Proximo vencimiento (fecha)</label>
          <input v-model="formMantenimiento.proxFecha" type="date" />
        </div>
        <div class="full">
          <label>Observaciones</label>
          <textarea v-model="formMantenimiento.obs" rows="2"></textarea>
        </div>
        <div class="full" style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.5rem">
          <button type="button" class="btn btn-outline" @click="modalMantenimiento = false">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>
    </BaseModal>

    <!-- ================= MODAL GASOLINA (912-928) ================= -->
    <BaseModal :abierto="modalGasolina" @cerrar="modalGasolina = false">
      <h2>Registrar Carga de Gasolina</h2>
      <form @submit.prevent="guardarGasolina">
        <div>
          <label>Vehiculo</label>
          <select v-model="formGasolina.vehiculo" required>
            <option value="">Seleccione vehiculo</option>
            <option v-for="v in opcionesVehiculos" :key="v.placa" :value="v.placa">
              {{ v.texto }}
            </option>
          </select>
        </div>
        <div><label>Fecha</label><input v-model="formGasolina.fecha" type="date" required /></div>
        <div>
          <label>Litros</label>
          <input v-model="formGasolina.litros" type="number" step="0.01" required />
        </div>
        <div><label>Kilometraje</label><input v-model="formGasolina.km" type="number" required /></div>
        <div>
          <label>Valor ($)</label>
          <input v-model="formGasolina.valor" type="number" step="0.01" />
        </div>
        <div class="full" style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.5rem">
          <button type="button" class="btn btn-outline" @click="modalGasolina = false">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>
    </BaseModal>

    <!-- ================= MODAL LIQUIDO (930-948) ================= -->
    <BaseModal :abierto="modalLiquido" @cerrar="modalLiquido = false">
      <h2>Revision de Liquidos</h2>
      <form @submit.prevent="guardarLiquido">
        <div>
          <label>Vehiculo</label>
          <select v-model="formLiquido.vehiculo" required>
            <option value="">Seleccione vehiculo</option>
            <option v-for="v in opcionesVehiculos" :key="v.placa" :value="v.placa">
              {{ v.texto }}
            </option>
          </select>
        </div>
        <div><label>Fecha</label><input v-model="formLiquido.fecha" type="date" required /></div>
        <div>
          <label>Aceite Motor</label>
          <select v-model="formLiquido.aceite">
            <option v-for="e in ESTADOS_FLUIDO" :key="e" :value="e">{{ e }}</option>
          </select>
        </div>
        <div>
          <label>Refrigerante</label>
          <select v-model="formLiquido.refrigerante">
            <option v-for="e in ESTADOS_FLUIDO" :key="e" :value="e">{{ e }}</option>
          </select>
        </div>
        <div>
          <label>Frenos</label>
          <select v-model="formLiquido.frenos">
            <option v-for="e in ESTADOS_FLUIDO" :key="e" :value="e">{{ e }}</option>
          </select>
        </div>
        <div>
          <label>Direccion</label>
          <select v-model="formLiquido.direccion">
            <option v-for="e in ESTADOS_FLUIDO" :key="e" :value="e">{{ e }}</option>
          </select>
        </div>
        <div>
          <label>Limpiaparabrisas</label>
          <select v-model="formLiquido.limpia">
            <option v-for="e in ESTADOS_FLUIDO" :key="e" :value="e">{{ e }}</option>
          </select>
        </div>
        <div class="full">
          <label>Observaciones</label>
          <textarea v-model="formLiquido.obs" rows="2"></textarea>
        </div>
        <div class="full" style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.5rem">
          <button type="button" class="btn btn-outline" @click="modalLiquido = false">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>
    </BaseModal>

    <!-- ================= MODAL PERMISO (1134-1167) ================= -->
    <BaseModal :abierto="modalPermiso" @cerrar="modalPermiso = false">
      <h2>{{ formPermiso.id ? 'Editar Permiso' : 'Agregar Permiso' }}</h2>
      <form @submit.prevent="guardarPermiso">
        <div>
          <label>Vehiculo</label>
          <select v-model="formPermiso.vehiculo" required>
            <option value="">Seleccione vehiculo</option>
            <option v-for="v in opcionesVehiculos" :key="v.placa" :value="v.placa">
              {{ v.texto }}
            </option>
          </select>
        </div>
        <div>
          <label>Municipio</label>
          <select v-model="formPermiso.municipio" required>
            <option v-for="m in MUNICIPIOS" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
        <div>
          <label>Tipo de Permiso</label>
          <select v-model="formPermiso.tipo" required>
            <option v-for="t in TIPOS_PERMISO" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div><label>Fecha Inicio</label><input v-model="formPermiso.inicio" type="date" required /></div>
        <div>
          <label>Fecha Vencimiento</label>
          <input v-model="formPermiso.fin" type="date" required />
        </div>
        <div>
          <label>Correo o página web</label>
          <input v-model="formPermiso.correo" placeholder="correo@ejemplo.com o https://..." />
        </div>
        <div class="full">
          <label>Observaciones</label>
          <textarea v-model="formPermiso.obs" rows="2"></textarea>
        </div>
        <div class="full" style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.5rem">
          <button type="button" class="btn btn-outline" @click="modalPermiso = false">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>
    </BaseModal>

    <!-- ================= MODAL REVISION GAS (1073-1093) ================= -->
    <BaseModal :abierto="modalRevisionGas" @cerrar="modalRevisionGas = false">
      <h2>{{ formRevisionGas.id ? 'Editar Revision de Gas' : 'Registrar Revision de Gas' }}</h2>
      <form @submit.prevent="guardarRevisionGas">
        <div>
          <label>Vehiculo</label>
          <select v-model="formRevisionGas.vehiculo" required>
            <option value="">Seleccione vehiculo</option>
            <option v-for="v in opcionesVehiculos" :key="v.placa" :value="v.placa">
              {{ v.texto }}
            </option>
          </select>
        </div>
        <div>
          <label>Fecha Revision</label>
          <input v-model="formRevisionGas.fecha" type="date" required />
        </div>
        <div>
          <label>Fecha Vencimiento</label>
          <input v-model="formRevisionGas.vence" type="date" required />
        </div>
        <div><label>Kilometraje</label><input v-model="formRevisionGas.km" type="number" /></div>
        <div>
          <label>Resultado</label>
          <select v-model="formRevisionGas.resultado">
            <option v-for="r in RESULTADOS_GAS" :key="r" :value="r">{{ r }}</option>
          </select>
        </div>
        <div class="full">
          <label>Observaciones</label>
          <textarea v-model="formRevisionGas.obs" rows="2"></textarea>
        </div>
        <div class="full" style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.5rem">
          <button type="button" class="btn btn-outline" @click="modalRevisionGas = false">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>
    </BaseModal>

    <!-- ================= MODAL SOAT (1096-1113) ================= -->
    <BaseModal :abierto="modalSoat" @cerrar="modalSoat = false">
      <h2>{{ formSoat.id ? 'Editar SOAT' : 'Registrar SOAT' }}</h2>
      <form @submit.prevent="guardarSoat">
        <div>
          <label>Vehículo</label>
          <select v-model="formSoat.vehiculo" required>
            <option value="">Seleccione vehiculo</option>
            <option v-for="v in opcionesVehiculos" :key="v.placa" :value="v.placa">
              {{ v.texto }}
            </option>
          </select>
        </div>
        <div><label>Compañía Aseguradora</label><input v-model="formSoat.aseguradora" required /></div>
        <div><label>Número de Póliza</label><input v-model="formSoat.poliza" /></div>
        <div><label>Fecha Expedición</label><input v-model="formSoat.fecha" type="date" required /></div>
        <div>
          <label>Fecha Vencimiento</label>
          <input v-model="formSoat.vence" type="date" required />
        </div>
        <div>
          <label>Valor ($)</label>
          <input v-model="formSoat.valor" type="number" step="0.01" />
        </div>
        <div class="full">
          <label>Observaciones</label>
          <textarea v-model="formSoat.obs" rows="2"></textarea>
        </div>
        <div class="full" style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.5rem">
          <button type="button" class="btn btn-outline" @click="modalSoat = false">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>
    </BaseModal>

    <!-- ================= MODAL KM (1116-1131) ================= -->
    <BaseModal :abierto="modalKm" @cerrar="modalKm = false">
      <h2>{{ formKm.id ? 'Editar Kilometraje' : 'Registrar Kilometraje' }}</h2>
      <form @submit.prevent="guardarKm">
        <div>
          <label>Vehículo</label>
          <select v-model="formKm.vehiculo" required>
            <option value="">Seleccione vehiculo</option>
            <option v-for="v in opcionesVehiculos" :key="v.placa" :value="v.placa">
              {{ v.texto }}
            </option>
          </select>
        </div>
        <div><label>Fecha</label><input v-model="formKm.fecha" type="date" required /></div>
        <div><label>Kilometraje</label><input v-model="formKm.km" type="number" required /></div>
        <div>
          <label>Alerta próximo vencimiento (km)</label>
          <input v-model="formKm.alertaKm" type="number" placeholder="Ej: 5000" />
        </div>
        <div class="full">
          <label>Observaciones</label>
          <textarea v-model="formKm.obs" rows="2"></textarea>
        </div>
        <div class="full" style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.5rem">
          <button type="button" class="btn btn-outline" @click="modalKm = false">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>
    </BaseModal>
  </div>
</template>

<style scoped>
/* Original: index.html lineas 150-151. Lo demas sale de base.css. */
.sub-panel {
  display: none;
}
.sub-panel.active {
  display: block;
}
</style>

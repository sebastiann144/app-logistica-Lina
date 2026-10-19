<script setup>
// Tab "EQUIPOS ASIGNADOS" de index.html (lineas 747-764) y su logica `asig*`
// (lineas 4183-4248). En el original TODO el contenido se armaba con innerHTML
// desde JS; aqui se reconstruye con templates de Vue.
//
// Colecciones propias de la pantalla: el original las tenia en variables
// globales (linea 4187) y las leia con asigLeer(). Como no viven en
// useDatosStore (que solo carga las 14 colecciones principales), se cargan aqui
// con listar() y se guardan en ref([]) locales.
//
// Excepcion: `inventario` ya esta en el store y normalizado
// (normalizarInventario); el original lo re-leia en asigCargar() (linea 4218).
// Aqui se lee de datos.inventario y se refresca con datos.recargar('inventario')
// despues de cada escritura para que otras vistas tambien lo vean al dia.
import { computed, onMounted, ref, watch } from 'vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { collection, crear, db, doc, listar, writeBatch } from '@/services/firestore'
import { useAuthStore } from '@/stores/auth'
import { useDatosStore } from '@/stores/datos'
import { hoy } from '@/utils/fechas'

const auth = useAuthStore()
const datos = useDatosStore()

// ---------------------------------------------------------------
// Estado (variables globales del original, linea 4187)
// ---------------------------------------------------------------
const personas = ref([]) // personasEquipos
const asignaciones = ref([]) // asignacionesEquipos
// El original carga `devolucionesEquipos` en asigCargar() (linea 4217) aunque
// esta pestana no la use; se conserva la carga por fidelidad.
const devoluciones = ref([]) // devolucionesEquipos
const movimientos = ref([]) // movimientosEquipos
const legado = ref([]) // equiposOficina (datos "legacy", id legacy:<id>)
// `inventario` del original (linea 4218): ya normalizado en el store.
const inventario = computed(() => datos.inventario)

const cargando = ref(true)
const vistaActual = ref('resumen') // asigVistaActual (linea 4188)
const busqueda = ref('') // input #asigBusqueda (linea 754)

// ---------------------------------------------------------------
// Helpers (lineas 4189-4194)
// ---------------------------------------------------------------
// asigClave: normaliza texto para comparar codigos/seriales.
const clave = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
// asigTexto() no se porta: Vue escapa el HTML solo (no hay innerHTML).
const nombreEquipo = (e) => [e.tipo, e.marca, e.modelo].filter(Boolean).join(' ') || 'Equipo'
const codigoDe = (e) => e.codigo || e.referencia || e.numInventario || e.id
const legadoActivo = (e) => !e.devFecha && !e.devRecibido && (e.respNombre || e.entRecibido)

// asigEquipoInventario (lineas 4195-4205): enlaza un registro legacy de
// equiposOficina con su equipo del inventario nuevo (por codigo, serial o
// consecutivo + tipo).
function equipoInventario(legacy) {
  const codigo = clave(legacy.numInventario || legacy.codigo)
  const serial = clave(legacy.serie)
  const exact = inventario.value.find(
    (e) => (codigo && clave(codigoDe(e)) === codigo) || (serial && clave(e.serie) === serial),
  )
  if (exact) return exact
  const consecutivo = (String(legacy.numInventario || '').match(/(\d{1,3})\s*$/) || [])[1]
  if (!consecutivo) return undefined
  const tipo = String(legacy.tipo || '').toLowerCase()
  const esperado =
    tipo.includes('port') || String(legacy.numInventario).toUpperCase().includes('PC-P')
      ? 'port'
      : tipo.includes('cel') || String(legacy.numInventario).toUpperCase().includes('CL')
        ? 'cel'
        : tipo.includes('comput') || String(legacy.numInventario).toUpperCase().includes('PC-M')
          ? 'comput'
          : ''
  return inventario.value.find(
    (e) =>
      String(e.tipo || '').toLowerCase().includes(esperado) &&
      (String(e.referencia || e.codigo || '').match(/(\d{1,3})\s*$/) || [])[1] === consecutivo,
  )
}

// asigEstado (lineas 4206-4212): estado visible del equipo del inventario.
function estado(e) {
  if (e.asignacionActivaId || e.estadoGestion === 'Asignado') return 'Asignado'
  if (
    asignaciones.value.some(
      (a) => a.estado === 'Activa' && (a.equipoId === e.id || clave(a.codigo) === clave(codigoDe(e))),
    )
  )
    return 'Asignado'
  const old = legado.value.find((x) => legadoActivo(x) && equipoInventario(x)?.id === e.id)
  if (!e.estadoGestion && old) return 'Asignado'
  return e.estadoGestion || 'Disponible'
}

// asigClaseEstado (linea 4213): clase del badge segun el estado.
function claseEstado(s) {
  return s === 'Asignado'
    ? 'badge-blue'
    : s === 'Mantenimiento'
      ? 'badge-yellow'
      : s === 'Dañado'
        ? 'badge-red'
        : 'badge-green'
}

// ---------------------------------------------------------------
// Carga de datos (asigLeer / asigCargar, lineas 4214-4221)
// ---------------------------------------------------------------
// asigLeer: una coleccion que falle no rompe la vista.
async function leer(col) {
  try {
    return await listar(col)
  } catch (e) {
    console.warn('Equipos: no se pudo leer', col, e)
    return []
  }
}

// asigCargar: lee las 5 colecciones propias de la pantalla.
async function cargar() {
  const [p, a, d, m, l] = await Promise.all(
    [
      'personasEquipos',
      'asignacionesEquipos',
      'devolucionesEquipos',
      'movimientosEquipos',
      'equiposOficina',
    ].map(leer),
  )
  personas.value = p
  asignaciones.value = a
  devoluciones.value = d
  movimientos.value = m
  legado.value = l
}

// Recarga todo lo que la vista muestra (incluye inventario del store).
async function recargarTodo() {
  await Promise.all([cargar(), datos.recargar('inventario')])
}

onMounted(async () => {
  await cargar()
  cargando.value = false
})

// ---------------------------------------------------------------
// Estadisticas y listas (asigRender y asigRender*, lineas 4224-4238)
// ---------------------------------------------------------------
const stats = computed(() => {
  const asignados = inventario.value.filter((e) => estado(e) === 'Asignado').length
  return {
    equipos: inventario.value.length,
    disponibles: inventario.value.length - asignados,
    asignados,
    personas: personas.value.length,
  }
})

// asigPanel (linea 4223).
function panel(vista) {
  vistaActual.value = vista
}

// asigRender: filas del resumen "Estado actual del inventario".
const filasResumen = computed(() => {
  const q = busqueda.value.toLowerCase()
  return inventario.value.filter((e) =>
    [codigoDe(e), nombreEquipo(e), e.serie, e.asignadoA].join(' ').toLowerCase().includes(q),
  )
})

// asigRenderEquipos: filas de "Equipos del inventario".
const filasEquipos = computed(() => {
  const q = busqueda.value.toLowerCase()
  return inventario.value.filter((e) =>
    [codigoDe(e), nombreEquipo(e), e.serie].join(' ').toLowerCase().includes(q),
  )
})

// asigRenderHistorial: historial completo (asignaciones + registros legacy),
// lo mas reciente primero.
const filasHistorial = computed(() => {
  const antiguos = legado.value.map((e) => ({
    fecha: e.entFecha || '-',
    mov: 'Asignación anterior',
    codigo: e.numInventario || e.codigo || '-',
    persona: e.respNombre || e.entRecibido || '-',
  }))
  const actuales = asignaciones.value.map((a) => ({
    fecha: a.fechaEntrega || '-',
    mov: a.estado === 'Activa' ? 'Asignación' : 'Devolución',
    codigo: a.codigo || '-',
    persona: a.personaNombre || '-',
  }))
  return [...actuales, ...antiguos].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
})

// Columna "Asignado a" del resumen.
function nombreAsignado(e) {
  const a = asignaciones.value.find((x) => x.id === e.asignacionActivaId)
  return a?.personaNombre || e.asignadoA || '-'
}

// Columna "Equipos" de la lista de personas.
function equiposActivosDe(p) {
  return asignaciones.value.filter((a) => a.personaId === p.id && a.estado === 'Activa').length
}

// ---------------------------------------------------------------
// Historial por equipo (asigMostrarHistorial, linea 4239)
// ---------------------------------------------------------------
const modalHistorial = ref(false)
const historialEquipo = ref(null)

const historialDetalle = computed(() => {
  const e = historialEquipo.value
  if (!e) return null
  const key = clave(codigoDe(e))
  const antiguos = legado.value.filter(
    (x) =>
      clave(x.numInventario || x.codigo || x.serie) === key ||
      equipoInventario(x)?.id === e.id ||
      (e.serie && clave(x.serie) === clave(e.serie)),
  )
  const mov = movimientos.value.filter((x) => x.equipoId === e.id || clave(x.codigo) === key)
  return { e, mov, antiguos }
})

function mostrarHistorial(e) {
  if (!e) return
  historialEquipo.value = e
  modalHistorial.value = true
}

// ---------------------------------------------------------------
// Selects de los modales (asigRellenarSelects, linea 4240)
// ---------------------------------------------------------------
const opcionesPersonas = computed(() => personas.value.filter((p) => p.estado !== 'Inactivo'))
const opcionesEquipos = computed(() => inventario.value.filter((e) => estado(e) === 'Disponible'))
const opcionesDevolucion = computed(() => {
  const activas = asignaciones.value.filter((a) => a.estado === 'Activa' && a.origen !== 'equiposOficina')
  const antiguas = legado.value.filter(legadoActivo)
  return [
    ...activas.map((a) => ({ valor: a.id, texto: `${a.codigo} — ${a.personaNombre}` })),
    ...antiguas.map((e) => ({
      valor: `legacy:${e.id}`,
      texto: `${e.numInventario || e.codigo || '-'} — ${e.respNombre || e.entRecibido}`,
    })),
  ]
})

// ---------------------------------------------------------------
// Modales y formularios
// ---------------------------------------------------------------
const modalAsignacion = ref(false)
const modalDevolucion = ref(false)
const modalPersona = ref(false)

const formAsignacion = ref({
  persona: '',
  equipo: '',
  fecha: '',
  responsable: '',
  estadoFisico: 'Bueno',
  accesorios: '',
  observaciones: '',
})
const formDevolucion = ref({
  asignacion: '',
  fecha: '',
  personaDevuelve: '',
  recibe: '',
  estadoFisico: 'Bueno',
  estado: 'Disponible',
  accesorios: '',
  observaciones: '',
})
const formPersona = ref({ nombre: '', documento: '', cargo: '', area: '', correo: '', telefono: '' })

// asigPuedeEditar (linea 4193).
function puedeEditar() {
  return auth.puedeEditarEquipos
}

// asigAbrirAsignacion (linea 4241).
function abrirAsignacion() {
  if (!puedeEditar()) return alert('Acceso administrativo requerido.')
  formAsignacion.value = {
    persona: '',
    equipo: '',
    fecha: hoy(),
    responsable: '',
    estadoFisico: 'Bueno',
    accesorios: '',
    observaciones: '',
  }
  modalAsignacion.value = true
}

// asigAbrirPersona (linea 4242).
function abrirPersona() {
  if (!puedeEditar()) return alert('Acceso administrativo requerido.')
  formPersona.value = { nombre: '', documento: '', cargo: '', area: '', correo: '', telefono: '' }
  modalPersona.value = true
}

// asigAbrirDevolucion (linea 4243).
function abrirDevolucion() {
  if (!puedeEditar()) return alert('Acceso administrativo requerido.')
  formDevolucion.value = {
    asignacion: '',
    fecha: hoy(),
    personaDevuelve: '',
    recibe: '',
    estadoFisico: 'Bueno',
    estado: 'Disponible',
    accesorios: '',
    observaciones: '',
  }
  modalDevolucion.value = true
}

// asigMostrarEquipo (linea 4244): datos del equipo elegido en el modal.
const equipoSeleccionado = computed(
  () => inventario.value.find((x) => x.id === formAsignacion.value.equipo) || null,
)

// asigMostrarDevolucion (linea 4245): resumen de la asignacion a devolver.
const infoDevolucion = computed(() => {
  const v = formDevolucion.value.asignacion
  if (!v) return null
  if (v.startsWith('legacy:')) {
    const e = legado.value.find((x) => x.id === v.slice(7))
    if (!e) return null
    return {
      tipo: 'legacy',
      obj: e,
      texto: `${e.numInventario || '-'} asignado a ${e.respNombre || e.entRecibido || '-'} · Entrega: ${e.entFecha || 'Anterior'} · Accesorios: ${e.entAccesorios || '-'}`,
    }
  }
  const a = asignaciones.value.find((x) => x.id === v)
  if (!a) return null
  return {
    tipo: 'nueva',
    obj: a,
    texto: `${a.codigo} asignado a ${a.personaNombre} · Entrega: ${a.fechaEntrega || '-'} · Accesorios: ${a.accesorios || '-'}`,
  }
})

// Reemplaza el `document.getElementById('asigDevPersona').value = ...` del
// original: al elegir la asignacion se autocompleta "Persona que devuelve".
watch(infoDevolucion, (info) => {
  if (info?.tipo === 'legacy') {
    formDevolucion.value.personaDevuelve = info.obj.respNombre || info.obj.entRecibido || ''
  } else if (info?.tipo === 'nueva') {
    formDevolucion.value.personaDevuelve = info.obj.personaNombre || ''
  }
})

// ---------------------------------------------------------------
// Guardar (asigGuardar*, lineas 4246-4248)
// ---------------------------------------------------------------
// asigGuardarPersona (linea 4246).
async function guardarPersona() {
  if (!puedeEditar()) return
  const f = formPersona.value
  try {
    await crear('personasEquipos', {
      nombre: f.nombre.trim(),
      documento: f.documento.trim(),
      cargo: f.cargo.trim(),
      area: f.area.trim(),
      correo: f.correo.trim(),
      telefono: f.telefono.trim(),
      estado: 'Activo',
      createdBy: auth.usuario?.uid,
      createdByEmail: auth.usuario?.email,
    })
    modalPersona.value = false
    await recargarTodo()
  } catch (err) {
    alert('No se pudo guardar la persona: ' + err.message)
  }
}

// asigGuardarAsignacion (linea 4247): crea la asignacion, el movimiento y
// actualiza el inventario en un solo batch.
async function guardarAsignacion() {
  if (!puedeEditar()) return
  const f = formAsignacion.value
  const e = inventario.value.find((x) => x.id === f.equipo)
  const p = personas.value.find((x) => x.id === f.persona)
  if (!e || !p) return alert('Seleccione persona y equipo.')
  const data = {
    equipoId: e.id,
    codigo: codigoDe(e),
    equipoNombre: nombreEquipo(e),
    personaId: p.id,
    personaNombre: p.nombre,
    fechaEntrega: f.fecha,
    responsableEntrega: f.responsable,
    estadoFisico: f.estadoFisico,
    accesorios: f.accesorios,
    observaciones: f.observaciones,
    estado: 'Activa',
    createdBy: auth.usuario?.uid,
    createdByEmail: auth.usuario?.email,
    createdAt: new Date(),
  }
  try {
    if (estado(e) === 'Asignado') return alert('Este equipo ya está asignado.')
    const batch = writeBatch(db)
    const refAsig = doc(collection(db, 'asignacionesEquipos'))
    const refMov = doc(collection(db, 'movimientosEquipos'))
    batch.set(refAsig, data)
    batch.set(refMov, {
      equipoId: e.id,
      codigo: codigoDe(e),
      personaId: p.id,
      personaNombre: p.nombre,
      tipoMovimiento: 'Asignación',
      informacionAnterior: { estadoGestion: e.estadoGestion || 'Disponible' },
      informacionNueva: { estadoGestion: 'Asignado', asignadoA: p.nombre },
      observaciones: data.observaciones,
      usuario: auth.usuario?.email,
      fecha: data.fechaEntrega,
      createdAt: new Date(),
    })
    batch.update(doc(db, 'inventario', e.id), {
      estadoGestion: 'Asignado',
      asignadoA: p.nombre,
      asignadoAId: p.id,
      asignacionActivaId: refAsig.id,
      asignaciones: [{ nombre: p.nombre, ubicacion: 'En uso' }],
      ubicacionActual: 'En uso',
      updatedAt: new Date(),
    })
    await batch.commit()
    modalAsignacion.value = false
    await recargarTodo()
    alert('Asignación guardada.')
  } catch (err) {
    alert('No se pudo guardar la asignación: ' + err.message)
  }
}

// asigGuardarDevolucion (linea 4248): marca la asignacion (nueva o legacy) como
// devuelta, registra el movimiento y libera el equipo del inventario.
async function guardarDevolucion() {
  if (!puedeEditar()) return
  const f = formDevolucion.value
  const selected = f.asignacion
  if (!selected) return alert('Seleccione una asignación.')
  const newStatus = f.estado
  try {
    const batch = writeBatch(db)
    let codeValue = ''
    let person = ''
    let equipment = null
    let old = null
    if (selected.startsWith('legacy:')) {
      old = legado.value.find((x) => x.id === selected.slice(7))
      if (!old) return alert('No se encontró la asignación.')
      codeValue = old.numInventario || old.codigo || old.serie || ''
      person = old.respNombre || old.entRecibido || ''
      equipment = equipoInventario(old)
      batch.update(doc(db, 'equiposOficina', old.id), {
        devFecha: f.fecha,
        devRecibido: f.recibe,
        devEstado: f.estadoFisico,
        devAccesorios: f.accesorios,
        devObs: f.observaciones,
        updatedAt: new Date(),
      })
      batch.set(
        doc(db, 'asignacionesEquipos', 'legacy_' + old.id),
        { estado: 'Devuelta', fechaDevolucion: f.fecha },
        { merge: true },
      )
    } else {
      const a = asignaciones.value.find((x) => x.id === selected)
      if (!a) return alert('No se encontró la asignación.')
      codeValue = a.codigo
      person = a.personaNombre
      equipment = inventario.value.find((x) => x.id === a.equipoId)
      if (!equipment) return alert('El equipo no está enlazado al inventario.')
      batch.update(doc(db, 'asignacionesEquipos', a.id), {
        estado: 'Devuelta',
        fechaDevolucion: f.fecha,
        updatedAt: new Date(),
      })
    }
    const ret = {
      asignacionId: selected,
      equipoId: equipment?.id || old?.id || null,
      codigo: codeValue,
      personaNombre: person,
      fechaDevolucion: f.fecha,
      personaDevuelve: f.personaDevuelve,
      personaRecibe: f.recibe,
      estadoFisico: f.estadoFisico,
      estadoPosterior: newStatus,
      accesoriosDevueltos: f.accesorios,
      observaciones: f.observaciones,
      asignacionOriginal: old || asignaciones.value.find((x) => x.id === selected),
      createdBy: auth.usuario?.uid,
      createdByEmail: auth.usuario?.email,
      createdAt: new Date(),
    }
    batch.set(doc(collection(db, 'devolucionesEquipos')), ret)
    batch.set(doc(collection(db, 'movimientosEquipos')), {
      equipoId: equipment?.id || old?.id || null,
      codigo: codeValue,
      personaNombre: person,
      tipoMovimiento: 'Devolución',
      informacionAnterior: { estadoGestion: 'Asignado', asignadoA: person },
      informacionNueva: {
        estadoGestion: newStatus,
        ubicacionActual: newStatus === 'Disponible' ? 'Bodega' : newStatus,
      },
      observaciones: ret.observaciones,
      usuario: auth.usuario?.email,
      fecha: ret.fechaDevolucion,
      createdAt: new Date(),
    })
    if (equipment) {
      batch.update(doc(db, 'inventario', equipment.id), {
        estadoGestion: newStatus,
        asignadoA: null,
        asignadoAId: null,
        asignacionActivaId: null,
        asignaciones: [],
        ubicacionActual: newStatus === 'Disponible' ? 'Bodega' : newStatus,
        updatedAt: new Date(),
      })
    }
    await batch.commit()
    modalDevolucion.value = false
    await recargarTodo()
    alert('Devolución registrada.')
  } catch (err) {
    console.error(err)
    alert('No se pudo guardar la devolución: ' + err.message)
  }
}
</script>

<template>
  <div class="container">
    <div class="card">
      <!-- Encabezado (index.html lineas 749-752) -->
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.8rem">
        <div>
          <h2 style="margin: 0">🖥️ Equipos Asignados</h2>
          <p style="margin: 0.2rem 0 0; color: #64748b; font-size: 0.78rem">Gestión conectada al inventario principal</p>
        </div>
        <div style="display: flex; gap: 0.4rem; flex-wrap: wrap">
          <button class="btn btn-primary btn-sm" @click="abrirAsignacion()">+ Nueva asignación</button>
          <button class="btn btn-outline btn-sm" @click="abrirPersona()">+ Persona</button>
          <button class="btn btn-outline btn-sm" @click="abrirDevolucion()">Registrar devolución</button>
        </div>
      </div>

      <!-- Estadisticas: #asigStats (asigRender, linea 4228) -->
      <div class="stats">
        <div class="stat"><div class="num">{{ stats.equipos }}</div><div class="lbl">Equipos</div></div>
        <div class="stat"><div class="num">{{ stats.disponibles }}</div><div class="lbl">Disponibles</div></div>
        <div class="stat"><div class="num">{{ stats.asignados }}</div><div class="lbl">Asignados</div></div>
        <div class="stat"><div class="num">{{ stats.personas }}</div><div class="lbl">Personas</div></div>
      </div>

      <!-- Buscador y botones de panel (linea 754) -->
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.8rem">
        <input v-model="busqueda" placeholder="Buscar código, serial, equipo o persona" style="flex: 1; min-width: 220px" />
        <button class="btn btn-outline btn-sm" @click="panel('resumen')">Resumen</button>
        <button class="btn btn-outline btn-sm" @click="panel('personas')">Personas</button>
        <button class="btn btn-outline btn-sm" @click="panel('equipos')">Equipos</button>
        <button class="btn btn-outline btn-sm" @click="panel('historial')">Historial</button>
      </div>

      <!-- Contenido: #asigContenido (asigRender, lineas 4229-4238) -->
      <div v-if="cargando" class="empty">Cargando equipos...</div>
      <div v-else>
        <!-- asigRenderPersonas (linea 4236) -->
        <template v-if="vistaActual === 'personas'">
          <h3 style="color: #0f3460; font-size: 1rem">Personas y equipos asignados</h3>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Nombre</th><th>Documento</th><th>Área</th><th>Equipos</th></tr>
              </thead>
              <tbody>
                <tr v-for="p in personas" :key="p.id">
                  <td>{{ p.nombre }}</td>
                  <td>{{ p.documento || '-' }}</td>
                  <td>{{ p.area || '-' }}</td>
                  <td>{{ equiposActivosDe(p) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <!-- asigRenderEquipos (linea 4237) -->
        <template v-else-if="vistaActual === 'equipos'">
          <h3 style="color: #0f3460; font-size: 1rem">Equipos del inventario</h3>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Código</th><th>Tipo</th><th>Marca / Modelo</th><th>Serial</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                <tr v-for="e in filasEquipos" :key="e.id">
                  <td>{{ codigoDe(e) }}</td>
                  <td>{{ e.tipo || '-' }}</td>
                  <td>{{ [e.marca, e.modelo].filter(Boolean).join(' ') || '-' }}</td>
                  <td>{{ e.serie || '-' }}</td>
                  <td>{{ estado(e) }}</td>
                  <td><button class="btn btn-outline btn-sm" @click="mostrarHistorial(e)">Historial</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <!-- asigRenderHistorial (linea 4238) -->
        <template v-else-if="vistaActual === 'historial'">
          <h3 style="color: #0f3460; font-size: 1rem">Historial completo de asignaciones</h3>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Fecha</th><th>Movimiento</th><th>Código</th><th>Persona</th></tr>
              </thead>
              <tbody>
                <tr v-for="(r, i) in filasHistorial" :key="i">
                  <td>{{ r.fecha }}</td>
                  <td>{{ r.mov }}</td>
                  <td>{{ r.codigo }}</td>
                  <td>{{ r.persona }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <!-- asigRender, resumen (linea 4234) -->
        <template v-else>
          <h3 style="color: #0f3460; font-size: 1rem">Estado actual del inventario</h3>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Equipo</th><th>Código</th><th>Serial</th><th>Estado</th><th>Asignado a</th><th>Acción</th></tr>
              </thead>
              <tbody>
                <tr v-for="e in filasResumen" :key="e.id">
                  <td>{{ nombreEquipo(e) }}</td>
                  <td>{{ codigoDe(e) }}</td>
                  <td>{{ e.serie || '-' }}</td>
                  <td><span class="badge" :class="claseEstado(estado(e))">{{ estado(e) }}</span></td>
                  <td>{{ nombreAsignado(e) }}</td>
                  <td><button class="btn btn-outline btn-sm" @click="mostrarHistorial(e)">Ver historial</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>
    </div>

    <!-- Modal #asigModalAsignacion (linea 759) -->
    <BaseModal :abierto="modalAsignacion" ancho="680px" @cerrar="modalAsignacion = false">
      <h2>Nueva asignación</h2>
      <form @submit.prevent="guardarAsignacion">
        <div>
          <label>Persona</label>
          <select v-model="formAsignacion.persona" required>
            <option value="">Seleccione...</option>
            <option v-for="p in opcionesPersonas" :key="p.id" :value="p.id">
              {{ p.nombre }} — {{ p.documento || '' }}
            </option>
          </select>
        </div>
        <div>
          <label>Equipo disponible</label>
          <select v-model="formAsignacion.equipo" required>
            <option value="">Seleccione...</option>
            <option v-for="e in opcionesEquipos" :key="e.id" :value="e.id">
              {{ codigoDe(e) }} — {{ nombreEquipo(e) }}
            </option>
          </select>
        </div>
        <div><label>Fecha de entrega</label><input v-model="formAsignacion.fecha" type="date" required /></div>
        <div><label>Responsable de entrega</label><input v-model="formAsignacion.responsable" required /></div>
        <div>
          <label>Estado físico</label>
          <select v-model="formAsignacion.estadoFisico">
            <option>Bueno</option>
            <option>Regular</option>
            <option>Con novedades</option>
          </select>
        </div>
        <div><label>Accesorios</label><input v-model="formAsignacion.accesorios" /></div>
        <div class="full">
          <!-- #asigEquipoInfo (asigMostrarEquipo, linea 4244) -->
          <div class="notice">
            <template v-if="equipoSeleccionado">
              <strong>{{ nombreEquipo(equipoSeleccionado) }}</strong> · Código {{ codigoDe(equipoSeleccionado) }} ·
              Serial {{ equipoSeleccionado.serie || '-' }} · Estado {{ equipoSeleccionado.estado || '-' }} · Ubicación
              {{ equipoSeleccionado.ubicacion || '-' }}
            </template>
            <template v-else>Seleccione un equipo para cargar sus datos del inventario.</template>
          </div>
        </div>
        <div class="full"><label>Observaciones</label><textarea v-model="formAsignacion.observaciones" rows="2" /></div>
        <div class="full" style="display: flex; justify-content: flex-end; gap: 0.5rem">
          <button type="button" class="btn btn-outline" @click="modalAsignacion = false">Cancelar</button>
          <button class="btn btn-primary">Guardar</button>
        </div>
      </form>
    </BaseModal>

    <!-- Modal #asigModalDevolucion (linea 760) -->
    <BaseModal :abierto="modalDevolucion" ancho="680px" @cerrar="modalDevolucion = false">
      <h2>Registrar devolución</h2>
      <form @submit.prevent="guardarDevolucion">
        <div class="full">
          <label>Asignación activa</label>
          <select v-model="formDevolucion.asignacion" required>
            <option value="">Seleccione...</option>
            <option v-for="o in opcionesDevolucion" :key="o.valor" :value="o.valor">{{ o.texto }}</option>
          </select>
        </div>
        <div class="full">
          <!-- #asigDevolucionInfo (asigMostrarDevolucion, linea 4245) -->
          <div class="notice">{{ infoDevolucion ? infoDevolucion.texto : 'Seleccione una asignación.' }}</div>
        </div>
        <div><label>Fecha devolución</label><input v-model="formDevolucion.fecha" type="date" required /></div>
        <div><label>Persona que devuelve</label><input v-model="formDevolucion.personaDevuelve" required /></div>
        <div><label>Persona que recibe</label><input v-model="formDevolucion.recibe" required /></div>
        <div>
          <label>Estado físico</label>
          <select v-model="formDevolucion.estadoFisico">
            <option>Bueno</option>
            <option>Regular</option>
            <option>Dañado</option>
          </select>
        </div>
        <div>
          <label>Estado posterior</label>
          <select v-model="formDevolucion.estado">
            <option>Disponible</option>
            <option>Mantenimiento</option>
            <option>Dañado</option>
          </select>
        </div>
        <div class="full"><label>Accesorios devueltos</label><input v-model="formDevolucion.accesorios" /></div>
        <div class="full"><label>Observaciones</label><textarea v-model="formDevolucion.observaciones" rows="2" /></div>
        <div class="full" style="display: flex; justify-content: flex-end; gap: 0.5rem">
          <button type="button" class="btn btn-outline" @click="modalDevolucion = false">Cancelar</button>
          <button class="btn btn-primary">Guardar devolución</button>
        </div>
      </form>
    </BaseModal>

    <!-- Modal #asigModalPersona (linea 761) -->
    <BaseModal :abierto="modalPersona" ancho="600px" @cerrar="modalPersona = false">
      <h2>Nueva persona</h2>
      <form @submit.prevent="guardarPersona">
        <div class="full"><label>Nombre completo</label><input v-model="formPersona.nombre" required /></div>
        <div><label>Documento</label><input v-model="formPersona.documento" required /></div>
        <div><label>Cargo</label><input v-model="formPersona.cargo" /></div>
        <div><label>Área</label><input v-model="formPersona.area" /></div>
        <div><label>Correo</label><input v-model="formPersona.correo" type="email" /></div>
        <div><label>Teléfono</label><input v-model="formPersona.telefono" /></div>
        <div class="full" style="display: flex; justify-content: flex-end; gap: 0.5rem">
          <button type="button" class="btn btn-outline" @click="modalPersona = false">Cancelar</button>
          <button class="btn btn-primary">Guardar persona</button>
        </div>
      </form>
    </BaseModal>

    <!-- Modal #asigModalHistorial (linea 762) -->
    <BaseModal :abierto="modalHistorial" ancho="780px" @cerrar="modalHistorial = false">
      <h2>Historial: {{ historialEquipo ? codigoDe(historialEquipo) : 'Equipo' }}</h2>
      <template v-if="historialDetalle">
        <div class="notice">
          <strong>{{ nombreEquipo(historialDetalle.e) }}</strong><br />
          Código: {{ codigoDe(historialDetalle.e) }} · Serial: {{ historialDetalle.e.serie || '-' }} · Estado:
          {{ estado(historialDetalle.e) }}
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Fecha</th><th>Movimiento</th><th>Persona</th><th>Observaciones</th></tr>
            </thead>
            <tbody>
              <!-- Movimientos propios del equipo -->
              <tr v-for="(x, i) in historialDetalle.mov" :key="'m' + i">
                <td>{{ x.fecha || '-' }}</td>
                <td>{{ x.tipoMovimiento }}</td>
                <td>{{ x.personaNombre || '-' }}</td>
                <td>{{ x.observaciones || '-' }}</td>
              </tr>
              <!-- Registros legacy de equiposOficina -->
              <tr v-for="(x, i) in historialDetalle.antiguos" :key="'o' + i">
                <td>{{ x.entFecha || '-' }}</td>
                <td>Registro anterior</td>
                <td>{{ x.respNombre || x.entRecibido || '-' }}</td>
                <td>{{ x.entObs || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <div style="display: flex; justify-content: flex-end">
        <button class="btn btn-outline" @click="modalHistorial = false">Cerrar</button>
      </div>
    </BaseModal>
  </div>
</template>

<style scoped>
/* .notice viene del <style> de asignaciones-equipos.html (linea 60). */
.notice {
  padding: 0.7rem;
  border-radius: 8px;
  background: #eff6ff;
  color: #1e40af;
  font-size: 0.78rem;
  margin-bottom: 0.75rem;
}

/* .badge-red no existia ni en base.css ni en el original, pero asigClaseEstado()
   ya devolvia esa clase para el estado "Dañado": se define aqui. */
.badge-red {
  background: #fee2e2;
  color: #991b1b;
}
</style>

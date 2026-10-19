<script setup>
// Inventario Eq. (tab "Inventario Equipos de Oficina").
//
// Traduccion del tab `tabInvEquipos` de index.html (lineas 764-789), de sus dos
// modales `modalInv` (791-847) y `modalTipo` (849-857) y del bloque de JS
// "INVENTARIO (agrupado por Referencia)" (lineas 3704-4154).
//
// Lo que el original resolvia generando el HTML a mano desde la variable global
// `inventario` y leyendo los inputs por su id, aqui se resuelve con estado
// reactivo, `computed` y `v-model`:
//  - renderInventario() -> los computed `stats` y `grupos`
//  - invFiltrar()       -> computed `inventarioFiltrado`
//  - poblarFiltroRef()  -> computed `refsOrdenadas`
//  - toggleInvSeccion() -> `colapsadas` en memoria (el original lo persistia en el navegador)
import { computed, ref } from 'vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { actualizar, crear, eliminar } from '@/services/firestore'
import { useDatosStore } from '@/stores/datos'
import { INV_TIPOS, invRef, invTipoIcono } from '@/utils/inventario'

const datos = useDatosStore()

// inventario ya viene normalizado desde el store (normalizarInventario).
const inventario = computed(() => datos.inventario)

// ---------------------------------------------------------------
// Helpers de clasificacion (index.html 3731-3751 y 3967-3980)
// ---------------------------------------------------------------

// invAsignaciones (3967)
function invAsignaciones(e) {
  if (Array.isArray(e.asignaciones) && e.asignaciones.length) {
    return e.asignaciones
  }
  const lista = []
  if (e.asignadoA || e.ubicacion) {
    lista.push({ nombre: e.asignadoA || '', ubicacion: e.ubicacion || '' })
  }
  return lista
}

// invEstaAsignado (3978)
function invEstaAsignado(e) {
  return invAsignaciones(e).some((a) => a.nombre || a.ubicacion)
}

// invEsComun (3731)
function invEsComun(e) {
  if (e.controlTipo) return e.controlTipo === 'comun'
  if (e.requiereAsignacion !== undefined) return !e.requiereAsignacion
  if (invAsignaciones(e).some((a) => a.nombre)) return false
  return ['Silla', 'Escritorio'].includes(e.tipo)
}

// invUnidades (3738) / invUnidadesAsignadas (3739) / invSituacion (3740)
function invUnidades(e) {
  return Math.max(1, parseInt(e.existencias) || 1)
}
function invUnidadesAsignadas(e) {
  return invEstaAsignado(e) ? invUnidades(e) : 0
}
function invSituacion(e) {
  if (invEsComun(e)) return 'Uso común'
  return invEstaAsignado(e) ? 'Asignado' : 'Disponible'
}

// invEstadoGarantia (3745). El original definia esta funcion y el CSS
// `.inv-garantia-*`, pero no la usaba en ninguna pantalla; aqui se muestra el
// badge junto al Estado cuando el documento trae `garantia`.
function invEstadoGarantia(fechaGarantia) {
  if (!fechaGarantia) return { texto: '', clase: '' }
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const fin = new Date(fechaGarantia + 'T00:00:00')
  if (fin >= hoy) return { texto: 'Garantía vigente', clase: 'inv-garantia-vigente' }
  return { texto: 'Garantía vencida', clase: 'inv-garantia-vencida' }
}

// Texto de una asignacion tal como lo armaba el renderInventario (3871-3876).
function textoAsignacion(a) {
  const partes = []
  if (a.nombre) partes.push('👤 ' + a.nombre)
  if (a.ubicacion) partes.push('📍 ' + a.ubicacion)
  return partes.join(' · ') || '—'
}

// invRefs (3753): una entrada por referencia distinta.
const refsInventario = computed(() => {
  const map = {}
  inventario.value.forEach((e) => {
    const ref = invRef(e)
    if (!map[ref]) map[ref] = { referencia: ref, nombreRef: e.nombreRef || ref }
  })
  return Object.values(map)
})

// poblarFiltroRef (3762): opciones del select de referencias, ordenadas.
const refsOrdenadas = computed(() =>
  [...refsInventario.value].sort((a, b) => (a.referencia || '').localeCompare(b.referencia || '')),
)

// ---------------------------------------------------------------
// Filtros (invFiltrar, 3771)
// ---------------------------------------------------------------
const filtroBusqueda = ref('')
const filtroRef = ref('')
const filtroAsig = ref('')

const inventarioFiltrado = computed(() => {
  const busqueda = filtroBusqueda.value.toLowerCase()
  return inventario.value.filter((e) => {
    if (busqueda) {
      const asigs = invAsignaciones(e)
        .map((a) => a.nombre + ' ' + a.ubicacion)
        .join(' ')
      const txt = [
        e.referencia,
        e.codigo,
        e.nombreRef,
        e.modelo,
        e.marca,
        e.tipo,
        e.serie,
        e.proveedor,
        e.ubicacion,
        e.espec,
        asigs,
      ]
        .join(' ')
        .toLowerCase()
      if (!txt.includes(busqueda)) return false
    }
    if (filtroRef.value && invRef(e) !== filtroRef.value) return false
    if (filtroAsig.value === 'asignable' && invEsComun(e)) return false
    if (filtroAsig.value === 'comun' && !invEsComun(e)) return false
    if (filtroAsig.value === 'asignado' && (invEsComun(e) || !invEstaAsignado(e))) return false
    if (filtroAsig.value === 'disponible' && (invEsComun(e) || invEstaAsignado(e))) return false
    return true
  })
})

// ---------------------------------------------------------------
// Estadisticas (renderInventario, 3796-3813)
// ---------------------------------------------------------------
const stats = computed(() => {
  const filtrados = inventarioFiltrado.value
  const totalUnidades = filtrados.reduce((s, e) => s + invUnidades(e), 0)
  const asignables = filtrados.filter((e) => !invEsComun(e))
  const comunes = filtrados.filter((e) => invEsComun(e))
  const unidadesAsignadas = asignables.reduce((s, e) => s + invUnidadesAsignadas(e), 0)
  const unidadesDisponibles = asignables.reduce(
    (s, e) => s + (invUnidades(e) - invUnidadesAsignadas(e)),
    0,
  )
  const unidadesComunes = comunes.reduce((s, e) => s + invUnidades(e), 0)
  const valorTotal = filtrados.reduce(
    (sum, e) => sum + (parseInt(e.existencias) || 1) * (parseFloat(e.valor) || 0),
    0,
  )
  return {
    totalUnidades,
    unidadesAsignadas,
    unidadesDisponibles,
    unidadesComunes,
    totalModelos: filtrados.length,
    valorTotalTexto: valorTotal > 0 ? '$' + valorTotal.toLocaleString('es-CO') : '$0',
  }
})

// ---------------------------------------------------------------
// Agrupacion en secciones (renderInventario, 3819-3895)
// Se agrupa primero por forma de control (asignable / comun) y luego por tipo.
// ---------------------------------------------------------------
const grupos = computed(() => {
  const agrupados = { asignable: {}, comun: {} }
  inventarioFiltrado.value.forEach((e) => {
    const control = invEsComun(e) ? 'comun' : 'asignable'
    const tipo = e.tipo || 'Otros'
    if (!agrupados[control][tipo]) agrupados[control][tipo] = []
    agrupados[control][tipo].push(e)
  })

  const lista = []
  for (const control of ['asignable', 'comun']) {
    const tiposKey = Object.keys(agrupados[control]).sort((a, b) => a.localeCompare(b))
    if (!tiposKey.length) continue
    const esAsignable = control === 'asignable'
    lista.push({
      control,
      esAsignable,
      icono: esAsignable ? '👤' : '🏢',
      titulo: esAsignable ? 'Activos asignables' : 'Elementos de uso común',
      subtitulo: esAsignable
        ? 'Equipos que pueden estar bajo responsabilidad de un empleado'
        : 'Elementos compartidos controlados por cantidad y ubicación',
      colorTitulo: esAsignable ? '#1e40af' : '#166534',
      bannerStyle: {
        margin: '1.25rem 0 .65rem',
        padding: '.75rem 1rem',
        background: esAsignable ? '#eff6ff' : '#f0fdf4',
        border: '1px solid ' + (esAsignable ? '#bfdbfe' : '#bbf7d0'),
        borderRadius: '10px',
      },
      tipos: tiposKey.map((tipoKey) => {
        const items = agrupados[control][tipoKey]
        const totalUni = items.reduce((s, e) => s + invUnidades(e), 0)
        const totalValor = items.reduce(
          (s, e) => s + (parseInt(e.existencias) || 1) * (parseFloat(e.valor) || 0),
          0,
        )
        return {
          tipoKey,
          items,
          totalUni,
          totalValorTexto: totalValor > 0 ? '$' + totalValor.toLocaleString('es-CO') : '$0',
          clave: control + '_' + tipoKey,
        }
      }),
    })
  }
  return lista
})

// ---------------------------------------------------------------
// Secciones colapsables (toggleInvSeccion, 3957)
// El original persistia el estado por seccion con la clave "invCol_<key>"; por la
// regla de migracion (sin almacenamiento local) se conserva solo en memoria.
// ---------------------------------------------------------------
const colapsadas = ref({})
function estaColapsada(clave) {
  return !!colapsadas.value[clave]
}
function toggleInvSeccion(clave) {
  colapsadas.value[clave] = !colapsadas.value[clave]
}

// ---------------------------------------------------------------
// Estado del modal de alta/edicion (abrirModalInv: 4017)
// ---------------------------------------------------------------
const modalInv = ref(false)
const form = ref({})

// ---------------------------------------------------------------
// Tipos de equipo (INV_TIPOS: 3913-3927). Viven en @/utils/inventario junto con
// invTipoIcono, para no repetir la tabla de iconos en cada vista.
// ---------------------------------------------------------------

// invActualizarBtnTipo (3934) -> texto del boton que abre el modal de tipo.
const tipoTexto = computed(() => {
  const t = INV_TIPOS.find((x) => x.valor === form.value.tipo)
  return t ? t.icono + ' ' + t.etiqueta : 'Tipo de equipo'
})

// abrirTipoModal (3941) / seleccionarTipo (3951)
const modalTipo = ref(false)
function abrirTipoModal() {
  modalTipo.value = true
}
function seleccionarTipo(valor) {
  form.value.tipo = valor
  modalTipo.value = false
}

// ---------------------------------------------------------------
// Modal de alta/edicion (abrirModalInv: 4017, abrirModalInvTipo: 4050)
// ---------------------------------------------------------------

// invRenderAsignaciones (3998): si la lista viene vacia se deja una fila en blanco.
function filasAsignacion(lista) {
  const items = lista && lista.length ? lista : [{}]
  return items.map((a) => ({ nombre: a.nombre || '', ubicacion: a.ubicacion || '' }))
}

function abrirModalInv(e, refKey) {
  if (e) {
    form.value = {
      id: e.id,
      referencia: e.referencia || '',
      modelo: e.modelo || '',
      existencias: e.existencias || 1,
      tipo: e.tipo || '',
      marca: e.marca || '',
      serie: e.serie || '',
      estado: e.estado || '',
      controlTipo: invEsComun(e) ? 'comun' : 'asignable',
      fechaCompra: e.fechaCompra || '',
      valor: e.valor || '',
      proveedor: e.proveedor || '',
      garantia: e.garantia || null,
      espec: e.espec || '',
      obs: e.obs || '',
      asignaciones: filasAsignacion(invAsignaciones(e)),
    }
  } else {
    // Equivale al formInv.reset() + valores por defecto del original (4036-4042).
    form.value = {
      id: null,
      referencia: refKey || '',
      modelo: '',
      existencias: 1,
      tipo: '',
      marca: '',
      serie: '',
      estado: '',
      controlTipo: 'asignable',
      fechaCompra: '',
      valor: '',
      proveedor: '',
      garantia: null,
      espec: '',
      obs: '',
      asignaciones: filasAsignacion([]),
    }
  }
  modalInv.value = true
}

// editarInv (4048)
function editarInv(e) {
  abrirModalInv(e)
}

// abrirModalInvTipo (4050): abre el modal ya con el tipo de la seccion.
function abrirModalInvTipo(tipo) {
  abrirModalInv()
  form.value.tipo = tipo || ''
}

// cerrarModalInv (4121)
function cerrarModalInv() {
  modalInv.value = false
}

// invAgregarAsignacion (3982) / borrado de una fila (this.closest('div').remove())
function invAgregarAsignacion() {
  form.value.asignaciones.push({ nombre: '', ubicacion: '' })
}
function quitarAsignacion(i) {
  form.value.asignaciones.splice(i, 1)
}

// invLeerAsignaciones (4006)
function invLeerAsignaciones() {
  return form.value.asignaciones
    .map((f) => ({ nombre: (f.nombre || '').trim(), ubicacion: (f.ubicacion || '').trim() }))
    .filter((f) => f.nombre || f.ubicacion)
}

// seleccionarRefExistente (3901): el original pedia el numero por prompt().
function seleccionarRefExistente() {
  const refs = [...refsInventario.value]
    .filter((r) => r.referencia)
    .sort((a, b) => a.referencia.localeCompare(b.referencia))
  if (!refs.length) {
    alert('No hay referencias existentes. Crea una nueva escribiendo el código.')
    return
  }
  const opts = refs.map((r, i) => i + 1 + '. ' + r.referencia + ' — ' + r.nombreRef).join('\n')
  const idx = prompt('Selecciona una referencia existente (número):\n\n' + opts)
  if (idx === null) return
  const num = parseInt(idx)
  if (isNaN(num) || num < 1 || num > refs.length) {
    alert('Número inválido')
    return
  }
  form.value.referencia = refs[num - 1].referencia
}

// ---------------------------------------------------------------
// Guardar (guardarInv, 4056)
// ---------------------------------------------------------------
async function guardarInv() {
  const f = form.value
  const refCodigo = f.referencia
  const refExist = inventario.value.find((r) => r.referencia === refCodigo && r.nombreRef)
  // El tipo se elige en el modal de tipos: si falta, se abre el selector.
  if (!f.tipo) {
    alert('Selecciona el tipo de equipo')
    abrirTipoModal()
    return
  }
  const obj = {
    referencia: refCodigo,
    nombreRef: refExist ? refExist.nombreRef : refCodigo,
    modelo: f.modelo,
    existencias: parseInt(f.existencias) || 1,
    tipo: f.tipo,
    marca: f.marca,
    serie: f.serie,
    estado: f.estado,
    controlTipo: f.controlTipo || 'asignable',
    fechaCompra: f.fechaCompra || null,
    valor: f.valor,
    proveedor: f.proveedor,
    // garantia y espec no se editan en el formulario: se conservan del documento.
    garantia: f.garantia || null,
    asignaciones: invLeerAsignaciones(),
    espec: f.espec || '',
    obs: f.obs,
  }
  if (f.id) await actualizar('inventario', f.id, obj)
  else await crear('inventario', obj)
  await datos.recargar('inventario')
  modalInv.value = false
}

// eliminarInv (4110)
async function eliminarInv(e) {
  if (!confirm('Eliminar este modelo del inventario?')) return
  await eliminar('inventario', e.id)
  await datos.recargar('inventario')
}

// ---------------------------------------------------------------
// exportarReporteInv (4125): el original armaba un .txt y lo descargaba.
// ---------------------------------------------------------------
function exportarReporteInv() {
  const refs = [...refsInventario.value].sort((a, b) => a.referencia.localeCompare(b.referencia))
  if (!refs.length) {
    alert('No hay datos para exportar')
    return
  }
  let texto = '=== REPORTE DE INVENTARIO ===\n'
  texto += 'Fecha: ' + new Date().toLocaleDateString('es-CO') + '\n\n'
  let granTotalUds = 0,
    granTotalValor = 0
  for (const r of refs) {
    const items = inventario.value.filter((e) => e.referencia === r.referencia)
    const totalUds = items.reduce((s, e) => s + (parseInt(e.existencias) || 1), 0)
    const totalValor = items.reduce(
      (s, e) => s + (parseInt(e.existencias) || 1) * (parseFloat(e.valor) || 0),
      0,
    )
    granTotalUds += totalUds
    granTotalValor += totalValor
    texto += '--- ' + r.referencia + ' — ' + (r.nombreRef || '') + ' ---\n'
    texto += 'Total: ' + totalUds + ' unidades · $' + totalValor.toLocaleString('es-CO') + '\n'
    for (const e of items) {
      const asigs = invAsignaciones(e)
      const asigTxt = asigs.length
        ? asigs
            .map(
              (a) =>
                (a.nombre || '') + (a.nombre && a.ubicacion ? ' @ ' : '') + (a.ubicacion || ''),
            )
            .join('; ')
        : '(sin asignar)'
      texto +=
        '  • ' +
        (e.modelo || '?') +
        ' x' +
        (parseInt(e.existencias) || 1) +
        ' | ' +
        (e.marca || '') +
        ' | ' +
        (e.estado || '') +
        ' | Asignado a: ' +
        asigTxt +
        '\n'
    }
    texto += '\n'
  }
  texto += '================================\n'
  texto +=
    'RESUMEN: ' +
    refs.length +
    ' referencias, ' +
    granTotalUds +
    ' unidades totales, $' +
    granTotalValor.toLocaleString('es-CO') +
    '\n'
  // document.* permitido solo aqui: el link temporal de descarga del original.
  const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'inventario_' + new Date().toISOString().split('T')[0] + '.txt'
  a.click()
  URL.revokeObjectURL(a.href)
}
</script>

<template>
  <div>
    <!-- ============ CABECERA (index.html 765-771) ============ -->
    <div class="inv-header">
      <div>
        <h2>📋 Inventario Equipos de Oficina</h2>
        <p>Agrupado por referencia — cada referencia tiene uno o varios modelos</p>
      </div>
      <button class="btn btn-primary" @click="abrirModalInv()">+ Agregar Equipo</button>
    </div>

    <!-- ============ ESTADISTICAS (renderInventario 3806-3813) ============ -->
    <div class="inv-stats">
      <div class="inv-stat inv-stat-total">
        <div class="inv-stat-icon">📦</div>
        <div class="inv-stat-num">{{ stats.totalUnidades }}</div>
        <div class="inv-stat-lbl">Activos totales</div>
      </div>
      <div class="inv-stat inv-stat-nuevos">
        <div class="inv-stat-icon">👤</div>
        <div class="inv-stat-num">{{ stats.unidadesAsignadas }}</div>
        <div class="inv-stat-lbl">Asignados</div>
      </div>
      <div class="inv-stat inv-stat-usados">
        <div class="inv-stat-icon">✅</div>
        <div class="inv-stat-num">{{ stats.unidadesDisponibles }}</div>
        <div class="inv-stat-lbl">Disponibles</div>
      </div>
      <div class="inv-stat inv-stat-sinasig">
        <div class="inv-stat-icon">🏢</div>
        <div class="inv-stat-num">{{ stats.unidadesComunes }}</div>
        <div class="inv-stat-lbl">Uso común</div>
      </div>
      <div class="inv-stat">
        <div class="inv-stat-icon">📋</div>
        <div class="inv-stat-num">{{ stats.totalModelos }}</div>
        <div class="inv-stat-lbl">Registros</div>
      </div>
      <div class="inv-stat inv-stat-valor">
        <div class="inv-stat-icon">💰</div>
        <div class="inv-stat-num">{{ stats.valorTotalTexto }}</div>
        <div class="inv-stat-lbl">Valor Total</div>
      </div>
    </div>

    <!-- ============ FILTROS (index.html 773-787 + invFiltrar 3771) ============ -->
    <div class="inv-filtros">
      <span class="filtros-label">🔍 Buscar:</span>
      <input
        v-model="filtroBusqueda"
        type="text"
        placeholder="Referencia, modelo, marca, responsable..."
      />
      <select v-model="filtroRef">
        <option value="">Todas las referencias</option>
        <option v-for="r in refsOrdenadas" :key="r.referencia" :value="r.referencia">
          {{ r.referencia }} — {{ r.nombreRef }}
        </option>
      </select>
      <select v-model="filtroAsig">
        <option value="">Todos</option>
        <option value="asignable">🧾 Activos asignables</option>
        <option value="comun">🏢 Elementos de uso común</option>
        <option value="asignado">👤 Asignados</option>
        <option value="disponible">✅ Disponibles</option>
      </select>
      <button
        class="btn btn-sm btn-outline"
        style="font-size: 0.72rem; margin-left: auto"
        title="Exportar reporte"
        @click="exportarReporteInv()"
      >
        📊 Reporte
      </button>
    </div>

    <!-- ============ ESTADO VACIO (renderInventario 3814-3817) ============ -->
    <div
      v-if="!inventarioFiltrado.length"
      class="empty"
      style="
        text-align: center;
        padding: 3rem 1rem;
        color: #9ca3af;
        background: #fff;
        border-radius: 14px;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.07);
      "
    >
      <div style="font-size: 2.5rem; margin-bottom: 0.5rem">📋</div>
      <p style="font-size: 0.95rem">
        {{ inventario.length ? 'No se encontraron modelos con estos filtros' : 'No hay modelos registrados' }}
      </p>
      <button
        v-if="!inventario.length"
        class="btn btn-primary btn-sm"
        style="margin-top: 0.75rem"
        @click="abrirModalInv()"
      >
        + Agregar primer equipo
      </button>
    </div>

    <!-- ============ LISTADO AGRUPADO (renderInventario 3819-3898) ============ -->
    <template v-for="grupo in grupos" :key="grupo.control">
      <div :style="grupo.bannerStyle">
        <strong :style="{ color: grupo.colorTitulo }">
          {{ grupo.icono }} {{ grupo.titulo }}
        </strong>
        <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.2rem">
          {{ grupo.subtitulo }}
        </div>
      </div>

      <div
        v-for="tipo in grupo.tipos"
        :key="tipo.clave"
        class="seccion-card"
        style="border-left-color: #0f3460; padding: 1rem"
      >
        <h3
          :style="{ marginBottom: estaColapsada(tipo.clave) ? '0' : '.5rem' }"
          @click="toggleInvSeccion(tipo.clave)"
        >
          <span class="left">
            <span class="toggle" :class="{ collapsed: estaColapsada(tipo.clave) }">▼</span>
            {{ invTipoIcono(tipo.tipoKey) }} <strong>{{ tipo.tipoKey }}</strong>
            <span style="font-size: 0.75rem; color: #6b7280; font-weight: 400">
              ({{ tipo.items.length }} equipos · {{ tipo.totalUni }} uds ·
              {{ tipo.totalValorTexto }})
            </span>
          </span>
          <button
            class="btn btn-primary btn-sm"
            style="font-size: 0.7rem; padding: 0.3rem 0.6rem"
            @click.stop="abrirModalInvTipo(tipo.tipoKey)"
          >
            + Agregar {{ tipo.tipoKey }}
          </button>
        </h3>

        <div class="content" :class="{ collapsed: estaColapsada(tipo.clave) }">
          <div class="inv-table-wrap">
            <table class="inv-table">
              <thead>
                <tr>
                  <th style="width: 34px"></th>
                  <th>Código de Referencia</th>
                  <th>Modelo</th>
                  <th>Marca</th>
                  <th style="width: 60px" class="td-center">Cantidad</th>
                  <th>Estado</th>
                  <th>{{ grupo.esAsignable ? 'Situación / responsable' : 'Ubicación / control' }}</th>
                  <th style="text-align: right">Valor Und.</th>
                  <th style="text-align: right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="e in tipo.items"
                  :key="e.id"
                  :class="{ 'sin-asignar': grupo.esAsignable && !invEstaAsignado(e) }"
                >
                  <td class="inv-item-icon">{{ invTipoIcono(e.tipo) }}</td>
                  <td class="inv-modelo-cell">{{ invRef(e) }}</td>
                  <td class="inv-modelo-cell">
                    {{ e.modelo || '—' }}
                    <div
                      v-if="e.serie"
                      style="font-size: 0.65rem; color: #9ca3af; font-weight: 400"
                    >
                      SN: {{ e.serie }}
                    </div>
                  </td>
                  <td>{{ e.marca || '—' }}</td>
                  <td class="td-num">{{ invUnidades(e) }}</td>
                  <td>
                    <span
                      v-if="e.estado"
                      :class="e.estado === 'Nuevo' ? 'badge-green' : 'badge-yellow'"
                      style="padding: 0.1rem 0.4rem; border-radius: 999px; font-size: 0.65rem"
                    >
                      {{ e.estado }}
                    </span>
                    <span v-else>—</span>
                    <span
                      v-if="e.garantia"
                      class="inv-garantia-badge"
                      :class="invEstadoGarantia(e.garantia).clase"
                      style="margin-left: 0.3rem"
                    >
                      {{ invEstadoGarantia(e.garantia).texto }}
                    </span>
                  </td>
                  <td style="max-width: 220px">
                    <!-- Situación / responsable (3868-3879) -->
                    <template v-if="!grupo.esAsignable">
                      <span style="color: #166534; font-size: 0.7rem">🏢 {{ invSituacion(e) }}</span>
                      <div v-if="e.ubicacion" style="font-size: 0.7rem; color: #64748b">
                        📍 {{ e.ubicacion }}
                      </div>
                    </template>
                    <template v-else-if="invAsignaciones(e).length">
                      <div
                        v-for="(a, i) in invAsignaciones(e)"
                        :key="i"
                        style="white-space: nowrap; font-size: 0.7rem; line-height: 1.4"
                      >
                        {{ textoAsignacion(a) }}
                      </div>
                    </template>
                    <template v-else>
                      <span style="color: #2563eb; font-size: 0.7rem">
                        ✅ Disponible · sin responsable
                      </span>
                    </template>
                  </td>
                  <td style="text-align: right; white-space: nowrap">
                    {{ e.valor ? '$' + Number(e.valor).toLocaleString('es-CO') : '—' }}
                  </td>
                  <td class="inv-col-acc">
                    <button
                      class="btn btn-sm btn-outline"
                      style="font-size: 0.65rem; padding: 0.2rem 0.4rem"
                      @click="editarInv(e)"
                    >
                      Editar
                    </button>
                    <button
                      class="btn btn-sm btn-danger"
                      style="font-size: 0.65rem; padding: 0.2rem 0.4rem"
                      @click="eliminarInv(e)"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>

    <!-- ============ MODAL AGREGAR / EDITAR (modalInv, index.html 791-847) ============ -->
    <BaseModal :abierto="modalInv" ancho="700px" @cerrar="cerrarModalInv()">
      <h2 style="font-size: 1.1rem; margin-bottom: 1rem; color: #0f3460">
        {{ form.id ? 'Editar Modelo' : 'Agregar Equipo' }}
      </h2>
      <form @submit.prevent="guardarInv">
        <div class="inv-modal-section">🔑 Código de Referencia</div>
        <div class="full">
          <div style="display: flex; gap: 0.3rem">
            <input
              v-model="form.referencia"
              placeholder="Ej: MON-DELL"
              required
              style="flex: 1"
            />
            <button
              type="button"
              class="btn btn-sm btn-outline"
              title="Seleccionar referencia existente"
              @click="seleccionarRefExistente()"
            >
              📋
            </button>
          </div>
        </div>
        <div><label>Modelo</label><input v-model="form.modelo" placeholder="Ej: P2419H" required /></div>
        <div>
          <label>Existencias (stock)</label>
          <input
            v-model="form.existencias"
            type="number"
            placeholder="Cantidad"
            min="1"
            required
          />
        </div>
        <div>
          <label>Tipo de Equipo</label>
          <button
            type="button"
            class="btn btn-outline"
            style="
              width: 100%;
              text-align: left;
              display: flex;
              align-items: center;
              gap: 0.4rem;
              justify-content: space-between;
            "
            @click="abrirTipoModal()"
          >
            {{ tipoTexto }} <span style="color: #9ca3af">▾</span>
          </button>
        </div>
        <div><label>Marca</label><input v-model="form.marca" placeholder="HP, Dell, Lenovo..." /></div>
        <div>
          <label>Número de Serie</label>
          <input v-model="form.serie" placeholder="SN: (opcional)" />
        </div>
        <div>
          <label>Estado</label>
          <select v-model="form.estado">
            <option value="">Seleccione...</option>
            <option value="Nuevo">Nuevo</option>
            <option value="Usado">Usado</option>
          </select>
        </div>

        <div
          class="full"
          style="
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 0.65rem 0.75rem;
          "
        >
          <label style="font-size: 0.8rem; font-weight: 600; color: #0f3460">Forma de control</label>
          <select v-model="form.controlTipo" style="margin-top: 0.25rem">
            <option value="asignable">Activo individual asignable</option>
            <option value="comun">Elemento de uso común</option>
          </select>
          <small style="display: block; color: #64748b; font-size: 0.7rem; margin-top: 0.25rem">
            Los activos asignables pueden tener empleado responsable. Los elementos comunes se
            controlan por cantidad y ubicación.
          </small>
        </div>

        <div class="inv-modal-section">💰 Compra</div>
        <div><label>Fecha de Compra</label><input v-model="form.fechaCompra" type="date" /></div>
        <div>
          <label>Valor Unitario ($)</label>
          <input v-model="form.valor" type="number" placeholder="0" min="0" />
        </div>
        <div><label>Proveedor</label><input v-model="form.proveedor" placeholder="Nombre del proveedor" /></div>

        <div class="full">
          <label>Asignaciones (nombre + ubicación)</label>
          <!-- invRenderAsignaciones / invAgregarAsignacion / invLeerAsignaciones -->
          <div style="display: flex; flex-direction: column; gap: 0.4rem; margin-top: 0.3rem">
            <div
              v-for="(a, i) in form.asignaciones"
              :key="i"
              style="display: grid; grid-template-columns: 1fr 1fr 32px; gap: 0.4rem; align-items: center"
            >
              <input v-model="a.nombre" placeholder="Nombre" />
              <input v-model="a.ubicacion" placeholder="Ubicación" />
              <button
                type="button"
                class="btn btn-sm btn-danger"
                style="font-size: 0.7rem; padding: 0.2rem 0.4rem"
                @click="quitarAsignacion(i)"
              >
                🗑️
              </button>
            </div>
          </div>
          <button
            type="button"
            class="btn btn-outline btn-sm"
            style="margin-top: 0.4rem; font-size: 0.75rem"
            @click="invAgregarAsignacion()"
          >
            + Agregar persona/asignación
          </button>
        </div>
        <div><label>Observaciones</label><textarea v-model="form.obs" rows="2"></textarea></div>

        <div
          class="full"
          style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.5rem"
        >
          <button type="button" class="btn btn-outline" @click="cerrarModalInv()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>
    </BaseModal>

    <!-- ============ MODAL TIPO (modalTipo, index.html 849-857) ============ -->
    <BaseModal :abierto="modalTipo" @cerrar="modalTipo = false">
      <h2 style="font-size: 1.1rem; margin-bottom: 0.25rem; color: #0f3460">
        Selecciona el tipo de equipo
      </h2>
      <div class="inv-tipo-grid">
        <div
          v-for="t in INV_TIPOS"
          :key="t.valor"
          class="inv-tipo-item"
          :class="{ seleccionado: t.valor === form.tipo }"
          @click="seleccionarTipo(t.valor)"
        >
          <span class="tipo-ico">{{ t.icono }}</span><span>{{ t.etiqueta }}</span>
        </div>
      </div>
      <div class="full" style="display: flex; justify-content: flex-end; margin-top: 1rem">
        <button type="button" class="btn btn-outline" @click="modalTipo = false">Cancelar</button>
      </div>
    </BaseModal>
  </div>
</template>

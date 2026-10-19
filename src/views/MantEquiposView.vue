<script setup>
// Mantenimiento de Equipos.
//
// Traduccion de la pagina suelta public/mant-equipos.html. En el original vivia
// dentro de un <iframe> del tab "Mant. Equipos" de index.html (lineas 743-745,
// cargada con ?embed=1) y por eso ocultaba su .header y su .auth-info. Aqui es
// una ruta a pantalla completa (router meta.sinShell), asi que trae su propio
// encabezado igual que la version suelta.
//
// El login de la pagina original (mostrarError 348, iniciarSesion 354 y
// cerrarSesion 368) NO se migra: lo cubren useAuthStore y el shell. Del bloque
// de auth solo se conserva quien puede editar.
//
// Tambien desaparecen guardarLocalStorage (439-442) y renderTodo (444-448): el
// respaldo en localStorage se elimino a proposito y el render lo hace Vue de
// forma reactiva. cerrarModal (615-617) lo reemplaza BaseModal.
import { computed, onMounted, ref } from 'vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { actualizar, crear, eliminar, listar } from '@/services/firestore'
import { useAuthStore } from '@/stores/auth'
import { diffDias, hoy } from '@/utils/fechas'

const auth = useAuthStore()

// Original lineas 335-346: tipos de equipo con el color de su seccion.
const TIPOS_EQUIPOS = [
  { key: 'Amplificador', label: 'Amplificadores', color: '#7c3aed' },
  { key: 'Canasta Sonido', label: 'Canasta Sonido', color: '#0891b2' },
  { key: 'Pantalla Grande', label: 'Pantalla Grande', color: '#059669' },
  { key: 'Pantalla Pequena', label: 'Pantalla Pequena', color: '#d97706' },
  { key: 'Proyector', label: 'Proyectores', color: '#dc2626' },
  { key: 'Tula Extensiones', label: 'Tulas', color: '#2563eb' },
  { key: 'Tripode', label: 'Tripodes', color: '#db2777' },
  { key: 'Pendon', label: 'Pendones', color: '#65a30d' },
  { key: 'Grabacion', label: 'Grabacion', color: '#0d9488' },
  { key: 'Proyeccion Dobles', label: 'Doble Pantalla', color: '#9333ea' },
]

// Original lineas 280-292: opciones del <select> del modal, en el mismo orden.
const TIPOS_FORM = [
  'Amplificador',
  'Pantalla Grande',
  'Pantalla Pequena',
  'Proyector',
  'Tula Extensiones',
  'Canasta Sonido',
  'Grabacion',
  'Proyeccion Dobles',
  'Tripode',
  'Pendon',
]

// Original lineas 330-331 y 373-401: el admin editaba y el visitante de
// mantenimiento solo miraba. El shell ya decide quien entra (router meta
// 'mant'); la condicion de permiso para editar se conserva asi.
const puedeEditar = computed(
  () => auth.esVisitanteMant || auth.esEditorEquipos || auth.esAdmin,
)

// Texto de #authStatus del original (lineas 379-401).
const estadoAcceso = computed(() => {
  const correo = auth.usuario?.email || ''
  if (auth.esAdmin) return 'Admin: ' + correo
  if (auth.esVisitanteMant) return 'Visitante: ' + correo
  if (auth.esEditorEquipos) return 'Editor: ' + correo
  return 'Acceso denegado. Solo administradores.'
})

// Original linea 332: equipos[]. Se leen de la coleccion "mantEquipos"
// (linea 410). No esta en useDatosStore porque index.html no la cargaba: solo
// existia en esta pagina, asi que se pide aparte con listar().
const equipos = ref([])
const cargando = ref(true)

async function cargar() {
  cargando.value = true
  try {
    equipos.value = await listar('mantEquipos')
  } catch (e) {
    console.warn('Error cargando:', e)
    equipos.value = []
  }
  cargando.value = false
}

onMounted(cargar)

// Original lineas 450-486: secciones por tipo con sus equipos.
const secciones = computed(() =>
  TIPOS_EQUIPOS.map((tipo) => ({
    ...tipo,
    items: equipos.value.filter((e) => e.tipo === tipo.key),
  })),
)

// Original lineas 496-507: estadisticas.
const stats = computed(() => ({
  total: equipos.value.length,
  bueno: equipos.value.filter((e) => e.estado === 'Bueno').length,
  mal: equipos.value.filter((e) => e.estado === 'Mal estado').length,
  taller: equipos.value.filter((e) => e.estado === 'En taller').length,
  baja: equipos.value.filter((e) => e.estado === 'Dada de baja').length,
}))

// Original lineas 509-541: alertas por estado y por vencimiento.
const alertas = computed(() => {
  const lista = []
  const hoyDate = new Date()
  equipos.value.forEach((e) => {
    if (e.estado === 'Mal estado') {
      lista.push({ msg: `${e.nombre} (${e.tipo}) en mal estado`, tipo: 'danger' })
    } else if (e.estado === 'En taller') {
      lista.push({ msg: `${e.nombre} (${e.tipo}) en taller`, tipo: 'warning' })
    }
    if (e.fechaVen) {
      const vence = new Date(e.fechaVen)
      if (vence <= hoyDate) {
        lista.push({ msg: `${e.nombre} (${e.tipo}) vencido el ${e.fechaVen}`, tipo: 'danger' })
      } else {
        const dias = diffDias(hoy(), e.fechaVen)
        if (dias >= -30 && dias < 0) {
          lista.push({
            msg: `${e.nombre} (${e.tipo}) vence en ${Math.abs(dias)} dias (${e.fechaVen})`,
            tipo: 'warning',
          })
        }
      }
    }
  })
  return lista
})

// Original lineas 455 y 534-537: el colapso de secciones y alertas se guardaba
// en localStorage. En Vue queda como estado en memoria (localStorage esta
// prohibido en las vistas).
const colapsadas = ref({})
const alertasColapsadas = ref(false)

// Original lineas 488-494 y 543-549.
function toggleSeccion(key) {
  colapsadas.value[key] = !colapsadas.value[key]
}
function toggleAlertas() {
  alertasColapsadas.value = !alertasColapsadas.value
}

// Original lineas 467-468: color del punto y clase del badge segun el estado.
function colorEstado(estado) {
  if (estado === 'Bueno') return '#059669'
  if (estado === 'Mal estado') return '#dc2626'
  if (estado === 'En taller') return '#d97706'
  return '#6b7280'
}
function claseEstado(estado) {
  if (estado === 'Bueno') return 'badge-green'
  if (estado === 'Mal estado') return 'tag-danger'
  if (estado === 'En taller') return 'badge-yellow'
  return 'badge-gray'
}

// Original lineas 551-568: abrir el modal en modo agregar o editar. El segundo
// parametro (tipo) solo se usa al agregar desde "+ Agregar" de una seccion.
const modalAbierto = ref(false)
const form = ref({})

function abrirModal(item, tipo) {
  if (item) {
    form.value = {
      id: item.id,
      tipo: item.tipo || '',
      nombre: item.nombre || '',
      estado: item.estado || 'Bueno',
      fechaRev: item.fechaRev || '',
      fechaVen: item.fechaVen || '',
      obs: item.obs || '',
    }
  } else {
    form.value = {
      id: null,
      tipo: tipo || '',
      nombre: '',
      estado: 'Bueno',
      fechaRev: hoy(),
      fechaVen: '',
      obs: '',
    }
  }
  modalAbierto.value = true
}

// Original lineas 570-601: guardar (crear o actualizar).
async function guardar() {
  const f = form.value
  const obj = {
    tipo: f.tipo,
    nombre: f.nombre,
    estado: f.estado,
    fechaRev: f.fechaRev,
    fechaVen: f.fechaVen || null,
    obs: f.obs,
  }
  if (f.id) await actualizar('mantEquipos', f.id, obj)
  else await crear('mantEquipos', obj)
  await cargar()
  modalAbierto.value = false
}

// Original lineas 603-613: editar(i) solo abria el modal; eliminar confirmaba.
async function eliminarEquipo(e) {
  if (!confirm('Eliminar equipo?')) return
  await eliminar('mantEquipos', e.id)
  await cargar()
}
</script>

<template>
  <!-- Original lineas 229-232. -->
  <div class="header">
    <h1>Mantenimiento de Equipos</h1>
    <div><RouterLink to="/">← Volver al panel principal</RouterLink></div>
  </div>

  <!-- Original lineas 234-237: barra de estado de sesion. El boton de cerrar
       sesion no se migra (lo cubre el shell). -->
  <div class="auth-info">
    <span>{{ estadoAcceso }}</span>
  </div>

  <div class="container">
    <!-- Original linea 241. -->
    <div v-if="cargando" class="loading-bar show">Cargando datos...</div>

    <!-- Original lineas 243-251: alertas colapsables. -->
    <div v-if="alertas.length" class="alert-bar show">
      <div class="alert-header" @click="toggleAlertas">
        <span class="alert-toggle" :class="{ collapsed: alertasColapsadas }">▼</span>
        <h3>Alertas</h3>
      </div>
      <div class="alert-content" :class="{ collapsed: alertasColapsadas }">
        <div>
          <div v-for="(a, i) in alertas" :key="i" class="alert-item">
            <span>
              <span class="tag" :class="a.tipo === 'danger' ? 'tag-danger' : 'tag-warning'">
                {{ a.tipo === 'danger' ? 'Critico' : 'Atencion' }}
              </span>
              {{ a.msg }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Original lineas 253-259. -->
    <div class="stats">
      <div class="stat">
        <div class="num">{{ stats.total }}</div>
        <div class="lbl">Total Equipos</div>
      </div>
      <div class="stat">
        <div class="num">{{ stats.bueno }}</div>
        <div class="lbl">Buen Estado</div>
      </div>
      <div class="stat">
        <div class="num">{{ stats.mal }}</div>
        <div class="lbl">Mal Estado</div>
      </div>
      <div class="stat">
        <div class="num">{{ stats.taller }}</div>
        <div class="lbl">En Taller</div>
      </div>
      <div class="stat">
        <div class="num">{{ stats.baja }}</div>
        <div class="lbl">Dadas de Baja</div>
      </div>
    </div>

    <!-- Original lineas 450-486: secciones por tipo, colapsables. -->
    <div>
      <div
        v-for="tipo in secciones"
        :key="tipo.key"
        class="seccion-card"
        :style="{ borderLeftColor: tipo.color }"
      >
        <h3 @click="toggleSeccion(tipo.key)">
          <span class="left">
            <span class="toggle" :class="{ collapsed: colapsadas[tipo.key] }">▼</span>
            {{ tipo.label }} ({{ tipo.items.length }})
          </span>
          <button
            v-if="puedeEditar"
            class="btn btn-primary btn-sm"
            :style="{ background: tipo.color }"
            @click.stop="abrirModal(null, tipo.key)"
          >
            + Agregar
          </button>
        </h3>
        <div class="content" :class="{ collapsed: colapsadas[tipo.key] }">
          <div
            v-if="!tipo.items.length"
            style="color: #9ca3af; font-size: 0.85rem; padding: 0.5rem 0"
          >
            Sin equipos registrados
          </div>
          <div v-for="e in tipo.items" :key="e.id" class="item">
            <div class="info">
              <div style="display: flex; align-items: center; gap: 0.3rem">
                <span class="item-dot" :style="{ background: colorEstado(e.estado) }"></span>
                <span class="nombre">{{ e.nombre }}</span>
              </div>
              <div class="detalle">
                Rev: {{ e.fechaRev || '-' }} | Vence: {{ e.fechaVen || '-' }} | {{ e.obs || '' }}
              </div>
            </div>
            <span
              :class="claseEstado(e.estado)"
              style="padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.75rem"
            >
              {{ e.estado }}
            </span>
            <template v-if="puedeEditar">
              <button class="btn btn-sm btn-outline" @click="abrirModal(e)">Editar</button>
              <button class="btn btn-sm btn-danger" @click="eliminarEquipo(e)">Eliminar</button>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Original lineas 275-309: modal agregar/editar equipo. -->
  <BaseModal :abierto="modalAbierto" @cerrar="modalAbierto = false">
    <h2>{{ form.id ? 'Editar Equipo' : 'Agregar Equipo' }}</h2>
    <form @submit.prevent="guardar">
      <div>
        <label>Tipo</label>
        <select v-model="form.tipo" required>
          <option value="">Seleccione...</option>
          <option v-for="t in TIPOS_FORM" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>
      <div class="full">
        <label>Nombre / Identificacion</label>
        <input v-model="form.nombre" required />
      </div>
      <div>
        <label>Estado</label>
        <select v-model="form.estado" required>
          <option value="Bueno">Bueno</option>
          <option value="Mal estado">Mal estado</option>
          <option value="En taller">En taller</option>
          <option value="Dada de baja">Dada de baja</option>
        </select>
      </div>
      <div><label>Fecha Revision</label><input v-model="form.fechaRev" type="date" required /></div>
      <div><label>Fecha Vencimiento</label><input v-model="form.fechaVen" type="date" /></div>
      <div class="full">
        <label>Observaciones</label>
        <textarea v-model="form.obs" rows="2" />
      </div>
      <div
        class="full"
        style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.5rem"
      >
        <button type="button" class="btn btn-outline" @click="modalAbierto = false">Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar</button>
      </div>
    </form>
  </BaseModal>
</template>

<style scoped>
/* .header a y .auth-info no existen en base.css. */
.header a {
  color: #93c5fd;
  font-size: 0.8rem;
  text-decoration: none;
}
.header a:hover {
  text-decoration: underline;
}

.auth-info {
  text-align: right;
  padding: 0.5rem 2rem;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
  font-size: 0.8rem;
  color: #374151;
}
.auth-info a {
  color: #0f3460;
}

/* .alert-bar esta en base.css con padding propio; la pagina original lo ponia
   en .alert-header, asi que aqui se anula el de la barra. El resto (.alert-header,
   .alert-toggle, .alert-content) no existe en base.css. */
.alert-bar {
  padding: 0;
}
.alert-bar .alert-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 1.25rem;
  cursor: pointer;
  user-select: none;
}
.alert-bar .alert-header h3 {
  color: #991b1b;
  font-size: 0.95rem;
  margin: 0;
}
.alert-bar .alert-toggle {
  font-size: 1.1rem;
  color: #991b1b;
  transition: transform 0.2s;
}
.alert-bar .alert-toggle.collapsed {
  transform: rotate(-90deg);
}
.alert-bar .alert-content {
  overflow: hidden;
  transition: max-height 0.25s ease;
  padding: 0 1.25rem;
}
.alert-bar .alert-content.collapsed {
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}
.alert-bar .alert-content:not(.collapsed) {
  max-height: 2000px;
  padding-bottom: 1rem;
}

/* .stat esta en base.css, pero la pagina original agrega el borde superior de
   color y las variantes por estado (aunque su HTML no las llegara a usar). */
.stat {
  background: #fff;
  border-radius: 12px;
  padding: 1rem 0.75rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  text-align: center;
  border-top: 3px solid #0f3460;
  position: relative;
  overflow: hidden;
}
.stat::before {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0.06;
  border-radius: 12px;
}
.stat-total {
  border-top-color: #0f3460;
}
.stat-total::before {
  background: linear-gradient(135deg, #0f3460, #4f8bc9);
}
.stat-bueno {
  border-top-color: #059669;
}
.stat-bueno::before {
  background: linear-gradient(135deg, #059669, #6ee7b7);
}
.stat-mal {
  border-top-color: #dc2626;
}
.stat-mal::before {
  background: linear-gradient(135deg, #dc2626, #fca5a5);
}
.stat-taller {
  border-top-color: #d97706;
}
.stat-taller::before {
  background: linear-gradient(135deg, #d97706, #fcd34d);
}
.stat-baja {
  border-top-color: #6b7280;
}
.stat-baja::before {
  background: linear-gradient(135deg, #6b7280, #d1d5db);
}
.stat .num {
  font-size: 1.6rem;
  font-weight: 800;
  position: relative;
  color: #0f3460;
}
.stat .lbl {
  font-size: 0.7rem;
  color: #6b7280;
  margin-top: 0.15rem;
  position: relative;
  font-weight: 500;
}

/* .item-dot no existe en base.css. */
.item-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 0.5rem;
  flex-shrink: 0;
}
</style>

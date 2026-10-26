<script setup>
// Prestamo de carros.
//
// Traduccion del tab "Prestamo Carros" de index.html:
//  - HTML del tab: lineas 670-691
//  - Modales: modalPrestamo (951-971) y modalReserva (973-988)
//  - JS: renderPrestamos (2355), autoEstadoPrestamo (2411),
//    abrirModalPrestamo (2418), guardarPrestamo (2442), editarPrestamo (2477),
//    eliminarPrestamo (2478), renderReservas (2493), abrirModalReserva (2528),
//    guardarReserva (2546), editarReserva (2589), eliminarReserva (2590) y
//    confirmarReserva (2600).
//  - Segun renderTodo (1625), este tab solo pinta renderPrestamos y
//    renderReservas. La firma (initFirma/limpiarFirma/cargarFirma, 2635-2671)
//    corresponde a Prestamo de Equipos, no a este tab, por eso aqui no se usa
//    <FirmaCanvas>.
import { computed, ref } from 'vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { actualizar, crear, eliminar } from '@/services/firestore'
import { useAuthStore } from '@/stores/auth'
import { useDatosStore } from '@/stores/datos'
import { useFiltroStore } from '@/stores/filtro'
import { useBorrador } from '@/composables/useBorrador'
import { ahora, hoy } from '@/utils/fechas'

const auth = useAuthStore()
const datos = useDatosStore()
const filtro = useFiltroStore()

// El original mostraba lo ultimo creado primero: [...arr].reverse()
// (renderPrestamos linea 2360 y renderReservas linea 2498). El filtro global
// por vehiculo tambien aplica aqui, como hacia renderTodo() en index.html.
const prestamos = computed(() => [...filtro.filtrar(datos.prestamos)].reverse())
const reservas = computed(() => [...filtro.filtrar(datos.reservas)].reverse())

// "En Uso Actualmente": solo los que siguen con estado 'En uso' (linea 2389).
// El original no los invertia, los recorria en su orden natural.
const prestamosActivos = computed(() =>
  filtro.filtrar(datos.prestamos).filter((p) => p.estado === 'En uso'),
)

// Select de placas (llenarSelectVehiculos, linea 4159).
const opcionesVehiculos = computed(() =>
  datos.vehiculos.map((v) => ({
    placa: v.placa,
    texto: `${v.placa} - ${v.marca} ${v.modelo}`,
  })),
)

// renderPrestamos (2362 y 2395): si la placa existe en vehiculos se usa esa.
function placaDe(p) {
  return datos.vehiculos.find((v) => v.placa === p.vehiculo)?.placa || p.vehiculo
}

// renderPrestamos (2364-2372): el estado se calcula al momento de pintar.
function estadoPrestamo(p) {
  if (p.estado === 'Devuelto') return { clase: 'badge-green', texto: 'Devuelto' }
  const salida = new Date(p.fechaSalida + 'T' + (p.horaSalida || '00:00'))
  const diffHoras = (new Date() - salida) / (1000 * 60 * 60)
  if (diffHoras > 24) return { clase: 'badge-gray', texto: 'Atrasado' }
  return { clase: 'badge-yellow', texto: 'En uso' }
}

// renderPrestamos (2397-2404): tiempo transcurrido desde la salida.
function tiempoTranscurrido(p) {
  const salida = new Date(p.fechaSalida + 'T' + (p.horaSalida || '00:00'))
  const ms = new Date() - salida
  const horas = Math.floor(ms / (1000 * 60 * 60))
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  return `${horas}h ${mins}m`
}

// ---------------------------------------------------------------
// Modales
// ---------------------------------------------------------------
const modalPrestamo = ref(false)
const modalReserva = ref(false)

const formPrestamo = ref({})
const formReserva = ref({})

// Borradores: si Lina recarga a mitad del formulario no pierde lo escrito.
const borradorPrestamo = useBorrador({
  clave: 'admin:prestamo-carro',
  fuente: formPrestamo,
  activo: () => modalPrestamo.value && !formPrestamo.value.id,
  alRestaurar: () => {
    modalPrestamo.value = true
  },
})
const restauradoPrestamo = borradorPrestamo.restaurado

const borradorReserva = useBorrador({
  clave: 'admin:reserva-carro',
  fuente: formReserva,
  activo: () => modalReserva.value && !formReserva.value.id,
  alRestaurar: () => {
    modalReserva.value = true
  },
})
const restauradoReserva = borradorReserva.restaurado

// autoEstadoPrestamo (2411-2417): con fecha y hora de entrada queda 'Devuelto'.
const estadoFormPrestamo = computed(() =>
  formPrestamo.value.fechaEntrada && formPrestamo.value.horaEntrada ? 'Devuelto' : 'En uso',
)

// abrirModalPrestamo (2418): item = prestamo a editar, sin item = nuevo.
function abrirModalPrestamo(item) {
  formPrestamo.value = item
    ? {
        id: item.id,
        vehiculo: item.vehiculo || '',
        solicitante: item.solicitante || '',
        fechaSalida: item.fechaSalida || '',
        horaSalida: item.horaSalida || '',
        fechaEntrada: item.fechaEntrada || '',
        horaEntrada: item.horaEntrada || '',
        obs: item.obs || '',
      }
    : {
        id: null,
        // Si hay un filtro global activo, se preselecciona esa placa.
        vehiculo: filtro.vehiculo || '',
        solicitante: '',
        fechaSalida: hoy(),
        horaSalida: ahora(),
        fechaEntrada: '',
        horaEntrada: '',
        obs: '',
      }
  modalPrestamo.value = true
  if (!item) borradorPrestamo.reiniciar()
}

// abrirModalReserva (2528): item = reserva a editar, sin item = nueva.
function abrirModalReserva(item) {
  formReserva.value = item
    ? {
        id: item.id,
        solicitante: item.solicitante || '',
        vehiculo: item.vehiculo || '',
        fecha: item.fecha || '',
        hora: item.hora || '',
      }
    : {
        id: null,
        solicitante: '',
        vehiculo: filtro.vehiculo || '',
        fecha: hoy(),
        hora: ahora(),
      }
  modalReserva.value = true
  if (!item) borradorReserva.reiniciar()
}

// ---------------------------------------------------------------
// Guardar
// ---------------------------------------------------------------
async function guardarPrestamo() {
  const f = formPrestamo.value
  const obj = {
    vehiculo: f.vehiculo,
    solicitante: f.solicitante,
    fechaSalida: f.fechaSalida,
    horaSalida: f.horaSalida,
    fechaEntrada: f.fechaEntrada || null,
    horaEntrada: f.horaEntrada || null,
    estado: estadoFormPrestamo.value,
    obs: f.obs,
  }
  if (f.id) await actualizar('prestamos', f.id, obj)
  else await crear('prestamos', obj)
  await datos.recargar('prestamos')
  modalPrestamo.value = false
  borradorPrestamo.limpiar()
}

async function guardarReserva() {
  const f = formReserva.value
  // guardarReserva (2552-2559): el vehiculo no se puede reservar dos veces el
  // mismo dia (se excluye la propia reserva cuando se esta editando).
  const conflicto = datos.reservas.some(
    (r) => r.id !== f.id && r.vehiculo === f.vehiculo && r.fecha === f.fecha,
  )
  if (conflicto) {
    alert('El vehiculo ya tiene una reserva en esta fecha')
    return
  }
  const obj = {
    solicitante: f.solicitante,
    vehiculo: f.vehiculo,
    fecha: f.fecha,
    hora: f.hora,
    // El original volvia a dejar 'Pendiente' tambien al editar (2565).
    estado: 'Pendiente',
  }
  if (f.id) await actualizar('reservas', f.id, obj)
  else await crear('reservas', obj)
  await datos.recargar('reservas')
  modalReserva.value = false
  borradorReserva.limpiar()
}

// ---------------------------------------------------------------
// Confirmar reserva (solo admin): genera el prestamo automatico (2600).
// ---------------------------------------------------------------
async function confirmarReserva(r) {
  if (!auth.esAdmin) return
  await actualizar('reservas', r.id, { estado: 'Solicitado' })
  await crear('prestamos', {
    vehiculo: r.vehiculo,
    solicitante: r.solicitante,
    fechaSalida: r.fecha,
    horaSalida: r.hora || null,
    fechaEntrada: null,
    horaEntrada: null,
    estado: 'En uso',
    obs: 'Generado desde reserva',
  })
  await datos.recargarVarias(['reservas', 'prestamos'])
}

// ---------------------------------------------------------------
// Eliminar (solo admin)
// ---------------------------------------------------------------
async function eliminarPrestamo(p) {
  if (!auth.esAdmin) return
  if (!confirm('Eliminar prestamo?')) return
  await eliminar('prestamos', p.id)
  await datos.recargar('prestamos')
}

async function eliminarReserva(r) {
  // El original solo ocultaba el boton a los no admin (2505); se conserva la
  // comprobacion para que la accion siga siendo exclusiva del admin.
  if (!auth.esAdmin) return
  if (!confirm('Eliminar reserva?')) return
  await eliminar('reservas', r.id)
  await datos.recargar('reservas')
}
</script>

<template>
  <div>
    <!-- ============ EN USO ACTUALMENTE (lineas 670-674) ============ -->
    <div class="card">
      <h2>En Uso Actualmente</h2>
      <div v-if="!prestamosActivos.length" class="empty">No hay vehiculos en uso</div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Vehiculo</th>
              <th>Solicitante</th>
              <th>Salida</th>
              <th>Hora</th>
              <th>Tiempo</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in prestamosActivos" :key="p.id">
              <td><strong>{{ placaDe(p) }}</strong></td>
              <td>{{ p.solicitante }}</td>
              <td>{{ p.fechaSalida }}</td>
              <td>{{ p.horaSalida || '-' }}</td>
              <td>{{ tiempoTranscurrido(p) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ============ RESERVAS (lineas 675-681) ============ -->
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <h2 style="margin:0">Reservas</h2>
        <button class="btn btn-primary btn-sm" @click="abrirModalReserva()">+ Reservar</button>
      </div>
      <div v-if="!reservas.length" class="empty">No hay reservas</div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Solicitante</th>
              <th>Vehiculo</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Estado</th>
              <th v-if="auth.esAdmin">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in reservas" :key="r.id">
              <td><strong>{{ r.solicitante }}</strong></td>
              <td>{{ placaDe(r) }}</td>
              <td>{{ r.fecha }}</td>
              <td>{{ r.hora }}</td>
              <td>
                <span
                  class="badge"
                  :class="r.estado === 'Solicitado' ? 'badge-green' : 'badge-yellow'"
                >
                  {{ r.estado === 'Solicitado' ? 'Solicitado' : 'Pendiente' }}
                </span>
              </td>
              <td v-if="auth.esAdmin" class="actions">
                <button
                  v-if="r.estado !== 'Solicitado'"
                  class="btn btn-sm btn-outline"
                  style="color:#065f46;border-color:#065f46"
                  @click="confirmarReserva(r)"
                >
                  ✓ Confirmar
                </button>
                <button class="btn btn-sm btn-outline" @click="abrirModalReserva(r)">Editar</button>
                <button class="btn btn-sm btn-danger" @click="eliminarReserva(r)">Eliminar</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ============ CONTROL DE PRESTAMO DE CARROS (lineas 682-688) ============ -->
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <h2 style="margin:0">Control de Prestamo de Carros</h2>
        <button class="btn btn-primary btn-sm" @click="abrirModalPrestamo()">+ Registrar</button>
      </div>
      <div v-if="!prestamos.length" class="empty">No hay prestamos registrados</div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Salida</th>
              <th>Hora</th>
              <th>Vehiculo</th>
              <th>Solicitante</th>
              <th>Entrada</th>
              <th>Hora</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in prestamos" :key="p.id">
              <td>{{ p.fechaSalida }}</td>
              <td>{{ p.horaSalida || '-' }}</td>
              <td><strong>{{ placaDe(p) }}</strong></td>
              <td>{{ p.solicitante }}</td>
              <td>{{ p.fechaEntrada || '-' }}</td>
              <td>{{ p.horaEntrada || '-' }}</td>
              <td>
                <span class="badge" :class="estadoPrestamo(p).clase">{{ estadoPrestamo(p).texto }}</span>
              </td>
              <td class="actions">
                <button class="btn btn-sm btn-outline" @click="abrirModalPrestamo(p)">Editar</button>
                <button
                  v-if="auth.esAdmin"
                  class="btn btn-sm btn-danger"
                  @click="eliminarPrestamo(p)"
                >
                  Eliminar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ============ MODAL PRESTAMO (951-971) ============ -->
    <BaseModal :abierto="modalPrestamo" @cerrar="modalPrestamo = false">
      <h2>{{ formPrestamo.id ? 'Editar Prestamo' : 'Registrar Prestamo' }}</h2>
      <p v-if="restauradoPrestamo" class="borrador-aviso">
        Se recuperó el borrador que tenías sin guardar.
      </p>
      <form @submit.prevent="guardarPrestamo">
        <div>
          <label>Vehiculo</label>
          <select v-model="formPrestamo.vehiculo" required>
            <option value="">
              {{ opcionesVehiculos.length ? 'Seleccione vehiculo' : 'No hay vehiculos' }}
            </option>
            <option v-for="v in opcionesVehiculos" :key="v.placa" :value="v.placa">
              {{ v.texto }}
            </option>
          </select>
        </div>
        <div><label>Solicitante</label><input v-model="formPrestamo.solicitante" required /></div>
        <div>
          <label>Fecha Salida</label>
          <input v-model="formPrestamo.fechaSalida" type="date" required />
        </div>
        <div><label>Hora Salida</label><input v-model="formPrestamo.horaSalida" type="time" required /></div>
        <div><label>Fecha Entrada</label><input v-model="formPrestamo.fechaEntrada" type="date" /></div>
        <div><label>Hora Entrada</label><input v-model="formPrestamo.horaEntrada" type="time" /></div>
        <div>
          <label>Estado</label>
          <input
            :value="estadoFormPrestamo === 'Devuelto' ? '✓ Devuelto' : '● En uso'"
            readonly
            style="background:#f3f4f6;font-weight:600"
          />
        </div>
        <div class="full"><label>Observaciones</label><textarea v-model="formPrestamo.obs" rows="2"></textarea></div>
        <div class="full" style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:.5rem">
          <button type="button" class="btn btn-outline" @click="modalPrestamo = false">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>
    </BaseModal>

    <!-- ============ MODAL RESERVA (973-988) ============ -->
    <BaseModal :abierto="modalReserva" @cerrar="modalReserva = false">
      <h2>{{ formReserva.id ? 'Editar Reserva' : 'Registrar Reserva' }}</h2>
      <p v-if="restauradoReserva" class="borrador-aviso">
        Se recuperó el borrador que tenías sin guardar.
      </p>
      <form @submit.prevent="guardarReserva">
        <div><label>Solicitante</label><input v-model="formReserva.solicitante" required /></div>
        <div>
          <label>Vehiculo</label>
          <select v-model="formReserva.vehiculo" required>
            <option value="">
              {{ opcionesVehiculos.length ? 'Seleccione vehiculo' : 'No hay vehiculos' }}
            </option>
            <option v-for="v in opcionesVehiculos" :key="v.placa" :value="v.placa">
              {{ v.texto }}
            </option>
          </select>
        </div>
        <div><label>Fecha</label><input v-model="formReserva.fecha" type="date" required /></div>
        <div><label>Hora</label><input v-model="formReserva.hora" type="time" required /></div>
        <div class="full" style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:.5rem">
          <button type="button" class="btn btn-outline" @click="modalReserva = false">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>
    </BaseModal>
  </div>
</template>

<style scoped>
/* Las tarjetas, tablas, badges y botones de esta pantalla ya viven en base.css;
   aqui no hace falta CSS propio. */
</style>

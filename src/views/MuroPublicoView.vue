<script setup>
// Muro publico.
//
// Une las dos versiones que existian del mismo contenido:
//  - el tab "Muro Publico" de index.html (lineas 701-741 y 2747-2948)
//  - la pagina suelta muro-publico.html
// Ahora hay un solo componente y una sola logica.
import { computed, ref } from 'vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import FirmaCanvas from '@/components/ui/FirmaCanvas.vue'
import ReservasEquiposPanel from '@/components/equipos/ReservasEquiposPanel.vue'
import { actualizar, crear, eliminar } from '@/services/firestore'
import { useAuthStore } from '@/stores/auth'
import { useDatosStore } from '@/stores/datos'
import { useBorrador } from '@/composables/useBorrador'
import { AREAS, etiquetaArea } from '@/utils/areas'
import { ahora, hoy } from '@/utils/fechas'

const auth = useAuthStore()
const datos = useDatosStore()

// El original mostraba lo ultimo creado primero: [...arr].reverse()
const prestamos = computed(() => [...datos.prestamos].reverse())
const equipos = computed(() => [...datos.equipos].reverse())
// Una reserva confirmada pasa a estado "Solicitado" y sale de la lista.
const reservas = computed(() => datos.reservas.filter((r) => r.estado !== 'Solicitado'))
const opcionesVehiculos = computed(() =>
  datos.vehiculos.map((v) => ({
    placa: v.placa,
    texto: `${v.placa} - ${v.marca} ${v.modelo}`,
  })),
)

// ---------------------------------------------------------------
// Modales
// ---------------------------------------------------------------
const modalPrestamo = ref(false)
const modalReserva = ref(false)
const modalEquipo = ref(false)

const formPrestamo = ref({})
const formReserva = ref({})
const formEquipo = ref({})

// Borradores: si Lina recarga la pagina a mitad de un formulario no lo pierde.
const borradorPrestamo = useBorrador({
  clave: 'muro:prestamo-carro',
  fuente: formPrestamo,
  activo: () => modalPrestamo.value && !formPrestamo.value.id,
  alRestaurar: () => {
    modalPrestamo.value = true
  },
})
const restauradoPrestamo = borradorPrestamo.restaurado

const borradorReserva = useBorrador({
  clave: 'muro:reserva-carro',
  fuente: formReserva,
  activo: () => modalReserva.value,
  alRestaurar: () => {
    modalReserva.value = true
  },
})
const restauradoReserva = borradorReserva.restaurado

const borradorEquipo = useBorrador({
  clave: 'muro:prestamo-equipo',
  fuente: formEquipo,
  activo: () => modalEquipo.value && !formEquipo.value.id,
  alRestaurar: () => {
    modalEquipo.value = true
  },
})
const restauradoEquipo = borradorEquipo.restaurado

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
        estado: item.estado || 'En uso',
        obs: item.obs || '',
      }
    : {
        id: null,
        vehiculo: '',
        solicitante: '',
        fechaSalida: hoy(),
        horaSalida: ahora(),
        fechaEntrada: '',
        horaEntrada: '',
        estado: 'En uso',
        obs: '',
      }
  modalPrestamo.value = true
  if (!item) borradorPrestamo.reiniciar()
}

function abrirModalReserva() {
  formReserva.value = { solicitante: '', vehiculo: '', fecha: hoy(), hora: ahora() }
  modalReserva.value = true
  borradorReserva.reiniciar()
}

function abrirModalEquipo(item) {
  formEquipo.value = item
    ? {
        id: item.id,
        fechaSalida: item.fechaSalida || '',
        entrega: item.entrega || '',
        depto: item.depto || '',
        equipo: item.equipo || '',
        ref: item.ref || '',
        cantidad: item.cantidad || 1,
        solicitante: item.solicitante || '',
        fechaEntrada: item.fechaEntrada || '',
        firma: item.firma || '',
      }
    : {
        id: null,
        fechaSalida: hoy(),
        entrega: '',
        depto: '',
        equipo: '',
        ref: '',
        cantidad: 1,
        solicitante: '',
        fechaEntrada: '',
        firma: '',
      }
  modalEquipo.value = true
  if (!item) borradorEquipo.reiniciar()
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
    horaSalida: f.horaSalida || null,
    fechaEntrada: f.fechaEntrada || null,
    horaEntrada: f.horaEntrada || null,
    estado: f.estado,
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
  await crear('reservas', {
    solicitante: f.solicitante,
    vehiculo: f.vehiculo,
    fecha: f.fecha,
    hora: f.hora,
    estado: 'Pendiente',
  })
  await datos.recargar('reservas')
  modalReserva.value = false
  borradorReserva.limpiar()
}

async function guardarEquipo() {
  const f = formEquipo.value
  const obj = {
    fechaSalida: f.fechaSalida,
    entrega: f.entrega,
    depto: f.depto,
    equipo: f.equipo,
    ref: f.ref,
    cantidad: parseInt(f.cantidad) || 1,
    solicitante: f.solicitante,
    fechaEntrada: f.fechaEntrada || null,
    firma: f.firma || null,
  }
  if (f.id) await actualizar('equipos', f.id, obj)
  else await crear('equipos', obj)
  await datos.recargar('equipos')
  modalEquipo.value = false
  borradorEquipo.limpiar()
}

// ---------------------------------------------------------------
// Confirmar reservas (solo admin): genera el prestamo automatico
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
async function eliminarPrestamo(item) {
  if (!auth.esAdmin) return
  if (!confirm('¿Eliminar préstamo?')) return
  await eliminar('prestamos', item.id)
  await datos.recargar('prestamos')
}

async function eliminarEquipo(item) {
  if (!auth.esAdmin) return
  if (!confirm('¿Eliminar préstamo de equipo?')) return
  await eliminar('equipos', item.id)
  await datos.recargar('equipos')
}

function verFirma(dataUrl) {
  window.open(dataUrl, '_blank', 'width=400,height=200')
}
</script>

<template>
  <div>
    <div
      style="
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        margin-bottom: 1.25rem;
        padding-bottom: 0.75rem;
        border-bottom: 2px solid #e5e7eb;
      "
    >
      <h2 style="margin: 0; font-size: 1.1rem; color: #0f3460">🌐 Muro Público</h2>
      <p style="margin: 0; font-size: 0.8rem; color: #9ca3af">
        Préstamo de carros y equipos · Clase Alpha
      </p>
    </div>

    <div class="muro-grid">
      <!-- ============ CARROS ============ -->
      <div class="card" style="margin: 0">
        <div class="reserva-box reserva-box-carros">
          <div class="reserva-head">
            <span class="reserva-title" style="color: #7d6608">📅 Reservas</span>
            <button
              class="btn btn-outline btn-sm"
              style="font-size: 0.7rem"
              @click="abrirModalReserva()"
            >
              + Reservar
            </button>
          </div>
          <div v-if="!reservas.length" class="empty" style="padding: 0.5rem">Sin reservas</div>
          <div v-for="r in reservas" :key="r.id" class="reserva-item">
            <span>
              <strong>{{ r.solicitante }}</strong> — {{ r.vehiculo }}
              <span style="color: #6b7280">{{ r.fecha }} {{ r.hora }}</span>
            </span>
            <span style="display: flex; gap: 0.3rem; align-items: center">
              <span class="badge badge-yellow">Pendiente</span>
              <button
                v-if="auth.esAdmin"
                class="btn btn-sm btn-success"
                style="padding: 0.2rem 0.5rem; font-size: 0.7rem"
                @click="confirmarReserva(r)"
              >
                ✓
              </button>
            </span>
          </div>
        </div>

        <div class="seccion-head">
          <h2 style="margin: 0; font-size: 1rem">🚗 Préstamo de Carros</h2>
          <button class="btn btn-primary btn-sm" @click="abrirModalPrestamo()">+ Registrar</button>
        </div>

        <div v-if="!prestamos.length" class="empty">No hay préstamos registrados</div>
        <div v-for="p in prestamos" :key="p.id" class="loan-card">
          <div class="loan-top">
            <span class="loan-name">{{ p.vehiculo }}</span>
            <span class="badge" :class="p.estado === 'Devuelto' ? 'badge-green' : 'badge-yellow'">
              {{ p.estado }}
            </span>
          </div>
          <div class="loan-detail">
            <span>👤 {{ p.solicitante }}</span>
            <span>📅 {{ p.fechaSalida }}{{ p.horaSalida ? ' ' + p.horaSalida : '' }}</span>
            <span v-if="p.fechaEntrada">✅ {{ p.fechaEntrada }}</span>
            <span v-else style="color: #dc2626">⏳ Sin devolver</span>
            <span style="display: flex; gap: 0.3rem">
              <button class="btn btn-sm btn-outline" style="font-size: 0.65rem; padding: 0.15rem 0.4rem" @click="abrirModalPrestamo(p)">
                Editar
              </button>
              <button
                v-if="auth.esAdmin"
                class="btn btn-sm btn-danger"
                style="font-size: 0.65rem; padding: 0.15rem 0.4rem"
                @click="eliminarPrestamo(p)"
              >
                🗑
              </button>
            </span>
          </div>
        </div>
      </div>

      <!-- ============ EQUIPOS ============ -->
      <div class="card" style="margin: 0">
        <div class="seccion-head">
          <h2 style="margin: 0; font-size: 1rem">📦 Préstamo de Equipos</h2>
          <button class="btn btn-primary btn-sm" @click="abrirModalEquipo()">+ Solicitar</button>
        </div>

        <!-- Reservas de equipos: componente compartido con Prestamo Equipos -->
        <ReservasEquiposPanel compacto />

        <div v-if="!equipos.length" class="empty">No hay préstamos de equipos</div>
        <div v-for="e in equipos" :key="e.id" class="loan-card">
          <div class="loan-top">
            <span class="loan-name">{{ e.equipo }}</span>
            <span class="badge" :class="e.fechaEntrada ? 'badge-green' : 'badge-yellow'">
              {{ e.fechaEntrada ? 'Devuelto' : 'Prestado' }}
            </span>
          </div>
          <div class="loan-detail">
            <span>👤 {{ e.solicitante }}</span>
            <span>📦 {{ e.entrega }}</span>
            <span>📅 {{ e.fechaSalida }}</span>
            <span v-if="e.ref">🔖 {{ e.ref }}</span>
            <span>×{{ e.cantidad }}</span>
            <span v-if="e.firma">
              ✍️
              <img
                :src="e.firma"
                alt="Firma"
                title="Ver firma"
                style="height: 18px; vertical-align: middle; cursor: pointer"
                @click="verFirma(e.firma)"
              />
            </span>
            <span v-if="e.fechaEntrada">✅ {{ e.fechaEntrada }}</span>
            <span v-else style="color: #dc2626">⏳ Pendiente</span>
            <span style="display: flex; gap: 0.3rem">
              <button class="btn btn-sm btn-outline" style="font-size: 0.65rem; padding: 0.15rem 0.4rem" @click="abrirModalEquipo(e)">
                Editar
              </button>
              <button
                v-if="auth.esAdmin"
                class="btn btn-sm btn-danger"
                style="font-size: 0.65rem; padding: 0.15rem 0.4rem"
                @click="eliminarEquipo(e)"
              >
                🗑
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ============ MODAL PRESTAMO CARRO ============ -->
    <BaseModal :abierto="modalPrestamo" @cerrar="modalPrestamo = false">
      <h2>{{ formPrestamo.id ? 'Editar Préstamo' : 'Registrar Préstamo' }}</h2>
      <p v-if="restauradoPrestamo" class="borrador-aviso">
        Se recuperó el borrador que tenías sin guardar.
      </p>
      <form @submit.prevent="guardarPrestamo">
        <div>
          <label>Vehículo</label>
          <select v-model="formPrestamo.vehiculo" required>
            <option value="">Seleccione</option>
            <option v-for="v in opcionesVehiculos" :key="v.placa" :value="v.placa">
              {{ v.texto }}
            </option>
          </select>
        </div>
        <div><label>Solicitante</label><input v-model="formPrestamo.solicitante" required /></div>
        <div><label>Fecha Salida</label><input v-model="formPrestamo.fechaSalida" type="date" required /></div>
        <div><label>Hora Salida</label><input v-model="formPrestamo.horaSalida" type="time" /></div>
        <div><label>Fecha Entrada</label><input v-model="formPrestamo.fechaEntrada" type="date" /></div>
        <div><label>Hora Entrada</label><input v-model="formPrestamo.horaEntrada" type="time" /></div>
        <div>
          <label>Estado</label>
          <select v-model="formPrestamo.estado">
            <option value="En uso">En uso</option>
            <option value="Devuelto">Devuelto</option>
          </select>
        </div>
        <div class="full"><label>Observaciones</label><textarea v-model="formPrestamo.obs" rows="2" /></div>
        <div class="full" style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.3rem">
          <button type="button" class="btn btn-outline" @click="modalPrestamo = false">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>
    </BaseModal>

    <!-- ============ MODAL RESERVA ============ -->
    <BaseModal :abierto="modalReserva" @cerrar="modalReserva = false">
      <h2>Nueva Reserva</h2>
      <p v-if="restauradoReserva" class="borrador-aviso">
        Se recuperó el borrador que tenías sin guardar.
      </p>
      <form @submit.prevent="guardarReserva">
        <div><label>Solicitante</label><input v-model="formReserva.solicitante" required /></div>
        <div>
          <label>Vehículo</label>
          <select v-model="formReserva.vehiculo" required>
            <option value="">Seleccione</option>
            <option v-for="v in opcionesVehiculos" :key="v.placa" :value="v.placa">
              {{ v.texto }}
            </option>
          </select>
        </div>
        <div><label>Fecha</label><input v-model="formReserva.fecha" type="date" required /></div>
        <div><label>Hora</label><input v-model="formReserva.hora" type="time" required /></div>
        <div class="full" style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.3rem">
          <button type="button" class="btn btn-outline" @click="modalReserva = false">Cancelar</button>
          <button type="submit" class="btn btn-primary">Solicitar</button>
        </div>
      </form>
    </BaseModal>

    <!-- ============ MODAL EQUIPO ============ -->
    <BaseModal :abierto="modalEquipo" @cerrar="modalEquipo = false">
      <h2>{{ formEquipo.id ? 'Editar Préstamo Equipo' : 'Registrar Préstamo Equipo' }}</h2>
      <p v-if="restauradoEquipo" class="borrador-aviso">
        Se recuperó el borrador que tenías sin guardar.
      </p>
      <form @submit.prevent="guardarEquipo">
        <div><label>Fecha Salida</label><input v-model="formEquipo.fechaSalida" type="date" required /></div>
        <div><label>Quien Entrega</label><input v-model="formEquipo.entrega" required /></div>
        <div>
          <label>Área</label>
          <select v-model="formEquipo.depto">
            <option value="">Seleccione</option>
            <option v-for="a in AREAS" :key="a" :value="a">{{ etiquetaArea(a) }}</option>
          </select>
        </div>
        <div><label>Equipo</label><input v-model="formEquipo.equipo" required /></div>
        <div><label>Referencia</label><input v-model="formEquipo.ref" /></div>
        <div><label>Cantidad</label><input v-model="formEquipo.cantidad" type="number" min="1" /></div>
        <div><label>Solicitante</label><input v-model="formEquipo.solicitante" required /></div>
        <div><label>Fecha Entrada</label><input v-model="formEquipo.fechaEntrada" type="date" /></div>
        <div class="full">
          <label>Firma</label>
          <FirmaCanvas v-model="formEquipo.firma" :alto="100" />
        </div>
        <div class="full" style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.3rem">
          <button type="button" class="btn btn-outline" @click="modalEquipo = false">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>
    </BaseModal>
  </div>
</template>

<style scoped>
.muro-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  align-items: start;
}
@media (max-width: 860px) {
  .muro-grid {
    grid-template-columns: 1fr;
  }
}

.seccion-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.loan-card {
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 0.7rem 0.9rem;
  margin-bottom: 0.5rem;
}
.loan-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.2rem;
  flex-wrap: wrap;
  gap: 0.25rem;
}
.loan-name {
  font-weight: 700;
  font-size: 0.85rem;
  color: #0f3460;
}
.loan-detail {
  font-size: 0.75rem;
  color: #6b7280;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
</style>

<script setup>
// Reservas de equipos.
//
// En el index.html original esta caja vivia solo en el Muro Publico
// (muroReservasEquiposList, linea 736). Lina no la encontraba desde la pestana
// de equipos, asi que ahora es un componente compartido:
//  - compacto (Muro Publico): misma caja verde de siempre.
//  - completo (Prestamo Equipos): tarjeta con tabla y acciones.
//
// El formulario de reserva tambien vive aqui, de modo que se puede reservar
// desde las dos pantallas. La confirmacion (admin) genera el prestamo en la
// coleccion `equipos`, igual que hacia confirmarReservaEquipo() del original.
import { computed, ref } from 'vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import FirmaCanvas from '@/components/ui/FirmaCanvas.vue'
import { actualizar, crear, eliminar } from '@/services/firestore'
import { useAuthStore } from '@/stores/auth'
import { useDatosStore } from '@/stores/datos'
import { useBorrador } from '@/composables/useBorrador'
import { AREAS, etiquetaArea } from '@/utils/areas'
import { hoy } from '@/utils/fechas'

defineProps({
  compacto: { type: Boolean, default: false },
})

const auth = useAuthStore()
const datos = useDatosStore()

// Una reserva confirmada pasa a estado "Solicitado" y sale de la lista.
const pendientes = computed(() =>
  [...datos.reservasEquipos].filter((r) => r.estado !== 'Solicitado').reverse(),
)

const modal = ref(false)
const form = ref({})
const mensaje = ref('')
const error = ref('')

const borrador = useBorrador({
  clave: 'reserva-equipo',
  fuente: form,
  activo: () => modal.value,
  alRestaurar: () => {
    modal.value = true
  },
})
const restaurado = borrador.restaurado

function abrirModal() {
  form.value = {
    fechaSalida: hoy(),
    entrega: '',
    depto: '',
    equipo: '',
    ref: '',
    cantidad: 1,
    solicitante: '',
    firma: '',
  }
  mensaje.value = ''
  error.value = ''
  modal.value = true
  borrador.reiniciar()
}

async function guardar() {
  const f = form.value
  error.value = ''
  if (!f.equipo || !f.solicitante) {
    error.value = 'Escribe el equipo y el solicitante.'
    return
  }
  if (!f.firma) {
    error.value = 'La firma es obligatoria.'
    return
  }
  try {
    await crear('reservasEquipos', {
      fechaSalida: f.fechaSalida,
      entrega: f.entrega,
      depto: f.depto,
      equipo: f.equipo,
      ref: f.ref || '',
      cantidad: parseInt(f.cantidad) || 1,
      solicitante: f.solicitante,
      firma: f.firma,
      estado: 'Pendiente',
    })
    await datos.recargar('reservasEquipos')
    modal.value = false
    borrador.limpiar()
    mensaje.value = 'Reserva enviada. Queda pendiente de confirmación.'
  } catch (e) {
    console.error('No se pudo guardar la reserva de equipo', e)
    error.value = 'No se pudo guardar la reserva. Revisa la conexión e inténtalo de nuevo.'
  }
}

// Genera el prestamo automatico (solo admin), igual que el original.
async function confirmar(r) {
  if (!auth.esAdmin) return
  if (!confirm(`¿Confirmar la reserva de ${r.equipo} para ${r.solicitante}?`)) return
  try {
    await actualizar('reservasEquipos', r.id, { estado: 'Solicitado' })
    await crear('equipos', {
      fechaSalida: r.fechaSalida || r.fecha || '',
      entrega: r.entrega || '',
      depto: r.depto || '',
      equipo: r.equipo,
      ref: r.ref || '',
      cantidad: r.cantidad || 1,
      solicitante: r.solicitante,
      fechaEntrada: null,
      firma: r.firma || '',
      obs: 'Generado desde reserva',
    })
    await datos.recargarVarias(['reservasEquipos', 'equipos'])
    mensaje.value = `Reserva de ${r.equipo} confirmada: ya aparece en los préstamos.`
  } catch (e) {
    console.error('No se pudo confirmar la reserva de equipo', e)
    error.value = 'No se pudo confirmar la reserva. Revisa la conexión e inténtalo de nuevo.'
  }
}

async function borrar(r) {
  if (!auth.esAdmin) return
  if (!confirm(`¿Eliminar la reserva de ${r.equipo} de ${r.solicitante}?`)) return
  try {
    await eliminar('reservasEquipos', r.id)
    await datos.recargar('reservasEquipos')
  } catch (e) {
    console.error('No se pudo eliminar la reserva de equipo', e)
    error.value = 'No se pudo eliminar la reserva. Revisa la conexión e inténtalo de nuevo.'
  }
}

function verFirma(dataUrl) {
  window.open(dataUrl, '_blank', 'width=400,height=200')
}
</script>

<template>
  <!-- ============ MODO COMPACTO (Muro Publico) ============ -->
  <div v-if="compacto" class="reserva-box reserva-box-equipos">
    <div class="reserva-head">
      <span class="reserva-title" style="color: #166534">📅 Reservas Equipos</span>
      <button class="btn btn-outline btn-sm" style="font-size: 0.7rem" @click="abrirModal()">
        + Reservar
      </button>
    </div>

    <p v-if="mensaje" class="aviso-inline">{{ mensaje }}</p>
    <p v-if="error" class="aviso-inline aviso-error">{{ error }}</p>

    <div v-if="!pendientes.length" class="empty" style="padding: 0.5rem; font-size: 0.8rem">
      Sin reservas
    </div>
    <div v-for="r in pendientes" :key="r.id" class="reserva-item reserva-item-equipo">
      <span>
        <strong>{{ r.solicitante }}</strong> — {{ r.equipo }}{{ r.ref ? ` (${r.ref})` : '' }}{{ r.depto ? ` · ${r.depto}` : '' }}
        <span style="color: #6b7280">{{ r.fechaSalida || r.fecha || '' }}</span>
      </span>
      <span style="display: flex; gap: 0.3rem; align-items: center">
        <span class="badge badge-yellow">Pendiente</span>
        <button
          v-if="auth.esAdmin"
          class="btn btn-sm btn-success"
          style="padding: 0.2rem 0.5rem; font-size: 0.7rem"
          title="Confirmar reserva"
          @click="confirmar(r)"
        >
          ✓
        </button>
      </span>
    </div>
  </div>

  <!-- ============ MODO COMPLETO (Prestamo Equipos) ============ -->
  <div v-else class="card">
    <div class="reserva-head">
      <div style="display: flex; align-items: center; gap: 0.5rem">
        <h2 style="margin: 0">Reservas de Equipos</h2>
        <span v-if="pendientes.length" class="badge badge-yellow">{{ pendientes.length }} pendientes</span>
      </div>
      <button class="btn btn-primary btn-sm" @click="abrirModal()">+ Reservar</button>
    </div>

    <p v-if="mensaje" class="aviso-inline">{{ mensaje }}</p>
    <p v-if="error" class="aviso-inline aviso-error">{{ error }}</p>

    <div v-if="!pendientes.length" class="empty">No hay reservas de equipos pendientes</div>
    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Solicitante</th>
            <th>Equipo</th>
            <th>Ref</th>
            <th>Área</th>
            <th>Cant</th>
            <th>Firma</th>
            <th v-if="auth.esAdmin">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in pendientes" :key="r.id">
            <td>{{ r.fechaSalida || r.fecha || '-' }}</td>
            <td><strong>{{ r.solicitante }}</strong></td>
            <td>{{ r.equipo }}</td>
            <td>{{ r.ref || '-' }}</td>
            <td>{{ etiquetaArea(r.depto) || '-' }}</td>
            <td>{{ r.cantidad || 1 }}</td>
            <td>
              <img
                v-if="r.firma"
                :src="r.firma"
                alt="Firma"
                title="Ver firma"
                style="width: 60px; height: 24px; object-fit: contain; cursor: pointer"
                @click="verFirma(r.firma)"
              />
              <template v-else>-</template>
            </td>
            <td v-if="auth.esAdmin" class="actions">
              <button
                class="btn btn-sm btn-outline"
                style="color: #065f46; border-color: #065f46"
                @click="confirmar(r)"
              >
                ✓ Confirmar
              </button>
              <button class="btn btn-sm btn-danger" @click="borrar(r)">Eliminar</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- ============ MODAL RESERVA EQUIPO (muro-publico.html) ============ -->
  <BaseModal :abierto="modal" @cerrar="modal = false">
    <h2>Reservar Equipo</h2>
    <p v-if="restaurado" class="borrador-aviso">
      Se recuperó el borrador que tenías sin enviar.
    </p>
    <form @submit.prevent="guardar">
      <div><label>Fecha Salida</label><input v-model="form.fechaSalida" type="date" /></div>
      <div><label>Quien Entrega</label><input v-model="form.entrega" /></div>
      <div>
        <label>Área</label>
        <select v-model="form.depto">
          <option value="">Seleccione</option>
          <option v-for="a in AREAS" :key="a" :value="a">{{ etiquetaArea(a) }}</option>
        </select>
      </div>
      <div><label>Equipo</label><input v-model="form.equipo" required /></div>
      <div><label>Referencia</label><input v-model="form.ref" /></div>
      <div><label>Cantidad</label><input v-model="form.cantidad" type="number" min="1" /></div>
      <div><label>Solicitante</label><input v-model="form.solicitante" required /></div>
      <div class="full">
        <label>Firma <span style="color: #dc2626">*</span></label>
        <FirmaCanvas v-model="form.firma" :alto="120" />
      </div>
      <p v-if="error" class="full aviso-inline aviso-error">{{ error }}</p>
      <div class="full" style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.3rem">
        <button type="button" class="btn btn-outline" @click="modal = false">Cancelar</button>
        <button type="submit" class="btn btn-primary">Solicitar</button>
      </div>
    </form>
  </BaseModal>
</template>

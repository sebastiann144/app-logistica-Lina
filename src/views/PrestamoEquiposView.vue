<script setup>
// Tab "Prestamo Equipos".
//
// Es la traduccion del tab #tabEquipos de index.html (lineas 691-699, que solo
// contiene la tabla de prestamos) y de su modal:
//  - modalEquipo (lineas 1031-1071): prestamos de equipos.
// Las reservas de equipos estaban solo en el Muro Publico (muroReservasEquiposList,
// linea 736); ahora se muestran aqui con <ReservasEquiposPanel>, que tambien
// permite reservar y confirmar sin cambiar de pestana.
import { computed, ref } from 'vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import FirmaCanvas from '@/components/ui/FirmaCanvas.vue'
import ReservasEquiposPanel from '@/components/equipos/ReservasEquiposPanel.vue'
import { actualizar, crear, eliminar } from '@/services/firestore'
import { useAuthStore } from '@/stores/auth'
import { useDatosStore } from '@/stores/datos'
import { useBorrador } from '@/composables/useBorrador'
import { AREAS, etiquetaArea } from '@/utils/areas'
import { hoy } from '@/utils/fechas'

const auth = useAuthStore()
const datos = useDatosStore()

// renderEquipos (linea 2721): el original mostraba lo ultimo creado primero con
// [...equipos].reverse().
const equipos = computed(() => [...datos.equipos].reverse())

// ---------------------------------------------------------------
// Modal (reemplaza cerrarModal('modalEquipo'))
// ---------------------------------------------------------------
const modalEquipo = ref(false)
const formEquipo = ref({})

// Borrador del formulario: si recarga a mitad de un prestamo no se pierde.
const borradorEquipo = useBorrador({
  clave: 'admin:prestamo-equipo',
  fuente: formEquipo,
  activo: () => modalEquipo.value && !formEquipo.value.id,
  alRestaurar: () => {
    modalEquipo.value = true
  },
})
const restauradoEquipo = borradorEquipo.restaurado

// abrirModalEquipo (linea 3139) / editarEquipo (linea 3202)
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

// guardarEquipo (linea 3164)
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

// eliminarEquipo (linea 3203): solo admin.
async function eliminarEquipo(item) {
  if (!auth.esAdmin) return
  if (!confirm('Eliminar prestamo de equipo?')) return
  await eliminar('equipos', item.id)
  await datos.recargar('equipos')
}

// Ver firma guardada (linea 2725: window.open(...)).
function verFirma(dataUrl) {
  window.open(dataUrl, '_blank', 'width=400,height=200')
}
</script>

<template>
  <!-- Reservas de equipos (antes solo estaban en el Muro Publico) -->
  <ReservasEquiposPanel />

  <div class="card">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem">
      <h2 style="margin: 0">Prestamo de Equipos</h2>
      <button class="btn btn-primary btn-sm" @click="abrirModalEquipo()">+ Registrar</button>
    </div>

    <!-- renderEquipos (linea 2717) -->
    <div v-if="!equipos.length" class="empty">No hay prestamos de equipos</div>
    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Salida</th>
            <th>Entrega</th>
            <th>Área</th>
            <th>Equipo</th>
            <th>Ref</th>
            <th>Cant</th>
            <th>Solicitante</th>
            <th>Entrada</th>
            <th>Firma</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in equipos" :key="e.id">
            <td>{{ e.fechaSalida }}</td>
            <td>{{ e.entrega }}</td>
            <td>{{ etiquetaArea(e.depto) }}</td>
            <td><strong>{{ e.equipo }}</strong></td>
            <td>{{ e.ref || '-' }}</td>
            <td>{{ e.cantidad }}</td>
            <td>{{ e.solicitante }}</td>
            <td>{{ e.fechaEntrada || '-' }}</td>
            <td>
              <img
                v-if="e.firma"
                :src="e.firma"
                style="width: 60px; height: 24px; object-fit: contain; cursor: pointer"
                title="Ver firma"
                @click="verFirma(e.firma)"
              />
              <template v-else>-</template>
            </td>
            <td class="actions">
              <button class="btn btn-sm btn-outline" @click="abrirModalEquipo(e)">Editar</button>
              <button v-if="auth.esAdmin" class="btn btn-sm btn-danger" @click="eliminarEquipo(e)">
                Eliminar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- ============ MODAL EQUIPO ============ -->
  <BaseModal :abierto="modalEquipo" @cerrar="modalEquipo = false">
    <h2>{{ formEquipo.id ? 'Editar Prestamo Equipo' : 'Registrar Prestamo Equipo' }}</h2>
    <p v-if="restauradoEquipo" class="borrador-aviso">
      Se recuperó el borrador que tenías sin guardar.
    </p>
    <form @submit.prevent="guardarEquipo">
      <div><label>Fecha Salida</label><input v-model="formEquipo.fechaSalida" type="date" required /></div>
      <div><label>Quien Entrega</label><input v-model="formEquipo.entrega" required /></div>
      <div>
        <label>Área</label>
        <select v-model="formEquipo.depto" required>
          <option value="">Seleccione</option>
          <option v-for="a in AREAS" :key="a" :value="a">{{ etiquetaArea(a) }}</option>
        </select>
      </div>
      <div><label>Equipo</label><input v-model="formEquipo.equipo" required /></div>
      <div><label>Referencia</label><input v-model="formEquipo.ref" /></div>
      <div><label>Cantidad</label><input v-model="formEquipo.cantidad" type="number" required /></div>
      <div><label>Solicitante</label><input v-model="formEquipo.solicitante" required /></div>
      <div><label>Fecha Entrada</label><input v-model="formEquipo.fechaEntrada" type="date" /></div>
      <div class="full">
        <label>Firma</label>
        <FirmaCanvas v-model="formEquipo.firma" :alto="120" />
      </div>
      <div class="full" style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.5rem">
        <button type="button" class="btn btn-outline" @click="modalEquipo = false">Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar</button>
      </div>
    </form>
  </BaseModal>
</template>

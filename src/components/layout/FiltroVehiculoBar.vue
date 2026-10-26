<script setup>
// Barra del filtro global por vehiculo. Se muestra en App.vue cuando la ruta
// tiene meta.filtroVehiculo y el usuario es admin.
import { useFiltroStore } from '@/stores/filtro'

const filtro = useFiltroStore()
</script>

<template>
  <div class="filter-bar filtro-global">
    <label for="filtroVehiculoGlobal">Filtrar por vehículo:</label>
    <select
      id="filtroVehiculoGlobal"
      :value="filtro.vehiculo"
      @change="filtro.seleccionar($event.target.value)"
    >
      <option v-if="!filtro.opciones.length" value="">No hay vehículos</option>
      <option v-else value="">Todos los vehículos</option>
      <option v-for="v in filtro.opciones" :key="v.placa" :value="v.placa">
        {{ v.texto }}
      </option>
    </select>
    <span v-if="filtro.activo" class="filtro-badge">Mostrando solo: {{ filtro.etiqueta }}</span>
    <button v-if="filtro.activo" type="button" class="btn btn-sm btn-outline" @click="filtro.limpiar()">
      Quitar filtro
    </button>
  </div>
</template>

<style scoped>
.filtro-global {
  align-items: center;
  flex-wrap: wrap;
}

.filtro-badge {
  font-size: 0.75rem;
  color: #6b7280;
}

.filtro-global .btn {
  padding: 0.25rem 0.6rem;
  font-size: 0.7rem;
}
</style>

<script setup>
// Selector multiple de accesorios. Guarda un string separado por comas para no
// cambiar el formato de los documentos existentes.
import { computed, ref } from 'vue'
import { ACCESORIOS, joinAccesorios, parseAccesorios } from '@/utils/equipos'

const props = defineProps({
  modelValue: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const seleccionados = computed({
  get: () => parseAccesorios(props.modelValue),
  set: (valor) => emit('update:modelValue', joinAccesorios(valor)),
})

const otro = ref('')

const opciones = computed(() => {
  const extras = seleccionados.value.filter((x) => !ACCESORIOS.includes(x))
  return [...ACCESORIOS, ...extras]
})

const resumen = computed(() => {
  const lista = seleccionados.value
  if (!lista.length) return 'Seleccionar accesorios'
  if (lista.length <= 2) return lista.join(', ')
  return `${lista.length} accesorios`
})

function agregarOtro() {
  const valor = otro.value.trim()
  if (!valor) return
  if (!seleccionados.value.includes(valor)) {
    seleccionados.value = [...seleccionados.value, valor]
  }
  otro.value = ''
}
</script>

<template>
  <details class="acc-select">
    <summary class="btn btn-outline acc-summary">
      <span class="acc-resumen">{{ resumen }}</span>
      <span class="acc-flecha">▾</span>
    </summary>
    <div class="acc-panel">
      <label v-for="op in opciones" :key="op" class="acc-opcion">
        <input v-model="seleccionados" type="checkbox" :value="op" />
        <span>{{ op }}</span>
      </label>
      <div class="acc-otro">
        <input
          v-model="otro"
          type="text"
          placeholder="Otro accesorio"
          @keydown.enter.prevent="agregarOtro"
        />
        <button type="button" class="btn btn-sm btn-outline" @click="agregarOtro">Agregar</button>
      </div>
    </div>
  </details>
</template>

<style scoped>
.acc-select {
  width: 100%;
}
.acc-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  width: 100%;
  cursor: pointer;
  list-style: none;
}
.acc-summary::-webkit-details-marker {
  display: none;
}
.acc-flecha {
  color: #9ca3af;
}
.acc-resumen {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}
.acc-panel {
  margin-top: 0.3rem;
  padding: 0.5rem 0.6rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  display: grid;
  gap: 0.35rem;
  max-height: 220px;
  overflow-y: auto;
}
.acc-opcion {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: #374151;
  font-weight: 400;
}
.acc-opcion input {
  width: auto;
}
.acc-otro {
  display: flex;
  gap: 0.35rem;
  padding-top: 0.4rem;
  border-top: 1px solid #e5e7eb;
}
.acc-otro input {
  flex: 1;
  min-width: 0;
  width: auto;
}
</style>

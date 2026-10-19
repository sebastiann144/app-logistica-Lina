<script setup>
// Reemplaza a los <div class="modal-overlay"> + cerrarModal(id) del original.
// Uso:  <BaseModal :abierto="x" @cerrar="x = false"> ... </BaseModal>
defineProps({
  abierto: { type: Boolean, default: false },
  ancho: { type: String, default: '' },
})

const emit = defineEmits(['cerrar'])
</script>

<template>
  <div v-if="abierto" class="modal-overlay show" @click.self="emit('cerrar')">
    <div class="modal" :style="ancho ? { maxWidth: ancho } : null">
      <slot />
    </div>
  </div>
</template>

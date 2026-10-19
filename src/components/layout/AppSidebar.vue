<script setup>
import { ref } from 'vue'
import { ITEMS_MENU } from '@/nav'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
// El original expandia la barra al pasar el mouse y con el clic en la marca.
const expandido = ref(false)
</script>

<template>
  <nav
    class="sidebar"
    :class="{ expanded: expandido }"
    @mouseenter="expandido = true"
    @mouseleave="expandido = false"
  >
    <div class="brand" @click="expandido = !expandido">
      <span class="icon">☰</span>
      <span>Clase Alpha</span>
    </div>
    <div class="nav">
      <RouterLink
        v-for="item in ITEMS_MENU"
        v-show="auth.puede(item.requiere)"
        :key="item.to"
        class="nav-item"
        active-class="active"
        :to="item.to"
      >
        <span class="nav-icon">{{ item.icono }}</span>
        <span class="nav-label">{{ item.etiqueta }}</span>
      </RouterLink>
    </div>
  </nav>
</template>

<style scoped>
.nav-item {
  text-decoration: none;
}
</style>

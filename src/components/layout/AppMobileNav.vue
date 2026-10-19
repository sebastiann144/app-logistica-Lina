<script setup>
import { ITEMS_MENU } from '@/nav'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <nav class="mobile-nav">
    <RouterLink
      v-for="item in ITEMS_MENU"
      v-show="auth.puede(item.requiere)"
      :key="item.to"
      class="mob-item"
      active-class="active"
      :to="item.to"
    >
      <span class="mob-icon">{{ item.icono }}</span>{{ item.corto }}
    </RouterLink>
  </nav>
</template>

<style scoped>
.mob-item {
  text-decoration: none;
}
</style>

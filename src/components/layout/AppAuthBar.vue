<script setup>
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const textoBoton = computed(() =>
  auth.esAdmin ? 'Cerrar sesion admin' : 'Iniciar sesión como admin',
)
</script>

<template>
  <div class="auth-bar">
    <span class="email">{{ auth.etiquetaUsuario }}</span>
    <button class="btn-link" @click="auth.alPresionarBotonSesion()">{{ textoBoton }}</button>
  </div>
</template>

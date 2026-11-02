<script setup>
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

// La sesion anonima del muro publico se muestra como visitante, pero no como
// una cuenta abierta: su boton debe abrir el login, no cerrar sesion.
const textoBoton = computed(() =>
  auth.esCuentaReal ? 'Cerrar sesión' : 'Iniciar sesión como admin',
)
</script>

<template>
  <div class="auth-bar">
    <span class="email">{{ auth.etiquetaUsuario }}</span>
    <button class="btn-link" @click="auth.alPresionarBotonSesion()">{{ textoBoton }}</button>
  </div>
</template>

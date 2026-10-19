<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppAuthBar from '@/components/layout/AppAuthBar.vue'
import AppMobileNav from '@/components/layout/AppMobileNav.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import LoginAdminModal from '@/components/layout/LoginAdminModal.vue'
import { useAuthStore } from '@/stores/auth'
import { useDatosStore } from '@/stores/datos'

// App.vue es el "shell" del index.html original (lineas 481-526): la barra
// lateral, la navegacion movil, la cabecera, la barra de sesion y el contenedor
// donde antes se mostraban/ocultaban los paneles.
const auth = useAuthStore()
const datos = useDatosStore()
const route = useRoute()

// Las vistas de Mant. Equipos y Equipos Asignados ocupan toda la pantalla y no
// llevan cabecera (el original ocultaba .header y .auth-bar en esos tabs).
const sinShell = computed(() => !!route.meta.sinShell)

onMounted(async () => {
  // Espera a saber quien es el usuario antes de pedir los datos.
  await auth.iniciar()
  await datos.cargarTodo()
})
</script>

<template>
  <div class="main-wrapper">
    <AppSidebar />
    <AppMobileNav />
    <div v-if="!sinShell" class="header">
      <h1>Control de Operaciones</h1>
      <div class="user">Lina · Clase Alpha</div>
    </div>
    <AppAuthBar v-if="!sinShell" />
    <div v-if="sinShell" class="embed-wrapper">
      <RouterView />
    </div>
    <div v-else class="container">
      <div v-if="datos.cargando" class="loading-bar show">Cargando datos desde la nube...</div>
      <RouterView />
    </div>
  </div>
  <LoginAdminModal />
</template>

<style scoped>
.embed-wrapper {
  flex: 1;
  min-height: 100vh;
}
</style>

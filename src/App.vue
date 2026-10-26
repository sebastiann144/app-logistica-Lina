<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppAuthBar from '@/components/layout/AppAuthBar.vue'
import AppMobileNav from '@/components/layout/AppMobileNav.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import FiltroVehiculoBar from '@/components/layout/FiltroVehiculoBar.vue'
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

// El filtro global por vehiculo solo aplica a las rutas que lo consumen y solo
// para el admin (las demas cuentas no ven las tablas de vehiculos).
const mostrarFiltro = computed(
  () => !sinShell.value && !!route.meta.filtroVehiculo && auth.esAdmin,
)

// Mientras no se sabe si hay sesion no se piden datos: sin request.auth las
// reglas de Firestore devuelven permission-denied y el muro quedaria vacio.
const conectando = computed(() => !auth.listo)

onMounted(async () => {
  await auth.iniciar()
  if (!auth.errorSesion) await datos.cargarTodo()
})

// Si la sesion anonima fallo por red y luego se recupera sola, se cargan los
// datos pendientes.
watch(
  () => auth.usuario?.uid,
  async (uid) => {
    if (uid && !datos.cargado && !datos.cargando && !auth.errorSesion) {
      await datos.cargarTodo()
    }
  },
)

async function reintentar() {
  if (auth.errorSesion) {
    const ok = await auth.reintentarSesion()
    if (!ok) return
  }
  await datos.cargarTodo()
}
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
      <div v-if="conectando" class="estado-conexion">Conectando con el servidor…</div>
      <RouterView v-else />
    </div>
    <div v-else class="container">
      <div v-if="conectando" class="estado-conexion">Conectando con el servidor…</div>

      <div v-else-if="auth.errorSesion" class="alert-bar show">
        <h3>No se pudo conectar con el servidor</h3>
        <p>{{ auth.errorSesion }}</p>
        <button class="btn btn-primary btn-sm" @click="reintentar">Reintentar</button>
      </div>

      <template v-else>
        <div v-if="datos.cargando" class="loading-bar show">Cargando datos desde la nube...</div>

        <template v-else>
          <div v-if="datos.error" class="alert-bar show">
            <h3>Algunos datos no se pudieron cargar</h3>
            <p>{{ datos.error }}</p>
            <button class="btn btn-primary btn-sm" @click="reintentar">Reintentar</button>
          </div>

          <FiltroVehiculoBar v-if="mostrarFiltro" />
          <RouterView />
        </template>
      </template>
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

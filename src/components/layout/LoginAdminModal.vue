<script setup>
import { nextTick, ref, watch } from 'vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { ADMIN_EMAIL } from '@/firebase'
import { useAuthStore } from '@/stores/auth'

// Traduccion del <div id="modalLoginAdmin"> y de iniciarSesionAdmin() /
// restablecerContrasena() de index.html (lineas 1170-1184 y 1356-1386).
const auth = useAuthStore()

const email = ref(ADMIN_EMAIL)
const password = ref('')
const inputPassword = ref(null)

watch(
  () => auth.loginAbierto,
  async (abierto) => {
    if (!abierto) return
    password.value = ''
    await nextTick()
    inputPassword.value?.focus()
  },
)

async function enviar() {
  const ok = await auth.iniciarSesion(email.value, password.value)
  if (ok) password.value = ''
}
</script>

<template>
  <BaseModal :abierto="auth.loginAbierto" ancho="380px" @cerrar="auth.cerrarLogin()">
    <h2>Iniciar sesión como administrador</h2>
    <form @submit.prevent="enviar">
      <div class="full">
        <label>Correo electrónico</label>
        <input v-model="email" type="email" autocomplete="username" required />
      </div>
      <div class="full">
        <label>Contraseña</label>
        <input
          ref="inputPassword"
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
        />
      </div>
      <div class="full" style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.5rem">
        <button type="button" class="btn btn-outline" @click="auth.cerrarLogin()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Ingresar</button>
      </div>
    </form>
    <button
      type="button"
      class="btn-link"
      style="margin-top: 0.75rem"
      @click="auth.restablecerContrasena(email)"
    >
      ¿Olvidaste tu contraseña?
    </button>
    <p v-if="auth.avisoReset" style="color: #166534; font-size: 0.8rem; margin: 0.75rem 0 0">
      {{ auth.avisoReset }}
    </p>
    <p v-if="auth.errorLogin" style="color: #b91c1c; font-size: 0.8rem; margin: 0.75rem 0 0">
      {{ auth.errorLogin }}
    </p>
  </BaseModal>
</template>

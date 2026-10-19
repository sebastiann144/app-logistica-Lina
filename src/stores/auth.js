// Sesion de Firebase y roles.
//
// Traduccion de la seccion "AUTH" de index.html (lineas 1303-1386) mas el
// inicio de sesion anonimo que usaba muro-publico.html (lineas 432-461).
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { ADMIN_EMAIL, EDITOR_EQUIPOS_EMAIL, VISITANTE_MANT_EMAIL, auth } from '@/firebase'

export const useAuthStore = defineStore('auth', () => {
  const usuario = ref(null)
  const listo = ref(false)
  const loginAbierto = ref(false)
  const errorLogin = ref('')
  const avisoReset = ref('')

  const email = computed(() => usuario.value?.email || '')
  const esAdmin = computed(() => email.value === ADMIN_EMAIL)
  const esEditorEquipos = computed(() => email.value === EDITOR_EQUIPOS_EMAIL)
  const esVisitanteMant = computed(() => email.value === VISITANTE_MANT_EMAIL)

  // Permisos de navegacion (antes eran los items "admin-only" del menu).
  const puedeVerMantEquipos = computed(() => esAdmin.value || esVisitanteMant.value)
  const puedeVerEquiposAsignados = computed(() => esAdmin.value || esEditorEquipos.value)
  const puedeEditarEquipos = computed(() => esAdmin.value || esEditorEquipos.value)

  const etiquetaUsuario = computed(() => {
    if (!usuario.value) return 'No conectado'
    return usuario.value.email || 'Visitante'
  })

  let iniciado = false
  let resolverListo = null
  // Se resuelve la primera vez que Firebase responde quien es el usuario.
  // El router la espera antes de decidir si puede mostrar una ruta de admin.
  const promesaListo = new Promise((resolve) => {
    resolverListo = resolve
  })

  // Se llama una sola vez al arrancar la app (ver App.vue).
  function iniciar() {
    if (iniciado) return promesaListo
    iniciado = true
    onAuthStateChanged(auth, (user) => {
      usuario.value = user
      listo.value = true
      resolverListo()
      // El muro publico hacia signInAnonymously() para que un visitante sin
      // cuenta pudiera escribir reservas. Se conserva igual.
      if (!user) signInAnonymously(auth).catch(() => {})
    })
    return promesaListo
  }

  function esperarListo() {
    return iniciar()
  }

  // Equivale a las comprobaciones de cambiarTab(): que rol puede ver que.
  function puede(requiere) {
    if (!requiere) return true
    if (requiere === 'admin') return esAdmin.value
    if (requiere === 'mant') return puedeVerMantEquipos.value
    if (requiere === 'equipos') return puedeVerEquiposAsignados.value
    return false
  }

  function abrirLogin() {
    errorLogin.value = ''
    avisoReset.value = ''
    loginAbierto.value = true
  }

  function cerrarLogin() {
    loginAbierto.value = false
  }

  async function iniciarSesion(emailEscrito, password) {
    errorLogin.value = ''
    avisoReset.value = ''
    try {
      await signInWithEmailAndPassword(auth, emailEscrito.trim().toLowerCase(), password)
      cerrarLogin()
      return true
    } catch {
      errorLogin.value = 'No se pudo iniciar sesión. Verifica el correo y la contraseña.'
      return false
    }
  }

  async function restablecerContrasena(emailEscrito) {
    errorLogin.value = ''
    avisoReset.value = ''
    if (!emailEscrito) {
      errorLogin.value = 'Escribe primero el correo electrónico.'
      return
    }
    try {
      await sendPasswordResetEmail(auth, emailEscrito.trim().toLowerCase())
      avisoReset.value = 'Enlace enviado. Revisa el correo y la carpeta de spam.'
    } catch {
      errorLogin.value = 'No se pudo enviar el enlace. Verifica que el usuario exista.'
    }
  }

  async function cerrarSesion() {
    await signOut(auth)
  }

  // Comportamiento del boton de la barra de sesion:
  // si ya es admin cierra sesion; si no, abre el modal de acceso.
  function alPresionarBotonSesion() {
    if (esAdmin.value) {
      cerrarSesion()
      return
    }
    abrirLogin()
  }

  return {
    usuario,
    listo,
    loginAbierto,
    errorLogin,
    avisoReset,
    email,
    esAdmin,
    esEditorEquipos,
    esVisitanteMant,
    puedeVerMantEquipos,
    puedeVerEquiposAsignados,
    puedeEditarEquipos,
    etiquetaUsuario,
    iniciar,
    esperarListo,
    puede,
    abrirLogin,
    cerrarLogin,
    iniciarSesion,
    restablecerContrasena,
    cerrarSesion,
    alPresionarBotonSesion,
  }
})

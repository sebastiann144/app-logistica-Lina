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
  const cargandoSesion = ref(false)
  const errorSesion = ref('')
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
  let intentandoAnonimo = false
  // Se resuelve cuando ya se sabe quien es el usuario Y, si no hay cuenta, ya se
  // intento abrir la sesion anonima. El router la espera antes de decidir si
  // puede mostrar una ruta de admin y App.vue antes de pedir los datos.
  const promesaListo = new Promise((resolve) => {
    resolverListo = resolve
  })

  const ESPERA_SESION_MS = 12000

  function resolver() {
    if (listo.value) return
    listo.value = true
    resolverListo()
  }

  // Si Firebase no responde (red lenta), no se deja el Muro en blanco para
  // siempre: a los 12 s se muestra el error con boton de reintentar.
  function conLimite(promesa) {
    return Promise.race([
      promesa,
      new Promise((_, rechazar) => {
        setTimeout(() => rechazar(new Error('tiempo de espera agotado')), ESPERA_SESION_MS)
      }),
    ])
  }

  // Se llama una sola vez al arrancar la app (ver App.vue).
  function iniciar() {
    if (iniciado) return promesaListo
    iniciado = true
    cargandoSesion.value = true
    // Red de seguridad: si Firebase ni siquiera entrega el estado inicial de la
    // sesion (red caida a medias), no se deja la app en "Conectando..." para
    // siempre.
    setTimeout(() => {
      if (listo.value) return
      errorSesion.value =
        'No se pudo conectar con el servidor. Revisa la conexión e inténtalo de nuevo.'
      cargandoSesion.value = false
      resolver()
    }, ESPERA_SESION_MS)
    onAuthStateChanged(auth, async (user) => {
      usuario.value = user
      if (user) {
        errorSesion.value = ''
        cargandoSesion.value = false
        resolver()
        return
      }
      // No hay cuenta: el muro publico y las reglas de Firestore necesitan una
      // sesion (request.auth != null), asi que se entra como anonimo.
      if (intentandoAnonimo) return
      intentandoAnonimo = true
      cargandoSesion.value = true
      try {
        await conLimite(signInAnonymously(auth))
        // onAuthStateChanged volvera a llamar con el usuario anonimo.
      } catch (e) {
        console.error('No se pudo iniciar la sesion anonima', e)
        errorSesion.value =
          'No se pudo conectar con el servidor. Revisa la conexión e inténtalo de nuevo.'
        cargandoSesion.value = false
        resolver()
      } finally {
        intentandoAnonimo = false
      }
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

  // Reintenta la sesion anonima cuando fallo la conexion inicial.
  async function reintentarSesion() {
    if (usuario.value) {
      errorSesion.value = ''
      return true
    }
    errorSesion.value = ''
    cargandoSesion.value = true
    try {
      await conLimite(signInAnonymously(auth))
      return true
    } catch (e) {
      console.error('No se pudo reintentar la sesion anonima', e)
      errorSesion.value =
        'No se pudo conectar con el servidor. Revisa la conexión e inténtalo de nuevo.'
      return false
    } finally {
      cargandoSesion.value = false
    }
  }

  // Comportamiento del boton de la barra de sesion:
  // si hay cualquier cuenta abierta (admin, editor o mantenimiento) cierra
  // sesion; si no, abre el modal de acceso.
  function alPresionarBotonSesion() {
    if (usuario.value) {
      cerrarSesion()
      return
    }
    abrirLogin()
  }

  return {
    usuario,
    listo,
    cargandoSesion,
    errorSesion,
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
    reintentarSesion,
    puede,
    abrirLogin,
    cerrarLogin,
    iniciarSesion,
    restablecerContrasena,
    cerrarSesion,
    alPresionarBotonSesion,
  }
})

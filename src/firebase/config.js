// Configuracion del proyecto Firebase de Clase Alpha.
//
// Las llaves de una app Web de Firebase no son secretas (terminan en el navegador
// de todas formas); por eso se pueden dejar aqui como respaldo y sobreescribirse
// con un archivo `.env` para apuntar a otro proyecto (por ejemplo, uno de pruebas).
const env = import.meta.env

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyB7IoSFjYBtcKora_G8gQMo7XQUTKEoZGw',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'prestamo-revision--carro-alpha.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'prestamo-revision--carro-alpha',
  storageBucket:
    env.VITE_FIREBASE_STORAGE_BUCKET || 'prestamo-revision--carro-alpha.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '375783718261',
  appId: env.VITE_FIREBASE_APP_ID || '1:375783718261:web:7e195847867deb92cfe73c',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || 'G-VNJPDRPPJL',
}

// Correos con permisos especiales dentro de la aplicacion.
export const ADMIN_EMAIL = env.VITE_ADMIN_EMAIL || 'operacionesclasealpha@gmail.com'
export const EDITOR_EQUIPOS_EMAIL =
  env.VITE_EDITOR_EQUIPOS_EMAIL || 'gestionhumanaclasealpha@gmail.com'
export const VISITANTE_MANT_EMAIL =
  env.VITE_VISITANTE_MANT_EMAIL || 'admonclasealphados@gmail.com'

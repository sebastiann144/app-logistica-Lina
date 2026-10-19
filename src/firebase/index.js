// Punto unico de inicializacion de Firebase.
//
// Es la traduccion del SDK "compat" que la app original cargaba por CDN en cada
// pagina HTML (firebase-app-compat.js, firebase-firestore-compat.js, ...) al SDK
// modular. Al ser una sola instancia compartida por toda la app, desaparece la
// necesidad de compartir la conexion entre iframes con window.parent.mainDb.
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth'
import { firebaseConfig } from './config'

export const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)

// Equivale a auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL) del original.
setPersistence(auth, browserLocalPersistence).catch(() => {})

export * from './config'

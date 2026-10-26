// Traduccion de los "FIRESTORE HELPERS" del original (db.collection(...).get/add/...)
// al SDK modular de Firebase.
//
// El original tenia el mismo bloque repetido en cada pagina HTML; aqui vive una
// sola vez y las vistas solo llaman a estas funciones.
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/firebase'

// Se re-exportan para que las vistas con logica mas compleja (por ejemplo las que
// usan batch) no tengan que importar de firebase/firestore directamente.
export {
  addDoc,
  collection,
  db,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
}

// Equivale a: db.collection(nombre).orderBy(campo).get()
export async function listar(nombre, campo = 'createdAt') {
  const snap = await getDocs(query(collection(db, nombre), orderBy(campo)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// Igual que listar() pero sin orderBy. Firestore excluye los documentos que no
// tienen el campo de orden, asi que se usa en colecciones historicas donde
// algunos registros viejos no lo tienen (por ejemplo checklistDespachoRutas:
// hay fichas sin createdAt).
export async function listarTodos(nombre) {
  const snap = await getDocs(collection(db, nombre))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// Equivale a: const ref = db.collection(nombre).doc(); ref.set(datos)
export async function crear(nombre, datos) {
  const ref = await addDoc(collection(db, nombre), {
    ...datos,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

// Equivale a: db.collection(nombre).doc(id).set(datos) sin sobrescribir createdAt
export async function crearConId(nombre, id, datos) {
  await setDoc(doc(db, nombre, id), datos, { merge: true })
  return id
}

// Equivale a: db.collection(nombre).doc(id).update(datos)
export async function actualizar(nombre, id, datos) {
  await updateDoc(doc(db, nombre, id), datos)
}

// Equivale a: db.collection(nombre).doc(id).delete()
export async function eliminar(nombre, id) {
  await deleteDoc(doc(db, nombre, id))
}

// Equivale a: db.collection(nombre).doc(id).get()
export async function obtener(nombre, id) {
  const snap = await getDoc(doc(db, nombre, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

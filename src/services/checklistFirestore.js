// Persistencia del modulo de checklists por ruta.
//
// El catalogo se guarda en `checklistCatalogo` (un documento por item) para que
// los codigos editados por Lina sean los mismos para Admin y Conductor. Las rutas
// viven en `checklistRutas`; los movimientos van en una coleccion plana aparte
// para poder consultar la historia de un equipo sin recorrer todas las rutas.
//
// Firestore encola las escrituras cuando no hay red (persistencia local en
// firebase/index.js), asi que el operario puede seguir trabajando en la ruta.
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from '@/services/firestore'
import { db } from '@/firebase'
import { crearCatalogo } from '@/utils/checklistPlantillas'

const COLECCION_CATALOGO = 'checklistCatalogo'
const COLECCION_RUTAS = 'checklistRutas'
const COLECCION_MOVIMIENTOS = 'movimientosEquipo'

function desdeFirestore(snap) {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function cargarCatalogo() {
  const porDefecto = crearCatalogo()
  try {
    const snap = await getDocs(collection(db, COLECCION_CATALOGO))
    const guardados = desdeFirestore(snap)
    if (!guardados.length) {
      // Inicializacion controlada: no migra datos viejos, solo crea el catalogo
      // nuevo con los codigos generados automáticamente.
      const batch = writeBatch(db)
      porDefecto.forEach((item) => {
        batch.set(doc(db, COLECCION_CATALOGO, item.id), { ...item, actualizadoEn: serverTimestamp() })
      })
      await batch.commit()
      return porDefecto
    }
    const porId = Object.fromEntries(guardados.map((i) => [i.id, i]))
    return porDefecto.map((item) => ({
      ...item,
      ...porId[item.id],
      codigo: porId[item.id]?.codigo || item.codigo,
    }))
  } catch (error) {
    console.warn('No se pudo cargar el catálogo del checklist; se usa el local', error)
    return porDefecto
  }
}

export async function guardarCodigoCatalogo(item) {
  await setDoc(
    doc(db, COLECCION_CATALOGO, item.id),
    { codigo: String(item.codigo || '').trim().toUpperCase(), actualizadoEn: serverTimestamp() },
    { merge: true },
  )
}

export async function listarRutas() {
  const snap = await getDocs(collection(db, COLECCION_RUTAS))
  return desdeFirestore(snap).sort((a, b) =>
    String(b.fecha || '').localeCompare(String(a.fecha || '')),
  )
}

// Guarda la ruta completa. El id se genera aca para poder usarlo en los
// movimientos antes de que Firestore asigne uno automatico.
export async function guardarRuta(ruta) {
  const datos = { ...ruta, actualizadoEn: serverTimestamp() }
  delete datos.id
  if (!ruta.id) {
    const referencia = doc(collection(db, COLECCION_RUTAS))
    await setDoc(referencia, { ...datos, creadoEn: serverTimestamp() })
    return referencia.id
  }
  await setDoc(doc(db, COLECCION_RUTAS, ruta.id), datos, { merge: true })
  return ruta.id
}

export async function registrarMovimientos(rutaId, movimientos) {
  if (!movimientos.length) return
  const batch = writeBatch(db)
  movimientos.forEach((mov, index) => {
    const referencia = doc(collection(db, COLECCION_MOVIMIENTOS))
    batch.set(referencia, {
      ...mov,
      rutaId,
      creadoEn: serverTimestamp(),
      secuencia: index + 1,
    })
  })
  await batch.commit()
}

export async function listarMovimientos() {
  const snap = await getDocs(collection(db, COLECCION_MOVIMIENTOS))
  return desdeFirestore(snap).sort((a, b) =>
    String(a.creadoEn?.toMillis?.() || a.fechaHora || '').localeCompare(
      String(b.creadoEn?.toMillis?.() || b.fechaHora || ''),
    ),
  )
}

export function fechaHoraLocal() {
  const ahora = new Date()
  return {
    fecha: ahora.toISOString().slice(0, 10),
    hora: ahora.toTimeString().slice(0, 5),
    fechaHora: ahora.toISOString(),
  }
}

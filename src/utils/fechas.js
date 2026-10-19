// Helpers de fechas usados por varias pantallas.
// Son la traduccion literal de los del original (index.html lineas 1553-1557).

// new Date().toISOString() trabaja en UTC: en Colombia (UTC-5) despues de las
// 19:00 devuelve el dia siguiente. Se mantiene igual que el original a
// proposito para no cambiar el comportamiento de los datos ya guardados.
export function hoy() {
  return new Date().toISOString().split('T')[0]
}

export function ahora() {
  return new Date().toTimeString().slice(0, 5)
}

export function diffDias(a, b) {
  return Math.round((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24))
}

// Formatea un valor de Firestore (Timestamp, Date o string) como dd/mm/aaaa.
export function formatearFecha(valor) {
  if (!valor) return '-'
  if (typeof valor === 'string') return valor
  if (typeof valor.toDate === 'function') return valor.toDate().toLocaleDateString('es-CO')
  if (valor instanceof Date) return valor.toLocaleDateString('es-CO')
  return String(valor)
}

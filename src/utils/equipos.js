// Accesorios que se pueden seleccionar al asignar o devolver un equipo.
// Se guardan como string separado por comas para mantener compatibilidad con
// los registros existentes ("Mouse, Cargador, ...").
export const ACCESORIOS = [
  'Mouse',
  'Teclado',
  'Audífonos',
  'Cargador',
  'Estuche',
  'Forro',
  'Base',
  'Cable',
]

// Convierte "Mouse, Cargador" en ['Mouse', 'Cargador'] sin duplicados.
// Tambien acepta punto y coma porque algunos registros viejos lo usaban.
export function parseAccesorios(valor) {
  if (!valor) return []
  const vistos = new Set()
  return String(valor)
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter((x) => {
      if (!x) return false
      const key = x
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
      if (vistos.has(key)) return false
      vistos.add(key)
      return true
    })
}

// Vuelve a armar el string que se guarda en Firestore.
export function joinAccesorios(lista) {
  return parseAccesorios((lista || []).join(',')).join(', ')
}

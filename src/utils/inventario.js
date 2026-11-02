// Helpers de inventario: traduccion de las funciones inv*/normalizarInventario
// de index.html (lineas 3705-3730).
// Copiado tal cual de index.html (lineas 3707-3711).
export const INV_ICONOS = {
  Computador: '💻',
  Portátil: '💻',
  Monitor: '🖥️',
  Impresora: '🖨️',
  Celular: '📱',
  Tablet: '📱',
  Router: '📡',
  Teléfono: '📞',
  Escáner: '📄',
  UPS: '🔋',
  Escritorio: '🗄️',
  Silla: '🪑',
  Otros: '📦',
}

// Catalogo de tipos seleccionables en el modal de inventario (index.html 3913-3927).
export const INV_TIPOS = Object.entries(INV_ICONOS).map(([valor, icono]) => ({
  valor,
  icono,
  etiqueta: valor,
}))

export function invIcono(tipo) {
  return INV_ICONOS[tipo] || '📦'
}

export function invTipoIcono(valor) {
  return INV_ICONOS[valor] || '📦'
}

export function invRef(e) {
  return e.referencia || e.codigo || 'SIN-REF'
}

// Tipos que se controlan como uso comun. Las sillas son la excepcion: si
// tienen un responsable real (por ejemplo las sillas de oficina que se llevan
// a casa), siguen siendo activos asignables. Escritorio, Otros e Impresora se
// controlan siempre por cantidad/ubicacion (impresoras, microondas, mesones...).
export const TIPOS_COMUNES = ['Silla', 'Escritorio', 'Otros', 'Impresora']
const TIPOS_COMUNES_SIEMPRE = ['Escritorio', 'Otros', 'Impresora']

// Textos que en los datos viejos significan "sin responsable".
export function esSinAsignar(nombre) {
  const texto = String(nombre || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return !texto || ['sin asignar', 'sin asignacion', 'n/a', 'na', '-'].includes(texto)
}

// invAsignaciones (3967): asignaciones actuales del equipo.
export function invAsignaciones(e) {
  if (Array.isArray(e.asignaciones) && e.asignaciones.length) {
    return e.asignaciones
  }
  const lista = []
  if (e.asignadoA || e.ubicacion) {
    lista.push({ nombre: e.asignadoA || '', ubicacion: e.ubicacion || '' })
  }
  return lista
}

// invEsComun (3731): clasifica el equipo como uso comun.
// - Si el documento trae controlTipo/requiereAsignacion, manda ese valor.
// - Las sillas solo son comunes si no tienen una persona responsable.
// - Escritorio, Otros e Impresora son comunes siempre.
export function invEsComun(e) {
  if (e.controlTipo) return e.controlTipo === 'comun'
  if (e.requiereAsignacion !== undefined) return !e.requiereAsignacion

  const tipo = String(e.tipo || '').trim()
  if (tipo === 'Silla') {
    return !invAsignaciones(e).some((a) => a.nombre && !esSinAsignar(a.nombre))
  }
  return TIPOS_COMUNES_SIEMPRE.includes(tipo)
}

// invEstaAsignado (3978): hay una persona responsable real. Una ubicacion
// suelta (Bodega, Cocina...) no convierte el activo en "asignado".
export function invEstaAsignado(e) {
  return invAsignaciones(e).some((a) => a.nombre && !esSinAsignar(a.nombre))
}

// invUnidades (3738) / invUnidadesAsignadas (3739)
export function invUnidades(e) {
  return Math.max(1, parseInt(e.existencias) || 1)
}
export function invUnidadesAsignadas(e) {
  return invEstaAsignado(e) ? invUnidades(e) : 0
}

// normalizarInventario(e): completa los campos que pueden faltar en documentos
// viejos para que las pantallas no tengan que preguntar por ellos.
export function normalizarInventario(e) {
  let asignaciones = Array.isArray(e.asignaciones) ? e.asignaciones : []
  if (!asignaciones.length && (e.asignadoA || e.ubicacion)) {
    asignaciones = [{ nombre: e.asignadoA || '', ubicacion: e.ubicacion || '' }]
  }
  return {
    ...e,
    referencia: e.referencia || e.codigo || '',
    nombreRef: e.nombreRef || e.codigo || e.referencia || '',
    existencias: e.existencias != null ? e.existencias : 1,
    codigo: e.codigo || '',
    asignaciones,
  }
}

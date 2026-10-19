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

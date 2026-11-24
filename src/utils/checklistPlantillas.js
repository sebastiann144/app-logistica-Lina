// Definiciones de los tres checklists de operacion.
//
// No hay codigos de equipos: eso queda fuera de este modulo. Aqui solo se define
// el inventario de referencia de cada planilla y que elementos son "fijos"
// (los numeros rojos de la hoja fisica: siempre van en esa canasta y casi no se
// mueven). La trazabilidad se hace por referencia, no por codigo.
//
// Los consumibles siguen marcados: si la diferencia entre Enviado y Devuelto se
// debe a consumo, se permite con observacion.

function item(id, referencia, grupo, opciones = {}) {
  return {
    id,
    referencia,
    grupo,
    consumible: false,
    dosCantidades: false,
    cantidad: 1,
    nuevas: '',
    usadas: '',
    ...opciones,
  }
}

const DEFINICION = [
  // Generales / sonido.
  item('hoja-vida-asamblea', 'Hoja de Vida de asamblea', 'Documentos', { consumible: true }),
  item('elementos-votacion', 'Elementos de Votación', 'Generales'),
  item('pantalla-tripode-pendon', 'Pantalla con trípode + Pendón', 'Sonido'),
  item('bafle-tripode', 'Bafle con trípode', 'Sonido'),
  item('extension-sonido', 'Extensión sonido', 'Tula sonido'),
  item('cable-canon-xlr', 'Cable Canon XLR', 'Tula sonido'),
  item('regleta-sonido', 'Regleta', 'Tula sonido'),

  // Canasta gris / video.
  item('jumbolon', 'Jumbolon inferior y superior', 'Canasta Gris'),
  item('microfono-cableado', 'Micrófono cableado', 'Canasta Gris'),
  item('microfono-inalambrico', 'Micrófono inalámbrico', 'Canasta Gris', { cantidad: 2 }),
  item('interfaz-microfonos', 'Interfaz micrófonos inalámbricos', 'Canasta Gris'),
  item('video-beam', 'Video Beam + cable poder + HDMI', 'Canasta Gris'),
  item('cable-poder', 'Cable de poder', 'Canasta Gris'),
  item('cable-hdmi', 'Cable HDMI', 'Canasta Gris'),
  item('transmisor-hdmi', 'Transmisor HDMI con WIFI', 'Canasta Gris', { cantidad: 2 }),
  item('usb', 'Cable USB', 'Canasta Gris', { cantidad: 2 }),
  item('mini-hub', 'Mini HUB', 'Canasta Gris'),
  item('transformador', 'Transformador', 'Canasta Gris'),
  item('trapos', 'Trapos', 'Canasta Gris', { cantidad: 2 }),

  // Caja 1.
  item('gancho-celular', 'Gancho seguridad celular', 'Caja 1'),
  item('celular', 'Celular', 'Caja 1'),
  item('cargador-celular', 'Cargador celular', 'Caja 1'),
  item('interfaz-behringer', 'Interfaz Behringer', 'Caja 1'),
  item('grabadora', 'Grabadora de Periodista', 'Caja 1'),
  item('cable-2x1', 'Cable 2 x 1', 'Caja 1'),
  item('cable-plug-plug', 'Cable de plug a plug', 'Caja 1', { cantidad: 2 }),
  item('cable-usb-cuadrado', 'Cable USB con puerto cuadrado', 'Caja 1'),
  item('cable-canon-plug', 'Cable Canon XLR a plug', 'Caja 1'),
  item('memoria-usb', 'Memoria USB con música', 'Caja 1'),

  // Accesorios.
  item('boton', 'Botón', 'Accesorios'),
  item('lapicero', 'Lapicero', 'Accesorios'),
  item('fusibles', 'Fusibles de repuesto (extensión, bafle)', 'Accesorios', {
    cantidad: 3,
    consumible: true,
  }),
  item('benjamin', 'Benjamín', 'Accesorios'),
  item('marrana', 'Marrana', 'Accesorios'),
  item('chequeador', 'Chequeador', 'Accesorios'),
  item('bandas', 'Paquete de bandas elásticas', 'Accesorios'),
  // Rótulos redondos (sonido) y rótulos rojos (votación) son el mismo control.
  item('rotulos', 'Rótulos', 'Accesorios', { consumible: true }),
  item('tarjetas-empresa', 'Tarjetas de la empresa', 'Accesorios', { consumible: true }),
  item('correas', 'Paquete de correas plásticas', 'Accesorios'),
  item('cinta', 'Cinta de enmascarar', 'Accesorios', { consumible: true }),
  item('tripa-pollo', 'Tripa pollo (sujetar la pantalla)', 'Accesorios', { consumible: true }),
  item('pilas', 'Pilas AAA (Nuevas / Usadas)', 'Accesorios', {
    consumible: true,
    dosCantidades: true,
    cantidad: 4,
  }),

  // Proyección doble.
  item('computador', 'Computador + cable poder', 'Proyección doble'),
  item('cable-rj45', 'Cable RJ45 UTP', 'Proyección doble'),
  item('splitter', 'Splitter + cable poder', 'Proyección doble'),
  item('extensor-hd', 'Extensor HD - RJ45 - TX - RX', 'Proyección doble', { cantidad: 2 }),
  item('extension-proyeccion', 'Extensión', 'Proyección doble'),
  item('regleta-proyeccion', 'Regleta', 'Proyección doble'),

  // Votación.
  item('hojas-asistencia', 'Hojas de asistencia', 'Votación', { consumible: true, cantidad: 0 }),
  item('acta-entrega', 'Hoja acta de entrega de asamblea', 'Votación', { consumible: true, cantidad: 0 }),
  item('hoja-vida-registro', 'Hoja de vida Registro, Votación', 'Votación', {
    consumible: true,
    cantidad: 0,
  }),
  item('tarjetas-qr', 'Tarjetas Códigos QR', 'Votación', { consumible: true, cantidad: 0 }),
  item('cosedora-clips', 'Cosedora con ganchos ó Clips', 'Votación'),
  item('apoyadores', 'Apoyadores', 'Votación', { cantidad: 2 }),

  // Grabación.
  item('amarraderas', 'Paquete amarraderas', 'Grabación'),
]

// Paletas 1 al 9: "Paletas para dar la palabra".
const PALETAS = Array.from({ length: 9 }, (_, i) => {
  const numero = String(i + 1).padStart(2, '0')
  return item(`paleta-${numero}`, `Paleta ${i + 1}`, 'Video')
})

const PALETAS_IDS = PALETAS.map((p) => p.id)
const DEFINICION_COMPLETA = [...DEFINICION, ...PALETAS]

// "Números rojos": elementos que siempre van en esa canasta.
// Se marcan por checklist porque el mismo elemento puede ser fijo en una
// planilla y variable en otra.
const FIJOS = {
  sonido: new Set([
    'regleta-sonido',
    'jumbolon',
    'microfono-cableado',
    'microfono-inalambrico',
    'interfaz-microfonos',
    'video-beam',
    'cable-poder',
    'cable-hdmi',
    'transmisor-hdmi',
    'usb',
    'mini-hub',
    'transformador',
    ...PALETAS_IDS,
    'trapos',
    'gancho-celular',
    'celular',
    'cargador-celular',
    'interfaz-behringer',
    'grabadora',
    'cable-2x1',
    'cable-plug-plug',
    'cable-usb-cuadrado',
    'cable-canon-plug',
    'memoria-usb',
    'boton',
    'lapicero',
    'fusibles',
    'benjamin',
    'marrana',
    'chequeador',
    'bandas',
    'rotulos',
    'tarjetas-empresa',
    'correas',
    'cinta',
    'tripa-pollo',
    'computador',
    'cable-rj45',
    'splitter',
    'extensor-hd',
    'extension-proyeccion',
    'regleta-proyeccion',
  ]),
  votacion: new Set([
    'boton',
    'lapicero',
    'tarjetas-empresa',
    'rotulos',
    'bandas',
    'cosedora-clips',
    'apoyadores',
  ]),
  grabacion: new Set([
    'interfaz-behringer',
    'celular',
    'cable-poder',
    'mini-hub',
    'cable-usb-cuadrado',
    'cable-canon-plug',
    'cable-plug-plug',
    'grabadora',
    'cable-2x1',
    'pilas',
    'amarraderas',
    'lapicero',
    'hoja-vida-asamblea',
    ...PALETAS_IDS,
  ]),
}

export const PLANTILLAS = {
  sonido: {
    titulo: 'Checklist de Sonido',
    descripcion: 'Despacho, servicio y devolución de equipos de sonido, video y proyección.',
    grupos: [
      {
        key: 'generales',
        nombre: 'GENERALES',
        icono: '📋',
        items: [
          'hoja-vida-asamblea',
          'elementos-votacion',
          'pantalla-tripode-pendon',
          'bafle-tripode',
          'extension-sonido',
          'cable-canon-xlr',
          'regleta-sonido',
        ],
      },
      {
        key: 'canasta',
        nombre: 'CANASTA GRIS',
        icono: '🧺',
        items: [
          'jumbolon',
          'microfono-cableado',
          'microfono-inalambrico',
          'interfaz-microfonos',
          'video-beam',
          'cable-poder',
          'cable-hdmi',
          'transmisor-hdmi',
          'usb',
          'mini-hub',
          'transformador',
          'trapos',
          ...PALETAS_IDS,
        ],
      },
      {
        key: 'caja',
        nombre: 'CAJA 1',
        icono: '📦',
        items: [
          'gancho-celular',
          'celular',
          'cargador-celular',
          'interfaz-behringer',
          'grabadora',
          'cable-2x1',
          'cable-plug-plug',
          'cable-usb-cuadrado',
          'cable-canon-plug',
          'memoria-usb',
        ],
      },
      {
        key: 'accesorios',
        nombre: 'ACCESORIOS',
        icono: '🧰',
        items: [
          'boton',
          'lapicero',
          'fusibles',
          'benjamin',
          'marrana',
          'chequeador',
          'bandas',
          'rotulos',
          'tarjetas-empresa',
          'correas',
          'cinta',
          'tripa-pollo',
          'pilas',
        ],
      },
      {
        key: 'proyeccion',
        nombre: 'TULA: ELEMENTOS PROYECCIÓN DOBLE',
        icono: '📽️',
        items: [
          'transmisor-hdmi',
          'usb',
          'mini-hub',
          'transformador',
          'video-beam',
          'cable-poder',
          'cable-hdmi',
          'computador',
          'cable-rj45',
          'splitter',
          'extensor-hd',
          'extension-proyeccion',
          'regleta-proyeccion',
        ],
      },
    ],
    // Sonido es la planilla que identifica el equipo por color.
    especiales: ['colorEquipo'],
  },

  votacion: {
    titulo: 'Checklist de Sistema de Votación',
    descripcion: 'Control de hojas, actas y elementos de votación, con retanqueo por paquetes.',
    grupos: [
      {
        key: 'elementos',
        nombre: 'ELEMENTOS',
        icono: '🗳️',
        items: [
          'hojas-asistencia',
          'acta-entrega',
          'hoja-vida-registro',
          'tarjetas-qr',
          'boton',
          'lapicero',
          'tarjetas-empresa',
          'rotulos',
          'bandas',
          'cosedora-clips',
          'apoyadores',
        ],
      },
    ],
    especiales: ['retanqueo', 'respaldoPlataforma'],
  },

  grabacion: {
    titulo: 'Checklist de Sistema de Grabación',
    descripcion: 'Control de la maleta de grabación y verificación del audio entregado.',
    grupos: [
      {
        key: 'maleta',
        nombre: 'MALETA DE GRABACIÓN',
        icono: '🎙️',
        items: [
          'interfaz-behringer',
          'celular',
          'cable-poder',
          'mini-hub',
          'cable-usb-cuadrado',
          'cable-canon-plug',
          'cable-plug-plug',
          'grabadora',
          'cable-2x1',
          'pilas',
          'amarraderas',
          'lapicero',
          'hoja-vida-asamblea',
          ...PALETAS_IDS,
        ],
      },
    ],
    // Grabación se identifica con un número del 1 al 8, no con color.
    especiales: ['numeroEquipo', 'respaldoAudio', 'referenciaVotacion'],
  },
}

export const TIPOS_SERVICIO = Object.keys(PLANTILLAS)

export const ETIQUETAS_TIPO = {
  sonido: 'Sonido',
  votacion: 'Votación',
  grabacion: 'Grabación',
}

// Inventario de referencia, sin ningun codigo asociado.
export function catalogoBase() {
  return DEFINICION_COMPLETA.map((def) => ({ ...def }))
}

export function indiceCatalogo(catalogo) {
  return Object.fromEntries(catalogo.map((item) => [item.id, item]))
}

// Items de una plantilla, en el orden de la hoja fisica.
export function itemsDePlantilla(tipo, catalogo = catalogoBase()) {
  const porId = indiceCatalogo(catalogo)
  const plantilla = PLANTILLAS[tipo] || PLANTILLAS.sonido
  const fijos = FIJOS[tipo] || new Set()
  return plantilla.grupos.flatMap((grupo) =>
    grupo.items
      .filter((id) => porId[id])
      .map((id) => ({ ...porId[id], fijo: fijos.has(id), grupo: grupo.nombre })),
  )
}

// Fila de trabajo de la preparacion o de una parada.
export function filaDesdeCatalogo(item, origen = 'empresa') {
  return {
    itemId: item.id,
    referencia: item.referencia,
    grupo: item.grupo || '',
    fijo: !!item.fijo,
    esConsumible: !!item.consumible,
    dosCantidades: !!item.dosCantidades,
    enviado: origen === 'empresa' ? Number(item.cantidad || 0) : '',
    recibido: '',
    devuelto: '',
    enviadoNuevas: item.dosCantidades && origen === 'empresa' ? Number(item.nuevas || 0) : '',
    enviadoUsadas: item.dosCantidades && origen === 'empresa' ? Number(item.usadas || 0) : '',
    recibidoNuevas: '',
    recibidoUsadas: '',
    devueltoNuevas: '',
    devueltoUsadas: '',
    observacion: '',
  }
}

export function totalFila(fila, columna) {
  if (!fila.dosCantidades) return fila[columna] === '' ? null : Number(fila[columna] || 0)
  const nuevas = fila[`${columna}Nuevas`]
  const usadas = fila[`${columna}Usadas`]
  if (nuevas === '' && usadas === '') return null
  return Number(nuevas || 0) + Number(usadas || 0)
}

export function nombreTipo(tipo) {
  return ETIQUETAS_TIPO[tipo] || tipo
}

// Una hoja se da por vencida 4 dias despues de su fecha: se asume que el carro
// ya regreso a la empresa y la siguiente hoja debe salir en blanco.
export function fechaVencimiento(fecha) {
  if (!fecha) return ''
  const inicio = new Date(`${fecha}T00:00:00`)
  if (Number.isNaN(inicio.getTime())) return ''
  inicio.setDate(inicio.getDate() + 4)
  return inicio.toISOString().slice(0, 10)
}

export function estaVencida(fecha) {
  const vencimiento = fechaVencimiento(fecha)
  if (!vencimiento) return false
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return hoy > new Date(`${vencimiento}T00:00:00`)
}

// Catalogo unico y plantillas de los tres checklists de operacion.
//
// Antes existian tres listas sueltas (sonido, votacion y grabacion) con el mismo
// elemento repetido con nombres distintos. Aqui cada equipo fisico tiene un solo
// id, un solo codigo y un solo historial. Las plantillas solo dicen que items
// usa cada servicio y cual es la cantidad por defecto.
//
// Los consumibles se marcan en el catalogo. La regla de oro del checklist
// (Enviado debe ser igual a Devuelto) no se aplica igual a ellos: si se gastan
// o se dejan en el conjunto, la diferencia se permite con observacion.

function item(id, referencia, prefijo, grupo, opciones = {}) {
  return {
    id,
    referencia,
    prefijo,
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
  item('hoja-vida-asamblea', 'Hoja de Vida de asamblea', 'HV', 'Documentos', { consumible: true }),
  item('elementos-votacion', 'Elementos de Votación', 'EV', 'Generales'),
  item('pantalla-tripode-pendon', 'Pantalla con trípode + Pendón', 'PANT', 'Sonido'),
  item('bafle-tripode', 'Bafle con trípode', 'BAF', 'Sonido'),
  item('extension-sonido', 'Extensión sonido', 'EXTS', 'Tula sonido'),
  item('cable-canon-xlr', 'Cable Canon XLR', 'XLR', 'Tula sonido'),
  item('regleta-sonido', 'Regleta', 'REGS', 'Tula sonido'),

  // Canasta gris.
  item('jumbolon', 'Jumbolon inferior y superior', 'JUM', 'Canasta Gris'),
  item('microfono-cableado', 'Micrófono cableado', 'MICC', 'Canasta Gris'),
  item('microfono-inalambrico', 'Micrófono inalámbrico', 'MICI', 'Canasta Gris', { cantidad: 2 }),
  item('interfaz-microfonos', 'Interfaz micrófonos inalámbricos', 'INTM', 'Canasta Gris'),
  item('video-beam', 'Video Beam + cable poder + HDMI', 'VB', 'Video'),
  item('cable-poder', 'Cable de poder', 'CP', 'Video'),
  item('cable-hdmi', 'Cable HDMI', 'HDMI', 'Video'),
  item('transmisor-hdmi', 'Transmisor HDMI con WIFI', 'TXH', 'Video', { cantidad: 2 }),
  item('usb', 'USB', 'USB', 'Video', { cantidad: 2 }),
  item('mini-hub', 'Mini HUB', 'HUB', 'Video'),
  item('transformador', 'Transformador', 'TRA', 'Video'),
  item('trapos', 'Trapos', 'TRP', 'Video', { cantidad: 2 }),

  // Caja 1.
  item('gancho-celular', 'Gancho seguridad celular', 'GAN', 'Caja 1'),
  item('celular', 'Celular', 'CEL', 'Caja 1'),
  item('cargador-celular', 'Cargador celular', 'CAR', 'Caja 1'),
  item('interfaz-behringer', 'Interfaz Behringer', 'BEH', 'Caja 1'),
  item('grabadora', 'Grabadora de Periodista', 'GRAB', 'Caja 1'),
  item('cable-2x1', 'Cable 2 x 1', 'C2X1', 'Caja 1'),
  item('cable-plug-plug', 'Cable plug a plug', 'PLUG', 'Caja 1', { cantidad: 2 }),
  item('cable-usb-cuadrado', 'Cable USB con puerto cuadrado', 'USBC', 'Caja 1'),
  item('cable-canon-plug', 'Cable Canon XLR a plug', 'XLRP', 'Caja 1'),
  item('memoria-usb', 'Memoria USB con música', 'MEM', 'Caja 1'),

  // Accesorios.
  item('boton', 'Botón', 'BOT', 'Accesorios'),
  item('lapicero', 'Lapicero', 'LAP', 'Accesorios'),
  item('fusibles', 'Fusibles de repuesto', 'FUS', 'Accesorios', { cantidad: 3, consumible: true }),
  item('benjamin', 'Benjamín', 'BEN', 'Accesorios'),
  item('marrana', 'Marrana', 'MAR', 'Accesorios'),
  item('chequeador', 'Chequeador', 'CHE', 'Accesorios'),
  item('bandas', 'Paquete de bandas elásticas', 'BAND', 'Accesorios'),
  // Rótulos redondos (sonido) y rótulos rojos (votacion) son el mismo control.
  item('rotulos', 'Rótulos', 'ROT', 'Accesorios', { consumible: true }),
  item('tarjetas-empresa', 'Tarjetas de la empresa', 'TARJ', 'Accesorios', { consumible: true }),
  item('correas', 'Paquete de correas plásticas', 'COR', 'Accesorios'),
  item('cinta', 'Cinta de enmascarar', 'CIN', 'Accesorios', { consumible: true }),
  item('tripa-pollo', 'Tripa pollo (sujetar la pantalla)', 'TRI', 'Accesorios', { consumible: true }),
  item('pilas', 'Pilas AA - AAA (Nuevas / Usadas)', 'PIL', 'Accesorios', {
    consumible: true,
    dosCantidades: true,
    cantidad: 4,
  }),

  // Proyeccion doble.
  item('computador', 'Computador + cable poder', 'PC', 'Proyección doble'),
  item('cable-rj45', 'Cable RJ45 UTP', 'RJ45', 'Proyección doble'),
  item('splitter', 'Splitter + cable poder', 'SPL', 'Proyección doble'),
  item('extensor-hd', 'Extensor HD - RJ45 - TX - RX', 'EXTHD', 'Proyección doble', { cantidad: 2 }),
  item('extension-proyeccion', 'Extensión', 'EXTP', 'Proyección doble'),
  item('regleta-proyeccion', 'Regleta', 'REGP', 'Proyección doble'),

  // Votacion.
  item('hojas-asistencia', 'Hojas de asistencia', 'ASIS', 'Votación', { consumible: true, cantidad: 0 }),
  item('acta-entrega', 'Hoja acta de entrega de asamblea', 'ACTA', 'Votación', { consumible: true, cantidad: 0 }),
  item('hoja-vida-registro', 'Hoja de vida Registro, Votación', 'HVRV', 'Votación', {
    consumible: true,
    cantidad: 0,
  }),
  item('tarjetas-qr', 'Tarjetas Códigos QR', 'QR', 'Votación', { consumible: true, cantidad: 0 }),
  item('cosedora-clips', 'Cosedora con ganchos ó Clips', 'COS', 'Votación'),
  item('apoyadores', 'Apoyadores', 'APO', 'Votación', { cantidad: 2 }),

  // Grabacion.
  item('amarraderas', 'Paquete amarraderas', 'AMA', 'Grabación'),
]

// Paletas 1 al 9: cada paleta es un equipo con codigo propio.
const PALETAS = Array.from({ length: 9 }, (_, i) => {
  const numero = String(i + 1).padStart(2, '0')
  return item(`paleta-${numero}`, `Paleta ${i + 1}`, 'PAL', 'Video')
})

const DEFINICION_COMPLETA = [...DEFINICION, ...PALETAS]

export const PLANTILLAS = {
  sonido: {
    codigo: 'FO-CHLS - V9',
    elaboracion: '',
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
          ...PALETAS.map((p) => p.id),
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
          'computador',
          'cable-rj45',
          'splitter',
          'extensor-hd',
          'extension-proyeccion',
          'regleta-proyeccion',
        ],
      },
    ],
    especiales: [],
  },

  votacion: {
    codigo: 'FO-CHLV - V7',
    elaboracion: '30/1/2025',
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
    codigo: 'FO-CHLG - V2',
    elaboracion: '22/7/2024',
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
          ...PALETAS.map((p) => p.id),
        ],
      },
    ],
    especiales: ['colorEquipo', 'respaldoAudio', 'referenciaVotacion'],
  },
}

export const TIPOS_SERVICIO = Object.keys(PLANTILLAS)

export const ETIQUETAS_TIPO = {
  sonido: 'Sonido',
  votacion: 'Votación',
  grabacion: 'Grabación',
}

// El catalogo se genera una sola vez con codigos secuenciales por prefijo.
// Los códigos quedan en Firestore y se pueden editar desde la pantalla.
export function crearCatalogo() {
  const contadores = {}
  return DEFINICION_COMPLETA.map((def) => {
    const numero = (contadores[def.prefijo] || 0) + 1
    contadores[def.prefijo] = numero
    return {
      ...def,
      codigo: `${def.prefijo}-${String(numero).padStart(3, '0')}`,
    }
  })
}

export function indiceCatalogo(catalogo) {
  return Object.fromEntries(catalogo.map((item) => [item.id, item]))
}

// Items de una plantilla, en el orden en que se muestran al operario.
export function itemsDePlantilla(tipo, catalogo) {
  const porId = indiceCatalogo(catalogo)
  const plantilla = PLANTILLAS[tipo] || PLANTILLAS.sonido
  return plantilla.grupos.flatMap((grupo) =>
    grupo.items
      .filter((id) => porId[id])
      .map((id) => ({ ...porId[id], grupo: grupo.nombre })),
  )
}

// Fila de trabajo de una parada o de la preparacion en empresa.
export function filaDesdeCatalogo(item, origen = 'empresa') {
  return {
    itemId: item.id,
    codigo: item.codigo,
    referencia: item.referencia,
    grupo: item.grupo || '',
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

export function esConsumible(itemId, catalogo) {
  return !!catalogo.find((i) => i.id === itemId)?.consumible
}

export function nombreTipo(tipo) {
  return ETIQUETAS_TIPO[tipo] || tipo
}

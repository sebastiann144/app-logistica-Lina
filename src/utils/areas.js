// Areas de la empresa. Estaban repetidas en MuroPublicoView y en
// PrestamoEquiposView (lineas 1038-1048 del index.html original).
export const AREAS = [
  'Administracion',
  'Asesorias',
  'Talento Humano',
  'Operaciones',
  'Clase Aparte',
  'Gerencia',
  'Otros',
]

// El valor guardado va sin tilde (como en Firestore) y se muestra con tilde.
export const ETIQUETA_AREA = {
  Administracion: 'Administración',
  Asesorias: 'Asesorías',
}

export function etiquetaArea(area) {
  return ETIQUETA_AREA[area] || area || ''
}

<script setup>
import { onMounted, ref, watch } from 'vue'

// Canvas de firma. Reemplaza a initFirma()/capturarFirma()/limpiarFirma()/
// cargarFirma() del original (muro-publico.html lineas 934-996), que habia que
// reinicializar a mano cada vez que se abria un modal.
//
// Uso: <FirmaCanvas v-model="form.firma" :alto="120" />
defineProps({
  alto: { type: Number, default: 120 },
})

const modelo = defineModel({ type: String, default: '' })
const canvas = ref(null)

let dibujando = false

function contexto() {
  return canvas.value.getContext('2d')
}

function borrar() {
  const c = canvas.value
  contexto().clearRect(0, 0, c.width, c.height)
}

function pintarImagen(dataUrl) {
  const img = new Image()
  img.onload = () => contexto().drawImage(img, 0, 0)
  img.src = dataUrl
}

function limpiar() {
  borrar()
  modelo.value = ''
}

// El original solo guardaba la firma si el canvas no estaba en blanco.
function capturar() {
  const c = canvas.value
  const pixeles = contexto().getImageData(0, 0, c.width, c.height).data
  const enBlanco = pixeles.every((p) => p === 0)
  modelo.value = enBlanco ? '' : c.toDataURL()
}

onMounted(() => {
  const c = canvas.value
  c.addEventListener('pointerdown', (e) => {
    dibujando = true
    contexto().beginPath()
    contexto().moveTo(e.offsetX, e.offsetY)
  })
  c.addEventListener('pointermove', (e) => {
    if (!dibujando) return
    contexto().lineTo(e.offsetX, e.offsetY)
    contexto().strokeStyle = '#1a1a2e'
    contexto().lineWidth = 2
    contexto().stroke()
  })
  const terminar = () => {
    if (!dibujando) return
    dibujando = false
    capturar()
  }
  c.addEventListener('pointerup', terminar)
  c.addEventListener('pointerleave', terminar)

  if (modelo.value) pintarImagen(modelo.value)
})

// Cuando el formulario carga una firma ya guardada (modo edicion) o la borra al
// abrir un registro nuevo.
watch(modelo, (valor) => {
  if (!canvas.value) return
  if (valor) pintarImagen(valor)
  else borrar()
})

defineExpose({ limpiar })
</script>

<template>
  <div style="border: 1px solid #d1d5db; border-radius: 6px; overflow: hidden; position: relative">
    <canvas
      ref="canvas"
      width="400"
      :height="alto"
      :style="{ width: '100%', height: `${alto}px`, cursor: 'crosshair', touchAction: 'none' }"
    />
  </div>
  <div style="display: flex; gap: 0.5rem; margin-top: 0.3rem">
    <button type="button" class="btn btn-sm btn-outline" @click="limpiar">Limpiar</button>
  </div>
</template>

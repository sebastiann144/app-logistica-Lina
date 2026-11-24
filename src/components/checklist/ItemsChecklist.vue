<script setup>
// Tabla reutilizable de items del checklist.
// La usa la preparacion en empresa (solo Enviado) y cada parada
// (Enviado / Recibido / Devuelto). No decide reglas: solo muestra los datos y
// avisa al padre cuando cambia una cantidad.
//
// El badge "fijo" marca los numeros rojos de la planilla fisica: elementos que
// siempre van en esa canasta y casi no se mueven.
import { computed, ref } from 'vue'
import { totalFila } from '@/utils/checklistPlantillas'

const props = defineProps({
  items: { type: Array, required: true },
  grupos: { type: Array, required: true },
  modo: { type: String, default: 'parada' }, // 'preparacion' | 'parada'
})

const emit = defineEmits(['update:items'])
const abiertos = ref({})

function esAbierto(key) {
  return abiertos.value[key] !== false
}
function alternar(key) {
  abiertos.value[key] = !esAbierto(key)
}

function porItem(itemId) {
  return props.items.find((f) => f.itemId === itemId)
}

function actualizar(itemId, campo, valor) {
  const texto = campo === 'observacion'
  const copia = props.items.map((f) =>
    f.itemId === itemId
      ? { ...f, [campo]: texto || valor === '' ? String(valor) : Number(valor) }
      : f,
  )
  emit('update:items', copia)
}

function valor(fila, campo) {
  if (!fila) return ''
  const numero = fila[campo]
  return numero === '' || numero === null || numero === undefined ? '' : numero
}

function total(fila, columna) {
  return fila ? totalFila(fila, columna) : null
}

function claseDiferencia(fila) {
  if (!fila || props.modo !== 'parada') return ''
  const enviado = total(fila, 'enviado')
  const devuelto = total(fila, 'devuelto')
  if (enviado === null || devuelto === null || enviado === devuelto) return ''
  return fila.esConsumible ? 'dif-consumible' : devuelto < enviado ? 'dif-faltante' : 'dif-sobrante'
}

function textoDiferencia(fila) {
  const enviado = total(fila, 'enviado')
  const devuelto = total(fila, 'devuelto')
  if (enviado === null || devuelto === null || enviado === devuelto) return 'OK'
  const delta = devuelto - enviado
  if (fila.esConsumible) return `Consumible (${delta > 0 ? '+' : ''}${delta})`
  return delta < 0 ? `Faltante (${delta})` : `Sobrante (+${delta})`
}

const columnas = computed(() =>
  props.modo === 'preparacion' ? ['Enviado'] : ['Enviado', 'Recibido', 'Devuelto'],
)

const filaConDosCantidades = computed(() => props.items.some((f) => f.dosCantidades))
</script>

<template>
  <div class="items-checklist">
    <div v-for="grupo in grupos" :key="grupo.key" class="grupo">
      <button type="button" class="grupo-head" @click="alternar(grupo.key)">
        <span class="grupo-nombre">{{ grupo.icono }} {{ grupo.nombre }}</span>
        <span class="grupo-toggle">{{ esAbierto(grupo.key) ? '▼' : '▶' }}</span>
      </button>

      <div v-if="esAbierto(grupo.key)" class="grupo-cuerpo">
        <div class="tabla-scroll">
          <table>
            <thead>
              <tr>
                <th class="col-item">Elemento</th>
                <th v-for="col in columnas" :key="col" class="col-num">{{ col }}</th>
                <th v-if="filaConDosCantidades && modo === 'parada'" class="col-detalle">
                  Detalle nuevas / usadas
                </th>
                <th v-if="modo === 'parada'" class="col-dif">Diferencia</th>
                <th v-if="modo === 'parada'" class="col-obs">Observación</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in grupo.items"
                :key="item.id"
                :class="{ consumible: item.consumible, fijo: item.fijo }"
              >
                <td class="col-item">
                  <span class="referencia">{{ item.referencia }}</span>
                  <span v-if="item.fijo" class="chip-fijo">fijo</span>
                  <span v-if="item.consumible" class="chip-consumible">consumible</span>
                </td>

                <td class="col-num">
                  <input
                    type="number"
                    min="0"
                    :value="valor(porItem(item.id), 'enviado')"
                    :aria-label="`Enviado ${item.referencia}`"
                    @input="actualizar(item.id, 'enviado', $event.target.value)"
                  />
                </td>

                <template v-if="modo === 'parada'">
                  <td class="col-num">
                    <input
                      type="number"
                      min="0"
                      :value="valor(porItem(item.id), 'recibido')"
                      :aria-label="`Recibido ${item.referencia}`"
                      @input="actualizar(item.id, 'recibido', $event.target.value)"
                    />
                  </td>
                  <td class="col-num">
                    <input
                      type="number"
                      min="0"
                      :value="valor(porItem(item.id), 'devuelto')"
                      :aria-label="`Devuelto ${item.referencia}`"
                      @input="actualizar(item.id, 'devuelto', $event.target.value)"
                    />
                  </td>
                  <td v-if="filaConDosCantidades" class="col-detalle">
                    <template v-if="porItem(item.id)?.dosCantidades">
                      <div class="detalle-columnas">
                        <input
                          v-for="(columna, idx) in ['enviado', 'recibido', 'devuelto']"
                          :key="columna"
                          type="number"
                          min="0"
                          :placeholder="['N', 'R', 'D'][idx]"
                          :value="valor(porItem(item.id), `${columna}Nuevas`)"
                          :aria-label="`Nuevas ${columna} ${item.referencia}`"
                          @input="actualizar(item.id, `${columna}Nuevas`, $event.target.value)"
                        />
                        <input
                          v-for="(columna, idx) in ['enviado', 'recibido', 'devuelto']"
                          :key="`${columna}-usadas`"
                          type="number"
                          min="0"
                          :placeholder="['n', 'r', 'd'][idx]"
                          :value="valor(porItem(item.id), `${columna}Usadas`)"
                          :aria-label="`Usadas ${columna} ${item.referencia}`"
                          @input="actualizar(item.id, `${columna}Usadas`, $event.target.value)"
                        />
                      </div>
                    </template>
                    <span v-else class="muted">—</span>
                  </td>
                  <td class="col-dif">
                    <span class="chip-dif" :class="claseDiferencia(porItem(item.id))">
                      {{ textoDiferencia(porItem(item.id)) }}
                    </span>
                  </td>
                  <td class="col-obs">
                    <input
                      :value="porItem(item.id)?.observacion || ''"
                      placeholder="Novedad de este elemento"
                      :aria-label="`Observación ${item.referencia}`"
                      @input="actualizar(item.id, 'observacion', $event.target.value)"
                    />
                  </td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.items-checklist {
  display: grid;
  gap: 0.75rem;
}
.grupo {
  border: 1px solid #d5dee8;
  border-radius: 10px;
  overflow: hidden;
}
.grupo-head {
  align-items: center;
  background: #f8fbfe;
  border: 0;
  color: #102a43;
  cursor: pointer;
  display: flex;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 800;
  justify-content: space-between;
  padding: 0.75rem 0.9rem;
  width: 100%;
}
.grupo-head:hover {
  background: #eaf4fc;
}
.grupo-toggle {
  color: #1677c8;
  font-size: 0.75rem;
}
.grupo-cuerpo {
  border-top: 1px solid #d5dee8;
}
.tabla-scroll {
  overflow-x: auto;
}
table {
  border-collapse: collapse;
  min-width: 900px;
  width: 100%;
}
th {
  background: #102a43;
  color: #fff;
  font-size: 0.68rem;
  padding: 0.6rem 0.45rem;
  text-align: left;
  white-space: nowrap;
}
td {
  border-bottom: 1px solid #e7edf3;
  font-size: 0.8rem;
  padding: 0.4rem 0.4rem;
  vertical-align: middle;
}
tr.consumible {
  background: #f7fbff;
}
tr.fijo .referencia {
  color: #a42d22;
  font-weight: 800;
}
.col-item {
  min-width: 240px;
}
.col-num {
  min-width: 78px;
}
.col-detalle {
  min-width: 250px;
}
.col-dif {
  min-width: 130px;
}
.col-obs {
  min-width: 190px;
}
.referencia {
  display: inline;
}
.chip-fijo,
.chip-consumible {
  border-radius: 99px;
  display: inline-block;
  font-size: 0.62rem;
  font-weight: 800;
  margin-left: 0.35rem;
  padding: 0.05rem 0.4rem;
  text-transform: uppercase;
}
.chip-fijo {
  background: #ffe7e4;
  color: #a42d22;
}
.chip-consumible {
  background: #e6f4ff;
  color: #155b87;
}
input {
  background: #fff;
  border: 1px solid #c9d5e2;
  border-radius: 6px;
  font: inherit;
  font-size: 0.78rem;
  min-height: 34px;
  outline: none;
  padding: 0.35rem 0.45rem;
  width: 100%;
}
input:focus {
  border-color: #1677c8;
  box-shadow: 0 0 0 2px rgba(22, 119, 200, 0.12);
}
.detalle-columnas {
  display: grid;
  gap: 0.2rem;
  grid-template-columns: repeat(6, minmax(0, 1fr));
}
.detalle-columnas input {
  min-height: 30px;
  padding: 0.2rem;
  text-align: center;
}
.chip-dif {
  border-radius: 99px;
  display: inline-block;
  font-size: 0.68rem;
  font-weight: 800;
  padding: 0.2rem 0.5rem;
  white-space: nowrap;
}
.dif-faltante {
  background: #ffe7e4;
  color: #a42d22;
}
.dif-sobrante {
  background: #fff3d6;
  color: #8a5a00;
}
.dif-consumible {
  background: #e6f4ff;
  color: #155b87;
}
.muted {
  color: #98a2b3;
}
@media (max-width: 720px) {
  table {
    min-width: 790px;
  }
}
</style>

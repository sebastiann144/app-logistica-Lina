<script setup>
// Home.
//
// Traduccion del tab "Home" de index.html (lineas 527-551) y de renderHome()
// (linea 3496). Es el "Panel de monitoreo operativo": reservas pendientes
// (confirmables por admin) y alertas operativas agrupadas por categoria.
//
// Nota: renderStats() (3349) y renderAlertas() (3370) escriben en los elementos
// del tab Vehiculos (#statVehiculos, #alertListVehiculos), no en Home; se
// portaran en VehiculosView.vue. renderHome() no usa filtrarPorVehiculo().
import { computed } from 'vue'
import { actualizar, crear } from '@/services/firestore'
import { useAuthStore } from '@/stores/auth'
import { useDatosStore } from '@/stores/datos'
import { diffDias, hoy } from '@/utils/fechas'

const auth = useAuthStore()
const datos = useDatosStore()

// renderHome() (linea 3498): reservas pendientes = estado !== 'Solicitado'.
const reservasPendientes = computed(() =>
  datos.reservas.filter((r) => r.estado !== 'Solicitado'),
)

// renderHome() (lineas 3520-3669) + addAlerta() (linea 3525).
// Agrupa las alertas por categoria. El color de la tarjeta lo fija la PRIMERA
// alerta que entra al grupo, por eso se conserva el orden de evaluacion original.
const categoriasAlertas = computed(() => {
  const hoyDate = new Date()
  const categorias = []

  function addAlerta(cat, icon, color, msg, tipo) {
    let grupo = categorias.find((g) => g.cat === cat)
    if (!grupo) {
      grupo = { cat, icon, color, items: [] }
      categorias.push(grupo)
    }
    grupo.items.push({ msg, tipo })
  }

  // Mantenimientos (lineas 3534-3549)
  datos.mantenimientos.forEach((m) => {
    if (m.proxFecha && new Date(m.proxFecha) <= hoyDate) {
      addAlerta(
        'Mantenimiento',
        '🔧',
        '#dc2626',
        `${m.vehiculo} — ${m.tipo} vencido el ${m.proxFecha}`,
        'danger',
      )
    } else if (m.proxFecha) {
      const dias = diffDias(hoy(), m.proxFecha)
      if (dias >= -30 && dias < 0) {
        addAlerta(
          'Mantenimiento',
          '🔧',
          '#f59e0b',
          `${m.vehiculo} — ${m.tipo} vence en ${Math.abs(dias)} días (${m.proxFecha})`,
          'warning',
        )
      }
    }
    if (m.proxKm) {
      const ultKm = [...datos.mantenimientos]
        .filter((x) => x.vehiculo === m.vehiculo && x.km)
        .sort((a, b) => b.km - a.km)[0]
      if (ultKm && ultKm.proxKm && ultKm.km >= ultKm.proxKm) {
        addAlerta(
          'Mantenimiento',
          '🔧',
          '#dc2626',
          `${m.vehiculo} — ${m.tipo} excedió km (${ultKm.km}/${ultKm.proxKm})`,
          'danger',
        )
      }
    }
  })

  // Revision gas (lineas 3551-3560)
  datos.revisionGas.forEach((r) => {
    if (new Date(r.vence) <= hoyDate) {
      addAlerta('Revisión Gas', '⛽', '#dc2626', `${r.vehiculo} vencida el ${r.vence}`, 'danger')
    } else {
      const dias = diffDias(hoy(), r.vence)
      if (dias >= -30 && dias < 0) {
        addAlerta(
          'Revisión Gas',
          '⛽',
          '#f59e0b',
          `${r.vehiculo} vence en ${Math.abs(dias)} días (${r.vence})`,
          'warning',
        )
      }
    }
  })

  // Liquidos / revision aceite (lineas 3562-3571)
  datos.liquidos.forEach((l) => {
    const bajos = ['aceite', 'refrigerante', 'frenos', 'direccion', 'limpia']
      .filter((f) => l[f] && l[f] !== 'OK')
      .map((f) => ({ f, v: l[f] }))
    if (bajos.length) {
      bajos.forEach((b) => {
        addAlerta('Revisión Aceite', '🛢️', '#f59e0b', `${l.vehiculo} — ${b.f} en ${b.v}`, 'warning')
      })
    }
  })

  // Prestamos de carros (lineas 3573-3581)
  datos.prestamos
    .filter((p) => p.estado === 'En uso')
    .forEach((p) => {
      const salida = new Date(p.fechaSalida + 'T' + (p.horaSalida || '00:00'))
      const horas = (new Date() - salida) / (1000 * 60 * 60)
      if (horas > 24) {
        addAlerta(
          'Préstamo Carros',
          '🚗',
          '#dc2626',
          `${p.vehiculo} — ${p.solicitante} lleva ${Math.floor(horas)}h sin devolver`,
          'danger',
        )
      } else if (horas > 12) {
        addAlerta(
          'Préstamo Carros',
          '🚗',
          '#f59e0b',
          `${p.vehiculo} — ${p.solicitante} lleva ${Math.floor(horas)}h en uso`,
          'warning',
        )
      }
    })

  // Pico y placa (lineas 3583-3592)
  datos.permisos.forEach((p) => {
    if (new Date(p.fin) <= hoyDate) {
      addAlerta(
        'Pico y Placa',
        '🚦',
        '#dc2626',
        `${p.vehiculo} — ${p.municipio} vencido el ${p.fin}`,
        'danger',
      )
    } else {
      const dias = diffDias(hoy(), p.fin)
      if (dias >= 0 && dias <= 15) {
        addAlerta(
          'Pico y Placa',
          '🚦',
          '#f59e0b',
          `${p.vehiculo} — Próximo a vencer (${dias} días - ${p.fin})`,
          'warning',
        )
      }
    }
  })

  // Prestamos de equipos (lineas 3594-3600)
  datos.equipos.forEach((e) => {
    if (!e.fechaEntrada) {
      const dias = diffDias(e.fechaSalida, hoy())
      if (dias > 7)
        addAlerta(
          'Préstamo Equipos',
          '📦',
          '#dc2626',
          `${e.equipo} — ${e.solicitante} lleva ${dias} días sin devolver`,
          'danger',
        )
      else if (dias > 3)
        addAlerta(
          'Préstamo Equipos',
          '📦',
          '#f59e0b',
          `${e.equipo} — ${e.solicitante} lleva ${dias} días sin devolver`,
          'warning',
        )
    }
  })

  // SOAT (lineas 3602-3613)
  datos.soat.forEach((s) => {
    const vence = new Date(s.vence)
    const ahoraDate = new Date()
    if (vence < ahoraDate) {
      addAlerta('SOAT', '🪪', '#dc2626', `${s.vehiculo} — Vencido el ${s.vence}`, 'danger')
    } else {
      const dias = diffDias(hoy(), s.vence)
      if (dias >= 0 && dias <= 30) {
        addAlerta(
          'SOAT',
          '🪪',
          '#f59e0b',
          `${s.vehiculo} — Próximo a vencer (${dias} días - ${s.vence})`,
          'warning',
        )
      }
    }
  })

  // Kilometraje (lineas 3615-3637): solo el ultimo registro por vehiculo.
  datos.kilometraje.forEach((k) => {
    const v = datos.vehiculos.find((x) => x.placa === k.vehiculo)
    if (!v) return
    const regs = datos.kilometraje
      .filter((r) => r.vehiculo === k.vehiculo)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
    const ult = regs[regs.length - 1]
    if (ult !== k) return
    const proxMeta = Math.ceil(k.km / 10000) * 10000
    const diff = proxMeta - k.km
    if (diff <= 0) {
      addAlerta(
        'Kilometraje',
        '📏',
        '#dc2626',
        `${k.vehiculo} alcanzó ${k.km.toLocaleString()} km — Meta ${proxMeta.toLocaleString()}`,
        'danger',
      )
    } else if (diff <= 1000) {
      addAlerta(
        'Kilometraje',
        '📏',
        '#f59e0b',
        `${k.vehiculo} próximo a ${proxMeta.toLocaleString()} km (${diff} km restantes)`,
        'warning',
      )
    }
    // Alerta de vencimiento personalizado (lineas 3628-3636)
    if (k.alertaKm) {
      const diffV = k.alertaKm - k.km
      if (diffV <= 0) {
        addAlerta(
          'Kilometraje Venc',
          '📏',
          '#dc2626',
          `${k.vehiculo} — vencimiento alcanzado (${k.alertaKm.toLocaleString()} km)`,
          'danger',
        )
      } else if (diffV <= 1000) {
        addAlerta(
          'Kilometraje Venc',
          '📏',
          '#f59e0b',
          `${k.vehiculo} — próximo vencimiento en ${diffV} km`,
          'warning',
        )
      }
    }
  })

  // Counts que el original calculaba al dibujar cada tarjeta (lineas 3646-3647).
  return categorias.map((g) => ({
    ...g,
    danger: g.items.filter((i) => i.tipo === 'danger').length,
    warning: g.items.filter((i) => i.tipo === 'warning').length,
  }))
})

// confirmarReservaHome() (linea 3672): marca la reserva como "Solicitado" y
// genera el prestamo automatico. Solo admin.
async function confirmarReserva(r) {
  if (!auth.esAdmin) return
  if (!confirm('Confirmar esta reserva?')) return
  await actualizar('reservas', r.id, { estado: 'Solicitado' })
  await crear('prestamos', {
    vehiculo: r.vehiculo,
    solicitante: r.solicitante,
    fechaSalida: r.fecha,
    horaSalida: r.hora || null,
    fechaEntrada: null,
    horaEntrada: null,
    estado: 'En uso',
    obs: 'Generado desde reserva',
  })
  await datos.recargarVarias(['reservas', 'prestamos'])
}
</script>

<template>
  <div>
    <!-- Encabezado (index.html lineas 528-531) -->
    <div
      style="
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        margin-bottom: 1.25rem;
        padding-bottom: 1rem;
        border-bottom: 2px solid #e5e7eb;
      "
    >
      <h2 style="margin: 0; font-size: 1.2rem; color: #0f3460; letter-spacing: 0.5px">
        CLASE ALPHA <span style="font-weight: 400; color: #6b7280">· Logística</span>
      </h2>
      <p style="margin: 0; font-size: 0.8rem; color: #9ca3af">Panel de monitoreo operativo</p>
    </div>

    <!-- Reservas pendientes (index.html lineas 533-542; renderHome 3498-3518) -->
    <div
      v-if="reservasPendientes.length"
      class="card"
      style="border-left: 4px solid #f59e0b"
    >
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
          flex-wrap: wrap;
          gap: 0.5rem;
        "
      >
        <div style="display: flex; align-items: center; gap: 0.5rem">
          <span style="font-size: 1.1rem">📅</span>
          <h2 style="margin: 0; font-size: 1rem">Reservas Pendientes</h2>
        </div>
        <span class="badge badge-yellow" style="font-size: 0.8rem; padding: 0.25rem 0.75rem">
          {{ reservasPendientes.length }}
        </span>
      </div>
      <div
        v-for="r in reservasPendientes"
        :key="r.id"
        class="alert-item"
        style="border-left: 3px solid #f59e0b"
      >
        <span style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap">
          <span style="font-weight: 600">{{ r.solicitante }}</span>
          <span style="color: #6b7280">—</span>
          <span>{{ r.vehiculo }}</span>
          <span class="badge badge-blue" style="font-size: 0.7rem">{{ r.fecha }} {{ r.hora }}</span>
        </span>
        <button
          v-if="auth.esAdmin"
          class="btn btn-sm btn-primary"
          style="flex-shrink: 0"
          @click="confirmarReserva(r)"
        >
          ✓ Confirmar
        </button>
      </div>
    </div>

    <!-- Alertas operativas (index.html lineas 544-550; renderHome 3520-3669) -->
    <div class="card" style="border: none; box-shadow: none; padding: 0">
      <div
        style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; padding: 0 0.25rem"
      >
        <span style="font-size: 1rem">🔔</span>
        <h2 style="margin: 0; font-size: 1rem; color: #0f3460">Alertas Operativas</h2>
      </div>

      <div class="empty" v-if="!categoriasAlertas.length" style="padding: 3rem 2rem">
        ✅ No hay alertas pendientes
      </div>

      <div v-else style="display: flex; flex-direction: column; gap: 0.75rem">
        <div
          v-for="g in categoriasAlertas"
          :key="g.cat"
          class="card"
          style="margin: 0; padding: 1rem 1.1rem"
          :style="{ borderLeft: `4px solid ${g.color}` }"
        >
          <div
            style="
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 0.5rem;
            "
          >
            <div style="display: flex; align-items: center; gap: 0.5rem">
              <span style="font-size: 1.1rem">{{ g.icon }}</span>
              <span style="font-weight: 600; font-size: 0.85rem; color: #0f3460">{{ g.cat }}</span>
            </div>
            <div style="display: flex; gap: 0.3rem; font-size: 0.7rem">
              <span v-if="g.danger" class="badge tag-danger">
                {{ g.danger }} crítico{{ g.danger > 1 ? 's' : '' }}
              </span>
              <span v-if="g.warning" class="badge tag-warning">
                {{ g.warning }} próximo{{ g.warning > 1 ? 's' : '' }}
              </span>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.3rem">
            <div
              v-for="(i, idx) in g.items"
              :key="g.cat + '-' + idx"
              style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; padding: 0.2rem 0"
            >
              <span
                style="width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0"
                :style="{ background: i.tipo === 'danger' ? '#dc2626' : '#f59e0b' }"
              />
              <span style="color: #374151">{{ i.msg }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

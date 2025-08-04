const sqlite3 = require("sqlite3").verbose()

const db = new sqlite3.Database("simetricdb.sqlite", (err) => {
  if (err) {
    console.error("Error al conectar con la base de datos:", err.message)
  } else {
    console.log("Conectado a la base de datos para listado de empleados.")
  }
})

let empleados = []
let empleadoSeleccionado = null
let modoEdicion = false
let valoresOriginales = {}

// Función para cargar empleados desde la base de datos
function cargarEmpleados() {
  const query = `
    SELECT * FROM empleados 
    ORDER BY estatus DESC, nombre ASC, apellido ASC
  `

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Error al cargar empleados:", err.message)
      return
    }

    empleados = rows
    filtrarYMostrarEmpleados()
  })
}

// Función para filtrar y mostrar empleados
function filtrarYMostrarEmpleados() {
  const nombreFiltro = document.getElementById("search-name").value.toLowerCase()
  const cedulaFiltro = document.getElementById("search-cedula").value.toLowerCase()
  const cargoFiltro = document.getElementById("filter-cargo").value
  const estatusFiltro = document.getElementById("filter-estatus").value
  const jornadaFiltro = document.getElementById("filter-jornada").value

  const empleadosFiltrados = empleados.filter((empleado) => {
    const nombreCompleto = `${empleado.nombre} ${empleado.apellido}`.toLowerCase()
    const coincideNombre = nombreCompleto.includes(nombreFiltro)
    const coincideCedula = empleado.cedula.toLowerCase().includes(cedulaFiltro)
    const coincideCargo = cargoFiltro === "todos" || empleado.cargo === cargoFiltro
    const coincideEstatus = estatusFiltro === "todos" || empleado.estatus === estatusFiltro
    const coincideJornada = jornadaFiltro === "todos" || empleado.tipo_jornada === jornadaFiltro

    return coincideNombre && coincideCedula && coincideCargo && coincideEstatus && coincideJornada
  })

  renderizarEmpleados(empleadosFiltrados)
}

// Función para renderizar empleados
function renderizarEmpleados(empleadosArray) {
  const container = document.getElementById("empleados-container")

  if (empleadosArray.length === 0) {
    container.innerHTML = `
      <div class="no-empleados">
        <h3>No se encontraron empleados</h3>
        <p>No hay empleados que coincidan con los filtros seleccionados.</p>
      </div>
    `
    return
  }

  const empleadosHTML = empleadosArray
    .map((empleado) => {
      const antiguedad = calcularAntiguedad(empleado.fecha_ingreso)
      const cargoFormateado = formatearCargo(empleado.cargo)
      const jornadaFormateada = formatearJornada(empleado.tipo_jornada)

      return `
      <div class="empleado-card">
        <div class="empleado-header">
          <div class="empleado-info">
            <h3>${empleado.nombre} ${empleado.apellido}</h3>
            <div class="cargo">${cargoFormateado}</div>
          </div>
          <span class="estatus-badge ${empleado.estatus}">${empleado.estatus.toUpperCase()}</span>
        </div>
        
        <div class="empleado-details">
          <div class="detail-item">
            <span class="detail-label">🆔 Cédula</span>
            <span class="detail-value">${empleado.cedula}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">📞 Teléfono</span>
            <span class="detail-value">${empleado.telefono}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">⏰ Jornada</span>
            <span class="detail-value">${jornadaFormateada}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">💰 Sueldo Base</span>
            <span class="detail-value">$${empleado.sueldo_base.toFixed(2)} USD</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">📅 Fecha Ingreso</span>
            <span class="detail-value">${formatearFecha(empleado.fecha_ingreso)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">⏳ Antigüedad</span>
            <span class="detail-value">${antiguedad}</span>
          </div>
        </div>
        
        <div class="empleado-actions">
          <button class="btn-action btn-primary ver-detalles" data-id="${empleado.id}">
            👁️ Ver Detalles
          </button>
          <button class="btn-action btn-success ver-nomina" data-id="${empleado.id}">
            💰 Ver Nómina
          </button>
          <button class="btn-action btn-warning cambiar-estatus-directo" data-id="${empleado.id}">
            🔄 Cambiar Estatus
          </button>
        </div>
      </div>
    `
    })
    .join("")

  container.innerHTML = `<div class="empleados-grid">${empleadosHTML}</div>`
}

// Función para calcular antigüedad
function calcularAntiguedad(fechaIngreso) {
  const fechaInicio = new Date(fechaIngreso)
  const fechaActual = new Date()

  let años = fechaActual.getFullYear() - fechaInicio.getFullYear()
  let meses = fechaActual.getMonth() - fechaInicio.getMonth()

  if (meses < 0) {
    años--
    meses += 12
  }

  if (años > 0) {
    return `${años} año${años > 1 ? "s" : ""} ${meses > 0 ? `y ${meses} mes${meses > 1 ? "es" : ""}` : ""}`
  } else if (meses > 0) {
    return `${meses} mes${meses > 1 ? "es" : ""}`
  } else {
    const dias = Math.floor((fechaActual - fechaInicio) / (1000 * 60 * 60 * 24))
    return `${dias} día${dias > 1 ? "s" : ""}`
  }
}

// Función para formatear cargo
function formatearCargo(cargo) {
  const cargos = {
    administrador: "Administrador",
    recepcionista: "Recepcionista",
    entrenador: "Entrenador Personal",
    limpieza: "Personal de Limpieza",
    mantenimiento: "Mantenimiento",
    seguridad: "Seguridad",
    otro: "Otro",
  }
  return cargos[cargo] || cargo
}

// Función para formatear jornada
function formatearJornada(jornada) {
  const jornadas = {
    tiempo_completo: "Tiempo Completo",
    medio_tiempo: "Medio Tiempo",
    
    por_horas: "Por Horas",
  }
  return jornadas[jornada] || jornada
}

// Función para formatear fecha
function formatearFecha(fecha) {
  const fechaObj = new Date(fecha + "T00:00:00")
  return fechaObj.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

// Event listeners para filtros
document.getElementById("search-name").addEventListener("input", filtrarYMostrarEmpleados)
document.getElementById("search-cedula").addEventListener("input", filtrarYMostrarEmpleados)
document.getElementById("filter-cargo").addEventListener("change", filtrarYMostrarEmpleados)
document.getElementById("filter-estatus").addEventListener("change", filtrarYMostrarEmpleados)
document.getElementById("filter-jornada").addEventListener("change", filtrarYMostrarEmpleados)

// Event listener para acciones de empleados
document.addEventListener("click", (event) => {
  const empleadoId = event.target.dataset.id

  if (event.target.classList.contains("ver-detalles")) {
    mostrarDetallesEmpleado(empleadoId)
  } else if (event.target.classList.contains("ver-nomina")) {
    mostrarNominaEmpleado(empleadoId)
  } else if (event.target.classList.contains("cambiar-estatus-directo")) {
    abrirPopupCambioEstatus(empleadoId)
  }
})

// Función para mostrar detalles del empleado (solo información personal)
function mostrarDetallesEmpleado(empleadoId) {
  const empleado = empleados.find((emp) => emp.id == empleadoId)
  if (!empleado) return

  empleadoSeleccionado = empleadoId

  // Llenar campos del popup
  document.getElementById("detalle-nombre").value = empleado.nombre
  document.getElementById("detalle-apellido").value = empleado.apellido
  document.getElementById("detalle-cedula").value = empleado.cedula
  document.getElementById("detalle-telefono").value = empleado.telefono
  document.getElementById("detalle-direccion").value = empleado.direccion
  document.getElementById("detalle-email").value = empleado.email || ""
  document.getElementById("detalle-cargo").value = empleado.cargo
  document.getElementById("detalle-jornada").value = empleado.tipo_jornada
  document.getElementById("detalle-sueldo").value = empleado.sueldo_base
  document.getElementById("detalle-fecha-ingreso").value = empleado.fecha_ingreso
  document.getElementById("detalle-banco").value = empleado.banco || ""
  document.getElementById("detalle-cuenta").value = empleado.cuenta_bancaria || ""

  // Mostrar estatus y antigüedad
  const estatusBadge = document.getElementById("detalle-estatus")
  estatusBadge.textContent = empleado.estatus.toUpperCase()
  estatusBadge.className = `estatus-badge ${empleado.estatus}`

  document.getElementById("detalle-antiguedad").textContent = calcularAntiguedad(empleado.fecha_ingreso)

  // Mostrar/ocultar botón de eliminar según el estatus
  const btnEliminar = document.getElementById("eliminar-empleado")
  if (empleado.estatus === "inactivo") {
    btnEliminar.classList.remove("hidden")
  } else {
    btnEliminar.classList.add("hidden")
  }

  // Mostrar popup
  document.getElementById("popup-detalles").classList.remove("oculto")
}

// Función para mostrar nómina del empleado (solo historial de nómina)
function mostrarNominaEmpleado(empleadoId) {
  const empleado = empleados.find((emp) => emp.id == empleadoId)
  if (!empleado) return

  empleadoSeleccionado = empleadoId

  // Mostrar información básica del empleado
  document.getElementById("nombre-empleado-nomina").textContent = `${empleado.nombre} ${empleado.apellido}`
  document.getElementById("cargo-empleado-nomina").textContent =
    `${formatearCargo(empleado.cargo)} - ${empleado.cedula}`

  // Cargar historial de nómina
  cargarHistorialNomina(empleadoId)

  // Mostrar popup
  document.getElementById("popup-nomina").classList.remove("oculto")
}

// Función para cargar historial de nómina - ACTUALIZADA
function cargarHistorialNomina(empleadoId) {
  const query = `
    SELECT * FROM nomina 
    WHERE empleado_id = ? 
    ORDER BY año DESC, mes DESC
  `

  db.all(query, [empleadoId], (err, nominas) => {
    if (err) {
      console.error("Error al cargar historial de nómina:", err.message)
      return
    }

    const contenedor = document.getElementById("historial-nomina-container")

    if (nominas.length === 0) {
      contenedor.innerHTML = `
        <div class="no-nomina">
          <p>Este empleado no tiene registros de nómina.</p>
        </div>
      `
      return
    }

    const nominasHTML = nominas
      .map((nomina) => {
        const nombreMes = obtenerNombreMes(nomina.mes)
        return `
        <div class="nomina-item">
          <div class="nomina-header">
            <span class="nomina-periodo">${nombreMes} ${nomina.año}</span>
            <span class="nomina-monto">$${nomina.sueldo_neto.toFixed(2)} USD</span>
            <span class="estatus-badge ${nomina.estatus}">${nomina.estatus}</span>
          </div>
          <div class="nomina-details">
            <div class="nomina-detail-row">
              <div><strong>Días trabajados:</strong> ${nomina.dias_trabajados}</div>
              <div><strong>Sueldo base:</strong> $${nomina.sueldo_base.toFixed(2)}</div>
            </div>
            <div class="nomina-detail-row">
              <div><strong>Días feriados:</strong> ${nomina.dias_feriados || 0}</div>
              <div><strong>Monto días feriados:</strong> $${(nomina.monto_dias_feriados || 0).toFixed(2)}</div>
            </div>
            <div class="nomina-detail-row">
              <div><strong>Bonos:</strong> $${(nomina.bonos || 0).toFixed(2)}</div>
              <div><strong>Comisiones:</strong> $${(nomina.comisiones || 0).toFixed(2)}</div>
            </div>
            <div class="nomina-detail-row">
              <div><strong>Total devengado:</strong> $${nomina.total_devengado.toFixed(2)}</div>
              <div><strong>Deducciones:</strong> $${nomina.total_deducciones.toFixed(2)}</div>
            </div>
            ${nomina.fecha_pago ? `<div class="nomina-detail-row"><div><strong>Fecha de pago:</strong> ${formatearFecha(nomina.fecha_pago)}</div></div>` : ""}
            ${nomina.metodo_pago ? `<div class="nomina-detail-row"><div><strong>Método de pago:</strong> ${formatearMetodoPago(nomina.metodo_pago)}</div></div>` : ""}
            ${nomina.observaciones ? `<div class="nomina-observaciones"><strong>Observaciones:</strong> ${nomina.observaciones}</div>` : ""}
          </div>
        </div>
      `
      })
      .join("")

    contenedor.innerHTML = nominasHTML
  })
}

// Función para formatear método de pago
function formatearMetodoPago(metodo) {
  const metodos = {
    transferencia: "Transferencia Bancaria",
    efectivo: "Efectivo",
    cheque: "Cheque",
    pago_movil: "Pago Móvil",
  }
  return metodos[metodo] || metodo
}

// Función para obtener nombre del mes
function obtenerNombreMes(numeroMes) {
  const meses = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ]
  return meses[numeroMes - 1] || "Mes desconocido"
}

// Event listeners para cerrar popups
document.getElementById("cerrar-popup").addEventListener("click", cerrarPopupDetalles)
document.getElementById("cerrar-popup-nomina").addEventListener("click", cerrarPopupNomina)
document.getElementById("cerrar-popup-estatus").addEventListener("click", cerrarPopupEstatus)
document.getElementById("cerrar-popup-confirmar").addEventListener("click", cerrarPopupConfirmar)

function cerrarPopupDetalles() {
  document.getElementById("popup-detalles").classList.add("oculto")
  empleadoSeleccionado = null
  modoEdicion = false

  // Resetear botones y campos
  document.getElementById("boton-editar-guardar").textContent = "✏️ Editar"
  document.getElementById("eliminar-empleado").classList.add("hidden")

  // Hacer campos readonly
  hacerCamposReadonly()
}

function cerrarPopupNomina() {
  document.getElementById("popup-nomina").classList.add("oculto")
  empleadoSeleccionado = null
  document.getElementById("historial-nomina-container").innerHTML = ""
}

function cerrarPopupEstatus() {
  document.getElementById("popup-estatus").classList.add("oculto")
  document.getElementById("form-cambio-estatus").reset()
  document.getElementById("campo-fecha-egreso").style.display = "none"
  document.getElementById("campo-motivo-egreso").style.display = "none"
}

function cerrarPopupConfirmar() {
  document.getElementById("popup-confirmar-eliminar").classList.add("oculto")
}

// Función para hacer campos readonly
function hacerCamposReadonly() {
  const campos = [
    "detalle-nombre",
    "detalle-apellido",
    "detalle-cedula",
    "detalle-telefono",
    "detalle-direccion",
    "detalle-email",
    "detalle-sueldo",
    "detalle-fecha-ingreso",
    "detalle-cuenta",
  ]

  campos.forEach((campoId) => {
    const campo = document.getElementById(campoId)
    if (campo) {
      campo.readOnly = true
    }
  })

  const selects = ["detalle-cargo", "detalle-jornada", "detalle-banco"]
  selects.forEach((selectId) => {
    const select = document.getElementById(selectId)
    if (select) {
      select.disabled = true
    }
  })
}

// Event listener para editar empleado
document.getElementById("boton-editar-guardar").addEventListener("click", function () {
  if (!modoEdicion) {
    // Entrar en modo edición
    modoEdicion = true
    this.textContent = "💾 Guardar"

    // Guardar valores originales
    const empleado = empleados.find((emp) => emp.id == empleadoSeleccionado)
    valoresOriginales = { ...empleado }

    // Hacer campos editables
    const campos = [
      "detalle-nombre",
      "detalle-apellido",
      "detalle-telefono",
      "detalle-direccion",
      "detalle-email",
      "detalle-sueldo",
      "detalle-cuenta",
    ]

    campos.forEach((campoId) => {
      const campo = document.getElementById(campoId)
      if (campo) {
        campo.readOnly = false
      }
    })

    const selects = ["detalle-cargo", "detalle-jornada", "detalle-banco"]
    selects.forEach((selectId) => {
      const select = document.getElementById(selectId)
      if (select) {
        select.disabled = false
      }
    })
  } else {
    // Guardar cambios
    guardarCambiosEmpleado()
  }
})

// Función para guardar cambios del empleado
function guardarCambiosEmpleado() {
  const datosActualizados = {
    nombre: document.getElementById("detalle-nombre").value.trim(),
    apellido: document.getElementById("detalle-apellido").value.trim(),
    telefono: document.getElementById("detalle-telefono").value.trim(),
    direccion: document.getElementById("detalle-direccion").value.trim(),
    email: document.getElementById("detalle-email").value.trim(),
    cargo: document.getElementById("detalle-cargo").value,
    tipo_jornada: document.getElementById("detalle-jornada").value,
    sueldo_base: Number.parseFloat(document.getElementById("detalle-sueldo").value),
    banco: document.getElementById("detalle-banco").value,
    cuenta_bancaria: document.getElementById("detalle-cuenta").value.trim(),
  }

  // Validaciones
  if (!datosActualizados.nombre || !datosActualizados.apellido) {
    alert("El nombre y apellido son obligatorios.")
    return
  }

  if (datosActualizados.sueldo_base <= 0) {
    alert("El sueldo base debe ser mayor a 0.")
    return
  }

  // Actualizar en la base de datos
  const query = `
    UPDATE empleados 
    SET nombre = ?, apellido = ?, telefono = ?, direccion = ?, email = ?, 
        cargo = ?, tipo_jornada = ?, sueldo_base = ?, banco = ?, cuenta_bancaria = ?
    WHERE id = ?
  `

  db.run(
    query,
    [
      datosActualizados.nombre,
      datosActualizados.apellido,
      datosActualizados.telefono,
      datosActualizados.direccion,
      datosActualizados.email,
      datosActualizados.cargo,
      datosActualizados.tipo_jornada,
      datosActualizados.sueldo_base,
      datosActualizados.banco,
      datosActualizados.cuenta_bancaria,
      empleadoSeleccionado,
    ],
    (err) => {
      if (err) {
        console.error("Error al actualizar empleado:", err.message)
        alert("Error al actualizar el empleado.")
        return
      }

      alert("✅ Empleado actualizado exitosamente.")

      // Salir del modo edición
      modoEdicion = false
      document.getElementById("boton-editar-guardar").textContent = "✏️ Editar"
      hacerCamposReadonly()

      // Recargar empleados
      cargarEmpleados()
      cerrarPopupDetalles()
    },
  )
}

// Event listener para cambiar estatus
document.getElementById("cambiar-estatus").addEventListener("click", () => {
  abrirPopupCambioEstatus(empleadoSeleccionado)
})

// Función para abrir popup de cambio de estatus
function abrirPopupCambioEstatus(empleadoId) {
  const empleado = empleados.find((emp) => emp.id == empleadoId)
  if (!empleado) return

  empleadoSeleccionado = empleadoId

  const titulo = document.getElementById("titulo-cambio-estatus")
  titulo.innerHTML = `🔄 Cambiar Estatus de<br><strong>${empleado.nombre} ${empleado.apellido}</strong>`

  // Establecer estatus actual
  document.getElementById("nuevo-estatus").value = empleado.estatus

  document.getElementById("popup-estatus").classList.remove("oculto")
}

// Event listener para cambio de estatus
document.getElementById("nuevo-estatus").addEventListener("change", (e) => {
  const nuevoEstatus = e.target.value
  const campoFecha = document.getElementById("campo-fecha-egreso")
  const campoMotivo = document.getElementById("campo-motivo-egreso")

  if (nuevoEstatus === "inactivo") {
    campoFecha.style.display = "block"
    campoMotivo.style.display = "block"
    document.getElementById("fecha-egreso").required = true
    document.getElementById("motivo-egreso").required = true

    // Establecer fecha actual como máximo
    const hoy = new Date().toISOString().split("T")[0]
    document.getElementById("fecha-egreso").max = hoy
    document.getElementById("fecha-egreso").value = hoy
  } else {
    campoFecha.style.display = "none"
    campoMotivo.style.display = "none"
    document.getElementById("fecha-egreso").required = false
    document.getElementById("motivo-egreso").required = false
  }
})

// Event listener para formulario de cambio de estatus
document.getElementById("form-cambio-estatus").addEventListener("submit", (e) => {
  e.preventDefault()

  const nuevoEstatus = document.getElementById("nuevo-estatus").value
  const fechaEgreso = document.getElementById("fecha-egreso").value
  const motivoEgreso = document.getElementById("motivo-egreso").value

  if (!nuevoEstatus) {
    alert("Debe seleccionar un estatus.")
    return
  }

  let query = "UPDATE empleados SET estatus = ?"
  const params = [nuevoEstatus]

  if (nuevoEstatus === "inactivo") {
    if (!fechaEgreso || !motivoEgreso) {
      alert("Debe completar la fecha y motivo de egreso.")
      return
    }
    query += ", fecha_egreso = ?, motivo_egreso = ?"
    params.push(fechaEgreso, motivoEgreso)
  } else {
    // Si se reactiva, limpiar fecha y motivo de egreso
    query += ", fecha_egreso = NULL, motivo_egreso = NULL"
  }

  query += " WHERE id = ?"
  params.push(empleadoSeleccionado)

  db.run(query, params, (err) => {
    if (err) {
      console.error("Error al cambiar estatus:", err.message)
      alert("Error al cambiar el estatus del empleado.")
      return
    }

    const empleado = empleados.find((emp) => emp.id == empleadoSeleccionado)
    const accion = nuevoEstatus === "activo" ? "activado" : "desactivado"

    alert(`✅ Empleado ${empleado.nombre} ${empleado.apellido} ${accion} exitosamente.`)

    cerrarPopupEstatus()
    cargarEmpleados()

    // Si hay popup de detalles abierto, cerrarlo también
    if (!document.getElementById("popup-detalles").classList.contains("oculto")) {
      cerrarPopupDetalles()
    }
  })
})

// Event listener para cancelar cambio de estatus
document.getElementById("cancelar-estatus").addEventListener("click", cerrarPopupEstatus)

// Event listener para eliminar empleado
document.getElementById("eliminar-empleado").addEventListener("click", () => {
  const empleado = empleados.find((emp) => emp.id == empleadoSeleccionado)
  if (!empleado) return

  document.getElementById("empleado-a-eliminar").textContent =
    `${empleado.nombre} ${empleado.apellido} (${empleado.cedula})`
  document.getElementById("popup-confirmar-eliminar").classList.remove("oculto")
})

// Event listener para confirmar eliminación
document.getElementById("confirmar-eliminar").addEventListener("click", () => {
  const query = "DELETE FROM empleados WHERE id = ?"

  db.run(query, [empleadoSeleccionado], (err) => {
    if (err) {
      console.error("Error al eliminar empleado:", err.message)
      alert("Error al eliminar el empleado.")
      return
    }

    const empleado = empleados.find((emp) => emp.id == empleadoSeleccionado)
    alert(`✅ Empleado ${empleado.nombre} ${empleado.apellido} eliminado permanentemente de la base de datos.`)

    cerrarPopupConfirmar()
    cerrarPopupDetalles()
    cargarEmpleados()
  })
})

// Event listener para cancelar eliminación
document.getElementById("cancelar-eliminar").addEventListener("click", cerrarPopupConfirmar)

// Event listener para generar reporte de nómina
document.getElementById("generar-reporte-nomina").addEventListener("click", () => {
  const empleado = empleados.find((emp) => emp.id == empleadoSeleccionado)
  if (empleado) {
    generarReporteNomina(empleado)
  }
})

// Función para generar reporte de nómina - ACTUALIZADA
function generarReporteNomina(empleado) {
  const query = `
    SELECT * FROM nomina 
    WHERE empleado_id = ? 
    ORDER BY año DESC, mes DESC
  `

  db.all(query, [empleado.id], (err, nominas) => {
    if (err) {
      console.error("Error al cargar nóminas para reporte:", err.message)
      return
    }

    if (nominas.length === 0) {
      alert("Este empleado no tiene registros de nómina para generar un reporte.")
      return
    }

    const cargoFormateado = formatearCargo(empleado.cargo)
    const totalPagado = nominas.reduce((total, nomina) => total + nomina.sueldo_neto, 0)

    const nominasHTML = nominas
      .map((nomina) => {
        const nombreMes = obtenerNombreMes(nomina.mes)
        return `
        <tr>
          <td>${nombreMes} ${nomina.año}</td>
          <td>${nomina.dias_trabajados}</td>
          <td>$${nomina.sueldo_base.toFixed(2)}</td>
          <td>${nomina.dias_feriados || 0}</td>
          <td>$${(nomina.monto_dias_feriados || 0).toFixed(2)}</td>
          <td>$${(nomina.bonos || 0).toFixed(2)}</td>
          <td>$${nomina.total_devengado.toFixed(2)}</td>
          <td>$${nomina.total_deducciones.toFixed(2)}</td>
          <td>$${nomina.sueldo_neto.toFixed(2)}</td>
          <td><span class="estatus-${nomina.estatus}">${nomina.estatus}</span></td>
        </tr>
      `
      })
      .join("")

    const contenidoReporte = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reporte de Nómina - ${empleado.nombre} ${empleado.apellido}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
            line-height: 1.6;
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #880808;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 28px;
            font-weight: bold;
            color: #880808;
            margin-bottom: 5px;
          }
          .subtitle {
            color: #666;
            font-size: 14px;
          }
          .empleado-info {
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #880808;
            margin-bottom: 30px;
          }
          .empleado-info h3 {
            color: #880808;
            margin-bottom: 10px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
          }
          .nomina-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          .nomina-table th,
          .nomina-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: center;
            font-size: 11px;
          }
          .nomina-table th {
            background-color: #880808;
            color: white;
            font-weight: bold;
          }
          .nomina-table tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          .estatus-pendiente {
            color: #ffc107;
            font-weight: bold;
          }
          .estatus-pagada {
            color: #28a745;
            font-weight: bold;
          }
          .estatus-cancelado {
            color: #dc3545;
            font-weight: bold;
          }
          .resumen {
            background-color: #f0f0f0;
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
          }
          .resumen h4 {
            color: #880808;
            margin-bottom: 15px;
          }
          .resumen-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding: 5px 0;
            border-bottom: 1px dotted #ccc;
          }
          .resumen-total {
            font-weight: bold;
            font-size: 16px;
            color: #880808;
            border-top: 2px solid #880808;
            padding-top: 10px;
            margin-top: 10px;
          }
          .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">🏋️ SIMETRIC GYM C.A.</div>
          <div class="subtitle">Reporte de Historial de Nómina</div>
        </div>

        <div class="empleado-info">
          <h3>👤 Información del Empleado</h3>
          <div class="info-row">
            <span><strong>Nombre:</strong> ${empleado.nombre} ${empleado.apellido}</span>
            <span><strong>Cédula:</strong> ${empleado.cedula}</span>
          </div>
          <div class="info-row">
            <span><strong>Cargo:</strong> ${cargoFormateado}</span>
            <span><strong>Fecha de Ingreso:</strong> ${formatearFecha(empleado.fecha_ingreso)}</span>
          </div>
        </div>

        <table class="nomina-table">
          <thead>
            <tr>
              <th>Período</th>
              <th>Días Trab.</th>
              <th>Sueldo Base</th>
              <th>Días Feriados</th>
              <th>Monto Feriados</th>
              <th>Bonos</th>
              <th>Devengado</th>
              <th>Deducciones</th>
              <th>Neto</th>
              <th>Estatus</th>
            </tr>
          </thead>
          <tbody>
            ${nominasHTML}
          </tbody>
        </table>

        <div class="resumen">
          <h4>📊 Resumen del Historial</h4>
          <div class="resumen-item">
            <span>Total de períodos registrados:</span>
            <span>${nominas.length}</span>
          </div>
          <div class="resumen-item">
            <span>Períodos pagados:</span>
            <span>${nominas.filter((n) => n.estatus === "pagada").length}</span>
          </div>
          <div class="resumen-item">
            <span>Períodos pendientes:</span>
            <span>${nominas.filter((n) => n.estatus === "pendiente").length}</span>
          </div>
          <div class="resumen-item">
            <span>Total días feriados trabajados:</span>
            <span>${nominas.reduce((total, n) => total + (n.dias_feriados || 0), 0)}</span>
          </div>
          <div class="resumen-item resumen-total">
            <span>Total pagado histórico:</span>
            <span>$${totalPagado.toFixed(2)} USD</span>
          </div>
        </div>

        <div class="footer">
          <p><strong>SIMETRIC GYM C.A.</strong></p>
          <p>Reporte generado el ${new Date().toLocaleDateString("es-ES")} a las ${new Date().toLocaleTimeString("es-ES")}</p>
          <p>RIF: J-31700635/3</p>
        </div>
      </body>
      </html>
    `

    // Abrir ventana para imprimir/guardar
    const ventanaReporte = window.open("", "", "width=1000,height=700")
    if (!ventanaReporte) {
      alert(
        "❌ Error: El navegador bloqueó la ventana emergente. Por favor, permite ventanas emergentes para este sitio.",
      )
      return
    }

    ventanaReporte.document.write(contenidoReporte)
    ventanaReporte.document.close()

    // Dar tiempo para que se cargue el contenido y luego mostrar diálogo de impresión
    setTimeout(() => {
      ventanaReporte.print()
    }, 500)
  })
}

// Cargar empleados al inicializar la página
document.addEventListener("DOMContentLoaded", () => {
  cargarEmpleados()
  hacerCamposReadonly()
})

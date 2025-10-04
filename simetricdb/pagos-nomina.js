const sqlite3 = require("sqlite3").verbose()
const db = new sqlite3.Database("simetricdb.sqlite", (err) => {
  if (err) {
    console.error("Error al conectar con la base de datos:", err.message)
  } else {
    console.log("Conectado a la base de datos para pagos de nómina.")
  }
})

// Variables globales
let nominasParaPago = []
let nominaSeleccionadaPago = null
const nominasSeleccionadas = new Set()

// Inicializar página
document.addEventListener("DOMContentLoaded", () => {
  inicializarSelectoresPago()
  establecerPeriodoActualPago()
})

// Función para inicializar selectores de año
function inicializarSelectoresPago() {
  const añoSelect = document.getElementById("año-pago")
  const añoActual = new Date().getFullYear()

  // Llenar selector de años
  for (let año = 2020; año <= añoActual + 1; año++) {
    const option = document.createElement("option")
    option.value = año
    option.textContent = año
    if (año === añoActual) option.selected = true
    añoSelect.appendChild(option)
  }
}

// Función para establecer período actual
function establecerPeriodoActualPago() {
  const fechaActual = new Date()
  document.getElementById("mes-pago").value = fechaActual.getMonth() + 1
  document.getElementById("año-pago").value = fechaActual.getFullYear()

  // Establecer fecha de pago como hoy
  const hoy = new Date().toISOString().split("T")[0]
  document.getElementById("fecha-pago").value = hoy
  document.getElementById("fecha-pago-masivo").value = hoy
}

// Event listeners
document.getElementById("cargar-nominas-pago").addEventListener("click", cargarNominasParaPago)
document.getElementById("pagar-seleccionados").addEventListener("click", abrirPagoMasivo)
document.getElementById("pagar-todos").addEventListener("click", pagarTodos)
document.getElementById("generar-reporte-pagos").addEventListener("click", generarReportePagos)

// Función para cargar nóminas para pago
function cargarNominasParaPago() {
  const mes = Number.parseInt(document.getElementById("mes-pago").value)
  const año = Number.parseInt(document.getElementById("año-pago").value)
  const estatus = document.getElementById("estatus-pago").value

  let whereClause = "WHERE n.mes = ? AND n.año = ?"
  const params = [mes, año]

  if (estatus !== "todos") {
    whereClause += " AND n.estatus = ?"
    params.push(estatus)
  }

  const query = `
    SELECT n.*, e.nombre, e.apellido, e.cargo, e.banco, e.cuenta_bancaria
    FROM nomina n
    INNER JOIN empleados e ON n.empleado_id = e.id
    ${whereClause}
    ORDER BY n.estatus ASC, e.nombre ASC, e.apellido ASC
  `

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error("Error cargando nóminas para pago:", err.message)
      alert("Error al cargar las nóminas.")
      return
    }

    if (rows.length === 0) {
      alert("No se encontraron nóminas para el período y estatus seleccionados.")
      document.getElementById("resumen-pagos").style.display = "none"
      document.getElementById("pagos-container").innerHTML = ""
      return
    }

    nominasParaPago = rows
    nominasSeleccionadas.clear()
    mostrarResumenPagos()
    renderizarNominasPago()
  })
}

// Función para mostrar resumen de pagos (ACTUALIZADA CON UTILIDADES)
function mostrarResumenPagos() {
  const totalEmpleados = nominasParaPago.length
  const totalPendiente = nominasParaPago
    .filter((n) => n.estatus !== "pagada")
    .reduce((sum, n) => sum + (n.sueldo_neto || 0) + (n.utilidades || 0), 0)
  const totalPagado = nominasParaPago
    .filter((n) => n.estatus === "pagada")
    .reduce((sum, n) => sum + (n.sueldo_neto || 0) + (n.utilidades || 0), 0)
  const empleadosPendientes = nominasParaPago.filter((n) => n.estatus !== "pagada").length

  document.getElementById("total-empleados-pago").textContent = totalEmpleados
  document.getElementById("total-pendiente-pago").textContent = `$${totalPendiente.toFixed(2)}`
  document.getElementById("total-pagado").textContent = `$${totalPagado.toFixed(2)}`
  document.getElementById("empleados-pendientes").textContent = empleadosPendientes

  document.getElementById("resumen-pagos").style.display = "block"
}

// Función para renderizar nóminas para pago (ACTUALIZADA CON UTILIDADES)
function renderizarNominasPago() {
  const container = document.getElementById("pagos-container")
  const mes = Number.parseInt(document.getElementById("mes-pago").value)

  const nominasHTML = nominasParaPago
    .map((nomina) => {
      const estatusClass =
        nomina.estatus === "pagada" ? "pagada" : nomina.estatus === "procesada" ? "procesada" : "pendiente"

      // Calcular total a pagar (nómina + utilidades)
      const totalAPagar = (nomina.sueldo_neto || 0) + (nomina.utilidades || 0)

      // Formatear nombre completo
      const nombreCompleto = `${(nomina.nombre || "").trim()} ${(nomina.apellido || "").trim()}`.trim()

      return `
      <div class="nomina-pago ${estatusClass}">
        <div class="pago-header">
          <div class="checkbox-container">
            <input type="checkbox" class="nomina-checkbox" data-nomina-id="${nomina.id}"
                   ${nomina.estatus === "pagada" ? "disabled" : ""}>
          </div>
          <div class="empleado-info">
            <h4>${nombreCompleto || "Nombre no disponible"}</h4>
            <div class="empleado-cargo">${formatearCargo(nomina.cargo)}</div>
            <div class="empleado-banco">${nomina.banco || "Sin banco"} - ${nomina.cuenta_bancaria || "Sin cuenta"}</div>
          </div>
          <div class="pago-status">
            <span class="status-badge status-${nomina.estatus}">${nomina.estatus.toUpperCase()}</span>
            <div class="pago-monto">$${totalAPagar.toFixed(2)}</div>
            ${mes === 12 && nomina.utilidades > 0 ? `<div class="pago-utilidades">🎁 +$${(nomina.utilidades || 0).toFixed(2)}</div>` : ""}
          </div>
        </div>
        
        <div class="pago-detalles">
          <div class="detalle-item">
            <div class="detalle-label">Días Trabajados</div>
            <div class="detalle-valor">${nomina.dias_trabajados}</div>
          </div>
          <div class="detalle-item">
            <div class="detalle-label">Total Devengado</div>
            <div class="detalle-valor">$${(nomina.total_devengado || 0).toFixed(2)}</div>
          </div>
          <div class="detalle-item">
            <div class="detalle-label">Deducciones</div>
            <div class="detalle-valor">$${(nomina.total_deducciones || 0).toFixed(2)}</div>
          </div>
          <div class="detalle-item">
            <div class="detalle-label">Sueldo Neto</div>
            <div class="detalle-valor">$${(nomina.sueldo_neto || 0).toFixed(2)}</div>
          </div>
          ${
            mes === 12 && nomina.utilidades > 0
              ? `
          <div class="detalle-item utilidades">
            <div class="detalle-label">🎁 Utilidades</div>
            <div class="detalle-valor">$${(nomina.utilidades || 0).toFixed(2)}</div>
          </div>
          `
              : ""
          }
          <div class="detalle-item">
            <div class="detalle-label">Fecha Pago</div>
            <div class="detalle-valor">${nomina.fecha_pago ? new Date(nomina.fecha_pago).toLocaleDateString("es-ES") : "Sin pagar"}</div>
          </div>
        </div>
        
        <div class="pago-acciones">
          <button class="btn-primary btn-small procesar-pago" data-nomina-id="${nomina.id}"
                   ${nomina.estatus === "pagada" ? "disabled" : ""}>
            💳 ${nomina.estatus === "pagada" ? "Pagado" : "Procesar Pago"}
          </button>
          <button class="btn-info btn-small generar-recibo-individual" data-nomina-id="${nomina.id}">
            🧾 Recibo
          </button>
        </div>
      </div>
    `
    })
    .join("")

  container.innerHTML = `<div class="pagos-grid">${nominasHTML}</div>`

  // Agregar event listeners para checkboxes
  document.querySelectorAll(".nomina-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", actualizarSeleccion)
  })
}

// Función para actualizar selección (ACTUALIZADA CON UTILIDADES)
function actualizarSeleccion() {
  nominasSeleccionadas.clear()
  document.querySelectorAll(".nomina-checkbox:checked").forEach((checkbox) => {
    nominasSeleccionadas.add(Number.parseInt(checkbox.dataset.nominaId))
  })

  // Actualizar botones
  const btnPagarSeleccionados = document.getElementById("pagar-seleccionados")
  btnPagarSeleccionados.disabled = nominasSeleccionadas.size === 0
  btnPagarSeleccionados.textContent = `💰 Pagar Seleccionados (${nominasSeleccionadas.size})`
}

// Event listeners para acciones de pago
document.addEventListener("click", (event) => {
  const nominaId = event.target.dataset.nominaId
  if (event.target.classList.contains("procesar-pago")) {
    abrirPagoIndividual(nominaId)
  } else if (event.target.classList.contains("generar-recibo-individual")) {
    generarReciboIndividual(nominaId)
  }
})

// Función para abrir pago individual (ACTUALIZADA CON UTILIDADES)
function abrirPagoIndividual(nominaId) {
  const nomina = nominasParaPago.find((n) => n.id == nominaId)
  if (!nomina) {
    alert("No se encontró la nómina seleccionada.")
    return
  }

  nominaSeleccionadaPago = nominaId

  // Formatear nombre completo
  const nombreCompleto = `${(nomina.nombre || "").trim()} ${(nomina.apellido || "").trim()}`.trim()

  // Llenar datos del empleado
  document.getElementById("pago-empleado").value = nombreCompleto || "Nombre no disponible"
  document.getElementById("pago-periodo").value = nomina.periodo
  document.getElementById("pago-cargo").value = formatearCargo(nomina.cargo)
  document.getElementById("pago-banco").value = nomina.banco || "No especificado"
  document.getElementById("pago-cuenta").value = nomina.cuenta_bancaria || "No especificada"

  // Llenar detalles del pago
  document.getElementById("pago-sueldo-base").textContent = `$${(nomina.sueldo_base || 0).toFixed(2)}`
  document.getElementById("pago-dias-feriados").textContent = `$${(nomina.monto_dias_feriados || 0).toFixed(2)}`
  document.getElementById("pago-bonos").textContent = `$${(nomina.bonos || 0).toFixed(2)}`
  document.getElementById("pago-comisiones").textContent = `$${(nomina.comisiones || 0).toFixed(2)}`
  document.getElementById("pago-total-devengado").textContent = `$${(nomina.total_devengado || 0).toFixed(2)}`
  document.getElementById("pago-seguro-social").textContent = `$${(nomina.seguro_social || 0).toFixed(2)}`
  document.getElementById("pago-lph").textContent = `$${(nomina.ley_politica_habitacional || 0).toFixed(2)}`
  document.getElementById("pago-paro-forzoso").textContent = `$${(nomina.paro_forzoso || 0).toFixed(2)}`
  document.getElementById("pago-total-deducciones").textContent = `$${(nomina.total_deducciones || 0).toFixed(2)}`
  document.getElementById("pago-sueldo-neto").textContent = `$${(nomina.sueldo_neto || 0).toFixed(2)}`

  // Mostrar utilidades si es diciembre y hay utilidades
  const utilidadesSection = document.getElementById("pago-utilidades-section")
  const totalFinalSection = document.getElementById("pago-total-final-section")

  if (nomina.mes === 12 && nomina.utilidades > 0) {
    document.getElementById("pago-utilidades").textContent = `$${(nomina.utilidades || 0).toFixed(2)}`
    utilidadesSection.style.display = "flex"

    const totalFinal = (nomina.sueldo_neto || 0) + (nomina.utilidades || 0)
    document.getElementById("pago-total-final").textContent = `$${totalFinal.toFixed(2)}`
    totalFinalSection.style.display = "flex"
  } else {
    utilidadesSection.style.display = "none"
    totalFinalSection.style.display = "none"
  }

  // Limpiar campos del formulario
  document.getElementById("metodo-pago").value = ""
  document.getElementById("referencia-pago").value = ""
  document.getElementById("observaciones-pago").value = ""

  document.getElementById("popup-pago").classList.remove("oculto")
}

// Función para procesar pago individual (SIN CAMBIOS - ya funciona correctamente)
document.getElementById("form-pago").addEventListener("submit", (e) => {
  e.preventDefault()

  const fechaPago = document.getElementById("fecha-pago").value
  const metodoPago = document.getElementById("metodo-pago").value
  const referenciaPago = document.getElementById("referencia-pago").value
  const observacionesPago = document.getElementById("observaciones-pago").value

  if (!fechaPago || !metodoPago) {
    alert("Por favor complete todos los campos obligatorios.")
    return
  }

  if (!confirm("¿Está seguro de procesar este pago?")) {
    return
  }

  const query = `
    UPDATE nomina 
    SET estatus = 'pagada',
        fecha_pago = ?,
        metodo_pago = ?,
        referencia_pago = ?,
        observaciones_pago = ?
    WHERE id = ?
  `

  db.run(query, [fechaPago, metodoPago, referenciaPago, observacionesPago, nominaSeleccionadaPago], (err) => {
    if (err) {
      console.error("Error procesando pago:", err.message)
      alert("Error al procesar el pago: " + err.message)
      return
    }

    alert("✅ Pago procesado exitosamente.")
    document.getElementById("popup-pago").classList.add("oculto")
    cargarNominasParaPago() // Recargar lista
  })
})

// Función para abrir pago masivo (ACTUALIZADA CON UTILIDADES)
function abrirPagoMasivo() {
  if (nominasSeleccionadas.size === 0) {
    alert("Por favor seleccione al menos una nómina para pagar.")
    return
  }

  const nominasAPagar = nominasParaPago.filter((n) => nominasSeleccionadas.has(n.id))
  const totalNomina = nominasAPagar.reduce((sum, n) => sum + (n.sueldo_neto || 0), 0)
  const totalUtilidades = nominasAPagar.reduce((sum, n) => sum + (n.utilidades || 0), 0)
  const totalPago = totalNomina + totalUtilidades

  document.getElementById("empleados-seleccionados-count").textContent = nominasSeleccionadas.size
  document.getElementById("total-nomina-masivo").textContent = totalNomina.toFixed(2)
  document.getElementById("total-utilidades-masivo").textContent = totalUtilidades.toFixed(2)
  document.getElementById("total-pago-masivo").textContent = totalPago.toFixed(2)

  // Limpiar campos del formulario masivo
  document.getElementById("metodo-pago-masivo").value = ""
  document.getElementById("observaciones-pago-masivo").value = ""

  document.getElementById("popup-pago-masivo").classList.remove("oculto")
}

// Función para procesar pago masivo (SIN CAMBIOS - ya funciona correctamente)
document.getElementById("form-pago-masivo").addEventListener("submit", (e) => {
  e.preventDefault()

  const fechaPago = document.getElementById("fecha-pago-masivo").value
  const metodoPago = document.getElementById("metodo-pago-masivo").value
  const observacionesPago = document.getElementById("observaciones-pago-masivo").value

  if (!fechaPago || !metodoPago) {
    alert("Por favor complete todos los campos obligatorios.")
    return
  }

  if (!confirm(`¿Está seguro de procesar el pago de ${nominasSeleccionadas.size} empleados?`)) {
    return
  }

  let procesados = 0
  let errores = 0
  const total = nominasSeleccionadas.size

  nominasSeleccionadas.forEach((nominaId) => {
    const query = `
      UPDATE nomina 
      SET estatus = 'pagada',
          fecha_pago = ?,
          metodo_pago = ?,
          observaciones_pago = ?
      WHERE id = ?
    `

    db.run(query, [fechaPago, metodoPago, observacionesPago, nominaId], (err) => {
      if (err) {
        console.error("Error procesando pago masivo:", err.message)
        errores++
      } else {
        procesados++
      }

      if (procesados + errores === total) {
        if (errores > 0) {
          alert(`⚠️ Pago masivo completado con ${errores} errores. ${procesados} pagos procesados correctamente.`)
        } else {
          alert(`✅ Pago masivo procesado exitosamente para ${total} empleados.`)
        }
        document.getElementById("popup-pago-masivo").classList.add("oculto")
        cargarNominasParaPago() // Recargar lista
      }
    })
  })
})

// Función para pagar todos (ACTUALIZADA)
function pagarTodos() {
  const nominasPendientes = nominasParaPago.filter((n) => n.estatus !== "pagada")

  if (nominasPendientes.length === 0) {
    alert("No hay nóminas pendientes de pago.")
    return
  }

  // Seleccionar todas las pendientes
  nominasSeleccionadas.clear()
  nominasPendientes.forEach((n) => nominasSeleccionadas.add(n.id))

  // Actualizar checkboxes
  document.querySelectorAll(".nomina-checkbox").forEach((checkbox) => {
    const nominaId = Number.parseInt(checkbox.dataset.nominaId)
    checkbox.checked = nominasSeleccionadas.has(nominaId)
  })

  actualizarSeleccion()
  abrirPagoMasivo()
}

// Función para generar recibo individual
function generarReciboIndividual(nominaId) {
  const nomina = nominasParaPago.find((n) => n.id == nominaId)
  if (!nomina) {
    alert("No se encontró la nómina seleccionada.")
    return
  }

  generarReciboPago(nomina)
}

// Función para generar recibo de pago (ACTUALIZADA CON UTILIDADES)
function generarReciboPago(nomina) {
  // Formatear nombre completo
  const nombreCompleto = `${(nomina.nombre || "").trim()} ${(nomina.apellido || "").trim()}`.trim()

  // Calcular total final
  const totalFinal = (nomina.sueldo_neto || 0) + (nomina.utilidades || 0)
  const tieneUtilidades = nomina.mes === 12 && nomina.utilidades > 0

  const contenidoRecibo = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Recibo de Pago - ${nombreCompleto}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          color: #333;
          line-height: 1.6;
        }
        .recibo-container {
          max-width: 800px;
          margin: 0 auto;
          border: 2px solid #880808;
          border-radius: 10px;
          overflow: hidden;
        }
        .header {
          background-color: #880808;
          color: white;
          padding: 20px;
          text-align: center;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 5px;
        }
        .subtitle {
          font-size: 16px;
          opacity: 0.9;
        }
        .recibo-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          padding: 20px;
          background-color: #f9f9f9;
        }
        .info-section h3 {
          color: #880808;
          margin-bottom: 10px;
          border-bottom: 1px solid #880808;
          padding-bottom: 5px;
        }
        .info-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          padding: 5px 0;
        }
        .info-label {
          font-weight: bold;
        }
        .detalles-pago {
          padding: 20px;
        }
        .detalles-pago h3 {
          color: #880808;
          text-align: center;
          margin-bottom: 20px;
          border-bottom: 2px solid #880808;
          padding-bottom: 10px;
        }
        .pago-tabla {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        .pago-tabla th,
        .pago-tabla td {
          border: 1px solid #ddd;
          padding: 12px;
          text-align: left;
        }
        .pago-tabla th {
          background-color: #880808;
          color: white;
        }
        .pago-tabla tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .total-row {
          background-color: #e8f5e8 !important;
          font-weight: bold;
          font-size: 1.1em;
        }
        .utilidades-row {
          background-color: #fff3cd !important;
          font-weight: bold;
          color: #856404;
        }
        .final-row {
          background-color: #d4edda !important;
          font-weight: bold;
          font-size: 1.2em;
          color: #155724;
        }
        .footer {
          background-color: #f0f0f0;
          padding: 15px;
          text-align: center;
          font-size: 12px;
          color: #666;
        }
        .firma-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          margin-top: 40px;
          padding: 20px;
        }
        .firma-box {
          text-align: center;
          border-top: 1px solid #333;
          padding-top: 10px;
        }
        @media print {
          body { margin: 0; }
          .recibo-container { border: none; }
        }
      </style>
    </head>
    <body>
      <div class="recibo-container">
        <div class="header">
          <div class="logo">🏋️ SIMETRIC GYM C.A.</div>
          <div class="subtitle">Recibo de Pago de Nómina${tieneUtilidades ? " + Utilidades" : ""}</div>
        </div>

        <div class="recibo-info">
          <div class="info-section">
            <h3>👤 Información del Empleado</h3>
            <div class="info-item">
              <span class="info-label">Nombre:</span>
              <span>${nombreCompleto || "Nombre no disponible"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Cargo:</span>
              <span>${formatearCargo(nomina.cargo)}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Banco:</span>
              <span>${nomina.banco || "No especificado"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Cuenta:</span>
              <span>${nomina.cuenta_bancaria || "No especificada"}</span>
            </div>
          </div>
          
          <div class="info-section">
            <h3>📅 Información del Pago</h3>
            <div class="info-item">
              <span class="info-label">Período:</span>
              <span>${nomina.periodo}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Días Trabajados:</span>
              <span>${nomina.dias_trabajados}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Fecha de Pago:</span>
              <span>${nomina.fecha_pago ? new Date(nomina.fecha_pago).toLocaleDateString("es-ES") : "Pendiente"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Método de Pago:</span>
              <span>${nomina.metodo_pago || "No especificado"}</span>
            </div>
            ${
              nomina.referencia_pago
                ? `
            <div class="info-item">
              <span class="info-label">Referencia:</span>
              <span>${nomina.referencia_pago}</span>
            </div>
            `
                : ""
            }
          </div>
        </div>

        <div class="detalles-pago">
          <h3>💰 Detalles del Pago</h3>
          <table class="pago-tabla">
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Monto (USD)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Sueldo Base</td>
                <td>$${(nomina.sueldo_base || 0).toFixed(2)}</td>
              </tr>
              ${
                nomina.monto_dias_feriados > 0
                  ? `
              <tr>
                <td>Días Feriados (${nomina.dias_feriados || 0} días)</td>
                <td>$${(nomina.monto_dias_feriados || 0).toFixed(2)}</td>
              </tr>
              `
                  : ""
              }
              ${
                nomina.bonos > 0
                  ? `
              <tr>
                <td>Bonos</td>
                <td>$${(nomina.bonos || 0).toFixed(2)}</td>
              </tr>
              `
                  : ""
              }
              ${
                nomina.comisiones > 0
                  ? `
              <tr>
                <td>Comisiones</td>
                <td>$${(nomina.comisiones || 0).toFixed(2)}</td>
              </tr>
              `
                  : ""
              }
              <tr style="background-color: #e8f5e8; font-weight: bold;">
                <td>TOTAL DEVENGADO</td>
                <td>$${(nomina.total_devengado || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Seguro Social (4%)</td>
                <td>-$${(nomina.seguro_social || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td>LPH (1%)</td>
                <td>-$${(nomina.ley_politica_habitacional || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Paro Forzoso (0.5%)</td>
                <td>-$${(nomina.paro_forzoso || 0).toFixed(2)}</td>
              </tr>
              <tr style="background-color: #ffe8e8; font-weight: bold;">
                <td>TOTAL DEDUCCIONES</td>
                <td>-$${(nomina.total_deducciones || 0).toFixed(2)}</td>
              </tr>
              <tr class="total-row">
                <td><strong>SUELDO NETO</strong></td>
                <td><strong>$${(nomina.sueldo_neto || 0).toFixed(2)}</strong></td>
              </tr>
              ${
                tieneUtilidades
                  ? `
              <tr class="utilidades-row">
                <td><strong>🎁 UTILIDADES (30 días)</strong></td>
                <td><strong>$${(nomina.utilidades || 0).toFixed(2)}</strong></td>
              </tr>
              <tr class="final-row">
                <td><strong>💰 TOTAL A PAGAR</strong></td>
                <td><strong>$${totalFinal.toFixed(2)}</strong></td>
              </tr>
              `
                  : ""
              }
            </tbody>
          </table>
          
          ${
            nomina.observaciones_pago
              ? `
          <div style="margin-top: 20px; padding: 15px; background-color: #f9f9f9; border-left: 4px solid #880808;">
            <strong>Observaciones:</strong> ${nomina.observaciones_pago}
          </div>
          `
              : ""
          }
        </div>

        <div class="firma-section">
          <div class="firma-box">
            <div style="height: 60px;"></div>
            <div>Firma del Empleado</div>
          </div>
          <div class="firma-box">
            <div style="height: 60px;"></div>
            <div>Firma del Empleador</div>
          </div>
        </div>

        <div class="footer">
          <p><strong>SIMETRIC GYM C.A.</strong> | RIF: J-31700635/3</p>
          <p>Recibo generado el ${new Date().toLocaleDateString("es-ES")} a las ${new Date().toLocaleTimeString("es-ES")}</p>
        </div>
      </div>
    </body>
    </html>
  `

  // Abrir ventana para imprimir/guardar
  const ventanaRecibo = window.open("", "", "width=900,height=700")
  if (!ventanaRecibo) {
    alert(
      "❌ Error: El navegador bloqueó la ventana emergente. Por favor, permite ventanas emergentes para este sitio.",
    )
    return
  }

  ventanaRecibo.document.write(contenidoRecibo)
  ventanaRecibo.document.close()
  setTimeout(() => {
    ventanaRecibo.print()
  }, 500)
}

// Función para generar reporte de pagos (ACTUALIZADA CON UTILIDADES)
function generarReportePagos() {
  if (nominasParaPago.length === 0) {
    alert("No hay datos para generar el reporte.")
    return
  }

  const mes = Number.parseInt(document.getElementById("mes-pago").value)
  const año = Number.parseInt(document.getElementById("año-pago").value)

  const totalPagado = nominasParaPago
    .filter((n) => n.estatus === "pagada")
    .reduce((sum, n) => sum + (n.sueldo_neto || 0) + (n.utilidades || 0), 0)
  const totalPendiente = nominasParaPago
    .filter((n) => n.estatus !== "pagada")
    .reduce((sum, n) => sum + (n.sueldo_neto || 0) + (n.utilidades || 0), 0)

  const totalUtilidades = nominasParaPago.reduce((sum, n) => sum + (n.utilidades || 0), 0)
  const empleadosPagados = nominasParaPago.filter((n) => n.estatus === "pagada").length
  const empleadosPendientes = nominasParaPago.filter((n) => n.estatus !== "pagada").length

  const contenidoReporte = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reporte de Pagos - ${obtenerNombreMes(mes)} ${año}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          color: #333;
          line-height: 1.4;
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
          font-size: 16px;
        }
        .resumen {
          background-color: #f9f9f9;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 30px;
          border-left: 4px solid #880808;
        }
        .resumen-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-top: 15px;
        }
        .resumen-item {
          text-align: center;
          padding: 15px;
          background: white;
          border-radius: 5px;
          border: 1px solid #ddd;
        }
        .resumen-numero {
          font-size: 1.8rem;
          font-weight: bold;
          color: #880808;
        }
        .resumen-label {
          color: #666;
          font-size: 0.9rem;
          margin-top: 5px;
        }
        .pagos-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
          font-size: 12px;
        }
        .pagos-table th,
        .pagos-table td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        .pagos-table th {
          background-color: #880808;
          color: white;
          font-weight: bold;
        }
        .pagos-table tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .status-pagada { color: #28a745; font-weight: bold; }
        .status-procesada { color: #ffc107; font-weight: bold; }
        .status-pendiente { color: #dc3545; font-weight: bold; }
        .utilidades-info {
          background-color: #fff3cd;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
          border-left: 4px solid #ffc107;
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
        <div class="subtitle">Reporte de Pagos - ${obtenerNombreMes(mes)} ${año}</div>
      </div>

      ${
        mes === 12 && totalUtilidades > 0
          ? `
      <div class="utilidades-info">
        <h4 style="color: #856404; margin-bottom: 10px;">🎁 Información de Utilidades</h4>
        <p style="margin: 0;"><strong>Este período incluye el pago de utilidades (30 días del salario neto) correspondientes al año ${año}.</strong></p>
      </div>
      `
          : ""
      }

      <div class="resumen">
        <h3>📊 Resumen de Pagos</h3>
        <div class="resumen-grid">
          <div class="resumen-item">
            <div class="resumen-numero">${nominasParaPago.length}</div>
            <div class="resumen-label">Total Empleados</div>
          </div>
          <div class="resumen-item">
            <div class="resumen-numero">${empleadosPagados}</div>
            <div class="resumen-label">Empleados Pagados</div>
          </div>
          <div class="resumen-item">
            <div class="resumen-numero">${empleadosPendientes}</div>
            <div class="resumen-label">Empleados Pendientes</div>
          </div>
          <div class="resumen-item">
            <div class="resumen-numero">$${totalPagado.toFixed(2)}</div>
            <div class="resumen-label">Total Pagado</div>
          </div>
          <div class="resumen-item">
            <div class="resumen-numero">$${totalPendiente.toFixed(2)}</div>
            <div class="resumen-label">Total Pendiente</div>
          </div>
          ${
            totalUtilidades > 0
              ? `
          <div class="resumen-item">
            <div class="resumen-numero">$${totalUtilidades.toFixed(2)}</div>
            <div class="resumen-label">Total Utilidades</div>
          </div>
          `
              : ""
          }
        </div>
      </div>

      <table class="pagos-table">
        <thead>
          <tr>
            <th>Empleado</th>
            <th>Cargo</th>
            <th>Días</th>
            <th>Devengado</th>
            <th>Deducciones</th>
            <th>Neto</th>
            ${mes === 12 ? "<th>Utilidades</th>" : ""}
            <th>Total a Pagar</th>
            <th>Fecha Pago</th>
            <th>Método</th>
            <th>Estatus</th>
          </tr>
        </thead>
        <tbody>
          ${nominasParaPago
            .map((nomina) => {
              const nombreCompleto = `${(nomina.nombre || "").trim()} ${(nomina.apellido || "").trim()}`.trim()
              const totalAPagar = (nomina.sueldo_neto || 0) + (nomina.utilidades || 0)

              return `
          <tr>
            <td>${nombreCompleto || "Nombre no disponible"}</td>
            <td>${formatearCargo(nomina.cargo)}</td>
            <td>${nomina.dias_trabajados}</td>
            <td>$${(nomina.total_devengado || 0).toFixed(2)}</td>
            <td>$${(nomina.total_deducciones || 0).toFixed(2)}</td>
            <td>$${(nomina.sueldo_neto || 0).toFixed(2)}</td>
            ${mes === 12 ? `<td>$${(nomina.utilidades || 0).toFixed(2)}</td>` : ""}
            <td><strong>$${totalAPagar.toFixed(2)}</strong></td>
            <td>${nomina.fecha_pago ? new Date(nomina.fecha_pago).toLocaleDateString("es-ES") : "-"}</td>
            <td>${nomina.metodo_pago || "-"}</td>
            <td><span class="status-${nomina.estatus}">${nomina.estatus.toUpperCase()}</span></td>
          </tr>
          `
            })
            .join("")}
        </tbody>
      </table>

      <div class="footer">
        <p><strong>SIMETRIC GYM C.A.</strong> | RIF: J-31700635/3</p>
        <p>Reporte generado el ${new Date().toLocaleDateString("es-ES")} a las ${new Date().toLocaleTimeString("es-ES")}</p>
      </div>
    </body>
    </html>
  `

  const ventanaReporte = window.open("", "", "width=1200,height=800")
  if (!ventanaReporte) {
    alert(
      "❌ Error: El navegador bloqueó la ventana emergente. Por favor, permite ventanas emergentes para este sitio.",
    )
    return
  }

  ventanaReporte.document.write(contenidoReporte)
  ventanaReporte.document.close()
  setTimeout(() => {
    ventanaReporte.print()
  }, 500)
}

// Event listeners para cerrar popups
document.getElementById("cerrar-popup-pago").addEventListener("click", () => {
  document.getElementById("popup-pago").classList.add("oculto")
})

document.getElementById("cancelar-pago").addEventListener("click", () => {
  document.getElementById("popup-pago").classList.add("oculto")
})

document.getElementById("cerrar-popup-masivo").addEventListener("click", () => {
  document.getElementById("popup-pago-masivo").classList.add("oculto")
})

document.getElementById("cancelar-pago-masivo").addEventListener("click", () => {
  document.getElementById("popup-pago-masivo").classList.add("oculto")
})

// Función para generar recibo desde el popup
document.getElementById("generar-recibo").addEventListener("click", () => {
  const nomina = nominasParaPago.find((n) => n.id == nominaSeleccionadaPago)
  if (nomina) {
    generarReciboPago(nomina)
  }
})

// Funciones auxiliares
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
  return cargos[cargo] || cargo || "N/A"
}

const sqlite3 = require("sqlite3").verbose()

// Conectar a la base de datos
const db = new sqlite3.Database("simetricdb.sqlite", (err) => {
  if (err) {
    console.error(err.message)
  } else {
    console.log("Conectado a la base de datos para mostrar clientes.")
    cargarClientesDesdeDB()
  }
})

let clienteIdSeleccionado = null
let modoEdicion = false
let valoresOriginales = {}
let clientesOriginales = []

// Cargar todos los clientes una sola vez desde la base de datos
function cargarClientesDesdeDB() {
  const query = `
    SELECT c.*, m.nombre as membresia_nombre, m.precio_usd, m.descripcion
    FROM clientes c
    LEFT JOIN membresias m ON c.membresia_id = m.id
    ORDER BY c.nombre, c.apellido
  `

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error(err.message)
      return
    }
    clientesOriginales = rows
    filtrarYMostrarClientes()
  })
}

// Función para aplicar los filtros y mostrar los clientes
function filtrarYMostrarClientes() {
  const nombreFiltro = document.getElementById("search-name").value.toLowerCase()
  const cedulaFiltro = document.getElementById("search-cedula").value.toLowerCase()
  const estadoFiltro = document.getElementById("filter-status").value
  const membresiaFiltro = document.getElementById("filter-membresia").value
  const hoy = new Date()

  const clientesFiltrados = clientesOriginales.filter((cliente) => {
    const nombreCompleto = `${cliente.nombre} ${cliente.apellido}`.toLowerCase()
    const coincideNombre = nombreCompleto.includes(nombreFiltro)
    const coincideCedula = cliente.cedula.toLowerCase().includes(cedulaFiltro)
    const fechaVencimiento = new Date(cliente.fecha_vencimiento)
    const estaVigente = fechaVencimiento >= hoy
    const coincideEstado =
      estadoFiltro === "todos" ||
      (estadoFiltro === "vigentes" && estaVigente) ||
      (estadoFiltro === "vencidos" && !estaVigente)
    const coincideMembresia =
      membresiaFiltro === "todos" ||
      (cliente.membresia_nombre && cliente.membresia_nombre.toLowerCase() === membresiaFiltro.toLowerCase())

    return coincideNombre && coincideCedula && coincideEstado && coincideMembresia
  })

  renderizarClientes(clientesFiltrados)
}

// Función para renderizar los clientes filtrados
function renderizarClientes(clientes) {
  const container = document.getElementById("client-container")
  container.innerHTML = ""

  if (clientes.length === 0) {
    container.innerHTML = "<p>No se encontraron clientes con esos filtros.</p>"
    return
  }

  const header = document.createElement("div")
  header.classList.add("table-header")
  header.innerHTML = `
    <div>Nombre</div>
    <div>Apellido</div>
    <div>Cédula</div>
    <div>Teléfono</div>
    <div>Membresía</div>
    <div>Fecha Registro</div>
    <div>Fecha Vencimiento</div>
    <div>Estado</div>
    <div>Acciones</div>
  `
  container.appendChild(header)

  const hoy = new Date()
  clientes.forEach((cliente) => {
    const row = document.createElement("div")
    row.classList.add("table-row")
    const fechaVencimiento = new Date(cliente.fecha_vencimiento)
    const estadoClase = fechaVencimiento >= hoy ? "vigente" : "vencido"

    // Calcular días restantes para mostrar indicador de proximidad
    const diasRestantes = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24))
    let indicadorProximidad = ""

    if (diasRestantes <= 3 && diasRestantes > 0) {
      indicadorProximidad = " 🔴" // Muy próximo a vencer
    } else if (diasRestantes <= 7 && diasRestantes > 3) {
      indicadorProximidad = " 🟡" // Próximo a vencer
    }

    row.innerHTML = `
      <div>${cliente.nombre}</div>
      <div>${cliente.apellido}</div>
      <div>${cliente.cedula}</div>
      <div>${cliente.telefono}</div>
      <div>${cliente.membresia_nombre || "N/A"}</div>
      <div>${cliente.fecha_registro}</div>
      <div>${cliente.fecha_vencimiento}${indicadorProximidad}</div>
      <div class="estado-clase">${estadoClase === "vigente" ? "Activo" : "Vencido"}</div>
      <div class="form-btn">
        <button class="actualizar-membresia" data-id="${cliente.id}">Actualizar Membresía</button>
        <button class="ver-detalles" data-id="${cliente.id}">Ver más</button>
      </div>
    `
    container.appendChild(row)
  })
}

// Evento: Ver detalles del cliente
document.addEventListener("click", (event) => {
  if (event.target.classList.contains("ver-detalles")) {
    const id = event.target.dataset.id
    clienteIdSeleccionado = id

    const query = `
      SELECT c.*, m.nombre as membresia_nombre, m.descripcion
      FROM clientes c
      LEFT JOIN membresias m ON c.membresia_id = m.id
      WHERE c.id = ?
    `

    db.get(query, [id], (err, cliente) => {
      if (err) {
        console.error("Error al obtener detalles:", err.message)
        return
      }
      if (cliente) {
        document.getElementById("detalle-nombre").value = cliente.nombre
        document.getElementById("detalle-apellido").value = cliente.apellido || ""
        document.getElementById("detalle-cedula").value = cliente.cedula
        document.getElementById("detalle-telefono").value = cliente.telefono
        document.getElementById("detalle-direccion").value = cliente.direccion
        document.getElementById("detalle-mail").value = cliente.mail
        document.getElementById("detalle-membresia").value = cliente.membresia_nombre || "N/A"
        document.getElementById("detalle-registro").value = cliente.fecha_registro
        document.getElementById("detalle-vencimiento").textContent = cliente.fecha_vencimiento

        if (document.getElementById("referencia")) {
          document.getElementById("referencia").value = cliente.referencia || ""
        }
        document.getElementById("popup-detalles").classList.remove("oculto")
      }
    })
  }
})

// Cerrar popup
document.getElementById("cerrar-popup").addEventListener("click", () => {
  const historialContenedor = document.getElementById("historial-pagos")
  historialContenedor.classList.add("hidden")
  historialContenedor.innerHTML = ""
  document.getElementById("btn-historial-pagos").textContent = "Ver Historial de Pagos"
  historialPagosVisible = false

  if (modoEdicion) {
    modoEdicion = false
    document.getElementById("boton-editar-guardar").textContent = "Editar"
    document.getElementById("eliminar-cliente").textContent = "Eliminar"
    if (valoresOriginales) {
      document.getElementById("detalle-nombre").value = valoresOriginales.nombre || ""
      document.getElementById("detalle-apellido").value = valoresOriginales.apellido || ""
      document.getElementById("detalle-cedula").value = valoresOriginales.cedula || ""
      document.getElementById("detalle-telefono").value = valoresOriginales.telefono || ""
      document.getElementById("detalle-direccion").value = valoresOriginales.direccion || ""
      document.getElementById("detalle-mail").value = valoresOriginales.mail || ""
    }
    document.getElementById("detalle-nombre").readOnly = true
    document.getElementById("detalle-apellido").readOnly = true
    document.getElementById("detalle-cedula").readOnly = true
    document.getElementById("detalle-telefono").readOnly = true
    document.getElementById("detalle-direccion").readOnly = true
    document.getElementById("detalle-mail").readOnly = true
  }

  clienteIdSeleccionado = null
  valoresOriginales = {}
  document.getElementById("popup-detalles").classList.add("oculto")
})

let historialPagosVisible = false

document.getElementById("btn-historial-pagos").addEventListener("click", () => {
  const contenedor = document.getElementById("historial-pagos")
  const boton = document.getElementById("btn-historial-pagos")

  if (!historialPagosVisible) {
    // Primero verificar si existe la columna membresia_id en pagos
    db.all("PRAGMA table_info(pagos)", [], (err, columns) => {
      if (err) {
        console.error("Error verificando estructura de pagos:", err.message)
        return
      }

      const tieneMembresiaId = columns.some((col) => col.name === "membresia_id")

      let query
      if (tieneMembresiaId) {
        // Si existe membresia_id, usar JOIN
        query = `
          SELECT p.*, m.nombre as membresia_nombre, m.descripcion
          FROM pagos p
          LEFT JOIN membresias m ON p.membresia_id = m.id
          WHERE p.cliente_id = ?
          ORDER BY p.fecha_pago DESC
        `
      } else {
        // Si no existe, usar el campo membresia directamente
        query = `
          SELECT p.*, p.membresia as membresia_nombre
          FROM pagos p
          WHERE p.cliente_id = ?
          ORDER BY p.fecha_pago DESC
        `
      }

      db.all(query, [clienteIdSeleccionado], (err, pagos) => {
        if (err) {
          console.error("Error al cargar historial de pagos:", err.message)
          return
        }

        contenedor.classList.remove("hidden")
        contenedor.innerHTML = "<h3>Historial de Pagos</h3>"

        if (pagos.length === 0) {
          contenedor.innerHTML += "<p>Este cliente no tiene pagos registrados.</p>"
        } else {
          const pagosPorMes = {}
          pagos.forEach((pago) => {
            const fecha = new Date(pago.fecha_pago)
            const mesAnio = fecha.toLocaleString("default", { month: "long", year: "numeric" })

            if (!pagosPorMes[mesAnio]) {
              pagosPorMes[mesAnio] = []
            }
            pagosPorMes[mesAnio].push(pago)
          })

          // Mostrar los pagos agrupados por mes
          for (const mes in pagosPorMes) {
            contenedor.innerHTML += `<h4 class="mes-header">🗓️ ${mes.charAt(0).toUpperCase() + mes.slice(1)}</h4>`

            pagosPorMes[mes].forEach((pago) => {
              contenedor.innerHTML += `
                <div class="pago-item">
                  <p><strong>📅 Fecha de pago:</strong> ${pago.fecha_pago}</p>
                  <p><strong>📝 Membresía:</strong> ${pago.membresia_nombre || pago.membresia || "N/A"}</p>
                  <p><strong>💳 Método de pago:</strong> ${pago.metodo_pago}</p>
                  <p><strong>💵 Monto en dólares:</strong> ${pago.monto_dolares.toFixed(2)} $</p>
                  <p><strong>💱 Tasa del día:</strong> ${pago.tasa_dia.toFixed(2)}</p>
                  <p><strong>💰 Monto en bolívares:</strong> ${pago.monto_bs.toFixed(2)} Bs</p>
                  ${pago.referencia ? `<p><strong>🔢 Referencia:</strong> ${pago.referencia}</p>` : ""}
                  <button class="generar-factura-btn" data-pago-id="${pago.id}" data-cliente-id="${clienteIdSeleccionado}">
                    🧾 Generar Factura
                  </button>
                  <hr>
                </div>
              `
            })
          }
        }
        boton.textContent = "Ocultar"
        historialPagosVisible = true
      })
    })
  } else {
    contenedor.classList.add("hidden")
    contenedor.innerHTML = ""
    boton.textContent = "Ver Historial de Pagos"
    historialPagosVisible = false
  }
})

// Evento: Guardar cambios del cliente
document.getElementById("boton-editar-guardar").addEventListener("click", function () {
  const botonEliminar = document.getElementById("eliminar-cliente")

  if (!modoEdicion) {
    // Entrar en modo edición
    modoEdicion = true
    this.textContent = "Guardar"
    botonEliminar.textContent = "Cancelar"

    // Guardar valores originales
    valoresOriginales = {
      nombre: document.getElementById("detalle-nombre").value,
      apellido: document.getElementById("detalle-apellido").value,
      cedula: document.getElementById("detalle-cedula").value,
      telefono: document.getElementById("detalle-telefono").value,
      direccion: document.getElementById("detalle-direccion").value,
      mail: document.getElementById("detalle-mail").value,
    }

    // Activar edición
    document.getElementById("detalle-nombre").readOnly = false
    document.getElementById("detalle-apellido").readOnly = false
    document.getElementById("detalle-cedula").readOnly = false
    document.getElementById("detalle-telefono").readOnly = false
    document.getElementById("detalle-direccion").readOnly = false
    document.getElementById("detalle-mail").readOnly = false
  } else {
    // Guardar los cambios
    const nombre = document.getElementById("detalle-nombre").value.trim()
    const apellido = document.getElementById("detalle-apellido").value.trim()
    const cedula = document.getElementById("detalle-cedula").value.trim()
    const telefono = document.getElementById("detalle-telefono").value.trim()
    const direccion = document.getElementById("detalle-direccion").value.trim()
    const mail = document.getElementById("detalle-mail").value.trim()

    db.run(
      `UPDATE clientes SET nombre = ?, apellido = ?, cedula = ?, telefono = ?, direccion = ?, mail = ? WHERE id = ?`,
      [nombre, apellido, cedula, telefono, direccion, mail, clienteIdSeleccionado],
      (err) => {
        if (err) {
          console.error(err.message)
          alert("Error al actualizar cliente.")
        } else {
          alert("Cliente actualizado exitosamente.")
          // Salir del modo edición
          modoEdicion = false
          this.textContent = "Editar"
          botonEliminar.textContent = "Eliminar"
          document.getElementById("detalle-nombre").readOnly = true
          document.getElementById("detalle-apellido").readOnly = true
          document.getElementById("detalle-cedula").readOnly = true
          document.getElementById("detalle-telefono").readOnly = true
          document.getElementById("detalle-direccion").readOnly = true
          document.getElementById("detalle-mail").readOnly = true
          document.getElementById("popup-detalles").classList.add("oculto")
          cargarClientesDesdeDB()
        }
      },
    )
  }
})

// Evento: Eliminar cliente
document.getElementById("eliminar-cliente").addEventListener("click", function () {
  const botonEditar = document.getElementById("boton-editar-guardar")

  if (modoEdicion) {
    // Cancelar edición
    modoEdicion = false
    botonEditar.textContent = "Editar"
    this.textContent = "Eliminar"

    // Restaurar valores originales
    document.getElementById("detalle-nombre").value = valoresOriginales.nombre
    document.getElementById("detalle-apellido").value = valoresOriginales.apellido
    document.getElementById("detalle-cedula").value = valoresOriginales.cedula
    document.getElementById("detalle-telefono").value = valoresOriginales.telefono
    document.getElementById("detalle-direccion").value = valoresOriginales.direccion
    document.getElementById("detalle-mail").value = valoresOriginales.mail

    // Desactivar edición
    document.getElementById("detalle-nombre").readOnly = true
    document.getElementById("detalle-apellido").readOnly = true
    document.getElementById("detalle-cedula").readOnly = true
    document.getElementById("detalle-telefono").readOnly = true
    document.getElementById("detalle-direccion").readOnly = true
    document.getElementById("detalle-mail").readOnly = true
  } else {
    // Confirmar eliminación
    const confirmar = confirm("¿Estás seguro de que deseas eliminar este cliente?")
    if (confirmar) {
      db.run(`DELETE FROM clientes WHERE id = ?`, [clienteIdSeleccionado], (err) => {
        if (err) {
          console.error(err.message)
          alert("Error al eliminar cliente.")
        } else {
          alert("Cliente eliminado correctamente.")
          document.getElementById("popup-detalles").classList.add("oculto")
          cargarClientesDesdeDB()
        }
      })
    }
  }
})

document.getElementById("monto_dolares").addEventListener("input", calcularMontoBs)
document.getElementById("tasa_dia").addEventListener("input", calcularMontoBs)

function calcularMontoBs() {
  const usd = Number.parseFloat(document.getElementById("monto_dolares").value) || 0
  const tasa = Number.parseFloat(document.getElementById("tasa_dia").value) || 0
  const montoBs = usd * tasa
  document.getElementById("monto_bs").value = montoBs.toFixed(2)
}

// Evento: Abrir popup de actualizar membresía
document.addEventListener("click", (event) => {
  if (event.target.classList.contains("actualizar-membresia")) {
    clienteIdSeleccionado = event.target.dataset.id

    // Obtener el nombre del cliente
    const cliente = clientesOriginales.find((c) => c.id == clienteIdSeleccionado)
    if (cliente) {
      const titulo = document.getElementById("titulo-actualizar-membresia")
      titulo.innerHTML = `Actualizar membresía de<br><strong>${cliente.nombre} ${cliente.apellido}</strong>`
    }

    document.getElementById("popup-actualizar").classList.remove("oculto")
  }
})

// Cerrar popup de actualizar membresía
document.getElementById("cerrar-popup-actualizar").addEventListener("click", () => {
  document.getElementById("popup-actualizar").classList.add("oculto")
})

// Evento: Enviar formulario para actualizar membresía
document.getElementById("form-actualizar-membresia").addEventListener("submit", (e) => {
  e.preventDefault()

  const nuevaMembresia = document.getElementById("nueva_membresia").value
  const montoDolares = Number.parseFloat(document.getElementById("monto_dolares").value) || 0
  const tasaDia = Number.parseFloat(document.getElementById("tasa_dia").value) || 0
  const montoBs = Number.parseFloat(document.getElementById("monto_bs").value) || 0
  const metodoPago = document.getElementById("metodo_pago").value
  const referencia = document.getElementById("referencia").value

  if ((metodoPago === "transferencia" || metodoPago === "pago_movil") && referencia === "") {
    alert("Debe ingresar el número de referencia para el método de pago seleccionado.")
    return
  }

  // Obtener ID de la nueva membresía
  db.get("SELECT id, duracion_dias FROM membresias WHERE nombre = ?", [nuevaMembresia], (err, membresiaData) => {
    if (err || !membresiaData) {
      alert("Error al obtener datos de la membresía.")
      return
    }

    const fechaHoy = new Date()
    const nuevaFechaVencimiento = new Date(fechaHoy)
    nuevaFechaVencimiento.setDate(nuevaFechaVencimiento.getDate() + membresiaData.duracion_dias)

    const fechaRegistro = fechaHoy.toISOString().split("T")[0]
    const fechaVencimiento = nuevaFechaVencimiento.toISOString().split("T")[0]

    db.serialize(() => {
      // Actualizar el cliente
      db.run(
        `
        UPDATE clientes
        SET membresia_id = ?, fecha_registro = ?, fecha_vencimiento = ?, monto_dolares = ?, tasa_dia = ?, monto_bs = ?, metodo_pago = ?, referencia = ?
        WHERE id = ?
      `,
        [
          membresiaData.id,
          fechaRegistro,
          fechaVencimiento,
          montoDolares,
          tasaDia,
          montoBs,
          metodoPago,
          referencia,
          clienteIdSeleccionado,
        ],
        (err) => {
          if (err) {
            console.error(err.message)
            alert("❌ Error al actualizar la membresía y datos de pago.")
            return
          }

          // Registrar el pago en la tabla pagos
          db.run(
            `
            INSERT INTO pagos (cliente_id, fecha_pago, monto_dolares, tasa_dia, monto_bs, metodo_pago, membresia_id, referencia)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
            [
              clienteIdSeleccionado,
              fechaRegistro,
              montoDolares,
              tasaDia,
              montoBs,
              metodoPago,
              membresiaData.id,
              referencia,
            ],
            (err) => {
              if (err) {
                console.error(err.message)
                alert("❌ Error al registrar el pago.")
              } else {
                alert("✅ Membresía y pago actualizados exitosamente.")
                document.getElementById("popup-actualizar").classList.add("oculto")
                cargarClientesDesdeDB()
              }
            },
          )
        },
      )
    })
  })
})

// Eventos de filtros
document.getElementById("search-name").addEventListener("input", filtrarYMostrarClientes)
document.getElementById("search-cedula").addEventListener("input", filtrarYMostrarClientes)
document.getElementById("filter-status").addEventListener("change", filtrarYMostrarClientes)
document.getElementById("filter-membresia").addEventListener("change", filtrarYMostrarClientes)

document.getElementById("detalle-cedula").addEventListener("input", (e) => {
  e.target.value = e.target.value.replace(/\D/g, "")
})

document.getElementById("detalle-telefono").addEventListener("input", (e) => {
  e.target.value = e.target.value.replace(/\D/g, "")
})

document.getElementById("referencia").addEventListener("input", (e) => {
  e.target.value = e.target.value.replace(/\D/g, "")
})

document.getElementById("metodo_pago").addEventListener("change", function () {
  const metodo = this.value
  const referenciaInput = document.getElementById("referencia")

  if (metodo === "transferencia" || metodo === "pago_movil") {
    referenciaInput.disabled = false
    referenciaInput.required = true
    referenciaInput.placeholder = "Ingrese referencia"
    referenciaInput.value = ""
  } else {
    referenciaInput.disabled = true
    referenciaInput.required = false
    referenciaInput.placeholder = "No aplica"
    referenciaInput.value = ""
    referenciaInput.style.border = ""
  }
})

document.getElementById("nueva_membresia").addEventListener("change", function () {
  const tipo = this.value
  const montoInput = document.getElementById("monto_dolares")

  // Obtener precio desde la base de datos
  db.get("SELECT precio_usd FROM membresias WHERE nombre = ?", [tipo], (err, membresia) => {
    if (err) {
      console.error("Error obteniendo precio de membresía:", err.message)
      return
    }

    if (membresia) {
      montoInput.value = membresia.precio_usd.toFixed(2)
      calcularMontoBs()
    }
  })
})

// Función para generar factura
function generarFactura(pagoId, clienteId) {
  // Obtener datos del pago y cliente
  const queryPago = `
    SELECT p.*, m.nombre as membresia_nombre, m.descripcion
    FROM pagos p
    LEFT JOIN membresias m ON p.membresia_id = m.id
    WHERE p.id = ?
  `

  const queryCliente = `
    SELECT c.*, m.nombre as membresia_actual
    FROM clientes c
    LEFT JOIN membresias m ON c.membresia_id = m.id
    WHERE c.id = ?
  `

  db.get(queryPago, [pagoId], (err, pago) => {
    if (err) {
      // Fallback si no existe membresia_id
      db.get("SELECT * FROM pagos WHERE id = ?", [pagoId], (err2, pagoFallback) => {
        if (err2) {
          alert("Error al obtener datos del pago")
          return
        }
        procesarFactura(pagoFallback, clienteId)
      })
      return
    }

    if (!pago) {
      alert("Pago no encontrado")
      return
    }

    procesarFactura(pago, clienteId)
  })
}

function procesarFactura(pago, clienteId) {
  db.get("SELECT * FROM clientes WHERE id = ?", [clienteId], (err, cliente) => {
    if (err || !cliente) {
      alert("Error al obtener datos del cliente")
      return
    }

    mostrarFactura(pago, cliente)
  })
}

function mostrarFactura(pago, cliente) {
  const fechaPago = new Date(pago.fecha_pago).toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const numeroFactura = `FACT-${pago.id.toString().padStart(6, "0")}`

  const facturaHTML = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Factura ${numeroFactura}</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
                background-color: #fff;
                color: #333;
            }
            .header {
                text-align: center;
                border-bottom: 3px solid #880808;
                padding-bottom: 20px;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 2.5rem;
                font-weight: bold;
                color: #880808;
                margin-bottom: 10px;
            }
            .subtitle {
                color: #666;
                font-size: 1.1rem;
            }
            .factura-info {
                display: flex;
                justify-content: space-between;
                margin-bottom: 30px;
                flex-wrap: wrap;
            }
            .info-section {
                flex: 1;
                min-width: 250px;
                margin-bottom: 20px;
            }
            .info-section h3 {
                color: #880808;
                border-bottom: 1px solid #ddd;
                padding-bottom: 5px;
                margin-bottom: 15px;
            }
            .info-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
                padding: 5px 0;
            }
            .info-label {
                font-weight: bold;
                color: #555;
            }
            .info-value {
                color: #333;
            }
            .detalle-pago {
                background-color: #f8f9fa;
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
            }
            .total-section {
                background-color: #880808;
                color: white;
                padding: 15px;
                border-radius: 8px;
                text-align: center;
                margin: 20px 0;
            }
            .total-amount {
                font-size: 1.5rem;
                font-weight: bold;
            }
            .footer {
                text-align: center;
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #ddd;
                color: #666;
                font-size: 0.9rem;
            }
            .print-btn {
                background-color: #880808;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 1rem;
                margin: 10px;
            }
            .print-btn:hover {
                background-color: #aa1010;
            }
            @media print {
                .print-btn {
                    display: none;
                }
                body {
                    margin: 0;
                    padding: 15px;
                }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="logo">🏋️ SIMETRIC GYM</div>
            <div class="subtitle">Tu gimnasio de confianza</div>
        </div>

        <div class="factura-info">
            <div class="info-section">
                <h3>📋 Información de la Factura</h3>
                <div class="info-row">
                    <span class="info-label">Número de Factura:</span>
                    <span class="info-value">${numeroFactura}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Fecha de Emisión:</span>
                    <span class="info-value">${fechaPago}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Fecha de Pago:</span>
                    <span class="info-value">${pago.fecha_pago}</span>
                </div>
            </div>

            <div class="info-section">
                <h3>👤 Datos del Cliente</h3>
                <div class="info-row">
                    <span class="info-label">Nombre:</span>
                    <span class="info-value">${cliente.nombre} ${cliente.apellido || ""}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Cédula:</span>
                    <span class="info-value">${cliente.cedula}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Teléfono:</span>
                    <span class="info-value">${cliente.telefono}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Email:</span>
                    <span class="info-value">${cliente.mail}</span>
                </div>
            </div>
        </div>

        <div class="detalle-pago">
            <h3 style="color: #880808; margin-top: 0;">💳 Detalle del Pago</h3>
            <div class="info-row">
                <span class="info-label">Concepto:</span>
                <span class="info-value">Pago de Membresía - ${pago.membresia_nombre || pago.membresia || "N/A"}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Método de Pago:</span>
                <span class="info-value">${pago.metodo_pago.charAt(0).toUpperCase() + pago.metodo_pago.slice(1)}</span>
            </div>
            ${
              pago.referencia
                ? `
            <div class="info-row">
                <span class="info-label">Referencia:</span>
                <span class="info-value">${pago.referencia}</span>
            </div>
            `
                : ""
            }
            <div class="info-row">
                <span class="info-label">Monto en USD:</span>
                <span class="info-value">$${pago.monto_dolares.toFixed(2)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Tasa del Día:</span>
                <span class="info-value">${pago.tasa_dia.toFixed(2)} Bs/$</span>
            </div>
        </div>

        <div class="total-section">
            <div>Total Pagado</div>
            <div class="total-amount">${pago.monto_bs.toFixed(2)} Bs</div>
            <div style="font-size: 1rem; margin-top: 5px;">
                (Equivalente a $${pago.monto_dolares.toFixed(2)} USD)
            </div>
        </div>

        <div class="footer">
            <p><strong>SIMETRIC GYM</strong></p>
            <p>Gracias por confiar en nosotros para tu entrenamiento</p>
            <p style="font-size: 0.8rem; margin-top: 15px;">
                Esta factura es un comprobante de pago válido.<br>
                Para cualquier consulta, contáctanos en el gimnasio.
            </p>
        </div>

        <div style="text-align: center; margin-top: 30px;">
            <button class="print-btn" onclick="window.print()">🖨️ Imprimir Factura</button>
            <button class="print-btn" onclick="window.close()">❌ Cerrar</button>
        </div>
    </body>
    </html>
  `

  // Abrir en nueva ventana
  const ventanaFactura = window.open("", "_blank", "width=800,height=900,scrollbars=yes")
  ventanaFactura.document.write(facturaHTML)
  ventanaFactura.document.close()
}

// Event listener para botones de generar factura
document.addEventListener("click", (event) => {
  if (event.target.classList.contains("generar-factura-btn")) {
    const pagoId = event.target.dataset.pagoId
    const clienteId = event.target.dataset.clienteId
    generarFactura(pagoId, clienteId)
  }
})

const sqlite3 = require("sqlite3").verbose()

// Conectar a la base de datos unificada
const db = new sqlite3.Database("simetricdb.sqlite", (err) => {
  if (err) {
    console.error("Error conectando a la base de datos:", err.message)
  } else {
    console.log("✅ Conectado a la base de datos unificada para ventas.")
    crearTablaVentas()
    cargarProductosVenta()
  }
})

// Crear tabla de ventas si no existe
function crearTablaVentas() {
  // Primero verificar si la tabla existe y tiene las columnas nuevas
  db.get("PRAGMA table_info(ventas)", (err, result) => {
    if (err) {
      console.error("Error verificando estructura de tabla:", err.message)
      return
    }

    // Si la tabla no existe o necesita actualización, crearla/actualizarla
    db.serialize(() => {
      // Crear tabla temporal con la nueva estructura
      db.run(
        `
        CREATE TABLE IF NOT EXISTS ventas_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fecha_venta TEXT NOT NULL,
          cliente_nombre TEXT NOT NULL,
          cliente_cedula TEXT NOT NULL,
          total_usd REAL NOT NULL,
          total_bs REAL NOT NULL,
          tasa_cambio REAL NOT NULL,
          metodo_pago TEXT NOT NULL,
          referencia_pago TEXT,
          usuario TEXT,
          observaciones TEXT
        )
      `,
        (err) => {
          if (err) {
            console.error("Error creando tabla ventas_new:", err.message)
            return
          }

          // Verificar si la tabla original existe
          db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='ventas'", (err, row) => {
            if (err) {
              console.error("Error verificando tabla original:", err.message)
              return
            }

            if (row) {
              // La tabla existe, migrar datos
              console.log("🔄 Migrando datos de ventas...")
              db.run(
                `
              INSERT INTO ventas_new (id, fecha_venta, cliente_nombre, cliente_cedula, total_usd, total_bs, tasa_cambio, metodo_pago, referencia_pago, usuario, observaciones)
              SELECT 
                id, 
                fecha_venta, 
                COALESCE(cliente_nombre, 'Cliente General') as cliente_nombre,
                COALESCE(cliente_cedula, 'N/A') as cliente_cedula,
                total_usd, 
                total_bs, 
                tasa_cambio,
                COALESCE(metodo_pago, 'efectivo') as metodo_pago,
                referencia_pago,
                usuario, 
                observaciones
              FROM ventas
            `,
                (err) => {
                  if (err) {
                    console.error("Error migrando datos:", err.message)
                    // Si falla la migración, crear tabla vacía
                    db.run("DROP TABLE IF EXISTS ventas_new")
                    db.run(`
                  CREATE TABLE ventas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    fecha_venta TEXT NOT NULL,
                    cliente_nombre TEXT NOT NULL,
                    cliente_cedula TEXT NOT NULL,
                    total_usd REAL NOT NULL,
                    total_bs REAL NOT NULL,
                    tasa_cambio REAL NOT NULL,
                    metodo_pago TEXT NOT NULL,
                    referencia_pago TEXT,
                    usuario TEXT,
                    observaciones TEXT
                  )
                `)
                    console.log("✅ Tabla ventas creada (nueva estructura)")
                    return
                  }

                  // Eliminar tabla original y renombrar la nueva
                  db.run("DROP TABLE ventas", (err) => {
                    if (err) {
                      console.error("Error eliminando tabla original:", err.message)
                      return
                    }

                    db.run("ALTER TABLE ventas_new RENAME TO ventas", (err) => {
                      if (err) {
                        console.error("Error renombrando tabla:", err.message)
                        return
                      }
                      console.log("✅ Tabla ventas actualizada con nueva estructura")
                    })
                  })
                },
              )
            } else {
              // La tabla no existe, renombrar la nueva
              db.run("ALTER TABLE ventas_new RENAME TO ventas", (err) => {
                if (err) {
                  console.error("Error renombrando tabla nueva:", err.message)
                  return
                }
                console.log("✅ Tabla ventas creada con nueva estructura")
              })
            }
          })
        },
      )
    })
  })

  // Tabla detalle de ventas (sin cambios)
  db.run(
    `
    CREATE TABLE IF NOT EXISTS detalle_ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER NOT NULL,
      producto_id INTEGER NOT NULL,
      lote_id INTEGER NOT NULL,
      cantidad INTEGER NOT NULL,
      precio_unitario REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (venta_id) REFERENCES ventas(id),
      FOREIGN KEY (producto_id) REFERENCES productos(id),
      FOREIGN KEY (lote_id) REFERENCES lotes(id)
    )
  `,
    (err) => {
      if (err) {
        console.error("Error creando tabla detalle_ventas:", err.message)
      } else {
        console.log("✅ Tabla detalle_ventas verificada")
      }
    },
  )
}

let productos = []
let carrito = []
let productoSeleccionado = null

// Cargar productos con stock calculado desde lotes
function cargarProductosVenta() {
  const query = `
    SELECT 
      p.*,
      COALESCE(SUM(l.cantidad_disponible), 0) as stock_total,
      COUNT(CASE WHEN l.cantidad_disponible > 0 THEN 1 END) as total_lotes,
      MIN(l.fecha_compra) as primer_lote,
      MAX(l.fecha_compra) as ultimo_lote,
    -- Calcular precio promedio ponderado actual
    CASE 
      WHEN SUM(l.cantidad_disponible) > 0 
      THEN (SUM(l.cantidad_disponible * l.precio_compra_unitario) / SUM(l.cantidad_disponible)) * 1.30
      ELSE p.precio_venta 
    END as precio_venta_actual
  FROM productos p
  LEFT JOIN lotes l ON p.id = l.producto_id AND l.activo = 1
  GROUP BY p.id
  ORDER BY p.nombre
  `

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Error cargando productos:", err.message)
      return
    }
    productos = rows
    filtrarYMostrarProductos()
  })
}

// Filtrar y mostrar productos
function filtrarYMostrarProductos() {
  const codigoFiltro = document.getElementById("search-code").value.toLowerCase()
  const nombreFiltro = document.getElementById("search-name").value.toLowerCase()
  const stockFiltro = document.getElementById("filter-stock").value

  const productosFiltrados = productos.filter((p) => {
    const coincideCodigo = p.codigo.toLowerCase().includes(codigoFiltro)
    const coincideNombre = p.nombre.toLowerCase().includes(nombreFiltro)

    let coincideStock = true
    if (stockFiltro === "disponibles") {
      coincideStock = p.stock_total > 0
    } else if (stockFiltro === "agotados") {
      coincideStock = p.stock_total === 0
    }

    return coincideCodigo && coincideNombre && coincideStock
  })

  renderizarProductosVenta(productosFiltrados)
}

// Renderizar productos en la lista
function renderizarProductosVenta(productos) {
  const container = document.getElementById("lista-productos")
  container.innerHTML = ""

  if (productos.length === 0) {
    container.innerHTML = '<p style="text-align: center; padding: 2rem; color: #888;">No se encontraron productos.</p>'
    return
  }

  const header = document.createElement("div")
  header.classList.add("table-header")
  header.innerHTML = `
    <div>Código</div>
    <div>Nombre</div>
    <div>Stock</div>
    <div>Precio</div>
    <div>Lotes</div>
    <div>Acción</div>
  `
  container.appendChild(header)

  productos.forEach((p) => {
    // Calcular stock disponible considerando el carrito
    const enCarrito = carrito.filter((item) => item.id === p.id).reduce((total, item) => total + item.cantidad, 0)
    const stockDisponible = p.stock_total - enCarrito

    const row = document.createElement("div")
    row.classList.add("table-row")

    // Clases para indicadores de stock
    let stockClass = ""
    let stockIndicator = ""
    if (stockDisponible <= 0) {
      stockClass = "stock-agotado"
      stockIndicator = " ❌"
    } else if (stockDisponible <= 5) {
      stockClass = "stock-bajo"
      stockIndicator = " ⚠️"
    }

    row.innerHTML = `
      <div>${p.codigo}</div>
      <div>${p.nombre}</div>
      <div class="stock-info">
        <span class="stock-total ${stockClass}">${stockDisponible}${stockIndicator}</span>
        <span class="stock-lotes">(${p.total_lotes} lote${p.total_lotes !== 1 ? "s" : ""})</span>
      </div>
      <div>$${(p.precio_venta_actual || p.precio_venta).toFixed(2)}</div>
      <div>${p.total_lotes}</div>
      <div class="acciones">
        <button class="btn-agregar-carrito" data-id="${p.id}" ${stockDisponible <= 0 ? "disabled" : ""}>
          ${stockDisponible <= 0 ? "❌ Sin Stock" : "🛒 Agregar"}
        </button>
      </div>
    `
    container.appendChild(row)
  })
}

// Renderizar carrito
function renderizarCarrito() {
  const contenedor = document.getElementById("venta-carrito-container")

  if (carrito.length === 0) {
    contenedor.innerHTML = '<p class="cart-empty">El carrito está vacío</p>'
    actualizarTotales()
    return
  }

  contenedor.innerHTML = ""

  carrito.forEach((item, index) => {
    const subtotal = item.precio_venta * item.cantidad
    const div = document.createElement("div")
    div.classList.add("cart-item")

    div.innerHTML = `
      <div class="cart-item-info">
        <div class="cart-item-name">${item.nombre}</div>
        <div class="cart-item-details">
          ${item.cantidad} × $${item.precio_venta.toFixed(2)} = $${subtotal.toFixed(2)}
        </div>
      </div>
      <div class="cart-item-actions">
        <button onclick="modificarCantidadCarrito(${index}, -1)">➖</button>
        <button onclick="modificarCantidadCarrito(${index}, 1)">➕</button>
        <button onclick="eliminarDelCarrito(${index})">🗑️</button>
      </div>
    `
    contenedor.appendChild(div)
  })

  actualizarTotales()
}

// Actualizar totales del carrito
function actualizarTotales() {
  let totalUSD = 0
  carrito.forEach((item) => {
    totalUSD += item.precio_venta * item.cantidad
  })

  const tasa = Number.parseFloat(document.getElementById("tasa-cambio").value) || 0
  const totalBs = totalUSD * tasa

  document.getElementById("total-usd").textContent = `$${totalUSD.toFixed(2)}`
  document.getElementById("total-bs").textContent = `${totalBs.toFixed(2)} Bs`

  // Habilitar/deshabilitar botón de confirmar venta
  const btnConfirmar = document.getElementById("btn-confirmar-venta")
  btnConfirmar.disabled = carrito.length === 0 || tasa <= 0
}

// Modificar cantidad en el carrito
function modificarCantidadCarrito(index, cambio) {
  const item = carrito[index]
  const producto = productos.find((p) => p.id === item.id)
  if (!producto) return

  const nuevaCantidad = item.cantidad + cambio

  if (nuevaCantidad <= 0) {
    eliminarDelCarrito(index)
    return
  }

  // Verificar stock disponible
  const enCarrito = carrito
    .filter((cartItem) => cartItem.id === item.id)
    .reduce((total, cartItem) => total + cartItem.cantidad, 0)
  const stockDisponible = producto.stock_total - (enCarrito - item.cantidad)

  if (nuevaCantidad > stockDisponible) {
    alert(`Stock insuficiente. Disponible: ${stockDisponible} unidades`)
    return
  }

  carrito[index].cantidad = nuevaCantidad
  renderizarCarrito()
  filtrarYMostrarProductos() // Actualizar vista de productos
}

// Eliminar del carrito
function eliminarDelCarrito(index) {
  carrito.splice(index, 1)
  renderizarCarrito()
  filtrarYMostrarProductos() // Actualizar vista de productos
}

// Limpiar carrito
function limpiarCarrito() {
  if (carrito.length === 0) return

  const confirmar = confirm("¿Estás seguro de que deseas limpiar el carrito?")
  if (confirmar) {
    carrito = []
    renderizarCarrito()
    filtrarYMostrarProductos()
  }
}

// Obtener lotes disponibles para un producto (PEPS)
function obtenerLotesDisponibles(productoId, cantidadNecesaria) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT * FROM lotes 
      WHERE producto_id = ? AND cantidad_disponible > 0 AND activo = 1
      ORDER BY fecha_compra ASC, id ASC
    `

    db.all(query, [productoId], (err, lotes) => {
      if (err) {
        reject(err)
        return
      }

      const lotesParaVenta = []
      let cantidadRestante = cantidadNecesaria

      for (const lote of lotes) {
        if (cantidadRestante <= 0) break

        const cantidadDelLote = Math.min(lote.cantidad_disponible, cantidadRestante)
        lotesParaVenta.push({
          ...lote,
          cantidad_a_usar: cantidadDelLote,
        })

        cantidadRestante -= cantidadDelLote
      }

      if (cantidadRestante > 0) {
        reject(new Error(`Stock insuficiente. Faltan ${cantidadRestante} unidades`))
      } else {
        resolve(lotesParaVenta)
      }
    })
  })
}

// Abrir modal de datos de venta
function abrirModalDatosVenta() {
  if (carrito.length === 0) {
    alert("El carrito está vacío.")
    return
  }

  const tasa = Number.parseFloat(document.getElementById("tasa-cambio").value)
  if (!tasa || tasa <= 0) {
    alert("Debe ingresar una tasa de cambio válida.")
    document.getElementById("tasa-cambio").focus()
    return
  }

  // Calcular totales para mostrar en el modal
  let totalUSD = 0
  carrito.forEach((item) => {
    totalUSD += item.precio_venta * item.cantidad
  })
  const totalBs = totalUSD * tasa

  // Actualizar información en el modal
  document.getElementById("modal-total-usd").textContent = totalUSD.toFixed(2)
  document.getElementById("modal-total-bs").textContent = totalBs.toFixed(2)
  document.getElementById("modal-tasa").textContent = tasa.toFixed(2)

  // Limpiar formulario
  document.getElementById("form-datos-venta").reset()

  // Ocultar campo de referencia inicialmente
  document.getElementById("referencia-container").style.display = "none"

  // Mostrar modal
  document.getElementById("modal-datos-venta").classList.remove("hidden")
  document.getElementById("cliente-nombre").focus()
}

// Manejar cambio de método de pago
function manejarCambioMetodoPago() {
  const metodoPago = document.getElementById("metodo-pago").value
  const referenciaContainer = document.getElementById("referencia-container")
  const referenciaInput = document.getElementById("referencia-pago")

  if (metodoPago === "pago_movil" || metodoPago === "transferencia") {
    referenciaContainer.style.display = "block"
    referenciaInput.required = true
  } else {
    referenciaContainer.style.display = "none"
    referenciaInput.required = false
    referenciaInput.value = ""
  }
}

// Confirmar venta con datos completos
async function confirmarVentaCompleta() {
  // Validar datos del formulario
  const clienteNombre = document.getElementById("cliente-nombre").value.trim()
  const clienteCedula = document.getElementById("cliente-cedula").value.trim()
  const metodoPago = document.getElementById("metodo-pago").value
  const referenciaPago = document.getElementById("referencia-pago").value.trim()

  if (!clienteNombre) {
    alert("Por favor ingrese el nombre del cliente")
    document.getElementById("cliente-nombre").focus()
    return
  }

  if (!clienteCedula) {
    alert("Por favor ingrese la cédula del cliente")
    document.getElementById("cliente-cedula").focus()
    return
  }

  // Validar formato de cédula (solo números, entre 7 y 8 dígitos)
  if (!/^\d{7,8}$/.test(clienteCedula)) {
    alert("La cédula debe contener entre 7 y 8 dígitos numéricos")
    document.getElementById("cliente-cedula").focus()
    return
  }

  if (!metodoPago) {
    alert("Por favor seleccione un método de pago")
    document.getElementById("metodo-pago").focus()
    return
  }

  if ((metodoPago === "pago_movil" || metodoPago === "transferencia") && !referenciaPago) {
    alert("Por favor ingrese la referencia del pago")
    document.getElementById("referencia-pago").focus()
    return
  }

  // Validar formato de referencia para pago móvil y transferencia
  if ((metodoPago === "pago_movil" || metodoPago === "transferencia") && referenciaPago) {
    if (!/^\d{6,12}$/.test(referenciaPago)) {
      alert("La referencia debe contener entre 6 y 12 dígitos numéricos")
      document.getElementById("referencia-pago").focus()
      return
    }
  }

  // El resto de la función permanece igual...
  const btnConfirmar = document.getElementById("btn-confirmar-venta-final")
  const textoOriginal = btnConfirmar.innerHTML
  btnConfirmar.disabled = true
  btnConfirmar.innerHTML = '<span class="btn-icon">⏳</span>Procesando...'

  try {
    // Calcular totales
    let totalUSD = 0
    carrito.forEach((item) => {
      totalUSD += item.precio_venta * item.cantidad
    })
    const tasa = Number.parseFloat(document.getElementById("tasa-cambio").value)
    const totalBs = totalUSD * tasa

    // Obtener usuario actual
    const usuarioActual = sessionStorage.getItem("usuarioActual") || "Sistema"
    const fechaVenta = new Date().toISOString().split("T")[0]

    // Verificar stock y obtener lotes para cada producto
    const ventaDetalle = []
    for (const item of carrito) {
      try {
        const lotes = await obtenerLotesDisponibles(item.id, item.cantidad)
        ventaDetalle.push({
          producto: item,
          lotes: lotes,
        })
      } catch (error) {
        throw new Error(`${item.nombre}: ${error.message}`)
      }
    }

    // Procesar venta en transacción
    db.serialize(() => {
      db.run("BEGIN TRANSACTION")

      // 1. Insertar venta principal con datos completos
      db.run(
        `
        INSERT INTO ventas (fecha_venta, cliente_nombre, cliente_cedula, total_usd, total_bs, 
                           tasa_cambio, metodo_pago, referencia_pago, usuario)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [fechaVenta, clienteNombre, clienteCedula, totalUSD, totalBs, tasa, metodoPago, referenciaPago, usuarioActual],
        function (err) {
          if (err) {
            console.error("Error insertando venta:", err.message)
            db.run("ROLLBACK")
            throw err
          }

          const ventaId = this.lastID
          let operacionesCompletadas = 0
          const totalOperaciones = ventaDetalle.reduce((total, item) => total + item.lotes.length, 0)

          // 2. Procesar cada producto y sus lotes
          ventaDetalle.forEach(({ producto, lotes }) => {
            lotes.forEach((lote) => {
              // Insertar detalle de venta
              db.run(
                `
              INSERT INTO detalle_ventas 
              (venta_id, producto_id, lote_id, cantidad, precio_unitario, subtotal)
              VALUES (?, ?, ?, ?, ?, ?)
            `,
                [
                  ventaId,
                  producto.id,
                  lote.id,
                  lote.cantidad_a_usar,
                  producto.precio_venta,
                  producto.precio_venta * lote.cantidad_a_usar,
                ],
                (err) => {
                  if (err) {
                    console.error("Error insertando detalle:", err.message)
                    db.run("ROLLBACK")
                    return
                  }

                  // Actualizar cantidad disponible en el lote
                  db.run(
                    `
                UPDATE lotes
                SET cantidad_disponible = cantidad_disponible - ?
                WHERE id = ?
              `,
                    [lote.cantidad_a_usar, lote.id],
                    (err) => {
                      if (err) {
                        console.error("Error actualizando lote:", err.message)
                        db.run("ROLLBACK")
                        return
                      }

                      // Registrar movimiento de stock
                      db.run(
                        `
                  INSERT INTO movimientos_stock
                  (producto_id, lote_id, tipo_movimiento, cantidad, precio_unitario,
                   motivo, fecha_movimiento, stock_anterior, stock_nuevo, usuario)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                        [
                          producto.id,
                          lote.id,
                          "salida",
                          lote.cantidad_a_usar,
                          producto.precio_venta,
                          `Venta #${ventaId} - Cliente: ${clienteNombre} (${clienteCedula})`,
                          fechaVenta,
                          lote.cantidad_disponible,
                          lote.cantidad_disponible - lote.cantidad_a_usar,
                          usuarioActual,
                        ],
                        (err) => {
                          if (err) {
                            console.error("Error registrando movimiento:", err.message)
                            return
                          }

                          operacionesCompletadas++

                          // Si completamos todas las operaciones
                          if (operacionesCompletadas === totalOperaciones) {
                            db.run("COMMIT", (err) => {
                              if (err) {
                                console.error("Error confirmando venta:", err.message)
                                alert("Error al confirmar la venta.")
                                return
                              }

                              // Éxito - Cerrar modal y mostrar opciones
                              document.getElementById("modal-datos-venta").classList.add("hidden")

                              // Mostrar opciones de factura
                              mostrarOpcionesFactura(ventaId, {
                                clienteNombre,
                                clienteCedula,
                                totalUSD,
                                totalBs,
                                tasa,
                                metodoPago,
                                referenciaPago,
                                fechaVenta,
                                productos: carrito,
                              })

                              // Limpiar carrito y recargar datos
                              carrito = []
                              renderizarCarrito()
                              cargarProductosVenta()
                              document.getElementById("tasa-cambio").value = ""
                            })
                          }
                        },
                      )
                    },
                  )
                },
              )
            })
          })
        },
      )
    })
  } catch (error) {
    console.error("Error en venta:", error)
    alert(`Error: ${error.message}`)
  } finally {
    btnConfirmar.disabled = false
    btnConfirmar.innerHTML = textoOriginal
  }
}

// Mostrar opciones de factura después de la venta
function mostrarOpcionesFactura(ventaId, datosVenta) {
  const mensaje =
    `✅ Venta registrada exitosamente\n\n` +
    `Venta #${ventaId}\n` +
    `Cliente: ${datosVenta.clienteNombre}\n` +
    `Total: $${datosVenta.totalUSD.toFixed(2)} USD (${datosVenta.totalBs.toFixed(2)} Bs)\n` +
    `Método de pago: ${obtenerNombreMetodoPago(datosVenta.metodoPago)}\n` +
    `${datosVenta.referenciaPago ? `Referencia: ${datosVenta.referenciaPago}\n` : ""}\n` +
    `¿Desea generar la factura?`

  const generarFactura = confirm(mensaje)

  if (generarFactura) {
    generarFacturaPDF(ventaId, datosVenta)
  }
}

// Generar factura en PDF
function generarFacturaPDF(ventaId, datosVenta) {
  // Crear contenido HTML para la factura
  const fechaFormateada = new Date(datosVenta.fechaVenta).toLocaleDateString("es-ES")
  const horaActual = new Date().toLocaleTimeString("es-ES")

  let contenidoFactura = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Factura #${ventaId} - SIMETRIC GYM</title>
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
          font-size: 14px;
        }
        .factura-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
        }
        .info-section {
          flex: 1;
        }
        .info-section h3 {
          color: #880808;
          margin-bottom: 10px;
          font-size: 16px;
        }
        .info-item {
          margin-bottom: 5px;
          font-size: 14px;
        }
        .productos-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        .productos-table th,
        .productos-table td {
          border: 1px solid #ddd;
          padding: 10px;
          text-align: left;
        }
        .productos-table th {
          background-color: #880808;
          color: white;
          font-weight: bold;
        }
        .productos-table tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .totales {
          text-align: right;
          margin-bottom: 30px;
        }
        .total-line {
          margin-bottom: 8px;
          font-size: 16px;
        }
        .total-final {
          font-size: 20px;
          font-weight: bold;
          color: #880808;
          border-top: 2px solid #880808;
          padding-top: 10px;
        }
        .footer {
          text-align: center;
          border-top: 1px solid #ddd;
          padding-top: 20px;
          color: #666;
          font-size: 12px;
        }
        .metodo-pago {
          background-color: #f0f0f0;
          padding: 15px;
          border-radius: 5px;
          margin-bottom: 20px;
        }
        .referencia {
          background-color: #e8f5e8;
          padding: 10px;
          border-left: 4px solid #4caf50;
          margin-top: 10px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">🏋️ SIMETRIC GYM C.A.</div>
        <div class="subtitle">Sistema de Gestión Administrativa</div>
      </div>

      <div class="factura-info">
        <div class="info-section">
          <h3>📄 Información de la Factura</h3>
          <div class="info-item"><strong>Factura #:</strong> ${ventaId}</div>
          <div class="info-item"><strong>Fecha:</strong> ${fechaFormateada}</div>
          <div class="info-item"><strong>Hora:</strong> ${horaActual}</div>
          <div class="info-item"><strong>Vendedor:</strong> ${sessionStorage.getItem("usuarioActual") || "Sistema"}</div>
        </div>
        
        <div class="info-section">
          <h3>👤 Datos del Cliente</h3>
          <div class="info-item"><strong>Nombre:</strong> ${datosVenta.clienteNombre}</div>
          ${datosVenta.clienteCedula ? `<div class="info-item"><strong>Cédula:</strong> ${datosVenta.clienteCedula}</div>` : ""}
        </div>
      </div>

      <div class="metodo-pago">
        <h3>💳 Método de Pago</h3>
        <div class="info-item"><strong>Método:</strong> ${obtenerNombreMetodoPago(datosVenta.metodoPago)}</div>
        <div class="info-item"><strong>Tasa del día:</strong> ${datosVenta.tasa.toFixed(2)} Bs/USD</div>
        ${
          datosVenta.referenciaPago
            ? `
          <div class="referencia">
            <strong>📱 Referencia:</strong> ${datosVenta.referenciaPago}
          </div>
        `
            : ""
        }
      </div>

      <table class="productos-table">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Cantidad</th>
            <th>Precio Unit.</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
  `

  // Agregar productos a la tabla
  datosVenta.productos.forEach((producto) => {
    const subtotal = producto.cantidad * producto.precio_venta
    contenidoFactura += `
      <tr>
        <td>${producto.nombre}</td>
        <td>${producto.cantidad}</td>
        <td>$${producto.precio_venta.toFixed(2)}</td>
        <td>$${subtotal.toFixed(2)}</td>
      </tr>
    `
  })

  contenidoFactura += `
        </tbody>
      </table>

      <div class="totales">
        <div class="total-line"><strong>Total USD:</strong> $${datosVenta.totalUSD.toFixed(2)}</div>
        <div class="total-line"><strong>Total Bs:</strong> ${datosVenta.totalBs.toFixed(2)} Bs</div>
        <div class="total-final">TOTAL: $${datosVenta.totalUSD.toFixed(2)} USD</div>
      </div>

      <div class="footer">
        <p>Gracias por su compra en SIMETRIC GYM</p>
        <p>Factura generada el ${new Date().toLocaleDateString("es-ES")} a las ${horaActual}</p>
      </div>
    </body>
    </html>
  `

  // Abrir ventana para imprimir/guardar
  const ventanaFactura = window.open("", "", "width=800,height=600")
  ventanaFactura.document.write(contenidoFactura)
  ventanaFactura.document.close()

  // Dar tiempo para que se cargue el contenido y luego mostrar diálogo de impresión
  setTimeout(() => {
    ventanaFactura.print()
  }, 500)
}

// Obtener nombre legible del método de pago
function obtenerNombreMetodoPago(metodo) {
  const metodos = {
    efectivo: "Efectivo",
    tarjeta: "Tarjeta de Débito/Crédito",
    pago_movil: "Pago Móvil",
    transferencia: "Transferencia Bancaria",
  }
  return metodos[metodo] || metodo
}

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  console.log("🛒 Módulo de ventas cargado")

  // Filtros
  document.getElementById("search-code").addEventListener("input", filtrarYMostrarProductos)
  document.getElementById("search-name").addEventListener("input", filtrarYMostrarProductos)
  document.getElementById("filter-stock").addEventListener("change", filtrarYMostrarProductos)

  // Solo números en código
  document.getElementById("search-code").addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "")
  })

  // Tasa de cambio
  document.getElementById("tasa-cambio").addEventListener("input", actualizarTotales)

  // Botones del carrito
  document.getElementById("btn-confirmar-venta").addEventListener("click", abrirModalDatosVenta)
  document.getElementById("btn-limpiar-carrito").addEventListener("click", limpiarCarrito)

  // Agregar al carrito (delegado)
  document.addEventListener("click", (event) => {
    if (event.target.classList.contains("btn-agregar-carrito") && !event.target.disabled) {
      const id = Number.parseInt(event.target.dataset.id)
      const producto = productos.find((p) => p.id === id)
      if (producto) {
        abrirModalCantidad(producto)
      }
    }
  })

  // Modal de cantidad
  document.getElementById("cerrar-cantidad-modal").addEventListener("click", cerrarModalCantidad)
  document.getElementById("btn-cancelar-cantidad").addEventListener("click", cerrarModalCantidad)
  document.getElementById("btn-confirmar-cantidad").addEventListener("click", confirmarAgregarCarrito)

  // Modal de datos de venta
  document.getElementById("cerrar-datos-venta-modal").addEventListener("click", () => {
    document.getElementById("modal-datos-venta").classList.add("hidden")
  })
  document.getElementById("btn-cancelar-venta").addEventListener("click", () => {
    document.getElementById("modal-datos-venta").classList.add("hidden")
  })
  document.getElementById("btn-confirmar-venta-final").addEventListener("click", confirmarVentaCompleta)
  document.getElementById("metodo-pago").addEventListener("change", manejarCambioMetodoPago)

  // Historial
  document.getElementById("btn-historial").addEventListener("click", toggleHistorial)
  document.getElementById("btn-exportar-pdf").addEventListener("click", exportarHistorialPDF)
})

// Funciones del modal de cantidad
function abrirModalCantidad(producto) {
  productoSeleccionado = producto

  // Calcular stock disponible
  const enCarrito = carrito.filter((item) => item.id === producto.id).reduce((total, item) => total + item.cantidad, 0)
  const stockDisponible = producto.stock_total - enCarrito

  // Llenar información del modal
  document.getElementById("modal-producto-nombre").textContent = producto.nombre
  document.getElementById("modal-stock-disponible").textContent = stockDisponible
  document.getElementById("modal-precio").textContent = (producto.precio_venta_actual || producto.precio_venta).toFixed(
    2,
  )

  // Configurar input de cantidad
  const cantidadInput = document.getElementById("cantidad-input")
  cantidadInput.max = stockDisponible
  cantidadInput.value = 1

  // Mostrar modal
  document.getElementById("cantidad-modal").classList.remove("hidden")
  cantidadInput.focus()
}

function cerrarModalCantidad() {
  document.getElementById("cantidad-modal").classList.add("hidden")
  productoSeleccionado = null
}

function confirmarAgregarCarrito() {
  const cantidad = Number.parseInt(document.getElementById("cantidad-input").value)

  if (!productoSeleccionado || isNaN(cantidad) || cantidad <= 0) {
    alert("Cantidad inválida.")
    return
  }

  // Verificar stock disponible
  const enCarrito = carrito
    .filter((item) => item.id === productoSeleccionado.id)
    .reduce((total, item) => total + item.cantidad, 0)
  const stockDisponible = productoSeleccionado.stock_total - enCarrito

  if (cantidad > stockDisponible) {
    alert(`Stock insuficiente. Disponible: ${stockDisponible} unidades`)
    return
  }

  // Agregar al carrito con precio actualizado
  carrito.push({
    ...productoSeleccionado,
    precio_venta: productoSeleccionado.precio_venta_actual || productoSeleccionado.precio_venta,
    cantidad: cantidad,
  })

  renderizarCarrito()
  filtrarYMostrarProductos()
  cerrarModalCantidad()
}

// Historial de ventas
let historialVisible = false

function toggleHistorial() {
  const contenedor = document.getElementById("historial-ventas")
  const boton = document.getElementById("btn-historial")
  const acciones = document.getElementById("historial-actions")

  if (!historialVisible) {
    cargarHistorialVentas()
    boton.textContent = "📊 Ocultar Historial"
    historialVisible = true
  } else {
    contenedor.classList.add("hidden")
    acciones.classList.add("hidden")
    contenedor.innerHTML = ""
    boton.textContent = "📊 Ver Historial de Ventas"
    historialVisible = false
  }
}

function cargarHistorialVentas() {
  const query = `
    SELECT 
      v.*,
      GROUP_CONCAT(p.nombre || ' x' || dv.cantidad) as productos_vendidos,
      COUNT(dv.id) as total_productos
    FROM ventas v
    LEFT JOIN detalle_ventas dv ON v.id = dv.venta_id
    LEFT JOIN productos p ON dv.producto_id = p.id
    GROUP BY v.id
    ORDER BY v.fecha_venta DESC, v.id DESC
  `

  db.all(query, [], (err, ventas) => {
    if (err) {
      console.error("Error cargando historial:", err.message)
      return
    }

    const contenedor = document.getElementById("historial-ventas")
    const acciones = document.getElementById("historial-actions")

    contenedor.classList.remove("hidden")
    acciones.classList.remove("hidden")
    contenedor.innerHTML = "<h3>📊 Historial de Ventas</h3>"

    if (ventas.length === 0) {
      contenedor.innerHTML +=
        '<p style="text-align: center; color: #888; padding: 2rem;">No hay ventas registradas.</p>'
      return
    }

    // Agrupar por mes
    const ventasPorMes = {}
    ventas.forEach((venta) => {
      const fecha = new Date(venta.fecha_venta)
      const mesAnio = fecha.toLocaleDateString("es-ES", { month: "long", year: "numeric" })
      const key = mesAnio.charAt(0).toUpperCase() + mesAnio.slice(1)

      if (!ventasPorMes[key]) ventasPorMes[key] = []
      ventasPorMes[key].push(venta)
    })

    // Mostrar ventas agrupadas
    for (const [mes, ventasDelMes] of Object.entries(ventasPorMes)) {
      contenedor.innerHTML += `<h4 class="mes-header">🗓️ ${mes}</h4>`

      ventasDelMes.forEach((venta) => {
        const fecha = new Date(venta.fecha_venta)
        const fechaFormateada = fecha.toLocaleDateString("es-ES")

        contenedor.innerHTML += `
          <div class="venta-item">
            <div class="venta-header">
              <span class="venta-id">Venta #${venta.id}</span>
              <span class="venta-fecha">${fechaFormateada}</span>
            </div>
            <div class="venta-cliente">
              <strong>👤 Cliente:</strong> ${venta.cliente_nombre}
              ${venta.cliente_cedula ? ` (${venta.cliente_cedula})` : ""}
            </div>
            <div class="venta-productos">
              <strong>📦 Productos:</strong> ${venta.productos_vendidos || "N/A"}
            </div>
            <div class="venta-pago">
              <strong>💳 Pago:</strong> ${obtenerNombreMetodoPago(venta.metodo_pago)}
              ${venta.referencia_pago ? ` - Ref: ${venta.referencia_pago}` : ""}
            </div>
            <div class="venta-totales">
              <div>
                <strong>💵 Total USD:</strong> $${venta.total_usd.toFixed(2)}<br>
                <strong>💰 Total Bs:</strong> ${venta.total_bs.toFixed(2)} Bs
              </div>
              <div>
                <strong>💱 Tasa:</strong> ${venta.tasa_cambio.toFixed(2)} Bs/USD<br>
                <strong>👤 Usuario:</strong> ${venta.usuario || "N/A"}
              </div>
            </div>
          </div>
        `
      })
    }
  })
}

function exportarHistorialPDF() {
  const contenido = document.getElementById("historial-ventas").innerHTML
  const ventana = window.open("", "", "width=800,height=600")

  ventana.document.write(`
    <html>
      <head>
        <title>Historial de Ventas - SIMETRIC GYM</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            padding: 20px; 
            color: #333;
          }
          h3 { 
            color: #880808; 
            text-align: center; 
            border-bottom: 2px solid #880808;
            padding-bottom: 10px;
          }
          .venta-item { 
            margin-bottom: 15px; 
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
          }
          .venta-header {
            display: flex;
            justify-content: space-between;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .mes-header {
            color: #880808;
            margin-top: 20px;
            margin-bottom: 10px;
            font-size: 1.2em;
          }
          .venta-totales {
            background-color: #f5f5f5;
            padding: 8px;
            border-radius: 3px;
            margin-top: 8px;
          }
          .venta-cliente, .venta-productos, .venta-pago {
            margin-bottom: 5px;
          }
        </style>
      </head>
      <body>
        <h2>🏋️ SIMETRIC GYM - Historial de Ventas</h2>
        <p><strong>Fecha de exportación:</strong> ${new Date().toLocaleDateString("es-ES")}</p>
        <hr>
        ${contenido}
      </body>
    </html>
  `)

  ventana.document.close()
  // Dar tiempo para que se cargue el contenido y luego mostrar diálogo de impresión
  setTimeout(() => {
    ventana.print()
  }, 500)
}

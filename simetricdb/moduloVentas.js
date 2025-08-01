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
  db.run(
    `
    CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha_venta TEXT NOT NULL,
      total_usd REAL NOT NULL,
      total_bs REAL NOT NULL,
      tasa_cambio REAL NOT NULL,
      usuario TEXT,
      observaciones TEXT
    )
  `,
    (err) => {
      if (err) {
        console.error("Error creando tabla ventas:", err.message)
      } else {
        console.log("✅ Tabla ventas verificada")
      }
    },
  )

  // Tabla detalle de ventas (productos vendidos)
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
      COUNT(l.id) as total_lotes,
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

// Confirmar venta
async function confirmarVenta() {
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

  const btnConfirmar = document.getElementById("btn-confirmar-venta")
  const textoOriginal = btnConfirmar.innerHTML
  btnConfirmar.disabled = true
  btnConfirmar.innerHTML = '<span class="btn-icon">⏳</span>Procesando...'

  try {
    // Calcular totales
    let totalUSD = 0
    carrito.forEach((item) => {
      totalUSD += item.precio_venta * item.cantidad
    })
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

      // 1. Insertar venta principal
      db.run(
        `
        INSERT INTO ventas (fecha_venta, total_usd, total_bs, tasa_cambio, usuario)
        VALUES (?, ?, ?, ?, ?)
      `,
        [fechaVenta, totalUSD, totalBs, tasa, usuarioActual],
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
                          `Venta #${ventaId}`,
                          fechaVenta,
                          lote.cantidad_disponible,
                          lote.cantidad_disponible - lote.cantidad_a_usar,
                          usuarioActual,
                        ],
                        (err) => {
                          if (err) {
                            console.error("Error registrando movimiento:", err.message)
                            db.run("ROLLBACK")
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

                              // Éxito
                              alert(
                                `✅ Venta registrada exitosamente\n\n` +
                                  `Venta #${ventaId}\n` +
                                  `Total: $${totalUSD.toFixed(2)} USD (${totalBs.toFixed(2)} Bs)\n` +
                                  `Tasa: ${tasa.toFixed(2)} Bs/USD\n` +
                                  `Productos: ${carrito.length}`,
                              )

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
  document.getElementById("btn-confirmar-venta").addEventListener("click", confirmarVenta)
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

  // Historial
  document.getElementById("btn-historial").addEventListener("click", toggleHistorial)
  document.getElementById("btn-exportar-pdf").addEventListener("click", exportarHistorialPDF)
})

// Funciones del modal
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
            <div class="venta-productos">
              <strong>Productos:</strong> ${venta.productos_vendidos || "N/A"}
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
  ventana.print()
}

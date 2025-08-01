const sqlite3 = require("sqlite3").verbose()

// Conectar a la base de datos unificada
const db = new sqlite3.Database("simetricdb.sqlite", (err) => {
  if (err) {
    console.error(err.message)
  } else {
    console.log("Conectado a la base de datos unificada para mostrar inventario.")
    // Crear tablas necesarias para el sistema de lotes
    crearTablasLotes()
    cargarInventarioDesdeDB()
  }
})

let productosOriginales = []
let productoIdSeleccionado = null
let productoSeleccionadoStock = null

// Crear tablas para el sistema de lotes
function crearTablasLotes() {
  // Tabla de lotes - cada compra es un lote independiente
  db.run(
    `
    CREATE TABLE IF NOT EXISTS lotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL,
      cantidad_inicial INTEGER NOT NULL,
      cantidad_disponible INTEGER NOT NULL,
      precio_compra_unitario REAL NOT NULL,
      proveedor TEXT NOT NULL,
      numero_factura TEXT,
      fecha_compra TEXT NOT NULL,
      fecha_vencimiento TEXT,
      observaciones TEXT,
      usuario_registro TEXT,
      activo INTEGER DEFAULT 1,
      FOREIGN KEY (producto_id) REFERENCES productos(id)
    )
  `,
    (err) => {
      if (err) {
        console.error("Error creando tabla lotes:", err.message)
      } else {
        console.log("✅ Tabla lotes verificada/creada")
      }
    },
  )

  // Tabla de movimientos de stock (para auditoría)
  db.run(
    `
    CREATE TABLE IF NOT EXISTS movimientos_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL,
      lote_id INTEGER,
      tipo_movimiento TEXT NOT NULL, -- 'entrada', 'salida', 'ajuste'
      cantidad INTEGER NOT NULL,
      precio_unitario REAL,
      motivo TEXT,
      observaciones TEXT,
      fecha_movimiento TEXT NOT NULL,
      stock_anterior INTEGER NOT NULL,
      stock_nuevo INTEGER NOT NULL,
      usuario TEXT,
      FOREIGN KEY (producto_id) REFERENCES productos(id),
      FOREIGN KEY (lote_id) REFERENCES lotes(id)
    )
  `,
    (err) => {
      if (err) {
        console.error("Error creando tabla movimientos_stock:", err.message)
      } else {
        console.log("✅ Tabla movimientos_stock verificada/creada")
      }
    },
  )
}

function cargarInventarioDesdeDB() {
  // Cargar productos con stock calculado desde lotes
  const query = `
    SELECT 
      p.*,
      COALESCE(SUM(l.cantidad_disponible), 0) as stock_total,
      COUNT(l.id) as total_lotes,
      MIN(l.fecha_compra) as primer_lote,
      MAX(l.fecha_compra) as ultimo_lote
    FROM productos p
    LEFT JOIN lotes l ON p.id = l.producto_id AND l.activo = 1
    GROUP BY p.id
    ORDER BY p.nombre
  `

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error(err.message)
      return
    }
    productosOriginales = rows
    filtrarYMostrarProductos()
  })
}

function filtrarYMostrarProductos() {
  const codigoFiltro = document.getElementById("search-code").value.toLowerCase()
  const nombreFiltro = document.getElementById("search-name").value.toLowerCase()
  const categoriaFiltro = document.getElementById("search-category").value
  const stockSort = document.getElementById("sort-stock").value

  const productosFiltrados = productosOriginales.filter(
    (p) =>
      p.codigo.toLowerCase().includes(codigoFiltro) &&
      p.nombre.toLowerCase().includes(nombreFiltro) &&
      (categoriaFiltro === "" || p.categoria === categoriaFiltro),
  )

  // Aplicar ordenamiento por stock si está seleccionado
  if (stockSort) {
    productosFiltrados.sort((a, b) => {
      if (stockSort === "asc") {
        return a.stock_total - b.stock_total // Menor a mayor
      } else if (stockSort === "desc") {
        return b.stock_total - a.stock_total // Mayor a menor
      }
      return 0
    })
  }

  renderizarProductos(productosFiltrados)
}

function renderizarProductos(productos) {
  const container = document.getElementById("inventory-container")
  container.innerHTML = ""

  if (productos.length === 0) {
    container.innerHTML = "<p>No se encontraron productos.</p>"
    return
  }

  const header = document.createElement("div")
  header.classList.add("table-header")
  header.innerHTML = `
    <div>Código</div>
    <div>Nombre</div>
    <div>Categoría</div>
    <div>Stock Total</div>
    <div>Lotes</div>
    <div>Acciones</div>
  `
  container.appendChild(header)

  productos.forEach((p) => {
    const row = document.createElement("div")
    row.classList.add("table-row")

    // Indicador de stock bajo
    const stockClass = p.stock_total <= 5 ? "stock-bajo" : ""
    const stockIndicator = p.stock_total <= 5 ? " ⚠️" : ""

    row.innerHTML = `
      <div>${p.codigo}</div>
      <div>${p.nombre}</div>
      <div>${p.categoria}</div>
      <div id="stock-${p.id}" class="${stockClass}">${p.stock_total}${stockIndicator}</div>
      <div>${p.total_lotes} lote${p.total_lotes !== 1 ? "s" : ""}</div>
      <div class="action-buttons">
        <button class="ver-detalles-producto" data-id="${p.id}">Detalles</button>
        <button class="actualizar-stock-btn" data-id="${p.id}">Nueva Compra</button>
      </div>
    `
    container.appendChild(row)
  })
}

// Mostrar detalles en el popup
document.addEventListener("click", (event) => {
  if (event.target.classList.contains("ver-detalles-producto")) {
    const id = event.target.dataset.id
    productoIdSeleccionado = id

    // Obtener datos del producto con información del lote más reciente activo
    const query = `
  SELECT 
    p.*,
    COALESCE(SUM(l.cantidad_disponible), 0) as stock_total,
    l_reciente.precio_compra_unitario as precio_compra_actual,
    l_reciente.proveedor as proveedor_actual,
    l_reciente.fecha_compra as fecha_compra_reciente
  FROM productos p
  LEFT JOIN lotes l ON p.id = l.producto_id AND l.activo = 1
  LEFT JOIN (
    SELECT producto_id, precio_compra_unitario, proveedor, fecha_compra,
           ROW_NUMBER() OVER (PARTITION BY producto_id ORDER BY fecha_compra DESC, id DESC) as rn
    FROM lotes 
    WHERE cantidad_disponible > 0 AND activo = 1
  ) l_reciente ON p.id = l_reciente.producto_id AND l_reciente.rn = 1
  WHERE p.id = ?
  GROUP BY p.id
`

    db.get(query, [id], (err, p) => {
      if (err) {
        console.error("Error al obtener detalles:", err.message)
        return
      }
      if (p) {
        document.getElementById("detalle-codigo").value = p.codigo
        document.getElementById("detalle-nombre").value = p.nombre
        document.getElementById("detalle-descripcion").value = p.descripcion
        // Usar proveedor del lote más reciente si existe, sino el original
        document.getElementById("detalle-proveedor").value = p.proveedor_actual || p.proveedor
        // Usar precio de compra del lote más reciente si existe, sino el original
        document.getElementById("detalle-precio-compra").value = p.precio_compra_actual || p.precio_compra
        document.getElementById("detalle-precio").value = p.precio_venta
        document.getElementById("detalle-stock").value = p.stock_total
        document.getElementById("detalle-marca").value = p.marca
        document.getElementById("detalle-unidad").value = p.unidad
        document.getElementById("popup-detalles-inv").classList.remove("oculto")
      }
    })
  }

  // Manejar clic en botón "Nueva Compra"
  if (event.target.classList.contains("actualizar-stock-btn")) {
    const id = event.target.dataset.id
    abrirPopupNuevaCompra(id)
  }
})

// Función para abrir popup de nueva compra
function abrirPopupNuevaCompra(productoId) {
  const query = `
    SELECT 
      p.*,
      COALESCE(SUM(l.cantidad_disponible), 0) as stock_total
    FROM productos p
    LEFT JOIN lotes l ON p.id = l.producto_id AND l.activo = 1
    WHERE p.id = ?
    GROUP BY p.id
  `

  db.get(query, [productoId], (err, producto) => {
    if (err) {
      console.error("Error al obtener producto:", err.message)
      alert("Error al cargar información del producto")
      return
    }

    if (producto) {
      productoSeleccionadoStock = producto

      // Llenar información del producto
      document.getElementById("stock-producto-nombre").textContent = producto.nombre
      document.getElementById("stock-producto-codigo").textContent = producto.codigo
      document.getElementById("stock-actual").textContent = producto.stock_total

      // Resetear formulario
      document.getElementById("form-actualizar-stock").reset()

      // Establecer fecha actual
      const hoy = new Date().toISOString().split("T")[0]
      document.getElementById("fecha-compra").value = hoy

      // Actualizar preview inicial
      actualizarPreviewCompra()

      // Calcular y mostrar precio de venta proyectado
      calcularPrecioVentaProyectado(productoId)

      // Mostrar popup
      document.getElementById("popup-actualizar-stock").classList.remove("oculto")
      document.getElementById("cantidad-compra").focus()
    }
  })
}

// Función para actualizar el preview de la compra
function actualizarPreviewCompra() {
  if (!productoSeleccionadoStock) return

  const stockActual = productoSeleccionadoStock.stock_total
  const cantidad = Number.parseInt(document.getElementById("cantidad-compra").value) || 0
  const precioUnitario = Number.parseFloat(document.getElementById("precio-compra-unitario").value) || 0

  const nuevoStock = stockActual + cantidad
  const totalCompra = cantidad * precioUnitario

  // Actualizar elementos del DOM
  document.getElementById("preview-actual").textContent = stockActual
  document.getElementById("preview-cantidad").textContent = cantidad
  document.getElementById("preview-nuevo").textContent = nuevoStock
  document.getElementById("preview-total").textContent = `$${totalCompra.toFixed(2)}`

  // Cambiar color del nuevo stock
  const previewNuevo = document.getElementById("preview-nuevo")
  if (cantidad > 0) {
    previewNuevo.style.color = "#4CAF50" // Verde para aumento
  } else {
    previewNuevo.style.color = "#FF9800" // Naranja para sin cambios
  }
}

// Event listeners para el popup de compra
document.addEventListener("DOMContentLoaded", () => {
  // Listeners para actualizar preview
  const cantidadInput = document.getElementById("cantidad-compra")
  const precioInput = document.getElementById("precio-compra-unitario")

  if (cantidadInput) {
    cantidadInput.addEventListener("input", actualizarPreviewCompra)
    cantidadInput.addEventListener("input", () => {
      if (productoSeleccionadoStock) {
        calcularPrecioVentaProyectado(productoSeleccionadoStock.id)
      }
    })
  }
  if (precioInput) {
    precioInput.addEventListener("input", actualizarPreviewCompra)
    precioInput.addEventListener("input", () => {
      if (productoSeleccionadoStock) {
        calcularPrecioVentaProyectado(productoSeleccionadoStock.id)
      }
    })
  }

  // Cerrar popup de stock
  const cerrarBtn = document.getElementById("cerrar-popup-stock")
  if (cerrarBtn) {
    cerrarBtn.addEventListener("click", () => {
      document.getElementById("popup-actualizar-stock").classList.add("oculto")
    })
  }

  const cancelarBtn = document.getElementById("btn-cancelar-stock")
  if (cancelarBtn) {
    cancelarBtn.addEventListener("click", () => {
      document.getElementById("popup-actualizar-stock").classList.add("oculto")
    })
  }

  // Manejar envío del formulario de compra
  const formCompra = document.getElementById("form-actualizar-stock")
  if (formCompra) {
    formCompra.addEventListener("submit", (e) => {
      e.preventDefault()
      registrarNuevoLote()
    })
  }
})

// Función para registrar nuevo lote (compra)
function registrarNuevoLote() {
  if (!productoSeleccionadoStock) {
    alert("Error: No se ha seleccionado un producto")
    return
  }

  const cantidad = Number.parseInt(document.getElementById("cantidad-compra").value)
  const precioUnitario = Number.parseFloat(document.getElementById("precio-compra-unitario").value)
  const proveedor = document.getElementById("proveedor-compra").value.trim()
  const fechaCompra = document.getElementById("fecha-compra").value
  const numeroFactura = document.getElementById("numero-factura").value.trim()
  const observaciones = document.getElementById("observaciones-compra").value.trim()

  // Validaciones
  if (isNaN(cantidad) || cantidad <= 0) {
    alert("Por favor ingresa una cantidad válida mayor a 0")
    document.getElementById("cantidad-compra").focus()
    return
  }

  if (isNaN(precioUnitario) || precioUnitario < 0) {
    alert("Por favor ingresa un precio unitario válido")
    document.getElementById("precio-compra-unitario").focus()
    return
  }

  if (!proveedor) {
    alert("Por favor ingresa el nombre del proveedor")
    document.getElementById("proveedor-compra").focus()
    return
  }

  if (!fechaCompra) {
    alert("Por favor selecciona la fecha de compra")
    document.getElementById("fecha-compra").focus()
    return
  }

  const stockActual = productoSeleccionadoStock.stock_total
  const nuevoStock = stockActual + cantidad
  const totalCompra = cantidad * precioUnitario

  // Confirmación
  const confirmar = confirm(
    `¿Confirmas el registro de este nuevo lote?\n\n` +
      `Producto: ${productoSeleccionadoStock.nombre}\n` +
      `Cantidad: ${cantidad} unidades\n` +
      `Precio unitario: $${precioUnitario.toFixed(2)}\n` +
      `Total de compra: $${totalCompra.toFixed(2)}\n` +
      `Proveedor: ${proveedor}\n` +
      `Stock actual: ${stockActual}\n` +
      `Stock nuevo: ${nuevoStock}\n\n` +
      `Este lote será independiente y seguirá la lógica PEPS para las ventas.`,
  )

  if (!confirmar) return

  // Deshabilitar botón durante el proceso
  const btnConfirmar = document.getElementById("btn-confirmar-compra")
  const textoOriginal = btnConfirmar.innerHTML
  btnConfirmar.disabled = true
  btnConfirmar.innerHTML = '<span class="btn-icon">⏳</span>Registrando lote...'

  // Obtener usuario actual
  const usuarioActual = sessionStorage.getItem("usuarioActual") || "Sistema"

  // Iniciar transacción
  db.serialize(() => {
    db.run("BEGIN TRANSACTION")

    // 1. Crear nuevo lote
    db.run(
      `INSERT INTO lotes 
         (producto_id, cantidad_inicial, cantidad_disponible, precio_compra_unitario, 
          proveedor, numero_factura, fecha_compra, observaciones, usuario_registro)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        productoSeleccionadoStock.id,
        cantidad,
        cantidad, // cantidad_disponible = cantidad_inicial al crear
        precioUnitario,
        proveedor,
        numeroFactura,
        fechaCompra,
        observaciones,
        usuarioActual,
      ],
      function (err) {
        if (err) {
          console.error("Error al crear lote:", err.message)
          db.run("ROLLBACK")
          btnConfirmar.disabled = false
          btnConfirmar.innerHTML = textoOriginal
          alert("Error al crear el lote. Inténtalo nuevamente.")
          return
        }

        const loteId = this.lastID

        // 2. Registrar movimiento de stock
        db.run(
          `INSERT INTO movimientos_stock 
             (producto_id, lote_id, tipo_movimiento, cantidad, precio_unitario, 
              motivo, observaciones, fecha_movimiento, stock_anterior, stock_nuevo, usuario)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            productoSeleccionadoStock.id,
            loteId,
            "entrada",
            cantidad,
            precioUnitario,
            "Nueva compra - Lote creado",
            `Proveedor: ${proveedor}${numeroFactura ? ` | Factura: ${numeroFactura}` : ""}`,
            fechaCompra,
            stockActual,
            nuevoStock,
            usuarioActual,
          ],
          (err) => {
            if (err) {
              console.error("Error al registrar movimiento:", err.message)
              db.run("ROLLBACK")
              btnConfirmar.disabled = false
              btnConfirmar.innerHTML = textoOriginal
              alert("Error al registrar el movimiento. Inténtalo nuevamente.")
              return
            }

            // 3. Confirmar transacción
            db.run("COMMIT", (err) => {
              btnConfirmar.disabled = false
              btnConfirmar.innerHTML = textoOriginal

              if (err) {
                console.error("Error al confirmar transacción:", err.message)
                alert("Error al confirmar la operación.")
                return
              }

              // Éxito
              alert(
                `✅ Nuevo lote registrado exitosamente\n\n` +
                  `Lote ID: ${loteId}\n` +
                  `Cantidad: ${cantidad} unidades\n` +
                  `Precio unitario: $${precioUnitario.toFixed(2)}\n` +
                  `Total de compra: $${totalCompra.toFixed(2)}\n` +
                  `Stock anterior: ${stockActual}\n` +
                  `Stock nuevo: ${nuevoStock}`,
              )

              // Actualizar la vista dinámicamente
              const stockElement = document.getElementById(`stock-${productoSeleccionadoStock.id}`)
              if (stockElement) {
                stockElement.textContent = nuevoStock

                // Efecto visual de actualización
                stockElement.style.backgroundColor = "#4CAF50"
                stockElement.style.color = "white"
                stockElement.style.fontWeight = "bold"
                stockElement.style.transition = "all 0.3s ease"

                setTimeout(() => {
                  stockElement.style.backgroundColor = ""
                  stockElement.style.color = ""
                  stockElement.style.fontWeight = ""
                }, 2000)
              }

              // Recargar datos para actualizar la vista
              cargarInventarioDesdeDB()

              // Cerrar popup
              document.getElementById("popup-actualizar-stock").classList.add("oculto")

              // Actualizar precio de venta basado en costo promedio ponderado
              actualizarPrecioVentaPromedio(productoSeleccionadoStock.id)

              console.log(`Nuevo lote creado: ${productoSeleccionadoStock.nombre} - Lote ${loteId}`)
            })
          },
        )
      },
    )
  })
}

// Función para mostrar historial de lotes
let historialStockVisible = false

document.addEventListener("click", (event) => {
  if (event.target.id === "btn-historial-stock") {
    const contenedor = document.getElementById("historial-stock")
    const boton = document.getElementById("btn-historial-stock")

    if (!historialStockVisible) {
      // Cargar historial de lotes
      db.all(
        `SELECT 
           l.*,
           (l.cantidad_inicial - l.cantidad_disponible) as cantidad_vendida,
           CASE 
             WHEN l.cantidad_disponible > 0 THEN 'Activo'
             ELSE 'Agotado'
           END as estado
         FROM lotes l
         WHERE l.producto_id = ? AND l.activo = 1
         ORDER BY l.fecha_compra ASC, l.id ASC`,
        [productoIdSeleccionado],
        (err, lotes) => {
          if (err) {
            console.error("Error al cargar historial de lotes:", err.message)
            return
          }

          contenedor.classList.remove("hidden")
          contenedor.innerHTML = "<h3>📦 Historial de Lotes (PEPS)</h3>"

          if (lotes.length === 0) {
            contenedor.innerHTML += "<p>No hay lotes registrados para este producto.</p>"
          } else {
            // Mostrar resumen
            const totalStock = lotes.reduce((sum, lote) => sum + lote.cantidad_disponible, 0)
            const totalLotes = lotes.length
            const lotesActivos = lotes.filter((l) => l.cantidad_disponible > 0).length

            contenedor.innerHTML += `
              <div class="resumen-lotes">
                <p><strong>📊 Resumen:</strong></p>
                <p>• Total de lotes: ${totalLotes}</p>
                <p>• Lotes activos: ${lotesActivos}</p>
                <p>• Stock total disponible: ${totalStock} unidades</p>
              </div>
            `

            // Mostrar cada lote
            lotes.forEach((lote, index) => {
              const fechaFormateada = new Date(lote.fecha_compra).toLocaleDateString("es-ES")
              const estadoClass = lote.cantidad_disponible > 0 ? "lote-activo" : "lote-agotado"
              const ordenPEPS = index + 1

              contenedor.innerHTML += `
                <div class="lote-item ${estadoClass}">
                  <div class="lote-header">
                    <span class="lote-orden">Lote #${lote.id} (PEPS: ${ordenPEPS}°)</span>
                    <span class="lote-estado">${lote.estado}</span>
                    <span class="lote-fecha">${fechaFormateada}</span>
                  </div>
                  <div class="lote-detalle">
                    <div class="lote-info-grid">
                      <div>
                        <p><strong>Cantidad inicial:</strong> ${lote.cantidad_inicial} unidades</p>
                        <p><strong>Disponible:</strong> ${lote.cantidad_disponible} unidades</p>
                        <p><strong>Vendido:</strong> ${lote.cantidad_vendida} unidades</p>
                      </div>
                      <div>
                        <p><strong>Precio unitario:</strong> $${lote.precio_compra_unitario.toFixed(2)}</p>
                        <p><strong>Proveedor:</strong> ${lote.proveedor}</p>
                        ${lote.numero_factura ? `<p><strong>Factura:</strong> ${lote.numero_factura}</p>` : ""}
                      </div>
                    </div>
                    ${lote.observaciones ? `<p><strong>Observaciones:</strong> ${lote.observaciones}</p>` : ""}
                    <p class="lote-usuario"><strong>Registrado por:</strong> ${lote.usuario_registro || "Sistema"}</p>
                  </div>
                </div>
              `
            })
          }
          boton.textContent = "Ocultar Historial"
          historialStockVisible = true
        },
      )
    } else {
      contenedor.classList.add("hidden")
      contenedor.innerHTML = ""
      boton.textContent = "Ver Historial de Stock"
      historialStockVisible = false
    }
  }
})

// Cerrar popup de detalles
document.getElementById("cerrar-popup-inv").addEventListener("click", () => {
  const historialContenedor = document.getElementById("historial-stock")
  historialContenedor.classList.add("hidden")
  historialContenedor.innerHTML = ""
  document.getElementById("btn-historial-stock").textContent = "Ver Historial de Stock"
  historialStockVisible = false

  document.getElementById("popup-detalles-inv").classList.add("oculto")
})

// Eliminar producto
document.getElementById("eliminar-producto").addEventListener("click", () => {
  const confirmar = confirm(
    "¿Estás seguro de que deseas eliminar este producto?\n\n" +
      "ADVERTENCIA: Esto también eliminará todos los lotes asociados y el historial de movimientos.\n" +
      "Esta acción no se puede deshacer.",
  )

  if (confirmar) {
    db.serialize(() => {
      db.run("BEGIN TRANSACTION")

      // Eliminar movimientos de stock
      db.run("DELETE FROM movimientos_stock WHERE producto_id = ?", [productoIdSeleccionado], (err) => {
        if (err) {
          console.error("Error eliminando movimientos:", err.message)
          db.run("ROLLBACK")
          alert("Error al eliminar el producto.")
          return
        }

        // Eliminar lotes
        db.run("DELETE FROM lotes WHERE producto_id = ?", [productoIdSeleccionado], (err) => {
          if (err) {
            console.error("Error eliminando lotes:", err.message)
            db.run("ROLLBACK")
            alert("Error al eliminar el producto.")
            return
          }

          // Eliminar producto
          db.run("DELETE FROM productos WHERE id = ?", [productoIdSeleccionado], (err) => {
            if (err) {
              console.error("Error eliminando producto:", err.message)
              db.run("ROLLBACK")
              alert("Error al eliminar el producto.")
              return
            }

            db.run("COMMIT", (err) => {
              if (err) {
                console.error("Error confirmando eliminación:", err.message)
                alert("Error al eliminar el producto.")
                return
              }

              alert("Producto eliminado correctamente junto con todos sus lotes.")
              document.getElementById("popup-detalles-inv").classList.add("oculto")
              cargarInventarioDesdeDB()
            })
          })
        })
      })
    })
  }
})

// Filtros
document.getElementById("search-code").addEventListener("input", filtrarYMostrarProductos)
document.getElementById("search-name").addEventListener("input", filtrarYMostrarProductos)
document.getElementById("search-category").addEventListener("input", filtrarYMostrarProductos)
document.getElementById("sort-stock").addEventListener("change", filtrarYMostrarProductos)

// Función para calcular precio de venta proyectado
function calcularPrecioVentaProyectado(productoId) {
  const cantidad = Number.parseInt(document.getElementById("cantidad-compra").value) || 0
  const precioUnitario = Number.parseFloat(document.getElementById("precio-compra-unitario").value) || 0

  if (cantidad <= 0 || precioUnitario <= 0) {
    document.getElementById("preview-precio-proyectado").textContent = "N/A"
    return
  }

  // Obtener lotes actuales para calcular promedio ponderado proyectado
  db.all(
    `SELECT cantidad_disponible, precio_compra_unitario 
     FROM lotes 
     WHERE producto_id = ? AND cantidad_disponible > 0 AND activo = 1`,
    [productoId],
    (err, lotes) => {
      if (err) {
        console.error("Error calculando precio proyectado:", err.message)
        return
      }

      let totalCosto = 0
      let totalCantidad = 0

      // Sumar lotes existentes
      lotes.forEach((lote) => {
        totalCosto += lote.cantidad_disponible * lote.precio_compra_unitario
        totalCantidad += lote.cantidad_disponible
      })

      // Agregar nuevo lote proyectado
      totalCosto += cantidad * precioUnitario
      totalCantidad += cantidad

      const costoPromedio = totalCantidad > 0 ? totalCosto / totalCantidad : 0
      const precioVentaProyectado = costoPromedio * 1.3

      const previewElement = document.getElementById("preview-precio-proyectado")
      if (previewElement) {
        previewElement.textContent = `$${precioVentaProyectado.toFixed(2)}`
        previewElement.style.color = "#FF9800"
      }
    },
  )
}

// Función para actualizar precio de venta basado en costo promedio ponderado
function actualizarPrecioVentaPromedio(productoId) {
  const query = `
    SELECT 
      SUM(cantidad_disponible * precio_compra_unitario) as costo_total,
      SUM(cantidad_disponible) as cantidad_total
    FROM lotes 
    WHERE producto_id = ? AND cantidad_disponible > 0 AND activo = 1
  `

  db.get(query, [productoId], (err, result) => {
    if (err) {
      console.error("Error calculando costo promedio:", err.message)
      return
    }

    if (result.cantidad_total > 0) {
      const costoPromedio = result.costo_total / result.cantidad_total
      const nuevoPrecioVenta = costoPromedio * 1.3

      // Actualizar precio de venta en la tabla productos
      db.run(
        "UPDATE productos SET precio_venta = ?, precio_compra = ? WHERE id = ?",
        [nuevoPrecioVenta, costoPromedio, productoId],
        (err) => {
          if (err) {
            console.error("Error actualizando precio de venta:", err.message)
          } else {
            console.log(
              `✅ Precio actualizado: Costo promedio $${costoPromedio.toFixed(2)} → Venta $${nuevoPrecioVenta.toFixed(2)}`,
            )
          }
        },
      )
    }
  })
}

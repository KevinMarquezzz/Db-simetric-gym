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
  // Tabla de lotes - cada compra es un lote independiente con código único
  db.run(
    `
    CREATE TABLE IF NOT EXISTS lotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL,
      codigo_lote TEXT UNIQUE NOT NULL,
      cantidad_inicial INTEGER NOT NULL,
      cantidad_disponible INTEGER NOT NULL,
      precio_compra_unitario REAL NOT NULL,
      proveedor TEXT NOT NULL,
      numero_factura TEXT,
      fecha_compra TEXT NOT NULL,
      codigo_lote TEXT UNIQUE,
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
        // Crear índice para búsqueda por código
        db.run(`CREATE INDEX IF NOT EXISTS idx_lotes_codigo ON lotes(codigo_lote)`)
      }
    },
  )
  db.run(
    `
    CREATE INDEX IF NOT EXISTS idx_lotes_codigo ON lotes(codigo_lote);
    `
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

// Función para generar código de lote
function generarCodigoLote(productoId, callback) {
  // Contar lotes existentes para este producto
  db.get(`SELECT COUNT(*) as total FROM lotes WHERE producto_id = ? AND activo = 1`, [productoId], (err, result) => {
    if (err) {
      callback(err, null)
      return
    }

    const numeroLote = result.total + 1
    const codigoLote = `L${String(productoId).padStart(3, "0")}-${String(numeroLote).padStart(3, "0")}`
    callback(null, codigoLote)
  })
}

function cargarInventarioDesdeDB() {
  // Cargar productos con stock calculado desde lotes
  const query = `
  SELECT 
    p.*,
    COALESCE(SUM(l.cantidad_disponible), 0) as stock_total,
    COUNT(CASE WHEN l.cantidad_disponible > 0 THEN 1 END) as total_lotes,
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
  GROUP BY p.id`

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

  // Manejar clic en botón eliminar lote
  if (event.target.closest(".btn-eliminar-lote")) {
    const boton = event.target.closest(".btn-eliminar-lote")
    const loteId = boton.dataset.loteId
    mostrarModalConfirmacionEliminacion(loteId)
  }

  // MANEJAR CLIC EN BOTÓN EXPORTAR PDF (DELEGACIÓN DE EVENTOS)
  if (event.target.id === "btn-exportar-pdf") {
    event.preventDefault()
    event.stopPropagation()

    // Usar los lotes almacenados en la variable global
    if (lotesActuales && lotesActuales.length > 0) {
      exportarHistorialTexto(lotesActuales)
    } else {
      // Si no hay lotes en memoria, hacer consulta directa
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
       ORDER BY 
         CASE WHEN l.cantidad_disponible > 0 THEN 0 ELSE 1 END,
         l.fecha_compra ASC, 
         l.id ASC`,
        [productoIdSeleccionado],
        (err, lotes) => {
          if (err) {
            console.error("Error al obtener lotes para exportar:", err.message)
            alert("Error al obtener los datos de lotes")
            return
          }

          if (lotes && lotes.length > 0) {
            exportarHistorialTexto(lotes)
          } else {
            alert("No hay lotes para exportar")
          }
        },
      )
    }
  }

  // Manejar búsqueda por código de lote
  if (event.target.id === "btn-buscar-lote") {
    const codigoLote = document.getElementById("buscar-codigo-lote").value.trim()
    if (codigoLote) {
      buscarPorCodigoLote(codigoLote)
    } else {
      alert("Por favor ingresa un código de lote para buscar")
    }
  }
})

// Función para buscar por código de lote
function buscarPorCodigoLote(codigoLote) {
  db.get(
    `SELECT l.*, p.nombre as producto_nombre, p.codigo as producto_codigo
     FROM lotes l
     JOIN productos p ON l.producto_id = p.id
     WHERE l.codigo_lote = ? AND l.activo = 1`,
    [codigoLote],
    (err, lote) => {
      if (err) {
        console.error("Error buscando lote:", err.message)
        alert("Error al buscar el lote")
        return
      }

      if (lote) {
        alert(
          `✅ Lote encontrado:\n\n` +
            `Código de lote: ${lote.codigo_lote}\n` +
            `Producto: ${lote.producto_nombre}\n` +
            `Código producto: ${lote.producto_codigo}\n` +
            `Cantidad disponible: ${lote.cantidad_disponible}\n` +
            `Proveedor: ${lote.proveedor}\n` +
            `Fecha de compra: ${new Date(lote.fecha_compra).toLocaleDateString("es-ES")}`,
        )

        // Opcional: abrir detalles del producto
        productoIdSeleccionado = lote.producto_id
        document.querySelector(`[data-id="${lote.producto_id}"]`).click()
      } else {
        alert(`❌ No se encontró ningún lote con el código: ${codigoLote}`)
      }
    },
  )
}

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

// Función para registrar nuevo lote (compra) con código único
function registrarNuevoLote() {
  if (!productoSeleccionadoStock) {
    alert("Error: No se ha seleccionado un producto")
    return
  }

  const cantidad = Number.parseInt(document.getElementById("cantidad-compra").value)
  const precioUnitario = Number.parseFloat(document.getElementById("precio-compra-unitario").value)
  const proveedor = document.getElementById("proveedor-compra").value.trim()
  const fechaCompra = document.getElementById("fecha-compra").value
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

  // Deshabilitar botón durante el proceso
  const btnConfirmar = document.getElementById("btn-confirmar-compra")
  const textoOriginal = btnConfirmar.innerHTML
  btnConfirmar.disabled = true
  btnConfirmar.innerHTML = '<span class="btn-icon">⏳</span>Generando código de lote...'

  // Generar código de lote primero
  generarCodigoLote(productoSeleccionadoStock.id, (err, codigoLote) => {
    if (err) {
      console.error("Error generando código de lote:", err.message)
      btnConfirmar.disabled = false
      btnConfirmar.innerHTML = textoOriginal
      alert("Error al generar código de lote.")
      return
    }

    // Confirmación con código de lote
    const confirmar = confirm(
      `¿Confirmas el registro de este nuevo lote?\n\n` +
        `Producto: ${productoSeleccionadoStock.nombre}\n` +
        `Código de lote: ${codigoLote}\n` +
        `Cantidad: ${cantidad} unidades\n` +
        `Precio unitario: $${precioUnitario.toFixed(2)}\n` +
        `Total de compra: $${totalCompra.toFixed(2)}\n` +
        `Proveedor: ${proveedor}\n` +
        `Stock actual: ${stockActual}\n` +
        `Stock nuevo: ${nuevoStock}\n\n` +
        `Este lote será independiente y seguirá la lógica PEPS para las ventas.`,
    )

    if (!confirmar) {
      btnConfirmar.disabled = false
      btnConfirmar.innerHTML = textoOriginal
      return
    }

    btnConfirmar.innerHTML = '<span class="btn-icon">⏳</span>Registrando lote...'

    // Obtener usuario actual
    const usuarioActual = sessionStorage.getItem("usuarioActual") || "Sistema"

    // Iniciar transacción
    db.serialize(() => {
      db.run("BEGIN TRANSACTION")

      // 1. Crear nuevo lote con código
      db.run(
        `INSERT INTO lotes
          (producto_id, codigo_lote, cantidad_inicial, cantidad_disponible, precio_compra_unitario,
           proveedor, fecha_compra, observaciones, usuario_registro)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          productoSeleccionadoStock.id,
          codigoLote,
          cantidad,
          cantidad, // cantidad_disponible = cantidad_inicial al crear
          precioUnitario,
          proveedor,
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
            if (err.message.includes("UNIQUE")) {
              alert("Error: Ya existe un lote con ese código. Inténtalo nuevamente.")
            } else {
              alert("Error al crear el lote. Inténtalo nuevamente.")
            }
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
              `Proveedor: ${proveedor} | Código: ${codigoLote}`,
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
                    `Código de lote: ${codigoLote}\n` +
                    `Cantidad: ${cantidad} unidades\n` +
                    `Precio unitario: $${precioUnitario.toFixed(2)}\n` +
                    `Total de compra: $${totalCompra.toFixed(2)}\n` +
                    `Proveedor: ${proveedor}\n` +
                    `Stock anterior: ${stockActual}\n` +
                    `Stock nuevo: ${nuevoStock}\n\n` +
                    `📋 Anota este código para localizar el lote en el almacén: ${codigoLote}`,
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

                console.log(`Nuevo lote creado: ${productoSeleccionadoStock.nombre} - Código: ${codigoLote}`)
              })
            },
          )
        },
      )
    })
  })
}

// Función para mostrar historial de lotes
let historialStockVisible = false
let lotesActuales = [] // Variable global para almacenar los lotes

document.getElementById("btn-historial-stock").addEventListener("click", () => {
  const contenedor = document.getElementById("historial-stock")
  const boton = document.getElementById("btn-historial-stock")

  if (!historialStockVisible) {
    // Cargar historial de lotes con nuevo ordenamiento: activos primero, agotados después
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
     ORDER BY 
       CASE WHEN l.cantidad_disponible > 0 THEN 0 ELSE 1 END,  -- Activos primero (0), agotados después (1)
       l.fecha_compra ASC, 
       l.id ASC`,
      [productoIdSeleccionado],
      (err, lotes) => {
        if (err) {
          console.error("Error al cargar historial de lotes:", err.message)
          return
        }

        // Guardar lotes en variable global
        lotesActuales = lotes

        contenedor.classList.remove("hidden")
        contenedor.innerHTML = `
  <div class="historial-header">
    <h3>📦 Historial de Lotes (PEPS)</h3>
    <div class="header-actions">
      <div class="buscar-lote">
        <input type="text" id="buscar-codigo-lote" placeholder="Buscar por código de lote..." style="padding: 0.3rem; margin-right: 0.5rem; border-radius: 4px; border: 1px solid #880808; background: #1e1e1e; color: #f2f3d9;">
        <button id="btn-buscar-lote" class="btn-buscar" title="Buscar lote">🔍</button>
      </div>
      <button id="btn-exportar-pdf" class="btn-exportar" title="Exportar historial">
        📄 Exportar 
      </button>
    </div>
  </div>
`

        // Separar lotes activos y agotados correctamente
        const lotesActivos = lotes.filter((l) => l.cantidad_disponible > 0)
        const lotesAgotados = lotes.filter((l) => l.cantidad_disponible === 0)
        const totalStock = lotes.reduce((sum, lote) => sum + lote.cantidad_disponible, 0)

        // Mostrar resumen
        contenedor.innerHTML += `
  <div class="resumen-lotes">
    <p><strong>📊 Resumen:</strong></p>
    <p>• Total de lotes: ${lotes.length}</p>
    <p>• Lotes activos: ${lotesActivos.length}</p>
    <p>• Lotes agotados: ${lotesAgotados.length}</p>
    <p>• Stock total disponible: ${totalStock} unidades</p>
  </div>
`

        // Mostrar sección de lotes activos si existen
        if (lotesActivos.length > 0) {
          contenedor.innerHTML += `
    <div class="seccion-titulo activos">🟢 Lotes Activos (${lotesActivos.length})</div>
  `

          lotesActivos.forEach((lote, index) => {
            const fechaFormateada = new Date(lote.fecha_compra).toLocaleDateString("es-ES")
            const ordenPEPS = index + 1

            contenedor.innerHTML += `
      <div class="lote-item lote-activo" data-lote-id="${lote.id}">
        <div class="lote-header">
          <span class="lote-orden">📦 ${lote.codigo_lote} (PEPS: ${ordenPEPS}°)</span>
          <div class="lote-header-right">
            <span class="lote-estado">Activo</span>
            <span class="lote-fecha">${fechaFormateada}</span>
          </div>
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
            </div>
          </div>
          ${lote.observaciones ? `<p><strong>Observaciones:</strong> ${lote.observaciones}</p>` : ""}
          <p class="lote-usuario"><strong>Registrado por:</strong> ${lote.usuario_registro || "Sistema"}</p>
        </div>
      </div>
    `
          })
        }

        // Mostrar sección de lotes agotados si existen
        if (lotesAgotados.length > 0) {
          // Agregar separador visual si hay lotes activos
          if (lotesActivos.length > 0) {
            contenedor.innerHTML += `<div class="separador-lotes"></div>`
          }
          contenedor.innerHTML += `
    <div class="seccion-titulo agotados">🔴 Lotes Agotados (${lotesAgotados.length})</div>
  `

          lotesAgotados.forEach((lote) => {
            const fechaFormateada = new Date(lote.fecha_compra).toLocaleDateString("es-ES")

            contenedor.innerHTML += `
      <div class="lote-item lote-agotado" data-lote-id="${lote.id}">
        <div class="lote-header">
          <span class="lote-orden">📦 ${lote.codigo_lote}</span>
          <div class="lote-header-right">
            <span class="lote-estado">Agotado</span>
            <span class="lote-fecha">${fechaFormateada}</span>
          </div>
        </div>
        <div class="lote-detalle">
          <div class="lote-info-grid">
            <div>
              <p><strong>Cantidad inicial:</strong> ${lote.cantidad_inicial} unidades</p>
              <p><strong>Vendido:</strong> ${lote.cantidad_vendida} unidades</p>
            </div>
            <div>
              <p><strong>Precio unitario:</strong> $${lote.precio_compra_unitario.toFixed(2)}</p>
              <p><strong>Proveedor:</strong> ${lote.proveedor}</p>
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
    boton.textContent = "Ver Historial de lotes"
    historialStockVisible = false
    lotesActuales = [] // Limpiar datos
  }
})

// Función para exportar historial como texto plano (SIMPLIFICADA Y CORREGIDA)
function exportarHistorialTexto(lotes) {
  // Verificar que tenemos lotes
  if (!lotes || lotes.length === 0) {
    alert("No hay lotes para exportar")
    return
  }

  console.log("Exportando lotes:", lotes.length) // Debug

  // Generar PDF directamente
  generarPDFHistorial(lotes)
}

// Función separada para generar el PDF
function generarPDFHistorial(lotes) {
  db.get(
    `SELECT nombre, codigo, categoria, marca FROM productos WHERE id = ?`,
    [productoIdSeleccionado],
    (err, producto) => {
      if (err) {
        console.error("Error al obtener información del producto:", err.message)
        alert("Error al cargar información del producto")
        return
      }

      if (!producto) {
        alert("Producto no encontrado")
        return
      }

      // Generar nombre de archivo normalizado
      const fechaActual = new Date().toISOString().split("T")[0] // YYYY-MM-DD
      const nombreProductoLimpio = producto.nombre.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()
      const nombreArchivo = `lotes-${nombreProductoLimpio}-${fechaActual}.pdf`

      // Generar contenido HTML para PDF
      const fechaExportacion = new Date().toLocaleDateString("es-ES", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })

      const lotesActivos = lotes.filter((l) => l.cantidad_disponible > 0)
      const lotesAgotados = lotes.filter((l) => l.cantidad_disponible === 0)
      const totalStock = lotes.reduce((sum, lote) => sum + lote.cantidad_disponible, 0)
      const totalInversion = lotes.reduce((sum, lote) => sum + lote.cantidad_inicial * lote.precio_compra_unitario, 0)

      let contenidoHTML = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Historial de Lotes - ${producto.nombre}</title>
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
            .producto-info {
              background-color: #f9f9f9;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 20px;
              border-left: 4px solid #880808;
            }
            .resumen {
              background-color: #e8f5e8;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 20px;
              border-left: 4px solid #4caf50;
            }
            .seccion-titulo {
              font-size: 18px;
              font-weight: bold;
              margin: 20px 0 10px 0;
              padding: 10px;
              border-radius: 5px;
            }
            .activos {
              background-color: rgba(76, 175, 80, 0.1);
              color: #4caf50;
              border: 1px solid #4caf50;
            }
            .agotados {
              background-color: rgba(244, 67, 54, 0.1);
              color: #f44336;
              border: 1px solid #f44336;
            }
            .lote-item {67,54,0.1);
              color: #f44336;
              border: 1px solid #f44336;
            }
            .lote-item {
              background-color: #f5f5f5;
              padding: 15px;
              margin-bottom: 15px;
              border-radius: 8px;
              border-left: 4px solid #4caf50;
            }
            .lote-agotado {
              border-left-color: #f44336;
              opacity: 0.8;
            }
            .lote-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 10px;
              font-weight: bold;
            }
            .lote-detalle {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
              margin-bottom: 10px;
            }
            .codigo-lote {
              background-color: #880808;
              color: white;
              padding: 2px 8px;
              border-radius: 4px;
              font-family: monospace;
              font-weight: bold;
            }
            .footer {
              text-align: center;
              border-top: 1px solid #ddd;
              padding-top: 20px;
              color: #666;
              font-size: 12px;
              margin-top: 30px;
            }
            @media print {
              body { margin: 0; }
              .header { page-break-after: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">🏋️ SIMETRIC GYM C.A.</div>
            <div class="subtitle">Historial de Lotes de Inventario</div>
          </div>

          <div class="producto-info">
            <h3>📦 Información del Producto</h3>
            <p><strong>Nombre:</strong> ${producto.nombre}</p>
            <p><strong>Código:</strong> ${producto.codigo}</p>
            <p><strong>Categoría:</strong> ${producto.categoria}</p>
            <p><strong>Marca:</strong> ${producto.marca}</p>
          </div>

          <div class="resumen">
            <h3>📊 Resumen General</h3>
            <p><strong>Total de lotes:</strong> ${lotes.length}</p>
            <p><strong>Lotes activos:</strong> ${lotesActivos.length}</p>
            <p><strong>Lotes agotados:</strong> ${lotesAgotados.length}</p>
            <p><strong>Stock disponible:</strong> ${totalStock} unidades</p>
            <p><strong>Inversión total:</strong> $${totalInversion.toFixed(2)}</p>
            <p><strong>Fecha de exportación:</strong> ${fechaExportacion}</p>
          </div>
      `

      // Lotes activos
      if (lotesActivos.length > 0) {
        contenidoHTML += `<div class="seccion-titulo activos">🟢 Lotes Activos (${lotesActivos.length})</div>`

        lotesActivos.forEach((lote, index) => {
          const fechaFormateada = new Date(lote.fecha_compra).toLocaleDateString("es-ES")
          contenidoHTML += `
            <div class="lote-item">
              <div class="lote-header">
                <span><span class="codigo-lote">${lote.codigo_lote}</span> (PEPS: ${index + 1}°)</span>
                <span>${fechaFormateada}</span>
              </div>
              <div class="lote-detalle">
                <div>
                  <p><strong>Cantidad inicial:</strong> ${lote.cantidad_inicial} unidades</p>
                  <p><strong>Disponible:</strong> ${lote.cantidad_disponible} unidades</p>
                  <p><strong>Vendido:</strong> ${lote.cantidad_vendida} unidades</p>
                </div>
                <div>
                  <p><strong>Precio unitario:</strong> $${lote.precio_compra_unitario.toFixed(2)}</p>
                  <p><strong>Proveedor:</strong> ${lote.proveedor}</p>
                  <p><strong>Registrado por:</strong> ${lote.usuario_registro || "Sistema"}</p>
                </div>
              </div>
              ${lote.observaciones ? `<p><strong>Observaciones:</strong> ${lote.observaciones}</p>` : ""}
            </div>
          `
        })
      }

      // Lotes agotados
      if (lotesAgotados.length > 0) {
        contenidoHTML += `<div class="seccion-titulo agotados">🔴 Lotes Agotados (${lotesAgotados.length})</div>`

        lotesAgotados.forEach((lote) => {
          const fechaFormateada = new Date(lote.fecha_compra).toLocaleDateString("es-ES")
          contenidoHTML += `
            <div class="lote-item lote-agotado">
              <div class="lote-header">
                <span><span class="codigo-lote">${lote.codigo_lote}</span></span>
                <span>${fechaFormateada}</span>
              </div>
              <div class="lote-detalle">
                <div>
                  <p><strong>Cantidad inicial:</strong> ${lote.cantidad_inicial} unidades</p>
                  <p><strong>Vendido:</strong> ${lote.cantidad_vendida} unidades</p>
                </div>
                <div>
                  <p><strong>Precio unitario:</strong> $${lote.precio_compra_unitario.toFixed(2)}</p>
                  <p><strong>Proveedor:</strong> ${lote.proveedor}</p>
                  <p><strong>Registrado por:</strong> ${lote.usuario_registro || "Sistema"}</p>
                </div>
              </div>
              ${lote.observaciones ? `<p><strong>Observaciones:</strong> ${lote.observaciones}</p>` : ""}
            </div>
          `
        })
      }

      contenidoHTML += `
          <div class="footer">
            <p>Reporte generado por SIMETRIC GYM - Sistema de Gestión de Inventario</p>
            <p>Fecha de generación: ${new Date().toLocaleDateString("es-ES")} a las ${new Date().toLocaleTimeString("es-ES")}</p>
            <p><strong>Códigos de lote para búsqueda en almacén</strong></p>
          </div>
        </body>
        </html>
      `

      // Crear ventana de impresión con nombre de archivo sugerido
      const ventanaHistorial = window.open("", "", "width=800,height=600")

      if (!ventanaHistorial) {
        alert(
          "❌ Error: El navegador bloqueó la ventana emergente. Por favor, permite ventanas emergentes para este sitio.",
        )
        return
      }

      // Establecer título de la ventana con el nombre sugerido
      ventanaHistorial.document.title = nombreArchivo.replace(".pdf", "")
      ventanaHistorial.document.write(contenidoHTML)
      ventanaHistorial.document.close()

      // Dar tiempo para que se cargue el contenido y luego mostrar diálogo de impresión
      setTimeout(() => {
        ventanaHistorial.print()
      }, 500)
    },
  )
}

// Cerrar popup de detalles
document.getElementById("cerrar-popup-inv").addEventListener("click", () => {
  const historialContenedor = document.getElementById("historial-stock")
  historialContenedor.classList.add("hidden")
  historialContenedor.innerHTML = ""
  document.getElementById("btn-historial-stock").textContent = "Ver Historial de Lotes"
  historialStockVisible = false
  lotesActuales = [] // Limpiar datos
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

// Función para mostrar modal de confirmación de eliminación
function mostrarModalConfirmacionEliminacion(loteId) {
  // Implementación de la función aquí
  console.log(`Mostrar modal de confirmación para eliminar lote ${loteId}`)
}

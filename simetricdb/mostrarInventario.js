const sqlite3 = require("sqlite3").verbose()
const db = new sqlite3.Database("inventario.sqlite", (err) => {
  if (err) {
    console.error(err.message)
  } else {
    console.log("Conectado a la base de datos para mostrar inventario.")
    cargarInventarioDesdeDB()
  }
})

let productosOriginales = []
let productoIdSeleccionado = null
let productoSeleccionadoStock = null

function cargarInventarioDesdeDB() {
  db.all("SELECT * FROM productos", [], (err, rows) => {
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
        return a.stock - b.stock // Menor a mayor
      } else if (stockSort === "desc") {
        return b.stock - a.stock // Mayor a menor
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
    <div>Stock</div>
    <div>Acciones</div>
  `
  container.appendChild(header)

  productos.forEach((p) => {
    const row = document.createElement("div")
    row.classList.add("table-row")
    row.innerHTML = `
      <div>${p.codigo}</div>
      <div>${p.nombre}</div>
      <div>${p.categoria}</div>
      <div id="stock-${p.id}">${p.stock}</div>
      <div class="action-buttons">
        <button class="ver-detalles-producto" data-id="${p.id}">Detalles</button>
        <button class="actualizar-stock-btn" data-id="${p.id}">Actualizar stock</button>
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

    db.get("SELECT * FROM productos WHERE id = ?", [id], (err, p) => {
      if (err) {
        console.error("Error al obtener detalles:", err.message)
        return
      }
      if (p) {
        document.getElementById("detalle-codigo").value = p.codigo
        document.getElementById("detalle-nombre").value = p.nombre
        document.getElementById("detalle-descripcion").value = p.descripcion
        document.getElementById("detalle-proveedor").value = p.proveedor
        document.getElementById("detalle-precio-compra").value = p.precio_compra
        document.getElementById("detalle-precio").value = p.precio_venta
        document.getElementById("detalle-stock").value = p.stock
        document.getElementById("detalle-marca").value = p.marca
        document.getElementById("detalle-unidad").value = p.unidad
        document.getElementById("popup-detalles-inv").classList.remove("oculto")
      }
    })
  }

  // Manejar clic en botón "Actualizar stock"
  if (event.target.classList.contains("actualizar-stock-btn")) {
    const id = event.target.dataset.id
    abrirPopupActualizarStock(id)
  }
})

// Función para abrir popup de actualizar stock
function abrirPopupActualizarStock(productoId) {
  db.get("SELECT * FROM productos WHERE id = ?", [productoId], (err, producto) => {
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
      document.getElementById("stock-actual").textContent = producto.stock

      // Resetear formulario
      document.getElementById("form-actualizar-stock").reset()
      document.getElementById("opcion-agregar").checked = true
      document.getElementById("cantidad-stock").value = ""
 

      // Actualizar preview
      actualizarPreviewStock()

      // Mostrar popup
      document.getElementById("popup-actualizar-stock").classList.remove("oculto")
      document.getElementById("cantidad-stock").focus()
    }
  })
}

// Función para actualizar el preview del stock
function actualizarPreviewStock() {
  if (!productoSeleccionadoStock) return

  const stockActual = productoSeleccionadoStock.stock
  const cantidad = Number.parseInt(document.getElementById("cantidad-stock").value) || 0
  const operacion = document.querySelector('input[name="tipo-operacion"]:checked').value

  let nuevoStock = stockActual
  let operacionTexto = ""

  switch (operacion) {
    case "agregar":
      nuevoStock = stockActual + cantidad
      operacionTexto = cantidad > 0 ? `${stockActual} + ${cantidad} = ${nuevoStock}` : ""
      break
    case "reducir":
      nuevoStock = Math.max(0, stockActual - cantidad)
      operacionTexto = cantidad > 0 ? `${stockActual} - ${cantidad} = ${nuevoStock}` : ""
      if (stockActual - cantidad < 0) {
        operacionTexto += " (ajustado a 0)"
      }
      break
    case "establecer":
      nuevoStock = cantidad
      operacionTexto = cantidad >= 0 ? `Stock establecido a ${nuevoStock}` : ""
      break
  }

  // Actualizar elementos del DOM
  document.getElementById("operacion-preview").textContent = operacionTexto
  document.getElementById("preview-actual").textContent = stockActual
  document.getElementById("preview-nuevo").textContent = nuevoStock

  // Cambiar color según el resultado
  const previewNuevo = document.getElementById("preview-nuevo")
  if (nuevoStock > stockActual) {
    previewNuevo.style.color = "#4CAF50" // Verde para aumento
  } else if (nuevoStock < stockActual) {
    previewNuevo.style.color = "#f44336" // Rojo para reducción
  } else {
    previewNuevo.style.color = "#FF9800" // Naranja para igual
  }
}

// Event listeners para el popup de stock
document.addEventListener("DOMContentLoaded", () => {
  // Listeners para cambios en las opciones de operación
  document.querySelectorAll('input[name="tipo-operacion"]').forEach((radio) => {
    radio.addEventListener("change", actualizarPreviewStock)
  })

  // Listener para cambios en la cantidad
  document.getElementById("cantidad-stock").addEventListener("input", actualizarPreviewStock)

  // Cerrar popup de stock
  document.getElementById("cerrar-popup-stock").addEventListener("click", () => {
    document.getElementById("popup-actualizar-stock").classList.add("oculto")
  })

  document.getElementById("btn-cancelar-stock").addEventListener("click", () => {
    document.getElementById("popup-actualizar-stock").classList.add("oculto")
  })

  // Manejar envío del formulario de stock
  document.getElementById("form-actualizar-stock").addEventListener("submit", (e) => {
    e.preventDefault()
    actualizarStockProducto()
  })
})

// Función para actualizar el stock en la base de datos
function actualizarStockProducto() {
  if (!productoSeleccionadoStock) {
    alert("Error: No se ha seleccionado un producto")
    return
  }

  const cantidad = Number.parseInt(document.getElementById("cantidad-stock").value)
  const operacion = document.querySelector('input[name="tipo-operacion"]:checked').value


  // Validaciones
  if (isNaN(cantidad) || cantidad < 0) {
    alert("Por favor ingresa una cantidad válida")
    document.getElementById("cantidad-stock").focus()
    return
  }

  // Calcular nuevo stock
  const stockActual = productoSeleccionadoStock.stock
  let nuevoStock = stockActual

  switch (operacion) {
    case "agregar":
      nuevoStock = stockActual + cantidad
      break
    case "reducir":
      nuevoStock = Math.max(0, stockActual - cantidad)
      break
    case "establecer":
      nuevoStock = cantidad
      break
  }

  // Confirmación
  const operacionTexto = {
    agregar: `agregar ${cantidad} unidades`,
    reducir: `reducir ${cantidad} unidades`,
    establecer: `establecer el stock a ${cantidad} unidades`,
  }

  const confirmar = confirm(
    `¿Confirmas que deseas ${operacionTexto[operacion]}?\n\n` +
      `Producto: ${productoSeleccionadoStock.nombre}\n` +
      `Stock actual: ${stockActual}\n` +
      `Stock nuevo: ${nuevoStock}\n`,
  )

  if (!confirmar) return

  // Deshabilitar botón durante la actualización
  const btnConfirmar = document.getElementById("btn-confirmar-stock")
  const textoOriginal = btnConfirmar.innerHTML
  btnConfirmar.disabled = true
  btnConfirmar.innerHTML = '<span class="btn-icon">⏳</span>Actualizando...'

  // Actualizar en la base de datos
  db.run("UPDATE productos SET stock = ? WHERE id = ?", [nuevoStock, productoSeleccionadoStock.id], (err) => {
    // Rehabilitar botón
    btnConfirmar.disabled = false
    btnConfirmar.innerHTML = textoOriginal

    if (err) {
      console.error("Error al actualizar stock:", err.message)
      alert("Error al actualizar el stock. Inténtalo nuevamente.")
      return
    }

    // Éxito
    alert(`✅ Stock actualizado exitosamente\n\nStock anterior: ${stockActual}\nStock nuevo: ${nuevoStock}`)

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

    // Actualizar el array de productos originales
    const productoIndex = productosOriginales.findIndex((p) => p.id == productoSeleccionadoStock.id)
    if (productoIndex !== -1) {
      productosOriginales[productoIndex].stock = nuevoStock
    }

    // Cerrar popup
    document.getElementById("popup-actualizar-stock").classList.add("oculto")

    console.log(`Stock actualizado: ${productoSeleccionadoStock.nombre} - ${stockActual} → ${nuevoStock}`)
  })
}

// Cerrar popup de detalles
document.getElementById("cerrar-popup-inv").addEventListener("click", () => {
  document.getElementById("popup-detalles-inv").classList.add("oculto")
})

// Filtros
document.getElementById("search-code").addEventListener("input", filtrarYMostrarProductos)
document.getElementById("search-name").addEventListener("input", filtrarYMostrarProductos)
document.getElementById("search-category").addEventListener("input", filtrarYMostrarProductos)

// Agregar listener para el filtro de ordenamiento por stock
document.getElementById("sort-stock").addEventListener("change", filtrarYMostrarProductos)

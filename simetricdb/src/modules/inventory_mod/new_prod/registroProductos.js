const sqlite3 = require("sqlite3").verbose()

// Conectar a la base de datos unificada
const db = new sqlite3.Database("simetricdb.sqlite", (err) => {
  if (err) {
    console.error("Error al conectar con la base de datos:", err.message)
  } else {
    console.log("Conectado a la base de datos unificada.")
    // Crear tablas necesarias
    crearTablas()
  }
})

// Crear tablas necesarias
function crearTablas() {
  // Tabla productos
  db.run(`
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      codigo TEXT UNIQUE NOT NULL,
      categoria TEXT NOT NULL,
      marca TEXT NOT NULL,
      precio_compra REAL NOT NULL,
      precio_venta REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      unidad TEXT NOT NULL,
      proveedor TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      fecha_registro TEXT NOT NULL
    )`)

  // Tabla lotes con código de lote
  db.run(`
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
      fecha_vencimiento TEXT,
      observaciones TEXT,
      usuario_registro TEXT,
      activo INTEGER DEFAULT 1,
      FOREIGN KEY (producto_id) REFERENCES productos(id)
    )`)

  // Tabla movimientos_stock
  db.run(`
    CREATE TABLE IF NOT EXISTS movimientos_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL,
      lote_id INTEGER,
      tipo_movimiento TEXT NOT NULL,
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
    )`)

  // Crear índice para búsqueda por código de lote
  db.run(`CREATE INDEX IF NOT EXISTS idx_lotes_codigo ON lotes(codigo_lote)`)
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

// Obtener el formulario
document.querySelector("form").addEventListener("submit", (event) => {
  event.preventDefault()

  // Obtener valores del formulario
  const nombre = document.getElementById("nombre").value.trim()
  const codigo = document.getElementById("codigo").value.trim()
  const categoria = document.getElementById("categoria").value.trim()
  const marca = document.getElementById("marca").value.trim()
  const precio_compra = Number.parseFloat(document.getElementById("precio_compra").value)
  const precio_venta = Number.parseFloat((precio_compra * 1.3).toFixed(2))
  const stock_inicial = Number.parseInt(document.getElementById("stock").value) || 0
  const unidad = document.getElementById("unidad").value.trim()
  const proveedor = document.getElementById("proveedor").value.trim()
  const descripcion = document.getElementById("descripcion").value.trim()
  const fecha_registro = obtenerFechaActual()

  // Validar campos requeridos
  if (
    !nombre ||
    !codigo ||
    !categoria ||
    !marca ||
    isNaN(precio_compra) ||
    isNaN(precio_venta) ||
    isNaN(stock_inicial) ||
    !unidad ||
    !proveedor ||
    !descripcion
  ) {
    alert("Por favor completa todos los campos correctamente.")
    return
  }

  // Obtener usuario actual
  const usuarioActual = sessionStorage.getItem("usuarioActual") || "Sistema"

  // NUEVA VALIDACIÓN: Verificar si ya existe un producto con el mismo nombre Y marca
  db.get(
    `SELECT id, nombre, marca FROM productos WHERE LOWER(nombre) = LOWER(?) AND LOWER(marca) = LOWER(?)`,
    [nombre, marca],
    (err, productoExistente) => {
      if (err) {
        console.error("Error verificando producto existente:", err.message)
        alert("Error al verificar la información del producto.")
        return
      }

      if (productoExistente) {
        alert(
          `❌ Error: Ya existe un producto con esas características.\n\n` +
            `Producto existente:\n` +
            `• Nombre: ${productoExistente.nombre}\n` +
            `• Marca: ${productoExistente.marca}\n` +
            `• ID: ${productoExistente.id}\n\n` +
            `Por favor verifica la información o usa el módulo de gestión para agregar stock al producto existente.`,
        )
        return
      }

      // Si no existe producto duplicado, proceder con la inserción
      insertarProducto()
    },
  )

  // Función para insertar el producto
  function insertarProducto() {
    // Insertar en base de datos con transacción
    db.serialize(() => {
      db.run("BEGIN TRANSACTION")

      // 1. Insertar producto
      db.run(
        `INSERT INTO productos
          (nombre, codigo, categoria, marca, precio_compra, precio_venta, stock, unidad, proveedor, descripcion, fecha_registro)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nombre,
          codigo,
          categoria,
          marca,
          precio_compra,
          precio_venta,
          stock_inicial,
          unidad,
          proveedor,
          descripcion,
          fecha_registro,
        ],
        function (err) {
          if (err) {
            console.error("Error al guardar producto:", err.message)
            db.run("ROLLBACK")
            if (err.message.includes("UNIQUE")) {
              alert("❌ Error: Ya existe un producto con ese código.")
            } else {
              alert("Error al guardar el producto.")
            }
            return
          }

          const productoId = this.lastID
          console.log(`✅ Producto creado con ID: ${productoId}`)

          // 2. Si tiene stock inicial, crear lote inicial con código
          if (stock_inicial > 0) {
            // Generar código de lote
            generarCodigoLote(productoId, (err, codigoLote) => {
              if (err) {
                console.error("Error generando código de lote:", err.message)
                db.run("ROLLBACK")
                alert("Error al generar código de lote.")
                return
              }

              db.run(
                `INSERT INTO lotes
                  (producto_id, codigo_lote, cantidad_inicial, cantidad_disponible, precio_compra_unitario,
                   proveedor, fecha_compra, observaciones, usuario_registro)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  productoId,
                  codigoLote,
                  stock_inicial,
                  stock_inicial,
                  precio_compra,
                  proveedor,
                  fecha_registro,
                  "Lote inicial del producto",
                  usuarioActual,
                ],
                function (err) {
                  if (err) {
                    console.error("Error al crear lote inicial:", err.message)
                    db.run("ROLLBACK")
                    alert("Error al crear el lote inicial del producto.")
                    return
                  }

                  const loteId = this.lastID
                  console.log(`✅ Lote inicial creado con código: ${codigoLote}`)

                  // 3. Registrar movimiento de stock
                  db.run(
                    `INSERT INTO movimientos_stock
                      (producto_id, lote_id, tipo_movimiento, cantidad, precio_unitario,
                       motivo, fecha_movimiento, stock_anterior, stock_nuevo, usuario)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                      productoId,
                      loteId,
                      "entrada",
                      stock_inicial,
                      precio_compra,
                      "Stock inicial del producto",
                      fecha_registro,
                      0,
                      stock_inicial,
                      usuarioActual,
                    ],
                    (err) => {
                      if (err) {
                        console.error("Error al registrar movimiento inicial:", err.message)
                        db.run("ROLLBACK")
                        alert("Error al registrar el movimiento inicial.")
                        return
                      }

                      // Confirmar transacción
                      db.run("COMMIT", (err) => {
                        if (err) {
                          console.error("Error al confirmar transacción:", err.message)
                          alert("Error al confirmar el registro.")
                          return
                        }

                        console.log(`✅ Producto registrado exitosamente: ${nombre}`)
                        alert(
                          `✅ Producto registrado exitosamente.\n\n` +
                            `Producto: ${nombre}\n` +
                            `Código: ${codigo}\n` +
                            `Marca: ${marca}\n` +
                            `Stock inicial: ${stock_inicial} ${unidad}\n` +
                            `Código de lote: ${codigoLote}`,
                        )
                        event.target.reset()
                      })
                    },
                  )
                },
              )
            })
          } else {
            // Si no tiene stock inicial, solo confirmar el producto
            db.run("COMMIT", (err) => {
              if (err) {
                console.error("Error al confirmar transacción:", err.message)
                alert("Error al confirmar el registro.")
                return
              }

              console.log(`✅ Producto registrado exitosamente: ${nombre}`)
              alert(
                `✅ Producto registrado exitosamente.\n\n` +
                  `Producto: ${nombre}\n` +
                  `Código: ${codigo}\n` +
                  `Marca: ${marca}\n` +
                  `Sin stock inicial`,
              )
              event.target.reset()
            })
          }
        },
      )
    })
  }
})

function obtenerFechaActual() {
  const hoy = new Date()
  const year = hoy.getFullYear()
  const month = String(hoy.getMonth() + 1).padStart(2, "0")
  const day = String(hoy.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

document.getElementById("codigo").addEventListener("input", (e) => {
  e.target.value = e.target.value.replace(/\D/g, "")
})

document.getElementById("precio_compra").addEventListener("input", () => {
  const precioCompra = Number.parseFloat(document.getElementById("precio_compra").value)
  const campoVenta = document.getElementById("precio_venta")

  if (!isNaN(precioCompra)) {
    const precioVenta = (precioCompra * 1.3).toFixed(2)
    campoVenta.value = precioVenta
  } else {
    campoVenta.value = ""
  }
})

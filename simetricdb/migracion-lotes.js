// Script para migrar la base de datos al sistema de lotes
const sqlite3 = require("sqlite3").verbose()

console.log("🔄 Iniciando migración al sistema de lotes...")

// Conectar a la base de datos
const db = new sqlite3.Database("simetricdb.sqlite", (err) => {
  if (err) {
    console.error("Error conectando a la base de datos:", err.message)
    return
  }
  console.log("✅ Conectado a simetricdb.sqlite")
})

// Función para verificar si una columna existe en una tabla
function verificarColumna(tabla, columna) {
  return new Promise((resolve) => {
    db.all(`PRAGMA table_info(${tabla})`, [], (err, columns) => {
      if (err) {
        console.error(`Error verificando tabla ${tabla}:`, err.message)
        resolve(false)
        return
      }

      const tieneColumna = columns.some((col) => col.name === columna)
      resolve(tieneColumna)
    })
  })
}

// Función para migrar tabla movimientos_stock
async function migrarMovimientosStock() {
  console.log("📋 Verificando tabla movimientos_stock...")

  const tieneLoteId = await verificarColumna("movimientos_stock", "lote_id")
  const tieneMotivo = await verificarColumna("movimientos_stock", "motivo")

  if (!tieneLoteId || !tieneMotivo) {
    console.log("🔧 Actualizando estructura de movimientos_stock...")

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run("BEGIN TRANSACTION")

        // Crear tabla temporal con la nueva estructura
        db.run(
          `
          CREATE TABLE movimientos_stock_new (
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
          )
        `,
          (err) => {
            if (err) {
              console.error("Error creando tabla temporal:", err.message)
              db.run("ROLLBACK")
              reject(err)
              return
            }

            // Copiar datos existentes
            db.run(
              `
            INSERT INTO movimientos_stock_new 
            (id, producto_id, tipo_movimiento, cantidad, precio_unitario, 
             observaciones, fecha_movimiento, stock_anterior, stock_nuevo, usuario)
            SELECT id, producto_id, tipo_movimiento, cantidad, precio_unitario,
                   observaciones, fecha_movimiento, stock_anterior, stock_nuevo, usuario
            FROM movimientos_stock
          `,
              (err) => {
                if (err) {
                  console.error("Error copiando datos:", err.message)
                  db.run("ROLLBACK")
                  reject(err)
                  return
                }

                // Eliminar tabla antigua
                db.run("DROP TABLE movimientos_stock", (err) => {
                  if (err) {
                    console.error("Error eliminando tabla antigua:", err.message)
                    db.run("ROLLBACK")
                    reject(err)
                    return
                  }

                  // Renombrar tabla nueva
                  db.run("ALTER TABLE movimientos_stock_new RENAME TO movimientos_stock", (err) => {
                    if (err) {
                      console.error("Error renombrando tabla:", err.message)
                      db.run("ROLLBACK")
                      reject(err)
                      return
                    }

                    db.run("COMMIT", (err) => {
                      if (err) {
                        console.error("Error confirmando migración:", err.message)
                        reject(err)
                        return
                      }

                      console.log("✅ Tabla movimientos_stock migrada exitosamente")
                      resolve()
                    })
                  })
                })
              },
            )
          },
        )
      })
    })
  } else {
    console.log("✅ Tabla movimientos_stock ya tiene la estructura correcta")
    return Promise.resolve()
  }
}

// Función para crear tabla de lotes
function crearTablaLotes() {
  return new Promise((resolve, reject) => {
    console.log("📦 Verificando tabla lotes...")

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
          reject(err)
          return
        }

        console.log("✅ Tabla lotes verificada/creada")
        resolve()
      },
    )
  })
}

// Función para migrar productos existentes a lotes
function migrarProductosALotes() {
  return new Promise((resolve, reject) => {
    console.log("📊 Migrando productos existentes a sistema de lotes...")

    // Obtener productos con stock > 0
    db.all("SELECT * FROM productos WHERE stock > 0", [], (err, productos) => {
      if (err) {
        console.error("Error obteniendo productos:", err.message)
        reject(err)
        return
      }

      if (productos.length === 0) {
        console.log("✅ No hay productos con stock para migrar")
        resolve()
        return
      }

      console.log(`📦 Migrando ${productos.length} productos con stock...`)

      let productosProcessed = 0
      const fechaHoy = new Date().toISOString().split("T")[0]

      productos.forEach((producto) => {
        // Verificar si ya tiene lotes
        db.get("SELECT COUNT(*) as count FROM lotes WHERE producto_id = ?", [producto.id], (err, result) => {
          if (err) {
            console.error(`Error verificando lotes para producto ${producto.id}:`, err.message)
            productosProcessed++
            if (productosProcessed === productos.length) resolve()
            return
          }

          if (result.count > 0) {
            console.log(`⏭️ Producto ${producto.nombre} ya tiene lotes`)
            productosProcessed++
            if (productosProcessed === productos.length) resolve()
            return
          }

          // Crear lote inicial para el producto
          db.run(
            `
            INSERT INTO lotes 
            (producto_id, cantidad_inicial, cantidad_disponible, precio_compra_unitario, 
             proveedor, fecha_compra, observaciones, usuario_registro)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
            [
              producto.id,
              producto.stock,
              producto.stock,
              producto.precio_compra,
              producto.proveedor || "Migración automática",
              fechaHoy,
              "Lote creado automáticamente durante migración al sistema de lotes",
              "Sistema",
            ],
            function (err) {
              if (err) {
                console.error(`Error creando lote para producto ${producto.nombre}:`, err.message)
              } else {
                console.log(`✅ Lote creado para ${producto.nombre}: ${producto.stock} unidades`)

                // Registrar movimiento
                db.run(
                  `
                INSERT INTO movimientos_stock 
                (producto_id, lote_id, tipo_movimiento, cantidad, precio_unitario, 
                 motivo, fecha_movimiento, stock_anterior, stock_nuevo, usuario)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `,
                  [
                    producto.id,
                    this.lastID,
                    "entrada",
                    producto.stock,
                    producto.precio_compra,
                    "Migración al sistema de lotes",
                    fechaHoy,
                    0,
                    producto.stock,
                    "Sistema",
                  ],
                )
              }

              productosProcessed++
              if (productosProcessed === productos.length) {
                console.log("✅ Migración de productos completada")
                resolve()
              }
            },
          )
        })
      })
    })
  })
}

// Función principal de migración
async function ejecutarMigracion() {
  try {
    console.log("🚀 Iniciando migración completa...")

    // 1. Crear tabla de lotes
    await crearTablaLotes()

    // 2. Migrar tabla movimientos_stock
    await migrarMovimientosStock()

    // 3. Migrar productos existentes a lotes
    await migrarProductosALotes()

    console.log("")
    console.log("🎉 ¡Migración completada exitosamente!")
    console.log("")
    console.log("📊 Resumen:")
    console.log("• ✅ Tabla 'lotes' creada/verificada")
    console.log("• ✅ Tabla 'movimientos_stock' actualizada con columna 'lote_id'")
    console.log("• ✅ Productos existentes migrados a sistema de lotes")
    console.log("")
    console.log("🔄 Ahora puedes:")
    console.log("• Registrar nuevos productos (se crearán lotes automáticamente)")
    console.log("• Realizar nuevas compras (se crearán lotes independientes)")
    console.log("• Ver historial de lotes en gestión de inventario")
    console.log("")
  } catch (error) {
    console.error("❌ Error durante la migración:", error)
  } finally {
    db.close((err) => {
      if (err) {
        console.error("Error cerrando base de datos:", err.message)
      } else {
        console.log("🔒 Base de datos cerrada")
      }
    })
  }
}

// Ejecutar migración
if (require.main === module) {
  ejecutarMigracion()
}

module.exports = { ejecutarMigracion }

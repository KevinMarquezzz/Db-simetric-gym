// Script de migración forzada para solucionar el problema de lote_id
const sqlite3 = require("sqlite3").verbose()

console.log("🔧 MIGRACIÓN FORZADA - Sistema de Lotes")
console.log("=".repeat(50))

const db = new sqlite3.Database("simetricdb.sqlite", (err) => {
  if (err) {
    console.error("❌ Error conectando a la base de datos:", err.message)
    return
  }
  console.log("✅ Conectado a simetricdb.sqlite")
})

// Función para crear respaldo de seguridad
function crearRespaldo() {
  return new Promise((resolve) => {
    const fs = require("fs")
    const fecha = new Date().toISOString().split("T")[0]
    const hora = new Date().toTimeString().split(" ")[0].replace(/:/g, "-")
    const nombreRespaldo = `simetricdb_backup_${fecha}_${hora}.sqlite`

    try {
      fs.copyFileSync("simetricdb.sqlite", nombreRespaldo)
      console.log(`✅ Respaldo creado: ${nombreRespaldo}`)
      resolve()
    } catch (error) {
      console.log(`⚠️ No se pudo crear respaldo: ${error.message}`)
      console.log("Continuando sin respaldo...")
      resolve()
    }
  })
}

// Función para migrar tabla movimientos_stock de forma forzada
function migrarMovimientosStockForzada() {
  return new Promise((resolve, reject) => {
    console.log("\n🔄 Migrando tabla movimientos_stock...")

    db.serialize(() => {
      db.run("BEGIN TRANSACTION")

      // 1. Crear tabla temporal con estructura correcta
      db.run(
        `
        CREATE TABLE movimientos_stock_temp (
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
            console.error("❌ Error creando tabla temporal:", err.message)
            db.run("ROLLBACK")
            reject(err)
            return
          }

          console.log("✅ Tabla temporal creada")

          // 2. Copiar datos existentes (si los hay)
          db.all(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='movimientos_stock'",
            [],
            (err, tables) => {
              if (err) {
                console.error("❌ Error verificando tabla existente:", err.message)
                db.run("ROLLBACK")
                reject(err)
                return
              }

              if (tables.length > 0) {
                // La tabla existe, copiar datos
                console.log("📋 Copiando datos existentes...")

                db.run(
                  `
              INSERT INTO movimientos_stock_temp 
              (id, producto_id, tipo_movimiento, cantidad, precio_unitario, 
               observaciones, fecha_movimiento, stock_anterior, stock_nuevo, usuario)
              SELECT id, producto_id, tipo_movimiento, cantidad, precio_unitario,
                     observaciones, fecha_movimiento, stock_anterior, stock_nuevo, usuario
              FROM movimientos_stock
            `,
                  (err) => {
                    if (err) {
                      console.error("❌ Error copiando datos:", err.message)
                      db.run("ROLLBACK")
                      reject(err)
                      return
                    }

                    console.log("✅ Datos copiados")
                    continuarMigracion()
                  },
                )
              } else {
                // La tabla no existe, continuar
                console.log("📋 Tabla movimientos_stock no existe, creando nueva")
                continuarMigracion()
              }
            },
          )

          function continuarMigracion() {
            // 3. Eliminar tabla antigua (si existe)
            db.run("DROP TABLE IF EXISTS movimientos_stock", (err) => {
              if (err) {
                console.error("❌ Error eliminando tabla antigua:", err.message)
                db.run("ROLLBACK")
                reject(err)
                return
              }

              console.log("✅ Tabla antigua eliminada")

              // 4. Renombrar tabla temporal
              db.run("ALTER TABLE movimientos_stock_temp RENAME TO movimientos_stock", (err) => {
                if (err) {
                  console.error("❌ Error renombrando tabla:", err.message)
                  db.run("ROLLBACK")
                  reject(err)
                  return
                }

                console.log("✅ Tabla renombrada")

                // 5. Confirmar transacción
                db.run("COMMIT", (err) => {
                  if (err) {
                    console.error("❌ Error confirmando migración:", err.message)
                    reject(err)
                    return
                  }

                  console.log("✅ Tabla movimientos_stock migrada exitosamente")
                  resolve()
                })
              })
            })
          }
        },
      )
    })
  })
}

// Función para crear tabla lotes
function crearTablaLotes() {
  return new Promise((resolve, reject) => {
    console.log("\n📦 Verificando/creando tabla lotes...")

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
          console.error("❌ Error creando tabla lotes:", err.message)
          reject(err)
          return
        }

        console.log("✅ Tabla lotes verificada/creada")
        resolve()
      },
    )
  })
}

// Función para migrar productos existentes
function migrarProductosExistentes() {
  return new Promise((resolve) => {
    console.log("\n📊 Migrando productos existentes...")

    db.all("SELECT * FROM productos WHERE stock > 0", [], (err, productos) => {
      if (err) {
        console.error("❌ Error obteniendo productos:", err.message)
        resolve()
        return
      }

      if (productos.length === 0) {
        console.log("✅ No hay productos con stock para migrar")
        resolve()
        return
      }

      console.log(`📦 Encontrados ${productos.length} productos con stock`)

      let procesados = 0
      const fechaHoy = new Date().toISOString().split("T")[0]

      productos.forEach((producto) => {
        // Verificar si ya tiene lotes
        db.get("SELECT COUNT(*) as count FROM lotes WHERE producto_id = ?", [producto.id], (err, result) => {
          if (err) {
            console.error(`❌ Error verificando lotes para ${producto.nombre}:`, err.message)
            procesados++
            if (procesados === productos.length) resolve()
            return
          }

          if (result.count > 0) {
            console.log(`⏭️ ${producto.nombre} ya tiene lotes`)
            procesados++
            if (procesados === productos.length) resolve()
            return
          }

          // Crear lote inicial
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
              "Lote creado durante migración al sistema de lotes",
              "Sistema",
            ],
            function (err) {
              if (err) {
                console.error(`❌ Error creando lote para ${producto.nombre}:`, err.message)
              } else {
                console.log(`✅ Lote creado para ${producto.nombre}: ${producto.stock} unidades`)

                // Crear movimiento
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

              procesados++
              if (procesados === productos.length) {
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

// Función principal
async function ejecutarMigracionForzada() {
  try {
    console.log("🚀 Iniciando migración forzada...")

    // 1. Crear respaldo
    await crearRespaldo()

    // 2. Migrar tabla movimientos_stock
    await migrarMovimientosStockForzada()

    // 3. Crear tabla lotes
    await crearTablaLotes()

    // 4. Migrar productos existentes
    await migrarProductosExistentes()

    console.log("\n" + "=".repeat(50))
    console.log("🎉 ¡MIGRACIÓN FORZADA COMPLETADA!")
    console.log("=".repeat(50))
    console.log("✅ Tabla movimientos_stock actualizada con columna lote_id")
    console.log("✅ Tabla lotes creada/verificada")
    console.log("✅ Productos existentes migrados")
    console.log("\n💡 Ahora puedes:")
    console.log("   • Registrar nuevos productos")
    console.log("   • Realizar nuevas compras")
    console.log("   • Ver historial de lotes")
    console.log("\n🧪 Prueba registrando un producto nuevo para verificar")
  } catch (error) {
    console.error("❌ Error durante la migración forzada:", error)
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

// Ejecutar migración forzada
if (require.main === module) {
  ejecutarMigracionForzada()
}

module.exports = { ejecutarMigracionForzada }

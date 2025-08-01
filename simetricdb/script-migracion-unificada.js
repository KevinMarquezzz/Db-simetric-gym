// Script para migrar datos de las bases de datos separadas a la unificada
const sqlite3 = require("sqlite3").verbose()
const fs = require("fs")

console.log("🔄 Iniciando migración a base de datos unificada...")

// Conectar a la base de datos unificada
const dbUnificada = new sqlite3.Database("simetricdb.sqlite", (err) => {
  if (err) {
    console.error("Error conectando a base unificada:", err.message)
    return
  }
  console.log("✅ Conectado a simetricdb.sqlite")
})

// Función para migrar datos de inventario.sqlite
function migrarInventario() {
  if (!fs.existsSync("inventario.sqlite")) {
    console.log("⏭️ No se encontró inventario.sqlite, saltando migración de productos")
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const dbInventario = new sqlite3.Database("inventario.sqlite", (err) => {
      if (err) {
        console.log("⚠️ Error conectando a inventario.sqlite:", err.message)
        resolve()
        return
      }

      console.log("📦 Migrando productos desde inventario.sqlite...")

      // Crear tabla productos en la base unificada
      dbUnificada.run(
        `CREATE TABLE IF NOT EXISTS productos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        codigo TEXT UNIQUE NOT NULL,
        categoria TEXT NOT NULL,
        marca TEXT NOT NULL,
        precio_compra REAL NOT NULL,
        precio_venta REAL NOT NULL,
        stock INTEGER NOT NULL,
        unidad TEXT NOT NULL,
        proveedor TEXT NOT NULL,
        descripcion TEXT NOT NULL,
        fecha_registro TEXT NOT NULL
      )`,
        (err) => {
          if (err) {
            console.error("Error creando tabla productos:", err.message)
            resolve()
            return
          }

          // Obtener todos los productos
          dbInventario.all("SELECT * FROM productos", [], (err, productos) => {
            if (err) {
              console.error("Error obteniendo productos:", err.message)
              resolve()
              return
            }

            if (productos.length === 0) {
              console.log("📦 No hay productos para migrar")
              dbInventario.close()
              resolve()
              return
            }

            let productosInsertados = 0
            let erroresInsercion = 0

            productos.forEach((producto) => {
              dbUnificada.run(
                `
              INSERT OR IGNORE INTO productos 
              (nombre, codigo, categoria, marca, precio_compra, precio_venta, stock, unidad, proveedor, descripcion, fecha_registro)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
                [
                  producto.nombre,
                  producto.codigo,
                  producto.categoria,
                  producto.marca,
                  producto.precio_compra,
                  producto.precio_venta,
                  producto.stock,
                  producto.unidad,
                  producto.proveedor,
                  producto.descripcion,
                  producto.fecha_registro,
                ],
                (err) => {
                  if (err) {
                    erroresInsercion++
                    console.log(`⚠️ Error insertando producto ${producto.codigo}:`, err.message)
                  } else {
                    productosInsertados++
                  }

                  // Verificar si terminamos
                  if (productosInsertados + erroresInsercion === productos.length) {
                    console.log(`✅ Productos migrados: ${productosInsertados}/${productos.length}`)
                    if (erroresInsercion > 0) {
                      console.log(`⚠️ Errores en inserción: ${erroresInsercion}`)
                    }
                    dbInventario.close()
                    resolve()
                  }
                },
              )
            })
          })
        },
      )
    })
  })
}

// Función para migrar datos de database.db
function migrarUsuarios() {
  if (!fs.existsSync("database.db")) {
    console.log("⏭️ No se encontró database.db, saltando migración de usuarios")
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const dbUsuarios = new sqlite3.Database("database.db", (err) => {
      if (err) {
        console.log("⚠️ Error conectando a database.db:", err.message)
        resolve()
        return
      }

      console.log("👥 Migrando usuarios desde database.db...")

      // Crear tabla usuarios en la base unificada
      dbUnificada.run(
        `CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario TEXT UNIQUE NOT NULL,
        clave TEXT NOT NULL
      )`,
        (err) => {
          if (err) {
            console.error("Error creando tabla usuarios:", err.message)
            resolve()
            return
          }

          // Obtener todos los usuarios
          dbUsuarios.all("SELECT * FROM usuarios", [], (err, usuarios) => {
            if (err) {
              console.error("Error obteniendo usuarios:", err.message)
              resolve()
              return
            }

            if (usuarios.length === 0) {
              console.log("👥 No hay usuarios para migrar")
              dbUsuarios.close()
              resolve()
              return
            }

            let usuariosInsertados = 0
            let erroresInsercion = 0

            usuarios.forEach((usuario) => {
              dbUnificada.run(
                `
              INSERT OR IGNORE INTO usuarios (usuario, clave)
              VALUES (?, ?)
            `,
                [usuario.usuario, usuario.clave],
                (err) => {
                  if (err) {
                    erroresInsercion++
                    console.log(`⚠️ Error insertando usuario ${usuario.usuario}:`, err.message)
                  } else {
                    usuariosInsertados++
                  }

                  // Verificar si terminamos
                  if (usuariosInsertados + erroresInsercion === usuarios.length) {
                    console.log(`✅ Usuarios migrados: ${usuariosInsertados}/${usuarios.length}`)
                    if (erroresInsercion > 0) {
                      console.log(`⚠️ Errores en inserción: ${erroresInsercion}`)
                    }
                    dbUsuarios.close()
                    resolve()
                  }
                },
              )
            })
          })
        },
      )
    })
  })
}

// Función para crear respaldo de bases de datos antiguas
function crearRespaldos() {
  const fecha = new Date().toISOString().split("T")[0]

  if (fs.existsSync("inventario.sqlite")) {
    try {
      fs.copyFileSync("inventario.sqlite", `inventario_backup_${fecha}.sqlite`)
      console.log("📋 Respaldo creado: inventario_backup_" + fecha + ".sqlite")
    } catch (error) {
      console.log("⚠️ Error creando respaldo de inventario:", error.message)
    }
  }

  if (fs.existsSync("database.db")) {
    try {
      fs.copyFileSync("database.db", `database_backup_${fecha}.db`)
      console.log("📋 Respaldo creado: database_backup_" + fecha + ".db")
    } catch (error) {
      console.log("⚠️ Error creando respaldo de database:", error.message)
    }
  }
}

// Ejecutar migración
async function ejecutarMigracion() {
  try {
    console.log("📋 Creando respaldos de seguridad...")
    crearRespaldos()

    console.log("🔄 Iniciando migración de datos...")

    await migrarInventario()
    await migrarUsuarios()

    console.log("✅ Migración completada exitosamente!")
    console.log("")
    console.log("📊 Resumen:")
    console.log("• Todas las tablas ahora están en simetricdb.sqlite")
    console.log("• Se crearon respaldos de las bases de datos originales")
    console.log("• Los archivos originales pueden eliminarse después de verificar")
    console.log("")
    console.log("🗑️ Para limpiar archivos antiguos (opcional):")
    console.log("• Eliminar inventario.sqlite")
    console.log("• Eliminar database.db")
    console.log("")
  } catch (error) {
    console.error("❌ Error durante la migración:", error)
  } finally {
    dbUnificada.close()
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  ejecutarMigracion()
}

module.exports = { ejecutarMigracion }

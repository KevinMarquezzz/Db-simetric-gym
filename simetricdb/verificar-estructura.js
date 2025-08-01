// Script para verificar y mostrar la estructura actual de las tablas
const sqlite3 = require("sqlite3").verbose()

console.log("🔍 Verificando estructura actual de la base de datos...")

const db = new sqlite3.Database("simetricdb.sqlite", (err) => {
  if (err) {
    console.error("Error conectando a la base de datos:", err.message)
    return
  }
  console.log("✅ Conectado a simetricdb.sqlite")
})

// Función para mostrar estructura de una tabla
function mostrarEstructuraTabla(nombreTabla) {
  return new Promise((resolve) => {
    console.log(`\n📋 Estructura de la tabla '${nombreTabla}':`)
    console.log("=".repeat(50))

    db.all(`PRAGMA table_info(${nombreTabla})`, [], (err, columns) => {
      if (err) {
        console.log(`❌ Error: La tabla '${nombreTabla}' no existe o hay un problema`)
        console.log(`   ${err.message}`)
        resolve()
        return
      }

      if (columns.length === 0) {
        console.log(`❌ La tabla '${nombreTabla}' no existe`)
        resolve()
        return
      }

      console.log("Columnas encontradas:")
      columns.forEach((col, index) => {
        const required = col.notnull ? "NOT NULL" : "NULL"
        const pk = col.pk ? "(PRIMARY KEY)" : ""
        console.log(`  ${index + 1}. ${col.name} - ${col.type} ${required} ${pk}`)
      })

      // Verificar columnas específicas importantes
      if (nombreTabla === "movimientos_stock") {
        const tieneLoteId = columns.some((col) => col.name === "lote_id")
        const tieneMotivo = columns.some((col) => col.name === "motivo")

        console.log("\n🔍 Verificación específica:")
        console.log(`   • Columna 'lote_id': ${tieneLoteId ? "✅ EXISTE" : "❌ NO EXISTE"}`)
        console.log(`   • Columna 'motivo': ${tieneMotivo ? "✅ EXISTE" : "❌ NO EXISTE"}`)

        if (!tieneLoteId || !tieneMotivo) {
          console.log("   ⚠️ LA TABLA NECESITA MIGRACIÓN")
        } else {
          console.log("   ✅ LA TABLA ESTÁ ACTUALIZADA")
        }
      }

      resolve()
    })
  })
}

// Función para contar registros en una tabla
function contarRegistros(nombreTabla) {
  return new Promise((resolve) => {
    db.get(`SELECT COUNT(*) as count FROM ${nombreTabla}`, [], (err, result) => {
      if (err) {
        console.log(`❌ Error contando registros en '${nombreTabla}': ${err.message}`)
        resolve()
        return
      }
      console.log(`📊 Registros en '${nombreTabla}': ${result.count}`)
      resolve()
    })
  })
}

// Función principal
async function verificarEstructura() {
  try {
    console.log("🏋️ SIMETRIC GYM - Verificación de Base de Datos")
    console.log("=".repeat(60))

    // Verificar tablas principales
    await mostrarEstructuraTabla("productos")
    await contarRegistros("productos")

    await mostrarEstructuraTabla("lotes")
    await contarRegistros("lotes")

    await mostrarEstructuraTabla("movimientos_stock")
    await contarRegistros("movimientos_stock")

    console.log("\n" + "=".repeat(60))
    console.log("🎯 DIAGNÓSTICO:")

    // Verificar si movimientos_stock tiene la estructura correcta
    db.all("PRAGMA table_info(movimientos_stock)", [], (err, columns) => {
      if (err) {
        console.log("❌ No se puede verificar movimientos_stock")
        return
      }

      const tieneLoteId = columns.some((col) => col.name === "lote_id")
      const tieneMotivo = columns.some((col) => col.name === "motivo")

      if (!tieneLoteId || !tieneMotivo) {
        console.log("❌ PROBLEMA: La tabla movimientos_stock necesita migración")
        console.log("💡 SOLUCIÓN: Ejecutar 'node migracion-lotes-forzada.js'")
      } else {
        console.log("✅ La estructura de la base de datos está correcta")
        console.log("💡 Si sigues teniendo problemas, verifica el código de registro")
      }

      db.close()
    })
  } catch (error) {
    console.error("❌ Error durante la verificación:", error)
    db.close()
  }
}

// Ejecutar verificación
if (require.main === module) {
  verificarEstructura()
}

module.exports = { verificarEstructura }

// Script para probar el registro de productos después de la migración
const sqlite3 = require("sqlite3").verbose()

console.log("🧪 PRUEBA - Registro de Producto")
console.log("=".repeat(40))

const db = new sqlite3.Database("simetricdb.sqlite", (err) => {
  if (err) {
    console.error("❌ Error conectando:", err.message)
    return
  }
  console.log("✅ Conectado a la base de datos")
})

// Datos de prueba
const productoTest = {
  nombre: "Proteína Test",
  codigo: "TEST001",
  categoria: "suplemento",
  marca: "TestBrand",
  precio_compra: 25.0,
  precio_venta: 32.5,
  stock_inicial: 10,
  unidad: "unidad",
  proveedor: "Proveedor Test",
  descripcion: "Producto de prueba para verificar migración",
  fecha_registro: new Date().toISOString().split("T")[0],
  usuario: "TestUser",
}

function probarRegistro() {
  console.log("📦 Registrando producto de prueba...")
  console.log(`   Nombre: ${productoTest.nombre}`)
  console.log(`   Stock inicial: ${productoTest.stock_inicial}`)

  db.serialize(() => {
    db.run("BEGIN TRANSACTION")

    // 1. Insertar producto
    db.run(
      `
      INSERT INTO productos 
      (nombre, codigo, categoria, marca, precio_compra, precio_venta, stock, unidad, proveedor, descripcion, fecha_registro)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        productoTest.nombre,
        productoTest.codigo,
        productoTest.categoria,
        productoTest.marca,
        productoTest.precio_compra,
        productoTest.precio_venta,
        productoTest.stock_inicial,
        productoTest.unidad,
        productoTest.proveedor,
        productoTest.descripcion,
        productoTest.fecha_registro,
      ],
      function (err) {
        if (err) {
          console.error("❌ Error insertando producto:", err.message)
          db.run("ROLLBACK")
          return
        }

        const productoId = this.lastID
        console.log(`✅ Producto insertado con ID: ${productoId}`)

        // 2. Crear lote inicial
        db.run(
          `
        INSERT INTO lotes 
        (producto_id, cantidad_inicial, cantidad_disponible, precio_compra_unitario, 
         proveedor, fecha_compra, observaciones, usuario_registro)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
          [
            productoId,
            productoTest.stock_inicial,
            productoTest.stock_inicial,
            productoTest.precio_compra,
            productoTest.proveedor,
            productoTest.fecha_registro,
            "Lote inicial de prueba",
            productoTest.usuario,
          ],
          function (err) {
            if (err) {
              console.error("❌ Error creando lote:", err.message)
              db.run("ROLLBACK")
              return
            }

            const loteId = this.lastID
            console.log(`✅ Lote creado con ID: ${loteId}`)

            // 3. Registrar movimiento
            db.run(
              `
          INSERT INTO movimientos_stock 
          (producto_id, lote_id, tipo_movimiento, cantidad, precio_unitario, 
           motivo, fecha_movimiento, stock_anterior, stock_nuevo, usuario)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
              [
                productoId,
                loteId,
                "entrada",
                productoTest.stock_inicial,
                productoTest.precio_compra,
                "Stock inicial de prueba",
                productoTest.fecha_registro,
                0,
                productoTest.stock_inicial,
                productoTest.usuario,
              ],
              (err) => {
                if (err) {
                  console.error("❌ Error registrando movimiento:", err.message)
                  db.run("ROLLBACK")
                  return
                }

                console.log("✅ Movimiento registrado")

                // 4. Confirmar transacción
                db.run("COMMIT", (err) => {
                  if (err) {
                    console.error("❌ Error confirmando transacción:", err.message)
                    return
                  }

                  console.log("\n🎉 ¡PRUEBA EXITOSA!")
                  console.log("=".repeat(40))
                  console.log("✅ Producto registrado correctamente")
                  console.log("✅ Lote inicial creado")
                  console.log("✅ Movimiento de stock registrado")
                  console.log("✅ La migración funcionó correctamente")

                  // Verificar stock calculado
                  verificarStock(productoId)
                })
              },
            )
          },
        )
      },
    )
  })
}

function verificarStock(productoId) {
  console.log("\n🔍 Verificando cálculo de stock...")

  const query = `
    SELECT 
      p.nombre,
      p.stock as stock_tabla,
      COALESCE(SUM(l.cantidad_disponible), 0) as stock_calculado
    FROM productos p
    LEFT JOIN lotes l ON p.id = l.producto_id AND l.activo = 1
    WHERE p.id = ?
    GROUP BY p.id
  `

  db.get(query, [productoId], (err, result) => {
    if (err) {
      console.error("❌ Error verificando stock:", err.message)
      return
    }

    console.log(`📊 Producto: ${result.nombre}`)
    console.log(`   Stock en tabla productos: ${result.stock_tabla}`)
    console.log(`   Stock calculado desde lotes: ${result.stock_calculado}`)

    if (result.stock_tabla === result.stock_calculado) {
      console.log("✅ Los stocks coinciden - Sistema funcionando correctamente")
    } else {
      console.log("⚠️ Los stocks no coinciden - Revisar configuración")
    }

    // Limpiar producto de prueba
    limpiarPrueba(productoId)
  })
}

function limpiarPrueba(productoId) {
  console.log("\n🧹 Limpiando datos de prueba...")

  db.serialize(() => {
    db.run("DELETE FROM movimientos_stock WHERE producto_id = ?", [productoId])
    db.run("DELETE FROM lotes WHERE producto_id = ?", [productoId])
    db.run("DELETE FROM productos WHERE id = ?", [productoId], (err) => {
      if (err) {
        console.error("❌ Error limpiando:", err.message)
      } else {
        console.log("✅ Datos de prueba eliminados")
      }

      console.log("\n🎯 RESULTADO: El sistema está listo para usar")
      db.close()
    })
  })
}

// Ejecutar prueba
if (require.main === module) {
  probarRegistro()
}

module.exports = { probarRegistro }

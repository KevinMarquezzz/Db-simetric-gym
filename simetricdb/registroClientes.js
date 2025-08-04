const sqlite3 = require("sqlite3").verbose()

// Conectamos a la base de datos unificada
const db = new sqlite3.Database("simetricdb.sqlite", (err) => {
  if (err) {
    console.error(err.message)
  }
  console.log("Conectado a la base de datos unificada.")
})

// Crear tabla de membresías si no existe
db.run(`CREATE TABLE IF NOT EXISTS membresias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT UNIQUE NOT NULL,
  precio_usd REAL NOT NULL,
  duracion_dias INTEGER NOT NULL,
  descripcion TEXT)`)

// Insertar membresías por defecto si no existen
db.run(`INSERT OR IGNORE INTO membresias (nombre, precio_usd, duracion_dias, descripcion) VALUES 
  ('mensual', 40.00, 30, 'Plan Mensual'),
  ('diario', 4.00, 1, 'Plan Diario'),
  ('semanal', 12.00, 7, 'Plan Semanal'),
  ('especial', 30.00, 30, 'Plan Especial'),
  ('parejas', 65.00, 30, 'Plan Parejas'),
  ('familiar', 90.00, 30, 'Plan Familiar'),
  ('estudiantil', 70.00, 30, 'Plan Estudiantil')`)

// Crear tabla de clientes actualizada con apellido y referencia a membresía
db.run(`CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  cedula TEXT UNIQUE NOT NULL,
  telefono TEXT UNIQUE NOT NULL,
  direccion TEXT NOT NULL,
  mail TEXT NOT NULL,
  membresia_id INTEGER NOT NULL,
  fecha_registro TEXT NOT NULL,
  fecha_vencimiento TEXT NOT NULL,
  monto_dolares REAL NOT NULL,
  tasa_dia REAL NOT NULL,
  monto_bs REAL NOT NULL,
  metodo_pago TEXT NOT NULL,
  referencia TEXT,
  FOREIGN KEY (membresia_id) REFERENCES membresias(id))`)

// Crear tabla de pagos (historial) si no existe
db.run(`CREATE TABLE IF NOT EXISTS pagos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL,
  fecha_pago TEXT NOT NULL,
  monto_dolares REAL NOT NULL,
  tasa_dia REAL NOT NULL,
  monto_bs REAL NOT NULL,
  metodo_pago TEXT NOT NULL,
  membresia_id INTEGER NOT NULL,
  referencia TEXT,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  FOREIGN KEY (membresia_id) REFERENCES membresias(id))`)

// Crear tabla de productos (inventario) si no existe
db.run(`CREATE TABLE IF NOT EXISTS productos (
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
  fecha_registro TEXT NOT NULL)`)

// Crear tabla de usuarios (administradoras) si no existe
db.run(`CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario TEXT UNIQUE NOT NULL,
  clave TEXT NOT NULL)`)

// CONSTANTE GLOBAL: Definir IVA_RATE al inicio del archivo
const IVA_RATE = 0.16

// Función para cargar membresías dinámicamente en el selector
function cargarMembresiasDinamicamente() {
  const selectMembresia = document.getElementById("membresia")

  if (!selectMembresia) {
    console.error("No se encontró el select de membresías")
    return
  }

  // Limpiar opciones existentes excepto la primera
  const primeraOpcion = selectMembresia.querySelector('option[value=""]')
  selectMembresia.innerHTML = ""

  if (primeraOpcion) {
    selectMembresia.appendChild(primeraOpcion)
  } else {
    // Crear opción por defecto si no existe
    const opcionDefault = document.createElement("option")
    opcionDefault.value = ""
    opcionDefault.textContent = "Seleccionar"
    selectMembresia.appendChild(opcionDefault)
  }

  // Cargar membresías desde la base de datos con información completa
  const query = `SELECT nombre, descripcion, precio_usd, duracion_dias FROM membresias ORDER BY nombre`

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Error cargando membresías:", err.message)
      return
    }

    rows.forEach((membresia) => {
      const option = document.createElement("option")
      option.value = membresia.nombre
      option.textContent =
        membresia.descripcion || `Plan ${membresia.nombre.charAt(0).toUpperCase() + membresia.nombre.slice(1)}`
      selectMembresia.appendChild(option)
    })

    console.log(`${rows.length} membresías cargadas en el selector`)
  })
}

// Función para cargar tasa automáticamente al iniciar
function cargarTasaAutomatica() {
  db.get("SELECT valor FROM configuraciones WHERE clave = 'tasa_dia'", [], (err, row) => {
    if (err) {
      console.error("Error cargando tasa:", err.message)
      return
    }

    if (row) {
      document.getElementById("tasa_dia").value = row.valor
      calcularIVAyMostrarDesglose() // Recalcular si hay monto
    }
  })

  // Cargar membresías dinámicamente
  cargarMembresiasDinamicamente()
}

// Función para migrar datos existentes (si los hay)
function migrarDatosExistentes() {
  // Verificar si existe la columna apellido
  db.all("PRAGMA table_info(clientes)", [], (err, columns) => {
    if (err) {
      console.error("Error verificando estructura de tabla:", err.message)
      return
    }

    const tieneApellido = columns.some((col) => col.name === "apellido")
    const tieneMembresia = columns.some((col) => col.name === "membresia")
    const tieneMembresiaId = columns.some((col) => col.name === "membresia_id")

    if (tieneMembresia && !tieneMembresiaId) {
      console.log("🔄 Migrando datos existentes...")

      // Agregar columna apellido si no existe
      if (!tieneApellido) {
        db.run(`ALTER TABLE clientes ADD COLUMN apellido TEXT DEFAULT ''`, (err) => {
          if (err && !err.message.includes("duplicate column")) {
            console.error("Error agregando columna apellido:", err.message)
          }
        })
      }

      // Agregar columna membresia_id si no existe
      db.run(`ALTER TABLE clientes ADD COLUMN membresia_id INTEGER DEFAULT 1`, (err) => {
        if (err && !err.message.includes("duplicate column")) {
          console.error("Error agregando columna membresia_id:", err.message)
        } else {
          // Migrar datos de membresía existentes
          db.all("SELECT id, membresia FROM clientes WHERE membresia IS NOT NULL", [], (err, clientes) => {
            if (err) return

            clientes.forEach((cliente) => {
              db.get("SELECT id FROM membresias WHERE nombre = ?", [cliente.membresia], (err, membresia) => {
                if (!err && membresia) {
                  db.run("UPDATE clientes SET membresia_id = ? WHERE id = ?", [membresia.id, cliente.id])
                }
              })
            })
          })
        }
      })
    }
  })
}

// Función para migrar tabla de pagos
function migrarTablaPagos() {
  db.all("PRAGMA table_info(pagos)", [], (err, columns) => {
    if (err) {
      console.error("Error verificando estructura de pagos:", err.message)
      return
    }

    const tieneMembresiaId = columns.some((col) => col.name === "membresia_id")
    const tieneMembresia = columns.some((col) => col.name === "membresia")

    if (tieneMembresia && !tieneMembresiaId) {
      console.log("🔄 Migrando tabla de pagos...")

      // Agregar columna membresia_id
      db.run(`ALTER TABLE pagos ADD COLUMN membresia_id INTEGER`, (err) => {
        if (err && !err.message.includes("duplicate column")) {
          console.error("Error agregando columna membresia_id a pagos:", err.message)
        } else {
          // Migrar datos existentes
          db.all("SELECT id, membresia FROM pagos WHERE membresia IS NOT NULL", [], (err, pagos) => {
            if (err) return

            pagos.forEach((pago) => {
              db.get("SELECT id FROM membresias WHERE nombre = ?", [pago.membresia], (err, membresia) => {
                if (!err && membresia) {
                  db.run("UPDATE pagos SET membresia_id = ? WHERE id = ?", [membresia.id, pago.id])
                }
              })
            })
          })
        }
      })
    }
  })
}

// Ejecutar migración
migrarDatosExistentes()
// Llamar la función después de migrarDatosExistentes()
migrarTablaPagos()

// FUNCIÓN CORREGIDA: Determinar si una membresía es mensual basándose en duración
function esMembresiaMensualPorDuracion(duracionDias) {
  // Una membresía es mensual si tiene 30 días de duración
  return duracionDias === 30
}

// Función mejorada para calcular IVA y mostrar desglose
function calcularIVAyMostrarDesglose() {
  const montoTotal = Number.parseFloat(document.getElementById("monto_dolares").value) || 0
  const tasa = Number.parseFloat(document.getElementById("tasa_dia").value) || 0

  if (montoTotal > 0) {
    // Calcular montos con IVA del 16%
    const montoSinIVA = montoTotal / (1 + IVA_RATE)
    const montoIVA = montoTotal - montoSinIVA

    // Calcular en bolívares
    const totalBs = montoTotal * tasa
    const sinIVABs = montoSinIVA * tasa
    const ivaBs = montoIVA * tasa

    // Actualizar campos
    document.getElementById("monto_bs").value = totalBs.toFixed(2)

    // Mostrar desglose visual
    mostrarDesgloseIVA(montoSinIVA, montoIVA, montoTotal, sinIVABs, ivaBs, totalBs)
  } else {
    document.getElementById("monto_bs").value = ""
    ocultarDesgloseIVA()
  }
}

// FUNCIÓN CORREGIDA: Función mejorada para mostrar el desglose de IVA en la interfaz
function mostrarDesgloseIVA(sinIVA, iva, total, sinIVABs, ivaBs, totalBs) {
  const desgloseContainer = document.getElementById("desglose-container")
  const tipoMembresia = document.getElementById("membresia").value

  // CORRECCIÓN: Obtener información completa de la membresía desde la base de datos
  db.get("SELECT duracion_dias FROM membresias WHERE nombre = ?", [tipoMembresia], (err, membresiaInfo) => {
    if (err) {
      console.error("Error obteniendo información de membresía:", err.message)
      return
    }

    // Determinar si es mensual basándose en la duración de días
    const esMensual = membresiaInfo ? esMembresiaMensualPorDuracion(membresiaInfo.duracion_dias) : false

    // Obtener la tasa desde el input
    const tasa = Number.parseFloat(document.getElementById("tasa_dia").value) || 0

    // Mostrar el contenedor
    desgloseContainer.style.display = "block"

    let contenidoDesglose = `
      <div class="desglose-iva">
        <div class="desglose-header">
          <h4>💰 Desglose de Pago (IVA 16%)</h4>
        </div>
    `

    if (esMensual) {
      // Para membresías mensuales con inscripción
      const inscripcion = 5.0
      const precioMembresiaConIVA = total - inscripcion
      const precioMembresiaSinIVA = precioMembresiaConIVA / (1 + IVA_RATE)
      const ivaMembresia = precioMembresiaConIVA - precioMembresiaSinIVA

      const inscripcionBs = inscripcion * tasa
      const membresiaSinIVABs = precioMembresiaSinIVA * tasa
      const ivaMembresiaBS = ivaMembresia * tasa

      contenidoDesglose += `
        <div class="desglose-content-vertical">
          <div class="desglose-item-vertical">
            <span class="desglose-label">Membresía (sin IVA):</span>
            <div class="desglose-valores">
              <span class="desglose-value">$${precioMembresiaSinIVA.toFixed(2)} USD</span>
              <span class="desglose-value-bs">(${membresiaSinIVABs.toFixed(2)} Bs)</span>
            </div>
          </div>
          <div class="desglose-item-vertical">
            <span class="desglose-label">IVA Membresía (16%):</span>
            <div class="desglose-valores">
              <span class="desglose-value">$${ivaMembresia.toFixed(2)} USD</span>
              <span class="desglose-value-bs">(${ivaMembresiaBS.toFixed(2)} Bs)</span>
            </div>
          </div>
          <div class="desglose-item-vertical inscripcion">
            <span class="desglose-label">Inscripción:</span>
            <div class="desglose-valores">
              <span class="desglose-value">$${inscripcion.toFixed(2)} USD</span>
              <span class="desglose-value-bs">(${inscripcionBs.toFixed(2)} Bs)</span>
            </div>
          </div>
          <div class="desglose-item-vertical total">
            <span class="desglose-label">Total a Pagar:</span>
            <div class="desglose-valores">
              <span class="desglose-value">$${total.toFixed(2)} USD</span>
              <span class="desglose-value-bs">(${totalBs.toFixed(2)} Bs)</span>
            </div>
          </div>
        </div>
      `
    } else {
      // Para membresías no mensuales (sin inscripción)
      const montoSinIVA = total / (1 + IVA_RATE)
      const montoIVA = total - montoSinIVA
      const sinIVABs = montoSinIVA * tasa
      const ivaBs = montoIVA * tasa

      contenidoDesglose += `
        <div class="desglose-content-vertical">
          <div class="desglose-item-vertical">
            <span class="desglose-label">Subtotal (sin IVA):</span>
            <div class="desglose-valores">
              <span class="desglose-value">$${montoSinIVA.toFixed(2)} USD</span>
              <span class="desglose-value-bs">(${sinIVABs.toFixed(2)} Bs)</span>
            </div>
          </div>
          <div class="desglose-item-vertical">
            <span class="desglose-label">IVA (16%):</span>
            <div class="desglose-valores">
              <span class="desglose-value">$${iva.toFixed(2)} USD</span>
              <span class="desglose-value-bs">(${ivaBs.toFixed(2)} Bs)</span>
            </div>
          </div>
          <div class="desglose-item-vertical total">
            <span class="desglose-label">Total a Pagar:</span>
            <div class="desglose-valores">
              <span class="desglose-value">$${total.toFixed(2)} USD</span>
              <span class="desglose-value-bs">(${totalBs.toFixed(2)} Bs)</span>
            </div>
          </div>
        </div>
      `
    }

    contenidoDesglose += `</div>`
    desgloseContainer.innerHTML = contenidoDesglose
  })
}

// Función mejorada para ocultar el desglose
function ocultarDesgloseIVA() {
  const desgloseContainer = document.getElementById("desglose-container")
  if (desgloseContainer) {
    desgloseContainer.style.display = "none"
    desgloseContainer.innerHTML = ""
  }
}

// Event listeners actualizados
document.getElementById("tasa_dia").addEventListener("input", calcularIVAyMostrarDesglose)
document.getElementById("monto_dolares").addEventListener("input", calcularIVAyMostrarDesglose)

// Función original mantenida para compatibilidad
function calcularBs() {
  calcularIVAyMostrarDesglose()
}

// EVENTO CORREGIDO: Cambio de membresía con lógica mejorada
document.getElementById("membresia").addEventListener("change", function () {
  const tipo = this.value
  const montoInput = document.getElementById("monto_dolares")

  // Obtener precio y duración desde la base de datos
  db.get("SELECT precio_usd, duracion_dias FROM membresias WHERE nombre = ?", [tipo], (err, membresia) => {
    if (err) {
      console.error("Error obteniendo precio de membresía:", err.message)
      return
    }

    if (membresia) {
      // CORRECCIÓN: Determinar si es membresía mensual basándose en duración de días
      const esMensual = esMembresiaMensualPorDuracion(membresia.duracion_dias)
      const inscripcion = esMensual ? 5.0 : 0.0
      const precioTotal = membresia.precio_usd + inscripcion

      montoInput.value = precioTotal.toFixed(2)
      calcularIVAyMostrarDesglose()
    }
  })
})

// Escuchamos el evento cuando el formulario se envía
document.querySelector("form").addEventListener("submit", (event) => {
  event.preventDefault() // Evitamos que recargue la página

  const nombre = document.getElementById("nombre").value.trim()
  const apellido = document.getElementById("apellido").value.trim()
  const cedula = document.getElementById("cedula").value.trim()
  const membresia = document.getElementById("membresia").value
  const telefono = document.getElementById("telefono").value.trim()
  const direccion = document.getElementById("direccion").value.trim()
  const mail = document.getElementById("mail").value.trim()
  const monto_dolares = Number.parseFloat(document.getElementById("monto_dolares").value)
  const tasa_dia = Number.parseFloat(document.getElementById("tasa_dia").value)
  const monto_bs = Number.parseFloat(document.getElementById("monto_bs").value)
  const metodo_pago = document.getElementById("metodo_pago").value
  const referencia = document.getElementById("referencia").value.trim()

  // Validar si se necesita la referencia
  if ((metodo_pago === "transferencia" || metodo_pago === "pago_movil") && referencia === "") {
    document.getElementById("referencia").style.border = "2px solid red"
    alert("Debe ingresar el número de referencia para el método de pago seleccionado.")
    return
  } else {
    document.getElementById("referencia").style.border = "" // Quitar rojo si es válido
  }

  const hoy = new Date()
  // Asegurar que usamos la fecha local, no UTC
  const year = hoy.getFullYear()
  const month = (hoy.getMonth() + 1).toString().padStart(2, "0")
  const day = hoy.getDate().toString().padStart(2, "0")
  const fechaRegistro = `${year}-${month}-${day}`

  // Obtener ID de membresía y calcular fecha de vencimiento
  db.get(
    "SELECT id, duracion_dias, descripcion FROM membresias WHERE nombre = ?",
    [membresia],
    (err, membresiaData) => {
      if (err) {
        console.error("Error obteniendo datos de membresía:", err.message)
        alert("Error al procesar la membresía seleccionada.")
        return
      }

      if (!membresiaData) {
        alert("Membresía no encontrada.")
        return
      }

      // Calcular fecha de vencimiento usando la función corregida
      const fechaVencimiento = calcularFechaVencimiento(fechaRegistro, membresiaData.duracion_dias, membresia)

      // Insertar cliente
      setTimeout(() => {
        db.run(
          `INSERT INTO clientes (nombre, apellido, cedula, membresia_id, telefono, direccion, mail, fecha_registro, fecha_vencimiento, monto_dolares, tasa_dia, monto_bs, metodo_pago, referencia)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            nombre,
            apellido,
            cedula,
            membresiaData.id,
            telefono,
            direccion,
            mail,
            fechaRegistro,
            fechaVencimiento,
            monto_dolares,
            tasa_dia,
            monto_bs,
            metodo_pago,
            referencia,
          ],
          function (err) {
            if (err) {
              if (err.message.includes("UNIQUE")) {
                alert("Error: ya existe un cliente con esa cédula o teléfono.")
              } else {
                console.error(err.message)
                alert("Error al registrar cliente.")
              }
            } else {
              const clienteID = this.lastID // ID del cliente recién insertado

              // Insertar registro en el historial de pagos
              db.run(
                `INSERT INTO pagos (cliente_id, fecha_pago, monto_dolares, tasa_dia, monto_bs, metodo_pago, membresia_id, referencia)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  clienteID,
                  fechaRegistro,
                  monto_dolares,
                  tasa_dia,
                  monto_bs,
                  metodo_pago,
                  membresiaData.id,
                  referencia,
                ],
                (err2) => {
                  if (err2) {
                    console.error("Error al guardar en pagos:", err2.message)
                  } else {
                    console.log("Pago registrado en el historial")
                  }
                },
              )

              // Mostrar mensaje de éxito y generar factura
              alert(`Cliente ${nombre} ${apellido} registrado exitosamente.`)

              // Generar factura automáticamente
              generarFacturaCliente(clienteID, {
                nombre,
                apellido,
                cedula,
                telefono,
                direccion,
                mail,
                membresia: membresiaData.descripcion,
                fechaRegistro,
                fechaVencimiento,
                monto_dolares,
                tasa_dia,
                monto_bs,
                metodo_pago,
                referencia,
                duracion_dias: membresiaData.duracion_dias,
                tipo_membresia: membresia,
              })

              event.target.reset()
              ocultarDesgloseIVA() // Ocultar desglose al limpiar formulario
            }
          },
        )
      }, 100)
    },
  )
})

// Función para generar factura del cliente
function generarFacturaCliente(clienteId, datosCliente) {
  const confirmarFactura = confirm(
    `✅ Cliente registrado exitosamente!\n\n` +
      `Cliente: ${datosCliente.nombre} ${datosCliente.apellido}\n` +
      `Membresía: ${datosCliente.membresia}\n` +
      `Total: $${datosCliente.monto_dolares.toFixed(2)} USD\n\n` +
      `¿Desea generar la factura de membresía?`,
  )

  if (confirmarFactura) {
    generarFacturaPDFCliente(clienteId, datosCliente)
  }
}

// Función para generar la factura en PDF
function generarFacturaPDFCliente(clienteId, datos) {
  // Reemplaza estas líneas:
  //const fechaFormateada = new Date(datos.fechaRegistro).toLocaleDateString("es-ES")
  //const fechaVencimientoFormateada = new Date(datos.fechaVencimiento).toLocaleDateString("es-ES")

  // Por estas líneas corregidas:
  const [yearReg, monthReg, dayReg] = datos.fechaRegistro.split("-").map(Number)
  const fechaRegistroObj = new Date(yearReg, monthReg - 1, dayReg)
  const fechaFormateada = fechaRegistroObj.toLocaleDateString("es-ES")

  const [yearVenc, monthVenc, dayVenc] = datos.fechaVencimiento.split("-").map(Number)
  const fechaVencimientoObj = new Date(yearVenc, monthVenc - 1, dayVenc)
  const fechaVencimientoFormateada = fechaVencimientoObj.toLocaleDateString("es-ES")
  const horaActual = new Date().toLocaleTimeString("es-ES")

  // Calcular duración real para mostrar en la factura
  const duracionReal = calcularDuracionReal(datos.fechaRegistro, datos.fechaVencimiento, datos.tipo_membresia)

  // CORRECCIÓN: Calcular IVA basándose en duración de días
  const esMensual = esMembresiaMensualPorDuracion(datos.duracion_dias)
  const tasa = datos.tasa_dia

  let tablaDesglose = ""

  if (esMensual) {
    // Para membresías mensuales con inscripción
    const inscripcion = 5.0
    const precioMembresiaConIVA = datos.monto_dolares - inscripcion
    const precioMembresiaSinIVA = precioMembresiaConIVA / (1 + IVA_RATE)
    const ivaMembresia = precioMembresiaConIVA - precioMembresiaSinIVA

    const inscripcionBs = inscripcion * tasa
    const membresiaSinIVABs = precioMembresiaSinIVA * tasa
    const ivaMembresiaBS = ivaMembresia * tasa

    tablaDesglose = `
      <table class="desglose-table">
        <thead>
          <tr>
            <th>Concepto</th>
            <th>Monto USD</th>
            <th>Monto Bs</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Membresía (sin IVA)</td>
            <td>$${precioMembresiaSinIVA.toFixed(2)}</td>
            <td>${membresiaSinIVABs.toFixed(2)} Bs</td>
          </tr>
          <tr>
            <td>IVA Membresía (16%)</td>
            <td>$${ivaMembresia.toFixed(2)}</td>
            <td>${ivaMembresiaBS.toFixed(2)} Bs</td>
          </tr>
          <tr>
            <td>Inscripción</td>
            <td>$${inscripcion.toFixed(2)}</td>
            <td>${inscripcionBs.toFixed(2)} Bs</td>
          </tr>
          <tr class="total-row">
            <td><strong>TOTAL A PAGAR</strong></td>
            <td><strong>$${datos.monto_dolares.toFixed(2)}</strong></td>
            <td><strong>${datos.monto_bs.toFixed(2)} Bs</strong></td>
          </tr>
        </tbody>
      </table>
    `
  } else {
    // Para membresías no mensuales (sin inscripción)
    const montoSinIVA = datos.monto_dolares / (1 + IVA_RATE)
    const montoIVA = datos.monto_dolares - montoSinIVA
    const sinIVABs = montoSinIVA * tasa
    const ivaBs = montoIVA * tasa

    tablaDesglose = `
      <table class="desglose-table">
        <thead>
          <tr>
            <th>Concepto</th>
            <th>Monto USD</th>
            <th>Monto Bs</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Subtotal (sin IVA)</td>
            <td>$${montoSinIVA.toFixed(2)}</td>
            <td>${sinIVABs.toFixed(2)} Bs</td>
          </tr>
          <tr>
            <td>IVA (16%)</td>
            <td>$${montoIVA.toFixed(2)}</td>
            <td>${ivaBs.toFixed(2)} Bs</td>
          </tr>
          <tr class="total-row">
            <td><strong>TOTAL A PAGAR</strong></td>
            <td><strong>$${datos.monto_dolares.toFixed(2)}</strong></td>
            <td><strong>${datos.monto_bs.toFixed(2)} Bs</strong></td>
          </tr>
        </tbody>
      </table>
    `
  }

  const contenidoFactura = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Factura Membresía #${clienteId} - SIMETRIC GYM</title>
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
        .factura-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
        }
        .info-section {
          flex: 1;
        }
        .info-section h3 {
          color: #880808;
          margin-bottom: 10px;
          font-size: 16px;
        }
        .info-item {
          margin-bottom: 5px;
          font-size: 14px;
        }
        .cliente-info {
          background-color: #f9f9f9;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
          border-left: 4px solid #880808;
        }
        .membresia-info {
          background-color: #e8f5e8;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
          border-left: 4px solid #4caf50;
        }
        .desglose-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        .desglose-table th,
        .desglose-table td {
          border: 1px solid #ddd;
          padding: 12px;
          text-align: left;
        }
        .desglose-table th {
          background-color: #880808;
          color: white;
          font-weight: bold;
        }
        .desglose-table tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .total-row {
          background-color: #e8f5e8 !important;
          font-weight: bold;
          font-size: 16px;
        }
        .metodo-pago {
          background-color: #f0f0f0;
          padding: 15px;
          border-radius: 5px;
          margin-bottom: 20px;
        }
        .referencia {
          background-color: #e8f5e8;
          padding: 10px;
          border-left: 4px solid #4caf50;
          margin-top: 10px;
        }
        .footer {
          text-align: center;
          border-top: 1px solid #ddd;
          padding-top: 20px;
          color: #666;
          font-size: 12px;
        }
        .vigencia {
          background-color: #fff3cd;
          border: 1px solid #ffeaa7;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
          text-align: center;
        }
        .vigencia h4 {
          color: #856404;
          margin-bottom: 10px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">🏋️ SIMETRIC GYM C.A.</div>
        <div class="subtitle">Factura de Membresía</div>
      </div>

      <div class="factura-info">
        <div class="info-section">
          <h3>📄 Información de la Factura</h3>
          <div class="info-item"><strong>Factura #:</strong> MEMB-${clienteId}</div>
          <div class="info-item"><strong>Fecha:</strong> ${fechaFormateada}</div>
          <div class="info-item"><strong>Hora:</strong> ${horaActual}</div>
          <div class="info-item"><strong>Atendido por:</strong> ${sessionStorage.getItem("usuarioActual") || "Sistema"}</div>
        </div>
        
        <div class="info-section">
          <h3>💳 Método de Pago</h3>
          <div class="info-item"><strong>Método:</strong> ${obtenerNombreMetodoPago(datos.metodo_pago)}</div>
          <div class="info-item"><strong>Tasa del día:</strong> ${datos.tasa_dia.toFixed(2)} Bs/USD</div>
          ${datos.referencia ? `<div class="referencia"><strong>📱 Referencia:</strong> ${datos.referencia}</div>` : ""}
        </div>
      </div>

      <div class="cliente-info">
        <h3>👤 Datos del Cliente</h3>
        <div class="info-item"><strong>Nombre:</strong> ${datos.nombre} ${datos.apellido}</div>
        <div class="info-item"><strong>Cédula:</strong> ${datos.cedula}</div>
        <div class="info-item"><strong>Teléfono:</strong> ${datos.telefono}</div>
        <div class="info-item"><strong>Email:</strong> ${datos.mail}</div>
        <div class="info-item"><strong>Dirección:</strong> ${datos.direccion}</div>
      </div>

      <div class="membresia-info">
        <h3>🏋️ Información de Membresía</h3>
        <div class="info-item"><strong>Plan:</strong> ${datos.membresia}</div>
        <div class="info-item"><strong>Duración:</strong> ${duracionReal}</div>
        <div class="info-item"><strong>Fecha de inicio:</strong> ${fechaFormateada}</div>
        <div class="info-item"><strong>Fecha de vencimiento:</strong> ${fechaVencimientoFormateada}</div>
      </div>

      ${tablaDesglose}

      <div class="vigencia">
        <h4>⏰ Vigencia de la Membresía</h4>
        <p>Esta membresía es válida desde el <strong>${fechaFormateada}</strong> hasta el <strong>${fechaVencimientoFormateada}</strong></p>
        <p>Duración total: <strong>${duracionReal}</strong></p>
      </div>

      <div class="footer">
        <p><strong>¡Gracias por confiar en SIMETRIC GYM! <br>RIF: J-31700635/3</strong></p>
        <p>Factura emitida el ${new Date().toLocaleDateString("es-ES")} a las ${horaActual}</p>
        
      </div>
    </body>
    </html>
  `

  // Abrir ventana para imprimir/guardar
  const ventanaFactura = window.open("", "", "width=800,height=600")
  if (!ventanaFactura) {
    alert(
      "❌ Error: El navegador bloqueó la ventana emergente. Por favor, permite ventanas emergentes para este sitio.",
    )
    return
  }

  ventanaFactura.document.write(contenidoFactura)
  ventanaFactura.document.close()

  // Dar tiempo para que se cargue el contenido y luego mostrar diálogo de impresión
  setTimeout(() => {
    ventanaFactura.print()
  }, 500)
}

// Función auxiliar para nombres de métodos de pago
function obtenerNombreMetodoPago(metodo) {
  const metodos = {
    efectivo: "Efectivo",
    tarjeta: "Tarjeta de Débito/Crédito",
    pago_movil: "Pago Móvil",
    transferencia: "Transferencia Bancaria",
  }
  return metodos[metodo] || metodo
}

// FUNCIÓN CORREGIDA: Calcular fecha de vencimiento con lógica mejorada para membresías mensuales
function calcularFechaVencimiento(fechaInicio, duracionDias, tipoMembresia) {
  // Crear fecha desde string YYYY-MM-DD
  const [year, month, day] = fechaInicio.split("-").map(Number)
  const fechaObj = new Date(year, month - 1, day) // month - 1 porque los meses en JS van de 0-11

  // Para plan diario, la fecha de vencimiento es el mismo día
  if (duracionDias === 1) {
    // Plan diario: vence el mismo día
    const yearVenc = fechaObj.getFullYear()
    const monthVenc = (fechaObj.getMonth() + 1).toString().padStart(2, "0")
    const dayVenc = fechaObj.getDate().toString().padStart(2, "0")
    return `${yearVenc}-${monthVenc}-${dayVenc}`
  }
  // CORRECCIÓN: Para planes mensuales (30 días), usar lógica de meses reales
  else if (esMembresiaMensualPorDuracion(duracionDias)) {
    // NUEVA LÓGICA: Si me registro el 2 de junio, vence el 2 de julio (no el 1)
    // Sumar 1 mes usando la función nativa de JavaScript
    const fechaVencimiento = new Date(fechaObj)
    fechaVencimiento.setMonth(fechaVencimiento.getMonth() + 1)

    // CORRECCIÓN IMPORTANTE: Restar 1 día para que venza el día anterior
    // Si me registro el 2 de junio, vence el 1 de julio (el día 2 ya no tengo acceso)
    fechaVencimiento.setDate(fechaVencimiento.getDate() - 1)

    // Si el día original no existe en el mes destino (ej: 31 de febrero),
    // JavaScript automáticamente ajusta al último día válido del mes
    const yearVenc = fechaVencimiento.getFullYear()
    const monthVenc = (fechaVencimiento.getMonth() + 1).toString().padStart(2, "0")
    const dayVenc = fechaVencimiento.getDate().toString().padStart(2, "0")
    return `${yearVenc}-${monthVenc}-${dayVenc}`
  }
  // Para otros planes (semanal): sumar los días de duración - 1 (porque el día de registro cuenta)
  else {
    fechaObj.setDate(fechaObj.getDate() + duracionDias - 1)

    const yearVenc = fechaObj.getFullYear()
    const monthVenc = (fechaObj.getMonth() + 1).toString().padStart(2, "0")
    const dayVenc = fechaObj.getDate().toString().padStart(2, "0")
    return `${yearVenc}-${monthVenc}-${dayVenc}`
  }
}

// Función para determinar si una membresía es mensual (mantenida para compatibilidad)
function esMembresiaMensual(tipoMembresia) {
  const membresiasMensuales = ["mensual", "especial", "parejas", "familiar", "estudiantil"]
  return membresiasMensuales.includes(tipoMembresia)
}

// Función para calcular la duración real entre dos fechas
function calcularDuracionReal(fechaInicio, fechaFin, tipoMembresia) {
  const [yearInicio, monthInicio, dayInicio] = fechaInicio.split("-").map(Number)
  const [yearFin, monthFin, dayFin] = fechaFin.split("-").map(Number)

  const inicio = new Date(yearInicio, monthInicio - 1, dayInicio)
  const fin = new Date(yearFin, monthFin - 1, dayFin)

  if (tipoMembresia === "diario") {
    return "1 día"
  } else if (tipoMembresia === "semanal") {
    return "7 días (1 semana)"
  } else if (esMembresiaMensual(tipoMembresia)) {
    // Calcular diferencia en días para mostrar información completa
    const diffTime = fin - inicio
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1 // +1 porque incluye el día de inicio
    return `${diffDays} días (1 mes)`
  } else {
    const diffTime = fin - inicio
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    return `${diffDays} días`
  }
}

document.getElementById("cedula").addEventListener("input", (e) => {
  // Solo números y máximo 9 dígitos
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 9)
})

document.getElementById("telefono").addEventListener("input", (e) => {
  // Solo números y máximo 12 dígitos
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 12)
})

document.getElementById("referencia").addEventListener("input", (e) => {
  e.target.value = e.target.value.replace(/\D/g, "")
})

document.getElementById("metodo_pago").addEventListener("change", function () {
  const metodo = this.value
  const referenciaInput = document.getElementById("referencia")

  if (metodo === "transferencia" || metodo === "pago_movil") {
    referenciaInput.disabled = false
    referenciaInput.required = true
    referenciaInput.placeholder = "Ingrese referencia"
    referenciaInput.value = "" // limpio en caso de venir de un método anterior
  } else {
    referenciaInput.disabled = true
    referenciaInput.required = false
    referenciaInput.placeholder = "No aplica"
    referenciaInput.value = "" // limpio para evitar valores no válidos
    referenciaInput.style.border = "" // quito borde rojo si quedó de antes
  }
})

// Event listener para limpiar el formulario
document.getElementById("clear-btn").addEventListener("click", () => {
  ocultarDesgloseIVA()
})

// Hacer el campo monto readonly ya que se llena automáticamente
document.getElementById("monto_dolares").readOnly = true
document.getElementById("monto_dolares").style.backgroundColor = "#2a2a2a"
document.getElementById("monto_dolares").style.cursor = "not-allowed"

// Llamar la función al cargar la página
document.addEventListener("DOMContentLoaded", cargarTasaAutomatica)

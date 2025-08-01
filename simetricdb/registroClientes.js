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
  descripcion TEXT
)`)

// Insertar membresías por defecto si no existen
db.run(`INSERT OR IGNORE INTO membresias (nombre, precio_usd, duracion_dias, descripcion) VALUES 
  ('mensual', 40.00, 30, 'Plan Mensual'),
  ('diario', 4.00, 1, 'Plan Diario'),
  ('semanal', 12.00, 7, 'Plan Semanal'),
  ('especial', 30.00, 30, 'Plan Especial'),
  ('parejas', 65.00, 30, 'Plan Parejas'),
  ('familiar', 90.00, 30, 'Plan Familiar'),
  ('estudiantil', 70.00, 30, 'Plan Estudiantil')
`)

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
  FOREIGN KEY (membresia_id) REFERENCES membresias(id)
)`)

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
  FOREIGN KEY (membresia_id) REFERENCES membresias(id)
)`)

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
  fecha_registro TEXT NOT NULL
)`)

// Crear tabla de usuarios (administradoras) si no existe
db.run(`CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario TEXT UNIQUE NOT NULL,
  clave TEXT NOT NULL
)`)

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

document.getElementById("tasa_dia").addEventListener("input", calcularBs)
document.getElementById("monto_dolares").addEventListener("input", calcularBs)

function calcularBs() {
  const tasa = Number.parseFloat(document.getElementById("tasa_dia").value) || 0
  const monto = Number.parseFloat(document.getElementById("monto_dolares").value) || 0
  const bs = (monto * tasa).toFixed(2)
  document.getElementById("monto_bs").value = bs
}

document.getElementById("membresia").addEventListener("change", function () {
  const tipo = this.value
  const montoInput = document.getElementById("monto_dolares")

  // Obtener precio desde la base de datos
  db.get("SELECT precio_usd FROM membresias WHERE nombre = ?", [tipo], (err, membresia) => {
    if (err) {
      console.error("Error obteniendo precio de membresía:", err.message)
      return
    }

    if (membresia) {
      montoInput.value = membresia.precio_usd.toFixed(2)
      calcularBs()
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
  const year = hoy.getFullYear()
  const month = (hoy.getMonth() + 1).toString().padStart(2, "0")
  const day = hoy.getDate().toString().padStart(2, "0")
  const fechaRegistro = `${year}-${month}-${day}`

  // Obtener ID de membresía y calcular fecha de vencimiento
  db.get("SELECT id, duracion_dias FROM membresias WHERE nombre = ?", [membresia], (err, membresiaData) => {
    if (err) {
      console.error("Error obteniendo datos de membresía:", err.message)
      alert("Error al procesar la membresía seleccionada.")
      return
    }

    if (!membresiaData) {
      alert("Membresía no encontrada.")
      return
    }

    // Calcular fecha de vencimiento
    const fechaVencimiento = calcularFechaVencimiento(fechaRegistro, membresiaData.duracion_dias)

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
              [clienteID, fechaRegistro, monto_dolares, tasa_dia, monto_bs, metodo_pago, membresiaData.id, referencia],
              (err2) => {
                if (err2) {
                  console.error("Error al guardar en pagos:", err2.message)
                } else {
                  console.log("Pago registrado en el historial")
                }
              },
            )

            alert(`Cliente ${nombre} ${apellido} registrado exitosamente.`)
            event.target.reset()
          }
        },
      )
    }, 100)
  })
})

// Función para calcular fecha de vencimiento
function calcularFechaVencimiento(fecha, duracionDias) {
  const fechaObj = new Date(fecha)
  fechaObj.setDate(fechaObj.getDate() + duracionDias)

  const year = fechaObj.getFullYear()
  const month = (fechaObj.getMonth() + 1).toString().padStart(2, "0")
  const day = fechaObj.getDate().toString().padStart(2, "0")
  return `${year}-${month}-${day}`
}

document.getElementById("cedula").addEventListener("input", (e) => {
  e.target.value = e.target.value.replace(/\D/g, "")
})

document.getElementById("telefono").addEventListener("input", (e) => {
  e.target.value = e.target.value.replace(/\D/g, "")
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

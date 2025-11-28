const sqlite3 = require("sqlite3").verbose()

// Conectar a la base de datos unificada
const db = new sqlite3.Database("simetricdb.sqlite", (err) => {
  if (err) {
    console.error("Error al conectar con la base de datos:", err.message)
  } else {
    console.log("Conectado a la base de datos unificada.")
  }
})


// Crear tabla de membresías si no existe
db.run(`CREATE TABLE IF NOT EXISTS membresias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT UNIQUE NOT NULL,
  precio_usd REAL NOT NULL,
  duracion_dias INTEGER NOT NULL,
  descripcion TEXT)`)

// Crear tabla de configuraciones si no existe
db.run(`CREATE TABLE IF NOT EXISTS configuraciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clave TEXT UNIQUE NOT NULL,
  valor TEXT NOT NULL,
  
  fecha_actualizacion TEXT NOT NULL
)`)


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

// Referencias al formulario
const form = document.getElementById("login-form")
const usuarioInput = document.getElementById("usuario")
const claveInput = document.getElementById("clave")

// Evento de envío del formulario
form.addEventListener("submit", (e) => {
  e.preventDefault()
  const usuario = usuarioInput.value.trim()
  const clave = claveInput.value

  if (!usuario || !clave) {
    alert("Por favor ingresa usuario y contraseña.")
    return
  }

  db.get("SELECT * FROM usuarios WHERE usuario = ?", [usuario], (err, row) => {
    if (err) {
      console.error("Error al consultar la base de datos", err)
      alert("Ocurrió un error. Intenta nuevamente.")
      return
    }

    if (!row) {
      alert("Usuario no registrado.")
    } else {
      if (row.clave === clave) {
        // Guardar usuario actual en sessionStorage para uso posterior
        sessionStorage.setItem("usuarioActual", usuario)
        console.log(`Usuario ${usuario} logueado y guardado en sessionStorage`)

        // Acceso correcto, verificar si es el primer usuario registrado
        db.get("SELECT id FROM usuarios ORDER BY id ASC LIMIT 1", (err, firstUser) => {
          if (err) {
            console.error("Error al verificar primer usuario:", err)
            alert("Ocurrió un error. Intenta nuevamente.")
            return
          }

          // Si el ID del usuario coincide con el primer usuario registrado
          if (row.id === firstUser.id) {
            // Es el administrador principal - redirigir a indexmain.html
            console.log("Administrador principal logueado - redirigiendo a indexmain.html")
            window.location.href = "../../dashboard/indexmain.html"
          } else {
            // Es un administrador regular - redirigir a index.html
            console.log("Administrador regular logueado - redirigiendo a index.html")
            window.location.href = "../../dashboard/index.html"
          }
        })
      } else {
        alert("Contraseña incorrecta.")
      }
    }
  })
})

// Elementos del popup
const registrarLink = document.getElementById("registrar-link")
const administrarLink = document.getElementById("administrar-link")
const popup = document.getElementById("popup-auth")
const inputClave = document.getElementById("clave-autorizacion")
const btnVerificar = document.getElementById("btn-verificar-clave")
const btnCancelar = document.getElementById("btn-cancelar-popup")
let modoAcceso = ""

registrarLink.addEventListener("click", (e) => {
  e.preventDefault()
  db.get("SELECT clave FROM usuarios ORDER BY id ASC LIMIT 1", (err, row) => {
    if (!row) {
      window.location.href = "../register/registro.html"
    } else {
      modoAcceso = "registro"
      popup.classList.remove("hidden")
      inputClave.value = ""
      inputClave.focus()
    }
  })
})

// LINK ADMINISTRAR
administrarLink.addEventListener("click", (e) => {
  e.preventDefault()
  db.get("SELECT clave FROM usuarios ORDER BY id ASC LIMIT 1", (err, row) => {
    if (!row) {
      window.location.href = "../adminprofile/administrar_perfiles.html"
    } else {
      modoAcceso = "admin"
      popup.classList.remove("hidden")
      inputClave.value = ""
      inputClave.focus()
    }
  })
})

// VERIFICAR CLAVE (una sola vez)
btnVerificar.addEventListener("click", () => {
  const claveIngresada = inputClave.value.trim()
  db.get("SELECT clave FROM usuarios ORDER BY id ASC LIMIT 1", (err, row) => {
    if (err) {
      alert("Error al verificar la contraseña.")
      return
    }
    if (claveIngresada === row.clave) {
      popup.classList.add("hidden")
      if (modoAcceso === "registro") {
        window.location.href = "../register/registro.html"
      } else if (modoAcceso === "admin") {
        window.location.href = "../adminprofile/administrar_perfiles.html"
      }
    } else {
      alert("Contraseña incorrecta.")
    }
  })
})

// CANCELAR
btnCancelar.addEventListener("click", () => {
  popup.classList.add("hidden")
})
console.log('Script de login cargado correctamente');

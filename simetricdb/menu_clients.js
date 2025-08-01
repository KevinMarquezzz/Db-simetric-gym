const sqlite3 = require("sqlite3").verbose()
const path = require("path")
// Conectar a la base de datos unificada
const dbPath = "simetricdb.sqlite"
const db = new sqlite3.Database(dbPath)

// Función para obtener el usuario actual desde sessionStorage o localStorage
function obtenerUsuarioActual() {
  // Puedes usar sessionStorage o localStorage según tu implementación
  return sessionStorage.getItem("usuarioActual") || localStorage.getItem("usuarioActual")
}

// Función para verificar si un usuario es el administrador principal
function esAdministradorPrincipal(usuarioNombre, callback) {
  if (!usuarioNombre) {
    callback(false)
    return
  }

  // Obtener información del usuario actual
  db.get("SELECT id FROM usuarios WHERE usuario = ?", [usuarioNombre], (err, userRow) => {
    if (err || !userRow) {
      console.error("Error al obtener usuario:", err)
      callback(false)
      return
    }

    // Obtener el primer usuario registrado (administrador principal)
    db.get("SELECT id FROM usuarios ORDER BY id ASC LIMIT 1", (err, firstUser) => {
      if (err || !firstUser) {
        console.error("Error al obtener primer usuario:", err)
        callback(false)
        return
      }

      // Comparar IDs
      callback(userRow.id === firstUser.id)
    })
  })
}

// Función para configurar la redirección correcta
function configurarRedireccion() {
  const backButton = document.querySelector(".back_btn")
  const usuarioActual = obtenerUsuarioActual()

  if (!backButton) {
    console.error("No se encontró el botón de volver")
    return
  }

  if (!usuarioActual) {
    console.warn("No se encontró usuario actual, redirigiendo a login")
    backButton.href = "login.html"
    return
  }

  // Verificar tipo de usuario y configurar redirección
  esAdministradorPrincipal(usuarioActual, (esGerente) => {
    if (esGerente) {
      // Es administrador principal - redirigir a indexmain.html
      backButton.href = "indexmain.html"
      console.log("Usuario administrador principal detectado - redirección a indexmain.html")
    } else {
      // Es administrador regular - redirigir a index.html
      backButton.href = "index.html"
      console.log("Usuario administrador regular detectado - redirección a index.html")
    }
  })
}

// Ejecutar cuando se carga la página
document.addEventListener("DOMContentLoaded", () => {
  console.log("Configurando redirección para menú de clientes...")
  configurarRedireccion()
})

// Función adicional para debugging
function mostrarInfoUsuario() {
  const usuarioActual = obtenerUsuarioActual()
  if (usuarioActual) {
    esAdministradorPrincipal(usuarioActual, (esGerente) => {
      console.log(`Usuario actual: ${usuarioActual}`)
      console.log(`Tipo: ${esGerente ? "Administrador Principal" : "Administrador Regular"}`)
      console.log(`Redirección: ${esGerente ? "indexmain.html" : "index.html"}`)
    })
  } else {
    console.log("No hay usuario logueado")
  }
}

// Llamar función de debugging (opcional)
// mostrarInfoUsuario();

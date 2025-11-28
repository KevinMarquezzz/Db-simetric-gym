const sqlite3 = require("sqlite3").verbose()

// CORRECCIÓN: Usar la base de datos unificada
const db = new sqlite3.Database("simetricdb.sqlite", (err) => {
  if (err) {
    console.error("Error al conectar con la base de datos:", err.message)
  } else {
    console.log("Conectado a la base de datos unificada para recuperar contraseña.")
  }
})

// Clave maestra definida por ti
const CLAVE_MAESTRA = "simetricPass123"

// Referencias a formularios y campos
const formVerificacion = document.getElementById("verificacion-form")
const formCambio = document.getElementById("cambio-form")
const formNuevaClave = document.getElementById("form-nueva-clave")
const inputUsuario = document.getElementById("usuario")
const inputClaveMaestra = document.getElementById("clave-maestra")
const inputNuevaClave = document.getElementById("nueva-clave")
const inputConfirmarClave = document.getElementById("confirmar-clave")
const btnCancelar = document.getElementById("btn-cancelar-popup")
const submitBtn = document.getElementById("submit-btn")
const usuarioCambio = document.getElementById("usuario-cambio")

// Elementos de requisitos de contraseña
const passwordRequirements = document.getElementById("password-requirements")
const passwordMatch = document.getElementById("password-match")
const reqLength = document.getElementById("req-length")
const reqUppercase = document.getElementById("req-uppercase")
const reqNumber = document.getElementById("req-number")
const reqSpecial = document.getElementById("req-special")
const reqMatch = document.getElementById("req-match")

let usuarioValidado = null

// FUNCIONES DE VALIDACIÓN DE CONTRASEÑA (copiadas del registro.js)
function validatePassword(password) {
  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  }
  return requirements
}

function validatePasswordMatch(password, confirmPassword) {
  return password === confirmPassword && password.length > 0
}

function updateRequirementUI(element, isValid) {
  const icon = element.querySelector(".req-icon")
  if (isValid) {
    element.classList.add("valid")
    element.classList.remove("invalid")
    icon.textContent = "✅"
  } else {
    element.classList.add("invalid")
    element.classList.remove("valid")
    icon.textContent = "❌"
  }
}

function updateSubmitButton() {
  const password = inputNuevaClave.value
  const confirmPassword = inputConfirmarClave.value
  const requirements = validatePassword(password)
  const allRequirementsMet = Object.values(requirements).every((req) => req)
  const passwordsMatch = validatePasswordMatch(password, confirmPassword)

  const isFormValid = allRequirementsMet && passwordsMatch
  submitBtn.disabled = !isFormValid
}

// EVENTO CORREGIDO: Verificar usuario y clave maestra
formVerificacion.addEventListener("submit", (e) => {
  e.preventDefault()

  const usuario = inputUsuario.value.trim()
  const claveMaestra = inputClaveMaestra.value.trim()

  if (!usuario) {
    alert("Por favor ingresa el nombre de usuario.")
    inputUsuario.focus()
    return
  }

  if (!claveMaestra) {
    alert("Por favor ingresa la contraseña del sistema.")
    inputClaveMaestra.focus()
    return
  }

  if (claveMaestra !== CLAVE_MAESTRA) {
    alert("Contraseña del sistema incorrecta.")
    inputClaveMaestra.value = ""
    inputClaveMaestra.focus()
    return
  }

  // CORRECCIÓN: Consulta actualizada para la base de datos unificada
  db.get("SELECT * FROM usuarios WHERE usuario = ?", [usuario], (err, row) => {
    if (err) {
      console.error("Error al consultar la base de datos:", err.message)
      alert("Error al consultar la base de datos: " + err.message)
      return
    }

    if (!row) {
      alert("El usuario '" + usuario + "' no existe en el sistema.")
      inputUsuario.value = ""
      inputUsuario.focus()
    } else {
      // Usuario encontrado, proceder al cambio de contraseña
      usuarioValidado = usuario
      usuarioCambio.textContent = usuario

      formCambio.classList.remove("hidden")

      // Limpiar campos del formulario de cambio
      inputNuevaClave.value = ""
      inputConfirmarClave.value = ""

      // Limpiar clases de validación
      inputNuevaClave.classList.remove("valid", "invalid")
      inputConfirmarClave.classList.remove("valid", "invalid")

      // Ocultar paneles de requisitos
      passwordRequirements.classList.remove("show")
      passwordMatch.classList.remove("show")

      // Actualizar estado del botón
      updateSubmitButton()

      inputNuevaClave.focus()
      console.log(`Usuario ${usuario} validado correctamente`)
    }
  })
})

// EVENT LISTENERS PARA LA CONTRASEÑA PRINCIPAL
inputNuevaClave.addEventListener("focus", () => {
  passwordRequirements.classList.add("show")
})

inputNuevaClave.addEventListener("blur", () => {
  setTimeout(() => {
    if (!inputNuevaClave.matches(":focus")) {
      passwordRequirements.classList.remove("show")
    }
  }, 200)
})

inputNuevaClave.addEventListener("input", (e) => {
  const password = e.target.value
  const requirements = validatePassword(password)

  // Actualizar UI de requisitos
  updateRequirementUI(reqLength, requirements.length)
  updateRequirementUI(reqUppercase, requirements.uppercase)
  updateRequirementUI(reqNumber, requirements.number)
  updateRequirementUI(reqSpecial, requirements.special)

  // Actualizar estilo del input
  const allRequirementsMet = Object.values(requirements).every((req) => req)
  if (password.length > 0) {
    if (allRequirementsMet) {
      inputNuevaClave.classList.add("valid")
      inputNuevaClave.classList.remove("invalid")
    } else {
      inputNuevaClave.classList.add("invalid")
      inputNuevaClave.classList.remove("valid")
    }
  } else {
    inputNuevaClave.classList.remove("valid", "invalid")
  }

  // Revalidar confirmación si ya tiene contenido
  if (inputConfirmarClave.value) {
    const event = new Event("input")
    inputConfirmarClave.dispatchEvent(event)
  }

  updateSubmitButton()
})

// EVENT LISTENERS PARA CONFIRMAR CONTRASEÑA
inputConfirmarClave.addEventListener("focus", () => {
  if (inputConfirmarClave.value || inputNuevaClave.value) {
    passwordMatch.classList.add("show")
  }
})

inputConfirmarClave.addEventListener("blur", () => {
  setTimeout(() => {
    if (!inputConfirmarClave.matches(":focus")) {
      passwordMatch.classList.remove("show")
    }
  }, 200)
})

inputConfirmarClave.addEventListener("input", (e) => {
  const confirmPassword = e.target.value
  const password = inputNuevaClave.value
  const passwordsMatch = validatePasswordMatch(password, confirmPassword)

  // Mostrar/ocultar panel de coincidencia
  if (confirmPassword.length > 0) {
    passwordMatch.classList.add("show")
  }

  // Actualizar UI de coincidencia
  updateRequirementUI(reqMatch, passwordsMatch)

  // Actualizar estilo del input
  if (confirmPassword.length > 0) {
    if (passwordsMatch) {
      inputConfirmarClave.classList.add("valid")
      inputConfirmarClave.classList.remove("invalid")
    } else {
      inputConfirmarClave.classList.add("invalid")
      inputConfirmarClave.classList.remove("valid")
    }
  } else {
    inputConfirmarClave.classList.remove("valid", "invalid")
    passwordMatch.classList.remove("show")
  }

  updateSubmitButton()
})

// EVENTO CORREGIDO: Cambiar la contraseña con validación completa
formNuevaClave.addEventListener("submit", (e) => {
  e.preventDefault()

  const nuevaClave = inputNuevaClave.value.trim()
  const confirmarClave = inputConfirmarClave.value.trim()

  if (!nuevaClave) {
    alert("Por favor ingresa la nueva contraseña.")
    inputNuevaClave.focus()
    return
  }

  // Validar requisitos de contraseña
  const requirements = validatePassword(nuevaClave)
  const allRequirementsMet = Object.values(requirements).every((req) => req)

  if (!allRequirementsMet) {
    alert("La contraseña no cumple con todos los requisitos de seguridad.")
    inputNuevaClave.focus()
    return
  }

  if (nuevaClave !== confirmarClave) {
    alert("Las contraseñas no coinciden.")
    inputConfirmarClave.value = ""
    inputConfirmarClave.focus()
    return
  }

  // Deshabilitar botón durante el proceso
  submitBtn.disabled = true
  submitBtn.textContent = "Actualizando..."

  // CORRECCIÓN: Actualización en la base de datos unificada
  db.run("UPDATE usuarios SET clave = ? WHERE usuario = ?", [nuevaClave, usuarioValidado], function (err) {
    // Rehabilitar botón
    submitBtn.disabled = false
    submitBtn.textContent = "Actualizar Contraseña"

    if (err) {
      console.error("Error al actualizar la contraseña:", err.message)
      alert("Error al actualizar la contraseña: " + err.message)
      return
    }

    if (this.changes === 0) {
      alert("No se pudo actualizar la contraseña. Usuario no encontrado.")
    } else {
      alert(
        `✅ Contraseña actualizada correctamente para el usuario: ${usuarioValidado}\n\nLa nueva contraseña cumple con todos los requisitos de seguridad.`,
      )
      console.log(`Contraseña actualizada para usuario: ${usuarioValidado}`)

      // Redirigir al login después de un breve delay
      setTimeout(() => {
        window.location.href = "../login/login.html"
      })
    }
  })
})

// EVENTO: Botón cancelar
btnCancelar.addEventListener("click", () => {
  // Ocultar formulario de cambio
  formCambio.classList.add("hidden")

  // Limpiar campos
  inputNuevaClave.value = ""
  inputConfirmarClave.value = ""
  inputClaveMaestra.value = ""
  inputUsuario.value = ""

  // Limpiar clases de validación
  inputNuevaClave.classList.remove("valid", "invalid")
  inputConfirmarClave.classList.remove("valid", "invalid")

  // Ocultar paneles de requisitos
  passwordRequirements.classList.remove("show")
  passwordMatch.classList.remove("show")

  usuarioValidado = null

  // Enfocar campo de usuario
  inputUsuario.focus()

  console.log("Operación de cambio de contraseña cancelada")
})

// Permitir envío con Enter en los formularios
inputConfirmarClave.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    formNuevaClave.dispatchEvent(new Event("submit"))
  }
})

inputClaveMaestra.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    formVerificacion.dispatchEvent(new Event("submit"))
  }
})

// INICIALIZACIÓN
document.addEventListener("DOMContentLoaded", () => {
  console.log("Módulo de recuperar contraseña cargado correctamente")

  // Asegurar que el formulario de cambio esté oculto al inicio
  if (formCambio) {
    formCambio.classList.add("hidden")
  }

  // Enfocar el campo de usuario
  if (inputUsuario) {
    inputUsuario.focus()
  }

  // Inicializar estado del botón
  updateSubmitButton()
})

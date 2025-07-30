const sqlite3 = require("sqlite3").verbose()
const path = require("path")
const dbPath = path.resolve(__dirname, "database.db")
const db = new sqlite3.Database(dbPath)

// Crear tabla si no existe
db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT UNIQUE NOT NULL,
    clave TEXT NOT NULL
)`)

const form = document.getElementById("registro-form")
const claveInput = document.getElementById("clave")
const confirmarInput = document.getElementById("confirmar")
const submitBtn = document.getElementById("submit-btn")
const passwordRequirements = document.getElementById("password-requirements")
const passwordMatch = document.getElementById("password-match")

// Elementos de requisitos
const reqLength = document.getElementById("req-length")
const reqUppercase = document.getElementById("req-uppercase")
const reqNumber = document.getElementById("req-number")
const reqSpecial = document.getElementById("req-special")
const reqMatch = document.getElementById("req-match")

// Funciones de validación
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
  const password = claveInput.value
  const confirmPassword = confirmarInput.value

  const requirements = validatePassword(password)
  const allRequirementsMet = Object.values(requirements).every((req) => req)
  const passwordsMatch = validatePasswordMatch(password, confirmPassword)

  const isFormValid = allRequirementsMet && passwordsMatch && document.getElementById("usuario").value.trim()

  submitBtn.disabled = !isFormValid
}

// Event listeners para la contraseña principal
claveInput.addEventListener("focus", () => {
  passwordRequirements.classList.add("show")
})

claveInput.addEventListener("blur", () => {
  setTimeout(() => {
    passwordRequirements.classList.remove("show")
  }, 200)
})

claveInput.addEventListener("input", (e) => {
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
      claveInput.classList.add("valid")
      claveInput.classList.remove("invalid")
    } else {
      claveInput.classList.add("invalid")
      claveInput.classList.remove("valid")
    }
  } else {
    claveInput.classList.remove("valid", "invalid")
  }

  // Revalidar confirmación si ya tiene contenido
  if (confirmarInput.value) {
    const event = new Event("input")
    confirmarInput.dispatchEvent(event)
  }

  updateSubmitButton()
})

// Event listeners para confirmar contraseña
confirmarInput.addEventListener("focus", () => {
  if (confirmarInput.value || claveInput.value) {
    passwordMatch.classList.add("show")
  }
})

confirmarInput.addEventListener("blur", () => {
  setTimeout(() => {
    passwordMatch.classList.remove("show")
  }, 200)
})

confirmarInput.addEventListener("input", (e) => {
  const confirmPassword = e.target.value
  const password = claveInput.value
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
      confirmarInput.classList.add("valid")
      confirmarInput.classList.remove("invalid")
    } else {
      confirmarInput.classList.add("invalid")
      confirmarInput.classList.remove("valid")
    }
  } else {
    confirmarInput.classList.remove("valid", "invalid")
    passwordMatch.classList.remove("show")
  }

  updateSubmitButton()
})

// Event listener para el campo usuario
document.getElementById("usuario").addEventListener("input", updateSubmitButton)

// Event listener para el formulario
form.addEventListener("submit", (e) => {
  e.preventDefault()

  const usuario = document.getElementById("usuario").value.trim()
  const clave = claveInput.value
  const confirmar = confirmarInput.value

  if (!usuario || !clave || !confirmar) {
    alert("Todos los campos son obligatorios.")
    return
  }

  // Validar requisitos de contraseña
  const requirements = validatePassword(clave)
  const allRequirementsMet = Object.values(requirements).every((req) => req)

  if (!allRequirementsMet) {
    alert("La contraseña no cumple con todos los requisitos de seguridad.")
    claveInput.focus()
    return
  }

  if (clave !== confirmar) {
    alert("Las contraseñas no coinciden.")
    confirmarInput.focus()
    return
  }

  // Deshabilitar botón durante el proceso
  submitBtn.disabled = true
  submitBtn.textContent = "Registrando..."

  // Insertar nuevo usuario
  db.run("INSERT INTO usuarios (usuario, clave) VALUES (?, ?)", [usuario, clave], (err) => {
    // Rehabilitar botón
    submitBtn.disabled = false
    submitBtn.textContent = "Registrar"

    if (err) {
      if (err.message.includes("UNIQUE")) {
        alert("Ese nombre de usuario ya está registrado.")
      } else {
        console.error("Error al insertar usuario:", err)
        alert("Hubo un error al registrar la administradora.")
      }
      return
    }

    alert("Administradora registrada con éxito.")
    form.reset()

    // Limpiar clases de validación
    claveInput.classList.remove("valid", "invalid")
    confirmarInput.classList.remove("valid", "invalid")

    // Ocultar paneles de requisitos
    passwordRequirements.classList.remove("show")
    passwordMatch.classList.remove("show")

    updateSubmitButton()
  })
})

// Event listener para reset
form.addEventListener("reset", () => {
  setTimeout(() => {
    claveInput.classList.remove("valid", "invalid")
    confirmarInput.classList.remove("valid", "invalid")
    passwordRequirements.classList.remove("show")
    passwordMatch.classList.remove("show")
    updateSubmitButton()
  }, 10)
})

// Inicializar estado del botón
updateSubmitButton()

const sqlite3 = require("sqlite3").verbose()

const db = new sqlite3.Database("simetricdb.sqlite", (err) => {
  if (err) {
    console.error("Error al conectar con la base de datos:", err.message)
  } else {
    console.log("Conectado a la base de datos para registro de empleados.")
  }
})

// Función para validar cédula venezolana
function validarCedula(cedula) {
  // Remover caracteres no numéricos
  cedula = cedula.replace(/\D/g, "")

  // Debe tener entre 7 y 8 dígitos
  if (cedula.length < 7 || cedula.length > 8) {
    return false
  }

  return true
}

// Función para validar teléfono venezolano
function validarTelefono(telefono) {
  // Remover caracteres no numéricos
  telefono = telefono.replace(/\D/g, "")

  // Debe tener 11 dígitos y empezar con 04
  if (telefono.length !== 11 || !telefono.startsWith("04")) {
    return false
  }

  return true
}

// Event listeners para validación en tiempo real
document.getElementById("cedula").addEventListener("input", (e) => {
  // Solo números, máximo 8 dígitos
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 8)
})

document.getElementById("telefono").addEventListener("input", (e) => {
  // Solo números, máximo 11 dígitos
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 11)
})

document.getElementById("cuenta_bancaria").addEventListener("input", (e) => {
  // Solo números, máximo 20 dígitos
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 20)
})

// Navegación con Enter entre campos
const campos = [
  "nombre",
  "apellido",
  "cedula",
  "telefono",
  "direccion",
  "email",
  "cargo",
  "tipo_jornada",
  "sueldo_base",
  "fecha_ingreso",
  "banco",
  "cuenta_bancaria",
]

campos.forEach((campoId, index) => {
  const campo = document.getElementById(campoId)
  if (campo) {
    campo.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault()

        // Si es el último campo, enfocar el botón de guardar
        if (index === campos.length - 1) {
          document.getElementById("save-btn").focus()
        } else {
          // Mover al siguiente campo
          const siguienteCampo = document.getElementById(campos[index + 1])
          if (siguienteCampo) {
            siguienteCampo.focus()
          }
        }
      }
    })
  }
})

// Event listener para el formulario
document.getElementById("empleadoForm").addEventListener("submit", (e) => {
  e.preventDefault()

  // Obtener datos del formulario
  const formData = new FormData(e.target)
  const empleado = {
    nombre: formData.get("nombre").trim(),
    apellido: formData.get("apellido").trim(),
    cedula: formData.get("cedula").trim(),
    telefono: formData.get("telefono").trim(),
    direccion: formData.get("direccion").trim(),
    email: formData.get("email").trim(),
    cargo: formData.get("cargo"),
    tipo_jornada: formData.get("tipo_jornada"),
    sueldo_base: Number.parseFloat(formData.get("sueldo_base")),
    fecha_ingreso: formData.get("fecha_ingreso"),
    banco: formData.get("banco"),
    cuenta_bancaria: formData.get("cuenta_bancaria").trim(),
  }

  // Validaciones
  if (!empleado.nombre || !empleado.apellido || !empleado.cedula || !empleado.telefono) {
    alert("Por favor complete todos los campos obligatorios.")
    return
  }

  if (!validarCedula(empleado.cedula)) {
    alert("La cédula debe tener entre 7 y 8 dígitos.")
    document.getElementById("cedula").focus()
    return
  }

  if (!validarTelefono(empleado.telefono)) {
    alert("El teléfono debe tener 11 dígitos y empezar con 04.")
    document.getElementById("telefono").focus()
    return
  }

  if (empleado.sueldo_base <= 0) {
    alert("El sueldo base debe ser mayor a 0.")
    document.getElementById("sueldo_base").focus()
    return
  }

  // Validar fecha de ingreso (no puede ser futura)
  const fechaIngreso = new Date(empleado.fecha_ingreso)
  const fechaActual = new Date()
  fechaActual.setHours(0, 0, 0, 0)

  if (fechaIngreso > fechaActual) {
    alert("La fecha de ingreso no puede ser futura.")
    document.getElementById("fecha_ingreso").focus()
    return
  }

  // Obtener fecha actual para registro
  const fechaRegistro = new Date().toISOString().split("T")[0]

  // Insertar empleado en la base de datos
  const query = `
    INSERT INTO empleados (
      nombre, apellido, cedula, telefono, direccion, email, cargo, 
      tipo_jornada, sueldo_base, fecha_ingreso, banco, cuenta_bancaria, fecha_registro
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `

  db.run(
    query,
    [
      empleado.nombre,
      empleado.apellido,
      empleado.cedula,
      empleado.telefono,
      empleado.direccion,
      empleado.email,
      empleado.cargo,
      empleado.tipo_jornada,
      empleado.sueldo_base,
      empleado.fecha_ingreso,
      empleado.banco,
      empleado.cuenta_bancaria,
      fechaRegistro,
    ],
    function (err) {
      if (err) {
        if (err.message.includes("UNIQUE constraint failed")) {
          alert("Ya existe un empleado registrado con esa cédula.")
        } else {
          console.error("Error al registrar empleado:", err.message)
          alert("Error al registrar el empleado. Por favor intente nuevamente.")
        }
        return
      }

      const empleadoId = this.lastID

      // Mostrar mensaje de éxito
      alert(
        `✅ Empleado registrado exitosamente!\n\nNombre: ${empleado.nombre} ${empleado.apellido}\nCargo: ${empleado.cargo}\nSueldo: $${empleado.sueldo_base.toFixed(2)} USD\n\nID del empleado: ${empleadoId}`,
      )

      // Limpiar formulario
      e.target.reset()

      // Enfocar primer campo
      document.getElementById("nombre").focus()

      console.log(`Empleado registrado con ID: ${empleadoId}`)
    },
  )
})

// Event listener para limpiar formulario
document.getElementById("clear-btn").addEventListener("click", () => {
  if (confirm("¿Está seguro de que desea limpiar todos los campos?")) {
    document.getElementById("empleadoForm").reset()
    document.getElementById("nombre").focus()
  }
})

// Establecer fecha máxima como hoy para el campo fecha de ingreso
document.addEventListener("DOMContentLoaded", () => {
  const fechaIngreso = document.getElementById("fecha_ingreso")
  const hoy = new Date().toISOString().split("T")[0]
  fechaIngreso.max = hoy

  // Enfocar primer campo
  document.getElementById("nombre").focus()
})

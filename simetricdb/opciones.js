const sqlite3 = require("sqlite3").verbose()
// Conectar a la base de datos unificada
const dbPath = "simetricdb.sqlite"

// Conectar a la base de datos
const db = new sqlite3.Database("simetricdb.sqlite", (err) => {
  if (err) {
    console.error(err.message)
  } else {
    console.log("Conectado a la base de datos para opciones.")
    cargarConfiguraciones()
  }
})


// Función para cargar configuraciones al iniciar
function cargarConfiguraciones() {
  cargarTasaActual()
  cargarMembresias()
}

// Función para cargar la tasa actual
function cargarTasaActual() {
  db.get("SELECT valor FROM configuraciones WHERE clave = 'tasa_dia'", [], (err, row) => {
    if (err) {
      console.error("Error cargando tasa:", err.message)
      return
    }

    if (row) {
      document.getElementById("tasa_actual").value = row.valor
      document.getElementById("tasa_guardada_info").textContent = `Tasa guardada: ${row.valor} Bs/USD`
    }
  })
}

function crearTarjetaMembresia(membresia) {
  const card = document.createElement("div")
  card.className = "membresia-card"

  // Crear nombre descriptivo si no existe
  const nombreDescriptivo =
    membresia.descripcion || `Plan ${membresia.nombre.charAt(0).toUpperCase() + membresia.nombre.slice(1)}`

  card.innerHTML = `
    <h4>${nombreDescriptivo}</h4>
    <div class="precio-actual">$${membresia.precio_usd.toFixed(2)} USD</div>
    <div class="form-group">
      <label for="precio_${membresia.id}">Nuevo Precio (USD):</label>
      <input type="number" id="precio_${membresia.id}" step="0.01" value="${membresia.precio_usd.toFixed(2)}">
    </div>
    <div class="botones">
      <button class="btn-warning" onclick="actualizarPrecioMembresia(${membresia.id})">
        Actualizar Precio
      </button>
      ${
        membresia.nombre !== "diario" &&
        membresia.nombre !== "semanal" &&
        membresia.nombre !== "mensual" &&
        membresia.nombre !== "especial" &&
        membresia.nombre !== "parejas" &&
        membresia.nombre !== "familiar" &&
        membresia.nombre !== "estudiantil"
          ? `<button class="btn-danger" onclick="eliminarMembresia(${membresia.id})">Eliminar</button>`
          : ""
      }
    </div>
  `
  return card
}

document.getElementById("agregar_membresia").addEventListener("click", () => {
  const nombreOriginal = document.getElementById("nuevo_nombre").value.trim()
  const nombre = nombreOriginal.toLowerCase().replace(/\s+/g, "_")
  const precio = document.getElementById("nuevo_precio").value
  const duracion = document.getElementById("nueva_duracion").value

  // Crear descripción basada en el nombre original
  const descripcion = `Plan ${nombreOriginal}`

  if (!nombreOriginal || !precio) {
    mostrarMensaje("Por favor complete todos los campos obligatorios", "error")
    return
  }

  if (precio <= 0) {
    mostrarMensaje("El precio debe ser mayor a 0", "error")
    return
  }

  // Verificar si ya existe una membresía con ese nombre
  db.get("SELECT id FROM membresias WHERE nombre = ?", [nombre], (err, row) => {
    if (err) {
      console.error("Error verificando membresía:", err.message)
      mostrarMensaje("Error al verificar la membresía", "error")
      return
    }

    if (row) {
      mostrarMensaje("Ya existe una membresía con ese nombre", "error")
      return
    }

    // Insertar nueva membresía con descripción
    db.run(
      "INSERT INTO membresias (nombre, precio_usd, duracion_dias, descripcion) VALUES (?, ?, ?, ?)",
      [nombre, precio, duracion, descripcion],
      (err) => {
        if (err) {
          console.error("Error agregando membresía:", err.message)
          mostrarMensaje("Error al agregar la membresía", "error")
          return
        }

        // MOSTRAR ALERTA DE ÉXITO
        alert(
          `✅ Nueva membresía creada exitosamente!\n\nNombre: ${descripcion}\nPrecio: $${precio} USD\nDuración: ${duracion} días\n\n🔄 La membresía ya está disponible en todos los módulos del sistema.`,
        )
        mostrarMensaje("Nueva membresía agregada exitosamente", "success")

        // Limpiar formulario
        document.getElementById("nuevo_nombre").value = ""
        document.getElementById("nuevo_precio").value = ""
        document.getElementById("nueva_duracion").value = "30"

        cargarMembresias() // Recargar lista
      },
    )
  })
})

// Función para actualizar el precio de una membresía
function actualizarPrecioMembresia(membresiaId) {
  const nuevoPrecio = document.getElementById(`precio_${membresiaId}`).value

  if (!nuevoPrecio || nuevoPrecio <= 0) {
    mostrarMensaje("Por favor ingrese un precio válido", "error")
    return
  }

  db.run("UPDATE membresias SET precio_usd = ? WHERE id = ?", [nuevoPrecio, membresiaId], (err) => {
    if (err) {
      console.error("Error actualizando precio:", err.message)
      mostrarMensaje("Error al actualizar el precio", "error")
      return
    }

    mostrarMensaje("Precio actualizado exitosamente", "success")
    cargarMembresias() // Recargar para mostrar el nuevo precio
  })
}

// Función para eliminar una membresía (solo las personalizadas)
function eliminarMembresia(membresiaId) {
  if (!confirm("¿Está seguro de que desea eliminar esta membresía?")) {
    return
  }

  // Verificar si hay clientes con esta membresía
  db.get("SELECT COUNT(*) as count FROM clientes WHERE membresia_id = ?", [membresiaId], (err, row) => {
    if (err) {
      console.error("Error verificando clientes:", err.message)
      mostrarMensaje("Error al verificar clientes", "error")
      return
    }

    if (row.count > 0) {
      alert(`No se puede eliminar: hay ${row.count} cliente(s) con esta membresía`, "error")
      return
    }

    // Eliminar membresía
    db.run("DELETE FROM membresias WHERE id = ?", [membresiaId], (err) => {
      if (err) {
        console.error("Error eliminando membresía:", err.message)
        mostrarMensaje("Error al eliminar la membresía", "error")
        return
      }

      alert("Membresía eliminada exitosamente", "success")
      cargarMembresias() // Recargar lista
    })
  })
}

// Función para mostrar mensajes
function mostrarMensaje(mensaje, tipo) {
  // Remover mensajes anteriores
  const mensajesAnteriores = document.querySelectorAll(".success-message, .error-message")
  mensajesAnteriores.forEach((msg) => msg.remove())

  const div = document.createElement("div")
  div.className = tipo === "success" ? "success-message" : "error-message"
  div.textContent = mensaje

  // Insertar después del título principal
  const titulo = document.querySelector(".opciones-container h2")
  titulo.parentNode.insertBefore(div, titulo.nextSibling)

  // Remover después de 3 segundos
  setTimeout(() => {
    div.remove()
  }, 3000)
}

// Función para obtener la tasa guardada (para usar en otros módulos)
function obtenerTasaGuardada(callback) {
  db.get("SELECT valor FROM configuraciones WHERE clave = 'tasa_dia'", [], (err, row) => {
    if (err) {
      console.error("Error obteniendo tasa:", err.message)
      callback(null)
      return
    }

    callback(row ? Number.parseFloat(row.valor) : null)
  })
}

// Exportar función para otros módulos
if (typeof module !== "undefined" && module.exports) {
  module.exports = { obtenerTasaGuardada }
}

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

// Función para cargar membresías desde la base de datos
function cargarMembresias() {
  const query = `SELECT * FROM membresias ORDER BY nombre`

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Error cargando membresías:", err.message)
      return
    }

    const container = document.getElementById("membresias-grid")
    container.innerHTML = ""

    rows.forEach((membresia) => {
      const card = crearTarjetaMembresia(membresia)
      container.appendChild(card)
    })
  })
}

// Event listener para guardar tasa
document.getElementById("guardar_tasa").addEventListener("click", () => {
  const nuevaTasa = document.getElementById("tasa_actual").value

  if (!nuevaTasa || nuevaTasa <= 0) {
    mostrarMensaje("Por favor ingrese una tasa válida", "error")
    return
  }

  db.run(
    "UPDATE configuraciones SET valor = ?, fecha_actualizacion = datetime('now') WHERE clave = 'tasa_dia'",
    [nuevaTasa],
    (err) => {
      if (err) {
        console.error("Error guardando tasa:", err.message)
        mostrarMensaje("Error al guardar la tasa", "error")
        return
      }

      document.getElementById("tasa_guardada_info").textContent = `Tasa guardada: ${nuevaTasa} Bs/USD`
      mostrarMensaje("Tasa actualizada exitosamente", "success")
    },
  )
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

// Inicializar la carga de membresías al cargar la página
window.onload = cargarConfiguraciones

document.addEventListener("DOMContentLoaded", () => {
  console.log("Configurando redirección para menú de inventario...")
  configurarRedireccion()
})

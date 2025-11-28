const sqlite3 = require("sqlite3").verbose()

// Conectar a la base de datos
const db = new sqlite3.Database("simetricdb.sqlite", (err) => {
  if (err) {
    console.error(err.message)
  } else {
    console.log("Conectado a la base de datos para mostrar clientes.")
    cargarClientesDesdeDB()
  }
})

let clienteIdSeleccionado = null
let modoEdicion = false
let valoresOriginales = {}
let clientesOriginales = []
let membresiasFiltroYaCargadas = false // NUEVA VARIABLE: Para controlar carga del filtro
let membresiasActualizacionYaCargadas = false // NUEVA VARIABLE: Para controlar carga de actualización

// FUNCIÓN CORREGIDA: Cargar membresías dinámicamente en el filtro
function cargarMembresiasFiltro() {
  const selectFiltro = document.getElementById("filter-membresia")

  if (!selectFiltro) {
    console.error("No se encontró el select de filtro de membresías")
    return
  }

  // CORRECCIÓN: Solo cargar si no se han cargado ya
  if (membresiasFiltroYaCargadas) {
    console.log("Membresías del filtro ya cargadas, omitiendo carga duplicada")
    return
  }

  // Limpiar completamente el select
  selectFiltro.innerHTML = ""

  // Agregar opción "Todos"
  const opcionTodos = document.createElement("option")
  opcionTodos.value = "todos"
  opcionTodos.textContent = "Todas las membresías"
  selectFiltro.appendChild(opcionTodos)

  // Cargar membresías desde la base de datos
  const query = `SELECT DISTINCT nombre, descripcion FROM membresias ORDER BY nombre`

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Error cargando membresías para filtro:", err.message)
      return
    }

    rows.forEach((membresia) => {
      const option = document.createElement("option")
      option.value = membresia.nombre
      option.textContent =
        membresia.descripcion || `Plan ${membresia.nombre.charAt(0).toUpperCase() + membresia.nombre.slice(1)}`
      selectFiltro.appendChild(option)
    })

    membresiasFiltroYaCargadas = true // Marcar como cargadas
    console.log(`${rows.length} membresías cargadas en el filtro`)
  })
}

// FUNCIÓN CORREGIDA: Cargar membresías en el popup de actualización
function cargarMembresiasActualizacion() {
  const selectActualizacion = document.getElementById("nueva_membresia")

  if (!selectActualizacion) {
    console.error("No se encontró el select de actualización de membresías")
    return
  }

  // CORRECCIÓN: Solo cargar si no se han cargado ya
  if (membresiasActualizacionYaCargadas) {
    console.log("Membresías de actualización ya cargadas, omitiendo carga duplicada")
    return
  }

  // Limpiar completamente el select
  selectActualizacion.innerHTML = ""

  // Cargar membresías desde la base de datos con DISTINCT para evitar duplicados
  const query = `SELECT DISTINCT nombre, descripcion FROM membresias ORDER BY nombre`

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Error cargando membresías para actualización:", err.message)
      return
    }

    rows.forEach((membresia) => {
      const option = document.createElement("option")
      option.value = membresia.nombre
      option.textContent =
        membresia.descripcion || `Plan ${membresia.nombre.charAt(0).toUpperCase() + membresia.nombre.slice(1)}`
      selectActualizacion.appendChild(option)
    })

    membresiasActualizacionYaCargadas = true // Marcar como cargadas
    console.log(`${rows.length} membresías cargadas en actualización`)
  })
}

// FUNCIÓN CORREGIDA: Determinar si una membresía es mensual basándose en duración
function esMembresiaMensualPorDuracion(duracionDias) {
  // Una membresía es mensual si tiene 30 días de duración
  return duracionDias === 30
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
    // NUEVA LÓGICA: Si me registro el 2 de junio, vence el 1 de julio (el día 2 ya no tengo acceso)
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

// Función para verificar si una membresía está vigente
function estaVigente(fechaVencimiento) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const [year, month, day] = fechaVencimiento.split("-").map(Number)
  const fechaVenc = new Date(year, month - 1, day)
  fechaVenc.setHours(23, 59, 59, 999)

  return fechaVenc >= hoy
}

// Función para calcular días restantes
function calcularDiasRestantes(fechaVencimiento) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const [year, month, day] = fechaVencimiento.split("-").map(Number)
  const fechaVenc = new Date(year, month - 1, day)
  fechaVenc.setHours(23, 59, 59, 999)

  return Math.ceil((fechaVenc - hoy) / (1000 * 60 * 60 * 24))
}

// FUNCIÓN CORREGIDA: Cargar todos los clientes una sola vez desde la base de datos
function cargarClientesDesdeDB() {
  const query = `
    SELECT c.*, m.nombre as membresia_nombre, m.precio_usd, m.descripcion, m.duracion_dias
    FROM clientes c
    LEFT JOIN membresias m ON c.membresia_id = m.id
    ORDER BY c.nombre, c.apellido
  `

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error(err.message)
      return
    }
    clientesOriginales = rows
    filtrarYMostrarClientes()

    // CORRECCIÓN: Solo cargar membresías una vez al inicio
  
  })
}

// Función para actualizar la membresía de un cliente - CORREGIDA
function actualizarMembresia(clienteId, membresiaData) {
  // Obtener fecha actual correctamente
  const fechaHoy = new Date()
  const year = fechaHoy.getFullYear()
  const month = (fechaHoy.getMonth() + 1).toString().padStart(2, "0")
  const day = fechaHoy.getDate().toString().padStart(2, "0")
  const fechaRegistro = `${year}-${month}-${day}`

  // Calcular fecha de vencimiento correctamente usando la función corregida
  const fechaVencimiento = calcularFechaVencimiento(fechaRegistro, membresiaData.duracion_dias, membresiaData.nombre)

  // Actualizar el cliente en la base de datos o el array de clientes
  // Código para actualizar el cliente aquí
}

// Función para aplicar los filtros y mostrar los clientes
function filtrarYMostrarClientes() {
  const nombreFiltro = document.getElementById("search-name").value.toLowerCase()
  const cedulaFiltro = document.getElementById("search-cedula").value.toLowerCase()
  const estadoFiltro = document.getElementById("filter-status").value
  const membresiaFiltro = document.getElementById("filter-membresia").value

  const clientesFiltrados = clientesOriginales.filter((cliente) => {
    const nombreCompleto = `${cliente.nombre} ${cliente.apellido}`.toLowerCase()
    const coincideNombre = nombreCompleto.includes(nombreFiltro)
    const coincideCedula = cliente.cedula.toLowerCase().includes(cedulaFiltro)

    // Usar la función mejorada para verificar vigencia
    const clienteVigente = estaVigente(cliente.fecha_vencimiento)

    const coincideEstado =
      estadoFiltro === "todos" ||
      (estadoFiltro === "vigentes" && clienteVigente) ||
      (estadoFiltro === "vencidos" && !clienteVigente)

    const coincideMembresia =
      membresiaFiltro === "todos" ||
      (cliente.membresia_nombre && cliente.membresia_nombre.toLowerCase() === membresiaFiltro.toLowerCase())

    return coincideNombre && coincideCedula && coincideEstado && coincideMembresia
  })

  renderizarClientes(clientesFiltrados)
}

// Función para renderizar los clientes filtrados
function renderizarClientes(clientes) {
  const container = document.getElementById("client-container")
  container.innerHTML = ""

  if (clientes.length === 0) {
    container.innerHTML = "<p>No se encontraron clientes con esos filtros.</p>"
    return
  }

  const header = document.createElement("div")
  header.classList.add("table-header")
  header.innerHTML = `
    <div>Nombre</div>
    <div>Apellido</div>
    <div>Cédula</div>
    <div>Teléfono</div>
    <div>Membresía</div>
    <div>Fecha Registro</div>
    <div>Fecha Vencimiento</div>
    <div>Estado</div>
    <div>Acciones</div>
  `
  container.appendChild(header)

  clientes.forEach((cliente) => {
    const row = document.createElement("div")
    row.classList.add("table-row")

    // Usar las funciones mejoradas para calcular vigencia y días restantes
    const clienteVigente = estaVigente(cliente.fecha_vencimiento)
    const estadoClase = clienteVigente ? "vigente" : "vencido"

    // Calcular días restantes para mostrar indicador de proximidad
    const diasRestantes = calcularDiasRestantes(cliente.fecha_vencimiento)
    let indicadorProximidad = ""

    if (diasRestantes <= 3 && diasRestantes > 0) {
      indicadorProximidad = " 🔴" // Muy próximo a vencer
    } else if (diasRestantes <= 7 && diasRestantes > 3) {
      indicadorProximidad = " 🟡" // Próximo a vencer
    }

    row.innerHTML = `
      <div>${cliente.nombre}</div>
      <div>${cliente.apellido}</div>
      <div>${cliente.cedula}</div>
      <div>${cliente.telefono}</div>
      <div>${cliente.membresia_nombre || "N/A"}</div>
      <div>${cliente.fecha_registro}</div>
      <div>${cliente.fecha_vencimiento}${indicadorProximidad}</div>
      <div class="estado-clase">${estadoClase === "vigente" ? "Activo" : "Vencido"}</div>
      <div class="form-btn">
        <button class="actualizar-membresia" data-id="${cliente.id}">Actualizar Membresía</button>
        <button class="ver-detalles" data-id="${cliente.id}">Ver más</button>
      </div>
    `
    container.appendChild(row)
  })
}

// Evento: Ver detalles del cliente
document.addEventListener("click", (event) => {
  if (event.target.classList.contains("ver-detalles")) {
    const id = event.target.dataset.id
    clienteIdSeleccionado = id

    const query = `
      SELECT c.*, m.nombre as membresia_nombre, m.descripcion
      FROM clientes c
      LEFT JOIN membresias m ON c.membresia_id = m.id
      WHERE c.id = ?
    `

    db.get(query, [id], (err, cliente) => {
      if (err) {
        console.error("Error al obtener detalles:", err.message)
        return
      }

      if (cliente) {
        document.getElementById("detalle-nombre").value = cliente.nombre
        document.getElementById("detalle-apellido").value = cliente.apellido || ""
        document.getElementById("detalle-cedula").value = cliente.cedula
        document.getElementById("detalle-telefono").value = cliente.telefono
        document.getElementById("detalle-direccion").value = cliente.direccion
        document.getElementById("detalle-mail").value = cliente.mail
        document.getElementById("detalle-membresia").value = cliente.membresia_nombre || "N/A"
        document.getElementById("detalle-registro").value = cliente.fecha_registro
        document.getElementById("detalle-vencimiento").textContent = cliente.fecha_vencimiento

        if (document.getElementById("referencia")) {
          document.getElementById("referencia").value = cliente.referencia || ""
        }

        document.getElementById("popup-detalles").classList.remove("oculto")
      }
    })
  }
})

// Cerrar popup
document.getElementById("cerrar-popup").addEventListener("click", () => {
  const historialContenedor = document.getElementById("historial-pagos")
  historialContenedor.classList.add("hidden")
  historialContenedor.innerHTML = ""
  document.getElementById("btn-historial-pagos").textContent = "Ver Historial de Pagos"
  historialPagosVisible = false

  if (modoEdicion) {
    modoEdicion = false
    document.getElementById("boton-editar-guardar").textContent = "Editar"
    document.getElementById("eliminar-cliente").textContent = "Eliminar"

    if (valoresOriginales) {
      document.getElementById("detalle-nombre").value = valoresOriginales.nombre || ""
      document.getElementById("detalle-apellido").value = valoresOriginales.apellido || ""
      document.getElementById("detalle-cedula").value = valoresOriginales.cedula || ""
      document.getElementById("detalle-telefono").value = valoresOriginales.telefono || ""
      document.getElementById("detalle-direccion").value = valoresOriginales.direccion || ""
      document.getElementById("detalle-mail").value = valoresOriginales.mail || ""
    }

    document.getElementById("detalle-nombre").readOnly = true
    document.getElementById("detalle-apellido").readOnly = true
    document.getElementById("detalle-cedula").readOnly = true
    document.getElementById("detalle-telefono").readOnly = true
    document.getElementById("detalle-direccion").readOnly = true
    document.getElementById("detalle-mail").readOnly = true
  }

  clienteIdSeleccionado = null
  valoresOriginales = {}
  ocultarDesgloseIVAActualizacion() // Ocultar desglose al cerrar
  document.getElementById("popup-detalles").classList.add("oculto")
})

let historialPagosVisible = false

document.getElementById("btn-historial-pagos").addEventListener("click", () => {
  const contenedor = document.getElementById("historial-pagos")
  const boton = document.getElementById("btn-historial-pagos")

  if (!historialPagosVisible) {
    // Primero verificar si existe la columna membresia_id en pagos
    db.all("PRAGMA table_info(pagos)", [], (err, columns) => {
      if (err) {
        console.error("Error verificando estructura de pagos:", err.message)
        return
      }

      const tieneMembresiaId = columns.some((col) => col.name === "membresia_id")
      let query

      if (tieneMembresiaId) {
        // Si existe membresia_id, usar JOIN
        query = `
          SELECT p.*, m.nombre as membresia_nombre, m.descripcion
          FROM pagos p
          LEFT JOIN membresias m ON p.membresia_id = m.id
          WHERE p.cliente_id = ?
          ORDER BY p.fecha_pago DESC
        `
      } else {
        // Si no existe, usar el campo membresia directamente
        query = `
          SELECT p.*, p.membresia as membresia_nombre
          FROM pagos p
          WHERE p.cliente_id = ?
          ORDER BY p.fecha_pago DESC
        `
      }

      db.all(query, [clienteIdSeleccionado], (err, pagos) => {
        if (err) {
          console.error("Error al cargar historial de pagos:", err.message)
          return
        }

        contenedor.classList.remove("hidden")
        contenedor.innerHTML = "<h3>Historial de Pagos</h3>"

        if (pagos.length === 0) {
          contenedor.innerHTML += "<p>Este cliente no tiene pagos registrados.</p>"
        } else {
          const pagosPorMes = {}

          pagos.forEach((pago) => {
            const fecha = new Date(pago.fecha_pago)
            const mesAnio = fecha.toLocaleString("default", { month: "long", year: "numeric" })

            if (!pagosPorMes[mesAnio]) {
              pagosPorMes[mesAnio] = []
            }
            pagosPorMes[mesAnio].push(pago)
          })

          // Mostrar los pagos agrupados por mes
          for (const mes in pagosPorMes) {
            contenedor.innerHTML += `<h4 class="mes-header">🗓️ ${mes.charAt(0).toUpperCase() + mes.slice(1)}</h4>`

            pagosPorMes[mes].forEach((pago) => {
              contenedor.innerHTML += `
                <div class="pago-item">
                  <p><strong>📅 Fecha de pago:</strong> ${pago.fecha_pago}</p>
                  <p><strong>📝 Membresía:</strong> ${pago.membresia_nombre || pago.membresia || "N/A"}</p>
                  <p><strong>💳 Método de pago:</strong> ${pago.metodo_pago}</p>
                  <p><strong>💵 Monto en dólares:</strong> ${pago.monto_dolares.toFixed(2)} $</p>
                  <p><strong>💱 Tasa del día:</strong> ${pago.tasa_dia.toFixed(2)}</p>
                  <p><strong>💰 Monto en bolívares:</strong> ${pago.monto_bs.toFixed(2)} Bs</p>
                  ${pago.referencia ? `<p><strong>🔢 Referencia:</strong> ${pago.referencia}</p>` : ""}
                  <button class="generar-factura-btn" data-pago-id="${pago.id}" data-cliente-id="${clienteIdSeleccionado}">
                    🧾 Generar Factura
                  </button>
                  <hr>
                </div>
              `
            })
          }
        }

        boton.textContent = "Ocultar"
        historialPagosVisible = true
      })
    })
  } else {
    contenedor.classList.add("hidden")
    contenedor.innerHTML = ""
    boton.textContent = "Ver Historial de Pagos"
    historialPagosVisible = false
  }
})

// Evento: Guardar cambios del cliente
document.getElementById("boton-editar-guardar").addEventListener("click", function () {
  const botonEliminar = document.getElementById("eliminar-cliente")

  if (!modoEdicion) {
    // Entrar en modo edición
    modoEdicion = true
    this.textContent = "Guardar"
    botonEliminar.textContent = "Cancelar"

    // Guardar valores originales
    valoresOriginales = {
      nombre: document.getElementById("detalle-nombre").value,
      apellido: document.getElementById("detalle-apellido").value,
      cedula: document.getElementById("detalle-cedula").value,
      telefono: document.getElementById("detalle-telefono").value,
      direccion: document.getElementById("detalle-direccion").value,
      mail: document.getElementById("detalle-mail").value,
    }

    // Activar edición
    document.getElementById("detalle-nombre").readOnly = false
    document.getElementById("detalle-apellido").readOnly = false
    document.getElementById("detalle-cedula").readOnly = false
    document.getElementById("detalle-telefono").readOnly = false
    document.getElementById("detalle-direccion").readOnly = false
    document.getElementById("detalle-mail").readOnly = false
  } else {
    // Guardar los cambios
    const nombre = document.getElementById("detalle-nombre").value.trim()
    const apellido = document.getElementById("detalle-apellido").value.trim()
    const cedula = document.getElementById("detalle-cedula").value.trim()
    const telefono = document.getElementById("detalle-telefono").value.trim()
    const direccion = document.getElementById("detalle-direccion").value.trim()
    const mail = document.getElementById("detalle-mail").value.trim()

    db.run(
      `UPDATE clientes SET nombre = ?, apellido = ?, cedula = ?, telefono = ?, direccion = ?, mail = ? WHERE id = ?`,
      [nombre, apellido, cedula, telefono, direccion, mail, clienteIdSeleccionado],
      (err) => {
        if (err) {
          console.error(err.message)
          alert("Error al actualizar cliente.")
        } else {
          alert("Cliente actualizado exitosamente.")

          // Salir del modo edición
          modoEdicion = false
          this.textContent = "Editar"
          botonEliminar.textContent = "Eliminar"

          document.getElementById("detalle-nombre").readOnly = true
          document.getElementById("detalle-apellido").readOnly = true
          document.getElementById("detalle-cedula").readOnly = true
          document.getElementById("detalle-telefono").readOnly = true
          document.getElementById("detalle-direccion").readOnly = true
          document.getElementById("detalle-mail").readOnly = true

          document.getElementById("popup-detalles").classList.add("oculto")
          cargarClientesDesdeDB()
        }
      },
    )
  }
})

// Evento: Eliminar cliente
document.getElementById("eliminar-cliente").addEventListener("click", function () {
  const botonEditar = document.getElementById("boton-editar-guardar")

  if (modoEdicion) {
    // Cancelar edición
    modoEdicion = false
    botonEditar.textContent = "Editar"
    this.textContent = "Eliminar"

    // Restaurar valores originales
    document.getElementById("detalle-nombre").value = valoresOriginales.nombre
    document.getElementById("detalle-apellido").value = valoresOriginales.apellido
    document.getElementById("detalle-cedula").value = valoresOriginales.cedula
    document.getElementById("detalle-telefono").value = valoresOriginales.telefono
    document.getElementById("detalle-direccion").value = valoresOriginales.direccion
    document.getElementById("detalle-mail").value = valoresOriginales.mail

    // Desactivar edición
    document.getElementById("detalle-nombre").readOnly = true
    document.getElementById("detalle-apellido").readOnly = true
    document.getElementById("detalle-cedula").readOnly = true
    document.getElementById("detalle-telefono").readOnly = true
    document.getElementById("detalle-direccion").readOnly = true
    document.getElementById("detalle-mail").readOnly = true
  } else {
    // Confirmar eliminación
    const confirmar = confirm("¿Estás seguro de que deseas eliminar este cliente?")
    if (confirmar) {
      db.run(`DELETE FROM clientes WHERE id = ?`, [clienteIdSeleccionado], (err) => {
        if (err) {
          console.error(err.message)
          alert("Error al eliminar cliente.")
        } else {
          alert("Cliente eliminado correctamente.")
          document.getElementById("popup-detalles").classList.add("oculto")
          cargarClientesDesdeDB()
        }
      })
    }
  }
})

// NUEVAS FUNCIONES PARA IVA Y FACTURACIÓN EN ACTUALIZACIÓN DE MEMBRESÍA

// Función para cargar tasa automáticamente al iniciar
function cargarTasaAutomatica() {
  db.get("SELECT valor FROM configuraciones WHERE clave = 'tasa_dia'", [], (err, row) => {
    if (err) {
      console.error("Error cargando tasa:", err.message)
      return
    }

    if (row && document.getElementById("tasa_dia")) {
      document.getElementById("tasa_dia").value = row.valor
      calcularIVAyMostrarDesgloseActualizacion() // Recalcular si hay monto
    }
  })

  // CORRECCIÓN: Solo cargar membresías si no se han cargado ya
  if (!membresiasFiltroYaCargadas) {
    cargarMembresiasFiltro()
  }
  if (!membresiasActualizacionYaCargadas) {
    cargarMembresiasActualizacion()
  }
}

// Llamar la función al cargar la página
document.addEventListener("DOMContentLoaded", cargarTasaAutomatica)

// Función para calcular IVA y mostrar desglose en actualización
function calcularIVAyMostrarDesgloseActualizacion() {
  const montoTotal = Number.parseFloat(document.getElementById("monto_dolares").value) || 0
  const tasa = Number.parseFloat(document.getElementById("tasa_dia").value) || 0

  if (montoTotal > 0) {
    // Calcular montos con IVA del 16%
    const IVA_RATE = 0.16
    const montoSinIVA = montoTotal / (1 + IVA_RATE)
    const montoIVA = montoTotal - montoSinIVA

    // Calcular en bolívares
    const totalBs = montoTotal * tasa
    const sinIVABs = montoSinIVA * tasa
    const ivaBs = montoIVA * tasa

    // Actualizar campo de bolívares
    document.getElementById("monto_bs").value = totalBs.toFixed(2)

    // Mostrar desglose visual
    mostrarDesgloseIVAActualizacion(montoSinIVA, montoIVA, montoTotal, sinIVABs, ivaBs, totalBs)
  } else {
    document.getElementById("monto_bs").value = ""
    ocultarDesgloseIVAActualizacion()
  }
}

// Función para mostrar el desglose de IVA en actualización de membresía
function mostrarDesgloseIVAActualizacion(sinIVA, iva, total, sinIVABs, ivaBs, totalBs) {
  let desgloseContainer = document.getElementById("desglose-iva-actualizacion")

  if (!desgloseContainer) {
    // Crear contenedor si no existe
    desgloseContainer = document.createElement("div")
    desgloseContainer.id = "desglose-iva-actualizacion"
    desgloseContainer.className = "desglose-iva-actualizacion"

    // Insertar después del campo monto_bs en el formulario de actualización
    const montoBsInput = document.getElementById("monto_bs")
    montoBsInput.parentNode.insertBefore(desgloseContainer, montoBsInput.nextSibling)
  }

  desgloseContainer.innerHTML = `
    <div class="desglose-header-actualizacion">
      <h4>💰 Desglose de Pago (IVA 16%)</h4>
    </div>
    <div class="desglose-content-actualizacion">
      <div class="desglose-item-actualizacion">
        <span class="desglose-label-actualizacion">Subtotal (sin IVA):</span>
        <span class="desglose-value-actualizacion">$${sinIVA.toFixed(2)} USD</span>
        <span class="desglose-value-bs-actualizacion">(${sinIVABs.toFixed(2)} Bs)</span>
      </div>
      <div class="desglose-item-actualizacion">
        <span class="desglose-label-actualizacion">IVA (16%):</span>
        <span class="desglose-value-actualizacion">$${iva.toFixed(2)} USD</span>
        <span class="desglose-value-bs-actualizacion">(${ivaBs.toFixed(2)} Bs)</span>
      </div>
      <div class="desglose-item-actualizacion total">
        <span class="desglose-label-actualizacion">Total a Pagar:</span>
        <span class="desglose-value-actualizacion">$${total.toFixed(2)} USD</span>
        <span class="desglose-value-bs-actualizacion">(${totalBs.toFixed(2)} Bs)</span>
      </div>
    </div>
  `

  desgloseContainer.style.display = "block"
}

// Función para ocultar el desglose en actualización
function ocultarDesgloseIVAActualizacion() {
  const desgloseContainer = document.getElementById("desglose-iva-actualizacion")
  if (desgloseContainer) {
    desgloseContainer.style.display = "none"
  }
}

// Event listeners actualizados para actualización de membresía
document.getElementById("monto_dolares").addEventListener("input", calcularIVAyMostrarDesgloseActualizacion)
document.getElementById("tasa_dia").addEventListener("input", calcularIVAyMostrarDesgloseActualizacion)

// Función original mantenida para compatibilidad
function calcularMontoBs() {
  calcularIVAyMostrarDesgloseActualizacion()
}

// EVENTO CORREGIDO: Abrir popup de actualizar membresía
document.addEventListener("click", (event) => {
  if (event.target.classList.contains("actualizar-membresia")) {
    clienteIdSeleccionado = event.target.dataset.id

    // Obtener el nombre del cliente
    const cliente = clientesOriginales.find((c) => c.id == clienteIdSeleccionado)
    if (cliente) {
      const titulo = document.getElementById("titulo-actualizar-membresia")
      titulo.innerHTML = `Actualizar membresía de<br><strong>${cliente.nombre} ${cliente.apellido}</strong>`
    }

    // CORRECCIÓN: Cargar membresías solo si no están cargadas
    if (!membresiasActualizacionYaCargadas) {
      cargarMembresiasActualizacion()
    }

    document.getElementById("popup-actualizar").classList.remove("oculto")
  }
})

// Cerrar popup de actualizar membresía
document.getElementById("cerrar-popup-actualizar").addEventListener("click", () => {
  ocultarDesgloseIVAActualizacion() // Ocultar desglose al cerrar
  document.getElementById("popup-actualizar").classList.add("oculto")
})

// Evento: Enviar formulario para actualizar membresía - CORREGIDO
document.getElementById("form-actualizar-membresia").addEventListener("submit", (e) => {
  e.preventDefault()

  const nuevaMembresia = document.getElementById("nueva_membresia").value
  const montoDolares = Number.parseFloat(document.getElementById("monto_dolares").value) || 0
  const tasaDia = Number.parseFloat(document.getElementById("tasa_dia").value) || 0
  const montoBs = Number.parseFloat(document.getElementById("monto_bs").value) || 0
  const metodoPago = document.getElementById("metodo_pago").value
  const referencia = document.getElementById("referencia").value

  if ((metodoPago === "transferencia" || metodoPago === "pago_movil") && referencia === "") {
    alert("Debe ingresar el número de referencia para el método de pago seleccionado.")
    return
  }

  // Obtener ID de la nueva membresía
  db.get(
    "SELECT id, duracion_dias, descripcion, nombre FROM membresias WHERE nombre = ?",
    [nuevaMembresia],
    (err, membresiaData) => {
      if (err || !membresiaData) {
        alert("Error al obtener datos de la membresía.")
        return
      }

      // Obtener fecha actual correctamente
      const fechaHoy = new Date()
      const year = fechaHoy.getFullYear()
      const month = (fechaHoy.getMonth() + 1).toString().padStart(2, "0")
      const day = fechaHoy.getDate().toString().padStart(2, "0")
      const fechaRegistro = `${year}-${month}-${day}`

      // Calcular fecha de vencimiento correctamente usando la función corregida
      const fechaVencimiento = calcularFechaVencimiento(
        fechaRegistro,
        membresiaData.duracion_dias,
        membresiaData.nombre,
      )

      db.serialize(() => {
        // Actualizar el cliente
        db.run(
          `
        UPDATE clientes
        SET membresia_id = ?, fecha_registro = ?, fecha_vencimiento = ?, monto_dolares = ?, tasa_dia = ?, monto_bs = ?, metodo_pago = ?, referencia = ?
        WHERE id = ?
      `,
          [
            membresiaData.id,
            fechaRegistro,
            fechaVencimiento,
            montoDolares,
            tasaDia,
            montoBs,
            metodoPago,
            referencia,
            clienteIdSeleccionado,
          ],
          (err) => {
            if (err) {
              console.error(err.message)
              alert("❌ Error al actualizar la membresía y datos de pago.")
              return
            }

            // Registrar el pago en la tabla pagos
            db.run(
              `
            INSERT INTO pagos (cliente_id, fecha_pago, monto_dolares, tasa_dia, monto_bs, metodo_pago, membresia_id, referencia)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
              [
                clienteIdSeleccionado,
                fechaRegistro,
                montoDolares,
                tasaDia,
                montoBs,
                metodoPago,
                membresiaData.id,
                referencia,
              ],
              (err) => {
                if (err) {
                  console.error(err.message)
                  alert("❌ Error al registrar el pago.")
                } else {
                  alert("✅ Membresía y pago actualizados exitosamente.")

                  // Obtener datos del cliente para generar factura
                  db.get("SELECT * FROM clientes WHERE id = ?", [clienteIdSeleccionado], (err, cliente) => {
                    if (!err && cliente) {
                      // Generar factura automáticamente
                      const confirmarFactura = confirm(
                        `✅ Membresía actualizada exitosamente!\n\n` +
                          `Cliente: ${cliente.nombre} ${cliente.apellido}\n` +
                          `Nueva membresía: ${membresiaData.descripcion}\n` +
                          `Total: $${montoDolares.toFixed(2)} USD\n\n` +
                          `¿Desea generar la factura de actualización?`,
                      )

                      if (confirmarFactura) {
                        generarFacturaActualizacionMembresia(cliente, {
                          membresia: membresiaData.descripcion,
                          fechaRegistro,
                          fechaVencimiento,
                          montoDolares,
                          tasaDia,
                          montoBs,
                          metodoPago,
                          referencia,
                          duracion_dias: membresiaData.duracion_dias,
                          tipo_membresia: membresiaData.nombre,
                        })
                      }
                    }
                  })

                  document.getElementById("popup-actualizar").classList.add("oculto")
                  ocultarDesgloseIVAActualizacion()
                  cargarClientesDesdeDB()
                }
              },
            )
          },
        )
      })
    },
  )
})

// Función para generar factura de actualización de membresía - CORREGIDA
function generarFacturaActualizacionMembresia(cliente, datosActualizacion) {
  // Formateo correcto de fechas para evitar problemas de zona horaria
  const [yearReg, monthReg, dayReg] = datosActualizacion.fechaRegistro.split("-").map(Number)
  const fechaRegistroObj = new Date(yearReg, monthReg - 1, dayReg)
  const fechaFormateada = fechaRegistroObj.toLocaleDateString("es-ES")

  const [yearVenc, monthVenc, dayVenc] = datosActualizacion.fechaVencimiento.split("-").map(Number)
  const fechaVencimientoObj = new Date(yearVenc, monthVenc - 1, dayVenc)
  const fechaVencimientoFormateada = fechaVencimientoObj.toLocaleDateString("es-ES")
  const horaActual = new Date().toLocaleTimeString("es-ES")

  // Calcular duración real para mostrar en la factura
  const duracionReal = calcularDuracionReal(
    datosActualizacion.fechaRegistro,
    datosActualizacion.fechaVencimiento,
    datosActualizacion.tipo_membresia,
  )

  // Calcular IVA
  const IVA_RATE = 0.16
  const montoSinIVA = datosActualizacion.montoDolares / (1 + IVA_RATE)
  const montoIVA = datosActualizacion.montoDolares - montoSinIVA
  const sinIVABs = montoSinIVA * datosActualizacion.tasaDia
  const ivaBs = montoIVA * datosActualizacion.tasaDia

  const contenidoFactura = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Factura Actualización #${cliente.id} - SIMETRIC GYM</title>
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
        .actualizacion-info {
          background-color: #fff3cd;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
          border-left: 4px solid #ffc107;
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
        <div class="subtitle">Factura de Actualización de Membresía</div>
      </div>

      <div class="factura-info">
        <div class="info-section">
          <h3>📄 Información de la Factura</h3>
          <div class="info-item"><strong>Factura #:</strong> ACT-${cliente.id}</div>
          <div class="info-item"><strong>Fecha:</strong> ${fechaFormateada}</div>
          <div class="info-item"><strong>Hora:</strong> ${horaActual}</div>
          <div class="info-item"><strong>Atendido por:</strong> ${sessionStorage.getItem("usuarioActual") || "Sistema"}</div>
        </div>
        
        <div class="info-section">
          <h3>💳 Método de Pago</h3>
          <div class="info-item"><strong>Método:</strong> ${obtenerNombreMetodoPago(datosActualizacion.metodoPago)}</div>
          <div class="info-item"><strong>Tasa del día:</strong> ${datosActualizacion.tasaDia.toFixed(2)} Bs/USD</div>
          ${datosActualizacion.referencia ? `<div class="referencia"><strong>📱 Referencia:</strong> ${datosActualizacion.referencia}</div>` : ""}
        </div>
      </div>

      <div class="cliente-info">
        <h3>👤 Datos del Cliente</h3>
        <div class="info-item"><strong>Nombre:</strong> ${cliente.nombre} ${cliente.apellido}</div>
        <div class="info-item"><strong>Cédula:</strong> ${cliente.cedula}</div>
        <div class="info-item"><strong>Teléfono:</strong> ${cliente.telefono}</div>
        <div class="info-item"><strong>Email:</strong> ${cliente.mail}</div>
        <div class="info-item"><strong>Dirección:</strong> ${cliente.direccion}</div>
      </div>

      <div class="actualizacion-info">
        <h3>🔄 Actualización de Membresía</h3>
        <div class="info-item"><strong>Tipo de operación:</strong> Actualización de membresía</div>
        <div class="info-item"><strong>Nueva membresía:</strong> ${datosActualizacion.membresia}</div>
        <div class="info-item"><strong>Duración:</strong> ${duracionReal}</div>
        <div class="info-item" style="color: #28a745;"><strong>Nota:</strong> Las actualizaciones no incluyen costo de inscripción</div>
      </div>

      <div class="membresia-info">
        <h3>🏋️ Nueva Información de Membresía</h3>
        <div class="info-item"><strong>Plan:</strong> ${datosActualizacion.membresia}</div>
        <div class="info-item"><strong>Duración:</strong> ${duracionReal}</div>
        <div class="info-item"><strong>Fecha de inicio:</strong> ${fechaFormateada}</div>
        <div class="info-item"><strong>Fecha de vencimiento:</strong> ${fechaVencimientoFormateada}</div>
      </div>

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
            <td><strong>$${datosActualizacion.montoDolares.toFixed(2)}</strong></td>
            <td><strong>${datosActualizacion.montoBs.toFixed(2)} Bs</strong></td>
          </tr>
        </tbody>
      </table>

      <div class="vigencia">
        <h4>⏰ Nueva Vigencia de la Membresía</h4>
        <p>Esta membresía actualizada es válida desde el <strong>${fechaFormateada}</strong> hasta el <strong>${fechaVencimientoFormateada}</strong></p>
        <p>Duración total: <strong>${duracionReal}</strong></p>
      </div>

      <div class="footer">
        <p><strong>¡Gracias por continuar confiando en SIMETRIC GYM! <br>RIF: J-31700635/3</strong></p>
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

// Eventos de filtros
document.getElementById("search-name").addEventListener("input", filtrarYMostrarClientes)
document.getElementById("search-cedula").addEventListener("input", filtrarYMostrarClientes)
document.getElementById("filter-status").addEventListener("change", filtrarYMostrarClientes)
document.getElementById("filter-membresia").addEventListener("change", filtrarYMostrarClientes)

// Validaciones para campos con límites de dígitos
document.getElementById("detalle-cedula").addEventListener("input", (e) => {
  // Solo números y máximo 9 dígitos
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 9)
})

document.getElementById("detalle-telefono").addEventListener("input", (e) => {
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
    referenciaInput.value = ""
  } else {
    referenciaInput.disabled = true
    referenciaInput.required = false
    referenciaInput.placeholder = "No aplica"
    referenciaInput.value = ""
    referenciaInput.style.border = ""
  }
})

// EVENTO CORREGIDO: Cambio de membresía con lógica mejorada para actualización
document.getElementById("nueva_membresia").addEventListener("change", function () {
  const tipo = this.value
  const montoInput = document.getElementById("monto_dolares")

  // Obtener precio desde la base de datos (SIN inscripción para actualizaciones)
  db.get("SELECT precio_usd FROM membresias WHERE nombre = ?", [tipo], (err, membresia) => {
    if (err) {
      console.error("Error obteniendo precio de membresía:", err.message)
      return
    }

    if (membresia) {
      // En actualizaciones NO se cobra inscripción, solo el precio de la membresía
      montoInput.value = membresia.precio_usd.toFixed(2)
      calcularIVAyMostrarDesgloseActualizacion()
    }
  })
})

// Función para generar factura (mantenida para compatibilidad)
function generarFactura(pagoId, clienteId) {
  // Obtener datos del pago y cliente
  const queryPago = `
    SELECT p.*, m.nombre as membresia_nombre, m.descripcion
    FROM pagos p
    LEFT JOIN membresias m ON p.membresia_id = m.id
    WHERE p.id = ?
  `

  const queryCliente = `
    SELECT c.*, m.nombre as membresia_actual
    FROM clientes c
    LEFT JOIN membresias m ON c.membresia_id = m.id
    WHERE c.id = ?
  `

  db.get(queryPago, [pagoId], (err, pago) => {
    if (err) {
      // Fallback si no existe membresia_id
      db.get("SELECT * FROM pagos WHERE id = ?", [pagoId], (err2, pagoFallback) => {
        if (err2) {
          alert("Error al obtener datos del pago")
          return
        }
        procesarFactura(pagoFallback, clienteId)
      })
      return
    }

    if (!pago) {
      alert("Pago no encontrado")
      return
    }

    procesarFactura(pago, clienteId)
  })
}

function procesarFactura(pago, clienteId) {
  db.get("SELECT * FROM clientes WHERE id = ?", [clienteId], (err, cliente) => {
    if (err || !cliente) {
      alert("Error al obtener datos del cliente")
      return
    }

    mostrarFactura(pago, cliente)
  })
}

// Función mostrarFactura - CORREGIDA
function mostrarFactura(pago, cliente) {
  // Formateo correcto de fechas para evitar problemas de zona horaria
  const [yearPago, monthPago, dayPago] = pago.fecha_pago.split("-").map(Number)
  const fechaPagoObj = new Date(yearPago, monthPago - 1, dayPago)
  const fechaPago = fechaPagoObj.toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const numeroFactura = `FACT-${pago.id.toString().padStart(6, "0")}`

  // Calcular IVA para facturas históricas
  const IVA_RATE = 0.16
  const montoSinIVA = pago.monto_dolares / (1 + IVA_RATE)
  const montoIVA = pago.monto_dolares - montoSinIVA
  const sinIVABs = montoSinIVA * pago.tasa_dia
  const ivaBs = montoIVA * pago.tasa_dia

  const facturaHTML = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Factura ${numeroFactura}</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
                background-color: #fff;
                color: #333;
            }
            .header {
                text-align: center;
                border-bottom: 3px solid #880808;
                padding-bottom: 20px;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 2.5rem;
                font-weight: bold;
                color: #880808;
                margin-bottom: 10px;
            }
            .subtitle {
                color: #666;
                font-size: 1.1rem;
            }
            .factura-info {
                display: flex;
                justify-content: space-between;
                margin-bottom: 30px;
                flex-wrap: wrap;
            }
            .info-section {
                flex: 1;
                min-width: 250px;
                margin-bottom: 20px;
            }
            .info-section h3 {
                color: #880808;
                border-bottom: 1px solid #ddd;
                padding-bottom: 5px;
                margin-bottom: 15px;
            }
            .info-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
                padding: 5px 0;
            }
            .info-label {
                font-weight: bold;
                color: #555;
            }
            .info-value {
                color: #333;
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
            .detalle-pago {
                background-color: #f8f9fa;
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
            }
            .total-section {
                background-color: #880808;
                color: white;
                padding: 15px;
                border-radius: 8px;
                text-align: center;
                margin: 20px 0;
            }
            .total-amount {
                font-size: 1.5rem;
                font-weight: bold;
            }
            .footer {
                text-align: center;
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #ddd;
                color: #666;
                font-size: 0.9rem;
            }
            .print-btn {
                background-color: #880808;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 1rem;
                margin: 10px;
            }
            .print-btn:hover {
                background-color: #aa1010;
            }
            @media print {
                .print-btn {
                    display: none;
                }
                body {
                    margin: 0;
                    padding: 15px;
                }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="logo">🏋️ SIMETRIC GYM</div>
            <div class="subtitle">Tu gimnasio de confianza</div>
        </div>
        
        <div class="factura-info">
            <div class="info-section">
                <h3>📋 Información de la Factura</h3>
                <div class="info-row">
                    <span class="info-label">Número de Factura:</span>
                    <span class="info-value">${numeroFactura}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Fecha de Emisión:</span>
                    <span class="info-value">${fechaPago}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Fecha de Pago:</span>
                    <span class="info-value">${pago.fecha_pago}</span>
                </div>
            </div>
            
            <div class="info-section">
                <h3>👤 Datos del Cliente</h3>
                <div class="info-row">
                    <span class="info-label">Nombre:</span>
                    <span class="info-value">${cliente.nombre} ${cliente.apellido || ""}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Cédula:</span>
                    <span class="info-value">${cliente.cedula}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Teléfono:</span>
                    <span class="info-value">${cliente.telefono}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Email:</span>
                    <span class="info-value">${cliente.mail}</span>
                </div>
            </div>
        </div>

        <div class="detalle-pago">
            <h3 style="color: #880808; margin-top: 0;">💳 Detalle del Pago</h3>
            <div class="info-row">
                <span class="info-label">Concepto:</span>
                <span class="info-value">Pago de Membresía - ${pago.membresia_nombre || pago.membresia || "N/A"}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Método de Pago:</span>
                <span class="info-value">${obtenerNombreMetodoPago(pago.metodo_pago)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Tasa del Día:</span>
                <span class="info-value">${pago.tasa_dia.toFixed(2)} Bs/$</span>
            </div>
            ${
              pago.referencia
                ? `
            <div class="info-row">
                <span class="info-label">Referencia:</span>
                <span class="info-value">${pago.referencia}</span>
            </div>
            `
                : ""
            }
        </div>

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
                    <td><strong>TOTAL PAGADO</strong></td>
                    <td><strong>$${pago.monto_dolares.toFixed(2)}</strong></td>
                    <td><strong>${pago.monto_bs.toFixed(2)} Bs</strong></td>
                </tr>
            </tbody>
        </table>

        <div class="footer">
            <p><strong>SIMETRIC GYM</strong></p>
            <p>Gracias por confiar en nosotros para tu entrenamiento <br>RIF: J-31700635/3</p>
            <p style="font-size: 0.8rem; margin-top: 15px;">
                Esta factura es un comprobante de pago válido con IVA del 16% incluido.<br>
                Para cualquier consulta, contáctanos en el gimnasio.
            </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
            <button class="print-btn" onclick="window.print()">🖨️ Imprimir Factura</button>
            <button class="print-btn" onclick="window.close()">❌ Cerrar</button>
        </div>
    </body>
    </html>
  `

  // Abrir en nueva ventana
  const ventanaFactura = window.open("", "_blank", "width=800,height=900,scrollbars=yes")
  ventanaFactura.document.write(facturaHTML)
  ventanaFactura.document.close()
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

// Event listener para botones de generar factura
document.addEventListener("click", (event) => {
  if (event.target.classList.contains("generar-factura-btn")) {
    const pagoId = event.target.dataset.pagoId
    const clienteId = event.target.dataset.clienteId
    generarFactura(pagoId, clienteId)
  }
})

// Hacer el campo monto_dolares readonly ya que se llena automáticamente
document.getElementById("monto_dolares").readOnly = true
document.getElementById("monto_dolares").style.backgroundColor = "#2a2a2a"
document.getElementById("monto_dolares").style.cursor = "not-allowed"

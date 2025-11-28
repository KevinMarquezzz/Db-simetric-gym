const sqlite3 = require("sqlite3").verbose()

const db = new sqlite3.Database("simetricdb.sqlite", (err) => {
  if (err) {
    console.error("Error al conectar con la base de datos:", err.message)
  } else {
    console.log("Conectado a la base de datos para reportes de personal.")
  }
})

// Variables globales
let tipoReporteActual = "empleados"
let datosReporte = []
const configuracionReporte = {
  formato: "detallado",
  incluirGraficos: true,
  incluirFirmas: true,
  incluirFechaHora: true,
  campos: [],
}

// Configuraciones de campos por tipo de reporte
const CAMPOS_REPORTE = {
  empleados: [
    { id: "nombre", label: "Nombre Completo", activo: true },
    { id: "cedula", label: "Cédula", activo: true },
    { id: "cargo", label: "Cargo", activo: true },
    { id: "telefono", label: "Teléfono", activo: true },
    { id: "email", label: "Email", activo: false },
    { id: "direccion", label: "Dirección", activo: false },
    { id: "fecha_ingreso", label: "Fecha de Ingreso", activo: true },
    { id: "antiguedad", label: "Antigüedad", activo: true },
    { id: "sueldo_base", label: "Sueldo Base", activo: true },
    { id: "tipo_jornada", label: "Tipo de Jornada", activo: true },
    { id: "estatus", label: "Estatus", activo: true },
    { id: "banco", label: "Banco", activo: false },
    { id: "cuenta_bancaria", label: "Cuenta Bancaria", activo: false },
  ],
  nomina: [
    { id: "empleado", label: "Empleado", activo: true },
    { id: "cargo", label: "Cargo", activo: true },
    { id: "dias_trabajados", label: "Días Trabajados", activo: true },
    { id: "sueldo_base", label: "Sueldo Base", activo: true },
    { id: "dias_feriados", label: "Días Feriados", activo: true },
    { id: "monto_dias_feriados", label: "Monto Días Feriados", activo: true },
    { id: "bonos", label: "Bonos", activo: true },
    { id: "comisiones", label: "Comisiones", activo: true },
    { id: "total_devengado", label: "Total Devengado", activo: true },
    { id: "seguro_social", label: "Seguro Social", activo: true },
    { id: "lph", label: "LPH", activo: true },
    { id: "paro_forzoso", label: "Paro Forzoso", activo: true },
    { id: "total_deducciones", label: "Total Deducciones", activo: true },
    { id: "sueldo_neto", label: "Sueldo Neto", activo: true },
    { id: "prestaciones", label: "Prestaciones", activo: false },
    { id: "vacaciones", label: "Vacaciones", activo: false },
  ],
  prestaciones: [
    { id: "empleado", label: "Empleado", activo: true },
    { id: "cargo", label: "Cargo", activo: true },
    { id: "fecha_ingreso", label: "Fecha de Ingreso", activo: true },
    { id: "antiguedad", label: "Antigüedad", activo: true },
    { id: "sueldo_base", label: "Sueldo Base", activo: true },
    { id: "prestaciones_base", label: "Prestaciones Base", activo: true },
    { id: "intereses", label: "Intereses", activo: true },
    { id: "total_prestaciones", label: "Total Prestaciones", activo: true },
  ],
  costos: [
    { id: "periodo", label: "Período", activo: true },
    { id: "empleados_activos", label: "Empleados Activos", activo: true },
    { id: "total_sueldos", label: "Total Sueldos", activo: true },
    { id: "total_deducciones", label: "Total Deducciones", activo: true },
    { id: "costo_empresa", label: "Costo para la Empresa", activo: true },
    { id: "prestaciones_mes", label: "Prestaciones del Mes", activo: true },
    { id: "costo_total", label: "Costo Total", activo: true },
  ],
  antiguedad: [
    { id: "empleado", label: "Empleado", activo: true },
    { id: "cargo", label: "Cargo", activo: true },
    { id: "fecha_ingreso", label: "Fecha de Ingreso", activo: true },
    { id: "años", label: "Años", activo: true },
    { id: "meses", label: "Meses", activo: true },
    { id: "dias", label: "Días", activo: true },
    { id: "rango_antiguedad", label: "Rango de Antigüedad", activo: true },
  ],
  comparativo: [
    { id: "concepto", label: "Concepto", activo: true },
    { id: "periodo_1", label: "Período 1", activo: true },
    { id: "periodo_2", label: "Período 2", activo: true },
    { id: "diferencia", label: "Diferencia", activo: true },
    { id: "porcentaje", label: "% Variación", activo: true },
  ],
}

// Inicializar página
document.addEventListener("DOMContentLoaded", () => {
  inicializarEventListeners()
  cargarEstadisticasRapidas()
  mostrarFiltros("empleados")
})

// Event listeners
function inicializarEventListeners() {
  // Selector de tipo de reporte
  document.querySelectorAll(".tipo-card").forEach((card) => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".tipo-card").forEach((c) => c.classList.remove("active"))
      card.classList.add("active")
      tipoReporteActual = card.dataset.tipo
      mostrarFiltros(tipoReporteActual)
      document.getElementById("vista-previa").style.display = "none"
    })
  })

  // Botones principales
  document.getElementById("generar-pdf").addEventListener("click", generarPDF)
  document.getElementById("actualizar-vista").addEventListener("click", actualizarVistaPrevia)

  // Popup de configuración
  document.getElementById("cerrar-popup-config").addEventListener("click", cerrarPopupConfig)
  document.getElementById("aplicar-config").addEventListener("click", aplicarConfiguracion)
  document.getElementById("cancelar-config").addEventListener("click", cerrarPopupConfig)
}

// Función para mostrar filtros según el tipo de reporte
function mostrarFiltros(tipo) {
  const container = document.getElementById("filtros-container")
  let filtrosHTML = ""

  switch (tipo) {
    case "empleados":
      filtrosHTML = `
        <h3>🔍 Filtros para Reporte de Empleados</h3>
        <div class="filtros-grid">
          <div class="filtro-group">
            <label for="filtro-estatus">Estatus:</label>
            <select id="filtro-estatus">
              <option value="todos">Todos</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
            </select>
          </div>
          <div class="filtro-group">
            <label for="filtro-cargo">Cargo:</label>
            <select id="filtro-cargo">
              <option value="todos">Todos</option>
              <option value="administrador">Administrador</option>
              <option value="recepcionista">Recepcionista</option>
              <option value="entrenador">Entrenador</option>
              <option value="limpieza">Limpieza</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="seguridad">Seguridad</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div class="filtro-group">
            <label for="filtro-jornada">Jornada:</label>
            <select id="filtro-jornada">
              <option value="todos">Todas</option>
              <option value="tiempo_completo">Tiempo Completo</option>
              <option value="medio_tiempo">Medio Tiempo</option>
              <option value="freelance">Freelance</option>
              <option value="por_horas">Por Horas</option>
            </select>
          </div>
          <div class="filtro-group">
            <label for="filtro-antiguedad">Antigüedad mínima (años):</label>
            <input type="number" id="filtro-antiguedad" min="0" value="0">
          </div>
        </div>
      `
      break

    case "nomina":
      filtrosHTML = `
        <h3>💰 Filtros para Reporte de Nómina</h3>
        <div class="filtros-grid">
          <div class="filtro-group">
            <label for="filtro-mes">Mes:</label>
            <select id="filtro-mes">
              ${generarOpcionesMeses()}
            </select>
          </div>
          <div class="filtro-group">
            <label for="filtro-año">Año:</label>
            <select id="filtro-año">
              ${generarOpcionesAños()}
            </select>
          </div>
          <div class="filtro-group">
            <label for="filtro-estatus-nomina">Estatus:</label>
            <select id="filtro-estatus-nomina">
              <option value="todos">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="procesada">Procesada</option>
              <option value="pagada">Pagada</option>
            </select>
          </div>
          <div class="filtro-group">
            <label for="filtro-cargo-nomina">Cargo:</label>
            <select id="filtro-cargo-nomina">
              <option value="todos">Todos</option>
              <option value="administrador">Administrador</option>
              <option value="recepcionista">Recepcionista</option>
              <option value="entrenador">Entrenador</option>
              <option value="limpieza">Limpieza</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="seguridad">Seguridad</option>
              <option value="otro">Otro</option>
            </select>
          </div>
        </div>
      `
      break

    case "prestaciones":
      filtrosHTML = `
        <h3>🏦 Filtros para Reporte de Prestaciones</h3>
        <div class="filtros-grid">
          <div class="filtro-group">
            <label for="filtro-año-prestaciones">Año de cálculo:</label>
            <select id="filtro-año-prestaciones">
              ${generarOpcionesAños()}
            </select>
          </div>
          <div class="filtro-group">
            <label for="filtro-estatus-prestaciones">Estatus del empleado:</label>
            <select id="filtro-estatus-prestaciones">
              <option value="activo">Solo Activos</option>
              <option value="todos">Todos</option>
              <option value="inactivo">Solo Inactivos</option>
            </select>
          </div>
          <div class="filtro-group">
            <label for="filtro-antiguedad-min">Antigüedad mínima (años):</label>
            <input type="number" id="filtro-antiguedad-min" min="0" value="1">
          </div>
          <div class="filtro-group">
            <label for="filtro-monto-min">Monto mínimo (USD):</label>
            <input type="number" id="filtro-monto-min" min="0" step="0.01" value="0">
          </div>
        </div>
      `
      break

    case "costos":
      filtrosHTML = `
        <h3>📈 Filtros para Reporte de Costos Laborales</h3>
        <div class="filtros-grid">
          <div class="filtro-group">
            <label for="filtro-desde-mes">Desde mes:</label>
            <select id="filtro-desde-mes">
              ${generarOpcionesMeses()}
            </select>
          </div>
          <div class="filtro-group">
            <label for="filtro-desde-año">Desde año:</label>
            <select id="filtro-desde-año">
              ${generarOpcionesAños()}
            </select>
          </div>
          <div class="filtro-group">
            <label for="filtro-hasta-mes">Hasta mes:</label>
            <select id="filtro-hasta-mes">
              ${generarOpcionesMeses()}
            </select>
          </div>
          <div class="filtro-group">
            <label for="filtro-hasta-año">Hasta año:</label>
            <select id="filtro-hasta-año">
              ${generarOpcionesAños()}
            </select>
          </div>
        </div>
      `
      break

    case "antiguedad":
      filtrosHTML = `
        <h3>⏳ Filtros para Reporte de Antigüedad</h3>
        <div class="filtros-grid">
          <div class="filtro-group">
            <label for="filtro-estatus-antiguedad">Estatus:</label>
            <select id="filtro-estatus-antiguedad">
              <option value="activo">Solo Activos</option>
              <option value="todos">Todos</option>
              <option value="inactivo">Solo Inactivos</option>
            </select>
          </div>
          <div class="filtro-group">
            <label for="filtro-rango-antiguedad">Rango de antigüedad:</label>
            <select id="filtro-rango-antiguedad">
              <option value="todos">Todos</option>
              <option value="nuevo">Menos de 1 año</option>
              <option value="junior">1-3 años</option>
              <option value="senior">3-5 años</option>
              <option value="veterano">Más de 5 años</option>
            </select>
          </div>
          <div class="filtro-group">
            <label for="filtro-ordenar-por">Ordenar por:</label>
            <select id="filtro-ordenar-por">
              <option value="antiguedad_desc">Antigüedad (Mayor a menor)</option>
              <option value="antiguedad_asc">Antigüedad (Menor a mayor)</option>
              <option value="nombre">Nombre</option>
              <option value="cargo">Cargo</option>
            </select>
          </div>
        </div>
      `
      break

    case "comparativo":
      filtrosHTML = `
        <h3>📊 Filtros para Reporte Comparativo</h3>
        <div class="filtros-grid">
          <div class="filtro-group">
            <label for="filtro-periodo1-mes">Período 1 - Mes:</label>
            <select id="filtro-periodo1-mes">
              ${generarOpcionesMeses()}
            </select>
          </div>
          <div class="filtro-group">
            <label for="filtro-periodo1-año">Período 1 - Año:</label>
            <select id="filtro-periodo1-año">
              ${generarOpcionesAños()}
            </select>
          </div>
          <div class="filtro-group">
            <label for="filtro-periodo2-mes">Período 2 - Mes:</label>
            <select id="filtro-periodo2-mes">
              ${generarOpcionesMeses()}
            </select>
          </div>
          <div class="filtro-group">
            <label for="filtro-periodo2-año">Período 2 - Año:</label>
            <select id="filtro-periodo2-año">
              ${generarOpcionesAños()}
            </select>
          </div>
        </div>
      `
      break
  }

  filtrosHTML += `
    <div class="filtros-acciones">
      <button id="generar-reporte" class="btn-primary">📊 Generar Reporte</button>
      <button id="config-avanzada" class="btn-info">⚙️ Configuración Avanzada</button>
      <button id="limpiar-filtros" class="btn-secondary">🗑️ Limpiar Filtros</button>
    </div>
  `

  container.innerHTML = filtrosHTML

  // Establecer valores por defecto
  establecerValoresPorDefecto()

  // Agregar event listeners
  document.getElementById("generar-reporte").addEventListener("click", generarReporte)
  document.getElementById("config-avanzada").addEventListener("click", abrirConfiguracionAvanzada)
  document.getElementById("limpiar-filtros").addEventListener("click", limpiarFiltros)
}

// Función para generar opciones de meses
function generarOpcionesMeses() {
  const meses = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ]

  const mesActual = new Date().getMonth() + 1
  return meses
    .map((mes, index) => {
      const valor = index + 1
      const selected = valor === mesActual ? "selected" : ""
      return `<option value="${valor}" ${selected}>${mes}</option>`
    })
    .join("")
}

// Función para generar opciones de años
function generarOpcionesAños() {
  const añoActual = new Date().getFullYear()
  let opciones = ""

  for (let año = 2020; año <= añoActual + 1; año++) {
    const selected = año === añoActual ? "selected" : ""
    opciones += `<option value="${año}" ${selected}>${año}</option>`
  }

  return opciones
}

// Función para establecer valores por defecto
function establecerValoresPorDefecto() {
  const fechaActual = new Date()
  const mesActual = fechaActual.getMonth() + 1
  const añoActual = fechaActual.getFullYear()

  // Establecer mes y año actual donde aplique
  const selectores = [
    "filtro-mes",
    "filtro-año",
    "filtro-año-prestaciones",
    "filtro-desde-mes",
    "filtro-desde-año",
    "filtro-hasta-mes",
    "filtro-hasta-año",
    "filtro-periodo1-mes",
    "filtro-periodo1-año",
    "filtro-periodo2-mes",
    "filtro-periodo2-año",
  ]

  selectores.forEach((selectorId) => {
    const elemento = document.getElementById(selectorId)
    if (elemento) {
      if (selectorId.includes("mes")) {
        elemento.value = mesActual
      } else if (selectorId.includes("año")) {
        elemento.value = añoActual
      }
    }
  })

  // Para período 2 en comparativo, establecer mes anterior
  const periodo2Mes = document.getElementById("filtro-periodo2-mes")
  if (periodo2Mes) {
    const mesAnterior = mesActual === 1 ? 12 : mesActual - 1
    periodo2Mes.value = mesAnterior
  }

  const periodo2Año = document.getElementById("filtro-periodo2-año")
  if (periodo2Año && mesActual === 1) {
    periodo2Año.value = añoActual - 1
  }
}

// Función para generar reporte
function generarReporte() {
  switch (tipoReporteActual) {
    case "empleados":
      generarReporteEmpleados()
      break
    case "nomina":
      generarReporteNomina()
      break
    case "prestaciones":
      generarReportePrestaciones()
      break
    case "costos":
      generarReporteCostos()
      break
    case "antiguedad":
      generarReporteAntiguedad()
      break
    case "comparativo":
      generarReporteComparativo()
      break
  }
}

// Función para generar reporte de empleados (MEJORADA)
function generarReporteEmpleados() {
  const filtros = {
    estatus: document.getElementById("filtro-estatus").value,
    cargo: document.getElementById("filtro-cargo").value,
    jornada: document.getElementById("filtro-jornada").value,
    antiguedadMin: Number.parseInt(document.getElementById("filtro-antiguedad").value) || 0,
  }

  let query = "SELECT * FROM empleados WHERE 1=1"
  const params = []

  if (filtros.estatus !== "todos") {
    query += " AND estatus = ?"
    params.push(filtros.estatus)
  }

  if (filtros.cargo !== "todos") {
    query += " AND cargo = ?"
    params.push(filtros.cargo)
  }

  if (filtros.jornada !== "todos") {
    query += " AND tipo_jornada = ?"
    params.push(filtros.jornada)
  }

  query += " ORDER BY nombre, apellido"

  db.all(query, params, (err, empleados) => {
    if (err) {
      console.error("Error generando reporte de empleados:", err.message)
      alert("Error al generar el reporte.")
      return
    }

    // Filtrar por antigüedad y procesar datos
    const empleadosFiltrados = empleados.filter((empleado) => {
      const antiguedad = calcularAntiguedad(empleado.fecha_ingreso)
      return antiguedad.años >= filtros.antiguedadMin
    })

    // Procesar datos para el reporte con mejor formateo de nombres
    datosReporte = empleadosFiltrados.map((empleado) => {
      const antiguedad = calcularAntiguedad(empleado.fecha_ingreso)

      // Formatear nombre completo correctamente
      const nombreCompleto = `${empleado.nombre.trim()} ${empleado.apellido.trim()}`

      return {
        ...empleado,
        nombre_completo: nombreCompleto,
        antiguedad_texto: `${antiguedad.años} años, ${antiguedad.meses} meses`,
        cargo_formateado: formatearCargo(empleado.cargo),
        jornada_formateada: formatearJornada(empleado.tipo_jornada),
        fecha_ingreso_formateada: formatearFecha(empleado.fecha_ingreso),
        estatus_formateado: empleado.estatus === "activo" ? "Activo" : "Inactivo",
        sueldo_formateado: `$${(empleado.sueldo_base || 0).toFixed(2)} USD`,
        telefono_formateado: formatearTelefono(empleado.telefono),
        cedula_formateada: formatearCedula(empleado.cedula),
      }
    })

    mostrarVistaPrevia("empleados")
  })
}

// Función para generar reporte de nómina (MEJORADA)
function generarReporteNomina() {
  const mes = Number.parseInt(document.getElementById("filtro-mes").value)
  const año = Number.parseInt(document.getElementById("filtro-año").value)
  const estatus = document.getElementById("filtro-estatus-nomina").value
  const cargo = document.getElementById("filtro-cargo-nomina").value

  let query = `
    SELECT n.*, e.nombre, e.apellido, e.cargo
    FROM nomina n
    INNER JOIN empleados e ON n.empleado_id = e.id
    WHERE n.mes = ? AND n.año = ?
  `
  const params = [mes, año]

  if (estatus !== "todos") {
    query += " AND n.estatus = ?"
    params.push(estatus)
  }

  if (cargo !== "todos") {
    query += " AND e.cargo = ?"
    params.push(cargo)
  }

  query += " ORDER BY e.nombre, e.apellido"

  db.all(query, params, (err, nominas) => {
    if (err) {
      console.error("Error generando reporte de nómina:", err.message)
      alert("Error al generar el reporte.")
      return
    }

    if (nominas.length === 0) {
      alert("No se encontraron datos de nómina para los filtros seleccionados.")
      return
    }

    // Procesar datos para el reporte con mejor formateo
    datosReporte = nominas.map((nomina) => {
      // Formatear nombre completo correctamente
      const nombreCompleto = `${nomina.nombre.trim()} ${nomina.apellido.trim()}`

      return {
        ...nomina,
        empleado_completo: nombreCompleto,
        cargo_formateado: formatearCargo(nomina.cargo),
        periodo_texto: `${obtenerNombreMes(mes)} ${año}`,
        estatus_formateado: formatearEstatus(nomina.estatus),
        // Formatear montos correctamente
        sueldo_base_formateado: `$${(nomina.sueldo_base || 0).toFixed(2)}`,
        total_devengado_formateado: `$${(nomina.total_devengado || 0).toFixed(2)}`,
        total_deducciones_formateado: `$${(nomina.total_deducciones || 0).toFixed(2)}`,
        sueldo_neto_formateado: `$${(nomina.sueldo_neto || 0).toFixed(2)}`,
        dias_trabajados_texto: `${nomina.dias_trabajados || 0} días`,
        dias_feriados_texto: nomina.dias_feriados ? `${nomina.dias_feriados} días` : "N/A",
      }
    })

    mostrarVistaPrevia("nomina")
  })
}

// Función para generar reporte de prestaciones (MEJORADA)
function generarReportePrestaciones() {
  const año = Number.parseInt(document.getElementById("filtro-año-prestaciones").value)
  const estatus = document.getElementById("filtro-estatus-prestaciones").value
  const antiguedadMin = Number.parseInt(document.getElementById("filtro-antiguedad-min").value) || 0
  const montoMin = Number.parseFloat(document.getElementById("filtro-monto-min").value) || 0

  let query = "SELECT * FROM empleados WHERE 1=1"
  const params = []

  if (estatus !== "todos") {
    query += " AND estatus = ?"
    params.push(estatus)
  }

  query += " ORDER BY nombre, apellido"

  db.all(query, params, (err, empleados) => {
    if (err) {
      console.error("Error generando reporte de prestaciones:", err.message)
      alert("Error al generar el reporte.")
      return
    }

    // Calcular prestaciones para cada empleado con mejor formateo
    datosReporte = empleados
      .map((empleado) => {
        const antiguedad = calcularAntiguedad(empleado.fecha_ingreso)
        const prestacionesBase = calcularPrestacionesBase(empleado.sueldo_base, antiguedad.años)
        const intereses = prestacionesBase * 0.12 * antiguedad.años
        const totalPrestaciones = prestacionesBase + intereses

        // Formatear nombre completo correctamente
        const nombreCompleto = `${empleado.nombre.trim()} ${empleado.apellido.trim()}`

        return {
          ...empleado,
          empleado_completo: nombreCompleto,
          cargo_formateado: formatearCargo(empleado.cargo),
          fecha_ingreso_formateada: formatearFecha(empleado.fecha_ingreso),
          antiguedad_años: antiguedad.años,
          antiguedad_meses: antiguedad.meses,
          antiguedad_texto: `${antiguedad.años} años, ${antiguedad.meses} meses`,
          prestaciones_base: prestacionesBase,
          intereses: intereses,
          total_prestaciones: totalPrestaciones,
          // Formatear montos
          sueldo_base_formateado: `$${(empleado.sueldo_base || 0).toFixed(2)}`,
          prestaciones_base_formateado: `$${prestacionesBase.toFixed(2)}`,
          intereses_formateado: `$${intereses.toFixed(2)}`,
          total_prestaciones_formateado: `$${totalPrestaciones.toFixed(2)}`,
        }
      })
      .filter((empleado) => empleado.antiguedad_años >= antiguedadMin && empleado.total_prestaciones >= montoMin)

    mostrarVistaPrevia("prestaciones")
  })
}

// Función para generar reporte de costos (MEJORADA)
function generarReporteCostos() {
  const desdeMes = Number.parseInt(document.getElementById("filtro-desde-mes").value)
  const desdeAño = Number.parseInt(document.getElementById("filtro-desde-año").value)
  const hastaMes = Number.parseInt(document.getElementById("filtro-hasta-mes").value)
  const hastaAño = Number.parseInt(document.getElementById("filtro-hasta-año").value)

  const query = `
    SELECT 
      n.mes, n.año,
      COUNT(DISTINCT n.empleado_id) as empleados_activos,
      SUM(n.sueldo_base) as total_sueldos,
      SUM(n.total_deducciones) as total_deducciones,
      SUM(n.sueldo_neto) as total_neto,
      SUM(n.prestaciones_sociales) as total_prestaciones
    FROM nomina n
    WHERE (n.año > ? OR (n.año = ? AND n.mes >= ?))
      AND (n.año < ? OR (n.año = ? AND n.mes <= ?))
    GROUP BY n.año, n.mes
    ORDER BY n.año, n.mes
  `

  db.all(query, [desdeAño, desdeAño, desdeMes, hastaAño, hastaAño, hastaMes], (err, resultados) => {
    if (err) {
      console.error("Error generando reporte de costos:", err.message)
      alert("Error al generar el reporte.")
      return
    }

    if (resultados.length === 0) {
      alert("No se encontraron datos para el rango de fechas seleccionado.")
      return
    }

    // Procesar datos para el reporte con mejor formateo
    datosReporte = resultados.map((resultado) => {
      const costoEmpresa = resultado.total_sueldos + resultado.total_prestaciones / 12
      const costoTotal = costoEmpresa + resultado.total_deducciones

      return {
        periodo: `${obtenerNombreMes(resultado.mes)} ${resultado.año}`,
        empleados_activos: resultado.empleados_activos,
        total_sueldos: resultado.total_sueldos,
        total_deducciones: resultado.total_deducciones,
        costo_empresa: costoEmpresa,
        prestaciones_mes: resultado.total_prestaciones / 12,
        costo_total: costoTotal,
        // Formatear montos
        total_sueldos_formateado: `$${(resultado.total_sueldos || 0).toFixed(2)}`,
        total_deducciones_formateado: `$${(resultado.total_deducciones || 0).toFixed(2)}`,
        costo_empresa_formateado: `$${costoEmpresa.toFixed(2)}`,
        prestaciones_mes_formateado: `$${(resultado.total_prestaciones / 12).toFixed(2)}`,
        costo_total_formateado: `$${costoTotal.toFixed(2)}`,
      }
    })

    mostrarVistaPrevia("costos")
  })
}

// Función para generar reporte de antigüedad (MEJORADA)
function generarReporteAntiguedad() {
  const estatus = document.getElementById("filtro-estatus-antiguedad").value
  const rango = document.getElementById("filtro-rango-antiguedad").value
  const ordenar = document.getElementById("filtro-ordenar-por").value

  let query = "SELECT * FROM empleados WHERE 1=1"
  const params = []

  if (estatus !== "todos") {
    query += " AND estatus = ?"
    params.push(estatus)
  }

  db.all(query, params, (err, empleados) => {
    if (err) {
      console.error("Error generando reporte de antigüedad:", err.message)
      alert("Error al generar el reporte.")
      return
    }

    // Procesar y filtrar empleados con mejor formateo
    let empleadosProcesados = empleados.map((empleado) => {
      const antiguedad = calcularAntiguedad(empleado.fecha_ingreso)
      const rangoAntiguedad = determinarRangoAntiguedad(antiguedad.años)

      // Formatear nombre completo correctamente
      const nombreCompleto = `${empleado.nombre.trim()} ${empleado.apellido.trim()}`

      return {
        ...empleado,
        empleado_completo: nombreCompleto,
        cargo_formateado: formatearCargo(empleado.cargo),
        fecha_ingreso_formateada: formatearFecha(empleado.fecha_ingreso),
        años: antiguedad.años,
        meses: antiguedad.meses,
        dias: antiguedad.dias,
        rango_antiguedad: rangoAntiguedad,
        antiguedad_total_dias: antiguedad.años * 365 + antiguedad.meses * 30 + antiguedad.dias,
        antiguedad_completa: `${antiguedad.años} años, ${antiguedad.meses} meses, ${antiguedad.dias} días`,
        sueldo_formateado: `$${(empleado.sueldo_base || 0).toFixed(2)}`,
      }
    })

    // Filtrar por rango de antigüedad
    if (rango !== "todos") {
      empleadosProcesados = empleadosProcesados.filter((emp) => {
        switch (rango) {
          case "nuevo":
            return emp.años < 1
          case "junior":
            return emp.años >= 1 && emp.años < 3
          case "senior":
            return emp.años >= 3 && emp.años < 5
          case "veterano":
            return emp.años >= 5
          default:
            return true
        }
      })
    }

    // Ordenar según selección
    empleadosProcesados.sort((a, b) => {
      switch (ordenar) {
        case "antiguedad_desc":
          return b.antiguedad_total_dias - a.antiguedad_total_dias
        case "antiguedad_asc":
          return a.antiguedad_total_dias - b.antiguedad_total_dias
        case "nombre":
          return a.empleado_completo.localeCompare(b.empleado_completo)
        case "cargo":
          return a.cargo_formateado.localeCompare(b.cargo_formateado)
        default:
          return 0
      }
    })

    datosReporte = empleadosProcesados
    mostrarVistaPrevia("antiguedad")
  })
}

// Función para generar reporte comparativo (MEJORADA)
function generarReporteComparativo() {
  const periodo1Mes = Number.parseInt(document.getElementById("filtro-periodo1-mes").value)
  const periodo1Año = Number.parseInt(document.getElementById("filtro-periodo1-año").value)
  const periodo2Mes = Number.parseInt(document.getElementById("filtro-periodo2-mes").value)
  const periodo2Año = Number.parseInt(document.getElementById("filtro-periodo2-año").value)

  const query1 = `
    SELECT 
      COUNT(DISTINCT empleado_id) as empleados,
      SUM(total_devengado) as total_devengado,
      SUM(total_deducciones) as total_deducciones,
      SUM(sueldo_neto) as sueldo_neto,
      AVG(sueldo_base) as promedio_sueldo
    FROM nomina 
    WHERE mes = ? AND año = ?
  `

  const query2 = `
    SELECT 
      COUNT(DISTINCT empleado_id) as empleados,
      SUM(total_devengado) as total_devengado,
      SUM(total_deducciones) as total_deducciones,
      SUM(sueldo_neto) as sueldo_neto,
      AVG(sueldo_base) as promedio_sueldo
    FROM nomina 
    WHERE mes = ? AND año = ?
  `

  Promise.all([
    new Promise((resolve, reject) => {
      db.get(query1, [periodo1Mes, periodo1Año], (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    }),
    new Promise((resolve, reject) => {
      db.get(query2, [periodo2Mes, periodo2Año], (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    }),
  ])
    .then(([datos1, datos2]) => {
      const periodo1Texto = `${obtenerNombreMes(periodo1Mes)} ${periodo1Año}`
      const periodo2Texto = `${obtenerNombreMes(periodo2Mes)} ${periodo2Año}`

      datosReporte = [
        {
          concepto: "Número de Empleados",
          periodo_1: datos1.empleados || 0,
          periodo_2: datos2.empleados || 0,
          diferencia: (datos1.empleados || 0) - (datos2.empleados || 0),
          porcentaje: calcularPorcentajeCambio(datos2.empleados, datos1.empleados),
        },
        {
          concepto: "Total Devengado",
          periodo_1: `$${(datos1.total_devengado || 0).toFixed(2)}`,
          periodo_2: `$${(datos2.total_devengado || 0).toFixed(2)}`,
          diferencia: `$${((datos1.total_devengado || 0) - (datos2.total_devengado || 0)).toFixed(2)}`,
          porcentaje: calcularPorcentajeCambio(datos2.total_devengado, datos1.total_devengado),
        },
        {
          concepto: "Total Deducciones",
          periodo_1: `$${(datos1.total_deducciones || 0).toFixed(2)}`,
          periodo_2: `$${(datos2.total_deducciones || 0).toFixed(2)}`,
          diferencia: `$${((datos1.total_deducciones || 0) - (datos2.total_deducciones || 0)).toFixed(2)}`,
          porcentaje: calcularPorcentajeCambio(datos2.total_deducciones, datos1.total_deducciones),
        },
        {
          concepto: "Sueldo Neto Total",
          periodo_1: `$${(datos1.sueldo_neto || 0).toFixed(2)}`,
          periodo_2: `$${(datos2.sueldo_neto || 0).toFixed(2)}`,
          diferencia: `$${((datos1.sueldo_neto || 0) - (datos2.sueldo_neto || 0)).toFixed(2)}`,
          porcentaje: calcularPorcentajeCambio(datos2.sueldo_neto, datos1.sueldo_neto),
        },
        {
          concepto: "Promedio Sueldo Base",
          periodo_1: `$${(datos1.promedio_sueldo || 0).toFixed(2)}`,
          periodo_2: `$${(datos2.promedio_sueldo || 0).toFixed(2)}`,
          diferencia: `$${((datos1.promedio_sueldo || 0) - (datos2.promedio_sueldo || 0)).toFixed(2)}`,
          porcentaje: calcularPorcentajeCambio(datos2.promedio_sueldo, datos1.promedio_sueldo),
        },
      ]

      // Agregar información de períodos
      datosReporte.periodo1 = periodo1Texto
      datosReporte.periodo2 = periodo2Texto

      mostrarVistaPrevia("comparativo")
    })
    .catch((err) => {
      console.error("Error generando reporte comparativo:", err.message)
      alert("Error al generar el reporte comparativo.")
    })
}

// Función para mostrar vista previa (MEJORADA)
function mostrarVistaPrevia(tipo) {
  const container = document.getElementById("previa-contenido")
  let contenidoHTML = ""

  if (datosReporte.length === 0) {
    contenidoHTML = `
      <div class="no-datos">
        <h3>📭 No se encontraron datos</h3>
        <p>No hay información disponible para los filtros seleccionados.</p>
        <p>Intente ajustar los criterios de búsqueda.</p>
      </div>
    `
  } else {
    // Generar resumen ejecutivo
    contenidoHTML += generarResumenEjecutivo(tipo)

    // Generar tabla de datos
    contenidoHTML += generarTablaReporte(tipo)

    // Generar gráficos si está habilitado
    if (configuracionReporte.incluirGraficos) {
      contenidoHTML += generarGraficosReporte(tipo)
    }
  }

  container.innerHTML = contenidoHTML
  document.getElementById("vista-previa").style.display = "block"

  // Generar gráficos reales después de que el HTML esté en el DOM
  if (configuracionReporte.incluirGraficos && datosReporte.length > 0) {
    setTimeout(() => {
      generarGraficosReales(tipo)
    }, 100)
  }
}

// Función para generar resumen ejecutivo (MEJORADA)
function generarResumenEjecutivo(tipo) {
  let resumen = ""

  switch (tipo) {
    case "empleados":
      const totalEmpleados = datosReporte.length
      const empleadosActivos = datosReporte.filter((emp) => emp.estatus === "activo").length
      const promedioAntiguedad = datosReporte.reduce((sum, emp) => sum + (emp.años || 0), 0) / totalEmpleados
      const sueldoPromedio = datosReporte.reduce((sum, emp) => sum + (emp.sueldo_base || 0), 0) / totalEmpleados

      resumen = `
        <div class="resumen-ejecutivo">
          <h4>📋 Resumen Ejecutivo - Empleados</h4>
          <ul class="resumen-puntos">
            <li>Total de empleados en el reporte: <strong>${totalEmpleados}</strong></li>
            <li>Empleados activos: <strong>${empleadosActivos}</strong> (${((empleadosActivos / totalEmpleados) * 100).toFixed(1)}%)</li>
            <li>Antigüedad promedio: <strong>${promedioAntiguedad.toFixed(1)} años</strong></li>
            <li>Sueldo base promedio: <strong>$${sueldoPromedio.toFixed(2)} USD</strong></li>
            <li>Costo total en sueldos: <strong>$${datosReporte.reduce((sum, emp) => sum + (emp.sueldo_base || 0), 0).toFixed(2)} USD</strong></li>
          </ul>
        </div>
      `
      break

    case "nomina":
      const totalDevengado = datosReporte.reduce((sum, nom) => sum + (nom.total_devengado || 0), 0)
      const totalDeducciones = datosReporte.reduce((sum, nom) => sum + (nom.total_deducciones || 0), 0)
      const totalNeto = datosReporte.reduce((sum, nom) => sum + (nom.sueldo_neto || 0), 0)
      const totalDiasFeriados = datosReporte.reduce((sum, nom) => sum + (nom.dias_feriados || 0), 0)

      resumen = `
        <div class="resumen-ejecutivo">
          <h4>💰 Resumen Ejecutivo - Nómina</h4>
          <ul class="resumen-puntos">
            <li>Período: <strong>${datosReporte[0]?.periodo_texto}</strong></li>
            <li>Empleados procesados: <strong>${datosReporte.length}</strong></li>
            <li>Total devengado: <strong>$${totalDevengado.toFixed(2)} USD</strong></li>
            <li>Total deducciones: <strong>$${totalDeducciones.toFixed(2)} USD</strong></li>
            <li>Total neto pagado: <strong>$${totalNeto.toFixed(2)} USD</strong></li>
            <li>Días feriados trabajados: <strong>${totalDiasFeriados.toFixed(1)} días</strong></li>
            <li>Promedio por empleado: <strong>$${(totalNeto / datosReporte.length).toFixed(2)} USD</strong></li>
          </ul>
        </div>
      `
      break

    case "prestaciones":
      const totalPrestaciones = datosReporte.reduce((sum, emp) => sum + (emp.total_prestaciones || 0), 0)
      const promedioAntiguedadPrest =
        datosReporte.reduce((sum, emp) => sum + (emp.antiguedad_años || 0), 0) / datosReporte.length

      resumen = `
        <div class="resumen-ejecutivo">
          <h4>🏦 Resumen Ejecutivo - Prestaciones Sociales</h4>
          <ul class="resumen-puntos">
            <li>Empleados incluidos: <strong>${datosReporte.length}</strong></li>
            <li>Total prestaciones acumuladas: <strong>$${totalPrestaciones.toFixed(2)} USD</strong></li>
            <li>Promedio por empleado: <strong>$${(totalPrestaciones / datosReporte.length).toFixed(2)} USD</strong></li>
            <li>Antigüedad promedio: <strong>${promedioAntiguedadPrest.toFixed(1)} años</strong></li>
            <li>Mayor prestación: <strong>$${Math.max(...datosReporte.map((emp) => emp.total_prestaciones || 0)).toFixed(2)} USD</strong></li>
          </ul>
        </div>
      `
      break

    case "costos":
      const totalCostos = datosReporte.reduce((sum, periodo) => sum + (periodo.costo_total || 0), 0)
      const promedioCostoMensual = totalCostos / datosReporte.length

      resumen = `
        <div class="resumen-ejecutivo">
          <h4>📈 Resumen Ejecutivo - Costos Laborales</h4>
          <ul class="resumen-puntos">
            <li>Períodos analizados: <strong>${datosReporte.length}</strong></li>
            <li>Costo total acumulado: <strong>$${totalCostos.toFixed(2)} USD</strong></li>
            <li>Promedio mensual: <strong>$${promedioCostoMensual.toFixed(2)} USD</strong></li>
            <li>Mayor costo mensual: <strong>$${Math.max(...datosReporte.map((p) => p.costo_total || 0)).toFixed(2)} USD</strong></li>
            <li>Menor costo mensual: <strong>$${Math.min(...datosReporte.map((p) => p.costo_total || 0)).toFixed(2)} USD</strong></li>
          </ul>
        </div>
      `
      break

    case "antiguedad":
      const promedioAños = datosReporte.reduce((sum, emp) => sum + (emp.años || 0), 0) / datosReporte.length
      const mayorAntiguedad = Math.max(...datosReporte.map((emp) => emp.años || 0))

      resumen = `
        <div class="resumen-ejecutivo">
          <h4>⏳ Resumen Ejecutivo - Antigüedad</h4>
          <ul class="resumen-puntos">
            <li>Empleados analizados: <strong>${datosReporte.length}</strong></li>
            <li>Antigüedad promedio: <strong>${promedioAños.toFixed(1)} años</strong></li>
            <li>Mayor antigüedad: <strong>${mayorAntiguedad} años</strong></li>
            <li>Empleados con más de 3 años: <strong>${datosReporte.filter((emp) => (emp.años || 0) > 3).length}</strong></li>
            <li>Empleados nuevos (menos de 1 año): <strong>${datosReporte.filter((emp) => (emp.años || 0) < 1).length}</strong></li>
          </ul>
        </div>
      `
      break

    case "comparativo":
      resumen = `
        <div class="resumen-ejecutivo">
          <h4>📊 Resumen Ejecutivo - Comparativo</h4>
          <ul class="resumen-puntos">
            <li>Período 1: <strong>${datosReporte.periodo1}</strong></li>
            <li>Período 2: <strong>${datosReporte.periodo2}</strong></li>
            <li>Conceptos comparados: <strong>${datosReporte.length}</strong></li>
            <li>Principales cambios identificados en el análisis</li>
          </ul>
        </div>
      `
      break
  }

  return resumen
}

// Función para generar tabla del reporte (MEJORADA)
function generarTablaReporte(tipo) {
  const campos = CAMPOS_REPORTE[tipo].filter(
    (campo) => configuracionReporte.campos.length === 0 || configuracionReporte.campos.includes(campo.id),
  )

  let tablaHTML = `<table class="reporte-tabla"><thead><tr>`

  // Generar encabezados
  campos.forEach((campo) => {
    if (campo.activo) {
      tablaHTML += `<th>${campo.label}</th>`
    }
  })

  tablaHTML += `</tr></thead><tbody>`

  // Generar filas de datos
  datosReporte.forEach((fila, index) => {
    tablaHTML += `<tr class="${index % 2 === 0 ? "fila-par" : "fila-impar"}">`
    campos.forEach((campo) => {
      if (campo.activo) {
        const valor = obtenerValorCampo(fila, campo.id, tipo)
        tablaHTML += `<td>${valor}</td>`
      }
    })
    tablaHTML += `</tr>`
  })

  tablaHTML += `</tbody></table>`

  return `
    <div class="tabla-container">
      <h4>📊 Datos del Reporte</h4>
      ${tablaHTML}
    </div>
  `
}

// Función para obtener valor de campo (MEJORADA)
function obtenerValorCampo(fila, campoId, tipo) {
  switch (campoId) {
    case "nombre":
    case "empleado":
      return fila.nombre_completo || fila.empleado_completo || `${fila.nombre || ""} ${fila.apellido || ""}`.trim()
    case "cargo":
      return fila.cargo_formateado || formatearCargo(fila.cargo)
    case "sueldo_base":
      return fila.sueldo_formateado || `$${(fila.sueldo_base || 0).toFixed(2)}`
    case "fecha_ingreso":
      return fila.fecha_ingreso_formateada || formatearFecha(fila.fecha_ingreso)
    case "antiguedad":
      return fila.antiguedad_texto || fila.antiguedad_completa || "N/A"
    case "estatus":
      return fila.estatus_formateado || (fila.estatus === "activo" ? "Activo" : "Inactivo")
    case "telefono":
      return fila.telefono_formateado || formatearTelefono(fila.telefono)
    case "cedula":
      return fila.cedula_formateada || formatearCedula(fila.cedula)
    case "tipo_jornada":
      return fila.jornada_formateada || formatearJornada(fila.tipo_jornada)
    case "dias_trabajados":
      return fila.dias_trabajados_texto || `${fila.dias_trabajados || 0} días`
    case "dias_feriados":
      return fila.dias_feriados_texto || (fila.dias_feriados ? `${fila.dias_feriados} días` : "N/A")
    case "monto_dias_feriados":
      return `$${(fila.monto_dias_feriados || 0).toFixed(2)}`
    case "total_devengado":
      return fila.total_devengado_formateado || `$${(fila.total_devengado || 0).toFixed(2)}`
    case "total_deducciones":
      return fila.total_deducciones_formateado || `$${(fila.total_deducciones || 0).toFixed(2)}`
    case "sueldo_neto":
      return fila.sueldo_neto_formateado || `$${(fila.sueldo_neto || 0).toFixed(2)}`
    case "total_prestaciones":
      return fila.total_prestaciones_formateado || `$${(fila.total_prestaciones || 0).toFixed(2)}`
    case "prestaciones_base":
      return fila.prestaciones_base_formateado || `$${(fila.prestaciones_base || 0).toFixed(2)}`
    case "intereses":
      return fila.intereses_formateado || `$${(fila.intereses || 0).toFixed(2)}`
    case "costo_total":
      return fila.costo_total_formateado || `$${(fila.costo_total || 0).toFixed(2)}`
    case "porcentaje":
      return `${fila.porcentaje}%`
    case "años":
      return `${fila.años || 0} años`
    case "meses":
      return `${fila.meses || 0} meses`
    case "dias":
      return `${fila.dias || 0} días`
    case "rango_antiguedad":
      return fila.rango_antiguedad || "N/A"
    default:
      return fila[campoId] || "N/A"
  }
}

// Función para generar gráficos del reporte (MEJORADA)
function generarGraficosReporte(tipo) {
  let graficosHTML = ""

  switch (tipo) {
    case "empleados":
      graficosHTML = `
        <div class="graficos-section">
          <h4>📊 Análisis Gráfico</h4>
          <div class="graficos-grid">
            <div class="grafico-container">
              <h5>Distribución por Cargo</h5>
              <canvas id="grafico-cargos" width="400" height="200"></canvas>
            </div>
            <div class="grafico-container">
              <h5>Distribución por Antigüedad</h5>
              <canvas id="grafico-antiguedad" width="400" height="200"></canvas>
            </div>
          </div>
        </div>
      `
      break

    case "nomina":
      graficosHTML = `
        <div class="graficos-section">
          <h4>📊 Análisis Gráfico</h4>
          <div class="graficos-grid">
            <div class="grafico-container">
              <h5>Composición de la Nómina</h5>
              <canvas id="grafico-nomina" width="400" height="200"></canvas>
            </div>
            <div class="grafico-container">
              <h5>Distribución de Sueldos</h5>
              <canvas id="grafico-sueldos" width="400" height="200"></canvas>
            </div>
          </div>
        </div>
      `
      break

    case "costos":
      graficosHTML = `
        <div class="graficos-section">
          <h4>📊 Análisis Gráfico</h4>
          <div class="graficos-grid">
            <div class="grafico-container">
              <h5>Evolución de Costos Laborales</h5>
              <canvas id="grafico-costos" width="600" height="300"></canvas>
            </div>
          </div>
        </div>
      `
      break

    case "prestaciones":
      graficosHTML = `
        <div class="graficos-section">
          <h4>📊 Análisis Gráfico</h4>
          <div class="graficos-grid">
            <div class="grafico-container">
              <h5>Distribución de Prestaciones</h5>
              <canvas id="grafico-prestaciones" width="400" height="200"></canvas>
            </div>
          </div>
        </div>
      `
      break
  }

  return graficosHTML
}

// Función para generar gráficos reales (NUEVA)
function generarGraficosReales(tipo) {
  switch (tipo) {
    case "empleados":
      generarGraficoCargos()
      generarGraficoAntiguedad()
      break
    case "nomina":
      generarGraficoNomina()
      generarGraficoSueldos()
      break
    case "costos":
      generarGraficoCostos()
      break
    case "prestaciones":
      generarGraficoPrestaciones()
      break
  }
}

// Función para generar gráfico de cargos (NUEVA)
function generarGraficoCargos() {
  const canvas = document.getElementById("grafico-cargos")
  if (!canvas) return

  const ctx = canvas.getContext("2d")

  // Contar empleados por cargo
  const cargos = {}
  datosReporte.forEach((emp) => {
    const cargo = emp.cargo_formateado || formatearCargo(emp.cargo)
    cargos[cargo] = (cargos[cargo] || 0) + 1
  })

  const labels = Object.keys(cargos)
  const valores = Object.values(cargos)
  const colores = ["#ff1c1c", "#880808", "#ff6b6b", "#cc1616", "#ff9999", "#b30000", "#ff4444"]

  // Limpiar canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Dibujar gráfico de barras simple
  const barWidth = canvas.width / labels.length - 10
  const maxValue = Math.max(...valores)

  labels.forEach((label, index) => {
    const barHeight = (valores[index] / maxValue) * (canvas.height - 40)
    const x = index * (barWidth + 10) + 5
    const y = canvas.height - barHeight - 20

    // Dibujar barra
    ctx.fillStyle = colores[index % colores.length]
    ctx.fillRect(x, y, barWidth, barHeight)

    // Dibujar valor
    ctx.fillStyle = "#f2f3d9"
    ctx.font = "12px Arial"
    ctx.textAlign = "center"
    ctx.fillText(valores[index], x + barWidth / 2, y - 5)

    // Dibujar etiqueta
    ctx.save()
    ctx.translate(x + barWidth / 2, canvas.height - 5)
    ctx.rotate(-Math.PI / 4)
    ctx.fillText(label, 0, 0)
    ctx.restore()
  })
}

// Función para generar gráfico de antigüedad (NUEVA)
function generarGraficoAntiguedad() {
  const canvas = document.getElementById("grafico-antiguedad")
  if (!canvas) return

  const ctx = canvas.getContext("2d")

  // Agrupar por rangos de antigüedad
  const rangos = {
    "Menos de 1 año": 0,
    "1-3 años": 0,
    "3-5 años": 0,
    "Más de 5 años": 0,
  }

  datosReporte.forEach((emp) => {
    const años = emp.años || 0
    if (años < 1) rangos["Menos de 1 año"]++
    else if (años < 3) rangos["1-3 años"]++
    else if (años < 5) rangos["3-5 años"]++
    else rangos["Más de 5 años"]++
  })

  const labels = Object.keys(rangos)
  const valores = Object.values(rangos)
  const colores = ["#ff1c1c", "#880808", "#ff6b6b", "#cc1616"]

  // Limpiar canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Dibujar gráfico de barras
  const barWidth = canvas.width / labels.length - 10
  const maxValue = Math.max(...valores)

  labels.forEach((label, index) => {
    const barHeight = (valores[index] / maxValue) * (canvas.height - 40)
    const x = index * (barWidth + 10) + 5
    const y = canvas.height - barHeight - 20

    ctx.fillStyle = colores[index]
    ctx.fillRect(x, y, barWidth, barHeight)

    ctx.fillStyle = "#f2f3d9"
    ctx.font = "12px Arial"
    ctx.textAlign = "center"
    ctx.fillText(valores[index], x + barWidth / 2, y - 5)
    ctx.fillText(label, x + barWidth / 2, canvas.height - 5)
  })
}

// Función para generar gráfico de nómina (NUEVA)
function generarGraficoNomina() {
  const canvas = document.getElementById("grafico-nomina")
  if (!canvas) return

  const ctx = canvas.getContext("2d")

  const totalDevengado = datosReporte.reduce((sum, nom) => sum + (nom.total_devengado || 0), 0)
  const totalDeducciones = datosReporte.reduce((sum, nom) => sum + (nom.total_deducciones || 0), 0)
  const totalNeto = datosReporte.reduce((sum, nom) => sum + (nom.sueldo_neto || 0), 0)

  const datos = [
    { label: "Devengado", valor: totalDevengado, color: "#28a745" },
    { label: "Deducciones", valor: totalDeducciones, color: "#dc3545" },
    { label: "Neto", valor: totalNeto, color: "#007bff" },
  ]

  // Limpiar canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const barWidth = canvas.width / datos.length - 20
  const maxValue = Math.max(...datos.map((d) => d.valor))

  datos.forEach((dato, index) => {
    const barHeight = (dato.valor / maxValue) * (canvas.height - 60)
    const x = index * (barWidth + 20) + 10
    const y = canvas.height - barHeight - 40

    ctx.fillStyle = dato.color
    ctx.fillRect(x, y, barWidth, barHeight)

    ctx.fillStyle = "#f2f3d9"
    ctx.font = "12px Arial"
    ctx.textAlign = "center"
    ctx.fillText(`$${dato.valor.toFixed(0)}`, x + barWidth / 2, y - 5)
    ctx.fillText(dato.label, x + barWidth / 2, canvas.height - 20)
  })
}

// Función para generar gráfico de sueldos (NUEVA)
function generarGraficoSueldos() {
  const canvas = document.getElementById("grafico-sueldos")
  if (!canvas) return

  const ctx = canvas.getContext("2d")

  // Agrupar sueldos por rangos
  const rangos = {
    "Menos de $200": 0,
    "$200-$400": 0,
    "$400-$600": 0,
    "Más de $600": 0,
  }

  datosReporte.forEach((nom) => {
    const sueldo = nom.sueldo_base || 0
    if (sueldo < 200) rangos["Menos de $200"]++
    else if (sueldo < 400) rangos["$200-$400"]++
    else if (sueldo < 600) rangos["$400-$600"]++
    else rangos["Más de $600"]++
  })

  const labels = Object.keys(rangos)
  const valores = Object.values(rangos)
  const colores = ["#ff1c1c", "#880808", "#ff6b6b", "#cc1616"]

  // Limpiar canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const barWidth = canvas.width / labels.length - 10
  const maxValue = Math.max(...valores)

  labels.forEach((label, index) => {
    const barHeight = (valores[index] / maxValue) * (canvas.height - 40)
    const x = index * (barWidth + 10) + 5
    const y = canvas.height - barHeight - 20

    ctx.fillStyle = colores[index]
    ctx.fillRect(x, y, barWidth, barHeight)

    ctx.fillStyle = "#f2f3d9"
    ctx.font = "12px Arial"
    ctx.textAlign = "center"
    ctx.fillText(valores[index], x + barWidth / 2, y - 5)
    ctx.fillText(label, x + barWidth / 2, canvas.height - 5)
  })
}

// Función para generar gráfico de costos (NUEVA)
function generarGraficoCostos() {
  const canvas = document.getElementById("grafico-costos")
  if (!canvas) return

  const ctx = canvas.getContext("2d")

  // Limpiar canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  if (datosReporte.length === 0) return

  const maxValue = Math.max(...datosReporte.map((d) => d.costo_total || 0))
  const stepX = canvas.width / (datosReporte.length - 1)

  // Dibujar línea de costos
  ctx.strokeStyle = "#ff1c1c"
  ctx.lineWidth = 3
  ctx.beginPath()

  datosReporte.forEach((dato, index) => {
    const x = index * stepX
    const y = canvas.height - ((dato.costo_total || 0) / maxValue) * (canvas.height - 40) - 20

    if (index === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }

    // Dibujar punto
    ctx.fillStyle = "#880808"
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, 2 * Math.PI)
    ctx.fill()

    // Etiqueta del período
    ctx.fillStyle = "#f2f3d9"
    ctx.font = "10px Arial"
    ctx.textAlign = "center"
    ctx.fillText(dato.periodo.split(" ")[0], x, canvas.height - 5)
  })

  ctx.stroke()
}

// Función para generar gráfico de prestaciones (NUEVA)
function generarGraficoPrestaciones() {
  const canvas = document.getElementById("grafico-prestaciones")
  if (!canvas) return

  const ctx = canvas.getContext("2d")

  // Agrupar prestaciones por rangos
  const rangos = {
    "Menos de $1,000": 0,
    "$1,000-$5,000": 0,
    "$5,000-$10,000": 0,
    "Más de $10,000": 0,
  }

  datosReporte.forEach((emp) => {
    const prestaciones = emp.total_prestaciones || 0
    if (prestaciones < 1000) rangos["Menos de $1,000"]++
    else if (prestaciones < 5000) rangos["$1,000-$5,000"]++
    else if (prestaciones < 10000) rangos["$5,000-$10,000"]++
    else rangos["Más de $10,000"]++
  })

  const labels = Object.keys(rangos)
  const valores = Object.values(rangos)
  const colores = ["#ff1c1c", "#880808", "#ff6b6b", "#cc1616"]

  // Limpiar canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const barWidth = canvas.width / labels.length - 10
  const maxValue = Math.max(...valores)

  labels.forEach((label, index) => {
    const barHeight = (valores[index] / maxValue) * (canvas.height - 40)
    const x = index * (barWidth + 10) + 5
    const y = canvas.height - barHeight - 20

    ctx.fillStyle = colores[index]
    ctx.fillRect(x, y, barWidth, barHeight)

    ctx.fillStyle = "#f2f3d9"
    ctx.font = "12px Arial"
    ctx.textAlign = "center"
    ctx.fillText(valores[index], x + barWidth / 2, y - 5)
    ctx.fillText(label, x + barWidth / 2, canvas.height - 5)
  })
}

// Función para cargar estadísticas rápidas (MEJORADA)
function cargarEstadisticasRapidas() {
  // Total empleados activos
  db.get("SELECT COUNT(*) as total FROM empleados WHERE estatus = 'activo'", [], (err, row) => {
    if (!err && row) {
      document.getElementById("total-empleados-stat").textContent = row.total || 0
    }
  })

  // Costo nómina actual
  const mesActual = new Date().getMonth() + 1
  const añoActual = new Date().getFullYear()

  db.get(
    "SELECT SUM(sueldo_neto) as total FROM nomina WHERE mes = ? AND año = ?",
    [mesActual, añoActual],
    (err, row) => {
      if (!err && row && row.total) {
        document.getElementById("costo-nomina-stat").textContent = `$${row.total.toFixed(0)}`
      } else {
        document.getElementById("costo-nomina-stat").textContent = "$0"
      }
    },
  )

  // Prestaciones acumuladas
  db.all("SELECT sueldo_base, fecha_ingreso FROM empleados WHERE estatus = 'activo'", [], (err, empleados) => {
    if (!err && empleados) {
      const totalPrestaciones = empleados.reduce((sum, emp) => {
        const antiguedad = calcularAntiguedad(emp.fecha_ingreso)
        const prestaciones = calcularPrestacionesBase(emp.sueldo_base, antiguedad.años)
        return sum + prestaciones
      }, 0)

      document.getElementById("prestaciones-stat").textContent = `$${totalPrestaciones.toFixed(0)}`
    }
  })

  // Antigüedad promedio
  db.all("SELECT fecha_ingreso FROM empleados WHERE estatus = 'activo'", [], (err, empleados) => {
    if (!err && empleados && empleados.length > 0) {
      const promedioAños =
        empleados.reduce((sum, emp) => {
          const antiguedad = calcularAntiguedad(emp.fecha_ingreso)
          return sum + antiguedad.años
        }, 0) / empleados.length

      document.getElementById("antiguedad-promedio-stat").textContent = promedioAños.toFixed(1)
    }
  })
}

// Función para abrir configuración avanzada
function abrirConfiguracionAvanzada() {
  const campos = CAMPOS_REPORTE[tipoReporteActual]
  const camposHTML = campos
    .map(
      (campo) => `
    <div class="campo-checkbox">
      <input type="checkbox" id="campo-${campo.id}" ${campo.activo ? "checked" : ""}>
      <label for="campo-${campo.id}">${campo.label}</label>
    </div>
  `,
    )
    .join("")

  document.getElementById("campos-incluir").innerHTML = camposHTML
  document.getElementById("popup-config").classList.remove("oculto")
}

// Función para aplicar configuración
function aplicarConfiguracion() {
  // Obtener formato seleccionado
  const formatoSeleccionado = document.querySelector('input[name="formato"]:checked')
  if (formatoSeleccionado) {
    configuracionReporte.formato = formatoSeleccionado.value
  }

  // Obtener opciones de exportación
  configuracionReporte.incluirGraficos = document.getElementById("incluir-graficos").checked
  configuracionReporte.incluirFirmas = document.getElementById("incluir-firmas").checked
  configuracionReporte.incluirFechaHora = document.getElementById("incluir-fecha-hora").checked

  // Obtener campos seleccionados
  const campos = CAMPOS_REPORTE[tipoReporteActual]
  configuracionReporte.campos = []

  campos.forEach((campo) => {
    const checkbox = document.getElementById(`campo-${campo.id}`)
    if (checkbox && checkbox.checked) {
      configuracionReporte.campos.push(campo.id)
      campo.activo = true
    } else {
      campo.activo = false
    }
  })

  alert("✅ Configuración aplicada correctamente.")
  cerrarPopupConfig()

  // Actualizar vista previa si hay datos
  if (datosReporte.length > 0) {
    actualizarVistaPrevia()
  }
}

// Función para cerrar popup de configuración
function cerrarPopupConfig() {
  document.getElementById("popup-config").classList.add("oculto")
}

// Función para actualizar vista previa
function actualizarVistaPrevia() {
  if (datosReporte.length > 0) {
    mostrarVistaPrevia(tipoReporteActual)
  } else {
    alert("Primero debe generar un reporte.")
  }
}

// Función para limpiar filtros
function limpiarFiltros() {
  // Restablecer todos los selectores a sus valores por defecto
  const selectores = document.querySelectorAll("#filtros-container select")
  selectores.forEach((select) => {
    select.selectedIndex = 0
  })

  // Restablecer inputs numéricos
  const inputs = document.querySelectorAll('#filtros-container input[type="number"]')
  inputs.forEach((input) => {
    input.value = input.min || 0
  })

  // Ocultar vista previa
  document.getElementById("vista-previa").style.display = "none"
  datosReporte = []

  // Restablecer valores por defecto
  establecerValoresPorDefecto()
}

// Función para generar PDF (MEJORADA)
function generarPDF() {
  if (datosReporte.length === 0) {
    alert("No hay datos para generar el PDF.")
    return
  }

  const tipoTexto = {
    empleados: "Empleados",
    nomina: "Nómina",
    prestaciones: "Prestaciones Sociales",
    costos: "Costos Laborales",
    antiguedad: "Antigüedad del Personal",
    comparativo: "Comparativo",
  }

  const titulo = `Reporte de ${tipoTexto[tipoReporteActual]}`
  const fechaHora = new Date().toLocaleString("es-ES")

  // Obtener contenido de la vista previa
  const contenidoPrevia = document.getElementById("previa-contenido").innerHTML

  const contenidoPDF = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${titulo} - SIMETRIC GYM</title>
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
          font-size: 16px;
        }
        .reporte-tabla {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        .reporte-tabla th,
        .reporte-tabla td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
          font-size: 12px;
        }
        .reporte-tabla th {
          background-color: #880808;
          color: white;
          font-weight: bold;
        }
        .reporte-tabla tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .resumen-ejecutivo {
          background-color: #f9f9f9;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 30px;
          border-left: 4px solid #28a745;
        }
        .resumen-ejecutivo h4 {
          color: #28a745;
          margin-bottom: 15px;
        }
        .resumen-puntos {
          list-style: none;
          padding: 0;
        }
        .resumen-puntos li {
          margin-bottom: 8px;
          padding-left: 20px;
          position: relative;
        }
        .resumen-puntos li:before {
          content: "▶";
          color: #28a745;
          position: absolute;
          left: 0;
        }
        .tabla-container h4 {
          color: #880808;
          margin-bottom: 15px;
        }
        .graficos-section {
          display: none; /* Ocultar gráficos en PDF */
        }
        .footer {
          text-align: center;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          color: #666;
          font-size: 12px;
        }
        ${
          configuracionReporte.incluirFirmas
            ? `
        .firmas {
          margin-top: 60px;
          display: flex;
          justify-content: space-around;
        }
        .firma {
          text-align: center;
          width: 200px;
        }
        .linea-firma {
          border-top: 1px solid #333;
          margin-bottom: 10px;
        }
        `
            : ""
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">🏋️ SIMETRIC GYM C.A.</div>
        <div class="subtitle">${titulo}</div>
        ${configuracionReporte.incluirFechaHora ? `<p>Generado el ${fechaHora}</p>` : ""}
      </div>

      ${contenidoPrevia}

      ${
        configuracionReporte.incluirFirmas
          ? `
      <div class="firmas">
        <div class="firma">
          <div class="linea-firma"></div>
          <p><strong>Gerente General</strong></p>
        </div>
        <div class="firma">
          <div class="linea-firma"></div>
          <p><strong>Recursos Humanos</strong></p>
        </div>
        <div class="firma">
          <div class="linea-firma"></div>
          <p><strong>Administración</strong></p>
        </div>
      </div>
      `
          : ""
      }

      <div class="footer">
        <p><strong>SIMETRIC GYM C.A.</strong></p>
        <p>RIF: J-31700635/3</p>
        ${configuracionReporte.incluirFechaHora ? `<p>Reporte generado el ${fechaHora}</p>` : ""}
      </div>
    </body>
    </html>
  `

  // Abrir ventana para imprimir/guardar
  const ventanaPDF = window.open("", "", "width=1000,height=700")
  if (!ventanaPDF) {
    alert(
      "❌ Error: El navegador bloqueó la ventana emergente. Por favor, permite ventanas emergentes para este sitio.",
    )
    return
  }

  ventanaPDF.document.write(contenidoPDF)
  ventanaPDF.document.close()

  setTimeout(() => {
    ventanaPDF.print()
  }, 500)
}

// Funciones auxiliares mejoradas
function calcularAntiguedad(fechaIngreso) {
  if (!fechaIngreso) return { años: 0, meses: 0, dias: 0 }

  const fechaInicio = new Date(fechaIngreso + "T00:00:00")
  const fechaActual = new Date()

  let años = fechaActual.getFullYear() - fechaInicio.getFullYear()
  let meses = fechaActual.getMonth() - fechaInicio.getMonth()
  let dias = fechaActual.getDate() - fechaInicio.getDate()

  if (dias < 0) {
    meses--
    dias += new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 0).getDate()
  }

  if (meses < 0) {
    años--
    meses += 12
  }

  return { años: Math.max(0, años), meses: Math.max(0, meses), dias: Math.max(0, dias) }
}

function calcularPrestacionesBase(sueldoBase, años) {
  if (!sueldoBase || !años) return 0
  return (sueldoBase / 30) * 30 * años
}

function formatearCargo(cargo) {
  const cargos = {
    administrador: "Administrador",
    recepcionista: "Recepcionista",
    entrenador: "Entrenador Personal",
    limpieza: "Personal de Limpieza",
    mantenimiento: "Mantenimiento",
    seguridad: "Seguridad",
    otro: "Otro",
  }
  return cargos[cargo] || cargo || "N/A"
}

function formatearJornada(jornada) {
  const jornadas = {
    tiempo_completo: "Tiempo Completo",
    medio_tiempo: "Medio Tiempo",
    freelance: "Freelance",
    por_horas: "Por Horas",
  }
  return jornadas[jornada] || jornada || "N/A"
}

function formatearFecha(fecha) {
  if (!fecha) return "N/A"

  try {
    const fechaObj = new Date(fecha + "T00:00:00")
    return fechaObj.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  } catch (error) {
    return "Fecha inválida"
  }
}

function formatearTelefono(telefono) {
  if (!telefono) return "N/A"

  // Formatear teléfono venezolano: 0412-1234567
  const tel = telefono.replace(/\D/g, "")
  if (tel.length === 11) {
    return `${tel.substring(0, 4)}-${tel.substring(4)}`
  }
  return telefono
}

function formatearCedula(cedula) {
  if (!cedula) return "N/A"

  // Formatear cédula con puntos: V-12.345.678
  const ced = cedula.replace(/\D/g, "")
  if (ced.length >= 7) {
    return `V-${ced.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`
  }
  return cedula
}

function formatearEstatus(estatus) {
  const estatusMap = {
    pendiente: "Pendiente",
    procesada: "Procesada",
    pagada: "Pagada",
    activo: "Activo",
    inactivo: "Inactivo",
  }
  return estatusMap[estatus] || estatus || "N/A"
}

function obtenerNombreMes(numeroMes) {
  const meses = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ]
  return meses[numeroMes - 1] || "Mes desconocido"
}

function determinarRangoAntiguedad(años) {
  if (años < 1) return "Nuevo (< 1 año)"
  if (años < 3) return "Junior (1-3 años)"
  if (años < 5) return "Senior (3-5 años)"
  return "Veterano (> 5 años)"
}

function calcularPorcentajeCambio(valorAnterior, valorActual) {
  if (!valorAnterior || valorAnterior === 0) return "N/A"
  const cambio = ((valorActual - valorAnterior) / valorAnterior) * 100
  return `${cambio > 0 ? "+" : ""}${cambio.toFixed(1)}`
}

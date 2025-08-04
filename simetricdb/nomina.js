const sqlite3 = require("sqlite3").verbose()

const db = new sqlite3.Database("simetricdb.sqlite", (err) => {
  if (err) {
    console.error("Error al conectar con la base de datos:", err.message)
  } else {
    console.log("Conectado a la base de datos para gestión de nómina.")
  }
})

// Variables globales
let empleadosActivos = []
let nominaActual = []
let mesSeleccionado = new Date().getMonth() + 1
let añoSeleccionado = new Date().getFullYear()
let empleadoNominaSeleccionado = null

// Configuraciones por defecto (se cargarán desde la BD)
const CONFIGURACIONES = {
  SEGURO_SOCIAL: 0.04, // 4%
  LPH: 0.01, // 1%
  PARO_FORZOSO: 0.005, // 0.5%
  DIAS_MES: 30,
  SALARIO_MINIMO: 130.0, // USD
  TASA_INTERES_PRESTACIONES: 0.12, // 12% anual
  RECARGO_FERIADOS: 0.5, // 50% de recargo por días feriados
}

// Inicializar página
document.addEventListener("DOMContentLoaded", () => {
  inicializarSelectores()
  cargarConfiguraciones()
  establecerPeriodoActual()
  // Mostrar automáticamente los empleados del mes actual
  setTimeout(() => {
    mostrarEmpleadosDelMesActual()
  }, 1000) // Esperar 1 segundo para que se carguen las configuraciones
})

// Función para mostrar empleados del mes actual automáticamente
function mostrarEmpleadosDelMesActual() {
  const fechaActual = new Date()
  const mesActual = fechaActual.getMonth() + 1
  const añoActual = fechaActual.getFullYear()

  // Establecer período actual
  document.getElementById("mes-nomina").value = mesActual
  document.getElementById("año-nomina").value = añoActual
  mesSeleccionado = mesActual
  añoSeleccionado = añoActual

  // Cargar automáticamente los empleados del mes actual
  cargarEmpleadosActivos()
}

// Función para inicializar selectores de año
function inicializarSelectores() {
  const añoSelect = document.getElementById("año-nomina")
  const añoUtilidadesSelect = document.getElementById("año-utilidades")
  const añoActual = new Date().getFullYear()

  // Limpiar selectores
  añoSelect.innerHTML = ""
  añoUtilidadesSelect.innerHTML = ""

  // Llenar selector de años (desde 2020 hasta año actual + 1)
  for (let año = 2020; año <= añoActual + 1; año++) {
    const option = document.createElement("option")
    option.value = año
    option.textContent = año
    if (año === añoActual) option.selected = true
    añoSelect.appendChild(option)

    // Clonar para utilidades
    const optionUtilidades = option.cloneNode(true)
    añoUtilidadesSelect.appendChild(optionUtilidades)
  }
}

// Función para cargar configuraciones desde la base de datos
function cargarConfiguraciones() {
  const configuraciones = ["salario_minimo", "porcentaje_seguro_social", "porcentaje_lph", "porcentaje_paro_forzoso"]

  let configuracionesCargadas = 0

  configuraciones.forEach((config) => {
    db.get("SELECT valor FROM configuraciones WHERE clave = ?", [config], (err, row) => {
      if (err) {
        console.error(`Error cargando configuración ${config}:`, err.message)
      } else if (row) {
        const valor = Number.parseFloat(row.valor)
        switch (config) {
          case "salario_minimo":
            CONFIGURACIONES.SALARIO_MINIMO = valor
            break
          case "porcentaje_seguro_social":
            CONFIGURACIONES.SEGURO_SOCIAL = valor / 100
            break
          case "porcentaje_lph":
            CONFIGURACIONES.LPH = valor / 100
            break
          case "porcentaje_paro_forzoso":
            CONFIGURACIONES.PARO_FORZOSO = valor / 100
            break
        }
      }

      configuracionesCargadas++
      if (configuracionesCargadas === configuraciones.length) {
        console.log("Configuraciones cargadas:", CONFIGURACIONES)
      }
    })
  })
}

// Función para establecer período actual
function establecerPeriodoActual() {
  const fechaActual = new Date()
  document.getElementById("mes-nomina").value = fechaActual.getMonth() + 1
  document.getElementById("año-nomina").value = fechaActual.getFullYear()
  mesSeleccionado = fechaActual.getMonth() + 1
  añoSeleccionado = fechaActual.getFullYear()
}

// Event listeners
document.getElementById("cargar-nomina").addEventListener("click", cargarNomina)
document.getElementById("nueva-nomina").addEventListener("click", crearNuevaNomina)
document.getElementById("procesar-nomina").addEventListener("click", procesarNomina)
document.getElementById("generar-reporte-nomina").addEventListener("click", generarReporteNomina)
document.getElementById("calcular-prestaciones").addEventListener("click", abrirCalculoPrestaciones)
document.getElementById("calcular-utilidades").addEventListener("click", abrirCalculoUtilidades)

// Función para cargar nómina existente
function cargarNomina() {
  mesSeleccionado = Number.parseInt(document.getElementById("mes-nomina").value)
  añoSeleccionado = Number.parseInt(document.getElementById("año-nomina").value)

  if (!mesSeleccionado || !añoSeleccionado) {
    alert("Por favor seleccione un mes y año válidos.")
    return
  }

  const query = `
    SELECT n.*, e.nombre, e.apellido, e.cargo, e.sueldo_base as sueldo_actual
    FROM nomina n
    INNER JOIN empleados e ON n.empleado_id = e.id
    WHERE n.mes = ? AND n.año = ?
    ORDER BY e.nombre, e.apellido
  `

  db.all(query, [mesSeleccionado, añoSeleccionado], (err, rows) => {
    if (err) {
      console.error("Error cargando nómina:", err.message)
      alert("Error al cargar la nómina.")
      return
    }

    if (rows.length === 0) {
      alert("No existe nómina para el período seleccionado. Use 'Nueva Nómina' para crearla.")
      document.getElementById("resumen-nomina").style.display = "none"
      document.getElementById("nomina-container").innerHTML = ""
      return
    }

    nominaActual = rows
    mostrarResumenNomina()
    renderizarNomina()
  })
}

// Función para crear nueva nómina
function crearNuevaNomina() {
  mesSeleccionado = Number.parseInt(document.getElementById("mes-nomina").value)
  añoSeleccionado = Number.parseInt(document.getElementById("año-nomina").value)

  if (!mesSeleccionado || !añoSeleccionado) {
    alert("Por favor seleccione un mes y año válidos.")
    return
  }

  // Verificar si ya existe nómina para este período
  db.get(
    "SELECT COUNT(*) as count FROM nomina WHERE mes = ? AND año = ?",
    [mesSeleccionado, añoSeleccionado],
    (err, row) => {
      if (err) {
        console.error("Error verificando nómina:", err.message)
        alert("Error al verificar la nómina existente.")
        return
      }

      if (row.count > 0) {
        if (!confirm("Ya existe una nómina para este período. ¿Desea reemplazarla?")) {
          return
        }
        // Eliminar nómina existente
        db.run("DELETE FROM nomina WHERE mes = ? AND año = ?", [mesSeleccionado, añoSeleccionado], (deleteErr) => {
          if (deleteErr) {
            console.error("Error eliminando nómina anterior:", deleteErr.message)
            alert("Error al eliminar la nómina anterior.")
            return
          }
          cargarEmpleadosActivos()
        })
      } else {
        cargarEmpleadosActivos()
      }
    },
  )
}

// Función para cargar empleados activos (CORREGIDA - Validar fechas de ingreso)
function cargarEmpleadosActivos() {
  // Calcular la fecha límite del período seleccionado (último día del mes)
  const fechaLimitePeriodo = new Date(añoSeleccionado, mesSeleccionado, 0) // Último día del mes seleccionado

  const query = `
    SELECT * FROM empleados 
    WHERE estatus = 'activo' 
    AND date(fecha_ingreso) <= date(?)
    ORDER BY nombre, apellido
  `

  const fechaLimiteStr = fechaLimitePeriodo.toISOString().split("T")[0]

  db.all(query, [fechaLimiteStr], (err, rows) => {
    if (err) {
      console.error("Error cargando empleados:", err.message)
      alert("Error al cargar empleados activos.")
      return
    }

    if (rows.length === 0) {
      alert("No hay empleados activos para el período seleccionado.")
      return
    }

    empleadosActivos = rows
    generarNominaInicial()
  })
}

// Función para calcular días trabajados en el período (NUEVA)
function calcularDiasTrabajadosEnPeriodo(fechaIngreso, año, mes) {
  const fechaInicio = new Date(fechaIngreso + "T00:00:00")
  const primerDiaMes = new Date(año, mes - 1, 1)
  const ultimoDiaMes = new Date(año, mes, 0) // Último día del mes
  const fechaActual = new Date()

  // Si ingresó después del período, no trabajó días
  if (fechaInicio > ultimoDiaMes) {
    return 0
  }

  // Fecha de inicio efectiva (la mayor entre fecha de ingreso y primer día del mes)
  const fechaInicioEfectiva = fechaInicio > primerDiaMes ? fechaInicio : primerDiaMes

  // Para el mes actual, calcular hasta la fecha actual si es menor que el último día del mes
  let fechaFinEfectiva = ultimoDiaMes
  if (año === fechaActual.getFullYear() && mes === fechaActual.getMonth() + 1) {
    fechaFinEfectiva = fechaActual < ultimoDiaMes ? fechaActual : ultimoDiaMes
  }

  // Calcular días trabajados
  const diasTrabajados = Math.floor((fechaFinEfectiva - fechaInicioEfectiva) / (1000 * 60 * 60 * 24)) + 1

  return Math.max(0, diasTrabajados)
}

// Función para generar nómina inicial (CORREGIDA)
function generarNominaInicial() {
  nominaActual = empleadosActivos.map((empleado) => {
    const antiguedad = calcularAntiguedad(empleado.fecha_ingreso)

    // Calcular días realmente trabajados en el período
    const diasTrabajadosReales = calcularDiasTrabajadosEnPeriodo(
      empleado.fecha_ingreso,
      añoSeleccionado,
      mesSeleccionado,
    )

    // Calcular sueldo proporcional basado en días realmente trabajados
    const sueldoProporcional = (empleado.sueldo_base / CONFIGURACIONES.DIAS_MES) * diasTrabajadosReales

    const prestacionesSociales = calcularPrestacionesSociales(empleado.sueldo_base, antiguedad.años, antiguedad.meses)
    const vacaciones = calcularVacaciones(empleado.sueldo_base, antiguedad.años)

    // Calcular deducciones sobre el sueldo proporcional
    const seguroSocial = sueldoProporcional * CONFIGURACIONES.SEGURO_SOCIAL
    const lph = sueldoProporcional * CONFIGURACIONES.LPH
    const paroForzoso = sueldoProporcional * CONFIGURACIONES.PARO_FORZOSO
    const totalDeducciones = seguroSocial + lph + paroForzoso

    return {
      empleado_id: empleado.id,
      nombre: empleado.nombre,
      apellido: empleado.apellido,
      cargo: empleado.cargo,
      sueldo_actual: empleado.sueldo_base,
      periodo: `${obtenerNombreMes(mesSeleccionado)} ${añoSeleccionado}`,
      año: añoSeleccionado,
      mes: mesSeleccionado,
      dias_trabajados: diasTrabajadosReales,
      sueldo_base: empleado.sueldo_base,
      dias_feriados: 0,
      monto_dias_feriados: 0,
      bonos: 0,
      comisiones: 0,
      total_devengado: sueldoProporcional,
      seguro_social: seguroSocial,
      ley_politica_habitacional: lph,
      paro_forzoso: paroForzoso,
      total_deducciones: totalDeducciones,
      sueldo_neto: sueldoProporcional - totalDeducciones,
      prestaciones_sociales: prestacionesSociales,
      utilidades: 0,
      vacaciones: vacaciones,
      fecha_pago: null,
      estatus: "pendiente",
      observaciones: "",
      fecha_creacion: new Date().toISOString().split("T")[0],
    }
  })

  mostrarResumenNomina()
  renderizarNomina()
}

// Función para calcular antigüedad (CORREGIDA)
function calcularAntiguedad(fechaIngreso) {
  const fechaInicio = new Date(fechaIngreso + "T00:00:00") // Asegurar formato correcto
  const fechaActual = new Date()

  let años = fechaActual.getFullYear() - fechaInicio.getFullYear()
  let meses = fechaActual.getMonth() - fechaInicio.getMonth()
  let dias = fechaActual.getDate() - fechaInicio.getDate()

  // Ajustar si los días son negativos
  if (dias < 0) {
    meses--
    const ultimoDiaMesAnterior = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 0).getDate()
    dias += ultimoDiaMesAnterior
  }

  // Ajustar si los meses son negativos
  if (meses < 0) {
    años--
    meses += 12
  }

  return { años: Math.max(0, años), meses: Math.max(0, meses), dias: Math.max(0, dias) }
}

// Función para calcular prestaciones sociales (CORREGIDA)
function calcularPrestacionesSociales(sueldoBase, años, meses) {
  // Calcular años completos más la fracción de meses
  const añosCompletos = años + meses / 12

  // 30 días de salario por año trabajado
  const prestacionesBase = (sueldoBase / CONFIGURACIONES.DIAS_MES) * 30 * añosCompletos

  // Intereses del 12% anual sobre el tiempo trabajado
  const intereses = prestacionesBase * CONFIGURACIONES.TASA_INTERES_PRESTACIONES * añosCompletos

  return Math.max(0, prestacionesBase + intereses)
}

// Función para calcular vacaciones (CORREGIDA)
function calcularVacaciones(sueldoBase, años) {
  let diasVacaciones = 15 // Mínimo 15 días

  // Días adicionales según antigüedad (Ley Orgánica del Trabajo de Venezuela)
  if (años >= 1) diasVacaciones += 1
  if (años >= 2) diasVacaciones += 1
  if (años >= 4) diasVacaciones += 1
  if (años >= 6) diasVacaciones += 1
  if (años >= 8) diasVacaciones += 1
  if (años >= 10) diasVacaciones += 1
  if (años >= 15) diasVacaciones += 1

  // Máximo 30 días
  diasVacaciones = Math.min(diasVacaciones, 30)

  return (sueldoBase / CONFIGURACIONES.DIAS_MES) * diasVacaciones
}

// Función para mostrar resumen de nómina
function mostrarResumenNomina() {
  const totalEmpleados = nominaActual.length
  const totalDevengado = nominaActual.reduce((sum, nomina) => sum + (nomina.total_devengado || 0), 0)
  const totalDeducciones = nominaActual.reduce((sum, nomina) => sum + (nomina.total_deducciones || 0), 0)
  const totalNeto = nominaActual.reduce((sum, nomina) => sum + (nomina.sueldo_neto || 0), 0)

  document.getElementById("total-empleados").textContent = totalEmpleados
  document.getElementById("total-devengado").textContent = `$${totalDevengado.toFixed(2)}`
  document.getElementById("total-deducciones").textContent = `$${totalDeducciones.toFixed(2)}`
  document.getElementById("total-neto").textContent = `$${totalNeto.toFixed(2)}`

  document.getElementById("resumen-nomina").style.display = "block"
}

// Función para renderizar nómina
function renderizarNomina() {
  const container = document.getElementById("nomina-container")

  if (nominaActual.length === 0) {
    container.innerHTML = `
      <div class="no-empleados">
        <h3>No hay empleados en la nómina</h3>
        <p>Use 'Nueva Nómina' para generar la nómina del período.</p>
      </div>
    `
    return
  }

  const nominaHTML = nominaActual
    .map((nomina) => {
      return `
      <div class="nomina-empleado">
        <div class="empleado-header">
          <div class="empleado-info">
            <h4>${nomina.nombre} ${nomina.apellido}</h4>
            <div class="empleado-cargo">${formatearCargo(nomina.cargo)}</div>
          </div>
          <span class="nomina-status status-${nomina.estatus}">${nomina.estatus.toUpperCase()}</span>
        </div>
        
        <div class="nomina-detalles">
          <div class="detalle-item">
            <div class="detalle-label">Días Trabajados</div>
            <div class="detalle-valor">${nomina.dias_trabajados}</div>
          </div>
          <div class="detalle-item">
            <div class="detalle-label">Sueldo Base</div>
            <div class="detalle-valor">$${(nomina.sueldo_base || 0).toFixed(2)}</div>
          </div>
          <div class="detalle-item">
            <div class="detalle-label">Total Devengado</div>
            <div class="detalle-valor">$${(nomina.total_devengado || 0).toFixed(2)}</div>
          </div>
          <div class="detalle-item">
            <div class="detalle-label">Deducciones</div>
            <div class="detalle-valor">$${(nomina.total_deducciones || 0).toFixed(2)}</div>
          </div>
          <div class="detalle-item">
            <div class="detalle-label">Sueldo Neto</div>
            <div class="detalle-valor">$${(nomina.sueldo_neto || 0).toFixed(2)}</div>
          </div>
          <div class="detalle-item">
            <div class="detalle-label">Prestaciones</div>
            <div class="detalle-valor">$${(nomina.prestaciones_sociales || 0).toFixed(2)}</div>
          </div>
        </div>
        
        <div class="nomina-acciones">
          <button class="btn-primary btn-small editar-nomina" data-empleado-id="${nomina.empleado_id}">
            ✏️ Editar
          </button>
          <button class="btn-info btn-small ver-detalle-nomina" data-empleado-id="${nomina.empleado_id}">
            👁️ Ver Detalle
          </button>
        </div>
      </div>
    `
    })
    .join("")

  container.innerHTML = `<div class="nomina-grid">${nominaHTML}</div>`
}

// Event listeners para acciones de nómina
document.addEventListener("click", (event) => {
  const empleadoId = event.target.dataset.empleadoId

  if (event.target.classList.contains("editar-nomina")) {
    abrirEditorNomina(empleadoId)
  } else if (event.target.classList.contains("ver-detalle-nomina")) {
    abrirEditorNomina(empleadoId, true) // Solo lectura
  }
})

// Función para abrir editor de nómina
function abrirEditorNomina(empleadoId, soloLectura = false) {
  const nomina = nominaActual.find((n) => n.empleado_id == empleadoId)
  if (!nomina) {
    alert("No se encontró la nómina del empleado.")
    return
  }

  empleadoNominaSeleccionado = empleadoId

  // Llenar campos del popup
  document.getElementById("nomina-empleado").value = `${nomina.nombre} ${nomina.apellido}`
  document.getElementById("nomina-periodo").value = nomina.periodo
  document.getElementById("dias-trabajados").value = nomina.dias_trabajados || CONFIGURACIONES.DIAS_MES
  document.getElementById("sueldo-base").value = nomina.sueldo_base || 0
  document.getElementById("dias-feriados").value = nomina.dias_feriados || 0
  document.getElementById("bonos").value = nomina.bonos || 0
  document.getElementById("comisiones").value = nomina.comisiones || 0
  document.getElementById("observaciones").value = nomina.observaciones || ""

  // Calcular y mostrar valores
  calcularNomina()

  // Configurar modo de solo lectura si es necesario
  const campos = ["dias-trabajados", "dias-feriados", "bonos", "comisiones", "observaciones"]

  if (soloLectura) {
    campos.forEach((campoId) => {
      const campo = document.getElementById(campoId)
      if (campo) campo.readOnly = true
    })
    document.getElementById("titulo-nomina").textContent = "👁️ Ver Detalle de Nómina"
    document.querySelector("#form-nomina button[type='submit']").style.display = "none"
  } else {
    campos.forEach((campoId) => {
      const campo = document.getElementById(campoId)
      if (campo) campo.readOnly = false
    })
    document.getElementById("titulo-nomina").textContent = "✏️ Editar Nómina"
    document.querySelector("#form-nomina button[type='submit']").style.display = "inline-block"
  }

  document.getElementById("popup-nomina").classList.remove("oculto")
}

// Event listeners para cálculos automáticos
document.getElementById("dias-trabajados").addEventListener("input", calcularNomina)
document.getElementById("dias-feriados").addEventListener("input", calcularNomina)
document.getElementById("bonos").addEventListener("input", calcularNomina)
document.getElementById("comisiones").addEventListener("input", calcularNomina)

// Función para calcular nómina en tiempo real (CORREGIDA)
function calcularNomina() {
  const diasTrabajados = Number.parseInt(document.getElementById("dias-trabajados").value) || 0
  const sueldoBase = Number.parseFloat(document.getElementById("sueldo-base").value) || 0
  const diasFeriados = Number.parseFloat(document.getElementById("dias-feriados").value) || 0
  const bonos = Number.parseFloat(document.getElementById("bonos").value) || 0
  const comisiones = Number.parseFloat(document.getElementById("comisiones").value) || 0

  // Validar días trabajados
  if (diasTrabajados <= 0 || diasTrabajados > 31) {
    document.getElementById("sueldo-proporcional").textContent = "$0.00"
    return
  }

  // Calcular sueldo proporcional
  const sueldoProporcional = (sueldoBase / CONFIGURACIONES.DIAS_MES) * diasTrabajados

  // Calcular monto de días feriados automáticamente
  let montoDiasFeriados = 0
  if (diasFeriados > 0 && sueldoBase > 0) {
    // Calcular valor día normal (sueldo base / 30 días)
    const valorDiaNormal = sueldoBase / CONFIGURACIONES.DIAS_MES
    // Días feriados se pagan con 50% de recargo (1.5 veces el valor normal)
    const valorDiaFeriado = valorDiaNormal * (1 + CONFIGURACIONES.RECARGO_FERIADOS)
    montoDiasFeriados = diasFeriados * valorDiaFeriado
  }

  // Calcular total devengado
  const totalDevengado = sueldoProporcional + montoDiasFeriados + bonos + comisiones

  // Calcular deducciones sobre el total devengado
  const seguroSocial = totalDevengado * CONFIGURACIONES.SEGURO_SOCIAL
  const lph = totalDevengado * CONFIGURACIONES.LPH
  const paroForzoso = totalDevengado * CONFIGURACIONES.PARO_FORZOSO
  const totalDeducciones = seguroSocial + lph + paroForzoso

  // Calcular sueldo neto
  const sueldoNeto = totalDevengado - totalDeducciones

  // Calcular prestaciones y vacaciones (basado en empleado actual)
  const nomina = nominaActual.find((n) => n.empleado_id == empleadoNominaSeleccionado)
  const prestaciones = nomina ? nomina.prestaciones_sociales || 0 : 0
  const vacaciones = nomina ? nomina.vacaciones || 0 : 0

  // Actualizar campos calculados
  document.getElementById("sueldo-proporcional").textContent = `$${sueldoProporcional.toFixed(2)}`
  document.getElementById("monto-dias-feriados-calc").textContent = `$${montoDiasFeriados.toFixed(2)}`
  document.getElementById("total-devengado-calc").textContent = `$${totalDevengado.toFixed(2)}`
  document.getElementById("seguro-social-calc").textContent = `$${seguroSocial.toFixed(2)}`
  document.getElementById("lph-calc").textContent = `$${lph.toFixed(2)}`
  document.getElementById("paro-forzoso-calc").textContent = `$${paroForzoso.toFixed(2)}`
  document.getElementById("total-deducciones-calc").textContent = `$${totalDeducciones.toFixed(2)}`
  document.getElementById("sueldo-neto-calc").textContent = `$${sueldoNeto.toFixed(2)}`
  document.getElementById("prestaciones-calc").textContent = `$${prestaciones.toFixed(2)}`
  document.getElementById("vacaciones-calc").textContent = `$${vacaciones.toFixed(2)}`
}

// Event listener para formulario de nómina
document.getElementById("form-nomina").addEventListener("submit", (e) => {
  e.preventDefault()
  guardarNomina()
})

// Función para guardar nómina (CORREGIDA)
function guardarNomina() {
  const diasTrabajados = Number.parseInt(document.getElementById("dias-trabajados").value) || 0
  const sueldoBase = Number.parseFloat(document.getElementById("sueldo-base").value) || 0
  const diasFeriados = Number.parseFloat(document.getElementById("dias-feriados").value) || 0
  const bonos = Number.parseFloat(document.getElementById("bonos").value) || 0
  const comisiones = Number.parseFloat(document.getElementById("comisiones").value) || 0
  const observaciones = document.getElementById("observaciones").value.trim()

  // Validaciones mejoradas
  if (diasTrabajados <= 0 || diasTrabajados > 31) {
    alert("Los días trabajados deben estar entre 1 y 31.")
    document.getElementById("dias-trabajados").focus()
    return
  }

  if (sueldoBase <= 0) {
    alert("El sueldo base debe ser mayor a 0.")
    return
  }

  if (diasFeriados < 0 || bonos < 0 || comisiones < 0) {
    alert("Los montos no pueden ser negativos.")
    return
  }

  // Calcular monto de días feriados automáticamente
  let montoDiasFeriados = 0
  if (diasFeriados > 0 && sueldoBase > 0) {
    const valorDiaNormal = sueldoBase / CONFIGURACIONES.DIAS_MES
    const valorDiaFeriado = valorDiaNormal * (1 + CONFIGURACIONES.RECARGO_FERIADOS)
    montoDiasFeriados = diasFeriados * valorDiaFeriado
  }

  // Recalcular valores
  const sueldoProporcional = (sueldoBase / CONFIGURACIONES.DIAS_MES) * diasTrabajados
  const totalDevengado = sueldoProporcional + montoDiasFeriados + bonos + comisiones
  const seguroSocial = totalDevengado * CONFIGURACIONES.SEGURO_SOCIAL
  const lph = totalDevengado * CONFIGURACIONES.LPH
  const paroForzoso = totalDevengado * CONFIGURACIONES.PARO_FORZOSO
  const totalDeducciones = seguroSocial + lph + paroForzoso
  const sueldoNeto = totalDevengado - totalDeducciones

  // Actualizar nómina en memoria
  const nominaIndex = nominaActual.findIndex((n) => n.empleado_id == empleadoNominaSeleccionado)
  if (nominaIndex !== -1) {
    nominaActual[nominaIndex] = {
      ...nominaActual[nominaIndex],
      dias_trabajados: diasTrabajados,
      dias_feriados: diasFeriados,
      monto_dias_feriados: montoDiasFeriados,
      bonos: bonos,
      comisiones: comisiones,
      total_devengado: totalDevengado,
      seguro_social: seguroSocial,
      ley_politica_habitacional: lph,
      paro_forzoso: paroForzoso,
      total_deducciones: totalDeducciones,
      sueldo_neto: sueldoNeto,
      observaciones: observaciones,
    }

    alert("✅ Nómina actualizada correctamente.")
    cerrarPopupNomina()
    mostrarResumenNomina()
    renderizarNomina()
  } else {
    alert("Error: No se encontró la nómina del empleado.")
  }
}

// Event listeners para cerrar popups
document.getElementById("cerrar-popup-nomina").addEventListener("click", cerrarPopupNomina)
document.getElementById("cancelar-nomina").addEventListener("click", cerrarPopupNomina)

function cerrarPopupNomina() {
  document.getElementById("popup-nomina").classList.add("oculto")
  empleadoNominaSeleccionado = null
}

// Función para procesar nómina (guardar en base de datos) - CORREGIDA
function procesarNomina() {
  if (nominaActual.length === 0) {
    alert("No hay nómina para procesar.")
    return
  }

  // Validar que todos los empleados tengan datos válidos
  const empleadosInvalidos = nominaActual.filter(
    (nomina) =>
      !nomina.sueldo_base || nomina.sueldo_base <= 0 || !nomina.dias_trabajados || nomina.dias_trabajados <= 0,
  )

  if (empleadosInvalidos.length > 0) {
    alert(
      `Hay ${empleadosInvalidos.length} empleado(s) con datos inválidos. Por favor revise la nómina antes de procesarla.`,
    )
    return
  }

  if (!confirm("¿Está seguro de procesar esta nómina? Esta acción guardará todos los datos en la base de datos.")) {
    return
  }

  // Eliminar nómina existente del período
  db.run("DELETE FROM nomina WHERE mes = ? AND año = ?", [mesSeleccionado, añoSeleccionado], (err) => {
    if (err) {
      console.error("Error eliminando nómina anterior:", err.message)
      alert("Error al procesar la nómina.")
      return
    }

    // Insertar nueva nómina
    let procesados = 0
    let errores = 0
    const total = nominaActual.length

    nominaActual.forEach((nomina) => {
      const query = `
        INSERT INTO nomina (
          empleado_id, periodo, año, mes, dias_trabajados, sueldo_base, dias_feriados,
          monto_dias_feriados, bonos, comisiones, total_devengado, seguro_social,
          ley_politica_habitacional, paro_forzoso, total_deducciones, sueldo_neto,
          prestaciones_sociales, utilidades, vacaciones, fecha_pago, estatus,
          observaciones, fecha_creacion
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `

      db.run(
        query,
        [
          nomina.empleado_id,
          nomina.periodo,
          nomina.año,
          nomina.mes,
          nomina.dias_trabajados,
          nomina.sueldo_base,
          nomina.dias_feriados || 0,
          nomina.monto_dias_feriados || 0,
          nomina.bonos || 0,
          nomina.comisiones || 0,
          nomina.total_devengado || 0,
          nomina.seguro_social || 0,
          nomina.ley_politica_habitacional || 0,
          nomina.paro_forzoso || 0,
          nomina.total_deducciones || 0,
          nomina.sueldo_neto || 0,
          nomina.prestaciones_sociales || 0,
          nomina.utilidades || 0,
          nomina.vacaciones || 0,
          nomina.fecha_pago,
          "procesada",
          nomina.observaciones || "",
          nomina.fecha_creacion,
        ],
        (err) => {
          if (err) {
            console.error("Error insertando nómina:", err.message)
            errores++
          } else {
            procesados++
          }

          // Verificar si se completó el procesamiento
          if (procesados + errores === total) {
            if (errores > 0) {
              alert(`⚠️ Nómina procesada con ${errores} errores. ${procesados} empleados procesados correctamente.`)
            } else {
              alert(`✅ Nómina procesada exitosamente para ${total} empleados.`)
            }
            cargarNomina() // Recargar desde la base de datos
          }
        },
      )
    })
  })
}

// Función para generar reporte de nómina (MEJORADA)
function generarReporteNomina() {
  if (nominaActual.length === 0) {
    alert("No hay nómina para generar reporte.")
    return
  }

  const totalDevengado = nominaActual.reduce((sum, nomina) => sum + (nomina.total_devengado || 0), 0)
  const totalDeducciones = nominaActual.reduce((sum, nomina) => sum + (nomina.total_deducciones || 0), 0)
  const totalNeto = nominaActual.reduce((sum, nomina) => sum + (nomina.sueldo_neto || 0), 0)
  const totalPrestaciones = nominaActual.reduce((sum, nomina) => sum + (nomina.prestaciones_sociales || 0), 0)

  const contenidoReporte = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reporte de Nómina - ${obtenerNombreMes(mesSeleccionado)} ${añoSeleccionado}</title>
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
        .resumen {
          background-color: #f9f9f9;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 30px;
          border-left: 4px solid #880808;
        }
        .resumen-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-top: 15px;
        }
        .resumen-item {
          text-align: center;
          padding: 15px;
          background: white;
          border-radius: 5px;
          border: 1px solid #ddd;
        }
        .resumen-numero {
          font-size: 1.8rem;
          font-weight: bold;
          color: #880808;
        }
        .resumen-label {
          color: #666;
          font-size: 0.9rem;
          margin-top: 5px;
        }
        .nomina-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
          font-size: 12px;
        }
        .nomina-table th,
        .nomina-table td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        .nomina-table th {
          background-color: #880808;
          color: white;
          font-weight: bold;
        }
        .nomina-table tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .total-row {
          background-color: #e8f5e8 !important;
          font-weight: bold;
        }
        .configuraciones {
          background-color: #f0f0f0;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 12px;
        }
        .footer {
          text-align: center;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          color: #666;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">🏋️ SIMETRIC GYM C.A.</div>
        <div class="subtitle">Reporte de Nómina - ${obtenerNombreMes(mesSeleccionado)} ${añoSeleccionado}</div>
      </div>

      <div class="configuraciones">
        <h4>⚙️ Configuraciones Aplicadas</h4>
        <p><strong>Seguro Social:</strong> ${(CONFIGURACIONES.SEGURO_SOCIAL * 100).toFixed(1)}% | 
           <strong>LPH:</strong> ${(CONFIGURACIONES.LPH * 100).toFixed(1)}% | 
           <strong>Paro Forzoso:</strong> ${(CONFIGURACIONES.PARO_FORZOSO * 100).toFixed(1)}% | 
           <strong>Salario Mínimo:</strong> $${CONFIGURACIONES.SALARIO_MINIMO.toFixed(2)} USD |
           <strong>Recargo Feriados:</strong> ${(CONFIGURACIONES.RECARGO_FERIADOS * 100).toFixed(0)}%</p>
      </div>

      <div class="resumen">
        <h3>📊 Resumen General</h3>
        <div class="resumen-grid">
          <div class="resumen-item">
            <div class="resumen-numero">${nominaActual.length}</div>
            <div class="resumen-label">Empleados</div>
          </div>
          <div class="resumen-item">
            <div class="resumen-numero">$${totalDevengado.toFixed(2)}</div>
            <div class="resumen-label">Total Devengado</div>
          </div>
          <div class="resumen-item">
            <div class="resumen-numero">$${totalDeducciones.toFixed(2)}</div>
            <div class="resumen-label">Total Deducciones</div>
          </div>
          <div class="resumen-item">
            <div class="resumen-numero">$${totalNeto.toFixed(2)}</div>
            <div class="resumen-label">Total Neto</div>
          </div>
          <div class="resumen-item">
            <div class="resumen-numero">$${totalPrestaciones.toFixed(2)}</div>
            <div class="resumen-label">Total Prestaciones</div>
          </div>
        </div>
      </div>

      <table class="nomina-table">
        <thead>
          <tr>
            <th>Empleado</th>
            <th>Cargo</th>
            <th>Días</th>
            <th>Sueldo Base</th>
            <th>D. Feriados</th>
            <th>Bonos</th>
            <th>Comisiones</th>
            <th>Total Dev.</th>
            <th>S.S.</th>
            <th>LPH</th>
            <th>P.F.</th>
            <th>Tot. Ded.</th>
            <th>Neto</th>
            <th>Prestaciones</th>
          </tr>
        </thead>
        <tbody>
          ${nominaActual
            .map(
              (nomina) => `
          <tr>
            <td>${nomina.nombre} ${nomina.apellido}</td>
            <td>${formatearCargo(nomina.cargo)}</td>
            <td>${nomina.dias_trabajados}</td>
            <td>$${(nomina.sueldo_base || 0).toFixed(2)}</td>
            <td>$${(nomina.monto_dias_feriados || 0).toFixed(2)}</td>
            <td>$${(nomina.bonos || 0).toFixed(2)}</td>
            <td>$${(nomina.comisiones || 0).toFixed(2)}</td>
            <td>$${(nomina.total_devengado || 0).toFixed(2)}</td>
            <td>$${(nomina.seguro_social || 0).toFixed(2)}</td>
            <td>$${(nomina.ley_politica_habitacional || 0).toFixed(2)}</td>
            <td>$${(nomina.paro_forzoso || 0).toFixed(2)}</td>
            <td>$${(nomina.total_deducciones || 0).toFixed(2)}</td>
            <td>$${(nomina.sueldo_neto || 0).toFixed(2)}</td>
            <td>$${(nomina.prestaciones_sociales || 0).toFixed(2)}</td>
          </tr>
          `,
            )
            .join("")}
          <tr class="total-row">
            <td colspan="7"><strong>TOTALES</strong></td>
            <td><strong>$${totalDevengado.toFixed(2)}</strong></td>
            <td><strong>$${nominaActual.reduce((sum, n) => sum + (n.seguro_social || 0), 0).toFixed(2)}</strong></td>
            <td><strong>$${nominaActual.reduce((sum, n) => sum + (n.ley_politica_habitacional || 0), 0).toFixed(2)}</strong></td>
            <td><strong>$${nominaActual.reduce((sum, n) => sum + (n.paro_forzoso || 0), 0).toFixed(2)}</strong></td>
            <td><strong>$${totalDeducciones.toFixed(2)}</strong></td>
            <td><strong>$${totalNeto.toFixed(2)}</strong></td>
            <td><strong>$${totalPrestaciones.toFixed(2)}</strong></td>
          </tr>
        </tbody>
      </table>

      <div class="footer">
        <p><strong>SIMETRIC GYM C.A.</strong></p>
        <p>Reporte generado el ${new Date().toLocaleDateString("es-ES")} a las ${new Date().toLocaleTimeString("es-ES")}</p>
        <p>RIF: J-31700635/3</p>
      </div>
    </body>
    </html>
  `

  // Abrir ventana para imprimir/guardar
  const ventanaReporte = window.open("", "", "width=1200,height=800")
  if (!ventanaReporte) {
    alert(
      "❌ Error: El navegador bloqueó la ventana emergente. Por favor, permite ventanas emergentes para este sitio.",
    )
    return
  }

  ventanaReporte.document.write(contenidoReporte)
  ventanaReporte.document.close()

  setTimeout(() => {
    ventanaReporte.print()
  }, 500)
}

// Función para abrir cálculo de prestaciones (CORREGIDA)
function abrirCalculoPrestaciones() {
  const añoActual = new Date().getFullYear()
  document.getElementById("año-prestaciones").textContent = añoActual
  document.getElementById("salario-minimo-prestaciones").textContent = CONFIGURACIONES.SALARIO_MINIMO.toFixed(2)

  // Cargar empleados activos para prestaciones
  db.all("SELECT * FROM empleados WHERE estatus = 'activo' ORDER BY nombre, apellido", [], (err, empleados) => {
    if (err) {
      console.error("Error cargando empleados para prestaciones:", err.message)
      alert("Error al cargar empleados para prestaciones.")
      return
    }

    if (empleados.length === 0) {
      alert("No hay empleados activos para calcular prestaciones.")
      return
    }

    const prestacionesHTML = empleados
      .map((empleado) => {
        const antiguedad = calcularAntiguedad(empleado.fecha_ingreso)
        const prestaciones = calcularPrestacionesSociales(empleado.sueldo_base, antiguedad.años, antiguedad.meses)

        // Calcular componentes por separado para mostrar detalle
        const añosCompletos = antiguedad.años + antiguedad.meses / 12
        const prestacionesBase = (empleado.sueldo_base / CONFIGURACIONES.DIAS_MES) * 30 * añosCompletos
        const intereses = prestacionesBase * CONFIGURACIONES.TASA_INTERES_PRESTACIONES * añosCompletos

        return `
        <div class="prestacion-empleado">
          <div class="empleado-prestacion-header">
            <span class="empleado-nombre">${empleado.nombre} ${empleado.apellido}</span>
            <span class="prestacion-monto">$${prestaciones.toFixed(2)}</span>
          </div>
          <div class="prestacion-detalles">
            <div><strong>Cargo:</strong> ${formatearCargo(empleado.cargo)}</div>
            <div><strong>Sueldo:</strong> $${empleado.sueldo_base.toFixed(2)}</div>
            <div><strong>Fecha Ingreso:</strong> ${new Date(empleado.fecha_ingreso).toLocaleDateString("es-ES")}</div>
            <div><strong>Antigüedad:</strong> ${antiguedad.años} años, ${antiguedad.meses} meses</div>
            <div><strong>Años completos:</strong> ${añosCompletos.toFixed(2)}</div>
            <div><strong>Base (30 días/año):</strong> $${prestacionesBase.toFixed(2)}</div>
            <div><strong>Intereses (12%):</strong> $${intereses.toFixed(2)}</div>
            <div><strong>Total:</strong> $${prestaciones.toFixed(2)}</div>
          </div>
        </div>
      `
      })
      .join("")

    document.getElementById("prestaciones-container").innerHTML = prestacionesHTML
    document.getElementById("popup-prestaciones").classList.remove("oculto")
  })
}

// Función para abrir cálculo de utilidades (CORREGIDA)
function abrirCalculoUtilidades() {
  document.getElementById("popup-utilidades").classList.remove("oculto")
}

// Event listener para calcular utilidades (CORREGIDO)
document.getElementById("calcular-utilidades-btn").addEventListener("click", () => {
  const año = Number.parseInt(document.getElementById("año-utilidades").value)
  const beneficioEmpresa = Number.parseFloat(document.getElementById("beneficio-empresa").value) || 0

  if (!año || año < 2020 || año > new Date().getFullYear() + 1) {
    alert("Por favor seleccione un año válido.")
    return
  }

  if (beneficioEmpresa <= 0) {
    alert("Debe ingresar el beneficio de la empresa para calcular utilidades.")
    document.getElementById("beneficio-empresa").focus()
    return
  }

  // Cargar empleados activos del año seleccionado
  db.all("SELECT * FROM empleados WHERE estatus = 'activo' ORDER BY nombre, apellido", [], (err, empleados) => {
    if (err) {
      console.error("Error cargando empleados para utilidades:", err.message)
      alert("Error al cargar empleados para utilidades.")
      return
    }

    if (empleados.length === 0) {
      alert("No hay empleados activos para calcular utilidades.")
      return
    }

    // Calcular suma total de sueldos para distribución proporcional
    const sumaSueldos = empleados.reduce((sum, emp) => sum + (emp.sueldo_base || 0), 0)

    if (sumaSueldos <= 0) {
      alert("Error: La suma de sueldos es 0. Verifique los datos de los empleados.")
      return
    }

    const utilidadesHTML = empleados
      .map((empleado) => {
        // Mínimo 15 días de salario
        const minimoUtilidades = (empleado.sueldo_base / 30) * 15

        // Distribución proporcional del beneficio
        const proporcion = empleado.sueldo_base / sumaSueldos
        const utilidadProporcional = beneficioEmpresa * proporcion

        // Total de utilidades
        const totalUtilidades = minimoUtilidades + utilidadProporcional

        // Máximo 4 meses de salario
        const maximoUtilidades = empleado.sueldo_base * 4
        const utilidadFinal = Math.min(totalUtilidades, maximoUtilidades)

        return `
        <div class="utilidad-empleado">
          <div class="empleado-prestacion-header">
            <span class="empleado-nombre">${empleado.nombre} ${empleado.apellido}</span>
            <span class="utilidad-monto">$${utilidadFinal.toFixed(2)}</span>
          </div>
          <div class="utilidad-detalles">
            <div><strong>Cargo:</strong> ${formatearCargo(empleado.cargo)}</div>
            <div><strong>Sueldo base:</strong> $${empleado.sueldo_base.toFixed(2)}</div>
            <div><strong>Proporción:</strong> ${(proporcion * 100).toFixed(2)}%</div>
            <div><strong>Mínimo (15 días):</strong> $${minimoUtilidades.toFixed(2)}</div>
            <div><strong>Proporcional:</strong> $${utilidadProporcional.toFixed(2)}</div>
            <div><strong>Total calculado:</strong> $${totalUtilidades.toFixed(2)}</div>
            <div><strong>Máximo (4 meses):</strong> $${maximoUtilidades.toFixed(2)}</div>
            <div><strong>Utilidad final:</strong> $${utilidadFinal.toFixed(2)}</div>
          </div>
        </div>
      `
      })
      .join("")

    document.getElementById("utilidades-container").innerHTML = utilidadesHTML
    document.getElementById("procesar-utilidades").style.display = "inline-block"
  })
})

// Event listener corregido para procesar prestaciones
document.getElementById("procesar-prestaciones").addEventListener("click", () => {
  if (
    !confirm(
      "¿Está seguro de procesar las prestaciones sociales? Esta acción creará registros de prestaciones para todos los empleados.",
    )
  ) {
    return
  }

  // Obtener empleados del contenedor de prestaciones
  const prestacionesItems = document.querySelectorAll(".prestacion-empleado")
  if (prestacionesItems.length === 0) {
    alert("No hay empleados para procesar prestaciones.")
    return
  }

  let procesados = 0
  let errores = 0
  const total = prestacionesItems.length

  prestacionesItems.forEach((item) => {
    const nombreCompleto = item.querySelector(".empleado-nombre").textContent
    const montoTotal = Number.parseFloat(item.querySelector(".prestacion-monto").textContent.replace("$", ""))
    const año = Number.parseInt(document.getElementById("año-prestaciones").textContent)

    // Buscar empleado por nombre
    db.get(
      "SELECT id, sueldo_base, fecha_ingreso FROM empleados WHERE (nombre || ' ' || apellido) = ?",
      [nombreCompleto],
      (err, empleado) => {
        if (err) {
          console.error("Error buscando empleado:", err.message)
          errores++
        } else if (empleado) {
          // Calcular componentes según la estructura de la tabla
          const antiguedad = calcularAntiguedad(empleado.fecha_ingreso)
          const añosCompletos = antiguedad.años + antiguedad.meses / 12
          const diasAntiguedad = Math.floor(añosCompletos * 365)
          const prestacionesBase = (empleado.sueldo_base / CONFIGURACIONES.DIAS_MES) * 30 * añosCompletos
          const intereses = prestacionesBase * CONFIGURACIONES.TASA_INTERES_PRESTACIONES * añosCompletos

          const query = `
          INSERT OR REPLACE INTO prestaciones_sociales 
          (empleado_id, año, sueldo_promedio, dias_antiguedad, monto_prestaciones, intereses_prestaciones, total_acumulado, fecha_calculo)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `

          db.run(
            query,
            [
              empleado.id,
              año,
              empleado.sueldo_base,
              diasAntiguedad,
              prestacionesBase,
              intereses,
              montoTotal,
              new Date().toISOString().split("T")[0],
            ],
            (err) => {
              if (err) {
                console.error("Error procesando prestaciones:", err.message)
                errores++
              } else {
                procesados++
              }

              // Verificar si se completó el procesamiento
              if (procesados + errores === total) {
                if (errores > 0) {
                  alert(
                    `⚠️ Prestaciones procesadas con ${errores} errores. ${procesados} empleados procesados correctamente.`,
                  )
                } else {
                  alert(`✅ Prestaciones sociales procesadas para ${procesados} empleados.`)
                }
                document.getElementById("popup-prestaciones").classList.add("oculto")
              }
            },
          )
        } else {
          console.error("Empleado no encontrado:", nombreCompleto)
          errores++
          if (procesados + errores === total) {
            alert(`⚠️ Prestaciones procesadas con ${errores} errores. ${procesados} empleados procesados correctamente.`)
            document.getElementById("popup-prestaciones").classList.add("oculto")
          }
        }
      },
    )
  })
})

document.getElementById("procesar-utilidades").addEventListener("click", () => {
  alert("⚠️ Funcionalidad de procesamiento de utilidades en desarrollo.")
})

// Event listeners para cerrar popups de prestaciones y utilidades
document.getElementById("cerrar-popup-prestaciones").addEventListener("click", () => {
  document.getElementById("popup-prestaciones").classList.add("oculto")
})

document.getElementById("cancelar-prestaciones").addEventListener("click", () => {
  document.getElementById("popup-prestaciones").classList.add("oculto")
})

document.getElementById("cerrar-popup-utilidades").addEventListener("click", () => {
  document.getElementById("popup-utilidades").classList.add("oculto")
  document.getElementById("procesar-utilidades").style.display = "none"
  document.getElementById("utilidades-container").innerHTML = ""
})

document.getElementById("cancelar-utilidades").addEventListener("click", () => {
  document.getElementById("popup-utilidades").classList.add("oculto")
  document.getElementById("procesar-utilidades").style.display = "none"
  document.getElementById("utilidades-container").innerHTML = ""
})

// Función para obtener nombre del mes
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

// Función para formatear cargo
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
  return cargos[cargo] || cargo
}

const { exec } = require("child_process")
const path = require("path")

// Event listener para el botón de respaldo
document.getElementById("btn-respaldar").addEventListener("click", () => {
  // Deshabilitar botón durante el proceso
  const btnRespaldar = document.getElementById("btn-respaldar")
  const originalText = btnRespaldar.textContent
  btnRespaldar.disabled = true
  btnRespaldar.textContent = "⏳ Creando respaldo..."

  const backupScriptPath = path.join(__dirname, "backup.js")
  exec(`node "${backupScriptPath}"`, (error, stdout, stderr) => {
    // Rehabilitar botón
    btnRespaldar.disabled = false
    btnRespaldar.textContent = originalText

    if (error) {
      alert("❌ Error al crear el respaldo.\n\nRevisa la consola para más detalles.")
      console.error("Error:", stderr)
    } else {
      alert("✅ Respaldo creado exitosamente en la carpeta Documentos/SimetricGym_Respaldo.")
      console.log("Respaldo exitoso:", stdout)

      // Actualizar información después del respaldo
      actualizarInformacion()
    }
  })
})

// Event listener para el botón de recuperación
document.getElementById("restore-btn").addEventListener("click", () => {
  try {
    // Deshabilitar botón durante el proceso
    const btnRecuperar = document.getElementById("restore-btn")
    const originalText = btnRecuperar.textContent
    btnRecuperar.disabled = true
    btnRecuperar.textContent = "📁 Seleccionar archivo..."

    // Importar y ejecutar la función de recuperación
    const { recuperarBaseDatos } = require("./recovery.js")

    // Ejecutar la función de recuperación
    recuperarBaseDatos()

    // Rehabilitar botón después de un momento
    setTimeout(() => {
      btnRecuperar.disabled = false
      btnRecuperar.textContent = originalText
      // Actualizar información después de la recuperación
      actualizarInformacion()
    }, 2000)
  } catch (error) {
    console.error("Error al cargar módulo de recuperación:", error)
    alert("❌ Error al cargar el módulo de recuperación.\n\nRevisa la consola para más detalles.")

    // Rehabilitar botón en caso de error
    const btnRecuperar = document.getElementById("restore-btn")
    btnRecuperar.disabled = false
    btnRecuperar.textContent = "🔄 Recuperar"
  }
})

// Función para actualizar toda la información en la interfaz
function actualizarInformacion() {
  actualizarEstadoBaseDatos()
  actualizarEstadisticasRespaldos()
}

// Función para actualizar el estado de la base de datos en la interfaz
function actualizarEstadoBaseDatos() {
  try {
    const { obtenerInfoBaseDatos } = require("./recovery.js")
    const info = obtenerInfoBaseDatos()

    const dbStatusElement = document.getElementById("db-status")
    const dbModifiedElement = document.getElementById("db-modified")
    const dbSizeElement = document.getElementById("db-size")

    if (info.existe) {
      dbStatusElement.textContent = "✅ Activa"
      dbStatusElement.style.color = "#4CAF50"
      dbModifiedElement.textContent = info.ultimaModificacion
      dbSizeElement.textContent = info.tamaño

      console.log(`📊 Estado de la base de datos actualizado:`)
      console.log(`   • Estado: Activa`)
      console.log(`   • Última modificación: ${info.ultimaModificacion}`)
      console.log(`   • Tamaño: ${info.tamaño}`)
    } else {
      dbStatusElement.textContent = "❌ No encontrada"
      dbStatusElement.style.color = "#f44336"
      dbModifiedElement.textContent = "N/A"
      dbSizeElement.textContent = "N/A"
      console.log("⚠️ No se encontró la base de datos actual")
    }
  } catch (error) {
    console.error("Error al actualizar estado de la base de datos:", error)
    const dbStatusElement = document.getElementById("db-status")
    if (dbStatusElement) {
      dbStatusElement.textContent = "❌ Error"
      dbStatusElement.style.color = "#f44336"
    }
  }
}

// Función para actualizar estadísticas de respaldos en la interfaz
function actualizarEstadisticasRespaldos() {
  try {
    const { obtenerEstadisticasRespaldos } = require("./recovery.js")
    const stats = obtenerEstadisticasRespaldos()

    const backupCountElement = document.getElementById("backup-count")
    const lastBackupElement = document.getElementById("last-backup")

    if (backupCountElement) {
      backupCountElement.textContent = stats.totalRespaldos.toString()
    }

    if (lastBackupElement) {
      if (stats.ultimoRespaldo) {
        const fecha = new Date(stats.ultimoRespaldo.stats.mtime).toLocaleString("es-ES")
        lastBackupElement.textContent = `${stats.ultimoRespaldo.name} (${fecha})`
      } else {
        lastBackupElement.textContent = "No hay respaldos disponibles"
      }
    }

    console.log(`📊 Estadísticas de respaldos actualizadas:`)
    console.log(`   • Total de respaldos: ${stats.totalRespaldos}`)
    console.log(`   • Carpeta: ${stats.carpetaRespaldos}`)

    if (stats.ultimoRespaldo) {
      console.log(`   • Último respaldo: ${stats.ultimoRespaldo.name}`)
      console.log(`   • Fecha: ${new Date(stats.ultimoRespaldo.stats.mtime).toLocaleString("es-ES")}`)
    }
  } catch (error) {
    console.error("Error al actualizar estadísticas de respaldos:", error)
    const backupCountElement = document.getElementById("backup-count")
    const lastBackupElement = document.getElementById("last-backup")

    if (backupCountElement) {
      backupCountElement.textContent = "Error"
    }
    if (lastBackupElement) {
      lastBackupElement.textContent = "Error al cargar información"
    }
  }
}

// Cargar información al iniciar la página
document.addEventListener("DOMContentLoaded", () => {
  console.log("🔄 Cargando módulo de gestión de base de datos...")

  // Actualizar toda la información
  actualizarInformacion()

  console.log("✅ Módulo cargado correctamente")
})

// Actualizar información cada 30 segundos
setInterval(() => {
  actualizarInformacion()
}, 30000)

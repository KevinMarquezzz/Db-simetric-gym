const fs = require("fs")
const path = require("path")
const os = require("os")

// Función para crear el input file dinámicamente
function crearSelectorArchivo() {
  const input = document.createElement("input")
  input.type = "file"
  input.accept = ".sqlite"
  input.style.display = "none"

  return input
}

// Función para obtener la carpeta de respaldos (misma que usa backup.js)
function obtenerCarpetaRespaldos() {
  const backupFolder = path.join(os.homedir(), "Documents", "SimetricGym_Respaldo")

  // Crear la carpeta si no existe
  if (!fs.existsSync(backupFolder)) {
    fs.mkdirSync(backupFolder, { recursive: true })
    console.log("Carpeta de respaldos creada:", backupFolder)
  }

  return backupFolder
}

// Función para crear nombre de archivo con timestamp
function crearNombreConTimestamp(prefijo = "backup_simetricdb", extension = ".sqlite") {
  const date = new Date()
  const timestamp = `${date.getFullYear()}-${(date.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}_${date
    .getHours()
    .toString()
    .padStart(2, "0")}-${date.getMinutes().toString().padStart(2, "0")}-${date
    .getSeconds()
    .toString()
    .padStart(2, "0")}`

  return `${prefijo}_${timestamp}${extension}`
}

// Función para recuperar base de datos
function recuperarBaseDatos() {
  const input = crearSelectorArchivo()

  input.addEventListener("change", (event) => {
    const file = event.target.files[0]

    if (!file) {
      console.log("No se seleccionó ningún archivo")
      return
    }

    // Validar extensión del archivo
    if (!file.name.toLowerCase().endsWith(".sqlite")) {
      alert("Por favor selecciona un archivo .sqlite válido.")
      return
    }

    // En Electron con nodeIntegration, podemos acceder a file.path directamente
    // Si no está disponible, usamos FileReader como alternativa
    const selectedFilePath = file.path

    if (!selectedFilePath) {
      // Alternativa usando FileReader para obtener el contenido del archivo
      procesarArchivoConFileReader(file)
      return
    }

    // Validar que el archivo existe usando la ruta
    if (!fs.existsSync(selectedFilePath)) {
      console.log("Ruta del archivo:", selectedFilePath)
      alert("El archivo seleccionado no se puede acceder. Intentando método alternativo...")
      procesarArchivoConFileReader(file)
      return
    }

    // Validar integridad del archivo SQLite
    if (!validarArchivoSQLite(selectedFilePath)) {
      alert("El archivo seleccionado no es un archivo SQLite válido.")
      return
    }

    // Mostrar confirmación
    const confirmacion = confirm(
      `¿Estás seguro de que deseas restaurar la base de datos?\n\n` +
        `Archivo seleccionado: ${file.name}\n` +
        `Tamaño: ${formatFileSize(file.size)}\n\n` +
        `ADVERTENCIA: Esta acción reemplazará completamente la base de datos actual y no se puede deshacer.\n\n` +
        `NOTA: Se creará un respaldo automático de la base de datos actual en la carpeta Documentos/SimetricGym_Respaldo.`,
    )

    if (confirmacion) {
      restaurarArchivo(selectedFilePath, file.name)
    }

    // Limpiar el input
    input.remove()
  })

  // Agregar al DOM temporalmente y hacer clic
  document.body.appendChild(input)
  input.click()
}

// Función alternativa usando FileReader
function procesarArchivoConFileReader(file) {
  const reader = new FileReader()

  reader.onload = (e) => {
    try {
      // Crear archivo temporal
      const tempDir = require("os").tmpdir()
      const tempFilePath = path.join(tempDir, `temp_${Date.now()}_${file.name}`)

      // Escribir el contenido del archivo
      const buffer = Buffer.from(e.target.result)
      fs.writeFileSync(tempFilePath, buffer)

      console.log("Archivo temporal creado:", tempFilePath)

      // Validar integridad del archivo SQLite
      if (!validarArchivoSQLite(tempFilePath)) {
        alert("El archivo seleccionado no es un archivo SQLite válido.")
        // Limpiar archivo temporal
        fs.unlinkSync(tempFilePath)
        return
      }

      // Mostrar confirmación
      const confirmacion = confirm(
        `¿Estás seguro de que deseas restaurar la base de datos?\n\n` +
          `Archivo seleccionado: ${file.name}\n` +
          `Tamaño: ${formatFileSize(file.size)}\n\n` +
          `ADVERTENCIA: Esta acción reemplazará completamente la base de datos actual y no se puede deshacer.\n\n` +
          `NOTA: Se creará un respaldo automático de la base de datos actual en la carpeta Documentos/SimetricGym_Respaldo.`,
      )

      if (confirmacion) {
        restaurarArchivo(tempFilePath, file.name, true) // true indica que es archivo temporal
      } else {
        // Limpiar archivo temporal si se cancela
        fs.unlinkSync(tempFilePath)
      }
    } catch (error) {
      console.error("Error al procesar archivo:", error)
      alert("Error al procesar el archivo seleccionado.")
    }
  }

  reader.onerror = () => {
    alert("Error al leer el archivo seleccionado.")
  }

  // Leer el archivo como ArrayBuffer
  reader.readAsArrayBuffer(file)
}

// Función para formatear el tamaño del archivo
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

// Función para restaurar el archivo
function restaurarArchivo(archivoRespaldo, nombreArchivo, esArchivoTemporal = false) {
  // Ruta al archivo actual de la base de datos
  const dbPath = path.join(__dirname, "..", "..", "..", "..", "..", "simetricdb.sqlite")

  // Obtener carpeta de respaldos
  const backupFolder = obtenerCarpetaRespaldos()

  // Crear respaldo del archivo actual antes de reemplazarlo
  const backupFileName = crearNombreConTimestamp("Respaldo_antes_recuperacion_simetricdb")
  const backupCurrentPath = path.join(backupFolder, backupFileName)

  try {
    // Hacer respaldo del archivo actual
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, backupCurrentPath)
      console.log("Respaldo de seguridad creado en:", backupCurrentPath)
    }

    // Copiar el archivo de respaldo seleccionado
    fs.copyFileSync(archivoRespaldo, dbPath)

    // Limpiar archivo temporal si es necesario
    if (esArchivoTemporal) {
      fs.unlinkSync(archivoRespaldo)
      console.log("Archivo temporal limpiado")
    }

    alert(
      "✅ Base de datos restaurada exitosamente.\n\n" +
        `Archivo restaurado: ${nombreArchivo}\n\n` +
        `Respaldo de seguridad guardado en:\nDocumentos/SimetricGym_Respaldo/${backupFileName}\n\n` +
        "Es recomendable reiniciar la aplicación para asegurar que todos los cambios se apliquen correctamente.",
    )

    console.log("Base de datos restaurada exitosamente desde:", nombreArchivo)
    console.log("Respaldo de seguridad guardado en:", backupCurrentPath)

    // Limpiar respaldos antiguos automáticamente
    limpiarRespaldosAntiguos()

    // Mostrar opción de reinicio
    mostrarOpcionReinicio()
  } catch (error) {
    console.error("Error al restaurar la base de datos:", error)

    // Limpiar archivo temporal en caso de error
    if (esArchivoTemporal && fs.existsSync(archivoRespaldo)) {
      fs.unlinkSync(archivoRespaldo)
    }

    // Intentar restaurar el archivo original si algo salió mal
    try {
      if (fs.existsSync(backupCurrentPath)) {
        fs.copyFileSync(backupCurrentPath, dbPath)
        console.log("Archivo original restaurado debido al error")
      }
    } catch (restoreError) {
      console.error("Error crítico al restaurar archivo original:", restoreError)
    }

    alert(
      "❌ Error al restaurar la base de datos.\n\n" +
        "La base de datos original se ha mantenido intacta.\n\n" +
        "Verifica que el archivo seleccionado sea un respaldo válido.\n\n" +
        `Error: ${error.message}`,
    )
  }
}

// Función para limpiar respaldos antiguos automáticamente
function limpiarRespaldosAntiguos() {
  try {
    const backupFolder = obtenerCarpetaRespaldos()

    // Obtener todos los archivos de respaldo
    const files = fs.readdirSync(backupFolder)
    const backupFiles = files
      .filter((file) => file.endsWith(".sqlite"))
      .map((file) => ({
        name: file,
        path: path.join(backupFolder, file),
        stats: fs.statSync(path.join(backupFolder, file)),
      }))
      .sort((a, b) => b.stats.mtime - a.stats.mtime) // Ordenar por fecha de modificación (más reciente primero)

    // Mantener solo los últimos 10 respaldos
    const maxBackups = 10
    if (backupFiles.length > maxBackups) {
      const filesToDelete = backupFiles.slice(maxBackups)
      let deletedCount = 0

      filesToDelete.forEach((file) => {
        try {
          fs.unlinkSync(file.path)
          deletedCount++
          console.log(`🗑️ Respaldo antiguo eliminado: ${file.name}`)
        } catch (deleteError) {
          console.error(`Error al eliminar ${file.name}:`, deleteError)
        }
      })

      if (deletedCount > 0) {
        console.log(`✅ Se eliminaron ${deletedCount} respaldos antiguos. Se mantienen los últimos ${maxBackups}.`)
      }
    }
  } catch (error) {
    console.error("Error al limpiar respaldos antiguos:", error)
  }
}

// Función para mostrar opción de reinicio
function mostrarOpcionReinicio() {
  const reiniciar = confirm(
    "¿Deseas reiniciar la aplicación ahora para aplicar todos los cambios?\n\n" +
      "Recomendado: Sí\n\n" +
      "Si seleccionas 'Cancelar', deberás reiniciar manualmente la aplicación.",
  )

  if (reiniciar) {
    alert("La aplicación se recargará ahora...")
    setTimeout(() => {
      window.location.reload()
    }, 1000)
  } else {
    alert("Recuerda reiniciar la aplicación manualmente para aplicar todos los cambios.")
  }
}

// Función para validar integridad del archivo SQLite
function validarArchivoSQLite(filePath) {
  try {
    // Leer los primeros 16 bytes del archivo
    const buffer = fs.readFileSync(filePath, { start: 0, end: 15 })
    const header = buffer.toString("utf8", 0, 15)

    // Verificar que comience con "SQLite format 3"
    const isValidSQLite = header === "SQLite format 3"

    if (!isValidSQLite) {
      console.log("Archivo no es SQLite válido. Header encontrado:", header)
    }

    return isValidSQLite
  } catch (error) {
    console.error("Error al validar archivo SQLite:", error)
    return false
  }
}

// Función para obtener información del archivo de base de datos actual
function obtenerInfoBaseDatos() {
  const dbPath = path.join(__dirname, "..", "..", "..", "..", "..", "simetricdb.sqlite")

  if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath)
    return {
      existe: true,
      tamaño: formatFileSize(stats.size),
      ultimaModificacion: new Date(stats.mtime).toLocaleString("es-ES"),
      ruta: dbPath,
    }
  }

  return {
    existe: false,
    mensaje: "No se encontró la base de datos actual",
  }
}

// Función para obtener estadísticas de respaldos
function obtenerEstadisticasRespaldos() {
  try {
    const backupFolder = obtenerCarpetaRespaldos()

    if (!fs.existsSync(backupFolder)) {
      return {
        totalRespaldos: 0,
        ultimoRespaldo: null,
        carpetaRespaldos: backupFolder,
      }
    }

    const files = fs.readdirSync(backupFolder)
    const backupFiles = files
      .filter((file) => file.endsWith(".sqlite"))
      .map((file) => ({
        name: file,
        path: path.join(backupFolder, file),
        stats: fs.statSync(path.join(backupFolder, file)),
      }))
      .sort((a, b) => b.stats.mtime - a.stats.mtime)

    return {
      totalRespaldos: backupFiles.length,
      ultimoRespaldo: backupFiles.length > 0 ? backupFiles[0] : null,
      carpetaRespaldos: backupFolder,
      respaldos: backupFiles,
    }
  } catch (error) {
    console.error("Error al obtener estadísticas de respaldos:", error)
    return {
      totalRespaldos: 0,
      ultimoRespaldo: null,
      carpetaRespaldos: null,
      error: error.message,
    }
  }
}

// Exportar funciones para uso externo
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    recuperarBaseDatos,
    obtenerInfoBaseDatos,
    validarArchivoSQLite,
    obtenerEstadisticasRespaldos,
    limpiarRespaldosAntiguos,
  }
}

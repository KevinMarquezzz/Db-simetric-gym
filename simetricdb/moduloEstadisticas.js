const sqlite3 = require("sqlite3").verbose()

// Conectar a la base de datos unificada
const db = new sqlite3.Database("simetricdb.sqlite", (err) => {
  if (err) {
    console.error("Error conectando a la base de datos:", err.message)
  } else {
    console.log("✅ Conectado a la base de datos unificada para estadísticas.")
    cargarEstadisticasIniciales()
  }
})

const contenedor = document.getElementById("ventas-container")
const btnFiltrar = document.getElementById("btn-filtrar")
const btnExportarPDF = document.getElementById("btn-exportar-pdf")
const popup = document.getElementById("popup-detalles-ventas")
const cerrarPopup = document.getElementById("cerrar-popup-ventas")
const contenidoDetalles = document.getElementById("contenido-detalles-ventas")

let datosActuales = []
let filtroActual = ""

// Cargar estadísticas iniciales
function cargarEstadisticasIniciales() {
  const query = `
    SELECT 
      p.nombre,
      p.codigo,
      p.categoria,
      p.marca,
      p.precio_venta,
      SUM(dv.cantidad) as total_vendido,
      SUM(dv.subtotal) as total_ingresos,
      COUNT(DISTINCT v.id) as total_ventas,
      AVG(dv.cantidad) as promedio_por_venta,
      MIN(v.fecha_venta) as primera_venta,
      MAX(v.fecha_venta) as ultima_venta
    FROM productos p
    INNER JOIN detalle_ventas dv ON p.id = dv.producto_id
    INNER JOIN ventas v ON dv.venta_id = v.id
    GROUP BY p.id
    ORDER BY total_vendido DESC
  `

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Error cargando estadísticas:", err.message)
      return
    }
    datosActuales = rows
    renderizarTabla(rows)
    actualizarResumenGeneral(rows)
  })
}

// Event listener para filtrar
btnFiltrar.addEventListener("click", () => {
  const mes = document.getElementById("filtro-mes").value
  const inicio = document.getElementById("fecha-inicio").value
  const fin = document.getElementById("fecha-fin").value

  let whereClause = ""
  const parametros = []

  if (mes) {
    const [año, mesNum] = mes.split("-")
    whereClause = `WHERE strftime('%Y-%m', v.fecha_venta) = ?`
    parametros.push(`${año}-${mesNum}`)
    filtroActual = `Mes: ${new Date(año, mesNum - 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" })}`
  } else if (inicio && fin) {
    whereClause = `WHERE date(v.fecha_venta) BETWEEN ? AND ?`
    parametros.push(inicio, fin)
    filtroActual = `Período: ${new Date(inicio).toLocaleDateString("es-ES")} - ${new Date(fin).toLocaleDateString("es-ES")}`
  } else {
    filtroActual = "Todos los períodos"
  }

  const query = `
    SELECT 
      p.nombre,
      p.codigo,
      p.categoria,
      p.marca,
      p.precio_venta,
      SUM(dv.cantidad) as total_vendido,
      SUM(dv.subtotal) as total_ingresos,
      COUNT(DISTINCT v.id) as total_ventas,
      AVG(dv.cantidad) as promedio_por_venta,
      MIN(v.fecha_venta) as primera_venta,
      MAX(v.fecha_venta) as ultima_venta
    FROM productos p
    INNER JOIN detalle_ventas dv ON p.id = dv.producto_id
    INNER JOIN ventas v ON dv.venta_id = v.id
    ${whereClause}
    GROUP BY p.id
    ORDER BY total_vendido DESC
  `

  db.all(query, parametros, (err, rows) => {
    if (err) {
      console.error("Error filtrando datos:", err.message)
      return
    }
    datosActuales = rows
    renderizarTabla(rows)
    actualizarResumenGeneral(rows)
  })
})

// Renderizar tabla de productos más vendidos
function renderizarTabla(data) {
  if (!data || data.length === 0) {
    contenedor.innerHTML =
      '<p style="text-align: center; padding: 2rem; color: #888;">No se encontraron datos para el período seleccionado.</p>'
    return
  }

  let html = `
    <div class="table-header">
      <div>Ranking</div>
      <div>Producto</div>
      <div>Código</div>
      <div>Cantidad Vendida</div>
      <div>Ingresos ($)</div>
      <div>Ventas</div>
      <div>Detalles</div>
    </div>
  `

  data.forEach((producto, index) => {
    const ranking = index + 1
    const medallaIcon = ranking === 1 ? "🥇" : ranking === 2 ? "🥈" : ranking === 3 ? "🥉" : `${ranking}°`

    html += `
      <div class="table-row ${ranking <= 3 ? "top-product" : ""}">
        <div class="ranking">${medallaIcon}</div>
        <div class="producto-info">
          <div class="producto-nombre">${producto.nombre}</div>
          <div class="producto-categoria">${producto.categoria} - ${producto.marca}</div>
        </div>
        <div>${producto.codigo}</div>
        <div class="cantidad-vendida">${producto.total_vendido}</div>
        <div class="ingresos">$${producto.total_ingresos.toFixed(2)}</div>
        <div class="total-ventas">${producto.total_ventas}</div>
        <div>
          <button class="ver-detalles-producto" data-codigo="${producto.codigo}">
            📊 Ver Análisis
          </button>
        </div>
      </div>
    `
  })

  contenedor.innerHTML = html
}

// Actualizar resumen general
function actualizarResumenGeneral(data) {
  if (!data || data.length === 0) return

  const totalProductos = data.length
  const totalUnidadesVendidas = data.reduce((sum, p) => sum + p.total_vendido, 0)
  const totalIngresos = data.reduce((sum, p) => sum + p.total_ingresos, 0)
  const totalVentas = data.reduce((sum, p) => sum + p.total_ventas, 0)

  const resumenHTML = `
    <div class="resumen-estadisticas">
      <h3>📊 Resumen del Período: ${filtroActual}</h3>
      <div class="resumen-grid">
        <div class="resumen-item">
          <div class="resumen-valor">${totalProductos}</div>
          <div class="resumen-label">Productos Vendidos</div>
        </div>
        <div class="resumen-item">
          <div class="resumen-valor">${totalUnidadesVendidas}</div>
          <div class="resumen-label">Unidades Vendidas</div>
        </div>
        <div class="resumen-item">
          <div class="resumen-valor">$${totalIngresos.toFixed(2)}</div>
          <div class="resumen-label">Ingresos Totales</div>
        </div>
        <div class="resumen-item">
          <div class="resumen-valor">${totalVentas}</div>
          <div class="resumen-label">Transacciones</div>
        </div>
      </div>
    </div>
  `

  // Insertar o actualizar el resumen
  const resumenExistente = document.querySelector(".resumen-estadisticas")
  if (resumenExistente) {
    resumenExistente.outerHTML = resumenHTML
  } else {
    contenedor.insertAdjacentHTML("beforebegin", resumenHTML)
  }
}

// Event listener para ver detalles del producto
contenedor.addEventListener("click", (e) => {
  if (e.target.classList.contains("ver-detalles-producto")) {
    const codigo = e.target.dataset.codigo
    mostrarAnalisisDetallado(codigo)
  }
})

// Mostrar análisis detallado del producto
function mostrarAnalisisDetallado(codigo) {
  // Obtener información básica del producto
  db.get("SELECT * FROM productos WHERE codigo = ?", [codigo], (err, producto) => {
    if (err) {
      console.error("Error obteniendo producto:", err.message)
      return
    }

    if (!producto) {
      alert("Producto no encontrado")
      return
    }

    // Obtener análisis detallado de ventas
    const queryAnalisis = `
      SELECT 
        v.fecha_venta,
        v.cliente_nombre,
        v.metodo_pago,
        dv.cantidad,
        dv.precio_unitario,
        dv.subtotal,
        strftime('%w', v.fecha_venta) as dia_semana,
        strftime('%H', v.fecha_venta) as hora
      FROM ventas v
      INNER JOIN detalle_ventas dv ON v.id = dv.venta_id
      INNER JOIN productos p ON dv.producto_id = p.id
      WHERE p.codigo = ?
      ORDER BY v.fecha_venta DESC
    `

    db.all(queryAnalisis, [codigo], (err, ventas) => {
      if (err) {
        console.error("Error obteniendo análisis:", err.message)
        return
      }

      // Análisis por día de la semana
      const ventasPorDia = {}
      const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]

      // Análisis por método de pago
      const ventasPorMetodo = {}

      // Análisis temporal
      const ventasPorMes = {}

      ventas.forEach((venta) => {
        // Por día de la semana
        const dia = diasSemana[Number.parseInt(venta.dia_semana)]
        ventasPorDia[dia] = (ventasPorDia[dia] || 0) + venta.cantidad

        // Por método de pago
        ventasPorMetodo[venta.metodo_pago] = (ventasPorMetodo[venta.metodo_pago] || 0) + venta.cantidad

        // Por mes
        const fecha = new Date(venta.fecha_venta)
        const mesAnio = fecha.toLocaleDateString("es-ES", { month: "long", year: "numeric" })
        ventasPorMes[mesAnio] = (ventasPorMes[mesAnio] || 0) + venta.cantidad
      })

      // Encontrar el día más vendido
      const diaMasVendido = Object.entries(ventasPorDia).reduce((a, b) => (a[1] > b[1] ? a : b), ["", 0])

      // Encontrar el método de pago más usado
      const metodoPagoMasUsado = Object.entries(ventasPorMetodo).reduce((a, b) => (a[1] > b[1] ? a : b), ["", 0])

      // Calcular estadísticas
      const totalVentas = ventas.length
      const totalUnidades = ventas.reduce((sum, v) => sum + v.cantidad, 0)
      const totalIngresos = ventas.reduce((sum, v) => sum + v.subtotal, 0)
      const promedioUnidadesPorVenta = totalVentas > 0 ? (totalUnidades / totalVentas).toFixed(1) : 0
      const ingresoPromedioPorVenta = totalVentas > 0 ? (totalIngresos / totalVentas).toFixed(2) : 0

      // Generar contenido del popup
      contenidoDetalles.innerHTML = `
        <div class="analisis-detallado">
          <div class="producto-header">
            <h4>📦 ${producto.nombre}</h4>
            <p><strong>Código:</strong> ${producto.codigo} | <strong>Categoría:</strong> ${producto.categoria} | <strong>Marca:</strong> ${producto.marca}</p>
          </div>

          <div class="estadisticas-generales">
            <h5>📊 Estadísticas Generales</h5>
            <div class="stats-grid">
              <div class="stat-item">
                <span class="stat-value">${totalVentas}</span>
                <span class="stat-label">Transacciones</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">${totalUnidades}</span>
                <span class="stat-label">Unidades Vendidas</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">$${totalIngresos.toFixed(2)}</span>
                <span class="stat-label">Ingresos Totales</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">${promedioUnidadesPorVenta}</span>
                <span class="stat-label">Promedio por Venta</span>
              </div>
            </div>
          </div>

          <div class="analisis-patrones">
            <h5>🔍 Análisis de Patrones</h5>
            <div class="patron-item">
              <strong>📅 Día más vendido:</strong> ${diaMasVendido[0]} (${diaMasVendido[1]} unidades)
            </div>
            <div class="patron-item">
              <strong>💳 Método de pago preferido:</strong> ${obtenerNombreMetodoPago(metodoPagoMasUsado[0])} (${metodoPagoMasUsado[1]} unidades)
            </div>
            <div class="patron-item">
              <strong>💰 Ingreso promedio por transacción:</strong> $${ingresoPromedioPorVenta}
            </div>
          </div>

          <div class="ventas-por-dia">
            <h5>📈 Distribución por Día de la Semana</h5>
            <div class="dias-chart">
              ${Object.entries(ventasPorDia)
                .map(
                  ([dia, cantidad]) => `
                <div class="dia-bar">
                  <div class="dia-nombre">${dia.substring(0, 3)}</div>
                  <div class="dia-cantidad">${cantidad}</div>
                  <div class="dia-barra" style="height: ${(cantidad / Math.max(...Object.values(ventasPorDia))) * 100}%"></div>
                </div>
              `,
                )
                .join("")}
            </div>
          </div>

          <div class="ventas-recientes">
            <h5>🕒 Últimas 10 Ventas</h5>
            <div class="ventas-lista">
              ${ventas
                .slice(0, 10)
                .map(
                  (venta) => `
                <div class="venta-item-detalle">
                  <div class="venta-fecha">${new Date(venta.fecha_venta).toLocaleDateString("es-ES")}</div>
                  <div class="venta-cliente">${venta.cliente_nombre}</div>
                  <div class="venta-cantidad">${venta.cantidad} unidades</div>
                  <div class="venta-total">$${venta.subtotal.toFixed(2)}</div>
                </div>
              `,
                )
                .join("")}
            </div>
          </div>
        </div>
      `

      popup.classList.remove("oculto")
    })
  })
}

// Función auxiliar para nombres de métodos de pago
function obtenerNombreMetodoPago(metodo) {
  const metodos = {
    efectivo: "Efectivo",
    tarjeta: "Tarjeta",
    pago_movil: "Pago Móvil",
    transferencia: "Transferencia",
  }
  return metodos[metodo] || metodo
}

// Event listener para exportar PDF
btnExportarPDF.addEventListener("click", () => {
  if (!datosActuales || datosActuales.length === 0) {
    alert("No hay datos para exportar")
    return
  }

  exportarEstadisticasPDF()
})

// Función para exportar estadísticas a PDF
function exportarEstadisticasPDF() {
  const fechaExportacion = new Date().toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const totalProductos = datosActuales.length
  const totalUnidadesVendidas = datosActuales.reduce((sum, p) => sum + p.total_vendido, 0)
  const totalIngresos = datosActuales.reduce((sum, p) => sum + p.total_ingresos, 0)
  const totalVentas = datosActuales.reduce((sum, p) => sum + p.total_ventas, 0)

  let contenidoHTML = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Estadísticas de Ventas - SIMETRIC GYM</title>
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
        .resumen-exportacion {
          background-color: #f9f9f9;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 30px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }
        .resumen-item-pdf {
          text-align: center;
          padding: 15px;
          background: white;
          border-radius: 5px;
          border-left: 4px solid #880808;
        }
        .resumen-valor-pdf {
          font-size: 24px;
          font-weight: bold;
          color: #880808;
        }
        .resumen-label-pdf {
          font-size: 12px;
          color: #666;
          margin-top: 5px;
        }
        .productos-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        .productos-table th,
        .productos-table td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
          font-size: 12px;
        }
        .productos-table th {
          background-color: #880808;
          color: white;
          font-weight: bold;
        }
        .productos-table tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .ranking-medal {
          font-size: 16px;
          text-align: center;
        }
        .footer {
          text-align: center;
          border-top: 1px solid #ddd;
          padding-top: 20px;
          color: #666;
          font-size: 12px;
          margin-top: 30px;
        }
        @media print {
          body { margin: 0; }
          .header { page-break-after: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">🏋️ SIMETRIC GYM C.A.</div>
        <div class="subtitle">Estadísticas de Productos Más Vendidos</div>
      </div>

      <div style="margin-bottom: 20px;">
        <h3>📊 Período Analizado: ${filtroActual}</h3>
        <p><strong>Fecha de exportación:</strong> ${fechaExportacion}</p>
      </div>

      <div class="resumen-exportacion">
        <div class="resumen-item-pdf">
          <div class="resumen-valor-pdf">${totalProductos}</div>
          <div class="resumen-label-pdf">Productos Vendidos</div>
        </div>
        <div class="resumen-item-pdf">
          <div class="resumen-valor-pdf">${totalUnidadesVendidas}</div>
          <div class="resumen-label-pdf">Unidades Vendidas</div>
        </div>
        <div class="resumen-item-pdf">
          <div class="resumen-valor-pdf">$${totalIngresos.toFixed(2)}</div>
          <div class="resumen-label-pdf">Ingresos Totales</div>
        </div>
        <div class="resumen-item-pdf">
          <div class="resumen-valor-pdf">${totalVentas}</div>
          <div class="resumen-label-pdf">Transacciones</div>
        </div>
      </div>

      <table class="productos-table">
        <thead>
          <tr>
            <th>Ranking</th>
            <th>Producto</th>
            <th>Código</th>
            <th>Categoría</th>
            <th>Marca</th>
            <th>Unidades Vendidas</th>
            <th>Ingresos ($)</th>
            <th>Transacciones</th>
            <th>Promedio por Venta</th>
          </tr>
        </thead>
        <tbody>
  `

  datosActuales.forEach((producto, index) => {
    const ranking = index + 1
    const medallaIcon = ranking === 1 ? "🥇" : ranking === 2 ? "🥈" : ranking === 3 ? "🥉" : ranking

    contenidoHTML += `
      <tr>
        <td class="ranking-medal">${medallaIcon}</td>
        <td>${producto.nombre}</td>
        <td>${producto.codigo}</td>
        <td>${producto.categoria}</td>
        <td>${producto.marca}</td>
        <td>${producto.total_vendido}</td>
        <td>$${producto.total_ingresos.toFixed(2)}</td>
        <td>${producto.total_ventas}</td>
        <td>${producto.promedio_por_venta.toFixed(1)}</td>
      </tr>
    `
  })

  contenidoHTML += `
        </tbody>
      </table>

      <div class="footer">
        <p>Reporte generado por SIMETRIC GYM - Sistema de Gestión de Ventas</p>
        <p>Fecha de generación: ${new Date().toLocaleDateString("es-ES")} a las ${new Date().toLocaleTimeString("es-ES")}</p>
      </div>
    </body>
    </html>
  `

  // Abrir ventana para imprimir/guardar como PDF
  const ventanaEstadisticas = window.open("", "", "width=800,height=600")
  ventanaEstadisticas.document.write(contenidoHTML)
  

  // Dar tiempo para que se cargue el contenido y luego mostrar diálogo de impresión
  setTimeout(() => {
    ventanaEstadisticas.print()

    // Mostrar alerta después de iniciar la impresión
    setTimeout(() => {
      
    }, 500)
  }, 500)
}

// Cerrar popup
cerrarPopup.addEventListener("click", () => {
  popup.classList.add("oculto")
  contenidoDetalles.innerHTML = ""
})

// Cerrar popup al hacer clic fuera
popup.addEventListener("click", (e) => {
  if (e.target === popup) {
    popup.classList.add("oculto")
    contenidoDetalles.innerHTML = ""
  }
})

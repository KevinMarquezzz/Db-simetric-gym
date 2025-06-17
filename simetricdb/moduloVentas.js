const sqlite3 = require('sqlite3').verbose();
let db = new sqlite3.Database('inventario.sqlite', (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log('Conectado a la base de datos para mostrar inventario.');
    cargarProductosVenta();
  }
});
// Crear la tabla de ventas si no existe
db.run(`
    CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER,
      cantidad INTEGER,
      total_venta REAL,
      tasa_cambio REAL,
      fecha TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(producto_id) REFERENCES productos(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error al crear la tabla ventas:', err.message);
    } else {
      console.log('Tabla ventas verificada o creada correctamente.');
    }
  });

let productos = [];
let carrito = [];
let productoSeleccionado = null;


function cargarProductosVenta() {
  db.all('SELECT * FROM productos', [], (err, rows) => {
    if (err) {
      console.error(err.message);
      return;
    }
    productos = rows;
    renderizarProductosVenta(rows);
  });
}

function renderizarProductosVenta(productos) {
  const container = document.getElementById('lista-productos');
  container.innerHTML = '';

  if (productos.length === 0) {
    container.innerHTML = '<p>No hay productos disponibles.</p>';
    return;
  }

  const header = document.createElement('div');
  header.classList.add('table-header');
  header.innerHTML = `<div>Código</div><div>Nombre</div><div>Stock</div><div>Precio</div><div>Acción</div>`;
  container.appendChild(header);

  productos.forEach((p) => {
    // Buscar si el producto está en el carrito y ajustar stock visualmente
    const enCarrito = carrito.find(item => item.id === p.id);
    const stockVisible = enCarrito ? p.stock - enCarrito.cantidad : p.stock;

    const row = document.createElement('div');
    row.classList.add('table-row');
    row.innerHTML = `
      <div>${p.codigo}</div>
      <div>${p.nombre}</div>
      <div>${stockVisible}</div>
      <div>${p.precio_venta} $</div>
      <div><button class="btn-agregar-carrito" data-id="${p.id}" ${stockVisible <= 0 ? 'disabled' : ''}>Agregar</button></div>
    `;
    container.appendChild(row);
  });
}
// Actualizar automáticamente el total en bolívares cuando cambia la tasa
document.getElementById('tasa-cambio').addEventListener('input', actualizarTotalBs);
function actualizarTotalBs() {
  let totalUSD = 0;
  carrito.forEach((item) => {
    totalUSD += item.precio_venta * item.cantidad;
  });

  const tasa = parseFloat(document.getElementById('tasa-cambio').value) || 0;
  const totalBs = (totalUSD * tasa).toFixed(2);

  document.getElementById('venta-total').textContent =
    `Total: ${totalUSD.toFixed(2)} USD | ${totalBs} Bs`;
}


function renderizarCarrito() {
  const contenedor = document.getElementById('venta-carrito-container');
  contenedor.innerHTML = '';

  carrito.forEach((item) => {
    const subtotal = item.precio_venta * item.cantidad;

    const div = document.createElement('div');
    div.textContent = `${item.nombre} x${item.cantidad} - ${subtotal.toFixed(2)} USD`;
    contenedor.appendChild(div);
  });

  actualizarTotalBs(); // ← Llama a la función reutilizable
}

window.addEventListener('DOMContentLoaded', () => {
  console.log('Script de ventas cargado correctamente');
  cargarProductosVenta();

  // Evento para botón de agregar al carrito (delegado)
  document.addEventListener('click', (event) => {
    if (event.target.classList.contains('btn-agregar-carrito')) {
      const id = parseInt(event.target.dataset.id);
      const producto = productos.find(p => p.id === id);
      if (producto) {
        productoSeleccionado = producto;
        document.getElementById('cantidad-input').value = 1;
        document.getElementById('cantidad-modal').classList.remove('hidden');
      }
    }
  });
  document.getElementById('btn-cancelar-cantidad').addEventListener('click', () => {
    document.getElementById('cantidad-modal').classList.add('hidden');
    productoSeleccionado = null;
  });
  
  document.getElementById('btn-confirmar-cantidad').addEventListener('click', () => {
    const cantidad = parseInt(document.getElementById('cantidad-input').value);
  
    if (
      productoSeleccionado &&
      !isNaN(cantidad) &&
      cantidad > 0 &&
      cantidad <= productoSeleccionado.stock
    ) {
      carrito.push({ ...productoSeleccionado, cantidad });
      renderizarCarrito();
      document.getElementById('cantidad-modal').classList.add('hidden');
      productoSeleccionado = null;
    } else {
      alert("Cantidad inválida o mayor al stock disponible.");
    }
    renderizarProductosVenta(productos);
  });
  
  // Evento para confirmar venta
  const botonConfirmar = document.querySelector('.btn-confirmar-venta');
  if (botonConfirmar) {
    botonConfirmar.addEventListener('click', () => {
      if (carrito.length === 0) {
        alert('El carrito está vacío.');
        return;
      }

      db.serialize(() => {
        const stmt = db.prepare(`INSERT INTO ventas (producto_id, cantidad, total_venta, tasa_cambio) VALUES (?, ?, ?, ?)`);

        const tasaInput = document.getElementById('tasa-cambio').value.trim();
        const tasa = parseFloat(tasaInput);
        
        if (!tasaInput || isNaN(tasa) || tasa <= 0) {
          alert('Debe ingresar una tasa de cambio válida para confirmar la venta.');
          return;
        }
        carrito.forEach(item => {
          const total = item.precio_venta * item.cantidad;

          stmt.run([item.id, item.cantidad, total, tasa], (err) => {
            if (err) console.error('Error al registrar venta:', err.message);
          });

          // Actualizar el stock
          db.run(`UPDATE productos SET stock = stock - ? WHERE id = ?`, [item.cantidad, item.id], (err) => {
            if (err) console.error('Error al actualizar stock:', err.message);
          });
        });

        stmt.finalize(() => {
          alert('Venta registrada exitosamente.');
          let totalVenta = 0;
          carrito.forEach(item => {
            totalVenta += item.precio_venta * item.cantidad;
          });
        
         
        
          carrito = [];
          renderizarCarrito();
        });
        cargarProductosVenta();
      });
    });
  }
});
let historialVisible = false;

document.getElementById('btn-historial').addEventListener('click', () => {
  const contenedor = document.getElementById('historial-ventas');
  const boton = document.getElementById('btn-historial');
  const btnLimpiar = document.getElementById('btn-limpiar-historial');
  const botonExportar = document.getElementById('btn-exportar-pdf');

  if (!historialVisible) {
    db.all(`
      SELECT ventas.id, productos.nombre, ventas.cantidad, ventas.total_venta, ventas.fecha, ventas.tasa_cambio
      FROM ventas
      JOIN productos ON ventas.producto_id = productos.id
      ORDER BY ventas.fecha DESC
    `, [], (err, rows) => {
      if (err) {
        console.error('Error al cargar historial de ventas:', err.message);
        return;
      }
  
      contenedor.classList.remove('hidden');
      botonExportar.classList.remove('hidden');
      btnLimpiar.classList.remove('hidden');
      contenedor.innerHTML = '<h3>Historial de Ventas</h3>';
  
      if (rows.length === 0) {
        contenedor.innerHTML += '<p>No hay ventas registradas.</p>';
      } else {
        const ventasPorMes = {};
  
        // Agrupar por mes-año
        rows.forEach(row => {
          const fecha = new Date(row.fecha);
          const year = fecha.getFullYear();
          const month = fecha.toLocaleString('default', { month: 'long' }).toUpperCase(); // EJ: "JUNIO"
          const key = `${month} ${year}`;
  
          if (!ventasPorMes[key]) ventasPorMes[key] = [];
          ventasPorMes[key].push(row);
        });
  
        // Mostrar ventas agrupadas
        for (const [mes, ventas] of Object.entries(ventasPorMes)) {
          contenedor.innerHTML += `<h4 class="mes-header">🗓️ ${mes.charAt(0).toUpperCase() + mes.slice(1)}</h4><hr>`;
          
          ventas.forEach(row => {
            const fecha = new Date(row.fecha);
            contenedor.innerHTML += `
              <div class="venta-item">
                <p><strong>💼 Producto:</strong> ${row.nombre}</p>
                <p><strong>📦 Cantidad:</strong> ${row.cantidad}</p>
                <p><strong>💲 Total:</strong> ${row.total_venta.toFixed(2)} Bs</p>
                 <p><strong>💱 Tasa:</strong> ${row.tasa_cambio.toFixed(2) || 'N/A'} Bs/USD</p>
                <p><strong>📅 Fecha:</strong> ${fecha.toLocaleDateString()} ${fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                <hr>
              </div>
            `;
          });
        }
      }
  
      boton.textContent = 'Ocultar Historial de Ventas';
      historialVisible = true;
    });

  } else {
    // Ocultar historial y botón exportar
    contenedor.classList.add('hidden');
    contenedor.innerHTML = '';
    btnLimpiar.classList.add('hidden');
    botonExportar.classList.add('hidden');
    boton.textContent = 'Ver Historial de Ventas';
    historialVisible = false;
  }
  btnLimpiar.addEventListener('click', () => {
    const confirmacion = confirm('¿Estás seguro de que deseas eliminar TODO el historial de ventas? Esta acción no se puede deshacer.');
  
    if (confirmacion) {
      db.run('DELETE FROM ventas', [], (err) => {
        if (err) {
          console.error('Error al eliminar historial:', err.message);
          alert('Hubo un error al intentar limpiar el historial.');
          return;
        }
  
        alert('Historial de ventas eliminado correctamente.');
      });
    }
  });
});


document.getElementById('btn-exportar-pdf').addEventListener('click', () => {
  const contenido = document.getElementById('historial-ventas').innerHTML;

  const ventana = window.open('', '', 'width=800,height=600');
  ventana.document.write(`
    <html>
      <head>
        <title>Historial de Ventas</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .venta-item { margin-bottom: 10px; }
          hr { border: 0; border-top: 1px solid #ccc; }
        </style>
      </head>
      <body>
        <h2>Historial de Ventas</h2>
        ${contenido}
      </body>
    </html>
  `);
  ventana.document.close();
  ventana.print();
});
// Filtro por código y nombre
document.getElementById('search-code').addEventListener('input', filtrarProductos);
document.getElementById('search-name').addEventListener('input', filtrarProductos);

function filtrarProductos() {
  const codigoFiltro = document.getElementById('search-code').value.toLowerCase().trim();
  const nombreFiltro = document.getElementById('search-name').value.toLowerCase().trim();

  const productosFiltrados = productos.filter(p => {
    const codigoCoincide = p.codigo.toLowerCase().includes(codigoFiltro);
    const nombreCoincide = p.nombre.toLowerCase().includes(nombreFiltro);
    return codigoCoincide && nombreCoincide;
  });

  renderizarProductosVenta(productosFiltrados);
}
document.getElementById('search-code').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '');
});
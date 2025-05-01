const sqlite3 = require('sqlite3').verbose();

// Conectar a la base de datos
let db = new sqlite3.Database('simetricdb.sqlite', (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log('Conectado a la base de datos para mostrar clientes.');
    mostrarClientes();
  }
});
let clienteIdSeleccionado = null;

// Función para mostrar los clientes
function mostrarClientes() {
  const container = document.getElementById('client-container');
  container.innerHTML = ''; // Limpiar contenido previo

  db.all('SELECT * FROM clientes', [], (err, rows) => {
    if (err) {
      console.error(err.message);
      return;
    }

    if (rows.length === 0) {
      container.innerHTML = '<p>No hay clientes registrados.</p>';
      return;
    }

    // Crear encabezado
    const header = document.createElement('div');
    header.classList.add('table-header');
    header.innerHTML = `
      <div>Nombre</div>
      <div>Cédula</div>
      <div>Teléfono</div>
      <div>Fecha de Registro</div>
      <div>Fecha de Vencimiento</div>
      <div>Estado</div>
    `;
    container.appendChild(header);

    // Crear filas de clientes
    rows.forEach((cliente) => {
      const row = document.createElement('div');
      row.classList.add('table-row');

      // Determinar si está vigente o vencido
      const hoy = new Date();
      const fechaVencimiento = new Date(cliente.fecha_vencimiento);
      const estadoClase = fechaVencimiento >= hoy ? 'vigente' : 'vencido';

      row.innerHTML = `
        <div>${cliente.nombre}</div>
        <div>${cliente.cedula}</div>
        <div>${cliente.telefono}</div>
        <div>${cliente.fecha_registro}</div>
        <div>${cliente.fecha_vencimiento}</div>
        <div><div class="status-box ${estadoClase}"></div></div>
        <div><button class="ver-detalles" data-id="${cliente.id}">Detalles</button></div>
      `;

      container.appendChild(row);
    });
  });
}
// Delegamos evento después de renderizar los botones
document.addEventListener('click', function (event) {
  if (event.target.classList.contains('ver-detalles')) {
    const id = event.target.dataset.id;
    clienteIdSeleccionado = id;

    db.get('SELECT * FROM clientes WHERE id = ?', [id], (err, cliente) => {
      if (err) {
        console.error('Error al obtener detalles:', err.message);
        return;
      }

      if (cliente) {
        document.getElementById('detalle-nombre').value = cliente.nombre;
        document.getElementById('detalle-cedula').value = cliente.cedula;
        document.getElementById('detalle-telefono').value = cliente.telefono;
        document.getElementById('detalle-direccion').value = cliente.direccion;
        document.getElementById('detalle-membresia').value = cliente.membresia;
        document.getElementById('detalle-registro').value = cliente.fechaRegistro;
        document.getElementById('detalle-vencimiento').textContent = cliente.fechaVencimiento;

        document.getElementById('popup-detalles').classList.remove('oculto');
      }
    });
  }
});

// Cerrar popup
document.getElementById('cerrar-popup').addEventListener('click', () => {
  document.getElementById('popup-detalles').classList.add('oculto');
});
document.getElementById('form-editar-cliente').addEventListener('submit', function (e) {
  e.preventDefault();

  const nombre = document.getElementById('detalle-nombre').value.trim();
  const cedula = document.getElementById('detalle-cedula').value.trim();
  const telefono = document.getElementById('detalle-telefono').value.trim();
  const direccion = document.getElementById('detalle-direccion').value.trim();
  const membresia = document.getElementById('detalle-membresia').value;
  const fechaRegistro =document.getElementById('detalle-registro').value;
  let fechaVencimiento = new Date(fechaRegistro);
  switch (membresia) {
    case 'semanal':
      fechaVencimiento.setDate(fechaVencimiento.getDate() + 7);
      break;
    case 'diario':
      fechaVencimiento.setDate(fechaVencimiento.getDate() + 1);
      break;
    case 'mensual':
    case 'familiar':
    case 'estudiantil':
    case 'especial':
    case 'parejas':
      fechaVencimiento.setMonth(fechaVencimiento.getMonth() + 1);
      fechaVencimiento.setDate(fechaVencimiento.getDate() + 1);
      break;
    default:
      console.warn('Tipo de membresía no reconocido. Se usará 1 mes por defecto.');
      fechaVencimiento.setMonth(fechaVencimiento.getMonth() + 1);
      fechaVencimiento.setDate(fechaVencimiento.getDate() + 1);
  }
  const fechaVencimientoFormateada = fechaVencimiento.toISOString().split('T')[0];
  db.run(
    `UPDATE clientes SET nombre = ?, cedula = ?, telefono = ?, direccion = ?, membresia = ?, fecha_registro = ?, fecha_vencimiento = ? WHERE id = ?`,
    [nombre, cedula, telefono, direccion, membresia, fechaRegistro, fechaVencimientoFormateada, clienteIdSeleccionado],
    function (err) { 
      if (err) {
        console.error(err.message);
        alert('Error al actualizar cliente.');
      } else {
        alert('Cliente actualizado exitosamente.');
        document.getElementById('popup-detalles').classList.add('oculto');
        mostrarClientes();
      }
    }
  );
});
document.getElementById('eliminar-cliente').addEventListener('click', function () {
  const confirmar = confirm('¿Estás seguro de que deseas eliminar este cliente?');

  if (confirmar) {
    db.run(`DELETE FROM clientes WHERE id = ?`, [clienteIdSeleccionado], function (err) {
      if (err) {
        console.error(err.message);
        alert('Error al eliminar cliente.');
      } else {
        alert('Cliente eliminado correctamente.');
        document.getElementById('popup-detalles').classList.add('oculto');
        mostrarClientes();
      }
    });
  }
});

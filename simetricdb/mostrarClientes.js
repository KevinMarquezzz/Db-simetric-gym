const sqlite3 = require('sqlite3').verbose();

// Conectar a la base de datos
let db = new sqlite3.Database('simetricdb.sqlite', (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log('Conectado a la base de datos para mostrar clientes.');
    cargarClientesDesdeDB();
  }
});

let clienteIdSeleccionado = null;
let clientesOriginales = [];

// Cargar todos los clientes una sola vez desde la base de datos
function cargarClientesDesdeDB() {
  db.all('SELECT * FROM clientes', [], (err, rows) => {
    if (err) {
      console.error(err.message);
      return;
    }
    clientesOriginales = rows;
    filtrarYMostrarClientes();
  });
}

// Función para aplicar los filtros y mostrar los clientes
function filtrarYMostrarClientes() {
  const nombreFiltro = document.getElementById('search-name').value.toLowerCase();
  const cedulaFiltro = document.getElementById('search-cedula').value.toLowerCase();
  const estadoFiltro = document.getElementById('filter-status').value;
  const hoy = new Date();

  const clientesFiltrados = clientesOriginales.filter(cliente => {
    const coincideNombre = cliente.nombre.toLowerCase().includes(nombreFiltro);
    const coincideCedula = cliente.cedula.toLowerCase().includes(cedulaFiltro);

    const fechaVencimiento = new Date(cliente.fecha_vencimiento);
    const estaVigente = fechaVencimiento >= hoy;

    const coincideEstado = estadoFiltro === 'todos' ||
      (estadoFiltro === 'vigentes' && estaVigente) ||
      (estadoFiltro === 'vencidos' && !estaVigente);

    return coincideNombre && coincideCedula && coincideEstado;
  });

  renderizarClientes(clientesFiltrados);
}

// Función para renderizar los clientes filtrados
function renderizarClientes(clientes) {
  const container = document.getElementById('client-container');
  container.innerHTML = '';

  if (clientes.length === 0) {
    container.innerHTML = '<p>No se encontraron clientes con esos filtros.</p>';
    return;
  }

  const header = document.createElement('div');
  header.classList.add('table-header');
  header.innerHTML = `
    <div>Nombre</div>
    <div>Cédula</div>
    <div>Teléfono</div>
    <div>Fecha de Registro</div>
    <div>Fecha de Vencimiento</div>
    <div>Estado</div>
    <div>Acciones</div>
  `;
  container.appendChild(header);

  const hoy = new Date();

  clientes.forEach((cliente) => {
    const row = document.createElement('div');
    row.classList.add('table-row');

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
}

// Evento: Ver detalles del cliente
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
        document.getElementById('detalle-registro').value = cliente.fecha_registro;
        document.getElementById('detalle-vencimiento').textContent = cliente.fecha_vencimiento;

        document.getElementById('popup-detalles').classList.remove('oculto');
      }
    });
  }
});

// Cerrar popup
document.getElementById('cerrar-popup').addEventListener('click', () => {
  document.getElementById('popup-detalles').classList.add('oculto');
});

// Evento: Guardar cambios del cliente
document.getElementById('form-editar-cliente').addEventListener('submit', function (e) {
  e.preventDefault();

  const nombre = document.getElementById('detalle-nombre').value.trim();
  const cedula = document.getElementById('detalle-cedula').value.trim();
  const telefono = document.getElementById('detalle-telefono').value.trim();
  const direccion = document.getElementById('detalle-direccion').value.trim();
  const membresia = document.getElementById('detalle-membresia').value;
  const fechaRegistro = document.getElementById('detalle-registro').value;

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
      break;
    default:
      console.warn('Tipo de membresía no reconocido. Se usará 1 mes por defecto.');
      fechaVencimiento.setMonth(fechaVencimiento.getMonth() + 1);
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
        cargarClientesDesdeDB();
      }
    }
  );
});

// Evento: Eliminar cliente
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
        cargarClientesDesdeDB();
      }
    });
  }
});

// Eventos de filtros
document.getElementById('search-name').addEventListener('input', filtrarYMostrarClientes);
document.getElementById('search-cedula').addEventListener('input', filtrarYMostrarClientes);
document.getElementById('filter-status').addEventListener('change', filtrarYMostrarClientes);

document.getElementById('detalle-cedula').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '');
});

document.getElementById('detalle-telefono').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '');
});

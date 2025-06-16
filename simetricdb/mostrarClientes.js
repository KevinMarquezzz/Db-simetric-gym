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
let modoEdicion = false;
let valoresOriginales = {};


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
      <div class="estado-clase">${estadoClase === 'vigente' ? 'Activo' : 'Vencido'}</div>
      <div class="form-btn">
      <button class="actualizar-membresia" data-id="${cliente.id}">Actualizar Membresía</button>
      <button class="ver-detalles" data-id="${cliente.id}">Ver más</button>
      </div>
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
        document.getElementById('detalle-mail').value = cliente.mail;
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
  const historialContenedor = document.getElementById('historial-pagos');
  historialContenedor.classList.add('hidden');
  historialContenedor.innerHTML = '';
  document.getElementById('btn-historial-pagos').textContent = 'Ver Historial de Pagos';
  historialPagosVisible = false;
  if (modoEdicion) {
    modoEdicion = false;
    document.getElementById('boton-editar-guardar').textContent = 'Editar';
    document.getElementById('eliminar-cliente').textContent = 'Eliminar';
    if (valoresOriginales) {
      document.getElementById('detalle-nombre').value = valoresOriginales.nombre || '';
      document.getElementById('detalle-cedula').value = valoresOriginales.cedula || '';
      document.getElementById('detalle-telefono').value = valoresOriginales.telefono || '';
      document.getElementById('detalle-direccion').value = valoresOriginales.direccion || '';
      document.getElementById('detalle-mail').value = valoresOriginales.mail || '';
    }
    document.getElementById('detalle-nombre').readOnly = true;
    document.getElementById('detalle-cedula').readOnly = true;
    document.getElementById('detalle-telefono').readOnly = true;
    document.getElementById('detalle-direccion').readOnly = true;
    document.getElementById('detalle-mail').readOnly = true;
  }
  clienteIdSeleccionado = null;
  valoresOriginales = {};
  document.getElementById('popup-detalles').classList.add('oculto');
});

let historialPagosVisible = false;

document.getElementById('btn-historial-pagos').addEventListener('click', () => {
  const contenedor = document.getElementById('historial-pagos');
  const boton = document.getElementById('btn-historial-pagos');

  if (!historialPagosVisible) {
    db.all(
      `SELECT * FROM pagos WHERE cliente_id = ? ORDER BY fecha_pago DESC`,
      [clienteIdSeleccionado],
      (err, pagos) => {
        if (err) {
          console.error('Error al cargar historial de pagos:', err.message);
          return;
        }

        contenedor.classList.remove('hidden');
        contenedor.innerHTML = '<h3>Historial de Pagos</h3>';

        if (pagos.length === 0) {
          contenedor.innerHTML += '<p>Este cliente no tiene pagos registrados.</p>';
        } else {
          const pagosPorMes = {};

          pagos.forEach(pago => {
            const fecha = new Date(pago.fecha_pago);
            const mesAnio = fecha.toLocaleString('default', { month: 'long', year: 'numeric' }); // Ej: "junio de 2025"
          
            if (!pagosPorMes[mesAnio]) {
              pagosPorMes[mesAnio] = [];
            }
            pagosPorMes[mesAnio].push(pago);
          });
          
          // Mostrar los pagos agrupados por mes
          for (const mes in pagosPorMes) {
            contenedor.innerHTML += `<h4 class="mes-header">🗓️ ${mes.charAt(0).toUpperCase() + mes.slice(1)}</h4>`;
          
            pagosPorMes[mes].forEach(pago => {
              contenedor.innerHTML += `
                <div class="pago-item">
                  <p><strong>📅 Fecha de pago:</strong> ${pago.fecha_pago}</p>
                  <p><strong>📝 Membresía:</strong> ${pago.membresia}</p>
                  <p><strong>💳 Método de pago:</strong> ${pago.metodo_pago}</p>
                  <p><strong>💵 Monto en dólares:</strong> ${pago.monto_dolares.toFixed(2)} $</p>
                  <p><strong>💱 Tasa del día:</strong> ${pago.tasa_dia.toFixed(2)}</p>
                  <p><strong>💰 Monto en bolívares:</strong> ${pago.monto_bs.toFixed(2)} Bs</p>
                  <hr>
                </div>
              `;
            });
          }
        }

        boton.textContent = 'Ocultar';
        historialPagosVisible = true;
      }
    );
  } else {
    contenedor.classList.add('hidden');
    contenedor.innerHTML = '';
    boton.textContent = 'Ver Historial de Pagos';
    historialPagosVisible = false;
  }
});



// Evento: Guardar cambios del cliente
document.getElementById('boton-editar-guardar').addEventListener('click', function () {
  const botonEditar = this;
  const botonEliminar = document.getElementById('eliminar-cliente');

  if (!modoEdicion) {
    // Entrar en modo edición
    modoEdicion = true;
    botonEditar.textContent = 'Guardar';
    botonEliminar.textContent = 'Cancelar';

    // Guardar valores originales
    valoresOriginales = {
      nombre: document.getElementById('detalle-nombre').value,
      cedula: document.getElementById('detalle-cedula').value,
      telefono: document.getElementById('detalle-telefono').value,
      direccion: document.getElementById('detalle-direccion').value,
      mail: document.getElementById('detalle-mail').value
    };

    // Activar edición
    document.getElementById('detalle-nombre').readOnly = false;
    document.getElementById('detalle-cedula').readOnly = false;
    document.getElementById('detalle-telefono').readOnly = false;
    document.getElementById('detalle-direccion').readOnly = false;
    document.getElementById('detalle-mail').readOnly = false;

  } else {
    // Guardar los cambios
    const nombre = document.getElementById('detalle-nombre').value.trim();
    const cedula = document.getElementById('detalle-cedula').value.trim();
    const telefono = document.getElementById('detalle-telefono').value.trim();
    const direccion = document.getElementById('detalle-direccion').value.trim();
    const mail = document.getElementById('detalle-mail').value.trim();
    const membresia = document.getElementById('detalle-membresia').value;
    const fechaRegistro = document.getElementById('detalle-registro').value;
    const fechaVencimiento = document.getElementById('detalle-vencimiento').textContent;

    db.run(
      `UPDATE clientes SET nombre = ?, cedula = ?, telefono = ?, direccion = ?, mail = ?, membresia = ?, fecha_registro = ?, fecha_vencimiento = ? WHERE id = ?`,
      [nombre, cedula, telefono, direccion, mail, membresia, fechaRegistro, fechaVencimiento, clienteIdSeleccionado],
      function (err) {
        if (err) {
          console.error(err.message);
          alert('Error al actualizar cliente.');
        } else {
          alert('Cliente actualizado exitosamente.');

          // Salir del modo edición
          modoEdicion = false;
          botonEditar.textContent = 'Editar';
          botonEliminar.textContent = 'Eliminar';

          document.getElementById('detalle-nombre').readOnly = true;
          document.getElementById('detalle-cedula').readOnly = true;
          document.getElementById('detalle-telefono').readOnly = true;
          document.getElementById('detalle-direccion').readOnly = true;
          document.getElementById('detalle-mail').readOnly = true;

          document.getElementById('popup-detalles').classList.add('oculto');
          cargarClientesDesdeDB();
        }
      }
    );
  }
});



// Evento: Eliminar cliente
document.getElementById('eliminar-cliente').addEventListener('click', function () {
  const botonEditar = document.getElementById('boton-editar-guardar');
  const botonEliminar = this;

  if (modoEdicion) {
    // Cancelar edición
    modoEdicion = false;
    botonEditar.textContent = 'Editar';
    botonEliminar.textContent = 'Eliminar';

    // Restaurar valores originales
    document.getElementById('detalle-nombre').value = valoresOriginales.nombre;
    document.getElementById('detalle-cedula').value = valoresOriginales.cedula;
    document.getElementById('detalle-telefono').value = valoresOriginales.telefono;
    document.getElementById('detalle-direccion').value = valoresOriginales.direccion;
    document.getElementById('detalle-mail').value = valoresOriginales.mail;

    // Desactivar edición
    document.getElementById('detalle-nombre').readOnly = true;
    document.getElementById('detalle-cedula').readOnly = true;
    document.getElementById('detalle-telefono').readOnly = true;
    document.getElementById('detalle-direccion').readOnly = true;
    document.getElementById('detalle-mail').readOnly = true;

  } else {
    // Confirmar eliminación
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
  }
});

document.getElementById('monto_dolares').addEventListener('input', calcularMontoBs);
document.getElementById('tasa_dia').addEventListener('input', calcularMontoBs);

function calcularMontoBs() {
  const usd = parseFloat(document.getElementById('monto_dolares').value) || 0;
  const tasa = parseFloat(document.getElementById('tasa_dia').value) || 0;
  const montoBs = usd * tasa;
  document.getElementById('monto_bs').value = montoBs.toFixed(2);
}

// Evento: Abrir popup de actualizar membresía
document.addEventListener('click', function (event) {
  if (event.target.classList.contains('actualizar-membresia')) {
    clienteIdSeleccionado = event.target.dataset.id;
    document.getElementById('popup-actualizar').classList.remove('oculto');
  }
});

// Cerrar popup de actualizar membresía
document.getElementById('cerrar-popup-actualizar').addEventListener('click', () => {
  document.getElementById('popup-actualizar').classList.add('oculto');
});

// Evento: Enviar formulario para actualizar membresía
document.getElementById('form-actualizar-membresia').addEventListener('submit', function (e) {
  e.preventDefault();

  const nuevaMembresia = document.getElementById('nueva_membresia').value;
  const montoDolares = parseFloat(document.getElementById('monto_dolares').value) || 0;
  const tasaDia = parseFloat(document.getElementById('tasa_dia').value) || 0;
  const montoBs = parseFloat(document.getElementById('monto_bs').value) || 0;
  const metodoPago = document.getElementById('metodo_pago').value;

  const fechaHoy = new Date();
  let nuevaFechaVencimiento = new Date(fechaHoy);

  switch (nuevaMembresia) {
    case 'semanal':
      nuevaFechaVencimiento.setDate(nuevaFechaVencimiento.getDate() + 7);
      break;
    case 'diario':
      nuevaFechaVencimiento.setDate(nuevaFechaVencimiento.getDate() + 1);
      break;
    default:
      nuevaFechaVencimiento.setMonth(nuevaFechaVencimiento.getMonth() + 1);
  }

  const fechaRegistro = fechaHoy.toISOString().split('T')[0];
  const fechaVencimiento = nuevaFechaVencimiento.toISOString().split('T')[0];
  db.serialize(() => {
    // Actualizar el cliente
    db.run(`
      UPDATE clientes
      SET membresia = ?, fecha_registro = ?, fecha_vencimiento = ?, monto_dolares = ?, tasa_dia = ?, monto_bs = ?, metodo_pago = ?
      WHERE id = ?
    `,
      [nuevaMembresia, fechaRegistro, fechaVencimiento, montoDolares, tasaDia, montoBs, metodoPago, clienteIdSeleccionado],
      function (err) {
        if (err) {
          console.error(err.message);
          alert('❌ Error al actualizar la membresía y datos de pago.');
          return;
        }
  
        // Registrar el pago en la tabla pagos
        db.run(`
          INSERT INTO pagos (cliente_id, fecha_pago, membresia, metodo_pago, monto_dolares, tasa_dia, monto_bs)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
          [clienteIdSeleccionado, fechaRegistro, nuevaMembresia, metodoPago, montoDolares, tasaDia, montoBs],
          function (err) {
            if (err) {
              console.error(err.message);
              alert('❌ Error al registrar el pago.');
            } else {
              alert('✅ Membresía y pago actualizados exitosamente.');
              document.getElementById('popup-actualizar').classList.add('oculto');
              cargarClientesDesdeDB();
            }
          }
        );
      }
    );
  });
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

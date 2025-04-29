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
      `;

      container.appendChild(row);
    });
  });
}

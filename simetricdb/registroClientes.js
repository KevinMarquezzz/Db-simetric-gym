const sqlite3 = require('sqlite3').verbose();

// Conectamos a la base de datos o la creamos si no existe
let db = new sqlite3.Database('simetricdb.sqlite', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Conectado a la base de datos.');
});

// Crear tabla si no existe
db.run(`CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT,
  cedula TEXT UNIQUE,
  membresia TEXT,
  telefono TEXT,
  direccion TEXT,
  fecha_registro TEXT,
  fecha_vencimiento TEXT
)`);

// Escuchamos el evento cuando el formulario se envía
document.querySelector('form').addEventListener('submit', (event) => {
  event.preventDefault(); // Evitamos que recargue la página

  const nombre = document.getElementById('nombre').value.trim();
  const cedula = document.getElementById('cedula').value.trim();
  const membresia = document.getElementById('membresia').value;
  const telefono = document.getElementById('telefono').value.trim();
  const direccion = document.getElementById('direccion').value.trim();
  const fechaRegistro = document.getElementById('fecha').value;

  // Calculamos fecha de vencimiento: sumando un mes a la fecha de registro
  const fechaVencimiento = calcularFechaVencimiento(fechaRegistro, membresia);


  // Validar campos vacíos (opcionalmente más validaciones aquí)

  // Insertar cliente
  setTimeout(() => {
    db.run(`INSERT INTO clientes (nombre, cedula, membresia, telefono, direccion, fecha_registro, fecha_vencimiento)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nombre, cedula, membresia, telefono, direccion, fechaRegistro, fechaVencimiento],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            alert('Error: ya existe un cliente con esa cédula.');
          } else {
            console.error(err.message);
            alert('Error al registrar cliente.');
          }
        } else {
          alert('Cliente registrado exitosamente.');
          event.target.reset();
        }
      });
  }, 100); // 100 milisegundos de respiro
});

// Función para sumar un mes
function calcularFechaVencimiento(fecha, tipoMembresia) {
  const fechaObj = new Date(fecha);

  switch (tipoMembresia.toLowerCase()) {
    case 'diario':
      fechaObj.setDate(fechaObj.getDate() + 2);
      break;
    case 'semanal':
      fechaObj.setDate(fechaObj.getDate() + 8);
      break;
    case 'mensual':
    case 'familiar':
    case 'estudiantil':
    case 'especial':
    case 'parejas':
      fechaObj.setMonth(fechaObj.getMonth() + 1);
      fechaObj.setDate(fechaObj.getDate() + 2);
      break;
    default:
      console.warn('Tipo de membresía no reconocido. Se usará 1 mes por defecto.');
      fechaObj.setMonth(fechaObj.getMonth() + 1);
      fechaObj.setDate(fechaObj.getDate() + 2);
  }

  const year = fechaObj.getFullYear();
  const month = (fechaObj.getMonth() + 1).toString().padStart(2, '0');
  const day = fechaObj.getDate().toString().padStart(2, '0');

  return `${year}-${month}-${day}`;
}


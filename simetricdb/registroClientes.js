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
  telefono TEXT UNIQUE,
  direccion TEXT,
  mail TEXT,
  fecha_registro TEXT,
  fecha_vencimiento TEXT,
  monto_dolares REAL,
  tasa_dia REAL,
  monto_bs REAL,
  metodo_pago TEXT,
  referencia TEXT
)`);
// Crear tabla de pagos (historial) si no existe
db.run(`CREATE TABLE IF NOT EXISTS pagos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER,
  fecha_pago TEXT,
  monto_dolares REAL,
  tasa_dia REAL,
  monto_bs REAL,
  metodo_pago TEXT,
  membresia TEXT,
  referencia TEXT,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id)
)`);

document.getElementById('tasa_dia').addEventListener('input', calcularBs);
document.getElementById('monto_dolares').addEventListener('input', calcularBs);


function calcularBs() {
  const tasa = parseFloat(document.getElementById('tasa_dia').value) || 0;
  const monto = parseFloat(document.getElementById('monto_dolares').value) || 0;
  const bs = (monto * tasa).toFixed(2);
  document.getElementById('monto_bs').value = bs;
}
document.getElementById('membresia').addEventListener('change', function () {
  const tipo = this.value;
  const montoInput = document.getElementById('monto_dolares');

  const precios = {
    'mensual': 40,
    'diario': 4,
    'semanal': 12,
    'especial': 30,
    'parejas': 65,
    'familiar': 90,
    'estudiantil': 70
  };

  // Buscar el precio asociado al tipo de membresía
  const precio = precios[tipo.toLowerCase()] ?? 0;

  montoInput.value = precio.toFixed(2);

  // Dispara el cálculo automático de bolívares
  calcularBs();
});

// Escuchamos el evento cuando el formulario se envía
document.querySelector('form').addEventListener('submit', (event) => {
  event.preventDefault(); // Evitamos que recargue la página

  const nombre = document.getElementById('nombre').value.trim();
  const cedula = document.getElementById('cedula').value.trim();
  const membresia = document.getElementById('membresia').value;
  const telefono = document.getElementById('telefono').value.trim();
  const direccion = document.getElementById('direccion').value.trim();
  const mail = document.getElementById('mail').value.trim();
  const monto_dolares = parseFloat(document.getElementById('monto_dolares').value);
  const tasa_dia = parseFloat(document.getElementById('tasa_dia').value);
  const monto_bs = parseFloat(document.getElementById('monto_bs').value);
  const metodo_pago = document.getElementById('metodo_pago').value;
  const referencia = document.getElementById('referencia').value.trim();

// Validar si se necesita la referencia
if ((metodo_pago === 'transferencia' || metodo_pago === 'pago_movil') && referencia === '') {
  document.getElementById('referencia').style.border = '2px solid red';
  alert('Debe ingresar el número de referencia para el método de pago seleccionado.');
  return;
} else {
  document.getElementById('referencia').style.border = ''; // Quitar rojo si es válido
}


const hoy = new Date();
const year = hoy.getFullYear();
const month = (hoy.getMonth() + 1).toString().padStart(2, '0');
const day = hoy.getDate().toString().padStart(2, '0');
const fechaRegistro = `${year}-${month}-${day}`;

  // Calculamos fecha de vencimiento: sumando un mes a la fecha de registro
  const fechaVencimiento = calcularFechaVencimiento(fechaRegistro, membresia);


  // Validar campos vacíos (opcionalmente más validaciones aquí)

 // Insertar cliente
setTimeout(() => {
  db.run(`INSERT INTO clientes (nombre, cedula, membresia, telefono, direccion, mail, fecha_registro, fecha_vencimiento, monto_dolares, tasa_dia, monto_bs, metodo_pago, referencia)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)`,
    [nombre, cedula, membresia, telefono, direccion, mail, fechaRegistro, fechaVencimiento, monto_dolares, tasa_dia, monto_bs, metodo_pago, referencia],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          alert('Error: ya existe un cliente con esa cédula o teléfono.');
        } else {
          console.error(err.message);
          alert('Error al registrar cliente.');
        }
      } else {
        const clienteID = this.lastID; // ID del cliente recién insertado

        // Insertar registro en el historial de pagos
        db.run(`INSERT INTO pagos (cliente_id, fecha_pago, monto_dolares, tasa_dia, monto_bs, metodo_pago, membresia, referencia)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [clienteID, fechaRegistro, monto_dolares, tasa_dia, monto_bs, metodo_pago, membresia, referencia],
          function (err2) {
            if (err2) {
              console.error('Error al guardar en pagos:', err2.message);
            } else {
              console.log('Pago registrado en el historial');
            }
          });

        alert('Cliente registrado exitosamente.');
        event.target.reset();
      }
    });
}, 100);
})
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
      fechaObj.setDate(fechaObj.getDate() + 1);
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

document.getElementById('cedula').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '');
});

document.getElementById('telefono').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '');
});

document.getElementById('referencia').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '');
});
document.getElementById('metodo_pago').addEventListener('change', function () {
  const metodo = this.value;
  const referenciaInput = document.getElementById('referencia');

  if (metodo === 'transferencia' || metodo === 'pago_movil') {
    referenciaInput.disabled = false;
    referenciaInput.required = true;
    referenciaInput.placeholder = 'Ingrese referencia';
    referenciaInput.value = ''; // limpio en caso de venir de un método anterior
  } else {
    referenciaInput.disabled = true;
    referenciaInput.required = false;
    referenciaInput.placeholder = 'No aplica';
    referenciaInput.value = ''; // limpio para evitar valores no válidos
    referenciaInput.style.border = ''; // quito borde rojo si quedó de antes
  }
});
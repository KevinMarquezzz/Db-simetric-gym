const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Ruta a la base de datos (en la misma carpeta)
const dbPath = path.join(__dirname, 'clientes.db');

// Crear o abrir la base de datos
const db = new sqlite3.Database(dbPath);

// Crear la tabla de clientes si no existe
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    cedula TEXT UNIQUE NOT NULL,
    membresia TEXT NOT NULL,
    telefono TEXT NOT NULL,
    direccion TEXT NOT NULL,
    mail TEXT NOT NULL,
    fechaRegistro TEXT NOT NULL,
    fechaVencimiento TEXT NOT NULL
  )`);
});

// Función para agregar un nuevo cliente
function agregarCliente(cliente, callback) {
  const sql = `INSERT INTO clientes 
    (nombre, cedula, membresia, telefono, direccion, mail, fechaRegistro, fechaVencimiento) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

  db.run(sql, [
    cliente.nombre,
    cliente.cedula,
    cliente.membresia,
    cliente.telefono,
    cliente.direccion,
    cliente.mail,
    cliente.fechaRegistro,
    cliente.fechaVencimiento
  ], function(err) {
    callback(err);
  });
}

module.exports = { agregarCliente };

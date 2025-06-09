const sqlite3 = require('sqlite3').verbose();

// Crear o conectar a la base de datos de productos
let db = new sqlite3.Database('inventario.sqlite', (err) => {
  if (err) {
    console.error('Error al conectar con la base de datos:', err.message);
  } else {
    console.log('Conectado a la base de datos de productos.');
  }
});

// Crear tabla si no existe
db.run(`
  CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    codigo TEXT UNIQUE NOT NULL,
    categoria TEXT NOT NULL,
    marca TEXT NOT NULL,
    precio_compra REAL NOT NULL,
    precio_venta REAL NOT NULL,
    stock INTEGER NOT NULL,
    unidad TEXT NOT NULL,
    proveedor TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    fecha_registro TEXT NOT NULL
  )
`);
// Obtener el formulario
document.querySelector('form').addEventListener('submit', (event) => {
  event.preventDefault();

  // Obtener valores del formulario
  const nombre = document.getElementById('nombre').value.trim();
  const codigo = document.getElementById('codigo').value.trim();
  const categoria = document.getElementById('categoria').value.trim();
  const marca = document.getElementById('marca').value.trim();
  const precio_compra = parseFloat(document.getElementById('precio_compra').value);
  const precio_venta = parseFloat(document.getElementById('precio_venta').value);
  const stock = parseInt(document.getElementById('stock').value);
  const unidad = document.getElementById('unidad').value.trim();
  const proveedor = document.getElementById('proveedor').value.trim();
  const descripcion = document.getElementById('descripcion').value.trim();

  const fecha_registro = obtenerFechaActual(); // YYYY-MM-DD

  // Validar campos requeridos
  if (!nombre || !codigo || !categoria || !marca || isNaN(precio_compra) || isNaN(precio_venta) || isNaN(stock) || !unidad || !proveedor || !descripcion) {
    alert("Por favor completa todos los campos correctamente.");
    return;
  }

  // Insertar en base de datos
  setTimeout(() => {
    db.run(`INSERT INTO productos 
      (nombre, codigo, categoria, marca, precio_compra, precio_venta, stock, unidad, proveedor, descripcion, fecha_registro)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, codigo, categoria, marca, precio_compra, precio_venta, stock, unidad, proveedor, descripcion, fecha_registro],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            alert('Error: Ya existe un producto con ese código.');
          } else {
            console.error('Error al guardar producto:', err.message);
            alert('Error al guardar el producto.');
          }
        } else {
          alert('Producto registrado exitosamente.');
          event.target.reset(); // Limpiar formulario
        }
      });
  }, 100);
});

function obtenerFechaActual() {
  const hoy = new Date();
  const year = hoy.getFullYear();
  const month = String(hoy.getMonth() + 1).padStart(2, '0');
  const day = String(hoy.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

document.getElementById('codigo').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '');
});

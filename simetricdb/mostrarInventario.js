const sqlite3 = require('sqlite3').verbose();

let db = new sqlite3.Database('inventario.sqlite', (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log('Conectado a la base de datos para mostrar inventario.');
    cargarInventarioDesdeDB();
  }
});

let productosOriginales = [];
let productoIdSeleccionado = null;

function cargarInventarioDesdeDB() {
  db.all('SELECT * FROM productos', [], (err, rows) => {
    if (err) {
      console.error(err.message);
      return;
    }
    productosOriginales = rows;
    filtrarYMostrarProductos();
  });
}

function filtrarYMostrarProductos() {
  const codigoFiltro = document.getElementById('search-code').value.toLowerCase();
  const nombreFiltro = document.getElementById('search-name').value.toLowerCase();
  const categoriaFiltro = document.getElementById('search-category').value;

  const productosFiltrados = productosOriginales.filter(p =>
    p.codigo.toLowerCase().includes(codigoFiltro) &&
    p.nombre.toLowerCase().includes(nombreFiltro) &&
    (categoriaFiltro === '' || p.categoria === categoriaFiltro)
  );

  renderizarProductos(productosFiltrados);
}

function renderizarProductos(productos) {
  const container = document.getElementById('inventory-container');
  container.innerHTML = '';

  if (productos.length === 0) {
    container.innerHTML = '<p>No se encontraron productos.</p>';
    return;
  }

  const header = document.createElement('div');
  header.classList.add('table-header');
  header.innerHTML = `
    <div>Código</div>
    <div>Nombre</div>
    <div>Categoría</div>
    <div>Stock</div>
    <div>Acciones</div>
  `;
  container.appendChild(header);

  productos.forEach((p) => {
    const row = document.createElement('div');
    row.classList.add('table-row');
    row.innerHTML = `
      <div>${p.codigo}</div>
      <div>${p.nombre}</div>
      <div>${p.categoria}</div>
      <div>${p.stock}</div>
      <div><button class="ver-detalles-producto" data-id="${p.id}">Detalles</button></div>
    `;
    container.appendChild(row);
  });
}

// Mostrar detalles en el popup
document.addEventListener('click', function (event) {
  if (event.target.classList.contains('ver-detalles-producto')) {
    const id = event.target.dataset.id;
    productoIdSeleccionado = id;

    db.get('SELECT * FROM productos WHERE id = ?', [id], (err, p) => {
      if (err) {
        console.error('Error al obtener detalles:', err.message);
        return;
      }

      if (p) {
        document.getElementById('detalle-codigo').value = p.codigo;
        document.getElementById('detalle-nombre').value = p.nombre;
        document.getElementById('detalle-descripcion').value = p.descripcion;
        document.getElementById('detalle-proveedor').value = p.proveedor;
        document.getElementById('detalle-precio-compra').value = p.precio_compra;
        document.getElementById('detalle-precio').value = p.precio_venta;
        document.getElementById('detalle-stock').value = p.stock;
        document.getElementById('detalle-marca').value = p.marca;
        document.getElementById('detalle-unidad').value = p.unidad;

        document.getElementById('popup-detalles-inv').classList.remove('oculto');
      }
    });
  }
});

// Cerrar popup
document.getElementById('cerrar-popup-inv').addEventListener('click', () => {
  document.getElementById('popup-detalles-inv').classList.add('oculto');
});

// Guardar cambios
document.getElementById('form-editar-producto').addEventListener('submit', function (e) {
  e.preventDefault();

  const nombre = document.getElementById('detalle-nombre').value.trim();
  const descripcion = document.getElementById('detalle-descripcion').value.trim();
  const proveedor = document.getElementById('detalle-proveedor').value.trim();
  const precioCompra = parseFloat(document.getElementById('detalle-precio-compra').value);
  const precioVenta = parseFloat(document.getElementById('detalle-precio').value);
  const stock = parseInt(document.getElementById('detalle-stock').value);
  const marca = document.getElementById('detalle-marca').value.trim();
  const unidad = document.getElementById('detalle-unidad').value.trim();

  db.run(
    `UPDATE productos SET nombre = ?, descripcion = ?, proveedor = ?, precio_compra = ?, precio_venta = ?, stock = ?, marca = ?, unidad = ? WHERE id = ?`,
    [nombre, descripcion, proveedor, precioCompra, precioVenta, stock, marca, unidad, productoIdSeleccionado],
    function (err) {
      if (err) {
        console.error(err.message);
        alert('Error al actualizar producto.');
      } else {
        alert('Producto actualizado exitosamente.');
        document.getElementById('popup-detalles-inv').classList.add('oculto');
        cargarInventarioDesdeDB();
      }
    }
  );
});

// Eliminar producto
document.getElementById('eliminar-producto').addEventListener('click', function () {
  const confirmar = confirm('¿Estás seguro de que deseas eliminar este producto?');

  if (confirmar) {
    db.run(`DELETE FROM productos WHERE id = ?`, [productoIdSeleccionado], function (err) {
      if (err) {
        console.error(err.message);
        alert('Error al eliminar producto.');
      } else {
        alert('Producto eliminado correctamente.');
        document.getElementById('popup-detalles-inv').classList.add('oculto');
        cargarInventarioDesdeDB();
      }
    });
  }
});

// Filtro por código
document.getElementById('search-code').addEventListener('input', filtrarYMostrarProductos);
document.getElementById('search-name').addEventListener('input', filtrarYMostrarProductos);
document.getElementById('search-category').addEventListener('input', filtrarYMostrarProductos);

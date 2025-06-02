const sqlite3 = require('sqlite3').verbose();

let db = new sqlite3.Database('inventario.sqlite', (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log('Conectado a la base de datos para mostrar inventario.');
    cargarInventarioDesdeDB();
  }
});

let inventarioOriginal = [];
let productoIdSeleccionado = null;

// Cargar productos desde la base de datos
function cargarInventarioDesdeDB() {
  db.all('SELECT * FROM inventario', [], (err, rows) => {
    if (err) {
      console.error(err.message);
      return;
    }
    inventarioOriginal = rows;
    filtrarYMostrarProductos();
  });
}

// Filtrar productos por nombre y categoría
function filtrarYMostrarProductos() {
  const nombreFiltro = document.getElementById('search-nombre').value.toLowerCase();
  const categoriaFiltro = document.getElementById('search-categoria').value.toLowerCase();

  const productosFiltrados = inventarioOriginal.filter(producto => {
    const coincideNombre = producto.nombre.toLowerCase().includes(nombreFiltro);
    const coincideCategoria = producto.categoria.toLowerCase().includes(categoriaFiltro);
    return coincideNombre && coincideCategoria;
  });

  renderizarProductos(productosFiltrados);
}

// Renderizar productos en pantalla
function renderizarProductos(productos) {
  const container = document.getElementById('inventario-container');
  container.innerHTML = '';

  if (productos.length === 0) {
    container.innerHTML = '<p>No se encontraron productos.</p>';
    return;
  }

  const header = document.createElement('div');
  header.classList.add('table-header');
  header.innerHTML = `
    <div>Nombre</div>
    <div>Categoría</div>
    <div>Precio</div>
    <div>Cantidad</div>
    <div>Acciones</div>
  `;
  container.appendChild(header);

  productos.forEach((producto) => {
    const row = document.createElement('div');
    row.classList.add('table-row');

    row.innerHTML = `
      <div>${producto.nombre}</div>
      <div>${producto.categoria}</div>
      <div>${producto.precio}</div>
      <div>${producto.cantidad}</div>
      <div><button class="ver-detalles-producto" data-id="${producto.id}">Detalles</button></div>
    `;

    container.appendChild(row);
  });
}

// Mostrar detalles en popup
document.addEventListener('click', function (event) {
  if (event.target.classList.contains('ver-detalles-producto')) {
    const id = event.target.dataset.id;
    productoIdSeleccionado = id;

    db.get('SELECT * FROM inventario WHERE id = ?', [id], (err, producto) => {
      if (err) {
        console.error('Error al obtener detalles:', err.message);
        return;
      }

      if (producto) {
        document.getElementById('detalle-nombre-prod').value = producto.nombre;
        document.getElementById('detalle-categoria').value = producto.categoria;
        document.getElementById('detalle-precio').value = producto.precio;
        document.getElementById('detalle-cantidad').value = producto.cantidad;

        document.getElementById('popup-producto').classList.remove('oculto');
      }
    });
  }
});

// Cerrar popup
document.getElementById('cerrar-popup-producto').addEventListener('click', () => {
  document.getElementById('popup-producto').classList.add('oculto');
});

// Guardar cambios
document.getElementById('form-editar-producto').addEventListener('submit', function (e) {
  e.preventDefault();

  const nombre = document.getElementById('detalle-nombre-prod').value.trim();
  const categoria = document.getElementById('detalle-categoria').value.trim();
  const precio = parseFloat(document.getElementById('detalle-precio').value);
  const cantidad = parseInt(document.getElementById('detalle-cantidad').value);

  db.run(
    `UPDATE inventario SET nombre = ?, categoria = ?, precio = ?, cantidad = ? WHERE id = ?`,
    [nombre, categoria, precio, cantidad, productoIdSeleccionado],
    function (err) {
      if (err) {
        console.error(err.message);
        alert('Error al actualizar producto.');
      } else {
        alert('Producto actualizado exitosamente.');
        document.getElementById('popup-producto').classList.add('oculto');
        cargarInventarioDesdeDB();
      }
    }
  );
});

// Eliminar producto
document.getElementById('eliminar-producto').addEventListener('click', function () {
  const confirmar = confirm('¿Estás seguro de que deseas eliminar este producto?');

  if (confirmar) {
    db.run(`DELETE FROM inventario WHERE id = ?`, [productoIdSeleccionado], function (err) {
      if (err) {
        console.error(err.message);
        alert('Error al eliminar producto.');
      } else {
        alert('Producto eliminado correctamente.');
        document.getElementById('popup-producto').classList.add('oculto');
        cargarInventarioDesdeDB();
      }
    });
  }
});

// Filtros
document.getElementById('search-nombre').addEventListener('input', filtrarYMostrarProductos);
document.getElementById('search-categoria').addEventListener('input', filtrarYMostrarProductos);

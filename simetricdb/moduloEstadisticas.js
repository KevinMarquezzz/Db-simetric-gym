// productos_mas_vendidos.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('inventario.sqlite');

const contenedor = document.getElementById('ventas-container');
const btnFiltrar = document.getElementById('btn-filtrar');
const btnDescargar = document.getElementById('btn-descargar');
const popup = document.getElementById('popup-detalles-ventas');
const cerrarPopup = document.getElementById('cerrar-popup-ventas');
const contenidoDetalles = document.getElementById('contenido-detalles-ventas');

btnFiltrar.addEventListener('click', () => {
    const mes = document.getElementById('filtro-mes').value;
    const inicio = document.getElementById('fecha-inicio').value;
    const fin = document.getElementById('fecha-fin').value;
    let where = '';

    if (mes) {
        const [a, m] = mes.split('-');
        where = `strftime('%Y-%m', fecha) = '${a}-${m}'`;
    } else if (inicio && fin) {
        where = `date(fecha) BETWEEN '${inicio}' AND '${fin}'`;
    }

    const query = `
        SELECT p.nombre, p.codigo, SUM(v.cantidad) as total_vendido, SUM(v.total_venta) as total_ingresos
        FROM ventas v
        JOIN productos p ON p.id = v.producto_id
        ${where ? 'WHERE ' + where : ''}
        GROUP BY v.producto_id
        ORDER BY total_vendido DESC;
    `;

    db.all(query, [], (err, rows) => {
        if (err) return console.error(err);
        contenedor.innerHTML = generarTabla(rows);
    });
});

btnDescargar.addEventListener('click', () => {
    const filas = contenedor.querySelectorAll('.table-row');
    if (!filas.length) return alert('No hay datos para descargar');

    let csv = 'Nombre,Código,Cantidad Vendida,Total Ingresos\n';
    filas.forEach(row => {
        const columnas = row.querySelectorAll('div');
        let fila = Array.from(columnas).slice(0, 4).map(c => c.textContent.trim()).join(',');
        csv += fila + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'productos_mas_vendidos.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
});

function generarTabla(data) {
    let html = '<div class="table-header"><div>Nombre</div><div>Código</div><div>Cantidad</div><div>Ingresos ($)</div><div>Detalles</div></div>';
    data.forEach(p => {
        html += `
        <div class="table-row">
            <div>${p.nombre}</div>
            <div>${p.codigo}</div>
            <div>${p.total_vendido}</div>
            <div>${p.total_ingresos.toFixed(2)}</div>
            <div><button class="ver-detalles-producto" data-codigo="${p.codigo}">Ver</button></div>
        </div>`;
    });
    return html;
}

contenedor.addEventListener('click', e => {
    if (e.target.classList.contains('ver-detalles-producto')) {
        const codigo = e.target.dataset.codigo;
        db.get('SELECT * FROM productos WHERE codigo = ?', [codigo], (err, producto) => {
            if (err) return console.error(err);
            if (producto) {
                contenidoDetalles.innerHTML = `
                    <p><strong>Nombre:</strong> ${producto.nombre}</p>
                    <p><strong>Código:</strong> ${producto.codigo}</p>
                    <p><strong>Categoría:</strong> ${producto.categoria}</p>
                    <p><strong>Marca:</strong> ${producto.marca}</p>
                    <p><strong>Proveedor:</strong> ${producto.proveedor}</p>
                    <p><strong>Descripción:</strong> ${producto.descripcion}</p>
                `;
                popup.classList.remove('oculto');
            }
        });
    }
});

cerrarPopup.addEventListener('click', () => {
    popup.classList.add('oculto');
    contenidoDetalles.innerHTML = '';
});

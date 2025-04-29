const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Ruta a tu base de datos
const dbPath = path.join(__dirname, 'database', 'clientes.db');
const db = new sqlite3.Database(dbPath);

// Elementos
const clientContainer = document.getElementById('client-container');
const searchName = document.getElementById('search-name');
const searchCedula = document.getElementById('search-cedula');
const filterStatus = document.getElementById('filter-status');

// Función para cargar clientes
function loadClients() {
    clientContainer.innerHTML = '';

    db.all("SELECT * FROM clientes", [], (err, rows) => {
        if (err) {
            console.error(err.message);
            return;
        }

        const today = new Date();

        rows.forEach(client => {
            const fechaRegistro = new Date(client.fecha_registro);
            const fechaVencimiento = new Date(fechaRegistro);
            fechaVencimiento.setMonth(fechaRegistro.getMonth() + 1);

            const isActive = today <= fechaVencimiento;

            const row = document.createElement('div');
            row.classList.add('client-row');
            row.innerHTML = `
                <div class="client-data">${client.nombre}</div>
                <div class="client-data">${client.cedula}</div>
                <div class="client-data">${client.telefono}</div>
                <div class="client-data">${fechaRegistro.toLocaleDateString()}</div>
                <div class="client-data">${fechaVencimiento.toLocaleDateString()}</div>
                <div class="status-box ${isActive ? 'active' : ''}"></div>
            `;

            row.dataset.nombre = client.nombre.toLowerCase();
            row.dataset.cedula = client.cedula;
            row.dataset.activo = isActive ? "1" : "0";

            clientContainer.appendChild(row);
        });
    });
}

// Función de filtrado
function filterClients() {
    const nombreFiltro = searchName.value.toLowerCase();
    const cedulaFiltro = searchCedula.value;
    const statusFiltro = filterStatus.value;

    const rows = document.querySelectorAll('.client-row');

    rows.forEach(row => {
        const matchNombre = row.dataset.nombre.includes(nombreFiltro);
        const matchCedula = row.dataset.cedula.includes(cedulaFiltro);

        let matchStatus = true;
        if (statusFiltro === "vigentes" && row.dataset.activo !== "1") {
            matchStatus = false;
        }
        if (statusFiltro === "vencidos" && row.dataset.activo !== "0") {
            matchStatus = false;
        }

        if (matchNombre && matchCedula && matchStatus) {
            row.style.display = 'flex';
        } else {
            row.style.display = 'none';
        }
    });
}

// Eventos de filtro
searchName.addEventListener('input', filterClients);
searchCedula.addEventListener('input', filterClients);
filterStatus.addEventListener('change', filterClients);

// Cargar clientes al iniciar
loadClients();

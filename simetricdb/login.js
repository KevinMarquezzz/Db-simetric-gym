const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

// Referencias al formulario
const form = document.getElementById('login-form');
const usuarioInput = document.getElementById('usuario');
const claveInput = document.getElementById('clave');

// Evento de envío del formulario
form.addEventListener('submit', (e) => {
    e.preventDefault();

    const usuario = usuarioInput.value.trim();
    const clave = claveInput.value;

    if (!usuario || !clave) {
        alert('Por favor ingresa usuario y contraseña.');
        return;
    }

    db.get("SELECT * FROM usuarios WHERE usuario = ?", [usuario], (err, row) => {
        if (err) {
            console.error("Error al consultar la base de datos", err);
            alert("Ocurrió un error. Intenta nuevamente.");
            return;
        }

        if (!row) {
            alert("Usuario no registrado.");
        } else {
            if (row.clave === clave) {
                // Acceso correcto, redirigir
                window.location.href = "index.html"; // Aquí va la página principal
            } else {
                alert("Contraseña incorrecta.");
            }
        }
    });
});

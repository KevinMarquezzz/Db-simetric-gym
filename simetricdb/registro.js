const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

// Crear tabla si no existe
db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT UNIQUE NOT NULL,
    clave TEXT NOT NULL
)`);

const form = document.getElementById('registro-form');

form.addEventListener('submit', (e) => {
    e.preventDefault();

    const usuario = document.getElementById('usuario').value.trim();
    const clave = document.getElementById('clave').value;
    const confirmar = document.getElementById('confirmar').value;

    if (!usuario || !clave || !confirmar) {
        alert("Todos los campos son obligatorios.");
        return;
    }

    if (clave !== confirmar) {
        alert("Las contraseñas no coinciden.");
        return;
    }

    // Insertar nuevo usuario
    db.run("INSERT INTO usuarios (usuario, clave) VALUES (?, ?)", [usuario, clave], function(err) {
        if (err) {
            if (err.message.includes("UNIQUE")) {
                alert("Ese nombre de usuario ya está registrado.");
            } else {
                console.error("Error al insertar usuario:", err);
                alert("Hubo un error al registrar la administradora.");
            }
            return;
        }

        alert("Administradora registrada con éxito.");
        form.reset();
    });
});

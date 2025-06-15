const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

// Clave maestra definida por ti
const CLAVE_MAESTRA = "simetricPass123";

// Referencias a formularios y campos
const formVerificacion = document.getElementById('verificacion-form');
const formCambio = document.getElementById('cambio-form');
const inputUsuario = document.getElementById('usuario');
const inputClaveMaestra = document.getElementById('clave-maestra');
const inputNuevaClave = document.getElementById('nueva-clave');
const inputConfirmarClave = document.getElementById('confirmar-clave');
const btnCancelar = document.getElementById('btn-cancelar-popup');

let usuarioValidado = null;

// Verificar usuario y clave maestra
formVerificacion.addEventListener('submit', (e) => {
    e.preventDefault();

    const usuario = inputUsuario.value.trim();
    const claveMaestra = inputClaveMaestra.value;

    if (claveMaestra !== CLAVE_MAESTRA) {
        alert("Contraseña del sistema incorrecta.");
        return;
    }

    db.get("SELECT * FROM usuarios WHERE usuario = ?", [usuario], (err, row) => {
        if (err) {
            alert("Error al consultar la base de datos.");
            return;
        }

        if (!row) {
            alert("El usuario no existe.");
        } else {
            usuarioValidado = usuario;
            formVerificacion.classList.add('hidden');
            formCambio.classList.remove('hidden');
        }
    });
});


// Cambiar la contraseña
formCambio.addEventListener('submit', (e) => {
    e.preventDefault();

    const nuevaClave = inputNuevaClave.value;
    const confirmarClave = inputConfirmarClave.value;

    if (nuevaClave !== confirmarClave) {
        alert("Las contraseñas no coinciden.");
        return;
    }

    db.run("UPDATE usuarios SET clave = ? WHERE usuario = ?", [nuevaClave, usuarioValidado], function (err) {
        if (err) {
            alert("Error al actualizar la contraseña.");
            return;
        }

        alert("Contraseña actualizada correctamente.");
        window.location.href = "login.html";
    });
});
btnCancelar.addEventListener('click', () => {
    formCambio.classList.add('hidden');
});

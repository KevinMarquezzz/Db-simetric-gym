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
                // Acceso correcto, verificar si es el primer usuario registrado
                db.get("SELECT id FROM usuarios ORDER BY id ASC LIMIT 1", (err, firstUser) => {
                    if (err) {
                        console.error("Error al verificar primer usuario:", err);
                        alert("Ocurrió un error. Intenta nuevamente.");
                        return;
                    }
            
                    // Si el ID del usuario coincide con el primer usuario registrado
                    if (row.id === firstUser.id) {
                        // Es el administrador principal - redirigir a indexmain.html
                        window.location.href = "indexmain.html";
                    } else {
                        // Es un administrador regular - redirigir a index.html
                        window.location.href = "index.html";
                    }
                });
            }
        }
    });
});
// Elementos del popup
const registrarLink = document.getElementById('registrar-link');
const administrarLink = document.getElementById('administrar-link');
const popup = document.getElementById('popup-auth');
const inputClave = document.getElementById('clave-autorizacion');
const btnVerificar = document.getElementById('btn-verificar-clave');
const btnCancelar = document.getElementById('btn-cancelar-popup');

let modoAcceso = "";

registrarLink.addEventListener('click', (e) => {
    e.preventDefault();
    db.get("SELECT clave FROM usuarios ORDER BY id ASC LIMIT 1", (err, row) => {
        if (!row) {
            window.location.href = "registro.html";
        } else {
            modoAcceso = "registro";
            popup.classList.remove('hidden');
            inputClave.value = "";
            inputClave.focus();
        }
    });
});

// LINK ADMINISTRAR
administrarLink.addEventListener('click', (e) => {
    e.preventDefault();
    db.get("SELECT clave FROM usuarios ORDER BY id ASC LIMIT 1", (err, row) => {
        if (!row) {
            window.location.href = "administrar_perfiles.html";
        } else {
            modoAcceso = "admin";
            popup.classList.remove('hidden');
            inputClave.value = "";
            inputClave.focus();
        }
    });
});

// VERIFICAR CLAVE (una sola vez)
btnVerificar.addEventListener('click', () => {
    const claveIngresada = inputClave.value.trim();
    db.get("SELECT clave FROM usuarios ORDER BY id ASC LIMIT 1", (err, row) => {
        if (err) {
            alert("Error al verificar la contraseña.");
            return;
        }

        if (claveIngresada === row.clave) {
            popup.classList.add('hidden');
            if (modoAcceso === "registro") {
                window.location.href = "registro.html";
            } else if (modoAcceso === "admin") {
                window.location.href = "administrar_perfiles.html";
            }
        } else {
            alert("Contraseña incorrecta.");
        }
    });
});

// CANCELAR
btnCancelar.addEventListener('click', () => {
    popup.classList.add('hidden');
});
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database("simetricdb.sqlite", (err) => {
    if (err) {
      console.error("Error al conectar con la base de datos:", err.message)
    } else {
      console.log("Conectado a la base de datos unificada para administrar perfiles.")
    }
  })
const tablaBody = document.querySelector("#tabla-perfiles tbody");
const popup = document.getElementById("popup-clave");
const claveInput = document.getElementById("clave-maestra");
const btnCancelar = document.getElementById("btn-cancelar-popup");
const btnConfirmar = document.getElementById("btn-confirmar-popup");

let usuarioPendienteEliminar = null;
const CLAVE_MAESTRA = "simetricPass123";

// Cargar perfiles
function cargarPerfiles() {
    tablaBody.innerHTML = "";
    db.all("SELECT id, usuario FROM usuarios ORDER BY id ASC", [], (err, rows) => {
        if (err) return alert("Error al cargar perfiles.");
        rows.forEach(usuario => {
            const fila = document.createElement("tr");
            fila.innerHTML = `
                <td>${usuario.usuario}</td>
                <td><button class="btn-eliminar" data-id="${usuario.id}">Eliminar</button></td>
            `;
            tablaBody.appendChild(fila);
        });
    });
}

// Manejar clics
tablaBody.addEventListener("click", (e) => {
    if (!e.target.classList.contains("btn-eliminar")) return;

    const id = parseInt(e.target.dataset.id);
    if (!confirm("¿Deseas eliminar este perfil?")) return;

    // Consultar cuál es el primer usuario registrado (menor ID)
    db.get("SELECT id FROM usuarios ORDER BY id ASC LIMIT 1", [], (err, row) => {
        if (err || !row) {
            alert("Error al verificar el primer usuario.");
            return;
        }

        const primerUsuarioId = row.id;

        if (id === primerUsuarioId) {
            usuarioPendienteEliminar = id;
            claveInput.value = "";
            popup.style.display = "flex";
        } else {
            eliminarPerfil(id);
        }
    });
}); 

// Botón cancelar popup
btnCancelar.addEventListener("click", () => {
    popup.style.display = "none";
    usuarioPendienteEliminar = null;
});

// Botón confirmar popup
btnConfirmar.addEventListener("click", () => {
    const clave = claveInput.value;
    if (clave === CLAVE_MAESTRA) {
        eliminarPerfil(usuarioPendienteEliminar);
        popup.style.display = "none";
    } else {
        alert("Clave incorrecta.");
    }
});

// Eliminar perfil
function eliminarPerfil(id) {
    db.run("DELETE FROM usuarios WHERE id = ?", [id], err => {
        if (err) return alert("Error al eliminar perfil.");
        alert("Perfil eliminado.");
        cargarPerfiles();
    });
}

cargarPerfiles();

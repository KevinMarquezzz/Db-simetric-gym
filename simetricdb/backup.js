const fs = require('fs');
const path = require('path');
const os = require('os');

// Ruta al archivo original de la base de datos (subimos un nivel)
const dbPath = path.join(__dirname, '..', 'simetricdb.sqlite');

// Carpeta de respaldo (dentro de Documentos del usuario)
const backupFolder = path.join(os.homedir(), 'Documents', 'SimetricGym_Backups');

// Crear la carpeta si no existe
if (!fs.existsSync(backupFolder)) {
  fs.mkdirSync(backupFolder, { recursive: true });
}

// Crear nombre de archivo con fecha y hora
const date = new Date();
const timestamp = `${date.getFullYear()}-${(date.getMonth() + 1)
  .toString()
  .padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}_${date
  .getHours()
  .toString()
  .padStart(2, '0')}-${date.getMinutes().toString().padStart(2, '0')}`;

const backupFile = path.join(backupFolder, `backup_simetricdb_${timestamp}.sqlite`);

// Copiar archivo
fs.copyFile(dbPath, backupFile, (err) => {
  if (err) {
    console.error('Error al crear respaldo:', err);
    return;
  }
  console.log('Respaldo creado exitosamente en:', backupFile);
});

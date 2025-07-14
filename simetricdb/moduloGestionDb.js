const { exec } = require('child_process');
const path = require('path');

document.getElementById('btn-respaldar').addEventListener('click', () => {
  const backupScriptPath = path.join(__dirname, 'backup.js');

  exec(`node "${backupScriptPath}"`, (error, stdout, stderr) => {
    if (error) {
      alert('Error al crear el respaldo.');
      console.error(stderr);
    } else {
      alert('Respaldo creado exitosamente.');
      console.log(stdout);
    }
  });
});

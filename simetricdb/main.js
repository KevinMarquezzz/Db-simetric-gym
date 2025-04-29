const { app, BrowserWindow } = require('electron');

function createWindow() {
  const win = new BrowserWindow({
    width: 826,
    height: 620,
    webPreferences: {
      nodeIntegration: true, // <--- Agregado
      contextIsolation: false // <--- Agregado
    }
  });

  win.loadFile('simetricdb/inicio.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
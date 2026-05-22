const { ipcMain } = require('electron');
const {
  addCumplimientos,
  getDatabasePath,
  getCumplimientos,
  getDiasInhabiles,
  initializeStore,
  patchCumplimiento,
  recalculateCumplimientos,
  replaceDiasInhabiles,
  updateCumplimientosDesdeSentencias,
} = require('./store.cjs');

let registered = false;

function registerCumplimientosHandlers() {
  if (registered) {
    return;
  }

  initializeStore();
  ipcMain.handle('database:path', () => getDatabasePath());
  ipcMain.handle('cumplimientos:list', () => getCumplimientos());
  ipcMain.handle('cumplimientos:add', (_event, rows) => addCumplimientos(rows));
  ipcMain.handle('cumplimientos:patch', (_event, id, patch) => patchCumplimiento(id, patch));
  ipcMain.handle('cumplimientos:recalculate', () => recalculateCumplimientos());
  ipcMain.handle('cumplimientos:update-from-sentencias', (_event, rows) => updateCumplimientosDesdeSentencias(rows));
  ipcMain.handle('inhabiles:list', () => getDiasInhabiles());
  ipcMain.handle('inhabiles:replace', (_event, dias) => replaceDiasInhabiles(dias));
  registered = true;
}

module.exports = {
  registerCumplimientosHandlers,
};

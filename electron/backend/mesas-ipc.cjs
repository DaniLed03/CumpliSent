const { ipcMain } = require('electron');
const {
  initializeMesasTables,
  listMesas,
  listMesasActivas,
  createMesa,
  updateMesa,
  deleteMesa,
  importMesasCatalog,
  importMesaAssignments,
  autoAssignMesas,
  reassignMesa,
  getAssignmentHistory,
  captureTrabajoDiario,
  getExpedientesByMesa,
  getExpedientesAllMesas,
  getHistorialTrabajoDiario,
  flushTrabajoDiarioToHistory
} = require('./mesas-store.cjs');

let registered = false;

function registerMesasHandlers() {
  if (registered) return;

  initializeMesasTables();

  ipcMain.handle('mesas:list', () => listMesas());
  ipcMain.handle('mesas:list-active', () => listMesasActivas());
  ipcMain.handle('mesas:create', (_event, data) => createMesa(data));
  ipcMain.handle('mesas:update', (_event, id, data) => updateMesa(id, data));
  ipcMain.handle('mesas:delete', (_event, id) => deleteMesa(id));
  ipcMain.handle('mesas:import-catalog', (_event, rows) => importMesasCatalog(rows));
  ipcMain.handle('mesas:import-assignments', (_event, rows) => importMesaAssignments(rows));
  ipcMain.handle('mesas:auto-assign', (_event, userId, userName) => autoAssignMesas(userId, userName));
  ipcMain.handle('mesas:reassign', (_event, data) => reassignMesa(data));
  ipcMain.handle('mesas:assignment-history', (_event, filters) => getAssignmentHistory(filters));

  ipcMain.handle('trabajo:capture', (_event, data) => captureTrabajoDiario(data));
  ipcMain.handle('trabajo:expedientes-mesa', (_event, mesaId) => getExpedientesByMesa(mesaId));
  ipcMain.handle('trabajo:expedientes-all', () => getExpedientesAllMesas());
  ipcMain.handle('trabajo:history', (_event, filters) => getHistorialTrabajoDiario(filters));
  ipcMain.handle('trabajo:flush', () => flushTrabajoDiarioToHistory());

  registered = true;
}

module.exports = {
  registerMesasHandlers,
};

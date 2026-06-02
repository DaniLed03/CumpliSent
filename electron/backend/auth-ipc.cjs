const { ipcMain } = require('electron');
const {
  authenticateUser,
  authenticateUserWithRemember,
  createRole,
  createUser,
  clearRememberSession,
  initializeAuthTables,
  listPermissions,
  listRoles,
  listRolesWithPermissions,
  listUsers,
  getRolesRevision,
  updateRole,
  deleteRole,
  updateUser,
  deleteUser,
  verifyRememberSession,
} = require('./auth-store.cjs');
const {
  activateLicense,
  checkLicense,
  generateLicense,
  getMachineId,
  initializeLicenseTable,
} = require('./license-store.cjs');
const {
  getNetworkUrls,
  listServerClients,
  getServerStatus,
  scanPorts,
  startServer,
  stopServer,
} = require('./api-server.cjs');

let registered = false;

function buildConnectionError(error, baseUrl) {
  const cause = error?.cause || {};
  const details = [
    error?.name,
    error?.code,
    error?.message,
    cause?.code,
    cause?.message,
  ].filter(Boolean);

  const uniqueDetails = [...new Set(details)];
  const detailText = uniqueDetails.length > 0
    ? uniqueDetails.join(' | ')
    : 'Sin detalle tecnico disponible';

  return `No se pudo conectar con el servidor ${baseUrl}. Detalle: ${detailText}`;
}

function registerAuthHandlers() {
  if (registered) return;

  initializeAuthTables();
  initializeLicenseTable();

  /* ────────────────────────────────────────
   * Login — direct against SQLite
   * ──────────────────────────────────────── */
  ipcMain.handle('auth:login', async (_event, username, password, remember) => {
    const result = authenticateUserWithRemember(username, password, Boolean(remember), getMachineId());
    return result;
  });

  ipcMain.handle('auth:bootstrap-login', async (_event, username, password, remember) => {
    return authenticateUserWithRemember(username, password, Boolean(remember), getMachineId());
  });

  ipcMain.handle('auth:remember-login', async (_event, token) => {
    return verifyRememberSession(token, getMachineId());
  });

  ipcMain.handle('auth:remember-clear', async (_event, userId) => {
    return clearRememberSession(userId);
  });

  ipcMain.handle('auth:http-login', async (_event, url, username, password, remember) => {
    const baseUrl = String(url || '').replace(/\/+$/, '');
    try {
      const response = await fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: username, password, remember: Boolean(remember), machineId: getMachineId() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { ok: false, error: data.error || 'Credenciales incorrectas' };
      }
      return data;
    } catch (error) {
      return { ok: false, error: buildConnectionError(error, baseUrl) };
    }
  });

  ipcMain.handle('auth:http-remember-login', async (_event, url, token) => {
    const baseUrl = String(url || '').replace(/\/+$/, '');
    try {
      const response = await fetch(`${baseUrl}/api/remember-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, machineId: getMachineId() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { ok: false, error: data.error || 'Sesion recordada no valida' };
      }
      return data;
    } catch (error) {
      return { ok: false, error: buildConnectionError(error, baseUrl) };
    }
  });

  ipcMain.handle('auth:verify-token', async (_event, url, token) => {
    try {
      const baseUrl = String(url || '').replace(/\/+$/, '');
      const response = await fetch(`${baseUrl}/api/verify`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { ok: false };
      }
      return data;
    } catch {
      return { ok: false };
    }
  });

  /* ────────────────────────────────────────
   * License management
   * ──────────────────────────────────────── */
  ipcMain.handle('license:check', async () => {
    return checkLicense();
  });

  ipcMain.handle('license:activate', async (_event, serial) => {
    return activateLicense(serial);
  });

  ipcMain.handle('license:generate', async (_event, input) => {
    return generateLicense(input);
  });

  ipcMain.handle('license:machine-id', async () => {
    return getMachineId();
  });

  ipcMain.handle('server:start', async (_event, port) => {
    try {
      const result = await startServer(Number(port) || 3000);
      return {
        ok: true,
        port: result.port,
        urls: getNetworkUrls(result.port),
      };
    } catch (error) {
      return { ok: false, error: error?.message || 'Error al iniciar el servidor' };
    }
  });

  ipcMain.handle('server:stop', async () => {
    try {
      await stopServer();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || 'Error al detener el servidor' };
    }
  });

  ipcMain.handle('server:status', async () => {
    const status = getServerStatus();
    return {
      ...status,
      urls: status.running && status.port ? getNetworkUrls(status.port) : [],
    };
  });

  ipcMain.handle('server:scan-ports', async () => scanPorts());

  ipcMain.handle('server:network-urls', async (_event, port) => {
    return getNetworkUrls(Number(port) || 3000);
  });

  ipcMain.handle('server:clients', async () => {
    return listServerClients();
  });

  /* ────────────────────────────────────────
   * User management (IPC direct, for admin panel)
   * ──────────────────────────────────────── */
  ipcMain.handle('users:list', async () => {
    return listUsers();
  });

  ipcMain.handle('users:create', async (_event, userData) => {
    return createUser(userData);
  });

  ipcMain.handle('users:update', async (_event, id, userData) => {
    return updateUser(id, userData);
  });

  ipcMain.handle('users:delete', async (_event, id) => {
    return deleteUser(id);
  });

  ipcMain.handle('roles:list', async () => {
    return listRoles();
  });

  ipcMain.handle('permissions:list', async () => {
    return listPermissions();
  });

  ipcMain.handle('roles:with-permissions', async () => {
    return listRolesWithPermissions();
  });

  ipcMain.handle('roles:revision', async () => {
    return getRolesRevision();
  });

  ipcMain.handle('roles:create', async (_event, roleData) => {
    return createRole(roleData || {});
  });

  ipcMain.handle('roles:update', async (_event, id, roleData) => {
    return updateRole(Number(id), roleData || {});
  });

  ipcMain.handle('roles:delete', async (_event, id) => {
    return deleteRole(Number(id));
  });

  registered = true;
}

module.exports = { registerAuthHandlers };

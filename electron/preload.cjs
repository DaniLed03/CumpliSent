const { contextBridge, ipcRenderer } = require('electron');

let remoteSession = null;

function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

async function remoteRequest(path, options = {}) {
  if (!remoteSession?.apiUrl || !remoteSession?.token) {
    throw new Error('No hay sesion remota activa');
  }

  const response = await fetch(`${remoteSession.apiUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${remoteSession.token}`,
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Error HTTP ${response.status}`);
  }

  return data;
}

const localCumplimientosBackend = {
  databasePath: () => ipcRenderer.invoke('database:path'),
  add: (rows) => ipcRenderer.invoke('cumplimientos:add', rows),
  importRows: (rows) => ipcRenderer.invoke('cumplimientos:import-rows', rows),
  list: () => ipcRenderer.invoke('cumplimientos:list'),
  patch: (id, patch) => ipcRenderer.invoke('cumplimientos:patch', id, patch),
  recalculate: () => ipcRenderer.invoke('cumplimientos:recalculate'),
  updateFromSentencias: (rows) => ipcRenderer.invoke('cumplimientos:update-from-sentencias', rows),
  listInhabiles: () => ipcRenderer.invoke('inhabiles:list'),
  replaceInhabiles: (dias) => ipcRenderer.invoke('inhabiles:replace', dias),
};

const remoteCumplimientosBackend = {
  databasePath: async () => `${remoteSession?.apiUrl || ''}/api`,
  add: async (rows) => (await remoteRequest('/api/cumplimientos', {
    method: 'POST',
    body: JSON.stringify(rows),
  })).result,
  importRows: async (rows) => (await remoteRequest('/api/cumplimientos/import-rows', {
    method: 'POST',
    body: JSON.stringify(rows),
  })).result,
  list: async () => (await remoteRequest('/api/cumplimientos')).rows,
  patch: async (id, patch) => (await remoteRequest(`/api/cumplimientos/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })).row,
  recalculate: async () => (await remoteRequest('/api/cumplimientos/recalculate', {
    method: 'POST',
    body: JSON.stringify({}),
  })).rows,
  updateFromSentencias: async (rows) => (await remoteRequest('/api/cumplimientos/update-from-sentencias', {
    method: 'POST',
    body: JSON.stringify(rows),
  })).result,
  listInhabiles: async () => (await remoteRequest('/api/inhabiles')).rows,
  replaceInhabiles: async (dias) => (await remoteRequest('/api/inhabiles', {
    method: 'PUT',
    body: JSON.stringify(dias),
  })).rows,
};

function getCumplimientosBackend() {
  return remoteSession ? remoteCumplimientosBackend : localCumplimientosBackend;
}

function saveRememberPayload(payload) {
  try {
    window.localStorage.setItem('rememberSession', JSON.stringify(payload));
  } catch {}
}

function clearRememberPayload() {
  try {
    window.localStorage.removeItem('rememberSession');
  } catch {}
}

contextBridge.exposeInMainWorld('cumplimientosBackend', {
  databasePath: (...args) => getCumplimientosBackend().databasePath(...args),
  add: (...args) => getCumplimientosBackend().add(...args),
  importRows: (...args) => getCumplimientosBackend().importRows(...args),
  list: (...args) => getCumplimientosBackend().list(...args),
  patch: (...args) => getCumplimientosBackend().patch(...args),
  recalculate: (...args) => getCumplimientosBackend().recalculate(...args),
  updateFromSentencias: (...args) => getCumplimientosBackend().updateFromSentencias(...args),
  listInhabiles: (...args) => getCumplimientosBackend().listInhabiles(...args),
  replaceInhabiles: (...args) => getCumplimientosBackend().replaceInhabiles(...args),
});

contextBridge.exposeInMainWorld('api', {
  // Auth
  bootstrapLogin: async (username, password, remember) => {
    remoteSession = null;
    const result = await ipcRenderer.invoke('auth:bootstrap-login', username, password, Boolean(remember));
    if (result?.ok && result.rememberToken) {
      saveRememberPayload({
        mode: 'local',
        token: result.rememberToken,
        username: result.user?.Usuario || username,
        expiresAt: result.rememberTokenExpires,
      });
    } else if (!remember) {
      clearRememberPayload();
    }
    return result;
  },
  login: async (...args) => {
    if (args.length <= 3) {
      remoteSession = null;
      const result = await ipcRenderer.invoke('auth:login', args[0], args[1], Boolean(args[2]));
      if (result?.ok && result.rememberToken) {
        saveRememberPayload({
          mode: 'local',
          token: result.rememberToken,
          username: result.user?.Usuario || args[0],
          expiresAt: result.rememberTokenExpires,
        });
      } else if (!args[2]) {
        clearRememberPayload();
      }
      return result;
    }

    const apiUrl = normalizeBaseUrl(args[0]);
    const result = await ipcRenderer.invoke('auth:http-login', apiUrl, args[1], args[2], Boolean(args[3]));
    if (result?.ok && result.token) {
      remoteSession = { apiUrl, token: result.token };
      if (result.rememberToken) {
        saveRememberPayload({
          mode: 'remote',
          apiUrl,
          token: result.rememberToken,
          username: result.user?.Usuario || args[1],
          expiresAt: result.rememberTokenExpires,
        });
      } else if (!args[3]) {
        clearRememberPayload();
      }
    }
    return result;
  },
  clearRemoteSession: () => {
    remoteSession = null;
    clearRememberPayload();
  },
  rememberLogin: async () => {
    let saved;
    try {
      saved = JSON.parse(window.localStorage.getItem('rememberSession') || 'null');
    } catch {
      saved = null;
    }
    if (!saved?.token) {
      return { ok: false };
    }

    if (saved.mode === 'remote' && saved.apiUrl) {
      const apiUrl = normalizeBaseUrl(saved.apiUrl);
      const result = await ipcRenderer.invoke('auth:http-remember-login', apiUrl, saved.token);
      if (result?.ok && result.token) {
        remoteSession = { apiUrl, token: result.token };
        return { ...result, apiUrl };
      }
      clearRememberPayload();
      return result;
    }

    remoteSession = null;
    const result = await ipcRenderer.invoke('auth:remember-login', saved.token);
    if (!result?.ok) {
      clearRememberPayload();
    }
    return result;
  },
  verifyToken: async (url, token) => {
    const apiUrl = normalizeBaseUrl(url);
    const result = await ipcRenderer.invoke('auth:verify-token', apiUrl, token);
    if (result?.ok) {
      remoteSession = { apiUrl, token };
    }
    return result;
  },
  checkLicense: () => ipcRenderer.invoke('license:check'),
  activateLicense: (serial) => ipcRenderer.invoke('license:activate', serial),
  generateLicense: (input) => ipcRenderer.invoke('license:generate', input),
  getMachineId: () => ipcRenderer.invoke('license:machine-id'),

  // Server control
  serverStart: (port) => ipcRenderer.invoke('server:start', port),
  serverStop: () => ipcRenderer.invoke('server:stop'),
  serverStatus: () => ipcRenderer.invoke('server:status'),
  scanPorts: () => ipcRenderer.invoke('server:scan-ports'),
  networkUrls: (port) => ipcRenderer.invoke('server:network-urls', port),

  // User management
  listUsers: async () => remoteSession
    ? (await remoteRequest('/api/usuarios')).usuarios
    : ipcRenderer.invoke('users:list'),
  createUser: async (userData) => remoteSession
    ? await remoteRequest('/api/usuarios', { method: 'POST', body: JSON.stringify(userData) })
    : ipcRenderer.invoke('users:create', userData),
  updateUser: async (id, userData) => remoteSession
    ? await remoteRequest(`/api/usuarios/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(userData) })
    : ipcRenderer.invoke('users:update', id, userData),
  listRoles: async () => remoteSession
    ? (await remoteRequest('/api/roles')).roles
    : ipcRenderer.invoke('roles:list'),
  listPermissions: async () => remoteSession
    ? (await remoteRequest('/api/permissions')).permissions
    : ipcRenderer.invoke('permissions:list'),
  listRolesWithPermissions: async () => remoteSession
    ? (await remoteRequest('/api/roles-with-permissions')).roles
    : ipcRenderer.invoke('roles:with-permissions'),
  createRole: async (roleData) => remoteSession
    ? await remoteRequest('/api/roles', { method: 'POST', body: JSON.stringify(roleData) })
    : ipcRenderer.invoke('roles:create', roleData),
  updateRole: async (id, roleData) => remoteSession
    ? await remoteRequest(`/api/roles/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(roleData) })
    : ipcRenderer.invoke('roles:update', id, roleData),
});

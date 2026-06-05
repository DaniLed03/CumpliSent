const Fastify = require('fastify');
const cors = require('@fastify/cors');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const {
  authenticateUserWithRemember,
  createRole,
  createUser,
  initializeAuthTables,
  listPermissions,
  listRoles,
  listRolesWithPermissions,
  listUsers,
  getRolesRevision,
  getSessionUserById,
  normalizeRoleName,
  updateRole,
  deleteRole,
  updateUser,
  deleteUser,
  verifyRememberSession,
} = require('./auth-store.cjs');
const {
  addCumplimientos,
  getCumplimientos,
  getDiasInhabiles,
  importCumplimientosRows,
  initializeStore,
  patchCumplimiento,
  recalculateCumplimientos,
  replaceDiasInhabiles,
  updateCumplimientosDesdeSentencias,
} = require('./store.cjs');
const {
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
  listIngresosExpedientes,
  createIngresoExpediente,
  updateIngresoExpediente,
  deleteIngresoExpediente,
  importIngresosExpedientes,
  compareIngresosExpedientes,
  getHistorialTrabajoDiario,
  flushTrabajoDiarioToHistory
} = require('./mesas-store.cjs');

/* ────────────────────────────────────────────
 * JWT Secret — generated per server session
 * ──────────────────────────────────────────── */

const JWT_SECRET = crypto.randomBytes(32).toString('hex');
const JWT_EXPIRY = '12h';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/* ────────────────────────────────────────────
 * Server instance
 * ──────────────────────────────────────────── */

let serverInstance = null;
let serverPort = null;
const ONLINE_WINDOW_MS = 60000;
const ROLE_REVISION_WAIT_TIMEOUT_MS = 25000;
const activeConnections = new Map();
const rolesRevisionWaiters = new Set();

function getServerStatus() {
  return {
    running: serverInstance !== null,
    port: serverPort,
  };
}

function touchUserConnection(user, request) {
  if (!user?.IdUsuario) return;
  activeConnections.set(Number(user.IdUsuario), {
    IdUsuario: Number(user.IdUsuario),
    lastSeen: new Date().toISOString(),
    remoteAddress: request?.ip || request?.socket?.remoteAddress || '',
    userAgent: String(request?.headers?.['user-agent'] || ''),
  });
}

function listServerClients() {
  const now = Date.now();
  return listUsers()
    .map((user) => {
      const connection = activeConnections.get(Number(user.IdUsuario));
      const lastSeenMs = connection?.lastSeen ? new Date(connection.lastSeen).getTime() : 0;
      const connected = Boolean(lastSeenMs && now - lastSeenMs <= ONLINE_WINDOW_MS);
      return {
        ...user,
        Conectado: connected,
        UltimaActividad: connection?.lastSeen || '',
        Direccion: connection?.remoteAddress || '',
        Cliente: connection?.userAgent || '',
      };
    })
    .sort((a, b) => {
      if (a.Conectado !== b.Conectado) return a.Conectado ? -1 : 1;
      return String(a.NombreCompleto || a.Usuario).localeCompare(String(b.NombreCompleto || b.Usuario), 'es-MX');
    });
}

function notifyRolesRevisionWaiters(revision = getRolesRevision()) {
  for (const waiter of rolesRevisionWaiters) {
    clearTimeout(waiter.timer);
    waiter.resolve(revision);
  }
  rolesRevisionWaiters.clear();
}

function waitForRolesRevision(sinceRevision, timeoutMs = ROLE_REVISION_WAIT_TIMEOUT_MS) {
  const currentRevision = getRolesRevision();
  if (!Number.isFinite(sinceRevision) || currentRevision !== sinceRevision) {
    return Promise.resolve(currentRevision);
  }

  return new Promise((resolve) => {
    const waiter = {
      resolve: (revision) => {
        rolesRevisionWaiters.delete(waiter);
        resolve(revision);
      },
      timer: null,
    };
    waiter.timer = setTimeout(() => waiter.resolve(getRolesRevision()), timeoutMs);
    rolesRevisionWaiters.add(waiter);
  });
}

/* ────────────────────────────────────────────
 * Build Fastify app
 * ──────────────────────────────────────────── */

function buildApp() {
  const app = Fastify({ logger: false });

  app.register(cors, { origin: true });

  /* ── Auth middleware decorator ── */
  app.decorate('authenticate', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.code(401).send({ error: 'Token requerido' });
      return;
    }

    const token = authHeader.slice(7);
    const decoded = verifyToken(token);
    if (!decoded) {
      reply.code(401).send({ error: 'Token inválido o expirado' });
      return;
    }

    request.user = decoded;
    touchUserConnection(decoded, request);
  });

  app.decorate('requireAdmin', async (request, reply) => {
    if (!request.user || normalizeRoleName(request.user.Rol) !== 'ADMINISTRADOR') {
      reply.code(403).send({ error: 'Se requiere rol de ADMINISTRADOR' });
    }
  });

  app.decorate('requirePermission', (permissionId) => {
    return async (request, reply) => {
      if (!request.user) {
        reply.code(401).send({ error: 'Token requerido' });
        return;
      }
      const isUserAdmin = normalizeRoleName(request.user.Rol) === 'ADMINISTRADOR';
      if (isUserAdmin) return;
      const permissions = request.user.Permisos || [];
      if (!permissions.includes(permissionId)) {
        reply.code(403).send({ error: `Se requiere el permiso: ${permissionId}` });
      }
    };
  });

  /* ── Health check ── */
  app.get('/api/health', async () => ({ ok: true, timestamp: new Date().toISOString() }));

  /* ── Login ── */
  app.post('/api/login', async (request, reply) => {
    const { usuario, password, remember, machineId } = request.body || {};
    if (!usuario || !password) {
      return reply.code(400).send({ error: 'Usuario y contraseña requeridos' });
    }

    const result = authenticateUserWithRemember(usuario, password, Boolean(remember), machineId || '');
    if (!result.ok) {
      return reply.code(401).send({ error: result.error });
    }

    const token = signToken(result.user);
    touchUserConnection(result.user, request);
    return {
      ok: true,
      token,
      user: result.user,
      rememberToken: result.rememberToken,
      rememberTokenExpires: result.rememberTokenExpires,
    };
  });

  app.post('/api/remember-login', async (request, reply) => {
    const { token: rememberToken, machineId } = request.body || {};
    if (!rememberToken) {
      return reply.code(400).send({ error: 'Token requerido' });
    }

    const result = verifyRememberSession(rememberToken, machineId || '');
    if (!result.ok) {
      return reply.code(401).send({ error: result.error });
    }

    const token = signToken(result.user);
    touchUserConnection(result.user, request);
    return { ok: true, token, user: result.user };
  });

  /* ── Verify token ── */
  app.get('/api/verify', {
    preHandler: [app.authenticate],
  }, async (request) => {
    const freshUser = getSessionUserById(request.user?.IdUsuario);
    if (!freshUser) {
      return { ok: false, error: 'Sesion no valida' };
    }
    return { ok: true, token: signToken(freshUser), user: freshUser };
  });

  /* ── List users ── */
  app.get('/api/usuarios', {
    preHandler: [app.authenticate],
  }, async () => {
    return { ok: true, usuarios: listUsers() };
  });

  app.get('/api/server/clients', {
    preHandler: [app.authenticate, app.requirePermission('view.servidor')],
  }, async () => {
    return { ok: true, clients: listServerClients() };
  });

  /* ── Create user ── */
  app.post('/api/usuarios', {
    preHandler: [app.authenticate, app.requirePermission('users.create')],
  }, async (request, reply) => {
    const { Usuario, Password, IdRol, NombreCompleto, IdMesa } = request.body || {};
    if (!Usuario || !Password) {
      return reply.code(400).send({ error: 'Usuario y contraseña son requeridos' });
    }

    const result = createUser({ Usuario, Password, IdRol, NombreCompleto, IdMesa });
    if (!result.ok) {
      return reply.code(409).send({ error: result.error });
    }

    return { ok: true, IdUsuario: result.IdUsuario };
  });

  /* ── Update user ── */
  app.put('/api/usuarios/:id', {
    preHandler: [app.authenticate, app.requirePermission('users.edit')],
  }, async (request, reply) => {
    const id = Number(request.params.id);
    if (!id) {
      return reply.code(400).send({ error: 'ID de usuario inválido' });
    }

    const result = updateUser(id, request.body || {});
    if (!result.ok) {
      return reply.code(400).send({ error: result.error });
    }

    notifyRolesRevisionWaiters();
    return { ok: true };
  });

  /* ── List roles ── */
  app.delete('/api/usuarios/:id', {
    preHandler: [app.authenticate, app.requirePermission('users.delete')],
  }, async (request, reply) => {
    const id = Number(request.params.id);
    if (!id) {
      return reply.code(400).send({ error: 'ID de usuario invalido' });
    }

    const result = deleteUser(id);
    if (!result.ok) {
      return reply.code(400).send({ error: result.error });
    }

    notifyRolesRevisionWaiters();
    return result;
  });

  app.get('/api/roles', {
    preHandler: [app.authenticate],
  }, async () => {
    return { ok: true, roles: listRoles() };
  });

  app.get('/api/permissions', {
    preHandler: [app.authenticate, app.requirePermission('view.roles')],
  }, async () => {
    return { ok: true, permissions: listPermissions() };
  });

  app.get('/api/roles-with-permissions', {
    preHandler: [app.authenticate, app.requirePermission('view.roles')],
  }, async () => {
    return { ok: true, roles: listRolesWithPermissions() };
  });

  app.get('/api/roles-revision', {
    preHandler: [app.authenticate],
  }, async () => {
    return { ok: true, revision: getRolesRevision() };
  });

  app.get('/api/roles-revision/wait', {
    preHandler: [app.authenticate],
  }, async (request) => {
    const since = Number(request.query?.since);
    const requestedTimeout = Number(request.query?.timeout);
    const timeout = Number.isFinite(requestedTimeout)
      ? Math.max(5000, Math.min(30000, requestedTimeout))
      : ROLE_REVISION_WAIT_TIMEOUT_MS;
    const revision = await waitForRolesRevision(since, timeout);
    return { ok: true, revision };
  });

  app.post('/api/roles', {
    preHandler: [app.authenticate, app.requirePermission('roles.create')],
  }, async (request, reply) => {
    const result = createRole(request.body || {});
    if (!result.ok) {
      return reply.code(400).send({ error: result.error });
    }
    notifyRolesRevisionWaiters();
    return result;
  });

  app.put('/api/roles/:id', {
    preHandler: [app.authenticate, app.requirePermission('roles.edit')],
  }, async (request, reply) => {
    const id = Number(request.params.id);
    if (!id) {
      return reply.code(400).send({ error: 'ID de rol invalido' });
    }
    const result = updateRole(id, request.body || {});
    if (!result.ok) {
      return reply.code(400).send({ error: result.error });
    }
    notifyRolesRevisionWaiters();
    return result;
  });

  app.delete('/api/roles/:id', {
    preHandler: [app.authenticate, app.requirePermission('roles.delete')],
  }, async (request, reply) => {
    const id = Number(request.params.id);
    if (!id) {
      return reply.code(400).send({ error: 'ID de rol invalido' });
    }
    const result = deleteRole(id);
    if (!result.ok) {
      return reply.code(400).send({ error: result.error });
    }
    notifyRolesRevisionWaiters();
    return result;
  });

  app.get('/api/cumplimientos', {
    preHandler: [app.authenticate],
  }, async () => {
    return { ok: true, rows: getCumplimientos() };
  });

  app.post('/api/cumplimientos', {
    preHandler: [app.authenticate],
  }, async (request) => {
    return { ok: true, result: addCumplimientos(Array.isArray(request.body) ? request.body : []) };
  });

  app.post('/api/cumplimientos/import-rows', {
    preHandler: [app.authenticate],
  }, async (request) => {
    return { ok: true, result: importCumplimientosRows(Array.isArray(request.body) ? request.body : []) };
  });

  app.patch('/api/cumplimientos/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const row = patchCumplimiento(request.params.id, request.body || {});
    if (!row) {
      return reply.code(400).send({ error: 'No se pudo actualizar el cumplimiento' });
    }
    return { ok: true, row };
  });

  app.post('/api/cumplimientos/recalculate', {
    preHandler: [app.authenticate],
  }, async () => {
    return { ok: true, rows: recalculateCumplimientos() };
  });

  app.post('/api/cumplimientos/update-from-sentencias', {
    preHandler: [app.authenticate],
  }, async (request) => {
    return { ok: true, result: updateCumplimientosDesdeSentencias(Array.isArray(request.body) ? request.body : []) };
  });

  app.get('/api/inhabiles', {
    preHandler: [app.authenticate],
  }, async () => {
    return { ok: true, rows: getDiasInhabiles() };
  });

  app.put('/api/inhabiles', {
    preHandler: [app.authenticate],
  }, async (request) => {
    return { ok: true, rows: replaceDiasInhabiles(Array.isArray(request.body) ? request.body : []) };
  });

  // Mesas de trámite
  app.get('/api/mesas', {
    preHandler: [app.authenticate, app.requirePermission('view.mesas')],
  }, async () => {
    return { ok: true, mesas: listMesas() };
  });

  app.get('/api/mesas/activas', {
    preHandler: [app.authenticate],
  }, async () => {
    return { ok: true, mesas: listMesasActivas() };
  });

  app.post('/api/mesas', {
    preHandler: [app.authenticate, app.requirePermission('mesas.create')],
  }, async (request) => {
    return createMesa(request.body || {});
  });

  app.put('/api/mesas/:id', {
    preHandler: [app.authenticate, app.requirePermission('mesas.edit')],
  }, async (request) => {
    return updateMesa(Number(request.params.id), request.body || {});
  });

  app.delete('/api/mesas/:id', {
    preHandler: [app.authenticate, app.requirePermission('mesas.delete')],
  }, async (request) => {
    return deleteMesa(Number(request.params.id));
  });

  app.post('/api/mesas/import-catalog', {
    preHandler: [app.authenticate, app.requirePermission('mesas.import')],
  }, async (request) => {
    return importMesasCatalog(Array.isArray(request.body) ? request.body : []);
  });

  app.post('/api/mesas/import-assignments', {
    preHandler: [app.authenticate, app.requirePermission('mesas.import')],
  }, async (request) => {
    return importMesaAssignments(Array.isArray(request.body) ? request.body : []);
  });

  app.post('/api/mesas/auto-assign', {
    preHandler: [app.authenticate, app.requirePermission('mesas.auto_assign')],
  }, async (request) => {
    const { userId, userName } = request.body || {};
    return autoAssignMesas(userId, userName);
  });

  app.post('/api/mesas/reassign', {
    preHandler: [app.authenticate, app.requirePermission('mesas.reassign')],
  }, async (request) => {
    return reassignMesa(request.body || {});
  });

  app.post('/api/mesas/assignment-history', {
    preHandler: [app.authenticate, app.requirePermission('mesas.history')],
  }, async (request) => {
    return { ok: true, history: getAssignmentHistory(request.body || {}) };
  });

  // Trabajo diario
  app.post('/api/trabajo/capture', {
    preHandler: [app.authenticate, app.requirePermission('trabajo.capture')],
  }, async (request) => {
    return captureTrabajoDiario(request.body || {});
  });

  app.get('/api/trabajo/expedientes-mesa/:mesaId', {
    preHandler: [app.authenticate, app.requirePermission('view.trabajo_diario')],
  }, async (request) => {
    return { ok: true, rows: getExpedientesByMesa(request.params.mesaId) };
  });

  app.get('/api/trabajo/expedientes-all', {
    preHandler: [app.authenticate, app.requirePermission('view.trabajo_diario')],
  }, async () => {
    return { ok: true, rows: getExpedientesAllMesas() };
  });

  app.post('/api/trabajo/history', {
    preHandler: [app.authenticate, app.requirePermission('trabajo.history')],
  }, async (request) => {
    return { ok: true, history: getHistorialTrabajoDiario(request.body || {}) };
  });

  app.post('/api/trabajo/flush', {
    preHandler: [app.authenticate, app.requirePermission('trabajo.flush_history')],
  }, async () => {
    return flushTrabajoDiarioToHistory();
  });

  // Ingresos de expedientes
  app.get('/api/ingresos-expedientes', {
    preHandler: [app.authenticate, app.requirePermission('view.ingresos_expedientes')],
  }, async () => {
    return { ok: true, rows: listIngresosExpedientes() };
  });

  app.post('/api/ingresos-expedientes', {
    preHandler: [app.authenticate, app.requirePermission('ingresos.create')],
  }, async (request) => {
    return createIngresoExpediente(request.body || {});
  });

  app.put('/api/ingresos-expedientes/:id', {
    preHandler: [app.authenticate, app.requirePermission('ingresos.edit')],
  }, async (request) => {
    return updateIngresoExpediente(request.params.id, request.body || {});
  });

  app.delete('/api/ingresos-expedientes/:id', {
    preHandler: [app.authenticate, app.requirePermission('ingresos.delete')],
  }, async (request) => {
    return deleteIngresoExpediente(request.params.id);
  });

  app.post('/api/ingresos-expedientes/import', {
    preHandler: [app.authenticate, app.requirePermission('ingresos.import')],
  }, async (request) => {
    return importIngresosExpedientes(Array.isArray(request.body) ? request.body : []);
  });

  app.get('/api/ingresos-expedientes/compare', {
    preHandler: [app.authenticate, app.requirePermission('ingresos.compare')],
  }, async () => {
    return compareIngresosExpedientes();
  });

  return app;
}

/* ────────────────────────────────────────────
 * Start / Stop
 * ──────────────────────────────────────────── */

async function startServer(port = 3000) {
  if (serverInstance) {
    throw new Error('El servidor ya está en ejecución');
  }

  initializeAuthTables();
  initializeStore();

  const app = buildApp();
  await app.listen({ port, host: '0.0.0.0' });
  serverInstance = app;
  serverPort = port;

  return { port };
}

async function stopServer() {
  if (!serverInstance) {
    return;
  }

  await serverInstance.close();
  serverInstance = null;
  serverPort = null;
}

/* ────────────────────────────────────────────
 * Port scanning
 * ──────────────────────────────────────────── */

const net = require('node:net');

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '0.0.0.0');
  });
}

async function scanPorts(startPort = 3000, count = 10) {
  const available = [];
  const candidatePorts = [
    ...Array.from({ length: count }, (_, index) => startPort + index),
    5000,
    5050,
    8000,
    8080,
    8081,
    8888,
  ];

  const uniquePorts = [...new Set(candidatePorts)].sort((a, b) => a - b);
  for (const p of uniquePorts) {
    if (await isPortAvailable(p)) {
      available.push(p);
    }
  }
  return available;
}

/* ────────────────────────────────────────────
 * Network interfaces
 * ──────────────────────────────────────────── */

const os = require('node:os');

function getNetworkUrls(port) {
  const urls = [{ type: 'local', url: `http://127.0.0.1:${port}` }];
  const interfaces = os.networkInterfaces();

  for (const [, nets] of Object.entries(interfaces)) {
    for (const net of nets || []) {
      if (net.family === 'IPv4' && !net.internal) {
        urls.push({ type: 'lan', url: `http://${net.address}:${port}` });
      }
    }
  }

  return urls;
}

/* ────────────────────────────────────────────
 * Exports
 * ──────────────────────────────────────────── */

module.exports = {
  getNetworkUrls,
  listServerClients,
  getServerStatus,
  scanPorts,
  startServer,
  stopServer,
};

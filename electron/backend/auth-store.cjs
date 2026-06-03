const { app } = require('electron');
const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

/* ────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────── */

function quoteIdentifier(id) {
  return `"${String(id).replace(/"/g, '""')}"`;
}

function dataDir() {
  const dir = path.join(app.getPath('userData'), 'backend');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function databaseFile() {
  return path.join(dataDir(), 'sistema-control.sqlite');
}

let db;

function getDb() {
  if (!db) {
    db = new DatabaseSync(databaseFile());
    db.exec('PRAGMA journal_mode = WAL');
  }
  return db;
}

/* ────────────────────────────────────────────
 * Schema
 * ──────────────────────────────────────────── */

const DEFAULT_ROLES = [
  { IdRol: 1, NombreRol: 'ADMINISTRADOR' },
  { IdRol: 2, NombreRol: 'JUEZ' },
  { IdRol: 3, NombreRol: 'SECRETARIO' },
  { IdRol: 4, NombreRol: 'OFICIAL JUDICIAL C' },
];

const SYSTEM_PERMISSIONS = [
  { IdPermiso: 'view.cumplimientos', NombrePermiso: 'Cumplimientos', Categoria: 'VISTAS' },
  { IdPermiso: 'view.procesar', NombrePermiso: 'Normalizacion de la Informacion', Categoria: 'VISTAS' },
  { IdPermiso: 'view.dias_inhabiles', NombrePermiso: 'Dias inhabiles', Categoria: 'VISTAS' },
  { IdPermiso: 'view.servidor', NombrePermiso: 'Servidor', Categoria: 'VISTAS' },
  { IdPermiso: 'view.usuarios', NombrePermiso: 'Usuarios', Categoria: 'VISTAS' },
  { IdPermiso: 'view.roles', NombrePermiso: 'Roles y permisos', Categoria: 'VISTAS' },
  { IdPermiso: 'view.mesas', NombrePermiso: 'Mesas de tramite', Categoria: 'VISTAS' },
  { IdPermiso: 'view.trabajo_diario', NombrePermiso: 'Trabajo diario', Categoria: 'VISTAS' },

  { IdPermiso: 'cumplimientos.details', NombrePermiso: 'Ver detalles', Categoria: 'CUMPLIMIENTOS' },
  { IdPermiso: 'cumplimientos.delete', NombrePermiso: 'Borrar', Categoria: 'CUMPLIMIENTOS' },
  { IdPermiso: 'cumplimientos.edit', NombrePermiso: 'Editar', Categoria: 'CUMPLIMIENTOS' },
  { IdPermiso: 'cumplimientos.export', NombrePermiso: 'Exportar Excel', Categoria: 'CUMPLIMIENTOS' },
  { IdPermiso: 'cumplimientos.import', NombrePermiso: 'Importar Excel', Categoria: 'CUMPLIMIENTOS' },
  { IdPermiso: 'cumplimientos.add', NombrePermiso: 'Agregar nuevos expedientes por rango', Categoria: 'CUMPLIMIENTOS' },
  { IdPermiso: 'cumplimientos.update_from_sentencias', NombrePermiso: 'Actualizar desde sentencias', Categoria: 'CUMPLIMIENTOS' },

  { IdPermiso: 'dias_inhabiles.add', NombrePermiso: 'Agregar', Categoria: 'DIAS INHABILES' },
  { IdPermiso: 'dias_inhabiles.import', NombrePermiso: 'Importar', Categoria: 'DIAS INHABILES' },
  { IdPermiso: 'dias_inhabiles.edit', NombrePermiso: 'Editar', Categoria: 'DIAS INHABILES' },
  { IdPermiso: 'dias_inhabiles.delete', NombrePermiso: 'Borrar', Categoria: 'DIAS INHABILES' },

  { IdPermiso: 'mesas.create', NombrePermiso: 'Agregar', Categoria: 'MESAS DE TRAMITE' },
  { IdPermiso: 'mesas.edit', NombrePermiso: 'Editar', Categoria: 'MESAS DE TRAMITE' },
  { IdPermiso: 'mesas.delete', NombrePermiso: 'Borrar', Categoria: 'MESAS DE TRAMITE' },
  { IdPermiso: 'mesas.import', NombrePermiso: 'Importar Excel', Categoria: 'MESAS DE TRAMITE' },
  { IdPermiso: 'mesas.auto_assign', NombrePermiso: 'Ejecutar asignacion automatica', Categoria: 'MESAS DE TRAMITE' },
  { IdPermiso: 'mesas.reassign', NombrePermiso: 'Reasignar', Categoria: 'MESAS DE TRAMITE' },
  { IdPermiso: 'mesas.history', NombrePermiso: 'Mostrar Historial', Categoria: 'MESAS DE TRAMITE' },

  { IdPermiso: 'trabajo.capture', NombrePermiso: 'Capturar', Categoria: 'TRABAJO DIARIO' },
  { IdPermiso: 'trabajo.edit_today', NombrePermiso: 'Editar', Categoria: 'TRABAJO DIARIO' },
  { IdPermiso: 'trabajo.flush_history', NombrePermiso: 'Enviar a Historial', Categoria: 'TRABAJO DIARIO' },
  { IdPermiso: 'trabajo.history', NombrePermiso: 'Mostrar Historial', Categoria: 'TRABAJO DIARIO' },

  { IdPermiso: 'users.create', NombrePermiso: 'Agregar', Categoria: 'USUARIOS' },
  { IdPermiso: 'users.edit', NombrePermiso: 'Editar', Categoria: 'USUARIOS' },
  { IdPermiso: 'users.delete', NombrePermiso: 'Borrar', Categoria: 'USUARIOS' },

  { IdPermiso: 'roles.create', NombrePermiso: 'Agregar', Categoria: 'ROLES Y PERMISOS' },
  { IdPermiso: 'roles.edit', NombrePermiso: 'Editar', Categoria: 'ROLES Y PERMISOS' },
  { IdPermiso: 'roles.delete', NombrePermiso: 'Borrar', Categoria: 'ROLES Y PERMISOS' },
];

const DEFAULT_ROLE_PERMISSIONS = {
  1: SYSTEM_PERMISSIONS.map((p) => p.IdPermiso),
  2: [
    'view.cumplimientos',
    'view.procesar',
    'view.dias_inhabiles',
    'cumplimientos.details',
    'cumplimientos.add',
    'cumplimientos.edit',
    'cumplimientos.import',
    'cumplimientos.export',
    'cumplimientos.update_from_sentencias',
    'dias_inhabiles.add',
    'dias_inhabiles.import',
    'dias_inhabiles.edit',
    'dias_inhabiles.delete',
    'view.mesas',
    'view.trabajo_diario',
    'trabajo.history',
  ],
  3: [
    'view.cumplimientos',
    'view.procesar',
    'cumplimientos.details',
    'cumplimientos.add',
    'cumplimientos.edit',
    'cumplimientos.import',
    'cumplimientos.export',
    'cumplimientos.update_from_sentencias',
    'view.mesas',
    'view.trabajo_diario',
    'trabajo.history',
  ],
  4: [
    'view.cumplimientos',
    'cumplimientos.details',
    'cumplimientos.edit',
    'cumplimientos.export',
    'view.mesas',
    'view.trabajo_diario',
    'trabajo.capture',
    'trabajo.edit_today',
    'trabajo.history',
  ],
};

const ROLE_ALIASES = {
  ADMIN: 'ADMINISTRADOR',
  CONSULTA: 'SECRETARIO',
  OFICIAL_JUDICIALC: 'OFICIAL JUDICIAL C',
  OFICIAL_JUDICIAL_C: 'OFICIAL JUDICIAL C',
};

function normalizeRoleName(name) {
  const upper = String(name || '').trim().toUpperCase().replace(/[\s_]+/g, '_');
  return ROLE_ALIASES[upper] || String(name || '').trim().toUpperCase();
}

function initializeAuthTables() {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS "CAT_ROLES" (
      "IdRol" INTEGER PRIMARY KEY,
      "NombreRol" TEXT NOT NULL UNIQUE
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS "USUARIOS" (
      "IdUsuario" INTEGER PRIMARY KEY AUTOINCREMENT,
      "Usuario" TEXT NOT NULL UNIQUE COLLATE NOCASE,
      "PasswordHash" TEXT NOT NULL,
      "IdRol" INTEGER NOT NULL DEFAULT 1,
      "Activo" TEXT NOT NULL DEFAULT 'S',
      "NombreCompleto" TEXT DEFAULT '',
      "FechaCreacion" TEXT DEFAULT '',
      FOREIGN KEY ("IdRol") REFERENCES "CAT_ROLES"("IdRol")
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS "CAT_PERMISOS" (
      "IdPermiso" TEXT PRIMARY KEY,
      "NombrePermiso" TEXT NOT NULL,
      "Categoria" TEXT NOT NULL DEFAULT 'GENERAL'
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS "ROL_PERMISOS" (
      "IdRol" INTEGER NOT NULL,
      "IdPermiso" TEXT NOT NULL,
      PRIMARY KEY ("IdRol", "IdPermiso"),
      FOREIGN KEY ("IdRol") REFERENCES "CAT_ROLES"("IdRol"),
      FOREIGN KEY ("IdPermiso") REFERENCES "CAT_PERMISOS"("IdPermiso")
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS "AUTH_META" (
      "Clave" TEXT PRIMARY KEY,
      "Valor" TEXT NOT NULL DEFAULT ''
    )
  `);
  database.prepare(`
    INSERT OR IGNORE INTO "AUTH_META" ("Clave", "Valor") VALUES ('roles_revision', '1')
  `).run();

  ensureUserColumn(database, 'RecordarSesion', 'TEXT DEFAULT \'N\'');
  ensureUserColumn(database, 'RememberTokenHash', 'TEXT DEFAULT \'\'');
  ensureUserColumn(database, 'RememberTokenExpires', 'TEXT DEFAULT \'\'');
  ensureUserColumn(database, 'RememberMachineId', 'TEXT DEFAULT \'\'');
  ensureUserColumn(database, 'ID_MESA', 'INTEGER DEFAULT NULL');

  // Seed default roles
  const insertRole = database.prepare(
    `INSERT OR IGNORE INTO "CAT_ROLES" ("IdRol", "NombreRol") VALUES (?, ?)`
  );
  for (const role of DEFAULT_ROLES) {
    insertRole.run(role.IdRol, role.NombreRol);
  }

  seedPermissions(database);

  // Seed default admin if no users exist
  const userCount = database.prepare('SELECT COUNT(*) AS cnt FROM "USUARIOS"').get();
  if (userCount.cnt === 0) {
    const hash = hashPassword('D4n13l2003');
    const now = new Date().toISOString().slice(0, 10);
    database.prepare(
      `INSERT INTO "USUARIOS" ("Usuario", "PasswordHash", "IdRol", "Activo", "NombreCompleto", "FechaCreacion")
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run('jledezmaR', hash, 1, 'S', 'Administrador del Sistema', now);
  } else {
    ensureDefaultAdminCredentials(database);
  }
}

function seedPermissions(database) {
  const legacyPermissionMappings = [
    ['cumplimientos.recalculate', 'cumplimientos.update_from_sentencias'],
    ['cumplimientos.edit', 'cumplimientos.delete'],
    ['cumplimientos.edit', 'cumplimientos.details'],
    ['dias_inhabiles.manage', 'dias_inhabiles.add'],
    ['dias_inhabiles.manage', 'dias_inhabiles.import'],
    ['dias_inhabiles.manage', 'dias_inhabiles.edit'],
    ['dias_inhabiles.manage', 'dias_inhabiles.delete'],
    ['mesas.view', 'view.mesas'],
    ['mesas.manage', 'mesas.create'],
    ['mesas.manage', 'mesas.edit'],
    ['mesas.manage', 'mesas.delete'],
    ['mesas.assign_users', 'users.edit'],
    ['trabajo.view_my_mesa', 'view.trabajo_diario'],
    ['trabajo.view_all_mesas', 'view.trabajo_diario'],
    ['users.edit', 'users.delete'],
    ['roles.edit', 'roles.delete'],
    ['roles.permissions', 'roles.edit'],
  ];
  const legacyPermissions = [
    'cumplimientos.recalculate',
    'dias_inhabiles.manage',
    'mesas.view',
    'mesas.manage',
    'mesas.assign_users',
    'trabajo.view_my_mesa',
    'trabajo.view_all_mesas',
    'roles.permissions',
    'server.manage',
    'mesas.assignment_history',
    'mesas.import_assignment',
    'mesas.import_assignments',
    'trabajo.send_history',
    'trabajo.view_all',
    'trabajo.view_mine',
    'trabajo.view_own_mesa',
    'view.dashboard',
  ];

  const insertPermission = database.prepare(`
    INSERT OR IGNORE INTO "CAT_PERMISOS" ("IdPermiso", "NombrePermiso", "Categoria")
    VALUES (?, ?, ?)
  `);
  const updatePermission = database.prepare(`
    UPDATE "CAT_PERMISOS"
    SET "NombrePermiso" = ?, "Categoria" = ?
    WHERE "IdPermiso" = ?
  `);

  for (const permission of SYSTEM_PERMISSIONS) {
    insertPermission.run(permission.IdPermiso, permission.NombrePermiso, permission.Categoria);
    updatePermission.run(permission.NombrePermiso, permission.Categoria, permission.IdPermiso);
  }

  for (const [legacyPermission, newPermission] of legacyPermissionMappings) {
    database.prepare(`
      INSERT OR IGNORE INTO "ROL_PERMISOS" ("IdRol", "IdPermiso")
      SELECT DISTINCT "IdRol", ?
      FROM "ROL_PERMISOS"
      WHERE "IdPermiso" = ?
    `).run(newPermission, legacyPermission);
  }

  for (const permissionId of legacyPermissions) {
    database.prepare('DELETE FROM "ROL_PERMISOS" WHERE "IdPermiso" = ?').run(permissionId);
    database.prepare('DELETE FROM "CAT_PERMISOS" WHERE "IdPermiso" = ?').run(permissionId);
  }

  const insertRolePermission = database.prepare(`
    INSERT OR IGNORE INTO "ROL_PERMISOS" ("IdRol", "IdPermiso") VALUES (?, ?)
  `);

  for (const [roleId, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    for (const permissionId of permissions) {
      insertRolePermission.run(Number(roleId), permissionId);
    }
  }

}

function ensureUserColumn(database, columnName, definition) {
  const columns = database.prepare('PRAGMA table_info("USUARIOS")').all().map((column) => column.name);
  if (!columns.includes(columnName)) {
    database.exec(`ALTER TABLE "USUARIOS" ADD COLUMN "${columnName}" ${definition}`);
  }
}

function ensureDefaultAdminCredentials(database) {
  const hash = hashPassword('D4n13l2003');
  const targetUser = database
    .prepare('SELECT "IdUsuario" FROM "USUARIOS" WHERE "Usuario" = ? COLLATE NOCASE')
    .get('jledezmaR');

  if (targetUser) {
    database.prepare(`
      UPDATE "USUARIOS"
      SET "PasswordHash" = ?, "IdRol" = 1, "Activo" = 'S'
      WHERE "IdUsuario" = ?
    `).run(hash, targetUser.IdUsuario);
    return;
  }

  const oldAdmin = database
    .prepare('SELECT "IdUsuario" FROM "USUARIOS" WHERE "Usuario" = ? COLLATE NOCASE')
    .get('admin');

  if (oldAdmin) {
    database.prepare(`
      UPDATE "USUARIOS"
      SET "Usuario" = ?, "PasswordHash" = ?, "IdRol" = 1, "Activo" = 'S',
          "NombreCompleto" = COALESCE(NULLIF("NombreCompleto", ''), 'Administrador del Sistema')
      WHERE "IdUsuario" = ?
    `).run('jledezmaR', hash, oldAdmin.IdUsuario);
  }
}

/* ────────────────────────────────────────────
 * Password Hashing
 * ──────────────────────────────────────────── */

function hashPassword(plaintext) {
  const sha = crypto.createHash('sha256').update(plaintext, 'utf8').digest('hex');
  return `sha256:${sha}`;
}

function verifyPassword(plaintext, stored) {
  if (!stored) return false;

  // SHA-256 hashed password
  if (stored.startsWith('sha256:')) {
    const expected = stored.slice(7);
    const actual = crypto.createHash('sha256').update(plaintext, 'utf8').digest('hex');
    return actual === expected;
  }

  // Legacy plaintext comparison
  return plaintext === stored;
}

function hashRememberToken(token) {
  return crypto.createHash('sha256').update(String(token || ''), 'utf8').digest('hex');
}

function createRememberSession(IdUsuario, machineId = '') {
  const database = getDb();
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashRememberToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  const expiresIso = expiresAt.toISOString();

  database.prepare(`
    UPDATE "USUARIOS"
    SET "RecordarSesion" = 'S',
        "RememberTokenHash" = ?,
        "RememberTokenExpires" = ?,
        "RememberMachineId" = ?
    WHERE "IdUsuario" = ?
  `).run(tokenHash, expiresIso, String(machineId || ''), IdUsuario);

  return { token, expiresAt: expiresIso };
}

function clearRememberSession(IdUsuario) {
  getDb().prepare(`
    UPDATE "USUARIOS"
    SET "RecordarSesion" = 'N',
        "RememberTokenHash" = '',
        "RememberTokenExpires" = '',
        "RememberMachineId" = ''
    WHERE "IdUsuario" = ?
  `).run(IdUsuario);
  return { ok: true };
}

function verifyRememberSession(token, machineId = '') {
  const tokenHash = hashRememberToken(token);
  const database = getDb();
  const row = database.prepare(`
    SELECT u."IdUsuario", u."Usuario", u."IdRol", u."Activo", u."NombreCompleto",
           u."RecordarSesion", u."RememberTokenExpires", u."RememberMachineId",
           r."NombreRol", u."ID_MESA"
    FROM "USUARIOS" u
    JOIN "CAT_ROLES" r ON u."IdRol" = r."IdRol"
    WHERE u."RememberTokenHash" = ?
    LIMIT 1
  `).get(tokenHash);

  if (!row || row.RecordarSesion !== 'S' || row.Activo !== 'S') {
    return { ok: false, error: 'Sesion recordada no valida' };
  }

  if (row.RememberMachineId && String(machineId || '') && row.RememberMachineId !== String(machineId || '')) {
    return { ok: false, error: 'Sesion recordada ligada a otro equipo' };
  }

  const expiresAt = new Date(row.RememberTokenExpires || '');
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    clearRememberSession(row.IdUsuario);
    return { ok: false, error: 'Sesion recordada expirada' };
  }

  return {
    ok: true,
    user: {
      IdUsuario: row.IdUsuario,
      Usuario: row.Usuario,
      NombreCompleto: row.NombreCompleto || row.Usuario,
      IdRol: row.IdRol,
      Rol: normalizeRoleName(row.NombreRol),
      Permisos: getPermissionsForRole(row.IdRol),
      IdMesa: row.ID_MESA,
    },
  };
}

/* ────────────────────────────────────────────
 * Auth Queries
 * ──────────────────────────────────────────── */

function authenticateUser(username, password) {
  const database = getDb();
  const row = database.prepare(`
    SELECT u."IdUsuario", u."Usuario", u."PasswordHash", u."IdRol", u."Activo",
           u."NombreCompleto", r."NombreRol", u."ID_MESA"
    FROM "USUARIOS" u
    JOIN "CAT_ROLES" r ON u."IdRol" = r."IdRol"
    WHERE u."Usuario" = ?
  `).get(username);

  if (!row) {
    return { ok: false, error: 'Usuario no encontrado' };
  }

  if (row.Activo !== 'S') {
    return { ok: false, error: 'Usuario desactivado' };
  }

  if (!verifyPassword(password, row.PasswordHash)) {
    return { ok: false, error: 'Contraseña incorrecta' };
  }

  // If password was legacy plaintext, upgrade to hash
  if (!row.PasswordHash.startsWith('sha256:')) {
    const newHash = hashPassword(password);
    database.prepare('UPDATE "USUARIOS" SET "PasswordHash" = ? WHERE "IdUsuario" = ?')
      .run(newHash, row.IdUsuario);
  }

  const rolNormalizado = normalizeRoleName(row.NombreRol);

  return {
    ok: true,
    user: {
      IdUsuario: row.IdUsuario,
      Usuario: row.Usuario,
      NombreCompleto: row.NombreCompleto || row.Usuario,
      IdRol: row.IdRol,
      Rol: rolNormalizado,
      Permisos: getPermissionsForRole(row.IdRol),
      IdMesa: row.ID_MESA,
    },
  };
}

function authenticateUserWithRemember(username, password, remember = false, machineId = '') {
  const result = authenticateUser(username, password);
  if (!result.ok || !remember) {
    return result;
  }

  const rememberSession = createRememberSession(result.user.IdUsuario, machineId);
  return {
    ...result,
    rememberToken: rememberSession.token,
    rememberTokenExpires: rememberSession.expiresAt,
  };
}

function isAdmin(username) {
  const database = getDb();
  const row = database.prepare(`
    SELECT r."NombreRol"
    FROM "USUARIOS" u
    JOIN "CAT_ROLES" r ON u."IdRol" = r."IdRol"
    WHERE u."Usuario" = ? AND u."Activo" = 'S'
  `).get(username);

  if (!row) return false;
  return normalizeRoleName(row.NombreRol) === 'ADMINISTRADOR';
}

/* ────────────────────────────────────────────
 * User CRUD
 * ──────────────────────────────────────────── */

function listUsers() {
  const database = getDb();
  return database.prepare(`
    SELECT u."IdUsuario", u."Usuario", u."IdRol", u."Activo",
           u."NombreCompleto", u."FechaCreacion", r."NombreRol", u."ID_MESA"
    FROM "USUARIOS" u
    JOIN "CAT_ROLES" r ON u."IdRol" = r."IdRol"
    ORDER BY u."IdUsuario" ASC
  `).all().map((row) => ({
    IdUsuario: row.IdUsuario,
    Usuario: row.Usuario,
    NombreCompleto: row.NombreCompleto || '',
    IdRol: row.IdRol,
    Rol: normalizeRoleName(row.NombreRol),
    Activo: row.Activo === 'S',
    FechaCreacion: row.FechaCreacion || '',
    IdMesa: row.ID_MESA,
  }));
}

function createUser({ Usuario, Password, IdRol, NombreCompleto, IdMesa }) {
  const database = getDb();
  const existing = database.prepare('SELECT "IdUsuario" FROM "USUARIOS" WHERE "Usuario" = ?').get(Usuario);
  if (existing) {
    return { ok: false, error: 'El usuario ya existe' };
  }

  const now = new Date().toISOString().slice(0, 10);
  const hash = hashPassword(Password);
  const result = database.prepare(
    `INSERT INTO "USUARIOS" ("Usuario", "PasswordHash", "IdRol", "Activo", "NombreCompleto", "FechaCreacion", "ID_MESA")
     VALUES (?, ?, ?, 'S', ?, ?, ?)`
  ).run(Usuario, hash, IdRol || 3, NombreCompleto || '', now, IdMesa !== undefined ? IdMesa : null);

  return { ok: true, IdUsuario: Number(result.lastInsertRowid) };
}

function updateUser(IdUsuario, { IdRol, Activo, NombreCompleto, Password, IdMesa }) {
  const database = getDb();
  const setClauses = [];
  const values = [];
  const affectsSessionPermissions = IdRol !== undefined || Activo !== undefined;

  if (IdRol !== undefined) {
    setClauses.push('"IdRol" = ?');
    values.push(IdRol);
  }
  if (Activo !== undefined) {
    setClauses.push('"Activo" = ?');
    values.push(Activo ? 'S' : 'N');
  }
  if (NombreCompleto !== undefined) {
    setClauses.push('"NombreCompleto" = ?');
    values.push(NombreCompleto);
  }
  if (Password) {
    setClauses.push('"PasswordHash" = ?');
    values.push(hashPassword(Password));
  }
  if (IdMesa !== undefined) {
    setClauses.push('"ID_MESA" = ?');
    values.push(IdMesa);
  }

  if (setClauses.length === 0) return { ok: true };

  values.push(IdUsuario);
  database.prepare(
    `UPDATE "USUARIOS" SET ${setClauses.join(', ')} WHERE "IdUsuario" = ?`
  ).run(...values);

  if (affectsSessionPermissions) {
    bumpRolesRevision();
  }

  return { ok: true };
}

function deleteUser(IdUsuario) {
  const database = getDb();
  
  const user = database.prepare('SELECT "Usuario", "IdRol" FROM "USUARIOS" WHERE "IdUsuario" = ?').get(IdUsuario);
  if (!user) {
    return { ok: false, error: 'Usuario no encontrado' };
  }
  if (user.Usuario.toLowerCase() === 'jledezmar' || user.Usuario.toLowerCase() === 'admin') {
    return { ok: false, error: 'No se puede eliminar al administrador principal del sistema' };
  }

  database.prepare('DELETE FROM "USUARIOS" WHERE "IdUsuario" = ?').run(IdUsuario);
  bumpRolesRevision();
  return { ok: true };
}

function listRoles() {
  return getDb().prepare('SELECT "IdRol", "NombreRol" FROM "CAT_ROLES" ORDER BY "IdRol" ASC').all();
}

function listPermissions() {
  return getDb().prepare(`
    SELECT "IdPermiso", "NombrePermiso", "Categoria"
    FROM "CAT_PERMISOS"
    ORDER BY
      CASE "Categoria"
        WHEN 'VISTAS' THEN 1
        WHEN 'CUMPLIMIENTOS' THEN 2
        WHEN 'DIAS INHABILES' THEN 3
        WHEN 'MESAS DE TRAMITE' THEN 4
        WHEN 'TRABAJO DIARIO' THEN 5
        WHEN 'USUARIOS' THEN 6
        WHEN 'ROLES Y PERMISOS' THEN 7
        ELSE 99
      END,
      CASE "IdPermiso"
        WHEN 'view.cumplimientos' THEN 1
        WHEN 'view.procesar' THEN 2
        WHEN 'view.dias_inhabiles' THEN 3
        WHEN 'view.servidor' THEN 4
        WHEN 'view.usuarios' THEN 5
        WHEN 'view.roles' THEN 6
        WHEN 'view.mesas' THEN 7
        WHEN 'view.trabajo_diario' THEN 8
        WHEN 'cumplimientos.details' THEN 10
        WHEN 'cumplimientos.delete' THEN 11
        WHEN 'cumplimientos.edit' THEN 12
        WHEN 'cumplimientos.export' THEN 13
        WHEN 'cumplimientos.import' THEN 14
        WHEN 'cumplimientos.add' THEN 15
        WHEN 'cumplimientos.update_from_sentencias' THEN 16
        WHEN 'dias_inhabiles.add' THEN 20
        WHEN 'dias_inhabiles.import' THEN 21
        WHEN 'dias_inhabiles.edit' THEN 22
        WHEN 'dias_inhabiles.delete' THEN 23
        WHEN 'mesas.create' THEN 30
        WHEN 'mesas.edit' THEN 31
        WHEN 'mesas.delete' THEN 32
        WHEN 'mesas.import' THEN 33
        WHEN 'mesas.auto_assign' THEN 34
        WHEN 'mesas.reassign' THEN 35
        WHEN 'mesas.history' THEN 36
        WHEN 'trabajo.capture' THEN 40
        WHEN 'trabajo.edit_today' THEN 41
        WHEN 'trabajo.flush_history' THEN 42
        WHEN 'trabajo.history' THEN 43
        WHEN 'users.create' THEN 70
        WHEN 'users.edit' THEN 71
        WHEN 'users.delete' THEN 72
        WHEN 'roles.create' THEN 80
        WHEN 'roles.edit' THEN 81
        WHEN 'roles.delete' THEN 82
        ELSE 999
      END,
      "NombrePermiso" ASC
  `).all();
}

function getSessionUserById(IdUsuario) {
  const row = getDb().prepare(`
    SELECT u."IdUsuario", u."Usuario", u."IdRol", u."Activo",
           u."NombreCompleto", r."NombreRol", u."ID_MESA"
    FROM "USUARIOS" u
    JOIN "CAT_ROLES" r ON u."IdRol" = r."IdRol"
    WHERE u."IdUsuario" = ?
    LIMIT 1
  `).get(IdUsuario);

  if (!row || row.Activo !== 'S') {
    return null;
  }

  return {
    IdUsuario: row.IdUsuario,
    Usuario: row.Usuario,
    NombreCompleto: row.NombreCompleto || row.Usuario,
    IdRol: row.IdRol,
    Rol: normalizeRoleName(row.NombreRol),
    Permisos: getPermissionsForRole(row.IdRol),
    IdMesa: row.ID_MESA,
  };
}

function getRolesRevision() {
  const row = getDb()
    .prepare('SELECT "Valor" FROM "AUTH_META" WHERE "Clave" = ?')
    .get('roles_revision');
  const revision = Number(row?.Valor || 1);
  return Number.isFinite(revision) && revision > 0 ? revision : 1;
}

function bumpRolesRevision() {
  const nextRevision = getRolesRevision() + 1;
  getDb().prepare(`
    INSERT INTO "AUTH_META" ("Clave", "Valor") VALUES ('roles_revision', ?)
    ON CONFLICT("Clave") DO UPDATE SET "Valor" = excluded."Valor"
  `).run(String(nextRevision));
  return nextRevision;
}
function getPermissionsForRole(IdRol) {
  return getDb().prepare(`
    SELECT "IdPermiso"
    FROM "ROL_PERMISOS"
    WHERE "IdRol" = ?
    ORDER BY "IdPermiso" ASC
  `).all(IdRol).map((row) => row.IdPermiso);
}

function listRolesWithPermissions() {
  return listRoles().map((role) => ({
    ...role,
    Permisos: getPermissionsForRole(role.IdRol),
  }));
}

function createRole({ NombreRol, Permisos = [] }) {
  const database = getDb();
  const normalizedName = normalizeRoleName(NombreRol);
  if (!normalizedName) {
    return { ok: false, error: 'El nombre del rol es requerido' };
  }

  const existing = database
    .prepare('SELECT "IdRol" FROM "CAT_ROLES" WHERE "NombreRol" = ? COLLATE NOCASE')
    .get(normalizedName);
  if (existing) {
    return { ok: false, error: 'El rol ya existe' };
  }

  const result = database.prepare('INSERT INTO "CAT_ROLES" ("NombreRol") VALUES (?)').run(normalizedName);
  const IdRol = Number(result.lastInsertRowid);
  setRolePermissions(IdRol, Permisos);
  bumpRolesRevision();
  return { ok: true, IdRol };
}

function updateRole(IdRol, { NombreRol, Permisos }) {
  const database = getDb();
  const role = database.prepare('SELECT "IdRol" FROM "CAT_ROLES" WHERE "IdRol" = ?').get(IdRol);
  if (!role) {
    return { ok: false, error: 'Rol no encontrado' };
  }

  if (NombreRol !== undefined) {
    const normalizedName = normalizeRoleName(NombreRol);
    if (!normalizedName) {
      return { ok: false, error: 'El nombre del rol es requerido' };
    }
    const duplicate = database
      .prepare('SELECT "IdRol" FROM "CAT_ROLES" WHERE "NombreRol" = ? COLLATE NOCASE AND "IdRol" <> ?')
      .get(normalizedName, IdRol);
    if (duplicate) {
      return { ok: false, error: 'Ya existe otro rol con ese nombre' };
    }
    database.prepare('UPDATE "CAT_ROLES" SET "NombreRol" = ? WHERE "IdRol" = ?').run(normalizedName, IdRol);
  }

  if (Array.isArray(Permisos)) {
    setRolePermissions(IdRol, Permisos);
  }

  bumpRolesRevision();

  return { ok: true };
}

function setRolePermissions(IdRol, Permisos) {
  const database = getDb();
  const validPermissions = new Set(listPermissions().map((permission) => permission.IdPermiso));
  const uniquePermissions = [...new Set((Permisos || []).filter((permissionId) => validPermissions.has(permissionId)))];

  database.prepare('DELETE FROM "ROL_PERMISOS" WHERE "IdRol" = ?').run(IdRol);
  const insert = database.prepare('INSERT OR IGNORE INTO "ROL_PERMISOS" ("IdRol", "IdPermiso") VALUES (?, ?)');
  for (const permissionId of uniquePermissions) {
    insert.run(IdRol, permissionId);
  }
}

function deleteRole(IdRol) {
  const database = getDb();
  if (Number(IdRol) === 1) {
    return { ok: false, error: 'No se puede eliminar el rol ADMINISTRADOR principal' };
  }
  const usersWithRole = database.prepare('SELECT COUNT(*) AS cnt FROM "USUARIOS" WHERE "IdRol" = ?').get(IdRol);
  if (usersWithRole.cnt > 0) {
    return { ok: false, error: 'No se puede eliminar el rol porque tiene usuarios asignados' };
  }
  database.prepare('DELETE FROM "ROL_PERMISOS" WHERE "IdRol" = ?').run(IdRol);
  database.prepare('DELETE FROM "CAT_ROLES" WHERE "IdRol" = ?').run(IdRol);
  bumpRolesRevision();
  return { ok: true };
}

/* ────────────────────────────────────────────
 * Exports
 * ──────────────────────────────────────────── */

module.exports = {
  authenticateUser,
  authenticateUserWithRemember,
  createRole,
  createUser,
  clearRememberSession,
  getPermissionsForRole,
  getRolesRevision,
  getSessionUserById,
  hashPassword,
  initializeAuthTables,
  isAdmin,
  listPermissions,
  listRoles,
  listRolesWithPermissions,
  listUsers,
  normalizeRoleName,
  updateRole,
  deleteRole,
  updateUser,
  deleteUser,
  verifyRememberSession,
  verifyPassword,
};



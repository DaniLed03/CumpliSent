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
  { IdPermiso: 'view.dashboard', NombrePermiso: 'VER DASHBOARD', Categoria: 'VISTAS' },
  { IdPermiso: 'view.cumplimientos', NombrePermiso: 'VER CUMPLIMIENTOS', Categoria: 'VISTAS' },
  { IdPermiso: 'view.procesar', NombrePermiso: 'VER NORMALIZACION', Categoria: 'VISTAS' },
  { IdPermiso: 'view.dias_inhabiles', NombrePermiso: 'VER DIAS INHABILES', Categoria: 'VISTAS' },
  { IdPermiso: 'view.servidor', NombrePermiso: 'VER SERVIDOR', Categoria: 'ADMINISTRACION' },
  { IdPermiso: 'view.usuarios', NombrePermiso: 'VER USUARIOS', Categoria: 'ADMINISTRACION' },
  { IdPermiso: 'view.roles', NombrePermiso: 'VER ROLES Y PERMISOS', Categoria: 'ADMINISTRACION' },
  { IdPermiso: 'users.create', NombrePermiso: 'CREAR USUARIOS', Categoria: 'USUARIOS' },
  { IdPermiso: 'users.edit', NombrePermiso: 'EDITAR USUARIOS', Categoria: 'USUARIOS' },
  { IdPermiso: 'roles.create', NombrePermiso: 'CREAR ROLES', Categoria: 'ROLES' },
  { IdPermiso: 'roles.edit', NombrePermiso: 'EDITAR ROLES', Categoria: 'ROLES' },
  { IdPermiso: 'roles.permissions', NombrePermiso: 'ASIGNAR PERMISOS', Categoria: 'ROLES' },
  { IdPermiso: 'server.manage', NombrePermiso: 'ADMINISTRAR SERVIDOR', Categoria: 'SERVIDOR' },
  { IdPermiso: 'cumplimientos.add', NombrePermiso: 'AGREGAR CUMPLIMIENTOS', Categoria: 'CUMPLIMIENTOS' },
  { IdPermiso: 'cumplimientos.edit', NombrePermiso: 'EDITAR CUMPLIMIENTOS', Categoria: 'CUMPLIMIENTOS' },
  { IdPermiso: 'cumplimientos.import', NombrePermiso: 'IMPORTAR EXCEL', Categoria: 'CUMPLIMIENTOS' },
  { IdPermiso: 'cumplimientos.export', NombrePermiso: 'EXPORTAR EXCEL', Categoria: 'CUMPLIMIENTOS' },
  { IdPermiso: 'cumplimientos.recalculate', NombrePermiso: 'RECALCULAR CUMPLIMIENTOS', Categoria: 'CUMPLIMIENTOS' },
  { IdPermiso: 'dias_inhabiles.manage', NombrePermiso: 'ADMINISTRAR DIAS INHABILES', Categoria: 'DIAS INHABILES' },
];

const DEFAULT_ROLE_PERMISSIONS = {
  1: SYSTEM_PERMISSIONS.map((p) => p.IdPermiso),
  2: [
    'view.dashboard',
    'view.cumplimientos',
    'view.procesar',
    'view.dias_inhabiles',
    'cumplimientos.add',
    'cumplimientos.edit',
    'cumplimientos.import',
    'cumplimientos.export',
    'cumplimientos.recalculate',
    'dias_inhabiles.manage',
  ],
  3: [
    'view.dashboard',
    'view.cumplimientos',
    'view.procesar',
    'cumplimientos.add',
    'cumplimientos.edit',
    'cumplimientos.import',
    'cumplimientos.export',
    'cumplimientos.recalculate',
  ],
  4: [
    'view.dashboard',
    'view.cumplimientos',
    'cumplimientos.edit',
    'cumplimientos.export',
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

  ensureUserColumn(database, 'RecordarSesion', 'TEXT DEFAULT \'N\'');
  ensureUserColumn(database, 'RememberTokenHash', 'TEXT DEFAULT \'\'');
  ensureUserColumn(database, 'RememberTokenExpires', 'TEXT DEFAULT \'\'');
  ensureUserColumn(database, 'RememberMachineId', 'TEXT DEFAULT \'\'');

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
           r."NombreRol"
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
           u."NombreCompleto", r."NombreRol"
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
           u."NombreCompleto", u."FechaCreacion", r."NombreRol"
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
  }));
}

function createUser({ Usuario, Password, IdRol, NombreCompleto }) {
  const database = getDb();
  const existing = database.prepare('SELECT "IdUsuario" FROM "USUARIOS" WHERE "Usuario" = ?').get(Usuario);
  if (existing) {
    return { ok: false, error: 'El usuario ya existe' };
  }

  const now = new Date().toISOString().slice(0, 10);
  const hash = hashPassword(Password);
  const result = database.prepare(
    `INSERT INTO "USUARIOS" ("Usuario", "PasswordHash", "IdRol", "Activo", "NombreCompleto", "FechaCreacion")
     VALUES (?, ?, ?, 'S', ?, ?)`
  ).run(Usuario, hash, IdRol || 3, NombreCompleto || '', now);

  return { ok: true, IdUsuario: Number(result.lastInsertRowid) };
}

function updateUser(IdUsuario, { IdRol, Activo, NombreCompleto, Password }) {
  const database = getDb();
  const setClauses = [];
  const values = [];

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

  if (setClauses.length === 0) return { ok: true };

  values.push(IdUsuario);
  database.prepare(
    `UPDATE "USUARIOS" SET ${setClauses.join(', ')} WHERE "IdUsuario" = ?`
  ).run(...values);

  return { ok: true };
}

function listRoles() {
  return getDb().prepare('SELECT "IdRol", "NombreRol" FROM "CAT_ROLES" ORDER BY "IdRol" ASC').all();
}

function listPermissions() {
  return getDb().prepare(`
    SELECT "IdPermiso", "NombrePermiso", "Categoria"
    FROM "CAT_PERMISOS"
    ORDER BY "Categoria" ASC, "NombrePermiso" ASC
  `).all();
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
  hashPassword,
  initializeAuthTables,
  isAdmin,
  listPermissions,
  listRoles,
  listRolesWithPermissions,
  listUsers,
  normalizeRoleName,
  updateRole,
  updateUser,
  verifyRememberSession,
  verifyPassword,
};

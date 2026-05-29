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
  { IdPermiso: 'view.procesar', NombrePermiso: 'Procesar Excel', Categoria: 'VISTAS' },
  { IdPermiso: 'view.dias_inhabiles', NombrePermiso: 'Dias inhabiles', Categoria: 'VISTAS' },
  { IdPermiso: 'view.servidor', NombrePermiso: 'Servidor', Categoria: 'VISTAS' },
  { IdPermiso: 'view.usuarios', NombrePermiso: 'Usuarios', Categoria: 'VISTAS' },
  { IdPermiso: 'view.roles', NombrePermiso: 'Roles y permisos', Categoria: 'VISTAS' },
  { IdPermiso: 'users.create', NombrePermiso: 'Crear', Categoria: 'USUARIOS' },
  { IdPermiso: 'users.edit', NombrePermiso: 'Editar', Categoria: 'USUARIOS' },
  { IdPermiso: 'roles.create', NombrePermiso: 'Crear rol', Categoria: 'ROLES Y PERMISOS' },
  { IdPermiso: 'roles.edit', NombrePermiso: 'Editar rol', Categoria: 'ROLES Y PERMISOS' },
  { IdPermiso: 'roles.permissions', NombrePermiso: 'Permisos', Categoria: 'ROLES Y PERMISOS' },
  { IdPermiso: 'server.manage', NombrePermiso: 'Administrar', Categoria: 'SERVIDOR' },
  { IdPermiso: 'cumplimientos.add', NombrePermiso: 'Agregar', Categoria: 'CUMPLIMIENTOS' },
  { IdPermiso: 'cumplimientos.edit', NombrePermiso: 'Editar', Categoria: 'CUMPLIMIENTOS' },
  { IdPermiso: 'cumplimientos.import', NombrePermiso: 'Importar', Categoria: 'CUMPLIMIENTOS' },
  { IdPermiso: 'cumplimientos.export', NombrePermiso: 'Exportar', Categoria: 'CUMPLIMIENTOS' },
  { IdPermiso: 'cumplimientos.recalculate', NombrePermiso: 'Recalcular', Categoria: 'CUMPLIMIENTOS' },
  { IdPermiso: 'dias_inhabiles.manage', NombrePermiso: 'Administrar', Categoria: 'DIAS INHABILES' },
  
  // Mesas de trámite
  { IdPermiso: 'mesas.view', NombrePermiso: 'Ver mesas', Categoria: 'MESAS DE TRÁMITE' },
  { IdPermiso: 'mesas.manage', NombrePermiso: 'Administrar', Categoria: 'MESAS DE TRÁMITE' },
  { IdPermiso: 'mesas.import', NombrePermiso: 'Importar', Categoria: 'MESAS DE TRÁMITE' },
  { IdPermiso: 'mesas.auto_assign', NombrePermiso: 'Autoasignar', Categoria: 'MESAS DE TRÁMITE' },
  { IdPermiso: 'mesas.reassign', NombrePermiso: 'Reasignar', Categoria: 'MESAS DE TRÁMITE' },
  { IdPermiso: 'mesas.history', NombrePermiso: 'Historial', Categoria: 'MESAS DE TRÁMITE' },
  { IdPermiso: 'mesas.assign_users', NombrePermiso: 'Asignar usuarios', Categoria: 'MESAS DE TRÁMITE' },

  // Trabajo diario
  { IdPermiso: 'trabajo.view_my_mesa', NombrePermiso: 'Mi mesa', Categoria: 'TRABAJO DIARIO' },
  { IdPermiso: 'trabajo.view_all_mesas', NombrePermiso: 'Todas las mesas', Categoria: 'TRABAJO DIARIO' },
  { IdPermiso: 'trabajo.capture', NombrePermiso: 'Capturar', Categoria: 'TRABAJO DIARIO' },
  { IdPermiso: 'trabajo.edit_today', NombrePermiso: 'Editar dia', Categoria: 'TRABAJO DIARIO' },
  { IdPermiso: 'trabajo.history', NombrePermiso: 'Historial', Categoria: 'TRABAJO DIARIO' },
  { IdPermiso: 'trabajo.flush_history', NombrePermiso: 'Enviar historial', Categoria: 'TRABAJO DIARIO' },
];

const DEFAULT_ROLE_PERMISSIONS = {
  1: SYSTEM_PERMISSIONS.map((p) => p.IdPermiso),
  2: [
    'view.cumplimientos',
    'view.procesar',
    'view.dias_inhabiles',
    'cumplimientos.add',
    'cumplimientos.edit',
    'cumplimientos.import',
    'cumplimientos.export',
    'cumplimientos.recalculate',
    'dias_inhabiles.manage',
    'mesas.view',
    'trabajo.view_all_mesas',
    'trabajo.history',
  ],
  3: [
    'view.cumplimientos',
    'view.procesar',
    'cumplimientos.add',
    'cumplimientos.edit',
    'cumplimientos.import',
    'cumplimientos.export',
    'cumplimientos.recalculate',
    'mesas.view',
    'trabajo.view_all_mesas',
    'trabajo.history',
  ],
  4: [
    'view.cumplimientos',
    'cumplimientos.edit',
    'cumplimientos.export',
    'mesas.view',
    'trabajo.view_my_mesa',
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
  const legacyMesasPermissions = [
    'mesas.assignment_history',
    'mesas.import_assignment',
    'mesas.import_assignments',
    'trabajo.send_history',
    'trabajo.view_all',
    'trabajo.view_mine',
    'trabajo.view_own_mesa',
    'view.dashboard',
  ];

  for (const permissionId of legacyMesasPermissions) {
    database.prepare('DELETE FROM "ROL_PERMISOS" WHERE "IdPermiso" = ?').run(permissionId);
    database.prepare('DELETE FROM "CAT_PERMISOS" WHERE "IdPermiso" = ?').run(permissionId);
  }

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
        WHEN 'MESAS DE TRÁMITE' THEN 4
        WHEN 'TRABAJO DIARIO' THEN 5
        WHEN 'ADMINISTRACION' THEN 6
        WHEN 'SERVIDOR' THEN 7
        WHEN 'USUARIOS' THEN 8
        WHEN 'ROLES Y PERMISOS' THEN 9
        ELSE 99
      END,
      CASE "IdPermiso"
        WHEN 'view.cumplimientos' THEN 2
        WHEN 'view.procesar' THEN 3
        WHEN 'view.dias_inhabiles' THEN 4
        WHEN 'view.servidor' THEN 5
        WHEN 'view.usuarios' THEN 6
        WHEN 'view.roles' THEN 7
        WHEN 'cumplimientos.add' THEN 10
        WHEN 'cumplimientos.edit' THEN 11
        WHEN 'cumplimientos.import' THEN 12
        WHEN 'cumplimientos.export' THEN 13
        WHEN 'cumplimientos.recalculate' THEN 14
        WHEN 'mesas.view' THEN 30
        WHEN 'mesas.manage' THEN 31
        WHEN 'mesas.assign_users' THEN 32
        WHEN 'mesas.auto_assign' THEN 33
        WHEN 'mesas.import' THEN 34
        WHEN 'mesas.reassign' THEN 35
        WHEN 'mesas.history' THEN 36
        WHEN 'trabajo.capture' THEN 40
        WHEN 'trabajo.edit_today' THEN 41
        WHEN 'trabajo.flush_history' THEN 42
        WHEN 'trabajo.view_my_mesa' THEN 43
        WHEN 'trabajo.view_all_mesas' THEN 44
        WHEN 'trabajo.history' THEN 45
        WHEN 'server.manage' THEN 60
        WHEN 'users.create' THEN 70
        WHEN 'users.edit' THEN 71
        WHEN 'roles.create' THEN 80
        WHEN 'roles.edit' THEN 81
        WHEN 'roles.permissions' THEN 82
        ELSE 999
      END,
      "NombrePermiso" ASC
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

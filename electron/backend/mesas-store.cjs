const { app } = require('electron');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

function dataDir() {
  const dir = path.join(app.getPath('userData'), 'backend');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function databaseFile() {
  return path.join(dataDir(), 'sistema-control.sqlite');
}

let db;

function invalidateCumplimientosCache() {
  try {
    require('./store.cjs').invalidateCumplimientosCache();
  } catch {
    // Store may not be initialized yet.
  }
}

function getDb() {
  if (!db) {
    db = new DatabaseSync(databaseFile());
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA cache_size = -20000'); // 20MB cache
    db.exec('PRAGMA synchronous = NORMAL'); // Faster writes in WAL mode
    db.exec('PRAGMA temp_store = MEMORY'); // Keep temporary tables in memory
    db.exec('PRAGMA mmap_size = 30000000000'); // Memory-mapped I/O
  }
  return db;
}

function initializeMesasTables() {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS "MESAS_TRAMITE" (
      "ID_MESA" INTEGER PRIMARY KEY,
      "MESA" TEXT NOT NULL,
      "NOMBRE" TEXT DEFAULT '',
      "ACTIVO" INTEGER DEFAULT 1,
      "CREATED_AT" TEXT DEFAULT '',
      "UPDATED_AT" TEXT DEFAULT ''
    );
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS "HISTORIAL_ASIGNACION_MESAS" (
      "ID" INTEGER PRIMARY KEY AUTOINCREMENT,
      "EXPEDIENTE_ROWID" INTEGER,
      "EXPEDIENTE" TEXT NOT NULL,
      "ID_MESA_ANTERIOR" INTEGER,
      "ID_MESA_NUEVA" INTEGER NOT NULL,
      "USUARIO_ID" INTEGER,
      "USUARIO_NOMBRE" TEXT DEFAULT '',
      "MOTIVO" TEXT DEFAULT '',
      "FECHA_REASIGNACION" TEXT DEFAULT ''
    );
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS "HISTORIAL_TRABAJO_DIARIO" (
      "ID" INTEGER PRIMARY KEY AUTOINCREMENT,
      "EXPEDIENTE_ROWID" INTEGER,
      "EXPEDIENTE" TEXT NOT NULL,
      "ID_MESA" INTEGER,
      "MESA" TEXT DEFAULT '',
      "PERSONA_MESA" TEXT DEFAULT '',
      "USUARIO_ID" INTEGER NOT NULL,
      "USUARIO_NOMBRE" TEXT DEFAULT '',
      "ROL" TEXT DEFAULT '',
      "ESTATUS_ATENDIDO" TEXT DEFAULT '',
      "FECHA_ACUERDO" TEXT DEFAULT '',
      "OBSERVACIONES" TEXT DEFAULT '',
      "FECHA_CAPTURA" TEXT DEFAULT '',
      "FECHA_ENVIO_HISTORIAL" TEXT DEFAULT ''
    );
  `);

  ensureTableColumn(database, 'HISTORIAL_ASIGNACION_MESAS', 'EXPEDIENTE_ROWID', 'INTEGER');
  ensureTableColumn(database, 'HISTORIAL_TRABAJO_DIARIO', 'EXPEDIENTE_ROWID', 'INTEGER');
  ensureTableColumn(database, 'HISTORIAL_TRABAJO_DIARIO', 'PERSONA_MESA', 'TEXT DEFAULT \'\'');

  database.exec(`
    CREATE INDEX IF NOT EXISTS "IDX_HISTORIAL_ASIGNACION_MESAS_ID"
    ON "HISTORIAL_ASIGNACION_MESAS" ("ID" DESC);
  `);

  database.exec(`
    CREATE INDEX IF NOT EXISTS "IDX_HISTORIAL_ASIGNACION_MESAS_EXPEDIENTE"
    ON "HISTORIAL_ASIGNACION_MESAS" ("EXPEDIENTE");
  `);
}

function ensureTableColumn(database, tableName, columnName, definition) {
  const columns = database
    .prepare(`PRAGMA table_info("${tableName}")`)
    .all()
    .map((column) => column.name);

  if (!columns.includes(columnName)) {
    database.exec(`ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${definition}`);
  }
}

function ensureCumplimientosMesaColumns(database) {
  const columns = database
    .prepare('PRAGMA table_info("CUMPLIMIENTOS")')
    .all()
    .map((column) => column.name);

  if (columns.length > 0 && !columns.includes('OBSERVACIONES_MESA')) {
    database.exec('ALTER TABLE "CUMPLIMIENTOS" ADD COLUMN "OBSERVACIONES_MESA" TEXT');
  }
}

/* ────────────────────────────────────────────
 * Mesas CRUD
 * ──────────────────────────────────────────── */

function listMesas() {
  const database = getDb();
  return database.prepare(`SELECT * FROM "MESAS_TRAMITE" ORDER BY "ID_MESA" ASC`).all();
}

function listMesasActivas() {
  const database = getDb();
  return database.prepare(`SELECT * FROM "MESAS_TRAMITE" WHERE "ACTIVO" = 1 ORDER BY "ID_MESA" ASC`).all();
}

function getNextAvailableMesaId(database) {
  const rows = database.prepare('SELECT "ID_MESA" FROM "MESAS_TRAMITE" ORDER BY "ID_MESA" ASC').all();
  let nextId = 1;

  for (const row of rows) {
    const currentId = Number(row.ID_MESA);
    if (currentId === nextId) {
      nextId += 1;
    } else if (currentId > nextId) {
      break;
    }
  }

  return nextId;
}

function createMesa({ mesa, nombre }) {
  const database = getDb();
  const now = new Date().toISOString();
  const nextId = getNextAvailableMesaId(database);
  database.prepare(`
    INSERT INTO "MESAS_TRAMITE" ("ID_MESA", "MESA", "NOMBRE", "ACTIVO", "CREATED_AT", "UPDATED_AT")
    VALUES (?, ?, ?, 1, ?, ?)
  `).run(nextId, mesa, nombre || '', now, now);
  return { ok: true, idMesa: nextId };
}

function updateMesa(id, { mesa, nombre, activo }) {
  const database = getDb();
  const now = new Date().toISOString();
  database.prepare(`
    UPDATE "MESAS_TRAMITE"
    SET "MESA" = ?, "NOMBRE" = ?, "ACTIVO" = ?, "UPDATED_AT" = ?
    WHERE "ID_MESA" = ?
  `).run(mesa, nombre || '', activo ? 1 : 0, now, id);
  return { ok: true };
}

function deleteMesa(id) {
  const database = getDb();
  const mesaId = Number(id);
  if (!Number.isFinite(mesaId) || mesaId <= 0) {
    return { ok: false, error: 'ID de mesa invalido' };
  }

  database.exec('BEGIN');
  try {
    ensureCumplimientosMesaColumns(database);
    database.prepare('UPDATE "CUMPLIMIENTOS" SET "ID_MESA" = NULL WHERE "ID_MESA" = ?').run(mesaId);
    database.prepare(`DELETE FROM "HISTORIAL_ASIGNACION_MESAS" WHERE "ID_MESA_NUEVA" = ? OR "ID_MESA_ANTERIOR" = ?`).run(mesaId, mesaId);
    const result = database.prepare(`DELETE FROM "MESAS_TRAMITE" WHERE "ID_MESA" = ?`).run(mesaId);
	    database.exec('COMMIT');
	    invalidateCumplimientosCache();
	
	    if (result.changes === 0) {
      return { ok: false, error: 'La mesa no existe' };
    }
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  
  return { ok: true };
}

function importMesasCatalog(rows) {
  const database = getDb();
  const errors = [];
  let totalRead = 0;
  let totalCreated = 0;
  let totalUpdated = 0;

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      totalRead: 0,
      totalCreated: 0,
      totalUpdated: 0,
      totalErrors: 1,
      errors: [{
        fila: 'N/A',
        idMesa: 'N/A',
        mesa: 'N/A',
        motivo: 'El archivo Excel no contiene filas para importar.'
      }]
    };
  }

  const firstRow = rows.find((row) => row && Object.keys(row).length > 0) || {};
  const idMesaKey = findImportColumn(firstRow, ['ID_MESA', 'ID MESA', 'ID DE MESA', 'MESA ID']);
  const mesaKey = findImportColumn(firstRow, ['MESA', 'NOMBRE MESA', 'MESA TRAMITE', 'MESA DE TRAMITE']);
  const nombreKey = findImportColumn(firstRow, ['NOMBRE', 'ENCARGADO', 'RESPONSABLE', 'ENCARGADO NOMBRE']);
  const activoKey = findImportColumn(firstRow, ['ACTIVO', 'ESTADO', 'STATUS']);

  if (!mesaKey) {
    const detectedColumns = Object.keys(firstRow).join(', ') || 'ninguna';
    return {
      totalRead: rows.length,
      totalCreated: 0,
      totalUpdated: 0,
      totalErrors: 1,
      errors: [{
        fila: 'Encabezados',
        idMesa: 'N/A',
        mesa: 'N/A',
        motivo: `El archivo de mesas debe contener una columna MESA. Opcionales: ID_MESA, NOMBRE, ACTIVO. Encabezados detectados: ${detectedColumns}.`
      }]
    };
  }

  const now = new Date().toISOString();
  const findByIdStmt = database.prepare('SELECT "ID_MESA" FROM "MESAS_TRAMITE" WHERE "ID_MESA" = ?');
  const findByNameStmt = database.prepare('SELECT "ID_MESA" FROM "MESAS_TRAMITE" WHERE "MESA" = ? COLLATE NOCASE');
  const insertWithIdStmt = database.prepare(`
    INSERT INTO "MESAS_TRAMITE" ("ID_MESA", "MESA", "NOMBRE", "ACTIVO", "CREATED_AT", "UPDATED_AT")
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertAutoStmt = database.prepare(`
    INSERT INTO "MESAS_TRAMITE" ("ID_MESA", "MESA", "NOMBRE", "ACTIVO", "CREATED_AT", "UPDATED_AT")
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const updateStmt = database.prepare(`
    UPDATE "MESAS_TRAMITE"
    SET "MESA" = ?, "NOMBRE" = ?, "ACTIVO" = ?, "UPDATED_AT" = ?
    WHERE "ID_MESA" = ?
  `);

  database.exec('BEGIN');
  try {
    for (const rawRow of rows) {
      totalRead++;
      const idMesaRaw = idMesaKey ? String(rawRow[idMesaKey] || '').trim() : '';
      const mesa = String(rawRow[mesaKey] || '').trim();
      const nombre = nombreKey ? String(rawRow[nombreKey] || '').trim() : '';
      const activoRaw = activoKey ? String(rawRow[activoKey] || '').trim().toUpperCase() : '1';
      const activo = ['0', 'NO', 'N', 'INACTIVO', 'INACTIVA', 'FALSE'].includes(activoRaw) ? 0 : 1;

      if (!mesa) {
        errors.push({
          fila: totalRead,
          idMesa: idMesaRaw || 'N/A',
          mesa: 'N/A',
          motivo: 'La columna MESA está vacía.'
        });
        continue;
      }

      const idMesaVal = idMesaRaw ? parseInt(idMesaRaw, 10) : NaN;
      if (idMesaRaw && (isNaN(idMesaVal) || idMesaVal <= 0)) {
        errors.push({
          fila: totalRead,
          idMesa: idMesaRaw,
          mesa,
          motivo: `El ID_MESA "${idMesaRaw}" no es un número válido.`
        });
        continue;
      }

      const existing = idMesaRaw ? findByIdStmt.get(idMesaVal) : findByNameStmt.get(mesa);
      if (existing) {
        updateStmt.run(mesa, nombre, activo, now, existing.ID_MESA);
        totalUpdated++;
      } else if (idMesaRaw) {
        insertWithIdStmt.run(idMesaVal, mesa, nombre, activo, now, now);
        totalCreated++;
      } else {
        insertAutoStmt.run(getNextAvailableMesaId(database), mesa, nombre, activo, now, now);
        totalCreated++;
      }
    }

    database.exec('COMMIT');
  } catch (err) {
    database.exec('ROLLBACK');
    throw err;
  }

  return {
    totalRead,
    totalCreated,
    totalUpdated,
    totalErrors: errors.length,
    errors
  };
}

function getMesaById(id) {
  const database = getDb();
  return database.prepare(`SELECT * FROM "MESAS_TRAMITE" WHERE "ID_MESA" = ?`).get(id);
}

/* ────────────────────────────────────────────
 * Assignments
 * ──────────────────────────────────────────── */

function reassignMesa({ expedienteRowid, expediente, newMesaId, userId, userName, motivo }) {
  const database = getDb();
  ensureCumplimientosMesaColumns(database);
  let row = database.prepare('SELECT rowid, "NÚMERO DE JUICIO" AS expediente, "ID_MESA" AS idMesa FROM "CUMPLIMIENTOS" WHERE rowid = ?').get(expedienteRowid);
  if (!row && expediente) {
    row = database.prepare('SELECT rowid, "NÚMERO DE JUICIO" AS expediente, "ID_MESA" AS idMesa FROM "CUMPLIMIENTOS" WHERE "NÚMERO DE JUICIO" = ? COLLATE NOCASE').get(String(expediente).trim());
  }
  if (!row) {
    return { ok: false, error: 'Expediente no encontrado' };
  }
  const oldMesaId = row.idMesa;
  const cleanMotivo = String(motivo || '').trim();
  const now = new Date().toISOString();

  const updateResult = database.prepare('UPDATE "CUMPLIMIENTOS" SET "ID_MESA" = ?, "OBSERVACIONES_MESA" = ? WHERE rowid = ?').run(newMesaId, cleanMotivo, row.rowid);
  if (updateResult.changes !== 1) {
    return { ok: false, error: 'No se pudo actualizar la mesa del expediente.' };
  }

  database.prepare(`
    INSERT INTO "HISTORIAL_ASIGNACION_MESAS" (
      "EXPEDIENTE_ROWID", "EXPEDIENTE", "ID_MESA_ANTERIOR", "ID_MESA_NUEVA",
      "USUARIO_ID", "USUARIO_NOMBRE", "MOTIVO", "FECHA_REASIGNACION"
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(row.rowid, row.expediente, oldMesaId, newMesaId, userId, userName, cleanMotivo, now);
  invalidateCumplimientosCache();

  return {
    ok: true,
    expedienteRowid: row.rowid,
    expediente: row.expediente,
    oldMesaId,
    newMesaId,
    motivo: cleanMotivo,
  };
}

function getAssignmentHistory(filters = {}) {
  const database = getDb();
  const limit = Math.min(Math.max(Number(filters.limit) || 100, 1), 500);
  const offset = Math.max(Number(filters.offset) || 0, 0);
  const clauses = [];
  const values = [];

  if (filters.todayOnly !== false) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    clauses.push('h.FECHA_REASIGNACION >= ? AND h.FECHA_REASIGNACION < ?');
    values.push(start.toISOString(), end.toISOString());
  }

  if (filters.expediente) {
    clauses.push('h.EXPEDIENTE LIKE ?');
    values.push(`%${filters.expediente}%`);
  }

  const whereSql = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
  let sql = `
    SELECT h.*, m1.MESA AS MESA_ANTERIOR_NOMBRE, m2.MESA AS MESA_NUEVA_NOMBRE
    FROM "HISTORIAL_ASIGNACION_MESAS" h
    LEFT JOIN "MESAS_TRAMITE" m1 ON h.ID_MESA_ANTERIOR = m1.ID_MESA
    LEFT JOIN "MESAS_TRAMITE" m2 ON h.ID_MESA_NUEVA = m2.ID_MESA
    ${whereSql}
    ORDER BY h.ID DESC
    LIMIT ? OFFSET ?
  `;
  const countSql = `
    SELECT COUNT(*) AS total
    FROM "HISTORIAL_ASIGNACION_MESAS" h
    ${whereSql}
  `;

  const total = database.prepare(countSql).get(...values).total || 0;
  const rows = database.prepare(sql).all(...values, limit, offset).map(row => ({
    id: row.ID,
    expedienteRowid: row.EXPEDIENTE_ROWID,
    expediente: row.EXPEDIENTE,
    idMesaAnterior: row.ID_MESA_ANTERIOR,
    mesaAnteriorNombre: row.MESA_ANTERIOR_NOMBRE || 'Ninguna',
    idMesaNueva: row.ID_MESA_NUEVA,
    mesaNuevaNombre: row.MESA_NUEVA_NOMBRE || 'Desconocida',
    usuarioId: row.USUARIO_ID,
    usuarioNombre: row.USUARIO_NOMBRE || 'Sistema',
    motivo: row.MOTIVO || '',
    fechaReasignacion: row.FECHA_REASIGNACION || '',
  }));

  return {
    rows,
    total,
    limit,
    offset,
    hasMore: offset + rows.length < total,
  };
}

function normalizeImportHeader(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

function findImportColumn(row, aliases) {
  const normalizedAliases = new Set(aliases.map(normalizeImportHeader));
  return Object.keys(row || {}).find((key) => normalizedAliases.has(normalizeImportHeader(key)));
}

function importMesaAssignments(rows) {
  const database = getDb();
  let totalRead = 0;
  let totalUpdated = 0;
  let totalErrors = 0;
  const errors = [];

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      totalRead: 0,
      totalUpdated: 0,
      totalErrors: 1,
      errors: [{
        fila: 'N/A',
        expediente: 'N/A',
        idMesa: 'N/A',
        motivo: 'El archivo Excel no contiene filas para importar.'
      }]
    };
  }

  const firstRow = rows.find((row) => row && Object.keys(row).length > 0) || {};
  const expedienteKey = findImportColumn(firstRow, [
    'EXPEDIENTE',
    'NUMERO DE JUICIO',
    'NÚMERO DE JUICIO',
    'NO. DE JUICIO',
    'NO DE JUICIO',
    'JUICIO',
    'EXPEDIENTE / JUICIO',
  ]);
  const oficialKey = findImportColumn(firstRow, [
    'OFICIAL',
    'OFICIALIA',
    'OFICIALÍA',
    'ACTUARIO',
    'RESPONSABLE',
    'ENCARGADO',
  ]);
  const idMesaKey = findImportColumn(firstRow, [
    'ID_MESA',
    'ID MESA',
    'MESA ID',
    'ID DE MESA',
    'MESA',
  ]);

  if (!expedienteKey || (!idMesaKey && !oficialKey)) {
    const detectedColumns = Object.keys(firstRow).join(', ') || 'ninguna';
    return {
      totalRead: rows.length,
      totalUpdated: 0,
      totalErrors: 1,
      errors: [{
        fila: 'Encabezados',
        expediente: 'N/A',
        idMesa: 'N/A',
        motivo: `El archivo debe contener EXPEDIENTE y una columna de mesa/oficial: OFICIAL o ID_MESA. Encabezados detectados: ${detectedColumns}.`
      }]
    };
  }

  const mesas = database.prepare('SELECT "ID_MESA", "MESA" FROM "MESAS_TRAMITE"').all();
  const mesaIds = new Set(mesas.map(m => m.ID_MESA));
  const mesaNames = new Map(mesas.map(m => [normalizeImportHeader(m.MESA), m.ID_MESA]));

  const now = new Date().toISOString();
  const insertMesaStmt = database.prepare(`
    INSERT OR IGNORE INTO "MESAS_TRAMITE" ("ID_MESA", "MESA", "NOMBRE", "ACTIVO", "CREATED_AT", "UPDATED_AT")
    VALUES (?, ?, '', 1, ?, ?)
  `);
  const findMesaByNameStmt = database.prepare('SELECT "ID_MESA" FROM "MESAS_TRAMITE" WHERE "MESA" = ? COLLATE NOCASE');
  const insertMesaByNameStmt = database.prepare(`
    INSERT INTO "MESAS_TRAMITE" ("MESA", "NOMBRE", "ACTIVO", "CREATED_AT", "UPDATED_AT")
    VALUES (?, ?, 1, ?, ?)
  `);
  const importedNumericMesaIds = new Set();

  for (const rawRow of rows) {
    const idMesaVal = idMesaKey ? parseInt(String(rawRow[idMesaKey] || '').trim(), 10) : NaN;
    if (!isNaN(idMesaVal) && idMesaVal > 0) {
      importedNumericMesaIds.add(idMesaVal);
    }
  }

  for (const idMesaVal of importedNumericMesaIds) {
    if (!mesaIds.has(idMesaVal)) {
      insertMesaStmt.run(idMesaVal, `MESA ${idMesaVal}`, now, now);
      mesaIds.add(idMesaVal);
      mesaNames.set(normalizeImportHeader(`MESA ${idMesaVal}`), idMesaVal);
    }
  }

  function ensureMesaByName(mesaName) {
    const cleanName = String(mesaName || '').trim();
    if (!cleanName) return NaN;

    const normalizedName = normalizeImportHeader(cleanName);
    const knownId = mesaNames.get(normalizedName);
    if (knownId) return knownId;

    const existing = findMesaByNameStmt.get(cleanName);
    if (existing) {
      mesaIds.add(existing.ID_MESA);
      mesaNames.set(normalizedName, existing.ID_MESA);
      return existing.ID_MESA;
    }

    insertMesaByNameStmt.run(cleanName, cleanName, now, now);
    const created = findMesaByNameStmt.get(cleanName);
    if (!created) return NaN;

    mesaIds.add(created.ID_MESA);
    mesaNames.set(normalizedName, created.ID_MESA);
    return created.ID_MESA;
  }

  const findExpStmt = database.prepare('SELECT rowid, "NÚMERO DE JUICIO" AS expediente, "ID_MESA" AS idMesa FROM "CUMPLIMIENTOS" WHERE "NÚMERO DE JUICIO" = ? COLLATE NOCASE');
  const updateStmt = database.prepare('UPDATE "CUMPLIMIENTOS" SET "ID_MESA" = ? WHERE rowid = ?');

  const insertHistoryStmt = database.prepare(`
    INSERT INTO "HISTORIAL_ASIGNACION_MESAS" (
      "EXPEDIENTE_ROWID", "EXPEDIENTE", "ID_MESA_ANTERIOR", "ID_MESA_NUEVA",
      "USUARIO_ID", "USUARIO_NOMBRE", "MOTIVO", "FECHA_REASIGNACION"
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  database.exec('BEGIN');
  try {
    for (const rawRow of rows) {
      totalRead++;
      const expediente = String(rawRow[expedienteKey] || '').trim();
      const oficial = oficialKey ? String(rawRow[oficialKey] || '').trim() : '';
      const idMesaStr = idMesaKey ? String(rawRow[idMesaKey] || '').trim() : '';
      let idMesaVal = parseInt(idMesaStr, 10);

      if (!expediente) {
        totalErrors++;
        errors.push({
          fila: totalRead,
          expediente: '',
          idMesa: idMesaStr,
          motivo: 'El número de expediente está vacío.'
        });
        continue;
      }

      if (isNaN(idMesaVal) && idMesaStr) {
        idMesaVal = mesaNames.get(normalizeImportHeader(idMesaStr));
      }

      if (isNaN(idMesaVal) && oficial) {
        idMesaVal = ensureMesaByName(oficial);
      }

      if (isNaN(idMesaVal)) {
        totalErrors++;
        errors.push({
          fila: totalRead,
          expediente,
          idMesa: idMesaStr || oficial || 'N/A',
          motivo: 'La fila no tiene ID_MESA ni OFICIAL válido para asignar mesa.'
        });
        continue;
      }

      if (!mesaIds.has(idMesaVal)) {
        totalErrors++;
        errors.push({
          fila: totalRead,
          expediente,
          idMesa: idMesaVal,
          motivo: `El ID_MESA ${idMesaVal} no existe en el catálogo de mesas.`
        });
        continue;
      }

      const expRow = findExpStmt.get(expediente);
      if (!expRow) {
        totalErrors++;
        errors.push({
          fila: totalRead,
          expediente,
          idMesa: idMesaVal,
          motivo: `El expediente "${expediente}" no existe en el sistema.`
        });
        continue;
      }

      updateStmt.run(idMesaVal, expRow.rowid);
      insertHistoryStmt.run(expRow.rowid, expRow.expediente, expRow.idMesa, idMesaVal, null, 'Importación Excel', 'Importación masiva', now);
      totalUpdated++;
	    }
	    database.exec('COMMIT');
	    if (totalUpdated > 0) invalidateCumplimientosCache();
	  } catch (err) {
    database.exec('ROLLBACK');
    throw err;
  }

  return {
    totalRead,
    totalUpdated,
    totalErrors,
    errors
  };
}

function autoAssignMesas(userId, userName) {
  const database = getDb();
  const activeMesas = database.prepare('SELECT "ID_MESA", "MESA" FROM "MESAS_TRAMITE" WHERE "ACTIVO" = 1 ORDER BY "ID_MESA" ASC').all();
  if (activeMesas.length === 0) {
    return { ok: false, error: 'No hay mesas de trámite activas para realizar la asignación.' };
  }

  const sinMateriaColumn = `"SE DECLAR${String.fromCharCode(211)} SIN MATERIA"`;
  const aliveCondition = `
    ("FECHA DE CUMPLIMIENTO" IS NULL OR "FECHA DE CUMPLIMIENTO" = '')
    AND (${sinMateriaColumn} IS NULL OR ${sinMateriaColumn} = '')
  `;
  const unassignedCondition = `("ID_MESA" IS NULL OR TRIM(CAST("ID_MESA" AS TEXT)) = '')`;
  const semaphoreOnCondition = `
    (
      UPPER(TRIM(COALESCE("ESTATUS", ''))) IN ('REQUERIR', 'VENCIDO', 'CERRADO')
      OR (
        TRIM(COALESCE("ESTATUS", '')) GLOB '[0-9]*'
        AND CAST("ESTATUS" AS REAL) >= 7
      )
    )
  `;
  const hasVistaCondition = `
    (
      ("FECHA DE VISTA" IS NOT NULL AND TRIM("FECHA DE VISTA") <> '')
      OR ("FECHA VISTA CUMPLI" IS NOT NULL AND TRIM("FECHA VISTA CUMPLI") <> '')
    )
  `;
  const numeroOrdenColumn = `"N${String.fromCharCode(218)}MERO DE ORDEN"`;
  const orderSql = `ORDER BY COALESCE(${numeroOrdenColumn}, rowid) ASC, rowid ASC`;

  // La carga inicial cuenta solo expedientes vivos asignados a mesas activas.
  const counts = database.prepare(`
    SELECT "ID_MESA", COUNT(*) AS cnt 
    FROM "CUMPLIMIENTOS" 
    WHERE ${aliveCondition}
      AND "ID_MESA" IS NOT NULL
      AND "ID_MESA" IN (${activeMesas.map(() => '?').join(',')})
    GROUP BY "ID_MESA"
  `).all(...activeMesas.map((mesa) => mesa.ID_MESA));

  const loadMap = {};
  activeMesas.forEach(m => {
    loadMap[m.ID_MESA] = 0;
  });
  counts.forEach(c => {
    if (loadMap[c.ID_MESA] !== undefined) {
      loadMap[c.ID_MESA] = c.cnt;
    }
  });

  const requiringUnassigned = database.prepare(`
    SELECT rowid, "NÚMERO DE JUICIO" AS expediente 
    FROM "CUMPLIMIENTOS" 
    WHERE ${aliveCondition}
      AND ${unassignedCondition}
      AND ${semaphoreOnCondition}
    ${orderSql}
  `).all();

  const vistaUnassigned = database.prepare(`
    SELECT rowid, "NÚMERO DE JUICIO" AS expediente
    FROM "CUMPLIMIENTOS"
    WHERE ${aliveCondition}
      AND ${unassignedCondition}
      AND ${hasVistaCondition}
      AND NOT ${semaphoreOnCondition}
    ${orderSql}
  `).all();

  const otherUnassigned = database.prepare(`
    SELECT rowid, "NÚMERO DE JUICIO" AS expediente
    FROM "CUMPLIMIENTOS"
    WHERE ${aliveCondition}
      AND ${unassignedCondition}
      AND NOT ${semaphoreOnCondition}
      AND NOT ${hasVistaCondition}
    ${orderSql}
  `).all();

  if (requiringUnassigned.length === 0 && vistaUnassigned.length === 0 && otherUnassigned.length === 0) {
    return {
      ok: true,
      assignedCount: 0,
      requiringAssignedCount: 0,
      vistaAssignedCount: 0,
      otherAssignedCount: 0,
      message: 'No hay expedientes activos sin mesa para asignar en los procesos automáticos.'
    };
  }

  const now = new Date().toISOString();
  const updateStmt = database.prepare('UPDATE "CUMPLIMIENTOS" SET "ID_MESA" = ? WHERE rowid = ?');
  const insertHistoryStmt = database.prepare(`
    INSERT INTO "HISTORIAL_ASIGNACION_MESAS" (
      "EXPEDIENTE_ROWID", "EXPEDIENTE", "ID_MESA_ANTERIOR", "ID_MESA_NUEVA",
      "USUARIO_ID", "USUARIO_NOMBRE", "MOTIVO", "FECHA_REASIGNACION"
    ) VALUES (?, ?, NULL, ?, ?, ?, 'Asignación automática equitativa', ?)
  `);

  let assignedCount = 0;
  let requiringAssignedCount = 0;
  let vistaAssignedCount = 0;
  let otherAssignedCount = 0;

  const assignBatch = (rows) => {
    let batchAssignedCount = 0;

    for (const exp of rows) {
      let minMesaId = null;
      let minLoad = Infinity;

      for (const mesa of activeMesas) {
        const load = loadMap[mesa.ID_MESA];
        if (load < minLoad) {
          minLoad = load;
          minMesaId = mesa.ID_MESA;
        }
      }

      if (minMesaId === null) {
        break;
      }

      updateStmt.run(minMesaId, exp.rowid);
      insertHistoryStmt.run(exp.rowid, exp.expediente, minMesaId, userId, userName, now);

      loadMap[minMesaId]++;
      assignedCount++;
      batchAssignedCount++;
    }

    return batchAssignedCount;
  };

  database.exec('BEGIN');
  try {
    requiringAssignedCount = assignBatch(requiringUnassigned);
    vistaAssignedCount = assignBatch(vistaUnassigned);
	    otherAssignedCount = assignBatch(otherUnassigned);
	    database.exec('COMMIT');
	    if (assignedCount > 0) invalidateCumplimientosCache();
	  } catch (err) {
    database.exec('ROLLBACK');
    throw err;
  }

  return { ok: true, assignedCount, requiringAssignedCount, vistaAssignedCount, otherAssignedCount };
}

/* ────────────────────────────────────────────
 * Daily Work
 * ──────────────────────────────────────────── */

function hasActiveRequerimientoStatus(expediente) {
  const estatus = String(expediente?.estatus || '').trim();
  const numericStatus = Number(estatus);
  if (estatus && Number.isFinite(numericStatus)) return true;

  return ['EN_PLAZO', 'ATENCION', 'REQUERIR', 'VENCIDO', 'CERRADO'].includes(estatus);
}

function deriveTrabajoDiarioStatus(expediente, fechaAcuerdoIso) {
  const { toIsoDate } = require('./cumplimientos.cjs');
  const ultimoRequerimiento = toIsoDate(expediente?.ultimoRequerimiento || '');

  if (hasActiveRequerimientoStatus(expediente)) {
    return ultimoRequerimiento && fechaAcuerdoIso && ultimoRequerimiento === fechaAcuerdoIso
      ? 'ATENDIDA'
      : 'SIN ATENDER';
  }

  const fechaVista = toIsoDate(expediente?.fechaVista || '');
  if (fechaVista) {
    const fechasPronunciamiento = [
      expediente?.fechaCumplimiento,
      expediente?.fechaPorNoCumplida,
      expediente?.seDeclaroSinMateria,
    ].map((value) => toIsoDate(value || ''));

    return fechaAcuerdoIso && fechasPronunciamiento.some((value) => value && value === fechaAcuerdoIso)
      ? 'ATENDIDA'
      : 'SIN ATENDER';
  }

  return 'SIN ATENDER';
}

function captureTrabajoDiario({ expedienteRowid, fechaAcuerdo, observaciones, userId, userName }) {
  const database = getDb();
  const now = new Date().toISOString();
  const { toIsoDate } = require('./cumplimientos.cjs');
  const { getCumplimientos } = require('./store.cjs');
  const expediente = getCumplimientos().find((row) => Number(row.id) === Number(expedienteRowid));
  const fechaAcuerdoIso = toIsoDate(fechaAcuerdo || '');
  const estatusAtendido = deriveTrabajoDiarioStatus(expediente, fechaAcuerdoIso);

  database.prepare(`
    UPDATE "CUMPLIMIENTOS"
    SET "ESTATUS_ATENDIDO" = ?,
        "FECHA_ACUERDO" = ?,
        "OBSERVACIONES_DIARIO" = ?,
        "FECHA_CAPTURA_TRABAJO" = ?,
        "USUARIO_CAPTURA_TRABAJO" = ?
    WHERE rowid = ?
	  `).run(estatusAtendido, fechaAcuerdoIso, observaciones, now, userId, expedienteRowid);
	  invalidateCumplimientosCache();
	  return { ok: true };
}

function shouldShowInTrabajoDiario(row) {
  const cumplimiento = String(row.fechaCumplimiento || '').trim();
  return !cumplimiento;
}

function getExpedientesByMesa(mesaId) {
  const { getCumplimientosTrabajoDiario } = require('./store.cjs');
  return getCumplimientosTrabajoDiario(mesaId).filter(shouldShowInTrabajoDiario);
}

function getExpedientesAllMesas() {
  const { getCumplimientosTrabajoDiario } = require('./store.cjs');
  return getCumplimientosTrabajoDiario().filter(shouldShowInTrabajoDiario);
}

function getHistorialTrabajoDiario(filters = {}) {
  const database = getDb();
  
  // 1. Fetch from HISTORIAL
  let sql1 = `
    SELECT h.*, m.MESA AS MESA_NOMBRE, m.NOMBRE AS PERSONA_MESA_ACTUAL
    FROM "HISTORIAL_TRABAJO_DIARIO" h
    LEFT JOIN "MESAS_TRAMITE" m ON h.ID_MESA = m.ID_MESA
  `;
  const values1 = [];
  const clauses1 = [];
  if (filters.expediente) {
    clauses1.push('h.EXPEDIENTE LIKE ?');
    values1.push(`%${filters.expediente}%`);
  }
  if (filters.mesaId) {
    clauses1.push('h.ID_MESA = ?');
    values1.push(filters.mesaId);
  }
  if (clauses1.length > 0) {
    sql1 += ' WHERE ' + clauses1.join(' AND ');
  }
  
  const historyRows = database.prepare(sql1).all(...values1).map(row => ({
    id: 'H_' + row.ID,
    expedienteRowid: row.EXPEDIENTE_ROWID,
    expediente: row.EXPEDIENTE,
    idMesa: row.ID_MESA,
    mesaNombre: row.MESA_NOMBRE || row.MESA || 'Desconocida',
    personaMesa: row.PERSONA_MESA || row.PERSONA_MESA_ACTUAL || '',
    usuarioId: row.USUARIO_ID,
    usuarioNombre: row.USUARIO_NOMBRE || 'Sistema',
    rol: row.ROL || '',
    estatusAtendido: row.ESTATUS_ATENDIDO || '',
    fechaAcuerdo: row.FECHA_ACUERDO || '',
    observaciones: row.OBSERVACIONES || '',
    fechaCaptura: row.FECHA_CAPTURA || '',
    fechaEnvioHistorial: row.FECHA_ENVIO_HISTORIAL || '',
  }));

  // 2. Fetch active from CUMPLIMIENTOS
  let sql2 = `
    SELECT 
      c.rowid AS EXPEDIENTE_ROWID,
      c."NÚMERO DE JUICIO" AS EXPEDIENTE,
      c.ID_MESA,
      m.MESA AS MESA_NOMBRE,
      m.NOMBRE AS PERSONA_MESA,
      c.USUARIO_CAPTURA_TRABAJO AS USUARIO_ID,
      u."NombreCompleto" AS USUARIO_NOMBRE,
      r."NombreRol" AS ROL,
      c.ESTATUS_ATENDIDO,
      c.FECHA_ACUERDO,
      c.OBSERVACIONES_DIARIO AS OBSERVACIONES,
      c.FECHA_CAPTURA_TRABAJO AS FECHA_CAPTURA
    FROM "CUMPLIMIENTOS" c
    LEFT JOIN "MESAS_TRAMITE" m ON c.ID_MESA = m.ID_MESA
    LEFT JOIN "USUARIOS" u ON c.USUARIO_CAPTURA_TRABAJO = u."IdUsuario"
    LEFT JOIN "CAT_ROLES" r ON u."IdRol" = r."IdRol"
    WHERE ((c.ESTATUS_ATENDIDO IS NOT NULL AND c.ESTATUS_ATENDIDO <> '')
       OR (c.FECHA_ACUERDO IS NOT NULL AND c.FECHA_ACUERDO <> '')
       OR (c.OBSERVACIONES_DIARIO IS NOT NULL AND c.OBSERVACIONES_DIARIO <> ''))
  `;
  const values2 = [];
  if (filters.expediente) {
    sql2 += ' AND c."NÚMERO DE JUICIO" LIKE ?';
    values2.push(`%${filters.expediente}%`);
  }
  if (filters.mesaId) {
    sql2 += ' AND c.ID_MESA = ?';
    values2.push(filters.mesaId);
  }

  const activeRows = database.prepare(sql2).all(...values2).map(row => ({
    id: 'C_' + row.EXPEDIENTE_ROWID,
    expedienteRowid: row.EXPEDIENTE_ROWID,
    expediente: row.EXPEDIENTE,
    idMesa: row.ID_MESA,
    mesaNombre: row.MESA_NOMBRE || 'Desconocida',
    personaMesa: row.PERSONA_MESA || '',
    usuarioId: row.USUARIO_ID,
    usuarioNombre: row.USUARIO_NOMBRE || 'Sistema',
    rol: row.ROL || '',
    estatusAtendido: row.ESTATUS_ATENDIDO || '',
    fechaAcuerdo: row.FECHA_ACUERDO || '',
    observaciones: row.OBSERVACIONES || '',
    fechaCaptura: row.FECHA_CAPTURA || '',
    fechaEnvioHistorial: 'Pendiente',
  }));

  const combined = [...activeRows, ...historyRows];
  
  // Sort by fechaCaptura DESC
  combined.sort((a, b) => {
    const da = new Date(a.fechaCaptura || 0).getTime();
    const db = new Date(b.fechaCaptura || 0).getTime();
    return db - da;
  });

  return combined;
}

function getBusinessDaysElapsed(startDateStr, endDate, inhabilesSet) {
  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return 0;

  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  if (startUtc >= endUtc) {
    return 0;
  }

  const totalDays = Math.floor((endUtc - startUtc) / 86400000);
  if (totalDays <= 0) return 0;

  const firstDayMs = startUtc + 86400000;
  const startDay = new Date(firstDayMs).getUTCDay();

  const fullWeeks = Math.floor(totalDays / 7);
  let weekendDays = fullWeeks * 2;
  const remainingDays = totalDays % 7;
  for (let i = 0; i < remainingDays; i++) {
    const day = (startDay + i) % 7;
    if (day === 0 || day === 6) {
      weekendDays += 1;
    }
  }

  let count = totalDays - weekendDays;

  for (const holiday of inhabilesSet) {
    if (!holiday) continue;
    const [y, m, d] = holiday.split('-').map(Number);
    const hUtc = Date.UTC(y, m - 1, d);
    if (hUtc > startUtc && hUtc <= endUtc) {
      const day = new Date(hUtc).getUTCDay();
      if (day !== 0 && day !== 6) {
        count -= 1;
      }
    }
  }

  return Math.max(0, count);
}

function flushTrabajoDiarioToHistory() {
  const database = getDb();
  const now = new Date();

  // Load holidays
  const inhabiles = database.prepare(`SELECT "DIAS INHABILES" AS fecha FROM "DIAS INHABILES"`).all();
  const inhabilesSet = new Set();
  inhabiles.forEach(row => {
    let fecha = row.fecha;
    if (fecha && typeof fecha === 'string') {
      const match = fecha.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
      if (match) {
        fecha = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
      }
    }
    if (fecha) inhabilesSet.add(fecha);
  });

  const rows = database.prepare(`
    SELECT rowid, * 
    FROM "CUMPLIMIENTOS" 
    WHERE ("ESTATUS_ATENDIDO" IS NOT NULL AND "ESTATUS_ATENDIDO" <> '')
       OR ("FECHA_ACUERDO" IS NOT NULL AND "FECHA_ACUERDO" <> '')
       OR ("OBSERVACIONES_DIARIO" IS NOT NULL AND "OBSERVACIONES_DIARIO" <> '')
  `).all();

  let processed = 0;
  let touchedCumplimientos = false;
  const logs = [];

  database.exec('BEGIN');
  try {
    for (const row of rows) {
      const fechaCaptura = row.FECHA_CAPTURA_TRABAJO;
      if (!fechaCaptura) {
        database.prepare('UPDATE "CUMPLIMIENTOS" SET "FECHA_CAPTURA_TRABAJO" = ? WHERE rowid = ?')
          .run(now.toISOString(), row.rowid);
        touchedCumplimientos = true;
        continue;
      }

      const elapsed = getBusinessDaysElapsed(fechaCaptura, now, inhabilesSet);
      if (elapsed > 3) {
        let mesaNombre = '';
        let personaMesa = '';
        if (row.ID_MESA) {
          const mRow = database.prepare('SELECT "MESA", "NOMBRE" FROM "MESAS_TRAMITE" WHERE "ID_MESA" = ?').get(row.ID_MESA);
          if (mRow) {
            mesaNombre = mRow.MESA;
            personaMesa = mRow.NOMBRE || '';
          }
        }

        let usuarioNombre = '';
        let rolNombre = '';
        if (row.USUARIO_CAPTURA_TRABAJO) {
          const uRow = database.prepare(`
            SELECT u."NombreCompleto", u."Usuario", r."NombreRol" 
            FROM "USUARIOS" u
            LEFT JOIN "CAT_ROLES" r ON u."IdRol" = r."IdRol"
            WHERE u."IdUsuario" = ?
          `).get(row.USUARIO_CAPTURA_TRABAJO);
          if (uRow) {
            usuarioNombre = uRow.NombreCompleto || uRow.Usuario;
            rolNombre = uRow.NombreRol;
          }
        }

        const dup = database.prepare(`
          SELECT ID FROM "HISTORIAL_TRABAJO_DIARIO"
          WHERE "EXPEDIENTE_ROWID" = ? 
            AND "FECHA_CAPTURA" = ? 
            AND "ESTATUS_ATENDIDO" = ?
            AND "FECHA_ACUERDO" = ?
        `).get(row.rowid, fechaCaptura, row.ESTATUS_ATENDIDO || '', row.FECHA_ACUERDO || '');

        if (!dup) {
          database.prepare(`
            INSERT INTO "HISTORIAL_TRABAJO_DIARIO" (
              "EXPEDIENTE_ROWID", "EXPEDIENTE", "ID_MESA", "MESA", "PERSONA_MESA",
              "USUARIO_ID", "USUARIO_NOMBRE", "ROL",
              "ESTATUS_ATENDIDO", "FECHA_ACUERDO", "OBSERVACIONES",
              "FECHA_CAPTURA", "FECHA_ENVIO_HISTORIAL"
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            row.rowid,
            row['NÚMERO DE JUICIO'] || '',
            row.ID_MESA || null,
            mesaNombre,
            personaMesa,
            row.USUARIO_CAPTURA_TRABAJO || 0,
            usuarioNombre,
            rolNombre,
            row.ESTATUS_ATENDIDO || '',
            row.FECHA_ACUERDO || '',
            row.OBSERVACIONES_DIARIO || '',
            fechaCaptura,
            now.toISOString()
          );
        }

        database.prepare(`
          UPDATE "CUMPLIMIENTOS"
          SET "ESTATUS_ATENDIDO" = NULL,
              "FECHA_ACUERDO" = NULL,
              "OBSERVACIONES_DIARIO" = NULL,
              "FECHA_CAPTURA_TRABAJO" = NULL,
              "USUARIO_CAPTURA_TRABAJO" = NULL
          WHERE rowid = ?
        `).run(row.rowid);
        touchedCumplimientos = true;

        processed++;
        logs.push(`Expediente ${row['NÚMERO DE JUICIO']} enviado al historial.`);
      }
	    }
	    database.exec('COMMIT');
	    if (touchedCumplimientos) invalidateCumplimientosCache();
	  } catch (err) {
    database.exec('ROLLBACK');
    throw err;
  }

  return { ok: true, processed, logs };
}

module.exports = {
  initializeMesasTables,
  listMesas,
  listMesasActivas,
  createMesa,
  updateMesa,
  deleteMesa,
  importMesasCatalog,
  getMesaById,
  reassignMesa,
  getAssignmentHistory,
  importMesaAssignments,
  autoAssignMesas,
  captureTrabajoDiario,
  getExpedientesByMesa,
  getExpedientesAllMesas,
  getHistorialTrabajoDiario,
  flushTrabajoDiarioToHistory
};

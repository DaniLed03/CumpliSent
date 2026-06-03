const { app } = require('electron');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const {
  actualizarDesdeSentencias,
  calcularCumplimiento,
  normalizarCumplimiento,
} = require('./cumplimientos.cjs');

const CUMPLIMIENTOS_COLUMNS = [
  ['numeroOrden', 'NÚMERO DE ORDEN', 'INTEGER'],
  ['numeroJuicio', 'NÚMERO DE JUICIO', 'TEXT'],
  ['materia', 'MATERIA', 'TEXT'],
  ['sentencia', 'SENTENCIA', 'DATE'],
  ['fechaEjecutoriaColegiado', 'FECHA EJECUTORIA COLEGIADO', 'DATE'],
  ['fechaEjecutoriaInconformidad', 'FECHA EJECUTORIA INCONFORMIDAD', 'DATE'],
  ['fechaEjecutoria', 'FECHA DE EJECUTORIA', 'DATE'],
  ['fechaPorNoCumplida', 'FECHA POR NO CUMPLIDA', 'DATE'],
  ['ultEjecutoria', 'ULT. EJECUTORIA', 'DATE'],
  ['ultimoRequerimiento', 'ÚLTIMO REQUERIMIENTO', 'DATE'],
  ['diasNaturalesTranscurridos', 'DIAS NATURALES TRANSCURRIDOS', 'TEXT'],
  ['diasHabilesTranscurridos', 'DÍAS HÁBILES TRANSCURRIDOS', 'TEXT'],
  ['estatus', 'ESTATUS', 'TEXT'],
  ['seDeclaroSinMateria', 'SE DECLARÓ SIN MATERIA', 'DATE'],
  ['fechaVista', 'FECHA DE VISTA', 'DATE'],
  ['fechaVistaCumpli', 'FECHA VISTA CUMPLI', 'DATE'],
  ['revisionContraSentencia', 'REVISION CONTRA SENTENCIA', 'DATE'],
  ['fechaCumplimiento', 'FECHA DE CUMPLIMIENTO', 'DATE'],
  ['fechaArchivo', 'FECHA DE ARCHIVO', 'DATE'],
  ['cumplimientoMenorFechaEjecutoria', 'CUMPLIMIENTO < FECHA EJECUTORIA', 'TEXT'],
  ['observaciones', 'OBSERVACIONES', 'TEXT'],
  ['localizado', 'LOCALIZADO', 'INTEGER'],
  ['actualizado', 'ACTUALIZADO', 'DATE'],
  ['firma', 'FIRMA', 'TEXT'],
  ['vistaMayorUltEjecutoria', 'VISTA>ULT.EJECUTORIA', 'TEXT'],
  ['idMesa', 'ID_MESA', 'INTEGER'],
  ['observacionesMesa', 'OBSERVACIONES_MESA', 'TEXT'],
  ['estatusAtendido', 'ESTATUS_ATENDIDO', 'TEXT'],
  ['fechaAcuerdo', 'FECHA_ACUERDO', 'TEXT'],
  ['observacionesDiario', 'OBSERVACIONES_DIARIO', 'TEXT'],
  ['fechaCapturaTrabajo', 'FECHA_CAPTURA_TRABAJO', 'TEXT'],
  ['usuarioCapturaTrabajo', 'USUARIO_CAPTURA_TRABAJO', 'INTEGER'],
];

function quoteIdentifier(identifier) {
  const text = String(identifier);
  if (text.includes('MERO DE ORDEN')) {
    return `"${cumplimientoColumnName('numeroOrden').replace(/"/g, '""')}"`;
  }
  if (text.includes('MERO DE JUICIO')) {
    return `"${cumplimientoColumnName('numeroJuicio').replace(/"/g, '""')}"`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

function cumplimientoColumnName(property) {
  const column = CUMPLIMIENTOS_COLUMNS.find(([prop]) => prop === property);
  if (!column) throw new Error(`Columna de cumplimiento no configurada: ${property}`);
  return column[1];
}

function dataDir() {
  const dir = path.join(app.getPath('userData'), 'backend');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function databaseFile() {
  return path.join(dataDir(), 'sistema-control.sqlite');
}

function getDatabasePath() {
  return databaseFile();
}

let db;
let cumplimientosCache = null;
const trabajoDiarioCache = new Map();

function invalidateCumplimientosCache() {
  cumplimientosCache = null;
  trabajoDiarioCache.clear();
}

function getDb() {
  if (!db) {
    db = new DatabaseSync(databaseFile());
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA cache_size = -20000'); // 20MB cache
    db.exec('PRAGMA synchronous = NORMAL'); // Faster writes in WAL mode
    db.exec('PRAGMA temp_store = MEMORY'); // Keep temporary tables in memory
    db.exec('PRAGMA mmap_size = 30000000000'); // Memory-mapped I/O
    initializeDatabase(db);
  }

  return db;
}

function initializeStore() {
  getDb();
  return getDatabasePath();
}

function initializeDatabase(database) {
  ensureExactTableSchema(
    database,
    'CUMPLIMIENTOS',
    CUMPLIMIENTOS_COLUMNS.map(([, columnName, type]) => [columnName, type])
  );
  ensureExactTableSchema(database, 'DIAS INHABILES', [['DIAS INHABILES', 'DATE NOT NULL UNIQUE']]);
  database.exec(`DROP TABLE IF EXISTS ${quoteIdentifier('CONFIGURACION')}`);

  // Create indexes to optimize filtering and sorting
  database.exec('CREATE INDEX IF NOT EXISTS "idx_cumplimientos_orden" ON "CUMPLIMIENTOS" ("NÚMERO DE ORDEN" ASC)');
  database.exec('CREATE INDEX IF NOT EXISTS "idx_cumplimientos_juicio" ON "CUMPLIMIENTOS" ("NÚMERO DE JUICIO")');
  database.exec('CREATE INDEX IF NOT EXISTS "idx_cumplimientos_estatus" ON "CUMPLIMIENTOS" ("ESTATUS")');
  database.exec('CREATE INDEX IF NOT EXISTS "idx_cumplimientos_mesa" ON "CUMPLIMIENTOS" ("ID_MESA")');

  // Migrate any existing yyyy-mm-dd dates to dd/mm/aaaa (only once)
  const userVersion = database.prepare('PRAGMA user_version').get().user_version;
  if (userVersion < 1) {
    runTransaction(database, () => {
      const dateColumns = CUMPLIMIENTOS_COLUMNS.filter(([, , type]) => type === 'DATE').map(([, colName]) => colName);
      
      dateColumns.forEach((colName) => {
        const rows = database.prepare(`SELECT rowid, ${quoteIdentifier(colName)} AS val FROM CUMPLIMIENTOS WHERE ${quoteIdentifier(colName)} LIKE '____-__-__'`).all();
        const updateStmt = database.prepare(`UPDATE CUMPLIMIENTOS SET ${quoteIdentifier(colName)} = ? WHERE rowid = ?`);
        rows.forEach((row) => {
          const val = row.val;
          const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (match) {
            const formatted = `${match[3]}/${match[2]}/${match[1]}`;
            updateStmt.run(formatted, row.rowid);
          }
        });
      });

      const inhabilesRows = database.prepare(`SELECT rowid, ${quoteIdentifier('DIAS INHABILES')} AS val FROM ${quoteIdentifier('DIAS INHABILES')} WHERE ${quoteIdentifier('DIAS INHABILES')} LIKE '____-__-__'`).all();
      const updateInhabilesStmt = database.prepare(`UPDATE ${quoteIdentifier('DIAS INHABILES')} SET ${quoteIdentifier('DIAS INHABILES')} = ? WHERE rowid = ?`);
      inhabilesRows.forEach((row) => {
        const val = row.val;
        const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          const formatted = `${match[3]}/${match[2]}/${match[1]}`;
          updateInhabilesStmt.run(formatted, row.rowid);
        }
      });
    });
    database.exec('PRAGMA user_version = 1');
  }

  syncFechaVistaCumpliWithFechaVista(database);
}

function tableInfo(database, tableName) {
  return database.prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`).all();
}

function createTable(database, tableName, columns) {
  const columnSql = columns
    .map(([columnName, type]) => `${quoteIdentifier(columnName)} ${type}`)
    .join(',\n      ');

  database.exec(`
    CREATE TABLE ${quoteIdentifier(tableName)} (
      ${columnSql}
    )
  `);
}

function legacyColumnName(columnName) {
  const legacyNames = {
    'NÚMERO DE ORDEN': 'N\u00c3\u0161MERO DE ORDEN',
    'NÚMERO DE JUICIO': 'N\u00c3\u0161MERO DE JUICIO',
    'ÚLTIMO REQUERIMIENTO': '\u00c3\u0161LTIMO REQUERIMIENTO',
    'DÍAS HÁBILES TRANSCURRIDOS': 'D\u00c3\u008dAS H\u00c3\u0081BILES TRANSCURRIDOS',
    'SE DECLARÓ SIN MATERIA': 'SE DECLAR\u00c3\u201c SIN MATERIA',
  };

  return legacyNames[columnName] || '';
}

function findExistingColumn(existingColumns, expectedColumn) {
  if (existingColumns.includes(expectedColumn)) {
    return expectedColumn;
  }

  const legacy = legacyColumnName(expectedColumn);
  return legacy && existingColumns.includes(legacy) ? legacy : '';
}

function ensureExactTableSchema(database, tableName, columns) {
  const existingInfo = tableInfo(database, tableName);
  const existingColumns = existingInfo.map((column) => column.name);
  const expectedColumns = columns.map(([columnName]) => columnName);

  if (existingColumns.length === 0) {
    createTable(database, tableName, columns);
    return;
  }

  const hasExactColumns =
    existingInfo.length === columns.length &&
    columns.every(([columnName, type], index) => {
      const existing = existingInfo[index];
      if (!existing) return false;
      const expectedTypeName = String(type).split(' ')[0].toUpperCase();
      const existingTypeName = String(existing.type).split(' ')[0].toUpperCase();
      return existing.name === columnName && existingTypeName === expectedTypeName;
    });

  if (hasExactColumns) {
    return;
  }

  const backupTableName = `${tableName}__backup_${Date.now()}`;
  const migrationColumns = expectedColumns
    .map((columnName) => [columnName, findExistingColumn(existingColumns, columnName)])
    .filter(([, sourceColumn]) => sourceColumn);

  runTransaction(database, () => {
    database.exec(`
      ALTER TABLE ${quoteIdentifier(tableName)}
      RENAME TO ${quoteIdentifier(backupTableName)}
    `);
    createTable(database, tableName, columns);

    if (migrationColumns.length > 0) {
      const targetColumnSql = migrationColumns.map(([columnName]) => quoteIdentifier(columnName)).join(', ');
      const sourceColumnSql = migrationColumns.map(([, sourceColumn]) => quoteIdentifier(sourceColumn)).join(', ');
      database.exec(`
        INSERT INTO ${quoteIdentifier(tableName)} (${targetColumnSql})
        SELECT ${sourceColumnSql}
        FROM ${quoteIdentifier(backupTableName)}
      `);
    }

    database.exec(`DROP TABLE ${quoteIdentifier(backupTableName)}`);
  });
}

function runTransaction(database, callback, items) {
  database.exec('BEGIN');
  try {
    callback(items);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function syncFechaVistaCumpliWithFechaVista(database) {
  database.prepare(`
    UPDATE ${quoteIdentifier('CUMPLIMIENTOS')}
    SET ${quoteIdentifier('FECHA VISTA CUMPLI')} = ''
    WHERE ${quoteIdentifier('FECHA DE VISTA')} IS NULL
       OR TRIM(${quoteIdentifier('FECHA DE VISTA')}) = ''
  `).run();
}

function buildInsertCumplimientoStatement(database) {
  const columns = CUMPLIMIENTOS_COLUMNS.map(([, columnName]) => quoteIdentifier(columnName)).join(', ');
  const placeholders = CUMPLIMIENTOS_COLUMNS.map(() => '?').join(', ');

  return database.prepare(`
    INSERT INTO ${quoteIdentifier('CUMPLIMIENTOS')} (${columns})
    VALUES (${placeholders})
  `);
}

function toDatabaseRow(row) {
  const normalizedRow = {
    ...row,
    fechaVistaCumpli: row.fechaVista ? row.fechaVistaCumpli : '',
  };

  return CUMPLIMIENTOS_COLUMNS.map(([property, , type]) => {
    let value = normalizedRow[property];
    if (type === 'DATE' && typeof value === 'string' && value) {
      const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        value = `${match[3]}/${match[2]}/${match[1]}`;
      }
    }
    return property === 'localizado' ? (value ? 1 : 0) : value ?? '';
  });
}

function fromDatabaseRow(row, index = 0) {
  const mapped = Object.fromEntries(
    CUMPLIMIENTOS_COLUMNS.map(([property, columnName, type]) => {
      let value = row[columnName];
      if (type === 'DATE' && typeof value === 'string' && value) {
        const match = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
        if (match) {
          value = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
        }
      }
      return [property, property === 'localizado' ? Boolean(value) : value];
    })
  );

  return {
    id: String(row.rowid || mapped.numeroJuicio || index + 1),
    ...mapped,
  };
}

function getDiasInhabiles() {
  return getDb()
    .prepare(`
      SELECT rowid AS id, ${quoteIdentifier('DIAS INHABILES')} AS fecha
      FROM ${quoteIdentifier('DIAS INHABILES')}
    `)
    .all()
    .map((row) => {
      let fecha = row.fecha;
      if (fecha && typeof fecha === 'string') {
        const match = fecha.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
        if (match) {
          fecha = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
        }
      }
      return {
        id: String(row.id),
        fecha: fecha,
      };
    })
    .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
}

function replaceDiasInhabiles(dias = []) {
  const database = getDb();
  const insertDia = database.prepare(`
    INSERT OR IGNORE INTO ${quoteIdentifier('DIAS INHABILES')}
    (${quoteIdentifier('DIAS INHABILES')})
    VALUES (?)
  `);
  
  const sortedDates = [...new Set(dias.map((dia) => dia.fecha).filter(Boolean))].sort();
  const formattedDates = sortedDates.map((val) => {
    const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
    return val;
  });

  runTransaction(database, (items) => {
    database.exec(`DELETE FROM ${quoteIdentifier('DIAS INHABILES')}`);
    items.forEach((fecha) => insertDia.run(fecha));
  }, formattedDates);

  invalidateCumplimientosCache();
  return getDiasInhabiles();
}

function getCumplimientos() {
  if (cumplimientosCache) {
    return cumplimientosCache;
  }

  const inhabiles = getDiasInhabiles().map((dia) => dia.fecha);

  cumplimientosCache = getDb()
    .prepare(`SELECT rowid, * FROM ${quoteIdentifier('CUMPLIMIENTOS')} ORDER BY ${quoteIdentifier('NÚMERO DE ORDEN')} ASC`)
    .all()
    .map((row, index) => {
      const normalizado = normalizarCumplimiento(fromDatabaseRow(row, index), index);
      return calcularCumplimiento(normalizado, inhabiles);
    });

  return cumplimientosCache;
}

function getCumplimientosTrabajoDiario(mesaId) {
  const cacheKey = mesaId === undefined || mesaId === null || mesaId === '' ? 'all' : String(mesaId);
  if (trabajoDiarioCache.has(cacheKey)) {
    return trabajoDiarioCache.get(cacheKey);
  }

  const values = [];
  const clauses = [`
    (
      ${quoteIdentifier('FECHA DE CUMPLIMIENTO')} IS NULL
      OR TRIM(${quoteIdentifier('FECHA DE CUMPLIMIENTO')}) = ''
      OR (
        ${quoteIdentifier('FECHA DE VISTA')} IS NOT NULL
        AND TRIM(${quoteIdentifier('FECHA DE VISTA')}) <> ''
        AND (
          ${quoteIdentifier('ESTATUS_ATENDIDO')} IS NULL
          OR TRIM(${quoteIdentifier('ESTATUS_ATENDIDO')}) <> 'ATENDIDA'
        )
      )
    )
  `];

  if (mesaId !== undefined && mesaId !== null && mesaId !== '') {
    clauses.push(`${quoteIdentifier('ID_MESA')} = ?`);
    values.push(Number(mesaId));
  }

  const inhabiles = getDiasInhabiles().map((dia) => dia.fecha);
  const numeroOrdenColumn = cumplimientoColumnName('numeroOrden');
  const rows = getDb()
    .prepare(`
      SELECT rowid, * FROM ${quoteIdentifier('CUMPLIMIENTOS')}
      WHERE ${clauses.join(' AND ')}
      ORDER BY ${quoteIdentifier(numeroOrdenColumn)} ASC
    `)
    .all(...values)
    .map((row, index) => {
      const normalizado = normalizarCumplimiento(fromDatabaseRow(row, index), index);
      return calcularCumplimiento(normalizado, inhabiles);
    });

  trabajoDiarioCache.set(cacheKey, rows);
  return rows;
}

function recalculateCumplimientos() {
  const database = getDb();
  const calculados = getCumplimientos();

  const insertCumplimiento = buildInsertCumplimientoStatement(database);
  runTransaction(database, (items) => {
    database.exec(`DELETE FROM ${quoteIdentifier('CUMPLIMIENTOS')}`);
    items.forEach((item) => insertCumplimiento.run(...toDatabaseRow(item)));
  }, calculados);
  cumplimientosCache = calculados;
  return calculados;
}

function updateCumplimientosDesdeSentencias(sentencias = []) {
  const database = getDb();
  const currentRows = getCumplimientos();
  const inhabiles = getDiasInhabiles().map((dia) => dia.fecha);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const before = new Map(
    currentRows.map((row) => [
      row.id,
      JSON.stringify({ ...row, actualizado: '' }),
    ])
  );
  const updatedRows = actualizarDesdeSentencias(currentRows, sentencias, inhabiles);
  const insertCumplimiento = buildInsertCumplimientoStatement(database);
  let changed = 0;

  updatedRows.forEach((row) => {
    const previous = before.get(row.id);
    const current = JSON.stringify({ ...row, actualizado: '' });

    if (previous !== current && row.actualizado === today) {
      changed += 1;
    }
  });

  runTransaction(database, (items) => {
    database.exec(`DELETE FROM ${quoteIdentifier('CUMPLIMIENTOS')}`);
    items.forEach((item) => insertCumplimiento.run(...toDatabaseRow(item)));
  }, updatedRows);

  invalidateCumplimientosCache();
  const rows = getCumplimientos();

  return {
    rows,
    summary: {
      indexados: sentencias.length,
      localizados: rows.filter((row) => row.localizado).length,
      actualizados: changed,
      noLocalizados: rows.filter((row) => !row.localizado).length,
      errores: 0,
    },
  };
}

function normalizeJuicioKey(value) {
  return String(value || '')
    .replace(/\s*\/\s*/g, '/')
    .replace(/[\u00A0\u200B\t]/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase()
    .trim();
}

function importCumplimientosRows(importRows = []) {
  const database = getDb();
  const currentRows = getCumplimientos();
  const inhabiles = getDiasInhabiles().map((dia) => dia.fecha);
  const rowsByJuicio = new Map();

  currentRows.forEach((row) => {
    const raw = String(row.numeroJuicio || '').trim().toUpperCase();
    const normalized = normalizeJuicioKey(raw);
    if (raw) rowsByJuicio.set(raw, row);
    if (normalized) rowsByJuicio.set(normalized, row);
  });

  const nextRows = currentRows.map((row) => ({ ...row }));
  const rowsById = new Map(nextRows.map((row) => [row.id, row]));
  let nextNumeroOrden = nextRows.reduce(
    (max, row) => Math.max(max, Number(row.numeroOrden) || 0),
    0
  ) + 1;
  let actualizados = 0;
  let celdasActualizadas = 0;
  let sinCambios = 0;
  let insertados = 0;
  let noEncontrados = 0;
  const errores = [];

  importRows.forEach((item) => {
    const rawJuicio = String(item?.numeroJuicio || '').trim();
    if (!rawJuicio) return;

    const values = item?.values && typeof item.values === 'object' ? item.values : item;
    const existing = rowsByJuicio.get(rawJuicio.toUpperCase()) || rowsByJuicio.get(normalizeJuicioKey(rawJuicio));

    if (!existing) {
      const inserted = normalizarCumplimiento({
        ...values,
        numeroOrden: nextNumeroOrden,
        numeroJuicio: rawJuicio,
        localizado: values.localizado ?? true,
      }, nextNumeroOrden - 1);

      nextRows.push(inserted);
      const raw = rawJuicio.toUpperCase();
      const normalized = normalizeJuicioKey(rawJuicio);
      if (raw) rowsByJuicio.set(raw, inserted);
      if (normalized) rowsByJuicio.set(normalized, inserted);
      nextNumeroOrden += 1;
      insertados += 1;
      return;
    }

    const target = rowsById.get(existing.id);
    if (!target) {
      errores.push(`${rawJuicio}: no se pudo preparar la fila para actualizar`);
      return;
    }

    let cambios = 0;
    Object.entries(values).forEach(([field, newValue]) => {
      if (field === 'id') return;
      const oldStr = String(target[field] ?? '').trim();
      const newStr = String(newValue ?? '').trim();
      if (oldStr !== newStr) {
        target[field] = newValue;
        cambios += 1;
      }
    });

    if (cambios === 0) {
      sinCambios += 1;
      return;
    }

    actualizados += 1;
    celdasActualizadas += cambios;
  });

  const calculatedRows = nextRows.map((row, index) => calcularCumplimiento(
    normalizarCumplimiento(row, index),
    inhabiles
  ));
  const insertCumplimiento = buildInsertCumplimientoStatement(database);

  runTransaction(database, (items) => {
    database.exec(`DELETE FROM ${quoteIdentifier('CUMPLIMIENTOS')}`);
    items.forEach((item) => insertCumplimiento.run(...toDatabaseRow(item)));
  }, calculatedRows);

  invalidateCumplimientosCache();
  const rows = getCumplimientos();

  return {
    rows,
    summary: {
      actualizados,
      celdasActualizadas,
      sinCambios,
      insertados,
      noEncontrados,
      errores,
    },
  };
}

function addCumplimientos(rows = []) {
  const database = getDb();
  const currentRows = getCumplimientos();
  const existingJuicios = new Set(
    currentRows.map((row) => String(row.numeroJuicio || '').trim().toUpperCase()).filter(Boolean)
  );
  let nextNumeroOrden = currentRows.reduce(
    (max, row) => Math.max(max, Number(row.numeroOrden) || 0),
    0
  ) + 1;
  const insertCumplimiento = buildInsertCumplimientoStatement(database);
  const rowsToInsert = [];

  rows.forEach((row) => {
    const numeroJuicio = String(row.numeroJuicio || '').trim();
    const duplicateKey = numeroJuicio.toUpperCase();

    if (!numeroJuicio || existingJuicios.has(duplicateKey)) {
      return;
    }

    existingJuicios.add(duplicateKey);
    rowsToInsert.push(normalizarCumplimiento({
      ...row,
      numeroOrden: nextNumeroOrden,
      numeroJuicio,
      localizado: true,
    }, nextNumeroOrden - 1));
    nextNumeroOrden += 1;
  });

  runTransaction(database, (items) => {
    items.forEach((item) => insertCumplimiento.run(...toDatabaseRow(item)));
  }, rowsToInsert);

  invalidateCumplimientosCache();
  return {
    inserted: rowsToInsert.length,
    rows: getCumplimientos(),
  };
}

function getCumplimientoColumnNames() {
  return CUMPLIMIENTOS_COLUMNS.map(([, columnName]) => columnName);
}

/**
 * Actualiza solo los campos indicados de un expediente identificado por su rowid/id.
 * @param {string} id   - El id retornado por getCumplimientos (= String(row.rowid | ...)).
 * @param {object} patch - Objeto con solo los campos a actualizar (claves camelCase).
 */
function patchCumplimiento(id, patch = {}) {
  const database = getDb();

  const columnMap = Object.fromEntries(
    CUMPLIMIENTOS_COLUMNS.map(([property, columnName]) => [property, columnName])
  );

  const numericId = Number(id);
  let rowid;

  if (Number.isFinite(numericId) && numericId > 0) {
    rowid = numericId;
  } else {
    const found = database
      .prepare(`SELECT rowid FROM ${quoteIdentifier('CUMPLIMIENTOS')} WHERE ${quoteIdentifier('NÚMERO DE JUICIO')} = ? LIMIT 1`)
      .get(id);
    if (!found) throw new Error(`No se encontró el expediente con id/juicio: ${id}`);
    rowid = found.rowid;
  }

  const currentRow = database
    .prepare(`SELECT rowid, * FROM ${quoteIdentifier('CUMPLIMIENTOS')} WHERE rowid = ?`)
    .get(rowid);
  if (!currentRow) return null;

  const current = fromDatabaseRow(currentRow, 0);
  const effectivePatch = { ...patch };
  const fechaVistaWasModified = Object.prototype.hasOwnProperty.call(effectivePatch, 'fechaVista');
  const effectiveFechaVista = fechaVistaWasModified
    ? normalizarCumplimiento({ fechaVista: effectivePatch.fechaVista }, 0).fechaVista
    : current.fechaVista;

  if (!fechaVistaWasModified && Object.prototype.hasOwnProperty.call(effectivePatch, 'fechaVistaCumpli')) {
    delete effectivePatch.fechaVistaCumpli;
  } else if (!effectiveFechaVista) {
    effectivePatch.fechaVistaCumpli = '';
  }

  const setClauses = [];
  const values = [];

  for (const [property, value] of Object.entries(effectivePatch)) {
    const columnName = columnMap[property];
    if (!columnName) continue;
    setClauses.push(`${quoteIdentifier(columnName)} = ?`);
    const colDef = CUMPLIMIENTOS_COLUMNS.find(([prop]) => prop === property);
    let valToSave = value;
    if (colDef && colDef[2] === 'DATE' && typeof valToSave === 'string' && valToSave) {
      const match = valToSave.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        valToSave = `${match[3]}/${match[2]}/${match[1]}`;
      }
    }
    values.push(property === 'localizado' ? (valToSave ? 1 : 0) : (valToSave ?? ''));
  }

  if (setClauses.length === 0) {
    return null;
  }

  values.push(rowid);
  database
    .prepare(`UPDATE ${quoteIdentifier('CUMPLIMIENTOS')} SET ${setClauses.join(', ')} WHERE rowid = ?`)
    .run(...values);

  syncFechaVistaCumpliWithFechaVista(database);
  invalidateCumplimientosCache();

  const updated = database
    .prepare(`SELECT rowid, * FROM ${quoteIdentifier('CUMPLIMIENTOS')} WHERE rowid = ?`)
    .get(rowid);

  if (!updated) return null;
  const inhabiles = getDiasInhabiles().map((dia) => dia.fecha);
  const normalizado = normalizarCumplimiento(fromDatabaseRow(updated, 0), 0);
  return calcularCumplimiento(normalizado, inhabiles);
}
function deleteCumplimiento(id) {
  const database = getDb();
  const numericId = Number(id);
  let rowid;

  if (Number.isFinite(numericId) && numericId > 0) {
    rowid = numericId;
  } else {
    const found = database
      .prepare(`SELECT rowid FROM ${quoteIdentifier('CUMPLIMIENTOS')} WHERE ${quoteIdentifier('NÚMERO DE JUICIO')} = ? LIMIT 1`)
      .get(id);
    if (!found) throw new Error(`No se encontró el expediente con id/juicio: ${id}`);
    rowid = found.rowid;
  }

  database.prepare(`DELETE FROM ${quoteIdentifier('CUMPLIMIENTOS')} WHERE rowid = ?`).run(rowid);
  invalidateCumplimientosCache();
  return true;
}

module.exports = {
  addCumplimientos,
  getDatabasePath,
  getCumplimientos,
  getCumplimientosTrabajoDiario,
  getCumplimientoColumnNames,
  getDiasInhabiles,
  invalidateCumplimientosCache,
  initializeStore,
  importCumplimientosRows,
  patchCumplimiento,
  deleteCumplimiento,
  recalculateCumplimientos,
  replaceDiasInhabiles,
  updateCumplimientosDesdeSentencias,
};


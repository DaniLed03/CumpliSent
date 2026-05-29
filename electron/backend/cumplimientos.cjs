const toIsoDateCache = new Map();

function toIsoDate(value) {
  if (!value) {
    return '';
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatIsoDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return new Date(excelEpoch + value * 86400000).toISOString().slice(0, 10);
  }

  const cacheKey = String(value);
  const cached = toIsoDateCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const result = toIsoDateUncached(value);
  toIsoDateCache.set(cacheKey, result);
  return result;
}

function toIsoDateUncached(value) {
  const text = String(value).trim();
  if (!text) {
    return '';
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const mx = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (mx) {
    const year = mx[3].length === 2 ? `20${mx[3]}` : mx[3];
    return `${year}-${mx[2].padStart(2, '0')}-${mx[1].padStart(2, '0')}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return '';
}

function formatIsoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const dateUtcCache = new Map();
function dateUtc(isoDate) {
  const normalized = toIsoDate(isoDate);

  if (!normalized) {
    return null;
  }

  const cached = dateUtcCache.get(normalized);
  if (cached !== undefined) {
    return cached ? new Date(cached) : null;
  }

  const [year, month, day] = normalized.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  dateUtcCache.set(normalized, date.getTime());
  return date;
}

let cachedTodayStr = '';
let lastTodayUpdate = 0;
function todayIso() {
  const now = Date.now();
  if (now - lastTodayUpdate < 1000 && cachedTodayStr) {
    return cachedTodayStr;
  }
  const today = new Date();
  cachedTodayStr = formatIsoDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
  lastTodayUpdate = now;
  return cachedTodayStr;
}

function daysBetween(startIso, endIso) {
  const start = dateUtc(startIso);
  const end = dateUtc(endIso);

  if (!start || !end) {
    return '';
  }

  return Math.floor((end.getTime() - start.getTime()) / 86400000);
}

function maxDate(dates) {
  const validDates = dates.map(toIsoDate).filter(Boolean);
  if (validDates.length === 0) {
    return '';
  }

  return validDates.sort().at(-1);
}

function isWeekend(date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function businessDaysInclusive(startIso, endIso, holidayDates = []) {
  const start = dateUtc(startIso);
  const end = dateUtc(endIso);

  if (!start || !end || start > end) {
    return 0;
  }

  const startIsoNorm = toIsoDate(startIso);
  const endIsoNorm = toIsoDate(endIso);

  const totalDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  const startDay = start.getUTCDay();
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

  if (holidayDates instanceof Set) {
    for (const holiday of holidayDates) {
      if (holiday && holiday >= startIsoNorm && holiday <= endIsoNorm) {
        const hDate = dateUtc(holiday);
        if (hDate && !isWeekend(hDate)) {
          count -= 1;
        }
      }
    }
  } else if (Array.isArray(holidayDates)) {
    const holidays = new Set(holidayDates.map(toIsoDate).filter(Boolean));
    for (const holiday of holidays) {
      if (holiday && holiday >= startIsoNorm && holiday <= endIsoNorm) {
        const hDate = dateUtc(holiday);
        if (hDate && !isWeekend(hDate)) {
          count -= 1;
        }
      }
    }
  }

  return Math.max(0, count);
}

function elapsedBusinessDays(startIso, endIso, holidayDates = []) {
  return Math.max(0, businessDaysInclusive(startIso, endIso, holidayDates) - 1);
}

function isFilled(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  return String(value ?? '').trim() !== '' && String(value).trim().toUpperCase() !== 'NO';
}

function statusFromBusinessDays(days) {
  const n = Number(days);
  if (n <= 3) return 'EN_PLAZO';
  if (n <= 6) return 'ATENCION';
  if (n <= 9) return 'REQUERIR';
  return 'VENCIDO';
}

function upperText(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizarCumplimiento(row, index = 0) {
  return {
    id: String(row.id || row.numeroJuicio || index + 1),
    numeroOrden: Number(row.numeroOrden || index + 1),
    numeroJuicio: upperText(row.numeroJuicio),
    materia: upperText(row.materia),
    sentencia: toIsoDate(row.sentencia),
    fechaEjecutoriaColegiado: toIsoDate(row.fechaEjecutoriaColegiado),
    fechaEjecutoriaInconformidad: toIsoDate(row.fechaEjecutoriaInconformidad),
    fechaEjecutoria: toIsoDate(row.fechaEjecutoria),
    fechaPorNoCumplida: toIsoDate(row.fechaPorNoCumplida),
    ultEjecutoria: toIsoDate(row.ultEjecutoria),
    ultimoRequerimiento: toIsoDate(row.ultimoRequerimiento),
    diasNaturalesTranscurridos: row.diasNaturalesTranscurridos ?? '',
    diasHabilesTranscurridos: row.diasHabilesTranscurridos ?? '',
    estatus: upperText(row.estatus),
    seDeclaroSinMateria: toIsoDate(row.seDeclaroSinMateria),
    fechaVista: toIsoDate(row.fechaVista),
    revisionContraSentencia: toIsoDate(row.revisionContraSentencia),
    fechaCumplimiento: toIsoDate(row.fechaCumplimiento),
    fechaArchivo: toIsoDate(row.fechaArchivo),
    cumplimientoMenorFechaEjecutoria: upperText(row.cumplimientoMenorFechaEjecutoria),
    observaciones: upperText(row.observaciones),
    localizado: Boolean(row.localizado),
    actualizado: toIsoDate(row.actualizado),
    firma: upperText(row.firma),
    vistaMayorUltEjecutoria: upperText(row.vistaMayorUltEjecutoria),
    idMesa: Number.isFinite(Number(row.idMesa)) ? Number(row.idMesa) : null,
    observacionesMesa: upperText(row.observacionesMesa),
    estatusAtendido: upperText(row.estatusAtendido),
    fechaAcuerdo: toIsoDate(row.fechaAcuerdo),
    observacionesDiario: upperText(row.observacionesDiario),
    fechaCapturaTrabajo: String(row.fechaCapturaTrabajo || ''),
    usuarioCapturaTrabajo: row.usuarioCapturaTrabajo || '',
  };
}

function calcularCumplimiento(row, diasInhabiles = []) {
  const hoy = todayIso();
  const ultEjecutoria = maxDate([
    row.fechaEjecutoriaColegiado,
    row.fechaEjecutoriaInconformidad,
    row.fechaEjecutoria,
    row.fechaPorNoCumplida,
  ]);

  const sinMateriaValida =
    row.seDeclaroSinMateria && ultEjecutoria && row.seDeclaroSinMateria >= ultEjecutoria
      ? row.seDeclaroSinMateria
      : '';
  const fechaVistaValida =
    row.fechaVista && (!ultEjecutoria || row.fechaVista >= ultEjecutoria) ? row.fechaVista : '';
  const fechaCumplimientoValida =
    row.fechaCumplimiento && (!ultEjecutoria || row.fechaCumplimiento >= ultEjecutoria)
      ? row.fechaCumplimiento
      : '';
  const cumplimientoAlerta =
    row.fechaCumplimiento && ultEjecutoria && row.fechaCumplimiento < ultEjecutoria
      ? 'Alerta: cumplimiento menor a fecha de ejecutoria'
      : '';
  const vistaValidacion =
    !row.fechaVista || !ultEjecutoria
      ? ''
      : row.fechaVista >= ultEjecutoria
        ? row.fechaVista
        : 'Alerta: vista anterior a ?ltima ejecutoria';

  const estatusEnBlanco =
    !row.ultimoRequerimiento ||
    isFilled(row.seDeclaroSinMateria) ||
    isFilled(row.fechaVista) ||
    isFilled(row.revisionContraSentencia) ||
    isFilled(row.fechaCumplimiento) ||
    isFilled(cumplimientoAlerta) ||
    isFilled(row.cumplimientoMenorFechaEjecutoria);
  const diasNaturales = row.ultimoRequerimiento ? daysBetween(row.ultimoRequerimiento, hoy) : '';
  const diasHabiles = row.ultimoRequerimiento
    ? elapsedBusinessDays(row.ultimoRequerimiento, hoy, diasInhabiles)
    : '';
  const diasHabilesParaEstatus = estatusEnBlanco
    ? ''
    : businessDaysInclusive(row.ultimoRequerimiento, hoy, diasInhabiles);

  const estatus = estatusEnBlanco
    ? ''
    : diasHabilesParaEstatus;

  return {
    ...row,
    ultEjecutoria,
    diasNaturalesTranscurridos: diasNaturales,
    diasHabilesTranscurridos: diasHabiles,
    estatus,
    seDeclaroSinMateria: sinMateriaValida,
    fechaVista: fechaVistaValida,
    fechaCumplimiento: fechaCumplimientoValida,
    cumplimientoMenorFechaEjecutoria: cumplimientoAlerta,
    vistaMayorUltEjecutoria: vistaValidacion,
  };
}

function normalizeHeader(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[._:-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normalizeKey(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase();
}

function pick(row, candidates) {
  const wanted = new Set(candidates.map(normalizeHeader));
  const key = Object.keys(row || {}).find((name) => wanted.has(normalizeHeader(name)));
  return key ? row[key] : '';
}

function sourceContainsFundada(value) {
  return normalizeHeader(value).split(' ').includes('FUNDADA');
}

function firstTen(value) {
  if (value instanceof Date || typeof value === 'number') {
    return value;
  }

  const text = String(value || '').replace(/\u00a0/g, ' ').trim();
  return text.length <= 10 ? text : text.slice(0, 10);
}

function lastTen(value) {
  if (value instanceof Date || typeof value === 'number') {
    return value;
  }

  const text = String(value || '').replace(/\u00a0/g, ' ').trim();
  return text.length <= 10 ? text : text.slice(-10);
}

function isBlank(value) {
  return String(value ?? '').trim() === '';
}

function newerDate(sourceValue, currentValue) {
  const sourceDate = toIsoDate(sourceValue);
  const currentDate = toIsoDate(currentValue);

  if (!sourceDate) {
    return currentDate;
  }

  if (!currentDate || sourceDate > currentDate) {
    return sourceDate;
  }

  return currentDate;
}

function keepExistingOrSource(existingValue, sourceValue, slicer = (value) => value) {
  if (!isBlank(existingValue)) {
    return existingValue;
  }

  return slicer(sourceValue) || existingValue;
}

function sourceDateValue(sourceValue, slicer = (value) => value) {
  const value = slicer(sourceValue);
  return toIsoDate(value) || value || '';
}

function extractFechaPorNoCumplida(observaciones) {
  const text = String(observaciones || '');
  if (!text.toUpperCase().includes('LA SENTENCIA SE TUVO POR NO CUMPLIDA')) {
    return '';
  }

  const dateMatch = text.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})/);
  return dateMatch ? toIsoDate(dateMatch[1]) : '';
}

function sentenciaToCumplimiento(sentencia, existente = {}, index = 0) {
  const expediente = pick(sentencia, ['EXPEDIENTE']);
  const sentidoInconformidad = pick(sentencia, ['SENTIDO EJECUTORIA INCONFORMIDAD']);
  const fechaInconformidad = sourceContainsFundada(sentidoInconformidad)
    ? sourceDateValue(pick(sentencia, ['FECHA EJECUTORIA INCONFORMIDAD']), lastTen)
    : '';
  const fechaPorNoCumplida = sourceDateValue(
    pick(sentencia, ['FEC. POR NO CUMPLIDA', 'FEC POR NO CUMPLIDA', 'FECHA POR NO CUMPLIDA']) ||
      extractFechaPorNoCumplida(pick(sentencia, ['OBSERVACIONES'])),
    lastTen
  );
  const ultimoRequerimiento = newerDate(
    pick(sentencia, ['ULT. REQUERIMIENTO', 'ULT REQUERIMIENTO', 'ULTIMO REQUERIMIENTO']),
    existente.ultimoRequerimiento
  );

  const fechaColegiadoFuente = sourceDateValue(pick(sentencia, [
    'FECHA EJECUTORIA TRIBUNAL COLEGIADO DE CIRCUITO CONTRA SENTENCIA',
  ]), firstTen);

  const rawFechaInterposicion = String(pick(sentencia, [
    'FECHA INTERPOSICION RECURSO CONTRA SENTENCIA',
    'FECHA INTERPOSICIÓN RECURSO CONTRA SENTENCIA',
  ]) || '').trim();

  let revisionContraSentencia;
  if (fechaColegiadoFuente) {
    revisionContraSentencia = '';
  } else if (rawFechaInterposicion) {
    revisionContraSentencia = rawFechaInterposicion;
  } else {
    revisionContraSentencia = existente.revisionContraSentencia || '';
  }

  return normalizarCumplimiento({
    ...existente,
    id: existente.id || expediente || index + 1,
    numeroOrden: existente.numeroOrden || index + 1,
    numeroJuicio: existente.numeroJuicio || expediente,
    materia: existente.materia || pick(sentencia, ['Materia (amparo indirecto)', 'MATERIA']),
    sentencia: keepExistingOrSource(existente.sentencia, pick(sentencia, ['FECHA DE SENTENCIA']), lastTen),
    fechaEjecutoriaColegiado: fechaColegiadoFuente || existente.fechaEjecutoriaColegiado,
    fechaEjecutoriaInconformidad: fechaInconformidad || existente.fechaEjecutoriaInconformidad,
    fechaEjecutoria: keepExistingOrSource(
      existente.fechaEjecutoria,
      pick(sentencia, ['FECHA EN LA QUE CAUSA EJECUTORIA']),
      lastTen
    ),
    fechaPorNoCumplida: fechaPorNoCumplida || existente.fechaPorNoCumplida,
    ultimoRequerimiento,
    seDeclaroSinMateria: sourceDateValue(
      pick(sentencia, ['FEC. SIN MATERIA', 'FEC SIN MATERIA', 'FECHA SIN MATERIA']),
      lastTen
    ) || existente.seDeclaroSinMateria,
    fechaVista: sourceDateValue(pick(sentencia, ['VISTA']), lastTen) || existente.fechaVista,
    revisionContraSentencia,
    fechaCumplimiento:
      sourceDateValue(pick(sentencia, [
        'FECHA AUTO DECLARACION CUMPLIMIENTO',
        'FECHA AUTO DECLARACIÓN CUMPLIMIENTO',
      ]), lastTen) || existente.fechaCumplimiento,
    fechaArchivo: keepExistingOrSource(existente.fechaArchivo, pick(sentencia, [
      'FECHA AUTO QUE ORDENA ARCHIVO',
      'FECHA DE AUTO QUE ORDENA ARCHIVO',
    ]), lastTen),
    _legacyFechaCumplimiento:
      pick(sentencia, ['FECHA AUTO DECLARACIÓN CUMPLIMIENTO']) || existente.fechaCumplimiento,
    _legacyFechaArchivo:
      existente.fechaArchivo || pick(sentencia, ['FECHA AUTO QUE ORDENA ARCHIVO']),
    localizado: Boolean(expediente),
    actualizado: existente.actualizado,
  }, index);
}

function actualizarDesdeSentencias(cumplimientos, sentencias, diasInhabiles = []) {
  const sentenciasPorExpediente = new Map(
    sentencias
      .map((row) => [normalizeKey(pick(row, ['EXPEDIENTE'])), row])
      .filter(([expediente]) => expediente)
  );

  const inhabilesSet = diasInhabiles instanceof Set ? diasInhabiles : new Set(diasInhabiles.map(toIsoDate).filter(Boolean));

  return cumplimientos.map((row, index) => {
    const sentencia = sentenciasPorExpediente.get(normalizeKey(row.numeroJuicio));

    if (!sentencia) {
      return calcularCumplimiento({ ...normalizarCumplimiento(row, index), localizado: false }, inhabilesSet);
    }

    const anterior = JSON.stringify(row);
    const actualizado = sentenciaToCumplimiento(sentencia, { ...row, localizado: true }, index);
    const calculado = calcularCumplimiento(actualizado, inhabilesSet);
    const cambio = JSON.stringify(calculado) !== anterior;

    return {
      ...calculado,
      actualizado: cambio ? todayIso() : calculado.actualizado,
    };
  });
}

module.exports = {
  actualizarDesdeSentencias,
  calcularCumplimiento,
  normalizarCumplimiento,
  sentenciaToCumplimiento,
  toIsoDate,
  upperText,
};

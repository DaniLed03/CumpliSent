const license = require('../license.cjs');

const V3_KIND_DAYS = 2;

function parseStoredExpiry(expiry) {
  if (!expiry) return null;
  const value = String(expiry).trim();
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) return null;

  const [, y, m, d, hh, mm, ss] = match;
  const date = new Date(
    Number(y),
    Number(m) - 1,
    Number(d),
    hh ? Number(hh) : 23,
    mm ? Number(mm) : 59,
    ss ? Number(ss) : 59,
    hh ? 0 : 999
  );

  if (Number.isNaN(date.getTime())) return null;

  return {
    date,
    dateOnly: !hh,
    year: Number(y),
    month: Number(m),
    day: Number(d),
  };
}

function getTimeLeft(expiry, active) {
  if (!active) {
    return { msLeft: 0, minutesLeft: 0, timeLeftLabel: '' };
  }

  const parsedExpiry = parseStoredExpiry(expiry);
  if (!parsedExpiry) {
    return { msLeft: 0, minutesLeft: 0, timeLeftLabel: '' };
  }

  const msLeft = Math.max(0, parsedExpiry.date.getTime() - Date.now());
  const minutesLeft = Math.max(0, Math.ceil(msLeft / 60000));
  let timeLeftLabel = '';

  if (parsedExpiry.dateOnly) {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const expiryStart = new Date(parsedExpiry.year, parsedExpiry.month - 1, parsedExpiry.day);
    const calendarDaysLeft = Math.max(0, Math.round((expiryStart.getTime() - todayStart.getTime()) / 86400000));
    timeLeftLabel = `${calendarDaysLeft} dia${calendarDaysLeft === 1 ? '' : 's'}`;
  } else if (minutesLeft < 60) {
    timeLeftLabel = `${minutesLeft} minuto${minutesLeft === 1 ? '' : 's'}`;
  } else if (minutesLeft < 1440) {
    const hoursLeft = Math.ceil(minutesLeft / 60);
    timeLeftLabel = `${hoursLeft} hora${hoursLeft === 1 ? '' : 's'}`;
  } else {
    const daysLeft = Math.ceil(minutesLeft / 1440);
    timeLeftLabel = `${daysLeft} dia${daysLeft === 1 ? '' : 's'}`;
  }

  return { msLeft, minutesLeft, timeLeftLabel };
}

function toLegacyLicenseStatus(state) {
  const status = state?.status || 'missing_serial';
  const active = status === 'active';
  const expired = status === 'expired';
  const noLicense = status === 'missing_serial';
  const expiry = state?.expiry || '';
  const timeLeft = getTimeLeft(expiry, active);

  return {
    active,
    daysLeft: active ? Number(state.daysLeft || 0) : 0,
    ...timeLeft,
    serial: state?.serial || '',
    expired,
    noLicense,
    machineId: state?.machineId || license.getMachineFingerprint(),
    expiry,
    lastRun: state?.lastRun || '',
    status,
    message: state?.message || '',
  };
}

function initializeLicenseTable() {
  // La licencia ahora se guarda en el Registro de Windows, igual que SheetSync.
}

function activateLicense(serial) {
  const result = license.activateSerial(serial);
  const state = license.getLicenseState();

  return {
    ok: Boolean(result?.ok),
    error: result?.ok ? undefined : result?.message || 'Error al activar la licencia',
    message: result?.message || '',
    days: result?.days,
    expiry: result?.expiry,
    state: toLegacyLicenseStatus(state),
  };
}

function checkLicense() {
  return toLegacyLicenseStatus(license.getLicenseState());
}

function generateSerial(days, machineId = license.getMachineFingerprint()) {
  const value = Number(days);
  if (!Number.isInteger(value) || value <= 0 || value > 9999) {
    return { ok: false, error: 'Los dias deben estar entre 1 y 9999' };
  }

  try {
    return {
      ok: true,
      serial: license.makeSerialV3(machineId, V3_KIND_DAYS, value),
      days: value,
      machineId,
    };
  } catch (error) {
    return { ok: false, error: error?.message || 'No se pudo generar el serial' };
  }
}

module.exports = {
  activateLicense,
  checkLicense,
  generateSerial,
  getMachineId: license.getMachineFingerprint,
  initializeLicenseTable,
};

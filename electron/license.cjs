'use strict';

const crypto = require('crypto');
const { execSync } = require('child_process');

const VENDOR = 'Daniel Armando Ledezma Donjuan';
const APPNAME = 'CumpliSent';
const REG_PATH = `HKCU\\Software\\${VENDOR}\\${APPNAME}`;
const SECRET_KEY = Buffer.from([
  0xb3, 0xe7, 0x5d, 0x1c, 0x61, 0x73, 0xbe, 0x93,
  0x07, 0x1c, 0xf8, 0x50, 0xc5, 0x99, 0x4b, 0xf1,
  0x15, 0x04, 0xef, 0x8a, 0xba, 0x19, 0x44, 0x04,
  0x22, 0xd9, 0xdf, 0x00, 0x30, 0xda, 0x45, 0x36
]);

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const V3_KIND_DURATION_MINUTES = 0;
const V3_KIND_ABS_MINUTES = 1;
const V3_KIND_DAYS = 2;
const V3_MAX_VALUE = 0x3FFFFFFF; // 30 bits
const V3_PAYLOAD_BYTES = 4;
const V3_SALT_BYTES = 2;
const V3_SIG_BYTES = 15;
const V3_TOTAL_BYTES = V3_PAYLOAD_BYTES + V3_SALT_BYTES + V3_SIG_BYTES;
const V3_B32_LEN = Math.ceil((V3_TOTAL_BYTES * 8) / 5); // 34 chars

const randomB32 = (len = 4) => {
  // genera al menos len chars Base32
  const bytes = crypto.randomBytes(3); // 24 bits ≈ 5 chars base32
  return b32NoPad(bytes).slice(0, len);
};

const dateTimeIso = (inputDate) => {
  const d = inputDate ? new Date(inputDate) : new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
};

const dateIso = (inputDate) => {
  const d = inputDate ? new Date(inputDate) : new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatExpiryLabel = (expiry) => {
  if (!expiry) return '';
  const s = String(expiry).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return s;
  const date = m[1];
  const hh = m[2];
  const mm = m[3];
  if (hh != null && mm != null) {
    return `${date} ${hh}:${mm} hrs`;
  }
  return `${date} 23:59 hrs`;
};

const parseIsoDateTime = (value) => {
  if (!value) return null;
  const s = String(value).trim();
  const match = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (!match) return null;
  const [, y, m, d, hh, mm, ss] = match;
  const date = new Date(
    parseInt(y, 10),
    parseInt(m, 10) - 1,
    parseInt(d, 10),
    hh ? parseInt(hh, 10) : 0,
    mm ? parseInt(mm, 10) : 0,
    ss ? parseInt(ss, 10) : 0,
    0
  );
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseExpiryDateTime = (value) => {
  const dt = parseIsoDateTime(value);
  if (!dt) return null;
  if (!/[T\s]/.test(String(value))) {
    dt.setHours(23, 59, 59, 999);
  }
  return dt;
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const b32NoPad = (buffer) => {
  let output = '';
  let bits = 0;
  let value = 0;
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
};

const b32ToBuf = (input) => {
  if (!input) return Buffer.alloc(0);
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of String(input).toUpperCase()) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) return null;
    value = (value << 5) | idx;
    bits += 5;
    while (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
};

const isBase32 = (s) => /^[A-Z2-7]+$/.test(s);

const run = (command) => {
  try {
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000
    });
    return output.trim();
  } catch {
    return '';
  }
};

const extractGuidFromText = (text) => {
  if (!text) return '';
  const match = String(text).match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  if (match) return match[0].toUpperCase();
  const compact = String(text).replace(/[^0-9a-fA-F]/g, '');
  if (compact.length !== 32) return '';
  const normalized = [
    compact.slice(0, 8),
    compact.slice(8, 12),
    compact.slice(12, 16),
    compact.slice(16, 20),
    compact.slice(20)
  ].join('-');
  return normalized.toUpperCase();
};

const getWindowsDeviceGuid = () => {
  if (process.platform !== 'win32') return '';

  // 1. Try SQMClient\MachineId FIRST — this matches the "Identificador de dispositivo"
  //    shown in Windows System Properties (~5ms)
  let regVal = run('reg query "HKLM\\SOFTWARE\\Microsoft\\SQMClient" /v MachineId');
  let guid = extractGuidFromText(regVal);
  if (guid) return guid;

  // 2. Fallback: Cryptography\MachineGuid (different GUID, ~5ms)
  regVal = run('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid');
  guid = extractGuidFromText(regVal);
  if (guid) return guid;

  // 3. Fallback to wmic csproduct get uuid (slower, ~100ms)
  regVal = run('wmic csproduct get uuid /value');
  guid = extractGuidFromText(regVal);
  if (guid) return guid;

  // 4. Ultimate slow fallback to powershell command
  const commands = [
    'powershell -NoProfile -Command "(Get-ItemProperty -Path \'HKLM:\\SOFTWARE\\Microsoft\\SQMClient\').MachineId"',
    'powershell -NoProfile -Command "(Get-CimInstance -Class Win32_ComputerSystemProduct).UUID"',
    'powershell -NoProfile -Command "(Get-ItemProperty -Path \'HKLM:\\SOFTWARE\\Microsoft\\Cryptography\').MachineGuid"'
  ];

  for (const command of commands) {
    const result = extractGuidFromText(run(command));
    if (result) return result;
  }
  return '';
};

const computeLegacyMachineId = () => {
  if (process.platform !== 'win32') {
    return crypto
      .createHash('sha256')
      .update(`FALLBACK-${process.env.COMPUTERNAME || 'UNKNOWN'}`)
      .digest('hex');
  }

  const parts = [];

  const uuid = run('wmic csproduct get uuid /value');
  if (uuid) {
    for (const line of uuid.split(/\r?\n/)) {
      if (line.toUpperCase().startsWith('UUID=')) {
        const idx = line.indexOf('=');
        if (idx !== -1) {
          const val = line.slice(idx + 1).trim();
          if (val) parts.push(val);
        }
        break;
      }
    }
  }

  if (!parts.length) {
    const uuidPs = run('powershell -NoProfile -Command "(Get-CimInstance Win32_ComputerSystemProduct).UUID"');
    if (uuidPs) {
      const val = uuidPs.split(/\r?\n/).filter(Boolean).pop();
      if (val) parts.push(val.trim());
    }
  }

  const vol = run('vol C:');
  if (vol) {
    for (const token of vol.replace(/-/g, '').split(/\s+/)) {
      if (token && token.length >= 8 && /^[0-9A-F]+$/i.test(token)) {
        parts.push(`VOL${token}`);
        break;
      }
    }
  }

  const disk = run('wmic diskdrive get serialnumber /value');
  if (disk) {
    for (const line of disk.split(/\r?\n/)) {
      if (line.toUpperCase().startsWith('SERIALNUMBER=')) {
        const idx = line.indexOf('=');
        if (idx !== -1) {
          const sn = line.slice(idx + 1).trim();
          if (sn) {
            parts.push(`DISK${sn}`);
            break;
          }
        }
      }
    }
  }

  if (parts.length === 0) {
    const snPs = run('powershell -NoProfile -Command "(Get-CimInstance Win32_DiskDrive | Select -Expand SerialNumber)[0]"');
    if (snPs) parts.push(`DISK${snPs.trim()}`);
  }

  if (!parts.length) {
    parts.push(`FALLBACK-${process.env.COMPUTERNAME || 'UNKNOWN'}`);
  }

  const raw = Buffer.from(parts.join('|'), 'utf8');
  return crypto.createHash('sha256').update(raw).digest('hex');
};

let cachedLegacyMachineId = null;
const getLegacyMachineFingerprint = () => {
  if (cachedLegacyMachineId) return cachedLegacyMachineId;
  cachedLegacyMachineId = computeLegacyMachineId();
  return cachedLegacyMachineId;
};

let cachedMachineId = null;
const getMachineFingerprint = () => {
  if (cachedMachineId) return cachedMachineId;

  const preferredGuid = getWindowsDeviceGuid();
  if (preferredGuid) {
    cachedMachineId = preferredGuid;
    return cachedMachineId;
  }

  cachedMachineId = getLegacyMachineFingerprint();
  return cachedMachineId;
};

const regGetValues = () => {
  const data = {};
  if (process.platform !== 'win32') return data;
  try {
    const output = execSync(`reg query "${REG_PATH}"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    for (const line of output.split(/\r?\n/)) {
      const match = line.match(/^\s*([^\s]+)\s+REG_\w+\s+(.*)$/);
      if (match) {
        const [, name, value] = match;
        data[name.trim()] = value.trim();
      }
    }
  } catch {
    // key not found is fine
  }
  return data;
};

const regSetValues = (entries) => {
  if (process.platform !== 'win32') return;
  for (const [key, value] of Object.entries(entries || {})) {
    const safe = String(value ?? '').replace(/"/g, '\'');
    try {
      execSync(
        `reg add "${REG_PATH}" /v ${key} /t REG_SZ /d "${safe}" /f`,
        { stdio: ['ignore', 'ignore', 'ignore'] }
      );
    } catch (err) {
      console.error('[license] No se pudo escribir en el registro:', err?.message || err);
    }
  }
};

const parseRegBool = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'si';
};

const getLegalAcceptance = () => {
  const machineId = getMachineFingerprint();
  if (process.platform !== 'win32') {
    return { accepted: false, machineId };
  }

  const reg = regGetValues();
  const accepted = parseRegBool(reg.LegalAccepted);
  if (!accepted) {
    return { accepted: false, machineId };
  }

  const acceptedAtIso = (reg.LegalAcceptedAt || '').trim();
  const termsVersion = (reg.LegalTermsVersion || '').trim();
  const appVersion = (reg.LegalAppVersion || '').trim();
  const acceptedMachineId = (reg.LegalAcceptedMachineId || '').trim();

  return {
    accepted: true,
    acceptedAtIso: acceptedAtIso || dateTimeIso(),
    termsVersion,
    appVersion,
    machineId: acceptedMachineId || machineId
  };
};

const setLegalAcceptance = (payload = {}) => {
  const machineId = getMachineFingerprint();
  if (process.platform !== 'win32') {
    return { ok: false, message: 'La persistencia legal en registro solo está soportada en Windows.' };
  }

  const accepted = Boolean(payload.accepted);
  if (!accepted) {
    regSetValues({
      LegalAccepted: '',
      LegalAcceptedAt: '',
      LegalTermsVersion: '',
      LegalAppVersion: '',
      LegalAcceptedMachineId: ''
    });
    return { ok: true, record: { accepted: false, machineId } };
  }

  let acceptedAtIso = typeof payload.acceptedAtIso === 'string' ? payload.acceptedAtIso.trim() : '';
  if (!parseIsoDateTime(acceptedAtIso)) acceptedAtIso = dateTimeIso();
  const termsVersion = typeof payload.termsVersion === 'string' ? payload.termsVersion.trim() : '';
  const appVersion = typeof payload.appVersion === 'string' ? payload.appVersion.trim() : '';
  const acceptedMachineId = typeof payload.machineId === 'string' && payload.machineId.trim()
    ? payload.machineId.trim()
    : machineId;

  regSetValues({
    LegalAccepted: '1',
    LegalAcceptedAt: acceptedAtIso,
    LegalTermsVersion: termsVersion,
    LegalAppVersion: appVersion,
    LegalAcceptedMachineId: acceptedMachineId
  });

  return {
    ok: true,
    record: {
      accepted: true,
      acceptedAtIso,
      termsVersion,
      appVersion,
      machineId: acceptedMachineId
    }
  };
};

const hmacHex = (...parts) =>
  crypto.createHmac('sha256', SECRET_KEY).update(parts.join('|'), 'utf8').digest('hex');

const packV3Payload = (kind, value) => {
  if (!Number.isInteger(value) || value < 1 || value > V3_MAX_VALUE) {
    throw new Error(`value debe estar entre 1 y ${V3_MAX_VALUE}`);
  }
  if (kind !== V3_KIND_DURATION_MINUTES && kind !== V3_KIND_ABS_MINUTES && kind !== V3_KIND_DAYS) {
    throw new Error('kind v3 inválido');
  }
  const packed = (((kind & 0x03) << 30) | value) >>> 0;
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(packed, 0);
  return buf;
};

const unpackV3Payload = (buf) => {
  if (!Buffer.isBuffer(buf) || buf.length !== 4) return null;
  const packed = buf.readUInt32BE(0);
  const kind = (packed >>> 30) & 0x03;
  const value = packed & 0x3FFFFFFF;
  if (kind !== V3_KIND_DURATION_MINUTES && kind !== V3_KIND_ABS_MINUTES && kind !== V3_KIND_DAYS) return null;
  if (value < 1 || value > V3_MAX_VALUE) return null;
  return { kind, value };
};

const hmacSigV3 = (machineId, payloadBuf, saltBuf) =>
  crypto
    .createHmac('sha256', SECRET_KEY)
    .update(Buffer.from(String(machineId), 'utf8'))
    .update('|')
    .update(payloadBuf)
    .update(saltBuf)
    .digest()
    .subarray(0, V3_SIG_BYTES);

const makeSerialV3 = (machineId, kind, value) => {
  const payload = packV3Payload(kind, value);
  const salt = crypto.randomBytes(V3_SALT_BYTES);
  const sig = hmacSigV3(machineId, payload, salt);
  const raw = Buffer.concat([payload, salt, sig]);
  return b32NoPad(raw);
};

const makeSerial = (machineId, days, salt) => {
  if (!Number.isInteger(days) || days < 1 || days > 9999) {
    throw new Error('days debe estar entre 1 y 9999');
  }

  if (!salt) {
    // v1 (compatibilidad): determinista por machineId|days
    const digest = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(`${machineId}|${days}`, 'utf8')
      .digest()
      .subarray(0, 15);
    const sig = b32NoPad(digest);
    return `${sig}-${days}`;
  }

  // v2 (único por emisión): agrega salt en la firma
  const digest = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(`${machineId}|${days}|${salt}`, 'utf8')
    .digest()
    .subarray(0, 15);

  const sig = b32NoPad(digest);
  return `${sig}-${salt}-${days}`; // ej: XXXXXXXX-XXXXXXXX-XXXXXXXX-ABCD-30
};


const normalizeSerialInput = (raw) => {
  if (!raw) return '';
  const trimmed = raw.trim().toUpperCase().replace(/\s+/g, '');
  const b32 = trimmed.replace(/[^A-Z2-7]/g, '');
  if (b32.length === V3_B32_LEN && isBase32(b32)) {
    return b32;
  }

  let s = trimmed.replace(/[^A-Z0-9-]/g, '');
  const naked = s.replace(/-/g, '');

  if (naked.length < 25) return trimmed.toUpperCase();

  const sig = naked.slice(0, 24);
  let idx = 24;
  let salt = '';
  if (naked.length - idx >= 4) { // salt opcional de 4 chars
    salt = naked.slice(idx, idx + 4);
    idx += 4;
  }
  const days = naked.slice(idx);

  return salt ? `${sig}-${salt}-${days}` : `${sig}-${days}`;
};


const serialHash = (serial) => {
  const norm = normalizeSerialInput(serial);
  return crypto.createHash('sha256').update(norm, 'utf8').digest('hex');
};

const isV3Serial = (value) => Boolean(value && value.length === V3_B32_LEN && isBase32(value));

const parseAndVerifySerialV3 = (machineId, serial) => {
  if (!serial) return null;
  const normalized = serial.trim().toUpperCase().replace(/[^A-Z2-7]/g, '');
  if (!isV3Serial(normalized)) return null;
  const raw = b32ToBuf(normalized);
  if (!raw || raw.length !== V3_TOTAL_BYTES) return null;
  const payload = raw.subarray(0, V3_PAYLOAD_BYTES);
  const salt = raw.subarray(V3_PAYLOAD_BYTES, V3_PAYLOAD_BYTES + V3_SALT_BYTES);
  const sig = raw.subarray(V3_PAYLOAD_BYTES + V3_SALT_BYTES);

  const payloadData = unpackV3Payload(payload);
  if (!payloadData) return null;

  const expected = hmacSigV3(machineId, payload, salt);
  if (!expected.equals(sig)) return null;

  return {
    version: 3,
    kind: payloadData.kind,
    value: payloadData.value
  };
};

const parseAndVerifySerial = (machineId, serial) => {
  if (!serial) return null;
  const normalized = normalizeSerialInput(serial);
  if (!normalized) return null;

  if (isV3Serial(normalized)) {
    return parseAndVerifySerialV3(machineId, normalized);
  }

  const m = normalized.match(/^([A-Z2-7]{24})(?:-([A-Z2-7]{4}))?-([0-9]{1,4})$/);
  if (!m) return null;

  const [, sig, salt, daysStr] = m;
  const days = parseInt(daysStr, 10);
  if (days < 1 || days > 9999) return null;

  const expectedSig = (salt
    ? makeSerial(machineId, days, salt)
    : makeSerial(machineId, days)
  ).split('-')[0];

  if (sig !== expectedSig) return null;
  return { version: 2, kind: 'days', value: days };
};


const validateClock = (lastRunIso) => {
  if (!lastRunIso) return true;
  const lastRun = parseIsoDateTime(lastRunIso);
  if (!lastRun) return true;
  const now = new Date();
  const diffMs = now.getTime() - lastRun.getTime();
  return diffMs >= -3 * 86400000;
};

const getLicenseState = () => {
  if (process.platform !== 'win32') {
    return {
      status: 'unsupported',
      message: 'Esta app esta configurada para licenciarse en Windows (Registro).',
      machineId: getMachineFingerprint()
    };
  }

  const reg = regGetValues();
  const machineId = getMachineFingerprint();
  const serial = reg.Serial || '';
  const expiry = reg.Expiry || '';
  const savedMid = reg.MachineId || '';
  const lastRun = reg.LastRun || '';
  const sig = reg.Sig || '';

  const base = {
    machineId,
    serial,
    expiry,
    lastRun
  };

  if (!serial) {
    return { ...base, status: 'missing_serial', message: 'No hay serial registrado.' };
  }

  // Determine if this machine legitimately owns the license
  let validationId = machineId;
  let needsMigration = false;

  if (savedMid && savedMid !== machineId) {
    // Case 1: Saved MachineId is a legacy SHA256 hex (64 chars, no dashes)
    const isLegacySaved = savedMid.length === 64 && !savedMid.includes('-');
    if (isLegacySaved) {
      const legacyMachineId = getLegacyMachineFingerprint();
      if (legacyMachineId && savedMid === legacyMachineId) {
        validationId = legacyMachineId;
        needsMigration = true;
      } else {
        return { ...base, status: 'machine_mismatch', message: 'La licencia esta ligada a otro equipo.' };
      }
    } else {
      // Case 2: Saved MachineId is a GUID but different from current
      // (GUID source priority changed, e.g., Cryptography vs SQMClient vs wmic).
      // Verify via Sig that the license was legitimately created with that savedMid.
      if (expiry && sig && sig === hmacHex(savedMid, expiry)) {
        validationId = savedMid;
        needsMigration = true;
      } else {
        return { ...base, status: 'machine_mismatch', message: 'La licencia esta ligada a otro equipo.' };
      }
    }
  }
  if (!expiry) {
    return { ...base, status: 'missing_expiry', message: 'No hay fecha de vencimiento registrada.' };
  }

  const expectedSig = hmacHex(validationId, expiry);
  if (sig !== expectedSig) {
    return {
      ...base,
      status: 'tampered',
      message: 'Integridad de la licencia no valida (posible edicion manual).'
    };
  }

  const expDate = parseExpiryDateTime(expiry);
  if (!expDate) {
    return { ...base, status: 'invalid_expiry', message: 'Fecha de vencimiento corrupta.' };
  }

  if (!validateClock(lastRun)) {
    return {
      ...base,
      status: 'clock_rollback',
      message: 'Se detecto retroceso de reloj del sistema.'
    };
  }

  const now = new Date();
  if (now.getTime() > expDate.getTime()) {
    return { ...base, status: 'expired', message: `Licencia vencida el ${formatExpiryLabel(expiry)}.` };
  }

  const daysLeft = Math.max(0, Math.ceil((expDate.getTime() - now.getTime()) / 86400000));
  regSetValues({ LastRun: dateTimeIso() });

  // Migrate to current GUID source if needed (legacy SHA256 → GUID, or old GUID → new GUID)
  if (needsMigration) {
    const updates = {
      MachineId: machineId,
      Sig: hmacHex(machineId, expiry)
    };
    if (reg.Used) {
      updates.UsedSig = hmacHex(machineId, reg.Used);
    }
    regSetValues(updates);
  }

  return {
    ...base,
    status: 'active',
    daysLeft
  };
};

const activateSerial = (serialInput) => {
  if (process.platform !== 'win32') {
    return { ok: false, message: 'La activacion solo esta soportada en Windows.' };
  }

  const machineId = getMachineFingerprint();
  const reg = regGetValues();
  const usedLine = reg.Used || '';
  const usedSig = reg.UsedSig || '';

  // Helper to lazily compute legacy fingerprint only if needed
  let legacyMachineIdCached = null;
  const getLegacyMachineIdLazy = () => {
    if (legacyMachineIdCached !== null) return legacyMachineIdCached;
    const shouldCheckLegacy = machineId.includes('-');
    legacyMachineIdCached = shouldCheckLegacy ? getLegacyMachineFingerprint() : '';
    return legacyMachineIdCached;
  };

  if (usedSig && usedSig !== hmacHex(machineId, usedLine)) {
    let usedSigValid = false;
    // Try legacy SHA256 machine ID
    const legacyMachineId = getLegacyMachineIdLazy();
    if (legacyMachineId && usedSig === hmacHex(legacyMachineId, usedLine)) {
      usedSigValid = true;
    }
    // Try stored MachineId from registry (different GUID source from same machine)
    const savedMid = reg.MachineId || '';
    if (!usedSigValid && savedMid && savedMid !== machineId && usedSig === hmacHex(savedMid, usedLine)) {
      usedSigValid = true;
    }
    if (!usedSigValid) {
      return { ok: false, message: 'Integridad de la lista de seriales usada no valida.' };
    }
  }

  const usedSet = new Set(usedLine.split(',').filter(Boolean));
  const normalized = normalizeSerialInput(serialInput);
  const hash = serialHash(normalized);
  if (usedSet.has(hash)) {
    return { ok: false, message: 'Este SERIAL ya fue utilizado en este equipo.' };
  }

  let parsed = parseAndVerifySerial(machineId, normalized);
  if (!parsed) {
    const legacyMachineId = getLegacyMachineIdLazy();
    if (legacyMachineId && legacyMachineId !== machineId) {
      parsed = parseAndVerifySerial(legacyMachineId, normalized);
    }
  }
  // Also try stored MachineId (in case serial was generated for a different GUID source)
  if (!parsed) {
    const savedMid = reg.MachineId || '';
    if (savedMid && savedMid !== machineId) {
      parsed = parseAndVerifySerial(savedMid, normalized);
    }
  }
  if (!parsed) {
    return { ok: false, message: 'El SERIAL no corresponde a este equipo o el formato es incorrecto.' };
  }

  const now = new Date();
  let expDate;
  let expiry;
  let messageDuration = '';

  if (parsed.version === 3) {
    if (parsed.kind === V3_KIND_DURATION_MINUTES) {
      expDate = new Date(now.getTime() + parsed.value * 60000);
      const minutes = parsed.value;
      if (minutes % 1440 === 0) {
        const d = minutes / 1440;
        messageDuration = `${d} dia${d !== 1 ? 's' : ''}`;
      } else if (minutes % 60 === 0) {
        const h = minutes / 60;
        messageDuration = `${h} hora${h !== 1 ? 's' : ''}`;
      } else {
        messageDuration = `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
      }
    } else if (parsed.kind === V3_KIND_DAYS) {
      const days = parsed.value;
      expDate = startOfToday();
      expDate.setDate(expDate.getDate() + Math.max(0, days));
      expDate.setHours(23, 59, 59, 999);
      messageDuration = `${days} dia${days !== 1 ? 's' : ''}`;
      expiry = dateIso(expDate);
    } else if (parsed.kind === V3_KIND_ABS_MINUTES) {
      expDate = new Date(parsed.value * 60000);
    } else {
      return { ok: false, message: 'Formato de licencia v3 no valido.' };
    }
    if (expDate.getTime() <= now.getTime()) {
      return { ok: false, message: 'La licencia ya vencio o expira en el pasado.' };
    }
    if (!expiry) {
      expiry = dateTimeIso(expDate);
    }
  } else {
    const days = parsed.value;
    expDate = startOfToday();
    // Regla: una licencia de N días vence al final del día N contado desde hoy.
    // Ej: N=1 activada el 04/02/2026 -> vence 05/02/2026 23:59.
    expDate.setDate(expDate.getDate() + Math.max(0, days));
    expDate.setHours(23, 59, 59, 999);
    expiry = dateIso(expDate);
    messageDuration = `${days} dia${days !== 1 ? 's' : ''}`;
  }
  const sig = hmacHex(machineId, expiry);

  usedSet.add(hash);
  const newUsedLine = Array.from(usedSet).sort().join(',');
  const usedSigNew = hmacHex(machineId, newUsedLine);

  regSetValues({
    MachineId: machineId,
    Serial: normalized,
    Expiry: expiry,
    LastRun: dateTimeIso(),
    Sig: sig,
    Used: newUsedLine,
    UsedSig: usedSigNew
  });

  return {
    ok: true,
    days: parsed.version === 3 ? Math.ceil((expDate.getTime() - now.getTime()) / 86400000) : parsed.value,
    expiry,
    message: parsed.version === 3 && parsed.kind === V3_KIND_ABS_MINUTES
      ? `Licencia activa hasta ${formatExpiryLabel(expiry)}.`
      : `Licencia activa por ${messageDuration}, hasta ${formatExpiryLabel(expiry)}.`
  };
};

module.exports = {
  activateSerial,
  getLicenseState,
  getLegalAcceptance,
  getMachineFingerprint,
  makeSerial,
  makeSerialV3,
  normalizeSerialInput,
  parseAndVerifySerial,
  setLegalAcceptance,
  serialHash
};

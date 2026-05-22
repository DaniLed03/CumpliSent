'use strict';

/**
 * scripts/license-keygen.js
 *
 * Genera seriales para CumpliSent.
 * Soporta:
 *  - --minutes N            (vigencia en minutos, desde activación)
 *  - --hours N              (vigencia en horas, desde activación)
 *  - --days N               (vigencia en días, desde activación)
 *  - --expiry YYYY-MM-DD
 *  - --expiry YYYY-MM-DDTHH:mm[:ss]
 *  - --expiry "YYYY-MM-DD HH:mm"
 *  - --v2                   (formato v2 legacy con salt y días)
 *  - --legacy               (formato v1 legacy sin salt, determinista por machineId|days)
 *  - --salt ABCD            (opcional, solo v2, 4 chars Base32 A–Z/2–7)
 */

const crypto = require('crypto');
const { makeSerial, makeSerialV3 } = require('../electron/license.cjs');

// --- Base32 helpers (sin padding) ---
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
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

const randomB32 = (len = 4) => b32NoPad(crypto.randomBytes(3)).slice(0, len); // ~5 chars; cortamos a 4
const isBase32 = (s) => /^[A-Z2-7]+$/.test(s);

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

// --- CLI ---
const usage = `Uso:
  node scripts/license-keygen.js MACHINE_ID --minutes 90
  node scripts/license-keygen.js MACHINE_ID --hours 6
  node scripts/license-keygen.js MACHINE_ID --days 30
  node scripts/license-keygen.js MACHINE_ID --expiry 2026-02-06
  node scripts/license-keygen.js MACHINE_ID --expiry 2026-02-06T15:30
  node scripts/license-keygen.js MACHINE_ID --expiry "2026-02-06 15:30"
  node scripts/license-keygen.js MACHINE_ID --v2 --days 30 [--salt ABCD]
  node scripts/license-keygen.js MACHINE_ID --legacy --days 30

Argumentos:
  MACHINE_ID      ID de equipo entregado por el cliente (tal cual lo muestra la app).
  --minutes       Vigencia en minutos (1..1073741823).
  --hours         Vigencia en horas.
  --days          Vigencia en días.
  --expiry        Fecha y hora exacta de vencimiento (hora local).
  --v2            Formato antiguo v2 (con salt, días visibles).
  --legacy        Formato antiguo v1 (sin salt, días visibles).
  --salt          (Opcional) 4 caracteres Base32 (A–Z, 2–7). Solo v2.

Salida:
  - Serial v3 (sin guiones): BASE32( payload + salt + firma )
`;

const args = process.argv.slice(2);
if (!args.length || ['-h', '--help'].includes(args[0])) {
  console.log(usage);
  process.exit(args.length ? 0 : 1);
}

const machineId = String(args[0] || '').trim();
if (!machineId) {
  console.error('Error: MACHINE_ID no puede estar vacío.');
  process.exit(1);
}

let minutes = null;
let hours = null;
let days = null;
let expiryInput = null;
let salt = null;
let legacy = false;
let v2 = false;

for (let i = 1; i < args.length; i++) {
  const token = args[i];
  if (token === '--minutes' && i + 1 < args.length) {
    minutes = parseInt(args[++i], 10);
  } else if (token === '--hours' && i + 1 < args.length) {
    hours = parseInt(args[++i], 10);
  } else if (token === '--days' && i + 1 < args.length) {
    days = parseInt(args[++i], 10);
  } else if (token === '--expiry' && i + 1 < args.length) {
    expiryInput = args[++i];
  } else if (token === '--salt' && i + 1 < args.length) {
    salt = String(args[++i] || '').toUpperCase().replace(/[^A-Z2-7]/g, '').slice(0, 4);
  } else if (token === '--v2') {
    v2 = true;
  } else if (token === '--legacy') {
    legacy = true;
  } else {
    console.error(`Error: argumento desconocido "${token}".`);
    console.log(usage);
    process.exit(1);
  }
}

const durationArgs = [minutes, hours, days].filter((v) => v != null);
if (durationArgs.length === 0 && !expiryInput) {
  console.error('Error: especifica --minutes, --hours, --days o --expiry.');
  console.log(usage);
  process.exit(1);
}
if (durationArgs.length > 1 || (durationArgs.length > 0 && expiryInput)) {
  console.error('Error: usa solo una opcion de vigencia (minutes, hours, days o expiry).');
  process.exit(1);
}
if (legacy && v2) {
  console.error('Error: usa solo --legacy o --v2 (no ambos).');
  process.exit(1);
}
if ((legacy || v2) && (minutes != null || hours != null)) {
  console.error('Error: --minutes/--hours solo estan disponibles en v3.');
  process.exit(1);
}

const clampInt = (value, label, min, max) => {
  if (!Number.isInteger(value) || value < min || value > max) {
    console.error(`Error: ${label} debe estar entre ${min} y ${max}.`);
    process.exit(1);
  }
  return value;
};

const parseExpiryInput = (value) => {
  if (!value) return null;
  const s = String(value).trim();
  const match = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (!match) return null;
  const [, y, m, d, hh, mm, ss] = match;
  const hasTime = Boolean(hh);
  const date = new Date(
    parseInt(y, 10),
    parseInt(m, 10) - 1,
    parseInt(d, 10),
    hasTime ? parseInt(hh, 10) : 23,
    hasTime ? parseInt(mm, 10) : 59,
    hasTime ? (ss ? parseInt(ss, 10) : 0) : 59,
    hasTime ? 0 : 999
  );
  if (Number.isNaN(date.getTime())) return null;
  return { date, hasTime };
};

const V3_KIND_DURATION_MINUTES = 0;
const V3_KIND_ABS_MINUTES = 1;
const V3_KIND_DAYS = 2;
const V3_MAX_VALUE = 0x3FFFFFFF;

let serial;
let mode = 'v3';
let durationKind = null;
let durationValue = null;
let expiryDate = null;

if (expiryInput) {
  const parsed = parseExpiryInput(expiryInput);
  if (!parsed) {
    console.error('Error: formato de fecha inválido. Usa YYYY-MM-DD o YYYY-MM-DDTHH:mm.');
    process.exit(1);
  }
  expiryDate = parsed.date;
  if (expiryDate.getTime() <= Date.now()) {
    console.error('Error: la fecha de vencimiento debe ser futura.');
    process.exit(1);
  }
} else if (minutes != null) {
  durationKind = V3_KIND_DURATION_MINUTES;
  durationValue = clampInt(minutes, 'minutes', 1, V3_MAX_VALUE);
} else if (hours != null) {
  durationKind = V3_KIND_DURATION_MINUTES;
  durationValue = clampInt(hours, 'hours', 1, Math.floor(V3_MAX_VALUE / 60)) * 60;
} else {
  durationKind = V3_KIND_DAYS;
  durationValue = clampInt(days, 'days', 1, 9999);
}

if (legacy || v2) {
  mode = legacy ? 'v1' : 'v2';
  if (salt && legacy) {
    console.error('Error: --salt no aplica en --legacy.');
    process.exit(1);
  }
  if (expiryInput && parseExpiryInput(expiryInput)?.hasTime) {
    console.error('Error: --expiry con hora solo esta disponible en v3.');
    process.exit(1);
  }
  if (expiryInput) {
    const target = new Date(expiryInput);
    if (Number.isNaN(target.getTime())) {
      console.error('Error: formato de fecha inválido. Usa YYYY-MM-DD.');
      process.exit(1);
    }
    const today = new Date();
    const diffMs = target.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0);
    const deltaDays = Math.floor(diffMs / 86400000);
    if (deltaDays < 1) {
      console.error('Error: la fecha de vencimiento debe ser futura (>= mañana).');
      process.exit(1);
    }
    days = Math.min(deltaDays, 9999);
  } else {
    days = clampInt(days, 'days', 1, 9999);
  }
}

if (mode === 'v3' && salt) {
  console.error('Error: --salt solo aplica en v2.');
  process.exit(1);
}

if (mode === 'v2') {
  if (salt && (!isBase32(salt) || salt.length !== 4)) {
    console.error('Error: --salt debe ser 4 caracteres Base32 (A–Z y 2–7).');
    process.exit(1);
  }
  if (!salt) salt = randomB32(4);
}

try {
  if (mode === 'v1') {
    serial = makeSerial(machineId, days);
  } else if (mode === 'v2') {
    serial = makeSerial(machineId, days, salt);
  } else {
    if (expiryDate) {
      const expiryMinutes = Math.ceil(expiryDate.getTime() / 60000);
      serial = makeSerialV3(machineId, V3_KIND_ABS_MINUTES, expiryMinutes);
    } else {
      serial = makeSerialV3(machineId, durationKind, durationValue);
    }
  }
} catch (e) {
  console.error('Error generando el serial:', e?.message || e);
  process.exit(1);
}

console.log('Machine ID:', machineId);
console.log('Formato:', mode === 'v1' ? 'v1 (legacy)' : mode === 'v2' ? 'v2 (legacy)' : 'v3 (keygen completo, sin guiones)');
if (mode === 'v2') console.log('Salt:', salt);
  if (mode === 'v3') {
  if (expiryDate) {
    console.log('Expira (local):', dateTimeIso(expiryDate));
  } else if (durationKind === V3_KIND_DAYS) {
    console.log('Duración (días):', durationValue);
  } else {
    console.log('Duración (min):', durationValue);
  }
} else {
  console.log('Días:', days);
}
console.log('Serial:', serial);
console.log('\n=> Entrega este serial al cliente.');

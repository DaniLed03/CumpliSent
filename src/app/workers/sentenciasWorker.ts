import * as XLSX from "xlsx";

type WorkerRequest = {
  action: "load" | "process";
  buffer: ArrayBuffer;
};

type Row = Record<string, unknown>;

const REQUIRED_SHEET = "SENTENCIAS";

function normalizeName(value: string) {
  return value.trim().toUpperCase();
}

function normalizeHeader(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function findHeader(headers: string[], header: string) {
  const wanted = normalizeHeader(header);
  return headers.find((item) => normalizeHeader(item) === wanted) || "";
}

function regexReplace(
  text: string,
  pattern: string,
  replacement: string,
  ignoreCase = true,
) {
  return text.replace(
    new RegExp(pattern, ignoreCase ? "gi" : "g"),
    replacement,
  );
}

function replaceAllInsensitive(
  text: string,
  search: string,
  replacement: string,
) {
  return text.replace(new RegExp(escapeRegExp(search), "gi"), replacement);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+^${}()|[\]\\]/g, "\\$&");
}

function normalizeBase(text: unknown) {
  let value = String(text || "");

  value = value
    .replace(/\r\n|\r|\n|\t/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[=-]/g, " ");

  while (value.includes("  ")) value = value.replaceAll("  ", " ");
  while (value.includes("..")) value = value.replaceAll("..", ".");

  value = value.replaceAll(" .", ".").replaceAll(" ,", ",");
  value = regexReplace(value, "(\\d{2}/\\d{2}/\\d{4})([A-ZÁÉÍÓÚÑ])", "$1 $2");
  value = regexReplace(value, "([A-ZÁÉÍÓÚÑ])(\\d{2}/\\d{2}/\\d{4})", "$1 $2");

  while (value.includes("  ")) value = value.replaceAll("  ", " ");
  return value.trim();
}

function applyPriorityFixes(text: string) {
  let value = text;

  value = replaceAllInsensitive(value, "206/02/2026", "20/02/2026");
  value = replaceAllInsensitive(value, "106/02/2026", "06/02/2026");
  value = regexReplace(
    value,
    "26/09/2016\\s+EL\\s+07/10/2016",
    "26/09/2016 RECIBIDO 07/10/2016",
  );
  value = regexReplace(
    value,
    "08/08/2014\\s+11/08/2014",
    "08/08/2014 RECIBIDO 11/08/2014",
  );

  return value;
}

function r(text: string, search: string, replacement: string) {
  return replaceAllInsensitive(text, search, replacement);
}

function applyObservationReplacements(text: string) {
  let value = text;

  [
    ["/12023", "/12/2023"],
    ["/2114", "/2014"],
    ["/2115", "/2015"],
    ["/20222", "/2022"],
    ["/20118", "/2018"],
    ["/20243,", "/2024"],
    ["045/", "04/"],
    ["/20222,", "/2022"],
    ["21008/2019", "21/08/2019"],
    ["16502/2022", "16/02/2022"],
    ["07608/2019", "07/08/2019"],
    ["06911/2018", "06/11/2018"],
    ["17406/2019", "17/06/2019"],
    ["06/12023", "06/12/2023"],
    ["0106/02/2026", "06/02/2026"],
    ["/606/", "/06/"],
    ["02108/2019", "02/08/2019"],
    ["18712/2018", "18/12/2018"],
    ["07/02/2023LA", "07/02/2023 LA"],
    ["08/0432022", "08/04/2022"],
    ["05/1/2021", "05/11/2021"],
    ["01/606/2021", "01/06/2021"],
    ["09/090/2020", "09/09/2020"],
    ["08/075/2019", "08/07/2019"],
    ["04/012/2015", "04/12/2015"],
    ["31/0652019", "31/05/2019"],
    ["0/02/2026", "06/02/2026"],
    ["//", "/"],
    ["/8/", "/08/"],
    ["210/", "21/"],
    ["221/", "22/"],
    ["115/", "15/"],
    ["/2415", "/2015"],
    ["030/", "03/"],
    ["/1/", "/01/"],
    ["05309/", "03/09/"],
    ["221//", "22/"],
    ["082/", "08/"],
    ["014/", "14/"],
    ["027/", "02/"],
    ["010/", "10/"],
    ["029/", "09/"],
    ["021/", "02/"],
    ["0 04/", "04/"],
    ["220/", "22/"],
    ["026/", "26/"],
    [
      "RESPONSABLE RECIBIDO 13/09/2016 EL 03/11/2016",
      "RESPONSABLE 13/09/2016 RECIBIDO 03/11/2016",
    ],
    ["RESPONSABLE19", "RESPONSABLE 19"],
    ["RECEPCION", "RECIBIDO"],
    ["RECIBO", "RECIBIDO"],
    ["FECHA DE INGRESO", "RECIBIDO"],
    ["RECIBIDO JUZGADO", "RECIBIDO"],
    ["FECHA RECIBO", "RECIBIDO"],
    ["FECHA RECIBIDO", "RECIBIDO"],
    ["FECHA DE RECIBIDO", "RECIBIDO"],
    ["FECHA RECEPCION JUZGADO", "RECIBIDO"],
    ["FECHA RECEPCION", "RECIBIDO"],
    ["031/", "31/"],
    ["310/", "31/"],
  ].forEach(([search, replacement]) => {
    value = r(value, search, replacement);
  });

  for (let year = 2013; year <= 2026; year += 1) {
    value = r(value, `/${year},`, `/${year} `);
    value = r(value, `/${year}.`, `/${year} `);
  }

  for (let day = 1; day <= 9; day += 1) {
    value = r(value, ` ${day}/`, ` 0${day}/`);
  }

  return value;
}

function normalizeObservation(text: unknown) {
  let value = normalizeBase(text);
  value = applyPriorityFixes(value);
  value = applyObservationReplacements(value);
  value = normalizeBase(value);
  value = applyPriorityFixes(value);
  return value;
}

function normalizeForSearch(text: unknown) {
  let value = String(text || "")
    .toUpperCase()
    .trim();
  value = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  value = value.replace(/\u00a0/g, " ");
  while (value.includes("  ")) value = value.replaceAll("  ", " ");
  return value;
}

function hasAcumuladoPhrase(text: unknown) {
  const value = normalizeForSearch(text);
  return [
    "ACUMULAR EL PRESENTE",
    "SE ACUMULO AL",
    "EL PRESENTE ASUNTO SE ACUMULA",
    "EL PRESENTE ASUNTO SE ACUMULO",
    "SE ACUMULO CON EL",
    "ACUMULACION DEL PRESENTE JUICIO DE AMPARO AL",
    "ACUMULACION DEL PRESENTE JUICIO AL",
    "SE ACUMULA AL",
    "ACUMULADO AL",
    "ACUMULAR EL PRESENTE AL",
    "SE ACUMULA EL PRESENTE ASUNTO AL",
    "SE ACUMULA EL PRESENTE",
  ].some((phrase) => value.includes(phrase));
}

function normalizeAmpara(text: unknown) {
  return regexReplace(String(text || ""), "NO\\s+AMPARA", "Niega").trim();
}

function containsValidAmpara(text: unknown) {
  const value = normalizeAmpara(text);
  return /(^|[^A-ZÁÉÍÓÚÑ])AMPARA([^A-ZÁÉÍÓÚÑ]|$)/i.test(value);
}

function lastTen(value: unknown) {
  const text = String(value || "").trim();
  return text.length <= 10 ? text : text.slice(-10);
}

function extractAroundPhrase(text: unknown, phrase: string, offset: number) {
  const value = String(text || "");
  const upperValue = value.toUpperCase();
  const upperPhrase = phrase.toUpperCase();
  const index = upperValue.lastIndexOf(upperPhrase);

  if (index < 0) {
    return "";
  }

  const start = index + offset;
  if (start < 0 || start >= value.length) {
    return "";
  }

  return value.slice(start, start + 10).trim();
}

function ensureColumn(headers: string[], header: string) {
  const found = findHeader(headers, header);
  if (found) {
    return found;
  }

  headers.push(header);
  return header;
}

function orderAuxiliaryColumns(headers: string[]) {
  const preferredOrder = [
    "AMPARA",
    "ACUMULADO",
    "Ult. Requerimiento",
    "Vista",
    "FEC. POR NO CUMPLIDA",
    "FEC. SIN MATERIA",
  ];
  const auxiliaryKeys = new Set(preferredOrder.map(normalizeHeader));
  const baseHeaders = headers.filter(
    (header) => !auxiliaryKeys.has(normalizeHeader(header)),
  );
  const orderedAuxiliary = preferredOrder
    .map((header) => findHeader(headers, header) || header)
    .filter((header, index, list) => list.indexOf(header) === index);

  return [...baseHeaders, ...orderedAuxiliary];
}

function parseWorkbook(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames.find(
    (name) => normalizeName(name) === REQUIRED_SHEET,
  );

  if (!sheetName) {
    throw new Error(
      "El archivo seleccionado no contiene una hoja llamada 'SENTENCIAS'.",
    );
  }

  const worksheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  const headers = (matrix[0] || []).map((header) =>
    String(header || "").trim(),
  );

  if (matrix.length < 2) {
    throw new Error(
      "La hoja 'SENTENCIAS' no contiene registros para procesar.",
    );
  }

  const rows = XLSX.utils.sheet_to_json<Row>(worksheet, {
    defval: "",
    raw: false,
  });

  return { sheetName, headers, rows };
}

function processRows(headersInput: string[], rows: Row[]) {
  const headers = [...headersInput];
  const colObs = findHeader(headers, "Observaciones");
  const colFechaReq = findHeader(
    headers,
    "Fecha requerimiento de cumplimiento a responsables",
  );
  const colSentidoFin = findHeader(
    headers,
    "Sentido de sentencia o resolución que puso fin al juicio",
  );
  const colSentidoEjecutoria = findHeader(
    headers,
    "Sentido ejecutoria Tribunal Colegiado de Circuito contra sentencia",
  );

  if (!colObs) throw new Error("No se encontró la columna 'Observaciones'.");
  if (!colFechaReq)
    throw new Error(
      "No se encontró la columna 'Fecha requerimiento de cumplimiento a responsables'.",
    );
  if (!colSentidoFin)
    throw new Error(
      "No se encontró la columna 'Sentido de sentencia o resolución que puso fin al juicio'.",
    );
  if (!colSentidoEjecutoria)
    throw new Error(
      "No se encontró la columna 'Sentido ejecutoria Tribunal Colegiado de Circuito contra sentencia'.",
    );

  const colAmpara = ensureColumn(headers, "AMPARA");
  const colAcumulado = ensureColumn(headers, "ACUMULADO");
  const colUltReq = ensureColumn(headers, "Ult. Requerimiento");
  const colVista = ensureColumn(headers, "Vista");
  const colNoCumplida = ensureColumn(headers, "FEC. POR NO CUMPLIDA");
  const colSinMateria = ensureColumn(headers, "FEC. SIN MATERIA");
  const orderedHeaders = orderAuxiliaryColumns(headers);

  let observacionesNormalizadas = 0;
  let acumulados = 0;
  let amparan = 0;

  const processedRows = rows.map((row) => {
    const next = { ...row };
    const originalObs = String(next[colObs] || "");
    const obs = originalObs.trim()
      ? normalizeObservation(originalObs)
      : originalObs;

    if (obs !== originalObs) {
      observacionesNormalizadas += 1;
    }

    next[colObs] = obs;
    next[colUltReq] = lastTen(next[colFechaReq]);
    next[colVista] = extractAroundPhrase(
      obs,
      "CUMPLIMIENTO DE LA RESPONSABLE",
      51,
    );
    next[colNoCumplida] = extractAroundPhrase(
      obs,
      "LA SENTENCIA SE TUVO POR NO CUMPLIDA",
      -11,
    );
    next[colSinMateria] = extractAroundPhrase(
      obs,
      "LA SENTENCIA SE DECLARO SIN MATERIA",
      -11,
    );
    next[colAcumulado] = hasAcumuladoPhrase(obs) ? "SI" : "";

    const sentidoFin = normalizeAmpara(next[colSentidoFin]);
    const sentidoEjecutoria = String(next[colSentidoEjecutoria] || "");
    next[colSentidoFin] = sentidoFin;

    if (containsValidAmpara(sentidoEjecutoria)) {
      next[colAmpara] = "SI";
    } else if (containsValidAmpara(sentidoFin)) {
      next[colAmpara] =
        !sentidoEjecutoria.trim() ||
        /(^|[^A-ZÁÉÍÓÚÑ])INTOCADO([^A-ZÁÉÍÓÚÑ]|$)/i.test(sentidoEjecutoria)
          ? "SI"
          : "";
    } else {
      next[colAmpara] = "";
    }

    if (next[colAcumulado]) acumulados += 1;
    if (next[colAmpara]) amparan += 1;

    return next;
  });

  return {
    headers: orderedHeaders,
    rows: processedRows,
    summary: {
      total: processedRows.length,
      observacionesNormalizadas,
      acumulados,
      amparan,
      columnasAgregadas: headers.length - headersInput.length,
    },
  };
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  try {
    const parsed = parseWorkbook(event.data.buffer);

    if (event.data.action === "load") {
      self.postMessage({
        ok: true,
        action: "load",
        sheetName: parsed.sheetName,
        headers: parsed.headers,
        rows: parsed.rows,
        summary: { total: parsed.rows.length },
      });
      return;
    }

    const processed = processRows(parsed.headers, parsed.rows);
    self.postMessage({
      ok: true,
      action: "process",
      sheetName: parsed.sheetName,
      ...processed,
    });
  } catch (error) {
    self.postMessage({
      ok: false,
      action: event.data.action,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo procesar el archivo.",
    });
  }
};

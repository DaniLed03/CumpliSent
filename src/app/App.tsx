import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import logoImg from "../assets/Cumplisent.png";
import {
  Calendar,
  CheckCircle,
  ChevronLeft,
  CircleHelp,
  Edit,
  FileText,
  Download,
  Loader2,
  LogOut,
  Menu,
  Server,
  Shield,
  Upload,
  Users,
  X,
  Clock,
  ClipboardList,
  FileSpreadsheet,
  TableProperties,
  Trash2
} from "lucide-react";
import CumplimientosExcel from "./components/CumplimientosExcel";
import LoginScreen from "./components/LoginScreen";
import ServerConfig from "./components/ServerConfig";
import UserManagement from "./components/UserManagement";
import RolePermissions from "./components/RolePermissions";
import MesasTramite from "./components/MesasTramite";
import TrabajoDiario from "./components/TrabajoDiario";
import IngresosExpedientes from "./components/IngresosExpedientes";
import { confirmAlert, showStyledAlert } from "./utils/alert";
import { toastError, toastSuccess, toastWarning } from "./utils/toast";

interface DiaInhabil {
  id: string;
  fecha: string;
}

type ViewKey =
  | "cumplimientos"
  | "procesar"
  | "dias-inhabiles"
  | "servidor"
  | "usuarios"
  | "roles"
  | "mesas"
  | "trabajo-diario"
  | "ingresos-expedientes";

const VIEW_TITLES: Record<ViewKey, string> = {
  cumplimientos: "Cumplimientos",
  procesar: "Normalización de la información",
  "dias-inhabiles": "Días inhábiles",
  servidor: "Servidor",
  usuarios: "Usuarios",
  roles: "Roles y permisos",
  mesas: "Mesas de trámite",
  "trabajo-diario": "Trabajo diario",
  "ingresos-expedientes": "Ingresos de expedientes",
};

const VIEW_PERMISSIONS: Record<ViewKey, string> = {
  cumplimientos: "view.cumplimientos",
  procesar: "view.procesar",
  "dias-inhabiles": "view.dias_inhabiles",
  servidor: "view.servidor",
  usuarios: "view.usuarios",
  roles: "view.roles",
  mesas: "view.mesas",
  "trabajo-diario": "view.trabajo_diario",
  "ingresos-expedientes": "view.ingresos_expedientes",
};

function getBackend() {
  return window.cumplimientosBackend;
}

function formatDate(value: string | boolean) {
  if (!value || typeof value === "boolean") return "-";
  const iso = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const mx = String(value).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (mx)
    return `${mx[1].padStart(2, "0")}/${mx[2].padStart(2, "0")}/${mx[3].padStart(4, "20")}`;
  return String(value);
}

function numberValue(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function bandFromStatus(estatus: unknown, dias: unknown) {
  const n = numberValue(estatus) ?? numberValue(dias);
  if (n === null) return "Sin estatus";
  if (n <= 3) return "En plazo";
  if (n <= 6) return "Atención";
  if (n <= 9) return "Requerir";
  return "Vencido";
}

function NavItem({
  icon,
  label,
  active,
  collapsed,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs font-semibold transition-colors ${
        active
          ? "bg-blue-50 text-blue-700 border border-blue-100"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      } ${collapsed ? "justify-center" : ""}`}
    >
      {icon}
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}


type SentenciasResult = {
  sheetName: string;
  headers: string[];
  rows: Record<string, unknown>[];
  summary: {
    total: number;
    observacionesNormalizadas?: number;
    acumulados?: number;
    amparan?: number;
    columnasAgregadas?: number;
  };
};

function ProcesarView() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<SentenciasResult | null>(null);
  const [processed, setProcessed] = useState<SentenciasResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [error, setError] = useState("");
  const [scrollTop, setScrollTop] = useState(0);

  const activeResult = processed || preview;
  const rowHeight = 34;
  const visibleStart = activeResult
    ? Math.max(0, Math.floor(scrollTop / rowHeight) - 12)
    : 0;
  const visibleRows =
    activeResult?.rows.slice(visibleStart, visibleStart + 70) || [];
  const topSpacer = visibleStart * rowHeight;
  const bottomSpacer = activeResult
    ? Math.max(
        0,
        (activeResult.rows.length - visibleStart - visibleRows.length) *
          rowHeight,
      )
    : 0;

  const runWorker = (file: File, action: "load" | "process") =>
    new Promise<SentenciasResult>((resolve, reject) => {
      const worker = new Worker(
        new URL("./workers/sentenciasWorker.ts", import.meta.url),
        { type: "module" },
      );
      const reader = new FileReader();

      reader.onerror = () => {
        worker.terminate();
        reject(new Error("No se pudo leer el archivo."));
      };

      reader.onload = () => {
        worker.onmessage = (event) => {
          worker.terminate();
          if (!event.data?.ok) {
            reject(
              new Error(event.data?.error || "No se pudo procesar el archivo."),
            );
            return;
          }
          resolve({
            sheetName: event.data.sheetName,
            headers: event.data.headers,
            rows: event.data.rows,
            summary: event.data.summary,
          });
        };
        worker.onerror = (event) => {
          worker.terminate();
          reject(
            new Error(event.message || "No se pudo iniciar el procesador."),
          );
        };
        worker.postMessage({ action, buffer: reader.result });
      };

      reader.readAsArrayBuffer(file);
    });

  const handleFile = async (file: File | null) => {
    setSelectedFile(file);
    setPreview(null);
    setProcessed(null);
    setError("");
    setScrollTop(0);
    if (!file) return;

    setLoading(true);
    try {
      const result = await runWorker(file, "load");
      setPreview(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo leer el archivo.";
      setError(message);
      toastError("Error al leer SENTENCIAS", message);
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async () => {
    if (!selectedFile) return;
    setProcessing(true);
    setError("");
    setProgressLabel("Leyendo...");
    const timers = [
      window.setTimeout(() => setProgressLabel("Normalizando..."), 250),
      window.setTimeout(() => setProgressLabel("Calculando..."), 750),
      window.setTimeout(() => setProgressLabel("Finalizando..."), 1250),
    ];

    try {
      const result = await runWorker(selectedFile, "process");
      setProcessed(result);
      setScrollTop(0);
      toastSuccess(
        "Procesamiento completado",
        `${result.summary.total} registros procesados.`,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo procesar el archivo.";
      setError(message);
      toastError("Error al procesar SENTENCIAS", message);
    } finally {
      timers.forEach((timer) => window.clearTimeout(timer));
      setProcessing(false);
      setProgressLabel("");
    }
  };

  const handleDownload = async () => {
    if (!processed || !selectedFile) return;
    const XLSX = await import("xlsx");
    const matrix = [
      processed.headers,
      ...processed.rows.map((row) =>
        processed.headers.map((header) => row[header] ?? ""),
      ),
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(matrix);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      processed.sheetName || "SENTENCIAS",
    );
    const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([output], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedFile.name.replace(/\.(xlsx|xlsm|xls)$/i, "") || "SENTENCIAS"}_limpio.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full min-h-0 flex flex-col gap-4 relative">
      {error && (
        <div className="fixed right-4 top-4 z-50 max-w-md rounded-lg border border-red-300 bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-xl">
          {error}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex-shrink-0">
        <h3 className="font-semibold text-sm text-blue-900 mb-2">
          Instrucciones
        </h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Seleccione un archivo Excel con la hoja SENTENCIAS.</li>
          <li>
            El sistema limpiara observaciones, detectara columnas auxiliares y
            normalizara la informacion.
          </li>
          <li>
            Al terminar podra descargar el archivo limpio en formato XLSX.
          </li>
        </ul>
      </div>

      {!activeResult && (
        <div className="bg-card rounded-lg border border-border p-8 flex-shrink-0">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
              <Upload className="w-10 h-10 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold mb-1">
                Seleccionar Archivo SENTENCIAS
              </p>
              <p className="text-sm text-muted-foreground">
                Formatos aceptados: .xlsx, .xls, .xlsm
              </p>
            </div>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls,.xlsm"
                onChange={(event) =>
                  handleFile(event.target.files?.[0] || null)
                }
                className="hidden"
              />
              <span className="inline-flex items-center justify-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                <Upload className="w-4 h-4" />
                Seleccionar Archivo
              </span>
            </label>
            {loading && (
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Loader2 className="w-4 h-4 animate-spin" />
                Leyendo archivo y detectando hoja SENTENCIAS...
              </div>
            )}
          </div>
        </div>
      )}

      {activeResult && (
        <div className="bg-card rounded-lg border border-border overflow-hidden flex-1 min-h-[360px] flex flex-col">
          <div className="p-4 border-b border-border flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-shrink-0">
            <div>
              <h3 className="font-semibold text-sm">
                {processed
                  ? "Preview de SENTENCIAS procesada"
                  : "Tabla detectada en SENTENCIAS"}
              </h3>
              <p className="text-xs text-muted-foreground">
                Hoja: {activeResult.sheetName} - Registros:{" "}
                {activeResult.rows.length} - Columnas:{" "}
                {activeResult.headers.length}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {selectedFile && (
                <div className="flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  <div>
                    <p className="text-[11px] font-semibold leading-tight">
                      {selectedFile.name}
                    </p>
                    <p className="text-[10px] font-medium leading-tight text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
              )}
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-white px-4 py-2 text-xs font-semibold hover:bg-accent transition-colors">
                <input
                  type="file"
                  accept=".xlsx,.xls,.xlsm"
                  onChange={(event) =>
                    handleFile(event.target.files?.[0] || null)
                  }
                  className="hidden"
                />
                <Upload className="w-4 h-4" />
                Cambiar archivo
              </label>
              {!processed && (
                <button
                  onClick={handleProcess}
                  disabled={processing}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Loader2
                    className={`w-4 h-4 ${processing ? "animate-spin" : ""}`}
                  />
                  {processing ? "Procesando..." : "Normalizar la informacion"}
                </button>
              )}
              {processed && (
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Descargar Excel
                </button>
              )}
            </div>
          </div>

          <div className="relative flex-1 min-h-0">
            {processing && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
                <div className="relative flex h-44 w-44 items-center justify-center rounded-full border border-blue-100 bg-white shadow-xl">
                  <div className="absolute inset-3 rounded-full border-[9px] border-blue-100 border-t-[#1e40af] border-r-blue-500 animate-spin" />
                  <div className="absolute inset-8 rounded-full bg-blue-50/80" />
                  <div className="relative z-10 max-w-28 text-center text-base font-semibold leading-tight text-[#1e40af]">
                    {progressLabel || "Procesando..."}
                  </div>
                </div>
              </div>
            )}
            <div
              className="h-full overflow-auto"
              onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
            >
              <table className="w-full min-w-max text-xs border-collapse">
                <thead className="bg-[#1e40af] text-white sticky top-0 z-10">
                  <tr>
                    {activeResult.headers.map((header) => (
                      <th
                        key={header}
                        className="px-3 py-2 text-left font-semibold border-r border-blue-600 whitespace-nowrap"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topSpacer > 0 && (
                    <tr style={{ height: topSpacer }}>
                      <td
                        colSpan={activeResult.headers.length}
                        className="p-0 border-0"
                      />
                    </tr>
                  )}
                  {visibleRows.map((row, index) => (
                    <tr
                      key={`${visibleStart}-${index}`}
                      style={{ height: rowHeight }}
                      className="border-b border-border hover:bg-muted/40"
                    >
                      {activeResult.headers.map((header) => (
                        <td
                          key={header}
                          className="px-3 py-2 border-r border-border whitespace-nowrap max-w-[260px] truncate"
                        >
                          {String(row[header] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {bottomSpacer > 0 && (
                    <tr style={{ height: bottomSpacer }}>
                      <td
                        colSpan={activeResult.headers.length}
                        className="p-0 border-0"
                      />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {processed && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 flex-shrink-0">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-green-900 mb-3">
                Procesamiento Completado
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-2xl font-bold text-green-900">
                    {processed.summary.total}
                  </p>
                  <p className="text-sm text-green-700">Total Procesados</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-900">
                    {processed.summary.observacionesNormalizadas || 0}
                  </p>
                  <p className="text-sm text-green-700">
                    Observaciones Limpias
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-900">
                    {processed.summary.acumulados || 0}
                  </p>
                  <p className="text-sm text-green-700">Acumulados</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-900">
                    {processed.summary.amparan || 0}
                  </p>
                  <p className="text-sm text-green-700">AMPARA</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-900">
                    {processed.summary.columnasAgregadas || 0}
                  </p>
                  <p className="text-sm text-green-700">Columnas Agregadas</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function DiasInhabilesView({
  diasInhabiles,
  setDiasInhabiles,
  canAdd,
  canImport,
  canEdit,
  canDelete,
}: {
  diasInhabiles: DiaInhabil[];
  setDiasInhabiles: (dias: DiaInhabil[]) => void;
  canAdd: boolean;
  canImport: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [nuevaFecha, setNuevaFecha] = useState("");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [importingExcel, setImportingExcel] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [importError, setImportError] = useState("");
  const [diaEditando, setDiaEditando] = useState<DiaInhabil | null>(null);
  const [fechaEditando, setFechaEditando] = useState("");
  const [diaToDelete, setDiaToDelete] = useState<DiaInhabil | null>(null);

  const persistDias = (dias: DiaInhabil[]) => {
    const ordered = [...dias].sort((a, b) =>
      String(a.fecha).localeCompare(String(b.fecha)),
    );
    setDiasInhabiles(ordered);
    getBackend()
      .replaceInhabiles(ordered)
      .then((rows) => {
        if (Array.isArray(rows)) setDiasInhabiles(rows);
        toastSuccess(
          "Calendario guardado",
          "Los días inhábiles se sincronizaron correctamente.",
        );
      })
      .catch((error) => {
        toastError(
          "Error al guardar calendario",
          error instanceof Error
            ? error.message
            : "No se pudieron guardar los días inhábiles.",
        );
      });
  };

  const handleAgregar = () => {
    if (!nuevaFecha) {
      toastWarning("Fecha requerida", "Selecciona una fecha para agregar.");
      return;
    }
    if (diasInhabiles.some((dia) => dia.fecha === nuevaFecha)) {
      toastWarning("Fecha duplicada", "El día inhábil ya está registrado.");
      return;
    }
    persistDias([
      ...diasInhabiles,
      { id: `manual-${Date.now()}`, fecha: nuevaFecha },
    ]);
    setNuevaFecha("");
  };

  const handleEliminar = (dia: DiaInhabil) => {
    setDiaToDelete(dia);
  };

  const confirmDeleteDia = () => {
    if (diaToDelete) {
      persistDias(diasInhabiles.filter((item) => item.id !== diaToDelete.id));
      setDiaToDelete(null);
    }
  };

  const handleGuardarEdicion = () => {
    if (!diaEditando || !fechaEditando) {
      toastWarning(
        "Fecha requerida",
        "Selecciona una fecha valida para guardar.",
      );
      return;
    }
    if (
      diasInhabiles.some(
        (dia) => dia.id !== diaEditando.id && dia.fecha === fechaEditando,
      )
    ) {
      toastWarning("Fecha duplicada", "El día inhábil ya está registrado.");
      return;
    }
    persistDias(
      diasInhabiles.map((dia) =>
        dia.id === diaEditando.id ? { ...dia, fecha: fechaEditando } : dia,
      ),
    );
    setDiaEditando(null);
    setFechaEditando("");
  };

  const normalizeHeader = (value: unknown) =>
    String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  const parseExcelDate = (value: unknown, XLSX: typeof import("xlsx")) => {
    if (!value) return "";
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
    }
    if (typeof value === "number") {
      const parsed = XLSX.SSF.parse_date_code(value);
      return parsed
        ? `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`
        : "";
    }
    const text = String(value).trim();
    const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso)
      return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    const mx = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (!mx) return "";
    return `${mx[3].length === 2 ? `20${mx[3]}` : mx[3]}-${mx[2].padStart(2, "0")}-${mx[1].padStart(2, "0")}`;
  };

  const handleImportarExcel = async () => {
    if (!excelFile) return;
    setImportingExcel(true);
    setImportMessage("");
    setImportError("");

    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await excelFile.arrayBuffer(), {
        type: "array",
        cellDates: true,
      });
      let targetRows: unknown[][] = [];
      let headerRowIndex = -1;
      let targetColumnIndex = -1;

      for (const sheetName of workbook.SheetNames) {
        const rows = XLSX.utils.sheet_to_json<unknown[]>(
          workbook.Sheets[sheetName],
          { header: 1, raw: true, defval: "" },
        );
        for (
          let rowIndex = 0;
          rowIndex < Math.min(rows.length, 25);
          rowIndex += 1
        ) {
          const columnIndex = rows[rowIndex].findIndex((value) => {
            const header = normalizeHeader(value);
            return (
              header.includes("diasinhabiles") || header.includes("diainhabil")
            );
          });
          if (columnIndex >= 0) {
            targetRows = rows;
            headerRowIndex = rowIndex;
            targetColumnIndex = columnIndex;
            break;
          }
        }
        if (targetColumnIndex >= 0) break;
      }

      if (targetColumnIndex < 0) {
        throw new Error('No se encontró la columna "DÍAS INHÁBILES".');
      }

      const existingDates = new Set(diasInhabiles.map((dia) => dia.fecha));
      const importedDates = new Set<string>();
      const importedDays: DiaInhabil[] = [];

      targetRows.slice(headerRowIndex + 1).forEach((row, index) => {
        const date = parseExcelDate(row[targetColumnIndex], XLSX);
        if (!date || existingDates.has(date) || importedDates.has(date)) return;
        importedDates.add(date);
        importedDays.push({ id: `excel-${Date.now()}-${index}`, fecha: date });
      });

      if (importedDays.length === 0) {
        setImportMessage("No se encontraron fechas nuevas para importar.");
        toastWarning(
          "Sin fechas nuevas",
          "No se encontraron días inhábiles nuevos para importar.",
        );
        return;
      }

      persistDias([...diasInhabiles, ...importedDays]);
      setImportMessage(`Se importaron ${importedDays.length} días inhábiles.`);
      setExcelFile(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo importar el archivo Excel.";
      setImportError(message);
      showStyledAlert({
        title: "Error al importar",
        text: message,
        icon: "error",
      });
    } finally {
      setImportingExcel(false);
    }
  };

  const canModifyRows = canEdit || canDelete;

  return (
    <div className="h-full min-h-0 flex flex-col gap-5 p-2">
      {(canAdd || canImport) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 flex-shrink-0 items-start">
          {canAdd && <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4 text-blue-600" />
              </div>
              <h3 className="font-bold text-sm text-slate-800 tracking-wide uppercase">
                Agregar Día Inhábil Manualmente
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
              <div className="min-w-0">
                <input
                  type="date"
                  value={nuevaFecha}
                  onChange={(e) => setNuevaFecha(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleAgregar}
                  disabled={!nuevaFecha}
                  className="w-full md:w-auto px-6 py-2 bg-[#1e40af] text-white rounded-lg hover:bg-blue-800 transition-all font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>}

          {canImport && <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 relative">

            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-emerald-600" />
              </div>
              <h3 className="font-bold text-sm text-slate-800 tracking-wide uppercase">
                Importar desde Excel
              </h3>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="cursor-pointer flex-1 min-w-0">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.xlsm"
                    onChange={(event) => {
                      setExcelFile(event.target.files?.[0] || null);
                      setImportMessage("");
                      setImportError("");
                    }}
                    className="hidden"
                  />
                  <span className="inline-block w-full px-4 py-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors text-center text-sm font-semibold border border-slate-200 truncate">
                    {excelFile ? excelFile.name : "Seleccionar Archivo Excel"}
                  </span>
                </label>
                <button
                  onClick={handleImportarExcel}
                  disabled={!excelFile || importingExcel}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  {importingExcel ? "Importando..." : "Importar"}
                </button>
              </div>
              {importMessage && (
                <p className="text-[11px] font-bold text-emerald-600 px-1">
                  {importMessage}
                </p>
              )}
              {importError && (
                <p className="text-[11px] font-bold text-red-600 px-1">
                  {importError}
                </p>
              )}
            </div>
          </div>}
        </div>
      )}


      <div
        className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 min-h-0 flex flex-col overflow-hidden"
        style={{ gridColumn: "1 / -1", width: "100%" }}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 flex-shrink-0">
          <h3 className="font-bold text-sm text-slate-800 tracking-wide uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
            Días Inhábiles Registrados
          </h3>
          <span className="bg-white border border-slate-200 text-slate-600 text-xs font-bold px-3 py-1 rounded-full shadow-sm">
            {diasInhabiles.length} registros
          </span>
        </div>
        <div className="flex-1 min-h-0 p-5 pt-4 flex flex-col">
          <div className="rounded-xl border border-slate-200 overflow-auto shadow-sm flex-1 min-h-0">
            <table className="w-full text-sm">
              <thead className="bg-[#1e40af] text-white sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider">
                    Días Inhábiles
                  </th>
                  {canModifyRows && (
                    <th className="px-5 py-3.5 text-center text-xs font-bold uppercase tracking-wider w-32">
                      Acciones
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {diasInhabiles.length === 0 ? (
                  <tr>
                    <td colSpan={canModifyRows ? 2 : 1} className="px-5 py-8 text-center text-slate-500 bg-slate-50/50">
                      No hay días inhábiles registrados.
                    </td>
                  </tr>
                ) : (
                  diasInhabiles.map((dia, index) => (
                    <tr
                      key={dia.id}
                      className={`hover:bg-blue-50/50 transition-colors ${index % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}
                    >
                      <td className="px-5 py-3 font-medium text-slate-700">
                        {formatDate(dia.fecha)}
                      </td>
                      {canModifyRows && (
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-center gap-2">
                            {canEdit && <button
                              onClick={() => {
                                setDiaEditando(dia);
                                setFechaEditando(dia.fecha);
                              }}
                              className="w-8 h-8 flex items-center justify-center text-blue-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>}
                            {canDelete && <button
                              onClick={() => handleEliminar(dia)}
                              className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors border border-transparent hover:border-red-100"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {diaEditando && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card rounded-lg shadow-2xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between bg-[#1e40af] text-white">
              <h3 className="text-sm font-bold">Editar día inhábil</h3>
              <button
                onClick={() => {
                  setDiaEditando(null);
                  setFechaEditando("");
                }}
                className="p-1.5 hover:bg-blue-700 rounded transition-colors"
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <input
                type="date"
                value={fechaEditando}
                onChange={(e) => setFechaEditando(e.target.value)}
                className="w-full px-3 py-2 bg-input-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="p-4 border-t border-border bg-muted/40 flex justify-end gap-3">
              <button
                onClick={() => {
                  setDiaEditando(null);
                  setFechaEditando("");
                }}
                className="px-4 py-2 bg-card border border-border rounded-md hover:bg-accent transition-colors text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarEdicion}
                disabled={!fechaEditando}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR DIA INHABIL */}
      {diaToDelete && createPortal(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">
                ¿Eliminar día inhábil {formatDate(diaToDelete.fecha)}?
              </h3>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setDiaToDelete(null)}
                className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteDia}
                className="flex-1 flex justify-center items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm shadow-sm"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function App() {
  const [currentView, setCurrentView] = useState<ViewKey>("cumplimientos");
  const [diasInhabiles, setDiasInhabiles] = useState<DiaInhabil[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentNow, setCurrentNow] = useState(() => new Date());
  const [session, setSession] = useState<{
    user: SessionUser;
    token?: string;
    apiUrl?: string;
  } | null>(null);
  const rolesRevisionRef = useRef<number | null>(null);

  const isAdmin = session?.user?.Rol === "ADMINISTRADOR";
  const permissions = session?.user?.Permisos || [];
  const can = (permission: string) =>
    isAdmin || permissions.includes(permission);

  useEffect(() => {
    let cancelled = false;

    window.api.restoreRemoteSession?.()
      .then((result) => {
        if (cancelled || !result?.ok || !result.user) return;
        setSession({
          user: result.user,
          token: result.token,
          apiUrl: result.apiUrl,
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const canView = (view: ViewKey) => {
    return can(VIEW_PERMISSIONS[view]);
  };

  useEffect(() => {
    if (!session) return;

    if (currentView !== "dias-inhabiles") return;

    getBackend()
      .listInhabiles()
      .then((rows) => Array.isArray(rows) && setDiasInhabiles(rows))
      .catch(() => {});
  }, [session, currentView]);

  useEffect(() => {
    if (!session) return;
    if (!canView(currentView)) {
      const fallback =
        (Object.keys(VIEW_PERMISSIONS) as ViewKey[]).find((view) =>
          canView(view),
        ) || "cumplimientos";
      setCurrentView(fallback);
    }
  }, [currentView, session]);

  useEffect(() => {
    if (!session?.apiUrl || !window.api.getRolesRevision) return;

    let cancelled = false;
    let reloadScheduled = false;

    const reloadForPermissionChange = () => {
      if (reloadScheduled) return;
      reloadScheduled = true;
      toastWarning(
        "Permisos actualizados",
        "Se detecto un cambio en roles y permisos. El sistema se recargara.",
      );
      window.setTimeout(() => {
        window.location.reload();
      }, 1200);
    };

    const watchRolesRevision = async () => {
      try {
        const initialRevision = Number(await window.api.getRolesRevision?.());
        if (cancelled || !Number.isFinite(initialRevision)) return;
        rolesRevisionRef.current = initialRevision;

        while (!cancelled && !reloadScheduled) {
          const currentRevision = rolesRevisionRef.current ?? initialRevision;
          const nextRevision = Number(
            window.api.waitForRolesRevision
              ? await window.api.waitForRolesRevision(currentRevision)
              : await window.api.getRolesRevision?.(),
          );

          if (cancelled || !Number.isFinite(nextRevision)) return;
          if (nextRevision !== currentRevision) {
            rolesRevisionRef.current = nextRevision;
            reloadForPermissionChange();
            return;
          }
        }
      } catch {
        if (!cancelled && !reloadScheduled) {
          window.setTimeout(watchRolesRevision, 5000);
        }
      }
    };

    watchRolesRevision();

    return () => {
      cancelled = true;
    };
  }, [session?.apiUrl]);

  if (!session) {
    return (
      <LoginScreen
        onLogin={(user, token, apiUrl) => setSession({ user, token, apiUrl })}
      />
    );
  }

  const mainNavItems: Array<{ view: ViewKey; icon: React.ReactNode }> = [
    { view: "cumplimientos", icon: <FileText className="w-4 h-4" /> },
    { view: "procesar", icon: <Upload className="w-4 h-4" /> },
    { view: "dias-inhabiles", icon: <Calendar className="w-4 h-4" /> },
    { view: "mesas", icon: <TableProperties className="w-4 h-4" /> },
    { view: "trabajo-diario", icon: <ClipboardList className="w-4 h-4" /> },
    { view: "ingresos-expedientes", icon: <FileSpreadsheet className="w-4 h-4" /> },
  ];
  const adminNavItems: Array<{ view: ViewKey; icon: React.ReactNode }> = [
    { view: "servidor", icon: <Server className="w-4 h-4" /> },
    { view: "usuarios", icon: <Users className="w-4 h-4" /> },
    { view: "roles", icon: <Shield className="w-4 h-4" /> },
  ];
  const navItems = [...mainNavItems, ...adminNavItems];
  const hasAdminNavItems = adminNavItems.some((item) => canView(item.view));
  const activeViewIcon = navItems.find((item) => item.view === currentView)?.icon;
  const headerDate = currentNow.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const headerTime = currentNow.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside
        className={`${sidebarOpen ? "w-72 lg:w-80" : "w-14"} bg-card border-r border-border transition-all duration-300 flex flex-col`}
      >
        <div className="p-3 border-b border-border flex items-center justify-between">
          {sidebarOpen && (
            <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
              <img
                src={logoImg}
                className="w-9 h-9 object-contain"
                alt="CumpliSent logo"
              />
              <h1 className="text-xl font-black tracking-normal whitespace-nowrap">
                <span className="text-[#0c2340]">Cumpli</span>
                <span className="text-[#0066ff]">Sent</span>
                <span className="ml-1 text-black">v10.1</span>
              </h1>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen((open) => !open)}
            className="p-1.5 hover:bg-accent rounded-md transition-colors"
          >
            {sidebarOpen ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <Menu className="w-4 h-4" />
            )}
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {mainNavItems.map(
            (item) =>
              canView(item.view) && (
                <NavItem
                  key={item.view}
                  icon={item.icon}
                  label={VIEW_TITLES[item.view]}
                  active={currentView === item.view}
                  collapsed={!sidebarOpen}
                  onClick={() => setCurrentView(item.view)}
                />
              ),
          )}
          {hasAdminNavItems && (
            <>
              {sidebarOpen && (
                <div className="pt-2 mt-2 border-t border-border">
                  <p className="px-2.5 py-1 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Administración
                  </p>
                </div>
              )}
              {adminNavItems.map(
                (item) =>
                  canView(item.view) && (
                    <NavItem
                      key={item.view}
                      icon={item.icon}
                      label={VIEW_TITLES[item.view]}
                      active={currentView === item.view}
                      collapsed={!sidebarOpen}
                      onClick={() => setCurrentView(item.view)}
                    />
                  ),
              )}
            </>
          )}
        </nav>

        <div className="border-t border-border p-3">
          {sidebarOpen && (() => {
            const getInitials = (name: string) => {
              if (!name) return '?';
              const parts = name.trim().split(/\s+/);
              return parts[0][0].toUpperCase();
            };
            
            const displayName = (session.user.NombreCompleto || session.user.Usuario).toUpperCase();
            const initials = getInitials(displayName);
            
            const nameLength = displayName.length;
            const nameFontSize = nameLength > 22 ? '10px' : nameLength > 15 ? '11px' : '13px';

            return (
              <div className="mb-4 flex items-center gap-3 min-w-0">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-lg shadow-sm border border-blue-200">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p 
                    className="font-bold text-slate-800 whitespace-normal break-words leading-tight" 
                    style={{ fontSize: nameFontSize }}
                  >
                    {displayName}
                  </p>
                  <p className="text-[9px] text-slate-500 font-bold truncate uppercase tracking-wider mt-1" title={session.user.Rol}>
                    {session.user.Rol}
                  </p>
                </div>
              </div>
            );
          })()}
          <button
            onClick={() => {
              window.api.clearRemoteSession?.();
              setSession(null);
              setCurrentView("cumplimientos");
            }}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-3.5 h-3.5" />
            {sidebarOpen && "Cerrar sesión"}
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col uppercase">
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-black truncate">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                {activeViewIcon}
              </span>
              <span className="truncate">{VIEW_TITLES[currentView]}</span>
            </h2>
            <p className="text-[11px] text-muted-foreground truncate">
              {currentView === "cumplimientos"
                ? "Control de seguimiento de cumplimiento de sentencias de amparo"
                : "Sistema de Control de Cumplimiento"}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-700">
              <Calendar className="h-3.5 w-3.5" />
              {headerDate}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 font-bold text-blue-700">
              <Clock className="h-3.5 w-3.5" />
              {headerTime}
            </span>
          </div>
        </header>

        <section className="flex-1 min-h-0 p-4 bg-muted/20">
          {currentView === "cumplimientos" && (
            <CumplimientosExcel permissions={permissions} isAdmin={isAdmin} />
          )}
          {currentView === "procesar" && <ProcesarView />}
          {currentView === "dias-inhabiles" && (
            <DiasInhabilesView
              diasInhabiles={diasInhabiles}
              setDiasInhabiles={setDiasInhabiles}
              canAdd={can("dias_inhabiles.add")}
              canImport={can("dias_inhabiles.import")}
              canEdit={can("dias_inhabiles.edit")}
              canDelete={can("dias_inhabiles.delete")}
            />
          )}
          {currentView === "servidor" && <ServerConfig canManage={can("view.servidor")} />}
          {currentView === "usuarios" && (
            <UserManagement
              canCreate={can("users.create")}
              canEdit={can("users.edit")}
              canDelete={can("users.delete")}
              canAssignMesa={can("users.edit")}
            />
          )}
          {currentView === "roles" && (
            <RolePermissions
              canCreate={can("roles.create")}
              canEdit={can("roles.edit")}
              canDelete={can("roles.delete")}
              canAssignPermissions={can("roles.create") || can("roles.edit")}
            />
          )}
          {currentView === "mesas" && (
            <MesasTramite permissions={permissions} isAdmin={isAdmin} session={session} />
          )}
          {currentView === "trabajo-diario" && (
            <TrabajoDiario permissions={permissions} isAdmin={isAdmin} session={session} />
          )}
          {currentView === "ingresos-expedientes" && (
            <IngresosExpedientes permissions={permissions} isAdmin={isAdmin} session={session} />
          )}
        </section>
      </main>
    </div>
  );
}

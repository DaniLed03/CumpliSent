import { useCallback, useDeferredValue, useEffect, useRef, useState, useMemo } from 'react';
import {
  X,
  Eye,
  Edit,
  AlertTriangle,
  CheckCircle,
  Download,
  Upload,
  PlusCircle,
  RefreshCw,
  Info,
  Calendar,
  Clock,
  Save,
  ArrowUpDown,
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  FileSpreadsheet,
  Filter,
} from 'lucide-react';
import { toastError, toastSuccess, toastWarning } from '../utils/toast';

// Componente principal de Cumplimientos tipo Excel
interface Expediente {
  id: string;
  numeroOrden: number;
  numeroJuicio: string;
  materia: string;
  sentencia: string;
  fechaEjecutoriaColegiado: string;
  fechaEjecutoriaInconformidad: string;
  fechaEjecutoria: string;
  fechaPorNoCumplida: string;
  ultEjecutoria: string;
  ultimoRequerimiento: string;
  diasNaturalesTranscurridos: number | string;
  diasHabilesTranscurridos: number | string;
  estatus: number | string;
  seDeclaroSinMateria: string | boolean;
  fechaVista: string;
  revisionContraSentencia: string;
  fechaCumplimiento: string;
  fechaArchivo: string;
  cumplimientoMenorFechaEjecutoria: string | boolean;
  observaciones: string;
  localizado: boolean;
  actualizado: string;
  firma: string;
  vistaMayorUltEjecutoria: string | boolean;
}

declare global {
  interface Window {
    cumplimientosBackend: any;
  }
}

const TABLE_ROW_HEIGHT = 38;
const TABLE_OVERSCAN_ROWS = 14;
const TABLE_COLUMN_COUNT = 25;

type EstatusBand = 'EMPTY' | 'GREEN' | 'YELLOW' | 'PINK' | 'RED';
type SortDirection = 'ASC' | 'DESC';
type SortColumnKey = keyof Expediente;
type SortLevel = {
  id: string;
  column: SortColumnKey;
  direction: SortDirection;
};

type DateFilterTreeNode = {
  id: string;
  label: string;
  values: string[];
  children?: DateFilterTreeNode[];
};

const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const SORT_COLUMNS: Array<{ key: SortColumnKey; label: string; type: 'number' | 'text' | 'date' | 'boolean' | 'estatus' }> = [
  { key: 'numeroOrden', label: 'NÚMERO DE ORDEN', type: 'number' },
  { key: 'numeroJuicio', label: 'NÚMERO DE JUICIO', type: 'text' },
  { key: 'materia', label: 'MATERIA', type: 'text' },
  { key: 'sentencia', label: 'SENTENCIA', type: 'date' },
  { key: 'fechaEjecutoriaColegiado', label: 'FECHA EJECUTORIA COLEGIADO', type: 'date' },
  { key: 'fechaEjecutoriaInconformidad', label: 'FECHA EJECUTORIA INCONFORMIDAD', type: 'date' },
  { key: 'fechaEjecutoria', label: 'FECHA DE EJECUTORIA', type: 'date' },
  { key: 'fechaPorNoCumplida', label: 'FECHA POR NO CUMPLIDA', type: 'date' },
  { key: 'ultEjecutoria', label: 'ULT. EJECUTORIA', type: 'date' },
  { key: 'ultimoRequerimiento', label: 'ULTIMO REQUERIMIENTO', type: 'date' },
  { key: 'diasNaturalesTranscurridos', label: 'DÍAS NATURALES TRANSCURRIDOS', type: 'number' },
  { key: 'diasHabilesTranscurridos', label: 'DÍAS HÁBILES TRANSCURRIDOS', type: 'number' },
  { key: 'estatus', label: 'ESTATUS', type: 'estatus' },
  { key: 'seDeclaroSinMateria', label: 'SE DECLARO SIN MATERIA', type: 'date' },
  { key: 'fechaVista', label: 'FECHA DE VISTA', type: 'date' },
  { key: 'revisionContraSentencia', label: 'REVISION CONTRA SENTENCIA', type: 'date' },
  { key: 'fechaCumplimiento', label: 'FECHA DE CUMPLIMIENTO', type: 'date' },
  { key: 'fechaArchivo', label: 'FECHA DE ARCHIVO', type: 'date' },
  { key: 'cumplimientoMenorFechaEjecutoria', label: 'CUMPLIMIENTO < FECHA EJECUTORIA', type: 'text' },
  { key: 'observaciones', label: 'OBSERVACIONES', type: 'text' },
  { key: 'localizado', label: 'LOCALIZADO', type: 'boolean' },
  { key: 'actualizado', label: 'ACTUALIZADO', type: 'date' },
  { key: 'firma', label: 'FIRMA', type: 'text' },
  { key: 'vistaMayorUltEjecutoria', label: 'VISTA>ULT.EJECUTORIA', type: 'text' },
];

const DEFAULT_SORT_LEVELS: SortLevel[] = [];
const SORT_STORAGE_KEY = 'cumplimientos.sortLevels.v1';

function loadSavedSortLevels(): SortLevel[] {
  if (typeof window === 'undefined') return DEFAULT_SORT_LEVELS;

  try {
    const raw = window.localStorage.getItem(SORT_STORAGE_KEY);
    if (!raw) return DEFAULT_SORT_LEVELS;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_SORT_LEVELS;

    return parsed
      .slice(0, 64)
      .filter((level): level is SortLevel =>
        level &&
        SORT_COLUMNS.some((column) => column.key === level.column) &&
        (level.direction === 'ASC' || level.direction === 'DESC')
      )
      .map((level, index) => ({
        id: typeof level.id === 'string' ? level.id : `nivel-${index + 1}`,
        column: level.column,
        direction: level.direction,
      }));
  } catch {
    return DEFAULT_SORT_LEVELS;
  }
}

function saveSortLevels(levels: SortLevel[]) {
  if (typeof window === 'undefined') return;

  try {
    if (levels.length === 0) {
      window.localStorage.removeItem(SORT_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(
      SORT_STORAGE_KEY,
      JSON.stringify(levels.map(({ id, column, direction }) => ({ id, column, direction })))
    );
  } catch {
    // El ordenamiento sigue funcionando aunque el navegador bloquee localStorage.
  }
}

const TABLE_HEADERS: Array<{ key: SortColumnKey; label: string; minWidth: string; align?: 'left' | 'center' }> = [
  { key: 'numeroOrden', label: 'NÚMERO DE ORDEN', minWidth: 'min-w-[130px]', align: 'center' },
  { key: 'numeroJuicio', label: 'NÚMERO DE JUICIO', minWidth: 'min-w-[140px]' },
  { key: 'materia', label: 'MATERIA', minWidth: 'min-w-[100px]' },
  { key: 'sentencia', label: 'SENTENCIA', minWidth: 'min-w-[150px]' },
  { key: 'fechaEjecutoriaColegiado', label: 'FECHA EJECUTORIA COLEGIADO', minWidth: 'min-w-[120px]' },
  { key: 'fechaEjecutoriaInconformidad', label: 'FECHA EJECUTORIA INCONFORMIDAD', minWidth: 'min-w-[140px]' },
  { key: 'fechaEjecutoria', label: 'FECHA DE EJECUTORIA', minWidth: 'min-w-[110px]' },
  { key: 'fechaPorNoCumplida', label: 'FECHA POR NO CUMPLIDA', minWidth: 'min-w-[120px]' },
  { key: 'ultEjecutoria', label: 'ULT. EJECUTORIA', minWidth: 'min-w-[100px]' },
  { key: 'ultimoRequerimiento', label: 'ULTIMO REQUERIMIENTO', minWidth: 'min-w-[160px]' },
  { key: 'diasNaturalesTranscurridos', label: 'DÍAS NATURALES TRANSCURRIDOS', minWidth: 'min-w-[190px]', align: 'center' },
  { key: 'diasHabilesTranscurridos', label: 'DÍAS HÁBILES TRANSCURRIDOS', minWidth: 'min-w-[190px]', align: 'center' },
  { key: 'estatus', label: 'ESTATUS', minWidth: 'min-w-[140px]', align: 'center' },
  { key: 'seDeclaroSinMateria', label: 'SE DECLARO SIN MATERIA', minWidth: 'min-w-[170px]', align: 'center' },
  { key: 'fechaVista', label: 'FECHA DE VISTA', minWidth: 'min-w-[100px]' },
  { key: 'revisionContraSentencia', label: 'REVISION CONTRA SENTENCIA', minWidth: 'min-w-[130px]', align: 'center' },
  { key: 'fechaCumplimiento', label: 'FECHA DE CUMPLIMIENTO', minWidth: 'min-w-[120px]' },
  { key: 'fechaArchivo', label: 'FECHA DE ARCHIVO', minWidth: 'min-w-[110px]' },
  { key: 'cumplimientoMenorFechaEjecutoria', label: 'CUMPLIMIENTO < FECHA EJECUTORIA', minWidth: 'min-w-[140px]', align: 'center' },
  { key: 'observaciones', label: 'OBSERVACIONES', minWidth: 'min-w-[180px]' },
  { key: 'localizado', label: 'LOCALIZADO', minWidth: 'min-w-[80px]', align: 'center' },
  { key: 'actualizado', label: 'ACTUALIZADO', minWidth: 'min-w-[100px]' },
  { key: 'firma', label: 'FIRMA', minWidth: 'min-w-[130px]', align: 'center' },
  { key: 'vistaMayorUltEjecutoria', label: 'VISTA>ULT.EJECUTORIA', minWidth: 'min-w-[120px]', align: 'center' },
];

const EXPORT_COLUMNS: Array<{ header: string; key: keyof Expediente; type?: 'date' | 'boolean' | 'validation' }> = [
  { header: 'NÚMERO DE ORDEN', key: 'numeroOrden' },
  { header: 'NÚMERO DE JUICIO', key: 'numeroJuicio' },
  { header: 'MATERIA', key: 'materia' },
  { header: 'SENTENCIA', key: 'sentencia', type: 'date' },
  { header: 'FECHA EJECUTORIA COLEGIADO', key: 'fechaEjecutoriaColegiado', type: 'date' },
  { header: 'FECHA EJECUTORIA INCONFORMIDAD', key: 'fechaEjecutoriaInconformidad', type: 'date' },
  { header: 'FECHA DE EJECUTORIA', key: 'fechaEjecutoria', type: 'date' },
  { header: 'FECHA POR NO CUMPLIDA', key: 'fechaPorNoCumplida', type: 'date' },
  { header: 'ULT. EJECUTORIA', key: 'ultEjecutoria', type: 'date' },
  { header: 'ÚLTIMO REQUERIMIENTO', key: 'ultimoRequerimiento', type: 'date' },
  { header: 'DIAS  NATURALES TRANSCURRIDOS', key: 'diasNaturalesTranscurridos' },
  { header: 'DÍAS HABILES TRANSCURRIDOS', key: 'diasHabilesTranscurridos' },
  { header: 'ESTATUS', key: 'estatus' },
  { header: 'SE DECLARÓ SIN MATERIA', key: 'seDeclaroSinMateria', type: 'date' },
  { header: 'FECHA DE VISTA', key: 'fechaVista', type: 'date' },
  { header: 'REVISION CONTRA SENTENCIA', key: 'revisionContraSentencia', type: 'date' },
  { header: 'FECHA DE CUMPLIMIENTO', key: 'fechaCumplimiento', type: 'date' },
  { header: 'FECHA DE ARCHIVO', key: 'fechaArchivo', type: 'date' },
  { header: 'CUMPLIMIENTO < FECHA EJECUTORIA', key: 'cumplimientoMenorFechaEjecutoria', type: 'validation' },
  { header: 'OBSERVACIONES', key: 'observaciones' },
  { header: 'LOCALIZADO', key: 'localizado', type: 'boolean' },
  { header: 'ACTUALIZADO', key: 'actualizado', type: 'date' },
  { header: 'FIRMA', key: 'firma' },
  { header: 'VISTA>ULT.EJECUTORIA', key: 'vistaMayorUltEjecutoria', type: 'validation' },
];

const EXPORT_COLUMN_WIDTHS = [
  24.16, 17.91, 28.58, 22.91, 23.16, 25.66, 21.5, 21.66,
  22.5, 25.08, 17.08, 17.08, 14.5, 21.91, 20.5, 20.5,
  25.16, 20.5, 20.5, 48.5, 24, 26, 20.16, 27.16,
];

function getEstatusBand(estatus: number | string, diasHabiles: number | string): EstatusBand {
  const dias = parseSortNumber(estatus);
  if (dias !== null) {
    if (dias < 4) return 'GREEN';
    if (dias < 7) return 'YELLOW';
    if (dias < 10) return 'PINK';
    return 'RED';
  }

  if (estatus === 'EN_PLAZO') return 'GREEN';
  if (estatus === 'ATENCION') return 'YELLOW';
  if (estatus === 'REQUERIR') return 'PINK';
  if (estatus === 'VENCIDO' || estatus === 'CERRADO') return 'RED';

  return 'EMPTY';
}

function getEstatusBandLabel(value: string) {
  const labels: Record<string, string> = {
    GREEN: '0-3',
    YELLOW: '4-6',
    PINK: '7-9',
    RED: '10+',
    SIN_ESTATUS: 'SIN ESTATUS',
  };

  return labels[value] || value;
}

function matchesEstatusFilter(exp: Expediente, filter: string) {
  if (!filter) {
    return true;
  }

  const band = getEstatusBand(String(exp.estatus ?? ''), exp.diasHabilesTranscurridos);

  if (filter === 'SIN_ESTATUS') {
    return band === 'EMPTY';
  }

  if (['GREEN', 'YELLOW', 'PINK', 'RED'].includes(filter)) {
    return band === filter;
  }

  return String(exp.estatus ?? '') === filter;
}

function getSortColumn(key: SortColumnKey) {
  return SORT_COLUMNS.find((column) => column.key === key) || SORT_COLUMNS[0];
}

function getSortOrderLabel(column: ReturnType<typeof getSortColumn>, direction: SortDirection) {
  if (column.type === 'date') {
    return direction === 'ASC'
      ? 'De mas antiguos a mas recientes'
      : 'De mas recientes a mas antiguos';
  }

  if (column.type === 'estatus') {
    return direction === 'ASC' ? 'Verde, amarillo, rojo claro y rojo' : 'Rojo, rojo claro, amarillo y verde';
  }

  if (column.type === 'text') {
    return direction === 'ASC' ? 'A a Z' : 'Z a A';
  }

  return direction === 'ASC' ? 'De menor a mayor' : 'De mayor a menor';
}

function getFilterMenuSortLabel(column: ReturnType<typeof getSortColumn>, direction: SortDirection) {
  if (column.type === 'date') {
    return direction === 'ASC'
      ? 'Ordenar de mas antiguos a mas recientes'
      : 'Ordenar de mas recientes a mas antiguos';
  }

  if (column.type === 'estatus') {
    return direction === 'ASC'
      ? 'Ordenar verde, amarillo, rojo claro y rojo'
      : 'Ordenar rojo, rojo claro, amarillo y verde';
  }

  if (column.type === 'number') {
    return direction === 'ASC'
      ? 'Ordenar de menor a mayor'
      : 'Ordenar de mayor a menor';
  }

  if (column.type === 'boolean') {
    return direction === 'ASC' ? 'Ordenar No a Si' : 'Ordenar Si a No';
  }

  return direction === 'ASC' ? 'Ordenar A a Z' : 'Ordenar Z a A';
}

function parseSortNumber(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const text = String(value).trim();
  if (!text || text === '-') {
    return null;
  }

  const numeric = Number(text.replace(/,/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function parseSortDate(value: unknown) {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return null;
  }

  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : time;
  }

  const text = String(value).trim();
  if (!text || text === '-') {
    return null;
  }

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  const mx = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (mx) {
    const year = mx[3].length === 2 ? Number(`20${mx[3]}`) : Number(mx[3]);
    return Date.UTC(year, Number(mx[2]) - 1, Number(mx[1]));
  }

  const parsed = new Date(text).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function parseDateFilterOption(option: string) {
  // Parsear formato dd/mm/aaaa (formato principal del sistema)
  const dmy = option.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    return {
      year: Number(dmy[3]),
      month: Number(dmy[2]) - 1,
      day: Number(dmy[1]),
    };
  }
  // Fallback: intentar parsear con parseSortDate
  const time = parseSortDate(option);
  if (time === null) {
    return null;
  }
  const date = new Date(time);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
  };
}

function buildDateFilterTree(options: string[]): DateFilterTreeNode[] {
  const grouped = new Map<number, Map<number, Map<number, string[]>>>();
  const emptyValues: string[] = [];

  options.forEach((option) => {
    const parsed = parseDateFilterOption(option);

    if (!parsed) {
      emptyValues.push(option);
      return;
    }

    if (!grouped.has(parsed.year)) {
      grouped.set(parsed.year, new Map());
    }

    const months = grouped.get(parsed.year)!;
    if (!months.has(parsed.month)) {
      months.set(parsed.month, new Map());
    }

    const days = months.get(parsed.month)!;
    days.set(parsed.day, [...(days.get(parsed.day) || []), option]);
  });

  const yearNodes = [...grouped.entries()]
    .sort(([left], [right]) => right - left)
    .map(([year, months]) => {
      const monthNodes = [...months.entries()]
        .sort(([left], [right]) => left - right)
        .map(([month, days]) => {
          const dayNodes = [...days.entries()]
            .sort(([left], [right]) => left - right)
            .map(([day, values]) => ({
              id: `${year}-${month + 1}-${day}`,
              label: String(day).padStart(2, '0'),
              values,
            }));

          return {
            id: `${year}-${month + 1}`,
            label: MONTH_NAMES[month],
            values: dayNodes.flatMap((node) => node.values),
            children: dayNodes,
          };
        });

      return {
        id: String(year),
        label: String(year),
        values: monthNodes.flatMap((node) => node.values),
        children: monthNodes,
      };
    });

  if (emptyValues.length > 0) {
    yearNodes.push({
      id: 'empty',
      label: '(Vacías)',
      values: emptyValues,
    });
  }

  return yearNodes;
}

function TriStateCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="w-3.5 h-3.5 accent-blue-600"
    />
  );
}

function getEstatusSortNumber(exp: Expediente) {
  const estatusNumber = parseSortNumber(exp.estatus);
  if (estatusNumber !== null) {
    if (estatusNumber < 4) return 0;
    if (estatusNumber < 7) return 1;
    if (estatusNumber < 10) return 2;
    return 3;
  }

  const bandOrder: Record<EstatusBand, number> = {
    GREEN: 0,
    YELLOW: 1,
    PINK: 2,
    RED: 3,
    EMPTY: Number.POSITIVE_INFINITY,
  };

  return bandOrder[getEstatusBand(exp.estatus, exp.diasHabilesTranscurridos)];
}

function isSortBlank(value: unknown) {
  return value === null || value === undefined || String(value).trim() === '' || String(value).trim() === '-';
}

function normalizeSortValue(exp: Expediente, level: SortLevel) {
  const column = getSortColumn(level.column);
  const value = exp[level.column];

  if (column.type === 'estatus') {
    const rank = getEstatusSortNumber(exp);
    return Number.isFinite(rank) ? rank : null;
  }

  if (column.type === 'number') {
    return parseSortNumber(value);
  }

  if (column.type === 'date') {
    return parseSortDate(value);
  }

  if (column.type === 'boolean') {
    return value === true || value === '1' || String(value).toLowerCase() === 'true' || String(value).toLowerCase() === 'si';
  }

  return String(value ?? '').trim();
}

function compareRowsLikeExcel(
  left: Expediente,
  right: Expediente,
  levels: SortLevel[],
  leftOriginalIndex: number,
  rightOriginalIndex: number
) {
  const collator = new Intl.Collator('es-MX', {
    sensitivity: 'base',
    numeric: false,
  });

  for (const level of levels) {
    const column = getSortColumn(level.column);
    const leftRaw = left[level.column];
    const rightRaw = right[level.column];
    const leftBlank = column.type === 'estatus'
      ? getEstatusBand(left.estatus, left.diasHabilesTranscurridos) === 'EMPTY'
      : isSortBlank(leftRaw);
    const rightBlank = column.type === 'estatus'
      ? getEstatusBand(right.estatus, right.diasHabilesTranscurridos) === 'EMPTY'
      : isSortBlank(rightRaw);

    if (leftBlank && rightBlank) {
      continue;
    }
    if (leftBlank) {
      return 1;
    }
    if (rightBlank) {
      return -1;
    }

    const leftValue = normalizeSortValue(left, level);
    const rightValue = normalizeSortValue(right, level);
    let comparison = 0;

    if (column.type === 'text') {
      comparison = collator.compare(String(leftValue), String(rightValue));
    } else if (column.type === 'boolean') {
      comparison = Number(leftValue) - Number(rightValue);
    } else {
      const leftNumber = Number(leftValue);
      const rightNumber = Number(rightValue);
      comparison = leftNumber < rightNumber ? -1 : leftNumber > rightNumber ? 1 : 0;
    }

    if (comparison !== 0) {
      return level.direction === 'DESC' ? -comparison : comparison;
    }
  }

  return leftOriginalIndex - rightOriginalIndex;
}

function sortRowsLikeExcel(rows: Expediente[], levels: SortLevel[]) {
  const activeLevels = levels.slice(0, 64).filter((level) => level.column);
  if (activeLevels.length === 0) {
    return rows;
  }

  return rows
    .map((row, originalIndex) => ({ row, originalIndex }))
    .sort((left, right) => compareRowsLikeExcel(
      left.row,
      right.row,
      activeLevels,
      left.originalIndex,
      right.originalIndex
    ))
    .map(({ row }) => row);
}

export default function CumplimientosExcel({
  permissions = [],
  isAdmin = false,
}: {
  permissions?: string[];
  isAdmin?: boolean;
}) {
  const can = (permission: string) => isAdmin || permissions.includes(permission);
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [selectedExpediente, setSelectedExpediente] = useState<Expediente | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const tableViewportRef = useRef<HTMLDivElement | null>(null);
  const [visibleRows, setVisibleRows] = useState({ start: 0, end: 80 });
  const [sortLevels, setSortLevels] = useState<SortLevel[]>(loadSavedSortLevels);
  const [draftSortLevels, setDraftSortLevels] = useState<SortLevel[]>([]);
  const [showModalOrdenar, setShowModalOrdenar] = useState(false);
  const [selectedSortLevelId, setSelectedSortLevelId] = useState('');
  const [showReglas, setShowReglas] = useState(false);
  const [showMenuAcciones, setShowMenuAcciones] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<Expediente | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // Modales
  const [showModalAgregar, setShowModalAgregar] = useState(false);
  const [showModalActualizar, setShowModalActualizar] = useState(false);

  // Estados Importar Excel
  const [showModalImportar, setShowModalImportar] = useState(false);
  const [importHojas, setImportHojas] = useState<string[]>([]);
  const [importHojaSeleccionada, setImportHojaSeleccionada] = useState('');
  const [importWorkbook, setImportWorkbook] = useState<any>(null);
  const [importando, setImportando] = useState(false);
  const [importError, setImportError] = useState('');
  const [importResultado, setImportResultado] = useState<any>(null);
  const [importEtapa, setImportEtapa] = useState<'seleccion' | 'progreso' | 'resultado'>('seleccion');
  const importFileRef = useRef<HTMLInputElement>(null);

  // Estados del modal Agregar
  const [archivoAgregar, setArchivoAgregar] = useState<File | null>(null);
  const [fechaInicial, setFechaInicial] = useState('');
  const [fechaFinal, setFechaFinal] = useState('');
  const [resultadoAgregar, setResultadoAgregar] = useState<any>(null);
  const [agregandoExpedientes, setAgregandoExpedientes] = useState(false);
  const [errorAgregar, setErrorAgregar] = useState('');

  // Estados del modal Actualizar
  const [archivoActualizar, setArchivoActualizar] = useState<File | null>(null);
  const [validado, setValidado] = useState(false);
  const [resultadoActualizar, setResultadoActualizar] = useState<any>(null);
  const [actualizandoCumplimientos, setActualizandoCumplimientos] = useState(false);
  const [errorActualizar, setErrorActualizar] = useState('');

  // Filtros
  const [filtroEstatus, setFiltroEstatus] = useState('');
  const [filtroJuicio, setFiltroJuicio] = useState('');
  const [filtroMateria, setFiltroMateria] = useState('');
  const [filtroLocalizado, setFiltroLocalizado] = useState('');
  const [filtroFirma, setFiltroFirma] = useState('');
  const [filtroJuicioBusq, setFiltroJuicioBusq] = useState('');
  const [filtroMateriaBusq, setFiltroMateriaBusq] = useState('');
  const [filtroFirmaBusq, setFiltroFirmaBusq] = useState('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [excelFilterEnabled, setExcelFilterEnabled] = useState(false);
  const [tableColumnFilters, setTableColumnFilters] = useState<Partial<Record<SortColumnKey, string[]>>>({});
  const [openTableFilter, setOpenTableFilter] = useState<SortColumnKey | null>(null);
  const [tableFilterSearch, setTableFilterSearch] = useState('');
  const [draftTableFilterValues, setDraftTableFilterValues] = useState<string[]>([]);
  const [expandedDateFilterNodes, setExpandedDateFilterNodes] = useState<Record<string, boolean>>({});
  const deferredFiltroJuicioBusq = useDeferredValue(filtroJuicioBusq);
  const deferredFiltroMateriaBusq = useDeferredValue(filtroMateriaBusq);
  const deferredFiltroFirmaBusq = useDeferredValue(filtroFirmaBusq);
  const deferredTableFilterSearch = useDeferredValue(tableFilterSearch);

  const getTableFilterValue = useCallback((exp: Expediente, key: SortColumnKey) => {
    const value = exp[key];
    const column = getSortColumn(key);

    if (column.type === 'date') {
      const time = parseSortDate(value);
      if (time === null) return '(Vacías)';
      // Siempre formato dd/mm/aaaa con ceros iniciales
      const d = new Date(time);
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const yyyy = d.getUTCFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }

    if (column.type === 'boolean') {
      return value ? 'Si' : 'No';
    }

    if (key === 'estatus') {
      const numeric = getEstatusSortNumber(exp);
      return numeric === Number.POSITIVE_INFINITY ? '(Vac?as)' : String(numeric);
    }

    if (value === '' || value === null || value === undefined) {
      return '(Vacías)';
    }

    return String(value).trim() || '(Vacías)';
  }, []);

  const getTableFilterOptions = useCallback((key: SortColumnKey) => {
    const column = getSortColumn(key);
    return [...new Set(expedientes.map((exp) => getTableFilterValue(exp, key)))]
      .sort((a, b) => {
        if (a === '(Vacías)') return 1;
        if (b === '(Vacías)') return -1;

        if (column.type === 'number' || column.type === 'estatus') {
          return (parseSortNumber(a) ?? Number.POSITIVE_INFINITY) - (parseSortNumber(b) ?? Number.POSITIVE_INFINITY);
        }

        if (column.type === 'date') {
          return (parseSortDate(a) ?? Number.POSITIVE_INFINITY) - (parseSortDate(b) ?? Number.POSITIVE_INFINITY);
        }

        return a.localeCompare(b, 'es-MX', { numeric: true, sensitivity: 'base' });
      });
  }, [expedientes, getTableFilterValue]);

  const clearExcelColumnFilters = useCallback(() => {
    setTableColumnFilters({});
    setOpenTableFilter(null);
    setTableFilterSearch('');
    setDraftTableFilterValues([]);
  }, []);

  const toggleExcelFilter = () => {
    setExcelFilterEnabled((enabled) => {
      if (enabled) {
        setFiltroEstatus('');
        setFiltroJuicio('');
        setFiltroMateria('');
        setFiltroLocalizado('');
        setFiltroFirma('');
        setFiltroJuicioBusq('');
        setFiltroMateriaBusq('');
        setFiltroFirmaBusq('');
        clearExcelColumnFilters();
      }
      return !enabled;
    });
  };

  const openExcelColumnFilter = (key: SortColumnKey) => {
    const options = getTableFilterOptions(key);
    const column = getSortColumn(key);
    setOpenDropdown(null);
    setOpenTableFilter(key);
    setTableFilterSearch('');
    setDraftTableFilterValues(tableColumnFilters[key] || options);
    setExpandedDateFilterNodes({});
  };

  const applyExcelColumnFilter = () => {
    if (!openTableFilter) return;
    const allOptions = getTableFilterOptions(openTableFilter);
    const selected = draftTableFilterValues.filter((value) => allOptions.includes(value));

    setTableColumnFilters((current) => {
      const next = { ...current };
      if (selected.length === allOptions.length) {
        delete next[openTableFilter];
      } else {
        next[openTableFilter] = selected;
      }
      return next;
    });
    setOpenTableFilter(null);
    setTableFilterSearch('');
  };

  useEffect(() => {
    let active = true;

    const loadExpedientes = async () => {
      try {
        const rows = await window.cumplimientosBackend.list();
        if (active && Array.isArray(rows)) {
          setExpedientes(rows);
        }
      } catch (error) {
        console.error('No se pudo recalcular CUMPLIMIENTOS al entrar a la pantalla', error);
        try {
          const rows = await window.cumplimientosBackend.list();
          if (active && Array.isArray(rows)) {
            setExpedientes(rows);
          }
        } catch (listError) {
          console.error('No se pudo cargar CUMPLIMIENTOS desde el backend local', listError);
        }
      }
    };

    loadExpedientes();

    return () => {
      active = false;
    };
  }, []);

  const expedientesOrdenados = useMemo(() => {
    const filtered = expedientes.filter((exp) => {
      if (!matchesEstatusFilter(exp, filtroEstatus)) return false;
      if (filtroJuicio && exp.numeroJuicio !== filtroJuicio) return false;
      if (filtroMateria && exp.materia !== filtroMateria) return false;
      if (filtroLocalizado !== '' && String(exp.localizado ? '1' : '0') !== filtroLocalizado) return false;
      if (filtroFirma && exp.firma !== filtroFirma) return false;
      for (const [key, selectedValues] of Object.entries(tableColumnFilters)) {
        if (selectedValues && selectedValues.length > 0 && !selectedValues.includes(getTableFilterValue(exp, key as SortColumnKey))) {
          return false;
        }
      }
      return true;
    });

    return sortRowsLikeExcel(filtered, sortLevels);
  }, [expedientes, sortLevels, filtroEstatus, filtroJuicio, filtroMateria, filtroLocalizado, filtroFirma, tableColumnFilters, getTableFilterValue]);

  const hayFiltros = filtroEstatus || filtroJuicio || filtroMateria || filtroLocalizado !== '' || filtroFirma || Object.keys(tableColumnFilters).length > 0;

  const limpiarFiltros = () => {
    setFiltroEstatus('');
    setFiltroJuicio('');
    setFiltroMateria('');
    setFiltroLocalizado('');
    setFiltroFirma('');
    setFiltroJuicioBusq('');
    setFiltroMateriaBusq('');
    setFiltroFirmaBusq('');
    clearExcelColumnFilters();
  };

  const uniqueJuicios = useMemo(() => [...new Set(expedientes.map((e) => e.numeroJuicio).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es-MX', { numeric: true })), [expedientes]);
  const uniqueMaterias = useMemo(() => [...new Set(expedientes.map((e) => e.materia).filter(Boolean))].sort(), [expedientes]);
  const uniqueFirmas = useMemo(() => [...new Set(expedientes.map((e) => e.firma).filter(Boolean))].sort(), [expedientes]);
  const filteredUniqueJuicios = useMemo(
    () => uniqueJuicios.filter((j) => j.toLowerCase().includes(deferredFiltroJuicioBusq.toLowerCase())),
    [uniqueJuicios, deferredFiltroJuicioBusq]
  );
  const filteredUniqueMaterias = useMemo(
    () => uniqueMaterias.filter((m) => m.toLowerCase().includes(deferredFiltroMateriaBusq.toLowerCase())),
    [uniqueMaterias, deferredFiltroMateriaBusq]
  );
  const filteredUniqueFirmas = useMemo(
    () => uniqueFirmas.filter((f) => f.toLowerCase().includes(deferredFiltroFirmaBusq.toLowerCase())),
    [uniqueFirmas, deferredFiltroFirmaBusq]
  );

  const updateVisibleRows = useCallback(() => {
    const viewport = tableViewportRef.current;
    const scrollTop = viewport?.scrollTop ?? 0;
    const viewportHeight = viewport?.clientHeight ?? 720;
    const visibleCount = Math.ceil(viewportHeight / TABLE_ROW_HEIGHT) + TABLE_OVERSCAN_ROWS * 2;
    const rawStart = Math.max(0, Math.floor(scrollTop / TABLE_ROW_HEIGHT) - TABLE_OVERSCAN_ROWS);
    const nextStart = Math.min(rawStart, Math.max(0, expedientesOrdenados.length - visibleCount));
    const nextEnd = Math.min(expedientesOrdenados.length, nextStart + visibleCount);

    setVisibleRows((current) => (
      current.start === nextStart && current.end === nextEnd
        ? current
        : { start: nextStart, end: nextEnd }
    ));
  }, [expedientesOrdenados.length]);

  useEffect(() => {
    updateVisibleRows();
    window.addEventListener('resize', updateVisibleRows);

    return () => {
      window.removeEventListener('resize', updateVisibleRows);
    };
  }, [updateVisibleRows]);

  const expedientesVisibles = useMemo(
    () => expedientesOrdenados.slice(visibleRows.start, visibleRows.end),
    [expedientesOrdenados, visibleRows]
  );

  useEffect(() => {
    if (selectedRowId && !expedientesOrdenados.some((exp) => exp.id === selectedRowId)) {
      setSelectedRowId(null);
    }
  }, [expedientesOrdenados, selectedRowId]);

  const topSpacerHeight = visibleRows.start * TABLE_ROW_HEIGHT;
  const bottomSpacerHeight = Math.max(
    0,
    (expedientesOrdenados.length - visibleRows.end) * TABLE_ROW_HEIGHT
  );

  const openSortModal = () => {
    const savedLevels = loadSavedSortLevels();
    const nextLevels = savedLevels.length > 0 ? savedLevels : sortLevels;
    setDraftSortLevels(nextLevels.map((level) => ({ ...level })));
    setSelectedSortLevelId(nextLevels[0]?.id || '');
    setShowModalOrdenar(true);
  };

  const updateSortLevel = (id: string, patch: Partial<SortLevel>) => {
    setDraftSortLevels((levels) =>
      levels.map((level) => (level.id === id ? { ...level, ...patch } : level))
    );
  };

  const addSortLevel = () => {
    const nextLevel: SortLevel = {
      id: `nivel-${Date.now()}`,
      column: 'numeroJuicio',
      direction: 'ASC',
    };
    setDraftSortLevels((levels) => [...levels, nextLevel]);
    setSelectedSortLevelId(nextLevel.id);
  };

  const deleteSortLevel = () => {
    setDraftSortLevels((levels) => {
      const next = levels.filter((level) => level.id !== selectedSortLevelId);
      setSelectedSortLevelId(next[0]?.id || '');
      return next;
    });
  };

  const copySortLevel = () => {
    const source = draftSortLevels.find((level) => level.id === selectedSortLevelId) || draftSortLevels[0];
    if (!source) {
      return;
    }

    const copiedLevel = { ...source, id: `nivel-${Date.now()}` };
    setDraftSortLevels((levels) => [...levels, copiedLevel]);
    setSelectedSortLevelId(copiedLevel.id);
  };

  const moveSortLevel = (direction: -1 | 1) => {
    setDraftSortLevels((levels) => {
      const index = levels.findIndex((level) => level.id === selectedSortLevelId);
      const target = index + direction;

      if (index < 0 || target < 0 || target >= levels.length) {
        return levels;
      }

      const next = [...levels];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const applySortLevels = () => {
    setSortLevels(draftSortLevels);
    saveSortLevels(draftSortLevels);
    setShowModalOrdenar(false);
    setVisibleRows({ start: 0, end: 80 });
    tableViewportRef.current?.scrollTo({ top: 0 });
  };

  const getRowColor = (exp: Expediente) => {
    switch (getEstatusBand(exp.estatus, exp.diasHabilesTranscurridos)) {
      case 'GREEN':
        return 'bg-emerald-50';
      case 'YELLOW':
        return 'bg-amber-50';
      case 'PINK':
        return 'bg-rose-50';
      case 'RED':
        return 'bg-red-50';
      default:
        return '';
    }
  };

  const getAlertas = (exp: Expediente) => {
    const alertas = [];
    const vistaAlerta = typeof exp.vistaMayorUltEjecutoria === 'string'
      ? exp.vistaMayorUltEjecutoria.startsWith('Alerta')
      : exp.vistaMayorUltEjecutoria;
    const cumplimientoAlerta = typeof exp.cumplimientoMenorFechaEjecutoria === 'string'
      ? exp.cumplimientoMenorFechaEjecutoria.startsWith('Alerta')
      : exp.cumplimientoMenorFechaEjecutoria;

    if (vistaAlerta) {
      alertas.push({ tipo: 'warning', texto: 'Vista anterior a última ejecutoria' });
    }
    if (cumplimientoAlerta) {
      alertas.push({ tipo: 'warning', texto: 'Cumplimiento menor a fecha de ejecutoria' });
    }
    if (!exp.localizado) {
      alertas.push({ tipo: 'error', texto: 'Expediente no localizado' });
    }
    if (['PINK', 'RED'].includes(getEstatusBand(exp.estatus, exp.diasHabilesTranscurridos))) {
      alertas.push({ tipo: 'error', texto: 'Requiere cumplimiento' });
    }
    if (!exp.ultimoRequerimiento || !exp.ultEjecutoria) {
      alertas.push({ tipo: 'info', texto: 'Falta información' });
    }
    return alertas;
  };

  const normalizeExcelHeader = (value: unknown) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  // ── COLUMNAS ESPERADAS EN LA HOJA CUMPLIMIENTOS ──────────────────────────
  const IMPORT_COLUMN_MAP: Array<{ excelHeader: string; field: keyof Expediente; type: 'text' | 'date' | 'boolean' | 'number' }> = [
    { excelHeader: 'NÚMERO DE ORDEN',                       field: 'numeroOrden',                      type: 'number' },
    { excelHeader: 'NÚMERO DE JUICIO',                      field: 'numeroJuicio',                     type: 'text'   },
    { excelHeader: 'MATERIA',                               field: 'materia',                          type: 'text'   },
    { excelHeader: 'SENTENCIA',                             field: 'sentencia',                        type: 'date'   },
    { excelHeader: 'FECHA EJECUTORIA COLEGIADO',            field: 'fechaEjecutoriaColegiado',          type: 'date'   },
    { excelHeader: 'FECHA EJECUTORIA INCONFORMIDAD',        field: 'fechaEjecutoriaInconformidad',      type: 'date'   },
    { excelHeader: 'FECHA DE EJECUTORIA',                   field: 'fechaEjecutoria',                  type: 'date'   },
    { excelHeader: 'FECHA POR NO CUMPLIDA',                 field: 'fechaPorNoCumplida',                type: 'date'   },
    { excelHeader: 'ULT. EJECUTORIA',                       field: 'ultEjecutoria',                    type: 'date'   },
    { excelHeader: 'ULTIMO REQUERIMIENTO',                  field: 'ultimoRequerimiento',               type: 'date'   },
    { excelHeader: 'ESTATUS',                               field: 'estatus',                          type: 'text'   },
    { excelHeader: 'SE DECLARO SIN MATERIA',                field: 'seDeclaroSinMateria',               type: 'date'   },
    { excelHeader: 'FECHA DE VISTA',                        field: 'fechaVista',                       type: 'date'   },
    { excelHeader: 'REVISION CONTRA SENTENCIA',             field: 'revisionContraSentencia',           type: 'date'   },
    { excelHeader: 'FECHA DE CUMPLIMIENTO',                 field: 'fechaCumplimiento',                type: 'date'   },
    { excelHeader: 'FECHA DE ARCHIVO',                      field: 'fechaArchivo',                     type: 'date'   },
    { excelHeader: 'OBSERVACIONES',                         field: 'observaciones',                    type: 'text'   },
    { excelHeader: 'LOCALIZADO',                            field: 'localizado',                       type: 'boolean'},
    { excelHeader: 'FIRMA',                                 field: 'firma',                            type: 'text'   },
  ];

  // Extensiones NO soportadas por SheetJS
  const UNSUPPORTED_EXTS = new Set(['.numbers', '.numbers-tef', '.nmbtemplate', '.gsheet']);

  const handleAbrirImportar = async () => {
    importFileRef.current?.click();
  };

  const handleArchivoImportar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setImportError('');
    setImportResultado(null);
    setImportando(false);

    // Verificar si la extensión es soportada por SheetJS
    const ext = ('.' + file.name.split('.').pop()?.toLowerCase()) as string;
    if (UNSUPPORTED_EXTS.has(ext)) {
      setImportError(
        `El formato "${ext}" no puede leerse directamente. ` +
        'Por favor exporta el archivo como .XLSX o .ODS desde la aplicación de origen (Numbers, Google Sheets, etc.) e inténtalo de nuevo.'
      );
      toastWarning('Formato no compatible', `El archivo ${ext} debe convertirse a XLSX, XLSM, XLS u ODS.`);
      setImportEtapa('resultado');
      setShowModalImportar(true);
      return;
    }

    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      // type:'buffer' cubre XLS, XLSB, XLSM, ODS, FODS, WKS, CSV, etc.
      const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
      setImportWorkbook({ wb, XLSX });

      // Buscar hojas que contengan la palabra CUMPLIMIENTO
      const hojasCumplimiento = wb.SheetNames.filter((name: string) =>
        normalizeExcelHeader(name).includes('CUMPLIMIENTO')
      );

      if (hojasCumplimiento.length === 0) {
        setImportError(
          'No se encontró ninguna hoja que contenga la palabra "CUMPLIMIENTO" en el archivo seleccionado. ' +
          `Hojas encontradas: ${wb.SheetNames.join(', ')}`
        );
        toastWarning('Hoja no encontrada', 'El archivo debe contener una hoja de Cumplimientos.');
        setShowModalImportar(true);
        setImportEtapa('resultado');
        return;
      }

      if (hojasCumplimiento.length === 1) {
        setImportHojas(hojasCumplimiento);
        setImportHojaSeleccionada(hojasCumplimiento[0]);
        setImportEtapa('seleccion');
        setShowModalImportar(true);
        await procesarImportacion({ wb, XLSX }, hojasCumplimiento[0]);
      } else {
        setImportHojas(hojasCumplimiento);
        setImportHojaSeleccionada(hojasCumplimiento[0]);
        setImportEtapa('seleccion');
        setShowModalImportar(true);
      }
    } catch (err: any) {
      setImportError(`Error al leer el archivo: ${err.message}`);
      setImportEtapa('resultado');
      setShowModalImportar(true);
      toastError('Error al leer Excel', err.message || 'No se pudo abrir el archivo seleccionado.');
    }
  };

  const procesarImportacion = async (wbData: { wb: any; XLSX: any }, sheetName: string) => {
    setImportando(true);
    setImportEtapa('progreso');
    setImportError('');

    try {
      const { wb, XLSX } = wbData || importWorkbook;
      const sheet = wb.Sheets[sheetName];

      // ── Cargar expedientes frescos desde la BD (evita stale closure) ──────
      let dbExpedientes: Expediente[] = [];
      try {
        dbExpedientes = await window.cumplimientosBackend.list();
      } catch (_) { /* usa estado local como fallback */ dbExpedientes = expedientes; }

      const matrix: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: true,
        defval: '',
      });

      // Encontrar fila de encabezados — busca en hasta 50 filas
      // y reconoce todas las variantes de "Número de Orden" / "Número de Juicio"
      let headerRowIndex = -1;
      let colMap: Record<string, number> = {};

      const isHeaderToken = (h: string): boolean => {
        const clean = h.replace(/[°º#.]/g, '').replace(/\s+/g, ' ').trim();
        return (
          /^N[UuOo??]?[Mm]?[Ee]?[Rr]?[Oo]?\s*[.\s]?\s*D?E?\s*ORDEN/.test(clean) ||
          /^NUMERO\s*D?E?\s*ORDEN/.test(clean) ||
          /^NUM\s*D?E?\s*ORDEN/.test(clean) ||
          /^N\s*DE\s*ORDEN/.test(clean) ||
          /^NO\s*DE\s*ORDEN/.test(clean) ||
          clean === 'ORDEN' ||
          clean === 'NO ORDEN' ||
          clean === 'NUMERO ORDEN' ||
          /^N[UuOo??]?[Mm]?[Ee]?[Rr]?[Oo]?\s*[.\s]?\s*D?E?\s*JUICIO/.test(clean) ||
          /^NUMERO\s*D?E?\s*JUICIO/.test(clean) ||
          /^NUM\s*D?E?\s*JUICIO/.test(clean) ||
          /^N\s*DE\s*JUICIO/.test(clean) ||
          /^NO\s*DE\s*JUICIO/.test(clean) ||
          h === 'NÚMERO DE ORDEN' ||
          h === 'NÚMERO DE JUICIO' ||
          h === 'N DE ORDEN' ||
          h === 'NO JUICIO'
        );
      };

      for (let ri = 0; ri < Math.min(matrix.length, 50); ri++) {
        const row = (matrix[ri] || []) as unknown[];
        const norm = new Map<string, number>();
        row.forEach((cell, ci) => {
          const h = normalizeExcelHeader(cell);
          if (h && !norm.has(h)) norm.set(h, ci);
        });

        if ([...norm.keys()].some(h => isHeaderToken(h))) {
          headerRowIndex = ri;
          norm.forEach((ci, h) => { colMap[h] = ci; });
          break;
        }
      }

      if (headerRowIndex < 0) {
        throw new Error(
          'No se encontró la fila de encabezados en las primeras 50 filas. ' +
          'La hoja debe tener una columna llamada "Número de Orden" o "Número de Juicio".'
        );
      }



      // Verificar columnas disponibles
      const columnasFaltantes: string[] = [];
      const columnasEncontradas: string[] = [];

      for (const col of IMPORT_COLUMN_MAP) {
        const norm = normalizeExcelHeader(col.excelHeader);
        const found = Object.keys(colMap).some(k => k === norm || k.includes(norm) || norm.includes(k));
        if (found) {
          columnasEncontradas.push(col.excelHeader);
        } else {
          columnasFaltantes.push(col.excelHeader);
        }
      }

      // Resolver índice de columna con búsqueda flexible
      // Se exige que la clave tenga mínimo 4 caracteres para evitar falsos positivos
      const resolveCol = (expectedHeader: string): number | undefined => {
        const norm = normalizeExcelHeader(expectedHeader);
        if (colMap[norm] !== undefined) return colMap[norm];
        const key = Object.keys(colMap).find(k =>
          k.length >= 4 && (k === norm || k.includes(norm) || norm.includes(k))
        );
        return key !== undefined ? colMap[key] : undefined;
      };

      // Identificar columna clave de juicio
      const juicioCol = resolveCol('NÚMERO DE JUICIO');
      if (juicioCol === undefined) {
        throw new Error(
          `No se encontró la columna "NÚMERO DE JUICIO". ` +
          `Encabezados leídos: ${Object.keys(colMap).join(', ')}`
        );
      }

      // Función para normalizar números de juicio al comparar
      // Elimina espacios alrededor de /, puntos, guión, caracteres invisibles
      const normalizeJuicio = (v: string): string =>
        v.replace(/\s*\/\s*/g, '/').replace(/[\u00A0\u200B\t]/g, '').replace(/\s+/g, ' ').toUpperCase().trim();

      // Mapa existente por numeroJuicio (clave exacta + normalizada)
      const expedientesPorJuicio = new Map<string, Expediente>();
      dbExpedientes.forEach(exp => {
        const raw = String(exp.numeroJuicio || '').trim().toUpperCase();
        const norm2 = normalizeJuicio(raw);
        if (raw) {
          expedientesPorJuicio.set(raw, exp);
          expedientesPorJuicio.set(norm2, exp);
        }
      });

      // Primeros valores para diagnóstico
      const sampleExcel: string[] = [];
      const sampleDB = dbExpedientes.slice(0, 3).map(e => e.numeroJuicio);

      const dataRows = matrix.slice(headerRowIndex + 1);
      const ordenCol = resolveCol('NÚMERO DE ORDEN');

      let actualizados = 0;
      let celdasActualizadas = 0;
      let sinCambios = 0;
      let insertados = 0;
      let noEncontrados = 0;
      const errores: string[] = [];

      for (const row of dataRows) {
        const rawJuicio = String((row as any)[juicioCol] ?? '').trim();
        if (!rawJuicio) continue;

        if (sampleExcel.length < 5) sampleExcel.push(rawJuicio);

        const juicioKey = rawJuicio.toUpperCase();
        const juicioNorm = normalizeJuicio(rawJuicio);
        const expExistente = expedientesPorJuicio.get(juicioKey)
                          || expedientesPorJuicio.get(juicioNorm);

        // Extraer todos los valores de la fila del Excel
        const rowValues: Partial<Expediente> = {};
        for (const col of IMPORT_COLUMN_MAP) {
          const colIdx = resolveCol(col.excelHeader);
          if (colIdx === undefined) continue;

          const rawValue = (row as any)[colIdx];
          let newValue: any;

          if (col.type === 'date') {
            newValue = parseExcelDateValue(rawValue, XLSX);
          } else if (col.type === 'boolean') {
            const str = normalizeExcelHeader(rawValue);
            newValue = str === 'SI' || str === 'S' || str === '1' || str === 'TRUE' || str === 'LOCALIZADO';
          } else if (col.type === 'number') {
            const n = Number(rawValue);
            newValue = Number.isFinite(n) ? n : rawValue;
          } else {
            newValue = String(rawValue ?? '').trim();
          }
          (rowValues as any)[col.field] = newValue;
        }

        if (!expExistente) {
          // INSERTAR nuevo expediente
          try {
            await window.cumplimientosBackend.add([{
              ...rowValues,
              numeroJuicio: rawJuicio,
              localizado: (rowValues as any).localizado ?? true,
            }]);
            insertados++;
          } catch (err: any) {
            errores.push(`[NUEVO] ${rawJuicio}: ${err.message}`);
          }
          continue;
        }

        // ACTUALIZAR solo campos que cambiaron
        const patch: Partial<Expediente> = {};
        let cambios = 0;

        for (const [field, newValue] of Object.entries(rowValues)) {
          const oldValue = expExistente[field as keyof Expediente];
          const oldStr = String(oldValue ?? '').trim();
          const newStr = String(newValue ?? '').trim();
          if (oldStr !== newStr) {
            (patch as any)[field] = newValue;
            cambios++;
          }
        }

        if (cambios === 0) {
          sinCambios++;
          continue;
        }

        try {
          await window.cumplimientosBackend.patch(expExistente.id, patch);
          actualizados++;
          celdasActualizadas += cambios;
        } catch (err: any) {
          errores.push(`${rawJuicio}: ${err.message}`);
        }
      }

      // Recargar datos
      const rowsActualizados = await window.cumplimientosBackend.list();
      setExpedientes(rowsActualizados);

      setImportResultado({
        hoja: sheetName,
        filaEncabezado: headerRowIndex,
        columnaJuicio: juicioCol,
        columnasEncontradas: columnasEncontradas.length,
        columnasFaltantes,
        actualizados,
        celdasActualizadas,
        sinCambios,
        insertados,
        noEncontrados,
        errores,
        sampleExcel,
        sampleDB,
      });
      setImportEtapa('resultado');
      if (errores.length > 0 || columnasFaltantes.length > 0) {
        toastWarning(
          'Importacion con observaciones',
          `${actualizados} actualizados, ${insertados} nuevos, ${errores.length} errores.`
        );
      } else {
        toastSuccess('Importacion completada', `${actualizados} actualizados y ${insertados} nuevos.`);
      }
    } catch (err: any) {
      setImportError(err.message || 'Error desconocido durante la importación.');
      setImportEtapa('resultado');
      toastError('Error al importar', err.message || 'Error desconocido durante la importacion.');
    } finally {
      setImportando(false);
    }
  };

  const findRequiredSheet = (workbook: any, sheetName: string) => {
    const normalizedTarget = normalizeExcelHeader(sheetName);
    return workbook.SheetNames.find((name: string) => normalizeExcelHeader(name) === normalizedTarget);
  };

  const findHeaderMap = (rows: unknown[][], requiredHeaders: string[]) => {
    for (let rowIndex = 0; rowIndex < Math.min(rows.length, 10); rowIndex += 1) {
      const row = rows[rowIndex] || [];
      const rawMap = new Map<string, number>();

      row.forEach((value, columnIndex) => {
        const normalized = normalizeExcelHeader(value);
        if (normalized && !rawMap.has(normalized)) {
          rawMap.set(normalized, columnIndex);
        }
      });

      const hasRequiredHeaders = requiredHeaders.every((header) => rawMap.has(normalizeExcelHeader(header)));
      if (hasRequiredHeaders) {
        return {
          headerRowIndex: rowIndex,
          columns: Object.fromEntries(
            requiredHeaders.map((header) => [header, rawMap.get(normalizeExcelHeader(header)) as number])
          ),
        };
      }
    }

    throw new Error(`No se localizaron todos los encabezados requeridos: ${requiredHeaders.join(', ')}.`);
  };

  const formatExcelDate = (year: number, month: number, day: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const parseExcelDateValue = (value: unknown, XLSX: typeof import('xlsx')) => {
    if (!value) {
      return '';
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return formatExcelDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      const parsed = XLSX.SSF.parse_date_code(value);
      return parsed ? formatExcelDate(parsed.y, parsed.m, parsed.d) : '';
    }

    const text = String(value).trim();
    const iso = text.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (iso) {
      return formatExcelDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    }

    const mx = text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (mx) {
      const year = Number(mx[3].length === 2 ? `20${mx[3]}` : mx[3]);
      return formatExcelDate(year, Number(mx[2]), Number(mx[1]));
    }

    return '';
  };

  const getDateInRangeForProceso = (
    fechaEjecutoria: string,
    fechaEjecutoriaColegiado: string,
    fechaInicio: string,
    fechaFin: string
  ) => {
    if (fechaEjecutoria) {
      return fechaEjecutoria >= fechaInicio && fechaEjecutoria <= fechaFin
        ? { fechaEjecutoria, fechaEjecutoriaColegiado: '' }
        : null;
    }

    if (fechaEjecutoriaColegiado >= fechaInicio && fechaEjecutoriaColegiado <= fechaFin) {
      return { fechaEjecutoria: '', fechaEjecutoriaColegiado };
    }

    return null;
  };

  const getRowsFromSentenciasFile = async (file: File) => {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const sheetName = findRequiredSheet(workbook, 'SENTENCIAS');

    if (!sheetName) {
      throw new Error("El archivo seleccionado no contiene la hoja obligatoria 'SENTENCIAS'.");
    }

    const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      raw: true,
      defval: '',
    });
    const headerRowIndex = matrix.findIndex((row, rowIndex) => (
      rowIndex < 15 && row.some((cell) => normalizeExcelHeader(cell) === 'EXPEDIENTE')
    ));

    if (headerRowIndex < 0) {
      throw new Error("No se encontró el encabezado 'EXPEDIENTE' en la hoja SENTENCIAS.");
    }

    const headers = (matrix[headerRowIndex] || []).map((header) => String(header ?? '').trim());
    const rows = matrix.slice(headerRowIndex + 1).map((row) => (
      Object.fromEntries(headers.map((header, index) => [header || `COLUMNA_${index + 1}`, row[index] ?? '']))
    ));

    return rows.filter((row) => {
      const expedienteKey = Object.keys(row).find((key) => normalizeExcelHeader(key) === 'EXPEDIENTE');
      return expedienteKey && String(row[expedienteKey] ?? '').trim();
    });
  };

  const handleBuscarExpedientes = async () => {
    if (!archivoAgregar || !fechaInicial || !fechaFinal) {
      toastWarning('Datos incompletos', 'Selecciona archivo, fecha inicial y fecha final.');
      return;
    }

    setAgregandoExpedientes(true);
    setErrorAgregar('');
    setResultadoAgregar(null);

    try {
      if (fechaInicial > fechaFinal) {
        toastWarning('Rango invalido', 'La fecha inicial no puede ser mayor que la fecha final.');
        throw new Error('La fecha inicial no puede ser mayor que la fecha final.');
      }

      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await archivoAgregar.arrayBuffer(), { type: 'array', cellDates: true });
      const sheetName = findRequiredSheet(workbook, 'SENTENCIAS');

      if (!sheetName) {
        throw new Error("El archivo seleccionado no contiene la hoja obligatoria 'SENTENCIAS'.");
      }

      const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
        header: 1,
        raw: true,
        defval: '',
      });
      const requiredHeaders = [
        'Expediente',
        'AMPARA',
        'ACUMULADO',
        'Fecha en la que causa ejecutoria',
        'Fecha ejecutoria Tribunal Colegiado de Circuito contra sentencia',
        'Materia (amparo indirecto)',
      ];
      const headerMap = findHeaderMap(rows, requiredHeaders);
      const existingJuicios = new Set(expedientes.map((row) => String(row.numeroJuicio || '').trim().toUpperCase()));
      const nuevosJuicios = new Set<string>();
      const nuevosExpedientes: Partial<Expediente>[] = [];
      let procesados = 0;
      let duplicados = 0;
      let omitidos = 0;

      rows.slice(headerMap.headerRowIndex + 1).forEach((row) => {
        const expediente = String(row[headerMap.columns.Expediente] ?? '').trim();
        const valorAmp = normalizeExcelHeader(row[headerMap.columns.AMPARA]);
        const valorAcumulado = normalizeExcelHeader(row[headerMap.columns.ACUMULADO]);

        if (!expediente || valorAcumulado === 'SI' || valorAmp !== 'SI') {
          omitidos += 1;
          return;
        }

        const fechaEjec = parseExcelDateValue(
          row[headerMap.columns['Fecha en la que causa ejecutoria']],
          XLSX
        );
        const fechaEjecColegiado = parseExcelDateValue(
          row[headerMap.columns['Fecha ejecutoria Tribunal Colegiado de Circuito contra sentencia']],
          XLSX
        );
        const fechasProceso = getDateInRangeForProceso(fechaEjec, fechaEjecColegiado, fechaInicial, fechaFinal);

        if (!fechasProceso) {
          omitidos += 1;
          return;
        }

        procesados += 1;

        const duplicateKey = expediente.toUpperCase();
        if (existingJuicios.has(duplicateKey) || nuevosJuicios.has(duplicateKey)) {
          duplicados += 1;
          return;
        }

        nuevosJuicios.add(duplicateKey);
        nuevosExpedientes.push({
          numeroJuicio: expediente,
          materia: String(row[headerMap.columns['Materia (amparo indirecto)']] ?? '').trim(),
          sentencia: '',
          fechaEjecutoria: fechasProceso.fechaEjecutoria,
          fechaEjecutoriaColegiado: fechasProceso.fechaEjecutoriaColegiado,
          fechaEjecutoriaInconformidad: '',
          fechaPorNoCumplida: '',
          ultimoRequerimiento: '',
          revisionContraSentencia: '',
          observaciones: '',
          localizado: true,
          actualizado: new Date().toISOString().slice(0, 10),
          firma: '',
        });
      });

      if (!window.cumplimientosBackend.add) {
        throw new Error('El backend local de SQLite no está disponible.');
      }

      const saved = await window.cumplimientosBackend.add(nuevosExpedientes);
      if (saved.rows) {
        setExpedientes(saved.rows);
      }

      setResultadoAgregar({
        total: procesados,
        nuevos: saved.inserted ?? nuevosExpedientes.length,
        duplicados,
        omitidos,
      });
      if ((saved.inserted ?? nuevosExpedientes.length) > 0) {
        toastSuccess('Expedientes agregados', `Se agregaron ${saved.inserted ?? nuevosExpedientes.length} expedientes.`);
      } else {
        toastWarning('Sin expedientes nuevos', 'No se encontraron expedientes nuevos para agregar.');
      }
    } catch (error) {
      setErrorAgregar(error instanceof Error ? error.message : 'No se pudieron agregar los expedientes.');
      toastError('Error al agregar', error instanceof Error ? error.message : 'No se pudieron agregar los expedientes.');
    } finally {
      setAgregandoExpedientes(false);
    }
  };

  const handleValidarArchivo = async () => {
    if (!archivoActualizar) {
      toastWarning('Archivo requerido', 'Selecciona un archivo de SENTENCIAS para validar.');
      return;
    }

    setErrorActualizar('');
    setResultadoActualizar(null);

    try {
      await getRowsFromSentenciasFile(archivoActualizar);
      setValidado(true);
      toastSuccess('Archivo validado', 'El archivo SENTENCIAS contiene la estructura requerida.');
    } catch (error) {
      setValidado(false);
      setErrorActualizar(error instanceof Error ? error.message : 'No se pudo validar el archivo SENTENCIAS.');
      toastError('Validacion fallida', error instanceof Error ? error.message : 'No se pudo validar el archivo SENTENCIAS.');
    }
  };

  const handleActualizarCumplimientos = async () => {
    if (!archivoActualizar) {
      toastWarning('Archivo requerido', 'Selecciona un archivo de SENTENCIAS para actualizar.');
      return;
    }

    setActualizandoCumplimientos(true);
    setErrorActualizar('');

    try {
      const sentencias = await getRowsFromSentenciasFile(archivoActualizar);
      const resultado = await window.cumplimientosBackend.updateFromSentencias(sentencias);

      setExpedientes(resultado.rows);
      setResultadoActualizar(resultado.summary);
      toastSuccess('Cumplimientos actualizados', 'La informacion se actualizo desde SENTENCIAS.');
    } catch (error) {
      setResultadoActualizar(null);
      setErrorActualizar(error instanceof Error ? error.message : 'No se pudieron actualizar los cumplimientos.');
      toastError('Error al actualizar', error instanceof Error ? error.message : 'No se pudieron actualizar los cumplimientos.');
    } finally {
      setActualizandoCumplimientos(false);
    }
  };

  const formatDate = (value: string | boolean) => {
    if (!value || typeof value === 'boolean') {
      return '-';
    }

    const text = String(value).trim();
    if (!text || text === '-') return '-';

    // Si ya viene en dd/mm/aaaa, devolverlo tal cual
    const dmy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) {
      return `${dmy[1].padStart(2, '0')}/${dmy[2].padStart(2, '0')}/${dmy[3]}`;
    }

    // Si viene en yyyy-mm-dd, convertirlo a dd/mm/aaaa
    const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) {
      return `${iso[3].padStart(2, '0')}/${iso[2].padStart(2, '0')}/${iso[1]}`;
    }

    // Fallback con Date
    const date = new Date(`${text}T00:00:00`);
    if (Number.isNaN(date.getTime())) return text;
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const formatValidation = (value: string | boolean) => {
    if (!value) {
      return '-';
    }

    if (typeof value === 'boolean') {
      return value ? 'Alerta' : '-';
    }

    return value.startsWith('Alerta') ? value : formatDate(value);
  };

  const excelSerialDate = (year: number, month: number, day: number) => {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return Math.floor((Date.UTC(year, month - 1, day) - excelEpoch) / 86400000);
  };

  const excelDateValue = (value: unknown) => {
    if (!value || typeof value === 'boolean') {
      return '';
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return excelSerialDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
    }

    const text = String(value).trim();
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      return excelSerialDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    }

    const mx = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (mx) {
      const year = Number(mx[3].length === 2 ? `20${mx[3]}` : mx[3]);
      return excelSerialDate(year, Number(mx[2]), Number(mx[1]));
    }

    return text;
  };

  const getExcelCellValue = (exp: Expediente, column: typeof EXPORT_COLUMNS[number], displayIndex?: number) => {
    if (column.key === 'numeroOrden' && typeof displayIndex === 'number') {
      return displayIndex + 1;
    }

    const value = exp[column.key];

    if (column.type === 'date') {
      return excelDateValue(value);
    }

    if (column.type === 'boolean') {
      return value ? 'S?' : 'No';
    }

    if (column.type === 'validation') {
      return typeof value === 'boolean' ? (value ? 'Alerta' : '') : String(value ?? '');
    }

    return value ?? '';
  };

  const addEstatusIconSet = async (xlsxOutput: ArrayBuffer, lastRow: number) => {
    const JSZipModule = await import('jszip');
    const JSZip = (JSZipModule.default || JSZipModule) as any;
    const zip = await JSZip.loadAsync(xlsxOutput);
    const sheetPath = 'xl/worksheets/sheet1.xml';
    const sheetFile = zip.file(sheetPath);

    if (!sheetFile) {
      return xlsxOutput;
    }

    let sheetXml = await sheetFile.async('string');
    const sqref = `M3:M${Math.max(3, lastRow)}`;
    const iconSetXml = `<extLst><ext uri="{78C0D931-6437-407d-A8EE-F0AAD7539E65}" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main"><x14:conditionalFormattings><x14:conditionalFormatting xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main"><x14:cfRule type="iconSet" priority="1" id="{58FFAF70-E8C3-4868-A96F-7D2D20CFCF6F}"><x14:iconSet iconSet="4TrafficLights" showValue="0" custom="1"><x14:cfvo type="percent"><xm:f>0</xm:f></x14:cfvo><x14:cfvo type="num"><xm:f>4</xm:f></x14:cfvo><x14:cfvo type="num"><xm:f>7</xm:f></x14:cfvo><x14:cfvo type="num"><xm:f>10</xm:f></x14:cfvo><x14:cfIcon iconSet="3TrafficLights1" iconId="2"/><x14:cfIcon iconSet="3TrafficLights1" iconId="1"/><x14:cfIcon iconSet="4RedToBlack" iconId="2"/><x14:cfIcon iconSet="3TrafficLights1" iconId="0"/></x14:iconSet></x14:cfRule><xm:sqref>${sqref}</xm:sqref></x14:conditionalFormatting></x14:conditionalFormattings></ext></extLst>`;

    sheetXml = sheetXml.replace(/<extLst>[\s\S]*?<\/extLst>/, '');
    sheetXml = sheetXml.replace('</worksheet>', `${iconSetXml}</worksheet>`);
    zip.file(sheetPath, sheetXml);

    return zip.generateAsync({ type: 'arraybuffer' });
  };

  const handleExportarExcel = async () => {
    try {
      const XLSXModule = await import('xlsx-js-style');
      const XLSX = (XLSXModule.default || XLSXModule) as any;
      let diasInhabiles: any[] = [];

      try {
        diasInhabiles = await window.cumplimientosBackend.listInhabiles();
      } catch (error) {
        console.error('No se pudieron cargar los dias inhabiles para la exportacion', error);
      }
      const rows = [
        EXPORT_COLUMNS.map(() => ''),
        EXPORT_COLUMNS.map((column) => column.header),
        ...expedientesOrdenados.map((exp, index) => EXPORT_COLUMNS.map((column) => (
          false
            ? ''
            : getExcelCellValue(exp, column, index)
        ))),
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(rows);

      worksheet['!cols'] = EXPORT_COLUMN_WIDTHS.map((width) => ({ width }));
      worksheet['!rows'] = [{ hpt: 18 }, { hpt: 36 }];
      worksheet['!autofilter'] = { ref: `A2:X${Math.max(2, rows.length)}` };

      const headerStyle = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { patternType: 'solid', fgColor: { rgb: '2446B8' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
          top: { style: 'thin', color: { rgb: 'FFFFFF' } },
          bottom: { style: 'thin', color: { rgb: 'FFFFFF' } },
          left: { style: 'thin', color: { rgb: 'FFFFFF' } },
          right: { style: 'thin', color: { rgb: 'FFFFFF' } },
        },
      };
      const rowFillByBand: Record<EstatusBand, string> = {
        EMPTY: 'FFFFFF',
        GREEN: 'FFFBEA',
        YELLOW: 'FFFBEA',
        PINK: 'FDEBEC',
        RED: 'FDEBEC',
      };
      const statusFontByBand: Record<EstatusBand, string> = {
        EMPTY: '000000',
        GREEN: 'D9A43A',
        YELLOW: 'D9A43A',
        PINK: 'E7908A',
        RED: 'C83A2A',
      };
      const statusBorderByBand: Record<EstatusBand, string> = {
        EMPTY: '000000',
        GREEN: 'B98525',
        YELLOW: 'B98525',
        PINK: 'D07A74',
        RED: 'B12C1E',
      };
      const createBodyStyle = (fillColor: string) => ({
        fill: { patternType: 'solid', fgColor: { rgb: fillColor } },
        alignment: { vertical: 'center', wrapText: true },
        border: {
          top: { style: 'thin', color: { rgb: 'D9D9D9' } },
          bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
          left: { style: 'thin', color: { rgb: 'D9D9D9' } },
          right: { style: 'thin', color: { rgb: 'D9D9D9' } },
        },
      });

      for (let columnIndex = 0; columnIndex < EXPORT_COLUMNS.length; columnIndex += 1) {
        const headerAddress = XLSX.utils.encode_cell({ r: 1, c: columnIndex });
        if (worksheet[headerAddress]) {
          worksheet[headerAddress].s = headerStyle;
        }
      }

      for (let rowIndex = 2; rowIndex < rows.length; rowIndex += 1) {
        const exp = expedientesOrdenados[rowIndex - 2];
        const band = exp ? getEstatusBand(exp.estatus, exp.diasHabilesTranscurridos) : 'EMPTY';
        const fillColor = rowFillByBand[band];
        const excelRow = rowIndex + 1;

        for (let columnIndex = 0; columnIndex < EXPORT_COLUMNS.length; columnIndex += 1) {
          const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
          const cell = worksheet[address] || (worksheet[address] = { t: 's', v: '' });

          cell.s = createBodyStyle(fillColor);
          if (EXPORT_COLUMNS[columnIndex].type === 'date' && typeof cell.v === 'number') {
            cell.t = 'n';
            cell.z = 'dd/mm/yyyy';
          }
          if (columnIndex === 1) {
            cell.t = 's';
            cell.z = '@';
          }
          if (EXPORT_COLUMNS[columnIndex].key === 'estatus') {
            cell.t = 'n';
            cell.f = `IFERROR(IF(OR(J${excelRow}="",O${excelRow}<>"",P${excelRow}<>"",Q${excelRow}<>"",N${excelRow}<>"",R${excelRow}<>""),"",NETWORKDAYS.INTL(J${excelRow},TODAY(),1,inhabiles!$A$2:$A$192)),"")`;
            cell.v = typeof exp?.estatus === 'number' ? exp.estatus : undefined;
            cell.z = '"●"';
            cell.s = {
              ...createBodyStyle(fillColor),
              font: {
                bold: true,
                sz: 14,
                color: { rgb: statusFontByBand[band] },
              },
              alignment: { horizontal: 'center', vertical: 'center' },
              border: {
                top: { style: 'thin', color: { rgb: 'D9D9D9' } },
                bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
                left: { style: 'thin', color: { rgb: 'D9D9D9' } },
                right: { style: 'thin', color: { rgb: 'D9D9D9' } },
              },
            };
            if (true) {
              cell.s.font.color = { rgb: statusBorderByBand[band] };
            } else if (false) {
              cell.v = '●';
              cell.s.font.color = { rgb: statusBorderByBand[band] };
            }
          }
        }
      }

      const fechasInhabiles = diasInhabiles
        .map((dia) => excelDateValue(dia?.fecha || dia?.date || dia))
        .filter((fecha): fecha is number => typeof fecha === 'number' && Number.isFinite(fecha));
      const inhabilesRows = [
        ['DÍAS INHABILES'],
        ...fechasInhabiles.map((fecha) => [fecha]),
      ];
      const inhabilesSheet = XLSX.utils.aoa_to_sheet(inhabilesRows);
      inhabilesSheet['!cols'] = [{ width: 22.16 }];
      if (inhabilesSheet.A1) {
        inhabilesSheet.A1.s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { patternType: 'solid', fgColor: { rgb: '2446B8' } },
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }
      for (let rowIndex = 1; rowIndex < inhabilesRows.length; rowIndex += 1) {
        const address = `A${rowIndex + 1}`;
        const cell = inhabilesSheet[address];
        if (typeof cell?.v === 'number') {
          cell.t = 'n';
          cell.z = 'dd/mm/yyyy';
        }
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Cumplimientos');
      XLSX.utils.book_append_sheet(workbook, inhabilesSheet, 'inhabiles');
      workbook.Workbook = {
        ...(workbook.Workbook || {}),
        CalcPr: { calcMode: 'auto', fullCalcOnLoad: true, forceFullCalc: true },
      };

      const output = XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'array',
        cellStyles: true,
        bookSST: true,
      });
      const blob = new Blob([output], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const dateStamp = new Date().toISOString().slice(0, 10);
      const fileName = `LISTADO_CUMPLIMIENTOS_${dateStamp}.xlsx`;
      const showSaveFilePicker = (window as any).showSaveFilePicker;

      if (typeof showSaveFilePicker === 'function') {
        try {
          const fileHandle = await showSaveFilePicker({
            suggestedName: fileName,
            types: [{
              description: 'Microsoft Excel Worksheet',
              accept: {
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
              },
            }],
          });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          toastSuccess(
            'Excel exportado',
            `Se exportaron ${expedientesOrdenados.length} expedientes y ${fechasInhabiles.length} dias inhabiles.`
          );
        } catch (saveError: any) {
          if (saveError?.name !== 'AbortError') {
            throw saveError;
          }
        }
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('No se pudo exportar el archivo Excel', error);
      toastError('Error al exportar', error instanceof Error ? error.message : 'No se pudo exportar el archivo Excel.');
    }
  };

  const beginEditExpediente = () => {
    if (!selectedExpediente) return;
    setEditDraft({ ...selectedExpediente });
    setEditError('');
    setIsEditing(true);
  };

  const cancelEditExpediente = () => {
    setEditDraft(null);
    setEditError('');
    setIsEditing(false);
  };

  const updateEditDraft = (field: keyof Expediente, value: any) => {
    setEditDraft((draft) => (draft ? { ...draft, [field]: value } : draft));
  };

  const saveEditExpediente = async () => {
    if (!selectedExpediente || !editDraft) return;

    const editableFields: Array<keyof Expediente> = [
      'numeroOrden',
      'numeroJuicio',
      'materia',
      'sentencia',
      'fechaEjecutoriaColegiado',
      'fechaEjecutoriaInconformidad',
      'fechaEjecutoria',
      'fechaPorNoCumplida',
      'ultimoRequerimiento',
      'seDeclaroSinMateria',
      'fechaVista',
      'revisionContraSentencia',
      'fechaCumplimiento',
      'fechaArchivo',
      'observaciones',
      'localizado',
      'firma',
    ];

    const patch: Partial<Expediente> = {};

    editableFields.forEach((field) => {
      const previous = selectedExpediente[field];
      const next = editDraft[field];
      const previousValue = field === 'numeroOrden' ? Number(previous || 0) : previous;
      const nextValue = field === 'numeroOrden' ? Number(next || 0) : next;

      if (String(previousValue ?? '') !== String(nextValue ?? '')) {
        (patch as any)[field] = nextValue;
      }
    });

    if (Object.keys(patch).length === 0) {
      cancelEditExpediente();
      toastWarning('Sin cambios', 'No se detectaron cambios para guardar.');
      return;
    }

    setSavingEdit(true);
    setEditError('');

    try {
      const updated = await window.cumplimientosBackend.patch(selectedExpediente.id, patch);
      if (!updated) {
        throw new Error('No se pudo actualizar el expediente.');
      }

      setExpedientes((rows) => rows.map((row) => (row.id === selectedExpediente.id ? updated : row)));
      setSelectedExpediente(updated);
      setEditDraft(null);
      setIsEditing(false);
      toastSuccess('Expediente actualizado', `Se guardaron los cambios de ${updated.numeroJuicio || 'el expediente'}.`);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'No se pudieron guardar los cambios.');
      toastError('Error al guardar', error instanceof Error ? error.message : 'No se pudieron guardar los cambios.');
    } finally {
      setSavingEdit(false);
    }
  };

  const renderEditableField = (
    label: string,
    field: keyof Expediente,
    options: {
      type?: 'text' | 'number' | 'date' | 'textarea' | 'boolean';
      className?: string;
      readOnly?: boolean;
      placeholder?: string;
    } = {}
  ) => {
    const type = options.type || 'text';
    const source = isEditing && editDraft ? editDraft : selectedExpediente;
    const value = source ? source[field] : '';

    if (!isEditing || options.readOnly) {
      const displayValue =
        type === 'date'
          ? formatDate(value as string | boolean)
          : type === 'boolean'
            ? value ? 'Si' : 'No'
            : String(value ?? '') || '-';

      return <DetailField label={label} value={displayValue} className={options.className} />;
    }

    const baseClass =
      'w-full h-8 rounded-md border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

    return (
      <div className={options.className}>
        <p className="text-[10px] text-muted-foreground mb-1 font-medium">{label}</p>
        {type === 'boolean' ? (
          <select
            value={value ? '1' : '0'}
            onChange={(e) => updateEditDraft(field, e.target.value === '1')}
            className={baseClass}
          >
            <option value="1">SI</option>
            <option value="0">NO</option>
          </select>
        ) : type === 'textarea' ? (
          <textarea
            value={String(value ?? '')}
            onChange={(e) => updateEditDraft(field, e.target.value)}
            placeholder={options.placeholder}
            className={`${baseClass} h-24 py-2 resize-none leading-relaxed`}
          />
        ) : (
          <input
            type={type}
            value={String(value ?? '')}
            onChange={(e) => updateEditDraft(field, type === 'number' ? Number(e.target.value) : e.target.value)}
            placeholder={options.placeholder}
            className={baseClass}
          />
        )}
      </div>
    );
  };

  const renderDateFilterTreeNode = (node: DateFilterTreeNode, depth = 0) => {
    const hasChildren = Boolean(node.children?.length);
    const expanded = expandedDateFilterNodes[node.id] ?? false;
    const selectedCount = node.values.filter((value) => draftTableFilterValues.includes(value)).length;
    const checked = node.values.length > 0 && selectedCount === node.values.length;
    const indeterminate = selectedCount > 0 && selectedCount < node.values.length;

    return (
      <div key={node.id} style={{ position: 'relative' }}>
        {/* Línea vertical punteada del nodo */}
        <div style={{
          position: 'absolute',
          left: depth === 0 ? 6 : 6,
          top: hasChildren && expanded ? 18 : 0,
          bottom: 0,
          width: 1,
          borderLeft: '1px dotted #999',
          display: 'none',
        }} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: 22,
            paddingLeft: 4,
            borderRadius: 3,
            cursor: 'pointer',
            position: 'relative',
            userSelect: 'none',
          }}
          className="hover:bg-slate-50"
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => {
                setExpandedDateFilterNodes((current) => ({
                  ...current,
                  [node.id]: !expanded,
                }));
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 11,
                height: 11,
                fontSize: 9,
                lineHeight: 1,
                border: '1px solid #888',
                background: '#fff',
                color: '#000',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                cursor: 'pointer',
                flexShrink: 0,
                marginRight: 4,
                padding: 0,
                userSelect: 'none',
              }}
              aria-label={expanded ? 'Contraer' : 'Expandir'}
            >
              {expanded ? '' : '+'}
            </button>
          ) : (
            <span style={{ display: 'inline-block', width: 11, height: 11, marginRight: 4, flexShrink: 0 }} />
          )}
          <TriStateCheckbox
            checked={checked}
            indeterminate={indeterminate}
            onChange={(nextChecked) => {
              setDraftTableFilterValues((current) => {
                const withoutNode = current.filter((value) => !node.values.includes(value));
                return nextChecked ? [...withoutNode, ...node.values] : withoutNode;
              });
            }}
          />
          <span style={{ marginLeft: 4, fontSize: 11, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: depth === 0 ? 600 : 500 }}>
            {node.label}
          </span>
        </div>

        {hasChildren && expanded && (
          <div style={{ paddingLeft: 18, position: 'relative' }}>
            {/* Línea vertical punteada conectando hijos */}
            <div style={{
              position: 'absolute',
              left: 10,
              top: 0,
              bottom: 11,
              width: 1,
              borderLeft: '1px dotted #999',
            }} />
            {node.children!.map((child, idx) => (
              <div key={child.id} style={{ position: 'relative' }}>
                {/* Línea horizontal punteada hacia el hijo */}
                <div style={{
                  position: 'absolute',
                  left: -8,
                  top: 11,
                  width: 8,
                  height: 1,
                  borderTop: '1px dotted #999',
                }} />
                {renderDateFilterTreeNode(child, depth + 1)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderTableHeader = (header: typeof TABLE_HEADERS[number]) => {
    const column = getSortColumn(header.key);
    const isMenuOpen = excelFilterEnabled && openTableFilter === header.key;
    const options = isMenuOpen ? getTableFilterOptions(header.key) : [];
    const search = deferredTableFilterSearch.toLowerCase();
    const visibleOptions = options.filter((option) => {
      if (!search) return true;
      if (column.type !== 'date') {
        return option.toLowerCase().includes(search);
      }

      const parsed = parseDateFilterOption(option);
      if (!parsed) {
        return option.toLowerCase().includes(search);
      }

      const searchable = [
        option,
        String(parsed.year),
        MONTH_NAMES[parsed.month],
        String(parsed.day),
        String(parsed.day).padStart(2, '0'),
      ].join(' ').toLowerCase();
      return searchable.includes(search);
    });
    const isFiltered = Boolean(tableColumnFilters[header.key]);
    const allVisibleSelected = visibleOptions.length > 0 && visibleOptions.every((option) => draftTableFilterValues.includes(option));
    const dateTree = column.type === 'date' ? buildDateFilterTree(visibleOptions) : [];

    return (
      <th
        key={header.key}
        className={`px-2 py-2 ${excelFilterEnabled ? 'pr-7' : ''} ${header.align === 'center' ? 'text-center' : 'text-left'} font-semibold border-r border-blue-600 whitespace-nowrap ${header.minWidth} relative`}
      >
        <span className="block whitespace-nowrap truncate leading-tight">{header.label}</span>
        {excelFilterEnabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openExcelColumnFilter(header.key);
            }}
            className={`absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center border bg-white hover:bg-slate-100 ${isFiltered ? 'border-blue-600 text-blue-700' : 'border-slate-300 text-slate-700'}`}
            title={`Filtrar ${header.label}`}
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        )}

        {excelFilterEnabled && openTableFilter === header.key && (
          <div
            className="absolute z-50 top-full left-0 mt-1 w-[340px] bg-white text-slate-900 border border-slate-200 rounded-xl shadow-2xl normal-case text-left ring-1 ring-black/5 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 tracking-wide uppercase truncate">{header.label}</p>
            </div>

            <div className="p-3 space-y-1">
              {(['ASC', 'DESC'] as SortDirection[]).map((direction) => (
                <button
                  key={direction}
                  className="w-full flex items-center gap-2 text-left px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors"
                  onClick={() => {
                    const nextSort = [{ id: `filtro-${Date.now()}`, column: header.key, direction }];
                    setSortLevels(nextSort);
                    setDraftSortLevels(nextSort);
                    setVisibleRows({ start: 0, end: 80 });
                    tableViewportRef.current?.scrollTo({ top: 0 });
                    setOpenTableFilter(null);
                  }}
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                  <span className="truncate">{getFilterMenuSortLabel(column, direction)}</span>
                </button>
              ))}
            </div>

            <div className="h-px bg-slate-200" />

            <div className="p-3">
            <input
              value={tableFilterSearch}
              onChange={(e) => setTableFilterSearch(e.target.value)}
              placeholder="Buscar"
              className="w-full h-9 border border-slate-300 rounded-md px-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 mb-2 placeholder:text-slate-400"
            />

            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
              <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
                <span className="text-[10px] font-semibold text-slate-500">
                  {draftTableFilterValues.length} DE {options.length} SELECCIONADOS
                </span>
                {tableFilterSearch && (
                  <button
                    onClick={() => setTableFilterSearch('')}
                    className="text-[10px] font-semibold text-blue-600 hover:text-blue-700"
                  >
                    LIMPIAR BUSQUEDA
                  </button>
                )}
              </div>

              <div className="max-h-60 overflow-y-auto p-1.5 text-xs">
              {column.type !== 'date' && (
                <label className="flex items-center gap-2 py-2 px-2 rounded-md hover:bg-blue-50 font-semibold text-slate-800 cursor-pointer">
                  <TriStateCheckbox
                    checked={allVisibleSelected}
                    indeterminate={
                      visibleOptions.some((option) => draftTableFilterValues.includes(option)) && !allVisibleSelected
                    }
                    onChange={(checked) => {
                      setDraftTableFilterValues((current) => {
                        const withoutVisible = current.filter((value) => !visibleOptions.includes(value));
                        return checked ? [...withoutVisible, ...visibleOptions] : withoutVisible;
                      });
                    }}
                  />
                  (Seleccionar todo)
                </label>
              )}

              {visibleOptions.length === 0 ? (
                <div className="px-3 py-6 text-center text-[11px] text-slate-400">
                  No hay coincidencias
                </div>
              ) : column.type === 'date' ? (
                <div style={{ userSelect: 'none', fontSize: 12 }}>
                  {/* Fila "Seleccionar todo" */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      height: 22,
                      paddingLeft: 4,
                      borderRadius: 3,
                      cursor: 'pointer',
                      marginBottom: 1,
                    }}
                    className="hover:bg-slate-50"
                  >
                    <span style={{ display: 'inline-block', width: 11, height: 11, marginRight: 4, flexShrink: 0 }} />
                    <TriStateCheckbox
                      checked={allVisibleSelected}
                      indeterminate={
                        visibleOptions.some((option) => draftTableFilterValues.includes(option)) && !allVisibleSelected
                      }
                      onChange={(checked) => {
                        setDraftTableFilterValues((current) => {
                          const withoutVisible = current.filter((value) => !visibleOptions.includes(value));
                          return checked ? [...withoutVisible, ...visibleOptions] : withoutVisible;
                        });
                      }}
                    />
                    <span style={{ marginLeft: 4, fontSize: 11, fontWeight: 600, color: '#1e293b' }}>(Seleccionar todo)</span>
                  </div>
                  {/* Árbol de años/meses/días */}
                  <div style={{ position: 'relative' }}>
                    {/* Línea vertical principal */}
                    <div style={{
                      position: 'absolute',
                      left: 10,
                      top: 0,
                      bottom: 11,
                      width: 1,
                      borderLeft: '1px dotted #999',
                    }} />
                    {dateTree.map((node, idx) => (
                      <div key={node.id} style={{ position: 'relative' }}>
                        {/* Línea horizontal hacia el nodo año */}
                        <div style={{
                          position: 'absolute',
                          left: 10,
                          top: 11,
                          width: 8,
                          height: 1,
                          borderTop: '1px dotted #999',
                        }} />
                        <div style={{ paddingLeft: 18 }}>
                          {renderDateFilterTreeNode(node, 0)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                visibleOptions.map((option) => {
                  const checked = draftTableFilterValues.includes(option);
                  return (
                    <label
                      key={option}
                      className={`flex items-center gap-2 py-2 px-2 rounded-md cursor-pointer transition-colors ${
                        checked ? 'bg-blue-50 text-slate-900' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setDraftTableFilterValues((current) =>
                            e.target.checked
                              ? [...current, option]
                              : current.filter((value) => value !== option)
                          );
                        }}
                        className="w-3.5 h-3.5 accent-blue-600"
                      />
                      <span className="truncate font-medium">{option}</span>
                    </label>
                  );
                })
              )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                onClick={applyExcelColumnFilter}
                className="px-4 py-1.5 bg-slate-800 border border-slate-900 text-white rounded-md text-xs font-semibold hover:bg-slate-900"
              >
                ACEPTAR
              </button>
              <button
                onClick={() => setOpenTableFilter(null)}
                className="px-4 py-1.5 border border-slate-300 rounded-md text-xs font-semibold hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
            </div>
          </div>
        )}
      </th>
    );
  };

  return (
    <div className="h-full min-h-0 flex flex-col gap-3 md:gap-4 uppercase">
      {/* Botones superiores */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 flex-shrink-0">
        {can('cumplimientos.export') && (
          <button
            onClick={handleExportarExcel}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 border border-emerald-700 text-white rounded text-[11px] md:text-xs font-semibold shadow-sm hover:bg-emerald-700 transition-colors"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">EXPORTAR EXCEL</span>
            <span className="sm:hidden">EXPORTAR</span>
          </button>
        )}

        {/* ── IMPORTAR HOJA DE CALCULO ── */}
        <input
          ref={importFileRef}
          type="file"
          accept=".xlsx,.xls,.xlsm,.xlsb,.xlr,.xl,.xls,.xlthtml,.xlshtml,.xlsmhtml,.ods,.ots,.fods,.uos,.wks,.wki,.sdc,.csv"
          className="hidden"
          onChange={handleArchivoImportar}
        />
        {can('cumplimientos.import') && (
          <button
            onClick={handleAbrirImportar}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-teal-600 border border-teal-700 text-white rounded text-[11px] md:text-xs font-semibold shadow-sm hover:bg-teal-700 transition-colors"
          >
            <Upload className="w-3 h-3" />
            <span className="hidden sm:inline">IMPORTAR EXCEL</span>
            <span className="sm:hidden">IMPORTAR</span>
          </button>
        )}

        {can('cumplimientos.add') && (
          <button
            onClick={() => setShowModalAgregar(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-sky-700 border border-sky-800 text-white rounded text-[11px] md:text-xs font-semibold shadow-sm hover:bg-sky-800 transition-colors"
          >
            <PlusCircle className="w-3 h-3" />
            <span className="hidden lg:inline">AGREGAR NUEVOS EXPEDIENTES POR RANGO</span>
            <span className="lg:hidden">AGREGAR POR RANGO</span>
          </button>
        )}
        {can('cumplimientos.recalculate') && (
          <button
            onClick={() => setShowModalActualizar(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-700 border border-indigo-800 text-white rounded text-[11px] md:text-xs font-semibold shadow-sm hover:bg-indigo-800 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span className="hidden lg:inline">ACTUALIZAR DESDE SENTENCIAS</span>
            <span className="lg:hidden">ACTUALIZAR</span>
          </button>
        )}
        <button
          onClick={() => setShowReglas(!showReglas)}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 border border-blue-700 text-white rounded text-[11px] md:text-xs font-semibold shadow-sm hover:bg-blue-700 transition-colors sm:ml-auto"
        >
          <Info className="w-3 h-3" />
          <span>REGLAS DE CALCULO</span>
        </button>
      </div>

      {/* REGLAS DE CALCULO */}
      {showReglas && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 md:p-4 flex-shrink-0">
          <div className="flex items-start gap-2 mb-3">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <h3 className="text-xs md:text-sm font-semibold text-blue-900">Reglas de Cálculo del Sistema</h3>
          </div>
          <div className="space-y-2 md:space-y-3 text-[11px] md:text-xs text-blue-900">
            <div className="bg-white/50 rounded p-2 md:p-3">
              <p className="font-semibold mb-1">ULT. EJECUTORIA:</p>
              <p>Fecha mas reciente entre FECHA EJECUTORIA COLEGIADO, FECHA EJECUTORIA INCONFORMIDAD, FECHA DE EJECUTORIA y FECHA POR NO CUMPLIDA.</p>
            </div>
            <div className="bg-white/50 rounded p-2 md:p-3">
              <p className="font-semibold mb-1">DÍAS NATURALES TRANSCURRIDOS:</p>
              <p>Días desde ÚLTIMO REQUERIMIENTO hasta hoy.</p>
            </div>
            <div className="bg-white/50 rounded p-2 md:p-3">
              <p className="font-semibold mb-1">DÍAS HÁBILES TRANSCURRIDOS:</p>
              <p>Si existe ULTIMO REQUERIMIENTO, calcula DIAS.LAB.INTL desde ULTIMO REQUERIMIENTO hasta hoy, descontando sabados, domingos y días inhábiles, y resta 1 como en Excel.</p>
            </div>
            <div className="bg-white/50 rounded p-2 md:p-3">
              <p className="font-semibold mb-1">ESTATUS:</p>
              <p>Queda vacío si falta ULTIMO REQUERIMIENTO o si existe SE DECLARO SIN MATERIA, FECHA DE VISTA, REVISION CONTRA SENTENCIA, FECHA DE CUMPLIMIENTO o CUMPLIMIENTO &lt; FECHA EJECUTORIA. Si no, muestra DIAS.LAB.INTL sin restar 1: 0-3 verde, 4-6 amarillo, 7-9 rojo claro, 10+ rojo.</p>
            </div>
          </div>
        </div>
      )}

      {/* ORDENAMIENTO SUPERIOR */}
      <div
        className="relative z-20 bg-white rounded-lg border border-border p-2 md:p-3 flex-shrink-0"
        onClick={() => setOpenDropdown(null)}
      >
        {/* BARRA DE FILTROS COMBO-SEARCH */}
        <div>
          <div className="flex flex-wrap gap-3 items-end justify-start">
          <div className="hidden">
            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Panel de Filtros Rápidos</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] md:text-[11px] text-slate-500 font-medium whitespace-nowrap">
                TOTAL REGISTROS: {expedientesOrdenados.length} DE {expedientes.length} EXPEDIENTE(S)
              </span>
              {hayFiltros && (
                <span className="text-[9px] bg-blue-50 text-blue-600 font-semibold px-2 py-0.5 rounded-full border border-blue-100">
                  FILTRADO
                </span>
              )}
              <button
                onClick={openSortModal}
                className="h-7 flex items-center justify-center gap-1.5 px-3 bg-slate-800 border border-slate-900 text-white rounded text-[10px] font-semibold shadow-sm hover:bg-slate-900 transition-colors"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                ORDENAR
              </button>
            </div>
          </div>

          {/* Filtro Estatus (combo-search / custom dropdown) */}
          <div className="flex flex-col gap-1 relative">
            <label className="text-[9px] font-bold text-slate-500 tracking-wide uppercase">Estatus</label>
            <div className="relative">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'estatus' ? null : 'estatus'); }}
                className="h-8 pl-3 pr-8 border border-slate-200 hover:border-slate-300 rounded-lg bg-white text-[11px] font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 cursor-pointer flex items-center justify-between min-w-[125px] text-left relative"
              >
                <span>
                  {filtroEstatus === '' ? 'TODOS' :
                   getEstatusBandLabel(filtroEstatus)}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </button>
              {openDropdown === 'estatus' && (
                <div 
                  className="absolute z-50 top-full left-0 mt-1.5 bg-white border border-slate-200/80 rounded-xl shadow-xl max-h-56 overflow-y-auto min-w-[145px] py-1 ring-1 ring-black/5"
                  onClick={(e) => e.stopPropagation()}
                >
                  {[
                    { value: '', label: 'TODOS' },
                    { value: 'SIN_ESTATUS', label: 'SIN ESTATUS' },
                    { value: 'GREEN', label: '0-3' },
                    { value: 'YELLOW', label: '4-6' },
                    { value: 'PINK', label: '7-9' },
                    { value: 'RED', label: '10+' }
                  ].map((opt) => (
                    <div
                      key={opt.value}
                      className={`px-3 py-1.5 text-[11px] cursor-pointer transition-colors border-l-2 ${filtroEstatus === opt.value ? 'bg-blue-50 text-blue-700 border-blue-600 font-semibold' : 'text-slate-700 hover:bg-slate-50 border-transparent'}`}
                      onClick={() => { setFiltroEstatus(opt.value); setOpenDropdown(null); }}
                    >
                      {opt.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Filtro Número de Juicio (combo-search) */}
          <div className="flex flex-col gap-1 relative">
            <label className="text-[9px] font-bold text-slate-500 tracking-wide uppercase">Número de Juicio</label>
            <div className="relative">
              <input
                type="text"
                placeholder={filtroJuicio || 'Buscar juicio...'}
                value={filtroJuicioBusq}
                onClick={(e) => { e.stopPropagation(); setOpenDropdown('juicio'); }}
                onChange={(e) => { setFiltroJuicioBusq(e.target.value); setOpenDropdown('juicio'); }}
                className="h-8 pl-3 pr-8 border border-slate-200 hover:border-slate-300 rounded-lg bg-white text-[11px] font-medium text-slate-700 shadow-sm w-44 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 placeholder:text-slate-400 placeholder:font-normal"
              />
              {filtroJuicio ? (
                <button 
                  onClick={() => { setFiltroJuicio(''); setFiltroJuicioBusq(''); }} 
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              )}
              {openDropdown === 'juicio' && (
                <div 
                  className="absolute z-50 top-full left-0 mt-1.5 bg-white border border-slate-200/80 rounded-xl shadow-xl max-h-56 overflow-y-auto min-w-[180px] py-1 ring-1 ring-black/5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className={`px-3 py-1.5 text-[11px] cursor-pointer transition-colors border-l-2 font-medium ${!filtroJuicio ? 'bg-blue-50 text-blue-700 border-blue-600' : 'text-slate-500 hover:bg-slate-50 border-transparent'}`}
                    onClick={() => { setFiltroJuicio(''); setFiltroJuicioBusq(''); setOpenDropdown(null); }}
                  >
                    TODOS
                  </div>
                  <div className="h-px bg-slate-100 my-1"></div>
                  {filteredUniqueJuicios.length === 0 ? (
                    <div className="px-3 py-2 text-[11px] text-slate-400 italic">No se encontraron resultados</div>
                  ) : (
                    filteredUniqueJuicios.map((j) => (
                      <div
                        key={j}
                        className={`px-3 py-1.5 text-[11px] cursor-pointer transition-colors border-l-2 ${filtroJuicio === j ? 'bg-blue-50 text-blue-700 border-blue-600 font-semibold' : 'text-slate-700 hover:bg-slate-50 border-transparent'}`}
                        onClick={() => { setFiltroJuicio(j); setFiltroJuicioBusq(''); setOpenDropdown(null); }}
                      >
                        {j}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Filtro Materia (combo-search) */}
          <div className="flex flex-col gap-1 relative">
            <label className="text-[9px] font-bold text-slate-500 tracking-wide uppercase">Materia</label>
            <div className="relative">
              <input
                type="text"
                placeholder={filtroMateria || 'Buscar materia...'}
                value={filtroMateriaBusq}
                onClick={(e) => { e.stopPropagation(); setOpenDropdown('materia'); }}
                onChange={(e) => { setFiltroMateriaBusq(e.target.value); setOpenDropdown('materia'); }}
                className="h-8 pl-3 pr-8 border border-slate-200 hover:border-slate-300 rounded-lg bg-white text-[11px] font-medium text-slate-700 shadow-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 placeholder:text-slate-400 placeholder:font-normal"
              />
              {filtroMateria ? (
                <button 
                  onClick={() => { setFiltroMateria(''); setFiltroMateriaBusq(''); }} 
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              )}
              {openDropdown === 'materia' && (
                <div 
                  className="absolute z-50 top-full left-0 mt-1.5 bg-white border border-slate-200/80 rounded-xl shadow-xl max-h-56 overflow-y-auto min-w-[160px] py-1 ring-1 ring-black/5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className={`px-3 py-1.5 text-[11px] cursor-pointer transition-colors border-l-2 font-medium ${!filtroMateria ? 'bg-blue-50 text-blue-700 border-blue-600' : 'text-slate-500 hover:bg-slate-50 border-transparent'}`}
                    onClick={() => { setFiltroMateria(''); setFiltroMateriaBusq(''); setOpenDropdown(null); }}
                  >
                    TODAS
                  </div>
                  <div className="h-px bg-slate-100 my-1"></div>
                  {filteredUniqueMaterias.length === 0 ? (
                    <div className="px-3 py-2 text-[11px] text-slate-400 italic">No se encontraron resultados</div>
                  ) : (
                    filteredUniqueMaterias.map((m) => (
                      <div
                        key={m}
                        className={`px-3 py-1.5 text-[11px] cursor-pointer transition-colors border-l-2 ${filtroMateria === m ? 'bg-blue-50 text-blue-700 border-blue-600 font-semibold' : 'text-slate-700 hover:bg-slate-50 border-transparent'}`}
                        onClick={() => { setFiltroMateria(m); setFiltroMateriaBusq(''); setOpenDropdown(null); }}
                      >
                        {m}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Filtro Localizado (combo-search / custom dropdown) */}
          <div className="flex flex-col gap-1 relative">
            <label className="text-[9px] font-bold text-slate-500 tracking-wide uppercase">Localizado</label>
            <div className="relative">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'localizado' ? null : 'localizado'); }}
                className="h-8 pl-3 pr-8 border border-slate-200 hover:border-slate-300 rounded-lg bg-white text-[11px] font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 cursor-pointer flex items-center justify-between min-w-[100px] text-left relative"
              >
                <span>
                  {filtroLocalizado === '' ? 'TODOS' :
                   filtroLocalizado === '1' ? 'S?' : 'NO'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </button>
              {openDropdown === 'localizado' && (
                <div 
                  className="absolute z-50 top-full left-0 mt-1.5 bg-white border border-slate-200/80 rounded-xl shadow-xl py-1 ring-1 ring-black/5 min-w-[110px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {[
                    { value: '', label: 'TODOS' },
                    { value: '1', label: 'SÍ' },
                    { value: '0', label: 'NO' }
                  ].map((opt) => (
                    <div
                      key={opt.value}
                      className={`px-3 py-1.5 text-[11px] cursor-pointer transition-colors border-l-2 ${filtroLocalizado === opt.value ? 'bg-blue-50 text-blue-700 border-blue-600 font-semibold' : 'text-slate-700 hover:bg-slate-50 border-transparent'}`}
                      onClick={() => { setFiltroLocalizado(opt.value); setOpenDropdown(null); }}
                    >
                      {opt.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {hayFiltros && (
            <button
              onClick={limpiarFiltros}
              className="h-8 self-end flex items-center gap-1.5 px-3 py-0 border border-rose-200 bg-rose-50 text-rose-700 rounded-lg text-[11px] font-bold hover:bg-rose-100 hover:border-rose-300 transition-all duration-200 shadow-sm"
            >
              <X className="w-3.5 h-3.5" />
              LIMPIAR FILTROS
            </button>
          )}

          {/* Filtro Firma (combo-search) */}
          {uniqueFirmas.length > 0 && (
            <div className="flex flex-col gap-1 relative">
              <label className="text-[9px] font-bold text-slate-500 tracking-wide uppercase">Firma</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder={filtroFirma || 'Buscar firma...'}
                  value={filtroFirmaBusq}
                  onClick={(e) => { e.stopPropagation(); setOpenDropdown('firma'); }}
                  onChange={(e) => { setFiltroFirmaBusq(e.target.value); setOpenDropdown('firma'); }}
                  className="h-8 pl-3 pr-8 border border-slate-200 hover:border-slate-300 rounded-lg bg-white text-[11px] font-medium text-slate-700 shadow-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 placeholder:text-slate-400 placeholder:font-normal"
                />
                {filtroFirma ? (
                  <button 
                    onClick={() => { setFiltroFirma(''); setFiltroFirmaBusq(''); }} 
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                )}
                {openDropdown === 'firma' && (
                  <div 
                    className="absolute z-50 top-full left-0 mt-1.5 bg-white border border-slate-200/80 rounded-xl shadow-xl max-h-56 overflow-y-auto min-w-[140px] py-1 ring-1 ring-black/5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      className={`px-3 py-1.5 text-[11px] cursor-pointer transition-colors border-l-2 font-medium ${!filtroFirma ? 'bg-blue-50 text-blue-700 border-blue-600' : 'text-slate-500 hover:bg-slate-50 border-transparent'}`}
                      onClick={() => { setFiltroFirma(''); setFiltroFirmaBusq(''); setOpenDropdown(null); }}
                    >
                      TODOS
                    </div>
                    <div className="h-px bg-slate-100 my-1"></div>
                    {filteredUniqueFirmas.length === 0 ? (
                      <div className="px-3 py-2 text-[11px] text-slate-400 italic">No se encontraron resultados</div>
                    ) : (
                      filteredUniqueFirmas.map((f) => (
                        <div
                          key={f}
                          className={`px-3 py-1.5 text-[11px] cursor-pointer transition-colors border-l-2 ${filtroFirma === f ? 'bg-blue-50 text-blue-700 border-blue-600 font-semibold' : 'text-slate-700 hover:bg-slate-50 border-transparent'}`}
                          onClick={() => { setFiltroFirma(f); setFiltroFirmaBusq(''); setOpenDropdown(null); }}
                        >
                          {f}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="ml-auto flex items-end self-end gap-2">
            <button
              onClick={toggleExcelFilter}
              className={`h-8 flex items-center justify-center gap-1.5 px-3 rounded border text-[10px] font-semibold shadow-sm transition-colors ${
                excelFilterEnabled
                  ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-200'
                  : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
              }`}
              title="Filtro"
            >
              <Filter className="w-3.5 h-3.5" />
              Filtro
            </button>
            <button
              onClick={openSortModal}
              className="h-8 flex items-center justify-center gap-1.5 px-3 bg-slate-800 border border-slate-900 text-white rounded text-[10px] font-semibold shadow-sm hover:bg-slate-900 transition-colors"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              ORDENAR
            </button>
          </div>

          <div className="basis-full text-[9px] text-slate-500 font-medium whitespace-nowrap leading-none">
            TOTAL REGISTROS: {expedientesOrdenados.length} DE {expedientes.length} EXPEDIENTE(S)
            {hayFiltros && <span className="ml-1 text-blue-600 font-semibold">FILTRADO</span>}
          </div>

        </div>
      </div>
      </div>


      {/* TABLA PRINCIPAL TIPO EXCEL - COMPACTA Y RESPONSIVE */}
      <div className="bg-white rounded-lg border border-border overflow-hidden flex-1 min-h-0">
        <div
          ref={tableViewportRef}
          onScroll={updateVisibleRows}
          className="h-full min-h-0 overflow-auto"
        >
          <table className="w-full text-[10px] border-collapse">
            <thead className="bg-[#1e40af] text-white sticky top-0 z-10">
              <tr>
                {TABLE_HEADERS.map(renderTableHeader)}
                <th className="px-2 py-2 text-center font-semibold whitespace-nowrap min-w-[70px]">ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {topSpacerHeight > 0 && (
                <tr style={{ height: topSpacerHeight }}>
                  <td colSpan={TABLE_COLUMN_COUNT} className="p-0 border-0" />
                </tr>
              )}
              {expedientesVisibles.map((exp, index) => {
                const isSelectedRow = selectedRowId === exp.id;

                return (
                <tr
                  key={exp.id}
                  style={{ height: TABLE_ROW_HEIGHT }}
                  aria-selected={isSelectedRow}
                  onClick={() => setSelectedRowId((current) => (current === exp.id ? null : exp.id))}
                  className={`border-b border-border transition-colors cursor-pointer ${
                    isSelectedRow
                      ? 'bg-blue-100 hover:bg-blue-100 outline outline-2 outline-blue-600 outline-offset-[-2px] shadow-[inset_4px_0_0_#1d4ed8]'
                      : `hover:bg-accent/50 ${getRowColor(exp)}`
                  }`}
                >
                  <td className={`px-2 py-1.5 border-r text-center font-semibold ${isSelectedRow ? 'border-blue-200 text-blue-900' : 'border-border'}`}>{visibleRows.start + index + 1}</td>
                  <td className="px-2 py-1.5 border-r border-border font-medium">{exp.numeroJuicio}</td>
                  <td className="px-2 py-1.5 border-r border-border">{exp.materia}</td>
                  <td className="px-2 py-1.5 border-r border-border">{formatDate(exp.sentencia)}</td>
                  <td className="px-2 py-1.5 border-r border-border">
                    {formatDate(exp.fechaEjecutoriaColegiado)}
                  </td>
                  <td className="px-2 py-1.5 border-r border-border">
                    {formatDate(exp.fechaEjecutoriaInconformidad)}
                  </td>
                  <td className="px-2 py-1.5 border-r border-border">
                    {formatDate(exp.fechaEjecutoria)}
                  </td>
                  <td className="px-2 py-1.5 border-r border-border">
                    {formatDate(exp.fechaPorNoCumplida)}
                  </td>
                  <td className="px-2 py-1.5 border-r border-border">
                    {formatDate(exp.ultEjecutoria)}
                  </td>
                  <td className="px-2 py-1.5 border-r border-border">
                    {formatDate(exp.ultimoRequerimiento)}
                  </td>
                  <td className="px-2 py-1.5 border-r border-border text-center font-medium">{exp.diasNaturalesTranscurridos}</td>
                  <td className="px-2 py-1.5 border-r border-border text-center font-medium">{exp.diasHabilesTranscurridos}</td>
                  <td className="px-2 py-1.5 border-r border-border text-center">
                    <StatusBadgeSemaforo estatus={exp.estatus} diasHabiles={exp.diasHabilesTranscurridos} />
                  </td>
                  <td className="px-2 py-1.5 border-r border-border text-center">
                    {formatDate(exp.seDeclaroSinMateria)}
                  </td>
                  <td className="px-2 py-1.5 border-r border-border">
                    {formatDate(exp.fechaVista)}
                  </td>
                  <td className="px-2 py-1.5 border-r border-border text-center">{formatDate(exp.revisionContraSentencia)}</td>
                  <td className="px-2 py-1.5 border-r border-border">
                    {formatDate(exp.fechaCumplimiento)}
                  </td>
                  <td className="px-2 py-1.5 border-r border-border">
                    {formatDate(exp.fechaArchivo)}
                  </td>
                  <td className="px-2 py-1.5 border-r border-border text-center">
                    {formatValidation(exp.cumplimientoMenorFechaEjecutoria)}
                  </td>
                  <td className="px-2 py-1.5 border-r border-border max-w-xs truncate">{exp.observaciones}</td>
                  <td className="px-2 py-1.5 border-r border-border text-center">
                    {exp.localizado ? 'Si' : 'No'}
                  </td>
                  <td className="px-2 py-1.5 border-r border-border">
                    {formatDate(exp.actualizado)}
                  </td>
                  <td className="px-2 py-1.5 border-r border-border text-center">{exp.firma}</td>
                  <td className="px-2 py-1.5 border-r border-border text-center">
                    {formatValidation(exp.vistaMayorUltEjecutoria)}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedRowId(exp.id);
                        setSelectedExpediente(exp);
                      }}
                      className="p-1 hover:bg-blue-100 rounded transition-colors"
                      title="Ver detalle"
                    >
                      <Eye className="w-3 h-3 text-blue-600" />
                    </button>
                  </td>
                </tr>
                );
              })}
              {bottomSpacerHeight > 0 && (
                <tr style={{ height: bottomSpacerHeight }}>
                  <td colSpan={TABLE_COLUMN_COUNT} className="p-0 border-0" />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL IMPORTAR EXCEL */}
      {showModalImportar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 bg-teal-600 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <FileSpreadsheet className="w-5 h-5" />
                <h3 className="text-sm font-bold uppercase tracking-wide">Importar Excel — Cumplimientos</h3>
              </div>
              {importEtapa !== 'progreso' && (
                <button
                  onClick={() => { setShowModalImportar(false); setImportResultado(null); setImportError(''); setImportEtapa('seleccion'); }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-teal-500 text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="p-5">
              {/* Etapa: Selección de hoja (múltiples) */}
              {importEtapa === 'seleccion' && importHojas.length > 1 && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-700">
                    Se encontraron <strong>{importHojas.length}</strong> hojas con la palabra <span className="text-teal-700 font-semibold">CUMPLIMIENTO</span>. Selecciona la que deseas importar:
                  </p>
                  <div className="space-y-2">
                    {importHojas.map((hoja) => (
                      <label
                        key={hoja}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          importHojaSeleccionada === hoja
                            ? 'border-teal-500 bg-teal-50 text-teal-800'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="hoja"
                          value={hoja}
                          checked={importHojaSeleccionada === hoja}
                          onChange={() => setImportHojaSeleccionada(hoja)}
                          className="accent-teal-600"
                        />
                        <FileSpreadsheet className="w-4 h-4 shrink-0" />
                        <span className="text-xs font-semibold uppercase">{hoja}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => { setShowModalImportar(false); setImportEtapa('seleccion'); }}
                      className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => procesarImportacion(importWorkbook, importHojaSeleccionada)}
                      className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-bold hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Importar Hoja Seleccionada
                    </button>
                  </div>
                </div>
              )}

              {/* Etapa: Progreso */}
              {importEtapa === 'progreso' && (
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="w-12 h-12 rounded-full border-4 border-teal-200 border-t-teal-600 animate-spin" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-800">Importando datos...</p>
                    <p className="text-xs text-slate-500 mt-1">Comparando y actualizando expedientes</p>
                  </div>
                </div>
              )}

              {/* Etapa: Resultado */}
              {importEtapa === 'resultado' && (
                <div className="space-y-4">
                  {importError ? (
                    <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-800 mb-1">Error en la importación</p>
                        <p className="text-xs text-red-700">{importError}</p>
                      </div>
                    </div>
                  ) : importResultado && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-teal-700">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-sm font-bold">Importación completada</span>
                      </div>
                      <div className="text-xs text-slate-500">Hoja: <span className="font-semibold text-slate-700">{importResultado.hoja}</span></div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-teal-50 border border-teal-100 rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-teal-700">{importResultado.actualizados}</p>
                          <p className="text-[10px] text-teal-600 font-medium">Expedientes actualizados</p>
                        </div>
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-blue-700">{importResultado.celdasActualizadas}</p>
                          <p className="text-[10px] text-blue-600 font-medium">Celdas modificadas</p>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-slate-600">{importResultado.sinCambios}</p>
                          <p className="hidden font-medium">Sin cambios</p>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-emerald-700">{importResultado.insertados ?? 0}</p>
                          <p className="text-[10px] text-emerald-600 font-medium">Nuevos insertados</p>
                        </div>
                        {(importResultado.noEncontrados ?? 0) > 0 && (
                          <div className="col-span-2 bg-amber-50 border border-amber-100 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-amber-700">{importResultado.noEncontrados}</p>
                            <p className="text-[10px] text-amber-600 font-medium">No encontrados en BD</p>
                          </div>
                        )}
                      </div>

                      {importResultado.columnasFaltantes.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <p className="text-xs font-semibold text-amber-800 mb-1.5">
                            ⚠ {importResultado.columnasFaltantes.length} columna(s) no encontradas en el Excel:
                          </p>
                          <p className="text-[10px] text-amber-700 leading-relaxed">
                            {importResultado.columnasFaltantes.join(' • ')}
                          </p>
                        </div>
                      )}

                      {/* Diagnóstico — siempre visible si hay no-encontrados */}
                      {importResultado.noEncontrados > 0 && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
                          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                            🔍 Diagnóstico de coincidencias
                          </p>
                          <p className="hidden">
                            Encabezado detectado en fila: <span className="font-semibold text-slate-700">{importResultado.filaEncabezado + 1}</span>
                            {' · '}Columna JUICIO: índice <span className="font-semibold text-slate-700">{importResultado.columnaJuicio}</span>
                          </p>
                          <div className="flex gap-3">
                            <div className="flex-1">
                              <p className="text-[9px] font-bold text-slate-400 mb-0.5">EXCEL (primeros 5):</p>
                              {importResultado.sampleExcel.map((v: string, i: number) => (
                                <p key={i} className="text-[10px] text-slate-700 font-mono truncate">"{v}"</p>
                              ))}
                            </div>
                            <div className="flex-1">
                              <p className="text-[9px] font-bold text-slate-400 mb-0.5">BASE DE DATOS (primeros 3):</p>
                              {importResultado.sampleDB.map((v: string, i: number) => (
                                <p key={i} className="text-[10px] text-slate-700 font-mono truncate">"{v}"</p>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {importResultado.errores.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-xs font-semibold text-red-800 mb-1.5">Errores ({importResultado.errores.length}):</p>
                          <ul className="text-[10px] text-red-700 space-y-0.5 max-h-24 overflow-y-auto">
                            {importResultado.errores.map((e: string, i: number) => <li key={i}>• {e}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}


                  <button
                    onClick={() => { setShowModalImportar(false); setImportResultado(null); setImportError(''); setImportEtapa('seleccion'); }}
                    className="w-full px-4 py-2.5 bg-teal-600 text-white rounded-lg text-xs font-bold hover:bg-teal-700 transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL ORDENAR */}
      {showModalOrdenar && (
        <div
          className="fixed inset-0 bg-black/55 backdrop-blur-[2px] z-50 flex items-center justify-center p-4"
          onClick={() => setOpenDropdown(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-lg shadow-2xl border border-slate-200 overflow-hidden"
            onClick={() => setOpenDropdown(null)}
          >
            <div className="px-3 py-2 bg-[#1e40af] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="hidden">
                  <ArrowUpDown className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold tracking-wide">ORDENAMIENTO</h3>
                  <p className="hidden">
                    {draftSortLevels.length === 0
                      ? 'Sin criterios activos'
                      : draftSortLevels.length + ' criterio' + (draftSortLevels.length === 1 ? '' : 's') + ' configurado' + (draftSortLevels.length === 1 ? '' : 's')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModalOrdenar(false)}
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 space-y-2">
              <div className="flex items-center gap-1.5">
                <button onClick={addSortLevel} className="h-7 px-2.5 flex items-center justify-center gap-1 rounded-md bg-emerald-600 text-white text-[10px] font-semibold hover:bg-emerald-700 transition-colors">
                  <Plus className="w-4 h-4" />
                  Agregar
                </button>
                <button onClick={deleteSortLevel} disabled={!selectedSortLevelId} className="h-7 px-2.5 flex items-center justify-center gap-1 rounded-md border border-slate-300 bg-white text-slate-700 text-[10px] font-semibold hover:bg-slate-100 disabled:opacity-45 disabled:cursor-not-allowed">
                  <Trash2 className="w-4 h-4 text-red-500" />
                  Eliminar
                </button>
                <button onClick={copySortLevel} disabled={draftSortLevels.length === 0} className="h-7 px-2.5 flex items-center justify-center gap-1 rounded-md border border-slate-300 bg-white text-slate-700 text-[10px] font-semibold hover:bg-slate-100 disabled:opacity-45 disabled:cursor-not-allowed">
                  <Copy className="w-4 h-4 text-slate-500" />
                  Copiar
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => moveSortLevel(-1)} disabled={!selectedSortLevelId} className="h-7 w-7 rounded-md border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center" title="Subir nivel">
                    <ChevronUp className="w-4 h-4 text-blue-700" />
                  </button>
                  <button onClick={() => moveSortLevel(1)} disabled={!selectedSortLevelId} className="h-7 w-7 rounded-md border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center" title="Bajar nivel">
                    <ChevronDown className="w-4 h-4 text-blue-700" />
                  </button>
                </div>
                
              </div>

              <div>
                {draftSortLevels.length === 0 ? (
                  <div className="h-32 rounded-md border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center gap-1.5 px-3 text-center">
                    <div className="h-7 w-7 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700">
                      <ArrowUpDown className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Sin ordenamiento configurado</p>
                      <p className="text-xs text-slate-500 mt-1">Agrega un nivel para ordenar la tabla.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                    {draftSortLevels.map((level, index) => {
                      const column = getSortColumn(level.column);
                      const selected = selectedSortLevelId === level.id;

                      return (
                        <div
                          key={level.id}
                          onClick={() => setSelectedSortLevelId(level.id)}
                          className={`rounded-md border p-2 transition-colors ${selected ? 'border-blue-500 bg-blue-50/70 shadow-sm' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="hidden">{String(index + 1).padStart(2, '0')}</span>
                              <div>
                                <p className="text-[11px] font-bold text-slate-900">{index === 0 ? 'Principal' : 'Secundario'}</p>
                                <p className="hidden"></p>
                              </div>
                            </div>
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{index === 0 ? 'Primero' : 'Luego'}</span>
                          </div>

                          <div className="grid grid-cols-[120px_minmax(150px,1fr)_minmax(150px,1fr)] gap-2 items-end">
                            <div className="relative">
                              <p className="text-[9px] font-bold text-slate-500 mb-0.5 uppercase tracking-wide">Columna</p>
                              <button type="button" onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === `col-${level.id}` ? null : `col-${level.id}`); }} className="h-8 w-full pl-2 pr-7 border border-slate-300 hover:border-blue-400 rounded-md bg-white text-[11px] font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 flex items-center justify-between text-left relative">
                                <span className="truncate">{column.label}</span>
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              </button>
                              {openDropdown === `col-${level.id}` && (
                                <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-56 overflow-y-auto w-full py-1 ring-1 ring-black/5" onClick={(e) => e.stopPropagation()}>
                                  {SORT_COLUMNS.map((option) => (
                                    <div key={option.key} className={`px-3 py-1.5 text-[11px] cursor-pointer border-l-2 ${level.column === option.key ? 'bg-blue-50 text-blue-700 border-blue-600 font-semibold' : 'text-slate-700 hover:bg-slate-50 border-transparent'}`} onClick={() => { updateSortLevel(level.id, { column: option.key }); setOpenDropdown(null); }}>
                                      {option.label}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="relative">
                              <p className="text-[9px] font-bold text-slate-500 mb-0.5 uppercase tracking-wide">Orden</p>
                              <button type="button" onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === `order-${level.id}` ? null : `order-${level.id}`); }} className="h-8 w-full pl-2 pr-7 border border-slate-300 hover:border-blue-400 rounded-md bg-white text-[11px] font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 flex items-center justify-between text-left relative">
                                <span className="truncate">{getSortOrderLabel(column, level.direction)}</span>
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              </button>
                              {openDropdown === `order-${level.id}` && (
                                <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl py-1 ring-1 ring-black/5 w-full" onClick={(e) => e.stopPropagation()}>
                                  <div className={`px-3 py-1.5 text-[11px] cursor-pointer border-l-2 ${level.direction === 'ASC' ? 'bg-blue-50 text-blue-700 border-blue-600 font-semibold' : 'text-slate-700 hover:bg-slate-50 border-transparent'}`} onClick={() => { updateSortLevel(level.id, { direction: 'ASC' }); setOpenDropdown(null); }}>
                                    {getSortOrderLabel(column, 'ASC')}
                                  </div>
                                  <div className={`px-3 py-1.5 text-[11px] cursor-pointer border-l-2 ${level.direction === 'DESC' ? 'bg-blue-50 text-blue-700 border-blue-600 font-semibold' : 'text-slate-700 hover:bg-slate-50 border-transparent'}`} onClick={() => { updateSortLevel(level.id, { direction: 'DESC' }); setOpenDropdown(null); }}>
                                    {getSortOrderLabel(column, 'DESC')}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="px-3 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button onClick={() => setShowModalOrdenar(false)} className="min-w-[90px] px-3 py-2 bg-white border border-slate-300 rounded-md text-[11px] font-semibold hover:bg-slate-100">Cancelar</button>
              <button onClick={applySortLevels} className="min-w-[100px] px-3 py-2 bg-[#1e40af] text-white rounded-md text-[11px] font-semibold hover:bg-blue-800">Aplicar</button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL AGREGAR NUEVOS EXPEDIENTES POR RANGO */}
      {showModalAgregar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 md:p-6 border-b border-border flex items-center justify-between bg-[#1e40af] text-white rounded-t-lg">
              <h3 className="text-sm md:text-base font-bold">Agregar Nuevos Expedientes por Rango</h3>
              <button
                onClick={() => {
                  setShowModalAgregar(false);
                  setArchivoAgregar(null);
                  setFechaInicial('');
                  setFechaFinal('');
                  setResultadoAgregar(null);
                  setErrorAgregar('');
                }}
                className="p-1.5 hover:bg-blue-700 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 md:p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-[11px] md:text-xs text-blue-800">
                  <strong>Instrucción:</strong> Seleccione un archivo Excel con expedientes y defina el rango de fechas de ejecutoria para filtrar los expedientes que desea agregar al listado CUMPLIMIENTOS.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium mb-2">Archivo SENTENCIAS</label>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".xlsx,.xlsm,.xls"
                    onChange={(e) => {
                      setArchivoAgregar(e.target.files?.[0] || null);
                      setResultadoAgregar(null);
                      setErrorAgregar('');
                    }}
                    className="hidden"
                  />
                  <span className="inline-block w-full px-4 py-2.5 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors text-center border border-border text-xs">
                    {archivoAgregar ? archivoAgregar.name : 'Seleccionar Archivo Excel'}
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-2">Fecha Inicial de Ejecutoria</label>
                  <input
                    type="date"
                    value={fechaInicial}
                    onChange={(e) => setFechaInicial(e.target.value)}
                    className="w-full px-3 py-2 bg-input-background border border-input rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2">Fecha Final de Ejecutoria</label>
                  <input
                    type="date"
                    value={fechaFinal}
                    onChange={(e) => setFechaFinal(e.target.value)}
                    className="w-full px-3 py-2 bg-input-background border border-input rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              {archivoAgregar && fechaInicial && fechaFinal && !resultadoAgregar && (
                <div className="bg-card rounded-lg border border-border p-4">
                  <h4 className="text-xs font-semibold mb-2">Criterios del proceso</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Se procesara la hoja SENTENCIAS, solo expedientes con AMPARA = SI,
                    ACUMULADO distinto de SI y fecha de ejecutoria dentro del rango seleccionado.
                  </p>
                </div>
              )}

              {false && archivoAgregar && fechaInicial && fechaFinal && !resultadoAgregar && (
                <div className="bg-card rounded-lg border border-border p-4">
                  <h4 className="text-xs font-semibold mb-3">
                    Vista Previa - Expedientes en Rango ({fechaInicial} a {fechaFinal})
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead className="bg-muted/50 border-b border-border">
                        <tr>
                          <th className="px-2 py-2 text-left font-semibold">N° Juicio</th>
                          <th className="px-2 py-2 text-left font-semibold">Materia</th>
                          <th className="px-2 py-2 text-left font-semibold">Fecha Ejecutoria</th>
                          <th className="px-2 py-2 text-left font-semibold">Incluir</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {[1, 2, 3, 4].map((i) => (
                          <tr key={i} className="hover:bg-muted/30">
                            <td className="px-2 py-2">{200 + i}/2024</td>
                            <td className="px-2 py-2">TRABAJO</td>
                            <td className="px-2 py-2">{fechaInicial}</td>
                            <td className="px-2 py-2">
                              <CheckCircle className="w-3 h-3 text-green-500" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {resultadoAgregar && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-xs font-semibold text-green-900 mb-2">
                        Expedientes Agregados al Listado CUMPLIMIENTOS
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <p className="text-xl font-bold text-green-900">{resultadoAgregar.total}</p>
                          <p className="text-[10px] text-green-700">Procesados</p>
                        </div>
                        <div>
                          <p className="text-xl font-bold text-green-900">{resultadoAgregar.nuevos}</p>
                          <p className="text-[10px] text-green-700">Insertados</p>
                        </div>
                        <div>
                          <p className="text-xl font-bold text-green-900">{resultadoAgregar.duplicados}</p>
                          <p className="text-[10px] text-green-700">Duplicados</p>
                        </div>
                        <div>
                          <p className="text-xl font-bold text-green-900">{resultadoAgregar.omitidos}</p>
                          <p className="text-[10px] text-green-700">Omitidos</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {errorAgregar && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] font-medium text-red-800">{errorAgregar}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 md:p-6 border-t border-border bg-gray-50 rounded-b-lg flex gap-3">
              {!resultadoAgregar ? (
                <button
                  onClick={handleBuscarExpedientes}
                  disabled={!archivoAgregar || !fechaInicial || !fechaFinal || agregandoExpedientes}
                  className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {agregandoExpedientes ? 'Procesando...' : 'Agregar al Listado CUMPLIMIENTOS'}
                </button>
              ) : (
                <button
                  onClick={() => {
                    setShowModalAgregar(false);
                    setArchivoAgregar(null);
                    setFechaInicial('');
                    setFechaFinal('');
                    setResultadoAgregar(null);
                    setErrorAgregar('');
                  }}
                  className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium text-xs"
                >
                  Cerrar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL ACTUALIZAR DESDE SENTENCIAS */}
      {showModalActualizar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 md:p-6 border-b border-border flex items-center justify-between bg-[#1e40af] text-white rounded-t-lg">
              <h3 className="text-sm md:text-base font-bold">Actualizar desde SENTENCIAS</h3>
              <button
                onClick={() => {
                  setShowModalActualizar(false);
                  setArchivoActualizar(null);
                  setValidado(false);
                  setResultadoActualizar(null);
                }}
                className="p-1.5 hover:bg-blue-700 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 md:p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-[11px] md:text-xs text-blue-800">
                  <strong>Instrucción:</strong> Seleccione un archivo Excel actualizado de SENTENCIAS. El sistema comparará con los expedientes existentes en CUMPLIMIENTOS y actualizará los datos que hayan cambiado.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium mb-2">Archivo SENTENCIAS Actualizado</label>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => {
                      setArchivoActualizar(e.target.files?.[0] || null);
                      setValidado(false);
                      setResultadoActualizar(null);
                      setErrorActualizar('');
                    }}
                    className="hidden"
                  />
                  <span className="inline-block w-full px-4 py-2.5 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors text-center border border-border text-xs">
                    {archivoActualizar ? archivoActualizar.name : 'Seleccionar Archivo Excel'}
                  </span>
                </label>
              </div>

              {errorActualizar && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-[11px] md:text-xs font-medium text-red-700">{errorActualizar}</p>
                </div>
              )}

              {archivoActualizar && validado && !resultadoActualizar && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-semibold text-green-900 mb-1">Archivo validado</h4>
                      <p className="text-[11px] md:text-xs text-green-800">
                        La hoja SENTENCIAS contiene el encabezado EXPEDIENTE y está lista para actualizar CUMPLIMIENTOS.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {false && archivoActualizar && validado && !resultadoActualizar && (
                <div className="bg-card rounded-lg border border-border p-4">
                  <h4 className="text-xs font-semibold mb-3">Vista Previa de Cambios Detectados</h4>
                  <div className="space-y-2">
                    {[
                      { juicio: '639/2025', campo: 'Último Requerimiento', anterior: '10/02/2025', nuevo: '15/03/2025' },
                      { juicio: '872/2022', campo: 'Días Hábiles', anterior: '595', nuevo: '602' },
                      { juicio: '1839/2025', campo: 'Estatus', anterior: 'EN_PLAZO', nuevo: 'ATENCION' },
                    ].map((cambio, index) => (
                      <div key={index} className="bg-yellow-50 border border-yellow-200 rounded p-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-[11px] font-semibold text-yellow-900 mb-2">
                              {cambio.juicio} - {cambio.campo}
                            </p>
                            <div className="grid grid-cols-2 gap-3 text-[10px]">
                              <div>
                                <p className="text-yellow-700 font-medium mb-1">Valor Anterior:</p>
                                <p className="text-yellow-900 bg-white/50 rounded px-2 py-1">{cambio.anterior}</p>
                              </div>
                              <div>
                                <p className="text-yellow-700 font-medium mb-1">Valor Nuevo:</p>
                                <p className="text-yellow-900 bg-white/50 rounded px-2 py-1">{cambio.nuevo}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {resultadoActualizar && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-xs font-semibold text-green-900 mb-2">
                        Actualización Completada en Listado CUMPLIMIENTOS
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div>
                          <p className="text-xl font-bold text-green-900">{resultadoActualizar.indexados}</p>
                          <p className="text-[10px] text-green-700">Indexados</p>
                        </div>
                        <div>
                          <p className="text-xl font-bold text-green-900">{resultadoActualizar.localizados}</p>
                          <p className="text-[10px] text-green-700">Localizados</p>
                        </div>
                        <div>
                          <p className="text-xl font-bold text-green-900">{resultadoActualizar.actualizados}</p>
                          <p className="text-[10px] text-green-700">Actualizados</p>
                        </div>
                        <div>
                          <p className="text-xl font-bold text-green-900">{resultadoActualizar.noLocalizados}</p>
                          <p className="text-[10px] text-green-700">No Localizados</p>
                        </div>
                        <div>
                          <p className="text-xl font-bold text-green-900">{resultadoActualizar.errores}</p>
                          <p className="text-[10px] text-green-700">Errores</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 md:p-6 border-t border-border bg-gray-50 rounded-b-lg flex gap-3">
              {!validado && !resultadoActualizar && (
                <button
                  onClick={handleValidarArchivo}
                  disabled={!archivoActualizar || actualizandoCumplimientos}
                  className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Validar Archivo
                </button>
              )}
              {validado && !resultadoActualizar && (
                <button
                  onClick={handleActualizarCumplimientos}
                  disabled={actualizandoCumplimientos}
                  className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actualizandoCumplimientos ? 'Actualizando...' : 'Actualizar CUMPLIMIENTOS'}
                </button>
              )}
              {resultadoActualizar && (
                <button
                  onClick={() => {
                    setShowModalActualizar(false);
                    setArchivoActualizar(null);
                    setValidado(false);
                    setResultadoActualizar(null);
                  }}
                  className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium text-xs"
                >
                  Cerrar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PANEL LATERAL DE DETALLE - RESPONSIVE */}
      {selectedExpediente && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-end">
          <div className="w-full md:max-w-xl lg:max-w-2xl h-full bg-white shadow-2xl flex flex-col">
            <div className="p-4 md:p-6 border-b border-border flex items-center justify-between bg-[#1e40af] text-white">
              <div>
                <h3 className="font-bold text-sm md:text-base">Detalle del Expediente</h3>
                <p className="text-[11px] md:text-xs text-blue-100 mt-1">{selectedExpediente.numeroJuicio}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedExpediente(null);
                  setIsEditing(false);
                  setEditDraft(null);
                  setEditError('');
                }}
                className="p-1.5 hover:bg-blue-700 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-white rounded-lg p-4 md:p-6 text-center border-2 border-blue-200">
                <p className="text-[10px] md:text-xs text-muted-foreground mb-3">Estatus Actual</p>
                <StatusBadgeSemaforo
                  estatus={selectedExpediente.estatus}
                  diasHabiles={selectedExpediente.diasHabilesTranscurridos}
                  large
                />
              </div>

              {getAlertas(selectedExpediente).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3 text-orange-500" />
                    Alertas
                  </h4>
                  {getAlertas(selectedExpediente).map((alerta, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-2 p-2 md:p-3 rounded-lg border ${
                        alerta.tipo === 'error'
                          ? 'bg-red-50 border-red-200'
                          : alerta.tipo === 'warning'
                          ? 'bg-yellow-50 border-yellow-200'
                          : 'bg-blue-50 border-blue-200'
                      }`}
                    >
                      <AlertTriangle className={`w-3 h-3 flex-shrink-0 mt-0.5 ${
                        alerta.tipo === 'error'
                          ? 'text-red-600'
                          : alerta.tipo === 'warning'
                          ? 'text-yellow-600'
                          : 'text-blue-600'
                      }`} />
                      <p className="text-[10px] md:text-[11px] font-medium">{alerta.texto}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                <h4 className="text-xs font-semibold border-b pb-2">Informacion General</h4>
                <div className="grid grid-cols-2 gap-3">
                  {renderEditableField('Número de Orden', 'numeroOrden', { type: 'number' })}
                  {renderEditableField('Número de Juicio', 'numeroJuicio')}
                  {renderEditableField('Materia', 'materia')}
                  {renderEditableField('Sentencia', 'sentencia', { type: 'date', className: 'col-span-2' })}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold border-b pb-2 flex items-center gap-2">
                  <Calendar className="w-3 h-3" />
                  Fechas Importantes
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {renderEditableField('Fecha Ejecutoria Colegiado', 'fechaEjecutoriaColegiado', { type: 'date' })}
                  {renderEditableField('Fecha Ejecutoria Inconformidad', 'fechaEjecutoriaInconformidad', { type: 'date' })}
                  {renderEditableField('Fecha de Ejecutoria', 'fechaEjecutoria', { type: 'date' })}
                  {renderEditableField('Fecha por No Cumplida', 'fechaPorNoCumplida', { type: 'date' })}
                  {renderEditableField('Ultima Ejecutoria', 'ultEjecutoria', { type: 'date', readOnly: true })}
                  {renderEditableField('Último Requerimiento', 'ultimoRequerimiento', { type: 'date' })}
                  {(isEditing || selectedExpediente.fechaVista) && renderEditableField('Fecha de Vista', 'fechaVista', { type: 'date' })}
                  {(isEditing || selectedExpediente.fechaCumplimiento) && renderEditableField('Fecha de Cumplimiento', 'fechaCumplimiento', { type: 'date' })}
                  {(isEditing || selectedExpediente.fechaArchivo) && renderEditableField('Fecha de Archivo', 'fechaArchivo', { type: 'date' })}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold border-b pb-2 flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  Días Transcurridos
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
                    <p className="text-2xl md:text-3xl font-bold text-blue-700">{selectedExpediente.diasNaturalesTranscurridos}</p>
                    <p className="text-[10px] text-blue-600 mt-1">Días Naturales</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
                    <p className="text-2xl md:text-3xl font-bold text-blue-700">{selectedExpediente.diasHabilesTranscurridos}</p>
                    <p className="text-[10px] text-blue-600 mt-1">Días Hábiles</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold border-b pb-2">Informacion Adicional</h4>
                <div className="grid grid-cols-2 gap-3">
                  {renderEditableField('Revisión Contra Sentencia', 'revisionContraSentencia')}
                  {renderEditableField('Se Declaro Sin Materia', 'seDeclaroSinMateria', { type: 'date' })}
                  {renderEditableField('Localizado', 'localizado', { type: 'boolean' })}
                  {renderEditableField('Actualizado', 'actualizado', { type: 'date', readOnly: true })}
                  {renderEditableField('Firma', 'firma')}
                </div>
              </div>

              {(isEditing || selectedExpediente.observaciones) && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold border-b pb-2">Observaciones</h4>
                  {isEditing
                    ? renderEditableField('Observaciones', 'observaciones', { type: 'textarea' })
                    : (
                      <p className="text-[10px] md:text-[11px] text-muted-foreground bg-gray-50 rounded-lg p-3 border border-border">
                        {selectedExpediente.observaciones}
                      </p>
                    )}
                </div>
              )}

              {editError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-[11px] md:text-xs font-medium text-red-700">{editError}</p>
                </div>
              )}
            </div>

            <div className="p-4 md:p-6 border-t border-border bg-gray-50">
              <div className="flex gap-3">
                {!isEditing ? (
                  <>
                    {can('cumplimientos.edit') && (
                      <button
                        onClick={beginEditExpediente}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 md:py-2.5 bg-white border border-border text-foreground rounded-md hover:bg-accent transition-colors font-medium text-xs"
                      >
                        <Edit className="w-3 h-3" />
                        Editar
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSelectedExpediente(null);
                        setIsEditing(false);
                        setEditDraft(null);
                        setEditError('');
                      }}
                      className="flex-1 px-4 py-2 md:py-2.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium text-xs"
                    >
                      Cerrar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={cancelEditExpediente}
                      disabled={savingEdit}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 md:py-2.5 bg-white border border-border text-foreground rounded-md hover:bg-accent transition-colors font-medium text-xs"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={saveEditExpediente}
                      disabled={savingEdit}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 md:py-2.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Save className="w-3 h-3" />
                      {savingEdit ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadgeSemaforo({
  estatus,
  diasHabiles = '',
  large = false,
}: {
  estatus: number | string;
  diasHabiles?: number | string;
  large?: boolean;
}) {
  const band = getEstatusBand(estatus, diasHabiles);
  const config = {
    GREEN: { label: 'En plazo', color: 'bg-[#6fa191]', ring: 'ring-[#4f8173]' },
    YELLOW: { label: 'Atencion', color: 'bg-[#d9ad52]', ring: 'ring-[#b98b34]' },
    PINK: { label: 'Requerir cumplimiento', color: 'bg-[#df9a8f]', ring: 'ring-[#c5796d]' },
    RED: { label: 'Vencido', color: 'bg-[#c7472d]', ring: 'ring-[#a43321]' },
    EMPTY: { label: 'Sin estatus', color: 'bg-transparent', ring: 'ring-transparent' },
  }[band];

  if (band === 'EMPTY' && !large) {
    return null;
  }

  if (large) {
    return (
      <div className={`inline-flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2 md:py-4 rounded-lg text-white ${config.color} shadow-lg`}>
        <span className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-white/95 shadow-md animate-pulse" />
        <span className="text-sm md:text-xl font-bold">{config.label}</span>
      </div>
    );
  }

  return (
    <span
      aria-label={config.label}
      title={config.label}
      className={`inline-block h-2.5 w-2.5 rounded-full ${config.color} ring-1 ${config.ring}`}
    />
  );
}

function DetailField({
  label,
  value,
  className = ''
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[10px] text-muted-foreground mb-1 font-medium">{label}</p>
      <p className="text-[11px] font-semibold text-foreground">{value}</p>
    </div>
  );
}


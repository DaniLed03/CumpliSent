import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { SortDirection, DateFilterTreeNode, MONTH_NAMES, TriStateCheckbox, parseDateFilterOption, buildDateFilterTree, getFilterMenuSortLabel } from './FilterUtils';
import {
  AlertCircle,
  ArrowUpDown,
  ChevronDown,
  CheckCircle,
  Download,
  Edit,
  FileSpreadsheet,
  GitCompare,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import { toastSuccess, toastError, toastWarning } from '../utils/toast';

interface IngresosExpedientesProps {
  permissions: string[];
  isAdmin: boolean;
  session: any;
}

interface IngresoRecord {
  id: number;
  fechaIngreso: string;
  numeroJuicio: string;
  sentencia: string;
  fechaEjecutoriaJuzgado: string;
  fechaEjecutoriaColegiado: string;
  fechaEjecutoriaInconformidad: string;
  personaCaptura: string;
}

const EMPTY_FORM = {
  fechaIngreso: '',
  numeroJuicio: '',
  sentencia: '',
  fechaEjecutoriaJuzgado: '',
  fechaEjecutoriaColegiado: '',
  fechaEjecutoriaInconformidad: '',
  personaCaptura: '',
};

const ISSUE_LABELS: Record<string, string> = {
  INGRESO_NO_EXISTE_EN_SISE: 'Ingreso no registrado en SISE',
  SIN_FECHA_EQUIVALENTE_SISE: 'Sin fecha equivalente en SISE',
  DIFERENCIA_FECHA_EJECUTORIA: 'Diferencia de ejecutoria',
  SIN_PERSONA_CAPTURA: 'Sin persona captura',
  SISE_NO_TURNADO_CUMPLIMIENTOS: 'SISE sin turno a cumplimientos',
};

type ColumnType = 'text' | 'date';
type IngresoColumn = { key: string; label: string; type: ColumnType };
type IngresoSortRule = { key: string; direction: SortDirection };

const REGISTRO_COLUMNS: IngresoColumn[] = [
  { key: 'fechaIngreso', label: 'Fecha de ingreso', type: 'date' },
  { key: 'numeroJuicio', label: 'Número de juicio', type: 'text' },
  { key: 'sentencia', label: 'Sentencia', type: 'date' },
  { key: 'fechaEjecutoriaJuzgado', label: 'Fecha ejecutoria juzgado', type: 'date' },
  { key: 'fechaEjecutoriaColegiado', label: 'Fecha ejecutoria colegiado', type: 'date' },
  { key: 'fechaEjecutoriaInconformidad', label: 'Fecha ejecutoria inconformidad', type: 'date' },
  { key: 'personaCaptura', label: 'Persona captura', type: 'text' },
];

const COMPARACION_COLUMNS: IngresoColumn[] = [
  { key: 'tipo', label: 'Tipo', type: 'text' },
  { key: 'numeroJuicio', label: 'Número de juicio', type: 'text' },
  { key: 'detalle', label: 'Detalle', type: 'text' },
  { key: 'ingresoInterno', label: 'Ingreso interno', type: 'text' },
  { key: 'sise', label: 'SISE', type: 'text' },
];

const INGRESOS_REGISTRO_SORT_STORAGE_KEY = 'ingresos_expedientes.registros.sort.v1';
const INGRESOS_COMPARACION_SORT_STORAGE_KEY = 'ingresos_expedientes.comparacion.sort.v1';

function normalizeIngresoSortRule(raw: unknown, columns: IngresoColumn[]): IngresoSortRule | null {
  if (!raw || typeof raw !== 'object') return null;
  const rule = raw as Partial<IngresoSortRule>;
  if (!columns.some((column) => column.key === rule.key)) return null;
  if (rule.direction !== 'ASC' && rule.direction !== 'DESC') return null;
  return { key: rule.key, direction: rule.direction };
}

function loadIngresoSortRule(storageKey: string, columns: IngresoColumn[]): IngresoSortRule | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === null) return null;
    return normalizeIngresoSortRule(JSON.parse(raw), columns);
  } catch {
    return null;
  }
}

function saveIngresoSortRule(storageKey: string, rule: IngresoSortRule | null, columns: IngresoColumn[]) {
  if (typeof window === 'undefined') return;

  try {
    const normalizedRule = normalizeIngresoSortRule(rule, columns);
    window.localStorage.setItem(storageKey, JSON.stringify(normalizedRule));
  } catch {
    // El ordenamiento sigue funcionando aunque el navegador bloquee almacenamiento local.
  }
}

function formatDate(value: unknown) {
  if (!value) return '-';
  const text = String(value);
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return text;
}

function parseDateValue(value: unknown) {
  const text = String(value || '');
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const mx = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mx) return Date.UTC(Number(mx[3]), Number(mx[2]) - 1, Number(mx[1]));
  return Number.POSITIVE_INFINITY;
}

function compareValues(a: unknown, b: unknown, type: ColumnType, direction: SortDirection) {
  const result = type === 'date'
    ? parseDateValue(a) - parseDateValue(b)
    : String(a || '').localeCompare(String(b || ''), 'es-MX', { numeric: true, sensitivity: 'base' });
  return direction === 'ASC' ? result : -result;
}

function getIssueValue(issue: any, key: string) {
  if (key === 'tipo') return ISSUE_LABELS[issue.type] || issue.type || '';
  if (key === 'numeroJuicio') return issue.numeroJuicio || '';
  if (key === 'detalle') return issue.detail || '';
  if (key === 'ingresoInterno') {
    return issue.ingreso
      ? `${formatDate(issue.ingreso.fechaEjecutoriaJuzgado || issue.ingreso.fechaEjecutoriaColegiado || issue.ingreso.fechaEjecutoriaInconformidad)} / ${issue.ingreso.personaCaptura || 'Sin persona'}`
      : '-';
  }
  if (key === 'sise') {
    return issue.sise
      ? `${formatDate(issue.sise.fechaEjecutoria || issue.sise.fechaEjecutoriaColegiado || issue.sise.fechaEjecutoriaInconformidad)} / ${issue.sise.numeroJuicio || '-'}`
      : '-';
  }
  return '';
}

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function excelDateToIso(value: unknown, XLSX: typeof import('xlsx')) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
  }
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const mx = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (mx) {
    const year = mx[3].length === 2 ? `20${mx[3]}` : mx[3];
    return `${year}-${mx[2].padStart(2, '0')}-${mx[1].padStart(2, '0')}`;
  }
  return text;
}

export default function IngresosExpedientes({ permissions, isAdmin, session }: IngresosExpedientesProps) {
  const [activeTab, setActiveTab] = useState<'registros' | 'comparacion'>('registros');
  const [rows, setRows] = useState<IngresoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<IngresoRecord | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [deleting, setDeleting] = useState<IngresoRecord | null>(null);
  const [importing, setImporting] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [comparison, setComparison] = useState<any | null>(null);
  const [openHeaderMenu, setOpenHeaderMenu] = useState<string | null>(null);
  const [registroFilters, setRegistroFilters] = useState<Record<string, string[]>>({});
  const [comparacionFilters, setComparacionFilters] = useState<Record<string, string[]>>({});
  const [registroSort, setRegistroSort] = useState<IngresoSortRule | null>(() =>
    loadIngresoSortRule(INGRESOS_REGISTRO_SORT_STORAGE_KEY, REGISTRO_COLUMNS),
  );
  const [comparacionSort, setComparacionSort] = useState<IngresoSortRule | null>(() =>
    loadIngresoSortRule(INGRESOS_COMPARACION_SORT_STORAGE_KEY, COMPARACION_COLUMNS),
  );
  const [showModalOrdenar, setShowModalOrdenar] = useState(false);
  const [draftSortKey, setDraftSortKey] = useState('');
  const [draftSortDirection, setDraftSortDirection] = useState<SortDirection>('ASC');
  const [draftSortEnabled, setDraftSortEnabled] = useState(false);

  const can = useCallback((p: string) => isAdmin || permissions.includes(p), [isAdmin, permissions]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.api.listIngresosExpedientes();
      setRows(data || []);
      return true;
    } catch (err: any) {
      toastError('Error', err.message || 'No se pudieron cargar los ingresos de expedientes.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  async function handleReload() {
    const loaded = await loadRows();
    if (!loaded) return;
    if (activeTab === 'comparacion' && can('ingresos.compare')) {
      await runComparison();
    }
    toastSuccess('Datos recargados', 'La tabla de ingresos de expedientes se actualizo correctamente.');
  }

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const searched = !q ? rows : rows.filter((row) =>
      [
        row.numeroJuicio,
        row.personaCaptura,
        row.fechaIngreso,
        row.sentencia,
        row.fechaEjecutoriaJuzgado,
        row.fechaEjecutoriaColegiado,
        row.fechaEjecutoriaInconformidad,
      ].some((value) => String(value || '').toLowerCase().includes(q)),
    );
    const byColumns = searched.filter((row) =>
      Object.entries(registroFilters).every(([key, selected]) => {
        if (!selected.length) return true;
        const value = formatDate((row as any)[key]);
        return selected.includes(value);
      }),
    );
    const sorted = [...byColumns];
    if (registroSort) {
      const column = REGISTRO_COLUMNS.find((item) => item.key === registroSort.key) || REGISTRO_COLUMNS[0];
      sorted.sort((a, b) => compareValues((a as any)[column.key], (b as any)[column.key], column.type, registroSort.direction));
    }
    return sorted;
  }, [rows, search, registroFilters, registroSort]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      personaCaptura: String(session?.user?.NombreCompleto || session?.user?.Usuario || '').toUpperCase(),
    });
    setModalError('');
    setShowModal(true);
  }

  function openEdit(row: IngresoRecord) {
    setEditing(row);
    setForm({
      fechaIngreso: row.fechaIngreso || '',
      numeroJuicio: row.numeroJuicio || '',
      sentencia: row.sentencia || '',
      fechaEjecutoriaJuzgado: row.fechaEjecutoriaJuzgado || '',
      fechaEjecutoriaColegiado: row.fechaEjecutoriaColegiado || '',
      fechaEjecutoriaInconformidad: row.fechaEjecutoriaInconformidad || '',
      personaCaptura: String(row.personaCaptura || '').toUpperCase(),
    });
    setModalError('');
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing && !can('ingresos.edit')) return;
    if (!editing && !can('ingresos.create')) return;
    if (!form.numeroJuicio.trim()) {
      setModalError('El número de juicio es obligatorio.');
      return;
    }

    setSaving(true);
    setModalError('');
    try {
      const res = editing
        ? await window.api.updateIngresoExpediente(editing.id, { ...form, personaCaptura: form.personaCaptura.toUpperCase() })
        : await window.api.createIngresoExpediente({ ...form, personaCaptura: form.personaCaptura.toUpperCase() });
      if (res?.ok === false) throw new Error(res.error || 'No se pudo guardar el registro.');
      setShowModal(false);
      await loadRows();
      toastSuccess('Operación exitosa', 'El ingreso de expediente se guardó correctamente.');
    } catch (err: any) {
      setModalError(err.message || 'Error al guardar el registro.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting || !can('ingresos.delete')) return;
    setSaving(true);
    try {
      const res = await window.api.deleteIngresoExpediente(deleting.id);
      if (res?.ok === false) throw new Error(res.error || 'No se pudo borrar el registro.');
      setDeleting(null);
      await loadRows();
      toastSuccess('Registro eliminado', 'El ingreso de expediente se borró correctamente.');
    } catch (err: any) {
      toastError('Error', err.message || 'No se pudo borrar el registro.');
    } finally {
      setSaving(false);
    }
  }

  async function handleExportExcel() {
    try {
      const XLSX = await import('xlsx');
      const data = activeTab === 'comparacion'
        ? filteredIssues.map((issue: any) => ({
            TIPO: ISSUE_LABELS[issue.type] || issue.type,
            'NÚMERO DE JUICIO': issue.numeroJuicio || '',
            DETALLE: issue.detail || '',
            'INGRESO INTERNO': issue.ingreso
              ? `${formatDate(issue.ingreso.fechaEjecutoriaJuzgado || issue.ingreso.fechaEjecutoriaColegiado || issue.ingreso.fechaEjecutoriaInconformidad)} / ${issue.ingreso.personaCaptura || 'Sin persona'}`
              : '',
            SISE: issue.sise
              ? `${formatDate(issue.sise.fechaEjecutoria || issue.sise.fechaEjecutoriaColegiado || issue.sise.fechaEjecutoriaInconformidad)} / ${issue.sise.numeroJuicio || ''}`
              : '',
          }))
        : filteredRows.map((row) => ({
            'FECHA DE INGRESO': formatDate(row.fechaIngreso),
            'NÚMERO DE JUICIO': row.numeroJuicio || '',
            SENTENCIA: formatDate(row.sentencia),
            'FECHA EJECUTORIA JUZGADO': formatDate(row.fechaEjecutoriaJuzgado),
            'FECHA EJECUTORIA COLEGIADO': formatDate(row.fechaEjecutoriaColegiado),
            'FECHA EJECUTORIA INCONFORMIDAD': formatDate(row.fechaEjecutoriaInconformidad),
            'PERSONA CAPTURA': row.personaCaptura || '',
          }));

      if (data.length === 0) {
        toastWarning('Sin registros', 'No hay datos para exportar.');
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, activeTab === 'comparacion' ? 'COMPARACION_SISE' : 'INGRESOS');
      const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      XLSX.writeFile(workbook, `${activeTab === 'comparacion' ? 'COMPARACION_SISE' : 'INGRESOS_EXPEDIENTES'}_${dateStamp}.xlsx`);
    } catch (err: any) {
      toastError('Error al exportar', err.message || 'No se pudo exportar el archivo Excel.');
    }
  }

  async function handleImport(file: File | null) {
    if (!file || !can('ingresos.import')) return;
    setImporting(true);
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: '' });
      const mapped = rawRows.map((row) => {
        const byHeader = new Map(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]));
        return {
          fechaIngreso: excelDateToIso(byHeader.get('fechadeingreso') || byHeader.get('fechaingreso'), XLSX),
          numeroJuicio: String(byHeader.get('numerodejuicio') || byHeader.get('numerojuicio') || byHeader.get('expediente') || '').trim(),
          sentencia: excelDateToIso(byHeader.get('sentencia'), XLSX),
          fechaEjecutoriaJuzgado: excelDateToIso(byHeader.get('fechaejecutoriajuzgado'), XLSX),
          fechaEjecutoriaColegiado: excelDateToIso(byHeader.get('fechaejecutoriacolegiado'), XLSX),
          fechaEjecutoriaInconformidad: excelDateToIso(byHeader.get('fechaejecutoriainconformidad'), XLSX),
          personaCaptura: String(byHeader.get('personacaptura') || '').trim(),
        };
      });

      const res = await window.api.importIngresosExpedientes(mapped);
      if (res?.ok === false) throw new Error(res.error || 'No se pudo importar el archivo.');
      await loadRows();
      toastSuccess('Importación completada', `Se importaron ${res.imported || 0} registro(s).`);
      if (res.errors?.length) {
        toastWarning('Importación con avisos', `${res.errors.length} fila(s) no se importaron.`);
      }
    } catch (err: any) {
      toastError('Error al importar', err.message || 'No se pudo importar el archivo Excel.');
    } finally {
      setImporting(false);
    }
  }

  async function runComparison() {
    if (!can('ingresos.compare')) return;
    setCompareLoading(true);
    try {
      const res = await window.api.compareIngresosExpedientes();
      setComparison(res);
      setActiveTab('comparacion');
    } catch (err: any) {
      toastError('Error', err.message || 'No se pudo comparar contra SISE.');
    } finally {
      setCompareLoading(false);
    }
  }

  const issues = comparison?.issues || [];
  const filteredIssues = useMemo(() => {
    const q = search.trim().toLowerCase();
    const searched = !q ? issues : issues.filter((issue: any) =>
      [
        ISSUE_LABELS[issue.type] || issue.type,
        issue.numeroJuicio,
        issue.detail,
        issue.ingreso?.personaCaptura,
        issue.ingreso?.fechaEjecutoriaJuzgado,
        issue.ingreso?.fechaEjecutoriaColegiado,
        issue.ingreso?.fechaEjecutoriaInconformidad,
        issue.sise?.numeroJuicio,
        issue.sise?.fechaEjecutoria,
        issue.sise?.fechaEjecutoriaColegiado,
        issue.sise?.fechaEjecutoriaInconformidad,
      ].some((value) => String(value || '').toLowerCase().includes(q)),
    );
    const byColumns = searched.filter((issue: any) =>
      Object.entries(comparacionFilters).every(([key, selected]) => {
        if (!selected.length) return true;
        return selected.includes(getIssueValue(issue, key));
      }),
    );
    const sorted = [...byColumns];
    if (comparacionSort) {
      sorted.sort((a: any, b: any) =>
        compareValues(getIssueValue(a, comparacionSort.key), getIssueValue(b, comparacionSort.key), 'text', comparacionSort.direction),
      );
    }
    return sorted;
  }, [issues, search, comparacionFilters, comparacionSort]);
  const visibleCount = activeTab === 'comparacion' ? filteredIssues.length : filteredRows.length;
  const totalCount = activeTab === 'comparacion' ? issues.length : rows.length;
  const countLabel = activeTab === 'comparacion' ? 'INCIDENCIA(S)' : 'EXPEDIENTE(S)';
  const activeFilters = activeTab === 'comparacion' ? comparacionFilters : registroFilters;
  const activeColumns = activeTab === 'comparacion' ? COMPARACION_COLUMNS : REGISTRO_COLUMNS;
  const activeSort = activeTab === 'comparacion' ? comparacionSort : registroSort;
  const hasColumnFilters = Object.values(activeFilters).some((values) => values.length > 0);
  const hasAnyFilter = Boolean(search.trim()) || hasColumnFilters;

  function clearActiveFilters() {
    setSearch('');
    setOpenHeaderMenu(null);
    setTableFilterSearch('');
    setDraftTableFilterValues([]);
    setExpandedDateFilterNodes({});
    if (activeTab === 'comparacion') {
      setComparacionFilters({});
    } else {
      setRegistroFilters({});
    }
  }

  function openSortModal() {
    const firstColumn = activeColumns[0];
    setDraftSortKey(activeSort?.key || firstColumn.key);
    setDraftSortDirection(activeSort?.direction || 'ASC');
    setDraftSortEnabled(Boolean(activeSort));
    setShowModalOrdenar(true);
  }

  function applySortModal() {
    if (!draftSortEnabled) {
      if (activeTab === 'comparacion') {
        setComparacionSort(null);
        saveIngresoSortRule(INGRESOS_COMPARACION_SORT_STORAGE_KEY, null, COMPARACION_COLUMNS);
      } else {
        setRegistroSort(null);
        saveIngresoSortRule(INGRESOS_REGISTRO_SORT_STORAGE_KEY, null, REGISTRO_COLUMNS);
      }
      setShowModalOrdenar(false);
      return;
    }
    const column = activeColumns.find((item) => item.key === draftSortKey) || activeColumns[0];
    const nextSort = { key: column.key, direction: draftSortDirection };
    if (activeTab === 'comparacion') {
      setComparacionSort(nextSort);
      saveIngresoSortRule(INGRESOS_COMPARACION_SORT_STORAGE_KEY, nextSort, COMPARACION_COLUMNS);
    } else {
      setRegistroSort(nextSort);
      saveIngresoSortRule(INGRESOS_REGISTRO_SORT_STORAGE_KEY, nextSort, REGISTRO_COLUMNS);
    }
    setShowModalOrdenar(false);
  }

  function getColumnOptions(column: IngresoColumn): string[] {
    const values = activeTab === 'comparacion'
      ? issues.map((issue: any) => getIssueValue(issue, column.key))
      : rows.map((row) => formatDate((row as any)[column.key]));
      
    const stringValues: string[] = values.map((value: any) => String(value || '-'));
    return Array.from(new Set(stringValues)).sort((a: string, b: string) =>
      a.localeCompare(b, 'es-MX', { numeric: true, sensitivity: 'base' }),
    );
  }

  function setColumnFilter(columnKey: string, values: string[]) {
    if (activeTab === 'comparacion') {
      setComparacionFilters((current) => ({ ...current, [columnKey]: values }));
    } else {
      setRegistroFilters((current) => ({ ...current, [columnKey]: values }));
    }
  }

  function setColumnSort(column: IngresoColumn, direction: SortDirection) {
    if (activeTab === 'comparacion') {
      const nextSort = comparacionSort?.key === column.key && comparacionSort?.direction === direction
        ? null
        : { key: column.key, direction };
      setComparacionSort(nextSort);
      saveIngresoSortRule(INGRESOS_COMPARACION_SORT_STORAGE_KEY, nextSort, COMPARACION_COLUMNS);
    } else {
      const nextSort = registroSort?.key === column.key && registroSort?.direction === direction
        ? null
        : { key: column.key, direction };
      setRegistroSort(nextSort);
      saveIngresoSortRule(INGRESOS_REGISTRO_SORT_STORAGE_KEY, nextSort, REGISTRO_COLUMNS);
    }
    setOpenHeaderMenu(null);
  }

  const [tableFilterSearch, setTableFilterSearch] = useState('');
  const [draftTableFilterValues, setDraftTableFilterValues] = useState<string[]>([]);
  const [expandedDateFilterNodes, setExpandedDateFilterNodes] = useState<Record<string, boolean>>({});
  const [openSortDropdown, setOpenSortDropdown] = useState<string | null>(null);
  const [sortDropdownCoords, setSortDropdownCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  function openExcelFilter(key: string) {
    const menuKey = `${activeTab}:${key}`;
    if (openHeaderMenu === menuKey) {
      setOpenHeaderMenu(null);
    } else {
      const activeFilters = activeTab === 'comparacion' ? comparacionFilters : registroFilters;
      const columns = activeTab === 'comparacion' ? COMPARACION_COLUMNS : REGISTRO_COLUMNS;
      const column = columns.find(c => c.key === key);
      const allOpts = column ? getColumnOptions(column) : [];
      setDraftTableFilterValues(activeFilters[key] || allOpts);
      setTableFilterSearch('');
      setOpenHeaderMenu(menuKey);
    }
  }

  function applyExcelColumnFilter(key: string) {
    const columns = activeTab === 'comparacion' ? COMPARACION_COLUMNS : REGISTRO_COLUMNS;
    const column = columns.find(c => c.key === key);
    const allOpts = column ? getColumnOptions(column) : [];
    
    if (draftTableFilterValues.length === allOpts.length || draftTableFilterValues.length === 0) {
      setColumnFilter(key, []);
    } else {
      setColumnFilter(key, draftTableFilterValues);
    }
    setOpenHeaderMenu(null);
  }

  function renderHeader(column: IngresoColumn, className = 'px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap') {
    const menuKey = `${activeTab}:${column.key}`;
    const selected = activeFilters[column.key] || [];
    const isFiltered = selected.length > 0;
    const activeSort = activeTab === 'comparacion' ? comparacionSort : registroSort;
    const isOpen = openHeaderMenu === menuKey;
    const allOptions = isOpen ? getColumnOptions(column) : [];
    const search = tableFilterSearch.toLowerCase();
    
    const visibleOptionsTs = allOptions.filter((option) => {
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

    const allVisibleSelected = visibleOptionsTs.length > 0 && visibleOptionsTs.every(o => draftTableFilterValues.includes(o));
    const dateTree = column.type === 'date' ? buildDateFilterTree(visibleOptionsTs) : [];

    const renderDateFilterTreeNode = (node: DateFilterTreeNode, depth = 0) => {
      const hasChildren = Boolean(node.children?.length);
      const expanded = expandedDateFilterNodes[node.id] ?? false;
      const selectedCount = node.values.filter((value) => draftTableFilterValues.includes(value)).length;
      const checked = node.values.length > 0 && selectedCount === node.values.length;
      const indeterminate = selectedCount > 0 && selectedCount < node.values.length;

      return (
        <div key={node.id} style={{ position: 'relative' }}>
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
              marginBottom: 1,
            }}
            className="hover:bg-slate-50"
          >
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedDateFilterNodes((prev) => ({ ...prev, [node.id]: !expanded }));
                }}
                style={{
                  width: 11,
                  height: 11,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #999',
                  backgroundColor: '#fff',
                  fontSize: 9,
                  marginRight: 4,
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                {expanded ? '-' : '+'}
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
            <div style={{ paddingLeft: 10, position: 'relative' }}>
              {node.children?.map((child) => renderDateFilterTreeNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    };

    return (
      <th key={column.key} className={`${className} relative group pr-8`} title={column.label}>
        <span className="block whitespace-nowrap truncate leading-tight uppercase">{column.label}</span>
        <button
          onClick={(e) => { e.stopPropagation(); openExcelFilter(column.key); }}
          className={`absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 rounded flex items-center justify-center transition-colors border ${isFiltered || activeSort?.key === column.key ? 'bg-white border-blue-600 text-blue-700' : 'bg-transparent border-transparent text-blue-200 hover:bg-blue-800 hover:text-white'}`}
          title={`Filtrar ${column.label}`}
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        {isOpen && (
          <div
            className="absolute z-[80] top-full left-0 mt-1 w-[340px] bg-white text-slate-900 border border-slate-200 rounded-xl shadow-2xl normal-case text-left ring-1 ring-black/5 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 tracking-wide uppercase truncate">{column.label}</p>
            </div>

            <div className="p-3 space-y-1">
              {(['ASC', 'DESC'] as SortDirection[]).map((direction) => (
                <button
                  key={direction}
                  type="button"
                  className={`w-full flex items-center gap-2 text-left px-2.5 py-2 text-xs font-semibold rounded-md transition-colors ${
                    activeSort?.key === column.key && activeSort.direction === direction
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                  onClick={() => {
                    setColumnSort(column, direction);
                  }}
                >
                  <ArrowUpDown className={`w-3.5 h-3.5 ${activeSort?.key === column.key && activeSort.direction === direction ? 'text-blue-700' : 'text-slate-500'}`} />
                  <span className="truncate">{getFilterMenuSortLabel(column.type as any, direction)}</span>
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
                  {draftTableFilterValues.length} DE {allOptions.length} SELECCIONADOS
                </span>
                {tableFilterSearch && (
                  <button
                    onClick={() => setTableFilterSearch('')}
                    className="text-[10px] font-semibold text-blue-600 hover:text-blue-700"
                  >
                    LIMPIAR
                  </button>
                )}
              </div>

              <div className="max-h-60 overflow-y-auto p-1.5 text-xs">
              {column.type !== 'date' && (
                <label className="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-blue-50 text-[10px] font-semibold text-slate-800 cursor-pointer">
                  <TriStateCheckbox
                    checked={allVisibleSelected}
                    indeterminate={
                      visibleOptionsTs.some((option) => draftTableFilterValues.includes(option)) && !allVisibleSelected
                    }
                    onChange={(checked) => {
                      setDraftTableFilterValues((current) => {
                        const withoutVisible = current.filter((value) => !visibleOptionsTs.includes(value));
                        return checked ? [...withoutVisible, ...visibleOptionsTs] : withoutVisible;
                      });
                    }}
                  />
                  (Seleccionar todo)
                </label>
              )}

              {visibleOptionsTs.length === 0 ? (
                <div className="px-3 py-6 text-center text-[11px] text-slate-400">
                  No hay coincidencias
                </div>
              ) : column.type === 'date' ? (
                <div style={{ userSelect: 'none', fontSize: 12 }}>
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
                        visibleOptionsTs.some((option) => draftTableFilterValues.includes(option)) && !allVisibleSelected
                      }
                      onChange={(checked) => {
                        setDraftTableFilterValues((current) => {
                          const withoutVisible = current.filter((value) => !visibleOptionsTs.includes(value));
                          return checked ? [...withoutVisible, ...visibleOptionsTs] : withoutVisible;
                        });
                      }}
                    />
                    <span style={{ marginLeft: 4, fontSize: 11, fontWeight: 600, color: '#1e293b' }}>(Seleccionar todo)</span>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      position: 'absolute',
                      left: 10,
                      top: 0,
                      bottom: 11,
                      width: 1,
                      borderLeft: '1px dotted #999',
                    }} />
                    {dateTree.map((node) => (
                      <div key={node.id} style={{ position: 'relative' }}>
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
                visibleOptionsTs.map((option) => {
                  const checked = draftTableFilterValues.includes(option);
                  return (
                    <label
                      key={option}
                      className={`flex items-center gap-2 py-1 px-2 rounded-md cursor-pointer transition-colors text-[10px] ${checked ? 'bg-blue-50 text-slate-900' : 'hover:bg-slate-50 text-slate-700'}`}
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
                        className="w-3.5 h-3.5 accent-blue-600 flex-shrink-0"
                      />
                      <span className="truncate font-medium">{option}</span>
                    </label>
                  );
                })
              )}
              </div>
              <div className="p-2 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
               <button type="button" onClick={() => setOpenHeaderMenu(null)} className="px-3 py-1.5 rounded border border-slate-300 hover:bg-white font-semibold text-xs text-slate-700">Cancelar</button>
               <button type="button" onClick={() => applyExcelColumnFilter(column.key)} className="px-3 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-800 font-semibold shadow-sm text-xs">ACEPTAR</button>
              </div>
            </div>
          </div>
          </div>
        )}
      </th>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col gap-4">
      <div className="flex items-center border-b border-slate-200 flex-shrink-0">
          <button
            onClick={() => setActiveTab('registros')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-colors ${activeTab === 'registros' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Registros
          </button>
          <button
            onClick={() => setActiveTab('comparacion')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-colors ${activeTab === 'comparacion' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
          >
            <GitCompare className="w-4 h-4" />
            Comparación SISE
          </button>
        </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden flex-shrink-0">
        <div className="flex flex-col gap-2 p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar expediente, persona o fecha..."
                  className="w-full sm:w-80 rounded-lg border border-border bg-input-background pl-8 pr-3 py-1.5 text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {hasAnyFilter && (
                <button
                  onClick={clearActiveFilters}
                  className="h-8 flex items-center gap-1.5 px-3 py-0 border border-rose-200 bg-rose-50 text-rose-700 rounded-lg text-[11px] font-bold hover:bg-rose-100 hover:border-rose-300 transition-all duration-200 shadow-sm"
                >
                  <X className="w-3.5 h-3.5" />
                  LIMPIAR FILTROS
                </button>
              )}
            </div>
            <p className="text-[9px] text-slate-400 leading-none">
              TOTAL REGISTROS: {visibleCount} DE {totalCount} {countLabel}
              {hasAnyFilter && <span className="ml-1 text-blue-600 font-semibold">FILTRADO</span>}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-emerald-700"
          >
            <Download className="w-4 h-4" />
            EXPORTAR EXCEL
          </button>
          {can('ingresos.import') && (
            <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-teal-700 bg-teal-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-teal-700">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleImport(e.target.files?.[0] || null)}
                className="hidden"
              />
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              IMPORTAR EXCEL
            </label>
          )}
          {can('ingresos.compare') && (
            <button
              onClick={runComparison}
              disabled={compareLoading}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
              style={{
                backgroundColor: '#4338ca',
                border: '1px solid #3730a3',
                boxShadow: '0 2px 6px rgba(67, 56, 202, 0.24)',
              }}
            >
              {compareLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
              COMPARAR
            </button>
          )}
          <button
            onClick={openSortModal}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-900"
          >
            <ArrowUpDown className="w-4 h-4" />
            ORDENAR
          </button>
          {can('ingresos.create') && (
            <button
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" />
              NUEVO
            </button>
          )}
          <button
            onClick={handleReload}
            disabled={loading || compareLoading}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            title="Recargar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading || compareLoading ? 'animate-spin' : ''}`} />
          </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col gap-4">
      {activeTab === 'registros' ? (
        loading ? (
          <div className="h-full min-h-[520px] bg-card rounded-xl border border-border flex items-center justify-center">
            <Loader2 className="h-14 w-14 animate-spin text-[#0066cc]" strokeWidth={3.25} />
          </div>
        ) : (
        <div className="flex-1 min-h-0 bg-card rounded-xl border border-border overflow-auto">
          <table className="w-full min-w-max text-xs border-collapse">
            <thead className="sticky top-0 z-20 bg-[#1e40af] text-white">
              <tr>
                {REGISTRO_COLUMNS.map((column) => renderHeader(column))}
                {(can('ingresos.edit') || can('ingresos.delete')) && (
                  <th className="px-4 py-3 text-center text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    No se encontraron ingresos de expedientes.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, index) => (
                  <tr key={row.id} className={`${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'} hover:bg-blue-50/60`}>
                    <td className="px-4 py-3 whitespace-nowrap font-semibold">{formatDate(row.fechaIngreso)}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-900">{row.numeroJuicio || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.sentencia)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.fechaEjecutoriaJuzgado)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.fechaEjecutoriaColegiado)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.fechaEjecutoriaInconformidad)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{row.personaCaptura ? row.personaCaptura.toUpperCase() : '-'}</td>
                    {(can('ingresos.edit') || can('ingresos.delete')) && (
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {can('ingresos.edit') && (
                            <button onClick={() => openEdit(row)} className="p-1.5 rounded text-primary hover:bg-primary/10" title="Editar">
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {can('ingresos.delete') && (
                            <button onClick={() => setDeleting(row)} className="p-1.5 rounded text-destructive hover:bg-destructive/10" title="Borrar">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        )
      ) : (
        <div className="flex-1 min-h-0 flex flex-col gap-4">
          <div className="bg-card rounded-xl border border-border p-4 flex-shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-white p-3">
              <p className="text-[9px] font-bold uppercase text-slate-500">Ingresos internos</p>
              <p className="text-2xl font-black text-slate-900">{comparison?.totals?.ingresos ?? rows.length}</p>
            </div>
            <div className="rounded-xl border border-border bg-white p-3">
              <p className="text-[9px] font-bold uppercase text-slate-500">Registros SISE</p>
              <p className="text-2xl font-black text-slate-900">{comparison?.totals?.sise ?? '-'}</p>
            </div>
            <div className="rounded-xl border border-border bg-white p-3">
              <p className="text-[9px] font-bold uppercase text-slate-500">Incidencias</p>
              <p className="text-2xl font-black text-red-700">{comparison?.totals?.incidencias ?? '-'}</p>
            </div>
          </div>
          </div>
          <div className="flex-1 min-h-0 bg-card rounded-xl border border-border overflow-auto">
          <table className="w-full min-w-max text-xs border-collapse">
            <thead className="sticky top-0 z-20 bg-[#1e40af] text-white">
              <tr>
                {COMPARACION_COLUMNS.map((column) => renderHeader(column))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {compareLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    <Loader2 className="mx-auto mb-3 h-14 w-14 animate-spin text-[#0066cc]" strokeWidth={3.25} />
                    Comparando ingresos contra SISE...
                  </td>
                </tr>
              ) : !comparison ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    <FileSpreadsheet className="mx-auto mb-2 h-6 w-6" />
                    Ejecuta la comparación para detectar omisiones y diferencias contra SISE.
                  </td>
                </tr>
              ) : filteredIssues.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-emerald-700 font-bold">
                    <CheckCircle className="mx-auto mb-2 h-6 w-6" />
                    No se detectaron incidencias.
                  </td>
                </tr>
              ) : (
                filteredIssues.map((issue: any, index: number) => (
                  <tr key={`${issue.type}-${issue.numeroJuicio}-${index}`} className={`${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'} hover:bg-blue-50/60`}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold ${issue.severity === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {ISSUE_LABELS[issue.type] || issue.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-bold">{issue.numeroJuicio || '-'}</td>
                    <td className="px-4 py-3 min-w-[280px] max-w-[520px] whitespace-normal">{issue.detail}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {issue.ingreso ? `${formatDate(issue.ingreso.fechaEjecutoriaJuzgado || issue.ingreso.fechaEjecutoriaColegiado || issue.ingreso.fechaEjecutoriaInconformidad)} / ${issue.ingreso.personaCaptura || 'Sin persona'}` : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {issue.sise ? `${formatDate(issue.sise.fechaEjecutoria || issue.sise.fechaEjecutoriaColegiado || issue.sise.fechaEjecutoriaInconformidad)} / ${issue.sise.numeroJuicio || '-'}` : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}
      </div>

      {showModalOrdenar && createPortal(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[99999] flex items-center justify-center p-4" onClick={() => setOpenSortDropdown(null)}>
          <div
            onClick={(e) => { e.stopPropagation(); setOpenSortDropdown(null); }}
            className="bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200"
            style={{ width: '100%', maxWidth: 600 }}
          >
            <div className="flex items-center justify-between px-5 py-4 bg-[#1e40af] text-white rounded-t-xl shrink-0">
              <h3 className="text-sm font-bold tracking-wide uppercase flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-blue-200" />
                Ordenamiento
              </h3>
              <button type="button" onClick={() => setShowModalOrdenar(false)} className="p-1 hover:bg-white/15 rounded-md transition-colors" title="Cerrar">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-5 bg-slate-50 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Criterios de ordenamiento ({draftSortEnabled ? 1 : 0})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setDraftSortEnabled(false);
                      setOpenSortDropdown(null);
                    }}
                    disabled={!draftSortEnabled}
                    className="h-8 px-3 flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Eliminar
                  </button>
                  <button
                    onClick={() => {
                      setDraftSortEnabled(true);
                      if (!draftSortKey) setDraftSortKey(activeColumns[0]?.key || '');
                    }}
                    className="h-8 px-3 flex items-center justify-center gap-1.5 rounded-lg bg-[#1e40af] text-white text-xs font-semibold hover:bg-blue-800 transition-colors shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar
                  </button>
                </div>
              </div>

                {draftSortEnabled ? (
                <div className="space-y-1.5">
                  <div className="rounded-md border border-[#1e40af] bg-blue-50 shadow-sm p-1.5 transition-colors" onScroll={() => setOpenSortDropdown(null)}>
                    <div className="flex items-center mb-1">
                      <span className="text-[8px] font-bold text-[#1e40af] uppercase tracking-wider bg-blue-100/50 px-1 py-0.5 rounded">
                      Ordenar por
                    </span>
                  </div>
                    <div className="grid grid-cols-2 gap-1.5 items-end">
                    <div className="relative">
                      <p className="text-[8px] font-bold text-slate-500 mb-0.5 uppercase tracking-wide">Columna</p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setSortDropdownCoords({
                            top: rect.bottom + window.scrollY,
                            left: rect.left + window.scrollX,
                            width: rect.width
                          });
                          setOpenSortDropdown(openSortDropdown === 'col' ? null : 'col');
                        }}
                        className="h-7 w-full pl-2 pr-6 border border-slate-200 rounded text-[10px] font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-[#1e40af]/30 focus:border-[#1e40af] flex items-center justify-between text-left relative transition-all bg-white"
                      >
                        <span className="truncate">{activeColumns.find(c => c.key === draftSortKey)?.label || ''}</span>
                        <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </button>
                      {openSortDropdown === 'col' && sortDropdownCoords && createPortal(
                        <div
                          style={{
                            position: 'absolute',
                            top: `${sortDropdownCoords.top + 2}px`,
                            left: `${sortDropdownCoords.left}px`,
                            width: `${sortDropdownCoords.width}px`,
                            zIndex: 999999
                          }}
                          className="bg-white border border-slate-200 rounded-md shadow-xl max-h-48 overflow-y-auto py-1 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {activeColumns.map((option) => (
                            <div
                              key={option.key}
                              className={`px-2 py-1 text-[10px] cursor-pointer transition-colors ${draftSortKey === option.key ? 'bg-blue-50 text-[#1e40af] font-bold' : 'text-slate-700 hover:bg-slate-50 font-medium'}`}
                              onClick={() => {
                                setDraftSortKey(option.key);
                                setOpenSortDropdown(null);
                              }}
                            >
                              {option.label}
                            </div>
                          ))}
                        </div>,
                        document.body
                      )}
                    </div>
                    <div className="relative">
                      <p className="text-[8px] font-bold text-slate-500 mb-0.5 uppercase tracking-wide">Orden</p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setSortDropdownCoords({
                            top: rect.bottom + window.scrollY,
                            left: rect.left + window.scrollX,
                            width: rect.width
                          });
                          setOpenSortDropdown(openSortDropdown === 'order' ? null : 'order');
                        }}
                        className="h-7 w-full pl-2 pr-6 border border-slate-200 rounded text-[10px] font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-[#1e40af]/30 focus:border-[#1e40af] flex items-center justify-between text-left relative transition-all bg-white"
                      >
                        <span className="truncate">{draftSortDirection === 'ASC' ? 'A a Z / menor a mayor' : 'Z a A / mayor a menor'}</span>
                        <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </button>
                      {openSortDropdown === 'order' && sortDropdownCoords && createPortal(
                        <div
                          style={{
                            position: 'absolute',
                            top: `${sortDropdownCoords.top + 2}px`,
                            left: `${sortDropdownCoords.left}px`,
                            width: `${sortDropdownCoords.width}px`,
                            zIndex: 999999
                          }}
                          className="bg-white border border-slate-200 rounded-md shadow-xl py-1 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            className={`px-2 py-1 text-[10px] cursor-pointer transition-colors ${draftSortDirection === 'ASC' ? 'bg-blue-50 text-[#1e40af] font-bold' : 'text-slate-700 hover:bg-slate-50 font-medium'}`}
                            onClick={() => {
                              setDraftSortDirection('ASC');
                              setOpenSortDropdown(null);
                            }}
                          >
                            A a Z / menor a mayor
                          </div>
                          <div
                            className={`px-2 py-1 text-[10px] cursor-pointer transition-colors ${draftSortDirection === 'DESC' ? 'bg-blue-50 text-[#1e40af] font-bold' : 'text-slate-700 hover:bg-slate-50 font-medium'}`}
                            onClick={() => {
                              setDraftSortDirection('DESC');
                              setOpenSortDropdown(null);
                            }}
                          >
                            Z a A / mayor a menor
                          </div>
                        </div>,
                        document.body
                      )}
                  </div>
                </div>
              </div>
                </div>
                ) : (
                  <div className="h-32 rounded-xl border-2 border-dashed border-slate-200 bg-white flex flex-col items-center justify-center gap-2 px-3 text-center transition-colors">
                    <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                      <ArrowUpDown className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700">Sin ordenamiento configurado</p>
                      <p className="text-[11px] text-slate-500 mt-1">Haz clic en Agregar para definir un criterio.</p>
                    </div>
                  </div>
                )}
            </div>
          </div>
          <div className="px-6 py-4 border-t border-slate-100 bg-white rounded-b-xl shrink-0">
              <button type="button" onClick={applySortModal} className="w-full px-4 py-2.5 bg-[#1e40af] text-white rounded-lg text-sm font-semibold hover:bg-blue-800 transition-colors shadow-sm">
                Aplicar Orden
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {showModal && createPortal(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[99999] flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden rounded-xl bg-white shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-5 py-4 bg-[#1e40af] text-white rounded-t-xl shrink-0">
              <h3 className="text-sm font-bold tracking-wide uppercase flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-200" />
                {editing ? 'EDITAR INGRESO DE EXPEDIENTE' : 'NUEVO INGRESO DE EXPEDIENTE'}
              </h3>
              <button type="button" onClick={() => setShowModal(false)} className="p-1 hover:bg-white/15 rounded-md transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 bg-white">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {modalError && (
                <div className="md:col-span-2 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {modalError}
                </div>
              )}
              <FormInput label="Fecha de ingreso" type="date" value={form.fechaIngreso} onChange={(value) => setForm((current) => ({ ...current, fechaIngreso: value }))} />
              <FormInput label="Número de juicio" value={form.numeroJuicio} onChange={(value) => setForm((current) => ({ ...current, numeroJuicio: value }))} required />
              <FormInput label="Sentencia" type="date" value={form.sentencia} onChange={(value) => setForm((current) => ({ ...current, sentencia: value }))} />
              <FormInput label="Fecha ejecutoria juzgado" type="date" value={form.fechaEjecutoriaJuzgado} onChange={(value) => setForm((current) => ({ ...current, fechaEjecutoriaJuzgado: value }))} />
              <FormInput label="Fecha ejecutoria colegiado" type="date" value={form.fechaEjecutoriaColegiado} onChange={(value) => setForm((current) => ({ ...current, fechaEjecutoriaColegiado: value }))} />
              <FormInput label="Fecha ejecutoria inconformidad" type="date" value={form.fechaEjecutoriaInconformidad} onChange={(value) => setForm((current) => ({ ...current, fechaEjecutoriaInconformidad: value }))} />
                <div className="md:col-span-2">
                  <FormInput label="Persona captura" value={form.personaCaptura} onChange={(value) => setForm((current) => ({ ...current, personaCaptura: value }))} disabled />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-white rounded-b-xl shrink-0">
              <button type="submit" disabled={saving} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#1e40af] text-white rounded-lg text-sm font-semibold hover:bg-blue-800 transition-colors disabled:opacity-50 shadow-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editing ? 'Guardar Cambios' : 'Guardar Ingreso'}
              </button>
            </div>
          </form>
        </div>,
        document.body,
      )}

      {deleting && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in duration-200"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-6 py-8 text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">
                ¿Eliminar {deleting.numeroJuicio}?
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 bg-slate-50 p-4">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                disabled={saving}
                className="h-12 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="flex h-12 items-center justify-center gap-2 rounded-lg bg-red-600 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function FormInput({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        className="w-full h-11 px-4 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af] transition-all shadow-sm disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
        style={disabled ? { textTransform: 'uppercase' } : undefined}
      />
    </label>
  );
}

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { SortDirection, DateFilterTreeNode, MONTH_NAMES, TriStateCheckbox, parseSortDate, parseDateFilterOption, buildDateFilterTree, getFilterMenuSortLabel } from './FilterUtils';
import {
  ClipboardList,
  History,
  Loader2,
  AlertCircle,
  Search,
  Check,
  CheckCircle2,
  Edit,
  Save,
  X,
  RefreshCw,
  FolderOpen,
  ChevronDown,
  ArrowUpDown,
  Plus,
  Trash2,
  FileEdit
} from 'lucide-react';
import { showStyledAlert } from '../utils/alert';
import { toastSuccess, toastError, toastWarning } from '../utils/toast';

interface TrabajoDiarioProps {
  permissions: string[];
  isAdmin: boolean;
  session: any;
}

interface MesaRecord {
  ID_MESA: number;
  MESA: string;
  NOMBRE: string;
  ACTIVO: number;
}

interface TrabajoHistoryRecord {
  id: number;
  expedienteRowid: number;
  expediente: string;
  idMesa: number;
  mesaNombre: string;
  personaMesa: string;
  usuarioId: number;
  usuarioNombre: string;
  rol: string;
  estatusAtendido: string;
  fechaAcuerdo: string;
  observaciones: string;
  fechaCaptura: string;
  fechaEnvioHistorial: string;
}

type EstatusBand = 'EMPTY' | 'GREEN' | 'YELLOW' | 'PINK' | 'RED';
type TrabajoSortColumnType = 'number' | 'text' | 'date' | 'estatus';
type TrabajoSortLevel = {
  id: string;
  column: string;
  direction: SortDirection;
};

const TRABAJO_SORT_COLUMNS: Array<{ key: string; label: string; type: TrabajoSortColumnType }> = [
  { key: 'numeroOrden', label: 'NO. ORDEN', type: 'number' },
  { key: 'juicio', label: 'JUICIO / EXPEDIENTE', type: 'text' },
  { key: 'mesa', label: 'MESA', type: 'text' },
  { key: 'persona', label: 'PERSONA', type: 'text' },
  { key: 'ultimoRequerimiento', label: 'ULTIMO REQUERIMIENTO', type: 'date' },
  { key: 'diasNaturales', label: 'DIAS NATURALES', type: 'number' },
  { key: 'diasHabiles', label: 'DIAS HABILES', type: 'number' },
  { key: 'estatusCumplimiento', label: 'ESTATUS', type: 'estatus' },
  { key: 'fechaVistaCumpli', label: 'FEC. VISTA CUMPLIMIENTO', type: 'date' },
  { key: 'fechaVista', label: 'FEC. VISTA (RECIBE JZDO)', type: 'date' },
  { key: 'fechaAcuerdo', label: 'FECHA ACUERDO', type: 'date' },
  { key: 'estatus', label: 'ESTATUS ATENCION', type: 'estatus' },
  { key: 'observaciones', label: 'OBSERVACIONES TRABAJO DIARIO', type: 'text' },
  { key: 'capturadoPor', label: 'CAPTURADO POR', type: 'text' },
  { key: 'fechaCaptura', label: 'FECHA CAPTURA', type: 'date' },
];

const TRABAJO_SORT_STORAGE_KEY = 'trabajo_diario.sortLevels.v1';

function getTrabajoSortColumn(key: string) {
  return TRABAJO_SORT_COLUMNS.find((column) => column.key === key) || TRABAJO_SORT_COLUMNS[0];
}

function getTrabajoSortOrderLabel(column: ReturnType<typeof getTrabajoSortColumn>, direction: SortDirection) {
  if (column.type === 'date') {
    return direction === 'ASC'
      ? 'De mas antiguos a mas recientes'
      : 'De mas recientes a mas antiguos';
  }

  if (column.type === 'estatus') {
    return direction === 'ASC'
      ? 'Verde, amarillo, rojo claro y rojo'
      : 'Rojo, rojo claro, amarillo y verde';
  }

  if (column.type === 'text') {
    return direction === 'ASC' ? 'A a Z' : 'Z a A';
  }

  return direction === 'ASC' ? 'De menor a mayor' : 'De mayor a menor';
}

function normalizeTrabajoSortLevels(raw: unknown): TrabajoSortLevel[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .slice(0, 64)
    .filter((level): level is TrabajoSortLevel =>
      level &&
      TRABAJO_SORT_COLUMNS.some((column) => column.key === level.column) &&
      (level.direction === 'ASC' || level.direction === 'DESC')
    )
    .map((level, index) => ({
      id: typeof level.id === 'string' ? level.id : `nivel-${index + 1}`,
      column: level.column,
      direction: level.direction,
    }));
}

function loadTrabajoSortLevels(): TrabajoSortLevel[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(TRABAJO_SORT_STORAGE_KEY);
    return raw ? normalizeTrabajoSortLevels(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function saveTrabajoSortLevels(levels: TrabajoSortLevel[]) {
  if (typeof window === 'undefined') return;

  try {
    const normalizedLevels = normalizeTrabajoSortLevels(levels);
    if (normalizedLevels.length === 0) {
      window.localStorage.removeItem(TRABAJO_SORT_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(TRABAJO_SORT_STORAGE_KEY, JSON.stringify(normalizedLevels));
  } catch {
    // El ordenamiento sigue funcionando aunque el navegador bloquee almacenamiento local.
  }
}

function statusBadgeClass(status: string) {
  switch (status) {
    case 'ATENDIDA':
    case 'ATENDIDO':
      return 'border-emerald-700 bg-emerald-600 text-white';
    case 'SIN ATENDER':
      return 'border-red-700 bg-red-600 text-white';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex h-6 min-w-[96px] items-center justify-center rounded-full border px-3 text-center text-[10px] font-extrabold uppercase tracking-wide leading-none whitespace-nowrap ${statusBadgeClass(status)}`}>
      {status}
    </span>
  );
}

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

function getEstatusSortNumber(exp: any) {
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

function getEstatusSortDays(exp: any) {
  return parseSortNumber(exp.diasHabilesTranscurridos) ?? parseSortNumber(exp.estatus);
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

function oneLineCell(value: string) {
  return (
    <div className="overflow-hidden text-ellipsis whitespace-nowrap" title={value}>
      {value || '-'}
    </div>
  );
}

function normalizeIsoDate(value: unknown) {
  const text = String(value || '').trim();
  if (!text) return '';

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  }

  const mx = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (mx) {
    const year = mx[3].length === 2 ? `20${mx[3]}` : mx[3];
    return `${year}-${mx[2].padStart(2, '0')}-${mx[1].padStart(2, '0')}`;
  }

  return '';
}

function formatDateDMY(value: unknown) {
  const text = String(value || '').trim();
  if (!text || text === '-') return '-';

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return `${iso[3].padStart(2, '0')}/${iso[2].padStart(2, '0')}/${iso[1]}`;
  }

  const mx = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (mx) {
    return `${mx[1].padStart(2, '0')}/${mx[2].padStart(2, '0')}/${mx[3].length === 2 ? `20${mx[3]}` : mx[3]}`;
  }

  return text;
}

function deriveTrabajoStatus(ultimoRequerimiento: unknown, fechaAcuerdo: unknown) {
  const ultimo = normalizeIsoDate(ultimoRequerimiento);
  const acuerdo = normalizeIsoDate(fechaAcuerdo);
  return ultimo && acuerdo && ultimo === acuerdo ? 'ATENDIDA' : 'SIN ATENDER';
}

export default function TrabajoDiario({ permissions, isAdmin, session }: TrabajoDiarioProps) {
  const [activeTab, setActiveTab] = useState<'vivos' | 'historial'>('vivos');
  const [loading, setLoading] = useState(true);
  const [expedientes, setExpedientes] = useState<any[]>([]);
  const [mesas, setMesas] = useState<MesaRecord[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  // --- EXCEL HEADER FILTERS STATE ---
  const [tableColumnFilters, setTableColumnFilters] = useState<Record<string, string[]>>({});
  const [openTableFilter, setOpenTableFilter] = useState<string | null>(null);
  const [draftTableFilterValues, setDraftTableFilterValues] = useState<string[]>([]);
  const [tableFilterSearch, setTableFilterSearch] = useState('');

  const [expandedDateFilterNodes, setExpandedDateFilterNodes] = useState<Record<string, boolean>>({});
  const [sortLevels, setSortLevels] = useState<TrabajoSortLevel[]>(loadTrabajoSortLevels);
  const [draftSortLevels, setDraftSortLevels] = useState<TrabajoSortLevel[]>([]);
  const [showModalOrdenar, setShowModalOrdenar] = useState(false);
  const [selectedSortLevelId, setSelectedSortLevelId] = useState('');
  const [openSortDropdown, setOpenSortDropdown] = useState<string | null>(null);
  const [sortDropdownCoords, setSortDropdownCoords] = useState<{ top: number; left: number; width: number } | null>(null);

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

  const getTableFilterValue = useCallback((exp: any, key: string): string => {
    switch (key) {
      case 'numeroOrden': return String(exp.numeroOrden || '');
      case 'juicio': return String(exp.numeroJuicio || '');
      case 'mesa': {
        const m = mesas.find((m) => m.ID_MESA === exp.idMesa);
        return m ? m.MESA : `Mesa ${exp.idMesa}`;
      }
      case 'persona': {
        const m = mesas.find((m) => m.ID_MESA === exp.idMesa);
        return m?.NOMBRE || '';
      }
      case 'ultimoRequerimiento': return String(formatDateDMY(exp.ultimoRequerimiento) || '-');
      case 'diasNaturales': return String(exp.diasNaturalesTranscurridos || '-');
      case 'diasHabiles': return String(exp.diasHabilesTranscurridos || '-');
      case 'estatusCumplimiento': {
        const band = getEstatusBand(exp.estatus, exp.diasHabilesTranscurridos);
        return band === 'EMPTY' ? '(Vacias)' : getEstatusBandLabel(band);
      }
      case 'fechaVistaCumpli': return String(formatDateDMY(exp.fechaVistaCumpli) || '-');
      case 'fechaVista': return String(formatDateDMY(exp.fechaVista) || '-');
      case 'fechaAcuerdo': return String(formatDateDMY(exp.fechaAcuerdo) || '-');
      case 'estatus': return deriveTrabajoStatus(exp.ultimoRequerimiento, exp.fechaAcuerdo);
      case 'observaciones': return String(exp.observacionesDiario || '');
      case 'capturadoPor': return String(exp.usuarioNombre || '');
      case 'fechaCaptura': return exp.fechaCapturaDiario ? new Date(exp.fechaCapturaDiario).toLocaleString() : '-';
      default: return '';
    }
  }, [mesas]);

  const getTableFilterOptions = useCallback((key: string) => {
    const vals = expedientes.map(exp => getTableFilterValue(exp, key));
    return Array.from(new Set(vals)).filter(Boolean).sort();
  }, [expedientes, getTableFilterValue]);

  const applyExcelColumnFilter = () => {
    if (!openTableFilter) return;
    setTableColumnFilters(prev => {
      const next = { ...prev };
      const allOpts = getTableFilterOptions(openTableFilter);
      if (draftTableFilterValues.length === allOpts.length || draftTableFilterValues.length === 0) {
        delete next[openTableFilter];
      } else {
        next[openTableFilter] = draftTableFilterValues;
      }
      return next;
    });
    setOpenTableFilter(null);
    setTableFilterSearch('');
  };

  const clearExcelColumnFilters = () => {
    setTableColumnFilters({});
    setOpenTableFilter(null);
    setDraftTableFilterValues([]);
  };


  const openExcelFilter = (key: string) => {
    setOpenTableFilter(key);
    setTableFilterSearch('');
    setDraftTableFilterValues(tableColumnFilters[key] || getTableFilterOptions(key));
  };

  const filteredExpedientesExcel = expedientes.filter(exp => {
      for (const [key, selectedVals] of Object.entries(tableColumnFilters)) {
        if (selectedVals && selectedVals.length > 0) {
          if (!selectedVals.includes(getTableFilterValue(exp, key))) {
            return false;
          }
        }
      }
      return true;
  });

  
  const renderTableHeader = (key: string, label: string, type: 'date' | 'text' | 'number' | 'estatus' | 'boolean', className: string, title?: string) => {
    const isFiltered = !!tableColumnFilters[key];
    const isOpen = openTableFilter === key;
    const activeSortLevel = sortLevels.find((level) => level.column === key);
    const allOptions = isOpen ? getTableFilterOptions(key) : [];
    const search = tableFilterSearch.toLowerCase();
    
    const visibleOptionsTs = allOptions.filter((option) => {
      if (!search) return true;
      if (type !== 'date') {
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
    const dateTree = type === 'date' ? buildDateFilterTree(visibleOptionsTs) : [];

    return (
      <th key={key} className={`${className} relative group pr-8`} title={title}>
        <span className="block whitespace-nowrap truncate leading-tight">{label}</span>
        <button
          onClick={(e) => { e.stopPropagation(); openExcelFilter(key); }}
          className={`absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 rounded flex items-center justify-center transition-colors border ${isFiltered || activeSortLevel ? 'bg-white border-blue-600 text-blue-700' : 'bg-transparent border-transparent text-blue-200 hover:bg-blue-800 hover:text-white'}`}
          title={`Filtrar ${label}`}
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        {isOpen && (
          <div
            className="absolute z-50 top-full left-0 mt-1 w-[340px] bg-white text-slate-900 border border-slate-200 rounded-xl shadow-2xl normal-case text-left ring-1 ring-black/5 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 tracking-wide uppercase truncate">{label}</p>
            </div>

            <div className="p-3 space-y-1">
              {(['ASC', 'DESC'] as SortDirection[]).map((direction) => (
                <button
                  key={direction}
                  className={`w-full flex items-center gap-2 text-left px-2.5 py-2 text-xs font-semibold rounded-md transition-colors ${
                    activeSortLevel?.direction === direction
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                  onClick={() => {
                    const nextSort = activeSortLevel?.direction === direction
                      ? []
                      : [{ id: `filtro-${Date.now()}`, column: key, direction }];
                    setSortLevels(nextSort);
                    setDraftSortLevels(nextSort);
                    saveTrabajoSortLevels(nextSort);
                    setOpenTableFilter(null);
                  }}
                >
                  <ArrowUpDown className={`w-3.5 h-3.5 ${activeSortLevel?.direction === direction ? 'text-blue-700' : 'text-slate-500'}`} />
                  <span className="truncate">{getFilterMenuSortLabel(type, direction)}</span>
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
                    LIMPIAR BUSQUEDA
                  </button>
                )}
              </div>

              <div className="max-h-60 overflow-y-auto p-1.5 text-xs">
              {type !== 'date' && (
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
              ) : type === 'date' ? (
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
                    {dateTree.map((node, idx) => (
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
               <button onClick={() => setOpenTableFilter(null)} className="px-3 py-1.5 rounded border border-slate-300 hover:bg-white font-semibold text-xs text-slate-700">Cancelar</button>
               <button onClick={applyExcelColumnFilter} className="px-3 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-800 font-semibold shadow-sm text-xs">ACEPTAR</button>
              </div>
            </div>
          </div>
          </div>
        )}
      </th>
    );
  };
  // --- END EXCEL HEADER FILTERS STATE ---
  // Filters
  const [selectedMesaFilter, setSelectedMesaFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Capture modal state
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [selectedExpediente, setSelectedExpediente] = useState<any | null>(null);
  const [formFechaAcuerdo, setFormFechaAcuerdo] = useState('');
  const [formObservaciones, setFormObservaciones] = useState('');
  const [modalError, setModalError] = useState('');
  const [savingCapture, setSavingCapture] = useState(false);

  // History tab state
  const [historyList, setHistoryList] = useState<TrabajoHistoryRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyMesaFilter, setHistoryMesaFilter] = useState('');

  // Flush action state
  const [flushing, setFlushing] = useState(false);
  const [flushResult, setFlushResult] = useState<{ processed: number } | null>(null);

  // Custom Mesa Filter Dropdown
  const [openMesaDropdown, setOpenMesaDropdown] = useState(false);
  const [mesaSearchQuery, setMesaSearchQuery] = useState('');
  const [openHistoryMesaDropdown, setOpenHistoryMesaDropdown] = useState(false);
  const [historyMesaSearchQuery, setHistoryMesaSearchQuery] = useState('');

  const can = useCallback((p: string) => {
    return isAdmin || permissions.includes(p);
  }, [isAdmin, permissions]);

  const loadData = useCallback(async (opts?: { showSuccessToast?: boolean }) => {
    setLoading(true);
    try {
      // Load active mesas
      const m = await window.api.listMesas();
      setMesas(m || []);

      // Load all users to map names if needed
      const u = await window.api.listUsers();
      setUsers(u || []);

      // Load expedientes vivos
      // If user has view_all_mesas, call getExpedientesAllMesas.
      // Otherwise, if user has view_my_mesa, call getExpedientesByMesa.
      let rows: any[] = [];
      if (can('trabajo.view_all_mesas')) {
        rows = await window.api.getExpedientesAllMesas();
      } else if (can('trabajo.view_my_mesa')) {
        if (session?.user?.IdMesa) {
          rows = await window.api.getExpedientesByMesa(session.user.IdMesa);
        } else {
          rows = []; // No mesa assigned
        }
      }
      setExpedientes(rows || []);
      if (opts?.showSuccessToast) {
        toastSuccess('Datos recargados', 'La tabla de trabajo diario se actualizo correctamente.');
      }
    } catch (err: any) {
      showStyledAlert({
        title: 'Error',
        text: err.message || 'No se pudieron cargar los expedientes vivos.',
        icon: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [session, can]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await window.api.getHistorialTrabajoDiario({
        expediente: historySearchQuery,
        mesaId: historyMesaFilter ? Number(historyMesaFilter) : undefined
      });
      setHistoryList(res || []);
    } catch (err) {
      // Ignore
    } finally {
      setLoadingHistory(false);
    }
  }, [historySearchQuery, historyMesaFilter]);

  const limpiarFiltros = () => {
    setSearchQuery('');
    setSelectedMesaFilter('');
    setMesaSearchQuery('');
    setSortLevels([]);
    saveTrabajoSortLevels([]);
    clearExcelColumnFilters();
  };

  const hasAnyFilter = !!searchQuery || !!selectedMesaFilter || Object.keys(tableColumnFilters).length > 0;

  useEffect(() => {
    if (activeTab === 'vivos') {
      loadData();
    } else {
      loadHistory();
    }
  }, [activeTab, loadData, loadHistory]);

  // Open capture modal
  function openCapture(exp: any) {
    if (!can('trabajo.capture')) return;
    
    // Check if it already has captured work
    const alreadyCaptured = !!(exp.estatusAtendido || exp.fechaAcuerdo || exp.observacionesDiario);
    if (alreadyCaptured && !can('trabajo.edit_today')) {
      showStyledAlert({
        title: 'Acción no permitida',
        text: 'No tienes permisos para editar capturas de trabajo del día.',
        icon: 'warning'
      });
      return;
    }

    setSelectedExpediente(exp);
    setFormFechaAcuerdo(exp.fechaAcuerdo || '');
    setFormObservaciones(exp.observacionesDiario || '');
    setModalError('');
    setShowCaptureModal(true);
  }

  // Handle capture submission
  async function handleCaptureSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedExpediente) return;
    setSavingCapture(true);
    setModalError('');
    try {
      await window.api.captureTrabajoDiario({
        expedienteRowid: Number(selectedExpediente.id),
        fechaAcuerdo: formFechaAcuerdo,
        observaciones: formObservaciones.trim(),
        userId: session?.user?.IdUsuario,
        userName: session?.user?.NombreCompleto || session?.user?.Usuario
      });
      setShowCaptureModal(false);
      await loadData();
      toastSuccess('Trabajo Diario capturado', 'La información se guardó correctamente.');
    } catch (err: any) {
      setModalError(err.message || 'Error al guardar la captura.');
    } finally {
      setSavingCapture(false);
    }
  }

  // Run manual flush process
  async function handleManualFlush() {
    if (!can('trabajo.flush_history')) return;
    setFlushing(true);
    try {
      const res = await window.api.flushTrabajoDiarioToHistory();
      if (res.ok) {
        setFlushResult({ processed: Number(res.processed || 0) });
        await loadData();
      } else {
        toastError('Error', res.error || 'No se pudo completar el proceso.');
      }
    } catch (err: any) {
      toastError('Error', err.message || 'Error inesperado.');
    } finally {
      setFlushing(false);
    }
  }

  const openSortModal = () => {
    const savedLevels = loadTrabajoSortLevels();
    const nextLevels = savedLevels.length > 0 ? savedLevels : sortLevels;
    setDraftSortLevels(nextLevels.map((level) => ({ ...level })));
    setSelectedSortLevelId(nextLevels[0]?.id || '');
    setOpenSortDropdown(null);
    setShowModalOrdenar(true);
  };

  const updateSortLevel = (id: string, patch: Partial<TrabajoSortLevel>) => {
    setDraftSortLevels((levels) =>
      levels.map((level) => (level.id === id ? { ...level, ...patch } : level))
    );
  };

  const addSortLevel = () => {
    const nextLevel: TrabajoSortLevel = {
      id: `nivel-${Date.now()}`,
      column: 'juicio',
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

  const applySortLevels = () => {
    const nextLevels = normalizeTrabajoSortLevels(draftSortLevels);
    setSortLevels(nextLevels);
    saveTrabajoSortLevels(nextLevels);
    setShowModalOrdenar(false);
    setOpenSortDropdown(null);
  };

  // Filter vivo list in UI

  const sortedExpedientes = useMemo(() => {
    let result = [...filteredExpedientesExcel];
    for (let i = sortLevels.length - 1; i >= 0; i--) {
      const { column, direction } = sortLevels[i];
      result.sort((a, b) => {
        let valA = getTableFilterValue(a, column);
        let valB = getTableFilterValue(b, column);

        if (column === 'diasNaturales' || column === 'diasHabiles' || column === 'numeroOrden') {
          const numA = parseSortNumber(valA) ?? -Infinity;
          const numB = parseSortNumber(valB) ?? -Infinity;
          return direction === 'ASC' ? numA - numB : numB - numA;
        }

        if (column === 'estatusCumplimiento') {
          const rankA = getEstatusSortNumber(a);
          const rankB = getEstatusSortNumber(b);
          if (rankA !== rankB) {
            return direction === 'ASC' ? rankA - rankB : rankB - rankA;
          }
          const daysA = getEstatusSortDays(a) ?? Number.POSITIVE_INFINITY;
          const daysB = getEstatusSortDays(b) ?? Number.POSITIVE_INFINITY;
          return direction === 'ASC' ? daysA - daysB : daysB - daysA;
        }

        if (column === 'fechaAcuerdo' || column === 'fechaCaptura' || column === 'ultimoRequerimiento' || column === 'fechaVistaCumpli' || column === 'fechaVista') {
          const numA = parseSortDate(valA) ?? -Infinity;
          const numB = parseSortDate(valB) ?? -Infinity;
          return direction === 'ASC' ? numA - numB : numB - numA;
        }

        const strA = String(valA || '').toLowerCase();
        const strB = String(valB || '').toLowerCase();
        return direction === 'ASC' ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }
    return result;
  }, [filteredExpedientesExcel, sortLevels, getTableFilterValue]);

  const filteredExpedientes = sortedExpedientes.filter((exp: any) => {
    const matchesSearch = 
      String(exp.numeroJuicio || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(exp.numeroOrden || '').includes(searchQuery);

    const matchesMesa = 
      !can('trabajo.view_all_mesas') || 
      !selectedMesaFilter || 
      Number(exp.idMesa) === Number(selectedMesaFilter);

    return matchesSearch && matchesMesa;
  });

  const getRowColor = (exp: any) => {
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

  return (
    <div className="h-full min-h-0 flex flex-col gap-4" onClick={() => {
      setOpenMesaDropdown(false);
      setOpenHistoryMesaDropdown(false);
    }}>
      {/* Tabs */}
      <div className="flex border-b border-slate-200 flex-shrink-0">
        <button
          onClick={() => setActiveTab('vivos')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'vivos'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Captura Trabajo Diario
        </button>
        {can('trabajo.history') && (
          <button
            onClick={() => setActiveTab('historial')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'historial'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <History className="w-4 h-4" />
            Historial de Capturas
          </button>
        )}
      </div>

      {/* Tab: Vivos */}
      {activeTab === 'vivos' && (
        <div className="flex-1 min-h-0 flex flex-col gap-4">
          {/* User message if view_my_mesa but no mesa configuration */}
          {!can('trabajo.view_all_mesas') && can('trabajo.view_my_mesa') && !session?.user?.IdMesa && (
            <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 text-xs flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <div>
                <p className="font-bold">Mesa de trámite no configurada</p>
                <p className="mt-0.5">Tu cuenta de usuario no tiene asignada ninguna mesa de trámite. Pide a un Administrador que asigne una mesa a tu cuenta en la sección "Usuarios".</p>
              </div>
            </div>
          )}

          {/* Search bar & filters */}
          <div className="relative z-30 bg-card rounded-xl border border-border p-3 flex-shrink-0">
            <div className="flex items-center gap-3 justify-between flex-wrap">
              <div className="flex flex-col gap-1.5 flex-1 min-w-[300px]">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Buscar por orden, juicio/expediente..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-input-background border border-input rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  {can('trabajo.view_all_mesas') && (
                    <div
                      className="relative"
                      style={{ width: 440, minWidth: 360, maxWidth: 'calc(100vw - 620px)' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        placeholder={
                          selectedMesaFilter
                            ? (mesas.find(m => Number(m.ID_MESA) === Number(selectedMesaFilter))?.MESA || '') +
                              ' - ' +
                              (mesas.find(m => Number(m.ID_MESA) === Number(selectedMesaFilter))?.NOMBRE || 'Sin encargado')
                            : 'Todas las mesas'
                        }
                        value={mesaSearchQuery}
                        onClick={() => setOpenMesaDropdown(!openMesaDropdown)}
                        onChange={(e) => {
                          setMesaSearchQuery(e.target.value);
                          setOpenMesaDropdown(true);
                        }}
                        style={{ width: '100%' }}
                        className="h-8 truncate border border-slate-200 bg-white pl-3 pr-8 text-[11px] font-medium text-slate-700 shadow-sm transition-all duration-200 placeholder:text-slate-700 placeholder:font-semibold hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      {selectedMesaFilter ? (
                        <button
                          onClick={() => {
                            setSelectedMesaFilter('');
                            setMesaSearchQuery('');
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      )}

                      {openMesaDropdown && (
                        <div
                          className="absolute z-50 top-full left-0 mt-1.5 bg-white border border-slate-200/80 rounded-xl shadow-xl max-h-56 overflow-y-auto py-1 ring-1 ring-black/5"
                          style={{ width: '100%' }}
                        >
                          <div
                            className={`px-3 py-1.5 text-[11px] cursor-pointer transition-colors border-l-2 font-medium ${
                              !selectedMesaFilter ? 'bg-blue-50 text-blue-700 border-blue-600' : 'text-slate-500 hover:bg-slate-50 border-transparent'
                            }`}
                            onClick={() => {
                              setSelectedMesaFilter('');
                              setMesaSearchQuery('');
                              setOpenMesaDropdown(false);
                            }}
                          >
                            TODAS LAS MESAS
                          </div>
                          <div className="h-px bg-slate-100 my-1"></div>
                          {mesas
                            .filter(m => {
                              const term = mesaSearchQuery.toLowerCase();
                              return (
                                m.MESA.toLowerCase().includes(term) ||
                                (m.NOMBRE || '').toLowerCase().includes(term)
                              );
                            })
                            .length === 0 ? (
                            <div className="px-3 py-2 text-[11px] text-slate-400 italic">No se encontraron resultados</div>
                          ) : (
                            mesas
                              .filter(m => {
                                const term = mesaSearchQuery.toLowerCase();
                                return (
                                  m.MESA.toLowerCase().includes(term) ||
                                  (m.NOMBRE || '').toLowerCase().includes(term)
                                );
                              })
                              .map((m) => (
                                <div
                                  key={m.ID_MESA}
                                  className={`whitespace-normal break-words px-3 py-1.5 text-[11px] cursor-pointer transition-colors border-l-2 ${
                                    Number(selectedMesaFilter) === Number(m.ID_MESA)
                                      ? 'bg-blue-50 text-blue-700 border-blue-600 font-semibold'
                                      : 'text-slate-700 hover:bg-slate-50 border-transparent'
                                  }`}
                                  onClick={() => {
                                    setSelectedMesaFilter(String(m.ID_MESA));
                                    setMesaSearchQuery('');
                                    setOpenMesaDropdown(false);
                                  }}
                                >
                                  {m.MESA} - {m.NOMBRE || 'Sin encargado'}
                                </div>
                              ))
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {hasAnyFilter && (
                    <button
                      onClick={limpiarFiltros}
                      className="h-8 flex items-center gap-1.5 px-3 py-0 border border-rose-200 bg-rose-50 text-rose-700 rounded-lg text-[11px] font-bold hover:bg-rose-100 hover:border-rose-300 transition-all duration-200 shadow-sm"
                    >
                      <X className="w-3.5 h-3.5" />
                      LIMPIAR FILTROS
                    </button>
                  )}
                </div>

                <p className="text-[9px] text-slate-400 leading-none mt-1.5">
                  TOTAL REGISTROS: {filteredExpedientes.length} DE {expedientes.length} EXPEDIENTE(S)
                  {hasAnyFilter && <span className="ml-1 text-blue-600 font-semibold">FILTRADO</span>}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {can('trabajo.flush_history') && (
                  <button
                    onClick={handleManualFlush}
                    disabled={flushing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 text-white rounded-lg text-xs font-bold hover:bg-teal-800 transition-colors disabled:opacity-50 h-8"
                    title="Ejecutar depuración e historial manualmente"
                  >
                    {flushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Enviar a Historial (Manual)
                  </button>
                )}
                <button
                  onClick={openSortModal}
                  className="h-8 flex items-center justify-center gap-1.5 px-3 bg-slate-800 border border-slate-900 text-white rounded text-[10px] font-semibold shadow-sm hover:bg-slate-900 transition-colors"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  ORDENAR
                </button>
                <button
                  onClick={() => loadData({ showSuccessToast: true })}
                  className="p-2 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors h-8 w-8 flex items-center justify-center"
                  title="Recargar datos"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </div>
            </div>
          </div>

          {/* Grid table */}
          <div className="relative z-10 bg-card rounded-xl border border-border overflow-hidden flex-1 min-h-0 flex flex-col">
            {loading ? (
              <div className="flex flex-1 min-h-[320px] items-center justify-center">
                <Loader2 className="w-14 h-14 animate-spin text-primary" strokeWidth={2.25} />
              </div>
            ) : (
              <div className="overflow-x-scroll overflow-y-auto relative flex-1 min-h-0">
                <table className="trabajo-diario-table w-full text-xs">
                  <thead className="sticky top-0 z-50 bg-[#1e40af] text-white font-semibold">
                    <tr>
                      {renderTableHeader('numeroOrden', 'No. Orden', 'number', 'px-3 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap')}
                      {renderTableHeader('juicio', 'Juicio / Expediente', 'text', 'px-3 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap')}
                      {renderTableHeader('mesa', 'Mesa', 'text', 'px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap')}
                      {renderTableHeader('persona', 'Persona', 'text', 'px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap')}
                      {renderTableHeader('ultimoRequerimiento', 'Último Requerimiento', 'date', 'px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap')}
                      {renderTableHeader('diasNaturales', 'Días Naturales', 'number', 'px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap', 'Días Naturales Transcurridos')}
                      {renderTableHeader('diasHabiles', 'Días Hábiles', 'number', 'px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap', 'Días Hábiles Transcurridos')}
                      {renderTableHeader('estatusCumplimiento', 'Estatus', 'estatus', 'px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap')}
                      {renderTableHeader('fechaVistaCumpli', 'Fec. Vista Cumplimiento', 'date', 'px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap')}
                      {renderTableHeader('fechaVista', 'Fec. Vista (Recibe Jzdo)', 'date', 'px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap')}
                      {renderTableHeader('fechaAcuerdo', 'Fecha Acuerdo', 'date', 'px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap')}
                      {renderTableHeader('estatus', 'Estatus Atención', 'estatus', 'px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap')}
                      {renderTableHeader('observaciones', 'Observaciones Trabajo Diario', 'text', 'px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap')}
                      {renderTableHeader('capturadoPor', 'Capturado Por', 'text', 'px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap')}
                      {renderTableHeader('fechaCaptura', 'Fecha Captura', 'date', 'px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap')}
                      {can('trabajo.capture') && (
                        <th className="trabajo-diario-action-cell bg-[#1e40af] px-4 py-3 text-center text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap">
                          Acción
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredExpedientes.map((exp, index) => {
                      const hasWork = !!(exp.estatusAtendido || exp.fechaAcuerdo || exp.observacionesDiario);
                      const capturadoPorNombre = users.find(u => u.IdUsuario === exp.usuarioCapturaTrabajo)?.NombreCompleto || users.find(u => u.IdUsuario === exp.usuarioCapturaTrabajo)?.Usuario || '-';
                      const personaMesa = mesas.find(m => Number(m.ID_MESA) === Number(exp.idMesa))?.NOMBRE || '';
                      const mesaTexto = mesas.find(m => Number(m.ID_MESA) === Number(exp.idMesa))?.MESA || '-';
                      const fechaCapturaTexto = exp.fechaCapturaTrabajo ? new Date(exp.fechaCapturaTrabajo).toLocaleString() : '-';
                      const estatusTrabajo = deriveTrabajoStatus(exp.ultimoRequerimiento, exp.fechaAcuerdo);
                      const rowColor = getRowColor(exp);
                      
                      return (
                        <tr key={exp.id} className={`transition-colors hover:bg-accent/50 ${rowColor}`}>
                          <td className="px-3 py-3 text-center font-semibold text-slate-700 whitespace-nowrap">{oneLineCell(String(index + 1))}</td>
                          <td className="px-3 py-3 font-bold text-black whitespace-nowrap">{oneLineCell(exp.numeroJuicio || '')}</td>
                          <td className={`px-4 py-3 text-slate-600 font-semibold whitespace-nowrap ${rowColor}`}>{oneLineCell(mesaTexto)}</td>
                          <td className={`px-4 py-3 text-slate-600 font-semibold whitespace-nowrap ${rowColor}`} title={personaMesa}>{oneLineCell(personaMesa)}</td>
                          <td className={`px-4 py-3 text-slate-500 font-semibold whitespace-nowrap ${rowColor}`}>{oneLineCell(formatDateDMY(exp.ultimoRequerimiento) || '-')}</td>
                          <td className={`px-4 py-3 text-center text-slate-600 font-semibold ${rowColor}`}>{exp.diasNaturalesTranscurridos || '-'}</td>
                          <td className={`px-4 py-3 text-center text-slate-600 font-semibold ${rowColor}`}>{exp.diasHabilesTranscurridos || '-'}</td>
                          <td className={`px-4 py-3 text-center whitespace-nowrap ${rowColor}`}>
                            <StatusBadgeSemaforo estatus={exp.estatus} diasHabiles={exp.diasHabilesTranscurridos} />
                          </td>
                          <td className={`px-4 py-3 text-slate-500 font-medium whitespace-nowrap ${rowColor}`}>{oneLineCell(formatDateDMY(exp.fechaVistaCumpli) || '-')}</td>
                          <td className={`px-4 py-3 text-slate-500 font-medium whitespace-nowrap ${rowColor}`}>{oneLineCell(formatDateDMY(exp.fechaVista) || '-')}</td>
                          <td className={`px-4 py-3 text-slate-500 font-medium whitespace-nowrap ${rowColor}`}>{oneLineCell(formatDateDMY(exp.fechaAcuerdo) || '-')}</td>
                          <td className={`px-4 py-3 whitespace-nowrap ${rowColor}`}>
                            <StatusBadge status={estatusTrabajo} />
                          </td>
                          <td className={`max-w-[220px] px-4 py-3 text-slate-600 align-middle ${rowColor}`} title={exp.observacionesDiario || ''}>
                            <div
                              className="w-full max-w-full overflow-hidden text-xs leading-5"
                              style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                maxHeight: 40,
                                overflowWrap: 'anywhere',
                                wordBreak: 'break-all',
                              }}
                            >
                              {exp.observacionesDiario || '-'}
                            </div>
                          </td>
                          <td className={`px-4 py-3 text-slate-500 whitespace-nowrap ${rowColor}`} title={capturadoPorNombre}>{oneLineCell(capturadoPorNombre)}</td>
                          <td className={`px-4 py-3 text-slate-500 whitespace-nowrap ${rowColor}`}>{oneLineCell(fechaCapturaTexto)}</td>
                          {can('trabajo.capture') && (
                            <td className="trabajo-diario-action-cell px-4 py-3 text-center whitespace-nowrap">
                              <button
                                onClick={() => openCapture(exp)}
                                className="inline-flex min-w-[92px] items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-bold transition-colors"
                                style={{
                                  backgroundColor: hasWork ? '#ffffff' : '#1d4ed8',
                                  borderColor: hasWork ? '#bfdbfe' : '#1d4ed8',
                                  color: hasWork ? '#1d4ed8' : '#ffffff',
                                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
                                }}
                              >
                                {hasWork ? (
                                  <>
                                    <Edit className="w-3 h-3" />
                                    Editar
                                  </>
                                ) : (
                                  <>
                                    <Check className="w-3 h-3" />
                                    Capturar
                                  </>
                                )}
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    {filteredExpedientes.length === 0 && (
                      <tr>
                        <td colSpan={can('trabajo.capture') ? 16 : 15} className="px-4 py-8 text-center text-muted-foreground">
                          No se encontraron expedientes vivos.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: History */}
      {activeTab === 'historial' && (
        <div className="flex-1 min-h-0 flex flex-col gap-4">
          <div className="relative z-30 bg-card rounded-xl border border-border p-3 flex-shrink-0">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filtrar por número de expediente/juicio..."
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadHistory()}
                  className="w-full pl-9 pr-3 py-1.5 bg-input-background border border-input rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div
                className="relative"
                style={{ width: 440, minWidth: 360, maxWidth: 'calc(100vw - 620px)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  placeholder={
                    historyMesaFilter
                      ? (mesas.find(m => Number(m.ID_MESA) === Number(historyMesaFilter))?.MESA || '') +
                        ' - ' +
                        (mesas.find(m => Number(m.ID_MESA) === Number(historyMesaFilter))?.NOMBRE || 'Sin encargado')
                      : 'Todas las mesas'
                  }
                  value={historyMesaSearchQuery}
                  onClick={() => setOpenHistoryMesaDropdown(!openHistoryMesaDropdown)}
                  onChange={(e) => {
                    setHistoryMesaSearchQuery(e.target.value);
                    setOpenHistoryMesaDropdown(true);
                  }}
                  style={{ width: '100%' }}
                  className="h-8 truncate border border-slate-200 bg-white pl-3 pr-8 text-[11px] font-medium text-slate-700 shadow-sm transition-all duration-200 placeholder:text-slate-700 placeholder:font-semibold hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                {historyMesaFilter ? (
                  <button
                    onClick={() => {
                      setHistoryMesaFilter('');
                      setHistoryMesaSearchQuery('');
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                )}

                {openHistoryMesaDropdown && (
                  <div
                    className="absolute z-50 top-full left-0 mt-1.5 bg-white border border-slate-200/80 rounded-xl shadow-xl max-h-56 overflow-y-auto py-1 ring-1 ring-black/5"
                    style={{ width: '100%' }}
                  >
                    <div
                      className={`px-3 py-1.5 text-[11px] cursor-pointer transition-colors border-l-2 font-medium ${
                        !historyMesaFilter ? 'bg-blue-50 text-blue-700 border-blue-600' : 'text-slate-500 hover:bg-slate-50 border-transparent'
                      }`}
                      onClick={() => {
                        setHistoryMesaFilter('');
                        setHistoryMesaSearchQuery('');
                        setOpenHistoryMesaDropdown(false);
                      }}
                    >
                      TODAS LAS MESAS
                    </div>
                    <div className="h-px bg-slate-100 my-1"></div>
                    {mesas
                      .filter(m => {
                        const term = historyMesaSearchQuery.toLowerCase();
                        return (
                          m.MESA.toLowerCase().includes(term) ||
                          (m.NOMBRE || '').toLowerCase().includes(term)
                        );
                      })
                      .length === 0 ? (
                      <div className="px-3 py-2 text-[11px] text-slate-400 italic">No se encontraron resultados</div>
                    ) : (
                      mesas
                        .filter(m => {
                          const term = historyMesaSearchQuery.toLowerCase();
                          return (
                            m.MESA.toLowerCase().includes(term) ||
                            (m.NOMBRE || '').toLowerCase().includes(term)
                          );
                        })
                        .map((m) => (
                          <div
                            key={m.ID_MESA}
                            className={`whitespace-normal break-words px-3 py-1.5 text-[11px] cursor-pointer transition-colors border-l-2 ${
                              Number(historyMesaFilter) === Number(m.ID_MESA)
                                ? 'bg-blue-50 text-blue-700 border-blue-600 font-semibold'
                                : 'text-slate-700 hover:bg-slate-50 border-transparent'
                            }`}
                            onClick={() => {
                              setHistoryMesaFilter(String(m.ID_MESA));
                              setHistoryMesaSearchQuery('');
                              setOpenHistoryMesaDropdown(false);
                            }}
                          >
                            {m.MESA} - {m.NOMBRE || 'Sin encargado'}
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={loadHistory}
                disabled={loadingHistory}
                className="flex items-center justify-center gap-1.5 px-4 py-1.5 bg-[#1e40af] text-white rounded-lg text-xs font-bold hover:bg-blue-800 transition-colors h-8"
              >
                {loadingHistory ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                Buscar
              </button>
            </div>
          </div>

          {/* History table */}
          <div className="relative z-10 bg-card rounded-xl border border-border overflow-hidden flex-1 min-h-0 flex flex-col">
            {loadingHistory ? (
              <div className="flex flex-1 min-h-[320px] items-center justify-center">
                <Loader2 className="w-14 h-14 animate-spin text-primary" strokeWidth={2.25} />
              </div>
            ) : (
              <div className="overflow-auto flex-1 min-h-0">
                <table className="w-full text-xs">
                  <thead className="bg-[#1e40af] text-white font-semibold sticky top-0 z-20">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[9px] whitespace-nowrap">Expediente</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[9px] whitespace-nowrap">Mesa</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[9px] whitespace-nowrap">Persona</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[9px] whitespace-nowrap">Estatus</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[9px] whitespace-nowrap">Fecha Acuerdo</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[9px] whitespace-nowrap">Observaciones</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[9px] whitespace-nowrap">Oficial / Capturó</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[9px] whitespace-nowrap">Rol</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[9px] whitespace-nowrap">Fecha Captura</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[9px] whitespace-nowrap">Fecha Envío Historial</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {historyList.map((hist) => (
                      <tr key={hist.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-800 whitespace-nowrap">{hist.expediente}</td>
                        <td className="px-4 py-3 text-slate-600 font-semibold whitespace-nowrap">{hist.mesaNombre}</td>
                        <td className="px-4 py-3 text-slate-600 font-semibold whitespace-nowrap" title={hist.personaMesa || ''}>{oneLineCell(hist.personaMesa || '')}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusBadge status={hist.estatusAtendido} />
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-medium whitespace-nowrap">{hist.fechaAcuerdo || '-'}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-[220px] truncate" title={hist.observaciones || ''}>{hist.observaciones || '-'}</td>
                        <td className="px-4 py-3 text-slate-500 font-medium whitespace-nowrap" title={hist.usuarioNombre}>{oneLineCell(hist.usuarioNombre)}</td>
                        <td className="px-4 py-3 text-[10px] font-mono bg-slate-50 whitespace-nowrap">{hist.rol || '-'}</td>
                        <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{new Date(hist.fechaCaptura).toLocaleString()}</td>
                        <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{new Date(hist.fechaEnvioHistorial).toLocaleString()}</td>
                      </tr>
                    ))}
                    {historyList.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                          No se encontraron registros en el historial de capturas de trabajo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sort Modal */}
      {showModalOrdenar && createPortal(
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[99999] flex items-center justify-center p-4"
          onClick={() => setOpenSortDropdown(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200"
            style={{ width: '100%', maxWidth: 600 }}
            onClick={(e) => { e.stopPropagation(); setOpenSortDropdown(null); }}
          >
            <div className="flex items-center justify-between px-5 py-4 bg-[#1e40af] text-white rounded-t-xl shrink-0">
              <h3 className="text-sm font-bold tracking-wide uppercase flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-blue-200" />
                Ordenamiento
              </h3>
              <button
                onClick={() => setShowModalOrdenar(false)}
                className="p-1 hover:bg-white/15 rounded-md transition-colors"
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-5 bg-slate-50 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Criterios de ordenamiento ({draftSortLevels.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={deleteSortLevel}
                      disabled={!selectedSortLevelId}
                      className="h-8 px-3 flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Eliminar
                    </button>
                    <button
                      onClick={addSortLevel}
                      className="h-8 px-3 flex items-center justify-center gap-1.5 rounded-lg bg-[#1e40af] text-white text-xs font-semibold hover:bg-blue-800 transition-colors shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Agregar
                    </button>
                  </div>
                </div>

                {draftSortLevels.length === 0 ? (
                  <div className="h-32 rounded-xl border-2 border-dashed border-slate-200 bg-white flex flex-col items-center justify-center gap-2 px-3 text-center transition-colors">
                    <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                      <ArrowUpDown className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700">Sin ordenamiento configurado</p>
                      <p className="text-[11px] text-slate-500 mt-1">Haz clic en Agregar para definir un criterio.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1" onScroll={() => setOpenSortDropdown(null)}>
                    {draftSortLevels.map((level, index) => {
                      const column = getTrabajoSortColumn(level.column);
                      const selected = selectedSortLevelId === level.id;

                      return (
                        <div
                          key={level.id}
                          onClick={(e) => { e.stopPropagation(); setSelectedSortLevelId(level.id); }}
                          className={`rounded-md border p-1.5 transition-colors cursor-pointer ${selected ? 'border-[#1e40af] bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-[#1e40af]/50 hover:shadow-sm'}`}
                        >
                          <div className="flex items-center mb-1">
                            <span className="text-[8px] font-bold text-[#1e40af] uppercase tracking-wider bg-blue-100/50 px-1 py-0.5 rounded">
                              {index === 0 ? 'Ordenar por' : 'Luego por'}
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
                                  setOpenSortDropdown(openSortDropdown === `col-${level.id}` ? null : `col-${level.id}`);
                                }}
                                className="h-7 w-full pl-2 pr-6 border border-slate-200 rounded text-[10px] font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-[#1e40af]/30 focus:border-[#1e40af] flex items-center justify-between text-left relative transition-all bg-white"
                              >
                                <span className="truncate">{column.label}</span>
                                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              </button>
                              {openSortDropdown === `col-${level.id}` && sortDropdownCoords && createPortal(
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
                                  {TRABAJO_SORT_COLUMNS.map((option) => (
                                    <div
                                      key={option.key}
                                      className={`px-2 py-1 text-[10px] cursor-pointer transition-colors ${level.column === option.key ? 'bg-blue-50 text-[#1e40af] font-bold' : 'text-slate-700 hover:bg-slate-50 font-medium'}`}
                                      onClick={() => {
                                        updateSortLevel(level.id, { column: option.key });
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
                                  setOpenSortDropdown(openSortDropdown === `order-${level.id}` ? null : `order-${level.id}`);
                                }}
                                className="h-7 w-full pl-2 pr-6 border border-slate-200 rounded text-[10px] font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-[#1e40af]/30 focus:border-[#1e40af] flex items-center justify-between text-left relative transition-all bg-white"
                              >
                                <span className="truncate">{getTrabajoSortOrderLabel(column, level.direction)}</span>
                                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              </button>
                              {openSortDropdown === `order-${level.id}` && sortDropdownCoords && createPortal(
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
                                    className={`px-2 py-1 text-[10px] cursor-pointer transition-colors ${level.direction === 'ASC' ? 'bg-blue-50 text-[#1e40af] font-bold' : 'text-slate-700 hover:bg-slate-50 font-medium'}`}
                                    onClick={() => {
                                      updateSortLevel(level.id, { direction: 'ASC' });
                                      setOpenSortDropdown(null);
                                    }}
                                  >
                                    {getTrabajoSortOrderLabel(column, 'ASC')}
                                  </div>
                                  <div
                                    className={`px-2 py-1 text-[10px] cursor-pointer transition-colors ${level.direction === 'DESC' ? 'bg-blue-50 text-[#1e40af] font-bold' : 'text-slate-700 hover:bg-slate-50 font-medium'}`}
                                    onClick={() => {
                                      updateSortLevel(level.id, { direction: 'DESC' });
                                      setOpenSortDropdown(null);
                                    }}
                                  >
                                    {getTrabajoSortOrderLabel(column, 'DESC')}
                                  </div>
                                </div>,
                                document.body
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

            <div className="px-6 py-4 border-t border-slate-100 bg-white rounded-b-xl shrink-0">
              <button
                onClick={applySortLevels}
                className="w-full px-4 py-2.5 bg-[#1e40af] text-white rounded-lg text-sm font-semibold hover:bg-blue-800 transition-colors shadow-sm"
              >
                Aplicar Orden
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Manual history result modal */}
      {flushResult && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          onClick={() => setFlushResult(null)}
        >
          <div
            className="w-full max-w-[520px] overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-8 pt-8 pb-6 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60">
                <CheckCircle2 className="h-9 w-9" strokeWidth={2.4} />
              </div>

              <h3 className="text-xl font-extrabold text-slate-800">
                Historial manual completado
              </h3>
              <p className="mx-auto mt-3 max-w-[390px] text-sm font-medium leading-6 text-slate-500">
                Se enviaron al historial {flushResult.processed} expediente(s) con capturas vencidas y se limpio su trabajo diario.
              </p>
            </div>

            <div className="border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setFlushResult(null)}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#1e40af] px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-800"
              >
                <Check className="h-4 w-4" />
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Capture Modal */}
      {showCaptureModal && selectedExpediente && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[99999] flex items-center justify-center p-4" onClick={() => setShowCaptureModal(false)}>
          <div
            className="bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 640 }}
          >
            <div className="flex items-center justify-between px-5 py-4 bg-[#1e40af] text-white rounded-t-xl shrink-0">
              <h3 className="text-sm font-bold tracking-wide uppercase flex items-center gap-2">
                <FileEdit className="w-4 h-4 text-blue-200" />
                Capturar Trabajo Diario
              </h3>
              <button
                type="button"
                onClick={() => setShowCaptureModal(false)}
                className="p-1 hover:bg-white/15 rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCaptureSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 bg-white">
                {/* Info Card for Static Data */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Orden</span>
                      <span className="text-xs font-semibold text-slate-700">{selectedExpediente.numeroOrden || '-'}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Juicio/Exp</span>
                      <span className="text-[13px] font-bold text-[#1e40af]">{selectedExpediente.numeroJuicio || '-'}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mesa</span>
                      <span className="text-xs font-semibold text-slate-700">{mesas.find(m => Number(m.ID_MESA) === Number(selectedExpediente.idMesa))?.MESA || '-'}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Último Req.</span>
                      <span className="text-xs font-semibold text-slate-700">{formatDateDMY(selectedExpediente.ultimoRequerimiento)}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha Acuerdo</label>
                    <input
                      type="date"
                      value={formFechaAcuerdo}
                      onChange={(e) => setFormFechaAcuerdo(e.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af] transition-all shadow-sm"
                    />
                  </div>
                  <div className="flex flex-col h-full">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">Estatus Calculado</label>
                    {(() => {
                      const currentStatus = deriveTrabajoStatus(selectedExpediente.ultimoRequerimiento, formFechaAcuerdo);
                      const isAtendido = currentStatus === 'ATENDIDA' || currentStatus === 'ATENDIDO';
                      const isSinAtender = currentStatus === 'SIN ATENDER';
                      
                      const containerClass = isAtendido 
                        ? 'bg-emerald-600 border-emerald-700 text-white' 
                        : isSinAtender 
                          ? 'bg-red-600 border-red-700 text-white' 
                          : 'bg-slate-50 border-slate-200 text-slate-600';

                      return (
                        <div className={`h-11 w-full border rounded-lg shadow-sm flex items-center justify-center transition-colors ${containerClass}`}>
                          <span className="text-xs font-extrabold uppercase tracking-widest">{currentStatus}</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Observaciones de Trabajo Diario</label>
                  <textarea
                    value={formObservaciones}
                    onChange={(e) => setFormObservaciones(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af] transition-all shadow-sm placeholder:text-slate-300"
                    style={{ height: '120px' }}
                    placeholder="Escriba las observaciones del trabajo diario aquí..."
                  />
                </div>

                {modalError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 mt-4">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-[13px] font-medium">{modalError}</span>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-white rounded-b-xl shrink-0">
                <button
                  type="submit"
                  disabled={savingCapture}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#1e40af] text-white rounded-lg text-sm font-semibold hover:bg-blue-800 transition-colors disabled:opacity-50 shadow-sm"
                >
                  {savingCapture ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar Captura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function parseSortNumber(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const text = String(value).trim();
  if (text === '') {
    return null;
  }
  const numeric = Number(text.replace(/,/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

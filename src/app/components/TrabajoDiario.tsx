import { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList,
  History,
  Loader2,
  AlertCircle,
  Search,
  Check,
  Edit,
  Save,
  X,
  RefreshCw,
  FolderOpen,
  ChevronDown
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

function statusBadgeClass(status: string) {
  switch (status) {
    case 'ATENDIDA':
    case 'ATENDIDO':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'SIN ATENDER':
      return 'border-red-200 bg-red-50 text-red-700';
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

  // Custom Mesa Filter Dropdown
  const [openMesaDropdown, setOpenMesaDropdown] = useState(false);
  const [mesaSearchQuery, setMesaSearchQuery] = useState('');
  const [openHistoryMesaDropdown, setOpenHistoryMesaDropdown] = useState(false);
  const [historyMesaSearchQuery, setHistoryMesaSearchQuery] = useState('');

  const can = useCallback((p: string) => {
    return isAdmin || permissions.includes(p);
  }, [isAdmin, permissions]);

  const loadData = useCallback(async () => {
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
        showStyledAlert({
          title: 'Limpieza e Historial completado',
          text: `Se archivaron e inicializaron ${res.processed} expediente(s) con capturas vencidas.`,
          icon: 'success'
        });
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

  // Filter vivo list in UI
  const filteredExpedientes = expedientes.filter(exp => {
    // Search query filter
    const matchesSearch = 
      String(exp.numeroJuicio || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(exp.numeroOrden || '').includes(searchQuery);

    // Mesa select filter (only applicable if has view_all_mesas permission)
    const matchesMesa = 
      !can('trabajo.view_all_mesas') || 
      !selectedMesaFilter || 
      Number(exp.idMesa) === Number(selectedMesaFilter);

    return matchesSearch && matchesMesa;
  });

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
                              !selectedMesaFilter ? 'bg-blue-50 text-blue-700 border-blue-600 font-semibold' : 'text-slate-500 hover:bg-slate-50 border-transparent'
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
                </div>

                <p className="text-[9px] font-bold text-slate-500 leading-none">
                  {filteredExpedientes.length} de {expedientes.length} expediente(s) vivo(s)
                </p>
              </div>

              <div className="flex items-center gap-2">
                {can('trabajo.flush_history') && (
                  <button
                    onClick={handleManualFlush}
                    disabled={flushing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors disabled:opacity-50 h-8"
                    title="Ejecutar depuración e historial manualmente"
                  >
                    {flushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Enviar a Historial (Manual)
                  </button>
                )}
                <button
                  onClick={loadData}
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
                      <th className="bg-[#1e40af] px-3 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap">No. Orden</th>
                      <th className="bg-[#1e40af] px-3 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap">Juicio / Expediente</th>
                      <th className="bg-[#1e40af] px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap">Mesa</th>
                      <th className="bg-[#1e40af] px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap">Persona</th>
                      <th className="bg-[#1e40af] px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap">Último Requerimiento</th>
                      <th className="bg-[#1e40af] px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap">Días Naturales</th>
                      <th className="bg-[#1e40af] px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap">Días Hábiles</th>
                      <th className="bg-[#1e40af] px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap">Fecha Acuerda</th>
                      <th className="bg-[#1e40af] px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap">Estatus</th>
                      <th className="bg-[#1e40af] px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap">Observaciones Trabajo Diario</th>
                      <th className="bg-[#1e40af] px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap">Capturado Por</th>
                      <th className="bg-[#1e40af] px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap">Fecha Captura</th>
                      {can('trabajo.capture') && (
                        <th className="trabajo-diario-action-cell bg-[#1e40af] px-4 py-3 text-center text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap">
                          Acción
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredExpedientes.map((exp) => {
                      const hasWork = !!(exp.estatusAtendido || exp.fechaAcuerdo || exp.observacionesDiario);
                      const capturadoPorNombre = users.find(u => u.IdUsuario === exp.usuarioCapturaTrabajo)?.NombreCompleto || users.find(u => u.IdUsuario === exp.usuarioCapturaTrabajo)?.Usuario || '-';
                      const personaMesa = mesas.find(m => Number(m.ID_MESA) === Number(exp.idMesa))?.NOMBRE || '';
                      const mesaTexto = mesas.find(m => Number(m.ID_MESA) === Number(exp.idMesa))?.MESA || '-';
                      const fechaCapturaTexto = exp.fechaCapturaTrabajo ? new Date(exp.fechaCapturaTrabajo).toLocaleString() : '-';
                      const estatusTrabajo = deriveTrabajoStatus(exp.ultimoRequerimiento, exp.fechaAcuerdo);
                      
                      return (
                        <tr key={exp.id} className={`hover:bg-muted/30 transition-colors ${hasWork ? 'bg-blue-50/20' : ''}`}>
                          <td className="px-3 py-3 font-semibold text-slate-700 whitespace-nowrap">{oneLineCell(String(exp.numeroOrden || ''))}</td>
                          <td className="px-3 py-3 font-bold text-blue-800 whitespace-nowrap">{oneLineCell(exp.numeroJuicio || '')}</td>
                          <td className="px-4 py-3 text-slate-600 font-semibold whitespace-nowrap">{oneLineCell(mesaTexto)}</td>
                          <td className="px-4 py-3 text-slate-600 font-semibold max-w-[160px] truncate" title={personaMesa}>{oneLineCell(personaMesa)}</td>
                          <td className="px-4 py-3 text-slate-500 font-semibold whitespace-nowrap">{oneLineCell(formatDateDMY(exp.ultimoRequerimiento) || '-')}</td>
                          <td className="px-4 py-3 text-center text-slate-600 font-semibold">{exp.diasNaturalesTranscurridos || '-'}</td>
                          <td className="px-4 py-3 text-center text-slate-600 font-semibold">{exp.diasHabilesTranscurridos || '-'}</td>
                          <td className="px-4 py-3 text-slate-500 font-medium whitespace-nowrap">{oneLineCell(formatDateDMY(exp.fechaAcuerdo) || '-')}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <StatusBadge status={estatusTrabajo} />
                          </td>
                          <td className="max-w-[220px] px-4 py-3 text-slate-600 align-middle" title={exp.observacionesDiario || ''}>
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
                          <td className="px-4 py-3 text-slate-500 max-w-[140px] truncate" title={capturadoPorNombre}>{oneLineCell(capturadoPorNombre)}</td>
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{oneLineCell(fechaCapturaTexto)}</td>
                          {can('trabajo.capture') && (
                            <td className="trabajo-diario-action-cell bg-white px-4 py-3 text-center whitespace-nowrap">
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
                        <td colSpan={can('trabajo.capture') ? 13 : 12} className="px-4 py-8 text-center text-muted-foreground">
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
                        <td className="px-4 py-3 text-slate-600 font-semibold max-w-[160px] truncate" title={hist.personaMesa || ''}>{oneLineCell(hist.personaMesa || '')}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusBadge status={hist.estatusAtendido} />
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-medium whitespace-nowrap">{hist.fechaAcuerdo || '-'}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-[220px] truncate" title={hist.observaciones || ''}>{hist.observaciones || '-'}</td>
                        <td className="px-4 py-3 text-slate-500 font-medium max-w-[140px] truncate" title={hist.usuarioNombre}>{oneLineCell(hist.usuarioNombre)}</td>
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

      {/* Capture Modal */}
      {showCaptureModal && selectedExpediente && (
        <div className="user-form-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => {
          setShowCaptureModal(false);
        }}>
          <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl overflow-hidden animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between text-white" style={{ backgroundColor: '#1d4ed8' }}>
              <h3 className="text-base font-bold uppercase tracking-wide">Capturar Trabajo Diario</h3>
              <button onClick={() => {
                setShowCaptureModal(false);
              }} className="text-white/80 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCaptureSubmit}>
              <div className="p-6 bg-white overflow-y-auto max-h-[calc(100vh-200px)]">
                <div className="grid grid-cols-3 gap-6 mb-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Orden</label>
                    <div className="h-10 w-full flex items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800">
                      {selectedExpediente.numeroOrden || '-'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Juicio/Expediente</label>
                    <div className="h-10 w-full flex items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 font-bold">
                      {selectedExpediente.numeroJuicio || '-'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Mesa</label>
                    <div className="h-10 w-full flex items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800">
                      {mesas.find(m => Number(m.ID_MESA) === Number(selectedExpediente.idMesa))?.MESA || '-'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6 mb-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Último Requerimiento</label>
                    <div className="h-10 w-full flex items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800">
                      {selectedExpediente.ultimoRequerimiento || '-'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Fecha Acuerdo</label>
                    <input
                      type="date"
                      value={formFechaAcuerdo}
                      onChange={(e) => setFormFechaAcuerdo(e.target.value)}
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Estatus Calculado</label>
                    <div className="flex h-10 w-full items-center rounded-md border border-slate-200 bg-slate-50 px-3">
                      <StatusBadge status={deriveTrabajoStatus(selectedExpediente.ultimoRequerimiento, formFechaAcuerdo)} />
                    </div>
                  </div>
                </div>

                <div className="mb-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Observaciones de Trabajo Diario</label>
                  <textarea
                    value={formObservaciones}
                    onChange={(e) => setFormObservaciones(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-800 resize-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors placeholder:text-slate-400"
                    style={{ height: '120px' }}
                    placeholder="Observaciones del trabajo diario..."
                  />
                </div>

                {modalError && (
                  <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-medium">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{modalError}</span>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end gap-3 rounded-b-xl">
                <button
                  type="button"
                  onClick={() => {
                    setShowCaptureModal(false);
                  }}
                  className="px-5 py-2.5 rounded-md bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCapture}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-md text-white text-sm font-bold transition-colors disabled:opacity-50"
                  style={{ backgroundColor: '#1d4ed8' }}
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

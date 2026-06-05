import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  TableProperties,
  Plus,
  Edit,
  Save,
  X,
  Loader2,
  AlertCircle,
  Search,
  ChevronDown,
  Upload,
  CheckCircle,
  XCircle,
  Shuffle,
  History,
  FileSpreadsheet,
  Trash2
} from 'lucide-react';
import { showStyledAlert } from '../utils/alert';
import { toastSuccess, toastError, toastWarning } from '../utils/toast';

interface MesasTramiteProps {
  permissions: string[];
  isAdmin: boolean;
  session: any;
}

interface MesaRecord {
  ID_MESA: number;
  MESA: string;
  NOMBRE: string;
  ACTIVO: number;
  CREATED_AT: string;
  UPDATED_AT: string;
}

interface HistoryRecord {
  id: number;
  expedienteRowid: number;
  expediente: string;
  idMesaAnterior: number | null;
  mesaAnteriorNombre: string;
  idMesaNueva: number;
  mesaNuevaNombre: string;
  usuarioId: number | null;
  usuarioNombre: string;
  motivo: string;
  fechaReasignacion: string;
}

export default function MesasTramite({ permissions, isAdmin, session }: MesasTramiteProps) {
  const [activeTab, setActiveTab] = useState<'catalogo' | 'asignacion' | 'historial'>('catalogo');
  const [mesas, setMesas] = useState<MesaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals / forms state
  const [showMesaModal, setShowMesaModal] = useState(false);
  const [editingMesa, setEditingMesa] = useState<MesaRecord | null>(null);
  const [formMesa, setFormMesa] = useState('');
  const [formNombre, setFormNombre] = useState('');
  const [formActivo, setFormActivo] = useState(true);
  const [modalError, setModalError] = useState('');
  const [savingMesa, setSavingMesa] = useState(false);
  const [deletingMesa, setDeletingMesa] = useState<MesaRecord | null>(null);
  const [deletingMesaSaving, setDeletingMesaSaving] = useState(false);

  // Auto assign state
  const [autoAssigning, setAutoAssigning] = useState(false);

  // Manual reassign state
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [expedientes, setExpedientes] = useState<any[]>([]);
  const [selectedExpediente, setSelectedExpediente] = useState<any | null>(null);
  const [reassignSearch, setReassignSearch] = useState('');
  const [targetMesaId, setTargetMesaId] = useState<string>('');
  const [showTargetMesaCombo, setShowTargetMesaCombo] = useState(false);
  const [reassignMotivo, setReassignMotivo] = useState('');
  const [reassignSaving, setReassignSaving] = useState(false);

  // History state
  const [historyList, setHistoryList] = useState<HistoryRecord[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyTotal, setHistoryTotal] = useState(0);
  const historyPageSize = 100;

  // Excel import state
  const [importingExcel, setImportingExcel] = useState(false);
  const [importSummary, setImportSummary] = useState<any | null>(null);
  const [showImportErrorsModal, setShowImportErrorsModal] = useState(false);

  const can = useCallback((p: string) => {
    return isAdmin || permissions.includes(p);
  }, [isAdmin, permissions]);

  const loadMesas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.api.listMesas();
      setMesas(data || []);
    } catch (err: any) {
      showStyledAlert({
        title: 'Error',
        text: err.message || 'No se pudo cargar el catálogo de mesas.',
        icon: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadExpedientes = useCallback(async () => {
    try {
      const data = await window.cumplimientosBackend.list();
      setExpedientes(data || []);
    } catch (err: any) {
      // Ignore silently
    }
  }, []);

  const loadHistory = useCallback(async (page = 0) => {
    setLoadingHistory(true);
    try {
      const data = await window.api.getAssignmentHistory({
        expediente: historySearch,
        todayOnly: true,
        limit: historyPageSize,
        offset: page * historyPageSize,
      });
      const rows = Array.isArray(data) ? data : data?.rows || [];
      setHistoryList(rows);
      setHistoryTotal(Array.isArray(data) ? rows.length : data?.total || 0);
      setHistoryPage(page);
    } catch (err: any) {
      // Ignore
    } finally {
      setLoadingHistory(false);
    }
  }, [historySearch]);

  useEffect(() => {
    if (can('view.mesas')) {
      loadMesas();
    }
  }, [loadMesas, can]);

  useEffect(() => {
    if (activeTab === 'asignacion' && can('mesas.reassign')) {
      loadExpedientes();
    } else if (activeTab === 'historial' && can('mesas.history')) {
      loadHistory();
    }
  }, [activeTab, loadExpedientes, loadHistory, can]);

  // Handle open create mesa
  function openCreate() {
    setEditingMesa(null);
    setFormMesa('');
    setFormNombre('');
    setFormActivo(true);
    setModalError('');
    setShowMesaModal(true);
  }

  // Handle open edit mesa
  function openEdit(mesa: MesaRecord) {
    setEditingMesa(mesa);
    setFormMesa(mesa.MESA);
    setFormNombre(mesa.NOMBRE);
    setFormActivo(mesa.ACTIVO === 1);
    setModalError('');
    setShowMesaModal(true);
  }

  async function openReassignModal() {
    setSelectedExpediente(null);
    setReassignSearch('');
    setTargetMesaId('');
    setShowTargetMesaCombo(false);
    setReassignMotivo('');
    setShowReassignModal(true);
    await loadExpedientes();
  }

  // Handle submit mesa
  async function handleMesaSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingMesa && !can('mesas.edit')) return;
    if (!editingMesa && !can('mesas.create')) return;
    if (!formMesa.trim()) {
      setModalError('La clave o nombre de la mesa es obligatoria.');
      return;
    }
    setSavingMesa(true);
    setModalError('');
    try {
      if (editingMesa) {
        await window.api.updateMesa(editingMesa.ID_MESA, {
          mesa: formMesa.trim().toUpperCase(),
          nombre: formNombre.trim(),
          activo: formActivo ? 1 : 0
        });
      } else {
        await window.api.createMesa({
          mesa: formMesa.trim().toUpperCase(),
          nombre: formNombre.trim()
        });
      }
      setShowMesaModal(false);
      await loadMesas();
      toastSuccess('Operación exitosa', 'La mesa de trámite se guardó correctamente.');
    } catch (err: any) {
      setModalError(err.message || 'Error al guardar la mesa.');
    } finally {
      setSavingMesa(false);
    }
  }

  // Toggle mesa active status directly from row
  async function handleToggleActivo(mesa: MesaRecord) {
    if (!can('mesas.edit')) return;
    try {
      await window.api.updateMesa(mesa.ID_MESA, {
        mesa: mesa.MESA,
        nombre: mesa.NOMBRE,
        activo: mesa.ACTIVO === 1 ? 0 : 1
      });
      await loadMesas();
      toastSuccess('Mesa actualizada', `La mesa se ha ${mesa.ACTIVO === 1 ? 'desactivado' : 'activado'} correctamente.`);
    } catch (err: any) {
      toastError('Error', err.message || 'No se pudo cambiar el estado de la mesa.');
    }
  }

  function handleDeleteMesa(mesa: MesaRecord) {
    if (!can('mesas.delete')) return;
    setDeletingMesa(mesa);

  }

  async function confirmDeleteMesa() {
    if (!deletingMesa) return;

    setDeletingMesaSaving(true);
    try {
      const result = await window.api.deleteMesa(deletingMesa.ID_MESA);
      if (!result?.ok) {
        toastError('Error', result?.error || 'No se pudo eliminar la mesa.');
        return;
      }

      await loadMesas();
      await loadExpedientes();
      toastSuccess('Mesa eliminada', `${deletingMesa.MESA} fue eliminada correctamente.`);
      setDeletingMesa(null);
    } catch (err: any) {
      toastError('Error', err.message || 'No se pudo eliminar la mesa.');
    } finally {
      setDeletingMesaSaving(false);
    }
  }

  // Run auto assignment
  async function handleAutoAssign() {
    if (!can('mesas.auto_assign')) return;
    setAutoAssigning(true);
    try {
      const res = await window.api.autoAssignMesas(
        session?.user?.IdUsuario || null,
        session?.user?.NombreCompleto || session?.user?.Usuario || 'Sistema'
      );
      if (res.ok) {
        toastSuccess(
          'Asignación completada',
          `Se asignaron ${res.assignedCount} expediente(s): ${res.requiringAssignedCount || 0} en requerimiento, ${res.vistaAssignedCount || 0} con fecha de vista y ${res.otherAssignedCount || 0} restantes.`
        );
        await loadExpedientes();
      } else {
        toastError('Error', res.error || 'No se pudo realizar la asignación automática.');
      }
    } catch (err: any) {
      toastError('Error', err.message || 'Error inesperado.');
    } finally {
      setAutoAssigning(false);
    }
  }

  // Handle reassign submit
  async function handleReassignSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedExpediente) return;
    if (!targetMesaId) {
      toastError('Error', 'Debe seleccionar una mesa de trámite.');
      return;
    }
    setReassignSaving(true);
    try {
      const res = await window.api.reassignMesa({
        expedienteRowid: Number(selectedExpediente.id),
        expediente: selectedExpediente.numeroJuicio,
        newMesaId: Number(targetMesaId),
        userId: session?.user?.IdUsuario || null,
        userName: session?.user?.NombreCompleto || session?.user?.Usuario || 'Sistema',
        motivo: reassignMotivo.trim()
      });
      if (res.ok) {
        setExpedientes((current) =>
          current.map((exp) =>
            String(exp.id) === String(selectedExpediente.id) ||
            String(exp.numeroJuicio || '').trim().toLowerCase() === String(selectedExpediente.numeroJuicio || '').trim().toLowerCase()
              ? { ...exp, idMesa: Number(targetMesaId), observacionesMesa: reassignMotivo.trim() }
              : exp
          )
        );
        toastSuccess('Reasignación exitosa', 'El expediente se ha reasignado a la mesa seleccionada.');
        setSelectedExpediente(null);
        setReassignSearch('');
        setTargetMesaId('');
        setShowTargetMesaCombo(false);
        setReassignMotivo('');
        setShowReassignModal(false);
        await loadExpedientes();
      } else {
        toastError('Error', res.error || 'No se pudo reasignar el expediente.');
      }
    } catch (err: any) {
      toastError('Error', err.message || 'Error inesperado.');
    } finally {
      setReassignSaving(false);
    }
  }

  function normalizeImportHeader(value: any) {
    return String(value || '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase();
  }

  function hasImportColumn(cells: any[], aliases: string[]) {
    const normalizedAliases = new Set(aliases.map(normalizeImportHeader));
    return cells.some((cell) => normalizedAliases.has(normalizeImportHeader(cell)));
  }

  function hasObjectColumn(row: any, aliases: string[]) {
    const normalizedAliases = new Set(aliases.map(normalizeImportHeader));
    return Object.keys(row || {}).some((key) => normalizedAliases.has(normalizeImportHeader(key)));
  }

  function sheetToImportRows(XLSX: any, sheet: any) {
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[];
    const headerAliases = [
      'OFICIAL',
      'FECHA',
      'EXPEDIENTE',
      'ID_MESA',
      'ID MESA',
      'MESA',
      'NOMBRE MESA',
      'MESA TRAMITE',
      'MESA DE TRAMITE',
    ];
    const headerIndex = matrix.findIndex((row: any) =>
      hasImportColumn(row, headerAliases)
    );

    if (headerIndex < 0) {
      return XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[];
    }

    const headers = matrix[headerIndex].map((header: any, index: number) => {
      const value = String(header || '').trim();
      return value || `COLUMNA_${index + 1}`;
    });

    return matrix.slice(headerIndex + 1)
      .filter((row: any) => row.some((cell: any) => String(cell || '').trim()))
      .map((row: any) => headers.reduce((acc: any, header: string, index: number) => {
        acc[header] = row[index] ?? '';
        return acc;
      }, {}));
  }

  // Excel file import handler
  async function handleExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingExcel(true);
    setImportSummary(null);
    setShowImportErrorsModal(false);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      if (workbook.SheetNames.length === 0) {
        throw new Error('El archivo Excel no contiene hojas.');
      }
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = sheetToImportRows(XLSX, firstSheet);

      const isAssignmentImport = rows.some((row: any) => hasObjectColumn(row, ['EXPEDIENTE']));
      const res = isAssignmentImport
        ? await window.api.importMesaAssignments(rows)
        : await window.api.importMesasCatalog(rows);
      setImportSummary(res);
      setShowImportErrorsModal((res.errors || []).length > 0);
      await loadMesas();
      if (isAssignmentImport) {
        await loadExpedientes();
      }
      if (res.totalErrors > 0) {
        toastWarning('Importación con observaciones', `Se procesaron ${res.totalUpdated || 0} fila(s). ${res.totalErrors} fila(s) no se actualizaron.`);
      } else if (isAssignmentImport) {
        toastSuccess('Importación completada', `Se asignaron ${res.totalUpdated || 0} expediente(s).`);
      } else {
        toastSuccess('Importación completada', `Se importaron ${res.totalCreated || 0} mesa(s) nueva(s) y se actualizaron ${res.totalUpdated || 0}.`);
      }
    } catch (err: any) {
      showStyledAlert({
        title: 'Error de Importación',
        text: err.message || 'No se pudo leer o procesar el archivo Excel.',
        icon: 'error'
      });
    } finally {
      setImportingExcel(false);
      e.target.value = ''; // Reset input
    }
  }

  // Filtered mesas in catalog grid
  const filteredMesas = mesas.filter(m => 
    m.MESA.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.NOMBRE.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Search filtered compliance row in reassign search
  const reassignFiltered = reassignSearch.trim().length >= 2 
    ? expedientes.filter(exp => 
        String(exp.numeroJuicio || '').toLowerCase().includes(reassignSearch.toLowerCase())
      ).slice(0, 10)
    : [];
  const historyPageCount = Math.max(Math.ceil(historyTotal / historyPageSize), 1);
  const historyFrom = historyTotal === 0 ? 0 : historyPage * historyPageSize + 1;
  const historyTo = Math.min((historyPage + 1) * historyPageSize, historyTotal);

  if (!can('view.mesas')) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-card border border-border rounded-xl">
        <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
        <h3 className="text-lg font-bold text-slate-800">Acceso Denegado</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          No cuentas con los permisos correspondientes para visualizar o administrar las mesas de trámite.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col gap-4 overflow-hidden">
      {/* Navigation tabs */}
      <div className="flex flex-shrink-0 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('catalogo')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'catalogo'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <TableProperties className="w-4 h-4" />
          Catálogo de Mesas
        </button>
        { false && can('mesas.reassign') && (
          <button
            onClick={() => setActiveTab('asignacion')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'asignacion'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Shuffle className="w-4 h-4" />
            Asignación de Mesas
          </button>
        )}
        { can('mesas.history') && (
          <button
            onClick={() => setActiveTab('historial')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'historial'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <History className="w-4 h-4" />
            Historial de Asignaciones
          </button>
        )}
      </div>

      {/* Tab content 1: Catalog */}
      {activeTab === 'catalogo' && (
        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
          <div className="bg-card rounded-xl border border-border p-4 flex-shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-[260px] flex-1 items-center gap-3">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Buscar por mesa o encargado..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-input-background border border-input rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {can('mesas.import') && (
                  <label
                    className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold text-white shadow-sm transition-colors ${
                      importingExcel ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:brightness-95'
                    }`}
                    style={{
                      backgroundColor: '#047857',
                      border: '1px solid #065f46',
                      boxShadow: '0 2px 6px rgba(4, 120, 87, 0.24)',
                    }}
                  >
                    {importingExcel ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        Importando...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 text-white" />
                        IMPORTAR EXCEL
                      </>
                    )}
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleExcelImport}
                      disabled={importingExcel}
                      className="hidden"
                    />
                  </label>
                )}
                {can('mesas.auto_assign') && (
                  <button
                    onClick={handleAutoAssign}
                    disabled={autoAssigning}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-70 hover:brightness-95"
                    style={{
                      backgroundColor: '#4338ca',
                      border: '1px solid #3730a3',
                      boxShadow: '0 2px 6px rgba(67, 56, 202, 0.24)',
                    }}
                  >
                    {autoAssigning ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        Asignando...
                      </>
                    ) : (
                      <>
                        <Shuffle className="w-4 h-4 text-white" />
                        EJECUTAR ASIGNACIÓN AUTOMÁTICA
                      </>
                    )}
                  </button>
                )}
                {can('mesas.reassign') && (
                  <button
                    onClick={openReassignModal}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold text-white shadow-sm transition-colors hover:brightness-95"
                    style={{
                      backgroundColor: '#334155',
                      border: '1px solid #1e293b',
                      boxShadow: '0 2px 6px rgba(51, 65, 85, 0.20)',
                    }}
                  >
                    <Edit className="w-4 h-4 text-white" />
                    REASIGNAR
                  </button>
                )}
                {can('mesas.create') && (
                  <button
                    onClick={openCreate}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    NUEVA MESA
                  </button>
                )}
              </div>
            </div>
            {importSummary && (
              <div className={`mt-3 rounded-lg border px-3 py-3 text-xs ${
                (importSummary.totalErrors || 0) > 0
                  ? 'border-red-200 bg-red-50 text-red-800'
                  : 'border-green-200 bg-green-50 text-green-800'
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-bold">Resumen de importación:</span>
                    <span>{importSummary.totalRead || 0} leído(s)</span>
                    <span>{importSummary.totalCreated || 0} nuevo(s)</span>
                    <span>{importSummary.totalUpdated || 0} actualizado(s)</span>
                    <span>{importSummary.totalErrors || 0} no actualizada(s)</span>
                  </div>

                  {(importSummary.errors || []).length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowImportErrorsModal(true)}
                      className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-red-300 bg-white px-3 text-xs font-bold text-red-700 shadow-sm transition-colors hover:bg-red-100"
                    >
                      <AlertCircle className="h-3.5 w-3.5" />
                      Ver no actualizadas
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden flex-1 min-h-0 flex flex-col">
            {loading ? (
              <div className="flex flex-1 min-h-0 items-center justify-center p-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-auto">
                <table className="w-full min-w-[760px] text-xs border-collapse">
                  <thead className="bg-[#1e40af] text-white sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px] w-20">ID_MESA</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px] w-72">Mesa</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">Encargado / Nombre</th>
                      <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider text-[10px] w-[36rem]">Estado</th>
                      {(can('mesas.edit') || can('mesas.delete')) && <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider text-[10px] w-32">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredMesas.map((mesa) => (
                      <tr key={mesa.ID_MESA} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-600">{mesa.ID_MESA}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{mesa.MESA}</td>
                        <td className="px-4 py-3 text-muted-foreground">{mesa.NOMBRE || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleToggleActivo(mesa)}
                            disabled={!can('mesas.edit')}
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold border transition-colors ${
                              mesa.ACTIVO === 1
                                ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                            } disabled:opacity-85 disabled:hover:bg-green-50`}
                          >
                            {mesa.ACTIVO === 1 ? (
                              <>
                                <CheckCircle className="w-3.5 h-3.5" />
                                Activa
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3.5 h-3.5" />
                                Inactiva
                              </>
                            )}
                          </button>
                        </td>
                        {(can('mesas.edit') || can('mesas.delete')) && (
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {can('mesas.edit') && <button
                                onClick={() => openEdit(mesa)}
                                className="p-1.5 hover:bg-blue-100 text-blue-600 rounded-md transition-colors inline-flex"
                                title="Editar Mesa"
                              >
                                <Edit className="w-4 h-4" />
                              </button>}
                              {can('mesas.delete') && <button
                                onClick={() => handleDeleteMesa(mesa)}
                                className="p-1.5 hover:bg-red-100 text-red-600 rounded-md transition-colors inline-flex"
                                title="Eliminar Mesa"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                    {filteredMesas.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                          No se encontraron mesas de trámite.
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

      {/* Tab content 2: Assignments */}
      {activeTab === 'asignacion' && (
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="grid grid-cols-1 gap-6">
          {/* Left panel: Auto Assign & Import */}
          <div className="hidden">
            {can('mesas.import') && (
              <div className="bg-card rounded-xl border border-border p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-green-600" />
                  <h3 className="text-sm font-bold text-slate-800">Importar Asignaciones desde Excel</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sube un archivo de Excel con los encabezados obligatorios <strong>EXPEDIENTE</strong> e <strong>ID_MESA</strong> para asignar o reasignar mesas masivamente.
                </p>
                <div className="flex items-center justify-start gap-4 pt-1">
                  <label
                    className={`inline-flex items-center justify-center gap-2 rounded-lg text-xs font-bold transition-colors shadow-sm ${
                      importingExcel ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:brightness-95'
                    }`}
                    style={{
                      minHeight: 36,
                      padding: '0 16px',
                      backgroundColor: '#047857',
                      color: '#ffffff',
                      border: '1px solid #065f46',
                      boxShadow: '0 2px 6px rgba(4, 120, 87, 0.24)',
                    }}
                  >
                    {importingExcel ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        Procesando Excel...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 text-white" />
                        Seleccionar Archivo Excel
                      </>
                    )}
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleExcelImport}
                      disabled={importingExcel}
                      className="hidden"
                    />
                  </label>
                </div>

                {importSummary && (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                    <h4 className="text-xs font-bold text-slate-700">Resumen de Importación</h4>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 bg-white rounded border border-slate-200">
                        <p className="text-[10px] text-muted-foreground uppercase">Leídos</p>
                        <p className="text-sm font-bold text-slate-800">{importSummary.totalRead}</p>
                      </div>
                      <div className="p-2 bg-green-50 rounded border border-green-100">
                        <p className="text-[10px] text-green-600 uppercase">Actualizados</p>
                        <p className="text-sm font-bold text-green-700">{importSummary.totalUpdated}</p>
                      </div>
                      <div className="p-2 bg-red-50 rounded border border-red-100">
                        <p className="text-[10px] text-red-500 uppercase">No actualizadas</p>
                        <p className="text-sm font-bold text-red-700">{importSummary.totalErrors}</p>
                      </div>
                    </div>
                    {importSummary.errors.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-red-600">Filas no actualizadas:</p>
                        <div className="max-h-36 overflow-y-auto text-[10px] bg-red-50 p-2 rounded border border-red-100 font-mono space-y-1">
                          {importSummary.errors.map((err: any, idx: number) => (
                            <div key={idx} className="border-b border-red-100 pb-1">
                              <strong>Fila {err.fila}:</strong> Exp: {err.expediente || 'N/A'}, ID: {err.idMesa || 'N/A'} - <span className="text-red-700">{err.motivo}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {can('mesas.auto_assign') && (
              <div className="bg-card rounded-xl border border-border p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <Shuffle className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-800">Asignación Automática Equitativa</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Distribuye de forma balanceada los expedientes activos sin mesa en dos procesos: primero los que se están requiriendo y después los que tienen fecha de vista con semáforo apagado.
                </p>
                <button
                  onClick={handleAutoAssign}
                  disabled={autoAssigning}
                  className="inline-flex items-center justify-center gap-2 rounded-lg text-xs font-bold transition-colors shadow-sm disabled:cursor-not-allowed disabled:opacity-70 hover:brightness-95"
                  style={{
                    minHeight: 38,
                    padding: '0 16px',
                    backgroundColor: '#4338ca',
                    color: '#ffffff',
                    border: '1px solid #3730a3',
                    boxShadow: '0 2px 6px rgba(67, 56, 202, 0.24)',
                  }}
                >
                  {autoAssigning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      Calculando Asignaciones...
                    </>
                  ) : (
                    <>
                      <Shuffle className="w-4 h-4 text-white" />
                      Ejecutar Asignación Automática
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Right panel: Reassign manually */}
          {can('mesas.reassign') && (
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <div className="flex items-center gap-3">
                <Edit className="w-5 h-5 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-800">Reasignar Mesa a Expediente</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Busca un expediente de forma individual para cambiar o asignar manualmente su mesa de trámite.
              </p>

              <form onSubmit={handleReassignSubmit} className="space-y-4">
                <div className="relative">
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Buscar Expediente (Juicio)</label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Escribe el No. de Juicio o Expediente..."
                      value={reassignSearch}
                      onChange={(e) => {
                        setReassignSearch(e.target.value);
                        if (selectedExpediente) {
                          setSelectedExpediente(null);
                          setTargetMesaId('');
                          setShowTargetMesaCombo(false);
                          setReassignMotivo('');
                        }
                      }}
                      className="w-full pl-9 pr-3 py-2 bg-input-background border border-input rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  {reassignFiltered.length > 0 && !selectedExpediente && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 divide-y divide-slate-100 overflow-hidden">
                      {reassignFiltered.map((exp) => (
                        <button
                          key={exp.id}
                          type="button"
                          onClick={() => {
                            setSelectedExpediente(exp);
                            setTargetMesaId(String(exp.idMesa || ''));
                            setReassignMotivo(exp.observacionesMesa || '');
                            setReassignSearch(exp.numeroJuicio);
                          }}
                          className="w-full px-4 py-2 text-left text-xs hover:bg-slate-50 flex justify-between items-center"
                        >
                          <span className="font-bold text-slate-800">{exp.numeroJuicio}</span>
                          <span className="text-[10px] text-muted-foreground bg-slate-100 px-2 py-0.5 rounded">
                            Mesa: {mesas.find(m => Number(m.ID_MESA) === Number(exp.idMesa))?.MESA || 'Ninguna'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedExpediente && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 space-y-4 animate-fadeIn">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase">Orden</p>
                        <p className="font-bold text-slate-800">{selectedExpediente.numeroOrden || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase">Juicio/Expediente</p>
                        <p className="font-bold text-slate-800">{selectedExpediente.numeroJuicio}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[10px] text-slate-500 uppercase">Mesa Actual</p>
                        <p className="font-bold text-slate-800">
                          {mesas.find(m => Number(m.ID_MESA) === Number(selectedExpediente.idMesa))?.MESA || 'Sin mesa asignada'} 
                          {selectedExpediente.idMesa ? ` (${mesas.find(m => Number(m.ID_MESA) === Number(selectedExpediente.idMesa))?.NOMBRE || 'Sin encargado'})` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="module-field">
                      <label className="module-label">Seleccionar Nueva Mesa</label>
                      <select
                        value={targetMesaId}
                        onChange={(e) => setTargetMesaId(e.target.value)}
                        className="module-select bg-white"
                        required
                      >
                        <option value="">Seleccione una mesa...</option>
                        {mesas.filter(m => m.ACTIVO === 1 || Number(m.ID_MESA) === Number(selectedExpediente.idMesa)).map(m => (
                          <option key={m.ID_MESA} value={m.ID_MESA}>
                            {m.MESA} - {m.NOMBRE || 'Sin encargado'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="module-field">
                      <label className="module-label">Motivo o Observaciones de la Reasignación</label>
                      <textarea
                        value={reassignMotivo}
                        onChange={(e) => setReassignMotivo(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 h-16"
                        placeholder="Escribe el motivo del cambio..."
                        required
                      />
                    </div>

                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedExpediente(null);
                          setReassignSearch('');
                          setTargetMesaId('');
                          setReassignMotivo('');
                        }}
                        className="px-4 py-2 bg-slate-200 text-slate-700 rounded-md text-xs font-bold hover:bg-slate-300 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={reassignSaving}
                        className="flex items-center gap-1.5 px-4 py-2 bg-[#1e40af] text-white rounded-md text-xs font-bold hover:bg-blue-800 transition-colors disabled:opacity-50"
                      >
                        {reassignSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Guardar Reasignación
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>
          )}
          </div>
        </div>
      )}

      {/* Tab content 3: History */}
      {activeTab === 'historial' && (
        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
          <div className="bg-card rounded-xl border border-border p-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filtrar por número de expediente/juicio..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadHistory(0)}
                  className="w-full pl-9 pr-3 py-2 bg-input-background border border-input rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <button
                onClick={() => loadHistory(0)}
                disabled={loadingHistory}
                className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                Buscar
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
              <span>
                Mostrando <strong>{historyFrom}-{historyTo}</strong> de <strong>{historyTotal}</strong> registros de hoy. Se cargan {historyPageSize} por página.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadHistory(Math.max(historyPage - 1, 0))}
                  disabled={loadingHistory || historyPage === 0}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="min-w-24 text-center font-semibold text-slate-700">
                  Página {historyPage + 1} de {historyPageCount}
                </span>
                <button
                  type="button"
                  onClick={() => loadHistory(historyPage + 1)}
                  disabled={loadingHistory || historyPage + 1 >= historyPageCount}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden flex-1 min-h-0 flex flex-col">
            {loadingHistory ? (
              <div className="flex flex-1 min-h-0 items-center justify-center p-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-auto">
                <table className="w-full min-w-[980px] text-xs border-collapse">
                  <thead className="bg-[#1e40af] text-white font-semibold sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">Expediente</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">Mesa Anterior</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">Mesa Nueva</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">Usuario</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">Motivo / Comentarios</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px] w-40">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {historyList.map((hist) => (
                      <tr key={hist.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-800">{hist.expediente}</td>
                        <td className="px-4 py-3 text-slate-500 font-medium">{hist.mesaAnteriorNombre}</td>
                        <td className="px-4 py-3 text-blue-700 font-bold">{hist.mesaNuevaNombre}</td>
                        <td className="px-4 py-3 text-muted-foreground">{hist.usuarioNombre}</td>
                        <td className="px-4 py-3 text-slate-600">{hist.motivo || '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{new Date(hist.fechaReasignacion).toLocaleString()}</td>
                      </tr>
                    ))}
                    {historyList.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                          No se encontraron registros en el historial de asignaciones.
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

      {/* Import Errors Modal */}
      {showImportErrorsModal && importSummary && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{
            zIndex: 2147483000,
            backgroundColor: 'rgba(15, 23, 42, 0.56)',
            padding: 24,
          }}
          onClick={() => setShowImportErrorsModal(false)}
        >
          <div
            className="overflow-hidden bg-white"
            style={{
              width: 'min(1180px, 82vw)',
              border: '1px solid #cbd5e1',
              borderRadius: 10,
              boxShadow: '0 24px 80px rgba(15, 23, 42, 0.34)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between gap-4"
              style={{
                minHeight: 62,
                padding: '0 20px',
                backgroundColor: '#fff1f1',
                borderBottom: '1px solid #fecaca',
              }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-red-100 text-red-700">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800">Filas no actualizadas</h3>
                  <p className="mt-0.5 text-xs font-medium text-slate-600">
                    {(importSummary.errors || []).length} fila(s) no se actualizaron de {importSummary.totalRead || 0} fila(s) leída(s). Las demás sí fueron procesadas.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportErrorsModal(false)}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-200"
                aria-label="Cerrar filas no actualizadas"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div style={{ padding: 16, backgroundColor: '#ffffff' }}>
              <div
                className="overflow-x-auto"
                style={{
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                }}
              >
                <div style={{ minWidth: 900 }}>
                  <div
                    className="grid text-xs font-bold text-white"
                    style={{
                      gridTemplateColumns: '96px 180px 140px 190px minmax(320px, 1fr)',
                      height: 44,
                      alignItems: 'center',
                      backgroundColor: '#b91c1c',
                    }}
                  >
                    <div className="px-4">Fila</div>
                    <div className="px-4">Expediente</div>
                    <div className="px-4">ID_MESA</div>
                    <div className="px-4">Oficial/Mesa</div>
                    <div className="px-4">Motivo</div>
                  </div>

                  <div
                    className="overflow-y-auto"
                    style={{
                      height: 220,
                      backgroundColor: '#ffffff',
                    }}
                  >
                    {(importSummary.errors || []).map((err: any, idx: number) => (
                      <div
                        key={idx}
                        className="grid border-b border-slate-100 text-xs hover:bg-red-50/60"
                        style={{
                          gridTemplateColumns: '96px 180px 140px 190px minmax(320px, 1fr)',
                          minHeight: 44,
                          alignItems: 'center',
                        }}
                      >
                        <div className="px-4 font-mono text-red-700">{err.fila || 'N/A'}</div>
                        <div className="px-4 font-bold text-slate-900">{err.expediente || 'N/A'}</div>
                        <div className="px-4 font-mono text-slate-700">{err.idMesa || 'N/A'}</div>
                        <div className="px-4 font-semibold text-slate-700">{err.mesa || 'N/A'}</div>
                        <div className="px-4 text-red-700">{err.motivo || 'Motivo no especificado.'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div
              className="flex justify-end gap-3"
              style={{
                padding: '14px 20px',
                backgroundColor: '#f8fafc',
                borderTop: '1px solid #cbd5e1',
              }}
            >
              <button
                type="button"
                onClick={() => setShowImportErrorsModal(false)}
                className="rounded-md border border-slate-300 bg-white px-8 py-2 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-100"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Mesa Modal */}
      {showReassignModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[99999] flex items-center justify-center p-4" onClick={() => setShowReassignModal(false)}>
          <div
            className="bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 640 }}
          >
            <div className="flex items-center justify-between px-5 py-4 bg-[#1e40af] text-white rounded-t-xl shrink-0">
              <h3 className="text-sm font-bold tracking-wide uppercase flex items-center gap-2">
                <Edit className="w-4 h-4 text-blue-200" />
                Reasignar Mesa
              </h3>
              <button
                type="button"
                onClick={() => setShowReassignModal(false)}
                className="p-1 hover:bg-white/15 rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReassignSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 bg-white">
                
                {/* Buscar Expediente */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Buscar Expediente (Juicio)</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input 
                      value={reassignSearch} 
                      onChange={(e) => { 
                        setReassignSearch(e.target.value); 
                        if (selectedExpediente) {
                          setSelectedExpediente(null);
                          setTargetMesaId('');
                          setShowTargetMesaCombo(false);
                          setReassignMotivo('');
                        }
                      }} 
                      placeholder="Escribe el No. de Juicio o Expediente..." 
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af] transition-all shadow-sm" 
                      required 
                    />
                    {reassignFiltered.length > 0 && !selectedExpediente && (
                      <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                        {reassignFiltered.map((exp) => (
                          <button 
                            key={exp.id} 
                            type="button" 
                            onClick={() => { 
                              setSelectedExpediente(exp); 
                              setReassignSearch(exp.numeroJuicio); 
                              setTargetMesaId(exp.idMesa ? String(exp.idMesa) : ''); 
                              setReassignMotivo(exp.observacionesMesa || ''); 
                            }} 
                            className="flex w-full items-center justify-between gap-4 px-4 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-blue-50 hover:text-[#1e40af]"
                          >
                            <span className="font-semibold">{exp.numeroJuicio}</span>
                            <span className="text-xs text-slate-500">
                              Mesa: {mesas.find(m => Number(m.ID_MESA) === Number(exp.idMesa))?.MESA || 'Ninguna'}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Static Info Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Orden</span>
                      <span className="text-xs font-semibold text-slate-700">{selectedExpediente?.numeroOrden || '-'}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Juicio/Exp</span>
                      <span className="text-[13px] font-bold text-[#1e40af]">{selectedExpediente?.numeroJuicio || '-'}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mesa Actual</span>
                      <span className="text-xs font-semibold text-slate-700">{selectedExpediente ? (mesas.find(m => Number(m.ID_MESA) === Number(selectedExpediente.idMesa))?.MESA || 'Sin mesa') : '-'}</span>
                    </div>
                  </div>
                </div>

                {/* Nueva Mesa */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Seleccionar Nueva Mesa</label>
                  <div className="relative">
                    <select 
                      value={targetMesaId} 
                      onChange={(e) => setTargetMesaId(e.target.value)} 
                      className="h-11 w-full appearance-none rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af] transition-all shadow-sm" 
                      required
                    >
                      <option value="">Seleccione una mesa...</option>
                      {mesas.filter(m => m.ACTIVO === 1 || Number(m.ID_MESA) === Number(selectedExpediente?.idMesa)).map(m => (
                        <option key={m.ID_MESA} value={m.ID_MESA}>{m.MESA} - {m.NOMBRE || 'Sin encargado'}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                {/* Observaciones */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Motivo u Observaciones</label>
                  <textarea 
                    value={reassignMotivo} 
                    onChange={(e) => setReassignMotivo(e.target.value)} 
                    placeholder="Escribe el motivo del cambio..." 
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af] transition-all shadow-sm placeholder:text-slate-300" 
                    style={{ height: '100px' }}
                    required 
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-white rounded-b-xl shrink-0">
                <button
                  type="submit"
                  disabled={reassignSaving || !selectedExpediente}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#1e40af] text-white rounded-lg text-sm font-semibold hover:bg-blue-800 transition-colors disabled:opacity-50 shadow-sm"
                >
                  {reassignSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar Reasignación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Mesa Modal */}
      {deletingMesa && createPortal(
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
                ¿Eliminar {deletingMesa.MESA}?
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 bg-slate-50 p-4">
              <button
                type="button"
                onClick={() => setDeletingMesa(null)}
                disabled={deletingMesaSaving}
                className="h-12 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteMesa}
                disabled={deletingMesaSaving}
                className="flex h-12 items-center justify-center gap-2 rounded-lg bg-red-600 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deletingMesaSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Create / Edit Mesa Modal */}
      {showMesaModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[99999] flex items-center justify-center p-4" onClick={() => setShowMesaModal(false)}>
          <div
            className="bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 512 }}
          >
            <div className="flex items-center justify-between px-5 py-4 bg-[#1e40af] text-white rounded-t-xl shrink-0">
              <h3 className="text-sm font-bold tracking-wide uppercase flex items-center gap-2">
                {editingMesa ? 'Editar Mesa de Trámite' : 'Nueva Mesa de Trámite'}
              </h3>
              <button
                type="button"
                onClick={() => setShowMesaModal(false)}
                className="p-1 hover:bg-white/15 rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleMesaSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 bg-white">
                
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Mesa (Clave / Nombre)</label>
                  <input
                    type="text"
                    value={formMesa}
                    onChange={(e) => setFormMesa(e.target.value)}
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-700 uppercase font-bold focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af] transition-all shadow-sm"
                    placeholder="E.g. MESA I, MESA A, MESA 1"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre del Responsable / Encargado</label>
                  <input
                    type="text"
                    value={formNombre}
                    onChange={(e) => setFormNombre(e.target.value)}
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af] transition-all shadow-sm"
                    placeholder="Nombre completo"
                  />
                </div>

                {editingMesa && (
                  <div className="flex items-center gap-3 mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg shadow-sm">
                    <input
                      type="checkbox"
                      id="form-activo-mesa"
                      checked={formActivo}
                      onChange={(e) => setFormActivo(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-[#1e40af] focus:ring-[#1e40af]"
                    />
                    <label htmlFor="form-activo-mesa" className="text-[11px] font-bold text-slate-700 cursor-pointer uppercase tracking-wider">
                      Mesa activa para asignaciones automáticas
                    </label>
                  </div>
                )}

                {modalError && (
                  <div className="flex items-center gap-2 p-3 mt-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-semibold shadow-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{modalError}</span>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-white rounded-b-xl shrink-0">
                <button
                  type="submit"
                  disabled={savingMesa}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#1e40af] text-white rounded-lg text-sm font-semibold hover:bg-blue-800 transition-colors disabled:opacity-50 shadow-sm"
                >
                  {savingMesa ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar Mesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  );
}

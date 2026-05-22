import { useEffect, useMemo, useState } from 'react';
import logoImg from '@/assets/Cumplisent.png';
import {
  Calendar,
  CheckCircle,
  ChevronLeft,
  CircleHelp,
  Edit,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Server,
  Shield,
  Upload,
  Users,
  X,
} from 'lucide-react';
import CumplimientosExcel from './components/CumplimientosExcel';
import LoginScreen from './components/LoginScreen';
import ServerConfig from './components/ServerConfig';
import UserManagement from './components/UserManagement';
import RolePermissions from './components/RolePermissions';
import { confirmAlert, showStyledAlert } from './utils/alert';
import { toastError, toastSuccess, toastWarning } from './utils/toast';

interface Expediente {
  id: string;
  numeroJuicio: string;
  materia: string;
  fechaVista: string;
  fechaCumplimiento: string;
  fechaArchivo: string;
  actualizado: string;
  localizado: boolean;
  estatus: number | string;
  diasHabilesTranscurridos: number | string;
}

interface DiaInhabil {
  id: string;
  fecha: string;
}

type ViewKey = 'dashboard' | 'cumplimientos' | 'procesar' | 'dias-inhabiles' | 'servidor' | 'usuarios' | 'roles';

const VIEW_TITLES: Record<ViewKey, string> = {
  dashboard: 'Dashboard',
  cumplimientos: 'Cumplimientos',
  procesar: 'Normalización de la información',
  'dias-inhabiles': 'Días inhábiles',
  servidor: 'Servidor',
  usuarios: 'Usuarios',
  roles: 'Roles y permisos',
};

const VIEW_PERMISSIONS: Record<ViewKey, string> = {
  dashboard: 'view.dashboard',
  cumplimientos: 'view.cumplimientos',
  procesar: 'view.procesar',
  'dias-inhabiles': 'view.dias_inhabiles',
  servidor: 'view.servidor',
  usuarios: 'view.usuarios',
  roles: 'view.roles',
};

function getBackend() {
  return window.cumplimientosBackend;
}

function formatDate(value: string | boolean) {
  if (!value || typeof value === 'boolean') return '-';
  const iso = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const mx = String(value).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (mx) return `${mx[1].padStart(2, '0')}/${mx[2].padStart(2, '0')}/${mx[3].padStart(4, '20')}`;
  return String(value);
}

function numberValue(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function bandFromStatus(estatus: unknown, dias: unknown) {
  const n = numberValue(estatus) ?? numberValue(dias);
  if (n === null) return 'Sin estatus';
  if (n <= 3) return 'En plazo';
  if (n <= 6) return 'Atención';
  if (n <= 9) return 'Requerir';
  return 'Vencido';
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
        active ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      } ${collapsed ? 'justify-center' : ''}`}
    >
      {icon}
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

function DashboardView({ expedientes, diasInhabiles }: { expedientes: Expediente[]; diasInhabiles: DiaInhabil[] }) {
  const stats = useMemo(() => {
    const byBand = (label: string) => expedientes.filter((exp) => bandFromStatus(exp.estatus, exp.diasHabilesTranscurridos) === label).length;
    return {
      total: expedientes.length,
      enPlazo: byBand('En plazo'),
      atencion: byBand('Atención'),
      requerir: byBand('Requerir'),
      vencido: byBand('Vencido'),
      noLocalizados: expedientes.filter((exp) => !exp.localizado).length,
    };
  }, [expedientes]);

  const cards = [
    ['Total expedientes', stats.total, 'bg-blue-50 text-blue-700 border-blue-100'],
    ['En plazo', stats.enPlazo, 'bg-emerald-50 text-emerald-700 border-emerald-100'],
    ['Atención', stats.atencion, 'bg-amber-50 text-amber-700 border-amber-100'],
    ['Requerir', stats.requerir, 'bg-rose-50 text-rose-700 border-rose-100'],
    ['Vencidos', stats.vencido, 'bg-red-50 text-red-700 border-red-100'],
    ['Días inhábiles', diasInhabiles.length, 'bg-slate-50 text-slate-700 border-slate-100'],
  ] as const;

  return (
    <div className="h-full min-h-0 overflow-auto space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {cards.map(([label, value, className]) => (
          <div key={label} className={`rounded-lg border p-4 ${className}`}>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</p>
            <p className="text-3xl font-bold mt-2">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="font-semibold mb-3">Actualizados recientemente</h3>
        <div className="space-y-2 text-sm">
          {expedientes.filter((exp) => exp.actualizado).slice(0, 10).map((exp) => (
            <div key={exp.id} className="flex items-center justify-between gap-3 border-b border-border/50 pb-2">
              <span className="font-medium truncate">{exp.numeroJuicio}</span>
              <span className="text-muted-foreground">{formatDate(exp.actualizado)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProcesarView() {
  return (
    <div className="h-full min-h-0 rounded-lg border border-border bg-card p-6">
      <div className="max-w-2xl">
        <div className="h-10 w-10 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center mb-4">
          <Upload className="w-5 h-5" />
        </div>
        <h2 className="text-xl font-bold mb-2">Normalización de la información</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          La gestión principal de expedientes, importación y actualización se encuentra en la vista Cumplimientos.
        </p>
      </div>
    </div>
  );
}

function DiasInhabilesView({
  diasInhabiles,
  setDiasInhabiles,
  canManage,
}: {
  diasInhabiles: DiaInhabil[];
  setDiasInhabiles: (dias: DiaInhabil[]) => void;
  canManage: boolean;
}) {
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [importingExcel, setImportingExcel] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [importError, setImportError] = useState('');
  const [diaEditando, setDiaEditando] = useState<DiaInhabil | null>(null);
  const [fechaEditando, setFechaEditando] = useState('');
  const [showImportHelp, setShowImportHelp] = useState(false);

  const persistDias = (dias: DiaInhabil[]) => {
    const ordered = [...dias].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    setDiasInhabiles(ordered);
    getBackend().replaceInhabiles(ordered)
      .then((rows) => {
        if (Array.isArray(rows)) setDiasInhabiles(rows);
        toastSuccess('Calendario guardado', 'Los días inhábiles se sincronizaron correctamente.');
      })
      .catch((error) => {
        toastError('Error al guardar calendario', error instanceof Error ? error.message : 'No se pudieron guardar los días inhábiles.');
      });
  };

  const handleAgregar = () => {
    if (!nuevaFecha) {
      toastWarning('Fecha requerida', 'Selecciona una fecha para agregar.');
      return;
    }
    if (diasInhabiles.some((dia) => dia.fecha === nuevaFecha)) {
      toastWarning('Fecha duplicada', 'El día inhábil ya está registrado.');
      return;
    }
    persistDias([...diasInhabiles, { id: `manual-${Date.now()}`, fecha: nuevaFecha }]);
    setNuevaFecha('');
  };

  const handleEliminar = async (dia: DiaInhabil) => {
    const confirmed = await confirmAlert({
      title: 'Eliminar día inhábil',
      text: `Se eliminara ${formatDate(dia.fecha)} del calendario.`,
      confirmText: 'Si, eliminar',
      cancelText: 'Cancelar',
      icon: 'warning',
    });
    if (confirmed) persistDias(diasInhabiles.filter((item) => item.id !== dia.id));
  };

  const handleGuardarEdicion = () => {
    if (!diaEditando || !fechaEditando) {
      toastWarning('Fecha requerida', 'Selecciona una fecha valida para guardar.');
      return;
    }
    if (diasInhabiles.some((dia) => dia.id !== diaEditando.id && dia.fecha === fechaEditando)) {
      toastWarning('Fecha duplicada', 'El día inhábil ya está registrado.');
      return;
    }
    persistDias(diasInhabiles.map((dia) => (dia.id === diaEditando.id ? { ...dia, fecha: fechaEditando } : dia)));
    setDiaEditando(null);
    setFechaEditando('');
  };

  const normalizeHeader = (value: unknown) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  const parseExcelDate = (value: unknown, XLSX: typeof import('xlsx')) => {
    if (!value) return '';
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    }
    if (typeof value === 'number') {
      const parsed = XLSX.SSF.parse_date_code(value);
      return parsed ? `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}` : '';
    }
    const text = String(value).trim();
    const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
    const mx = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (!mx) return '';
    return `${mx[3].length === 2 ? `20${mx[3]}` : mx[3]}-${mx[2].padStart(2, '0')}-${mx[1].padStart(2, '0')}`;
  };

  const handleImportarExcel = async () => {
    if (!excelFile) return;
    setImportingExcel(true);
    setImportMessage('');
    setImportError('');

    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await excelFile.arrayBuffer(), { type: 'array', cellDates: true });
      let targetRows: unknown[][] = [];
      let headerRowIndex = -1;
      let targetColumnIndex = -1;

      for (const sheetName of workbook.SheetNames) {
        const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, raw: true, defval: '' });
        for (let rowIndex = 0; rowIndex < Math.min(rows.length, 25); rowIndex += 1) {
          const columnIndex = rows[rowIndex].findIndex((value) => {
            const header = normalizeHeader(value);
            return header.includes('diasinhabiles') || header.includes('diainhabil');
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
        setImportMessage('No se encontraron fechas nuevas para importar.');
        toastWarning('Sin fechas nuevas', 'No se encontraron días inhábiles nuevos para importar.');
        return;
      }

      persistDias([...diasInhabiles, ...importedDays]);
      setImportMessage(`Se importaron ${importedDays.length} días inhábiles.`);
      setExcelFile(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo importar el archivo Excel.';
      setImportError(message);
      showStyledAlert({ title: 'Error al importar', text: message, icon: 'error' });
    } finally {
      setImportingExcel(false);
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col gap-4">
      {canManage && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-shrink-0">
          <div className="bg-card rounded-lg border border-border p-4 min-w-0">
            <h3 className="font-semibold mb-3">Agregar Día Inhábil Manualmente</h3>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
              <div className="min-w-0">
                <input
                  type="date"
                  value={nuevaFecha}
                  onChange={(e) => setNuevaFecha(e.target.value)}
                  className="w-full px-3 py-2 bg-input-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleAgregar}
                  disabled={!nuevaFecha}
                  className="w-full md:w-auto px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg border border-border p-4 min-w-0 relative">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="font-semibold">Importar desde Excel</h3>
              <button
                type="button"
                onClick={() => setShowImportHelp(true)}
                className="h-7 w-7 flex items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-colors"
                title="Ver instrucción"
                aria-label="Ver instrucción para importar desde Excel"
              >
                <CircleHelp className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <label className="cursor-pointer flex-1 min-w-0">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.xlsm"
                    onChange={(event) => {
                      setExcelFile(event.target.files?.[0] || null);
                      setImportMessage('');
                      setImportError('');
                    }}
                    className="hidden"
                  />
                  <span className="inline-block w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors text-center text-sm border border-border truncate">
                    {excelFile ? excelFile.name : 'Seleccionar Archivo Excel'}
                  </span>
                </label>
                <button
                  onClick={handleImportarExcel}
                  disabled={!excelFile || importingExcel}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  {importingExcel ? 'Importando...' : 'Importar'}
                </button>
              </div>
              {importMessage && <p className="text-xs font-medium text-green-700">{importMessage}</p>}
              {importError && <p className="text-xs font-medium text-destructive">{importError}</p>}
            </div>
          </div>
        </div>
      )}

      {showImportHelp && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-card rounded-lg shadow-2xl border border-border overflow-hidden">
            <div className="px-4 py-3 bg-blue-600 text-white flex items-center justify-between">
              <h3 className="text-sm font-semibold">Instrucción</h3>
              <button
                type="button"
                onClick={() => setShowImportHelp(false)}
                className="p-1 hover:bg-white/15 rounded transition-colors"
                aria-label="Cerrar instrucción"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-foreground leading-relaxed">
                El sistema buscará automáticamente la columna "DÍAS INHÁBILES" en el archivo Excel y procesará las fechas encontradas.
              </p>
              <div className="flex justify-end mt-4">
                <button
                  type="button"
                  onClick={() => setShowImportHelp(false)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card rounded-lg border border-border p-4 flex-1 min-h-0 flex flex-col">
        <h3 className="font-semibold mb-3 flex-shrink-0">Días Inhábiles Registrados ({diasInhabiles.length})</h3>
        <div className="flex-1 min-h-0 overflow-auto border border-border/60 rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-[#1e40af] text-white sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">DÍAS INHÁBILES</th>
                {canManage && <th className="px-4 py-3 text-center font-semibold">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {diasInhabiles.map((dia, index) => (
                <tr key={dia.id} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/10'}>
                  <td className="px-4 py-3">{formatDate(dia.fecha)}</td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setDiaEditando(dia);
                            setFechaEditando(dia.fecha);
                          }}
                          className="p-1.5 hover:bg-primary/10 text-primary rounded transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEliminar(dia)}
                          className="p-1.5 hover:bg-destructive/10 text-destructive rounded transition-colors"
                          title="Eliminar"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
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
                  setFechaEditando('');
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
                  setFechaEditando('');
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
    </div>
  );
}

export default function App() {
  const [currentView, setCurrentView] = useState<ViewKey>('dashboard');
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [diasInhabiles, setDiasInhabiles] = useState<DiaInhabil[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [session, setSession] = useState<{ user: SessionUser; token?: string; apiUrl?: string } | null>(null);

  const isAdmin = session?.user?.Rol === 'ADMINISTRADOR';
  const permissions = session?.user?.Permisos || [];
  const can = (permission: string) => isAdmin || permissions.includes(permission);

  useEffect(() => {
    if (!session) return;

    getBackend().list()
      .then((rows) => Array.isArray(rows) && setExpedientes(rows))
      .catch(() => {});
    getBackend().listInhabiles()
      .then((rows) => Array.isArray(rows) && setDiasInhabiles(rows))
      .catch(() => {});
  }, [session]);

  useEffect(() => {
    if (!session) return;
    if (!can(VIEW_PERMISSIONS[currentView])) {
      const fallback = (Object.keys(VIEW_PERMISSIONS) as ViewKey[]).find((view) => can(VIEW_PERMISSIONS[view])) || 'dashboard';
      setCurrentView(fallback);
    }
  }, [currentView, session]);

  if (!session) {
    return <LoginScreen onLogin={(user, token, apiUrl) => setSession({ user, token, apiUrl })} />;
  }

  const navItems: Array<{ view: ViewKey; icon: React.ReactNode }> = [
    { view: 'dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { view: 'cumplimientos', icon: <FileText className="w-4 h-4" /> },
    { view: 'procesar', icon: <Upload className="w-4 h-4" /> },
    { view: 'dias-inhabiles', icon: <Calendar className="w-4 h-4" /> },
    { view: 'servidor', icon: <Server className="w-4 h-4" /> },
    { view: 'usuarios', icon: <Users className="w-4 h-4" /> },
    { view: 'roles', icon: <Shield className="w-4 h-4" /> },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className={`${sidebarOpen ? 'w-56 lg:w-64' : 'w-14'} bg-card border-r border-border transition-all duration-300 flex flex-col`}>
        <div className="p-3 border-b border-border flex items-center justify-between">
          {sidebarOpen && (
            <div className="flex items-center gap-2 min-w-0">
              <img src={logoImg} className="w-9 h-9 object-contain" alt="CumpliSent logo" />
              <h1 className="text-xl font-black tracking-tight truncate">
                <span className="text-[#0c2340]">Cumpli</span><span className="text-[#0066ff]">Sent</span>
              </h1>
            </div>
          )}
          <button onClick={() => setSidebarOpen((open) => !open)} className="p-1.5 hover:bg-accent rounded-md transition-colors">
            {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            can(VIEW_PERMISSIONS[item.view]) && (
              <NavItem
                key={item.view}
                icon={item.icon}
                label={VIEW_TITLES[item.view]}
                active={currentView === item.view}
                collapsed={!sidebarOpen}
                onClick={() => setCurrentView(item.view)}
              />
            )
          ))}
        </nav>

        <div className="border-t border-border p-3">
          {sidebarOpen && (
            <div className="mb-2 min-w-0">
              <p className="text-[11px] font-semibold truncate">{session.user.NombreCompleto || session.user.Usuario}</p>
              <p className="text-[10px] text-muted-foreground truncate">{session.user.Rol}</p>
            </div>
          )}
          <button
            onClick={() => {
              window.api.clearRemoteSession?.();
              setSession(null);
              setCurrentView('dashboard');
            }}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-3.5 h-3.5" />
            {sidebarOpen && 'Cerrar sesión'}
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4">
          <div className="min-w-0">
            <h2 className="font-bold truncate">{VIEW_TITLES[currentView]}</h2>
            <p className="text-[11px] text-muted-foreground truncate">Sistema de Control de Cumplimiento</p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            Sesión activa
          </div>
        </header>

        <section className="flex-1 min-h-0 p-4 bg-muted/20">
          {currentView === 'dashboard' && <DashboardView expedientes={expedientes} diasInhabiles={diasInhabiles} />}
          {currentView === 'cumplimientos' && <CumplimientosExcel permissions={permissions} isAdmin={isAdmin} />}
          {currentView === 'procesar' && <ProcesarView />}
          {currentView === 'dias-inhabiles' && (
            <DiasInhabilesView
              diasInhabiles={diasInhabiles}
              setDiasInhabiles={setDiasInhabiles}
              canManage={can('dias_inhabiles.manage')}
            />
          )}
          {currentView === 'servidor' && <ServerConfig canManage={isAdmin} />}
          {currentView === 'usuarios' && <UserManagement canCreate={isAdmin} canEdit={isAdmin} />}
          {currentView === 'roles' && <RolePermissions canCreate={isAdmin} canEdit={isAdmin} canAssignPermissions={isAdmin} />}
        </section>
      </main>
    </div>
  );
}

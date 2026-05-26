import { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Database,
  Power,
  PowerOff,
  Copy,
  Check,
  RefreshCw,
  Wifi,
  Globe,
  Monitor,
  Loader2,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { confirmAlert, showStyledAlert } from '../utils/alert';
import { toastSuccess } from '../utils/toast';

export default function ServerConfig({ canManage = true }: { canManage?: boolean }) {
  const [status, setStatus] = useState<{
    running: boolean;
    port: number | null;
    urls: NetworkUrl[];
  }>({ running: false, port: null, urls: [] });
  const [availablePorts, setAvailablePorts] = useState<number[]>([]);
  const [selectedPort, setSelectedPort] = useState(3000);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [copiedUrl, setCopiedUrl] = useState('');
  const [openPortDropdown, setOpenPortDropdown] = useState(false);
  const [databasePath, setDatabasePath] = useState('');

  const refreshStatus = useCallback(async () => {
    try {
      const s = await window.api.serverStatus();
      setStatus(s);
      if (s.port) setSelectedPort(s.port);
    } catch {
      // ignore
    }
  }, []);

  const scanPorts = useCallback(async () => {
    setScanning(true);
    try {
      const ports = await window.api.scanPorts();
      setAvailablePorts(ports);
      if (ports.length > 0 && !status.running) {
        setSelectedPort(ports[0]);
      }
    } catch {
      // ignore
    } finally {
      setScanning(false);
    }
  }, [status.running]);

  const refreshDatabasePath = useCallback(async () => {
    try {
      const path = await window.cumplimientosBackend.databasePath();
      setDatabasePath(path || '');
    } catch {
      setDatabasePath('');
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    scanPorts();
    refreshDatabasePath();
  }, [refreshStatus, scanPorts, refreshDatabasePath]);

  useEffect(() => {
    if (!openPortDropdown) return undefined;

    const closeDropdown = () => setOpenPortDropdown(false);
    window.addEventListener('click', closeDropdown);
    return () => window.removeEventListener('click', closeDropdown);
  }, [openPortDropdown]);

  async function handleToggleServer() {
    if (!canManage) return;
    setError('');
    setLoading(true);

    try {
      if (status.running) {
        const confirmed = await confirmAlert({
          title: 'Detener servidor',
          text: 'La URL de intranet dejara de estar disponible para los usuarios conectados.',
          confirmText: 'Si, detener',
          cancelText: 'Cancelar',
          icon: 'warning',
        });
        if (!confirmed) {
          return;
        }

        const result = await window.api.serverStop();
        if (!result.ok) {
          setError(result.error || 'Error al detener el servidor');
          showStyledAlert({
            title: 'Error del sistema',
            text: result.error || 'Error al detener el servidor',
            icon: 'error',
          });
        } else {
          toastSuccess('Servidor detenido', 'La intranet se detuvo correctamente.');
        }
      } else {
        const result = await window.api.serverStart(selectedPort);
        if (!result.ok) {
          setError(result.error || 'Error al iniciar el servidor');
          showStyledAlert({
            title: 'Error del sistema',
            text: result.error || 'Error al iniciar el servidor',
            icon: 'error',
          });
        } else {
          toastSuccess('Servidor iniciado', 'La URL de intranet ya esta disponible.');
        }
      }
      await refreshStatus();
      await scanPorts();
    } catch (err: any) {
      setError(err.message || 'Error inesperado');
      showStyledAlert({
        title: 'Error del sistema',
        text: err.message || 'Error inesperado',
        icon: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(''), 2000);
  }

  const intranetUrl = status.urls.find((u) => u.type === 'lan')?.url || '';

  return (
    <div className="server-config space-y-4">
      {/* Status card */}
      <div className="bg-card rounded-xl border border-border overflow-visible">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`server-status-dot ${status.running ? 'online' : 'offline'}`}>
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Servidor API Local</h3>
              <p className="text-[10px] text-muted-foreground">
                {status.running
                  ? `Escuchando en puerto ${status.port}`
                  : 'Apagado'}
              </p>
            </div>
          </div>

          <button
            onClick={handleToggleServer}
            disabled={loading || !canManage}
            className={`server-toggle-btn ${status.running ? 'running' : 'stopped'}`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : status.running ? (
              <PowerOff className="w-4 h-4" />
            ) : (
              <Power className="w-4 h-4" />
            )}
            {status.running ? 'Detener' : 'Iniciar'}
          </button>
        </div>

        {/* Port selection */}
        {!status.running && (
          <div className="p-4 border-b border-border">
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Puerto
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <button
                  type="button"
                  onClick={(event) => {
                    if (!canManage) return;
                    event.stopPropagation();
                    setOpenPortDropdown((open) => !open);
                  }}
                  disabled={!canManage}
                  className={`h-10 w-full px-3 pr-9 border rounded-lg bg-white text-sm font-medium text-slate-700 shadow-sm text-left transition-all duration-200 ${
                    openPortDropdown
                      ? 'border-blue-500 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {selectedPort}
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </button>
                {openPortDropdown && (
                  <div
                    className="absolute z-[999] top-full left-0 right-0 mt-1.5 bg-white border border-slate-200/80 rounded-xl shadow-xl max-h-56 overflow-y-auto py-1 ring-1 ring-black/5"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {availablePorts.map((port) => (
                      <div
                        key={port}
                        className={`px-3 py-2 text-sm cursor-pointer transition-colors border-l-2 ${
                          selectedPort === port
                            ? 'bg-blue-50 text-blue-700 border-blue-600 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50 border-transparent'
                        }`}
                        onClick={() => {
                          setSelectedPort(port);
                          setOpenPortDropdown(false);
                        }}
                      >
                        {port}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={scanPorts}
                disabled={scanning || !canManage}
                className="p-2 bg-accent rounded-lg hover:bg-accent/80 transition-colors"
                title="Buscar puertos disponibles"
              >
                <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {availablePorts.length} puerto(s) disponible(s)
            </p>
          </div>
        )}

        {/* URLs */}
        {status.running && status.urls.length > 0 && (
          <div className="p-4">
            {intranetUrl && (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-3 py-3">
                <div className="min-w-0 flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-green-700 uppercase font-semibold">
                      URL de Intranet
                    </p>
                    <p className="text-sm font-mono font-semibold text-green-900 truncate">
                      {intranetUrl}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => copyUrl(intranetUrl)}
                  className="p-1.5 hover:bg-green-100 rounded-md transition-colors flex-shrink-0"
                  title="Copiar URL de Intranet"
                >
                  {copiedUrl === intranetUrl ? (
                    <Check className="w-3.5 h-3.5 text-green-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-green-700" />
                  )}
                </button>
              </div>
            )}
            <p className="text-xs font-medium text-muted-foreground mb-3">
              URLs de conexión
            </p>
            <div className="space-y-2">
              {status.urls.map((u) => (
                <div
                  key={u.url}
                  className="flex items-center justify-between gap-2 bg-muted/40 rounded-lg px-3 py-2.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {u.type === 'local' ? (
                      <Monitor className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    ) : (
                      <Globe className="w-4 h-4 text-green-500 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase font-medium">
                        {u.type === 'local' ? 'Local' : 'Red LAN'}
                      </p>
                      <p className="text-xs font-mono font-semibold truncate">{u.url}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => copyUrl(u.url)}
                    className="p-1.5 hover:bg-accent rounded-md transition-colors flex-shrink-0"
                    title="Copiar URL"
                  >
                    {copiedUrl === u.url ? (
                      <Check className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 p-2.5 bg-blue-50 border border-blue-100 rounded-lg">
              <p className="text-[10px] text-blue-700 flex items-center gap-1">
                <Wifi className="w-3 h-3" />
                Comparta la URL de <strong>Red LAN</strong> a las demás PCs para que se conecten.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="server-status-dot offline">
              <Database className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">Base de datos local</h3>
              <p className="text-[10px] text-muted-foreground">
                Ruta detectada por el modulo de servidor
              </p>
            </div>
          </div>

          <button
            onClick={refreshDatabasePath}
            className="p-2 bg-accent rounded-lg hover:bg-accent/80 transition-colors flex-shrink-0"
            title="Actualizar ruta de la base de datos"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between gap-2 bg-muted/40 rounded-lg px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">
                Leyendo desde
              </p>
              <p className="text-xs font-mono font-semibold truncate">
                {databasePath || 'No se pudo detectar la ruta'}
              </p>
            </div>
            {databasePath && (
              <button
                onClick={() => copyUrl(databasePath)}
                className="p-1.5 hover:bg-accent rounded-md transition-colors flex-shrink-0"
                title="Copiar ruta"
              >
                {copiedUrl === databasePath ? (
                  <Check className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs">{error}</span>
        </div>
      )}
    </div>
  );
}

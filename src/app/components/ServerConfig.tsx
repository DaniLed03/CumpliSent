import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  X,
  ServerOff
} from 'lucide-react';
import { showStyledAlert } from '../utils/alert';
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
  const [showStopModal, setShowStopModal] = useState(false);
  const [clients, setClients] = useState<ServerClientRecord[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

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

  const refreshClients = useCallback(async () => {
    setLoadingClients(true);
    try {
      const rows = await window.api.listServerClients();
      setClients(Array.isArray(rows) ? rows : []);
    } catch {
      setClients([]);
    } finally {
      setLoadingClients(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    scanPorts();
    refreshDatabasePath();
    refreshClients();
  }, [refreshStatus, scanPorts, refreshDatabasePath, refreshClients]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      refreshClients();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [refreshClients]);

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
        setShowStopModal(true);
        setLoading(false);
        return;
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

  async function confirmStopServer() {
    setShowStopModal(false);
    setLoading(true);
    try {
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
  const connectedCount = clients.filter((client) => client.Conectado).length;
  const formatLastSeen = (value: string) => {
    if (!value) return 'Sin actividad reciente';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Sin actividad reciente';
    return date.toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4 overflow-hidden">
      
      {/* Header section with gradient */}
      <div className="bg-gradient-to-br from-slate-900 to-[#1e40af] rounded-2xl shadow-lg p-4 md:p-5 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 opacity-10">
          <Server className="w-64 h-64" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl backdrop-blur-md bg-white/10 border border-white/20 shadow-inner ${status.running ? 'animate-pulse' : ''}`}>
              <Server className={`w-8 h-8 ${status.running ? 'text-green-400' : 'text-slate-300'}`} />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Servidor API Local</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="relative flex h-3 w-3">
                  {status.running && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${status.running ? 'bg-green-500' : 'bg-slate-400'}`}></span>
                </span>
                <span className={`text-sm font-medium ${status.running ? 'text-green-300' : 'text-slate-300'}`}>
                  {status.running ? `En línea - Puerto ${status.port}` : 'Apagado'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleToggleServer}
            disabled={loading || !canManage}
            className={`relative overflow-hidden group flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 shadow-md ${
              status.running 
              ? 'bg-white/10 text-white hover:bg-red-500 hover:text-white border border-white/20 hover:border-red-500' 
              : 'bg-green-500 text-white hover:bg-green-400 hover:shadow-green-500/30'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : status.running ? (
              <PowerOff className="w-5 h-5 transition-transform group-hover:scale-110" />
            ) : (
              <Power className="w-5 h-5 transition-transform group-hover:scale-110" />
            )}
            <span>{status.running ? 'Detener Servidor' : 'Iniciar Servidor'}</span>
          </button>
        </div>
      </div>

      {/* Main Configuration Container */}
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
          
          {/* Network Section */}
          {!status.running && (
            <div className="flex flex-col">
              <div className="p-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                  <Wifi className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Configuración de Red</h3>
                  <p className="text-xs text-slate-500">Selecciona el puerto de escucha del servidor</p>
                </div>
              </div>
              
              <div className="p-4">
                <label className="text-sm font-semibold text-slate-700 mb-2 block">
                  Puerto de conexión
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <button
                      type="button"
                      onClick={(event) => {
                        if (!canManage) return;
                        event.stopPropagation();
                        setOpenPortDropdown((open) => !open);
                      }}
                      disabled={!canManage}
                      className={`h-12 w-full px-4 pr-10 border rounded-xl bg-slate-50 hover:bg-white text-base font-medium text-slate-800 shadow-sm text-left transition-all duration-200 focus:outline-none ${
                        openPortDropdown
                          ? 'border-blue-500 ring-4 ring-blue-500/10 bg-white'
                          : 'border-slate-300'
                      }`}
                    >
                      {selectedPort}
                      <ChevronDown className={`w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-200 ${openPortDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {openPortDropdown && (
                      <div
                        className="absolute z-[100] top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto py-2 animate-in fade-in slide-in-from-top-2 duration-200"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="px-3 pb-2 mb-2 border-b border-slate-100 text-xs font-semibold tracking-wider text-slate-400 uppercase">
                          Puertos Disponibles
                        </div>
                        {availablePorts.map((port) => (
                          <button
                            key={port}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                              selectedPort === port
                                ? 'bg-blue-50 text-blue-700 font-bold'
                                : 'text-slate-700 hover:bg-slate-50 font-medium'
                            }`}
                            onClick={() => {
                              setSelectedPort(port);
                              setOpenPortDropdown(false);
                            }}
                          >
                            <span>{port}</span>
                            {selectedPort === port && <Check className="w-4 h-4 text-blue-600" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={scanPorts}
                    disabled={scanning || !canManage}
                    className="h-12 w-12 flex items-center justify-center bg-slate-100 text-slate-600 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    title="Actualizar puertos"
                  >
                    <RefreshCw className={`w-5 h-5 ${scanning ? 'animate-spin text-blue-600' : ''}`} />
                  </button>
                </div>
                <div className="mt-4 flex items-start gap-2 text-sm text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                  <p>
                    Se han detectado <strong className="text-slate-700">{availablePorts.length}</strong> puertos disponibles. 
                    El puerto seleccionado será utilizado para permitir conexiones locales y remotas.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Active URLs */}
          {status.running && status.urls.length > 0 && (
            <div className="flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                <div className="p-1.5 bg-green-100 text-green-700 rounded-lg">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-slate-800">Conexiones Activas</h3>
                  <p className="text-[10px] text-slate-500">Comparte estas URLs para acceder al sistema</p>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {intranetUrl && (
                  <div className="relative overflow-hidden bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 p-4 group transition-all hover:shadow-md hover:border-green-300">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none transition-transform group-hover:scale-110">
                      <Wifi className="w-24 h-24" />
                    </div>
                    <div className="relative z-10 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600"></span>
                          </span>
                          <p className="text-xs text-green-800 uppercase font-bold tracking-wider">
                            URL Principal (Intranet LAN)
                          </p>
                        </div>
                        <p className="text-xl md:text-2xl font-mono font-bold text-green-950 truncate tracking-tight">
                          {intranetUrl}
                        </p>
                      </div>
                      <button
                        onClick={() => copyUrl(intranetUrl)}
                        className="h-12 w-12 flex-shrink-0 flex items-center justify-center bg-white rounded-xl text-green-700 shadow-sm border border-green-200 hover:bg-green-600 hover:text-white hover:border-green-600 transition-all focus:outline-none focus:ring-4 focus:ring-green-500/20 active:scale-95"
                        title="Copiar URL"
                      >
                        {copiedUrl === intranetUrl ? (
                          <Check className="w-5 h-5" />
                        ) : (
                          <Copy className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <Monitor className="w-3.5 h-3.5 text-slate-400" />
                    Todas las rutas disponibles
                  </h4>
                  <div className="grid gap-2">
                    {status.urls.map((u) => (
                      <div
                        key={u.url}
                        className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl p-2.5 hover:border-blue-300 hover:shadow-sm transition-all group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`p-1.5 rounded-lg ${u.type === 'local' ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-600'}`}>
                            {u.type === 'local' ? <Monitor className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                              {u.type === 'local' ? 'Localhost (Solo esta PC)' : 'Red (Otras PCs)'}
                            </p>
                            <p className="text-sm font-mono font-medium text-slate-800 truncate">{u.url}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => copyUrl(u.url)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors focus:outline-none opacity-0 group-hover:opacity-100"
                          title="Copiar ruta"
                        >
                          {copiedUrl === u.url ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Database Section */}
          <div className="flex flex-col border-t border-slate-200">
            <div className="p-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-slate-800">Base de Datos</h3>
                  <p className="text-[10px] text-slate-500">Ruta de almacenamiento local</p>
                </div>
              </div>
              <button
                onClick={refreshDatabasePath}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                title="Actualizar ruta"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4">
              <label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase mb-2 block">
                Archivo detectado
              </label>
              <div className="relative group">
                <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 pr-8 text-[11px] font-mono text-slate-700 whitespace-nowrap overflow-hidden text-ellipsis h-auto min-h-[48px] flex items-center">
                  {databasePath || 'Buscando ruta...'}
                </div>
                {databasePath && (
                  <button
                    onClick={() => copyUrl(databasePath)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-white shadow-sm border border-slate-200 text-slate-500 hover:text-indigo-600 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    title="Copiar ruta absoluta"
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

          {/* Connected users */}
          <div className="flex min-h-0 flex-1 flex-col border-t border-slate-200">
            <div className="p-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                  <Monitor className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm text-slate-800">Usuarios del sistema</h3>
                  <p className="text-[10px] text-slate-500">
                    {connectedCount} conectado(s) de {clients.length} usuario(s) registrados
                  </p>
                </div>
              </div>
              <button
                onClick={refreshClients}
                disabled={loadingClients}
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
                title="Actualizar usuarios"
              >
                <RefreshCw className={`w-4 h-4 ${loadingClients ? 'animate-spin text-blue-600' : ''}`} />
              </button>
            </div>

            <div className="min-h-0 flex-1 p-4">
              <div className="h-full min-h-0 overflow-auto rounded-xl border border-slate-200 shadow-sm">
                <table className="w-full min-w-[860px] text-xs">
                  <thead className="sticky top-0 z-10 bg-[#1e40af] text-white">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">Nombre</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">Rol</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">Estatus</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">Usuario</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">Ultima actividad</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">Equipo / IP</th>
                      <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider text-[10px]">Cuenta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {clients.map((client) => (
                      <tr key={client.IdUsuario} className={client.Conectado ? 'bg-green-50/40 hover:bg-green-50' : 'hover:bg-slate-50'}>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-800">{client.NombreCompleto || client.Usuario}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-semibold">{client.Rol || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-2 font-bold ${client.Conectado ? 'text-green-700' : 'text-red-600'}`}>
                            <span className={`h-2.5 w-2.5 rounded-full ${client.Conectado ? 'bg-green-500 shadow-[0_0_0_3px_rgba(34,197,94,0.16)]' : 'bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.14)]'}`} />
                            {client.Conectado ? 'En linea' : 'Desconectado'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600">{client.Usuario}</td>
                        <td className="px-4 py-3 text-slate-600">{formatLastSeen(client.UltimaActividad)}</td>
                        <td className="px-4 py-3 text-slate-600 font-mono">{client.Direccion || '-'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-bold ${client.Activo ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                            {client.Activo ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {clients.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          No hay usuarios registrados para mostrar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>

        {/* System Logs / Error box */}
        {error && (
          <div className="bg-red-50 rounded-2xl border border-red-200 p-4 shadow-sm animate-in fade-in zoom-in duration-300">
            <div className="flex gap-2">
              <div className="p-1.5 bg-red-100 text-red-600 rounded-full h-fit">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-red-800 mb-1">Error del Servidor</h3>
                <p className="text-xs text-red-600 leading-relaxed">{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stop Server Modal */}
      {showStopModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative p-8 text-center flex flex-col items-center">
              <button 
                onClick={() => setShowStopModal(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-6 relative">
                <div className="absolute inset-0 bg-orange-200 rounded-full animate-ping opacity-20"></div>
                <ServerOff className="w-10 h-10 text-orange-500 relative z-10" />
              </div>
              
              <h3 className="text-2xl font-bold text-slate-800 mb-3">
                ¿Detener Servidor?
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-8 px-4">
                La URL de intranet dejará de estar disponible de inmediato y 
                <strong className="text-slate-700 font-semibold mx-1">todos los usuarios conectados perderán el acceso</strong> 
                al sistema de forma local.
              </p>
              
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setShowStopModal(false)}
                  className="flex-1 py-3 px-4 bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 hover:border-slate-300 transition-all focus:outline-none focus:ring-4 focus:ring-slate-100"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmStopServer}
                  className="flex-1 py-3 px-4 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 shadow-md hover:shadow-xl hover:shadow-orange-500/20 transition-all focus:outline-none focus:ring-4 focus:ring-orange-500/30 flex items-center justify-center"
                >
                  Sí, Detener
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}

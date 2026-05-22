import logoImg from '@/assets/Cumplisent.png';
import { useState, useEffect } from 'react';
import {
  LogIn,
  Eye,
  EyeOff,
  Shield,
  Loader2,
  AlertCircle,
  Key,
  Copy,
  Check,
} from 'lucide-react';
import { closeStyledAlert, showStyledAlert } from '../utils/alert';
import { toastSuccess } from '../utils/toast';

interface LoginScreenProps {
  onLogin: (user: SessionUser, token?: string, apiUrl?: string) => void;
  skipInitialLicenseLoader?: boolean;
}

function FloatingAuthIcons() {
  return (
    <div className="auth-bounce-wrap" aria-hidden="true">
      {[0, 1, 2, 3].map((index) => (
        <div className="auth-bounce-x" key={index}>
          <div className="auth-bounce-y">
            <img src={logoImg} className="auth-bounce-logo" alt="" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LoginScreen({ onLogin, skipInitialLicenseLoader = false }: LoginScreenProps) {
  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem('adminServerUrl') || '');
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('rememberMe') === 'S');
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── License state ──
  const [licenseStatus, setLicenseStatus] = useState<{
    active: boolean;
    daysLeft: number;
    serial: string;
    expired: boolean;
    noLicense: boolean;
    minutesLeft?: number;
    timeLeftLabel?: string;
    machineId?: string;
    expiry?: string;
    status?: string;
    message?: string;
  } | null>(null);
  const [serialInput, setSerialInput] = useState('');
  const [serialLoading, setSerialLoading] = useState(false);
  const [serialError, setSerialError] = useState('');
  const [checkingLicense, setCheckingLicense] = useState(!skipInitialLicenseLoader);
  const [copiedMachineId, setCopiedMachineId] = useState(false);

  // Check license on mount
  useEffect(() => {
    checkLicense();
  }, []);

  useEffect(() => {
    if (!licenseStatus?.active) return undefined;

    const intervalId = window.setInterval(() => {
      checkLicense();
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [licenseStatus?.active]);

  async function checkLicense() {
    if (!skipInitialLicenseLoader) {
      setCheckingLicense(true);
    }
    try {
      if (!window.api) {
        setLicenseStatus({ active: false, daysLeft: 0, serial: '', expired: false, noLicense: true });
        setCheckingLicense(false);
        return;
      }
      const status = await window.api.checkLicense();
      setLicenseStatus(status);
    } catch {
      setLicenseStatus({ active: false, daysLeft: 0, serial: '', expired: false, noLicense: true });
    } finally {
      setCheckingLicense(false);
    }
  }

  async function tryRememberLogin() {
    if (!rememberMe) return;
    try {
      const result = await window.api.rememberLogin?.();
      if (result?.ok && result.user) {
        closeStyledAlert();
        onLogin(result.user, result.token, result.apiUrl || serverUrl.trim().replace(/\/+$/, ''));
      }
    } catch {
      // Si falla el recordarme, se conserva el login manual.
    }
  }

  async function handleCopyMachineId() {
    const machineId = licenseStatus?.machineId || '';
    if (!machineId) return;

    try {
      await navigator.clipboard.writeText(machineId);
      setCopiedMachineId(true);
      window.setTimeout(() => setCopiedMachineId(false), 1600);
    } catch {
      setSerialError('No se pudo copiar el Machine ID');
      showStyledAlert({
        title: 'No se pudo copiar',
        text: 'Copia manualmente el Machine ID.',
        icon: 'error',
      });
    }
  }

  async function handleActivateSerial(e: React.FormEvent) {
    e.preventDefault();
    setSerialError('');
    setSerialLoading(true);
    try {
      const result = await window.api.activateLicense(serialInput.trim());
      if (!result.ok) {
        const message = result.error || 'Serial invalido';
        setSerialError(message);
        showStyledAlert({
          title: 'Error al activar la licencia',
          text: message,
          icon: 'error',
        });
      } else {
        setSerialInput('');
        toastSuccess('Licencia activada', result.message || 'La licencia se activo correctamente.');
        await checkLicense();
      }
    } catch {
      setSerialError('Error al activar la licencia');
      showStyledAlert({
        title: 'Error al activar la licencia',
        text: 'No se pudo activar la licencia.',
        icon: 'error',
      });
    } finally {
      setSerialLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    closeStyledAlert();
    setError('');
    setLoading(true);

    try {
      const cleanServerUrl = serverUrl.trim().replace(/\/+$/, '');
      const result = cleanServerUrl
        ? await window.api.login(cleanServerUrl, usuario, password, rememberMe)
        : await window.api.bootstrapLogin(usuario, password, rememberMe);
      if (!result.ok) {
        const message = result.error || 'Credenciales incorrectas';
        setError(message);
        showStyledAlert({
          title: 'Error al iniciar sesión',
          text: message,
          icon: 'error',
        });
        setLoading(false);
        return;
      }
      if (cleanServerUrl) {
        localStorage.setItem('adminServerUrl', cleanServerUrl);
      }
      localStorage.setItem('rememberMe', rememberMe ? 'S' : 'N');
      closeStyledAlert();
      onLogin(result.user!, result.token, cleanServerUrl);
    } catch {
      setError('Error al iniciar sesión');
      showStyledAlert({
        title: 'Error al iniciar sesión',
        text: 'No se pudo iniciar sesión.',
        icon: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  // ── Loading state ──
  if (checkingLicense) {
    return (
      <div className="login-screen auth-dvd-screen">
        <FloatingAuthIcons />
        <div className="login-container" style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: '#60a5fa' }} />
          <p style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>Verificando licencia...</p>
        </div>
      </div>
    );
  }

  // ── License required / expired ──
  if (licenseStatus && (!licenseStatus.active || licenseStatus.expired || licenseStatus.noLicense)) {
    return (
      <div className="login-screen auth-dvd-screen">
        <FloatingAuthIcons />
        <div className="login-container">
          <div className="login-header">
            <div className="flex justify-center mb-6">
              <img src={logoImg} className="w-24 h-24 object-contain" alt="CumpliSent logo" />
            </div>
            <h1 className="login-title">Activar Licencia</h1>
            <p className="login-subtitle">
              {licenseStatus.expired
                ? 'Su licencia ha expirado'
                : 'Se requiere una licencia válida para continuar'}
            </p>
          </div>

          {licenseStatus.expired && licenseStatus.serial && (
            <div className="login-bootstrap-info" style={{ marginBottom: '1rem' }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <div>
                <p className="font-medium text-xs">Licencia expirada</p>
                <p className="text-[10px] opacity-80">
                  Serial: {licenseStatus.serial.slice(0, 8)}...
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleActivateSerial} className="login-form">
            <div className="login-field">
              <label htmlFor="machine-id-input">Machine ID</label>
              <div className="login-password-wrap">
                <input
                  id="machine-id-input"
                  type="text"
                  value={licenseStatus.machineId || ''}
                  readOnly
                  style={{ fontFamily: 'monospace', letterSpacing: '0.04em', paddingRight: '3rem' }}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={handleCopyMachineId}
                  title="Copiar Machine ID"
                  tabIndex={-1}
                >
                  {copiedMachineId ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="serial-input">Serial de licencia</label>
              <input
                id="serial-input"
                type="text"
                value={serialInput}
                onChange={(e) => setSerialInput(e.target.value.toUpperCase())}
                placeholder="SERIAL V3"
                required
                autoFocus
                style={{ fontFamily: 'monospace', letterSpacing: '0.1em' }}
              />
            </div>

            {serialError && (
              <div className="login-error">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs">{serialError}</span>
              </div>
            )}

            <button type="submit" className="login-submit" disabled={serialLoading}>
              {serialLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Activando...
                </>
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  Activar Licencia
                </>
              )}
            </button>
          </form>

          <div className="login-footer">
            <p>CumpliSent v1.0</p>
            <p>© 2024 Sistema Judicial</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Login form ──
  return (
    <div className="login-screen auth-dvd-screen">
      <FloatingAuthIcons />

      <div className="login-container">
        {/* Logo / Header */}
        <div className="login-header">
          <div className="flex justify-center mb-6">
            <img src={logoImg} className="w-24 h-24 object-contain" alt="CumpliSent logo" />
          </div>
          <h1 className="login-title">
            <span className="brand-cumpli">Cumpli</span><span className="brand-sent">Sent</span>
          </h1>
          <p className="login-subtitle">Cumplimiento de Sentencias</p>
        </div>

        {/* License badge */}
        {licenseStatus && licenseStatus.active && (
          <div className={`login-server-badge ${licenseStatus.minutesLeft != null && licenseStatus.minutesLeft <= 10080 ? 'offline' : 'online'}`}>
            <Key className="w-3.5 h-3.5" />
            <span>
              {licenseStatus.minutesLeft != null && licenseStatus.minutesLeft <= 10080
                ? `Licencia expira en ${licenseStatus.timeLeftLabel || `${licenseStatus.daysLeft} dia(s)`}`
                : `Licencia activa - ${licenseStatus.timeLeftLabel || `${licenseStatus.daysLeft} dias restantes`}`}
            </span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="login-form">
          <div className="login-field">
            <label htmlFor="server-url">URL del servidor admin</label>
            <input
              id="server-url"
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://192.168.100.23:3000"
              autoComplete="url"
            />
          </div>

          {/* Username */}
          <div className="login-field">
            <label htmlFor="login-usuario">Usuario</label>
            <input
              id="login-usuario"
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="Ingrese su usuario"
              required
              autoFocus
              autoComplete="username"
            />
          </div>

          {/* Password */}
          <div className="login-field">
            <label htmlFor="login-password">Contraseña</label>
            <div className="login-password-wrap">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingrese su contraseña"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 text-xs text-muted-foreground cursor-pointer">
            <span>Recordarme en este equipo</span>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="sr-only"
            />
            <span className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${rememberMe ? 'bg-primary border-primary' : 'bg-slate-500 border-slate-400'}`}>
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${rememberMe ? 'translate-x-5' : 'translate-x-1'}`} />
            </span>
          </label>

          {/* Error */}
          {error && (
            <div className="login-error" style={{ alignItems: 'flex-start' }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs" style={{ lineHeight: 1.35, wordBreak: 'break-word' }}>
                {error}
              </span>
            </div>
          )}

          {/* Submit */}
          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Iniciando sesión...
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Iniciar Sesión
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="login-footer">
          <p>CumpliSent v1.0</p>
          <p>© 2024 Sistema Judicial</p>
        </div>
      </div>
    </div>
  );
}

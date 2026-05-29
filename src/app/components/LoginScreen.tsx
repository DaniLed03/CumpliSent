import { useState, useEffect, useRef } from 'react';
import {
  LogIn,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Key,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { closeStyledAlert } from '../utils/alert';
import { toastError, toastSuccess } from '../utils/toast';

const logoImg = `${import.meta.env.BASE_URL}icons/cumplisent-fast.png`;

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

function formatLicenseExpiry(expiry?: string) {
  if (!expiry) return '';
  const match = String(expiry).trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) return '';

  const [, year, month, day, hour, minute] = match;
  if (hour === '00' && minute === '00') {
    const date = new Date(Number(year), Number(month) - 1, Number(day) - 1);
    return `${date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })} 23:59 PM`;
  }
  const dateLabel = `${day}/${month}/${year}`;
  return hour ? `${dateLabel} ${hour}:${minute} PM` : `${dateLabel} 23:59 PM`;
}

type LicenseLoaderState = 'checking' | 'valid' | 'invalid';

const loaderDelay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export default function LoginScreen({ onLogin, skipInitialLicenseLoader = false }: LoginScreenProps) {
  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem('adminServerUrl') || '');
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('rememberMe') === 'S');
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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
  const [licenseLoaderState, setLicenseLoaderState] = useState<LicenseLoaderState>('checking');
  const [copiedMachineId, setCopiedMachineId] = useState(false);
  const rememberLoginAttemptedRef = useRef(false);
  const licenseExpiryLabel = formatLicenseExpiry(licenseStatus?.expiry);

  // Check license on mount
  useEffect(() => {
    checkLicense({ showLoader: !skipInitialLicenseLoader, autoRemember: true });
  }, []);



  useEffect(() => {
    if (!licenseStatus?.active) return undefined;

    const intervalId = window.setInterval(() => {
      checkLicense({ showLoader: false, autoRemember: false });
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [licenseStatus?.active]);

  async function checkLicense(options: { showLoader?: boolean; autoRemember?: boolean } = {}) {
    const showLoader = Boolean(options.showLoader);

    if (showLoader) {
      setCheckingLicense(true);
      setLicenseLoaderState('checking');
    }

    let shouldRememberLogin = false;

    try {
      if (!window.api) {
        setLicenseStatus({ active: false, daysLeft: 0, serial: '', expired: false, noLicense: true });
        if (showLoader) {
          const loader = document.getElementById("legacy-boot-loader");
          if (loader) loader.remove();
          setLicenseLoaderState('invalid');
          await loaderDelay(650);
        }
        return;
      }
      
      if (showLoader) {
        // Artificial delay so the user actually sees the spinning animation from the beginning,
        // and to guarantee that Vite has fully loaded all CSS styles before we remove the static loader.
        await loaderDelay(1200);
      }

      const status = await window.api.checkLicense();
      const isValidLicense = Boolean(status?.active && !status.expired && !status.noLicense);
      setLicenseStatus(status);
      shouldRememberLogin = isValidLicense && Boolean(options.autoRemember);

      if (showLoader) {
        // Remove the static HTML loader perfectly when we are about to show the checkmark.
        // Because CSS is now fully loaded, the React loader beneath it looks identical,
        // and instantly transitions into the checkmark animation.
        const loader = document.getElementById("legacy-boot-loader");
        if (loader) {
          loader.remove();
        }
        
        setLicenseLoaderState(isValidLicense ? 'valid' : 'invalid');
        await loaderDelay(isValidLicense ? 650 : 800);
      }
    } catch {
      setLicenseStatus({ active: false, daysLeft: 0, serial: '', expired: false, noLicense: true });
      if (showLoader) {
        const loader = document.getElementById("legacy-boot-loader");
        if (loader) loader.remove();
        setLicenseLoaderState('invalid');
        await loaderDelay(800);
      }
    } finally {
      if (showLoader) {
        setCheckingLicense(false);
      }
    }

    if (shouldRememberLogin) {
      await tryRememberLogin();
    }
  }

  async function tryRememberLogin() {
    if (!rememberMe || rememberLoginAttemptedRef.current) return;
    rememberLoginAttemptedRef.current = true;

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
      toastError('No se pudo copiar', 'Copia manualmente el Machine ID.');
    }
  }

  async function handleActivateSerial(e: React.FormEvent) {
    e.preventDefault();
    setSerialError('');

    if (!serialInput.trim()) {
      toastError('Serial requerido', 'Ingresa el serial de licencia.');
      return;
    }

    setSerialLoading(true);
    try {
      const result = await window.api.activateLicense(serialInput.trim());
      if (!result.ok) {
        const message = result.error || 'Serial invalido';
        setSerialError(message);
        toastError('Error al activar la licencia', message);
      } else {
        setSerialInput('');
        toastSuccess('Licencia activada', result.message || 'La licencia se activo correctamente.');
        await checkLicense({ showLoader: false, autoRemember: false });
      }
    } catch {
      setSerialError('Error al activar la licencia');
      toastError('Error al activar la licencia', 'No se pudo activar la licencia.');
    } finally {
      setSerialLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    closeStyledAlert();

    if (!usuario.trim()) {
      toastError('Usuario requerido', 'Ingresa tu usuario.');
      return;
    }

    if (!password.trim()) {
      toastError('Contrasena requerida', 'Ingresa tu contrasena.');
      return;
    }

    setLoading(true);

    try {
      const cleanServerUrl = serverUrl.trim().replace(/\/+$/, '');
      const result = cleanServerUrl
        ? await window.api.login(cleanServerUrl, usuario, password, rememberMe)
        : await window.api.bootstrapLogin(usuario, password, rememberMe);
      if (!result.ok) {
        const message = result.error || 'Credenciales incorrectas';
        toastError('Error al iniciar sesion', message);
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
      toastError('Error al iniciar sesion', 'No se pudo iniciar sesion.');
    } finally {
      setLoading(false);
    }
  }

  // ── Loading state ──
  if (checkingLicense) {
    const loaderText =
      licenseLoaderState === 'valid'
        ? 'Licencia verificada'
        : licenseLoaderState === 'invalid'
          ? 'Licencia no encontrada'
          : 'Verificando licencia...';

    return (
      <div className="login-screen auth-dvd-screen">
        <FloatingAuthIcons />
        <div className="license-loader-card">
          <img src={logoImg} className="license-loader-logo" alt="CumpliSent logo" />
          <div className={`license-loader-status license-loader-status-${licenseLoaderState}`} aria-hidden="true">
            {licenseLoaderState === 'checking' && <div className="license-loader-spinner" />}
            {licenseLoaderState === 'valid' && <CheckCircle2 className="license-loader-state-icon" />}
            {licenseLoaderState === 'invalid' && <XCircle className="license-loader-state-icon" />}
          </div>
          <h1 className="license-loader-title">
            <span>Cumpli</span>
            <strong>Sent</strong>
          </h1>
          <p className="license-loader-text">{loaderText}</p>
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

          <form onSubmit={handleActivateSerial} className="login-form" noValidate>
            <div className="login-field">
              <label htmlFor="machine-id-input">Machine ID</label>
              <div className="login-password-wrap">
                <input
                  id="machine-id-input"
                  type="text"
                  value={licenseStatus.machineId || ''}
                  readOnly
                  style={{ letterSpacing: '0.04em', paddingRight: '3rem' }}
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
                autoFocus
                style={{ letterSpacing: '0.1em' }}
              />
            </div>

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
              {licenseExpiryLabel
                ? `Licencia valida hasta ${licenseExpiryLabel}`
                : licenseStatus.minutesLeft != null && licenseStatus.minutesLeft <= 10080
                  ? `Licencia expira en ${licenseStatus.timeLeftLabel || `${licenseStatus.daysLeft} dia(s)`}`
                  : `Licencia activa - ${licenseStatus.timeLeftLabel || `${licenseStatus.daysLeft} dias restantes`}`}
            </span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="login-form" noValidate>
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

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  CheckCircle2,
  Edit,
  FileSpreadsheet,
  Info,
  LayoutGrid,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  Shield,
  User,
  X,
} from 'lucide-react';

type SaveResult = void | boolean | Promise<void | boolean>;

type RoleOption = {
  IdRol: number;
  NombreRol: string;
};

type MesaOption = {
  ID_MESA: number;
  MESA: string;
  NOMBRE?: string;
  ACTIVO?: number;
};

type PermissionOption = {
  IdPermiso: string;
  NombrePermiso: string;
  Categoria?: string;
};

type ResultMap = Record<string, number | string | undefined>;

function ModalShell({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  maxWidth = 'max-w-2xl',
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  maxWidth?: string;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className={`flex max-h-[90vh] w-full ${maxWidth} flex-col overflow-hidden rounded-2xl bg-white shadow-2xl`}>
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {icon && <div className="rounded-lg bg-white/20 p-2 text-white">{icon}</div>}
              <div>
                <h2 className="text-2xl font-bold text-white">{title}</h2>
                {subtitle && <p className="mt-1 text-sm text-blue-100">{subtitle}</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function ErrorBox({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
        <p className="text-sm font-medium text-red-800">{error}</p>
      </div>
    </div>
  );
}

function ResultStats({ title, result, labels }: { title: string; result?: ResultMap | null; labels: Record<string, string> }) {
  if (!result) return null;
  const entries = Object.entries(labels);
  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-4">
      <div className="flex items-start gap-3">
        <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
        <div className="flex-1">
          <h4 className="mb-3 text-sm font-semibold text-green-900">{title}</h4>
          <div className={`grid grid-cols-2 gap-3 md:grid-cols-${Math.min(entries.length, 5)}`}>
            {entries.map(([key, label]) => (
              <div key={key}>
                <p className="text-2xl font-bold text-green-900">{result[key] ?? 0}</p>
                <p className="text-xs text-green-700">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function roleLabel(role: RoleOption) {
  return role.NombreRol || String(role.IdRol);
}

function mesaLabel(mesa: MesaOption) {
  return `${mesa.MESA}${mesa.NOMBRE ? ` - ${mesa.NOMBRE}` : ''}`;
}

export function NuevoUsuarioModal({
  isOpen,
  onClose,
  onSave,
  roles,
  mesas,
  canAssignMesa,
  saving,
  error,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (userData: { Usuario: string; NombreCompleto: string; Password: string; IdRol: number; IdMesa: number | null }) => SaveResult;
  roles: RoleOption[];
  mesas: MesaOption[];
  canAssignMesa: boolean;
  saving?: boolean;
  error?: string;
}) {
  const defaultRole = roles[0]?.IdRol || 3;
  const [usuario, setUsuario] = useState('');
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [password, setPassword] = useState('');
  const [idRol, setIdRol] = useState(defaultRole);
  const [idMesa, setIdMesa] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setUsuario('');
    setNombreCompleto('');
    setPassword('');
    setIdRol(roles[0]?.IdRol || 3);
    setIdMesa(null);
    setShowPassword(false);
  }, [isOpen, roles]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await onSave({
      Usuario: usuario.trim(),
      NombreCompleto: nombreCompleto.trim(),
      Password: password,
      IdRol: Number(idRol),
      IdMesa: canAssignMesa ? idMesa : null,
    });
    if (result !== false) onClose();
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title="Nuevo Usuario" maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="overflow-y-auto p-8">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <User className="h-4 w-4 text-blue-600" />
              Usuario
            </label>
            <input value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="nombre_usuario" className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <User className="h-4 w-4 text-blue-600" />
              Nombre Completo
            </label>
            <input value={nombreCompleto} onChange={(e) => setNombreCompleto(e.target.value)} placeholder="Nombre completo" className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Lock className="h-4 w-4 text-blue-600" />
              Contrasena
            </label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" className="w-full rounded-xl border border-gray-300 px-4 py-3 pr-12 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500" required />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? 'Ocultar' : 'Ver'}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Shield className="h-4 w-4 text-blue-600" />
              Rol
            </label>
            <select value={idRol} onChange={(e) => setIdRol(Number(e.target.value))} className="w-full cursor-pointer appearance-none rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500">
              {roles.map((role) => <option key={role.IdRol} value={role.IdRol}>{roleLabel(role)}</option>)}
            </select>
          </div>
          {canAssignMesa && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <LayoutGrid className="h-4 w-4 text-blue-600" />
                Mesa Asignada
              </label>
              <select value={idMesa ?? ''} onChange={(e) => setIdMesa(e.target.value ? Number(e.target.value) : null)} className="w-full cursor-pointer appearance-none rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500">
                <option value="">Sin mesa asignada</option>
                {mesas.filter((mesa) => mesa.ACTIVO === 1).map((mesa) => <option key={mesa.ID_MESA} value={mesa.ID_MESA}>{mesaLabel(mesa)}</option>)}
              </select>
            </div>
          )}
          <ErrorBox error={error} />
        </div>
        <div className="mt-8 flex items-center gap-3 border-t border-gray-200 pt-6">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-100">Cancelar</button>
          <button type="submit" disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 font-medium text-white shadow-lg shadow-blue-500/30 transition-all hover:from-blue-700 hover:to-blue-800 disabled:opacity-60">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <User className="h-5 w-5" />}
            Crear Usuario
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function EditarUsuarioModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  roles,
  mesas,
  canAssignMesa,
  saving,
  error,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (userData: { NombreCompleto: string; Password?: string; IdRol: number; IdMesa?: number | null; Activo: boolean }) => SaveResult;
  initialData: any | null;
  roles: RoleOption[];
  mesas: MesaOption[];
  canAssignMesa: boolean;
  saving?: boolean;
  error?: string;
}) {
  const [usuario, setUsuario] = useState('');
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [password, setPassword] = useState('');
  const [idRol, setIdRol] = useState(roles[0]?.IdRol || 3);
  const [idMesa, setIdMesa] = useState<number | null>(null);
  const [activo, setActivo] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!isOpen || !initialData) return;
    setUsuario(initialData.Usuario || '');
    setNombreCompleto(initialData.NombreCompleto || '');
    setPassword('');
    setIdRol(Number(initialData.IdRol || roles[0]?.IdRol || 3));
    setIdMesa(initialData.IdMesa || null);
    setActivo(Boolean(initialData.Activo));
    setShowPassword(false);
  }, [isOpen, initialData, roles]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: { NombreCompleto: string; Password?: string; IdRol: number; IdMesa?: number | null; Activo: boolean } = {
      NombreCompleto: nombreCompleto.trim(),
      IdRol: Number(idRol),
      Activo: activo,
    };
    if (password) payload.Password = password;
    if (canAssignMesa) payload.IdMesa = idMesa;
    const result = await onSave(payload);
    if (result !== false) onClose();
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title="Editar Usuario" maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="overflow-y-auto p-8">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><User className="h-4 w-4 text-blue-600" />Usuario</label>
            <input value={usuario} disabled className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-500 outline-none" />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><User className="h-4 w-4 text-blue-600" />Nombre Completo</label>
            <input value={nombreCompleto} onChange={(e) => setNombreCompleto(e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><Lock className="h-4 w-4 text-blue-600" />Nueva Contrasena</label>
            <p className="-mt-1 text-xs text-gray-500">Dejar vacio para no cambiar</p>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" className="w-full rounded-xl border border-gray-300 px-4 py-3 pr-12 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showPassword ? 'Ocultar' : 'Ver'}</button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><Shield className="h-4 w-4 text-blue-600" />Rol</label>
            <select value={idRol} onChange={(e) => setIdRol(Number(e.target.value))} className="w-full cursor-pointer appearance-none rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500">
              {roles.map((role) => <option key={role.IdRol} value={role.IdRol}>{roleLabel(role)}</option>)}
            </select>
          </div>
          {canAssignMesa && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><LayoutGrid className="h-4 w-4 text-blue-600" />Mesa Asignada</label>
              <select value={idMesa ?? ''} onChange={(e) => setIdMesa(e.target.value ? Number(e.target.value) : null)} className="w-full cursor-pointer appearance-none rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500">
                <option value="">Sin mesa asignada</option>
                {mesas.filter((mesa) => mesa.ACTIVO === 1 || mesa.ID_MESA === idMesa).map((mesa) => <option key={mesa.ID_MESA} value={mesa.ID_MESA}>{mesaLabel(mesa)}</option>)}
              </select>
            </div>
          )}
          <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4">
            <input id="usuarioActivoModal" type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="h-5 w-5 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500" />
            <label htmlFor="usuarioActivoModal" className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-gray-700">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Usuario Activo
            </label>
          </div>
          <ErrorBox error={error} />
        </div>
        <div className="mt-8 flex items-center gap-3 border-t border-gray-200 pt-6">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-100">Cancelar</button>
          <button type="submit" disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 font-medium text-white shadow-lg shadow-blue-500/30 transition-all hover:from-blue-700 hover:to-blue-800 disabled:opacity-60">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
            Guardar Cambios
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function NuevoRolModal({
  isOpen,
  onClose,
  onSave,
  permissions,
  initialData,
  title = 'Nuevo Rol',
  canAssignPermissions = true,
  saving,
  error,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rolData: { NombreRol: string; Permisos: string[] }) => SaveResult;
  permissions: PermissionOption[];
  initialData?: { NombreRol: string; Permisos: string[] } | null;
  title?: string;
  canAssignPermissions?: boolean;
  saving?: boolean;
  error?: string;
}) {
  const [nombreRol, setNombreRol] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setNombreRol(initialData?.NombreRol || '');
    setSelected(initialData?.Permisos || []);
  }, [isOpen, initialData]);

  const grouped = useMemo(() => {
    const groups: Record<string, PermissionOption[]> = {};
    permissions.forEach((permission) => {
      const category = permission.Categoria || 'GENERAL';
      if (!groups[category]) groups[category] = [];
      if (!groups[category].some((item) => item.IdPermiso === permission.IdPermiso)) groups[category].push(permission);
    });
    return groups;
  }, [permissions]);

  function toggle(permissionId: string) {
    if (!canAssignPermissions) return;
    setSelected((current) => current.includes(permissionId) ? current.filter((id) => id !== permissionId) : [...current, permissionId]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await onSave({ NombreRol: nombreRol.trim().toUpperCase(), Permisos: selected });
    if (result !== false) onClose();
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-4xl">
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8">
          <div className="mb-8">
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Shield className="h-4 w-4 text-blue-600" />
              Nombre del Rol
            </label>
            <input value={nombreRol} onChange={(e) => setNombreRol(e.target.value)} placeholder="NOMBRE DEL ROL" className="w-full rounded-xl border border-gray-300 px-4 py-3 uppercase outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div className="space-y-6">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category} className="overflow-hidden rounded-xl border border-gray-200">
                <div className="border-b border-gray-200 bg-gray-50 px-5 py-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-800">{category}</h3>
                </div>
                <div className="grid grid-cols-1 gap-2 p-4 md:grid-cols-3">
                  {items.map((permission) => {
                    const checked = selected.includes(permission.IdPermiso);
                    return (
                      <label key={permission.IdPermiso} className="group flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-colors hover:bg-blue-50">
                        <input type="checkbox" checked={checked} onChange={() => toggle(permission.IdPermiso)} disabled={!canAssignPermissions} className="h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500" />
                        <span className="text-sm text-gray-700 group-hover:text-gray-900">{permission.NombrePermiso}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <ErrorBox error={error} />
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-gray-200 bg-gray-50 px-8 py-6">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-white">Cancelar</button>
          <button type="submit" disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 font-medium text-white shadow-lg shadow-blue-500/30 transition-all hover:from-blue-700 hover:to-blue-800 disabled:opacity-60">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
            Guardar Permisos
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function NuevaMesaDeTramiteModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  saving,
  error,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (mesaData: { mesa: string; responsable: string; activo: boolean }) => SaveResult;
  initialData?: { mesa: string; responsable: string; activo: boolean } | null;
  saving?: boolean;
  error?: string;
}) {
  const [mesa, setMesa] = useState('');
  const [responsable, setResponsable] = useState('');
  const [activo, setActivo] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setMesa(initialData?.mesa || '');
    setResponsable(initialData?.responsable || '');
    setActivo(initialData?.activo ?? true);
  }, [isOpen, initialData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await onSave({ mesa: mesa.trim().toUpperCase(), responsable: responsable.trim(), activo });
    if (result !== false) onClose();
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={initialData ? 'Editar Mesa de Tramite' : 'Nueva Mesa de Tramite'} maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="p-8">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><LayoutGrid className="h-4 w-4 text-blue-600" />Mesa (Clave / Nombre)</label>
            <input value={mesa} onChange={(e) => setMesa(e.target.value)} placeholder="E.G. MESA I, MESA A, MESA 1" className="w-full rounded-xl border border-gray-300 px-4 py-3 uppercase outline-none transition-all placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><User className="h-4 w-4 text-blue-600" />Nombre del Responsable / Encargado</label>
            <input value={responsable} onChange={(e) => setResponsable(e.target.value)} placeholder="Nombre completo" className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition-all placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-blue-500" required />
          </div>
          {initialData && (
            <label className="flex items-center gap-3 rounded-xl bg-gray-50 p-4 text-sm font-semibold text-gray-700">
              <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500" />
              Mesa activa para asignaciones automaticas
            </label>
          )}
          <ErrorBox error={error} />
        </div>
        <div className="mt-8 flex items-center gap-3 border-t border-gray-200 pt-6">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-100">Cancelar</button>
          <button type="submit" disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 font-medium text-white shadow-lg shadow-blue-500/30 transition-all hover:from-blue-700 hover:to-blue-800 disabled:opacity-60">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
            Guardar Mesa
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function ReasignarMesaModal({
  isOpen,
  onClose,
  onSave,
  expedientes,
  mesas,
  saving,
  error,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { expedienteRowid: number; expediente: string; newMesaId: number; motivo: string }) => SaveResult;
  expedientes: any[];
  mesas: MesaOption[];
  saving?: boolean;
  error?: string;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [nuevaMesa, setNuevaMesa] = useState('');
  const [observaciones, setObservaciones] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setBusqueda('');
    setSelected(null);
    setNuevaMesa('');
    setObservaciones('');
  }, [isOpen]);

  const resultados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    if (term.length < 2 || selected) return [];
    return expedientes
      .filter((exp) => String(exp.numeroJuicio || '').toLowerCase().includes(term) || String(exp.numeroOrden || '').includes(term))
      .slice(0, 8);
  }, [busqueda, expedientes, selected]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !nuevaMesa) return false;
    const result = await onSave({
      expedienteRowid: Number(selected.id),
      expediente: selected.numeroJuicio,
      newMesaId: Number(nuevaMesa),
      motivo: observaciones.trim(),
    });
    if (result !== false) onClose();
  }

  const currentMesa = selected ? mesas.find((mesa) => Number(mesa.ID_MESA) === Number(selected.idMesa)) : null;

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title="Reasignar Mesa" subtitle="Busca un expediente y selecciona la nueva mesa de tramite" icon={<Edit className="h-6 w-6" />} maxWidth="max-w-4xl">
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8">
          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700"><Search className="h-4 w-4 text-blue-600" />Buscar Expediente (Juicio)</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setSelected(null); setNuevaMesa(''); }} placeholder="Escribe el No. de Juicio o Expediente..." className="w-full rounded-xl border border-gray-300 px-4 py-3 pl-11 outline-none transition-all placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-blue-500" required />
              {resultados.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-64 overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
                  {resultados.map((exp) => (
                    <button key={exp.id} type="button" onClick={() => { setSelected(exp); setBusqueda(exp.numeroJuicio || ''); setNuevaMesa(exp.idMesa ? String(exp.idMesa) : ''); setObservaciones(exp.observacionesMesa || ''); }} className="flex w-full items-center justify-between gap-4 px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-700">
                      <span className="font-semibold">{exp.numeroJuicio}</span>
                      <span className="text-xs text-gray-500">Orden {exp.numeroOrden || '-'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-6">
            <div className="mb-4 grid grid-cols-3 gap-4">
              <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-900">Orden</p><p className="font-bold text-gray-900">{selected?.numeroOrden || '-'}</p></div>
              <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-900">Juicio / Expediente</p><p className="font-bold text-blue-700">{selected?.numeroJuicio || '-'}</p></div>
              <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-900">Mesa Actual</p><p className="font-bold text-gray-900">{currentMesa?.MESA || 'Sin mesa asignada'}</p></div>
            </div>
            {!selected && <p className="py-4 text-center text-sm text-blue-600">Busca un expediente para ver los resultados</p>}
          </div>
          <div className="mb-6 space-y-2">
            <label className="block text-sm font-semibold text-gray-700">Seleccionar Nueva Mesa</label>
            <select value={nuevaMesa} onChange={(e) => setNuevaMesa(e.target.value)} className="w-full cursor-pointer appearance-none rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500" required>
              <option value="">Seleccione una mesa...</option>
              {mesas.filter((mesa) => mesa.ACTIVO === 1 || Number(mesa.ID_MESA) === Number(selected?.idMesa)).map((mesa) => <option key={mesa.ID_MESA} value={mesa.ID_MESA}>{mesaLabel(mesa)}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">Motivo u Observaciones</label>
            <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Escribe el motivo del cambio..." rows={5} className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 outline-none transition-all placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div className="mt-6"><ErrorBox error={error} /></div>
        </div>
        <div className="flex items-center gap-3 border-t border-gray-200 bg-gray-50 px-8 py-6">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-white">Cancelar</button>
          <button type="submit" disabled={saving || !selected} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 font-medium text-white shadow-lg shadow-blue-500/30 transition-all hover:from-blue-700 hover:to-blue-800 disabled:opacity-60">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
            Guardar Reasignacion
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function AgregarNuevosExpedientesPorRangoModal({
  isOpen,
  onClose,
  onSave,
  saving,
  error,
  result,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { archivo: File | null; fechaInicial: string; fechaFinal: string }) => SaveResult;
  saving?: boolean;
  error?: string;
  result?: ResultMap | null;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [fechaInicial, setFechaInicial] = useState('');
  const [fechaFinal, setFechaFinal] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setArchivo(null);
    setFechaInicial('');
    setFechaFinal('');
  }, [isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSave({ archivo, fechaInicial, fechaFinal });
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title="Agregar Nuevos Expedientes por Rango" maxWidth="max-w-3xl">
      <form onSubmit={handleSubmit} className="overflow-y-auto p-8">
        <div className="mb-8 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex gap-3">
            <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
            <p className="text-sm leading-relaxed text-blue-700"><strong>Instruccion:</strong> Seleccione un archivo Excel con expedientes y defina el rango de fechas de ejecutoria para filtrar los expedientes que desea agregar al listado cumplimientos.</p>
          </div>
        </div>
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><FileSpreadsheet className="h-4 w-4 text-blue-600" />Archivo Sentencias</label>
            <input id="modal-file-agregar" type="file" accept=".xlsx,.xls,.xlsm" onChange={(e) => setArchivo(e.target.files?.[0] || null)} className="hidden" required />
            <label htmlFor="modal-file-agregar" className="group flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-300 px-6 py-8 transition-all hover:border-blue-500 hover:bg-blue-50">
              <div className="flex flex-col items-center gap-2">
                <div className="rounded-lg bg-gray-100 p-3 transition-colors group-hover:bg-blue-100"><FileSpreadsheet className="h-8 w-8 text-gray-500 transition-colors group-hover:text-blue-600" /></div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-900">{archivo ? archivo.name : 'Seleccionar Archivo Excel'}</p>
                  <p className="mt-1 text-xs text-gray-500">{archivo ? `${(archivo.size / 1024).toFixed(2)} KB` : 'Haz clic para seleccionar un archivo .xlsx o .xls'}</p>
                </div>
              </div>
            </label>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><Calendar className="h-4 w-4 text-blue-600" />Fecha Inicial de Ejecutoria</label>
              <input type="date" value={fechaInicial} onChange={(e) => setFechaInicial(e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><Calendar className="h-4 w-4 text-blue-600" />Fecha Final de Ejecutoria</label>
              <input type="date" value={fechaFinal} onChange={(e) => setFechaFinal(e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500" required />
            </div>
          </div>
          <ResultStats title="Expedientes Agregados al Listado CUMPLIMIENTOS" result={result} labels={{ total: 'Procesados', nuevos: 'Insertados', duplicados: 'Duplicados', omitidos: 'Omitidos' }} />
          <ErrorBox error={error} />
        </div>
        <div className="mt-8 flex items-center gap-3 border-t border-gray-200 pt-6">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-100">{result ? 'Cerrar' : 'Cancelar'}</button>
          {!result && (
            <button type="submit" disabled={!archivo || !fechaInicial || !fechaFinal || saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-3 font-medium text-white shadow-lg shadow-blue-500/30 transition-all hover:from-blue-600 hover:to-blue-700 disabled:opacity-60">
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileSpreadsheet className="h-5 w-5" />}
              Agregar al Listado CUMPLIMIENTOS
            </button>
          )}
        </div>
      </form>
    </ModalShell>
  );
}

export function ActualizarDesdeSentenciasModal({
  isOpen,
  onClose,
  onValidate,
  onUpdate,
  validado,
  saving,
  error,
  result,
}: {
  isOpen: boolean;
  onClose: () => void;
  onValidate: (archivo: File | null) => SaveResult;
  onUpdate: (archivo: File | null) => SaveResult;
  validado?: boolean;
  saving?: boolean;
  error?: string;
  result?: ResultMap | null;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setArchivo(null);
  }, [isOpen]);

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title="Actualizar desde Sentencias" icon={<RefreshCw className="h-6 w-6" />} maxWidth="max-w-2xl">
      <div className="overflow-y-auto p-8">
        <div className="mb-8 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex gap-3">
            <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
            <p className="text-sm leading-relaxed text-blue-700"><strong>Instruccion:</strong> Seleccione un archivo Excel actualizado de sentencias. El sistema comparara con los expedientes existentes en cumplimientos y actualizara los datos que hayan cambiado.</p>
          </div>
        </div>
        <div className="mb-8 space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><FileSpreadsheet className="h-4 w-4 text-blue-600" />Archivo Sentencias Actualizado</label>
          <input id="modal-file-actualizar" type="file" accept=".xlsx,.xls" onChange={(e) => setArchivo(e.target.files?.[0] || null)} className="hidden" />
          <label htmlFor="modal-file-actualizar" className="group flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-300 px-6 py-12 transition-all hover:border-blue-500 hover:bg-blue-50">
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-xl bg-gray-100 p-4 transition-colors group-hover:bg-blue-100"><FileSpreadsheet className="h-12 w-12 text-gray-500 transition-colors group-hover:text-blue-600" /></div>
              <div className="text-center">
                <p className="text-base font-semibold text-gray-900">{archivo ? archivo.name : 'Seleccionar Archivo Excel'}</p>
                <p className="mt-2 text-sm text-gray-500">{archivo ? `${(archivo.size / 1024).toFixed(2)} KB` : 'Haz clic para seleccionar un archivo .xlsx o .xls'}</p>
              </div>
            </div>
          </label>
        </div>
        {validado && !result && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">
            <div className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
              <div>
                <h4 className="mb-1 text-sm font-semibold text-green-900">Archivo validado</h4>
                <p className="text-sm text-green-800">La hoja SENTENCIAS contiene la estructura requerida y esta lista para actualizar CUMPLIMIENTOS.</p>
              </div>
            </div>
          </div>
        )}
        <ResultStats title="Actualizacion Completada en Listado CUMPLIMIENTOS" result={result} labels={{ indexados: 'Indexados', localizados: 'Localizados', actualizados: 'Actualizados', noLocalizados: 'No Localizados', errores: 'Errores' }} />
        <ErrorBox error={error} />
        <div className="mt-8 flex items-center gap-3 border-t border-gray-200 pt-6">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-100">{result ? 'Cerrar' : 'Cancelar'}</button>
          {!result && !validado && (
            <button type="button" onClick={() => onValidate(archivo)} disabled={!archivo || saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-3 font-medium text-white shadow-lg shadow-blue-500/30 transition-all hover:from-blue-600 hover:to-blue-700 disabled:opacity-60">
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
              Validar Archivo
            </button>
          )}
          {!result && validado && (
            <button type="button" onClick={() => onUpdate(archivo)} disabled={!archivo || saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-3 font-medium text-white shadow-lg shadow-blue-500/30 transition-all hover:from-blue-600 hover:to-blue-700 disabled:opacity-60">
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
              Actualizar CUMPLIMIENTOS
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

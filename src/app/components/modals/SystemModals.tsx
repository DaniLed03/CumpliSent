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
  Save,
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
    setSelected((current) => {
      const isChecking = !current.includes(permissionId);
      let next = isChecking 
        ? [...current, permissionId]
        : current.filter((id) => id !== permissionId);
      
      if (!isChecking) {
        if (permissionId === 'view.cumplimientos') {
          next = next.filter(id => !grouped['CUMPLIMIENTOS']?.find(p => p.IdPermiso === id));
        } else if (permissionId === 'view.dias_inhabiles') {
          next = next.filter(id => !grouped['DIAS INHABILES']?.find(p => p.IdPermiso === id));
        } else if (permissionId === 'view.servidor') {
          next = next.filter(id => !grouped['SERVIDOR']?.find(p => p.IdPermiso === id));
        } else if (permissionId === 'view.usuarios') {
          next = next.filter(id => !grouped['USUARIOS']?.find(p => p.IdPermiso === id));
        } else if (permissionId === 'view.roles') {
          next = next.filter(id => !grouped['ROLES Y PERMISOS']?.find(p => p.IdPermiso === id));
        } else if (permissionId === 'mesas.view') {
          next = next.filter(id => id === 'mesas.view' || !grouped['MESAS DE TRÁMITE']?.find(p => p.IdPermiso === id));
        }
        
        if (permissionId === 'trabajo.view_my_mesa' || permissionId === 'trabajo.view_all_mesas') {
          const hasMyMesa = next.includes('trabajo.view_my_mesa');
          const hasAllMesas = next.includes('trabajo.view_all_mesas');
          if (!hasMyMesa && !hasAllMesas) {
            next = next.filter(id => id === 'trabajo.view_my_mesa' || id === 'trabajo.view_all_mesas' || !grouped['TRABAJO DIARIO']?.find(p => p.IdPermiso === id));
          }
        }
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await onSave({ NombreRol: nombreRol.trim().toUpperCase(), Permisos: selected });
    if (result !== false) onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 700 }}
      >
        <div className="flex items-center justify-between px-5 py-4 bg-[#1e40af] text-white rounded-t-xl shrink-0">
          <h3 className="text-sm font-bold tracking-wide uppercase flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-200" />
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-white/15 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 bg-white">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-blue-600" />
                Nombre del Rol
              </label>
              <input
                value={nombreRol}
                onChange={(e) => setNombreRol(e.target.value)}
                placeholder="NOMBRE DEL ROL"
                className="w-full h-11 px-4 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af] transition-all uppercase font-medium shadow-sm"
                required
              />
            </div>

            <div className="space-y-4">
              {Object.entries(grouped).map(([category, items]) => {
                if (category === 'CUMPLIMIENTOS' && !selected.includes('view.cumplimientos')) return null;
                if (category === 'DIAS INHABILES' && !selected.includes('view.dias_inhabiles')) return null;
                if (category === 'SERVIDOR' && !selected.includes('view.servidor')) return null;
                if (category === 'USUARIOS' && !selected.includes('view.usuarios')) return null;
                if (category === 'ROLES Y PERMISOS' && !selected.includes('view.roles')) return null;
                
                let visibleItems = items;
                if (category === 'MESAS DE TRÁMITE' && !selected.includes('mesas.view')) {
                  visibleItems = items.filter(p => p.IdPermiso === 'mesas.view');
                }
                if (category === 'TRABAJO DIARIO' && !selected.includes('trabajo.view_my_mesa') && !selected.includes('trabajo.view_all_mesas')) {
                  visibleItems = items.filter(p => p.IdPermiso === 'trabajo.view_my_mesa' || p.IdPermiso === 'trabajo.view_all_mesas');
                }
                if (visibleItems.length === 0) return null;

                return (
                  <div key={category} className="rounded-lg border border-slate-200 overflow-hidden bg-white shadow-sm">
                    <div className="bg-slate-50/80 px-4 py-2.5 border-b border-slate-100">
                      <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">{category}</h4>
                    </div>
                    <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5 bg-white">
                      {visibleItems.map((permission) => {
                        const checked = selected.includes(permission.IdPermiso);
                        return (
                          <label
                            key={permission.IdPermiso}
                            className="group flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(permission.IdPermiso)}
                              disabled={!canAssignPermissions}
                              className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-[#1e40af] focus:ring-[#1e40af]"
                            />
                            <span className="text-[12px] font-medium text-slate-600 group-hover:text-slate-900">{permission.NombrePermiso}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="text-[13px] font-medium">{error}</span>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-slate-100 bg-white rounded-b-xl shrink-0">
            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#1e40af] text-white rounded-lg text-sm font-semibold hover:bg-blue-800 transition-colors disabled:opacity-50 shadow-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Guardar Permisos
            </button>
          </div>
        </form>
      </div>
    </div>
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[99999] flex items-center justify-center p-4" onClick={onClose}>
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
            onClick={onClose}
            className="p-1 hover:bg-white/15 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 bg-white">
            
            {/* Buscar Expediente */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Buscar Expediente (Juicio)</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input 
                  value={busqueda} 
                  onChange={(e) => { setBusqueda(e.target.value); setSelected(null); setNuevaMesa(''); }} 
                  placeholder="Escribe el No. de Juicio o Expediente..." 
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af] transition-all shadow-sm" 
                  required 
                />
                {resultados.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                    {resultados.map((exp) => (
                      <button 
                        key={exp.id} 
                        type="button" 
                        onClick={() => { setSelected(exp); setBusqueda(exp.numeroJuicio || ''); setNuevaMesa(exp.idMesa ? String(exp.idMesa) : ''); setObservaciones(exp.observacionesMesa || ''); }} 
                        className="flex w-full items-center justify-between gap-4 px-4 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-blue-50 hover:text-[#1e40af]"
                      >
                        <span className="font-semibold">{exp.numeroJuicio}</span>
                        <span className="text-xs text-slate-500">Orden {exp.numeroOrden || '-'}</span>
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
                  <span className="text-xs font-semibold text-slate-700">{selected?.numeroOrden || '-'}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Juicio/Exp</span>
                  <span className="text-[13px] font-bold text-[#1e40af]">{selected?.numeroJuicio || '-'}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mesa Actual</span>
                  <span className="text-xs font-semibold text-slate-700">{selected ? (currentMesa?.MESA || 'Sin mesa') : '-'}</span>
                </div>
              </div>
            </div>

            {/* Nueva Mesa */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Seleccionar Nueva Mesa</label>
              <div className="relative">
                <select 
                  value={nuevaMesa} 
                  onChange={(e) => setNuevaMesa(e.target.value)} 
                  className="h-11 w-full appearance-none rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af] transition-all shadow-sm" 
                  required
                >
                  <option value="">Seleccione una mesa...</option>
                  {mesas.filter((mesa) => mesa.ACTIVO === 1 || Number(mesa.ID_MESA) === Number(selected?.idMesa)).map((mesa) => <option key={mesa.ID_MESA} value={mesa.ID_MESA}>{mesaLabel(mesa)}</option>)}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Motivo u Observaciones</label>
              <textarea 
                value={observaciones} 
                onChange={(e) => setObservaciones(e.target.value)} 
                placeholder="Escribe el motivo del cambio..." 
                className="w-full resize-none rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af] transition-all shadow-sm placeholder:text-slate-300" 
                style={{ height: '100px' }}
                required 
              />
            </div>

            {error && (
              <div className="mt-4"><ErrorBox error={error} /></div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-slate-100 bg-white rounded-b-xl shrink-0">
            <button
              type="submit"
              disabled={saving || !selected}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#1e40af] text-white rounded-lg text-sm font-semibold hover:bg-blue-800 transition-colors disabled:opacity-50 shadow-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar Reasignación
            </button>
          </div>
        </form>
      </div>
    </div>
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[99999] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 640 }}
      >
        <div className="flex items-center justify-between px-5 py-4 bg-[#1e40af] text-white rounded-t-xl shrink-0">
          <h3 className="text-sm font-bold tracking-wide uppercase flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-blue-200" />
            Agregar Nuevos Expedientes por Rango
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-white/15 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 bg-white">
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm flex items-start gap-3">
              <Info className="w-5 h-5 text-[#1e40af] shrink-0 mt-0.5" />
              <div>
                <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Instrucción</span>
                <p className="text-xs text-slate-600">Seleccione un archivo Excel con expedientes y defina el rango de fechas de ejecutoria para filtrar los expedientes que desea agregar al listado CUMPLIMIENTOS.</p>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Archivo Sentencias</label>
              <input id="modal-file-agregar" type="file" accept=".xlsx,.xls,.xlsm" onChange={(e) => setArchivo(e.target.files?.[0] || null)} className="hidden" required />
              <label htmlFor="modal-file-agregar" className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-300 px-6 py-6 transition-all hover:border-[#1e40af] hover:bg-blue-50">
                <div className="flex flex-col items-center gap-2">
                  <div className="rounded-lg bg-slate-100 p-3"><FileSpreadsheet className="w-6 h-6 text-slate-500" /></div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-700">{archivo ? archivo.name : 'Seleccionar Archivo Excel'}</p>
                    <p className="text-xs text-slate-500 mt-1">{archivo ? `${(archivo.size / 1024).toFixed(2)} KB` : 'Haz clic para seleccionar un archivo .xlsx o .xls'}</p>
                  </div>
                </div>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha Inicial de Ejecutoria</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="date" value={fechaInicial} onChange={(e) => setFechaInicial(e.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af] transition-all shadow-sm" required />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha Final de Ejecutoria</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="date" value={fechaFinal} onChange={(e) => setFechaFinal(e.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af] transition-all shadow-sm" required />
                </div>
              </div>
            </div>

            {result && (
              <div className="mt-4">
                <ResultStats title="Expedientes Agregados al Listado CUMPLIMIENTOS" result={result} labels={{ total: 'Procesados', nuevos: 'Insertados', duplicados: 'Duplicados', omitidos: 'Omitidos' }} />
              </div>
            )}
            
            {error && (
              <div className="mt-4">
                <ErrorBox error={error} />
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-slate-100 bg-white rounded-b-xl shrink-0">
            {result ? (
              <button
                type="button"
                onClick={onClose}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors shadow-sm"
              >
                Cerrar
              </button>
            ) : (
              <button
                type="submit"
                disabled={!archivo || !fechaInicial || !fechaFinal || saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#1e40af] text-white rounded-lg text-sm font-semibold hover:bg-blue-800 transition-colors disabled:opacity-50 shadow-sm"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Agregar al Listado CUMPLIMIENTOS
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
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

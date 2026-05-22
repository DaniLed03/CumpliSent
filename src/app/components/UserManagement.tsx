import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Edit,
  Shield,
  CheckCircle,
  XCircle,
  Save,
  X,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Search,
} from 'lucide-react';
import { showStyledAlert } from '../utils/alert';
import { toastSuccess } from '../utils/toast';

export default function UserManagement({
  canCreate = true,
  canEdit = true,
}: {
  canCreate?: boolean;
  canEdit?: boolean;
}) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Form fields
  const [formUsuario, setFormUsuario] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formShowPassword, setFormShowPassword] = useState(false);
  const [formNombre, setFormNombre] = useState('');
  const [formIdRol, setFormIdRol] = useState(3);
  const [formActivo, setFormActivo] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([
        window.api.listUsers(),
        window.api.listRoles(),
      ]);
      setUsers(u);
      setRoles(r);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function resetForm() {
    setFormUsuario('');
    setFormPassword('');
    setFormShowPassword(false);
    setFormNombre('');
    setFormIdRol(3);
    setFormActivo(true);
    setFormError('');
    setEditingUser(null);
    setShowForm(false);
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(user: UserRecord) {
    setEditingUser(user);
    setFormUsuario(user.Usuario);
    setFormPassword('');
    setFormShowPassword(false);
    setFormNombre(user.NombreCompleto);
    setFormIdRol(user.IdRol);
    setFormActivo(user.Activo);
    setFormError('');
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      if (editingUser) {
        // Update
        const updateData: any = {
          IdRol: formIdRol,
          Activo: formActivo,
          NombreCompleto: formNombre,
        };
        if (formPassword) {
          updateData.Password = formPassword;
        }
        const result = await window.api.updateUser(editingUser.IdUsuario, updateData);
        if (!result.ok) {
          setFormError(result.error || 'Error al actualizar');
          showStyledAlert({
            title: 'Error del sistema',
            text: result.error || 'Error al actualizar',
            icon: 'error',
          });
          setFormLoading(false);
          return;
        }
      } else {
        // Create
        if (!formUsuario || !formPassword) {
          setFormError('Usuario y contraseña son requeridos');
          setFormLoading(false);
          return;
        }
        const result = await window.api.createUser({
          Usuario: formUsuario,
          Password: formPassword,
          IdRol: formIdRol,
          NombreCompleto: formNombre,
        });
        if (!result.ok) {
          setFormError(result.error || 'Error al crear usuario');
          showStyledAlert({
            title: 'Error del sistema',
            text: result.error || 'Error al crear usuario',
            icon: 'error',
          });
          setFormLoading(false);
          return;
        }
      }

      resetForm();
      await loadData();
      toastSuccess('Operacion completada', 'Los cambios se guardaron correctamente.');
    } catch (err: any) {
      setFormError(err.message || 'Error inesperado');
      showStyledAlert({
        title: 'Error del sistema',
        text: err.message || 'Error inesperado',
        icon: 'error',
      });
    } finally {
      setFormLoading(false);
    }
  }

  const filteredUsers = users.filter(
    (u) =>
      u.Usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.NombreCompleto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.Rol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function getRoleBadgeClass(rol: string) {
    switch (rol) {
      case 'ADMINISTRADOR':
        return 'role-admin';
      case 'JUEZ':
        return 'role-juez';
      case 'SECRETARIO':
        return 'role-secretario';
      case 'OFICIAL JUDICIAL C':
        return 'role-oficial';
      default:
        return 'role-default';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="user-mgmt space-y-4">
      {/* Toolbar */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Users className="w-5 h-5 text-primary" />
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar usuarios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-input-background border border-input rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          {canCreate && (
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Nuevo Usuario
            </button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          {filteredUsers.length} de {users.length} usuario(s)
        </p>
      </div>

      {/* Users table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">Usuario</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">Nombre</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">Rol</th>
                <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider text-[10px]">Estado</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">Creado</th>
                <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider text-[10px]">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.map((user) => (
                <tr key={user.IdUsuario} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{user.Usuario}</td>
                  <td className="px-4 py-3 text-muted-foreground">{user.NombreCompleto || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`user-role-badge ${getRoleBadgeClass(user.Rol)}`}>
                      <Shield className="w-3 h-3" />
                      {user.Rol}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {user.Activo ? (
                      <span className="inline-flex items-center gap-1 text-green-600">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-medium">Activo</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-500">
                        <XCircle className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-medium">Inactivo</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{user.FechaCreacion || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {canEdit && (
                      <button
                        onClick={() => openEdit(user)}
                        className="p-1.5 hover:bg-accent rounded-md transition-colors"
                        title="Editar usuario"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-xs">
                    No se encontraron usuarios
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal form */}
      {showForm && (
        <div className="user-form-overlay" onClick={() => resetForm()}>
          <div className="user-form-modal module-modal-shell" onClick={(e) => e.stopPropagation()}>
            <div className="module-modal-header">
              <h3 className="module-modal-title">
                {editingUser ? 'Editar usuario' : 'Nuevo usuario'}
              </h3>
              <button onClick={resetForm} className="p-1 hover:bg-blue-700 rounded-md transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="module-modal-body space-y-4">
              {/* Username */}
              <div className="module-field">
                <label className="module-label">Usuario</label>
                <input
                  type="text"
                  value={formUsuario}
                  onChange={(e) => setFormUsuario(e.target.value)}
                  disabled={!!editingUser}
                  className="module-input disabled:opacity-50"
                  placeholder="nombre_usuario"
                  required
                />
              </div>

              {/* Full name */}
              <div className="module-field">
                <label className="module-label">Nombre Completo</label>
                <input
                  type="text"
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  className="module-input"
                  placeholder="Nombre completo"
                />
              </div>

              {/* Password */}
              <div className="module-field">
                <label className="module-label">
                  {editingUser ? 'Nueva Contraseña (dejar vacío para no cambiar)' : 'Contraseña'}
                </label>
                <div className="relative">
                  <input
                    type={formShowPassword ? 'text' : 'password'}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="module-input pr-9"
                    placeholder={editingUser ? '••••••••' : 'Contraseña'}
                    required={!editingUser}
                  />
                  <button
                    type="button"
                    onClick={() => setFormShowPassword(!formShowPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded transition-colors"
                    tabIndex={-1}
                  >
                    {formShowPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Role */}
              <div className="module-field">
                <label className="module-label">Rol</label>
                <select
                  value={formIdRol}
                  onChange={(e) => setFormIdRol(Number(e.target.value))}
                  className="module-select"
                >
                  {roles.map((r) => (
                    <option key={r.IdRol} value={r.IdRol}>
                      {r.NombreRol}
                    </option>
                  ))}
                </select>
              </div>

              {/* Active */}
              {editingUser && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="form-activo"
                    checked={formActivo}
                    onChange={(e) => setFormActivo(e.target.checked)}
                    className="w-4 h-4 rounded border-input"
                  />
                  <label htmlFor="form-activo" className="text-xs font-medium">
                    Usuario activo
                  </label>
                </div>
              )}

              {/* Error */}
              {formError && (
                <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-100 rounded-lg text-red-700">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-[10px]">{formError}</span>
                </div>
              )}

              {/* Actions */}
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-5 py-2 bg-slate-100 text-slate-700 rounded-md text-sm font-bold hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex items-center gap-1.5 px-5 py-2 bg-[#1e40af] text-white rounded-md text-sm font-bold hover:bg-blue-800 transition-colors disabled:opacity-50"
                >
                  {formLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

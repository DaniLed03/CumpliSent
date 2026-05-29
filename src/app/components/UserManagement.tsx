import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  User,
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
  Trash2,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { showStyledAlert } from '../utils/alert';
import { toastSuccess } from '../utils/toast';
import { EditarUsuarioModal, NuevoUsuarioModal } from './modals/SystemModals';

export default function UserManagement({
  canCreate = true,
  canEdit = true,
  canAssignMesa = false,
}: {
  canCreate?: boolean;
  canEdit?: boolean;
  canAssignMesa?: boolean;
}) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [mesas, setMesas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserRecord | null>(null);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Form fields
  const [formUsuario, setFormUsuario] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formShowPassword, setFormShowPassword] = useState(false);
  const [formNombre, setFormNombre] = useState('');
  const [formIdRol, setFormIdRol] = useState(3);
  const [formActivo, setFormActivo] = useState(true);
  const [formIdMesa, setFormIdMesa] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [u, r, m] = await Promise.all([
        window.api.listUsers(),
        window.api.listRoles(),
        window.api.listMesas(),
      ]);
      setUsers(u);
      setRoles(r);
      setMesas(m || []);
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
    setFormIdMesa(null);
    setFormError('');
    setEditingUser(null);
    setShowForm(false);
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(user: any) {
    setEditingUser(user);
    setFormUsuario(user.Usuario);
    setFormPassword('');
    setFormShowPassword(false);
    setFormNombre(user.NombreCompleto);
    setFormIdRol(user.IdRol);
    setFormActivo(user.Activo);
    setFormIdMesa(user.IdMesa || null);
    setFormError('');
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      if (editingUser) {
        const updateData: any = {
          IdRol: formIdRol,
          Activo: formActivo,
          NombreCompleto: formNombre,
        };
        if (canAssignMesa) {
          updateData.IdMesa = formIdMesa;
        }
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
          IdMesa: canAssignMesa ? formIdMesa : null,
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

  async function handleCreateUserModal(userData: {
    Usuario: string;
    NombreCompleto: string;
    Password: string;
    IdRol: number;
    IdMesa: number | null;
  }) {
    setFormError('');
    setFormLoading(true);

    try {
      if (!userData.Usuario || !userData.Password) {
        setFormError('Usuario y contrasena son requeridos');
        return false;
      }

      const result = await window.api.createUser({
        Usuario: userData.Usuario,
        Password: userData.Password,
        IdRol: userData.IdRol,
        NombreCompleto: userData.NombreCompleto,
        IdMesa: canAssignMesa ? userData.IdMesa : null,
      });

      if (!result.ok) {
        setFormError(result.error || 'Error al crear usuario');
        showStyledAlert({
          title: 'Error del sistema',
          text: result.error || 'Error al crear usuario',
          icon: 'error',
        });
        return false;
      }

      resetForm();
      await loadData();
      toastSuccess('Operacion completada', 'Los cambios se guardaron correctamente.');
      return true;
    } catch (err: any) {
      setFormError(err.message || 'Error inesperado');
      showStyledAlert({
        title: 'Error del sistema',
        text: err.message || 'Error inesperado',
        icon: 'error',
      });
      return false;
    } finally {
      setFormLoading(false);
    }
  }

  async function handleEditUserModal(userData: {
    NombreCompleto: string;
    Password?: string;
    IdRol: number;
    IdMesa?: number | null;
    Activo: boolean;
  }) {
    if (!editingUser) return false;
    setFormError('');
    setFormLoading(true);

    try {
      const updateData: any = {
        IdRol: userData.IdRol,
        Activo: userData.Activo,
        NombreCompleto: userData.NombreCompleto,
      };
      if (canAssignMesa) {
        updateData.IdMesa = userData.IdMesa ?? null;
      }
      if (userData.Password) {
        updateData.Password = userData.Password;
      }

      const result = await window.api.updateUser(editingUser.IdUsuario, updateData);
      if (!result.ok) {
        setFormError(result.error || 'Error al actualizar');
        showStyledAlert({
          title: 'Error del sistema',
          text: result.error || 'Error al actualizar',
          icon: 'error',
        });
        return false;
      }

      resetForm();
      await loadData();
      toastSuccess('Operacion completada', 'Los cambios se guardaron correctamente.');
      return true;
    } catch (err: any) {
      setFormError(err.message || 'Error inesperado');
      showStyledAlert({
        title: 'Error del sistema',
        text: err.message || 'Error inesperado',
        icon: 'error',
      });
      return false;
    } finally {
      setFormLoading(false);
    }
  }

  const handleDeleteUser = (user: UserRecord) => {
    setDeletingUser(user);
  };

  const confirmDeleteUser = async () => {
    if (!deletingUser) return;
    try {
      const res = await window.api.deleteUser(deletingUser.IdUsuario);
      if (!res.ok) {
        showStyledAlert({
          title: 'Error del sistema',
          text: res.error || 'Error al eliminar usuario',
          icon: 'error',
        });
        return;
      }
      setDeletingUser(null);
      await loadData();
      toastSuccess('Operación completada', 'El usuario fue eliminado correctamente.');
    } catch (error: any) {
      showStyledAlert({
        title: 'Error del sistema',
        text: error?.message || 'Error inesperado',
        icon: 'error',
      });
    }
  };

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
            <thead className="bg-[#1e40af] text-white sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">Usuario</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">Nombre</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">Rol</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">Mesa</th>
                <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider text-[10px]">Estado</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">Creado</th>
                <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider text-[10px]">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.map((user: any) => (
                <tr key={user.IdUsuario} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{user.Usuario}</td>
                  <td className="px-4 py-3 text-muted-foreground">{user.NombreCompleto || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`user-role-badge ${getRoleBadgeClass(user.Rol)}`}>
                      <Shield className="w-3 h-3" />
                      {user.Rol}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {mesas.find(m => m.ID_MESA === user.IdMesa)?.MESA || '—'}
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
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(user)}
                          className="p-1.5 hover:bg-accent rounded-md transition-colors"
                          title="Editar usuario"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="p-1.5 hover:bg-red-100 text-red-600 rounded-md transition-colors inline-flex"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-xs">
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[99999] flex items-center justify-center p-4" onClick={resetForm}>
          <div
            className="bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 500 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-[#1e40af] text-white rounded-t-xl shrink-0">
              <h3 className="text-sm font-bold tracking-wide uppercase flex items-center gap-2">
                <User className="w-4 h-4 text-blue-200" />
                {editingUser ? 'EDITAR USUARIO' : 'NUEVO USUARIO'}
              </h3>
              <button
                type="button"
                onClick={resetForm}
                className="p-1 hover:bg-white/15 rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-white">
                {/* Usuario */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Usuario</label>
                  <input
                    type="text"
                    value={formUsuario}
                    onChange={(e) => setFormUsuario(e.target.value)}
                    disabled={!!editingUser}
                    className="w-full h-11 px-4 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af] transition-all disabled:opacity-50 disabled:bg-slate-50 shadow-sm"
                    placeholder="nombre_usuario"
                    required
                  />
                </div>

                {/* Nombre Completo */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre completo</label>
                  <input
                    type="text"
                    value={formNombre}
                    onChange={(e) => setFormNombre(e.target.value)}
                    className="w-full h-11 px-4 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af] transition-all shadow-sm"
                    placeholder="Nombre completo"
                  />
                </div>

                {/* Contraseña */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {editingUser ? 'Nueva contraseña' : 'Contraseña'}
                  </label>
                  {editingUser && (
                    <p className="text-[10px] text-slate-400 -mt-1.5 mb-2 font-medium">Dejar vacío para no cambiar</p>
                  )}
                  <div className="relative">
                    <input
                      type={formShowPassword ? 'text' : 'password'}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      className="w-full h-11 px-4 pr-10 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af] transition-all shadow-sm"
                      placeholder="••••••••"
                      required={!editingUser}
                    />
                    <button
                      type="button"
                      onClick={() => setFormShowPassword(!formShowPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#1e40af] transition-colors"
                      tabIndex={-1}
                    >
                      {formShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Rol + Mesa side-by-side */}
                <div className={`grid gap-4 ${canAssignMesa ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Rol</label>
                    <Select
                      value={formIdRol.toString()}
                      onValueChange={(val) => setFormIdRol(Number(val))}
                    >
                      <SelectTrigger className="w-full h-11 px-4 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:ring-[#1e40af]/20 focus:border-[#1e40af] focus:ring-4 transition-all shadow-sm">
                        <SelectValue placeholder="Seleccione un rol" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((r) => (
                          <SelectItem key={r.IdRol} value={r.IdRol.toString()}>
                            {r.NombreRol}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {canAssignMesa && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Mesa</label>
                      <Select
                        value={formIdMesa ? formIdMesa.toString() : "none"}
                        onValueChange={(val) => setFormIdMesa(val === "none" ? null : Number(val))}
                      >
                        <SelectTrigger className="w-full h-11 px-4 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:ring-[#1e40af]/20 focus:border-[#1e40af] focus:ring-4 transition-all shadow-sm">
                          <SelectValue placeholder="Sin mesa" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin mesa</SelectItem>
                          {mesas.filter(m => m.ACTIVO === 1 || m.ID_MESA === formIdMesa).map((m) => (
                            <SelectItem key={m.ID_MESA} value={m.ID_MESA.toString()}>
                              {m.MESA} - {m.NOMBRE || 'Sin encargado'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Activo toggle */}
                {editingUser && (
                  <label className="flex items-center gap-3 cursor-pointer select-none py-1 group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={formActivo}
                        onChange={(e) => setFormActivo(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-slate-200 rounded-full peer-checked:bg-[#1e40af] transition-colors" />
                      <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-5" />
                    </div>
                    <span className="text-[12px] font-bold text-slate-600 group-hover:text-slate-900 transition-colors uppercase tracking-wide">Usuario activo</span>
                  </label>
                )}

                {/* Error */}
                {formError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 mt-4">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-[13px] font-medium">{formError}</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-100 bg-white rounded-b-xl shrink-0">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#1e40af] text-white rounded-lg text-sm font-semibold hover:bg-blue-800 transition-colors disabled:opacity-50 shadow-sm"
                >
                  {formLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deletingUser && createPortal(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">
                ¿Eliminar usuario {deletingUser.Usuario}?
              </h3>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setDeletingUser(null)}
                className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteUser}
                className="flex-1 flex justify-center items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm shadow-sm"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

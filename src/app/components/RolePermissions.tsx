import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  KeyRound,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Edit,
  Trash2,
} from 'lucide-react';
import { showStyledAlert } from '../utils/alert';
import { toastSuccess } from '../utils/toast';
import { NuevoRolModal } from './modals/SystemModals';

export default function RolePermissions({
  canCreate = true,
  canEdit = true,
  canAssignPermissions = true,
}: {
  canCreate?: boolean;
  canEdit?: boolean;
  canAssignPermissions?: boolean;
}) {
  const [roles, setRoles] = useState<RoleWithPermissionsRecord[]>([]);
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleWithPermissionsRecord | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingRole, setDeletingRole] = useState<RoleWithPermissionsRecord | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [roleRows, permissionRows] = await Promise.all([
        window.api.listRolesWithPermissions(),
        window.api.listPermissions(),
      ]);
      setRoles(roleRows);
      setPermissions(permissionRows);
    } catch (error: any) {
      showStyledAlert({
        title: 'Error del sistema',
        text: error?.message || 'No se pudieron cargar los roles y permisos.',
        icon: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredRoles = roles.filter((role) => {
    const term = searchTerm.toLowerCase();
    return (
      role.NombreRol.toLowerCase().includes(term) ||
      role.Permisos.some((permissionId) => permissionId.toLowerCase().includes(term))
    );
  });

  function resetForm() {
    setShowForm(false);
    setEditingRole(null);
    setFormError('');
    setSaving(false);
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(role: RoleWithPermissionsRecord) {
    setEditingRole(role);
    setFormError('');
    setShowForm(true);
  }

  async function handleSave(rolData: { NombreRol: string; Permisos: string[] }) {
    setFormError('');
    setSaving(true);
    try {
      const payload = {
        NombreRol: rolData.NombreRol,
        Permisos: canAssignPermissions ? rolData.Permisos : editingRole?.Permisos || [],
      };
      const result = editingRole
        ? await window.api.updateRole(editingRole.IdRol, payload)
        : await window.api.createRole(payload);

      if (!result.ok) {
        setFormError(result.error || 'No se pudo guardar el rol');
        return false;
      }

      resetForm();
      await loadData();
      toastSuccess('Operacion completada', 'Los permisos del rol se guardaron correctamente.');
      return true;
    } catch (error: any) {
      setFormError(error?.message || 'Error inesperado');
      showStyledAlert({
        title: 'Error del sistema',
        text: error?.message || 'Error inesperado',
        icon: 'error',
      });
      return false;
    } finally {
      setSaving(false);
    }
  }

  const handleDeleteRole = (role: RoleWithPermissionsRecord) => {
    setDeletingRole(role);
  };

  const confirmDeleteRole = async () => {
    if (!deletingRole) return;
    try {
      const res = await window.api.deleteRole(deletingRole.IdRol);
      if (!res.ok) {
        showStyledAlert({
          title: 'Error del sistema',
          text: res.error || 'Error al eliminar rol',
          icon: 'error',
        });
        return;
      }
      setDeletingRole(null);
      await loadData();
      toastSuccess('Operación completada', 'El rol fue eliminado correctamente.');
    } catch (error: any) {
      showStyledAlert({
        title: 'Error del sistema',
        text: error?.message || 'Error inesperado',
        icon: 'error',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar roles o permisos..."
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
              <Plus className="w-3.5 h-3.5" />
              Nuevo Rol
            </button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          {filteredRoles.length} de {roles.length} rol(es)
        </p>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#1e40af] text-white sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">Rol</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]">Permisos Asignados</th>
                <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider text-[10px]">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRoles.map((role) => (
                <tr key={role.IdRol} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 font-bold text-slate-800">
                      <KeyRound className="w-3.5 h-3.5 text-primary" />
                      {role.NombreRol}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {role.Permisos.length} permiso(s)
                  </td>
                  <td className="px-4 py-3 text-center">
                    {canEdit && (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(role)}
                          className="p-1.5 hover:bg-accent rounded-md transition-colors"
                          title="Editar rol"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRole(role)}
                          className="p-1.5 hover:bg-red-100 text-red-600 rounded-md transition-colors inline-flex"
                          title="Eliminar rol"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredRoles.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground text-xs">
                    No se encontraron roles
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <NuevoRolModal
        isOpen={showForm}
        onClose={resetForm}
        onSave={handleSave}
        permissions={permissions}
        initialData={editingRole ? { NombreRol: editingRole.NombreRol, Permisos: editingRole.Permisos || [] } : null}
        title={editingRole ? 'Editar Rol y Permisos' : 'Nuevo Rol'}
        canAssignPermissions={canAssignPermissions}
        saving={saving}
        error={formError}
      />

      {/* Delete Modal */}
      {deletingRole && createPortal(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">
                ¿Eliminar rol {deletingRole.NombreRol}?
              </h3>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setDeletingRole(null)}
                className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteRole}
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

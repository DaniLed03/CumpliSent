import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Edit,
  KeyRound,
  Loader2,
  Plus,
  Save,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { showStyledAlert } from '../utils/alert';
import { toastSuccess } from '../utils/toast';

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
  const [formName, setFormName] = useState('');
  const [formPermissions, setFormPermissions] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

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

  const groupedPermissions = useMemo(() => {
    return permissions.reduce<Record<string, PermissionRecord[]>>((acc, permission) => {
      const category = permission.Categoria || 'GENERAL';
      if (!acc[category]) acc[category] = [];
      acc[category].push(permission);
      return acc;
    }, {});
  }, [permissions]);

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
    setFormName('');
    setFormPermissions([]);
    setFormError('');
    setSaving(false);
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(role: RoleWithPermissionsRecord) {
    setEditingRole(role);
    setFormName(role.NombreRol);
    setFormPermissions(role.Permisos || []);
    setFormError('');
    setShowForm(true);
  }

  function togglePermission(permissionId: string) {
    setFormPermissions((current) =>
      current.includes(permissionId)
        ? current.filter((item) => item !== permissionId)
        : [...current, permissionId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) {
      setFormError('El nombre del rol es requerido');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        NombreRol: formName.trim().toUpperCase(),
        Permisos: canAssignPermissions ? formPermissions : editingRole?.Permisos || [],
      };
      const result = editingRole
        ? await window.api.updateRole(editingRole.IdRol, payload)
        : await window.api.createRole(payload);

      if (!result.ok) {
        setFormError(result.error || 'No se pudo guardar el rol');
        return;
      }

      resetForm();
      await loadData();
      toastSuccess('Operacion completada', 'Los permisos del rol se guardaron correctamente.');
    } catch (error: any) {
      setFormError(error?.message || 'Error inesperado');
      showStyledAlert({
        title: 'Error del sistema',
        text: error?.message || 'Error inesperado',
        icon: 'error',
      });
    } finally {
      setSaving(false);
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
            <thead className="bg-muted/50 border-b border-border">
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
                      <button
                        onClick={() => openEdit(role)}
                        className="p-1.5 hover:bg-accent rounded-md transition-colors"
                        title="Editar rol"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
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

      {showForm && (
        <div className="user-form-overlay" onClick={resetForm}>
          <div className="user-form-modal module-modal-shell max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <div className="module-modal-header">
              <h3 className="module-modal-title">
                {editingRole ? 'Editar rol y permisos' : 'Nuevo rol'}
              </h3>
              <button onClick={resetForm} className="p-1 hover:bg-blue-700 rounded-md transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="module-modal-body space-y-5 max-h-[70vh] overflow-y-auto">
                <div className="module-field">
                  <label className="module-label">Nombre del rol</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="module-input uppercase"
                    placeholder="NOMBRE DEL ROL"
                    required
                  />
                </div>

                <div className="space-y-4">
                  {Object.entries(groupedPermissions).map(([category, items]) => (
                    <div key={category} className="rounded-lg border border-slate-200 overflow-hidden">
                      <div className="bg-slate-100 px-4 py-2">
                        <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">{category}</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 p-4">
                        {items.map((permission) => {
                          const checked = formPermissions.includes(permission.IdPermiso);
                          return (
                            <button
                              key={permission.IdPermiso}
                              type="button"
                              onClick={() => canAssignPermissions && togglePermission(permission.IdPermiso)}
                              disabled={!canAssignPermissions}
                              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                                checked
                                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <span className={`flex h-4 w-4 items-center justify-center rounded border ${
                                checked ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'
                              }`}>
                                {checked && <Check className="w-3 h-3" />}
                              </span>
                              <span>{permission.NombrePermiso}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {formError && (
                  <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-100 rounded-lg text-red-700">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="text-[10px]">{formError}</span>
                  </div>
                )}
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
                  disabled={saving}
                  className="flex items-center gap-1.5 px-5 py-2 bg-[#1e40af] text-white rounded-md text-sm font-bold hover:bg-blue-800 transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Guardar Permisos
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

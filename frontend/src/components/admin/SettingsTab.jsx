import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSelector } from 'react-redux';
import { Plus, Edit2, Trash2, ShieldAlert, DollarSign, MessageSquare, X } from 'lucide-react';
import { adminApi } from '../../services/adminApi';

const SettingsTab = () => {
  const { user } = useSelector((state) => state.auth);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [adminForm, setAdminForm] = useState({
    name: '', email: '', password: '', role: 'Superadmin'
  });

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState({ isOpen: false });
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAdmins();
      if (res.data?.success && Array.isArray(res.data.admins)) {
        setAdmins(res.data.admins);
        setSelectedIds(new Set());
      }
    } catch (err) {
      console.error('Error fetching admins:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const isCurrentUserPrimary = Boolean(user?.isPrimary || user?.email?.toLowerCase() === 'admin@eminence.com');
  const currentUserRole = user?.adminRole || (isCurrentUserPrimary ? 'Superadmin' : 'Support Admin');
  const canManageAdmins = isCurrentUserPrimary || currentUserRole === 'Superadmin';

  const handleOpenCreateModal = () => {
    setEditMode(false);
    setCurrentItem(null);
    setAdminForm({ name: '', email: '', password: '', role: canManageAdmins ? 'Support Admin' : 'Support Admin' });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (admin) => {
    setEditMode(true);
    setCurrentItem(admin);
    const isTargetPrimary = Boolean(admin.isPrimary || admin.email?.toLowerCase() === 'admin@eminence.com');
    setAdminForm({
      name: admin.name || '',
      email: admin.email || '',
      password: '',
      role: isTargetPrimary ? 'Superadmin' : (admin.role || 'Support Admin')
    });
    setIsModalOpen(true);
  };

  const handleDeleteAdmin = async (id) => {
    if (admins.length <= 1) {
      alert('Cannot delete the only existing administrator');
      return;
    }
    if (user?.id && id === user.id) {
      alert('You cannot delete your own active administrator account');
      return;
    }
    const target = admins.find(a => a.id === id);
    const isTargetPrimary = Boolean(target?.isPrimary || target?.email?.toLowerCase() === 'admin@eminence.com');
    if (isTargetPrimary) {
      alert('The primary Super Administrator cannot be deleted');
      return;
    }
    const targetIsSuper = target?.role === 'Superadmin' || isTargetPrimary;
    if (!canManageAdmins) {
      alert('Permission denied: Only Superadmins can delete administrator accounts');
      return;
    }
    if (targetIsSuper && !isCurrentUserPrimary) {
      alert('Permission denied: Only the primary Super Administrator can delete Superadmin accounts');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete administrator ${target?.name || target?.email || ''}?`)) return;
    try {
      const res = await adminApi.deleteAdmin(id);
      if (res.data?.success) {
        fetchAdmins();
      }
    } catch (err) {
      console.error('Delete admin error:', err);
      alert(err.response?.data?.message || 'Delete operation failed');
    }
  };

  // Mass Bulk Selection Handlers
  // Exclude self, primary superadmin, and protected superadmins from deletable set
  const deletableAdmins = admins.filter(a => {
    const isSelf = user?.id === a.id;
    const isTargetPrimary = Boolean(a.isPrimary || a.email?.toLowerCase() === 'admin@eminence.com');
    const targetIsSuper = a.role === 'Superadmin' || isTargetPrimary;
    if (isSelf || isTargetPrimary || !canManageAdmins) return false;
    if (targetIsSuper && !isCurrentUserPrimary) return false;
    return true;
  });
  const isAllSelected = deletableAdmins.length > 0 && selectedIds.size === deletableAdmins.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(deletableAdmins.map(a => a.id)));
    }
  };

  const toggleSelectOne = (id) => {
    if (id === user?.id) return; // Prevent selecting self
    const target = admins.find(a => a.id === id);
    const isTargetPrimary = Boolean(target?.isPrimary || target?.email?.toLowerCase() === 'admin@eminence.com');
    if (isTargetPrimary) return;
    const targetIsSuper = target?.role === 'Superadmin' || isTargetPrimary;
    if (targetIsSuper && !isCurrentUserPrimary) return;
    if (!canManageAdmins) return;

    const updated = new Set(selectedIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedIds(updated);
  };

  const executeBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (admins.length - selectedIds.size < 1) {
      alert('Operation aborted: at least one administrator must remain active.');
      return;
    }
    setIsBulkDeleting(true);
    try {
      const res = await adminApi.bulkDeleteAdmins(Array.from(selectedIds));
      if (res.data?.success) {
        setBulkDeleteConfirm({ isOpen: false });
        setSelectedIds(new Set());
        fetchAdmins();
      }
    } catch (err) {
      console.error('Error bulk deleting admins:', err);
      alert(err.response?.data?.message || 'Bulk delete operation failed');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    try {
      if (editMode && currentItem) {
        await adminApi.updateAdmin(currentItem.id, adminForm);
      } else {
        await adminApi.createAdmin(adminForm);
      }
      setIsModalOpen(false);
      fetchAdmins();
    } catch (err) {
      console.error('Form submit error:', err);
      alert(err.response?.data?.message || 'Save operation failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-loft-50 font-serif">Roles & Permissions</h1>
          <p className="text-xs text-loft-400 mt-1">Manage platform administrators, permissions, and security roles</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <button
              id="bulk-delete-admins-btn"
              onClick={() => setBulkDeleteConfirm({ isOpen: true })}
              className="flex items-center gap-2 py-2 px-4 text-sm font-semibold rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 transition-all cursor-pointer shadow-lg animate-fade-in"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Selected ({selectedIds.size})</span>
            </button>
          )}
          <button 
            onClick={handleOpenCreateModal}
            className="btn-primary flex items-center gap-2 py-2 px-4 text-sm font-semibold rounded-xl cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Admin
          </button>
        </div>
      </div>

      <div className="card bg-loft-900 border-loft-800 overflow-hidden">
        <div className="p-6 border-b border-loft-800">
          <h3 className="text-lg font-bold text-loft-50">Admin Users</h3>
          <p className="text-sm text-loft-400">Manage dashboard access and role-based permissions.</p>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-loft-400">Loading administrators...</div>
          ) : (
            <table className="w-full text-left text-sm text-loft-300">
              <thead className="bg-loft-950/50 text-xs uppercase font-medium">
                <tr>
                  <th className="px-4 py-4 w-12 text-center">
                    <input
                      type="checkbox"
                      aria-label="Select all administrators"
                      checked={isAllSelected}
                      disabled={deletableAdmins.length === 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-loft-700 bg-loft-950 text-copper-500 focus:ring-copper-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    />
                  </th>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Created</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-loft-800">
                {admins.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-loft-500">
                      No administrators found.
                    </td>
                  </tr>
                ) : (
                  admins.map((admin) => {
                    const isSelf = user?.id === admin.id;
                    const isTargetPrimary = Boolean(admin.isPrimary || admin.email?.toLowerCase() === 'admin@eminence.com');
                    const targetIsSuper = admin.role === 'Superadmin' || isTargetPrimary;
                    const isSelected = selectedIds.has(admin.id);
                    const canDeleteThisAdmin = !isSelf && !isTargetPrimary && admins.length > 1 && canManageAdmins && (!targetIsSuper || isCurrentUserPrimary);
                    return (
                      <tr 
                        key={admin.id} 
                        className={`hover:bg-loft-800/50 transition-colors ${isSelected ? 'bg-copper-500/10' : ''}`}
                      >
                        <td className="px-4 py-4 text-center">
                          <input
                            type="checkbox"
                            aria-label={`Select ${admin.name || admin.email}`}
                            checked={isSelected}
                            disabled={!canDeleteThisAdmin}
                            onChange={() => toggleSelectOne(admin.id)}
                            className="w-4 h-4 rounded border-loft-700 bg-loft-950 text-copper-500 focus:ring-copper-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title={
                              isTargetPrimary
                                ? "The primary Super Administrator cannot be deleted"
                                : isSelf
                                  ? "You cannot delete your own account"
                                  : targetIsSuper && !isCurrentUserPrimary
                                    ? "Only the primary Super Administrator can delete Superadmin accounts"
                                    : !canManageAdmins
                                      ? "Only Superadmins can delete administrator accounts"
                                      : undefined
                            }
                          />
                        </td>
                        <td className="px-6 py-4 font-medium text-loft-100 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-copper-500/20 text-copper-500 flex items-center justify-center font-bold">
                            {(admin.name || 'A').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex items-center gap-2">
                            <span>{admin.name || 'Administrator'}</span>
                            {isSelf && (
                              <span className="text-[10px] bg-copper-500/20 text-copper-400 px-1.5 py-0.5 rounded font-mono font-semibold">
                                YOU
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">{admin.email}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`inline-block whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold border ${
                              targetIsSuper
                                ? 'bg-moss-500/20 text-moss-500 border-moss-500/30'
                                : admin.role === 'Finance Admin'
                                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                  : 'bg-copper-500/20 text-copper-400 border-copper-500/30'
                            }`}>
                              {isTargetPrimary ? 'Superadmin' : (admin.role || 'Support Admin')}
                            </span>
                            {isTargetPrimary && (
                              <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono font-bold" title="Protected System Root Superadmin">
                                ROOT
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : 'Active'}
                        </td>
                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                          <button 
                            onClick={() => handleOpenEditModal(admin)}
                            className="p-2 text-loft-400 hover:text-copper-500 rounded-lg hover:bg-loft-800 transition-colors cursor-pointer"
                            title="Edit Administrator"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteAdmin(admin.id)}
                            className={`p-2 rounded-lg transition-colors cursor-pointer ${
                              canDeleteThisAdmin
                                ? 'text-loft-400 hover:text-red-500 hover:bg-loft-800'
                                : 'text-loft-600 opacity-20 cursor-not-allowed'
                            }`}
                            disabled={!canDeleteThisAdmin}
                            title={
                              isTargetPrimary 
                                ? "The primary Super Administrator cannot be deleted" 
                                : isSelf 
                                  ? "Cannot delete your own account" 
                                  : targetIsSuper && !isCurrentUserPrimary 
                                    ? "Only the primary Super Administrator can delete Superadmin accounts" 
                                    : !canManageAdmins
                                      ? "Only Superadmins can delete administrator accounts"
                                      : admins.length <= 1 
                                        ? "Cannot delete the sole admin" 
                                        : "Delete Admin"
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="card p-6 bg-loft-900 border-loft-800">
          <h4 className="text-moss-500 font-bold mb-2 flex items-center gap-2"><ShieldAlert className="w-5 h-5"/> Superadmin</h4>
          <p className="text-loft-400 text-sm">Full access to all modules, settings, user management, and financials.</p>
        </div>
        <div className="card p-6 bg-loft-900 border-loft-800">
          <h4 className="text-blue-500 font-bold mb-2 flex items-center gap-2"><DollarSign className="w-5 h-5"/> Finance Admin</h4>
          <p className="text-loft-400 text-sm">Access to invoices, business contracts, and overall revenue analytics.</p>
        </div>
        <div className="card p-6 bg-loft-900 border-loft-800">
          <h4 className="text-copper-500 font-bold mb-2 flex items-center gap-2"><MessageSquare className="w-5 h-5"/> Support Admin</h4>
          <p className="text-loft-400 text-sm">Limited to the Support Inbox, tracking active trips, and driver management.</p>
        </div>
      </div>

      {isModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-loft-900 border border-loft-800 rounded-2xl max-w-md w-full p-6 sm:p-8 relative shadow-2xl max-h-[85vh] flex flex-col my-auto">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h2 className="text-2xl font-bold text-loft-50 font-serif capitalize">
                {editMode ? 'Edit' : 'Add'} Administrator
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-loft-400 hover:text-loft-100 p-1.5 rounded-lg hover:bg-loft-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitForm} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div>
                <label className="block text-xs font-semibold text-loft-300 uppercase tracking-wider mb-2">Name</label>
                <input 
                  type="text" required className="input-field" 
                  value={adminForm.name} onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-loft-300 uppercase tracking-wider mb-2">Email</label>
                <input 
                  type="email" required className="input-field" 
                  value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-loft-300 uppercase tracking-wider mb-2">
                  {editMode ? 'Reset Password (optional)' : 'Password'}
                </label>
                <input 
                  type="password" className="input-field" 
                  placeholder={editMode ? 'Leave blank to keep current' : 'Enter strong password'}
                  value={adminForm.password} 
                  required={!editMode}
                  onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-loft-300 uppercase tracking-wider mb-2">Role</label>
                <select 
                  className="input-field cursor-pointer bg-loft-950" 
                  value={adminForm.role}
                  disabled={editMode && (currentItem?.isPrimary || currentItem?.email?.toLowerCase() === 'admin@eminence.com')}
                  onChange={(e) => setAdminForm({ ...adminForm, role: e.target.value })}
                >
                  {(isCurrentUserPrimary || canManageAdmins) && (
                    <option value="Superadmin">Superadmin</option>
                  )}
                  <option value="Finance Admin">Finance Admin</option>
                  <option value="Support Admin">Support Admin</option>
                </select>
                {editMode && (currentItem?.isPrimary || currentItem?.email?.toLowerCase() === 'admin@eminence.com') && (
                  <p className="text-[11px] text-amber-400 mt-1">The primary Root Superadmin role cannot be modified.</p>
                )}
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-loft-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-loft-700 text-loft-300 hover:bg-loft-800 rounded-xl text-sm font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary py-2.5 px-5 text-sm font-semibold rounded-xl cursor-pointer">
                  {editMode ? 'Save Changes' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Bulk Delete Admins Confirm */}
      {bulkDeleteConfirm.isOpen && createPortal(
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <div className="bg-loft-900 border border-red-500/40 rounded-2xl max-w-md w-full p-6 relative shadow-2xl text-center my-auto">
            <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
              <Trash2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-loft-50 mb-2 font-serif">
              Bulk Delete {selectedIds.size} Administrators
            </h2>
            <p className="text-loft-300 text-sm mb-6 leading-relaxed">
              Are you sure you want to permanently revoke dashboard access and delete <strong className="text-red-400">{selectedIds.size}</strong> selected administrator accounts?
            </p>
            <div className="flex justify-center gap-3">
              <button 
                onClick={() => setBulkDeleteConfirm({ isOpen: false })}
                disabled={isBulkDeleting}
                className="px-5 py-2.5 bg-transparent border border-loft-700 hover:bg-loft-800 text-loft-300 rounded-xl text-sm font-semibold transition-all cursor-pointer flex-1 disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={executeBulkDelete}
                disabled={isBulkDeleting}
                className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer flex-1 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isBulkDeleting ? 'Deleting...' : `Confirm Delete (${selectedIds.size})`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SettingsTab;

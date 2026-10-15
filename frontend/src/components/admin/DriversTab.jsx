import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import { adminApi } from '../../services/adminApi';

const DriversTab = () => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null });
  const [driverForm, setDriverForm] = useState({
    name: '', phone: '', email: '', licenseNumber: '', status: 'active', password: ''
  });

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState({ isOpen: false });
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getDrivers();
      if (res.data.success) {
        setDrivers(res.data.drivers);
        setSelectedIds(new Set());
      }
    } catch (err) {
      console.error('Error fetching drivers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const handleOpenCreateModal = () => {
    setEditMode(false);
    setCurrentItem(null);
    setDriverForm({ name: '', phone: '', email: '', licenseNumber: '', status: 'active', password: '' });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item) => {
    setEditMode(true);
    setCurrentItem(item);
    setDriverForm({
      name: item.name || '',
      phone: item.phone || '',
      email: item.email || '',
      licenseNumber: item.licenseNumber || '',
      status: item.status || 'active',
      password: ''
    });
    setIsModalOpen(true);
  };

  const handleDeleteItem = (id) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const executeDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      const res = await adminApi.deleteDriver(deleteConfirm.id);
      if (res.data.success) {
        setDeleteConfirm({ isOpen: false, id: null });
        fetchDrivers();
      }
    } catch (err) {
      console.error('Error deleting driver:', err);
      alert(err.response?.data?.message || 'Delete operation failed');
      setDeleteConfirm({ isOpen: false, id: null });
    }
  };

  // Mass Bulk Selection Handlers
  const isAllSelected = drivers.length > 0 && selectedIds.size === drivers.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(drivers.map(d => d.id)));
    }
  };

  const toggleSelectOne = (id) => {
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
    setIsBulkDeleting(true);
    try {
      const res = await adminApi.bulkDeleteDrivers(Array.from(selectedIds));
      if (res.data.success) {
        setBulkDeleteConfirm({ isOpen: false });
        setSelectedIds(new Set());
        fetchDrivers();
      }
    } catch (err) {
      console.error('Error bulk deleting drivers:', err);
      alert(err.response?.data?.message || 'Bulk delete operation failed');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    try {
      if (editMode && currentItem) {
        await adminApi.updateDriver(currentItem.id, driverForm);
      } else {
        await adminApi.createDriver(driverForm);
      }
      setIsModalOpen(false);
      fetchDrivers();
    } catch (err) {
      console.error('Form submit error:', err);
      alert(err.response?.data?.message || 'Save operation failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-loft-50 font-serif">Manage Drivers</h1>
          <p className="text-xs text-loft-400 mt-1">View, track, and batch manage verified fleet drivers</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <button
              id="bulk-delete-drivers-btn"
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
            <Plus className="w-4 h-4" /> Add Driver
          </button>
        </div>
      </div>

      <div className="card bg-loft-900 border-loft-800 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-loft-400">Loading drivers...</div>
        ) : drivers.length === 0 ? (
          <div className="p-12 text-center text-loft-400">No drivers found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-loft-300">
              <thead className="bg-loft-950/50 text-xs uppercase font-medium">
                <tr>
                  <th className="px-4 py-4 w-12 text-center">
                    <input
                      type="checkbox"
                      aria-label="Select all drivers"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-loft-700 bg-loft-950 text-copper-500 focus:ring-copper-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Phone</th>
                  <th className="px-6 py-4">License Number</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-loft-800">
                {drivers.map((drv) => {
                  const isSelected = selectedIds.has(drv.id);
                  return (
                    <tr 
                      key={drv.id} 
                      className={`hover:bg-loft-800/50 transition-colors ${isSelected ? 'bg-copper-500/10' : ''}`}
                    >
                      <td className="px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          aria-label={`Select ${drv.name}`}
                          checked={isSelected}
                          onChange={() => toggleSelectOne(drv.id)}
                          className="w-4 h-4 rounded border-loft-700 bg-loft-950 text-copper-500 focus:ring-copper-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4 font-medium text-loft-100">{drv.name}</td>
                      <td className="px-6 py-4">{drv.phone}</td>
                      <td className="px-6 py-4">{drv.licenseNumber}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold capitalize ${
                          drv.status === 'active' ? 'bg-moss-500/10 text-moss-500' :
                          drv.status === 'on_trip' ? 'bg-copper-500/10 text-copper-500' : 'bg-loft-700 text-loft-400'
                        }`}>
                          {drv.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right flex justify-end gap-2">
                        <button 
                          onClick={() => handleOpenEditModal(drv)}
                          className="p-2 text-loft-400 hover:text-copper-500 rounded-lg hover:bg-loft-800 transition-colors"
                          title="Edit Driver"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteItem(drv.id)}
                          className="p-2 text-loft-400 hover:text-red-500 rounded-lg hover:bg-loft-800 transition-colors"
                          title="Delete Driver"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-loft-900 border border-loft-800 rounded-2xl max-w-md w-full p-6 sm:p-8 relative shadow-2xl max-h-[85vh] flex flex-col my-auto">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h2 className="text-2xl font-bold text-loft-50 font-serif capitalize">
                {editMode ? 'Edit' : 'Add'} Driver
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
                  value={driverForm.name} onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-loft-300 uppercase tracking-wider mb-2">Phone</label>
                <input 
                  type="text" required className="input-field" 
                  value={driverForm.phone} onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-loft-300 uppercase tracking-wider mb-2">Email</label>
                <input 
                  type="email" className="input-field" 
                  value={driverForm.email} onChange={(e) => setDriverForm({ ...driverForm, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-loft-300 uppercase tracking-wider mb-2">License Number</label>
                <input 
                  type="text" required className="input-field" 
                  value={driverForm.licenseNumber} onChange={(e) => setDriverForm({ ...driverForm, licenseNumber: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-loft-300 uppercase tracking-wider mb-2">Status</label>
                <select 
                  className="input-field"
                  value={driverForm.status}
                  onChange={(e) => setDriverForm({ ...driverForm, status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="on_trip">On Trip</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-loft-300 uppercase tracking-wider mb-2">
                  {editMode ? 'Reset Password (optional)' : 'Password'}
                </label>
                <input 
                  type="password" className="input-field" 
                  placeholder={editMode ? 'Leave blank to keep current' : 'Enter password'}
                  value={driverForm.password} 
                  required={!editMode}
                  onChange={(e) => setDriverForm({ ...driverForm, password: e.target.value })}
                />
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
                  {editMode ? 'Save Changes' : 'Create Driver'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Single Driver Confirm */}
      {deleteConfirm.isOpen && createPortal(
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <div className="bg-loft-900 border border-loft-800 rounded-2xl max-w-sm w-full p-6 relative shadow-2xl text-center my-auto">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-loft-50 mb-2 font-serif capitalize">Delete Driver</h2>
            <p className="text-loft-400 text-sm mb-6">Are you sure you want to delete this driver? This action cannot be undone.</p>
            <div className="flex justify-center gap-3">
              <button 
                onClick={() => setDeleteConfirm({ isOpen: false, id: null })}
                className="px-5 py-2.5 bg-transparent border border-loft-700 hover:bg-loft-800 text-loft-300 rounded-xl text-sm font-semibold transition-all cursor-pointer flex-1"
              >
                Cancel
              </button>
              <button onClick={executeDelete} className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer flex-1">
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Bulk Delete Drivers Confirm */}
      {bulkDeleteConfirm.isOpen && createPortal(
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <div className="bg-loft-900 border border-red-500/40 rounded-2xl max-w-md w-full p-6 relative shadow-2xl text-center my-auto">
            <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
              <Trash2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-loft-50 mb-2 font-serif">
              Bulk Delete {selectedIds.size} Drivers
            </h2>
            <p className="text-loft-300 text-sm mb-6 leading-relaxed">
              Are you sure you want to permanently delete all <strong className="text-red-400">{selectedIds.size}</strong> selected drivers? This operation cannot be reversed.
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

export default DriversTab;

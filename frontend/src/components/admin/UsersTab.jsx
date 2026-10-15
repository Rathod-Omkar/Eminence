import { createPortal } from 'react-dom';
import { Plus, Edit2, Trash2, X, CheckSquare, Square } from 'lucide-react';
import { useAdminUsers } from '../../hooks/useAdminUsers';

const UsersTab = () => {
  const {
    customers, loading, isModalOpen, editMode, deleteConfirm, customerForm,
    selectedIds, bulkDeleteConfirm, isBulkDeleting,
    setCustomerForm, setIsModalOpen, setDeleteConfirm, setBulkDeleteConfirm,
    toggleSelectAll, toggleSelectOne, executeBulkDelete,
    handleOpenCreateModal, handleOpenEditModal, handleDeleteItem, executeDelete, handleSubmitForm
  } = useAdminUsers();

  const isAllSelected = customers.length > 0 && selectedIds.size === customers.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-loft-50 font-serif">Manage Users</h1>
          <p className="text-xs text-loft-400 mt-1">View, manage, and batch delete customer accounts</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <button
              id="bulk-delete-users-btn"
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
            <Plus className="w-4 h-4" /> Add User
          </button>
        </div>
      </div>

      <div className="card bg-loft-900 border-loft-800 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-loft-400">Loading customers...</div>
        ) : customers.length === 0 ? (
          <div className="p-12 text-center text-loft-400">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-loft-300">
              <thead className="bg-loft-950/50 text-xs uppercase font-medium">
                <tr>
                  <th className="px-4 py-4 w-12 text-center">
                    <input
                      type="checkbox"
                      aria-label="Select all customers"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-loft-700 bg-loft-950 text-copper-500 focus:ring-copper-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Phone</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">City</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-loft-800">
                {customers.map((cust) => {
                  const isSelected = selectedIds.has(cust.id);
                  return (
                    <tr 
                      key={cust.id} 
                      className={`hover:bg-loft-800/50 transition-colors ${isSelected ? 'bg-copper-500/10' : ''}`}
                    >
                      <td className="px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          aria-label={`Select ${cust.name || cust.email}`}
                          checked={isSelected}
                          onChange={() => toggleSelectOne(cust.id)}
                          className="w-4 h-4 rounded border-loft-700 bg-loft-950 text-copper-500 focus:ring-copper-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4 font-medium text-loft-100 flex items-center gap-2">
                        <span>{cust.name || 'N/A'}</span>
                        {cust.isPro && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 font-bold border border-yellow-500/30">
                            PRO
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">{cust.phone || 'N/A'}</td>
                      <td className="px-6 py-4">{cust.email || 'N/A'}</td>
                      <td className="px-6 py-4">{cust.city || 'N/A'}</td>
                      <td className="px-6 py-4 text-right flex justify-end gap-2">
                        <button 
                          onClick={() => handleOpenEditModal(cust)}
                          className="p-2 text-loft-400 hover:text-copper-500 rounded-lg hover:bg-loft-800 transition-colors"
                          title="Edit User"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteItem(cust.id)}
                          className="p-2 text-loft-400 hover:text-red-500 rounded-lg hover:bg-loft-800 transition-colors"
                          title="Delete User"
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

      {/* CRUD Modal */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-loft-900 border border-loft-800 rounded-2xl max-w-md w-full p-6 sm:p-8 relative shadow-2xl max-h-[85vh] flex flex-col my-auto">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h2 className="text-2xl font-bold text-loft-50 font-serif capitalize">
                {editMode ? 'Edit' : 'Add'} Customer
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
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-loft-300 uppercase tracking-wider mb-2">Phone</label>
                <input 
                  type="text" required className="input-field" 
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-loft-300 uppercase tracking-wider mb-2">Email</label>
                <input 
                  type="email" className="input-field" 
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-loft-300 uppercase tracking-wider mb-2">City</label>
                  <input 
                    type="text" className="input-field" 
                    value={customerForm.city}
                    onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-loft-300 uppercase tracking-wider mb-2">State</label>
                  <input 
                    type="text" className="input-field" 
                    value={customerForm.state}
                    onChange={(e) => setCustomerForm({ ...customerForm, state: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-loft-300 uppercase tracking-wider mb-2">Address</label>
                <textarea 
                  className="input-field" rows="3"
                  value={customerForm.address}
                  onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
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
                <button
                  type="submit"
                  className="btn-primary py-2 px-6 text-sm font-semibold rounded-xl cursor-pointer"
                >
                  {editMode ? 'Save Changes' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Single Customer Confirm */}
      {deleteConfirm.isOpen && createPortal(
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <div className="bg-loft-900 border border-loft-800 rounded-2xl max-w-sm w-full p-6 relative shadow-2xl text-center my-auto">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-loft-50 mb-2 font-serif capitalize">
              Delete Customer
            </h2>
            <p className="text-loft-400 text-sm mb-6">
              Are you sure you want to delete this customer? This action cannot be undone.
            </p>
            <div className="flex justify-center gap-3">
              <button 
                onClick={() => setDeleteConfirm({ isOpen: false, id: null })}
                className="px-5 py-2.5 bg-transparent border border-loft-700 hover:bg-loft-800 text-loft-300 rounded-xl text-sm font-semibold transition-all cursor-pointer flex-1"
              >
                Cancel
              </button>
              <button 
                onClick={executeDelete}
                className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer flex-1"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Bulk Delete Customers Confirm */}
      {bulkDeleteConfirm.isOpen && createPortal(
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <div className="bg-loft-900 border border-red-500/40 rounded-2xl max-w-md w-full p-6 relative shadow-2xl text-center my-auto">
            <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
              <Trash2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-loft-50 mb-2 font-serif">
              Bulk Delete {selectedIds.size} Customers
            </h2>
            <p className="text-loft-300 text-sm mb-6 leading-relaxed">
              Are you sure you want to permanently delete all <strong className="text-red-400">{selectedIds.size}</strong> selected customer accounts? All associated wallets and addresses will also be removed.
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

export default UsersTab;

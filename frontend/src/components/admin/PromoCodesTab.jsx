import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Tag, Plus, Trash2, Edit3, CheckCircle, XCircle, Clock, AlertCircle, RefreshCw, X } from 'lucide-react';
import api from '../../services/api';

const PromoCodesTab = () => {
  const [promoCodes, setPromoCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discountType: 'FLAT',
    discountValue: 100,
    maxDiscount: '',
    minOrderValue: 0,
    maxUses: '',
    expiresAt: '',
    isActive: true
  });

  const fetchPromoCodes = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/admin/promocodes');
      setPromoCodes(res.data.promoCodes || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch promo codes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromoCodes();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    // Default expiration: 30 days from now in YYYY-MM-DD format
    const defaultDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setFormData({
      code: '',
      description: '',
      discountType: 'FLAT',
      discountValue: 100,
      maxDiscount: '',
      minOrderValue: 0,
      maxUses: '',
      expiresAt: defaultDate,
      isActive: true
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setFormData({
      code: item.code,
      description: item.description || '',
      discountType: item.discountType || 'FLAT',
      discountValue: item.discountValue || 100,
      maxDiscount: item.maxDiscount || '',
      minOrderValue: item.minOrderValue || 0,
      maxUses: item.maxUses || '',
      expiresAt: item.expiresAt ? new Date(item.expiresAt).toISOString().split('T')[0] : '',
      isActive: Boolean(item.isActive)
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingId) {
        await api.put(`/api/admin/promocodes/${editingId}`, formData);
        setSuccess('Promo code updated successfully!');
      } else {
        await api.post('/api/admin/promocodes', formData);
        setSuccess('Promo code created successfully!');
      }
      setIsModalOpen(false);
      fetchPromoCodes();
    } catch (err) {
      setError(err.response?.data?.message || 'Error saving promo code');
    }
  };

  const handleDelete = async (id, code) => {
    if (!window.confirm(`Are you sure you want to delete promo code "${code}"?`)) return;
    try {
      await api.delete(`/api/admin/promocodes/${id}`);
      setSuccess(`Deleted promo code ${code}`);
      fetchPromoCodes();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete promo code');
    }
  };

  const isExpired = (expiryDate) => {
    return new Date() > new Date(expiryDate);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-loft-50 font-serif flex items-center gap-2">
            <Tag className="w-6 h-6 text-copper-500" /> Promo & Referral Codes
          </h2>
          <p className="text-loft-400 text-sm">
            Create, update, manage expiration dates, and delete promotional & referral discounts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchPromoCodes}
            className="p-2.5 bg-loft-900 border border-loft-800 hover:bg-loft-800 text-loft-300 rounded-xl transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openCreateModal}
            className="btn-primary py-2.5 px-4 text-sm flex items-center gap-2 shadow-lg cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Promo Code
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setError('')} 
            className="p-1 hover:bg-red-500/20 rounded-lg text-red-400 hover:text-red-300 transition-colors cursor-pointer"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-sm flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>{success}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setSuccess('')} 
            className="p-1 hover:bg-emerald-500/20 rounded-lg text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Promo Codes Table */}
      <div className="card bg-loft-900 border-loft-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-loft-300">
            <thead className="bg-loft-950/60 text-xs uppercase tracking-wider text-loft-400 border-b border-loft-800">
              <tr>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Discount</th>
                <th className="px-6 py-4">Usage</th>
                <th className="px-6 py-4">Expire Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-loft-800/50">
              {promoCodes.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-loft-500">
                    {loading ? 'Loading promo codes...' : 'No promo codes configured yet. Click "Add Promo Code" above.'}
                  </td>
                </tr>
              ) : (
                promoCodes.map((item) => {
                  const expired = isExpired(item.expiresAt);
                  return (
                    <tr key={item.id} className="hover:bg-loft-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-mono font-bold text-copper-400 text-base">{item.code}</div>
                        {item.description && (
                          <div className="text-xs text-loft-500 truncate max-w-xs">{item.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-loft-100">
                          {item.discountType === 'FLAT' ? `₹${item.discountValue}` : `${item.discountValue}%`}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-loft-300">
                          {item.usedCount || 0} {item.maxUses ? `/ ${item.maxUses}` : 'uses'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <Clock className={`w-4 h-4 ${expired ? 'text-red-400' : 'text-loft-400'}`} />
                          <span className={expired ? 'text-red-400 font-medium' : 'text-loft-200'}>
                            {new Date(item.expiresAt).toLocaleDateString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {expired ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                            <XCircle className="w-3 h-3" /> Expired
                          </span>
                        ) : item.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                            <AlertCircle className="w-3 h-3" /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1.5 text-loft-400 hover:text-loft-100 hover:bg-loft-800 rounded-lg transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.code)}
                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for Create / Edit */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md overflow-y-auto">
          <div className="card w-full max-w-lg bg-loft-900 border border-loft-800 p-6 sm:p-8 rounded-2xl shadow-2xl relative max-h-[85vh] flex flex-col my-auto">
            <div className="flex justify-between items-center mb-2 shrink-0">
              <h3 className="text-xl font-bold text-loft-50 font-serif">
                {editingId ? 'Edit Promo Code' : 'Create New Promo Code'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-loft-400 hover:text-loft-100 p-1.5 rounded-lg hover:bg-loft-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-loft-400 text-xs mb-6 shrink-0">
              Configure promo discount values, usage limits, and expiration cutoff.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div>
                <label className="block text-xs font-medium text-loft-300 mb-1">Code</label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingId)}
                  placeholder="e.g. FESTIVE100"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="input-field font-mono font-bold tracking-wider"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-loft-300 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. ₹100 Flat discount on first booking"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-loft-300 mb-1">Discount Type</label>
                  <select
                    value={formData.discountType}
                    onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                    className="input-field cursor-pointer"
                  >
                    <option value="FLAT">Flat (₹)</option>
                    <option value="PERCENTAGE">Percentage (%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-loft-300 mb-1">Discount Value</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.discountValue}
                    onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-loft-300 mb-1">Max Uses (Optional)</label>
                  <input
                    type="number"
                    placeholder="Unlimited if empty"
                    min="1"
                    value={formData.maxUses}
                    onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-loft-300 mb-1">Expiration Date</label>
                  <input
                    type="date"
                    required
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                    className="input-field cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-loft-700 bg-loft-950 text-copper-500 focus:ring-copper-500 h-4 w-4 cursor-pointer"
                />
                <label htmlFor="isActive" className="text-xs text-loft-300 font-medium cursor-pointer select-none">
                  Active (enable promo code for checkout & referral claims)
                </label>
              </div>

              <div className="flex gap-4 pt-6 border-t border-loft-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary w-full cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary w-full cursor-pointer"
                >
                  {editingId ? 'Save Changes' : 'Create Promo Code'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default PromoCodesTab;

import api from './api';

export const adminApi = {
  getOverviewStats: () => api.get('/api/admin/stats/overview'),
  getRevenueStats: () => api.get('/api/admin/stats/revenue'),
  getRouteStats: () => api.get('/api/admin/stats/routes'),
  getCustomers: () => api.get('/api/admin/customers'),
  getDrivers: () => api.get('/api/admin/drivers'),
  getVehicles: () => api.get('/api/admin/vehicles'),
  getContracts: () => api.get('/api/admin/contracts'),
  
  createCustomer: (data) => api.post('/api/admin/customers', data),
  updateCustomer: (id, data) => api.put(`/api/admin/customers/${id}`, data),
  deleteCustomer: (id) => api.delete(`/api/admin/customers/${id}`),
  bulkDeleteCustomers: (ids) => api.post('/api/admin/customers/bulk-delete', { ids }),
  
  createDriver: (data) => api.post('/api/admin/drivers', data),
  updateDriver: (id, data) => api.put(`/api/admin/drivers/${id}`, data),
  deleteDriver: (id) => api.delete(`/api/admin/drivers/${id}`),
  bulkDeleteDrivers: (ids) => api.post('/api/admin/drivers/bulk-delete', { ids }),
  
  createVehicle: (data) => api.post('/api/admin/vehicles', data),
  updateVehicle: (id, data) => api.put(`/api/admin/vehicles/${id}`, data),
  deleteVehicle: (id) => api.delete(`/api/admin/vehicles/${id}`),
  
  createContract: (data) => api.post('/api/admin/contracts', data),
  updateContract: (id, data) => api.put(`/api/admin/contracts/${id}`, data),
  
  getAdmins: () => api.get('/api/admin/admins'),
  createAdmin: (data) => api.post('/api/admin/admins', data),
  updateAdmin: (id, data) => api.put(`/api/admin/admins/${id}`, data),
  deleteAdmin: (id) => api.delete(`/api/admin/admins/${id}`),
  bulkDeleteAdmins: (ids) => api.post('/api/admin/admins/bulk-delete', { ids }),

  // Booking assignment by Admin
  getBookings: () => api.get('/api/bookings'),
  assignDriverToBooking: (bookingId, driverId) => api.put(`/api/bookings/${bookingId}/status`, { status: 'driver_assigned', driverId })
};

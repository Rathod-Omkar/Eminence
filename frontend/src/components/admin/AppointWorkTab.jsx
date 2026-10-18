import { useState, useEffect, useMemo } from 'react';
import { 
  UserCheck, Clock, Truck, CheckCircle2, 
  Search, RefreshCw, AlertCircle, ArrowRight, ShieldCheck, MapPin, AlertTriangle
} from 'lucide-react';
import { adminApi } from '../../services/adminApi';

const AppointWorkTab = () => {
  const [bookings, setBookings] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [assigningId, setAssigningId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending'); // 'pending' | 'active' | 'completed' | 'expired' | 'all'
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }

  const fetchData = async () => {
    setLoading(true);
    try {
      const [driversRes, bookingsRes, vehiclesRes] = await Promise.all([
        adminApi.getDrivers(),
        adminApi.getBookings(),
        adminApi.getVehicles()
      ]);

      if (driversRes.data?.success) {
        setDrivers(driversRes.data.drivers || []);
      }
      if (bookingsRes.data?.success) {
        setBookings(bookingsRes.data.bookings || []);
      }
      if (vehiclesRes.data?.success) {
        setVehicles(vehiclesRes.data.vehicles || []);
      }
    } catch (err) {
      console.error('Error fetching dispatch data:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to load bookings and driver fleet.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAppointBooking = async (bookingId, driverId, vehicleId) => {
    if (!driverId) return;
    setAssigningId(bookingId);
    setFeedback(null);

    const selectedDriver = drivers.find(d => String(d.id) === String(driverId));
    const driverName = selectedDriver ? selectedDriver.name : 'Driver';
    const currentQueue = driverQueueMap[driverId] || [];
    const isNewQueue = !currentQueue.some(b => b.id === bookingId);
    const queuePos = isNewQueue ? currentQueue.length + 1 : 1;

    try {
      await adminApi.assignDriverToBooking(bookingId, driverId, vehicleId);
      setFeedback({
        type: 'success',
        message: `Booking #${bookingId ? bookingId.slice(0, 8) : ''} successfully appointed to ${driverName} (Delivery #${queuePos} in Queue)!`
      });
      await fetchData();
    } catch (err) {
      console.error('Error appointing trip to driver:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to appoint trip to driver. Please try again.'
      });
    } finally {
      setAssigningId(null);
    }
  };

  const handleCompleteBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to mark this delivery as completed from admin? This will advance the driver\'s delivery queue.')) {
      return;
    }
    setAssigningId(bookingId);
    setFeedback(null);
    try {
      await adminApi.completeBooking(bookingId);
      setFeedback({
        type: 'success',
        message: `Booking #${bookingId ? bookingId.slice(0, 8) : ''} marked as completed! Driver queue updated.`
      });
      await fetchData();
    } catch (err) {
      console.error('Error completing booking from admin:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to complete trip. Please try again.'
      });
    } finally {
      setAssigningId(null);
    }
  };

  // Map each driver to their active/queued bookings
  const driverQueueMap = useMemo(() => {
    const map = {};
    drivers.forEach(d => { map[d.id] = []; });
    bookings.forEach(b => {
      if (b.driverId && ['driver_assigned', 'arrived', 'in_transit'].includes(b.status)) {
        if (!map[b.driverId]) map[b.driverId] = [];
        map[b.driverId].push(b);
      }
    });
    Object.keys(map).forEach(dId => {
      map[dId].sort((a, b) => (a.queuePosition || 1) - (b.queuePosition || 1));
    });
    return map;
  }, [drivers, bookings]);

  // Drivers available for work or taking additional queue deliveries
  const assignableDrivers = useMemo(() => {
    return drivers.filter(d => d.status !== 'inactive');
  }, [drivers]);

  // Helpers to unambiguously classify bookings across all states
  const isBookingExpired = (b) => {
    if (!b) return false;
    if (b.status === 'expired') return true;
    if (b.status === 'cancelled' && (
      b.cancellationReason?.toLowerCase().includes('expire') ||
      b.cancellationReason?.toLowerCase().includes('untouched')
    )) {
      return true;
    }
    // Untouched pending booking past expiry deadline without driver
    if (b.status === 'pending' && !b.driverId) {
      if (b.expiresAt && new Date() >= new Date(b.expiresAt)) return true;
      if (!b.expiresAt && b.createdAt && (Date.now() - new Date(b.createdAt).getTime() >= 24 * 60 * 60 * 1000)) return true;
    }
    return false;
  };

  const isBookingPending = (b) => {
    if (!b) return false;
    if (isBookingExpired(b)) return false;
    if (b.status === 'cancelled' || b.status === 'completed') return false;
    return b.status === 'pending' || !b.driverId;
  };

  const isBookingActive = (b) => {
    if (!b) return false;
    if (isBookingExpired(b) || b.status === 'cancelled' || b.status === 'completed') return false;
    return ['driver_assigned', 'arrived', 'in_transit'].includes(b.status);
  };

  const isBookingCompleted = (b) => {
    if (!b) return false;
    return b.status === 'completed';
  };

  // Statistics calculation for all tabs and KPI cards
  const stats = useMemo(() => {
    const pending = bookings.filter(b => isBookingPending(b)).length;
    const inProgress = bookings.filter(b => isBookingActive(b)).length;
    const completed = bookings.filter(b => isBookingCompleted(b)).length;
    const expired = bookings.filter(b => isBookingExpired(b)).length;
    return {
      pending,
      inProgress,
      completed,
      expired,
      availableDrivers: assignableDrivers.length,
      totalDrivers: drivers.length
    };
  }, [bookings, assignableDrivers, drivers]);

  // Filtered bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      // Status filter
      if (statusFilter === 'pending') {
        if (!isBookingPending(b)) return false;
      } else if (statusFilter === 'active') {
        if (!isBookingActive(b)) return false;
      } else if (statusFilter === 'completed') {
        if (!isBookingCompleted(b)) return false;
      } else if (statusFilter === 'expired') {
        if (!isBookingExpired(b)) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = b.id?.toLowerCase().includes(q);
        const matchesPickup = b.pickupAddress?.toLowerCase().includes(q);
        const matchesDrop = b.dropAddress?.toLowerCase().includes(q);
        const matchesGoods = b.goodsType?.toLowerCase().includes(q);
        const matchesCustomer = b.customer?.name?.toLowerCase().includes(q) || b.customer?.phone?.includes(q);
        const matchesDriver = b.driver?.name?.toLowerCase().includes(q) || b.driver?.phone?.includes(q);
        const matchesReason = b.cancellationReason?.toLowerCase().includes(q);

        return matchesId || matchesPickup || matchesDrop || matchesGoods || matchesCustomer || matchesDriver || matchesReason;
      }

      return true;
    });
  }, [bookings, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-loft-50 font-serif flex items-center gap-3">
            <UserCheck className="w-8 h-8 text-copper-500" />
            Appoint Work to Drivers
          </h1>
          <p className="text-sm text-loft-400 mt-1">
            Dispatch pending customer shipments to qualified fleet drivers in real time.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="btn-outline flex items-center gap-2 py-2 px-4 text-xs font-semibold rounded-xl text-loft-300 hover:text-loft-50 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Dispatches
        </button>
      </div>

      {/* Action / Notification Feedback Banner */}
      {feedback && (
        <div 
          className={`p-4 rounded-xl border flex items-center justify-between text-sm transition-all ${
            feedback.type === 'success' 
              ? 'bg-moss-500/10 border-moss-500/30 text-moss-400' 
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          <div className="flex items-center gap-3">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-moss-400" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button 
            onClick={() => setFeedback(null)} 
            className="text-xs uppercase tracking-wider font-semibold opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="card bg-loft-900 border-loft-800 p-4 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-copper-500/10 border border-copper-500/20 flex items-center justify-center text-copper-500">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-loft-400 uppercase tracking-wider font-semibold">Pending Work</p>
            <p className="text-2xl font-bold text-loft-50">{stats.pending}</p>
          </div>
        </div>

        <div className="card bg-loft-900 border-loft-800 p-4 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-loft-400 uppercase tracking-wider font-semibold">Active Dispatches</p>
            <p className="text-2xl font-bold text-loft-50">{stats.inProgress}</p>
          </div>
        </div>

        <div className="card bg-loft-900 border-loft-800 p-4 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-moss-500/10 border border-moss-500/20 flex items-center justify-center text-moss-500">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-loft-400 uppercase tracking-wider font-semibold">Available Drivers</p>
            <p className="text-2xl font-bold text-loft-50">
              {stats.availableDrivers} <span className="text-xs text-loft-500 font-normal">/ {stats.totalDrivers}</span>
            </p>
          </div>
        </div>

        <div className="card bg-loft-900 border-loft-800 p-4 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-loft-400 uppercase tracking-wider font-semibold">Completed Trips</p>
            <p className="text-2xl font-bold text-loft-50">{stats.completed}</p>
          </div>
        </div>

        <div className="card bg-loft-900 border-loft-800 p-4 rounded-2xl flex items-center gap-4 col-span-2 md:col-span-1">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-loft-400 uppercase tracking-wider font-semibold">Expired Trips</p>
            <p className="text-2xl font-bold text-loft-50">{stats.expired}</p>
          </div>
        </div>
      </div>

      {/* Dedicated Company Fleet & Multi-Delivery Queue Overview */}
      <div className="card bg-loft-900 border-loft-800 p-5 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-loft-800">
          <div>
            <h3 className="text-base font-bold text-loft-50 flex items-center gap-2">
              <Truck className="w-5 h-5 text-copper-500" />
              Limited Company Fleet (8 Tempos) & Driver Queues
            </h3>
            <p className="text-xs text-loft-400 mt-0.5">
              Optimized fleet allocation for multi-delivery assignment. Appointing multiple jobs adds them sequentially to the driver's delivery queue.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-loft-950 border border-loft-800 text-copper-400">
              Active Fleet: 8 Tempos
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              title: "1x Mahindra Bolero Pickup",
              sub: "Large Capacity • 1750 kg",
              fuel: "Diesel",
              regs: vehicles.filter(v => v.model?.includes('Bolero')).map(v => v.registrationNumber),
              color: "border-copper-500/30 bg-copper-500/5 text-copper-400"
            },
            {
              title: "1x Ashok Leyland Dost",
              sub: "Medium Capacity • 1500 kg",
              fuel: "Diesel",
              regs: vehicles.filter(v => v.model?.includes('Dost')).map(v => v.registrationNumber),
              color: "border-blue-500/30 bg-blue-500/5 text-blue-400"
            },
            {
              title: "4x Tata Ace Gold",
              sub: "Small • 750 kg (1 Petrol, 3 CNG)",
              fuel: "1 Petrol, 3 CNG",
              regs: vehicles.filter(v => v.model?.includes('Tata Ace')).map(v => v.registrationNumber),
              color: "border-moss-500/30 bg-moss-500/5 text-moss-400"
            },
            {
              title: "2x Mahindra Chotta Hatti",
              sub: "Small Capacity • 750 kg",
              fuel: "Diesel",
              regs: vehicles.filter(v => v.model?.includes('Chotta Hatti')).map(v => v.registrationNumber),
              color: "border-purple-500/30 bg-purple-500/5 text-purple-400"
            }
          ].map((item, idx) => (
            <div key={idx} className={`p-3.5 rounded-xl border ${item.color}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-loft-100">{item.title}</span>
                <span className="text-[10px] font-mono uppercase bg-loft-950/80 px-2 py-0.5 rounded border border-loft-800">
                  {item.fuel}
                </span>
              </div>
              <p className="text-[11px] text-loft-400">{item.sub}</p>
              <div className="mt-2 pt-2 border-t border-loft-800/60 flex flex-wrap gap-1">
                {item.regs.length > 0 ? (
                  item.regs.map((r, i) => (
                    <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-loft-950 border border-loft-800 text-loft-300">
                      {r}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-loft-500">Ready in Fleet</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card bg-loft-900 border-loft-800 p-4 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors flex items-center gap-2 ${
              statusFilter === 'pending'
                ? 'bg-copper-500 text-white shadow-lg shadow-copper-500/20'
                : 'bg-loft-800/60 text-loft-400 hover:text-loft-100 hover:bg-loft-800'
            }`}
          >
            Pending Dispatch
            {stats.pending > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                statusFilter === 'pending' ? 'bg-white/20 text-white' : 'bg-copper-500/20 text-copper-400'
              }`}>
                {stats.pending}
              </span>
            )}
          </button>

          <button
            onClick={() => setStatusFilter('active')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors flex items-center gap-2 ${
              statusFilter === 'active'
                ? 'bg-copper-500 text-white shadow-lg shadow-copper-500/20'
                : 'bg-loft-800/60 text-loft-400 hover:text-loft-100 hover:bg-loft-800'
            }`}
          >
            Assigned / In Transit
            {stats.inProgress > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                statusFilter === 'active' ? 'bg-white/20 text-white' : 'bg-blue-500/20 text-blue-400'
              }`}>
                {stats.inProgress}
              </span>
            )}
          </button>

          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors flex items-center gap-2 ${
              statusFilter === 'completed'
                ? 'bg-copper-500 text-white shadow-lg shadow-copper-500/20'
                : 'bg-loft-800/60 text-loft-400 hover:text-loft-100 hover:bg-loft-800'
            }`}
          >
            Completed
            {stats.completed > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                statusFilter === 'completed' ? 'bg-white/20 text-white' : 'bg-moss-500/20 text-moss-400'
              }`}>
                {stats.completed}
              </span>
            )}
          </button>

          <button
            onClick={() => setStatusFilter('expired')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors flex items-center gap-2 ${
              statusFilter === 'expired'
                ? 'bg-copper-500 text-white shadow-lg shadow-copper-500/20'
                : 'bg-loft-800/60 text-loft-400 hover:text-loft-100 hover:bg-loft-800'
            }`}
          >
            Expired
            {stats.expired > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                statusFilter === 'expired' ? 'bg-white/20 text-white' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {stats.expired}
              </span>
            )}
          </button>

          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              statusFilter === 'all'
                ? 'bg-copper-500 text-white shadow-lg shadow-copper-500/20'
                : 'bg-loft-800/60 text-loft-400 hover:text-loft-100 hover:bg-loft-800'
            }`}
          >
            All Bookings ({bookings.length})
          </button>
        </div>

        {/* Search input */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-loft-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ID, route, customer..."
            className="input-field py-2 pl-9 pr-3 text-xs w-full bg-loft-950 border-loft-800"
          />
        </div>
      </div>

      {/* Work Appointments Table */}
      <div className="card bg-loft-900 border-loft-800 overflow-hidden rounded-2xl">
        {loading && bookings.length === 0 ? (
          <div className="p-16 text-center text-loft-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-copper-500" />
            <p className="text-sm">Loading dispatch records and fleet drivers...</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="p-16 text-center text-loft-400 flex flex-col items-center justify-center gap-3">
            <UserCheck className="w-12 h-12 text-loft-600 mb-1" />
            <p className="text-base font-semibold text-loft-200">
              {statusFilter === 'pending'
                ? 'All customer bookings are currently appointed!'
                : statusFilter === 'active'
                ? 'No active shipments currently in transit.'
                : statusFilter === 'completed'
                ? 'No completed deliveries found.'
                : statusFilter === 'expired'
                ? 'No expired bookings found.'
                : 'No bookings found matching the current criteria.'}
            </p>
            <p className="text-xs text-loft-500 max-w-sm">
              {statusFilter === 'pending'
                ? 'New customer trip requests will appear here automatically ready for driver dispatch.'
                : statusFilter === 'expired'
                ? 'Orders untouched past their validity window will appear here.'
                : 'Try adjusting your search query or switching filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-loft-300">
              <thead className="bg-loft-950/70 text-xs uppercase font-medium border-b border-loft-800">
                <tr>
                  <th className="px-6 py-4">Booking ID</th>
                  <th className="px-6 py-4">Route & Locations</th>
                  <th className="px-6 py-4">Customer Details</th>
                  <th className="px-6 py-4">Vehicle / Goods</th>
                  <th className="px-6 py-4">Fare</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Appoint Driver</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-loft-800">
                {filteredBookings.map((b) => {
                  const isExpired = isBookingExpired(b);
                  const isPending = isBookingPending(b);
                  const isActive = isBookingActive(b);
                  const isCompleted = isBookingCompleted(b);
                  const isCancelled = b.status === 'cancelled' && !isExpired;
                  const currentDriver = b.driver || drivers.find(d => String(d.id) === String(b.driverId));

                  return (
                    <tr key={b.id} className="hover:bg-loft-800/40 transition-colors">
                      {/* Booking ID */}
                      <td className="px-6 py-4 align-top">
                        <span className="font-mono text-xs text-loft-300 bg-loft-950 px-2 py-1 rounded border border-loft-800 block w-fit">
                          #{b.id ? b.id.slice(0, 8) : ''}
                        </span>
                        <span className="text-[11px] text-loft-500 mt-1 block">
                          {b.createdAt ? new Date(b.createdAt).toLocaleDateString() : 'Recent'}
                        </span>
                      </td>

                      {/* Route */}
                      <td className="px-6 py-4 align-top max-w-xs">
                        <div className="space-y-1">
                          <div className="flex items-start gap-2">
                            <MapPin className="w-3.5 h-3.5 text-moss-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-loft-100 font-medium line-clamp-1" title={b.pickupAddress}>
                              {b.pickupAddress}
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <ArrowRight className="w-3.5 h-3.5 text-copper-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-copper-400 line-clamp-1" title={b.dropAddress || 'Multi-stop drop'}>
                              {b.dropAddress || 'Multi-stop delivery'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-6 py-4 align-top">
                        <p className="text-xs font-semibold text-loft-100">
                          {b.customer?.name || 'Customer'}
                        </p>
                        <p className="text-[11px] text-loft-400 mt-0.5 font-mono">
                          {b.customer?.phone || 'N/A'}
                        </p>
                      </td>

                      {/* Vehicle & Goods */}
                      <td className="px-6 py-4 align-top">
                        <p className="text-xs font-medium text-loft-200 capitalize">
                          {b.tempoType || 'Standard'} Tempo
                        </p>
                        <p className="text-[11px] text-loft-400 mt-0.5 capitalize">
                          {b.goodsType || 'General Freight'}
                        </p>
                      </td>

                      {/* Fare */}
                      <td className="px-6 py-4 align-top">
                        <p className="text-sm font-bold text-loft-50">
                          ₹{b.estimatedFare || b.price || '0'}
                        </p>
                      </td>

                      {/* Status & Queue Position */}
                      <td className="px-6 py-4 align-top">
                        <div className="space-y-1">
                          {isExpired ? (
                            <div>
                              <span className="px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                <Clock className="w-3.5 h-3.5 text-amber-400" />
                                <span>Expired</span>
                              </span>
                              <span className="block text-[10px] text-amber-400/80 font-medium mt-1">
                                Untouched past deadline
                              </span>
                            </div>
                          ) : isPending ? (
                            <div>
                              <span className="px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 bg-copper-500/15 text-copper-400 border border-copper-500/30">
                                <Clock className="w-3.5 h-3.5 text-copper-400 animate-pulse" />
                                <span>Pending</span>
                              </span>
                              {b.expiresAt && (
                                <span className="block text-[10px] text-loft-400 font-mono mt-1">
                                  Expires: {new Date(b.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                          ) : isActive ? (
                            <div>
                              <span className="px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                <Truck className="w-3.5 h-3.5 text-blue-400" />
                                <span>{b.status === 'driver_assigned' ? 'Driver Assigned' : b.status === 'arrived' ? 'At Pickup' : 'In Transit'}</span>
                              </span>
                              {b.driverId && (
                                <span className={`block text-[11px] font-mono px-2 py-0.5 rounded w-fit mt-1 ${
                                  b.queuePosition === 1 || b.status === 'in_transit'
                                    ? 'bg-moss-500/15 text-moss-400 border border-moss-500/30'
                                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                }`}>
                                  {b.queuePosition === 1 || b.status === 'in_transit' ? '🎯 Active Delivery' : `⏳ Queue #${b.queuePosition} (Up Next)`}
                                </span>
                              )}
                            </div>
                          ) : isCompleted ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 bg-moss-500/15 text-moss-400 border border-moss-500/30">
                              <CheckCircle2 className="w-3.5 h-3.5 text-moss-400" />
                              <span>Completed</span>
                            </span>
                          ) : isCancelled ? (
                            <div>
                              <span className="px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 bg-red-500/15 text-red-400 border border-red-500/30">
                                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                                <span>Cancelled</span>
                              </span>
                              {b.cancellationReason && (
                                <span className="block text-[10px] text-loft-400 mt-1 max-w-[160px] truncate" title={b.cancellationReason}>
                                  {b.cancellationReason}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-loft-800 text-loft-400">
                              {b.status}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Driver Appointment Selection */}
                      <td className="px-6 py-4 align-top text-right">
                        {isPending ? (
                          <div className="flex flex-col items-end gap-1.5">
                            <select
                              defaultValue=""
                              value=""
                              onChange={(e) => handleAppointBooking(b.id, e.target.value)}
                              disabled={assigningId === b.id}
                              className="input-field py-1.5 px-3 text-xs bg-loft-950 border-copper-500/50 text-loft-100 font-medium max-w-[210px] w-full cursor-pointer hover:border-copper-400 transition-colors"
                            >
                              <option value="" disabled>
                                Appoint Driver / Add to Queue
                              </option>
                              {assignableDrivers.map((drv) => {
                                const qCount = driverQueueMap[drv.id]?.length || 0;
                                return (
                                  <option key={drv.id} value={drv.id}>
                                    {drv.name} ({qCount === 0 ? '🟢 Available' : `🟡 ${qCount} in queue`})
                                  </option>
                                );
                              })}
                            </select>
                            {assignableDrivers.length === 0 && (
                              <p className="text-[10px] text-amber-400 mt-1">
                                No active drivers available
                              </p>
                            )}
                          </div>
                        ) : isActive ? (
                          <div className="flex flex-col items-end gap-1.5">
                            {currentDriver && (
                              <div className="text-xs text-loft-300 flex items-center gap-1.5 font-medium mb-1">
                                <span className="w-2 h-2 rounded-full bg-moss-500 inline-block"></span>
                                <span>{currentDriver.name}</span>
                                <span className="text-loft-500 text-[11px]">({currentDriver.phone})</span>
                              </div>
                            )}

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleCompleteBooking(b.id)}
                                disabled={assigningId === b.id}
                                title="Mark this delivery as completed and advance queue"
                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-moss-500/15 hover:bg-moss-500/25 text-moss-400 border border-moss-500/30 flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Complete</span>
                              </button>

                              <select
                                value={currentDriver?.id || ''}
                                onChange={(e) => handleAppointBooking(b.id, e.target.value)}
                                disabled={assigningId === b.id}
                                className="input-field py-1.5 px-3 text-xs bg-loft-950 border-loft-800 max-w-[210px] w-full cursor-pointer text-loft-300"
                              >
                                <option value="" disabled>
                                  Reassign Driver / Move Queue
                                </option>
                                {assignableDrivers.map((drv) => {
                                  const qCount = driverQueueMap[drv.id]?.length || 0;
                                  return (
                                    <option key={drv.id} value={drv.id}>
                                      {drv.name} ({qCount === 0 ? '🟢 Available' : `🟡 ${qCount} in queue`})
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          </div>
                        ) : isCompleted ? (
                          <div className="flex items-center justify-end gap-1.5 text-xs text-moss-400 font-semibold bg-moss-500/10 px-3 py-1.5 rounded-lg border border-moss-500/20 w-fit ml-auto">
                            <CheckCircle2 className="w-3.5 h-3.5 text-moss-400" />
                            <span>Delivered & Closed</span>
                          </div>
                        ) : isExpired ? (
                          <div className="flex flex-col items-end">
                            <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-1.5 rounded-lg border border-amber-500/20 inline-flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-amber-400" />
                              <span>Expired (No Driver)</span>
                            </span>
                            <span className="text-[10px] text-loft-400 mt-1 font-mono">
                              ✓ Auto-refunded to Wallet
                            </span>
                          </div>
                        ) : isCancelled ? (
                          <div className="flex flex-col items-end">
                            <span className="text-xs font-semibold text-red-400 bg-red-500/10 px-2.5 py-1.5 rounded-lg border border-red-500/20 inline-flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                              <span>Trip Cancelled</span>
                            </span>
                            <span className="text-[10px] text-loft-500 mt-1">
                              {b.cancelledBy ? `By ${b.cancelledBy}` : 'Closed'}
                            </span>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppointWorkTab;

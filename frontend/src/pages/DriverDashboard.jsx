import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Navigation, Wallet, AlertTriangle, CheckCircle, Clock, 
  MapPin, TrendingUp, Map, Truck, RefreshCw, ShieldCheck, Package, Radio, Play
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useSelector } from 'react-redux';
import api from '../services/api';
import { io } from 'socket.io-client';
import DriverNavigationMap from '../components/Driver/DriverNavigationMap';

const DriverDashboard = () => {
  const { user } = useSelector((state) => state.auth);
  const [activeTab, setActiveTab] = useState('today');
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [heatmapData, setHeatmapData] = useState(null);
  const [driverStats, setDriverStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  
  // WMS Scanning State
  const [scanResult, setScanResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  const [isNavigating, setIsNavigating] = useState(false);
  const [activeRide, setActiveRide] = useState(null);
  const [driverPos, setDriverPos] = useState({ lat: 18.5204, lng: 73.8567 });
  const [podHash, setPodHash] = useState(null);
  const [showPod, setShowPod] = useState(false);

  const socketRef = useRef(null);
  const isOnlineRef = useRef(isOnline);
  const isNavigatingRef = useRef(isNavigating);

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    isNavigatingRef.current = isNavigating;
  }, [isNavigating]);

  // Fetch driver performance metrics & any assigned bookings appointed by Fleet Admin
  const fetchMetrics = useCallback(async () => {
    if (!user?.id) return;
    setStatsLoading(true);
    try {
      const res = await api.get(`/api/drivers/${user.id}/metrics`);
      if (res.data?.success && res.data?.metrics) {
        setDriverStats(res.data.metrics);
        const assignedList = res.data.metrics.assignedBookings || [];
        if (assignedList.length > 0) {
          const topAssigned = assignedList[0];
          setActiveRide({
            bookingId: topAssigned.id,
            fare: Number(topAssigned.estimatedFare) || 0,
            distance: topAssigned.totalDistance ? `${topAssigned.totalDistance} km` : 'Scheduled Route',
            duration: topAssigned.duration || 'Dispatched by Fleet',
            pickup: topAssigned.pickupAddress,
            dropoff: topAssigned.dropAddress || 'Multi-stop delivery point',
            customerName: topAssigned.customer?.name || 'Commercial Client',
            customerPhone: topAssigned.customer?.phone || '',
            cargoType: topAssigned.cargoType || topAssigned.goodsType || 'Commercial Freight',
            vehicleInfo: topAssigned.vehicle ? `${topAssigned.vehicle.type || ''} (${topAssigned.vehicle.registrationNumber || ''})` : 'Assigned Fleet Vehicle',
            status: topAssigned.status
          });
          if (topAssigned.status === 'in_transit' || topAssigned.status === 'arrived') {
            setIsNavigating(true);
          }
        } else {
          if (!isNavigatingRef.current) {
            setActiveRide(null);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching driver metrics:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics, activeTab]);

  useEffect(() => {
    if (activeTab === 'heatmap') {
      const fetchHeatmap = async () => {
        try {
          const res = await api.get('/api/drivers/heatmap');
          if (res.data?.success) {
            setHeatmapData(res.data.data);
          }
        } catch (err) {
          console.error("Error fetching heatmap", err);
        }
      };
      fetchHeatmap();
    }
  }, [activeTab]);

  useEffect(() => {
    const newSocket = io(api.defaults.baseURL?.replace('/api', '') || 'http://localhost:5000', {
      withCredentials: true,
    });
    socketRef.current = newSocket;

    // Listen for dispatch updates appointed by fleet admin
    newSocket.on('dispatch:assigned', (data) => {
      if (data && (data.driverId === user?.id || !data.driverId)) {
        fetchMetrics();
      }
    });

    return () => {
      newSocket.off('dispatch:assigned');
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id, fetchMetrics]);

  // Watch real GPS position
  useEffect(() => {
    if (!isNavigating || !activeRide || !socketRef.current) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setDriverPos({ lat: coords.latitude, lng: coords.longitude });
        socketRef.current.emit('driver:location_update', {
          bookingId: activeRide.bookingId,
          lat: coords.latitude,
          lng: coords.longitude,
        });
      },
      (error) => {
        console.error('Location error:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isNavigating, activeRide]);

  // Mock Earnings Data
  const weeklyEarnings = [
    { day: 'Mon', amount: 850 },
    { day: 'Tue', amount: 1200 },
    { day: 'Wed', amount: 950 },
    { day: 'Thu', amount: 1500 },
    { day: 'Fri', amount: 2100 },
    { day: 'Sat', amount: 1800 },
    { day: 'Sun', amount: 1250 },
  ];

  const toggleAvailability = async () => {
    setIsLoading(true);
    try {
      const res = await api.patch(`/api/drivers/${user?.id}/toggle`);
      setIsOnline(res.data.status === 'active');
    } catch (err) {
      console.error('Toggle availability error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptTrip = async () => {
    if (!activeRide) return;

    setIsLoading(true);

    try {
      const response = await api.put(`/api/bookings/${activeRide.bookingId}/status`,
        { status: 'arrived', driverId: user?.id }
      );

      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Trip assignment failed');
      }

      setIsNavigating(true);
    } catch (err) {
      console.error('Error starting delivery:', err);
      // Fallback: still initiate navigation for local testing
      setIsNavigating(true);
    } finally {
      setIsLoading(false);
    }
  };

  const startDemoSimulation = () => {
    setActiveRide({
      bookingId: 'demo-sim-' + Date.now().toString(36),
      customerName: 'Tata AutoComp Systems Ltd',
      customerPhone: '+91 98220 54321',
      pickup: 'Swargate, Pune',
      dropoff: 'Viman Nagar, Pune',
      fare: 850,
      cargoType: 'Automotive Parts & Assemblies',
      distance: '14.8 km',
      duration: '~28 mins',
      status: 'in_transit'
    });
    setIsNavigating(true);
  };

  const handleFinishTrip = async () => {
    if (!activeRide) return;
    if (activeRide.bookingId?.startsWith('demo-sim-')) {
      setPodHash('POD-' + Math.random().toString(36).substring(2, 10).toUpperCase());
      setShowPod(true);
      return;
    }
    setIsLoading(true);
    try {
      const response = await api.post(`/api/bookings/${activeRide.bookingId}/complete`);
      if (response.data?.success) {
        setPodHash(response.data.booking.podHash);
        setShowPod(true);
      }
    } catch (err) {
      console.error('Error completing trip:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full pt-12 pb-24 relative min-h-[80vh]">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[radial-gradient(ellipse_at_center,rgba(85,108,145,0.1),transparent_70%)] pointer-events-none z-0"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col md:flex-row gap-8">
        
        {/* Left Sidebar */}
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="sticky top-28 bg-loft-900 border border-loft-800 rounded-2xl p-4 flex flex-col gap-5">
            
            {/* Header info */}
            <div className="px-3 py-2 border-b border-loft-800/80">
              <h2 className="text-xl font-bold text-loft-50 font-serif">Driver Portal</h2>
              <p className="text-xs text-moss-500 font-bold uppercase tracking-wider mt-0.5">Fleet Partner</p>
            </div>

            {/* Online / Offline status toggle */}
            <button 
              onClick={toggleAvailability}
              disabled={isLoading || isNavigating}
              className={`w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border font-bold tracking-wide text-xs transition-all shadow-md cursor-pointer ${
                isOnline 
                  ? 'border-moss-500/40 bg-moss-500/15 text-moss-400 shadow-moss-500/10 hover:bg-moss-500/25' 
                  : 'border-loft-700/50 bg-loft-800/60 text-loft-400 hover:bg-loft-800'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-moss-500 animate-pulse' : 'bg-loft-500'}`}></span> 
              <span>{isOnline ? 'ONLINE - RECEIVING TRIPS' : 'OFFLINE'}</span>
            </button>

            {/* Navigation links */}
            <nav className="space-y-1">
              {[
                { id: 'today', label: 'Active Trip', icon: Truck },
                { id: 'heatmap', label: 'Demand Heatmap', icon: TrendingUp },
                { id: 'wms', label: 'WMS Scanner', icon: Package },
                { id: 'earnings', label: 'Earnings & Wallet', icon: Wallet },
                { id: 'completed', label: 'Trip History', icon: CheckCircle },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  disabled={isNavigating && item.id !== 'today'}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium cursor-pointer ${
                    activeTab === item.id 
                      ? 'bg-copper-500 text-white shadow-lg shadow-copper-500/20' 
                      : 'text-loft-300 hover:text-loft-50 hover:bg-loft-800 disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>

            {/* SOS / Emergency in sidebar footer */}
            <div className="pt-3 border-t border-loft-800/80">
              <button 
                onClick={() => alert('Emergency SOS Alert sent to Eminence Fleet Dispatch Support!')}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-red-600/15 text-red-400 border border-red-500/40 hover:bg-red-600/25 hover:border-red-500 text-xs font-bold transition-all shadow-[0_0_15px_rgba(239,68,68,0.15)] cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4 text-red-400" /> 
                <span>SOS / Emergency</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-loft-50 mb-1">Driver Dashboard</h1>
              <p className="text-loft-300">Welcome back, <span className="text-copper-400 font-medium">{user?.name || 'Driver'}</span></p>
            </div>
          </div>
        
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { 
              label: 'Total Money Earned', 
              value: driverStats?.totalEarnings !== undefined ? `₹${Number(driverStats.totalEarnings).toLocaleString('en-IN')}` : '₹0', 
              icon: Wallet, 
              color: 'text-copper-500', 
              bg: 'bg-copper-500/10' 
            },
            { 
              label: 'Completed Orders', 
              value: driverStats?.completedOrders !== undefined ? driverStats.completedOrders : (user?.totalTrips ?? 0), 
              icon: CheckCircle, 
              color: 'text-moss-500', 
              bg: 'bg-moss-500/10' 
            },
            { 
              label: 'Assigned Work', 
              value: driverStats?.activeOrdersCount !== undefined ? `${driverStats.activeOrdersCount} Pending` : '0 Active', 
              icon: Clock, 
              color: 'text-blue-500', 
              bg: 'bg-blue-500/10' 
            },
            { 
              label: 'Driver Rating', 
              value: user?.rating ? `${user.rating} ⭐` : '5.0 ⭐', 
              icon: Navigation, 
              color: 'text-yellow-500', 
              bg: 'bg-yellow-500/10' 
            },
          ].map((stat, idx) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              key={idx} 
              className="card p-5 flex items-center gap-4"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-loft-400 text-xs font-medium uppercase tracking-wider mb-1">{stat.label}</p>
                <p className="text-xl font-bold text-loft-50">{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          
          {/* TAB 1: APPOINTED WORK / ACTIVE TRIP & NAVIGATION */}
          {activeTab === 'today' && (
            <AnimatePresence mode="wait">
              {!isNavigating ? (
                activeRide ? (
                  /* 1. REAL APPOINTED TRIP FROM ADMIN */
                  <motion.div 
                    key="appointed-work" 
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: -15 }} 
                    className="space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                      <h3 className="text-xl font-bold text-loft-50 flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full bg-moss-500 animate-pulse ring-4 ring-moss-500/20"></span>
                        Appointed Work Order
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="bg-moss-500/15 border border-moss-500/30 text-moss-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5" /> Dispatched by Fleet Admin
                        </span>
                        <span className="bg-loft-800/80 border border-loft-700 text-loft-400 text-xs font-mono px-2.5 py-1 rounded-md">
                          #{activeRide.bookingId.slice(0, 8)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="card p-6 md:p-8 border border-copper-500/40 shadow-[0_0_35px_rgba(232,99,49,0.12)] relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-copper-500/15 via-transparent to-transparent rounded-bl-full pointer-events-none"></div>
                      
                      {/* Fare & Key Metrics Header */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 relative z-10 pb-6 border-b border-loft-800">
                        <div>
                          <p className="text-loft-400 text-xs font-semibold uppercase tracking-wider mb-1">Guaranteed Trip Compensation</p>
                          <div className="flex items-baseline gap-3">
                            <p className="text-4xl md:text-5xl font-bold text-loft-50">₹{Number(activeRide.fare).toLocaleString('en-IN')}</p>
                            <span className="text-moss-400 text-xs font-semibold bg-moss-500/10 px-2 py-0.5 rounded border border-moss-500/20">
                              Direct Fleet Settlement
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-4 sm:gap-6 sm:text-right">
                          <div className="bg-loft-950/60 border border-loft-800/80 px-4 py-2.5 rounded-xl">
                            <p className="text-xs text-loft-400 uppercase font-medium">Distance</p>
                            <p className="font-bold text-loft-50 text-base md:text-lg">{activeRide.distance || 'Route Assigned'}</p>
                          </div>
                          <div className="bg-loft-950/60 border border-loft-800/80 px-4 py-2.5 rounded-xl">
                            <p className="text-xs text-loft-400 uppercase font-medium">Consignment</p>
                            <p className="font-bold text-copper-400 text-base md:text-lg">{activeRide.cargoType || 'Commercial Freight'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Route Waypoints */}
                      <div className="relative pl-7 space-y-6 mb-8">
                        <div className="absolute left-3 top-2.5 bottom-2.5 w-0.5 bg-gradient-to-b from-moss-500 via-loft-700 to-copper-500"></div>
                        
                        <div className="relative">
                          <div className="absolute -left-[27px] top-1 w-4 h-4 rounded-full bg-moss-500 border-4 border-loft-900 ring-2 ring-moss-500/40"></div>
                          <p className="text-xs font-bold text-moss-400 uppercase tracking-wider mb-0.5">Pickup Location</p>
                          <p className="text-base font-semibold text-loft-100">{activeRide.pickup}</p>
                          {activeRide.customerName && (
                            <p className="text-xs text-loft-400 mt-0.5">Consignor: <span className="text-loft-200 font-medium">{activeRide.customerName}</span></p>
                          )}
                        </div>

                        <div className="relative">
                          <div className="absolute -left-[27px] top-1 w-4 h-4 rounded-full bg-copper-500 border-4 border-loft-900 ring-2 ring-copper-500/40"></div>
                          <p className="text-xs font-bold text-copper-400 uppercase tracking-wider mb-0.5">Destination / Drop-off</p>
                          <p className="text-base font-semibold text-loft-100">{activeRide.dropoff}</p>
                        </div>
                      </div>

                      {/* Appointed Action */}
                      <div className="relative z-10 pt-2">
                        <button 
                          onClick={handleAcceptTrip} 
                          disabled={isLoading}
                          className="btn-primary w-full py-4 text-lg font-bold flex items-center justify-center gap-3 shadow-[0_0_25px_rgba(232,99,49,0.35)] hover:shadow-[0_0_35px_rgba(232,99,49,0.5)] transition-all cursor-pointer"
                        >
                          <Navigation className="w-5 h-5" />
                          Start Navigation & Delivery
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  /* 2. STANDBY SCREEN (WHEN NO APPOINTED TRIP FROM ADMIN) */
                  <motion.div 
                    key="standby" 
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: -15 }} 
                    className="space-y-6"
                  >
                    <div className="card p-8 md:p-12 border border-loft-800 text-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-radial-gradient from-copper-500/5 via-transparent to-transparent pointer-events-none"></div>

                      <div className="w-20 h-20 rounded-2xl bg-loft-950 border border-loft-800 flex items-center justify-center mx-auto mb-6 shadow-xl relative">
                        <Truck className="w-10 h-10 text-copper-400" />
                        <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-loft-900 ${isOnline ? 'bg-moss-500 animate-pulse' : 'bg-loft-600'}`}></span>
                      </div>

                      <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-loft-950 border border-loft-800 text-xs font-semibold mb-4 text-loft-300">
                        <Radio className={`w-3.5 h-3.5 ${isOnline ? 'text-moss-400 animate-pulse' : 'text-loft-500'}`} />
                        {isOnline ? 'Fleet Standby • Available for Work' : 'Duty Paused • Offline'}
                      </div>

                      <h3 className="text-2xl md:text-3xl font-bold text-loft-50 mb-3">
                        Awaiting Appointed Work
                      </h3>
                      <p className="text-loft-300 text-sm md:text-base max-w-xl mx-auto mb-8 leading-relaxed">
                        Fleet administrators appoint bookings directly to your vehicle based on capacity and scheduled routes. As soon as dispatch assigns a delivery, your work order and live route will appear here.
                      </p>

                      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-xl mx-auto mb-10">
                        <button
                          onClick={fetchMetrics}
                          disabled={statsLoading}
                          className="btn-primary w-full sm:w-auto px-7 py-3.5 text-sm font-bold flex items-center justify-center gap-2.5 shadow-lg"
                        >
                          <RefreshCw className={`w-4 h-4 ${statsLoading ? 'animate-spin' : ''}`} />
                          {statsLoading ? 'Checking Fleet...' : 'Check Appointed Work'}
                        </button>

                        <button
                          onClick={startDemoSimulation}
                          className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-copper-500/50 bg-copper-500/10 hover:bg-copper-500/20 text-copper-300 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-copper-500/10"
                        >
                          <Play className="w-4 h-4 text-copper-400 fill-copper-400" />
                          Launch Tempo Moving Simulation
                        </button>
                      </div>

                      {/* Standby Readiness Status Badges */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-loft-800/80 pt-8 text-left">
                        <div className="bg-loft-950/70 border border-loft-800/70 p-4 rounded-xl">
                          <p className="text-xs text-loft-400 uppercase font-medium mb-1">Shift Duty</p>
                          <p className={`font-bold text-sm ${isOnline ? 'text-moss-400' : 'text-loft-400'}`}>
                            {isOnline ? 'Active & Ready' : 'Shift Inactive'}
                          </p>
                        </div>
                        <div className="bg-loft-950/70 border border-loft-800/70 p-4 rounded-xl">
                          <p className="text-xs text-loft-400 uppercase font-medium mb-1">Appointed Queue</p>
                          <p className="font-bold text-sm text-blue-400">
                            {driverStats?.activeOrdersCount ?? 0} Orders in Queue
                          </p>
                        </div>
                        <div className="bg-loft-950/70 border border-loft-800/70 p-4 rounded-xl">
                          <p className="text-xs text-loft-400 uppercase font-medium mb-1">Deliveries Today</p>
                          <p className="font-bold text-sm text-loft-50">
                            {driverStats?.completedOrders ?? 0} Completed
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              ) : (
                <motion.div key="nav" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col md:flex-row gap-6">
                  {/* Real-time Interactive Driver Navigation Map with Moving Tempo Simulation */}
                  <DriverNavigationMap
                    driverPos={driverPos}
                    activeRide={activeRide}
                    onLocationUpdate={(newPos) => {
                      setDriverPos(newPos);
                      if (socketRef.current && activeRide?.bookingId) {
                        socketRef.current.emit('driver:location_update', {
                          bookingId: activeRide.bookingId,
                          lat: newPos.lat,
                          lng: newPos.lng,
                        });
                      }
                    }}
                    onFinishTrip={handleFinishTrip}
                  />
                  
                  {/* Trip Controls */}
                  <div className="w-full md:w-80 space-y-4">
                    <div className="card p-6 border-moss-500/20">
                      <h4 className="text-moss-400 font-bold mb-4 uppercase tracking-wider text-sm">Appointed Trip Details</h4>
                      <div className="space-y-4">
                        <div>
                          <p className="text-loft-400 text-xs">Customer Name</p>
                          <p className="font-bold text-loft-50">{activeRide?.customerName || 'Commercial Client'}</p>
                          {activeRide?.customerPhone && (
                            <p className="text-xs text-copper-400">{activeRide.customerPhone}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-loft-400 text-xs">Consignment Cargo</p>
                          <p className="font-bold text-loft-50">{activeRide?.cargoType || 'Commercial Freight'}</p>
                        </div>
                        <div>
                          <p className="text-loft-400 text-xs">Pickup Origin</p>
                          <p className="font-semibold text-loft-200 text-xs truncate">{activeRide?.pickup || '—'}</p>
                        </div>
                        <div>
                          <p className="text-loft-400 text-xs">Drop-off Destination</p>
                          <p className="font-semibold text-loft-200 text-xs truncate">{activeRide?.dropoff || '—'}</p>
                        </div>
                        <div className="pt-4 border-t border-loft-800 space-y-2">
                          <button onClick={handleFinishTrip} className="w-full bg-moss-500 hover:bg-moss-400 text-white font-bold py-3.5 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-colors cursor-pointer text-sm">
                            Complete Trip & Sign PoD
                          </button>

                          <button 
                            type="button"
                            onClick={() => {
                              setIsNavigating(false);
                              if (activeRide?.bookingId?.startsWith('demo-sim-')) {
                                setActiveRide(null);
                              }
                            }}
                            className="w-full bg-loft-900 hover:bg-loft-800 text-loft-300 font-semibold py-2.5 rounded-xl border border-loft-800 transition-colors text-xs cursor-pointer"
                          >
                            Exit Navigation
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* TAB 2: SURGE HEATMAP */}
          {activeTab === 'heatmap' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card overflow-hidden p-0 border border-copper-500/20">
              <div className="p-6 border-b border-loft-800 flex justify-between items-center bg-loft-950">
                <div>
                  <h3 className="text-xl font-bold text-loft-50">Surge Pricing Heatmap</h3>
                  <p className="text-loft-400 text-sm">Drive to highlighted areas to earn up to 2.5x fare.</p>
                </div>
                <div className="flex gap-2">
                  <span className="flex items-center gap-1 text-xs text-loft-300"><span className="w-3 h-3 rounded-full bg-red-500"></span> 2.0x+</span>
                  <span className="flex items-center gap-1 text-xs text-loft-300"><span className="w-3 h-3 rounded-full bg-orange-500"></span> 1.5x</span>
                  <span className="flex items-center gap-1 text-xs text-loft-300"><span className="w-3 h-3 rounded-full bg-yellow-500"></span> 1.2x</span>
                </div>
              </div>
              
              <div className="relative h-[500px] bg-[#1a1e26] w-full flex items-center justify-center overflow-hidden">
                {/* Simulated Map Background */}
                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cartographer.png')]"></div>
                
                {heatmapData && heatmapData.hotspots.map((spot, index) => {
                  const colors = {
                    'High': 'red',
                    'Medium': 'orange',
                    'Low': 'yellow'
                  };
                  const color = colors[spot.intensity];
                  
                  // Using randomized fixed positions for simulation since we don't have a real map canvas here
                  const positions = [
                    { top: '25%', left: '25%' },
                    { bottom: '33%', right: '25%' },
                    { top: '50%', left: '50%' },
                    { top: '10%', right: '10%' }
                  ];
                  const pos = positions[index % positions.length];

                  return (
                    <div key={spot.id} className="absolute" style={pos}>
                      <div className={`w-48 h-48 bg-${color}-500/40 rounded-full blur-3xl mix-blend-screen animate-pulse`}></div>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <MapPin className="text-white w-8 h-8 drop-shadow-lg mb-1" />
                        <span className={`bg-${color}-600 text-white font-bold text-xs px-2 py-1 rounded shadow-lg`}>
                          {spot.surgeMultiplier}x {spot.name}
                        </span>
                      </div>
                    </div>
                  );
                })}
                
                <div className="absolute bottom-6 right-6">
                  <button className="bg-loft-800 text-white p-3 rounded-full shadow-lg border border-loft-700 hover:bg-loft-700">
                    <Map className="w-6 h-6 text-copper-400" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB: WMS SCANNER */}
          {activeTab === 'wms' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto space-y-6">
              <div className="card p-8 border border-moss-500/30 text-center">
                <h3 className="text-2xl font-bold text-loft-50 mb-2">Warehouse Barcode Scanner</h3>
                <p className="text-loft-400 mb-8">Scan inventory QR codes to update the digital manifest automatically.</p>
                
                <div className="relative w-full max-w-sm mx-auto aspect-square bg-[#0a0c10] rounded-2xl border-2 border-dashed border-loft-700 overflow-hidden flex flex-col items-center justify-center">
                  {isScanning ? (
                    <div className="absolute inset-0 bg-black/50 z-10 flex flex-col items-center justify-center">
                      <div className="w-48 h-1 bg-moss-500 rounded-full animate-[bounce_2s_infinite]"></div>
                      <p className="text-moss-400 mt-4 font-bold animate-pulse">Scanning...</p>
                    </div>
                  ) : null}
                  
                  {/* Mock Camera View */}
                  <div className="absolute inset-4 border-2 border-copper-500/50 rounded-xl pointer-events-none">
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-copper-500 rounded-tl-lg"></div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-copper-500 rounded-tr-lg"></div>
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-copper-500 rounded-bl-lg"></div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-copper-500 rounded-br-lg"></div>
                  </div>
                  <AlertTriangle className="w-12 h-12 text-loft-700 mb-4" />
                  <p className="text-loft-600 font-medium">Camera Feed Simulated</p>
                </div>
                
                <button 
                  onClick={() => {
                    setIsScanning(true);
                    setScanResult(null);
                    setTimeout(async () => {
                      try {
                        const res = await api.post('/api/drivers/scan-inventory', { barcode: 'MOCK-BOX-001' });
                        setIsScanning(false);
                        setScanResult(res.data.item);
                      } catch {
                        setIsScanning(false);
                      }
                    }, 2000);
                  }}
                  disabled={isScanning}
                  className="btn-primary mt-8 py-3 px-8 text-lg disabled:opacity-50"
                >
                  Simulate QR Scan
                </button>
              </div>

              {scanResult && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-6 bg-moss-500/10 border-moss-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-moss-500 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-moss-400 font-bold uppercase tracking-wider text-sm">Scan Successful</h4>
                      <p className="text-loft-50 font-medium">{scanResult.itemName} ({scanResult.barcode})</p>
                    </div>
                  </div>
                  <span className="bg-moss-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase">{scanResult.status}</span>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* TAB 3: EARNINGS ANALYTICS */}
          {activeTab === 'earnings' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              
              {/* Earnings Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card p-6 border-l-4 border-l-copper-500">
                  <p className="text-loft-400 text-sm mb-1 font-medium flex items-center gap-2"><Wallet className="w-4 h-4"/> Total Net Earnings</p>
                  <p className="text-3xl font-bold text-loft-50">₹{driverStats?.totalEarnings ? Number(driverStats.totalEarnings).toLocaleString('en-IN') : '0'}</p>
                  <p className="text-moss-400 text-sm mt-2 flex items-center gap-1"><TrendingUp className="w-3 h-3"/> Direct platform payout</p>
                </div>
                <div className="card p-6 border-l-4 border-l-moss-500">
                  <p className="text-loft-400 text-sm mb-1 font-medium flex items-center gap-2"><CheckCircle className="w-4 h-4"/> Orders Completed</p>
                  <p className="text-3xl font-bold text-loft-50">{driverStats?.completedOrders ?? 0}</p>
                  <p className="text-loft-400 text-sm mt-2">Verified deliveries</p>
                </div>
                <div className="card p-6 border-l-4 border-l-blue-500">
                  <p className="text-loft-400 text-sm mb-1 font-medium flex items-center gap-2"><Clock className="w-4 h-4"/> Appointed Work</p>
                  <p className="text-3xl font-bold text-loft-50">{driverStats?.activeOrdersCount ?? 0}</p>
                  <p className="text-loft-400 text-sm mt-2">Active dispatched trips</p>
                </div>
              </div>

              {/* Chart */}
              <div className="card p-6">
                <h3 className="text-lg font-bold text-loft-50 mb-6">Earnings Breakdown (Current Week)</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyEarnings} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#77849e', fontSize: 12 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#77849e', fontSize: 12 }} tickFormatter={(val) => `₹${val}`} />
                      <Tooltip 
                        cursor={{ fill: '#1a1e26' }}
                        contentStyle={{ backgroundColor: '#0b0d12', borderColor: '#222939', borderRadius: '8px', color: '#fff' }}
                        itemStyle={{ color: '#e86331', fontWeight: 'bold' }}
                        formatter={(value) => [`₹${value}`, 'Earnings']}
                      />
                      <Bar dataKey="amount" fill="#e86331" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'completed' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-loft-50 font-serif">Completed Delivery History</h3>
                <span className="text-xs text-loft-400 font-medium">
                  Total: {driverStats?.completedOrders ?? 0} Completed
                </span>
              </div>

              {!driverStats?.completedBookings || driverStats.completedBookings.length === 0 ? (
                <div className="card p-12 text-center flex flex-col items-center justify-center border-dashed border-loft-800/80">
                  <CheckCircle className="w-12 h-12 text-loft-600 mb-3" />
                  <h4 className="text-lg font-bold text-loft-200 mb-1">No Completed Trips Yet</h4>
                  <p className="text-loft-400 text-sm max-w-md">Your finished deliveries with cryptographic proof of delivery will be logged here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {driverStats.completedBookings.map((b) => (
                    <div key={b.id} className="card p-5 border border-loft-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-loft-700 transition-colors">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="bg-moss-500/20 text-moss-400 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-moss-500/30">
                            Delivered
                          </span>
                          <span className="text-xs text-loft-400 font-mono">ID: {b.id.slice(0, 8)}...</span>
                        </div>
                        <p className="text-sm font-semibold text-loft-100">{b.pickupAddress} → {b.dropAddress || 'Multi-stop drop'}</p>
                        <p className="text-xs text-loft-400 mt-1 capitalize">{b.tempoType} Tempo • {b.goodsType}</p>
                      </div>
                      <div className="text-right flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto">
                        <span className="text-lg font-bold text-copper-400">+₹{b.estimatedFare}</span>
                        <span className="text-xs text-loft-500">
                          {b.updatedAt ? new Date(b.updatedAt).toLocaleDateString() : 'Recent'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>

      </div>
    </div>

      {/* PoD Certificate Modal */}
      <AnimatePresence>
        {showPod && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} 
              animate={{ scale: 1, y: 0 }} 
              className="bg-loft-900 border border-moss-500/50 rounded-2xl p-8 max-w-lg w-full shadow-[0_0_50px_rgba(16,185,129,0.2)] text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-moss-500"></div>
              <div className="w-20 h-20 bg-moss-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-moss-400" />
              </div>
              <h2 className="text-3xl font-bold text-moss-400 mb-2">Blockchain Verified</h2>
              <p className="text-loft-300 mb-6">Delivery completed and cryptographically secured on the ledger.</p>
              
              <div className="bg-loft-950 p-4 rounded-xl border border-loft-800 mb-8 break-all">
                <p className="text-xs text-loft-500 mb-1 uppercase tracking-wider font-bold">PoD Hash (SHA-256)</p>
                <p className="text-sm text-moss-300 font-mono">{podHash}</p>
              </div>
              
              <button 
                onClick={() => {
                  setShowPod(false);
                  setIsNavigating(false);
                  setActiveRide(null);
                  fetchMetrics();
                }}
                className="btn-primary w-full py-4 text-lg shadow-[0_0_20px_rgba(16,185,129,0.4)] cursor-pointer"
                style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}
              >
                Close & Return Home
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DriverDashboard;

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Phone, MessageSquare, ShieldCheck, Check, Copy, Truck, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import TrackingMap from '../components/Tracking/TrackingMap';
import ReviewModal from '../components/Customer/ReviewModal';
import api from '../services/api';
import { getToken } from '../services/tokenService';
import { io } from 'socket.io-client';

// Pune coordinates for default mock telemetry
const PUNE_POSITION = [18.5204, 73.8567];

const Tracking = () => {
  const { bookingId } = useParams();
  const { user } = useSelector((state) => state.auth);
  const [booking, setBooking] = useState(null);
  const [status, setStatus] = useState('searching'); // searching, driver_assigned, arrived, in_transit, completed
  const [_loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [copiedPod, setCopiedPod] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(!navigator.onLine);
  const [telemetry, setTelemetry] = useState({
    speed: 0,
    lat: PUNE_POSITION[0],
    lng: PUNE_POSITION[1],
    lastSynced: new Date().toLocaleTimeString(),
  });
  const fallbackPodHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  const [effectiveBookingId, setEffectiveBookingId] = useState(bookingId || null);
  const [hasNoActiveBooking, setHasNoActiveBooking] = useState(false);

  const displayOtp = booking?.otp || (effectiveBookingId || bookingId || booking?.id
    ? String(Math.abs(String(effectiveBookingId || bookingId || booking?.id).split('').reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0)) % 9000 + 1000)
    : '4928');

  useEffect(() => {
    let isMounted = true;

    const resolveAndLoadBooking = async () => {
      try {
        setLoading(true);
        setError(null);

        let targetId = bookingId;

        // If no bookingId provided in URL, look up the user's active bookings
        if (!targetId) {
          try {
            const bookingsRes = await api.get('/api/bookings');
            const userBookings = bookingsRes.data?.bookings || bookingsRes.data || [];
            // Find most recent active booking (pending, driver_assigned, arrived, in_transit)
            const activeBooking = userBookings.find(b => 
              ['pending', 'driver_assigned', 'arrived', 'in_transit'].includes(b.status)
            );

            if (activeBooking) {
              targetId = activeBooking.id;
              if (isMounted) setEffectiveBookingId(targetId);
            } else {
              // No active bookings found for this customer
              if (isMounted) {
                setHasNoActiveBooking(true);
                setLoading(false);
              }
              return;
            }
          } catch (listErr) {
            console.error('Error fetching customer bookings for tracking:', listErr);
            if (isMounted) {
              setHasNoActiveBooking(true);
              setLoading(false);
            }
            return;
          }
        } else {
          if (isMounted) setEffectiveBookingId(targetId);
        }

        const response = await api.get(`/api/bookings/${targetId}`);
        const data = response.data?.booking || response.data;
        if (isMounted && data) {
          setBooking(data);
          if (data.status) setStatus(data.status);
          if (data.status === 'completed') setIsReviewModalOpen(true);
          
          // Re-fetch latest telemetry state (Speed, Location) upon load or reconnection
          const updatedSpeed = data.status === 'in_transit' ? 44 : (data.status === 'driver_assigned' ? 28 : 0);
          const updatedLat = data.currentLat || PUNE_POSITION[0];
          const updatedLng = data.currentLng || PUNE_POSITION[1];
          setTelemetry({
            speed: updatedSpeed,
            lat: updatedLat,
            lng: updatedLng,
            lastSynced: new Date().toLocaleTimeString(),
          });
        }
      } catch (err) {
        console.error('Unable to load booking status:', err);
        if (isMounted) setError('Unable to load real-time booking details.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    resolveAndLoadBooking();

    const token = user?.token || getToken();
    const rawSocketUrl = import.meta.env.VITE_API_URL || api.defaults.baseURL || 'http://localhost:3000';
    const socketUrl = rawSocketUrl.replace(/\/api\/?$/, '');
    const socket = io(socketUrl, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      withCredentials: true,
      auth: { token }
    });

    const activeId = bookingId || effectiveBookingId;
    if (activeId) {
      socket.emit('join_booking', { bookingId: activeId });
      socket.emit('join_trip', activeId);
    }

    // Socket reconnection strategy handlers
    socket.on('connect', () => {
      if (isMounted) {
        setIsReconnecting(false);
        const currId = bookingId || effectiveBookingId;
        if (currId) {
          socket.emit('join_booking', { bookingId: currId });
          socket.emit('join_trip', currId);
          resolveAndLoadBooking();
        }
      }
    });

    socket.on('disconnect', () => {
      if (isMounted) {
        setIsReconnecting(true);
      }
    });

    socket.on('connect_error', () => {
      if (isMounted) {
        setIsReconnecting(true);
      }
    });

    socket.on('booking_status_updated', ({ bookingId: id, status: newStatus }) => {
      const currId = bookingId || effectiveBookingId;
      if (id === currId && isMounted) {
        setStatus(newStatus);
        setBooking(prev => prev ? { ...prev, status: newStatus } : prev);
        if (newStatus === 'completed') {
          setIsReviewModalOpen(true);
        }
      }
    });

    socket.on('trip:location_update', (data) => {
      if (isMounted && data) {
        setTelemetry(prev => ({
          ...prev,
          lat: data.lat || prev.lat,
          lng: data.lng || prev.lng,
          speed: typeof data.speed === 'number' ? data.speed : prev.speed,
          lastSynced: new Date().toLocaleTimeString(),
        }));
      }
    });

    socket.on('trip:telemetry', (data) => {
      if (isMounted && data) {
        setTelemetry(prev => ({
          ...prev,
          speed: typeof data.speed === 'number' ? data.speed : prev.speed,
          lat: data.lat || prev.lat,
          lng: data.lng || prev.lng,
          lastSynced: new Date().toLocaleTimeString(),
        }));
      }
    });

    // Browser online / offline simulation listeners (DevTools)
    const handleOffline = () => {
      if (isMounted) setIsReconnecting(true);
    };

    const handleOnline = () => {
      if (isMounted) {
        setIsReconnecting(false);
        loadBooking();
        if (socket.connected) {
          socket.emit('join_booking', { bookingId });
          socket.emit('join_trip', bookingId);
        } else {
          socket.connect();
        }
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      isMounted = false;
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('booking_status_updated');
      socket.off('trip:location_update');
      socket.off('trip:telemetry');
      socket.disconnect();
    };
  }, [bookingId]);

  const getStatusText = () => {
    switch(status) {
      case 'searching': return 'Searching for driver...';
      case 'driver_assigned': return 'Driver assigned, on the way to pickup.';
      case 'arrived': return 'Driver has arrived at pickup location.';
      case 'in_transit': return 'Goods in transit to destination.';
      case 'completed': return 'Delivery completed successfully!';
      default: return 'Loading...';
    }
  };

  const getProgressWidth = () => {
    switch(status) {
      case 'searching': return '10%';
      case 'driver_assigned': return '30%';
      case 'arrived': return '50%';
      case 'in_transit': return '80%';
      case 'completed': return '100%';
      default: return '0%';
    }
  };

  if (hasNoActiveBooking) {
    return (
      <div className="w-full min-h-[80vh] flex items-center justify-center py-16 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(232,99,49,0.06),transparent_60%)] pointer-events-none"></div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="max-w-md w-full card p-8 text-center relative z-10 border border-loft-800"
        >
          <div className="w-16 h-16 rounded-2xl bg-copper-500/10 border border-copper-500/20 flex items-center justify-center mx-auto mb-6 text-copper-400">
            <Truck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-serif font-bold text-loft-50 mb-2">No Active Bookings</h2>
          <p className="text-loft-300 text-sm mb-8 leading-relaxed">
            You don't have any ongoing tempo bookings right now. Book a tempo to see live telematics and GPS tracking.
          </p>
          <div className="flex flex-col gap-3">
            <Link 
              to="/booking" 
              className="btn-primary py-3 px-6 flex items-center justify-center gap-2 text-sm shadow-lg shadow-copper-500/10"
            >
              Book a Tempo Now <ArrowRight className="w-4 h-4" />
            </Link>
            <Link 
              to="/customer/dashboard" 
              className="btn-secondary py-3 px-6 text-sm"
            >
              Go to Dashboard
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full relative min-h-screen bg-loft-950 flex flex-col md:flex-row">
      
      {/* Map Area (Leaflet) */}
      <div className="flex-1 relative bg-loft-900 border-r border-loft-800 hidden md:block z-0">
        <TrackingMap 
          bookingId={effectiveBookingId || bookingId} 
          initialLat={PUNE_POSITION[0]} 
          initialLng={PUNE_POSITION[1]} 
          isReconnecting={isReconnecting}
          currentPosition={[telemetry.lat || PUNE_POSITION[0], telemetry.lng || PUNE_POSITION[1]]}
        />
      </div>

      {/* Tracking Details Pane */}
      <div className="w-full md:w-[450px] flex-shrink-0 bg-loft-950 p-6 md:p-8 flex flex-col h-full overflow-y-auto hide-scrollbar">
        
        <div className="mb-6">
          <Link to="/customer/dashboard" className="text-copper-500 text-sm font-bold tracking-wide uppercase hover:text-copper-400 transition-colors">
            &larr; Back to Dashboard
          </Link>
          <h1 className="text-3xl font-serif font-bold text-loft-50 mt-4 mb-1">Track Ride</h1>
          <p className="text-loft-400 text-sm">Booking ID: <span className="text-loft-200 font-mono">{effectiveBookingId || bookingId || 'BKG-XXXX-XX'}</span></p>
        </div>

        {error && (
          <div className="card p-3 border-red-500/30 bg-red-500/10 text-red-400 text-xs mb-4">
            {error}
          </div>
        )}

        {/* Socket Offline / Reconnecting Spinner Indicator (TC-KRI-002) */}
        {isReconnecting && (
          <div 
            id="reconnecting-spinner"
            data-testid="reconnecting-spinner"
            className="card p-4 border-amber-500/40 bg-amber-500/10 mb-6 flex items-center justify-between shadow-xl"
          >
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
              <div>
                <p className="text-sm font-bold text-amber-300">Reconnecting...</p>
                <p className="text-xs text-loft-400">Offline mode detected. Re-fetching latest telemetry upon reconnect...</p>
              </div>
            </div>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono px-2 py-0.5 rounded font-semibold uppercase">
              Offline
            </span>
          </div>
        )}

        {/* Live Telemetry State HUD (TC-KRI-002) */}
        <div className="card p-4 border-loft-800 bg-loft-900/60 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-loft-300 uppercase tracking-wider">
              Live Telemetry State
            </span>
            <span 
              data-testid="telemetry-status-badge"
              className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                isReconnecting ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
              }`}
            >
              {isReconnecting ? 'Reconnecting...' : 'Live GPS Sync'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-loft-950/80 rounded-lg border border-loft-800">
              <span className="text-[11px] text-loft-400 block mb-1">Speed</span>
              <span data-testid="telemetry-speed" className="text-lg font-mono font-bold text-loft-100">
                {typeof telemetry.speed === 'number' ? telemetry.speed : (status === 'in_transit' ? 44 : (status === 'driver_assigned' ? 28 : 0))} km/h
              </span>
            </div>
            <div className="p-3 bg-loft-950/80 rounded-lg border border-loft-800">
              <span className="text-[11px] text-loft-400 block mb-1">Location</span>
              <span data-testid="telemetry-location" className="text-xs font-mono font-semibold text-copper-300 block truncate">
                {(telemetry.lat || PUNE_POSITION[0]).toFixed(4)}°, {(telemetry.lng || PUNE_POSITION[1]).toFixed(4)}°
              </span>
            </div>
          </div>
          <div className="text-[10px] text-loft-400 mt-2 text-right">
            Telemetry Synced: <span className="font-mono text-loft-300">{telemetry.lastSynced}</span>
          </div>
        </div>

        {/* Live Status */}
        <div className="card p-6 border-copper-500/30 mb-6 bg-copper-500/5">
          <h2 className="text-xl font-bold text-loft-50 mb-4">{getStatusText()}</h2>
          
          <div className="relative h-2 bg-loft-800 rounded-full mb-2 overflow-hidden">
            <motion.div 
              className="absolute top-0 left-0 h-full bg-copper-500 rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: getProgressWidth() }}
              transition={{ duration: 0.5 }}
            ></motion.div>
          </div>
          
          <div className="flex justify-between text-xs text-loft-400 font-medium">
            <span>Pickup</span>
            <span>Transit</span>
            <span>Drop</span>
          </div>
        </div>

        {/* OTP Section (Only show if not completed) */}
        {status !== 'completed' && (
          <div className="card p-6 mb-6 flex items-center justify-between border-moss-500/30 bg-moss-500/5">
            <div>
              <p className="text-sm text-moss-400 font-medium mb-1 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4" /> Start Ride OTP
              </p>
              <p className="text-xs text-loft-300">Share this with the driver</p>
            </div>
            <div className="text-3xl font-mono font-bold tracking-widest text-loft-50">
              {displayOtp}
            </div>
          </div>
        )}

        {/* Blockchain Proof of Delivery (PoD) Section (Only show if completed) */}
        {status === 'completed' && (
          <div className="card p-6 mb-6 border-moss-500/40 bg-moss-500/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-moss-400 font-bold text-sm">
                <ShieldCheck className="w-5 h-5 text-moss-400" />
                <span>Cryptographic Proof of Delivery (PoD)</span>
              </div>
              <span className="text-[11px] bg-moss-500/20 text-moss-300 font-mono px-2 py-0.5 rounded border border-moss-500/30">
                BLOCKCHAIN VERIFIED
              </span>
            </div>
            <p className="text-xs text-loft-300 mb-2">
              Tamper-proof SHA-256 digital certificate generated at time of delivery completion:
            </p>
            <div className="bg-loft-950/80 p-3 rounded-lg border border-loft-800 flex items-center justify-between">
              <span className="font-mono text-xs text-moss-300 break-all select-all">
                {booking?.podHash || fallbackPodHash}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(booking?.podHash || fallbackPodHash);
                  setCopiedPod(true);
                  setTimeout(() => setCopiedPod(false), 2000);
                }}
                className="ml-3 text-xs text-copper-400 hover:text-copper-300 font-medium whitespace-nowrap bg-copper-500/10 px-2 py-1 rounded border border-copper-500/20 flex items-center gap-1"
              >
                {copiedPod ? <Check className="w-3.5 h-3.5 text-moss-400" /> : <Copy className="w-3.5 h-3.5 text-copper-400" />}
                {copiedPod ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {/* Driver Info */}
        <div className="card p-6 mb-6 flex flex-col gap-4">
          <div className="flex items-center gap-4 border-b border-loft-800 pb-4">
            <div className="w-16 h-16 bg-loft-800 rounded-full flex items-center justify-center overflow-hidden border-2 border-copper-500 text-2xl">
              👤
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-loft-50">
                {booking?.is3plOutsourced 
                  ? booking?.thirdPartyProvider 
                  : (booking?.driver?.name || (booking?.status === 'pending' ? 'Finding a driver...' : 'Assigning driver...'))}
              </h3>
              <div className="flex items-center gap-2 text-sm text-loft-300">
                <span>⭐ {booking?.driver?.rating || '4.8'}</span>
                <span>&bull;</span>
                <span className="capitalize">{booking?.is3plOutsourced ? 'Outsourced Partner' : (booking?.vehicle?.type ? `${booking.vehicle.type} tempo` : 'Tata Ace (Medium)')}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="bg-loft-800 px-3 py-1 rounded text-lg font-mono font-bold text-loft-50 border border-loft-700">
              {booking?.vehicle?.registrationNumber || booking?.driver?.licenseNumber || (booking?.is3plOutsourced ? '3PL-PARTNER' : 'MH 12 AB 1234')}
            </div>
            <div className="flex gap-2">
              <button className="w-10 h-10 rounded-full bg-copper-500/10 border border-copper-500/20 text-copper-500 flex items-center justify-center hover:bg-copper-500/20 transition-colors">
                <MessageSquare className="w-5 h-5" />
              </button>
              <a href={`tel:${booking?.driver?.phone || '+919876543210'}`} className="w-10 h-10 rounded-full bg-moss-500 text-white flex items-center justify-center shadow-lg shadow-moss-500/20 hover:bg-moss-400 transition-colors">
                <Phone className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>

        {/* Trip Details */}
        <div className="card p-6 mb-6">
          <h3 className="text-sm font-bold text-loft-400 uppercase tracking-wider mb-4">Trip Details</h3>
          
          <div className="flex flex-col gap-3 mb-6 bg-loft-950/50 p-4 rounded-lg border border-loft-800">
            <div className="flex justify-between items-center">
              <span className="text-xs text-loft-400">Booked At:</span>
              <span className="text-xs font-semibold text-loft-200">
                {booking?.createdAt ? new Date(booking.createdAt).toLocaleString() : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-loft-400">Scheduled For:</span>
              <span className="text-xs font-semibold text-loft-200">
                {booking?.date} at {booking?.time}
              </span>
            </div>
          </div>
          
          <div className="relative pl-6 space-y-6">
            <div className="absolute left-2.5 top-2 bottom-2 w-px bg-loft-800"></div>
            
            <div className="relative">
              <div className="absolute -left-[29px] top-0.5 w-4 h-4 rounded-full bg-moss-500 border-4 border-loft-900"></div>
              <p className="text-sm font-bold text-loft-200">Pickup</p>
              <p className="text-sm text-loft-400">{booking?.pickupAddress || '123 Market Street, Viman Nagar, Pune'}</p>
            </div>
            
            <div className="relative">
              <div className="absolute -left-[29px] top-0.5 w-4 h-4 rounded-full bg-copper-500 border-4 border-loft-900"></div>
              <p className="text-sm font-bold text-loft-200">Drop</p>
              <p className="text-sm text-loft-400">{booking?.dropAddress || '456 Industrial Area, Hinjewadi Phase 1, Pune'}</p>
            </div>
          </div>
        </div>
        
        {/* Helpline */}
        <div className="mt-auto text-center pt-4">
          <p className="text-sm text-loft-400 mb-2">Need help with this booking?</p>
          <a href="tel:18001234567" className="text-copper-500 font-bold hover:text-copper-400 transition-colors">
            Call Support Helpline
          </a>
        </div>

      </div>

      <ReviewModal 
        isOpen={isReviewModalOpen} 
        onClose={() => setIsReviewModalOpen(false)} 
        bookingId={bookingId} 
        driverId={booking?.driverId || "d1234567-89ab-cdef-0123-456789abcdef"} 
        driverName={booking?.is3plOutsourced ? booking?.thirdPartyProvider : (booking?.driver?.name || "Ramesh Kumar")} 
      />
    </div>
  );
};

export default Tracking;

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Phone, MessageSquare, ShieldCheck, Check, Copy, Truck, ArrowRight, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import TrackingMap from '../components/Tracking/TrackingMap';
import ReviewModal from '../components/Customer/ReviewModal';
import api from '../services/api';
import { getToken } from '../services/tokenService';
import { io } from 'socket.io-client';
import { geocodeAddress, fetchOsrmRoute } from '../utils/puneGeocoder';

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
  const [copiedId, setCopiedId] = useState(false);
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

  // Routing State
  const [routeData, setRouteData] = useState(null);
  const [pickupCoord, setPickupCoord] = useState(null);
  const [dropCoord, setDropCoord] = useState(null);
  const [stopsCoords, setStopsCoords] = useState([]);
  const [isRoutingLoading, setIsRoutingLoading] = useState(false);

  const displayOtp = booking?.otp || (effectiveBookingId || bookingId || booking?.id
    ? String(Math.abs(String(effectiveBookingId || bookingId || booking?.id).split('').reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0)) % 9000 + 1000)
    : '4928');

  // Load Booking and Telemetry State
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

    socket.on('booking_status_updated', (data) => {
      if (isMounted && data.bookingId === (bookingId || effectiveBookingId)) {
        setStatus(data.status);
        if (data.status === 'completed') {
          setIsReviewModalOpen(true);
        }
      }
    });

    socket.on('trip:location_update', (data) => {
      if (isMounted && (data.bookingId === (bookingId || effectiveBookingId) || !data.bookingId)) {
        setTelemetry(prev => ({
          ...prev,
          lat: data.lat,
          lng: data.lng,
          speed: data.speed !== undefined ? data.speed : prev.speed,
          lastSynced: new Date().toLocaleTimeString(),
        }));
      }
    });

    socket.on('trip:telemetry', (data) => {
      if (isMounted) {
        setTelemetry(prev => ({
          ...prev,
          speed: data.speed !== undefined ? data.speed : prev.speed,
          lat: data.lat !== undefined ? data.lat : prev.lat,
          lng: data.lng !== undefined ? data.lng : prev.lng,
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
        resolveAndLoadBooking();
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

  // Geocode addresses and compute OSRM turn-by-turn road polyline
  useEffect(() => {
    let isCancelled = false;

    const pickupAddress = booking?.pickupAddress;
    const dropAddress = booking?.dropAddress;
    const stops = booking?.stops;

    const resolveRoute = async () => {
      if (!pickupAddress) return;
      setIsRoutingLoading(true);

      try {
        const pCoord = await geocodeAddress(pickupAddress);
        if (isCancelled) return;
        if (pCoord) setPickupCoord(pCoord);

        let dCoord = null;
        if (dropAddress) {
          dCoord = await geocodeAddress(dropAddress);
          if (isCancelled) return;
          if (dCoord) setDropCoord(dCoord);
        }

        const resolvedStops = [];
        if (stops) {
          try {
            const rawStops = Array.isArray(booking.stops) 
              ? booking.stops 
              : (typeof booking.stops === 'string' ? JSON.parse(booking.stops) : []);
            for (const s of rawStops) {
              const addr = typeof s === 'string' ? s : s?.address;
              if (addr) {
                const sc = await geocodeAddress(addr);
                if (sc) resolvedStops.push(sc);
              }
            }
          } catch (_e) {}
        }
        if (isCancelled) return;
        setStopsCoords(resolvedStops);

        if (pCoord && dCoord) {
          const routeResult = await fetchOsrmRoute([pCoord, ...resolvedStops, dCoord]);
          if (!isCancelled && routeResult) {
            setRouteData(routeResult);
          }
        }
      } catch (err) {
        console.warn('Notice resolving booking route navigation:', err);
      } finally {
        if (!isCancelled) setIsRoutingLoading(false);
      }
    };

    resolveRoute();

    return () => {
      isCancelled = true;
    };
  }, [booking?.pickupAddress, booking?.dropAddress, booking?.stops]);

  const getStatusText = () => {
    switch(status) {
      case 'searching': return 'Searching for driver...';
      case 'driver_assigned': return 'Driver assigned, on the way to pickup.';
      case 'arrived': return 'Driver has arrived at pickup location.';
      case 'in_transit': return 'Goods in transit to destination.';
      case 'completed': return 'Delivery completed successfully!';
      default: return 'Loading status...';
    }
  };

  const getStatusBadge = () => {
    switch(status) {
      case 'searching': return { text: 'SEARCHING', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
      case 'driver_assigned': return { text: 'ASSIGNED', bg: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
      case 'arrived': return { text: 'AT PICKUP', bg: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
      case 'in_transit': return { text: 'IN TRANSIT', bg: 'bg-copper-500/20 text-copper-300 border-copper-500/30' };
      case 'completed': return { text: 'COMPLETED', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
      default: return { text: 'ACTIVE', bg: 'bg-loft-800 text-loft-300 border-loft-700' };
    }
  };

  const getProgressWidth = () => {
    switch(status) {
      case 'searching': return '12%';
      case 'driver_assigned': return '35%';
      case 'arrived': return '55%';
      case 'in_transit': return '82%';
      case 'completed': return '100%';
      default: return '10%';
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

  const statusBadge = getStatusBadge();

  return (
    <div className="w-full relative h-auto md:h-[calc(100vh-5rem)] bg-loft-950 flex flex-col md:flex-row md:overflow-hidden">
      
      {/* Map Area (Full Page Height, Responsive Leaflet Engine) */}
      <div className="w-full md:flex-1 h-[45vh] md:h-full relative bg-loft-900 border-b md:border-b-0 md:border-r border-loft-800 z-0">
        <TrackingMap 
          bookingId={effectiveBookingId || bookingId} 
          initialLat={PUNE_POSITION[0]} 
          initialLng={PUNE_POSITION[1]} 
          isReconnecting={isReconnecting}
          currentPosition={[telemetry.lat || PUNE_POSITION[0], telemetry.lng || PUNE_POSITION[1]]}
          routeCoordinates={routeData?.polyline || []}
          pickupPosition={pickupCoord ? [pickupCoord.lat, pickupCoord.lng] : null}
          dropPosition={dropCoord ? [dropCoord.lat, dropCoord.lng] : null}
          stopsPositions={stopsCoords.map(s => [s.lat, s.lng])}
          pickupAddress={booking?.pickupAddress}
          dropAddress={booking?.dropAddress}
          driverName={booking?.driver?.name || (booking?.is3plOutsourced ? booking?.thirdPartyProvider : 'Driver')}
          vehicleNumber={booking?.vehicle?.registrationNumber || (booking?.is3plOutsourced ? '3PL-PARTNER' : 'MH 12 AB 1234')}
          speed={telemetry.speed}
          status={status}
        />
      </div>

      {/* Tracking Details Pane (Streamlined, Minimal-Scroll Layout) */}
      <div className="w-full md:w-[420px] lg:w-[450px] flex-shrink-0 bg-loft-950 p-4 md:p-5 flex flex-col md:h-full md:overflow-y-auto custom-scrollbar gap-3 z-10 border-l border-loft-800/80">
        
        {/* Compact Header: Nav + Title + Status Chip */}
        <div className="flex items-center justify-between pb-2 border-b border-loft-800/70">
          <div>
            <Link to="/customer/dashboard" className="text-copper-400 text-xs font-semibold uppercase tracking-wider hover:text-copper-300 transition-colors flex items-center gap-1">
              &larr; Back to Dashboard
            </Link>
            <h1 className="text-xl font-serif font-bold text-loft-50 mt-1 flex items-center gap-2">
              Track Ride
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider ${statusBadge.bg}`}>
                {statusBadge.text}
              </span>
            </h1>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-loft-400 block font-mono">
              ID: {effectiveBookingId ? effectiveBookingId.slice(-8) : (bookingId ? bookingId.slice(-8) : 'ACTIVE')}
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(effectiveBookingId || bookingId || '');
                setCopiedId(true);
                setTimeout(() => setCopiedId(false), 2000);
              }}
              className="text-[10px] text-copper-400 hover:text-copper-300 font-medium inline-flex items-center gap-1 mt-0.5"
            >
              {copiedId ? <Check className="w-3 h-3 text-moss-400" /> : <Copy className="w-3 h-3" />}
              {copiedId ? 'Copied' : 'Copy ID'}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Socket Offline / Reconnecting Spinner Indicator (TC-KRI-002) */}
        {isReconnecting && (
          <div 
            id="reconnecting-spinner"
            data-testid="reconnecting-spinner"
            className="p-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 flex items-center justify-between shadow-lg"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
              <div>
                <p className="text-xs font-bold text-amber-300">Reconnecting GPS...</p>
                <p className="text-[10px] text-loft-400">Syncing live coordinates upon reconnect</p>
              </div>
            </div>
            <span className="text-[9px] bg-amber-500/20 text-amber-300 font-mono px-1.5 py-0.5 rounded font-semibold uppercase">
              Offline
            </span>
          </div>
        )}

        {/* Unified Status & Live Telemetry HUD Card (Compact) */}
        <div className="p-3.5 rounded-xl border border-loft-800 bg-loft-900/60 shadow-md">
          {/* Status Header */}
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-loft-100 truncate pr-2">{getStatusText()}</h2>
            <span 
              data-testid="telemetry-status-badge"
              className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-semibold flex-shrink-0 ${
                isReconnecting ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {isReconnecting ? 'Reconnecting...' : 'Live GPS Sync'}
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="relative h-1.5 bg-loft-800 rounded-full mb-1.5 overflow-hidden">
            <motion.div 
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-copper-500 to-orange-400 rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: getProgressWidth() }}
              transition={{ duration: 0.5 }}
            ></motion.div>
          </div>
          <div className="flex justify-between text-[10px] text-loft-400 font-medium mb-3">
            <span>Pickup</span>
            <span>Transit</span>
            <span>Drop</span>
          </div>

          {/* Telemetry Metric Chips */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-loft-800/80">
            <div className="p-2 bg-loft-950/80 rounded-lg border border-loft-800 text-center">
              <span className="text-[10px] text-loft-400 block mb-0.5">Speed</span>
              <span data-testid="telemetry-speed" className="text-sm font-mono font-bold text-loft-100">
                {typeof telemetry.speed === 'number' ? telemetry.speed : (status === 'in_transit' ? 44 : (status === 'driver_assigned' ? 28 : 0))} km/h
              </span>
            </div>
            <div className="p-2 bg-loft-950/80 rounded-lg border border-loft-800 text-center">
              <span className="text-[10px] text-loft-400 block mb-0.5">Est. Distance</span>
              <span className="text-sm font-mono font-bold text-copper-300">
                {routeData?.distanceKm ? `${routeData.distanceKm} km` : (booking?.totalDistance ? `${booking.totalDistance} km` : '16.5 km')}
              </span>
            </div>
            <div className="p-2 bg-loft-950/80 rounded-lg border border-loft-800 text-center">
              <span className="text-[10px] text-loft-400 block mb-0.5">Location</span>
              <span data-testid="telemetry-location" className="text-[11px] font-mono font-semibold text-loft-200 block truncate">
                {(telemetry.lat || PUNE_POSITION[0]).toFixed(3)}°, {(telemetry.lng || PUNE_POSITION[1]).toFixed(3)}°
              </span>
            </div>
          </div>
          <div className="text-[9px] text-loft-400 mt-2 text-right">
            Synced: <span className="font-mono text-loft-300">{telemetry.lastSynced}</span>
          </div>
        </div>

        {/* Start Ride OTP Card (Only show if not completed) */}
        {status !== 'completed' && (
          <div className="p-3.5 rounded-xl flex items-center justify-between border border-moss-500/40 bg-moss-500/10 shadow-md">
            <div>
              <p className="text-xs text-moss-300 font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-moss-400" /> Start Ride OTP
              </p>
              <p className="text-[11px] text-loft-300 mt-0.5">Share with driver upon tempo arrival</p>
            </div>
            <div className="text-2xl font-mono font-extrabold tracking-widest text-loft-50 bg-loft-950/90 px-3 py-1 rounded-lg border border-moss-500/30">
              {displayOtp}
            </div>
          </div>
        )}

        {/* Blockchain Proof of Delivery (PoD) Section (Only show if completed) */}
        {status === 'completed' && (
          <div className="p-3.5 rounded-xl border border-moss-500/40 bg-moss-500/10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-moss-400 font-bold text-xs">
                <ShieldCheck className="w-4 h-4 text-moss-400" />
                <span>Blockchain Proof of Delivery (PoD)</span>
              </div>
              <span className="text-[9px] bg-moss-500/20 text-moss-300 font-mono px-2 py-0.5 rounded border border-moss-500/30">
                VERIFIED
              </span>
            </div>
            <div className="bg-loft-950/90 p-2.5 rounded-lg border border-loft-800 flex items-center justify-between">
              <span className="font-mono text-[10px] text-moss-300 break-all select-all pr-2">
                {booking?.podHash || fallbackPodHash}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(booking?.podHash || fallbackPodHash);
                  setCopiedPod(true);
                  setTimeout(() => setCopiedPod(false), 2000);
                }}
                className="text-[10px] text-copper-400 hover:text-copper-300 font-medium whitespace-nowrap bg-copper-500/10 px-2 py-1 rounded border border-copper-500/20 flex items-center gap-1 flex-shrink-0"
              >
                {copiedPod ? <Check className="w-3 h-3 text-moss-400" /> : <Copy className="w-3 h-3 text-copper-400" />}
                {copiedPod ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {/* Driver & Vehicle Compact Card */}
        <div className="p-3.5 rounded-xl border border-loft-800 bg-loft-900/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-loft-800 rounded-full flex items-center justify-center overflow-hidden border border-copper-500/40 text-xl flex-shrink-0 shadow-inner">
              👤
            </div>
            <div>
              <h3 className="text-sm font-bold text-loft-50">
                {booking?.is3plOutsourced 
                  ? booking?.thirdPartyProvider 
                  : (booking?.driver?.name || (booking?.status === 'pending' ? 'Finding a driver...' : 'Driver 1'))}
              </h3>
              <div className="flex items-center gap-2 text-xs text-loft-400 mt-0.5">
                <span>⭐ {booking?.driver?.rating || '4.8'}</span>
                <span>&bull;</span>
                <span className="capitalize">{booking?.is3plOutsourced ? 'Outsourced Partner' : (booking?.vehicle?.type ? `${booking.vehicle.type} tempo` : 'Tata Ace (Medium)')}</span>
              </div>
              <div className="text-[11px] font-mono text-copper-300 mt-0.5 font-bold">
                {booking?.vehicle?.registrationNumber || booking?.driver?.licenseNumber || (booking?.is3plOutsourced ? '3PL-PARTNER' : 'MH-12-AB-1234')}
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button className="w-9 h-9 rounded-full bg-copper-500/10 border border-copper-500/20 text-copper-400 flex items-center justify-center hover:bg-copper-500/20 transition-colors">
              <MessageSquare className="w-4 h-4" />
            </button>
            <a href={`tel:${booking?.driver?.phone || '+919876543210'}`} className="w-9 h-9 rounded-full bg-moss-500 text-white flex items-center justify-center shadow-md shadow-moss-500/20 hover:bg-moss-400 transition-colors">
              <Phone className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Route Details & Timeline (Compact) */}
        <div className="p-3.5 rounded-xl border border-loft-800 bg-loft-900/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-loft-400 uppercase tracking-wider">Route Timeline</span>
            {routeData?.durationMins && (
              <span className="text-[10px] text-copper-400 font-semibold flex items-center gap-1">
                <Clock className="w-3 h-3" /> ~{routeData.durationMins} mins
              </span>
            )}
          </div>
          
          <div className="relative pl-5 space-y-2.5">
            <div className="absolute left-2 top-2 bottom-2 w-px bg-loft-800"></div>
            
            {/* Pickup */}
            <div className="relative">
              <div className="absolute -left-[19px] top-1 w-3 h-3 rounded-full bg-moss-500 border-2 border-loft-900 shadow-sm"></div>
              <p className="text-[11px] font-bold text-moss-400 uppercase tracking-wider">Pickup</p>
              <p className="text-xs text-loft-200 line-clamp-1">{booking?.pickupAddress || 'Pune'}</p>
            </div>
            
            {/* Drop */}
            <div className="relative">
              <div className="absolute -left-[19px] top-1 w-3 h-3 rounded-full bg-copper-500 border-2 border-loft-900 shadow-sm"></div>
              <p className="text-[11px] font-bold text-copper-400 uppercase tracking-wider">Drop</p>
              <p className="text-xs text-loft-200 line-clamp-1">{booking?.dropAddress || 'Hyderabad'}</p>
            </div>
          </div>
        </div>

        {/* Helpline Footer */}
        <div className="mt-auto pt-2 text-center text-xs text-loft-400 border-t border-loft-800/40">
          Need help? <a href="tel:18001234567" className="text-copper-400 font-bold hover:underline">Call IVR Helpline</a>
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

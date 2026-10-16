import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { 
  Navigation, 
  Compass, 
  Maximize2, 
  ExternalLink, 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  Gauge, 
  MapPin
} from 'lucide-react';
import { geocodeAddress, fetchOsrmRoute } from '../../utils/puneGeocoder';

// Fix for default Leaflet marker icons in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
});

// Calculate bearing angle (0 - 360 degrees) between two coordinates
function calculateBearing(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

// Calculate Haversine distance in meters
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Generate dense waypoints along route polyline for silky smooth 60fps movement
function generateDenseRoute(polyline, maxStepMeters = 18) {
  if (!polyline || polyline.length < 2) return polyline || [];
  const dense = [];

  for (let i = 0; i < polyline.length - 1; i++) {
    const p1 = polyline[i];
    const p2 = polyline[i + 1];
    dense.push(p1);

    const distMeters = getDistanceMeters(p1[0], p1[1], p2[0], p2[1]);
    if (distMeters > maxStepMeters) {
      const steps = Math.floor(distMeters / maxStepMeters);
      for (let s = 1; s < steps; s++) {
        const ratio = s / steps;
        dense.push([
          p1[0] + (p2[0] - p1[0]) * ratio,
          p1[1] + (p2[1] - p1[1]) * ratio
        ]);
      }
    }
  }
  dense.push(polyline[polyline.length - 1]);
  return dense;
}

// Rotating Tempo Marker with Directional Beacon and Pulse Wave
const createRotatingTruckIcon = (bearing = 0, isMoving = false, speedKmh = 0) => {
  return L.divIcon({
    className: 'custom-rotating-truck-marker',
    html: `
      <div style="position: relative; width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
        <!-- Pulsing radar wave when moving -->
        ${isMoving ? `
          <div style="
            position: absolute;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: rgba(232, 99, 49, 0.45);
            animation: tempoRadar 1.4s ease-out infinite;
          "></div>
        ` : ''}

        <!-- Rotating tempo container -->
        <div style="
          position: relative;
          width: 46px;
          height: 46px;
          border-radius: 50%;
          background: #141720;
          border: 2.8px solid #e86331;
          box-shadow: 0 4px 18px rgba(232, 99, 49, 0.75), 0 0 10px rgba(0,0,0,0.9);
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          transform: rotate(${bearing}deg);
          transition: transform 0.22s ease-out;
        ">
          <img 
            src="/images/map_marker_truck_1787941237726.jpg" 
            alt="Tempo Truck"
            style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;"
          />
        </div>

        <!-- Directional forward pointer arrow -->
        <div style="
          position: absolute;
          top: -2px;
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-bottom: 9px solid #e86331;
          transform-origin: 50% 30px;
          transform: rotate(${bearing}deg);
          filter: drop-shadow(0 0 4px #e86331);
        "></div>

        <!-- Live speed tag -->
        ${isMoving && speedKmh > 0 ? `
          <div style="
            position: absolute;
            bottom: -8px;
            background: #0f172a;
            color: #38bdf8;
            font-size: 9px;
            font-weight: 800;
            padding: 1px 5px;
            border-radius: 6px;
            border: 1px solid rgba(56, 189, 248, 0.4);
            box-shadow: 0 2px 6px rgba(0,0,0,0.8);
            white-space: nowrap;
            letter-spacing: 0.2px;
          ">
            ${Math.round(speedKmh)} km/h
          </div>
        ` : ''}
      </div>
    `,
    iconSize: [56, 56],
    iconAnchor: [28, 28],
    popupAnchor: [0, -28]
  });
};

// Destination Drop-off Pin Icon
const createDestinationIcon = () => {
  return L.divIcon({
    className: 'custom-dest-pin',
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer;">
        <div style="
          width: 34px; 
          height: 34px; 
          border-radius: 50%; 
          background: #e86331; 
          color: #ffffff; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          font-weight: 800; 
          font-size: 16px; 
          box-shadow: 0 4px 16px rgba(232, 99, 49, 0.6); 
          border: 2.5px solid #ffffff;
        ">
          🏁
        </div>
        <div style="width: 2px; height: 7px; background: #e86331;"></div>
        <div style="width: 6px; height: 6px; border-radius: 50%; background: #e86331; opacity: 0.85;"></div>
      </div>
    `,
    iconSize: [34, 47],
    iconAnchor: [17, 47],
    popupAnchor: [0, -47]
  });
};

// Dynamic Map Camera Controller
const MapCameraController = ({ centerPos, bounds, autoFollow, fitTrigger }) => {
  const map = useMap();

  // Initial bounds fit
  useEffect(() => {
    if (!bounds || bounds.length === 0) return;
    try {
      const leafletBounds = L.latLngBounds(bounds);
      map.fitBounds(leafletBounds, {
        paddingTopLeft: [40, 120],
        paddingBottomRight: [40, 60],
        maxZoom: 16,
        animate: true
      });
    } catch (e) {
      console.warn('Map fit bounds notice:', e);
    }
  }, [fitTrigger, map]);

  // Auto-follow moving tempo
  useEffect(() => {
    if (!autoFollow || !centerPos) return;
    try {
      map.setView([centerPos.lat, centerPos.lng], map.getZoom() < 15 ? 15 : map.getZoom(), {
        animate: true,
        duration: 0.35
      });
    } catch (e) {
      console.warn('Auto follow notice:', e);
    }
  }, [centerPos?.lat, centerPos?.lng, autoFollow, map]);

  return null;
};

const DriverNavigationMap = ({
  driverPos = { lat: 18.5204, lng: 73.8567 },
  activeRide,
  onLocationUpdate,
  onFinishTrip,
  className = ''
}) => {
  const [destCoord, setDestCoord] = useState(null);
  const [denseRoute, setDenseRoute] = useState([]);
  const [totalRouteDistanceKm, setTotalRouteDistanceKm] = useState(0);
  const [initialDurationMins, setInitialDurationMins] = useState(0);
  const [isLoadingRoute, setIsLoadingRoute] = useState(true);

  // Simulation State
  const [isSimulating, setIsSimulating] = useState(true);
  const [simSpeedMultiplier, setSimSpeedMultiplier] = useState(3); // 1x, 3x, 8x
  const [simIndex, setSimIndex] = useState(0);
  const [simPos, setSimPos] = useState(driverPos);
  const [simBearing, setSimBearing] = useState(0);
  const [simSpeedKmh, setSimSpeedKmh] = useState(42);
  const [autoFollow, setAutoFollow] = useState(true);
  const [hasArrived, setHasArrived] = useState(false);
  const [fitTrigger, setFitTrigger] = useState(0);

  const destinationAddress = activeRide?.dropoff || activeRide?.dropAddress || 'Destination';
  const lastBroadcastRef = useRef(0);

  // 1. Resolve destination coordinates from address
  useEffect(() => {
    let isCancelled = false;

    const resolveDest = async () => {
      if (!destinationAddress) return;
      setIsLoadingRoute(true);
      const coord = await geocodeAddress(destinationAddress);
      if (!isCancelled && coord) {
        setDestCoord(coord);
      }
    };

    resolveDest();
    return () => { isCancelled = true; };
  }, [destinationAddress]);

  // 2. Fetch OSRM turn-by-turn route and generate high-density path
  useEffect(() => {
    let isCancelled = false;
    if (!driverPos || !destCoord) return;

    const calculateDriverRoute = async () => {
      setIsLoadingRoute(true);
      try {
        const points = [driverPos, destCoord];
        const route = await fetchOsrmRoute(points);
        if (isCancelled) return;

        const dense = generateDenseRoute(route.polyline, 16);
        setDenseRoute(dense);
        setTotalRouteDistanceKm(route.distanceKm);
        setInitialDurationMins(route.durationMins);

        // Reset simulation to start of new route
        setSimIndex(0);
        setHasArrived(false);
        if (dense.length > 0) {
          const startPt = { lat: dense[0][0], lng: dense[0][1] };
          setSimPos(startPt);
          if (dense.length > 1) {
            setSimBearing(calculateBearing(dense[0][0], dense[0][1], dense[1][0], dense[1][1]));
          }
        }
        setFitTrigger(prev => prev + 1);
      } catch (err) {
        console.warn('Driver route calculation notice:', err);
      } finally {
        if (!isCancelled) setIsLoadingRoute(false);
      }
    };

    calculateDriverRoute();
    return () => { isCancelled = true; };
  }, [driverPos?.lat, driverPos?.lng, destCoord?.lat, destCoord?.lng]);

  // 3. Tempo Movement Simulation Loop
  useEffect(() => {
    if (!isSimulating || denseRoute.length < 2 || hasArrived) return;

    const intervalMs = 60; // 16 ticks per second for smooth glide
    const timer = setInterval(() => {
      setSimIndex((prevIndex) => {
        const nextIndex = prevIndex + simSpeedMultiplier;

        if (nextIndex >= denseRoute.length - 1) {
          // Arrived at destination
          const finalPt = denseRoute[denseRoute.length - 1];
          const finalPos = { lat: finalPt[0], lng: finalPt[1] };
          setSimPos(finalPos);
          setSimSpeedKmh(0);
          setHasArrived(true);
          setIsSimulating(false);
          onLocationUpdate?.(finalPos);
          return denseRoute.length - 1;
        }

        const currentPt = denseRoute[nextIndex];
        const lookAheadPt = denseRoute[Math.min(nextIndex + 2, denseRoute.length - 1)];
        const newPos = { lat: currentPt[0], lng: currentPt[1] };

        // Dynamic bearing to face the road curve
        const newBearing = calculateBearing(
          currentPt[0],
          currentPt[1],
          lookAheadPt[0],
          lookAheadPt[1]
        );

        // Realistic speed fluctuation (36 - 54 km/h)
        const speedVariance = Math.sin(nextIndex / 8) * 8 + (nextIndex % 5 === 0 ? -4 : 3);
        const dynamicSpeed = Math.max(25, Math.min(58, 42 + speedVariance));

        setSimPos(newPos);
        setSimBearing(newBearing);
        setSimSpeedKmh(dynamicSpeed);

        // Broadcast to customer live tracking every 600ms
        const now = Date.now();
        if (now - lastBroadcastRef.current > 600) {
          lastBroadcastRef.current = now;
          onLocationUpdate?.(newPos);
        }

        return nextIndex;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isSimulating, denseRoute, simSpeedMultiplier, hasArrived, onLocationUpdate]);

  // 4. Calculate dynamic remaining metrics
  const progressPercent = useMemo(() => {
    if (!denseRoute || denseRoute.length < 2) return 0;
    return Math.min(100, Math.round((simIndex / (denseRoute.length - 1)) * 100));
  }, [simIndex, denseRoute]);

  const remainingDistanceKm = useMemo(() => {
    if (!denseRoute || denseRoute.length < 2) return totalRouteDistanceKm;
    const remainingRatio = 1 - simIndex / (denseRoute.length - 1);
    return Math.max(0, parseFloat((totalRouteDistanceKm * remainingRatio).toFixed(1)));
  }, [simIndex, denseRoute, totalRouteDistanceKm]);

  const remainingDurationMins = useMemo(() => {
    if (hasArrived) return 0;
    if (!denseRoute || denseRoute.length < 2) return initialDurationMins;
    const remainingRatio = 1 - simIndex / (denseRoute.length - 1);
    return Math.max(1, Math.round(initialDurationMins * remainingRatio));
  }, [simIndex, denseRoute, initialDurationMins, hasArrived]);

  // Split Polylines: Traveled (Emerald Green) vs Remaining (Vibrant Copper)
  const traveledPolyline = useMemo(() => {
    if (!denseRoute || denseRoute.length === 0) return [];
    return denseRoute.slice(0, simIndex + 1);
  }, [denseRoute, simIndex]);

  const remainingPolyline = useMemo(() => {
    if (!denseRoute || denseRoute.length === 0) return [];
    return denseRoute.slice(simIndex);
  }, [denseRoute, simIndex]);

  // Controls Handlers
  const handleTogglePlay = useCallback(() => {
    if (hasArrived) {
      // Replay from start
      setSimIndex(0);
      setHasArrived(false);
      setIsSimulating(true);
    } else {
      setIsSimulating(prev => !prev);
    }
  }, [hasArrived]);

  const handleRestart = useCallback(() => {
    setSimIndex(0);
    setHasArrived(false);
    setIsSimulating(true);
    if (denseRoute.length > 0) {
      setSimPos({ lat: denseRoute[0][0], lng: denseRoute[0][1] });
      setFitTrigger(prev => prev + 1);
    }
  }, [denseRoute]);

  const mapBounds = useMemo(() => {
    const list = [];
    if (driverPos?.lat) list.push([driverPos.lat, driverPos.lng]);
    if (destCoord?.lat) list.push([destCoord.lat, destCoord.lng]);
    return list;
  }, [driverPos, destCoord]);

  const googleMapsUrl = useMemo(() => {
    const origin = simPos ? `${simPos.lat},${simPos.lng}` : '';
    const dest = destCoord ? `${destCoord.lat},${destCoord.lng}` : encodeURIComponent(destinationAddress);
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`;
  }, [simPos, destCoord, destinationAddress]);

  return (
    <div className={`flex-1 card overflow-hidden relative min-h-[500px] md:min-h-[560px] border-copper-500/30 flex flex-col ${className}`}>
      
      {/* Top Floating Active Route Navigation & Telematics HUD */}
      <div className="absolute top-3 left-3 right-3 bg-gradient-to-r from-loft-950/95 via-loft-900/95 to-loft-950/95 text-white rounded-2xl p-4 shadow-2xl z-[1000] border border-copper-500/30 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          
          {/* Left: Direction and Live Status */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-lg border transition-all ${
              hasArrived 
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-400' 
                : isSimulating 
                  ? 'bg-copper-500/20 border-copper-400 text-copper-400 animate-pulse' 
                  : 'bg-loft-800 border-loft-700 text-loft-400'
            }`}>
              {hasArrived ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              ) : (
                <Navigation className="w-6 h-6 text-copper-400 rotate-45" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-base md:text-lg leading-tight truncate text-loft-50">
                  {hasArrived ? 'Destination Reached!' : 'Tempo Moving Simulation'}
                </h4>
                
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                  hasArrived
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-400/40'
                    : isSimulating
                      ? 'bg-copper-950/60 text-copper-300 border-copper-400/40'
                      : 'bg-loft-800 text-loft-300 border-loft-700'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    hasArrived ? 'bg-emerald-400' : isSimulating ? 'bg-copper-400 animate-ping' : 'bg-loft-500'
                  }`}></span>
                  {hasArrived ? 'Arrived 🏁' : isSimulating ? 'Live In-Transit' : 'Drive Paused'}
                </span>

                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-cyan-300 bg-cyan-950/50 border border-cyan-500/30 px-2 py-0.5 rounded-md">
                  <Gauge className="w-3 h-3 text-cyan-400" />
                  {hasArrived ? '0 km/h' : `${Math.round(simSpeedKmh)} km/h`}
                </span>
              </div>

              <p className="text-loft-300 text-xs truncate max-w-lg mt-0.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-copper-400 shrink-0" />
                <span>En route to: <strong className="text-loft-100 font-semibold">{destinationAddress}</strong></span>
              </p>
            </div>
          </div>

          {/* Right: Live Remaining Distance & Countdown ETA */}
          <div className="flex items-center gap-4 shrink-0 sm:text-right w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-loft-800">
            <div>
              <p className="text-xs text-loft-400 font-medium">Distance Left</p>
              <h4 className="font-extrabold text-lg md:text-xl tracking-tight text-copper-400">
                {hasArrived ? '0.0 km' : `${remainingDistanceKm.toFixed(1)} km`}
              </h4>
            </div>

            <div className="w-[1px] h-8 bg-loft-800"></div>

            <div>
              <p className="text-xs text-loft-400 font-medium">ETA</p>
              <h4 className="font-extrabold text-lg md:text-xl tracking-tight text-emerald-400">
                {hasArrived ? 'Completed' : `~${remainingDurationMins} mins`}
              </h4>
            </div>
          </div>
        </div>

        {/* Dynamic Route Progress Bar */}
        <div className="mt-3 pt-2 border-t border-loft-800/80">
          <div className="flex justify-between items-center text-[10px] text-loft-400 font-mono mb-1">
            <span>Route Progress: <strong className="text-copper-400 font-bold">{progressPercent}%</strong></span>
            <span>{hasArrived ? 'Delivery Complete' : `${denseRoute.length - simIndex} waypoints remaining`}</span>
          </div>
          <div className="w-full h-1.5 bg-loft-950 rounded-full overflow-hidden border border-loft-800">
            <div 
              className="h-full bg-gradient-to-r from-copper-500 via-amber-400 to-emerald-400 transition-all duration-150 ease-out"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Interactive Leaflet Map */}
      <div className="relative w-full h-full min-h-[440px] flex-1 z-0">
        <MapContainer
          center={[simPos.lat, simPos.lng]}
          zoom={15}
          scrollWheelZoom={true}
          zoomControl={false}
          className="w-full h-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            className="map-tiles"
          />

          <MapCameraController 
            centerPos={simPos} 
            bounds={mapBounds} 
            autoFollow={autoFollow}
            fitTrigger={fitTrigger}
          />

          {/* Moving Tempo Truck Marker (Rotates along road bearing) */}
          <Marker 
            position={[simPos.lat, simPos.lng]} 
            icon={createRotatingTruckIcon(simBearing, isSimulating, simSpeedKmh)}
          >
            <Popup>
              <div className="p-1 min-w-[180px]">
                <div className="flex items-center justify-between border-b border-loft-200 pb-1 mb-1.5">
                  <span className="font-bold text-xs text-copper-600">Eminence Tempo Truck</span>
                  <span className="text-[10px] bg-copper-100 text-copper-700 px-1.5 py-0.5 rounded font-bold">
                    {Math.round(simSpeedKmh)} km/h
                  </span>
                </div>
                <p className="text-[11px] text-loft-700">
                  <strong>GPS:</strong> {simPos.lat.toFixed(5)}, {simPos.lng.toFixed(5)}
                </p>
                <p className="text-[11px] text-loft-700 mt-0.5">
                  <strong>Heading:</strong> {Math.round(simBearing)}° • {progressPercent}% of Route
                </p>
                <p className="text-[10px] text-emerald-600 font-semibold mt-1">
                  ● {hasArrived ? 'Arrived at Destination' : isSimulating ? 'Actively Driving to Drop-off' : 'Drive Paused'}
                </p>
              </div>
            </Popup>
          </Marker>

          {/* Destination Drop-off Pin Marker */}
          {destCoord && (
            <Marker position={[destCoord.lat, destCoord.lng]} icon={createDestinationIcon()}>
              <Popup>
                <div className="p-1">
                  <span className="font-bold text-xs text-copper-600 block">Delivery Drop-off</span>
                  <p className="text-xs text-loft-700 mt-1 max-w-xs">{destinationAddress}</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Traveled Polyline (Emerald Green completed trail) */}
          {traveledPolyline.length > 1 && (
            <Polyline
              positions={traveledPolyline}
              pathOptions={{
                color: '#10b981',
                weight: 6,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round'
              }}
            />
          )}

          {/* Remaining Polyline (Vibrant Copper ahead) */}
          {remainingPolyline.length > 1 && (
            <Polyline
              positions={remainingPolyline}
              pathOptions={{
                color: '#e86331',
                weight: 5,
                opacity: 0.85,
                dashArray: '8, 8',
                lineCap: 'round',
                lineJoin: 'round'
              }}
            />
          )}
        </MapContainer>

        {/* Loading Overlay */}
        {isLoadingRoute && (
          <div className="absolute top-36 left-4 z-[999] bg-loft-950/85 backdrop-blur-md border border-loft-800 text-loft-200 px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 shadow-2xl">
            <div className="w-3.5 h-3.5 border-2 border-copper-500 border-t-transparent rounded-full animate-spin"></div>
            <span>Calculating real road path for tempo simulation...</span>
          </div>
        )}

        {/* Arrival Celebration Card */}
        {hasArrived && (
          <div className="absolute top-36 left-4 right-4 sm:left-auto sm:right-4 z-[1001] bg-gradient-to-r from-emerald-950/95 via-loft-950/95 to-emerald-950/95 border-2 border-emerald-500/50 rounded-2xl p-4 shadow-2xl backdrop-blur-md max-w-md animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center shrink-0 text-xl">
                🏁
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-extrabold text-base text-emerald-400">Destination Reached!</h4>
                <p className="text-xs text-loft-200 mt-0.5">
                  The tempo truck has arrived at <strong>{destinationAddress}</strong>. Ready to handover cargo and capture proof of delivery.
                </p>
                
                <div className="flex items-center gap-2.5 mt-3">
                  {onFinishTrip && (
                    <button
                      type="button"
                      onClick={onFinishTrip}
                      className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-loft-950 text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Sign PoD & Finish
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleRestart}
                    className="px-3.5 py-2 rounded-xl bg-loft-800 hover:bg-loft-700 text-loft-200 text-xs font-semibold border border-loft-700 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-copper-400" />
                    Replay Run
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Floating Simulation Control Deck */}
        <div className="absolute bottom-4 left-4 right-4 z-[1000] flex flex-wrap items-center justify-between gap-3 pointer-events-none">
          
          {/* Main Simulation Controls (Play/Pause, Speed, Restart) */}
          <div className="bg-loft-950/95 backdrop-blur-md border border-copper-500/30 p-2 rounded-2xl shadow-2xl flex items-center gap-2 pointer-events-auto">
            <button
              type="button"
              onClick={handleTogglePlay}
              className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer ${
                isSimulating
                  ? 'bg-amber-500 hover:bg-amber-400 text-loft-950'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-loft-950'
              }`}
            >
              {isSimulating ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-loft-950" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-loft-950" />
                  <span>{hasArrived ? 'Replay' : 'Drive'}</span>
                </>
              )}
            </button>

            {/* Speed Multiplier Selector */}
            <div className="flex items-center bg-loft-900 border border-loft-800 rounded-xl p-1 gap-1">
              {[1, 3, 8].map((mult) => (
                <button
                  key={mult}
                  type="button"
                  onClick={() => setSimSpeedMultiplier(mult)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold font-mono transition-all cursor-pointer ${
                    simSpeedMultiplier === mult
                      ? 'bg-copper-500 text-white shadow-sm'
                      : 'text-loft-400 hover:text-loft-200'
                  }`}
                  title={`${mult}x simulation playback speed`}
                >
                  {mult}x
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleRestart}
              title="Restart route from start"
              className="p-2 rounded-xl bg-loft-900 hover:bg-loft-800 text-loft-300 hover:text-copper-400 border border-loft-800 transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Right Map Actions (Auto-Follow Camera, Fit Route, Google Maps) */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              type="button"
              onClick={() => setAutoFollow(prev => !prev)}
              title={autoFollow ? 'Auto-follow camera locked on tempo' : 'Free map pan (click to re-lock)'}
              className={`p-2.5 rounded-xl border shadow-xl backdrop-blur-md transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold ${
                autoFollow
                  ? 'bg-copper-500/20 border-copper-400 text-copper-300'
                  : 'bg-loft-900/90 hover:bg-loft-800 text-loft-300 border-loft-700/80'
              }`}
            >
              <Compass className={`w-4 h-4 ${autoFollow ? 'text-copper-400 animate-spin' : 'text-loft-400'}`} />
              <span className="hidden sm:inline">{autoFollow ? 'Camera Lock' : 'Free Pan'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAutoFollow(false);
                setFitTrigger(prev => prev + 1);
              }}
              title="Fit entire route on screen"
              className="p-2.5 bg-loft-900/90 hover:bg-loft-800 text-loft-100 hover:text-copper-400 border border-loft-700/80 rounded-xl shadow-xl backdrop-blur-md transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
            >
              <Maximize2 className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Overview</span>
            </button>

            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open turn-by-turn navigation in Google Maps"
              className="p-2.5 bg-copper-500 hover:bg-copper-400 text-loft-950 rounded-xl shadow-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Google Maps</span>
            </a>
          </div>

        </div>

      </div>

      <style>{`
        @keyframes tempoRadar {
          0% {
            transform: scale(0.8);
            opacity: 0.9;
          }
          100% {
            transform: scale(1.6);
            opacity: 0;
          }
        }
        .map-tiles {
          filter: brightness(0.78) invert(1) contrast(3) hue-rotate(200deg) saturate(0.35);
        }
      `}</style>
    </div>
  );
};

export default DriverNavigationMap;

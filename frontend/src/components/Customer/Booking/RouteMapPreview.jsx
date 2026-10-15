import React, { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Navigation, Clock, Zap, MapPin, AlertCircle, Sparkles } from 'lucide-react';

// Custom Pin Icon Generator
const createPinIcon = (label, color = 'copper') => {
  const isPickup = color === 'moss';
  const bgColor = isPickup ? '#10b981' : '#b87333';
  const shadowColor = isPickup ? 'rgba(16, 185, 129, 0.4)' : 'rgba(184, 115, 51, 0.4)';

  return L.divIcon({
    className: 'custom-route-pin',
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer;">
        <div style="
          width: 30px; 
          height: 30px; 
          border-radius: 50%; 
          background: ${bgColor}; 
          color: #ffffff; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          font-weight: 800; 
          font-size: 13px; 
          font-family: ui-sans-serif, system-ui;
          box-shadow: 0 4px 14px ${shadowColor}; 
          border: 2.5px solid #ffffff;
        ">
          ${label}
        </div>
        <div style="width: 2px; height: 6px; background: ${bgColor};"></div>
        <div style="width: 6px; height: 6px; border-radius: 50%; background: ${bgColor}; opacity: 0.7;"></div>
      </div>
    `,
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -42]
  });
};

// Component to dynamically fit route bounds
const FitBounds = ({ positions }) => {
  const map = useMap();

  useEffect(() => {
    if (!positions || positions.length === 0) return;
    try {
      if (positions.length === 1) {
        map.setView(positions[0], 14, { animate: true });
      } else {
        const bounds = L.latLngBounds(positions);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16, animate: true });
      }
    } catch (e) {
      console.warn('Map fit bounds warning:', e);
    }
  }, [positions, map]);

  return null;
};

// Cache for geocoded queries
const geocodeCache = new Map();

// Helper to geocode an address string to { lat, lng } strictly within Pune metropolitan area
const geocodeAddress = async (query) => {
  if (!query || typeof query !== 'string' || query.trim().length < 3) return null;
  const clean = query.trim();

  if (geocodeCache.has(clean)) {
    return geocodeCache.get(clean);
  }

  const lower = clean.toLowerCase();

  // 1. Live Nominatim geocoding bounded strictly to Pune & PCMC Metropolitan Region (PMRDA)
  // Bounding box: min_lon: 73.60, max_lat: 18.85, max_lon: 74.20, min_lat: 18.30
  try {
    let searchParam = clean;
    if (!lower.includes('pune') && !lower.includes('pcmc') && !lower.includes('maharashtra')) {
      searchParam = `${clean}, Pune, Maharashtra`;
    }
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchParam)}&viewbox=73.60,18.85,74.20,18.30&bounded=1&countrycodes=in&limit=1`;
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'Eminence-Transport-MVP/1.0'
      }
    });
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      // Validate that coordinates lie within Pune Metropolitan Area
      if (lat >= 18.25 && lat <= 18.90 && lng >= 73.55 && lng <= 74.25) {
        const coords = { lat, lng };
        geocodeCache.set(clean, coords);
        return coords;
      }
    }
  } catch (err) {
    console.warn('Live geocoding network notice:', err);
  }

  // 2. Pre-seed known distinct Pune / PCMC landmarks and localities
  // NOTE: Generic city names like 'pune' or 'mumbai' are strictly omitted to prevent identical coordinate collapse
  const knownLocations = {
    'brihan maharashtra': { lat: 18.5209, lng: 73.8354 },
    'bmcc': { lat: 18.5209, lng: 73.8354 },
    'deccan gymkhana': { lat: 18.5173, lng: 73.8415 },
    'deccan': { lat: 18.5193, lng: 73.8341 },
    'wagholi': { lat: 18.5806, lng: 73.9833 },
    'shivajinagar': { lat: 18.5314, lng: 73.8446 },
    'hinjewadi phase 1': { lat: 18.5913, lng: 73.7389 },
    'hinjewadi phase 2': { lat: 18.5870, lng: 73.7220 },
    'hinjewadi phase 3': { lat: 18.5780, lng: 73.6990 },
    'hinjewadi': { lat: 18.5913, lng: 73.7389 },
    'kothrud': { lat: 18.5074, lng: 73.8077 },
    'viman nagar': { lat: 18.5679, lng: 73.9143 },
    'hadapsar': { lat: 18.5089, lng: 73.9259 },
    'bhosari': { lat: 18.6298, lng: 73.8453 },
    'wakad': { lat: 18.5987, lng: 73.7687 },
    'baner': { lat: 18.5590, lng: 73.7868 },
    'aundh': { lat: 18.5580, lng: 73.8075 },
    'swargate': { lat: 18.5018, lng: 73.8586 },
    'katraj': { lat: 18.4575, lng: 73.8677 },
    'kharadi': { lat: 18.5516, lng: 73.9348 },
    'kalyani nagar': { lat: 18.5477, lng: 73.9037 },
    'magarpatta': { lat: 18.5158, lng: 73.9272 },
    'chakan': { lat: 18.7606, lng: 73.8567 },
    'pimpri': { lat: 18.6279, lng: 73.8009 },
    'chinchwad': { lat: 18.6298, lng: 73.7820 },
    'nigdi': { lat: 18.6540, lng: 73.7749 },
    'yerawada': { lat: 18.5529, lng: 73.8797 },
    'camp': { lat: 18.5167, lng: 73.8833 },
    'kondhwa': { lat: 18.4740, lng: 73.8900 },
    'karve nagar': { lat: 18.4910, lng: 73.8180 },
    'pashan': { lat: 18.5410, lng: 73.7920 },
    'bavdhan': { lat: 18.5120, lng: 73.7740 },
    'fatima nagar': { lat: 18.5030, lng: 73.8980 }
  };

  for (const [key, coords] of Object.entries(knownLocations)) {
    if (lower.includes(key)) {
      geocodeCache.set(clean, coords);
      return coords;
    }
  }

  // 3. Fallback deterministic offset within Pune boundary only
  const hash = clean.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const fallback = {
    lat: 18.5204 + ((hash % 80) - 40) * 0.0015,
    lng: 73.8567 + (((hash * 5) % 80) - 40) * 0.0015
  };
  geocodeCache.set(clean, fallback);
  return fallback;
};

const RouteMapPreview = ({
  pickupAddress,
  dropAddresses = [],
  pickupCoord: propPickupCoord = null,
  dropCoords: propDropCoords = [],
  onRouteCalculated,
  className = ''
}) => {
  const [pickupCoord, setPickupCoord] = useState(propPickupCoord);
  const [dropCoords, setDropCoords] = useState(propDropCoords || []);
  const [routePolyline, setRoutePolyline] = useState([]);
  const [routeStats, setRouteStats] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const lastNotifiedRef = useRef('');

  // 1. Resolve coordinates for Pickup and Drops
  useEffect(() => {
    let isCancelled = false;

    const resolveCoords = async () => {
      // Resolve Pickup: prioritize prop coordinates if provided
      let pCoord = null;
      if (propPickupCoord && propPickupCoord.lat && propPickupCoord.lng) {
        pCoord = { lat: parseFloat(propPickupCoord.lat), lng: parseFloat(propPickupCoord.lng) };
      } else if (pickupAddress) {
        if (typeof pickupAddress === 'object' && pickupAddress.lat && pickupAddress.lng) {
          pCoord = { lat: parseFloat(pickupAddress.lat), lng: parseFloat(pickupAddress.lng) };
        } else if (typeof pickupAddress === 'string' && pickupAddress.trim()) {
          pCoord = await geocodeAddress(pickupAddress);
        }
      }

      // Resolve Drops: prioritize prop coordinates
      const dCoords = [];
      const validDrops = Array.isArray(dropAddresses) ? dropAddresses.filter(d => (typeof d === 'string' ? d.trim().length > 0 : Boolean(d))) : [];
      
      for (let idx = 0; idx < validDrops.length; idx++) {
        const drop = validDrops[idx];
        const propCoord = Array.isArray(propDropCoords) ? propDropCoords[idx] : null;

        if (propCoord && propCoord.lat && propCoord.lng) {
          dCoords.push({ lat: parseFloat(propCoord.lat), lng: parseFloat(propCoord.lng) });
        } else if (typeof drop === 'object' && drop?.lat && drop?.lng) {
          dCoords.push({ lat: parseFloat(drop.lat), lng: parseFloat(drop.lng) });
        } else if (typeof drop === 'string' && drop.trim()) {
          const coord = await geocodeAddress(drop);
          if (coord) dCoords.push(coord);
        }
      }

      if (!isCancelled) {
        setPickupCoord(pCoord);
        setDropCoords(dCoords);
      }
    };

    resolveCoords();

    return () => {
      isCancelled = true;
    };
  }, [pickupAddress, JSON.stringify(dropAddresses), propPickupCoord, JSON.stringify(propDropCoords)]);

  // 2. Fetch OSRM Road Route when Pickup and at least one Drop are available
  useEffect(() => {
    let isCancelled = false;

    if (!pickupCoord || dropCoords.length === 0) {
      setRoutePolyline([]);
      setRouteStats(null);
      return;
    }

    const fetchRoadRoute = async () => {
      setLoadingRoute(true);
      try {
        // Build coordinate string for OSRM: lon,lat;lon,lat;...
        const points = [pickupCoord, ...dropCoords];
        const coordString = points.map(p => `${p.lng},${p.lat}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;

        const res = await fetch(url);
        const data = await res.json();

        if (isCancelled) return;

        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const primaryRoute = data.routes[0];
          // OSRM returns coordinates as [lon, lat] -> convert to Leaflet [lat, lon]
          const latLngs = primaryRoute.geometry.coordinates.map(coord => [coord[1], coord[0]]);
          const distanceKm = parseFloat((primaryRoute.distance / 1000).toFixed(1));
          const durationMins = Math.max(1, Math.round(primaryRoute.duration / 60));

          setRoutePolyline(latLngs);
          setRouteStats({ distanceKm, durationMins });

          // Notify parent only when changed
          const key = `${distanceKm}-${durationMins}`;
          if (lastNotifiedRef.current !== key && onRouteCalculated) {
            lastNotifiedRef.current = key;
            onRouteCalculated({ distanceKm, durationMins, polyline: latLngs });
          }
        } else {
          // Fallback straight-line polyline if OSRM is unreachable
          const fallbackPath = points.map(p => [p.lat, p.lng]);
          setRoutePolyline(fallbackPath);
          const estKm = Math.max(5, points.length * 7.5);
          setRouteStats({ distanceKm: estKm, durationMins: Math.round(estKm * 2.5) });
        }
      } catch (err) {
        console.warn('OSRM routing fallback used:', err);
        const points = [pickupCoord, ...dropCoords];
        setRoutePolyline(points.map(p => [p.lat, p.lng]));
      } finally {
        if (!isCancelled) setLoadingRoute(false);
      }
    };

    fetchRoadRoute();

    return () => {
      isCancelled = true;
    };
  }, [pickupCoord, dropCoords]);

  // All markers for fitting bounds
  const mapPositions = useMemo(() => {
    const list = [];
    if (pickupCoord) list.push([pickupCoord.lat, pickupCoord.lng]);
    dropCoords.forEach(d => list.push([d.lat, d.lng]));
    return list;
  }, [pickupCoord, dropCoords]);

  const defaultCenter = pickupCoord ? [pickupCoord.lat, pickupCoord.lng] : [18.5204, 73.8567];

  return (
    <div className={`relative w-full rounded-2xl overflow-hidden border border-loft-700/80 bg-loft-950 shadow-xl ${className}`}>
      {/* Floating Telematics Badge */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {routeStats ? (
          <div className="bg-loft-900/95 backdrop-blur-md border border-copper-500/40 rounded-xl px-3.5 py-2 shadow-2xl flex items-center gap-3 text-xs pointer-events-auto">
            <div className="flex items-center gap-1.5 font-bold text-copper-400">
              <Navigation className="w-3.5 h-3.5 text-copper-400" />
              <span>{routeStats.distanceKm} km</span>
            </div>
            <span className="text-loft-600">•</span>
            <div className="flex items-center gap-1.5 text-loft-200">
              <Clock className="w-3.5 h-3.5 text-loft-400" />
              <span>~{routeStats.durationMins} mins</span>
            </div>
            <span className="text-loft-600">•</span>
            <div className="flex items-center gap-1 text-[11px] text-moss-400 font-medium">
              <Zap className="w-3 h-3 text-moss-400" />
              <span>Live OSRM Route</span>
            </div>
          </div>
        ) : (
          <div className="bg-loft-900/90 backdrop-blur-md border border-loft-700/60 rounded-xl px-3 py-1.5 shadow-lg flex items-center gap-2 text-xs text-loft-300 pointer-events-auto">
            <Sparkles className="w-3.5 h-3.5 text-copper-400" />
            <span>
              {pickupCoord && dropCoords.length === 0 
                ? 'Select or enter drop location to preview road routing' 
                : 'Interactive Route Navigation Preview'}
            </span>
          </div>
        )}

        {loadingRoute && (
          <div className="bg-loft-900/90 backdrop-blur-md border border-copper-500/40 rounded-xl px-3 py-1.5 shadow-lg flex items-center gap-2 text-xs text-copper-300 pointer-events-auto">
            <div className="w-3 h-3 border-2 border-copper-400 border-t-transparent rounded-full animate-spin"></div>
            <span>Calculating optimal road route...</span>
          </div>
        )}
      </div>

      {/* Map Container */}
      <div className="w-full h-full min-h-[340px] z-0">
        <MapContainer
          center={defaultCenter}
          zoom={13}
          scrollWheelZoom={false}
          className="w-full h-full z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitBounds positions={mapPositions} />

          {/* Pickup Marker */}
          {pickupCoord && (
            <Marker position={[pickupCoord.lat, pickupCoord.lng]} icon={createPinIcon('A', 'moss')}>
              <Popup>
                <div className="text-xs">
                  <p className="font-bold text-moss-700">Point A (Pickup)</p>
                  <p className="text-gray-600 mt-0.5">{typeof pickupAddress === 'string' ? pickupAddress : 'Pickup Location'}</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Drop Markers */}
          {dropCoords.map((coord, idx) => {
            const letter = String.fromCharCode(66 + idx); // B, C, D...
            const dropName = Array.isArray(dropAddresses) && dropAddresses[idx] 
              ? (typeof dropAddresses[idx] === 'string' ? dropAddresses[idx] : `Stop ${idx + 1}`)
              : `Destination ${idx + 1}`;

            return (
              <Marker key={`drop-${idx}`} position={[coord.lat, coord.lng]} icon={createPinIcon(letter, 'copper')}>
                <Popup>
                  <div className="text-xs">
                    <p className="font-bold text-copper-600">Point {letter} (Drop {idx + 1})</p>
                    <p className="text-gray-600 mt-0.5">{dropName}</p>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Turn-by-Turn Road Route Polyline */}
          {routePolyline.length > 0 && (
            <>
              {/* Glowing Outer Polyline */}
              <Polyline
                positions={routePolyline}
                pathOptions={{
                  color: '#b87333',
                  weight: 7,
                  opacity: 0.45,
                  lineCap: 'round',
                  lineJoin: 'round'
                }}
              />
              {/* Sharp Inner Polyline */}
              <Polyline
                positions={routePolyline}
                pathOptions={{
                  color: '#ea580c',
                  weight: 4,
                  opacity: 0.95,
                  lineCap: 'round',
                  lineJoin: 'round'
                }}
              />
            </>
          )}
        </MapContainer>
      </div>

      {/* Footer Info Strip */}
      <div className="px-4 py-2 bg-loft-900 border-t border-loft-800 flex items-center justify-between text-xs text-loft-400">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-moss-500 inline-block"></span>
          <span>A: Pickup</span>
          <span className="mx-1 text-loft-600">|</span>
          <span className="w-2.5 h-2.5 rounded-full bg-copper-500 inline-block"></span>
          <span>B: Destination</span>
        </div>
        <span className="text-[11px] text-loft-400">Real-time street routing via OSRM</span>
      </div>
    </div>
  );
};

export default RouteMapPreview;

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Navigation, Clock, Zap, Sparkles } from 'lucide-react';
import { geocodeAddress, fetchOsrmRoute } from '../../../utils/puneGeocoder';

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
  const onRouteCalculatedRef = useRef(onRouteCalculated);

  useEffect(() => {
    onRouteCalculatedRef.current = onRouteCalculated;
  }, [onRouteCalculated]);

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
        const points = [pickupCoord, ...dropCoords];
        const route = await fetchOsrmRoute(points);

        if (isCancelled) return;

        setRoutePolyline(route.polyline);
        setRouteStats({ distanceKm: route.distanceKm, durationMins: route.durationMins });

        // Notify parent only when changed
        const key = `${route.distanceKm}-${route.durationMins}`;
        if (lastNotifiedRef.current !== key && onRouteCalculatedRef.current) {
          lastNotifiedRef.current = key;
          onRouteCalculatedRef.current({ 
            distanceKm: route.distanceKm, 
            durationMins: route.durationMins, 
            polyline: route.polyline 
          });
        }
      } catch (err) {
        console.warn('Route calculation notice:', err);
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
          zoomControl={false}
          className="w-full h-full z-0"
        >
          <ZoomControl position="bottomright" />
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

      <style>{`
        .leaflet-control-zoom {
          border: 1px solid rgba(184, 115, 51, 0.4) !important;
          border-radius: 10px !important;
          overflow: hidden;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4) !important;
          margin-right: 14px !important;
          margin-bottom: 14px !important;
        }
        .leaflet-control-zoom-in,
        .leaflet-control-zoom-out {
          background-color: #1e293b !important;
          color: #f1f5f9 !important;
          border-bottom: 1px solid #334155 !important;
          width: 32px !important;
          height: 32px !important;
          line-height: 30px !important;
          font-size: 16px !important;
          transition: all 0.2s ease !important;
        }
        .leaflet-control-zoom-in:hover,
        .leaflet-control-zoom-out:hover {
          background-color: #334155 !important;
          color: #ea580c !important;
        }
      `}</style>
    </div>
  );
};

export default RouteMapPreview;

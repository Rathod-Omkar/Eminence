import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Navigation, Compass, Maximize2, ExternalLink } from 'lucide-react';
import { geocodeAddress, fetchOsrmRoute } from '../../utils/puneGeocoder';

// Fix for default Leaflet marker icons in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
});

// Custom 3D Tempo Truck Marker for Driver
const truckIcon = new L.Icon({
  iconUrl: '/images/map_marker_truck_1787941237726.jpg',
  iconSize: [46, 46],
  iconAnchor: [23, 23],
  popupAnchor: [0, -23],
  className: 'driver-truck-marker'
});

// Custom Destination Pin
const createDestinationIcon = () => {
  return L.divIcon({
    className: 'custom-dest-pin',
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer;">
        <div style="
          width: 32px; 
          height: 32px; 
          border-radius: 50%; 
          background: #e86331; 
          color: #ffffff; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          font-weight: 800; 
          font-size: 15px; 
          box-shadow: 0 4px 14px rgba(232, 99, 49, 0.5); 
          border: 2.5px solid #ffffff;
        ">
          🏁
        </div>
        <div style="width: 2px; height: 6px; background: #e86331;"></div>
        <div style="width: 6px; height: 6px; border-radius: 50%; background: #e86331; opacity: 0.8;"></div>
      </div>
    `,
    iconSize: [32, 44],
    iconAnchor: [16, 44],
    popupAnchor: [0, -44]
  });
};

// Map controller to fit driver and destination within view
const FitRouteBounds = ({ bounds, mode = 'fit' }) => {
  const map = useMap();

  useEffect(() => {
    if (!bounds || bounds.length === 0) return;
    try {
      if (mode === 'center-driver') {
        map.setView(bounds[0], 16, { animate: true });
      } else {
        const leafletBounds = L.latLngBounds(bounds);
        map.fitBounds(leafletBounds, {
          paddingTopLeft: [40, 110], // Leave room for the top navigation banner
          paddingBottomRight: [40, 40],
          maxZoom: 16,
          animate: true
        });
      }
    } catch (err) {
      console.warn('Map fit bounds warning:', err);
    }
  }, [bounds, mode, map]);

  return null;
};

const DriverNavigationMap = ({
  driverPos = { lat: 18.5204, lng: 73.8567 },
  activeRide,
  className = ''
}) => {
  const [destCoord, setDestCoord] = useState(null);
  const [routePolyline, setRoutePolyline] = useState([]);
  const [liveDistanceKm, setLiveDistanceKm] = useState(null);
  const [liveDurationMins, setLiveDurationMins] = useState(null);
  const [fitMode, setFitMode] = useState('fit'); // 'fit' or 'center-driver'
  const [isLoadingRoute, setIsLoadingRoute] = useState(true);

  const destinationAddress = activeRide?.dropoff || activeRide?.dropAddress || 'Destination';

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

    return () => {
      isCancelled = true;
    };
  }, [destinationAddress]);

  // 2. Fetch driving route from Driver Location -> Destination
  useEffect(() => {
    let isCancelled = false;

    if (!driverPos || !destCoord) {
      return;
    }

    const calculateDriverRoute = async () => {
      setIsLoadingRoute(true);
      try {
        const points = [driverPos, destCoord];
        const route = await fetchOsrmRoute(points);

        if (isCancelled) return;

        setRoutePolyline(route.polyline);
        setLiveDistanceKm(route.distanceKm);
        setLiveDurationMins(route.durationMins);
      } catch (err) {
        console.warn('Driver route calculation notice:', err);
      } finally {
        if (!isCancelled) setIsLoadingRoute(false);
      }
    };

    calculateDriverRoute();

    return () => {
      isCancelled = true;
    };
  }, [driverPos?.lat, driverPos?.lng, destCoord?.lat, destCoord?.lng]);

  // Compute map bounds containing both driver position and destination
  const mapPositions = useMemo(() => {
    const list = [];
    if (driverPos && typeof driverPos.lat === 'number' && typeof driverPos.lng === 'number') {
      list.push([driverPos.lat, driverPos.lng]);
    }
    if (destCoord && typeof destCoord.lat === 'number' && typeof destCoord.lng === 'number') {
      list.push([destCoord.lat, destCoord.lng]);
    }
    return list;
  }, [driverPos, destCoord]);

  // Google Maps external turn-by-turn navigation URL
  const googleMapsUrl = useMemo(() => {
    const origin = driverPos ? `${driverPos.lat},${driverPos.lng}` : '';
    const dest = destCoord ? `${destCoord.lat},${destCoord.lng}` : encodeURIComponent(destinationAddress);
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`;
  }, [driverPos, destCoord, destinationAddress]);

  return (
    <div className={`flex-1 card overflow-hidden relative min-h-[460px] md:min-h-[500px] border-copper-500/30 flex flex-col ${className}`}>
      {/* Top Floating Active Route Navigation Banner */}
      <div className="absolute top-3 left-3 right-3 bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 text-white rounded-xl p-4 shadow-2xl z-[1000] border border-emerald-400/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 shadow-inner">
            <Navigation className="w-6 h-6 text-white rotate-45" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-lg leading-tight truncate">Active Route Navigation</h4>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/40 text-emerald-200 border border-emerald-300/30 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
                Driver Live
              </span>
            </div>
            <p className="text-white/90 text-xs truncate max-w-xl mt-0.5">
              En route to <strong className="text-white font-semibold">{destinationAddress}</strong>
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <h4 className="font-bold text-xl tracking-tight text-white">
            {liveDistanceKm ? `${liveDistanceKm.toFixed(1)} km` : activeRide?.distance || 'Live Route'}
          </h4>
          <p className="text-emerald-100 text-xs font-medium">
            {liveDurationMins ? `ETA ~${liveDurationMins} mins` : activeRide?.duration || 'Dispatched by Fleet'}
          </p>
        </div>
      </div>

      {/* Interactive Leaflet Map */}
      <div className="relative w-full h-full min-h-[420px] flex-1 z-0">
        <MapContainer
          center={[driverPos.lat, driverPos.lng]}
          zoom={14}
          scrollWheelZoom={true}
          zoomControl={false}
          className="w-full h-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            className="map-tiles"
          />

          <FitRouteBounds bounds={mapPositions} mode={fitMode} />

          {/* Driver Live Marker */}
          {driverPos && (
            <Marker position={[driverPos.lat, driverPos.lng]} icon={truckIcon}>
              <Popup>
                <div className="p-1">
                  <span className="font-bold text-xs text-copper-600 block">Driver Location (You)</span>
                  <span className="text-[11px] text-loft-600 block mt-0.5">
                    Live GPS: {driverPos.lat.toFixed(4)}, {driverPos.lng.toFixed(4)}
                  </span>
                  <span className="text-[10px] text-moss-600 font-semibold block mt-1">● In Transit to Drop-off</span>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Destination Marker */}
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

          {/* Turn-by-Turn Road Route Polyline */}
          {routePolyline.length > 0 && (
            <Polyline
              positions={routePolyline}
              pathOptions={{
                color: '#e86331',
                weight: 6,
                opacity: 0.9,
                lineCap: 'round',
                lineJoin: 'round'
              }}
            />
          )}
        </MapContainer>

        {/* Loading Overlay */}
        {isLoadingRoute && (
          <div className="absolute top-24 left-4 z-[999] bg-loft-950/80 backdrop-blur-sm border border-loft-800 text-loft-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 shadow-lg">
            <div className="w-3 h-3 border-2 border-copper-500 border-t-transparent rounded-full animate-spin"></div>
            <span>Routing driver to destination...</span>
          </div>
        )}

        {/* Bottom Floating Map Controls */}
        <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setFitMode('center-driver')}
            title="Center on Driver Location"
            className="p-2.5 bg-loft-900/90 hover:bg-loft-800 text-loft-100 hover:text-copper-400 border border-loft-700/80 rounded-xl shadow-xl backdrop-blur-md transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
          >
            <Compass className="w-4 h-4 text-copper-400" />
            <span className="hidden sm:inline">My Location</span>
          </button>
          
          <button
            type="button"
            onClick={() => setFitMode('fit')}
            title="Fit Entire Route"
            className="p-2.5 bg-loft-900/90 hover:bg-loft-800 text-loft-100 hover:text-copper-400 border border-loft-700/80 rounded-xl shadow-xl backdrop-blur-md transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
          >
            <Maximize2 className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Fit Route</span>
          </button>

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in Google Maps Navigation"
            className="p-2.5 bg-copper-500 hover:bg-copper-400 text-loft-950 rounded-xl shadow-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline">Google Maps</span>
          </a>
        </div>

        {/* Bottom Left Legend */}
        <div className="absolute bottom-4 left-4 z-[1000] bg-loft-950/80 backdrop-blur-md border border-loft-800 text-loft-300 px-3 py-2 rounded-xl text-[11px] flex items-center gap-3 shadow-lg">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-copper-500"></span>
            <span>Driver Position</span>
          </div>
          <span className="text-loft-600">•</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>Destination</span>
          </div>
        </div>
      </div>

      <style>{`
        .driver-truck-marker {
          border-radius: 50%;
          border: 2.5px solid #e86331;
          box-shadow: 0 0 16px rgba(232, 99, 49, 0.7);
          background: #11141c;
          object-fit: cover;
        }
        .map-tiles {
          filter: brightness(0.78) invert(1) contrast(3) hue-rotate(200deg) saturate(0.35);
        }
      `}</style>
    </div>
  );
};

export default DriverNavigationMap;

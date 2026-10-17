import { useState, useEffect } from 'react';
import { 
  AlertTriangle, Phone, MapPin, X, Loader2, ShieldAlert, CheckCircle2, Truck
} from 'lucide-react';
import { io } from 'socket.io-client';
import api from '../../services/api';

const API_BASE_URL = api.defaults.baseURL;

const DriverSosModal = ({ isOpen, onClose, activeRide, user, token }) => {
  const [reason, setReason] = useState('Road Accident / Crash');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState({ lat: 18.5204, lng: 73.8567, address: 'Pune, Maharashtra' });
  const [locating, setLocating] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dispatched, setDispatched] = useState(false);
  const [ticketData, setTicketData] = useState(null);

  // Auto geolocate driver
  useEffect(() => {
    if (!isOpen) {
      setDispatched(false);
      return;
    }

    setLocating(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            address: `Live GPS: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`
          });
          setLocating(false);
        },
        (err) => {
          console.warn('Geolocation failed for SOS, using fallback:', err.message);
          // If activeRide has coordinates, use activeRide pickup/drop
          setLocating(false);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setLocating(false);
    }
  }, [isOpen]);

  const handleSubmitSos = async (e) => {
    e?.preventDefault();
    try {
      setSubmitting(true);

      const payload = {
        bookingId: activeRide?.id || null,
        reason,
        description: description.trim() || `Driver triggered emergency SOS (${reason})`,
        location: {
          lat: location.lat,
          lng: location.lng,
          address: location.address
        },
        vehicleInfo: activeRide?.vehicleType ? `${activeRide.vehicleType} (${activeRide.vehiclePlate || 'MH-12'})` : (user?.vehicle || 'Pune Fleet Tempo')
      };

      // 1. Post to Backend REST API
      const res = await api.post('/api/support/sos', payload);

      // 2. Also emit via direct socket to Admin Inbox
      try {
        const socket = io(API_BASE_URL, { auth: { token } });
        socket.emit('driver_sos', {
          ...payload,
          ticketNumber: res.data?.ticket?.ticketNumber || 'SOS-911',
          driverName: user?.name || 'Driver',
          driverPhone: user?.phone
        });
        setTimeout(() => socket.disconnect(), 1000);
      } catch (sockErr) {
        console.warn('Socket SOS emit error:', sockErr.message);
      }

      setTicketData(res.data?.ticket);
      setDispatched(true);
    } catch (err) {
      console.error('Failed to transmit SOS:', err);
      alert(err.response?.data?.message || 'Failed to transmit SOS. Please call emergency dispatch immediately at 1800-266-9999.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-loft-950 border-2 border-red-500/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-[0_0_50px_rgba(239,68,68,0.4)] animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-red-950/70 border-b border-red-500/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-600 rounded-xl text-white animate-pulse">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-600 text-white font-black tracking-wider uppercase">
                  HIGH PRIORITY
                </span>
                <span className="text-xs text-red-300 font-mono">EMERGENCY PROTOCOL</span>
              </div>
              <h3 className="text-lg font-bold text-white font-serif mt-0.5">
                Driver SOS Emergency Dispatch
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-red-900/50 text-red-300 hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {dispatched ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center mx-auto text-red-400 animate-bounce">
              <CheckCircle2 className="w-10 h-10 text-red-400" />
            </div>

            <div>
              <span className="text-xs px-3 py-1 rounded-full bg-red-500/20 text-red-400 font-mono font-bold border border-red-500/40">
                #{ticketData?.ticketNumber || 'SOS-ACTIVE'}
              </span>
              <h4 className="text-xl font-bold text-white mt-2">SOS ALERT TRANSMITTED</h4>
              <p className="text-xs text-loft-300 max-w-sm mx-auto mt-1 leading-relaxed">
                Eminence Pune Dispatch command center and emergency controllers have received your live location and distress transmission.
              </p>
            </div>

            {/* Emergency Hotline Buttons */}
            <div className="p-4 rounded-xl bg-loft-900 border border-loft-800 space-y-2 text-left">
              <p className="text-[11px] font-bold text-loft-400 uppercase tracking-wider">Immediate Emergency Contacts</p>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <a
                  href="tel:112"
                  className="p-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold flex items-center justify-center gap-2 transition-all shadow-md"
                >
                  <Phone className="w-4 h-4" />
                  <span>Call 112 (Police)</span>
                </a>

                <a
                  href="tel:108"
                  className="p-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-white font-bold flex items-center justify-center gap-2 transition-all shadow-md"
                >
                  <Phone className="w-4 h-4" />
                  <span>Call 108 (Ambulance)</span>
                </a>
              </div>

              <a
                href="tel:18002669999"
                className="w-full p-2.5 rounded-xl bg-loft-800 hover:bg-copper-500/20 border border-loft-700 hover:border-copper-500 text-copper-400 font-bold flex items-center justify-center gap-2 transition-all block text-center"
              >
                <Phone className="w-4 h-4" />
                <span>Call Eminence Control Desk (1800-266-9999)</span>
              </a>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 bg-loft-800 hover:bg-loft-750 text-loft-200 font-bold text-xs rounded-xl cursor-pointer"
            >
              Close Window (Alert Stays Active with Dispatch)
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmitSos} className="p-5 space-y-4 text-xs">
            {/* Active Ride Info if available */}
            {activeRide && (
              <div className="p-3 bg-loft-900 border border-loft-800 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Truck className="w-4 h-4 text-copper-400" />
                  <div>
                    <p className="font-bold text-loft-100">Active Trip #{activeRide.id?.slice(0, 8)}</p>
                    <p className="text-[10px] text-loft-400">
                      {activeRide.pickup} &rarr; {activeRide.dropoff}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-copper-500/20 text-copper-400 font-bold uppercase">
                  {activeRide.status || 'In Transit'}
                </span>
              </div>
            )}

            {/* GPS Telemetry */}
            <div className="p-3 bg-loft-900/80 border border-loft-800 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-red-400" />
                <div>
                  <p className="font-bold text-loft-200">Driver Telemetry GPS</p>
                  <p className="text-[10px] text-loft-400">
                    {locating ? 'Acquiring GPS fix...' : `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`}
                  </p>
                </div>
              </div>
              {locating && <Loader2 className="w-3.5 h-3.5 animate-spin text-copper-400" />}
            </div>

            {/* Emergency Reason */}
            <div>
              <label className="block text-loft-200 font-bold mb-1.5">
                Select Emergency Situation *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Road Accident / Crash', icon: AlertTriangle },
                  { label: 'Vehicle Breakdown / Tyre', icon: Truck },
                  { label: 'Medical Emergency', icon: Phone },
                  { label: 'Security Threat / Assault', icon: ShieldAlert },
                  { label: 'Cargo Shifting / Spillage', icon: AlertTriangle },
                  { label: 'Other Critical Emergency', icon: ShieldAlert },
                ].map((item) => (
                  <button
                    type="button"
                    key={item.label}
                    onClick={() => setReason(item.label)}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                      reason === item.label
                        ? 'bg-red-600 text-white border-red-500 font-bold shadow-md'
                        : 'bg-loft-900 text-loft-300 border-loft-800 hover:border-loft-700'
                    }`}
                  >
                    <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-loft-200 font-bold mb-1">
                Additional Notes / Immediate Assistance Required
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Near Akurdi flyover, radiator leaking, unable to move vehicle..."
                className="w-full bg-loft-900 border border-loft-800 rounded-xl p-2.5 text-loft-100 placeholder-loft-500 focus:outline-none focus:border-red-500 resize-none text-xs"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-red-600 via-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(239,68,68,0.5)] cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>TRANSMITTING SOS TO DISPATCH...</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 animate-pulse" />
                    <span>TRANSMIT EMERGENCY SOS TO DISPATCH</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 bg-loft-900 hover:bg-loft-850 text-loft-400 hover:text-loft-200 font-semibold text-xs rounded-xl border border-loft-800 cursor-pointer"
              >
                Cancel / False Alarm
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default DriverSosModal;

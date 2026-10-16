import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import api from '../../services/api';
import { updateProfileSuccess } from '../../redux/slices/authSlice';
import { MapPin, Phone, Building2, Map, CheckCircle2, User, Mail, LocateFixed, Loader2, Lock, Eye, EyeOff, Gift } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TermsModal from '../Common/TermsModal';


const CompleteProfileModal = () => {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    password: '',
    address: user?.address || '',
    city: user?.city || '',
    state: user?.state || '',
    referralCode: ''
  });

  const isEmailLocked = Boolean(user?.googleId || user?.isEmailVerified || (user?.email && user.email.includes('@gmail.com')));
  const isPhoneLocked = Boolean(user?.isPhoneVerified);

  const [termsAccepted, setTermsAccepted] = useState(Boolean(user?.termsAccepted));
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otpType, setOtpType] = useState(null); // 'phone'
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const dismissKey = user?.id ? `profile_modal_dismissed_${user.id}` : 'profile_modal_dismissed';
  const [isClosed, setIsClosed] = useState(() => {
    try {
      return sessionStorage.getItem(dismissKey) === 'true';
    } catch (_e) {
      return false;
    }
  });

  const handleDismiss = () => {
    setIsClosed(true);
    try {
      sessionStorage.setItem(dismissKey, 'true');
    } catch (_e) {}
  };
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [detectingLocation, setDetectingLocation] = useState(false);

  useEffect(() => {
    if (otpCooldown > 0) {
      const timer = setTimeout(() => setOtpCooldown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCooldown]);

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.name || prev.name,
        email: user.email || prev.email,
        phone: user.phone || prev.phone,
        address: user.address || prev.address,
        city: user.city || prev.city,
        state: user.state || prev.state
      }));
      if (user.termsAccepted) {
        setTermsAccepted(true);
      }
    }
  }, [user]);

  // If user is not logged in or already complete, or modal is dismissed, don't render
  if (!user || user.isProfileComplete || isClosed) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      // Disallow letters/symbols: only allow digits, spaces, plus sign and hyphens
      const filtered = value.replace(/[^\d+ -]/g, '');
      setFormData({ ...formData, phone: filtered });
      return;
    }
    if (name === 'referralCode') {
      setFormData({ ...formData, referralCode: value.toUpperCase() });
      return;
    }
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      if (formData.phone) {
        const rawPhone = String(formData.phone).trim();
        if (rawPhone.includes('@')) {
          setError('Phone number cannot be an email address.');
          setLoading(false);
          return;
        }
        const cleanPhone = rawPhone.replace(/^(\+91|91)/, '').replace(/\D/g, '');
        if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
          setError('Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).');
          setLoading(false);
          return;
        }
      }

      if (termsAccepted && !user?.termsAccepted) {
        try {
          await api.post('/api/auth/accept-terms', { version: 'v1.0' });
        } catch (e) {
          console.warn('Accept terms in profile completion note:', e.message);
        }
      }

      const cleanPhone = formData.phone ? formData.phone.trim().replace(/^(\+91|91)/, '').replace(/\D/g, '') : formData.phone;
      const payload = { 
        ...formData, 
        phone: cleanPhone,
        referralCode: formData.referralCode?.trim() || undefined
      };

      const res = await api.post('/api/auth/complete-profile', payload);
      
      const updatedUser = res.data.user;
      dispatch(updateProfileSuccess(updatedUser));
      
      // If phone wasn't verified, ask for OTP now
      if (!updatedUser.isPhoneVerified && formData.phone) {
        await handleSendOtp('phone', true); // true = called internally, don't manage own loading
      } else if (!updatedUser.isEmailVerified && formData.email) {
        await handleSendOtp('email', true);
      } else if (updatedUser.isProfileComplete) {
        setMessage('Profile completed successfully!');
      } else {
        // Profile saved but nothing to verify — shouldn't happen but surface it
        setMessage('Profile saved. Please verify your phone or email to continue.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error completing profile. Please try again.';
      console.error('Complete profile error:', err.response?.data || err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // internal=true means the caller manages loading state
  const handleSendOtp = async (type, internal = false) => {
    if (otpCooldown > 0 && !internal) return;
    if (!internal) setLoading(true);
    setError('');
    try {
      await api.post('/api/auth/send-otp', { type });
      setOtpType(type);
      setOtpCooldown(60);
      setMessage(`OTP sent to your ${type}. Check your backend console for the code.`);
    } catch (err) {
      const msg = err.response?.data?.message || `Error sending ${type} OTP`;
      if (internal) throw err; // bubble up to handleSubmit's catch
      setError(msg);
    } finally {
      if (!internal) setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpType) {
      setError('Select an OTP verification method.');
      return;
    }

    const code = otpCode.trim();

    if (!/^\d{6}$/.test(code)) {
      setError('Enter a valid 6-digit OTP.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await api.post('/api/auth/verify-otp', { type: otpType, code });
      dispatch(updateProfileSuccess(res.data.user));
      setOtpType(null);
      setOtpCode('');
      setMessage(`${otpType} verified successfully!`);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setDetectingLocation(true);
    setError('');
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          // Use OpenStreetMap Nominatim for free reverse geocoding
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          
          if (data && data.address) {
            setFormData(prev => ({
              ...prev,
              city: data.address.city || data.address.town || data.address.village || data.address.county || '',
              state: data.address.state || '',
              address: data.display_name || ''
            }));
            setMessage('Location detected successfully!');
          }
        } catch (err) {
          setError('Failed to fetch location details.');
        } finally {
          setDetectingLocation(false);
        }
      },
      (err) => {
        setError('Failed to detect location. Please ensure location permissions are granted.');
        setDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col relative"
        >
          <button 
            onClick={handleDismiss}
            className="absolute top-4 right-4 z-10 p-2 text-white/70 hover:text-white bg-black/20 hover:bg-black/40 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="bg-primary p-6 text-white text-center flex-shrink-0 pt-10 relative">
            <h2 className="text-3xl font-serif font-bold mb-2">Complete Your Profile</h2>
            <p className="text-primary-foreground/90">
              We need a few more details to set up your account completely.
            </p>
          </div>

          <div className="p-6 md:p-8 overflow-y-auto flex-grow custom-scrollbar">
            {error && <div className="mb-6 p-4 bg-red-50 text-red-700 border-l-4 border-red-500 rounded-r-md font-medium">{error}</div>}
            {message && <div className="mb-6 p-4 bg-green-50 text-green-700 border-l-4 border-green-500 rounded-r-md font-medium">{message}</div>}

            {!otpType ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Name */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" />
                      Full Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="John Doe"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-primary" />
                        Email Address
                      </span>
                      {isEmailLocked && (
                        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                          Verified (Locked)
                        </span>
                      )}
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      readOnly={isEmailLocked}
                      disabled={isEmailLocked}
                      placeholder="john@example.com"
                      className={`w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 transition-all outline-none ${
                        isEmailLocked 
                          ? 'bg-gray-100/90 text-gray-500 cursor-not-allowed border-gray-300 select-none' 
                          : 'bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Phone */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-primary" />
                        Phone Number
                      </span>
                      {isPhoneLocked && (
                        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                          Verified (Locked)
                        </span>
                      )}
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      required
                      value={formData.phone}
                      onChange={handleChange}
                      readOnly={isPhoneLocked}
                      disabled={isPhoneLocked}
                      placeholder="e.g. 9876543210"
                      pattern="^[0-9+ -]{10,15}$"
                      title="Enter a valid 10-digit mobile number"
                      maxLength="15"
                      className={`w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 transition-all outline-none ${
                        isPhoneLocked 
                          ? 'bg-gray-100/90 text-gray-500 cursor-not-allowed border-gray-300 select-none' 
                          : 'bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary'
                      }`}
                    />
                  </div>

                  {/* Account Password Field */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-primary" />
                        Account Password
                      </span>
                      <span className="text-xs text-gray-500 font-normal">
                        Direct login password
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Create a password (min 6 chars)"
                        className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 text-gray-900 bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Address Section Header with Detect Button */}
                <div className="flex items-center justify-between mt-2 mb-1">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Location Details</h3>
                  <button
                    type="button"
                    onClick={handleDetectLocation}
                    disabled={detectingLocation}
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-orange-600 transition-colors bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-full"
                  >
                    {detectingLocation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
                    {detectingLocation ? 'Detecting...' : 'Detect Current Location'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* City */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-primary" />
                      City
                    </label>
                    <input
                      type="text"
                      name="city"
                      required
                      value={formData.city}
                      onChange={handleChange}
                      placeholder="e.g. New York"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                    />
                  </div>

                  {/* State */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <Map className="w-4 h-4 text-primary" />
                      State
                    </label>
                    <input
                      type="text"
                      name="state"
                      required
                      value={formData.state}
                      onChange={handleChange}
                      placeholder="e.g. NY"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    Full Address
                  </label>
                  <textarea
                    name="address"
                    required
                    rows="3"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Enter your complete street address"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none"
                  ></textarea>
                </div>

                {/* Referral Code (Optional) */}
                {!user?.referredBy ? (
                  <div className="space-y-2 p-4 bg-orange-50/50 rounded-xl border border-orange-200">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                        <Gift className="w-4 h-4 text-primary" />
                        Referral Code (Optional)
                      </label>
                      <span className="text-xs font-semibold text-orange-600 bg-orange-100/90 px-2.5 py-0.5 rounded-full border border-orange-200">
                        🎁 Get ₹100 Welcome Bonus
                      </span>
                    </div>
                    <input
                      type="text"
                      name="referralCode"
                      value={formData.referralCode}
                      onChange={handleChange}
                      placeholder="e.g. EMINENCE-AB12CD"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none uppercase font-mono tracking-wider placeholder:normal-case placeholder:font-sans"
                    />
                    <p className="text-xs text-gray-500">
                      Have a friend's referral code? Apply it here to get ₹100 credited directly to your wallet.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-3.5 py-2.5 rounded-xl border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>Referral bonus applied with code: <strong>{user.referredBy}</strong></span>
                  </div>
                )}


                {/* Terms Acceptance if not already accepted */}
                {!user?.termsAccepted && (
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <input
                      id="profile-terms"
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    />
                    <label htmlFor="profile-terms" className="text-xs text-gray-600 leading-relaxed cursor-pointer select-none">
                      I accept the{' '}
                      <button
                        type="button"
                        onClick={() => setShowTermsModal(true)}
                        className="text-primary font-semibold underline underline-offset-2 hover:opacity-80"
                      >
                        Terms & Conditions
                      </button>{' '}
                      and consent to digital freight documentation & tracking.
                    </label>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || (!user?.termsAccepted && !termsAccepted)}
                  className="w-full btn-primary py-4 text-lg mt-4 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Saving...' : 'Save & Continue'}
                </button>
              </form>
            ) : (
              <div className="space-y-6 text-center py-8">
                <div className="w-16 h-16 bg-blue-50 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <Phone className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-gray-800">Verify Your Phone</h3>
                <p className="text-gray-500">We've sent a verification code to <br/><span className="font-semibold text-gray-800">{formData.phone}</span></p>
                
                <div className="max-w-xs mx-auto space-y-4 pt-4">
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="Enter 6-digit OTP"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 bg-white text-center text-xl tracking-widest focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                    maxLength="6"
                  />
                  
                  <button
                    onClick={handleVerifyOtp}
                    disabled={loading || otpCode.length < 6}
                    className="w-full btn-primary py-3 shadow-md flex justify-center items-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Verify & Complete
                  </button>
                  
                  <button
                    onClick={() => setOtpType(null)}
                    disabled={loading}
                    className="w-full px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
                  >
                    Go Back
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        <TermsModal
          isOpen={showTermsModal}
          onClose={() => setShowTermsModal(false)}
          onAccept={() => setTermsAccepted(true)}
        />
      </AnimatePresence>
    </div>
  );
};

export default CompleteProfileModal;

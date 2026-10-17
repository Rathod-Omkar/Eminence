import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Search, Loader2, AlertCircle, ShieldCheck, Home } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { matchPuneKnownLocation, extractSearchCandidates, getPunePincode } from '../../../utils/puneGeocoder';

const AutocompleteLocationInput = ({ 
  value, 
  onChange, 
  onSelectDetails,
  placeholder, 
  required = false, 
  iconColor = "text-moss-500",
  cityLimit = "pune" // Default to Pune & PCMC metropolitan region
}) => {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const wrapperRef = useRef(null);

  // Sync external value changes (e.g. from voice agent or preset addresses)
  useEffect(() => {
    if (value !== query) {
      setQuery(value || '');
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchLocations = async () => {
      if (!query || query.trim().length < 3) {
        setSuggestions([]);
        setHasSearched(false);
        return;
      }
      
      // Don't search if the query is exactly what we just selected
      if (suggestions.some(s => s.display_name === query)) return;

      setLoading(true);
      setHasSearched(true);
      try {
        let searchParam = query.trim();
        let viewboxParam = '';
        
        // Strictly restrict to Pune & PCMC Metropolitan Area (PMRDA bounds: 73.60, 18.85, 74.20, 18.30)
        if (cityLimit && cityLimit.toLowerCase() === 'pune') {
          if (!searchParam.toLowerCase().includes('pune') && !searchParam.toLowerCase().includes('pcmc')) {
            searchParam = `${searchParam}, Pune`;
          }
          viewboxParam = '&viewbox=73.60,18.85,74.20,18.30&bounded=1';
        }

        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(searchParam)}&countrycodes=in&limit=6${viewboxParam}`;
        const response = await fetch(url, {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'Eminence-Transport-MVP/1.0'
          }
        });
        const data = await response.json();
        
        // Filter strictly to Pune metropolitan coordinate box (Lat: 18.25-18.90, Lon: 73.55-74.25)
        let filtered = Array.isArray(data) ? data.filter(item => {
          const lat = parseFloat(item.lat);
          const lon = parseFloat(item.lon);
          return lat >= 18.25 && lat <= 18.90 && lon >= 73.55 && lon <= 74.25;
        }) : [];

        // If literal search yielded 0 results (e.g., custom residential home address with flat/bldg numbers),
        // intelligently extract candidates & matched Pune roads/landmarks
        if (filtered.length === 0) {
          const directMatch = matchPuneKnownLocation(query);
          const candidates = extractSearchCandidates(query);
          let matchedRef = directMatch;

          if (!matchedRef) {
            for (const cand of candidates) {
              const cm = matchPuneKnownLocation(cand);
              if (cm) {
                matchedRef = cm;
                break;
              }
            }
          }

          if (matchedRef) {
            filtered = [
              {
                place_id: `home_matched_${Date.now()}`,
                display_name: query,
                custom_address: query,
                matched_label: matchedRef.name,
                lat: matchedRef.lat,
                lon: matchedRef.lng,
                is_custom_home: true
              },
              {
                place_id: `road_${Date.now()}`,
                display_name: `${matchedRef.name}, Pune`,
                lat: matchedRef.lat,
                lon: matchedRef.lng,
                is_road_reference: true
              }
            ];

            // Proactively bind coordinates and postal code to parent state so map immediately routes to the location
            if (onSelectDetails) {
              const postalCode = getPunePincode(query, matchedRef);
              onSelectDetails({
                lat: matchedRef.lat,
                lng: matchedRef.lng,
                display_name: query,
                postalCode: postalCode || undefined,
                is_estimated: true
              });
            }
          }
        }

        setSuggestions(filtered);
        setIsOpen(true);
      } catch (error) {
        console.error('Error fetching locations:', error);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      fetchLocations();
    }, 400);

    return () => clearTimeout(timer);
  }, [query, cityLimit]);

  const handleSelect = (location) => {
    const textToKeep = location.custom_address || location.display_name;
    setQuery(textToKeep);
    setSuggestions([]);
    setIsOpen(false);
    onChange(textToKeep);
    if (onSelectDetails) {
      const postalCode = getPunePincode(textToKeep, location);
      onSelectDetails({
        lat: parseFloat(location.lat),
        lng: parseFloat(location.lon),
        display_name: textToKeep,
        postalCode: postalCode || undefined,
        address: location.address || {},
        raw: location
      });
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val); // Always keep parent in sync with raw typed value
    if (val.length > 2) setIsOpen(true);

    // Auto-resolve coordinates & postalCode for raw home address in background if it contains a known Pune landmark, road or pincode
    const quickMatch = matchPuneKnownLocation(val);
    const postalCode = getPunePincode(val, quickMatch);
    if (onSelectDetails && (quickMatch || postalCode)) {
      onSelectDetails({
        lat: quickMatch?.lat,
        lng: quickMatch?.lng,
        display_name: val,
        postalCode: postalCode || undefined,
        is_estimated: true
      });
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <MapPin className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${iconColor}`} />
      <input 
        required={required} 
        value={query} 
        onChange={handleInputChange} 
        onFocus={() => { if (query.trim().length >= 3) setIsOpen(true); }}
        type="text" 
        className="input-field pl-12 pr-10" 
        placeholder={placeholder} 
        autoComplete="off"
      />
      {loading && (
        <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-loft-400 animate-spin" />
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute top-full left-0 right-0 mt-2 bg-loft-900 border border-loft-700 rounded-xl shadow-2xl overflow-hidden z-50 max-h-80 overflow-y-auto"
          >
            {/* Scope Header */}
            <div className="px-3.5 py-1.5 bg-loft-950/80 border-b border-loft-800 flex items-center justify-between text-[11px] text-loft-400">
              <span className="flex items-center gap-1.5 font-medium text-copper-400">
                <ShieldCheck className="w-3.5 h-3.5" /> Service Area: Pune &amp; PCMC Only
              </span>
              <span className="text-[10px] text-loft-500">Intracity Fleet</span>
            </div>

            {suggestions.length > 0 ? (
              suggestions.map((loc, idx) => {
                if (loc.is_custom_home) {
                  return (
                    <button
                      key={loc.place_id || idx}
                      type="button"
                      onClick={() => handleSelect(loc)}
                      className="w-full text-left px-4 py-3 bg-copper-500/10 hover:bg-copper-500/20 transition-colors flex items-start gap-3 border-b border-loft-800 cursor-pointer"
                    >
                      <Home className="w-4 h-4 text-copper-400 mt-1 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="text-xs font-bold text-copper-400 flex items-center gap-1.5 mb-0.5">
                          <span>Map Specific Home Address</span>
                          <span className="text-[10px] bg-copper-500/20 text-copper-300 px-1.5 py-0.2 rounded font-mono">
                            Near {loc.matched_label}
                          </span>
                        </div>
                        <div className="text-sm font-medium text-loft-50 line-clamp-1">{loc.display_name}</div>
                        <div className="text-[11px] text-loft-400">Preserves full address &amp; maps pickup/drop to {loc.matched_label}</div>
                      </div>
                    </button>
                  );
                }

                return (
                  <button
                    key={loc.place_id || idx}
                    type="button"
                    onClick={() => handleSelect(loc)}
                    className="w-full text-left px-4 py-3 hover:bg-loft-800 transition-colors flex items-start gap-3 border-b border-loft-800 last:border-b-0 cursor-pointer"
                  >
                    <Search className="w-4 h-4 text-loft-400 mt-1 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-loft-50 line-clamp-1">{loc.display_name.split(',')[0]}</div>
                      <div className="text-xs text-loft-400 line-clamp-1">{loc.display_name.split(',').slice(1).join(',')}</div>
                    </div>
                  </button>
                );
              })
            ) : hasSearched && !loading ? (
              <div className="p-4 text-xs text-loft-300">
                <div className="flex items-center gap-2 text-copper-400 font-semibold mb-1">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>No matching locations in Pune / PCMC</span>
                </div>
                <p className="text-[11px] text-loft-400 leading-relaxed">
                  Eminence operates intracity tempo logistics within Pune, PCMC, and PMRDA boundaries. Please select or search an area within the Pune metropolitan area.
                </p>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AutocompleteLocationInput;

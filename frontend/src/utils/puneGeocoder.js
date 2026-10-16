/**
 * Pune & PCMC Metropolitan Area (PMRDA) Intelligent Geocoder & Address Parser
 * Enables high-accuracy mapping for private residential addresses, home units,
 * colloquial directions ("behind the back", "near"), and specific Pune landmarks.
 */

export const KNOWN_PUNE_LOCATIONS = {
  // Landmarks, Showrooms & Institutions
  'sai maruti': { lat: 18.5195, lng: 73.8448, name: 'Sai Service Maruti Showroom, JM Road' },
  'sai service': { lat: 18.5195, lng: 73.8448, name: 'Sai Service Maruti Showroom, JM Road' },
  'sp kaanara': { lat: 18.5190, lng: 73.8445, name: 'SP Kaanara, JM Road' },
  'brihan maharashtra': { lat: 18.5209, lng: 73.8354, name: 'BMCC College, Deccan' },
  'bmcc': { lat: 18.5209, lng: 73.8354, name: 'BMCC College, Deccan' },
  'coep': { lat: 18.5290, lng: 73.8560, name: 'COEP Tech University, Shivajinagar' },
  'pune station': { lat: 18.5284, lng: 73.8744, name: 'Pune Railway Station' },
  'pune railway': { lat: 18.5284, lng: 73.8744, name: 'Pune Railway Station' },
  'shivajinagar station': { lat: 18.5314, lng: 73.8446, name: 'Shivajinagar Station' },
  'shaniwar wada': { lat: 18.5195, lng: 73.8553, name: 'Shaniwar Wada' },
  'dagdusheth': { lat: 18.5165, lng: 73.8560, name: 'Dagdusheth Ganpati' },
  'swargate bus': { lat: 18.5018, lng: 73.8586, name: 'Swargate Bus Station' },
  'pune airport': { lat: 18.5822, lng: 73.9197, name: 'Pune International Airport, Lohegaon' },
  'bjs school': { lat: 18.5815, lng: 73.9860, name: 'BJS School, Bakori Road, Wagholi' },
  'bjs college': { lat: 18.5815, lng: 73.9860, name: 'BJS College, Wagholi' },
  'bjs': { lat: 18.5815, lng: 73.9860, name: 'BJS School, Wagholi' },
  'bakori road': { lat: 18.5830, lng: 73.9880, name: 'Bakori Road, Wagholi' },
  'bakori': { lat: 18.5830, lng: 73.9880, name: 'Bakori Road, Wagholi' },

  // Roads & Corridors
  'jm road': { lat: 18.5191, lng: 73.8451, name: 'JM Road (Jangali Maharaj Road)' },
  'jangali maharaj': { lat: 18.5191, lng: 73.8451, name: 'JM Road (Jangali Maharaj Road)' },
  'fc road': { lat: 18.5246, lng: 73.8419, name: 'FC Road (Fergusson College Road)' },
  'fergusson': { lat: 18.5246, lng: 73.8419, name: 'FC Road (Fergusson College Road)' },
  'sb road': { lat: 18.5323, lng: 73.8315, name: 'Senapati Bapat Road' },
  'senapati bapat': { lat: 18.5323, lng: 73.8315, name: 'Senapati Bapat Road' },
  'karve road': { lat: 18.5020, lng: 73.8240, name: 'Karve Road' },
  'paud road': { lat: 18.5070, lng: 73.8050, name: 'Paud Road, Kothrud' },
  'law college': { lat: 18.5160, lng: 73.8310, name: 'Law College Road' },
  'bhandarkar': { lat: 18.5180, lng: 73.8330, name: 'Bhandarkar Road' },
  'prabhat road': { lat: 18.5130, lng: 73.8350, name: 'Prabhat Road' },
  'tilak road': { lat: 18.5040, lng: 73.8510, name: 'Tilak Road' },
  'laxmi road': { lat: 18.5150, lng: 73.8540, name: 'Laxmi Road' },
  'kumthekar': { lat: 18.5140, lng: 73.8510, name: 'Kumthekar Road' },
  'bajirao road': { lat: 18.5120, lng: 73.8530, name: 'Bajirao Road' },
  'sinhagad road': { lat: 18.4720, lng: 73.8290, name: 'Sinhagad Road' },
  'satara road': { lat: 18.4750, lng: 73.8600, name: 'Satara Road' },
  'solapur road': { lat: 18.5020, lng: 73.9030, name: 'Solapur Road' },
  'nagar road': { lat: 18.5580, lng: 73.9180, name: 'Ahmednagar Road' },
  'mumbai pune highway': { lat: 18.6100, lng: 73.8150, name: 'Mumbai-Pune Highway' },
  'old mumbai pune': { lat: 18.6100, lng: 73.8150, name: 'Old Mumbai-Pune Highway' },
  'dp road': { lat: 18.5600, lng: 73.8080, name: 'DP Road, Aundh' },
  'gdp road': { lat: 18.5204, lng: 73.8967, name: 'GDP Road, Ghorpuri' },
  'mg road': { lat: 18.5170, lng: 73.8820, name: 'MG Road, Camp' },
  'east street': { lat: 18.5150, lng: 73.8840, name: 'East Street, Camp' },
  'bund garden': { lat: 18.5340, lng: 73.8810, name: 'Bund Garden Road' },
  'boat club': { lat: 18.5360, lng: 73.8830, name: 'Boat Club Road' },

  // Key Suburbs & Localities
  'ghorpuri': { lat: 18.5204, lng: 73.8967, name: 'Ghorpuri' },
  'deccan gymkhana': { lat: 18.5173, lng: 73.8415, name: 'Deccan Gymkhana' },
  'deccan': { lat: 18.5193, lng: 73.8341, name: 'Deccan' },
  'shivajinagar': { lat: 18.5314, lng: 73.8446, name: 'Shivajinagar' },
  'koregaon park': { lat: 18.5362, lng: 73.8940, name: 'Koregaon Park' },
  'kalyani nagar': { lat: 18.5477, lng: 73.9037, name: 'Kalyani Nagar' },
  'viman nagar': { lat: 18.5679, lng: 73.9143, name: 'Viman Nagar' },
  'hadapsar': { lat: 18.5089, lng: 73.9259, name: 'Hadapsar' },
  'magarpatta': { lat: 18.5158, lng: 73.9272, name: 'Magarpatta City' },
  'kharadi': { lat: 18.5516, lng: 73.9348, name: 'Kharadi' },
  'wagholi': { lat: 18.5806, lng: 73.9833, name: 'Wagholi' },
  'hinjewadi phase 1': { lat: 18.5913, lng: 73.7389, name: 'Hinjewadi Phase 1' },
  'hinjewadi phase 2': { lat: 18.5870, lng: 73.7220, name: 'Hinjewadi Phase 2' },
  'hinjewadi phase 3': { lat: 18.5780, lng: 73.6990, name: 'Hinjewadi Phase 3' },
  'hinjewadi': { lat: 18.5913, lng: 73.7389, name: 'Hinjewadi' },
  'wakad': { lat: 18.5987, lng: 73.7687, name: 'Wakad' },
  'baner': { lat: 18.5590, lng: 73.7868, name: 'Baner' },
  'balewadi': { lat: 18.5730, lng: 73.7780, name: 'Balewadi' },
  'aundh': { lat: 18.5580, lng: 73.8075, name: 'Aundh' },
  'pashan': { lat: 18.5410, lng: 73.7920, name: 'Pashan' },
  'bavdhan': { lat: 18.5120, lng: 73.7740, name: 'Bavdhan' },
  'kothrud': { lat: 18.5074, lng: 73.8077, name: 'Kothrud' },
  'karve nagar': { lat: 18.4910, lng: 73.8180, name: 'Karve Nagar' },
  'warje': { lat: 18.4842, lng: 73.7996, name: 'Warje' },
  'swargate': { lat: 18.5018, lng: 73.8586, name: 'Swargate' },
  'katraj': { lat: 18.4575, lng: 73.8677, name: 'Katraj' },
  'kondhwa': { lat: 18.4740, lng: 73.8900, name: 'Kondhwa' },
  'wanowrie': { lat: 18.4920, lng: 73.8990, name: 'Wanowrie' },
  'camp': { lat: 18.5167, lng: 73.8833, name: 'Pune Camp' },
  'fatima nagar': { lat: 18.5030, lng: 73.8980, name: 'Fatima Nagar' },
  'bhosari': { lat: 18.6298, lng: 73.8453, name: 'Bhosari MIDC' },
  'pimpri': { lat: 18.6279, lng: 73.8009, name: 'Pimpri' },
  'chinchwad': { lat: 18.6298, lng: 73.7820, name: 'Chinchwad' },
  'nigdi': { lat: 18.6540, lng: 73.7749, name: 'Nigdi' },
  'akurdi': { lat: 18.6470, lng: 73.7720, name: 'Akurdi' },
  'ravet': { lat: 18.6473, lng: 73.7381, name: 'Ravet' },
  'tathawade': { lat: 18.6161, lng: 73.7483, name: 'Tathawade' },
  'chakan': { lat: 18.7606, lng: 73.8567, name: 'Chakan' },
  'yerawada': { lat: 18.5529, lng: 73.8797, name: 'Yerawada' },
  'dhanori': { lat: 18.5866, lng: 73.8878, name: 'Dhanori' },
  'lohegaon': { lat: 18.5982, lng: 73.9189, name: 'Lohegaon' },
  'bibwewadi': { lat: 18.4720, lng: 73.8640, name: 'Bibwewadi' },
  'dhankawadi': { lat: 18.4630, lng: 73.8560, name: 'Dhankawadi' },
  'narhe': { lat: 18.4480, lng: 73.8210, name: 'Narhe' },
  'ambegaon': { lat: 18.4480, lng: 73.8400, name: 'Ambegaon' },
  'vadgaon sheri': { lat: 18.5500, lng: 73.9200, name: 'Vadgaon Sheri' },
  'keshav nagar': { lat: 18.5280, lng: 73.9350, name: 'Keshav Nagar' },
  'mundhwa': { lat: 18.5300, lng: 73.9250, name: 'Mundhwa' },

  // Key Regional & Intercity Freight Hubs
  'pune': { lat: 18.5204, lng: 73.8567, name: 'Pune, Maharashtra' },
  'hyderabad': { lat: 17.3850, lng: 78.4867, name: 'Hyderabad, Telangana' },
  'secunderabad': { lat: 17.4399, lng: 78.4983, name: 'Secunderabad, Telangana' },
  'mumbai': { lat: 19.0760, lng: 72.8777, name: 'Mumbai, Maharashtra' },
  'navi mumbai': { lat: 19.0330, lng: 73.0297, name: 'Navi Mumbai, Maharashtra' },
  'thane': { lat: 19.2183, lng: 72.9781, name: 'Thane, Maharashtra' },
  'bengaluru': { lat: 12.9716, lng: 77.5946, name: 'Bengaluru, Karnataka' },
  'bangalore': { lat: 12.9716, lng: 77.5946, name: 'Bangalore, Karnataka' },
  'nashik': { lat: 19.9975, lng: 73.7898, name: 'Nashik, Maharashtra' },
  'solapur': { lat: 17.6599, lng: 75.9064, name: 'Solapur, Maharashtra' },
  'kolhapur': { lat: 16.7050, lng: 74.2433, name: 'Kolhapur, Maharashtra' },
  'satara': { lat: 17.6805, lng: 73.9997, name: 'Satara, Maharashtra' },
  'sangli': { lat: 16.8524, lng: 74.5815, name: 'Sangli, Maharashtra' },
  'ahmednagar': { lat: 19.0952, lng: 74.7480, name: 'Ahmednagar, Maharashtra' },
  'aurangabad': { lat: 19.8762, lng: 75.3433, name: 'Chhatrapati Sambhajinagar' },
  'sambhajinagar': { lat: 19.8762, lng: 75.3433, name: 'Chhatrapati Sambhajinagar' },
  'nagpur': { lat: 21.1458, lng: 79.0882, name: 'Nagpur, Maharashtra' },
  'goa': { lat: 15.2993, lng: 74.1240, name: 'Goa' },
  'delhi': { lat: 28.6139, lng: 77.2090, name: 'Delhi NCR' },
  'chennai': { lat: 13.0827, lng: 80.2707, name: 'Chennai, Tamil Nadu' },
  'surat': { lat: 21.1702, lng: 72.8311, name: 'Surat, Gujarat' },
  'ahmedabad': { lat: 23.0225, lng: 72.5714, name: 'Ahmedabad, Gujarat' },
  'indore': { lat: 22.7196, lng: 75.8577, name: 'Indore, Madhya Pradesh' }
};

/**
 * Match a raw address against known Pune landmarks and roads.
 * Longest keys are checked first for exact specificity.
 */
export const matchPuneKnownLocation = (rawAddress) => {
  if (!rawAddress || typeof rawAddress !== 'string') return null;
  const lower = rawAddress.toLowerCase().trim();
  const sortedKeys = Object.keys(KNOWN_PUNE_LOCATIONS).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (lower.includes(key)) {
      return { key, ...KNOWN_PUNE_LOCATIONS[key] };
    }
  }
  return null;
};

/**
 * Extracts searchable address candidates by progressively stripping private residential prefixes
 * (flat numbers, wing numbers, building names, and directional clauses like "behind the back").
 */
export const extractSearchCandidates = (rawAddress) => {
  if (!rawAddress || typeof rawAddress !== 'string') return [];
  const clean = rawAddress.trim();
  const candidates = [clean];

  // Strip flat/room/unit/plot/building prefix:
  const strippedPrefix = clean.replace(
    /^(\d+[-/A-Za-z0-9]*\s*(flat|flt|room|rm|plot|bldg|building|bungalow|apt|apartment|society|soc|wing\s*[A-Za-z])?[\s,]+)+/i,
    ''
  ).trim();
  if (strippedPrefix && strippedPrefix !== clean && strippedPrefix.length > 3) {
    candidates.push(strippedPrefix);
  }

  // Strip directional connector words
  const strippedDirections = clean.replace(
    /\b(behind\s+the\s+back|behind|near|opp\b|opposite|adj\b|adjacent\s+to|in\s+front\s+of|beside|next\s+to|at|post)\b/gi,
    ','
  );

  // Extract segments split by commas
  const segments = strippedDirections
    .split(/[,;\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 2);

  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    if (seg && !candidates.includes(seg)) {
      candidates.push(seg);
    }
  }

  return candidates;
};

// Global memory cache for geocoded queries
const geocodeCache = new Map();

/**
 * Geocode an address query to { lat, lng } within Pune Metropolitan Area
 */
export const geocodeAddress = async (query) => {
  if (!query || typeof query !== 'string' || query.trim().length < 2) return null;
  const clean = query.trim();

  if (geocodeCache.has(clean)) {
    return geocodeCache.get(clean);
  }

  // 1. Direct landmark & road dictionary check
  const directMatch = matchPuneKnownLocation(clean);
  if (directMatch) {
    const coords = { lat: directMatch.lat, lng: directMatch.lng };
    geocodeCache.set(clean, coords);
    return coords;
  }

  // 2. Candidate decomposition: extract road/landmark candidates from complex home addresses
  const candidates = extractSearchCandidates(clean);
  for (const cand of candidates) {
    const candMatch = matchPuneKnownLocation(cand);
    if (candMatch) {
      const coords = { lat: candMatch.lat, lng: candMatch.lng };
      geocodeCache.set(clean, coords);
      return coords;
    }
  }

  // 3. Live Nominatim geocoding bounded strictly to Pune & PCMC Metropolitan Region (PMRDA)
  try {
    for (const cand of candidates.slice(0, 3)) {
      let searchParam = cand;
      const lowerCand = cand.toLowerCase();
      if (!lowerCand.includes('pune') && !lowerCand.includes('pcmc') && !lowerCand.includes('maharashtra')) {
        searchParam = `${cand}, Pune, Maharashtra`;
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
        if (lat >= 8.0 && lat <= 36.5 && lng >= 68.0 && lng <= 97.5) {
          const coords = { lat, lng };
          geocodeCache.set(clean, coords);
          return coords;
        }
      }
    }
  } catch (err) {
    console.warn('Live geocoding network notice:', err);
  }

  // 4. Fallback deterministic offset within Pune boundary
  const hash = clean.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const fallback = {
    lat: 18.5204 + ((hash % 80) - 40) * 0.0015,
    lng: 73.8567 + (((hash * 5) % 80) - 40) * 0.0015
  };
  geocodeCache.set(clean, fallback);
  return fallback;
};

/**
 * Calculates Haversine distance in km between an array of points, factoring in a 1.35x urban road winding coefficient.
 */
export const calculateHaversineKm = (coords) => {
  if (!coords || coords.length < 2) return 0;
  let totalCrowFlies = 0;
  const R = 6371; // Earth's radius in km

  for (let i = 0; i < coords.length - 1; i++) {
    const p1 = coords[i];
    const p2 = coords[i + 1];
    if (!p1 || !p2 || typeof p1.lat !== 'number' || typeof p2.lat !== 'number') continue;
    
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    totalCrowFlies += R * c;
  }

  return parseFloat(Math.max(1.0, totalCrowFlies * 1.35).toFixed(1));
};

/**
 * Fetch real turn-by-turn road route via OSRM, with automatic Haversine fallback
 */
export const fetchOsrmRoute = async (points) => {
  if (!points || points.length < 2) {
    return { distanceKm: 0, durationMins: 0, polyline: [] };
  }

  const validPoints = points.filter(p => p && typeof p.lat === 'number' && typeof p.lng === 'number');
  if (validPoints.length < 2) {
    return { distanceKm: 0, durationMins: 0, polyline: [] };
  }

  try {
    const coordString = validPoints.map(p => `${p.lng},${p.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    const data = await res.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const primaryRoute = data.routes[0];
      const latLngs = primaryRoute.geometry.coordinates.map(coord => [coord[1], coord[0]]);
      const distanceKm = parseFloat((primaryRoute.distance / 1000).toFixed(1));
      const durationMins = Math.max(1, Math.round(primaryRoute.duration / 60));

      return {
        distanceKm,
        durationMins,
        polyline: latLngs,
        isFallback: false
      };
    }
  } catch (err) {
    console.warn('OSRM routing notice, using road geometry fallback:', err?.message || err);
  }

  // Robust Fallback
  const fallbackDistance = calculateHaversineKm(validPoints);
  const fallbackDuration = Math.max(3, Math.round(fallbackDistance * 2.5));
  const fallbackPolyline = validPoints.map(p => [p.lat, p.lng]);

  return {
    distanceKm: fallbackDistance,
    durationMins: fallbackDuration,
    polyline: fallbackPolyline,
    isFallback: true
  };
};


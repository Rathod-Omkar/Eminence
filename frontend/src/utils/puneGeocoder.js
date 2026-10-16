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
  'mundhwa': { lat: 18.5300, lng: 73.9250, name: 'Mundhwa' }
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

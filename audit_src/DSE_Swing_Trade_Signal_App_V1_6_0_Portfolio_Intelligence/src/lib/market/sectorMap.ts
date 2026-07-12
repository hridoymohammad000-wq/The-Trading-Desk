/**
 * Central DSE Sector Mapping Master Registry
 */

export const DSE_SECTORS = [
  'Bank',
  'NBFI',
  'Insurance',
  'Textile',
  'Engineering',
  'Pharmaceuticals & Chemicals',
  'Food & Allied',
  'Fuel & Power',
  'Cement',
  'Ceramics',
  'Telecommunication',
  'IT',
  'Services & Real Estate',
  'Miscellaneous',
  'Paper & Printing',
  'Tannery',
  'Jute',
  'Travel & Leisure',
  'Mutual Fund'
] as const;

export type DSESector = typeof DSE_SECTORS[number] | 'Unknown';

// Central mapping dictionary for DSE symbols
export const SYMBOL_SECTOR_MAP: Record<string, typeof DSE_SECTORS[number]> = {
  // Required mapping profiles from prompt
  'BEACONPHAR': 'Pharmaceuticals & Chemicals',
  'ENVOYTEX': 'Textile',
  'MALEKSPIN': 'Textile',
  'ALHAJTEX': 'Textile',
  'AL-HAJTEX': 'Textile',
  'BDFINANCE': 'NBFI',
  'KBPPWBIL': 'Miscellaneous',
  'RAHIMAFOOD': 'Food & Allied',

  // Other common blue chips / symbols in system
  'GP': 'Telecommunication',
  'SQUAREPHARMA': 'Pharmaceuticals & Chemicals',
  'RENATA': 'Pharmaceuticals & Chemicals',
  'LHBL': 'Cement',
  'BRACBANK': 'Bank',
  'BATBC': 'Food & Allied',
  'BEXIMCO': 'Miscellaneous',
  'UPGDCL': 'Fuel & Power',
  'MJLBD': 'Fuel & Power',
  'TITASGAS': 'Fuel & Power',
  'EBL': 'Bank',
  'IDLC': 'NBFI',
  'LANKABAFIN': 'NBFI',
  'AAMRANET': 'IT',
  'ADNTEL': 'IT',
  'BSCCL': 'Telecommunication',
  'BSRMSTEEL': 'Engineering',
  'GPHISPAT': 'Engineering',
  'RUNNERAUTO': 'Engineering',
  'WALTONHIL': 'Engineering',
  'HEIDELBCEM': 'Cement',
  'MEGHNACEM': 'Cement',
  'ACTIVEFINE': 'Pharmaceuticals & Chemicals',
  'BXPHARMA': 'Pharmaceuticals & Chemicals',
  'IBNSINA': 'Pharmaceuticals & Chemicals',
  'OLYMPIC': 'Food & Allied',
  'NTC': 'Food & Allied',
  'GOLDENHARV': 'Food & Allied',
  'UNIQUEHRL': 'Travel & Leisure',
  'PENINSULA': 'Travel & Leisure',
  'Apex Foot': 'Tannery',
  'APEXFOOT': 'Tannery',
  'BATASHOE': 'Tannery',
  'EPGL': 'Fuel & Power'
};

/**
 * Returns the mapped sector for a given symbol.
 * If the symbol is not in the map, checks heuristic prefixes or returns 'Unknown'.
 */
export function getSectorBySymbol(symbol: string): DSESector {
  if (!symbol) return 'Unknown';
  const norm = symbol.trim().toUpperCase();
  
  if (SYMBOL_SECTOR_MAP[norm]) {
    return SYMBOL_SECTOR_MAP[norm];
  }

  // Fallback heuristic mappings
  if (norm.endsWith('BANK')) return 'Bank';
  if (norm.endsWith('INS') || norm.includes('INSUR')) return 'Insurance';
  if (norm.endsWith('TEX') || norm.includes('TEXTILE')) return 'Textile';
  if (norm.endsWith('PHARMA') || norm.includes('PHARMACEUTICALS') || norm.includes('CHEM')) return 'Pharmaceuticals & Chemicals';
  if (norm.endsWith('FOOD') || norm.includes('ALLIED')) return 'Food & Allied';
  if (norm.endsWith('POWER') || norm.endsWith('GAS')) return 'Fuel & Power';
  if (norm.endsWith('CEMENT')) return 'Cement';
  if (norm.endsWith('CERAMIC')) return 'Ceramics';
  if (norm.endsWith('TELE') || norm.includes('TEL')) return 'Telecommunication';
  if (norm.endsWith('NET') || norm.endsWith('TEL') || norm.includes('INFO') || norm.includes('TECH')) return 'IT';

  return 'Unknown';
}

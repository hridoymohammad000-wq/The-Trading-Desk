export interface SymbolMappingResult {
  symbol: string;
  confidence: number;
}

/**
 * Normalizes Bangladesh DSE company names from LankaBangla statements to active DSE ticker symbols
 */
export function mapCompanyNameToSymbol(companyName: string): SymbolMappingResult {
  const norm = companyName.trim().toUpperCase();

  // 100% Confident exact matches (including our specific required sample list)
  if (norm.includes('BEACON PHARMA') || norm.includes('BEACONPHAR')) {
    return { symbol: 'BEACONPHAR', confidence: 100 };
  }
  if (norm.includes('ENVOY TEXTILES') || norm.includes('ENVOYTEX')) {
    return { symbol: 'ENVOYTEX', confidence: 100 };
  }
  if (norm.includes('MALEK SPINNING') || norm.includes('MALEKSPIN')) {
    return { symbol: 'MALEKSPIN', confidence: 100 };
  }
  if (norm.includes('AL-HAJ TEXTILE') || norm.includes('ALHAJTEX')) {
    return { symbol: 'AL-HAJTEX', confidence: 100 };
  }
  if (norm.includes('BANGLADESH FINANCE') || norm.includes('BDFINANCE')) {
    return { symbol: 'BDFINANCE', confidence: 100 };
  }
  if (norm.includes('KHAN BROTHERS') || norm.includes('KBPPWBIL')) {
    return { symbol: 'KBPPWBIL', confidence: 100 };
  }
  if (norm.includes('RAHIMA FOOD') || norm.includes('RAHIMAFOOD')) {
    return { symbol: 'RAHIMAFOOD', confidence: 100 };
  }

  // High-confidence heuristic substring matches
  if (norm.includes('BEACON')) return { symbol: 'BEACONPHAR', confidence: 90 };
  if (norm.includes('ENVOY')) return { symbol: 'ENVOYTEX', confidence: 90 };
  if (norm.includes('MALEK')) return { symbol: 'MALEKSPIN', confidence: 90 };
  if (norm.includes('AL-HAJ') || norm.includes('ALHAJ')) return { symbol: 'AL-HAJTEX', confidence: 95 };
  if (norm.includes('BANGLADESH FINANCE')) return { symbol: 'BDFINANCE', confidence: 95 };
  if (norm.includes('KHAN BROTHERS') || norm.includes('PP WOVEN')) return { symbol: 'KBPPWBIL', confidence: 95 };
  if (norm.includes('RAHIMA')) return { symbol: 'RAHIMAFOOD', confidence: 95 };

  // Common DSE active blue chips
  if (norm.includes('GRAMEENPHONE') || norm.includes('GP')) return { symbol: 'GP', confidence: 100 };
  if (norm.includes('SQUARE PHARMA') || norm.includes('SQUAREPHARMA')) return { symbol: 'SQUAREPHARMA', confidence: 100 };
  if (norm.includes('LAFARGEHOLCIM') || norm.includes('LHBL')) return { symbol: 'LHBL', confidence: 100 };
  if (norm.includes('RENATA')) return { symbol: 'RENATA', confidence: 100 };
  if (norm.includes('BRAC BANK') || norm.includes('BRACBANK')) return { symbol: 'BRACBANK', confidence: 100 };
  if (norm.includes('BATBC') || norm.includes('BRITISH AMERICAN')) return { symbol: 'BATBC', confidence: 100 };
  if (norm.includes('BEXIMCO')) return { symbol: 'BEXIMCO', confidence: 100 };

  // Fallback pattern extraction (e.g. "Grameenphone Ltd." -> "GRAMEENPHONE")
  const words = norm.replace(/PLC|LTD|LIMITED|SECURITIES|INVESTMENT|TRUST/gi, '').trim().split(/\s+/);
  const firstWord = words[0] || 'UNKNOWN';
  
  // Clean special characters
  const cleanedSymbol = firstWord.replace(/[^A-Z0-9]/g, '');

  return {
    symbol: cleanedSymbol.substring(0, 10) || 'UNKNOWN',
    confidence: 50
  };
}

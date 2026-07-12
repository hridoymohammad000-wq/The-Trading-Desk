import { getSectorBySymbol } from '../market/sectorMap';
export interface MarketRecord {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sector?: string;
  origin?: 'REAL' | 'MANUAL_IMPORT' | 'DEMO';
}

export interface RowValidationError {
  rowNumber: number;
  rawData: string;
  errors: string[];
  type: 'INVALID' | 'DUPLICATE' | 'MISSING';
}

export interface DataValidationSummary {
  totalRowsProcessed: number;
  validRecords: MarketRecord[];
  invalidRows: RowValidationError[];
  duplicateRowsCount: number;
  missingValuesCount: number;
  status: 'PASSED' | 'PASSED_WITH_WARNINGS' | 'FAILED';
}

/**
 * Validates raw string rows of Dhaka Stock Exchange market data.
 */
export function parseAndValidateCSV(csvContent: string): DataValidationSummary {
  const lines = csvContent.split(/\r?\n/);
  const invalidRows: RowValidationError[] = [];
  const validRecords: MarketRecord[] = [];
  
  let duplicateRowsCount = 0;
  let missingValuesCount = 0;
  
  if (lines.length === 0 || !lines[0].trim()) {
    return {
      totalRowsProcessed: 0,
      validRecords: [],
      invalidRows: [],
      duplicateRowsCount: 0,
      missingValuesCount: 0,
      status: 'FAILED',
    };
  }

  // Detect and align headers
  const headers = lines[0].split(',').map(h => h.trim().toUpperCase());
  const symbolIdx = headers.indexOf('SYMBOL');
  const dateIdx = headers.indexOf('DATE') !== -1 ? headers.indexOf('DATE') : headers.indexOf('TRADE_DATE');
  const openIdx = headers.indexOf('OPEN');
  const highIdx = headers.indexOf('HIGH');
  const lowIdx = headers.indexOf('LOW');
  const closeIdx = headers.indexOf('CLOSE');
  const volumeIdx = headers.indexOf('VOLUME');

  // Basic header verification
  if (symbolIdx === -1 || dateIdx === -1 || openIdx === -1 || highIdx === -1 || lowIdx === -1 || closeIdx === -1 || volumeIdx === -1) {
    invalidRows.push({
      rowNumber: 1,
      rawData: lines[0],
      errors: ['Missing required column headers. Must include: SYMBOL, DATE or TRADE_DATE, OPEN, HIGH, LOW, CLOSE, VOLUME'],
      type: 'INVALID'
    });
    return {
      totalRowsProcessed: 1,
      validRecords: [],
      invalidRows,
      duplicateRowsCount: 0,
      missingValuesCount: 0,
      status: 'FAILED',
    };
  }

  const seenKeys = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine.trim()) continue; // Skip empty trailing lines

    const cols = rawLine.split(',').map(c => c.trim());
    const rowErrors: string[] = [];
    let isMissing = false;

    // Check row length
    if (cols.length < headers.length) {
      rowErrors.push(`Column mismatch: Expected ${headers.length} columns, found ${cols.length}`);
      isMissing = true;
      missingValuesCount++;
    }

    // 1. Symbol check
    const symbol = cols[symbolIdx] || '';
    if (!symbol) {
      rowErrors.push('SYMBOL is empty');
      isMissing = true;
    } else if (!/^[A-Z0-9_-]+$/i.test(symbol)) {
      rowErrors.push(`SYMBOL '${symbol}' is invalid (must be alphanumeric)`);
    }

    // 2. Date check
    const date = cols[dateIdx] || '';
    if (!date) {
      rowErrors.push('DATE is empty');
      isMissing = true;
    } else if (isNaN(Date.parse(date))) {
      rowErrors.push(`DATE '${date}' is not a valid date string`);
    }

    // 3. Open, High, Low, Close, Volume numeric verification
    const openVal = cols[openIdx];
    const highVal = cols[highIdx];
    const lowVal = cols[lowIdx];
    const closeVal = cols[closeIdx];
    const volumeVal = cols[volumeIdx];

    const open = parseFloat(openVal);
    const high = parseFloat(highVal);
    const low = parseFloat(lowVal);
    const close = parseFloat(closeVal);
    const volume = parseInt(volumeVal, 10);

    if (!openVal || isNaN(open)) { rowErrors.push('OPEN price is missing or invalid'); isMissing = true; }
    if (!highVal || isNaN(high)) { rowErrors.push('HIGH price is missing or invalid'); isMissing = true; }
    if (!lowVal || isNaN(low)) { rowErrors.push('LOW price is missing or invalid'); isMissing = true; }
    if (!closeVal || isNaN(close)) { rowErrors.push('CLOSE price is missing or invalid'); isMissing = true; }
    if (!volumeVal || isNaN(volume)) { rowErrors.push('VOLUME is missing or invalid'); isMissing = true; }

    if (open <= 0) rowErrors.push('OPEN price must be positive');
    if (high <= 0) rowErrors.push('HIGH price must be positive');
    if (low <= 0) rowErrors.push('LOW price must be positive');
    if (close <= 0) rowErrors.push('CLOSE price must be positive');
    if (volume < 0) rowErrors.push('VOLUME cannot be negative');

    // 4. Logical boundaries check
    if (high < open) rowErrors.push(`HIGH price (${high}) is less than OPEN price (${open})`);
    if (high < close) rowErrors.push(`HIGH price (${high}) is less than CLOSE price (${close})`);
    if (high < low) rowErrors.push(`HIGH price (${high}) is less than LOW price (${low})`);
    if (low > open) rowErrors.push(`LOW price (${low}) is greater than OPEN price (${open})`);
    if (low > close) rowErrors.push(`LOW price (${low}) is greater than CLOSE price (${close})`);

    // 5. Check duplicate (same Symbol + Date)
    const uniqueKey = `${symbol.toUpperCase()}_${date}`;
    let isDuplicate = false;
    if (seenKeys.has(uniqueKey) && symbol && date) {
      isDuplicate = true;
      duplicateRowsCount++;
    } else {
      if (symbol && date) {
        seenKeys.add(uniqueKey);
      }
    }

    if (rowErrors.length > 0) {
      invalidRows.push({
        rowNumber: i + 1,
        rawData: rawLine,
        errors: rowErrors,
        type: isMissing ? 'MISSING' : 'INVALID'
      });
    } else if (isDuplicate) {
      invalidRows.push({
        rowNumber: i + 1,
        rawData: rawLine,
        errors: [`Duplicate record ignored: ${symbol} on ${date}`],
        type: 'DUPLICATE'
      });
    } else {
      validRecords.push({
        symbol: symbol.toUpperCase(),
        date,
        open,
        high,
        low,
        close,
        volume,
        sector: getSectorBySymbol(symbol.toUpperCase()),
        origin: 'MANUAL_IMPORT'
      });
    }
  }

  // Determine aggregate status
  let status: 'PASSED' | 'PASSED_WITH_WARNINGS' | 'FAILED' = 'PASSED';
  if (validRecords.length === 0) {
    status = 'FAILED';
  } else if (invalidRows.length > 0) {
    status = 'PASSED_WITH_WARNINGS';
  }

  return {
    totalRowsProcessed: lines.length - 1,
    validRecords,
    invalidRows,
    duplicateRowsCount,
    missingValuesCount,
    status
  };
}

/**
 * Returns a high-fidelity mock CSV file for DSE.
 * Contains both high-quality swing candidates and deliberate validation errors
 * to allow testing the system's strict engine boundaries.
 */
export function getMockDSEMarketCSV(): string {
  return `SYMBOL,DATE,OPEN,HIGH,LOW,CLOSE,VOLUME
SQUAREPHARMA,2026-06-26,210.0,215.5,208.5,214.2,2500000
SQUAREPHARMA,2026-06-26,210.0,215.5,208.5,214.2,2500000
LHBL,2026-06-26,63.0,66.2,62.5,65.8,1800000
BRACBANK,2026-06-26,42.5,44.8,42.0,43.9,980000
GP,2026-06-26,264.0,265.5,258.0,259.5,1200000
BEXIMCO,2026-06-26,114.0,116.8,113.5,115.6,650000
RENATA,2026-06-26,732.0,735.0,715.0,718.0,340000
UPGDCL,2026-06-26,252.0,258.0,250.0,256.5,890000
MARICO,2026-06-26,2430.0,2455.0,2410.0,2442.0,120000
BATBC,2026-06-26,488.0,494.0,485.0,491.5,430000
HEIDELBERG,2026-06-26,245.0,240.0,241.0,243.0,50000
JAMUNAOIL,2026-06-26,174.0,178.5,173.0,,80000
ACI,2026-06-26,-10.0,225.0,218.0,221.0,150000
`;
}

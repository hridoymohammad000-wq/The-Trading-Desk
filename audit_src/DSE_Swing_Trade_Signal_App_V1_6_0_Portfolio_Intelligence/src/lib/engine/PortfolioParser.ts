import { PortfolioHolding } from '../../types';
import { mapCompanyNameToSymbol } from './PortfolioSymbolMapper';
import { getSectorBySymbol } from '../market/sectorMap';

export interface TieOutValidationRow {
  symbol: string;
  qtyPass: boolean;
  costPass: boolean;
  marketPass: boolean;
  valueTolerancePass: boolean;
  rowStatus: 'PASS' | 'WARNING' | 'FAIL';
  rowDetails: string;
}

export interface TieOutSummary {
  holdingsCount: number;
  expectedCost: number;
  actualCost: number;
  expectedMarketValue: number;
  actualMarketValue: number;
  expectedUnrealizedPL: number;
  actualUnrealizedPL: number;
  expectedGainPercent: number;
  actualGainPercent: number;
  costTies: boolean;
  marketTies: boolean;
  summaryStatus: 'PASS' | 'WARNING' | 'FAIL';
  summaryDetails: string;
  rowValidations: TieOutValidationRow[];
}

/**
 * Normalizes number strings from PDF or pasted text (removes commas, spaces, percentages, etc.)
 */
export function cleanNumber(valStr: string): number {
  if (!valStr) return 0;
  // Remove commas, percent signs, and parentheses/minus signs
  let cleaned = valStr.replace(/,/g, '').replace(/%/g, '').trim();
  let multiplier = 1;
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = cleaned.slice(1, -1);
    multiplier = -1;
  } else if (cleaned.startsWith('-')) {
    cleaned = cleaned.slice(1);
    multiplier = -1;
  }
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed * multiplier;
}

/**
 * A highly adaptive LankaBangla Securities Client Wise Portfolio PDF text parser
 */
export function parseLankaBanglaText(rawText: string): PortfolioHolding[] {
  if (!rawText || !rawText.trim()) return [];

  const holdings: PortfolioHolding[] = [];
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // List of known company patterns to scan for
  const knownCompanies = [
    'Beacon Pharmaceuticals PLC',
    'Beacon Pharmaceuticals',
    'Envoy Textiles Limited',
    'Envoy Textiles',
    'MALEK SPINNING MILLS PLC',
    'MALEK SPINNING',
    'Al-Haj Textile Mills Limited',
    'Al-Haj Textile',
    'Bangladesh Finance Limited',
    'Bangladesh Finance',
    'KHAN BROTHERS PP WOVEN BAG INDUSTRIES LIMITED',
    'KHAN BROTHERS',
    'RAHIMA FOOD LTD',
    'RAHIMA FOOD'
  ];

  // Helper to extract a sequence of numbers from a string
  const extractNumbersFromLine = (str: string): number[] => {
    // Find floating numbers or integers, positive or negative
    // Handles formatted strings like 109.08, 10,908, -2,635.78, (2,635.78)
    const regex = /[-+]?\(?[0-9,]+(?:\.[0-9]+)?\)?%?/g;
    const matches = str.match(regex) || [];
    return matches.map(m => cleanNumber(m));
  };

  // We scan using a stateful lookahead block parser
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if the line matches a known company name or ends with standard corporate suffixes
    let matchedCompany = '';
    
    for (const comp of knownCompanies) {
      if (line.toLowerCase() === comp.toLowerCase() || line.toLowerCase().startsWith(comp.toLowerCase())) {
        matchedCompany = comp;
        break;
      }
    }

    if (!matchedCompany) {
      // General regex for DSE listed companies: ends with standard corporate patterns
      const plcRegex = /^[A-Za-z0-9&\-\s\.\/]+\s(PLC|LTD|LIMITED|BANK|INSURANCE|TEXTILE|MILLS|PHARMA|PHARMACEUTICALS|FOOD|FINANCE)/i;
      const match = line.match(plcRegex);
      if (match && !line.includes('Client Wise') && !line.includes('LankaBangla') && !line.includes('Statement') && !line.includes('Account')) {
        matchedCompany = match[0].trim();
      }
    }

    if (matchedCompany) {
      // We found a company name! Let's extract numeric values.
      // They might be inline on the same line, or spanned across subsequent lines.
      
      // First, get same-line numbers after the company name
      const sameLineNumbersStr = line.substring(line.indexOf(matchedCompany) + matchedCompany.length);
      let numbers = extractNumbersFromLine(sameLineNumbersStr);

      // Spanned/multi-line lookahead: Accumulate numbers until we reach another company name or a separator
      let lookaheadIndex = i + 1;
      while (lookaheadIndex < lines.length) {
        const nextLine = lines[lookaheadIndex];
        
        // Break if we hit another company name
        let isAnotherCompany = false;
        for (const comp of knownCompanies) {
          if (nextLine.toLowerCase() === comp.toLowerCase() || nextLine.toLowerCase().startsWith(comp.toLowerCase())) {
            isAnotherCompany = true;
            break;
          }
        }
        if (!isAnotherCompany) {
          const plcRegex = /^[A-Za-z0-9&\-\s\.]+\s(PLC|LTD|LIMITED|BANK|INSURANCE|TEXTILE|MILLS|PHARMA|PHARMACEUTICALS|FOOD|FINANCE)/i;
          const match = nextLine.match(plcRegex);
          if (match && !nextLine.includes('Client Wise') && !nextLine.includes('LankaBangla') && !nextLine.includes('Statement')) {
            isAnotherCompany = true;
          }
        }
        
        if (isAnotherCompany) {
          break;
        }

        // Add numbers found in this lookahead line
        const lineNums = extractNumbersFromLine(nextLine);
        numbers = [...numbers, ...lineNums];
        
        lookaheadIndex++;
      }

      // If we accumulated numbers, try to extract holding data!
      if (numbers.length >= 3) {
        let quantity = 0;
        let avgCost = 0;
        let costValue = 0;
        let marketPrice = 0;
        let marketValue = 0;
        let unrealizedPL = 0;
        let unrealizedPLPercent = 0;

        // Determine columns mapping based on numbers count
        if (numbers.length === 7) {
          // Multi-line structure from copy-pasting (e.g. our prompt sample)
          // [Qty, Cost Price, Cost Amount, Market Price, Market Value, Unrealized Gain, Gain %]
          quantity = numbers[0];
          avgCost = numbers[1];
          costValue = numbers[2];
          marketPrice = numbers[3];
          marketValue = numbers[4];
          unrealizedPL = numbers[5];
          unrealizedPLPercent = numbers[6];
        } else if (numbers.length === 11) {
          // Standard full tabular row with: Saleable Qty, Lien Qty, Lock Qty, Total Qty, Cost Price, Cost Amount, Market Price, Market Value, Portfolio %, Unrealized PL, Gain %
          quantity = numbers[3]; // Total Qty or Saleable Qty
          avgCost = numbers[4];
          costValue = numbers[5];
          marketPrice = numbers[6];
          marketValue = numbers[7];
          unrealizedPL = numbers[9];
          unrealizedPLPercent = numbers[10];
        } else if (numbers.length === 10) {
          // Tabular row with portfolio % or similar column missing/inserted
          quantity = numbers[3];
          avgCost = numbers[4];
          costValue = numbers[5];
          marketPrice = numbers[6];
          marketValue = numbers[7];
          unrealizedPL = numbers[8];
          unrealizedPLPercent = numbers[9];
        } else if (numbers.length >= 6) {
          // Format like [Qty, Cost, CostAmt, MarketPrice, MarketVal, PL]
          quantity = numbers[0];
          avgCost = numbers[1];
          costValue = numbers[2];
          marketPrice = numbers[3];
          marketValue = numbers[4];
          unrealizedPL = numbers[5];
          unrealizedPLPercent = costValue > 0 ? (unrealizedPL / costValue) * 100 : 0;
        } else {
          // Minimally parsed [Qty, Cost, MarketPrice]
          quantity = numbers[0] || 0;
          avgCost = numbers[1] || 0;
          marketPrice = numbers[2] || 0;
          costValue = quantity * avgCost;
          marketValue = quantity * marketPrice;
          unrealizedPL = marketValue - costValue;
          unrealizedPLPercent = costValue > 0 ? (unrealizedPL / costValue) * 100 : 0;
        }

        // Normalization via symbol mapper
        const mapped = mapCompanyNameToSymbol(matchedCompany);

        holdings.push({
          symbol: mapped.symbol,
          quantity,
          avgCost,
          marketPrice,
          marketValue: marketValue || (quantity * marketPrice),
          costValue: costValue || (quantity * avgCost),
          unrealizedPL: unrealizedPL || ((marketValue || (quantity * marketPrice)) - (costValue || (quantity * avgCost))),
          unrealizedPLPercent: unrealizedPLPercent || (costValue > 0 ? (unrealizedPL / costValue) * 100 : 0),
          originalName: matchedCompany,
          mappingConfidence: mapped.confidence,
          sector: getSectorBySymbol(mapped.symbol),
          status: 'ACTIVE'
        });

        // Fast-forward outer loop index to the lookahead boundary
        i = lookaheadIndex - 1;
      }
    }
  }

  // Refine portfolio percents
  const totalMV = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  if (totalMV > 0) {
    holdings.forEach(h => {
      h.portfolioPercent = parseFloat(((h.marketValue / totalMV) * 100).toFixed(2));
    });
  }

  return holdings;
}

/**
 * STEP 7 — Tie-out Validation Engine
 */
export function validateAndTieOut(holdings: PortfolioHolding[]): TieOutSummary {
  const rowValidations: TieOutValidationRow[] = [];
  let actualCost = 0;
  let actualMarketValue = 0;
  let actualUnrealizedPL = 0;

  holdings.forEach(h => {
    const calculatedCostAmount = h.quantity * h.avgCost;
    const calculatedMarketValue = h.quantity * h.marketPrice;
    
    const qtyPass = h.quantity > 0;
    const costPass = h.avgCost > 0;
    const marketPass = h.marketPrice > 0;
    
    // Check calculations with some tolerance for rounding
    const costDiff = Math.abs(h.costValue - calculatedCostAmount);
    const mvDiff = Math.abs(h.marketValue - calculatedMarketValue);
    const valueTolerancePass = costDiff <= 10 && mvDiff <= 10;
    
    let rowStatus: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
    let rowDetails = 'All mathematical calculations pass perfectly.';

    if (!qtyPass || !costPass || !marketPass) {
      rowStatus = 'FAIL';
      rowDetails = 'Metrics must be strictly positive numerical values.';
    } else if (!valueTolerancePass) {
      rowStatus = 'WARNING';
      rowDetails = `Math variance. Qty × Price = ৳${calculatedMarketValue.toLocaleString()} (Extracted: ৳${h.marketValue.toLocaleString()})`;
    }

    rowValidations.push({
      symbol: h.symbol,
      qtyPass,
      costPass,
      marketPass,
      valueTolerancePass,
      rowStatus,
      rowDetails
    });

    actualCost += h.costValue;
    actualMarketValue += h.marketValue;
    actualUnrealizedPL += h.unrealizedPL;
  });

  const expectedCost = holdings.reduce((sum, h) => sum + (h.quantity * h.avgCost), 0);
  const expectedMarketValue = holdings.reduce((sum, h) => sum + (h.quantity * h.marketPrice), 0);
  const expectedUnrealizedPL = expectedMarketValue - expectedCost;
  
  // Tie-out summaries check within 50 BDT variance limit for standard roundings
  const costTies = Math.abs(actualCost - expectedCost) <= 50;
  const marketTies = Math.abs(actualMarketValue - expectedMarketValue) <= 50;

  const actualGainPercent = actualCost > 0 ? (actualUnrealizedPL / actualCost) * 100 : 0;
  const expectedGainPercent = expectedCost > 0 ? (expectedUnrealizedPL / expectedCost) * 100 : 0;

  let summaryStatus: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
  let summaryDetails = 'Total costs and market values tie perfectly with individual position aggregations.';

  if (rowValidations.some(r => r.rowStatus === 'FAIL')) {
    summaryStatus = 'FAIL';
    summaryDetails = 'Mathematical errors detected. Please correct average costs or quantities manually.';
  } else if (!costTies || !marketTies || rowValidations.some(r => r.rowStatus === 'WARNING')) {
    summaryStatus = 'WARNING';
    summaryDetails = 'Small structural variances detected between summary totals and item details.';
  }

  return {
    holdingsCount: holdings.length,
    expectedCost,
    actualCost,
    expectedMarketValue,
    actualMarketValue,
    expectedUnrealizedPL,
    actualUnrealizedPL,
    expectedGainPercent,
    actualGainPercent,
    costTies,
    marketTies,
    summaryStatus,
    summaryDetails,
    rowValidations
  };
}

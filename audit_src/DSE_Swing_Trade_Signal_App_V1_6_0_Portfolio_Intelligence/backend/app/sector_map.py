from typing import Dict, List

DSE_SECTORS: List[str] = [
    "Bank",
    "NBFI",
    "Insurance",
    "Textile",
    "Engineering",
    "Pharmaceuticals & Chemicals",
    "Food & Allied",
    "Fuel & Power",
    "Cement",
    "Ceramics",
    "Telecommunication",
    "IT",
    "Services & Real Estate",
    "Miscellaneous",
    "Paper & Printing",
    "Tannery",
    "Jute",
    "Travel & Leisure",
    "Mutual Fund"
]

SYMBOL_SECTOR_MAP: Dict[str, str] = {
    "BEACONPHAR": "Pharmaceuticals & Chemicals",
    "ENVOYTEX": "Textile",
    "MALEKSPIN": "Textile",
    "ALHAJTEX": "Textile",
    "AL-HAJTEX": "Textile",
    "BDFINANCE": "NBFI",
    "KBPPWBIL": "Miscellaneous",
    "RAHIMAFOOD": "Food & Allied",
    
    # Common active symbols
    "GP": "Telecommunication",
    "SQUAREPHARMA": "Pharmaceuticals & Chemicals",
    "RENATA": "Pharmaceuticals & Chemicals",
    "LHBL": "Cement",
    "BRACBANK": "Bank",
    "BATBC": "Food & Allied",
    "BEXIMCO": "Miscellaneous",
    "UPGDCL": "Fuel & Power",
    "MJLBD": "Fuel & Power",
    "TITASGAS": "Fuel & Power",
    "EBL": "Bank",
    "IDLC": "NBFI",
    "LANKABAFIN": "NBFI",
    "AAMRANET": "IT",
    "ADNTEL": "IT",
    "BSCCL": "Telecommunication",
    "BSRMSTEEL": "Engineering",
    "GPHISPAT": "Engineering",
    "RUNNERAUTO": "Engineering",
    "WALTONHIL": "Engineering",
    "HEIDELBCEM": "Cement",
    "MEGHNACEM": "Cement",
    "ACTIVEFINE": "Pharmaceuticals & Chemicals",
    "BXPHARMA": "Pharmaceuticals & Chemicals",
    "IBNSINA": "Pharmaceuticals & Chemicals",
    "OLYMPIC": "Food & Allied",
    "NTC": "Food & Allied",
    "GOLDENHARV": "Food & Allied",
    "UNIQUEHRL": "Travel & Leisure",
    "PENINSULA": "Travel & Leisure",
    "APEXFOOT": "Tannery",
    "BATASHOE": "Tannery",
    "EPGL": "Fuel & Power"
}

def get_sector_by_symbol(symbol: str) -> str:
    if not symbol:
        return "Unknown"
    norm = symbol.strip().upper()
    
    if norm in SYMBOL_SECTOR_MAP:
        return SYMBOL_SECTOR_MAP[norm]
        
    # Heuristics
    if norm.endswith("BANK"):
        return "Bank"
    if norm.endswith("INS") or "INSUR" in norm:
        return "Insurance"
    if norm.endswith("TEX") or "TEXTILE" in norm:
        return "Textile"
    if norm.endswith("PHARMA") or "PHARMACEUTICAL" in norm or "CHEM" in norm:
        return "Pharmaceuticals & Chemicals"
    if norm.endswith("FOOD") or "ALLIED" in norm:
        return "Food & Allied"
    if norm.endswith("POWER") or norm.endswith("GAS"):
        return "Fuel & Power"
    if norm.endswith("CEMENT"):
        return "Cement"
    if norm.endswith("CERAMIC"):
        return "Ceramics"
    if norm.endswith("TELE") or "TEL" in norm:
        return "Telecommunication"
    if norm.endswith("NET") or "INFO" in norm or "TECH" in norm:
        return "IT"
        
    return "Unknown"

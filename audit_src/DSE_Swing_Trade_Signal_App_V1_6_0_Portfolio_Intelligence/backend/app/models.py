from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class MarketRecord(BaseModel):
    symbol: str = Field(..., description="DSE ticker symbol")
    trade_date: str = Field(..., description="YYYY-MM-DD")
    open: float = Field(..., gt=0)
    high: float = Field(..., gt=0)
    low: float = Field(..., gt=0)
    close: float = Field(..., gt=0)
    volume: int = Field(..., ge=0)
    sector: Optional[str] = "Unknown"
    source: Optional[str] = "MANUAL_IMPORT"
    created_at: Optional[str] = Field(default_factory=lambda: datetime.utcnow().isoformat())


class MarketSnapshot(BaseModel):
    id: str
    date: str
    total_symbols: int
    engine_version: str = "V1.4"
    created_time: str
    status: str = "PASSED"
    records: List[MarketRecord]


class CSVUploadRequest(BaseModel):
    csv_data: str
    date: Optional[str] = None
    origin: str = "MANUAL_IMPORT"


class CollectionRequest(BaseModel):
    mode: str = Field(default="backfill", description="backfill or daily")
    days_back: int = Field(default=365, ge=60, le=730)
    symbols: Optional[List[str]] = None
    refresh_symbols: bool = True
    pause_seconds: float = Field(default=0.8, ge=0, le=3)


class SignalOutput(BaseModel):
    symbol: str
    strategy: str
    signal: str
    grade: str
    entry: float
    sl: float
    tp: float
    rr: float
    confidence: float
    holdingPeriod: str
    supportZone: str
    reason: str
    volume: str
    date: str
    status: str = "ACTIVE"

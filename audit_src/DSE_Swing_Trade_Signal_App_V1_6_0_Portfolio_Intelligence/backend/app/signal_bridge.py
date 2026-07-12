from __future__ import annotations

from collections import defaultdict
from math import isfinite
from statistics import mean
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

MIN_HISTORY = 60


def _f(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value)
        return number if isfinite(number) else default
    except (TypeError, ValueError):
        return default


def _ema(values: Sequence[float], period: int) -> List[Optional[float]]:
    out: List[Optional[float]] = [None] * len(values)
    if len(values) < period:
        return out
    seed = mean(values[:period])
    out[period - 1] = seed
    multiplier = 2.0 / (period + 1.0)
    previous = seed
    for idx in range(period, len(values)):
        previous = (values[idx] - previous) * multiplier + previous
        out[idx] = previous
    return out


def _rsi(values: Sequence[float], period: int = 14) -> List[Optional[float]]:
    out: List[Optional[float]] = [None] * len(values)
    if len(values) <= period:
        return out
    gains: List[float] = []
    losses: List[float] = []
    for idx in range(1, period + 1):
        change = values[idx] - values[idx - 1]
        gains.append(max(change, 0.0))
        losses.append(max(-change, 0.0))
    avg_gain = mean(gains)
    avg_loss = mean(losses)
    out[period] = 100.0 if avg_loss == 0 else 100.0 - (100.0 / (1.0 + avg_gain / avg_loss))
    for idx in range(period + 1, len(values)):
        change = values[idx] - values[idx - 1]
        gain = max(change, 0.0)
        loss = max(-change, 0.0)
        avg_gain = ((avg_gain * (period - 1)) + gain) / period
        avg_loss = ((avg_loss * (period - 1)) + loss) / period
        out[idx] = 100.0 if avg_loss == 0 else 100.0 - (100.0 / (1.0 + avg_gain / avg_loss))
    return out


def _atr(rows: Sequence[Dict[str, Any]], period: int = 14) -> List[Optional[float]]:
    out: List[Optional[float]] = [None] * len(rows)
    if len(rows) < period:
        return out
    true_ranges: List[float] = []
    for idx, row in enumerate(rows):
        high, low = _f(row['high']), _f(row['low'])
        if idx == 0:
            tr = high - low
        else:
            previous_close = _f(rows[idx - 1]['close'])
            tr = max(high - low, abs(high - previous_close), abs(low - previous_close))
        true_ranges.append(max(tr, 0.0))
    seed = mean(true_ranges[:period])
    out[period - 1] = seed
    previous = seed
    for idx in range(period, len(rows)):
        previous = ((previous * (period - 1)) + true_ranges[idx]) / period
        out[idx] = previous
    return out


def _rolling_mean(values: Sequence[float], period: int) -> List[Optional[float]]:
    out: List[Optional[float]] = [None] * len(values)
    if len(values) < period:
        return out
    window_sum = sum(values[:period])
    out[period - 1] = window_sum / period
    for idx in range(period, len(values)):
        window_sum += values[idx] - values[idx - period]
        out[idx] = window_sum / period
    return out


def _round_price(value: float) -> float:
    return round(value, 2)


def _group_history(records: Iterable[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    by_symbol_date: Dict[Tuple[str, str], Dict[str, Any]] = {}
    for raw in records:
        symbol = str(raw.get('symbol', '')).upper().strip()
        trade_date = str(raw.get('trade_date') or raw.get('date') or '').strip()
        if not symbol or not trade_date:
            continue
        row = dict(raw)
        row['symbol'] = symbol
        row['trade_date'] = trade_date
        by_symbol_date[(symbol, trade_date)] = row
    grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for row in by_symbol_date.values():
        grouped[row['symbol']].append(row)
    for rows in grouped.values():
        rows.sort(key=lambda item: item['trade_date'])
    return grouped


def _bullish_confirmation(previous: Dict[str, Any], current: Dict[str, Any]) -> bool:
    prev_open, prev_close = _f(previous['open']), _f(previous['close'])
    current_open, current_close = _f(current['open']), _f(current['close'])
    current_high, current_low = _f(current['high']), _f(current['low'])
    body = abs(current_close - current_open)
    lower_wick = min(current_open, current_close) - current_low
    engulfing = current_close > current_open and prev_close < prev_open and current_open <= prev_close and current_close >= prev_open
    hammer = current_close > current_open and lower_wick >= body * 1.5 and (current_high - max(current_open, current_close)) <= max(body, 0.01)
    strong_close = current_close > current_open and current_close >= current_low + (current_high - current_low) * 0.65
    return engulfing or hammer or strong_close


def _pivot_levels(rows: Sequence[Dict[str, Any]], lookback: int = 80) -> Tuple[float, List[float], List[float], List[float]]:
    recent = rows[-lookback:]
    lows = [_f(row['low']) for row in recent]
    highs = [_f(row['high']) for row in recent]
    pivot_lows: List[float] = []
    pivot_highs: List[float] = []
    for idx in range(2, len(recent) - 2):
        if lows[idx] <= min(lows[idx - 2:idx + 3]):
            pivot_lows.append(lows[idx])
        if highs[idx] >= max(highs[idx - 2:idx + 3]):
            pivot_highs.append(highs[idx])
    close = _f(recent[-1]['close'])
    supports = sorted({level for level in pivot_lows if 0 < level < close}, reverse=True)
    resistances = sorted({level for level in pivot_highs if level > close})
    support = supports[0] if supports else min(lows[-20:])
    return support, resistances, pivot_lows, pivot_highs


def _eligible_equity_symbol(symbol: str) -> bool:
    normalized = symbol.upper().strip()
    return 'BOND' not in normalized and not normalized.endswith('MF') and 'MF1' not in normalized and '1MF' not in normalized

def calculate_market_bias(records: List[Dict[str, Any]]) -> str:
    """Breadth bias from the latest session only; signal generation uses full history."""
    if not records:
        return 'Unknown'
    latest_date = max(str(r.get('trade_date') or r.get('date') or '') for r in records)
    latest = [r for r in records if str(r.get('trade_date') or r.get('date') or '') == latest_date]
    if not latest:
        return 'Unknown'
    green_count = sum(1 for row in latest if _f(row.get('close')) > _f(row.get('open')))
    ratio = green_count / len(latest)
    if ratio > 0.55:
        return 'Bullish'
    if ratio >= 0.40:
        return 'Neutral'
    return 'Bearish'


def _format_volume(volume: float) -> str:
    return f'{volume / 1_000_000:.1f}M' if volume >= 1_000_000 else f'{volume / 1_000:.0f}K'


def _insufficient_signal(symbol: str, row: Dict[str, Any], count: int) -> Dict[str, Any]:
    close = _f(row.get('close'))
    return {
        'symbol': symbol, 'strategy': 'Pullback', 'signal': 'AVOID', 'grade': 'AVOID',
        'entry': _round_price(close), 'sl': _round_price(close), 'tp': _round_price(close), 'rr': 0.0,
        'confidence': 0, 'holdingPeriod': 'Not eligible', 'supportZone': 'Unavailable',
        'reason': f'Insufficient historical data: {count} sessions available; at least {MIN_HISTORY} required.',
        'volume': _format_volume(_f(row.get('volume'))), 'date': row.get('trade_date'), 'status': 'ACTIVE',
        'metrics': {'history_sessions': count},
    }


def generate_swing_signals_py(records: List[Dict[str, Any]], min_rr: float = 2.0) -> List[Dict[str, Any]]:
    """Generate conservative, explainable EOD swing setups from complete per-symbol history.

    BUY means a rule-based candidate for review, never an automatic execution instruction.
    The engine intentionally returns WATCH/AVOID when evidence is incomplete.
    """
    signals: List[Dict[str, Any]] = []
    grouped = _group_history(records)

    for symbol, rows in grouped.items():
        if not rows:
            continue
        if len(rows) < MIN_HISTORY:
            signals.append(_insufficient_signal(symbol, rows[-1], len(rows)))
            continue

        closes = [_f(row['close']) for row in rows]
        volumes = [_f(row['volume']) for row in rows]
        ema20, ema50, ema200 = _ema(closes, 20), _ema(closes, 50), _ema(closes, 200)
        rsi14, atr14, avg_volume20 = _rsi(closes, 14), _atr(rows, 14), _rolling_mean(volumes, 20)
        idx = len(rows) - 1
        current, previous = rows[idx], rows[idx - 1]
        entry = closes[idx]
        atr = atr14[idx] or max(entry * 0.02, 0.01)
        rsi = rsi14[idx] or 50.0
        e20 = ema20[idx] or entry
        e50 = ema50[idx] or entry
        e200 = ema200[idx]
        avg_vol = avg_volume20[idx] or max(volumes[idx], 1.0)
        relative_volume = volumes[idx] / avg_vol if avg_vol > 0 else 0.0
        support, resistances, pivot_lows, _ = _pivot_levels(rows)
        support_zone_low = max(0.01, support - atr * 0.30)
        support_zone_high = support + atr * 0.80

        strong_trend = entry > e20 > e50 and (e200 is None or e50 > e200)
        recovery_trend = entry > e20 and e20 >= e50 * 0.995
        neutral_trend = entry >= e50 and entry >= e20 * 0.98
        bearish_trend = entry < e20 and e20 < e50
        trend_state = 'STRONG_BULLISH' if strong_trend else ('RECOVERY' if recovery_trend else ('NEUTRAL' if neutral_trend else ('BEARISH' if bearish_trend else 'WEAK')))

        ema_distance = min(abs(entry - e20), abs(entry - e50))
        near_ema = ema_distance <= max(atr, entry * 0.03)
        near_support = support_zone_low <= _f(current['low']) <= support_zone_high or abs(entry - support) <= max(atr, entry * 0.035)
        confirmation = _bullish_confirmation(previous, current)
        previous_rsi = rsi14[idx - 1]
        rsi_constructive = 42.0 <= rsi <= 68.0 and (previous_rsi is None or rsi >= float(previous_rsi) - 1.0)
        support_respected = entry > support_zone_low
        support_broken = entry < support_zone_low
        liquid = avg_vol >= 50_000
        institutional_liquidity = avg_vol >= 100_000
        volume_constructive = relative_volume >= 0.75
        eligible_equity = _eligible_equity_symbol(symbol)

        strategy = 'Pullback' if (strong_trend or recovery_trend) and near_ema else 'Support Bounce'

        recent_low = min(_f(row['low']) for row in rows[-5:])
        protective_candidates = [level for level in (support, recent_low) if 0 < level < entry]
        protective_level = max(protective_candidates) if protective_candidates else entry - atr
        sl = protective_level - atr * 0.35
        if sl >= entry:
            sl = entry - atr
        risk = entry - sl
        risk_percent = (risk / entry * 100.0) if entry > 0 else 100.0

        target: Optional[float] = None
        target_source = 'NONE'
        if risk > 0:
            for level in resistances:
                if (level - entry) / risk >= min_rr:
                    target = level
                    target_source = 'STRUCTURE'
                    break
            if target is None and (strong_trend or recovery_trend):
                target = entry + min_rr * risk
                target_source = 'ATR_EXTENSION'
        if target is None:
            target = entry
        rr = (target - entry) / risk if risk > 0 else 0.0

        score = 0
        score += 25 if strong_trend else (18 if recovery_trend else (10 if neutral_trend else 0))
        score += 15 if (near_ema if strategy == 'Pullback' else near_support) else (5 if near_support else 0)
        score += 10 if confirmation else (4 if _f(current['close']) >= _f(current['open']) else 0)
        score += 10 if rsi_constructive else (5 if 35.0 <= rsi <= 72.0 else 0)
        score += 10 if relative_volume >= 1.0 else (7 if volume_constructive else 0)
        score += 10 if support_respected else 0
        score += 15 if rr >= min_rr and target_source == 'STRUCTURE' else (10 if rr >= min_rr else (5 if rr >= 1.5 else 0))
        score += 5 if institutional_liquidity else (3 if liquid else 0)
        score = min(score, 100)

        hard_reasons: List[str] = []
        if not eligible_equity:
            hard_reasons.append('instrument type is excluded from equity BUY candidates')
        if not liquid:
            hard_reasons.append('20-session average volume is below 50K')
        if risk <= 0 or risk_percent > 10.0:
            hard_reasons.append(f'structural risk is {risk_percent:.1f}%')
        if support_broken:
            hard_reasons.append('verified support is broken')
        if bearish_trend and rsi < 35.0:
            hard_reasons.append('bearish trend and weak RSI are aligned')
        if target_source == 'NONE':
            hard_reasons.append('no valid upside target')

        confirmations = sum((confirmation, volume_constructive, rsi_constructive))
        a_plus = (
            not hard_reasons and score >= 90 and strong_trend and confirmation and
            relative_volume >= 1.0 and 45.0 <= rsi <= 65.0 and
            target_source == 'STRUCTURE' and rr >= 2.5 and risk_percent <= 5.0 and avg_vol >= 150_000
        )
        a_grade = (
            not hard_reasons and score >= 85 and (strong_trend or recovery_trend) and confirmations >= 2 and
            target_source == 'STRUCTURE' and rr >= min_rr and risk_percent <= 7.0 and institutional_liquidity
        )

        if a_plus:
            signal, grade = 'BUY', 'A+'
            reason = (
                f'A+ candidate: {trend_state.lower().replace("_", " ")} trend, structural RR {rr:.2f}x, '
                f'confirmed candle, constructive RSI and volume. Review before any order.'
            )
        elif a_grade:
            signal, grade = 'BUY', 'A'
            reason = (
                f'A candidate: {trend_state.lower().replace("_", " ")} trend with {confirmations}/3 confirmation checks; '
                f'next structural target is ৳{target:.2f}. Review before any order.'
            )
        elif hard_reasons or score < 45:
            signal, grade = 'AVOID', 'AVOID'
            details = ', '.join(hard_reasons) if hard_reasons else f'evidence score is only {score}/100'
            reason = f'No new entry: {details}.'
        else:
            signal, grade = 'WATCH', 'WATCH'
            missing: List[str] = []
            if not (strong_trend or recovery_trend): missing.append(f'trend is {trend_state.lower()}')
            if not confirmation: missing.append('bullish candle confirmation is absent')
            if not rsi_constructive: missing.append('RSI is not constructive')
            if not volume_constructive: missing.append('relative volume is below 0.75x')
            if target_source != 'STRUCTURE': missing.append('structural target is not confirmed')
            if rr < min_rr: missing.append(f'RR {rr:.2f}x is below {min_rr:.2f}x')
            reason = 'Wait for confirmation: ' + '; '.join(missing[:4]) + '.'

        signals.append({
            'symbol': symbol,
            'strategy': strategy,
            'signal': signal,
            'grade': grade,
            'entry': _round_price(entry),
            'sl': _round_price(sl),
            'tp': _round_price(target),
            'rr': round(max(rr, 0.0), 2),
            'confidence': score,
            'holdingPeriod': '3-10 Sessions',
            'supportZone': f'৳{support_zone_low:.2f} - ৳{support_zone_high:.2f}',
            'reason': reason,
            'volume': _format_volume(volumes[idx]),
            'date': current['trade_date'],
            'status': 'ACTIVE',
            'trendState': trend_state,
            'targetSource': target_source,
            'actionHint': 'REVIEW CANDIDATE' if signal == 'BUY' else ('WAIT' if signal == 'WATCH' else 'NO NEW ENTRY'),
            'metrics': {
                'history_sessions': len(rows), 'ema20': _round_price(e20), 'ema50': _round_price(e50),
                'ema200': _round_price(e200) if e200 is not None else None, 'rsi14': round(rsi, 2),
                'atr14': _round_price(atr), 'avg_volume20': round(avg_vol),
                'relative_volume': round(relative_volume, 2), 'support': _round_price(support),
                'resistance': _round_price(target), 'score': score, 'risk_percent': round(risk_percent, 2),
            },
        })

    rank = {'A+': 4, 'A': 3, 'WATCH': 2, 'AVOID': 1}
    signals.sort(key=lambda item: (rank.get(item['grade'], 0), item['confidence'], _f(item.get('metrics', {}).get('relative_volume'))), reverse=True)
    return signals


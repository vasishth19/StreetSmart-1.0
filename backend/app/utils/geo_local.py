"""
Small geometry helpers that work in local metres (equirectangular projection).
Accurate to well under 0.5 % over city-scale distances, which is far below the
noise in the underlying map data.
All route coordinates in StreetSmart are GeoJSON order: [lng, lat].
"""
from __future__ import annotations
import math
from typing import List, Sequence, Tuple

R_EARTH_M = 6371008.8


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = p2 - p1
    dl = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R_EARTH_M * math.asin(min(1.0, math.sqrt(a)))


def polyline_length_m(coords: Sequence[Sequence[float]]) -> float:
    return sum(
        haversine_m(coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0])
        for i in range(len(coords) - 1)
    )


def cumulative_m(coords: Sequence[Sequence[float]]) -> List[float]:
    out = [0.0]
    for i in range(len(coords) - 1):
        out.append(out[-1] + haversine_m(coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0]))
    return out


class LocalXY:
    """Project lng/lat to metres around a reference latitude."""

    def __init__(self, lat0: float, lng0: float = 0.0):
        self.lat0 = lat0
        self.lng0 = lng0
        self.kx = math.cos(math.radians(lat0)) * math.pi / 180 * R_EARTH_M
        self.ky = math.pi / 180 * R_EARTH_M

    def to_xy(self, lng: float, lat: float) -> Tuple[float, float]:
        return ((lng - self.lng0) * self.kx, (lat - self.lat0) * self.ky)

    def many(self, coords: Sequence[Sequence[float]]) -> List[Tuple[float, float]]:
        return [self.to_xy(c[0], c[1]) for c in coords]


def decode_polyline(encoded: str, precision: int = 6) -> List[List[float]]:
    """Decode a Google/Valhalla encoded polyline -> [[lng, lat], ...]."""
    factor = 10 ** precision
    coords: List[List[float]] = []
    index = lat = lng = 0
    n = len(encoded)
    while index < n:
        for axis in (0, 1):
            shift = result = 0
            while True:
                b = ord(encoded[index]) - 63
                index += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            delta = ~(result >> 1) if (result & 1) else (result >> 1)
            if axis == 0:
                lat += delta
            else:
                lng += delta
        coords.append([lng / factor, lat / factor])
    return coords


def resample(coords: Sequence[Sequence[float]], step_m: float) -> List[dict]:
    """
    Split a polyline into consecutive chunks of ~step_m metres.
    Returns [{coords:[[lng,lat]..], start_m, end_m, length_m, mid:(lng,lat)}].
    """
    if len(coords) < 2:
        return []
    cum = cumulative_m(coords)
    total = cum[-1]
    if total <= 0:
        return []
    n_chunks = max(1, int(round(total / step_m)))
    bounds = [total * i / n_chunks for i in range(n_chunks + 1)]

    def point_at(d: float) -> List[float]:
        if d <= 0:
            return list(coords[0])
        if d >= total:
            return list(coords[-1])
        lo, hi = 0, len(cum) - 1
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if cum[mid] <= d:
                lo = mid
            else:
                hi = mid
        seg = cum[hi] - cum[lo]
        t = 0 if seg == 0 else (d - cum[lo]) / seg
        return [coords[lo][0] + (coords[hi][0] - coords[lo][0]) * t,
                coords[lo][1] + (coords[hi][1] - coords[lo][1]) * t]

    chunks = []
    for i in range(n_chunks):
        a, b = bounds[i], bounds[i + 1]
        pts = [point_at(a)]
        for j, c in enumerate(coords):
            if a < cum[j] < b:
                pts.append([c[0], c[1]])
        pts.append(point_at(b))
        mid = point_at((a + b) / 2)
        chunks.append({"coords": pts, "start_m": a, "end_m": b, "length_m": b - a, "mid": (mid[0], mid[1])})
    return chunks


def bbox_of(coords: Sequence[Sequence[float]], pad_m: float = 0.0) -> Tuple[float, float, float, float]:
    """(min_lat, min_lng, max_lat, max_lng) padded by pad_m."""
    lats = [c[1] for c in coords]
    lngs = [c[0] for c in coords]
    lat0 = sum(lats) / len(lats)
    dlat = pad_m / 111_320.0
    dlng = pad_m / (111_320.0 * max(0.01, math.cos(math.radians(lat0))))
    return (min(lats) - dlat, min(lngs) - dlng, max(lats) + dlat, max(lngs) + dlng)


def thin(coords: Sequence[Sequence[float]], max_points: int) -> List[List[float]]:
    """Evenly thin a polyline to at most max_points (keeps first and last)."""
    if len(coords) <= max_points:
        return [list(c) for c in coords]
    step = (len(coords) - 1) / (max_points - 1)
    return [list(coords[int(round(i * step))]) for i in range(max_points)]


def sunrise_sunset_utc_hours(lat: float, lng: float, day_of_year: int) -> Tuple[float, float]:
    """
    NOAA-style approximation of sunrise/sunset in UTC hours (accuracy ~ a few
    minutes, plenty for 'is it dark yet?'). Returns (sunrise_h, sunset_h).
    """
    gamma = 2 * math.pi / 365 * (day_of_year - 1)
    eqtime = 229.18 * (0.000075 + 0.001868 * math.cos(gamma) - 0.032077 * math.sin(gamma)
                       - 0.014615 * math.cos(2 * gamma) - 0.040849 * math.sin(2 * gamma))
    decl = (0.006918 - 0.399912 * math.cos(gamma) + 0.070257 * math.sin(gamma)
            - 0.006758 * math.cos(2 * gamma) + 0.000907 * math.sin(2 * gamma)
            - 0.002697 * math.cos(3 * gamma) + 0.00148 * math.sin(3 * gamma))
    lat_r = math.radians(lat)
    cos_ha = (math.cos(math.radians(90.833)) / (math.cos(lat_r) * math.cos(decl))
              - math.tan(lat_r) * math.tan(decl))
    cos_ha = max(-1.0, min(1.0, cos_ha))
    ha = math.degrees(math.acos(cos_ha))
    sunrise = (720 - 4 * (lng + ha) - eqtime) / 60.0
    sunset = (720 - 4 * (lng - ha) - eqtime) / 60.0
    return sunrise, sunset

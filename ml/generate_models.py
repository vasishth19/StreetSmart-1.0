"""
StreetSmart – Model Generation Script
Run this once to pre-generate all ML model .pkl files.

Usage:
    cd StreetSmart
    python ml/generate_models.py
"""

import numpy as np
import pickle
import json
import os
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import LabelEncoder

print("🧠 StreetSmart – Generating ML Models")
print("=" * 45)

# ── Paths ─────────────────────────────────────────────────────────
MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODELS_DIR, exist_ok=True)

# ══════════════════════════════════════════════════════════════════
# 1. SAFETY MODEL
# ══════════════════════════════════════════════════════════════════
print("\n[1/3] Generating safety_model.pkl ...")

np.random.seed(42)
N = 5000

SAFETY_FEATURES = [
    "lat_mean", "lng_mean", "lat_std", "lng_std",
    "segment_count", "hour_of_day", "is_weekend",
    "crime_density", "light_level", "crowd_density",
    "has_cctv", "near_police", "near_hospital",
]

# Synthetic feature matrix
X_safety = np.column_stack([
    np.random.uniform(40.68, 40.78, N),    # lat_mean
    np.random.uniform(-74.05, -73.93, N),  # lng_mean
    np.abs(np.random.normal(0.002, 0.001, N)),  # lat_std
    np.abs(np.random.normal(0.002, 0.001, N)),  # lng_std
    np.random.randint(5, 30, N).astype(float),  # segment_count
    np.random.randint(0, 24, N).astype(float),  # hour_of_day
    np.random.randint(0, 2, N).astype(float),   # is_weekend
    np.random.uniform(0.0, 1.0, N),             # crime_density
    np.random.uniform(0.0, 1.0, N),             # light_level
    np.random.uniform(0.0, 1.0, N),             # crowd_density
    np.random.randint(0, 2, N).astype(float),   # has_cctv
    np.random.randint(0, 2, N).astype(float),   # near_police
    np.random.randint(0, 2, N).astype(float),   # near_hospital
])

# Realistic safety score formula
y_safety = (
    100.0
    - X_safety[:, 7] * 35.0        # crime_density  (big negative)
    + X_safety[:, 8] * 15.0        # light_level    (positive)
    - X_safety[:, 9] * 10.0        # crowd_density  (slight negative)
    + X_safety[:, 10] * 5.0        # has_cctv       (positive)
    + X_safety[:, 11] * 4.0        # near_police    (positive)
    + X_safety[:, 12] * 3.0        # near_hospital  (positive)
    # Night penalty
    - np.where(
        (X_safety[:, 5] >= 22) | (X_safety[:, 5] <= 5),
        12.0, 0.0
    )
    + np.random.normal(0, 4, N)    # noise
)
y_safety = np.clip(y_safety, 20, 99)

safety_model = RandomForestRegressor(
    n_estimators=150,
    max_depth=10,
    min_samples_split=5,
    min_samples_leaf=2,
    max_features="sqrt",
    random_state=42,
    n_jobs=-1,
)
safety_model.fit(X_safety, y_safety)

safety_path = os.path.join(MODELS_DIR, "safety_model.pkl")
with open(safety_path, "wb") as f:
    pickle.dump(safety_model, f)

print(f"   ✅ Saved → {safety_path}")
print(f"   Features : {len(SAFETY_FEATURES)}")
print(f"   Samples  : {N:,}")
print(f"   Score range: {y_safety.min():.1f} – {y_safety.max():.1f}")

# Save feature list
with open(os.path.join(MODELS_DIR, "safety_features.json"), "w") as f:
    json.dump(SAFETY_FEATURES, f, indent=2)

# ══════════════════════════════════════════════════════════════════
# 2. CROWD MODEL
# ══════════════════════════════════════════════════════════════════
print("\n[2/3] Generating crowd_model.pkl ...")

ZONE_TYPES = [
    "commercial", "residential", "transit",
    "park", "industrial", "university",
    "hospital", "entertainment",
]

le = LabelEncoder()
le.fit(ZONE_TYPES)

CROWD_FEATURES = [
    "zone_type_enc", "lat", "lng", "area_sqkm",
    "has_metro", "has_park",
    "hour_sin", "hour_cos",
    "dow_sin", "dow_cos",
    "month_sin", "month_cos",
    "is_weekend", "season",
    "is_raining", "is_event",
    "rush_hour", "lunch_hour", "night_hour",
    "event_weekend", "metro_rush", "rain_night",
]

# Build synthetic crowd dataset
hours_arr = np.random.randint(0, 24, N)
dow_arr   = np.random.randint(0, 7, N)
month_arr = np.random.randint(1, 13, N)
zone_arr  = np.random.choice(ZONE_TYPES, N)

HOUR_MULT = {
     0:0.08, 1:0.05, 2:0.04, 3:0.03, 4:0.05,
     5:0.15, 6:0.35, 7:0.75, 8:0.92, 9:0.80,
    10:0.65,11:0.72,12:0.88,13:0.82,14:0.70,
    15:0.72,16:0.80,17:0.95,18:0.88,19:0.75,
    20:0.60,21:0.50,22:0.35,23:0.18,
}
ZONE_BASE = {
    "commercial":0.75, "residential":0.35, "transit":0.85,
    "park":0.45, "industrial":0.25, "university":0.60,
    "hospital":0.55, "entertainment":0.50,
}

is_weekend_arr = (dow_arr >= 5).astype(float)
is_raining_arr = (np.random.random(N) < 0.20).astype(float)
is_event_arr   = (np.random.random(N) < 0.05).astype(float)
has_metro_arr  = np.random.randint(0, 2, N).astype(float)
has_park_arr   = np.random.randint(0, 2, N).astype(float)
rush_arr  = np.isin(hours_arr, [7,8,9,17,18,19]).astype(float)
lunch_arr = np.isin(hours_arr, [11,12,13]).astype(float)
night_arr = np.isin(hours_arr, [0,1,2,3,4,5,22,23]).astype(float)
season_arr = ((month_arr % 12) // 3).astype(float)

y_crowd = np.array([
    ZONE_BASE[zone_arr[i]] * HOUR_MULT[hours_arr[i]]
    * (0.9 if is_weekend_arr[i] else 1.0)
    * (0.70 if is_raining_arr[i] else 1.0)
    * (1.35 if is_event_arr[i] else 1.0)
    + np.random.normal(0, 0.04)
    for i in range(N)
])
y_crowd = np.clip(y_crowd, 0.0, 1.0)

X_crowd = np.column_stack([
    le.transform(zone_arr),
    np.random.uniform(40.68, 40.78, N),
    np.random.uniform(-74.05, -73.93, N),
    np.random.uniform(0.1, 2.5, N),
    has_metro_arr, has_park_arr,
    np.sin(2*np.pi*hours_arr/24),
    np.cos(2*np.pi*hours_arr/24),
    np.sin(2*np.pi*dow_arr/7),
    np.cos(2*np.pi*dow_arr/7),
    np.sin(2*np.pi*(month_arr-1)/12),
    np.cos(2*np.pi*(month_arr-1)/12),
    is_weekend_arr, season_arr,
    is_raining_arr, is_event_arr,
    rush_arr, lunch_arr, night_arr,
    is_event_arr * is_weekend_arr,
    has_metro_arr * rush_arr,
    is_raining_arr * night_arr,
])

crowd_model = RandomForestRegressor(
    n_estimators=150,
    max_depth=10,
    min_samples_split=5,
    random_state=42,
    n_jobs=-1,
)
crowd_model.fit(X_crowd, y_crowd)

crowd_path = os.path.join(MODELS_DIR, "crowd_model.pkl")
with open(crowd_path, "wb") as f:
    pickle.dump(crowd_model, f)

encoder_path = os.path.join(MODELS_DIR, "zone_encoder.pkl")
with open(encoder_path, "wb") as f:
    pickle.dump(le, f)

with open(os.path.join(MODELS_DIR, "crowd_features.json"), "w") as f:
    json.dump(CROWD_FEATURES, f, indent=2)

print(f"   ✅ Saved → {crowd_path}")
print(f"   ✅ Saved → {encoder_path}")

# ══════════════════════════════════════════════════════════════════
# 3. SAVE METADATA
# ══════════════════════════════════════════════════════════════════
print("\n[3/3] Saving model metadata ...")

metadata = {
    "streetsmart_version": "1.0.0",
    "models": {
        "safety_model": {
            "file": "safety_model.pkl",
            "type": "RandomForestRegressor",
            "n_estimators": 150,
            "features": SAFETY_FEATURES,
            "output": "safety_score (20-99)",
            "description": "Predicts route safety score based on crime, lighting, crowd, and infrastructure"
        },
        "crowd_model": {
            "file": "crowd_model.pkl",
            "type": "RandomForestRegressor",
            "n_estimators": 150,
            "features": CROWD_FEATURES,
            "output": "crowd_density (0.0-1.0)",
            "description": "Predicts pedestrian crowd density by zone, hour, and day"
        },
        "zone_encoder": {
            "file": "zone_encoder.pkl",
            "type": "LabelEncoder",
            "classes": ZONE_TYPES,
            "description": "Encodes zone type strings to integers for ML models"
        }
    }
}

with open(os.path.join(MODELS_DIR, "metadata.json"), "w") as f:
    json.dump(metadata, f, indent=2)

print(f"   ✅ Saved → {os.path.join(MODELS_DIR, 'metadata.json')}")

print("\n" + "=" * 45)
print("✅ ALL MODELS GENERATED SUCCESSFULLY")
print("=" * 45)
print(f"\nFiles in {MODELS_DIR}:")
for fname in os.listdir(MODELS_DIR):
    fpath = os.path.join(MODELS_DIR, fname)
    size  = os.path.getsize(fpath)
    print(f"  {fname:<30} {size/1024:.1f} KB")
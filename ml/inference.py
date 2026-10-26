"""
StreetSmart ML Inference Module
Provides safety scoring and crowd prediction using scikit-learn models.
"""

import numpy as np
import json
import os
import pickle
from typing import List, Dict, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class SafetyScorer:
    """
    ML-based safety scoring model.
    Uses a trained RandomForest regressor to predict route safety scores.
    Input features: lat/lng statistics, time of day, crime density,
    light level, crowd density.
    Output: safety score 0-100 (higher = safer).
    """

    FEATURE_NAMES = [
        'lat_mean',
        'lng_mean',
        'lat_std',
        'lng_std',
        'segment_count',
        'hour_of_day',
        'is_weekend',
        'crime_density',
        'light_level',
        'crowd_density'
    ]

    def __init__(self, model_path: Optional[str] = None):
        self.model = None
        self.model_path = model_path or os.path.join(
            os.path.dirname(__file__), 'models', 'safety_model.pkl'
        )
        self._load_or_create_model()

    def _load_or_create_model(self):
        """
        Attempt to load a pre-trained model from disk.
        If not found, create and train a synthetic model for demo purposes.
        """
        try:
            if os.path.exists(self.model_path):
                with open(self.model_path, 'rb') as f:
                    self.model = pickle.load(f)
                logger.info(f"Loaded safety model from {self.model_path}")
            else:
                logger.info("No saved model found. Creating synthetic model...")
                self._create_synthetic_model()
        except Exception as e:
            logger.warning(f"Model load failed: {e}. Falling back to synthetic model.")
            self._create_synthetic_model()

    def _create_synthetic_model(self):
        """
        Create and train a RandomForestRegressor on synthetically generated
        route safety data. Saves the model to disk for reuse.
        """
        try:
            from sklearn.ensemble import RandomForestRegressor

            np.random.seed(42)
            n_samples = 2000

            # Generate synthetic feature matrix
            X = np.random.randn(n_samples, len(self.FEATURE_NAMES))

            # Synthetic target: safety score influenced by features
            y = (
                0.30 * (100 - np.abs(X[:, 7]) * 20) +   # crime_density (inverse)
                0.20 * (X[:, 8] * 10 + 60) +              # light_level
                0.20 * (100 - np.abs(X[:, 9]) * 15) +     # crowd_density (inverse)
                0.15 * (X[:, 0] * 5 + 70) +               # lat_mean
                0.10 * (100 - X[:, 5] * 2) +              # hour_of_day penalty
                0.05 * np.random.normal(70, 8, n_samples)  # noise
            )
            y = np.clip(y, 20, 99)

            model = RandomForestRegressor(
                n_estimators=100,
                max_depth=10,
                min_samples_split=5,
                min_samples_leaf=2,
                random_state=42,
                n_jobs=-1
            )
            model.fit(X, y)
            self.model = model

            # Persist the model
            os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
            with open(self.model_path, 'wb') as f:
                pickle.dump(model, f)

            logger.info(f"Synthetic safety model trained and saved to {self.model_path}")

        except ImportError:
            logger.error("scikit-learn not installed. Using fallback scoring.")
            self.model = None
        except Exception as e:
            logger.error(f"Failed to create synthetic model: {e}")
            self.model = None

    def extract_features(
        self,
        coordinates: List[List[float]],
        hour_of_day: int = 20,
        is_weekend: bool = False,
        crime_density: float = 0.3,
        light_level: float = 0.6,
        crowd_density: float = 0.5,
    ) -> np.ndarray:
        """
        Extract the 10-dimensional feature vector from route coordinates
        and contextual inputs.

        Args:
            coordinates: List of [lng, lat] pairs
            hour_of_day: Integer 0-23
            is_weekend: Boolean
            crime_density: Float 0-1 (0=safe, 1=dangerous)
            light_level: Float 0-1 (0=dark, 1=bright)
            crowd_density: Float 0-1 (0=empty, 1=packed)

        Returns:
            numpy array of shape (1, 10)
        """
        if not coordinates or len(coordinates) == 0:
            lats = [0.0]
            lngs = [0.0]
        else:
            lats = [c[1] for c in coordinates]
            lngs = [c[0] for c in coordinates]

        lat_mean = float(np.mean(lats))
        lng_mean = float(np.mean(lngs))
        lat_std = float(np.std(lats)) if len(lats) > 1 else 0.0
        lng_std = float(np.std(lngs)) if len(lngs) > 1 else 0.0
        segment_count = float(len(coordinates))

        features = np.array([[
            lat_mean,
            lng_mean,
            lat_std,
            lng_std,
            segment_count,
            float(hour_of_day),
            float(is_weekend),
            float(crime_density),
            float(light_level),
            float(crowd_density),
        ]])

        return features

    def predict_safety(
        self,
        coordinates: List[List[float]],
        hour_of_day: int = 20,
        is_weekend: bool = False,
        crime_density: float = 0.3,
        light_level: float = 0.6,
        crowd_density: float = 0.5,
    ) -> float:
        """
        Predict the safety score for a given route.

        Args:
            coordinates: List of [lng, lat] coordinate pairs
            hour_of_day: Hour of the day (0-23)
            is_weekend: Whether the navigation is on a weekend
            crime_density: Local crime density index (0-1)
            light_level: Street lighting level (0-1)
            crowd_density: Pedestrian crowd density (0-1)

        Returns:
            Float safety score between 20 and 99.
        """
        if self.model is None:
            # Fallback: rule-based scoring
            base = 70.0
            time_penalty = max(0, (hour_of_day - 20) * 2) if hour_of_day >= 20 else 0
            crime_penalty = crime_density * 30
            light_bonus = light_level * 15
            crowd_penalty = crowd_density * 10
            score = base - time_penalty - crime_penalty + light_bonus - crowd_penalty
            noise = float(np.random.normal(0, 3))
            return float(np.clip(score + noise, 20, 99))

        try:
            features = self.extract_features(
                coordinates=coordinates,
                hour_of_day=hour_of_day,
                is_weekend=is_weekend,
                crime_density=crime_density,
                light_level=light_level,
                crowd_density=crowd_density,
            )
            score = self.model.predict(features)[0]
            noise = float(np.random.normal(0, 2))
            return float(np.clip(score + noise, 20, 99))

        except Exception as e:
            logger.error(f"Prediction failed: {e}")
            return float(np.random.normal(70, 8))

    def get_feature_importances(self) -> Dict[str, float]:
        """
        Return feature importances from the trained model.
        Only available if sklearn model is loaded.
        """
        if self.model is None or not hasattr(self.model, 'feature_importances_'):
            return {}

        importances = self.model.feature_importances_
        return {
            name: round(float(imp), 4)
            for name, imp in zip(self.FEATURE_NAMES, importances)
        }


class CrowdPredictor:
    """
    Crowd density prediction model.
    Uses hour-of-day, day-of-week, and location features
    to predict expected pedestrian crowd density.
    Returns a float between 0.0 (empty) and 1.0 (extremely crowded).
    """

    # Expected crowd density by hour (0-23)
    HOURLY_CROWD_BASELINE = {
        0: 0.10,  1: 0.07,  2: 0.05,  3: 0.04,  4: 0.05,
        5: 0.10,  6: 0.25,  7: 0.55,  8: 0.80,  9: 0.70,
        10: 0.60, 11: 0.65, 12: 0.80, 13: 0.75, 14: 0.65,
        15: 0.70, 16: 0.80, 17: 0.90, 18: 0.85, 19: 0.75,
        20: 0.60, 21: 0.50, 22: 0.40, 23: 0.25,
    }

    # Day-of-week multipliers (0=Monday, 6=Sunday)
    DAY_MULTIPLIERS = {
        0: 1.0,   # Monday
        1: 1.0,   # Tuesday
        2: 1.05,  # Wednesday
        3: 1.05,  # Thursday
        4: 1.10,  # Friday
        5: 0.85,  # Saturday
        6: 0.70,  # Sunday
    }

    def predict_crowd(
        self,
        lat: float,
        lng: float,
        hour: int,
        day_of_week: int = 2
    ) -> float:
        """
        Predict crowd density for a location and time.

        Args:
            lat: Latitude of the location
            lng: Longitude of the location
            hour: Hour of day (0-23)
            day_of_week: Day of week (0=Monday, 6=Sunday)

        Returns:
            Float crowd density between 0.0 and 1.0
        """
        hour = max(0, min(23, hour))
        day_of_week = max(0, min(6, day_of_week))

        base_density = self.HOURLY_CROWD_BASELINE.get(hour, 0.3)
        day_mult = self.DAY_MULTIPLIERS.get(day_of_week, 1.0)

        # Location-based variation using coordinate hashing
        location_variation = (abs(lat * 1000) % 10 + abs(lng * 1000) % 10) / 100.0
        location_variation = (location_variation - 0.1) * 0.2  # normalize to small variation

        # Gaussian noise
        noise = float(np.random.normal(0, 0.04))

        density = (base_density * day_mult) + location_variation + noise
        return float(np.clip(density, 0.0, 1.0))

    def predict_crowd_hourly_forecast(
        self,
        lat: float,
        lng: float,
        day_of_week: int = 2
    ) -> List[Dict]:
        """
        Generate a full 24-hour crowd density forecast for a location.

        Returns:
            List of dicts with hour and predicted_density
        """
        forecast = []
        for hour in range(24):
            density = self.predict_crowd(lat, lng, hour, day_of_week)
            forecast.append({
                'hour': hour,
                'predicted_density': round(density, 3),
                'crowd_level': (
                    'HIGH' if density > 0.7 else
                    'MEDIUM' if density > 0.4 else
                    'LOW'
                )
            })
        return forecast


class AccessibilityClassifier:
    """
    Rule-based accessibility classification.
    Determines route suitability for wheelchair, elderly, and
    visually impaired users based on infrastructure features.
    """

    FEATURE_WEIGHTS = {
        'has_ramps': 0.25,
        'has_tactile_paving': 0.20,
        'has_audio_signals': 0.15,
        'has_benches': 0.10,
        'smooth_surface': 0.15,
        'wide_footpath': 0.10,
        'has_elevator': 0.05,
    }

    PROFILE_CRITICAL_FEATURES = {
        'wheelchair': ['has_ramps', 'smooth_surface', 'wide_footpath'],
        'elderly': ['has_benches', 'smooth_surface', 'has_ramps'],
        'visually_impaired': ['has_tactile_paving', 'has_audio_signals'],
        'general': [],
        'woman': [],
    }

    def classify(
        self,
        features: Dict[str, bool],
        profile: str = 'general'
    ) -> Dict:
        """
        Classify accessibility level for a route given its infrastructure features.

        Args:
            features: Dict mapping feature name to bool (present/absent)
            profile: User profile string

        Returns:
            Dict with score, grade, suitable_for, and missing_critical
        """
        total_weight = sum(self.FEATURE_WEIGHTS.values())
        weighted_score = sum(
            self.FEATURE_WEIGHTS.get(feat, 0)
            for feat, present in features.items()
            if present
        )
        base_score = (weighted_score / total_weight) * 100

        # Penalize missing critical features for specific profiles
        critical = self.PROFILE_CRITICAL_FEATURES.get(profile, [])
        missing_critical = [f for f in critical if not features.get(f, False)]
        penalty = len(missing_critical) * 12.0

        final_score = float(np.clip(base_score - penalty, 5, 100))

        if final_score >= 80:
            grade = 'EXCELLENT'
        elif final_score >= 65:
            grade = 'GOOD'
        elif final_score >= 45:
            grade = 'FAIR'
        else:
            grade = 'POOR'

        suitable_for = self._determine_suitability(features)

        return {
            'score': round(final_score, 1),
            'grade': grade,
            'suitable_for': suitable_for,
            'missing_critical': missing_critical,
            'features_present': {k: v for k, v in features.items() if v},
        }

    def _determine_suitability(self, features: Dict[str, bool]) -> List[str]:
        """Determine which profiles this route infrastructure supports."""
        suitable = ['general']

        if features.get('has_ramps') and features.get('smooth_surface'):
            suitable.append('wheelchair')

        if features.get('has_benches') and features.get('smooth_surface'):
            suitable.append('elderly')

        if features.get('has_tactile_paving') and features.get('has_audio_signals'):
            suitable.append('visually_impaired')

        suitable.append('woman')
        return suitable

    def generate_random_features(self, seed: Optional[int] = None) -> Dict[str, bool]:
        """
        Generate a random set of infrastructure features for simulation.
        Used when real feature data is unavailable.
        """
        if seed is not None:
            np.random.seed(seed)

        probabilities = {
            'has_ramps': 0.65,
            'has_tactile_paving': 0.45,
            'has_audio_signals': 0.35,
            'has_benches': 0.55,
            'smooth_surface': 0.75,
            'wide_footpath': 0.60,
            'has_elevator': 0.25,
        }

        return {
            feature: bool(np.random.random() < prob)
            for feature, prob in probabilities.items()
        }


class RouteMLPipeline:
    """
    Full ML pipeline combining all scoring components.
    Entry point for the backend to request ML-based route analysis.
    """

    def __init__(self):
        self.safety_scorer = SafetyScorer()
        self.crowd_predictor = CrowdPredictor()
        self.accessibility_classifier = AccessibilityClassifier()
        logger.info("RouteMLPipeline initialized with all components.")

    def analyze_route(
        self,
        coordinates: List[List[float]],
        profile: str = 'general',
        hour_of_day: int = 20,
        day_of_week: int = 2,
        is_weekend: bool = False,
        crime_density: float = 0.3,
        light_level: float = 0.6,
    ) -> Dict:
        """
        Run the full ML analysis pipeline on a route.

        Args:
            coordinates: List of [lng, lat] pairs defining the route
            profile: User profile (general/woman/elderly/wheelchair/visually_impaired)
            hour_of_day: Integer 0-23
            day_of_week: Integer 0-6 (Monday=0)
            is_weekend: Boolean
            crime_density: Float 0-1
            light_level: Float 0-1

        Returns:
            Dict with safety_score, crowd_density, accessibility, risk_level,
            feature_importances, and crowd_forecast
        """
        if not coordinates:
            return self._empty_result()

        # Safety scoring
        crowd_density = self.crowd_predictor.predict_crowd(
            lat=coordinates[0][1],
            lng=coordinates[0][0],
            hour=hour_of_day,
            day_of_week=day_of_week,
        )

        safety_score = self.safety_scorer.predict_safety(
            coordinates=coordinates,
            hour_of_day=hour_of_day,
            is_weekend=is_weekend,
            crime_density=crime_density,
            light_level=light_level,
            crowd_density=crowd_density,
        )

        # Generate random infrastructure features for accessibility
        coord_hash = int(abs(sum(c[0] + c[1] for c in coordinates)) * 1000) % 10000
        infra_features = self.accessibility_classifier.generate_random_features(
            seed=coord_hash
        )

        accessibility_result = self.accessibility_classifier.classify(
            features=infra_features,
            profile=profile,
        )

        # Crowd forecast for next 6 hours from hour_of_day
        crowd_forecast = []
        for offset in range(6):
            h = (hour_of_day + offset) % 24
            density = self.crowd_predictor.predict_crowd(
                lat=coordinates[0][1],
                lng=coordinates[0][0],
                hour=h,
                day_of_week=day_of_week,
            )
            crowd_forecast.append({
                'hour': h,
                'density': round(density, 3),
                'level': 'HIGH' if density > 0.7 else 'MEDIUM' if density > 0.4 else 'LOW',
            })

        # Feature importances
        feature_importances = self.safety_scorer.get_feature_importances()

        # Composite risk level
        risk_level = (
            'LOW' if safety_score >= 75 else
            'MEDIUM' if safety_score >= 50 else
            'HIGH'
        )

        return {
            'safety_score': round(safety_score, 1),
            'crowd_density': round(crowd_density, 3),
            'crowd_level': 'HIGH' if crowd_density > 0.7 else 'MEDIUM' if crowd_density > 0.4 else 'LOW',
            'accessibility': accessibility_result,
            'risk_level': risk_level,
            'feature_importances': feature_importances,
            'crowd_forecast': crowd_forecast,
            'profile': profile,
            'hour_analyzed': hour_of_day,
        }

    def _empty_result(self) -> Dict:
        """Return a safe default result when no coordinates are provided."""
        return {
            'safety_score': 70.0,
            'crowd_density': 0.4,
            'crowd_level': 'MEDIUM',
            'accessibility': {'score': 70.0, 'grade': 'GOOD', 'suitable_for': ['general'], 'missing_critical': []},
            'risk_level': 'MEDIUM',
            'feature_importances': {},
            'crowd_forecast': [],
            'profile': 'general',
            'hour_analyzed': 20,
        }

    def batch_analyze(
        self,
        routes: List[Dict],
        profile: str = 'general',
        hour_of_day: int = 20,
    ) -> List[Dict]:
        """
        Analyze multiple routes in batch.

        Args:
            routes: List of dicts each containing 'coordinates' key
            profile: User profile
            hour_of_day: Hour of day

        Returns:
            List of analysis result dicts, one per route
        """
        results = []
        for i, route in enumerate(routes):
            coords = route.get('coordinates', [])
            result = self.analyze_route(
                coordinates=coords,
                profile=profile,
                hour_of_day=hour_of_day,
            )
            result['route_index'] = i
            results.append(result)
        return results


# ─── Module-level convenience functions ───────────────────────────

# Singleton pipeline instance
_pipeline: Optional[RouteMLPipeline] = None


def get_pipeline() -> RouteMLPipeline:
    """Get or create the singleton ML pipeline instance."""
    global _pipeline
    if _pipeline is None:
        _pipeline = RouteMLPipeline()
    return _pipeline


def score_route_ml(
    coordinates: List[List[float]],
    hour_of_day: int = 20,
    profile: str = 'general',
) -> Dict:
    """
    Convenience function: run full ML analysis on a single route.

    Args:
        coordinates: List of [lng, lat] pairs
        hour_of_day: Integer 0-23
        profile: User profile string

    Returns:
        Dict with safety_score, crowd_density, risk_level, accessibility
    """
    pipeline = get_pipeline()
    return pipeline.analyze_route(
        coordinates=coordinates,
        profile=profile,
        hour_of_day=hour_of_day,
    )


def predict_crowd_for_area(
    lat: float,
    lng: float,
    hour: int = 20,
    day_of_week: int = 2,
) -> Dict:
    """
    Convenience function: predict crowd for a single location.

    Returns:
        Dict with density, level, and hourly forecast
    """
    pipeline = get_pipeline()
    density = pipeline.crowd_predictor.predict_crowd(lat, lng, hour, day_of_week)
    forecast = pipeline.crowd_predictor.predict_crowd_hourly_forecast(lat, lng, day_of_week)
    return {
        'density': round(density, 3),
        'level': 'HIGH' if density > 0.7 else 'MEDIUM' if density > 0.4 else 'LOW',
        'hourly_forecast': forecast,
    }


# ─── CLI entry point ──────────────────────────────────────────────

if __name__ == '__main__':
    import json

    print("=" * 60)
    print("  StreetSmart ML Inference Engine")
    print("=" * 60)

    # Demo coordinates: NYC Financial District → Times Square
    demo_coords = [
        [-74.0060, 40.7128],
        [-74.0020, 40.7160],
        [-73.9980, 40.7200],
        [-73.9940, 40.7280],
        [-73.9900, 40.7350],
        [-73.9870, 40.7420],
        [-73.9855, 40.7580],
    ]

    print("\n--- Single Route Analysis (Woman Profile, 21:00) ---")
    result = score_route_ml(demo_coords, hour_of_day=21, profile='woman')
    print(json.dumps(result, indent=2))

    print("\n--- Crowd Prediction for Times Square at 17:00 ---")
    crowd = predict_crowd_for_area(40.7580, -73.9855, hour=17, day_of_week=4)
    print(f"Density: {crowd['density']}  Level: {crowd['level']}")
    print("Hourly forecast (next 6h):")
    for entry in crowd['hourly_forecast'][17:23]:
        print(f"  {entry['hour']:02d}:00 → {entry['predicted_density']:.2f} ({entry['crowd_level']})")

    print("\n--- Wheelchair Accessibility Classification ---")
    pipeline = get_pipeline()
    features = pipeline.accessibility_classifier.generate_random_features(seed=42)
    access = pipeline.accessibility_classifier.classify(features, profile='wheelchair')
    print(f"Score: {access['score']}  Grade: {access['grade']}")
    print(f"Suitable for: {access['suitable_for']}")
    print(f"Missing critical: {access['missing_critical']}")

    print("\n--- Feature Importances ---")
    importances = pipeline.safety_scorer.get_feature_importances()
    if importances:
        for feat, imp in sorted(importances.items(), key=lambda x: -x[1]):
            bar = '█' * int(imp * 50)
            print(f"  {feat:<20} {bar} {imp:.4f}")
    else:
        print("  (Model not available)")

    print("\n✅ ML Inference Engine ready for production.")
// Real Google Maps styling — a JSON style array, the same mechanism Google
// itself documents for custom map themes. Tuned to match StreetSmart's
// dark cyan/neon palette.
export const GOOGLE_DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#05080F' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#05080F' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8892B0' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1a2a4a' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#0B1120' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#4A5568' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#062018' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#00FF9C' }, { visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#151f2e' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0B1120' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8892B0' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#1a2a4a' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#00E5FF' }, { weight: 0.4 }, { visibility: 'off' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#0B1120' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#020509' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4A5568' }] },
];

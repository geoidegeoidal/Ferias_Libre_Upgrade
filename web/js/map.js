/**
 * map.js — MapLibre GL map initialization, markers, clustering, and popups.
 */
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  getFilteredGeoJSON,
  onFilterChange,
  isOpenToday,
  getTodayName,
  getMaxPuestos,
} from './data.js';

// Re-export getFilteredGeoJSON for use in this module
const _getFilteredGeoJSON = getFilteredGeoJSON;

/** @type {maplibregl.Map | null} */
let map = null;

/** @type {maplibregl.Popup | null} */
let activePopup = null;

// Chile bounding box
const CHILE_BOUNDS = [[-76, -56], [-66, -17]];
const CHILE_CENTER = [-70.65, -33.45]; // Santiago
const INITIAL_ZOOM = 4;

// Day abbreviations for popup
const DAY_ABBR = {
  'Lunes': 'Lu', 'Martes': 'Ma', 'Miércoles': 'Mi', 'Jueves': 'Ju',
  'Viernes': 'Vi', 'Sábado': 'Sá', 'Domingo': 'Do',
};
const ALL_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/**
 * Initialize the map.
 * @param {Object} geojson - Full GeoJSON FeatureCollection
 * @returns {maplibregl.Map}
 */
export function initMap(geojson) {
  map = new maplibregl.Map({
    container: 'map',
    style: buildDarkStyle(),
    center: CHILE_CENTER,
    zoom: INITIAL_ZOOM,
    minZoom: 3,
    maxZoom: 18,
    attributionControl: false,
    maxBounds: [[-82, -60], [-60, -14]],
  });

  // Attribution (bottom-left, compact)
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

  map.on('load', () => {
    addDataLayers(geojson);
    setupInteractions();
    setupControls();

    // Subscribe to filter changes
    onFilterChange((filtered) => {
      updateMapData({
        type: 'FeatureCollection',
        features: filtered,
      });
    });
  });

  return map;
}

/** Get the map instance */
export function getMap() { return map; }

/**
 * Build a dark map style matching the Observatorio palette.
 */
function buildDarkStyle() {
  return {
    version: 8,
    name: 'Observatorio Dark',
    sources: {
      'carto-dark': {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        ],
        tileSize: 256,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: 'carto-dark-layer',
        type: 'raster',
        source: 'carto-dark',
        paint: {
          'raster-brightness-max': 0.85,
          'raster-saturation': -0.3,
        },
      },
    ],
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  };
}

/**
 * Add GeoJSON source and cluster/point layers.
 */
function addDataLayers(geojson) {
  // Source with clustering
  map.addSource('ferias', {
    type: 'geojson',
    data: geojson,
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 60,
    clusterProperties: {
      'has_open': ['any', ['get', 'is_open']],
    },
  });

  // Cluster circles
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'ferias',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': [
        'step',
        ['get', 'point_count'],
        'hsl(185, 70%, 50%)',   // < 10: cyan
        10, 'hsl(185, 60%, 45%)',  // 10-50
        50, 'hsl(200, 55%, 42%)',  // 50-100
        100, 'hsl(220, 50%, 45%)', // 100-200
        200, 'hsl(260, 45%, 55%)', // 200+: violet
      ],
      'circle-radius': [
        'step',
        ['get', 'point_count'],
        16,     // < 10
        10, 20, // 10-50
        50, 26, // 50-100
        100, 32, // 100-200
        200, 38, // 200+
      ],
      'circle-opacity': 0.85,
      'circle-stroke-width': 2,
      'circle-stroke-color': 'hsla(185, 80%, 55%, 0.25)',
    },
  });

  // Cluster count labels
  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'ferias',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-size': 12,
      'text-font': ['Noto Sans Bold'],
    },
    paint: {
      'text-color': '#ffffff',
    },
  });

  // Individual points — outer glow ring for open ferias
  map.addLayer({
    id: 'point-glow',
    type: 'circle',
    source: 'ferias',
    filter: ['all',
      ['!', ['has', 'point_count']],
      ['get', 'is_open']
    ],
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        6, 8,
        12, 14,
        16, 20,
      ],
      'circle-color': 'hsla(155, 65%, 50%, 0.15)',
      'circle-stroke-width': 0,
      'circle-opacity': 0.6,
    },
  });

  // Individual points — color based on open/closed status
  map.addLayer({
    id: 'unclustered-point',
    type: 'circle',
    source: 'ferias',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        6, 4,
        12, 7,
        16, 10,
      ],
      'circle-color': [
        'case',
        ['get', 'is_open'],
        'hsl(155, 65%, 50%)',  // Open: green
        'hsl(220, 10%, 40%)'    // Closed: gray
      ],
      'circle-opacity': 0.9,
      'circle-stroke-width': 2,
      'circle-stroke-color': [
        'case',
        ['get', 'is_open'],
        'hsla(155, 65%, 50%, 0.3)',
        'hsla(220, 10%, 40%, 0.2)'
      ],
    },
  });
}

/**
 * Update map data source with filtered features.
 */
function updateMapData(geojson) {
  const source = map?.getSource('ferias');
  if (source) {
    source.setData(geojson);
  }
}

/**
 * Set up click/hover interactions.
 */
function setupInteractions() {
  // Click on cluster → zoom in
  map.on('click', 'clusters', (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
    if (!features.length) return;

    const clusterId = features[0].properties.cluster_id;
    map.getSource('ferias').getClusterExpansionZoom(clusterId).then(zoom => {
      map.easeTo({
        center: features[0].geometry.coordinates,
        zoom: zoom + 0.5,
        duration: 500,
      });
    });
  });

  // Click on point → show popup
  map.on('click', 'unclustered-point', (e) => {
    if (!e.features?.length) return;
    const feature = e.features[0];
    showPopup(feature);
  });

  // Cursor pointer on interactive elements
  map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = ''; });
  map.on('mouseenter', 'unclustered-point', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'unclustered-point', () => { map.getCanvas().style.cursor = ''; });
}

/**
 * Show popup for a feature.
 */
export function showPopup(feature) {
  if (activePopup) activePopup.remove();

  const props = feature.properties;
  const coords = feature.geometry.coordinates.slice();

  // Parse dias if it's a string (from MapLibre serialization)
  let dias = props.dias;
  if (typeof dias === 'string') {
    try { dias = JSON.parse(dias); } catch { dias = []; }
  }

  const open = isOpenToday({ ...props, dias });
  const today = getTodayName();
  const maxPuestos = getMaxPuestos();

  // Build popup HTML
  const html = `
    <div class="popup">
      <div class="popup__header">
        <div class="popup__name">${escapeHtml(props.nombre)}</div>
        <span class="badge ${open ? 'badge--open' : 'badge--closed'}">
          ${open ? '<span class="badge__dot"></span> Abierta' : 'Cerrada'}
        </span>
      </div>

      <div class="popup__section">
        <svg class="popup__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
        <div>
          <div>${escapeHtml(props.comuna)}, ${escapeHtml(props.region)}</div>
          <div class="text-xs text-tertiary" style="margin-top: 2px">${escapeHtml(props.direccion || props.calle_principal || '')}</div>
        </div>
      </div>

      <div class="popup__days">
        ${ALL_DAYS.map(d => {
          const active = dias.includes(d);
          const isToday = d === today;
          return `<span class="popup__day${active ? ' is-active' : ''}${isToday ? ' is-today' : ''}">${DAY_ABBR[d]}</span>`;
        }).join('')}
      </div>

      <div class="popup__section">
        <svg class="popup__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <span>${escapeHtml(props.horario || 'Sin horario disponible')}</span>
      </div>

      ${props.num_puestos ? `
        <div class="popup__section">
          <svg class="popup__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
            <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"></path>
          </svg>
          <div style="flex: 1">
            <span>${props.num_puestos} puestos</span>
            <div class="popup__puestos-bar">
              <div class="popup__puestos-fill" style="width: ${Math.min(100, (props.num_puestos / maxPuestos) * 100).toFixed(1)}%"></div>
            </div>
          </div>
        </div>
      ` : ''}

      <div class="popup__footer">
        <a class="btn btn--ghost btn--sm" href="https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}" target="_blank" rel="noopener">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
          </svg>
          Cómo llegar
        </a>
        <a class="btn btn--ghost btn--sm" href="https://www.google.com/maps/search/?api=1&query=${coords[1]},${coords[0]}" target="_blank" rel="noopener">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          Google Maps
        </a>
      </div>
    </div>
  `;

  activePopup = new maplibregl.Popup({
    closeButton: true,
    closeOnClick: true,
    maxWidth: '360px',
    className: 'ferias-popup',
  })
    .setLngLat(coords)
    .setHTML(html)
    .addTo(map);
}

/**
 * Setup custom map controls.
 */
function setupControls() {
  // Zoom in
  document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
    map.zoomIn({ duration: 300 });
  });

  // Zoom out
  document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
    map.zoomOut({ duration: 300 });
  });

  // Fit Chile
  document.getElementById('btn-fit-chile')?.addEventListener('click', () => {
    flyToChile();
  });

  // Geolocation
  document.getElementById('btn-geolocate')?.addEventListener('click', () => {
    geolocate();
  });
}

/**
 * Fly to full Chile view.
 */
export function flyToChile() {
  map?.fitBounds(CHILE_BOUNDS, {
    padding: 40,
    duration: 1200,
  });
}

/**
 * Fly to a specific region or point.
 */
export function flyTo(lng, lat, zoom = 10) {
  map?.flyTo({
    center: [lng, lat],
    zoom,
    duration: 1200,
  });
}

/**
 * Fly to fit features in view.
 * @param {Object[]} features 
 */
export function fitToFeatures(features) {
  if (!features.length || !map) return;

  if (features.length === 1) {
    const coords = features[0].geometry.coordinates;
    flyTo(coords[0], coords[1], 15);
    return;
  }

  const bounds = new maplibregl.LngLatBounds();
  for (const f of features) {
    bounds.extend(f.geometry.coordinates);
  }
  map.fitBounds(bounds, {
    padding: 60,
    maxZoom: 15,
    duration: 1200,
  });
}

/**
 * Geolocate user with enhanced visual feedback.
 */
let geoMarker = null;
let geoAccuracyCircle = null;

function geolocate() {
  const btn = document.getElementById('btn-geolocate');
  if (!btn) return;

  if (!navigator.geolocation) {
    showGeoNotification('Tu navegador no soporta geolocalización.');
    return;
  }

  btn.classList.add('is-locating');

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      btn.classList.remove('is-locating');
      btn.classList.add('is-active');
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;

      // Remove previous markers
      if (geoMarker) geoMarker.remove();
      if (geoAccuracyCircle) {
        map.removeLayer('geo-accuracy');
        map.removeSource('geo-accuracy');
        geoAccuracyCircle = null;
      }

      // Add accuracy circle
      const accuracyKm = accuracy / 1000;
      map.addSource('geo-accuracy', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [lng, lat]
          },
          properties: {}
        }
      });
      map.addLayer({
        id: 'geo-accuracy',
        type: 'circle',
        source: 'geo-accuracy',
        paint: {
          'circle-radius': {
            stops: [[4, accuracyKm * 500], [10, accuracyKm * 100], [16, accuracyKm * 20]]
          },
          'circle-color': 'hsla(220, 90%, 60%, 0.08)',
          'circle-stroke-width': 1,
          'circle-stroke-color': 'hsla(220, 90%, 60%, 0.3)',
        }
      });
      geoAccuracyCircle = true;

      // Add user marker with pulse animation
      const el = document.createElement('div');
      el.className = 'user-location-marker';
      el.innerHTML = `
        <div class="user-location-marker__pulse"></div>
        <div class="user-location-marker__dot"></div>
      `;

      geoMarker = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(map);

      // Fly to location
      map.flyTo({
        center: [lng, lat],
        zoom: Math.max(13, Math.min(16, 16 - Math.log2(accuracy / 10))),
        duration: 1500,
      });

      // Find nearby ferias
      setTimeout(() => {
        showNearbyFerias(lng, lat);
      }, 1600);
    },
    (err) => {
      btn.classList.remove('is-locating');
      console.warn('Geolocation error:', err);
      let msg = 'No se pudo obtener tu ubicación.';
      switch (err.code) {
        case 1: msg = 'Permiso denegado. Activa la ubicación en tu navegador.'; break;
        case 2: msg = 'Posición no disponible. Intenta de nuevo.'; break;
        case 3: msg = 'Tiempo de espera agotado. Intenta de nuevo.'; break;
      }
      showGeoNotification(msg);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

/**
 * Show a non-intrusive notification for geolocation messages.
 */
function showGeoNotification(message) {
  let notif = document.getElementById('geo-notification');
  if (!notif) {
    notif = document.createElement('div');
    notif.id = 'geo-notification';
    notif.className = 'geo-notification';
    document.body.appendChild(notif);
  }
  notif.textContent = message;
  notif.classList.add('is-visible');
  setTimeout(() => {
    notif.classList.remove('is-visible');
  }, 4000);
}

/**
 * Show popup for nearby ferias after geolocation.
 */
function showNearbyFerias(lng, lat) {
  const features = _getFilteredGeoJSON().features;
  const nearby = features
    .map(f => ({
      feature: f,
      distance: Math.sqrt(
        Math.pow(f.geometry.coordinates[0] - lng, 2) +
        Math.pow(f.geometry.coordinates[1] - lat, 2)
      )
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);

  if (nearby.length > 0) {
    const notif = document.getElementById('geo-notification');
    if (notif) {
      const openCount = nearby.filter(n => n.feature.properties.is_open).length;
      notif.textContent = `${nearby.length} ferias cerca · ${openCount} abiertas hoy`;
      notif.classList.add('is-visible');
      setTimeout(() => notif.classList.remove('is-visible'), 5000);
    }
  }
}

/** Escape HTML */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Custom popup CSS (injected once)
const popupStyle = document.createElement('style');
popupStyle.textContent = `
  .ferias-popup .maplibregl-popup-content {
    background: var(--color-surface-2, hsl(220, 16%, 16%));
    border: 1px solid var(--border-default, hsla(220, 20%, 50%, 0.14));
    border-radius: var(--radius-lg, 14px);
    box-shadow: var(--shadow-xl, 0 16px 48px hsla(0, 0%, 0%, 0.6));
    padding: var(--sp-4, 16px);
    color: var(--text-primary, hsl(220, 15%, 93%));
    font-family: var(--font-body, 'DM Sans', sans-serif);
  }
  .ferias-popup .maplibregl-popup-close-button {
    color: var(--text-tertiary, hsl(220, 8%, 48%));
    font-size: 18px;
    padding: 4px 8px;
    right: 4px;
    top: 4px;
  }
  .ferias-popup .maplibregl-popup-close-button:hover {
    color: var(--text-primary, hsl(220, 15%, 93%));
    background: transparent;
  }
  .ferias-popup .maplibregl-popup-tip {
    border-top-color: var(--color-surface-2, hsl(220, 16%, 16%));
  }
`;
document.head.appendChild(popupStyle);

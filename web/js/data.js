/**
 * data.js — Data loader and state management for Ferias Chile.
 * 
 * Loads the pre-processed GeoJSON and stats, and exposes
 * filtering utilities for the map and UI.
 */

/** @type {import('geojson').FeatureCollection | null} */
let _geojson = null;

/** @type {Object | null} */
let _stats = null;

/** @type {Array} */
let _allFeatures = [];

// Current filter state
const _filters = {
  region: '',
  comuna: '',
  dias: [],       // active day filters (empty = all)
  searchText: '',
};

// Registered callbacks for filter changes
const _listeners = [];

// ---- Day helpers (defined before loadData for use during enrichment) ----

const DIAS_MAP = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
};

/**
 * Get today's day name in Spanish.
 * @returns {string}
 */
export function getTodayName() {
  return DIAS_MAP[new Date().getDay()];
}

/**
 * Check if a feria is open today.
 * @param {Object} properties - Feature properties
 * @returns {boolean}
 */
export function isOpenToday(properties) {
  const today = getTodayName();
  return properties.dias.includes(today);
}

/**
 * Load data files.
 * @returns {Promise<{geojson: Object, stats: Object}>}
 */
export async function loadData() {
  const [geojsonRes, statsRes] = await Promise.all([
    fetch('./ferias.json'),
    fetch('./stats.json'),
  ]);

  if (!geojsonRes.ok) throw new Error(`Failed to load ferias.json: ${geojsonRes.status}`);
  if (!statsRes.ok) throw new Error(`Failed to load stats.json: ${statsRes.status}`);

  _geojson = await geojsonRes.json();
  _stats = await statsRes.json();
  _allFeatures = _geojson.features;

  // Enrich features with computed properties
  const today = getTodayName();
  for (const f of _allFeatures) {
    const dias = f.properties.dias || [];
    f.properties.is_open = dias.includes(today);
  }

  return { geojson: _geojson, stats: _stats };
}

/** Get raw geojson */
export function getGeoJSON() { return _geojson; }

/** Get stats */
export function getStats() { return _stats; }

/** Get all features (unfiltered) */
export function getAllFeatures() { return _allFeatures; }

/**
 * Get unique sorted values for a property across all features.
 * @param {string} prop - Property name in feature.properties
 * @returns {string[]}
 */
export function getUniqueValues(prop) {
  const set = new Set();
  for (const f of _allFeatures) {
    const val = f.properties[prop];
    if (val) set.add(val);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'es'));
}

/**
 * Get comunas for a specific region.
 * @param {string} region
 * @returns {string[]}
 */
export function getComunasByRegion(region) {
  if (!region) return getUniqueValues('comuna');
  const set = new Set();
  for (const f of _allFeatures) {
    if (f.properties.region === region) {
      set.add(f.properties.comuna);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'es'));
}

/**
 * Get the ordered list of regions (north to south).
 * @returns {string[]}
 */
export function getRegionsOrdered() {
  if (_stats && _stats.regiones) {
    return _stats.regiones.map(r => r.region);
  }
  return getUniqueValues('region');
}

// ---- Filters ----

/** Get current filters */
export function getFilters() { return { ..._filters }; }

/** 
 * Update filters and notify listeners.
 * @param {Partial<typeof _filters>} updates 
 */
export function setFilters(updates) {
  Object.assign(_filters, updates);
  
  // If region changed, reset comuna
  if ('region' in updates && updates.region !== undefined) {
    if (_filters.comuna) {
      // Check if current comuna is in new region
      const comunas = getComunasByRegion(_filters.region);
      if (!comunas.includes(_filters.comuna)) {
        _filters.comuna = '';
      }
    }
  }

  _notifyListeners();
}

/** Reset all filters */
export function clearFilters() {
  _filters.region = '';
  _filters.comuna = '';
  _filters.dias = [];
  _filters.searchText = '';
  _notifyListeners();
}

/**
 * Get filtered features based on current filter state.
 * @returns {Object[]} Filtered GeoJSON features
 */
export function getFilteredFeatures() {
  let features = _allFeatures;

  // Region filter
  if (_filters.region) {
    features = features.filter(f => f.properties.region === _filters.region);
  }

  // Comuna filter
  if (_filters.comuna) {
    features = features.filter(f => f.properties.comuna === _filters.comuna);
  }

  // Day filter (show ferias that operate on ANY of the selected days)
  if (_filters.dias.length > 0) {
    features = features.filter(f => {
      const feriaDias = f.properties.dias;
      return _filters.dias.some(d => feriaDias.includes(d));
    });
  }

  // Search text filter
  if (_filters.searchText) {
    const q = _normalizeSearch(_filters.searchText);
    features = features.filter(f => {
      const p = f.properties;
      const haystack = _normalizeSearch(
        `${p.nombre} ${p.comuna} ${p.region} ${p.direccion} ${p.calle_principal}`
      );
      return haystack.includes(q);
    });
  }

  return features;
}

/**
 * Build a GeoJSON FeatureCollection from filtered features.
 * @returns {Object} GeoJSON FeatureCollection
 */
export function getFilteredGeoJSON() {
  return {
    type: 'FeatureCollection',
    features: getFilteredFeatures(),
  };
}

/**
 * Subscribe to filter changes.
 * @param {Function} callback
 * @returns {Function} Unsubscribe function
 */
export function onFilterChange(callback) {
  _listeners.push(callback);
  return () => {
    const idx = _listeners.indexOf(callback);
    if (idx >= 0) _listeners.splice(idx, 1);
  };
}

function _notifyListeners() {
  const filtered = getFilteredFeatures();
  for (const cb of _listeners) {
    try { cb(filtered, _filters); } catch (e) { console.error('Filter listener error:', e); }
  }
}

/**
 * Normalize string for search (remove accents, lowercase).
 * @param {string} str
 * @returns {string}
 */
function _normalizeSearch(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Get the maximum num_puestos across all features.
 * @returns {number}
 */
export function getMaxPuestos() {
  let max = 0;
  for (const f of _allFeatures) {
    const p = f.properties.num_puestos;
    if (p && p > max) max = p;
  }
  return max;
}

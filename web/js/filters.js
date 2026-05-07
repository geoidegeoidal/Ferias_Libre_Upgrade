/**
 * filters.js — Sidebar filter controls and UI wiring.
 */
import {
  getRegionsOrdered,
  getComunasByRegion,
  getFilters,
  setFilters,
  clearFilters,
  getFilteredFeatures,
  getAllFeatures,
  onFilterChange,
  getTodayName,
} from './data.js';
import { fitToFeatures, flyToChile } from './map.js';

// Region centroids (approximate, for fly-to on region select)
const REGION_CENTROIDS = {
  'Arica y Parinacota': [-70.0, -18.5],
  'Tarapacá': [-69.7, -20.2],
  'Antofagasta': [-69.6, -23.6],
  'Atacama': [-70.0, -27.4],
  'Coquimbo': [-71.0, -30.0],
  'Valparaíso': [-71.3, -33.0],
  'Metropolitana': [-70.65, -33.45],
  "O'Higgins": [-71.0, -34.2],
  'Maule': [-71.2, -35.4],
  'Ñuble': [-72.0, -36.6],
  'Biobío': [-72.7, -37.0],
  'La Araucanía': [-72.5, -38.7],
  'Los Ríos': [-72.6, -39.8],
  'Los Lagos': [-72.5, -41.5],
  'Aysén': [-72.5, -45.5],
  'Magallanes': [-71.0, -53.0],
};

/**
 * Initialize filter controls.
 */
export function initFilters() {
  populateRegions();
  populateComunas('');
  setupDayFilter();
  setupEventListeners();
  markTodayPill();

  // Subscribe to filter changes → update counts
  onFilterChange(updateFilterUI);

  // Initial UI
  updateFilterUI(getFilteredFeatures(), getFilters());
}

/** Populate region dropdown */
function populateRegions() {
  const select = document.getElementById('filter-region');
  if (!select) return;

  const regions = getRegionsOrdered();
  const allFeatures = getAllFeatures();

  // Count ferias per region
  const counts = {};
  for (const f of allFeatures) {
    const r = f.properties.region;
    counts[r] = (counts[r] || 0) + 1;
  }

  select.innerHTML = '<option value="">Todas las regiones</option>';
  for (const region of regions) {
    const opt = document.createElement('option');
    opt.value = region;
    opt.textContent = `${region} (${counts[region] || 0})`;
    select.appendChild(opt);
  }
}

/** Populate comuna dropdown based on selected region */
function populateComunas(region) {
  const select = document.getElementById('filter-comuna');
  if (!select) return;

  const comunas = getComunasByRegion(region);
  const allFeatures = getAllFeatures();

  // Count ferias per comuna (within region if filtered)
  const counts = {};
  for (const f of allFeatures) {
    if (region && f.properties.region !== region) continue;
    const c = f.properties.comuna;
    counts[c] = (counts[c] || 0) + 1;
  }

  select.innerHTML = '<option value="">Todas las comunas</option>';
  for (const comuna of comunas) {
    const opt = document.createElement('option');
    opt.value = comuna;
    opt.textContent = `${comuna} (${counts[comuna] || 0})`;
    select.appendChild(opt);
  }
}

/** Setup day filter pills */
function setupDayFilter() {
  const container = document.getElementById('day-filter');
  if (!container) return;

  container.addEventListener('click', (e) => {
    const pill = e.target.closest('.day-pill');
    if (!pill) return;

    pill.classList.toggle('is-active');

    // Collect active days
    const activeDays = [];
    container.querySelectorAll('.day-pill.is-active').forEach(p => {
      activeDays.push(p.dataset.day);
    });

    setFilters({ dias: activeDays });
  });
}

/** Mark today's pill with a dot */
function markTodayPill() {
  const today = getTodayName();
  const container = document.getElementById('day-filter');
  if (!container) return;

  container.querySelectorAll('.day-pill').forEach(pill => {
    if (pill.dataset.day === today) {
      pill.classList.add('is-today');
    }
  });
}

/** Setup event listeners for dropdowns and clear button */
function setupEventListeners() {
  // Region select
  const regionSelect = document.getElementById('filter-region');
  regionSelect?.addEventListener('change', (e) => {
    const region = e.target.value;
    setFilters({ region });
    populateComunas(region);

    // Fly to region or full Chile
    if (region && REGION_CENTROIDS[region]) {
      const [lng, lat] = REGION_CENTROIDS[region];
      const zoom = region === 'Metropolitana' ? 9 : 7;
      // Use fitToFeatures for better bounds
      const filtered = getFilteredFeatures();
      if (filtered.length > 0) {
        fitToFeatures(filtered);
      }
    } else {
      flyToChile();
    }
  });

  // Comuna select
  const comunaSelect = document.getElementById('filter-comuna');
  comunaSelect?.addEventListener('change', (e) => {
    setFilters({ comuna: e.target.value });

    // Fly to filtered features
    const filtered = getFilteredFeatures();
    if (filtered.length > 0) {
      fitToFeatures(filtered);
    }
  });

  // Clear filters
  document.getElementById('clear-filters')?.addEventListener('click', () => {
    clearFilters();

    // Reset UI
    if (regionSelect) regionSelect.value = '';
    if (comunaSelect) {
      comunaSelect.value = '';
      populateComunas('');
    }

    // Clear day pills
    document.querySelectorAll('.day-pill.is-active').forEach(p => p.classList.remove('is-active'));

    // Clear search
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.value = '';
      document.getElementById('search-container')?.classList.remove('has-value');
    }

    flyToChile();
  });
}

/**
 * Update filter UI elements (counts, badges).
 */
function updateFilterUI(filtered, filters) {
  const total = getAllFeatures().length;
  const count = filtered.length;

  // Result count
  const filteredEl = document.getElementById('filtered-count');
  const totalEl = document.getElementById('total-count');
  if (filteredEl) filteredEl.textContent = count.toLocaleString('es-CL');
  if (totalEl) totalEl.textContent = total.toLocaleString('es-CL');

  // Region count
  const regionCount = document.getElementById('region-count');
  if (regionCount && filters.region) {
    regionCount.textContent = `${count}`;
  } else if (regionCount) {
    regionCount.textContent = '';
  }

  // Update hero stats
  updateHeroStats(filtered);
}

/**
 * Update hero stat cards.
 */
function updateHeroStats(filtered) {
  const today = getTodayName();
  const openCount = filtered.filter(f => {
    let dias = f.properties.dias;
    if (typeof dias === 'string') {
      try { dias = JSON.parse(dias); } catch { dias = []; }
    }
    return dias.includes(today);
  }).length;

  const regions = new Set(filtered.map(f => f.properties.region));
  const comunas = new Set(filtered.map(f => f.properties.comuna));

  animateCounter('stat-total', filtered.length);
  animateCounter('stat-open', openCount);
  animateCounter('stat-regiones', regions.size);
  animateCounter('stat-comunas', comunas.size);
}

/**
 * Animate a counter from current to target value.
 */
function animateCounter(elementId, target) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const current = parseInt(el.textContent.replace(/\D/g, '')) || 0;
  if (current === target) return;

  const duration = 400;
  const startTime = performance.now();

  function step(timestamp) {
    const progress = Math.min((timestamp - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const value = Math.round(current + (target - current) * eased);
    el.textContent = value.toLocaleString('es-CL');

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

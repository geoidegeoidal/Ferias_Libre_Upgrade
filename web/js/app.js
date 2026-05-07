/**
 * app.js — Entry point for Ferias Chile.
 * 
 * Orchestrates data loading, map initialization, filters, and search.
 */
import { loadData, getGeoJSON } from './data.js';
import { initMap } from './map.js';
import { initFilters } from './filters.js';
import { initSearch } from './search.js';

async function main() {
  const loadingOverlay = document.getElementById('loading-overlay');

  try {
    // 1. Load data
    const { geojson, stats } = await loadData();
    console.log(`✅ Loaded ${geojson.metadata.total} ferias (${geojson.metadata.regiones} regiones, ${geojson.metadata.comunas} comunas)`);

    // 2. Initialize map
    const map = initMap(geojson);

    // 3. Initialize filters (after map is set up)
    map.on('load', () => {
      initFilters();
      initSearch();
      initMobileControls();
      initStatsToggle();

      // Hide loading overlay
      if (loadingOverlay) {
        loadingOverlay.classList.add('is-hidden');
        setTimeout(() => loadingOverlay.remove(), 600);
      }

      console.log('🗺️ Ferias Chile ready!');
    });

  } catch (error) {
    console.error('❌ Error initializing app:', error);
    if (loadingOverlay) {
      loadingOverlay.querySelector('.loading-text').textContent = 
        'Error al cargar datos. Recarga la página.';
      loadingOverlay.querySelector('.loading-spinner').style.display = 'none';
    }
  }
}

/**
 * Mobile sidebar toggle.
 */
function initMobileControls() {
  const toggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');

  if (!toggle || !sidebar) return;

  function openSidebar() {
    sidebar.classList.add('is-open');
    backdrop?.classList.add('is-visible');
  }

  function closeSidebar() {
    sidebar.classList.remove('is-open');
    backdrop?.classList.remove('is-visible');
  }

  toggle.addEventListener('click', () => {
    if (sidebar.classList.contains('is-open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  backdrop?.addEventListener('click', closeSidebar);
}

/**
 * Stats panel toggle.
 */
function initStatsToggle() {
  const btnStats = document.getElementById('btn-stats');
  const panel = document.getElementById('stats-panel');
  const btnClose = document.getElementById('btn-close-stats');

  if (!btnStats || !panel) return;

  btnStats.addEventListener('click', () => {
    const isOpen = panel.classList.contains('is-open');
    panel.classList.toggle('is-open', !isOpen);
    btnStats.classList.toggle('is-active', !isOpen);
  });

  btnClose?.addEventListener('click', () => {
    panel.classList.remove('is-open');
    btnStats?.classList.remove('is-active');
  });
}

// Boot
main();

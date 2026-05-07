/**
 * search.js — Fuzzy search with keyboard navigation and result highlighting.
 */
import {
  getAllFeatures,
  setFilters,
  getFilters,
} from './data.js';
import { flyTo, showPopup } from './map.js';

let _activeIndex = -1;
let _results = [];

/**
 * Initialize search functionality.
 */
export function initSearch() {
  const input = document.getElementById('search-input');
  const container = document.getElementById('search-container');
  const resultsEl = document.getElementById('search-results');
  const clearBtn = document.getElementById('search-clear');

  if (!input || !container || !resultsEl) return;

  // Input handler (debounced)
  let debounceTimer;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const value = input.value.trim();

    container.classList.toggle('has-value', value.length > 0);

    if (value.length < 2) {
      closeResults();
      setFilters({ searchText: '' });
      return;
    }

    debounceTimer = setTimeout(() => {
      _results = search(value);
      renderResults(_results, value);
      setFilters({ searchText: value });
    }, 200);
  });

  // Clear button
  clearBtn?.addEventListener('click', () => {
    input.value = '';
    container.classList.remove('has-value');
    closeResults();
    setFilters({ searchText: '' });
    input.focus();
  });

  // Keyboard navigation
  input.addEventListener('keydown', (e) => {
    if (!resultsEl.classList.contains('is-open')) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        _activeIndex = Math.min(_activeIndex + 1, _results.length - 1);
        highlightResult();
        break;
      case 'ArrowUp':
        e.preventDefault();
        _activeIndex = Math.max(_activeIndex - 1, 0);
        highlightResult();
        break;
      case 'Enter':
        e.preventDefault();
        if (_activeIndex >= 0 && _results[_activeIndex]) {
          selectResult(_results[_activeIndex]);
        }
        break;
      case 'Escape':
        closeResults();
        input.blur();
        break;
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      closeResults();
    }
  });

  // Focus re-opens results
  input.addEventListener('focus', () => {
    if (_results.length > 0 && input.value.trim().length >= 2) {
      document.getElementById('search-results')?.classList.add('is-open');
    }
  });
}

/**
 * Search features with fuzzy matching.
 * @param {string} query
 * @returns {Object[]} Top matching features
 */
function search(query) {
  const q = normalize(query);
  const features = getAllFeatures();
  const scored = [];

  for (const f of features) {
    const p = f.properties;
    const fields = [
      { text: p.nombre, weight: 3 },
      { text: p.comuna, weight: 2 },
      { text: p.region, weight: 1.5 },
      { text: p.direccion, weight: 1 },
      { text: p.calle_principal, weight: 1 },
    ];

    let bestScore = 0;
    for (const { text, weight } of fields) {
      if (!text) continue;
      const n = normalize(text);
      
      // Exact substring match
      if (n.includes(q)) {
        // Higher score for start-of-string matches
        const pos = n.indexOf(q);
        const posBonus = pos === 0 ? 2 : 1;
        bestScore = Math.max(bestScore, weight * posBonus * 10);
      }
      // Fuzzy: all query words present
      else {
        const words = q.split(/\s+/);
        const allPresent = words.every(w => n.includes(w));
        if (allPresent) {
          bestScore = Math.max(bestScore, weight * 5);
        }
      }
    }

    if (bestScore > 0) {
      scored.push({ feature: f, score: bestScore });
    }
  }

  // Sort by score descending, limit to 12
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 12).map(s => s.feature);
}

/**
 * Render search results dropdown.
 */
function renderResults(features, query) {
  const resultsEl = document.getElementById('search-results');
  if (!resultsEl) return;

  _activeIndex = -1;

  if (features.length === 0) {
    resultsEl.innerHTML = `
      <div class="search-result-item" style="color: var(--text-tertiary); cursor: default;">
        No se encontraron resultados para "${escapeHtml(query)}"
      </div>
    `;
    resultsEl.classList.add('is-open');
    return;
  }

  resultsEl.innerHTML = features.map((f, i) => {
    const p = f.properties;
    return `
      <div class="search-result-item" data-index="${i}" role="option">
        <div class="search-result-item__name">${highlightMatch(p.nombre, query)}</div>
        <div class="search-result-item__meta">${highlightMatch(p.comuna, query)}, ${p.region} · ${p.dias_texto || ''}</div>
      </div>
    `;
  }).join('');

  // Click handlers
  resultsEl.querySelectorAll('.search-result-item[data-index]').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.index);
      if (features[idx]) selectResult(features[idx]);
    });
  });

  resultsEl.classList.add('is-open');
}

/**
 * Highlight matching text in results.
 */
function highlightMatch(text, query) {
  if (!text) return '';
  const escaped = escapeHtml(text);
  const q = normalize(query);
  const n = normalize(text);
  const idx = n.indexOf(q);

  if (idx === -1) return escaped;

  // Find the corresponding position in the original string
  const before = escapeHtml(text.slice(0, idx));
  const match = escapeHtml(text.slice(idx, idx + query.length));
  const after = escapeHtml(text.slice(idx + query.length));

  return `${before}<mark>${match}</mark>${after}`;
}

/**
 * Highlight active result (keyboard nav).
 */
function highlightResult() {
  const resultsEl = document.getElementById('search-results');
  if (!resultsEl) return;

  resultsEl.querySelectorAll('.search-result-item').forEach((el, i) => {
    el.classList.toggle('is-active', i === _activeIndex);
    if (i === _activeIndex) {
      el.scrollIntoView({ block: 'nearest' });
    }
  });
}

/**
 * Select a search result.
 */
function selectResult(feature) {
  closeResults();

  const input = document.getElementById('search-input');
  if (input) {
    input.value = feature.properties.nombre;
    document.getElementById('search-container')?.classList.add('has-value');
  }

  // Fly to the feature
  const coords = feature.geometry.coordinates;
  flyTo(coords[0], coords[1], 16);

  // Show popup after fly animation
  setTimeout(() => {
    showPopup(feature);
  }, 1300);
}

/** Close search results dropdown */
function closeResults() {
  document.getElementById('search-results')?.classList.remove('is-open');
  _activeIndex = -1;
}

/** Normalize for search */
function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Escape HTML */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

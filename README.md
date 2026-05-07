# Ferias Libres Chile — Mapa Interactivo

> Una plataforma de datos abiertos para explorar las **1,764 ferias libres** de Chile. De un PowerBI embebido en WordPress a una experiencia de visualización de nivel mundial.

[![Deploy](https://img.shields.io/badge/deploy-GitHub%20Pages-222?logo=github)](https://geoidegeoidal.github.io/ferias-chile/)
[![Stack](https://img.shields.io/badge/stack-Vite%20%2B%20MapLibre%20%2B%20D3-2ecccc?logo=vite)](https://vitejs.dev/)
[![Datos](https://img.shields.io/badge/datos-ODEPA%20%2F%20DSpace-005a9c)](https://bibliotecadigital.odepa.gob.cl/)

---

## El Problema

La plataforma oficial de ODEPA para consultar ferias libres consiste en una página de WordPress que embebe un reporte de **PowerBI**. Esta experiencia tiene limitaciones importantes:

- **Rendimiento lento:** El iframe de PowerBI carga de forma pesada en dispositivos móviles.
- **Sin acceso offline:** No se puede consultar sin conexión a internet.
- **Sin geolocalización:** No hay forma de encontrar ferias cerca de tu ubicación.
- **Difícil de compartir:** No es una app web progresiva (PWA) ni tiene metadatos sociales.
- **Datos cerrados:** El Excel fuente está disponible en DSpace, pero no hay una API o consumo directo.

## La Solución

Transformamos los datos abiertos de ODEPA en una **aplicación web progresiva** con mapas interactivos, filtros avanzados, dashboard de estadísticas y soporte offline.

### Características

| Característica | Detalle |
|---|---|
| **Mapa Interactivo** | 1,764 ferias georreferenciadas con MapLibre GL JS, estilo dark "Observatorio". |
| **Estado en Tiempo Real** | Puntos verdes para ferias abiertas hoy, grises para cerradas. Glow visual para abiertas. |
| **Clustering Inteligente** | Agrupamiento automático con colores por densidad (cyan → violeta). |
| **Filtros Avanzados** | Por región, comuna, día de la semana, rango de puestos y búsqueda fuzzy. |
| **Búsqueda Fuzzy + Geocoding** | Multi-word highlighting en ferias locales + búsqueda de cualquier dirección de Chile vía Nominatim (OpenStreetMap). |
| **Dashboard de Estadísticas** | Heatmap semanal (Región × Día), ranking de comunas y treemap de regiones con D3.js. |
| **Geolocalización** | Encuentra tu ubicación, muestra ferias cercanas y calcula distancia. |
| **PWA + Offline** | Service Worker con cache de app shell, datos y tiles de mapa. Funciona sin conexión. |
| **Diseño Responsive** | Sidebar adaptable, controles táctiles, optimizado para móvil y desktop. |
| **SEO Completo** | Open Graph, Twitter Cards, JSON-LD, canonical tags, manifest.json. |
| **Mapa Claro / Oscuro** | Toggle instantáneo entre CartoDB Positron (claro) y Dark Matter (oscuro). Persiste preferencia. |
| **Tour Guiado** | Onboarding interactivo responsive para nuevos usuarios. Tooltips se reposicionan automáticamente si no caben en pantalla. Se reinicia desde "?". |
| **Ferias Cercanas** | Al buscar una dirección, el popup muestra las 3 ferias más cercanas con distancia en metros/km (Haversine). Click para volar a cada feria. |

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Bundler** | Vite 6 (Vanilla JS) |
| **Mapas** | MapLibre GL JS 4.7 + CartoDB Positron / Dark Matter |
| **Visualización** | D3.js 7 (tree-shakeable) |
| **Estilos** | CSS Vanilla con Custom Properties (Design System "Observatorio") |
| **Tipografía** | Sora (Display), DM Sans (Body), JetBrains Mono (Data) |
| **Datos** | GeoJSON estático generado desde Excel de ODEPA |
| **Deploy** | GitHub Pages (`docs/` folder) |

---

## Fuentes de Datos

| Fuente | Estado | Detalle |
|---|---|---|
| **ODEPA Biblioteca Digital (DSpace)** | Activo | Excel `Ferias_Pais_PowerBI.xlsx` — 2,535 registros (todas las regiones). |
| **ODEPA PowerBI** | Referencia | El reporte se alimenta del mismo Excel; no requiere scraping. |
| **Sercotec Catastro 2025** | No disponible | Sitios caídos (SSL expirado, 404). Script listo para cuando vuelvan. |

**Cobertura final:** 16 regiones, 284 comunas, 1,764 ferias únicas, 100% con coordenadas.

---

## Arquitectura del Frontend

```
web/
├── index.html              # App shell: CSP, SEO, JSON-LD, PWA meta tags
├── vite.config.js          # base: '/ferias-chile/', outDir: '../docs'
├── css/
│   ├── design-system.css   # Tokens, reset, tipografía
│   ├── layout.css          # Grid, sidebar, mapa, responsive
│   ├── components.css      # Botones, filtros, badges, popups, charts, onboarding
│   └── animations.css      # Keyframes, utilidades, reduced-motion
├── js/
│   ├── app.js              # Entry point, orquestación, registro de SW
│   ├── data.js             # Estado, filtros combinados, normalización
│   ├── map.js              # MapLibre, markers, clustering, popups, geolocalización
│   ├── filters.js          # UI de filtros (región, comuna, día, puestos, badges)
│   ├── search.js           # Búsqueda fuzzy con highlighting y keyboard nav
│   ├── stats.js            # D3.js: heatmap, ranking, treemap
│   └── onboarding.js       # Tour guiado interactivo (spotlight + tooltips)
└── public/                 # Copiado estático a docs/
    ├── data/
    │   ├── ferias.json     # GeoJSON (1,764 features)
    │   └── stats.json      # Estadísticas pre-computadas
    ├── icons/              # Iconos PNG 192/512 + maskable + OG image
    ├── manifest.json       # PWA manifest
    └── sw.js               # Service Worker (cache estático + tiles)
```

---

## Cómo Ejecutar

```bash
# 1. Instalar dependencias
cd web
npm install

# 2. Modo desarrollo
npm run dev

# 3. Build para producción (genera docs/)
npm run build
```

---

## Pipeline de Datos

```bash
# Extraer datos de ODEPA DSpace
python scripts/odepa_dspace.py

# Normalizar y generar CSV/JSON
python scripts/normalize.py

# Generar GeoJSON + stats.json para el frontend
python scripts/build_web_data.py
```

---

## Design System: Paleta "Observatorio"

Inspirada en dashboards premium como Kepler.gl.

- **Fondo:** Deep Black `hsl(225, 25%, 6%)`
- **Acento Primario:** Cyan Eléctrico `hsl(185, 80%, 55%)`
- **Acento Secundario:** Violeta `hsl(260, 50%, 65%)`
- **Acento Terciario:** Ámbar `hsl(38, 90%, 60%)`
- **Semánticos:** Verde Menta (Abierto) / Gris (Cerrado)

---

## Licencia

Los datos provienen de [ODEPA](https://www.odepa.gob.cl/) y están disponibles bajo sus términos de datos abiertos.
El código de este proyecto está bajo licencia MIT.

---

> Hecho con datos abiertos para vecinos curiosos.

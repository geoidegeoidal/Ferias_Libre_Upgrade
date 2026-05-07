# Ferias Libres Upgrade - Contexto del Proyecto

## Objetivo

Construir una mejor experiencia (UX/UI) para consultar ferias libres en Chile, empezando por rescatar y unificar los datos disponibles. La pagina oficial de ODEPA es un WordPress que embebe un PowerBI — queremos elevarlo.

## Repositorio

- **GitHub:** https://github.com/geoidegeoidal/Ferias_Libre_Upgrade
- **Local:** `C:\JULLOAR-CODE\sp\ferias_libres`
- **Stack Backend:** Python 3.14 + pandas + openpyxl + requests + playwright
- **Stack Frontend:** Vite + Vanilla JS + MapLibre GL JS + CSS Custom Properties

## Fuentes de datos investigadas

### 1. ODEPA Biblioteca Digital (DSpace) — **PRINCIPAL, FUNCIONANDO**
- **URL base:** `https://bibliotecadigital.odepa.gob.cl/`
- **API REST:** `https://bibliotecadigital.odepa.gob.cl/server/api/`
- **API de búsqueda:** `/server/api/discover/search/objects`
- **Estructura:** Items → Bundles (ORIGINAL) → Bitstreams → Content (descarga)
- **Archivos obtenidos:**
  - `Ferias_Pais_PowerBI.xlsx` (257 KB, 2,535 ferias, **todas las regiones**)
    - Handle: `20.500.12650/73143`, UUID: `96ab749f-6572-47b1-8f60-8867b2e72ea9`
  - `Ferias_2022.xlsx` (85 KB, 722 ferias, solo RM)
    - Handle: `20.500.12650/71922`, UUID: `cc192820-d9e0-410b-8ec2-b6116dcb81a7`
- **Schema del Excel:** REGION (código numérico 1-16), ID, Dia, NOMBRE, COMUNA, Calle_Principal, Calle_Inicio, Calle_Termino, Dias_de_Postura, HORARIO, NUM_PUESTO, Longitud, Latitud
- **Mapeo códigos región:** 1=Tarapacá, 2=Antofagasta, 3=Atacama, 4=Coquimbo, 5=Valparaíso, 6=O'Higgins, 7=Maule, 8=Biobío, 9=La Araucanía, 10=Los Lagos, 11=Aysén, 12=Magallanes, 13=Metropolitana, 14=Los Ríos, 15=Arica y Parinacota, 16=Ñuble

### 2. ODEPA PowerBI (Localizador Nacional)
- **Página WordPress:** `https://www.odepa.gob.cl/precios/consumidor/localizador-ferias-libres`
- **Página standalone:** `https://apps.odepa.gob.cl/powerBI/reporte_ferias_libres.html`
- **Reporte PowerBI ID:** `debi2816b-90fc-44d9-a201-74dce7dc5d80`
- **Workspace ID:** `33b7f707-6e6f-42d2-8d6f-98bff9fb5fa0`
- **Nota:** El reporte PowerBI se alimenta del archivo `Ferias_Pais_PowerBI.xlsx` que ya descargamos. No es necesario scrapearlo, aunque el script `powerbi_scraper.py` quedó listo por si se necesita en el futuro. Tiene un selector de región arriba a la izquierda y botón de exportar Excel al final del iframe.

### 3. Sercotec (Catastro Nacional de Ferias Libres 2025) — **NO DISPONIBLE**
- `https://catastroferiaslibres.cl` — certificado SSL expirado
- `https://explorador.sercotec.cl` — no responde
- `https://www.sercotec.cl/datos-abiertos` — 404
- El script `sercotec.py` intenta varias APIs sin éxito. Queda para cuando los sitios estén operativos.

### 4. WordPress ODEPA — **API bloqueada**
- `https://www.odepa.gob.cl/wp-json/` → 403 Forbidden en todos los endpoints
- La página es solo un contenedor del iframe de PowerBI

## Datos obtenidos (output)

| Archivo | Contenido | Filas |
|---|---|---|
| `data/ferias_libres.csv` | Todas las ferias (una fila por feria-día) | 3,257 |
| `data/ferias_libres_unicas.csv` | Ferias únicas (dedup por nombre+comuna+calle) | 1,764 |
| `data/ferias_libres.json` | Igual que el CSV completo, en JSON + metadata | 3,257 |

**Schema unificado de salida:**
```
nombre_feria, comuna, region, latitud, longitud, direccion,
calle_principal, calle_inicio, calle_termino, dias, horario,
num_puestos, fuente, archivo_origen, fecha_datos
```

**Cobertura:** 16 regiones, 284 comunas, 100% con coordenadas.

## Frontend (`/web`)

### Stack
- **Bundler:** Vite 6
- **Mapas:** MapLibre GL JS 4.7
- **Estilos:** CSS Vanilla con Custom Properties (Design System "Observatorio")
- **Fuentes:** Sora (Display), DM Sans (Body), JetBrains Mono (Data)
- **Deploy:** GitHub Pages (`docs/` folder)

### Estructura
```
web/
├── index.html              # App shell con CSP, SEO, JSON-LD
├── css/
│   ├── design-system.css   # Tokens, reset, tipografía
│   ├── layout.css          # Grid, sidebar, mapa, responsive
│   ├── components.css      # Botones, filtros, badges, popups
│   └── animations.css      # Keyframes, utilidades, reduced-motion
├── js/
│   ├── app.js              # Entry point, orquestación
│   ├── data.js             # Carga de datos, filtros, estado
│   ├── map.js              # MapLibre, markers, clustering, popups
│   ├── filters.js          # UI de filtros (región, comuna, día)
│   └── search.js           # Búsqueda fuzzy con highlighting
├── data/
│   ├── ferias.json         # GeoJSON FeatureCollection (1,764 ferias)
│   └── stats.json          # Estadísticas pre-computadas
└── package.json
```

### Fases implementadas

#### Fase 1: Mapa Interactivo ✅
- **Markers con color según estado:** Puntos verdes (`hsl(155, 65%, 50%)`) si la feria está abierta hoy, grises (`hsl(220, 10%, 40%)`) si está cerrada
- **Glow para abiertas:** Círculo difuso verde alrededor de ferias abiertas
- **Clustering optimizado:** `clusterRadius: 60` para mejor agrupamiento a nivel nacional (zoom 4-6)
- **Popups ricos:** Usan tokens del Design System, muestran badge abierto/cerrado, días de la semana con highlight del día actual, barra de puestos, botones a Google Maps
- **Geolocalización mejorada:** Marcador con animación de pulso, círculo de precisión, notificaciones no-intrusivas, muestra ferias cercanas

#### Fase 2: Filtros Avanzados (pendiente)
#### Fase 3: Dashboard de Estadísticas (pendiente)
#### Fase 4: Pulido, PWA y Deploy (pendiente)

### Design System: Paleta "Observatorio"
- **Fondo:** Deep Black `hsl(225, 25%, 6%)`
- **Acento Primario:** Cyan Eléctrico `hsl(185, 80%, 55%)`
- **Acento Secundario:** Violeta `hsl(260, 50%, 65%)`
- **Acento Terciario:** Ámbar `hsl(38, 90%, 60%)`
- **Semánticos:** Verde Menta (Abierto) / Gris (Cerrado)

## Scripts principales

### `scripts/odepa_dspace.py`
Scraper de la API DSpace de ODEPA. Descarga los Excel, parsea con pandas, mapea códigos de región a nombres, y genera `data/odepa_dspace_ferias.json`.

**A mejorar:**
- Actualmente busca solo 2 items hardcodeados por UUID. Idealmente debería buscar dinámicamente por `dc.title:"Ferias libres"` para encontrar nuevos archivos.
- El mapeo de columnas usa `unicodedata.normalize("NFKD")` para manejar acentos (ej: REGIÓN → region).

### `scripts/sercotec.py`
Intenta APIs REST de Sercotec. Todas fallaron (SSL/404/timeout). Tiene una lista de endpoints alternativos para probar. Quizás requiera scraping con Playwright.

### `scripts/powerbi_scraper.py`
Usa Playwright para cargar la página de PowerBI, detectar el iframe, buscar el selector de región y botón de exportar Excel. Toma screenshot y guarda el HTML del iframe para debug. **No se usó en producción** porque ya tenemos el Excel fuente.

### `scripts/normalize.py`
Unifica datos de múltiples fuentes (ODEPA, Sercotec, PowerBI) en un schema estándar:
- Normaliza nombres de región (mapa REGION_MAP)
- Valida coordenadas contra bounding box de Chile
- Construye dirección legible (calle_principal entre calle_inicio y calle_termino)
- Limpia num_puestos (extrae número de strings como "55 Puestos")
- Genera CSV (con BOM UTF-8) y JSON
- Genera versión deduplicada por ubicación

## Dependencias

### Backend
```
requests>=2.31.0
pandas>=2.1.0
openpyxl>=3.1.0
playwright>=1.40.0
tqdm>=4.66.0
```

### Frontend
```bash
cd web
npm install
npm run dev      # desarrollo
npm run build    # producción → docs/
```

Para instalar backend:
```bash
pip install -r requirements.txt
playwright install chromium
```

## Próximos pasos / Ideas

1. **Mejorar cobertura Sercotec:** Cuando los sitios vuelvan, los datos de Sercotec (catastro 2025) probablemente tienen más información (encuestas, georreferenciación más precisa, etc.)

2. **Actualización periódica:** La DSpace API tiene items con fecha de publicación. Se podría programar un cron que revise si hay nuevos archivos de ferias.

3. **Enriquecer datos:** Cruzar con otras fuentes (INE para población por comuna, datos de metro/metrotren para accesibilidad, etc.)

4. **Frontend Fase 2:** Filtros avanzados (slider de puestos, búsqueda con highlighting, filtros combinados complejos)

5. **Frontend Fase 3:** Dashboard de estadísticas con D3.js (heatmap semanal, ranking de comunas, treemap de regiones)

6. **Frontend Fase 4:** PWA con Service Worker, manifest.json, cache de tiles

7. **API propia:** Exponer los datos normalizados como una API REST para consumo de apps.

8. **PowerBI scraper funcional:** Si en el futuro se necesita, implementar la iteración por regiones usando `report.setFilters()` y `visual.exportData()` del PowerBI JS SDK via Playwright.

## Notas técnicas

- **Encoding:** Los archivos de ODEPA tienen problemas de encoding (acentos mal codificados). Se usa `unicodedata.normalize("NFKD")` para limpiar.
- **Códigos de región:** El Excel nacional usa números (1-16) para las regiones, no nombres. El mapeo está en `REGION_CODE_MAP` en `odepa_dspace.py`.
- **Duplicados:** La misma feria aparece múltiples veces si opera en varios días (ej: martes y sábado = 2 filas). Esto es intencional — cada fila representa un día de operación.
- **Bounding box Chile:** lat [-56, -17], lon [-76, -66] para validar coordenadas.
- **Git:** El `.gitignore` excluye archivos `.xlsx` y `.html` de data/. Los CSV y JSON finales sí se versionan.
- **CSP:** El `index.html` tiene un Content-Security-Policy estricto. Al añadir nuevos recursos externos, actualizar las directivas `script-src`, `style-src`, `img-src`, `connect-src` según corresponda.

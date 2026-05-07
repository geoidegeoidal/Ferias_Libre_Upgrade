# 🗺️ Ferias Libres Chile — Plan de Implementación

> Transformar la experiencia de consulta de ferias libres en Chile: de un PowerBI embebido en WordPress a una plataforma de datos abiertos con visualización de nivel mundial.

---

## 🚦 Estado del Proyecto

| Fase | Descripción | Estado | Responsable |
|---|---|---|---|
| **Fase 0** | Cimientos, Design System y Pipeline de Datos | ✅ Completado | Antigravity (Opus 4.6) |
| **Fase 1** | Mapa Interactivo (MapLibre) y Popups Ricos | ⏳ Pendiente | OpenCode (Kimi K2.6) |
| **Fase 2** | Filtros Avanzados y Búsqueda Fuzzy | ⏳ Pendiente | OpenCode (DeepSeek V4) |
| **Fase 3** | Dashboard de Estadísticas (D3.js) | ⏳ Pendiente | OpenCode (GLM 5.1) |
| **Fase 4** | Pulido, PWA y Deploy (GitHub Pages) | ⏳ Pendiente | Antigravity (Opus 4.6) |

---

## 🛠️ Stack Tecnológico

- **Bundler**: Vite (Vanilla JS)
- **Mapas**: MapLibre GL JS
- **Estilos**: CSS Vanilla con Variables (Paleta "Observatorio")
- **Fuentes**: Sora (Display), DM Sans (Body), JetBrains Mono (Data)
- **Datos**: GeoJSON estático generado desde CSV original
- **Deploy**: GitHub Pages (docs/ folder)

---

## 🎨 Design System: Paleta "Observatorio"

Inspirada en dashboards premium como Kepler.gl o Datawheel.

- **Fondo**: Deep Black `hsl(225, 25%, 6%)`
- **Acento Primario**: Cyan Eléctrico `hsl(185, 80%, 55%)` (Datos e interacción)
- **Acento Secundario**: Violeta `hsl(260, 50%, 65%)` (Categorías y stats)
- **Acento Terciario**: Ámbar `hsl(38, 90%, 60%)` (Alertas y estados)
- **Semánticos**: Verde Menta (Abierto) / Gris (Cerrado)

---

## 📋 Detalle de Fases (Instrucciones para Agentes)

### Fase 1: Mapa Interactivo (Próximo Paso)
**Objetivo**: Elevar la calidad visual y funcional del mapa.
- **Markers**: Implementar lógica para que el color del punto cambie según si la feria está abierta hoy.
- **Clustering**: Ajustar radios y colores de clusters para que sean legibles a nivel nacional (zoom 4-6).
- **Popups**: Asegurar que el diseño del popup en `map.js` use los tokens de `design-system.css`.
- **Geolocalización**: Mejorar el feedback visual cuando se busca la ubicación del usuario.

### Fase 2: Filtros y Búsqueda
**Objetivo**: Filtrado ultra-rápido y búsqueda tolerante a errores.
- **Lógica**: Refinar `data.js` para soportar filtros combinados complejos.
- **Search**: Implementar highlighting en los resultados de búsqueda.
- **Slider**: Añadir filtro por rango de "Número de Puestos".

### Fase 3: Dashboard de Estadísticas
**Objetivo**: Visualizar tendencias nacionales.
- **Componentes**: Crear `stats.js` usando D3.js.
- **Gráficos**: Heatmap semanal (Región vs Día), Ranking de Comunas, Treemap de Regiones.
- **Interactividad**: Al hacer click en un gráfico, el mapa debe filtrarse automáticamente.

### Fase 4: Deploy y PWA
**Objetivo**: Producción y offline.
- **Vite**: Configurar `vite.config.js` para el deploy en la carpeta `docs/`.
- **PWA**: Crear `manifest.json` y Service Worker básico para cache de tiles.
- **SEO**: Meta tags completos para Open Graph y Twitter Cards.

---

## 🚀 Cómo Ejecutar

1. Instalar dependencias:
   ```bash
   cd web
   npm install
   ```

2. Modo desarrollo:
   ```bash
   npm run dev
   ```

3. Generar datos (si el CSV cambia):
   ```bash
   python scripts/build_web_data.py
   ```

---

## 📌 Notas para OpenCode
- Mantener el código en `/web` organizado por módulos (`js/`, `css/`).
- No añadir frameworks (React/Vue) a menos que sea estrictamente necesario (el plan es Vanilla).
- Respetar el CSP definido en `index.html`.
- Usar `fitToFeatures` y `flyTo` del módulo `map.js` para transiciones suaves.

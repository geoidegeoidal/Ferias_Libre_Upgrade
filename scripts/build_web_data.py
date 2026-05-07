#!/usr/bin/env python3
"""
build_web_data.py — Genera datos optimizados para el visor web de Ferias Libres.

Lee data/ferias_libres_unicas.csv y produce:
  - web/data/ferias.json   → GeoJSON FeatureCollection para MapLibre
  - web/data/stats.json    → Estadísticas pre-calculadas para el dashboard

Uso:
    python scripts/build_web_data.py
"""

import csv
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data" / "ferias_libres_unicas.csv"
OUT_DIR = ROOT / "web" / "data"

# ---------------------------------------------------------------------------
# Día parsing
# ---------------------------------------------------------------------------
DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
DIAS_LOOKUP = {d.lower(): d for d in DIAS_SEMANA}

# Orden de regiones de norte a sur
REGIONES_ORDEN = [
    "Arica y Parinacota", "Tarapacá", "Antofagasta", "Atacama",
    "Coquimbo", "Valparaíso", "Metropolitana", "O'Higgins",
    "Maule", "Ñuble", "Biobío", "La Araucanía",
    "Los Ríos", "Los Lagos", "Aysén", "Magallanes",
]


def parse_dias(dias_raw: str) -> list[str]:
    """Extrae días individuales de la semana desde un string libre.
    
    Ejemplos:
        "Viernes, Sábado, Domingo y Festivos" → ["Viernes", "Sábado", "Domingo"]
        "Lunes a Viernes"                     → ["Lunes", "Martes", ..., "Viernes"]
        "Todos los días"                      → todos los 7 días
        "Miércoles"                           → ["Miércoles"]
    """
    if not dias_raw:
        return []

    text = dias_raw.strip().lower()

    # "todos los días" / "todos los dias"
    if "todos" in text:
        return list(DIAS_SEMANA)

    # "lunes a viernes" → rango
    rango_match = re.search(r"(\w+)\s+a\s+(\w+)", text)
    if rango_match:
        inicio = rango_match.group(1)
        fin = rango_match.group(2)
        idx_inicio = next((i for i, d in enumerate(DIAS_SEMANA) if d.lower().startswith(inicio[:3])), None)
        idx_fin = next((i for i, d in enumerate(DIAS_SEMANA) if d.lower().startswith(fin[:3])), None)
        if idx_inicio is not None and idx_fin is not None:
            if idx_inicio <= idx_fin:
                return DIAS_SEMANA[idx_inicio : idx_fin + 1]
            else:
                # wrap around (ej: "viernes a domingo")
                return DIAS_SEMANA[idx_inicio:] + DIAS_SEMANA[: idx_fin + 1]

    # Detección individual por token
    found = []
    for dia in DIAS_SEMANA:
        # Match parcial ("sáb" matches "sábado", "mié" matches "miércoles")
        if dia.lower()[:3] in text:
            found.append(dia)

    return found if found else []


def parse_num_puestos(raw: str) -> int | None:
    """Extrae número de puestos. '55.0' → 55, 'N/A' → None."""
    if not raw or not raw.strip():
        return None
    raw = raw.strip()
    # Intentar conversión directa (maneja "670.0", "55", etc.)
    try:
        val = int(float(raw))
        return val if val > 0 else None
    except (ValueError, TypeError):
        pass
    # Fallback: extraer primer grupo numérico de texto libre
    m = re.search(r"(\d+)", raw)
    if m:
        val = int(m.group(1))
        return val if val > 0 else None
    return None


def parse_horario(raw: str) -> dict:
    """Extrae apertura y cierre. '07:00 a 15:00 Hrs' → {apertura: '07:00', cierre: '15:00'}."""
    result = {"apertura": None, "cierre": None}
    if not raw:
        return result
    times = re.findall(r"(\d{1,2}:\d{2})", raw)
    if len(times) >= 2:
        result["apertura"] = times[0]
        result["cierre"] = times[1]
    elif len(times) == 1:
        result["apertura"] = times[0]
    return result


def build_geojson(rows: list[dict]) -> dict:
    """Construye GeoJSON FeatureCollection desde las filas del CSV."""
    features = []
    skipped = 0

    for i, row in enumerate(rows):
        lat = row.get("latitud", "").strip()
        lon = row.get("longitud", "").strip()

        # Validar coordenadas
        try:
            lat_f = float(lat)
            lon_f = float(lon)
        except (ValueError, TypeError):
            skipped += 1
            continue

        # Bounding box de Chile
        if not (-56 <= lat_f <= -17 and -76 <= lon_f <= -66):
            skipped += 1
            continue

        dias_raw = row.get("dias", "")
        dias_parsed = parse_dias(dias_raw)
        horario = parse_horario(row.get("horario", ""))
        num_puestos = parse_num_puestos(row.get("num_puestos", ""))

        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [round(lon_f, 6), round(lat_f, 6)],
            },
            "properties": {
                "id": i + 1,
                "nombre": row.get("nombre_feria", "").strip(),
                "comuna": row.get("comuna", "").strip(),
                "region": row.get("region", "").strip(),
                "direccion": row.get("direccion", "").strip(),
                "calle_principal": row.get("calle_principal", "").strip(),
                "dias": dias_parsed,
                "dias_texto": dias_raw.strip(),
                "horario": row.get("horario", "").strip(),
                "horario_apertura": horario["apertura"],
                "horario_cierre": horario["cierre"],
                "num_puestos": num_puestos,
            },
        }
        features.append(feature)

    if skipped:
        print(f"  ⚠ {skipped} ferias omitidas por coordenadas inválidas")

    regiones_set = {f["properties"]["region"] for f in features}
    comunas_set = {f["properties"]["comuna"] for f in features}

    geojson = {
        "type": "FeatureCollection",
        "metadata": {
            "total": len(features),
            "regiones": len(regiones_set),
            "comunas": len(comunas_set),
            "generado": datetime.now().strftime("%Y-%m-%d"),
            "fuente": "ODEPA — Biblioteca Digital (DSpace)",
        },
        "features": features,
    }

    return geojson


def build_stats(geojson: dict) -> dict:
    """Pre-calcula estadísticas para el dashboard."""
    features = geojson["features"]

    # Conteos por región
    region_count = Counter()
    # Conteos por comuna
    comuna_count = Counter()
    # Conteos por día
    dia_count = Counter()
    # Heatmap: región × día
    heatmap = defaultdict(lambda: defaultdict(int))
    # Total puestos
    total_puestos = 0
    ferias_con_puestos = 0
    # Horarios
    aperturas = []
    cierres = []

    for f in features:
        props = f["properties"]
        region = props["region"]
        comuna = props["comuna"]
        dias = props["dias"]
        puestos = props["num_puestos"]

        region_count[region] += 1
        comuna_count[comuna] += 1

        for dia in dias:
            dia_count[dia] += 1
            heatmap[region][dia] += 1

        if puestos and puestos > 0:
            total_puestos += puestos
            ferias_con_puestos += 1

        if props["horario_apertura"]:
            aperturas.append(props["horario_apertura"])
        if props["horario_cierre"]:
            cierres.append(props["horario_cierre"])

    # Ordenar regiones de norte a sur
    regiones_ordenadas = []
    for r in REGIONES_ORDEN:
        if r in region_count:
            regiones_ordenadas.append({"region": r, "total": region_count[r]})
    # Agregar cualquier región faltante
    for r, c in region_count.items():
        if r not in REGIONES_ORDEN:
            regiones_ordenadas.append({"region": r, "total": c})

    # Top 20 comunas
    top_comunas = [
        {"comuna": c, "total": n}
        for c, n in comuna_count.most_common(20)
    ]

    # Distribución por día
    dias_dist = [{"dia": d, "total": dia_count.get(d, 0)} for d in DIAS_SEMANA]

    # Heatmap matrix
    heatmap_data = []
    for region in REGIONES_ORDEN:
        if region in heatmap:
            row = {"region": region}
            for dia in DIAS_SEMANA:
                row[dia] = heatmap[region].get(dia, 0)
            heatmap_data.append(row)

    # Horario más común
    apertura_mode = Counter(aperturas).most_common(1)
    cierre_mode = Counter(cierres).most_common(1)

    stats = {
        "total_ferias": len(features),
        "total_regiones": geojson["metadata"]["regiones"],
        "total_comunas": geojson["metadata"]["comunas"],
        "total_puestos": total_puestos,
        "promedio_puestos": round(total_puestos / ferias_con_puestos) if ferias_con_puestos else 0,
        "horario_apertura_comun": apertura_mode[0][0] if apertura_mode else None,
        "horario_cierre_comun": cierre_mode[0][0] if cierre_mode else None,
        "regiones": regiones_ordenadas,
        "top_comunas": top_comunas,
        "dias_distribucion": dias_dist,
        "heatmap": heatmap_data,
        "generado": datetime.now().strftime("%Y-%m-%d"),
    }

    return stats


def main():
    print("🏗️  build_web_data.py — Generando datos para el visor web\n")

    if not CSV_PATH.exists():
        print(f"❌ No se encontró {CSV_PATH}")
        sys.exit(1)

    # Leer CSV
    print(f"📄 Leyendo {CSV_PATH.name}...")
    with open(CSV_PATH, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    print(f"  ✓ {len(rows)} ferias únicas leídas")

    # Construir GeoJSON
    print("\n🗺️  Construyendo GeoJSON...")
    geojson = build_geojson(rows)
    print(f"  ✓ {geojson['metadata']['total']} features generadas")
    print(f"  ✓ {geojson['metadata']['regiones']} regiones, {geojson['metadata']['comunas']} comunas")

    # Construir estadísticas
    print("\n📊 Calculando estadísticas...")
    stats = build_stats(geojson)
    print(f"  ✓ Total puestos: {stats['total_puestos']:,}")
    print(f"  ✓ Promedio puestos/feria: {stats['promedio_puestos']}")
    print(f"  ✓ Horario más común: {stats['horario_apertura_comun']} - {stats['horario_cierre_comun']}")

    # Escribir archivos
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    geojson_path = OUT_DIR / "ferias.json"
    with open(geojson_path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, separators=(",", ":"))
    size_kb = geojson_path.stat().st_size / 1024
    print(f"\n💾 {geojson_path.relative_to(ROOT)} ({size_kb:.0f} KB)")

    stats_path = OUT_DIR / "stats.json"
    with open(stats_path, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
    size_kb = stats_path.stat().st_size / 1024
    print(f"💾 {stats_path.relative_to(ROOT)} ({size_kb:.0f} KB)")

    print("\n✅ ¡Datos listos para el visor web!")


if __name__ == "__main__":
    main()

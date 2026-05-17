from __future__ import annotations

import argparse
import json
import math
import re
import unicodedata
from collections import defaultdict
from pathlib import Path
from typing import Any

import pandas as pd
import requests


GEOJSON_URL = (
    "https://raw.githubusercontent.com/openpolis/geojson-italy/master/"
    "geojson/limits_IT_municipalities.geojson"
)

SCORE_COL = "indice_7i_lavoro_pesato_copertura_base100"
RANK_COL = "rank_indice_7i_lavoro_pesato_copertura"

SUBRANKING_KEYS = {
    "Docente - media delta vs Italia": "docente",
    "Eduscopio universita - delta vs indirizzo": "eduscopio_uni",
    "Esiti lavoro - delta puro vs indirizzo": "lavoro_puro",
    "Esiti lavoro - delta pesato copertura": "lavoro_copertura",
    "Immatricolazione universitaria vs Stato": "immatricolazione",
    "Continuita universitaria vs Stato": "continuita",
    "Indice finale lavoro pesato copertura": "finale",
}


def normalize(value: Any) -> str:
    if value is None or pd.isna(value):
        return ""
    text = unicodedata.normalize("NFKD", str(value))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.upper().replace("’", "'").replace("`", "'")
    text = re.sub(r"[^A-Z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def slug(value: str) -> str:
    text = normalize(value).lower()
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


def finite(value: Any, digits: int = 2) -> float | int | None:
    if value is None or pd.isna(value):
        return None
    numeric = float(value)
    if not math.isfinite(numeric):
        return None
    rounded = round(numeric, digits)
    if digits == 0:
        return int(rounded)
    return rounded


def clean_text(value: Any) -> str | None:
    if value is None or pd.isna(value):
        return None
    return str(value)


def coordinate_pairs(value: Any) -> list[list[float]]:
    if (
        isinstance(value, list)
        and len(value) >= 2
        and isinstance(value[0], (int, float))
        and isinstance(value[1], (int, float))
    ):
        return [[float(value[0]), float(value[1])]]
    if isinstance(value, list):
        pairs: list[list[float]] = []
        for item in value:
            pairs.extend(coordinate_pairs(item))
        return pairs
    return []


def geometry_center(geometry: dict[str, Any]) -> list[float]:
    pairs = coordinate_pairs(geometry["coordinates"])
    if not pairs:
        raise ValueError("Geometry has no coordinate pairs.")
    xs = [pair[0] for pair in pairs]
    ys = [pair[1] for pair in pairs]
    return [round((min(xs) + max(xs)) / 2, 5), round((min(ys) + max(ys)) / 2, 5)]


def read_geojson(cache_path: Path, refresh: bool = False) -> dict[str, Any]:
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    if refresh or not cache_path.exists():
        response = requests.get(GEOJSON_URL, timeout=120)
        response.raise_for_status()
        cache_path.write_text(response.text, encoding="utf-8")
    return json.loads(cache_path.read_text(encoding="utf-8"))


def build_geo_indexes(geojson: dict[str, Any]) -> tuple[dict[tuple[str, str], dict], dict[tuple[str, str], list[dict]]]:
    by_city_province: dict[tuple[str, str], dict] = {}
    by_city_region: dict[tuple[str, str], list[dict]] = defaultdict(list)

    for feature in geojson["features"]:
        props = feature["properties"]
        by_city_province[(normalize(props["name"]), normalize(props["prov_name"]))] = feature
        by_city_region[(normalize(props["name"]), normalize(props["reg_name"]))].append(feature)

    return by_city_province, by_city_region


def match_feature(
    row: pd.Series,
    by_city_province: dict[tuple[str, str], dict],
    by_city_region: dict[tuple[str, str], list[dict]],
) -> dict | None:
    city = normalize(row["comune"])
    province = normalize(row["provincia"])
    region = normalize(row["regione"])

    direct = by_city_province.get((city, province))
    if direct is not None:
        return direct

    regional = by_city_region.get((city, region), [])
    if len(regional) == 1:
        return regional[0]

    return None


def build_subranking_lookup(path: Path, id_lookup: dict[str, str]) -> dict[str, dict[str, dict[str, float | int | None]]]:
    if not path.exists():
        return {}

    df = pd.read_csv(path)
    lookup: dict[str, dict[str, dict[str, float | int | None]]] = defaultdict(dict)
    for _, row in df.iterrows():
        subranking = SUBRANKING_KEYS.get(row["subranking"])
        if not subranking:
            continue
        comune_key = normalize(row["comune"])
        comune_id = id_lookup.get(comune_key)
        if not comune_id:
            continue
        lookup[comune_id][subranking] = {
            "rank": finite(row["rank"], 0),
            "value": finite(row["valore"], 2),
        }
    return lookup


def build_indirizzi(path: Path, id_lookup: dict[str, str]) -> dict[str, list[dict[str, Any]]]:
    if not path.exists():
        return {}

    df = pd.read_csv(path)
    records: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for _, row in df.iterrows():
        comune_id = id_lookup.get(normalize(row["comune"]))
        if not comune_id:
            continue
        records[comune_id].append(
            {
                "codice": clean_text(row.get("cod_scuola")),
                "scuola": clean_text(row.get("nome_scuola")),
                "indirizzo": clean_text(row.get("indirizzo_eduscopio")),
                "macro": clean_text(row.get("macro_indice")),
                "diplomati": finite(row.get("peso_diplomati"), 0),
                "uniScore": finite(row.get("uni_score"), 2),
                "uniDelta": finite(row.get("eduscopio_uni_rel_punti"), 2),
                "lavScore": finite(row.get("lav_score"), 2),
                "lavDelta": finite(row.get("eduscopio_lav_rel_punti"), 2),
                "immatricolazioneDeltaNaz": finite(row.get("immatricolazione_delta_naz_punti"), 2),
                "continuitaDeltaNaz": finite(row.get("continuita_uni_delta_naz_punti"), 2),
            }
        )

    for rows in records.values():
        rows.sort(key=lambda item: (item["scuola"] or "", item["indirizzo"] or ""))

    return dict(records)


def weighted_average(rows: list[dict[str, Any]], value_col: str, weight_col: str = "peso_diplomati") -> float | None:
    numerator = 0.0
    denominator = 0.0
    for row in rows:
        value = row.get(value_col)
        weight = row.get(weight_col)
        if value is None or pd.isna(value) or weight is None or pd.isna(weight):
            continue
        value_float = float(value)
        weight_float = float(weight)
        if not math.isfinite(value_float) or not math.isfinite(weight_float) or weight_float <= 0:
            continue
        numerator += value_float * weight_float
        denominator += weight_float
    if denominator == 0:
        return None
    return numerator / denominator


def build_absolute_lookup(path: Path, id_lookup: dict[str, str]) -> dict[str, dict[str, float | None]]:
    if not path.exists():
        return {}

    df = pd.read_csv(path)
    lookup: dict[str, dict[str, float | None]] = {}
    for comune, group in df.groupby("comune"):
        comune_id = id_lookup.get(normalize(comune))
        if not comune_id:
            continue
        rows = group.to_dict("records")
        lookup[comune_id] = {
            "uniScore": weighted_average(rows, "uni_score"),
            "lavoroScore": weighted_average(rows, "lav_score"),
            "immatricolazionePct": weighted_average(rows, "immatricolazione_scuola_pct"),
            "continuitaPct": weighted_average(rows, "non_abbandono_scuola_pct"),
            "abbandonoPct": weighted_average(rows, "abbandono_scuola_pct"),
        }
    return lookup


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--index", default="output/docente_eduscopio_indice_lavoro_copertura.csv")
    parser.add_argument("--subrankings", default="output/subranking_indicatori_comuni.csv")
    parser.add_argument("--indirizzi", default="output/docente_eduscopio_indirizzi_6i.csv")
    parser.add_argument("--geo-cache", default="output/cache_geo/limits_IT_municipalities.geojson")
    parser.add_argument("--site-data", default="site/data")
    parser.add_argument("--refresh-geo", action="store_true")
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args()

    site_data = Path(args.site_data)
    site_data.mkdir(parents=True, exist_ok=True)

    index = pd.read_csv(args.index)
    valid = index[index[SCORE_COL].notna()].copy()
    valid = valid.sort_values(RANK_COL, ascending=True)

    geojson = read_geojson(Path(args.geo_cache), refresh=args.refresh_geo)
    by_city_province, by_city_region = build_geo_indexes(geojson)

    id_lookup: dict[str, str] = {}
    display_lookup: dict[str, dict[str, str | None]] = {}
    matched_features: dict[str, dict] = {}
    missing_geo: list[dict[str, str]] = []

    for _, row in valid.iterrows():
        base_id = f"{slug(row['comune'])}-{slug(row['provincia'])}"
        id_lookup[normalize(row["comune"])] = base_id

        feature = match_feature(row, by_city_province, by_city_region)
        if feature is None:
            missing_geo.append(
                {
                    "comune": str(row["comune"]),
                    "provincia": str(row["provincia"]),
                    "regione": str(row["regione"]),
                }
            )
            display_lookup[base_id] = {
                "comune": str(row["comune"]).title(),
                "provincia": str(row["provincia"]).title(),
                "provinciaSigla": None,
                "regione": str(row["regione"]),
            }
            continue

        props = feature["properties"]
        display_lookup[base_id] = {
            "comune": props["name"],
            "provincia": props["prov_name"],
            "provinciaSigla": props.get("prov_acr"),
            "regione": props["reg_name"],
        }
        matched_features[base_id] = feature

    if args.strict and missing_geo:
        raise SystemExit(f"Missing municipal boundaries: {missing_geo}")

    subrankings = build_subranking_lookup(Path(args.subrankings), id_lookup)
    indirizzi = build_indirizzi(Path(args.indirizzi), id_lookup)
    absolute_lookup = build_absolute_lookup(Path(args.indirizzi), id_lookup)

    comuni: list[dict[str, Any]] = []
    point_collection: dict[str, Any] = {"type": "FeatureCollection", "features": []}

    for _, row in valid.iterrows():
        comune_id = f"{slug(row['comune'])}-{slug(row['provincia'])}"
        display = display_lookup[comune_id]
        absolute = absolute_lookup.get(comune_id, {})
        item = {
            "id": comune_id,
            "comune": display["comune"],
            "provincia": display["provincia"],
            "provinciaSigla": display["provinciaSigla"],
            "regione": display["regione"],
            "rank": finite(row[RANK_COL], 0),
            "indice": finite(row[SCORE_COL], 2),
            "indice6i": finite(row.get("indice_unico_6i_base100"), 2),
            "docente": finite(row.get("docente_delta_italia_punti"), 2),
            "eduscopioUni": finite(row.get("eduscopio_rel_punti_uni_only"), 2),
            "lavoroPuro": finite(row.get("eduscopio_rel_punti_lavoro_only"), 2),
            "lavoroCopertura": finite(row.get("esiti_lavoro_delta_pesato_copertura_punti"), 2),
            "immatricolazione": finite(row.get("immatricolazione_delta_naz_punti"), 2),
            "continuita": finite(row.get("continuita_uni_delta_naz_punti"), 2),
            "absolute": {
                "docentePct": finite(row.get("docente_media_superiori_pct"), 1),
                "uniScore": finite(absolute.get("uniScore"), 2),
                "lavoroScore": finite(absolute.get("lavoroScore"), 2),
                "immatricolazionePct": finite(absolute.get("immatricolazionePct"), 1),
                "continuitaPct": finite(absolute.get("continuitaPct"), 1),
                "abbandonoPct": finite(absolute.get("abbandonoPct"), 1),
            },
            "diplomati": finite(row.get("peso_diplomati_eduscopio"), 0),
            "indirizzi": finite(row.get("indirizzi_eduscopio"), 0),
            "coperturaLavoro": finite(row.get("quota_diplomati_con_esiti_lavoro_pct"), 2),
            "affidabilita": finite(row.get("indice_affidabilita_score"), 2),
            "macro": {
                "licei": {
                    "delta": finite(row.get("licei_universita_rel_punti"), 2),
                    "peso": finite(row.get("licei_universita_peso"), 0),
                    "score": finite(row.get("licei_universita_score_assoluto"), 2),
                },
                "tecnici": {
                    "delta": finite(row.get("tecnici_misto_rel_punti"), 2),
                    "peso": finite(row.get("tecnici_misto_peso"), 0),
                    "score": finite(row.get("tecnici_misto_score_assoluto"), 2),
                },
                "professionali": {
                    "delta": finite(row.get("professionali_lavoro_rel_punti"), 2),
                    "peso": finite(row.get("professionali_lavoro_peso"), 0),
                    "score": finite(row.get("professionali_lavoro_score_assoluto"), 2),
                },
            },
            "subrankings": subrankings.get(comune_id, {}),
        }
        comuni.append(item)

        feature = matched_features.get(comune_id)
        if feature is not None:
            point_collection["features"].append(
                {
                    "type": "Feature",
                    "properties": {
                        "id": comune_id,
                        "comune": item["comune"],
                        "provincia": item["provincia"],
                        "provinciaSigla": item["provinciaSigla"],
                        "regione": item["regione"],
                        "rank": item["rank"],
                        "indice": item["indice"],
                    },
                    "geometry": {
                        "type": "Point",
                        "coordinates": geometry_center(feature["geometry"]),
                    },
                }
            )

    regions = sorted({item["regione"] for item in comuni if item["regione"]})
    provinces_by_region: dict[str, list[str]] = defaultdict(list)
    for item in comuni:
        province = item["provincia"]
        region = item["regione"]
        if province not in provinces_by_region[region]:
            provinces_by_region[region].append(province)
    for values in provinces_by_region.values():
        values.sort()

    meta = {
        "title": "Indice Territoriale Scuole Superiori",
        "analysisDate": "2026-05-14",
        "generatedFrom": {
            "index": args.index,
            "subrankings": args.subrankings,
            "indirizzi": args.indirizzi,
            "boundaries": GEOJSON_URL,
        },
        "counts": {
            "rowsTotal": int(len(index)),
            "rowsWithFinalIndex": int(len(valid)),
            "municipalPoints": int(len(point_collection["features"])),
            "missingMunicipalBoundaries": len(missing_geo),
        },
        "missingMunicipalBoundaries": missing_geo,
        "regions": regions,
        "provincesByRegion": dict(provinces_by_region),
    }

    payload = {"meta": meta, "comuni": comuni}
    (site_data / "indice-comuni.json").write_text(
        json.dumps(payload, ensure_ascii=True, separators=(",", ":"), allow_nan=False),
        encoding="utf-8",
    )
    (site_data / "comuni-points.geojson").write_text(
        json.dumps(point_collection, ensure_ascii=True, separators=(",", ":"), allow_nan=False),
        encoding="utf-8",
    )
    (site_data / "indirizzi-comuni.json").write_text(
        json.dumps(indirizzi, ensure_ascii=True, separators=(",", ":"), allow_nan=False),
        encoding="utf-8",
    )

    print(
        "Site data OK: "
        f"{len(comuni)} comuni, "
        f"{len(point_collection['features'])} points, "
        f"{len(indirizzi)} comuni with school rows."
    )
    if missing_geo:
        print(f"Missing boundaries: {missing_geo}")


if __name__ == "__main__":
    main()

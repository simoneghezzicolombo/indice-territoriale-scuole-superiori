from __future__ import annotations

import argparse
import csv
import json
import math
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

import pandas as pd
import requests


BASE_URL = "https://eduscopio.it"
OUT_DIR = Path("output")
CACHE_DIR = OUT_DIR / "cache_eduscopio_fair"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; docente-eduscopio-fair-local-analysis/1.0; "
        "+https://eduscopio.it)"
    )
}

DOCENTE_ITALIA = {
    "italiano_ii_pct": 58.0,
    "matematica_ii_pct": 53.0,
    "italiano_v_pct": 52.0,
    "matematica_v_pct": 49.0,
}

DIPLOMI_UNI = {
    1: "Classico",
    2: "Scientifico",
    3: "Scientifico - Scienze applicate",
    4: "Scientifico - Sportivo",
    5: "Scienze Umane",
    6: "Scienze Umane - Economico sociale",
    7: "Linguistico",
    8: "Artistico",
    9: "Tecnico - Economico",
    10: "Tecnico - Tecnologico",
}

DIPLOMI_LAV = {
    9: "Tecnico - Economico",
    10: "Tecnico - Tecnologico",
    11: "Professionale - Servizi",
    12: "Professionale - Industria e Artigianato",
}


def normalize_name(value: str) -> str:
    value = str(value).upper().replace("'", " ")
    value = re.sub(r"[^A-Z0-9 ]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def slug(value: str) -> str:
    return normalize_name(value).lower().replace(" ", "_")


def as_float(value: Any) -> float | None:
    if value is None or pd.isna(value):
        return None
    try:
        return float(str(value).replace(",", "."))
    except ValueError:
        return None


def weighted_average(items: list[dict[str, Any]], value_key: str, weight_key: str) -> float | None:
    numerator = 0.0
    denominator = 0.0
    for item in items:
        value = as_float(item.get(value_key))
        weight = as_float(item.get(weight_key)) or 0.0
        if value is None or weight <= 0:
            continue
        numerator += value * weight
        denominator += weight
    if denominator <= 0:
        return None
    return round(numerator / denominator, 4)


def weighted_stats(items: list[dict[str, Any]], value_key: str, weight_key: str) -> tuple[float | None, float | None, float]:
    mean = weighted_average(items, value_key, weight_key)
    if mean is None:
        return None, None, 0.0
    weight_sum = 0.0
    variance_sum = 0.0
    for item in items:
        value = as_float(item.get(value_key))
        weight = as_float(item.get(weight_key)) or 0.0
        if value is None or weight <= 0:
            continue
        variance_sum += weight * (value - mean) ** 2
        weight_sum += weight
    std = math.sqrt(variance_sum / weight_sum) if weight_sum > 0 else None
    return round(mean, 4), round(std, 4) if std is not None else None, weight_sum


def clip(value: float, lower: float = 0.0, upper: float = 100.0) -> float:
    return min(upper, max(lower, value))


def std_population(values: list[float]) -> float | None:
    if not values:
        return None
    mean = sum(values) / len(values)
    return math.sqrt(sum((value - mean) ** 2 for value in values) / len(values))


def read_cache(path: Path) -> Any | None:
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def write_cache(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(HEADERS)
    response = session.post(
        f"{BASE_URL}/createProfile.json",
        json={"gender": "m", "role": "p", "name": "local-analysis", "q1": "o", "q2": "-"},
        headers={**HEADERS, "Referer": f"{BASE_URL}/"},
        timeout=30,
    )
    response.raise_for_status()
    return session


def get_place_id(session: requests.Session, comune: str, delay: float) -> int | None:
    path = CACHE_DIR / "place" / f"{slug(comune)}.json"
    cached = read_cache(path)
    if cached is None:
        if delay:
            time.sleep(delay)
        response = session.get(f"{BASE_URL}/placeHints/{comune}", timeout=30)
        response.raise_for_status()
        cached = response.json()
        write_cache(path, cached)
    names, ids = cached
    wanted = normalize_name(comune)
    for name, place_id in zip(names, ids):
        if normalize_name(name) == wanted:
            return int(place_id)
    return int(ids[0]) if ids else None


def fetch_eduscopio(
    session: requests.Session,
    comune: str,
    place_id: int,
    family: str,
    diploma_id: int,
    range_km: int,
    delay: float,
) -> list[dict[str, Any]]:
    path = CACHE_DIR / "queries" / f"{family}_{slug(comune)}_{place_id}_{range_km}_{diploma_id}.json"
    cached = read_cache(path)
    if cached is None:
        if delay:
            time.sleep(delay)
        if family == "uni":
            url = f"{BASE_URL}/searchSchools/{place_id}/{range_km}/{diploma_id}/1/false/null/null"
            referer = f"{BASE_URL}/percorso-genitori-scelta-scuola-superiore"
        else:
            url = f"{BASE_URL}/searchSchoolsLavoro/{place_id}/{range_km}/{diploma_id}/2/false/null/null/1"
            referer = f"{BASE_URL}/percorso-genitori-scelta-scuola-superiore-lavoro"
        response = session.get(url, headers={**HEADERS, "Referer": referer}, timeout=45)
        response.raise_for_status()
        cached = response.json()
        write_cache(path, cached)
    if not isinstance(cached, list) or len(cached) < 2 or not isinstance(cached[1], list):
        return []
    return cached[1]


def row_score(row: dict[str, Any], family: str) -> tuple[float | None, float]:
    weight = as_float(row.get("num_diplomati_x_coorte")) or 0.0
    if family == "uni":
        score = as_float(row.get("indice_composto"))
        return (score / 100 if score is not None else None), weight
    occupazione = as_float(row.get("ind1_tasso_occup"))
    coerenza = as_float(row.get("ind7_perc_coerente"))
    if occupazione is None or coerenza is None:
        return None, weight
    return round(0.65 * (occupazione / 100) + 0.35 * (coerenza / 100), 4), weight


def eduscopio_pct(row: dict[str, Any], key: str) -> float | None:
    value = as_float(row.get(key))
    return round(value / 100, 4) if value is not None else None


def uni_flow_fields(row: dict[str, Any]) -> dict[str, float | None]:
    return {
        "immatricolazione_scuola_pct": eduscopio_pct(row, "tasso_immatr_scuola"),
        "immatricolazione_regione_pct": eduscopio_pct(row, "tasso_immatr_reg_diploma"),
        "abbandono_scuola_pct": eduscopio_pct(row, "abbandono_scuola"),
        "abbandono_regione_pct": eduscopio_pct(row, "abbandono_reg_diploma"),
        "non_abbandono_scuola_pct": eduscopio_pct(row, "non_abbandono_scuola"),
        "non_abbandono_regione_pct": eduscopio_pct(row, "non_abbandono_reg_diploma"),
    }


def collect_rows_for_comune(
    session: requests.Session,
    comune: str,
    range_km: int,
    delay: float,
    only_target_comune: bool,
) -> list[dict[str, Any]]:
    place_id = get_place_id(session, comune, delay)
    if place_id is None:
        return []
    rows: list[dict[str, Any]] = []
    for diploma_id, diploma_name in DIPLOMI_UNI.items():
        for row in fetch_eduscopio(session, comune, place_id, "uni", diploma_id, range_km, delay):
            if only_target_comune and row.get("id_comune") != place_id:
                continue
            score, weight = row_score(row, "uni")
            rows.append(
                {
                    "source_comune": comune,
                    "source_place_id": place_id,
                    "family": "uni",
                    "id_diploma": diploma_id,
                    "indirizzo_eduscopio": diploma_name,
                    "cod_scuola": row.get("cod_scuola"),
                    "nome_scuola": row.get("nome_scuola"),
                    "comune_scuola": row.get("nome"),
                    "id_comune_scuola": row.get("id_comune"),
                    "num_diplomati_x_coorte": weight,
                    "score": score,
                    "uni_fga": score,
                    "lav_score": None,
                    **uni_flow_fields(row),
                }
            )
    for diploma_id, diploma_name in DIPLOMI_LAV.items():
        for row in fetch_eduscopio(session, comune, place_id, "lav", diploma_id, range_km, delay):
            if only_target_comune and row.get("id_comune") != place_id:
                continue
            score, weight = row_score(row, "lav")
            rows.append(
                {
                    "source_comune": comune,
                    "source_place_id": place_id,
                    "family": "lav",
                    "id_diploma": diploma_id,
                    "indirizzo_eduscopio": diploma_name,
                    "cod_scuola": row.get("cod_scuola"),
                    "nome_scuola": row.get("nome_scuola"),
                    "comune_scuola": row.get("nome"),
                    "id_comune_scuola": row.get("id_comune"),
                    "num_diplomati_x_coorte": weight,
                    "score": score,
                    "uni_fga": None,
                    "lav_score": score,
                    **uni_flow_fields(row),
                }
            )
    return rows


def build_benchmark(
    session: requests.Session,
    benchmark_comuni: list[str],
    range_km: int,
    workers: int,
    delay: float,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    all_rows: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(collect_rows_for_comune, session, comune, range_km, delay, False): comune
            for comune in benchmark_comuni
        }
        for index, future in enumerate(as_completed(futures), start=1):
            comune = futures[future]
            try:
                all_rows.extend(future.result())
            except Exception as exc:  # noqa: BLE001
                print(f"Errore benchmark {comune}: {exc!r}")
            if index % 50 == 0 or index == len(futures):
                print(f"Benchmark Eduscopio: {index}/{len(futures)} comuni")

    raw = pd.DataFrame(all_rows)
    if raw.empty:
        return raw, pd.DataFrame()

    raw = raw.dropna(subset=["score"])
    raw = raw[raw["num_diplomati_x_coorte"] > 0]
    raw = raw.drop_duplicates(subset=["family", "id_diploma", "cod_scuola", "id_comune_scuola"])

    stats_rows = []
    for (family, diploma_id), group in raw.groupby(["family", "id_diploma"]):
        items = group.to_dict("records")
        mean, std, weight = weighted_stats(items, "score", "num_diplomati_x_coorte")
        stats_rows.append(
            {
                "family": family,
                "id_diploma": diploma_id,
                "indirizzo_eduscopio": (
                    DIPLOMI_UNI.get(int(diploma_id)) if family == "uni" else DIPLOMI_LAV.get(int(diploma_id))
                ),
                "benchmark_score_medio": mean,
                "benchmark_score_std": std,
                "benchmark_peso_diplomati": round(weight, 2),
                "benchmark_righe": len(group),
            }
        )
    return raw, pd.DataFrame(stats_rows)


def target_indirizzi(
    session: requests.Session,
    target_comuni: list[str],
    range_km: int,
    delay: float,
    benchmarks: pd.DataFrame,
    flow_benchmarks_nazionali: dict[int, dict[str, float]],
) -> pd.DataFrame:
    bench = {
        (row["family"], int(row["id_diploma"])): row
        for row in benchmarks.to_dict("records")
    }
    all_rows: list[dict[str, Any]] = []
    for comune in target_comuni:
        raw_rows = collect_rows_for_comune(session, comune, range_km, delay, True)
        merged: dict[tuple[str, int], dict[str, Any]] = {}
        for row in raw_rows:
            key = (row["cod_scuola"], int(row["id_diploma"]))
            item = merged.setdefault(
                key,
                {
                    "comune": comune,
                    "cod_scuola": row["cod_scuola"],
                    "nome_scuola": row["nome_scuola"],
                    "id_diploma": int(row["id_diploma"]),
                    "indirizzo_eduscopio": row["indirizzo_eduscopio"],
                    "peso_diplomati": row["num_diplomati_x_coorte"],
                },
            )
            item["peso_diplomati"] = max(item.get("peso_diplomati") or 0, row["num_diplomati_x_coorte"] or 0)
            for flow_key in [
                "immatricolazione_scuola_pct",
                "immatricolazione_regione_pct",
                "abbandono_scuola_pct",
                "abbandono_regione_pct",
                "non_abbandono_scuola_pct",
                "non_abbandono_regione_pct",
            ]:
                if item.get(flow_key) is None and row.get(flow_key) is not None:
                    item[flow_key] = row.get(flow_key)
            if row["family"] == "uni":
                item["uni_score"] = row["score"]
            else:
                item["lav_score"] = row["score"]

        for item in merged.values():
            diploma_id = int(item["id_diploma"])
            parts: list[tuple[str, float]] = []
            if diploma_id <= 8 and item.get("uni_score") is not None:
                parts.append(("uni", 1.0))
                item["macro_indice"] = "licei_universita"
            elif diploma_id in (9, 10):
                if item.get("uni_score") is not None:
                    parts.append(("uni", 0.5 if item.get("lav_score") is not None else 1.0))
                if item.get("lav_score") is not None:
                    parts.append(("lav", 0.5 if item.get("uni_score") is not None else 1.0))
                item["macro_indice"] = "tecnici_misto"
            elif item.get("lav_score") is not None:
                parts.append(("lav", 1.0))
                item["macro_indice"] = "professionali_lavoro"

            rel_points = 0.0
            rel_z = 0.0
            score_abs = 0.0
            used_weight = 0.0
            for family, part_weight in parts:
                score = as_float(item.get(f"{family}_score"))
                base = bench.get((family, diploma_id))
                if score is None or not base:
                    continue
                mean = as_float(base.get("benchmark_score_medio"))
                std = as_float(base.get("benchmark_score_std"))
                if mean is None:
                    continue
                family_rel_points = score - mean
                item[f"eduscopio_{family}_rel_punti"] = round(family_rel_points, 4)
                rel_points += part_weight * family_rel_points
                if std and std > 0:
                    family_rel_z = family_rel_points / std
                    item[f"eduscopio_{family}_rel_z"] = round(family_rel_z, 4)
                    rel_z += part_weight * family_rel_z
                score_abs += part_weight * score
                used_weight += part_weight
            if used_weight > 0:
                item["eduscopio_score_assoluto"] = round(score_abs / used_weight, 4)
                item["eduscopio_rel_punti_indirizzo"] = round(rel_points / used_weight, 4)
                item["eduscopio_rel_z_indirizzo"] = round(rel_z / used_weight, 4)
            else:
                item["eduscopio_score_assoluto"] = None
                item["eduscopio_rel_punti_indirizzo"] = None
                item["eduscopio_rel_z_indirizzo"] = None

            imm_scuola = as_float(item.get("immatricolazione_scuola_pct"))
            imm_regione = as_float(item.get("immatricolazione_regione_pct"))
            abb_scuola = as_float(item.get("abbandono_scuola_pct"))
            abb_regione = as_float(item.get("abbandono_regione_pct"))
            non_abb_scuola = as_float(item.get("non_abbandono_scuola_pct"))
            non_abb_regione = as_float(item.get("non_abbandono_regione_pct"))
            item["immatricolazione_delta_reg_punti"] = (
                round(imm_scuola - imm_regione, 4)
                if imm_scuola is not None and imm_regione is not None
                else None
            )
            item["abbandono_delta_reg_punti"] = (
                round(abb_regione - abb_scuola, 4)
                if abb_scuola is not None and abb_regione is not None
                else None
            )
            item["continuita_uni_delta_reg_punti"] = (
                round(non_abb_scuola - non_abb_regione, 4)
                if non_abb_scuola is not None and non_abb_regione is not None
                else None
            )
            flow_nazionale = flow_benchmarks_nazionali.get(diploma_id, {})
            imm_nazione = as_float(flow_nazionale.get("immatricolazione_nazione_pct"))
            abb_nazione = as_float(flow_nazionale.get("abbandono_nazione_pct"))
            non_abb_nazione = as_float(flow_nazionale.get("non_abbandono_nazione_pct"))
            item["immatricolazione_delta_naz_punti"] = (
                round(imm_scuola - imm_nazione, 4)
                if imm_scuola is not None and imm_nazione is not None
                else None
            )
            item["abbandono_delta_naz_punti"] = (
                round(abb_nazione - abb_scuola, 4)
                if abb_scuola is not None and abb_nazione is not None
                else None
            )
            item["continuita_uni_delta_naz_punti"] = (
                round(non_abb_scuola - non_abb_nazione, 4)
                if non_abb_scuola is not None and non_abb_nazione is not None
                else None
            )
            all_rows.append(item)
    return pd.DataFrame(all_rows)


def build_flow_benchmarks_nazionali(raw_benchmark: pd.DataFrame) -> pd.DataFrame:
    if raw_benchmark.empty:
        return pd.DataFrame()
    rows = raw_benchmark.dropna(subset=["non_abbandono_scuola_pct"]).copy()
    rows = rows[rows["num_diplomati_x_coorte"] > 0]
    rows = rows.drop_duplicates(subset=["id_diploma", "cod_scuola", "id_comune_scuola"])

    output = []
    for diploma_id, group in rows.groupby("id_diploma"):
        items = group.to_dict("records")
        output.append(
            {
                "id_diploma": int(diploma_id),
                "indirizzo_eduscopio": DIPLOMI_UNI.get(int(diploma_id), DIPLOMI_LAV.get(int(diploma_id))),
                "immatricolazione_nazione_pct": weighted_average(
                    items, "immatricolazione_scuola_pct", "num_diplomati_x_coorte"
                ),
                "abbandono_nazione_pct": weighted_average(
                    items, "abbandono_scuola_pct", "num_diplomati_x_coorte"
                ),
                "non_abbandono_nazione_pct": weighted_average(
                    items, "non_abbandono_scuola_pct", "num_diplomati_x_coorte"
                ),
                "benchmark_peso_diplomati": round(
                    sum(as_float(item.get("num_diplomati_x_coorte")) or 0 for item in items), 2
                ),
                "benchmark_righe": len(group),
            }
        )
    return pd.DataFrame(output)


def docente_delta(row: dict[str, Any]) -> float | None:
    values = []
    for key, base in DOCENTE_ITALIA.items():
        value = as_float(row.get(key))
        if value is None:
            return None
        values.append(value - base)
    return round(sum(values) / len(values), 4)


def aggregate_indices(target_rows: pd.DataFrame, docente: pd.DataFrame) -> pd.DataFrame:
    docente_rows = {row["comune"]: row for row in docente.to_dict("records")}
    output = []
    for comune, group in target_rows.groupby("comune"):
        items = group.to_dict("records")
        docente_row = docente_rows[comune]
        indicatore_italiano_ii = as_float(docente_row.get("italiano_ii_pct"))
        indicatore_matematica_ii = as_float(docente_row.get("matematica_ii_pct"))
        indicatore_italiano_v = as_float(docente_row.get("italiano_v_pct"))
        indicatore_matematica_v = as_float(docente_row.get("matematica_v_pct"))
        row = {
            "comune": comune,
            "provincia": docente_row.get("provincia"),
            "regione": docente_row.get("regione"),
            "docente_media_superiori_pct": as_float(docente_row.get("media_superiori_pct")),
            "docente_delta_italia_punti": docente_delta(docente_row),
            "indicatore_1_italiano_ii_delta_italia": (
                round(indicatore_italiano_ii - DOCENTE_ITALIA["italiano_ii_pct"], 4)
                if indicatore_italiano_ii is not None
                else None
            ),
            "indicatore_2_matematica_ii_delta_italia": (
                round(indicatore_matematica_ii - DOCENTE_ITALIA["matematica_ii_pct"], 4)
                if indicatore_matematica_ii is not None
                else None
            ),
            "indicatore_3_italiano_v_delta_italia": (
                round(indicatore_italiano_v - DOCENTE_ITALIA["italiano_v_pct"], 4)
                if indicatore_italiano_v is not None
                else None
            ),
            "indicatore_4_matematica_v_delta_italia": (
                round(indicatore_matematica_v - DOCENTE_ITALIA["matematica_v_pct"], 4)
                if indicatore_matematica_v is not None
                else None
            ),
            "eduscopio_rel_punti_indirizzo": weighted_average(items, "eduscopio_rel_punti_indirizzo", "peso_diplomati"),
            "eduscopio_rel_punti_uni_only": weighted_average(items, "eduscopio_uni_rel_punti", "peso_diplomati"),
            "eduscopio_rel_punti_lavoro_only": weighted_average(items, "eduscopio_lav_rel_punti", "peso_diplomati"),
            "eduscopio_rel_z_indirizzo": weighted_average(items, "eduscopio_rel_z_indirizzo", "peso_diplomati"),
            "eduscopio_score_assoluto_pesato": weighted_average(items, "eduscopio_score_assoluto", "peso_diplomati"),
            "immatricolazione_delta_reg_punti": weighted_average(items, "immatricolazione_delta_reg_punti", "peso_diplomati"),
            "abbandono_delta_reg_punti": weighted_average(items, "abbandono_delta_reg_punti", "peso_diplomati"),
            "continuita_uni_delta_reg_punti": weighted_average(items, "continuita_uni_delta_reg_punti", "peso_diplomati"),
            "immatricolazione_delta_naz_punti": weighted_average(items, "immatricolazione_delta_naz_punti", "peso_diplomati"),
            "abbandono_delta_naz_punti": weighted_average(items, "abbandono_delta_naz_punti", "peso_diplomati"),
            "continuita_uni_delta_naz_punti": weighted_average(items, "continuita_uni_delta_naz_punti", "peso_diplomati"),
            "peso_diplomati_eduscopio": round(sum(as_float(item.get("peso_diplomati")) or 0 for item in items), 2),
            "indirizzi_eduscopio": len(items),
        }
        peso_lavoro = sum(
            as_float(item.get("peso_diplomati")) or 0
            for item in items
            if as_float(item.get("eduscopio_lav_rel_punti")) is not None
        )
        peso_totale_eduscopio = as_float(row["peso_diplomati_eduscopio"]) or 0.0
        row["peso_diplomati_con_esiti_lavoro"] = round(peso_lavoro, 2)
        row["quota_diplomati_con_esiti_lavoro_pct"] = (
            round(100 * peso_lavoro / peso_totale_eduscopio, 2)
            if peso_totale_eduscopio > 0
            else None
        )
        uni_only = as_float(row["eduscopio_rel_punti_uni_only"])
        current_edu = as_float(row["eduscopio_rel_punti_indirizzo"])
        row["effetto_esiti_lavoro_su_eduscopio_punti"] = (
            round(current_edu - uni_only, 4)
            if current_edu is not None and uni_only is not None
            else None
        )
        lavoro_only = as_float(row["eduscopio_rel_punti_lavoro_only"])
        quota_lavoro = as_float(row["quota_diplomati_con_esiti_lavoro_pct"])
        row["esiti_lavoro_delta_neutro_punti"] = round(lavoro_only, 4) if lavoro_only is not None else 0.0
        row["esiti_lavoro_delta_pesato_copertura_punti"] = (
            round((lavoro_only or 0.0) * (quota_lavoro or 0.0) / 100.0, 4)
        )
        doc_delta = as_float(row["docente_delta_italia_punti"])
        edu_rel = as_float(row["eduscopio_rel_punti_indirizzo"])
        row["indicatore_5_eduscopio_delta_indirizzo"] = edu_rel
        row["indicatore_6_immatricolazione_uni_delta_naz"] = row["immatricolazione_delta_naz_punti"]

        indicator_values = [
            as_float(row["indicatore_1_italiano_ii_delta_italia"]),
            as_float(row["indicatore_2_matematica_ii_delta_italia"]),
            as_float(row["indicatore_3_italiano_v_delta_italia"]),
            as_float(row["indicatore_4_matematica_v_delta_italia"]),
            as_float(row["indicatore_5_eduscopio_delta_indirizzo"]),
            as_float(row["indicatore_6_immatricolazione_uni_delta_naz"]),
        ]
        valid_indicators = [value for value in indicator_values if value is not None]
        row["copertura_indicatori_6"] = len(valid_indicators)
        row["indicatori_min_punti"] = round(min(valid_indicators), 4) if valid_indicators else None
        row["indicatori_max_punti"] = round(max(valid_indicators), 4) if valid_indicators else None
        row["indicatori_range_punti"] = (
            round(max(valid_indicators) - min(valid_indicators), 4)
            if valid_indicators
            else None
        )
        indicator_std = std_population(valid_indicators)
        row["indicatori_devstd_punti"] = round(indicator_std, 4) if indicator_std is not None else None

        if doc_delta is not None and edu_rel is not None:
            row["indice_unico_base100"] = round(100 + 0.4 * doc_delta + 0.6 * edu_rel, 2)
        else:
            row["indice_unico_base100"] = None
        flow_delta_reg = as_float(row["continuita_uni_delta_reg_punti"])
        flow_delta_naz = as_float(row["continuita_uni_delta_naz_punti"])
        if doc_delta is not None and edu_rel is not None and flow_delta_naz is not None:
            row["indice_unico_con_tassi_base100"] = round(
                100 + 0.35 * doc_delta + 0.45 * edu_rel + 0.20 * flow_delta_naz,
                2,
            )
        else:
            row["indice_unico_con_tassi_base100"] = None
        if doc_delta is not None and edu_rel is not None and flow_delta_reg is not None:
            row["indice_unico_con_tassi_reg_base100"] = round(
                100 + 0.35 * doc_delta + 0.45 * edu_rel + 0.20 * flow_delta_reg,
                2,
            )
        else:
            row["indice_unico_con_tassi_reg_base100"] = None
        imm_delta_naz = as_float(row["immatricolazione_delta_naz_punti"])
        if doc_delta is not None and edu_rel is not None and imm_delta_naz is not None:
            row["indice_unico_6i_40_40_20_base100"] = round(
                100 + 0.40 * doc_delta + 0.40 * edu_rel + 0.20 * imm_delta_naz,
                2,
            )
            row["indice_unico_6i_base100"] = round(
                100 + 0.45 * doc_delta + 0.45 * edu_rel + 0.10 * imm_delta_naz,
                2,
            )
        else:
            row["indice_unico_6i_40_40_20_base100"] = None
            row["indice_unico_6i_base100"] = None
        if (
            doc_delta is not None
            and edu_rel is not None
            and imm_delta_naz is not None
            and flow_delta_naz is not None
        ):
            row["indice_7i_lavoro_continuita_base100"] = round(
                100
                + 0.35 * doc_delta
                + 0.45 * edu_rel
                + 0.10 * imm_delta_naz
                + 0.10 * flow_delta_naz,
                2,
            )
            row["indice_7i_lavoro_continuita_40_40_10_10_base100"] = round(
                100
                + 0.40 * doc_delta
                + 0.40 * edu_rel
                + 0.10 * imm_delta_naz
                + 0.10 * flow_delta_naz,
                2,
            )
        else:
            row["indice_7i_lavoro_continuita_base100"] = None
            row["indice_7i_lavoro_continuita_40_40_10_10_base100"] = None
        edu_uni = as_float(row["eduscopio_rel_punti_uni_only"])
        lavoro_pesato = as_float(row["esiti_lavoro_delta_pesato_copertura_punti"])
        if (
            doc_delta is not None
            and edu_uni is not None
            and lavoro_pesato is not None
            and imm_delta_naz is not None
            and flow_delta_naz is not None
        ):
            row["indice_7i_lavoro_pesato_copertura_base100"] = round(
                100
                + 0.35 * doc_delta
                + 0.35 * edu_uni
                + 0.10 * lavoro_pesato
                + 0.10 * imm_delta_naz
                + 0.10 * flow_delta_naz,
                2,
            )
        else:
            row["indice_7i_lavoro_pesato_copertura_base100"] = None

        peso_diplomati = as_float(row["peso_diplomati_eduscopio"]) or 0.0
        affidabilita_diplomati = clip(100 * math.sqrt(peso_diplomati / 200.0)) if peso_diplomati > 0 else 0.0
        affidabilita_copertura = 100 * (len(valid_indicators) / 6)
        min_indicator = as_float(row["indicatori_min_punti"])
        range_indicator = as_float(row["indicatori_range_punti"])
        std_indicator = as_float(row["indicatori_devstd_punti"])
        if std_indicator is not None and range_indicator is not None and min_indicator is not None:
            affidabilita_equilibrio = clip(
                100
                - 2.0 * std_indicator
                - 0.5 * range_indicator
                + min(0.0, min_indicator) * 1.5
            )
        else:
            affidabilita_equilibrio = 0.0
        row["affidabilita_diplomati_score"] = round(affidabilita_diplomati, 2)
        row["penalita_pochi_diplomati_punti"] = round(100 - affidabilita_diplomati, 2)
        row["affidabilita_copertura_score"] = round(affidabilita_copertura, 2)
        row["affidabilita_equilibrio_indicatori_score"] = round(affidabilita_equilibrio, 2)
        row["indice_affidabilita_score"] = round(
            0.50 * affidabilita_diplomati
            + 0.20 * affidabilita_copertura
            + 0.30 * affidabilita_equilibrio,
            2,
        )
        indice_6i = as_float(row["indice_unico_6i_base100"])
        row["indice_unico_6i_affidabilita_applicata"] = (
            round(indice_6i * (0.70 + 0.30 * row["indice_affidabilita_score"] / 100), 2)
            if indice_6i is not None
            else None
        )

        for macro in ["licei_universita", "tecnici_misto", "professionali_lavoro"]:
            macro_items = [item for item in items if item.get("macro_indice") == macro]
            row[f"{macro}_rel_punti"] = weighted_average(macro_items, "eduscopio_rel_punti_indirizzo", "peso_diplomati")
            row[f"{macro}_score_assoluto"] = weighted_average(macro_items, "eduscopio_score_assoluto", "peso_diplomati")
            row[f"{macro}_peso"] = round(sum(as_float(item.get("peso_diplomati")) or 0 for item in macro_items), 2)
        output.append(row)
    return pd.DataFrame(output).sort_values("indice_unico_6i_base100", ascending=False)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--benchmark-input", default=str(OUT_DIR / "docente_italia_comuni_superiori_completi.csv"))
    parser.add_argument("--target-input", default=str(OUT_DIR / "docente_italia_comuni_superiori_completi.csv"))
    parser.add_argument("--range-km", type=int, default=30)
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--delay", type=float, default=0.02)
    parser.add_argument("--print-full", action="store_true")
    args = parser.parse_args()

    OUT_DIR.mkdir(exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    benchmark_docente = pd.read_csv(args.benchmark_input)
    target_docente = pd.read_csv(args.target_input)
    if "MERATE" not in set(target_docente["comune"]):
        target_docente = pd.concat(
            [target_docente, benchmark_docente[benchmark_docente["comune"] == "MERATE"]],
            ignore_index=True,
        )

    session = make_session()
    benchmark_comuni = sorted(set(benchmark_docente["comune"]))
    target_comuni = sorted(set(target_docente["comune"]))

    raw_benchmark, benchmarks = build_benchmark(
        session,
        benchmark_comuni,
        range_km=args.range_km,
        workers=args.workers,
        delay=args.delay,
    )
    flow_benchmarks_nazionali = build_flow_benchmarks_nazionali(raw_benchmark)
    flow_benchmark_map = {
        int(row["id_diploma"]): row
        for row in flow_benchmarks_nazionali.to_dict("records")
    }
    target_rows = target_indirizzi(
        session,
        target_comuni,
        range_km=args.range_km,
        delay=args.delay,
        benchmarks=benchmarks,
        flow_benchmarks_nazionali=flow_benchmark_map,
    )
    indices = aggregate_indices(target_rows, target_docente)
    final_score = "indice_7i_lavoro_pesato_copertura_base100"
    if final_score in indices.columns:
        indices["rank_indice_7i_lavoro_pesato_copertura"] = (
            indices[final_score].rank(method="min", ascending=False).astype("Int64")
        )
        indices_lavoro_copertura = indices.sort_values(final_score, ascending=False)
    else:
        indices_lavoro_copertura = indices

    raw_benchmark.to_csv(OUT_DIR / "eduscopio_benchmark_indirizzi_raw.csv", index=False, encoding="utf-8-sig")
    benchmarks.to_csv(OUT_DIR / "eduscopio_benchmark_indirizzi_stats.csv", index=False, encoding="utf-8-sig")
    flow_benchmarks_nazionali.to_csv(
        OUT_DIR / "eduscopio_benchmark_tassi_nazionali_stats.csv",
        index=False,
        encoding="utf-8-sig",
    )
    target_rows.to_csv(OUT_DIR / "docente_eduscopio_fair_indirizzi_con_tassi.csv", index=False, encoding="utf-8-sig")
    indices.to_csv(OUT_DIR / "docente_eduscopio_fair_indice_comuni_con_tassi.csv", index=False, encoding="utf-8-sig")
    target_rows.to_csv(OUT_DIR / "docente_eduscopio_indirizzi_6i.csv", index=False, encoding="utf-8-sig")
    indices.to_csv(OUT_DIR / "docente_eduscopio_indice_comuni_6i.csv", index=False, encoding="utf-8-sig")
    indices_lavoro_copertura.to_csv(
        OUT_DIR / "docente_eduscopio_indice_lavoro_copertura.csv",
        index=False,
        encoding="utf-8-sig",
    )

    if args.print_full:
        print(indices_lavoro_copertura.to_string(index=False))
    else:
        preview_cols = [
            "rank_indice_7i_lavoro_pesato_copertura",
            "comune",
            "provincia",
            "indice_7i_lavoro_pesato_copertura_base100",
            "indice_unico_6i_base100",
        ]
        preview_cols = [column for column in preview_cols if column in indices_lavoro_copertura.columns]
        print(indices_lavoro_copertura[preview_cols].head(20).to_string(index=False))
    print(f"Benchmark righe deduplicate: {len(raw_benchmark)}")
    print(f"Output: {(OUT_DIR / 'docente_eduscopio_indice_comuni_6i.csv').resolve()}")
    print(f"Output: {(OUT_DIR / 'docente_eduscopio_indice_lavoro_copertura.csv').resolve()}")


if __name__ == "__main__":
    main()

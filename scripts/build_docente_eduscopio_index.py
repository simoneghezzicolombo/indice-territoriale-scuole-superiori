from __future__ import annotations

import argparse
import csv
import json
import re
import time
from pathlib import Path
from typing import Any

import pandas as pd
import requests


BASE_URL = "https://eduscopio.it"
OUT_DIR = Path("output")
CACHE_DIR = OUT_DIR / "cache_eduscopio"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; docente-eduscopio-local-analysis/1.0; "
        "+https://eduscopio.it)"
    )
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
    value = value.upper().replace("'", " ")
    value = re.sub(r"[^A-Z0-9 ]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def as_float(value: Any) -> float | None:
    if value is None or pd.isna(value):
        return None
    try:
        return float(str(value).replace(",", "."))
    except ValueError:
        return None


def weighted_average(rows: list[dict[str, Any]], value_key: str, weight_key: str) -> float | None:
    total_value = 0.0
    total_weight = 0.0
    for row in rows:
        value = as_float(row.get(value_key))
        weight = as_float(row.get(weight_key)) or 0.0
        if value is None or weight <= 0:
            continue
        total_value += value * weight
        total_weight += weight
    if total_weight <= 0:
        return None
    return round(total_value / total_weight, 2)


def cache_json(path: Path, fetcher) -> Any:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    data = fetcher()
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return data


def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(HEADERS)
    session.post(
        f"{BASE_URL}/createProfile.json",
        json={"gender": "m", "role": "p", "name": "local-analysis", "q1": "o", "q2": "-"},
        headers={**HEADERS, "Referer": f"{BASE_URL}/"},
        timeout=30,
    ).raise_for_status()
    return session


def get_place_id(session: requests.Session, comune: str, delay: float) -> int | None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache = CACHE_DIR / f"place_{normalize_name(comune).lower().replace(' ', '_')}.json"

    def fetch():
        if delay:
            time.sleep(delay)
        response = session.get(f"{BASE_URL}/placeHints/{comune}", timeout=30)
        response.raise_for_status()
        return response.json()

    names, ids = cache_json(cache, fetch)
    wanted = normalize_name(comune)
    for name, place_id in zip(names, ids):
        if normalize_name(name) == wanted:
            return int(place_id)
    return int(ids[0]) if ids else None


def eduscopio_query(
    session: requests.Session,
    path: str,
    comune: str,
    place_id: int,
    diploma_id: int,
    delay: float,
) -> list[dict[str, Any]]:
    cache = CACHE_DIR / (
        f"{path}_{normalize_name(comune).lower().replace(' ', '_')}_{place_id}_{diploma_id}.json"
    )

    def fetch():
        if delay:
            time.sleep(delay)
        if path == "uni":
            url = f"{BASE_URL}/searchSchools/{place_id}/30/{diploma_id}/1/false/null/null"
            referer = f"{BASE_URL}/percorso-genitori-scelta-scuola-superiore"
        else:
            url = f"{BASE_URL}/searchSchoolsLavoro/{place_id}/30/{diploma_id}/2/false/null/null/1"
            referer = f"{BASE_URL}/percorso-genitori-scelta-scuola-superiore-lavoro"
        response = session.get(url, headers={**HEADERS, "Referer": referer}, timeout=30)
        response.raise_for_status()
        return response.json()

    data = cache_json(cache, fetch)
    if not isinstance(data, list) or len(data) < 2 or not isinstance(data[1], list):
        return []
    return [row for row in data[1] if row.get("id_comune") == place_id]


def scrape_eduscopio_for_comune(
    session: requests.Session,
    comune: str,
    delay: float,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    place_id = get_place_id(session, comune, delay)
    if place_id is None:
        return [], {"comune": comune, "errore": "place_id_non_trovato"}

    by_key: dict[tuple[str, int], dict[str, Any]] = {}

    for diploma_id, diploma_name in DIPLOMI_UNI.items():
        for row in eduscopio_query(session, "uni", comune, place_id, diploma_id, delay):
            key = (row.get("cod_scuola"), diploma_id)
            target = by_key.setdefault(
                key,
                {
                    "comune": comune,
                    "eduscopio_id_comune": place_id,
                    "cod_scuola": row.get("cod_scuola"),
                    "id_diploma": diploma_id,
                    "indirizzo_eduscopio": diploma_name,
                    "nome_scuola_eduscopio": row.get("nome_scuola"),
                    "indirizzo_scuola_eduscopio": row.get("indirizzo_scuola"),
                    "scuola_paritaria": row.get("scuola_paritaria"),
                    "num_diplomati_x_coorte": row.get("num_diplomati_x_coorte"),
                },
            )
            target.update(
                {
                    "uni_fga": row.get("indice_composto") / 100 if row.get("indice_composto") is not None else None,
                    "uni_media_voti": row.get("indice_media_voti") / 100 if row.get("indice_media_voti") is not None else None,
                    "uni_crediti": row.get("indice_perc_cfu") / 100 if row.get("indice_perc_cfu") is not None else None,
                    "uni_diplomati": row.get("num_diplomati_x_coorte"),
                    "diplomati_in_regola_pct": row.get("completamento") / 10 if row.get("completamento") is not None else None,
                }
            )

    for diploma_id, diploma_name in DIPLOMI_LAV.items():
        for row in eduscopio_query(session, "lav", comune, place_id, diploma_id, delay):
            key = (row.get("cod_scuola"), diploma_id)
            target = by_key.setdefault(
                key,
                {
                    "comune": comune,
                    "eduscopio_id_comune": place_id,
                    "cod_scuola": row.get("cod_scuola"),
                    "id_diploma": diploma_id,
                    "indirizzo_eduscopio": diploma_name,
                    "nome_scuola_eduscopio": row.get("nome_scuola"),
                    "indirizzo_scuola_eduscopio": row.get("indirizzo_scuola"),
                    "scuola_paritaria": row.get("scuola_paritaria"),
                    "num_diplomati_x_coorte": row.get("num_diplomati_x_coorte"),
                },
            )
            occupazione = row.get("ind1_tasso_occup") / 100 if row.get("ind1_tasso_occup") is not None else None
            coerenza = row.get("ind7_perc_coerente") / 100 if row.get("ind7_perc_coerente") is not None else None
            lavoro_score = None
            if occupazione is not None and coerenza is not None:
                lavoro_score = round(0.65 * occupazione + 0.35 * coerenza, 2)
            target.update(
                {
                    "lav_occupazione_pct": occupazione,
                    "lav_coerenza_pct": coerenza,
                    "lav_score": lavoro_score,
                    "lav_diplomati": row.get("num_diplomati_x_coorte"),
                    "diplomati_in_regola_pct": row.get("completamento") / 10 if row.get("completamento") is not None else target.get("diplomati_in_regola_pct"),
                }
            )

    rows = list(by_key.values())
    for row in rows:
        row["peso_diplomati"] = (
            as_float(row.get("num_diplomati_x_coorte"))
            or as_float(row.get("uni_diplomati"))
            or as_float(row.get("lav_diplomati"))
            or 0
        )
        uni_score = as_float(row.get("uni_fga"))
        lav_score = as_float(row.get("lav_score"))
        diploma_id = int(row["id_diploma"])
        if diploma_id <= 8:
            row["eduscopio_indirizzo_score"] = uni_score
            row["eduscopio_score_tipo"] = "uni_fga"
        elif diploma_id in (9, 10):
            if uni_score is not None and lav_score is not None:
                row["eduscopio_indirizzo_score"] = round(0.5 * uni_score + 0.5 * lav_score, 2)
                row["eduscopio_score_tipo"] = "uni_lavoro_50_50"
            else:
                row["eduscopio_indirizzo_score"] = uni_score if uni_score is not None else lav_score
                row["eduscopio_score_tipo"] = "uni_o_lavoro"
        else:
            row["eduscopio_indirizzo_score"] = lav_score
            row["eduscopio_score_tipo"] = "lavoro"

    summary = {
        "comune": comune,
        "eduscopio_id_comune": place_id,
        "eduscopio_indirizzi": len(rows),
        "eduscopio_diplomati_peso_totale": sum(as_float(row.get("peso_diplomati")) or 0 for row in rows),
        "eduscopio_score_pesato": weighted_average(rows, "eduscopio_indirizzo_score", "peso_diplomati"),
        "eduscopio_uni_fga_pesato": weighted_average(rows, "uni_fga", "peso_diplomati"),
        "eduscopio_lavoro_score_pesato": weighted_average(rows, "lav_score", "peso_diplomati"),
        "eduscopio_diplomati_regola_pesato": weighted_average(rows, "diplomati_in_regola_pct", "peso_diplomati"),
    }
    return rows, summary


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=str(OUT_DIR / "docente_italia_comuni_superiori_media_sopra_merate.csv"))
    parser.add_argument("--include-merate", action="store_true", default=True)
    parser.add_argument("--delay", type=float, default=0.05)
    parser.add_argument("--docente-weight", type=float, default=0.40)
    parser.add_argument("--eduscopio-weight", type=float, default=0.60)
    args = parser.parse_args()

    input_path = Path(args.input)
    docente = pd.read_csv(input_path)
    if args.include_merate and "MERATE" not in set(docente["comune"]):
        all_docente = pd.read_csv(OUT_DIR / "docente_italia_comuni_superiori_completi.csv")
        docente = pd.concat([docente, all_docente[all_docente["comune"] == "MERATE"]], ignore_index=True)

    session = make_session()
    all_rows: list[dict[str, Any]] = []
    summaries: list[dict[str, Any]] = []

    docente_by_comune = {row["comune"]: row for row in docente.to_dict("records")}
    for comune in sorted(docente_by_comune):
        rows, summary = scrape_eduscopio_for_comune(session, comune, args.delay)
        all_rows.extend(rows)
        docente_row = docente_by_comune[comune]
        docente_score = as_float(docente_row.get("media_superiori_pct"))
        eduscopio_score = as_float(summary.get("eduscopio_score_pesato"))
        index_score = None
        if docente_score is not None and eduscopio_score is not None:
            index_score = round(args.docente_weight * docente_score + args.eduscopio_weight * eduscopio_score, 2)
        summary.update(
            {
                "provincia": docente_row.get("provincia"),
                "regione": docente_row.get("regione"),
                "docente_italiano_ii_pct": docente_row.get("italiano_ii_pct"),
                "docente_matematica_ii_pct": docente_row.get("matematica_ii_pct"),
                "docente_italiano_v_pct": docente_row.get("italiano_v_pct"),
                "docente_matematica_v_pct": docente_row.get("matematica_v_pct"),
                "docente_media_superiori_pct": docente_score,
                "indice_integrato": index_score,
                "formula": f"{args.docente_weight:.2f}*docente_media + {args.eduscopio_weight:.2f}*eduscopio_score_pesato",
            }
        )
        summaries.append(summary)
        print(f"{comune}: {summary.get('eduscopio_indirizzi')} indirizzi Eduscopio, indice {index_score}")

    rows_path = OUT_DIR / "docente_eduscopio_indirizzi.csv"
    summary_path = OUT_DIR / "docente_eduscopio_indice_comuni.csv"

    if all_rows:
        fields = sorted({key for row in all_rows for key in row})
        with rows_path.open("w", newline="", encoding="utf-8-sig") as handle:
            writer = csv.DictWriter(handle, fields)
            writer.writeheader()
            writer.writerows(all_rows)

    summaries = sorted(summaries, key=lambda row: row.get("indice_integrato") or -1, reverse=True)
    if summaries:
        fields = [
            "comune",
            "provincia",
            "regione",
            "docente_media_superiori_pct",
            "eduscopio_score_pesato",
            "eduscopio_uni_fga_pesato",
            "eduscopio_lavoro_score_pesato",
            "eduscopio_diplomati_regola_pesato",
            "eduscopio_indirizzi",
            "eduscopio_diplomati_peso_totale",
            "indice_integrato",
            "formula",
            "eduscopio_id_comune",
        ]
        with summary_path.open("w", newline="", encoding="utf-8-sig") as handle:
            writer = csv.DictWriter(handle, fields, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(summaries)

    print(f"Output indirizzi: {rows_path.resolve()}")
    print(f"Output indice: {summary_path.resolve()}")


if __name__ == "__main__":
    main()

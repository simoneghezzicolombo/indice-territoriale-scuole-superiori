from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd


def load_config(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="config/analysis_config.json")
    parser.add_argument("--index", default="output/docente_eduscopio_indice_lavoro_copertura.csv")
    parser.add_argument("--strict", action="store_true", help="Check exact snapshot counts and top order.")
    args = parser.parse_args()

    config = load_config(Path(args.config))
    df = pd.read_csv(args.index)
    score_col = config["final_index"]["name"]

    required = [
        "comune",
        "provincia",
        "regione",
        score_col,
        "docente_delta_italia_punti",
        "eduscopio_rel_punti_uni_only",
        "esiti_lavoro_delta_pesato_copertura_punti",
        "immatricolazione_delta_naz_punti",
        "continuita_uni_delta_naz_punti",
    ]
    missing = [column for column in required if column not in df.columns]
    if missing:
        raise SystemExit(f"Missing required columns: {missing}")

    df[score_col] = pd.to_numeric(df[score_col], errors="coerce")
    valid = df[df[score_col].notna()].sort_values(score_col, ascending=False)
    if valid.empty:
        raise SystemExit("No valid final-index rows found.")

    if args.strict:
        expected = config["expected_snapshot"]
        if len(df) != expected["rows_total"]:
            raise SystemExit(f"Expected {expected['rows_total']} rows, found {len(df)}.")
        if len(valid) != expected["rows_with_final_index"]:
            raise SystemExit(
                f"Expected {expected['rows_with_final_index']} valid index rows, found {len(valid)}."
            )
        top = list(valid["comune"].head(len(expected["top_5_final_index"])))
        if top != expected["top_5_final_index"]:
            raise SystemExit(f"Unexpected top order: {top}")

    print("Validation OK")
    print(valid[["comune", "provincia", score_col]].head(10).to_string(index=False))


if __name__ == "__main__":
    main()

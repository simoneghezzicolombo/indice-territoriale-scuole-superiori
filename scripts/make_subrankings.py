from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd


DEFAULT_FOCUS = [
    "MERATE",
    "FOSSANO",
    "DESIO",
    "THIENE",
    "PRESEZZO",
    "CUNEO",
    "VILLORBA",
    "LONATO DEL GARDA",
    "CITTADELLA",
    "SONDRIO",
]


def numeric(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    for column in columns:
        if column in df.columns:
            df[column] = pd.to_numeric(df[column], errors="coerce")
    return df


def make_ranking(
    df: pd.DataFrame,
    name: str,
    value_col: str,
    higher_is_better: bool = True,
    require_value: bool = True,
) -> pd.DataFrame:
    sub = df.copy()
    if require_value:
        sub = sub[sub[value_col].notna()].copy()
    sub = sub.sort_values(value_col, ascending=not higher_is_better).reset_index(drop=True)
    sub["rank"] = range(1, len(sub) + 1)
    sub["subranking"] = name
    sub["valore"] = sub[value_col]
    return sub[
        [
            "subranking",
            "rank",
            "comune",
            "provincia",
            "regione",
            "valore",
            "indice_unico_6i_base100",
            "indice_7i_lavoro_pesato_copertura_base100",
            "peso_diplomati_eduscopio",
            "quota_diplomati_con_esiti_lavoro_pct",
        ]
    ]


def build_subrankings(input_csv: Path, output_dir: Path) -> tuple[Path, Path, Path]:
    df = pd.read_csv(input_csv)
    numeric_cols = [
        "indice_unico_6i_base100",
        "indice_7i_lavoro_pesato_copertura_base100",
        "docente_delta_italia_punti",
        "eduscopio_rel_punti_uni_only",
        "eduscopio_rel_punti_lavoro_only",
        "quota_diplomati_con_esiti_lavoro_pct",
        "esiti_lavoro_delta_pesato_copertura_punti",
        "immatricolazione_delta_naz_punti",
        "continuita_uni_delta_naz_punti",
        "peso_diplomati_eduscopio",
    ]
    df = numeric(df, numeric_cols)
    df = df[df["indice_7i_lavoro_pesato_copertura_base100"].notna()].copy()

    rankings = [
        make_ranking(df, "Docente - media delta vs Italia", "docente_delta_italia_punti"),
        make_ranking(df, "Eduscopio universita - delta vs indirizzo", "eduscopio_rel_punti_uni_only"),
        make_ranking(df, "Esiti lavoro - delta puro vs indirizzo", "eduscopio_rel_punti_lavoro_only"),
        make_ranking(df, "Esiti lavoro - delta pesato copertura", "esiti_lavoro_delta_pesato_copertura_punti"),
        make_ranking(df, "Immatricolazione universitaria vs Stato", "immatricolazione_delta_naz_punti"),
        make_ranking(df, "Continuita universitaria vs Stato", "continuita_uni_delta_naz_punti"),
        make_ranking(df, "Indice finale lavoro pesato copertura", "indice_7i_lavoro_pesato_copertura_base100"),
    ]
    long = pd.concat(rankings, ignore_index=True)

    output_dir.mkdir(exist_ok=True)
    long_path = output_dir / "subranking_indicatori_comuni.csv"
    focus_path = output_dir / "subranking_indicatori_focus.csv"
    summary_path = output_dir / "classifica_finale_lavoro_copertura_sintesi.csv"

    long.to_csv(long_path, index=False, encoding="utf-8-sig")

    focus_rows = []
    for subname, group in long.groupby("subranking", sort=False):
        for comune in DEFAULT_FOCUS:
            hit = group[group["comune"].eq(comune)]
            if hit.empty:
                focus_rows.append({"subranking": subname, "comune": comune, "rank": None, "valore": None})
                continue
            row = hit.iloc[0]
            focus_rows.append(
                {
                    "subranking": subname,
                    "comune": comune,
                    "rank": int(row["rank"]),
                    "valore": round(float(row["valore"]), 4),
                }
            )
    pd.DataFrame(focus_rows).to_csv(focus_path, index=False, encoding="utf-8-sig")

    summary_cols = [
        "rank_indice_7i_lavoro_pesato_copertura",
        "comune",
        "provincia",
        "regione",
        "indice_7i_lavoro_pesato_copertura_base100",
        "docente_delta_italia_punti",
        "eduscopio_rel_punti_uni_only",
        "eduscopio_rel_punti_lavoro_only",
        "quota_diplomati_con_esiti_lavoro_pct",
        "esiti_lavoro_delta_pesato_copertura_punti",
        "immatricolazione_delta_naz_punti",
        "continuita_uni_delta_naz_punti",
        "peso_diplomati_eduscopio",
        "indice_affidabilita_score",
        "indice_unico_6i_base100",
    ]
    available_cols = [column for column in summary_cols if column in df.columns]
    df.sort_values("indice_7i_lavoro_pesato_copertura_base100", ascending=False)[available_cols].to_csv(
        summary_path,
        index=False,
        encoding="utf-8-sig",
    )

    return long_path, focus_path, summary_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="output/docente_eduscopio_indice_lavoro_copertura.csv")
    parser.add_argument("--output-dir", default="output")
    args = parser.parse_args()

    outputs = build_subrankings(Path(args.input), Path(args.output_dir))
    for path in outputs:
        print(f"Output: {path.resolve()}")


if __name__ == "__main__":
    main()

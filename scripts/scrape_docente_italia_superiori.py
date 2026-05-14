from __future__ import annotations

import argparse
import csv
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urlparse
from xml.etree import ElementTree as ET

import requests
from bs4 import BeautifulSoup


BASE_URL = "https://www.docente.it"
SITEMAP_INDEX_URL = f"{BASE_URL}/sitemap.xml"
OUT_DIR = Path("output")
CACHE_DIR = OUT_DIR / "cache_docente_migliori_scuole"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; docente-italia-local-analysis/1.0; "
        "+https://www.docente.it)"
    )
}

TARGET_METRICS = [
    ("Italiano", "II Superiore", "italiano_ii_pct"),
    ("Matematica", "II Superiore", "matematica_ii_pct"),
    ("Italiano", "V Superiore", "italiano_v_pct"),
    ("Matematica", "V Superiore", "matematica_v_pct"),
]

MERATE = {
    "italiano_ii_pct": 77.0,
    "matematica_ii_pct": 87.0,
    "italiano_v_pct": 81.0,
    "matematica_v_pct": 85.0,
}


def clean_text(node) -> str:
    return re.sub(r"\s+", " ", node.get_text(" ", strip=True)).strip()


def percent_to_float(value: str | None) -> float | None:
    if value is None:
        return None
    value = value.replace("%", "").replace(",", ".").strip()
    try:
        return float(value)
    except ValueError:
        return None


def slug_from_url(url: str) -> str:
    return urlparse(url).path.rstrip("/").split("/")[-1]


def cache_path(url: str) -> Path:
    return CACHE_DIR / f"{slug_from_url(url)}.html"


def get_text(url: str, delay: float, refresh: bool = False) -> str:
    path = cache_path(url)
    if not refresh and path.exists():
        return path.read_text(encoding="utf-8")

    if delay:
        time.sleep(delay)
    response = requests.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()
    path.write_text(response.text, encoding="utf-8")
    return response.text


def sitemap_urls(url: str) -> list[str]:
    response = requests.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()
    root = ET.fromstring(response.content)
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    return [loc.text for loc in root.findall(".//sm:loc", ns) if loc.text]


def migliori_scuole_urls() -> list[str]:
    urls: list[str] = []
    for sitemap in sitemap_urls(SITEMAP_INDEX_URL):
        if "/sitemap/0.xml" not in sitemap:
            continue
        for url in sitemap_urls(sitemap):
            if "/migliori-scuole/" in url:
                urls.append(url)
    return sorted(set(urls))


def parse_aggregate_page(url: str, html: str) -> dict[str, str | float | int | bool | None]:
    soup = BeautifulSoup(html, "html.parser")
    h1 = soup.find("h1")
    comune = clean_text(h1).replace("Scuole di ", "").strip() if h1 else slug_from_url(url).upper()

    flat = re.sub(r"\s+", " ", soup.get_text(" ", strip=True)).strip()
    place_match = re.search(r"Provincia di\s+(.+?)\s+-\s+([A-Za-zÀ-ÿ' -]+)\s+\d+\s+Scuole", flat)
    year_match = re.search(r"(\d{4}-\d{2})\s+Anno dati INVALSI", flat)
    schools_match = re.search(r"Provincia di\s+.+?\s+-\s+[A-Za-zÀ-ÿ' -]+\s+(\d+)\s+Scuole", flat)

    row: dict[str, str | float | int | bool | None] = {
        "slug": slug_from_url(url),
        "comune": comune,
        "provincia": place_match.group(1).strip() if place_match else None,
        "regione": place_match.group(2).strip() if place_match else None,
        "scuole_totali_docente": int(schools_match.group(1)) if schools_match else None,
        "anno_dati_invalsi": year_match.group(1) if year_match else None,
        "url": url,
    }

    by_metric: dict[tuple[str, str], dict[str, float | None]] = {}
    for heading in soup.find_all("h3"):
        title = clean_text(heading)
        if " - " not in title or "Superiore" not in title:
            continue

        subject, level = [part.strip() for part in title.split(" - ", 1)]
        card = heading.find_parent("div")
        if card:
            card = card.find_parent("div")
        if not card:
            continue

        stats: dict[str, float | None] = {}
        for stat in card.select(".grid > div"):
            label_node = stat.find("div")
            value_node = label_node.find_next_sibling("div") if label_node else None
            if not label_node or not value_node:
                continue
            stats[clean_text(label_node).lower()] = percent_to_float(clean_text(value_node))
        by_metric[(subject, level)] = stats

    for subject, level, key in TARGET_METRICS:
        stats = by_metric.get((subject, level), {})
        row[key] = stats.get(comune.lower())
        row[f"{key}_provincia"] = stats.get((row["provincia"] or "").lower())
        row[f"{key}_regione"] = stats.get((row["regione"] or "").lower())
        row[f"{key}_italia"] = stats.get("italia")

    values = [row[key] for _, _, key in TARGET_METRICS if isinstance(row.get(key), float)]
    row["metriche_superiori_presenti"] = len(values)
    row["media_superiori_pct"] = round(sum(values) / len(values), 2) if values else None

    complete = all(isinstance(row.get(key), float) for _, _, key in TARGET_METRICS)
    row["dati_superiori_completi"] = complete
    if complete:
        differences = [row[key] - MERATE[key] for _, _, key in TARGET_METRICS]  # type: ignore[operator]
        row["metriche_sopra_merate"] = sum(1 for difference in differences if difference > 0)
        row["sopra_merate_tutte4"] = all(difference > 0 for difference in differences)
        row["pari_o_sopra_merate_tutte4"] = all(difference >= 0 for difference in differences)
        row["distanza_media_da_merate"] = round(sum(differences) / len(differences), 2)
        row["margine_minimo_vs_merate"] = min(differences)
    else:
        row["metriche_sopra_merate"] = None
        row["sopra_merate_tutte4"] = False
        row["pari_o_sopra_merate_tutte4"] = False
        row["distanza_media_da_merate"] = None
        row["margine_minimo_vs_merate"] = None

    return row


def write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def scrape_one(url: str, delay: float, refresh: bool) -> dict:
    try:
        html = get_text(url, delay=delay, refresh=refresh)
        return parse_aggregate_page(url, html)
    except Exception as exc:  # noqa: BLE001
        return {
            "slug": slug_from_url(url),
            "url": url,
            "errore": repr(exc),
            "metriche_superiori_presenti": 0,
            "dati_superiori_completi": False,
        }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--delay", type=float, default=0.05)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--limit", type=int)
    args = parser.parse_args()

    OUT_DIR.mkdir(exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    urls = migliori_scuole_urls()
    if args.limit:
        urls = urls[: args.limit]

    rows: list[dict] = []
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = [executor.submit(scrape_one, url, args.delay, args.refresh) for url in urls]
        for index, future in enumerate(as_completed(futures), start=1):
            rows.append(future.result())
            if index % 250 == 0 or index == len(futures):
                print(f"Completate {index}/{len(futures)} pagine")

    rows.sort(key=lambda item: item.get("slug") or "")
    complete_rows = [
        row for row in rows
        if row.get("dati_superiori_completi") is True and not row.get("errore")
    ]
    top_rows = sorted(
        complete_rows,
        key=lambda item: (
            item.get("media_superiori_pct") or -1,
            item.get("margine_minimo_vs_merate") or -100,
        ),
        reverse=True,
    )
    all4_rows = [
        row for row in top_rows
        if row.get("sopra_merate_tutte4") is True
    ]
    avg_above_rows = [
        row for row in top_rows
        if isinstance(row.get("media_superiori_pct"), float)
        and row["media_superiori_pct"] > 82.5
    ]
    any_rows = [
        row for row in top_rows
        if isinstance(row.get("metriche_sopra_merate"), int) and row["metriche_sopra_merate"] > 0
    ]

    fields = [
        "slug",
        "comune",
        "provincia",
        "regione",
        "scuole_totali_docente",
        "anno_dati_invalsi",
        "italiano_ii_pct",
        "matematica_ii_pct",
        "italiano_v_pct",
        "matematica_v_pct",
        "media_superiori_pct",
        "metriche_sopra_merate",
        "sopra_merate_tutte4",
        "pari_o_sopra_merate_tutte4",
        "distanza_media_da_merate",
        "margine_minimo_vs_merate",
        "metriche_superiori_presenti",
        "dati_superiori_completi",
        "url",
        "errore",
    ]

    write_csv(OUT_DIR / "docente_italia_comuni_superiori.csv", rows, fields)
    write_csv(OUT_DIR / "docente_italia_comuni_superiori_completi.csv", complete_rows, fields)
    write_csv(OUT_DIR / "docente_italia_comuni_superiori_top.csv", top_rows, fields)
    write_csv(OUT_DIR / "docente_italia_comuni_superiori_media_sopra_merate.csv", avg_above_rows, fields)
    write_csv(OUT_DIR / "docente_italia_comuni_superiori_battono_merate_tutte4.csv", all4_rows, fields)
    write_csv(OUT_DIR / "docente_italia_comuni_superiori_battono_merate_almeno1.csv", any_rows, fields)

    summary = {
        "pagine_migliori_scuole_sitemap": len(urls),
        "comuni_con_dati_superiori_completi": len(complete_rows),
        "comuni_con_media_superiori_sopra_merate": len(avg_above_rows),
        "comuni_sopra_merate_tutte4": len(all4_rows),
        "comuni_sopra_merate_almeno1": len(any_rows),
        "merate_baseline": MERATE,
        "top10_media_superiori": top_rows[:10],
        "top10_sopra_merate_tutte4": all4_rows[:10],
    }
    (OUT_DIR / "docente_italia_comuni_superiori_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

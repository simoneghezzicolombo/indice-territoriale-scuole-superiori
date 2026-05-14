from __future__ import annotations

import argparse
import csv
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
CACHE_DIR = OUT_DIR / "cache_docente_scuole"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; docente-top-comuni-local-analysis/1.0; "
        "+https://www.docente.it)"
    )
}

TARGETS = {
    "desio": "DESIO",
    "busnago": "BUSNAGO",
    "fossano": "FOSSANO",
    "nicotera": "NICOTERA",
    "adro": "ADRO",
    "possagno": "POSSAGNO",
    "merate": "MERATE",
}


def clean_text(node) -> str:
    return re.sub(r"\s+", " ", node.get_text(" ", strip=True)).strip()


def sitemap_urls(url: str) -> list[str]:
    response = requests.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()
    root = ET.fromstring(response.content)
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    return [loc.text for loc in root.findall(".//sm:loc", ns) if loc.text]


def all_school_urls() -> list[str]:
    urls: list[str] = []
    for sitemap in sitemap_urls(SITEMAP_INDEX_URL):
        if "/sitemap/1.xml" not in sitemap and "/sitemap/2.xml" not in sitemap:
            continue
        for url in sitemap_urls(sitemap):
            if "/scuola/" in url:
                urls.append(url)
    return sorted(set(urls))


def slug_from_url(url: str) -> str:
    return urlparse(url).path.rstrip("/").split("/")[-1]


def school_code_from_url(url: str) -> str:
    return slug_from_url(url).rsplit("-", 1)[-1].upper()


def cache_path(url: str) -> Path:
    return CACHE_DIR / f"{slug_from_url(url)}.html"


def fetch(url: str, refresh: bool, delay: float) -> str:
    path = cache_path(url)
    if not refresh and path.exists():
        return path.read_text(encoding="utf-8")
    if delay:
        time.sleep(delay)
    response = requests.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()
    path.write_text(response.text, encoding="utf-8")
    return response.text


def candidate_urls(urls: list[str], targets: dict[str, str]) -> list[str]:
    candidates = []
    for url in urls:
        slug = slug_from_url(url)
        if any(f"-{target_slug}-" in f"-{slug}-" for target_slug in targets):
            candidates.append(url)
    return candidates


def parse_school(url: str, html: str) -> dict[str, str | None]:
    soup = BeautifulSoup(html, "html.parser")
    h1 = soup.find("h1")
    name = clean_text(h1) if h1 else None

    grade = None
    address = None
    if h1:
        header = h1.find_parent("div")
        if header:
            grade_node = header.find("div")
            grade = clean_text(grade_node) if grade_node else None
        address_node = h1.find_next_sibling("div")
        address = clean_text(address_node) if address_node else None

    city = None
    province = None
    if address:
        match = re.search(r"\b([A-ZÀ-Ù' -]+)\s*\(\s*([A-ZÀ-Ù' -]+)\s*\)", address)
        if match:
            city = re.sub(r"\s+", " ", match.group(1)).strip()
            province = re.sub(r"\s+", " ", match.group(2)).strip()

    return {
        "comune": city,
        "provincia": province,
        "codice": school_code_from_url(url),
        "nome": name,
        "grado": grade,
        "indirizzo": address,
        "url": url,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--delay", type=float, default=0.03)
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args()

    OUT_DIR.mkdir(exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    urls = candidate_urls(all_school_urls(), TARGETS)
    rows: list[dict[str, str | None]] = []
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(fetch, url, args.refresh, args.delay): url
            for url in urls
        }
        for future in as_completed(futures):
            url = futures[future]
            try:
                row = parse_school(url, future.result())
            except Exception as exc:  # noqa: BLE001
                row = {"url": url, "errore": repr(exc)}
            if row.get("comune") in TARGETS.values():
                rows.append(row)

    rows.sort(key=lambda row: (row.get("comune") or "", row.get("grado") or "", row.get("nome") or ""))
    fields = ["comune", "provincia", "codice", "nome", "grado", "indirizzo", "url"]
    with (OUT_DIR / "docente_top_comuni_scuole.csv").open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    superiori = [row for row in rows if row.get("grado") == "Scuola Secondaria di Secondo Grado"]
    with (OUT_DIR / "docente_top_comuni_superiori.csv").open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(superiori)

    print(f"Candidate URL: {len(urls)}")
    print(f"Scuole target trovate: {len(rows)}")
    print(f"Superiori target trovate: {len(superiori)}")
    for comune in TARGETS.values():
        total = sum(1 for row in rows if row.get("comune") == comune)
        high = sum(1 for row in superiori if row.get("comune") == comune)
        print(f"{comune}: {total} scuole, {high} superiori")


if __name__ == "__main__":
    main()

from __future__ import annotations

import argparse
import csv
import json
import re
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup


BASE_URL = "https://www.docente.it"
DEFAULT_COMUNE = "MERATE"
OUT_DIR = Path("output")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; docente-merate-local-analysis/1.0; "
        "+https://www.docente.it)"
    )
}

INVALSI_ORDER = [
    ("II Superiore", "Italiano"),
    ("II Superiore", "Matematica"),
    ("V Superiore", "Italiano"),
    ("V Superiore", "Matematica"),
]


def clean_text(node) -> str:
    return re.sub(r"\s+", " ", node.get_text(" ", strip=True)).strip()


def clean_value(value: str | None) -> str | None:
    if value is None:
        return None
    return re.sub(r"\s+", "", value.replace("\xa0", " ")).strip()


def fetch(session: requests.Session, url: str, delay: float) -> BeautifulSoup:
    time.sleep(delay)
    response = session.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()
    return BeautifulSoup(response.text, "html.parser")


def school_code_from_url(url: str) -> str:
    slug = urlparse(url).path.rstrip("/").split("/")[-1]
    return slug.rsplit("-", 1)[-1].upper()


def infer_grade_from_search_text(text: str) -> str:
    for label, grade in [
        ("Superiori", "Scuola Secondaria di Secondo Grado"),
        ("Medie", "Scuola Secondaria di Primo Grado"),
        ("Primaria", "Scuola Primaria"),
        ("Infanzia", "Scuola dell'Infanzia"),
    ]:
        if label in text:
            return grade
    return ""


def parse_search_results(soup: BeautifulSoup, source_url: str) -> list[dict[str, str]]:
    schools: list[dict[str, str]] = []
    seen: set[str] = set()

    for anchor in soup.select('a[href^="/scuola/"]'):
        url = urljoin(source_url, anchor["href"])
        if url in seen:
            continue
        seen.add(url)

        text = clean_text(anchor)
        grade = infer_grade_from_search_text(text)
        name = text
        for suffix in [" MERATE ( LECCO ) Superiori", " MERATE ( LECCO ) Medie",
                       " MERATE ( LECCO ) Primaria", " MERATE ( LECCO ) Infanzia",
                       " MERATE ( LECCO )"]:
            name = name.replace(suffix, "")

        schools.append(
            {
                "codice": school_code_from_url(url),
                "nome_da_ricerca": name.strip(),
                "grado_da_ricerca": grade,
                "url": url,
            }
        )

    return schools


def regex_value(flat_text: str, pattern: str) -> str | None:
    match = re.search(pattern, flat_text, flags=re.IGNORECASE)
    if not match:
        return None
    for group in match.groups():
        if group is not None:
            return clean_value(group)
    return None


def parse_school_page(soup: BeautifulSoup, url: str) -> dict[str, str | None]:
    h1 = soup.find("h1")
    name = clean_text(h1) if h1 else None

    header = h1.find_parent("div") if h1 else None
    grade = None
    address = None
    if header:
        grade_div = header.find("div")
        grade = clean_text(grade_div) if grade_div else None
        address_div = h1.find_next_sibling("div") if h1 else None
        address = clean_text(address_div) if address_div else None

    flat_text = re.sub(r"\s+", " ", soup.get_text(" ", strip=True)).strip()
    result: dict[str, str | None] = {
        "codice": school_code_from_url(url),
        "nome": name,
        "grado": grade,
        "indirizzo": address,
        "url": url,
        "libri_in_media": regex_value(flat_text, r"~\s*(\d+)\s*libri in media"),
        "libri_da_acquistare": regex_value(flat_text, r"~\s*(\d+)\s*da acquistare"),
        "anni": regex_value(flat_text, r"da acquistare\s*(\d+)\s*anni"),
        "spesa_media_eur": regex_value(flat_text, r"Spesa media\s*~\s*([\d.,]+)"),
        "anno_costruzione": regex_value(flat_text, r"Anno costruzione\s*(\d{4})"),
        "superficie_mq": regex_value(flat_text, r"Superficie\s*([\d.]+)\s*m"),
        "piani": regex_value(flat_text, r"Piani\s*(\d+)"),
        "studenti_2023_2024": regex_value(flat_text, r"Studenti\s*2023/2024\s*(\d+)"),
        "variazione_annua_pct": regex_value(flat_text, r"Variazione annua\s*([+-]?\s*\d+(?:[,.]\d+)?)\s*%"),
        "trend_2015_2024_pct": regex_value(flat_text, r"Trend\s*2015\s*.\s*2024\s*([+-]?\s*\d+(?:[,.]\d+)?)\s*%"),
        "supplenti_provincia": regex_value(flat_text, r"Supplenze\s+.\s+Provincia di\s+\w+\s+(\d+)\s+supplenti"),
        "titolari_provincia": regex_value(flat_text, r"supplenti\s+(\d+)\s+titolari"),
        "pct_supplenti_provincia": regex_value(flat_text, r"titolari\s+([\d.,]+)\s*%\s+supplenti"),
    }

    inv_section = find_invalsi_section(soup)
    if inv_section:
        values = parse_school_invalsi_cards(inv_section)
        for (level, subject), value in zip(INVALSI_ORDER, values):
            key = f"invalsi_{subject.lower()}_{level.lower().replace(' ', '_')}_pct"
            result[key] = value
        source = next(
            (p for p in inv_section.find_all("p") if "Fonte: INVALSI" in clean_text(p)),
            None,
        )
        result["invalsi_fonte"] = clean_text(source) if source else None
        result["invalsi_nota_aggregazione"] = "media comunale"
    else:
        result["invalsi_nota_aggregazione"] = None

    return result


def find_invalsi_section(soup: BeautifulSoup):
    heading = soup.find(
        lambda tag: tag.name == "h2" and "Dati INVALSI" in clean_text(tag)
    )
    return heading.find_parent("section") if heading else None


def parse_school_invalsi_cards(section) -> list[str]:
    values: list[str] = []
    grid = section.find("div", class_=lambda cls: cls and "grid" in cls)
    if not grid:
        return values
    for card in grid.find_all("div", recursive=False):
        parts = [clean_text(div) for div in card.find_all("div", recursive=False)]
        percent = next((part for part in parts if part.endswith("%")), None)
        if percent:
            values.append(percent.replace("%", ""))
    return values


def parse_aggregate_page(soup: BeautifulSoup) -> tuple[list[dict[str, str | None]], dict[str, str | None]]:
    flat_text = re.sub(r"\s+", " ", soup.get_text(" ", strip=True)).strip()
    summary = {
        "comune": "MERATE",
        "provincia": "LECCO",
        "regione": "Lombardia",
        "scuole_totali_docente": regex_value(flat_text, r"Scuole di MERATE Provincia di LECCO - Lombardia\s*(\d+)\s*Scuole"),
        "anno_dati_invalsi": regex_value(flat_text, r"Scuole\s*(\d{4}-\d{2})\s*Anno dati INVALSI"),
    }

    rows: list[dict[str, str | None]] = []
    for heading in soup.find_all("h3"):
        title = clean_text(heading)
        if " - " not in title or "Superiore" not in title:
            continue

        card = heading.find_parent("div")
        if card:
            card = card.find_parent("div")
        if not card:
            continue

        subject, level = [part.strip() for part in title.split(" - ", 1)]
        row: dict[str, str | None] = {
            "materia": subject,
            "livello": level,
            "merate_pct": None,
            "lecco_pct": None,
            "lombardia_pct": None,
            "italia_pct": None,
            "delta_italia_punti": None,
        }

        for stat in card.select(".grid > div"):
            label_node = stat.find("div")
            value_node = label_node.find_next_sibling("div") if label_node else None
            if not label_node or not value_node:
                continue
            label = clean_text(label_node).lower()
            value = clean_text(value_node).replace("%", "")
            key = {
                "merate": "merate_pct",
                "lecco": "lecco_pct",
                "lombardia": "lombardia_pct",
                "italia": "italia_pct",
            }.get(label)
            if key:
                row[key] = value

        delta_match = re.search(r"([+-]?\d+(?:[,.]\d+)?)\s*punti sopra la media nazionale", clean_text(card))
        if delta_match:
            row["delta_italia_punti"] = delta_match.group(1)
        rows.append(row)

    return rows, summary


def write_csv(path: Path, rows: list[dict[str, str | None]], fieldnames: list[str]) -> None:
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key) for key in fieldnames})


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--comune", default=DEFAULT_COMUNE)
    parser.add_argument("--delay", type=float, default=0.2)
    args = parser.parse_args()

    OUT_DIR.mkdir(exist_ok=True)
    comune = args.comune.upper()
    search_url = f"{BASE_URL}/cerca?comune={comune}"
    aggregate_url = f"{BASE_URL}/migliori-scuole/{comune.lower()}"

    session = requests.Session()

    search_soup = fetch(session, search_url, args.delay)
    all_schools = parse_search_results(search_soup, search_url)

    aggregate_soup = fetch(session, aggregate_url, args.delay)
    aggregate_rows, aggregate_summary = parse_aggregate_page(aggregate_soup)

    superiori_links = [
        school for school in all_schools
        if school["grado_da_ricerca"] == "Scuola Secondaria di Secondo Grado"
    ]

    superiori_rows: list[dict[str, str | None]] = []
    for school in superiori_links:
        soup = fetch(session, school["url"], args.delay)
        parsed = parse_school_page(soup, school["url"])
        parsed["nome_da_ricerca"] = school["nome_da_ricerca"]
        parsed["grado_da_ricerca"] = school["grado_da_ricerca"]
        superiori_rows.append(parsed)

    write_csv(
        OUT_DIR / "docente_merate_scuole.csv",
        all_schools,
        ["codice", "nome_da_ricerca", "grado_da_ricerca", "url"],
    )

    school_fields = [
        "codice",
        "nome",
        "nome_da_ricerca",
        "grado",
        "grado_da_ricerca",
        "indirizzo",
        "url",
        "libri_in_media",
        "libri_da_acquistare",
        "anni",
        "spesa_media_eur",
        "anno_costruzione",
        "superficie_mq",
        "piani",
        "studenti_2023_2024",
        "variazione_annua_pct",
        "trend_2015_2024_pct",
        "supplenti_provincia",
        "titolari_provincia",
        "pct_supplenti_provincia",
        "invalsi_italiano_ii_superiore_pct",
        "invalsi_matematica_ii_superiore_pct",
        "invalsi_italiano_v_superiore_pct",
        "invalsi_matematica_v_superiore_pct",
        "invalsi_fonte",
        "invalsi_nota_aggregazione",
    ]
    write_csv(OUT_DIR / "docente_merate_superiori.csv", superiori_rows, school_fields)

    aggregate_fields = [
        "materia",
        "livello",
        "merate_pct",
        "lecco_pct",
        "lombardia_pct",
        "italia_pct",
        "delta_italia_punti",
    ]
    write_csv(
        OUT_DIR / "docente_merate_invalsi_aggregati_superiori.csv",
        aggregate_rows,
        aggregate_fields,
    )

    payload = {
        "source": {
            "search_url": search_url,
            "aggregate_url": aggregate_url,
        },
        "aggregate_summary": aggregate_summary,
        "all_schools": all_schools,
        "superiori": superiori_rows,
        "aggregate_invalsi_superiori": aggregate_rows,
    }
    (OUT_DIR / "docente_merate_superiori.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"Scuole trovate nel comune: {len(all_schools)}")
    print(f"Superiori trovate: {len(superiori_rows)}")
    print(f"Righe INVALSI aggregate superiori: {len(aggregate_rows)}")
    print(f"Output: {OUT_DIR.resolve()}")


if __name__ == "__main__":
    main()

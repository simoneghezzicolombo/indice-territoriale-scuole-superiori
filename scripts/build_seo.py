"""Build public HTML records from the exact dataset shipped with the application."""
from __future__ import annotations
import html
import json
import re
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "site"
BASE = "https://simoneghezzicolombo.github.io/indice-territoriale-scuole-superiori/"
DATA = json.loads((ROOT / "public/data/indice-comuni.json").read_text(encoding="utf-8"))
CITIES = DATA["comuni"]
SCHOOLS = json.loads((ROOT / "public/data/indirizzi-comuni.json").read_text(encoding="utf-8"))
DATE = DATA["meta"]["analysisDate"]
PERSON = {"@type": "Person", "@id": "https://simoneghezzicolombo.github.io/#person", "name": "Simone Ghezzi Colombo", "url": "https://simoneghezzicolombo.github.io/"}
CSS = """*{box-sizing:border-box}body{margin:0;background:#fcfcfc;color:#17313a;font:17px/1.65 system-ui,sans-serif}main,header,footer{max-width:1060px;margin:auto;padding:24px}header{border-bottom:1px solid #ccd9d6;display:flex;flex-wrap:wrap;gap:16px}a{color:#00605b;text-underline-offset:3px}h1{font-size:clamp(2rem,5vw,3.5rem);line-height:1.12;letter-spacing:-.04em}h2{line-height:1.3}p{max-width:78ch}.stats{display:flex;flex-wrap:wrap;gap:20px;padding:20px;background:#e9f3ef;border-radius:14px}.stats strong{display:block;font-size:1.8rem}.table{overflow:auto}table{border-collapse:collapse;width:100%;min-width:440px}th,td{text-align:left;padding:12px;border-bottom:1px solid #dbe5e2}th{background:#edf4f1}.links{columns:3;column-width:240px;list-style:none;padding:0}.links li{break-inside:avoid;padding:8px 0}nav a,header a{display:inline-block;padding:8px 0}footer{border-top:1px solid #ccd9d6;color:#526561;font-size:.9rem}.note{border-left:3px solid #00605b;padding-left:16px}:focus-visible{outline:3px solid #9b4f37;outline-offset:4px}@media(max-width:600px){main,header,footer{padding:18px}.stats{gap:12px}.links{columns:1}}"""


def e(value):
    return html.escape(str(value), quote=True)


def n(value, digits=2, lang="it"):
    if value is None:
        return "—"
    formatted = f"{value:,.{digits}f}"
    return formatted.replace(",", "X").replace(".", ",").replace("X", ".") if lang == "it" else formatted


def slug(value):
    import unicodedata
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def page(path, title, description, body, lang="it", alternate=None, dataset=None):
    url = BASE + path
    graph = [PERSON, {"@type": "WebPage", "@id": url + "#page", "url": url, "name": title, "description": description, "inLanguage": lang, "author": {"@id": PERSON["@id"]}}]
    if dataset:
        graph.append({"@type": "Dataset", "@id": url + "#dataset", "url": url, "name": title, "description": description, "creator": {"@id": PERSON["@id"]}, **dataset})
    language_links = '' if not alternate else ''.join(f'<link rel="alternate" hreflang="{key}" href="{BASE + value}">' for key, value in alternate.items())
    text = "Schede comunali" if lang == "it" else "Municipal data pages"
    prefix = "" if lang == "it" else "en/"
    switch = '' if not alternate else f'<a href="{BASE + alternate["en" if lang == "it" else "it"]}" lang="{"en" if lang == "it" else "it"}">{"English" if lang == "it" else "Italiano"}</a>'
    structured = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False).replace("</", "<\\/")
    result = f'''<!doctype html><html lang="{lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{e(title)}</title><meta name="description" content="{e(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><meta name="author" content="Simone Ghezzi Colombo"><link rel="canonical" href="{url}">{language_links}<meta property="og:type" content="website"><meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(description)}"><meta property="og:url" content="{url}"><meta property="og:image" content="{BASE}social-card.png"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="{BASE}favicon.svg"><link rel="sitemap" href="{BASE}sitemap.xml" type="application/xml"><style>{CSS}</style><script type="application/ld+json">{structured}</script></head><body><header><a href="{BASE + prefix}">Indice Territoriale Scuole Superiori</a><a href="{BASE + prefix}comuni/">{text}</a><a href="{BASE + prefix}metodo/">{"Metodo" if lang == "it" else "Methods"}</a>{switch}</header><main>{body}</main><footer><p>{"Snapshot dati" if lang == "it" else "Data snapshot"}: {DATE}. <a href="https://simoneghezzicolombo.github.io/">Simone Ghezzi Colombo</a> · <a href="https://github.com/simoneghezzicolombo/indice-territoriale-scuole-superiori">{"Codice, dati e fonti" if lang == "it" else "Code, data and sources"}</a></p><p>{"Progetto indipendente: confronta i comuni coperti dai dati disponibili, non tutte le scuole italiane. Non sostituisce le classifiche delle singole scuole e non stima effetti causali." if lang == "it" else "Independent research comparing municipalities covered by the available data. It does not rank every Italian school, replace individual-school rankings or estimate causal effects."}</p></footer></body></html>'''
    target = OUT / path / "index.html"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(result, encoding="utf-8")
    return url


def build():
    urls = [BASE, BASE + "en/"]
    regions = sorted({city["regione"] for city in CITIES})
    for lang in ("it", "en"):
        en = lang == "en"
        prefix = "en/" if en else ""
        for city in CITIES:
            name, index = city["comune"], n(city["indice"], lang=lang)
            title = f"{name}: upper-secondary school outcomes and index {index}" if en else f"Scuole superiori a {name}: indice territoriale {index} e risultati"
            description = (f"{name}, {city['provincia']}: rank {city['rank']} of {len(CITIES)} covered municipalities, index {index}. School tracks, graduate outcomes, data and methods." if en else f"{name}, {city['provincia']}: posizione {city['rank']} su {len(CITIES)} comuni coperti, indice {index}. Indirizzi scolastici, esiti dei diplomati, dati e metodo.")
            labels = [("Esiti delle prove nazionali (%)", "National-test outcome (%)", "docentePct"), ("Esiti universitari (FGA)", "University outcomes (FGA)", "uniScore"), ("Esiti lavorativi", "Employment outcome score", "lavoroScore"), ("Immatricolazione (%)", "University enrolment (%)", "immatricolazionePct"), ("Continuità universitaria (%)", "University continuation (%)", "continuitaPct")]
            metrics = ''.join(f'<tr><th>{b if en else a}</th><td>{n(city["absolute"].get(key), lang=lang)}</td></tr>' for a, b, key in labels)
            rows = ''.join(f'<tr><td>{e(row["scuola"])}<br><small>{e(row["codice"])}</small></td><td>{e(row["indirizzo"])}</td><td>{n(row["diplomati"], 0, lang)}</td><td>{n(row.get("uniScore"), lang=lang)}</td><td>{n(row.get("lavScore"), lang=lang)}</td></tr>' for row in SCHOOLS.get(city["id"], []))
            body = f'<p><a href="{BASE + prefix}regioni/{slug(city["regione"])}/">{e(city["regione"])}</a> · {e(city["provincia"])}</p><h1>{e(title)}</h1><p>{e(description)}</p><div class="stats"><div><strong>{index}</strong>{"Territorial index" if en else "Indice territoriale"}</div><div><strong>#{city["rank"]} / {len(CITIES)}</strong>{"National sample rank" if en else "Posizione nel campione nazionale"}</div><div><strong>{n(city["diplomati"], 0, lang)}</strong>{"Graduates included" if en else "Diplomati considerati"}</div></div><p class="note">{"100 is the comparative reference for the project index. The result is aggregated by municipality and weighted by school track and graduate count; it is not a score for each individual school." if en else "100 è il riferimento comparativo dell’indice. Il risultato è aggregato per comune e pesato per indirizzo e diplomati: non è un voto assegnato a ogni singola scuola."}</p><nav><a href="{BASE + prefix}?comune={city["id"]}&amp;lang={lang}">{"Open this municipality in the interactive map" if en else "Apri questo comune nella mappa interattiva"} ↗</a></nav><h2>{"Observed outcomes" if en else "Esiti osservati"}</h2><div class="table"><table><tbody>{metrics}<tr><th>{"Employment data coverage (%)" if en else "Copertura dei dati lavoro (%)"}</th><td>{n(city["coperturaLavoro"], lang=lang)}</td></tr></tbody></table></div><h2>{"Included schools and tracks" if en else "Scuole e indirizzi inclusi"}</h2><div class="table"><table><thead><tr><th>{"School and code" if en else "Istituto e codice"}</th><th>{"Track" if en else "Indirizzo"}</th><th>{"Graduates" if en else "Diplomati"}</th><th>FGA</th><th>{"Work" if en else "Lavoro"}</th></tr></thead><tbody>{rows}</tbody></table></div><p>{"A dash indicates an unavailable or inapplicable value; it is not zero." if en else "Il trattino indica un dato non disponibile o non applicabile, non un valore pari a zero."}</p><p><a href="{BASE}data/indice-comuni.json">JSON: {"municipal dataset" if en else "dataset comunale"}</a> · <a href="{BASE}data/indirizzi-comuni.json">JSON: {"school tracks" if en else "indirizzi scolastici"}</a></p>'
            path = f'{prefix}comuni/{city["id"]}/'
            urls.append(page(path, title, description, body, lang, {"it": f'comuni/{city["id"]}/', "en": f'en/comuni/{city["id"]}/', "x-default": f'comuni/{city["id"]}/'}, {"spatialCoverage": {"@type": "Place", "name": f"{name}, {city['provincia']}, Italy"}, "dateModified": DATE, "measurementTechnique": "Municipal aggregation weighted by school track and graduate count", "distribution": [{"@type": "DataDownload", "encodingFormat": "application/json", "contentUrl": BASE + "data/indice-comuni.json"}]}))
        def listing(cities):
            return '<div class="table"><table><thead><tr><th>#</th><th>' + ('Municipality' if en else 'Comune') + '</th><th>' + ('Index' if en else 'Indice') + '</th><th>' + ('Province' if en else 'Provincia') + '</th></tr></thead><tbody>' + ''.join(f'<tr><td>{city["rank"]}</td><td><a href="{BASE + prefix}comuni/{city["id"]}/">{e(city["comune"])}</a></td><td>{n(city["indice"], lang=lang)}</td><td>{e(city["provincia"])}</td></tr>' for city in cities) + '</tbody></table></div>'
        for region in regions:
            cities = [city for city in CITIES if city["regione"] == region]
            title = f'{region}: upper-secondary school outcomes by municipality' if en else f'Scuole superiori in {region}: indice e classifica dei comuni'
            description = f'{len(cities)} municipalities in {region}, from the 474-municipality national dataset.' if en else f'I {len(cities)} comuni coperti in {region}, dal dataset nazionale di 474 comuni.'
            urls.append(page(f'{prefix}regioni/{slug(region)}/', title, description, f'<h1>{e(title)}</h1><p>{e(description)}</p>{listing(cities)}', lang, {"it": f'regioni/{slug(region)}/', "en": f'en/regioni/{slug(region)}/'}))
        title = 'Upper-secondary school outcomes: all 474 municipalities' if en else 'Indice scuole superiori: tutti i 474 comuni'
        region_links = '<ul class="links">' + ''.join(f'<li><a href="{BASE + prefix}regioni/{slug(region)}/">{e(region)}</a></li>' for region in regions) + '</ul>'
        urls.append(page(prefix + 'comuni/', title, CONFIG_DESCRIPTION[lang], f'<h1>{title}</h1><p>{CONFIG_DESCRIPTION[lang]}</p>{region_links}{listing(CITIES)}', lang, {"it": "comuni/", "en": "en/comuni/"}))
        method_title = 'How to read the territorial school index' if en else 'Come leggere l’indice territoriale delle scuole superiori'
        method = ('The index compares the municipalities covered by the available sources, using outcomes weighted by school track and graduate count. Its comparative reference is 100. Municipal averages do not describe every student or school and do not identify causal effects. Missing observations are not zero. Source snapshots and coverage must be considered when comparing places.' if en else 'L’indice confronta i comuni coperti dalle fonti disponibili, combinando esiti pesati per indirizzo e numero di diplomati. Il riferimento comparativo è 100. Le medie comunali non descrivono ogni studente o ogni scuola e non identificano effetti causali. I valori mancanti non sono zeri. Data delle fonti e copertura vanno considerate nei confronti territoriali.')
        urls.append(page(prefix + 'metodo/', method_title, method, f'<h1>{method_title}</h1><p>{method}</p><h2>{"Sources and reproducibility" if en else "Fonti e riproducibilità"}</h2><ul><li><a href="https://eduscopio.it/">Eduscopio</a></li><li><a href="https://www.docente.it/">Docente.it</a></li><li><a href="https://www.invalsi.it/">INVALSI</a></li><li><a href="https://github.com/simoneghezzicolombo/indice-territoriale-scuole-superiori">Repository, pipeline e documentazione</a></li></ul>', lang, {"it": "metodo/", "en": "en/metodo/"}))
    shell = (OUT / 'index.html').read_text(encoding='utf-8')
    for lang, path in [('it', ''), ('en', 'en/')]:
        title = 'Territorial Upper Secondary School Index | Italy, 474 municipalities' if lang == 'en' else 'Indice territoriale scuole superiori | 474 comuni italiani'
        fallback = f'<main style="{CSS.split("body{")[1].split("}")[0]};padding:24px"><h1>{title}</h1><p>{CONFIG_DESCRIPTION[lang]}</p><p><a href="{BASE + path}comuni/">{"Browse all municipal data pages" if lang == "en" else "Consulta tutte le schede comunali"}</a> · <a href="{BASE + path}metodo/">{"Methods" if lang == "en" else "Metodo"}</a></p><p>{"The interactive map is loading. All data remain available through the HTML pages above." if lang == "en" else "Caricamento della mappa interattiva. I dati restano consultabili nelle pagine HTML collegate qui sopra."}</p></main>'
        document = re.sub(r'<div id="root">[\s\S]*?</div>', '<div id="root">' + fallback + '</div>', shell, count=1)
        document = re.sub(r'<html lang="[^"]+">', f'<html lang="{lang}">', document, count=1)
        document = re.sub(r'<title>.*?</title>', f'<title>{title}</title>', document, count=1)
        document = re.sub(r'<link rel="canonical"[^>]*>', f'<link rel="canonical" href="{BASE + path}">', document, count=1)
        document = document.replace('social-card.svg', 'social-card.png')
        document = re.sub(r'<meta\s+name="description"\s+content="[^"]*"\s*/?>', f'<meta name="description" content="{e(CONFIG_DESCRIPTION[lang])}">', document)
        for key, value in [('title', title), ('description', CONFIG_DESCRIPTION[lang]), ('url', BASE + path)]:
            document = re.sub(r'<meta\s+property="og:' + key + r'"\s+content="[^"]*"\s*/?>', f'<meta property="og:{key}" content="{e(value)}">', document)
        schema = json.dumps({'@context': 'https://schema.org', '@graph': [PERSON, {'@type': 'Dataset', '@id': BASE + '#dataset', 'url': BASE, 'name': title, 'description': CONFIG_DESCRIPTION[lang], 'creator': {'@id': PERSON['@id']}, 'dateModified': DATE, 'spatialCoverage': {'@type': 'Country', 'name': 'Italy'}, 'distribution': [{'@type': 'DataDownload', 'encodingFormat': 'application/json', 'contentUrl': BASE + 'data/indice-comuni.json'}]}]}, ensure_ascii=False)
        document = document.replace('</head>', f'<meta name="robots" content="index,follow,max-image-preview:large"><link rel="alternate" hreflang="it" href="{BASE}"><link rel="alternate" hreflang="en" href="{BASE}en/"><link rel="alternate" hreflang="x-default" href="{BASE}"><link rel="sitemap" href="{BASE}sitemap.xml"><script type="application/ld+json">{schema}</script>\n</head>', 1)
        target = OUT / path / 'index.html'
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(document, encoding='utf-8')
    (OUT / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + ''.join(f'<url><loc>{escape(url)}</loc></url>' for url in urls) + '</urlset>\n', encoding='utf-8')
    (OUT / 'llms.txt').write_text(f'# Territorial Upper Secondary School Index\n\n> {CONFIG_DESCRIPTION["en"]}\n\n- [Municipal data pages]({BASE}en/comuni/): 474 municipalities with observed outcomes and school tracks.\n- [Methods]({BASE}en/metodo/): definitions, sources and limitations.\n- [JSON dataset]({BASE}data/indice-comuni.json): machine-readable snapshot, {DATE}.\n\nAuthor: Simone Ghezzi Colombo. This is an independent research index, not an official government ranking. Missing data are not zero.\n', encoding='utf-8')
    print(f'Built {len(urls)} indexable URLs from {len(CITIES)} municipalities, snapshot {DATE}.')


CONFIG_DESCRIPTION = {'it': 'Indice comunale degli esiti delle scuole superiori in Italia: 474 comuni, dati pesati per indirizzo e diplomati, mappa interattiva e schede consultabili senza JavaScript.', 'en': 'Municipal index of upper-secondary school outcomes in Italy: 474 municipalities, outcomes weighted by school track and graduate count, interactive map and HTML data pages.'}

if __name__ == '__main__':
    build()

# Indice Territoriale Scuole Superiori

Analisi riproducibile dei comuni italiani con dati di scuola secondaria di II grado, incrociando:

- risultati aggregati Docente.it per comune;
- esiti Eduscopio per indirizzo;
- immatricolazione universitaria e continuita universitaria benchmarkate sullo Stato;
- esiti lavoro Eduscopio, pesati per la quota di diplomati coperti.

Snapshot corrente: 14 maggio 2026.

L'indice misura il territorio comunale come ecosistema di scuole superiori. Non e una classifica delle singole scuole.

## Risultato principale

Indice finale usato:

```text
100
+ 35% Docente vs Italia
+ 35% Eduscopio universita vs benchmark nazionale dello stesso indirizzo
+ 10% Esiti lavoro, pesati per quota diplomati coperti
+ 10% Immatricolazione universitaria vs Stato dello stesso indirizzo
+ 10% Continuita universitaria vs Stato dello stesso indirizzo
```

Top 10 nello snapshot:

| Rank | Comune | Provincia | Indice |
|---:|---|---|---:|
| 1 | Fossano | Cuneo | 119,52 |
| 2 | Merate | Lecco | 115,11 |
| 3 | Thiene | Vicenza | 114,55 |
| 4 | Sondrio | Sondrio | 113,95 |
| 5 | Desio | Monza e della Brianza | 113,73 |
| 6 | Presezzo | Bergamo | 113,60 |
| 7 | Castellana Grotte | Bari | 113,30 |
| 8 | Cuneo | Cuneo | 112,96 |
| 9 | Montebelluna | Treviso | 111,61 |
| 10 | Villorba | Treviso | 111,47 |

## Quick Start

```powershell
python -m venv .venv
. .venv/Scripts/Activate.ps1
pip install -r requirements.txt
python scripts/validate_outputs.py --strict
```

Per rigenerare i dati statici del sito:

```powershell
python scripts/build_site_data.py --strict
```

Per provare il sito in locale:

```powershell
python -m http.server 8000 -d site
```

Per rigenerare tutto da web:

```powershell
python scripts/run_pipeline.py --strict-validate
```

Se hai gia i CSV Docente e vuoi solo rigenerare Eduscopio/indici:

```powershell
python scripts/run_pipeline.py --skip-docente --strict-validate
```

Le cache locali vengono create in `output/cache_*` e sono escluse da Git.

## Output Principali

- `output/docente_eduscopio_indice_lavoro_copertura.csv`: classifica completa con il modello finale.
- `output/classifica_finale_lavoro_copertura_sintesi.csv`: versione ridotta e leggibile.
- `output/subranking_indicatori_comuni.csv`: ranking separati per indicatore.
- `output/subranking_indicatori_focus.csv`: ranking dei comuni focus.
- `output/docente_eduscopio_indirizzi_6i.csv`: dati per scuola/indirizzo.
- `site/data/indice-comuni.json`: dataset ottimizzato per la web app.
- `site/data/comuni-index.geojson`: confini comunali filtrati ai comuni con indice.
- `site/data/indirizzi-comuni.json`: scuole e indirizzi per la scheda comune.

## Sito

La web app statica vive in `site/` e viene pubblicata con GitHub Pages via GitHub Actions.
Il branch `gh-pages` contiene anche una copia statica pronta per il deploy classico.

Setup una tantum su GitHub:

```text
Settings -> Pages -> Build and deployment -> Source: GitHub Actions
```

In alternativa:

```text
Settings -> Pages -> Deploy from a branch -> gh-pages / root
```

URL pubblico:

```text
https://simoneghezzicolombo.github.io/indice-territoriale-scuole-superiori/
```

## Documentazione

- `docs/METHODOLOGY.md`: fonti, formula e caveat.
- `docs/DATA_DICTIONARY.md`: colonne principali.
- `docs/REPRODUCIBILITY.md`: comandi e controlli.
- `docs/GITHUB_REPO_SETUP.md`: impostazioni consigliate per pubblicare il repo.
- `docs/WEB_APP_PLAN.md`: piano per mappa, classifica e pagina GitHub Pages.
- `docs/PORTFOLIO_INTEGRATION.md`: card e integrazione con `simoneghezzicolombo.github.io`.
- `DATA_NOTICE.md`: nota su licenze e fonti dei dati.

## GitHub

Nome repo consigliato:

```powershell
indice-territoriale-scuole-superiori
```

URL GitHub Pages consigliato:

```text
https://simoneghezzicolombo.github.io/indice-territoriale-scuole-superiori/
```

Description:

```text
Indice comunale degli esiti delle scuole superiori in Italia, pesato per indirizzo e diplomati.
```

Per pubblicare dopo aver creato un repo vuoto su GitHub:

```powershell
git remote add origin https://github.com/<owner>/indice-territoriale-scuole-superiori.git
git push -u origin main
```

Vedi `docs/GITHUB_REPO_SETUP.md` per topics, GitHub Pages, licenza e checklist.

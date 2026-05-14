# Indice comuni scuole superiori

Analisi riproducibile dei comuni italiani con dati di scuola secondaria di II grado, incrociando:

- risultati aggregati Docente.it per comune;
- esiti Eduscopio per indirizzo;
- immatricolazione universitaria e continuita universitaria benchmarkate sullo Stato;
- esiti lavoro Eduscopio, pesati per la quota di diplomati coperti.

Snapshot corrente: 14 maggio 2026.

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

## Documentazione

- `docs/METHODOLOGY.md`: fonti, formula e caveat.
- `docs/DATA_DICTIONARY.md`: colonne principali.
- `docs/REPRODUCIBILITY.md`: comandi e controlli.
- `DATA_NOTICE.md`: nota su licenze e fonti dei dati.

## GitHub

Il repo e pensato per essere pubblicato cosi com'e. Prima di fare push, scegli nome e visibilita:

```powershell
git init
git add .
git commit -m "Add reproducible school-index analysis"
gh repo create <owner>/<repo> --private --source . --remote origin --push
```

Sostituisci `--private` con `--public` solo se vuoi pubblicare anche gli snapshot CSV.

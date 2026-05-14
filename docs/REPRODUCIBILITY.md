# Reproducibility

## Ambiente

Snapshot creato con:

- Python 3.13.9
- pandas 2.3.3
- requests 2.32.5
- beautifulsoup4 4.14.3

Installazione:

```powershell
python -m venv .venv
. .venv/Scripts/Activate.ps1
pip install -r requirements.txt
```

## Validare Lo Snapshot Versionato

```powershell
python scripts/validate_outputs.py --strict
```

Il controllo strict verifica:

- 490 comuni nel file finale;
- 474 comuni con indice finale valido;
- top 5: Fossano, Merate, Thiene, Sondrio, Desio.

## Rigenerare Tutto

```powershell
python scripts/run_pipeline.py --strict-validate
```

Passaggi eseguiti:

1. scrape Docente.it per i comuni in sitemap;
2. costruzione benchmark Eduscopio nazionale per indirizzo;
3. aggregazione scuola/indirizzo -> comune;
4. calcolo indice finale;
5. generazione subranking;
6. validazione.

## Rigenerare Solo Indici Eduscopio

Se `output/docente_italia_comuni_superiori_completi.csv` e gia presente:

```powershell
python scripts/run_pipeline.py --skip-docente --strict-validate
```

## Cache

Le cache sono rigenerate sotto:

- `output/cache_docente_migliori_scuole/`
- `output/cache_docente_scuole/`
- `output/cache_eduscopio_fair/`

Sono escluse da Git perche pesanti e derivate.

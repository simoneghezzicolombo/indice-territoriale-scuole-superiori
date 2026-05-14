# GitHub Repo Setup

## Nome

Nome consigliato:

```text
indice-territoriale-scuole-superiori
```

Nome esteso:

```text
Indice Territoriale Scuole Superiori
```

Descrizione GitHub:

```text
Indice comunale degli esiti delle scuole superiori in Italia, pesato per indirizzo e diplomati.
```

URL live previsto:

```text
https://simoneghezzicolombo.github.io/indice-territoriale-scuole-superiori/
```

## Topics

Consigliati:

```text
education
scuola
scuole-superiori
italy
comuni
data-journalism
open-data
eduscopio
docente
ranking
map
github-pages
```

## Visibilita

Consiglio iniziale: `private`.

Passa a `public` quando hai controllato:

- data notice;
- metodologia;
- licenza del codice;
- snapshot CSV da pubblicare;
- eventuale pagina GitHub Pages.

## Comandi Per Pubblicare

Questa cartella e gia un repo Git locale con branch `main` e commit iniziale.

Dopo aver creato un repo vuoto su GitHub:

```powershell
git remote add origin https://github.com/<owner>/indice-territoriale-scuole-superiori.git
git push -u origin main
```

Se usi SSH:

```powershell
git remote add origin git@github.com:<owner>/indice-territoriale-scuole-superiori.git
git push -u origin main
```

## GitHub Pages

Quando aggiungeremo la pagina web:

1. Settings -> Pages.
2. Source: GitHub Actions.
3. Aggiungere workflow dedicato, per esempio `.github/workflows/pages.yml`.
4. Servire un sito statico da `web/` oppure da `docs/`.
5. Aggiungere link di ritorno al portfolio: `https://simoneghezzicolombo.github.io/#projects`.

Consiglio: tenere la pipeline dati in Python e il sito statico separato in `web/`.

## Branch E Release

Workflow semplice:

- `main`: snapshot stabile;
- tag release: `snapshot-2026-05-14`;
- future release: `snapshot-YYYY-MM-DD`.

Comandi:

```powershell
git tag snapshot-2026-05-14
git push origin snapshot-2026-05-14
```

## Checklist Prima Del Public

- `python scripts/validate_outputs.py --strict` passa.
- README aggiornato con formula e top 10.
- `DATA_NOTICE.md` presente.
- Cache escluse da Git.
- File tracciati sotto circa 10 MB totali.
- GitHub Actions verde.
- Nessun dato personale o chiave API nel repo.

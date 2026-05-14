# Web App Plan

Obiettivo: una pagina GitHub Pages per esplorare l'Indice Territoriale Scuole Superiori con mappa, classifica e schede comune.

## Riferimenti Di Prodotto

Pattern utili:

- Il Sole 24 Ore Qualita della Vita: indice generale, aree tematiche e ranking territoriale.
- Openpolis: mappe comunali, indicatori e lettura territoriale.
- Eduscopio: confronto per indirizzo e schede di dettaglio.

La pagina non deve sembrare una landing page. Deve aprirsi direttamente con mappa + classifica.

## Prima Schermata

Layout consigliato:

- titolo: `Indice Territoriale Scuole Superiori`;
- sottotitolo breve: `Classifica comunale degli esiti delle superiori in Italia`;
- link alto a destra: `Back to portfolio`;
- mappa coropletica dei comuni;
- pannello laterale con top 20;
- search comune;
- filtri: regione, provincia, soglia diplomati, tipo indice.

## Viste

### Mappa

- colore per indice finale;
- tooltip: comune, rank, indice, provincia;
- click: apre scheda comune;
- legenda continua con 5 classi o scala percentile.

### Classifica

Colonne:

- rank;
- comune;
- provincia;
- indice finale;
- Docente;
- Eduscopio universita;
- lavoro pesato;
- immatricolazione;
- continuita;
- diplomati.

### Scheda Comune

Sezioni:

- indice finale e rank nazionale;
- componenti dell'indice;
- subranking;
- scuole/indirizzi Eduscopio nel comune;
- confronto rapido con altri comuni.

### Metodologia

Breve, leggibile:

```text
L'indice misura il territorio comunale, non la singola scuola.
Gli esiti Eduscopio sono confrontati per indirizzo e pesati per diplomati.
Gli esiti lavoro contano solo in proporzione ai diplomati coperti.
```

## Dati Necessari

Gia disponibili:

- `output/classifica_finale_lavoro_copertura_sintesi.csv`
- `output/docente_eduscopio_indice_lavoro_copertura.csv`
- `output/docente_eduscopio_indirizzi_6i.csv`
- `output/subranking_indicatori_comuni.csv`

Da aggiungere:

- confini comunali semplificati in GeoJSON/TopoJSON;
- mapping nome comune/provincia/codice ISTAT;
- export JSON ottimizzato per il browser.

## Struttura Web Consigliata

```text
web/
  index.html
  package.json
  src/
    main.ts
    styles.css
    data.ts
    map.ts
    ranking.ts
  public/
    data/
      comuni.topojson
      indice-comuni.json
      indirizzi-comuni.json
```

Stack consigliato:

- Vite;
- TypeScript;
- MapLibre GL oppure Leaflet;
- TopoJSON per tenere leggeri i confini comunali;
- PapaParse o conversione preventiva CSV -> JSON.

Per GitHub Pages, niente backend.

## Design

Tono:

- sobrio;
- data journalism;
- leggibile su desktop e mobile;
- niente hero decorativa.

Palette:

- base coerente con il portfolio: `#f7fbfb`, `#eef7f6`, `#17313a`;
- accento teal: `#177a74`;
- scala indice sequenziale leggibile, preferibilmente teal -> verde/blu, senza palette troppo arcobaleno;
- colore evidenza per comune selezionato.

Componenti:

- search box;
- tab `Mappa`, `Classifica`, `Indicatori`, `Metodo`;
- drawer/scheda comune;
- download CSV.

## Milestone

1. Preparare dataset JSON per web.
2. Aggiungere confini comunali semplificati.
3. Costruire mappa + tooltip.
4. Costruire classifica ordinabile.
5. Costruire scheda comune.
6. Aggiungere metodologia e download.
7. Attivare GitHub Pages.
8. Aggiungere card nel portfolio principale.
9. Aggiungere link dal progetto al portfolio.

## Caveat Da Mostrare Nel Sito

- Il livello territoriale e il comune.
- Docente.it e Eduscopio hanno granularita diverse.
- Alcuni comuni non hanno indice finale per copertura dati insufficiente.
- Gli esiti lavoro non sono disponibili per tutti gli indirizzi e sono pesati per copertura.

## Coerenza Con Il Portfolio

Il progetto deve essere un'estensione naturale di `simoneghezzicolombo.github.io`:

- stessa atmosfera public-interest data;
- titolo serif, interfaccia pulita, card leggere;
- niente hero marketing;
- primo viewport gia operativo con mappa e ranking;
- link evidente al portfolio principale.

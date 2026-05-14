# Methodology

## Scope

L'Indice Territoriale Scuole Superiori ha come unita di analisi il comune. Il progetto confronta comuni italiani con dati completi sulle scuole superiori, non singole scuole. Quando Eduscopio lavora a livello scuola/indirizzo, i risultati vengono aggregati a comune usando i diplomati come peso.

## Fonti

### Docente.it

Da `https://www.docente.it/migliori-scuole/` vengono estratti gli indicatori comunali:

- Italiano, II superiore;
- Matematica, II superiore;
- Italiano, V superiore;
- Matematica, V superiore.

Ogni indicatore viene trasformato in delta rispetto al valore Italia mostrato da Docente.it.

### Eduscopio

Da Eduscopio vengono raccolti, per scuola e indirizzo:

- esiti universita;
- esiti lavoro per tecnici/professionali;
- tasso di immatricolazione universitaria;
- continuita universitaria / non abbandono.

Gli score Eduscopio sono confrontati solo con scuole dello stesso indirizzo. Questo evita di penalizzare comuni con tecnici/professionali rispetto a comuni composti quasi solo da licei.

## Formula Finale

Colonna finale:

`indice_7i_lavoro_pesato_copertura_base100`

Formula:

```text
100
+ 0.35 * docente_delta_italia_punti
+ 0.35 * eduscopio_rel_punti_uni_only
+ 0.10 * esiti_lavoro_delta_pesato_copertura_punti
+ 0.10 * immatricolazione_delta_naz_punti
+ 0.10 * continuita_uni_delta_naz_punti
```

La componente lavoro e:

```text
esiti_lavoro_delta_pesato_copertura_punti =
  eduscopio_rel_punti_lavoro_only * quota_diplomati_con_esiti_lavoro_pct / 100
```

Questa scelta fa contare il lavoro solo per la quota di diplomati comunali per cui l'indicatore e pertinente e disponibile.

## Perche Non Usare un Solo Eduscopio Misto

Una versione precedente usava un Eduscopio gia misto:

- licei: universita;
- tecnici: 50% universita e 50% lavoro;
- professionali: lavoro.

Il modello finale separa universita e lavoro per rendere piu leggibile il contributo degli esiti lavoro e per pesarlo in base alla copertura.

## Benchmark

Tutti gli indicatori Eduscopio sono benchmarkati a livello nazionale per indirizzo, non contro una media comunale generica.

Per esempio:

- scientifico contro scientifico;
- tecnico tecnologico contro tecnico tecnologico;
- professionale servizi contro professionale servizi.

## Caveat

- Docente.it pubblica valori aggregati per comune, non per scuola.
- Gli indicatori Docente II e V superiore non seguono necessariamente la stessa coorte di studenti.
- Gli esiti lavoro non sono disponibili per tutti gli indirizzi, per questo sono pesati per copertura.
- Le cache locali sono escluse dal repo; una riesecuzione futura puo cambiare se le fonti cambiano.
- Gli snapshot CSV nel repo rappresentano la fotografia disponibile al 14 maggio 2026.

# Data Dictionary

## Output Finale

File: `output/docente_eduscopio_indice_lavoro_copertura.csv`

Colonne principali:

- `rank_indice_7i_lavoro_pesato_copertura`: ranking nazionale secondo il modello finale.
- `comune`, `provincia`, `regione`: identificativi territoriali.
- `indice_7i_lavoro_pesato_copertura_base100`: indice finale.
- `docente_delta_italia_punti`: media dei quattro delta Docente rispetto all'Italia.
- `eduscopio_rel_punti_uni_only`: risultato Eduscopio universita rispetto al benchmark nazionale dello stesso indirizzo, pesato per diplomati.
- `eduscopio_rel_punti_lavoro_only`: risultato lavoro Eduscopio rispetto al benchmark nazionale dello stesso indirizzo, pesato per diplomati coperti.
- `quota_diplomati_con_esiti_lavoro_pct`: quota dei diplomati Eduscopio del comune per cui sono disponibili esiti lavoro.
- `esiti_lavoro_delta_pesato_copertura_punti`: componente lavoro effettivamente usata nell'indice.
- `immatricolazione_delta_naz_punti`: immatricolazione universitaria rispetto al benchmark nazionale dello stesso indirizzo.
- `continuita_uni_delta_naz_punti`: continuita universitaria rispetto al benchmark nazionale dello stesso indirizzo.
- `peso_diplomati_eduscopio`: somma dei diplomati usati come pesi Eduscopio.
- `indice_affidabilita_score`: score diagnostico di affidabilita/stabilita, non usato nella formula finale.

## File Per Scuola/Indirizzo

File: `output/docente_eduscopio_indirizzi_6i.csv`

Colonne utili:

- `comune`: comune target.
- `cod_scuola`, `nome_scuola`: identificativo e nome scuola.
- `indirizzo_eduscopio`: indirizzo Eduscopio.
- `peso_diplomati`: diplomati per coorte usati come peso.
- `uni_score`: score universita normalizzato.
- `lav_score`: score lavoro normalizzato.
- `eduscopio_score_assoluto`: score usato per la componente Eduscopio mista.
- `eduscopio_rel_punti_indirizzo`: delta rispetto al benchmark nazionale dello stesso indirizzo.
- `immatricolazione_scuola_pct`: tasso immatricolazione universitaria della scuola/indirizzo.
- `continuita_uni_delta_naz_punti`: continuita universitaria rispetto al benchmark nazionale.

## Subranking

File: `output/subranking_indicatori_comuni.csv`

- `subranking`: indicatore ordinato.
- `rank`: posizione nel subranking.
- `valore`: valore usato per ordinare.
- `indice_7i_lavoro_pesato_copertura_base100`: indice finale del comune.

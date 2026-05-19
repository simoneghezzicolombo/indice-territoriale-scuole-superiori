const state = {
  comuni: [],
  comuniById: new Map(),
  geo: null,
  geoById: new Map(),
  indirizzi: {},
  selectedId: null,
  map: null,
  markerLayer: null,
  mapView: "comuni",
  mapFocus: "italia",
  mapMetric: "indice",
  rankingMetric: "indice",
  compareAId: null,
  compareBId: null,
  metricExtents: {},
};

const els = {};

const fmt0 = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0, useGrouping: true });
const fmt1 = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt2 = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DATA_VERSION = "20260519-ux";

const DIMENSIONS = [
  {
    key: "indice",
    subranking: "finale",
    short: "Totale",
    label: "Punteggio totale",
    color: "#17313a",
    pale: "#dfe9eb",
    value: (item) => item?.indice,
    valueLabel: (value) => (value == null ? "n.d." : `${fmt2.format(value)} punti`),
  },
  {
    key: "docente",
    subranking: "docente",
    short: "INVALSI",
    label: "Competenze INVALSI",
    color: "#177a74",
    pale: "#dff3f0",
    value: (item) => item?.docente,
    valueLabel: formatPoints,
  },
  {
    key: "eduscopioUni",
    subranking: "eduscopio_uni",
    short: "Università",
    label: "Esiti universitari",
    color: "#315e7d",
    pale: "#dfeaf1",
    value: (item) => item?.eduscopioUni,
    valueLabel: formatPoints,
  },
  {
    key: "lavoroCopertura",
    subranking: "lavoro_copertura",
    short: "Lavoro",
    label: "Esiti nel lavoro",
    color: "#7c5c9e",
    pale: "#eee7f4",
    value: (item) => item?.lavoroCopertura,
    valueLabel: formatPoints,
  },
  {
    key: "immatricolazione",
    subranking: "immatricolazione",
    short: "Iscrizione uni",
    label: "Accesso all'università",
    color: "#d9a441",
    pale: "#f6ecd0",
    value: (item) => item?.immatricolazione,
    valueLabel: formatPoints,
  },
  {
    key: "continuita",
    subranking: "continuita",
    short: "Continuità",
    label: "Continuità universitaria",
    color: "#77864b",
    pale: "#e9eed8",
    value: (item) => item?.continuita,
    valueLabel: formatPoints,
  },
];

const DIMENSIONS_BY_KEY = new Map(DIMENSIONS.map((dimension) => [dimension.key, dimension]));

const FOCUS_PRESETS = {
  italia: {
    label: "Italia",
    matches: () => true,
  },
  lombardia: {
    label: "Lombardia",
    matches: (item) => regionIn(item, ["Lombardia"]),
  },
  brianza: {
    label: "Brianza",
    matches: (item) => ["MB", "LC"].includes(item.provinciaSigla),
  },
  "nord-ovest": {
    label: "Nord-Ovest",
    matches: (item) => regionIn(item, ["Piemonte", "Valle d'Aosta", "Liguria", "Lombardia"]),
  },
  "nord-est": {
    label: "Nord-Est",
    matches: (item) => regionIn(item, ["Trentino-Alto Adige", "Veneto", "Friuli-Venezia Giulia", "Emilia-Romagna"]),
  },
  centro: {
    label: "Centro",
    matches: (item) => regionIn(item, ["Toscana", "Umbria", "Marche", "Lazio"]),
  },
  "sud-isole": {
    label: "Sud e Isole",
    matches: (item) => regionIn(item, ["Abruzzo", "Molise", "Campania", "Puglia", "Basilicata", "Calabria", "Sicilia", "Sardegna"]),
  },
  "aree-metropolitane": {
    label: "Aree metropolitane",
    matches: (item) => ["BA", "BO", "CA", "CT", "FI", "GE", "ME", "MI", "NA", "PA", "RC", "RM", "TO", "VE"].includes(item.provinciaSigla),
  },
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindElements();
  try {
    const [indexData, geoData, indirizziData] = await Promise.all([
      fetchJson(versionedDataUrl("data/indice-comuni.json")),
      fetchJson(versionedDataUrl("data/comuni-points.geojson")),
      fetchJson(versionedDataUrl("data/indirizzi-comuni.json")),
    ]);

    state.comuni = indexData.comuni;
    state.comuniById = new Map(state.comuni.map((item) => [item.id, item]));
    state.geo = geoData;
    state.geoById = new Map(geoData.features.map((feature) => [feature.properties.id, feature]));
    state.indirizzi = indirizziData;
    state.metricExtents = getMetricExtents(state.comuni);

    populateControls(indexData.meta);
    hydrateFromUrl();
    ensureCompareDefaults();
    bindEvents();
    initMap();
    renderGlobalStats(indexData.meta);
    renderInsights();
    renderAll({ fitMap: true });
  } catch (error) {
    showFatalError(error);
  }
}

function bindElements() {
  [
    "search-input",
    "comuni-options",
    "region-filter",
    "province-filter",
    "reset-filters",
    "filtered-count",
    "filtered-average",
    "ranking-body",
    "ranking-metric-controls",
    "ranking-score-label",
    "schools-body",
    "comune-detail",
    "compare-a",
    "compare-b",
    "compare-result",
    "insights-grid",
    "selected-chip",
    "selection-summary",
    "stat-comuni",
    "stat-top",
    "stat-baseline",
    "coverage-schools",
    "coverage-addresses",
    "coverage-comuni",
    "map-metric-controls",
    "map-view-controls",
    "map-focus-field",
    "map-focus-select",
    "legend-low",
    "legend-gradient",
    "legend-high",
  ].forEach((id) => {
    els[toCamel(id)] = document.getElementById(id);
  });
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Impossibile caricare ${url}`);
  }
  return response.json();
}

function versionedDataUrl(url) {
  return `${url}?v=${DATA_VERSION}`;
}

function populateControls(meta) {
  const sortedComuni = [...state.comuni].sort((a, b) => a.comune.localeCompare(b.comune, "it"));

  els.comuniOptions.innerHTML = sortedComuni
    .map((item) => `<option value="${escapeHtml(item.comune)}">${escapeHtml(item.provincia)}</option>`)
    .join("");

  els.regionFilter.innerHTML =
    '<option value="">Tutte</option>' +
    meta.regions.map((region) => `<option value="${escapeAttr(region)}">${escapeHtml(region)}</option>`).join("");

  populateProvinceOptions();
}

function populateProvinceOptions() {
  const selectedRegion = els.regionFilter.value;
  const province = [...new Set(
    state.comuni
      .filter((item) => !selectedRegion || item.regione === selectedRegion)
      .map((item) => item.provincia)
  )].sort((a, b) => a.localeCompare(b, "it"));

  els.provinceFilter.innerHTML =
    '<option value="">Tutte</option>' +
    province.map((item) => `<option value="${escapeAttr(item)}">${escapeHtml(item)}</option>`).join("");
}

function bindEvents() {
  const renderSearch = debounce(() => renderAll({ fitMap: false }), 120);
  els.searchInput.addEventListener("input", renderSearch);
  els.searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const first = getFilteredComuni()[0];
      if (first) {
        selectComune(first.id, { pan: true });
      }
    }
  });

  els.regionFilter.addEventListener("change", () => {
    populateProvinceOptions();
    els.provinceFilter.value = "";
    renderAll({ fitMap: true });
  });

  els.provinceFilter.addEventListener("change", () => renderAll({ fitMap: true }));

  els.resetFilters.addEventListener("click", () => {
    els.searchInput.value = "";
    els.regionFilter.value = "";
    populateProvinceOptions();
    els.provinceFilter.value = "";
    state.selectedId = null;
    state.compareAId = null;
    state.compareBId = null;
    ensureCompareDefaults();
    renderAll({ fitMap: true });
    updateUrl();
  });

  els.rankingBody.addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-id]");
    if (row) {
      selectComune(row.dataset.id, { pan: true });
    }
  });

  els.rankingMetricControls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-ranking-metric]");
    if (!button || !DIMENSIONS_BY_KEY.has(button.dataset.rankingMetric)) {
      return;
    }

    state.rankingMetric = button.dataset.rankingMetric;
    renderRanking(getFilteredComuni());
    renderRankingControls();
    updateUrl();
  });

  els.mapMetricControls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-map-metric]");
    if (!button || !DIMENSIONS_BY_KEY.has(button.dataset.mapMetric)) {
      return;
    }

    state.mapMetric = button.dataset.mapMetric;
    renderMapControls();
    renderMap(getFilteredComuni(), false);
    updateUrl();
  });

  els.mapViewControls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-map-view]");
    if (!button || !["comuni", "province", "focus"].includes(button.dataset.mapView)) {
      return;
    }

    state.mapView = button.dataset.mapView;
    renderMapControls();
    renderMap(getFilteredComuni(), true);
    updateUrl();
  });

  els.mapFocusSelect.addEventListener("change", () => {
    state.mapFocus = FOCUS_PRESETS[els.mapFocusSelect.value] ? els.mapFocusSelect.value : "italia";
    state.mapView = "focus";
    renderMapControls();
    renderMap(getFilteredComuni(), true);
    updateUrl();
  });

  bindCompareInput(els.compareA, "compareAId", { syncSelection: true });
  bindCompareInput(els.compareB, "compareBId", { syncSelection: false });
}

function initMap() {
  state.map = L.map("map", {
    zoomControl: false,
    scrollWheelZoom: true,
  }).setView([42.7, 12.6], 6);

  L.control.zoom({ position: "bottomright" }).addTo(state.map);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(state.map);

  state.markerLayer = L.featureGroup().addTo(state.map);

  setTimeout(() => state.map.invalidateSize(), 80);
}

function renderGlobalStats(meta) {
  const top = state.comuni[0];
  const schoolRows = Object.values(state.indirizzi).flat();
  const schoolIds = new Set(
    schoolRows.map((row) => row.codice || `${row.scuola || ""}|${row.indirizzo || ""}`)
  );
  els.statComuni.textContent = fmt0.format(meta.counts.rowsWithFinalIndex);
  els.statTop.textContent = `${top.comune} · ${fmt2.format(top.indice)} punti`;
  els.statBaseline.textContent = "100";
  els.coverageSchools.textContent = fmt0.format(schoolIds.size);
  els.coverageAddresses.textContent = fmt0.format(schoolRows.length);
  els.coverageComuni.textContent = fmt0.format(Object.keys(state.indirizzi).length);
}

function renderInsights() {
  const top = state.comuni[0];
  const second = state.comuni[1];
  const bestInvalsi = bestByDimension("docente");
  const bestLavoro = bestByDimension("lavoroCopertura");

  const insights = [
    {
      kicker: "Classifica finale",
      title: `${top.comune} guida l'indice`,
      text: `${fmt2.format(top.indice)} punti: è il valore più alto tra i comuni coperti.`,
    },
    {
      kicker: "Secondo posto",
      title: `${second.comune} segue a ${fmt2.format(second.indice)} punti`,
      text: communeProfile(second, reportDimensions(second)),
    },
    {
      kicker: "Competenze",
      title: `${bestInvalsi.comune} prima in INVALSI`,
      text: `${formatPoints(bestInvalsi.docente)} rispetto al livello neutro dell'indice.`,
    },
    {
      kicker: "Lavoro",
      title: `${bestLavoro.comune} emerge negli esiti lavorativi`,
      text: `${formatPoints(bestLavoro.lavoroCopertura)} considerando la copertura disponibile.`,
    },
  ];

  els.insightsGrid.innerHTML = insights
    .map((insight) => `
      <article>
        <span>${escapeHtml(insight.kicker)}</span>
        <strong>${escapeHtml(insight.title)}</strong>
        <p>${escapeHtml(insight.text)}</p>
      </article>
    `)
    .join("");
}

function renderAll(options = {}) {
  const filtered = getFilteredComuni();
  ensureSelection(filtered);
  ensureCompareDefaults();
  renderFilterStats(filtered);
  renderRankingControls();
  renderRanking(filtered);
  renderMapControls();
  renderMap(filtered, options.fitMap);
  renderSelected();
  renderCompare();
}

function renderMapControls() {
  const current = currentDimension();
  els.mapMetricControls.querySelectorAll("button[data-map-metric]").forEach((button) => {
    const dimension = DIMENSIONS_BY_KEY.get(button.dataset.mapMetric);
    const isActive = button.dataset.mapMetric === current.key;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
    button.style.setProperty("--metric-color", dimension?.color || current.color);
    button.style.setProperty("--metric-soft", dimension?.pale || current.pale);
    button.style.setProperty("--metric-ink", textColorForBackground(dimension?.color || current.color));
  });

  els.mapViewControls.querySelectorAll("button[data-map-view]").forEach((button) => {
    const isActive = button.dataset.mapView === state.mapView;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  els.mapFocusSelect.value = FOCUS_PRESETS[state.mapFocus] ? state.mapFocus : "italia";
  els.mapFocusSelect.disabled = state.mapView !== "focus";
  els.mapFocusField.classList.toggle("is-disabled", state.mapView !== "focus");
}

function renderRankingControls() {
  const current = currentRankingDimension();
  els.rankingScoreLabel.textContent = current.key === "indice" ? "Punteggio" : current.short;
  els.rankingMetricControls.querySelectorAll("button[data-ranking-metric]").forEach((button) => {
    const dimension = DIMENSIONS_BY_KEY.get(button.dataset.rankingMetric);
    const isActive = button.dataset.rankingMetric === current.key;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
    button.style.setProperty("--metric-color", dimension?.color || current.color);
    button.style.setProperty("--metric-soft", dimension?.pale || current.pale);
    button.style.setProperty("--metric-ink", textColorForBackground(dimension?.color || current.color));
  });
}

function getFilteredComuni() {
  const query = normalizeSearch(els.searchInput.value);
  const region = els.regionFilter.value;
  const province = els.provinceFilter.value;

  return state.comuni.filter((item) => {
    const haystack = normalizeSearch(`${item.comune} ${item.provincia} ${item.regione}`);
    return (
      (!query || haystack.includes(query)) &&
      (!region || item.regione === region) &&
      (!province || item.provincia === province)
    );
  });
}

function ensureSelection(filtered) {
  if (!filtered.length) {
    state.selectedId = null;
    return;
  }

  const selectedVisible = state.selectedId && filtered.some((item) => item.id === state.selectedId);
  if (selectedVisible) {
    return;
  }

  const query = normalizeSearch(els.searchInput.value);
  const exact = filtered.find((item) => normalizeSearch(item.comune) === query);
  state.selectedId = exact?.id || (filtered.length === 1 ? filtered[0].id : null);
}

function renderFilterStats(filtered) {
  els.filteredCount.textContent = fmt0.format(filtered.length);
  if (!filtered.length) {
    els.filteredAverage.textContent = "n.d.";
    return;
  }

  const average = filtered.reduce((sum, item) => sum + item.indice, 0) / filtered.length;
  els.filteredAverage.textContent = fmt2.format(average);
}

function renderRanking(filtered) {
  if (!filtered.length) {
    els.rankingBody.innerHTML = '<tr><td colspan="4" class="empty-state">Nessun comune nel filtro.</td></tr>';
    return;
  }

  const dimension = currentRankingDimension();
  const ranked = [...filtered].sort((a, b) => {
    const rankA = metricRank(a, dimension);
    const rankB = metricRank(b, dimension);
    if (rankA != null && rankB != null) return rankA - rankB;
    return safeValue(dimension.value(b)) - safeValue(dimension.value(a));
  });

  els.rankingBody.innerHTML = ranked
    .map((item) => {
      const selected = item.id === state.selectedId ? " is-selected" : "";
      const currentAttr = item.id === state.selectedId ? ' aria-current="true"' : "";
      const rank = metricRank(item, dimension) || item.rank;
      const value = dimension.value(item);
      return `
        <tr class="${selected}" data-id="${escapeAttr(item.id)}"${currentAttr}>
          <td><button class="rank-select" type="button" aria-label="Seleziona ${escapeAttr(item.comune)}">${rank}</button></td>
          <td class="commune-cell">
            <strong>${escapeHtml(item.comune)}</strong>
            <span>${escapeHtml(item.provinciaSigla || item.provincia)} &middot; ${escapeHtml(item.regione)}</span>
          </td>
          <td class="score">${formatRankingMetricCell(item, dimension, value)}</td>
          <td class="profile-cell">${profileBars(item)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderMap(filtered, fitMap = false) {
  const mapItems = getMapItems(filtered);
  const visibleIds = new Set(mapItems.map((item) => item.id));
  const features = state.geo.features.filter((feature) => visibleIds.has(feature.properties.id));

  state.markerLayer.clearLayers();
  renderMapLegend();
  if (state.mapView === "province") {
    renderProvinceMarkers(provinceAggregates(filtered));
  } else {
    renderMarkers(features);
    applySelectedMapStyle();
  }

  if (fitMap && state.markerLayer.getLayers().length) {
    const bounds = state.markerLayer.getBounds();
    if (bounds.isValid()) {
      state.map.fitBounds(bounds, { padding: [20, 20], maxZoom: 10 });
    }
  }
}

function getMapItems(filtered) {
  if (state.mapView !== "focus") {
    return filtered;
  }
  const preset = FOCUS_PRESETS[state.mapFocus] || FOCUS_PRESETS.italia;
  return filtered.filter((item) => preset.matches(item));
}

function provinceAggregates(items) {
  const dimension = currentDimension();
  const groups = new Map();

  items.forEach((item) => {
    const feature = state.geoById.get(item.id);
    if (!feature) return;

    const [lng, lat] = feature.geometry.coordinates;
    const key = item.provinciaSigla || item.provincia;
    const weight = Math.max(1, Number(item.diplomati) || 1);
    const value = dimension.value(item);
    const group = groups.get(key) || {
      key,
      provincia: item.provincia,
      provinciaSigla: item.provinciaSigla,
      regione: item.regione,
      count: 0,
      diplomati: 0,
      latSum: 0,
      lngSum: 0,
      coordWeight: 0,
      valueSum: 0,
      valueWeight: 0,
      value: null,
      rank: null,
    };

    group.count += 1;
    group.diplomati += Number(item.diplomati) || 0;
    group.latSum += lat * weight;
    group.lngSum += lng * weight;
    group.coordWeight += weight;
    if (Number.isFinite(value)) {
      group.valueSum += value * weight;
      group.valueWeight += weight;
    }
    groups.set(key, group);
  });

  const aggregates = [...groups.values()].map((group) => ({
    ...group,
    lat: group.latSum / group.coordWeight,
    lng: group.lngSum / group.coordWeight,
    value: group.valueWeight ? group.valueSum / group.valueWeight : null,
  }));

  aggregates
    .filter((record) => Number.isFinite(record.value))
    .sort((a, b) => b.value - a.value)
    .forEach((record, index) => {
      record.rank = index + 1;
    });

  return aggregates;
}

function renderMapLegend() {
  const dimension = currentDimension();
  const scope = state.mapView === "province"
    ? "Province"
    : state.mapView === "focus"
      ? FOCUS_PRESETS[state.mapFocus]?.label || "focus"
      : dimension.short;
  els.legendLow.textContent = `${scope}: più debole`;
  els.legendHigh.textContent = `${dimension.short} più forte`;
  els.legendGradient.style.background = `linear-gradient(90deg, ${dimension.pale}, ${dimension.color}, ${scaleColor(dimension.color, 0.55)})`;
}

function markerIcon(feature) {
  const item = state.comuniById.get(feature.properties.id);
  const dimension = currentDimension();
  const value = dimension.value(item);
  const rank = metricRank(item, dimension);
  const pct = metricPercent(value, dimension.key);
  const selected = feature.properties.id === state.selectedId;
  const showRank = rank != null && rank <= 5;
  const size = selected ? 27 : showRank ? 23 : Math.round(11 + pct * 10);
  const fill = colorForMetric(value, dimension);
  const ink = textColorForBackground(fill);
  const border = selected ? "#17313a" : "#ffffff";
  const rankLabel = showRank ? escapeHtml(rank) : "";

  return L.divIcon({
    className: "map-marker",
    html: `<span class="map-dot${showRank ? " has-rank" : ""}${selected ? " is-selected" : ""}" style="--dot-size:${size}px;--dot-fill:${fill};--dot-border:${border};--dot-ink:${ink};">${rankLabel}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function markerZIndex(feature) {
  const item = state.comuniById.get(feature.properties.id);
  const dimension = currentDimension();
  const rank = metricRank(item, dimension);
  const value = dimension.value(item);
  const selectedBoost = feature.properties.id === state.selectedId ? 2000 : 0;
  if (rank != null && rank <= 5) {
    return selectedBoost + 1000 - rank;
  }
  return selectedBoost + Math.round(metricPercent(value, dimension.key) * 200);
}

function renderMarkers(features) {
  features.forEach((feature) => {
    const [lng, lat] = feature.geometry.coordinates;
    const marker = L.marker([lat, lng], {
      icon: markerIcon(feature),
      keyboard: true,
      zIndexOffset: markerZIndex(feature),
    });
    const item = state.comuniById.get(feature.properties.id);
    const dimension = currentDimension();
    const rank = metricRank(item, dimension);
    const value = dimension.value(item);
    const rankText = rank == null ? "" : `${fmt0.format(rank)}ª posizione · `;
    marker.feature = feature;
    marker.bindTooltip(
      `<div class="map-tooltip"><strong>${rankText}${escapeHtml(feature.properties.comune)}</strong>${escapeHtml(feature.properties.provincia)} &middot; ${escapeHtml(dimension.label)}: ${escapeHtml(formatDimensionTooltip(item, dimension, value))}</div>`,
      { sticky: true }
    );
    marker.on("click", () => selectComune(feature.properties.id, { pan: false }));
    marker.addTo(state.markerLayer);
  });
}

function renderProvinceMarkers(records) {
  const maxDiplomati = Math.max(...records.map((record) => record.diplomati || 0), 1);
  records.forEach((record) => {
    const marker = L.marker([record.lat, record.lng], {
      icon: provinceMarkerIcon(record, maxDiplomati),
      keyboard: true,
      zIndexOffset: provinceMarkerZIndex(record),
    });
    const dimension = currentDimension();
    const rankText = record.rank && record.rank <= 5 ? `${fmt0.format(record.rank)}ª posizione · ` : "";
    marker.bindTooltip(
      `<div class="map-tooltip"><strong>${rankText}${escapeHtml(record.provincia)}</strong>${escapeHtml(record.regione)} &middot; ${escapeHtml(dimension.label)}: ${escapeHtml(formatDimensionValue(dimension, record.value))}<br>${fmt0.format(record.count)} comuni coperti, ${fmt0.format(record.diplomati)} diplomati</div>`,
      { sticky: true }
    );
    marker.on("click", () => selectProvince(record));
    marker.addTo(state.markerLayer);
  });
}

function provinceMarkerIcon(record, maxDiplomati) {
  const dimension = currentDimension();
  const pct = metricPercent(record.value, dimension.key);
  const rankLabel = record.rank && record.rank <= 5 ? escapeHtml(record.rank) : "";
  const size = Math.round(18 + Math.sqrt((record.diplomati || 1) / maxDiplomati) * 24);
  const fill = colorForMetric(record.value, dimension);
  const ink = textColorForBackground(fill);

  return L.divIcon({
    className: "map-marker",
    html: `<span class="map-dot map-dot-province${rankLabel ? " has-rank" : ""}" style="--dot-size:${size}px;--dot-fill:${fill};--dot-border:#ffffff;--dot-ink:${ink};--dot-alpha:${0.72 + pct * 0.24};">${rankLabel}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function provinceMarkerZIndex(record) {
  const dimension = currentDimension();
  if (record.rank && record.rank <= 5) {
    return 1000 - record.rank;
  }
  return Math.round(metricPercent(record.value, dimension.key) * 200);
}

function selectProvince(record) {
  els.searchInput.value = "";
  els.regionFilter.value = record.regione || "";
  populateProvinceOptions();
  els.provinceFilter.value = record.provincia || "";
  state.mapView = "comuni";
  renderAll({ fitMap: true });
  updateUrl();
}

function applySelectedMapStyle() {
  state.markerLayer.eachLayer((layer) => {
    if (!layer.feature?.properties?.id) {
      return;
    }
    layer.setIcon(markerIcon(layer.feature));
    layer.setZIndexOffset(markerZIndex(layer.feature));
    if (layer.feature.properties.id === state.selectedId && typeof layer.bringToFront === "function") {
      layer.bringToFront();
    }
  });
}

function selectComune(id, options = {}) {
  if (!state.comuniById.has(id)) {
    return;
  }

  state.selectedId = id;
  syncCompareForSelection(id);
  ensureCompareDefaults();
  const filtered = getFilteredComuni();
  renderSelected();
  renderRanking(filtered);
  renderCompare();

  if (options.pan && state.mapView !== "comuni") {
    state.mapView = "comuni";
    renderMapControls();
    renderMap(filtered, false);
  } else {
    applySelectedMapStyle();
  }
  updateUrl();

  if (options.pan) {
    const layer = findLayerById(id);
    if (layer) {
      state.map.setView(layer.getLatLng(), Math.max(state.map.getZoom(), 9), { animate: true });
    }
  }
}

function syncCompareForSelection(id) {
  if (!state.compareAId) {
    state.compareAId = id;
    return;
  }
  if (state.compareAId !== id) {
    state.compareBId = id;
  }
}

function findLayerById(id) {
  let match = null;
  state.markerLayer.eachLayer((layer) => {
    if (layer.feature?.properties?.id === id) {
      match = layer;
    }
  });
  return match;
}

function renderSelected() {
  const item = state.comuniById.get(state.selectedId);
  if (!item) {
    els.selectedChip.textContent = "Seleziona un comune";
    els.selectionSummary.innerHTML = `
      <strong>Nessun comune selezionato</strong>
      <span>Clicca un punto o una riga della classifica per fissare il territorio da leggere.</span>
    `;
    els.comuneDetail.innerHTML = `
      <div class="empty-state">
        Seleziona un punto sulla mappa o una riga della classifica per leggere la scheda territoriale.
      </div>
    `;
    els.schoolsBody.innerHTML = '<tr><td colspan="5" class="empty-state">Nessun dato.</td></tr>';
    return;
  }

  els.selectedChip.textContent = `${item.rank}ª posizione · ${item.comune} · ${fmt2.format(item.indice)} punti`;
  renderSelectionSummary(item);
  renderDetail(item);
  renderSchools(item.id);
}

function renderSelectionSummary(item) {
  const rows = reportDimensions(item);
  const strongest = rows
    .filter((row) => Number.isFinite(row.value))
    .sort((a, b) => b.value - a.value)[0];
  const area = areaBenchmarks(item);
  const strongestText = strongest
    ? `${strongest.dimension.short}: ${formatPoints(strongest.value)}`
    : "profilo non disponibile";

  els.selectionSummary.innerHTML = `
    <div>
      <span>Comune selezionato</span>
      <strong>${escapeHtml(item.comune)}</strong>
      <em>${fmt0.format(item.rank)}ª posizione · ${fmt2.format(item.indice)} punti</em>
    </div>
    <p>${escapeHtml(strongestText)}</p>
    <dl>
      <div><dt>Provincia</dt><dd>${escapeHtml(area.province.label)}</dd></div>
      <div><dt>Regione</dt><dd>${escapeHtml(area.region.label)}</dd></div>
      <div><dt>Italia</dt><dd>${escapeHtml(area.national.label)}</dd></div>
    </dl>
    <a href="#comune-detail">Apri pagella completa</a>
  `;
}

function renderDetail(item) {
  const components = [
    {
      key: "docente",
      label: "Competenze INVALSI",
      value: item.docente,
      weight: "35%",
      note: "Quota di studenti sopra i traguardi previsti in italiano e matematica.",
    },
    {
      key: "eduscopioUni",
      label: "Esiti universitari",
      value: item.eduscopioUni,
      weight: "35%",
      note: "FGA Eduscopio: voti e crediti universitari degli ex studenti.",
    },
    {
      key: "lavoroCopertura",
      label: "Esiti nel lavoro",
      value: item.lavoroCopertura,
      weight: "10%",
      note: "Occupazione e coerenza tra lavoro trovato e percorso di studi.",
    },
    {
      key: "immatricolazione",
      label: "Accesso all'università",
      value: item.immatricolazione,
      weight: "10%",
      note: "Quanti diplomati si iscrivono all'università.",
    },
    {
      key: "continuita",
      label: "Continuità universitaria",
      value: item.continuita,
      weight: "10%",
      note: "Quanti continuano senza abbandonare presto.",
    },
  ];
  const reportRows = reportDimensions(item);
  const profile = communeProfile(item, reportRows);
  const area = areaBenchmarks(item);

  els.comuneDetail.innerHTML = `
    <div class="detail-hero">
      <div>
        <p class="eyebrow">Scheda comune</p>
        <h2>${escapeHtml(item.comune)}</h2>
        <p class="lede">${escapeHtml(item.provincia)} &middot; ${escapeHtml(item.regione)}</p>
        <p class="detail-reading">${escapeHtml(profile)}</p>
      </div>
      <div class="rank-badge" aria-label="Posizione nazionale">
        <span>Posizione</span>
        <strong>${item.rank}</strong>
      </div>
    </div>

    <div class="metric-grid">
      ${metric("Punteggio totale", `${fmt2.format(item.indice)} punti`)}
      ${metric("Diplomati considerati", fmt0.format(item.diplomati || 0))}
      ${metric("Indirizzi inclusi", fmt0.format(item.indirizzi || 0))}
      ${metric("Copertura dati", item.affidabilita == null ? "n.d." : `${fmt1.format(item.affidabilita)}%`)}
      ${metric("Lavoro: dati presenti", item.coperturaLavoro == null ? "n.d." : `${fmt1.format(item.coperturaLavoro)}%`)}
    </div>

    <h3>Confronto territoriale</h3>
    <div class="benchmark-grid">
      ${benchmarkCard("Provincia", area.province)}
      ${benchmarkCard("Regione", area.region)}
      ${benchmarkCard("Italia", area.national)}
    </div>

    <h3>Pagella del comune</h3>
    <div class="report-card" role="table" aria-label="Pagella del comune">
      ${reportRows.map((row) => reportRow(row)).join("")}
    </div>

    <h3>Composizione dell'indice</h3>
    <div class="components">
      ${components.map((component) => componentRow(component)).join("")}
    </div>

    <h3>Quanto pesano gli indirizzi</h3>
    <div class="macro-grid">
      ${macroCard("Licei", item.macro.licei)}
      ${macroCard("Tecnici", item.macro.tecnici)}
      ${macroCard("Professionali", item.macro.professionali)}
    </div>

    <h3>Classifiche per dimensione</h3>
    <div class="subranking-grid">
      ${subrankCard("Totale", item.subrankings.finale)}
      ${subrankCard("Competenze INVALSI", item.subrankings.docente)}
      ${subrankCard("Esiti universitari", item.subrankings.eduscopio_uni)}
      ${subrankCard("Lavoro", item.subrankings.lavoro_copertura)}
    </div>
  `;
}

function metric(label, value) {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function benchmarkCard(label, data) {
  return `
    <div class="benchmark-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(data.label)}</strong>
      <em>${escapeHtml(data.diffLabel)}</em>
    </div>
  `;
}

function areaBenchmarks(item) {
  return {
    province: benchmarkData(item, state.comuni.filter((candidate) => candidate.provincia === item.provincia)),
    region: benchmarkData(item, state.comuni.filter((candidate) => candidate.regione === item.regione)),
    national: benchmarkData(item, state.comuni),
  };
}

function benchmarkData(item, items) {
  const average = weightedAverage(items, (candidate) => candidate.indice, (candidate) => candidate.diplomati);
  if (!Number.isFinite(average)) {
    return {
      label: "n.d.",
      diffLabel: "confronto non disponibile",
    };
  }

  const diff = item.indice - average;
  const direction = diff >= 0 ? "sopra" : "sotto";
  return {
    label: `${fmt2.format(average)} punti`,
    diffLabel: `${direction} di ${fmt2.format(Math.abs(diff))}`,
  };
}

function weightedAverage(items, valueGetter, weightGetter) {
  let total = 0;
  let weightTotal = 0;
  items.forEach((item) => {
    const value = valueGetter(item);
    const weight = Math.max(1, Number(weightGetter(item)) || 1);
    if (!Number.isFinite(value)) {
      return;
    }
    total += value * weight;
    weightTotal += weight;
  });
  return weightTotal ? total / weightTotal : null;
}

function reportDimensions(item) {
  return DIMENSIONS
    .filter((dimension) => dimension.key !== "indice")
    .map((dimension) => {
      const value = dimension.value(item);
      return {
        item,
        dimension,
        value,
        rank: metricRank(item, dimension),
        reading: dimensionReading(item, dimension, value),
      };
    });
}

function reportRow(row) {
  const absolute = absoluteDimensionLabel(row.item, row.dimension);
  const value = formatDimensionValue(row.dimension, row.value);
  const rank = row.rank == null ? "n.d." : `${fmt0.format(row.rank)}°`;
  return `
    <div class="report-row" style="--component-color:${row.dimension.color};--component-soft:${row.dimension.pale}" role="row">
      <span class="report-dimension" role="cell">${escapeHtml(row.dimension.label)}</span>
      <strong class="report-absolute" role="cell">${escapeHtml(absolute)}</strong>
      <span class="report-delta" role="cell">${escapeHtml(value)} · ${escapeHtml(rank)}</span>
      <em role="cell">${escapeHtml(row.reading)}</em>
    </div>
  `;
}

function communeProfile(item, rows) {
  const scoreLabel = scoreReading(item.indice);
  const best = rows
    .filter((row) => Number.isFinite(row.value))
    .sort((a, b) => b.value - a.value)[0];
  const caveat = item.coperturaLavoro != null && item.coperturaLavoro < 50
    ? " I dati sul lavoro sono parziali."
    : "";
  if (!best) {
    return `Profilo ${scoreLabel}.`;
  }
  return `Profilo ${scoreLabel}: punto più forte su ${best.dimension.label.toLowerCase()}.${caveat}`;
}

function scoreReading(score) {
  if (!Number.isFinite(score)) return "non disponibile";
  if (score >= 110) return "molto forte";
  if (score >= 103) return "forte";
  if (score >= 97) return "stabile";
  if (score >= 90) return "fragile";
  return "molto fragile";
}

function dimensionReading(item, dimension, value) {
  if (!Number.isFinite(value)) return "non disponibile";
  if (dimension.key === "lavoroCopertura" && item.coperturaLavoro != null && item.coperturaLavoro < 50) {
    return value >= 0 ? "sopra la media, copertura parziale" : "debole, copertura parziale";
  }
  if (value >= 15) return "molto forte";
  if (value >= 6) return "forte";
  if (value >= -3) return "stabile";
  if (value >= -10) return "fragile";
  return "molto fragile";
}

function profileBars(item) {
  const values = [
    [DIMENSIONS_BY_KEY.get("docente"), item.docente],
    [DIMENSIONS_BY_KEY.get("eduscopioUni"), item.eduscopioUni],
    [DIMENSIONS_BY_KEY.get("lavoroCopertura"), item.lavoroCopertura],
    [DIMENSIONS_BY_KEY.get("immatricolazione"), item.immatricolazione],
    [DIMENSIONS_BY_KEY.get("continuita"), item.continuita],
  ];
  return `
    <div class="profile-bars" aria-label="Profilo sintetico delle cinque componenti">
      ${values
        .map(([dimension, value]) => {
          const height = value == null ? 12 : Math.max(10, Math.min(34, 12 + Math.abs(value) * 0.55));
          const color = value == null ? "#d8e7e5" : dimension.color;
          return `<span title="${escapeAttr(`${dimension.label}: ${formatSigned(value)}`)}" style="--h:${height}px;--c:${color}"></span>`;
        })
        .join("")}
    </div>
  `;
}

function componentRow(component) {
  const { key, label, value, weight, note } = component;
  const dimension = DIMENSIONS_BY_KEY.get(key) || currentDimension();
  const width = value == null ? 0 : Math.min(100, (Math.abs(value) / 35) * 100);
  return `
    <div class="component-row" style="--component-color:${dimension.color};--component-soft:${dimension.pale}">
      <div class="component-name">
        <strong>${escapeHtml(label)}</strong>
        <span>Peso ${escapeHtml(weight)} &middot; ${escapeHtml(note)}</span>
      </div>
      <div class="bar-track"><span style="--w:${width.toFixed(1)}%"></span></div>
      <div class="component-value ${deltaClass(value)}">${formatPoints(value)}</div>
    </div>
  `;
}

function macroCard(label, macro) {
  const delta = macro?.delta;
  const peso = macro?.peso || 0;
  return `
    <div class="macro-card">
      <span>${escapeHtml(label)} &middot; ${fmt0.format(peso)} diplomati</span>
      <strong class="${deltaClass(delta)}">${formatPoints(delta)}</strong>
    </div>
  `;
}

function subrankCard(label, data) {
  const rank = data?.rank ? `${fmt0.format(data.rank)}ª posizione` : "n.d.";
  const formattedValue = data?.value == null
    ? ""
    : label === "Totale"
      ? `${fmt2.format(data.value)} punti`
      : `${formatSigned(data.value)} punti`;
  const value = formattedValue ? ` <span class="subrank-value">&middot; ${escapeHtml(formattedValue)}</span>` : "";
  return `
    <div class="subrank-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(rank)}${value}</strong>
    </div>
  `;
}

function renderSchools(id) {
  const rows = state.indirizzi[id] || [];
  if (!rows.length) {
    els.schoolsBody.innerHTML = '<tr><td colspan="5" class="empty-state">Nessun indirizzo Eduscopio disponibile.</td></tr>';
    return;
  }

  els.schoolsBody.innerHTML = rows
    .map((row) => `
      <tr>
        <td class="school-cell" data-label="Scuola">
          <strong>${escapeHtml(row.scuola || "n.d.")}</strong>
          <span>${escapeHtml(row.codice || "")}</span>
        </td>
        <td data-label="Indirizzo">${escapeHtml(row.indirizzo || "n.d.")}</td>
        <td data-label="Diplomati">${fmt0.format(row.diplomati || 0)}</td>
        <td data-label="Università"><span class="${deltaClass(row.uniDelta)}">${formatSigned(row.uniDelta)}</span></td>
        <td data-label="Lavoro"><span class="${deltaClass(row.lavDelta)}">${formatSigned(row.lavDelta)}</span></td>
      </tr>
    `)
    .join("");
}

function renderCompare() {
  ensureCompareDefaults();
  const first = state.comuniById.get(state.compareAId);
  const second = state.comuniById.get(state.compareBId);

  els.compareA.value = first?.comune || "";
  els.compareB.value = second?.comune || "";

  if (!first || !second) {
    els.compareResult.innerHTML = '<div class="empty-state">Seleziona due comuni per confrontarli.</div>';
    return;
  }

  const diff = first.indice - second.indice;
  const diffText = diff === 0 ? "pari nell'indice finale" : diff > 0 ? `${first.comune} avanti` : `${second.comune} avanti`;
  els.compareResult.innerHTML = `
    <div class="compare-summary">
      <div>
        <span>${escapeHtml(first.comune)}</span>
        <strong>${fmt2.format(first.indice)}</strong>
        <p>${first.rank}° posto · ${escapeHtml(scoreReading(first.indice))}</p>
      </div>
      <div>
        <span>Differenza</span>
        <strong>${formatPoints(diff)}</strong>
        <p>${escapeHtml(diffText)}</p>
      </div>
      <div>
        <span>${escapeHtml(second.comune)}</span>
        <strong>${fmt2.format(second.indice)}</strong>
        <p>${second.rank}° posto · ${escapeHtml(scoreReading(second.indice))}</p>
      </div>
    </div>
    <div class="compare-bars">
      ${DIMENSIONS.filter((dimension) => dimension.key !== "indice").map((dimension) => compareBar(first, second, dimension)).join("")}
    </div>
  `;
}

function compareBar(first, second, dimension) {
  const firstValue = dimension.value(first);
  const secondValue = dimension.value(second);
  return `
    <div class="compare-row" style="--component-color:${dimension.color};--component-soft:${dimension.pale}">
      <div class="compare-name">
        <strong>${escapeHtml(dimension.label)}</strong>
        <span>${escapeHtml(dimensionReading(first, dimension, firstValue))} · ${escapeHtml(dimensionReading(second, dimension, secondValue))}</span>
      </div>
      ${compareValue(first, firstValue, dimension)}
      ${compareValue(second, secondValue, dimension)}
    </div>
  `;
}

function compareValue(item, value, dimension) {
  const contribution = compareContribution(value);
  return `
    <div class="compare-value">
      <span>${escapeHtml(item.comune)}</span>
      <div class="compare-track" aria-label="Contributo rispetto allo zero">
        <i class="${contribution.className}" style="--w:${contribution.width};"></i>
      </div>
      <strong>${escapeHtml(absoluteDimensionLabel(item, dimension))}</strong>
      <span>${escapeHtml(formatDimensionValue(dimension, value))}</span>
    </div>
  `;
}

function compareContribution(value) {
  if (!Number.isFinite(value)) {
    return { className: "", width: "0%" };
  }
  const width = `${(Math.min(Math.abs(value), 35) / 35 * 50).toFixed(1)}%`;
  return {
    className: value < 0 ? "is-negative" : "is-positive",
    width,
  };
}

function ensureCompareDefaults() {
  if (!state.compareAId && state.selectedId) {
    state.compareAId = state.selectedId;
  }
  if (!state.compareAId) {
    state.compareAId = state.comuni[0]?.id || null;
  }
  if (!state.compareBId || state.compareBId === state.compareAId) {
    const fallback = state.comuni.find((item) => item.id !== state.compareAId);
    state.compareBId = fallback?.id || null;
  }
}

function bindCompareInput(input, stateKey, options = {}) {
  const apply = () => {
    const match = findComuneByText(input.value);
    if (!match) {
      renderCompare();
      return;
    }
    state[stateKey] = match.id;
    ensureCompareDefaults();
    if (options.syncSelection) {
      selectComune(match.id, { pan: true });
      return;
    }
    renderCompare();
    updateUrl();
  };

  input.addEventListener("change", apply);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      apply();
    }
  });
}

function formatSigned(value) {
  if (value == null || Number.isNaN(value)) {
    return "n.d.";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${fmt2.format(value)}`;
}

function formatPoints(value) {
  const formatted = formatSigned(value);
  return formatted === "n.d." ? formatted : `${formatted} punti`;
}

function deltaClass(value) {
  if (value == null || Number.isNaN(value)) return "";
  return value >= 0 ? "delta-positive" : "delta-negative";
}

function debounce(callback, delay) {
  let timeoutId = null;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => callback(...args), delay);
  };
}

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function hydrateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const comune = params.get("comune") || window.location.hash.replace("#", "");
  const base = params.get("base");
  const compare = params.get("confronta");
  const classifica = params.get("classifica");
  const mappa = params.get("mappa");
  const vista = params.get("vista");
  const territorio = params.get("territorio");

  const selected = comune ? findComuneByText(comune) : null;
  if (selected) {
    state.selectedId = selected.id;
    state.compareAId = selected.id;
  }

  const baseItem = base ? findComuneByText(base) : null;
  if (baseItem) {
    state.compareAId = baseItem.id;
  }

  const compareItem = compare ? findComuneByText(compare) : null;
  if (compareItem) {
    state.compareBId = compareItem.id;
  }

  if (classifica && DIMENSIONS_BY_KEY.has(classifica)) {
    state.rankingMetric = classifica;
  }
  if (mappa && DIMENSIONS_BY_KEY.has(mappa)) {
    state.mapMetric = mappa;
  }
  if (vista && ["comuni", "province", "focus"].includes(vista)) {
    state.mapView = vista;
  }
  if (territorio && FOCUS_PRESETS[territorio]) {
    state.mapFocus = territorio;
    state.mapView = "focus";
  }
}

function updateUrl() {
  const params = new URLSearchParams();
  if (state.selectedId) {
    params.set("comune", state.selectedId);
    if (state.compareAId && state.compareAId !== state.selectedId) params.set("base", state.compareAId);
    if (state.compareBId && state.compareBId !== state.compareAId) params.set("confronta", state.compareBId);
  }
  if (state.rankingMetric !== "indice") params.set("classifica", state.rankingMetric);
  if (state.mapMetric !== "indice") params.set("mappa", state.mapMetric);
  if (state.mapView !== "comuni") params.set("vista", state.mapView);
  if (state.mapView === "focus" && state.mapFocus !== "italia") params.set("territorio", state.mapFocus);
  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}`;
  window.history.replaceState(null, "", nextUrl);
}

function findComuneByText(value) {
  const normalized = normalizeSearch(value);
  if (!normalized) return null;
  return (
    state.comuniById.get(value) ||
    state.comuni.find((item) => normalizeSearch(item.id) === normalized) ||
    state.comuni.find((item) => normalizeSearch(item.comune) === normalized) ||
    state.comuni.find((item) => normalizeSearch(`${item.comune} ${item.provincia}`) === normalized) ||
    state.comuni.find((item) => normalizeSearch(`${item.comune} ${item.provinciaSigla}`) === normalized) ||
    null
  );
}

function regionIn(item, regions) {
  const current = normalizeSearch(item?.regione);
  return regions.some((region) => current === normalizeSearch(region));
}

function currentDimension() {
  return DIMENSIONS_BY_KEY.get(state.mapMetric) || DIMENSIONS[0];
}

function currentRankingDimension() {
  return DIMENSIONS_BY_KEY.get(state.rankingMetric) || DIMENSIONS[0];
}

function metricRank(item, dimension) {
  if (!item) return null;
  return item.subrankings?.[dimension.subranking]?.rank || (dimension.key === "indice" ? item.rank : null);
}

function formatDimensionValue(dimension, value) {
  return dimension.valueLabel(value);
}

function formatDimensionTooltip(item, dimension, value) {
  if (dimension.key === "indice") {
    return formatDimensionValue(dimension, value);
  }
  return `${absoluteDimensionLabel(item, dimension)} · ${formatDimensionValue(dimension, value)}`;
}

function formatRankingMetricCell(item, dimension, value) {
  if (dimension.key === "indice") {
    return escapeHtml(formatDimensionValue(dimension, value));
  }
  return `
    <strong>${escapeHtml(absoluteDimensionLabel(item, dimension))}</strong>
    <span>${escapeHtml(formatDimensionValue(dimension, value))}</span>
  `;
}

function absoluteDimensionLabel(item, dimension) {
  const absolute = item?.absolute || {};
  if (dimension.key === "docente") {
    return formatPctLabel(absolute.docentePct, "studenti sopra i traguardi");
  }
  if (dimension.key === "eduscopioUni") {
    return formatScoreLabel(absolute.uniScore, "FGA medio");
  }
  if (dimension.key === "lavoroCopertura") {
    const score = formatScoreLabel(absolute.lavoroScore, "punteggio lavoro");
    const coverage = formatPctLabel(item?.coperturaLavoro, "copertura");
    return score === "n.d." ? coverage : `${score}, ${coverage}`;
  }
  if (dimension.key === "immatricolazione") {
    return formatPctLabel(absolute.immatricolazionePct, "iscritti all'università");
  }
  if (dimension.key === "continuita") {
    return formatPctLabel(absolute.continuitaPct, "continuità");
  }
  return formatDimensionValue(dimension, dimension.value(item));
}

function formatPctLabel(value, label) {
  if (!Number.isFinite(value)) return "n.d.";
  return `${fmt1.format(value)}% ${label}`;
}

function formatScoreLabel(value, label) {
  if (!Number.isFinite(value)) return "n.d.";
  return `${fmt1.format(value)}/100 ${label}`;
}

function getMetricExtents(comuni) {
  return Object.fromEntries(
    DIMENSIONS.map((dimension) => {
      const values = comuni
        .map((item) => dimension.value(item))
        .filter((value) => Number.isFinite(value))
        .sort((a, b) => a - b);

      return [
        dimension.key,
        {
          min: percentile(values, 0.04),
          max: percentile(values, 0.96),
        },
      ];
    })
  );
}

function bestByDimension(key) {
  const dimension = DIMENSIONS_BY_KEY.get(key);
  return [...state.comuni].sort((a, b) => safeValue(dimension.value(b)) - safeValue(dimension.value(a)))[0];
}

function safeValue(value) {
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

function percentile(values, amount) {
  if (!values.length) return 0;
  const index = (values.length - 1) * amount;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return values[lower];
  return values[lower] + (values[upper] - values[lower]) * (index - lower);
}

function metricPercent(value, key) {
  const extent = state.metricExtents[key];
  if (!Number.isFinite(value) || !extent || extent.min === extent.max) return 0.5;
  return clamp((value - extent.min) / (extent.max - extent.min), 0, 1);
}

function colorForMetric(value, dimension) {
  if (!Number.isFinite(value)) return "#d8e7e5";
  const pct = metricPercent(value, dimension.key);
  if (pct < 0.72) {
    return mixColor(dimension.pale, dimension.color, pct / 0.72);
  }
  return mixColor(dimension.color, scaleColor(dimension.color, 0.52), (pct - 0.72) / 0.28);
}

function textColorForBackground(color) {
  const [red, green, blue] = colorToRgb(color);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance > 145 ? "#17313a" : "#ffffff";
}

function colorToRgb(color) {
  if (color.startsWith("#")) {
    return hexToRgb(color);
  }
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return [Number(match[1]), Number(match[2]), Number(match[3])];
  }
  return [23, 49, 58];
}

function scaleColor(hex, factor) {
  const rgb = hexToRgb(hex).map((channel) => Math.max(0, Math.min(255, Math.round(channel * factor))));
  return `#${rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mixColor(from, to, amount) {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const clamped = clamp(amount, 0, 1);
  const rgb = a.map((channel, index) => Math.round(channel + (b[index] - channel) * clamped));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function showFatalError(error) {
  const message = escapeHtml(error.message || String(error));
  els.comuneDetail.innerHTML = `<div class="empty-state">Errore di caricamento: ${message}</div>`;
}

const state = {
  comuni: [],
  comuniById: new Map(),
  geo: null,
  geoById: new Map(),
  indirizzi: {},
  selectedId: "merate-lecco",
  map: null,
  geoLayer: null,
  markerLayer: null,
};

const els = {};

const fmt0 = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt2 = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindElements();
  try {
    const [indexData, geoData, indirizziData] = await Promise.all([
      fetchJson("data/indice-comuni.json"),
      fetchJson("data/comuni-index.geojson"),
      fetchJson("data/indirizzi-comuni.json"),
    ]);

    state.comuni = indexData.comuni;
    state.comuniById = new Map(state.comuni.map((item) => [item.id, item]));
    state.geo = geoData;
    state.geoById = new Map(geoData.features.map((feature) => [feature.properties.id, feature]));
    state.indirizzi = indirizziData;

    populateControls(indexData.meta);
    bindEvents();
    initMap();
    renderGlobalStats(indexData.meta);
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
    "diplomati-filter",
    "diplomati-value",
    "affidabilita-filter",
    "affidabilita-value",
    "reset-filters",
    "filtered-count",
    "filtered-average",
    "ranking-body",
    "schools-body",
    "comune-detail",
    "selected-chip",
    "stat-comuni",
    "stat-top",
    "stat-merate",
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
  els.searchInput.addEventListener("input", () => renderAll({ fitMap: false }));
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

  els.diplomatiFilter.addEventListener("input", () => {
    updateRangeLabels();
    renderAll({ fitMap: true });
  });

  els.affidabilitaFilter.addEventListener("input", () => {
    updateRangeLabels();
    renderAll({ fitMap: true });
  });

  els.resetFilters.addEventListener("click", () => {
    els.searchInput.value = "";
    els.regionFilter.value = "";
    populateProvinceOptions();
    els.provinceFilter.value = "";
    els.diplomatiFilter.value = "0";
    els.affidabilitaFilter.value = "0";
    state.selectedId = "merate-lecco";
    updateRangeLabels();
    renderAll({ fitMap: true });
  });

  els.rankingBody.addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-id]");
    if (row) {
      selectComune(row.dataset.id, { pan: true });
    }
  });

  updateRangeLabels();
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

  state.geoLayer = L.geoJSON(null, {
    style: styleFeature,
    onEachFeature: onEachFeature,
  }).addTo(state.map);

  state.markerLayer = L.layerGroup().addTo(state.map);

  setTimeout(() => state.map.invalidateSize(), 80);
}

function renderGlobalStats(meta) {
  const top = state.comuni[0];
  const merate = state.comuniById.get("merate-lecco");
  els.statComuni.textContent = fmt0.format(meta.counts.rowsWithFinalIndex);
  els.statTop.textContent = `${top.comune} ${fmt2.format(top.indice)}`;
  els.statMerate.textContent = merate ? `#${merate.rank} ${fmt2.format(merate.indice)}` : "n.d.";
}

function renderAll(options = {}) {
  const filtered = getFilteredComuni();
  ensureSelection(filtered);
  renderFilterStats(filtered);
  renderRanking(filtered);
  renderMap(filtered, options.fitMap);
  renderSelected();
}

function getFilteredComuni() {
  const query = normalizeSearch(els.searchInput.value);
  const region = els.regionFilter.value;
  const province = els.provinceFilter.value;
  const minDiplomati = Number(els.diplomatiFilter.value);
  const minAffidabilita = Number(els.affidabilitaFilter.value);

  return state.comuni.filter((item) => {
    const haystack = normalizeSearch(`${item.comune} ${item.provincia} ${item.regione}`);
    return (
      (!query || haystack.includes(query)) &&
      (!region || item.regione === region) &&
      (!province || item.provincia === province) &&
      (item.diplomati ?? 0) >= minDiplomati &&
      (item.affidabilita ?? 0) >= minAffidabilita
    );
  });
}

function ensureSelection(filtered) {
  if (!filtered.length) {
    state.selectedId = null;
    return;
  }

  const selectedVisible = filtered.some((item) => item.id === state.selectedId);
  if (selectedVisible) {
    return;
  }

  const query = normalizeSearch(els.searchInput.value);
  const exact = filtered.find((item) => normalizeSearch(item.comune) === query);
  state.selectedId = (exact || filtered[0]).id;
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
    els.rankingBody.innerHTML = '<tr><td colspan="7" class="empty-state">Nessun comune nel filtro.</td></tr>';
    return;
  }

  els.rankingBody.innerHTML = filtered
    .map((item) => {
      const selected = item.id === state.selectedId ? " is-selected" : "";
      return `
        <tr class="${selected}" data-id="${escapeAttr(item.id)}">
          <td><button class="rank-select" type="button" aria-label="Seleziona ${escapeAttr(item.comune)}">#${item.rank}</button></td>
          <td class="commune-cell">
            <strong>${escapeHtml(item.comune)}</strong>
            <span>${escapeHtml(item.provinciaSigla || item.provincia)} · ${escapeHtml(item.regione)}</span>
          </td>
          <td class="score">${fmt2.format(item.indice)}</td>
          <td class="optional">${formatSigned(item.docente)}</td>
          <td class="optional">${formatSigned(item.eduscopioUni)}</td>
          <td class="optional">${formatSigned(item.lavoroCopertura)}</td>
          <td>${fmt0.format(item.diplomati || 0)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderMap(filtered, fitMap = false) {
  const visibleIds = new Set(filtered.map((item) => item.id));
  const features = state.geo.features.filter((feature) => visibleIds.has(feature.properties.id));

  state.geoLayer.clearLayers();
  state.markerLayer.clearLayers();
  state.geoLayer.addData({ type: "FeatureCollection", features });
  renderMarkers(features);
  applySelectedMapStyle();

  if (fitMap && features.length) {
    const bounds = state.geoLayer.getBounds();
    if (bounds.isValid()) {
      state.map.fitBounds(bounds, { padding: [20, 20], maxZoom: 10 });
    }
  }
}

function styleFeature(feature) {
  const selected = feature.properties.id === state.selectedId;
  return {
    color: selected ? "#17313a" : "#ffffff",
    weight: selected ? 3 : 0.8,
    opacity: selected ? 1 : 0.86,
    fillColor: colorForScore(feature.properties.indice),
    fillOpacity: selected ? 0.92 : 0.72,
  };
}

function markerStyle(feature) {
  const selected = feature.properties.id === state.selectedId;
  return {
    radius: selected ? 8 : 5,
    color: selected ? "#17313a" : "#ffffff",
    weight: selected ? 3 : 1.4,
    opacity: 1,
    fillColor: colorForScore(feature.properties.indice),
    fillOpacity: selected ? 0.98 : 0.9,
  };
}

function onEachFeature(feature, layer) {
  const props = feature.properties;
  layer.bindTooltip(
    `<div class="map-tooltip"><strong>#${props.rank} ${escapeHtml(props.comune)}</strong>${escapeHtml(props.provincia)} · indice ${fmt2.format(props.indice)}</div>`,
    { sticky: true }
  );
  layer.on("click", () => selectComune(props.id, { pan: false }));
}

function renderMarkers(features) {
  features.forEach((feature) => {
    const center = L.geoJSON(feature).getBounds().getCenter();
    const marker = L.circleMarker(center, markerStyle(feature));
    marker.feature = feature;
    marker.bindTooltip(
      `<div class="map-tooltip"><strong>#${feature.properties.rank} ${escapeHtml(feature.properties.comune)}</strong>${escapeHtml(feature.properties.provincia)} · indice ${fmt2.format(feature.properties.indice)}</div>`,
      { sticky: true }
    );
    marker.on("click", () => selectComune(feature.properties.id, { pan: false }));
    marker.addTo(state.markerLayer);
  });
}

function applySelectedMapStyle() {
  state.geoLayer.eachLayer((layer) => {
    layer.setStyle(styleFeature(layer.feature));
    if (layer.feature.properties.id === state.selectedId) {
      layer.bringToFront();
    }
  });

  state.markerLayer.eachLayer((layer) => {
    layer.setStyle(markerStyle(layer.feature));
    if (layer.feature.properties.id === state.selectedId) {
      layer.bringToFront();
    }
  });
}

function colorForScore(score) {
  if (score >= 118) return "#17313a";
  if (score >= 114) return "#177a74";
  if (score >= 110) return "#3aa9a2";
  if (score >= 106) return "#9dcfba";
  return "#e7d4a6";
}

function selectComune(id, options = {}) {
  if (!state.comuniById.has(id)) {
    return;
  }

  state.selectedId = id;
  renderSelected();
  renderRanking(getFilteredComuni());
  applySelectedMapStyle();

  if (options.pan) {
    const feature = state.geoById.get(id);
    if (feature) {
      const layer = findLayerById(id);
      if (layer) {
        state.map.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 11 });
      }
    }
  }
}

function findLayerById(id) {
  let match = null;
  state.geoLayer.eachLayer((layer) => {
    if (layer.feature.properties.id === id) {
      match = layer;
    }
  });
  return match;
}

function renderSelected() {
  const item = state.comuniById.get(state.selectedId);
  if (!item) {
    els.selectedChip.textContent = "Nessun comune";
    els.comuneDetail.innerHTML = '<div class="empty-state">Nessun comune selezionato.</div>';
    els.schoolsBody.innerHTML = '<tr><td colspan="5" class="empty-state">Nessun dato.</td></tr>';
    return;
  }

  els.selectedChip.textContent = `#${item.rank} ${item.comune} · ${fmt2.format(item.indice)}`;
  renderDetail(item);
  renderSchools(item.id);
}

function renderDetail(item) {
  const components = [
    ["Docente", item.docente],
    ["Eduscopio uni", item.eduscopioUni],
    ["Lavoro pesato", item.lavoroCopertura],
    ["Immatricolazione", item.immatricolazione],
    ["Continuita", item.continuita],
  ];

  els.comuneDetail.innerHTML = `
    <div class="detail-hero">
      <div>
        <p class="eyebrow">Scheda comune</p>
        <h2>${escapeHtml(item.comune)}</h2>
        <p class="lede">${escapeHtml(item.provincia)} · ${escapeHtml(item.regione)}</p>
      </div>
      <div class="rank-badge" aria-label="Rank nazionale">
        <span>Rank</span>
        <strong>#${item.rank}</strong>
      </div>
    </div>

    <div class="metric-grid">
      ${metric("Indice", fmt2.format(item.indice))}
      ${metric("Diplomati", fmt0.format(item.diplomati || 0))}
      ${metric("Affidabilita", item.affidabilita == null ? "n.d." : fmt1.format(item.affidabilita))}
      ${metric("Copertura lavoro", item.coperturaLavoro == null ? "n.d." : `${fmt1.format(item.coperturaLavoro)}%`)}
    </div>

    <h3>Componenti</h3>
    <div class="components">
      ${components.map(([label, value]) => componentRow(label, value)).join("")}
    </div>

    <h3>Indirizzi pesati</h3>
    <div class="macro-grid">
      ${macroCard("Licei", item.macro.licei)}
      ${macroCard("Tecnici", item.macro.tecnici)}
      ${macroCard("Professionali", item.macro.professionali)}
    </div>

    <h3>Subranking</h3>
    <div class="subranking-grid">
      ${subrankCard("Finale", item.subrankings.finale)}
      ${subrankCard("Docente", item.subrankings.docente)}
      ${subrankCard("Eduscopio uni", item.subrankings.eduscopio_uni)}
      ${subrankCard("Lavoro", item.subrankings.lavoro_copertura)}
    </div>
  `;
}

function metric(label, value) {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function componentRow(label, value) {
  const width = value == null ? 0 : Math.min(100, (Math.abs(value) / 35) * 100);
  const signClass = value == null || value >= 0 ? "" : " negative";
  return `
    <div class="component-row">
      <div class="component-name">${escapeHtml(label)}</div>
      <div class="bar-track"><span class="${signClass}" style="--w:${width.toFixed(1)}%"></span></div>
      <div class="component-value ${deltaClass(value)}">${formatSigned(value)}</div>
    </div>
  `;
}

function macroCard(label, macro) {
  const delta = macro?.delta;
  const peso = macro?.peso || 0;
  return `
    <div class="macro-card">
      <span>${escapeHtml(label)} · ${fmt0.format(peso)} dipl.</span>
      <strong class="${deltaClass(delta)}">${formatSigned(delta)}</strong>
    </div>
  `;
}

function subrankCard(label, data) {
  const rank = data?.rank ? `#${data.rank}` : "n.d.";
  const value = data?.value == null ? "" : ` · ${formatSigned(data.value)}`;
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
        <td class="school-cell">
          <strong>${escapeHtml(row.scuola || "n.d.")}</strong>
          <span>${escapeHtml(row.codice || "")}</span>
        </td>
        <td>${escapeHtml(row.indirizzo || "n.d.")}</td>
        <td>${fmt0.format(row.diplomati || 0)}</td>
        <td><span class="${deltaClass(row.uniDelta)}">${formatSigned(row.uniDelta)}</span></td>
        <td><span class="${deltaClass(row.lavDelta)}">${formatSigned(row.lavDelta)}</span></td>
      </tr>
    `)
    .join("");
}

function updateRangeLabels() {
  els.diplomatiValue.textContent = `${els.diplomatiFilter.value}+`;
  els.affidabilitaValue.textContent = `${els.affidabilitaFilter.value}+`;
}

function formatSigned(value) {
  if (value == null || Number.isNaN(value)) {
    return "n.d.";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${fmt2.format(value)}`;
}

function deltaClass(value) {
  if (value == null || Number.isNaN(value)) return "";
  return value >= 0 ? "delta-positive" : "delta-negative";
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

function showFatalError(error) {
  const message = escapeHtml(error.message || String(error));
  els.comuneDetail.innerHTML = `<div class="empty-state">Errore di caricamento: ${message}</div>`;
}

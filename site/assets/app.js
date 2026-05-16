const state = {
  comuni: [],
  comuniById: new Map(),
  geo: null,
  geoById: new Map(),
  indirizzi: {},
  selectedId: null,
  map: null,
  markerLayer: null,
  scoreExtent: { min: 0, max: 1 },
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
      fetchJson("data/comuni-points.geojson"),
      fetchJson("data/indirizzi-comuni.json"),
    ]);

    state.comuni = indexData.comuni;
    state.comuniById = new Map(state.comuni.map((item) => [item.id, item]));
    state.geo = geoData;
    state.geoById = new Map(geoData.features.map((feature) => [feature.properties.id, feature]));
    state.indirizzi = indirizziData;
    state.scoreExtent = getScoreExtent(state.comuni);

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
    "reset-filters",
    "filtered-count",
    "filtered-average",
    "ranking-body",
    "schools-body",
    "comune-detail",
    "selected-chip",
    "stat-comuni",
    "stat-top",
    "stat-indicatori",
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

  els.resetFilters.addEventListener("click", () => {
    els.searchInput.value = "";
    els.regionFilter.value = "";
    populateProvinceOptions();
    els.provinceFilter.value = "";
    state.selectedId = null;
    renderAll({ fitMap: true });
  });

  els.rankingBody.addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-id]");
    if (row) {
      selectComune(row.dataset.id, { pan: true });
    }
  });

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
  els.statComuni.textContent = fmt0.format(meta.counts.rowsWithFinalIndex);
  els.statTop.textContent = `${top.comune} ${fmt2.format(top.indice)}`;
  els.statIndicatori.textContent = "5 aree";
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
          <td class="profile-cell">${profileBars(item)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderMap(filtered, fitMap = false) {
  const visibleIds = new Set(filtered.map((item) => item.id));
  const features = state.geo.features.filter((feature) => visibleIds.has(feature.properties.id));

  state.markerLayer.clearLayers();
  renderMarkers(features);
  applySelectedMapStyle();

  if (fitMap && features.length) {
    const bounds = state.markerLayer.getBounds();
    if (bounds.isValid()) {
      state.map.fitBounds(bounds, { padding: [20, 20], maxZoom: 10 });
    }
  }
}

function markerStyle(feature) {
  const selected = feature.properties.id === state.selectedId;
  return {
    radius: selected ? 9 : 5.5,
    color: selected ? "#17313a" : "#ffffff",
    weight: selected ? 3 : 1.4,
    opacity: 1,
    fillColor: colorForScore(feature.properties.indice),
    fillOpacity: selected ? 0.98 : 0.9,
  };
}

function renderMarkers(features) {
  features.forEach((feature) => {
    const [lng, lat] = feature.geometry.coordinates;
    const marker = L.circleMarker([lat, lng], markerStyle(feature));
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
  state.markerLayer.eachLayer((layer) => {
    layer.setStyle(markerStyle(layer.feature));
    if (layer.feature.properties.id === state.selectedId) {
      layer.bringToFront();
    }
  });
}

function colorForScore(score) {
  const pct = scorePercent(score);
  if (pct < 0.5) {
    return mixColor("#b9505d", "#d9a441", pct * 2);
  }
  return mixColor("#d9a441", "#177a74", (pct - 0.5) * 2);
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
    const layer = findLayerById(id);
    if (layer) {
      state.map.setView(layer.getLatLng(), Math.max(state.map.getZoom(), 9), { animate: true });
    }
  }
}

function findLayerById(id) {
  let match = null;
  state.markerLayer.eachLayer((layer) => {
    if (layer.feature.properties.id === id) {
      match = layer;
    }
  });
  return match;
}

function renderSelected() {
  const item = state.comuniById.get(state.selectedId);
  if (!item) {
    els.selectedChip.textContent = "Seleziona un comune";
    els.comuneDetail.innerHTML = `
      <div class="empty-state">
        Seleziona un punto sulla mappa o una riga della classifica per leggere la scheda territoriale.
      </div>
    `;
    els.schoolsBody.innerHTML = '<tr><td colspan="5" class="empty-state">Nessun dato.</td></tr>';
    return;
  }

  els.selectedChip.textContent = `#${item.rank} ${item.comune} · ${fmt2.format(item.indice)}`;
  renderDetail(item);
  renderSchools(item.id);
}

function renderDetail(item) {
  const components = [
    {
      label: "Apprendimenti Invalsi",
      value: item.docente,
      weight: "35%",
      note: "Italiano e matematica rispetto alla media nazionale.",
    },
    {
      label: "Qualita del percorso",
      value: item.eduscopioUni,
      weight: "35%",
      note: "Esiti universitari Eduscopio a parita di indirizzo.",
    },
    {
      label: "Esiti lavoro",
      value: item.lavoroCopertura,
      weight: "10%",
      note: "Tecnici e professionali, pesati per diplomati coperti.",
    },
    {
      label: "Accesso all'universita",
      value: item.immatricolazione,
      weight: "10%",
      note: "Immatricolazioni vs benchmark nazionale di indirizzo.",
    },
    {
      label: "Continuita universitaria",
      value: item.continuita,
      weight: "10%",
      note: "Prosecuzione senza abbandono vs benchmark nazionale.",
    },
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

    <h3>Composizione dell'indice</h3>
    <div class="components">
      ${components.map((component) => componentRow(component)).join("")}
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
      ${subrankCard("Apprendimenti", item.subrankings.docente)}
      ${subrankCard("Percorso", item.subrankings.eduscopio_uni)}
      ${subrankCard("Lavoro", item.subrankings.lavoro_copertura)}
    </div>
  `;
}

function metric(label, value) {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function profileBars(item) {
  const values = [
    ["Apprendimenti Invalsi", item.docente],
    ["Qualita percorso", item.eduscopioUni],
    ["Esiti lavoro", item.lavoroCopertura],
    ["Accesso universita", item.immatricolazione],
    ["Continuita universitaria", item.continuita],
  ];
  return `
    <div class="profile-bars" aria-label="Profilo sintetico delle cinque componenti">
      ${values
        .map(([label, value]) => {
          const height = value == null ? 12 : Math.max(10, Math.min(34, 12 + Math.abs(value) * 0.55));
          const color = value == null ? "#d8e7e5" : value >= 0 ? "#177a74" : "#b9505d";
          return `<span title="${escapeAttr(`${label}: ${formatSigned(value)}`)}" style="--h:${height}px;--c:${color}"></span>`;
        })
        .join("")}
    </div>
  `;
}

function componentRow(component) {
  const { label, value, weight, note } = component;
  const width = value == null ? 0 : Math.min(100, (Math.abs(value) / 35) * 100);
  const signClass = value == null || value >= 0 ? "" : " negative";
  return `
    <div class="component-row">
      <div class="component-name">
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(weight)} · ${escapeHtml(note)}</span>
      </div>
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
      <span>${escapeHtml(label)} · ${fmt0.format(peso)} diplomati</span>
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

function getScoreExtent(comuni) {
  const scores = comuni.map((item) => item.indice).filter((value) => Number.isFinite(value));
  return { min: Math.min(...scores), max: Math.max(...scores) };
}

function scorePercent(score) {
  const { min, max } = state.scoreExtent;
  if (!Number.isFinite(score) || min === max) return 0.5;
  return Math.max(0, Math.min(1, (score - min) / (max - min)));
}

function mixColor(from, to, amount) {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const rgb = a.map((channel, index) => Math.round(channel + (b[index] - channel) * amount));
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

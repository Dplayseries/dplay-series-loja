"use strict";
/* NoxPlay: consulta em tempo real ao catálogo autorizado, sem replicar o acervo. */
(() => {
  const API = "https://noxplay-api-stage.onrender.com";
  const PRICE = "R$ 4,00";
  const CHUNK = 48;
  const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
  const list = document.getElementById("catalogo");
  const status = document.getElementById("status");
  const total = document.getElementById("catalog-total");
  const counter = document.getElementById("catalog-counter");
  const search = document.getElementById("pesquisa");
  const sorting = document.getElementById("ordenacao");
  const more = document.getElementById("catalog-more");
  const retry = document.getElementById("catalog-retry");
  const details = document.getElementById("nox-details");
  let series = [];
  let filtered = [];
  let shown = 0;
  let lastSuccess = null;
  let loading = false;
  let checkoutEnabled = false;
  let reservationsEnabled = false;

  const normalize = value => String(value || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();

  function setStatus(message, failed = false) {
    status.textContent = message;
    status.dataset.error = failed ? "1" : "0";
  }

  function getImageUrl(id) {
    return API + "/noxplay/catalogo/capa/" + encodeURIComponent(id);
  }

  function makeCover(entry, className = "") {
    const image = document.createElement("img");
    image.loading = "lazy";
    image.decoding = "async";
    image.className = className;
    image.alt = "Capa de " + entry.titulo;
    image.src = getImageUrl(entry.id);
    image.onerror = () => {
      image.onerror = null;
      image.removeAttribute("src");
      image.alt = "Capa temporariamente indisponível";
      image.classList.add("no-cover");
    };
    return image;
  }

  function openDetails(entry) {
    const title = document.getElementById("nox-details-title");
    const cover = document.getElementById("nox-details-cover");
    const action = document.getElementById("nox-details-buy");
    title.textContent = entry.titulo;
    cover.replaceChildren(makeCover(entry));
    action.textContent = checkoutEnabled ? "Comprar por Pix — " + PRICE : "Compras em preparação";
    action.disabled = !checkoutEnabled;
    action.onclick = () => {
      if (!checkoutEnabled) return;
      details.close();
      NoxCheckout.open(entry);
    };
    const url = new URL(location.href);
    url.hash = "serie=" + encodeURIComponent(entry.id);
    document.getElementById("nox-details-share").onclick = async () => {
      try {
        await navigator.clipboard.writeText(url.toString());
        document.getElementById("nox-details-feedback").textContent = "Link da série copiado!";
      } catch {
        document.getElementById("nox-details-feedback").textContent = "Copie o endereço: " + url.toString();
      }
    };
    document.getElementById("nox-details-feedback").textContent = "";
    details.showModal();
  }

  function createCard(entry) {
    const article = document.createElement("article");
    article.className = "series-card";
    article.dataset.serieId = entry.id;
    const cover = document.createElement("button");
    cover.type = "button";
    cover.className = "series-cover";
    cover.setAttribute("aria-label", "Ver detalhes de " + entry.titulo);
    cover.append(makeCover(entry));
    cover.onclick = () => openDetails(entry);
    const body = document.createElement("div");
    body.className = "series-body";
    const title = document.createElement("h3");
    title.textContent = entry.titulo;
    const tag = document.createElement("span");
    tag.className = "series-price";
    tag.textContent = PRICE;
    const action = document.createElement("button");
    action.type = "button";
    action.className = "series-action";
    action.disabled = !(checkoutEnabled || reservationsEnabled);
    action.textContent = checkoutEnabled ? "Comprar por Pix" :
      reservationsEnabled ? "Reservar sem pagar" : "Compras em preparação";
    action.onclick = () => {
      if (checkoutEnabled) return NoxCheckout.open(entry);
      if (reservationsEnabled) return reserve(entry, action);
    };
    body.append(title, tag, action);
    article.append(cover, body);
    return article;
  }

  async function reserve(entry, action) {
    action.disabled = true;
    try {
      const res = await fetch(API + "/noxplay/pedido", {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({serie_id: entry.id})
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.status !== "rascunho") throw new Error();
      action.textContent = "Reserva registrada";
      setStatus("Reserva gratuita registrada. Nenhum pagamento foi realizado.");
    } catch {
      action.disabled = false;
      setStatus("Não foi possível reservar a série. Nenhuma cobrança foi realizada.", true);
    }
  }

  function appendChunk() {
    const fragment = document.createDocumentFragment();
    const end = Math.min(filtered.length, shown + CHUNK);
    for (let i = shown; i < end; i++) fragment.append(createCard(filtered[i]));
    shown = end;
    list.append(fragment);
    more.hidden = shown >= filtered.length;
    counter.textContent = filtered.length
      ? "Exibindo " + shown + " de " + filtered.length + " séries"
      : "Nenhuma série encontrada";
    document.getElementById("catalog-empty").hidden = filtered.length !== 0;
  }

  function filter() {
    const needle = normalize(search.value);
    filtered = series.filter(entry => normalize(entry.titulo).includes(needle));
    const mode = sorting.value;
    if (mode === "az") filtered.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
    if (mode === "za") filtered.sort((a, b) => b.titulo.localeCompare(a.titulo, "pt-BR"));
    shown = 0;
    list.replaceChildren();
    appendChunk();
    const selected = location.hash.match(/^#serie=([0-9a-f-]{36})$/i)?.[1];
    if (selected) {
      const item = series.find(x => x.id.toLowerCase() === selected.toLowerCase());
      if (item && !details.open) openDetails(item);
    }
  }

  async function refresh() {
    if (loading) return;
    loading = true;
    retry.disabled = true;
    try {
      const checkout = await NoxCheckout.initialize();
      checkoutEnabled = checkout;
      const config = await fetch(API + "/noxplay/config", {cache: "no-store"})
        .then(r => r.ok ? r.json() : {}).catch(() => ({}));
      reservationsEnabled = config.loja_id === "noxplay" &&
        config.reservas_habilitadas === true && config.checkout_habilitado === false;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      let response;
      try {
        response = await fetch(API + "/noxplay/catalogo/series", {
          cache: "no-store", signal: controller.signal
        });
      } finally { clearTimeout(timeout); }
      if (!response.ok) throw new Error("Não foi possível consultar o catálogo.");
      const data = await response.json();
      if (!Array.isArray(data.series)) throw new Error("Resposta inválida da API.");
      const known = new Set();
      const next = [];
      for (const entry of data.series) {
        if (!entry || typeof entry.titulo !== "string" ||
            typeof entry.id !== "string" || !UUID.test(entry.id) ||
            !entry.titulo.trim() || known.has(entry.id.toLowerCase())) continue;
        known.add(entry.id.toLowerCase());
        next.push({id: entry.id, titulo: entry.titulo.trim()});
      }
      series = next;
      lastSuccess = new Date();
      total.textContent = String(series.length);
      setStatus(series.length + " séries sincronizadas com a DPlay às " +
        lastSuccess.toLocaleTimeString("pt-BR", {hour: "2-digit", minute: "2-digit"}) +
        ". " + (checkoutEnabled ? "Compras Pix disponíveis." : "Compras ainda em preparação."));
      filter();
    } catch {
      if (lastSuccess) setStatus("Sem conexão para atualizar. Exibindo " +
        series.length + " séries da última sincronização; nova tentativa automática.", true);
      else setStatus("O catálogo está temporariamente indisponível. Use Tentar novamente.", true);
    } finally {
      loading = false;
      retry.disabled = false;
    }
  }

  search.addEventListener("input", filter);
  sorting.addEventListener("change", filter);
  more.addEventListener("click", appendChunk);
  retry.addEventListener("click", refresh);
  details.addEventListener("close", () => {
    if (location.hash.startsWith("#serie=")) history.replaceState(null, "", location.pathname + location.search);
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && (!lastSuccess || Date.now() - lastSuccess.getTime() > 60000)) refresh();
  });
  setInterval(() => { if (!document.hidden) refresh(); }, 120000);
  refresh();
})();

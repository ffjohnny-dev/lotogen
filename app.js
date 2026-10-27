// LotoGen – interface
(function () {
  const $ = (s) => document.querySelector(s);
  const data = {};
  const lastKeys = {}; // grilles du clic précédent, pour ne pas les redonner
  let game = localStorage.getItem("game") || "loto";

  // Les données viennent en priorité de GitHub "brut" (toujours à jour),
  // sinon du site lui-même (copie publiée).
  function sources(id) {
    const list = [];
    const m = location.hostname.match(/^([^.]+)\.github\.io$/);
    const repo = location.pathname.split("/").filter(Boolean)[0];
    if (m && repo) list.push(`https://raw.githubusercontent.com/${m[1]}/${repo}/main/data/${id}.json?t=${Date.now()}`);
    list.push(`data/${id}.json?t=${Date.now()}`);
    return list;
  }

  async function load(id) {
    for (const url of sources(id)) {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) continue;
        const j = await r.json();
        if (j && Array.isArray(j.draws) && j.draws.length) {
          try { localStorage.setItem("cache-" + id, JSON.stringify(j)); } catch (e) {}
          return j;
        }
      } catch (e) {}
    }
    try { const c = JSON.parse(localStorage.getItem("cache-" + id)); if (c) { c.offline = true; return c; } } catch (e) {}
    return null;
  }

  const fr = (isoDate) => { const [y, m, d] = isoDate.split("-"); return `${d}/${m}/${y}`; };
  const dayName = (isoDate) => new Date(isoDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long" });

  function showFresh() {
    const d = data[game];
    const el = $("#fresh");
    if (!d) { el.textContent = "Tirages indisponibles pour le moment."; el.className = "fresh bad"; $("#go").disabled = true; return; }
    el.textContent = `Dernier tirage connu : ${dayName(d.last)} ${fr(d.last)}${d.offline ? " (hors ligne)" : ""}`;
    el.className = "fresh";
    $("#go").disabled = false;
  }

  function balls(nums, cls) { return nums.map((x) => `<span class="ball ${cls}">${x}</span>`).join(""); }

  function render(res) {
    const g = res.game;
    let html = res.grids.map((gr, i) => `
      <article class="grid">
        <h2>Grille ${i + 1} <small>parmi les ${gr.pool} plus sortis</small></h2>
        <div class="row">${balls(gr.n, "")}<span class="sep"></span>${balls(gr.b, "bonus")}</div>
      </article>`).join("");

    const top = res.freqMain.map((f, x) => ({ x, f })).slice(1).sort((a, b) => b.f - a.f).slice(0, 8);
    html += `
      <div class="info">
        <p><b>Analyse</b> du ${fr(res.period.from)} au ${fr(res.period.to)} · ${res.drawsCount} tirages</p>
        <p><b>Plus sortis</b> : ${top.map((t) => `${t.x}<sup>×${t.f}</sup>`).join(" ")}</p>
        ${res.previous.length
          ? `<p><b>Exclus</b> (tirages du ${res.previous.map((p) => fr(p.date)).join(" et du ")}) : <span class="ex">${res.excluded.n.join(" ")}</span> · ${g.bonusName} <span class="ex">${res.excluded.b.join(" ")}</span></p>`
          : `<p class="bad">Aucun tirage précédent trouvé : pas d'exclusion possible.</p>`}
      </div>`;
    if (res.drawsCount === 0) html = `<p class="bad">Aucun tirage sur la période. Les données ne sont peut-être pas à jour.</p>` + html;
    $("#out").innerHTML = html;
  }

  function generate() {
    const d = data[game];
    if (!d) return;
    try {
      const res = LotoAlgo.analyse(game, d.draws, new Date(), Math.random, lastKeys[game] || []);
      lastKeys[game] = res.keys;
      render(res);
    }
    catch (e) { $("#out").innerHTML = `<p class="bad">Erreur : ${e.message}</p>`; }
  }

  function selectGame(id) {
    game = id;
    try { localStorage.setItem("game", id); } catch (e) {}
    document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.game === id)));
    document.body.dataset.game = id;
    $("#out").innerHTML = "";
    showFresh();
  }

  document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => selectGame(b.dataset.game)));
  $("#go").addEventListener("click", generate);

  selectGame(game);
  Promise.all(["loto", "euromillions"].map(async (id) => { data[id] = await load(id); })).then(showFresh);

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();

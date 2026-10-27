// LotoGen – algorithme (fréquences sur la période + exclusion stricte du dernier tirage)
(function (root) {
  const GAMES = {
    loto: { label: "Loto", mainMax: 49, mainPick: 5, bonusMax: 10, bonusPick: 1, bonusName: "N° Chance" },
    euromillions: { label: "EuroMillions", mainMax: 50, mainPick: 5, bonusMax: 12, bonusPick: 2, bonusName: "Étoiles" },
  };

  const pad = (x) => String(x).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // Période : du 1er jour du mois précédent jusqu'à aujourd'hui inclus
  function period(today) {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return { from: iso(start), to: iso(today) };
  }

  function count(draws, key, max) {
    const f = new Array(max + 1).fill(0);
    for (const d of draws) for (const x of d[key]) f[x]++;
    return f;
  }

  // Classe les numéros autorisés du plus fréquent au moins fréquent (égalités départagées au hasard)
  function ranked(freq, max, excluded, rnd) {
    const list = [];
    for (let x = 1; x <= max; x++) if (!excluded.has(x)) list.push({ x, f: freq[x], r: rnd() });
    return list.sort((a, b) => b.f - a.f || a.r - b.r);
  }

  // Tirage pondéré sans remise parmi un "vivier" des plus fréquents
  function weightedPick(pool, k, rnd) {
    const items = pool.map((p) => ({ x: p.x, w: (p.f + 1) * (p.f + 1) }));
    const out = [];
    while (out.length < k && items.length) {
      const total = items.reduce((s, it) => s + it.w, 0);
      let t = rnd() * total, i = 0;
      while (i < items.length - 1 && (t -= items[i].w) > 0) i++;
      out.push(items[i].x);
      items.splice(i, 1);
    }
    return out;
  }

  function analyse(gameId, draws, today, rnd = Math.random, avoid = []) {
    const g = GAMES[gameId];
    const p = period(today);
    const sorted = [...draws].sort((a, b) => (a.date < b.date ? 1 : -1));
    const inPeriod = sorted.filter((d) => d.date >= p.from && d.date <= p.to);
    const previous = sorted.find((d) => d.date < p.to) || null; // dernier tirage avant aujourd'hui
    const exMain = new Set(previous ? previous.n : []);
    const exBonus = new Set(previous ? previous.b : []);
    const fMain = count(inPeriod, "n", g.mainMax);
    const fBonus = count(inPeriod, "b", g.bonusMax);
    const rMain = ranked(fMain, g.mainMax, exMain, rnd);
    const rBonus = ranked(fBonus, g.bonusMax, exBonus, rnd);

    const sortNum = (a) => a.sort((x, y) => x - y);
    const key = (gr) => gr.n.join("-") + "|" + gr.b.join("-");

    // Deux grilles tirées au sort parmi les numéros autorisés les plus fréquents :
    // grille 1 dans les 10 plus sortis, grille 2 dans les 15 plus sortis.
    // Un nouveau clic donne de nouvelles grilles, différentes du clic précédent (avoid).
    const pick = (size, bonusSize) => ({
      n: sortNum(weightedPick(rMain.slice(0, size), g.mainPick, rnd)),
      b: sortNum(weightedPick(rBonus.slice(0, bonusSize), g.bonusPick, rnd)),
    });
    const seen = new Set(avoid);
    let g1, g2, tries = 0;
    do { g1 = pick(10, Math.max(g.bonusPick * 2, 4)); } while (seen.has(key(g1)) && ++tries < 50);
    tries = 0;
    do { g2 = pick(15, Math.max(g.bonusPick * 3, 6)); } while ((key(g2) === key(g1) || seen.has(key(g2))) && ++tries < 50);

    // Contrôle final de la règle absolue
    for (const gr of [g1, g2]) {
      if (gr.n.some((x) => exMain.has(x)) || gr.b.some((x) => exBonus.has(x))) throw new Error("Règle d'exclusion violée");
    }

    return {
      game: g, period: p, drawsCount: inPeriod.length, previous,
      excluded: { n: [...exMain].sort((a, b) => a - b), b: [...exBonus].sort((a, b) => a - b) },
      freqMain: fMain, freqBonus: fBonus,
      grids: [g1, g2],
      keys: [key(g1), key(g2)],
    };
  }

  const api = { GAMES, analyse, period, iso };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.LotoAlgo = api;
})(typeof self !== "undefined" ? self : this);

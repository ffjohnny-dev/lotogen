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
    const previous = sorted.filter((d) => d.date < p.to).slice(0, 2); // les 2 derniers tirages avant aujourd'hui
    const exMain = new Set(previous.flatMap((d) => d.n));
    const exBonus = new Set(previous.flatMap((d) => d.b));
    const fMain = count(inPeriod, "n", g.mainMax);
    const fBonus = count(inPeriod, "b", g.bonusMax);
    const rMain = ranked(fMain, g.mainMax, exMain, rnd);
    const rBonus = ranked(fBonus, g.bonusMax, exBonus, rnd);

    const sortNum = (a) => a.sort((x, y) => x - y);
    const key = (gr) => gr.n.join("-") + "|" + gr.b.join("-");

    // Quatre grilles tirées au sort parmi les numéros autorisés les plus fréquents,
    // avec un choix de plus en plus large (10, 15, 20, 25 plus sortis ; idem pour Chance/Étoiles).
    // Un nouveau clic donne de nouvelles grilles, différentes entre elles et du clic précédent (avoid).
    const pick = (size, bonusSize) => ({
      n: sortNum(weightedPick(rMain.slice(0, size), g.mainPick, rnd)),
      b: sortNum(weightedPick(rBonus.slice(0, bonusSize), g.bonusPick, rnd)),
    });
    const bonusPools = gameId === "loto" ? [4, 6, 8, 9] : [5, 7, 9, 10];
    const seen = new Set(avoid);
    const grids = [];
    [10, 15, 20, 25].forEach((size, i) => {
      let gr, tries = 0;
      do { gr = pick(size, bonusPools[i]); } while (seen.has(key(gr)) && ++tries < 50);
      seen.add(key(gr));
      grids.push({ ...gr, pool: size });
    });

    // Grille 5 « Spéciale » : mélange de numéros parmi les plus sortis ET les moins sortis.
    // Numéros : 3 parmi les 10 plus sortis + 2 parmi les 10 moins sortis.
    // EuroMillions : 1 étoile parmi les 3 plus sorties + 1 parmi les 3 moins sorties.
    // Loto : le N° Chance au hasard parmi les 3 plus sortis ou les 3 moins sortis.
    const uniformPick = (pool, k) => {
      const items = [...pool], out = [];
      while (out.length < k && items.length) out.push(items.splice(Math.floor(rnd() * items.length), 1)[0].x);
      return out;
    };
    const topMain = rMain.slice(0, 10), rareMain = rMain.slice(-10).filter((o) => !topMain.includes(o));
    const topBonus = rBonus.slice(0, 3), rareBonus = rBonus.slice(-3).filter((o) => !topBonus.includes(o));
    const pickSpecial = () => ({
      n: sortNum([...weightedPick(topMain, 3, rnd), ...uniformPick(rareMain, 2)]),
      b: sortNum(g.bonusPick === 2
        ? [...uniformPick(topBonus, 1), ...uniformPick(rareBonus, 1)]
        : uniformPick([...topBonus, ...rareBonus], 1)),
    });
    let sp, tries = 0;
    do { sp = pickSpecial(); } while (seen.has(key(sp)) && ++tries < 50);
    grids.push({ ...sp, special: true });

    // Contrôle final de la règle absolue
    for (const gr of grids) {
      if (gr.n.some((x) => exMain.has(x)) || gr.b.some((x) => exBonus.has(x))) throw new Error("Règle d'exclusion violée");
    }

    return {
      game: g, period: p, drawsCount: inPeriod.length, previous,
      excluded: { n: [...exMain].sort((a, b) => a - b), b: [...exBonus].sort((a, b) => a - b) },
      freqMain: fMain, freqBonus: fBonus,
      grids,
      keys: grids.map(key),
    };
  }

  const api = { GAMES, analyse, period, iso };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.LotoAlgo = api;
})(typeof self !== "undefined" ? self : this);

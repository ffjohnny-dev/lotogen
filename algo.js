// LotoGen – algorithme
// Grilles 1-2 : fréquences depuis le 1er du mois dernier · Grilles 3-4 : depuis 3 mois · Grille 5 « Spéciale » : depuis 5 mois.
// Toujours : exclusion stricte des numéros des 2 derniers tirages.
(function (root) {
  const GAMES = {
    loto: { label: "Loto", mainMax: 49, mainPick: 5, bonusMax: 10, bonusPick: 1, bonusName: "N° Chance" },
    euromillions: { label: "EuroMillions", mainMax: 50, mainPick: 5, bonusMax: 12, bonusPick: 2, bonusName: "Étoiles" },
  };

  const pad = (x) => String(x).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // Période : du 1er jour du mois situé `months` mois avant, jusqu'à aujourd'hui inclus
  // (months = 1 : 1er du mois dernier ; 3 : il y a 3 mois ; 5 : il y a 5 mois)
  function period(today, months = 1) {
    const start = new Date(today.getFullYear(), today.getMonth() - months, 1);
    return { from: iso(start), to: iso(today), months };
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

  // Tirage pondéré sans remise : plus un numéro est sorti, plus il a de chances d'être choisi
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
    const sorted = [...draws].sort((a, b) => (a.date < b.date ? 1 : -1));
    const todayIso = iso(today);
    const previous = sorted.filter((d) => d.date < todayIso).slice(0, 2); // les 2 derniers tirages avant aujourd'hui
    const exMain = new Set(previous.flatMap((d) => d.n));
    const exBonus = new Set(previous.flatMap((d) => d.b));

    const sortNum = (a) => a.sort((x, y) => x - y);
    const key = (gr) => gr.n.join("-") + "|" + gr.b.join("-");
    const uniformPick = (pool, k) => {
      const items = [...pool], out = [];
      while (out.length < k && items.length) out.push(items.splice(Math.floor(rnd() * items.length), 1)[0].x);
      return out;
    };

    // Statistiques pour chaque période (1, 3 et 5 mois)
    const stats = {};
    for (const months of [1, 3, 5]) {
      const p = period(today, months);
      const inPeriod = sorted.filter((d) => d.date >= p.from && d.date <= p.to);
      const fMain = count(inPeriod, "n", g.mainMax);
      const fBonus = count(inPeriod, "b", g.bonusMax);
      stats[months] = {
        period: p, drawsCount: inPeriod.length, freqMain: fMain, freqBonus: fBonus,
        rMain: ranked(fMain, g.mainMax, exMain, rnd), rBonus: ranked(fBonus, g.bonusMax, exBonus, rnd),
      };
    }

    const seen = new Set(avoid);
    const grids = [];
    const unique = (make) => {
      let gr, tries = 0;
      do { gr = make(); } while (seen.has(key(gr)) && ++tries < 50);
      seen.add(key(gr));
      return gr;
    };

    // Grilles 1-2 (1 mois) et 3-4 (3 mois) : tirées au sort parmi les plus sortis de leur période
    const plan = [
      { months: 1, size: 10, bonusSize: gameId === "loto" ? 4 : 5 },
      { months: 1, size: 15, bonusSize: gameId === "loto" ? 6 : 7 },
      { months: 3, size: 10, bonusSize: gameId === "loto" ? 4 : 5 },
      { months: 3, size: 15, bonusSize: gameId === "loto" ? 6 : 7 },
    ];
    for (const { months, size, bonusSize } of plan) {
      const s = stats[months];
      const gr = unique(() => ({
        n: sortNum(weightedPick(s.rMain.slice(0, size), g.mainPick, rnd)),
        b: sortNum(weightedPick(s.rBonus.slice(0, bonusSize), g.bonusPick, rnd)),
      }));
      grids.push({ ...gr, pool: size, months });
    }

    // Grille 5 « Spéciale » (5 mois) : 3 numéros parmi les 10 plus sortis + 2 parmi les 10 moins sortis.
    // EuroMillions : 1 étoile parmi les 3 plus sorties + 1 parmi les 3 moins sorties.
    // Loto : le N° Chance au hasard parmi les 3 plus sortis ou les 3 moins sortis.
    const s5 = stats[5];
    const topMain = s5.rMain.slice(0, 10), rareMain = s5.rMain.slice(-10).filter((o) => !topMain.includes(o));
    const topBonus = s5.rBonus.slice(0, 3), rareBonus = s5.rBonus.slice(-3).filter((o) => !topBonus.includes(o));
    const sp = unique(() => ({
      n: sortNum([...weightedPick(topMain, 3, rnd), ...uniformPick(rareMain, 2)]),
      b: sortNum(g.bonusPick === 2
        ? [...uniformPick(topBonus, 1), ...uniformPick(rareBonus, 1)]
        : uniformPick([...topBonus, ...rareBonus], 1)),
    }));
    grids.push({ ...sp, special: true, months: 5 });

    // Contrôle final de la règle absolue
    for (const gr of grids) {
      if (gr.n.some((x) => exMain.has(x)) || gr.b.some((x) => exBonus.has(x))) throw new Error("Règle d'exclusion violée");
    }

    const periods = [1, 3, 5].map((m) => ({ ...stats[m].period, drawsCount: stats[m].drawsCount }));
    return {
      game: g, periods, previous,
      period: stats[1].period, drawsCount: stats[1].drawsCount, freqMain: stats[1].freqMain, freqBonus: stats[1].freqBonus,
      excluded: { n: [...exMain].sort((a, b) => a - b), b: [...exBonus].sort((a, b) => a - b) },
      grids,
      keys: grids.map(key),
    };
  }

  const api = { GAMES, analyse, period, iso };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.LotoAlgo = api;
})(typeof self !== "undefined" ? self : this);

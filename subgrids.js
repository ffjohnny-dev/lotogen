// LotoGen – sous-grilles (module séparé : le moteur algo.js n'est pas modifié)
// Pour chaque grille : une sous-grille sur la MÊME période, avec 2 chauds + 2 moyens + 1 froid.
// Chauds / moyens / froids = tiers des numéros classés par nombre de sorties FDJ sur la période.
// Règles conservées : dernier tirage exclu, jamais identique à une autre grille,
// règles anti-partage pour la sous-grille de la grille 6.
(function (root) {
  const pad = (x) => String(x).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const sortNum = (a) => a.sort((x, y) => x - y);
  const key = (gr) => gr.n.join("-") + "|" + gr.b.join("-");

  function antiShareOk(n) {
    if (n.filter((x) => x > 31).length < 2) return false;
    if (n.includes(7)) return false;
    for (let i = 0; i + 2 < n.length; i++) if (n[i + 1] === n[i] + 1 && n[i + 2] === n[i] + 2) return false;
    const dz = {};
    for (const x of n) { const d = Math.min(4, Math.floor(x / 10)); dz[d] = (dz[d] || 0) + 1; if (dz[d] > 2) return false; }
    const step = n[1] - n[0];
    if (n.every((x, i) => i === 0 || x - n[i - 1] === step)) return false;
    return true;
  }

  // Classe du plus sorti au moins sorti puis coupe en 3 tiers
  function tiers(draws, field, max, excluded, rnd, banned) {
    const f = new Array(max + 1).fill(0);
    for (const d of draws) for (const x of d[field]) f[x]++;
    const list = [];
    for (let x = 1; x <= max; x++) if (!excluded.has(x) && !banned.has(x)) list.push({ x, f: f[x], r: rnd() });
    list.sort((a, b) => b.f - a.f || a.r - b.r);
    const third = Math.ceil(list.length / 3);
    return {
      chaud: list.slice(0, third),
      moyen: list.slice(third, list.length - third),
      froid: list.slice(list.length - third),
    };
  }

  function pick(pool, k, rnd) {
    const items = [...pool], out = [];
    while (out.length < k && items.length) out.push(items.splice(Math.floor(rnd() * items.length), 1)[0].x);
    return out;
  }

  function addSubgrids(gameId, draws, today, res, rnd = Math.random) {
    const g = res.game;
    const exMain = new Set(res.excluded.n), exBonus = new Set(res.excluded.b);
    const seen = new Set(res.grids.map(key));
    const subs = [];

    for (const parent of res.grids) {
      const months = parent.months;
      const start = iso(new Date(today.getFullYear(), today.getMonth() - months, 1));
      const end = iso(today);
      const inPeriod = draws.filter((d) => d.date >= start && d.date <= end);
      const banned = parent.antishare ? new Set([7]) : new Set();
      const tm = tiers(inPeriod, "n", g.mainMax, exMain, rnd, banned);
      const tb = tiers(inPeriod, "b", g.bonusMax, exBonus, rnd, banned);
      const groups = ["chaud", "moyen", "froid"];

      let sub = null;
      for (let t = 0; t < 3000 && !sub; t++) {
        const tag = {};
        const n = [];
        for (const [grp, k] of [["chaud", 2], ["moyen", 2], ["froid", 1]]) {
          for (const x of pick(tm[grp], k, rnd)) { n.push(x); tag[x] = grp; }
        }
        // Étoiles / N° Chance : groupes différents tirés au hasard
        const order = pick(groups.map((x) => ({ x })), g.bonusPick, rnd);
        const b = [], btag = {};
        for (const grp of order) {
          const pool = tb[grp].filter((o) => !b.includes(o.x));
          const x = pick(pool, 1, rnd)[0];
          if (x !== undefined) { b.push(x); btag[x] = grp; }
        }
        sortNum(n); sortNum(b);
        if (n.length !== g.mainPick || b.length !== g.bonusPick) continue;
        const cand = { n, b };
        if (seen.has(key(cand))) continue;
        if (parent.antishare && !antiShareOk(n)) continue;
        sub = { n, b, tag, btag, months };
      }
      if (sub) seen.add(key(sub));
      subs.push(sub);
    }

    for (const s of subs) {
      if (s && (s.n.some((x) => exMain.has(x)) || s.b.some((x) => exBonus.has(x)))) throw new Error("Règle d'exclusion violée (sous-grille)");
    }
    return subs;
  }

  const api = { addSubgrids, antiShareOk };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.LotoSub = api;
})(typeof self !== "undefined" ? self : this);

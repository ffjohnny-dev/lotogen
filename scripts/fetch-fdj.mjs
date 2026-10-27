// Robot LotoGen : lit les fichiers CSV officiels FDJ (déjà décompressés par le workflow)
// et produit data/loto.json et data/euromillions.json pour l'appli.
// Aucune dépendance : Node.js seul.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const KEEP_DAYS = 400; // on garde ~13 mois de tirages, largement assez pour l'analyse

const GAMES = [
  { id: "loto", dir: "tmp/loto", main: 5, bonusCols: ["numero_chance"], mainMax: 49, bonusMax: 10 },
  { id: "euromillions", dir: "tmp/em", main: 5, bonusCols: ["etoile_1", "etoile_2"], mainMax: 50, bonusMax: 12 },
];

function listCsv(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listCsv(p));
    else if (/\.csv$/i.test(e.name)) out.push(p);
  }
  return out;
}

// Accepte 26/10/2026, 26/10/26, 20261026, 2026-10-26
export function parseDate(s) {
  s = String(s || "").trim().replace(/"/g, "");
  let m;
  if ((m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/))) return `${m[3]}-${m[2]}-${m[1]}`;
  if ((m = s.match(/^(\d{2})\/(\d{2})\/(\d{2})$/))) return `20${m[3]}-${m[2]}-${m[1]}`;
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

export function parseCsv(text, game) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const head = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  const col = (name) => head.indexOf(name);
  const iDate = col("date_de_tirage");
  const iMain = Array.from({ length: game.main }, (_, k) => col(`boule_${k + 1}`));
  const iBonus = game.bonusCols.map(col);
  if (iDate < 0 || iMain.some((i) => i < 0) || iBonus.some((i) => i < 0)) {
    console.warn(`  colonnes introuvables, fichier ignoré. En-tête : ${head.slice(0, 14).join(" | ")}`);
    return [];
  }
  const draws = [];
  for (const line of lines.slice(1)) {
    const c = line.split(sep);
    const date = parseDate(c[iDate]);
    const n = iMain.map((i) => parseInt(c[i], 10));
    const b = iBonus.map((i) => parseInt(c[i], 10));
    const ok =
      date &&
      n.every((x) => x >= 1 && x <= game.mainMax) &&
      b.every((x) => x >= 1 && x <= game.bonusMax) &&
      new Set(n).size === n.length;
    if (ok) draws.push({ date, n: n.sort((a, z) => a - z), b: b.sort((a, z) => a - z) });
  }
  return draws;
}

function run() {
  let failed = false;
  for (const game of GAMES) {
    const files = listCsv(path.join(ROOT, game.dir));
    console.log(`${game.id} : ${files.length} fichier(s) CSV`);
    const byDate = new Map();
    for (const f of files) {
      const text = fs.readFileSync(f, "latin1");
      const d = parseCsv(text, game);
      console.log(`  ${path.basename(f)} → ${d.length} tirages`);
      for (const x of d) if (!byDate.has(x.date)) byDate.set(x.date, x);
    }
    const all = [...byDate.values()].sort((a, z) => (a.date < z.date ? 1 : -1));
    if (!all.length) {
      console.error(`ERREUR : aucun tirage ${game.id} lu. Fichier non modifié.`);
      failed = true;
      continue;
    }
    const limit = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString().slice(0, 10);
    const draws = all.filter((x) => x.date >= limit);
    const out = { game: game.id, source: "FDJ – historique officiel", updated: new Date().toISOString(), last: draws[0]?.date, draws };
    fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
    fs.writeFileSync(path.join(ROOT, "data", `${game.id}.json`), JSON.stringify(out));
    console.log(`  OK : ${draws.length} tirages gardés, dernier le ${out.last}`);
  }
  if (failed) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) run();

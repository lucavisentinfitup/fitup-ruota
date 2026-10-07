// Compila i bundle "legacy" in ES5 puro:
//   public/tv/tv.js     → schermo TV (VIDAA dal 2019 / U3.0, Samsung Tizen)
//   public/lite/lite.js → gioco per telefoni con browser vecchi (iOS < 16.4, Chrome < 94)
// Concatena i moduli condivisi con il gioco principale togliendo import/export e li transpila
// con TypeScript a target ES5; poi verifica con acorn che la sintassi sia davvero ES5.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import ts from "typescript";
import { parse } from "acorn";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const shared = ["lib/color.ts", "components/wheel/motion.ts", "components/wheel/draw.ts", "legacy/common.ts"];
const bundles = [
  { entry: "legacy/tv.ts", out: "public/tv/tv.js", css: "public/tv/tv.css", title: "schermo TV" },
  { entry: "legacy/lite.ts", out: "public/lite/lite.js", css: "public/lite/lite.css", title: "gioco lite" },
];

const strip = (f) =>
  `// ---- ${f}\n` +
  fs
    .readFileSync(path.join(root, f), "utf8")
    .replace(/^import\s[^;]*;\s*$/gm, "")
    .replace(/^export\s+(?=(const|let|var|function|interface|type|class)\b)/gm, "");

const hash = crypto.createHash("sha1");
for (const b of bundles) {
  const src = [...shared, b.entry].map(strip).join("\n");
  // i tipi sono già verificati da `tsc` sul progetto; qui conta solo produrre ES5
  const out = ts.transpileModule(src, {
    compilerOptions: { target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS, removeComments: true },
  });
  const js = `/* FitUP ruota – ${b.title} (ES5, generato da scripts/build-legacy.mjs) */\n(function(){\n${out.outputText}\n})();\n`;
  parse(js, { ecmaVersion: 5 });
  for (const api of [".includes(", ".startsWith(", ".endsWith(", "Array.from(", "Object.entries(", "Object.values(", "new Map(", "new Set(", "fetch("]) {
    if (js.includes(api)) throw new Error(`${b.out}: API non ES5 trovata: ${api}`);
  }
  fs.mkdirSync(path.dirname(path.join(root, b.out)), { recursive: true });
  fs.writeFileSync(path.join(root, b.out), js);
  hash.update(js).update(fs.readFileSync(path.join(root, b.css)));
  console.log(`${b.out}: ES5 ok (${(js.length / 1024).toFixed(1)} KB)`);
}
const build = hash.digest("hex").slice(0, 10);
fs.writeFileSync(path.join(root, "lib/tv-build.ts"), `// generato da scripts/build-legacy.mjs\nexport const TV_BUILD = "${build}";\n`);
console.log(`build ${build}`);

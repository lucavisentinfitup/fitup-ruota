// Genera la guida PDF per i club: docs/guida/guida.html → docs/Guida-Ruota-FitUP-club.pdf
// Uso: node scripts/build-guida.mjs   (serve Microsoft Edge o Chrome installato)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const dir = path.join(root, "docs/guida");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const rows = fs
  .readFileSync(path.join(root, "LINK-RUOTE-FITUP.csv"), "utf8")
  .replace(/^\uFEFF/, "")
  .split(/\r?\n/)
  .slice(1)
  .filter(Boolean)
  .map((l) => l.split(";"))
  .map(([club, evento, am, gioco, , corto, codice]) => ({ club, evento, am, gioco: gioco.replace("https://", ""), corto, codice }));

const table = rows
  .map(
    (r) => `<tr><td><b>${esc(r.club)}</b></td><td>${esc(r.evento.replace(" – ", " · ").replace(/ \(non nel calendario\)/, ""))}</td><td class="mono">${esc(r.corto)}</td><td class="mono">${esc(r.codice)}</td><td class="mono">${esc(r.gioco.replace(/^.*\/gioca\//, ""))}</td></tr>`,
  )
  .join("\n");

const html = fs.readFileSync(path.join(dir, "template.html"), "utf8").replace("<!--TABELLA-->", table).replace("<!--NCLUB-->", String(rows.length));
fs.writeFileSync(path.join(dir, "guida.html"), html);

const browsers = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
];
const exe = browsers.find((b) => fs.existsSync(b));
if (!exe) throw new Error("Edge o Chrome non trovato");
const pdf = path.join(root, "docs/Guida-Ruota-FitUP-club.pdf");
execFileSync(exe, [
  "--headless=new",
  "--disable-gpu",
  "--no-pdf-header-footer",
  "--virtual-time-budget=8000",
  `--print-to-pdf=${pdf}`,
  "file:///" + path.join(dir, "guida.html").replace(/\\/g, "/"),
], { stdio: "ignore" });
console.log("PDF:", pdf);

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "index.html",
  "styles.css",
  "app.js",
  "portrait-points.js",
  "site-config.js",
  "contact.vcf",
  "assets/profile-dotmatrix-v3.webp",
  "assets/winbest-logo.webp",
  "assets/og-card-v3.jpg",
  "assets/vendor/qrcode.js"
];

const errors = [];
for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) errors.push(`不足ファイル: ${relative}`);
}

const configSource = fs.readFileSync(path.join(root, "site-config.js"), "utf8");
const sandbox = { window: {} };
vm.runInNewContext(configSource, sandbox);
const config = sandbox.window.SITE_CONFIG;
if (!config.publicUrl.startsWith("https://")) errors.push("publicUrl は https:// で始めてください");
if (config.contact.mapUrl !== "https://maps.app.goo.gl/D1rj1HTSVoHHWyPy5") {
  errors.push("GoogleマップURLはウインベスト株式会社の正式な場所リンクを使用してください");
}
if (config.person.professionJa !== "ICT戦略・AI活用コンサルタント") {
  errors.push("専門肩書きが正式採用文言と一致しません");
}
if (config.person.expertiseJa !== "構想策定から全体設計、技術リード、AI活用の定着まで") {
  errors.push("専門領域の説明が正式採用文言と一致しません");
}

const publicExtensions = new Set([".html", ".css", ".js", ".vcf", ".json", ".md"]);
const stack = [root];
while (stack.length) {
  const directory = stack.pop();
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "tools") continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) stack.push(full);
    else if (publicExtensions.has(path.extname(entry.name).toLowerCase())) {
      const content = fs.readFileSync(full, "utf8");
      if (/\bCOO\b/.test(content)) errors.push(`廃止肩書きが含まれています: ${path.relative(root, full)}`);
    }
  }
}

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
for (const fragment of ["og:title", "og:description", "og:image", "canonical", "theme-color"]) {
  if (!html.includes(fragment)) errors.push(`メタデータ不足: ${fragment}`);
}

for (const fragment of ["ICT戦略・AI活用コンサルタント", "構想策定から全体設計、技術リード、AI活用の定着まで", "class=\"expertise\""]) {
  if (!html.includes(fragment)) errors.push(`専門領域の表示不足: ${fragment}`);
}

if (!html.includes("https://maps.app.goo.gl/D1rj1HTSVoHHWyPy5")) {
  errors.push("ウインベスト株式会社の正式なGoogleマップリンクがHTMLにありません");
}

for (const fragment of ["portrait-points", "POINT FIELD", "portrait-points.js"]) {
  if (!html.includes(fragment)) errors.push(`点群肖像の構成不足: ${fragment}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("検証OK: 必須ファイル、公開URL、メタデータ、廃止肩書きを確認しました。");


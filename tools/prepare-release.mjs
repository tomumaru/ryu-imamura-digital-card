import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configSource = fs.readFileSync(path.join(root, "site-config.js"), "utf8");
const sandbox = { window: {} };
vm.runInNewContext(configSource, sandbox);
const config = sandbox.window.SITE_CONFIG;

if (!config?.publicUrl?.startsWith("https://")) {
  throw new Error("site-config.js の publicUrl に https:// の公開URLを設定してください。");
}

const escapeVCard = (value) => String(value).replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
const { person, company, contact, social } = config;
const vcard = [
  "BEGIN:VCARD",
  "VERSION:3.0",
  `N:${escapeVCard(person.nameJa.replace(/\s+/g, ";"))};;;`,
  `FN:${escapeVCard(person.nameJa)}`,
  `NICKNAME:${escapeVCard(person.nameEn)}`,
  `ORG:${escapeVCard(company.nameJa)}`,
  `TITLE:${escapeVCard(`${person.titleJa} / ${person.titleEn}`)}`,
  `TEL;TYPE=WORK,VOICE:${contact.telephone}`,
  `TEL;TYPE=CELL:${contact.mobile}`,
  `TEL;TYPE=WORK,FAX:${contact.fax}`,
  `EMAIL;TYPE=INTERNET,WORK:${contact.email}`,
  `ADR;TYPE=WORK:;;${escapeVCard(contact.address)};;;${contact.postalCode};日本`,
  `URL:${company.website}`,
  `URL;TYPE=LinkedIn:${social.linkedin}`,
  `NOTE:${escapeVCard(person.tagline)}`,
  "END:VCARD",
  ""
].join("\r\n");
fs.writeFileSync(path.join(root, "contact.vcf"), vcard, "utf8");

const baseUrl = config.publicUrl.endsWith("/") ? config.publicUrl : `${config.publicUrl}/`;
const ogImageUrl = new URL("assets/og-card.jpg", baseUrl).href;
const indexPath = path.join(root, "index.html");
let html = fs.readFileSync(indexPath, "utf8");
html = html
  .replace(/(<meta property="og:url" content=")[^"]+("\s*>)/, `$1${baseUrl}$2`)
  .replace(/(<meta property="og:image" content=")[^"]+("\s*>)/, `$1${ogImageUrl}$2`)
  .replace(/(<link rel="canonical" href=")[^"]+("\s*>)/, `$1${baseUrl}$2`);
fs.writeFileSync(indexPath, html, "utf8");

console.log(`公開URL: ${baseUrl}`);
console.log("contact.vcf と公開メタデータを更新しました。");

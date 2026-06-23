import { readFileSync, writeFileSync, mkdirSync, cpSync } from "fs";
import { minify as minifyJS } from "terser";
import postcss from "postcss";
import cssnano from "cssnano";
import { minify as minifyHTML } from "html-minifier-terser";
import { createHash } from "crypto";

const hash = (str) => createHash("md5").update(str).digest("hex").slice(0, 8);

// ── Output dir ────────────────────────────────────────────
mkdirSync("dist", { recursive: true });
mkdirSync("dist/assets/images", { recursive: true });

// ── Copy static assets ────────────────────────────────────
cpSync("assets", "dist/assets", { recursive: true });
cpSync("vendor", "dist/vendor", { recursive: true });

// ── Minify JS ─────────────────────────────────────────────
const rawJS = readFileSync("app.js", "utf8");
const jsResult = await minifyJS(rawJS, {
  compress: { drop_console: true, passes: 2 },
  mangle: { toplevel: true },
});
const jsHash = hash(jsResult.code);
const jsFile = `app.${jsHash}.js`;
writeFileSync(`dist/${jsFile}`, jsResult.code);
console.log(`✓ JS  → dist/${jsFile} (${(jsResult.code.length / 1024).toFixed(1)}kb)`);

// ── Minify CSS ────────────────────────────────────────────
const rawCSS = readFileSync("styles.css", "utf8");
const cssResult = await postcss([cssnano({ preset: "default" })]).process(rawCSS, { from: undefined });
const cssHash = hash(cssResult.css);
const cssFile = `styles.${cssHash}.css`;
writeFileSync(`dist/${cssFile}`, cssResult.css);
console.log(`✓ CSS → dist/${cssFile} (${(cssResult.css.length / 1024).toFixed(1)}kb)`);

// ── Minify HTML (swap hashed filenames) ───────────────────
let rawHTML = readFileSync("index.html", "utf8");
rawHTML = rawHTML
  .replace(`"styles.css"`, `"${cssFile}"`)
  .replace(`"app.js"`, `"${jsFile}"`);

const htmlResult = await minifyHTML(rawHTML, {
  collapseWhitespace: true,
  removeComments: true,
  removeAttributeQuotes: false,
  minifyCSS: true,
  minifyJS: true,
});
writeFileSync("dist/index.html", htmlResult);
console.log(`✓ HTML → dist/index.html (${(htmlResult.length / 1024).toFixed(1)}kb)`);

console.log("\nBuild complete → ./dist/");

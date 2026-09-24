const fs = require("fs");
const path = require("path");

const root = __dirname;
const dist = path.join(root, "dist");

const supabaseUrl = (process.env.SUPABASE_URL || "").trim();
const supabaseKey = (
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ""
).trim();

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const file of ["index.html", "styles.css", "app.js"]) {
  fs.copyFileSync(path.join(root, file), path.join(dist, file));
}

const config = `window.JUNIORSTART_CONFIG = ${JSON.stringify({
  supabaseUrl,
  supabasePublishableKey: supabaseKey
}, null, 2)};\n`;

fs.writeFileSync(path.join(dist, "config.js"), config, "utf8");

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "WARNING: SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY is missing. " +
    "The site will build, but Supabase features will stay disabled."
  );
} else {
  console.log("Supabase public configuration injected into dist/config.js.");
}

console.log(`Build complete: ${dist}`);

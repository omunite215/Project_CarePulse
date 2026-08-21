// Exports docs/architecture.drawio to public/screenshots/architecture.png.
//
// Uses the draw.io desktop binary, which ships a headless export mode. Kept as a
// script rather than a raw command because the binary lives in different places
// per platform and needs --no-sandbox in headless contexts.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const SOURCE = path.resolve("docs/architecture.drawio");
const OUTPUT = path.resolve("public/screenshots/architecture.png");

const CANDIDATES = [
  process.env.DRAWIO_PATH,
  "C:\\Program Files\\draw.io\\draw.io.exe",
  "C:\\Program Files (x86)\\draw.io\\draw.io.exe",
  "/Applications/draw.io.app/Contents/MacOS/draw.io",
  "/usr/bin/drawio",
  "/usr/local/bin/drawio",
].filter(Boolean);

const binary = CANDIDATES.find((candidate) => existsSync(candidate));

if (!binary) {
  console.error(
    "draw.io desktop was not found. Install it from https://www.drawio.com/,\n" +
      "or set DRAWIO_PATH to the executable. The .drawio source is committed, so\n" +
      "the diagram can also be exported by hand from the app.",
  );
  process.exit(1);
}

if (!existsSync(SOURCE)) {
  console.error(`Missing diagram source: ${SOURCE}`);
  process.exit(1);
}

mkdirSync(path.dirname(OUTPUT), { recursive: true });

const args = [
  "--export",
  "--format",
  "png",
  "--scale",
  "2",
  "--border",
  "24",
  "--output",
  OUTPUT,
  SOURCE,
];

// Electron refuses to start headless without this in most CI/service contexts.
if (process.platform !== "win32") args.unshift("--no-sandbox");

try {
  execFileSync(binary, args, { stdio: "inherit", timeout: 120_000 });
  console.warn(`Exported ${path.relative(process.cwd(), OUTPUT)}`);
} catch (error) {
  console.error("draw.io export failed:", error.message);
  process.exit(1);
}

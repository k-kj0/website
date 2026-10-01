import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// Pi 1.0 launch heroes, in the BYOC/MCP "Introducing" style: the Pi tile beside
// the bare Pi mark beside the title, over a dense grid of Pi tiles (faded tiles
// are sleeping sessions) with arrows out to E2B, Daytona, and Modal sandboxes.
//
//   pnpm tsx .claude/skills/create-launch-post/scripts/render-pi-hero.ts \
//     --output-dir /tmp/pi-hero [--variation a] [--browser /path/to/chrome]
//
// Writes <variation>-image.png (2048x1024), <variation>-social.png (2048x1238)
// and <variation>.html. With no --variation, renders all of them.
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SCRIPT_DIR, "../../../..");
const CARD_W = 2048;
const CARD_H = 1024;

const INK = "#1B1916";
const INK_SOFT = "#56524A";
const PAPER = "#EFEFEF";
const PINE = "#2E4034";

/** The Agents product accent, from `src/sitemap/product-metadata.ts`. */
const AGENTS = "#2C5A7A";

/**
 * Every variation is a dense 4x3 grid of small Pi tiles with one straight
 * arrow per sandbox provider (E2B, Daytona, Modal). They differ only in how
 * much room the diagram takes and how much space separates it from the title:
 *
 *   width   rendered diagram width, in px
 *   gap     space between the title and the diagram, in px
 *   tile    Pi tile size, in diagram units (providers are always larger)
 */
const LAYOUTS = {
	a: { width: 820, gap: 88, tile: 56 },
	b: { width: 740, gap: 104, tile: 56 },
	c: { width: 740, gap: 104, tile: 48 },
	d: { width: 660, gap: 120, tile: 52 },
} as const;
const VARIATIONS = Object.keys(LAYOUTS) as (keyof typeof LAYOUTS)[];
type Variation = (typeof VARIATIONS)[number];

/** The Pi mark from public/images/registry/pi.svg, in an 800x800 box. */
const PI_PATHS = (fill: string) =>
	`<path fill="${fill}" fill-rule="evenodd" d="M165.29 165.29H517.36V400H400V517.36H282.65V634.72H165.29ZM282.65 282.65V400H400V282.65Z"/><path fill="${fill}" d="M517.36 400H634.72V634.72H517.36Z"/>`;

/**
 * The Pi product tile, in the same 128-unit geometry as the product marks in
 * src/images/products/*-logo.svg and ProductBadge: a square rounded at
 * 34.375% in the Agents accent, a white inset ring, and the mark centered
 * inside the ring.
 */
const PI_MARK_SCALE = 52 / 470; // the mark spans 470 of its 800 units; draw it 52 wide
const PI_TILE = `<rect width="128" height="128" rx="44" fill="${AGENTS}"/>
	<rect x="18.25" y="18.25" width="91.5" height="91.5" rx="25.75" fill="none" stroke="#FFFFFF" stroke-width="8.5"/>
	<g transform="translate(${64 - 400 * PI_MARK_SCALE} ${64 - 400 * PI_MARK_SCALE}) scale(${PI_MARK_SCALE})">${PI_PATHS("#FFFFFF")}</g>`;

function piTile(x: number, y: number, s: number, opacity: number): string {
	return `<svg x="${x}" y="${y}" width="${s}" height="${s}" viewBox="0 0 128 128" opacity="${opacity}">${PI_TILE}</svg>`;
}

interface Logo {
	/** Inner SVG markup. */
	body: string;
	/** viewBox of the mark, cropped to the icon. */
	viewBox: string;
	/** Width of the mark inside a 128-unit tile. */
	size: number;
}

/** Strips the outer <svg> so a mark can be nested at any position. */
function inner(svg: string): string {
	return svg
		.replace(/<\?xml[^>]*\?>/i, "")
		.replace(/^[\s\S]*?<svg[^>]*>/i, "")
		.replace(/<\/svg>\s*$/i, "");
}

async function loadLogos(): Promise<Logo[]> {
	const read = (file: string) => readFile(file, "utf8");
	const registry = (name: string) => path.join(REPO, "public/images/registry", name);
	const [e2b, daytona, modal] = await Promise.all([
		// E2B's official Fire Orange symbol (e2b.dev/brand); registry/e2b.svg is the old gradient mark.
		read(path.join(SCRIPT_DIR, "../assets/logos/e2b.svg")),
		read(registry("daytona.svg")),
		read(registry("modal.svg")),
	]);
	return [
		// The symbol artwork carries its own clear space; crop to the mark.
		{ body: inner(e2b), viewBox: "30 30 67 60", size: 64 },
		{ body: inner(daytona), viewBox: "0 0 275 287", size: 72 },
		{ body: inner(modal), viewBox: "0 0 368 192", size: 88 },
	];
}

/** A provider in a white tile with the same 128-unit geometry as the Pi tile. */
function logoTile(x: number, y: number, s: number, logo: Logo): string {
	const m = logo.size;
	return `<svg x="${x}" y="${y}" width="${s}" height="${s}" viewBox="0 0 128 128">
		<rect x="1.5" y="1.5" width="125" height="125" rx="43" fill="#FFFFFF" stroke="${INK}" stroke-opacity="0.08" stroke-width="3"/>
		<svg x="${(128 - m) / 2}" y="${(128 - m) / 2}" width="${m}" height="${m}" viewBox="${logo.viewBox}" preserveAspectRatio="xMidYMid meet">${logo.body}</svg>
	</svg>`;
}

function dashedFrame(x: number, y: number, w: number, h: number, r: number): string {
	return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="none" stroke="${PINE}" stroke-width="2.5" stroke-dasharray="12 10"/>`;
}

function arrow(x1: number, x2: number, y: number): string {
	return `<path d="M${x1} ${y} H${x2}" stroke="${PINE}" stroke-width="3" marker-end="url(#arrow)"/>`;
}

/**
 * A dense 4x3 grid of Pi tiles in a dashed frame, with arrows to E2B, Daytona,
 * and Modal. The provider column and the grid frame are the same height and
 * share a vertical center, so every layout lines up on the same axis. About
 * one Pi tile in five is faded to read as a sleeping session; the scatter is
 * deterministic.
 */
function diagram(variation: Variation, logos: Logo[]): string {
	const COLS = 4;
	const ROWS = 3;
	const T = LAYOUTS[variation].tile; // Pi tile
	const G = Math.round(T * 0.22); // Pi tile gap
	const P = Math.round(T * 0.6); // grid frame padding
	const frameH = P * 2 + ROWS * T + (ROWS - 1) * G;
	const PG = Math.round(frameH * 0.06); // provider gap
	const PT = (frameH - 2 * PG) / 3; // provider tile: the column fills the frame's height
	const SPAN = 150; // between the grid frame and the providers
	const R = Math.round(T * 0.4); // frame corner radius
	const gridW = P * 2 + COLS * T + (COLS - 1) * G;
	const top = 4;

	let tiles = "";
	for (let r = 0; r < ROWS; r++) {
		for (let c = 0; c < COLS; c++) {
			const asleep = (r * 7 + c * 3) % 5 === 0;
			tiles += piTile(4 + P + c * (T + G), top + P + r * (T + G), T, asleep ? 0.25 : 1);
		}
	}

	const gridRight = 4 + gridW;
	const px = gridRight + SPAN;
	const providerY = (i: number) => top + i * (PT + PG);
	const providers = logos.map((logo, i) => logoTile(px, providerY(i), PT, logo)).join("");
	const arrows = logos
		.map((_, i) => {
			const y = providerY(i) + PT / 2;
			return `<path d="M${gridRight + 18} ${y} H${px - 16}" fill="none" stroke="${PINE}" stroke-width="2.5" stroke-linecap="round" marker-end="url(#arrow)"/>`;
		})
		.join("");

	const w = px + PT + 4;
	return `<svg viewBox="0 0 ${w} ${frameH + top * 2}" xmlns="http://www.w3.org/2000/svg">
		<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="${PINE}"/></marker></defs>
		${dashedFrame(4, top, gridW, frameH, R)}
		${tiles}
		${arrows}
		${providers}
	</svg>`;
}

// ---------------------------------------------------------------------------
// Layouts.

/** The bare Pi mark in ink, cropped to its own bounds, for beside the title. */
const piLockupMark = (size: number) =>
	`<div class="pi-mark" style="width:${size}px;height:${size}px"><svg viewBox="165.29 165.29 469.43 469.43">${PI_PATHS(INK)}</svg></div>`;

function body(variation: Variation, logos: Logo[]): string {
	return `<div class="intro">
		<p class="eyebrow">Introducing</p>
		<div class="lockup" style="margin-bottom:${LAYOUTS[variation].gap}px">${piLockupMark(118)}<h1>Pi 1.0 for Rivet</h1></div>
		<div class="diagram" style="width:${LAYOUTS[variation].width}px">${diagram(variation, logos)}</div>
	</div>`;
}

async function buildHtml(variation: Variation): Promise<string> {
	const [sans, logos] = await Promise.all([
		readFile(path.join(REPO, "public/fonts/manrope/Manrope-Variable-latin.woff2")),
		loadLogos(),
	]);

	return `<!doctype html><html><head><meta charset="utf-8"><style>
	@font-face { font-family: "Manrope"; src: url("data:font/woff2;base64,${sans.toString("base64")}") format("woff2"); font-weight: 200 800; }
	* { box-sizing: border-box; }
	html, body { margin: 0; background: ${PAPER}; }
	.stage { position: relative; width: ${CARD_W}px; height: ${CARD_H}px; overflow: hidden; background: ${PAPER}; }
	.card { position: absolute; left: 0; top: 0; width: ${CARD_W}px; height: ${CARD_H}px; font-family: "Manrope", sans-serif; color: ${INK}; }
	.eyebrow { margin: 0 0 32px; font-size: 44px; line-height: 1; font-weight: 500; color: ${INK_SOFT}; }
	h1 { margin: 0; font-weight: 500; letter-spacing: -0.02em; line-height: 1; font-size: 140px; white-space: nowrap; }
	.diagram svg { display: block; width: 100%; height: auto; }
	.pi-mark { flex: none; }
	.pi-mark svg { display: block; width: 100%; height: 100%; }
	.lockup { display: flex; align-items: center; gap: 44px; }

	.intro { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }

	</style></head><body><div class="stage"><div class="card v-${variation}">
	${body(variation, logos)}
	</div></div></body></html>`;
}

function parseArgs(argv: string[]) {
	const args = argv[0] === "--" ? argv.slice(1) : argv;
	const opt = (flag: string) => {
		const index = args.indexOf(flag);
		return index >= 0 ? args[index + 1] : undefined;
	};
	const outputDir = opt("--output-dir");
	if (!outputDir)
		throw new Error(
			`Usage: render-pi-hero.ts --output-dir <path> [--variation ${VARIATIONS.join("|")}] [--browser <path>]`,
		);
	const one = opt("--variation") as Variation | undefined;
	if (one && !VARIATIONS.includes(one)) throw new Error(`Unknown variation: ${one}`);
	return {
		outputDir: path.resolve(outputDir),
		variations: one ? [one] : [...VARIATIONS],
		browser: opt("--browser"),
	};
}

async function main() {
	const { outputDir: OUT, variations, browser: executablePath } = parseArgs(process.argv.slice(2));
	await mkdir(OUT, { recursive: true });
	const browser = await chromium.launch({ executablePath });
	for (const variation of variations) {
		const html = await buildHtml(variation);
		await writeFile(path.join(OUT, `${variation}.html`), html);
		for (const target of [
			{ name: "image", w: 2048, h: 1024 },
			{ name: "social", w: 2048, h: 1238 },
		]) {
			const page = await browser.newPage({
				viewport: { width: target.w, height: target.h },
				deviceScaleFactor: 1,
			});
			await page.setContent(html, { waitUntil: "load" });
			await page.evaluate(() => document.fonts.ready);
			await page.evaluate((h) => {
				const stage = document.querySelector<HTMLElement>(".stage")!;
				const card = document.querySelector<HTMLElement>(".card")!;
				stage.style.height = `${h}px`;
				card.style.top = `${Math.round((h - 1024) / 2)}px`;
			}, target.h);
			await page.screenshot({ path: path.join(OUT, `${variation}-${target.name}.png`) });
			await page.close();
			console.log(`wrote ${variation}-${target.name}.png`);
		}
	}
	await browser.close();
}

main().catch((e) => {
	console.error(e);
	process.exitCode = 1;
});

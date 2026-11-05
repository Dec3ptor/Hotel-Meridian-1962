/**
 * Browser smoke test: builds the game, serves dist/ on a local port, opens it
 * in headless Chromium at phone-landscape and desktop sizes, lets the night
 * run, and reports console errors, frame rate and screenshots.
 *
 *   npm run smoke [-- --keep] [--seconds 8]
 */
import { execSync } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);

// Minimal typing for the globally installed Playwright (not a project dependency).
interface PwPage {
  on(event: 'console', cb: (msg: { type(): string; text(): string }) => void): void;
  on(event: 'pageerror', cb: (err: unknown) => void): void;
  goto(url: string, opts?: { waitUntil?: string }): Promise<unknown>;
  waitForFunction(fn: () => boolean, arg?: unknown, opts?: { timeout?: number }): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  mouse: { click(x: number, y: number): Promise<void> };
  touchscreen: { tap(x: number, y: number): Promise<void> };
  keyboard: { press(key: string): Promise<void> };
  $$(selector: string): Promise<{ click(): Promise<void> }[]>;
  evaluate<T>(fn: (arg: number) => Promise<T> | T, arg: number): Promise<T>;
  screenshot(opts: { path: string }): Promise<unknown>;
}
interface PwContext {
  newPage(): Promise<PwPage>;
  close(): Promise<void>;
}
interface PwBrowser {
  newContext(opts: Record<string, unknown>): Promise<PwContext>;
  close(): Promise<void>;
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require('playwright') as { chromium: { launch(opts?: Record<string, unknown>): Promise<PwBrowser> } };

const root = resolve(process.cwd());
const dist = join(root, 'dist');
const outDir = process.env.SMOKE_OUT ?? join(root, 'smoke-out');
const seconds = Number(process.argv[process.argv.indexOf('--seconds') + 1] || 0) || 8;

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

async function main(): Promise<void> {
  if (!process.argv.includes('--no-build')) {
    console.log('building...');
    execSync('npx vite build', { stdio: 'inherit', cwd: root });
  }
  execSync(`mkdir -p "${outDir}"`);
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let file = join(dist, decodeURIComponent(url.pathname));
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html');
    res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
    createReadStream(file).pipe(res);
  });
  await new Promise<void>((r) => server.listen(0, r));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const base = `http://localhost:${port}/`;
  console.log(`serving ${dist} at ${base}`);

  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  let failures = 0;
  for (const view of [
    { name: 'phone', width: 844, height: 390, scale: 2, mobile: true },
    { name: 'desktop', width: 1280, height: 720, scale: 1, mobile: false },
  ]) {
    const context = await browser.newContext({
      viewport: { width: view.width, height: view.height },
      deviceScaleFactor: view.scale,
      isMobile: view.mobile,
      hasTouch: view.mobile,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(String(err)));
    await page.goto(`${base}?seed=7`, { waitUntil: 'load' });
    await page.waitForFunction(() => (window as unknown as { meridian?: { started: boolean } }).meridian?.started === true, undefined, { timeout: 20000 });
    // A tap on the floor near the player and a wait, to exercise input and fast-forward.
    if (view.mobile) await page.touchscreen.tap(view.width / 2 + 40, view.height / 2 + 20);
    else await page.mouse.click(view.width / 2 + 40, view.height / 2 + 20);
    await page.waitForTimeout(1500);
    await page.keyboard.press('t');
    await page.waitForTimeout(300);
    const waitButtons = await page.$$('.menu button');
    if (waitButtons[1]) await waitButtons[1].click();
    // Evaluated as source text so the TypeScript loader's helpers are not serialised into the page.
    const measure = `(async () => {
      const g = window.meridian;
      const t0 = g.world.tick;
      let frames = 0;
      const start = performance.now();
      await new Promise((resolve) => {
        function tick() {
          frames++;
          if (performance.now() - start < ${seconds * 1000}) requestAnimationFrame(tick);
          else resolve();
        }
        requestAnimationFrame(tick);
      });
      const p = g.world.agents.player;
      const failed = g.world.log.filter((e) => e.type === 'ActionFailed').map((e) => e.action + ': ' + e.reason);
      return { ticksAdvanced: g.world.tick - t0, fps: (frames * 1000) / (performance.now() - start), events: g.world.log.length, tick: g.world.tick, room: p.room, pos: p.pos, commands: g.world.commands.map((c) => c.action), failed };
    })()`;
    const stats = (await page.evaluate(measure as unknown as (arg: number) => unknown, 0)) as { ticksAdvanced: number; fps: number; events: number; tick: number; room: string; pos: unknown; commands: string[]; failed: string[] };
    await page.screenshot({ path: join(outDir, `${view.name}.png`) });
    await page.keyboard.press('`');
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(outDir, `${view.name}-debug.png`) });
    await page.keyboard.press('`');
    console.log(`${view.name}: ${JSON.stringify(stats)} errors=${errors.length}`);
    for (const e of errors.slice(0, 10)) console.log(`  error: ${e}`);
    if (errors.length > 0 || stats.ticksAdvanced <= 0) failures++;
    await context.close();
  }
  await browser.close();
  server.close();
  if (failures > 0) {
    console.log(`smoke: ${failures} view(s) failed`);
    process.exit(1);
  }
  console.log(`smoke: ok (screenshots in ${outDir})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

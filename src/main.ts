import './ui/styles.css';
import { Game } from './game/game';

declare global {
  interface Window {
    meridian?: Game;
  }
}

async function main(): Promise<void> {
  const appRoot = document.getElementById('app');
  const uiRoot = document.getElementById('ui');
  if (!appRoot || !uiRoot) throw new Error('Missing #app or #ui');
  const params = new URLSearchParams(location.search);
  const seed = Number(params.get('seed') ?? 1962);
  const game = await Game.boot(appRoot, uiRoot, { seed: Number.isFinite(seed) ? seed : 1962 });
  window.meridian = game;
  if (params.get('autostart') === '1') game.start();
  else game.showTitleScreen();
}

main().catch((err) => {
  console.error(err);
  const ui = document.getElementById('ui');
  if (ui) {
    const p = document.createElement('div');
    p.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#e8dcc0;font-family:monospace;padding:20px;text-align:center;pointer-events:auto';
    p.textContent = `The Meridian could not start: ${err instanceof Error ? err.message : String(err)}`;
    ui.appendChild(p);
  }
});

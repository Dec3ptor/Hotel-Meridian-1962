// Phase 1 is headless. Rendering (Phase 3) will mount a PixiJS scene here.
// For now the page confirms the simulation runs in the browser build.
import './content';
import { createSim } from './sim/sim';
import { formatClock } from './sim/clock';

const app = document.getElementById('app');
if (app) {
  const sim = createSim({ seed: 1 });
  sim.runNight();
  const w = sim.world;
  app.innerHTML = `<h1>The Meridian</h1><p>Headless night simulated to ${formatClock(w.tick)}. ` +
    `${w.log.length} events, ${w.decisions.length} decisions. Ending: ${w.ended?.ending ?? 'none'}.</p>` +
    `<p>Rendering arrives in Phase 3. Run <code>npm run sim</code> for the full logs.</p>`;
}

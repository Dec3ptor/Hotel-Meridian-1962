/**
 * Headless night: `npm run sim [-- --seed 7 --until 1:45 --all --quiet-decisions]`
 * Prints the event log and the decision log with clock times, then the ending.
 */
import '../src/content';
import { formatClock, timeToTick } from '../src/sim/clock';
import { endingDef } from '../src/sim/endings';
import { formatDecisionLog, formatEventLine } from '../src/sim/events';
import { createSim } from '../src/sim/sim';
import type { WorldEvent } from '../src/sim/types';

const args = process.argv.slice(2);
function opt(name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}
const seed = Number(opt('seed') ?? 1);
const until = opt('until');
const all = args.includes('--all');
const quietDecisions = args.includes('--quiet-decisions');
const quietEvents = args.includes('--quiet-events');

const NOISY: Set<WorldEvent['type']> = new Set(['Moved', 'DoorOpened', 'DoorClosed', 'SawItem', 'Saw', 'Heard', 'ItemChanged', 'FixtureChanged', 'MoodChanged', 'PlanStarted', 'PlanCompleted', 'GoalChanged']);

const sim = createSim({ seed });
const t0 = performance.now();
if (until) sim.runUntil(timeToTick(until));
else sim.runNight();
const ms = performance.now() - t0;
const w = sim.world;

if (!quietEvents) {
  console.log(`=== Event log (seed ${seed}${all ? '' : ', quiet events hidden; --all to show'}) ===`);
  for (const ev of w.log) {
    if (!all && NOISY.has(ev.type)) continue;
    console.log(formatEventLine(ev));
  }
}
if (!quietDecisions) {
  console.log('\n=== Decision log ===');
  console.log(formatDecisionLog(w));
}
console.log('\n=== Summary ===');
console.log(`Clock ${formatClock(w.tick)} after ${w.tick} ticks in ${ms.toFixed(1)} ms; ${w.log.length} events, ${w.decisions.length} decisions.`);
for (const id of ['walter', 'voss', 'vivian', 'hale', 'jimmy', 'ruth', 'player'] as const) {
  const a = w.agents[id]!;
  console.log(`  ${id.padEnd(7)} ${a.alive ? 'alive' : 'DEAD '} in ${a.room.padEnd(9)} fear ${a.mood.fear.toFixed(1)} anger ${a.mood.anger.toFixed(1)} susp ${a.mood.suspicion.toFixed(1)} drunk ${a.mood.drunk.toFixed(1)} carrying [${a.inventory.join(', ')}]`);
}
if (w.ended) {
  const e = w.ended.ending ? endingDef(sim.s, w.ended.ending) : undefined;
  console.log(`Loop ended (${w.ended.reason}): ${e ? `${e.title} — ${e.epilogue}` : 'no ending matched'}`);
}

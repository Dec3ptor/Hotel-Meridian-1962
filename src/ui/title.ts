/** The title screen: deco frame, neon VACANCY, begin/continue, fullscreen and settings. */
import type { Overlays } from './overlays';

export interface TitleHandlers {
  onBegin: () => void;
  onFullscreen: () => void;
  onSettings: () => void;
  onClearMemory: () => void;
}

export function showTitle(overlays: Overlays, nights: number, endingsFound: number, totalEndings: number, h: TitleHandlers): void {
  const content = document.createElement('div');
  content.className = 'title';
  const vacancy = document.createElement('div');
  vacancy.className = 'vacancy';
  vacancy.textContent = 'VACANCY';
  const p = document.createElement('p');
  p.style.textAlign = 'center';
  p.textContent = 'A stormy night in 1962. The bridge is out, the phones are dead, and at twenty to two a man will die upstairs. The night repeats. What you learn does not reset.';
  const stats = document.createElement('p');
  stats.className = 'muted';
  stats.style.textAlign = 'center';
  stats.textContent = nights > 0 ? `${nights} night${nights === 1 ? '' : 's'} so far · ${endingsFound} of ${totalEndings} endings found` : 'Tap to walk. Tap things to use them. Long-press to look. Everything you learn goes in the notebook.';
  content.append(vacancy, p, stats);
  overlays.card({
    title: 'THE MERIDIAN',
    subtitle: 'Hotel Meridian · 10:00 PM',
    content,
    buttons: [
      { label: nights > 0 ? `Night ${nights + 1}` : 'Begin the night', primary: true, run: h.onBegin },
      { label: 'Fullscreen', run: h.onFullscreen },
      { label: 'Settings', run: h.onSettings },
      ...(nights > 0 ? [{ label: 'Forget everything', run: h.onClearMemory }] : []),
    ],
  });
}

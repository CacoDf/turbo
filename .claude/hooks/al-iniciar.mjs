// Al abrir una sesión de Claude Code: deja el repo en turbo-2 y al día con GitHub, sin pedírselo a mano.
// Seguro: nunca toca main, nunca borra cambios sin guardar y nunca fuerza nada. Lo que imprime lo lee Claude.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const espera = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

export function ponerAlDia({ cwd = process.cwd(), rama = 'turbo-2', remoto = 'origin', reintentos = [2000, 4000] } = {}) {
  const git = (...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const avisos = [];
  try { git('rev-parse', '--is-inside-work-tree'); } catch { return 'No es un repo git: no se revisó la rama.'; }

  let conRed = false;
  for (let i = 0; i <= reintentos.length && !conRed; i++) {
    try { git('fetch', remoto, rama); conRed = true; } catch { if (i < reintentos.length) espera(reintentos[i]); }
  }
  if (!conRed) avisos.push(`No se pudo revisar GitHub (sin red): podría faltar lo último de ${rama}. Antes de seguir, intenta "git pull ${remoto} ${rama}".`);

  const sucio = () => git('status', '--porcelain', '--untracked-files=no') !== '';
  let actual = git('branch', '--show-current');
  if (actual !== rama) {
    if (sucio()) avisos.push(`Estás en "${actual || '(sin rama)'}" con cambios sin guardar: no cambié a ${rama}. Guárdalos (commit) y cambia a ${rama}.`);
    else {
      try {
        try { git('rev-parse', '--verify', `refs/heads/${rama}`); git('checkout', rama); } catch { git('checkout', '-b', rama, '--track', `${remoto}/${rama}`); }
        avisos.push(`Cambié de "${actual || '(sin rama)'}" a ${rama}.`);
        actual = rama;
      } catch (e) { avisos.push(`No pude cambiar a ${rama}: ${e.message.split('\n')[0]}`); }
    }
  }

  if (conRed && actual === rama) {
    const atras = Number(git('rev-list', '--count', `HEAD..${remoto}/${rama}`));
    if (atras > 0) {
      if (sucio()) avisos.push(`${rama} está ${atras} commits atrás de GitHub, pero hay cambios sin guardar: no actualicé.`);
      else {
        try { git('merge', '--ff-only', `${remoto}/${rama}`); avisos.push(`Traje ${atras} commits nuevos de GitHub.`); }
        catch { avisos.push(`${rama} y GitHub se separaron: no actualicé. Hay que mergear ${remoto}/${rama} a mano.`); }
      }
    }
  }

  let siguiente = '';
  try { siguiente = (readFileSync(join(cwd, 'docs/PROGRESO.md'), 'utf8').match(/^Siguiente:.*$/m) || [''])[0]; } catch {}
  const alDia = conRed && actual === rama && Number(git('rev-list', '--count', `HEAD..${remoto}/${rama}`)) === 0;
  return [
    alDia ? `Repo al día: rama ${rama}, commit ${git('rev-parse', '--short', 'HEAD')}.` : `Ojo: el repo podría no estar al día (rama ${actual || '?'}).`,
    ...avisos,
    siguiente && `Estado según docs/PROGRESO.md → ${siguiente}`,
  ].filter(Boolean).join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { console.log(ponerAlDia({ cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd() })); } catch (e) { console.log(`No se pudo revisar la rama: ${e.message}`); }
}

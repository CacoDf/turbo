// El hook de inicio (.claude/hooks/al-iniciar.mjs) sobre repos git de verdad, en una carpeta temporal.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ponerAlDia } from '../../.claude/hooks/al-iniciar.mjs';

const ENV = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const git = (cwd, ...a) => execFileSync('git', a, { cwd, env: ENV, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
let raiz;
before(async () => { raiz = await mkdtemp(join(tmpdir(), 'turbo-hook-')); });
after(() => rm(raiz, { recursive: true, force: true }));

// GitHub falso (bare) con main y turbo-2, una copia "vieja" y otra que sube commits nuevos a turbo-2.
async function mundo(nombre) {
  const dir = join(raiz, nombre);
  const remoto = join(dir, 'remoto.git');
  const autor = join(dir, 'autor');
  await mkdir(autor, { recursive: true });
  git(dir, 'init', '--bare', '-b', 'main', remoto);
  git(autor, 'init', '-b', 'main');
  await mkdir(join(autor, 'docs'));
  await writeFile(join(autor, 'docs/PROGRESO.md'), 'Siguiente: Fase 0\n');
  git(autor, 'add', '.'); git(autor, 'commit', '-m', 'inicio');
  git(autor, 'remote', 'add', 'origin', remoto);
  git(autor, 'push', 'origin', 'main');
  git(autor, 'push', 'origin', 'main:turbo-2');
  const copia = join(dir, 'copia');
  git(dir, 'clone', '-q', remoto, copia);
  git(copia, 'checkout', '-q', '-b', 'turbo-2', '--track', 'origin/turbo-2');
  // Lo nuevo llega a GitHub después de clonar: la copia queda atrasada.
  git(autor, 'checkout', '-q', '-b', 'turbo-2');
  await writeFile(join(autor, 'docs/PROGRESO.md'), 'Siguiente: Sesión 2\n');
  git(autor, 'commit', '-qam', 'sesion 1'); git(autor, 'push', '-q', 'origin', 'turbo-2');
  return { copia, remoto, main: () => git(remoto, 'rev-parse', 'main') };
}

test('copia atrasada: trae lo nuevo de turbo-2 y avisa en qué sesión va', async () => {
  const { copia } = await mundo('atrasada');
  const msg = ponerAlDia({ cwd: copia, reintentos: [] });
  assert.match(msg, /Repo al día: rama turbo-2/);
  assert.match(msg, /Traje 1 commits/);
  assert.match(msg, /Siguiente: Sesión 2/);
});

test('en otra rama (main vieja): cambia a turbo-2 y la pone al día, sin tocar main en GitHub', async () => {
  const { copia, main } = await mundo('otra-rama');
  git(copia, 'checkout', '-q', 'main');
  const antes = main();
  const msg = ponerAlDia({ cwd: copia, reintentos: [] });
  assert.equal(git(copia, 'branch', '--show-current'), 'turbo-2');
  assert.match(msg, /Siguiente: Sesión 2/);
  assert.equal(main(), antes, 'main en GitHub no cambia');
});

test('con cambios sin guardar: no toca nada y lo avisa', async () => {
  const { copia } = await mundo('sucia');
  await writeFile(join(copia, 'docs/PROGRESO.md'), 'cambio a medias\n');
  const msg = ponerAlDia({ cwd: copia, reintentos: [] });
  assert.match(msg, /cambios sin guardar: no actualicé/);
  assert.match(msg, /Ojo: el repo podría no estar al día/);
  assert.equal(git(copia, 'status', '--porcelain'), 'M docs/PROGRESO.md', 'el cambio sigue ahí');
});

test('sin red: avisa en vez de fallar', async () => {
  const { copia } = await mundo('sin-red');
  git(copia, 'remote', 'set-url', 'origin', join(raiz, 'no-existe.git'));
  const msg = ponerAlDia({ cwd: copia, reintentos: [] });
  assert.match(msg, /No se pudo revisar GitHub/);
});

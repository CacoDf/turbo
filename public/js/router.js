// Navegación por hash (#/tareas, #/foco...) y re-dibujo de la pantalla actual.
let renderFn = null;

export const setRenderer = fn => (renderFn = fn);
export const rerender = () => renderFn?.();
export const route = () => (location.hash.replace(/^#\/?/, '').split('?')[0] || 'ahora');
export const go = path => {
  if (route() === path) rerender();
  else location.hash = `#/${path}`;
};

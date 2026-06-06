export function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    getState() {
      return state;
    },
    setState(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
      for (const l of listeners) l(state);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

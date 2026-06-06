export const STEPS = ['amount', 'review', 'processing', 'complete'];

function makeReference(amount, balance) {
  const n = Math.round((amount + balance) * 100) % 1000000;
  return 'PP-' + n.toString(36).toUpperCase().padStart(5, '0');
}

export function createWithdrawMachine({ balance, presets = [500, 1000, 1500] }) {
  let state = { step: 'amount', amount: 0, balance, presets, reference: null };

  function setStep(step) {
    state = { ...state, step };
    if (step === 'complete') state.reference = makeReference(state.amount, balance);
  }

  return {
    getState() {
      return state;
    },
    setAmount(n) {
      const amount = Math.max(0, Math.min(balance, Math.round(Number(n) * 100) / 100 || 0));
      state = { ...state, amount };
    },
    selectPreset(key) {
      if (key === 'max') this.setAmount(balance);
      else this.setAmount(Number(key));
    },
    next() {
      const i = STEPS.indexOf(state.step);
      if (state.step === 'amount' && state.amount <= 0) return;
      if (i < STEPS.length - 1) setStep(STEPS[i + 1]);
    },
    back() {
      if (state.step === 'complete') return; // terminal: no navigating back once a transfer is submitted
      const i = STEPS.indexOf(state.step);
      if (i > 0) setStep(STEPS[i - 1]);
    },
    reset() {
      state = { step: 'amount', amount: 0, balance, presets, reference: null };
    },
  };
}

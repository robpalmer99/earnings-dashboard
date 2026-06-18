export const defaultConfig = {
  brand: {
    name: 'Brandname',
    subtitle: 'Member Portal',
    logo: '',
  },
  theme: {
    accent: '#16a34a',
    base: 'light',
    font: "'Inter', system-ui, sans-serif",
    radius: 14,
  },
  locale: {
    currency: 'USD',
    locale: 'en-US',
  },
  data: {
    dailyMin: 300,
    dailyMax: 1100,
    trend: 0.5,
    volatility: 0.2,
    windowDays: 60,
    seed: 42,
    balance: null, // null = auto-derive from earnings (varies on Randomize); a number overrides

    todayDeltaOverride: 27.3,
    forcePositiveDeltas: true,
    weekendDip: false,
  },
  surfaces: {
    statCards: true,
    graph: true,
    balance: true,
    tables: true,
    payouts: true,
    tabBar: true,
  },
  withdraw: {
    bank: 'Bank of America ••4471',
    presets: [500, 1000, 1500],
    processingMs: 2600,
  },
  payouts: {
    count: 4,
  },
};

function isObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

export function mergeConfig(base, patch) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const key of Object.keys(patch || {})) {
    if (isObject(base[key]) && isObject(patch[key])) {
      out[key] = mergeConfig(base[key], patch[key]);
    } else {
      out[key] = patch[key];
    }
  }
  return out;
}

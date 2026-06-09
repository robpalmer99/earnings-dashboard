import { mergeConfig } from './schema.js';

export const presets = [
  { id: 'violet', label: 'Violet', patch: { theme: { accent: '#7c3aed', base: 'light' } } },
  { id: 'crypto-green', label: 'Crypto Green', patch: { theme: { accent: '#16a34a', base: 'light' } } },
  { id: 'luxury-gold', label: 'Luxury Gold', patch: { theme: { accent: '#d4a017', base: 'light' } } },
  { id: 'midnight', label: 'Midnight', patch: { theme: { accent: '#3b82f6', base: 'dark' } } },
  { id: 'mobile-profits', label: 'Mobile Profits', patch: { theme: { accent: '#ffd014', base: 'dark' } } },
];

export function applyPreset(config, id) {
  const preset = presets.find((p) => p.id === id);
  if (!preset) return config;
  return mergeConfig(config, preset.patch);
}

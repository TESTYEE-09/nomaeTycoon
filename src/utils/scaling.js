export function costFor(baseCost, growth, level) {
  return Math.ceil(baseCost * Math.pow(growth, level));
}

export function levelOf(save, key) {
  return save.charUpgrades?.[key] || 0;
}

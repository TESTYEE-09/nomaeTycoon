import { CLICK, CHAR_UPGRADES, TYCOON_UPGRADES, MACHINES, PRESTIGE } from '../config/balance.js';
import { costFor } from '../utils/scaling.js';

export class Economy {
  constructor(game) {
    this.game = game;
    this.comboStacks = 0;
    this.comboTimer = 0;
    this.goldenActive = false;
    this.goldenTimer = 0;
  }

  get save() {
    return this.game.save.data;
  }

  // ---- multipliers -------------------------------------------------------
  rebirthMultiplier() {
    const s = this.save;
    return 1 + s.crystals * PRESTIGE.multiplierPerCrystal;
  }

  prestigePermaMult() {
    const lvl = this.save.prestigeUpgrades?.permaMult || 0;
    return 1 + lvl * PRESTIGE.upgrades.permaMult.effectPerLevel;
  }

  charMultiplier() {
    const lvl = this.save.charUpgrades?.multiplier || 0;
    return 1 + lvl * CHAR_UPGRADES.multiplier.effectPerLevel;
  }

  goldenMultiplier() {
    return this.goldenActive ? 2 : 1;
  }

  totalMultiplier() {
    return this.rebirthMultiplier() * this.prestigePermaMult() * this.charMultiplier() * this.goldenMultiplier();
  }

  // ---- click ---------------------------------------------------------------
  clickValue() {
    const lvl = this.save.charUpgrades?.clickPower || 0;
    const clickBoostLvl = this.save.prestigeUpgrades?.clickBoost || 0;
    let value = CLICK.baseValue * (1 + lvl * CLICK.perLevelBonus) * (1 + clickBoostLvl * PRESTIGE.upgrades.clickBoost.effectPerLevel);
    const comboMult = 1 + Math.min(this.comboStacks, CLICK.comboMax) * CLICK.comboStep;
    value *= comboMult;
    value *= this.totalMultiplier();
    return value;
  }

  registerClick() {
    if (this.comboTimer > 0) {
      this.comboStacks = Math.min(CLICK.comboMax, this.comboStacks + 1);
    } else {
      this.comboStacks = 1;
    }
    this.comboTimer = CLICK.comboWindow;
    const value = this.clickValue();
    this.addGoo(value, 'click');
    this.save.clickCount = (this.save.clickCount || 0) + 1;
    this.game.quests.onProgress('click', 1);
    return value;
  }

  // ---- passive income --------------------------------------------------------
  machineCount(id) {
    return this.save.machines?.[id]?.count || 0;
  }

  machineOutput(machineDef) {
    const count = this.machineCount(machineDef.id);
    if (count <= 0) return 0;
    const lvl = this.save.machines?.[machineDef.id]?.level || 0;
    const speedLvl = this.save.tycoonUpgrades?.prodSpeed || 0;
    const valueLvl = this.save.tycoonUpgrades?.machineValue || 0;
    const workerLvl = this.save.tycoonUpgrades?.workerEff || 0;
    let perUnit = machineDef.baseOutput * (1 + lvl * 0.22) * (1 + valueLvl * TYCOON_UPGRADES.machineValue.effectPerLevel);
    perUnit *= 1 + speedLvl * TYCOON_UPGRADES.prodSpeed.effectPerLevel;
    if (machineDef.id === 'worker') perUnit *= 1 + workerLvl * TYCOON_UPGRADES.workerEff.effectPerLevel;
    return perUnit * count;
  }

  passiveIncomePerSecond() {
    let total = 0;
    for (const m of MACHINES) total += this.machineOutput(m);
    return total * this.totalMultiplier();
  }

  // ---- currency mutation -------------------------------------------------
  addGoo(amount, source = 'misc') {
    if (amount <= 0) return;
    this.save.goo += amount;
    this.save.lifetimeGoo += amount;
    this.game.quests.onProgress('earn', amount);
    this.game.ui.pulseCurrency('goo');
    return amount;
  }

  spend(amount) {
    this.save.goo = Math.max(0, this.save.goo - amount);
  }

  canAfford(amount) {
    return this.save.goo >= amount;
  }

  // ---- generic upgrade helpers ---------------------------------------------
  charUpgradeCost(key) {
    const def = CHAR_UPGRADES[key];
    const lvl = this.save.charUpgrades?.[key] || 0;
    return costFor(def.baseCost, def.costGrowth, lvl);
  }

  buyCharUpgrade(key) {
    const def = CHAR_UPGRADES[key];
    const lvl = this.save.charUpgrades?.[key] || 0;
    if (lvl >= def.max) return false;
    const cost = this.charUpgradeCost(key);
    if (!this.canAfford(cost)) return false;
    this.spend(cost);
    this.save.charUpgrades[key] = lvl + 1;
    this.save.totalPurchases = (this.save.totalPurchases || 0) + 1;
    this.game.quests.onProgress('buy', 1);
    return true;
  }

  tycoonUpgradeCost(key) {
    const def = TYCOON_UPGRADES[key];
    const lvl = this.save.tycoonUpgrades?.[key] || 0;
    return costFor(def.baseCost, def.costGrowth, lvl);
  }

  buyTycoonUpgrade(key) {
    const def = TYCOON_UPGRADES[key];
    const lvl = this.save.tycoonUpgrades?.[key] || 0;
    if (lvl >= def.max) return false;
    const cost = this.tycoonUpgradeCost(key);
    if (!this.canAfford(cost)) return false;
    this.spend(cost);
    this.save.tycoonUpgrades[key] = lvl + 1;
    this.save.totalPurchases = (this.save.totalPurchases || 0) + 1;
    this.game.quests.onProgress('buy', 1);
    return true;
  }

  machineCost(machineDef) {
    const count = this.machineCount(machineDef.id);
    return costFor(machineDef.baseCost, machineDef.costGrowth, count);
  }

  update(dt) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboStacks = 0;
    }
    if (this.goldenActive) {
      this.goldenTimer -= dt;
      if (this.goldenTimer <= 0) {
        this.goldenActive = false;
        this.game.ui.notify('Golden Rush ended', 'info');
      }
    }
    const income = this.passiveIncomePerSecond();
    if (income > 0) this.addGoo(income * dt, 'passive');
  }
}

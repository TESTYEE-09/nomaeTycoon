import { CHAR_UPGRADES, TYCOON_UPGRADES, MACHINES, ZONES, PRESTIGE } from '../config/balance.js';
import { formatNumber, formatRate } from '../utils/format.js';
import { FloatingTextManager } from '../systems/Particles.js';

const TUTORIAL_STEPS = [
  { cond: () => true, text: 'Tap the glowing Goo Blob (or hit the TAP button) to earn Goo!' },
  { cond: (g) => g.save.data.clickCount >= 3, text: 'Nice! Open the "You" menu below to spend Goo on upgrades.' },
  { cond: (g) => (g.save.data.charUpgrades.clickPower || 0) >= 1, text: 'Now check the "Tycoon" tab — buy a Goo Extractor for passive income!' },
  { cond: (g) => (g.save.data.machines?.extractor?.count || 0) >= 1, text: 'Your extractor works even while you explore. Walk around with WASD!' },
  { cond: (g) => g.save.data.lifetimeGoo >= 800, text: 'Check "Zones" to unlock new areas as you earn more Goo.' },
];

export class UIManager {
  constructor(game) {
    this.game = game;
    this.el = {};
    this._cacheEls();
    this._displayedGoo = 0;
    this._displayedCrystal = 0;
    this._wireEvents();
    this._buildStaticGrids();
    this.floatingText = new FloatingTextManager(game.camera.camera, this.el.floatingLayer);
    this._tutorialHiddenAt = null;
    this.refreshAll();
    this.setTab('character');
    this._updateTutorial();
  }

  _cacheEls() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      gooValue: $('goo-value'),
      gooRate: $('goo-rate'),
      gooPill: $('goo-pill'),
      crystalValue: $('crystal-value'),
      crystalPill: $('crystal-pill'),
      zoneName: $('zone-name'),
      settingsBtn: $('settings-btn'),
      goldenBanner: $('golden-banner'),
      goldenBarFill: $('golden-bar-fill'),
      comboIndicator: $('combo-indicator'),
      comboText: $('combo-text'),
      questList: $('quest-list'),
      padPrompt: $('pad-prompt'),
      padPromptText: $('pad-prompt-text'),
      tapBtn: $('tap-btn'),
      tabBtns: Array.from(document.querySelectorAll('.tab-btn')),
      panels: Array.from(document.querySelectorAll('.panel')),
      charUpgrades: $('character-upgrades'),
      machineList: $('machine-list'),
      tycoonUpgrades: $('tycoon-upgrades'),
      zoneList: $('zone-list'),
      prestigeInfo: $('prestige-info'),
      prestigeUpgrades: $('prestige-upgrades'),
      rebirthBtn: $('rebirth-btn'),
      toastStack: $('toast-stack'),
      floatingLayer: $('floating-text-layer'),
      tutorialBox: $('tutorial-box'),
      tutorialText: $('tutorial-text'),
      rebirthCinematic: $('rebirth-cinematic'),
      rebirthText: $('rebirth-text'),
      settingsModal: $('settings-modal'),
      musicVol: $('music-vol'),
      sfxVol: $('sfx-vol'),
      shadowToggle: $('shadow-toggle'),
      shakeToggle: $('shake-toggle'),
      resetSaveBtn: $('reset-save-btn'),
      closeSettingsBtn: $('close-settings-btn'),
      clickHint: $('click-hint'),
    };
  }

  _wireEvents() {
    const g = this.game;
    this.el.tapBtn.addEventListener('click', () => g.performTap());
    this.el.settingsBtn.addEventListener('click', () => this._openSettings());
    this.el.closeSettingsBtn.addEventListener('click', () => this.el.settingsModal.classList.add('hidden'));
    this.el.resetSaveBtn.addEventListener('click', () => {
      if (confirm('Reset ALL progress? This cannot be undone.')) {
        g.save.reset();
        location.reload();
      }
    });
    this.el.musicVol.addEventListener('input', (e) => {
      g.save.data.settings.musicVol = parseFloat(e.target.value);
      g.audio.setMusicVolume(g.save.data.settings.musicVol);
    });
    this.el.sfxVol.addEventListener('input', (e) => {
      g.save.data.settings.sfxVol = parseFloat(e.target.value);
      g.audio.setSfxVolume(g.save.data.settings.sfxVol);
    });
    this.el.shadowToggle.addEventListener('change', (e) => {
      g.save.data.settings.shadows = e.target.checked;
      g.setShadowsEnabled(e.target.checked);
    });
    this.el.shakeToggle.addEventListener('change', (e) => {
      g.save.data.settings.camShake = e.target.checked;
      g.camera.enableShake = e.target.checked;
    });
    this.el.rebirthBtn.addEventListener('click', () => g.prestige.doRebirth());

    for (const btn of this.el.tabBtns) {
      btn.addEventListener('click', () => this.setTab(btn.dataset.tab));
    }

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE') g.tycoon.tryBuyNear();
    });

    document.addEventListener(
      'pointerdown',
      () => {
        g.audio.unlock();
        if (this.el.clickHint) this.el.clickHint.style.opacity = '0';
      },
      { once: true }
    );
  }

  setTab(tab) {
    this.activeTab = tab;
    for (const btn of this.el.tabBtns) btn.classList.toggle('active', btn.dataset.tab === tab);
    for (const panel of this.el.panels) panel.classList.toggle('active', panel.dataset.panel === tab);
    this.game.audio.uiClick();
  }

  _openSettings() {
    const s = this.game.save.data.settings;
    this.el.musicVol.value = s.musicVol;
    this.el.sfxVol.value = s.sfxVol;
    this.el.shadowToggle.checked = s.shadows;
    this.el.shakeToggle.checked = s.camShake;
    this.el.settingsModal.classList.remove('hidden');
  }

  _buildStaticGrids() {
    this._renderCharUpgrades();
    this._renderMachines();
    this._renderTycoonUpgrades();
    this._renderZones();
    this._renderPrestige();
    this._renderQuests();
  }

  // ---------- generic upgrade card builder ----------
  _upgradeCard({ icon, name, desc, levelLabel, cost, canBuy, maxed, onBuy }) {
    const card = document.createElement('div');
    card.className = 'upgrade-card';
    card.innerHTML = `
      <div class="upgrade-card-head"><span class="upgrade-icon">${icon}</span><span class="upgrade-name">${name}</span></div>
      <div class="upgrade-desc">${desc}</div>
      <div class="upgrade-level">${levelLabel}</div>
      <button class="buy-btn ${canBuy ? 'affordable' : ''}" ${maxed || !canBuy ? 'disabled' : ''}>${maxed ? 'MAX' : formatNumber(cost) + ' Goo'}</button>
    `;
    const btn = card.querySelector('.buy-btn');
    if (maxed) btn.classList.add('maxed');
    if (!maxed) btn.addEventListener('click', () => onBuy());
    return card;
  }

  _renderCharUpgrades() {
    const g = this.game;
    this.el.charUpgrades.innerHTML = '';
    for (const key in CHAR_UPGRADES) {
      const def = CHAR_UPGRADES[key];
      const lvl = g.save.data.charUpgrades?.[key] || 0;
      const maxed = lvl >= def.max;
      const cost = g.economy.charUpgradeCost(key);
      const canBuy = !maxed && g.economy.canAfford(cost);
      this.el.charUpgrades.appendChild(
        this._upgradeCard({
          icon: def.icon,
          name: def.name,
          desc: def.desc,
          levelLabel: `Level ${lvl}${maxed ? ' (MAX)' : ''}`,
          cost,
          canBuy,
          maxed,
          onBuy: () => {
            if (g.economy.buyCharUpgrade(key)) {
              g.audio.upgrade();
              g.camera.punchZoom(0.15);
              this.notify(`${def.name} upgraded!`, 'success');
              this._renderCharUpgrades();
              this._applyPlayerGrowth();
            } else g.audio.error();
          },
        })
      );
    }
  }

  _renderMachines() {
    const g = this.game;
    this.el.machineList.innerHTML = '';
    for (const def of MACHINES) {
      const unlocked = g.tycoon.isUnlocked(def);
      const count = g.economy.machineCount(def.id);
      const cost = g.economy.machineCost(def);
      const maxed = count >= def.maxCount;
      const canBuy = unlocked && !maxed && g.economy.canAfford(cost);
      const card = document.createElement('div');
      card.className = 'upgrade-card';
      if (!unlocked) {
        card.innerHTML = `
          <div class="upgrade-card-head"><span class="upgrade-icon">🔒</span><span class="upgrade-name">${def.name}</span></div>
          <div class="upgrade-desc">Unlocks at ${formatNumber(def.unlockAt)} lifetime Goo</div>
          <div class="upgrade-level">Locked</div>
          <button class="buy-btn" disabled>LOCKED</button>`;
        this.el.machineList.appendChild(card);
        continue;
      }
      card.appendChild(
        this._upgradeCard({
          icon: def.icon,
          name: def.name,
          desc: def.desc + ` · ${formatRate(g.economy.machineOutput(def))}`,
          levelLabel: `Owned: ${count}${maxed ? ' (MAX)' : ''}`,
          cost,
          canBuy,
          maxed,
          onBuy: () => g.tycoon.buy(def.id) && this._renderMachines(),
        })
      );
      this.el.machineList.appendChild(card);
    }
  }

  _renderTycoonUpgrades() {
    const g = this.game;
    this.el.tycoonUpgrades.innerHTML = '';
    for (const key in TYCOON_UPGRADES) {
      const def = TYCOON_UPGRADES[key];
      const lvl = g.save.data.tycoonUpgrades?.[key] || 0;
      const maxed = lvl >= def.max;
      const cost = g.economy.tycoonUpgradeCost(key);
      const canBuy = !maxed && g.economy.canAfford(cost);
      this.el.tycoonUpgrades.appendChild(
        this._upgradeCard({
          icon: def.icon,
          name: def.name,
          desc: def.desc,
          levelLabel: `Level ${lvl}${maxed ? ' (MAX)' : ''}`,
          cost,
          canBuy,
          maxed,
          onBuy: () => {
            if (g.economy.buyTycoonUpgrade(key)) {
              g.audio.upgrade();
              this.notify(`${def.name} upgraded!`, 'success');
              this._renderTycoonUpgrades();
            } else g.audio.error();
          },
        })
      );
    }
  }

  _renderZones() {
    const g = this.game;
    this.el.zoneList.innerHTML = '';
    for (const zone of ZONES) {
      const unlocked = g.zones.isUnlocked(zone.id);
      const card = document.createElement('div');
      card.className = 'upgrade-card zone-card' + (unlocked ? '' : ' locked');
      const swatch = `<div class="zone-swatch" style="background:#${zone.color.toString(16).padStart(6, '0')}"></div>`;
      if (unlocked) {
        card.innerHTML = `${swatch}<div class="upgrade-card-head"><span class="upgrade-name">${zone.name}</span></div><div class="upgrade-desc">Unlocked ✔</div>
          <button class="buy-btn" id="travel-${zone.id}">Travel Here</button>`;
        this.el.zoneList.appendChild(card);
        card.querySelector('button').addEventListener('click', () => this.game.travelTo(zone.id));
      } else {
        const canBuy = g.zones.canAfford(zone);
        card.innerHTML = `${swatch}<div class="upgrade-card-head"><span class="upgrade-name">${zone.name}</span></div><div class="upgrade-desc">Requires ${formatNumber(zone.cost)} Goo</div>
          <button class="buy-btn ${canBuy ? 'affordable' : ''}" ${canBuy ? '' : 'disabled'}>Unlock — ${formatNumber(zone.cost)}</button>`;
        this.el.zoneList.appendChild(card);
        card.querySelector('button').addEventListener('click', () => {
          if (g.zones.unlock(zone.id)) this.refreshZones();
        });
      }
    }
  }

  _renderPrestige() {
    const g = this.game;
    const canRebirth = g.prestige.canRebirth();
    const gain = g.prestige.crystalGain();
    this.el.prestigeInfo.innerHTML = `
      Rebirths: <b>${g.save.data.rebirths}</b><br/>
      Lifetime Goo this run: <b>${formatNumber(g.save.data.lifetimeGoo)}</b> / ${formatNumber(PRESTIGE.unlockAt)}<br/>
      Rebirthing now grants <b style="color:#7dd3fc">+${gain} 💎 Crystals</b><br/>
      Current bonus: <b style="color:var(--goo)">+${Math.round((g.economy.rebirthMultiplier() - 1) * 100)}%</b> Goo income
    `;
    this.el.rebirthBtn.disabled = !canRebirth || gain <= 0;
    this.el.rebirthBtn.textContent = canRebirth ? `✨ Rebirth for +${gain} Crystals ✨` : `Reach ${formatNumber(PRESTIGE.unlockAt)} Lifetime Goo to Rebirth`;

    this.el.prestigeUpgrades.innerHTML = '';
    for (const key in PRESTIGE.upgrades) {
      const def = PRESTIGE.upgrades[key];
      const lvl = g.save.data.prestigeUpgrades?.[key] || 0;
      const maxed = lvl >= def.max;
      const cost = g.prestige.upgradeCost(key);
      const canBuy = !maxed && g.save.data.crystals >= cost;
      const card = document.createElement('div');
      card.className = 'upgrade-card';
      card.innerHTML = `
        <div class="upgrade-card-head"><span class="upgrade-icon">${def.icon}</span><span class="upgrade-name">${def.name}</span></div>
        <div class="upgrade-desc">${def.desc}</div>
        <div class="upgrade-level">Level ${lvl}${maxed ? ' (MAX)' : ''}</div>
        <button class="buy-btn ${canBuy ? 'affordable' : ''}" ${maxed || !canBuy ? 'disabled' : ''}>${maxed ? 'MAX' : cost + ' 💎'}</button>
      `;
      if (!maxed) {
        card.querySelector('button').addEventListener('click', () => {
          if (g.prestige.buyUpgrade(key)) this._renderPrestige();
        });
      }
      this.el.prestigeUpgrades.appendChild(card);
    }
  }

  _renderQuests() {
    const g = this.game;
    this.el.questList.innerHTML = '';
    for (const q of g.quests.list) {
      const item = document.createElement('div');
      item.className = 'quest-item' + (q.done ? ' done' : '');
      const pct = Math.min(100, (q.progress / q.amount) * 100);
      item.innerHTML = `
        <div class="quest-item-text">${q.text}</div>
        <div class="quest-progress-bar"><div class="quest-progress-fill" style="width:${pct}%"></div></div>
        ${q.done ? '<button class="quest-claim-btn">Claim +' + q.reward + '</button>' : ''}
      `;
      if (q.done) {
        item.querySelector('.quest-claim-btn').addEventListener('click', () => g.quests.claim(q.id));
      }
      this.el.questList.appendChild(item);
    }
  }

  // ---------- public refresh API used by systems ----------
  refreshZones() { this._renderZones(); }
  refreshTycoon() { this._renderMachines(); this._renderTycoonUpgrades(); }
  refreshQuests() { this._renderQuests(); }
  refreshPrestige() { this._renderPrestige(); }
  refreshAll() {
    this._renderCharUpgrades();
    this._renderMachines();
    this._renderTycoonUpgrades();
    this._renderZones();
    this._renderPrestige();
    this._renderQuests();
    this._applyPlayerGrowth();
  }

  _applyPlayerGrowth() {
    const g = this.game;
    const lifetimeFactor = Math.log10(Math.max(10, g.save.data.lifetimeGoo)) - 1;
    const rebirthFactor = g.save.data.rebirths * 0.15;
    const scale = 1 + Math.max(0, lifetimeFactor) * 0.28 + rebirthFactor;
    const glow = Math.min(1, (g.save.data.charUpgrades.multiplier || 0) / 40 + g.save.data.rebirths * 0.1);
    g.player.setGrowth(Math.min(4.5, scale), glow, g.save.data.rebirths > 0);
  }

  pulseCurrency(which) {
    const pill = which === 'goo' ? this.el.gooPill : this.el.crystalPill;
    pill.classList.remove('pulse');
    void pill.offsetWidth;
    pill.classList.add('pulse');
  }

  setPadPrompt(pad) {
    if (!pad) {
      this.el.padPrompt.classList.add('hidden');
      return;
    }
    const g = this.game;
    const canBuy = g.tycoon.canBuy(pad.machine);
    const cost = g.tycoon.cost(pad.machine);
    this.el.padPromptText.innerHTML = canBuy
      ? `Press <kbd>E</kbd> to buy ${pad.machine.name} — ${formatNumber(cost)} Goo`
      : `${pad.machine.name} — need ${formatNumber(cost)} Goo`;
    this.el.padPrompt.classList.remove('hidden');
  }

  setGoldenActive(active, duration) {
    this.el.goldenBanner.classList.toggle('hidden', !active);
    if (active) {
      const start = performance.now();
      const tick = () => {
        if (!this.game.economy.goldenActive) return;
        const elapsed = (performance.now() - start) / 1000;
        const pct = Math.max(0, 100 - (elapsed / duration) * 100);
        this.el.goldenBarFill.style.width = pct + '%';
        if (pct > 0) requestAnimationFrame(tick);
        else this.el.goldenBanner.classList.add('hidden');
      };
      tick();
    }
  }

  showCombo(stacks) {
    if (stacks < 2) {
      this.el.comboIndicator.classList.add('hidden');
      return;
    }
    this.el.comboIndicator.classList.remove('hidden');
    this.el.comboText.textContent = `COMBO x${stacks}`;
    this.el.comboIndicator.style.animation = 'none';
    void this.el.comboIndicator.offsetWidth;
    this.el.comboIndicator.style.animation = '';
    clearTimeout(this._comboHideTimer);
    this._comboHideTimer = setTimeout(() => this.el.comboIndicator.classList.add('hidden'), 1400);
  }

  notify(text, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = text;
    this.el.toastStack.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  spawnFloatingText(worldPos, text, opts) {
    this.floatingText.spawn(worldPos, text, opts);
  }

  celebrate() {
    // brief confetti-style burst using floating emoji particles in DOM
    for (let i = 0; i < 16; i++) {
      const el = document.createElement('div');
      el.textContent = ['🎉', '✨', '💚', '⭐'][i % 4];
      el.style.position = 'absolute';
      el.style.left = 50 + (Math.random() - 0.5) * 40 + '%';
      el.style.top = '40%';
      el.style.fontSize = 20 + Math.random() * 14 + 'px';
      el.style.pointerEvents = 'none';
      el.style.transition = 'transform 1.2s ease, opacity 1.2s ease';
      this.el.floatingLayer.appendChild(el);
      requestAnimationFrame(() => {
        el.style.transform = `translate(${(Math.random() - 0.5) * 300}px, ${200 + Math.random() * 200}px) rotate(${(Math.random() - 0.5) * 360}deg)`;
        el.style.opacity = '0';
      });
      setTimeout(() => el.remove(), 1300);
    }
  }

  playRebirthCinematic(crystalGain) {
    this.el.rebirthText.textContent = `🌀 METAMORPHOSIS! 🌀\n+${crystalGain} Crystals`;
    this.el.rebirthText.style.whiteSpace = 'pre-line';
    this.el.rebirthCinematic.classList.remove('hidden');
    setTimeout(() => this.el.rebirthCinematic.classList.add('hidden'), 1800);
  }

  _updateTutorial() {
    const g = this.game;
    let step = g.save.data.tutorialStep || 0;
    if (step >= TUTORIAL_STEPS.length) {
      this.el.tutorialBox.classList.add('hidden');
      return;
    }
    const current = TUTORIAL_STEPS[step];
    this.el.tutorialText.textContent = current.text;
    this.el.tutorialBox.classList.remove('hidden');

    if (step + 1 < TUTORIAL_STEPS.length && TUTORIAL_STEPS[step + 1].cond(g)) {
      g.save.data.tutorialStep = step + 1;
    }
  }

  update(dt) {
    const g = this.game;
    // animated counters
    this._displayedGoo += (g.save.data.goo - this._displayedGoo) * Math.min(1, dt * 10);
    if (Math.abs(this._displayedGoo - g.save.data.goo) < 0.5) this._displayedGoo = g.save.data.goo;
    this.el.gooValue.textContent = formatNumber(this._displayedGoo);
    this.el.gooRate.textContent = '+' + formatRate(g.economy.passiveIncomePerSecond());

    this._displayedCrystal += (g.save.data.crystals - this._displayedCrystal) * Math.min(1, dt * 10);
    this.el.crystalValue.textContent = formatNumber(Math.floor(this._displayedCrystal));

    this.el.zoneName.textContent = ZONES.find((z) => z.id === g.zones.currentZoneId)?.name || '';

    this.showCombo(g.economy.comboStacks);

    this.floatingText.update(dt, window.innerWidth, window.innerHeight);

    if (this._tutorialTimer === undefined) this._tutorialTimer = 0;
    this._tutorialTimer += dt;
    if (this._tutorialTimer > 0.4) {
      this._tutorialTimer = 0;
      this._updateTutorial();
    }

    // periodic refresh of buy-affordability without full rebuild cost: cheap full rerenders are fine at low freq
    this._refreshTimer = (this._refreshTimer || 0) + dt;
    if (this._refreshTimer > 0.5) {
      this._refreshTimer = 0;
      if (this.activeTab === 'character') this._renderCharUpgrades();
      if (this.activeTab === 'tycoon') this._renderTycoonUpgrades();
      if (this.activeTab === 'zones') this._renderZones();
      if (this.activeTab === 'prestige') this._renderPrestige();
    }
  }
}

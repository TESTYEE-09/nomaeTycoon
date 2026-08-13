import { CHAR_UPGRADES, TYCOON_UPGRADES, MACHINES, ZONES, PRESTIGE } from '../config/balance.js';
import { formatNumber, formatRate } from '../utils/format.js';
import { FloatingTextManager } from '../systems/Particles.js';
import { svgIcon } from './icons.js';

const TUTORIAL_STEPS = [
  { cond: () => true, text: 'Tap the goo blob — or press Space — to earn Goo.' },
  { cond: (g) => g.save.data.clickCount >= 3, text: 'Press 1 for your upgrades. Drag to look, WASD to move.' },
  { cond: (g) => (g.save.data.charUpgrades.clickPower || 0) >= 1, text: 'Press 2 and buy a Goo Extractor for passive income.' },
  { cond: (g) => (g.save.data.machines?.extractor?.count || 0) >= 1, text: 'Walk onto a machine pad and press E to build there.' },
  { cond: (g) => g.save.data.lifetimeGoo >= 800, text: 'Press 3 to unlock new zones. ? shows all controls.' },
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
    this.activeTab = null; // panels start closed — the world is the interface
    this.questsOpen = false;
    this.refreshAll();
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
      helpBtn: $('help-btn'),
      helpModal: $('help-modal'),
      closeHelpBtn: $('close-help-btn'),
      questsBtn: $('quests-btn'),
      questBadge: $('quest-badge'),
      questPanel: $('quest-panel'),
      questClose: $('quest-close'),
      tutorialClose: $('tutorial-close'),
      sensSlider: $('sens-slider'),
      invertToggle: $('invert-toggle'),
      uiRoot: $('ui-root'),
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
      rebirthBtnLabel: $('rebirth-btn-label'),
      toastStack: $('toast-stack'),
      floatingLayer: $('floating-text-layer'),
      tutorialBox: $('tutorial-box'),
      tutorialText: $('tutorial-text'),
      rebirthCinematic: $('rebirth-cinematic'),
      rebirthText: $('rebirth-text'),
      rebirthTextLine: $('rebirth-text-line'),
      settingsModal: $('settings-modal'),
      musicVol: $('music-vol'),
      sfxVol: $('sfx-vol'),
      shadowToggle: $('shadow-toggle'),
      shakeToggle: $('shake-toggle'),
      resetSaveBtn: $('reset-save-btn'),
      closeSettingsBtn: $('close-settings-btn'),
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
    this.el.sensSlider.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      g.save.data.settings.lookSens = v;
      g.input.lookSensitivity = v;
    });
    this.el.invertToggle.addEventListener('change', (e) => {
      g.save.data.settings.invertY = e.target.checked;
      g.input.invertY = e.target.checked;
    });
    this.el.rebirthBtn.addEventListener('click', () => g.prestige.doRebirth());

    this.el.helpBtn.addEventListener('click', () => this.el.helpModal.classList.toggle('hidden'));
    this.el.closeHelpBtn.addEventListener('click', () => this.el.helpModal.classList.add('hidden'));
    this.el.questsBtn.addEventListener('click', () => this.toggleQuests());
    this.el.questClose.addEventListener('click', () => this.toggleQuests(false));
    this.el.tutorialClose.addEventListener('click', () => {
      g.save.data.tutorialStep = TUTORIAL_STEPS.length;
      this.el.tutorialBox.classList.add('hidden');
    });

    for (const btn of this.el.tabBtns) {
      btn.addEventListener('click', () => this.setTab(btn.dataset.tab));
    }

    // Panels swallow their own clicks so a menu tap never also taps the world.
    for (const panel of this.el.panels) panel.addEventListener('pointerdown', (e) => e.stopPropagation());

    const TAB_KEYS = { Digit1: 'character', Digit2: 'tycoon', Digit3: 'zones', Digit4: 'prestige' };
    window.addEventListener('keydown', (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.code === 'KeyE') g.tycoon.tryBuyNear();
      else if (e.code === 'Space') g.performTap();
      else if (TAB_KEYS[e.code]) this.setTab(TAB_KEYS[e.code]);
      else if (e.code === 'KeyT') this.toggleQuests();
      else if (e.code === 'KeyH') this.el.uiRoot.classList.toggle('ui-hidden');
      else if (e.code === 'Slash' && e.shiftKey) this.el.helpModal.classList.toggle('hidden');
      else if (e.code === 'Escape') this.closeAll();
    });

    document.addEventListener('pointerdown', () => g.audio.unlock(), { once: true });
  }

  /** Tabs toggle: clicking the open tab closes the sheet and frees the screen. */
  setTab(tab) {
    this.activeTab = this.activeTab === tab ? null : tab;
    for (const btn of this.el.tabBtns) btn.classList.toggle('active', btn.dataset.tab === this.activeTab);
    for (const panel of this.el.panels) panel.classList.toggle('active', panel.dataset.panel === this.activeTab);
    if (this.activeTab) this._renderActiveTab();
    this.game.audio.uiClick();
  }

  toggleQuests(force) {
    this.questsOpen = force === undefined ? !this.questsOpen : force;
    this.el.questPanel.classList.toggle('hidden', !this.questsOpen);
    this.el.questsBtn.classList.toggle('on', this.questsOpen);
    if (this.questsOpen) this._renderQuests();
  }

  closeAll() {
    this.setTab(this.activeTab);
    this.toggleQuests(false);
    this.el.settingsModal.classList.add('hidden');
    this.el.helpModal.classList.add('hidden');
  }

  _openSettings() {
    const s = this.game.save.data.settings;
    this.el.musicVol.value = s.musicVol;
    this.el.sfxVol.value = s.sfxVol;
    this.el.shadowToggle.checked = s.shadows;
    this.el.shakeToggle.checked = s.camShake;
    this.el.sensSlider.value = s.lookSens ?? 1;
    this.el.invertToggle.checked = !!s.invertY;
    this.el.settingsModal.classList.remove('hidden');
  }

  _renderActiveTab() {
    if (this.activeTab === 'character') this._renderCharUpgrades();
    else if (this.activeTab === 'tycoon') this.refreshTycoon();
    else if (this.activeTab === 'zones') this._renderZones();
    else if (this.activeTab === 'prestige') this._renderPrestige();
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
  _upgradeCard({ icon, iconColor, name, desc, levelLabel, cost, canBuy, maxed, onBuy }) {
    const card = document.createElement('div');
    card.className = 'upgrade-card';
    const badgeStyle = iconColor ? ` style="--badge-color:${iconColor}"` : '';
    card.innerHTML = `
      <div class="upgrade-card-head">
        <span class="upgrade-icon"${badgeStyle}>${svgIcon(icon, { size: 18 })}</span>
        <span class="upgrade-name">${name}</span>
      </div>
      <div class="upgrade-desc">${desc}</div>
      <div class="upgrade-level">${levelLabel}</div>
      <button class="buy-btn ${canBuy ? 'affordable' : ''}" ${maxed || !canBuy ? 'disabled' : ''}>
        ${maxed ? 'MAX' : `${svgIcon('goo', { size: 13, className: 'buy-btn-icon' })}${formatNumber(cost)}`}
      </button>
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
        card.classList.add('locked');
        card.innerHTML = `
          <div class="upgrade-card-head"><span class="upgrade-icon upgrade-icon--locked">${svgIcon('lock', { size: 16 })}</span><span class="upgrade-name">${def.name}</span></div>
          <div class="upgrade-desc">Unlocks at ${formatNumber(def.unlockAt)} lifetime Goo</div>
          <div class="upgrade-level">Locked</div>
          <button class="buy-btn" disabled>Locked</button>`;
        this.el.machineList.appendChild(card);
        continue;
      }
      const colorHex = '#' + def.color.toString(16).padStart(6, '0');
      card.appendChild(
        this._upgradeCard({
          icon: def.icon,
          iconColor: colorHex,
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
        card.innerHTML = `${swatch}<div class="upgrade-card-head"><span class="upgrade-name">${zone.name}</span></div>
          <div class="upgrade-desc upgrade-desc--unlocked">${svgIcon('check', { size: 13 })}Unlocked</div>
          <button class="buy-btn" id="travel-${zone.id}">Travel Here</button>`;
        this.el.zoneList.appendChild(card);
        card.querySelector('button').addEventListener('click', () => this.game.travelTo(zone.id));
      } else {
        const canBuy = g.zones.canAfford(zone);
        card.innerHTML = `${swatch}<div class="upgrade-card-head"><span class="upgrade-name">${zone.name}</span></div><div class="upgrade-desc">Requires ${formatNumber(zone.cost)} Goo</div>
          <button class="buy-btn ${canBuy ? 'affordable' : ''}" ${canBuy ? '' : 'disabled'}>${svgIcon('goo', { size: 13, className: 'buy-btn-icon' })}Unlock — ${formatNumber(zone.cost)}</button>`;
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
    const crystalIcon = svgIcon('crystal', { size: 13, className: 'inline-icon' });
    this.el.prestigeInfo.innerHTML = `
      Rebirths: <b>${g.save.data.rebirths}</b><br/>
      Lifetime Goo this run: <b>${formatNumber(g.save.data.lifetimeGoo)}</b> / ${formatNumber(PRESTIGE.unlockAt)}<br/>
      Rebirthing now grants <b class="text-crystal">+${gain}${crystalIcon}Crystals</b><br/>
      Current bonus: <b class="text-goo">+${Math.round((g.economy.rebirthMultiplier() - 1) * 100)}%</b> Goo income
    `;
    this.el.rebirthBtn.disabled = !canRebirth || gain <= 0;
    this.el.rebirthBtnLabel.textContent = canRebirth ? `Rebirth for +${gain} Crystals` : `Reach ${formatNumber(PRESTIGE.unlockAt)} Lifetime Goo`;

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
        <div class="upgrade-card-head"><span class="upgrade-icon" style="--badge-color:#7dd3fc">${svgIcon(def.icon, { size: 18 })}</span><span class="upgrade-name">${def.name}</span></div>
        <div class="upgrade-desc">${def.desc}</div>
        <div class="upgrade-level">Level ${lvl}${maxed ? ' (MAX)' : ''}</div>
        <button class="buy-btn ${canBuy ? 'affordable' : ''}" ${maxed || !canBuy ? 'disabled' : ''}>${maxed ? 'MAX' : `${svgIcon('crystal', { size: 13, className: 'buy-btn-icon' })}${cost}`}</button>
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
    const claimable = g.quests.list.filter((q) => q.done).length;
    this.el.questBadge.textContent = claimable;
    this.el.questBadge.classList.toggle('hidden', claimable === 0);
    if (!this.questsOpen) return;
    this.el.questList.innerHTML = '';
    for (const q of g.quests.list) {
      const item = document.createElement('div');
      item.className = 'quest-item' + (q.done ? ' done' : '');
      const pct = Math.min(100, (q.progress / q.amount) * 100);
      item.innerHTML = `
        <div class="quest-item-text">${q.text}</div>
        <div class="quest-progress-bar"><div class="quest-progress-fill" style="width:${pct}%"></div></div>
        ${q.done ? `<button class="quest-claim-btn">${svgIcon('goo', { size: 13, className: 'buy-btn-icon' })}Claim +${q.reward}</button>` : ''}
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
      ? `<kbd>E</kbd> ${pad.machine.name} · ${formatNumber(cost)}`
      : `${pad.machine.name} · need ${formatNumber(cost)}`;
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
    this.el.comboText.textContent = `x${stacks}`;
    this.el.comboIndicator.style.animation = 'none';
    void this.el.comboIndicator.offsetWidth;
    this.el.comboIndicator.style.animation = '';
    clearTimeout(this._comboHideTimer);
    this._comboHideTimer = setTimeout(() => this.el.comboIndicator.classList.add('hidden'), 1400);
  }

  notify(text, type = 'info', icon) {
    const iconKey = icon || { success: 'check', quest: 'scroll', lucky: 'sparkle', golden: 'sparkle', info: 'crystal' }[type] || 'sparkle';
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `${svgIcon(iconKey, { size: 15, className: 'toast-icon' })}<span>${text}</span>`;
    this.el.toastStack.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  spawnFloatingText(worldPos, text, opts) {
    this.floatingText.spawn(worldPos, text, opts);
  }

  celebrate() {
    // brief confetti-style burst of small SVG icon particles
    const iconKeys = ['sparkle', 'goo', 'crystal', 'check'];
    const colors = ['#ffd54a', '#4ade80', '#7dd3fc', '#ff9ecb'];
    for (let i = 0; i < 16; i++) {
      const idx = i % 4;
      const el = document.createElement('div');
      el.className = 'confetti-icon';
      el.innerHTML = svgIcon(iconKeys[idx], { size: 18 + Math.random() * 14 });
      el.style.color = colors[idx];
      el.style.position = 'absolute';
      el.style.left = 50 + (Math.random() - 0.5) * 40 + '%';
      el.style.top = '40%';
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
    this.el.rebirthTextLine.textContent = `METAMORPHOSIS — +${crystalGain} Crystals`;
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

    // Refresh affordability only for the panel that is actually open.
    this._refreshTimer = (this._refreshTimer || 0) + dt;
    if (this._refreshTimer > 0.5) {
      this._refreshTimer = 0;
      if (this.activeTab) this._renderActiveTab();
      this._renderQuests();
    }
  }
}

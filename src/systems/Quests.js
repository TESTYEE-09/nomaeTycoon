import { QUEST_POOL } from '../config/balance.js';

const ACTIVE_COUNT = 3;

export class QuestSystem {
  constructor(game) {
    this.game = game;
    if (!game.save.data.quests || game.save.data.quests.length === 0) {
      game.save.data.quests = this._rollNew(ACTIVE_COUNT, []);
    }
  }

  get list() {
    return this.game.save.data.quests;
  }

  _rollNew(count, exclude) {
    const pool = QUEST_POOL.filter((q) => !exclude.includes(q.id));
    const picks = [];
    const used = new Set();
    while (picks.length < count && used.size < pool.length) {
      const q = pool[Math.floor(Math.random() * pool.length)];
      if (used.has(q.id)) continue;
      used.add(q.id);
      picks.push({ id: q.id, type: q.type, amount: q.amount, reward: q.reward, text: q.text(formatAmount(q.amount)), progress: 0, done: false, claimed: false });
    }
    return picks;
  }

  onProgress(type, amount) {
    let changed = false;
    for (const q of this.list) {
      if (q.done || q.type !== type) continue;
      q.progress = Math.min(q.amount, q.progress + amount);
      if (q.progress >= q.amount) {
        q.done = true;
        this.game.audio.quest();
        this.game.ui.notify(`Quest complete: ${q.text}`, 'quest');
      }
      changed = true;
    }
    if (changed) this.game.ui.refreshQuests();
  }

  claim(questId) {
    const q = this.list.find((x) => x.id === questId);
    if (!q || !q.done || q.claimed) return false;
    q.claimed = true;
    this.game.economy.addGoo(q.reward, 'quest');
    this.game.ui.notify(`+${formatAmount(q.reward)} Goo claimed!`, 'success');
    this.game.audio.coin();
    // replace with a new quest
    const idx = this.list.indexOf(q);
    const existingIds = this.list.map((x) => x.id);
    const fresh = this._rollNew(1, existingIds);
    if (fresh.length) this.list[idx] = fresh[0];
    else this.list.splice(idx, 1);
    this.game.ui.refreshQuests();
    return true;
  }
}

function formatAmount(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

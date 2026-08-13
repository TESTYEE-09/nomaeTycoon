import './style.css';
import { Game } from './core/Game.js';
import { hydrateIcons } from './ui/icons.js';

hydrateIcons();

const canvas = document.getElementById('game-canvas');
window.__oozeGame = new Game(canvas);

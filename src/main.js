import './style.css';
import { Game } from './core/Game.js';

const canvas = document.getElementById('game-canvas');
window.__oozeGame = new Game(canvas);

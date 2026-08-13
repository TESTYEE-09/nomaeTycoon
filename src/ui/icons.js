// Centralized SVG icon set — a consistent line/solid icon system used
// everywhere in the UI instead of emoji. Every icon uses `currentColor`
// so tinting is controlled purely by CSS `color`.

const S = 'stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"';

export const ICONS = {
  goo: `<path d="M12 2C12 2 5.5 10.5 5.5 15.2C5.5 18.7 8.4 21.5 12 21.5C15.6 21.5 18.5 18.7 18.5 15.2C18.5 10.5 12 2 12 2Z" fill="currentColor"/>`,

  crystal: `<path d="M12 2L19 9L12 22L5 9L12 2Z" fill="currentColor"/><path d="M5 9H19M9 9L12 2L12 22M15 9L12 2" stroke="rgba(0,0,0,0.28)" stroke-width="0.7" fill="none"/>`,

  settings: `<line x1="4" y1="7" x2="20" y2="7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="9" cy="7" r="2.1" fill="currentColor"/><line x1="4" y1="12.5" x2="20" y2="12.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="15.5" cy="12.5" r="2.1" fill="currentColor"/><line x1="4" y1="18" x2="20" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="10.5" cy="18" r="2.1" fill="currentColor"/>`,

  sparkle: `<path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z" fill="currentColor"/>`,

  scroll: `<rect x="5" y="3" width="14" height="18" rx="2.2" ${S}/><line x1="8" y1="8" x2="16" y2="8" ${S}/><line x1="8" y1="12" x2="16" y2="12" ${S}/><line x1="8" y1="16" x2="13" y2="16" ${S}/>`,

  user: `<circle cx="12" cy="8" r="3.6" ${S}/><path d="M4.5 20c0-4.1 3.4-7.4 7.5-7.4s7.5 3.3 7.5 7.4" ${S}/>`,

  factory: `<path d="M3 21V11L8 8V11L13 8V11L18 8V21" ${S}/><line x1="3" y1="21" x2="21" y2="21" ${S}/><line x1="16" y1="8" x2="16" y2="4" ${S}/><line x1="19" y1="8" x2="19" y2="5.5" ${S}/>`,

  map: `<path d="M3 6L9 4L15 6L21 4V18L15 20L9 18L3 20V6Z" ${S}/><line x1="9" y1="4" x2="9" y2="18" ${S}/><line x1="15" y1="6" x2="15" y2="20" ${S}/>`,

  crown: `<path d="M3 18L2 8L7.5 12L12 4L16.5 12L22 8L21 18H3Z" fill="currentColor"/>`,

  bolt: `<path d="M13 2L4 14H11L9 22L20 9H13L13 2Z" fill="currentColor"/>`,

  lock: `<rect x="5.5" y="11" width="13" height="9.5" rx="2" ${S}/><path d="M8 11V7.5A4 4 0 0 1 16 7.5V11" ${S}/>`,

  check: `<polyline points="4,13 9,18 20,6" stroke="currentColor" stroke-width="2.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,

  chevronsRight: `<polyline points="5,5 11,12 5,19" ${S}/><polyline points="13,5 19,12 13,19" ${S}/>`,

  flask: `<path d="M9.5 3H14.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M10.5 3V8.5L4.8 17.5A2 2 0 0 0 6.5 20.5H17.5A2 2 0 0 0 19.2 17.5L13.5 8.5V3" ${S}/><line x1="7.5" y1="15" x2="16.5" y2="15" stroke="currentColor" stroke-width="1.8"/>`,

  fuelPump: `<rect x="4" y="5" width="9" height="16" rx="1.5" ${S}/><line x1="4" y1="10" x2="13" y2="10" stroke="currentColor" stroke-width="1.8"/><path d="M13 9H16A2 2 0 0 1 18 11V16.5A1.5 1.5 0 0 0 21 16.5V8L18 5" ${S}/>`,

  shuffleX: `<line x1="4" y1="5" x2="20" y2="19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="20" y1="5" x2="4" y2="19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><polyline points="15,5 20,5 20,10" ${S}/><polyline points="9,19 4,19 4,14" ${S}/>`,

  volcano: `<path d="M3 20L9 6L12 12L15 6L21 20H3Z" fill="currentColor"/><path d="M12 4V2M9 4L8 2M15 4L16 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`,

  atom: `<circle cx="12" cy="12" r="1.8" fill="currentColor"/><ellipse cx="12" cy="12" rx="9" ry="3.8" stroke="currentColor" stroke-width="1.4" fill="none"/><ellipse cx="12" cy="12" rx="9" ry="3.8" stroke="currentColor" stroke-width="1.4" fill="none" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.8" stroke="currentColor" stroke-width="1.4" fill="none" transform="rotate(120 12 12)"/>`,

  gauge: `<path d="M4 17A8 8 0 0 1 20 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/><line x1="12" y1="17" x2="15.5" y2="12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="17" r="1.4" fill="currentColor"/>`,

  wrench: `<path d="M14.7 6.3a4 4 0 1 1-5.4 5.4L4.6 16.4l3 3L12.3 14.7a4 4 0 1 1 5.4-5.4l-3-3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" fill="none"/>`,

  clock: `<circle cx="12" cy="12" r="9" ${S}/><line x1="12" y1="12" x2="12" y2="7" ${S}/><line x1="12" y1="12" x2="15.5" y2="13.5" ${S}/>`,

  rocket: `<path d="M12 2C15 4 17 8 17 12C17 14 16.3 15.8 15.3 17L14 21L12 19L10 21L8.7 17C7.7 15.8 7 14 7 12C7 8 9 4 12 2Z" fill="currentColor"/><circle cx="12" cy="10.5" r="1.8" fill="#0b0620"/>`,

  cycle: `<path d="M20 12A8 8 0 1 1 17.5 6.2" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/><polyline points="20,4 20,9 15,9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
};

export function svgIcon(name, { size = 20, className = '' } = {}) {
  const body = ICONS[name] || ICONS.sparkle;
  return `<svg class="icon${className ? ' ' + className : ''}" width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}

export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    const name = el.getAttribute('data-icon');
    const size = parseInt(el.getAttribute('data-icon-size') || '20', 10);
    el.innerHTML = svgIcon(name, { size });
  });
}

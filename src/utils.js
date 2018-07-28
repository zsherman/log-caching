import random from 'random-words';

export const makeLog = ({ min = 5, max = 40 } = {}) => ({
  context: {
    platform: {
      heroku: {
        source: 'app',
        dyno_type: 'web',
        dyno_id: Math.floor(Math.random(0) * 6),
      }
    }
  },
  dt: new Date().toISOString(),
  id: random(4).join(''),
  inserted_at: new Date().toISOString(),
  level: ['warn', 'info', 'debug'][Math.floor(Math.random() * 3)],
  message: random({ min, max }).join(' '),
  version: Math.floor(Math.random() * 11),
  isPlaceholder: false,
})

export const makePlaceholder = () => ({
  message: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  isPlaceholder: true,
})

export const makeString = length => {
  return new Array(length + 1).join('x');
}

export function debounce(func, wait, immediate) {
  let timeout;
  return function (...rest) {
    const context = this;
    const args = rest;

    const later = () => {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };

    const callNow = immediate && !timeout;

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);

    if (callNow) func.apply(context, args);
  };
}

export function getTextWidth(text, font) {
  // re-use canvas object for better performance
  var canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement("canvas"));
  var context = canvas.getContext("2d");
  context.font = font;
  var metrics = context.measureText(text);
  return metrics.width;
}

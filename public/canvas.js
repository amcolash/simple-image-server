const markerSize = 4;
const eraserSize = 9;

const width = 600;
const height = width;

let lastX = -1;
let lastY = -1;
let lastTime = 0;
let lastType;
let lastPressure = 1;

let points = [];
let lastColor;

let color = 'black';

function init() {
  const canvas = document.querySelector('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = width;
  canvas.height = height;

  canvas.addEventListener('pointermove', (e) => {
    if (!e.isPrimary) return;
    if (e.pointerType !== lastType && Date.now() - lastTime < 1000) return;

    lastTime = Date.now();
    lastType = e.pointerType;

    const pressure = Number.parseFloat(Math.min(1.5, Math.max(0.5, e.pressure * 3)).toFixed(2));

    const cursor = document.querySelector('#cursor');
    cursor.style.visibility = 'visible';

    if (color === 'transparent') {
      const scaledSize = eraserSize * pressure * 1.5;
      cursor.style.transform = `translate(${e.clientX - 0.5 * scaledSize}px, ${e.clientY - 0.5 * scaledSize}px)`;

      cursor.style.width = scaledSize + 'px';
      cursor.style.height = scaledSize + 'px';
    } else {
      const scaledSize = markerSize * pressure;
      cursor.style.transform = `translate(${e.clientX - 0.5 * scaledSize}px, ${e.clientY - 0.5 * scaledSize}px)`;

      cursor.style.width = scaledSize + 'px';
      cursor.style.height = scaledSize + 'px';
    }

    if (e.buttons === 1) {
      if (lastX !== -1 && lastY !== -1) {
        let point = [lastX, lastY, pressure];
        if (lastColor !== color || points.length === 0) point.push(color);
        lastColor = color;

        points.push(point);

        ctx.strokeStyle = color;
        ctx.beginPath();

        if (color !== 'transparent') {
          ctx.lineWidth = markerSize * pressure;
          ctx.lineCap = 'round';

          ctx.globalCompositeOperation = 'source-over';

          ctx.moveTo(lastX, lastY);
          ctx.lineTo(e.offsetX, e.offsetY);
          ctx.stroke();
        } else {
          ctx.globalCompositeOperation = 'destination-out';

          const steps = 10;
          for (let i = 0; i < steps; i++) {
            const x = lerp(lastX, e.offsetX, i / steps);
            const y = lerp(lastY, e.offsetY, i / steps);

            ctx.arc(x, y, eraserSize * pressure, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      lastX = e.offsetX;
      lastY = e.offsetY;
    } else if (e.buttons === 0) {
      if (lastX !== -1 && lastY !== -1) {
        points.push([lastX, lastY, lastPressure]);
        points.push([]);
      }

      lastX = -1;
      lastY = -1;
    }

    updateStats();

    lastPressure = pressure;
    ctx.globalCompositeOperation = 'source-over';
  });

  canvas.addEventListener('pointerleave', (e) => {
    if (lastX !== -1 && lastY !== -1) {
      points.push([lastX, lastY, lastPressure]);
      points.push([]);
    }

    lastX = -1;
    lastY = -1;

    updateStats();

    const cursor = document.querySelector('#cursor');
    cursor.style.visibility = 'hidden';
  });

  const clearButton = document.querySelector('#clear');
  clearButton.addEventListener('click', () => clear(true));

  const redrawButton = document.querySelector('#redraw');
  redrawButton.addEventListener('click', redraw);

  const palette = document.querySelector('#palette');
  const colors = ['black', 'red', 'orange', 'yellow', 'lime', 'green', 'blue', 'indigo', 'purple', 'transparent'];
  const size = 28.1;

  colors.forEach((c, i) => {
    const swatch = document.createElement('div');

    swatch.className = 'swatch';
    swatch.addEventListener('click', (e) => updateColor(c));

    swatch.style.border = '1px solid black';
    swatch.style.background = c;
    swatch.style.width = size + 'px';
    swatch.style.height = size + 'px';
    swatch.style.margin = size / 5 + 'px';

    if (i === 0) swatch.style.marginLeft = 0;

    palette.appendChild(swatch);
  });

  updateColor('black');
}

function redraw() {
  clear(false);

  const canvas = document.querySelector('canvas');
  const ctx = canvas.getContext('2d');

  let currentColor;

  points.forEach((point) => {
    if (point.length > 0) {
      if (point.length === 4) currentColor = point[3];
      const pressure = point[2];

      if (lastX === -1) lastX = point[0];
      if (lastY === -1) lastY = point[1];

      ctx.strokeStyle = currentColor;
      ctx.beginPath();

      if (currentColor !== 'transparent') {
        ctx.lineWidth = markerSize * pressure;
        ctx.lineCap = 'round';

        ctx.globalCompositeOperation = 'source-over';

        ctx.moveTo(lastX, lastY);
        ctx.lineTo(point[0], point[1]);
        ctx.stroke();
      } else {
        ctx.globalCompositeOperation = 'destination-out';

        const steps = 10;
        for (let i = 0; i < steps; i++) {
          const x = lerp(lastX, point[0], i / steps);
          const y = lerp(lastY, point[1], i / steps);

          ctx.arc(x, y, eraserSize * pressure, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      lastX = point[0];
      lastY = point[1];
    } else {
      lastX = -1;
      lastY = -1;
    }
  });
}

function updateColor(newColor) {
  color = newColor;

  const colors = document.querySelectorAll('.swatch');
  Array.from(colors).forEach((c) => {
    if (c.style.background === newColor) c.style.outline = 'solid 3px #777';
    else c.style.outline = 'none';
  });
}

function updateStats() {
  const stats = document.querySelector('#stats');

  let raw = JSON.stringify(points);
  let compressed = LZString.compress(raw);

  stats.innerHTML = `Raw: ${raw.length}<br/>Compressed: ${compressed.length}<br/>Ratio: ${(raw.length / compressed.length).toFixed(3)}`;
}

function clear(resetPoints) {
  const canvas = document.querySelector('canvas');
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, width, height);

  if (resetPoints) points = [];

  updateStats();
}

function lerp(v0, v1, t) {
  return v0 * (1 - t) + v1 * t;
}

window.onload = init;

const markerSize = 4;
const eraserSize = 9;

const width = 600;
const height = width;

let lastX = -1;
let lastY = -1;
let wasPen = false;

let color = 'black';

function init() {
  const canvas = document.querySelector('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = width;
  canvas.height = height;

  canvas.addEventListener('pointermove', (e) => {
    const cursor = document.querySelector('#cursor');
    cursor.style.visibility = 'visible';

    console.log(e.pointerId, e.pointerType);

    if (e.pointerType === 'pen') wasPen = true;

    if (color === 'transparent') {
      const scaledSize = eraserSize * 1.5;
      cursor.style.transform = `translate(${e.clientX - 0.5 * scaledSize}px, ${e.clientY - 0.5 * scaledSize}px)`;

      cursor.style.width = scaledSize + 'px';
      cursor.style.height = scaledSize + 'px';
    } else {
      cursor.style.transform = `translate(${e.clientX - 0.5 * markerSize}px, ${e.clientY - 0.5 * markerSize}px)`;

      cursor.style.width = markerSize + 'px';
      cursor.style.height = markerSize + 'px';
    }

    if (e.buttons === 1) {
      if (lastX !== -1 && lastY !== -1) {
        ctx.strokeStyle = color;
        ctx.lineWidth = markerSize;

        ctx.beginPath();

        if (color !== 'transparent') {
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

            ctx.arc(x, y, eraserSize, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      lastX = e.offsetX;
      lastY = e.offsetY;
    } else if (e.buttons === 0) {
      lastX = -1;
      lastY = -1;
    }

    ctx.globalCompositeOperation = 'source-over';
  });

  canvas.addEventListener('pointerleave', (e) => {
    lastX = -1;
    lastY = -1;

    const cursor = document.querySelector('#cursor');
    cursor.style.visibility = 'hidden';
  });

  const clearButton = document.querySelector('#clear');
  clearButton.addEventListener('click', clear);

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

function updateColor(newColor) {
  color = newColor;

  const colors = document.querySelectorAll('.swatch');
  Array.from(colors).forEach((c) => {
    if (c.style.background === newColor) c.style.outline = 'solid 3px #777';
    else c.style.outline = 'none';
  });
}

function clear() {
  const canvas = document.querySelector('canvas');
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, width, height);
}

function lerp(v0, v1, t) {
  return v0 * (1 - t) + v1 * t;
}

window.onload = init;

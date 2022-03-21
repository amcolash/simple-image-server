// Base tool sizes in px, these are scaled for server images
const markerSize = 4.5;
const eraserSize = 9;

const width = 500;
const height = width;
let examplePage;

let drawMode;

const colors = ['#444444', '#ff6663', '#feb144', '#fdfd97', '#9ee09e', '#9ec1cf', '#cc99c9', '#eeeeee', 'transparent'];
const defaultColor = colors[4];

let lastX = -1;
let lastY = -1;
let lastTime = 0;
let lastType;
let lastPressure = 1;

let points = [];
let backupPoints = [];
let history = [];
let lastColor;

let color = defaultColor;

function initCanvas(canvasEl) {
  examplePage = typeof currentImages === 'undefined';

  const canvas = canvasEl || document.querySelector('canvas');
  const ctx = canvas.getContext('2d');

  if (!canvasEl) {
    canvas.width = width;
    canvas.height = height;
  }

  canvas.addEventListener('pointermove', (e) => {
    if (!e.isPrimary || !drawMode) return;
    if (e.pointerType !== lastType && Date.now() - lastTime < 1000) return;

    lastTime = Date.now();
    lastType = e.pointerType;

    let pressure = 1;
    if (e.pointerType === 'pen' && currentImages) {
      // Reduce the ballon-tail effect on drawing
      let newPressure = Number.parseFloat(Math.min(1, Math.max(0.45, e.pressure * 3)).toFixed(2));

      // Set tool sizes based on img width
      const img = currentImages[currentIndex];
      const ratio = Math.min(Math.max(0.5, img.dimensions.width / 1920), 1.5);
      const sizeScalar = ratio * 2;

      // Add scalar from pen size slider
      const inputEl = document.querySelector('#sizeSlider');
      const inputScale = Number.parseInt(inputEl.value) * 0.5;

      // Combine all of the value together
      newPressure *= sizeScalar * inputScale;

      pressure = 0.25 * newPressure + 0.75 * lastPressure;
    }

    let canvasXRatio = 1;
    let canvasYRatio = 1;
    if (!examplePage) {
      const canvasSize = canvas.getBoundingClientRect();
      const img = currentImages[currentIndex];

      canvasXRatio = img.dimensions.width / canvasSize.width;
      canvasYRatio = img.dimensions.height / canvasSize.height;
    }
    let avgRatio = (canvasXRatio + canvasYRatio) / 2;

    const cursor = document.querySelector('#cursor');
    cursor.style.visibility = 'visible';

    if (color === 'transparent') {
      const scaledSize = eraserSize * pressure * 1.8 * (1 / avgRatio);
      cursor.style.transform = `translate(${e.pageX - 0.5 * scaledSize}px, ${e.pageY - 0.5 * scaledSize}px)`;

      cursor.style.width = scaledSize + 'px';
      cursor.style.height = scaledSize + 'px';
      cursor.style.outlineColor = 'black';
    } else {
      const scaledSize = markerSize * pressure * (1 / avgRatio);
      cursor.style.transform = `translate(${e.pageX - 0.5 * scaledSize}px, ${e.pageY - 0.5 * scaledSize}px)`;

      cursor.style.width = scaledSize + 'px';
      cursor.style.height = scaledSize + 'px';
      cursor.style.outlineColor = color;
    }

    const canvasX = Math.floor(e.offsetX * canvasXRatio);
    const canvasY = Math.floor(e.offsetY * canvasYRatio);

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
          ctx.lineTo(canvasX, canvasY);
          ctx.stroke();
        } else {
          ctx.globalCompositeOperation = 'destination-out';

          const steps = 10;
          for (let i = 0; i < steps; i++) {
            const x = lerp(lastX, canvasX, i / steps);
            const y = lerp(lastY, canvasY, i / steps);

            ctx.arc(x, y, eraserSize * pressure, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      lastX = canvasX;
      lastY = canvasY;
    } else if (e.buttons === 0) {
      if (lastX !== -1 && lastY !== -1) {
        points.push([lastX, lastY, lastPressure]);
        points.push([]);
        addHistory();
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
      addHistory();
    }

    lastX = -1;
    lastY = -1;

    updateStats();

    const cursor = document.querySelector('#cursor');
    cursor.style.visibility = 'hidden';
    cursor.style.transform = `translate(0, 0)`;
  });

  const redrawButton = document.querySelector('#redraw');
  if (redrawButton) redrawButton.addEventListener('click', () => draw);

  createPalette(canvas);
  color = localStorage.getItem('drawing-color') || defaultColor;
}

function addHistory() {
  history.push(JSON.parse(JSON.stringify(points)));
  if (history.length > 30) history = history.slice(history.length - 30);

  updateButtons();
}

function createPalette(canvasEl) {
  const palette = document.querySelector('#palette');
  const size = 28.1;

  palette.replaceChildren();
  colors.forEach((c, i) => {
    const swatch = document.createElement('div');

    swatch.className = 'swatch';
    swatch.addEventListener('click', (e) => updateColor(c));

    swatch.style.border = '1px solid black';
    swatch.style.borderRadius = '2px';
    swatch.style.background = c;
    swatch.style.width = size + 'px';
    swatch.style.height = size + 'px';
    swatch.style.margin = `${size / 5}px min(${size / 5}px, 1vw)`;
    swatch.style.position = 'relative';
    swatch.style.overflow = 'hidden';

    if (i === 0) swatch.style.marginLeft = 0;

    if (c === 'transparent') {
      const line = document.createElement('div');
      line.style.border = '1px solid red';
      line.style.transform = 'rotateZ(-45deg)';
      line.style.position = 'absolute';
      line.style.left = size * -0.23 + 'px';
      line.style.top = size * 0.46 + 'px';
      line.style.width = size * 1.4 + 'px';

      swatch.appendChild(line);
    }

    palette.appendChild(swatch);
  });

  addSpacer(palette, size);

  const undoButton = createButton('undoButton', 'img/rotate-ccw.svg', size, () => undo(canvasEl));
  palette.appendChild(undoButton);

  const resetButton = createButton('resetButton', 'img/trash-2.svg', size, () => {
    if (confirm('Are you sure you want to clear the drawing?')) clear(true, canvasEl);
  });
  palette.appendChild(resetButton);

  const revertButton = createButton('revertButton', 'img/clipboard.svg', size, () => {
    if (confirm('Are you sure you want to revert the drawing?')) revert(canvasEl);
  });
  palette.appendChild(revertButton);

  addSpacer(palette, size);

  const closeButton = createButton('closeButton', 'img/save.svg', size, () => toggleDrawing(false));
  palette.appendChild(closeButton);
}

function addSpacer(parent, size) {
  const spacer = document.createElement('div');
  spacer.style.borderLeft = '1px solid #777';
  spacer.style.margin = '4px 6px 4px 8px';
  spacer.style.height = `${size / 1.15}px`;
  parent.appendChild(spacer);
}

function createButton(className, iconSrc, size, cb) {
  const button = document.createElement('button');
  button.className = className;
  button.style.background = 'none';
  button.style.border = 'none';

  button.addEventListener('click', cb);

  const icon = document.createElement('img');
  icon.src = iconSrc;
  icon.style.width = size + 'px';
  icon.style.height = size + 'px';

  SVGInject(icon);
  button.appendChild(icon);

  return button;
}

function draw(canvasEl, pointString) {
  clear(false, canvasEl);

  const canvas = canvasEl || document.querySelector('canvas');
  const ctx = canvas.getContext('2d');

  let currentColor;

  let allPoints = points || [];
  try {
    if (pointString) allPoints = JSON.parse(LZString.decompressFromUTF16(pointString)) || [];
  } catch (err) {
    console.error(err);
  }

  (allPoints || []).forEach((point) => {
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

function undo(canvasEl) {
  if (history.length > 0) {
    history.pop();

    if (history.length > 0) {
      points = history[history.length - 1] || [];
      draw(canvasEl);
    } else {
      clear(true, canvasEl);
    }

    updateButtons();
  }
}

function setEnabled(button, enabled) {
  if (enabled) {
    button.style.opacity = 'unset';
    button.disabled = false;
  } else {
    button.style.opacity = 0.5;
    button.disabled = true;
  }
}

function updateButtons() {
  const undoButton = document.querySelector('.undoButton');
  if (undoButton) setEnabled(undoButton, history.length > 0);

  const revertButton = document.querySelector('.revertButton');
  if (revertButton) setEnabled(revertButton, backupPoints.length > 0);
}

function updateColor(newColor) {
  color = newColor;

  const colors = document.querySelectorAll('.swatch');

  Array.from(colors).forEach((c) => {
    if (
      c.style.background.indexOf('rgb') === -1
        ? c.style.background.toLowerCase() === newColor.toLowerCase()
        : '#' + rgbHex(c.style.background).toLowerCase() === newColor.toLowerCase()
    )
      c.style.outline = 'solid 3px #777';
    else c.style.outline = 'none';
  });

  localStorage.setItem('drawing-color', color);
}

function updateStats() {
  const stats = document.querySelector('#stats');
  if (stats) {
    let raw = JSON.stringify(points);
    let compressed = LZString.compress(raw);
    stats.innerHTML = `Raw: ${raw.length}, Compressed: ${compressed.length}, Ratio: ${(raw.length / compressed.length).toFixed(2)}`;
  }
}

function clear(resetPoints, canvasEl) {
  const canvas = canvasEl || document.querySelector('canvas');
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (resetPoints) {
    points = [];
    history = [];
  }

  updateButtons();
  updateStats();
}

function revert(canvasEl) {
  points = backupPoints || [];
  draw(canvasEl);
  updateButtons();
}

function lerp(v0, v1, t) {
  return v0 * (1 - t) + v1 * t;
}

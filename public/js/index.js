const server = window.location.origin;
const refreshTime = 1 * 60 * 1000;

let currentDir = '.';
let currentImages = [];
let currentDirs = [];
let currentIndex = -1;

let updateTimer;
let uiTimer;

let wakeLock;

function init() {
  updateImages();

  const params = new URLSearchParams(window.location.search);
  currentDir = params.get('currentDir') || '.';
  selectDir(currentDir);

  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'Escape':
        hideModal();
        hideFolderModal();
        break;
      case 'Enter':
        const folderName = document.querySelector('.folderModal .newFolder .folderName');
        if (document.activeElement === folderName && folderName.value.length > 0) createFolder();
        break;
      case 'ArrowRight':
        next();
        break;
      case 'ArrowLeft':
        previous();
        break;
      default:
        break;
    }
  });

  window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    currentDir = params.get('currentDir') || '.';
    selectDir(currentDir, true);
  });

  document.addEventListener('visibilitychange', () => {
    if (wakeLock && document.visibilityState === 'visible') acquireWakelock();
  });

  const modalImage = document.querySelector('.modal .image');
  modalImage.addEventListener('swiped-right', previous);
  modalImage.addEventListener('swiped-left', next);

  const modalImageContainer = document.querySelector('.modal .imageContainer');
  const canvas = document.querySelector('.mainCanvas');

  canvas.addEventListener('swiped-right', () => {
    if (!drawMode) previous();
  });
  canvas.addEventListener('swiped-left', () => {
    if (!drawMode) next();
  });

  const modal = document.querySelector('.modal');
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target === modalImage || e.target === modalImageContainer || (e.target === canvas && !drawMode)) {
      if (uiTimer) hideUI();
      else showUI();
    }
  });

  initCanvas(canvas);

  const pager = document.querySelector('.pager');
  pager.addEventListener('scroll', showUI);
}

function updateImages() {
  clearTimeout(updateTimer);
  updateTimer = setTimeout(updateImages, refreshTime);

  handleData(fetch(`${server}/imageList`), parseImages);
}

function parseImages(res) {
  const selected = getSelected();

  const root = document.querySelector('.root');
  root.replaceChildren();

  const pager = document.querySelector('.pager');
  pager.replaceChildren();

  const folders = document.querySelector('.folderModal .folders');
  folders.replaceChildren();

  const dirs = new Set();
  const images = [];

  // console.log(res);

  res.files.forEach((f) => {
    Object.entries(f).forEach((e) => {
      if (typeof e[1] === 'string') f[e[0]] = e[1].replace(/\\/g, '/');
    });

    if (f.dir === currentDir) {
      images.push(f);
    } else if (
      ((currentDir === '.' && f.dir.split('/').length === 1) ||
        (f.dir.startsWith(currentDir) && f.dir.replace(currentDir, '').split('/').length === 2)) &&
      f.dir !== '.'
    ) {
      dirs.add(f.dir);
    } else if (currentDir === '.' && f.dir.split('/').length > 1) {
      dirs.add(f.dir.split('/')[0]);
    }
  });

  currentImages = images;
  currentDirs = Array.from(dirs);

  if (currentDir !== '.') {
    const sections = currentDir.split('/');
    if (sections.length == 1) createDir('.', '../');
    else {
      sections.pop();
      createDir(sections.join('/'), '../');
    }
  }

  Array.from(dirs)
    .sort((a, b) => a.localeCompare(b))
    .forEach((d) => {
      createDir(d, d.replace(currentDir + '/', ''));
    });

  images
    .sort((a, b) => new Date(a.created) - new Date(b.created))
    .forEach((img, i) => {
      createImage(img, i);
    });

  const checked = Array.from(document.querySelectorAll('.root .card input[type="checkbox"]'));
  checked.forEach((c, i) => {
    if (selected.indexOf(i) !== -1) c.checked = true;
  });

  // Toggle write mode class based on if the server supports it or not
  const realRoot = document.querySelector('.realRoot');
  realRoot.classList.toggle('write', res.write);

  if (currentIndex !== -1) {
    const img = currentImages[currentIndex];
    const mainCanvas = document.querySelector('.mainCanvas');

    if (img.drawing) {
      points = JSON.parse(LZString.decompressFromUTF16(img.drawing));
      draw(mainCanvas);
    }
  }

  updateCheckboxes();
}

function createImage(img, i) {
  const div = document.createElement('div');
  div.className = 'card';
  div.onclick = (e) => {
    if (e.target.type !== 'checkbox') {
      currentIndex = i;
      showModal();
    } else {
      updateCheckboxes();
    }
  };

  const imgEl = document.createElement('img');
  div.appendChild(imgEl);
  imgEl.src = img.thumb;

  if (img.drawing) {
    const canvasEl = document.createElement('canvas');
    canvasEl.width = img.dimensions.width;
    canvasEl.height = img.dimensions.height;
    div.appendChild(canvasEl);

    draw(canvasEl, img.drawing);
  }

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  div.appendChild(checkbox);

  const root = document.querySelector('.root');
  root.appendChild(div);

  const pager = document.querySelector('.pager');

  const pagerWrapper = document.createElement('div');
  pagerWrapper.className = 'pagerWrapper';

  const pagerImg = document.createElement('img');
  pagerImg.src = img.thumb;
  pagerImg.onclick = () => {
    currentIndex = i;
    showModal();
  };

  if (img.drawing) {
    const canvasEl = document.createElement('canvas');
    canvasEl.width = img.dimensions.width;
    canvasEl.height = img.dimensions.height;
    pagerWrapper.appendChild(canvasEl);

    draw(canvasEl, img.drawing);
  }

  pagerWrapper.appendChild(pagerImg);
  pager.appendChild(pagerWrapper);
}

function createDir(d, label) {
  const div = document.createElement('div');
  div.className = 'card';

  const img = document.createElement('img');
  img.src = 'img/folder.svg';
  img.style = 'stroke-width: 1';
  div.appendChild(img);
  div.onclick = () => selectDir(d);

  const dir = document.createElement('div');
  dir.innerText = label || d;
  div.appendChild(dir);

  const root = document.querySelector('.root');
  root.appendChild(div);

  SVGInject(img);

  const dirItem = document.createElement('div');

  const img2 = document.createElement('img');
  img2.src = 'img/folder.svg';
  dirItem.appendChild(img2);

  const labelEl = document.createElement('span');
  labelEl.innerText = label;

  dirItem.appendChild(labelEl);
  dirItem.className = 'dir';
  dirItem.onclick = () => moveSelected(d);

  const folders = document.querySelector('.folderModal .folders');
  folders.appendChild(dirItem);

  SVGInject(img2);
}

function showModal() {
  acquireWakelock();

  const img = currentImages[currentIndex];

  const modal = document.querySelector('.modal');
  modal.style.opacity = '1';
  modal.style.pointerEvents = 'unset';

  const modalImage = document.querySelector('.modal .image');
  modalImage.src = '';
  modalImage.src = modalImage.src = img.file;

  const mainCanvas = document.querySelector('.mainCanvas');

  mainCanvas.width = img.dimensions.width;
  mainCanvas.height = img.dimensions.height;

  if (img.drawing) {
    points = JSON.parse(LZString.decompressFromUTF16(img.drawing));
    draw(mainCanvas);
  }

  document.body.style.overflow = 'hidden';

  Array.from(document.querySelectorAll('.modal .pager .pagerWrapper')).forEach((e, i) => {
    if (i === currentIndex) {
      e.style.outline = '3px solid white';
      e.scrollIntoView({ behavior: 'smooth' });
    } else e.style.outlineColor = 'unset';
  });

  modalImage.onload = () => {
    const prev = mod(currentIndex - 1, currentImages.length);
    const next = mod(currentIndex + 1, currentImages.length);

    const prevImg = document.querySelector('.prevImage');
    const nextImg = document.querySelector('.nextImage');

    prevImg.src = img.file;
    nextImg.src = img.file;
  };

  showUI();
}

function hideModal() {
  releaseWakelock();

  const modal = document.querySelector('.modal');
  modal.style.opacity = '0';
  modal.style.pointerEvents = 'none';

  document.body.style.overflow = 'unset';

  toggleDrawing(false);
  points = [];

  currentIndex = -1;
  updateCheckboxes();
}

function showUI() {
  if (uiTimer) clearTimeout(uiTimer);
  uiTimer = setTimeout(hideUI, 5000);

  Array.from(document.querySelectorAll('.ui')).forEach((e) => e.classList.toggle('hidden', false));
}

function hideUI() {
  if (uiTimer) clearTimeout(uiTimer);
  uiTimer = undefined;
  Array.from(document.querySelectorAll('.ui')).forEach((e) => e.classList.toggle('hidden', true));
}

function showFolderModal() {
  const modal = document.querySelector('.folderModal');
  modal.style.opacity = '1';
  modal.style.pointerEvents = 'unset';

  document.body.style.overflow = 'hidden';

  const folderName = document.querySelector('.folderModal .newFolder .folderName');
  folderName.value = '';
}

function hideFolderModal() {
  const modal = document.querySelector('.folderModal');
  modal.style.opacity = '0';
  modal.style.pointerEvents = 'none';

  document.body.style.overflow = 'unset';
}

function toggleDrawing(value) {
  let prevMode = drawMode || false;

  if (value !== undefined) drawMode = value;
  else drawMode = !drawMode;

  if (drawMode) hideUI();
  else showUI();

  // const uiEls = document.querySelectorAll('.pager, .right, .left');
  // Array.from(uiEls).forEach((e) => (e.style.display = drawMode ? 'none' : 'unset'));

  const paletteEl = document.querySelector('.modal .paletteContainer');
  paletteEl.style.opacity = drawMode ? 1 : 0;

  const mainCanvas = document.querySelector('.mainCanvas');
  mainCanvas.style.cursor = drawMode ? 'none' : 'unset';
  mainCanvas.style.touchAction = drawMode ? 'none' : 'unset';

  if (!drawMode && prevMode !== drawMode && points) postDrawing();
}

function postDrawing() {
  const raw = JSON.stringify(points);
  const compressed = LZString.compressToUTF16(raw);
  const img = currentImages[currentIndex];

  if (img) {
    fetch(`${server}/drawing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: img.rel,
        data: points.length > 0 ? compressed : undefined,
      }),
    })
      .then(() => {
        updateImages();
      })
      .catch((err) => console.error(err));
  }
}

// function rotateImage() {
//   const img = currentImages[currentIndex];
//   handleData(
//     fetch(`${server}/rotate`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({ path: img.rel }),
//     }),
//     (data) => {
//       parseImages(data);
//       showModal();
//     }
//   );
// }

function removeImage() {
  if (confirm('Are you sure you want to delete this file?')) {
    const img = currentImages[currentIndex];
    handleData(
      fetch(`${server}/image`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paths: [img.rel] }),
      }),
      (data) => {
        parseImages(data);

        currentIndex = mod(currentIndex - 1, currentImages.length);
        showModal();
      }
    );
  }
}

function deleteSelected() {
  const selected = getSelected();

  if (confirm(`Are you sure you want to delete ${selected.length} file${selected.length > 1 ? 's' : ''}?`)) {
    unselect();

    handleData(
      fetch(`${server}/image`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paths: selected.map((s) => currentImages[s].rel) }),
      }),
      parseImages
    );
  }
}

function createFolder() {
  const folderName = document.querySelector('.folderModal .newFolder .folderName');

  if (folderName.value.length > 0) {
    const newFolder = currentDir + '/' + folderName.value;
    moveSelected(newFolder);
  }
}

function moveSelected(destination) {
  const selected = getSelected();

  if (confirm(`Are you sure you want to move ${selected.length} file${selected.length > 1 ? 's' : ''}?`)) {
    unselect();

    handleData(
      fetch(`${server}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paths: selected.map((s) => currentImages[s].rel), destination }),
      }),
      parseImages
    );
  }

  hideFolderModal();
}

function capture(focusNew) {
  const captureButton = document.querySelector('.capture');
  captureButton.style.background = '#eee';
  captureButton.style.color = '#aaa';
  captureButton.style.cursor = 'unset';
  captureButton.disabled = true;

  handleData(
    fetch(`${server}/capture`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentDir }) }),
    (data) => {
      captureButton.style.background = '';
      captureButton.style.color = '';
      captureButton.style.cursor = '';
      captureButton.disabled = false;

      parseImages(data);

      if (focusNew) {
        currentIndex = currentImages.length - 1;
        showModal();
      }
    }
  );
}

function unselect() {
  const checked = Array.from(document.querySelectorAll('.root .card input[type="checkbox"]:checked'));
  checked.forEach((c) => {
    c.checked = false;
  });

  updateCheckboxes();
}

function updateCheckboxes() {
  const checked = Array.from(document.querySelectorAll('.root .card input[type="checkbox"]:checked'));

  const selectionButtons = document.querySelector('.bottomButtons .selection');
  selectionButtons.style.display = checked.length > 0 ? 'flex' : 'none';

  const simpleButtons = document.querySelector('.bottomButtons .simple');
  simpleButtons.style.display = checked.length > 0 ? 'none' : 'flex';
}

function getSelected() {
  const checkboxes = Array.from(document.querySelectorAll('.root .card input[type="checkbox"]'));
  const selected = [];

  checkboxes.forEach((c, i) => {
    if (c.checked) selected.push(i);
  });

  return selected;
}

function selectDir(d, ignoreHistory) {
  currentDir = d;
  if (!ignoreHistory) window.history.pushState({ currentDir: d }, d, `?currentDir=${d}`);
  updateImages();

  hideFolderModal();
  hideModal();
}

function previous(e) {
  if (drawMode) return;

  const modal = document.querySelector('.modal');
  if (modal.style.opacity !== '1') return;

  if (e) e.stopPropagation();
  currentIndex = mod(currentIndex - 1, currentImages.length);
  showModal();
}

function next(e) {
  if (drawMode) return;

  const modal = document.querySelector('.modal');
  if (modal.style.opacity !== '1') return;

  if (e) e.stopPropagation();
  currentIndex = mod(currentIndex + 1, currentImages.length);
  showModal();
}

function handleData(promise, handler) {
  promise
    .then((response) => {
      if (response.status === 200 && response.body) {
        return response.json();
      }
      throw 'Server Error';
    })
    .then(handler)
    .catch((err) => console.error(err));
}

// From https://stackoverflow.com/a/17323608/2303432
function mod(n, m) {
  return ((n % m) + m) % m;
}

function acquireWakelock() {
  releaseWakelock();

  try {
    navigator.wakeLock
      .request('screen')
      .then((lock) => (wakeLock = lock))
      .catch((err) => console.error(err));
  } catch (err) {
    console.error(err);
  }
}

function releaseWakelock() {
  try {
    if (wakeLock) {
      wakeLock.release();
      wakeLock = undefined;
    }
  } catch (err) {
    console.error(err);
  }
}

// On load, start things up
window.onload = init;

const server = window.location.origin;
const refreshTime = 2 * 60 * 1000;

let currentDir = '.';
let currentImages = [];
let currentDirs = [];
let currentIndex = 0;

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

  const modal = document.querySelector('.modal');
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target === modalImage || e.target === modalImageContainer) {
      if (uiTimer) hideUI();
      else showUI();
    }
  });

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

  console.log(res);

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

  const canvasEl = document.createElement('canvas');
  canvasEl.width = img.dimensions.width;
  canvasEl.height = img.dimensions.height;
  div.appendChild(canvasEl);

  if (img.drawing) {
    draw(canvasEl, img.drawing);
  }

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  div.appendChild(checkbox);

  const root = document.querySelector('.root');
  root.appendChild(div);

  const pager = document.querySelector('.pager');

  const pagerImg = document.createElement('img');
  pagerImg.src = img.thumb;
  pagerImg.onclick = () => {
    currentIndex = i;
    showModal();
  };

  pager.appendChild(pagerImg);
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
  const ctx = mainCanvas.getContext('2d');
  ctx.clearRect(0, 0, 4000, 4000);

  if (img.drawing) {
    mainCanvas.width = img.dimensions.width;
    mainCanvas.height = img.dimensions.height;

    points = JSON.parse(LZString.decompressFromUTF16(img.drawing));

    draw(mainCanvas);
  }

  document.body.style.overflow = 'hidden';

  Array.from(document.querySelectorAll('.modal .pager img')).forEach((e, i) => {
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

function toggleDrawing() {
  if (uiTimer) clearTimeout(uiTimer);
  Array.from(document.querySelectorAll('.ui')).forEach((e) => e.classList.toggle('hidden', false));

  const points = [
    [38, 325, 1.5, 'black'],
    [59, 320, 1.5],
    [113, 305, 1.5],
    [182, 283, 1.5],
    [222, 269, 1.5],
    [255, 258, 1.5],
    [287, 247, 1.5],
    [318, 237, 1.5],
    [345, 228, 1.5],
    [366, 222, 1.5],
    [386, 218, 1.5],
    [399, 216, 1.5],
    [410, 215, 1.5],
    [419, 215, 1.5],
    [428, 215, 1.5],
    [435, 216, 1.5],
    [441, 217, 1.5],
    [446, 218, 1.5],
    [448, 220, 1.5],
    [451, 222, 1.5],
    [456, 225, 1.5],
    [459, 227, 1.5],
    [461, 229, 1.5],
    [462, 231, 1.5],
    [463, 232, 1.5],
    [464, 234, 1.5],
    [464, 239, 1.5],
    [464, 246, 1.5],
    [464, 257, 1.5],
    [459, 274, 1.5],
    [447, 303, 1.5],
    [433, 330, 1.5],
    [421, 348, 1.5],
    [410, 366, 1.5],
    [401, 383, 1.5],
    [394, 395, 1.5],
    [389, 404, 1.5],
    [386, 410, 1.5],
    [384, 413, 1.5],
    [384, 413, 1.5],
    [383, 414, 1.5],
    [382, 419, 1.5],
    [380, 423, 1.5],
    [379, 426, 1.5],
    [379, 428, 1.5],
    [378, 429, 1.5],
    [378, 429, 1.5],
    [378, 430, 1.5],
    [379, 432, 1.5],
    [380, 434, 1.5],
    [381, 436, 1.5],
    [384, 438, 1.5],
    [387, 439, 1.5],
    [391, 440, 1.5],
    [398, 441, 1.5],
    [410, 441, 1.5],
    [423, 441, 1.5],
    [443, 440, 1.5],
    [448, 439, 1.5],
    [449, 439, 1.5],
    [450, 439, 1.5],
    [454, 438, 1.5],
    [457, 437, 1.5],
    [458, 436, 1.5],
    [],
    [97, 538, 1.5, 'red'],
    [101, 528, 1.5],
    [106, 518, 1.5],
    [110, 507, 1.5],
    [115, 495, 1.5],
    [120, 486, 1.5],
    [124, 480, 1.5],
    [127, 474, 1.5],
    [130, 469, 1.5],
    [133, 464, 1.5],
    [137, 458, 1.5],
    [140, 452, 1.5],
    [145, 446, 1.5],
    [149, 438, 1.5],
    [154, 429, 1.5],
    [161, 418, 1.5],
    [167, 407, 1.5],
    [176, 393, 1.5],
    [185, 380, 1.5],
    [194, 368, 1.5],
    [204, 355, 1.5],
    [213, 342, 1.5],
    [222, 330, 1.5],
    [231, 320, 1.5],
    [240, 310, 1.5],
    [248, 300, 1.5],
    [256, 291, 1.5],
    [262, 283, 1.5],
    [267, 277, 1.5],
    [271, 273, 1.5],
    [273, 270, 1.5],
    [274, 269, 1.5],
    [275, 267, 1.5],
    [276, 266, 1.5],
    [278, 264, 1.5],
    [280, 262, 1.5],
    [282, 260, 1.5],
    [287, 256, 1.5],
    [296, 248, 1.5],
    [306, 240, 1.5],
    [322, 228, 1.5],
    [338, 216, 1.5],
    [347, 210, 1.5],
    [353, 206, 1.5],
    [359, 202, 1.5],
    [364, 199, 1.5],
    [369, 196, 1.5],
    [375, 194, 1.5],
    [380, 193, 1.5],
    [386, 192, 1.5],
    [392, 191, 1.5],
    [399, 191, 1.5],
    [406, 191, 1.5],
    [413, 191, 1.5],
    [421, 192, 1.5],
    [429, 194, 1.5],
    [437, 196, 1.5],
    [445, 199, 1.5],
    [452, 202, 1.5],
    [459, 207, 1.5],
    [464, 211, 1.5],
    [468, 215, 1.5],
    [471, 220, 1.5],
    [474, 224, 1.5],
    [476, 227, 1.5],
    [477, 231, 1.5],
    [477, 235, 1.5],
    [477, 238, 1.5],
    [477, 242, 1.5],
    [475, 248, 1.5],
    [472, 256, 1.5],
    [465, 270, 1.5],
    [449, 292, 1.5],
    [429, 314, 1.5],
    [414, 328, 1.5],
    [401, 341, 1.5],
    [387, 351, 1.5],
    [372, 360, 1.5],
    [358, 368, 1.5],
    [343, 374, 1.5],
    [328, 381, 1.5],
    [312, 387, 1.5],
    [298, 393, 1.5],
    [285, 397, 1.5],
    [274, 400, 1.5],
    [265, 402, 1.5],
    [256, 403, 1.5],
    [249, 405, 1.5],
    [242, 405, 1.5],
    [235, 406, 1.5],
    [228, 407, 1.5],
    [223, 407, 1.5],
    [217, 407, 1.5],
    [210, 406, 1.5],
    [205, 405, 1.5],
    [201, 403, 1.5],
    [198, 401, 1.5],
    [196, 399, 1.5],
    [195, 397, 1.5],
    [193, 394, 1.5],
    [192, 389, 1.5],
    [191, 382, 1.5],
    [192, 374, 1.5],
    [194, 361, 1.5],
    [202, 338, 1.5],
    [219, 307, 1.5],
    [238, 279, 1.5],
    [257, 251, 1.5],
    [282, 222, 1.5],
    [310, 193, 1.5],
    [337, 167, 1.5],
    [365, 143, 1.5],
    [393, 123, 1.5],
    [415, 105, 1.5],
    [432, 93, 1.5],
    [444, 84, 1.5],
    [454, 79, 1.5],
    [462, 77, 1.5],
    [469, 75, 1.5],
    [475, 75, 1.5],
    [480, 75, 1.5],
    [485, 76, 1.5],
    [490, 77, 1.5],
    [494, 78, 1.5],
    [499, 81, 1.5],
    [503, 83, 1.5],
    [509, 86, 1.5],
    [514, 90, 1.5],
    [518, 93, 1.5],
    [521, 97, 1.5],
    [524, 100, 1.5],
    [526, 102, 1.5],
    [526, 105, 1.5],
    [526, 107, 1.5],
    [526, 108, 1.5],
    [526, 110, 1.5],
    [524, 113, 1.5],
    [521, 118, 1.5],
    [513, 130, 1.5],
    [493, 152, 1.5],
    [457, 187, 1.5],
    [425, 210, 1.5],
    [395, 230, 1.5],
    [371, 247, 1.5],
    [346, 262, 1.5],
    [326, 271, 1.5],
    [313, 276, 1.5],
    [303, 279, 1.5],
    [294, 282, 1.5],
    [285, 285, 1.5],
    [278, 288, 1.5],
    [272, 289, 1.5],
    [267, 291, 1.5],
    [267, 291, 1.5],
    [266, 291, 1.5],
    [268, 291, 1.5],
    [272, 292, 1.5],
    [280, 293, 1.5],
    [293, 296, 1.5],
    [314, 302, 1.5],
    [351, 316, 1.5],
    [377, 328, 1.5],
    [389, 334, 1.5],
    [401, 342, 1.5],
    [410, 348, 1.5],
    [418, 354, 1.5],
    [425, 360, 1.5],
    [432, 366, 1.5],
    [437, 371, 1.5],
    [442, 376, 1.5],
    [450, 385, 1.5],
    [454, 391, 1.5],
    [458, 396, 1.5],
    [460, 401, 1.5],
    [462, 404, 1.5],
    [462, 406, 1.5],
    [462, 406, 1.5],
    [462, 407, 1.5],
    [462, 407, 1.5],
    [462, 408, 1.5],
    [462, 408, 1.5],
    [461, 408, 1.5],
    [461, 409, 1.5],
    [],
    [492, 414, 1.5, 'green'],
    [471, 413, 1.5],
    [436, 411, 1.5],
    [411, 407, 1.5],
    [393, 404, 1.5],
    [375, 401, 1.5],
    [360, 397, 1.5],
    [342, 392, 1.5],
    [325, 387, 1.5],
    [309, 381, 1.5],
    [293, 375, 1.5],
    [277, 369, 1.5],
    [263, 361, 1.5],
    [249, 353, 1.5],
    [236, 345, 1.5],
    [205, 322, 1.5],
    [198, 314, 1.5],
    [193, 307, 1.5],
    [188, 299, 1.5],
    [184, 293, 1.5],
    [181, 287, 1.5],
    [178, 282, 1.5],
    [176, 277, 1.5],
    [175, 272, 1.5],
    [173, 266, 1.5],
    [172, 260, 1.5],
    [172, 254, 1.5],
    [172, 248, 1.5],
    [172, 242, 1.5],
    [173, 238, 1.5],
    [173, 233, 1.5],
    [174, 229, 1.5],
    [174, 226, 1.5],
    [175, 222, 1.5],
    [177, 218, 1.5],
    [179, 214, 1.5],
    [181, 211, 1.5],
    [185, 207, 1.5],
    [189, 203, 1.5],
    [192, 200, 1.5],
    [194, 199, 1.5],
    [196, 197, 1.5],
    [204, 194, 1.5],
    [211, 190, 1.5],
    [218, 188, 1.5],
    [229, 185, 1.5],
    [243, 183, 1.5],
    [265, 182, 1.5],
    [288, 182, 1.5],
    [303, 182, 1.5],
    [316, 182, 1.5],
    [330, 182, 1.5],
    [343, 184, 1.5],
    [354, 186, 1.5],
    [364, 187, 1.5],
    [374, 189, 1.5],
    [385, 192, 1.5],
    [395, 196, 1.5],
    [404, 200, 1.5],
    [412, 204, 1.5],
    [420, 209, 1.5],
    [427, 215, 1.5],
    [434, 220, 1.5],
    [441, 225, 1.5],
    [448, 231, 1.5],
    [453, 236, 1.5],
    [458, 242, 1.5],
    [464, 249, 1.5],
    [469, 256, 1.5],
    [474, 263, 1.5],
    [477, 268, 1.5],
    [480, 273, 1.5],
    [481, 276, 1.5],
    [482, 277, 1.5],
    [482, 278, 1.5],
    [482, 279, 1.5],
    [482, 280, 1.5],
    [481, 281, 1.5],
    [481, 282, 1.5],
    [480, 283, 1.5],
    [478, 285, 1.5],
    [475, 287, 1.5],
    [468, 291, 1.5],
    [450, 299, 1.5],
    [403, 313, 1.5],
    [347, 324, 1.5],
    [316, 326, 1.5],
    [291, 326, 1.5],
    [266, 326, 1.5],
    [243, 324, 1.5],
    [225, 322, 1.5],
    [211, 321, 1.5],
    [199, 320, 1.5],
    [187, 319, 1.5],
    [177, 319, 1.5],
    [168, 319, 1.5],
    [159, 319, 1.5],
    [151, 319, 1.5],
    [142, 320, 1.5],
    [135, 321, 1.5],
    [127, 323, 1.5],
    [121, 324, 1.5],
    [117, 325, 1.5],
    [113, 327, 1.5],
    [109, 328, 1.5],
    [107, 330, 1.5],
    [105, 331, 1.5],
    [104, 332, 1.5],
    [104, 333, 1.5],
    [104, 334, 1.5],
    [104, 335, 1.5],
    [103, 337, 1.5],
    [100, 341, 1.5],
    [97, 348, 1.5],
    [93, 356, 1.5],
    [88, 365, 1.5],
    [84, 376, 1.5],
    [81, 385, 1.5],
    [78, 397, 1.5],
    [77, 406, 1.5],
    [77, 412, 1.5],
    [77, 417, 1.5],
    [78, 421, 1.5],
    [79, 426, 1.5],
    [82, 431, 1.5],
    [84, 437, 1.5],
    [87, 442, 1.5],
    [90, 448, 1.5],
    [93, 454, 1.5],
    [98, 462, 1.5],
    [102, 468, 1.5],
    [107, 473, 1.5],
    [112, 478, 1.5],
    [116, 482, 1.5],
    [121, 485, 1.5],
    [130, 490, 1.5],
    [136, 492, 1.5],
    [142, 494, 1.5],
    [148, 496, 1.5],
    [156, 498, 1.5],
    [163, 499, 1.5],
    [169, 499, 1.5],
    [177, 500, 1.5],
    [184, 500, 1.5],
    [194, 500, 1.5],
    [202, 499, 1.5],
    [214, 497, 1.5],
    [224, 495, 1.5],
    [234, 491, 1.5],
    [245, 487, 1.5],
    [254, 482, 1.5],
    [262, 476, 1.5],
    [276, 464, 1.5],
    [284, 455, 1.5],
    [290, 447, 1.5],
    [296, 437, 1.5],
    [301, 427, 1.5],
    [305, 416, 1.5],
    [308, 403, 1.5],
    [311, 390, 1.5],
    [314, 377, 1.5],
    [316, 364, 1.5],
    [320, 349, 1.5],
    [323, 333, 1.5],
    [325, 317, 1.5],
    [327, 301, 1.5],
    [328, 285, 1.5],
    [329, 270, 1.5],
    [328, 258, 1.5],
    [327, 248, 1.5],
    [325, 237, 1.5],
    [323, 227, 1.5],
    [320, 217, 1.5],
    [315, 206, 1.5],
    [310, 196, 1.5],
    [306, 185, 1.5],
    [301, 175, 1.5],
    [295, 157, 1.5],
    [],
    [509, 387, 1.5, 'blue'],
    [495, 387, 1.5],
    [473, 385, 1.5],
    [445, 380, 1.5],
    [422, 377, 1.5],
    [405, 374, 1.5],
    [388, 371, 1.5],
    [369, 367, 1.5],
    [349, 363, 1.5],
    [329, 359, 1.5],
    [309, 354, 1.5],
    [290, 348, 1.5],
    [270, 342, 1.5],
    [252, 337, 1.5],
    [237, 332, 1.5],
    [224, 328, 1.5],
    [212, 322, 1.5],
    [203, 317, 1.5],
    [195, 311, 1.5],
    [190, 306, 1.5],
    [185, 299, 1.5],
    [180, 292, 1.5],
    [176, 283, 1.5],
    [174, 273, 1.5],
    [173, 261, 1.5],
    [173, 248, 1.5],
    [173, 233, 1.5],
    [176, 217, 1.5],
    [178, 205, 1.5],
    [180, 194, 1.5],
    [183, 183, 1.5],
    [188, 172, 1.5],
    [192, 162, 1.5],
    [197, 153, 1.5],
    [203, 143, 1.5],
    [211, 134, 1.5],
    [218, 125, 1.5],
    [224, 118, 1.5],
    [230, 111, 1.5],
    [235, 105, 1.5],
    [240, 100, 1.5],
    [247, 92, 1.5],
    [252, 88, 1.5],
    [253, 87, 1.5],
    [254, 87, 1.5],
    [254, 87, 1.5],
    [261, 83, 1.5],
    [270, 79, 1.5],
    [278, 76, 1.5],
    [286, 74, 1.5],
    [296, 73, 1.5],
    [307, 73, 1.5],
    [318, 73, 1.5],
    [326, 73, 1.5],
    [333, 73, 1.5],
    [339, 73, 1.5],
    [344, 74, 1.5],
    [349, 74, 1.5],
    [353, 75, 1.5],
    [358, 76, 1.5],
    [362, 78, 1.5],
    [367, 80, 1.5],
    [377, 88, 1.5],
    [383, 95, 1.5],
    [388, 104, 1.5],
    [392, 112, 1.5],
    [396, 122, 1.5],
    [397, 130, 1.5],
    [398, 136, 1.5],
    [398, 140, 1.5],
    [397, 144, 1.5],
    [397, 148, 1.5],
    [396, 153, 1.5],
    [394, 159, 1.5],
    [388, 173, 1.5],
    [384, 182, 1.5],
    [377, 197, 1.5],
    [368, 211, 1.5],
    [358, 224, 1.5],
    [348, 234, 1.5],
    [339, 243, 1.5],
    [329, 252, 1.5],
    [320, 260, 1.5],
    [309, 267, 1.5],
    [299, 274, 1.5],
    [290, 278, 1.5],
    [281, 282, 1.5],
    [272, 286, 1.5],
    [263, 289, 1.5],
    [254, 292, 1.5],
    [245, 295, 1.5],
    [237, 297, 1.5],
    [230, 300, 1.5],
    [223, 302, 1.5],
    [216, 304, 1.5],
    [209, 306, 1.5],
    [202, 308, 1.5],
    [195, 311, 1.5],
    [190, 313, 1.5],
    [184, 315, 1.5],
    [179, 317, 1.5],
    [173, 319, 1.5],
    [169, 321, 1.5],
    [165, 323, 1.5],
    [162, 324, 1.5],
    [161, 324, 1.5],
    [161, 325, 1.5],
    [161, 325, 1.5],
    [161, 326, 1.5],
    [160, 326, 1.5],
    [159, 327, 1.5],
    [159, 328, 1.5],
    [159, 329, 1.5],
    [160, 332, 1.5],
    [161, 338, 1.5],
    [161, 347, 1.5],
    [161, 359, 1.5],
    [162, 375, 1.5],
    [163, 388, 1.5],
    [164, 396, 1.5],
    [166, 403, 1.5],
    [168, 408, 1.5],
    [169, 411, 1.5],
    [171, 414, 1.5],
    [173, 417, 1.5],
    [175, 420, 1.5],
    [178, 422, 1.5],
    [181, 426, 1.5],
    [184, 429, 1.5],
    [188, 433, 1.5],
    [191, 437, 1.5],
    [195, 441, 1.5],
    [198, 445, 1.5],
    [202, 449, 1.5],
    [205, 452, 1.5],
    [209, 455, 1.5],
    [213, 459, 1.5],
    [218, 462, 1.5],
    [223, 465, 1.5],
    [229, 469, 1.5],
    [235, 473, 1.5],
    [242, 476, 1.5],
    [252, 480, 1.5],
    [264, 484, 1.5],
    [276, 488, 1.5],
    [289, 491, 1.5],
    [304, 494, 1.5],
    [316, 496, 1.5],
    [328, 498, 1.5],
    [339, 499, 1.5],
    [349, 500, 1.5],
    [360, 501, 1.5],
    [370, 501, 1.5],
    [379, 501, 1.5],
    [386, 500, 1.5],
    [392, 498, 1.5],
    [397, 496, 1.5],
    [400, 495, 1.5],
    [402, 494, 1.5],
    [403, 493, 1.5],
    [404, 492, 1.5],
    [404, 491, 1.5],
    [404, 490, 1.5],
    [404, 487, 1.5],
    [406, 482, 1.5],
    [408, 475, 1.5],
    [411, 466, 1.5],
    [414, 453, 1.5],
    [421, 430, 1.5],
    [430, 399, 1.5],
    [435, 382, 1.5],
    [439, 366, 1.5],
    [441, 349, 1.5],
    [443, 335, 1.5],
    [443, 324, 1.5],
    [443, 311, 1.5],
    [442, 298, 1.5],
    [440, 288, 1.5],
    [437, 280, 1.5],
    [433, 272, 1.5],
    [428, 263, 1.5],
    [421, 254, 1.5],
    [414, 246, 1.5],
    [406, 238, 1.5],
    [398, 230, 1.5],
    [390, 223, 1.5],
    [380, 214, 1.5],
    [367, 206, 1.5],
    [355, 198, 1.5],
    [333, 188, 1.5],
    [321, 183, 1.5],
    [297, 177, 1.5],
    [287, 175, 1.5],
    [278, 174, 1.5],
    [269, 172, 1.5],
    [260, 171, 1.5],
    [251, 169, 1.5],
    [244, 168, 1.5],
    [238, 168, 1.5],
    [231, 166, 1.5],
    [225, 165, 1.5],
    [219, 164, 1.5],
    [213, 163, 1.5],
    [207, 161, 1.5],
    [201, 159, 1.5],
    [196, 158, 1.5],
    [192, 157, 1.5],
    [188, 156, 1.5],
    [183, 154, 1.5],
    [180, 153, 1.5],
    [176, 153, 1.5],
    [174, 152, 1.5],
    [172, 151, 1.5],
    [171, 150, 1.5],
    [170, 150, 1.5],
    [170, 150, 1.5],
    [169, 149, 1.5],
    [],
  ];

  const raw = JSON.stringify(points);
  const compressed = LZString.compressToUTF16(raw);

  const img = currentImages[currentIndex];
  fetch(`${server}/drawing`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path: img.rel,
      data: compressed,
    }),
  })
    .then(() => {
      const mainCanvas = document.querySelector('.mainCanvas');
      draw(mainCanvas, compressed);
    })
    .catch((err) => console.error(err));
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
  const modal = document.querySelector('.modal');
  if (modal.style.opacity !== '1') return;

  if (e) e.stopPropagation();
  currentIndex = mod(currentIndex - 1, currentImages.length);
  showModal();
}

function next(e) {
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

const server = window.location.origin;
let currentDir = '.';
let currentImages = [];
let currentIndex = 0;

let updateTimer;
let uiTimer;

function init() {
  updateImages();

  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'Escape':
        hideModal();
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

  const modalImage = document.querySelector('.modal .image');
  modalImage.addEventListener('swiped-right', previous);
  modalImage.addEventListener('swiped-left', next);

  const modal = document.querySelector('.modal');
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target === modalImage) {
      if (uiTimer) hideUI();
      else showUI();
    }
  });
}

function updateImages() {
  clearTimeout(updateTimer);
  updateTimer = setTimeout(updateImages, 2 * 60 * 1000);

  const modal = document.querySelector('.modal');

  if (modal.style.opacity !== '1') {
    fetch(`${server}/imageList`)
      .then((response) => response.json())
      .then(parseImages);
  }
}

function parseImages(res) {
  const root = document.querySelector('.root');
  root.replaceChildren();

  const dirs = new Set();
  const images = [];

  res.forEach((f) => {
    if (f.dir === currentDir) {
      images.push(f);
    } else if (
      ((currentDir === '.' && f.dir.split('/').length === 1) ||
        (f.dir.startsWith(currentDir) && f.dir.replace(currentDir, '').split('/').length === 2)) &&
      f.dir !== '.'
    ) {
      dirs.add(f.dir);
    }
  });

  currentImages = images;

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
  div.appendChild(img);
  div.onclick = () => selectDir(d);

  const dir = document.createElement('div');
  dir.innerText = label || d;
  div.appendChild(dir);

  const root = document.querySelector('.root');
  root.appendChild(div);

  SVGInject(img);
}

function showModal() {
  const modal = document.querySelector('.modal');
  modal.style.opacity = '1';
  modal.style.pointerEvents = 'unset';

  const modalImage = document.querySelector('.modal .image');
  modalImage.src = '';
  modalImage.src = modalImage.src = currentImages[currentIndex].file;

  document.body.style.overflow = 'hidden';

  Array.from(document.querySelectorAll('.modal .pager img')).forEach((e, i) => {
    if (i === currentIndex) {
      e.style.outline = '3px solid white';
      e.scrollIntoView({ behavior: 'smooth' });
    } else e.style.outlineColor = 'unset';
  });

  showUI();
}

function hideModal() {
  const modal = document.querySelector('.modal');
  modal.style.opacity = '0';
  modal.style.pointerEvents = 'none';

  document.body.style.overflow = 'unset';
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

function removeImage() {
  if (confirm('Are you sure you want to delete this file?')) {
    hideModal();

    const img = currentImages[currentIndex];
    fetch(`${server}/image?path=${img.rel}`, { method: 'DELETE' })
      .then((response) => response.json())
      .then(parseImages);
  }
}

function capture() {
  const captureButton = document.querySelector('.capture');
  captureButton.style.background = '#eee';
  captureButton.style.color = '#aaa';
  captureButton.style.cursor = 'unset';
  captureButton.disabled = true;

  fetch(`${server}/capture`, { method: 'POST' })
    .then((response) => response.json())
    .then((data) => {
      captureButton.style.background = '';
      captureButton.style.color = '';
      captureButton.style.cursor = '';
      captureButton.disabled = false;

      parseImages(data);
    });
}

function updateCheckboxes() {
  const checked = Array.from(document.querySelectorAll('.root .card input[type="checkbox"]:checked'));
  const deleteButton = document.querySelector('.bottomButtons .delete');

  deleteButton.style.display = checked.length > 0 ? 'flex' : 'none';
}

function selectDir(d) {
  currentDir = d;
  updateImages();
}

function previous(e) {
  if (e) e.stopPropagation();
  currentIndex = mod(currentIndex - 1, currentImages.length);
  showModal();
}

function next(e) {
  if (e) e.stopPropagation();
  currentIndex = mod(currentIndex + 1, currentImages.length);
  showModal();
}

// From https://stackoverflow.com/a/17323608/2303432
function mod(n, m) {
  return ((n % m) + m) % m;
}

window.onload = init;

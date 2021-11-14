const server = window.location.origin;
let currentDir = '.';
let currentImages = [];
let currentIndex = 0;

let timer;

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

  const modal = document.querySelector('.modal');
  modal.addEventListener('click', (e) => {
    if (e.target === modal) hideModal();
  });

  const close = document.querySelector('.close');
  close.addEventListener('click', hideModal);

  const left = document.querySelector('.left');
  left.addEventListener('click', previous);

  const right = document.querySelector('.right');
  right.addEventListener('click', next);
}

function updateImages() {
  clearInterval(timer);
  timer = setInterval(updateImages, 2 * 60 * 1000);

  const modal = document.querySelector('.modal');

  if (modal.style.opacity !== '1') {
    fetch(`${server}/imageList`)
      .then((response) => response.json())
      .then((res) => {
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
          .sort((a, b) => a.file.localeCompare(b.file))
          .forEach((img, i) => {
            createImage(img, i);
          });
      });
  }
}

function createImage(img, i) {
  const div = document.createElement('div');
  div.className = 'card';
  div.onclick = () => {
    currentIndex = i;
    showModal();
  };

  const imgEl = document.createElement('img');
  div.appendChild(imgEl);
  imgEl.src = img.thumb;

  const root = document.querySelector('.root');
  root.appendChild(div);
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
}

function hideModal() {
  const modal = document.querySelector('.modal');
  modal.style.opacity = '0';
  modal.style.pointerEvents = 'none';

  document.body.style.overflow = 'unset';
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

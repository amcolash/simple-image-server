const server = window.location.origin;
let currentDir = '.';

let timer;

function init() {
  updateImages();

  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'Escape':
        hideModal();
        break;
      default:
        break;
    }
  });

  const modal = document.querySelector('.modal');
  modal.addEventListener('click', hideModal);
}

function updateImages() {
  clearInterval(timer);
  timer = setInterval(updateImages, 2 * 60 * 1000);

  const modal = document.querySelector('.modal');

  if (modal.style.opacity !== '1') {
    const root = document.querySelector('.root');
    root.replaceChildren();

    fetch(`${server}/imageList`)
      .then((response) => response.json())
      .then((res) => {
        const dirs = new Set();
        const images = [];

        res.forEach((f) => {
          if (f.dir === currentDir) {
            images.push(f);
          } else if (currentDir === '.') {
            dirs.add(f.dir);
          }
        });

        if (currentDir !== '.') {
          createDir('.');
        }

        Array.from(dirs)
          .sort()
          .forEach((d) => {
            createDir(d);
          });

        images.forEach((i) => {
          createImage(i);
        });
      });
  }
}

function createImage(i) {
  const div = document.createElement('div');
  div.className = 'card';
  div.onclick = () => showModal(i.file);

  const img = document.createElement('img');
  div.appendChild(img);
  img.src = i.thumb;

  const root = document.querySelector('.root');
  root.appendChild(div);
}

function createDir(d) {
  const div = document.createElement('div');
  div.className = 'card';

  const img = document.createElement('img');
  img.src = 'folder.svg';
  div.appendChild(img);
  div.onclick = () => selectDir(d);

  const dir = document.createElement('div');
  dir.innerText = d === '.' ? '../' : d + '/';
  div.appendChild(dir);

  const root = document.querySelector('.root');
  root.appendChild(div);

  SVGInject(img);
}

function showModal(url) {
  const modal = document.querySelector('.modal');
  modal.style.opacity = '1';
  modal.style.pointerEvents = 'unset';

  const modalImage = document.querySelector('.modal .image');
  modalImage.src = '';
  modalImage.src = url;

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

window.onload = init;

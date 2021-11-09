const server = window.location.origin;

function init() {
  updateImages();
  setInterval(updateImages, 60 * 1000);

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
  const modal = document.querySelector('.modal');

  if (modal.style.opacity !== '1') {
    const root = document.querySelector('.root');
    root.replaceChildren();

    fetch(`${server}/imageList`)
      .then((response) => response.json())
      .then((res) => {
        res.forEach((f) => {
          const img = document.createElement('img');
          img.src = f.thumb;
          img.onclick = () => showModal(f.file);

          root.appendChild(img);
        });
      });
  }
}

function showModal(url) {
  const modal = document.querySelector('.modal');
  modal.style.opacity = '1';
  modal.style.pointerEvents = 'unset';

  const modalImage = document.querySelector('.modal img');
  modalImage.src = '';
  modalImage.src = url;
}

function hideModal() {
  const modal = document.querySelector('.modal');
  modal.style.opacity = '0';
  modal.style.pointerEvents = 'none';
}

init();

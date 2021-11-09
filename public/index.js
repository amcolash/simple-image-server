const server = window.location.origin;

function init() {
  const root = document.querySelector('.root');
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

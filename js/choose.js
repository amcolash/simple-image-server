const storageKey = 'image-sites';

let timerDuration = 3 * 1000;
let sites = [];
let redirect;

window.onload = () => {
  const add = document.querySelector('#add');
  add.addEventListener('click', addSite);

  const name = document.querySelector('#name');
  name.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') addSite();
  });

  const address = document.querySelector('#address');
  address.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') addSite();
  });

  load();
  pingSites();
};

function addSite() {
  const name = document.querySelector('#name');
  const address = document.querySelector('#address');

  if (name.value.length > 0 && address.value.length > 0) {
    sites.push({ name: name.value, address: address.value });

    name.value = '';
    address.value = '';

    save();
    updateList();
  }
}

function updateList() {
  const list = document.querySelector('.list');
  list.replaceChildren();

  const ul = document.createElement('ul');
  list.appendChild(ul);

  sites.forEach((s) => {
    const li = document.createElement('li');

    const link = document.createElement('a');
    link.innerText = `${s.name} (${s.address})`;
    link.href = 'https://' + s.address + ':3000';

    const remove = document.createElement('button');
    remove.className = 'remove';
    remove.innerText = 'X';
    remove.addEventListener('click', () => {
      sites = sites.filter((site) => JSON.stringify(s) !== JSON.stringify(site));

      save();
      updateList();
    });

    li.appendChild(link);
    li.appendChild(remove);

    ul.appendChild(li);
  });
}

function load() {
  const loaded = localStorage.getItem(storageKey);

  try {
    if (loaded) sites = JSON.parse(loaded);
    updateList();
  } catch (err) {
    console.error(err);
  }
}

function save() {
  localStorage.setItem(storageKey, JSON.stringify(sites));
}

function pingSites() {
  const promises = [];

  sites.forEach((s) => {
    if (redirect) return;

    const url = `https://${s.address}:3000/`;
    promises.push(
      fetch(`${url}status`)
        .then((res) => {
          if (res.ok) {
            redirect = setTimeout(() => {
              window.location = url;
            }, timerDuration);

            const timer = document.querySelector('.timer');
            timer.innerText = `(${timerDuration / 1000})`;

            const interval = setInterval(() => {
              timerDuration -= 1000;
              if (timerDuration >= 0) timer.innerText = `(${timerDuration / 1000})`;
              else clearInterval(interval);
            }, 1000);

            const redirectEl = document.querySelector('.redirect');
            redirectEl.style.display = 'flex';

            const redirectUrl = document.querySelector('.redirectUrl');
            redirectUrl.innerHTML = `Redirecting to: ${url}`;

            const redirectCancel = document.querySelector('#redirectCancel');
            redirectCancel.addEventListener('click', () => {
              clearTimeout(redirect);
              redirectEl.style.display = 'none';

              const root = document.querySelector('.root');
              root.style.display = 'flex';

              const loading = document.querySelector('#loading');
              loading.style.display = 'none';
            });
          }
        })
        .catch((e) => {
          // Do nothing if we cannot reach the site
        })
    );
  });

  Promise.all(promises).then(() => {
    if (!redirect) {
      const root = document.querySelector('.root');
      root.style.display = 'flex';
    }

    const loading = document.querySelector('#loading');
    loading.style.display = 'none';
  });
}

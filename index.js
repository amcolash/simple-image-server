const express = require('express');
const { existsSync, mkdirSync } = require('fs');
const { getAllFilesSync } = require('get-all-files');
const os = require('os');
const { dirname, join, relative } = require('path');
const sharp = require('sharp');

require('dotenv').config();

const dir = process.env.DIR || '/home/amcolash/Pictures';
const port = process.env.PORT || 3000;
const tmp = join(os.tmpdir(), 'simple-image-server');

// Make tmp dir if it doesn't exist
if (!existsSync(tmp)) mkdirSync(tmp);

function generateThumbs() {
  const promises = [];

  getFiles().forEach((f) => {
    const thumbFile = getThumbName(f);

    if (!existsSync(thumbFile)) {
      console.log(`Generating thumbnail for ${f}: ${thumbFile}`);
      mkdirSync(dirname(thumbFile), { recursive: true });

      promises.push(sharp(f).resize(300).jpeg().toFile(thumbFile));
    }
  });

  return Promise.all(promises)
    .then(() => {
      console.log('All done!');
    })
    .catch((err) => {
      console.error(err);
    });
}

function getThumbName(f) {
  const relativeFile = relative(dir, f);
  const thumbFile = join(tmp, relativeFile);

  return thumbFile;
}

function getFiles() {
  return getAllFilesSync(dir)
    .toArray()
    .filter((f) => {
      const l = f.toLowerCase();
      return l.endsWith('.jpg') || l.endsWith('.jpeg') || l.endsWith('.png') || l.endsWith('.bmp');
    });
}

generateThumbs();

const app = express();
app.use(express.static('public'));
app.use('/images', express.static(dir, { maxAge: 60 * 60 * 1000 }));
app.use('/thumbs', express.static(tmp, { maxAge: 60 * 60 * 1000 }));

app.get('/imageList', (req, res) => {
  generateThumbs().then(() => {
    const images = getFiles().map((f) => {
      const rel = relative(dir, f);
      return { file: join('/images/', rel), thumb: join('/thumbs/', rel), dir: dirname(rel) };
    });

    res.json(images);
  });
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

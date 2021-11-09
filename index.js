const express = require('express');
const { existsSync, mkdirSync } = require('fs');
const { mkdirpSync } = require('mkdirp');
const os = require('os');
const { basename, join, relative, dirname, resolve } = require('path');
const sharp = require('sharp');
const { getAllFilesSync } = require('get-all-files');

require('dotenv').config();

const dir = process.env.DIR || '/home/amcolash/Desktop/test/';
const port = process.env.PORT || 3000;
const tmp = join(os.tmpdir(), 'simple-image-server');

// Make tmp dir if it doesn't exist
if (!existsSync(tmp)) mkdirSync(tmp);

function generateThumbs() {
  const promises = [];

  getAllFilesSync(dir)
    .toArray()
    .forEach((f) => {
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

generateThumbs();

const app = express();
app.use(express.static('public'));
app.use('/images', express.static(dir));
app.use('/thumbs', express.static(tmp));

app.get('/imageList', (req, res) => {
  generateThumbs().then(() => {
    const images = getAllFilesSync(dir)
      .toArray()
      .map((f) => {
        const rel = relative(dir, f);
        return { file: join('/images/', rel), thumb: join('/thumbs/', rel) };
      });

    res.json(images);
  });
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

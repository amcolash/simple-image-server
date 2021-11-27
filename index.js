#!/usr/bin/env node

const express = require('express');
const { existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } = require('fs');
const { getAllFilesSync } = require('get-all-files');
const os = require('os');
const { dirname, join, relative, resolve, sep } = require('path');
const screenshot = require('screenshot-desktop');
const sharp = require('sharp');

const argv = require('yargs')
  .usage('Usage: $0 [options] <folder>')

  .alias('p', 'port')
  .nargs('p', 1)
  .describe('p', 'Specify a port')

  .alias('w', 'write-access')
  .nargs('w', 0)
  .describe('w', 'Allow write access to location (take screenshot, delete, move)')

  .demand(1)
  .help('h')
  .alias('h', 'help').argv;

const port = argv.p || 8000;
const write = argv.w || false;
const tmp = join(os.tmpdir(), 'simple-image-server');

let dir = argv._[0];

try {
  // Fix home dir paths and resolve path
  if (dir.startsWith('~')) dir = dir.replace('~', os.homedir());
  dir = resolve(dir);

  // Check that the folder exists
  if (!existsSync(dir)) throw '';
} catch (e) {
  console.error('Unable to load directory', dir, e);
  process.exit(1);
}

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

  return Promise.all(promises).catch((err) => {
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

function getImages() {
  return getFiles().map((f) => {
    const rel = relative(dir, f);
    return { file: join('/images/', rel), thumb: join('/thumbs/', rel), rel, dir: dirname(rel), created: statSync(f).birthtime };
  });
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(express.static(join(__dirname, 'public')));
app.use('/images', express.static(dir, { maxAge: 60 * 60 * 1000 }));
app.use('/thumbs', express.static(tmp, { maxAge: 60 * 60 * 1000 }));

app.get('/imageList', (req, res) => {
  generateThumbs().then(() => {
    res.json(getImages());
  });
});

// Only enable write access if specified by user
if (write) {
  app.delete('/image', (req, res) => {
    if (req.body.paths && req.body.paths.length > 0) {
      let hasError = false;

      req.body.paths.forEach((p) => {
        // Try to prevent deleting outside of folder
        if (!hasError && p.indexOf(`.${sep}`) !== -1) {
          console.error('Cannot remove relative paths', p);
          hasError = true;
        }

        if (!existsSync(join(dir, p))) {
          console.error('File does not exists', p);
          hasError = true;
        }
      });

      if (hasError) {
        res.sendStatus(403);
        return;
      }

      req.body.paths.forEach((p) => {
        const file = join(dir, p);
        const thumbFile = getThumbName(file);

        try {
          console.log('Removing file', file);
          unlinkSync(file);

          console.log('Removing file', thumbFile);
          unlinkSync(thumbFile);
        } catch (e) {
          console.error(e);
        }
      });

      res.json(getImages());
    } else {
      console.error('Expected an array, but did not get one');
      res.sendStatus(403);
    }
  });

  app.post('/capture', (req, res) => {
    const d = new Date();
    const dateString = `${d.getMonth().toString().padStart(2, '0')}_${d.getDate().toString().padStart(2, '0')}_${d.getFullYear()}`;
    const timeString = `${d.getHours().toString().padStart(2, '0')}_${d.getMinutes().toString().padStart(2, '0')}_${d
      .getSeconds()
      .toString()
      .padStart(2, '0')} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;

    const file = join(dir, req.body.currentDir, `Screenshot ${dateString} ${timeString}.png`);

    console.log('Taking screenshot', file);

    screenshot({ format: 'png' })
      .then((img) => {
        writeFileSync(file, img);

        generateThumbs().then(() => res.json(getImages()));
      })
      .catch((err) => {
        console.error(err);
        res.sendStatus(500);
      });
  });
}

app.listen(port, () => {
  console.log(`Serving images in ${dir}`);
  console.log(`Write access is ${write ? 'enabled' : 'disabled'}`);
  console.log(`Server listening at http://localhost:${port}`);

  generateThumbs();
});

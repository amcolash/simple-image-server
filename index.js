#!/usr/bin/env node

const express = require('express');
const { existsSync, mkdirSync } = require('fs');
const { getAllFilesSync } = require('get-all-files');
const os = require('os');
const { dirname, join, relative, resolve } = require('path');
const sharp = require('sharp');

const argv = require('yargs')
  .usage('Usage: $0 [options] <folder>')
  .alias('p', 'port')
  .nargs('p', 1)
  .describe('p', 'Specify a port')
  .demand(1)
  .help('h')
  .alias('h', 'help').argv;

const port = argv.p || 8000;
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

const app = express();
app.use(express.static(join(__dirname, 'public')));
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
  console.log(`Serving images in ${dir}`);
  console.log(`Server listening at http://localhost:${port}`);

  generateThumbs();
});

#!/usr/bin/env node

const compression = require('compression');
const cors = require('cors');
const express = require('express');
const { existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFile, writeFileSync } = require('fs');
const { getAllFilesSync } = require('get-all-files');
const https = require('https');
const http = require('http');
const os = require('os');
const { basename, dirname, join, relative, resolve, sep } = require('path');
const screenshot = require('screenshot-desktop');
const sharp = require('sharp');
const sizeOf = require('image-size');
const yargs = require('yargs');

console.log('simple-image-server@' + require(join(__dirname, 'package.json')).version);

const argv = yargs
  .usage('Usage: $0 [options] <folder>')

  .alias('v', 'version')

  .alias('p', 'port')
  .nargs('p', 1)
  .number('p')
  .describe('p', 'Specify a port')
  .default('p', 8000)

  .alias('a', 'address')
  .nargs('a', 1)
  .string('a')
  .describe('a', 'Host address to listen to')
  .default('a', '127.0.0.1')

  .alias('c', 'cert')
  .nargs('c', 1)
  .string('c')
  .describe('c', 'HTTPS Certificate path')

  .alias('k', 'key')
  .nargs('k', 1)
  .string('k')
  .describe('k', 'HTTPS Private key path')

  .alias('w', 'write-access')
  .nargs('w', 0)
  .boolean('w')
  .describe(
    'w',
    'Allow write access to hosted directory (enables options such as screenshots, drawings, creating folders, moving and deleting images)'
  )
  .default('w', false)

  .demand(1)
  .wrap(100)

  .help('h')
  .alias('h', 'help').argv;

const port = argv.p;
const write = argv.w;
const host = argv.a;
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

const defaultData = { drawings: {} };
let data = JSON.parse(JSON.stringify(defaultData));
const dataFile = join(dir, 'data.json');
const cachedDims = {};

loadData();

// Make tmp dir if it doesn't exist
if (!existsSync(tmp)) mkdirSync(tmp);

function generateThumbs(overwrite) {
  const promises = [];

  getFiles().forEach((f) => {
    const thumbFile = getThumbName(f);

    if (!existsSync(thumbFile) || overwrite) {
      console.log(`Generating thumbnail for ${f}: ${thumbFile}`);
      mkdirSync(dirname(thumbFile), { recursive: true });

      promises.push(sharp(f).resize(300).jpeg().toFile(thumbFile));
    }
  });

  Object.keys(data.drawings).forEach((d) => {
    if (!existsSync(join(dir, d))) {
      console.log(`Removing missing drawing ${d}`);
      delete data.drawings[d];
    }
  });

  saveData();

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
  const images = {
    files: getFiles().map((f) => {
      const rel = relative(dir, f);

      // Cache dimensions for performance
      const dimensions = cachedDims[f] || sizeOf(f);
      cachedDims[f] = dimensions;

      return {
        file: join('/images/', rel),
        thumb: join('/thumbs/', rel),
        rel,
        dir: dirname(rel),
        created: statSync(f).birthtime,
        drawing: data.drawings[rel.replace(/\\/g, '/')],
        dimensions,
      };
    }),
    write,
  };

  return images;
}

function loadData() {
  try {
    if (existsSync(dataFile)) {
      data = JSON.parse(readFileSync(dataFile));
    } else {
      saveData(true);
    }
  } catch (err) {
    console.error(err);
    data = JSON.parse(JSON.stringify(defaultData));
  }
}

function saveData(sync) {
  try {
    if (sync) writeFileSync(dataFile, JSON.stringify(data));
    else
      writeFile(dataFile, JSON.stringify(data), (err) => {
        if (err) console.error(err);
      });
  } catch (err) {
    console.error(err);
  }
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(compression());
app.use(cors());

let creds;
if (argv.c && argv.k) {
  const cert = resolve(argv.c);
  const key = resolve(argv.k);

  if (existsSync(cert) && existsSync(key)) {
    creds = { key: readFileSync(key), cert: readFileSync(cert) };
  } else {
    console.error('Could not find cert + key', cert, key);
  }
}

let server;
if (creds) {
  server = https.createServer(creds, app);
} else {
  server = http.createServer(app);
}

server.listen(port, host, () => {
  console.log(`Serving images in ${dir}`);
  console.log(`Write access is ${write ? 'enabled' : 'disabled'}`);
  console.log(`Server listening at ${creds ? 'https' : 'http'}://${host}:${port}`);

  generateThumbs();
});

const options = { maxAge: 60 * 60 * 1000 };

app.use(express.static(join(__dirname, 'public')));
app.use('/chooser', express.static(join(__dirname, 'chooser')));
app.use('/images', express.static(dir, options));
app.use('/thumbs', express.static(tmp, options));

app.get('/imageList', (req, res) => {
  generateThumbs().then(() => res.json(getImages()));
});

// Simple health check endpoint (if it is running, the server will respond)
app.get('/status', (req, res) => {
  res.sendStatus(200);
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
          console.error('File does not exist', p);
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

  // app.post('/rotate', async (req, res) => {
  //   if (!req.body.path) {
  //     console.error('Expected a path, but did not get one');
  //     res.sendStatus(403);
  //     return;
  //   }

  //   const file = join(dir, req.body.path);

  //   if (!existsSync(file)) {
  //     console.error('File does not exist', p);
  //     res.sendStatus(404);
  //     return;
  //   }

  //   try {
  //     const rotated = await sharp(file).rotate(90).toBuffer();
  //     await sharp(rotated).jpeg().toFile(file);

  //     const thumbFile = getThumbName(file);

  //     console.log('Removing file', thumbFile);
  //     unlinkSync(thumbFile);
  //   } catch (e) {
  //     console.error(e);
  //   }

  //   generateThumbs().then(() => res.json(getImages()));
  // });

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

  app.post('/move', (req, res) => {
    if (req.body.paths) {
      try {
        req.body.paths.forEach((f) => {
          const source = join(dir, f);
          const destDir = join(dir, req.body.destination);
          const dest = join(destDir, basename(f));

          if (data.drawings[f]) {
            const drawingLocation = join(req.body.destination, basename(f)).replace(/\\/g, '/');
            data.drawings[drawingLocation] = data.drawings[f];
            data.drawings[f] = undefined;
            saveData();
          }

          if (!existsSync(destDir)) {
            console.log(`Destination does not exist, making new directory ${destDir}`);
            mkdirSync(destDir, { recursive: true });
          }

          console.log(`Moving ${source} to ${dest}`);
          renameSync(source, dest);
        });

        res.json(getImages());
      } catch (e) {
        console.error(e);
        res.sendStatus(500);
      }
    } else {
      console.error('Expected an array, but did not get one');
      res.sendStatus(403);
    }
  });

  app.post('/drawing', (req, res) => {
    if (req.body.path && req.body.data) {
      data.drawings[req.body.path] = req.body.data;
      saveData();

      res.sendStatus(200);
    } else if (req.body.path) {
      data.drawings[req.body.path] = undefined;
      saveData();

      res.sendStatus(200);
    } else {
      console.error('Drawing missing parameters');
      res.sendStatus(500);
    }
  });
}

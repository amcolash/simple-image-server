# simple-image-server

A small server that hosts images (similar to simplehttpserver)

## Basic Usage

```text
Usage: index.js [options] <folder>

Options:
  -p, --port          Specify a port                                                        [number]
  -w, --write-access  Allow write access to directory (screenshot, delete, move)           [boolean]
  -h, --help          Show help                                                            [boolean]
  -v, --version       Show version number                                                  [boolean]
```

## Write Access

When write access is enabled (not by default), additional ui options will appear. These include taking a screenshot of the server's screen,
deleting and moving images to different directories. These options are useful to me, but should only be enabled if you trust users who
are using this service.

## Icons

This project uses [Feather Icons](https://feathericons.com/)

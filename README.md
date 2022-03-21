# simple-image-server

A small server that hosts images (similar to simplehttpserver)

There are a handful of additional features (outside of just having images served):

- HTTPS support
- Write Mode
  - Take screenshots
  - Create Folders
  - Move Images
  - Draw on images in browser
  - Delete Images

## Basic Usage

```text
Usage: simple-image-server [options] <folder>

Options:
  -p, --port          Specify a port                                        [number] [default: 8000]
  -a, --address       Host address to listen to                      [string] [default: "127.0.0.1"]
  -c, --cert          HTTPS Certificate path                                                [string]
  -k, --key           HTTPS Private key path                                                [string]
  -w, --write-access  Allow write access to hosted directory (enables options such as screenshots,
                      drawings, creating folders, moving and deleting images)
                                                                          [boolean] [default: false]
  -h, --help          Show help                                                            [boolean]
  -v, --version       Show version number                                                  [boolean]
```

## Write Access

When write access is enabled (not by default), additional ui options will appear. These include taking a screenshot of the server's screen,
deleting and moving images to different directories. These options are useful to me, but should only be enabled if you trust users who
are using this service.

## Icons

This project uses [Feather Icons](https://feathericons.com/)

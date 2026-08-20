# Suvarnatantu

Official animated B2B website for Suvarnatantu.

by Vastranand Pvt. Ltd.

## Technology

This is a standalone static website built with HTML, CSS, JavaScript, local WebP images, and local assets. It has no package-managed dependencies, external CDN requirement, or build step.

## Project structure

```text
index.html              Website entry point
assets/
  css/styles.css        Site styles and responsive layout
  js/main.js            Interactive and animation behaviour
  images/               Local website imagery
  fonts/README.txt      Font-asset notes
```

## Run locally

Open `index.html` directly in a modern browser for a simple preview.

For local development, open this folder in VS Code and use the Live Server extension to serve `index.html`. Alternatively, if Python is already available on your system, start a local static server from the project root:

```powershell
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Notes

The enquiry form is a front-end concept and must be connected to an approved production CRM, API, email workflow, or backend before launch. Public-facing technical, export, certification, capacity, and contact claims should be verified by Suvarnatantu before production use.

This repository is private and intended for authorized company development only.

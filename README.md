# image2pdf
# Image → PDF Converter (Client-Side)

A privacy-first Image → PDF converter that runs **entirely in your browser**.  
No uploads. No accounts. No tracking. Just drag, reorder, export.

**Made by Rajesh Acharya.**

---

## Why this exists

Most “free” online converters ask you to upload personal files to someone else’s server.  
This tool was built to avoid that completely.

✅ **100% client-side processing** — your images stay on your device  
✅ **Works offline after first load**  
✅ **Fast, simple, and clean UI**

---

## Features

- Drag & drop **PNG/JPG** images
- Reorder pages with **handle drag + ghost preview + auto-scroll**
- Export a **multi-page PDF** in your chosen order
- Page size: **A4 / Letter**
- Orientation: **Auto (per image) / Portrait / Landscape**
- **JPEG Quality** slider (smaller PDF ↔ sharper pages)
- Optional: **Keep PNG as PNG** (preserves transparency, usually larger file)
- **Light/Dark theme**, saved locally

---

## How it works

1. Your browser loads the images locally.
2. Images are converted and placed into PDF pages in your selected order.
3. The PDF is generated and downloaded — **nothing is uploaded anywhere**.

---

## Tech

- Plain **HTML / CSS / JavaScript**
- Uses **jsPDF** for PDF generation (included locally)

---

## Getting started

### Option 1: Run locally
Just open `index.html` in your browser.

### Option 2: Run with a local server (recommended)
Some browsers are stricter with local file access. A local server avoids edge cases.

Using VS Code:
- Install the **Live Server** extension
- Right-click `index.html` → **Open with Live Server**

Or using Python:
```bash
python -m http.server 8080

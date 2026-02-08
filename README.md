# Image → PDF (Local, Fast, Clean)

A lightweight, privacy-first Image → PDF converter that runs **100% in your browser**.  
No uploads. No accounts. No tracking. Your files stay on your device.

## Demo
- Live app: https://seanawake.github.io/image2pdf/

## Features
- ✅ Add JPG/PNG images
- ✅ One image per PDF page (multi-page PDF)
- ✅ Reorder pages (drag & drop on desktop)
- ✅ Output settings:
  - Page size: **A4 / US Letter**
  - Orientation: **Auto / Portrait / Landscape**
  - **Margins** slider (mm)
  - Fit mode: **Fit (no crop) / Fill (crop)**
  - **JPEG Quality** slider (smaller file ↔ better quality)
  - Optional: **Keep PNG as PNG** (preserves transparency; may increase size)
- ✅ Works offline after first load (browser cache)

## Privacy
This tool runs entirely client-side:
- Images are processed locally in your browser
- Nothing is uploaded to any server
- No sign-in, no analytics, no tracking

## How to Use
1. Open the app
2. Add images (drag & drop on desktop, or use the file picker)
3. Reorder pages as needed
4. Adjust PDF settings (optional)
5. Click **Convert to PDF**
6. Download / open your PDF

## Limitations / Notes
- **Mobile drag & drop is unreliable** across browsers. Use the file picker and the Up/Down controls for reordering.
- Output size depends on images and quality settings.
- “Fill (crop)” may crop edges to remove white borders. Use “Fit” to avoid cropping.

## Local Development
```bash
# Just open index.html
# OR run a simple local server:
python -m http.server 8080

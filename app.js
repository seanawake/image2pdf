  const { jsPDF } = window.jspdf;

  // ===== THEME =====
  const THEME_KEY = "img2pdf_theme";
  const btnDark = document.getElementById("btnDark");
  const btnLight = document.getElementById("btnLight");

  function applyTheme(theme){
    document.documentElement.setAttribute("data-theme", theme);
    const isDark = theme === "dark";
    btnDark.setAttribute("aria-pressed", String(isDark));
    btnLight.setAttribute("aria-pressed", String(!isDark));
  }
  function initTheme(){
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light"){ applyTheme(saved); return; }
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark ? "dark" : "light");
  }
  btnDark.addEventListener("click", () => { localStorage.setItem(THEME_KEY, "dark"); applyTheme("dark"); });
  btnLight.addEventListener("click", () => { localStorage.setItem(THEME_KEY, "light"); applyTheme("light"); });
  initTheme();

  // ===== APP =====
  const drop = document.getElementById('drop');
  const fileInput = document.getElementById('fileInput');
  const listEl = document.getElementById('list');
  const statusEl = document.getElementById('status');

  const makeBtn = document.getElementById('makeBtn');
  const clearBtn = document.getElementById('clearBtn');

  const pdfNameEl = document.getElementById('pdfName');
  const pageSizeEl = document.getElementById('pageSize');
  const orientationEl = document.getElementById('orientation');
  const qualityEl = document.getElementById('quality');
  const qualityLabel = document.getElementById('qualityLabel');
  const keepPngEl = document.getElementById('keepPng');

  const countBadge = document.getElementById('countBadge');
  const pageHint = document.getElementById('pageHint');
  const dropTitle = document.getElementById("dropTitle");

  const isMobile = matchMedia("(pointer: coarse)").matches;
  if (isMobile && dropTitle){
    dropTitle.textContent = "Tap to add images";
  }
  const aboutBtn = document.getElementById('aboutBtn');
  const aboutModal = document.getElementById('aboutModal');
  const aboutClose = document.getElementById('aboutClose');

  let items = []; // { id, file, url }
  let nextId = 1;

  function openAbout(){
    if (!aboutModal) return;
    aboutModal.classList.add("is-open");
    aboutModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    aboutClose?.focus();
  }

  function closeAbout(){
    if (!aboutModal) return;
    aboutModal.classList.remove("is-open");
    aboutModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    aboutBtn?.focus();
  }

  if (aboutBtn){
    aboutBtn.addEventListener("click", openAbout);
  }
  if (aboutClose){
    aboutClose.addEventListener("click", closeAbout);
  }
  if (aboutModal){
    aboutModal.addEventListener("click", (e) => {
      if (e.target === aboutModal) closeAbout();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && aboutModal?.classList.contains("is-open")) {
      closeAbout();
    }
  });

  // Drag state + autoscroll state
  const drag = {
    active: false,
    id: null,
    pointerId: null,
    ghost: null,
    offsetX: 14,
    offsetY: 14,
    raf: 0,
    lastX: 0,
    lastY: 0,
    autoScrollRaf: 0,
    autoScrollV: 0
  };

  function setStatus(msg, kind="") {
    statusEl.className = "status " + kind;
    statusEl.textContent = msg || "";
  }

  function bytesToNice(n){
    const u = ["B","KB","MB","GB"];
    let i=0; let x=n;
    while(x>=1024 && i<u.length-1){ x/=1024; i++; }
    return `${x.toFixed(x<10 && i>0 ? 2 : 0)} ${u[i]}`;
  }

  function updateBadges(){
    const n = items.length;
    countBadge.textContent = `${n} image${n===1?"":"s"}`;

    const sizeTxt = (pageSizeEl.value === "letter") ? "Letter" : "A4";
    const o = orientationEl.value;
    const oTxt = (o === "auto") ? "Auto" : (o === "p" ? "Portrait" : "Landscape");
    pageHint.textContent = `${sizeTxt} \u2022 ${oTxt}`;
  }

  qualityEl.addEventListener('input', () => {
    qualityLabel.textContent = Number(qualityEl.value).toFixed(2);
  });

  pageSizeEl.addEventListener('change', updateBadges);
  orientationEl.addEventListener('change', updateBadges);

  function addFiles(fileList){
    const files = Array.from(fileList || []).filter(f =>
      f && (f.type === "image/png" || f.type === "image/jpeg")
    );
    if (!files.length) { setStatus("No valid PNG/JPG files detected.", "bad"); return; }

    for (const f of files) {
      const url = URL.createObjectURL(f);
      items.push({ id: String(nextId++), file: f, url });
    }
    render();
    setStatus(`${files.length} image(s) added.`, "ok");
  }

  function clearAll(){
    for (const it of items) URL.revokeObjectURL(it.url);
    items = [];
    render();
    setStatus("");
  }

  function removeItem(id){
    const idx = items.findIndex(x => x.id === id);
    if (idx < 0) return;
    URL.revokeObjectURL(items[idx].url);
    items.splice(idx, 1);
    render();
  }

  // ===== FLIP animation (smooth swap) =====
  function capturePositions(){
    const map = new Map();
    listEl.querySelectorAll(".item").forEach(el => {
      map.set(el.dataset.id, el.getBoundingClientRect());
    });
    return map;
  }

  function playFLIP(before){
    listEl.querySelectorAll(".item").forEach(el => {
      const id = el.dataset.id;
      const b = before.get(id);
      if (!b) return;
      const a = el.getBoundingClientRect();
      const dx = b.left - a.left;
      const dy = b.top - a.top;
      if (dx === 0 && dy === 0) return;

      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.style.transition = "transform 0s";
      requestAnimationFrame(() => {
        el.style.transition = "transform 180ms cubic-bezier(.2,.8,.2,1)";
        el.style.transform = "";
      });
    });
  }

  function reorderById(dragId, targetIndex){
    const fromIndex = items.findIndex(x => x.id === dragId);
    if (fromIndex < 0) return false;

    const toIndex = Math.max(0, Math.min(items.length - 1, targetIndex));
    if (fromIndex === toIndex) return false;

    const [m] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, m);
    return true;
  }

  // ===== Ghost =====
  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, s => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[s]));
  }

  function createGhost(fromItemEl, item){
    const ghost = document.createElement("div");
    ghost.className = "dragGhost";
    ghost.innerHTML = `
      <div class="ghostCard">
        <img src="${item.url}" alt="">
        <div style="min-width:0;">
          <div class="gTitle">${escapeHtml(item.file.name)}</div>
          <div class="gSub">${item.file.type.replace("image/","").toUpperCase()} â€¢ ${bytesToNice(item.file.size)}</div>
        </div>
      </div>
    `;
    document.body.appendChild(ghost);

    const r = fromItemEl.getBoundingClientRect();
    ghost.style.width = `${Math.min(r.width, window.innerWidth - 24)}px`;
    return ghost;
  }

  function moveGhost(x, y){
    if (!drag.ghost) return;
    drag.ghost.style.transform = `translate3d(${x + drag.offsetX}px, ${y + drag.offsetY}px, 0)`;
  }

  function destroyGhost(){
    if (drag.ghost){
      drag.ghost.remove();
      drag.ghost = null;
    }
  }

  function clearDropHighlights(){
    listEl.querySelectorAll(".item.dropTarget").forEach(x => x.classList.remove("dropTarget"));
  }

  function highlightDropTargetAtPoint(x, y){
    clearDropHighlights();
    const el = document.elementFromPoint(x, y);
    const row = el?.closest?.(".item");
    if (!row || row.dataset.id === drag.id) return;
    row.classList.add("dropTarget");
  }

  function getTargetIndexFromPoint(x, y){
    const el = document.elementFromPoint(x, y);
    const row = el?.closest?.(".item");
    if (!row) return null;

    const id = row.dataset.id;
    if (!id || id === drag.id) return null;

    const rect = row.getBoundingClientRect();
    const before = y < rect.top + rect.height / 2;

    const idx = items.findIndex(it => it.id === id);
    if (idx < 0) return null;

    const curIndex = items.findIndex(it => it.id === drag.id);
    if (curIndex < 0) return null;

    const insertPos = before ? idx : idx + 1;
    let finalIndex = insertPos;
    if (finalIndex > curIndex) finalIndex = finalIndex - 1;
    finalIndex = Math.max(0, Math.min(items.length - 1, finalIndex));
    return finalIndex;
  }

  // ===== AUTO-SCROLL while dragging near edges =====
  function computeAutoScrollVelocity(){
    // Use viewport edges (works even when list is long)
    const y = drag.lastY;
    const edge = 90;              // px from top/bottom where autoscroll starts
    const maxV = 18;              // px per frame-ish (will be smoothed by RAF)
    const top = edge;
    const bottom = window.innerHeight - edge;

    let v = 0;
    if (y < top) {
      const t = (top - y) / edge; // 0..1
      v = -Math.min(maxV, 4 + t * maxV);
    } else if (y > bottom) {
      const t = (y - bottom) / edge;
      v = Math.min(maxV, 4 + t * maxV);
    }
    return v;
  }

  function autoScrollTick(){
    if (!drag.active) { drag.autoScrollRaf = 0; return; }

    const v = computeAutoScrollVelocity();
    drag.autoScrollV = v;

    if (v !== 0){
      window.scrollBy(0, v);

      // After scroll, positions changed; re-run reorder detection using latest pointer position
      const targetIndex = getTargetIndexFromPoint(drag.lastX, drag.lastY);
      if (targetIndex != null){
        const before = capturePositions();
        const changed = reorderById(drag.id, targetIndex);
        if (changed){
          render({ preserveStatus: true });
          playFLIP(before);
        }
      }

      // Keep drop highlight aligned
      highlightDropTargetAtPoint(drag.lastX, drag.lastY);
    }

    drag.autoScrollRaf = requestAnimationFrame(autoScrollTick);
  }

  function startAutoScroll(){
    if (drag.autoScrollRaf) return;
    drag.autoScrollRaf = requestAnimationFrame(autoScrollTick);
  }

  function stopAutoScroll(){
    if (drag.autoScrollRaf){
      cancelAnimationFrame(drag.autoScrollRaf);
      drag.autoScrollRaf = 0;
    }
    drag.autoScrollV = 0;
  }

  // ===== Pointer drag reorder =====
  function onHandlePointerDown(e){
    const handle = e.currentTarget;
    const id = handle.dataset.id;
    if (!id) return;

    const itemEl = handle.closest(".item");
    const item = items.find(x => x.id === id);
    if (!itemEl || !item) return;

    drag.active = true;
    drag.id = id;
    drag.pointerId = e.pointerId;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;

    handle.setPointerCapture?.(e.pointerId);

    drag.ghost = createGhost(itemEl, item);
    moveGhost(e.clientX, e.clientY);

    itemEl.classList.add("drag-source");
    setStatus("Reorderingâ€¦", "");

    startAutoScroll();
    e.preventDefault();
  }

  function onGlobalPointerMove(e){
    if (!drag.active) return;
    if (drag.pointerId !== null && e.pointerId !== drag.pointerId) return;

    drag.lastX = e.clientX;
    drag.lastY = e.clientY;

    if (drag.raf) return;
    drag.raf = requestAnimationFrame(() => {
      drag.raf = 0;

      moveGhost(drag.lastX, drag.lastY);
      highlightDropTargetAtPoint(drag.lastX, drag.lastY);

      const targetIndex = getTargetIndexFromPoint(drag.lastX, drag.lastY);
      if (targetIndex == null) return;

      const before = capturePositions();
      const changed = reorderById(drag.id, targetIndex);
      if (!changed) return;

      render({ preserveStatus: true });
      playFLIP(before);
    });

    e.preventDefault?.();
  }

  function endDrag(){
    if (!drag.active) return;

    drag.active = false;
    drag.pointerId = null;
    drag.id = null;

    if (drag.raf){
      cancelAnimationFrame(drag.raf);
      drag.raf = 0;
    }

    stopAutoScroll();
    destroyGhost();
    clearDropHighlights();

    render({ preserveStatus: true });
    setStatus("Reordered.", "ok");
  }

  window.addEventListener("pointermove", onGlobalPointerMove, { passive: false });
  window.addEventListener("pointerup", endDrag, { passive: true });
  window.addEventListener("pointercancel", endDrag, { passive: true });

  function render(opts = {}){
    const preserveStatus = !!opts.preserveStatus;
    if (!preserveStatus) setStatus("");

    listEl.innerHTML = "";
    items.forEach((it) => {
      const row = document.createElement("div");
      row.className = "item";
      row.dataset.id = it.id;

      if (drag.active && drag.id === it.id) row.classList.add("drag-source");

      const handle = document.createElement("div");
      handle.className = "handle";
      handle.title = "Drag to reorder";
      handle.dataset.id = it.id;
      handle.innerHTML = `<div class="dots" aria-hidden="true"></div>`;
      handle.addEventListener("pointerdown", onHandlePointerDown);

      const img = document.createElement("img");
      img.className = "thumb";
      img.src = it.url;
      img.alt = it.file.name;

      const meta = document.createElement("div");
      meta.className = "meta";

      const name = document.createElement("div");
      name.className = "name";
      name.textContent = it.file.name;

      const small = document.createElement("div");
      small.className = "small";
      small.textContent = `${it.file.type.replace("image/","").toUpperCase()} â€¢ ${bytesToNice(it.file.size)}`;

      meta.appendChild(name);
      meta.appendChild(small);

      const actions = document.createElement("div");
      actions.className = "actions";

      const del = document.createElement("button");
      del.className = "btn danger";
      del.textContent = "Remove";
      del.onclick = () => removeItem(it.id);

      actions.appendChild(del);

      row.appendChild(handle);
      row.appendChild(img);
      row.appendChild(meta);
      row.appendChild(actions);

      listEl.appendChild(row);
    });

    const hasItems = items.length > 0;
    makeBtn.disabled = !hasItems;
    clearBtn.disabled = !hasItems;
    updateBadges();
  }

  // Upload drag/drop
  ["dragenter","dragover"].forEach(evt => {
    drop.addEventListener(evt, e => {
      e.preventDefault(); e.stopPropagation();
      drop.classList.add("dragover");
    });
  });
  ["dragleave","drop"].forEach(evt => {
    drop.addEventListener(evt, e => {
      e.preventDefault(); e.stopPropagation();
      drop.classList.remove("dragover");
    });
  });
  drop.addEventListener("drop", e => addFiles(e.dataTransfer.files));

  fileInput.addEventListener("change", e => {
    addFiles(e.target.files);
    fileInput.value = "";
  });

  clearBtn.addEventListener("click", clearAll);

  // ===== PDF generation =====
  function getPageDims(size, orient){
    const A4 = { w: 595.28, h: 841.89 };
    const LETTER = { w: 612, h: 792 };
    let p = (size === "letter") ? LETTER : A4;
    if (orient === "l") return { w: p.h, h: p.w };
    return { w: p.w, h: p.h };
  }

  function loadImage(url){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  function imageToDataURL(img, mime, quality){
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    const maxEdge = Math.max(w, h);
    if (maxEdge > 3000){
      const scale = 3000 / maxEdge;
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { alpha: true });

    if (mime === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0,0,canvas.width,canvas.height);
    }
    ctx.drawImage(img, 0, 0, w, h);

    if (mime === "image/png") return canvas.toDataURL("image/png");
    return canvas.toDataURL("image/jpeg", quality);
  }

  makeBtn.addEventListener("click", async () => {
    if (!items.length) return;

    setStatus("Generating PDFâ€¦", "");
    makeBtn.disabled = true;

    try {
      const margin = 24;
      const size = pageSizeEl.value;
      const orientChoice = orientationEl.value; // auto | p | l
      const jpgQ = Number(qualityEl.value);
      const keepPng = keepPngEl.checked;

      const baseOrient = (orientChoice === "l") ? "landscape" : "portrait";
      const pdf = new jsPDF({ unit: "pt", format: size, orientation: baseOrient });

      let firstPageUsed = false;

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const img = await loadImage(it.url);

        const imgW = img.naturalWidth;
        const imgH = img.naturalHeight;

        let pageOrient = "p";
        if (orientChoice === "auto") pageOrient = (imgW > imgH) ? "l" : "p";
        else pageOrient = orientChoice;

        const page = getPageDims(size, pageOrient);
        const pageW = page.w, pageH = page.h;

        if (!firstPageUsed) {
          const curW = pdf.internal.pageSize.getWidth();
          const curH = pdf.internal.pageSize.getHeight();
          const needLandscape = pageOrient === "l";
          const isLandscape = curW > curH;

          if (needLandscape !== isLandscape) {
            pdf.addPage([pageW, pageH], needLandscape ? "landscape" : "portrait");
            pdf.deletePage(1);
          }
          firstPageUsed = true;
        } else {
          pdf.addPage([pageW, pageH], pageOrient === "l" ? "landscape" : "portrait");
        }

        const maxW = pageW - margin * 2;
        const maxH = pageH - margin * 2;
        const scale = Math.min(maxW / imgW, maxH / imgH);

        const drawW = imgW * scale;
        const drawH = imgH * scale;
        const x = (pageW - drawW) / 2;
        const y = (pageH - drawH) / 2;

        const usePng = keepPng && it.file.type === "image/png";
        const mime = usePng ? "image/png" : "image/jpeg";
        const dataUrl = imageToDataURL(img, mime, jpgQ);

        pdf.addImage(
          dataUrl,
          usePng ? "PNG" : "JPEG",
          x, y, drawW, drawH,
          undefined,
          "FAST"
        );
      }

      let outName = (pdfNameEl.value || "images.pdf").trim();
      if (!outName.toLowerCase().endsWith(".pdf")) outName += ".pdf";

      pdf.save(outName);
      setStatus(`Done: ${outName}`, "ok");
    } catch (err) {
      console.error(err);
      setStatus("Failed to generate PDF. Try smaller images or fewer at a time.", "bad");
    } finally {
      makeBtn.disabled = (items.length === 0);
    }
  });

  // Init
  qualityLabel.textContent = Number(qualityEl.value).toFixed(2);
  updateBadges();
  render();

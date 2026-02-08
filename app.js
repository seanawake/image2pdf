  const { jsPDF } = window.jspdf;

  // ===== THEME =====
  const THEME_KEY = "img2pdf_theme";
  const MARGIN_KEY = "img2pdf_margin_mm";
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
  const progressWrap = document.getElementById('progressWrap');
  const progressBar = document.getElementById('progressBar');
  const resetBtn = document.getElementById('resetBtn');
  const convertHint = document.getElementById('convertHint');

  const pdfNameEl = document.getElementById('pdfName');
  const pageSizeEl = document.getElementById('pageSize');
  const orientationEl = document.getElementById('orientation');
  const qualityEl = document.getElementById('quality');
  const qualityLabel = document.getElementById('qualityLabel');
  const marginEl = document.getElementById('margin');
  const marginLabel = document.getElementById('marginLabel');
  const fitButtons = document.querySelectorAll('[data-fit]');
  const keepPngEl = document.getElementById('keepPng');
  const keepPngHint = document.getElementById('keepPngHint');
  const toast = document.getElementById('toast');
  const toastTitle = document.getElementById('toastTitle');
  const toastSub = document.getElementById('toastSub');
  const toastDownload = document.getElementById('toastDownload');
  const toastOpen = document.getElementById('toastOpen');
  const toastClose = document.getElementById('toastClose');

  const countBadge = document.getElementById('countBadge');
  const sizeBadge = document.getElementById('sizeBadge');
  const pageHint = document.getElementById('pageHint');
  const dropTitle = document.getElementById("dropTitle");

  const isMobile = matchMedia("(pointer: coarse)").matches;
  if (isMobile && dropTitle){
    dropTitle.textContent = "Tap to add images";
  }
  const aboutBtn = document.getElementById('aboutBtn');
  const aboutModal = document.getElementById('aboutModal');
  const aboutClose = document.getElementById('aboutClose');
  const mobileMedia = window.matchMedia("(max-width: 480px)");

  let items = []; // { id, file, url, rotate }
  let nextId = 1;
  let lastPdfUrl = null;
  let lastPdfName = "images.pdf";
  const makeBtnLabel = makeBtn ? makeBtn.textContent : "Convert to PDF";
  const DEFAULT_QUALITY = 0.92;
  const DEFAULT_MARGIN = 8;
  let fitMode = "fit";

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

  if (toastClose){
    toastClose.addEventListener("click", hideToast);
  }
  if (toastDownload){
    toastDownload.addEventListener("click", () => {
      triggerDownload(lastPdfUrl, lastPdfName);
    });
  }
  if (toastOpen){
    toastOpen.addEventListener("click", () => {
      if (!lastPdfUrl) return;
      window.open(lastPdfUrl, "_blank", "noopener");
    });
  }
  if (resetBtn){
    resetBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      resetSettings();
    });
  }
  if (mobileMedia?.addEventListener){
    mobileMedia.addEventListener("change", () => render({ preserveStatus: true }));
  } else if (mobileMedia?.addListener){
    mobileMedia.addListener(() => render({ preserveStatus: true }));
  }

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

  function normalizeRotation(deg){
    let r = Number(deg) || 0;
    r = r % 360;
    if (r < 0) r += 360;
    return r;
  }

  function getRotatedDims(w, h, deg){
    const r = normalizeRotation(deg);
    if (r === 90 || r === 270) return { w: h, h: w };
    return { w, h };
  }

  function getMarginMm(){
    if (!marginEl) return 0;
    const v = Number(marginEl.value);
    return Number.isFinite(v) ? v : 0;
  }

  function setMarginLabel(){
    if (!marginEl || !marginLabel) return;
    marginLabel.textContent = `${marginEl.value} mm`;
  }

  function setQualityLabel(){
    if (!qualityEl || !qualityLabel) return;
    const pct = Math.round(Number(qualityEl.value) * 100);
    qualityLabel.textContent = `${pct}%`;
  }

  function setFitMode(value){
    fitMode = (value === "fill") ? "fill" : "fit";
    if (fitButtons && fitButtons.length){
      fitButtons.forEach(btn => {
        const isActive = btn.dataset.fit === fitMode;
        btn.setAttribute("aria-pressed", String(isActive));
      });
    }
  }

  function getFitMode(){
    return fitMode;
  }

  function initMargin(){
    if (!marginEl) return;
    const saved = localStorage.getItem(MARGIN_KEY);
    if (saved !== null){
      const v = parseInt(saved, 10);
      if (!Number.isNaN(v)){
        const clamped = Math.max(0, Math.min(25, v));
        marginEl.value = String(clamped);
      }
    }
    setMarginLabel();
  }

  function updateBadges(){
    const n = items.length;
    countBadge.textContent = `${n} image${n===1?"":"s"}`;
    if (sizeBadge){
      const totalBytes = items.reduce((sum, it) => sum + (it.file?.size || 0), 0);
      const mb = totalBytes / (1024 * 1024);
      sizeBadge.textContent = `${mb.toFixed(2)} MB`;
    }

    const sizeTxt = (pageSizeEl.value === "letter") ? "Letter" : "A4";
    const o = orientationEl.value;
    const oTxt = (o === "auto") ? "Auto" : (o === "p" ? "Portrait" : "Landscape");
    const marginMm = getMarginMm();
    const marginTxt = `${marginMm}mm`;
    const mode = getFitMode();
    const modeTxt = (mode === "fill") ? "Fill" : "Fit";
    const parts = [sizeTxt, oTxt, marginTxt];
    if (mode !== "fit") parts.push(modeTxt);
    pageHint.textContent = parts.join(" \u2022 ");
  }

  function updateKeepPngAvailability(){
    if (!keepPngEl) return;
    const hasPng = items.some(it => it.file && it.file.type === "image/png");
    keepPngEl.disabled = !hasPng;
    if (!hasPng) keepPngEl.checked = false;
    if (keepPngHint){
      keepPngHint.textContent = hasPng
        ? "Preserves transparency; larger files."
        : "Only available when PNG files are present.";
      keepPngHint.hidden = false;
    }
  }

  function resetSettings(){
    if (pageSizeEl) pageSizeEl.value = "a4";
    if (orientationEl) orientationEl.value = "auto";
    if (qualityEl){
      qualityEl.value = String(DEFAULT_QUALITY);
      setQualityLabel();
    }
    if (marginEl){
      marginEl.value = String(DEFAULT_MARGIN);
      localStorage.setItem(MARGIN_KEY, String(DEFAULT_MARGIN));
      setMarginLabel();
    }
    setFitMode("fit");
    if (keepPngEl) keepPngEl.checked = false;
    updateKeepPngAvailability();
    updateBadges();
  }

  function setConvertProgress(current, total){
    if (makeBtn){
      makeBtn.textContent = "Converting…";
    }
    if (progressWrap && progressBar){
      progressWrap.classList.add("is-active");
      const pct = total > 0 ? Math.round((current / total) * 100) : 0;
      progressBar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    }
  }

  function endConvertProgress(){
    if (progressWrap && progressBar){
      progressWrap.classList.remove("is-active");
      progressBar.style.width = "0%";
    }
    if (makeBtn){
      makeBtn.textContent = makeBtnLabel;
      makeBtn.disabled = (items.length === 0);
    }
  }

  function showToast(opts = {}){
    if (!toast) return;
    const title = typeof opts === "string" ? opts : (opts.title || "PDF ready");
    const sizeText = typeof opts === "object" ? opts.sizeText : "";
    const showDownload = typeof opts === "object" ? (opts.showDownload !== false) : true;

    if (toastTitle) toastTitle.textContent = title;
    if (toastSub){
      toastSub.textContent = sizeText ? `Size: ${sizeText}` : "";
      toastSub.style.display = sizeText ? "block" : "none";
    }
    if (toastDownload){
      toastDownload.style.display = showDownload ? "" : "none";
    }
    toast.classList.add("is-open");
    toast.setAttribute("aria-hidden", "false");
  }

  function hideToast(){
    if (!toast) return;
    toast.classList.remove("is-open");
    toast.setAttribute("aria-hidden", "true");
  }

  function triggerDownload(url, name){
    if (!url) return false;
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = name || "images.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    } catch (err){
      console.error("Download failed:", err);
      return false;
    }
  }

  qualityEl.addEventListener('input', () => {
    setQualityLabel();
  });
  if (fitButtons && fitButtons.length){
    fitButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        setFitMode(btn.dataset.fit);
        updateBadges();
      });
    });
    const pressed = Array.from(fitButtons).find(btn => btn.getAttribute("aria-pressed") === "true");
    setFitMode(pressed?.dataset?.fit || "fit");
  }
  if (marginEl){
    marginEl.addEventListener('input', () => {
      setMarginLabel();
      localStorage.setItem(MARGIN_KEY, marginEl.value);
      updateBadges();
    });
  }

  pageSizeEl.addEventListener('change', updateBadges);
  orientationEl.addEventListener('change', updateBadges);

  function addFiles(fileList){
    const files = Array.from(fileList || []).filter(f =>
      f && (f.type === "image/png" || f.type === "image/jpeg")
    );
    if (!files.length) { setStatus("No valid PNG/JPG files detected.", "bad"); return; }

    for (const f of files) {
      const url = URL.createObjectURL(f);
      items.push({ id: String(nextId++), file: f, url, rotate: 0 });
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

  function rotateItem(id, delta){
    const idx = items.findIndex(x => x.id === id);
    if (idx < 0) return;
    const cur = normalizeRotation(items[idx].rotate || 0);
    items[idx].rotate = normalizeRotation(cur + delta);
    render({ preserveStatus: true });
  }

  function moveItem(id, delta){
    const idx = items.findIndex(x => x.id === id);
    if (idx < 0) return;
    const next = idx + delta;
    if (next < 0 || next >= items.length) return;
    const [m] = items.splice(idx, 1);
    items.splice(next, 0, m);
    render({ preserveStatus: true });
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
    const rot = normalizeRotation(item.rotate || 0);
    const ghost = document.createElement("div");
    ghost.className = "dragGhost";
    ghost.innerHTML = `
      <div class="ghostCard">
        <img src="${item.url}" alt="" style="transform: rotate(${rot}deg);">
        <div style="min-width:0;">
          <div class="gTitle">${escapeHtml(item.file.name)}</div>
          <div class="gSub">${item.file.type.replace("image/","").toUpperCase()} \u2022 ${bytesToNice(item.file.size)}</div>
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
    const isMobileLayout = mobileMedia?.matches;
    items.forEach((it, idx) => {
      const row = document.createElement("div");
      row.className = "item";
      row.dataset.id = it.id;
      if (isMobileLayout) row.classList.add("is-mobile");

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
      const rot = normalizeRotation(it.rotate || 0);
      if (rot){
        img.style.transform = `rotate(${rot}deg)`;
        img.style.objectFit = "contain";
      } else {
        img.style.transform = "";
        img.style.objectFit = "";
      }

      const meta = document.createElement("div");
      meta.className = "meta";

      const name = document.createElement("div");
      name.className = "name";
      name.textContent = it.file.name;

      const small = document.createElement("div");
      small.className = "small";
      small.textContent = `${it.file.type.replace("image/","").toUpperCase()} \u2022 ${bytesToNice(it.file.size)}`;

      meta.appendChild(name);
      meta.appendChild(small);

      const actions = document.createElement("div");
      actions.className = "actions";

      const moveUp = document.createElement("button");
      moveUp.className = "btn icon";
      moveUp.setAttribute("aria-label", "Move up");
      moveUp.title = "Move up";
      moveUp.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M6 14l6-6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      moveUp.onclick = () => moveItem(it.id, -1);
      if (idx === 0) {
        moveUp.disabled = true;
        if (isMobileLayout) moveUp.classList.add("is-disabled");
      }

      const moveDown = document.createElement("button");
      moveDown.className = "btn icon";
      moveDown.setAttribute("aria-label", "Move down");
      moveDown.title = "Move down";
      moveDown.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M6 10l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      moveDown.onclick = () => moveItem(it.id, 1);
      if (idx === items.length - 1) {
        moveDown.disabled = true;
        if (isMobileLayout) moveDown.classList.add("is-disabled");
      }

      const rotLeft = document.createElement("button");
      rotLeft.className = "btn icon";
      rotLeft.setAttribute("aria-label", "Rotate left");
      rotLeft.title = "Rotate left";
      rotLeft.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M5 9H2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M2 9c2.2-3 5.7-4.9 9.5-4.9A8.5 8.5 0 1 1 3.5 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      rotLeft.onclick = () => rotateItem(it.id, -90);

      const rotRight = document.createElement("button");
      rotRight.className = "btn icon";
      rotRight.setAttribute("aria-label", "Rotate right");
      rotRight.title = "Rotate right";
      rotRight.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M19 9h3V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M22 9c-2.2-3-5.7-4.9-9.5-4.9A8.5 8.5 0 1 0 20.5 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      rotRight.onclick = () => rotateItem(it.id, 90);

      const del = document.createElement("button");
      del.className = "btn danger icon delBtn";
      del.setAttribute("aria-label", "Delete");
      del.title = "Delete";
      del.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 7h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M9 7V5h6v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <rect x="7" y="7" width="10" height="12" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
          <path d="M10 11v5M14 11v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      `;
      del.onclick = () => removeItem(it.id);

      actions.appendChild(moveUp);
      actions.appendChild(moveDown);
      actions.appendChild(rotLeft);
      actions.appendChild(rotRight);
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
    if (convertHint) convertHint.hidden = hasItems;
    updateKeepPngAvailability();
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

  function imageToDataURL(img, mime, quality, rotateDeg){
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    const maxEdge = Math.max(w, h);
    if (maxEdge > 3000){
      const scale = 3000 / maxEdge;
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    const rot = normalizeRotation(rotateDeg || 0);
    const swap = rot === 90 || rot === 270;
    const canvas = document.createElement("canvas");
    canvas.width = swap ? h : w;
    canvas.height = swap ? w : h;
    const ctx = canvas.getContext("2d", { alpha: true });

    if (mime === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0,0,canvas.width,canvas.height);
    }
    if (rot){
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    } else {
      ctx.drawImage(img, 0, 0, w, h);
    }

    if (mime === "image/png") return canvas.toDataURL("image/png");
    return canvas.toDataURL("image/jpeg", quality);
  }

  function mmToPt(mm){
    return mm * 72 / 25.4;
  }

  function clampMarginPt(marginPt, pageW, pageH){
    const max = Math.max(0, (Math.min(pageW, pageH) / 2) - 1);
    return Math.min(Math.max(0, marginPt), max);
  }

  makeBtn.addEventListener("click", async () => {
    if (!items.length) return;

    hideToast();
    if (lastPdfUrl){
      URL.revokeObjectURL(lastPdfUrl);
      lastPdfUrl = null;
    }
    setStatus("", "");
    makeBtn.disabled = true;
    setConvertProgress(0, items.length);

    try {
      const marginMm = getMarginMm();
      const marginPtRaw = mmToPt(marginMm);
      const size = pageSizeEl.value;
      const orientChoice = orientationEl.value; // auto | p | l
      const fitMode = getFitMode();
      const jpgQ = Number(qualityEl.value);
      const keepPng = keepPngEl.checked;

      const baseOrient = (orientChoice === "l") ? "landscape" : "portrait";
      const pdf = new jsPDF({ unit: "pt", format: size, orientation: baseOrient });

      let firstPageUsed = false;

      for (let i = 0; i < items.length; i++) {
        setConvertProgress(i + 1, items.length);
        setStatus(`Converting\u2026 (${i + 1}/${items.length})`, "");

        const it = items[i];
        const img = await loadImage(it.url);

        const rotation = normalizeRotation(it.rotate || 0);
        const rotated = getRotatedDims(img.naturalWidth, img.naturalHeight, rotation);
        const imgW = rotated.w;
        const imgH = rotated.h;

        let pageOrient = "p";
        if (orientChoice === "auto") pageOrient = (imgW > imgH) ? "l" : "p";
        else pageOrient = orientChoice;

        const page = getPageDims(size, pageOrient);
        const pageW = page.w, pageH = page.h;
        const margin = clampMarginPt(marginPtRaw, pageW, pageH);

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
        const scale = (fitMode === "fill")
          ? Math.max(maxW / imgW, maxH / imgH)
          : Math.min(maxW / imgW, maxH / imgH);

        const drawW = imgW * scale;
        const drawH = imgH * scale;
        const x = (pageW - drawW) / 2;
        const y = (pageH - drawH) / 2;

        const usePng = keepPng && it.file.type === "image/png";
        const mime = usePng ? "image/png" : "image/jpeg";
        const dataUrl = imageToDataURL(img, mime, jpgQ, rotation);

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

      const blob = pdf.output("blob");
      const sizeText = bytesToNice(blob.size);
      lastPdfUrl = URL.createObjectURL(blob);
      lastPdfName = outName;
      const downloadOk = triggerDownload(lastPdfUrl, lastPdfName);
      showToast({
        title: downloadOk ? "PDF ready" : "Download blocked",
        sizeText,
        showDownload: !downloadOk
      });
      setStatus(`Done: ${outName}`, "ok");
    } catch (err) {
      console.error(err);
      setStatus("Failed to generate PDF. Try smaller images or fewer at a time.", "bad");
    } finally {
      endConvertProgress();
    }
  });

  // Init
  setQualityLabel();
  initMargin();
  updateBadges();
  render();

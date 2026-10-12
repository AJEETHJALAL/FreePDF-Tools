(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const state = { images: [], merge: [], split: null, tojpg: null, busy: false };
  const status = $("status"), progressWrap = $("progressWrap"), progressBar = $("progressBar");
  const { PDFDocument } = PDFLib;
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }
  $("year").textContent = new Date().getFullYear();

  // When changing tools we clear the UI state for a fresh task (avoids needing a page refresh)
  document.querySelectorAll(".tool-tab").forEach(btn => btn.addEventListener("click", () => {
    // reset per-tool UI/state so switching tasks doesn't require a manual refresh
    clearToolState();
    document.querySelectorAll(".tool-tab").forEach(b => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".tool-panel").forEach(p => p.classList.toggle("active", p.id === "panel-" + btn.dataset.tool));
    clearStatus();
  }));

  function clearStatus() { status.textContent = ""; status.className = "status"; progressWrap.hidden = true; progressBar.style.width = "0"; }
  function message(text, type = "") { status.textContent = text; status.className = "status " + type; }
  function busy(on) {
    state.busy = on;
    document.querySelectorAll(".primary").forEach(b => { if (on) { b.dataset.wasDisabled = b.disabled ? "1" : "0"; b.disabled = true; } else if (b.dataset.wasDisabled !== undefined) { b.disabled = b.dataset.wasDisabled === "1"; delete b.dataset.wasDisabled; } });
    if (on) { progressWrap.hidden = false; progressBar.style.width = "12%"; }
    else { progressWrap.hidden = true; progressBar.style.width = "0"; }
  }
  function setProgress(p) { progressWrap.hidden = false; progressBar.style.width = Math.max(0, Math.min(100, p)) + "%"; }
  function formatBytes(n) { if (n < 1024) return n + " B"; if (n < 1024*1024) return (n/1024).toFixed(1)+" KB"; return (n/1024/1024).toFixed(1)+" MB"; }
  function safeName(name) { return (name || "document").replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_").slice(0, 90) || "document"; }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = filename; a.style.display = "none";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function renderFiles(container, files, remove) {
    container.innerHTML = "";
    files.forEach((f, i) => {
      const row = document.createElement("div"); row.className = "file-row";
      const name = document.createElement("span"); name.className = "file-name"; name.textContent = "📄 " + f.name;
      const size = document.createElement("span"); size.className = "file-size"; size.textContent = formatBytes(f.size);
      const btn = document.createElement("button"); btn.className = "remove-file"; btn.type = "button"; btn.textContent = "Remove"; btn.setAttribute("aria-label", "Remove " + f.name);
      btn.addEventListener("click", () => remove(i));
      row.append(name, size, btn); container.appendChild(row);
    });
  }
  function checkPDF(file) { return file && (file.type === "application/pdf" || /\.pdf$/i.test(file.name)); }
  function checkImage(file) { return file && (/^image\/(jpeg|png)$/.test(file.type) || /\.(jpe?g|png)$/i.test(file.name)); }

  // --- IMAGE -> PDF ---
  $("imageFiles").addEventListener("change", e => {
    clearStatus();
    const incoming = [...e.target.files].filter(checkImage);
    state.images = [...state.images, ...incoming];
    e.target.value = "";
    updateImages();
  });
  function updateImages() { renderFiles($("imageList"), state.images, i => { state.images.splice(i,1); updateImages(); }); $("imagesConvert").disabled = !state.images.length || state.busy; }
  $("imagesConvert").addEventListener("click", async () => {
    if (!state.images.length) return;
    try {
      busy(true); message("Creating your PDF…");
      const pdf = await PDFDocument.create();
      for (let i=0; i<state.images.length; i++) {
        const file = state.images[i], bytes = await file.arrayBuffer();
        const image = /\.png$/i.test(file.name) || file.type === "image/png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
        const page = pdf.addPage([image.width, image.height]);
        page.drawImage(image, { x:0, y:0, width:image.width, height:image.height });
        setProgress(15 + ((i+1)/state.images.length)*75);
      }
      const bytes = await pdf.save();
      downloadBlob(new Blob([bytes], {type:"application/pdf"}), "images-converted.pdf");
      message("Done — your PDF download should begin now.", "success");
    } catch (err) { message("Could not convert these images. Try JPG or PNG files and check available device memory.", "error"); console.error(err); }
    finally { busy(false); updateImages(); }
  });

  // --- MERGE PDFs ---
  $("mergeFiles").addEventListener("change", e => {
    clearStatus(); state.merge = [...state.merge, ...[...e.target.files].filter(checkPDF)];
    e.target.value = ""; updateMerge();
  });
  function updateMerge() {
    renderFiles($("mergeList"), state.merge, i => { state.merge.splice(i,1); updateMerge(); });
    $("mergeConvert").disabled = state.merge.length < 2 || state.busy;
  }
  $("mergeConvert").addEventListener("click", async () => {
    if (state.merge.length < 2) return;
    try {
      busy(true); message("Merging PDFs…");
      const out = await PDFDocument.create();
      for (let i=0; i<state.merge.length; i++) {
        const src = await PDFDocument.load(await state.merge[i].arrayBuffer());
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach(p => out.addPage(p));
        setProgress(10 + ((i+1)/state.merge.length)*80);
      }
      downloadBlob(new Blob([await out.save()], {type:"application/pdf"}), "merged.pdf");
      message("Done — your merged PDF download should begin now.", "success");
    } catch (err) { message("Merge failed. The PDF may be password-protected, damaged, or too large for this device.", "error"); console.error(err); }
    finally { busy(false); updateMerge(); }
  });

  // --- SPLIT PDF ---
  $("splitFile").addEventListener("change", async e => {
    await handleSplitFile([...e.target.files][0]);
    e.target.value = "";
  });

  async function handleSplitFile(f) {
    clearStatus();
    state.split = checkPDF(f) ? f : null;
    $("splitInfo").textContent = ""; $("pageRanges").value = ""; $("pageRanges").disabled = true; $("splitConvert").disabled = true;
    if (!state.split) { if (f) message("Please choose a PDF file.", "error"); return; }
    $("splitInfo").textContent = state.split.name + " · " + formatBytes(state.split.size);
    try {
      const doc = await PDFDocument.load(await state.split.arrayBuffer());
      $("splitInfo").textContent += " · " + doc.getPageCount() + " pages";
      $("pageRanges").disabled = false; $("pageRanges").placeholder = "1-" + doc.getPageCount() + " (all pages)";
      $("splitConvert").disabled = false;
      $("splitConvert").dataset.pageCount = String(doc.getPageCount());
    } catch (err) { state.split = null; message("Could not read this PDF. It may be encrypted or damaged.", "error"); }
  }

  function parseRanges(input, count) {
    const selected = new Set();
    const parts = input.trim() ? input.split(",") : [`1-${count}`];
    for (const raw of parts) {
      const part = raw.trim(); if (!part) continue;
      const m = part.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
      if (!m) throw new Error("Enter pages like 1-3,5,8-10.");
      const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
      if (a < 1 || b < a || b > count) throw new Error("Page numbers must be between 1 and " + count + ".");
      for (let p=a; p<=b; p++) selected.add(p-1);
    }
    if (!selected.size) throw new Error("Enter at least one page number.");
    return [...selected].sort((a,b)=>a-b);
  }
  $("splitConvert").addEventListener("click", async () => {
    if (!state.split) return;
    try {
      busy(true); message("Extracting pages…");
      const src = await PDFDocument.load(await state.split.arrayBuffer());
      const indices = parseRanges($("pageRanges").value, src.getPageCount());
      const out = await PDFDocument.create();
      const pages = await out.copyPages(src, indices); pages.forEach(p => out.addPage(p));
      setProgress(85);
      downloadBlob(new Blob([await out.save()], {type:"application/pdf"}), safeName(state.split.name)+"-pages.pdf");
      message("Done — your extracted PDF download should begin now.", "success");
    } catch (err) { message(err.message || "Could not split this PDF.", "error"); console.error(err); }
    finally { busy(false); $("splitConvert").disabled = !state.split; }
  });

  // --- PDF -> JPG ---
  $("tojpgFile").addEventListener("change", e => {
    clearStatus(); const f = [...e.target.files][0]; e.target.value = "";
    state.tojpg = checkPDF(f) ? f : null;
    $("tojpgInfo").textContent = state.tojpg ? state.tojpg.name + " · " + formatBytes(state.tojpg.size) : "";
    $("tojpgConvert").disabled = !state.tojpg || state.busy;
    if (f && !state.tojpg) message("Please choose a PDF file.", "error");
  });
  $("tojpgConvert").addEventListener("click", async () => {
    if (!state.tojpg) return;
    try {
      busy(true); message("Preparing PDF pages…");
      const bytes = await state.tojpg.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({data: new Uint8Array(bytes)});
      const pdf = await loadingTask.promise;
      const zip = new JSZip(), quality = Number($("jpgQuality").value);
      for (let i=1; i<=pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({scale:1.6});
        const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        await page.render({canvasContext:ctx, viewport}).promise;
        const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
        if (!blob) throw new Error("Your browser could not create a JPG image.");
        zip.file("page-" + String(i).padStart(3,"0") + ".jpg", blob);
        canvas.width = 0; canvas.height = 0;
        setProgress(10 + (i/pdf.numPages)*75);
      }
      message("Packing images into a ZIP file…");
      const zipped = await zip.generateAsync({type:"blob"});
      downloadBlob(zipped, safeName(state.tojpg.name)+"-jpg-pages.zip");
      message("Done — your JPG images are inside the downloaded ZIP file.", "success");
      await loadingTask.destroy();
    } catch (err) { message("Conversion failed. Try a smaller PDF or a device with more free memory.", "error"); console.error(err); }
    finally { busy(false); $("tojpgConvert").disabled = !state.tojpg; }
  });

  // --- Drag & Drop support for desktop ---
  function bindDropzones() {
    document.querySelectorAll('.dropzone').forEach(label => {
      const targetId = label.getAttribute('for');
      if (!targetId) return;
      label.addEventListener('dragenter', e => { e.preventDefault(); label.classList.add('dragover'); });
      label.addEventListener('dragover', e => { e.preventDefault(); });
      ['dragleave','dragend','drop'].forEach(evt => label.addEventListener(evt, e => { e.preventDefault(); label.classList.remove('dragover'); }));
      label.addEventListener('drop', e => {
        e.preventDefault(); const dt = e.dataTransfer; if (!dt || !dt.files || !dt.files.length) return;
        handleDropFor(targetId, Array.from(dt.files));
      });
    });
  }

  async function handleDropFor(targetId, files) {
    if (targetId === 'imageFiles') {
      const incoming = files.filter(checkImage);
      if (!incoming.length) { message('No supported images were dropped.', 'error'); return; }
      state.images = [...state.images, ...incoming]; updateImages();
    } else if (targetId === 'mergeFiles') {
      const incoming = files.filter(checkPDF);
      if (!incoming.length) { message('No PDF files were dropped.', 'error'); return; }
      state.merge = [...state.merge, ...incoming]; updateMerge();
    } else if (targetId === 'splitFile') {
      const f = files.find(checkPDF);
      if (!f) { message('No PDF file was dropped.', 'error'); return; }
      await handleSplitFile(f);
    } else if (targetId === 'tojpgFile') {
      const f = files.find(checkPDF);
      if (!f) { message('No PDF file was dropped.', 'error'); return; }
      clearStatus(); state.tojpg = f; $("tojpgInfo").textContent = state.tojpg ? state.tojpg.name + " · " + formatBytes(state.tojpg.size) : ""; $("tojpgConvert").disabled = !state.tojpg || state.busy;
    }
  }

  // Clear all tool-specific state when switching tools so the UI is fresh
  function clearToolState() {
    // clear image list
    state.images = [];
    state.merge = [];
    state.split = null;
    state.tojpg = null;
    // reset inputs and UI blocks
    try { $("imageFiles").value = ""; $("mergeFiles").value = ""; $("splitFile").value = ""; $("tojpgFile").value = ""; } catch(e){}
    updateImages(); updateMerge();
    $("splitInfo").textContent = ""; $("pageRanges").value = ""; $("pageRanges").disabled = true; $("splitConvert").disabled = true;
    $("tojpgInfo").textContent = ""; $("tojpgConvert").disabled = true;
    clearStatus();
  }

  // Initialize drag/drop bindings and initial states
  bindDropzones();
  // Make buttons disabled when no files are selected and avoid accidental duplicate clicks.
  updateImages(); updateMerge();
})();

// Logic App endpoints — injected by CI/CD from GitHub secrets via envsubst
const LA_LIST_ALL_PETS = '${LA_LIST_ALL_PETS}';
const LA_CREATE_PET = '${LA_CREATE_PET}';
const LA_UPDATE_PET = '${LA_UPDATE_PET}';
const LA_DELETE_PET = '${LA_DELETE_PET}';

// ── State ─────────────────────────────────────────────────────────────────────
let allAssets       = [];
let activeFilter    = 'all';
let selectedFile    = null;
let currentEditId   = null;
let pendingDeleteId = null;

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const el = Object.assign(document.createElement('div'), {
    className: `nx-toast ${type}`,
    innerHTML: `<span class="toast-dot"></span>${msg}`,
  });
  document.getElementById('toastStack').appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ── Modals ────────────────────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id + 'Overlay').classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id + 'Overlay').classList.add('hidden'); }

// ── Drag & Drop / file select ─────────────────────────────────────────────────
const dropZone  = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

dropZone.addEventListener('click', e => {
  if (e.target.tagName !== 'LABEL' && e.target.tagName !== 'INPUT') fileInput.click();
});
dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', e => { if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('drag-over'); });
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => { if (fileInput.files[0]) setFile(fileInput.files[0]); });
document.getElementById('clearFileBtn').addEventListener('click', e => { e.stopPropagation(); clearFile(); });

function setFile(file) {
  selectedFile = file;
  document.getElementById('dropDefault').classList.add('d-none');
  document.getElementById('dropPreview').classList.remove('d-none');
  document.getElementById('previewName').textContent = file.name;
  document.getElementById('previewMeta').textContent = `${fmtSize(file.size)} · ${file.type || 'unknown'}`;

  const thumb = document.getElementById('previewThumb');
  if (file.type.startsWith('image/')) {
    thumb.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="preview" />`;
  } else if (file.type.startsWith('video/')) {
    thumb.innerHTML = `<video src="${URL.createObjectURL(file)}" style="width:100%;height:100%;object-fit:cover"></video>`;
  } else {
    thumb.innerHTML = `<span class="dz-pv-icon">${typeEmoji(file.type)}</span>`;
  }
  dropZone.classList.add('has-file');
  document.getElementById('uploadBtn').disabled = false;
}

function clearFile() {
  selectedFile = null;
  fileInput.value = '';
  document.getElementById('dropDefault').classList.remove('d-none');
  document.getElementById('dropPreview').classList.add('d-none');
  dropZone.classList.remove('has-file');
  document.getElementById('uploadBtn').disabled = true;
}

// ── Upload ────────────────────────────────────────────────────────────────────
document.getElementById('uploadBtn').addEventListener('click', async () => {
  const petName = document.getElementById('petName').value.trim();
  const ownerName = document.getElementById('ownerName').value.trim();
  if (!selectedFile) return toast('Select a file first', 'danger');
  if (!petName)      return toast('Enter a Pet Name', 'danger');
  if (!ownerName)    return toast('Enter Owner Name', 'danger');

  document.getElementById('uploadBtn').disabled = true;
  document.getElementById('uploadProgress').classList.remove('d-none');

  try {
    const fileContent = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(selectedFile);
    });

    const res = await fetch(LA_CREATE_PET, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName:    selectedFile.name,
        userID:      ownerName,
        contentType: selectedFile.type || 'application/octet-stream',
        fileContent,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    toast('Uploaded successfully');
    clearFile();
    document.getElementById('petName').value = '';
    document.getElementById('ownerName').value = '';
    loadGallery();
  } catch (e) {
    toast(e.message, 'danger');
  } finally {
    document.getElementById('uploadBtn').disabled = false;
    document.getElementById('uploadProgress').classList.add('d-none');
  }
});

// ── Stats ─────────────────────────────────────────────────────────────────────
function updateStats(items) {
  const counts = { total: items.length, image: 0, video: 0, other: 0 };
  for (const a of items) {
    const t = a.contentType || '';
    if (t.startsWith('image/'))      counts.image++;
    else if (t.startsWith('video/')) counts.video++;
    else                              counts.other++;
  }
  const totalEl = document.querySelector('#statTotal .stat-num');
  const imagesEl = document.querySelector('#statImages .stat-num');
  const videosEl = document.querySelector('#statVideos .stat-num');
  const otherEl = document.querySelector('#statOther .stat-num');
  if (totalEl) totalEl.textContent = counts.total;
  if (imagesEl) imagesEl.textContent = counts.image;
  if (videosEl) videosEl.textContent = counts.video;
  if (otherEl) otherEl.textContent = counts.other;
}

// ── Gallery ───────────────────────────────────────────────────────────────────
async function loadGallery() {
  renderSkeletons();
  try {
    const res = await fetch(LA_LIST_ALL_PETS);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allAssets = await res.json();
    updateStats(allAssets);
    applyFilter();
  } catch (e) {
    document.getElementById('gallery').innerHTML =
      `<div class="empty-state">
        <div class="empty-icon"><i class="bi bi-wifi-off"></i></div>
        <div class="empty-title">Could not load gallery</div>
        <div class="empty-sub">${e.message}</div>
      </div>`;
  }
}

function applyFilter() {
  let items = [...allAssets];
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  if (q) items = items.filter(a =>
    a.fileName?.toLowerCase().includes(q) || a.userID?.toLowerCase().includes(q));
  if (activeFilter !== 'all') items = items.filter(a => {
    const t = a.contentType || '';
    if (activeFilter === 'image') return t.startsWith('image/');
    if (activeFilter === 'video') return t.startsWith('video/');
    return !t.startsWith('image/') && !t.startsWith('video/');
  });
  renderGallery(items);
}

function setFilter(f, btn) {
  activeFilter = f;
  document.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyFilter();
}

document.getElementById('searchInput').addEventListener('input', applyFilter);

function renderSkeletons() {
  const g = document.getElementById('gallery');
  g.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const d = document.createElement('div');
    d.className = 'pet-card';
    d.innerHTML = `<div class="skel" style="padding-top:75%;border-radius:0"></div>
      <div style="padding:.75rem .9rem">
        <div class="skel" style="height:12px;width:65%;margin-bottom:6px"></div>
        <div class="skel" style="height:10px;width:40%"></div>
      </div>`;
    g.appendChild(d);
  }
}

function renderGallery(items) {
  const g = document.getElementById('gallery');
  if (!items.length) {
    g.innerHTML = `<div class="empty-state">
      <div class="empty-icon"><i class="bi bi-images"></i></div>
      <div class="empty-title">Nothing here yet</div>
      <div class="empty-sub">Upload a file above to get started</div>
    </div>`;
    return;
  }

  g.innerHTML = items.map(item => {
    const isImg   = item.contentType?.startsWith('image/');
    const isVideo = item.contentType?.startsWith('video/');
    const isAudio = item.contentType?.startsWith('audio/');
    const mediaType = isImg ? 'image' : isVideo ? 'video' : isAudio ? 'audio' : null;
    const mediaClick = mediaType
      ? `onclick="openLightbox('${item.fileLocator}','${esc(item.fileName)}','${mediaType}')" style="cursor:pointer"`
      : '';
    const [pillLabel, pillCls] = typePill(item.contentType);
    return `
    <div class="pet-card">
      <div class="card-media" ${mediaClick}>
        ${mediaHtml(item)}
        <span class="type-pill ${pillCls}">${pillLabel}</span>
        <div class="card-overlay">
          <button class="co-btn" onclick="event.stopPropagation();openEdit('${item.id}','${esc(item.fileName)}','${esc(item.userID)}')">
            <i class="bi bi-pencil"></i>Edit
          </button>
          <button class="co-btn del" onclick="event.stopPropagation();confirmDelete('${item.id}','${esc(item.fileName)}')">
            <i class="bi bi-trash"></i>Delete
          </button>
        </div>
      </div>
      <div class="card-info">
        <div class="card-name" title="${esc(item.fileName)}">${esc(item.fileName)}</div>
        <div class="card-user"><i class="bi bi-person"></i>${esc(item.userID)}</div>
      </div>
    </div>`;
  }).join('');
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function openLightbox(src, alt, type = 'image') {
  const img = document.getElementById('lightboxImg');
  const vid = document.getElementById('lightboxVideo');
  img.classList.add('hidden');
  vid.classList.add('hidden');
  if (type === 'video') {
    vid.src = src;
    vid.classList.remove('hidden');
  } else {
    img.src = src;
    img.alt = alt;
    img.classList.remove('hidden');
  }
  document.getElementById('lightbox').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  const vid = document.getElementById('lightboxVideo');
  vid.pause(); vid.src = '';
  document.getElementById('lightboxImg').src = '';
  document.getElementById('lightbox').classList.add('hidden');
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeLightbox(); closeModal('edit'); closeModal('delete'); }
});

// ── Edit ──────────────────────────────────────────────────────────────────────
function openEdit(id, fileName, userID) {
  currentEditId = id;
  document.getElementById('editPetName').value = fileName;
  document.getElementById('editOwnerName').value = userID;
  openModal('edit');
}
document.getElementById('saveEditBtn').addEventListener('click', async () => {
  if (!currentEditId) return;
  const btn = document.getElementById('saveEditBtn');
  btn.disabled = true;
  try {
    const res = await fetch(LA_UPDATE_PET, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id:       currentEditId,
        fileName: document.getElementById('editPetName').value.trim(),
        userID:   document.getElementById('editOwnerName').value.trim(),
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    closeModal('edit');
    toast('Saved');
    loadGallery();
  } catch (e) { toast(e.message, 'danger'); }
  finally { btn.disabled = false; }
});

// ── Delete ────────────────────────────────────────────────────────────────────
function confirmDelete(id, fileName) {
  pendingDeleteId = id;
  document.getElementById('deleteModalName').textContent = fileName;
  openModal('delete');
}
document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
  if (!pendingDeleteId) return;
  const btn = document.getElementById('confirmDeleteBtn');
  btn.disabled = true;
  try {
    const res = await fetch(LA_DELETE_PET, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pendingDeleteId }),
    });
    if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
    closeModal('delete');
    toast('Deleted');
    loadGallery();
  } catch (e) { toast(e.message, 'danger'); }
  finally { btn.disabled = false; pendingDeleteId = null; }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function mediaHtml(item) {
  if (item.contentType?.startsWith('image/'))
    return `<img src="${item.fileLocator}" alt="${esc(item.fileName)}" loading="lazy" />`;
  if (item.contentType?.startsWith('video/'))
    return `<video src="${item.fileLocator}" preload="none" style="pointer-events:none"></video>
            <div class="media-play-icon"><i class="bi bi-play-circle-fill"></i></div>`;
  if (item.contentType?.startsWith('audio/'))
    return `<div class="card-placeholder audio-bg"><i class="bi bi-music-note-beamed"></i></div>
            <div class="media-play-icon"><i class="bi bi-play-circle-fill"></i></div>`;
  return `<div class="card-placeholder">${typeEmoji(item.contentType)}</div>`;
}

function typeEmoji(mime = '') {
  if (mime.startsWith('video/'))              return '🎬';
  if (mime.startsWith('audio/'))              return '🎵';
  if (mime === 'application/pdf')             return '📄';
  if (mime.includes('word') || mime === 'application/msword') return '📝';
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime === 'text/csv') return '📊';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return '📊';
  if (mime.startsWith('text/'))               return '📋';
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z') || mime.includes('tar')) return '🗜️';
  if (mime.startsWith('model/'))              return '🧊';
  return '📁';
}

function typePill(mime = '') {
  if (mime.startsWith('image/'))  return ['Image',   ''];
  if (mime.startsWith('video/'))  return ['Video',   'tp-video'];
  if (mime.startsWith('audio/'))  return ['Audio',   'tp-audio'];
  if (mime === 'application/pdf') return ['PDF',     'tp-pdf'];
  if (mime.includes('word') || mime === 'application/msword') return ['Doc', 'tp-doc'];
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime === 'text/csv') return ['Sheet', 'tp-sheet'];
  if (mime.includes('presentation') || mime.includes('powerpoint')) return ['Slides', 'tp-ppt'];
  if (mime.startsWith('text/'))   return ['Text',    'tp-text'];
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z') || mime.includes('tar')) return ['Archive', 'tp-archive'];
  if (mime.startsWith('model/'))  return ['3D',      'tp-3d'];
  return ['File', ''];
}

function fmtSize(b) {
  if (b < 1024)    return `${b} B`;
  if (b < 1048576) return `${(b/1024).toFixed(1)} KB`;
  return `${(b/1048576).toFixed(1)} MB`;
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadGallery();

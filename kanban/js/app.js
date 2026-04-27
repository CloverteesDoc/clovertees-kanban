// ============================================================
//  CLOVERTEES P4 — app.js  (State + Rendering + Events)
// ============================================================

// ── STATE ─────────────────────────────────────────────────────
var S = {
  projects: [], columns: [], tasks: [],
  comments: [], activity: [],
  activeProjectId: null,
  openTaskId: null,
  dragTaskId: null,
  role: 'team',
  name: '',
};

// Pending image attachments for current comment
var pendingImages = []; // [{dataUrl: string}]

// ── GETTERS ───────────────────────────────────────────────────
function projCols(pid){ return S.columns.filter(function(c){return c.projectId===pid;}).sort(function(a,b){return parseInt(a.pos)-parseInt(b.pos);}); }
// Newest first (fallback to array index if identical timestamps)
function colTasks(cid){ 
  return S.tasks.filter(function(t){return t.columnId===cid;})
    .sort(function(a,b){ 
      var da=new Date(a.createdAt||0), db=new Date(b.createdAt||0); 
      if(db.getTime() === da.getTime()) return S.tasks.indexOf(b) - S.tasks.indexOf(a);
      return db-da; 
    }); 
}

function getLatestTaskImage(taskId) {
  var cmts = taskComments(taskId); // sorted oldest first
  for (var i = cmts.length - 1; i >= 0; i--) {
    var text = cmts[i].text || '';
    // Check custom attachment
    var match = text.match(/\[IMG\]([\s\S]*?)\[\/IMG\]/);
    if (match && match[1]) return match[1];
    
    // Check Google Drive link
    var driveMatch = text.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      // Use Google Drive thumbnail API
      return 'https://drive.google.com/thumbnail?id=' + driveMatch[1] + '&sz=w600';
    }
  }
  return null;
}
function findTask(id){ return S.tasks.find(function(t){return t.id===id;}); }
function findCol(id){ return S.columns.find(function(c){return c.id===id;}); }
function isAdmin(){ return S.role === 'admin'; }
function taskComments(tid){ return S.comments.filter(function(c){return c.taskId===tid;}).sort(function(a,b){return new Date(a.createdAt)-new Date(b.createdAt);}); }
function taskActivity(tid){ return S.activity.filter(function(a){return a.taskId===tid;}).sort(function(a,b){return new Date(b.createdAt)-new Date(a.createdAt);}); }

// ── BOOT ──────────────────────────────────────────────────────
function boot() {
  S.role = localStorage.getItem('clv_role') || 'team';
  S.name = localStorage.getItem('clv_name') || '';
  setSyncBusy(true);
  API.getAll().then(function(data){
    setSyncBusy(false);
    if(!data.success){ toast('❌ Gagal memuat: '+data.error,'err'); return; }
    S.projects = data.projects || [];
    
    // Sort projects by newest first so the default active project is the newest
    S.projects.sort(function(a, b) {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
    
    S.columns  = data.columns  || [];
    S.tasks    = data.tasks    || [];
    S.comments = data.comments || [];
    S.activity = data.activity || [];
    if(S.projects.length) setActiveProject(S.projects[0].id);
    else renderSidebar();
  }).catch(function(e){ setSyncBusy(false); toast('❌ '+e.message,'err'); });
}

// ── ACTIVE PROJECT ────────────────────────────────────────────
function setActiveProject(pid) {
  S.activeProjectId = pid;
  S.openTaskId = null;
  renderSidebar();
  renderHeader();
  renderBoard();
  closePanel();
}

// ── SIDEBAR ───────────────────────────────────────────────────
function renderSidebar() {
  var el = document.getElementById('sidebarProjects');
  
  // Urutkan proyek dari yang terbaru ke terlama
  S.projects.sort(function(a, b) {
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
  
  el.innerHTML = S.projects.map(function(p){
    var active = p.id === S.activeProjectId;
    return '<div class="sidebar-item'+(active?' active':'')+'" onclick="setActiveProject(\''+esc(p.id)+'\')" data-pid="'+esc(p.id)+'">' +
      '<span class="proj-dot" style="background:'+esc(p.color||'#2d6a4f')+'"></span>' +
      '<span class="proj-name">'+esc(p.name||'Proyek')+'</span>' +
      (isAdmin() ? '<span class="card-act-btn" style="opacity:.5" onclick="event.stopPropagation();projMenu(event,\''+esc(p.id)+'\')">···</span>' : '') +
    '</div>';
  }).join('');
}

// ── HEADER ────────────────────────────────────────────────────
function renderHeader() {
  var p = S.projects.find(function(x){return x.id===S.activeProjectId;});
  var titleEl = document.getElementById('projTitle');
  titleEl.textContent = p ? p.name : '';
  titleEl.dataset.pid = p ? p.id : '';
}

// ── BOARD ─────────────────────────────────────────────────────
function renderBoard() {
  var board = document.getElementById('board');
  board.innerHTML = '';
  if (!S.activeProjectId) { board.innerHTML = '<div style="padding:40px;color:var(--text-3)">Pilih atau buat proyek di sidebar.</div>'; return; }
  var cols = projCols(S.activeProjectId);
  cols.forEach(function(col){ board.appendChild(buildCol(col)); });
  // Add column button
  var addCol = document.createElement('div');
  addCol.className = 'col-new';
  addCol.innerHTML = '<span style="font-size:1.3rem">+</span><span>Tambah Kolom</span>';
  if(isAdmin()) addCol.onclick = function(){ promptNewCol(S.activeProjectId); };
  else addCol.style.display = 'none';
  board.appendChild(addCol);
  setupDropZones();
}

// ── BUILD COLUMN ──────────────────────────────────────────────
function buildCol(col) {
  var el = document.createElement('div');
  el.className = 'col'; el.dataset.colId = col.id;
  var tasks = colTasks(col.id);
  var colColor = CLV.COL_COLORS[col.name] || col.color || '#6b7280';

  el.innerHTML =
    '<div class="col-header">' +
      '<span class="col-dot" style="background:'+colColor+'"></span>' +
      '<span class="col-name" contenteditable="'+(isAdmin()?'true':'false')+'" ' +
        'data-cid="'+esc(col.id)+'" onblur="onColRename(this)" onkeydown="if(event.key===\'Enter\'){event.preventDefault();this.blur()}">' +
        esc(col.name) + '</span>' +
      '<span class="col-count">'+tasks.length+'</span>' +
      (isAdmin() ? '<span class="col-menu-btn" onclick="colMenu(event,\''+esc(col.id)+'\')">···</span>' : '') +
    '</div>' +
    '<div class="col-cards" data-col-id="'+esc(col.id)+'"></div>' +
    (isAdmin() ? '<div class="add-task-wrap" id="atw-'+esc(col.id)+'"><button class="btn-add-open" onclick="openAddTask(\''+esc(col.id)+'\')">＋ Tambah tugas</button></div>' : '');

  var cardList = el.querySelector('.col-cards');
  if(tasks.length === 0) cardList.innerHTML = '<div class="empty-col">Belum ada tugas</div>';
  else tasks.forEach(function(t,i){ cardList.appendChild(buildCard(t,i)); });

  return el;
}

// ── BUILD CARD ────────────────────────────────────────────────
function buildCard(task, idx) {
  var el = document.createElement('div');
  el.className = 'card'; el.dataset.taskId = task.id;
  el.setAttribute('draggable','true');
  el.style.animationDelay = (idx*0.03)+'s';

  var col = findCol(task.columnId);
  var colColor = col ? (CLV.COL_COLORS[col.name] || col.color || '#6b7280') : '#6b7280';
  el.style.borderLeft = '3px solid '+colColor;

  var meta = '';
  if(task.priority) meta += '<span class="card-tag '+(task.priority==='High'?'orange':task.priority==='Low'?'blue':'')+'">'+esc(task.priority)+'</span>';
  if(task.dueDate)  meta += '<span class="card-due">📅 '+esc(fmtDate(task.dueDate))+'</span>';
  if(task.sourceId) meta += '<span class="card-source">📦 Order</span>';

  var latestImg = getLatestTaskImage(task.id);
  var imgHtml = latestImg ? '<div class="card-thumb"><img src="'+latestImg+'" alt="Thumbnail" loading="lazy"></div>' : '';

  el.innerHTML =
    imgHtml +
    '<div class="card-title">'+esc(task.title||'—')+'</div>' +
    (meta ? '<div class="card-meta">'+meta+'</div>' : '') +
    '<div class="card-actions-hover">' +
      '<span class="card-act-btn del" title="Hapus" onclick="event.stopPropagation();delTask(\''+esc(task.id)+'\')">🗑</span>' +
    '</div>';

  el.onclick = function(e){ if(!e.target.classList.contains('card-act-btn')) openPanel(task.id); };
  el.addEventListener('dragstart', function(e){ S.dragTaskId=task.id; el.classList.add('dragging'); e.dataTransfer.effectAllowed='move'; });
  el.addEventListener('dragend',   function(){ el.classList.remove('dragging'); S.dragTaskId=null; });
  return el;
}

// ── DRAG & DROP ───────────────────────────────────────────────
function setupDropZones() {
  document.querySelectorAll('.col-cards').forEach(function(zone){
    zone.addEventListener('dragover', function(e){ e.preventDefault(); zone.closest('.col').classList.add('drag-over'); });
    zone.addEventListener('dragleave', function(){ zone.closest('.col').classList.remove('drag-over'); });
    zone.addEventListener('drop', function(e){
      e.preventDefault();
      zone.closest('.col').classList.remove('drag-over');
      var newColId = zone.dataset.colId;
      if(!S.dragTaskId || !newColId) return;
      var task = findTask(S.dragTaskId);
      if(!task || task.columnId === newColId) return;
      var oldCol = findCol(task.columnId);
      var newCol = findCol(newColId);
      task.columnId = newColId;

      var author = S.name ? S.name + ' (' + S.role + ')' : S.role;
      var detailStr = 'Memindahkan dari ' + (oldCol ? oldCol.name : '?') + ' ke ' + (newCol ? newCol.name : '?');
      S.activity.push({id:uid(), taskId:S.dragTaskId, action:'moved', by:author, detail:detailStr, createdAt:new Date().toISOString()});
      if(S.openTaskId === S.dragTaskId) renderActivity(S.dragTaskId);

      renderBoard();
      setSyncBusy(true);
      API.moveTask(S.dragTaskId, newColId).then(function(r){
        setSyncBusy(false);
        if(!r.success) toast('❌ Gagal pindah: '+r.error,'err');
        else toast('✅ Dipindahkan','ok');
      }).catch(function(){ setSyncBusy(false); toast('❌ Error sinkronisasi','err'); });
    });
  });
}

// ── ADD TASK ──────────────────────────────────────────────────
function openAddTask(colId) {
  var wrap = document.getElementById('atw-'+colId);
  wrap.innerHTML =
    '<textarea class="add-task-input" id="ati-'+colId+'" placeholder="Nama tugas..." rows="2" autofocus></textarea>' +
    '<div class="add-task-actions">' +
      '<button class="btn btn-primary btn-sm" onclick="submitAddTask(\''+colId+'\')">Tambah</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="cancelAddTask(\''+colId+'\')">Batal</button>' +
    '</div>';
  var ta = document.getElementById('ati-'+colId);
  ta.focus();
  ta.addEventListener('keydown', function(e){
    if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); submitAddTask(colId); }
    if(e.key==='Escape') cancelAddTask(colId);
  });
}

function submitAddTask(colId) {
  var ta = document.getElementById('ati-'+colId);
  var title = (ta ? ta.value : '').trim();
  if(!title) return cancelAddTask(colId);
  var id = uid();
  var task = {id:id, projectId:S.activeProjectId, columnId:colId, title:title, notes:'', priority:'', dueDate:'', assignee:'', orderIdx:0, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), sourceId:''};
  S.tasks.push(task);

  var author = S.name ? S.name + ' (' + S.role + ')' : S.role;
  S.activity.push({id:uid(), taskId:id, action:'created', by:author, detail:'Membuat tugas', createdAt:new Date().toISOString()});

  renderBoard();
  setSyncBusy(true);
  API.createTask(S.activeProjectId, colId, title, id).then(function(r){
    setSyncBusy(false);
    if(!r.success) toast('❌ '+r.error,'err');
  }).catch(function(){ setSyncBusy(false); toast('❌ Error simpan','err'); });
}

function cancelAddTask(colId) {
  var wrap = document.getElementById('atw-'+colId);
  if(wrap) wrap.innerHTML = '<button class="btn-add-open" onclick="openAddTask(\''+colId+'\')">＋ Tambah tugas</button>';
}

// ── DETAIL PANEL ──────────────────────────────────────────────
function openPanel(taskId) {
  var task = findTask(taskId);
  if(!task) return;
  S.openTaskId = taskId;
  var col = findCol(task.columnId);
  var colColor = col ? (CLV.COL_COLORS[col.name] || col.color || '#6b7280') : '#6b7280';

  // Title
  var titleEl = document.getElementById('panelTitle');
  titleEl.textContent = task.title || '—';
  titleEl.dataset.taskId = taskId;

  // Badge
  document.getElementById('panelColBadge').textContent = col ? col.name : '—';
  document.getElementById('panelColBadge').style.background = colColor+'22';
  document.getElementById('panelColBadge').style.color = colColor;

  // Source
  var srcEl = document.getElementById('panelSourceInfo');
  srcEl.style.display = task.sourceId ? 'inline-flex' : 'none';
  document.getElementById('panelSourceId').textContent = task.sourceId || '';

  // Fields
  document.getElementById('panelNotes').value    = task.notes    || '';
  document.getElementById('panelPriority').value = task.priority || '';
  document.getElementById('panelDueDate').value  = task.dueDate  || '';
  document.getElementById('panelAssignee').value = task.assignee || '';
  document.getElementById('panelCreated').textContent = task.createdAt ? '📅 Dibuat: ' + fmtDate(task.createdAt) : '';

  // Print buttons (admin + has sourceId)
  document.getElementById('panelPrint').style.display = isAdmin() && task.sourceId ? 'flex' : 'none';

  renderComments(taskId);
  renderActivity(taskId);

  // Scroll to top of panel
  var scroll = document.getElementById('panelScroll');
  if(scroll) scroll.scrollTop = 0;

  // Open backdrop
  document.getElementById('panelBackdrop').classList.add('open');
  document.getElementById('detailPanel').classList.add('open');
}

function closePanel() {
  document.getElementById('detailPanel').classList.remove('open');
  var bd = document.getElementById('panelBackdrop');
  if(bd) bd.classList.remove('open');
  S.openTaskId = null;
  // Clear pending images
  pendingImages = [];
  var prev = document.getElementById('attachPreview');
  if(prev) prev.innerHTML = '';
}

function savePanel() {
  var task = findTask(S.openTaskId);
  if(!task) return;
  var data = {
    notes:    document.getElementById('panelNotes').value,
    priority: document.getElementById('panelPriority').value,
    dueDate:  document.getElementById('panelDueDate').value,
    assignee: document.getElementById('panelAssignee').value,
  };

  var changed = [];
  if(task.notes !== data.notes) changed.push('catatan');
  if(task.priority !== data.priority) changed.push('prioritas');
  if(task.dueDate !== data.dueDate) changed.push('due date');
  if(task.assignee !== data.assignee) changed.push('assignee');

  Object.assign(task, data);

  if(changed.length > 0) {
    var author = S.name ? S.name + ' (' + S.role + ')' : S.role;
    S.activity.push({id:uid(), taskId:task.id, action:'updated', by:author, detail:'Memperbarui ' + changed.join(', '), createdAt:new Date().toISOString()});
    renderActivity(task.id);
  }

  setSyncBusy(true);
  API.updateTask(task.id, data).then(function(r){
    setSyncBusy(false);
    if(!r.success) toast('❌ '+r.error,'err');
    else { toast('✅ Tersimpan','ok'); renderBoard(); }
  }).catch(function(){ setSyncBusy(false); toast('❌ Error simpan','err'); });
}

function savePanelTitle() {
  var el = document.getElementById('panelTitle');
  var task = findTask(S.openTaskId);
  if(!task || !el) return;
  var newTitle = el.textContent.trim();
  if(!newTitle || newTitle === task.title) return;
  task.title = newTitle;

  var author = S.name ? S.name + ' (' + S.role + ')' : S.role;
  S.activity.push({id:uid(), taskId:task.id, action:'updated', by:author, detail:'Mengubah judul', createdAt:new Date().toISOString()});
  renderActivity(task.id);

  renderBoard();
  API.updateTask(task.id, {title: newTitle}).then(function(r){
    if(!r.success) toast('❌ '+r.error,'err');
    else toast('✅ Judul diubah','ok');
  });
}

// ── Panel Tab Switching ───────────────────────────────────────
function switchPanelTab(tabId, clickedEl) {
  document.querySelectorAll('.panel-tab').forEach(function(t){ t.classList.remove('active'); });
  document.querySelectorAll('.panel-pane').forEach(function(p){ p.classList.remove('active'); });
  if(clickedEl) clickedEl.classList.add('active');
  var pane = document.getElementById('pane-'+tabId);
  if(pane) pane.classList.add('active');
  var inputWrap = document.getElementById('commentInputWrap');
  if(inputWrap) {
    inputWrap.style.display = (tabId === 'comments') ? 'block' : 'none';
  }
}

// ── Render Comments ────────────────────────────────────────────
function renderCommentText(rawText) {
  var s = String(rawText||'');
  var parts = s.split(/\[IMG\]([\s\S]*?)\[\/IMG\]/);
  var html = '';
  for(var i=0;i<parts.length;i++){
    if(i%2===0){
      if(!parts[i]) continue;
      var seg = esc(parts[i]).replace(/(https?:\/\/[^\s\n<]+)/g,'<a class="comment-file-link" href="$1" target="_blank">$1</a>');
      html += '<span style="white-space:pre-wrap">'+seg+'</span>';
    } else {
      html += '<img class="comment-img" src="'+parts[i]+'" alt="Gambar" onclick="openLightbox(this.src)" loading="lazy">';
    }
  }
  return html;
}

function renderComments(taskId) {
  var list = document.getElementById('commentsList');
  if(!list) return;
  var cmts = taskComments(taskId);
  if(!cmts.length){ list.innerHTML='<div style="text-align:center;padding:30px;color:var(--text-3);font-size:.83rem">Belum ada komentar</div>'; return; }
  list.innerHTML = cmts.map(function(c){
    var isAuto = String(c.isAuto).toUpperCase()==='TRUE';
    var initials = String(c.author||'?').slice(0,2).toUpperCase();
    var bodyHtml = isAuto
      ? esc(String(c.text||'')).replace(/(https?:\/\/[^\s\n]+)/g,'<a class="comment-file-link" href="$1" target="_blank">$1</a>')
      : renderCommentText(c.text);
    
    var actHtml = '';
    if(!isAuto || isAdmin()) {
      actHtml = '<div class="comment-actions">' +
        '<span title="Edit" onclick="editComment(\''+c.id+'\')">✏️</span>' +
        '<span title="Hapus" onclick="deleteComment(\''+c.id+'\')">🗑️</span>' +
        '</div>';
    }

    return '<div class="comment-item">' +
      '<div class="comment-avatar'+(isAuto?' auto':'')+'">'+(isAuto?'\u{1F916}':initials)+'</div>' +
      '<div style="flex:1"><div class="comment-meta"><div style="flex:1">'+(isAuto?'Auto (sistem)':esc(c.author||'admin'))+' \xb7 '+fmtDate(c.createdAt)+'</div>'+actHtml+'</div>' +
      '<div class="comment-bubble'+(isAuto?' auto-comment':'')+'" id="comment-bubble-'+c.id+'">'+bodyHtml+'</div></div>' +
      '</div>';
  }).join('');
}

// ── Render Activity ───────────────────────────────────────────
function renderActivity(taskId) {
  var list = document.getElementById('activityList');
  if(!list) return;
  var acts = taskActivity(taskId);
  if(!acts.length){ list.innerHTML='<div style="text-align:center;padding:30px;color:var(--text-3);font-size:.83rem">Belum ada aktivitas</div>'; return; }
  var icons = {created:'✨',moved:'↔️',updated:'✏️',commented:'💬',deleted:'🗑'};
  list.innerHTML = acts.map(function(a){
    return '<div class="activity-item">' +
      '<div class="activity-icon">'+(icons[a.action]||'•')+'</div>' +
      '<div class="activity-detail">' +
        '<span class="activity-who">'+esc(a.by||'sistem')+'</span> '+esc(a.detail||a.action) +
        '<div class="activity-ts">'+fmtDate(a.createdAt)+'</div>' +
      '</div></div>';
  }).join('');
}

function submitComment() {
  var ta = document.getElementById('commentInput');
  var text = (ta ? ta.value : '').trim();
  var imagesToUpload = pendingImages.slice();
  var hasImages = imagesToUpload.length > 0;
  
  if(!text && !hasImages) return;
  if(!S.openTaskId) return;
  var taskId = S.openTaskId;
  var id = uid(), now = new Date().toISOString();
  var author = S.name ? S.name + ' (' + S.role + ')' : S.role;

  // Langsung bersihkan input form
  if(ta) ta.value = '';
  pendingImages = [];
  var prev = document.getElementById('attachPreview');
  if(prev) prev.innerHTML = '';

  if (hasImages) {
    toast('⏳ Mengupload ' + imagesToUpload.length + ' gambar...', 'ok');
    setSyncBusy(true);
    var uploads = imagesToUpload.map(function(img, idx){
      return API.uploadImage(img.dataUrl, 'clover_img_' + Date.now() + '_' + idx + '.png');
    });
    
    Promise.all(uploads).then(function(results){
      var parts = [];
      if(text) parts.push(text);
      results.forEach(function(r, i){
        if(r.success) parts.push('[IMG]' + r.url + '[/IMG]');
        else toast('❌ Gagal upload gambar ke-' + (i+1), 'err');
      });
      _finishSubmitComment(taskId, parts.join('\n'), author, id, now);
    }).catch(function(e){
      setSyncBusy(false);
      toast('❌ Error upload: ' + e.message, 'err');
    });
  } else {
    _finishSubmitComment(taskId, text, author, id, now);
  }
}

function _finishSubmitComment(taskId, fullText, author, localId, now) {
  // Add to local state
  S.comments.push({id:localId, taskId:taskId, text:fullText, author:author, isAuto:'FALSE', createdAt:now});
  S.activity.push({id:uid(), taskId:taskId, action:'commented', by:author, detail:'Menambahkan komentar', createdAt:now});
  renderComments(taskId);
  renderActivity(taskId);
  renderBoard(); 
  
  // Send to GAS
  setSyncBusy(true);
  API.addComment(taskId, fullText).then(function(r){ 
    setSyncBusy(false); 
    if(!r.success) toast('❌ '+r.error,'err'); 
    else {
      // Sinkronisasi local ID dengan database ID agar tombol Edit/Hapus bekerja
      var c = S.comments.find(function(x){return x.id===localId;});
      if(c) c.id = r.id;
    }
  }).catch(function(){ 
    setSyncBusy(false); 
    toast('❌ Error kirim komentar','err'); 
  });
}

function editComment(cid) {
  var c = S.comments.find(function(x){return x.id===cid;});
  if(!c) return;
  var bubble = document.getElementById('comment-bubble-'+cid);
  if(!bubble) return;
  
  bubble.innerHTML = '<textarea id="edit-ta-'+cid+'" class="comment-input" style="width:100%;margin-top:4px;margin-bottom:8px;padding:8px;border-radius:6px;border:1px solid var(--border)" rows="3">' + esc(c.text) + '</textarea>' +
    '<div style="display:flex;gap:6px;justify-content:flex-end;">' +
      '<button class="btn btn-ghost btn-sm" onclick="cancelEditComment(\''+cid+'\')">Batal</button>' +
      '<button class="btn btn-primary btn-sm" onclick="saveEditComment(\''+cid+'\')">Simpan</button>' +
    '</div>';
}

function saveEditComment(cid) {
  var ta = document.getElementById('edit-ta-'+cid);
  if(!ta) return;
  var newText = ta.value.trim();
  var c = S.comments.find(function(x){return x.id===cid;});
  if(!c) return;
  if(!newText) return; 
  if(newText === c.text) return cancelEditComment(cid);
  
  c.text = newText;
  renderComments(c.taskId);
  renderBoard();
  API.updateComment(cid, newText).then(function(r){
    if(!r.success) toast('❌ Gagal edit: '+r.error,'err');
  }).catch(function(e){ toast('❌ '+e.message,'err'); });
}

function cancelEditComment(cid) {
  var c = S.comments.find(function(x){return x.id===cid;});
  if(c) renderComments(c.taskId);
}

function deleteComment(cid) {
  customConfirm('Hapus Komentar', 'Apakah Anda yakin ingin menghapus komentar ini?', function() {
    var c = S.comments.find(function(x){return x.id===cid;});
    if(!c) return;
    var tid = c.taskId;
    S.comments = S.comments.filter(function(x){return x.id!==cid;});
    renderComments(tid);
    renderBoard();
    API.deleteComment(cid).then(function(r){
      if(!r.success) toast('❌ Gagal hapus: '+r.error,'err');
    }).catch(function(e){ toast('❌ '+e.message,'err'); });
  });
}

function customConfirm(title, message, onConfirm, confirmText, isDanger) {
  var id = 'clv-confirm-' + Date.now();
  var overlay = document.createElement('div');
  overlay.id = id;
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:99999;opacity:0;transition:opacity 0.2s';
  
  var modal = document.createElement('div');
  modal.style.cssText = 'background:var(--bg);width:320px;border-radius:12px;padding:24px;box-shadow:0 10px 30px rgba(0,0,0,0.2);transform:translateY(20px);transition:transform 0.2s';
  
  var btnText = confirmText || 'Hapus';
  var btnClass = (isDanger === false) ? 'btn-primary' : 'btn-danger';

  modal.innerHTML = 
    '<div style="font-weight:800;font-size:1.15rem;margin-bottom:10px;color:var(--text)">' + esc(title) + '</div>' +
    '<div style="font-size:0.95rem;color:var(--text-2);margin-bottom:24px;line-height:1.5">' + message + '</div>' +
    '<div style="display:flex;justify-content:flex-end;gap:8px">' +
      '<button class="btn btn-outline" id="'+id+'-cancel">Batal</button>' +
      '<button class="btn '+btnClass+'" id="'+id+'-ok">' + esc(btnText) + '</button>' +
    '</div>';
    
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  requestAnimationFrame(function(){
    overlay.style.opacity = '1';
    modal.style.transform = 'translateY(0)';
  });
  
  function close(confirmed) {
    overlay.style.opacity = '0';
    modal.style.transform = 'translateY(20px)';
    setTimeout(function(){ 
      if(document.body.contains(overlay)) document.body.removeChild(overlay); 
      if(confirmed && onConfirm) onConfirm(); 
    }, 200);
  }
  
  document.getElementById(id+'-cancel').onclick = function(){ close(false); };
  document.getElementById(id+'-ok').onclick = function(){ close(true); };
}

function delTask(taskId) {
  if(!confirm('Hapus tugas ini?')) return;
  S.tasks = S.tasks.filter(function(t){return t.id!==taskId;});
  if(S.openTaskId === taskId) closePanel();
  renderBoard();
  setSyncBusy(true);
  API.deleteTask(taskId).then(function(r){
    setSyncBusy(false);
    if(!r.success) toast('❌ '+r.error,'err');
    else toast('🗑 Dihapus','ok');
  }).catch(function(){ setSyncBusy(false); toast('❌ Error hapus','err'); });
}

// ── COLUMN CRUD ───────────────────────────────────────────────
function onColRename(el) {
  var colId = el.dataset.cid;
  var name  = el.textContent.trim();
  if(!name || !colId) return;
  var col = findCol(colId);
  if(!col || col.name === name) return;
  col.name = name;
  API.renameColumn(colId, name).then(function(r){ if(!r.success) toast('❌ '+r.error,'err'); else toast('✅ Kolom diubah','ok'); });
}

function promptNewCol(pid) {
  var name = prompt('Nama kolom baru:');
  if(!name || !name.trim()) return;
  var id = uid();
  var maxPos = projCols(pid).reduce(function(m,c){return Math.max(m,parseInt(c.pos)||0);},-1);
  S.columns.push({id:id, projectId:pid, name:name.trim(), color:'#6b7280', pos:maxPos+1});
  renderBoard();
  setSyncBusy(true);
  API.createColumn(pid, name.trim()).then(function(r){ setSyncBusy(false); if(!r.success) toast('❌ '+r.error,'err'); else toast('✅ Kolom ditambahkan','ok'); });
}

function colMenu(e, colId) {
  e.stopPropagation();
  closeAllDropdowns();
  var col = findCol(colId);
  var menu = document.createElement('div');
  menu.className = 'dropdown'; menu.id = 'dropdown-tmp';
  menu.style.cssText = 'position:fixed;top:'+(e.clientY+4)+'px;left:'+(e.clientX-120)+'px';
  menu.innerHTML =
    '<div class="dropdown-item" onclick="closeAllDropdowns();promptRenameCol(\''+colId+'\')">✏️ Ganti nama</div>' +
    '<div class="dropdown-sep"></div>' +
    '<div class="dropdown-item danger" onclick="closeAllDropdowns();confirmDelCol(\''+colId+'\')">🗑 Hapus kolom</div>';
  document.body.appendChild(menu);
}

function promptRenameCol(colId) {
  var col = findCol(colId);
  var name = prompt('Nama baru kolom:', col ? col.name : '');
  if(!name || !name.trim()) return;
  if(col) col.name = name.trim();
  renderBoard();
  API.renameColumn(colId, name.trim()).then(function(r){ if(!r.success) toast('❌ '+r.error,'err'); else toast('✅ Kolom diubah','ok'); });
}

function confirmDelCol(colId) {
  var col = findCol(colId);
  var cnt = colTasks(colId).length;
  if(!confirm('Hapus kolom "'+( col?col.name:'')+'"? '+(cnt?cnt+' tugas akan dihapus.':''))) return;
  S.tasks   = S.tasks.filter(function(t){return t.columnId!==colId;});
  S.columns = S.columns.filter(function(c){return c.id!==colId;});
  renderBoard();
  setSyncBusy(true);
  API.deleteColumn(colId).then(function(r){ setSyncBusy(false); if(!r.success) toast('❌ '+r.error,'err'); else toast('🗑 Kolom dihapus','ok'); });
}

// ── PROJECT CRUD ──────────────────────────────────────────────
function newProject() {
  var id = 'clv-new-proj-' + Date.now();
  var overlay = document.createElement('div');
  overlay.id = id;
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:99999;opacity:0;transition:opacity 0.2s';
  
  var modal = document.createElement('div');
  modal.style.cssText = 'background:var(--bg);width:360px;border-radius:12px;padding:24px;box-shadow:0 10px 30px rgba(0,0,0,0.2);transform:translateY(20px);transition:transform 0.2s';
  
  var d = new Date();
  var defaultMm = String(d.getMonth()+1).padStart(2,'0') + String(d.getFullYear()).slice(-2);
  
  modal.innerHTML = 
    '<div style="font-weight:800;font-size:1.15rem;margin-bottom:16px;color:var(--text)">✨ Buat Proyek Baru</div>' +
    '<div style="margin-bottom:16px">' +
      '<label style="display:block;font-size:0.85rem;color:var(--text-2);margin-bottom:6px;font-weight:600">Nama Proyek</label>' +
      '<input type="text" id="'+id+'-name" class="search-input-real" style="width:100%;box-sizing:border-box" placeholder="Contoh: Produksi April 2026">' +
    '</div>' +
    '<div style="margin-bottom:24px">' +
      '<label style="display:block;font-size:0.85rem;color:var(--text-2);margin-bottom:6px;font-weight:600">Kode Bulan</label>' +
      '<input type="text" id="'+id+'-month" class="search-input-real" style="width:100%;box-sizing:border-box" value="'+defaultMm+'" placeholder="MMYY (contoh: 0426)">' +
      '<div style="font-size:0.75rem;color:var(--text-3);margin-top:6px">Digunakan untuk menarik data pesanan dari bulan terkait secara otomatis.</div>' +
    '</div>' +
    '<div style="display:flex;justify-content:flex-end;gap:8px">' +
      '<button class="btn btn-outline" id="'+id+'-cancel">Batal</button>' +
      '<button class="btn btn-primary" id="'+id+'-ok">Buat Proyek</button>' +
    '</div>';
    
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  requestAnimationFrame(function(){
    overlay.style.opacity = '1';
    modal.style.transform = 'translateY(0)';
    document.getElementById(id+'-name').focus();
  });
  
  function close(confirmed) {
    var nameVal = '';
    var monthVal = '';
    
    if(confirmed) {
      nameVal = document.getElementById(id+'-name').value.trim();
      monthVal = document.getElementById(id+'-month').value.trim();
      if(!nameVal || !monthVal) { 
        toast('❌ Nama dan Kode Bulan wajib diisi','err'); 
        return; 
      }
    }

    overlay.style.opacity = '0';
    modal.style.transform = 'translateY(20px)';
    setTimeout(function(){ 
      if(document.body.contains(overlay)) document.body.removeChild(overlay); 
      if(confirmed) {
        executeNewProject(nameVal, monthVal);
      }
    }, 200);
  }
  
  document.getElementById(id+'-cancel').onclick = function(){ close(false); };
  document.getElementById(id+'-ok').onclick = function(){ close(true); };
  document.getElementById(id+'-name').onkeydown = function(e){ if(e.key==='Enter') document.getElementById(id+'-month').focus(); };
  document.getElementById(id+'-month').onkeydown = function(e){ if(e.key==='Enter') close(true); };
}

function executeNewProject(name, monthCode) {
  var id = uid();
  S.projects.push({id:id, name:name, color:'#2d6a4f', createdAt:new Date().toISOString(), month: monthCode});
  // Add default columns locally
  var defCols = ['New Order','Design Process','ACC Design','Production','Delivery'];
  var defColors = ['#3b82f6','#f59e0b','#2d9d6e','#8b5cf6','#f97316'];
  defCols.forEach(function(n,i){ S.columns.push({id:uid(),projectId:id,name:n,color:defColors[i],pos:i}); });
  setActiveProject(id);
  setSyncBusy(true);
  API.createProject(name, monthCode).then(function(r){ setSyncBusy(false); if(!r.success) toast('❌ '+r.error,'err'); else toast('✅ Proyek dibuat','ok'); });
}

function projMenu(e, pid) {
  e.stopPropagation();
  closeAllDropdowns();
  var menu = document.createElement('div');
  menu.className = 'dropdown'; menu.id = 'dropdown-tmp';
  menu.style.cssText = 'position:fixed;top:'+(e.clientY+4)+'px;left:'+(e.clientX-120)+'px';
  menu.innerHTML =
    '<div class="dropdown-item" onclick="closeAllDropdowns();promptRenameProj(\''+pid+'\')">✏️ Ganti nama</div>' +
    '<div class="dropdown-item" onclick="closeAllDropdowns();doSyncOrders(\''+pid+'\')">🔄 Sync Order (tambah baru)</div>' +
    '<div class="dropdown-item" onclick="closeAllDropdowns();doResyncOrders(\''+pid+'\')">⚡ Sync Ulang (reset semua order)</div>' +
    '<div class="dropdown-sep"></div>' +
    '<div class="dropdown-item danger" onclick="closeAllDropdowns();confirmDelProj(\''+pid+'\')">🗑 Hapus proyek</div>';
  document.body.appendChild(menu);
}

function doResyncOrders(pid) {
  customConfirm(
    '⚡ Sync Ulang Order',
    'Tindakan ini akan <b style="color:var(--orange)">MENGHAPUS SEMUA</b> tugas yang berasal dari Sheet sebelumnya, lalu menarik data terbaru.<br><br><i>(Tugas yang dibuat manual tetap aman)</i><br><br>Lanjutkan?',
    function() {
      setSyncBusy(true);
      toast('⚡ Reset & sync ulang order...','ok');
      var proj = S.projects.find(function(p){return p.id===pid;});
      var month = proj ? (proj.month||'') : '';
      API.resyncOrders(pid, month).then(function(r){
        if(!r.success){ setSyncBusy(false); toast('❌ '+r.error,'err'); return; }
        return API.getAll().then(function(data){
          setSyncBusy(false);
          if(!data.success){ toast('❌ Reload gagal','err'); return; }
          S.projects=data.projects||[]; S.columns=data.columns||[];
          S.tasks=data.tasks||[]; S.comments=data.comments||[]; S.activity=data.activity||[];
          renderSidebar(); renderHeader(); renderBoard();
          toast('✅ '+(r.synced||0)+' order disinkron ulang','ok');
        });
      }).catch(function(e){ setSyncBusy(false); toast('❌ '+e.message,'err'); });
    },
    'Ya, Sync Ulang',
    true
  );
}


function promptRenameProj(pid) {
  var proj = S.projects.find(function(p){return p.id===pid;});
  var name = prompt('Nama baru proyek:', proj?proj.name:'');
  if(!name || !name.trim()) return;
  if(proj) proj.name = name.trim();
  renderSidebar(); renderHeader();
  API.renameProject(pid, name.trim()).then(function(r){ if(!r.success) toast('❌ '+r.error,'err'); else toast('✅ Diubah','ok'); });
}

function confirmDelProj(pid) {
  var proj = S.projects.find(function(p){return p.id===pid;});
  if(!confirm('Hapus proyek "'+( proj?proj.name:'')+'"? Semua kolom dan tugas akan dihapus!')) return;
  S.projects = S.projects.filter(function(p){return p.id!==pid;});
  S.columns  = S.columns.filter(function(c){return c.projectId!==pid;});
  S.tasks    = S.tasks.filter(function(t){return t.projectId!==pid;});
  var next = S.projects[0];
  if(next) setActiveProject(next.id); else setActiveProject(null);
  setSyncBusy(true);
  API.deleteProject(pid).then(function(r){ setSyncBusy(false); if(!r.success) toast('❌ '+r.error,'err'); else toast('🗑 Proyek dihapus','ok'); });
}

function doSyncOrders(pid) {
  customConfirm(
    '🔄 Sync Order Baru',
    'Sistem akan mengecek dan menarik pesanan baru dari Google Sheets yang belum ada di Kanban.',
    function() {
      setSyncBusy(true);
      toast('⏳ Sinkronisasi order...','ok');
      var proj = S.projects.find(function(p){return p.id===pid;});
      var month = proj ? (proj.month||'') : '';
      API.syncOrders(pid, month).then(function(r){
        if(!r.success){ setSyncBusy(false); toast('❌ '+r.error,'err'); return; }
        return API.getAll().then(function(data){
          setSyncBusy(false);
          if(!data.success){ toast('❌ Reload gagal','err'); return; }
          S.projects=data.projects||[]; S.columns=data.columns||[];
          S.tasks=data.tasks||[]; S.comments=data.comments||[]; S.activity=data.activity||[];
          renderSidebar(); renderHeader(); renderBoard();
          toast('✅ '+(r.synced||0)+' order disinkron','ok');
        });
      }).catch(function(e){ setSyncBusy(false); toast('❌ '+e.message,'err'); });
    },
    'Tarik Data',
    false
  );
}

// ── SYNC STATUS ───────────────────────────────────────────────
function setSyncBusy(busy) {
  var dot = document.getElementById('syncDot');
  if(dot) dot.className = 'sync-dot'+(busy?' busy':'');
}

// ── DROPDOWN UTILS ────────────────────────────────────────────
function closeAllDropdowns() {
  var d = document.getElementById('dropdown-tmp');
  if(d) d.remove();
}
document.addEventListener('click', function(){ closeAllDropdowns(); });

// ── PROJECT TITLE INLINE EDIT ─────────────────────────────────
function setupTitleEdit() {
  var el = document.getElementById('projTitle');
  el.addEventListener('blur', function(){
    var pid = el.dataset.pid;
    var name = el.textContent.trim();
    if(!pid || !name) return;
    var proj = S.projects.find(function(p){return p.id===pid;});
    if(!proj || proj.name===name) return;
    proj.name = name;
    renderSidebar();
    API.renameProject(pid, name).then(function(r){ if(!r.success) toast('❌ '+r.error,'err'); else toast('✅ Nama diubah','ok'); });
  });
  el.addEventListener('keydown', function(e){ if(e.key==='Enter'){e.preventDefault();el.blur();} });
}

// ── SEARCH ────────────────────────────────────────────────────
function onSearch(q) {
  if(!q){ renderBoard(); return; }
  q = q.toLowerCase();
  var filtered = S.tasks.filter(function(t){ return (t.title||'').toLowerCase().includes(q); });
  // Render only matching cards, dim others
  document.querySelectorAll('.card').forEach(function(el){
    var tid = el.dataset.taskId;
    var match = filtered.some(function(t){return t.id===tid;});
    el.style.opacity = match ? '1' : '0.2';
  });
}

// ── PRINT ─────────────────────────────────────────────────────
function printLabel() {
  var task = findTask(S.openTaskId);
  if(!task) return;
  var lines = (task.notes||'').split('\n');
  var get = function(prefix){ var l=lines.find(function(x){return x.includes(prefix);}); return l?l.replace(prefix,'').trim():'—'; };
  var html = '<div class="pl"><div class="pl-h">🍀 CLOVERTEES — LABEL PENGIRIMAN</div>' +
    '<div class="pl-r"><b>Nama:</b> '+esc(get('Nama:'))+'</div>' +
    '<div class="pl-r"><b>HP:</b> '+esc(get('HP:'))+'</div>' +
    '<div class="pl-r"><b>Alamat:</b> '+esc(get('Alamat:'))+'</div>' +
    '<div class="pl-r"><b>Ongkir:</b> '+esc(get('Ongkir:'))+'</div>' +
    '<div style="margin-top:8px;font-size:9pt;color:#555">No: '+esc(task.title||'')+'</div></div>';
  document.getElementById('print-root').innerHTML = html;
  window.print();
  setTimeout(function(){document.getElementById('print-root').innerHTML='';},800);
}

function printSlip() {
  var task = findTask(S.openTaskId);
  if(!task) return;
  var html = '<div class="ps"><div class="ps-h">🍀 CLOVERTEES — SLIP PRODUKSI</div>' +
    '<table><tr><th>No. Pesanan</th><td>'+esc(task.sourceId||task.title)+'</td></tr>' +
    '<tr><th>Customer</th><td>'+esc(task.title)+'</td></tr></table>' +
    '<pre style="margin-top:10px;font-size:10pt;white-space:pre-wrap">'+esc(task.notes||'')+'</pre></div>';
  document.getElementById('print-root').innerHTML = html;
  window.print();
  setTimeout(function(){document.getElementById('print-root').innerHTML='';},800);
}

// ── AUTH ──────────────────────────────────────────────────────
var Auth = {
  init: function(){ if(localStorage.getItem('clv_auth')!=='1'){ window.location.href='login.html'; return false; } return true; },
  logout: function(){ localStorage.removeItem('clv_auth'); localStorage.removeItem('clv_role'); window.location.href='login.html'; }
};

// ── ESC KEY → close panel ─────────────────────────────────────
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape'){
    // Close lightbox first if open
    var lb = document.getElementById('imgLightbox');
    if(lb && lb.classList.contains('open')){ lb.classList.remove('open'); return; }
    if(S.openTaskId) closePanel();
  }
});

// ── IMAGE PASTE in comment textarea ───────────────────────────
document.addEventListener('DOMContentLoaded', function(){
  var ta = document.getElementById('commentInput');
  if(!ta) return;
  ta.addEventListener('paste', function(e){
    var items = (e.clipboardData || e.originalEvent.clipboardData).items;
    var hasImage = false;
    for(var i=0;i<items.length;i++){
      if(items[i].type.indexOf('image') !== -1){
        hasImage = true;
        (function(item){
          var file = item.getAsFile();
          resizeAndAddImage(file);
        })(items[i]);
      }
    }
    if(hasImage) e.preventDefault();
  });
});

// ── FILE INPUT handler ─────────────────────────────────────────
function onFileAttach(input) {
  var files = Array.prototype.slice.call(input.files);
  files.forEach(function(file){
    if(file.type.indexOf('image') !== -1) resizeAndAddImage(file);
  });
  input.value = ''; // reset so same file can be picked again
}

// ── Resize image then add to pending ──────────────────────────
function resizeAndAddImage(file) {
  var reader = new FileReader();
  reader.onload = function(ev){
    var img = new Image();
    img.onload = function(){
      var MAX = 800;
      var ratio = Math.min(1, MAX / Math.max(img.width, img.height));
      var canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      var dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      pendingImages.push({dataUrl: dataUrl});
      renderPendingImages();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

// ── Render pending image thumbnails ───────────────────────────
function renderPendingImages() {
  var wrap = document.getElementById('attachPreview');
  if(!wrap) return;
  if(!pendingImages.length){ wrap.innerHTML=''; return; }
  wrap.innerHTML = pendingImages.map(function(img, idx){
    return '<div class="attach-preview-item">' +
      '<img class="attach-thumb" src="'+img.dataUrl+'" alt="Lampiran" onclick="openLightbox(this.src)">' +
      '<button class="attach-remove" onclick="removePendingImage('+idx+')">✕</button>' +
      '</div>';
  }).join('');
}

// ── Remove a pending image by index ───────────────────────────
function removePendingImage(idx) {
  pendingImages.splice(idx, 1);
  renderPendingImages();
}

// ── Lightbox fullscreen viewer ─────────────────────────────────
function openLightbox(src) {
  var lb  = document.getElementById('imgLightbox');
  var img = document.getElementById('imgLightboxSrc');
  if(!lb || !img) return;
  img.src = src;
  lb.classList.add('open');
}


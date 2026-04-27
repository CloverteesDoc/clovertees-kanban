// ============================================================
//  CLOVERTEES P4 — kanban.js  (Board rendering + Drag & Drop)
// ============================================================

var Board = {
  dragCard: null,   // currently dragged card data
  dragEl:   null,   // currently dragged DOM element

  // ── Render full board ─────────────────────────────────────
  render: function(cards) {
    CLV.COLUMNS.forEach(function(col) {
      var colCards = cards.filter(function(c) { return c.kolom === col; });
      var colEl    = document.querySelector('.col[data-col="' + CSS.escape(col) + '"]');
      if (!colEl) return;
      // Update count
      colEl.querySelector('.col-count').textContent = colCards.length;
      // Render cards
      var listEl = colEl.querySelector('.col-cards');
      listEl.innerHTML = '';
      if (colCards.length === 0) {
        listEl.innerHTML = '<div class="state-box"><div class="icon">📭</div><p>Tidak ada pesanan</p></div>';
      } else {
        colCards.forEach(function(c, idx) {
          var el = Board.buildCard(c, idx);
          listEl.appendChild(el);
        });
      }
    });
  },

  // ── Show loading ──────────────────────────────────────────
  showLoading: function() {
    CLV.COLUMNS.forEach(function(col) {
      var listEl = document.querySelector('.col[data-col="' + CSS.escape(col) + '"] .col-cards');
      if (listEl) listEl.innerHTML = '<div class="state-box"><div class="spinner"></div><p>Memuat...</p></div>';
    });
  },

  // ── Show error ────────────────────────────────────────────
  showError: function(msg) {
    CLV.COLUMNS.forEach(function(col) {
      var listEl = document.querySelector('.col[data-col="' + CSS.escape(col) + '"] .col-cards');
      if (listEl) listEl.innerHTML = '<div class="state-box"><div class="icon">⚠️</div><p>' + Util.esc(msg) + '</p></div>';
    });
  },

  // ── Build card DOM element ────────────────────────────────
  buildCard: function(c, idx) {
    var el = document.createElement('div');
    el.className = 'card';
    el.dataset.id  = c.noPesanan;
    el.dataset.col = c.kolom;
    el.setAttribute('draggable', 'true');
    el.style.animationDelay = (idx * 0.04) + 's';

    // Thumbnail logic
    var thumbHTML = Board.buildThumb(c.designItems);

    // Summary tags
    var colors = [];
    var totalPcs = c.totalPCS || 0;
    if (c.designItems && c.designItems.length > 0) {
      c.designItems.forEach(function(d) {
        if (d.warna && colors.indexOf(d.warna) === -1) colors.push(d.warna);
      });
    }
    var colorTags = colors.slice(0, 2).map(function(w) {
      return '<span class="tag warna">' + Util.esc(w) + '</span>';
    }).join('');
    var pcsBadge = totalPcs ? '<span class="tag pcs">' + Util.esc(String(totalPcs)) + ' pcs</span>' : '';

    var notesHTML = c.notes
      ? '<div class="notes-badge">📝 ' + Util.esc(c.notes.substring(0, 40)) + (c.notes.length > 40 ? '…' : '') + '</div>'
      : '';

    // Move button (next column only for team, all columns for admin)
    var moveMenuHTML = Board.buildMoveMenu(c);

    el.innerHTML =
      '<div class="card-inner">' +
        thumbHTML +
        '<div class="card-top">' +
          '<span class="order-no">' + Util.esc(c.noPesanan) + '</span>' +
          '<span class="card-ts">' + Util.esc(c.timestamp || c.approvedAt || '') + '</span>' +
        '</div>' +
        '<div class="card-name">' + Util.esc(c.nama || '—') + '</div>' +
        '<div class="card-summary">' + colorTags + pcsBadge + '</div>' +
        notesHTML +
      '</div>' +
      '<div class="card-actions">' +
        '<button class="card-btn detail" onclick="Modal.open(\'' + Util.esc(c.noPesanan) + '\')" title="Lihat detail">🔍 Detail</button>' +
        '<div class="move-wrap" id="mw-' + Util.esc(c.noPesanan) + '">' +
          '<button class="card-btn move" onclick="Board.toggleMoveMenu(\'' + Util.esc(c.noPesanan) + '\')">⇄ Pindah</button>' +
          moveMenuHTML +
        '</div>' +
      '</div>';

    // Drag events (desktop)
    el.addEventListener('dragstart', function(e) { Board.onDragStart(e, c); });
    el.addEventListener('dragend',   function()  { Board.onDragEnd(); });

    return el;
  },

  // ── Build design thumbnail ────────────────────────────────
  buildThumb: function(items) {
    if (!items || items.length === 0) return '';

    // Collect all file URLs
    var urls = [];
    items.forEach(function(d) {
      if (d.fileDepan)    urls.push(d.fileDepan);
      if (d.fileBelakang) urls.push(d.fileBelakang);
    });

    if (urls.length === 0) return '';

    // Extract Drive ID and build thumbnail URLs
    var thumbUrls = urls.slice(0, 3).map(function(u) {
      var id = Util.driveId(u);
      return id ? ('https://drive.google.com/thumbnail?id=' + id + '&sz=w300') : null;
    }).filter(Boolean);

    if (thumbUrls.length === 0) return '';

    if (thumbUrls.length === 1) {
      return '<img class="card-thumb" src="' + thumbUrls[0] + '" alt="Desain" ' +
             'onerror="this.style.display=\'none\'" loading="lazy">';
    }

    var imgs = thumbUrls.map(function(u) {
      return '<img src="' + u + '" alt="Desain" onerror="this.style.display=\'none\'" loading="lazy">';
    }).join('');
    return '<div class="card-thumb-multi">' + imgs + '</div>';
  },

  // ── Build move dropdown ───────────────────────────────────
  buildMoveMenu: function(c) {
    var currentIdx = CLV.COLUMNS.indexOf(c.kolom);
    var items = CLV.COLUMNS.filter(function(col) { return col !== c.kolom; }).map(function(col) {
      var meta = CLV.COL_META[col] || {};
      return '<div class="move-menu-item" onclick="Board.confirmMove(\'' + Util.esc(c.noPesanan) + '\',\'' + Util.esc(col) + '\')">' +
             '<span class="dot" style="background:' + (meta.color || '#aaa') + '"></span>' +
             (meta.icon || '') + ' ' + Util.esc(col) +
             '</div>';
    }).join('');

    return '<div class="move-menu" id="mm-' + Util.esc(c.noPesanan) + '" style="display:none">' + items + '</div>';
  },

  // ── Toggle move dropdown ──────────────────────────────────
  toggleMoveMenu: function(noPesanan) {
    // Close all others
    document.querySelectorAll('.move-menu').forEach(function(m) {
      if (m.id !== 'mm-' + noPesanan) m.style.display = 'none';
    });
    var menu = document.getElementById('mm-' + noPesanan);
    if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  },

  // ── Confirm move (via dialog) ─────────────────────────────
  confirmMove: function(noPesanan, newCol) {
    // Close dropdown
    var menu = document.getElementById('mm-' + noPesanan);
    if (menu) menu.style.display = 'none';

    var card = App.cards.find(function(c) { return c.noPesanan === noPesanan; });
    var nama = card ? card.nama : noPesanan;

    Confirm.show(
      'Pindah Kartu',
      'Pindahkan <b>' + Util.esc(noPesanan) + '</b> (' + Util.esc(nama) + ') ke kolom <b>' + Util.esc(newCol) + '</b>?',
      function() {
        App.moveCard(noPesanan, newCol);
      }
    );
  },

  // ── Drag & Drop ───────────────────────────────────────────
  onDragStart: function(e, c) {
    Board.dragCard = c;
    Board.dragEl   = e.currentTarget;
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', c.noPesanan);
  },

  onDragEnd: function() {
    if (Board.dragEl) Board.dragEl.classList.remove('dragging');
    Board.dragCard = null;
    Board.dragEl   = null;
    document.querySelectorAll('.col').forEach(function(c) { c.classList.remove('drag-over'); });
  },

  setupDropZones: function() {
    document.querySelectorAll('.col').forEach(function(colEl) {
      colEl.addEventListener('dragover', function(e) {
        e.preventDefault();
        colEl.classList.add('drag-over');
      });
      colEl.addEventListener('dragleave', function() {
        colEl.classList.remove('drag-over');
      });
      colEl.addEventListener('drop', function(e) {
        e.preventDefault();
        colEl.classList.remove('drag-over');
        if (!Board.dragCard) return;
        var targetCol = colEl.dataset.col;
        if (targetCol === Board.dragCard.kolom) return;
        Board.confirmMove(Board.dragCard.noPesanan, targetCol);
      });
    });
  }
};

// ── Confirm Dialog ─────────────────────────────────────────────
var Confirm = {
  _cb: null,

  show: function(title, bodyHTML, onConfirm) {
    this._cb = onConfirm;
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmBody').innerHTML   = bodyHTML;
    document.getElementById('confirmBackdrop').classList.add('open');
  },

  ok: function() {
    document.getElementById('confirmBackdrop').classList.remove('open');
    if (this._cb) { this._cb(); this._cb = null; }
  },

  cancel: function() {
    document.getElementById('confirmBackdrop').classList.remove('open');
    this._cb = null;
  }
};

// ── Utility ────────────────────────────────────────────────────
var Util = {
  esc: function(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  driveId: function(url) {
    if (!url) return null;
    var m = String(url).match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    m = String(url).match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    return null;
  },

  rupiah: function(val) {
    var n = parseInt(String(val).replace(/\D/g,''));
    if (isNaN(n)) return String(val || '-');
    return 'Rp ' + n.toLocaleString('id-ID');
  }
};

// Close move menus when clicking outside
document.addEventListener('click', function(e) {
  if (!e.target.closest('.move-wrap')) {
    document.querySelectorAll('.move-menu').forEach(function(m) { m.style.display = 'none'; });
  }
});

// ============================================================
//  CLOVERTEES P4 — modal.js  (Detail Modal)
// ============================================================

var Modal = {
  current: null,

  open: function(noPesanan) {
    var card = App.cards.find(function(c) { return c.noPesanan === noPesanan; });
    if (!card) return;
    this.current = card;
    this.render(card);
    document.getElementById('detailModal').classList.add('open');
  },

  close: function() {
    document.getElementById('detailModal').classList.remove('open');
    this.current = null;
  },

  render: function(c) {
    // Header
    document.getElementById('modalOrderNo').textContent = c.noPesanan;
    var meta = CLV.COL_META[c.kolom] || {};
    document.getElementById('modalKolom').textContent = (meta.icon || '') + ' ' + c.kolom;

    var body = document.getElementById('modalBody');
    body.innerHTML = '';

    // ── BAGIAN 1: DATA PENGIRIMAN ──
    body.innerHTML +=
      '<div class="section-label">📦 Data Pengiriman</div>' +
      '<div class="info-grid">' +
        '<div class="info-item"><label>Nama</label><span>' + Util.esc(c.nama || '—') + '</span></div>' +
        '<div class="info-item"><label>WhatsApp</label><span>' +
          (c.wa ? '<a href="https://wa.me/' + Util.esc(c.wa.replace(/\D/g,'')) + '" target="_blank" style="color:var(--clover-mid)">' + Util.esc(c.wa) + '</a>' : '—') +
        '</span></div>' +
        '<div class="info-item full"><label>Alamat</label><span>' + Util.esc(c.alamat || '—') + '</span></div>' +
        '<div class="info-item"><label>Ongkir</label><span>' + Util.rupiah(c.ongkir) + '</span></div>' +
        '<div class="info-item"><label>Total Harga</label><span>' + Util.rupiah(c.totalHarga) + '</span></div>' +
      '</div>';

    // ── BAGIAN 2: DETAIL ORDER ──
    body.innerHTML +=
      '<div class="section-label">🎽 Detail Order</div>' +
      '<div class="info-grid">' +
        '<div class="info-item"><label>No. Pesanan</label><span style="font-family:var(--mono)">' + Util.esc(c.noPesanan) + '</span></div>' +
        '<div class="info-item"><label>Total PCS</label><span>' + Util.esc(String(c.totalPCS || '—')) + '</span></div>' +
        '<div class="info-item"><label>Instagram</label><span>' + (c.instagram ? '@' + Util.esc(c.instagram) : '—') + '</span></div>' +
        '<div class="info-item"><label>Tanggal Order</label><span>' + Util.esc(c.timestamp || '—') + '</span></div>' +
      '</div>';

    // Design items
    if (c.designItems && c.designItems.length > 0) {
      var designHTML = '<div class="section-label">🎨 Detail Desain (' + c.designItems.length + ' item)</div>';

      // Image strip (thumbnails from Drive)
      var allImgs = [];
      c.designItems.forEach(function(d) {
        ['fileDepan','fileBelakang','fileLengan'].forEach(function(key) {
          if (d[key]) {
            var id = Util.driveId(d[key]);
            if (id) allImgs.push({ url: d[key], id: id, label: key.replace('file','') });
          }
        });
      });

      if (allImgs.length > 0) {
        designHTML += '<div class="img-strip">';
        allImgs.forEach(function(img) {
          var thumb = 'https://drive.google.com/thumbnail?id=' + img.id + '&sz=w300';
          designHTML += '<img src="' + thumb + '" alt="' + Util.esc(img.label) + '" ' +
                       'onerror="this.style.display=\'none\'" loading="lazy" ' +
                       'onclick="window.open(\'' + Util.esc(img.url) + '\',\'_blank\')" ' +
                       'title="Klik untuk buka full size · ' + Util.esc(img.label) + '" style="cursor:pointer">';
        });
        designHTML += '</div>';
      }

      c.designItems.forEach(function(d, i) {
        designHTML += '<div class="design-item">';
        designHTML += '<div class="design-item-head">';
        designHTML += '<span style="font-weight:800">' + (i+1) + '. ' + Util.esc(d.jenisBaju || 'Item') + '</span>';
        if (d.warna)   designHTML += '<span class="tag warna">' + Util.esc(d.warna) + '</span>';
        if (d.pcsItem) designHTML += '<span class="tag pcs">'   + Util.esc(String(d.pcsItem)) + ' pcs</span>';
        designHTML += '</div>';

        var details = [];
        if (d.ukuranDewasa && d.ukuranDewasa !== '-') details.push('Dewasa: ' + d.ukuranDewasa);
        if (d.ukuranAnak   && d.ukuranAnak   !== '-') details.push('Anak: '   + d.ukuranAnak);
        if (d.desainDepan)    details.push('Depan: '    + d.desainDepan);
        if (d.desainBelakang) details.push('Belakang: ' + d.desainBelakang);
        if (d.desainLengan)   details.push('Lengan: '   + d.desainLengan);

        if (details.length > 0) {
          designHTML += '<div class="design-detail">' + Util.esc(details.join(' | ')) + '</div>';
        }

        var files = [];
        if (d.fileDepan)    files.push({ url: d.fileDepan,    label: '📎 File Depan' });
        if (d.fileBelakang) files.push({ url: d.fileBelakang, label: '📎 File Belakang' });
        if (d.fileLengan)   files.push({ url: d.fileLengan,   label: '📎 File Lengan' });

        if (files.length > 0) {
          designHTML += '<div style="margin-top:6px">';
          files.forEach(function(f) {
            designHTML += '<a class="file-link" href="' + Util.esc(f.url) + '" target="_blank">' + f.label + '</a>';
          });
          designHTML += '</div>';
        }

        designHTML += '</div>';
      });

      body.innerHTML += designHTML;
    } else {
      body.innerHTML += '<div class="section-label">🎨 Desain</div>' +
        '<p style="font-size:.85rem;color:var(--ink-soft);font-style:italic">Belum ada data desain.</p>';
    }

    // Notes section
    if (c.notes) {
      body.innerHTML +=
        '<div class="section-label">📝 Notes</div>' +
        '<p style="font-size:.88rem;color:var(--ink-mid);line-height:1.6">' + Util.esc(c.notes) + '</p>';
    }

    // Update print buttons visibility
    var printFooter = document.getElementById('modalPrintBtns');
    if (printFooter) {
      printFooter.style.display = Auth.isAdmin() ? 'flex' : 'none';
    }
  }
};

// Close modal on backdrop click
document.getElementById('detailModal').addEventListener('click', function(e) {
  if (e.target === this) Modal.close();
});

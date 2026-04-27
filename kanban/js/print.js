// ============================================================
//  CLOVERTEES P4 — print.js
// ============================================================

var Print = {

  // ── Print Label Pengiriman ────────────────────────────────
  label: function() {
    var c = Modal.current;
    if (!c) return;

    var html =
      '<div class="print-label">' +
        '<div class="pl-title">🍀 CLOVERTEES — LABEL PENGIRIMAN</div>' +
        '<div class="pl-row"><b>No. Pesanan:</b> ' + _pe(c.noPesanan) + '</div>' +
        '<div class="pl-row"><b>Nama:</b> '        + _pe(c.nama)      + '</div>' +
        '<div class="pl-row"><b>HP/WA:</b> '       + _pe(c.wa)        + '</div>' +
        '<div class="pl-row"><b>Alamat:</b> '      + _pe(c.alamat)    + '</div>' +
        '<div class="pl-row"><b>Ongkir:</b> '      + Util.rupiah(c.ongkir) + '</div>' +
        '<div style="margin-top:8px;font-size:9pt;color:#555">Dicetak: ' + _today() + '</div>' +
      '</div>';

    _doPrint(html);
  },

  // ── Print Slip Produksi ────────────────────────────────────
  slip: function() {
    var c = Modal.current;
    if (!c) return;

    var itemRows = '';
    if (c.designItems && c.designItems.length > 0) {
      c.designItems.forEach(function(d, i) {
        var ukuran = [
          d.ukuranDewasa && d.ukuranDewasa !== '-' ? 'Dewasa: ' + d.ukuranDewasa : '',
          d.ukuranAnak   && d.ukuranAnak   !== '-' ? 'Anak: '   + d.ukuranAnak   : '',
        ].filter(Boolean).join(' / ') || '-';

        itemRows +=
          '<tr>' +
            '<td>' + (i+1) + '</td>' +
            '<td>' + _pe(d.jenisBaju || '-') + '</td>' +
            '<td>' + _pe(d.warna || '-')     + '</td>' +
            '<td>' + _pe(ukuran)             + '</td>' +
            '<td style="text-align:center">' + _pe(String(d.pcsItem || '-')) + '</td>' +
          '</tr>';
      });
    } else {
      itemRows = '<tr><td colspan="5" style="text-align:center;font-style:italic">Tidak ada detail desain</td></tr>';
    }

    var html =
      '<div class="print-slip">' +
        '<div class="ps-title">🍀 CLOVERTEES — SLIP PRODUKSI</div>' +
        '<table>' +
          '<tr><th>No. Pesanan</th><td colspan="4" style="font-weight:bold">' + _pe(c.noPesanan) + '</td></tr>' +
          '<tr><th>Nama Customer</th><td colspan="4">' + _pe(c.nama) + '</td></tr>' +
          '<tr><th>Total PCS</th><td colspan="4">' + _pe(String(c.totalPCS || '-')) + ' pcs</td></tr>' +
          '<tr><th>Tanggal Cetak</th><td colspan="4">' + _today() + '</td></tr>' +
        '</table>' +

        '<br>' +

        '<table>' +
          '<thead>' +
            '<tr>' +
              '<th>#</th>' +
              '<th>Jenis Baju</th>' +
              '<th>Warna</th>' +
              '<th>Ukuran</th>' +
              '<th>PCS</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' + itemRows + '</tbody>' +
        '</table>' +

        '<div style="margin-top:12px;border-top:1px solid #ccc;padding-top:8px;font-size:9pt;color:#555">' +
          'Detail Pesanan: ' + _pe(c.detailPesanan || '-') +
        '</div>' +
      '</div>';

    _doPrint(html);
  }
};

// ── Helpers ────────────────────────────────────────────────────
function _pe(s) {
  return String(s || '-')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function _today() {
  return new Date().toLocaleDateString('id-ID', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function _doPrint(html) {
  var root = document.getElementById('print-root');
  root.innerHTML = html;
  window.print();
  setTimeout(function() { root.innerHTML = ''; }, 1000);
}

// ============================================================
//  CLOVERTEES P4 — auth.js
// ============================================================

var Auth = {
  role: null,

  init: function() {
    if (localStorage.getItem('clv_auth') !== '1') {
      window.location.href = 'login.html';
      return false;
    }
    this.role = localStorage.getItem('clv_role') || 'team';
    this.name = localStorage.getItem('clv_name') || '';
    return true;
  },

  isAdmin: function() { return this.role === 'admin'; },

  logout: function() {
    localStorage.removeItem('clv_auth');
    localStorage.removeItem('clv_role');
    localStorage.removeItem('clv_name');
    window.location.href = 'login.html';
  },

  applyUI: function() {
    // Role badge
    var badge = document.getElementById('roleBadge');
    if (badge) {
      badge.className = 'role-badge ' + this.role;
      badge.innerHTML = this.role === 'admin' ? '👑 Admin' : '🎽 Tim Produksi';
    }
    // Hide admin-only elements
    if (!this.isAdmin()) {
      document.querySelectorAll('.admin-only').forEach(function(el) {
        el.style.display = 'none';
      });
    }
  }
};

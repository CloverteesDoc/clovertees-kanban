// ============================================================
//  CLOVERTEES P4 — api.js  (GAS API calls)
// ============================================================
var API = {
  _q: function(params) {
    var qs = Object.keys(params).map(function(k){ return k+'='+encodeURIComponent(params[k]); }).join('&');
    return fetch(CLV.GAS + '?' + qs).then(function(r){ return r.json(); });
  },
  _post: function(data) {
    return fetch(CLV.GAS, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' } // GAS requirement
    }).then(function(r){ return r.json(); });
  },

  getAll:        function(){ return this._q({action:'getAll'}); },
  syncOrders:    function(pid,month){ return this._q({action:'syncOrders', projectId:pid, month:month||''}); },
  resyncOrders:  function(pid,month){ return this._q({action:'resyncOrders', projectId:pid, month:month||''}); },

  createProject: function(name,month){ return this._q({action:'createProject', name:name, month:month||''}); },
  renameProject: function(id,name){ return this._q({action:'renameProject', id:id, name:name}); },
  deleteProject: function(id){ return this._q({action:'deleteProject', id:id}); },

  createColumn:  function(pid,name){ return this._q({action:'createColumn', projectId:pid, name:name}); },
  renameColumn:  function(id,name){ return this._q({action:'renameColumn', id:id, name:name}); },
  deleteColumn:  function(id){ return this._q({action:'deleteColumn', id:id}); },

  createTask:    function(pid,cid,title,cid2,by){ return this._q({action:'createTask', projectId:pid, columnId:cid, title:title, id:cid2||'', by:by||(S.name ? S.name + ' ('+S.role+')' : S.role)}); },
  updateTask:    function(id,data){ return this._q({action:'updateTask', id:id, data:JSON.stringify(data), by:(S.name ? S.name + ' ('+S.role+')' : S.role)}); },
  moveTask:      function(id,cid){ return this._q({action:'moveTask', id:id, columnId:cid, by:(S.name ? S.name + ' ('+S.role+')' : S.role)}); },
  deleteTask:    function(id){ return this._q({action:'deleteTask', id:id}); },
  addComment:    function(taskId,text){ return this._q({action:'addComment', taskId:taskId, text:text, author:(S.name ? S.name + ' ('+S.role+')' : S.role)}); },
  updateComment: function(id,text){ return this._q({action:'updateComment', id:id, text:text}); },
  deleteComment: function(id){ return this._q({action:'deleteComment', id:id}); },
  uploadImage:   function(base64, filename){ return this._post({action:'uploadImage', base64:base64, filename:filename}); },
};

// ── Helpers ────────────────────────────────────────────────────
function uid(){ return 'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,5); }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toast(msg, type){
  var w=document.getElementById('toastWrap'), t=document.createElement('div');
  t.className='toast '+(type||'ok'); t.textContent=msg; w.appendChild(t);
  setTimeout(function(){t.style.opacity='0';t.style.transition='opacity .3s';setTimeout(function(){t.remove();},300);},2800);
}
function driveId(url){
  if(!url)return null;
  var m=String(url).match(/\/d\/([a-zA-Z0-9_-]+)/); if(m)return m[1];
  m=String(url).match(/[?&]id=([a-zA-Z0-9_-]+)/); return m?m[1]:null;
}
function fmtDate(v){
  if(!v)return ''; try{return new Date(v).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});}catch(e){return String(v);}
}

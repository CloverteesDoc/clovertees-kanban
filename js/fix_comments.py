import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# The correct renderComments section to inject
correct = '''// \u2500\u2500 Render Comments \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function renderCommentText(rawText) {
  var s = String(rawText||'');
  var parts = s.split(/\\[IMG\\]([\\s\\S]*?)\\[\\/IMG\\]/);
  var html = '';
  for(var i=0;i<parts.length;i++){
    if(i%2===0){
      if(!parts[i]) continue;
      var seg = esc(parts[i]).replace(/(https?:\\/\\/[^\\s\\n<]+)/g,'<a class="comment-file-link" href="$1" target="_blank">$1</a>');
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
      ? esc(String(c.text||'')).replace(/(https?:\\/\\/[^\\s\\n]+)/g,'<a class="comment-file-link" href="$1" target="_blank">$1</a>')
      : renderCommentText(c.text);
    return '<div class="comment-item">' +
      '<div class="comment-avatar'+(isAuto?' auto':'')+'">'+(isAuto?'\\u{1F916}':initials)+'</div>' +
      '<div style="flex:1"><div class="comment-meta">'+(isAuto?'Auto (sistem)':esc(c.author||'admin'))+' \\xb7 '+fmtDate(c.createdAt)+'</div>' +
      '<div class="comment-bubble'+(isAuto?' auto-comment':'')+'">'+bodyHtml+'</div></div>' +
      '</div>';
  }).join('');
}

'''

# Find the broken section between switchPanelTab closing brace and renderActivity
# Pattern: from the comment line to renderActivity comment
pattern = r'// \u2500\u2500 Render Comments \u2500+\n.*?// \u2500\u2500 Render Activity'
replacement = correct + '// \u2500\u2500 Render Activity'

new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)

if new_content == content:
    print("ERROR: Pattern not found, no changes made")
else:
    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("SUCCESS: app.js fixed")

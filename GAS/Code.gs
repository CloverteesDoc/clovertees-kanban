// ============================================================
//  CLOVERTEES P4 — Code.gs  (CRUD + Comments + Activity)
//  Deploy: Execute as Me | Anyone can access
// ============================================================
var DB={ID:'133ENleDfF5-8Tt2c5bFHSIPKmjtYtSR89vCaFua7v-c',ORDER:'Orderan',DESIGN:'Desain',PROJECTS:'P4_Projects',COLUMNS:'P4_Columns',TASKS:'P4_Tasks',COMMENTS:'P4_Comments',ACTIVITY:'P4_Activity'};
var DEF_COLS=['New Order','Design Process','ACC Design','Production','Delivery'];
var DEF_CLR=['#3b82f6','#f59e0b','#2d9d6e','#8b5cf6','#f97316'];

function doGet(e){
  var p=e.parameter,r;
  try{
    switch((p.action||'')){
      case 'getAll':       r=getAll();break;
      case 'syncOrders':   r=syncOrders(p.projectId,p.month||'',false);break;
      case 'resyncOrders': r=syncOrders(p.projectId,p.month||'',true);break;
      case 'trackOrder':   r=trackOrder(p.order);break;
      case 'createProject':r=createProject(p.name,p.month||'');break;
      case 'renameProject':r=_upd(DB.PROJECTS,p.id,2,p.name);break;
      case 'deleteProject':r=deleteProject(p.id);break;
      case 'createColumn': r=createColumn(p.projectId,p.name);break;
      case 'renameColumn': r=_upd(DB.COLUMNS,p.id,3,p.name);break;
      case 'deleteColumn': r=deleteColumn(p.id);break;
      case 'createTask':   r=createTask(p.projectId,p.columnId,p.title,p.id||'',p.by||'admin');break;
      case 'updateTask':   r=updateTask(p.id,JSON.parse(p.data||'{}'),p.by||'admin');break;
      case 'moveTask':     r=moveTask(p.id,p.columnId,p.by||'admin');break;
      case 'deleteTask':   r=deleteTask(p.id);break;
      case 'addComment':   r=addComment(p.taskId,p.text,p.author||'admin');break;
      case 'updateComment':r=_upd(DB.COMMENTS,p.id,3,p.text);break;
      case 'deleteComment':r=_delCmt(p.id);break;
      case 'ping':         r={success:true};break;
      default:             r={success:false,error:'Unknown: '+p.action};
    }
  }catch(err){r={success:false,error:err.toString()};}
  return ContentService.createTextOutput(JSON.stringify(r)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e){
  var r;
  try{
    var p = {};
    if(e.postData && e.postData.contents) p = JSON.parse(e.postData.contents);
    
    switch(p.action){
      case 'uploadImage':
        r = _uploadImage(p.base64, p.filename);
        break;
      default:
        r = {success:false, error:'Unknown POST action: '+(p.action||'')};
    }
  }catch(err){r={success:false,error:err.toString()};}
  
  // CORS Headers are automatically handled by GAS when deployed as web app, but we return JSON.
  return ContentService.createTextOutput(JSON.stringify(r)).setMimeType(ContentService.MimeType.JSON);
}

function _uploadImage(base64Data, filename) {
  var folderName = "Clovertees_Kanban_Images";
  var folders = DriveApp.getFoldersByName(folderName);
  var folder;
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(folderName);
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }
  
  // Remove data:image/png;base64, prefix if present
  var parts = base64Data.split(',');
  var dataStr = parts.length > 1 ? parts[1] : parts[0];
  
  var blob = Utilities.newBlob(Utilities.base64Decode(dataStr), "image/png", filename || ("img_" + Date.now() + ".png"));
  var file = folder.createFile(blob);
  
  return {success: true, url: file.getUrl(), id: file.getId()};
}

function _boot(ss){
  var names=ss.getSheets().map(function(s){return s.getName();});
  var defs={};
  defs[DB.PROJECTS]=['id','name','color','createdAt','month'];
  defs[DB.COLUMNS]=['id','projectId','name','color','pos'];
  defs[DB.TASKS]=['id','projectId','columnId','title','notes','priority','dueDate','assignee','createdAt','updatedAt','sourceId'];
  defs[DB.COMMENTS]=['id','taskId','text','author','isAuto','createdAt'];
  defs[DB.ACTIVITY]=['id','taskId','action','by','detail','createdAt'];
  Object.keys(defs).forEach(function(n){if(names.indexOf(n)<0){var s=ss.insertSheet(n);s.appendRow(defs[n]);s.setFrozenRows(1);}});
  var ps=ss.getSheetByName(DB.PROJECTS);
  if(ps.getLastRow()<=1){
    var pid=_uid(),now=new Date(),mm=_mm();
    ps.appendRow([pid,'Clovertees Production '+mm,'#2d6a4f',now,mm]);
    var cs=ss.getSheetByName(DB.COLUMNS);
    DEF_COLS.forEach(function(n,i){cs.appendRow([_uid(),pid,n,DEF_CLR[i],i]);});
  }
}

function getAll(){
  var ss=SpreadsheetApp.openById(DB.ID);_boot(ss);
  return{success:true,
    projects:_read(ss,DB.PROJECTS,['id','name','color','createdAt','month']),
    columns:_read(ss,DB.COLUMNS,['id','projectId','name','color','pos']),
    tasks:_read(ss,DB.TASKS,['id','projectId','columnId','title','notes','priority','dueDate','assignee','createdAt','updatedAt','sourceId']),
    comments:_read(ss,DB.COMMENTS,['id','taskId','text','author','isAuto','createdAt']),
    activity:_read(ss,DB.ACTIVITY,['id','taskId','action','by','detail','createdAt'])
  };
}

function trackOrder(orderId){
  if(!orderId) return {error:'Pesanan tidak ditemukan'};
  var ss=SpreadsheetApp.openById(DB.ID);_boot(ss);
  var tasks=_read(ss,DB.TASKS,['id','projectId','columnId','title','notes','priority','dueDate','assignee','createdAt','updatedAt','sourceId']);
  var cols=_read(ss,DB.COLUMNS,['id','projectId','name','color','pos']);
  
  var task = tasks.find(function(t){return String(t.sourceId).trim().toUpperCase()===String(orderId).trim().toUpperCase();});
  if(!task) return {error:'Pesanan tidak ditemukan'};
  
  var col = cols.find(function(c){return c.id===task.columnId;});
  var statusName = col ? col.name : 'Unknown';
  var parts = task.title.split(' — ');
  var customerName = parts.length > 1 ? parts[1] : 'Customer';
  
  return {success:true, order:orderId, status:statusName, customer:customerName};
}

function syncOrders(projectId,month,force){
  var ss=SpreadsheetApp.openById(DB.ID);_boot(ss);
  var cols=_read(ss,DB.COLUMNS,['id','projectId','name','color','pos']).filter(function(c){return c.projectId===projectId;});
  cols.sort(function(a,b){return parseInt(a.pos)-parseInt(b.pos);});
  if(!cols.length)return{success:false,error:'No columns'};
  var firstColId=cols[0].id;
  var existing={};
  if(!force){
    _read(ss,DB.TASKS,['id','projectId','columnId','title','notes','priority','dueDate','assignee','createdAt','updatedAt','sourceId']).forEach(function(t){
      if(t.projectId === projectId && t.sourceId) existing[t.sourceId]=1;
    });
  } else {
    // Force: hapus semua synced tasks + comments + activity untuk project ini dulu
    var syncedTasks=_read(ss,DB.TASKS,['id','projectId','columnId','title','notes','priority','dueDate','assignee','createdAt','updatedAt','sourceId']).filter(function(t){return t.projectId===projectId&&t.sourceId;});
    syncedTasks.forEach(function(t){_del(ss,DB.COMMENTS,t.id,2);_del(ss,DB.ACTIVITY,t.id,2);_del(ss,DB.TASKS,t.id,1);});
  }
  var oRows=ss.getSheetByName(DB.ORDER).getDataRange().getValues();
  var dRows=ss.getSheetByName(DB.DESIGN)?ss.getSheetByName(DB.DESIGN).getDataRange().getValues():[];
  var dMap={};
  for(var i=1;i<dRows.length;i++){var dk=String(dRows[i][0]).trim();if(!dk)continue;if(!dMap[dk])dMap[dk]=[];dMap[dk].push({jenisBaju:dRows[i][2],warna:dRows[i][3],ukuranDewasa:dRows[i][4],ukuranAnak:dRows[i][5],pcsItem:dRows[i][6],desainDepan:dRows[i][7],desainBelakang:dRows[i][8],desainLengan:dRows[i][9],fileDepan:dRows[i][10],fileBelakang:dRows[i][11],fileLengan:dRows[i][12]});}
  var ts=ss.getSheetByName(DB.TASKS),cms=ss.getSheetByName(DB.COMMENTS),act=ss.getSheetByName(DB.ACTIVITY),now=new Date(),count=0;
  for(var j=1;j<oRows.length;j++){
    var r=oRows[j],no=String(r[0]||'').trim(),st=String(r[10]||'').trim();
    if(!no||st!=='Approved'||existing[no])continue;
    if(month && no.indexOf('-'+month+'-') === -1) continue;
    
    var nama=String(r[2]||''),designs=dMap[no]||[];
    // Notes: Pengiriman + Detail Order
    var nl=['━━ DATA PENGIRIMAN ━━','Nama    : '+nama,'HP      : '+r[3],'Alamat  : '+r[5],'Ongkir  : Rp '+r[8],'','━━ DETAIL ORDER ━━','No. Pesanan : '+no,'Nama    : '+nama,''];
    designs.forEach(function(d){
      if(d.jenisBaju)nl.push(String(d.jenisBaju).toUpperCase());
      if(d.warna)nl.push(d.warna);
      if(d.ukuranDewasa&&String(d.ukuranDewasa).trim()&&d.ukuranDewasa!=='-')nl.push('Dewasa : '+d.ukuranDewasa);
      if(d.ukuranAnak&&String(d.ukuranAnak).trim()&&d.ukuranAnak!=='-')nl.push('Kids   : '+d.ukuranAnak);
      nl.push('');
    });
    nl.push('Total PCS   : '+r[7]);nl.push('Total Harga : Rp '+r[9]);
    var tid=_uid();
    ts.appendRow([tid,projectId,firstColId,no+' — '+nama,nl.join('\n'),'','','',now,now,no]);
    act.appendRow([_uid(),tid,'created','system','Order '+no+' disinkron dari Sheets',now]);
    // Auto-comment per design item
    designs.forEach(function(d){
      var lines=[nama,(d.warna||'')+' - '+(d.jenisBaju||'')];
      if(d.ukuranDewasa&&d.ukuranDewasa!=='-')lines.push('Dewasa : '+d.ukuranDewasa);
      if(d.ukuranAnak&&d.ukuranAnak!=='-')lines.push('Anak   : '+d.ukuranAnak);
      if(d.pcsItem)lines.push('PCS    : '+d.pcsItem);
      if(d.desainDepan){lines.push('');lines.push('Desain Depan :');lines.push(String(d.desainDepan));}
      if(d.desainBelakang){lines.push('Desain Belakang :');lines.push(String(d.desainBelakang));}
      if(d.desainLengan){lines.push('Desain Lengan :');lines.push(String(d.desainLengan));}
      if(d.fileDepan){lines.push('');lines.push('File Depan :');lines.push(String(d.fileDepan));}
      if(d.fileBelakang){lines.push('File Belakang :');lines.push(String(d.fileBelakang));}
      if(d.fileLengan){lines.push('File Lengan :');lines.push(String(d.fileLengan));}
      cms.appendRow([_uid(),tid,lines.join('\n'),'system','TRUE',now]);
    });
    count++;
  }
  return{success:true,synced:count};
}

function createProject(name,month){
  var ss=SpreadsheetApp.openById(DB.ID);_boot(ss);
  var id=_uid();ss.getSheetByName(DB.PROJECTS).appendRow([id,name,'#2d6a4f',new Date(),month||_mm()]);
  var cs=ss.getSheetByName(DB.COLUMNS);DEF_COLS.forEach(function(n,i){cs.appendRow([_uid(),id,n,DEF_CLR[i],i]);});
  return{success:true,id:id};
}
function deleteProject(id){
  var ss=SpreadsheetApp.openById(DB.ID);
  _read(ss,DB.TASKS,['id','projectId','columnId','title','notes','priority','dueDate','assignee','createdAt','updatedAt','sourceId']).filter(function(t){return t.projectId===id;}).forEach(function(t){_del(ss,DB.COMMENTS,t.id,2);_del(ss,DB.ACTIVITY,t.id,2);});
  _del(ss,DB.TASKS,id,2);_del(ss,DB.COLUMNS,id,2);_del(ss,DB.PROJECTS,id,1);
  return{success:true};
}
function createColumn(projectId,name){
  var ss=SpreadsheetApp.openById(DB.ID);_boot(ss);
  var mp=_read(ss,DB.COLUMNS,['id','projectId','name','color','pos']).filter(function(c){return c.projectId===projectId;}).reduce(function(m,c){return Math.max(m,parseInt(c.pos)||0);},-1);
  var id=_uid();ss.getSheetByName(DB.COLUMNS).appendRow([id,projectId,name,'#6b7280',mp+1]);
  return{success:true,id:id};
}
function deleteColumn(id){
  var ss=SpreadsheetApp.openById(DB.ID);
  _read(ss,DB.TASKS,['id','projectId','columnId','title','notes','priority','dueDate','assignee','createdAt','updatedAt','sourceId']).filter(function(t){return t.columnId===id;}).forEach(function(t){_del(ss,DB.COMMENTS,t.id,2);_del(ss,DB.ACTIVITY,t.id,2);});
  _del(ss,DB.TASKS,id,3);_del(ss,DB.COLUMNS,id,1);
  return{success:true};
}
function createTask(projectId,columnId,title,clientId,by){
  var ss=SpreadsheetApp.openById(DB.ID);_boot(ss);
  var id=clientId||_uid(),now=new Date();
  ss.getSheetByName(DB.TASKS).appendRow([id,projectId,columnId,title,'','','','',now,now,'']);
  ss.getSheetByName(DB.ACTIVITY).appendRow([_uid(),id,'created',by,'Tugas dibuat',now]);
  return{success:true,id:id};
}
function updateTask(id,data,by){
  var ss=SpreadsheetApp.openById(DB.ID),s=ss.getSheetByName(DB.TASKS),rows=s.getDataRange().getValues();
  var map={title:4,notes:5,priority:6,dueDate:7,assignee:8};
  for(var i=1;i<rows.length;i++){
    if(String(rows[i][0]).trim()===String(id)){
      var ch=[];Object.keys(data).forEach(function(k){if(map[k]){s.getRange(i+1,map[k]).setValue(data[k]);ch.push(k);}});
      s.getRange(i+1,10).setValue(new Date());
      if(ch.length)ss.getSheetByName(DB.ACTIVITY).appendRow([_uid(),id,'updated',by,'Diubah: '+ch.join(', '),new Date()]);
      return{success:true};
    }
  }
  return{success:false,error:'Not found'};
}
function moveTask(id,columnId,by){
  var ss=SpreadsheetApp.openById(DB.ID),s=ss.getSheetByName(DB.TASKS),rows=s.getDataRange().getValues();
  var allCols=_read(ss,DB.COLUMNS,['id','projectId','name','color','pos']);
  for(var i=1;i<rows.length;i++){
    if(String(rows[i][0]).trim()===String(id)){
      var fromName=(allCols.find(function(c){return c.id===rows[i][2];})||{}).name||'?';
      var toName=(allCols.find(function(c){return c.id===columnId;})||{}).name||'?';
      s.getRange(i+1,3).setValue(columnId);s.getRange(i+1,10).setValue(new Date());
      ss.getSheetByName(DB.ACTIVITY).appendRow([_uid(),id,'moved',by,fromName+' → '+toName,new Date()]);
      return{success:true};
    }
  }
  return{success:false,error:'Not found'};
}
function deleteTask(id){
  var ss=SpreadsheetApp.openById(DB.ID);_del(ss,DB.COMMENTS,id,2);_del(ss,DB.ACTIVITY,id,2);_del(ss,DB.TASKS,id,1);return{success:true};
}
function addComment(taskId,text,author){
  var ss=SpreadsheetApp.openById(DB.ID);_boot(ss);
  var id=_uid(),now=new Date();
  ss.getSheetByName(DB.COMMENTS).appendRow([id,taskId,text,author,'FALSE',now]);
  ss.getSheetByName(DB.ACTIVITY).appendRow([_uid(),taskId,'commented',author,'Menambahkan komentar',now]);
  return{success:true,id:id};
}
function _delCmt(id){
  var ss=SpreadsheetApp.openById(DB.ID);
  _del(ss,DB.COMMENTS,id,1);
  return{success:true};
}
function _delCmt(id){
  var ss=SpreadsheetApp.openById(DB.ID);
  _del(ss,DB.COMMENTS,id,1);
  return{success:true};
}

function _uid(){return 'T'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);}
function _mm(){var d=new Date();return String(d.getMonth()+1).padStart(2,'0')+String(d.getFullYear()).slice(-2);}
function _read(ss,name,keys){var s=ss.getSheetByName(name);if(!s)return[];var rows=s.getDataRange().getValues(),out=[];for(var i=1;i<rows.length;i++){if(!rows[i][0])continue;var o={};keys.forEach(function(k,j){o[k]=rows[i][j]===undefined?'':rows[i][j];});out.push(o);}return out;}
function _upd(sn,id,col,val){var ss=SpreadsheetApp.openById(DB.ID),s=ss.getSheetByName(sn),rows=s.getDataRange().getValues();for(var i=1;i<rows.length;i++){if(String(rows[i][0]).trim()===String(id)){s.getRange(i+1,col).setValue(val);return{success:true};}}return{success:false,error:'Not found'};}
function _del(ss,name,id,col){var s=ss.getSheetByName(name);if(!s)return;var rows=s.getDataRange().getValues();for(var i=rows.length-1;i>=1;i--){if(String(rows[i][col-1]).trim()===String(id))s.deleteRow(i+1);}}

// ── DEBUG: jalankan dari GAS Editor untuk cek data Desain ─────
function testDebugSync() {
  var ss = SpreadsheetApp.openById(DB.ID);
  var oRows = ss.getSheetByName(DB.ORDER).getDataRange().getValues();
  var dRows = ss.getSheetByName(DB.DESIGN) ? ss.getSheetByName(DB.DESIGN).getDataRange().getValues() : [];

  // Log 3 order pertama
  Logger.log('=== ORDERAN (3 pertama, Approved) ===');
  var count = 0;
  for(var i=1;i<oRows.length&&count<5;i++){
    var no=String(oRows[i][0]||'').trim(), st=String(oRows[i][10]||'').trim();
    if(st==='Approved'){ Logger.log('No: ['+no+'] Status: '+st+' Nama: '+oRows[i][2]); count++; }
  }

  // Log Desain keys
  Logger.log('=== DESAIN (5 baris pertama) ===');
  for(var j=1;j<Math.min(dRows.length,6);j++){
    Logger.log('Key: ['+String(dRows[j][0]).trim()+'] jenisBaju: '+dRows[j][2]+' warna: '+dRows[j][3]+' pcs: '+dRows[j][6]);
  }

  // Cek apakah key match
  Logger.log('=== CEK MATCH ===');
  var dMap={};
  for(var d=1;d<dRows.length;d++){var dk=String(dRows[d][0]).trim();if(!dMap[dk])dMap[dk]=[];dMap[dk].push(dRows[d]);}
  for(var k=1;k<oRows.length;k++){
    var no2=String(oRows[k][0]||'').trim(), st2=String(oRows[k][10]||'').trim();
    if(st2==='Approved') Logger.log('Order ['+no2+'] → desain: '+(dMap[no2]?dMap[no2].length+' item':'TIDAK DITEMUKAN'));
  }
}


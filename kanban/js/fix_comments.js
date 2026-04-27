const fs = require('fs');
let lines = fs.readFileSync('app.js', 'utf8').split('\n');

// Find exact line ranges to delete: lines 345-370 (0-indexed: 344-369)
// The orphaned block starts at the line with "// ── Render Activity ────────────────────────────────────────────"
// (the shorter one — 12 dashes) and ends just before "// ── Render Activity ───────────────────────────────────────────"
// (the real one — 11 dashes)

let startDelete = -1;
let endDelete = -1;

for(let i=0; i<lines.length; i++){
  // Find the orphaned "// ── Render Activity" that appears inside the broken block (not the real one)
  if(startDelete === -1 && lines[i].includes('// ── Render Activity') && lines[i].includes('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500')){
    startDelete = i;
    console.log('Found orphan start at line', i+1, ':', lines[i].trim().substring(0,60));
  }
}

if(startDelete !== -1){
  // Find end: next "// ── Render Activity" (the real renderActivity function)
  for(let i=startDelete+1; i<lines.length; i++){
    if(lines[i].startsWith('// ── Render Activity')){
      endDelete = i-1;
      console.log('Found orphan end at line', endDelete+1);
      break;
    }
  }
}

if(startDelete !== -1 && endDelete !== -1){
  console.log('Deleting lines', startDelete+1, 'to', endDelete+1);
  lines.splice(startDelete, endDelete - startDelete + 1);
  fs.writeFileSync('app.js', lines.join('\n'), 'utf8');
  console.log('SUCCESS: orphaned block removed');
} else {
  console.log('ERROR: could not find block, startDelete='+startDelete+' endDelete='+endDelete);
  // Print lines 340-375 for debug
  for(let i=340;i<375&&i<lines.length;i++) console.log(i+1+':', lines[i]);
}

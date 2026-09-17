const fs=require('fs'), path=require('path'), cp=require('child_process');
const roots=['electron','shared']; let files=[];
function walk(p){ for(const n of fs.readdirSync(p)){ const f=path.join(p,n), s=fs.statSync(f); if(s.isDirectory()) walk(f); else if(f.endsWith('.js')) files.push(f); }}
for(const r of roots) if(fs.existsSync(r)) walk(r);
for(const f of files) cp.execFileSync(process.execPath,['--check',f],{stdio:'inherit'});
console.log(`syntax check: PASS (${files.length} files)`);

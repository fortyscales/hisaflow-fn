const fs=require('fs'); const path=require('path'); const os=require('os'); const { app }=require('electron');
const { getDatabaseHealth }=require('./integrity'); const sync=require('./syncService');
function buildDiagnostics(){
  return { generatedAt:new Date().toISOString(), appVersion:app.getVersion(), platform:process.platform, arch:process.arch,
    node:process.versions.node, electron:process.versions.electron, hostname:os.hostname(), database:getDatabaseHealth(), sync:sync.getSyncStatus() };
}
function exportDiagnostics(destinationPath){ const target=destinationPath || path.join(app.getPath('documents'),`hisaflow-diagnostics-${Date.now()}.json`); fs.writeFileSync(target,JSON.stringify(buildDiagnostics(),null,2),'utf8'); return {path:target}; }
module.exports={buildDiagnostics,exportDiagnostics};

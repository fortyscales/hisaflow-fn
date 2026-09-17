const fs=require('fs'); const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const chrome=read('src/components/StickyScreenChrome.jsx');
const header=read('src/components/ScreenHeader.jsx');
if(!chrome.includes('top: -inset')) throw new Error('StickyScreenChrome must compensate the page top inset');
if(!header.includes('top: -inset')) throw new Error('Standalone ScreenHeader must compensate the page top inset');
for(const f of ['src/screens/UzaScreen.jsx','src/screens/SettingsScreen.jsx','src/screens/DocumentsScreen.jsx']){
 const s=read(f); if(!(s.includes('top: -28')||s.includes('top:-28'))) throw new Error(`${f} must pin its custom header through the top inset`);
}
console.log('sticky header regression contract: PASS');

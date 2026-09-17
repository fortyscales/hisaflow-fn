const fs=require("fs"); const path=require("path"); const assert=require("assert");
const root=path.resolve(__dirname,".."); const pkg=require(path.join(root,"package.json"));
assert.equal(pkg.version,"2.2.8"); assert.equal(pkg.build.win.icon,"build/icon.ico");
assert(fs.existsSync(path.join(root,"build/icon.ico"))); assert(fs.statSync(path.join(root,"build/icon.ico")).size>1000);
assert(fs.existsSync(path.join(root,"electron/assets/icon.png")));
const main=fs.readFileSync(path.join(root,"electron/main.js"),"utf8"); assert(main.includes('icon: path.join(__dirname, "assets", "icon.png")'));
console.log("PASS app branding contract");

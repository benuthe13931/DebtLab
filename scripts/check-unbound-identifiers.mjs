import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";
const traverse = traverseModule.default;
const globals = new Set(["undefined","NaN","Infinity","Number","Math","Date","Object","Array","Boolean","String","RegExp","JSON","Promise","Set","Map","Error","console","crypto","Intl","URL","window","document","localStorage","sessionStorage","navigator","fetch","alert"]);
const roots = process.argv.slice(2);
const files = roots.flatMap((root) => { const stat = fs.statSync(root); if (stat.isFile()) return [root]; const out=[]; const visit=(dir)=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(entry.name==='node_modules'||entry.name==='dist')continue;const full=path.join(dir,entry.name);if(entry.isDirectory())visit(full);else if(/\\.(ts|tsx)$/.test(entry.name))out.push(full);}}; visit(root); return out; });
let failed=false;
for (const file of files) {
  const ast=parse(fs.readFileSync(file,"utf8"),{sourceType:"module",plugins:["typescript","jsx"]});
  const missing=new Set();
  traverse(ast,{ReferencedIdentifier(p){ if (p.findParent((parent)=>parent.isTSType?.())) return; const name=p.node.name; if (!globals.has(name)&&!p.scope.getBinding(name)) missing.add(name); }});
  if (missing.size) { failed=true; console.error(`${file}: ${[...missing].sort().join(", ")}`); }
}
if (failed) process.exit(1);

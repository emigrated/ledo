#!/bin/bash
set -e
F=/app/node_modules/app-builder-lib/out/targets/nsis/NsisTarget.js
cp "$F" "$F.bak" 2>/dev/null || true
cat > /tmp/p.mjs <<'EOF'
import fs from 'fs';
const p = process.argv[2];
let s = fs.readFileSync(p, 'utf-8');
const old = `        else {
            const wineVm = new WineVm_1.WineVmManager((_a = packager.config.toolsets) === null || _a === void 0 ? void 0 : _a.wine);
            await wineVm.exec(installerPath, [], { env: { __COMPAT_LAYER: "RunAsInvoker" } });
        }
`;
const rep = `        else {
            await nsisUtil_1.UninstallerReader.exec(installerPath, uninstallerPath);
        }
`;
if (!s.includes(old)) { console.error('pattern not found'); process.exit(1); }
s = s.replace(old, rep);
fs.writeFileSync(p, s);
console.log('patched ok');
EOF
node /tmp/p.mjs "$F"
sed -n '365,378p' "$F"

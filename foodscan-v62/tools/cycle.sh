#!/bin/sh
# Stop the v62 emulator (it keeps the tree locked on Windows), rebuild app/, restart it on :8802.
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -match 'serve.mjs.*8802' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }" >/dev/null 2>&1
sleep 1
node tools/build-v62.mjs "$@" || exit 1
(node tools/serve.mjs --port 8802 > /tmp/serve62.log 2>&1 &)
sleep 2
curl -s http://localhost:8802/api/health | head -c 120; echo

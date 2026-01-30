#!/bin/bash

rm -rf dist 
npx tsc
mkdir -p src/renderer/external/xterm

cp node_modules/@xterm/xterm/lib/xterm.js src/renderer/external/xterm/xterm.js
cp node_modules/@xterm/xterm/lib/xterm.js.map src/renderer/external/xterm/xterm.js.map
cp node_modules/@xterm/xterm/css/xterm.css src/renderer/external/xterm/xterm.css
cp -r src/renderer dist/renderer
cp -r src/resources dist/
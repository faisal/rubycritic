'use strict';

// Builds a jsdom window that looks like a generated RubyCritic report page,
// then runs the report's scripts in it, in the same order as the layout.

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const HTML_DIR = path.resolve(__dirname, '../../../lib/rubycritic/generators/html');
const ASSETS_DIR = path.join(HTML_DIR, 'assets');
const LAYOUT = path.join(HTML_DIR, 'templates/layouts/application.html.erb');

function layoutAssets(pattern) {
  const layout = fs.readFileSync(LAYOUT, 'utf8');
  return [...layout.matchAll(pattern)].map((m) => m[1]);
}

// The script paths the layout loads, e.g. "vendor/javascripts/jquery.min.js".
function layoutScripts() {
  return layoutAssets(/<script src="<%= asset_path\("([^"]+)"\) %>"><\/script>/g);
}

// The stylesheet paths the layout loads, e.g. "stylesheets/application.css".
function layoutStylesheets() {
  return layoutAssets(/<link href="<%= asset_path\("([^"]+)"\) %>"[^>]*rel="stylesheet"/g);
}

function inlineStyles() {
  return layoutStylesheets()
    .map((sheet) => `<style>${fs.readFileSync(path.join(ASSETS_DIR, sheet), 'utf8')}</style>`)
    .join('');
}

// Options:
//   body:  HTML for <body>.
//   page:  file name of the report page, e.g. "overview.html".
//   stubs: { "<script file name>": (window) => {...} } runs the function in
//          place of that script. Use it for libraries jsdom cannot run.
//   before: (window) => {...} runs before any script.
// Resolves with the window after the scripts ran and the DOM-ready callbacks fired.
function loadReport({ body = '', page = 'overview.html', stubs = {}, before } = {}) {
  const dom = new JSDOM(`<!DOCTYPE html><html><head>${inlineStyles()}</head><body>${body}</body></html>`, {
    url: `file:///report/${page}`,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  if (before) before(window);

  layoutScripts().forEach((script) => {
    const stub = stubs[path.basename(script)];
    if (stub) {
      stub(window);
    } else {
      window.eval(fs.readFileSync(path.join(ASSETS_DIR, script), 'utf8'));
    }
  });

  // Wait for "load" (DOMContentLoaded comes before it), then one more tick so
  // that callbacks scheduled by DOM-ready handlers also ran.
  return new Promise((resolve) => {
    const settle = () => window.setTimeout(() => resolve(window), 0);
    if (window.document.readyState === 'complete') {
      settle();
    } else {
      window.addEventListener('load', settle);
    }
  });
}

module.exports = { loadReport, layoutScripts, layoutStylesheets, ASSETS_DIR };

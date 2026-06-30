import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('admin aplica camada PWA responsiva em abas, tabelas e modais', () => {
  const adminHtml = read('admin.html');
  const adminMain = read('scripts/admin/admin-main.js');
  const adminCss = read('styles/admin-premium.css');

  assert.match(adminHtml, /styles\/admin-premium\.css\?v=2026-06-11-profile-admin-v1/);
  assert.match(adminHtml, /scripts\/admin\/admin-ui\.js\?v=2026-06-11-profile-admin-v1/);
  assert.match(adminHtml, /scripts\/admin\/admin-main\.js\?v=2026-06-11-profile-admin-v1/);

  assert.match(adminMain, /function syncAdminPwaViewportState\(\)/);
  assert.match(adminMain, /function bindAdminPwaViewportListeners\(\)/);
  assert.match(adminMain, /bindAdminPwaViewportListeners\(\);/);
  assert.match(adminMain, /window\.visualViewport\.addEventListener\("resize", enhanceAdminPwaLayout/);
  assert.match(adminMain, /host\.setAttribute\("role", "tablist"\)/);
  assert.match(adminMain, /btn\.setAttribute\("aria-selected"/);
  assert.match(adminMain, /function renderAllowedTabs\(\)/);
  assert.match(adminMain, /renderAllowedTabs\(\);[\s\S]*const dashboardPanel = document\.getElementById\("tab-dashboard"\)/);
  assert.match(adminMain, /scrollActiveAdminTabIntoView/);
  assert.match(adminMain, /function isAdminActionsHeaderLabel/);
  assert.match(adminMain, /function decorateAdminActionCell/);
  assert.match(adminMain, /btn\.classList\.add\("admin-action-btn"\)/);
  assert.match(adminMain, /wrapper\.style\.setProperty\("--admin-actions-column-width"/);
  assert.match(adminMain, /th\.classList\.toggle\("admin-sticky-actions", isAction\)/);
  assert.match(adminMain, /td\.classList\.toggle\("admin-sticky-actions", isAction\)/);
  assert.match(adminMain, /wrapper\.classList\.toggle\("has-sticky-actions", actionIndexes\.size > 0\)/);
  assert.match(adminMain, /tableEl\.classList\.add\("responsive-stack"\)/);
  assert.match(adminMain, /wrapper\.classList\.add\("responsive-stack-wrapper"\)/);

  assert.match(adminCss, /--admin-viewport-height: 100dvh/);
  assert.match(adminCss, /overflow-x: hidden/);
  assert.match(adminCss, /\.table-wrapper th\.admin-sticky-actions,[\s\S]*position: sticky;[\s\S]*right: 0;/);
  assert.match(adminCss, /min-width: var\(--admin-actions-column-width, 174px\)/);
  assert.match(adminCss, /\.table-wrapper thead th\.admin-sticky-actions \{[\s\S]*z-index: 7;/);
  assert.match(adminCss, /\.table-wrapper tbody tr\.hoverable:hover td\.admin-sticky-actions/);
  assert.match(adminCss, /\.table-wrapper td\.admin-sticky-actions \.btn \{[\s\S]*white-space: nowrap;/);
  assert.match(adminCss, /\.table-wrapper td\.admin-sticky-actions \.admin-action-btn \{[\s\S]*width: 34px;[\s\S]*height: 32px;/);
  assert.match(adminCss, /\.table-wrapper td\.admin-sticky-actions \.admin-action-label \{[\s\S]*clip: rect\(0, 0, 0, 0\);/);
  assert.match(adminCss, /\.tabs \{[\s\S]*max-width: 100%;/);
  assert.match(adminCss, /@media \(max-width: 768px\) \{/);
  assert.match(adminCss, /\.tabs \{[\s\S]*position: sticky;[\s\S]*overflow-x: auto;[\s\S]*scroll-snap-type: x proximity;/);
  assert.match(adminCss, /\.tab-btn \{[\s\S]*scroll-snap-align: center;/);
  assert.match(adminCss, /\.table-wrapper\.responsive-stack-wrapper \{[\s\S]*overflow: visible;/);
  assert.match(adminCss, /\.table-wrapper th\.admin-sticky-actions,[\s\S]*position: static;[\s\S]*box-shadow: none;/);
  assert.match(adminCss, /\.table-wrapper td\.admin-sticky-actions\.admin-actions-col \{[\s\S]*grid-template-columns: repeat\(2,minmax\(0,1fr\)\);/);
  assert.match(adminCss, /\.table-wrapper table\.responsive-stack tbody td\.admin-sticky-actions::before \{[\s\S]*grid-column: 1 \/ -1;/);
  assert.match(adminCss, /\.table-wrapper td\.admin-sticky-actions \.admin-action-label \{[\s\S]*position: static;[\s\S]*white-space: normal;/);
  assert.match(adminCss, /\.table-wrapper table\.responsive-stack thead \{[\s\S]*display: none;/);
  assert.match(adminCss, /\.table-wrapper table\.responsive-stack tbody tr \{[\s\S]*display: block;/);
  assert.match(adminCss, /\.table-wrapper table\.responsive-stack tbody td::before \{[\s\S]*content: attr\(data-label\)/);
  assert.match(adminCss, /\.modal-overlay \{[\s\S]*align-items: flex-end;/);
  assert.match(adminCss, /\.modal-container \{[\s\S]*border-radius: 8px 8px 0 0;/);
  assert.match(adminCss, /env\(safe-area-inset-bottom\)/);
});


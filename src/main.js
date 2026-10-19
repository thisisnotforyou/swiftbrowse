const { app, BrowserWindow, WebContentsView, ipcMain, session, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { ElectronBlocker } = require('@ghostery/adblocker-electron');
const fetch = require('cross-fetch');

const START_PAGE = path.join(__dirname, 'ui', 'start.html');
const START_PAGE_URL = pathToFileURL(START_PAGE).href;
const PRIVATE_PARTITION = 'swiftbrowse-private-memory';
const FILTER_PATH = () => path.join(app.getPath('userData'), 'adblocker-engine.bin');
const DATA_PATH = name => path.join(app.getPath('userData'), name);
const DEFAULT_WORKSPACES = [
  { id: 'personal', name: 'Personal', icon: '◉' },
  { id: 'work', name: 'Work', icon: '▤' },
  { id: 'play', name: 'Play', icon: '✳' }
];
const SIDE_PANEL_WIDTH = 320;
const SIDEBAR_COLLAPSED_WIDTH = 72;
const SIDEBAR_EXPANDED_WIDTH = 204;
const CHROME_HEIGHT = 130;

let win;
let tabs = [];
let activeId = null;
let secondaryId = null;
let nextId = 1;
let currentWorkspaceId = 'personal';
let sidebarExpanded = false;
let sidePanel = null;
let blockedCount = 0;
let blockEnabled = true;
let blockAvailable = false;
let bookmarks = [];
let historyEntries = [];
let downloads = [];
let workspaces = DEFAULT_WORKSPACES.map(item => ({ ...item }));
let blocker;
const watchedSessions = new WeakSet();

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, value) {
  try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2)); } catch (error) { console.warn(`Could not save ${path.basename(file)}.`, error.message); }
}
function loadLocalData() {
  const storedWorkspaces = readJson(DATA_PATH('workspaces.json'), null);
  if (Array.isArray(storedWorkspaces) && storedWorkspaces.length) workspaces = storedWorkspaces.filter(x => x && typeof x.id === 'string' && typeof x.name === 'string' && typeof x.icon === 'string');
  if (!workspaces.length) workspaces = DEFAULT_WORKSPACES.map(item => ({ ...item }));
  currentWorkspaceId = workspaces.some(x => x.id === currentWorkspaceId) ? currentWorkspaceId : workspaces[0].id;
  const savedBookmarks = readJson(DATA_PATH('bookmarks.json'), []);
  bookmarks = Array.isArray(savedBookmarks) ? savedBookmarks.filter(x => x && typeof x.url === 'string' && typeof x.title === 'string').slice(0, 100) : [];
  const savedHistory = readJson(DATA_PATH('history.json'), []);
  historyEntries = Array.isArray(savedHistory) ? savedHistory.filter(x => x && typeof x.url === 'string' && typeof x.title === 'string').slice(0, 3000) : [];
}
function partitionFor(workspaceId) { return `persist:swiftbrowse-${workspaceId}`; }
function currentWorkspace() { return workspaces.find(x => x.id === currentWorkspaceId) || workspaces[0]; }
function isStartPage(url) { return url === START_PAGE_URL || url.startsWith(`${START_PAGE_URL}?`); }
function visibleTabs() { return tabs.filter(t => t.workspaceId === currentWorkspaceId); }
function emit(channel, data) { if (win && !win.isDestroyed()) win.webContents.send(channel, data); }
function tabState(t) {
  if (!t) return null;
  const wc = t.view.webContents;
  const url = wc.getURL();
  const start = isStartPage(url);
  return {
    id: t.id,
    title: t.isPrivate ? 'Private tab' : start ? 'New tab' : wc.getTitle() || 'New tab',
    url: start ? '' : url,
    loading: wc.isLoading(),
    canGoBack: wc.canGoBack(),
    canGoForward: wc.canGoForward(),
    active: t.id === activeId,
    isPrivate: t.isPrivate
  };
}
function stateSnapshot() {
  return {
    tabs: visibleTabs().map(tabState), activeId, blockedCount, blockEnabled, blockAvailable,
    bookmarks, history: historyEntries.slice(0, 50), downloads: downloads.slice(0, 30),
    workspaces, currentWorkspaceId, sidebarExpanded, sidePanel, secondaryId
  };
}
function sendState() {
  if (!win || win.isDestroyed()) return;
  const active = tabs.find(t => t.id === activeId);
  if (active) {
    const title = tabState(active).title;
    win.setTitle(title === 'New tab' ? 'SwiftBrowse' : `${title} — SwiftBrowse`);
  }
  emit('browser:state', stateSnapshot());
}
function layoutViews() {
  if (!win || win.isDestroyed()) return;
  const active = tabs.find(x => x.id === activeId && x.workspaceId === currentWorkspaceId);
  const secondary = secondaryId === activeId ? null : tabs.find(x => x.id === secondaryId && x.workspaceId === currentWorkspaceId);
  for (const item of tabs) {
    if (item === active || item === secondary) continue;
    try { win.contentView.removeChildView(item.view); } catch {}
  }
  if (active) {
    win.contentView.addChildView(active.view);
    const [width, height] = win.getContentSize();
    const x = (sidebarExpanded ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH) + (sidePanel ? SIDE_PANEL_WIDTH : 0);
    const availableWidth = Math.max(1, width - x);
    const pageHeight = Math.max(1, height - CHROME_HEIGHT);
    if (secondary) {
      const split = Math.floor(availableWidth / 2);
      active.view.setBounds({ x, y: CHROME_HEIGHT, width: split, height: pageHeight });
      win.contentView.addChildView(secondary.view);
      secondary.view.setBounds({ x: x + split, y: CHROME_HEIGHT, width: availableWidth - split, height: pageHeight });
    } else {
      active.view.setBounds({ x, y: CHROME_HEIGHT, width: availableWidth, height: pageHeight });
    }
  }
  sendState();
}
function persistHistory() { writeJson(DATA_PATH('history.json'), historyEntries); }
function recordVisit(tab, url) {
  if (tab.isPrivate || !/^https?:\/\//i.test(url)) return;
  const entry = { title: tab.view.webContents.getTitle() || url, url, visitedAt: Date.now() };
  if (historyEntries[0]?.url === url) historyEntries[0] = entry;
  else historyEntries.unshift(entry);
  historyEntries = historyEntries.slice(0, 3000);
  persistHistory();
  sendState();
}
function makeView(isPrivate = false) {
  const partition = isPrivate ? PRIVATE_PARTITION : partitionFor(currentWorkspaceId);
  const ses = session.fromPartition(partition);
  installSessionHandlers(ses);
  if (blocker && blockAvailable && blockEnabled) blocker.enableBlockingInSession(ses);
  const view = new WebContentsView({ webPreferences: { partition, contextIsolation: true, sandbox: true, webSecurity: true } });
  const id = nextId++;
  view.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const protocol = new URL(url).protocol;
      if (protocol === 'https:' || protocol === 'http:') newTab(url, isPrivate);
    } catch {}
    return { action: 'deny' };
  });
  view.webContents.on('will-navigate', (event, url) => {
    try {
      const protocol = new URL(url).protocol;
      if (!['https:', 'http:'].includes(protocol) && url !== START_PAGE_URL && url !== 'about:blank') event.preventDefault();
    } catch { event.preventDefault(); }
  });
  const tab = { id, view, workspaceId: currentWorkspaceId, isPrivate };
  view.webContents.on('did-navigate', (_event, url) => recordVisit(tab, url));
  view.webContents.on('page-title-updated', () => {
    const url = view.webContents.getURL();
    if (!isPrivate && /^https?:\/\//i.test(url)) {
      const previous = historyEntries.find(entry => entry.url === url);
      if (previous) { previous.title = view.webContents.getTitle() || previous.title; persistHistory(); }
    }
    sendState();
  });
  for (const event of ['did-start-loading','did-stop-loading','did-navigate-in-page','did-fail-load']) view.webContents.on(event, sendState);
  tabs.push(tab);
  activeId = id;
  layoutViews();
  return tab;
}
function newTab(url, isPrivate) {
  const currentTab = tabs.find(t => t.id === activeId && t.workspaceId === currentWorkspaceId);
  const privateMode = isPrivate ?? currentTab?.isPrivate ?? false;
  const tab = makeView(privateMode);
  if (url) tab.view.webContents.loadURL(url).catch(() => {});
  else tab.view.webContents.loadFile(START_PAGE).catch(() => {});
  return tab.id;
}
function navigate(raw) {
  const tab = tabs.find(x => x.id === activeId && x.workspaceId === currentWorkspaceId);
  if (!tab) return;
  const value = String(raw || '').trim();
  if (!value) return;
  let target;
  if (/^https?:\/\//i.test(value)) target = value;
  else if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(value) || /^[^\s]+\.[a-z]{2,}(:\d+)?(\/.*)?$/i.test(value)) target = `https://${value}`;
  else target = `https://www.google.com/search?q=${encodeURIComponent(value)}`;
  tab.view.webContents.loadURL(target).catch(() => {});
}
function installSessionHandlers(ses) {
  if (watchedSessions.has(ses)) return;
  watchedSessions.add(ses);
  ses.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
    callback({ requestHeaders: { ...details.requestHeaders, DNT: '1', 'Sec-GPC': '1' } });
  });
  ses.on('will-download', (_event, item) => {
    const id = randomUUID();
    const entry = { id, name: item.getFilename(), url: item.getURL(), state: 'Downloading', received: 0, total: item.getTotalBytes(), savedTo: '' };
    downloads.unshift(entry);
    downloads = downloads.slice(0, 100);
    const update = () => {
      entry.name = item.getFilename(); entry.received = item.getReceivedBytes(); entry.total = item.getTotalBytes();
      entry.savedTo = item.getSavePath() || '';
      sendState();
    };
    item.on('updated', (_e, state) => { entry.state = state === 'interrupted' ? 'Interrupted' : 'Downloading'; update(); });
    item.once('done', (_e, state) => { entry.state = state === 'completed' ? 'Completed' : state === 'cancelled' ? 'Cancelled' : 'Interrupted'; update(); });
    sendState();
  });
}
function allSessions() {
  return [...workspaces.map(w => session.fromPartition(partitionFor(w.id))), session.fromPartition(PRIVATE_PARTITION)];
}
function attachBlocker(ses) {
  if (blocker && blockAvailable && blockEnabled) blocker.enableBlockingInSession(ses);
}
async function loadFilters() {
  const cachePath = FILTER_PATH();
  try {
    let cacheAge = Infinity;
    try {
      const stats = await fsp.stat(cachePath);
      cacheAge = Date.now() - stats.mtimeMs;
      blocker = ElectronBlocker.deserialize(await fsp.readFile(cachePath));
      blocker.on('request-blocked', () => { blockedCount++; emit('browser:blocked', blockedCount); });
      for (const ses of allSessions()) attachBlocker(ses);
      blockAvailable = true;
      if (cacheAge <= 7 * 86400000) return;
    } catch { blocker = undefined; }
    const updated = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
    if (blocker) for (const ses of allSessions()) blocker.disableBlockingInSession(ses);
    blocker = updated;
    blocker.on('request-blocked', () => { blockedCount++; emit('browser:blocked', blockedCount); });
    for (const ses of allSessions()) attachBlocker(ses);
    blockAvailable = true;
    await fsp.mkdir(path.dirname(cachePath), { recursive: true });
    await fsp.writeFile(cachePath, blocker.serialize());
  } catch (error) {
    console.warn('Ad and tracker filter lists could not be loaded.', error.message);
    if (!blocker) { blockAvailable = false; blockEnabled = false; }
  }
}
function createWindow() {
  win = new BrowserWindow({ width: 1480, height: 940, minWidth: 900, minHeight: 620, title: 'SwiftBrowse', backgroundColor: '#0d111a', webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false } });
  win.loadFile(path.join(__dirname, 'ui', 'index.html'));
  win.on('resize', layoutViews);
  win.on('closed', () => { for (const t of tabs) t.view.webContents.close(); tabs = []; win = null; });
  newTab();
}
app.whenReady().then(async () => {
  loadLocalData();
  await loadFilters();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('browser:get-state', () => stateSnapshot());
ipcMain.on('browser:new-tab', () => newTab());
ipcMain.on('browser:new-private-tab', () => newTab(undefined, true));
ipcMain.on('browser:activate-tab', (_e, id) => { if (visibleTabs().some(t => t.id === id)) { if (id === secondaryId) secondaryId = activeId; activeId = id; layoutViews(); } });
ipcMain.on('browser:close-tab', async (_e, id) => {
  const i = tabs.findIndex(t => t.id === id && t.workspaceId === currentWorkspaceId); if (i < 0) return;
  const removed = tabs[i]; removed.view.webContents.close(); tabs.splice(i, 1);
  if (id === secondaryId) secondaryId = null;
  if (removed.isPrivate && !tabs.some(t => t.isPrivate)) {
    const ses = session.fromPartition(PRIVATE_PARTITION);
    await Promise.all([ses.clearStorageData(), ses.clearCache()]);
  }
  if (!visibleTabs().length) { newTab(); return; }
  if (id === activeId) activeId = visibleTabs()[Math.max(0, i)].id;
  layoutViews();
});
ipcMain.on('browser:navigate', (_e, url) => navigate(url));
ipcMain.on('browser:back', () => { const t=tabs.find(x=>x.id===activeId); if(t?.view.webContents.canGoBack())t.view.webContents.goBack(); });
ipcMain.on('browser:forward', () => { const t=tabs.find(x=>x.id===activeId); if(t?.view.webContents.canGoForward())t.view.webContents.goForward(); });
ipcMain.on('browser:reload', () => tabs.find(x=>x.id===activeId)?.view.webContents.reload());
ipcMain.on('browser:home', () => { const t=tabs.find(x=>x.id===activeId); if(t)t.view.webContents.loadFile(START_PAGE).catch(()=>{}); });
ipcMain.on('browser:set-side-panel', (_e, panel) => { sidePanel = ['bookmarks','history','downloads','workspaces','appearance','privacy'].includes(panel) ? (sidePanel === panel ? null : panel) : null; layoutViews(); });
ipcMain.on('browser:set-sidebar-expanded', (_e, value) => { sidebarExpanded = !!value; layoutViews(); });
ipcMain.on('browser:toggle-split', () => {
  if (secondaryId) secondaryId = null;
  else {
    const other = visibleTabs().find(t => t.id !== activeId);
    if (other) secondaryId = other.id;
    else { const previous = activeId; secondaryId = newTab(); activeId = previous; }
  }
  layoutViews();
});
ipcMain.on('browser:switch-workspace', (_e, id) => {
  if (!workspaces.some(w => w.id === id)) return;
  currentWorkspaceId = id;
  secondaryId = null;
  const first = visibleTabs()[0];
  if (first) activeId = first.id; else { newTab(); return; }
  sidePanel = null; layoutViews();
});
ipcMain.on('browser:create-workspace', (_e, rawName) => {
  const name = String(rawName || '').trim().replace(/\s+/g, ' ').slice(0, 24);
  if (!name || workspaces.length >= 8) return;
  const icons = ['◉','▤','✳','◇','◌','⬡','◈','△'];
  const workspace = { id: randomUUID(), name, icon: icons[workspaces.length % icons.length] };
  workspaces.push(workspace); writeJson(DATA_PATH('workspaces.json'), workspaces);
  currentWorkspaceId = workspace.id; sidePanel = null; newTab();
});
ipcMain.on('browser:delete-workspace', async (_e, id) => {
  if (workspaces.length <= 1 || !workspaces.some(w => w.id === id)) return;
  if (tabs.some(t => t.workspaceId === id && t.id === secondaryId)) secondaryId = null;
  for (const tab of tabs.filter(t => t.workspaceId === id)) { tab.view.webContents.close(); tabs.splice(tabs.indexOf(tab), 1); }
  const removedSession = session.fromPartition(partitionFor(id));
  await Promise.all([removedSession.clearStorageData(), removedSession.clearCache()]);
  workspaces = workspaces.filter(w => w.id !== id); writeJson(DATA_PATH('workspaces.json'), workspaces);
  if (currentWorkspaceId === id) { currentWorkspaceId = workspaces[0].id; if (!visibleTabs().length) { newTab(); return; } activeId = visibleTabs()[0].id; }
  if (!visibleTabs().some(t => t.id === activeId)) activeId = visibleTabs()[0]?.id || null;
  layoutViews();
});
ipcMain.on('browser:toggle-blocking', (_e, value) => {
  blockEnabled = !!value && blockAvailable;
  for (const ses of allSessions()) {
    if (!blocker) continue;
    if (blockEnabled) blocker.enableBlockingInSession(ses); else blocker.disableBlockingInSession(ses);
  }
  sendState();
});
ipcMain.on('browser:clear-data', async () => {
  await Promise.all(allSessions().map(async ses => Promise.all([ses.clearStorageData(), ses.clearCache()])));
  historyEntries = []; downloads = []; blockedCount = 0; persistHistory(); sendState();
});
ipcMain.on('browser:bookmark', () => {
  const t=tabs.find(x=>x.id===activeId); if(!t)return; const url=t.view.webContents.getURL();
  if(!/^https?:\/\//i.test(url))return;
  const existing=bookmarks.findIndex(b=>b.url===url);
  if(existing>=0)bookmarks.splice(existing,1);else bookmarks.unshift({title:t.view.webContents.getTitle()||url,url});
  bookmarks=bookmarks.slice(0,100);writeJson(DATA_PATH('bookmarks.json'),bookmarks);sendState();
});
ipcMain.on('browser:open-external', (_e, url) => { if(/^https?:\/\//i.test(url))shell.openExternal(url); });
ipcMain.on('browser:devtools', () => tabs.find(x=>x.id===activeId)?.view.webContents.toggleDevTools());

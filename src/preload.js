const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('browser', {
  getState: () => ipcRenderer.invoke('browser:get-state'),
  onState: callback => ipcRenderer.on('browser:state', (_e, value) => callback(value)),
  onBlocked: callback => ipcRenderer.on('browser:blocked', (_e, value) => callback(value)),
  newTab: () => ipcRenderer.send('browser:new-tab'), newPrivateTab: () => ipcRenderer.send('browser:new-private-tab'),
  activateTab: id => ipcRenderer.send('browser:activate-tab', id), closeTab: id => ipcRenderer.send('browser:close-tab', id),
  navigate: url => ipcRenderer.send('browser:navigate', url), back: () => ipcRenderer.send('browser:back'), forward: () => ipcRenderer.send('browser:forward'), reload: () => ipcRenderer.send('browser:reload'), home: () => ipcRenderer.send('browser:home'),
  setSidePanel: panel => ipcRenderer.send('browser:set-side-panel', panel), setSidebarExpanded: value => ipcRenderer.send('browser:set-sidebar-expanded', value), toggleSplit: () => ipcRenderer.send('browser:toggle-split'),
  switchWorkspace: id => ipcRenderer.send('browser:switch-workspace', id), createWorkspace: name => ipcRenderer.send('browser:create-workspace', name), deleteWorkspace: id => ipcRenderer.send('browser:delete-workspace', id),
  toggleBlocking: value => ipcRenderer.send('browser:toggle-blocking', value), clearData: () => ipcRenderer.send('browser:clear-data'), bookmark: () => ipcRenderer.send('browser:bookmark'), openExternal: url => ipcRenderer.send('browser:open-external', url), devtools: () => ipcRenderer.send('browser:devtools')
});

const $ = id => document.getElementById(id);
const ACCENTS = { Violet:'#aa8aff', Mint:'#59d9b0', Blue:'#68a8ff', Ember:'#ff936f', Rose:'#f181bd' };
let state={tabs:[],activeId:null,blockedCount:0,blockEnabled:false,blockAvailable:false,bookmarks:[],history:[],downloads:[],workspaces:[],currentWorkspaceId:null,sidebarExpanded:false,sidePanel:null};
let toastTimer;
function toast(message){const t=$('toast');t.textContent=message;t.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.add('hidden'),2500)}
function node(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el}
function openPanel(name){window.browser.setSidePanel(name)}
function formatWhen(timestamp){const d=new Date(timestamp);return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(d)}
function renderTabs(){
  $('tabs').replaceChildren();
  state.tabs.forEach(tab=>{const el=node('div','tab'+(tab.active?' active':'')+(tab.isPrivate?' private-tab':''));el.title=tab.url||tab.title;const icon=node('span','favicon',tab.isPrivate?'◐':tab.loading?'◌':(tab.title||'S').trim().charAt(0).toUpperCase());const label=node('span','label',tab.title||'New tab');const close=node('button','close','×');close.title='Close tab';close.onclick=e=>{e.stopPropagation();window.browser.closeTab(tab.id)};el.append(icon,label,close);el.onclick=()=>window.browser.activateTab(tab.id);$('tabs').append(el)});
}
function renderSidePanel(){
  const panel=state.sidePanel,root=$('side-panel'),body=$('side-panel-body');
  root.classList.toggle('hidden',!panel);if(!panel)return;
  const titles={workspaces:'Workspaces',bookmarks:'Bookmarks',history:'History',downloads:'Downloads',appearance:'Appearance',privacy:'Privacy center'};
  $('panel-title').textContent=titles[panel]||'Browser tools';body.replaceChildren();
  if(panel==='workspaces'){
    body.append(node('p','panel-copy','Keep school, work, and personal tabs in separate spaces. Each workspace has its own cookies and sign-ins.'));
    for(const workspace of state.workspaces){const row=node('div','workspace-row'+(workspace.id===state.currentWorkspaceId?' selected':''));const choose=node('button','workspace-choice');choose.append(node('span','workspace-icon',workspace.icon),node('span','workspace-choice-text',workspace.name),node('span','workspace-current-mark',workspace.id===state.currentWorkspaceId?'CURRENT':''));choose.onclick=()=>window.browser.switchWorkspace(workspace.id);row.append(choose);if(state.workspaces.length>1){const del=node('button','workspace-delete','×');del.title=`Remove ${workspace.name}`;del.onclick=()=>{if(confirm(`Remove the “${workspace.name}” workspace and its saved site data?`))window.browser.deleteWorkspace(workspace.id)};row.append(del)}body.append(row)}
    const form=node('form','workspace-form');const input=node('input','');input.placeholder='Name a new workspace';input.maxLength=24;input.setAttribute('aria-label','New workspace name');const add=node('button','workspace-add','＋');add.type='submit';add.title='Create workspace';form.append(input,add);form.onsubmit=e=>{e.preventDefault();if(input.value.trim()){window.browser.createWorkspace(input.value);input.value=''}};body.append(form);body.append(node('div','panel-footnote',`${state.workspaces.length}/8 spaces · Site data is kept separately for each one.`));
  }else if(panel==='bookmarks'){
    if(!state.bookmarks.length)body.append(node('div','empty-panel','Your saved pages will appear here.'));
    state.bookmarks.forEach(item=>{const row=node('button','list-row');row.append(node('span','list-symbol','☆'));const copy=node('span','list-copy');copy.append(node('strong','',item.title),node('small','',item.url));row.append(copy);row.onclick=()=>{window.browser.navigate(item.url);window.browser.setSidePanel(null)};body.append(row)});
  }else if(panel==='history'){
    const toolbar=node('div','panel-toolbar');toolbar.append(node('span','panel-copy-strong',`Latest ${state.history.length} visits`));const clear=node('button','text-button','Clear browsing data');clear.onclick=()=>{window.browser.clearData();toast('History and browsing data cleared')};toolbar.append(clear);body.append(toolbar);
    if(!state.history.length)body.append(node('div','empty-panel','Pages you visit will appear here on this device. Private tabs are not saved.'));
    state.history.forEach(item=>{const row=node('button','list-row');row.append(node('span','list-symbol','◷'));const copy=node('span','list-copy');copy.append(node('strong','',item.title),node('small','',`${formatWhen(item.visitedAt)} · ${item.url}`));row.append(copy);row.onclick=()=>{window.browser.navigate(item.url);window.browser.setSidePanel(null)};body.append(row)});
  }else if(panel==='downloads'){
    if(!state.downloads.length)body.append(node('div','empty-panel','Downloads started in this session will appear here.'));
    state.downloads.forEach(item=>{const row=node('div','download-row');row.append(node('span','download-icon',item.state==='Completed'?'✓':'↓'));const copy=node('span','list-copy');copy.append(node('strong','',item.name),node('small','',`${item.state}${item.total?` · ${Math.floor(item.received/item.total*100)}%`:''}${item.savedTo?` · ${item.savedTo}`:''}`));row.append(copy);body.append(row)});
  }else if(panel==='appearance'){
    body.append(node('p','panel-copy','Make the browser feel like yours. Your accent is saved on this device.'));
    body.append(node('h3','panel-section-title','ACCENT COLOUR'));const swatches=node('div','swatches');Object.entries(ACCENTS).forEach(([name])=>{const b=node('button','swatch');b.dataset.accent=name.toLowerCase();b.title=name;b.setAttribute('aria-label',`${name} accent`);b.classList.toggle('selected',localStorage.getItem('swiftbrowse-accent')===name||(!localStorage.getItem('swiftbrowse-accent')&&name==='Violet'));b.onclick=()=>setAccent(name);swatches.append(b)});body.append(swatches);
    body.append(node('h3','panel-section-title space-top','SIDEBAR'));const expand=node('button','settings-toggle');expand.append(node('span','','Expand sidebar for labels'),node('span','setting-state',state.sidebarExpanded?'On':'Off'));expand.onclick=()=>window.browser.setSidebarExpanded(!state.sidebarExpanded);body.append(expand);
  }else if(panel==='privacy'){
    const status=node('div','privacy-status');status.append(node('span',`privacy-orb${state.blockEnabled&&state.blockAvailable?'':' is-off'}`,'◈'));const info=node('span','');info.append(node('strong','',!state.blockAvailable?'Filter lists unavailable':state.blockEnabled?'Protection is on':'Protection is off'),node('small','',`${state.blockedCount.toLocaleString()} ad or tracker requests blocked this session`));status.append(info);body.append(status);
    const toggle=node('button','settings-toggle');toggle.append(node('span','','Block ads and trackers'),node('span','setting-state',!state.blockAvailable?'Unavailable':state.blockEnabled?'On':'Off'));toggle.disabled=!state.blockAvailable;toggle.onclick=()=>window.browser.toggleBlocking(!state.blockEnabled);body.append(toggle);
    const signals=node('div','privacy-detail');signals.append(node('span','detail-check','✓'),node('span','','Do Not Track and Global Privacy Control signals are sent'));signals.append(node('span','detail-check','✓'),node('span','','Workspace sign-ins and cookies are separated'));signals.append(node('span','detail-check','✓'),node('span','','Private tabs do not save history'));body.append(signals);
    const clear=node('button','danger-action','Clear browsing data');clear.onclick=()=>{window.browser.clearData();toast('Browsing data cleared')};body.append(clear);
  }
}
function render(){
  document.body.classList.toggle('expanded',state.sidebarExpanded);
  renderTabs();
  const active=state.tabs.find(t=>t.id===state.activeId);
  if(active&&document.activeElement!==$('address'))$('address').value=active.url||'';
  const secure=!!active?.url.startsWith('https://');$('security').title=secure?'Secure HTTPS connection':active?.url.startsWith('http://')?'Connection is not secure':'Local start page';$('security').classList.toggle('insecure',!!active?.url.startsWith('http://'));
  const saved=!!active&&state.bookmarks.some(b=>b.url===active.url);$('bookmark').textContent=saved?'★':'☆';$('bookmark').title=saved?'Remove bookmark':'Bookmark this page';$('bookmark').disabled=!active?.url;
  $('back').disabled=!active?.canGoBack;$('forward').disabled=!active?.canGoForward;
  $('split-view').classList.toggle('selected',!!state.secondaryId);$('split-view').title=state.secondaryId?'Close split view':'Open split view';$('split-view').setAttribute('aria-label',$('split-view').title);
  const filtering=state.blockEnabled&&state.blockAvailable;
  $('blocked-count').textContent=state.blockedCount>999?'999+':String(state.blockedCount);$('sidebar-blocked').textContent=state.blockedCount>999?'999+':String(state.blockedCount);$('shield').title=!state.blockAvailable?'Filter lists are unavailable':filtering?'Ad and tracker blocking is on':'Ad and tracker blocking is off';$('shield').classList.toggle('off',!filtering);
  $('workspace-name').textContent=state.workspaces.find(w=>w.id===state.currentWorkspaceId)?.name||'Workspace';$('workspace-icon').textContent=state.workspaces.find(w=>w.id===state.currentWorkspaceId)?.icon||'◉';$('workspace-chip').textContent=(state.workspaces.find(w=>w.id===state.currentWorkspaceId)?.name||'Workspace').toUpperCase();$('private-chip').classList.toggle('hidden',!active?.isPrivate);$('chrome').classList.toggle('private-mode',!!active?.isPrivate);
  $('bookmarks-bar').replaceChildren();state.bookmarks.slice(0,12).forEach(item=>{const b=node('button','bookmark-item',item.title);b.title=item.url;b.onclick=()=>window.browser.navigate(item.url);$('bookmarks-bar').append(b)});
  $('progress').classList.toggle('loading',!!active?.loading);
  renderSidePanel();
}
function setAccent(name){if(!ACCENTS[name])return;localStorage.setItem('swiftbrowse-accent',name);document.documentElement.dataset.accent=name.toLowerCase();renderSidePanel()}
const savedAccent=localStorage.getItem('swiftbrowse-accent');setAccent(ACCENTS[savedAccent]?savedAccent:'Violet');
window.browser.onState(value=>{state=value;render()});window.browser.onBlocked(value=>{state.blockedCount=value;render()});window.browser.getState().then(value=>{state=value;render()});
$('address-form').addEventListener('submit',e=>{e.preventDefault();window.browser.navigate($('address').value);$('address').blur()});
$('back').onclick=()=>window.browser.back();$('forward').onclick=()=>window.browser.forward();$('reload').onclick=()=>window.browser.reload();$('home').onclick=()=>window.browser.home();$('new-tab').onclick=()=>window.browser.newTab();$('split-view').onclick=()=>window.browser.toggleSplit();$('side-new-tab').onclick=()=>window.browser.newTab();$('side-private').onclick=()=>window.browser.newPrivateTab();$('menu-new-private').onclick=()=>{window.browser.newPrivateTab();$('menu-panel').classList.add('hidden')};
$('brand').onclick=()=>window.browser.home();$('bookmark').onclick=()=>{window.browser.bookmark();toast('Bookmark saved or removed')};$('workspace-current').onclick=()=>openPanel('workspaces');$('expand-sidebar').onclick=()=>window.browser.setSidebarExpanded(!state.sidebarExpanded);$('close-panel').onclick=()=>window.browser.setSidePanel(null);
document.querySelectorAll('[data-panel]').forEach(button=>button.onclick=()=>openPanel(button.dataset.panel));
$('shield').onclick=()=>openPanel('privacy');$('menu').onclick=()=> $('menu-panel').classList.toggle('hidden');
$('clear-data').onclick=()=>{window.browser.clearData();$('menu-panel').classList.add('hidden');toast('Browsing data cleared')};$('devtools').onclick=()=>window.browser.devtools();
document.addEventListener('keydown',e=>{
  const mod=e.metaKey||e.ctrlKey;
  if(mod&&e.key.toLowerCase()==='l'){e.preventDefault();$('address').focus();$('address').select()}
  if(mod&&e.key.toLowerCase()==='t'){e.preventDefault();window.browser.newTab()}
  if(mod&&e.shiftKey&&e.key.toLowerCase()==='n'){e.preventDefault();window.browser.newPrivateTab()}
  if(mod&&e.key.toLowerCase()==='w'){e.preventDefault();if(state.activeId)window.browser.closeTab(state.activeId)}
  if(mod&&e.key==='Tab'&&state.tabs.length>1){e.preventDefault();const i=state.tabs.findIndex(t=>t.id===state.activeId);const next=(i+(e.shiftKey?-1:1)+state.tabs.length)%state.tabs.length;window.browser.activateTab(state.tabs[next].id)}
  if(e.key==='Escape'){$('menu-panel').classList.add('hidden');if(state.sidePanel)window.browser.setSidePanel(null)}
});
document.addEventListener('click',e=>{if(!$('menu-panel').contains(e.target)&&e.target!==$('menu'))$('menu-panel').classList.add('hidden')});

const STORAGE_KEY = 'aluminum-cad-workbench-layout-v1';

/**
 * 工作台布局管理器。
 *
 * 设计目标：
 * 1. 左/右面板默认停靠，不遮挡三维画布；拖动标题条后自动变成浮动面板。
 * 2. 浮动面板和画布浮动工具不会被拖出可视区域。
 * 3. 面板宽度、浮动位置和工具条位置保存到浏览器本地。
 * 4. 布局变化后统一触发 resize，让 Three.js 立即匹配新的画布尺寸。
 */
export default class WorkbenchLayoutManager {
  constructor(options = {}) {
    this.workspace = options.workspace || document.querySelector('.workspace');
    this.canvas = options.canvas || document.querySelector('.canvas-shell');
    this.storageKey = options.storageKey || STORAGE_KEY;
    this.panels = new Map();
    this.floaters = new Map();
    this.cleanup = [];
    this.resizeTimer = null;
    this.zCounter = 1800;
    this.state = this.readState();
  }

  init() {
    if (!this.workspace || !this.canvas) return this;
    this.bindPanel('library','.library-panel','left',286);
    this.bindPanel('inspector','.inspector-panel','right',318);
    this.bindFloater('toolbar','.canvas-transform-bar');
    this.bindFloater('viewCube','.view-cube');
    this.applyStoredLayout();
    const onResize = () => this.clampAll();
    window.addEventListener('resize',onResize);
    this.cleanup.push(() => window.removeEventListener('resize',onResize));
    return this;
  }

  destroy() {
    for (const dispose of this.cleanup.splice(0)) dispose();
    clearTimeout(this.resizeTimer);
  }

  readState() {
    try {
      const text = localStorage.getItem(this.storageKey);
      return text ? JSON.parse(text) : {};
    } catch (_) {
      return {};
    }
  }

  persist() {
    try { localStorage.setItem(this.storageKey,JSON.stringify(this.state)); } catch (_) {}
  }

  notifyResize() {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => window.dispatchEvent(new Event('resize')),20);
  }

  panelState(name,defaultWidth) {
    if (!this.state.panels) this.state.panels = {};
    if (!this.state.panels[name]) this.state.panels[name] = {mode:'docked',width:defaultWidth};
    return this.state.panels[name];
  }

  floaterState(name) {
    if (!this.state.floaters) this.state.floaters = {};
    if (!this.state.floaters[name]) this.state.floaters[name] = {custom:false};
    return this.state.floaters[name];
  }

  bindPanel(name,selector,side,defaultWidth) {
    const element = document.querySelector(selector);
    if (!element) return;
    const handle = element.querySelector(`[data-layout-drag="${name}"]`);
    const dockButton = element.querySelector(`[data-layout-dock="${name}"]`);
    const resizeHandle = element.querySelector(`[data-layout-resize="${name}"]`);
    const item = {name,element,handle,dockButton,resizeHandle,side,defaultWidth};
    this.panels.set(name,item);

    if (handle) {
      const down = event => this.startPanelDrag(item,event);
      const dbl = event => { event.preventDefault(); this.dockPanel(name); };
      handle.addEventListener('pointerdown',down);
      handle.addEventListener('dblclick',dbl);
      this.cleanup.push(() => {handle.removeEventListener('pointerdown',down);handle.removeEventListener('dblclick',dbl);});
    }
    if (dockButton) {
      const click = event => { event.stopPropagation(); this.dockPanel(name); };
      dockButton.addEventListener('click',click);
      this.cleanup.push(() => dockButton.removeEventListener('click',click));
    }
    if (resizeHandle) {
      const down = event => this.startPanelResize(item,event);
      resizeHandle.addEventListener('pointerdown',down);
      this.cleanup.push(() => resizeHandle.removeEventListener('pointerdown',down));
    }
  }

  bindFloater(name,selector) {
    const element = document.querySelector(selector);
    if (!element) return;
    const handle = element.querySelector(`[data-floating-drag="${name}"]`);
    if (!handle) return;
    const item = {name,element,handle};
    this.floaters.set(name,item);
    const down = event => this.startFloaterDrag(item,event);
    const dbl = event => { event.preventDefault(); this.resetFloater(name); };
    handle.addEventListener('pointerdown',down);
    handle.addEventListener('dblclick',dbl);
    this.cleanup.push(() => {handle.removeEventListener('pointerdown',down);handle.removeEventListener('dblclick',dbl);});
  }

  applyStoredLayout() {
    for (const item of this.panels.values()) {
      const state = this.panelState(item.name,item.defaultWidth);
      state.width = this.clamp(Number(state.width || item.defaultWidth),220,520);
      if (state.mode === 'floating') this.applyFloatingPanel(item,state);
      else this.applyDockedPanel(item,state);
    }
    for (const item of this.floaters.values()) {
      const state = this.floaterState(item.name);
      if (state.custom) this.applyFloater(item,state);
    }
    this.syncWorkspaceTracks();
    requestAnimationFrame(() => this.clampAll());
  }

  syncWorkspaceTracks() {
    const library = this.panelState('library',286);
    const inspector = this.panelState('inspector',318);
    this.workspace.style.setProperty('--library-track',library.mode === 'floating' ? '0px' : `${library.width}px`);
    this.workspace.style.setProperty('--inspector-track',inspector.mode === 'floating' ? '0px' : `${inspector.width}px`);
    this.workspace.dataset.libraryMode = library.mode;
    this.workspace.dataset.inspectorMode = inspector.mode;
    this.notifyResize();
  }

  applyDockedPanel(item,state) {
    const el = item.element;
    el.classList.remove('layout-floating');
    el.dataset.layoutMode = 'docked';
    el.style.left = '';
    el.style.top = '';
    el.style.width = '';
    el.style.height = '';
    el.style.transform = '';
    el.style.zIndex = '';
    if (item.dockButton) item.dockButton.hidden = true;
  }

  applyFloatingPanel(item,state) {
    const el = item.element;
    el.classList.add('layout-floating');
    el.dataset.layoutMode = 'floating';
    el.style.width = `${this.clamp(Number(state.width || item.defaultWidth),220,520)}px`;
    el.style.height = `${this.clamp(Number(state.height || Math.min(window.innerHeight - 100,720)),260,Math.max(300,window.innerHeight - 70))}px`;
    el.style.left = `${Number(state.x || 84)}px`;
    el.style.top = `${Number(state.y || 72)}px`;
    if (item.dockButton) item.dockButton.hidden = false;
  }

  floatPanel(name,rect = null) {
    const item = this.panels.get(name);
    if (!item) return;
    const state = this.panelState(name,item.defaultWidth);
    const sourceRect = rect || item.element.getBoundingClientRect();
    state.mode = 'floating';
    state.width = this.clamp(sourceRect.width || state.width || item.defaultWidth,220,520);
    state.height = this.clamp(sourceRect.height || window.innerHeight - 90,260,Math.max(300,window.innerHeight - 70));
    state.x = this.clamp(sourceRect.left,6,Math.max(6,window.innerWidth - state.width - 6));
    state.y = this.clamp(sourceRect.top,58,Math.max(58,window.innerHeight - state.height - 6));
    this.applyFloatingPanel(item,state);
    this.syncWorkspaceTracks();
    this.persist();
  }

  dockPanel(name) {
    const item = this.panels.get(name);
    if (!item) return;
    const state = this.panelState(name,item.defaultWidth);
    state.mode = 'docked';
    this.applyDockedPanel(item,state);
    this.syncWorkspaceTracks();
    this.persist();
  }

  startPanelDrag(item,event) {
    if (event.button !== 0 || event.target.closest('button,input,select')) return;
    event.preventDefault();
    const rect = item.element.getBoundingClientRect();
    item.element.style.zIndex=String(++this.zCounter);
    const state = this.panelState(item.name,item.defaultWidth);
    if (state.mode !== 'floating') this.floatPanel(item.name,rect);
    const floatingRect = item.element.getBoundingClientRect();
    const offsetX = event.clientX - floatingRect.left;
    const offsetY = event.clientY - floatingRect.top;
    item.handle?.setPointerCapture?.(event.pointerId);
    item.element.classList.add('layout-dragging');
    const move = moveEvent => {
      const width = item.element.offsetWidth;
      const height = item.element.offsetHeight;
      state.x = this.clamp(moveEvent.clientX - offsetX,4,Math.max(4,window.innerWidth - width - 4));
      state.y = this.clamp(moveEvent.clientY - offsetY,54,Math.max(54,window.innerHeight - height - 4));
      item.element.style.left = `${state.x}px`;
      item.element.style.top = `${state.y}px`;
    };
    const up = () => {
      item.element.classList.remove('layout-dragging');
      window.removeEventListener('pointermove',move,true);
      window.removeEventListener('pointerup',up,true);
      const current=item.element.getBoundingClientRect();
      const nearDock=item.side==='left' ? current.left<=18 : current.right>=window.innerWidth-18;
      if(nearDock){this.dockPanel(item.name);return;}
      this.persist();
      this.notifyResize();
    };
    window.addEventListener('pointermove',move,true);
    window.addEventListener('pointerup',up,true);
  }

  startPanelResize(item,event) {
    if (event.button !== 0) return;
    event.preventDefault();
    const state = this.panelState(item.name,item.defaultWidth);
    const startX = event.clientX;
    const startY = event.clientY;
    const rect=item.element.getBoundingClientRect();
    const startWidth = rect.width;
    const startLeft = rect.left;
    const move = moveEvent => {
      const floating = state.mode === 'floating';
      const delta=moveEvent.clientX-startX;
      let width = startWidth + (item.side === 'right' ? -delta : delta);
      width = this.clamp(width,220,520);
      state.width = width;
      if (floating) {
        if(item.side==='right'){
          const rightEdge=startLeft+startWidth;
          state.x=this.clamp(rightEdge-width,4,Math.max(4,window.innerWidth-width-4));
          item.element.style.left=`${state.x}px`;
        }
        item.element.style.width = `${state.width}px`;
      } else {
        this.syncWorkspaceTracks();
      }
      this.notifyResize();
    };
    const up = () => {
      window.removeEventListener('pointermove',move,true);
      window.removeEventListener('pointerup',up,true);
      this.persist();
      this.clampPanel(item);
    };
    window.addEventListener('pointermove',move,true);
    window.addEventListener('pointerup',up,true);
  }

  startFloaterDrag(item,event) {
    if (event.button !== 0) return;
    event.preventDefault();
    const state = this.floaterState(item.name);
    const canvasRect = this.canvas.getBoundingClientRect();
    const rect = item.element.getBoundingClientRect();
    state.custom = true;
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    item.element.classList.add('layout-custom-position','layout-dragging');
    const move = moveEvent => {
      const width = item.element.offsetWidth;
      const height = item.element.offsetHeight;
      state.x = this.clamp(moveEvent.clientX - canvasRect.left - offsetX,4,Math.max(4,canvasRect.width - width - 4));
      state.y = this.clamp(moveEvent.clientY - canvasRect.top - offsetY,4,Math.max(4,canvasRect.height - height - 44));
      this.applyFloater(item,state);
    };
    const up = () => {
      item.element.classList.remove('layout-dragging');
      window.removeEventListener('pointermove',move,true);
      window.removeEventListener('pointerup',up,true);
      this.persist();
    };
    window.addEventListener('pointermove',move,true);
    window.addEventListener('pointerup',up,true);
  }

  applyFloater(item,state) {
    item.element.classList.add('layout-custom-position');
    item.element.style.left = `${Number(state.x || 8)}px`;
    item.element.style.top = `${Number(state.y || 8)}px`;
    item.element.style.right = 'auto';
    item.element.style.transform = 'none';
  }

  resetFloater(name) {
    const item = this.floaters.get(name);
    if (!item) return;
    const state = this.floaterState(name);
    state.custom = false;
    delete state.x; delete state.y;
    item.element.classList.remove('layout-custom-position');
    item.element.style.left = '';
    item.element.style.top = '';
    item.element.style.right = '';
    item.element.style.transform = '';
    this.persist();
  }

  reset() {
    this.state = {};
    try { localStorage.removeItem(this.storageKey); } catch (_) {}
    for (const item of this.panels.values()) {
      const state = this.panelState(item.name,item.defaultWidth);
      state.mode = 'docked';
      state.width = item.defaultWidth;
      this.applyDockedPanel(item,state);
    }
    for (const item of this.floaters.values()) this.resetFloater(item.name);
    this.syncWorkspaceTracks();
    this.clampAll();
  }

  clampAll() {
    for (const item of this.panels.values()) this.clampPanel(item);
    for (const item of this.floaters.values()) this.clampFloater(item);
    this.notifyResize();
  }

  clampPanel(item) {
    const state = this.panelState(item.name,item.defaultWidth);
    if (state.mode !== 'floating') return;
    const width = item.element.offsetWidth;
    const height = item.element.offsetHeight;
    state.x = this.clamp(Number(state.x || 4),4,Math.max(4,window.innerWidth - width - 4));
    state.y = this.clamp(Number(state.y || 54),54,Math.max(54,window.innerHeight - height - 4));
    item.element.style.left = `${state.x}px`;
    item.element.style.top = `${state.y}px`;
    this.persist();
  }

  clampFloater(item) {
    const state = this.floaterState(item.name);
    if (!state.custom) return;
    const rect = this.canvas.getBoundingClientRect();
    state.x = this.clamp(Number(state.x || 4),4,Math.max(4,rect.width - item.element.offsetWidth - 4));
    state.y = this.clamp(Number(state.y || 4),4,Math.max(4,rect.height - item.element.offsetHeight - 44));
    this.applyFloater(item,state);
    this.persist();
  }

  clamp(value,min,max) { return Math.min(Math.max(Number(value)||0,min),Math.max(min,max)); }
}

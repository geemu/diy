/**
 * Persistent assembly/subassembly metadata.
 * Parts keep assemblyId for compatibility; hierarchy lives here.
 * v0.31 adds installation ordering and stronger hierarchy helpers.
 */
export default class AssemblyManager {
  constructor(editor) {
    this.editor = editor;
    this.assemblies = [];
  }

  load(list = []) {
    const source = Array.isArray(list) ? list : [];
    this.assemblies = structuredClone(source)
      .filter(Boolean)
      .map((item, index) => this.normalizeAssembly(item, index));
    this.reconcile();
    this.refreshPartVisibility();
  }

  export() {
    this.reconcile();
    return structuredClone(this.assemblies);
  }

  normalizeAssembly(item, index = 0) {
    return {
      id:item.id || crypto.randomUUID(),
      name:item.name || '组件',
      parentId:item.parentId || null,
      hidden:item.hidden === true,
      locked:item.locked === true,
      installationStep:Math.max(1, Number(item.installationStep || index + 1)),
      installationNote:String(item.installationNote || ''),
      manufacturingCode:item.manufacturingCode || null,
      explodeDirection:normalizeDirection(item.explodeDirection),
      kind:item.kind || null,
      configurator:item.configurator || null,
      parameters:item.parameters ? structuredClone(item.parameters) : null
    };
  }

  reconcile() {
    const used = new Set((this.editor.parts || []).map(part => part.assemblyId).filter(Boolean));
    for (const id of used) {
      if (!this.assemblies.some(item => item.id === id)) {
        this.assemblies.push(this.normalizeAssembly({
          id,
          name:`组件 ${String(id).slice(0, 6)}`,
          parentId:null
        }, this.assemblies.length));
      }
    }

    const ids = new Set(this.assemblies.map(item => item.id));
    for (const assembly of this.assemblies) {
      if (assembly.parentId && !ids.has(assembly.parentId)) assembly.parentId = null;
    }
    this.breakHierarchyCycles();
    this.normalizeAllSiblingSteps();
  }

  create(partIds, name = '新组件', parentId = null) {
    const ids = new Set(partIds || []);
    if (ids.size < 2) throw new Error('至少选择两个构件才能创建组件');
    if (parentId && !this.get(parentId)) throw new Error('父组件不存在');
    const id = crypto.randomUUID();
    const assembly = this.normalizeAssembly({
      id,
      name,
      parentId,
      installationStep:this.nextInstallationStep(parentId)
    });
    this.assemblies.push(assembly);
    for (const part of this.editor.parts || []) {
      if (ids.has(part.id)) part.assemblyId = id;
    }
    this.normalizeSiblingSteps(parentId);
    return id;
  }

  createParent(childAssemblyIds, name = '新总成', parentId = null) {
    const childIds = [...new Set((childAssemblyIds || []).filter(Boolean))];
    if (childIds.length < 2) throw new Error('至少选择两个组件才能创建子装配');
    for (const id of childIds) {
      if (!this.get(id)) throw new Error(`组件不存在：${id}`);
    }
    if (parentId && !this.get(parentId)) throw new Error('父组件不存在');
    const id = crypto.randomUUID();
    this.assemblies.push(this.normalizeAssembly({
      id,
      name,
      parentId,
      installationStep:this.nextInstallationStep(parentId)
    }));
    for (const childId of childIds) this.setParent(childId, id, false);
    this.normalizeSiblingSteps(id);
    this.normalizeSiblingSteps(parentId);
    return id;
  }

  rename(id, name) {
    const assembly = this.get(id);
    if (!assembly) throw new Error('组件不存在');
    assembly.name = String(name || '').trim() || assembly.name;
    return assembly;
  }

  setParent(id, parentId, normalize = true) {
    if (id === parentId) throw new Error('组件不能作为自己的父组件');
    const assembly = this.get(id);
    if (!assembly) throw new Error('组件不存在');
    if (parentId && !this.get(parentId)) throw new Error('父组件不存在');
    let cursor = parentId;
    while (cursor) {
      if (cursor === id) throw new Error('组件层级不能形成循环');
      cursor = this.get(cursor)?.parentId || null;
    }
    const previousParentId = assembly.parentId || null;
    assembly.parentId = parentId || null;
    assembly.installationStep = this.nextInstallationStep(assembly.parentId, id);
    if (normalize) {
      this.normalizeSiblingSteps(previousParentId);
      this.normalizeSiblingSteps(assembly.parentId);
    }
    return assembly;
  }

  dissolve(id) {
    const assembly = this.get(id);
    if (!assembly) return;
    const parentId = assembly.parentId || null;
    for (const part of this.editor.parts || []) {
      if (part.assemblyId === id) part.assemblyId = parentId;
    }
    for (const child of this.assemblies) {
      if (child.parentId === id) child.parentId = parentId;
    }
    this.assemblies = this.assemblies.filter(item => item.id !== id);
    this.normalizeSiblingSteps(parentId);
  }

  get(id) {
    return this.assemblies.find(item => item.id === id) || null;
  }

  getForPart(partId) {
    const part = (this.editor.parts || []).find(item => item.id === partId);
    return part?.assemblyId ? this.get(part.assemblyId) : null;
  }

  children(id) {
    return this.assemblies
      .filter(item => (item.parentId || null) === (id || null))
      .sort(compareAssemblyOrder);
  }

  ancestors(id) {
    const out = [];
    const seen = new Set();
    let cursor = this.get(id)?.parentId || null;
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      out.push(cursor);
      cursor = this.get(cursor)?.parentId || null;
    }
    return out;
  }

  descendants(id) {
    const out = [];
    const seen = new Set();
    const walk = parentId => {
      for (const child of this.children(parentId)) {
        if (seen.has(child.id)) continue;
        seen.add(child.id);
        out.push(child.id);
        walk(child.id);
      }
    };
    walk(id);
    return out;
  }

  directPartIds(id) {
    return (this.editor.parts || [])
      .filter(part => part.assemblyId === id)
      .map(part => part.id);
  }

  partIds(id, deep = true) {
    const assemblyIds = new Set([id, ...(deep ? this.descendants(id) : [])]);
    return (this.editor.parts || [])
      .filter(part => assemblyIds.has(part.assemblyId))
      .map(part => part.id);
  }

  isAssemblyLocked(id) {
    const chain = [id, ...this.ancestors(id)];
    return chain.some(itemId => this.get(itemId)?.locked === true);
  }

  isAssemblyHidden(id) {
    const chain = [id, ...this.ancestors(id)];
    return chain.some(itemId => this.get(itemId)?.hidden === true);
  }

  isPartEffectivelyLocked(part) {
    if (!part) return false;
    if (part.locked === true) return true;
    return part.assemblyId ? this.isAssemblyLocked(part.assemblyId) : false;
  }

  isPartEffectivelyHidden(part, visited = new Set()) {
    if (!part) return false;
    if (part.hidden === true) return true;
    if(part.assemblyId && this.isAssemblyHidden(part.assemblyId))return true;
    if(visited.has(part.id))return false;
    visited.add(part.id);
    // 安装件、连接派生五金继承宿主的展示状态，不把继承状态写回自身 hidden 字段。
    const connection=part.generatedByConnectionId?this.editor.connectionManager.connections.find(item=>item.id===part.generatedByConnectionId):null;
    const hosts=connection?[connection.sourceProfileId,connection.targetProfileId]:part.mountReference?.targetPartId?[part.mountReference.targetPartId]:[];
    return hosts.some(id=>{const host=this.editor.parts.find(item=>item.id===id);return !host||this.isPartEffectivelyHidden(host,new Set(visited));});
  }

  refreshPartVisibility(partIds = null) {
    // 局部隐藏也要刷新依赖宿主的安装件，因此统一处理展示依赖，不只遍历传入的主体。
    for (const part of this.editor.parts || []) {
      const mesh = this.editor.getMeshByPartId?.(part.id);
      if (mesh) mesh.visible = !this.isPartEffectivelyHidden(part);
    }
    this.editor.connectionManager?.refreshVisibility?.();
  }

  setHidden(id, hidden = true, deep = true) {
    const assembly = this.get(id);
    if (!assembly) throw new Error('组件不存在');
    const assemblyIds = new Set([id, ...(deep ? this.descendants(id) : [])]);
    for (const item of this.assemblies) {
      if (assemblyIds.has(item.id)) item.hidden = hidden === true;
    }
    const changedPartIds = [];
    for (const part of this.editor.parts || []) {
      if (!assemblyIds.has(part.assemblyId)) continue;
      part.hidden = hidden === true;
      changedPartIds.push(part.id);
    }
    this.refreshPartVisibility(changedPartIds);
    return assembly;
  }

  setLocked(id, locked = true, deep = true) {
    const assembly = this.get(id);
    if (!assembly) throw new Error('组件不存在');
    const assemblyIds = new Set([id, ...(deep ? this.descendants(id) : [])]);
    for (const item of this.assemblies) {
      if (assemblyIds.has(item.id)) item.locked = locked === true;
    }
    for (const part of this.editor.parts || []) {
      if (assemblyIds.has(part.assemblyId)) part.locked = locked === true;
    }
    return assembly;
  }

  toggleHidden(id, deep = true) {
    const assembly = this.get(id);
    if (!assembly) throw new Error('组件不存在');
    return this.setHidden(id, assembly.hidden !== true, deep);
  }

  toggleLocked(id, deep = true) {
    const assembly = this.get(id);
    if (!assembly) throw new Error('组件不存在');
    return this.setLocked(id, assembly.locked !== true, deep);
  }

  showAll() {
    for (const assembly of this.assemblies) assembly.hidden = false;
    for (const part of this.editor.parts || []) part.hidden = false;
    this.refreshPartVisibility();
  }

  setInstallationStep(id, step) {
    const assembly = this.get(id);
    if (!assembly) throw new Error('组件不存在');
    const siblings = this.children(assembly.parentId || null).filter(item => item.id !== id);
    const target = Math.max(1, Math.min(siblings.length + 1, Math.round(Number(step || 1))));
    siblings.splice(target - 1, 0, assembly);
    siblings.forEach((item, index) => { item.installationStep = index + 1; });
    return assembly;
  }

  moveInstallationStep(id, delta) {
    const assembly = this.get(id);
    if (!assembly) throw new Error('组件不存在');
    const siblings = this.children(assembly.parentId || null);
    const index = siblings.findIndex(item => item.id === id);
    if (index < 0) return assembly;
    const nextIndex = Math.max(0, Math.min(siblings.length - 1, index + Math.sign(Number(delta || 0))));
    if (nextIndex === index) return assembly;
    const [item] = siblings.splice(index, 1);
    siblings.splice(nextIndex, 0, item);
    siblings.forEach((entry, order) => { entry.installationStep = order + 1; });
    return assembly;
  }

  tree() {
    this.reconcile();
    const nodes = new Map(this.assemblies.map(assembly => [assembly.id, {...assembly, parts:[], children:[]} ]));
    const roots = [];
    for (const part of this.editor.parts || []) {
      if (part.assemblyId && nodes.has(part.assemblyId)) nodes.get(part.assemblyId).parts.push(part);
    }
    for (const node of nodes.values()) {
      if (node.parentId && nodes.has(node.parentId)) nodes.get(node.parentId).children.push(node);
      else roots.push(node);
    }
    const sortNode = node => {
      node.children.sort(compareAssemblyOrder);
      for (const child of node.children) sortNode(child);
      node.parts.sort((a, b) => String(a.displayId || a.name || '').localeCompare(String(b.displayId || b.name || ''), 'zh-CN'));
    };
    roots.sort(compareAssemblyOrder);
    for (const root of roots) sortNode(root);
    const singles = (this.editor.parts || [])
      .filter(part => !part.assemblyId)
      .map(part => ({id:`single:${part.id}`,name:null,parentId:null,parts:[part],children:[],single:true,installationStep:0}));
    return [...roots, ...singles];
  }

  nextInstallationStep(parentId = null, excludeId = null) {
    const siblings = this.assemblies.filter(item => (item.parentId || null) === (parentId || null) && item.id !== excludeId);
    return siblings.length ? Math.max(...siblings.map(item => Number(item.installationStep || 0))) + 1 : 1;
  }

  normalizeSiblingSteps(parentId = null) {
    const siblings = this.assemblies
      .filter(item => (item.parentId || null) === (parentId || null))
      .sort(compareAssemblyOrder);
    siblings.forEach((item, index) => { item.installationStep = index + 1; });
  }

  normalizeAllSiblingSteps() {
    const parents = new Set([null, ...this.assemblies.map(item => item.parentId || null)]);
    for (const parentId of parents) this.normalizeSiblingSteps(parentId);
  }

  breakHierarchyCycles() {
    for (const assembly of this.assemblies) {
      const seen = new Set([assembly.id]);
      let cursor = assembly.parentId;
      while (cursor) {
        if (seen.has(cursor)) {
          assembly.parentId = null;
          break;
        }
        seen.add(cursor);
        cursor = this.get(cursor)?.parentId || null;
      }
    }
  }
}

function compareAssemblyOrder(a, b) {
  const stepA = Number(a?.installationStep || Number.MAX_SAFE_INTEGER);
  const stepB = Number(b?.installationStep || Number.MAX_SAFE_INTEGER);
  if (stepA !== stepB) return stepA - stepB;
  return String(a?.name || '').localeCompare(String(b?.name || ''), 'zh-CN');
}

function normalizeDirection(value) {
  const x = Number(value?.x || 0);
  const y = Number(value?.y || 0);
  const z = Number(value?.z || 0);
  const length = Math.hypot(x, y, z);
  if (length < 1e-9) return null;
  return {x:x / length, y:y / length, z:z / length};
}

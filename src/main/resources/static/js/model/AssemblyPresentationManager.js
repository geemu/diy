import * as THREE from 'three';

/**
 * Non-destructive exploded-view presentation.
 * Real part transforms never change; visible clones are offset temporarily.
 */
export default class AssemblyPresentationManager {
  constructor(editor) {
    this.editor = editor;
    this.group = new THREE.Group();
    this.group.name = '__ASSEMBLY_EXPLODED_PRESENTATION__';
    this.active = false;
    this.targetAssemblyId = null;
    this.distanceMm = 160;
    this.hiddenOriginals = new Map();
    this.editor.sceneManager.scene.add(this.group);
  }

  isExploded() {
    return this.active;
  }

  explode(assemblyId = null, distanceMm = 160) {
    this.collapse();
    const units = this.buildUnits(assemblyId);
    if (!units.length) throw new Error('当前没有可用于爆炸图的组件或构件');
    const meshes = units.flatMap(unit => unit.meshes).filter(Boolean);
    if (!meshes.length) throw new Error('当前没有可用于爆炸图的可见构件');

    const overall = centerOfMeshes(meshes);
    const distance = Math.max(20, Number(distanceMm || 160));
    units.forEach((unit, index) => {
      const center = centerOfMeshes(unit.meshes);
      const direction = this.resolveDirection(unit, center, overall, index, units.length);
      const offset = direction.multiplyScalar(distance);
      for (const mesh of unit.meshes) {
        if (!mesh.visible) continue;
        const clone = mesh.clone(true);
        clone.userData = {...clone.userData, presentationClone:true, sourcePartId:mesh.userData.part?.id};
        clone.position.add(offset);
        this.group.add(clone);
        this.hiddenOriginals.set(mesh, mesh.visible);
        mesh.visible = false;
      }
    });

    this.active = true;
    this.targetAssemblyId = assemblyId || null;
    this.distanceMm = distance;
    this.editor.sceneManager.transformControls.detach();
    this.editor.sceneManager.setSelections([], null);
    return {assemblyId:this.targetAssemblyId, distanceMm:distance, unitCount:units.length, cloneCount:this.group.children.length};
  }

  explodePartIds(partIds = [], distanceMm = 120) {
    this.collapse();
    const ids=new Set(partIds||[]);
    const meshes=(this.editor.meshes||[]).filter(mesh=>ids.has(mesh.userData.part?.id)&&mesh.visible!==false);
    if(!meshes.length)throw new Error('当前步骤没有可用于爆炸预览的构件');
    const overall=centerOfMeshes((this.editor.meshes||[]).filter(mesh=>mesh.visible!==false));
    const distance=Math.max(20,Number(distanceMm||120));
    meshes.forEach((mesh,index)=>{
      const center=centerOfMeshes([mesh]);
      let direction=center.clone().sub(overall);
      if(direction.lengthSq()<1e-6){
        const angle=meshes.length<=1?0:(Math.PI*2*index)/meshes.length;
        direction=new THREE.Vector3(Math.cos(angle),0.25,Math.sin(angle));
      }
      direction.normalize();
      const clone=mesh.clone(true);
      clone.userData={...clone.userData,presentationClone:true,sourcePartId:mesh.userData.part?.id,assemblyStepPreview:true};
      clone.position.add(direction.multiplyScalar(distance));
      this.group.add(clone);
      this.hiddenOriginals.set(mesh,mesh.visible);
      mesh.visible=false;
    });
    this.active=true;
    this.targetAssemblyId=null;
    this.distanceMm=distance;
    this.editor.sceneManager.transformControls.detach();
    this.editor.sceneManager.setSelections([],null);
    return {partCount:meshes.length,distanceMm:distance,cloneCount:this.group.children.length,mode:'STEP'};
  }

  collapse() {
    if (!this.active && !this.group.children.length) return false;
    for (const child of [...this.group.children]) this.group.remove(child);
    for (const [mesh, wasVisible] of this.hiddenOriginals.entries()) {
      const part = mesh.userData?.part;
      mesh.visible = part?.hidden === true ? false : wasVisible !== false;
    }
    this.hiddenOriginals.clear();
    this.active = false;
    this.targetAssemblyId = null;
    this.editor.sceneManager.setSelections(this.editor.selectedMeshes || [], this.editor.selected || null);
    return true;
  }

  buildUnits(assemblyId) {
    const manager = this.editor.assemblyManager;
    const meshForIds = ids => ids.map(id => this.editor.getMeshByPartId(id)).filter(Boolean);
    if (assemblyId) {
      const assembly = manager.get(assemblyId);
      if (!assembly) throw new Error('组件不存在');
      const children = manager.children(assemblyId);
      const units = children.map(child => ({
        id:child.id,
        direction:child.explodeDirection,
        meshes:meshForIds(manager.partIds(child.id, true))
      })).filter(unit => unit.meshes.length);
      const directMeshes = meshForIds(manager.directPartIds(assemblyId));
      if (directMeshes.length) units.push({id:`direct:${assemblyId}`, direction:assembly.explodeDirection, meshes:directMeshes});
      if (units.length > 1) return units;
      const allMeshes = meshForIds(manager.partIds(assemblyId, true));
      return allMeshes.map((mesh, index) => ({id:`part:${index}`, direction:null, meshes:[mesh]}));
    }

    const roots = manager.children(null);
    const units = roots.map(root => ({
      id:root.id,
      direction:root.explodeDirection,
      meshes:meshForIds(manager.partIds(root.id, true))
    })).filter(unit => unit.meshes.length);
    const singles = (this.editor.parts || [])
      .filter(part => !part.assemblyId)
      .map(part => this.editor.getMeshByPartId(part.id))
      .filter(Boolean)
      .map((mesh, index) => ({id:`single:${index}`, direction:null, meshes:[mesh]}));
    return [...units, ...singles];
  }

  resolveDirection(unit, center, overall, index, count) {
    if (unit.direction) {
      const explicit = new THREE.Vector3(unit.direction.x, unit.direction.y, unit.direction.z);
      if (explicit.lengthSq() > 1e-8) return explicit.normalize();
    }
    const direction = center.clone().sub(overall);
    if (direction.lengthSq() > 1e-6) return direction.normalize();
    const angle = count <= 1 ? 0 : (Math.PI * 2 * index) / count;
    return new THREE.Vector3(Math.cos(angle), index % 2 ? 0.35 : -0.15, Math.sin(angle)).normalize();
  }
}

function centerOfMeshes(meshes) {
  const box = new THREE.Box3();
  for (const mesh of meshes) box.expandByObject(mesh);
  const center = new THREE.Vector3();
  if (box.isEmpty()) return center;
  return box.getCenter(center);
}

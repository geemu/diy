import * as THREE from 'three';
import {normalizeProfilePath} from '../model/ProfilePath.js';
import {getSectionDefinition} from '../model/ProfileSectionRegistry.js';
import {applyProfileSurfaceShading} from './ProfileSurfaceAppearance.js';

export default class ProfileGeometryFactory {
  static create(part) {
    const path = normalizeProfilePath(part);
    return path.type === 'ARC' ? this.createArc(part,path) : this.createLine(part,path);
  }

  static material(part) {
    return new THREE.MeshStandardMaterial({
      color: part.color || 0xd3d7db,
      metalness: 0.68,
      roughness: 0.36,
      envMapIntensity:0.65,
      vertexColors:true,
      // 远处淡出只用于地面，不应让适配后的大型工程消失。
      fog:false,
      side: THREE.DoubleSide
    });
  }

  static createLine(part,path) {
    const group = new THREE.Group();
    group.userData.part = part;
    const section = getSectionDefinition(part.designProfile?.profileId,part.designProfile?.faceClosures||[]);
    const mesh = this.createSectionMesh(section,Number(path.length),this.material(part));
    this.applyEndCuts(mesh.geometry,part,Number(path.length));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.addCadEdges(mesh);
    group.add(mesh);
    this.bind(group);
    return group;
  }

  static rebuildLinearGroup(group,part) {
    if (!group || part?.type !== 'PROFILE') return group;
    const path = normalizeProfilePath(part);
    if (path.type !== 'LINE') return group;
    const removable = group.children.filter(child => child.name !== '__machining__');
    for (const child of removable) {
      group.remove(child);
      this.disposeObject(child);
    }
    const section = getSectionDefinition(part.designProfile?.profileId,part.designProfile?.faceClosures||[]);
    const mesh = this.createSectionMesh(section,Number(path.length),this.material(part));
    this.applyEndCuts(mesh.geometry,part,Number(path.length));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.addCadEdges(mesh);
    group.add(mesh);
    group.userData.part = part;
    this.bind(group);
    return group;
  }

  static disposeObject(object) {
    object?.traverse?.(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(material => material.dispose());
        else child.material.dispose();
      }
    });
  }

  static createArc(part,path) {
    const group = new THREE.Group();
    group.userData.part = part;
    const section = getSectionDefinition(part.designProfile?.profileId,part.designProfile?.faceClosures||[]);
    const total = Number(path.angleDeg) * Math.PI / 180;
    const segments = Math.max(12,Math.min(144,Math.ceil(Math.abs(path.angleDeg)/2.5)));
    const step = total / segments;
    const chordLength = Math.max(0.01,2 * Number(path.radius) * Math.sin(Math.abs(step)/2) * 1.002);
    const baseMaterial = this.material(part);

    for (let i=0;i<segments;i++) {
      const theta = -total/2 + (i+0.5)*step;
      const bulge = Number(path.radius) * (1-Math.cos(theta));
      const z = Number(path.radius) * Math.sin(theta);
      const mesh = this.createSectionMesh(section,chordLength,baseMaterial.clone());
      if (path.plane === 'YZ') {
        mesh.position.set(0,bulge,z);
        mesh.rotation.x = -theta;
      } else {
        mesh.position.set(bulge,0,z);
        mesh.rotation.y = theta;
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.addCadEdges(mesh);
      group.add(mesh);
    }
    baseMaterial.dispose();
    this.bind(group);
    return group;
  }

  static createSectionMesh(section,length,material) {
    if (!section?.outer?.length) {
      const geometry = new THREE.BoxGeometry(30,30,length);
      return new THREE.Mesh(geometry,material);
    }
    const shape = this.toThreeShape(section);
    const geometry = new THREE.ExtrudeGeometry(shape,{
      depth:length,
      bevelEnabled:false,
      curveSegments:4,
      steps:1
    });
    geometry.translate(0,0,-length/2);
    geometry.computeVertexNormals();
    applyProfileSurfaceShading(geometry,section);
    return new THREE.Mesh(geometry,material);
  }

  static toThreeShape(section) {
    const outer = section.outer;
    const shape = new THREE.Shape();
    shape.moveTo(Number(outer[0].x),Number(outer[0].y));
    for (let i=1;i<outer.length;i++) shape.lineTo(Number(outer[i].x),Number(outer[i].y));
    shape.closePath();
    for (const ring of section.holes || []) {
      if (!ring?.length) continue;
      const hole = new THREE.Path();
      hole.moveTo(Number(ring[0].x),Number(ring[0].y));
      for (let i=1;i<ring.length;i++) hole.lineTo(Number(ring[i].x),Number(ring[i].y));
      hole.closePath();
      shape.holes.push(hole);
    }
    return shape;
  }

  static applyEndCuts(geometry,part,length) {
    if (!geometry?.attributes?.position || !part?.endCuts) return;
    const start = normalizeCut(part.endCuts.START);
    const end = normalizeCut(part.endCuts.END);
    if (Math.abs(start.angleDeg) < 0.001 && Math.abs(end.angleDeg) < 0.001) return;
    const position = geometry.attributes.position;
    const half = Number(length) / 2;
    const tolerance = Math.max(0.01,Number(length)*0.00001);
    const tanStart = Math.tan(start.angleDeg*Math.PI/180);
    const tanEnd = Math.tan(end.angleDeg*Math.PI/180);
    for (let index=0; index<position.count; index++) {
      const x = position.getX(index);
      const y = position.getY(index);
      const z = position.getZ(index);
      const startAxis = start.axis === 'Y' ? y : x;
      const endAxis = end.axis === 'Y' ? y : x;
      if (Math.abs(z + half) <= tolerance) position.setZ(index,-half + tanStart*startAxis);
      else if (Math.abs(z - half) <= tolerance) position.setZ(index,half + tanEnd*endAxis);
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }

  static addCadEdges(mesh) {
    if (!mesh?.geometry) return;
    const geometry = new THREE.EdgesGeometry(mesh.geometry, 24);
    const material = new THREE.LineBasicMaterial({
      color:0x4a535d,
      transparent:true,
      opacity:0.32,
      depthTest:true,
      fog:false
    });
    const edges = new THREE.LineSegments(geometry, material);
    edges.renderOrder = 1;
    edges.userData.helper = true;
    mesh.add(edges);
  }

  static bind(group) {
    group.traverse(object => {
      if (object.isMesh) object.userData.profileRoot = group;
    });
  }

  static dispose(group) {
    group.traverse(object => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
        else object.material.dispose();
      }
    });
  }
}

function normalizeCut(value) {
  return {angleDeg:Math.max(-60,Math.min(60,Number(value?.angleDeg||0))),axis:value?.axis==='Y'?'Y':'X'};
}

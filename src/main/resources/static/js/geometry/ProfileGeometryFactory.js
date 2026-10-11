import * as THREE from 'three';
import {normalizeProfilePath} from '../model/ProfilePath.js';
import {getSectionDefinition} from '../model/ProfileSectionRegistry.js';
import {applyProfileSurfaceShading,createProfileAluminumMaterial,configureProfileAluminumMaterial} from './ProfileSurfaceAppearance.js';

export default class ProfileGeometryFactory {
  static create(part) {
    const path = normalizeProfilePath(part);
    return path.type === 'ARC' ? this.createArc(part,path) : this.createLine(part,path);
  }

  static material(part) {
    return createProfileAluminumMaterial(part);
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
    configureProfileAluminumMaterial(material);
    if (!section?.outer?.length) {
      const geometry = new THREE.BoxGeometry(30,30,length);
      applyProfileSurfaceShading(geometry,null);
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
    // 显示轮廓来自截面环，不从端面三角剖分反推，以免将孔桥接线画成3060的拼接缝。
    geometry.userData.profileOutline={length:Number(length),rings:[section.outer,...(section.holes||[])].map(ring=>ring.map(point=>({x:Number(point.x),y:Number(point.y)})))};
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
    if(geometry.userData.profileOutline)geometry.userData.profileOutline.endCuts={START:start,END:end};
    if (Math.abs(start.angleDeg) < 0.001 && Math.abs(end.angleDeg) < 0.001) return;
    const position = geometry.attributes.position;
    const half = Number(length) / 2;
    const tolerance = Math.max(0.01,Number(length)*0.00001);
    const tanStart = Math.tan(start.angleDeg*Math.PI/180);
    const tanEnd = Math.tan(end.angleDeg*Math.PI/180);
    const sideNormals=geometry.attributes.normal?.array.slice(),surface=geometry.attributes.profileSurface;
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
    // 斜切只改变端面；不能让重算法向把原有圆孔壁重新变成逐面亮暗的棱柱。
    if(sideNormals&&surface) {
      const normal=geometry.attributes.normal;
      for(let i=0;i<normal.count;i++)if(surface.getX(i)<.5)normal.setXYZ(i,sideNormals[i*3],sideNormals[i*3+1],sideNormals[i*3+2]);
      normal.needsUpdate=true;
    }
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }

  static addCadEdges(mesh, edgeGeometry=null) {
    if (!mesh?.geometry) return;
    const geometry = edgeGeometry || this.createCadEdgeGeometry(mesh.geometry);
    const material = new THREE.LineBasicMaterial({
      color:0x4a535d,
      transparent:true,
      opacity:0.22,
      depthTest:true,
      fog:false
    });
    const edges = new THREE.LineSegments(geometry, material);
    edges.renderOrder = 1;
    edges.userData.helper = true;
    mesh.add(edges);
  }

  /** 外环/孔环给出两端真实边；沿长度只画硬转折，不画共面分格线或圆壁分段线。 */
  static createCadEdgeGeometry(geometry) {
    const outline=geometry?.userData?.profileOutline;
    if(!outline?.rings?.length)return new THREE.EdgesGeometry(geometry,24);
    const values=[],half=outline.length/2,crease=Math.cos(24*Math.PI/180);
    const start=normalizeCut(outline.endCuts?.START),end=normalizeCut(outline.endCuts?.END);
    const tanStart=Math.tan(start.angleDeg*Math.PI/180),tanEnd=Math.tan(end.angleDeg*Math.PI/180);
    const vertex=(point,atEnd)=>[point.x,point.y,atEnd?half+tanEnd*(end.axis==='Y'?point.y:point.x):-half+tanStart*(start.axis==='Y'?point.y:point.x)];
    const line=(a,b)=>values.push(...a,...b);
    for(const source of outline.rings) {
      const ring=source.filter((point,index)=>!index||Math.hypot(point.x-source[index-1].x,point.y-source[index-1].y)>1e-8);
      if(ring.length>1&&Math.hypot(ring[0].x-ring.at(-1).x,ring[0].y-ring.at(-1).y)<1e-8)ring.pop();
      if(ring.length<3)continue;
      for(let i=0;i<ring.length;i++) {
        const a=ring[(i+ring.length-1)%ring.length],b=ring[i],c=ring[(i+1)%ring.length];
        line(vertex(b,false),vertex(c,false));line(vertex(b,true),vertex(c,true));
        const incoming=Math.hypot(b.x-a.x,b.y-a.y),outgoing=Math.hypot(c.x-b.x,c.y-b.y);
        const dot=((b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y))/(incoming*outgoing);
        if(dot<=crease)line(vertex(b,false),vertex(b,true));
      }
    }
    const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(values,3));
    return result;
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

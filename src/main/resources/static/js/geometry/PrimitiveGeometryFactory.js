import * as THREE from 'three';
import ComponentGeometryFactory from './ComponentGeometryFactory.js';

export default class PrimitiveGeometryFactory {
  static create(part) {
    if(part.dimensions?.geometryKind||part.dimensions?.panelShape)return ComponentGeometryFactory.create(part);
    if (part.type === 'SHAFT') return this.createShaft(part);
    if (part.type === 'PANEL') return this.createPanel(part);
    if (part.type === 'ACCESSORY') return this.createAccessory(part);
    throw new Error(`不支持的构件类型：${part.type}`);
  }

  static createShaft(part) {
    const diameter = Number(part.dimensions?.diameter || 12);
    const length = Number(part.dimensions?.length || 500);
    const material = new THREE.MeshStandardMaterial({
      color: part.color || 0xbfc7ce,
      metalness: 0.72,
      roughness: 0.28
    });
    const geometry = new THREE.CylinderGeometry(diameter / 2, diameter / 2, length, 48, 1, false);
    geometry.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const group = new THREE.Group();
    group.userData.part = part;
    group.add(mesh);
    this.bind(group);
    return group;
  }

  static createPanel(part) {
    const width = Number(part.dimensions?.width || 400);
    const height = Number(part.dimensions?.height || 400);
    const thickness = Number(part.dimensions?.thickness || 18);
    const material = new THREE.MeshStandardMaterial({
      color: part.color || 0xd7b889,
      metalness: 0.05,
      roughness: 0.6
    });
    const geometry = new THREE.BoxGeometry(width, height, thickness);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const group = new THREE.Group();
    group.userData.part = part;
    group.add(mesh);
    this.bind(group);
    return group;
  }

  static createAccessory(part) {
    const size = Number(part.dimensions?.size || 30);
    const material = new THREE.MeshStandardMaterial({
      color: part.color || 0x6f7780,
      metalness: 0.65,
      roughness: 0.35
    });
    const group = new THREE.Group();
    group.userData.part = part;

    if (part.accessoryType === 'ANGLE_BRACKET') {
      const t = Math.max(3, size * 0.12);
      const a = new THREE.Mesh(new THREE.BoxGeometry(size, t, size), material.clone());
      const b = new THREE.Mesh(new THREE.BoxGeometry(t, size, size), material.clone());
      // 原点就是两条腿的贴合角点：连接求解器只需把本地 X/Y 对齐两个安装面。
      a.position.set(size / 2, t / 2, 0);
      b.position.set(t / 2, size / 2, 0);
      group.add(a, b);
    } else if (part.accessoryType === 'CORNER_CUBE') {
      group.add(new THREE.Mesh(new THREE.BoxGeometry(size, size, size), material));
    } else if (part.accessoryType === 'T_NUT') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(size, Math.max(5,size*0.32), Math.max(9,size*0.55)), material.clone());
      const neck = new THREE.Mesh(new THREE.BoxGeometry(size*0.58, Math.max(3,size*0.18), Math.max(7,size*0.42)), material.clone());
      neck.position.y = Math.max(4,size*0.25);
      group.add(body,neck);
    } else if (part.accessoryType === 'SOCKET_SCREW') {
      const diameter = Number(part.dimensions?.diameter || 8);
      const length = Number(part.dimensions?.length || 20);
      const headDiameter = Number(part.dimensions?.headDiameter || diameter*1.6);
      const shank = new THREE.Mesh(new THREE.CylinderGeometry(diameter/2,diameter/2,length,24),material.clone());
      shank.rotation.x = Math.PI/2;
      shank.position.z = -length/2;
      const head = new THREE.Mesh(new THREE.CylinderGeometry(headDiameter/2,headDiameter/2,Math.max(5,diameter*0.75),32),material.clone());
      head.rotation.x = Math.PI/2;
      head.position.z = Math.max(3,diameter*0.35);
      group.add(shank,head);
    } else if (part.accessoryType === 'INTERNAL_CONNECTOR' || part.accessoryType === 'ANCHOR_CONNECTOR') {
      const length = Number(part.dimensions?.length || size*1.2);
      const body = new THREE.Mesh(new THREE.BoxGeometry(Math.max(8,size*0.34),Math.max(8,size*0.34),length),material.clone());
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(2,size*0.08),Math.max(2,size*0.08),Math.max(10,size*0.55),18),material.clone());
      pin.rotation.z = Math.PI/2;
      group.add(body,pin);
    } else if (part.accessoryType === 'CONNECTION_PLATE') {
      const width = Number(part.dimensions?.width || size);
      const height = Number(part.dimensions?.height || size);
      const thickness = Number(part.dimensions?.thickness || 4);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(width,height,thickness),material.clone());
      group.add(plate);
    } else if (part.accessoryType === 'WASHER') {
      const outer = Number(part.dimensions?.outerDiameter || size || 12);
      const inner = Number(part.dimensions?.innerDiameter || outer*0.52);
      const thickness = Number(part.dimensions?.thickness || 1.2);
      const ring = new THREE.Mesh(new THREE.RingGeometry(inner/2,outer/2,28),material.clone());
      ring.scale.z = thickness;
      group.add(ring);
    } else if (part.accessoryType === 'LEVELING_FOOT') {
      const stemDiameter=Number(part.dimensions?.stemDiameter||8),stemLength=Number(part.dimensions?.stemLength||45);
      const footDiameter=Number(part.dimensions?.footDiameter||40),footThickness=Number(part.dimensions?.footThickness||8);
      const stem=new THREE.Mesh(new THREE.CylinderGeometry(stemDiameter/2,stemDiameter/2,stemLength,24),material.clone());
      const foot=new THREE.Mesh(new THREE.CylinderGeometry(footDiameter/2,footDiameter/2,footThickness,32),new THREE.MeshStandardMaterial({color:0x2f3438,metalness:.1,roughness:.72}));
      stem.position.y=stemLength/2; foot.position.y=-footThickness/2; group.add(stem,foot);
    } else if (part.accessoryType === 'CASTER') {
      const diameter=Number(part.dimensions?.wheelDiameter||50),width=Number(part.dimensions?.wheelWidth||20);
      const stemDiameter=Number(part.dimensions?.stemDiameter||8),stemLength=Number(part.dimensions?.stemLength||25);
      const wheel=new THREE.Mesh(new THREE.CylinderGeometry(diameter/2,diameter/2,width,32),new THREE.MeshStandardMaterial({color:0x34383d,metalness:.12,roughness:.7}));
      wheel.rotation.z=Math.PI/2; wheel.position.y=-diameter/2;
      const stem=new THREE.Mesh(new THREE.CylinderGeometry(stemDiameter/2,stemDiameter/2,stemLength,20),material.clone()); stem.position.y=stemLength/2;
      group.add(wheel,stem);
    } else if (part.accessoryType === 'FOOT_CUP') {
      const height=Number(part.dimensions?.height||12);
      const cup=new THREE.Mesh(new THREE.BoxGeometry(size,size,height),new THREE.MeshStandardMaterial({color:0x2f3438,metalness:.02,roughness:.78}));
      group.add(cup);
    } else if (part.accessoryType === 'END_CAP') {
      const thickness = Number(part.dimensions?.thickness || 6);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(size,size,thickness),new THREE.MeshStandardMaterial({color:part.color || 0x2e3238,metalness:0.02,roughness:0.78}));
      group.add(cap);
    } else if (part.accessoryType === 'DRAWER_SLIDE') {
      const length = Number(part.dimensions?.length || 450);
      const width = Number(part.dimensions?.width || 12);
      const height = Number(part.dimensions?.height || 45);
      const outer = new THREE.Mesh(new THREE.BoxGeometry(width,height,length),material.clone());
      const inner = new THREE.Mesh(new THREE.BoxGeometry(Math.max(3,width-3),Math.max(12,height*0.58),Math.max(30,length-22)),material.clone());
      inner.position.x = width*0.48;
      group.add(outer,inner);
    } else if (part.accessoryType === 'HINGE') {
      const width=Number(part.dimensions?.width||40),height=Number(part.dimensions?.height||40),thickness=Number(part.dimensions?.thickness||4),pinDiameter=Number(part.dimensions?.pinDiameter||6);
      const leafWidth=Math.max(6,(width-pinDiameter)/2);
      const left=new THREE.Mesh(new THREE.BoxGeometry(leafWidth,height,thickness),material.clone());
      const right=new THREE.Mesh(new THREE.BoxGeometry(leafWidth,height,thickness),material.clone());
      left.position.x=-(leafWidth+pinDiameter)/2; right.position.x=(leafWidth+pinDiameter)/2;
      const pin=new THREE.Mesh(new THREE.CylinderGeometry(pinDiameter/2,pinDiameter/2,height*1.06,20),material.clone());
      group.add(left,right,pin);
    } else if (part.accessoryType === 'HANDLE') {
      const length=Number(part.dimensions?.length||120),standOff=Number(part.dimensions?.standOff||28),diameter=Number(part.dimensions?.diameter||10);
      const bar=new THREE.Mesh(new THREE.CylinderGeometry(diameter/2,diameter/2,length,24),material.clone());
      bar.rotation.z=Math.PI/2; bar.position.z=standOff;
      const postA=new THREE.Mesh(new THREE.CylinderGeometry(diameter/2,diameter/2,standOff,20),material.clone());
      const postB=postA.clone();
      postA.rotation.x=Math.PI/2; postB.rotation.x=Math.PI/2;
      postA.position.set(-length/2+diameter,0,standOff/2); postB.position.set(length/2-diameter,0,standOff/2);
      group.add(bar,postA,postB);
    } else {
      group.add(new THREE.Mesh(new THREE.BoxGeometry(size, size, size), material));
    }

    group.traverse(object => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    this.bind(group);
    return group;
  }

  static bind(group) {
    group.traverse(object => {
      if (object.isMesh) object.userData.profileRoot = group;
      // 构件与其材质独立于展示地面的距离雾，尤其是大尺寸工程适配后。
      for(const material of [].concat(object.material||[]))material.fog=false;
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

import * as THREE from 'three';

/** Visualizes remaining instantaneous DOF for the primary selected part. */
export default class MobilityVisualizer {
  constructor(editor,sceneManager){
    this.editor=editor;this.sceneManager=sceneManager;this.visible=true;this.group=new THREE.Group();this.group.name='mobility-visualizer';sceneManager.scene.add(this.group);
    this.disposeFrame=sceneManager.addFrameHandler(()=>this.refresh());this.lastKey='';
  }
  setVisible(v){this.visible=v!==false;this.group.visible=this.visible;this.lastKey='';this.refresh(true);}
  clear(){while(this.group.children.length){const o=this.group.children.pop();o.geometry?.dispose?.();o.material?.dispose?.();}}
  refresh(force=false){
    if(!this.visible)return;
    const mesh=this.editor.selected;if(!mesh?.userData?.part?.id){if(this.group.children.length)this.clear();this.lastKey='';return;}
    const m=this.editor.constraintManager.getMobility(mesh.userData.part.id);
    const p=mesh.getWorldPosition(new THREE.Vector3());
    const key=[mesh.userData.part.id,m.label,...m.translationBasis.flatMap(v=>v.toArray().map(n=>n.toFixed(3))),...m.rotationAxes.flatMap(v=>v.toArray().map(n=>n.toFixed(3))),p.x.toFixed(1),p.y.toFixed(1),p.z.toFixed(1)].join('|');
    if(!force&&key===this.lastKey)return;this.lastKey=key;this.clear();
    if(m.mode==='FREE'||m.mode==='FIXED')return;
    const span=Math.max(80,Math.min(220,Number(mesh.userData.part.length||500)*0.22));
    for(const axis of m.translationBasis)this.drawArrow(p,axis,span,0x00b7ff);
    for(const axis of m.rotationAxes)this.drawRotation(p,axis,span*.42,0xffc400);
  }
  drawArrow(origin,axis,len,color){
    for(const sign of [-1,1]){const dir=axis.clone().normalize().multiplyScalar(sign);const arrow=new THREE.ArrowHelper(dir,origin,len,color,Math.min(18,len*.22),Math.min(9,len*.1));arrow.line.material.depthTest=false;arrow.cone.material.depthTest=false;arrow.renderOrder=1100;this.group.add(arrow);}
  }
  drawRotation(origin,axis,radius,color){
    const n=axis.clone().normalize();const seed=Math.abs(n.x)<.8?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0);const u=seed.addScaledVector(n,-seed.dot(n)).normalize();const v=new THREE.Vector3().crossVectors(n,u).normalize();const pts=[];
    for(let i=0;i<=36;i++){const a=Math.PI*1.65*i/36;pts.push(origin.clone().addScaledVector(u,Math.cos(a)*radius).addScaledVector(v,Math.sin(a)*radius));}
    const geo=new THREE.BufferGeometry().setFromPoints(pts);const mat=new THREE.LineBasicMaterial({color,depthTest:false,transparent:true,opacity:.9});const line=new THREE.Line(geo,mat);line.renderOrder=1100;this.group.add(line);
    const end=pts[pts.length-1],prev=pts[pts.length-2],dir=end.clone().sub(prev).normalize();const arrow=new THREE.ArrowHelper(dir,end.clone().addScaledVector(dir,-10),20,color,10,6);arrow.line.material.depthTest=false;arrow.cone.material.depthTest=false;arrow.renderOrder=1101;this.group.add(arrow);
  }
}

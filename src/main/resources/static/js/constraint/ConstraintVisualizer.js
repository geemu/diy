import * as THREE from 'three';
import {featureWorldPoint} from './AssemblyMateMath.js';

/** 3D overlay for assembly constraints and diagnostics. */
export default class ConstraintVisualizer {
  constructor(editor, sceneManager) {
    this.editor=editor; this.sceneManager=sceneManager; this.visible=true;
    this.group=new THREE.Group(); this.group.name='constraint-visualizer';
    sceneManager.scene.add(this.group);
    this.lastKey=''; this.disposeFrame=sceneManager.addFrameHandler(()=>this.refresh());
  }
  setVisible(value){this.visible=value!==false;this.group.visible=this.visible;this.lastKey='';this.refresh(true);}
  refresh(force=false){
    if(!this.visible)return;
    const constraints=this.editor.constraintManager?.constraints||[];
    const diag=this.editor.constraintManager?.diagnose(this.editor.userDimensions||[]);
    const key=JSON.stringify(constraints.map(c=>[c.id,c.status,c.suppressed,c.sourcePartId,c.targetPartId,c.mateKind,c.offsetMm]))+'|'+(diag?.errors?.length||0)+'|'+(diag?.warnings?.length||0);
    if(!force&&key===this.lastKey)return; this.lastKey=key; this.clear();
    for(const c of constraints){if(c.enabled===false)continue;this.drawConstraint(c);}
  }
  clear(){while(this.group.children.length){const o=this.group.children.pop();o.geometry?.dispose?.();o.material?.dispose?.();}}
  pointFor(partId,feature){if(feature)return featureWorldPoint(this.editor,{...feature,partId});const m=this.editor.getMeshByPartId(partId);return m?.getWorldPosition(new THREE.Vector3())||null;}
  drawConstraint(c){
    const a=this.pointFor(c.sourcePartId,c.semantic?.sourceFeature), b=this.pointFor(c.targetPartId,c.semantic?.targetFeature); if(!a||!b)return;
    const bad=c.status==='ERROR', suppressed=c.suppressed===true;
    const color=bad?0xff3b30:(suppressed?0x8e8e93:0x34c759);
    const mat=new THREE.LineBasicMaterial({color,transparent:true,opacity:suppressed?.35:.9,depthTest:false});
    const geo=new THREE.BufferGeometry().setFromPoints([a,b]);const line=new THREE.Line(geo,mat);line.renderOrder=999;this.group.add(line);
    const radius=bad?5:3; for(const p of [a,b]){const g=new THREE.SphereGeometry(radius,10,8),m=new THREE.MeshBasicMaterial({color,depthTest:false,transparent:true,opacity:.9});const s=new THREE.Mesh(g,m);s.position.copy(p);s.renderOrder=1000;this.group.add(s);}
    if(bad){const mid=a.clone().add(b).multiplyScalar(.5);const size=10;const pts=[mid.clone().add(new THREE.Vector3(-size,-size,0)),mid.clone().add(new THREE.Vector3(size,size,0)),mid.clone().add(new THREE.Vector3(-size,size,0)),mid.clone().add(new THREE.Vector3(size,-size,0))];const g=new THREE.BufferGeometry().setFromPoints(pts);const l=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0xff3b30,depthTest:false}));l.renderOrder=1001;this.group.add(l);}
  }
}

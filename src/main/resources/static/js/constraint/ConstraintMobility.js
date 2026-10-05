import * as THREE from 'three';
import {profileAxis} from './AssemblyMateMath.js';
import {normalizeConstraintKind} from './ConstraintTypes.js';

/**
 * Instantaneous rigid-body mobility for interactive dragging.
 *
 * v0.29 treats every active semantic constraint as a linearized set of blocked
 * translation / rotation directions, then computes the null-space intersection.
 * This is deliberately local/instantaneous: the semantic solver is still the
 * authority that projects the final pose back onto the nonlinear relation.
 */
export default class ConstraintMobility {
  constructor(editor,constraintManager){this.editor=editor;this.constraintManager=constraintManager;}

  describe(partId){
    const constraints=(this.constraintManager.constraints||[]).filter(c=>c?.enabled!==false&&c?.suppressed!==true&&c?.sourcePartId===partId);
    const semantic=constraints.filter(c=>c.solverMode==='SEMANTIC');
    const frozen=constraints.filter(c=>c.solverMode!=='SEMANTIC');
    if(frozen.length)return result(partId,'FIXED',[],[],constraints,'固定');
    if(!semantic.length)return result(partId,'FREE',worldBasis(),worldBasis(),[],'自由');

    const translationBlocks=[];
    const rotationBlocks=[];
    for(const c of semantic){
      const source=this.editor.getMeshByPartId(c.sourcePartId);
      const target=this.editor.getMeshByPartId(c.targetPartId);
      if(!source||!target)continue;
      const kind=normalizeConstraintKind(c.mateKind);
      const targetAxis=profileAxis(target).normalize();
      const sourceAxis=profileAxis(source).normalize();

      if(kind==='DISTANCE'){
        const sf=c.semantic?.sourceFeature,tf=c.semantic?.targetFeature;
        const mode=c.semantic?.distanceMode || (sf?.type==='PROFILE_FACE'&&tf?.type==='PROFILE_FACE'?'FACE_TO_FACE':(sf?.type==='PROFILE_END'&&['PROFILE_FACE','PROFILE_SLOT'].includes(tf?.type)?'END_TO_FACE':'POINT_TO_POINT'));
        if(mode==='POINT_TO_POINT'){
          const a=this.worldFeaturePoint(c.sourcePartId,sf),b=this.worldFeaturePoint(c.targetPartId,tf);
          const normal=a&&b?a.clone().sub(b):targetAxis.clone();
          if(normal.lengthSq()>1e-10)addIndependent(translationBlocks,normal.normalize());
        }else if(mode==='FACE_TO_FACE'){
          const normal=this.editor.snapManager.faceNormal(target,tf.face).normalize();
          addIndependent(translationBlocks,normal);addPlaneBlocks(rotationBlocks,normal);
        }else{
          addIndependent(translationBlocks,...worldBasis());addPlaneBlocks(rotationBlocks,targetAxis);
        }
      }else if(kind==='SLIDER'){
        // Relative motion: one translation along axis, no relative rotation.
        addPlaneBlocks(translationBlocks,targetAxis);
        addIndependent(rotationBlocks,...worldBasis());
      }else if(kind==='REVOLUTE'){
        // Relative motion: no translation, one rotation about hinge axis.
        addIndependent(translationBlocks,...worldBasis());
        addPlaneBlocks(rotationBlocks,targetAxis);
      }else if(kind==='CYLINDRICAL'||kind==='COAXIAL'){
        // Relative motion: translation and rotation along/about common axis.
        addPlaneBlocks(translationBlocks,targetAxis);
        addPlaneBlocks(rotationBlocks,targetAxis);
      }else if(kind==='COPLANAR'){
        const face=c.semantic?.targetFeature?.face;
        const normal=this.editor.snapManager.faceNormal(target,face).normalize();
        addIndependent(translationBlocks,normal);
        addPlaneBlocks(rotationBlocks,normal);
      }else if(kind==='PARALLEL'){
        addPlaneBlocks(rotationBlocks,targetAxis);
      }else if(kind==='PERPENDICULAR'||kind==='ANGLE'){
        const targetAngle=kind==='PERPENDICULAR'?90:Number(c.angleDeg??90);
        if(kind==='ANGLE'&&(Math.abs(targetAngle)<1e-6||Math.abs(targetAngle-180)<1e-6)){
          addPlaneBlocks(rotationBlocks,targetAxis);
        }else{
          // d(a·b)/dt = w·(a×b): one scalar angular constraint.
          const gradient=new THREE.Vector3().crossVectors(sourceAxis,targetAxis);
          if(gradient.lengthSq()>1e-10)addIndependent(rotationBlocks,gradient.normalize());
        }
      }else if(['SLOT_TO_SLOT','END_COINCIDENT','COINCIDENT','DISTANCE','SLOT_CENTER','AXIS_NORMAL'].includes(kind)){
        addIndependent(translationBlocks,...worldBasis());
        addPlaneBlocks(rotationBlocks,targetAxis);
      }else{
        addIndependent(translationBlocks,...worldBasis());
        addIndependent(rotationBlocks,...worldBasis());
      }
    }
    const translationBasis=nullSpace3(translationBlocks);
    const rotationAxes=nullSpace3(rotationBlocks);
    return result(partId,'CONSTRAINED',translationBasis,rotationAxes,semantic,mobilityLabel(translationBasis.length,rotationAxes.length));
  }

  worldFeaturePoint(partId,feature){
    const mesh=this.editor.getMeshByPartId(partId);
    if(!mesh||!feature)return null;
    mesh.updateMatrixWorld(true);
    const part=mesh.userData.part;const length=Number(part.dimensions?.length||0);
    const [wRaw,hRaw]=part.dimensions?.sectionSize||[30,30];const w=Number(wRaw||30),h=Number(hRaw||30);
    const station=Math.max(0,Math.min(length,Number(feature.stationS??length/2)));const z=-length/2+station;
    if(feature.type==='PROFILE_END')return mesh.localToWorld(new THREE.Vector3(0,0,feature.end==='END'?length/2:-length/2));
    if(feature.face==='FRONT')return mesh.localToWorld(new THREE.Vector3(0,h/2,z));
    if(feature.face==='BACK')return mesh.localToWorld(new THREE.Vector3(0,-h/2,z));
    if(feature.face==='RIGHT')return mesh.localToWorld(new THREE.Vector3(w/2,0,z));
    if(feature.face==='LEFT')return mesh.localToWorld(new THREE.Vector3(-w/2,0,z));
    return mesh.getWorldPosition(new THREE.Vector3());
  }

  projectTranslation(partId,delta){
    const mobility=this.describe(partId);
    if(mobility.translationDof===3)return delta.clone();
    const projected=new THREE.Vector3();
    for(const axis of mobility.translationBasis)projected.add(axis.clone().multiplyScalar(delta.dot(axis)));
    return projected;
  }

  projectRotation(partId,startQuaternion,candidateQuaternion){
    const mobility=this.describe(partId);
    if(mobility.rotationDof>=3)return candidateQuaternion.clone();
    if(mobility.rotationDof===0)return startQuaternion.clone();
    const delta=candidateQuaternion.clone().multiply(startQuaternion.clone().invert()).normalize();
    const angle=2*Math.acos(THREE.MathUtils.clamp(delta.w,-1,1));
    const sinHalf=Math.sqrt(Math.max(0,1-delta.w*delta.w));
    if(angle<1e-9||sinHalf<1e-9)return startQuaternion.clone();
    const axis=new THREE.Vector3(delta.x,delta.y,delta.z).multiplyScalar(1/sinHalf).normalize();
    const rotationVector=axis.multiplyScalar(angle);
    const projectedVector=new THREE.Vector3();
    for(const allowed of mobility.rotationAxes)projectedVector.add(allowed.clone().multiplyScalar(rotationVector.dot(allowed)));
    const projectedAngle=projectedVector.length();
    if(projectedAngle<1e-9)return startQuaternion.clone();
    const projectedDelta=new THREE.Quaternion().setFromAxisAngle(projectedVector.normalize(),projectedAngle);
    return projectedDelta.multiply(startQuaternion.clone()).normalize();
  }
}

function result(partId,mode,translationBasis,rotationAxes,constraints,label){
  return {partId,mode,translationBasis,rotationAxes,translationDof:translationBasis.length,rotationDof:rotationAxes.length,totalDof:translationBasis.length+rotationAxes.length,constraintIds:(constraints||[]).map(c=>c.id),label};
}
function worldBasis(){return [new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)];}
function addPlaneBlocks(blocks,allowedAxis){
  const a=allowedAxis.clone().normalize();
  const seed=Math.abs(a.x)<0.8?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0);
  const n1=seed.addScaledVector(a,-seed.dot(a)).normalize();
  const n2=new THREE.Vector3().crossVectors(a,n1).normalize();
  addIndependent(blocks,n1,n2);
}
function addIndependent(blocks,...vectors){
  for(const raw of vectors){
    if(!raw||raw.lengthSq()<1e-14)continue;
    const v=raw.clone().normalize();
    for(const b of blocks)v.addScaledVector(b,-v.dot(b));
    if(v.lengthSq()>1e-10)blocks.push(v.normalize());
    if(blocks.length===3)return;
  }
}
function nullSpace3(blocks){
  const orth=[];addIndependent(orth,...blocks);
  if(orth.length===0)return worldBasis();
  if(orth.length>=3)return [];
  if(orth.length===2){
    const line=new THREE.Vector3().crossVectors(orth[0],orth[1]);
    return line.lengthSq()>1e-10?[line.normalize()]:[];
  }
  const n=orth[0];
  const seed=Math.abs(n.x)<0.8?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0);
  const a=seed.addScaledVector(n,-seed.dot(n)).normalize();
  return [a,new THREE.Vector3().crossVectors(n,a).normalize()];
}
function mobilityLabel(t,r){
  if(t===0&&r===0)return '完全约束';
  if(t===1&&r===0)return '仅轴向滑动';
  if(t===0&&r===1)return '仅绕轴旋转';
  if(t===1&&r===1)return '轴向滑动 + 绕轴旋转';
  if(t===2&&r===1)return '平面滑动 + 法向旋转';
  return `平移 ${t} / 旋转 ${r}`;
}

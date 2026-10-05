import * as THREE from 'three';
import {featureWorldPoint,profileAxis,endAxis} from './AssemblyMateMath.js';
import {normalizeConstraintKind} from './ConstraintTypes.js';

/** Numeric residuals for semantic assembly mates. Values are mm and degrees. */
export default class ConstraintResiduals {
  constructor(editor){this.editor=editor;}

  evaluate(constraint){
    if(constraint?.solverMode!=='SEMANTIC') return {positionMm:0,angleDeg:0,score:0};
    const source=this.editor.getMeshByPartId(constraint.sourcePartId);
    const target=this.editor.getMeshByPartId(constraint.targetPartId);
    const sf=constraint.semantic?.sourceFeature, tf=constraint.semantic?.targetFeature;
    if(!source||!target||!sf||!tf) return {positionMm:Infinity,angleDeg:Infinity,score:Infinity};
    source.updateMatrixWorld(true);target.updateMatrixWorld(true);
    const a=featureWorldPoint(this.editor,{...sf,partId:constraint.sourcePartId});
    const b=featureWorldPoint(this.editor,{...tf,partId:constraint.targetPartId});
    if(!a||!b) return {positionMm:Infinity,angleDeg:Infinity,score:Infinity};
    const kind=normalizeConstraintKind(constraint.mateKind);
    const offset=Number(constraint.offsetMm||0), flipped=constraint.flipped===true;
    let positionMm=0,angleDeg=0;
    if(kind==='DISTANCE'){
      const mode=constraint.semantic?.distanceMode || (sf.type==='PROFILE_FACE'&&tf.type==='PROFILE_FACE'?'FACE_TO_FACE':(sf.type==='PROFILE_END'&&['PROFILE_FACE','PROFILE_SLOT'].includes(tf.type)?'END_TO_FACE':'POINT_TO_POINT'));
      if(mode==='POINT_TO_POINT'){
        positionMm=Math.abs(a.distanceTo(b)-Math.abs(offset));
      }else{
        const tn=this.editor.snapManager.faceNormal(target,tf.face).normalize();
        positionMm=Math.abs(a.clone().sub(b).dot(tn)-offset);
        if(mode==='FACE_TO_FACE'){
          const sn=this.editor.snapManager.faceNormal(source,sf.face).normalize();
          angleDeg=parallelAngle(sn,tn.clone().multiplyScalar(flipped?1:-1));
        }else angleDeg=parallelAngle(endAxis(source,sf.end),tn.clone().multiplyScalar(flipped?1:-1));
      }
    }else if(kind==='SLIDER'){
      const axis=profileAxis(target);const delta=a.clone().sub(b);const radial=delta.clone().addScaledVector(axis,-delta.dot(axis));
      positionMm=radial.length();angleDeg=this.referenceOrientationError(source,target,constraint);
    }else if(kind==='REVOLUTE'){
      const axis=profileAxis(target);positionMm=Math.abs(a.distanceTo(b)-Math.abs(offset));
      angleDeg=parallelAngle(profileAxis(source),axis);
    }else if(kind==='CYLINDRICAL'||kind==='COAXIAL'){
      const axis=profileAxis(target);const delta=a.clone().sub(b);const radial=delta.clone().addScaledVector(axis,-delta.dot(axis));
      positionMm=radial.length();angleDeg=parallelAngle(profileAxis(source),axis.clone().multiplyScalar(flipped?-1:1));
    }else if(kind==='ANGLE'){
      angleDeg=Math.abs(angleBetween(profileAxis(source),profileAxis(target))-THREE.MathUtils.clamp(Number(constraint.angleDeg??90),0,180));
    }else if(kind==='PARALLEL'){
      angleDeg=parallelAngle(profileAxis(source),profileAxis(target));
    }else if(kind==='PERPENDICULAR'){
      angleDeg=Math.abs(90-angleBetween(profileAxis(source),profileAxis(target)));
    }else if(kind==='END_COINCIDENT'){
      const ta=endAxis(target,tf.end); positionMm=Math.abs(a.distanceTo(b)-Math.abs(offset));
      angleDeg=parallelAngle(endAxis(source,sf.end),ta.clone().multiplyScalar(flipped?1:-1));
    }else if(kind==='SLOT_TO_SLOT'){
      const axis=profileAxis(target); const delta=a.clone().sub(b); const axial=delta.dot(axis);
      const radial=delta.clone().addScaledVector(axis,-axial).length();
      positionMm=Math.hypot(radial,axial-offset);
      angleDeg=parallelAngle(profileAxis(source),axis.clone().multiplyScalar(flipped?-1:1));
    }else if(kind==='COPLANAR'){
      const tn=this.editor.snapManager.faceNormal(target,tf.face).normalize();
      const sn=this.editor.snapManager.faceNormal(source,sf.face).normalize();
      positionMm=Math.abs(a.clone().sub(b).dot(tn)-offset);
      angleDeg=parallelAngle(sn,tn.clone().multiplyScalar(flipped?1:-1));
    }else{
      const tn=this.editor.snapManager.faceNormal(target,tf.face).normalize();
      positionMm=Math.abs(a.clone().sub(b).dot(tn)-offset);
      angleDeg=parallelAngle(endAxis(source,sf.end),tn.clone().multiplyScalar(flipped?1:-1));
    }
    const score=Math.max(positionMm/0.05,angleDeg/0.05);
    return {positionMm:round(positionMm),angleDeg:round(angleDeg),score:round(score)};
  }

  referenceOrientationError(source,target,constraint){
    const values=constraint.referenceRelativeQuaternion;
    if(!Array.isArray(values)||values.length!==4)return parallelAngle(profileAxis(source),profileAxis(target));
    const sourceQ=source.getWorldQuaternion(new THREE.Quaternion());
    const targetQ=target.getWorldQuaternion(new THREE.Quaternion());
    const desired=targetQ.multiply(new THREE.Quaternion().fromArray(values).normalize()).normalize();
    return THREE.MathUtils.radToDeg(sourceQ.angleTo(desired));
  }
}
function angleBetween(a,b){return THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(a.clone().normalize().dot(b.clone().normalize()),-1,1)));}
function parallelAngle(a,b){const d=angleBetween(a,b);return Math.min(d,Math.abs(180-d));}
function round(v){return Number.isFinite(v)?Number(v.toFixed(6)):v;}

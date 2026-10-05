import * as THREE from 'three';
import {featureWorldPoint, profileAxis, endAxis, alignVector, translateFeatureTo} from './AssemblyMateMath.js';
import {normalizeConstraintKind} from './ConstraintTypes.js';

/**
 * Deterministic semantic assembly solver.
 *
 * v0.29 adds explicit kinematic joints and angle constraints. The solver remains
 * directed source -> target and is iterated by ConstraintManager. Individual
 * constraints project onto their geometric manifold instead of storing a final pose.
 */
export default class SemanticConstraintSolver {
  constructor(editor){this.editor=editor;}

  apply(constraint){
    const source=this.editor.getMeshByPartId(constraint.sourcePartId);
    const target=this.editor.getMeshByPartId(constraint.targetPartId);
    const semantic=constraint.semantic;
    if(!source||!target||!semantic?.sourceFeature||!semantic?.targetFeature)return false;
    const sf={...semantic.sourceFeature,partId:constraint.sourcePartId};
    const tf={...semantic.targetFeature,partId:constraint.targetPartId};
    const kind=normalizeConstraintKind(constraint.mateKind);
    const offset=Number(constraint.offsetMm||0), flipped=constraint.flipped===true;
    source.updateMatrixWorld(true);target.updateMatrixWorld(true);
    const targetPoint=featureWorldPoint(this.editor,tf);
    if(!targetPoint)throw new Error('语义配合目标特征无法解析');

    if(kind==='DISTANCE'){
      const mode=semantic.distanceMode || (sf.type==='PROFILE_FACE'&&tf.type==='PROFILE_FACE'?'FACE_TO_FACE':(sf.type==='PROFILE_END'&&['PROFILE_FACE','PROFILE_SLOT'].includes(tf.type)?'END_TO_FACE':'POINT_TO_POINT'));
      if(mode==='FACE_TO_FACE'){
        const sn=this.faceNormal(source,sf.face),tn=this.faceNormal(target,tf.face);
        alignVector(source,sn,tn.clone().multiplyScalar(flipped?1:-1));
        translateFeatureTo(this.editor,source,sf,targetPoint.clone().add(tn.multiplyScalar(offset)));
      }else if(mode==='END_TO_FACE'){
        const tn=this.faceNormal(target,tf.face);
        alignVector(source,endAxis(source,sf.end),tn.clone().multiplyScalar(flipped?1:-1));
        translateFeatureTo(this.editor,source,sf,targetPoint.clone().add(tn.multiplyScalar(offset)));
      }else{
        const sourcePoint=featureWorldPoint(this.editor,sf);
        const direction=sourcePoint.clone().sub(targetPoint);
        if(direction.lengthSq()<1e-10)direction.copy(profileAxis(target));
        direction.normalize();
        translateFeatureTo(this.editor,source,sf,targetPoint.clone().add(direction.multiplyScalar(Math.abs(offset))));
      }
    }else if(kind==='SLIDER'){
      // Preserve the captured non-axial orientation, remove radial displacement only.
      this.applyReferenceOrientation(source,target,constraint);
      const axis=profileAxis(target).multiplyScalar(flipped?-1:1).normalize();
      const sourcePoint=featureWorldPoint(this.editor,sf);
      const delta=targetPoint.clone().sub(sourcePoint);
      const radial=delta.clone().addScaledVector(axis,-delta.dot(axis));
      source.position.add(radial);
    }else if(kind==='REVOLUTE'){
      const axis=profileAxis(target).multiplyScalar(flipped?-1:1).normalize();
      alignVector(source,profileAxis(source),axis);
      translateFeatureTo(this.editor,source,sf,targetPoint.clone().add(axis.clone().multiplyScalar(offset)));
    }else if(kind==='CYLINDRICAL'){
      const axis=profileAxis(target).multiplyScalar(flipped?-1:1).normalize();
      alignVector(source,profileAxis(source),axis);
      const sourcePoint=featureWorldPoint(this.editor,sf);
      const delta=targetPoint.clone().sub(sourcePoint);
      const radial=delta.clone().addScaledVector(axis,-delta.dot(axis));
      source.position.add(radial);
    }else if(kind==='ANGLE'){
      const desired=this.vectorAtAngle(profileAxis(target),Number(constraint.angleDeg??90),flipped);
      alignVector(source,profileAxis(source),desired);
    }else if(kind==='END_COINCIDENT'){
      this.require(sf,'PROFILE_END','端面对接源特征必须是端面');this.require(tf,'PROFILE_END','端面对接目标特征必须是端面');
      alignVector(source,endAxis(source,sf.end),endAxis(target,tf.end).multiplyScalar(flipped?1:-1));
      const axis=endAxis(target,tf.end).multiplyScalar(flipped?-1:1);
      translateFeatureTo(this.editor,source,sf,targetPoint.clone().add(axis.multiplyScalar(offset)));
    }else if(kind==='SLOT_TO_SLOT'){
      this.require(sf,'PROFILE_SLOT','槽对槽源特征必须是槽中心');this.require(tf,'PROFILE_SLOT','槽对槽目标特征必须是槽中心');
      alignVector(source,profileAxis(source),profileAxis(target).multiplyScalar(flipped?-1:1));
      translateFeatureTo(this.editor,source,sf,targetPoint.clone().add(profileAxis(target).multiplyScalar(offset)));
    }else if(kind==='COAXIAL'){
      const axis=profileAxis(target).multiplyScalar(flipped?-1:1).normalize();
      alignVector(source,profileAxis(source),axis);
      const sourcePoint=featureWorldPoint(this.editor,sf);
      const delta=targetPoint.clone().sub(sourcePoint);
      const radial=delta.clone().addScaledVector(axis,-delta.dot(axis));
      source.position.add(radial);
    }else if(kind==='COPLANAR'){
      this.require(sf,'PROFILE_FACE','共面源特征必须是型材面');this.require(tf,'PROFILE_FACE','共面目标特征必须是型材面');
      const sn=this.faceNormal(source,sf.face), tn=this.faceNormal(target,tf.face);
      alignVector(source,sn,tn.clone().multiplyScalar(flipped?1:-1));
      translateFeatureTo(this.editor,source,sf,targetPoint.clone().add(tn.multiplyScalar(offset)));
    }else if(kind==='PARALLEL'){
      alignVector(source,profileAxis(source),profileAxis(target).multiplyScalar(flipped?-1:1));
    }else if(kind==='PERPENDICULAR'){
      const targetAxis=profileAxis(target);let desired=new THREE.Vector3(1,0,0).cross(targetAxis);
      if(desired.lengthSq()<1e-8)desired=new THREE.Vector3(0,1,0).cross(targetAxis);
      desired.normalize();if(flipped)desired.multiplyScalar(-1);alignVector(source,profileAxis(source),desired);
    }else{
      this.require(sf,'PROFILE_END','面贴合/距离配合源特征必须是型材端部');
      if(!['PROFILE_FACE','PROFILE_SLOT'].includes(tf.type))throw new Error('面贴合/距离配合目标特征必须是型材面或槽');
      const tn=this.faceNormal(target,tf.face);const desired=tn.clone().multiplyScalar(flipped?1:-1);
      alignVector(source,endAxis(source,sf.end),desired);
      translateFeatureTo(this.editor,source,sf,targetPoint.clone().add(tn.multiplyScalar(offset)));
    }
    source.updateMatrixWorld(true);this.editor.syncPartFromMesh(source);return true;
  }

  applyReferenceOrientation(source,target,constraint){
    const values=constraint.referenceRelativeQuaternion;
    if(!Array.isArray(values)||values.length!==4){
      alignVector(source,profileAxis(source),profileAxis(target).multiplyScalar(constraint.flipped===true?-1:1));
      return;
    }
    const targetWorld=target.getWorldQuaternion(new THREE.Quaternion());
    const relative=new THREE.Quaternion().fromArray(values).normalize();
    const desiredWorld=targetWorld.multiply(relative).normalize();
    if(source.parent){
      source.parent.updateMatrixWorld(true);
      const parentWorld=source.parent.getWorldQuaternion(new THREE.Quaternion());
      source.quaternion.copy(parentWorld.invert().multiply(desiredWorld)).normalize();
    }else source.quaternion.copy(desiredWorld);
    source.updateMatrixWorld(true);
  }

  vectorAtAngle(targetAxis,angleDeg,flipped){
    const axis=targetAxis.clone().normalize();
    const seed=Math.abs(axis.x)<0.8?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0);
    const perpendicular=seed.addScaledVector(axis,-seed.dot(axis)).normalize();
    const angle=THREE.MathUtils.degToRad(THREE.MathUtils.clamp(Number(angleDeg)||0,0,180));
    const desired=axis.clone().multiplyScalar(Math.cos(angle)).add(perpendicular.multiplyScalar(Math.sin(angle))).normalize();
    return flipped?desired.multiplyScalar(-1):desired;
  }

  faceNormal(mesh,face){return this.editor.snapManager.faceNormal(mesh,face).normalize();}
  require(feature,type,message){if(feature?.type!==type)throw new Error(message);}
}

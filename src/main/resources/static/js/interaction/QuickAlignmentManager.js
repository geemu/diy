import * as THREE from 'three';
import {isLinearProfile,getLocalEndpoints} from '../model/ProfilePath.js';

/** 快速对齐命令。只提交业务坐标/长度；不通过缩放截面伪造尺寸，不自动添加约束。 */
export default class QuickAlignmentManager {
  constructor(editor){this.editor=editor;}
  execute(kind,axis='X'){
    const e=this.editor,meshes=[...e.selectedMeshes];
    if(meshes.length<2)throw new Error('请先 Shift 多选至少两个构件');
    if(meshes.some(mesh=>!e.isMeshTransformable(mesh)))throw new Error('选择中有锁定或已安装构件，请先解锁/解除安装');
    if(meshes.some(mesh=>e.constraintManager.listForPart(mesh.userData.part.id).some(c=>c.enabled&&!c.suppressed)))throw new Error('选择中有有效几何约束，请先解除约束再快速对齐');
    if(!['X','Y','Z'].includes(axis))throw new Error('请选择 X/Y/Z 方向');
    const ids=meshes.map(mesh=>mesh.userData.part.id),before=e.exportProject(),coordinate=axis.toLowerCase();
    const boxes=meshes.map(mesh=>new THREE.Box3().setFromObject(mesh)),anchor=meshes[meshes.length-1];
    const plans=meshes.map(mesh=>({mesh,position:mesh.position.clone(),length:null}));
    if(kind==='CENTER'){
      const referenceDirection=new THREE.Vector3(0,0,1).applyQuaternion(anchor.getWorldQuaternion(new THREE.Quaternion())).normalize();
      if(meshes.some(mesh=>Math.abs(referenceDirection.dot(new THREE.Vector3(0,0,1).applyQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion()))))<.99999))throw new Error('所选构件必须平行，不能直接把垂直接头做中心对齐');
      const target=boxes[boxes.length-1].getCenter(new THREE.Vector3())[coordinate];
      plans.forEach((plan,index)=>plan.position[coordinate]+=target-boxes[index].getCenter(new THREE.Vector3())[coordinate]);
    }else if(['DISTRIBUTE','GOLDEN'].includes(kind)){
      if(meshes.length<3)throw new Error('排列至少需要三个构件');
      const rows=plans.map((plan,index)=>({...plan,value:boxes[index].getCenter(new THREE.Vector3())[coordinate]})).sort((a,b)=>a.value-b.value);
      const start=rows[0].value,end=rows[rows.length-1].value,count=rows.length-1;
      rows.forEach((row,index)=>{
        const fraction=kind==='GOLDEN'?(index===0?0:(Math.pow(1.61803398875,index)-1)/(Math.pow(1.61803398875,count)-1)):index/count;
        row.position[coordinate]+=start+(end-start)*fraction-row.value;
      });
    }else if(['END','LENGTH'].includes(kind)){
      if(meshes.some(mesh=>mesh.userData.part.type!=='PROFILE'||!isLinearProfile(mesh.userData.part)))throw new Error('端面对齐和统一长度只适用于直线型材');
      const direction=new THREE.Vector3(0,0,1).applyQuaternion(anchor.quaternion).normalize();
      if(meshes.some(mesh=>Math.abs(direction.dot(new THREE.Vector3(0,0,1).applyQuaternion(mesh.quaternion)))<.99999))throw new Error('请选择轴线平行的型材');
      const endpoints=mesh=>{const local=getLocalEndpoints(mesh.userData.part);return [mesh.localToWorld(new THREE.Vector3(...local.start)),mesh.localToWorld(new THREE.Vector3(...local.end))].sort((a,b)=>a.dot(direction)-b.dot(direction));};
      const reference=endpoints(anchor),anchorLow=reference[0].dot(direction),anchorHigh=reference[1].dot(direction);
      for(const plan of plans){
        const ends=endpoints(plan.mesh),low=ends[0].dot(direction),high=ends[1].dot(direction);
        if(kind==='END')plan.position.addScaledVector(direction,Math.abs(anchorLow-low)<=Math.abs(anchorHigh-high)?anchorLow-low:anchorHigh-high);
        else{
          const part=plan.mesh.userData.part;
          if((part.machiningItems||[]).length||(part.endCuts?.START?.angleDeg||part.endCuts?.END?.angleDeg))throw new Error('已加工/斜切型材请通过长度属性编辑，避免改变加工基准');
          plan.length=anchorHigh-anchorLow;plan.position.addScaledVector(direction,(anchorLow+anchorHigh-low-high)/2);
        }
      }
    }else throw new Error('未知对齐命令');
    try{
      for(const plan of plans){
        plan.mesh.position.copy(plan.position);e.syncPartFromMesh(plan.mesh);
        if(plan.length!==null){const part=plan.mesh.userData.part;part.dimensions.length=plan.length;part.profilePath={type:'LINE',length:plan.length};e.rebuildLinearProfileVisual(plan.mesh);}
        plan.mesh.updateMatrixWorld(true);
      }
      e.connectionManager.updateConnectionsForProfiles(ids);e.accessoryMountManager.refreshForTargets(ids);
      e.interferenceFeedbackManager.refresh({focusIds:new Set(ids),live:false});e.sceneManager.setSelections(meshes,anchor);
      e.updateDimensions();e.emitStats();e.historyManager.capture();e.emitProjectChanged();e.onSelectionChanged?.(anchor,meshes);
    }catch(error){e.restoreProject(before);e.selectMany(ids.map(id=>e.getMeshByPartId(id)).filter(Boolean));throw error;}
    return meshes.length;
  }
}

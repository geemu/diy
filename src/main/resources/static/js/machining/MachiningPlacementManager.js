import * as THREE from 'three';
import {resolveProfileFeature} from '../model/ProfileFeatureCatalog.js';
import {localZToStation} from '../model/ProfileCoordinateSystem.js';

/**
 * 玩家式加工放置器：先选“打孔/攻丝/开槽”，再点型材上的真实位置。
 * 预览只显示将要加工的位置，点击后才写入 MachiningFeature。
 */
export default class MachiningPlacementManager {
  constructor(editor){
    this.editor=editor;
    this.mode=null;
    this.hover=null;
    this.onChanged=null;
    this.previewGroup=new THREE.Group();
    this.previewGroup.name='__machining_placement_preview__';
    this.editor.sceneManager.scene.add(this.previewGroup);
  }
  isActive(){return !!this.mode;}
  begin(mode){this.mode=String(mode||'THROUGH_HOLE').toUpperCase();this.hover=null;this.clearPreview();this.emit('请点击型材上的加工位置');}
  cancel(){const active=this.isActive();this.mode=null;this.hover=null;this.clearPreview();if(active)this.emit('已退出加工放置');}
  handlePointerMove(event){if(!this.isActive())return false;this.hover=this.resolve(event);this.renderPreview();this.emit(this.statusText(),false);return true;}
  handleClick(event){
    if(!this.isActive())return false;
    const target=this.resolve(event);
    if(!target){this.emit(this.requiresEnd()?'请点击型材 A/B 端部':'请点击型材侧面');return true;}
    try{
      const manager=this.editor.machiningManager;
      const common={generatedByConnectionId:null};
      let item=null;
      if(this.mode==='THROUGH_HOLE')item=manager.addThroughHole(target.mesh,{...common,face:target.face,stationS:target.stationS,offset:target.offset,diameter:9,referenceDatum:'A_END'});
      else if(this.mode==='COUNTERSINK')item=manager.addHoleGroup(target.mesh,{...common,face:target.face,stationS:target.stationS,offset:target.offset,diameter:9,majorDiameter:16,angleDeg:90,secondaryType:'COUNTERSINK',referenceDatum:'A_END'});
      else if(this.mode==='SLOT')item=manager.addSlot(target.mesh,{...common,face:target.face,stationS:target.stationS,offset:target.offset,length:30,width:8,orientation:'ALONG_PROFILE',referenceDatum:'A_END'});
      else if(this.mode==='END_TAP')item=manager.addEndTap(target.mesh,{...common,end:target.end,tappingSize:'M8',depth:12,referenceDatum:'END_FACE'});
      else if(this.mode==='END_HOLE')item=manager.addEndHole(target.mesh,{...common,end:target.end,diameter:8,depth:12,referenceDatum:'END_FACE'});
      else throw new Error('未知加工方式');
      this.editor.emitStats();this.editor.historyManager.capture();this.editor.emitProjectChanged();
      this.emit(`已添加：${modeLabel(this.mode)}${target.end?` · ${target.end==='START'?'A':'B'}端`:''}`);
      return item;
    }catch(error){this.emit(error?.message||'加工添加失败');return true;}
  }
  requiresEnd(){return ['END_TAP','END_HOLE'].includes(this.mode);}
  resolve(event){
    const hit=this.editor.sceneManager.pickHit(event,(this.editor.meshes||[]).filter(mesh=>mesh.visible!==false&&mesh.userData?.part?.type==='PROFILE'));
    const mesh=hit?.object;if(!mesh||mesh.userData?.part?.type!=='PROFILE'||!hit?.point)return null;
    const part=mesh.userData.part;
    const feature=resolveProfileFeature(mesh,hit.point,{endToleranceMm:34,slotToleranceMm:20});
    if(this.requiresEnd()){
      if(feature?.type!=='PROFILE_END')return null;
      return {mesh,point:hit.point.clone(),end:feature.end};
    }
    if(!feature || !['PROFILE_FACE','PROFILE_SLOT'].includes(feature.type))return null;
    mesh.updateMatrixWorld(true);
    const local=mesh.worldToLocal(hit.point.clone());
    const length=Number(part.dimensions?.length||0);
    const stationS=Math.max(0,Math.min(length,localZToStation(length,local.z)));
    const face=feature.face;
    const offset=face==='FRONT'||face==='BACK'?Number(local.x):Number(local.y);
    return {mesh,point:hit.point.clone(),face,stationS,offset};
  }
  statusText(){if(!this.hover)return this.requiresEnd()?'请选择 A/B 端部':'请选择加工面上的位置';return `可添加：${modeLabel(this.mode)}`;}
  renderPreview(){
    this.clearPreview();if(!this.hover)return;
    const geometry=this.requiresEnd()?new THREE.RingGeometry(7,11,24):new THREE.TorusGeometry(8,2.2,8,28);
    const material=new THREE.MeshBasicMaterial({color:0xff8b2c,transparent:true,opacity:.82,depthTest:false,side:THREE.DoubleSide});
    const mesh=new THREE.Mesh(geometry,material);mesh.position.copy(this.hover.point);mesh.renderOrder=1400;
    if(!this.requiresEnd()){
      const normal=faceWorldNormal(this.hover.mesh,this.hover.face);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
    }
    this.previewGroup.add(mesh);
  }
  clearPreview(){while(this.previewGroup.children.length){const child=this.previewGroup.children.pop();child.geometry?.dispose?.();child.material?.dispose?.();}}
  emit(message,notify=true){this.onChanged?.({active:this.isActive(),mode:this.mode,message,notify});}
}
function faceWorldNormal(mesh,face){const local=face==='FRONT'?new THREE.Vector3(0,1,0):face==='BACK'?new THREE.Vector3(0,-1,0):face==='RIGHT'?new THREE.Vector3(1,0,0):new THREE.Vector3(-1,0,0);mesh.updateMatrixWorld(true);return local.transformDirection(mesh.matrixWorld).normalize();}
function modeLabel(mode){return ({THROUGH_HOLE:'通孔',COUNTERSINK:'沉头孔',SLOT:'槽加工',END_TAP:'端面攻丝',END_HOLE:'端面孔'})[mode]||'加工';}

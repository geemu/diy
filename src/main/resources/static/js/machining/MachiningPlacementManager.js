import * as THREE from 'three';
import {resolveProfileFeature,resolveProfileSurfaceFeature} from '../model/ProfileFeatureCatalog.js';
import {localZToStation} from '../model/ProfileCoordinateSystem.js';
import {machiningLocalPose} from './MachiningManager.js';
import {machiningCenterOffsets,machiningEndBores} from './MachiningFeatureCatalog.js';

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
  begin(mode){this.mode=String(mode||'THROUGH_HOLE').toUpperCase();this.hover=null;this.clearPreview();this.emit(this.mode==='SLOT'?'请点击型材上的加工位置':this.requiresEnd()?'请点击 A/B 端面或原有圆孔，孔口自动对准孔心；Alt 自由定位':'请点击型材侧面，靠近中心时对齐；Alt 自由定位');}
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
      else if(this.mode==='END_TAP')item=manager.addEndTap(target.mesh,{...common,end:target.end,offsetX:target.offsetX,offsetY:target.offsetY,tappingSize:'M8',depth:12,referenceDatum:'END_FACE'});
      else if(this.mode==='END_HOLE')item=manager.addEndHole(target.mesh,{...common,end:target.end,offsetX:target.offsetX,offsetY:target.offsetY,diameter:8,depth:12,referenceDatum:'END_FACE'});
      else throw new Error('未知加工方式');
      this.editor.emitStats();this.editor.historyManager.capture();this.editor.emitProjectChanged();
      this.emit(`已添加：${modeLabel(this.mode)}${target.end?` · ${target.end==='START'?'A':'B'}端`:''}`);
      return item;
    }catch(error){this.emit(error?.message||'加工添加失败');return true;}
  }
  requiresEnd(){return ['END_TAP','END_HOLE'].includes(this.mode);}
  resolve(event){
    const scene=this.editor.sceneManager,profiles=(this.editor.meshes||[]).filter(mesh=>mesh.visible!==false&&mesh.userData?.part?.type==='PROFILE');
    let hit;
    if(this.requiresEnd()) {
      // 圆孔入口没有三角面。先在端面孔口拾取，再用同一前方实体射线兜底。
      // 不使用选择类型过滤，板材/配件/设计连接件也必须挡住后面的孔。
      const roots=[...(this.editor.meshes||[]).filter(mesh=>mesh.visible!==false),...(this.editor.connectionManager?.selectableHelpers?.()||[])];
      scene.camera.updateMatrixWorld(true);
      const hits=scene.raycast(event,roots).filter(value=>value.object.isMesh);
      const bore=this.resolveEndBore(event,profiles,hits);
      if(bore)return bore;
      const first=hits[0];
      hit=first?{object:scene.resolveRoot(first.object),point:first.point,surfaceNormal:first.face?.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(first.object.matrixWorld)).normalize()}:null;
    }else hit=scene.pickHit(event,profiles);
    const mesh=hit?.object;if(!mesh||mesh.userData?.part?.type!=='PROFILE'||!hit?.point)return null;
    const part=mesh.userData.part;
    mesh.updateMatrixWorld(true);
    const local=mesh.worldToLocal(hit.point.clone());
    const feature=this.requiresEnd()?resolveProfileFeature(mesh,hit.point,{endToleranceMm:34,slotToleranceMm:20}):resolveProfileSurfaceFeature(mesh,hit.point,{slotToleranceMm:20});
    if(this.requiresEnd()){
      if(feature?.type!=='PROFILE_END')return null;
      if(part.profilePath?.type!=='ARC'&&Math.abs(Number(part.endCuts?.[feature.end]?.angleDeg||0))<.001) {
        const sign=feature.end==='END'?1:-1,length=Number(part.dimensions?.length||0);
        const normal=new THREE.Vector3(0,0,sign).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)).normalize();
        // 端部34mm热区不能把深处孔壁/侧壁当成端盖。
        if(Math.abs(local.z-sign*length/2)>.01||!hit.surfaceNormal||hit.surfaceNormal.dot(normal)<.999)return null;
      }
      const references=[];
      for(const x of machiningCenterOffsets(part,'FRONT'))for(const y of machiningCenterOffsets(part,'RIGHT'))references.push({offsetX:x,offsetY:y,centerLabel:x===0&&y===0?'整体中心':'单元中心'});
      const pose=offsets=>mesh.localToWorld(machiningLocalPose(part,{type:this.mode,end:feature.end,...offsets}).point);
      const current={offsetX:local.x,offsetY:local.y};
      const center=this.nearCenter(event,current,references,pose,['offsetX','offsetY']);
      const offsets=center||current;
      return {mesh,point:pose(offsets),end:feature.end,...offsets};
    }
    if(!feature || !['PROFILE_FACE','PROFILE_SLOT'].includes(feature.type))return null;
    const length=Number(part.dimensions?.length||0);
    const stationS=Math.max(0,Math.min(length,localZToStation(length,local.z)));
    const face=feature.face;
    const pointerOffset=face==='FRONT'||face==='BACK'?Number(local.x):Number(local.y);
    const references=machiningCenterOffsets(part,face).map(offset=>({offset,centerLabel:offset===0?'整体中线':'单元中心线'}));
    const pose=offsets=>mesh.localToWorld(machiningLocalPose(part,{type:this.mode,face,stationS,...offsets}).point);
    const center=this.mode==='SLOT'?null:this.nearCenter(event,{offset:pointerOffset},references,pose,['offset']);
    const offset=center?.offset??pointerOffset;
    const point=this.mode==='SLOT'?hit.point.clone():mesh.localToWorld(machiningLocalPose(part,{type:this.mode,face,stationS,offset}).point);
    return {mesh,point,face,stationS,offset,centerLabel:center?.centerLabel||null};
  }

  /** 端面圆孔的有限拾取区，不添加隐形网格，不影响普通选择或碰撞。 */
  resolveEndBore(event,profiles,hits) {
    const scene=this.editor.sceneManager,rect=scene.renderer.domElement.getBoundingClientRect();
    if(!rect.width||!rect.height)return null;
    const ray=scene.raycaster.ray.clone(),camera=scene.camera;
    camera.updateMatrixWorld(true);
    const project=point=>{const p=point.clone().project(camera);return {x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2,z:p.z};};
    let best=null;
    for(const mesh of profiles) {
      if(!objectVisible(mesh))continue;
      const part=mesh.userData.part;
      if(part.profilePath?.type==='ARC')continue;
      const bores=machiningEndBores(part),length=Number(part.profilePath?.length??part.dimensions?.length);
      if(!bores.length||!Number.isFinite(length)||length<=0)continue;
      mesh.updateMatrixWorld(true);
      const localRay=ray.clone().applyMatrix4(new THREE.Matrix4().copy(mesh.matrixWorld).invert());
      for(const end of ['START','END']) {
        const sign=end==='END'?1:-1;
        // 斜切与弧形尚未有匹配的端孔姿态，不用轴向圆盘伪装准确孔口。
        if(Math.abs(Number(part.endCuts?.[end]?.angleDeg||0))>=.001||localRay.direction.z*sign>=-1e-6)continue;
        const local=localRay.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,sign),-length/2),new THREE.Vector3());
        if(!local)continue;
        const world=mesh.localToWorld(local.clone()),distance=world.distanceTo(ray.origin),projection=project(world);
        if(projection.z<-1||projection.z>1||!Number.isFinite(projection.z))continue;
        const first=hits[0];
        if(first&&(first.distance<distance-1e-4||(first.distance<=distance+1e-4&&scene.resolveRoot(first.object)!==mesh)))continue;
        for(const bore of bores) {
          const aperture=nearestBoreOpening(local,bore.outline);
          if(aperture.distance>2)continue;
          const rim=project(mesh.localToWorld(new THREE.Vector3(aperture.x,aperture.y,local.z)));
          if(!Number.isFinite(rim.x)||!Number.isFinite(rim.y)||Math.hypot(rim.x-projection.x,rim.y-projection.y)>8)continue;
          const centerDistance=Math.hypot(local.x-bore.offsetX,local.y-bore.offsetY);
          if(best&&(distance>best.distance+1e-4||(Math.abs(distance-best.distance)<=1e-4&&centerDistance>=best.centerDistance)))continue;
          const offsets=event.altKey?{offsetX:local.x,offsetY:local.y}:{offsetX:bore.offsetX,offsetY:bore.offsetY,centerLabel:bore.centerLabel};
          best={mesh,end,...offsets,distance,centerDistance};
        }
      }
    }
    if(!best)return null;
    const {mesh,end,offsetX,offsetY,centerLabel}=best;
    const point=mesh.localToWorld(machiningLocalPose(mesh.userData.part,{type:this.mode,end,offsetX,offsetY}).point);
    return {mesh,end,offsetX,offsetY,centerLabel,point};
  }

  /** 同时限定8个屏幕像素和2mm模型偏差，远景不能把整面都变成中心吸附区。 */
  nearCenter(event,current,references,pose,axes) {
    if(event.altKey)return null;
    const scene=this.editor.sceneManager,rect=scene.renderer.domElement.getBoundingClientRect(),camera=scene.camera;
    camera.updateMatrixWorld(true);
    const project=point=>{const p=point.project(camera);return {x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2,z:p.z};};
    const origin=project(pose(current));
    let best=null;
    for(const reference of references) {
      const worldDistance=Math.hypot(...axes.map(axis=>Number(reference[axis])-Number(current[axis])));
      if(worldDistance>2)continue;
      const p=project(pose(reference)),pixels=Math.hypot(p.x-origin.x,p.y-origin.y);
      if(!Number.isFinite(pixels)||p.z<-1||p.z>1||pixels>8)continue;
      if(!best||worldDistance<best.worldDistance)best={reference,worldDistance};
    }
    return best?.reference||null;
  }

  statusText(){
    if(!this.hover)return this.requiresEnd()?'请选择 A/B 端部':'请选择加工面上的位置';
    const h=this.hover,mm=value=>Math.round(Number(value));
    const position=this.requiresEnd()?`X ${mm(h.offsetX)} / Y ${mm(h.offsetY)} mm`:`横向 ${mm(h.offset)} mm · 距 A 端 ${mm(h.stationS)} mm`;
    return `可添加：${modeLabel(this.mode)} · ${h.centerLabel||'自由定位'} · ${position}`;
  }
  renderPreview(){
    this.clearPreview();if(!this.hover)return;
    const radius=this.mode==='COUNTERSINK'?8:this.requiresEnd()?4:4.5;
    const geometry=new THREE.RingGeometry(radius-.35,radius,40);
    const material=new THREE.MeshBasicMaterial({color:0x70a0cc,transparent:true,opacity:.95,depthTest:true,depthWrite:false,side:THREE.DoubleSide});
    const mesh=new THREE.Mesh(geometry,material);mesh.position.copy(this.hover.point);mesh.renderOrder=1400;
    const normal=this.requiresEnd()?machiningLocalPose(this.hover.mesh.userData.part,{type:this.mode,end:this.hover.end}).normal.transformDirection(this.hover.mesh.matrixWorld):faceWorldNormal(this.hover.mesh,this.hover.face);
    mesh.position.addScaledVector(normal,.7);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
    this.previewGroup.add(mesh);
    if(this.hover.centerLabel) {
      // 小十字只在当前中心候选出现，不铺满截面，也不参与拾取。
      const cross=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1.5,0,0),new THREE.Vector3(1.5,0,0),new THREE.Vector3(0,-1.5,0),new THREE.Vector3(0,1.5,0)]),new THREE.LineBasicMaterial({color:0x36bfa5,depthTest:true}));
      cross.position.copy(mesh.position);cross.quaternion.copy(mesh.quaternion);cross.renderOrder=1401;cross.raycast=()=>{};
      this.previewGroup.add(cross);
    }
  }
  clearPreview(){while(this.previewGroup.children.length){const child=this.previewGroup.children.pop();child.geometry?.dispose?.();child.material?.dispose?.();}}
  emit(message,notify=true){this.onChanged?.({active:this.isActive(),mode:this.mode,message,notify});}
}
function objectVisible(object){for(let current=object;current;current=current.parent)if(current.visible===false)return false;return true;}
function nearestBoreOpening(point,outline) {
  let inside=false,best={distance:Infinity,x:0,y:0};
  for(let i=0,j=outline.length-1;i<outline.length;j=i++) {
    const a=outline[j],b=outline[i],dx=b.x-a.x,dy=b.y-a.y;
    if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
    const squared=dx*dx+dy*dy,t=squared?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/squared)):0;
    const x=a.x+t*dx,y=a.y+t*dy,distance=Math.hypot(x-point.x,y-point.y);
    if(distance<best.distance)best={distance,x,y};
  }
  return inside?{distance:0,x:point.x,y:point.y}:best;
}
function faceWorldNormal(mesh,face){const local=face==='FRONT'?new THREE.Vector3(0,1,0):face==='BACK'?new THREE.Vector3(0,-1,0):face==='RIGHT'?new THREE.Vector3(1,0,0):new THREE.Vector3(-1,0,0);mesh.updateMatrixWorld(true);return local.transformDirection(mesh.matrixWorld).normalize();}
function modeLabel(mode){return ({THROUGH_HOLE:'通孔',COUNTERSINK:'沉头孔',SLOT:'槽加工',END_TAP:'端面攻丝',END_HOLE:'端面孔'})[mode]||'加工';}

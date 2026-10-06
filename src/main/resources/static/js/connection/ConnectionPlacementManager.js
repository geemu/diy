import * as THREE from 'three';
import PrimitiveGeometryFactory from '../geometry/PrimitiveGeometryFactory.js';
import {resolveProfileFeature,resolveProfileSurfaceFeature,profileFeatureWorldPoint,featureLabel} from '../model/ProfileFeatureCatalog.js';
import {isLinearProfile} from '../model/ProfilePath.js';
import {profileSeries} from '../model/DesignProfileCatalog.js';
import {connectionDesignType} from '../model/ComponentCatalog.js';
import {slotWorldNormal} from '../model/SlotMatcher.js';
import {profileObb,intersectObb} from '../validation/PartCollisionDetector.js';

/**
 * 玩家式连接放置器：先选连接方式，再点击两个型材连接位置。
 * 移动鼠标只负责预览；只有点击才会提交 Anchor，避免 hover 误创建连接。
 */
export default class ConnectionPlacementManager {
  constructor(editor) {
    this.editor=editor;
    this.mode=null;
    this.first=null;
    this.hover=null;
    this.directPreview=null;
    this.candidates=[];
    this.candidateKey=null;
    this.lastEvent=null;
    this.onChanged=null;
    this.previewGroup=new THREE.Group();
    this.previewGroup.name='__connection_placement_preview__';
    this.editor.sceneManager.scene.add(this.previewGroup);
  }

  isActive(){return !!this.mode;}

  begin(mode='ANGLE_BRACKET',options={}) {
    this.mode=String(mode || 'ANGLE_BRACKET').toUpperCase();
    this.componentDefinition=options.componentDefinition?structuredClone(options.componentDefinition):null;
    this.existingPartId=options.existingPartId||null;
    this.candidates=[];this.candidateKey=null;this.lastEvent=null;
    this.first=null;
    this.hover=null;
    this.directPreview=null;
    this.clearPreview();
    this.editor.sceneManager.transformControls?.detach();
    this.emit('靠近型材接头，连接件自动吸附并转向；绿色预览后单击确认，Tab 切换候选');
  }

  /** 已自由放置的参考连接件显式转为接头安装；预览/取消阶段保留原件，确认才替换。 */
  beginExisting(partId) {
    const mesh=this.editor.getMeshByPartId(partId),part=mesh?.userData?.part;
    const mode=connectionDesignType(part);
    if(part?.type!=='ACCESSORY'||!mode)throw new Error('这个组件暂未配置接头安装规则');
    if(!this.editor.isMeshTransformable(mesh)||part.generatedByConnectionId)throw new Error('请先解除安装或解锁该连接件');
    if(this.editor.constraintManager?.constraints?.some(c=>c.partA===partId||c.partB===partId||c.sourcePartId===partId||c.targetPartId===partId))throw new Error('该连接件已有约束，请先解除约束');
    this.begin(mode,{existingPartId:partId,componentDefinition:{id:part.hardwareSku,label:part.name,accessoryType:part.accessoryType,color:part.color,dimensions:structuredClone(part.dimensions)}});
  }

  beginFromContext(mode,partId,worldPoint) {
    this.begin(mode);
    const mesh=this.editor.getMeshByPartId(partId);
    if(!mesh || mesh.userData?.part?.type!=='PROFILE' || !worldPoint)return false;
    const point=new THREE.Vector3(Number(worldPoint.x||0),Number(worldPoint.y||0),Number(worldPoint.z||0));
    const anchor=this.resolveAnchorAtWorldPoint(mesh,point,'SOURCE');
    if(!anchor)return false;
    this.first=anchor;
    this.hover=null;
    this.directPreview=null;
    this.renderPreview();
    this.emit(`已选择 ${anchor.displayId} ${featureLabel(anchor.feature)}，请点击第二根型材的侧面或槽位`);
    return true;
  }

  cancel() {
    const wasActive=this.isActive();
    this.mode=null;
    this.componentDefinition=null;
    this.existingPartId=null;this.candidates=[];this.candidateKey=null;this.lastEvent=null;
    this.first=null;
    this.hover=null;
    this.directPreview=null;
    this.clearPreview();
    if(wasActive&&this.editor.selected&&this.editor.isMeshTransformable(this.editor.selected))this.editor.sceneManager.transformControls?.attach(this.editor.selected);
    if(wasActive)this.emit('已退出连接放置');
  }

  handlePointerMove(event) {
    if(!this.isActive())return false;
    const hit=this.editor.sceneManager.pickHit(event,this.profileMeshes());
    this.lastEvent={clientX:event.clientX,clientY:event.clientY};
    this.directPreview=!this.first ? this.resolveDirectJoint(hit,event) : null;
    this.hover=this.directPreview ? null : this.resolveAnchor(hit,this.first ? 'TARGET' : 'SOURCE');
    this.renderPreview();
    this.emit(this.statusText(),false);
    return true;
  }

  handleClick(event) {
    if(!this.isActive())return false;
    const hit=this.editor.sceneManager.pickHit(event,this.profileMeshes());

    // 第一击优先尝试“点接头即吸附”：用户不需要理解谁是源型材、谁是目标型材。
    // 若接头附近能唯一解析出一组合法型材关系，就直接安装；解析不唯一时再进入两步选择。
    if(!this.first){
      const direct=this.resolveDirectJoint(hit,event);
      if(direct?.valid){
        this.installConnection(direct.source,direct.target,direct.item.type,'单击吸附');
        return true;
      }
      if(direct){this.directPreview=direct;this.renderPreview();this.emit(direct.message||'当前位置不能安装');return true;}
    }

    const anchor=this.resolveAnchor(hit,this.first ? 'TARGET' : 'SOURCE');
    if(!anchor){this.emit(this.first?'请点击第二根型材的侧面或槽位':'请点击接头附近；若未自动识别，再点击第一根型材的 A/B 端部');return true;}
    if(!this.first){
      this.first=anchor;
      this.hover=null;
      this.directPreview=null;
      this.renderPreview();
      this.emit(`已选择 ${anchor.displayId} ${featureLabel(anchor.feature)}，请选择第二根型材的连接面`);
      return true;
    }
    if(anchor.mesh===this.first.mesh){this.emit('第二个连接位置必须位于另一根型材');return true;}
    const result=this.resolveRule(this.first,anchor);
    if(!result?.item?.valid){this.emit(result?.message || '当前两个位置不支持这种连接方式');return true;}
    this.installConnection(this.first,anchor,result.item.type,'两点选择');
    return true;
  }

  resolveDirectJoint(hit,event=null) {
    const nearby=this.nearbyJoints(hit,event);
    this.candidates=nearby.map(context=>this.evaluateCandidate(context)).filter(Boolean);
    this.candidates.sort((a,b)=>Number(b.valid)-Number(a.valid)||a.distance-b.distance);
    const locked=this.candidates.find(c=>c.key===this.candidateKey&&c.valid);
    const choice=locked||this.candidates[0]||null;
    this.candidateKey=choice?.key||null;
    return choice;
  }

  cycleCandidate(delta=1) {
    if(!this.isActive()||this.first||!this.lastEvent)return false;
    const hit=this.editor.sceneManager.pickHit(this.lastEvent,this.profileMeshes());
    this.resolveDirectJoint(hit,this.lastEvent);
    const choices=this.candidates.filter(c=>c.valid);
    if(choices.length<2)return false;
    const index=choices.findIndex(c=>c.key===this.candidateKey);
    this.directPreview=choices[(index+delta+choices.length)%choices.length];
    this.candidateKey=this.directPreview.key;this.renderPreview();this.emit(this.statusText(),false);return true;
  }

  /** 找真实端点附近的接头，不要求射线恰好命中槽中心；空隙中也按屏幕邻域识别。 */
  nearbyJoints(hit,event=null) {
    const profiles=this.profileMeshes(),list=[];
    for(const sourceMesh of profiles)for(const end of ['START','END']){
      const feature={type:'PROFILE_END',end},point=profileFeatureWorldPoint(sourceMesh,feature);
      if(!point)continue;
      const source={mesh:sourceMesh,feature,point,displayId:sourceMesh.userData.part.displayId||sourceMesh.userData.part.name};
      let distance;
      if(event){
        const rect=this.editor.sceneManager.renderer.domElement.getBoundingClientRect(),p=point.clone().project(this.editor.sceneManager.camera);
        if(p.z<-1||p.z>1)continue;
        distance=Math.hypot(rect.left+(p.x+1)*rect.width/2-event.clientX,rect.top+(1-p.y)*rect.height/2-event.clientY);
        if(distance>(this.candidateKey?.startsWith(`${sourceMesh.userData.part.id}|${end}|`)?56:42))continue;
      }else{
        if(!hit?.point)continue;
        distance=point.distanceTo(hit.point);
        if(distance>Math.max(56,...sourceMesh.userData.part.dimensions.sectionSize))continue;
      }
      for(const targetMesh of profiles){
        if(sourceMesh===targetMesh||(!event&&sourceMesh!==hit.object&&targetMesh!==hit.object))continue;
        // Canonical surface resolver bounds the candidate to the actual target. Geometry/rule validation stays in ConnectionManager.
        const targetFeature=resolveProfileSurfaceFeature(targetMesh,point,{slotToleranceMm:24});
        const targetPoint=targetFeature&&profileFeatureWorldPoint(targetMesh,targetFeature);
        if(!targetPoint||targetPoint.distanceTo(point)>12.01)continue;
        const target={mesh:targetMesh,feature:targetFeature,point:targetPoint,displayId:targetMesh.userData.part.displayId||targetMesh.userData.part.name};
        this.pushJointCandidate(list,source,target,point);
        list[list.length-1].distance=distance;
      }
    }
    return list;
  }

  evaluateCandidate(context) {
    const item=context.designCandidates.find(row=>row.type===this.mode);
    if(!item)return null;
    const {source,target}=context,geometry=item.geometry;
    const key=`${source.mesh.userData.part.id}|${source.feature.end}|${target.mesh.userData.part.id}|${target.feature.face}`;
    let message=item.error||'',valid=item.valid===true;
    const fail=reason=>{valid=false;message=reason;};
    if(this.componentDefinition&&Number(this.componentDefinition.dimensions?.size)!==Number(profileSeries(source.mesh.userData.part)))fail('连接件规格与型材系列不匹配，请调整适用规格');
    const outward=new THREE.Vector3(0,0,source.feature.end==='START'?-1:1).transformDirection(source.mesh.matrixWorld);
    if(outward.dot(slotWorldNormal(target.mesh,target.feature.face))>-.99)fail('端面方向不相对，请先把两根型材正确贴合');
    if(Number(geometry?.contactGapMm)>Math.max(.1,Number(this.editor.projectSettings?.contactToleranceMm??.5)))fail('两根型材还没有贴合，请先吸附型材后安装连接件');
    if(intersectObb(profileObb(source.mesh.userData.part),profileObb(target.mesh.userData.part),Number(this.editor.projectSettings?.collisionToleranceMm??.5)).intersects)fail('两根型材发生干涉，请先移开穿透位置');
    const occupied=this.editor.connectionManager.connections.find(c=>c.sourceProfileId===source.mesh.userData.part.id&&c.sourceEnd===source.feature.end);
    if(occupied&&occupied.targetProfileId!==target.mesh.userData.part.id)fail('这一端已连接其他型材，请先解除原连接');
    const same=this.editor.connectionManager.connections.find(c=>c.sourceProfileId===source.mesh.userData.part.id&&c.targetProfileId===target.mesh.userData.part.id&&c.sourceEnd===source.feature.end&&c.targetFace===target.feature.face);
    if(same?.manufacturingRuleId)fail('接头已配置制造方案，请到连接页修改');
    const descriptor={designType:this.mode,designComponent:this.componentDefinition,sourceEnd:source.feature.end,targetFace:target.feature.face,validation:geometry,sourceMountFace:geometry?.sourceMountFace,targetSlot:geometry?.targetSlot};
    const transform=geometry&&this.editor.connectionManager.resolveDesignComponentTransform(descriptor,source.mesh,target.mesh);
    if(!transform)fail('无法确定连接件安装方向');
    if(valid&&this.componentDefinition){
      const ghost=connectorGhost(this.mode,transform.position,0x24b36b,this.componentDefinition,transform);
      ghost.updateMatrixWorld(true);
      const box=new THREE.Box3().setFromObject(ghost);
      // 复杂配件只承诺安装包络检查，不将包络重叠当成精确实体布尔。
      for(const mesh of this.editor.meshes){
        const part=mesh.userData?.part;
        if(!part||part.hidden||mesh.visible===false||[source.mesh,target.mesh].includes(mesh)||part.id===this.existingPartId)continue;
        const other=new THREE.Box3().setFromObject(mesh);
        const overlaps=['x','y','z'].map(axis=>Math.min(box.max[axis],other.max[axis])-Math.max(box.min[axis],other.min[axis]));
        if(overlaps.every(value=>value>Number(this.editor.projectSettings?.collisionToleranceMm??.5))){fail(`安装空间与 ${part.displayId||part.name} 重叠，请移开障碍或切换候选`);break;}
      }
      disposePreview(ghost);
    }
    return {...context,item,key,valid,message,transform};
  }

  /**
   * 解析鼠标附近的物理接头，不依赖当前连接工具模式。
   * 右键菜单和悬浮快捷菜单都从这里取得真实几何可用候选，避免先选工具才能识别接头。
   */
  resolveJointContext(hit) {
    const clicked=hit?.object;
    if(!clicked || clicked.userData?.part?.type!=='PROFILE' || !hit?.point)return null;
    const point=hit.point.clone();
    const candidates=this.nearbyJoints(hit);
    candidates.sort((a,b)=>a.distance-b.distance || Number(b.bestScore||0)-Number(a.bestScore||0));
    const first=candidates.find(item=>item.valid);
    if(!first)return null;
    const second=candidates.filter(item=>item.valid)[1]||null;
    const ambiguous=!!(second && Math.abs(Number(second.distance)-Number(first.distance))<3 && second.source.mesh!==first.source.mesh);
    return {...first,ambiguous,worldPoint:point.clone()};
  }

  pushJointCandidate(list,source,target,clickedPoint) {
    if(!source || !target || source.mesh===target.mesh)return;
    const ranked=this.editor.connectionManager.recommendDesignFor(source.mesh,target.mesh,{
      sourceEnd:source.feature.end,
      targetFace:target.feature.face
    });
    const validItems=ranked.filter(item=>item.valid);
    const distance=source.point.distanceTo(clickedPoint)+target.point.distanceTo(clickedPoint);
    list.push({
      source,target,distance,designCandidates:ranked,valid:validItems.length>0,
      bestScore:validItems.length?Math.max(...validItems.map(item=>Number(item.score||0))):0
    });
  }

  installAtContext(mode,partId,worldPoint) {
    const mesh=this.editor.getMeshByPartId(partId);
    if(!mesh || !worldPoint)return null;
    const point=new THREE.Vector3(Number(worldPoint.x||0),Number(worldPoint.y||0),Number(worldPoint.z||0));
    const context=this.resolveJointContext({object:mesh,point});
    const type=String(mode||'').toUpperCase();
    const candidate=context?.designCandidates?.find(item=>item.type===type && item.valid);
    if(!context || !candidate)return null;
    const previousMode=this.mode;
    this.mode=type;
    const connection=this.installConnection(context.source,context.target,candidate.type,'接头快捷菜单');
    this.mode=previousMode;
    if(!previousMode)this.emit('接头快捷安装完成',false);
    return connection;
  }

  resolveAnchorAtWorldPoint(mesh,worldPoint,role) {
    if(!mesh || !worldPoint)return null;
    const feature=role==='TARGET'
      ? resolveProfileSurfaceFeature(mesh,worldPoint,{slotToleranceMm:24})
      : resolveProfileFeature(mesh,worldPoint,{endToleranceMm:46,slotToleranceMm:24});
    if(!feature)return null;
    if(role==='SOURCE' && feature.type!=='PROFILE_END')return null;
    if(role==='TARGET' && !['PROFILE_SLOT','PROFILE_FACE'].includes(feature.type))return null;
    const point=profileFeatureWorldPoint(mesh,feature);
    if(!point || point.distanceTo(worldPoint)>56)return null;
    return {mesh,feature,point,displayId:mesh.userData.part.displayId || mesh.userData.part.name};
  }

  installConnection(sourceAnchor,targetAnchor,designType,inputMode) {
    try{
      const candidate=[];this.pushJointCandidate(candidate,sourceAnchor,targetAnchor,sourceAnchor.point);
      const fresh=this.evaluateCandidate(candidate[0]);
      if(!fresh?.valid)throw new Error(fresh?.message||'接头已变化，请重新选择');
      if(this.existingPartId){
        const existing=this.editor.getMeshByPartId(this.existingPartId);
        if(!existing||!this.editor.isMeshTransformable(existing))throw new Error('原连接件已删除、锁定或安装，请重新选择');
      }
      const connection=this.editor.connectionManager.installDesignComponent(sourceAnchor.mesh,targetAnchor.mesh,{
        sourceEnd:sourceAnchor.feature.end,
        targetFace:targetAnchor.feature.face,
        designType,
        componentDefinition:this.componentDefinition
      });
      connection.placement={
        mode:this.mode,
        sourceAnchor:this.anchorSnapshot(sourceAnchor),
        targetAnchor:this.anchorSnapshot(targetAnchor),
        userPlaced:true,
        inputMode
      };
      if(this.existingPartId)this.editor.removePartByIdSilently(this.existingPartId);
      this.editor.updateDimensions();
      this.editor.interferenceFeedbackManager?.requestRefresh();
      this.editor.emitStats();
      this.editor.historyManager.capture();
      this.editor.emitProjectChanged();
      const current=this.resolveRule(sourceAnchor,targetAnchor)?.item?.label || connection.designType || '连接';
      this.first=null;
      this.hover=null;
      this.directPreview=null;
      this.clearPreview();
      this.emit(`已吸附安装：${current}`);
      this.cancel();
      return connection;
    }catch(error){
      this.emit(error?.message || '连接安装失败');
      return null;
    }
  }

  resolveAnchor(hit,role) {
    const mesh=hit?.object;
    if(!mesh || mesh.userData?.part?.type!=='PROFILE' || !hit?.point)return null;
    const feature=role==='TARGET'
      ? resolveProfileSurfaceFeature(mesh,hit.point,{slotToleranceMm:18})
      : resolveProfileFeature(mesh,hit.point,{endToleranceMm:36,slotToleranceMm:18});
    if(!feature)return null;
    if(role==='SOURCE' && feature.type!=='PROFILE_END')return null;
    if(role==='TARGET' && !['PROFILE_SLOT','PROFILE_FACE'].includes(feature.type))return null;
    return {mesh,feature,point:profileFeatureWorldPoint(mesh,feature) || hit.point.clone(),displayId:mesh.userData.part.displayId || mesh.userData.part.name};
  }

  resolveRule(sourceAnchor,targetAnchor) {
    const ranked=this.editor.connectionManager.recommendDesignFor(sourceAnchor.mesh,targetAnchor.mesh,{
      sourceEnd:sourceAnchor.feature.end,
      targetFace:targetAnchor.feature.face
    });
    const type=this.mode;
    const item=ranked.find(row=>row.type===type && row.valid) || ranked.find(row=>row.type===type);
    return {item,message:item?.error || `当前位置没有可用的${modeLabel(type)}`};
  }

  statusText() {
    if(this.directPreview){
      if(!this.directPreview.valid)return `不可安装：${this.directPreview.message}`;
      const choices=this.candidates.filter(c=>c.valid),index=choices.findIndex(c=>c.key===this.directPreview.key)+1;
      return `自动对齐：${this.directPreview.source.displayId} → ${this.directPreview.target.displayId} · 单击确认${choices.length>1?` · ${index}/${choices.length}，Tab 切换`:''}`;
    }
    if(!this.first)return this.hover ? `可选：${this.hover.displayId} ${featureLabel(this.hover.feature)}` : '请点击接头附近；无法自动判断时再按提示选择两个位置';
    if(!this.hover)return '请选择第二根型材的侧面或槽位';
    if(this.first.mesh===this.hover.mesh)return '请选择另一根型材的连接面';
    const contexts=[];this.pushJointCandidate(contexts,this.first,this.hover,this.first.point);
    const result=this.evaluateCandidate(contexts[0]);
    return result?.valid ? `自动对齐：${result.item.label} · 单击确认` : (result?.message || '当前位置不可连接');
  }

  renderPreview() {
    this.clearPreview();
    if(this.directPreview){
      const {source,transform,valid}=this.directPreview;
      const color=valid?0x24b36b:0xd9534f;
      if(transform)this.previewGroup.add(connectorGhost(this.mode,transform.position,color,this.componentDefinition,transform));
      else this.previewGroup.add(marker(source.point,color,3));
      return;
    }
    const anchor=this.hover || this.first;
    if(!anchor)return;
    this.previewGroup.add(marker(anchor.point,0x24b36b,7));
    if(this.first && this.hover){
      const result=this.resolveRule(this.first,this.hover);
      const valid=!!result.item?.valid;
      this.previewGroup.add(marker(this.first.point,valid?0x24b36b:0xd9534f,8));
      this.previewGroup.add(marker(this.hover.point,valid?0x24b36b:0xd9534f,8));
      const contexts=[];this.pushJointCandidate(contexts,this.first,this.hover,this.first.point);
      const candidate=this.evaluateCandidate(contexts[0]);
      if(candidate?.transform)this.previewGroup.add(connectorGhost(this.mode,candidate.transform.position,candidate.valid?0x24b36b:0xd9534f,this.componentDefinition,candidate.transform));
    }
  }

  clearPreview() {
    while(this.previewGroup.children.length){
      const child=this.previewGroup.children.pop();
      child.traverse(object=>{object.geometry?.dispose?.();if(Array.isArray(object.material))object.material.forEach(m=>m.dispose());else object.material?.dispose?.();});
    }
  }

  profileMeshes(){return (this.editor.meshes || []).filter(mesh=>mesh.visible!==false && !mesh.userData?.part?.hidden && mesh.userData?.part?.type==='PROFILE'&&isLinearProfile(mesh.userData.part));}

  anchorSnapshot(anchor){return {partId:anchor.mesh.userData.part.id,type:anchor.feature.type,end:anchor.feature.end||null,face:anchor.feature.face||null,slotId:anchor.feature.slotId||null,stationS:Number(anchor.feature.stationS||0)};}

  emit(message,notify=true){this.onChanged?.({active:this.isActive(),mode:this.mode,step:this.first?2:1,message,notify,valid:this.directPreview?.valid??null,candidateCount:this.candidates.filter(c=>c.valid).length});}
}

function marker(point,color,size){
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(size,16,16),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.88,depthTest:false}));
  mesh.position.copy(point);mesh.renderOrder=1400;return mesh;
}
function connectorGhost(mode,point,color,definition=null,transform=null){
  if(definition){
    const group=PrimitiveGeometryFactory.create({type:'ACCESSORY',accessoryType:definition.accessoryType,dimensions:definition.dimensions,color});
    group.position.copy(point);if(transform)group.quaternion.copy(transform.quaternion);group.traverse(object=>{if(object.isMesh){object.material.color.set(color);object.material.transparent=true;object.material.opacity=.42;object.material.depthTest=true;object.material.depthWrite=false;object.renderOrder=1399;}});return group;
  }
  const dimensions=mode==='CONNECTION_PLATE'?[52,5,52]:mode==='INTERNAL_CONNECTOR'?[18,18,42]:[34,6,34];
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...dimensions),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.28,depthTest:false}));
  mesh.position.copy(point);if(transform)mesh.quaternion.copy(transform.quaternion);mesh.renderOrder=1399;return mesh;
}
function disposePreview(object){object.traverse(child=>{child.geometry?.dispose();for(const material of [].concat(child.material||[]))material.dispose();});}
function modeLabel(mode){return ({ANGLE_BRACKET:'角码连接',INTERNAL_CONNECTOR:'内置连接',ANCHOR_CONNECTOR:'锚式连接',CONNECTION_PLATE:'连接板'})[mode] || '连接方式';}

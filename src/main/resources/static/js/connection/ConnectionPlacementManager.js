import * as THREE from 'three';
import {resolveProfileFeature,resolveProfileSurfaceFeature,profileFeatureWorldPoint,featureLabel} from '../model/ProfileFeatureCatalog.js';

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
    this.onChanged=null;
    this.previewGroup=new THREE.Group();
    this.previewGroup.name='__connection_placement_preview__';
    this.editor.sceneManager.scene.add(this.previewGroup);
  }

  isActive(){return !!this.mode;}

  begin(mode='ANGLE_BRACKET') {
    this.mode=String(mode || 'ANGLE_BRACKET').toUpperCase();
    this.first=null;
    this.hover=null;
    this.directPreview=null;
    this.clearPreview();
    this.emit('请点击需要安装连接件的接头位置；系统会优先自动吸附两根型材');
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
    this.first=null;
    this.hover=null;
    this.directPreview=null;
    this.clearPreview();
    if(wasActive)this.emit('已退出连接放置');
  }

  handlePointerMove(event) {
    if(!this.isActive())return false;
    const hit=this.editor.sceneManager.pickHit(event,this.profileMeshes());
    this.directPreview=!this.first ? this.resolveDirectJoint(hit) : null;
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
      const direct=this.resolveDirectJoint(hit);
      if(direct?.valid){
        this.installConnection(direct.source,direct.target,direct.item.type,'单击吸附');
        return true;
      }
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

  resolveDirectJoint(hit) {
    const context=this.resolveJointContext(hit);
    if(!context)return null;
    const item=context.designCandidates.find(row=>row.type===this.mode && row.valid)
      || context.designCandidates.find(row=>row.type===this.mode);
    if(!item?.valid)return null;
    return {source:context.source,target:context.target,item,valid:true,distance:context.distance,message:item.error||''};
  }

  /**
   * 解析鼠标附近的物理接头，不依赖当前连接工具模式。
   * 右键菜单和悬浮快捷菜单都从这里取得真实几何可用候选，避免先选工具才能识别接头。
   */
  resolveJointContext(hit) {
    const clicked=hit?.object;
    if(!clicked || clicked.userData?.part?.type!=='PROFILE' || !hit?.point)return null;
    const point=hit.point.clone();
    const candidates=[];
    const all=this.profileMeshes().filter(mesh=>mesh!==clicked);
    const clickedEnd=this.resolveAnchor(hit,'SOURCE');
    const clickedTarget=this.resolveAnchor(hit,'TARGET');
    for(const other of all){
      const otherEnd=this.resolveAnchorAtWorldPoint(other,point,'SOURCE');
      const otherTarget=this.resolveAnchorAtWorldPoint(other,point,'TARGET');
      this.pushJointCandidate(candidates,clickedEnd,otherTarget,point);
      this.pushJointCandidate(candidates,otherEnd,clickedTarget,point);
    }
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
      const connection=this.editor.connectionManager.createConnection(sourceAnchor.mesh,targetAnchor.mesh,{
        sourceEnd:sourceAnchor.feature.end,
        targetFace:targetAnchor.feature.face,
        designType
      });
      connection.placement={
        mode:this.mode,
        sourceAnchor:this.anchorSnapshot(sourceAnchor),
        targetAnchor:this.anchorSnapshot(targetAnchor),
        userPlaced:true,
        inputMode
      };
      this.editor.emitStats();
      this.editor.historyManager.capture();
      this.editor.emitProjectChanged();
      const current=this.resolveRule(sourceAnchor,targetAnchor)?.item?.label || connection.designType || '连接';
      this.first=null;
      this.hover=null;
      this.directPreview=null;
      this.clearPreview();
      this.emit(`已吸附安装：${current}`);
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
    if(this.directPreview?.valid)return `可吸附安装：${this.directPreview.item.label} · 单击确认`;
    if(!this.first)return this.hover ? `可选：${this.hover.displayId} ${featureLabel(this.hover.feature)}` : '请点击接头附近；无法自动判断时再按提示选择两个位置';
    if(!this.hover)return '请选择第二根型材的侧面或槽位';
    const result=this.resolveRule(this.first,this.hover);
    return result.item?.valid ? `可安装：${result.item.label}` : (result.message || '当前位置不可连接');
  }

  renderPreview() {
    this.clearPreview();
    if(this.directPreview?.valid){
      const {source,target}=this.directPreview;
      this.previewGroup.add(marker(source.point,0x24b36b,8));
      this.previewGroup.add(marker(target.point,0x24b36b,8));
      const center=source.point.clone().lerp(target.point,0.5);
      this.previewGroup.add(connectorGhost(this.mode,center,0x24b36b));
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
      const center=this.first.point.clone().lerp(this.hover.point,0.5);
      this.previewGroup.add(connectorGhost(this.mode,center,valid?0x24b36b:0xd9534f));
    }
  }

  clearPreview() {
    while(this.previewGroup.children.length){
      const child=this.previewGroup.children.pop();
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    }
  }

  profileMeshes(){return (this.editor.meshes || []).filter(mesh=>mesh.visible!==false && mesh.userData?.part?.type==='PROFILE');}

  anchorSnapshot(anchor){return {partId:anchor.mesh.userData.part.id,type:anchor.feature.type,end:anchor.feature.end||null,face:anchor.feature.face||null,slotId:anchor.feature.slotId||null,stationS:Number(anchor.feature.stationS||0)};}

  emit(message,notify=true){this.onChanged?.({active:this.isActive(),mode:this.mode,step:this.first?2:1,message,notify});}
}

function marker(point,color,size){
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(size,16,16),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.88,depthTest:false}));
  mesh.position.copy(point);mesh.renderOrder=1400;return mesh;
}
function connectorGhost(mode,point,color){
  const dimensions=mode==='CONNECTION_PLATE'?[52,5,52]:mode==='INTERNAL_CONNECTOR'?[18,18,42]:[34,6,34];
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...dimensions),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.28,depthTest:false}));
  mesh.position.copy(point);mesh.renderOrder=1399;return mesh;
}
function modeLabel(mode){return ({ANGLE_BRACKET:'角码连接',INTERNAL_CONNECTOR:'内置连接',ANCHOR_CONNECTOR:'锚式连接',CONNECTION_PLATE:'连接板'})[mode] || '连接方式';}

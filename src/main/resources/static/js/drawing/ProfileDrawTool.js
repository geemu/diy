import * as THREE from 'three';
import {profileQuaternion,workPlaneNormal} from '../geometry/ProfileOrientation.js';
import {featureLabel} from '../model/ProfileFeatureCatalog.js';
import {getDesignProfileDefinition} from '../model/DesignProfileCatalog.js';
import {profileObb, intersectObb} from '../validation/PartCollisionDetector.js';
import ProfileGeometryFactory from '../geometry/ProfileGeometryFactory.js';
import ProfileDrawOverlay from '../ui/ProfileDrawOverlay.js';
import {resolveScreenAxis} from './ScreenAxisResolver.js';

/** 玩家型材绘制：自由空间搭建、斜向绘制与工作平面轮廓共用提交和干涉保护。 */
export default class ProfileDrawTool {
  constructor(editor){
    this.editor=editor;
    this.mode='OFF';
    this.options=this.defaults();
    this.start=null;
    this.hover=null;
    this.contourPoints=[];
    this.previewGroup=null;
    this.polylinePreviousMesh=null;
    this.polylineOrigin=null;
    this.sessionSegments=[];
    this.typedLength='';
    this.axisLock=null;
    this.lastPointer=null;
    this.lengthOverlay=null;
    this.idlePreviewLengthMm=0;
    this.onStateChanged=null;
  }

  defaults(){return {catalogId:'DESIGN-3030',faceClosures:[],plane:'XZ',orthogonal:true,gridSnap:true,gridStepMm:10,fixedLengthMm:0,continueDrawing:false,boxWidthMm:1000,boxDepthMm:600,boxHeightMm:1000,contourCloseToleranceMm:28};}
  isActive(){return this.mode!=='OFF';}
  dispose(){this.stop();this.lengthOverlay?.dispose();this.lengthOverlay=null;}
  configure(options={}){if(options.catalogId&&options.catalogId!==this.options.catalogId)this.clearPreview();this.options={...this.options,...options};this.emit();return {...this.options};}

  begin(mode='LINE',options={}){
    const next=String(mode||'LINE').toUpperCase();
    if(!['FREE','DIAGONAL','LINE','POLYLINE','RECTANGLE','BOX','CONTOUR'].includes(next))throw new Error(`不支持的绘制模式：${mode}`);
    this.axisLock=null;this.lastPointer=null;
    if(typeof document!=='undefined'&&!this.lengthOverlay)this.lengthOverlay=new ProfileDrawOverlay(this);
    // 首击前只显示截面对应的一小段，不把侧栏长度当成已生成的型材。
    const {previewLengthMm=0,...drawingOptions}=options;
    const definition=getDesignProfileDefinition(drawingOptions.catalogId||this.options.catalogId);
    this.idlePreviewLengthMm=next==='FREE'?Math.max(40,Math.min(120,Math.max(Number(definition?.width||30),Number(definition?.height||30))*2)):0;
    this.mode=next;this.configure(drawingOptions);this.start=null;this.hover=null;this.contourPoints=[];this.polylinePreviousMesh=null;this.polylineOrigin=null;this.sessionSegments=[];this.typedLength='';this.clearPreview();
    this.editor.sceneManager.setMarqueeMode(false);
    this.editor.sceneManager.transformControls.detach();
    const canvas=this.editor.sceneManager.renderer.domElement,cursor=next==='FREE'?profileDrawingCursor():'crosshair';
    canvas.style.cursor=cursor;
    // 普通悬停/端部手柄的清理会重置inline cursor；独占画笔不能被这些清理吞掉。
    canvas.style.setProperty?.('--profile-draw-cursor',cursor);
    canvas.classList?.toggle('profile-drawing-active',next==='FREE');
    this.emit();return this.state();
  }

  stop(){
    this.idlePreviewLengthMm=0;
    this.axisLock=null;this.lastPointer=null;
    this.mode='OFF';this.start=null;this.hover=null;this.contourPoints=[];this.polylinePreviousMesh=null;this.polylineOrigin=null;this.sessionSegments=[];this.typedLength='';this.clearPreview();
    this.editor.sceneManager.renderer.domElement.style.cursor='';
    this.editor.sceneManager.renderer.domElement.classList?.remove('profile-drawing-active');
    this.editor.sceneManager.renderer.domElement.style.removeProperty?.('--profile-draw-cursor');
    if(this.editor.sceneManager.snapMarker)this.editor.sceneManager.snapMarker.visible=false;
    this.editor.sceneManager.hideSnapFeedback?.();
    this.editor.sceneManager.clearSnapPreview?.();
    if(this.editor.selected&&this.editor.selected.userData?.part?.locked!==true)this.editor.sceneManager.transformControls.attach(this.editor.selected);
    this.emit();
  }

  cancelStep(){
    this.typedLength='';
    if(this.mode==='CONTOUR'&&this.contourPoints.length){
      this.editor.sceneManager.hideSnapFeedback?.();
      this.editor.sceneManager.clearSnapPreview?.();
      this.contourPoints.pop();
      this.start=this.contourPoints.length?this.contourPoints[this.contourPoints.length-1]:null;
      this.hover=null;this.clearPreview();this.emit();return true;
    }
    if(this.mode==='POLYLINE'&&this.sessionSegments.length){this.stop();return true;}
    if(this.start){this.start=null;this.hover=null;this.polylineOrigin=null;this.clearPreview();this.editor.sceneManager.hideSnapFeedback?.();this.editor.sceneManager.clearSnapPreview?.();this.emit();return true;}
    this.stop();return false;
  }

  handleKeyDown(event){
    if(!this.isActive())return false;
    const key=String(event?.key||'');
    if(key==='Escape'){this.stop();return true;}
    if(key==='Enter'&&this.mode==='FREE'&&!this.start){this.stop();return true;}
    if(key==='Tab'&&this.mode==='FREE'){
      const axes=['Z','X','Y'],index=Math.max(0,axes.indexOf(this.axisLock||'Z'));
      this.axisLock=axes[(index+(event.shiftKey?2:1))%3];
      if(this.lastPointer)this.handlePointerMove(this.lastPointer);
      this.emit();return true;
    }
    if(this.mode==='FREE'&&['Alt','Shift'].includes(key)){
      this.handleModifierChange(event);return true;
    }
    if(this.mode==='FREE'&&/^[xyz]$/i.test(key)&&!event.altKey&&!event.ctrlKey&&!event.metaKey){
      const axis=key.toUpperCase();this.axisLock=this.axisLock===axis?null:axis;
      if(this.lastPointer)this.handlePointerMove(this.lastPointer);
      this.emit();return true;
    }
    if(key==='Backspace'){
      if(this.typedLength){
        this.typedLength=this.typedLength.slice(0,-1);
        this.refreshTypedPreview();
      }else if(this.mode==='POLYLINE'&&this.sessionSegments.length)this.undoLastSegment();
      else if(this.mode==='CONTOUR'&&this.contourPoints.length)this.cancelStep();
      else if(this.start)this.cancelStep();
      else return false;
      return true;
    }
    if((/^\d$/.test(key)||key==='.')&&this.start&&['FREE','DIAGONAL','LINE','POLYLINE','CONTOUR'].includes(this.mode)){
      if(key==='.'&&this.typedLength.includes('.'))return true;
      this.typedLength=`${this.typedLength}${key}`.slice(0,10);
      this.refreshTypedPreview();
      return true;
    }
    if(key==='Enter'&&this.start&&['FREE','DIAGONAL','LINE','POLYLINE','CONTOUR'].includes(this.mode)){
      const length=Number(this.typedLength);
      if(!Number.isFinite(length)||length<1)return this.typedLength?true:false;
      this.commitLength(this.typedLength);
      return true;
    }
    return false;
  }

  commitLength(value){
    const length=Number(value);
    if(!this.start||!Number.isFinite(length)||length<1||length>50000)return false;
    const candidate=this.typedCandidate(length);
    if(this.mode==='CONTOUR'){this.typedLength='';this.handleContourClick(candidate);return true;}
    return this.commitLinearCandidate(candidate);
  }

  updateLengthDraft(value){
    const text=String(value||''),length=Number(text);
    const valid=text&&Number.isFinite(length)&&length>0&&length<=50000;
    this.typedLength=valid?text:'';
    if(valid)this.refreshTypedPreview();
  }

  /** 修饰键在鼠标静止时也重新计算方向，避免松开 Alt 后仍沿用旧斜向预览。 */
  handleModifierChange(event){
    if(this.mode==='FREE'&&this.lastPointer)this.handlePointerMove({...this.lastPointer,altKey:event.altKey,shiftKey:event.shiftKey,ctrlKey:event.ctrlKey});
  }

  refreshTypedPreview(){
    if(!this.start)return;
    const length=Number(this.typedLength);
    const candidate=Number.isFinite(length)&&length>0?this.typedCandidate(length):(this.hover||this.start);
    this.updatePreview(candidate);
    this.showDraftFeedback(candidate);
    this.emit();
  }

  typedCandidate(length,reference=this.hover){
    const plane=this.options.plane;
    let delta=(reference?.point||this.start.point.clone().add(defaultPlaneDirection(plane))).clone().sub(this.start.point);
    if(this.mode!=='FREE')delta=projectToPlane(delta,plane);
    if(this.mode==='FREE'){
      if(this.axisLock||reference?.axis||reference?.shiftKey)delta=orthogonalDelta3d(delta,this.axisLock);
    }else if(this.mode!=='DIAGONAL'&&this.options.orthogonal!==false)delta=orthogonalDelta(delta,plane);
    if(delta.lengthSq()<1e-9){delta=defaultPlaneDirection(plane);if(this.mode==='FREE'&&this.axisLock){delta.set(0,0,0);delta[this.axisLock.toLowerCase()]=1;}}
    delta.normalize().multiplyScalar(Number(length));
    const candidate={point:this.start.point.clone().add(delta),feature:null,snapLabel:`输入 ${Number(length)} mm`,typed:true,axis:this.mode==='FREE'?(this.axisLock||reference?.axis||null):null,shiftKey:reference?.shiftKey===true};
    // 自由搭建的输入表示真实型材长度，不把搭接预留量从用户输入中扣除。
    if(this.mode==='FREE'&&this.start.feature?.type==='PROFILE_END')candidate.point=this.linearSegment(candidate).start.add(delta);
    return candidate;
  }

  undoLastSegment(){
    const last=this.sessionSegments.pop();
    if(!last)return false;
    const partId=last.partId;
    for(const connection of [...this.editor.connectionManager.connections]){
      if(connection.sourceProfileId===partId||connection.targetProfileId===partId)this.editor.connectionManager.removeConnection(connection.id);
    }
    this.editor.constraintManager.removeForPart(partId);
    this.editor.removePartByIdSilently(partId);
    const previous=this.sessionSegments[this.sessionSegments.length-1]||null;
    this.start=previous?cloneCandidate(previous.logicalEnd):cloneCandidate(this.polylineOrigin);
    this.polylinePreviousMesh=previous?this.editor.getMeshByPartId(previous.partId):null;
    this.hover=null;this.typedLength='';this.clearPreview();
    this.editor.updateDimensions();this.editor.emitStats();this.editor.historyManager.capture();this.editor.emitProjectChanged();this.editor.interferenceFeedbackManager.requestRefresh();
    this.emit({undonePartId:partId});
    return true;
  }

  handlePointerMove(event){
    if(!this.isActive())return;
    this.lastPointer={clientX:event.clientX,clientY:event.clientY,ctrlKey:event.ctrlKey,shiftKey:event.shiftKey,altKey:event.altKey};
    const candidate=this.resolvePointer(event);
    if(!candidate)return;
    this.hover=candidate;
    if(this.mode!=='FREE')this.editor.sceneManager.showSnapPoint(candidate.point);
    const draft=this.typedLength?this.typedCandidate(Number(this.typedLength)||0):candidate;
    this.updatePreview(draft);
    this.showDraftFeedback(draft);
    this.emit();
  }

  handleClick(event){
    if(!this.isActive())return false;
    const candidate=this.start&&Number(this.typedLength)>0?this.typedCandidate(Number(this.typedLength)):this.resolvePointer(event);
    if(!candidate)return true;
    this.typedLength='';
    if(this.mode==='CONTOUR'){this.handleContourClick(candidate);return true;}
    if(this.mode==='BOX'){
      const p=candidate.point;
      const assemblyId=this.editor.addFrame({catalogId:this.options.catalogId,width:this.options.boxWidthMm,depth:this.options.boxDepthMm,height:this.options.boxHeightMm,position:{x:p.x,y:p.y,z:p.z},captureHistory:false});
      const profileIds=this.editor.parts.filter(part=>part.type==='PROFILE'&&part.assemblyId===assemblyId).map(part=>part.id);
      const collision=this.editor.interferenceFeedbackManager.refresh({focusIds:new Set(profileIds),live:false});
      if(collision.active){
        this.rollbackParts(profileIds);
        this.editor.onTransformBlocked?.(collision);
        return true;
      }
      const autoConnection=this.editor.autoConnectionEnabled?this.editor.autoConnectProfiles(profileIds,{source:'PROFILE_DRAW_BOX'}):null;
      this.editor.historyManager.capture();this.editor.emitProjectChanged();
      this.start=null;this.hover=null;this.clearPreview();this.emit({committed:'BOX',autoConnections:Number(autoConnection?.createdCount||0)});return true;
    }
    if(!this.start){
      this.start=cloneCandidate(candidate);
      if(this.mode==='POLYLINE')this.polylineOrigin=cloneCandidate(candidate);
      this.hover=candidate;this.updatePreview(candidate);
      if(this.mode==='FREE')this.lengthOverlay?.beginAt(candidate.point);
      this.emit();return true;
    }
    if(this.mode==='RECTANGLE'){
      const end=candidate;
      const created=this.createRectangle(this.start.point,end.point);
      if(created.length){this.start=null;this.hover=null;this.clearPreview();this.emit({committed:'RECTANGLE',createdCount:created.length});}
      return true;
    }
    return this.commitLinearCandidate(candidate);
  }

  commitLinearCandidate(candidate){
    const segment=this.linearSegment(candidate);
    const end=segment.candidate;
    if(!this.start||this.start.point.distanceTo(end.point)<1)return true;
    const logicalStart=this.start.point.clone();
    const logicalEnd=segment.end;
    const physicalStart=segment.start;
    if(physicalStart.distanceTo(logicalEnd)<1)return true;
    const startCandidate=cloneCandidate(this.start);
    const mesh=this.editor.addProfileBetweenPoints(this.options.catalogId,physicalStart,logicalEnd,{captureHistory:false,crossSectionUp:workPlaneNormal(this.options.plane),faceClosures:[...(this.options.faceClosures||[])]});
    const collision=this.editor.interferenceFeedbackManager.refresh({focusIds:new Set([mesh.userData.part.id]),live:false});
    if(collision.active&&this.mode!=='FREE'){
      this.editor.removePartByIdSilently(mesh.userData.part.id);
      this.editor.interferenceFeedbackManager.requestRefresh();
      this.editor.onTransformBlocked?.(collision);
      this.editor.emitStats();
      return false;
    }
    // 玩家可显式保留红色干涉位置；不能把红色构件继续当成成功吸附来派生连接。
    if(collision.active)this.editor.onTransformBlocked?.(collision);
    const autoResults=[];
    if(this.editor.autoConnectionEnabled&&!collision.active){
      const startSnap=connectionSnapFromFeature(this.start.feature,'START');
      const endSnap=connectionSnapFromFeature(end.feature,'END');
      for(const snap of [startSnap,endSnap]){
        if(!snap||snap.targetProfileId===mesh.userData.part.id)continue;
        const result=this.editor.autoConnectionResolver.connectFromSnap(mesh,{snap,source:'PROFILE_DRAW'});
        if(result?.status==='CREATED'){
          autoResults.push(result);
          if(this.editor.onAutoConnectionChanged)this.editor.onAutoConnectionChanged(result);
        }
      }
    }
    if(this.editor.autoConnectionEnabled&&!collision.active&&this.mode==='FREE'){
      // 端点特征没有 face，搭接后交给既有几何连接解析，不在绘制层另写连接规则。
      const ids=[mesh.userData.part.id,this.start.feature?.partId,end.feature?.partId].filter(Boolean);
      const result=this.editor.autoConnectProfiles([...new Set(ids)],{source:'PROFILE_DRAW_FREE'});
      for(let i=0;i<Number(result?.createdCount||0);i++)autoResults.push({status:'CREATED'});
    }
    this.editor.emitStats();
    this.editor.historyManager.capture();
    this.editor.emitProjectChanged();
    const part=mesh.userData.part;
    this.editor.sceneManager.transformControls.detach();
    const nextStart={point:end.point.clone(),feature:{type:'PROFILE_END',kind:'ENDPOINT',partId:part.id,displayId:part.displayId,end:'END',stationS:Number(part.dimensions.length),worldPoint:end.point.clone()},snapLabel:`${part.displayId} B端点`};
    if(this.mode==='POLYLINE'){
      this.sessionSegments.push({partId:part.id,logicalStart:startCandidate,logicalEnd:cloneCandidate(nextStart)});
      this.start=nextStart;this.polylinePreviousMesh=mesh;
    }else{
      this.start=null;this.polylinePreviousMesh=null;this.polylineOrigin=null;
    }
    this.hover=null;this.typedLength='';this.clearPreview();
    // 默认单次完成即回到选择；连续添加是明确选择，不让玩家困在“还在画”的状态。
    if(this.mode==='FREE'&&this.options.continueDrawing!==true)this.stop();
    this.emit({committed:'PROFILE',partId:part.id,lengthMm:Number(part.dimensions.length),autoConnections:autoResults.length});return true;
  }

  rollbackParts(partIds=[]){
    const ids=new Set((partIds||[]).filter(Boolean));
    if(!ids.size)return;
    for(const connection of [...this.editor.connectionManager.connections]){
      if(ids.has(connection.sourceProfileId)||ids.has(connection.targetProfileId))this.editor.connectionManager.removeConnection(connection.id);
    }
    for(const partId of ids){
      this.editor.constraintManager.removeForPart(partId);
      this.editor.removePartByIdSilently(partId);
    }
    this.editor.assemblyManager.reconcile();
    this.editor.updateDimensions();
    this.editor.emitStats();
    this.editor.interferenceFeedbackManager.requestRefresh();
  }

  state(extra={}){
    return {active:this.isActive(),mode:this.mode,axisLock:this.axisLock,start:this.start?toPlain(this.start):null,hover:this.hover?toPlain(this.hover):null,contourPointCount:this.contourPoints.length,typedLength:this.typedLength,segmentCount:this.sessionSegments.length,options:{...this.options},...extra};
  }

  handleContourClick(candidate){
    let next=candidate;
    if(this.contourPoints.length){
      this.start=this.contourPoints[this.contourPoints.length-1];
      next=this.applyDraftRules(candidate);
      const first=this.contourPoints[0];
      const closeTolerance=Math.max(8,Number(this.options.contourCloseToleranceMm||28));
      if(this.contourPoints.length>=3&&next.point.distanceTo(first.point)<=closeTolerance){
        this.finishContour();
        return;
      }
      if(next.point.distanceTo(this.start.point)<1)return;
    }
    const stored={point:next.point.clone(),feature:next.feature||null,snapLabel:next.snapLabel||''};
    this.contourPoints.push(stored);
    this.start=stored;this.hover=null;this.updatePreview(stored);this.emit();
  }

  finishContour(){
    if(this.mode!=='CONTOUR')throw new Error('当前不是轮廓绘制模式');
    if(this.contourPoints.length<3)throw new Error('闭合轮廓至少需要 3 个点');
    const points=this.contourPoints.map(item=>item.point.clone());
    const result=this.createContourFrame(points,{source:'PROFILE_DRAW_CONTOUR'});
    this.start=null;this.hover=null;this.contourPoints=[];this.typedLength='';this.clearPreview();
    this.emit({committed:'CONTOUR',createdCount:result.createdCount,autoConnections:Number(result.autoConnection?.createdCount||0),assemblyId:result.assemblyId});
    return result;
  }

  /** 从给定闭合轮廓直接创建参数化轮廓框，供快捷模板和交互绘制共用。 */
  createContourFrame(inputPoints,options={}){
    const points=(inputPoints||[]).map(point=>point?.isVector3?point.clone():new THREE.Vector3(Number(point?.x||0),Number(point?.y||0),Number(point?.z||0)));
    if(points.length<3)throw new Error('闭合轮廓至少需要 3 个点');
    const plane=options.plane||this.options.plane||'XZ';
    validateSimpleContour(points,plane);
    const assemblyId=crypto.randomUUID();
    const created=[];
    const catalogId=options.catalogId||this.options.catalogId;
    const segments=closedButtJointSegments(points,catalogId,plane);
    for(const segment of segments){
      created.push(this.editor.addProfileBetweenPoints(catalogId,segment.start,segment.end,{select:false,captureHistory:false,assemblyId,crossSectionUp:workPlaneNormal(plane),name:options.edgeName||'轮廓框架边'}));
    }
    this.editor.assemblyManager.reconcile();
    const assembly=this.editor.assemblyManager.get(assemblyId);
    if(assembly){
      assembly.name=options.name||'轮廓生成框架';
      assembly.kind='PARAMETRIC_FRAME';
      assembly.configurator='CONTOUR_FRAME';
      assembly.parameters={
        catalogId,
        plane,
        orthogonal:options.orthogonal ?? (this.options.orthogonal!==false),
        gridSnap:options.gridSnap ?? (this.options.gridSnap!==false),
        gridStepMm:Number(options.gridStepMm||this.options.gridStepMm||10),
        presetType:options.presetType||null,
        simpleConstraints:[],
        points:points.map(point=>({x:round(point.x),y:round(point.y),z:round(point.z)})),
        edgeLengths:points.map((point,index)=>round(point.distanceTo(points[(index+1)%points.length])))
      };
    }
    const profileIds=created.map(mesh=>mesh.userData.part.id);
    const collision=this.editor.interferenceFeedbackManager.refresh({focusIds:new Set(profileIds),live:false});
    if(collision.active){
      this.rollbackParts(profileIds);
      this.editor.onTransformBlocked?.(collision);
      throw new Error(collision.issues?.[0]?.message||'轮廓框与现有构件发生实体干涉');
    }
    const autoConnection=this.editor.autoConnectionEnabled?this.editor.autoConnectProfiles(profileIds,{source:options.source||'CONTOUR_FRAME_CREATE'}):null;
    if(created.length)this.editor.selectMany(created);
    this.editor.manufacturingIdentityManager?.reconcile();
    this.editor.historyManager.capture();this.editor.emitStats();this.editor.emitProjectChanged();
    return {assemblyId,createdCount:created.length,autoConnection};
  }

  resolvePointer(event){
    const snapActive=this.editor.snapManager.isEnabled();
    const roots=this.editor.meshes.filter(mesh=>mesh.visible!==false&&mesh.userData?.part?.type==='PROFILE');
    const hit=snapActive?this.editor.sceneManager.pickHit(event,roots):null;
    if(hit?.object&&hit.point){
      const feature=this.editor.snapManager.resolveFeatureAtPoint(hit.object,hit.point,{endToleranceMm:32});
      if(feature&&this.acceptFeature(feature))return {point:feature.worldPoint.clone(),feature,snapLabel:`${feature.displayId} ${featureLabel(feature)}`,shiftKey:event?.shiftKey===true};
    }
    if(this.mode==='FREE'&&this.start){
      const result=event.altKey&&!this.axisLock?null:resolveScreenAxis(this.editor.sceneManager.camera,this.editor.sceneManager.renderer.domElement.getBoundingClientRect(),event,this.start.point,this.axisLock,event.shiftKey||this.axisLock?90:8);
      // 屏幕只能确定二维方向：离轴的斜杆落在当前面；已锁轴不能退回斜向，防止误切。
      if(!result&&this.axisLock)return null;
      let point=result?.point||this.editor.sceneManager.worldPointOnPlane(event,planeNormal(this.options.plane),this.start.point);
      if(!point)return null;
      if(snapActive){
        const nearest=this.editor.snapManager.findFeatureNearWorldPoint(point,{maxDistanceMm:Math.max(18,this.editor.snapManager.distance)});
        if(nearest&&this.acceptFeature(nearest))return {point:nearest.worldPoint.clone(),feature:nearest,snapLabel:`${nearest.displayId} ${featureLabel(nearest)}`};
      }
      if(this.options.gridSnap!==false&&!event?.ctrlKey){
        if(result){
          const axis=result.axis.toLowerCase(),step=Math.max(1,Number(this.options.gridStepMm||10));
          point=point.clone();point[axis]=this.start.point[axis]+Math.round((point[axis]-this.start.point[axis])/step)*step;
        }else point=snapPointToGrid(point,this.options.gridStepMm,this.options.plane,this.start.point);
      }
      return {point,feature:null,snapLabel:result?`${result.axis} 轴方向`:'斜向定位',axis:result?.axis||null,shiftKey:event.shiftKey===true};
    }
    // 空白工作平面代表型材外表面；中心线抬高半个截面厚度。已有接头优先保持实际坐标。
    const halfHeight=Number(getDesignProfileDefinition(this.options.catalogId)?.sectionSize?.[1]||30)/2;
    const planePoint=this.start?.point||workPlaneNormal(this.options.plane).multiplyScalar(this.mode==='BOX'?0:halfHeight);
    const normal=planeNormal(this.options.plane);
    let point=this.editor.sceneManager.worldPointOnPlane(event,normal,planePoint);
    if(!point)return null;
    if(snapActive){
      const nearest=this.editor.snapManager.findFeatureNearWorldPoint(point,{maxDistanceMm:Math.max(18,this.editor.snapManager.distance)});
      if(nearest&&this.acceptFeature(nearest))return {point:nearest.worldPoint.clone(),feature:nearest,snapLabel:`${nearest.displayId} ${featureLabel(nearest)}`,shiftKey:event?.shiftKey===true};
    }
    if(this.options.gridSnap!==false&&!event?.ctrlKey)point=snapPointToGrid(point,this.options.gridStepMm,this.options.plane,planePoint);
    return {point,feature:null,snapLabel:this.options.gridSnap!==false&&!event?.ctrlKey?'网格':'自由定位',shiftKey:event?.shiftKey===true};
  }

  applyDraftRules(candidate){
    if(!this.start)return candidate;
    if(candidate.feature)return candidate;
    let delta=candidate.point.clone().sub(this.start.point);
    if(this.mode==='FREE'){
      if(this.axisLock||candidate.axis||candidate.shiftKey)delta=orthogonalDelta3d(delta,this.axisLock);
    }
    else {
      delta=projectToPlane(delta,this.options.plane);
      if((this.mode!=='DIAGONAL'&&this.options.orthogonal!==false)||candidate.shiftKey===true)delta=orthogonalDelta(delta,this.options.plane);
    }
    const fixed=candidate.typed===true?0:Math.max(0,Number(this.options.fixedLengthMm||0));
    if(fixed>0&&delta.lengthSq()>1e-9)delta.normalize().multiplyScalar(fixed);
    return {...candidate,point:this.start.point.clone().add(delta)};
  }

  acceptFeature(feature){
    if(this.mode!=='FREE'||!this.start||!this.axisLock)return true;
    const delta=feature.worldPoint.clone().sub(this.start.point);
    const axisDelta=orthogonalDelta3d(delta,this.axisLock);
    // 显式锁轴时拒绝偏离该轴的接头；未锁定时允许直接吸附空间端点画斜杆。
    return delta.distanceTo(axisDelta)<.5;
  }

  linearSegment(candidate){
    // 右侧“按此长度绘制”也按真实切料长度处理，不因起点搭接扣掉半个截面。
    if(this.mode==='FREE'&&this.start&&!candidate.typed&&Number(this.options.fixedLengthMm)>0)return this.linearSegment(this.typedCandidate(Number(this.options.fixedLengthMm),candidate));
    const end=this.applyDraftRules(candidate);
    let start=this.start?.point.clone()||end.point.clone();
    let finish=end.point.clone();
    if(this.mode==='POLYLINE'&&this.polylinePreviousMesh)start=continuationButtStart(this.polylinePreviousMesh,start,finish);
    if(this.mode==='FREE'&&this.start){
      if(this.start.feature?.type==='PROFILE_END'){
        const host=this.editor.getMeshByPartId(this.start.feature.partId);
        if(host)start=continuationButtStart(host,start,finish);
      }else if(!this.start.feature){
        const delta=finish.clone().sub(start);
        const normal=workPlaneNormal(this.options.plane);
        if(delta.lengthSq()>1e-8&&Math.abs(delta.clone().normalize().dot(normal))>.999){
          const halfHeight=Number(getDesignProfileDefinition(this.options.catalogId)?.sectionSize?.[1]||30)/2;
          start.addScaledVector(normal,-halfHeight);finish.addScaledVector(normal,-halfHeight);
        }
      }
      if(end.feature?.type==='PROFILE_END'){
        const host=this.editor.getMeshByPartId(end.feature.partId);
        if(host)finish=continuationButtStart(host,finish,start);
      }
    }
    return {start,end:finish,candidate:end};
  }

  createRectangle(a,b){
    const corners=rectangleCorners(a,b,this.options.plane);
    if(!corners||corners.some((p,index)=>p.distanceTo(corners[(index+1)%corners.length])<1))return [];
    const assemblyId=crypto.randomUUID();
    const created=[];
    const segments=closedButtJointSegments(corners,this.options.catalogId,this.options.plane);
    for(const segment of segments)created.push(this.editor.addProfileBetweenPoints(this.options.catalogId,segment.start,segment.end,{select:false,captureHistory:false,assemblyId,crossSectionUp:workPlaneNormal(this.options.plane),name:'绘制矩形框架'}));
    if(created.length){
      const ids=created.map(mesh=>mesh.userData.part.id);
      const collision=this.editor.interferenceFeedbackManager.refresh({focusIds:new Set(ids),live:false});
      if(collision.active){
        this.rollbackParts(ids);
        this.editor.onTransformBlocked?.(collision);
        return [];
      }
      this.editor.selectMany(created);
      if(this.editor.autoConnectionEnabled)this.editor.autoConnectProfiles(ids,{source:'PROFILE_DRAW_RECTANGLE'});
      this.editor.interferenceFeedbackManager?.requestRefresh();
    }
    this.editor.historyManager.capture();this.editor.emitProjectChanged();return created;
  }

  showDraftFeedback(candidate){
    const details=[];
    let label=candidate?.feature?'几何吸附':'网格定位';
    let status=candidate?.feature?'valid':'neutral';
    if(candidate?.snapLabel)details.push(candidate.snapLabel);
    if(this.start){
      const end=this.mode==='RECTANGLE'?candidate:this.applyDraftRules(candidate);
      // 自由搭建等直线模式统一显示实体长度，不能把搭接预留量混进用户输入口径。
      const segment=['FREE','DIAGONAL','LINE','POLYLINE'].includes(this.mode)?this.linearSegment(candidate):null;
      const delta=segment?segment.end.clone().sub(segment.start):end.point.clone().sub(this.start.point);
      const length=delta.length();
      if(length>0.001){
        details.push(`${Number(length.toFixed(1))} mm`);
        const axisAligned=this.mode==='FREE'?!!(this.axisLock||candidate.axis||candidate.shiftKey):((this.mode!=='DIAGONAL'&&this.options.orthogonal!==false)||candidate.shiftKey===true);
        if(axisAligned&&!candidate.feature){
          const axis=this.mode==='FREE'?dominantAxis3d(delta):dominantAxis(delta,this.options.plane);
          label=`${axis} 轴对齐`;
          details.unshift('正交锁定');
        }
      }
      const collision=this.previewCollision(candidate);
      if(collision){
        status='blocked';
        label='实体干涉';
        details.unshift(`${collision.targetLabel} · 穿透约 ${Number(collision.penetrationMm.toFixed(1))} mm`);
      }else if(candidate?.feature){
        status='valid';
        label=candidate.feature.face?'面接触 / 几何吸附':'几何吸附';
      }
    }
    this.editor.sceneManager.showSnapFeedback?.({status,label,details});
    this.editor.sceneManager.clearSnapPreview?.();
    if(candidate?.feature)this.editor.sceneManager.showSnapSurface?.(this.editor.getMeshByPartId(candidate.feature.partId),candidate.feature,status==='blocked'?0xe54848:0x25c778);
    if(status!=='blocked'&&this.previewGroup&&this.start){
      const feature=candidate?.feature||this.start.feature;
      if(feature){
        const alignmentLabel=this.editor.sceneManager.showCoplanarPreview?.(this.previewGroup,this.editor.getMeshByPartId(feature.partId));
        if(alignmentLabel)this.editor.sceneManager.showSnapFeedback?.({status,label,details:[...details,alignmentLabel]});
      }
    }
  }

  previewCollision(candidate){
    if(!this.start||!candidate)return null;
    const segments=[];
    if(this.mode==='RECTANGLE'){
      const corners=rectangleCorners(this.start.point,candidate.point,this.options.plane);
      if(!corners)return null;
      segments.push(...closedButtJointSegments(corners,this.options.catalogId,this.options.plane));
    }else{
      const segment=this.linearSegment(candidate);
      if(segment.start.distanceTo(segment.end)<1)return null;
      segments.push(segment);
    }
    const existing=(this.editor.parts||[]).filter(part=>part?.type==='PROFILE');
    let best=null;
    for(const segment of segments){
      const draft=draftProfilePart(this.options.catalogId,segment.start,segment.end,this.options.plane);
      const draftObb=profileObb(draft);
      if(!draftObb)continue;
      for(const target of existing){
        const targetObb=profileObb(target);
        if(!targetObb)continue;
        const result=intersectObb(draftObb,targetObb,Number(this.editor.projectSettings?.collisionToleranceMm??0.5));
        if(!result.intersects)continue;
        if(!best||result.minPenetrationMm>best.penetrationMm){
          best={targetLabel:target.displayId||target.name||'型材',penetrationMm:Number(result.minPenetrationMm||0)};
        }
      }
    }
    return best;
  }

  updatePreview(candidate){
    if(['FREE','DIAGONAL','LINE','POLYLINE'].includes(this.mode)){this.updateSolidPreview(candidate);return;}
    this.clearPreview();
    if(this.mode==='CONTOUR'){
      if(!this.contourPoints.length)return;
      const end=this.applyDraftRules(candidate);
      const points=this.contourPoints.map(item=>item.point.clone());
      if(!points[points.length-1].equals(end.point))points.push(end.point.clone());
      const group=new THREE.Group();
      const material=new THREE.LineDashedMaterial({color:0x2e71ff,dashSize:18,gapSize:9,depthTest:false});
      const geometry=new THREE.BufferGeometry().setFromPoints(points);
      const line=new THREE.Line(geometry,material);line.computeLineDistances();line.renderOrder=1400;group.add(line);
      if(points.length>=3){
        const closeMaterial=new THREE.LineDashedMaterial({color:0x37a66f,dashSize:10,gapSize:8,depthTest:false,transparent:true,opacity:.75});
        const closeGeometry=new THREE.BufferGeometry().setFromPoints([points[points.length-1],points[0]]);
        const closeLine=new THREE.Line(closeGeometry,closeMaterial);closeLine.computeLineDistances();closeLine.renderOrder=1400;group.add(closeLine);
      }
      const markerMaterial=new THREE.MeshBasicMaterial({color:0x2e71ff,depthTest:false});
      points.slice(0,-1).forEach((p,index)=>{const marker=new THREE.Mesh(new THREE.SphereGeometry(index===0?6:4.5,12,12),markerMaterial.clone());marker.position.copy(p);marker.renderOrder=1401;group.add(marker);});
      this.previewGroup=group;this.editor.sceneManager.scene.add(group);return;
    }
    if(!this.start)return;
    const end=this.mode==='RECTANGLE'?candidate:this.applyDraftRules(candidate);
    const points=this.mode==='RECTANGLE'?rectanglePreviewPoints(this.start.point,end.point,this.options.plane):[this.start.point,end.point];
    if(!points?.length)return;
    const group=new THREE.Group();
    const collision=this.previewCollision(candidate);
    const previewColor=collision?0xe24848:(candidate?.feature?0x36c978:0x2e71ff);
    const material=new THREE.LineDashedMaterial({color:previewColor,dashSize:18,gapSize:9,depthTest:false});
    const geometry=new THREE.BufferGeometry().setFromPoints(points);
    const line=new THREE.Line(geometry,material);line.computeLineDistances();line.renderOrder=1400;group.add(line);
    const markerMaterial=new THREE.MeshBasicMaterial({color:0x2e71ff,depthTest:false});
    for(const p of [this.start.point,end.point]){const marker=new THREE.Mesh(new THREE.SphereGeometry(5,12,12),markerMaterial.clone());marker.position.copy(p);marker.renderOrder=1401;group.add(marker);}
    this.previewGroup=group;this.editor.sceneManager.scene.add(group);
  }

  updateSolidPreview(candidate){
    if(!this.start){this.updateIdlePreview(candidate);return;}
    const segment=this.linearSegment(candidate),length=segment.start.distanceTo(segment.end);
    if(length<1){this.clearPreview();return;}
    this.renderSolidSegment(segment,candidate);
    this.lengthOverlay?.update(segment.start,segment.end,length,this.typedLength);
  }

  /** 同一绘制流程的起点提示，仍只有一份临时几何；首击不能创建默认长度的正式构件。 */
  updateIdlePreview(candidate){
    if(this.idlePreviewLengthMm<1||!candidate?.point){this.clearPreview();return;}
    const direction=new THREE.Vector3();direction[(this.axisLock||'Z').toLowerCase()]=1;
    const normal=workPlaneNormal(this.options.plane),start=candidate.point.clone();
    if(!candidate.feature&&Math.abs(direction.dot(normal))>.999999){
      const halfHeight=Number(getDesignProfileDefinition(this.options.catalogId)?.height||30)/2;
      start.addScaledVector(normal,-halfHeight);
    }
    this.renderSolidSegment({start,end:start.clone().addScaledVector(direction,this.idlePreviewLengthMm)},candidate);
    this.lengthOverlay?.hide();
  }

  renderSolidSegment(segment,candidate){
    const length=segment.start.distanceTo(segment.end);
    if(!this.previewGroup){
      const part=draftProfilePart(this.options.catalogId,segment.start,segment.end,this.options.plane);
      part.dimensions.length=1;part.profilePath.length=1;
      this.previewGroup=ProfileGeometryFactory.create(part);
      this.previewGroup.name='__profile_draw_preview__';
      this.previewGroup.traverse(object=>{
        if(object.material){object.material.transparent=true;object.material.opacity=.72;object.material.depthWrite=false;}
        object.castShadow=false;
      });
      this.editor.sceneManager.scene.add(this.previewGroup);
    }
    const direction=segment.end.clone().sub(segment.start).normalize();
    this.previewGroup.position.copy(segment.start).add(segment.end).multiplyScalar(.5);
    this.previewGroup.quaternion.copy(profileQuaternion(direction,workPlaneNormal(this.options.plane)));
    this.previewGroup.scale.set(1,1,length);
    const collision=this.previewCollision(candidate),color=collision?0xe24848:0xc0c8d1;
    this.previewGroup.traverse(object=>{if(object.isMesh)object.material.color.setHex(color);});
  }

  clearPreview(){
    this.lengthOverlay?.hide();
    if(!this.previewGroup)return;
    this.editor.sceneManager.scene.remove(this.previewGroup);
    this.previewGroup.traverse(obj=>{obj.geometry?.dispose?.();if(obj.material){if(Array.isArray(obj.material))obj.material.forEach(m=>m.dispose?.());else obj.material.dispose?.();}});
    this.previewGroup=null;
  }
  emit(extra={}){this.onStateChanged?.(this.state(extra));}
}

/** 通用瞄准器式画笔，固定屏幕像素，不是世界尺寸球体，也不参与拾取。 */
function profileDrawingCursor(){
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g fill="none" stroke="#f59e0b" stroke-width="1.8"><circle cx="16" cy="16" r="9.5"/><path d="M16 2V12M16 20V30M2 16H12M20 16H30"/></g><circle cx="16" cy="16" r="1.8" fill="#f59e0b"/></svg>';
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 16 16, crosshair`;
}

function connectionSnapFromFeature(feature,sourceEnd){
  if(!feature?.partId||!feature.face)return null;
  return {
    type:feature.type==='PROFILE_SLOT'?'END_TO_SLOT':'END_TO_FACE',
    targetProfileId:feature.partId,
    sourceEnd:sourceEnd==='END'?'END':'START',
    targetFace:feature.face,
    slot:feature.type==='PROFILE_SLOT'?'CENTER':null,
    slotId:feature.slotId||null,
    distance:0,
    fromProfileDraw:true
  };
}

function cloneCandidate(candidate){
  if(!candidate)return null;
  return {point:candidate.point?.clone?.()||new THREE.Vector3(Number(candidate.point?.x||0),Number(candidate.point?.y||0),Number(candidate.point?.z||0)),feature:candidate.feature?{...candidate.feature,worldPoint:candidate.feature.worldPoint?.clone?.()||candidate.feature.worldPoint}:null,snapLabel:candidate.snapLabel||'',shiftKey:candidate.shiftKey===true,typed:candidate.typed===true};
}
function defaultPlaneDirection(plane){if(plane==='YZ')return new THREE.Vector3(0,1,0);return new THREE.Vector3(1,0,0);}
function planeNormal(plane){if(plane==='XY')return new THREE.Vector3(0,0,1);if(plane==='YZ')return new THREE.Vector3(1,0,0);return new THREE.Vector3(0,1,0);}
function projectToPlane(v,plane){const out=v.clone();if(plane==='XY')out.z=0;else if(plane==='YZ')out.x=0;else out.y=0;return out;}
function orthogonalDelta(v,plane){const out=new THREE.Vector3();const axes=plane==='XY'?['x','y']:plane==='YZ'?['y','z']:['x','z'];const axis=Math.abs(v[axes[0]])>=Math.abs(v[axes[1]])?axes[0]:axes[1];out[axis]=v[axis];return out;}
function dominantAxis3d(v){return ['X','Y','Z'].sort((a,b)=>Math.abs(v[b.toLowerCase()])-Math.abs(v[a.toLowerCase()]))[0];}
function orthogonalDelta3d(v,lockedAxis=null){const axis=(lockedAxis||dominantAxis3d(v)).toLowerCase();const out=new THREE.Vector3();out[axis]=v[axis];return out;}
function snapPointToGrid(point,stepRaw,plane,origin){const step=Math.max(1,Number(stepRaw||10));const out=point.clone();const axes=plane==='XY'?['x','y']:plane==='YZ'?['y','z']:['x','z'];for(const axis of axes)out[axis]=Math.round(out[axis]/step)*step;const fixed=plane==='XY'?'z':plane==='YZ'?'x':'y';out[fixed]=origin[fixed];return out;}
function rectangleCorners(a,b,plane){if(plane==='XY')return [new THREE.Vector3(a.x,a.y,a.z),new THREE.Vector3(b.x,a.y,a.z),new THREE.Vector3(b.x,b.y,a.z),new THREE.Vector3(a.x,b.y,a.z)];if(plane==='YZ')return [new THREE.Vector3(a.x,a.y,a.z),new THREE.Vector3(a.x,b.y,a.z),new THREE.Vector3(a.x,b.y,b.z),new THREE.Vector3(a.x,a.y,b.z)];return [new THREE.Vector3(a.x,a.y,a.z),new THREE.Vector3(b.x,a.y,a.z),new THREE.Vector3(b.x,a.y,b.z),new THREE.Vector3(a.x,a.y,b.z)];}
function rectanglePreviewPoints(a,b,plane){const c=rectangleCorners(a,b,plane);return c?[...c,c[0]]:null;}
function validateSimpleContour(points,plane){
  const projected=points.map(point=>projectPoint2d(point,plane));
  for(let i=0;i<projected.length;i++){
    const a=projected[i],b=projected[(i+1)%projected.length];
    if(Math.hypot(a.x-b.x,a.y-b.y)<1)throw new Error('轮廓中存在长度过小的边');
  }
  for(let i=0;i<projected.length;i++){
    const a1=projected[i],a2=projected[(i+1)%projected.length];
    for(let j=i+1;j<projected.length;j++){
      if(j===i||j===(i+1)%projected.length||(i===0&&j===projected.length-1))continue;
      const b1=projected[j],b2=projected[(j+1)%projected.length];
      if(segmentsIntersect2d(a1,a2,b1,b2))throw new Error('轮廓存在自相交，请调整轮廓点');
    }
  }
}
function projectPoint2d(point,plane){if(plane==='XY')return{x:point.x,y:point.y};if(plane==='YZ')return{x:point.y,y:point.z};return{x:point.x,y:point.z};}
function segmentsIntersect2d(a,b,c,d){
  const orient=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);
  const eps=1e-8;
  return ((o1>eps&&o2<-eps)||(o1<-eps&&o2>eps))&&((o3>eps&&o4<-eps)||(o3<-eps&&o4>eps));
}
function toPlain(candidate){return {point:{x:round(candidate.point.x),y:round(candidate.point.y),z:round(candidate.point.z)},snapLabel:candidate.snapLabel||'',feature:candidate.feature?stripWorld(candidate.feature):null};}
function stripWorld(feature){const copy={...feature};delete copy.worldPoint;return copy;}
function round(value){return Number(Number(value).toFixed(2));}


/**
 * 连续折线中的后一根型材从前一根型材的侧面开始，而不是从同一个中心线角点开始。
 * 这样 90° 连续搭框不会在角部产生半个截面的实体穿透。
 */
function continuationButtStart(previousMesh,logicalStart,logicalEnd){
  const direction=logicalEnd.clone().sub(logicalStart);
  if(direction.lengthSq()<1e-9)return logicalStart.clone();
  direction.normalize();
  previousMesh.updateMatrixWorld(true);
  const previousAxis=new THREE.Vector3(0,0,1).transformDirection(previousMesh.matrixWorld).normalize();
  if(Math.abs(previousAxis.dot(direction))>0.25)return logicalStart.clone();
  const part=previousMesh.userData?.part;
  const section=part?.dimensions?.sectionSize||[part?.dimensions?.size||30,part?.dimensions?.size||30];
  const xAxis=new THREE.Vector3(1,0,0).transformDirection(previousMesh.matrixWorld).normalize();
  const yAxis=new THREE.Vector3(0,1,0).transformDirection(previousMesh.matrixWorld).normalize();
  const extent=Math.abs(direction.dot(xAxis))*Number(section[0]||30)/2+Math.abs(direction.dot(yAxis))*Number(section[1]||30)/2;
  return logicalStart.clone().addScaledVector(direction,Math.max(0,extent));
}

/**
 * 闭合框使用“当前边从逻辑角点起步、在下一根型材侧面结束”的搭接规则。
 * points 始终保留为设计轮廓事实；这里只派生真实切料段，避免把轮廓参数和物理搭接混在一起。
 */
function closedButtJointSegments(points,catalogId,plane='XZ'){
  const definition=getDesignProfileDefinition(catalogId);
  const section=definition?.sectionSize||[30,30];
  const result=[];
  for(let i=0;i<points.length;i++){
    const start=points[i].clone();
    const logicalEnd=points[(i+1)%points.length].clone();
    const nextEnd=points[(i+2)%points.length].clone();
    const currentDirection=logicalEnd.clone().sub(start);
    const nextDirection=nextEnd.clone().sub(logicalEnd);
    const currentLength=currentDirection.length();
    if(currentLength<1)continue;
    currentDirection.normalize();
    if(nextDirection.lengthSq()<1e-9){result.push({start,end:logicalEnd});continue;}
    nextDirection.normalize();
    const angleDot=Math.abs(currentDirection.dot(nextDirection));
    let trim=0;
    if(angleDot<0.25)trim=profileCrossHalfExtent(section,nextDirection,currentDirection,plane);
    trim=Math.min(Math.max(0,trim),Math.max(0,currentLength-1));
    const end=logicalEnd.clone().addScaledVector(currentDirection,-trim);
    result.push({start,end,logicalStart:start.clone(),logicalEnd});
  }
  return result;
}

function profileCrossHalfExtent(section,profileDirection,probeDirection,plane){
  const quaternion=profileQuaternion(profileDirection,workPlaneNormal(plane));
  const xAxis=new THREE.Vector3(1,0,0).applyQuaternion(quaternion).normalize();
  const yAxis=new THREE.Vector3(0,1,0).applyQuaternion(quaternion).normalize();
  return Math.abs(probeDirection.dot(xAxis))*Number(section[0]||30)/2+Math.abs(probeDirection.dot(yAxis))*Number(section[1]||30)/2;
}

function draftProfilePart(catalogId,start,end,plane){
  const definition=getDesignProfileDefinition(catalogId);
  const delta=end.clone().sub(start);
  const length=delta.length();
  const direction=delta.clone().normalize();
  const quaternion=profileQuaternion(direction,workPlaneNormal(plane));
  const euler=new THREE.Euler().setFromQuaternion(quaternion,'XYZ');
  const midpoint=start.clone().add(end).multiplyScalar(0.5);
  const section=definition?.sectionSize||[30,30];
  return {
    id:'__DRAFT__',displayId:'预览',type:'PROFILE',
    position:{x:midpoint.x,y:midpoint.y,z:midpoint.z},
    rotation:{x:euler.x,y:euler.y,z:euler.z},
    dimensions:{length,size:Number(section[0]||30),sectionSize:[Number(section[0]||30),Number(section[1]||30)]},
    profilePath:{type:'LINE',length},designProfile:{profileId:definition?.id||catalogId}
  };
}

function dominantAxis(delta,plane){const axes=plane==='XY'?['X','Y']:plane==='YZ'?['Y','Z']:['X','Z'];const values={X:Math.abs(delta.x),Y:Math.abs(delta.y),Z:Math.abs(delta.z)};return values[axes[0]]>=values[axes[1]]?axes[0]:axes[1];}

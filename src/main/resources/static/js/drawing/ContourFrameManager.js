import * as THREE from 'three';
import {profileQuaternion,workPlaneNormal} from '../geometry/ProfileOrientation.js';
import {getDesignProfileDefinition} from '../model/DesignProfileCatalog.js';

/**
 * 参数化轮廓框编辑器。
 *
 * 轮廓是 Assembly.parameters 中的设计数据；型材只是轮廓的派生结果。
 * 修改点位或边长时会整框重建，因此不会让相邻型材之间出现累计缝隙。
 */
export default class ContourFrameManager {
  constructor(editor){
    this.editor=editor;
    this.active=false;
    this.assemblyId=null;
    this.dragIndex=-1;
    this.group=new THREE.Group();
    this.group.name='__contour_frame_edit__';
    this.group.visible=false;
    this.editor.sceneManager.scene.add(this.group);
    this.onChanged=null;
    this.onDimensionRequest=null;
    this.onContextAction=null;
    this.onRelationRequest=null;
    this.highlightConstraintId=null;
    this.boundDown=event=>this.handlePointerDown(event);
    this.boundMove=event=>this.handlePointerMove(event);
    this.boundUp=event=>this.handlePointerUp(event);
    this.boundContext=event=>this.handleContextMenu(event);
    const canvas=this.editor.sceneManager.renderer.domElement;
    canvas.addEventListener('pointerdown',this.boundDown,true);
    canvas.addEventListener('pointermove',this.boundMove,true);
    canvas.addEventListener('pointerup',this.boundUp,true);
    canvas.addEventListener('contextmenu',this.boundContext,true);
  }

  isContourAssembly(assemblyId){
    const assembly=this.editor.assemblyManager.get(assemblyId);
    return assembly?.configurator==='CONTOUR_FRAME' && Array.isArray(assembly.parameters?.points) && assembly.parameters.points.length>=3;
  }

  get(assemblyId=this.assemblyId){
    const assembly=this.editor.assemblyManager.get(assemblyId);
    return this.isContourAssembly(assemblyId)?assembly:null;
  }

  begin(assemblyId){
    const assembly=this.get(assemblyId);
    if(!assembly)throw new Error('当前组件不是可编辑的轮廓框');
    this.active=true;
    this.assemblyId=assembly.id;
    this.dragIndex=-1;
    this.highlightConstraintId=null;
    this.editor.sceneManager.transformControls.detach();
    this.refreshOverlay();
    this.emit({message:'拖动蓝色轮廓点可修改框架；也可在属性面板直接输入边长'});
    return this.state();
  }

  stop(){
    if(!this.active&&!this.group.visible)return;
    this.active=false;
    this.assemblyId=null;
    this.dragIndex=-1;
    this.group.visible=false;
    this.clearGroup();
    if(!this.editor.sceneManager.transformControls.dragging)this.editor.sceneManager.orbitControls.enabled=true;
    this.emit();
  }

  state(extra={}){
    const assembly=this.get();
    const points=(assembly?.parameters?.points||[]).map(clonePoint);
    return {
      active:this.active,
      assemblyId:this.assemblyId,
      pointCount:points.length,
      points,
      edges:edgeRows(points),
      orthogonal:assembly?.parameters?.orthogonal!==false,
      plane:assembly?.parameters?.plane||'XZ',
      simpleConstraints:(assembly?.parameters?.simpleConstraints||[]).map(item=>({...item})),
      highlightConstraintId:this.highlightConstraintId,
      ...extra
    };
  }

  emit(extra={}){this.onChanged?.(this.state(extra));}

  refreshOverlay(previewPoints=null){
    const assembly=this.get();
    if(!assembly)return;
    const points=(previewPoints||assembly.parameters.points).map(toVector3);
    this.clearGroup();
    const lineMaterial=new THREE.LineDashedMaterial({color:0x2e71ff,dashSize:14,gapSize:7,depthTest:false,transparent:true,opacity:.95});
    const lineGeometry=new THREE.BufferGeometry().setFromPoints([...points,points[0]]);
    const line=new THREE.Line(lineGeometry,lineMaterial);line.computeLineDistances();line.renderOrder=1600;this.group.add(line);
    points.forEach((point,index)=>{
      const next=points[(index+1)%points.length];
      const edgeHit=createEdgeHitMesh(point,next,index);this.group.add(edgeHit);
      const dimension=createDimensionSprite(point,next,index,assembly.parameters.plane);this.group.add(dimension);
      const marker=new THREE.Mesh(
        new THREE.SphereGeometry(this.dragIndex===index?8:6,18,18),
        new THREE.MeshBasicMaterial({color:this.dragIndex===index?0xff9428:0x2e71ff,depthTest:false,transparent:true,opacity:.96})
      );
      marker.position.copy(point);marker.renderOrder=1604;marker.userData.contourPointIndex=index;this.group.add(marker);
    });
    for(const relation of assembly.parameters.simpleConstraints||[]){
      const sprite=createConstraintSprite(relation,points,assembly.parameters.plane,this.highlightConstraintId===relation.id);
      if(sprite)this.group.add(sprite);
    }
    this.group.visible=this.active;
  }

  clearGroup(){
    while(this.group.children.length){
      const child=this.group.children.pop();
      child.geometry?.dispose?.();
      if(Array.isArray(child.material))child.material.forEach(item=>{item?.map?.dispose?.();item?.dispose?.();});else {child.material?.map?.dispose?.();child.material?.dispose?.();}
    }
  }

  handlePointerDown(event){
    if(!this.active||event.button!==0)return;
    const relations=this.group.children.filter(child=>child.userData?.contourConstraintId);
    const relationHits=this.editor.sceneManager.raycast(event,relations);
    if(relationHits.length){
      const id=relationHits[0].object.userData.contourConstraintId;
      const relation=(this.get()?.parameters?.simpleConstraints||[]).find(item=>item.id===id);
      if(relation){
        this.highlightConstraintId=id;
        this.refreshOverlay();
        event.preventDefault();event.stopPropagation();event.stopImmediatePropagation?.();
        this.onRelationRequest?.({assemblyId:this.assemblyId,constraintId:id,constraint:{...relation},clientX:event.clientX,clientY:event.clientY});
        this.emit({highlightConstraintId:id,message:constraintLabel(relation)});
        return;
      }
    }
    const dimensions=this.group.children.filter(child=>Number.isInteger(child.userData?.contourDimensionIndex));
    const dimensionHits=this.editor.sceneManager.raycast(event,dimensions);
    if(dimensionHits.length){
      const index=Number(dimensionHits[0].object.userData.contourDimensionIndex);
      const assembly=this.get();const points=(assembly?.parameters?.points||[]).map(toVector3);
      const current=points.length?round(points[index].distanceTo(points[(index+1)%points.length])):0;
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation?.();
      this.onDimensionRequest?.({assemblyId:this.assemblyId,edgeIndex:index,lengthMm:current});
      return;
    }
    const markers=this.group.children.filter(child=>Number.isInteger(child.userData?.contourPointIndex));
    const hits=this.editor.sceneManager.raycast(event,markers);
    if(!hits.length)return;
    const marker=hits[0].object;
    this.dragIndex=Number(marker.userData.contourPointIndex);
    this.editor.sceneManager.orbitControls.enabled=false;
    this.editor.sceneManager.renderer.domElement.style.cursor='grabbing';
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation?.();
    this.refreshOverlay();
    this.emit({dragging:true,message:`正在调整轮廓点 ${this.dragIndex+1}`});
  }

  handlePointerMove(event){
    if(!this.active||this.dragIndex<0)return;
    const assembly=this.get();if(!assembly)return;
    const points=assembly.parameters.points.map(toVector3);
    const current=points[this.dragIndex];
    const point=this.editor.sceneManager.worldPointOnPlane(event,planeNormal(assembly.parameters.plane),current);
    if(!point)return;
    const snapped=this.applyPointRules(point,this.dragIndex,points,assembly.parameters);
    points[this.dragIndex]=snapped;
    this.refreshOverlay(points);
    this.emit({dragging:true,previewPoint:clonePoint(snapped)});
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation?.();
  }

  handlePointerUp(event){
    if(!this.active||this.dragIndex<0)return;
    const assembly=this.get();
    const points=(assembly?.parameters?.points||[]).map(toVector3);
    const current=points[this.dragIndex]||new THREE.Vector3();
    const point=this.editor.sceneManager.worldPointOnPlane(event,planeNormal(assembly?.parameters?.plane),current);
    const index=this.dragIndex;
    this.dragIndex=-1;
    this.editor.sceneManager.orbitControls.enabled=true;
    this.editor.sceneManager.renderer.domElement.style.cursor='';
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation?.();
    if(!point||!assembly){this.refreshOverlay();this.emit();return;}
    const snapped=this.applyPointRules(point,index,points,assembly.parameters);
    try{
      this.updatePoint(index,snapped);
      this.emit({notify:true,message:`轮廓点 ${index+1} 已更新`});
    }catch(error){
      this.refreshOverlay();
      this.emit({notify:true,error:true,message:error?.message||'轮廓点更新失败'});
    }
  }

  handleContextMenu(event){
    if(!this.active)return;
    const interactive=this.group.children.filter(child=>Number.isInteger(child.userData?.contourPointIndex)||Number.isInteger(child.userData?.contourEdgeIndex)||Number.isInteger(child.userData?.contourDimensionIndex));
    const hits=this.editor.sceneManager.raycast(event,interactive);
    if(!hits.length)return;
    const hit=hits[0];const object=hit.object;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation?.();
    if(Number.isInteger(object.userData?.contourPointIndex)){
      this.onContextAction?.({type:'DELETE_POINT',assemblyId:this.assemblyId,pointIndex:Number(object.userData.contourPointIndex)});
      return;
    }
    const edgeIndex=Number.isInteger(object.userData?.contourEdgeIndex)?Number(object.userData.contourEdgeIndex):Number(object.userData?.contourDimensionIndex);
    if(Number.isInteger(edgeIndex))this.onContextAction?.({type:'INSERT_POINT',assemblyId:this.assemblyId,edgeIndex,worldPoint:clonePoint(hit.point)});
  }

  insertPoint(edgeIndex,worldPoint){
    const assembly=this.get();if(!assembly)throw new Error('轮廓框不存在');
    const points=assembly.parameters.points.map(toVector3);
    const index=((Number(edgeIndex)||0)%points.length+points.length)%points.length;
    const a=points[index],b=points[(index+1)%points.length];
    const point=closestPointOnSegment(toVector3(worldPoint),a,b);
    if(point.distanceTo(a)<10||point.distanceTo(b)<10)throw new Error('插入点距离现有转折点过近');
    points.splice(index+1,0,point);
    const previousConstraints=(assembly.parameters.simpleConstraints||[]).map(item=>({...item}));
    validateContour(points,assembly.parameters.plane);
    clearTopologySensitiveConstraints(assembly.parameters);
    try{return this.rebuild(points,{message:`已在第 ${index+1} 条边插入转折点；原简单关系已清除`});}
    catch(error){assembly.parameters.simpleConstraints=previousConstraints;throw error;}
  }

  deletePoint(pointIndex){
    const assembly=this.get();if(!assembly)throw new Error('轮廓框不存在');
    const points=assembly.parameters.points.map(toVector3);
    if(points.length<=3)throw new Error('轮廓至少需要保留 3 个点');
    const index=((Number(pointIndex)||0)%points.length+points.length)%points.length;
    points.splice(index,1);
    const previousConstraints=(assembly.parameters.simpleConstraints||[]).map(item=>({...item}));
    validateContour(points,assembly.parameters.plane);
    if(assembly.parameters.orthogonal!==false&&!isOrthogonalContour(points,assembly.parameters.plane))throw new Error('删除该点会产生斜边；请先关闭正交锁定，或调整相邻点后再删除');
    clearTopologySensitiveConstraints(assembly.parameters);
    try{return this.rebuild(points,{message:`轮廓点 ${index+1} 已删除；原简单关系已清除`});}
    catch(error){assembly.parameters.simpleConstraints=previousConstraints;throw error;}
  }

  applyPointRules(point,index,points,parameters){
    const result=point.clone();
    const plane=parameters?.plane||'XZ';
    const fixedAxis=plane==='XY'?'z':plane==='YZ'?'x':'y';
    result[fixedAxis]=points[0]?.[fixedAxis]??result[fixedAxis];
    const step=Math.max(1,Number(parameters?.gridStepMm||10));
    if(parameters?.gridSnap!==false){
      for(const axis of planeAxes(plane))result[axis]=Math.round(result[axis]/step)*step;
    }
    if(parameters?.orthogonal!==false&&points.length>=3){
      const previous=points[(index-1+points.length)%points.length];
      const next=points[(index+1)%points.length];
      const axes=planeAxes(plane);
      // 选择同时最接近前后正交约束的候选；无法同时满足时优先保持前一条边正交。
      const candidates=[];
      for(const previousAxis of axes){
        for(const nextAxis of axes){
          if(previousAxis===nextAxis)continue;
          const candidate=result.clone();
          const previousOther=axes.find(axis=>axis!==previousAxis);
          const nextOther=axes.find(axis=>axis!==nextAxis);
          candidate[previousOther]=previous[previousOther];
          candidate[nextOther]=next[nextOther];
          candidates.push(candidate);
        }
      }
      if(candidates.length)candidates.sort((a,b)=>a.distanceToSquared(result)-b.distanceToSquared(result));
      if(candidates[0])return candidates[0];
    }
    return result;
  }

  updatePoint(index,point){
    const assembly=this.get();if(!assembly)throw new Error('轮廓框不存在');
    const points=assembly.parameters.points.map(toVector3);
    if(index<0||index>=points.length)throw new Error('轮廓点序号无效');
    points[index]=this.applyPointRules(toVector3(point),index,points,assembly.parameters);
    validateContour(points,assembly.parameters.plane);
    validateSimpleConstraints(points,assembly.parameters);
    return this.rebuild(points,{message:`轮廓点 ${index+1} 已更新`});
  }

  setEdgeLength(edgeIndex,lengthMm){
    const assembly=this.get();if(!assembly)throw new Error('轮廓框不存在');
    const points=assembly.parameters.points.map(toVector3);
    const index=((Number(edgeIndex)||0)%points.length+points.length)%points.length;
    const length=Math.max(10,Number(lengthMm||0));
    if(!Number.isFinite(length))throw new Error('边长必须是有效数字');
    resizeEdge(points,index,length,assembly.parameters);
    applyEqualLengthRelations(points,index,assembly.parameters);
    validateContour(points,assembly.parameters.plane);
    validateSimpleConstraints(points,assembly.parameters);
    return this.rebuild(points,{message:`第 ${index+1} 条边已调整为 ${Math.round(length*100)/100} mm`});
  }

  addSimpleConstraint(type,firstIndex,secondIndex,options={}){
    const assembly=this.get();if(!assembly)throw new Error('轮廓框不存在');
    const parameters=assembly.parameters||(assembly.parameters={});
    const points=(parameters.points||[]).map(toVector3);
    const normalized=String(type||'').toUpperCase();
    const constraints=Array.isArray(parameters.simpleConstraints)?parameters.simpleConstraints.map(item=>({...item})):[];
    if(normalized==='EQUAL_LENGTH'||normalized==='PARALLEL'){
      const edgeA=normalizeIndex(firstIndex,points.length),edgeB=normalizeIndex(secondIndex,points.length);
      if(edgeA===edgeB)throw new Error('请选择两条不同的轮廓边');
      if(normalized==='EQUAL_LENGTH'){
        const targetLength=points[edgeA].distanceTo(points[(edgeA+1)%points.length]);
        resizeEdge(points,edgeB,targetLength,parameters);
      }else if(!edgesParallel(points,edgeA,edgeB))throw new Error('当前两条边不平行，请先调整轮廓后再锁定');
      constraints.push({id:relationId(),type:normalized,edgeA,edgeB});
    }else if(normalized==='ALIGN_POINTS'){
      const pointA=normalizeIndex(firstIndex,points.length),pointB=normalizeIndex(secondIndex,points.length);
      if(pointA===pointB)throw new Error('请选择两个不同的轮廓点');
      const axes=planeAxes(parameters.plane||'XZ');
      const mode=String(options.mode||'HORIZONTAL').toUpperCase();
      const axis=mode==='VERTICAL'?axes[0]:axes[1];
      points[pointB][axis]=points[pointA][axis];
      constraints.push({id:relationId(),type:normalized,pointA,pointB,axis,mode});
    }else throw new Error('不支持的轮廓关系');
    const previous=Array.isArray(parameters.simpleConstraints)?parameters.simpleConstraints.map(item=>({...item})):[];
    parameters.simpleConstraints=dedupeConstraints(constraints);
    try{
      validateContour(points,parameters.plane);
      validateSimpleConstraints(points,parameters);
      return this.rebuild(points,{message:normalized==='EQUAL_LENGTH'?'已建立等长关系':normalized==='PARALLEL'?'已建立平行关系':'已建立点对齐关系'});
    }catch(error){
      parameters.simpleConstraints=previous;
      throw error;
    }
  }

  removeSimpleConstraint(id){
    const assembly=this.get();if(!assembly)throw new Error('轮廓框不存在');
    const parameters=assembly.parameters||(assembly.parameters={});
    parameters.simpleConstraints=(parameters.simpleConstraints||[]).filter(item=>item.id!==id);
    if(this.highlightConstraintId===id)this.highlightConstraintId=null;
    this.editor.historyManager.capture();this.editor.emitProjectChanged();this.refreshOverlay();this.emit({message:'已移除轮廓关系'});
    return parameters.simpleConstraints;
  }

  focusConstraint(id){
    const assembly=this.get();if(!assembly)throw new Error('轮廓框不存在');
    const relation=(assembly.parameters?.simpleConstraints||[]).find(item=>item.id===id);
    if(!relation)throw new Error('轮廓关系不存在');
    this.highlightConstraintId=id;
    this.refreshOverlay();
    this.emit({highlightConstraintId:id,message:constraintLabel(relation)});
    return relation;
  }

  updateSimpleConstraint(id,patch={}){
    const assembly=this.get();if(!assembly)throw new Error('轮廓框不存在');
    const parameters=assembly.parameters||(assembly.parameters={});
    const constraints=(parameters.simpleConstraints||[]).map(item=>({...item}));
    const index=constraints.findIndex(item=>item.id===id);
    if(index<0)throw new Error('轮廓关系不存在');
    const current=constraints[index];
    const points=(parameters.points||[]).map(toVector3);
    const nextType=String(patch.type||current.type||'').toUpperCase();
    let next=null;
    if(nextType==='EQUAL_LENGTH'||nextType==='PARALLEL'){
      const edgeA=normalizeIndex(patch.edgeA??current.edgeA,points.length);
      const edgeB=normalizeIndex(patch.edgeB??current.edgeB,points.length);
      if(edgeA===edgeB)throw new Error('请选择两条不同的轮廓边');
      next={id:current.id,type:nextType,edgeA,edgeB};
      if(nextType==='EQUAL_LENGTH'){
        const targetLength=edgeLength(points,edgeA);
        resizeEdge(points,edgeB,targetLength,parameters);
      }else if(!edgesParallel(points,edgeA,edgeB)){
        makeEdgeParallel(points,edgeA,edgeB);
      }
    }else if(nextType==='ALIGN_POINTS'){
      const pointA=normalizeIndex(patch.pointA??current.pointA,points.length);
      const pointB=normalizeIndex(patch.pointB??current.pointB,points.length);
      if(pointA===pointB)throw new Error('请选择两个不同的轮廓点');
      const mode=String(patch.mode||current.mode||'HORIZONTAL').toUpperCase()==='VERTICAL'?'VERTICAL':'HORIZONTAL';
      const axes=planeAxes(parameters.plane||'XZ');
      const axis=mode==='VERTICAL'?axes[0]:axes[1];
      points[pointB][axis]=points[pointA][axis];
      next={id:current.id,type:'ALIGN_POINTS',pointA,pointB,axis,mode};
    }else throw new Error('不支持的轮廓关系');
    const previous=parameters.simpleConstraints;
    constraints[index]=next;
    parameters.simpleConstraints=dedupeConstraints(constraints);
    if(!parameters.simpleConstraints.some(item=>item.id===id)){
      parameters.simpleConstraints=previous;
      throw new Error('调整后的关系与现有关系重复');
    }
    try{
      validateContour(points,parameters.plane);
      validateSimpleConstraints(points,parameters);
      const result=this.rebuild(points,{message:`已更新：${constraintLabel(next)}`});
      this.highlightConstraintId=id;
      this.refreshOverlay();
      return result;
    }catch(error){
      parameters.simpleConstraints=previous;
      throw error;
    }
  }

  toggleSimpleConstraintType(id){
    const relation=this.focusConstraint(id);
    if(relation.type==='ALIGN_POINTS'){
      const mode=relation.mode==='VERTICAL'?'HORIZONTAL':'VERTICAL';
      return this.updateSimpleConstraint(id,{type:'ALIGN_POINTS',mode});
    }
    const type=relation.type==='EQUAL_LENGTH'?'PARALLEL':'EQUAL_LENGTH';
    return this.updateSimpleConstraint(id,{type,edgeA:relation.edgeA,edgeB:relation.edgeB});
  }


  setOrthogonal(enabled){
    const assembly=this.get();if(!assembly)throw new Error('轮廓框不存在');
    assembly.parameters.orthogonal=enabled!==false;
    this.editor.historyManager.capture();this.editor.emitProjectChanged();this.refreshOverlay();this.emit();
    return assembly.parameters.orthogonal;
  }

  rebuild(points,extra={}){
    const assembly=this.get();if(!assembly)throw new Error('轮廓框不存在');
    validateContour(points,assembly.parameters.plane);
    validateSimpleConstraints(points,assembly.parameters);
    const partIds=this.editor.assemblyManager.directPartIds(assembly.id);
    const oldSet=new Set(partIds);
    for(const connection of [...this.editor.connectionManager.connections]){
      if(oldSet.has(connection.sourceProfileId)||oldSet.has(connection.targetProfileId))this.editor.connectionManager.removeConnection(connection.id);
    }
    for(const id of partIds){this.editor.constraintManager.removeForPart(id);this.editor.removePartByIdSilently(id);}
    const created=[];
    const segments=closedButtJointSegments(points,assembly.parameters.catalogId,assembly.parameters.plane);
    for(let i=0;i<segments.length;i++){
      created.push(this.editor.addProfileBetweenPoints(assembly.parameters.catalogId,segments[i].start,segments[i].end,{
        select:false,captureHistory:false,assemblyId:assembly.id,crossSectionUp:workPlaneNormal(assembly.parameters.plane),name:`轮廓边 ${i+1}`
      }));
    }
    assembly.parameters.points=points.map(clonePoint);
    assembly.parameters.edgeLengths=edgeRows(points).map(row=>row.lengthMm);
    this.editor.assemblyManager.reconcile();
    const autoConnection=this.editor.autoConnectionEnabled?this.editor.autoConnectProfiles(created.map(mesh=>mesh.userData.part.id),{source:'CONTOUR_FRAME_REBUILD'}):null;
    this.editor.selectMany(created);
    this.editor.manufacturingIdentityManager?.reconcile();
    this.editor.updateDimensions();this.editor.emitStats();this.editor.historyManager.capture();this.editor.emitProjectChanged();
    this.refreshOverlay();this.emit({...extra,autoConnections:Number(autoConnection?.createdCount||0)});
    return {assemblyId:assembly.id,createdCount:created.length,autoConnection};
  }
}

function resizeEdge(points,index,length,parameters){
  const nextIndex=(index+1)%points.length;
  const current=points[nextIndex].clone().sub(points[index]);
  if(current.lengthSq()<1e-8)throw new Error('当前边长度过小，无法设置边长');
  if(parameters?.orthogonal!==false){
    const axes=planeAxes(parameters?.plane||'XZ');
    const axis=[...axes].sort((a,b)=>Math.abs(current[b])-Math.abs(current[a]))[0];
    const sign=points[nextIndex][axis]>=points[index][axis]?1:-1;
    const desired=points[index][axis]+sign*length;
    const delta=desired-points[nextIndex][axis];
    points[nextIndex][axis]+=delta;
    let cursor=nextIndex;
    for(let guard=0;guard<points.length-1;guard++){
      const after=(cursor+1)%points.length;
      const edge=points[after].clone().sub(points[cursor]);
      if(Math.abs(edge[axis])>1e-6)break;
      points[after][axis]+=delta;
      cursor=after;
    }
  }else{
    current.normalize();
    points[nextIndex]=points[index].clone().add(current.multiplyScalar(length));
  }
}

function applyEqualLengthRelations(points,changedEdge,parameters){
  const relations=(parameters?.simpleConstraints||[]).filter(item=>item.type==='EQUAL_LENGTH');
  let active=new Set([changedEdge]);
  for(let pass=0;pass<Math.min(4,relations.length+1);pass++){
    const nextActive=new Set();
    for(const relation of relations){
      let source=null,target=null;
      if(active.has(relation.edgeA)){source=relation.edgeA;target=relation.edgeB;}
      else if(active.has(relation.edgeB)){source=relation.edgeB;target=relation.edgeA;}
      if(source===null)continue;
      const length=points[source].distanceTo(points[(source+1)%points.length]);
      resizeEdge(points,target,length,parameters);
      nextActive.add(target);
    }
    if(!nextActive.size)break;
    active=nextActive;
  }
}

function validateSimpleConstraints(points,parameters){
  const tolerance=0.75;
  for(const relation of parameters?.simpleConstraints||[]){
    if(relation.type==='EQUAL_LENGTH'){
      const a=edgeLength(points,relation.edgeA),b=edgeLength(points,relation.edgeB);
      if(Math.abs(a-b)>tolerance)throw new Error(`等长关系未满足：边 ${relation.edgeA+1} 与边 ${relation.edgeB+1}`);
    }else if(relation.type==='PARALLEL'){
      if(!edgesParallel(points,relation.edgeA,relation.edgeB))throw new Error(`平行关系未满足：边 ${relation.edgeA+1} 与边 ${relation.edgeB+1}`);
    }else if(relation.type==='ALIGN_POINTS'){
      const a=points[relation.pointA],b=points[relation.pointB];
      if(!a||!b||Math.abs(a[relation.axis]-b[relation.axis])>tolerance)throw new Error(`点对齐关系未满足：点 ${relation.pointA+1} 与点 ${relation.pointB+1}`);
    }
  }
}
function makeEdgeParallel(points,aIndex,bIndex){
  const ai=normalizeIndex(aIndex,points.length),bi=normalizeIndex(bIndex,points.length);
  const a=points[ai],a2=points[(ai+1)%points.length];
  const b=points[bi],b2=points[(bi+1)%points.length];
  const source=a2.clone().sub(a),current=b2.clone().sub(b);
  if(source.lengthSq()<1e-8||current.lengthSq()<1e-8)throw new Error('边长度过小，无法建立平行关系');
  const length=current.length();
  source.normalize();
  if(source.dot(current)<0)source.multiplyScalar(-1);
  points[(bi+1)%points.length]=b.clone().add(source.multiplyScalar(length));
}

function edgesParallel(points,aIndex,bIndex){
  const a=points[normalizeIndex(aIndex,points.length)],a2=points[(normalizeIndex(aIndex,points.length)+1)%points.length];
  const b=points[normalizeIndex(bIndex,points.length)],b2=points[(normalizeIndex(bIndex,points.length)+1)%points.length];
  const av=a2.clone().sub(a),bv=b2.clone().sub(b);
  if(av.lengthSq()<1e-8||bv.lengthSq()<1e-8)return false;
  av.normalize();bv.normalize();
  return Math.abs(Math.abs(av.dot(bv))-1)<1e-4;
}
function edgeLength(points,index){const i=normalizeIndex(index,points.length);return points[i].distanceTo(points[(i+1)%points.length]);}
function normalizeIndex(index,length){const value=Number(index)||0;return((value%length)+length)%length;}
function relationId(){return`REL-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;}
function dedupeConstraints(items){
  const seen=new Set();return items.filter(item=>{const key=item.type==='ALIGN_POINTS'?`${item.type}:${Math.min(item.pointA,item.pointB)}:${Math.max(item.pointA,item.pointB)}:${item.axis}`:`${item.type}:${Math.min(item.edgeA,item.edgeB)}:${Math.max(item.edgeA,item.edgeB)}`;if(seen.has(key))return false;seen.add(key);return true;});
}
function clearTopologySensitiveConstraints(parameters){if(parameters?.simpleConstraints?.length)parameters.simpleConstraints=[];}


function createConstraintSprite(relation,points,plane,active=false){
  const position=constraintPosition(relation,points,plane);if(!position)return null;
  const symbol=relation.type==='EQUAL_LENGTH'?'＝':relation.type==='PARALLEL'?'∥':relation.type==='ALIGN_POINTS'?(relation.mode==='VERTICAL'?'纵':'横'):'关';
  const canvas=document.createElement('canvas');canvas.width=120;canvas.height=120;const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,120,120);ctx.beginPath();ctx.arc(60,60,46,0,Math.PI*2);ctx.fillStyle=active?'rgba(255,148,40,.98)':'rgba(115,86,207,.96)';ctx.fill();ctx.lineWidth=6;ctx.strokeStyle='#ffffff';ctx.stroke();
  ctx.fillStyle='#ffffff';ctx.font=`800 ${symbol.length>1?38:50}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(symbol,60,62);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));
  sprite.position.copy(position);sprite.scale.set(active?32:27,active?32:27,1);sprite.renderOrder=1606;sprite.userData.contourConstraintId=relation.id;sprite.userData.contourConstraintType=relation.type;return sprite;
}
function constraintPosition(relation,points,plane){
  let position=null;
  if(relation.type==='ALIGN_POINTS'){
    const a=points[normalizeIndex(relation.pointA,points.length)],b=points[normalizeIndex(relation.pointB,points.length)];if(!a||!b)return null;position=a.clone().add(b).multiplyScalar(.5);
  }else{
    const ai=normalizeIndex(relation.edgeA,points.length),bi=normalizeIndex(relation.edgeB,points.length);
    const a=points[ai]?.clone().add(points[(ai+1)%points.length]).multiplyScalar(.5);const b=points[bi]?.clone().add(points[(bi+1)%points.length]).multiplyScalar(.5);if(!a||!b)return null;position=a.add(b).multiplyScalar(.5);
  }
  return position.add(planeNormal(plane).multiplyScalar(5));
}
function constraintLabel(item){
  if(item?.type==='EQUAL_LENGTH')return `边 ${Number(item.edgeA)+1} 与边 ${Number(item.edgeB)+1} 等长`;
  if(item?.type==='PARALLEL')return `边 ${Number(item.edgeA)+1} 与边 ${Number(item.edgeB)+1} 平行`;
  if(item?.type==='ALIGN_POINTS')return `点 ${Number(item.pointA)+1} 与点 ${Number(item.pointB)+1} ${item.mode==='VERTICAL'?'纵向':'横向'}对齐`;
  return '轮廓关系';
}

function createEdgeHitMesh(a,b,index){
  const start=toVector3(a),end=toVector3(b),direction=end.clone().sub(start),length=Math.max(1,direction.length());
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(9,9,length,8,1,true),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,depthTest:false}));
  mesh.position.copy(start).add(end).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
  mesh.renderOrder=1598;mesh.userData.contourEdgeIndex=index;return mesh;
}
function createDimensionSprite(a,b,index,plane){
  const start=toVector3(a),end=toVector3(b),mid=start.clone().add(end).multiplyScalar(.5),length=round(start.distanceTo(end));
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=96;const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='rgba(255,255,255,.96)';roundRect(ctx,4,8,312,76,16);ctx.fill();ctx.strokeStyle='#6f9bd7';ctx.lineWidth=3;ctx.stroke();
  ctx.fillStyle='#275a8e';ctx.font='700 30px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(`${length} mm`,160,47);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));
  const offset=dimensionOffset(start,end,plane);sprite.position.copy(mid).add(offset);sprite.scale.set(86,26,1);sprite.renderOrder=1603;sprite.userData.contourDimensionIndex=index;return sprite;
}
function dimensionOffset(a,b,plane){
  const delta=b.clone().sub(a).normalize();let perpendicular;
  if(plane==='XY')perpendicular=new THREE.Vector3(-delta.y,delta.x,0);else if(plane==='YZ')perpendicular=new THREE.Vector3(0,-delta.z,delta.y);else perpendicular=new THREE.Vector3(-delta.z,0,delta.x);
  return perpendicular.multiplyScalar(22);
}
function roundRect(ctx,x,y,w,h,r){const radius=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+radius,y);ctx.arcTo(x+w,y,x+w,y+h,radius);ctx.arcTo(x+w,y+h,x,y+h,radius);ctx.arcTo(x,y+h,x,y,radius);ctx.arcTo(x,y,x+w,y,radius);ctx.closePath();}
function closestPointOnSegment(point,a,b){const ab=b.clone().sub(a);const denominator=ab.lengthSq();if(denominator<1e-8)return a.clone();const t=Math.max(0,Math.min(1,point.clone().sub(a).dot(ab)/denominator));return a.clone().add(ab.multiplyScalar(t));}
function isOrthogonalContour(points,plane){const axes=planeAxes(plane);return points.every((point,index)=>{const next=points[(index+1)%points.length],delta=toVector3(next).sub(toVector3(point));return Math.abs(delta[axes[0]])<1e-6||Math.abs(delta[axes[1]])<1e-6;});}

function edgeRows(points){
  return points.map((point,index)=>({index,label:`边 ${index+1}`,lengthMm:round(toVector3(point).distanceTo(toVector3(points[(index+1)%points.length])))}));
}
function planeAxes(plane){return plane==='XY'?['x','y']:plane==='YZ'?['y','z']:['x','z'];}
function planeNormal(plane){if(plane==='XY')return new THREE.Vector3(0,0,1);if(plane==='YZ')return new THREE.Vector3(1,0,0);return new THREE.Vector3(0,1,0);}
function toVector3(value){return value?.isVector3?value.clone():new THREE.Vector3(Number(value?.x||0),Number(value?.y||0),Number(value?.z||0));}
function clonePoint(value){const point=toVector3(value);return{x:round(point.x),y:round(point.y),z:round(point.z)};}
function round(value){return Number(Number(value).toFixed(2));}
function project2d(point,plane){const p=toVector3(point);if(plane==='XY')return{x:p.x,y:p.y};if(plane==='YZ')return{x:p.y,y:p.z};return{x:p.x,y:p.z};}
function validateContour(points,plane){
  if(points.length<3)throw new Error('轮廓至少需要 3 个点');
  const projected=points.map(point=>project2d(point,plane));
  for(let i=0;i<projected.length;i++){
    const a=projected[i],b=projected[(i+1)%projected.length];
    if(Math.hypot(a.x-b.x,a.y-b.y)<10)throw new Error(`第 ${i+1} 条边过短，请保持至少 10 mm`);
  }
  for(let i=0;i<projected.length;i++)for(let j=i+1;j<projected.length;j++){
    if(j===i||j===(i+1)%projected.length||(i===0&&j===projected.length-1))continue;
    if(intersects(projected[i],projected[(i+1)%projected.length],projected[j],projected[(j+1)%projected.length]))throw new Error('轮廓修改后发生自相交，请调整点位或边长');
  }
}
function intersects(a,b,c,d){
  const orient=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b),eps=1e-8;
  return ((o1>eps&&o2<-eps)||(o1<-eps&&o2>eps))&&((o3>eps&&o4<-eps)||(o3<-eps&&o4>eps));
}


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
    let trim=0;
    if(Math.abs(currentDirection.dot(nextDirection))<0.25)trim=profileCrossHalfExtent(section,nextDirection,currentDirection,plane);
    trim=Math.min(Math.max(0,trim),Math.max(0,currentLength-1));
    result.push({start,end:logicalEnd.clone().addScaledVector(currentDirection,-trim)});
  }
  return result;
}
function profileCrossHalfExtent(section,profileDirection,probeDirection,plane){
  const quaternion=profileQuaternion(profileDirection,workPlaneNormal(plane));
  const xAxis=new THREE.Vector3(1,0,0).applyQuaternion(quaternion).normalize();
  const yAxis=new THREE.Vector3(0,1,0).applyQuaternion(quaternion).normalize();
  return Math.abs(probeDirection.dot(xAxis))*Number(section[0]||30)/2+Math.abs(probeDirection.dot(yAxis))*Number(section[1]||30)/2;
}

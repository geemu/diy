import * as THREE from 'three';
import {isLinearProfile,getLocalEndpoints} from '../model/ProfilePath.js';
import {describeDistanceProfile,nearestProfileDistances,distanceRelationPoints,axisVector} from '../model/ProfileNeighbourDistances.js';

/** 单选就地编辑：临时长度/邻距及其对应线，输入草稿不进入 Project、永久尺寸或拾取。 */
export default class SelectedProfileDistanceManager {
  constructor(editor){
    this.editor=editor;this.sceneManager=editor.sceneManager;this.fields=[];this.fixedEnd='START';
    this.needsRefresh=true;this.lastSourceId=null;this.lastFocusKey=null;this.committing=false;
    this.group=new THREE.Group();this.group.name='__selected_profile_distances__';this.sceneManager.scene.add(this.group);
    this.layer=document.createElement('div');this.layer.className='selected-profile-distance-layer';this.layer.hidden=true;
    this.layer.setAttribute('aria-label','所选型材长度和周边净距');this.sceneManager.container.append(this.layer);
    this.ray=new THREE.Raycaster();this.removeFrameHandler=this.sceneManager.addFrameHandler(()=>this.render());
    this.canvas=this.sceneManager.renderer.domElement;this.originalTabIndex=this.canvas.getAttribute('tabindex');
    if(this.originalTabIndex==null)this.canvas.tabIndex=0;
  }

  source(){
    const e=this.editor,m=e.selected,p=m?.userData?.part;
    if(p?.type!=='PROFILE'||!isLinearProfile(p)||e.selectedMeshes.length!==1||e.selectedConnectionId||p.hidden||!visible(m))return null;
    if(e.isBuilderReviewActive()||e.transformSelectionSnapshot||e.sceneManager.transformControls.dragging||e.profileGripEditor.drag
      ||e.profileDrawTool.isActive()||e.profilePlacementManager.isActive()||e.connectionPlacementManager.isActive()
      ||e.accessoryPlacementManager.isActive()||e.machiningPlacementManager.isActive()||e.wholeStretchManager.isActive()
      ||e.measureMode||e.dimensionMode||e.featureSelectionManager.enabled||e.sceneManager.marqueeMode||e.sceneManager.lassoMode
      ||e.contourFrameManager?.active||e.assemblyPlaybackManager.active||e.assemblyPresentationManager.isExploded())return null;
    if(document.querySelector('.modal-backdrop,.engineering-center-backdrop'))return null;
    const scale=m.getWorldScale(new THREE.Vector3());
    if(scale.toArray().some(v=>Math.abs(v-1)>1e-7))return null;
    return m;
  }

  setFixedEnd(end){
    const next=end==='END'?'END':'START';
    if(this.fixedEnd!==next){this.fixedEnd=next;this.requestRefresh();}
  }
  requestRefresh(){this.needsRefresh=true;this.viewKey=null;}

  rebuild(source){
    this.clearFields();this.lastSourceId=source.userData.part.id;
    const part=source.userData.part,length=Number(part.profilePath?.length??part.dimensions?.length);
    if(!Number.isFinite(length)||length<=0){this.needsRefresh=false;return;}
    this.sourceProfile=describeDistanceProfile(source);
    const movingEnd=this.fixedEnd==='START'?'END':'START',transformable=this.editor.isMeshTransformable(source);
    this.makeField({key:'LENGTH:'+part.id,type:'LENGTH',value:length,movingEnd,
      readonly:!transformable||this.editor.profileGripEditor.isEndDrivenByConstraint(part.id,movingEnd)});
    for(const relation of nearestProfileDistances(source,this.editor.meshes)){
      const target=relation.target.part;
      this.makeField({key:part.id+':'+relation.axis+relation.sign+':'+target.id,type:'GAP',value:relation.distanceMm,
        axis:relation.axis,sign:relation.sign,targetId:target.id,targetLabel:target.displayId||target.name||'型材',relation,readonly:!transformable});
    }
    this.occluders=this.materialMeshes();this.needsRefresh=false;this.viewKey=null;
  }

  makeField(data){
    const element=document.createElement('div');element.className='selected-profile-distance-field';element.hidden=true;
    const control=document.createElement('div');control.className='selected-profile-distance-control';
    const caption=document.createElement('span');caption.className='selected-profile-distance-caption';caption.textContent=data.type==='LENGTH'?'长度':'净距';
    const input=document.createElement('input');input.type='text';input.inputMode='decimal';input.autocomplete='off';input.spellcheck=false;
    input.value=displayMm(data.value);input.readOnly=data.readonly;
    const title=data.type==='LENGTH'?`长度 · 固定${this.fixedEnd==='START'?'A':'B'}端，改变${data.movingEnd==='START'?'A':'B'}端`
      :`${data.sign>0?'+':'−'}${data.axis} 至 ${data.targetLabel} · 截面外表面净距`;
    input.setAttribute('aria-label',title);element.title=title+'；Tab/Shift+Tab 换输入，Enter 提交目标值，Esc 取消未提交输入'+(data.readonly?'；当前不可编辑':'');
    const unit=document.createElement('span');unit.textContent='mm';
    control.append(caption,input,unit);
    const error=document.createElement('div');error.className='selected-profile-distance-error';error.hidden=true;error.setAttribute('role','alert');
    element.append(control,error);this.layer.append(element);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(72),3).setUsage(THREE.DynamicDrawUsage));
    const material=new THREE.LineBasicMaterial({color:0x496b8a,transparent:true,opacity:.86,depthTest:true,depthWrite:false,toneMapped:false});
    const line=new THREE.LineSegments(geometry,material);line.frustumCulled=false;line.renderOrder=1710;line.raycast=()=>{};line.visible=false;
    this.group.add(line);
    const field={data,element,input,error,line,dirty:false,visible:false};this.fields.push(field);
    element.addEventListener('pointerdown',event=>event.stopPropagation());
    element.addEventListener('click',event=>event.stopPropagation());
    element.addEventListener('dblclick',event=>event.stopPropagation());
    input.addEventListener('focus',()=>{this.lastFocusKey=data.key;input.select();this.viewKey=null;});
    input.addEventListener('blur',()=>{this.viewKey=null;});
    input.addEventListener('input',()=>{field.dirty=true;element.classList.add('draft');input.removeAttribute('aria-invalid');error.hidden=true;this.viewKey=null;});
    input.addEventListener('keydown',event=>{
      // 输入框保留文字复制/粘贴和方向键，不能传到构件剪贴板或移动快捷键。
      event.stopPropagation();
      if(event.key==='Tab'&&!event.ctrlKey&&!event.metaKey&&!event.altKey){if(this.cycle(event.shiftKey?-1:1,data.key))event.preventDefault();}
      else if(event.key==='Enter'){event.preventDefault();if(!event.repeat)this.apply(field);}
      else if(event.key==='Escape'){
        event.preventDefault();field.dirty=false;element.classList.remove('draft');input.value=displayMm(data.value);input.removeAttribute('aria-invalid');error.hidden=true;
        input.blur();this.canvas.focus({preventScroll:true});this.viewKey=null;
      }
    });
  }

  apply(field){
    const key=field.data.key;let failure=null;
    try{
      if(!this.source()||!this.fields.includes(field)||this.needsRefresh||!field.visible||field.element.hidden)throw new Error('型材、参照或显示已改变，请重新选择输入框');
      if(field.data.readonly)throw new Error('当前端点、锁定或安装状态不允许修改');
      if(!field.dirty){field.input.select();return;}
      const text=field.input.value.trim(),value=Number(text);
      if(!text||!Number.isFinite(value))throw new Error('请输入有效的毫米数');
      if(field.data.type==='GAP'){
        if(value<0)throw new Error('目标净距不能为负数');
        const current=nearestProfileDistances(this.editor.selected,this.editor.meshes).find(r=>r.axis===field.data.axis&&r.sign===field.data.sign);
        if(!current||current.target.part.id!==field.data.targetId||Math.abs(current.signedGap-field.data.relation.signedGap)>1e-6)throw new Error('该方向的最近参照已改变，请重新输入');
      }
      this.committing=true;
      if(field.data.type==='LENGTH')this.editor.setSelectedProfileLengthFromDistanceInput(this.fixedEnd,value);
      else this.editor.setSelectedNeighbourDistance(field.data.targetId,field.data.axis,field.data.sign,value);
    }catch(error){failure=error;}
    finally{
      const didCommit=this.committing;this.committing=false;
      if(didCommit){this.requestRefresh();this.render();}
    }
    const current=this.fields.find(f=>f.data.key===key)||field;
    if(failure){
      current.input.setAttribute('aria-invalid','true');current.error.textContent=failure.message;current.error.hidden=false;this.viewKey=null;
      this.editor.onInteractionError?.(failure.message);
    }else{
      for(const f of this.fields){f.dirty=false;f.element.classList.remove('draft');f.input.value=displayMm(f.data.value);}
      current.input.removeAttribute('aria-invalid');
    }
    if(current.visible){current.input.focus({preventScroll:true});current.input.select();}
  }

  cycle(step=1,from=this.lastFocusKey){
    this.render();
    const fields=this.fields.filter(f=>f.visible&&!f.data.readonly);
    if(!fields.length)return false;
    const index=fields.findIndex(f=>f.data.key===from),next=index<0?(step>0?0:fields.length-1):(index+step+fields.length)%fields.length;
    fields[next].input.focus({preventScroll:true});fields[next].input.select();return true;
  }
  handleKey(event){
    if(event.key!=='Tab'||event.ctrlKey||event.metaKey||event.altKey||!this.source())return false;
    if(event.target?.closest?.('input,select,textarea,button,a,summary,[contenteditable=true]'))return false;
    return this.cycle(event.shiftKey?-1:1);
  }

  render(){
    const source=this.source();
    if(!source){
      if(this.layer.contains(document.activeElement))document.activeElement.blur();
      this.layer.hidden=true;this.group.visible=false;this.needsRefresh=true;return;
    }
    if(this.lastSourceId!==source.userData.part.id||this.needsRefresh)this.rebuild(source);
    this.layer.hidden=!this.fields.length;this.group.visible=!!this.fields.length;
    const camera=this.sceneManager.camera;camera.updateWorldMatrix(true,false);
    const width=this.sceneManager.container.clientWidth,height=this.sceneManager.container.clientHeight;
    const controls=this.sceneManager.transformControls;
    const hintKey=controls.axisHintElement?.isConnected&&!controls.axisHintElement.hidden
      ?[controls.axisHintButton.dataset.axis,controls.axisHintButton.style.left,controls.axisHintButton.style.top].join(','):'';
    const key=[camera.matrixWorld.elements.join(','),camera.projectionMatrix.elements.join(','),width,height,this.lastFocusKey,document.activeElement===this.canvas,hintKey].join('|');
    if(key===this.viewKey)return;
    this.viewKey=key;
    if(width<80||height<60){
      for(const field of this.fields){field.visible=false;field.element.hidden=true;field.line.visible=false;}
      return;
    }
    const cameraPosition=camera.getWorldPosition(new THREE.Vector3()),body=this.screenBody(source,width,height),used=this.otherLabels();
    for(const field of this.fields){
      field.visible=false;field.line.visible=false;
      const points=field.data.type==='GAP'?distanceRelationPoints(field.data.relation,cameraPosition):this.lengthPoints(source,cameraPosition);
      if(!points){field.element.hidden=true;continue;}
      const {normal}=points;
      if(normal.lengthSq()>0&&normal.dot(cameraPosition.clone().sub(points.start))<=1e-7){field.element.hidden=true;continue;}
      const start=points.start.clone().addScaledVector(normal,.3),end=points.end.clone().addScaledVector(normal,.3);
      const a=this.screenPoint(start,width,height),b=this.screenPoint(end,width,height);
      if(!a||!b){field.element.hidden=true;continue;}
      const excluded=new Set([source.userData.part.id,field.data.targetId].filter(Boolean));
      if(!this.pointVisible(start.clone().add(end).multiplyScalar(.5),excluded)
        ||field.data.type==='GAP'&&(!this.pointVisible(start,excluded)||!this.pointVisible(end,excluded))){field.element.hidden=true;continue;}
      const direction=field.data.type==='GAP'?axisVector(field.data.axis):end.clone().sub(start).normalize();
      const probe=this.screenPoint(start.clone().add(direction),width,height);
      let dx=b.x-a.x,dy=b.y-a.y;
      if(Math.hypot(dx,dy)<1&&probe){dx=probe.x-a.x;dy=probe.y-a.y;}
      const length=Math.hypot(dx,dy);if(length<1e-6){field.element.hidden=true;continue;}
      const dir={x:dx/length,y:dy/length},perp={x:-dir.y,y:dir.x},mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
      field.element.hidden=false;
      const w=field.element.offsetWidth||128,h=field.element.offsetHeight||28;
      let placement=null;
      search: for(const distance of [22,42,64,88,116])for(const side of [-1,1])for(const along of [0,-32,32]){
        const offset={x:perp.x*distance*side+dir.x*along,y:perp.y*distance*side+dir.y*along};
        const box={x:mid.x+offset.x-w/2,y:mid.y+offset.y-h/2,w,h};
        if(box.x<4||box.y<4||box.x+w>width-4||box.y+h>height-4||overlaps(box,body,5)||used.some(r=>overlaps(box,r,5)))continue;
        placement={box,offset};break search;
      }
      if(!placement){field.element.hidden=true;continue;}
      field.element.style.left=placement.box.x+'px';field.element.style.top=placement.box.y+'px';field.visible=true;
      used.push(placement.box);
      const focused=document.activeElement===field.input;
      field.element.classList.toggle('focused',focused);field.line.material.color.set(focused?0x247bd3:0x496b8a);
      const laneA=this.shiftScreen(start,placement.offset,width,height),laneB=this.shiftScreen(end,placement.offset,width,height);
      field.line.visible=this.drawLine(field,start,end,laneA,laneB,width,height);
    }
  }

  lengthPoints(source,cameraPosition){
    const ends=getLocalEndpoints(source.userData.part),start=source.localToWorld(new THREE.Vector3(...ends.start)),end=source.localToWorld(new THREE.Vector3(...ends.end));
    const profile=this.sourceProfile;
    if(!profile)return {start,end,normal:new THREE.Vector3()};
    const plane=[...profile.planes].sort((a,b)=>b.normal.dot(cameraPosition.clone().sub(b.point).normalize())-a.normal.dot(cameraPosition.clone().sub(a.point).normalize()))[0];
    const offset=plane.point.clone().sub(profile.center);start.add(offset);end.add(offset);
    return {start,end,normal:plane.normal.clone()};
  }
  screenPoint(point,width,height){
    const p=point.clone().project(this.sceneManager.camera);
    return [p.x,p.y,p.z].every(Number.isFinite)&&p.z>=-1&&p.z<=1?{x:(p.x+1)*width/2,y:(1-p.y)*height/2}:null;
  }
  shiftScreen(point,offset,width,height){
    const p=point.clone().project(this.sceneManager.camera);p.x+=offset.x*2/width;p.y-=offset.y*2/height;
    return p.unproject(this.sceneManager.camera);
  }
  drawLine(field,start,end,a,b,width,height){
    const pa=this.screenPoint(a,width,height),pb=this.screenPoint(b,width,height);
    if(!pa||!pb)return false;
    const length=Math.hypot(pb.x-pa.x,pb.y-pa.y);
    const dir=length>1?{x:(pb.x-pa.x)/length,y:(pb.y-pa.y)/length}:null,segments=[[start,a],[a,b],[b,end]];
    const arrow=(point,direction,size=5)=>{
      const shift={x:direction.x*size,y:direction.y*size},side={x:-direction.y*size*.55,y:direction.x*size*.55};
      segments.push([point,this.shiftScreen(point,{x:shift.x+side.x,y:shift.y+side.y},width,height)],
        [point,this.shiftScreen(point,{x:shift.x-side.x,y:shift.y-side.y},width,height)]);
    };
    if(dir){const size=Math.min(5,length*.3);arrow(a,dir,size);arrow(b,{x:-dir.x,y:-dir.y},size);}
    else{
      const p=this.screenPoint(start,width,height),to={x:pa.x-p.x,y:pa.y-p.y},span=Math.hypot(to.x,to.y);
      if(span>1)arrow(start,{x:to.x/span,y:to.y/span});
    }
    const values=new Float32Array(72);let index=0;
    for(const segment of segments)for(const point of segment)for(const key of ['x','y','z'])values[index++]=point[key];
    const attribute=field.line.geometry.attributes.position;
    if(values.some((v,i)=>v!==attribute.array[i])){attribute.array.set(values);attribute.needsUpdate=true;}
    field.line.geometry.setDrawRange(0,index/3);return true;
  }

  screenBody(source,width,height){
    const profile=describeDistanceProfile(source);if(!profile)return {x:0,y:0,w:0,h:0};
    const points=[];for(const x of [profile.min.x,profile.max.x])for(const y of [profile.min.y,profile.max.y])for(const z of [profile.min.z,profile.max.z]){
      const p=this.screenPoint(new THREE.Vector3(x,y,z),width,height);if(p)points.push(p);
    }
    if(!points.length)return {x:0,y:0,w:0,h:0};
    const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));
    return {x,y,w:Math.max(...points.map(p=>p.x))-x,h:Math.max(...points.map(p=>p.y))-y};
  }
  otherLabels(){
    const base=this.sceneManager.container.getBoundingClientRect(),rects=[];
    for(const label of this.editor.annotationManager?.labels||[]){
      if(label.element.hidden||label.element.style.display==='none'||label.element.style.visibility==='hidden')continue;
      const r=label.element.getBoundingClientRect();if(r.width&&r.height)rects.push({x:r.left-base.left,y:r.top-base.top,w:r.width,h:r.height});
    }
    const controls=this.sceneManager.transformControls;
    if(controls.axisHintElement?.isConnected&&!controls.axisHintElement.hidden){
      const r=controls.axisHintButton.getBoundingClientRect();rects.push({x:r.left-base.left,y:r.top-base.top,w:r.width,h:r.height});
    }
    return rects;
  }
  materialMeshes(){
    const result=[];
    for(const root of [...this.editor.meshes,...(this.editor.connectionManager.helperMeshes?.values()||[])]){
      if(!visible(root)||root.userData.part?.hidden)continue;
      root.traverse(mesh=>{
        if(!mesh.isMesh||!mesh.geometry?.attributes.position||mesh.userData.surfaceFeedback||!visible(mesh))return;
        for(let p=mesh;p&&p!==root;p=p.parent)if(p.name?.startsWith('__'))return;
        result.push({mesh,partId:root.userData.part?.id});
      });
    }
    return result;
  }
  pointVisible(point,excluded){
    const p=point.clone().project(this.sceneManager.camera);
    this.ray.setFromCamera(new THREE.Vector2(p.x,p.y),this.sceneManager.camera);
    const distance=point.clone().sub(this.ray.ray.origin).dot(this.ray.ray.direction);
    if(distance<=0)return false;
    this.ray.near=0;this.ray.far=Math.max(0,distance-.5);
    return !this.ray.intersectObjects(this.occluders.filter(item=>!excluded.has(item.partId)&&visible(item.mesh)).map(item=>item.mesh),false).length;
  }

  clearFields(){
    for(const field of this.fields){field.line.removeFromParent();field.line.geometry.dispose();field.line.material.dispose();}
    this.fields=[];this.layer.replaceChildren();
  }
  clear(){this.clearFields();this.layer.hidden=true;this.group.visible=false;this.lastSourceId=null;this.lastFocusKey=null;this.requestRefresh();}
  dispose(){
    this.clear();this.removeFrameHandler?.();this.group.removeFromParent();this.layer.remove();
    if(this.originalTabIndex==null&&this.canvas.getAttribute('tabindex')==='0')this.canvas.removeAttribute('tabindex');
  }
}

function displayMm(value){return String(Math.round(value));}
function visible(mesh){for(let node=mesh;node;node=node.parent)if(node.visible===false)return false;return !!mesh;}
function overlaps(a,b,margin=0){return a.x+a.w+margin>b.x&&b.x+b.w+margin>a.x&&a.y+a.h+margin>b.y&&b.y+b.h+margin>a.y;}

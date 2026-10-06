import * as THREE from 'three';
import {profileObb,sweepObbContact} from '../validation/PartCollisionDetector.js';
import {groundClearance} from './GroundClearance.js';

/** 移动方向的只读表面间隙；显示在工作台底栏，贴合继续经过 Editor 的完整事务。 */
export default class AxisClearanceManager{
  constructor(editor){
    this.editor=editor;this.axis=null;this.state=null;this.groundSide=null;this.drafts={};
    this.panel=document.createElement('div');this.panel.className='axis-clearance-panel';this.panel.hidden=true;
    this.panel.setAttribute('role','group');this.panel.setAttribute('aria-label','移动方向距离');
    const row=editor.sceneManager.container.closest('.canvas-shell')?.querySelector('.workbench-tools-row');
    row?.prepend(this.panel);
    this.panel.addEventListener('pointerdown',event=>event.stopPropagation());
    this.panel.addEventListener('click',event=>{
      const action=event.target.closest('button')?.dataset.action;if(!action)return;
      if(action==='close'){this.hide();return;}
      try{action==='distance'?this.applyDistance():this.moveTo(action);}catch(error){this.showError(error);}
    });
    this.panel.addEventListener('keydown',event=>{
      if(!event.target.matches('[data-distance]'))return;
      if(!['Tab','Enter','Escape'].includes(event.key))return;
      event.preventDefault();event.stopPropagation();
      if(event.key==='Tab'){this.drafts[this.axis]=event.target.value;this.focusDistance(event.shiftKey?-1:1);}
      else if(event.key==='Escape'){this.editor.cancelPrecisionMove();this.hide();}
      else{try{this.applyDistance();}catch(error){this.showError(error);}}
    });
    this.onKey=event=>{if(event.key==='Escape'&&!event.defaultPrevented)this.hide();};window.addEventListener('keydown',this.onKey);
  }

  movingMeshes(){
    const e=this.editor;
    if(e.transformSelectionSnapshot)return e.currentTransformMeshes();
    return [...new Set([e.selected,...(e.selectedMeshes.length>1?e.selectedMeshes:e.transformFollowersForScope(e.selected))].filter(Boolean))];
  }

  update(axis=this.axis){
    const e=this.editor,source=e.selected;
    if(!/^[XYZ]$/.test(axis||'')||e.sceneManager.transformControls.mode!=='translate'||!source||!e.isMeshTransformable(source)){this.hide();return;}
    const moving=this.movingMeshes(),set=new Set(moving),profiles=moving.map(mesh=>({mesh,obb:profileObb(mesh.userData.part)})).filter(row=>row.obb);
    const direction=new THREE.Vector3(axis==='X'?1:0,axis==='Y'?1:0,axis==='Z'?1:0);
    if(e.transformSpace==='local')direction.applyQuaternion(source.getWorldQuaternion(new THREE.Quaternion()));
    const targets=e.meshes.filter(mesh=>!set.has(mesh)&&mesh.visible!==false&&!mesh.userData.part?.hidden).map(mesh=>({mesh,obb:profileObb(mesh.userData.part)})).filter(row=>row.obb);
    const candidates=sign=>targets.map(target=>{
      const distances=profiles.map(row=>sweepObbContact(row.obb,target.obb,direction.clone().multiplyScalar(sign))).filter(Boolean);
      if(!distances.length)return null;
      const distance=Math.min(...distances.map(row=>row.distanceMm));
      const delta=direction.clone().multiplyScalar(sign*distance);
      const blocked=e.snapManager.candidateCollision(source,{delta});
      return {id:target.mesh.userData.part.id,label:target.mesh.userData.part.displayId||'型材',distanceMm:distance,blocked:blocked?.message||null};
    }).filter(Boolean).sort((a,b)=>a.distanceMm-b.distanceMm||a.label.localeCompare(b.label)).slice(0,8);
    // 水平地面固定为 Y=0；计算整个移动范围的最低外表面，不是中心 Y。
    const height=groundClearance(moving),groundDelta=Math.abs(direction.y)>1e-6?direction.clone().multiplyScalar(-height/direction.y):null;
    const side=height>0.5?1:height<-0.5?-1:0;
    if(side&&this.groundSide!==null&&side!==this.groundSide)e.onGroundCrossed?.({below:side<0,heightMm:height});
    if(side||this.groundSide===null)this.groundSide=side;
    this.axis=axis;this.state={axis,direction,positive:candidates(1),negative:candidates(-1),heightMm:height,groundDelta,groundBlocked:groundDelta?e.snapManager.candidateCollision(source,{delta:groundDelta})?.message:null};
    const wasHidden=this.panel.hidden;this.render();this.panel.hidden=false;
    if(wasHidden){const scroll=this.panel.closest('.workbench-footer-scroll');if(scroll)scroll.scrollLeft=0;}
    return this.state;
  }

  render(){
    const state=this.state,e=this.editor,busy=!!e.transformSelectionSnapshot;
    const oldInput=this.panel.querySelector('[data-distance]'),focused=oldInput===document.activeElement;
    const selection=focused?[oldInput.selectionStart,oldInput.selectionEnd]:null;
    if(oldInput)this.drafts[oldInput.dataset.axis]=oldInput.value;
    const previous={positive:this.panel.querySelector('[data-direction="positive"]')?.value,negative:this.panel.querySelector('[data-direction="negative"]')?.value};
    this.panel.replaceChildren();
    const title=document.createElement('strong');title.textContent=`${state.axis} 距离`;this.panel.append(title);
    const input=document.createElement('input');input.type='text';input.inputMode='decimal';input.dataset.distance='';input.dataset.axis=state.axis;
    input.setAttribute('aria-label',`${state.axis} 轴移动距离`);input.placeholder='± mm';input.value=this.drafts[state.axis]??'';
    input.title='输入带正负号的移动距离（mm）；拖动时从本次拖动起点计算。Tab 切换 X/Y/Z，Enter 确认，Esc 取消';
    const apply=document.createElement('button');apply.textContent='移动';apply.dataset.action='distance';this.panel.append(input,apply);
    for(const [name,sign] of [['positive','+'],['negative','−']]){
      const select=document.createElement('select');select.dataset.direction=name;select.setAttribute('aria-label',`${sign}${state.axis} 方向目标`);
      if(!state[name].length){select.add(new Option(`${sign}${state.axis} 无相邻型材`,''));select.disabled=true;}
      for(const target of state[name])select.add(new Option(`${sign}${state.axis} ${target.label} · ${round(target.distanceMm)} mm${target.blocked?' · 有干涉':''}`,target.id));
      if(state[name].some(row=>row.id===previous[name]))select.value=previous[name];
      const button=document.createElement('button');button.textContent='贴合';button.dataset.action=name;
      const refresh=()=>{const target=state[name].find(row=>row.id===select.value);button.disabled=busy||!target;button.classList.toggle('has-interference',!!target?.blocked);button.title=target?.blocked?`${target.blocked}；可移动到该位置，保留红色干涉提示`:'仅沿此箭头方向移动到所选型材外表面；不改变截面朝向';};
      select.addEventListener('change',refresh);refresh();this.panel.append(select,button);
    }
    const height=document.createElement('span');height.dataset.ground=state.heightMm<-0.001?'below':Math.abs(state.heightMm)<=0.001?'contact':'above';height.textContent=state.heightMm<-0.001?`底面低于地面 ${round(-state.heightMm)} mm`:Math.abs(state.heightMm)<=0.001?'底面已到地面 · 0 mm':`底面离地 ${round(state.heightMm)} mm`;this.panel.append(height);
    const ground=document.createElement('button');ground.textContent='落地';ground.dataset.action='ground';ground.disabled=busy||!state.groundDelta;
    ground.title=state.groundBlocked||(!state.groundDelta?'当前方向平行地面，选择竖直方向箭头后才能落地':'沿当前方向使最低外表面落到 Y=0');this.panel.append(ground);
    const close=document.createElement('button');close.textContent='×';close.dataset.action='close';close.setAttribute('aria-label','关闭移动距离');this.panel.append(close);
    if(focused){input.focus({preventScroll:true});if(selection?.every(Number.isInteger))input.setSelectionRange(...selection);}
  }

  showError(error){this.editor.sceneManager.showSnapFeedback({status:'blocked',label:'无法移动',details:[error.message]});}

  focusDistance(cycle=0){
    const axes=['X','Y','Z'],axis=axes[(axes.indexOf(this.axis||this.editor.sceneManager.transformControls.axis||'X')+cycle+3)%3];
    if(!this.update(axis))return false;
    const input=this.panel.querySelector('[data-distance]');input.focus({preventScroll:true});input.select();return true;
  }

  applyDistance(){
    const text=this.panel.querySelector('[data-distance]')?.value.trim(),distance=Number(text);
    if(!text||!Number.isFinite(distance))throw new Error('请输入有效的移动距离，负数表示反方向');
    this.editor.moveSelectionByDistance(this.axis,distance);
    this.drafts={};const input=this.panel.querySelector('[data-distance]');if(input){input.value='';input.blur();}this.update();
  }

  /** 方向键按可见画布方向选择操作轴；不把观察方向当作模型坐标或旋转中心。 */
  handleKey(event){
    const e=this.editor,controls=e.sceneManager.transformControls;
    if(event.ctrlKey||event.metaKey||event.altKey||controls.mode!=='translate'||!e.isMeshTransformable(e.selected))return false;
    if(event.key==='Tab')return this.focusDistance();
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','PageUp','PageDown'].includes(event.key)||e.transformSelectionSnapshot)return false;
    const camera=e.sceneManager.camera,q=camera.getWorldQuaternion(new THREE.Quaternion());
    const right=new THREE.Vector3(1,0,0).applyQuaternion(q),up=new THREE.Vector3(0,1,0).applyQuaternion(q),towards=new THREE.Vector3(0,0,1).applyQuaternion(q);
    const axes=['X','Y','Z'].map((axis,index)=>{const vector=new THREE.Vector3().setComponent(index,1);if(e.transformSpace==='local')vector.applyQuaternion(e.selected.getWorldQuaternion(new THREE.Quaternion()));return {axis,vector};});
    const horizontal=[...axes].sort((a,b)=>Math.abs(b.vector.dot(right))-Math.abs(a.vector.dot(right)))[0];
    const vertical=axes.filter(row=>row!==horizontal).sort((a,b)=>Math.abs(b.vector.dot(up))-Math.abs(a.vector.dot(up)))[0];
    const depth=axes.find(row=>row!==horizontal&&row!==vertical);
    const row=event.key.startsWith('Page')?depth:['ArrowLeft','ArrowRight'].includes(event.key)?horizontal:vertical;
    const screenDirection=event.key.startsWith('Page')?towards:row===horizontal?right:up;
    const sign=(row.vector.dot(screenDirection)>=0?1:-1)*(['ArrowLeft','ArrowDown','PageDown'].includes(event.key)?-1:1);
    const step=(e.movementStepMm>0?e.movementStepMm:1)*(event.shiftKey?10:1);
    try{e.moveSelectionByDistance(row.axis,sign*step);this.update(row.axis);}catch(error){this.showError(error);}
    return true;
  }

  moveTo(action){
    if(!this.state||this.editor.transformSelectionSnapshot)return;
    const targetId=this.panel.querySelector(`[data-direction="${action}"]`)?.value;
    this.update();const state=this.state;
    const target=state[action]?.find(row=>row.id===targetId);
    const delta=action==='ground'?state.groundDelta:target?state.direction.clone().multiplyScalar((action==='positive'?1:-1)*target.distanceMm):null;
    if(!delta)throw new Error('没有可用的方向目标');
    this.editor.moveSelectionToSurface(delta,target?.id||null);
    this.update();
  }

  hide(){this.axis=null;this.state=null;this.groundSide=null;this.drafts={};this.panel.hidden=true;}
}

function round(value){return Number(Number(value).toFixed(2));}

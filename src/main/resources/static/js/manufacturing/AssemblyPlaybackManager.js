/**
 * 装配步骤播放器。
 *
 * 只修改场景展示状态，不修改零件真实 transform，也不写回业务工程。
 * 每一步会隐藏后续构件，将当前步骤从爆炸位置动画回真实安装位置。
 */
export default class AssemblyPlaybackManager {
  constructor(editor){
    this.editor=editor;
    this.steps=[];
    this.currentIndex=-1;
    this.playing=false;
    this.active=false;
    this.distanceMm=140;
    this.animationMs=650;
    this.holdMs=850;
    this.cameraTransitionMs=420;
    this.visibilitySnapshot=new Map();
    this.timer=null;
    this.raf=null;
    this.runToken=0;
    this.onChanged=null;
  }

  state(extra={}){
    const step=this.currentIndex>=0?this.steps[this.currentIndex]||null:null;
    return {
      active:this.active,
      playing:this.playing,
      currentIndex:this.currentIndex,
      currentStepId:step?.id||null,
      currentStepNumber:step?.step||0,
      currentTitle:step?.title||'',
      total:this.steps.length,
      cameraTransitionMs:this.cameraTransitionMs,
      ...extra
    };
  }

  emit(extra={}){this.onChanged?.(this.state(extra));}

  load(steps=[]){
    this.pause();
    this.stop(false);
    this.steps=Array.isArray(steps)?steps.filter(step=>Array.isArray(step?.partIds)&&step.partIds.length):[];
    this.currentIndex=this.steps.length?0:-1;
    this.emit();
    return this.steps;
  }

  start(steps=this.steps,options={}){
    if(Array.isArray(steps)&&steps!==this.steps)this.load(steps);
    if(!this.steps.length)throw new Error('当前没有可播放的装配步骤');
    this.distanceMm=Math.max(20,Number(options.distanceMm||this.distanceMm||140));
    this.animationMs=Math.max(100,Number(options.animationMs||this.animationMs||650));
    this.holdMs=Math.max(150,Number(options.holdMs||this.holdMs||850));
    this.cameraTransitionMs=Math.max(120,Number(options.cameraTransitionMs||this.cameraTransitionMs||420));
    if(!this.active)this.captureVisibility();
    this.active=true;
    this.playing=true;
    if(this.currentIndex<0||this.currentIndex>=this.steps.length)this.currentIndex=0;
    const token=++this.runToken;
    this.playCurrent(token,true);
    return this.state();
  }

  pause(){
    this.playing=false;
    this.runToken++;
    if(this.timer){clearTimeout(this.timer);this.timer=null;}
    this.emit();
  }

  stop(emit=true){
    this.playing=false;
    this.runToken++;
    if(this.timer){clearTimeout(this.timer);this.timer=null;}
    if(this.raf){cancelAnimationFrame(this.raf);this.raf=null;}
    this.editor.assemblyPresentationManager?.collapse();
    this.restoreVisibility();
    this.active=false;
    this.currentIndex=-1;
    if(emit)this.emit();
  }

  previous(){
    if(!this.steps.length)return null;
    this.pause();
    if(!this.active)this.captureVisibility();
    this.active=true;
    this.currentIndex=Math.max(0,(this.currentIndex<0?0:this.currentIndex)-1);
    this.playCurrent(++this.runToken,true,false);
    return this.state();
  }

  next(){
    if(!this.steps.length)return null;
    this.pause();
    if(!this.active)this.captureVisibility();
    this.active=true;
    this.currentIndex=Math.min(this.steps.length-1,(this.currentIndex<0?-1:this.currentIndex)+1);
    this.playCurrent(++this.runToken,true,false);
    return this.state();
  }

  show(index,{animate=true}={}){
    if(!this.steps.length)return null;
    this.pause();
    if(!this.active)this.captureVisibility();
    this.active=true;
    this.currentIndex=Math.max(0,Math.min(Number(index)||0,this.steps.length-1));
    this.playCurrent(++this.runToken,animate,false);
    return this.state();
  }

  captureVisibility(){
    this.visibilitySnapshot.clear();
    for(const mesh of this.editor.meshes||[])this.visibilitySnapshot.set(mesh,mesh.visible!==false);
  }

  restoreVisibility(){
    if(!this.visibilitySnapshot.size)return;
    for(const [mesh,visible] of this.visibilitySnapshot.entries()){
      if(!mesh?.parent)continue;
      mesh.visible=mesh.userData?.part?.hidden===true?false:visible;
    }
    this.visibilitySnapshot.clear();
  }

  stepVisualIds(step){
    return new Set([...(step?.partIds||[]),...(step?.hardware||[]).map(item=>item.id).filter(Boolean)]);
  }

  allStepPartIndex(){
    const map=new Map();
    this.steps.forEach((step,index)=>{
      for(const id of this.stepVisualIds(step))if(!map.has(id))map.set(id,index);
    });
    return map;
  }

  applyStageVisibility(index){
    const byPart=this.allStepPartIndex();
    for(const mesh of this.editor.meshes||[]){
      const id=mesh.userData?.part?.id;
      if(!id||!byPart.has(id))continue;
      const stepIndex=byPart.get(id);
      const base=this.visibilitySnapshot.get(mesh)!==false&&mesh.userData?.part?.hidden!==true;
      mesh.visible=base&&stepIndex<=index;
    }
  }

  playCurrent(token,animate=true,autoAdvance=true){
    if(!this.steps.length||this.currentIndex<0)return;
    if(this.raf){cancelAnimationFrame(this.raf);this.raf=null;}
    this.editor.assemblyPresentationManager?.collapse();
    this.applyStageVisibility(this.currentIndex);
    const step=this.steps[this.currentIndex];
    const visualIds=[...this.stepVisualIds(step)];
    const focusIds=step.partIds||visualIds;
    if(focusIds.length)this.editor.focusPartIds(focusIds,{durationMs:this.cameraTransitionMs,distanceScale:2.0});
    this.emit({step});
    if(!animate||!visualIds.length){
      if(autoAdvance&&this.playing)this.scheduleNext(token,0);
      return;
    }
    let result;
    try{result=this.editor.assemblyPresentationManager.explodePartIds(visualIds,this.distanceMm);}catch{
      if(autoAdvance&&this.playing)this.scheduleNext(token,0);
      return;
    }
    if(!result?.cloneCount){
      if(autoAdvance&&this.playing)this.scheduleNext(token,0);
      return;
    }
    const clones=[...(this.editor.assemblyPresentationManager.group?.children||[])];
    const starts=new Map(clones.map(clone=>[clone,clone.position.clone()]));
    const targets=new Map();
    for(const clone of clones){
      const source=this.editor.getMeshByPartId(clone.userData?.sourcePartId);
      if(source)targets.set(clone,source.position.clone());
    }
    const started=performance.now();
    const tick=now=>{
      if(token!==this.runToken){this.raf=null;return;}
      const t=Math.min(1,(now-started)/this.animationMs);
      const eased=1-Math.pow(1-t,3);
      for(const clone of clones){
        const a=starts.get(clone),b=targets.get(clone);
        if(a&&b)clone.position.lerpVectors(a,b,eased);
      }
      this.editor.sceneManager.render?.();
      if(t<1){this.raf=requestAnimationFrame(tick);return;}
      this.raf=null;
      this.editor.assemblyPresentationManager.collapse();
      this.applyStageVisibility(this.currentIndex);
      this.emit({step,assembled:true});
      if(autoAdvance&&this.playing)this.scheduleNext(token,this.holdMs);
    };
    this.raf=requestAnimationFrame(tick);
  }

  scheduleNext(token,delay){
    if(token!==this.runToken||!this.playing)return;
    if(this.timer)clearTimeout(this.timer);
    this.timer=setTimeout(()=>{
      this.timer=null;
      if(token!==this.runToken||!this.playing)return;
      if(this.currentIndex>=this.steps.length-1){
        this.playing=false;
        this.emit({finished:true});
        return;
      }
      this.currentIndex++;
      this.playCurrent(token,true,true);
    },Math.max(0,Number(delay||0)));
  }
}

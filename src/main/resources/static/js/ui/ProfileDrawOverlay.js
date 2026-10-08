/** 就地长度输入只控制绘制工具；未确认的输入和相机投影不会写入工程。 */
export default class ProfileDrawOverlay {
  constructor(tool) {
    this.tool=tool;
    this.sceneManager=tool.editor.sceneManager;
    this.anchor=null;
    this.element=document.createElement('div');
    this.element.className='profile-length-input';
    this.element.hidden=true;
    this.input=document.createElement('input');
    this.input.type='text';this.input.inputMode='decimal';
    this.input.placeholder='输入长度';
    this.input.setAttribute('aria-label','绘制型材长度');
    this.input.setAttribute('autocomplete','off');
    const unit=document.createElement('span');unit.textContent='mm';
    this.confirm=document.createElement('button');this.confirm.type='button';this.confirm.textContent='确定';
    this.confirm.setAttribute('aria-label','确认型材长度');
    this.confirm.addEventListener('click',event=>{event.stopPropagation();if(!tool.commitLength(this.input.value))this.input.setAttribute('aria-invalid','true');});
    this.element.append(this.input,unit,this.confirm);
    this.sceneManager.container.appendChild(this.element);
    this.input.addEventListener('focus',()=>this.input.select());
    this.input.addEventListener('input',()=>{
      tool.updateLengthDraft(this.input.value);
      const value=Number(this.input.value);
      if(this.input.value&&(!Number.isFinite(value)||value<1||value>50000))this.input.setAttribute('aria-invalid','true');
      else this.input.removeAttribute('aria-invalid');
    });
    this.input.addEventListener('keydown',event=>{
      event.stopPropagation();
      if(event.key==='Tab'&&tool.mode==='FREE'){
        event.preventDefault();tool.handleKeyDown(event);
      }else if(event.key==='Enter') {
        event.preventDefault();
        if(!tool.commitLength(this.input.value))this.input.setAttribute('aria-invalid','true');
      }else if(event.key==='Escape') {
        event.preventDefault();tool.stop();
      }
    });
    this.removeFrameHandler=this.sceneManager.addFrameHandler(()=>this.position());
  }

  beginAt(point){this.update(point,point,0);this.input.value='';this.input.focus();}

  update(start,end,length,typed='') {
    this.anchor=start.clone().add(end).multiplyScalar(.5);
    this.element.hidden=false;
    if(document.activeElement!==this.input)this.input.value=typed||String(Number(length.toFixed(1)));
    this.input.removeAttribute('aria-invalid');
    this.position();
  }

  position() {
    if(!this.anchor||this.element.hidden)return;
    const p=this.anchor.clone().project(this.sceneManager.camera);
    const width=this.sceneManager.container.clientWidth,height=this.sceneManager.container.clientHeight;
    this.element.style.visibility=p.z<-1||p.z>1?'hidden':'';
    this.element.style.left=`${Math.max(4,Math.min(width-this.element.offsetWidth-4,(p.x+1)*width/2+14))}px`;
    this.element.style.top=`${Math.max(4,Math.min(height-32,(1-p.y)*height/2-34))}px`;
  }

  hide() {this.anchor=null;this.input.blur();this.element.hidden=true;}
  dispose() {this.removeFrameHandler?.();this.element.remove();}
}

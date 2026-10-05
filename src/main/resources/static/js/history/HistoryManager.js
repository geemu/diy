export default class HistoryManager {
  constructor(editor,limit=50){this.editor=editor;this.limit=limit;this.states=[];this.index=-1;this.restoring=false;}
  reset(){this.states=[];this.index=-1;this.capture();}
  capture(){if(this.restoring)return;const s=JSON.stringify(this.editor.exportProject());if(this.index>=0&&this.states[this.index]===s)return;if(this.index<this.states.length-1)this.states=this.states.slice(0,this.index+1);this.states.push(s);if(this.states.length>this.limit)this.states.shift();this.index=this.states.length-1;}
  undo(){if(this.index<=0)return;this.index--;this.restore();}
  redo(){if(this.index>=this.states.length-1)return;this.index++;this.restore();}
  restore(){this.restoring=true;try{this.editor.restoreProject(JSON.parse(this.states[this.index]));}finally{this.restoring=false;}}
}

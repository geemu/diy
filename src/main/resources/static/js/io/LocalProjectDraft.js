import ProjectSchema from './ProjectSchema.js';

export const LOCAL_PROJECT_DRAFT_KEY='alu-cad-autosave';
const TIME_KEY='alu-cad-autosave-time';

/** 当前浏览器的一份续作草稿，保存标准 Project，而不是 Three.js 场景/临时预览。 */
export default class LocalProjectDraft{
  constructor(storageProvider=()=>globalThis.localStorage){this.storageProvider=storageProvider;this.pending=null;}
  raw(){return this.storageProvider().getItem(LOCAL_PROJECT_DRAFT_KEY);}
  read(){const text=this.raw();return text?ProjectSchema.load(JSON.parse(text)).project:null;}
  savedAt(){return Number(this.storageProvider().getItem(TIME_KEY))||null;}
  capture(project){this.pending=JSON.stringify(project);return this.flush();}
  /** 离开页面只重试最后已提交的快照，不读取可能还在拖动/拉伸的临时 Mesh。 */
  flush(){
    if(this.pending===null)return null;
    const storage=this.storageProvider();
    storage.setItem(LOCAL_PROJECT_DRAFT_KEY,this.pending);
    this.pending=null;
    const savedAt=Date.now();
    // 时间标签不是工程数据，空间不足时也不能把已成功保存的工程误报为失败。
    try{storage.setItem(TIME_KEY,String(savedAt));}catch(_){}
    return savedAt;
  }
  clear(){
    const storage=this.storageProvider();storage.removeItem(LOCAL_PROJECT_DRAFT_KEY);
    this.pending=null;try{storage.removeItem(TIME_KEY);}catch(_){}
  }
}

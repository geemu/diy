export const MaterialListUnits = Object.freeze(['个','套','支','管','包','米','盒','张','片']);
const systems = new Set(['欧标','国标']);

/** 清单补充数据不是三维Part、制造规格或库存；汇总仍实时读取领域模型。 */
export function normalizeMaterialList(value) {
  if(value==null)return {profileSystems:{},virtualItems:[]};
  if(typeof value!=='object'||Array.isArray(value))throw new Error('材料清单补充数据无效');
  if(value.profileSystems!=null&&(typeof value.profileSystems!=='object'||Array.isArray(value.profileSystems)||Object.keys(value.profileSystems).length>500))throw new Error('材料清单规格选配无效，最多500个型号');
  const profileSystems={};
  for(const [id,system] of Object.entries(value.profileSystems||{})){
    if(!id||id.length>160||!systems.has(system)||['__proto__','constructor','prototype'].includes(id))throw new Error('材料清单的型材规格选配无效');
    profileSystems[id]=system;
  }
  const input=value.virtualItems??[];
  if(!Array.isArray(input)||input.length>200)throw new Error('虚拟构件最多200项');
  const virtualItems=input.map(normalizeItem);
  if(new Set(virtualItems.map(item=>item.id)).size!==virtualItems.length)throw new Error('虚拟构件编号重复');
  return {profileSystems,virtualItems};
}

function text(value,limit,label) {
  const result=String(value??'').trim();
  if(result.length>limit)throw new Error(`${label}过长，最多${limit}字`);
  return result;
}

function normalizeItem(value) {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('虚拟构件数据无效');
  const name=text(value.name,80,'名称'),id=text(value.id,100,'编号');
  if(!name||!id)throw new Error('虚拟构件需要名称和编号');
  const quantity=Number(value.quantity);
  if(!Number.isFinite(quantity)||quantity<=0||quantity>1000000||!MaterialListUnits.includes(value.unit))throw new Error('请输入大于0的有效数量和单位');
  if(value.unit!=='米'&&!Number.isInteger(quantity))throw new Error('除米以外的数量应为整数');
  return {id,name,spec:text(value.spec,100,'规格'),model:text(value.model,100,'长度/型号'),quantity,unit:value.unit,note:text(value.note,500,'备注')};
}

export default class MaterialListManager {
  constructor(editor){this.editor=editor;this.state=normalizeMaterialList(null);}
  load(value){this.state=normalizeMaterialList(value);}
  clear(){this.state=normalizeMaterialList(null);}
  export(){return structuredClone(this.state);}

  setProfileSystem(profileId,system) {
    const parts=this.editor.parts.filter(part=>part.type==='PROFILE'&&part.designProfile?.profileId===profileId);
    if(!parts.length)throw new Error('该型材已不存在，请重新打开清单');
    if(parts.some(part=>part.manufacturingProfile))throw new Error('该型号已配置制造材料，请在制造配置中修改规格');
    if(system!==''&&!systems.has(system))throw new Error('请选择国标、欧标或模型默认');
    const next=this.export();
    if(system)next.profileSystems[profileId]=system;
    else delete next.profileSystems[profileId];
    this.commit(next);
  }

  saveVirtualItem(form) {
    const next=this.export();
    const existing=form.id?next.virtualItems.findIndex(item=>item.id===form.id):-1;
    if(form.id&&existing<0)throw new Error('该虚拟构件已不存在');
    const item=normalizeItem({...form,id:form.id||crypto.randomUUID()});
    if(existing>=0)next.virtualItems[existing]=item;
    else next.virtualItems.push(item);
    this.commit(next);
    return item;
  }

  removeVirtualItem(id) {
    const next=this.export();
    next.virtualItems=next.virtualItems.filter(item=>item.id!==id);
    this.commit(next);
  }

  commit(value) {
    const next=normalizeMaterialList(value),before=this.state;
    if(JSON.stringify(before)===JSON.stringify(next))return false;
    this.state=next;
    try{this.editor.historyManager.capture();}
    catch(error){this.state=before;throw error;}
    this.editor.emitProjectChanged();
    return true;
  }
}

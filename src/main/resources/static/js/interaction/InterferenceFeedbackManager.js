import * as THREE from 'three';
import {profileObb, intersectObb} from '../validation/PartCollisionDetector.js';
import {createSurfaceFeedback,disposeFeedback} from './SurfaceFeedback.js';
import {addCoplanarSurfaceFeedback} from './CoplanarSurfaceFeedback.js';
import {connectorEnvelope} from '../connection/ConnectionPlacementManager.js';

/**
 * 设计阶段实时接触 / 干涉反馈。
 *
 * 红色表示实体穿透；操作中绿色候选，实际贴合后保留黄色接头带。
 * 这样连续搭框时可以直接判断是正确贴面还是已经互相插进去了。
 */
export default class InterferenceFeedbackManager {
  constructor(editor) {
    this.editor = editor;
    this.enabled = true;
    this.group = new THREE.Group();
    this.group.name = '__interference_feedback__';
    this.group.renderOrder = 1600;
    this.editor.sceneManager.scene.add(this.group);
    this.issues = [];
    this.contacts = [];
    this.onChanged = null;
    this.pendingFrame = 0;
  }

  preview(partIds = []) {
    if (!this.enabled) return this.clear();
    const ids = new Set((partIds || []).filter(Boolean));
    if (!ids.size) return this.clear();
    return this.refresh({focusIds:ids,live:true});
  }

  requestRefresh() {
    if (!this.enabled || this.pendingFrame) return;
    this.pendingFrame = requestAnimationFrame(() => {
      this.pendingFrame = 0;
      this.refresh({live:false});
    });
  }

  refresh(options = {}) {
    if (!this.enabled) return this.clear();
    const focusIds = options.focusIds instanceof Set ? options.focusIds : null;
    const live = options.live === true;
    const items = (this.editor.meshes || []).filter(mesh => this.isPhysicalMesh(mesh)).map(mesh => ({
      mesh,
      part:mesh.userData.part,
      box:new THREE.Box3().setFromObject(mesh),
      obb:mesh.userData.part?.type === 'PROFILE' ? profileObb(mesh.userData.part) : null
    }));
    // 连接参考件仍由 ConnectionManager 派生；只加入检查快照，不伪造 Part/BOM/工程字段。
    for(const connection of this.editor.connectionManager.connections || []) {
      const helper=this.editor.connectionManager.helperMeshes?.get(connection.id);
      if(!helper || helper.visible===false || !connection.designComponent || connection.manufacturingRuleId)continue;
      helper.updateWorldMatrix(true,true);
      for(const [index,mesh] of helper.children.entries()) {
        if(mesh.visible===false)continue;
        const id=`@connection:${connection.id}:${index}`;
        items.push({mesh,connectionId:connection.id,ownerIds:[connection.sourceProfileId,connection.targetProfileId],
          part:{id,type:'ACCESSORY',name:`${connection.manufacturingCode||'接头'} 连接件`,generatedByConnectionId:connection.id},
          box:new THREE.Box3().setFromObject(mesh),obb:connectorEnvelope(mesh)});
      }
    }
    const issues = [];
    const contacts = [];
    const nearContacts = [];
    const issuePartIds = new Set();
    const contactPartIds = new Set();

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        const aId = a.part.id;
        const bId = b.part.id;
        if (focusIds && ![aId,bId,...(a.ownerIds||[]),...(b.ownerIds||[])].some(id=>focusIds.has(id))) continue;
        if (this.isIntentionalContact(a.part,b.part)) continue;
        const relation = this.classify(a,b);
        if (relation.kind === 'INTERFERENCE') {
          issuePartIds.add(aId); issuePartIds.add(bId);
          issues.push({
            partIds:[...new Set([...(a.ownerIds||[aId]),...(b.ownerIds||[bId])])],
            connectionIds:[a.connectionId,b.connectionId].filter(Boolean),
            exact:relation.exact,
            penetrationMm:relation.penetrationMm,
            message:relation.exact?`${label(a.part)} 与 ${label(b.part)} 干涉 ${round(relation.penetrationMm)} mm`:`${label(a.part)} 与 ${label(b.part)} 安装空间重叠（包络检查）`
          });
        } else if (relation.kind === 'CONTACT') {
          contactPartIds.add(aId); contactPartIds.add(bId);
          contacts.push({
            partIds:[aId,bId],
            gapMm:relation.gapMm,
            message:`${label(a.part)} 与 ${label(b.part)} 面接触`
          });
        } else if(relation.kind==='NEAR')nearContacts.push({partIds:[aId,bId],gapMm:relation.gapMm,message:`${label(a.part)} 与 ${label(b.part)} 接近，间隙 ${round(relation.gapMm)} mm，尚未贴合`});
      }
    }

    // 红色优先；发生干涉的构件不能同时显示绿色接触框。
    for (const id of issuePartIds) contactPartIds.delete(id);
    this.issues = issues;
    this.contacts = contacts;
    this.render(issuePartIds,contactPartIds,{live,items,focusIds});
    const state = {
      active:issues.length > 0,
      live,
      count:issues.length,
      contactCount:contacts.length,
      partIds:[...new Set(issues.flatMap(issue=>issue.partIds))],
      contactPartIds:[...contactPartIds],
      issues,
      contacts,
      nearCount:nearContacts.length,nearContacts,
      message:issues.length ? `${issues[0].message}${issues.length > 1 ? `，另有 ${issues.length - 1} 处` : ''}` : (contacts.length ? `${contacts[0].message} · 已贴合，连接件需另检查` : nearContacts[0]?.message||'')
    };
    this.onChanged?.(state);
    return state;
  }

  classify(a,b) {
    const collisionTolerance = Math.max(0.1,Number(this.editor.projectSettings?.collisionToleranceMm ?? 0.5));
    const contactTolerance = Math.max(collisionTolerance,Number(this.editor.projectSettings?.contactToleranceMm ?? 1));
    if (a.obb && b.obb) {
      const collision = intersectObb(a.obb,b.obb,collisionTolerance);
      const exact=a.part?.type==='PROFILE'&&b.part?.type==='PROFILE';
      if (collision.intersects) return {kind:'INTERFERENCE',exact,penetrationMm:Number(collision.minPenetrationMm || 0),gapMm:0};
      // 负 tolerance 等价于将 SAT 的允许间隙扩大 contactTolerance，用于识别“几乎贴面”。
      const expanded = intersectObb(a.obb,b.obb,-contactTolerance);
      if (expanded.intersects) {const gapMm=Math.max(0,-Number(expanded.minPenetrationMm || 0));return {kind:gapMm<=.10001?'CONTACT':'NEAR',exact,penetrationMm:0,gapMm};}
      return {kind:'SEPARATE',exact:true,penetrationMm:0,gapMm:Infinity};
    }
    const boxA = a.box;
    const boxB = b.box;
    if (boxA.isEmpty() || boxB.isEmpty()) return {kind:'SEPARATE',exact:false,penetrationMm:0,gapMm:Infinity};
    const overlapX = Math.min(boxA.max.x,boxB.max.x) - Math.max(boxA.min.x,boxB.min.x);
    const overlapY = Math.min(boxA.max.y,boxB.max.y) - Math.max(boxA.min.y,boxB.min.y);
    const overlapZ = Math.min(boxA.max.z,boxB.max.z) - Math.max(boxA.min.z,boxB.min.z);
    const penetration = Math.min(overlapX,overlapY,overlapZ);
    if (overlapX > collisionTolerance && overlapY > collisionTolerance && overlapZ > collisionTolerance) {
      return {kind:'INTERFERENCE',exact:false,penetrationMm:Math.max(0,penetration),gapMm:0};
    }
    if (overlapX >= -contactTolerance && overlapY >= -contactTolerance && overlapZ >= -contactTolerance) {
      const gap=Math.max(0,-Math.min(overlapX,overlapY,overlapZ));
      return {kind:gap<=.10001?'CONTACT':'NEAR',exact:false,penetrationMm:0,gapMm:gap};
    }
    return {kind:'SEPARATE',exact:false,penetrationMm:0,gapMm:Infinity};
  }

  isIntentionalContact(a,b) {
    if (!a?.id || !b?.id) return true;
    const mounted = (source,target) => source?.type === 'ACCESSORY' && source.mountReference?.targetPartId === target?.id;
    if (mounted(a,b) || mounted(b,a)) return true;

    const byConnection = connectionId => (this.editor.connectionManager.connections || []).find(item => item.id === connectionId);
    for (const source of [a,b]) {
      if (!source?.generatedByConnectionId) continue;
      const connection = byConnection(source.generatedByConnectionId);
      const other = source === a ? b : a;
      if (connection && [connection.sourceProfileId,connection.targetProfileId].includes(other.id)) return true;
    }
    if (a.generatedByConnectionId && a.generatedByConnectionId === b.generatedByConnectionId) return true;
    return false;
  }

  isPhysicalMesh(mesh) {
    const part = mesh?.userData?.part;
    return !!part && mesh.visible !== false && !part.hidden && ['PROFILE','PANEL','SHAFT','ACCESSORY'].includes(part.type);
  }

  render(issuePartIds,contactPartIds,options={}) {
    this.clearVisuals();
    const items=new Map((options.items||[]).map(item=>[item.part.id,item]));
    for (const partId of issuePartIds) this.addHelper(partId,0xe54848,'INTERFERENCE',items.get(partId)?.mesh);
    const selected=new Set((this.editor.selectedMeshes||[]).map(mesh=>mesh.userData?.part?.id));
    const coplanarFaces=new Set();
    for(const contact of this.contacts) {
      if(contact.partIds.some(id=>!contactPartIds.has(id)))continue;
      const [a,b]=contact.partIds.map(id=>items.get(id));
      // 近似 AABB 不冒充真实接触面；直型材才有稳定的领域 OBB。
      if(!a?.obb||!b?.obb||a.connectionId||b.connectionId)continue;
      // 黄色只提示已实际贴合的局部材料面；近距离候选或已有设计关系不是零间隙证据。
      if(!options.live&&contact.gapMm>.1)continue;
      for(const [source,target] of [[a,b],[b,a]]) {
        const helper=createSurfaceFeedback(source.mesh,{clipObb:target.obb,marginMm:Math.max(4,contact.gapMm+2),color:options.live?0x25c778:0xffc400,opacity:options.live?0.36:0.55,renderOrder:1601});
        if(helper){helper.userData.__contact=true;this.group.add(helper);}
      }
      // 静止时仅解释当前选择的邻接面，不把整个框架每层都染成紫色；拖动由 Snap 候选负责。
      if(!options.live&&contact.partIds.some(id=>selected.has(id)))addCoplanarSurfaceFeedback(this.group,a.mesh,b.mesh,coplanarFaces);
    }
  }

  addHelper(partId,color,kind,physicalMesh=null) {
    const mesh = physicalMesh||this.editor.getMeshByPartId(partId);
    if (!mesh) return;
    const helper = new THREE.BoxHelper(mesh,color);
    helper.material.depthTest = false;
    helper.material.transparent = true;
    helper.material.opacity = kind === 'INTERFERENCE' ? 0.98 : 0.9;
    helper.renderOrder = kind === 'INTERFERENCE' ? 1602 : 1601;
    helper.userData.__interference = kind === 'INTERFERENCE';
    helper.userData.__contact = kind === 'CONTACT';
    this.group.add(helper);
    if(kind==='INTERFERENCE'){
      const surface=createSurfaceFeedback(mesh,{color:0xf04444,opacity:0.45,renderOrder:1603});
      if(surface){surface.userData.__interference=true;this.group.add(surface);}
    }
  }

  clearVisuals() {
    while (this.group.children.length) {
      disposeFeedback(this.group.children[0]);
    }
  }

  clear() {
    this.issues = [];
    this.contacts = [];
    this.clearVisuals();
    const state = {active:false,live:false,count:0,contactCount:0,nearCount:0,nearContacts:[],partIds:[],contactPartIds:[],issues:[],contacts:[],message:''};
    this.onChanged?.(state);
    return state;
  }
}

function label(part) {
  return part?.displayId || part?.name || part?.id || '构件';
}
function round(value){return Number(Number(value||0).toFixed(2));}

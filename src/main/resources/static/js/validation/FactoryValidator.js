import {getDesignProfileDefinition,profileNominal} from '../model/DesignProfileCatalog.js';
import {getSectionInfo} from '../model/ProfileSectionRegistry.js';
import {normalizeProfilePath, isLinearProfile} from '../model/ProfilePath.js';
import {getFaceHalfSpan, isProfileFace, isProfileEnd} from '../model/ProfileCoordinateSystem.js';
import {getConnectionRule} from '../model/ConnectionRuleCatalog.js';
import {effectiveDiameter, featureFootprint, isEndMachiningFeature, normalizeMachiningFeature} from '../machining/MachiningFeatureCatalog.js';
import PartCollisionDetector from './PartCollisionDetector.js';
import ConnectionCompletenessInspector from './ConnectionCompletenessInspector.js';
import {panelDimensions,SolidPanelShapes} from '../model/PanelShapeModel.js';

export default class FactoryValidator {
  constructor(editor) {
    this.editor = editor;
  }

  validate() {
    const errors = [];
    const warnings = [];
    const infos = [];
    const settings = {
      minimumEndDistanceMm: Number(this.editor.projectSettings?.minimumEndDistanceMm ?? 8),
      duplicatePositionToleranceMm: Number(this.editor.projectSettings?.duplicatePositionToleranceMm ?? 0.05)
    };
    const context = {referenceCatalogWarned:new Set()};

    for (const part of this.editor.parts.filter(item => item?.type === 'PROFILE')) {
      this.validateProfile(part, errors, warnings, infos, settings, context);
    }
    for (const part of this.editor.parts.filter(item => item?.type === 'ACCESSORY')) {
      this.validateAccessoryMount(part, errors, warnings);
      if(part.hardwareSpec?.source==='DIY_COMPONENT_CATALOG')warnings.push(issue('COMPONENT_REFERENCE_MODEL','WARNING',part.displayId||part.name,'组件为通用设计参考，生产前需核对实际尺寸与安装方案',{partIds:[part.id],category:'ASSEMBLY'}));
    }
    for(const part of this.editor.parts.filter(item=>item?.type==='PANEL'&&item.dimensions?.panelShape)){
      try{panelDimensions(part.dimensions.panelShape,part.dimensions.shapeParameters);}catch(error){errors.push(issue('INVALID_PANEL_SHAPE','ERROR',part.displayId||part.name,error.message,{partIds:[part.id]}));}
      if(SolidPanelShapes.includes(part.dimensions.panelShape))warnings.push(issue('SOLID_REFERENCE_MODEL','WARNING',part.displayId||part.name,'该构件为三维设计几何体，不是板材切割件；需另行确认制造工艺',{partIds:[part.id]}));
    }

    for (const connection of this.editor.connectionManager.connections) {
      this.validateConnection(connection, errors, warnings);
    }
    for (const constraint of this.editor.constraintManager?.constraints || []) {
      this.validateConstraint(constraint,errors,warnings);
    }

    const bomConsistency = this.editor.bomExporter?.validateConsistency?.();
    if (bomConsistency) {
      for (const item of bomConsistency.errors || []) errors.push(issue(`BOM_${item.code}`,'ERROR',item.subject,item.message));
      for (const item of bomConsistency.warnings || []) warnings.push(issue(`BOM_${item.code}`,'WARNING',item.subject,item.message));
      for (const item of bomConsistency.infos || []) infos.push(issue(`BOM_${item.code}`,'INFO',item.subject,item.message));
    }

    const constraintDiagnostics = this.editor.getConstraintDiagnostics?.();
    if (constraintDiagnostics) {
      for (const item of constraintDiagnostics.errors || []) {
        errors.push(issue(`CAD_${item.code}`,'ERROR',item.subject,item.message,{partIds:item.partIds,details:item.details}));
      }
      for (const item of constraintDiagnostics.warnings || []) {
        warnings.push(issue(`CAD_${item.code}`,'WARNING',item.subject,item.message,{partIds:item.partIds,details:item.details}));
      }
      infos.push(issue('CAD_DOF_SUMMARY','INFO','约束自由度',`刚体自由度 ${constraintDiagnostics.summary?.remainingRigidBodyDof ?? '-'} / ${constraintDiagnostics.summary?.totalRigidBodyDof ?? '-'}；参数自由度 ${constraintDiagnostics.summary?.remainingParametricDof ?? '-'} / ${constraintDiagnostics.summary?.totalParametricDof ?? '-'}`));
    }

    const collisionInspection = new PartCollisionDetector(this.editor).inspect();
    this.appendInspection(collisionInspection,errors,warnings,infos,'COLLISION');
    const completenessInspection = new ConnectionCompletenessInspector(this.editor).inspect();
    this.appendInspection(completenessInspection,errors,warnings,infos,'ASSEMBLY');
    const assemblyInspection = this.editor.assemblyInspector?.inspect?.();
    if (assemblyInspection) this.appendInspection(assemblyInspection,errors,warnings,infos,'ASSEMBLY');

    return {
      ok: errors.length === 0,
      errors,
      warnings,
      infos,
      categories:this.categorySummary(errors,warnings,infos),
      summary: {
        errorCount: errors.length,
        warningCount: warnings.length,
        infoCount: infos.length
      }
    };
  }


  appendInspection(result, errors, warnings, infos, category) {
    for (const item of result?.issues || []) {
      const target = item.severity === 'ERROR' ? errors : item.severity === 'WARNING' ? warnings : infos;
      target.push(issue(item.code,item.severity || 'INFO',item.subject,item.message,{partIds:item.partIds,assemblyId:item.assemblyId,details:item.details,category}));
    }
  }

  categorySummary(errors,warnings,infos) {
    const all=[...errors,...warnings,...infos];
    const out={MACHINING:0,CONNECTION:0,COLLISION:0,ASSEMBLY:0,BOM:0,CONSTRAINT:0,OTHER:0};
    for(const item of all){
      const code=String(item.code||'');
      let key=item.category;
      if(!key){
        if(code.startsWith('BOM_'))key='BOM';
        else if(code.startsWith('CAD_'))key='CONSTRAINT';
        else if(code.includes('CONNECTION')||code.includes('T_NUT'))key='CONNECTION';
        else if(code.includes('MACHINING')||code.includes('HOLE')||code.includes('COUNTERSINK')||code.includes('COUNTERBORE'))key='MACHINING';
        else key='OTHER';
      }
      out[key]=(out[key]||0)+1;
    }
    return out;
  }

  validateProfile(part, errors, warnings, infos, settings, context) {
    normalizeProfilePath(part);
    const partLabel = part.displayId || part.id || '未编号型材';
    const length = Number(part.dimensions?.length || 0);
    const sectionSize = part.dimensions?.sectionSize || [0,0];
    const designProfile = part.designProfile || {};
    const definition = getDesignProfileDefinition(designProfile.profileId);
    const sectionInfo = getSectionInfo(designProfile.profileId);

    if (!definition) {
      errors.push(issue('UNKNOWN_DESIGN_PROFILE', 'ERROR', partLabel, `未识别设计型材截面：${designProfile.profileId || '空'}`));
    }
    if (!part.manufacturingProfile?.profileId) {
      errors.push(issue('MANUFACTURING_PROFILE_UNCONFIGURED','ERROR',partLabel,'该设计型材尚未选择真实制造规格；请先进入“制造配置”完成材料映射',{partIds:[part.id],category:'BOM'}));
    }

    if (!Number.isFinite(length) || length <= 0) {
      errors.push(issue('INVALID_PROFILE_LENGTH', 'ERROR', partLabel, `型材长度无效：${part.dimensions?.length}`));
      return;
    }

    // 设计阶段允许使用参数化参考截面；精确 DXF、壁厚、合金等属于后续制造配置，不在此阶段告警。
    if (sectionInfo?.referenceOnly) {
      infos.push(issue('DESIGN_REFERENCE_SECTION', 'INFO', partLabel, '当前使用设计参考截面；制造阶段再绑定真实材料截面'));
    }

    if (isLinearProfile(part)) {
      this.validateEndCuts(part,errors,warnings);
    }

    const machiningItems = part.machiningItems || [];
    this.validateMachiningItems(part, machiningItems, length, sectionSize, errors, warnings, settings);

    if (machiningItems.length === 0) {
      infos.push(issue('NO_MACHINING', 'INFO', partLabel, '该型材无加工项'));
    }
  }

  validateEndCuts(part,errors,warnings) {
    const partLabel = part.displayId || part.id || '未编号型材';
    for (const end of ['START','END']) {
      const cut = part.endCuts?.[end] || {angleDeg:0,axis:'X'};
      const angle = Number(cut.angleDeg || 0);
      if (!Number.isFinite(angle)) {
        errors.push(issue('INVALID_END_CUT_ANGLE','ERROR',partLabel,`${end === 'START' ? 'A端' : 'B端'}斜切角度无效`));
        continue;
      }
      if (Math.abs(angle) > 60) {
        errors.push(issue('END_CUT_ANGLE_OUT_OF_RANGE','ERROR',partLabel,`${end === 'START' ? 'A端' : 'B端'}斜切 ${angle}° 超出当前模型允许的 ±60°`));
      } else if (Math.abs(angle) > 45) {
        warnings.push(issue('STEEP_END_CUT','WARNING',partLabel,`${end === 'START' ? 'A端' : 'B端'}斜切 ${angle}° 较大，需确认锯切夹具与有效端部长度`));
      }
      if (!['X','Y'].includes(cut.axis)) {
        errors.push(issue('INVALID_END_CUT_AXIS','ERROR',partLabel,`${end === 'START' ? 'A端' : 'B端'}斜切方向必须为局部 X 或 Y`));
      }
    }
  }

  validateMachiningItems(part, items, length, sectionSize, errors, warnings, settings) {
    const partLabel = part.displayId || part.id || '未编号型材';
    const surfaceItems = items.filter(item => item && !isEndMachiningFeature(item));

    for (const item of items) {
      if (!item || !item.type) {
        errors.push(issue('INVALID_MACHINING_ITEM', 'ERROR', partLabel, '存在缺少加工类型的数据'));
        continue;
      }
      normalizeMachiningFeature(item, part);

      if (isEndMachiningFeature(item)) {
        const isArcEnd = !isLinearProfile(part);
        if (isArcEnd && !['BEND_BEFORE','BEND_AFTER'].includes(item.processStage)) {
          errors.push(issue('CURVED_MACHINING_STAGE_REQUIRED','ERROR',partLabel,'弯型材端面加工必须明确弯前或弯后工序'));
        } else if (isArcEnd && item.processStage === 'BEND_AFTER') {
          warnings.push(issue('BEND_AFTER_FIXTURE_REQUIRED','WARNING',partLabel,`${item.end==='START'?'A端':'B端'}端面加工为弯后加工，需复核夹具与端面姿态`));
        }
        if (!isProfileEnd(item.end)) errors.push(issue('INVALID_END_MACHINING_END','ERROR',partLabel,`端面加工端别无效：${item.end}`));
        const depth = Number(item.depth || 0);
        if (['END_TAP','END_HOLE','END_COUNTERBORE'].includes(item.type) && (!(depth > 0) || !Number.isFinite(depth))) {
          errors.push(issue('INVALID_END_MACHINING_DEPTH','ERROR',partLabel,`端面加工深度无效：${item.depth}`));
        } else if (depth > length) {
          errors.push(issue('END_MACHINING_DEPTH_EXCEEDS_PROFILE','ERROR',partLabel,`端面加工深度 ${depth}mm 超过型材长度 ${length}mm`));
        }
        const diameter = effectiveDiameter(item);
        if (item.type !== 'END_TAP' && (!(diameter > 0) || !Number.isFinite(diameter))) {
          errors.push(issue('INVALID_END_MACHINING_DIAMETER','ERROR',partLabel,'端面孔/沉孔直径必须大于 0'));
        }
        const halfW=Number(sectionSize?.[0]||0)/2,halfH=Number(sectionSize?.[1]||0)/2,r=diameter/2;
        if (diameter>0 && (Math.abs(Number(item.offsetX||0))+r>halfW+1e-6 || Math.abs(Number(item.offsetY||0))+r>halfH+1e-6)) {
          errors.push(issue('END_MACHINING_EXCEEDS_SECTION','ERROR',partLabel,`${item.end==='START'?'A端':'B端'}加工已超出型材端面截面`));
        }
        continue;
      }

      const isArc = !isLinearProfile(part);
      if (isArc && !['BEND_BEFORE','BEND_AFTER'].includes(item.processStage)) {
        errors.push(issue('CURVED_MACHINING_STAGE_REQUIRED','ERROR',partLabel,'弯型材加工必须明确“弯前加工”或“弯后加工”'));
      } else if (isArc && item.processStage === 'BEND_AFTER') {
        warnings.push(issue('BEND_AFTER_FIXTURE_REQUIRED','WARNING',partLabel,`S=${round(item.stationS ?? item.distanceFromStart)}mm 为弯后加工，需按弯后空间姿态和夹具复核`));
      }

      if (!isProfileFace(item.face)) errors.push(issue('INVALID_MACHINING_FACE','ERROR',partLabel,`加工面无效：${item.face}`));
      const station=Number(item.stationS??item.distanceFromStart);
      if (!Number.isFinite(station) || station<0 || station>length) {
        errors.push(issue('MACHINING_STATION_OUT_OF_RANGE','ERROR',partLabel,`加工位置 S=${item.stationS ?? item.distanceFromStart}mm 超出 0~${length}mm`));
      }

      const footprint=featureFootprint(item);
      if (footprint) {
        if (footprint.station-footprint.stationHalf < -1e-6 || footprint.station+footprint.stationHalf > length+1e-6) {
          errors.push(issue('MACHINING_FEATURE_EXCEEDS_PROFILE_LENGTH','ERROR',partLabel,`${item.type} 在 S=${round(footprint.station)}mm 处沿长度方向超出型材范围`));
        } else {
          const endDistance=Math.min(footprint.station-footprint.stationHalf,length-(footprint.station+footprint.stationHalf));
          if (endDistance<settings.minimumEndDistanceMm) warnings.push(issue('MACHINING_NEAR_END','WARNING',partLabel,`加工特征距最近端面仅 ${round(Math.max(0,endDistance))}mm，小于建议值 ${settings.minimumEndDistanceMm}mm`));
        }
        if (isProfileFace(item.face)) {
          const halfSpan=getFaceHalfSpan(sectionSize,item.face);
          if (!Number.isFinite(footprint.offset)) errors.push(issue('INVALID_MACHINING_OFFSET','ERROR',partLabel,`加工偏移无效：${item.offset}`));
          else if (Math.abs(footprint.offset)+footprint.offsetHalf>halfSpan+1e-6) { const code=['SLOT','OBROUND_SLOT','MILLING_REGION'].includes(item.type)?'MACHINING_FEATURE_EXCEEDS_PROFILE_FACE':'HOLE_EXCEEDS_PROFILE_FACE'; errors.push(issue(code,'ERROR',partLabel,`${item.type} 在 ${item.face} 面偏移 ${round(footprint.offset)}mm 已超出截面范围`)); }
        }
      }

      if (item.diameter !== undefined) {
        const diameter=Number(item.diameter);
        if (!Number.isFinite(diameter)||diameter<=0) errors.push(issue('INVALID_HOLE_DIAMETER','ERROR',partLabel,`孔径无效：${item.diameter}`));
      }
      if (item.type==='COUNTERSINK') {
        const majorDiameter=Number(item.majorDiameter??item.diameter??0),angle=Number(item.angleDeg??item.countersinkAngleDeg??0);
        if (!(majorDiameter>0)) errors.push(issue('INVALID_COUNTERSINK_MAJOR_DIAMETER','ERROR',partLabel,`沉头大径无效：${item.majorDiameter ?? item.diameter}`));
        if (!(angle>0&&angle<180)) errors.push(issue('INVALID_COUNTERSINK_ANGLE','ERROR',partLabel,`沉头 Ø${majorDiameter} 未明确有效角度`));
      }
      if (item.type==='COUNTERBORE' && !(Number(item.depth||0)>0)) errors.push(issue('INVALID_COUNTERBORE_DEPTH','ERROR',partLabel,`沉孔深度无效：${item.depth}`));
      if (['SLOT','OBROUND_SLOT','MILLING_REGION'].includes(item.type)) {
        if (!(Number(item.length)>0) || !(Number(item.width)>0)) errors.push(issue('INVALID_MACHINING_FEATURE_SIZE','ERROR',partLabel,`${item.type} 长度和宽度必须大于 0`));
        if (item.type==='OBROUND_SLOT' && Number(item.length)<Number(item.width)) errors.push(issue('INVALID_OBROUND_RATIO','ERROR',partLabel,'腰孔长度不能小于宽度'));
        if (item.type==='MILLING_REGION' && !(Number(item.depth)>0)) errors.push(issue('INVALID_MILLING_DEPTH','ERROR',partLabel,'铣削区域深度必须大于 0'));
      }
      if (item.referenceDatum==='SLOT_CENTER' && !item.reference?.slotId) warnings.push(issue('SLOT_DATUM_UNRESOLVED','WARNING',partLabel,`${item.type} 选择槽中心基准但未绑定具体 slotId`));
    }

    const itemById=new Map(items.filter(Boolean).map(item=>[item.id,item]));
    for(const item of items){
      if(!item?.linkedHoleId)continue;
      const base=itemById.get(item.linkedHoleId);
      if(!base){errors.push(issue('BROKEN_LINKED_HOLE','ERROR',partLabel,`复合孔关联已断开：${item.id} → ${item.linkedHoleId}`));continue;}
      const secondaryDiameter=effectiveDiameter(item);
      if(secondaryDiameter<Number(base.diameter||0)) errors.push(issue('HEAD_DIAMETER_SMALLER_THAN_BASE_HOLE','ERROR',partLabel,`复合孔外径 Ø${secondaryDiameter} 小于基础孔 Ø${base.diameter}`));
    }

    for(let i=0;i<surfaceItems.length;i++){
      const a=surfaceItems[i];if(a.linkedHoleId)continue;const fa=featureFootprint(a);if(!fa)continue;
      for(let j=i+1;j<surfaceItems.length;j++){
        const b=surfaceItems[j];if(b.linkedHoleId)continue;if(a.face!==b.face)continue;
        if(a.featureGroupId&&b.featureGroupId&&a.featureGroupId===b.featureGroupId)continue;
        const fb=featureFootprint(b);if(!fb)continue;
        const stationOverlap=Math.abs(fa.station-fb.station)<(fa.stationHalf+fb.stationHalf-settings.duplicatePositionToleranceMm);
        const offsetOverlap=Math.abs(fa.offset-fb.offset)<(fa.offsetHalf+fb.offsetHalf-settings.duplicatePositionToleranceMm);
        if(stationOverlap&&offsetOverlap){
          const sameCenter=Math.abs(fa.station-fb.station)<=settings.duplicatePositionToleranceMm&&Math.abs(fa.offset-fb.offset)<=settings.duplicatePositionToleranceMm;
          if(sameCenter&&a.type===b.type) warnings.push(issue('DUPLICATE_MACHINING','WARNING',partLabel,`疑似重复加工：${a.type}，${a.face} 面，S=${round(fa.station)}mm，偏移 ${round(fa.offset)}mm`));
          else errors.push(issue('MACHINING_FEATURE_CONFLICT','ERROR',partLabel,`${a.type} 与 ${b.type} 在 ${a.face} 面发生加工范围冲突`));
        }
      }
    }
  }

  /**
   * 检查标准配件的宿主安装关系。
   *
   * <p>自由添加的配件允许存在，但生产检查会给出 WARNING；一旦写入 mountReference，
   * 引用的宿主构件必须存在且类型必须符合目录 mountRule。</p>
   */
  validateAccessoryMount(part, errors, warnings) {
    if (!['ACCESSORY_CATALOG','DIY_COMPONENT_CATALOG'].includes(part.hardwareSpec?.source)) return;

    const label = part.displayId || part.name || part.id || '配件';
    const rule = part.mountRule || {};
    const reference = part.mountReference || null;
    if (!reference?.targetPartId) {
      if(rule.target==='FREE')return;
      warnings.push(issue('ACCESSORY_NOT_MOUNTED','WARNING',label,'标准配件尚未绑定安装宿主；如为正式装配，请使用配件库“安装”操作',{partIds:[part.id],category:'ASSEMBLY'}));
      return;
    }

    const targetMesh = this.editor.getMeshByPartId(reference.targetPartId);
    const target = targetMesh?.userData?.part;
    if (!target) {
      errors.push(issue('ACCESSORY_MOUNT_TARGET_MISSING','ERROR',label,`配件安装宿主不存在：${reference.targetPartId}`,{partIds:[part.id,reference.targetPartId],category:'ASSEMBLY'}));
      return;
    }

    const targetType = String(rule.target || reference.targetType || '').toUpperCase();
    if (['PROFILE_END','PROFILE_BOTTOM'].includes(targetType) && target.type !== 'PROFILE') {
      errors.push(issue('ACCESSORY_MOUNT_TARGET_TYPE','ERROR',label,'该配件要求安装到型材端部，但当前宿主不是型材',{partIds:[part.id,target.id],category:'ASSEMBLY'}));
      return;
    }
    if (targetType === 'PANEL_SIDE' && target.type !== 'PANEL') {
      errors.push(issue('ACCESSORY_MOUNT_TARGET_TYPE','ERROR',label,'该配件要求安装到板材侧面，但当前宿主不是板材',{partIds:[part.id,target.id],category:'ASSEMBLY'}));
      return;
    }
    if(targetType==='SHAFT_AXIS'&&(target.type!=='SHAFT'||Math.abs(Number(part.mountRule?.diameter)-Number(target.dimensions?.diameter))>.01))errors.push(issue('SHAFT_CLAMP_MISMATCH','ERROR',label,'固定夹宿主类型或孔径不匹配',{partIds:[part.id,target.id],category:'ASSEMBLY'}));

    const requiredNominal = String(rule.profileNominal || '').trim();
    if (requiredNominal && target.type === 'PROFILE' && String(profileNominal(target) || '') !== requiredNominal) {
      errors.push(issue('ACCESSORY_PROFILE_NOMINAL_MISMATCH','ERROR',label,`配件适配 ${requiredNominal} 型材，当前宿主为 ${profileNominal(target) || '未知规格'}`,{partIds:[part.id,target.id],category:'ASSEMBLY'}));
    }
  }

  validateConnection(connection, errors, warnings) {
    const id = connection?.id || '未知连接';
    const sourceMesh = this.editor.getMeshByPartId(connection?.sourceProfileId);
    const targetMesh = this.editor.getMeshByPartId(connection?.targetProfileId);
    if (!sourceMesh || !targetMesh) {
      errors.push(issue('DANGLING_CONNECTION', 'ERROR', id, '连接源或目标构件不存在'));
      return;
    }

    if (!isLinearProfile(sourceMesh.userData.part) || !isLinearProfile(targetMesh.userData.part)) {
      errors.push(issue('UNSUPPORTED_CURVED_CONNECTION', 'ERROR', id, '当前端面连接规则仅支持直型材'));
    }

    if (!connection?.manufacturingRuleId) {
      errors.push(issue('MANUFACTURING_CONNECTION_UNCONFIGURED','ERROR',id,'该设计连接尚未选择真实制造方案；请先进入“制造配置”选择连接件与加工规则',{partIds:[connection.sourceProfileId,connection.targetProfileId],category:'CONNECTION'}));
      return;
    }
    const ruleId = connection.manufacturingRuleId;
    const rule = getConnectionRule(ruleId);
    if (!rule || rule.type !== connection.designType) {
      errors.push(issue('UNKNOWN_CONNECTION_RULE', 'ERROR', id, `连接制造方案无效或与设计类型不匹配：${ruleId}`));
      return;
    }

    const geometry = this.editor.connectionManager.evaluateConnectionGeometry(sourceMesh,targetMesh,rule,{sourceEnd:connection.sourceEnd,targetFace:connection.targetFace});
    for (const item of geometry.errors || []) errors.push(issue(item.code,'ERROR',id,item.message));
    for (const item of geometry.warnings || []) warnings.push(issue(item.code,'WARNING',id,item.message));
    if (!geometry.ok) return;

    const generated = this.editor.parts.filter(part => part.generatedByConnectionId === id && part.type === 'ACCESSORY');
    const sourceGenerated = (sourceMesh.userData.part.machiningItems || []).filter(item => item.generatedByConnectionId === id);
    const targetGenerated = (targetMesh.userData.part.machiningItems || []).filter(item => item.generatedByConnectionId === id);

    if (rule.type === 'ANGLE_BRACKET' || rule.type === 'CONNECTION_PLATE') {
      const stackCount=Math.max(1,Number(rule.hardware?.fastenerPairs || (rule.type==='ANGLE_BRACKET'?2:4)));
      const perStack=[rule.hardware?.tNutSku,rule.hardware?.screwSku,rule.hardware?.washerSku].filter(Boolean).length;
      const expected = 1 + stackCount * perStack;
      if (generated.length < expected) errors.push(issue('CONNECTION_MISSING_HARDWARE','ERROR',id,`${rule.type==='ANGLE_BRACKET'?'角码':'连接板'}连接应生成至少 ${expected} 个五金构件，当前仅 ${generated.length} 个`));
    } else if (rule.type === 'INTERNAL_CONNECTOR' || rule.type === 'ANCHOR_CONNECTOR') {
      if (!sourceGenerated.some(item => item.type === 'END_TAP')) errors.push(issue('CONNECTION_MISSING_SOURCE_TAP','ERROR',id,'内置/锚式连接缺少源型材端面攻丝'));
      if (!generated.length) errors.push(issue('CONNECTION_MISSING_HARDWARE','ERROR',id,'内置/锚式连接缺少自动生成的连接五金'));
    } else {
      if (!sourceGenerated.some(item => item.type === 'END_TAP')) errors.push(issue('CONNECTION_MISSING_SOURCE_TAP', 'ERROR', id, '连接缺少源型材端面攻丝'));
      if (!targetGenerated.some(item => item.type === 'THROUGH_HOLE')) errors.push(issue('CONNECTION_MISSING_TARGET_HOLE', 'ERROR', id, '连接缺少目标型材通孔'));
      if (rule.hardware?.screwSku && !generated.some(part => part.hardwareSku === rule.hardware.screwSku)) errors.push(issue('CONNECTION_MISSING_HARDWARE','ERROR',id,'端面连接缺少自动生成的螺钉'));
    }

    for (const hardware of generated.filter(part=>part.accessoryType==='T_NUT')) {
      if(!hardware.mountReference?.slotId) errors.push(issue('T_NUT_WITHOUT_SLOT_REFERENCE','ERROR',hardware.displayId||id,'自动生成的 T 螺母未绑定目录槽位 slotId'));
    }
    for (const note of rule.productionNotes || []) warnings.push(issue('CONNECTION_PRODUCTION_NOTE', 'WARNING', id, note));
  }

  validateConstraint(constraint,errors,warnings) {
    const id=constraint?.id||'未知约束';
    const source=this.editor.getMeshByPartId(constraint?.sourcePartId);
    const target=this.editor.getMeshByPartId(constraint?.targetPartId);
    if(!source||!target){errors.push(issue('DANGLING_CONSTRAINT','ERROR',id,'约束源或目标构件不存在'));return;}
    if(constraint.type!=='RIGID_MATE'){warnings.push(issue('UNKNOWN_CONSTRAINT_TYPE','WARNING',id,`未识别约束类型：${constraint.type}`));return;}
    if(!Array.isArray(constraint.relativeMatrix)||constraint.relativeMatrix.length!==16){errors.push(issue('INVALID_CONSTRAINT_MATRIX','ERROR',id,'刚性约束缺少有效相对变换矩阵'));}
  }

  static toText(result) {
    const lines = [
      '铝型材生产检查报告',
      '',
      `结果：${result.ok ? '通过（允许导出）' : '失败（存在阻断错误）'}`,
      `错误：${result.errors.length}`,
      `警告：${result.warnings.length}`,
      `提示：${result.infos.length}`,
      `分类：${Object.entries(result.categories || {}).filter(([,count]) => count > 0).map(([name,count]) => `${categoryLabel(name)}=${count}`).join(' / ') || '无'}`,
      ''
    ];
    append(lines, '错误', result.errors);
    append(lines, '警告', result.warnings);
    append(lines, '提示', result.infos);
    return lines.join('\n');
  }
}

function issue(code, level, subject, message, extra = {}) {
  const clean = Object.fromEntries(Object.entries(extra || {}).filter(([,value]) => value !== undefined && value !== null));
  return {code, level, subject, message, ...clean};
}

function append(lines, title, items) {
  if (!items.length) return;
  lines.push(`[${title}]`);
  items.forEach((item, index) => lines.push(`${index + 1}. ${item.subject}: ${item.message} (${item.code})`));
  lines.push('');
}

function round(value) {
  return Number(Number(value).toFixed(2));
}

function categoryLabel(name){return ({MACHINING:'加工',CONNECTION:'连接',COLLISION:'碰撞',ASSEMBLY:'装配',BOM:'材料清单',CONSTRAINT:'约束',OTHER:'其它'})[name] || name;}

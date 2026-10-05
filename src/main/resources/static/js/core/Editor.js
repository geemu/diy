import * as THREE from 'three';
import SceneManager from './SceneManager.js';
import {profileQuaternion} from '../geometry/ProfileOrientation.js';
import ProfileGeometryFactory from '../geometry/ProfileGeometryFactory.js';
import PrimitiveGeometryFactory from '../geometry/PrimitiveGeometryFactory.js';
import {getDesignProfileDefinition,profileDisplayName,profileNominal} from '../model/DesignProfileCatalog.js';
import MachiningManager from '../machining/MachiningManager.js';
import ConnectionManager from '../connection/ConnectionManager.js';
import AutoConnectionResolver from '../connection/AutoConnectionResolver.js';
import SnapManager from '../snap/SnapManager.js';
import HistoryManager from '../history/HistoryManager.js';
import BomExporter from '../export/BomExporter.js';
import DrawingGenerator from '../export/DrawingGenerator.js';
import DxfExporter from '../export/DxfExporter.js';
import FactoryPackageExporter from '../export/FactoryPackageExporter.js';
import {normalizeProfilePath, isLinearProfile, getLocalFrameAtStation} from '../model/ProfilePath.js';
import {exportCustomSections, loadCustomSections} from '../model/ProfileSectionRegistry.js';
import ProjectSchema, {CURRENT_PROJECT_SCHEMA_VERSION, CURRENT_APP_VERSION} from '../io/ProjectSchema.js';
import DimensionSystem from '../dimension/DimensionSystem.js';
import FactoryValidator from '../validation/FactoryValidator.js';
import {createProjectCoordinateDescriptor} from '../model/ProfileCoordinateSystem.js';
import {getHardwareDefinition, hardwareDimensions} from '../model/HardwareCatalog.js';
import ConstraintManager from '../constraint/ConstraintManager.js';
import AssemblyManager from '../model/AssemblyManager.js';
import AssemblyInspector from '../model/AssemblyInspector.js';
import AssemblyPresentationManager from '../model/AssemblyPresentationManager.js';
import MachiningPatternManager from '../machining/MachiningPatternManager.js';
import SceneAnnotationManager from '../annotation/SceneAnnotationManager.js';
import FeatureSelectionManager from '../constraint/FeatureSelectionManager.js';
import ConstraintVisualizer from '../constraint/ConstraintVisualizer.js';
import MobilityVisualizer from '../constraint/MobilityVisualizer.js';
import {normalizeConstraintKind, constraintKindLabel} from '../constraint/ConstraintTypes.js';
import {featureWorldPoint,profileAxis,endAxis,alignVector,translateFeatureTo} from '../constraint/AssemblyMateMath.js';
import ProfileDrawTool from '../drawing/ProfileDrawTool.js';
import ContourFrameManager from '../drawing/ContourFrameManager.js';
import EngineeringDrawingService from '../drawing/EngineeringDrawingService.js';
import ProfileGripEditor from '../interaction/ProfileGripEditor.js';
import FeatureHoverManager from '../interaction/FeatureHoverManager.js';
import WorkPlaneVisualizer from '../interaction/WorkPlaneVisualizer.js';
import SelectionCycleManager from '../interaction/SelectionCycleManager.js';
import AccessoryMountManager from '../model/AccessoryMountManager.js';
import PanelDoorConfigurator from '../configurator/PanelDoorConfigurator.js';
import ProfileReplacementManager from '../model/ProfileReplacementManager.js';
import ConnectionPlacementManager from '../connection/ConnectionPlacementManager.js';
import MachiningPlacementManager from '../machining/MachiningPlacementManager.js';
import ManufacturingConfigurator from '../manufacturing/ManufacturingConfigurator.js';
import InterferenceFeedbackManager from '../interaction/InterferenceFeedbackManager.js';
import AccessoryPlacementManager from '../interaction/AccessoryPlacementManager.js';
import ManufacturingIdentityManager from '../manufacturing/ManufacturingIdentityManager.js';
import AssemblyInstructionGenerator from '../manufacturing/AssemblyInstructionGenerator.js';
import AssemblyPlaybackManager from '../manufacturing/AssemblyPlaybackManager.js';

export default class Editor {
  constructor(container) {
    this.container = container;
    this.sceneManager = new SceneManager(container);
    this.parts = [];
    this.meshes = [];
    this.selected = null;
    this.selectedMeshes = [];
    this.selectionFilter = 'ALL';
    this.transformSpace = 'world';
    this.movementStepMm = 5;
    this.rotationStepDeg = 15;
    this.transformMoveScope = 'SINGLE';
    this.featureHover = null;
    this.transformSelectionSnapshot = null;
    this.measureMode = false;
    this.measureStart = null;
    this.measurement = null;
    this.dimensionMode = false;
    this.dimensionStart = null;
    this.userDimensions = [];
    this.onUserDimensionsChanged = null;
    this.partSequence = 1;
    this.onSelectionChanged = null;
    this.onDimensionsChanged = null;
    this.onStatsChanged = null;
    this.onSnapChanged = null;
    this.onAutoConnectionChanged = null;
    this.onProjectChanged = null;
    this.onContextMenu = null;
    this.onJointHover = null;
    this.onInterferenceChanged = null;
    this.onTransformBlocked = null;
    this.onConnectionsBroken = null;
    this.onMeasurementChanged = null;
    this.onFeatureSelectionChanged = null;
    this.projectSettings = {
      unit:'mm',
      strictExport:true,
      minimumEndDistanceMm:8,
      duplicatePositionToleranceMm:0.05,
      collisionToleranceMm:0.5,
      contactToleranceMm:1
    };
    this.machiningManager = new MachiningManager(this);
    this.connectionManager = new ConnectionManager(this);
    this.snapManager = new SnapManager(this);
    this.autoConnectionEnabled = true;
    this.autoConnectionResolver = new AutoConnectionResolver(this);
    this.historyManager = new HistoryManager(this);
    this.bomExporter = new BomExporter(this);
    this.drawingGenerator = new DrawingGenerator(this);
    this.dxfExporter = new DxfExporter();
    this.factoryValidator = new FactoryValidator(this);
    this.factoryPackageExporter = new FactoryPackageExporter(this);
    this.constraintManager = new ConstraintManager(this);
    this.assemblyManager = new AssemblyManager(this);
    this.assemblyInspector = new AssemblyInspector(this);
    this.assemblyPresentationManager = new AssemblyPresentationManager(this);
    this.machiningPatternManager = new MachiningPatternManager(this);
    this.dimensionSystem = new DimensionSystem(this);
    this.featureSelectionManager = new FeatureSelectionManager(this);
    this.annotationManager = new SceneAnnotationManager(this,this.sceneManager);
    this.constraintVisualizer = new ConstraintVisualizer(this,this.sceneManager);
    this.mobilityVisualizer = new MobilityVisualizer(this,this.sceneManager);
    this.profileDrawTool = new ProfileDrawTool(this);
    this.contourFrameManager = new ContourFrameManager(this);
    this.profileGripEditor = new ProfileGripEditor(this);
    // v0.41 交互组件彼此独立：Feature Hover、工作平面、穿透选择均不持久化到业务模型。
    this.featureHoverManager = new FeatureHoverManager(this);
    this.workPlaneVisualizer = new WorkPlaneVisualizer(this.sceneManager);
    this.selectionCycleManager = new SelectionCycleManager();
    this.accessoryMountManager = new AccessoryMountManager(this);
    this.panelDoorConfigurator = new PanelDoorConfigurator(this);
    this.profileReplacementManager = new ProfileReplacementManager(this);
    this.connectionPlacementManager = new ConnectionPlacementManager(this);
    this.machiningPlacementManager = new MachiningPlacementManager(this);
    this.manufacturingConfigurator = new ManufacturingConfigurator(this);
    this.interferenceFeedbackManager = new InterferenceFeedbackManager(this);
    this.accessoryPlacementManager = new AccessoryPlacementManager(this);
    this.manufacturingIdentityManager = new ManufacturingIdentityManager(this);
    this.assemblyInstructionGenerator = new AssemblyInstructionGenerator(this);
    this.assemblyPlaybackManager = new AssemblyPlaybackManager(this);
    this.interferenceFeedbackManager.onChanged = state => this.onInterferenceChanged?.(state);
    this.drawingSettings = {projectName:'未命名工程',revision:'A',paper:'A3',sideView:'RIGHT'};
    this.engineeringDrawingService = new EngineeringDrawingService(this);
    this.sceneManager.setTranslationSnap(this.movementStepMm);
    this.sceneManager.setRotationSnap(this.rotationStepDeg);
    this.bind();
    this.historyManager.reset();
  }

  bind() {
    this.sceneManager.secondaryClickHandler = () => {
      // 短右键统一退出放置；右键拖动仍由 SceneManager / OrbitControls 处理平移。
      if(this.accessoryPlacementManager.isActive()){this.accessoryPlacementManager.cancel();return true;}
      if(this.connectionPlacementManager.isActive()){this.connectionPlacementManager.cancel();return true;}
      if(this.machiningPlacementManager.isActive()){this.machiningPlacementManager.cancel();return true;}
      if(!this.profileDrawTool.isActive())return false;
      this.profileDrawTool.stop();return true;
    };
    this.sceneManager.clickHandler = event => {
      if (this.sceneManager.transformControls.dragging) return;
      if (this.connectionPlacementManager.isActive()) { this.connectionPlacementManager.handleClick(event); return; }
      if (this.accessoryPlacementManager.isActive()) { this.accessoryPlacementManager.handleClick(event); return; }
      if (this.machiningPlacementManager.isActive()) { this.machiningPlacementManager.handleClick(event); return; }
      if (this.contourFrameManager.active) {
        // 轮廓点拖拽由 ContourFrameManager 的捕获阶段事件处理；非拖拽点击仍允许正常选择。
      }
      if (this.profileDrawTool.isActive()) {
        this.profileDrawTool.handleClick(event);
        return;
      }
      if (this.featureSelectionManager.enabled) {
        this.featureSelectionManager.pick(event);
        return;
      }
      if (this.measureMode) {
        this.handleMeasureClick(event);
        return;
      }
      if (this.dimensionMode) {
        this.handleDimensionClick(event);
        return;
      }
      let mesh;
      // Alt + 单击用于“穿透/循环选择”，解决复杂装配中前方构件遮挡后方构件的问题。
      if (event.altKey) {
        const candidates = this.sceneManager.pickRoots(event, this.selectableMeshes());
        const cycle = this.selectionCycleManager.next(event,candidates);
        mesh = cycle?.mesh || null;
        if (cycle?.count > 1) mesh.userData.selectionCycle = {index:cycle.index+1,count:cycle.count};
      } else {
        this.selectionCycleManager.reset();
        mesh = this.sceneManager.pick(event, this.selectableMeshes());
      }
      this.featureHoverManager.clear();
      this.sceneManager.clearHover();
      this.select(mesh,{additive:event.ctrlKey || event.metaKey || event.shiftKey,toggle:event.ctrlKey || event.metaKey});
    };

    this.sceneManager.pointerMoveHandler = event => {
      if (this.connectionPlacementManager.isActive()) { this.onJointHover?.(null); this.featureHoverManager.clear(); this.sceneManager.clearHover(); this.connectionPlacementManager.handlePointerMove(event); return; }
      if (this.accessoryPlacementManager.isActive()) { this.onJointHover?.(null); this.featureHoverManager.clear(); this.sceneManager.clearHover(); this.accessoryPlacementManager.handlePointerMove(event); return; }
      if (this.machiningPlacementManager.isActive()) { this.onJointHover?.(null); this.featureHoverManager.clear(); this.sceneManager.clearHover(); this.machiningPlacementManager.handlePointerMove(event); return; }
      if (this.profileDrawTool.isActive()) { this.onJointHover?.(null); this.featureHoverManager.clear(); this.sceneManager.clearHover(); this.profileDrawTool.handlePointerMove(event); return; }
      const exclusiveMode = this.featureSelectionManager.enabled || this.measureMode || this.dimensionMode || this.sceneManager.marqueeMode || this.sceneManager.lassoMode || this.profileGripEditor?.drag || this.contourFrameManager?.dragIndex>=0;
      if (exclusiveMode) { this.onJointHover?.(null); this.featureHoverManager.clear(); this.sceneManager.clearHover(); return; }

      const jointHit=this.sceneManager.pickHit(event,this.connectionPlacementManager.profileMeshes());
      const joint=this.connectionPlacementManager.resolveJointContext(jointHit);
      this.onJointHover?.(jointHit?{event,hit:jointHit,joint}:null);

      // 型材优先显示 Feature 级预高亮；非型材仍保留整构件 hover。
      const feature = this.featureHoverManager.update(event);
      if (feature) return;
      const mesh=this.sceneManager.pick(event,this.selectableMeshes());
      if(mesh && !this.selectedMeshes.includes(mesh)) {
        const part=mesh.userData?.part;
        const label=[part?.displayId,part?.name || profileDisplayName(part) || part?.type].filter(Boolean).join(' · ');
        this.sceneManager.setHover(mesh,event,label);
      } else this.sceneManager.clearHover();
    };

    this.sceneManager.contextMenuHandler = event => {
      if (this.sceneManager.transformControls.dragging || this.profileDrawTool.isActive() || this.connectionPlacementManager.isActive() || this.accessoryPlacementManager.isActive() || this.machiningPlacementManager.isActive() || this.contourFrameManager?.dragIndex>=0) return;
      this.featureHoverManager.clear();
      const hit = this.sceneManager.pickHit(event,this.selectableMeshes());
      const mesh = hit?.object || null;
      if (mesh && !this.selectedMeshes.includes(mesh)) this.select(mesh);
      if (this.onContextMenu) this.onContextMenu({event,mesh,hit,selection:[...this.selectedMeshes]});
    };

    this.sceneManager.marqueeHandler = payload => {
      const visible = this.selectableMeshes();
      const hits = this.sceneManager.pickInScreenRect(payload.start,payload.end,visible);
      if (payload.additive) {
        const merged = [...new Set([...this.selectedMeshes,...hits])];
        this.selectMany(merged);
      } else {
        this.selectMany(hits);
      }
    };

    this.sceneManager.lassoHandler = payload => {
      const visible = this.selectableMeshes();
      const hits = this.sceneManager.pickInScreenPolygon(payload.points,visible);
      if (payload.additive) this.selectMany([...new Set([...this.selectedMeshes,...hits])]);
      else this.selectMany(hits);
    };

    this.sceneManager.transformControls.addEventListener('mouseDown', () => {
      if (!this.selected) {
        this.transformSelectionSnapshot = null;
        return;
      }
      const primary = this.selected;
      primary.updateMatrixWorld(true);
      const followers = this.selectedMeshes.length > 1
        ? this.selectedMeshes.filter(mesh => mesh !== primary)
        : this.transformFollowersForScope(primary);
      this.transformSelectionSnapshot = {
        primaryPosition:primary.position.clone(),
        primaryQuaternion:primary.quaternion.clone(),
        primaryEuler:primary.rotation.clone(),
        constrainedSingle:this.selectedMeshes.length <= 1,
        scope:this.selectedMeshes.length > 1 ? 'SELECTION' : this.transformMoveScope,
        items:followers.map(mesh => ({
          mesh,
          position:mesh.position.clone(),
          quaternion:mesh.quaternion.clone()
        })),
        rollbackItems:this.meshes.filter(mesh => mesh !== primary).map(mesh => ({
          mesh,
          position:mesh.position.clone(),
          quaternion:mesh.quaternion.clone()
        }))
      };
    });

    this.sceneManager.transformControls.addEventListener('objectChange', () => {
      if (!this.selected) return;
      this.applyConstrainedPrimaryTransform();
      this.applyMultiSelectionTransform();
      const changedMeshes = this.currentTransformMeshes();
      const changedIds = [];
      for (const mesh of changedMeshes) {
        this.syncPartFromMesh(mesh);
        if (mesh.userData.part?.id) changedIds.push(mesh.userData.part.id);
      }
      const constrainedIds = this.constraintManager.solveForChangedParts(changedIds);
      this.accessoryMountManager.refreshForTargets([...changedIds,...constrainedIds]);
      this.updateDimensions();
      this.emitStats();
      const liveRelation=this.interferenceFeedbackManager.preview([...changedIds,...constrainedIds]);
      const snapshot=this.transformSelectionSnapshot;
      if(snapshot){
        this.sceneManager.showTransformFeedback({
          mode:this.sceneManager.transformControls.mode,
          axis:this.sceneManager.transformControls.axis,
          delta:this.selected.position.clone().sub(snapshot.primaryPosition),
          rotation:{x:this.selected.rotation.x-snapshot.primaryEuler.x,y:this.selected.rotation.y-snapshot.primaryEuler.y,z:this.selected.rotation.z-snapshot.primaryEuler.z},
          scopeLabel:this.transformScopeLabel(snapshot.scope)
        });
      }
      if(liveRelation?.active){
        this.sceneManager.clearSnapPreview();
        this.sceneManager.showSnapFeedback?.({status:'blocked',label:'实体干涉',details:[liveRelation.issues?.[0]?.message||'当前落位不可用']});
        if (this.onSnapChanged) this.onSnapChanged(null);
      } else if (this.selected?.userData?.part?.type === 'PROFILE') {
        const previewSnap=this.snapManager.preview(this.selected);
        if (this.onSnapChanged) this.onSnapChanged(previewSnap || null);
        if(!previewSnap&&liveRelation?.contactCount>0)this.sceneManager.showSnapFeedback?.({status:'valid',label:'面接触',details:['当前几何贴合有效']});
      } else {
        this.sceneManager.clearSnapPreview();
        if(liveRelation?.contactCount>0)this.sceneManager.showSnapFeedback?.({status:'valid',label:'面接触',details:['当前几何贴合有效']});
        else this.sceneManager.hideSnapFeedback?.();
        if (this.onSnapChanged) this.onSnapChanged(null);
      }
    });

    this.sceneManager.transformControls.addEventListener('mouseUp', () => {
      if (!this.selected) return;
      this.sceneManager.clearSnapPreview();
      this.sceneManager.hideTransformFeedback?.();
      const snapshot=this.transformSelectionSnapshot;
      const beforeSnap = this.selected.position.clone();
      const snap = this.quickRotationActive ? null : this.snapManager.snap(this.selected);
      const snapDelta = this.selected.position.clone().sub(beforeSnap);
      if (snapDelta.lengthSq() > 0) {
        for (const mesh of this.currentTransformMeshes()) {
          if (mesh !== this.selected) mesh.position.add(snapDelta);
        }
      }
      const changedMeshes=this.currentTransformMeshes();
      const changedIds = [];
      for (const mesh of changedMeshes) {
        this.syncPartFromMesh(mesh);
        if (mesh.userData.part?.id) changedIds.push(mesh.userData.part.id);
      }

      const collisionState=this.interferenceFeedbackManager.refresh({focusIds:new Set(changedIds),live:false});
      if(collisionState.active && snapshot){
        this.quickRotationBlocked=true;
        this.restoreTransformSnapshot(snapshot);
        this.transformSelectionSnapshot=null;
        this.snapManager.clearLock();
        this.sceneManager.clearSnapPreview();
        this.sceneManager.hideSnapFeedback?.();
        this.sceneManager.setSelections(this.selectedMeshes,this.selected);
        this.updateDimensions();
        this.emitStats();
        this.interferenceFeedbackManager.requestRefresh();
        this.onTransformBlocked?.(collisionState);
        return;
      }

      const constrainedIds = this.constraintManager.solveForChangedParts(changedIds);
      const refreshIds = new Set([...changedIds,...constrainedIds]);
      const profileIds=[...refreshIds].filter(partId=>this.getMeshByPartId(partId)?.userData.part?.type==='PROFILE');
      this.connectionManager.updateConnectionsForProfiles(profileIds);
      const brokenConnections=[];
      if(snapshot?.scope==='SINGLE' && this.selectedMeshes.length<=1){
        for(const connection of [...this.connectionManager.connections]){
          if(!profileIds.includes(connection.sourceProfileId) && !profileIds.includes(connection.targetProfileId))continue;
          if(connection.status!=='INVALID')continue;
          brokenConnections.push({id:connection.id,sourceProfileId:connection.sourceProfileId,targetProfileId:connection.targetProfileId});
          this.connectionManager.removeConnection(connection.id);
        }
      }
      let autoConnectionResult = null;
      if (this.autoConnectionEnabled && snap?.targetFace && this.selectedMeshes.length <= 1) {
        autoConnectionResult = this.autoConnectionResolver.connectFromSnap(this.selected,{source:'DRAG'});
      }
      this.accessoryMountManager.refreshForTargets([...refreshIds]);
      this.transformSelectionSnapshot = null;
      this.sceneManager.setSelections(this.selectedMeshes,this.selected);
      this.updateDimensions();
      this.emitStats();
      this.historyManager.capture();
      this.emitProjectChanged();
      if (this.onSnapChanged) this.onSnapChanged(snap || null);
      if (autoConnectionResult?.status === 'CREATED' && this.onAutoConnectionChanged) this.onAutoConnectionChanged(autoConnectionResult);
      if (brokenConnections.length && this.onConnectionsBroken) this.onConnectionsBroken(brokenConnections);
      this.interferenceFeedbackManager.requestRefresh();
    });
  }


  applyConstrainedPrimaryTransform() {
    const snapshot=this.transformSelectionSnapshot;
    const mesh=this.selected;
    if(!snapshot?.constrainedSingle||!mesh?.userData?.part?.id)return;
    const partId=mesh.userData.part.id;
    const mobility=this.constraintManager.getMobility(partId);
    if(mobility.mode==='FREE')return;
    const delta=mesh.position.clone().sub(snapshot.primaryPosition);
    mesh.position.copy(snapshot.primaryPosition).add(this.constraintManager.mobility.projectTranslation(partId,delta));
    mesh.quaternion.copy(this.constraintManager.mobility.projectRotation(partId,snapshot.primaryQuaternion,mesh.quaternion));
    mesh.updateMatrixWorld(true);
  }

  /** 90°按钮复用 Gizmo 完整事务，包含作用域、约束、安装随动、干涉回滚和撤销。 */
  rotateSelectionQuarterTurn(axis) {
    if(!this.selected||!this.isMeshTransformable(this.selected))throw new Error('先选择可旋转的构件；已安装配件需先解除安装');
    if(this.selectedMeshes.some(mesh=>!this.isMeshTransformable(mesh)))throw new Error('所选构件包含锁定或已安装的配件，请调整选择后再旋转');
    const vectors={X:new THREE.Vector3(1,0,0),Y:new THREE.Vector3(0,1,0),Z:new THREE.Vector3(0,0,1)};
    const vector=vectors[String(axis).toUpperCase()];
    if(!vector)throw new Error('旋转轴必须为 X、Y 或 Z');
    if(this.profileDrawTool.isActive())this.profileDrawTool.stop();
    this.quickRotationActive=true;this.quickRotationBlocked=false;
    const controls=this.sceneManager.transformControls;
    try {
      controls.dispatchEvent({type:'mouseDown'});
      const rotation=new THREE.Quaternion().setFromAxisAngle(vector,Math.PI/2);
      if(this.transformSpace==='local')this.selected.quaternion.multiply(rotation);
      else this.selected.quaternion.premultiply(rotation);
      this.selected.updateMatrixWorld(true);
      controls.dispatchEvent({type:'objectChange'});
      controls.dispatchEvent({type:'mouseUp'});
      this.onSelectionChanged?.(this.selected,[...this.selectedMeshes]);
      return !this.quickRotationBlocked;
    } finally {this.quickRotationActive=false;}
  }

  applyMultiSelectionTransform() {
    const snapshot = this.transformSelectionSnapshot;
    if (!snapshot || !this.selected) return;
    const primary = this.selected;
    const deltaPosition = primary.position.clone().sub(snapshot.primaryPosition);
    const deltaQuaternion = primary.quaternion.clone().multiply(snapshot.primaryQuaternion.clone().invert());
    for (const item of snapshot.items) {
      const relative = item.position.clone().sub(snapshot.primaryPosition).applyQuaternion(deltaQuaternion);
      item.mesh.position.copy(primary.position).add(relative);
      item.mesh.quaternion.copy(deltaQuaternion).multiply(item.quaternion);
      item.mesh.updateMatrixWorld(true);
    }
  }


  currentTransformMeshes() {
    const meshes=[this.selected,...(this.transformSelectionSnapshot?.items||[]).map(item=>item.mesh),...(this.selectedMeshes||[])].filter(Boolean);
    return [...new Set(meshes)];
  }

  restoreTransformSnapshot(snapshot) {
    if(!snapshot||!this.selected)return;
    this.selected.position.copy(snapshot.primaryPosition);
    this.selected.quaternion.copy(snapshot.primaryQuaternion);
    this.selected.updateMatrixWorld(true);
    this.syncPartFromMesh(this.selected);
    for(const item of snapshot.rollbackItems||snapshot.items||[]){
      item.mesh.position.copy(item.position);
      item.mesh.quaternion.copy(item.quaternion);
      item.mesh.updateMatrixWorld(true);
      this.syncPartFromMesh(item.mesh);
    }
  }

  transformFollowersForScope(primary) {
    const part=primary?.userData?.part;
    if(!part||this.transformMoveScope==='SINGLE')return [];
    if(this.transformMoveScope==='ASSEMBLY'){
      if(!part.assemblyId)return [];
      return this.meshes.filter(mesh=>mesh!==primary&&mesh.visible!==false&&mesh.userData?.part?.assemblyId===part.assemblyId&&this.isMeshTransformable(mesh));
    }
    if(this.transformMoveScope!=='CONNECTED'||part.type!=='PROFILE')return [];
    const visited=new Set([part.id]);
    const queue=[part.id];
    const connections=this.connectionManager.connections||[];
    while(queue.length){
      const current=queue.shift();
      for(const connection of connections){
        let next=null;
        if(connection.sourceProfileId===current)next=connection.targetProfileId;
        else if(connection.targetProfileId===current)next=connection.sourceProfileId;
        if(next&&!visited.has(next)){visited.add(next);queue.push(next);}
      }
    }
    return this.meshes.filter(mesh=>mesh!==primary&&visited.has(mesh.userData?.part?.id)&&this.isMeshTransformable(mesh));
  }

  transformScopeLabel(scope=this.transformMoveScope) {
    if(scope==='CONNECTED')return '保持连接移动';
    if(scope==='ASSEMBLY')return '移动整个装配';
    if(scope==='SELECTION')return '移动当前选择';
    return '单个移动';
  }

  setTransformMoveScope(scope='SINGLE') {
    const value=['SINGLE','CONNECTED','ASSEMBLY'].includes(scope)?scope:'SINGLE';
    this.transformMoveScope=value;
    return value;
  }

  setMovementStep(stepMm=0) {
    this.movementStepMm=Math.max(0,Number(stepMm)||0);
    this.sceneManager.setTranslationSnap(this.movementStepMm);
    return this.movementStepMm;
  }

  setRotationStep(stepDeg=0) {
    this.rotationStepDeg=Math.max(0,Number(stepDeg)||0);
    this.sceneManager.setRotationSnap(this.rotationStepDeg);
    return this.rotationStepDeg;
  }

  setSnapTemporarilyDisabled(disabled=false) {
    this.snapManager.setTemporaryDisabled(disabled===true);
  }


  addProfile(type, length = 500, options = {}) {
    const definition = getDesignProfileDefinition(type);
    if (!definition) throw new Error('未知设计型材截面：' + type);
    const path = options.path?.type === 'ARC'
      ? {
          type:'ARC',
          radius:Number(options.path.radius || 1000),
          angleDeg:Number(options.path.angleDeg || 90),
          plane:options.path.plane === 'YZ' ? 'YZ' : 'XZ'
        }
      : {type:'LINE', length:Number(length)};

    const part = {
      id:crypto.randomUUID(),
      displayId:this.nextDisplayId(),
      name:options.name || definition.name,
      type:'PROFILE',
      position:normalizeVector(options.position, {x:0,y:300,z:0}),
      rotation:normalizeVector(options.rotation),
      color:options.color || '#d9d9d9',
      materialFinish:'STANDARD',
      dimensions:{
        length:Number(length),
        size:definition.sectionSize[0],
        sectionSize:[...definition.sectionSize]
      },
      designProfile:{
        profileId:definition.id,
        nominal:definition.nominal,
        series:definition.series,
        slotWidth:Number(definition.slotWidth || 0),
        faceClosures:[...(options.faceClosures || definition.defaultFaceClosures || [])]
      },
      manufacturingProfile:null,
      profilePath:path,
      endCuts:structuredClone(options.endCuts || {START:{angleDeg:0,axis:'X'},END:{angleDeg:0,axis:'X'}}),
      machiningItems:[],
      assemblyId:options.assemblyId || null,
      hidden:false,
      locked:false
    };
    normalizeProfilePath(part);
    return this.insertPart(part, options);
  }

  addProfileBetweenPoints(catalogId,startPoint,endPoint,options = {}) {
    const start=toThreeVector(startPoint), end=toThreeVector(endPoint);
    const delta=end.clone().sub(start);
    const length=delta.length();
    if(length<1) throw new Error('型材起点和终点距离过小');
    const direction=delta.clone().normalize();
    const quaternion=profileQuaternion(direction,options.crossSectionUp);
    const euler=new THREE.Euler().setFromQuaternion(quaternion,'XYZ');
    const midpoint=start.clone().add(end).multiplyScalar(0.5);
    return this.addProfile(catalogId,length,{
      ...options,
      position:{x:midpoint.x,y:midpoint.y,z:midpoint.z},
      rotation:{x:euler.x,y:euler.y,z:euler.z},
      name:options.name||`绘制型材 ${getDesignProfileDefinition(catalogId)?.name||catalogId}`
    });
  }

  addShaft(diameter = 12, length = 500, options = {}) {
    const part = {
      id:crypto.randomUUID(),
      displayId:this.nextDisplayId('S'),
      name:options.name || `光轴 Ø${Number(diameter)}`,
      type:'SHAFT',
      position:normalizeVector(options.position, {x:0,y:300,z:0}),
      rotation:normalizeVector(options.rotation),
      color:options.color || '#bfc7ce',
      dimensions:{diameter:Number(diameter), length:Number(length)},
      materialSpec:{material:options.material || '45#钢', finish:options.finish || '镀铬'},
      assemblyId:options.assemblyId || null,
      hidden:false,
      locked:false
    };
    return this.insertPart(part, options);
  }

  addPanel(width = 400, height = 400, thickness = 18, options = {}) {
    const part = {
      id:crypto.randomUUID(),
      displayId:this.nextDisplayId('B'),
      name:options.name || '板材',
      type:'PANEL',
      position:normalizeVector(options.position, {x:0,y:300,z:0}),
      rotation:normalizeVector(options.rotation),
      color:options.color || '#d7b889',
      dimensions:{width:Number(width), height:Number(height), thickness:Number(thickness),...(options.shapeDimensions||{})},
      materialSpec:{material:options.material || '木饰面板'},
      assemblyId:options.assemblyId || null,
      hidden:false,
      locked:false
    };
    return this.insertPart(part, options);
  }

  addAccessory(accessoryType = 'ANGLE_BRACKET', size = 30, options = {}) {
    const part = {
      id:crypto.randomUUID(),
      displayId:this.nextDisplayId('A'),
      name:options.name || (accessoryType === 'CORNER_CUBE' ? '三维角件' : '角码'),
      type:'ACCESSORY',
      accessoryType,
      position:normalizeVector(options.position),
      rotation:normalizeVector(options.rotation),
      color:options.color || '#6f7780',
      dimensions:{size:Number(size)},
      assemblyId:options.assemblyId || null,
      hidden:false,
      locked:false,
      generatedByConnectionId:options.generatedByConnectionId || null,
      mountReference:options.mountReference ? structuredClone(options.mountReference) : null
    };
    return this.insertPart(part, options);
  }

  addHardware(catalogId, options = {}) {
    const definition = options.definition || getHardwareDefinition(catalogId);
    if (!definition) throw new Error(`未知五金件：${catalogId}`);
    const part = {
      id:crypto.randomUUID(),
      displayId:this.nextDisplayId('A'),
      name:options.name || definition.label,
      type:'ACCESSORY',
      accessoryType:definition.accessoryType,
      hardwareSku:definition.id || catalogId,
      hardwareSpec:{
        category:definition.category || '配件',
        thread:definition.thread || null,
        material:definition.material || '',
        note:definition.note || '',
        source:definition.source || 'BUILT_IN',
        catalogId:definition.catalogId || null,
        model:definition.model || definition.id || catalogId,
        unit:definition.unit || '个'
      },
      materialSpec:{material:definition.material || ''},
      position:normalizeVector(options.position),
      rotation:normalizeVector(options.rotation),
      color:options.color || definition.color || '#6f7780',
      dimensions:{...hardwareDimensions(definition)},
      assemblyId:options.assemblyId || null,
      hidden:false,
      locked:false,
      generatedByConnectionId:options.generatedByConnectionId || null,
      mountRule:definition.mountRule ? structuredClone(definition.mountRule) : null,
      mountReference:options.mountReference ? structuredClone(options.mountReference) : null
    };
    return this.insertPart(part, options);
  }

  /** 组件库统一提交入口；预览规格仍是普通描述对象，只有单击确认才创建业务构件。 */
  addCatalogComponent(definition,options={}) {
    const spec=definition?.partSpec,d=spec?.dimensions||{};
    if(spec?.type==='PANEL')return this.addPanel(d.width,d.height,d.thickness,{...options,name:definition.label,color:spec.color,material:spec.material,shapeDimensions:d});
    if(spec?.type==='SHAFT')return this.addShaft(d.diameter,d.length,{...options,name:definition.label,color:spec.color,material:spec.material});
    if(spec?.type==='PROFILE')return this.addProfile(spec.designProfile.profileId,d.length,{...options,name:definition.label,color:spec.color,faceClosures:spec.designProfile.faceClosures});
    return this.addHardware(definition.id,{...options,definition});
  }


  /**
   * 将标准配件安装到指定构件。
   *
   * <p>配件目录中的 mountRule 只描述“应该安装到哪里”，实际世界坐标由当前目标构件计算。
   * 安装结果仍然保存为普通 ACCESSORY Part，并通过 mountReference 记录宿主关系。</p>
   */
  mountHardware(catalogId, targetPartId, options = {}) {
    const definition = options.definition || getHardwareDefinition(catalogId);
    if (!definition) throw new Error(`未知五金件：${catalogId}`);

    const targetMesh = this.getMeshByPartId(targetPartId);
    const targetPart = targetMesh?.userData?.part;
    if (!targetMesh || !targetPart) throw new Error('请选择需要安装配件的目标构件');

    const rule = definition.mountRule || {};
    let targetType = String(rule.target || '').toUpperCase();
    if (definition.accessoryType === 'LEVELING_FOOT' && targetType === 'PROFILE_END') targetType = 'PROFILE_BOTTOM';
    if (['PROFILE_END','PROFILE_BOTTOM'].includes(targetType)) {
      if (targetPart.type !== 'PROFILE') throw new Error('该配件需要安装到型材端部，请先选择型材');
      const requiredNominal = String(rule.profileNominal || '').trim();
      if (requiredNominal && String(profileNominal(targetPart) || '') !== requiredNominal) {
        throw new Error(`该端盖适配 ${requiredNominal} 型材，当前选择为 ${profileNominal(targetPart) || '未知规格'}`);
      }
      return this.mountHardwareToProfileEnd(definition,targetMesh,{...options,targetType});
    }
    if (targetType === 'PANEL_SIDE') {
      if (targetPart.type !== 'PANEL') throw new Error('该配件需要安装到板材侧面，请先选择板材');
      const side = options.side || (String(rule.side || '').toUpperCase() === 'BACK' ? 'BACK' : 'FRONT');
      return this.mountHardwareToPanelSide(definition,targetMesh,{...options,side});
    }
    if(targetType==='SHAFT_AXIS') {
      if(targetPart.type!=='SHAFT')throw new Error('固定夹需要安装到相同孔径的光轴');
      if(Math.abs(Number(targetPart.dimensions.diameter)-Number(rule.diameter))>.01)throw new Error('固定夹孔径与光轴不匹配');
      const transform=this.accessoryMountManager.resolveShaftAxis(definition,targetMesh,options);
      return this.addHardware(definition.id,{...options,definition,...transform,assemblyId:targetPart.assemblyId||null});
    }

    throw new Error(`当前配件暂不支持自动安装：${rule.target || '未配置安装规则'}`);
  }

  mountHardwareToProfileEnd(definition,targetMesh,options = {}) {
    const targetPart = targetMesh.userData.part;
    const transform = this.accessoryMountManager.resolveProfileEnd(definition,targetMesh,options);
    if (!transform) throw new Error('无法计算配件端部安装位置');
    return this.addHardware(definition.id || definition.model,{
      ...options,
      definition,
      position:transform.position,
      rotation:transform.rotation,
      assemblyId:options.assemblyId ?? targetPart.assemblyId ?? null,
      mountReference:transform.mountReference
    });
  }

  mountHardwareToPanelSide(definition,targetMesh,options = {}) {
    const targetPart = targetMesh.userData.part;
    const transform = this.accessoryMountManager.resolvePanelSide(definition,targetMesh,options);
    if (!transform) throw new Error('无法计算滑轨安装位置');
    return this.addHardware(definition.id || definition.model,{
      ...options,
      definition,
      position:transform.position,
      rotation:transform.rotation,
      assemblyId:options.assemblyId ?? targetPart.assemblyId ?? null,
      mountReference:transform.mountReference
    });
  }

  /**
   * 解除标准配件的宿主安装关系。
   *
   * <p>解除后保留当前世界坐标，配件重新成为可自由移动的 ACCESSORY。</p>
   */
  detachMountedAccessory(partId) {
    const mesh = this.getMeshByPartId(partId);
    const part = mesh?.userData?.part;
    if (part?.type !== 'ACCESSORY' || !part.mountReference) return false;
    this.syncPartFromMesh(mesh);
    part.mountReference = null;
    if (mesh === this.selected && this.isMeshTransformable(mesh)) this.sceneManager.transformControls.attach(mesh);
    this.sceneManager.setSelections(this.selectedMeshes,this.selected);
    this.historyManager.capture();
    this.emitProjectChanged();
    if (this.onSelectionChanged) this.onSelectionChanged(this.selected,[...this.selectedMeshes]);
    return true;
  }

  insertPart(part, options = {}) {
    this.parts.push(part);
    this.manufacturingIdentityManager?.assignPart(part);
    const mesh = this.createPartMesh(part);
    this.meshes.push(mesh);
    this.sceneManager.scene.add(mesh);
    if (part.type === 'PROFILE') this.machiningManager.refreshProfile(mesh);
    if (options.select !== false) this.select(mesh);
    this.updateDimensions();
    this.emitStats();
    if (options.captureHistory !== false) this.historyManager.capture();
    this.emitProjectChanged();
    return mesh;
  }

  /**
   * 从零件库拖放型材时使用：创建 -> Feature Snap -> Auto Connection 作为一次用户操作提交。
   */
  placeProfileWithSnap(catalogId, length = 500, options = {}) {
    const mesh = this.addProfile(catalogId,length,{...options,captureHistory:false});
    const snap = options.snap === false ? null : this.snapManager.snap(mesh);
    if (snap) this.syncPartFromMesh(mesh);
    let autoConnection = null;
    if (this.autoConnectionEnabled && snap?.targetFace && options.autoConnect !== false) {
      autoConnection = this.autoConnectionResolver.connectFromSnap(mesh,{source:'LIBRARY_DROP'});
    }
    this.updateDimensions();
    this.emitStats();
    this.historyManager.capture();
    this.emitProjectChanged();
    if (this.onSnapChanged) this.onSnapChanged(snap || null);
    if (autoConnection?.status === 'CREATED' && this.onAutoConnectionChanged) this.onAutoConnectionChanged(autoConnection);
    return {mesh,snap,autoConnection};
  }

  createPanelFromSelectedOpening(options = {}) {
    return this.panelDoorConfigurator.createPanelFromSelection(options);
  }

  refitConfiguredPanel(partId) {
    return this.panelDoorConfigurator.refitPanel(partId);
  }

  createDoorFromSelectedOpening(options = {}) {
    return this.panelDoorConfigurator.createDoorFromSelection(options);
  }

  refitConfiguredDoor(assemblyId) {
    return this.panelDoorConfigurator.refitDoor(assemblyId);
  }

  replaceProfiles(catalogId, options = {}) {
    return this.profileReplacementManager.replace(catalogId,options);
  }

  addFrame(options = {}) {
    const catalogId = options.catalogId || 'DESIGN-3030';
    const definition = getDesignProfileDefinition(catalogId);
    if (!definition) throw new Error('框架型材型号不存在');
    const width = Math.max(100, Number(options.width || 1000));
    const depth = Math.max(100, Number(options.depth || 600));
    const height = Math.max(100, Number(options.height || 1000));
    const sx = Number(definition.sectionSize[0]);
    const sy = Number(definition.sectionSize[1]);
    const origin = normalizeVector(options.position);
    const assemblyId = crypto.randomUUID();
    const common = {select:false,captureHistory:false,assemblyId};

    const postX = (width - sx) / 2;
    const postZ = (depth - sy) / 2;
    for (const x of [-postX, postX]) {
      for (const z of [-postZ, postZ]) {
        this.addProfile(catalogId, height, {
          ...common,
          position:{x:origin.x+x,y:origin.y+height/2,z:origin.z+z},
          rotation:{x:-Math.PI/2,y:0,z:0},
          name:`框架立柱 ${definition.name}`
        });
      }
    }

    const beamWidthLength = Math.max(10, width - sx * 2);
    const beamDepthLength = Math.max(10, depth - sy * 2);
    const beamYBottom = sy / 2;
    const beamYTop = height - sy / 2;

    for (const y of [beamYBottom, beamYTop]) {
      for (const z of [-postZ, postZ]) {
        this.addProfile(catalogId, beamWidthLength, {
          ...common,
          position:{x:origin.x,y:origin.y+y,z:origin.z+z},
          rotation:{x:0,y:Math.PI/2,z:0},
          name:`框架横梁 ${definition.name}`
        });
      }
      for (const x of [-postX, postX]) {
        this.addProfile(catalogId, beamDepthLength, {
          ...common,
          position:{x:origin.x+x,y:origin.y+y,z:origin.z},
          rotation:{x:0,y:0,z:0},
          name:`框架纵梁 ${definition.name}`
        });
      }
    }

    this.assemblyManager.reconcile();
    const assembly = this.assemblyManager.get(assemblyId);
    if (assembly) assembly.name = String(options.name || 'DIY 基础空间框');
    this.updateDimensions();
    this.emitStats();
    if (options.captureHistory !== false) this.historyManager.capture();
    this.fitView();
    return assemblyId;
  }

  /**
   * 生成面向 DIY 用户的多层型材架。
   *
   * <p>该方法只生成参数化结构本体；是否自动连接由上层 DiyGenerator / AutoConnectionResolver
   * 决定，并最终统一委托 ConnectionManager 派生连接件、加工和 BOM，避免出现第二套事实来源。</p>
   */
  addLayeredRack(options = {}) {
    const catalogId = options.catalogId || 'DESIGN-3030';
    const definition = getDesignProfileDefinition(catalogId);
    if (!definition) throw new Error('多层架型材型号不存在');

    const width = Math.max(200, Number(options.width || 1000));
    const depth = Math.max(200, Number(options.depth || 600));
    const height = Math.max(300, Number(options.height || 1800));
    const levels = Math.max(2, Math.min(12, Math.round(Number(options.levels || 4))));
    const centerBeamCount = Math.max(0, Math.min(4, Math.round(Number(options.centerBeamCount || 0))));
    const sx = Number(definition.sectionSize[0]);
    const sy = Number(definition.sectionSize[1]);
    const origin = normalizeVector(options.position);
    const assemblyId = crypto.randomUUID();
    const common = {select:false, captureHistory:false, assemblyId};

    if (width <= sx * 2 || depth <= sy * 2) {
      throw new Error('外形尺寸过小，无法容纳当前型材截面');
    }

    const postX = (width - sx) / 2;
    const postZ = (depth - sy) / 2;
    for (const x of [-postX, postX]) {
      for (const z of [-postZ, postZ]) {
        this.addProfile(catalogId, height, {
          ...common,
          position:{x:origin.x + x, y:origin.y + height / 2, z:origin.z + z},
          rotation:{x:-Math.PI / 2, y:0, z:0},
          name:`多层架立柱 ${definition.name}`
        });
      }
    }

    const beamWidthLength = Math.max(10, width - sx * 2);
    const beamDepthLength = Math.max(10, depth - sy * 2);
    const bottomY = sy / 2;
    const topY = height - sy / 2;
    const levelSpan = levels <= 1 ? 0 : (topY - bottomY) / (levels - 1);

    for (let levelIndex = 0; levelIndex < levels; levelIndex++) {
      const y = bottomY + levelIndex * levelSpan;
      for (const z of [-postZ, postZ]) {
        this.addProfile(catalogId, beamWidthLength, {
          ...common,
          position:{x:origin.x, y:origin.y + y, z:origin.z + z},
          rotation:{x:0, y:Math.PI / 2, z:0},
          name:`第${levelIndex + 1}层横梁 ${definition.name}`
        });
      }
      for (const x of [-postX, postX]) {
        this.addProfile(catalogId, beamDepthLength, {
          ...common,
          position:{x:origin.x + x, y:origin.y + y, z:origin.z},
          rotation:{x:0, y:0, z:0},
          name:`第${levelIndex + 1}层纵梁 ${definition.name}`
        });
      }

      // 中间承托梁沿深度方向布置。它们属于几何支撑，不在这里宣称具体承重能力。
      for (let beamIndex = 1; beamIndex <= centerBeamCount; beamIndex++) {
        const ratio = beamIndex / (centerBeamCount + 1);
        const x = -postX + ratio * postX * 2;
        this.addProfile(catalogId, beamDepthLength, {
          ...common,
          position:{x:origin.x + x, y:origin.y + y, z:origin.z},
          rotation:{x:0, y:0, z:0},
          name:`第${levelIndex + 1}层中间承托梁${beamIndex} ${definition.name}`
        });
      }
    }

    this.assemblyManager.reconcile();
    const assembly = this.assemblyManager.get(assemblyId);
    if (assembly) assembly.name = String(options.name || 'DIY 多层型材架');
    this.updateDimensions();
    this.emitStats();
    if (options.captureHistory !== false) this.historyManager.capture();
    this.fitView();
    return assemblyId;
  }

  addDrawerGroup(options = {}) {
    const width = Math.max(120, Number(options.width || 500));
    const depth = Math.max(120, Number(options.depth || 450));
    const totalHeight = Math.max(100, Number(options.height || 600));
    const count = Math.max(1, Math.min(12, Math.round(Number(options.count || 3))));
    const gap = Math.max(0, Number(options.gap ?? 3));
    const frontThickness = Math.max(3, Number(options.frontThickness || 18));
    const boardThickness = Math.max(3, Number(options.boardThickness || 12));
    const mode = options.frontMode === 'OVERLAY' ? 'OVERLAY' : 'INSET';
    const assemblyId = crypto.randomUUID();
    const drawerHeight = (totalHeight - gap * (count - 1)) / count;
    const frontWidth = mode === 'OVERLAY' ? width + 20 : width;
    const boxHeight = Math.max(40, drawerHeight - 30);
    const startY = Number(options.position?.y || 0);
    const startX = Number(options.position?.x || 0);
    const startZ = Number(options.position?.z || 0);
    const common = {select:false,captureHistory:false,assemblyId};

    for (let index = 0; index < count; index++) {
      const yBase = startY + index * (drawerHeight + gap);
      const centerY = yBase + drawerHeight / 2;
      const drawerId = `${assemblyId}-${index + 1}`;
      this.addPanel(frontWidth, drawerHeight, frontThickness, {
        ...common,
        name:`抽屉${index + 1}-面板`,
        position:{x:startX,y:centerY,z:startZ},
        assemblyId:drawerId,
        color:options.frontColor || '#d8c1a2'
      });
      const sideDepth = Math.max(60, depth - 25);
      const sideZ = startZ - frontThickness / 2 - sideDepth / 2;
      const sideX = width / 2 - boardThickness / 2;
      for (const sign of [-1, 1]) {
        this.addPanel(sideDepth, boxHeight, boardThickness, {
          ...common,
          name:`抽屉${index + 1}-侧板`,
          position:{x:startX + sign * sideX,y:centerY,z:sideZ},
          rotation:{x:0,y:Math.PI/2,z:0},
          assemblyId:drawerId,
          color:'#caa87c'
        });
      }
      this.addPanel(Math.max(40,width - boardThickness * 2), boxHeight, boardThickness, {
        ...common,
        name:`抽屉${index + 1}-背板`,
        position:{x:startX,y:centerY,z:startZ - frontThickness - sideDepth + boardThickness / 2},
        assemblyId:drawerId,
        color:'#caa87c'
      });
      this.addPanel(Math.max(40,width - boardThickness * 2), Math.max(40,sideDepth - boardThickness * 2), boardThickness, {
        ...common,
        name:`抽屉${index + 1}-底板`,
        position:{x:startX,y:yBase + boardThickness/2 + 8,z:sideZ},
        rotation:{x:Math.PI/2,y:0,z:0},
        assemblyId:drawerId,
        color:'#b99568'
      });
      if (options.includeSlides === true) {
        const requested = Number(options.slideLength || 450);
        const supported = [350,400,450,500];
        const slideLength = supported.reduce((best,value) => Math.abs(value-requested) < Math.abs(best-requested) ? value : best, supported[0]);
        const sku = `DRAWER_SLIDE_${slideLength}`;
        const railX = Math.max(0,width / 2 + 7);
        const railY = centerY - boxHeight * 0.12;
        const railZ = startZ - frontThickness / 2 - Math.min(sideDepth,slideLength) / 2;
        for (const sign of [-1,1]) {
          this.addHardware(sku,{
            ...common,
            name:`抽屉${index + 1}-${sign < 0 ? '左' : '右'}导轨`,
            position:{x:startX + sign * railX,y:railY,z:railZ},
            assemblyId:drawerId
          });
        }
      }
    }

    this.emitStats();
    this.historyManager.capture();
    this.fitView();
    return assemblyId;
  }

  createPartMesh(part) {
    if (part.type === 'PROFILE') return this.createProfileMesh(part);
    const mesh = PrimitiveGeometryFactory.create(part);
    this.applyPartTransform(mesh, part);
    return mesh;
  }

  createProfileMesh(part) {
    normalizeProfilePath(part);
    const mesh = ProfileGeometryFactory.create(part);
    this.applyPartTransform(mesh, part);
    return mesh;
  }

  applyPartTransform(mesh, part) {
    mesh.position.set(Number(part.position?.x || 0), Number(part.position?.y || 0), Number(part.position?.z || 0));
    mesh.rotation.set(Number(part.rotation?.x || 0), Number(part.rotation?.y || 0), Number(part.rotation?.z || 0));
    mesh.userData.part = part;
  }

  restoreProject(project) {
    const loaded = ProjectSchema.load(project);
    const current = loaded.project;
    this.projectSettings = {...this.projectSettings, ...(current.manufacturing || {})};
    this.setAutoConnectionEnabled(current.editorState?.autoConnectionEnabled !== false);
    this.annotationManager.setOptions(current.editorState?.annotations || {});
    this.profileDrawTool.configure(current.editorState?.drawingDefaults || {});
    this.profileGripEditor.configure(current.editorState?.profileGripDefaults || {});
    this.setTransformSpace(current.editorState?.cadInteraction?.transformSpace || 'world');
    this.setMovementStep(current.editorState?.cadInteraction?.movementStepMm ?? 5);
    this.setRotationStep(current.editorState?.cadInteraction?.rotationStepDeg ?? 15);
    this.setTransformMoveScope(current.editorState?.cadInteraction?.moveScope || 'SINGLE');
    this.setWorkPlane(current.editorState?.cadInteraction?.workPlane || current.editorState?.drawingDefaults?.plane || 'XZ');
    this.setWorkPlaneVisible(current.editorState?.cadInteraction?.workPlaneVisible !== false);
    this.drawingSettings = {projectName:'未命名工程',revision:'A',paper:'A3',sideView:'RIGHT',...(current.editorState?.engineeringDrawing || {})};
    loadCustomSections(current.profileSections || []);
    this.clear(false);

    for (const source of current.parts || []) {
      if (source?.generatedByConnectionId) continue;
      const part = structuredClone(source);
      part.position = normalizeVector(part.position);
      part.rotation = normalizeVector(part.rotation);
      this.parts.push(part);
      if (!['PROFILE','SHAFT','PANEL','ACCESSORY'].includes(part.type)) continue;
      const mesh = this.createPartMesh(part);
      mesh.visible = part.hidden !== true;
      this.meshes.push(mesh);
      this.sceneManager.scene.add(mesh);
      if (part.type === 'PROFILE') {
        this.machiningManager.normalizeFeatures(mesh);
        this.machiningManager.refreshProfile(mesh);
      }
    }

    this.connectionManager.load(current.connections || []);
    this.constraintManager.load(current.constraints || []);
    this.assemblyManager.load(current.assemblies || []);
    this.manufacturingIdentityManager.reconcile();
    this.accessoryMountManager.refreshAll();
    this.userDimensions = structuredClone(current.dimensions || []);
    this.emitUserDimensions();
    this.annotationManager.requestRefresh();
    this.updateSequence();
    this.updateDimensions();
    this.emitStats();
    this.select(null);
    this.emitProjectChanged();
    return loaded;
  }

  loadProject(project) {
    const loaded = this.restoreProject(project);
    this.historyManager.reset();
    this.fitView();
    return loaded;
  }

  exportProject() {
    this.accessoryMountManager.refreshAll();
    this.manufacturingIdentityManager.reconcile();
    this.meshes.forEach(mesh => this.syncPartFromMesh(mesh));
    return {
      schemaVersion:CURRENT_PROJECT_SCHEMA_VERSION,
      coordinateSystem:createProjectCoordinateDescriptor(),
      manufacturing:structuredClone(this.projectSettings),
      editorState:{autosaveEnabled:true,annotations:{...this.annotationManager.options},profileDrawToolVersion:7,featureSnapVersion:3,assemblySystemVersion:2,assemblyExplodedViewVersion:1,assemblyDiagnosticsVersion:1,connectorSystemVersion:3,slotCatalogVersion:1,hardwareBomVersion:2,bomReportVersion:1,profileCollisionCheckVersion:2,profileCatalogVersion:1,accessoryCatalogVersion:2,accessoryMountingVersion:2,placementSystemVersion:1,manufacturingIdentityVersion:1,assemblyInstructionVersion:2,taggedDrawingVersion:1,connectionInstallationDiagramVersion:4,contourFrameVersion:5,assemblyPlaybackVersion:2,interactionPolishVersion:5,contourRelationVisualizationVersion:2,assemblyGuideDocumentVersion:2,cadInteractionVersion:3,cadInteraction:{transformSpace:this.transformSpace,workPlane:this.workPlaneVisualizer.plane,workPlaneVisible:this.workPlaneVisualizer.visible,movementStepMm:this.movementStepMm,rotationStepDeg:this.rotationStepDeg,moveScope:this.transformMoveScope},autoConnectorRecommendation:true,autoConnectionSystemVersion:2,connectionQuickChangeVersion:1,panelDoorConfiguratorVersion:1,profileReplacementVersion:1,designModelVersion:1,manufacturingConfigurationVersion:1,connectionAnchorVersion:1,connectionPlacementVersion:2,machiningPlacementVersion:1,autoConnectionEnabled:this.autoConnectionEnabled,machiningFeatureSystemVersion:1,machiningReferenceVersion:1,machiningCollisionCheckVersion:1,machiningRectangularPatternVersion:1,dimensionSystemVersion:2,engineeringDrawingSystemVersion:2,engineeringDrawingDxfVersion:1,profileGripEditingVersion:1,profileGripDefaults:{...this.profileGripEditor.options},engineeringDrawing:{...this.drawingSettings},drawingDefaults:{...this.profileDrawTool.options}},
      metadata:{
        version:CURRENT_APP_VERSION,
        schemaVersion:CURRENT_PROJECT_SCHEMA_VERSION,
        generator:'DIY Web'
      },
      parts:structuredClone(this.parts.filter(part => !part.generatedByConnectionId)),
      connections:this.connectionManager.export(),
      constraints:this.constraintManager.export(),
      assemblies:this.assemblyManager.export(),
      profileSections:exportCustomSections(),
      dimensions:structuredClone(this.userDimensions)
    };
  }

  clear(clearHistory = true) {
    this.assemblyPlaybackManager?.stop?.(false);
    this.contourFrameManager?.stop?.();
    this.assemblyPresentationManager?.collapse();
    this.profileGripEditor?.cancelDrag?.();
    this.profileDrawTool?.stop();
    this.connectionPlacementManager?.cancel();
    this.accessoryPlacementManager?.cancel();
    this.machiningPlacementManager?.cancel();
    this.featureHoverManager?.clear();
    this.select(null);
    for (const mesh of this.meshes) {
      this.sceneManager.scene.remove(mesh);
      this.disposePartMesh(mesh);
    }
    this.parts = [];
    this.meshes = [];
    this.userDimensions = [];
    this.dimensionStart = null;
    this.emitUserDimensions();
    this.annotationManager?.requestRefresh();
    this.connectionManager.clear();
    this.constraintManager.clear();
    this.assemblyManager.assemblies = [];
    this.sceneManager.clearMeasurement();
    this.measureStart = null;
    this.measurement = null;
    if (clearHistory) this.historyManager.reset();
    this.updateDimensions();
    this.emitStats();
  }

  select(mesh, options = {}) {
    const additive = options.additive === true;
    const toggle = options.toggle === true;
    if (!mesh) {
      if (!additive) this.selectedMeshes = [];
      this.selected = this.selectedMeshes[this.selectedMeshes.length - 1] || null;
    } else if (additive) {
      const exists = this.selectedMeshes.includes(mesh);
      if (exists && toggle) this.selectedMeshes = this.selectedMeshes.filter(item => item !== mesh);
      else if (!exists) this.selectedMeshes.push(mesh);
      this.selected = this.selectedMeshes.includes(mesh) ? mesh : (this.selectedMeshes[this.selectedMeshes.length - 1] || null);
    } else {
      this.selectedMeshes = [mesh];
      this.selected = mesh;
    }

    if (this.isMeshTransformable(this.selected)) this.sceneManager.transformControls.attach(this.selected);
    else this.sceneManager.transformControls.detach();
    this.sceneManager.setSelections(this.selectedMeshes,this.selected);
    this.profileGripEditor?.refresh(true);
    if (this.onSelectionChanged) this.onSelectionChanged(this.selected,[...this.selectedMeshes]);
  }

  selectMany(meshes = []) {
    this.selectedMeshes = [...new Set((meshes || []).filter(Boolean))];
    this.selected = this.selectedMeshes[this.selectedMeshes.length - 1] || null;
    if (this.isMeshTransformable(this.selected)) this.sceneManager.transformControls.attach(this.selected);
    else this.sceneManager.transformControls.detach();
    this.sceneManager.setSelections(this.selectedMeshes,this.selected);
    this.profileGripEditor?.refresh(true);
    if (this.onSelectionChanged) this.onSelectionChanged(this.selected,[...this.selectedMeshes]);
  }

  isMeshTransformable(mesh) {
    const part = mesh?.userData?.part;
    return !!mesh
      && !part?.mountReference
      && !this.assemblyPresentationManager?.isExploded()
      && !this.assemblyManager.isPartEffectivelyLocked(part);
  }

  setMarqueeMode(enabled) {
    const active = enabled === true;
    if (active) this.sceneManager.setLassoMode(false);
    this.sceneManager.setMarqueeMode(active);
  }

  setLassoMode(enabled) {
    const active = enabled === true;
    if (active) this.sceneManager.setMarqueeMode(false);
    this.sceneManager.setLassoMode(active);
  }

  selectByPartId(partId, options = {}) {
    const mesh = this.getMeshByPartId(partId);
    if (!mesh) return null;
    this.select(mesh,options);
    return mesh;
  }


  setTransformMode(mode) {
    if (!['translate','rotate','scale'].includes(mode)) return;
    this.sceneManager.transformControls.setMode(mode);
  }

  /** 在世界坐标与构件局部坐标之间切换 Gizmo。 */
  setTransformSpace(space = 'world') {
    this.transformSpace = this.sceneManager.setTransformSpace(space);
    return this.transformSpace;
  }

  /** 设置当前 CAD 工作平面，并同步在线绘制工具。 */
  setWorkPlane(plane = 'XZ') {
    this.workPlaneVisualizer.setPlane(plane);
    this.profileDrawTool.configure({plane:this.workPlaneVisualizer.plane});
    return this.workPlaneVisualizer.plane;
  }

  setWorkPlaneVisible(visible = true) {
    this.workPlaneVisualizer.setVisible(visible);
    return this.workPlaneVisualizer.visible;
  }

  setProjection(type) {
    this.sceneManager.setProjection(type);
  }

  toggleGrid(visible) {
    this.sceneManager.setGridVisible(visible);
  }

  toggleSnap(enabled) {
    this.snapManager.enabled = enabled !== false;
    if(!this.snapManager.enabled){this.snapManager.clearLock();this.sceneManager.clearSnapPreview();this.sceneManager.hideSnapFeedback?.();}
  }

  syncPartFromMesh(mesh) {
    const part = mesh.userData.part;
    part.position = {
      x:Number(mesh.position.x.toFixed(6)),
      y:Number(mesh.position.y.toFixed(6)),
      z:Number(mesh.position.z.toFixed(6))
    };
    part.rotation = {
      x:Number(mesh.rotation.x.toFixed(12)),
      y:Number(mesh.rotation.y.toFixed(12)),
      z:Number(mesh.rotation.z.toFixed(12))
    };
  }

  rebuildLinearProfileVisual(mesh) {
    if (!mesh?.userData?.part || mesh.userData.part.type !== 'PROFILE' || !isLinearProfile(mesh.userData.part)) return mesh;
    ProfileGeometryFactory.rebuildLinearGroup(mesh,mesh.userData.part);
    this.machiningManager.normalizeFeatures(mesh);
    this.machiningManager.refreshProfile(mesh);
    this.sceneManager.refreshSelection();
    return mesh;
  }

  setSelectedProfileLengthFromEnd(end,lengthMm) {
    const mesh=this.selected;
    if(!mesh||mesh.userData?.part?.type!=='PROFILE'||!isLinearProfile(mesh.userData.part)) throw new Error('请选择直线型材');
    const normalized=end==='START'?'START':'END';
    if(this.profileGripEditor.isEndDrivenByConstraint(mesh.userData.part.id,normalized)) throw new Error(`${normalized==='START'?'A':'B'}端已有连接/约束，不能直接拉伸`);
    const length=Number(lengthMm);
    if(!Number.isFinite(length)||length<this.profileGripEditor.options.minLengthMm) throw new Error(`长度必须 ≥ ${this.profileGripEditor.options.minLengthMm} mm`);
    this.profileGripEditor.beginProgrammatic(mesh,normalized);
    this.profileGripEditor.applyCandidateLength(length,{allowFeatureSnap:false,gridSnap:false});
    this.profileGripEditor.commitDrag();
    return mesh.userData.part;
  }

  updateSelectedGeometry(options = {}) {
    if (!this.selected) return;
    const old = this.selected;
    const part = old.userData.part;
    this.syncPartFromMesh(old);
    const index = this.meshes.indexOf(old);
    this.sceneManager.scene.remove(old);
    this.disposePartMesh(old);
    const next = this.createPartMesh(part);
    this.meshes[index] = next;
    this.sceneManager.scene.add(next);
    const selectedIndex = this.selectedMeshes.indexOf(old);
    if (selectedIndex >= 0) this.selectedMeshes[selectedIndex] = next;
    this.selected = next;
    this.sceneManager.transformControls.attach(next);
    this.sceneManager.setSelections(this.selectedMeshes,next);
    if (part.type === 'PROFILE') {
      this.machiningManager.refreshProfile(next);
      if (options.updateConnections !== false) this.connectionManager.updateConnectionsForProfile(part.id);
    }
    this.accessoryMountManager.refreshForTargets([part.id]);
    this.updateDimensions();
    this.emitStats();
    this.historyManager.capture();
    if (this.onSelectionChanged) this.onSelectionChanged(next,[...this.selectedMeshes]);
    this.emitProjectChanged();
  }

  applySelectedProfileSpec(profileId, options = {}) {
    if (!this.selected || this.selected.userData.part?.type !== 'PROFILE') return;
    const part = this.selected.userData.part;
    const definition = getDesignProfileDefinition(profileId);
    if (!definition) throw new Error('未知设计型材截面：' + profileId);
    part.name = definition.name;
    part.dimensions.sectionSize = [...definition.sectionSize];
    part.dimensions.size = definition.sectionSize[0];
    part.designProfile = {
      profileId:definition.id,
      nominal:definition.nominal,
      series:definition.series,
      slotWidth:Number(definition.slotWidth || 0),
      faceClosures:[...(options.faceClosures || part.designProfile?.faceClosures || definition.defaultFaceClosures || [])]
    };
    part.manufacturingProfile = null;
    this.updateSelectedGeometry();
  }

  updateSelectedProfileMeta(options = {}) {
    if (!this.selected || this.selected.userData.part?.type !== 'PROFILE') return;
    const part = this.selected.userData.part;
    if (Array.isArray(options.faceClosures)) part.designProfile.faceClosures = [...new Set(options.faceClosures.map(value=>String(value).toUpperCase()))];
    this.updateSelectedGeometry();
  }


  updateSelectedPath(pathOptions = {}) {
    if (!this.selected || this.selected.userData.part?.type !== 'PROFILE') return;
    const part = this.selected.userData.part;
    part.profilePath = {...(part.profilePath || {}), ...pathOptions};
    normalizeProfilePath(part);
    this.updateSelectedGeometry();
  }

  updateSelectedPrimitiveDimensions(dimensions = {}) {
    if (!this.selected) return;
    const part = this.selected.userData.part;
    if (part.type === 'PROFILE') return;
    part.dimensions = {...(part.dimensions || {}), ...dimensions};
    this.updateSelectedGeometry();
  }

  isSelectedLinear() {
    return !!this.selected && this.selected.userData.part?.type === 'PROFILE' && isLinearProfile(this.selected.userData.part);
  }

  deleteSelected() {
    const targets = this.selectedMeshes.length ? [...this.selectedMeshes] : (this.selected ? [this.selected] : []);
    if (!targets.length) return;
    const partIds = new Set(targets.map(mesh => mesh.userData.part?.id).filter(Boolean));
    for (const connection of [...this.connectionManager.connections]) {
      if (partIds.has(connection.sourceProfileId) || partIds.has(connection.targetProfileId)) this.connectionManager.removeConnection(connection.id);
    }
    for (const partId of partIds) this.constraintManager.removeForPart(partId);
    for (const mesh of targets) {
      const part = mesh.userData.part;
      this.parts = this.parts.filter(item => item !== part);
      this.meshes = this.meshes.filter(item => item !== mesh);
      this.sceneManager.scene.remove(mesh);
      this.disposePartMesh(mesh);
    }
    this.selectedMeshes = [];
    this.select(null);
    this.updateDimensions();
    this.emitStats();
    this.historyManager.capture();
    this.emitProjectChanged();
  }

  clonePart(part, offset = {x:50,y:0,z:50}) {
    const copy = structuredClone(part);
    copy.id = crypto.randomUUID();
    copy.displayId = this.nextDisplayId(copy.type === 'PROFILE' ? 'P' : copy.type === 'SHAFT' ? 'S' : copy.type === 'PANEL' ? 'B' : 'A');
    copy.position = normalizeVector(copy.position);
    copy.hidden = false;
    copy.locked = false;
    copy.generatedByConnectionId = null;
    if (copy.type === 'ACCESSORY') copy.mountReference = null;
    copy.position.x += Number(offset.x || 0);
    copy.position.y += Number(offset.y || 0);
    copy.position.z += Number(offset.z || 0);
    if (copy.type === 'PROFILE') {
      copy.machiningItems = (copy.machiningItems || [])
        .filter(item => !item.generatedByConnectionId)
        .map(item => ({...item,id:crypto.randomUUID(),generatedByConnectionId:null}));
    }
    return copy;
  }

  duplicateSelected(offset = {x:50,y:0,z:50}) {
    const targets = this.selectedMeshes.length ? [...this.selectedMeshes] : (this.selected ? [this.selected] : []);
    if (!targets.length) return null;
    for (const mesh of targets) this.syncPartFromMesh(mesh);
    const copies = [];
    for (const mesh of targets) {
      const copy = this.clonePart(mesh.userData.part,offset);
      const copyMesh = this.insertPart(copy,{select:false,captureHistory:false});
      copies.push(copyMesh);
    }
    this.selectedMeshes = copies;
    this.selected = copies[copies.length - 1] || null;
    if (this.isMeshTransformable(this.selected)) this.sceneManager.transformControls.attach(this.selected);
    this.sceneManager.setSelections(copies,this.selected);
    if (this.onSelectionChanged) this.onSelectionChanged(this.selected,[...copies]);
    this.historyManager.capture();
    this.emitProjectChanged();
    return this.selected;
  }

  duplicateArray(options = {}) {
    const targets = this.selectedMeshes.length ? [...this.selectedMeshes] : (this.selected ? [this.selected] : []);
    if (!targets.length) throw new Error('请先选择构件');
    const count = Math.max(2,Math.min(100,Math.round(Number(options.count || 2))));
    const spacing = Number(options.spacing || 100);
    const axis = ['X','Y','Z'].includes(options.axis) ? options.axis : 'X';
    const created = [];
    for (let index=1; index<count; index++) {
      const offset = {x:0,y:0,z:0};
      offset[axis.toLowerCase()] = spacing * index;
      for (const mesh of targets) {
        this.syncPartFromMesh(mesh);
        const part = this.clonePart(mesh.userData.part,offset);
        created.push(this.insertPart(part,{select:false,captureHistory:false}));
      }
    }
    if (created.length) {
      this.selectedMeshes = created;
      this.selected = created[created.length - 1];
      if (this.isMeshTransformable(this.selected)) this.sceneManager.transformControls.attach(this.selected);
      this.sceneManager.setSelections(created,this.selected);
      if (this.onSelectionChanged) this.onSelectionChanged(this.selected,[...created]);
    }
    this.historyManager.capture();
    this.emitProjectChanged();
    return created;
  }

  mirrorSelected(options = {}) {
    const targets = this.selectedMeshes.length ? [...this.selectedMeshes] : (this.selected ? [this.selected] : []);
    if (!targets.length) throw new Error('请先选择构件');
    const axis = ['X','Y','Z'].includes(options.axis) ? options.axis : 'X';
    const makeCopy = options.copy !== false;
    for (const mesh of targets) this.syncPartFromMesh(mesh);
    const box = new THREE.Box3();
    for (const mesh of targets) box.expandByObject(mesh);
    const selectionCenter = new THREE.Vector3();
    box.getCenter(selectionCenter);
    const center = options.planeMode === 'SELECTION_CENTER' ? selectionCenter : new THREE.Vector3(0,0,0);
    const created = [];
    for (const mesh of targets) {
      const source = mesh.userData.part;
      const part = makeCopy ? this.clonePart(source,{x:0,y:0,z:0}) : source;
      part.position = normalizeVector(part.position);
      const key = axis.toLowerCase();
      part.position[key] = Number((2 * center[key] - part.position[key]).toFixed(6));
      part.rotation = normalizeVector(part.rotation);
      if (axis === 'X') { part.rotation.y *= -1; part.rotation.z *= -1; }
      if (axis === 'Y') { part.rotation.x *= -1; part.rotation.z *= -1; }
      if (axis === 'Z') { part.rotation.x *= -1; part.rotation.y *= -1; }
      if (makeCopy) created.push(this.insertPart(part,{select:false,captureHistory:false}));
      else {
        mesh.position.set(part.position.x,part.position.y,part.position.z);
        mesh.rotation.set(part.rotation.x,part.rotation.y,part.rotation.z);
        mesh.updateMatrixWorld(true);
        if (part.type === 'PROFILE') this.connectionManager.updateConnectionsForProfile(part.id);
        created.push(mesh);
      }
    }
    this.selectMany(created);
    this.updateDimensions();
    this.historyManager.capture();
    this.emitProjectChanged();
    return created;
  }

  circularArray(options = {}) {
    const targets = this.selectedMeshes.length ? [...this.selectedMeshes] : (this.selected ? [this.selected] : []);
    if (!targets.length) throw new Error('请先选择构件');
    const count = Math.max(2,Math.min(100,Math.round(Number(options.count || 4))));
    const angleDeg = Number(options.angleDeg ?? 360);
    const axis = ['X','Y','Z'].includes(options.axis) ? options.axis : 'Y';
    for (const mesh of targets) this.syncPartFromMesh(mesh);
    const box = new THREE.Box3();
    for (const mesh of targets) box.expandByObject(mesh);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const baseCenter = options.centerMode === 'SELECTION_CENTER' ? center : new THREE.Vector3(0,0,0);
    const pivot = new THREE.Vector3(
      Number(options.centerX ?? baseCenter.x),
      Number(options.centerY ?? baseCenter.y),
      Number(options.centerZ ?? baseCenter.z)
    );
    const created = [];
    const axisVector = axis === 'X' ? new THREE.Vector3(1,0,0) : axis === 'Z' ? new THREE.Vector3(0,0,1) : new THREE.Vector3(0,1,0);
    const step = THREE.MathUtils.degToRad(angleDeg / count);
    for (let index = 1; index < count; index++) {
      const q = new THREE.Quaternion().setFromAxisAngle(axisVector,step * index);
      for (const mesh of targets) {
        const part = this.clonePart(mesh.userData.part,{x:0,y:0,z:0});
        const pos = new THREE.Vector3(part.position.x,part.position.y,part.position.z).sub(pivot).applyQuaternion(q).add(pivot);
        const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(part.rotation.x,part.rotation.y,part.rotation.z,'XYZ'));
        rot.premultiply(q);
        const euler = new THREE.Euler().setFromQuaternion(rot,'XYZ');
        part.position = {x:Number(pos.x.toFixed(6)),y:Number(pos.y.toFixed(6)),z:Number(pos.z.toFixed(6))};
        part.rotation = {x:Number(euler.x.toFixed(12)),y:Number(euler.y.toFixed(12)),z:Number(euler.z.toFixed(12))};
        created.push(this.insertPart(part,{select:false,captureHistory:false}));
      }
    }
    if (created.length) this.selectMany(created);
    this.updateDimensions();
    this.historyManager.capture();
    this.emitProjectChanged();
    return created;
  }

  cycleSnapCandidate(direction = 1) {
    if (!this.selected) return null;
    const before = this.selected.position.clone();
    const snap = this.snapManager.cycleCandidate(this.selected,direction);
    if (!snap) return null;
    const delta = this.selected.position.clone().sub(before);
    if (this.selectedMeshes.length > 1 && delta.lengthSq() > 0) {
      for (const mesh of this.selectedMeshes) if (mesh !== this.selected) mesh.position.add(delta);
    }
    for (const mesh of this.selectedMeshes.length ? this.selectedMeshes : [this.selected]) this.syncPartFromMesh(mesh);
    const part = this.selected.userData.part;
    if (part?.type === 'PROFILE') this.connectionManager.updateConnectionsForProfile(part.id);
    this.sceneManager.setSelections(this.selectedMeshes,this.selected);
    this.updateDimensions();
    this.historyManager.capture();
    this.emitProjectChanged();
    if (this.onSnapChanged) this.onSnapChanged(snap);
    return snap;
  }

  groupSelection() {
    if (this.selectedMeshes.length < 2) throw new Error('至少选择两个构件才能组合为组件');
    const assemblyId = this.assemblyManager.create(this.selectedMeshes.map(mesh => mesh.userData.part.id), `组件 ${this.assemblyManager.assemblies.length + 1}`);
    this.historyManager.capture();
    this.emitProjectChanged();
    return assemblyId;
  }

  ungroupSelection() {
    if (!this.selectedMeshes.length) return;
    const ids = new Set(this.selectedMeshes.map(mesh => mesh.userData.part.assemblyId).filter(Boolean));
    for (const id of ids) this.assemblyManager.dissolve(id);
    for (const mesh of this.selectedMeshes) mesh.userData.part.assemblyId = null;
    this.historyManager.capture();
    this.emitProjectChanged();
  }

  selectAssembly(assemblyId) {
    if (!assemblyId) return;
    const partIds = new Set(this.assemblyManager.partIds(assemblyId,true));
    const meshes = this.meshes.filter(mesh => partIds.has(mesh.userData.part?.id) && mesh.visible !== false);
    if (!meshes.length) return;
    this.selectedMeshes = meshes;
    this.selected = meshes[meshes.length - 1];
    if (this.isMeshTransformable(this.selected)) this.sceneManager.transformControls.attach(this.selected);
    this.sceneManager.setSelections(meshes,this.selected);
    if (this.onSelectionChanged) this.onSelectionChanged(this.selected,[...meshes]);
  }

  setAssemblyVisibility(assemblyId, visible) {
    this.assemblyPresentationManager?.collapse();
    this.assemblyManager.setHidden(assemblyId, visible === false, true);
    if (visible === false && this.selectedMeshes.some(mesh => mesh.userData.part?.hidden === true)) this.select(null);
    this.historyManager.capture();
    this.emitProjectChanged();
    this.updateDimensions();
  }

  setAssemblyLocked(assemblyId, locked) {
    this.assemblyManager.setLocked(assemblyId, locked === true, true);
    if (!this.isMeshTransformable(this.selected)) this.sceneManager.transformControls.detach();
    else this.sceneManager.transformControls.attach(this.selected);
    this.historyManager.capture();
    this.emitProjectChanged();
    this.emitStats();
  }

  dissolveAssembly(assemblyId) {
    this.assemblyPresentationManager?.collapse();
    this.assemblyManager.dissolve(assemblyId);
    this.historyManager.capture();
    this.emitProjectChanged();
  }

  createParentAssembly(assemblyIds, name = null) {
    const id = this.assemblyManager.createParent(assemblyIds, name || `总成 ${this.assemblyManager.assemblies.length + 1}`);
    this.historyManager.capture();
    this.emitProjectChanged();
    return id;
  }

  moveAssemblyInstallationStep(assemblyId, delta) {
    const assembly = this.assemblyManager.moveInstallationStep(assemblyId, delta);
    this.historyManager.capture();
    this.emitProjectChanged();
    return assembly;
  }

  setAssemblyInstallationNote(assemblyId, note) {
    const assembly = this.assemblyManager.get(assemblyId);
    if (!assembly) throw new Error('组件不存在');
    assembly.installationNote = String(note || '');
    this.historyManager.capture();
    this.emitProjectChanged();
    return assembly;
  }

  isolateAssembly(assemblyId) {
    const partIds = new Set(this.assemblyManager.partIds(assemblyId, true));
    if (!partIds.size) throw new Error('当前组件没有可隔离显示的构件');
    this.assemblyPresentationManager?.collapse();
    for (const mesh of this.meshes) {
      const visible = partIds.has(mesh.userData.part.id);
      mesh.visible = visible;
      mesh.userData.part.hidden = !visible;
    }
    for (const assembly of this.assemblyManager.assemblies) {
      const ids = this.assemblyManager.partIds(assembly.id, true);
      assembly.hidden = ids.length > 0 && ids.every(id => !partIds.has(id));
    }
    this.historyManager.capture();
    this.emitProjectChanged();
    this.updateDimensions();
    this.annotationManager.requestRefresh();
  }

  explodeAssembly(assemblyId = null, distanceMm = 160) {
    const result = this.assemblyPresentationManager.explode(assemblyId, distanceMm);
    this.select(null);
    this.annotationManager.requestRefresh();
    return result;
  }

  collapseAssemblyExplosion() {
    const changed = this.assemblyPresentationManager.collapse();
    this.annotationManager.requestRefresh();
    return changed;
  }

  getAssemblyDiagnostics() {
    return this.assemblyInspector.inspect();
  }

  focusDiagnosticIssue(issue) {
    if (!issue) return false;
    const ids = new Set(Array.isArray(issue.partIds) ? issue.partIds : []);
    if (issue.assemblyId) {
      for (const id of this.assemblyManager.partIds(issue.assemblyId,true)) ids.add(id);
    }
    if (issue.subject) {
      for (const part of this.parts) if (part.id === issue.subject || part.displayId === issue.subject) ids.add(part.id);
      const connection=(this.connectionManager?.connections||[]).find(item=>item.id===issue.subject);
      if(connection){if(connection.sourceProfileId)ids.add(connection.sourceProfileId);if(connection.targetProfileId)ids.add(connection.targetProfileId);}
      const constraint=(this.constraintManager?.constraints||[]).find(item=>item.id===issue.subject);
      if(constraint){if(constraint.sourcePartId)ids.add(constraint.sourcePartId);if(constraint.targetPartId)ids.add(constraint.targetPartId);}
    }
    const meshes = this.meshes.filter(mesh => ids.has(mesh.userData.part?.id) && mesh.visible !== false);
    if (!meshes.length) return false;
    this.selectMany(meshes);
    const box = new THREE.Box3();
    for (const mesh of meshes) box.expandByObject(mesh);
    this.sceneManager.frameBox?.(box);
    return true;
  }

  setSelectionVisibility(visible) {
    const targets = this.selectedMeshes.length ? [...this.selectedMeshes] : (this.selected ? [this.selected] : []);
    for (const mesh of targets) mesh.userData.part.hidden = visible === false;
    this.assemblyManager.refreshPartVisibility(targets.map(mesh => mesh.userData.part.id));
    if (visible === false) this.select(null);
    this.historyManager.capture();
    this.emitProjectChanged();
    this.updateDimensions();
  }

  setPartVisibility(partId, visible) {
    const mesh = this.getMeshByPartId(partId);
    if (!mesh) return;
    mesh.userData.part.hidden = visible === false;
    this.assemblyManager.refreshPartVisibility([partId]);
    if (!mesh.visible && this.selectedMeshes.includes(mesh)) this.select(null);
    this.historyManager.capture();
    this.emitProjectChanged();
    this.updateDimensions();
  }

  showAll() {
    this.assemblyPresentationManager?.collapse();
    this.assemblyManager.showAll();
    this.historyManager.capture();
    this.emitProjectChanged();
    this.updateDimensions();
    this.annotationManager.requestRefresh();
  }

  toggleSelectedLock() {
    if (!this.selected) return false;
    const targets = this.selectedMeshes.length ? this.selectedMeshes : [this.selected];
    const inheritedLock = targets.some(mesh => {
      const assemblyId = mesh.userData.part?.assemblyId;
      return assemblyId && this.assemblyManager.isAssemblyLocked(assemblyId);
    });
    if (inheritedLock) {
      this.sceneManager.transformControls.detach();
      return true;
    }
    const locked = this.selected.userData.part?.locked !== true;
    for (const mesh of targets) mesh.userData.part.locked = locked;
    if (locked || !this.isMeshTransformable(this.selected)) this.sceneManager.transformControls.detach();
    else this.sceneManager.transformControls.attach(this.selected);
    this.historyManager.capture();
    this.emitProjectChanged();
    return locked;
  }

  focusSelection() {
    const targets = this.selectedMeshes.length ? this.selectedMeshes : (this.selected ? [this.selected] : []);
    if (!targets.length) return;
    const box = new THREE.Box3();
    for (const mesh of targets) box.expandByObject(mesh);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center); box.getSize(size);
    this.sceneManager.setView('iso',center,Math.max(size.x,size.y,size.z,200)*1.8);
  }

  updateSelectedEndCuts(endCuts) {
    if (!this.selected || this.selected.userData.part?.type !== 'PROFILE' || !isLinearProfile(this.selected.userData.part)) return;
    this.selected.userData.part.endCuts = normalizeEndCuts(endCuts);
    this.updateSelectedGeometry();
  }

  setMeasureMode(enabled) {
    this.measureMode = enabled === true;
    this.measureStart = null;
    this.measurement = null;
    this.sceneManager.clearMeasurement();
    if (this.onMeasurementChanged) this.onMeasurementChanged(null);
  }

  handleMeasureClick(event) {
    const hit = this.sceneManager.pickHit(event,this.meshes.filter(item => item.visible !== false));
    if (!hit?.point) return;
    if (!this.measureStart) {
      this.measureStart = hit.point.clone();
      this.sceneManager.showSnapPoint(hit.point);
      if (this.onMeasurementChanged) this.onMeasurementChanged({state:'WAIT_END',start:toPlainPoint(hit.point)});
      return;
    }
    const start = this.measureStart.clone();
    const end = hit.point.clone();
    const delta = end.clone().sub(start);
    this.measurement = {
      state:'DONE',
      start:toPlainPoint(start),
      end:toPlainPoint(end),
      distance:Number(delta.length().toFixed(2)),
      dx:Number(Math.abs(delta.x).toFixed(2)),
      dy:Number(Math.abs(delta.y).toFixed(2)),
      dz:Number(Math.abs(delta.z).toFixed(2))
    };
    this.sceneManager.showMeasurement(start,end);
    this.measureStart = null;
    if (this.onMeasurementChanged) this.onMeasurementChanged(structuredClone(this.measurement));
  }



  setDimensionMode(enabled) {
    this.dimensionMode = enabled === true;
    this.dimensionStart = null;
    if (this.dimensionMode) this.setMeasureMode(false);
    return this.dimensionMode;
  }

  handleDimensionClick(event) {
    const hit = this.sceneManager.pickHit(event,this.meshes.filter(item => item.visible !== false));
    if (!hit?.point) return;
    const anchor = this.createDimensionAnchor(hit);
    if (!this.dimensionStart) {
      this.dimensionStart = {point:hit.point.clone(),anchor};
      this.sceneManager.showSnapPoint(hit.point);
      this.emitUserDimensions({state:'WAIT_END'});
      return;
    }
    const startState = this.dimensionStart;
    const start = startState.point.clone();
    const end = hit.point.clone();
    if (start.distanceTo(end) < 0.01) {
      this.dimensionStart = null;
      this.emitUserDimensions();
      return;
    }
    const binding = this.detectDimensionBinding(startState.anchor,anchor);
    const dimension = {
      id:crypto.randomUUID(),
      type:'LINEAR',
      start:toPlainPoint(start),
      end:toPlainPoint(end),
      anchorStart:startState.anchor,
      anchorEnd:anchor,
      binding,
      offsetWorld:{x:0,y:0,z:0},
      labelOffsetPx:{x:0,y:-16},
      text:null,
      createdAt:new Date().toISOString()
    };
    this.userDimensions.push(dimension);
    if (binding) dimension.drivingValue = this.getUserDimensionValue(dimension);
    this.dimensionStart = null;
    this.annotationManager.requestRefresh();
    this.historyManager.capture();
    this.emitUserDimensions();
    this.emitProjectChanged();
    return dimension;
  }

  createDimensionAnchor(hit) {
    const object = hit?.object;
    if (!object?.userData?.part) return {type:'WORLD',point:toPlainPoint(hit.point)};
    const part = object.userData.part;
    const local = object.worldToLocal(hit.point.clone());
    if (part.type === 'PROFILE' && isLinearProfile(part)) {
      const length = Number(part.dimensions?.length || 0);
      const tolerance = Math.max(6,Math.min(20,length * 0.02));
      if (Math.abs(local.z + length / 2) <= tolerance) return {type:'PROFILE_END',partId:part.id,end:'START'};
      if (Math.abs(local.z - length / 2) <= tolerance) return {type:'PROFILE_END',partId:part.id,end:'END'};
    }
    return {type:'LOCAL_POINT',partId:part.id,local:toPlainPoint(local)};
  }

  detectDimensionBinding(anchorStart,anchorEnd) {
    if (!anchorStart || !anchorEnd) return null;
    if (anchorStart.type !== 'PROFILE_END' || anchorEnd.type !== 'PROFILE_END') return null;
    if (!anchorStart.partId || anchorStart.partId !== anchorEnd.partId) return null;
    if (anchorStart.end === anchorEnd.end) return null;
    const part = this.parts.find(item => item.id === anchorStart.partId);
    if (!part || part.type !== 'PROFILE' || !isLinearProfile(part)) return null;
    return {type:'PROFILE_LENGTH',partId:part.id};
  }

  getUserDimensionValue(dimensionOrId) {
    const dimension = typeof dimensionOrId === 'string'
      ? this.userDimensions.find(item => item.id === dimensionOrId)
      : dimensionOrId;
    if (!dimension) return null;
    const binding = dimension.binding;
    if (binding?.type === 'PROFILE_LENGTH') {
      const part = this.parts.find(item => item.id === binding.partId);
      return part ? Number(part.dimensions?.length || 0) : null;
    }
    if (binding?.type === 'PROFILE_RADIUS') {
      const part = this.parts.find(item => item.id === binding.partId);
      return part?.profilePath?.type === 'ARC' ? Number(part.profilePath.radius || 0) : null;
    }
    if (binding?.type === 'PROFILE_ARC_ANGLE') {
      const part = this.parts.find(item => item.id === binding.partId);
      return part?.profilePath?.type === 'ARC' ? Number(part.profilePath.angleDeg || 0) : null;
    }
    if (binding?.type === 'MACHINING_STATION') {
      const part = this.parts.find(item => item.id === binding.partId);
      const machining = part?.machiningItems?.find(item => item.id === binding.machiningId);
      if (!machining) return null;
      const station = Number(machining.stationS ?? machining.distanceFromStart ?? 0);
      return binding.datumEnd === 'END' ? Number((Number(part.dimensions?.length || 0) - station).toFixed(3)) : station;
    }
    if (binding?.type === 'MACHINING_OFFSET') {
      const part = this.parts.find(item => item.id === binding.partId);
      const machining = part?.machiningItems?.find(item => item.id === binding.machiningId);
      return machining ? Number(machining.offset || 0) : null;
    }
    if (binding?.type === 'PART_AXIS_DISTANCE') {
      const source = this.parts.find(item => item.id === binding.sourcePartId);
      const target = this.parts.find(item => item.id === binding.targetPartId);
      if (!source || !target) return null;
      const axis = String(binding.axis || 'X').toLowerCase();
      return Number(Math.abs(Number(target.position?.[axis] || 0) - Number(source.position?.[axis] || 0)).toFixed(2));
    }
    if (binding?.type === 'PART_AXIS_COORDINATE') {
      const source = this.parts.find(item => item.id === binding.sourcePartId);
      const target = this.parts.find(item => item.id === binding.targetPartId);
      if (!source || !target) return null;
      const axis = String(binding.axis || 'X').toLowerCase();
      return Number((Number(target.position?.[axis] || 0) - Number(source.position?.[axis] || 0)).toFixed(2));
    }
    if (binding?.type === 'PART_CLEARANCE') {
      const start = this.resolveDimensionAnchorWorld({type:'PART_BOUNDARY',partId:binding.sourcePartId,axis:binding.axis,side:binding.sourceSide || 'MAX'});
      const end = this.resolveDimensionAnchorWorld({type:'PART_BOUNDARY',partId:binding.targetPartId,axis:binding.axis,side:binding.targetSide || 'MIN'});
      if (!start || !end) return null;
      const axis = String(binding.axis || 'X').toLowerCase();
      return Number((end[axis] - start[axis]).toFixed(2));
    }
    if (binding?.type === 'SLOT_CENTER_DISTANCE') {
      const sourcePoint = this.resolveDimensionAnchorWorld({type:'PROFILE_SLOT_CENTER',partId:binding.sourcePartId,face:binding.sourceFace,stationS:binding.sourceStationS});
      const targetPoint = this.resolveDimensionAnchorWorld({type:'PROFILE_SLOT_CENTER',partId:binding.targetPartId,face:binding.targetFace,stationS:binding.targetStationS});
      if (!sourcePoint || !targetPoint) return null;
      return Number(sourcePoint.distanceTo(targetPoint).toFixed(2));
    }
    if (binding?.type === 'PROFILE_ANGLE') {
      const sourceMesh = this.getMeshByPartId(binding.sourcePartId);
      const targetMesh = this.getMeshByPartId(binding.targetPartId);
      if (!sourceMesh || !targetMesh) return null;
      const axis = axisVector(binding.axis);
      const sourceDirection = profileWorldDirection(sourceMesh);
      const targetDirection = profileWorldDirection(targetMesh);
      return Number(Math.abs(THREE.MathUtils.radToDeg(signedAngleAroundAxis(sourceDirection,targetDirection,axis))).toFixed(2));
    }
    const start = this.resolveDimensionAnchorWorld(dimension.anchorStart) || plainToVector3(dimension.start);
    const end = this.resolveDimensionAnchorWorld(dimension.anchorEnd) || plainToVector3(dimension.end);
    if (!start || !end) return null;
    return Number(start.distanceTo(end).toFixed(2));
  }

  setUserDimensionValue(id,value) {
    const dimension = this.userDimensions.find(item => item.id === id);
    if (!dimension?.binding) return false;
    const nextValue = Number(value);
    const binding = dimension.binding;
    if (!Number.isFinite(nextValue)) throw new Error('驱动尺寸必须是有效数值');
    if (nextValue < 0 && !['MACHINING_OFFSET','PART_AXIS_COORDINATE'].includes(binding.type)) throw new Error('该驱动尺寸不能为负数');
    this.constraintManager.assertBindingAllowed(binding,dimension.id);

    if (binding.type === 'PROFILE_LENGTH') {
      if (!(nextValue > 0)) throw new Error('型材长度必须大于 0 mm');
      const part = this.parts.find(item => item.id === binding.partId);
      if (!part || part.type !== 'PROFILE' || !isLinearProfile(part)) return false;
      part.dimensions.length = nextValue;
      part.profilePath = {...(part.profilePath || {}),type:'LINE',length:nextValue};
      this.rebuildPartMesh(part.id);
    } else if (binding.type === 'PROFILE_RADIUS') {
      if (!(nextValue > 0)) throw new Error('弯曲半径必须大于 0 mm');
      const part = this.parts.find(item => item.id === binding.partId);
      if (!part || part.type !== 'PROFILE' || part.profilePath?.type !== 'ARC') return false;
      part.profilePath.radius = nextValue;
      normalizeProfilePath(part);
      this.rebuildPartMesh(part.id);
    } else if (binding.type === 'PROFILE_ARC_ANGLE') {
      if (!(nextValue > 0 && nextValue <= 360)) throw new Error('圆弧角必须在 0 ~ 360° 范围内');
      const part = this.parts.find(item => item.id === binding.partId);
      if (!part || part.type !== 'PROFILE' || part.profilePath?.type !== 'ARC') return false;
      part.profilePath.angleDeg = nextValue;
      normalizeProfilePath(part);
      this.rebuildPartMesh(part.id);
    } else if (binding.type === 'MACHINING_STATION') {
      const part = this.parts.find(item => item.id === binding.partId);
      const mesh = this.getMeshByPartId(binding.partId);
      const machining = part?.machiningItems?.find(item => item.id === binding.machiningId);
      if (!part || !mesh || !machining || machining.type === 'END_TAP') return false;
      const length = Number(part.dimensions?.length || 0);
      if (nextValue < 0 || nextValue > length) throw new Error(`孔位基准尺寸必须在 0 ~ ${length} mm 范围内`);
      const station = binding.datumEnd === 'END' ? length - nextValue : nextValue;
      machining.stationS = station;
      machining.distanceFromStart = station;
      const clusterRootId = machining.linkedHoleId || machining.id;
      for (const linked of part.machiningItems || []) {
        if (linked.id === machining.id || linked.linkedHoleId === clusterRootId || (machining.linkedHoleId && linked.id === machining.linkedHoleId)) {
          if (linked.type !== 'END_TAP') {
            linked.stationS = station;
            linked.distanceFromStart = station;
          }
        }
      }
      this.machiningManager.refreshProfile(mesh);
      this.connectionManager.updateConnectionsForProfile(part.id);
    } else if (binding.type === 'MACHINING_OFFSET') {
      const part = this.parts.find(item => item.id === binding.partId);
      const mesh = this.getMeshByPartId(binding.partId);
      const machining = part?.machiningItems?.find(item => item.id === binding.machiningId);
      if (!part || !mesh || !machining || machining.type === 'END_TAP') return false;
      const halfSpan = machiningFaceHalfSpan(part,machining.face);
      const radius = machiningEffectiveRadius(machining);
      const maxOffset = Math.max(0,halfSpan - radius);
      if (nextValue < -maxOffset || nextValue > maxOffset) throw new Error(`孔横向偏移必须在 ${Number((-maxOffset).toFixed(2))} ~ ${Number(maxOffset.toFixed(2))} mm 范围内`);
      machining.offset = nextValue;
      const clusterRootId = machining.linkedHoleId || machining.id;
      for (const linked of part.machiningItems || []) {
        if (linked.id === machining.id || linked.linkedHoleId === clusterRootId || (machining.linkedHoleId && linked.id === machining.linkedHoleId)) {
          if (linked.type !== 'END_TAP') linked.offset = nextValue;
        }
      }
      this.machiningManager.refreshProfile(mesh);
      this.connectionManager.updateConnectionsForProfile(part.id);
    } else if (binding.type === 'PART_AXIS_DISTANCE') {
      const source = this.parts.find(item => item.id === binding.sourcePartId);
      const target = this.parts.find(item => item.id === binding.targetPartId);
      const targetMesh = this.getMeshByPartId(binding.targetPartId);
      if (!source || !target || !targetMesh) return false;
      const axis = String(binding.axis || 'X').toLowerCase();
      const sourceValue = Number(source.position?.[axis] || 0);
      const targetValue = Number(target.position?.[axis] || 0);
      const sign = targetValue >= sourceValue ? 1 : -1;
      targetMesh.position[axis] += sourceValue + sign * nextValue - targetValue;
      this.syncPartFromMesh(targetMesh);
      if (target.type === 'PROFILE') this.connectionManager.updateConnectionsForProfile(target.id);
    } else if (binding.type === 'PART_AXIS_COORDINATE') {
      const source = this.parts.find(item => item.id === binding.sourcePartId);
      const target = this.parts.find(item => item.id === binding.targetPartId);
      const targetMesh = this.getMeshByPartId(binding.targetPartId);
      if (!source || !target || !targetMesh) return false;
      const axis = String(binding.axis || 'X').toLowerCase();
      const sourceValue = Number(source.position?.[axis] || 0);
      targetMesh.position[axis] += sourceValue + nextValue - Number(target.position?.[axis] || 0);
      this.syncPartFromMesh(targetMesh);
      if (target.type === 'PROFILE') this.connectionManager.updateConnectionsForProfile(target.id);
    } else if (binding.type === 'PART_CLEARANCE') {
      const target = this.parts.find(item => item.id === binding.targetPartId);
      const targetMesh = this.getMeshByPartId(binding.targetPartId);
      const current = this.getUserDimensionValue(dimension);
      if (!target || !targetMesh || !Number.isFinite(Number(current))) return false;
      const axis = String(binding.axis || 'X').toLowerCase();
      targetMesh.position[axis] += nextValue - Number(current);
      this.syncPartFromMesh(targetMesh);
      if (target.type === 'PROFILE') this.connectionManager.updateConnectionsForProfile(target.id);
    } else if (binding.type === 'SLOT_CENTER_DISTANCE') {
      const sourcePoint = this.resolveDimensionAnchorWorld({type:'PROFILE_SLOT_CENTER',partId:binding.sourcePartId,face:binding.sourceFace,stationS:binding.sourceStationS});
      const targetPoint = this.resolveDimensionAnchorWorld({type:'PROFILE_SLOT_CENTER',partId:binding.targetPartId,face:binding.targetFace,stationS:binding.targetStationS});
      const targetMesh = this.getMeshByPartId(binding.targetPartId);
      if (!sourcePoint || !targetPoint || !targetMesh) return false;
      const direction = targetPoint.clone().sub(sourcePoint);
      const current = direction.length();
      if (current < 0.001) throw new Error('槽中心距当前为 0，无法确定移动方向');
      direction.normalize();
      targetMesh.position.addScaledVector(direction,nextValue - current);
      this.syncPartFromMesh(targetMesh);
      this.connectionManager.updateConnectionsForProfile(binding.targetPartId);
    } else if (binding.type === 'PROFILE_ANGLE') {
      if (nextValue > 180) throw new Error('夹角必须在 0 ~ 180° 范围内');
      const sourceMesh = this.getMeshByPartId(binding.sourcePartId);
      const targetMesh = this.getMeshByPartId(binding.targetPartId);
      if (!sourceMesh || !targetMesh) return false;
      const axis = axisVector(binding.axis);
      const sourceDirection = profileWorldDirection(sourceMesh);
      const targetDirection = profileWorldDirection(targetMesh);
      const currentSigned = signedAngleAroundAxis(sourceDirection,targetDirection,axis);
      const sign = currentSigned < 0 ? -1 : 1;
      const desired = THREE.MathUtils.degToRad(nextValue) * sign;
      const delta = desired - currentSigned;
      const quaternion = new THREE.Quaternion().setFromAxisAngle(axis,delta);
      targetMesh.quaternion.premultiply(quaternion);
      this.syncPartFromMesh(targetMesh);
      this.connectionManager.updateConnectionsForProfile(binding.targetPartId);
    } else {
      return false;
    }

    dimension.drivingValue = nextValue;
    this.updateDimensions();
    this.annotationManager.requestRefresh();
    this.historyManager.capture();
    this.emitUserDimensions();
    this.emitProjectChanged();
    return true;
  }

  createMachiningStationDimension(partId,machiningId,options = {}) {
    const part = this.parts.find(item => item.id === partId);
    const machining = part?.machiningItems?.find(item => item.id === machiningId);
    if (!part || part.type !== 'PROFILE' || !machining || machining.type === 'END_TAP') throw new Error('当前加工项不能生成孔位驱动尺寸');
    if (machining.generatedByConnectionId) throw new Error('该孔位由参数化连接生成，请通过连接规则修改');
    const station = Number(machining.stationS ?? machining.distanceFromStart ?? 0);
    const baselineEnd = String(options.baselineEnd || options.chain?.baselineEnd || 'START').toUpperCase() === 'END' ? 'END' : 'START';
    const startAnchor = {type:'PROFILE_END',partId,end:baselineEnd};
    const endAnchor = {type:'MACHINING_STATION_POINT',partId,machiningId};
    const binding = {type:'MACHINING_STATION',partId,machiningId,datumEnd:baselineEnd};
    const existing = this.userDimensions.find(item => item.binding?.type === 'MACHINING_STATION' && item.binding.partId === partId && item.binding.machiningId === machiningId);
    if (existing) {
      existing.anchorStart = startAnchor;
      existing.binding = binding;
      existing.drivingValue = baselineEnd === 'END' ? Number(part.dimensions?.length || 0) - station : station;
      if (options.chain) existing.chain = structuredClone(options.chain);
      return existing;
    }
    this.constraintManager.assertBindingAllowed(binding);
    const start = this.resolveDimensionAnchorWorld(startAnchor);
    const end = this.resolveDimensionAnchorWorld(endAnchor);
    if (!start || !end) throw new Error('无法解析加工尺寸锚点');
    const dimension = {
      id:crypto.randomUUID(),type:'LINEAR',start:toPlainPoint(start),end:toPlainPoint(end),
      anchorStart:startAnchor,anchorEnd:endAnchor,binding,drivingValue:baselineEnd === 'END' ? Number(part.dimensions?.length || 0) - station : station,
      chain:options.chain ? structuredClone(options.chain) : null,
      offsetWorld:{x:0,y:0,z:0},labelOffsetPx:{x:0,y:-16},text:null,createdAt:new Date().toISOString()
    };
    this.userDimensions.push(dimension);
    this.annotationManager.requestRefresh();
    if (options.captureHistory !== false) {
      this.historyManager.capture();
      this.emitProjectChanged();
    }
    this.emitUserDimensions();
    return dimension;
  }

  createMachiningOffsetDimension(partId,machiningId,options = {}) {
    const part = this.parts.find(item => item.id === partId);
    const machining = part?.machiningItems?.find(item => item.id === machiningId);
    if (!part || part.type !== 'PROFILE' || !machining || machining.type === 'END_TAP') throw new Error('当前加工项不能生成横向偏移驱动尺寸');
    if (machining.generatedByConnectionId) throw new Error('该孔位由参数化连接生成，请通过连接规则修改');
    const station = Number(machining.stationS ?? machining.distanceFromStart ?? 0);
    const offset = Number(machining.offset || 0);
    const startAnchor = {type:'MACHINING_FACE_CENTER',partId,machiningId};
    const endAnchor = {type:'MACHINING_POINT',partId,machiningId};
    const binding = {type:'MACHINING_OFFSET',partId,machiningId};
    const existing = this.userDimensions.find(item => item.binding?.type === 'MACHINING_OFFSET' && item.binding.partId === partId && item.binding.machiningId === machiningId);
    if (existing) return existing;
    this.constraintManager.assertBindingAllowed(binding);
    const start = this.resolveDimensionAnchorWorld(startAnchor);
    const end = this.resolveDimensionAnchorWorld(endAnchor);
    if (!start || !end) throw new Error('无法解析孔横向偏移锚点');
    const dimension = {
      id:crypto.randomUUID(),type:'LINEAR',start:toPlainPoint(start),end:toPlainPoint(end),
      anchorStart:startAnchor,anchorEnd:endAnchor,binding,drivingValue:offset,chain:null,
      offsetWorld:{x:0,y:0,z:0},labelOffsetPx:{x:0,y:-16},text:null,createdAt:new Date().toISOString()
    };
    this.userDimensions.push(dimension);
    this.annotationManager.requestRefresh();
    if (options.captureHistory !== false) {
      this.historyManager.capture();
      this.emitProjectChanged();
    }
    this.emitUserDimensions();
    return dimension;
  }

  createMachiningBaselineChain(partId, baselineEnd = 'START') {
    const part = this.parts.find(item => item.id === partId);
    if (!part || part.type !== 'PROFILE') throw new Error('请选择需要建立孔位基准链的型材');
    const datumEnd = String(baselineEnd || 'START').toUpperCase() === 'END' ? 'END' : 'START';
    const length = Number(part.dimensions?.length || 0);
    const distanceFromDatum = item => datumEnd === 'END' ? length - Number(item.stationS ?? item.distanceFromStart ?? 0) : Number(item.stationS ?? item.distanceFromStart ?? 0);
    const items = (part.machiningItems || [])
      .filter(item => item && !String(item.type).startsWith('END_') && !item.generatedByConnectionId && !item.linkedHoleId)
      .sort((a,b) => distanceFromDatum(a) - distanceFromDatum(b));
    if (!items.length) throw new Error('当前型材没有可建立基准链的手工加工特征');
    const chainId = crypto.randomUUID();
    const created = [];
    for (let index=0; index<items.length; index++) {
      const chain = {id:chainId,mode:'BASELINE',locked:true,order:index+1,baselineEnd:datumEnd,axis:null};
      const dimension = this.createMachiningStationDimension(partId,items[index].id,{captureHistory:false,chain,baselineEnd:datumEnd});
      dimension.chain = structuredClone(chain);
      created.push(dimension);
    }
    this.annotationManager.requestRefresh();
    this.historyManager.capture();
    this.emitUserDimensions();
    this.emitProjectChanged();
    return created;
  }

  createSelectionDimensionChain(mode = 'CONTINUE', axis = 'AUTO', clearance = false) {
    const meshes = this.selectedMeshes.length >= 2
      ? this.selectedMeshes
      : this.meshes.filter(mesh => mesh.visible !== false && mesh.userData.part?.type === 'PROFILE');
    const created = clearance
      ? this.dimensionSystem.createInternalChain(meshes,{mode,axis})
      : this.dimensionSystem.createPartChain(meshes,{mode,axis,clearance:false});
    if (!created.length) throw new Error('没有生成尺寸链');
    return created;
  }

  createSelectedProfileRadiusDimension() {
    const part = this.selected?.userData?.part;
    if (!part) throw new Error('请选择弯型材');
    return this.dimensionSystem.createProfileRadiusDimension(part.id);
  }

  createSelectedProfileArcAngleDimension() {
    const part = this.selected?.userData?.part;
    if (!part) throw new Error('请选择弯型材');
    return this.dimensionSystem.createProfileArcAngleDimension(part.id);
  }

  createSelectionAxisDistanceDimension() {
    if (this.selectedMeshes.length !== 2) throw new Error('请选择两个构件');
    const [sourceMesh,targetMesh] = this.selectedMeshes;
    const sourcePart = sourceMesh.userData.part;
    const targetPart = targetMesh.userData.part;
    const delta = targetMesh.getWorldPosition(new THREE.Vector3()).sub(sourceMesh.getWorldPosition(new THREE.Vector3()));
    const axis = dominantAxis(delta);
    const startAnchor = {type:'PART_ORIGIN',partId:sourcePart.id};
    const endAnchor = {type:'PART_ORIGIN',partId:targetPart.id};
    return this.pushGeneratedDimension({
      type:'LINEAR',anchorStart:startAnchor,anchorEnd:endAnchor,
      binding:{type:'PART_AXIS_DISTANCE',sourcePartId:sourcePart.id,targetPartId:targetPart.id,axis}
    });
  }

  createSelectionSlotDistanceDimension() {
    if (this.selectedMeshes.length !== 2) throw new Error('请选择两根型材');
    const [sourceMesh,targetMesh] = this.selectedMeshes;
    const sourcePart = sourceMesh.userData.part;
    const targetPart = targetMesh.userData.part;
    if (sourcePart?.type !== 'PROFILE' || targetPart?.type !== 'PROFILE') throw new Error('槽中心距仅支持两根型材');
    const sourceStationS = Number(sourcePart.dimensions?.length || 0) / 2;
    const targetStationS = Number(targetPart.dimensions?.length || 0) / 2;
    const faces = ['FRONT','BACK','LEFT','RIGHT'];
    let best = null;
    for (const sourceFace of faces) {
      const sourcePoint = this.profileSlotCenterWorld(sourceMesh,sourcePart,sourceFace,sourceStationS);
      for (const targetFace of faces) {
        const targetPoint = this.profileSlotCenterWorld(targetMesh,targetPart,targetFace,targetStationS);
        const distance = sourcePoint.distanceTo(targetPoint);
        if (!best || distance < best.distance) best = {sourceFace,targetFace,sourcePoint,targetPoint,distance};
      }
    }
    const startAnchor = {type:'PROFILE_SLOT_CENTER',partId:sourcePart.id,face:best.sourceFace,stationS:sourceStationS};
    const endAnchor = {type:'PROFILE_SLOT_CENTER',partId:targetPart.id,face:best.targetFace,stationS:targetStationS};
    return this.pushGeneratedDimension({
      type:'LINEAR',anchorStart:startAnchor,anchorEnd:endAnchor,
      binding:{type:'SLOT_CENTER_DISTANCE',sourcePartId:sourcePart.id,targetPartId:targetPart.id,sourceFace:best.sourceFace,targetFace:best.targetFace,sourceStationS,targetStationS}
    });
  }

  createSelectionAngleDimension() {
    if (this.selectedMeshes.length !== 2) throw new Error('请选择两根型材');
    const [sourceMesh,targetMesh] = this.selectedMeshes;
    const sourcePart = sourceMesh.userData.part;
    const targetPart = targetMesh.userData.part;
    if (sourcePart?.type !== 'PROFILE' || targetPart?.type !== 'PROFILE' || !isLinearProfile(sourcePart) || !isLinearProfile(targetPart)) throw new Error('夹角驱动仅支持两根直型材');
    const sourceDirection = profileWorldDirection(sourceMesh);
    const targetDirection = profileWorldDirection(targetMesh);
    const cross = sourceDirection.clone().cross(targetDirection);
    const axis = dominantAxis(cross.lengthSq() > 1e-6 ? cross : new THREE.Vector3(0,1,0));
    return this.pushGeneratedDimension({
      type:'ANGULAR',
      anchorStart:{type:'PART_ORIGIN',partId:sourcePart.id},
      anchorEnd:{type:'PART_ORIGIN',partId:targetPart.id},
      binding:{type:'PROFILE_ANGLE',sourcePartId:sourcePart.id,targetPartId:targetPart.id,axis}
    });
  }

  pushGeneratedDimension({type='LINEAR',anchorStart,anchorEnd,binding,chain=null,layout=null,semantic=null}) {
    this.constraintManager.assertBindingAllowed(binding);
    const start = this.resolveDimensionAnchorWorld(anchorStart);
    const end = this.resolveDimensionAnchorWorld(anchorEnd);
    if (!start || !end) throw new Error('无法解析尺寸锚点');
    const dimension = {
      id:crypto.randomUUID(),type,start:toPlainPoint(start),end:toPlainPoint(end),anchorStart,anchorEnd,binding,
      drivingValue:null,chain:chain ? structuredClone(chain) : null,layout:layout ? structuredClone(layout) : {auto:true,axis:null,lane:0,side:-1},semantic,
      offsetWorld:{x:0,y:0,z:0},labelOffsetPx:{x:0,y:-16},text:null,createdAt:new Date().toISOString()
    };
    this.userDimensions.push(dimension);
    dimension.drivingValue = this.getUserDimensionValue(dimension);
    this.annotationManager.requestRefresh();
    this.historyManager.capture();
    this.emitUserDimensions();
    this.emitProjectChanged();
    return dimension;
  }

  resolveDimensionAnchorWorld(anchor) {
    if (!anchor || typeof anchor !== 'object') return null;
    if (anchor.type === 'WORLD') return plainToVector3(anchor.point);
    const mesh = this.getMeshByPartId(anchor.partId);
    if (!mesh) return null;
    const part = mesh.userData.part;
    if (anchor.type === 'PART_ORIGIN') return mesh.getWorldPosition(new THREE.Vector3());
    if (anchor.type === 'PART_BOUNDARY') {
      mesh.updateMatrixWorld(true);
      mesh.geometry?.computeBoundingBox?.();
      const localBox = mesh.geometry?.boundingBox;
      const box = localBox ? localBox.clone().applyMatrix4(mesh.matrixWorld) : new THREE.Box3().setFromObject(mesh);
      if (box.isEmpty()) return null;
      const point = box.getCenter(new THREE.Vector3());
      const axis = String(anchor.axis || 'X').toLowerCase();
      point[axis] = String(anchor.side || 'MAX').toUpperCase() === 'MIN' ? box.min[axis] : box.max[axis];
      return point;
    }
    if (anchor.type === 'PROFILE_ARC_CENTER' && part?.type === 'PROFILE' && part.profilePath?.type === 'ARC') {
      const radius = Number(part.profilePath.radius || 0);
      const local = part.profilePath.plane === 'YZ' ? new THREE.Vector3(0,radius,0) : new THREE.Vector3(radius,0,0);
      return mesh.localToWorld(local);
    }
    if (anchor.type === 'PROFILE_ARC_STATION' && part?.type === 'PROFILE' && part.profilePath?.type === 'ARC') {
      const station = Number(part.dimensions?.length || 0) * Math.min(1,Math.max(0,Number(anchor.stationRatio ?? 0.5)));
      const frame = getLocalFrameAtStation(part,station);
      return mesh.localToWorld(new THREE.Vector3(...frame.point));
    }
    if (anchor.type === 'PROFILE_END' && part?.type === 'PROFILE') {
      const station = anchor.end === 'END' ? Number(part.dimensions?.length || 0) : 0;
      const frame = getLocalFrameAtStation(part,station);
      return mesh.localToWorld(new THREE.Vector3(...frame.point));
    }
    if (anchor.type === 'LOCAL_POINT') return mesh.localToWorld(plainToVector3(anchor.local) || new THREE.Vector3());
    if (anchor.type === 'MACHINING_POINT' && part?.type === 'PROFILE') {
      const item = part.machiningItems?.find(candidate => candidate.id === anchor.machiningId);
      return item ? this.machiningPointWorld(mesh,part,item) : null;
    }
    if (anchor.type === 'MACHINING_STATION_POINT' && part?.type === 'PROFILE') {
      const item = part.machiningItems?.find(candidate => candidate.id === anchor.machiningId);
      if (!item || item.type === 'END_TAP') return null;
      const station = Number(item.stationS ?? item.distanceFromStart ?? 0);
      const frame = getLocalFrameAtStation(part,station);
      return mesh.localToWorld(new THREE.Vector3(...frame.point));
    }
    if (anchor.type === 'MACHINING_FACE_CENTER' && part?.type === 'PROFILE') {
      const item = part.machiningItems?.find(candidate => candidate.id === anchor.machiningId);
      if (!item || item.type === 'END_TAP') return null;
      const station = Number(item.stationS ?? item.distanceFromStart ?? 0);
      return this.profileSlotCenterWorld(mesh,part,item.face,station);
    }
    if (anchor.type === 'PROFILE_SLOT_CENTER' && part?.type === 'PROFILE') {
      return this.profileSlotCenterWorld(mesh,part,anchor.face,Number(anchor.stationS || 0));
    }
    return null;
  }

  machiningPointWorld(mesh,part,item) {
    const length = Number(part.dimensions?.length || 0);
    if (item.type === 'END_TAP') {
      const station = item.end === 'END' ? length : 0;
      const frame = getLocalFrameAtStation(part,station);
      return mesh.localToWorld(new THREE.Vector3(...frame.point));
    }
    const station = Number(item.stationS ?? item.distanceFromStart ?? 0);
    const frame = getLocalFrameAtStation(part,station);
    const local = new THREE.Vector3(...frame.point);
    const [width,height] = part.dimensions?.sectionSize || [30,30];
    const offset = Number(item.offset || 0);
    let sectionOffset;
    if (item.face === 'FRONT') sectionOffset = new THREE.Vector3(offset,height/2,0);
    else if (item.face === 'BACK') sectionOffset = new THREE.Vector3(offset,-height/2,0);
    else if (item.face === 'RIGHT') sectionOffset = new THREE.Vector3(width/2,offset,0);
    else sectionOffset = new THREE.Vector3(-width/2,offset,0);
    sectionOffset.applyQuaternion(frameRotationQuaternionForEditor(frame.rotation));
    return mesh.localToWorld(local.add(sectionOffset));
  }

  profileSlotCenterWorld(mesh,part,face,stationS) {
    const frame = getLocalFrameAtStation(part,stationS);
    const local = new THREE.Vector3(...frame.point);
    const [width,height] = part.dimensions?.sectionSize || [30,30];
    let sectionOffset;
    if (face === 'FRONT') sectionOffset = new THREE.Vector3(0,height/2,0);
    else if (face === 'BACK') sectionOffset = new THREE.Vector3(0,-height/2,0);
    else if (face === 'RIGHT') sectionOffset = new THREE.Vector3(width/2,0,0);
    else sectionOffset = new THREE.Vector3(-width/2,0,0);
    sectionOffset.applyQuaternion(frameRotationQuaternionForEditor(frame.rotation));
    return mesh.localToWorld(local.add(sectionOffset));
  }

  rebuildPartMesh(partId, options = {}) {
    const old = this.getMeshByPartId(partId);
    if (!old) return null;
    const part = old.userData.part;
    this.syncPartFromMesh(old);
    const index = this.meshes.indexOf(old);
    const selectedIndex = this.selectedMeshes.indexOf(old);
    const wasPrimary = this.selected === old;
    this.sceneManager.scene.remove(old);
    this.disposePartMesh(old);
    const next = this.createPartMesh(part);
    next.visible = part.hidden !== true;
    this.meshes[index] = next;
    this.sceneManager.scene.add(next);
    if (selectedIndex >= 0) this.selectedMeshes[selectedIndex] = next;
    if (wasPrimary) this.selected = next;
    if (part.type === 'PROFILE') {
      this.machiningManager.refreshProfile(next);
      this.connectionManager.updateConnectionsForProfile(part.id);
    }
    if (this.isMeshTransformable(this.selected)) this.sceneManager.transformControls.attach(this.selected);
    else this.sceneManager.transformControls.detach();
    this.sceneManager.setSelections(this.selectedMeshes,this.selected);
    this.updateDimensions();
    this.emitStats();
    this.annotationManager.requestRefresh();
    if (this.onSelectionChanged && wasPrimary) this.onSelectionChanged(this.selected,[...this.selectedMeshes]);
    return next;
  }

  removeUserDimension(id) {
    const before = this.userDimensions.length;
    this.userDimensions = this.userDimensions.filter(item => item.id !== id);
    if (this.userDimensions.length === before) return false;
    this.annotationManager.requestRefresh();
    this.historyManager.capture();
    this.emitUserDimensions();
    this.emitProjectChanged();
    return true;
  }

  clearUserDimensions() {
    if (!this.userDimensions.length) return;
    this.userDimensions = [];
    this.annotationManager.requestRefresh();
    this.historyManager.capture();
    this.emitUserDimensions();
    this.emitProjectChanged();
  }

  updateUserDimension(id,patch = {}) {
    const dimension = this.userDimensions.find(item => item.id === id);
    if (!dimension) return null;
    Object.assign(dimension,structuredClone(patch));
    this.annotationManager.requestRefresh();
    this.historyManager.capture();
    this.emitUserDimensions();
    this.emitProjectChanged();
    return dimension;
  }

  setAnnotationOptions(options = {}) {
    return this.annotationManager.setOptions(options);
  }

  setFeatureSelectionMode(enabled) {
    return this.featureSelectionManager.setEnabled(enabled);
  }

  clearFeatureSelection() {
    this.featureSelectionManager.clear();
  }

  createMateFromSelectedFeatures(options = {}) {
    const features = this.featureSelectionManager.features;
    if (features.length !== 2) throw new Error('请依次选择两个需要配合的几何特征');
    const sourceFeature = features[0], targetFeature = features[1];
    if (sourceFeature.partId === targetFeature.partId) throw new Error('不能在同一根型材内部建立装配配合');
    const source = this.getMeshByPartId(sourceFeature.partId), target = this.getMeshByPartId(targetFeature.partId);
    if (!source || !target) throw new Error('配合构件不存在');
    source.updateMatrixWorld(true); target.updateMatrixWorld(true);

    let mateKind = String(options.mateKind || 'AUTO').toUpperCase();
    if (mateKind === 'AUTO') {
      if (sourceFeature.type === 'PROFILE_END' && targetFeature.type === 'PROFILE_END') mateKind='END_COINCIDENT';
      else if (sourceFeature.type === 'PROFILE_SLOT' && targetFeature.type === 'PROFILE_SLOT') mateKind='SLOT_TO_SLOT';
      else if (sourceFeature.type === 'PROFILE_END' && ['PROFILE_FACE','PROFILE_SLOT'].includes(targetFeature.type)) mateKind=targetFeature.type==='PROFILE_SLOT'?'SLOT_CENTER':'COINCIDENT';
      else mateKind='COINCIDENT';
    }
    mateKind=normalizeConstraintKind(mateKind);
    const offsetMm=Number(options.offsetMm||0), angleDeg=Number(options.angleDeg??90), flipped=options.flipped===true, autoAlign=options.autoAlign!==false;
    const targetPoint=featureWorldPoint(this,targetFeature);
    if (!targetPoint) throw new Error('无法解析目标特征位置');

    if (mateKind === 'DISTANCE') {
      if (sourceFeature.type==='PROFILE_FACE' && targetFeature.type==='PROFILE_FACE') {
        const sourceNormal=this.snapManager.faceNormal(source,sourceFeature.face).normalize();
        const targetNormal=this.snapManager.faceNormal(target,targetFeature.face).normalize();
        if(autoAlign)alignVector(source,sourceNormal,targetNormal.clone().multiplyScalar(flipped?1:-1));
        translateFeatureTo(this,source,sourceFeature,targetPoint.clone().add(targetNormal.multiplyScalar(offsetMm)));
      } else if (sourceFeature.type==='PROFILE_END' && ['PROFILE_FACE','PROFILE_SLOT'].includes(targetFeature.type)) {
        const targetNormal=this.snapManager.faceNormal(target,targetFeature.face).normalize();
        if(autoAlign)alignVector(source,endAxis(source,sourceFeature.end),targetNormal.clone().multiplyScalar(flipped?1:-1));
        translateFeatureTo(this,source,sourceFeature,targetPoint.clone().add(targetNormal.multiplyScalar(offsetMm)));
      } else {
        const sourcePoint=featureWorldPoint(this,sourceFeature);
        if(!sourcePoint)throw new Error('无法解析源特征位置');
        const direction=sourcePoint.clone().sub(targetPoint);
        if(direction.lengthSq()<1e-10)direction.copy(profileAxis(target));
        direction.normalize();
        translateFeatureTo(this,source,sourceFeature,targetPoint.clone().add(direction.multiplyScalar(Math.abs(offsetMm))));
      }
    } else if (mateKind === 'SLIDER' || mateKind === 'REVOLUTE' || mateKind === 'CYLINDRICAL') {
      const axis=profileAxis(target).multiplyScalar(flipped?-1:1).normalize();
      if (autoAlign) alignVector(source,profileAxis(source),axis);
      const sourcePoint=featureWorldPoint(this,sourceFeature);
      if (!sourcePoint) throw new Error('无法解析源特征位置');
      if (mateKind === 'REVOLUTE') {
        translateFeatureTo(this,source,sourceFeature,targetPoint.clone().add(axis.clone().multiplyScalar(offsetMm)));
      } else {
        const delta=targetPoint.clone().sub(sourcePoint);
        const radial=delta.clone().addScaledVector(axis,-delta.dot(axis));
        source.position.add(radial);
      }
    } else if (mateKind === 'ANGLE') {
      if (autoAlign) {
        const targetAxis=profileAxis(target).normalize();
        const seed=Math.abs(targetAxis.x)<0.8?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0);
        const perpendicular=seed.addScaledVector(targetAxis,-seed.dot(targetAxis)).normalize();
        const radians=THREE.MathUtils.degToRad(THREE.MathUtils.clamp(angleDeg,0,180));
        const desired=targetAxis.clone().multiplyScalar(Math.cos(radians)).add(perpendicular.multiplyScalar(Math.sin(radians))).normalize();
        if(flipped)desired.multiplyScalar(-1);
        alignVector(source,profileAxis(source),desired);
      }
    } else if (mateKind === 'END_COINCIDENT') {
      if (sourceFeature.type!=='PROFILE_END' || targetFeature.type!=='PROFILE_END') throw new Error('端面对接需要选择两根型材的 A/B 端');
      if (autoAlign) alignVector(source,endAxis(source,sourceFeature.end),endAxis(target,targetFeature.end).multiplyScalar(flipped?1:-1));
      const axis=endAxis(target,targetFeature.end).multiplyScalar(flipped?-1:1);
      translateFeatureTo(this,source,sourceFeature,targetPoint.clone().add(axis.multiplyScalar(offsetMm)));
    } else if (mateKind === 'SLOT_TO_SLOT') {
      if (sourceFeature.type!=='PROFILE_SLOT' || targetFeature.type!=='PROFILE_SLOT') throw new Error('槽对槽需要依次选择两个槽中心');
      if (autoAlign) alignVector(source,profileAxis(source),profileAxis(target).multiplyScalar(flipped?-1:1));
      translateFeatureTo(this,source,sourceFeature,targetPoint.clone().add(profileAxis(target).multiplyScalar(offsetMm)));
    } else if (mateKind === 'COAXIAL') {
      if (autoAlign) alignVector(source,profileAxis(source),profileAxis(target).multiplyScalar(flipped?-1:1));
      translateFeatureTo(this,source,sourceFeature,targetPoint.clone().add(profileAxis(target).multiplyScalar(offsetMm)));
    } else if (mateKind === 'COPLANAR') {
      if (sourceFeature.type!=='PROFILE_FACE' || targetFeature.type!=='PROFILE_FACE') throw new Error('共面约束需要依次选择两个型材面');
      const sourceNormal=this.snapManager.faceNormal(source,sourceFeature.face).normalize();
      const targetNormal=this.snapManager.faceNormal(target,targetFeature.face).normalize();
      if (autoAlign) alignVector(source,sourceNormal,targetNormal.clone().multiplyScalar(flipped?1:-1));
      translateFeatureTo(this,source,sourceFeature,targetPoint.clone().add(targetNormal.multiplyScalar(offsetMm)));
    } else if (mateKind === 'PARALLEL' || mateKind === 'PERPENDICULAR') {
      const a=profileAxis(source), b=profileAxis(target);
      if (autoAlign) {
        let desired=b.clone();
        if (mateKind==='PERPENDICULAR') {
          const candidate=new THREE.Vector3(1,0,0).cross(b);
          if (candidate.lengthSq()<1e-6) candidate.set(0,1,0).cross(b);
          desired=candidate.normalize();
        }
        if (flipped) desired.multiplyScalar(-1);
        alignVector(source,a,desired);
      }
      if (Math.abs(offsetMm)>1e-9) source.position.add(profileAxis(target).multiplyScalar(offsetMm));
    } else {
      if (sourceFeature.type!=='PROFILE_END' || !['PROFILE_FACE','PROFILE_SLOT'].includes(targetFeature.type)) throw new Error('面贴合/距离/端面垂直需要“型材端部 + 目标面/槽”');
      let sourceAxis=endAxis(source,sourceFeature.end);
      const targetNormal=this.snapManager.faceNormal(target,targetFeature.face).normalize();
      const desiredAxis=targetNormal.clone().multiplyScalar(flipped?1:-1);
      if (autoAlign) alignVector(source,sourceAxis,desiredAxis);
      else if (Math.abs(sourceAxis.dot(targetNormal))<0.82) throw new Error('源型材轴线与目标面不垂直；可开启自动对齐');
      translateFeatureTo(this,source,sourceFeature,targetPoint.clone().add(targetNormal.multiplyScalar(offsetMm)));
    }

    source.updateMatrixWorld(true); this.syncPartFromMesh(source);
    source.userData.lastSnap={type:'EXPLICIT_FEATURE_MATE',targetProfileId:targetFeature.partId,sourceEnd:sourceFeature.end||null,targetFace:targetFeature.face||null,slot:targetFeature.type==='PROFILE_SLOT'?'CENTER':null,explicitFeatureMate:true};
    const constraint=this.constraintManager.createRigidMateFromLastSnap(source,{label:`${sourceFeature.displayId} ↔ ${targetFeature.displayId} · ${constraintKindLabel(mateKind)}`,mateKind,offsetMm,angleDeg,flipped,semantic:{sourceFeature:stripWorldPoint(sourceFeature),targetFeature:stripWorldPoint(targetFeature),autoAlign,distanceMode:mateKind==='DISTANCE'?(sourceFeature.type==='PROFILE_FACE'&&targetFeature.type==='PROFILE_FACE'?'FACE_TO_FACE':(sourceFeature.type==='PROFILE_END'&&['PROFILE_FACE','PROFILE_SLOT'].includes(targetFeature.type)?'END_TO_FACE':'POINT_TO_POINT')):null},solverVersion:9,solverMode:'SEMANTIC'});
    constraint.solverVersion=9; constraint.solverMode='SEMANTIC'; constraint.status='SOLVED'; constraint.suppressed=false;
    this.connectionManager.updateConnectionsForProfile(sourceFeature.partId);
    this.updateDimensions(); this.annotationManager.requestRefresh(); this.historyManager.capture(); this.emitProjectChanged(); this.featureSelectionManager.clear();
    return constraint;
  }

  getConstraintDiagnostics() {
    return this.constraintManager.diagnose(this.userDimensions);
  }

  emitUserDimensions(state = null) {
    if (this.onUserDimensionsChanged) this.onUserDimensionsChanged(structuredClone(this.userDimensions),state);
  }

  refreshProfilesForCatalog(catalogId) {
    const selectedPartId = this.selected?.userData?.part?.id || null;
    for (let index = 0; index < this.meshes.length; index++) {
      const old = this.meshes[index];
      const part = old.userData.part;
      if (part.type !== 'PROFILE' || part.designProfile?.profileId !== catalogId) continue;
      this.syncPartFromMesh(old);
      this.sceneManager.scene.remove(old);
      this.disposePartMesh(old);
      const next = this.createProfileMesh(part);
      this.meshes[index] = next;
      this.sceneManager.scene.add(next);
      this.machiningManager.refreshProfile(next);
    }
    if (selectedPartId) this.select(this.getMeshByPartId(selectedPartId));
    this.updateDimensions();
    this.emitStats();
    this.historyManager.capture();
  }

  selectableMeshes() {
    return this.meshes.filter(mesh => mesh.visible !== false && this.matchesSelectionFilter(mesh.userData.part));
  }

  matchesSelectionFilter(part) {
    if (!part || this.selectionFilter === 'ALL') return true;
    if (this.selectionFilter === 'PRIMITIVE') return ['SHAFT','PANEL'].includes(part.type);
    return part.type === this.selectionFilter;
  }

  setSelectionFilter(filter = 'ALL') {
    const value = ['ALL','PROFILE','SHAFT','PANEL','ACCESSORY','PRIMITIVE'].includes(filter) ? filter : 'ALL';
    this.selectionFilter = value;
    if (this.selected && !this.matchesSelectionFilter(this.selected.userData.part)) this.select(null);
    return value;
  }

  createConstraintFromLastSnap() {
    if (!this.selected) throw new Error('请先选择已经吸附的构件');
    const constraint = this.constraintManager.createRigidMateFromLastSnap(this.selected);
    this.historyManager.capture();
    this.emitProjectChanged();
    return constraint;
  }

  setConstraintSuppressed(constraintId,suppressed = true) {
    const constraint = this.constraintManager.setSuppressed(constraintId,suppressed);
    if (!constraint) return null;
    this.updateDimensions();
    this.annotationManager.requestRefresh();
    this.historyManager.capture();
    this.emitProjectChanged();
    return constraint;
  }

  applyConstraintSuppressionSuggestion() {
    const suggestion=this.constraintManager.lastSystemReport?.recommendation;
    if(!suggestion?.constraintId) throw new Error('当前没有可应用的约束抑制建议');
    const constraint=this.constraintManager.setSuppressed(suggestion.constraintId,true);
    if(!constraint) throw new Error('建议约束不存在');
    const changed=[constraint.targetPartId,constraint.sourcePartId].filter(Boolean);
    if(changed.length) this.constraintManager.solveForChangedParts(changed);
    this.updateDimensions(); this.annotationManager.requestRefresh(); this.historyManager.capture(); this.emitProjectChanged();
    return {constraint,suggestion};
  }

  isolateSelection() {
    const targets = this.selectedMeshes.length ? this.selectedMeshes : (this.selected ? [this.selected] : []);
    if (!targets.length) throw new Error('请先选择需要隔离显示的构件');
    this.assemblyPresentationManager?.collapse();
    const ids = new Set(targets.map(mesh => mesh.userData.part.id));
    for (const mesh of this.meshes) {
      const visible = ids.has(mesh.userData.part.id);
      mesh.visible = visible;
      mesh.userData.part.hidden = !visible;
    }
    for (const assembly of this.assemblyManager.assemblies) {
      const assemblyPartIds = this.assemblyManager.partIds(assembly.id, true);
      assembly.hidden = assemblyPartIds.length > 0 && assemblyPartIds.every(id => !ids.has(id));
    }
    this.historyManager.capture(); this.emitProjectChanged(); this.updateDimensions(); this.annotationManager.requestRefresh();
  }

  removeConstraint(constraintId) {
    this.constraintManager.remove(constraintId);
    this.historyManager.capture();
    this.emitProjectChanged();
  }

  removePartByIdSilently(partId) {
    const mesh = this.getMeshByPartId(partId);
    if (!mesh) {
      this.parts = this.parts.filter(part => part.id !== partId);
      return;
    }
    const part = mesh.userData.part;
    this.parts = this.parts.filter(item => item !== part);
    this.meshes = this.meshes.filter(item => item !== mesh);
    this.selectedMeshes = this.selectedMeshes.filter(item => item !== mesh);
    if (this.selected === mesh) this.selected = this.selectedMeshes[this.selectedMeshes.length - 1] || null;
    this.sceneManager.scene.remove(mesh);
    this.disposePartMesh(mesh);
  }

  getMeshByPartId(id) {
    return this.meshes.find(mesh => mesh.userData.part.id === id) || null;
  }

  updateSequence() {
    let max = 0;
    for (const part of this.parts) {
      const match = /^(?:P|S|B|A)-(\d+)$/.exec(part.displayId || '');
      if (match) max = Math.max(max, Number(match[1]));
    }
    this.partSequence = max + 1;
  }

  nextDisplayId(prefix = 'P') {
    return `${prefix}-${String(this.partSequence++).padStart(3,'0')}`;
  }

  updateDimensions() {
    const profileMeshes = this.meshes.filter(mesh => mesh.userData.part?.type === 'PROFILE');
    if (!profileMeshes.length) {
      this.emitDimensions(0,0,0);
      return;
    }
    const box = new THREE.Box3();
    let initialized = false;
    for (const mesh of profileMeshes) {
      mesh.updateMatrixWorld(true);
      const current = new THREE.Box3().setFromObject(mesh);
      if (!initialized) {
        box.copy(current);
        initialized = true;
      } else {
        box.union(current);
      }
    }
    const size = new THREE.Vector3();
    box.getSize(size);
    this.emitDimensions(Math.round(size.x), Math.round(size.z), Math.round(size.y));
  }

  emitDimensions(width, depth, height) {
    if (this.onDimensionsChanged) this.onDimensionsChanged({width,depth,height});
    this.annotationManager?.requestRefresh();
  }

  emitStats() {
    const stats = {
      profiles:this.parts.filter(part => part.type === 'PROFILE').length,
      shafts:this.parts.filter(part => part.type === 'SHAFT').length,
      panels:this.parts.filter(part => part.type === 'PANEL').length,
      accessories:this.parts.filter(part => part.type === 'ACCESSORY').length,
      machining:this.parts.reduce((total,part) => total + (part.machiningItems || []).length,0),
      connections:this.connectionManager.connections.length,
      total:this.parts.length
    };
    if (this.onStatsChanged) this.onStatsChanged(stats);
  }

  getCenterAndSize() {
    const visibleMeshes = this.meshes.filter(mesh => mesh.visible !== false);
    const candidates = visibleMeshes.length ? visibleMeshes : this.meshes;
    if (!candidates.length) return {center:new THREE.Vector3(0,500,0), max:1200};
    const box = new THREE.Box3();
    for (const mesh of candidates) box.expandByObject(mesh);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    return {center,max:Math.max(size.x,size.y,size.z,500),radius:size.length()/2};
  }

  fitView() {
    const {center,max,radius} = this.getCenterAndSize();
    const manager=this.sceneManager;
    const aspect=Math.max(.1,manager.container.clientWidth/Math.max(1,manager.container.clientHeight));
    const paddedRadius=Math.max(radius||max*.866,250)*1.2;
    if(manager.camera.isOrthographicCamera){
      manager.camera.zoom=2200/(2*paddedRadius/Math.min(1,aspect));
      manager.resize();
    }
    // 按包围球及较小视场角适配实际画布，窄画布也不能裁掉框架。
    const verticalHalfFov=THREE.MathUtils.degToRad(manager.perspectiveCamera.fov/2);
    const halfFov=Math.min(verticalHalfFov,Math.atan(Math.tan(verticalHalfFov)*aspect));
    const distance=paddedRadius/Math.sin(halfFov);
    this.sceneManager.setView('iso',center,distance/Math.hypot(.78,.62,.78));
  }

  viewDirection(direction) { const {center,max}=this.getCenterAndSize(); this.sceneManager.setView(direction,center,max*1.65); }
  viewIso() { const {center,max}=this.getCenterAndSize(); this.sceneManager.setView('iso',center,max*1.65); }
  viewFront() { const {center,max}=this.getCenterAndSize(); this.sceneManager.setView('front',center,max*1.65); }
  viewBack() { const {center,max}=this.getCenterAndSize(); this.sceneManager.setView('back',center,max*1.65); }
  viewLeft() { const {center,max}=this.getCenterAndSize(); this.sceneManager.setView('left',center,max*1.65); }
  viewRight() { const {center,max}=this.getCenterAndSize(); this.sceneManager.setView('right',center,max*1.65); }
  viewTop() { const {center,max}=this.getCenterAndSize(); this.sceneManager.setView('top',center,max*1.65); }
  viewBottom() { const {center,max}=this.getCenterAndSize(); this.sceneManager.setView('bottom',center,max*1.65); }

  capturePng() {
    this.sceneManager.capturePng('DIY-铝型材设计.png');
  }

  setAutoConnectionEnabled(enabled) {
    this.autoConnectionEnabled = enabled !== false;
    this.autoConnectionResolver?.setEnabled(this.autoConnectionEnabled);
    return this.autoConnectionEnabled;
  }

  autoConnectProfiles(profileIds = [], options = {}) {
    const result = this.autoConnectionResolver.connectProfileSet(profileIds,options);
    if (result.createdCount > 0) {
      this.emitStats();
      this.emitProjectChanged();
    }
    return result;
  }

  /**
   * 扫描已有型材并补全当前几何上能够明确判断的设计连接。
   *
   * 这是用户主动执行的一次性命令，因此不受“新建构件自动连接”开关影响；
   * 命令只读取现有接触关系，不移动型材，也不会覆盖已存在的手工连接。
   */
  completeProfileConnections(options = {}) {
    const requestedIds = Array.isArray(options.profileIds) && options.profileIds.length
      ? new Set(options.profileIds)
      : null;
    const profileIds = this.parts
      .filter(part => part.type === 'PROFILE' && (!requestedIds || requestedIds.has(part.id)))
      .map(part => part.id);
    const result = this.autoConnectProfiles(profileIds,{
      ...options,
      force:true,
      source:options.source || 'MANUAL_SCAN'
    });
    if (result.createdCount > 0 && options.captureHistory !== false) this.historyManager.capture();
    return {...result,profileCount:profileIds.length,overview:this.getConnectionOverview()};
  }

  /**
   * 清除纯自动连接，保留手工创建或已经人工切换过方案的连接。
   */
  clearAutoGeneratedConnections(options = {}) {
    const result = this.autoConnectionResolver.clearGeneratedConnections();
    if (result.removedCount > 0) {
      this.emitStats();
      if (options.captureHistory !== false) this.historyManager.capture();
      this.emitProjectChanged();
    }
    return result;
  }

  getConnectionOverview() {
    return this.autoConnectionResolver.connectionOverview();
  }

  createConnectionFromLastSnap(source, options = {}) {
    const snap = source?.userData.lastSnap;
    if (!snap) throw new Error('当前型材没有有效吸附目标');
    if (!snap.targetFace) throw new Error('当前为端点吸附，无法自动判断侧面加工位置');
    const target = this.getMeshByPartId(snap.targetProfileId);
    return this.connectionManager.createConnection(source,target,{
      ...options,
      sourceEnd:snap.sourceEnd,
      targetFace:snap.targetFace
    });
  }

  smartConnectSelected(options = {}) {
    if (!this.selected || this.selected.userData.part?.type !== 'PROFILE') throw new Error('请选择已经吸附的型材');
    const connection = this.createConnectionFromLastSnap(this.selected,options);
    this.emitStats();
    this.historyManager.capture();
    return connection;
  }

  smartConnectRecommendedSelected(options = {}) {
    if (!this.selected || this.selected.userData.part?.type !== 'PROFILE') throw new Error('请选择已经吸附的型材');
    const snap=this.selected.userData.lastSnap;
    if(!snap?.targetProfileId || !snap?.targetFace)throw new Error('当前型材没有可用于自动连接的侧面/槽吸附关系');
    const target=this.getMeshByPartId(snap.targetProfileId);
    const connection=this.connectionManager.createRecommendedConnection(this.selected,target,{...options,sourceEnd:snap.sourceEnd,targetFace:snap.targetFace});
    this.emitStats();
    this.historyManager.capture();
    return connection;
  }

  emitProjectChanged() {
    this.manufacturingIdentityManager?.reconcile();
    this.annotationManager?.requestRefresh();
    this.interferenceFeedbackManager?.requestRefresh();
    if (this.onProjectChanged) this.onProjectChanged({parts:this.parts,connections:this.connectionManager.connections,constraints:this.constraintManager.constraints,dimensions:this.userDimensions});
  }

  buildAssemblyInstructions() {
    return this.assemblyInstructionGenerator.build();
  }

  startAssemblyPlayback(options = {}) {
    return this.assemblyPlaybackManager.start(this.buildAssemblyInstructions(),options);
  }

  showAssemblyPlaybackStep(index, options = {}) {
    const steps=this.buildAssemblyInstructions();
    if(this.assemblyPlaybackManager.steps!==steps)this.assemblyPlaybackManager.load(steps);
    return this.assemblyPlaybackManager.show(index,options);
  }

  nextAssemblyPlaybackStep() {
    if(!this.assemblyPlaybackManager.steps.length)this.assemblyPlaybackManager.load(this.buildAssemblyInstructions());
    return this.assemblyPlaybackManager.next();
  }

  previousAssemblyPlaybackStep() {
    if(!this.assemblyPlaybackManager.steps.length)this.assemblyPlaybackManager.load(this.buildAssemblyInstructions());
    return this.assemblyPlaybackManager.previous();
  }

  pauseAssemblyPlayback() {
    this.assemblyPlaybackManager.pause();
    return this.assemblyPlaybackManager.state();
  }

  stopAssemblyPlayback() {
    this.assemblyPlaybackManager.stop();
    return this.assemblyPlaybackManager.state();
  }

  focusPartIds(partIds = [], options = {}) {
    const ids=new Set(partIds||[]);
    const meshes=this.meshes.filter(mesh=>ids.has(mesh.userData.part?.id)&&mesh.visible!==false);
    if(!meshes.length)return false;
    this.selectMany(meshes);
    const box=new THREE.Box3();for(const mesh of meshes)box.expandByObject(mesh);
    const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
    this.sceneManager.setView(options.direction||'iso',center,Math.max(size.x,size.y,size.z,200)*Number(options.distanceScale||1.85),{durationMs:Number(options.durationMs||300),immediate:options.immediate===true});
    return true;
  }

  explodeAssemblyStep(partIds = [], distanceMm = 120) {
    const ids=new Set(partIds||[]);
    if(!ids.size)throw new Error('当前装配步骤没有可预览的构件');
    this.selectMany(this.meshes.filter(mesh=>ids.has(mesh.userData.part?.id)));
    return this.assemblyPresentationManager.explodePartIds([...ids],distanceMm);
  }

  beginContourFrameEdit(assemblyId = null) {
    const id=assemblyId || this.selected?.userData?.part?.assemblyId || null;
    return this.contourFrameManager.begin(id);
  }

  stopContourFrameEdit() {
    this.contourFrameManager.stop();
  }

  setContourFrameEdgeLength(edgeIndex,lengthMm) {
    return this.contourFrameManager.setEdgeLength(edgeIndex,lengthMm);
  }

  setContourFrameOrthogonal(enabled) {
    return this.contourFrameManager.setOrthogonal(enabled);
  }

  addContourFrameConstraint(type,firstIndex,secondIndex,options = {}) {
    return this.contourFrameManager.addSimpleConstraint(type,firstIndex,secondIndex,options);
  }

  removeContourFrameConstraint(id) {
    return this.contourFrameManager.removeSimpleConstraint(id);
  }

  focusContourFrameConstraint(id) {
    return this.contourFrameManager.focusConstraint(id);
  }

  updateContourFrameConstraint(id,patch = {}) {
    return this.contourFrameManager.updateSimpleConstraint(id,patch);
  }

  toggleContourConstraintType(id) {
    return this.contourFrameManager.toggleSimpleConstraintType(id);
  }

  insertContourFramePoint(edgeIndex,worldPoint) {
    return this.contourFrameManager.insertPoint(edgeIndex,worldPoint);
  }

  deleteContourFramePoint(pointIndex) {
    return this.contourFrameManager.deletePoint(pointIndex);
  }

  createContourFrameFromPoints(points,options = {}) {
    return this.profileDrawTool.createContourFrame(points,options);
  }

  /** 平滑聚焦当前装配连接，并同时选中两端型材和该连接派生五金。 */
  focusAssemblyConnection(connectionId) {
    const connection=this.connectionManager.connections.find(item=>item.id===connectionId);
    if(!connection)throw new Error('连接不存在');
    const ids=new Set([connection.sourceProfileId,connection.targetProfileId,...(connection.generatedHardwareIds||[])]);
    for(const part of this.parts){if(part.generatedByConnectionId===connection.id)ids.add(part.id);}
    const meshes=this.meshes.filter(mesh=>ids.has(mesh.userData?.part?.id)&&mesh.visible!==false);
    if(!meshes.length)return false;
    this.selectMany(meshes);
    const box=new THREE.Box3();for(const mesh of meshes)box.expandByObject(mesh);
    const center=box.getCenter(new THREE.Vector3());const size=box.getSize(new THREE.Vector3());
    this.sceneManager.setView('iso',center,Math.max(size.x,size.y,size.z,140)*2.2,{durationMs:420});
    return true;
  }

  validateForFactory() {
    return this.factoryValidator.validate();
  }

  disposePartMesh(mesh) {
    if (mesh.userData.part?.type === 'PROFILE') ProfileGeometryFactory.dispose(mesh);
    else PrimitiveGeometryFactory.dispose(mesh);
  }
}

function frameRotationQuaternionForEditor(rotation) {
  const quaternion = new THREE.Quaternion();
  if (rotation?.axis === 'X') quaternion.setFromAxisAngle(new THREE.Vector3(1,0,0),Number(rotation.angleRad || 0));
  else if (rotation?.axis === 'Y') quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),Number(rotation.angleRad || 0));
  return quaternion;
}

function plainToVector3(value) {
  if (!value || typeof value !== 'object') return null;
  const x = Number(value.x);
  const y = Number(value.y);
  const z = Number(value.z);
  if (![x,y,z].every(Number.isFinite)) return null;
  return new THREE.Vector3(x,y,z);
}

function profileWorldDirection(mesh) {
  const direction = new THREE.Vector3(0,0,1);
  mesh.getWorldQuaternion(new THREE.Quaternion()).normalize();
  return direction.applyQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion())).normalize();
}

function axisVector(axis) {
  if (axis === 'X') return new THREE.Vector3(1,0,0);
  if (axis === 'Z') return new THREE.Vector3(0,0,1);
  return new THREE.Vector3(0,1,0);
}

function dominantAxis(vector) {
  const values = {X:Math.abs(vector.x),Y:Math.abs(vector.y),Z:Math.abs(vector.z)};
  return Object.entries(values).sort((a,b) => b[1] - a[1])[0][0];
}

function signedAngleAroundAxis(a,b,axis) {
  const normal = axis.clone().normalize();
  const pa = a.clone().sub(normal.clone().multiplyScalar(a.dot(normal))).normalize();
  const pb = b.clone().sub(normal.clone().multiplyScalar(b.dot(normal))).normalize();
  if (pa.lengthSq() < 1e-8 || pb.lengthSq() < 1e-8) return a.angleTo(b);
  const cross = pa.clone().cross(pb);
  return Math.atan2(cross.dot(normal),THREE.MathUtils.clamp(pa.dot(pb),-1,1));
}

function normalizeEndCuts(value) {
  const source = value || {};
  const normalize = end => ({
    angleDeg:Math.max(-60,Math.min(60,Number(end?.angleDeg || 0))),
    axis:end?.axis === 'Y' ? 'Y' : 'X'
  });
  return {START:normalize(source.START),END:normalize(source.END)};
}

function toPlainPoint(point) {
  return {x:Number(point.x.toFixed(3)),y:Number(point.y.toFixed(3)),z:Number(point.z.toFixed(3))};
}

function toThreeVector(value){return value?.isVector3?value.clone():new THREE.Vector3(Number(value?.x||0),Number(value?.y||0),Number(value?.z||0));}

function normalizeVector(value, fallback = {x:0,y:0,z:0}) {
  return {
    x:Number(value?.x ?? fallback.x ?? 0),
    y:Number(value?.y ?? fallback.y ?? 0),
    z:Number(value?.z ?? fallback.z ?? 0)
  };
}


function machiningFaceHalfSpan(part,face) {
  const [width,height] = part?.dimensions?.sectionSize || [0,0];
  return ['FRONT','BACK'].includes(face) ? Number(width)/2 : Number(height)/2;
}

function machiningEffectiveRadius(item) {
  if (!item) return 0;
  if (item.type === 'COUNTERSINK') return Number(item.majorDiameter ?? item.diameter ?? 0) / 2;
  return Number(item.diameter || 0) / 2;
}

function stripWorldPoint(feature) {
  const copy = {...feature};
  delete copy.worldPoint;
  return copy;
}

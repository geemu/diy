import * as THREE from 'three';
import Editor from './core/Editor.js';
import ProjectIO from './io/ProjectIO.js';
import LocalProjectDraft from './io/LocalProjectDraft.js';
import {CURRENT_APP_VERSION} from './io/ProjectSchema.js';
import DxfSectionParser from './io/DxfSectionParser.js';
import {
  ProfileCatalogList,
  ProfileSystemOptions,
  buildCatalogSlotDefinitions,
  registerProfileDefinitions,
  unregisterProfileDefinition
} from './model/ProfileCatalog.js';
import {getPathMetrics} from './model/ProfilePath.js';
import {fetchDatabaseProfiles,saveDatabaseProfile,deleteDatabaseProfile} from './model/ProfileCatalogApi.js';
import {fetchAccessoryCatalog,saveAccessoryCatalog,deleteAccessoryCatalog} from './model/AccessoryCatalogApi.js';
import {ProfileSectionTemplateOptions,buildSectionFromEditor,readSectionEditorState,sectionStyleForTemplate} from './model/ProfileSectionEditor.js';
import ProfileSectionPreview3D from './interaction/ProfileSectionPreview3D.js?v=0.75.16';
import PrimitiveGeometryFactory from './geometry/PrimitiveGeometryFactory.js';
import {ConnectionComponentOptions,ShaftComponentOptions,PanelShapeOptions,AccessoryComponentOptions,ProfileReferenceOptions,ProfileClosureOptions,
  FastenerHeadOptions,FootCupOptions,SlideTypeOptions,SlideLengthOptions,EndCapMaterialOptions,APillarLengthOptions,APillarSideOptions,
  connectionSpecs,connectionDesignType,shaftDiametersFor,shaftFixturePorts,fastenerThreads,fastenerLengths,closureFaces,connectionComponent,shaftComponent,accessoryComponent,componentPart} from './model/ComponentCatalog.js';
import {PanelShapeFields,panelDefaults,panelDimensions} from './model/PanelShapeModel.js';
import {
  getSectionDefinition,
  getSectionInfo,
  sectionToSvg,
  registerCustomSection,
  removeCustomSection,
  hasCustomSection,
  registerCatalogSection,
  removeCatalogSection
} from './model/ProfileSectionRegistry.js';
import {DesignConnectionList, DEFAULT_DESIGN_CONNECTION_TYPE, designConnectionLabel} from './model/DesignConnectionCatalog.js';
import {HardwareCatalogList} from './model/HardwareCatalog.js';
import DiyGenerator from './diy/DiyGenerator.js';
import {DiyTemplateList, getDiyTemplate} from './diy/DiyTemplateCatalog.js';
import WorkbenchLayoutManager from './ui/WorkbenchLayoutManager.js';
import {workbenchIcon} from './ui/WorkbenchIcons.js';
import ProfileSelector from './ui/ProfileSelector.js';
import ViewCube,{VIEW_DIRECTIONS} from './ui/ViewCube.js';
import {buildContourPreset} from './drawing/ContourPresetFactory.js';
import {buildConnectionInstallationDiagram} from './manufacturing/ConnectionInstallationDiagram.js';
import {buildAssemblyGuidePrintHtml} from './manufacturing/AssemblyGuideDocument.js';
import {
  DesignProfileList,
  getDesignProfileChoices,
  getDesignProfileDefinition,
  getDefaultDesignProfileId,
  profileDisplayName
} from './model/DesignProfileCatalog.js';

const {createApp, ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick} = Vue;

createApp({
  components:{ProfileSelector},
  setup() {
    const viewport = ref(null);
    const fileInput = ref(null);
    const sectionDxfInput = ref(null);
    const selected = ref(null);
    const selectedMeshes = ref([]);
    const footerTipElement=ref(null);
    const footerTip=reactive({visible:false,text:'',x:0,y:0});
    let footerTipAnchor=null,footerTipSequence=0;
    const footerContextTip=computed(()=>{
      const selection=selectionCount.value>1?`已选择 ${selectionCount.value} 个构件`:selectedPart.value?`${selectedPart.value.displayId} · ${selectedPart.value.name}`:'未选择构件';
      const operation=drawState.active
        ?`${drawState.start?'选择终点，输入长度后按 Enter 确认':'点击画布选择起点'}${drawState.axisLock?' · 锁定 '+drawState.axisLock+' 轴':''}\nEsc 或右键单击结束绘制，已完成构件保留。`
        :profilePlacementState.active?profilePlacementState.message:wholeStretchState.active?wholeStretchState.message:'Shift+点击：多选\nSpace+左键拖动：框选\nCtrl / Alt+左键拖动：复制\nAlt+点击：穿透选择\nE：快速对齐 · G：组合 · X：解组';
      return `${selection}\n${operation}\n尺寸单位：毫米（mm）`;
    });
    const connectionSource = ref(null);
    const sectionRevision = ref(0);
    const activeLibrary = ref('profile');
    const quickPanel = ref('');
    const rightPanelMode = ref('create');
    const viewCubeViewport = ref(null);
    const viewDirections = VIEW_DIRECTIONS;
    const resourceCategories = [{id:'profile',label:'铝材',icon:'▤'},{id:'connection',label:'连接',icon:'∟'},{id:'shaft',label:'光轴',icon:'◯'},{id:'panel',label:'板材',icon:'▣'},{id:'accessory',label:'配件',icon:'◆'}];
    let viewCube = null;
    watch(activeLibrary,()=>{rightPanelMode.value='create';});
    watch([quickPanel,rightPanelMode],()=>nextTick(()=>window.dispatchEvent(new Event('resize'))));
    function openQuickPanel(mode) { cancelPlacementTools();quickPanel.value=quickPanel.value===mode?'':mode; }
    function openResource(id) { cancelPlacementTools();rightPanelMode.value='create';activeLibrary.value=id; }
    function viewDirection(item) { editor?.viewDirection(new THREE.Vector3(item.x,item.y,item.z)); }
    function quickRotate(axis) {
      try { setMode('rotate');if(editor?.rotateSelectionQuarterTurn(axis))notify(`已绕 ${axis} 轴旋转 +90°`); }
      catch(error){notify(error.message||'旋转失败','warning');}
    }
    const connectionPlacementState = reactive({active:false,mode:null,step:1,message:''});
    const machiningPlacementState = reactive({active:false,mode:null,message:''});
    const accessoryPlacementState = reactive({active:false,definitionId:null,label:'',valid:null,message:''});
    const profilePlacementState = reactive({active:false,orientation:'Z',message:''});
    const quickAlignmentVisible=ref(false);
    const wholeStretchState=reactive({active:false,phase:'RANGE',message:''});
    const shaftSmart=reactive({visible:false,mode:'FIXTURE',targetId:null,type:'VERTICAL_SK',diameter:8,percent:50,holeId:null,sourceDefinition:null,length:100,startOffset:0});
    const shaftSmartTypes=computed(()=>['VERTICAL_SK','HORIZONTAL_SHF','CROSS_FIX','PARALLEL_FIX','PARALLEL_FIX_35','PARALLEL_FIX_40','L_FIX','T_FIX','LIMIT_RING'].map(value=>ShaftComponentOptions.find(item=>item.value===value)).filter(Boolean));
    const shaftSmartDefinition=computed(()=>shaftSmart.mode==='ROD'?shaftSmart.sourceDefinition:shaftComponent({type:shaftSmart.type,diameter:shaftSmart.diameter,mixed:false}));
    const shaftSmartPorts=computed(()=>shaftFixturePorts(shaftSmartDefinition.value));
    const shaftSmartBaseLabel=computed(()=>shaftSmart.mode==='ROD'?(ShaftComponentOptions.find(item=>item.value===String(shaftSmart.sourceDefinition?.dimensions?.geometryKind).replace(/^SHAFT_/,''))?.label||'光轴夹具'):'光轴杆件');
    const shaftSmartAvailable=computed(()=>selectedPart.value?.type==='SHAFT'||shaftFixturePorts(selectedPart.value).length>0);
    watch(()=>shaftSmart.type,()=>{if(shaftSmart.mode==='FIXTURE')shaftSmart.holeId=shaftSmartPorts.value[0]?.id||null;});
    watch(()=>shaftSmart.holeId,()=>{if(shaftSmart.mode==='ROD')resetShaftStartOffset();});
    function resetShaftStartOffset(){
      const port=shaftSmartPorts.value.find(hole=>hole.id===shaftSmart.holeId);if(!port)return;
      const index=port.axis.findIndex(value=>value!==0),extent=Number(shaftSmartDefinition.value.dimensions[['width','height','length'][index]]);
      shaftSmart.diameter=port.diameter;shaftSmart.startOffset=Math.floor(-extent/2-port.center[index]);
    }
    function startWholeStretch(){
      cancelPlacementTools();quickAlignmentVisible.value=false;
      try{editor.wholeStretchManager.begin();}catch(error){notify(error.message,'warning');}
    }
    function confirmWholeStretch(){editor?.wholeStretchManager.confirm();}
    function cancelWholeStretch(){editor?.wholeStretchManager.cancel();}
    function stretchRangeMode(mode){editor?.wholeStretchManager.setRangeMode(mode);}
    function toggleQuickAlignment(){
      cancelPlacementTools();
      if(selectionCount.value<2)return notify('请先按 Shift 选择至少两个构件，再按 E 快速对齐','warning');
      quickAlignmentVisible.value=!quickAlignmentVisible.value;
    }
    function applyQuickAlignment(kind,axis='X'){
      try{editor.quickAlignmentManager.execute(kind,axis);quickAlignmentVisible.value=false;notify('已完成快速对齐');}
      catch(error){notify(error.message,'warning');}
    }
    function openShaftSmart(){
      const part=selectedPart.value;
      if(part?.type!=='SHAFT'){
        const ports=shaftFixturePorts(part);if(!ports.length)return notify('先选择光轴杆件或光轴夹具','warning');
        cancelPlacementTools();
        Object.assign(shaftSmart,{visible:true,mode:'ROD',targetId:part.id,sourceDefinition:structuredClone(editor.getMeshByPartId(part.id).userData.part),holeId:ports[0].id,length:100});
        resetShaftStartOffset();return;
      }
      const diameter=Number(part.dimensions.diameter);
      if(!Number.isFinite(diameter)||diameter<=0)return notify('当前光轴直径无效，请先修正尺寸','warning');
      cancelPlacementTools();
      Object.assign(shaftSmart,{visible:true,mode:'FIXTURE',targetId:part.id,type:'VERTICAL_SK',diameter,percent:50,holeId:'Z',sourceDefinition:null});
    }
    function createShaftSmartFixture(){
      try{
        if(shaftSmart.mode==='ROD'){
          editor.createShaftFromFixture(shaftSmart.targetId,{length:shaftSmart.length,startOffset:shaftSmart.startOffset,holeId:shaftSmart.holeId});
          notify('已按所选孔方向生成配套光轴，可独立编辑或编组');
        }else{
          editor.createShaftSmartFixture(shaftSmartDefinition.value,shaftSmart.targetId,shaftSmart.percent,shaftSmart.holeId);
          notify('已生成配套夹具；将随光轴移动和旋转');
        }
        shaftSmart.visible=false;
      }catch(error){notify(error.message,'warning');}
    }
    const accessoryPlacementSeed = ref(null);
    const inspectorTab = ref('properties');
    const toolMode = ref('translate');
    const snapEnabled = ref(true);
    const autoConnectionEnabled = ref(true);
    const gridEnabled = ref(true);
    const projection = ref('perspective');
    const profileSearch = ref('');
    const profileAdvanced = ref(false);
    const profileCatalogLoading = ref(false);
    const profileCatalogManagerVisible = ref(false);
    const profileCatalogManagerSearch = ref('');
    const databaseProfiles = reactive([]);
    const databaseAccessories = reactive([]);
    const databaseAccessoryRows = reactive([]);
    const accessoryCatalogLoading = ref(false);
    const accessorySearch = ref('');
    const accessoryCategory = ref('ALL');
    const accessoryCatalogManagerVisible = ref(false);
    const accessoryCatalogManagerSearch = ref('');
    const accessoryEditorVisible = ref(false);
    const accessoryEditorMode = ref('create');
    const accessoryForm = reactive({id:null,category:'END_CAP',model:'3030-END',name:'3030 黑色端盖',enabled:true,material:'尼龙',unit:'个',size:30,thickness:6,profileNominal:'3030',stemDiameter:12,stemLength:70,footDiameter:60,footThickness:12,thread:'M12',wheelDiameter:75,wheelWidth:30,brake:true,length:450,width:12,height:45,side:'BOTH'});
    const customProfileVisible = ref(false);
    const customProfileMode = ref('create');
    const profileSectionPreviewCanvas = ref(null);
    const catalogProfileCanvas = ref(null);
    const catalogAccessoryId = ref(null);
    let catalogProfilePreview = null;
    const customProfileForm = reactive({id:'',nominal:'3030',variant:'CUSTOM3030',name:'自定义 3030',series:'30',system:'自定义',width:30,height:30,slotWidth:8,wallThicknessOptions:'1.8,2.0',defaultWallThickness:2,alloy:'A6063-T5',note:'',sectionTemplate:'T_SLOT',centerHoleDiameter:5,cornerChamfer:3,sectionJson:'',enabled:true,sortOrder:1000});
    const lastSnap = ref(null);
    const measureMode = ref(false);
    const measureResult = ref(null);
    const dimensionMode = ref(false);
    const featureSelectMode = ref(false);
    const selectedFeatures = ref([]);
    const featureMateOptions = reactive({mateKind:'AUTO',offsetMm:0,angleDeg:90,flipped:false,autoAlign:true});
    const dimensionState = ref(null);
    const userDimensions = ref([]);
    const dimensionChainAxis = ref('AUTO');
    const annotationOptions = reactive({showOverall:true,showPartDimensions:true,showMachiningLabels:true,showMachiningDimensions:true,showUserDimensions:true});
    const boxSelectMode = ref(false);
    const lassoSelectMode = ref(false);
    const transformSpace = ref('world');
    const movementStepMm = ref(5);
    const transformMoveScope = ref('SINGLE');
    const workPlaneVisible = ref(true);
    const featureHover = ref(null);
    const drawState = reactive({active:false,mode:'OFF',axisLock:null,start:null,hover:null,committed:null,lengthMm:null,typedLength:'',segmentCount:0,contourPointCount:0});
    const gripState = reactive({active:false,end:null,lengthMm:null,typed:'',snappedFeature:null,message:'',blocked:false,error:false});
    const profileLengthForm=reactive({partId:null,fixedEnd:'START',lengthMm:0});
    const selectionFilter = ref('ALL');
    const curvedMachiningStage = ref('BEND_BEFORE');
    const machiningSelection = ref([]);
    const batchMachiningFace = ref('FRONT');
    const projectRevision = ref(0);
    const selectedAssemblyId = ref(null);
    const contourEditState = reactive({active:false,assemblyId:null,pointCount:0,points:[],edges:[],orthogonal:true,plane:'XZ',message:''});
    const contourPresetForm = reactive({widthMm:1000,depthMm:600,notchMm:300});
    const contourConstraintForm = reactive({edgeA:0,edgeB:1,pointA:0,pointB:1,alignMode:'HORIZONTAL'});
    const activeConnectionDetail = ref(null);
    const activeContourConstraintId = ref(null);
    const assemblyDiagnostics = ref(null);
    const assemblyExplosionActive = ref(false);
    const assemblyExplodeDistance = ref(160);
    const dirty = ref(false);
    const autosaveInfo = ref('');
    const hasAutosave = ref(false);
    const autosaveError = ref('');
    const contextMenu = reactive({visible:false,x:0,y:0,partType:null,partId:null,worldPoint:null,end:null,lengthMm:0,nearJoint:false,connectionCandidates:[],accessoryCandidates:[]});
    const jointQuickMenu = reactive({visible:false,x:0,y:0,partId:null,worldPoint:null,end:null,connectionCandidates:[],accessoryCandidates:[]});
    const relationQuickMenu = reactive({visible:false,x:0,y:0,constraintId:null,type:null,edgeA:0,edgeB:1,pointA:0,pointB:1,mode:'HORIZONTAL'});
    const interferenceState = reactive({active:false,live:false,count:0,contactCount:0,message:'',partIds:[],contactPartIds:[]});
    const dragAsset = ref(null);
    const dimensions = reactive({width:0,depth:0,height:0});
    const stats = reactive({profiles:0,shafts:0,panels:0,accessories:0,machining:0,connections:0,total:0});
    const toast = reactive({visible:false,text:'',type:'success'});
    const validationVisible = ref(false);
    const validationReport = ref(null);
    const pendingFactoryExport = ref(false);
    const engineeringCenterVisible = ref(false);
    const engineeringCenterTab = ref('materials');
    const manufacturingConfigVisible = ref(false);
    const manufacturingConfigTab = ref('profiles');
    const showShortcutHelp = ref(false);
    let editor = null;
    let viewportResizeObserver = null;
    let diyGenerator = null;
    let timer = null;
    let profileSectionPreview3d = null;
    let layoutManager = null;
    const localDraft = new LocalProjectDraft();
    let autosaveReady = false;

    // 用户确认尺寸归组后选择具体型号。只投影几何，不提前绑定制造材料属性。
    const designProfiles = DesignProfileList;
    const profileCatalog = reactive([...ProfileCatalogList]);
    const profileChoices = computed(()=>getDesignProfileChoices(profileCatalog));
    const profileSystems = ProfileSystemOptions;
    const profileSectionTemplateOptions = ProfileSectionTemplateOptions;
    const nominalOptions = computed(() => [...new Set(designProfiles.map(item=>item.nominal))].sort((a,b)=>String(a).localeCompare(String(b),'zh-CN',{numeric:true})));
    const shaftDiameters = computed(()=>shaftDiametersFor(newShaft.type));
    const connectionRules = DesignConnectionList;
    const hardwareCatalog = HardwareCatalogList;

    const newProfile = reactive({
      nominal:'2040',
      catalogId:getDefaultDesignProfileId('2040'),
      length:500,
      free:true,
      faceClosures:[],
      pathType:'LINE',
      radius:1000,
      angleDeg:90,
      plane:'XZ'
    });
    const newShaft = reactive({type:'ROD',diameter:8,secondDiameter:6,mixed:false,length:100,free:false,material:'45#钢'});
    watch(()=>[newProfile.catalogId,newProfile.length,JSON.stringify(newProfile.faceClosures)],()=>{
      const manager=editor?.profilePlacementManager;
      if(!manager?.isActive())return;
      const event=manager.event,orientation=manager.orientation;
      try{manager.begin(newProfile.catalogId,Number(newProfile.length),{faceClosures:[...newProfile.faceClosures]});manager.orientation=orientation;if(event)manager.handlePointerMove(event);}
      catch(error){manager.cancel();notify(error.message,'warning');}
    });
    const newPanel = reactive({shape:'rectangle',parameters:panelDefaults('rectangle'),edgeMode:false,free:true,width:400,height:400,thickness:5,material:'铝板'});
    const catalogConnectionForm=reactive({type:'L_BRACKET',spec:'0',length:165,side:'right',free:false});
    const catalogAccessoryForm=reactive({type:'SLIDE_RAIL',slideType:'THREE_SECTION',slideLength:500,head:'SHCS',thread:5,screwLength:20,elasticSeries:40,capMaterial:'PLASTIC',foot:'D40-M8-30',free:false});
    const profileClosure=ref('');
    const referenceProfiles=ProfileReferenceOptions.map(item=>({...getDesignProfileDefinition(item.id),label:item.label}));
    const extensionProfiles=designProfiles.filter(item=>!ProfileReferenceOptions.some(x=>x.id===item.id));
    const connectionSpecOptions=computed(()=>connectionSpecs(catalogConnectionForm.type));
    const currentConnectionComponent=computed(()=>connectionComponent(catalogConnectionForm));
    const selectedConnectionInstallable=computed(()=>selectionCount.value===1&&selectedPart.value?.type==='ACCESSORY'&&!!connectionDesignType(selectedPart.value)&&!selectedPart.value.mountReference&&!selectedPart.value.generatedByConnectionId&&!selectedPart.value.locked);
    const currentShaftComponent=computed(()=>shaftComponent(newShaft));
    const currentAccessoryComponent=computed(()=>accessoryComponent(catalogAccessoryForm,selectedPart.value?.type==='PROFILE'?getDesignProfileDefinition(selectedPart.value.designProfile.profileId):selectedDesignProfile.value));
    const secondShaftDiameters=computed(()=>shaftDiameters.value.filter(d=>d<newShaft.diameter));
    const fastenerThreadOptions=computed(()=>fastenerThreads(catalogAccessoryForm.head));
    const fastenerLengthOptions=computed(()=>fastenerLengths(catalogAccessoryForm.head,catalogAccessoryForm.thread));
    const panelFields=computed(()=>PanelShapeFields[newPanel.shape]);
    const panelShapeLabel=computed(()=>PanelShapeOptions.find(x=>x.value===newPanel.shape)?.label);
    const currentPanelDimensions=computed(()=>{try{return panelDimensions(newPanel.shape,newPanel.parameters,newPanel.edgeMode);}catch{return null;}});
    const panelPreviewLabel=computed(()=>{const d=currentPanelDimensions.value;return d?`${d.width}×${d.height}×${d.thickness}mm`:panelShapeLabel.value;});
    watch(()=>catalogConnectionForm.type,()=>{catalogConnectionForm.spec=connectionSpecOptions.value[0]?.value;});
    watch(()=>newShaft.type,()=>{if(!shaftDiameters.value.includes(newShaft.diameter))newShaft.diameter=shaftDiameters.value[0];newShaft.mixed=false;});
    watch(()=>newShaft.diameter,()=>{if(!secondShaftDiameters.value.length)newShaft.mixed=false;if(!secondShaftDiameters.value.includes(newShaft.secondDiameter))newShaft.secondDiameter=secondShaftDiameters.value.at(-1);});
    watch(()=>newPanel.shape,shape=>{newPanel.parameters=panelDefaults(shape);newPanel.edgeMode=false;});
    watch(()=>catalogAccessoryForm.head,()=>{if(catalogAccessoryForm.head==='ELASTIC_NUT')return;catalogAccessoryForm.thread=fastenerThreadOptions.value[0];});
    watch([()=>catalogAccessoryForm.head,()=>catalogAccessoryForm.thread],()=>{if(catalogAccessoryForm.head!=='ELASTIC_NUT'&&!fastenerLengthOptions.value.includes(catalogAccessoryForm.screwLength))catalogAccessoryForm.screwLength=fastenerLengthOptions.value[0];});
    watch(profileClosure,value=>{newProfile.faceClosures=[...new Set([...(selectedDesignProfile.value.defaultFaceClosures||[]),...closureFaces(value,selectedDesignProfile.value)])];editor?.profileDrawTool.configure({faceClosures:[...newProfile.faceClosures]});});
    const panelMaterialColors=Object.freeze({'木饰面板':'#d7b889','亚克力':'#b4d7e9','铝板':'#8491a5','钢板':'#8b959f'});
    const panelFitForm = reactive({clearanceMm:2,thickness:5,material:'亚克力',normalOffsetMm:0});
    const doorForm = reactive({frameCatalogId:getDefaultDesignProfileId('2020'),gapMm:3,panelGapMm:2,panelThickness:5,panelMaterial:'亚克力',hingeSide:'LEFT',includeHinges:true,includeHandle:true});
    const profileReplaceForm = reactive({catalogId:getDefaultDesignProfileId('3030'),scope:'SELECTED',autoRepair:true});
    const diyTemplates = DiyTemplateList;
    const diyTemplateId = ref('STORAGE_RACK');
    const diyForm = reactive({catalogId:getDefaultDesignProfileId('3030'),width:1000,depth:500,height:1800,levels:4,centerBeamCount:1,autoConnect:true});
    const selectedDiyTemplate = computed(() => getDiyTemplate(diyTemplateId.value));
    const frameForm = reactive({catalogId:getDefaultDesignProfileId('3030'),width:1000,depth:600,height:1000});
    const drawForm = reactive({catalogId:getDefaultDesignProfileId('3030'),plane:'XZ',orthogonal:true,gridSnap:true,gridStepMm:10,fixedLengthMm:0,continueDrawing:false,boxWidthMm:1000,boxDepthMm:600,boxHeightMm:1000});
    const selectedDesignProfile = computed(()=>{sectionRevision.value;return getDesignProfileDefinition(newProfile.catalogId);});
    const hasChosenProfile = ref(false);
    async function refreshCatalogPreview() {
      await nextTick();
      if(!catalogProfileCanvas.value || rightPanelMode.value!=='create'){
        catalogProfilePreview?.dispose();catalogProfilePreview=null;return;
      }
      if(catalogProfilePreview?.canvas!==catalogProfileCanvas.value){
        catalogProfilePreview?.dispose();
        catalogProfilePreview=new ProfileSectionPreview3D(catalogProfileCanvas.value);
      }
      catalogProfilePreview.resize();
      if(activeLibrary.value==='profile'){
        catalogProfilePreview.setSection(getSectionDefinition(newProfile.catalogId,newProfile.faceClosures),{lengthMm:100,presentation:'catalog',profileId:newProfile.catalogId,faceClosures:[...newProfile.faceClosures]});
      } else {
        let previewSpec;
        if(activeLibrary.value==='shaft')previewSpec=newShaft.type==='ROD'?{type:'SHAFT',dimensions:{diameter:Number(newShaft.diameter),length:Number(newShaft.length)}}:componentPart(currentShaftComponent.value);
        if(activeLibrary.value==='panel'&&currentPanelDimensions.value)previewSpec={type:'PANEL',dimensions:currentPanelDimensions.value,color:panelMaterialColors[newPanel.material]};
        if(activeLibrary.value==='connection')previewSpec=componentPart(currentConnectionComponent.value);
        if(activeLibrary.value==='accessory')previewSpec=componentPart(currentAccessoryComponent.value);
        catalogProfilePreview.setObject(previewSpec?PrimitiveGeometryFactory.create(previewSpec):null);
      }
    }
    const drawerForm = reactive({width:500,depth:450,height:600,count:3,gap:3,frontMode:'INSET',includeSlides:true,slideLength:450});
    const arrayForm = reactive({axis:'X',count:3,spacing:100});
    const mirrorForm = reactive({axis:'X',copy:true,planeMode:'WORLD_ORIGIN'});
    const circularForm = reactive({axis:'Y',count:4,angleDeg:360,centerMode:'WORLD_ORIGIN'});
    const engineeringDrawingForm = reactive({projectName:'未命名工程',revision:'A',paper:'A3',sideView:'RIGHT'});
    const connectionRuleId = ref(DEFAULT_DESIGN_CONNECTION_TYPE);

    const selectedPart = computed(() => selected.value?.userData?.part || null);
    const selectionCount = computed(() => selectedMeshes.value.length);
    const projectParts = computed(() => { projectRevision.value; return editor ? editor.parts.map(part => ({...part})) : []; });
    const hasHiddenParts = computed(() => projectParts.value.some(part=>part.hidden===true));
    const projectGroups = computed(() => {
      projectRevision.value;
      if (!editor) return [];
      const roots = editor.assemblyManager.tree();
      const rows = [];
      const walk = (node,depth=0) => {
        rows.push({id:node.id,assemblyId:node.single?null:node.id,label:node.single?null:node.name,parts:node.parts,depth,single:node.single===true,childCount:node.children?.length||0,hidden:node.hidden===true,locked:node.locked===true,installationStep:Number(node.installationStep||0),installationNote:node.installationNote||''});
        for (const child of node.children || []) walk(child,depth+1);
      };
      for (const root of roots) walk(root,0);
      return rows;
    });
    const selectedIsProfile = computed(() => selectedPart.value?.type === 'PROFILE');
    const selectedMachiningItems = computed(() => selectedIsProfile.value ? (selectedPart.value?.machiningItems || []) : []);
    const selectedIsCurved = computed(() => selectedIsProfile.value && selectedPart.value?.profilePath?.type === 'ARC');
    const profileLengthEndBlocked=computed(()=>{
      projectRevision.value;
      const id=selectedPart.value?.id;
      return {START:!!(id&&editor?.profileGripEditor.isEndDrivenByConstraint(id,'START')),END:!!(id&&editor?.profileGripEditor.isEndDrivenByConstraint(id,'END'))};
    });
    const profileLengthEditable=computed(()=>{
      projectRevision.value;
      const movingEnd=profileLengthForm.fixedEnd==='START'?'END':'START';
      return selectionCount.value===1&&selectedIsProfile.value&&!selectedIsCurved.value&&!!editor?.isMeshTransformable(selected.value)&&!profileLengthEndBlocked.value[movingEnd];
    });
    const selectedTypeName = computed(() => ({PROFILE:'型材',SHAFT:'光轴',PANEL:'板材',ACCESSORY:'配件'})[selectedPart.value?.type] || selectedPart.value?.type || '构件');
    const selectedContourAssembly = computed(() => { projectRevision.value; const id=selectedAssemblyId.value || selectedPart.value?.assemblyId || null; const assembly=id&&editor?editor.assemblyManager.get(id):null; return assembly?.configurator==='CONTOUR_FRAME'?assembly:null; });
    const selectedContourEdges = computed(() => { projectRevision.value; const points=selectedContourAssembly.value?.parameters?.points||[]; return points.map((point,index)=>{const next=points[(index+1)%points.length];const dx=Number(next?.x||0)-Number(point?.x||0),dy=Number(next?.y||0)-Number(point?.y||0),dz=Number(next?.z||0)-Number(point?.z||0);return{index,lengthMm:Number(Math.hypot(dx,dy,dz).toFixed(2))};}); });
    const selectedContourPoints = computed(() => { projectRevision.value; return (selectedContourAssembly.value?.parameters?.points||[]).map((point,index)=>({index,label:`点 ${index+1}`,point})); });
    const selectedContourConstraints = computed(() => { projectRevision.value; return (selectedContourAssembly.value?.parameters?.simpleConstraints||[]).map(item=>({...item,label:contourConstraintLabel(item)})); });
    const newVariants = computed(() => designProfiles.filter(item => item.nominal === newProfile.nominal));
    const selectedVariants = computed(() => {
      const nominal=selectedPart.value?.designProfile?.nominal || getDesignProfileDefinition(selectedPart.value?.designProfile?.profileId)?.nominal || '3030';
      return designProfiles.filter(item=>item.nominal===nominal);
    });
    const newProfileThicknessOptions = computed(() => []);
    const selectedThicknessOptions = computed(() => []);
    const selectedPathMetrics = computed(() => selectedIsProfile.value ? getPathMetrics(selectedPart.value) : null);
    const relatedConnections = computed(() => {
      if (!selectedIsProfile.value || !editor) return [];
      const id = selectedPart.value.id;
      return editor.connectionManager.connections.filter(connection => connection.sourceProfileId === id || connection.targetProfileId === id);
    });
    const connectionOverview = computed(() => {
      projectRevision.value;
      return editor?.getConnectionOverview?.() || {total:0,automatic:0,manual:0,invalid:0};
    });
    const relatedConstraints = computed(() => {
      projectRevision.value;
      if (!selectedPart.value || !editor) return [];
      return editor.constraintManager.listForPart(selectedPart.value.id);
    });
    const constraintDiagnostics = computed(() => {
      projectRevision.value;
      return editor ? editor.getConstraintDiagnostics() : null;
    });
    const selectedMobility = computed(() => {
      projectRevision.value;
      return editor && selectedPart.value ? editor.constraintManager.getMobility(selectedPart.value.id) : null;
    });
    const manufacturingSummary = computed(() => { projectRevision.value; return editor ? editor.bomExporter.buildSummary() : {partCount:0,profileCount:0,profileGroupCount:0,totalProfileLengthMm:0,hardwareCount:0,hardwareSkuCount:0,machiningFeatureCount:0,machiningProfileCount:0,assemblyCount:0}; });
    const manufacturingProfileGroups = computed(() => { projectRevision.value; return editor?.manufacturingConfigurator?.profileGroups?.() || []; });
    const manufacturingConnectionRows = computed(() => { projectRevision.value; return editor?.manufacturingConfigurator?.connectionRows?.() || []; });
    const manufacturingConfigStatus = computed(() => { projectRevision.value; return editor?.manufacturingConfigurator?.status?.() || {profilePartCount:0,configuredProfilePartCount:0,unconfiguredProfilePartCount:0,connectionCount:0,configuredConnectionCount:0,unconfiguredConnectionCount:0,ready:false}; });
    const engineeringCenterRows = computed(() => {
      projectRevision.value;
      if (!editor) return [];
      if (engineeringCenterTab.value === 'materials') return editor.bomExporter.buildMaterialRows();
      if (engineeringCenterTab.value === 'accessories') return editor.bomExporter.buildAccessoryBomRows();
      if (engineeringCenterTab.value === 'machining') return editor.bomExporter.buildMachiningDetailRows();
      return [];
    });
    const engineeringCenterHeaders = computed(() => engineeringCenterRows.value[0] || []);
    const engineeringCenterBody = computed(() => engineeringCenterRows.value.slice(1));
    const assemblyInstructionSteps = computed(() => { projectRevision.value; return editor?.buildAssemblyInstructions?.() || []; });
    const assemblyGuidePageIndex = ref(0);
    const assemblyGuideCurrentStep = computed(() => assemblyInstructionSteps.value[assemblyGuidePageIndex.value] || null);
    const assemblyGuidePageCount = computed(() => assemblyInstructionSteps.value.length);
    const activeAssemblyInstructionStepId = ref(null);
    const assemblyPlaybackState = reactive({active:false,playing:false,currentIndex:-1,currentStepId:null,currentStepNumber:0,currentTitle:'',total:0});
    const visibleProfileVariants = computed(() => {
      const keyword = profileSearch.value.trim().toLowerCase();
      return designProfiles.filter(item => {
        if (keyword) return [item.name,item.nominal,`${item.width}×${item.height}`].some(value=>String(value).toLowerCase().includes(keyword));
        return item.nominal === newProfile.nominal;
      });
    });
    const accessoryCategoryOptions = Object.freeze([
      {value:'ALL',label:'全部'},
      {value:'END_CAP',label:'端盖'},
      {value:'FOOT',label:'脚杯'},
      {value:'CASTER',label:'脚轮'},
      {value:'DRAWER_SLIDE',label:'滑轨'}
    ]);
    const visibleAccessories = computed(() => {
      const keyword=accessorySearch.value.trim().toLowerCase();
      return databaseAccessories.filter(item => {
        if(accessoryCategory.value!=='ALL' && item.category!==accessoryCategory.value)return false;
        if(!keyword)return true;
        return [item.model,item.name,accessoryCategoryLabel(item.category)].some(value=>String(value||'').toLowerCase().includes(keyword));
      });
    });
    const selectedCatalogAccessory = computed(()=>visibleAccessories.value.find(item=>item.id===catalogAccessoryId.value)||visibleAccessories.value[0]||null);
    const selectedConnectionPreview = computed(()=>connectionRules.find(item=>item.id===connectionRuleId.value));
    watch(connectionRuleId,()=>{if(connectionPlacementState.active)cancelConnectionPlacement();});
    watch(selectedCatalogAccessory,item=>{
      if(accessoryPlacementState.active&&(!item||accessoryPlacementState.definitionId!==accessoryDefinition(item).id))cancelAccessoryPlacement();
    });
    // 只有可见目录和选中的规格变化才重建预览；切换分类立即释放旧 WebGL 上下文。
    watch([()=>newProfile.catalogId,()=>newProfile.faceClosures,()=>newProfile.length,()=>newProfile.free,activeLibrary,rightPanelMode,
      ()=>JSON.stringify(newShaft),()=>JSON.stringify(newPanel),currentConnectionComponent,currentAccessoryComponent],()=>{
      if(accessoryPlacementState.active)cancelAccessoryPlacement();
      if(connectionPlacementState.active)cancelConnectionPlacement();
      refreshCatalogPreview();
    },{flush:'post'});
    const accessoryManagerRows = computed(() => {
      const keyword=accessoryCatalogManagerSearch.value.trim().toLowerCase();
      if(!keyword)return databaseAccessoryRows;
      return databaseAccessoryRows.filter(item => [item.model,item.name,accessoryCategoryLabel(item.category)].some(value=>String(value||'').toLowerCase().includes(keyword)));
    });
    const frameProfileOptions = computed(() => {
      const preferred = new Set(['2020','3030','4040','4545','6060','8080']);
      return profileChoices.value.filter(item => preferred.has(item.nominal));
    });
    const canSmartConnect = computed(() => {
      const snap = selected.value?.userData?.lastSnap;
      return selectedIsProfile.value && !!snap?.targetProfileId && !!snap?.targetFace;
    });

    const sectionTargetCatalogId = computed(() => selectedPart.value?.designProfile?.profileId || newProfile.catalogId);
    const sectionTargetVariant = computed(() => getDesignProfileDefinition(sectionTargetCatalogId.value)?.name || sectionTargetCatalogId.value || '');
    const sectionInfo = computed(() => {
      sectionRevision.value;
      return getSectionInfo(sectionTargetCatalogId.value);
    });
    const sectionSvg = computed(() => {
      sectionRevision.value;
      return sectionToSvg(getSectionDefinition(sectionTargetCatalogId.value));
    });
    const sectionIsCustom = computed(() => {
      sectionRevision.value;
      return hasCustomSection(sectionTargetCatalogId.value);
    });

    function profileThumbSvg(item) {
      try { return sectionToSvg(getSectionDefinition(item?.id),{fill:item?.custom?'#d8e9ff':'#e7ebf0',stroke:item?.custom?'#2e71ff':'#465464'}); }
      catch { return ''; }
    }

    const databaseProfileRows = computed(() => {
      const keyword=profileCatalogManagerSearch.value.trim().toLowerCase();
      if(!keyword)return databaseProfiles;
      return databaseProfiles.filter(item=>[
        item.id,item.variant,item.nominal,item.name,item.system,item.crossSectionStyle
      ].some(value=>String(value||'').toLowerCase().includes(keyword)));
    });
    const customProfilePreviewState = computed(() => {
      try {
        const section=buildSectionFromEditor(customProfileForm);
        return {section,error:''};
      } catch(error) {
        return {section:null,error:error.message||'截面参数无效'};
      }
    });
    const customProfilePreviewSvg = computed(() => {
      const section=customProfilePreviewState.value.section;
      return section ? sectionToSvg(section,{fill:'#d8e9ff',stroke:'#2e71ff'}) : '';
    });

    function profileManagerThumbSvg(item) {
      try {
        const section=item?.section?.outer?.length ? item.section : getSectionDefinition(item?.id);
        return sectionToSvg(section,{fill:item?.enabled===false?'#eceff3':'#d8e9ff',stroke:item?.enabled===false?'#9aa5b1':'#2e71ff'});
      } catch { return ''; }
    }

    function resetCustomProfileForm() {
      Object.assign(customProfileForm,{
        id:`DB-${Date.now().toString(36).toUpperCase()}`,nominal:'3030',variant:'CUSTOM3030',name:'自定义 3030',series:'30',system:'自定义',
        width:30,height:30,slotWidth:8,wallThicknessOptions:'1.8,2.0',defaultWallThickness:2,alloy:'A6063-T5',note:'',
        sectionTemplate:'T_SLOT',centerHoleDiameter:5,cornerChamfer:3,sectionJson:'',enabled:true,sortOrder:1000
      });
    }

    function openCustomProfileDialog() {
      customProfileMode.value='create';
      resetCustomProfileForm();
      customProfileVisible.value=true;
    }

    async function openProfileCatalogManager() {
      await loadDatabaseProfiles({silent:true});
      profileCatalogManagerVisible.value=true;
    }

    function closeProfileCatalogManager() {
      profileCatalogManagerVisible.value=false;
    }

    function editDatabaseProfile(item) {
      fillCustomProfileForm(item,'edit');
      customProfileVisible.value=true;
    }

    function duplicateDatabaseProfile(item) {
      fillCustomProfileForm(item,'duplicate');
      customProfileForm.id=`DB-${Date.now().toString(36).toUpperCase()}`;
      customProfileForm.variant=`${item.variant||'PROFILE'}_COPY`;
      customProfileForm.name=`${item.name||item.variant||'自定义型材'} 副本`;
      customProfileVisible.value=true;
    }

    function fillCustomProfileForm(item,mode) {
      const editorState=readSectionEditorState(item?.section,item?.crossSectionStyle);
      customProfileMode.value=mode;
      Object.assign(customProfileForm,{
        id:String(item?.id||''),nominal:String(item?.nominal||''),variant:String(item?.variant||''),name:String(item?.name||''),
        series:String(item?.series||''),system:String(item?.system||'自定义'),width:Number(item?.sectionSize?.[0]||30),height:Number(item?.sectionSize?.[1]||30),
        slotWidth:Number(item?.slotWidth||8),wallThicknessOptions:(item?.wallThicknessOptions||[]).join(','),defaultWallThickness:Number(item?.defaultWallThickness||2),
        alloy:String(item?.alloy||'A6063-T5'),note:String(item?.note||''),enabled:item?.enabled!==false,sortOrder:Number(item?.sortOrder??1000),
        ...editorState
      });
    }

    function closeCustomProfileDialog() {
      customProfileVisible.value=false;
    }

    function buildCustomProfilePayload() {
      const wallThicknessOptions=String(customProfileForm.wallThicknessOptions||'').split(/[,，\s]+/).map(Number).filter(value=>Number.isFinite(value)&&value>0);
      const width=Number(customProfileForm.width);
      const height=['ROUND_TUBE','SOLID_ROUND'].includes(customProfileForm.sectionTemplate) ? width : Number(customProfileForm.height);
      const section=buildSectionFromEditor({...customProfileForm,width,height});
      const slotDefinitions=customProfileForm.sectionTemplate==='T_SLOT'
        ? buildCatalogSlotDefinitions(width,height,customProfileForm.series,customProfileForm.slotWidth)
        : [];
      return {
        id:String(customProfileForm.id||'').trim(),nominal:String(customProfileForm.nominal||'').trim(),variant:String(customProfileForm.variant||'').trim(),
        name:String(customProfileForm.name||'').trim(),series:String(customProfileForm.series||'').trim(),system:String(customProfileForm.system||'自定义').trim(),
        sectionSize:[width,height],slotWidth:Number(customProfileForm.slotWidth),slotDefinitions,wallThicknessOptions,
        defaultWallThickness:Number(customProfileForm.defaultWallThickness),alloy:String(customProfileForm.alloy||'A6063-T5').trim(),
        crossSectionStyle:sectionStyleForTemplate(customProfileForm.sectionTemplate),sourceFamily:'DATABASE',note:String(customProfileForm.note||'').trim(),
        section,custom:true,enabled:customProfileForm.enabled!==false,sortOrder:Number(customProfileForm.sortOrder??1000)
      };
    }

    async function loadDatabaseProfiles({silent=false}={}) {
      profileCatalogLoading.value=true;
      try {
        const rows=await fetchDatabaseProfiles({includeDisabled:true});
        databaseProfiles.splice(0,databaseProfiles.length,...(rows||[]));

        // 动态目录定义需要完整注册（包括停用项），这样历史工程仍能解析已使用型号；左侧新增列表只展示 enabled。
        const oldDatabaseDefinitions=ProfileCatalogList.filter(value=>value.sourceFamily==='DATABASE');
        for(const item of [...oldDatabaseDefinitions]) {
          unregisterProfileDefinition(item.id);
          removeCatalogSection(item.id);
        }
        const builtIns=ProfileCatalogList.filter(value=>value.sourceFamily!=='DATABASE');
        const registered=registerProfileDefinitions(rows||[]);
        const enabledDefinitions=[];
        for(let index=0;index<registered.length;index++) {
          const definition=registered[index];
          const row=rows[index];
          if(row?.section?.outer?.length)registerCatalogSection(definition.id,row.section,row.name||'数据库型材库');
          if(row?.enabled!==false)enabledDefinitions.push(definition);
        }
        profileCatalog.splice(0,profileCatalog.length,...builtIns,...enabledDefinitions);
        sectionRevision.value++;
        if(!silent)notify(`型材库已刷新：${enabledDefinitions.length} 个启用 / ${registered.length} 个数据库型号`);
      } catch(error) {
        if(!silent)notify(error.message||'型材数据库读取失败','warning');
      } finally { profileCatalogLoading.value=false; }
    }

    function accessoryCategoryLabel(category) {
      return ({END_CAP:'端盖',FOOT:'脚杯',CASTER:'脚轮',DRAWER_SLIDE:'滑轨'})[category] || category || '配件';
    }

    function parseCatalogJson(text) {
      if(!text)return {};
      if(typeof text==='object')return text;
      try { return JSON.parse(text); }
      catch { return {}; }
    }

    function accessoryDefinition(item) {
      const geometry=parseCatalogJson(item?.geometryJson);
      const mountRule=parseCatalogJson(item?.mountRuleJson);
      const bomRule=parseCatalogJson(item?.bomRuleJson);
      const accessoryType=({END_CAP:'END_CAP',FOOT:'LEVELING_FOOT',CASTER:'CASTER',DRAWER_SLIDE:'DRAWER_SLIDE'})[item?.category] || 'ACCESSORY';
      return {
        id:String(item?.model||`ACCESSORY-${item?.id||''}`),
        model:String(item?.model||''),
        catalogId:item?.id||null,
        label:item?.name||item?.model||'配件',
        accessoryType,
        category:accessoryCategoryLabel(item?.category),
        material:bomRule.material||geometry.material||'',
        unit:bomRule.unit||'个',
        source:'ACCESSORY_CATALOG',
        mountRule,
        ...geometry
      };
    }

    function buildEndCapCandidates(partId,worldPoint,preferredEnd=null) {
      if(!editor||!partId)return [];
      const mesh=editor.getMeshByPartId(partId);
      const part=mesh?.userData?.part;
      if(!mesh||part?.type!=='PROFILE')return [];
      let end=preferredEnd;
      if(!end&&worldPoint){
        const point=new THREE.Vector3(Number(worldPoint.x||0),Number(worldPoint.y||0),Number(worldPoint.z||0));
        const feature=editor.snapManager.resolveFeatureAtPoint(mesh,point,{endToleranceMm:46,slotToleranceMm:20});
        if(feature?.type==='PROFILE_END')end=feature.end;
      }
      if(!end)return [];
      const endOccupiedByConnection=(editor.connectionManager?.connections||[]).some(connection=>connection.sourceProfileId===partId && (connection.sourceEnd==='END'?'END':'START')===end);
      const endOccupiedByAccessory=(editor.parts||[]).some(item=>item.type==='ACCESSORY' && item.mountReference?.targetPartId===partId && item.mountReference?.targetType==='PROFILE_END' && item.mountReference?.end===end);
      if(endOccupiedByConnection||endOccupiedByAccessory)return [];
      const nominal=String(part.designProfile?.nominal||getDesignProfileDefinition(part.designProfile?.profileId)?.nominal||'');
      const rows=databaseAccessories.filter(item=>{
        if(String(item.category||'').toUpperCase()!=='END_CAP')return false;
        const rule=parseCatalogJson(item.mountRuleJson);
        const required=String(rule.profileNominal||'').trim();
        return !required||required===nominal;
      }).slice(0,3).map(item=>({kind:'DATABASE',id:item.id,label:item.name||item.model||'端盖',end}));
      if(rows.length)return rows;
      return HardwareCatalogList.filter(item=>item.accessoryType==='END_CAP')
        .filter(item=>nominal===`${Number(item.size||0)}${Number(item.size||0)}`)
        .slice(0,2)
        .map(item=>({kind:'BUILTIN',id:item.id,label:item.label||'端盖',end}));
    }

    async function loadAccessoryCatalog({silent=false}={}) {
      accessoryCatalogLoading.value=true;
      try {
        const rows=await fetchAccessoryCatalog({includeDisabled:false});
        databaseAccessories.splice(0,databaseAccessories.length,...(rows||[]));
        if(!silent)notify(`配件库已刷新：${databaseAccessories.length} 个可用配件`);
      } catch(error) {
        if(!silent)notify(error.message||'配件目录读取失败','warning');
      } finally { accessoryCatalogLoading.value=false; }
    }

    async function loadAccessoryManagerRows() {
      const rows=await fetchAccessoryCatalog({includeDisabled:true});
      databaseAccessoryRows.splice(0,databaseAccessoryRows.length,...(rows||[]));
    }

    async function openAccessoryCatalogManager() {
      try {
        await loadAccessoryManagerRows();
        accessoryCatalogManagerVisible.value=true;
      } catch(error) { notify(error.message||'配件目录读取失败','error'); }
    }

    function closeAccessoryCatalogManager() {
      accessoryCatalogManagerVisible.value=false;
      accessoryEditorVisible.value=false;
    }

    function resetAccessoryForm(category='END_CAP') {
      const defaults={
        END_CAP:{model:'3030-END',name:'3030 黑色端盖',material:'尼龙',unit:'个',size:30,thickness:6,profileNominal:'3030'},
        FOOT:{model:'M12-60',name:'M12 调节脚杯 Ø60',material:'镀锌钢+尼龙',unit:'个',stemDiameter:12,stemLength:70,footDiameter:60,footThickness:12,thread:'M12'},
        CASTER:{model:'FUMA75',name:'福马轮 75',material:'钢+PU',unit:'个',wheelDiameter:75,wheelWidth:30,stemDiameter:12,stemLength:30,brake:true},
        DRAWER_SLIDE:{model:'SLIDE-450-3S',name:'450 mm 三节抽屉滑轨',material:'冷轧钢',unit:'副',length:450,width:12,height:45,side:'BOTH'}
      };
      Object.assign(accessoryForm,{id:null,category,enabled:true,size:30,thickness:6,profileNominal:'',stemDiameter:12,stemLength:70,footDiameter:60,footThickness:12,thread:'M12',wheelDiameter:75,wheelWidth:30,brake:true,length:450,width:12,height:45,side:'BOTH',...(defaults[category]||defaults.END_CAP)});
    }

    function openAccessoryEditor(item=null,{duplicate=false}={}) {
      if(!item) {
        accessoryEditorMode.value='create';
        resetAccessoryForm('END_CAP');
        accessoryEditorVisible.value=true;
        return;
      }
      const geometry=parseCatalogJson(item.geometryJson);
      const mountRule=parseCatalogJson(item.mountRuleJson);
      const bomRule=parseCatalogJson(item.bomRuleJson);
      Object.assign(accessoryForm,{
        id:duplicate?null:item.id,category:item.category||'END_CAP',model:duplicate?`${item.model}-COPY`:item.model,name:duplicate?`${item.name} 副本`:item.name,enabled:item.enabled!==false,material:bomRule.material||geometry.material||'',unit:bomRule.unit||'个',
        size:Number(geometry.size||30),thickness:Number(geometry.thickness||6),profileNominal:mountRule.profileNominal||'',
        stemDiameter:Number(geometry.stemDiameter||12),stemLength:Number(geometry.stemLength||70),footDiameter:Number(geometry.footDiameter||60),footThickness:Number(geometry.footThickness||12),thread:geometry.thread||mountRule.thread||'M12',
        wheelDiameter:Number(geometry.wheelDiameter||75),wheelWidth:Number(geometry.wheelWidth||30),brake:geometry.brake!==false,
        length:Number(geometry.length||450),width:Number(geometry.width||12),height:Number(geometry.height||45),side:mountRule.side||'BOTH'
      });
      accessoryEditorMode.value=duplicate?'duplicate':'edit';
      accessoryEditorVisible.value=true;
    }

    function accessoryPayload() {
      const category=String(accessoryForm.category||'').toUpperCase();
      let geometry={material:accessoryForm.material||''};
      let mountRule={};
      if(category==='END_CAP') {
        geometry={...geometry,size:Number(accessoryForm.size),thickness:Number(accessoryForm.thickness)};
        mountRule={target:'PROFILE_END',profileNominal:String(accessoryForm.profileNominal||'').trim()};
      } else if(category==='FOOT') {
        geometry={...geometry,stemDiameter:Number(accessoryForm.stemDiameter),stemLength:Number(accessoryForm.stemLength),footDiameter:Number(accessoryForm.footDiameter),footThickness:Number(accessoryForm.footThickness),thread:String(accessoryForm.thread||'').trim()};
        mountRule={target:'PROFILE_END',thread:String(accessoryForm.thread||'').trim()};
      } else if(category==='CASTER') {
        geometry={...geometry,wheelDiameter:Number(accessoryForm.wheelDiameter),wheelWidth:Number(accessoryForm.wheelWidth),stemDiameter:Number(accessoryForm.stemDiameter),stemLength:Number(accessoryForm.stemLength),brake:accessoryForm.brake===true};
        mountRule={target:'PROFILE_BOTTOM',mount:'STEM'};
      } else if(category==='DRAWER_SLIDE') {
        geometry={...geometry,length:Number(accessoryForm.length),width:Number(accessoryForm.width),height:Number(accessoryForm.height)};
        mountRule={target:'PANEL_SIDE',side:accessoryForm.side||'BOTH'};
      }
      return {
        id:accessoryForm.id,category,model:String(accessoryForm.model||'').trim(),name:String(accessoryForm.name||'').trim(),
        geometryJson:JSON.stringify(geometry),mountRuleJson:JSON.stringify(mountRule),bomRuleJson:JSON.stringify({unit:accessoryForm.unit||'个',material:accessoryForm.material||''}),enabled:accessoryForm.enabled!==false
      };
    }

    async function saveAccessoryEditor() {
      try {
        await saveAccessoryCatalog(accessoryPayload());
        await Promise.all([loadAccessoryManagerRows(),loadAccessoryCatalog({silent:true})]);
        accessoryEditorVisible.value=false;
        notify(accessoryEditorMode.value==='edit'?'配件已更新':'配件已保存');
      } catch(error) { notify(error.message||'配件保存失败','error'); }
    }

    async function toggleAccessoryCatalog(item) {
      try {
        await saveAccessoryCatalog({...item,enabled:item.enabled===false});
        await Promise.all([loadAccessoryManagerRows(),loadAccessoryCatalog({silent:true})]);
        notify(`${item.name} 已${item.enabled===false?'启用':'停用'}`);
      } catch(error) { notify(error.message||'配件启停失败','error'); }
    }

    async function removeAccessoryCatalog(item) {
      const used=editor?.parts?.some(part=>part.type==='ACCESSORY'&&part.hardwareSpec?.source==='ACCESSORY_CATALOG'&&Number(part.hardwareSpec?.catalogId)===Number(item.id));
      if(used)return notify(`当前工程正在使用 ${item.name}，请先删除对应配件构件`,'warning');
      if(!confirm(`删除配件 ${item.name}？`))return;
      try {
        await deleteAccessoryCatalog(item.id);
        await Promise.all([loadAccessoryManagerRows(),loadAccessoryCatalog({silent:true})]);
        notify(`已删除 ${item.name}`);
      } catch(error) { notify(error.message||'配件删除失败','error'); }
    }

    function addCatalogAccessory(item) {
      if(!item)return;
      try {
        cancelPlacementTools();
        const definition=accessoryDefinition(item);
        editor?.addHardware(definition.id,{definition});
        notify(`已添加：${definition.label}`);
      } catch(error) { notify(error.message||'配件添加失败','error'); }
    }

    function mountCatalogAccessory(item) {
      if(!item || !editor)return;
      try {
        const definition=accessoryDefinition(item);
        editor.connectionPlacementManager.cancel();
        editor.machiningPlacementManager.cancel();
        editor.profileDrawTool.stop();
        const seed=accessoryPlacementSeed.value ? structuredClone(accessoryPlacementSeed.value) : null;
        accessoryPlacementSeed.value=null;
        editor.accessoryPlacementManager.begin(definition,{seed});
        notify(seed?.partId ? `已预览 ${definition.label}，在画布单击确认安装` : `正在放置 ${definition.label}，移动到可安装位置后单击确认`,'success');
      } catch(error) { notify(error.message||'配件放置失败','warning'); }
    }

    function cancelAccessoryPlacement() {
      accessoryPlacementSeed.value=null;
      editor?.accessoryPlacementManager.cancel();
    }

    function mountedTargetLabel(reference) {
      const targetId=reference?.targetPartId;
      if(!targetId)return '-';
      const target=editor?.parts?.find(part=>part.id===targetId);
      if(!target)return `${targetId}（已不存在）`;
      return `${target.displayId||''}${target.displayId?' · ':''}${target.name||target.id}`;
    }

    function mountPositionLabel(reference) {
      if(reference?.targetType==='SHAFT_AXIS')return `光轴站位 · 距 A 端 ${Number(reference.stationS||0).toFixed(1)} mm`;
      const value=reference?.end || reference?.side || reference?.targetType || '';
      return ({START:'A端',END:'B端',FRONT:'正面',BACK:'背面',PROFILE_END:'型材端部',PROFILE_BOTTOM:'型材底端',PANEL_SIDE:'板材侧面'})[value] || value || '-';
    }

    function detachSelectedAccessory() {
      const part=selectedPart.value;
      if(!part?.mountReference)return;
      try {
        const detached=editor?.detachMountedAccessory(part.id);
        if(detached) {
          projectRevision.value++;
          notify('已解除安装关系，配件现在可以自由移动');
        }
      } catch(error) { notify(error.message||'解除安装失败','error'); }
    }

    async function saveCustomProfile() {
      try {
        const payload=buildCustomProfilePayload();
        await saveDatabaseProfile(payload);
        await loadDatabaseProfiles({silent:true});
        customProfileVisible.value=false;
        if(payload.enabled!==false) {
          newProfile.nominal=payload.nominal;
          newProfile.catalogId=payload.id;
        }
        const action=customProfileMode.value==='edit'?'已更新':customProfileMode.value==='duplicate'?'已复制':'已保存';
        notify(`${action}型材：${payload.variant}`);
      } catch(error) { notify(error.message||'自定义型材保存失败','error'); }
    }

    async function toggleDatabaseProfile(item) {
      try {
        await saveDatabaseProfile({...item,enabled:item.enabled===false});
        await loadDatabaseProfiles({silent:true});
        notify(`${item.variant} 已${item.enabled===false?'启用':'停用'}`);
      } catch(error) { notify(error.message||'型材启停失败','error'); }
    }

    async function removeDatabaseProfile(item) {
      if(item?.sourceFamily!=='DATABASE')return notify('内置型材不能从数据库删除','warning');
      const used=editor?.parts?.some(part=>part.type==='PROFILE'&&(part.designProfile?.profileId===item.id||part.manufacturingProfile?.profileId===item.id));
      if(used)return notify(`当前工程正在使用 ${item.variant}，请先替换这些构件再删除目录型号`,'warning');
      if(!confirm(`删除数据库型材 ${item.variant}？`))return;
      try { await deleteDatabaseProfile(item.id); await loadDatabaseProfiles({silent:true}); notify(`已删除 ${item.variant}`); }
      catch(error){ notify(error.message||'删除失败','error'); }
    }

    async function refreshProfileSectionPreview3D() {
      if(!customProfileVisible.value) {
        profileSectionPreview3d?.dispose();
        profileSectionPreview3d=null;
        return;
      }
      await nextTick();
      if(!profileSectionPreviewCanvas.value)return;
      if(!profileSectionPreview3d)profileSectionPreview3d=new ProfileSectionPreview3D(profileSectionPreviewCanvas.value);
      profileSectionPreview3d.setSection(customProfilePreviewState.value.section);
    }

    watch(customProfileForm,()=>refreshProfileSectionPreview3D(),{deep:true});
    watch(customProfileVisible,()=>refreshProfileSectionPreview3D());
    watch(activeLibrary,value=>{ if(value!=='accessory') accessoryPlacementSeed.value=null; });

    function notify(text, type = 'success') {
      toast.text = text;
      toast.type = type;
      toast.visible = true;
      clearTimeout(timer);
      timer = setTimeout(() => toast.visible = false, 2600);
    }

    onMounted(async () => {
      await nextTick();
      editor = new Editor(viewport.value);
      refreshCatalogPreview();
      diyGenerator = new DiyGenerator(editor);
      layoutManager = new WorkbenchLayoutManager().init();
      viewCube = new ViewCube(viewCubeViewport.value,editor.sceneManager,direction=>editor.viewDirection(direction));
      editor.onSelectionChanged = (object,selection = []) => {
        selected.value = object;
        selectedMeshes.value = selection;
        syncProfileLengthForm(object);
        if(object&&!editor.profileDrawTool.isActive()&&!editor.profilePlacementManager.isActive()&&!editor.connectionPlacementManager.isActive()&&!editor.accessoryPlacementManager.isActive()&&!editor.machiningPlacementManager.isActive())rightPanelMode.value='modify';
        lastSnap.value = object?.userData?.lastSnap || null;
        contextMenu.visible = false;
        selectedAssemblyId.value = object ? (object.userData?.part?.assemblyId || null) : selectedAssemblyId.value;
        if(editor.contourFrameManager?.active && selectedAssemblyId.value!==editor.contourFrameManager.assemblyId) editor.contourFrameManager.stop();
        if (object?.userData?.part?.type === 'PROFILE') profileReplaceForm.catalogId = object.userData.part.designProfile?.profileId || profileReplaceForm.catalogId;
      };
      editor.onDimensionsChanged = value => Object.assign(dimensions,value);
      editor.profilePlacementManager.onChanged=state=>Object.assign(profilePlacementState,state);
      editor.wholeStretchManager.onChanged=state=>Object.assign(wholeStretchState,state);
      editor.onInteractionError=message=>notify(message,'warning');
      editor.onStatsChanged = value => Object.assign(stats,value);
      editor.onSnapChanged = value => {
        lastSnap.value = value;
        if (!value?.preview && value?.targetFace) notify(`已吸附：${endLabel(value.sourceEnd)} → ${faceLabel(value.targetFace)}`,'success');
      };
      editor.onAutoConnectionChanged = result => {
        const label = designConnectionLabel(result?.connection?.designType || result?.connection?.type);
        notify(`已自动连接：${label}`,'success');
      };
      editor.onInterferenceChanged = state => {
        Object.assign(interferenceState,{active:false,live:false,count:0,contactCount:0,message:'',partIds:[],contactPartIds:[],...(state||{})});
      };
      editor.onTransformBlocked = state => {
        lastSnap.value=null;
        const first=state?.issues?.[0];
        notify(first?.message ? `位置已保留：${first.message}，请继续调整` : '位置已保留：型材发生干涉，请继续调整','warning');
      };
      editor.onGroundCrossed = state => notify(state.below?'底面已穿过地面，进入平面以下；可点击“落地”返回':'底面已越过地面，回到平面以上','info');
      editor.onConnectionsBroken = items => {
        const count=Array.isArray(items)?items.length:0;
        if(count)notify(`单个移动后 ${count} 个失效连接已解除；需要整体保持时请选择“保持连接移动”`,'warning');
      };
      autoConnectionEnabled.value = editor.autoConnectionEnabled !== false;
      editor.connectionPlacementManager.onChanged = state => {
        Object.assign(connectionPlacementState,{active:false,mode:null,step:1,message:'',...(state||{})});
        if(state?.notify && state?.message) notify(state.message,state.message.includes('失败')||state.message.includes('不支持')?'warning':'success');
      };
      editor.machiningPlacementManager.onChanged = state => {
        Object.assign(machiningPlacementState,{active:false,mode:null,message:'',...(state||{})});
        if(state?.notify && state?.message) notify(state.message,state.message.includes('失败')?'warning':'success');
      };
      editor.accessoryPlacementManager.onChanged = state => {
        Object.assign(accessoryPlacementState,{active:false,definitionId:null,label:'',valid:null,message:'',...(state||{})});
        if(state?.notify && state?.message) notify(state.message,state.message.includes('失败')||state.message.includes('不能')||state.message.includes('干涉')?'warning':'success');
      };
      editor.onProjectChanged = () => {
        projectRevision.value++;
        if(document.activeElement?.id!=='selected-profile-length')syncProfileLengthForm();
        dirty.value = true;
        saveAutosave();
      };
      editor.onContextMenu = payload => {
        jointQuickMenu.visible=false;
        relationQuickMenu.visible=false;
        contextMenu.x = Number(payload.event.clientX||0);
        contextMenu.y = Number(payload.event.clientY||0);
        contextMenu.partType = payload.mesh?.userData?.part?.type || null;
        contextMenu.partId = payload.mesh?.userData?.part?.id || null;
        contextMenu.worldPoint = payload.hit?.point ? {x:payload.hit.point.x,y:payload.hit.point.y,z:payload.hit.point.z} : null;
        contextMenu.end = null;
        contextMenu.lengthMm = Number(payload.mesh?.userData?.part?.dimensions?.length || 0);
        contextMenu.nearJoint = false;
        contextMenu.connectionCandidates = [];
        contextMenu.accessoryCandidates = [];
        if (payload.mesh?.userData?.part?.type === 'PROFILE' && payload.hit?.point) {
          const feature = editor.snapManager.resolveFeatureAtPoint(payload.mesh,payload.hit.point,{endToleranceMm:46,slotToleranceMm:20});
          if (feature?.type === 'PROFILE_END') contextMenu.end = feature.end;
          const joint = editor.connectionPlacementManager.resolveJointContext({object:payload.mesh,point:payload.hit.point});
          if (joint) {
            contextMenu.nearJoint = true;
            contextMenu.connectionCandidates = joint.designCandidates.filter(item=>item.valid).map(item=>({type:item.type,label:item.label,score:item.score}));
          }
          contextMenu.accessoryCandidates = buildEndCapCandidates(contextMenu.partId,contextMenu.worldPoint,contextMenu.end);
          if(contextMenu.accessoryCandidates.length)contextMenu.nearJoint=true;
        }
        contextMenu.visible = true;
        fitFloatingMenu(contextMenu,'[data-context-menu=\"main\"]',payload.event.clientX,payload.event.clientY,8);
      };
      editor.onJointHover = payload => {
        if(!payload?.hit || contextMenu.visible || relationQuickMenu.visible) { if(!contextMenu.visible)jointQuickMenu.visible=false; return; }
        const partId=payload.hit?.object?.userData?.part?.id||null;
        const worldPoint=payload.hit?.point?{x:payload.hit.point.x,y:payload.hit.point.y,z:payload.hit.point.z}:null;
        const feature=payload.hit?.object&&payload.hit?.point?editor.snapManager.resolveFeatureAtPoint(payload.hit.object,payload.hit.point,{endToleranceMm:46,slotToleranceMm:20}):null;
        const end=feature?.type==='PROFILE_END'?feature.end:null;
        const connectionCandidates=(payload.joint?.designCandidates||[]).filter(item=>item.valid).map(item=>({type:item.type,label:item.label,score:item.score}));
        const accessoryCandidates=buildEndCapCandidates(partId,worldPoint,end);
        if(!connectionCandidates.length&&!accessoryCandidates.length){jointQuickMenu.visible=false;return;}
        const keepPosition=jointQuickMenu.visible && jointQuickMenu.partId===partId && jointQuickMenu.end===end;
        Object.assign(jointQuickMenu,{
          visible:true,
          x:keepPosition?jointQuickMenu.x:Number(payload.event?.clientX||0)+14,
          y:keepPosition?jointQuickMenu.y:Number(payload.event?.clientY||0)+14,
          partId,worldPoint,end,connectionCandidates,accessoryCandidates
        });
        if(!keepPosition)fitFloatingMenu(jointQuickMenu,'[data-context-menu=\"joint\"]',Number(payload.event?.clientX||0),Number(payload.event?.clientY||0),14);
      };
      editor.onFeatureSelectionChanged = items => { selectedFeatures.value = items || []; };
      editor.featureHoverManager.onChanged = value => { featureHover.value = value; };
      editor.profileDrawTool.onStateChanged = state => {
        const wasDrawing=drawState.active;
        Object.assign(drawState,{active:!!state.active,mode:state.mode||'OFF',axisLock:state.axisLock||null,start:state.start||null,hover:state.hover||null,committed:state.committed||null,lengthMm:state.lengthMm??null,typedLength:state.typedLength||'',segmentCount:Number(state.segmentCount||0),contourPointCount:Number(state.contourPointCount||0),assemblyId:state.assemblyId||null});
        if(state.options) Object.assign(drawForm,state.options);
        if(wasDrawing&&!state.active){
          contextMenu.visible=false;
          if(editor.selected)rightPanelMode.value='modify';
        }
        if(state.committed==='PROFILE') notify(`已绘制型材 L${Math.round(Number(state.lengthMm||0))}${state.autoConnections ? ` · 自动连接 ${state.autoConnections} 处` : ''}`);
        else if(state.committed==='RECTANGLE') notify(`已绘制矩形框架 · ${state.createdCount||4} 根型材`);
        else if(state.committed==='BOX') notify(`已放置空间框架${state.autoConnections ? ` · 自动连接 ${state.autoConnections} 处` : ''}`);
        else if(state.committed==='CONTOUR'){ selectedAssemblyId.value=state.assemblyId||selectedAssemblyId.value; notify(`已生成闭合轮廓框架 · ${state.createdCount||0} 根型材${state.autoConnections ? ` · 自动连接 ${state.autoConnections} 处` : ''}`); }
      };
      editor.contourFrameManager.onChanged = state => {
        Object.assign(contourEditState,{active:false,assemblyId:null,pointCount:0,points:[],edges:[],orthogonal:true,plane:'XZ',message:'',...(state||{})});
        if(state?.notify && state?.message) notify(state.message,state.error?'warning':'success');
        projectRevision.value++;
      };
      editor.contourFrameManager.onDimensionRequest = request => {
        const current=Number(request?.lengthMm||0);
        const value=window.prompt(`第 ${Number(request?.edgeIndex||0)+1} 条边长度（mm）`,String(current));
        if(value===null)return;
        const length=Number(value);
        if(!Number.isFinite(length)||length<10)return notify('边长必须是大于等于 10 mm 的数字','warning');
        try { editor.setContourFrameEdgeLength(request.edgeIndex,length); projectRevision.value++; }
        catch(error){ notify(error.message||'边长调整失败','warning'); }
      };
      editor.contourFrameManager.onContextAction = action => {
        if(action?.type==='INSERT_POINT'){
          try { editor.insertContourFramePoint(action.edgeIndex,action.worldPoint); projectRevision.value++; }
          catch(error){ notify(error.message||'插入轮廓点失败','warning'); }
          return;
        }
        if(action?.type==='DELETE_POINT'){
          if(!window.confirm(`删除轮廓点 ${Number(action.pointIndex||0)+1}？`))return;
          try { editor.deleteContourFramePoint(action.pointIndex); projectRevision.value++; }
          catch(error){ notify(error.message||'删除轮廓点失败','warning'); }
        }
      };
      editor.contourFrameManager.onRelationRequest = request => {
        activeContourConstraintId.value=request?.constraintId||null;
        inspectorTab.value='properties';
        contextMenu.visible=false;
        jointQuickMenu.visible=false;
        const item=request?.constraint;
        if(!item)return;
        Object.assign(relationQuickMenu,{
          visible:true,
          x:Number(request.clientX||0)+12,
          y:Number(request.clientY||0)+12,
          constraintId:item.id,
          type:item.type,
          edgeA:Number(item.edgeA||0),edgeB:Number(item.edgeB??1),
          pointA:Number(item.pointA||0),pointB:Number(item.pointB??1),
          mode:item.mode||'HORIZONTAL'
        });
        fitFloatingMenu(relationQuickMenu,'[data-context-menu=\"relation\"]',Number(request.clientX||0),Number(request.clientY||0),12);
        notify(`已定位轮廓关系：${contourConstraintLabel(item)}`);
      };
      editor.assemblyPlaybackManager.onChanged = state => {
        Object.assign(assemblyPlaybackState,{active:false,playing:false,currentIndex:-1,currentStepId:null,currentStepNumber:0,currentTitle:'',total:0,...(state||{})});
        activeAssemblyInstructionStepId.value=state?.currentStepId||null;
      };
      editor.profileGripEditor.onStateChanged = state => {
        Object.assign(gripState,{active:false,end:null,lengthMm:null,typed:'',snappedFeature:null,message:'',blocked:false,error:false,...(state||{})});
        if(state?.committed){profileLengthForm.fixedEnd=state.end==='END'?'START':'END';syncProfileLengthForm();}
        if(state?.committed) notify(`${state.end==='START'?'A':'B'}端拉伸完成 · L${Math.round(Number(state.lengthMm||0))}`);
        else if(state?.blocked) notify(state.message||'该端点受约束','warning');
        else if(state?.error) notify(state.message||'长度输入无效','error');
      };
      editor.profileGripEditor.onEditRequested = async ({end}) => {
        rightPanelMode.value='modify';inspectorTab.value='properties';
        syncProfileLengthForm(selected.value);
        profileLengthForm.fixedEnd=end==='END'?'START':'END';
        await nextTick();
        const input=document.getElementById('selected-profile-length');
        input?.focus();input?.select();
      };
      Object.assign(drawForm,editor.profileDrawTool.options||{});
      transformSpace.value = editor.transformSpace || 'world';
      movementStepMm.value = Number(editor.movementStepMm || 0);
      transformMoveScope.value = editor.transformMoveScope || 'SINGLE';
      workPlaneVisible.value = editor.workPlaneVisualizer?.visible !== false;
      editor.setWorkPlane(drawForm.plane || 'XZ');
      Object.assign(engineeringDrawingForm,editor.drawingSettings||{});
      editor.onMeasurementChanged = value => {
        measureResult.value = value;
      };
      editor.onUserDimensionsChanged = (items,state) => {
        userDimensions.value = items || [];
        dimensionState.value = state;
      };
      Object.assign(annotationOptions,editor.annotationManager.options);
      userDimensions.value = structuredClone(editor.userDimensions || []);
      await loadDatabaseProfiles({silent:true});
      await loadAccessoryCatalog({silent:true});
      // 目录注册和回调就绪后再恢复；成功或确认新建以前，启动空白状态不得覆盖旧草稿。
      initializeLocalDraft();
      window.addEventListener('pagehide',flushLocalDraft);
      window.addEventListener('beforeunload',flushLocalDraft);
      document.addEventListener('visibilitychange',handleDraftVisibility);
      window.addEventListener('pointerdown',closeContextMenu,true);
      window.addEventListener('pointerdown',handleCadMenuPointerDown,true);
      window.addEventListener('click',handleCadMenuClick,true);
      editor.updateDimensions();
      editor.emitStats();
      window.addEventListener('keydown', handleKeyboard);
      window.addEventListener('keyup', handleKeyboardUp);
      window.AluminumCadBoot?.ready();
      // 底栏因绘制/旋转或窄屏换行变高时，更新实际画布，不改变工程坐标。
      viewportResizeObserver=new ResizeObserver(()=>{hideFooterTip();repositionFooterMenus();editor?.sceneManager.resize();});
      viewportResizeObserver.observe(viewport.value);
    });

    onBeforeUnmount(() => {
      hideFooterTip();
      viewportResizeObserver?.disconnect();
      window.removeEventListener('keydown', handleKeyboard);
      window.removeEventListener('keyup', handleKeyboardUp);
      window.removeEventListener('pointerdown',closeContextMenu,true);
      window.removeEventListener('pointerdown',handleCadMenuPointerDown,true);
      window.removeEventListener('click',handleCadMenuClick,true);
      flushLocalDraft();
      window.removeEventListener('pagehide',flushLocalDraft);
      window.removeEventListener('beforeunload',flushLocalDraft);
      document.removeEventListener('visibilitychange',handleDraftVisibility);
      profileSectionPreview3d?.dispose();
      catalogProfilePreview?.dispose();
      profileSectionPreview3d=null;
      layoutManager?.destroy();
      layoutManager=null;
      viewCube?.dispose();viewCube=null;
      editor?.profileDrawTool.dispose();
      editor?.profilePlacementManager.cancel();
      editor?.selectionGestureManager.dispose();
      editor?.wholeStretchManager.dispose();
    });

    function handleKeyboard(event) {
      if(event.key==='Escape')hideFooterTip();
      if(event.key==='Control'&&drawState.active)editor?.setSnapTemporarilyDisabled(true);
      if (event.defaultPrevented || gripState.active) return;
      if(event.key==='Escape'){
        closeCadMenus();
        if(shaftSmart.visible){event.preventDefault();shaftSmart.visible=false;return;}
        if(showShortcutHelp.value){event.preventDefault();showShortcutHelp.value=false;return;}
        if(validationVisible.value){event.preventDefault();closeValidation();return;}
        if(manufacturingConfigVisible.value){event.preventDefault();manufacturingConfigVisible.value=false;return;}
        if(engineeringCenterVisible.value){event.preventDefault();engineeringCenterVisible.value=false;return;}
      }
      // 模态窗口期间不能用背景快捷键创建、删除或变换工程构件。
      if(document.querySelector('.modal-backdrop'))return;
      if(event.key==='Escape'&&wholeStretchState.active){event.preventDefault();cancelWholeStretch();return;}
      if(event.key==='Escape'&&editor?.selectionGestureManager.cancelDrag()){event.preventDefault();return;}
      if(event.key==='Escape'&&profilePlacementState.active){event.preventDefault();cancelPlacementTools();return;}
      if(event.key==='Escape'&&quickAlignmentVisible.value){event.preventDefault();quickAlignmentVisible.value=false;return;}
      // Esc 退出放置也必须在规格框聚焦时生效，不能要求玩家先点一次画布。
      if(event.key==='Escape'&&(connectionPlacementState.active||accessoryPlacementState.active||machiningPlacementState.active)){
        event.preventDefault();cancelPlacementTools();return;
      }
      // 绘制中的退出不能被表单焦点吞掉；已打开的模态窗口保留自己的 Esc 语义。
      if(event.key==='Escape'&&drawState.active&&!document.querySelector('.modal-backdrop,.engineering-center-backdrop')){
        event.preventDefault();stopProfileDraw();return;
      }
      const target = event.target;
      if (target && (['INPUT','SELECT','TEXTAREA'].includes(target.tagName)||target.isContentEditable)) return;
      if(event.key==='Enter'&&wholeStretchState.active){event.preventDefault();confirmWholeStretch();return;}
      if(event.key.toLowerCase()==='b'&&event.shiftKey&&!event.ctrlKey&&!event.metaKey){event.preventDefault();startWholeStretch();return;}
      if(event.code==='Space'&&!event.ctrlKey&&!event.metaKey&&!event.altKey){if(editor?.selectionGestureManager.setSpace(true))event.preventDefault();return;}
      if(event.key==='Tab'&&profilePlacementState.active){event.preventDefault();editor.profilePlacementManager.cycle(event.shiftKey?-1:1);return;}
      if(event.key==='Tab'&&connectionPlacementState.active){event.preventDefault();editor?.connectionPlacementManager.cycleCandidate(event.shiftKey?-1:1);return;}
      if(event.altKey&&!event.ctrlKey&&!event.metaKey&&['x','y','z'].includes(event.key.toLowerCase())) {
        event.preventDefault();if(!event.repeat)quickRotate(event.key.toUpperCase());return;
      }
      if (drawState.active && !event.ctrlKey && !event.metaKey) {
        const handled=editor?.profileDrawTool.handleKeyDown?.(event)===true;
        if(handled){event.preventDefault();return;}
      }
      if(!drawState.active&&!profilePlacementState.active&&!connectionPlacementState.active&&!accessoryPlacementState.active&&!machiningPlacementState.active&&!measureMode.value&&!dimensionMode.value&&!boxSelectMode.value&&!lassoSelectMode.value&&!featureSelectMode.value&&!contextMenu.visible&&!jointQuickMenu.visible&&!relationQuickMenu.visible){
        if(editor?.axisClearanceManager.handleKey(event)){event.preventDefault();return;}
      }
      if (event.ctrlKey || event.metaKey) {
        if (event.key.toLowerCase() === 's') {
          event.preventDefault();
          exportJson();
          return;
        }
        if (event.key.toLowerCase() === 'z') {
          event.preventDefault();
          event.shiftKey ? redo() : undo();
          return;
        }
        if (event.key.toLowerCase() === 'y') {
          event.preventDefault();
          redo();
          return;
        }
        if (event.key.toLowerCase() === 'd') {
          event.preventDefault();
          duplicateSelected();
          return;
        }
        if (event.key.toLowerCase() === 'g') {
          event.preventDefault();
          event.shiftKey?ungroupSelection():groupSelection();
          return;
        }
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selected.value) {
          event.preventDefault();
          deleteSelected(false);
        }
      } else if (event.key === 'Tab' && lastSnap.value?.candidateCount > 1) {
        event.preventDefault();
        const snap = editor?.cycleSnapCandidate(event.shiftKey ? -1 : 1);
        if (snap) { lastSnap.value = snap; notify(`吸附候选 ${snap.candidateIndex}/${snap.candidateCount}`,'warning'); }
      } else if (event.key === 'Escape') {
        contextMenu.visible=false;
        jointQuickMenu.visible=false;
        relationQuickMenu.visible=false;
        if (assemblyPlaybackState.active) { restoreAssemblyInstructionView(); return; }
        if (connectionPlacementState.active) { cancelConnectionPlacement(); return; }
        if (accessoryPlacementState.active) { cancelAccessoryPlacement(); return; }
        if (machiningPlacementState.active) { cancelMachiningPlacement(); return; }
        if (drawState.active) { stopProfileDraw(); return; }
        if (measureMode.value) toggleMeasure();
        if (dimensionMode.value) toggleDimensionMode();
        if (boxSelectMode.value) toggleBoxSelect();
        if (lassoSelectMode.value) toggleLassoSelect();
        if (featureSelectMode.value) toggleFeatureSelectMode();
        editor?.select(null);
      }
      else if (event.key.toLowerCase() === 'e') toggleQuickAlignment();
      else if (event.key.toLowerCase() === 'b') openQuickPanel('build');
      else if (event.key.toLowerCase() === 'l') toggleLassoSelect();
      else if (event.key.toLowerCase() === 'x') ungroupSelection();
      else if (event.key.toLowerCase() === 't') toggleMeasure();
      else if (event.key.toLowerCase() === 'd') {if(selected.value)deleteSelected(false);}
      else if (['w','m'].includes(event.key.toLowerCase())) setMode('translate');
      else if (event.key.toLowerCase() === 'r') setMode('rotate');
      else if (event.key.toLowerCase() === 's') openShaftSmart();
      else if (event.key.toLowerCase() === 'g') groupSelection();
      else if (event.key.toLowerCase() === 'q') toggleProjection();
      else if (event.key.toLowerCase() === 'i' && selected.value) isolateSelectedParts();
      else if (event.key.toLowerCase() === 'h' && event.shiftKey) showAllParts();
      else if (event.key.toLowerCase() === 'h' && selected.value) hideSelection();
      else if (event.key.toLowerCase() === 'f') fitView();
      else if (event.key.toLowerCase() === 'v') viewIso();
      else if (event.key === '1') viewFront();
      else if (event.key === '2') viewBack();
      else if (event.key === '3') viewLeft();
      else if (event.key === '4') viewRight();
      else if (event.key === '5') viewTop();
      else if (event.key === '6') viewBottom();
    }

    function handleKeyboardUp(event) {
      if(event.code==='Space')editor?.selectionGestureManager.setSpace(false);
      if(event.key==='Control')editor?.setSnapTemporarilyDisabled(false);
      if(['Alt','Shift'].includes(event.key))editor?.profileDrawTool.handleModifierChange(event);
    }

    function quickNominal(nominal) {
      newProfile.nominal = String(nominal);
      nominalChanged();
    }

    function nominalChanged() {
      newProfile.catalogId = getDefaultDesignProfileId(newProfile.nominal);
      newProfileModelChanged();
    }

    function newProfileModelChanged() {
      const definition = getDesignProfileDefinition(newProfile.catalogId);
      if (!definition) return;
      newProfile.nominal = definition.nominal;
      newProfile.faceClosures = [...(definition.defaultFaceClosures || [])];
      profileClosure.value='';
      if(definition.id==='DESIGN-U88')newProfile.length=1800;
      hasChosenProfile.value=true;
      syncDrawProfile(definition.id);
    }

    function toggleNewProfileFaceClosure(face) {
      const value=String(face).toUpperCase();
      const set=new Set((newProfile.faceClosures||[]).map(item=>String(item).toUpperCase()));
      set.has(value)?set.delete(value):set.add(value);
      newProfile.faceClosures=[...set];
      editor?.profileDrawTool.configure({faceClosures:[...newProfile.faceClosures]});
    }

    function startProfileDrag(catalogId,event) {
      dragAsset.value = {type:'PROFILE',catalogId};
      if (event?.dataTransfer) {
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('text/plain',catalogId);
      }
    }

    function dropAsset(event) {
      if (!editor || !dragAsset.value) return;
      const asset = dragAsset.value;
      dragAsset.value = null;
      const point = editor.sceneManager.worldPointOnGround(event,0);
      if (!point) return;
      if (asset.type === 'PROFILE') {
        const definition = getDesignProfileDefinition(asset.catalogId);
        if (!definition) return;
        const placed = editor.placeProfileWithSnap(definition.id,Number(newProfile.length),{
          faceClosures:[...(newProfile.faceClosures||[])],
          position:{x:Math.round(point.x),y:Number(definition.height)/2,z:Math.round(point.z)}
        });
        const autoLabel = placed.autoConnection?.status === 'CREATED' ? ' · 已自动连接' : (placed.snap ? ' · 已吸附' : '');
        notify(`已放置 ${definition.name}${autoLabel}`);
      }
    }

    function quickAddProfile(catalogId) {
      const definition = getDesignProfileDefinition(catalogId);
      syncDrawProfile(catalogId);
      if (!definition) return;
      if(newProfile.catalogId!==definition.id)newProfile.faceClosures=[...(definition.defaultFaceClosures||[])];
      newProfile.nominal = definition.nominal;
      newProfile.catalogId = definition.id;
      hasChosenProfile.value=true;
      if(definition.id==='DESIGN-U88'&&newProfile.free){
        const length=Number(newProfile.length);
        if(!Number.isFinite(length)||length<10||length>3000)return notify('A 柱长度应为 10–3000 mm','warning');
        return beginCatalogPlacement({id:'DIY-U88',label:`A柱 U型 8x8 L=${length}`,mountRule:{target:'FREE'},partSpec:{type:'PROFILE',dimensions:{length,sectionSize:[...definition.sectionSize]},designProfile:{profileId:definition.id,faceClosures:[...newProfile.faceClosures]},color:'#d9d9d9'}});
      }
      cancelPlacementTools();
      try{editor.profilePlacementManager.begin(definition.id,Number(newProfile.length),{faceClosures:[...newProfile.faceClosures]});rightPanelMode.value='create';activeLibrary.value='profile';notify(`已选 ${definition.name} · 点击落位，Tab 切换方向，Esc 退出`);}
      catch(error){notify(error.message,'warning');}
    }

    function openInspectorForNewProfile() {
      profileAdvanced.value = !profileAdvanced.value;
    }

    function addConfiguredProfile() {
      const definition = getDesignProfileDefinition(newProfile.catalogId);
      if (!definition) return notify('未找到设计截面','error');
      hasChosenProfile.value=true;
      if(newProfile.pathType!=='ARC'){
        startProfileDraw('FREE',{fixedLengthMm:Number(newProfile.length)});
        return;
      }
      const path = newProfile.pathType === 'ARC'
        ? {type:'ARC',radius:Number(newProfile.radius),angleDeg:Number(newProfile.angleDeg),plane:newProfile.plane}
        : {type:'LINE',length:Number(newProfile.length)};
      editor.addProfile(definition.id,Number(newProfile.length),{faceClosures:[...(newProfile.faceClosures||[])],path});
      notify(`已添加 ${definition.name}`);
    }

    function startProfileDraw(mode='FREE',options={}) {
      if (!editor) return;
      if(mode==='FREE'&&!hasChosenProfile.value){
        quickPanel.value='';openResource('profile');notify('请先在右侧选择型材，再点击预览开始绘制','warning');return;
      }
      if (measureMode.value) toggleMeasure();
      if (dimensionMode.value) toggleDimensionMode();
      if (boxSelectMode.value) toggleBoxSelect();
      if (lassoSelectMode.value) toggleLassoSelect();
      if (featureSelectMode.value) toggleFeatureSelectMode();
      editor.connectionPlacementManager.cancel();editor.machiningPlacementManager.cancel();editor.accessoryPlacementManager.cancel();
      editor.profilePlacementManager.cancel();
      quickPanel.value=['RECTANGLE','BOX','CONTOUR'].includes(mode)?'build':'';
      rightPanelMode.value='create';activeLibrary.value='profile';
      if(Object.hasOwn(options,'fixedLengthMm'))drawForm.fixedLengthMm=Number(options.fixedLengthMm||0);
      editor.profileDrawTool.begin(mode,{...drawForm,faceClosures:[...(newProfile.faceClosures||[])]});
      if(mode!=='FREE')notify('快捷搭建：点击画布定位并生成框架','warning');
    }

    function stopProfileDraw() {
      editor?.profileDrawTool.stop();
    }

    function cancelProfileDrawStep(){editor?.profileDrawTool.cancelStep();}
    function confirmProfileDraw(){
      const tool=editor?.profileDrawTool;
      if(!tool?.start)return;
      const input=tool.lengthOverlay?.input;
      // 就地输入框可能已人工改过值，不能被之前键盘缓存的长度覆盖。
      const length=Number(input?.value||tool.typedLength);
      if(!tool.commitLength(length))notify('当前长度或位置不可用，请调整后确认','warning');
    }

    function finishContourDraw() {
      try { editor?.profileDrawTool.finishContour(); }
      catch(error){ notify(error.message,'warning'); }
    }

    function drawOptionsChanged() {
      editor?.profileDrawTool.configure({...drawForm});
      editor?.setWorkPlane(drawForm.plane);
    }

    function syncDrawProfile(catalogId) {
      if(!catalogId)return;
      drawForm.catalogId=catalogId;
      drawOptionsChanged();
    }

    function addShaft() {
      if(![newShaft.diameter,newShaft.length].every(value=>Number.isFinite(Number(value))&&Number(value)>0))return notify('请输入大于 0 的光轴直径和长度','warning');
      editor.addShaft(Number(newShaft.diameter),Number(newShaft.length),{material:newShaft.material});
      notify(`已添加 Ø${newShaft.diameter} 光轴`);
    }

    function beginCatalogPlacement(definition,free=false) {
      try {
        cancelPlacementTools();
        const spec=structuredClone(definition);if(free)spec.mountRule={target:'FREE'};
        editor.accessoryPlacementManager.begin(spec);
        notify(`${definition.label}：到画布选择位置，单击确认，Esc 取消`);
      }catch(error){notify(error.message||'无法开始放置','warning');}
    }
    function placeShaftComponent() {
      if(newShaft.type!=='ROD')return beginCatalogPlacement(currentShaftComponent.value,newShaft.free);
      if(!Number.isFinite(Number(newShaft.length))||Number(newShaft.length)<=0)return notify('光轴长度必须大于 0','warning');
      beginCatalogPlacement({id:'DIY-SHAFT',label:`光轴杆件 Φ${newShaft.diameter}mm L=${newShaft.length}`,mountRule:{target:'FREE'},
        partSpec:{type:'SHAFT',dimensions:{diameter:newShaft.diameter,length:newShaft.length},color:'#bfc7ce',material:newShaft.material}});
    }
    function placePanelComponent() {
      try {
        const dimensions=panelDimensions(newPanel.shape,newPanel.parameters,newPanel.edgeMode);
        if(!newPanel.free){if(newPanel.shape!=='rectangle')return notify('框口填板目前支持矩形；其他形状请选择自由添加','warning');panelFitForm.thickness=dimensions.thickness;panelFitForm.material=newPanel.material;return createPanelFromOpening();}
        beginCatalogPlacement({id:`DIY-PANEL-${newPanel.shape}`,label:panelShapeLabel.value,dimensions,mountRule:{target:'FREE'},
          partSpec:{type:'PANEL',dimensions,color:panelMaterialColors[newPanel.material],material:newPanel.material}});
      }catch(error){notify(error.message,'warning');}
    }
    function placeConnectionComponent() {
      const definition=currentConnectionComponent.value;
      const designType=connectionDesignType(definition);
      if(catalogConnectionForm.free||!designType||definition.dimensions.size===15)return beginCatalogPlacement(definition,true);
      cancelPlacementTools();editor.connectionPlacementManager.begin(designType,{componentDefinition:structuredClone(definition)});
      notify('靠近接头自动吸附、自动转向；绿色后单击确认，Tab 切换，Esc 取消');
    }
    function snapSelectedConnection() {
      try{
        const partId=selectedPart.value?.id;
        cancelPlacementTools();editor.connectionPlacementManager.beginExisting(partId);
        notify('靠近要安装的接头，绿色后确认；取消保留原件，确认后转为随动的接头连接');
      }catch(error){notify(error.message||'无法开始连接件吸附','warning');}
    }
    function editorCycleConnectionCandidate(){editor?.connectionPlacementManager.cycleCandidate(1);}
    function placeAccessoryComponent() {beginCatalogPlacement(currentAccessoryComponent.value,catalogAccessoryForm.free);}

    function addPanel() {
      if(![newPanel.width,newPanel.height,newPanel.thickness].every(value=>Number.isFinite(Number(value))&&Number(value)>0))return notify('请输入大于 0 的板材宽、高和厚度','warning');
      editor.addPanel(Number(newPanel.width),Number(newPanel.height),Number(newPanel.thickness),{material:newPanel.material,color:panelMaterialColors[newPanel.material]});
      notify(`已添加 ${newPanel.material}`);
    }

    function applyPanelPreset(thickness, material) {
      newPanel.thickness = thickness;
      newPanel.material = material;
      if(newPanel.parameters.thickness!==undefined)newPanel.parameters.thickness=thickness;
    }

    function createPanelFromOpening() {
      try {
        const result=editor.createPanelFromSelectedOpening(panelFitForm);
        projectRevision.value++;
        notify(`已按框口生成 ${Math.round(result.panel.dimensions.width)}×${Math.round(result.panel.dimensions.height)} 板材`);
      } catch(error) { notify(error.message,'warning'); }
    }

    function refitSelectedPanel() {
      try {
        const part=selectedPart.value;
        if(!part)throw new Error('请先选择框口板材');
        editor.refitConfiguredPanel(part.id);
        projectRevision.value++;
        notify('板材已重新适配当前框口');
      } catch(error) { notify(error.message,'warning'); }
    }

    function createDoorFromOpening() {
      try {
        const result=editor.createDoorFromSelectedOpening(doorForm);
        projectRevision.value++;
        notify(`已生成门组件 · ${result.profiles.length} 根门框型材 · 自动连接 ${Number(result.autoConnection?.createdCount||0)} 处`);
      } catch(error) { notify(error.message,'warning'); }
    }

    function refitSelectedDoor() {
      try {
        const assemblyId=selectedPart.value?.configuratorId || selectedPart.value?.assemblyId;
        if(!assemblyId)throw new Error('当前构件不属于配置门组件');
        editor.refitConfiguredDoor(assemblyId);
        projectRevision.value++;
        notify('门组件已按当前宿主框口重新计算');
      } catch(error) { notify(error.message,'warning'); }
    }

    function replaceSelectedProfiles() {
      try {
        const result=editor.replaceProfiles(profileReplaceForm.catalogId,{scope:profileReplaceForm.scope,autoRepair:profileReplaceForm.autoRepair});
        projectRevision.value++;
        const suffix=result.invalidConnectionIds.length?` · ${result.invalidConnectionIds.length} 个连接需检查`:(result.repairedConnectionIds.length?` · 自动修复 ${result.repairedConnectionIds.length} 个连接`:'');
        notify(`已替换 ${result.count} 根型材${suffix}`,result.invalidConnectionIds.length?'warning':'success');
      } catch(error) { notify(error.message,'warning'); }
    }

    function selectDiyTemplate(templateId) {
      const template = getDiyTemplate(templateId);
      if (!template) return;
      diyTemplateId.value = template.id;
      Object.assign(diyForm, template.defaults, {catalogId:diyForm.catalogId || getDefaultDesignProfileId('3030')});
    }

    function generateDiyTemplate() {
      if (!diyGenerator) return;
      try {
        const result = diyGenerator.generate(diyTemplateId.value, diyForm);
        const connectionCount = Number(result.autoConnection?.createdCount || 0);
        notify(`已生成 ${result.template.label} · ${result.createdPartCount} 个构件${connectionCount ? ` · 自动连接 ${connectionCount} 处` : ''}`);
      } catch (error) {
        notify(error.message || 'DIY 模板生成失败', 'error');
      }
    }

    function generateFrame() {
      try {
        editor.addFrame(frameForm);
        notify(`已生成 ${frameForm.width}×${frameForm.depth}×${frameForm.height} 框架`);
      } catch (error) {
        notify(error.message,'error');
      }
    }

    function generateDrawers() {
      try {
        editor.addDrawerGroup(drawerForm);
        notify(`已生成 ${drawerForm.count} 组抽屉`);
      } catch (error) {
        notify(error.message,'error');
      }
    }

    function selectedNominalChanged() {
      if (!selectedIsProfile.value) return;
      const nominal=selectedPart.value.designProfile?.nominal || '3030';
      selectedPart.value.designProfile.profileId = getDefaultDesignProfileId(nominal);
      selectedProfileModelChanged();
    }

    function selectedProfileModelChanged(change) {
      const definition = getDesignProfileDefinition(selectedPart.value?.designProfile?.profileId);
      if (!definition) return;
      // 型号自带封面不能作为用户额外封边带到下一型号，否则 B→A 仍会显示两个封面。
      const previousDefaults=new Set(getDesignProfileDefinition(change?.previousId)?.defaultFaceClosures||[]);
      const closures=[...new Set([...(definition.defaultFaceClosures||[]),...(selectedPart.value?.designProfile?.faceClosures||[]).filter(face=>!previousDefaults.has(face))])];
      editor.applySelectedProfileSpec(definition.id,{faceClosures:closures});
      notify(`已切换截面 ${definition.name}`);
    }

    function profileMetaChanged() {
      if (!selectedIsProfile.value) return;
      editor.updateSelectedProfileMeta({faceClosures:[...(selectedPart.value.designProfile?.faceClosures||[])]});
    }

    function toggleSelectedFaceClosure(face) {
      if(!selectedIsProfile.value)return;
      const value=String(face).toUpperCase();
      const set=new Set((selectedPart.value.designProfile?.faceClosures||[]).map(item=>String(item).toUpperCase()));
      set.has(value)?set.delete(value):set.add(value);
      selectedPart.value.designProfile.faceClosures=[...set];
      profileMetaChanged();
    }

    function selectedPathChanged() {
      if (!selectedIsProfile.value) return;
      const path = selectedPart.value.profilePath || {type:'LINE',length:selectedPart.value.dimensions.length};
      if (path.type === 'ARC') {
        editor.updateSelectedPath({
          type:'ARC',
          radius:Number(path.radius || 1000),
          angleDeg:Number(path.angleDeg || 90),
          plane:path.plane || 'XZ'
        });
      } else {
        editor.updateSelectedPath({type:'LINE',length:Number(selectedPart.value.dimensions.length)});
      }
    }

    /** 侧栏只编辑草稿值；确认经既有端点拉伸事务，固定对端、加工基准及撤销保持一致。 */
    function syncProfileLengthForm(object=selected.value){
      const part=object?.userData?.part;
      if(profileLengthForm.partId!==part?.id){
        profileLengthForm.partId=part?.id||null;
        profileLengthForm.fixedEnd=part&&editor?.profileGripEditor.isEndDrivenByConstraint(part.id,'END')?'END':'START';
      }
      profileLengthForm.lengthMm=Number(part?.dimensions?.length||0);
    }

    function applyProfileLength(){
      if(!profileLengthEditable.value){syncProfileLengthForm();return;}
      const length=Number(profileLengthForm.lengthMm);
      if(Math.abs(length-Number(selectedPart.value?.dimensions?.length))<1e-6)return;
      try{editor.setSelectedProfileLengthFromEnd(profileLengthForm.fixedEnd==='START'?'END':'START',length);}
      catch(error){notify(error.message,'warning');}
      finally{syncProfileLengthForm();}
    }

    function primitiveChanged() {
      if (!selectedPart.value || selectedIsProfile.value) return;
      editor.updateSelectedPrimitiveDimensions(selectedPart.value.dimensions);
    }

    function updatePanelShapeParameter(key,value) {
      const dimensions=selectedPart.value?.dimensions;
      try{editor.updateSelectedPrimitiveDimensions(panelDimensions(dimensions.panelShape,{...dimensions.shapeParameters,[key]:Number(value)}));}
      catch(error){notify(error.message,'warning');projectRevision.value++;}
    }

    function importSectionDxf() {
      sectionDxfInput.value?.click();
    }

    async function handleSectionDxf(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const catalogId = sectionTargetCatalogId.value;
        const definition = getDesignProfileDefinition(catalogId);
        if (!definition) throw new Error('当前没有可绑定的设计截面');
        const text = await file.text();
        const [expectedWidth,expectedHeight] = definition.sectionSize;
        const parsed = DxfSectionParser.alignToDimensions(DxfSectionParser.parse(text),expectedWidth,expectedHeight);
        const widthDiff = Math.abs(parsed.bounds.width-expectedWidth);
        const heightDiff = Math.abs(parsed.bounds.height-expectedHeight);
        const tolerance = Math.max(0.5,Math.max(expectedWidth,expectedHeight)*0.03);
        const rejectTolerance = Math.max(2,Math.max(expectedWidth,expectedHeight)*0.15);
        if (widthDiff > rejectTolerance || heightDiff > rejectTolerance) {
          throw new Error(`DXF 外形 ${round(parsed.bounds.width)}×${round(parsed.bounds.height)} mm 与设计截面 ${expectedWidth}×${expectedHeight} mm 差异过大`);
        }
        registerCustomSection(catalogId,{
          outer:parsed.outer,
          holes:parsed.holes,
          note:`从 ${file.name} 导入；单位：${parsed.unitName}；${parsed.autoRotated ? '已自动旋转90°；' : ''}识别：${parsed.entityTypes.join(', ')}`
        },file.name,text);
        sectionRevision.value++;
        editor?.refreshProfilesForCatalog(catalogId);
        const sizeWarning = widthDiff > tolerance || heightDiff > tolerance;
        const message = `已绑定 ${definition.name} DXF：${round(parsed.bounds.width)}×${round(parsed.bounds.height)} mm`;
        notify(sizeWarning || parsed.warning ? `${message}；请核对尺寸` : message,sizeWarning || parsed.warning ? 'warning' : 'success');
      } catch (error) {
        notify(`DXF 截面导入失败：${error.message}`,'error');
      } finally {
        event.target.value = '';
      }
    }

    function endLabel(value) {
      return String(value).toUpperCase()==='END' ? 'B端' : String(value).toUpperCase()==='START' ? 'A端' : '端部';
    }

    function faceLabel(value) {
      return ({FRONT:'正面',BACK:'背面',LEFT:'左侧',RIGHT:'右侧'})[String(value||'').toUpperCase()] || '侧面';
    }

    function mateKindLabel(value) {
      return ({AUTO:'自动判断',COINCIDENT:'面贴合',DISTANCE:'保持距离',ANGLE:'指定角度',SLOT_CENTER:'端部到槽',END_COINCIDENT:'端面对接',SLOT_TO_SLOT:'槽对槽',PARALLEL:'平行',PERPENDICULAR:'垂直',COAXIAL:'同轴',COPLANAR:'共面',RIGID_MATE:'刚性配合'})[String(value||'').toUpperCase()] || '几何配合';
    }

    function constraintStatusLabel(value) {
      return ({SOLVED:'已求解',UNSOLVED:'未求解',INVALID:'失效',SUPPRESSED:'已抑制'})[String(value||'').toUpperCase()] || '已建立';
    }

    function assemblyStatusLabel(value) {
      return ({OK:'正常',WARNING:'有警告',WARN:'有警告',ERROR:'有错误',FAILED:'有错误'})[String(value||'').toUpperCase()] || '待检查';
    }
    function severityLabel(value) {
      return ({ERROR:'错误',FAILED:'错误',WARNING:'警告',WARN:'警告',INFO:'提示',OK:'正常'})[String(value||'').toUpperCase()] || '提示';
    }

    function validationCategoryLabel(value) {
      return ({MACHINING:'加工',CONNECTION:'连接',COLLISION:'干涉',ASSEMBLY:'装配',BOM:'材料清单',CONSTRAINT:'约束',OTHER:'其他'})[String(value||'').toUpperCase()] || '其他';
    }

    function closeCadMenus(except=null) {
      document.querySelectorAll('details.cad-menu[open]').forEach(item=>{ if(item!==except)item.open=false; });
    }

    function hoverCadMenu(event) {
      if(event.pointerType==='touch')return;
      const summary=event.target.closest?.('.cad-menubar > .cad-menu > summary');
      if(!summary)return;
      const menu=summary.parentElement;closeCadMenus(menu);menu.open=true;
    }

    function keepCadMenuOpen(event) {
      const summary=event.target.closest?.('.cad-menubar > .cad-menu > summary');
      // 鼠标悬停已展开时点击不能立即把菜单合上；键盘/触屏保留原生 details 开关。
      if(!summary||event.detail===0||event.pointerType==='touch')return;
      event.preventDefault();const menu=summary.parentElement;closeCadMenus(menu);menu.open=true;
    }

    function positionFooterMenu(event) {
      hideFooterTip();
      const menu=event.target;
      requestAnimationFrame(()=>{
        if(!menu.open)return;
        const panel=menu.querySelector('.cad-menu-popover'),anchor=menu.querySelector('summary').getBoundingClientRect();
        // 等浏览器完成聚焦滚动后再定位；底栏横向滚动不能裁掉或误关闭弹层。
        const width=panel.offsetWidth,height=panel.offsetHeight;
        panel.style.left=`${Math.max(8,Math.min(anchor.right-width,window.innerWidth-width-8))}px`;
        panel.style.top=`${Math.max(8,anchor.top-height-8)}px`;
      });
    }

    function repositionFooterMenus() {
      hideFooterTip();
      document.querySelectorAll('.toolbar-more[open]').forEach(menu=>positionFooterMenu({target:menu}));
    }

    function hideFooterTip() {
      footerTipSequence++;
      footerTip.visible=false;
      footerTipAnchor?.removeAttribute('aria-describedby');
      footerTipAnchor=null;
    }

    async function showFooterTip(event) {
      const anchor=event.target?.closest?.('[data-tip]');
      const text=anchor?.getAttribute('data-tip');
      if(!text||anchor.closest('details[open]'))return;
      if(anchor===footerTipAnchor&&footerTip.text===text)return;
      hideFooterTip();
      const sequence=footerTipSequence;
      footerTipAnchor=anchor;
      Object.assign(footerTip,{visible:true,text,x:8,y:8});
      await nextTick();
      if(sequence!==footerTipSequence||!footerTip.visible)return;
      // 提示传送到 body，按实际尺寸定位；不受底栏滚动裁切，不占按钮布局。
      const bounds=anchor.getBoundingClientRect(),tip=footerTipElement.value.getBoundingClientRect();
      footerTip.x=Math.max(8,Math.min(bounds.left+bounds.width/2-tip.width/2,window.innerWidth-tip.width-8));
      footerTip.y=Math.max(8,Math.min(bounds.top-tip.height-8,window.innerHeight-tip.height-8));
      anchor.setAttribute('aria-describedby','workbench-footer-tip');
    }

    function leaveFooterTip(event) {
      if(!footerTipAnchor?.contains(event.relatedTarget))hideFooterTip();
    }

    function handleCadMenuPointerDown(event) {
      const current=event.target?.closest?.('details.cad-menu') || null;
      closeCadMenus(current);
    }

    function handleCadMenuClick(event) {
      const current=event.target?.closest?.('details.cad-menu') || null;
      // 必须等 click 处理完再收起；pointerdown 就隐藏会让 pointerup 落到画布。
      if(current && event.target?.closest?.('.cad-menu-popover button')) {
        queueMicrotask(()=>{ current.open=false; });
      }
    }

    function startJointConnectionFromMenu(menu,item) {
      if(!editor||!item?.type)return;
      const partId=menu?.partId||null;
      const worldPoint=menu?.worldPoint?{...menu.worldPoint}:null;
      contextMenu.visible=false;
      jointQuickMenu.visible=false;
      relationQuickMenu.visible=false;
      editor.machiningPlacementManager.cancel();
      editor.accessoryPlacementManager.cancel();
      editor.profileDrawTool.stop();
      openResource('connection');
      const installed=partId&&worldPoint?editor.connectionPlacementManager.installAtContext(item.type,partId,worldPoint):null;
      if(installed)return;
      const seeded=partId&&worldPoint?editor.connectionPlacementManager.beginFromContext(item.type,partId,worldPoint):false;
      if(!seeded)editor.connectionPlacementManager.begin(item.type);
      notify(seeded?'已取当前型材端部，请点击第二根型材连接位置':'当前接头存在歧义，请继续点击第二个连接位置','warning');
    }

    function contextStartConnection(mode) {
      startJointConnectionFromMenu(contextMenu,{type:mode,label:designConnectionLabel(mode)});
    }

    function quickStartConnection(item) {
      startJointConnectionFromMenu(jointQuickMenu,item);
    }

    function startAccessoryFromMenu(menu,candidate) {
      if(!editor||!candidate)return;
      const seed=menu?.partId?{partId:menu.partId,worldPoint:menu.worldPoint?{...menu.worldPoint}:null,end:candidate.end||menu.end||null}:null;
      let definition=null;
      if(candidate.kind==='DATABASE'){
        const row=databaseAccessories.find(item=>Number(item.id)===Number(candidate.id));
        if(row)definition=accessoryDefinition(row);
      }else{
        const base=HardwareCatalogList.find(item=>item.id===candidate.id);
        if(base){
          const nominal=String(editor.getMeshByPartId(menu.partId)?.userData?.part?.designProfile?.nominal||'');
          definition={...structuredClone(base),mountRule:{target:'PROFILE_END',profileNominal:nominal},source:'BUILTIN_CATALOG'};
        }
      }
      if(!definition)return notify('当前端盖候选已不可用，请刷新配件库','warning');
      contextMenu.visible=false;
      jointQuickMenu.visible=false;
      relationQuickMenu.visible=false;
      editor.connectionPlacementManager.cancel();
      editor.machiningPlacementManager.cancel();
      editor.profileDrawTool.stop();
      openResource('accessory');
      try{
        editor.accessoryPlacementManager.begin(definition,{seed});
        notify(`已预览 ${definition.label||'端盖'}，单击确认安装`,'success');
      }catch(error){notify(error.message||'端盖放置失败','warning');}
    }

    function contextStartAccessory(candidate) { startAccessoryFromMenu(contextMenu,candidate); }
    function quickStartAccessory(candidate) { startAccessoryFromMenu(jointQuickMenu,candidate); }

    function contextOpenAccessories() {
      accessoryPlacementSeed.value=contextMenu.partId ? {
        partId:contextMenu.partId,
        worldPoint:contextMenu.worldPoint ? {...contextMenu.worldPoint} : null,
        end:contextMenu.end || null
      } : null;
      contextMenu.visible=false;
      openResource('accessory');
      notify(accessoryPlacementSeed.value ? '已记住右键位置；选择配件后会在该位置预览，单击确认安装' : '已打开配件库；选择配件后移动到安装位置并单击确认','success');
    }

    function contextOpenMachining(mode = null) {
      contextMenu.visible=false;
      openResource('machining');
      inspectorTab.value='machining';
      if (mode) startMachiningPlacement(mode);
      else notify('已打开加工工具，可选择打孔、攻丝、开槽等','success');
    }

    function beginContourFrameEdit() {
      if(!selectedContourAssembly.value)return notify('请先选择轮廓框组件中的型材','warning');
      try { activeContourConstraintId.value=null; editor.beginContourFrameEdit(selectedContourAssembly.value.id); }
      catch(error){ notify(error.message||'无法编辑轮廓框','warning'); }
    }

    function stopContourFrameEdit() { activeContourConstraintId.value=null; editor?.stopContourFrameEdit(); }

    function setContourEdgeLength(edgeIndex,event) {
      const value=Number(event?.target?.value);
      try { editor.setContourFrameEdgeLength(edgeIndex,value); projectRevision.value++; }
      catch(error){ notify(error.message||'边长调整失败','warning'); }
    }

    function toggleContourOrthogonal(event) {
      try { editor.setContourFrameOrthogonal(event?.target?.checked!==false); projectRevision.value++; }
      catch(error){ notify(error.message||'正交锁定设置失败','warning'); }
    }

    function contourConstraintLabel(item) {
      if(item?.type==='EQUAL_LENGTH')return `边 ${Number(item.edgeA)+1} 与边 ${Number(item.edgeB)+1} 等长`;
      if(item?.type==='PARALLEL')return `边 ${Number(item.edgeA)+1} 与边 ${Number(item.edgeB)+1} 平行`;
      if(item?.type==='ALIGN_POINTS')return `点 ${Number(item.pointA)+1} 与点 ${Number(item.pointB)+1} ${item.mode==='VERTICAL'?'纵向':'横向'}对齐`;
      return '轮廓关系';
    }

    function addContourEdgeConstraint(type) {
      try {
        editor.addContourFrameConstraint(type,Number(contourConstraintForm.edgeA),Number(contourConstraintForm.edgeB));
        projectRevision.value++;
        notify(type==='EQUAL_LENGTH'?'已建立等长关系':'已建立平行关系');
      } catch(error){ notify(error.message||'轮廓关系建立失败','warning'); }
    }

    function addContourPointAlignment(mode) {
      try {
        editor.addContourFrameConstraint('ALIGN_POINTS',Number(contourConstraintForm.pointA),Number(contourConstraintForm.pointB),{mode});
        projectRevision.value++;
        notify(mode==='VERTICAL'?'已建立纵向对齐':'已建立横向对齐');
      } catch(error){ notify(error.message||'点对齐建立失败','warning'); }
    }

    function focusContourConstraint(item) {
      if(!item?.id)return;
      try {
        if(!contourEditState.active) editor.beginContourFrameEdit(selectedContourAssembly.value?.id);
        editor.focusContourFrameConstraint(item.id);
        activeContourConstraintId.value=item.id;
        notify(`已定位轮廓关系：${item.label||contourConstraintLabel(item)}`);
      } catch(error){ notify(error.message||'轮廓关系定位失败','warning'); }
    }

    function removeContourConstraint(id) {
      try { editor.removeContourFrameConstraint(id); if(activeContourConstraintId.value===id)activeContourConstraintId.value=null; projectRevision.value++; notify('已移除轮廓关系'); }
      catch(error){ notify(error.message||'轮廓关系移除失败','warning'); }
    }

    function applyQuickContourRelation() {
      const id=relationQuickMenu.constraintId;
      if(!id||!editor)return;
      try{
        const patch=relationQuickMenu.type==='ALIGN_POINTS'
          ? {type:'ALIGN_POINTS',pointA:Number(relationQuickMenu.pointA),pointB:Number(relationQuickMenu.pointB),mode:relationQuickMenu.mode}
          : {type:relationQuickMenu.type,edgeA:Number(relationQuickMenu.edgeA),edgeB:Number(relationQuickMenu.edgeB)};
        editor.updateContourFrameConstraint(id,patch);
        activeContourConstraintId.value=id;
        projectRevision.value++;
        notify('轮廓关系已更新');
      }catch(error){notify(error.message||'轮廓关系调整失败','warning');}
    }

    function toggleQuickContourRelation() {
      const id=relationQuickMenu.constraintId;
      if(!id||!editor)return;
      try{
        editor.toggleContourConstraintType(id);
        const item=(selectedContourAssembly.value?.parameters?.simpleConstraints||[]).find(row=>row.id===id);
        if(item)Object.assign(relationQuickMenu,{type:item.type,edgeA:Number(item.edgeA||0),edgeB:Number(item.edgeB??1),pointA:Number(item.pointA||0),pointB:Number(item.pointB??1),mode:item.mode||'HORIZONTAL'});
        projectRevision.value++;
        notify(item?.type==='ALIGN_POINTS'?`已切换为${item.mode==='VERTICAL'?'纵向':'横向'}对齐`:`已切换为${item?.type==='PARALLEL'?'平行':'等长'}关系`);
      }catch(error){notify(error.message||'轮廓关系切换失败','warning');}
    }

    function deleteQuickContourRelation() {
      const id=relationQuickMenu.constraintId;
      relationQuickMenu.visible=false;
      if(id)removeContourConstraint(id);
    }

    function createContourPreset(type) {
      if(!editor)return;
      try {
        editor.connectionPlacementManager.cancel();editor.machiningPlacementManager.cancel();editor.accessoryPlacementManager.cancel();editor.profileDrawTool.stop();
        const center=editor.sceneManager.orbitControls?.target?.clone?.() || {x:0,y:0,z:0};
        const halfHeight=Number(getDesignProfileDefinition(drawForm.catalogId)?.sectionSize?.[1]||30)/2;
        if(drawForm.plane==='XY')center.z=halfHeight;
        else if(drawForm.plane==='YZ')center.x=halfHeight;
        else center.y=halfHeight;
        const points=buildContourPreset(type,{...contourPresetForm,plane:drawForm.plane,center});
        const label=type==='U'?'U 型':type==='STAIR'?'阶梯型':'L 型';
        const result=editor.createContourFrameFromPoints(points,{catalogId:drawForm.catalogId,plane:drawForm.plane,orthogonal:true,gridSnap:drawForm.gridSnap,gridStepMm:drawForm.gridStepMm,presetType:type,name:`${label}轮廓框`,source:'CONTOUR_PRESET'});
        selectedAssemblyId.value=result.assemblyId;projectRevision.value++;
        notify(`已生成${label}轮廓框 · ${result.createdCount} 根型材${result.autoConnection?.createdCount?` · 自动连接 ${result.autoConnection.createdCount} 处`:''}`);
      } catch(error){ notify(error.message||'轮廓模板生成失败','warning'); }
    }

    function connectionDiagramSvg(connection){
      return buildConnectionInstallationDiagram(connection||{});
    }

    function showAssemblyConnectionDetail(step,connection) {
      if(!connection)return;
      activeConnectionDetail.value={stepId:step?.id||null,...connection};
    }

    function focusAssemblyConnectionDetail(connection) {
      try {
        editor?.focusAssemblyConnection(connection?.id);
        engineeringCenterVisible.value=false;
        notify(`已聚焦连接 ${connection?.code||''}`);
      } catch(error){ notify(error.message||'连接定位失败','warning'); }
    }

    function contextOpenPanelTools() {
      contextMenu.visible=false;
      openResource('panel');
      notify('已打开板材与门工具','success');
    }

    function startConnectionPlacement(mode) {
      if(!editor)return;
      editor.machiningPlacementManager.cancel();
      editor.accessoryPlacementManager.cancel();
      editor.profileDrawTool.stop();
      openResource('connection');
      editor.connectionPlacementManager.begin(mode);
    }

    function cancelConnectionPlacement() {
      editor?.connectionPlacementManager.cancel();
    }

    function startMachiningPlacement(mode) {
      if(!editor)return;
      editor.connectionPlacementManager.cancel();
      editor.accessoryPlacementManager.cancel();
      editor.profileDrawTool.stop();
      openResource('machining');
      inspectorTab.value='machining';
      editor.machiningPlacementManager.begin(mode);
    }

    function cancelMachiningPlacement() {
      editor?.machiningPlacementManager.cancel();
    }

    function closeContextMenu(event) {
      if(event.target?.closest?.('.context-menu'))return;
      contextMenu.visible=false;
      jointQuickMenu.visible=false;
      relationQuickMenu.visible=false;
    }

    async function fitFloatingMenu(model,selector,clientX,clientY,offset=8) {
      await nextTick();
      if(!model?.visible)return;
      const element=document.querySelector(selector);
      if(!element)return;
      const rect=element.getBoundingClientRect();
      const margin=8;
      const maxX=Math.max(margin,window.innerWidth-rect.width-margin);
      const maxY=Math.max(margin,window.innerHeight-rect.height-margin);
      model.x=Math.max(margin,Math.min(maxX,Number(clientX||0)+offset));
      model.y=Math.max(margin,Math.min(maxY,Number(clientY||0)+offset));
    }

    function syncManufacturingForm() {
      if (!editor) return;
      Object.assign(annotationOptions,editor.annotationManager?.options || {});
      Object.assign(engineeringDrawingForm,editor.drawingSettings || {});
      userDimensions.value = structuredClone(editor.userDimensions || []);
      dimensionState.value = null;
      Object.assign(drawForm,editor.profileDrawTool.options);
      transformSpace.value=editor.transformSpace;movementStepMm.value=editor.movementStepMm;
      transformMoveScope.value=editor.transformMoveScope;workPlaneVisible.value=editor.workPlaneVisualizer.visible;
      autoConnectionEnabled.value=editor.autoConnectionEnabled;
    }

    function getAutosaveText() {
      return localDraft.raw();
    }

    function localDraftSaved(savedAt){
      if(!savedAt)return;
      autosaveInfo.value=new Date(savedAt).toLocaleTimeString('zh-CN',{hour12:false});
      hasAutosave.value=true;autosaveError.value='';dirty.value=false;
    }

    function localDraftFailed(error,restoreFailure=false){
      const first=!autosaveError.value;
      autosaveError.value=error?.message||'浏览器存储不可用';dirty.value=true;
      if(first)notify(restoreFailure?'本地草稿无法恢复，原文件已保留；请从“文件 → 导出本地草稿原文件”备份':'本地草稿未保存，请从“文件 → 保存项目”导出 JSON 备份','error');
    }

    function initializeLocalDraft(){
      try {
        hasAutosave.value=!!getAutosaveText();
        const project=localDraft.read();
        if(project){
          editor.loadProject(project);syncManufacturingForm();sectionRevision.value++;projectRevision.value++;
          autosaveInfo.value=localDraft.savedAt()?new Date(localDraft.savedAt()).toLocaleTimeString('zh-CN',{hour12:false}):'上次会话';
          notify('已自动继续上次的本地工程');
        }
        autosaveReady=true;dirty.value=false;
      }catch(error){
        // 损坏/不支持的草稿保留原文，直到用户明确打开/新建覆盖或确认清除。
        autosaveReady=false;localDraftFailed(error,true);
      }
    }

    function saveAutosave(force=false) {
      if(!editor||(!autosaveReady&&!force))return;
      try{localDraftSaved(localDraft.capture(editor.exportProject()));autosaveReady=true;}
      catch(error){localDraftFailed(error);}
    }

    function flushLocalDraft(){
      if(!autosaveReady)return;
      try{localDraftSaved(localDraft.flush());}catch(error){localDraftFailed(error);}
    }

    function handleDraftVisibility(){if(document.visibilityState==='hidden')flushLocalDraft();}

    function confirmLocalDraftReplacement(){
      return autosaveReady||!hasAutosave.value||confirm('现有本地草稿无法恢复。继续会覆盖它；建议先用“文件 → 导出本地草稿原文件”备份。确定继续？');
    }

    function restoreAutosave() {
      try {
        const project=localDraft.read();
        if(!project||!editor)return notify('没有本地草稿记录','warning');
        if(dirty.value&&!confirm('恢复本地草稿会替换当前未保存的修改。确定继续？'))return;
        const previous=autosaveReady;autosaveReady=false;
        try{editor.loadProject(project);}catch(error){autosaveReady=previous;throw error;}
        syncManufacturingForm();
        sectionRevision.value++;projectRevision.value++;autosaveReady=true;autosaveError.value='';dirty.value=false;
        notify('已恢复本地草稿');
      } catch (error) {
        notify(`本地草稿恢复失败：${error.message}`,'error');
      }
    }

    function downloadLocalDraft(){
      try{
        const text=getAutosaveText();if(!text)return notify('没有本地草稿记录','warning');
        const url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'}));
        const link=document.createElement('a');link.href=url;link.download='本地工程草稿.json';link.click();URL.revokeObjectURL(url);
      }catch(error){notify(`读取本地草稿失败：${error.message}`,'error');}
    }

    function clearAutosave() {
      if(!confirm('清除当前浏览器的本地草稿？不会删除当前画布或已导出的 JSON；以后修改工程仍会自动保存。'))return;
      try{
        localDraft.clear();autosaveReady=true;hasAutosave.value=false;autosaveInfo.value='';autosaveError.value='';
        notify('本地草稿已清除；当前画布和已导出的文件保留','warning');
      }catch(error){notify(`清除本地草稿失败：${error.message}`,'error');}
    }

    function selectProjectPart(part,event) {
      selectedAssemblyId.value = part?.assemblyId || null;
      editor?.selectByPartId(part.id,{additive:event?.ctrlKey||event?.metaKey||event?.shiftKey,toggle:event?.ctrlKey||event?.metaKey});
    }

    function selectProjectGroup(group) {
      selectedAssemblyId.value = group?.assemblyId || null;
      if(editor?.contourFrameManager?.active && editor.contourFrameManager.assemblyId!==selectedAssemblyId.value) editor.contourFrameManager.stop();
      if (group.assemblyId) editor?.selectAssembly(group.assemblyId);
      else if (group.parts?.[0]) editor?.selectByPartId(group.parts[0].id);
    }

    function renameProjectGroup(group,event) {
      event?.stopPropagation?.();
      if (!group?.assemblyId) return;
      const current = editor.assemblyManager.get(group.assemblyId);
      const name = window.prompt('组件名称',current?.name || group.label || '组件');
      if (name == null) return;
      editor.assemblyManager.rename(group.assemblyId,name);
      editor.historyManager.capture(); editor.emitProjectChanged(); projectRevision.value++;
    }

    function makeSubassembly() {
      const assemblyIds = [...new Set(selectedMeshes.value.map(mesh => mesh.userData.part?.assemblyId).filter(Boolean))];
      if (assemblyIds.length < 2) return notify('请先选择至少两个不同组件中的构件','warning');
      try {
        const parentId = editor.createParentAssembly(assemblyIds);
        selectedAssemblyId.value = parentId;
        projectRevision.value++;
        notify('已创建子装配');
      } catch (error) { notify(error.message,'warning'); }
    }

    function moveAssemblyStep(group,delta,event) {
      event?.stopPropagation?.();
      if (!group?.assemblyId) return;
      editor?.moveAssemblyInstallationStep(group.assemblyId,delta);
      projectRevision.value++;
    }

    function editAssemblyNote(group,event) {
      event?.stopPropagation?.();
      if (!group?.assemblyId) return;
      const current = editor.assemblyManager.get(group.assemblyId);
      const note = window.prompt('安装步骤说明',current?.installationNote || '');
      if (note == null) return;
      editor.setAssemblyInstallationNote(group.assemblyId,note);
      projectRevision.value++;
    }

    function isolateProjectGroup(group,event) {
      event?.stopPropagation?.();
      if (!group?.assemblyId) return;
      try {
        editor?.isolateAssembly(group.assemblyId);
        selectedAssemblyId.value = group.assemblyId;
        notify(`已隔离显示：${group.label || '组件'}`);
      } catch (error) { notify(error.message,'warning'); }
    }

    function explodeAssemblyView() {
      try {
        const result = editor?.explodeAssembly(selectedAssemblyId.value || null,assemblyExplodeDistance.value);
        assemblyExplosionActive.value = true;
        notify(`爆炸图已展开 · ${result?.unitCount || 0} 个单元`);
      } catch (error) { notify(error.message,'warning'); }
    }

    function collapseAssemblyView() {
      if (editor?.collapseAssemblyExplosion()) notify('已收拢爆炸图');
      assemblyExplosionActive.value = false;
    }

    function runAssemblyDiagnostics() {
      assemblyDiagnostics.value = editor?.getAssemblyDiagnostics() || null;
      const report = assemblyDiagnostics.value;
      if (!report) return;
      notify(report.status === 'OK' ? '装配关系检查通过' : `装配检查：${report.errors} 错误 / ${report.warnings} 警告`, report.errors ? 'error' : report.warnings ? 'warning' : 'success');
    }

    function focusAssemblyIssue(issue) {
      if (!issue) return;
      if (issue.assemblyId) selectedAssemblyId.value = issue.assemblyId;
      if (editor?.focusDiagnosticIssue(issue)) notify('已定位装配诊断项');
    }

    function toggleAssemblyVisibility(group,event) {
      event?.stopPropagation?.();
      if (!group?.assemblyId) return;
      editor?.setAssemblyVisibility(group.assemblyId, group.hidden === true);
      projectRevision.value++;
    }

    function toggleAssemblyLock(group,event) {
      event?.stopPropagation?.();
      if (!group?.assemblyId) return;
      editor?.setAssemblyLocked(group.assemblyId, group.locked !== true);
      projectRevision.value++;
    }

    function dissolveProjectGroup(group,event) {
      event?.stopPropagation?.();
      if (!group?.assemblyId) return;
      editor?.dissolveAssembly(group.assemblyId);
      projectRevision.value++;
      notify('组件已解散，构件保留');
    }

    function focusConstraintIssue(item) {
      if (!editor?.focusDiagnosticIssue(item)) return notify('该诊断项没有可定位的构件','warning');
      notify('已定位相关构件');
    }

    function toggleProjectPartVisibility(part,event) {
      event?.stopPropagation?.();
      editor?.setPartVisibility(part.id,part.hidden === true);
    }

    function showAllParts() {
      editor?.showAll();
      assemblyExplosionActive.value = false;
      notify('已显示全部构件');
    }

    function groupSelection() {
      try {
        editor?.groupSelection();
        notify(`已将 ${selectionCount.value} 个构件组合为组件`);
      } catch (error) { notify(error.message,'warning'); }
    }

    function ungroupSelection() {
      editor?.ungroupSelection();
      notify('已取消组件组合');
    }

    function hideSelection() {
      editor?.setSelectionVisibility(false);
      contextMenu.visible=false;
      notify('已隐藏选择构件');
    }

    function toggleSelectionVisibility() {
      if(selectionCount.value)hideSelection();
      else showAllParts();
    }

    function toggleLockSelection() {
      const locked = editor?.toggleSelectedLock();
      contextMenu.visible=false;
      notify(locked?'已锁定选择构件':'已解除锁定');
    }

    function focusSelection() {
      editor?.focusSelection();
      contextMenu.visible=false;
    }

    function duplicateArray() {
      try {
        const result = editor?.duplicateArray(arrayForm) || [];
        notify(`已生成 ${result.length} 个阵列副本`);
      } catch (error) { notify(error.message,'warning'); }
    }

    function mirrorSelection() {
      try {
        const result = editor?.mirrorSelected(mirrorForm) || [];
        notify(`已完成镜像复制，共处理 ${result.length} 个构件`);
      } catch (error) { notify(error.message,'warning'); }
    }

    function mirrorAlong(axis) {
      Object.assign(mirrorForm,{axis,copy:true,planeMode:'SELECTION_CENTER'});
      mirrorSelection();
      closeCadMenus();
    }

    function circularArray() {
      try {
        const result = editor?.circularArray(circularForm) || [];
        notify(`已生成 ${result.length} 个圆周阵列副本`);
      } catch (error) { notify(error.message,'warning'); }
    }

    function addHardware(catalogId) {
      try {
        editor?.addHardware(catalogId);
        const item = hardwareCatalog.find(entry => entry.id === catalogId);
        notify(`已添加 ${item?.label || catalogId}`);
      } catch (error) { notify(error.message,'error'); }
    }


    function toggleBoxSelect() {
      if(!boxSelectMode.value)cancelPlacementTools();
      boxSelectMode.value = !boxSelectMode.value;
      if (boxSelectMode.value) {
        if (lassoSelectMode.value) { lassoSelectMode.value = false; editor?.setLassoMode(false); }
        if (measureMode.value) { measureMode.value = false; editor?.setMeasureMode(false); }
        if (dimensionMode.value) { dimensionMode.value = false; editor?.setDimensionMode(false); }
      }
      editor?.setMarqueeMode(boxSelectMode.value);
      if (boxSelectMode.value) notify('框选：左→右完全包含，右→左相交选择；Shift/Ctrl 可追加','warning');
    }

    /** 自由套索用于不规则区域；与框选、测量、尺寸模式互斥。 */
    function toggleLassoSelect() {
      if(!lassoSelectMode.value)cancelPlacementTools();
      lassoSelectMode.value = !lassoSelectMode.value;
      if (lassoSelectMode.value) {
        if (boxSelectMode.value) { boxSelectMode.value = false; editor?.setMarqueeMode(false); }
        if (measureMode.value) { measureMode.value = false; editor?.setMeasureMode(false); }
        if (dimensionMode.value) { dimensionMode.value = false; editor?.setDimensionMode(false); }
        if (featureSelectMode.value) { featureSelectMode.value = false; editor?.setFeatureSelectionMode(false); }
      }
      editor?.setLassoMode(lassoSelectMode.value);
      if (lassoSelectMode.value) notify('自由选择：按住左键圈出不规则区域；Shift/Ctrl 可追加选择','warning');
    }

    function toggleMeasure() {
      if(!measureMode.value)cancelPlacementTools();
      measureMode.value = !measureMode.value;
      if (measureMode.value && dimensionMode.value) {
        dimensionMode.value = false;
        editor?.setDimensionMode(false);
      }
      if (measureMode.value && boxSelectMode.value) {
        boxSelectMode.value = false;
        editor?.setMarqueeMode(false);
      }
      if (measureMode.value && lassoSelectMode.value) {
        lassoSelectMode.value = false;
        editor?.setLassoMode(false);
      }
      editor?.setMeasureMode(measureMode.value);
      if (measureMode.value) notify('测量模式：依次点击两个点','warning');
    }

    function toggleDimensionMode() {
      if(!dimensionMode.value)cancelPlacementTools();
      dimensionMode.value = !dimensionMode.value;
      if (dimensionMode.value && measureMode.value) {
        measureMode.value = false;
        editor?.setMeasureMode(false);
      }
      if (dimensionMode.value && boxSelectMode.value) {
        boxSelectMode.value = false;
        editor?.setMarqueeMode(false);
      }
      if (dimensionMode.value && lassoSelectMode.value) {
        lassoSelectMode.value = false;
        editor?.setLassoMode(false);
      }
      editor?.setDimensionMode(dimensionMode.value);
      dimensionState.value = null;
      if (dimensionMode.value) notify('永久标注：依次点击两个点，完成后可拖动文字','warning');
    }

    function updateAnnotationOptions() {
      editor?.setAnnotationOptions({...annotationOptions});
      dirty.value = true;
      saveAutosave();
    }

    function removeUserDimension(dimension) {
      if (!dimension) return;
      editor?.removeUserDimension(dimension.id);
      userDimensions.value = structuredClone(editor?.userDimensions || []);
    }

    function clearUserDimensions() {
      editor?.clearUserDimensions();
      userDimensions.value = [];
      notify('永久标注已清空');
    }

    function userDimensionChanged(dimension) {
      if (!dimension) return;
      editor?.updateUserDimension(dimension.id,{text:dimension.text || null});
    }

    function userDimensionValue(dimension) {
      const value = editor?.getUserDimensionValue(dimension);
      if (Number.isFinite(Number(value))) return Number(Number(value).toFixed(2));
      const a = dimension?.start;
      const b = dimension?.end;
      if (!a || !b) return '-';
      const dx = Number(b.x || 0) - Number(a.x || 0);
      const dy = Number(b.y || 0) - Number(a.y || 0);
      const dz = Number(b.z || 0) - Number(a.z || 0);
      return Number(Math.hypot(dx,dy,dz).toFixed(2));
    }

    function userDimensionDrivenChanged(dimension,event) {
      if (!dimension?.binding) return;
      try {
        const value = Number(event?.target?.value);
        editor?.setUserDimensionValue(dimension.id,value);
        userDimensions.value = structuredClone(editor?.userDimensions || []);
        const unit = userDimensionUnit(dimension);
        notify(`驱动尺寸已更新为 ${Number(value.toFixed(2))}${unit}`);
      } catch (error) {
        notify(error.message || '驱动尺寸修改失败','error');
      }
    }

    function userDimensionBindingLabel(dimension) {
      const type = dimension?.binding?.type;
      if (type === 'PROFILE_LENGTH') return '驱动 · 型材长度';
      if (type === 'PROFILE_RADIUS') return '驱动 · 弯曲半径';
      if (type === 'PROFILE_ARC_ANGLE') return '驱动 · 圆弧角度';
      if (type === 'MACHINING_STATION') return dimension.chain?.locked ? `驱动 · ${dimension.binding?.datumEnd==='END'?'B':'A'}端孔位基准链 #${dimension.chain.order || 0}` : '驱动 · 孔位 S';
      if (type === 'MACHINING_OFFSET') return '驱动 · 孔横向偏移';
      if (type === 'PART_AXIS_DISTANCE') return dimension.chain?.mode ? `驱动 · ${dimension.chain.mode} ${dimension.binding.axis}轴中心距` : `驱动 · ${dimension.binding.axis}轴间距`;
      if (type === 'PART_AXIS_COORDINATE') return `驱动 · ${dimension.binding.axis} 坐标尺寸`;
      if (type === 'PART_CLEARANCE') return `驱动 · ${dimension.binding.axis}轴净间距`;
      if (type === 'SLOT_CENTER_DISTANCE') return `驱动 · 槽中心距 ${dimension.binding.sourceFace}→${dimension.binding.targetFace}`;
      if (type === 'PROFILE_ANGLE') return `驱动 · 型材夹角 / ${dimension.binding.axis}轴`;
      if (dimension?.anchorStart || dimension?.anchorEnd) return '关联标注';
      return '自由标注';
    }

    function userDimensionUnit(dimension) {
      const type = dimension?.binding?.type;
      return ['PROFILE_ANGLE','PROFILE_ARC_ANGLE'].includes(type) || dimension?.type === 'ANGULAR' ? '°' : ' mm';
    }

    function userDimensionMin(dimension) {
      return ['MACHINING_OFFSET','PART_AXIS_COORDINATE'].includes(dimension?.binding?.type) ? undefined : 0;
    }

    function createSelectionAxisDimension() {
      try {
        editor?.createSelectionAxisDistanceDimension();
        userDimensions.value = structuredClone(editor?.userDimensions || []);
        notify('已创建两构件轴向间距驱动尺寸');
      } catch (error) { notify(error.message,'warning'); }
    }

    function createSelectionSlotDimension() {
      try {
        editor?.createSelectionSlotDistanceDimension();
        userDimensions.value = structuredClone(editor?.userDimensions || []);
        notify('已创建槽中心距驱动尺寸');
      } catch (error) { notify(error.message,'warning'); }
    }

    function createSelectionAngleDimension() {
      try {
        editor?.createSelectionAngleDimension();
        userDimensions.value = structuredClone(editor?.userDimensions || []);
        notify('已创建型材夹角驱动尺寸');
      } catch (error) { notify(error.message,'warning'); }
    }

    function createDimensionChain(mode,clearance = false) {
      try {
        const created = editor?.createSelectionDimensionChain(mode,dimensionChainAxis.value,clearance) || [];
        userDimensions.value = structuredClone(editor?.userDimensions || []);
        annotationOptions.showUserDimensions = true;
        editor?.setAnnotationOptions({...annotationOptions});
        const kind = clearance ? '净间距链' : mode === 'ORDINATE' ? '坐标尺寸' : mode === 'BASELINE' ? '基准尺寸链' : '连续尺寸链';
        notify(`已创建${kind}，共 ${created.length} 个尺寸`);
      } catch (error) { notify(error.message,'warning'); }
    }

    function createSelectedRadiusDimension() {
      try {
        editor?.createSelectedProfileRadiusDimension();
        userDimensions.value = structuredClone(editor?.userDimensions || []);
        annotationOptions.showUserDimensions = true;
        editor?.setAnnotationOptions({...annotationOptions});
        notify('已创建弯曲半径驱动尺寸');
      } catch (error) { notify(error.message,'warning'); }
    }

    function createSelectedArcAngleDimension() {
      try {
        editor?.createSelectedProfileArcAngleDimension();
        userDimensions.value = structuredClone(editor?.userDimensions || []);
        annotationOptions.showUserDimensions = true;
        editor?.setAnnotationOptions({...annotationOptions});
        notify('已创建圆弧角驱动尺寸');
      } catch (error) { notify(error.message,'warning'); }
    }

    function createMachiningDimension(item) {
      if (!selectedPart.value || !item) return;
      try {
        editor?.createMachiningStationDimension(selectedPart.value.id,item.id);
        userDimensions.value = structuredClone(editor?.userDimensions || []);
        annotationOptions.showUserDimensions = true;
        editor?.setAnnotationOptions({...annotationOptions});
        notify('已创建孔位 S 驱动尺寸');
      } catch (error) { notify(error.message,'warning'); }
    }

    function createMachiningOffsetDimension(item) {
      if (!selectedPart.value || !item) return;
      try {
        editor?.createMachiningOffsetDimension(selectedPart.value.id,item.id);
        userDimensions.value = structuredClone(editor?.userDimensions || []);
        annotationOptions.showUserDimensions = true;
        editor?.setAnnotationOptions({...annotationOptions});
        notify('已创建孔横向偏移驱动尺寸');
      } catch (error) { notify(error.message,'warning'); }
    }

    function createMachiningBaselineChain(baselineEnd = 'START') {
      if (!selectedPart.value) return;
      try {
        const end = String(baselineEnd).toUpperCase() === 'END' ? 'END' : 'START';
        const created = editor?.createMachiningBaselineChain(selectedPart.value.id,end) || [];
        userDimensions.value = structuredClone(editor?.userDimensions || []);
        annotationOptions.showUserDimensions = true;
        editor?.setAnnotationOptions({...annotationOptions});
        notify(`已建立 ${end==='END'?'B':'A'} 端孔位基准链，共 ${created.length} 个尺寸`);
      } catch (error) { notify(error.message,'warning'); }
    }

    function updateEndCuts() {
      if (!selectedPart.value?.endCuts) return;
      editor?.updateSelectedEndCuts(selectedPart.value.endCuts);
    }

    function restoreReferenceSection() {
      const catalogId = sectionTargetCatalogId.value;
      if (!catalogId || !hasCustomSection(catalogId)) return;
      removeCustomSection(catalogId);
      sectionRevision.value++;
      editor?.refreshProfilesForCatalog(catalogId);
      notify(`已恢复 ${sectionTargetVariant.value} 参考截面`,'warning');
    }

    function setMode(mode) {
      cancelPlacementTools();
      toolMode.value = mode;
      editor?.setTransformMode(mode);
    }

    function cancelPlacementTools() {
      editor?.wholeStretchManager.cancel();
      editor?.profilePlacementManager.cancel();
      editor?.selectionGestureManager.cancelDrag();
      stopProfileDraw();
      cancelConnectionPlacement();cancelAccessoryPlacement();cancelMachiningPlacement();
    }

    function showRightPanel(mode) {
      returnToSelection();
      rightPanelMode.value=mode;
    }

    // 返回选择统一清理临时工具，已完成构件和历史记录不受影响。
    function returnToSelection() {
      cancelPlacementTools();
      if(measureMode.value)toggleMeasure();
      if(dimensionMode.value)toggleDimensionMode();
      if(boxSelectMode.value)toggleBoxSelect();
      if(lassoSelectMode.value)toggleLassoSelect();
      if(featureSelectMode.value)toggleFeatureSelectMode();
      setMode('translate');
    }

    function toggleTransformSpace() {
      transformSpace.value = transformSpace.value === 'world' ? 'local' : 'world';
      editor?.setTransformSpace(transformSpace.value);
      notify(transformSpace.value === 'local' ? '构件方向：操作轴跟随构件旋转；旋转中心不变' : '画布方向：操作轴沿固定 X/Y/Z；旋转中心不变');
    }

    function setTransformSpace(space) {
      transformSpace.value = editor?.setTransformSpace(space) || (space === 'local' ? 'local' : 'world');
    }

    function setMovementStep(step) {
      movementStepMm.value = editor?.setMovementStep(step) ?? Math.max(0,Number(step)||0);
      notify(movementStepMm.value>0 ? `移动步长：${movementStepMm.value} mm` : '自由移动','warning');
    }

    function setTransformMoveScope(scope) {
      transformMoveScope.value = editor?.setTransformMoveScope(scope) || 'SINGLE';
      const label=transformMoveScope.value==='CONNECTED'?'保持连接移动':transformMoveScope.value==='ASSEMBLY'?'移动整个装配':'单个移动';
      notify(`移动方式：${label}`,'warning');
      contextMenu.visible=false;
    }

    function toggleWorkPlane() {
      workPlaneVisible.value = !workPlaneVisible.value;
      editor?.setWorkPlaneVisible(workPlaneVisible.value);
    }

    function setWorkPlane(plane) {
      drawForm.plane = plane;
      editor?.setWorkPlane(plane);
      drawOptionsChanged();
    }

    function applyContextProfileLength(end = 'END') {
      if (!selectedIsProfile.value || selectedPart.value?.profilePath?.type !== 'LINE') return notify('请选择直线型材','warning');
      const length=Number(contextMenu.lengthMm);
      if(!Number.isFinite(length)||length<10)return notify('长度必须是大于等于 10 mm 的数字','warning');
      try {
        editor?.setSelectedProfileLengthFromEnd(end,length);
        contextMenu.lengthMm=Number(selectedPart.value?.dimensions?.length||length);
        notify(`型材长度已更新：${Number(contextMenu.lengthMm)} mm`);
      } catch (error) { notify(error.message,'warning'); }
    }

    function promptProfileLength(end = 'END') {
      if (!selectedIsProfile.value || selectedPart.value?.profilePath?.type !== 'LINE') return notify('请选择直线型材','warning');
      const current = Number(selectedPart.value.dimensions?.length || 0);
      const input = window.prompt(`${end === 'START' ? 'A' : 'B'}端拉伸后的总长度（mm）`,String(current));
      if (input == null) return;
      try {
        editor?.setSelectedProfileLengthFromEnd(end,Number(input));
        notify(`型材长度已更新：${Number(input)} mm`);
      } catch (error) { notify(error.message,'warning'); }
      contextMenu.visible = false;
    }

    function toggleSnap() {
      snapEnabled.value = !snapEnabled.value;
      editor?.toggleSnap(snapEnabled.value);
    }

    function toggleAutoConnection() {
      autoConnectionEnabled.value = !autoConnectionEnabled.value;
      editor?.setAutoConnectionEnabled(autoConnectionEnabled.value);
      notify(`新建构件自动连接已${autoConnectionEnabled.value ? '开启' : '关闭'}`,'warning');
    }

    function completeExistingConnections() {
      if (!editor) return;
      try {
        const result = editor.completeProfileConnections();
        if (result.profileCount < 2) {
          notify('至少需要两根型材才能扫描接头','warning');
          return;
        }
        if (result.createdCount > 0) {
          const failed = result.failureCount > 0 ? ` · ${result.failureCount} 处需手工处理` : '';
          notify(`已扫描 ${result.profileCount} 根型材，补全 ${result.createdCount} 个设计连接${failed}`,result.failureCount > 0 ? 'warning' : 'success');
          return;
        }
        notify('没有发现可自动补全的接头；已有连接保持不变','warning');
      } catch (error) {
        notify(error.message || '扫描连接失败','error');
      }
    }

    function clearAutoConnections() {
      if (!editor) return;
      try {
        const result = editor.clearAutoGeneratedConnections();
        if (!result.removedCount) {
          notify('当前没有可清除的纯自动连接','warning');
          return;
        }
        notify(`已清除 ${result.removedCount} 个纯自动连接；手工及已修改连接已保留，可撤销恢复`,'success');
      } catch (error) {
        notify(error.message || '清除自动连接失败','error');
      }
    }

    function clearAllConnections() {
      if(!editor||!connectionOverview.value.total)return;
      if(!window.confirm('清除全部设计连接件及其派生五金、派生加工？手工加工和主体构件会保留；操作可撤销。'))return;
      try {
        const result=editor.clearAllDesignConnections();
        notify(`已清除 ${result.removedCount} 个设计连接及其派生项；可用 Ctrl+Z 恢复`);
      } catch(error) { notify(error.message||'清除连接件失败','error'); }
    }

    function toggleGrid() {
      gridEnabled.value = !gridEnabled.value;
      editor?.toggleGrid(gridEnabled.value);
    }

    function toggleProjection() {
      projection.value = projection.value === 'perspective' ? 'orthographic' : 'perspective';
      editor?.setProjection(projection.value);
    }

    function deleteSelected(confirmDelete = false) {
      if (!selected.value) return;
      if (confirmDelete && !confirm(`确定删除 ${selectionCount.value || 1} 个构件？`)) return;
      editor.deleteSelected();
    }

    const duplicateSelected = () => editor?.duplicateSelected();
    function undo() {
      if(!editor)return;
      if(editor.historyManager.index<=0)return notify('没有可以撤销的操作','warning');
      returnToSelection();editor.historyManager.undo();
      Object.assign(engineeringDrawingForm,editor.drawingSettings);notify('已撤销');
    }
    function redo() {
      if(!editor)return;
      if(editor.historyManager.index>=editor.historyManager.states.length-1)return notify('没有可以重做的操作','warning');
      returnToSelection();editor.historyManager.redo();
      Object.assign(engineeringDrawingForm,editor.drawingSettings);notify('已重做');
    }
    const fitView = () => editor?.fitView();
    const viewIso = () => editor?.viewIso();
    const viewFront = () => editor?.viewFront();
    const viewBack = () => editor?.viewBack();
    const viewLeft = () => editor?.viewLeft();
    const viewRight = () => editor?.viewRight();
    const viewTop = () => editor?.viewTop();
    const viewBottom = () => editor?.viewBottom();
    const capturePng = () => editor?.capturePng();

    function propertyChanged(options = {}) {
      if (!selected.value) return;
      const part = selectedPart.value;
      if (options?.skipConnection !== true && part.type === 'PROFILE') editor.connectionManager.updateConnectionsForProfile(part.id);
      editor.updateDimensions();
      editor.historyManager.capture();
      editor.emitStats();
      editor.emitProjectChanged();
    }

    function applyTransformFromFields() {
      if (!selected.value || !selectedPart.value) return;
      if (selectedPart.value.type==='ACCESSORY' && selectedPart.value.mountReference) return notify('已安装配件由宿主定位，请先解除安装关系','warning');
      selected.value.position.set(
        Number(selectedPart.value.position.x || 0),
        Number(selectedPart.value.position.y || 0),
        Number(selectedPart.value.position.z || 0)
      );
      selected.value.updateMatrixWorld(true);
      editor.syncPartFromMesh(selected.value);
      const changed=[selectedPart.value.id];
      const applied=editor.constraintManager.solveForChangedParts(changed);
      editor.accessoryMountManager?.refreshForTargets([...changed,...applied]);
      const profileIds=[...new Set([...changed,...applied])].filter(partId=>editor.getMeshByPartId(partId)?.userData.part?.type==='PROFILE');
      editor.connectionManager.updateConnectionsForProfiles(profileIds);
      propertyChanged({skipConnection:true});
    }

    function setRotationField(axis,event) {
      if (!selected.value || !selectedPart.value) return;
      if (selectedPart.value.type==='ACCESSORY' && selectedPart.value.mountReference) return notify('已安装配件由宿主定位，请先解除安装关系','warning');
      const radians = Number(event.target.value || 0) * Math.PI / 180;
      selectedPart.value.rotation[axis] = radians;
      selected.value.rotation[axis] = radians;
      selected.value.updateMatrixWorld(true);
      editor.syncPartFromMesh(selected.value);
      const changed=[selectedPart.value.id];
      const applied=editor.constraintManager.solveForChangedParts(changed);
      editor.accessoryMountManager?.refreshForTargets([...changed,...applied]);
      const profileIds=[...new Set([...changed,...applied])].filter(partId=>editor.getMeshByPartId(partId)?.userData.part?.type==='PROFILE');
      editor.connectionManager.updateConnectionsForProfiles(profileIds);
      propertyChanged({skipConnection:true});
    }

    function radToDeg(value) {
      return Number((Number(value || 0) * 180 / Math.PI).toFixed(2));
    }

    function importJson() {
      fileInput.value?.click();
    }

    async function handleFile(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      if(!confirmLocalDraftReplacement()){event.target.value='';return;}
      if(dirty.value&&editor.parts.length&&!confirm('打开工程将替换当前未保存的设计。确定继续？')){event.target.value='';return;}
      try {
        const project=await ProjectIO.read(file),previous=autosaveReady;autosaveReady=false;
        try{editor.loadProject(project);}catch(error){autosaveReady=previous;throw error;}
        Object.assign(engineeringDrawingForm,editor.drawingSettings);
        syncManufacturingForm();
        sectionRevision.value++; dirty.value=false; projectRevision.value++;
        saveAutosave(true);
        notify('工程已打开');
      } catch (error) {
        notify(`JSON 导入失败：${error.message}`,'error');
      }
      event.target.value = '';
    }

    function exportJson() {
      if(!editor)return;
      ProjectIO.download(editor.exportProject(),`${editor.drawingSettings.projectName||'铝型材工程'}.json`);
      saveAutosave();
      dirty.value=false;notify('工程文件已导出，请保留下载的 JSON 文件');
    }

    function renameProject() {
      const name=prompt('工程名称',engineeringDrawingForm.projectName);
      if(!name?.trim())return;
      engineeringDrawingForm.projectName=name.trim();
      engineeringDrawingChanged();
    }

    function newProject() {
      if(!editor)return;
      if(!confirmLocalDraftReplacement())return;
      if(dirty.value&&editor.parts.length&&!confirm('当前工程有未保存的修改。确定新建空白工程？建议先保存。'))return;
      returnToSelection();
      // 新建走 Editor 清理领域模型，不在 UI 删改领域数组；示例另设明确入口。
      editor.clear();
      editor.drawingSettings={projectName:'未命名工程',revision:'A',paper:'A3',sideView:'RIGHT'};
      Object.assign(engineeringDrawingForm,editor.drawingSettings);
      quickPanel.value='';rightPanelMode.value='create';activeLibrary.value='profile';
      hasChosenProfile.value=false;drawForm.fixedLengthMm=0;drawForm.continueDrawing=false;
      editor.profileDrawTool.configure({...drawForm});syncManufacturingForm();
      editor.historyManager.reset();
      sectionRevision.value++;projectRevision.value++;dirty.value=false;
      saveAutosave(true);
      editor.sceneManager.resetInitialView();notify('已新建空白工程');
    }

    async function loadSample() {
      if(!confirmLocalDraftReplacement())return;
      if(dirty.value&&editor.parts.length&&!confirm('打开示例将替换当前工程。确定继续？建议先保存。'))return;
      try {
        editor.clear();
        editor.drawingSettings={projectName:'鱼缸架示例',revision:'A',paper:'A3',sideView:'RIGHT'};
        Object.assign(engineeringDrawingForm,editor.drawingSettings);
        editor.historyManager.reset();
        const result=diyGenerator.generate('TURTLE_TANK_RACK',{
          catalogId:getDefaultDesignProfileId('3030'),
          width:1000,depth:650,height:2000,levels:5,centerBeamCount:2,autoConnect:true
        });
        syncManufacturingForm();
        sectionRevision.value++; dirty.value=false; projectRevision.value++;
        saveAutosave(true);
        notify(`已生成鱼缸 / 龟缸架示例 · ${result.createdPartCount} 个构件`);
      } catch (error) {
        notify(error.message,'error');
      }
    }

    function guardProfile() {
      if (!selectedIsProfile.value) {
        notify('请选择型材','warning');
        return false;
      }
      return true;
    }

    function machiningOptions(base = {}) {
      if (!selectedIsProfile.value) return base;
      const isArc = selectedPart.value?.profilePath?.type === 'ARC';
      return {
        ...base,
        stationS:Number(base.stationS ?? base.distanceFromStart ?? 15),
        processStage:isArc ? curvedMachiningStage.value : 'STRAIGHT'
      };
    }

    function addThroughHole() {
      if (!selected.value || !guardProfile()) return;
      editor.machiningManager.addThroughHole(selected.value,machiningOptions({face:'FRONT',stationS:15,diameter:9}));
      editor.emitStats();
      editor.historyManager.capture();
      inspectorTab.value = 'machining';
    }

    function addCountersink() {
      if (!selected.value || !guardProfile()) return;
      editor.machiningManager.addHoleGroup(selected.value,machiningOptions({face:'FRONT',stationS:15,diameter:9,majorDiameter:16,angleDeg:90,secondaryType:'COUNTERSINK'}));
      editor.emitStats();
      editor.historyManager.capture();
      inspectorTab.value = 'machining';
    }

    function addStartTap() {
      if (!selected.value || !guardProfile()) return;
      editor.machiningManager.addEndTap(selected.value,machiningOptions({end:'START',tappingSize:'M8',depth:12}));
      editor.emitStats();
      editor.historyManager.capture();
      inspectorTab.value = 'machining';
    }

    function addEndTap() {
      if (!selected.value || !guardProfile()) return;
      editor.machiningManager.addEndTap(selected.value,machiningOptions({end:'END',tappingSize:'M8',depth:12}));
      editor.emitStats();
      editor.historyManager.capture();
      inspectorTab.value = 'machining';
    }

    function addSlot() {
      if (!selected.value || !guardProfile()) return;
      editor.machiningManager.addSlot(selected.value,machiningOptions({face:'FRONT',stationS:30,length:30,width:8,orientation:'ALONG_PROFILE'}));
      editor.emitStats(); editor.historyManager.capture(); inspectorTab.value='machining';
    }

    function addObroundSlot() {
      if (!selected.value || !guardProfile()) return;
      editor.machiningManager.addObroundSlot(selected.value,machiningOptions({face:'FRONT',stationS:30,length:30,width:8,orientation:'ALONG_PROFILE'}));
      editor.emitStats(); editor.historyManager.capture(); inspectorTab.value='machining';
    }

    function addMillingRegion() {
      if (!selected.value || !guardProfile()) return;
      editor.machiningManager.addMillingRegion(selected.value,machiningOptions({face:'FRONT',stationS:30,length:30,width:20,depth:2,orientation:'ALONG_PROFILE'}));
      editor.emitStats(); editor.historyManager.capture(); inspectorTab.value='machining';
    }

    function addStartEndHole() {
      if (!selected.value || !guardProfile()) return;
      editor.machiningManager.addEndHole(selected.value,machiningOptions({end:'START',diameter:8,depth:12}));
      editor.emitStats(); editor.historyManager.capture(); inspectorTab.value='machining';
    }

    function addEndEndHole() {
      if (!selected.value || !guardProfile()) return;
      editor.machiningManager.addEndHole(selected.value,machiningOptions({end:'END',diameter:8,depth:12}));
      editor.emitStats(); editor.historyManager.capture(); inspectorTab.value='machining';
    }

    function machiningChanged(item = null) {
      if (!selected.value || !selectedIsProfile.value) return;
      if (item && !String(item.type || '').startsWith('END_')) {
        const station = Number(item.stationS ?? item.distanceFromStart ?? 0);
        item.stationS = station;
        item.distanceFromStart = station;
      }
      if (item) editor.machiningManager.setReferenceDatum(selected.value,item.id,item.referenceDatum || (String(item.type||'').startsWith('END_') ? 'END_FACE' : 'A_END'));
      editor.machiningManager.refreshProfile(selected.value);
      editor.historyManager.capture();
    }

    function deleteMachining(item) {
      if (item.generatedByConnectionId) return notify('该加工由连接生成，请删除连接','warning');
      editor.machiningManager.removeItem(selected.value,item.id);
      editor.emitStats();
      editor.historyManager.capture();
    }

    function machiningLinearPattern(item) {
      if (!selected.value || !item) return;
      const count = Math.max(2, Number(prompt('阵列总数量（包含原孔）', '3') || 0));
      if (!count) return;
      const spacingMm = Number(prompt('孔中心间距 mm', '50'));
      if (!Number.isFinite(spacingMm)) return notify('阵列间距无效','warning');
      try {
        const created = editor.machiningPatternManager.linear(selected.value,item.id,{count,spacingMm});
        projectRevision.value++;
        notify(`已生成 ${created.length} 个阵列加工项`);
      } catch (error) { notify(error.message,'error'); }
    }

    function machiningRectangularPattern(item) {
      if (!selected.value || !item) return;
      const countS=Math.max(2,Number(prompt('沿型材方向数量','2')||0));
      const spacingS=Number(prompt('沿型材方向间距 mm','50'));
      const countOffset=Math.max(2,Number(prompt('面内横向数量','2')||0));
      const spacingOffset=Number(prompt('面内横向间距 mm','15'));
      if(!Number.isFinite(spacingS)||!Number.isFinite(spacingOffset))return notify('矩形阵列间距无效','warning');
      try{const created=editor.machiningPatternManager.rectangular(selected.value,item.id,{countS,spacingS,countOffset,spacingOffset});projectRevision.value++;notify(`已生成 ${created.length} 个矩形阵列加工项`);}catch(error){notify(error.message,'error');}
    }

    function machiningEditPattern(item) {
      const patternId=item?.patternSource?.id||item?.pattern?.id;
      if(!patternId)return notify('当前加工项不属于参数阵列','warning');
      const source=selectedPart.value?.machiningItems?.find(value=>value.patternSource?.id===patternId);
      if(!source)return notify('找不到阵列源加工项','error');
      try{
        if(source.patternSource.type==='RECTANGULAR'){
          const countS=Number(prompt('沿型材方向数量',String(source.patternSource.countS||2)));
          const spacingS=Number(prompt('沿型材方向间距 mm',String(source.patternSource.spacingS||50)));
          const countOffset=Number(prompt('面内横向数量',String(source.patternSource.countOffset||2)));
          const spacingOffset=Number(prompt('面内横向间距 mm',String(source.patternSource.spacingOffset||15)));
          const created=editor.machiningPatternManager.updateRectangular(selected.value,patternId,{countS,spacingS,countOffset,spacingOffset});projectRevision.value++;notify(`矩形阵列已更新，共 ${created.length+1} 个加工项`);
        }else{
          const count=Number(prompt('阵列总数量（包含原加工）',String(source.patternSource.count||3)));
          const spacingMm=Number(prompt('中心间距 mm',String(source.patternSource.spacingMm||50)));
          const created=editor.machiningPatternManager.updateLinear(selected.value,patternId,{count,spacingMm});projectRevision.value++;notify(`阵列已更新，共 ${created.length+1} 个加工项`);
        }
      }catch(error){notify(error.message,'error');}
    }

    function machiningDissolvePattern(item) {
      const patternId = item?.patternSource?.id || item?.pattern?.id;
      if (!patternId) return notify('当前加工项不属于参数阵列','warning');
      try { const count=editor.machiningPatternManager.dissolve(selected.value,patternId); projectRevision.value++; notify(`已解除阵列，保留 ${count} 个独立加工项`); }
      catch (error) { notify(error.message,'error'); }
    }

    function machiningCopy(item) {
      try { editor.machiningPatternManager.copy(selected.value,item.id); notify('加工特征已复制，可选择另一根型材后粘贴'); }
      catch (error) { notify(error.message,'error'); }
    }

    function machiningPaste() {
      if (!selected.value || !selectedIsProfile.value) return notify('请先选择目标型材','warning');
      try { const item=editor.machiningPatternManager.paste(selected.value); projectRevision.value++; notify(`已粘贴 ${machiningTypeName(item.type)}`); }
      catch (error) { notify(error.message,'error'); }
    }

    function machiningMirrorOffset(item) {
      try { editor.machiningPatternManager.mirrorOffset(selected.value,item.id); projectRevision.value++; notify('已按加工面中心线镜像'); }
      catch (error) { notify(error.message,'error'); }
    }

    function machiningMirrorFace(item) {
      try { editor.machiningPatternManager.mirrorOppositeFace(selected.value,item.id); projectRevision.value++; notify('已镜像到相对加工面'); }
      catch (error) { notify(error.message,'error'); }
    }

    function machiningMirrorEnd(item) {
      try{editor.machiningPatternManager.mirrorEnd(selected.value,item.id);projectRevision.value++;notify('已按 A/B 端镜像加工');}catch(error){notify(error.message,'error');}
    }

    function toggleMachiningSelection(item) {
      const ids=new Set(machiningSelection.value);ids.has(item.id)?ids.delete(item.id):ids.add(item.id);machiningSelection.value=[...ids];
    }

    function applyMachiningBatchFace() {
      if(!selected.value||!machiningSelection.value.length)return notify('请勾选要批量修改的加工特征','warning');
      try{const count=editor.machiningManager.updateMany(selected.value,machiningSelection.value,{face:batchMachiningFace.value});projectRevision.value++;editor.historyManager.capture();notify(`已批量修改 ${count} 个加工特征`);}catch(error){notify(error.message,'error');}
    }

    function clearMachiningSelection(){machiningSelection.value=[];}

    function machiningTypeName(type) {
      return ({THROUGH_HOLE:'通孔',COUNTERSINK:'沉头',COUNTERBORE:'沉孔',BLIND_HOLE:'盲孔',TAPPED_HOLE:'螺纹孔',SLOT:'槽加工',OBROUND_SLOT:'腰孔',MILLING_REGION:'铣削区域',END_TAP:'端面攻丝',END_HOLE:'端面孔',END_COUNTERBORE:'端面沉孔',END_COUNTERSINK:'端面沉头'})[type] || type;
    }

    function setConnectionSource() {
      if (!guardProfile() || selectedIsCurved.value) return notify('参数化连接目前仅支持直型材','warning');
      connectionSource.value = selected.value;
      notify('已设置连接源，请选择目标型材');
    }

    function createEndScrewConnection() {
      if (!connectionSource.value || !selected.value) return notify('先设置连接源，再选择目标型材','warning');
      try {
        const snap = connectionSource.value?.userData?.lastSnap;
        const options = {designType:connectionRuleId.value};
        if (snap?.targetProfileId === selected.value?.userData?.part?.id && snap?.targetFace) {
          options.sourceEnd = snap.sourceEnd;
          options.targetFace = snap.targetFace;
        }
        editor.connectionManager.createDesignConnection(connectionSource.value,selected.value,options);
        connectionSource.value = null;
        editor.emitStats();
        editor.historyManager.capture();
        inspectorTab.value = 'connections';
        notify('设计连接已建立；真实紧固件和加工请在制造配置中选择');
      } catch (error) {
        notify(error.message,'warning');
      }
    }

    function smartConnect() {
      try {
        editor.smartConnectSelected({designType:connectionRuleId.value});
        inspectorTab.value = 'connections';
        notify('已根据吸附关系建立设计连接');
      } catch (error) {
        notify(error.message,'warning');
      }
    }

    function autoSmartConnect() {
      try {
        const connection=editor.smartConnectRecommendedSelected();
        connectionRuleId.value=connection.designType || DEFAULT_DESIGN_CONNECTION_TYPE;
        inspectorTab.value='connections';
        notify(`已自动选择：${connectionRuleLabel(connection)}`);
      } catch (error) {
        notify(error.message,'warning');
      }
    }

    function connectionRuleLabel(connection) {
      return designConnectionLabel(connection?.designType || connection?.type);
    }

    function connectionSwitchOptions(connection) {
      return editor?.connectionManager?.getDesignSwitchOptions(connection) || [];
    }

    function switchConnectionRule(connection,designType) {
      if(!connection||!designType)return;
      try {
        const previous=connectionRuleLabel(connection);
        const result=editor.connectionManager.switchDesignType(connection,designType,{userOverride:true});
        if(!result.changed)return;
        editor.emitStats();
        editor.historyManager.capture();
        projectRevision.value++;
        notify(`已切换设计连接：${previous} → ${connectionRuleLabel(result.connection)}；制造方案需要重新配置`,'success');
      } catch(error) {
        notify(error.message,'warning');
      }
    }

    function switchConnectionRecommended(connection) {
      if(!connection)return;
      try {
        const previous=connectionRuleLabel(connection);
        const result=editor.connectionManager.switchToRecommendedDesignType(connection,{userOverride:true});
        if(!result.changed){
          notify('当前已经是可用的推荐连接方式','warning');
          return;
        }
        editor.emitStats();
        editor.historyManager.capture();
        projectRevision.value++;
        notify(`已从 ${previous} 切换为 ${connectionRuleLabel(result.connection)}；制造方案需要重新配置`,'success');
      } catch(error) {
        notify(error.message,'warning');
      }
    }

    function removeConnection(connection) {
      editor.connectionManager.removeConnection(connection.id);
      editor.emitStats();
      editor.historyManager.capture();
    }

    function changeSelectionFilter() {
      editor?.setSelectionFilter(selectionFilter.value);
      notify(selectionFilter.value === 'ALL' ? '选择过滤：全部构件' : `选择过滤：${selectedTypeNameForFilter(selectionFilter.value)}`);
    }

    function selectedTypeNameForFilter(type) {
      return ({PROFILE:'型材',SHAFT:'光轴',PANEL:'板材',ACCESSORY:'五金/配件',PRIMITIVE:'光轴/板材'})[type] || '全部构件';
    }

    function toggleFeatureSelectMode() {
      featureSelectMode.value = !featureSelectMode.value;
      editor?.setFeatureSelectionMode(featureSelectMode.value);
      if (featureSelectMode.value) {
        if (measureMode.value) toggleMeasure();
        if (dimensionMode.value) toggleDimensionMode();
        if (boxSelectMode.value) toggleBoxSelect();
        if (lassoSelectMode.value) toggleLassoSelect();
        notify('特征选择：依次点两个端部 / 面 / 槽中心，系统可自动识别配合','warning');
      } else selectedFeatures.value = [];
    }

    function clearFeatureSelection() {
      editor?.clearFeatureSelection();
      selectedFeatures.value = [];
    }

    function createFeatureMate() {
      try {
        const constraint = editor?.createMateFromSelectedFeatures({...featureMateOptions});
        projectRevision.value++;
        featureSelectMode.value = false;
        editor?.setFeatureSelectionMode(false);
        notify(`已建立特征配合：${constraint?.label || '刚性配合'}`);
      } catch (error) { notify(error.message,'warning'); }
    }

    function featureLabel(feature) {
      if (!feature) return '-';
      if (feature.type === 'PROFILE_END') return `${feature.displayId} · ${feature.end === 'START' ? 'A端' : 'B端'}`;
      if (feature.type === 'PROFILE_SLOT') return `${feature.displayId} · ${feature.face}槽中心`;
      return `${feature.displayId} · ${feature.face}面`;
    }

    function createConstraintFromSnap() {
      try {
        const constraint = editor?.createConstraintFromLastSnap();
        projectRevision.value++;
        notify(`已固定吸附关系：${constraint?.label || '刚性约束'}`);
      } catch (error) { notify(error.message,'warning'); }
    }

    function toggleConstraintSuppressed(constraint) {
      if (!constraint) return;
      const updated = editor?.setConstraintSuppressed(constraint.id,constraint.suppressed !== true);
      projectRevision.value++;
      notify(updated?.suppressed ? '约束已抑制，不再参与求解' : '约束已恢复并重新求解');
    }

    function applyConstraintSuppressionSuggestion() {
      try {
        const result=editor?.applyConstraintSuppressionSuggestion();
        projectRevision.value++;
        notify(`已按建议抑制：${result?.suggestion?.label || result?.constraint?.label || '约束'}`);
      } catch (error) { notify(error.message,'warning'); }
    }

    function isolateSelectedParts() {
      try { editor?.isolateSelection(); projectRevision.value++; notify('已隔离显示当前选择'); }
      catch (error) { notify(error.message,'warning'); }
    }

    function removeConstraint(constraint) {
      if (!constraint) return;
      editor?.removeConstraint(constraint.id);
      projectRevision.value++;
      notify('约束已删除');
    }


    function engineeringDrawingChanged() {
      if (!editor) return;
      editor.drawingSettings = {...editor.drawingSettings,...engineeringDrawingForm};
      editor.historyManager.capture();
      editor.emitProjectChanged();
    }

    function exportEngineeringDrawing() {
      if (!editor) return;
      try {
        engineeringDrawingChanged();
        editor.engineeringDrawingService.downloadSvg({
          projectName:engineeringDrawingForm.projectName,
          revision:engineeringDrawingForm.revision,
          paper:engineeringDrawingForm.paper,
          sideView:engineeringDrawingForm.sideView,
          appVersion:CURRENT_APP_VERSION,
          fileName:`${engineeringDrawingForm.projectName || '总装'}_工程图_${engineeringDrawingForm.paper}.svg`
        });
        notify('二维总装工程图已导出');
      } catch (error) { notify(`工程图导出失败：${error.message}`,'error'); }
    }

    function exportEngineeringDrawingDxf() {
      if (!editor) return;
      try {
        engineeringDrawingChanged();
        editor.engineeringDrawingService.downloadDxf({
          projectName:engineeringDrawingForm.projectName,
          revision:engineeringDrawingForm.revision,
          paper:engineeringDrawingForm.paper,
          sideView:engineeringDrawingForm.sideView,
          appVersion:CURRENT_APP_VERSION,
          fileName:`${engineeringDrawingForm.projectName || '总装'}_工程图_${engineeringDrawingForm.paper}.dxf`
        });
        notify('二维总装工程图 DXF 已导出');
      } catch (error) { notify(`DXF 导出失败：${error.message}`,'error'); }
    }

    function runFactoryValidation() {
      if (!editor) return;
      validationReport.value = editor.validateForFactory();
      pendingFactoryExport.value = false;
      validationVisible.value = true;
    }

    function closeValidation() {
      validationVisible.value = false;
      pendingFactoryExport.value = false;
    }

    function focusValidationIssue(item) {
      if (!item) return;
      if (!editor?.focusDiagnosticIssue(item)) return notify('该检查项没有可定位的构件','warning');
      validationVisible.value = false;
      notify(`已定位：${item.subject || item.code}`);
    }

    async function exportFactoryPackage() {
      if (!editor) return;
      const configStatus=editor.manufacturingConfigurator?.status?.();
      if(configStatus && !configStatus.ready){
        openManufacturingConfig(configStatus.unconfiguredProfilePartCount>0?'profiles':'connections');
        notify(`制造配置未完成：还有 ${configStatus.unconfiguredProfilePartCount} 根型材、${configStatus.unconfiguredConnectionCount} 个连接待配置`,'warning');
        return;
      }
      const result = editor.validateForFactory();
      validationReport.value = result;
      if (!result.ok || result.warnings.length > 0) {
        pendingFactoryExport.value = result.ok;
        validationVisible.value = true;
        if (!result.ok) notify(`生产检查失败：${result.errors.length} 项错误`,'error');
        else notify(`存在 ${result.warnings.length} 项警告，请确认后导出`,'warning');
        return;
      }
      await doFactoryExport();
    }

    async function confirmFactoryExport() {
      if (!validationReport.value?.ok) return;
      validationVisible.value = false;
      pendingFactoryExport.value = false;
      await doFactoryExport();
    }

    async function doFactoryExport() {
      try {
        await editor.factoryPackageExporter.export();
        notify('工厂加工包已导出');
      } catch (error) {
        notify(error.message,'error');
      }
    }

    function openManufacturingConfig(tab='profiles') {
      manufacturingConfigTab.value=tab;
      manufacturingConfigVisible.value=true;
    }

    function configureManufacturingProfile(group,profileId) {
      if(!group||!profileId)return;
      try {
        const count=editor.manufacturingConfigurator.configureProfileGroup(group.designProfileId,profileId);
        editor.historyManager.capture();
        projectRevision.value++;
        notify(`已为 ${count} 根 ${group.label} 配置制造规格`);
      } catch(error) { notify(error.message,'warning'); }
    }

    function clearManufacturingProfile(group) {
      if(!group)return;
      const count=editor.manufacturingConfigurator.clearProfileGroup(group.designProfileId);
      editor.historyManager.capture();
      projectRevision.value++;
      notify(`已清除 ${count} 根型材的制造规格`,'warning');
    }

    function configureManufacturingConnection(row,ruleId) {
      if(!row||!ruleId)return;
      try {
        editor.manufacturingConfigurator.configureConnection(row.id,ruleId);
        editor.historyManager.capture();
        projectRevision.value++;
        notify(`已配置连接：${row.label}`);
      } catch(error) { notify(error.message,'warning'); }
    }

    function clearManufacturingConnection(row) {
      if(!row)return;
      editor.manufacturingConfigurator.clearConnection(row.id);
      editor.historyManager.capture();
      projectRevision.value++;
      notify(`已清除连接制造方案：${row.label}`,'warning');
    }

    function recommendManufacturingConfig() {
      try {
        const result=editor.manufacturingConfigurator.recommendAll();
        editor.historyManager.capture();
        projectRevision.value++;
        notify(`已自动配置：${result.profiles} 根型材，${result.connections} 个连接`);
      } catch(error) { notify(error.message,'warning'); }
    }

    function clearManufacturingConfig() {
      const result=editor.manufacturingConfigurator.clearAll();
      editor.historyManager.capture();
      projectRevision.value++;
      notify(`已清除制造配置：${result.profiles} 根型材，${result.connections} 个连接`,'warning');
    }

    function openEngineeringCenter(tab = 'materials') {
      engineeringCenterTab.value = tab;
      engineeringCenterVisible.value = true;
      nextTick(()=>document.querySelector('.engineering-current-row')?.scrollIntoView({block:'center'}));
    }

    function resetWorkbenchLayout() {
      layoutManager?.reset();
      notify('工作台布局已复位');
    }

    function engineeringRowDisplayIds(row) {
      const text=(row||[]).map(value=>String(value??'')).join(' ');
      return [...new Set(text.match(/(?:P|B|S|A|H|C|M|G)\d{3}|(?:P|S|B|A)-\d+/g)||[])];
    }

    function engineeringRowHasParts(row) {
      return engineeringRowDisplayIds(row).length>0;
    }

    function engineeringRowSelected(row) {
      const rowIds=new Set(engineeringRowDisplayIds(row));
      if(!rowIds.size)return false;
      return selectedMeshes.value.some(mesh=>rowIds.has(mesh?.userData?.part?.manufacturingCode)||rowIds.has(mesh?.userData?.part?.displayId));
    }

    function focusEngineeringRow(row) {
      if(!editor)return;
      const displayIds=engineeringRowDisplayIds(row);
      if(!displayIds.length){notify('这条清单没有可定位的三维构件','warning');return;}
      const wanted=new Set(displayIds);
      const meshes=editor.parts.filter(part=>wanted.has(part.manufacturingCode)||wanted.has(part.displayId)).map(part=>editor.getMeshByPartId(part.id)).filter(Boolean);
      if(!meshes.length){notify('没有找到对应的三维构件','warning');return;}
      editor.selectMany(meshes);
      editor.focusSelection();
      engineeringCenterVisible.value=false;
      notify(`已定位 ${meshes.length} 个构件`);
    }

    function focusAssemblyInstructionStep(step, explode = false) {
      if(!editor||!step?.partIds?.length)return;
      try {
        editor.assemblyPlaybackManager?.stop?.();
        activeAssemblyInstructionStepId.value=step.id;
        if(explode){
          editor.explodeAssemblyStep(step.partIds,assemblyExplodeDistance.value||120);
          assemblyExplosionActive.value=true;
        } else {
          editor.assemblyPresentationManager?.collapse();
          assemblyExplosionActive.value=false;
          editor.focusPartIds(step.partIds);
        }
        engineeringCenterVisible.value=false;
        notify(explode?`正在预览步骤 ${step.step}：${step.title}`:`已定位步骤 ${step.step}：${step.title}`);
      } catch(error){notify(error.message,'warning');}
    }

    function startAssemblyPlayback() {
      try {
        if(assemblyPlaybackState.active && editor.assemblyPlaybackManager?.steps?.length){
          editor.assemblyPlaybackManager.start(null,{distanceMm:assemblyExplodeDistance.value||140});
        } else {
          editor.startAssemblyPlayback({distanceMm:assemblyExplodeDistance.value||140});
        }
        assemblyExplosionActive.value=false;
        notify(assemblyPlaybackState.active?'继续播放装配步骤':'开始播放装配步骤');
      } catch(error){notify(error.message,'warning');}
    }

    function toggleAssemblyPlayback() {
      if(assemblyPlaybackState.playing){ editor.pauseAssemblyPlayback(); notify('装配播放已暂停','warning'); }
      else startAssemblyPlayback();
    }

    function previousAssemblyPlaybackStep() {
      try { editor.previousAssemblyPlaybackStep(); } catch(error){notify(error.message,'warning');}
    }

    function nextAssemblyPlaybackStep() {
      try { editor.nextAssemblyPlaybackStep(); } catch(error){notify(error.message,'warning');}
    }

    function showAssemblyPlaybackStep(step) {
      const index=assemblyInstructionSteps.value.findIndex(item=>item.id===step?.id);
      if(index<0)return;
      assemblyGuidePageIndex.value=index;
      try { editor.assemblyPlaybackManager.load(assemblyInstructionSteps.value); editor.assemblyPlaybackManager.show(index,{animate:true}); }
      catch(error){notify(error.message,'warning');}
    }

    function previousAssemblyGuidePage() {
      assemblyGuidePageIndex.value=Math.max(0,assemblyGuidePageIndex.value-1);
    }

    function nextAssemblyGuidePage() {
      assemblyGuidePageIndex.value=Math.min(Math.max(0,assemblyGuidePageCount.value-1),assemblyGuidePageIndex.value+1);
    }

    function selectAssemblyGuidePage(step) {
      const index=assemblyInstructionSteps.value.findIndex(item=>item.id===step?.id);
      if(index>=0)assemblyGuidePageIndex.value=index;
    }

    function printAssemblyGuide() {
      const steps=assemblyInstructionSteps.value;
      if(!steps.length)return notify('当前工程暂无可打印的装配步骤','warning');
      const popup=window.open('','_blank','width=980,height=760');
      if(!popup)return notify('浏览器阻止了打印窗口，请允许弹出窗口后重试','warning');
      const html=buildAssemblyGuidePrintHtml(steps,{projectName:engineeringDrawingForm.projectName||'未命名工程',appVersion:CURRENT_APP_VERSION});
      popup.document.open();popup.document.write(html);popup.document.close();
      window.setTimeout(()=>{try{popup.focus();popup.print();}catch{}},260);
    }

    function restoreAssemblyInstructionView() {
      editor?.stopAssemblyPlayback?.();
      activeAssemblyInstructionStepId.value=null;
      editor?.collapseAssemblyExplosion?.();
      assemblyExplosionActive.value=false;
      notify('已还原装配预览');
    }

    watch(() => assemblyInstructionSteps.value.length, count => {
      if(count<=0)assemblyGuidePageIndex.value=0;
      else if(assemblyGuidePageIndex.value>=count)assemblyGuidePageIndex.value=count-1;
    });

    function round(value) {
      return Number(Number(value).toFixed(2));
    }

    return {
      wholeStretchState,startWholeStretch,confirmWholeStretch,cancelWholeStretch,stretchRangeMode,
      profilePlacementState,quickAlignmentVisible,toggleQuickAlignment,applyQuickAlignment,openShaftSmart,cancelPlacementTools,
      shaftSmart,shaftSmartTypes,shaftSmartDefinition,shaftSmartPorts,shaftSmartBaseLabel,shaftSmartAvailable,createShaftSmartFixture,
      hasHiddenParts,toggleSelectionVisibility,mirrorAlong,clearAllConnections,
      quickPanel,rightPanelMode,resourceCategories,workbenchIcon,hoverCadMenu,keepCadMenuOpen,closeCadMenus,positionFooterMenu,repositionFooterMenus,footerTip,footerTipElement,footerContextTip,showFooterTip,hideFooterTip,leaveFooterTip,viewCubeViewport,viewDirections,openQuickPanel,openResource,viewDirection,quickRotate,
      ConnectionComponentOptions,ShaftComponentOptions,PanelShapeOptions,AccessoryComponentOptions,ProfileClosureOptions,FastenerHeadOptions,FootCupOptions,SlideTypeOptions,SlideLengthOptions,EndCapMaterialOptions,APillarLengthOptions,APillarSideOptions,
      catalogConnectionForm,catalogAccessoryForm,profileClosure,profileChoices,referenceProfiles,extensionProfiles,connectionSpecOptions,currentConnectionComponent,selectedConnectionInstallable,snapSelectedConnection,editorCycleConnectionCandidate,currentShaftComponent,currentAccessoryComponent,secondShaftDiameters,fastenerThreadOptions,fastenerLengthOptions,panelFields,panelShapeLabel,panelPreviewLabel,currentPanelDimensions,
      placeShaftComponent,placePanelComponent,placeConnectionComponent,placeAccessoryComponent,
      PanelShapeFields,updatePanelShapeParameter,
      viewport,fileInput,sectionDxfInput,selected,selectedMeshes,selectionCount,selectedPart,selectedIsProfile,selectedMachiningItems,selectedIsCurved,selectedTypeName,
      relatedConnections,connectionOverview,relatedConstraints,constraintDiagnostics,selectedMobility,connectionSource,dimensions,stats,toast,validationVisible,validationReport,pendingFactoryExport,engineeringCenterVisible,engineeringCenterTab,engineeringCenterHeaders,engineeringCenterBody,assemblyInstructionSteps,assemblyGuidePageIndex,assemblyGuideCurrentStep,assemblyGuidePageCount,activeAssemblyInstructionStepId,assemblyPlaybackState,manufacturingConfigVisible,manufacturingConfigTab,manufacturingProfileGroups,manufacturingConnectionRows,manufacturingConfigStatus,showShortcutHelp,
      catalogProfileCanvas,selectedDesignProfile,newProject,renameProject,activeLibrary,connectionPlacementState,machiningPlacementState,accessoryPlacementState,inspectorTab,toolMode,snapEnabled,autoConnectionEnabled,featureSelectMode,selectedFeatures,featureMateOptions,gridEnabled,projection,profileSearch,profileAdvanced,profileCatalogLoading,accessoryCatalogLoading,accessorySearch,accessoryCategory,accessoryCatalogManagerVisible,accessoryCatalogManagerSearch,accessoryEditorVisible,accessoryEditorMode,accessoryForm,profileCatalogManagerVisible,profileCatalogManagerSearch,databaseProfileRows,customProfileVisible,customProfileMode,customProfileForm,profileSectionPreviewCanvas,profileSectionTemplateOptions,customProfilePreviewSvg,customProfilePreviewState,lastSnap,dragAsset,measureMode,measureResult,dimensionMode,dimensionState,userDimensions,dimensionChainAxis,annotationOptions,boxSelectMode,lassoSelectMode,drawState,gripState,selectionFilter,transformSpace,movementStepMm,transformMoveScope,workPlaneVisible,featureHover,contourPresetForm,curvedMachiningStage,machiningSelection,batchMachiningFace,contextMenu,jointQuickMenu,relationQuickMenu,interferenceState,projectParts,projectGroups,selectedAssemblyId,selectedContourAssembly,selectedContourEdges,selectedContourPoints,selectedContourConstraints,contourConstraintForm,contourEditState,activeContourConstraintId,activeConnectionDetail,assemblyDiagnostics,assemblyExplosionActive,assemblyExplodeDistance,dirty,autosaveInfo,hasAutosave,manufacturingSummary,
      designProfiles,profileCatalog,profileSystems,nominalOptions,newVariants,selectedVariants,visibleProfileVariants,frameProfileOptions,connectionRules,connectionRuleId,hardwareCatalog,databaseAccessories,databaseAccessoryRows,visibleAccessories,accessoryManagerRows,accessoryCategoryOptions,
      newProfile,newProfileThicknessOptions,selectedThicknessOptions,selectedPathMetrics,newShaft,newPanel,panelFitForm,doorForm,profileReplaceForm,diyTemplates,diyTemplateId,diyForm,selectedDiyTemplate,frameForm,drawForm,drawerForm,arrayForm,mirrorForm,circularForm,engineeringDrawingForm,shaftDiameters,catalogAccessoryId,selectedCatalogAccessory,selectedConnectionPreview,
      sectionTargetVariant,sectionInfo,sectionSvg,sectionIsCustom,canSmartConnect,
      endLabel,faceLabel,mateKindLabel,constraintStatusLabel,assemblyStatusLabel,severityLabel,validationCategoryLabel,quickNominal,nominalChanged,newProfileModelChanged,toggleNewProfileFaceClosure,startProfileDrag,dropAsset,quickAddProfile,openInspectorForNewProfile,addConfiguredProfile,profileThumbSvg,profileManagerThumbSvg,openCustomProfileDialog,openProfileCatalogManager,closeProfileCatalogManager,editDatabaseProfile,duplicateDatabaseProfile,toggleDatabaseProfile,closeCustomProfileDialog,saveCustomProfile,loadDatabaseProfiles,removeDatabaseProfile,loadAccessoryCatalog,addCatalogAccessory,mountCatalogAccessory,cancelAccessoryPlacement,mountedTargetLabel,mountPositionLabel,detachSelectedAccessory,openAccessoryCatalogManager,closeAccessoryCatalogManager,openAccessoryEditor,saveAccessoryEditor,toggleAccessoryCatalog,removeAccessoryCatalog,accessoryCategoryLabel,startProfileDraw,stopProfileDraw,cancelProfileDrawStep,confirmProfileDraw,returnToSelection,showRightPanel,finishContourDraw,drawOptionsChanged,syncDrawProfile,beginContourFrameEdit,stopContourFrameEdit,setContourEdgeLength,toggleContourOrthogonal,addContourEdgeConstraint,addContourPointAlignment,focusContourConstraint,removeContourConstraint,applyQuickContourRelation,toggleQuickContourRelation,deleteQuickContourRelation,createContourPreset,showAssemblyConnectionDetail,focusAssemblyConnectionDetail,connectionDiagramSvg,
      addShaft,addPanel,applyPanelPreset,createPanelFromOpening,refitSelectedPanel,createDoorFromOpening,refitSelectedDoor,replaceSelectedProfiles,selectDiyTemplate,generateDiyTemplate,generateFrame,generateDrawers,duplicateArray,mirrorSelection,circularArray,addHardware,
      selectedNominalChanged,selectedProfileModelChanged,profileMetaChanged,toggleSelectedFaceClosure,selectedPathChanged,primitiveChanged,
      profileLengthForm,profileLengthEditable,profileLengthEndBlocked,syncProfileLengthForm,applyProfileLength,
      importSectionDxf,handleSectionDxf,restoreReferenceSection,
      startConnectionPlacement,cancelConnectionPlacement,startMachiningPlacement,cancelMachiningPlacement,contextStartConnection,quickStartConnection,contextStartAccessory,quickStartAccessory,contextOpenAccessories,contextOpenMachining,contextOpenPanelTools,setMode,toggleTransformSpace,setTransformSpace,setMovementStep,setTransformMoveScope,toggleWorkPlane,setWorkPlane,applyContextProfileLength,promptProfileLength,toggleSnap,toggleAutoConnection,completeExistingConnections,clearAutoConnections,toggleGrid,toggleProjection,toggleMeasure,toggleDimensionMode,updateAnnotationOptions,removeUserDimension,clearUserDimensions,userDimensionChanged,userDimensionValue,userDimensionDrivenChanged,userDimensionBindingLabel,userDimensionUnit,userDimensionMin,createSelectionAxisDimension,createSelectionSlotDimension,createSelectionAngleDimension,createDimensionChain,createSelectedRadiusDimension,createSelectedArcAngleDimension,createMachiningDimension,createMachiningOffsetDimension,createMachiningBaselineChain,toggleBoxSelect,toggleLassoSelect,deleteSelected,duplicateSelected,groupSelection,ungroupSelection,hideSelection,toggleLockSelection,focusSelection,undo,redo,fitView,viewIso,viewFront,viewBack,viewLeft,viewRight,viewTop,viewBottom,capturePng,
      propertyChanged,applyTransformFromFields,setRotationField,radToDeg,
      importJson,handleFile,exportJson,loadSample,saveAutosave,restoreAutosave,clearAutosave,downloadLocalDraft,autosaveError,selectProjectPart,selectProjectGroup,toggleProjectPartVisibility,showAllParts,updateEndCuts,
      addThroughHole,addCountersink,addStartTap,addEndTap,addSlot,addObroundSlot,addMillingRegion,addStartEndHole,addEndEndHole,machiningChanged,deleteMachining,machiningTypeName,machiningLinearPattern,machiningRectangularPattern,machiningEditPattern,machiningDissolvePattern,machiningCopy,machiningPaste,machiningMirrorOffset,machiningMirrorFace,machiningMirrorEnd,toggleMachiningSelection,applyMachiningBatchFace,clearMachiningSelection,
      renameProjectGroup,makeSubassembly,moveAssemblyStep,editAssemblyNote,isolateProjectGroup,explodeAssemblyView,collapseAssemblyView,runAssemblyDiagnostics,focusAssemblyIssue,toggleAssemblyVisibility,toggleAssemblyLock,dissolveProjectGroup,focusConstraintIssue,setConnectionSource,createEndScrewConnection,smartConnect,autoSmartConnect,removeConnection,connectionRuleLabel,connectionSwitchOptions,switchConnectionRule,switchConnectionRecommended,changeSelectionFilter,createConstraintFromSnap,removeConstraint,toggleConstraintSuppressed,applyConstraintSuppressionSuggestion,isolateSelectedParts,toggleFeatureSelectMode,clearFeatureSelection,createFeatureMate,featureLabel,
      openManufacturingConfig,configureManufacturingProfile,clearManufacturingProfile,configureManufacturingConnection,clearManufacturingConnection,recommendManufacturingConfig,clearManufacturingConfig,openEngineeringCenter,resetWorkbenchLayout,engineeringRowHasParts,engineeringRowSelected,focusEngineeringRow,focusAssemblyInstructionStep,startAssemblyPlayback,toggleAssemblyPlayback,previousAssemblyPlaybackStep,nextAssemblyPlaybackStep,showAssemblyPlaybackStep,previousAssemblyGuidePage,nextAssemblyGuidePage,selectAssemblyGuidePage,printAssemblyGuide,restoreAssemblyInstructionView,engineeringDrawingChanged,exportEngineeringDrawing,exportEngineeringDrawingDxf,runFactoryValidation,closeValidation,focusValidationIssue,exportFactoryPackage,confirmFactoryExport
    };
  }
}).mount('#app');

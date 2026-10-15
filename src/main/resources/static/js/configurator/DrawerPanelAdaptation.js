import * as THREE from 'three';
import {panelPose} from '../geometry/PanelReliefGeometry.js';
import {panelMaterialContours} from '../model/PanelShapeModel.js';
import {clipContourToRectangle,contourArea} from '../model/PanelContourMath.js';
import {drawerSlideGeometry} from '../model/DrawerSlideGeometryModel.js';
import {scanPanelConnectorRelief} from './PanelReliefManager.js';

/** 与框口板同源裁角；只裁连接件的边缘轮廓，不给内部梁开通道或删掉导轨安装带。 */
export function adaptDrawerPanels(editor,plan,objects,options={}) {
  const members=plan.layout.members,rails=members.filter(member=>member.type==='ACCESSORY'),reused=[];
  for(const member of members.filter(member=>member.role==='DIVIDER')) {
    const existing=editor.meshes.find(mesh=>mesh.visible!==false&&canReuseDivider(editor,member,mesh.userData?.part));
    if(existing) { assertRailBands(existing.userData.part,rails);reused.push({member,partId:existing.userData.part.id}); }
  }
  plan.reusedPartIds=reused.map(value=>value.partId);
  plan.layout.members=members.filter(member=>!reused.some(value=>value.member===member));
  for(const member of plan.layout.members.filter(member=>member.type==='PANEL')) {
    const original=structuredClone(member.dimensions);
    try {
      const relief=scanPanelConnectorRelief(member,objects,options.connectorGapMm??1,{allowFailures:true});
      if(relief.notches.length)member.dimensions.edgeNotches=relief.notches;
      panelMaterialContours(member);
      plan.errors.push(...relief.errors.map(error=>member.name+'：'+error));
      assertJointBands(member,plan.layout);
      if(['SIDE','DIVIDER'].includes(member.role))assertRailBands(member,rails);
    } catch(error) {
      // 轮廓本身无效时保留原矩形作为红色示意，不能让一个格的绘图错误清掉其它格。
      try{panelMaterialContours(member);}catch{member.dimensions=original;}
      plan.errors.push(member.name+'：'+error.message);
    }
  }
  plan.notchCount=plan.layout.members.reduce((sum,member)=>sum+(member.dimensions.edgeNotches?.length||0),0);
  plan.dividerCount=plan.layout.members.filter(member=>member.role==='DIVIDER').length;
}

function canReuseDivider(editor,desired,part) {
  if(!part||part.type!=='PANEL'||part.hidden||part.dimensions?.panelShape&&part.dimensions.panelShape!=='rectangle')return false;
  const assembly=editor.assemblyManager.get(part.assemblyId);
  if(assembly?.kind==='DRAWER'||part.name?.startsWith('抽屉'))return false;
  if(Math.abs(Number(part.dimensions.thickness)-desired.dimensions.thickness)>.001)return false;
  const inverse=panelPose(part).invert(),matrix=inverse.multiply(panelPose(desired));
  const points=[];
  for(const x of [-desired.dimensions.width/2,desired.dimensions.width/2])for(const y of [-desired.dimensions.height/2,desired.dimensions.height/2])points.push(new THREE.Vector3(x,y,0).applyMatrix4(matrix));
  if(points.some(point=>Math.abs(point.z)>.001))return false;
  const box=new THREE.Box3().setFromPoints(points);
  try {assertMaterialRectangle(part,{minX:box.min.x,maxX:box.max.x,minY:box.min.y,maxY:box.max.y},'现有隔板覆盖范围');return true;}catch{return false;}
}

/** 中央接合带是设计守卫而非承载认证；边角可让开五金，接合带不能被裁空。 */
function assertJointBands(member,layout) {
  const d=member.dimensions,t=layout.parameters.boardThickness;
  const edge=(side)=>{
    const vertical=side==='LEFT'||side==='RIGHT',length=Math.min(40,(vertical?d.height:d.width)-.002);
    const rect=vertical?{minX:side==='LEFT'?-d.width/2+.001:d.width/2-t+.001,maxX:side==='LEFT'?-d.width/2+t-.001:d.width/2-.001,minY:-length/2,maxY:length/2}
      :{minX:-length/2,maxX:length/2,minY:side==='BOTTOM'?-d.height/2+.001:d.height/2-t+.001,maxY:side==='BOTTOM'?-d.height/2+t-.001:d.height/2-.001};
    assertMaterialRectangle(member,rect,'箱体中央接合带');
  };
  if(member.role==='SIDE'){edge('LEFT');edge('RIGHT');edge('BOTTOM');}
  if(member.role==='BACK'){edge('LEFT');edge('RIGHT');edge('BOTTOM');}
  if(member.role==='BOTTOM')for(const side of ['LEFT','RIGHT','BOTTOM','TOP'])edge(side);
  if(member.role==='面板') {
    const inverse=panelPose(member).invert();
    for(const side of layout.members.filter(value=>value.role==='SIDE'&&value.drawerIndex===member.drawerIndex)) {
      const center=new THREE.Vector3(side.position.x,side.position.y,side.position.z).applyMatrix4(inverse);
      const half=Math.min(20,layout.boxHeight/2-.001);
      assertMaterialRectangle(member,{minX:center.x-t/2+.001,maxX:center.x+t/2-.001,minY:center.y-half,maxY:center.y+half},'面板与侧板接合带');
    }
  }
}

/** 实体导轨两体的接触面足迹必须完整留在板材上；不凭“同组件”忽略穿透。 */
function assertRailBands(panel,rails) {
  const inverse=panelPose(panel).invert(),half=Number(panel.dimensions.thickness)/2;
  for(const rail of rails) {
    const matrix=inverse.clone().multiply(panelPose(rail)),geometry=drawerSlideGeometry(rail.dimensions);
    for(const body of geometry.bodies) {
      const points=[];
      for(const x of [-body.width/2,body.width/2])for(const y of [-body.height/2,body.height/2])for(const z of [-body.length/2,body.length/2])points.push(new THREE.Vector3(x+body.x,y,z).applyMatrix4(matrix));
      const box=new THREE.Box3().setFromPoints(points);
      if(Math.min(Math.abs(box.min.z-half),Math.abs(box.max.z-half),Math.abs(box.min.z+half),Math.abs(box.max.z+half))>.001)continue;
      if(box.max.x<=-panel.dimensions.width/2||box.min.x>=panel.dimensions.width/2||box.max.y<=-panel.dimensions.height/2||box.min.y>=panel.dimensions.height/2)continue;
      assertMaterialRectangle(panel,{minX:box.min.x+.001,maxX:box.max.x-.001,minY:box.min.y+.001,maxY:box.max.y-.001},rail.name+'安装带');
    }
  }
}

function assertMaterialRectangle(part,rect,label) {
  const w=rect.maxX-rect.minX,h=rect.maxY-rect.minY;
  if(w<=0||h<=0)throw new Error(label+'尺寸无效');
  const cx=(rect.minX+rect.maxX)/2,cy=(rect.minY+rect.maxY)/2,contours=panelMaterialContours(part);
  const area=ring=>clipContourToRectangle(ring.map(point=>({x:point.x-cx,y:point.y-cy})),w/2,h/2).reduce((sum,value)=>sum+Math.abs(contourArea(value)),0);
  const remaining=area(contours.outer)-contours.holes.reduce((sum,hole)=>sum+area(hole),0);
  if(remaining+1e-4<w*h)throw new Error('裁角或板材范围不能完整保留'+label+'，请调整尺寸/层数/排数');
}

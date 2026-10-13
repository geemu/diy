/** 导轨设计模型的局部实体尺寸；渲染和新抽屉布局共用，不代表采购件安装尺寸。 */
export function drawerSlideGeometry(dimensions = {}) {
  const length = Number(dimensions.length || 450);
  const width = Number(dimensions.width || 12);
  const height = Number(dimensions.height || 45);
  const innerWidth = Math.max(3,width - 3);
  const innerHeight = Math.max(12,height * 0.58);
  const innerLength = Math.max(30,length - 22);
  const innerX = width * 0.48;
  const minX = Math.min(-width / 2,innerX - innerWidth / 2);
  const maxX = Math.max(width / 2,innerX + innerWidth / 2);
  return {
    bodies:[
      {width,height,length,x:0},
      {width:innerWidth,height:innerHeight,length:innerLength,x:innerX}
    ],
    minX,maxX,occupiedWidth:maxX - minX,
    height:Math.max(height,innerHeight),length:Math.max(length,innerLength)
  };
}

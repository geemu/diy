/** Pure business math for CAD profile endpoint stretching. */
export function normalizeGripEnd(value){return value==='START'?'START':'END';}

export function clampGripLength(value,minLengthMm=10){
  const min=Math.max(.001,Number(minLengthMm)||10);
  const length=Number(value);
  return Number.isFinite(length)?Math.max(min,length):min;
}

export function remapMachiningStations(items,oldLength,newLength){
  const oldL=Math.max(0,Number(oldLength)||0),newL=Math.max(0,Number(newLength)||0);
  return structuredClone(items||[]).map(item=>{
    if(item.end)return item;
    const oldStation=Number(item.stationS??item.distanceFromStart??0);
    let next=oldStation;
    if(String(item.referenceDatum||item.reference?.datum||'A_END').toUpperCase()==='B_END'){
      const fromB=oldL-oldStation;
      next=newL-fromB;
    }
    next=Math.max(0,Math.min(newL,next));
    item.stationS=next;
    item.distanceFromStart=next;
    if(item.reference)item.reference.stationS=next;
    return item;
  });
}

export function stretchedCenterPoint(fixedPoint,dragAxis,newLength){
  const length=Number(newLength)||0;
  return {
    x:Number(fixedPoint?.x||0)+Number(dragAxis?.x||0)*length/2,
    y:Number(fixedPoint?.y||0)+Number(dragAxis?.y||0)*length/2,
    z:Number(fixedPoint?.z||0)+Number(dragAxis?.z||0)*length/2
  };
}

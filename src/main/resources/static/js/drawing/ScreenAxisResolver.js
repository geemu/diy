import * as THREE from 'three';

/** 根据鼠标与三条世界轴的屏幕投影选择方向，玩家无需先切换 XY/XZ/YZ 工作面。 */
export function resolveScreenAxis(camera,rect,event,origin,lockedAxis=null) {
  if(!camera||!rect?.width||!rect?.height)return null;
  camera.updateMatrixWorld(true);
  const project=point=>{
    const p=point.clone().project(camera);
    return new THREE.Vector2(rect.left+(p.x+1)*rect.width/2,rect.top+(1-p.y)*rect.height/2);
  };
  const screenOrigin=project(origin);
  const cursor=new THREE.Vector2(event.clientX,event.clientY).sub(screenOrigin);
  const pointer=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
  const raycaster=new THREE.Raycaster();
  raycaster.setFromCamera(pointer,camera);
  const ray=raycaster.ray;
  const offset=ray.origin.clone().sub(origin);
  let best=null;
  for(const axis of lockedAxis?[lockedAxis.toLowerCase()]:['x','y','z']) {
    const direction=new THREE.Vector3();direction[axis]=1;
    const screenDirection=project(origin.clone().addScaledVector(direction,100)).sub(screenOrigin);
    // 正视时朝向镜头的轴没有可辨认投影，不放大为不稳定的超长型材。
    if(screenDirection.lengthSq()<.25)continue;
    screenDirection.normalize();
    const c=ray.direction.dot(direction),denominator=1-c*c;
    if(denominator<1e-6)continue;
    const distance=(offset.dot(direction)-c*offset.dot(ray.direction))/denominator;
    if(c*distance-offset.dot(ray.direction)<0)continue;
    const score=Math.abs(cursor.x*screenDirection.y-cursor.y*screenDirection.x);
    if(!best||score<best.score)best={axis:axis.toUpperCase(),point:origin.clone().addScaledVector(direction,distance),score};
  }
  return best;
}

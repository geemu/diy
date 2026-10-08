import * as THREE from 'three';

/**
 * 无限远展示地面。屏幕像素射线与世界 XZ 面求交，不依赖有限网格/相机远裁剪面的尺寸。
 * 网格坐标固定在世界原点，缩放只调整展示细分；不参与拾取、吸附、深度遮挡或工程保存。
 */
export default class InfiniteGround {
  constructor() {
    this.material=new THREE.ShaderMaterial({
      depthTest:false,depthWrite:false,toneMapped:false,
      extensions:{derivatives:true},
      uniforms:{
        inverseProjection:{value:new THREE.Matrix4()},cameraWorld:{value:new THREE.Matrix4()},
        groundHeight:{value:-.05},fadeDistance:{value:16000},showGrid:{value:1},
        groundColor:{value:new THREE.Color(0xa5bfd5)},skyColor:{value:new THREE.Color(0xe0f2fe)},
        lineColor:{value:new THREE.Color(0x7b91a7)},
        xAxisColor:{value:new THREE.Color(0xe74c4c)},zAxisColor:{value:new THREE.Color(0x229e63)},
        positiveXPositiveZ:{value:new THREE.Color(0x587fb5)},
        negativeXPositiveZ:{value:new THREE.Color(0x8e6da8)},
        negativeXNegativeZ:{value:new THREE.Color(0xa17d54)},
        positiveXNegativeZ:{value:new THREE.Color(0x438c92)}
      },
      vertexShader:`
        varying vec2 screenPoint;
        void main(){screenPoint=position.xy;gl_Position=vec4(position.xy,0.0,1.0);}
      `,
      fragmentShader:`
        varying vec2 screenPoint;
        uniform mat4 inverseProjection,cameraWorld;
        uniform float groundHeight,fadeDistance,showGrid;
        uniform vec3 groundColor,skyColor,lineColor;
        uniform vec3 xAxisColor,zAxisColor;
        uniform vec3 positiveXPositiveZ,negativeXPositiveZ,negativeXNegativeZ,positiveXNegativeZ;
        float gridLine(vec2 world,float cell){
          vec2 q=world/cell;
          vec2 width=max(fwidth(q),vec2(0.00001));
          vec2 edge=abs(fract(q-0.5)-0.5)/width;
          // 像素中心保留实线，边缘再抗锯齿，避免整根线被三角形覆盖率冲淡。
          return 1.0-smoothstep(0.12,0.95,min(edge.x,edge.y));
        }
        void main(){
          vec4 nearView=inverseProjection*vec4(screenPoint,-1.0,1.0);
          vec4 farView=inverseProjection*vec4(screenPoint,1.0,1.0);
          vec3 origin=(cameraWorld*vec4(nearView.xyz/nearView.w,1.0)).xyz;
          vec3 farPoint=(cameraWorld*vec4(farView.xyz/farView.w,1.0)).xyz;
          vec3 ray=normalize(farPoint-origin);
          if(abs(ray.y)<0.000001)discard;
          float travel=(groundHeight-origin.y)/ray.y;
          if(travel<=0.0)discard;
          vec3 hit=origin+ray*travel;
          // 远近过渡按相机高度/正交跨度调整，不出现固定米数处的硬截止。
          float fade=exp(-max(0.0,travel-fadeDistance*0.2)/fadeDistance);
          vec3 color=mix(skyColor,groundColor,fade);
          // 像素覆盖过多细格时平滑转向大格，避免拉远后密线闪烁或变成一片灰。
          float footprint=max(length(dFdx(hit.xz)),length(dFdy(hit.xz)));
          float level=max(0.0,log(max(200.0,footprint*8.0)/200.0)/log(10.0));
          float cell=200.0*pow(10.0,floor(level));
          float fine=gridLine(hit.xz,cell)*(1.0-fract(level));
          float coarse=gridLine(hit.xz,cell*10.0);
          // 线条比地面颜色晚一些淡出，保持中远景格子可辨，地平线仍连续融合。
          float densityFade=1.0-smoothstep(5.0,24.0,footprint);
          float lines=max(fine*0.42*densityFade,coarse*0.52)*pow(fade,0.75)*showGrid;
          // 按世界 X/Z 正负区分四象限，仅染线条；转动或平移相机不能改变象限归属。
          vec3 quadrantInk=hit.z>=0.0
            ?(hit.x>=0.0?positiveXPositiveZ:negativeXPositiveZ)
            :(hit.x>=0.0?positiveXNegativeZ:negativeXNegativeZ);
          // X 轴是 Z=0 的红线，Z 轴是 X=0 的绿线；正负半轴同色，固定在世界原点。
          vec2 axisWidth=max(fwidth(hit.xz),vec2(0.00001));
          vec2 axisDistance=abs(hit.xz)/axisWidth;
          vec2 axisCoverage=vec2(1.0)-smoothstep(vec2(0.35),vec2(1.35),axisDistance);
          color=mix(color,quadrantInk,lines);
          // 轴线独立于网格细分层级，不因粗细格交替消失；网格开关仍统一控制。
          float axisFade=pow(fade,0.75)*showGrid;
          color=mix(color,zAxisColor,axisCoverage.x*axisFade);
          color=mix(color,xAxisColor,axisCoverage.y*axisFade);
          gl_FragColor=vec4(color,1.0);
          #include <colorspace_fragment>
        }
      `
    });
    this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);
    this.mesh.name='__presentation_ground__';this.mesh.frustumCulled=false;this.mesh.renderOrder=-1000;
  }

  /** 相机世界矩阵支持透视与正交投影；展示网格开关不隐藏地面。 */
  update(camera,gridVisible=true) {
    const uniforms=this.material.uniforms;
    uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
    uniforms.cameraWorld.value.copy(camera.matrixWorld);
    const height=Math.abs(camera.matrixWorld.elements[13]-uniforms.groundHeight.value);
    const span=camera.isOrthographicCamera?Math.abs(camera.top-camera.bottom)/camera.zoom:0;
    uniforms.fadeDistance.value=Math.max(6000,height*32,span*8);
    uniforms.showGrid.value=gridVisible?1:0;
  }

  dispose(){this.mesh.geometry.dispose();this.material.dispose();}
}

import * as THREE from 'three';

/**
 * CAD 工作平面可视化。
 *
 * 工作平面只是交互提示：它不改变模型坐标系，也不会写入 Project JSON。
 * ProfileDrawTool 仍负责真正的 XY/XZ/YZ 平面求交；本类只确保用户看得见当前绘制平面。
 */
export default class WorkPlaneVisualizer {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.plane = 'XZ';
    this.visible = true;
    this.size = 3600;
    this.divisions = 72;
    this.grid = null;
    this.rebuild();
  }

  setPlane(plane) {
    const next = ['XY','XZ','YZ'].includes(plane) ? plane : 'XZ';
    if (next === this.plane) return;
    this.plane = next;
    this.rebuild();
  }

  setVisible(visible) {
    this.visible = visible !== false;
    if (this.grid) this.grid.visible = this.visible;
  }

  rebuild() {
    if (this.grid) {
      this.sceneManager.scene.remove(this.grid);
      this.grid.geometry?.dispose?.();
      this.grid.material?.dispose?.();
    }
    const grid = new THREE.GridHelper(this.size, this.divisions, 0x7ea6ff, 0xbfd0ef);
    grid.name = '__work_plane__';
    grid.material.transparent = true;
    grid.material.opacity = 0.22;
    grid.material.depthWrite = false;
    grid.renderOrder = -5;
    if (this.plane === 'XY') grid.rotation.x = Math.PI / 2;
    else if (this.plane === 'YZ') grid.rotation.z = Math.PI / 2;
    grid.visible = this.visible;
    this.grid = grid;
    this.sceneManager.scene.add(grid);
  }
}

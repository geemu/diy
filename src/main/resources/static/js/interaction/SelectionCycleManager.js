/**
 * 穿透/循环选择状态管理器。
 *
 * Alt + 单击时由 Editor 提供当前射线下的候选构件。短时间内在同一屏幕位置继续 Alt + 单击，
 * 会在候选列表中循环，而不是永远只能选中最前面的 Mesh。
 */
export default class SelectionCycleManager {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = null;
    this.y = null;
    this.timestamp = 0;
    this.index = -1;
    this.candidateIds = [];
  }

  next(event, candidates = []) {
    if (!candidates.length) {
      this.reset();
      return null;
    }
    const now = performance.now();
    const ids = candidates.map(mesh => mesh.userData?.part?.id || mesh.uuid);
    const samePoint = this.x !== null && Math.hypot(event.clientX - this.x, event.clientY - this.y) <= 10;
    const sameCandidates = ids.length === this.candidateIds.length && ids.every((id,index) => id === this.candidateIds[index]);
    const withinWindow = now - this.timestamp <= 1800;
    this.index = samePoint && sameCandidates && withinWindow ? (this.index + 1) % candidates.length : 0;
    this.x = event.clientX;
    this.y = event.clientY;
    this.timestamp = now;
    this.candidateIds = ids;
    return {mesh:candidates[this.index], index:this.index, count:candidates.length};
  }
}

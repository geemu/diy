import {isLinearProfile} from '../model/ProfilePath.js';
import {resolveProfileFeature} from '../model/ProfileFeatureCatalog.js';

/** Explicit CAD feature picking for profile ends, side faces and slot centerlines. */
export default class FeatureSelectionManager {
  constructor(editor) {
    this.editor = editor;
    this.enabled = false;
    this.features = [];
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (!this.enabled) this.clear();
    return this.enabled;
  }

  clear() {
    this.features = [];
    this.editor.sceneManager.hideSnapPoint?.();
    this.editor.onFeatureSelectionChanged?.([]);
  }

  pick(event) {
    const hit = this.editor.sceneManager.pickHit(event,this.editor.selectableMeshes());
    const mesh = hit?.object;
    const part = mesh?.userData?.part;
    if (!mesh || part?.type !== 'PROFILE' || !isLinearProfile(part)) return null;
    const feature = this.resolveFeature(mesh,hit.point);
    if (!feature) return null;
    if (this.features.length >= 2) this.features = [];
    this.features.push(feature);
    this.editor.sceneManager.showSnapPoint(feature.worldPoint);
    this.editor.onFeatureSelectionChanged?.(this.export());
    return feature;
  }

  resolveFeature(mesh,worldPoint) {
    return resolveProfileFeature(mesh,worldPoint);
  }

  export() {
    return this.features.map(item => ({...item,worldPoint:{x:item.worldPoint.x,y:item.worldPoint.y,z:item.worldPoint.z}}));
  }
}

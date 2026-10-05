import {
  isEndMachiningFeature,
  machiningFeatureLabel,
} from './MachiningFeatureCatalog.js';

/**
 * 将离散的加工特征整理为导出/展示使用的加工单元。
 *
 * 一个加工单元可能包含一个主加工特征以及若干附属加工特征，
 * 例如通孔 + 沉头、通孔 + 沉孔等组合。
 */
export default class MachiningUnitBuilder {
  static build(items = []) {
    const linked = new Set(
      items
        .filter((item) => item.linkedHoleId)
        .map((item) => item.id),
    );
    const units = [];

    for (const item of items) {
      if (linked.has(item.id)) {
        continue;
      }

      if (isEndMachiningFeature(item)) {
        units.push({
          type: 'END_FEATURE_UNIT',
          id: item.featureGroupId || item.id,
          end: item.end,
          offsetX: Number(item.offsetX || 0),
          offsetY: Number(item.offsetY || 0),
          primary: structuredClone(item),
          secondary: [],
        });
        continue;
      }

      if (['SLOT', 'OBROUND_SLOT'].includes(item.type)) {
        units.push({
          type: 'SLOT_UNIT',
          id: item.id,
          face: item.face,
          distanceFromStart: this.#distanceFromStart(item),
          offset: Number(item.offset || 0),
          length: Number(item.length || 0),
          width: Number(item.width || 0),
          orientation: item.orientation || 'ALONG_PROFILE',
          primary: structuredClone(item),
          secondary: [],
        });
        continue;
      }

      if (item.type === 'MILLING_REGION') {
        units.push({
          type: 'MILLING_UNIT',
          id: item.id,
          face: item.face,
          distanceFromStart: this.#distanceFromStart(item),
          offset: Number(item.offset || 0),
          length: Number(item.length || 0),
          width: Number(item.width || 0),
          orientation: item.orientation || 'ALONG_PROFILE',
          primary: structuredClone(item),
          secondary: [],
        });
        continue;
      }

      if (['THROUGH_HOLE', 'BLIND_HOLE', 'TAPPED_HOLE', 'COUNTERSINK', 'COUNTERBORE'].includes(item.type)) {
        if ((item.type === 'COUNTERSINK' || item.type === 'COUNTERBORE') && item.linkedHoleId) {
          continue;
        }

        const secondary = items.filter((candidate) => {
          if (candidate.linkedHoleId === item.id) {
            return true;
          }
          return candidate.featureGroupId
            && candidate.featureGroupId === item.featureGroupId
            && candidate.id !== item.id;
        });

        units.push({
          type: 'HOLE_UNIT',
          id: item.featureGroupId || item.id,
          face: item.face,
          distanceFromStart: this.#distanceFromStart(item),
          offset: Number(item.offset || 0),
          primary: structuredClone(item),
          secondary: structuredClone(secondary),
        });
      }
    }

    return units;
  }

  static label(unit) {
    const labels = [
      this.#featureLabel(unit.primary),
      ...(unit.secondary || []).map((item) => this.#featureLabel(item)),
    ];
    return labels.join(' / ');
  }

  static #distanceFromStart(item) {
    return Number(item.stationS ?? item.distanceFromStart ?? 0);
  }

  static #featureLabel(item) {
    if (item.type === 'THROUGH_HOLE') {
      return `Ø${item.diameter} 通孔`;
    }
    if (item.type === 'COUNTERSINK') {
      return `沉头 Ø${item.majorDiameter ?? item.diameter}${item.angleDeg ? ` / ${item.angleDeg}°` : ''}`;
    }
    if (item.type === 'COUNTERBORE') {
      return `沉孔 Ø${item.diameter}×${item.depth}`;
    }
    if (item.type === 'BLIND_HOLE') {
      return `Ø${item.diameter} 盲孔 深${item.depth}`;
    }
    if (item.type === 'TAPPED_HOLE') {
      return `${item.tappingSize} 攻丝 深${item.depth}`;
    }
    if (item.type === 'END_TAP') {
      return `${item.tappingSize} 端攻丝 深${item.depth}`;
    }
    if (item.type === 'SLOT' || item.type === 'OBROUND_SLOT') {
      return `${machiningFeatureLabel(item)} ${item.length}×${item.width}`;
    }
    if (item.type === 'MILLING_REGION') {
      return `铣削 ${item.length}×${item.width} 深${item.depth}`;
    }
    if (item.type === 'END_HOLE') {
      return `端面 Ø${item.diameter} 孔 深${item.depth}`;
    }
    if (item.type === 'END_COUNTERBORE') {
      return `端面沉孔 Ø${item.diameter}×${item.depth}`;
    }
    if (item.type === 'END_COUNTERSINK') {
      return `端面沉头 Ø${item.majorDiameter} / ${item.angleDeg}°`;
    }
    return machiningFeatureLabel(item);
  }
}

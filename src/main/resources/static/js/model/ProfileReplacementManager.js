import {getDesignProfileDefinition} from './DesignProfileCatalog.js';

/**
 * Replace one or more profile catalog definitions while keeping their centerline,
 * length, assembly membership and IDs stable. Connections are re-evaluated after
 * the section changes. Manufacturing mappings are cleared because the new section may require different real hardware.
 */
export default class ProfileReplacementManager {
  constructor(editor) {
    this.editor = editor;
  }

  resolveTargetIds(options = {}) {
    if (Array.isArray(options.partIds) && options.partIds.length) return [...new Set(options.partIds)];
    const selected = this.editor.selected?.userData?.part;
    if (selected?.type !== 'PROFILE') throw new Error('请先选择要替换的型材');
    const scope = options.scope || 'SELECTED';
    if (scope === 'ASSEMBLY') {
      if (!selected.assemblyId) return [selected.id];
      return this.editor.parts.filter(part => part.type === 'PROFILE' && part.assemblyId === selected.assemblyId).map(part => part.id);
    }
    if (scope === 'SAME_MODEL') {
      const current = selected.designProfile?.profileId;
      return this.editor.parts.filter(part => part.type === 'PROFILE' && part.designProfile?.profileId === current).map(part => part.id);
    }
    const selectedMeshes = this.editor.selectedMeshes?.filter(mesh => mesh.userData?.part?.type === 'PROFILE') || [];
    return selectedMeshes.length ? selectedMeshes.map(mesh => mesh.userData.part.id) : [selected.id];
  }

  replace(catalogId, options = {}) {
    const definition = getDesignProfileDefinition(catalogId);
    if (!definition) throw new Error('未知替换型材：' + catalogId);
    const targetIds = this.resolveTargetIds(options);
    const parts = targetIds.map(id => this.editor.parts.find(part => part.id === id)).filter(part => part?.type === 'PROFILE');
    if (!parts.length) throw new Error('没有可替换的型材');
    const snapshots = new Map(parts.map(part => [part.id,structuredClone(part)]));
    const affectedConnections = this.editor.connectionManager.connections.filter(connection => targetIds.includes(connection.sourceProfileId) || targetIds.includes(connection.targetProfileId));
    const connectionSnapshots = new Map(affectedConnections.map(connection => [connection.id,structuredClone(connection)]));
    const previousCatalogs = [...new Set(parts.map(part => part.designProfile?.profileId).filter(Boolean))];
    const repaired = [];
    const invalid = [];

    try {
      for (const part of parts) {
        applyDefinition(part,definition,options);
        this.editor.rebuildPartMesh(part.id,{updateConnections:false});
      }
      for (const connection of affectedConnections) {
        connection.manufacturingRuleId=null;
        delete connection.manufacturingConfiguredAt;
        this.editor.connectionManager.rebuild(connection);
        if (connection.status === 'INVALID' && options.autoRepair !== false) {
          try {
            const switched = this.editor.connectionManager.switchToRecommendedDesignType(connection,{userOverride:connection.userOverridden === true});
            if (switched?.changed) repaired.push(connection.id);
          } catch (_) {
            // Keep the connection in INVALID state; design check can locate it.
          }
        }
        if (connection.status === 'INVALID') invalid.push(connection.id);
      }
      this.editor.accessoryMountManager.refreshForTargets(targetIds);
      this.editor.updateDimensions();
      this.editor.emitStats();
      this.editor.historyManager.capture();
      this.editor.emitProjectChanged();
      return {
        targetIds,
        count:parts.length,
        fromCatalogIds:previousCatalogs,
        toCatalogId:definition.id,
        repairedConnectionIds:repaired,
        invalidConnectionIds:invalid
      };
    } catch (error) {
      for (const [id,snapshot] of snapshots) {
        const current = this.editor.parts.find(part => part.id === id);
        if (!current) continue;
        for (const key of Object.keys(current)) delete current[key];
        Object.assign(current,structuredClone(snapshot));
        this.editor.rebuildPartMesh(id,{updateConnections:false});
      }
      for (const connection of affectedConnections) {
        const snapshot = connectionSnapshots.get(connection.id);
        if (!snapshot) continue;
        for (const key of Object.keys(connection)) delete connection[key];
        Object.assign(connection,structuredClone(snapshot));
        this.editor.connectionManager.rebuild(connection);
      }
      throw error;
    }
  }
}

function applyDefinition(part,definition,options) {
  const old = part.designProfile || {};
  part.name = options.keepName === true ? part.name : definition.name;
  part.dimensions = {...(part.dimensions || {}),size:Number(definition.sectionSize[0]),sectionSize:[...definition.sectionSize]};
  part.designProfile = {
    profileId:definition.id,
    nominal:definition.nominal,
    series:definition.series,
    slotWidth:Number(definition.slotWidth || 0),
    faceClosures:[...(options.faceClosures || old.faceClosures || definition.defaultFaceClosures || [])]
  };
  // 更换设计截面后真实制造料号必须重新选择，不能沿用旧规格。
  part.manufacturingProfile = null;
  part.profileReplacement = {
    replacedAt:new Date().toISOString(),
    fromProfileId:old.profileId || null,
    toProfileId:definition.id,
    centerlinePreserved:true
  };
}

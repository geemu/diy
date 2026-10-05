/**
 * Structural assembly diagnostics. This intentionally checks assembly semantics,
 * not mesh collision; collision/manufacturing validation stays in FactoryValidator.
 */
export default class AssemblyInspector {
  constructor(editor) {
    this.editor = editor;
  }

  inspect() {
    this.editor.assemblyManager.reconcile();
    const issues = [];
    const partIds = new Set((this.editor.parts || []).map(part => part.id));

    for (const connection of this.editor.connectionManager?.connections || []) {
      const refs = [connection.sourceProfileId, connection.targetProfileId].filter(Boolean);
      const missing = refs.filter(id => !partIds.has(id));
      if (missing.length) {
        issues.push(issue('ERROR', 'DANGLING_CONNECTION', '连接关系引用了不存在的构件', {
          subject:connection.id,
          partIds:refs,
          details:{missingPartIds:missing}
        }));
      }
    }

    for (const constraint of this.editor.constraintManager?.constraints || []) {
      if (constraint?.enabled === false || constraint?.suppressed === true) continue;
      const refs = [constraint.sourcePartId, constraint.targetPartId].filter(Boolean);
      const missing = refs.filter(id => !partIds.has(id));
      if (missing.length) {
        issues.push(issue('ERROR', 'DANGLING_CONSTRAINT', '约束引用了不存在的构件', {
          subject:constraint.id,
          partIds:refs,
          details:{missingPartIds:missing}
        }));
      }
    }

    for (const assembly of this.editor.assemblyManager.assemblies) {
      const ids = this.editor.assemblyManager.partIds(assembly.id, true);
      const childCount = this.editor.assemblyManager.children(assembly.id).length;
      if (!ids.length && childCount === 0) {
        issues.push(issue('WARNING', 'EMPTY_ASSEMBLY', `组件“${assembly.name}”没有构件`, {
          assemblyId:assembly.id,
          subject:assembly.name
        }));
        continue;
      }
      if (ids.length >= 2) {
        const connectivity = this.connectedComponents(ids);
        if (connectivity.length > 1) {
          const isolated = connectivity.filter(component => component.length === 1).flat();
          issues.push(issue('WARNING', 'DISCONNECTED_ASSEMBLY', `组件“${assembly.name}”存在未建立装配关系的构件`, {
            assemblyId:assembly.id,
            subject:assembly.name,
            partIds:isolated.length ? isolated : ids,
            details:{componentCount:connectivity.length, components:connectivity}
          }));
        }
      }
    }

    const errors = issues.filter(item => item.severity === 'ERROR').length;
    const warnings = issues.filter(item => item.severity === 'WARNING').length;
    return {
      ok:errors === 0,
      status:errors ? 'ERROR' : warnings ? 'WARNING' : 'OK',
      errors,
      warnings,
      issueCount:issues.length,
      issues
    };
  }

  connectedComponents(partIds) {
    const ids = [...new Set(partIds || [])];
    const idSet = new Set(ids);
    const edges = new Map(ids.map(id => [id, new Set()]));
    const connect = (a, b) => {
      if (!idSet.has(a) || !idSet.has(b) || a === b) return;
      edges.get(a).add(b);
      edges.get(b).add(a);
    };

    for (const connection of this.editor.connectionManager?.connections || []) {
      if (connection?.status === 'INVALID') continue;
      connect(connection.sourceProfileId, connection.targetProfileId);
    }
    for (const constraint of this.editor.constraintManager?.constraints || []) {
      if (constraint?.enabled === false || constraint?.suppressed === true) continue;
      connect(constraint.sourcePartId, constraint.targetPartId);
    }

    const out = [];
    const remaining = new Set(ids);
    while (remaining.size) {
      const start = remaining.values().next().value;
      const component = [];
      const queue = [start];
      remaining.delete(start);
      while (queue.length) {
        const current = queue.shift();
        component.push(current);
        for (const next of edges.get(current) || []) {
          if (!remaining.has(next)) continue;
          remaining.delete(next);
          queue.push(next);
        }
      }
      out.push(component);
    }
    return out;
  }
}

function issue(severity, code, message, extra = {}) {
  return {severity, code, message, ...extra};
}

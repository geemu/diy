# Assembly System — v0.31

## 1. Purpose

Assembly System is the persistent hierarchy and interaction layer between raw Parts and future connector/manufacturing features.

It must support:
- assembly → subassembly → part hierarchy;
- whole-component transform;
- inherited lock / recursive visibility;
- isolation;
- installation order;
- exploded presentation;
- explicit relation diagnostics.

It must **not** turn presentation state into manufacturing geometry.

## 2. Persistent model

Part retains one `assemblyId` for backward compatibility.

Assembly:

```json
{
  "id": "A-001",
  "name": "Bottom frame",
  "parentId": null,
  "hidden": false,
  "locked": false,
  "installationStep": 1,
  "installationNote": "Install bottom frame first",
  "explodeDirection": null
}
```

Hierarchy is a tree, not a DAG. `AssemblyManager.setParent()` rejects cycles.

## 3. Ownership

`AssemblyManager` owns persistent hierarchy mutation.

UI code must not directly do:

```js
editor.assemblyManager.assemblies.push(...)
```

Use:
- `create()`
- `createParent()`
- `setParent()`
- `dissolve()`
- `moveInstallationStep()`
- `setHidden()`
- `setLocked()`

Editor exposes higher-level APIs that also capture history and emit project changes.

## 4. Whole-assembly transform

An assembly selection resolves to all deep Part meshes through:

```text
AssemblyManager.partIds(assemblyId, true)
    -> Editor.selectAssembly()
    -> selectedMeshes[]
```

Existing multi-selection transform code applies the primary mesh delta to the other selected meshes. This gives a rigid whole-component translate/rotate interaction without introducing a second transform representation.

Important:
- persistent transforms still live on Parts;
- no persistent transform matrix is stored on Assembly yet;
- future assembly-local coordinate systems may be added, but must migrate old projects explicitly.

## 5. Lock semantics

A Part is effectively locked when:

```text
part.locked
OR
its assembly locked
OR
any ancestor assembly locked
```

Use `AssemblyManager.isPartEffectivelyLocked()` through `Editor.isMeshTransformable()`.

Do not attach TransformControls using only `part.locked`.

Unlocking a child Part must not bypass an inherited parent lock. Unlock the Assembly node instead.

## 6. Visibility and isolation

Persistent visibility uses:
- Assembly `hidden`
- Part `hidden`
- Mesh `visible`

Parent visibility operations recursively affect descendants and members.

`showAll()` clears both Assembly hidden state and Part hidden state.

Isolation is currently persisted by toggling Part/Assembly hidden flags. This is acceptable for v0.31. If a later version adds temporary view-state isolation, keep it separate from Project JSON.

## 7. Installation order

`installationStep` is only meaningful among siblings with the same `parentId`.

`AssemblyManager.normalizeSiblingSteps()` guarantees contiguous values:

```text
1, 2, 3, ...
```

Moving an Assembly earlier/later only reorders siblings.

Current granularity: Assembly.

Future possibilities:
- Part-level step;
- Connector/fastener-level step;
- animated assembly instructions;
- generated step snapshots.

Do not overload `installationStep` to mean drawing/BOM sort order globally.

## 8. Exploded view

### Rule
Exploded view is presentation-only.

Wrong design:

```text
part.position += explosionOffset
save project
```

Correct v0.31 design:
1. keep originals unchanged;
2. temporarily hide visible originals;
3. clone meshes;
4. offset clones;
5. render clones in presentation group;
6. delete clones on collapse;
7. restore original visibility.

Implementation: `AssemblyPresentationManager`.

The presentation group is not part of `editor.meshes`, so normal selection/picking does not mutate clones.

TransformControls are detached while exploded.

### Unit selection
For whole-project explosion:
- top-level assemblies are explosion units;
- ungrouped Parts become individual units.

For selected assembly:
- direct child assemblies become units;
- direct Parts may become a unit;
- when only one aggregate unit exists, deep Parts are expanded individually so the user still gets a useful explosion.

### Direction
Priority:
1. explicit `assembly.explodeDirection`;
2. vector from overall center to unit center;
3. deterministic radial fallback when centers coincide.

## 9. Assembly diagnostics

Implementation: `AssemblyInspector`.

It intentionally uses **explicit business relations**, not geometry contact.

Graph edges:
- valid `Connection` source ↔ target;
- enabled, unsuppressed `Constraint` source ↔ target.

Checks:
- `DANGLING_CONNECTION` — referenced Part missing;
- `DANGLING_CONSTRAINT` — referenced Part missing;
- `EMPTY_ASSEMBLY` — leaf assembly has no members;
- `DISCONNECTED_ASSEMBLY` — deep member graph has more than one connected component.

A Part visually touching another Part but without Connection/Constraint is still considered unconnected. This is deliberate because future factory output needs explicit semantics.

## 10. Schema 31

v30 → v31 adds/defaults:

```text
Assembly.installationStep
Assembly.installationNote
Assembly.explodeDirection
editorState.assemblySystemVersion = 2
editorState.assemblyExplodedViewVersion = 1
editorState.assemblyDiagnosticsVersion = 1
```

Migration must remain one-way, deterministic and backward compatible.

## 11. v0.32 extension points

Connector work should extend this system rather than bypass it.

Recommended relation chain:

```text
Profile Feature / Slot
        ↓
Connection Rule
        ↓
Connector / Hardware instances
        ↓
Machining Features
        ↓
Assembly relation graph
        ↓
BOM + Validation
```

AssemblyInspector should later check:
- missing connector for required relation;
- connector SKU incompatible with profile series;
- T-nut assigned to nonexistent slot;
- bracket orientation invalid;
- required machining missing;
- dangling generated hardware.

## 12. Tests

Primary regression:

```text
tools/verify-v031-features.mjs
```

Also run every historical verify script because AssemblyManager existed in earlier versions and is shared by load/save/UI behavior.

# Constraint Solver 2.0 — v0.29

## 目标

多个约束同时存在时，保留它们共同允许的自由度，不再用“最后一条约束的允许轴”覆盖前面约束。

## DOF 表达

刚体瞬时自由度拆成：
- translation basis <= 3
- rotation axes <= 3

每条约束贡献 blocked directions，最终通过 3D null-space 得到允许子空间。

### 运动副

| 类型 | 平移 | 旋转 |
|---|---:|---:|
| SLIDER | 1 | 0 |
| REVOLUTE | 0 | 1 |
| CYLINDRICAL | 1 | 1 |
| COAXIAL | 1 | 1 |
| COPLANAR | 2 | 1 |

## Distance

v29 区分：
- FACE_TO_FACE：保持面间法向距离，同时保持面法向平行。
- END_TO_FACE：端部相对目标面保持指定偏置。
- POINT_TO_POINT：两个选中特征点保持指定欧氏距离。

## Angle

ANGLE 保存 `angleDeg`。一般角度是一个标量角约束；0/180°处存在退化，因此 mobility 以 PARALLEL 的两角约束处理。

## Slider reference orientation

SLIDER 不允许相对旋转，所以建立约束时记录 `referenceRelativeQuaternion`。目标构件旋转时，滑块会跟随该参考姿态，同时轴向位移仍是自由的。

## 冲突

收敛阈值当前：
- position <= 0.05 mm
- angle <= 0.05 degree

未收敛：
1. 高 residual 种子约束。
2. 扩展到关联约束子图。
3. <=8 条时执行 deletion-based irreducible set probe。
4. 给出 suppress recommendation，不自动执行。

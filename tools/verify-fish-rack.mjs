import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const samplePath = path.join(root, 'src/main/resources/static/samples/型材架子_610x670_H2050.json');
const project = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
const profiles = (project.parts || []).filter(part => part.type === 'PROFILE');

if (!profiles.length) throw new Error('黄金样例中没有 PROFILE');

const bounds = {
  minX: Infinity,
  minY: Infinity,
  minZ: Infinity,
  maxX: -Infinity,
  maxY: -Infinity,
  maxZ: -Infinity
};

for (const part of profiles) {
  const [width, height] = part.dimensions.sectionSize;
  const length = Number(part.dimensions.length);
  const hx = Number(width) / 2;
  const hy = Number(height) / 2;
  const hz = length / 2;
  const rotation = part.rotation || {x:0,y:0,z:0};
  const position = part.position || {x:0,y:0,z:0};
  const matrix = rotationMatrixXYZ(Number(rotation.x || 0), Number(rotation.y || 0), Number(rotation.z || 0));
  const ex = Math.abs(matrix[0][0]) * hx + Math.abs(matrix[0][1]) * hy + Math.abs(matrix[0][2]) * hz;
  const ey = Math.abs(matrix[1][0]) * hx + Math.abs(matrix[1][1]) * hy + Math.abs(matrix[1][2]) * hz;
  const ez = Math.abs(matrix[2][0]) * hx + Math.abs(matrix[2][1]) * hy + Math.abs(matrix[2][2]) * hz;

  bounds.minX = Math.min(bounds.minX, Number(position.x || 0) - ex);
  bounds.maxX = Math.max(bounds.maxX, Number(position.x || 0) + ex);
  bounds.minY = Math.min(bounds.minY, Number(position.y || 0) - ey);
  bounds.maxY = Math.max(bounds.maxY, Number(position.y || 0) + ey);
  bounds.minZ = Math.min(bounds.minZ, Number(position.z || 0) - ez);
  bounds.maxZ = Math.max(bounds.maxZ, Number(position.z || 0) + ez);
}

const result = {
  width: round(bounds.maxX - bounds.minX),
  depth: round(bounds.maxZ - bounds.minZ),
  height: round(bounds.maxY - bounds.minY),
  profileCount: profiles.length
};

const expected = {width:610, depth:670, height:2050};
for (const [key, value] of Object.entries(expected)) {
  if (Math.abs(result[key] - value) > 0.001) {
    throw new Error(`黄金样例 ${key} 期望 ${value}，实际 ${result[key]}`);
  }
}

console.log(JSON.stringify({ok:true, expected, actual:result}, null, 2));

function rotationMatrixXYZ(x, y, z) {
  const a = Math.cos(x);
  const b = Math.sin(x);
  const c = Math.cos(y);
  const d = Math.sin(y);
  const e = Math.cos(z);
  const f = Math.sin(z);
  return [
    [c * e, -c * f, d],
    [b * d * e + a * f, a * e - b * d * f, -b * c],
    [b * f - a * d * e, b * e + a * d * f, a * c]
  ];
}

function round(value) {
  return Number(value.toFixed(6));
}

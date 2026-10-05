export default class DxfSectionParser {
  static parse(text) {
    if (!text || !String(text).trim()) throw new Error('DXF 文件为空');
    const pairs = this.readPairs(String(text));
    const unitInfo = this.readUnitInfo(pairs);
    const entities = this.readEntities(pairs);
    const contours = [];
    const looseLines = [];

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (entity.type === 'LWPOLYLINE') {
        const contour = this.fromLwPolyline(entity.pairs);
        if (contour) contours.push(contour);
      } else if (entity.type === 'POLYLINE') {
        const vertices = [];
        let closed = false;
        const flags = this.numberValue(entity.pairs, 70, 0);
        closed = (flags & 1) === 1;
        let j = i + 1;
        for (; j < entities.length; j++) {
          if (entities[j].type === 'VERTEX') {
            vertices.push({
              x: this.numberValue(entities[j].pairs, 10, 0),
              y: this.numberValue(entities[j].pairs, 20, 0),
              bulge: this.numberValue(entities[j].pairs, 42, 0)
            });
            continue;
          }
          if (entities[j].type === 'SEQEND') break;
          break;
        }
        if (closed && vertices.length >= 3) {
          contours.push(this.expandBulges(vertices, true));
          i = Math.max(i, j);
        }
      } else if (entity.type === 'CIRCLE') {
        const cx = this.numberValue(entity.pairs, 10, 0);
        const cy = this.numberValue(entity.pairs, 20, 0);
        const r = Math.abs(this.numberValue(entity.pairs, 40, 0));
        if (r > 0) contours.push(this.circle(cx, cy, r, 72));
      } else if (entity.type === 'LINE') {
        looseLines.push({
          a: {x:this.numberValue(entity.pairs,10,0),y:this.numberValue(entity.pairs,20,0)},
          b: {x:this.numberValue(entity.pairs,11,0),y:this.numberValue(entity.pairs,21,0)}
        });
      }
    }

    contours.push(...this.stitchLines(looseLines));
    const cleaned = contours.map(ring => this.cleanRing(ring)).filter(ring => ring.length >= 3 && Math.abs(this.area(ring)) > 1e-6);
    if (!cleaned.length) {
      const types = [...new Set(entities.map(entity => entity.type))].join(', ');
      throw new Error(`未识别到闭合截面轮廓。当前支持 LWPOLYLINE、POLYLINE/VERTEX、CIRCLE 和可闭合 LINE；文件实体：${types || '无'}`);
    }

    cleaned.sort((a,b) => Math.abs(this.area(b)) - Math.abs(this.area(a)));
    let outer = cleaned[0];
    const holes = [];
    const ignored = [];
    for (let i=1;i<cleaned.length;i++) {
      const ring = cleaned[i];
      const centroid = this.centroid(ring);
      if (this.pointInPolygon(centroid, outer)) holes.push(ring);
      else ignored.push(ring);
    }

    outer = this.ensureWinding(outer, false);
    const normalizedHoles = holes.map(ring => this.ensureWinding(ring, true));
    const centered = this.centerSection(outer, normalizedHoles);
    const scaled = this.scaleSection(centered,unitInfo.scaleToMm);
    const bounds = this.bounds(scaled.outer);

    return {
      outer: scaled.outer,
      holes: scaled.holes,
      bounds,
      entityTypes: [...new Set(entities.map(entity => entity.type))],
      contourCount: cleaned.length,
      ignoredContourCount: ignored.length,
      warning: ignored.length ? `检测到 ${ignored.length} 个不位于主外轮廓内的独立闭合轮廓，已忽略。` : '',
      unitCode: unitInfo.code,
      unitName: unitInfo.name,
      scaleToMm: unitInfo.scaleToMm
    };
  }


  static alignToDimensions(parsed, expectedWidth, expectedHeight) {
    if (!parsed?.outer?.length) return parsed;
    const ew = Number(expectedWidth);
    const eh = Number(expectedHeight);
    if (!Number.isFinite(ew) || !Number.isFinite(eh)) return parsed;
    const directError = Math.abs(parsed.bounds.width-ew) + Math.abs(parsed.bounds.height-eh);
    const swappedError = Math.abs(parsed.bounds.width-eh) + Math.abs(parsed.bounds.height-ew);
    if (swappedError + 1e-6 >= directError) return {...parsed,autoRotated:false};
    const rotateRing = ring => ring.map(point => ({x:-point.y,y:point.x}));
    const outer = this.ensureWinding(rotateRing(parsed.outer),false);
    const holes = parsed.holes.map(ring => this.ensureWinding(rotateRing(ring),true));
    return {...parsed,outer,holes,bounds:this.bounds(outer),autoRotated:true};
  }

  static readUnitInfo(pairs) {
    let code = 0;
    for (let i=0;i<pairs.length-1;i++) {
      if (pairs[i].code === 9 && pairs[i].value === '$INSUNITS') {
        for (let j=i+1;j<Math.min(i+6,pairs.length);j++) {
          if (pairs[j].code === 70) {
            code = Number(pairs[j].value) || 0;
            break;
          }
          if (pairs[j].code === 9 || pairs[j].code === 0) break;
        }
        break;
      }
    }
    const table = {
      0:{name:'未指定',scaleToMm:1},
      1:{name:'英寸',scaleToMm:25.4},
      2:{name:'英尺',scaleToMm:304.8},
      4:{name:'毫米',scaleToMm:1},
      5:{name:'厘米',scaleToMm:10},
      6:{name:'米',scaleToMm:1000},
      9:{name:'密耳',scaleToMm:0.0254},
      10:{name:'码',scaleToMm:914.4},
      13:{name:'微米',scaleToMm:0.001}
    };
    return {code,...(table[code] || {name:`单位代码${code}`,scaleToMm:1})};
  }

  static scaleSection(section, scale) {
    const factor = Number(scale || 1);
    if (Math.abs(factor-1) < 1e-12) return section;
    const scaleRing = ring => ring.map(point => ({x:point.x*factor,y:point.y*factor}));
    return {outer:scaleRing(section.outer),holes:section.holes.map(scaleRing)};
  }

  static readPairs(text) {
    const lines = text.replace(/\r/g,'').split('\n');
    const pairs = [];
    for (let i=0;i+1<lines.length;i+=2) {
      const code = Number.parseInt(lines[i].trim(),10);
      if (!Number.isFinite(code)) continue;
      pairs.push({code,value:lines[i+1].trim()});
    }
    return pairs;
  }

  static readEntities(pairs) {
    let inEntities = false;
    const result = [];
    let current = null;
    for (let i=0;i<pairs.length;i++) {
      const pair = pairs[i];
      if (pair.code === 0 && pair.value === 'SECTION') {
        const next = pairs[i+1];
        inEntities = !!next && next.code === 2 && next.value === 'ENTITIES';
        continue;
      }
      if (pair.code === 0 && pair.value === 'ENDSEC') {
        if (current && inEntities) result.push(current);
        current = null;
        inEntities = false;
        continue;
      }
      if (!inEntities) continue;
      if (pair.code === 0) {
        if (current) result.push(current);
        current = {type:pair.value,pairs:[]};
      } else if (current) {
        current.pairs.push(pair);
      }
    }
    if (current && inEntities) result.push(current);
    return result;
  }

  static fromLwPolyline(pairs) {
    const flags = this.numberValue(pairs,70,0);
    const closed = (flags & 1) === 1;
    if (!closed) return null;
    const vertices = [];
    let current = null;
    for (const pair of pairs) {
      if (pair.code === 10) {
        if (current) vertices.push(current);
        current = {x:Number(pair.value),y:0,bulge:0};
      } else if (pair.code === 20 && current) {
        current.y = Number(pair.value);
      } else if (pair.code === 42 && current) {
        current.bulge = Number(pair.value) || 0;
      }
    }
    if (current) vertices.push(current);
    if (vertices.length < 3) return null;
    return this.expandBulges(vertices,true);
  }

  static expandBulges(vertices, closed) {
    const result = [];
    const count = vertices.length;
    const segmentCount = closed ? count : count - 1;
    for (let i=0;i<segmentCount;i++) {
      const start = vertices[i];
      const end = vertices[(i+1)%count];
      if (!result.length) result.push({x:start.x,y:start.y});
      const bulge = Number(start.bulge || 0);
      if (Math.abs(bulge) < 1e-10) {
        result.push({x:end.x,y:end.y});
        continue;
      }
      const dx = end.x-start.x;
      const dy = end.y-start.y;
      const chord = Math.hypot(dx,dy);
      if (chord < 1e-9) continue;
      const theta = 4 * Math.atan(bulge);
      const midpoint = {x:(start.x+end.x)/2,y:(start.y+end.y)/2};
      const left = {x:-dy/chord,y:dx/chord};
      const offset = chord * (1-bulge*bulge) / (4*bulge);
      const center = {x:midpoint.x+left.x*offset,y:midpoint.y+left.y*offset};
      const startAngle = Math.atan2(start.y-center.y,start.x-center.x);
      const steps = Math.max(4,Math.ceil(Math.abs(theta)/(Math.PI/24)));
      const radius = Math.hypot(start.x-center.x,start.y-center.y);
      for (let s=1;s<=steps;s++) {
        const angle = startAngle + theta * (s/steps);
        result.push({x:center.x+Math.cos(angle)*radius,y:center.y+Math.sin(angle)*radius});
      }
    }
    return result;
  }

  static stitchLines(lines) {
    const remaining = lines.map(line => ({a:{...line.a},b:{...line.b}}));
    const contours = [];
    const tolerance = 1e-4;
    while (remaining.length) {
      const first = remaining.shift();
      const chain = [first.a,first.b];
      let changed = true;
      while (changed && remaining.length) {
        changed = false;
        const end = chain[chain.length-1];
        for (let i=0;i<remaining.length;i++) {
          const line = remaining[i];
          if (this.near(end,line.a,tolerance)) {
            chain.push(line.b);
            remaining.splice(i,1);
            changed = true;
            break;
          }
          if (this.near(end,line.b,tolerance)) {
            chain.push(line.a);
            remaining.splice(i,1);
            changed = true;
            break;
          }
        }
        if (chain.length >= 4 && this.near(chain[chain.length-1],chain[0],tolerance)) break;
      }
      if (chain.length >= 4 && this.near(chain[chain.length-1],chain[0],tolerance)) contours.push(chain);
    }
    return contours;
  }

  static centerSection(outer,holes) {
    const b = this.bounds(outer);
    const cx = (b.minX+b.maxX)/2;
    const cy = (b.minY+b.maxY)/2;
    const shift = ring => ring.map(point => ({x:point.x-cx,y:point.y-cy}));
    return {outer:shift(outer),holes:holes.map(shift)};
  }

  static cleanRing(ring) {
    const cleaned = [];
    for (const point of ring || []) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
      if (!cleaned.length || !DxfSectionParser.near(cleaned[cleaned.length-1],point,1e-7)) cleaned.push({x:Number(point.x),y:Number(point.y)});
    }
    if (cleaned.length > 1 && this.near(cleaned[0],cleaned[cleaned.length-1],1e-7)) cleaned.pop();
    return cleaned;
  }

  static ensureWinding(ring,clockwise) {
    const area = this.area(ring);
    const points = ring.map(point => ({...point}));
    if ((clockwise && area > 0) || (!clockwise && area < 0)) points.reverse();
    return points;
  }

  static numberValue(pairs,code,defaultValue) {
    const pair = pairs.find(item => item.code === code);
    const value = pair ? Number(pair.value) : defaultValue;
    return Number.isFinite(value) ? value : defaultValue;
  }

  static area(ring) {
    let total = 0;
    for (let i=0;i<ring.length;i++) {
      const a = ring[i];
      const b = ring[(i+1)%ring.length];
      total += a.x*b.y-b.x*a.y;
    }
    return total/2;
  }

  static centroid(ring) {
    let sx = 0;
    let sy = 0;
    for (const point of ring) {sx += point.x; sy += point.y;}
    return {x:sx/ring.length,y:sy/ring.length};
  }

  static pointInPolygon(point,ring) {
    let inside = false;
    for (let i=0,j=ring.length-1;i<ring.length;j=i++) {
      const a = ring[i];
      const b = ring[j];
      const intersects = ((a.y>point.y)!==(b.y>point.y)) && (point.x < (b.x-a.x)*(point.y-a.y)/((b.y-a.y)||1e-12)+a.x);
      if (intersects) inside = !inside;
    }
    return inside;
  }

  static bounds(ring) {
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for (const point of ring) {
      minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);
    }
    return {minX,maxX,minY,maxY,width:maxX-minX,height:maxY-minY};
  }

  static circle(cx,cy,radius,segments) {
    const points=[];
    for (let i=0;i<segments;i++) {
      const angle=i/segments*Math.PI*2;
      points.push({x:cx+Math.cos(angle)*radius,y:cy+Math.sin(angle)*radius});
    }
    return points;
  }

  static near(a,b,tolerance) {
    return Math.abs(a.x-b.x)<=tolerance && Math.abs(a.y-b.y)<=tolerance;
  }
}

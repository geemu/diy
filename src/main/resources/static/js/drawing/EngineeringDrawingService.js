import EngineeringDrawingModel from './EngineeringDrawingModel.js';
import EngineeringDrawingLayout from './EngineeringDrawingLayout.js';
import EngineeringDrawingSvgExporter from './EngineeringDrawingSvgExporter.js';
import EngineeringDrawingDxfExporter from './EngineeringDrawingDxfExporter.js';

export const ENGINEERING_DRAWING_SYSTEM_VERSION = 2;

export default class EngineeringDrawingService {
  constructor(editor){this.editor=editor;this.modelBuilder=new EngineeringDrawingModel(editor);this.svgExporter=new EngineeringDrawingSvgExporter();this.dxfExporter=new EngineeringDrawingDxfExporter();}

  build(options={}){
    const sideView=String(options.sideView||this.editor.drawingSettings?.sideView||'RIGHT').toUpperCase()==='LEFT'?'LEFT':'RIGHT';
    const model=this.modelBuilder.buildProject({
      projectName:options.projectName||this.editor.drawingSettings?.projectName,
      revision:options.revision||this.editor.drawingSettings?.revision,
      appVersion:options.appVersion,
      assemblyId:options.assemblyId||null,
      includeGenerated:options.includeGenerated!==false,
      views:['FRONT','TOP',sideView,'ISO']
    });
    const layout=EngineeringDrawingLayout.layout(model,{paper:options.paper||this.editor.drawingSettings?.paper||'A3',landscape:true});
    return{model,layout};
  }

  exportSvg(options={}){const{model,layout}=this.build(options);return this.svgExporter.export(model,layout,options);}

  exportDxf(options={}){const{model,layout}=this.build(options);return this.dxfExporter.export(model,layout,options);}

  buildSubassemblySheets(options={}){
    const result=[];
    for(const assembly of this.editor.assemblyManager?.assemblies||[]){
      const payload=this.build({...options,assemblyId:assembly.id,projectName:`${options.projectName||this.editor.drawingSettings?.projectName||'未命名工程'} · ${assembly.name||assembly.id}`});
      const sheetOptions={...options,projectName:`${options.projectName||this.editor.drawingSettings?.projectName||'未命名工程'} · ${assembly.name||assembly.id}`};
      result.push({assemblyId:assembly.id,name:assembly.name||assembly.id,...payload,svg:this.svgExporter.export(payload.model,payload.layout,sheetOptions),dxf:this.dxfExporter.export(payload.model,payload.layout,sheetOptions)});
    }
    return result;
  }

  downloadSvg(options={}){
    const svg=this.exportSvg(options);this.downloadText(svg,'image/svg+xml;charset=utf-8',options.fileName||'总装工程图.svg');return svg;
  }

  downloadDxf(options={}){
    const dxf=this.exportDxf(options);this.downloadText(dxf,'application/dxf;charset=utf-8',options.fileName||'总装工程图.dxf');return dxf;
  }

  downloadText(text,mime,fileName){
    const blob=new Blob([text],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=fileName;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
}

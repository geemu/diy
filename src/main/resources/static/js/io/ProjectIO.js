export default class ProjectIO {
  static async read(file){return JSON.parse(await file.text());}
  static download(project,name='aluminum-project.json'){const blob=new Blob([JSON.stringify(project,null,2)],{type:'application/json;charset=utf-8'});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;a.click();URL.revokeObjectURL(u);}
}

export default class CsvExporter {
  static esc(v){if(v==null)return '';const s=String(v);return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s;}
  static build(rows){return rows.map(r=>r.map(this.esc).join(',')).join('\r\n');}
}

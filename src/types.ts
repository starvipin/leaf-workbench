export type ProjectFile = {name:string; content:string};
export type Project = {id:string; name:string; files:ProjectFile[]; updatedAt:number; starred:boolean};
export type CompileResult = {success:boolean; pdfUrl?:string; log:string; errors:{message:string;line?:number;file?:string}[];durationMs:number};

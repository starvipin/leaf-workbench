export type ProjectFile = { name: string; content: string };
export type Project = {
  id: string;
  name: string;
  files: ProjectFile[];
  updatedAt: number;
  starred: boolean;
  sourceRevision: number;
};
export type PreviewResult = CompileResult & {
  requestId: number;
  sourceRevision: number;
  pdfSourceRevision?: number;
};
export type CompileResult = {
  success: boolean;
  pdfUrl?: string;
  log: string;
  errors: { message: string; line?: number; file?: string }[];
  durationMs: number;
};

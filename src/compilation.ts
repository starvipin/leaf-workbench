import type {
  CompileResult,
  PreviewResult,
  Project,
  ProjectFile,
} from "./types.ts";

export type CompileSnapshot = {
  requestId: number;
  projectId: string;
  sourceRevision: number;
  files: ProjectFile[];
  mainFile?: string;
};

type ProjectCompilation = {
  requestId: number;
  pendingRevision: number | null;
  result?: PreviewResult;
};

type Transport = (source: CompileSnapshot) => Promise<CompileResult>;

async function requestCompilation(
  source: CompileSnapshot,
): Promise<CompileResult> {
  const response = await fetch("/api/compile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files: source.files, mainFile: source.mainFile }),
  });
  const data = await response.json();
  if (!response.ok && !data.errors) {
    throw new Error(
      data.error || data.message || `Compiler returned ${response.status}`,
    );
  }
  return data;
}

/** Own request ordering and the source revision attached to each accepted PDF. */
export class CompilationCoordinator {
  #sequence = 0;
  #state: Record<string, ProjectCompilation> = {};
  #listeners = new Set<() => void>();
  #transport: Transport;

  constructor(transport: Transport = requestCompilation) {
    this.#transport = transport;
  }

  getSnapshot = () => this.#state;

  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  #publish(projectId: string, value: ProjectCompilation) {
    this.#state = { ...this.#state, [projectId]: value };
    for (const listener of this.#listeners) listener();
  }

  async compile(project: Project) {
    const previous = this.#state[project.id];
    if (previous?.pendingRevision === project.sourceRevision) return null;

    // Copy the source before awaiting anything: edits cannot relabel an in-flight build.
    const source: CompileSnapshot = {
      requestId: ++this.#sequence,
      projectId: project.id,
      sourceRevision: project.sourceRevision,
      files: project.files.map((file) => ({ ...file })),
      mainFile: project.files.some((file) => file.name === "main.tex")
        ? "main.tex"
        : project.files.find((file) => file.name.endsWith(".tex"))?.name,
    };
    this.#publish(project.id, {
      requestId: source.requestId,
      pendingRevision: source.sourceRevision,
      result: previous?.result,
    });

    let result: CompileResult;
    try {
      result = await this.#transport(source);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Cannot reach compiler.";
      result = {
        success: false,
        log: message,
        errors: [{ message }],
        durationMs: 0,
      };
    }

    const current = this.#state[project.id];
    // Superseded successes AND failures must not replace a newer result or clear its busy state.
    if (current.requestId !== source.requestId) return null;

    const hasNewPdf = result.success && !!result.pdfUrl;
    const accepted: PreviewResult = {
      ...result,
      requestId: source.requestId,
      sourceRevision: source.sourceRevision,
      pdfUrl: hasNewPdf ? result.pdfUrl : current.result?.pdfUrl,
      pdfSourceRevision: hasNewPdf
        ? source.sourceRevision
        : current.result?.pdfSourceRevision,
    };
    this.#publish(project.id, {
      requestId: source.requestId,
      pendingRevision: null,
      result: accepted,
    });
    return accepted;
  }
}

/** Metadata edits retain a revision; source edits and restores advance it. */
export function reviseProject(current: Project, next: Project): Project {
  const changed =
    current.files.length !== next.files.length ||
    current.files.some(
      (file, index) =>
        file.name !== next.files[index]?.name ||
        file.content !== next.files[index]?.content,
    );
  return {
    ...next,
    sourceRevision: current.sourceRevision + (changed ? 1 : 0),
  };
}

export function savedSourceRevision(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1
    ? value
    : 1;
}

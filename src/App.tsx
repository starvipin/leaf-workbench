import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useSyncExternalStore,
} from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  Leaf,
  ChevronDown,
  ChevronRight,
  Plus,
  FileText,
  Search,
  Settings,
  CircleHelp,
  Files,
  PanelLeftClose,
  PanelLeftOpen,
  Check,
  Cloud,
  Download,
  ArrowLeft,
  Star,
  MoreHorizontal,
  LayoutGrid,
  List,
  X,
  Trash2,
  Copy,
  Clock3,
  FolderOpen,
  Upload,
  FilePlus2,
  CheckCircle2,
  AlertCircle,
  Braces,
  BookOpen,
  WrapText,
  ExternalLink,
  Keyboard,
  ArrowUpRight,
  GripVertical,
  Save,
  LayoutPanelLeft,
} from "lucide-react";
import LatexEditor from "./components/LatexEditor";
import PdfPreview from "./components/PdfPreview";
import { createProject, initialProjects, outlineFrom } from "./templates";
import type { Project } from "./types";
import {
  CompilationCoordinator,
  reviseProject,
  savedSourceRevision,
} from "./compilation";

const STORE = "leaf-workspace-v1";
type Modal = "new" | "settings" | "help" | "history" | "rename" | null;
type Checkpoint = { id: string; name: string; at: number; project: Project };
function readProjects(): Project[] {
  try {
    const p = JSON.parse(localStorage.getItem(STORE) || "null");
    if (
      Array.isArray(p) &&
      p.length &&
      p.every(
        (x) =>
          typeof x.id === "string" &&
          typeof x.name === "string" &&
          Array.isArray(x.files) &&
          x.files.length > 0 &&
          x.files.every(
            (f: unknown) =>
              !!f &&
              typeof f === "object" &&
              "name" in f &&
              "content" in f &&
              typeof f.name === "string" &&
              typeof f.content === "string",
          ),
      )
    )
      return p.map((project: Project) => ({
        ...project,
        sourceRevision: savedSourceRevision(project.sourceRevision),
      }));
  } catch {}
  return initialProjects();
}
function download(name: string, content: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function IconButton({
  label,
  children,
  onClick,
  active = false,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      className={`icon-button ${active ? "active" : ""}`}
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>(readProjects);
  const [activeId, setActiveId] = useState(() => {
    const saved = localStorage.getItem("leaf-active");
    return saved || "";
  });
  const [dashboard, setDashboard] = useState(false);
  const project = projects.find((p) => p.id === activeId) || projects[0];
  const [activeFile, setActiveFile] = useState("main.tex");
  const file =
    project.files.find((f) => f.name === activeFile) || project.files[0];
  const [modal, setModal] = useState<Modal>(null),
    [nameInput, setNameInput] = useState(""),
    [template, setTemplate] = useState("blank");
  const [sidebar, setSidebar] = useState(() => window.innerWidth > 800),
    [sideTab, setSideTab] = useState<"files" | "search">("files");
  const [query, setQuery] = useState(""),
    [dashQuery, setDashQuery] = useState(""),
    [starredOnly, setStarredOnly] = useState(false);
  const [autoCompile, setAutoCompile] = useState(false),
    [fontSize, setFontSize] = useState(14),
    [wrapLines, setWrapLines] = useState(true);
  const [layout, setLayout] = useState<"split" | "editor" | "pdf">("split");
  const [compiler] = useState(() => new CompilationCoordinator());
  const compilationStates = useSyncExternalStore(
    compiler.subscribe,
    compiler.getSnapshot,
  );
  const [logs, setLogs] = useState(false);
  const [cursor, setCursor] = useState({ line: 1, column: 1 }),
    [saved, setSaved] = useState(true),
    [toast, setToast] = useState("");
  const [fileMenu, setFileMenu] = useState(false),
    [newFileName, setNewFileName] = useState<string | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("leaf-history") || "[]");
    } catch {
      return [];
    }
  });
  const [split, setSplit] = useState(48),
    [grid, setGrid] = useState(false);
  const importRef = useRef<HTMLInputElement>(null),
    containerRef = useRef<HTMLDivElement>(null);
  const latest = useRef(project);
  latest.current = project;
  const attempted = useRef(new Set<string>());
  const compilation = compilationStates[project.id];
  const result = compilation?.result;
  const buildingRevision = compilation?.pendingRevision ?? null;
  const compiling = buildingRevision !== null;
  const compilingCurrentSource = buildingRevision === project.sourceRevision;

  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    setSaved(false);
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORE, JSON.stringify(projects));
        setSaved(true);
      } catch {
        notify("Browser storage is full. Export a backup of your project.");
      }
    }, 350);
    return () => clearTimeout(t);
  }, [projects, notify]);
  useEffect(() => {
    localStorage.setItem("leaf-active", project.id);
  }, [project.id]);
  useEffect(() => {
    try {
      localStorage.setItem("leaf-history", JSON.stringify(checkpoints));
    } catch {
      notify(
        "Checkpoint storage is full. Export your project to keep a backup.",
      );
    }
  }, [checkpoints, notify]);

  const updateProject = useCallback((fn: (p: Project) => Project) => {
    const projectId = latest.current.id;
    setProjects((ps) =>
      ps.map((p) => (p.id === projectId ? reviseProject(p, fn(p)) : p)),
    );
  }, []);
  const changeSource = useCallback(
    (value: string) => {
      const name = file.name;
      updateProject((p) => ({
        ...p,
        files: p.files.map((f) =>
          f.name === name ? { ...f, content: value } : f,
        ),
        updatedAt: Date.now(),
      }));
    },
    [file.name, updateProject],
  );
  const compile = useCallback(async () => {
    const p = latest.current;
    const accepted = await compiler.compile(p);
    if (
      accepted &&
      !accepted.success &&
      latest.current.id === p.id &&
      compiler.getSnapshot()[p.id]?.requestId === accepted.requestId
    ) {
      setLogs(true);
    }
  }, [compiler]);
  useEffect(() => {
    if (!dashboard && !attempted.current.has(project.id)) {
      attempted.current.add(project.id);
      void compile();
    }
  }, [project.id, dashboard, compile]);
  useEffect(() => {
    if (!autoCompile || dashboard) return;
    const t = setTimeout(() => void compile(), 1800);
    return () => clearTimeout(t);
  }, [project.files, autoCompile, dashboard, compile]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModal(null);
        setFileMenu(false);
        setNewFileName(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function openProject(p: Project) {
    setActiveId(p.id);
    setActiveFile(p.files[0]?.name || "main.tex");
    setDashboard(false);
    setLogs(false);
  }
  function addProject() {
    const p = createProject(nameInput.trim() || "Untitled Project", template);
    setProjects((ps) => [p, ...ps]);
    setActiveId(p.id);
    setActiveFile("main.tex");
    setDashboard(false);
    setModal(null);
  }
  function exportProject() {
    download(
      `${project.name}.leaf.json`,
      JSON.stringify(project, null, 2),
      "application/json",
    );
    setFileMenu(false);
    notify("Project backup downloaded");
  }
  function saveCheckpoint() {
    setCheckpoints((c) =>
      [
        {
          id: crypto.randomUUID(),
          name: project.name,
          at: Date.now(),
          project: structuredClone(project),
        },
        ...c,
      ].slice(0, 30),
    );
    notify("Checkpoint saved");
  }
  function createFile() {
    const name = newFileName?.trim();
    if (!name) return;
    if (
      !/^[a-zA-Z0-9_./ -]+\.(tex|bib|sty|cls|txt|csv)$/.test(name) ||
      name.split("/").some((s) => s === ".." || s === ".") ||
      name.startsWith("/")
    ) {
      notify("Use a relative .tex, .bib, .sty, .cls, .txt or .csv filename.");
      return;
    }
    if (project.files.some((f) => f.name === name)) {
      notify("A file with that name already exists.");
      return;
    }
    updateProject((p) => ({
      ...p,
      files: [...p.files, { name, content: "" }],
      updatedAt: Date.now(),
    }));
    setActiveFile(name);
    setNewFileName(null);
  }
  async function importFiles(list: FileList | null) {
    if (!list) return;
    for (const uploaded of Array.from(list)) {
      if (uploaded.size > 2_000_000) {
        notify("Choose a text file smaller than 2 MB.");
        continue;
      }
      try {
        const text = await uploaded.text();
        if (uploaded.name.endsWith(".json")) {
          const p = JSON.parse(text);
          if (
            typeof p.name !== "string" ||
            !Array.isArray(p.files) ||
            !p.files.length ||
            !p.files.every(
              (f: unknown) =>
                !!f &&
                typeof f === "object" &&
                "name" in f &&
                "content" in f &&
                typeof f.name === "string" &&
                typeof f.content === "string",
            )
          )
            throw new Error("Choose a valid Leaf project backup.");
          const restored = {
            ...p,
            id: crypto.randomUUID(),
            updatedAt: Date.now(),
            starred: false,
            sourceRevision: 1,
          };
          setProjects((ps) => [restored, ...ps]);
          openProject(restored);
        } else if (/\.(tex|bib|sty|cls|txt|csv)$/i.test(uploaded.name)) {
          if (dashboard && uploaded.name.endsWith(".tex")) {
            const imported = {
              ...createProject(uploaded.name.replace(/\.tex$/i, "")),
              files: [{ name: uploaded.name, content: text }],
            };
            setProjects((ps) => [imported, ...ps]);
            openProject(imported);
          } else {
            updateProject((p) => ({
              ...p,
              files: [
                ...p.files.filter((f) => f.name !== uploaded.name),
                { name: uploaded.name, content: text },
              ],
              updatedAt: Date.now(),
            }));
            setActiveFile(uploaded.name);
          }
          notify("File imported");
        } else notify("Choose a LaTeX source file or a Leaf project backup.");
      } catch (e) {
        notify(e instanceof Error ? e.message : "Could not import file.");
      }
    }
    if (importRef.current) importRef.current.value = "";
  }
  function beginResize(e: React.PointerEvent) {
    e.preventDefault();
    const move = (ev: PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect)
        setSplit(
          Math.min(
            72,
            Math.max(28, ((ev.clientX - rect.left) / rect.width) * 100),
          ),
        );
    };
    const stop = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", stop);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", stop);
  }
  const outline = outlineFrom(project.files);
  const filteredProjects = projects
    .filter(
      (p) =>
        (!starredOnly || p.starred) &&
        p.name.toLowerCase().includes(dashQuery.toLowerCase()),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="app-shell">
      <input
        ref={importRef}
        type="file"
        accept=".tex,.bib,.sty,.cls,.txt,.csv,.json"
        multiple
        hidden
        onChange={(e) => void importFiles(e.target.files)}
      />
      <header className="masthead">
        <button
          className="brand"
          onClick={() => setDashboard(true)}
          aria-label="Leaf projects"
        >
          <span className="brand-icon">
            <Leaf size={24} />
          </span>
          <span>
            leaf<span className="brand-dot">.</span>
          </span>
        </button>
        <span className="masthead-divider" />
        <button
          className="projects-link"
          aria-label="Projects"
          onClick={() => setDashboard(!dashboard)}
        >
          <FolderOpen size={16} />
          <span>Projects</span>
        </button>
        {!dashboard && (
          <div className="project-title-wrap">
            <button
              className="project-title"
              onClick={() => {
                setNameInput(project.name);
                setModal("rename");
              }}
            >
              {project.name}
              <ChevronDown size={14} />
            </button>
            <span className="saved-indicator" title="Saved in this browser">
              <Cloud size={14} />
              {saved ? "All changes saved" : "Saving…"}
            </span>
          </div>
        )}
        <div className="masthead-actions">
          <button
            className="header-subtle"
            aria-label="History"
            onClick={() => setModal("history")}
          >
            <Clock3 size={16} />
            <span>History</span>
          </button>
          <button
            className="header-export"
            aria-label="Export project"
            onClick={exportProject}
          >
            <Download size={15} />
            <span>Export project</span>
          </button>
          <button
            className="avatar"
            onClick={() => setModal("settings")}
            title="Workspace settings"
          >
            AM
          </button>
        </div>
      </header>
      {dashboard ? (
        <div className="dashboard">
          <aside className="dashboard-nav">
            <span className="eyebrow">WORKSPACE</span>
            <button
              className={!starredOnly ? "selected" : ""}
              onClick={() => setStarredOnly(false)}
            >
              <FolderOpen size={18} />
              All projects<span>{projects.length}</span>
            </button>
            <button
              className={starredOnly ? "selected" : ""}
              onClick={() => setStarredOnly(true)}
            >
              <Star size={18} />
              Starred<span>{projects.filter((p) => p.starred).length}</span>
            </button>
            <div className="dash-tip">
              <Leaf size={25} />
              <h4>A little space for big ideas.</h4>
              <p>Your projects are saved automatically in this browser.</p>
            </div>
            <button onClick={() => setModal("help")} className="dash-help">
              <CircleHelp size={17} />
              Help & shortcuts
            </button>
          </aside>
          <main className="dashboard-main">
            <div className="dashboard-heading">
              <div>
                <div className="breadcrumb">
                  Workspace <ChevronRight size={13} />
                  Projects
                </div>
                <h1>
                  {starredOnly ? "Starred projects" : "Your projects"}
                  <span>{filteredProjects.length}</span>
                </h1>
                <p>Pick up where you left off. Make something worth reading.</p>
              </div>
              <button
                className="primary-button"
                onClick={() => {
                  setNameInput("");
                  setModal("new");
                }}
              >
                <Plus size={17} />
                New project
              </button>
            </div>
            <div className="dashboard-controls">
              <label className="search-field">
                <Search size={17} />
                <input
                  aria-label="Search projects"
                  placeholder="Search your projects…"
                  value={dashQuery}
                  onChange={(e) => setDashQuery(e.target.value)}
                />
                {dashQuery && (
                  <button
                    onClick={() => setDashQuery("")}
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </label>
              <span className="sort-label">
                Last edited <ChevronDown size={13} />
              </span>
              <div className="view-toggle">
                <IconButton
                  label="List view"
                  active={!grid}
                  onClick={() => setGrid(false)}
                >
                  <List size={17} />
                </IconButton>
                <IconButton
                  label="Grid view"
                  active={grid}
                  onClick={() => setGrid(true)}
                >
                  <LayoutGrid size={17} />
                </IconButton>
              </div>
            </div>
            <div className={`project-list ${grid ? "grid" : ""}`}>
              {!grid && (
                <div className="project-list-header">
                  <span>PROJECT NAME</span>
                  <span>LAST EDITED</span>
                  <span />
                </div>
              )}
              {filteredProjects.map((p) => (
                <div className="project-card" key={p.id}>
                  <button
                    className={`star-button ${p.starred ? "is-starred" : ""}`}
                    aria-label={`${p.starred ? "Unstar" : "Star"} ${p.name}`}
                    onClick={() =>
                      setProjects((ps) =>
                        ps.map((x) =>
                          x.id === p.id ? { ...x, starred: !x.starred } : x,
                        ),
                      )
                    }
                  >
                    <Star
                      size={17}
                      fill={p.starred ? "currentColor" : "none"}
                    />
                  </button>
                  <button
                    className="project-card-open"
                    onClick={() => openProject(p)}
                  >
                    <span className="document-icon">
                      <FileText size={23} />
                    </span>
                    <span>
                      <strong>{p.name}</strong>
                      <small>
                        {p.files.length}{" "}
                        {p.files.length === 1 ? "file" : "files"} · LaTeX
                        project
                      </small>
                    </span>
                  </button>
                  <span className="project-date">
                    {new Date(p.updatedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <IconButton
                    label={`Duplicate ${p.name}`}
                    onClick={() => {
                      const copy = {
                        ...structuredClone(p),
                        id: crypto.randomUUID(),
                        name: `${p.name} (copy)`,
                        updatedAt: Date.now(),
                      };
                      setProjects((ps) => [copy, ...ps]);
                      notify("Project duplicated");
                    }}
                  >
                    <Copy size={16} />
                  </IconButton>
                </div>
              ))}
              {!filteredProjects.length && (
                <div className="empty-projects">
                  <Search size={30} />
                  <h3>No projects found</h3>
                  <p>Try a different search or create a new project.</p>
                </div>
              )}
            </div>
            <button
              className="import-project"
              onClick={() => importRef.current?.click()}
            >
              <Upload size={17} />
              Import a .tex file or project backup
              <ArrowUpRight size={15} />
            </button>
            <div className="dashboard-footer">
              <span>
                <Leaf size={15} />
                Made for your next great idea.
              </span>
              <span>Local workspace · Your files stay on this computer</span>
            </div>
          </main>
        </div>
      ) : (
        <>
          <nav className="menu-bar">
            <div className="menu-left">
              <div className="menu-anchor">
                <button
                  className={fileMenu ? "menu-active" : ""}
                  onClick={() => setFileMenu(!fileMenu)}
                >
                  File
                  <ChevronDown size={11} />
                </button>
                {fileMenu && (
                  <div className="dropdown-menu">
                    <button
                      onClick={() => {
                        setFileMenu(false);
                        setNewFileName("");
                      }}
                    >
                      <FilePlus2 size={15} />
                      New file
                    </button>
                    <button
                      onClick={() => {
                        setFileMenu(false);
                        importRef.current?.click();
                      }}
                    >
                      <Upload size={15} />
                      Import file
                    </button>
                    <hr />
                    <button
                      onClick={() => {
                        download(file.name, file.content);
                        setFileMenu(false);
                      }}
                    >
                      <Download size={15} />
                      Download current source
                    </button>
                    <button onClick={exportProject}>
                      <Download size={15} />
                      Export project backup
                    </button>
                    <hr />
                    <button
                      onClick={() => {
                        saveCheckpoint();
                        setFileMenu(false);
                      }}
                    >
                      <Save size={15} />
                      Save checkpoint
                    </button>
                  </div>
                )}
              </div>
              <button onClick={() => setModal("settings")}>
                View
                <ChevronDown size={11} />
              </button>
              <button onClick={() => setModal("help")}>
                Help
                <ChevronDown size={11} />
              </button>
              <span className="menu-dot" />
              <span className="workspace-label">
                <LockIcon />
                Local workspace
              </span>
            </div>
            <div className="menu-right">
              <span className="tex-engine">
                LaTeX <span>·</span> Tectonic
              </span>
              <IconButton
                label="Toggle file sidebar"
                onClick={() => setSidebar(!sidebar)}
              >
                {sidebar ? (
                  <PanelLeftClose size={16} />
                ) : (
                  <PanelLeftOpen size={16} />
                )}
              </IconButton>
              <button
                className="layout-control"
                onClick={() =>
                  setLayout(
                    layout === "split"
                      ? "editor"
                      : layout === "editor"
                        ? "pdf"
                        : "split",
                  )
                }
                title="Cycle layout"
              >
                <LayoutPanelLeft size={15} />
                <span>
                  {layout === "split"
                    ? "Split view"
                    : layout === "editor"
                      ? "Editor only"
                      : "PDF only"}
                </span>
                <ChevronDown size={12} />
              </button>
            </div>
          </nav>
          <div className="workspace-body">
            <aside className="activity-rail">
              <div>
                <IconButton
                  label="Project files"
                  active={sideTab === "files" && sidebar}
                  onClick={() => {
                    setSidebar(true);
                    setSideTab("files");
                  }}
                >
                  <Files size={21} />
                </IconButton>
                <IconButton
                  label="Search project"
                  active={sideTab === "search" && sidebar}
                  onClick={() => {
                    setSidebar(true);
                    setSideTab("search");
                  }}
                >
                  <Search size={21} />
                </IconButton>
                <IconButton
                  label="Project checkpoints"
                  onClick={() => setModal("history")}
                >
                  <Clock3 size={20} />
                </IconButton>
              </div>
              <div>
                <IconButton
                  label="Help and shortcuts"
                  onClick={() => setModal("help")}
                >
                  <CircleHelp size={21} />
                </IconButton>
                <IconButton
                  label="Editor settings"
                  onClick={() => setModal("settings")}
                >
                  <Settings size={21} />
                </IconButton>
              </div>
            </aside>
            {sidebar && (
              <aside className="file-sidebar">
                <div className="sidebar-heading">
                  <strong>{sideTab === "files" ? "Files" : "Search"}</strong>
                  <div>
                    <IconButton
                      label="New file"
                      onClick={() => setNewFileName("")}
                    >
                      <FilePlus2 size={16} />
                    </IconButton>
                    <IconButton
                      label="Import file"
                      onClick={() => importRef.current?.click()}
                    >
                      <Upload size={15} />
                    </IconButton>
                    <IconButton
                      label="Hide sidebar"
                      onClick={() => setSidebar(false)}
                    >
                      <X size={15} />
                    </IconButton>
                  </div>
                </div>
                {sideTab === "search" && (
                  <label className="sidebar-search">
                    <Search size={14} />
                    <input
                      autoFocus
                      placeholder="Search in project…"
                      aria-label="Search in project"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                )}
                <div className="file-tree">
                  <div className="tree-root">
                    <ChevronDown size={13} />
                    <FolderOpen size={15} />
                    <span>Project files</span>
                  </div>
                  {project.files
                    .filter(
                      (f) =>
                        sideTab !== "search" ||
                        !query ||
                        f.content.toLowerCase().includes(query.toLowerCase()) ||
                        f.name.toLowerCase().includes(query.toLowerCase()),
                    )
                    .map((f) => (
                      <div
                        className={`file-row ${file.name === f.name ? "selected" : ""}`}
                        key={f.name}
                      >
                        <button onClick={() => setActiveFile(f.name)}>
                          <FileText size={15} />
                          <span>{f.name}</span>
                          {f.name === "main.tex" && (
                            <span
                              className="main-file-dot"
                              title="Main document"
                            />
                          )}
                        </button>
                        {f.name !== "main.tex" && (
                          <button
                            className="delete-file"
                            title={`Delete ${f.name}`}
                            aria-label={`Delete ${f.name}`}
                            onClick={() => {
                              saveCheckpoint();
                              updateProject((p) => ({
                                ...p,
                                files: p.files.filter((x) => x.name !== f.name),
                                updatedAt: Date.now(),
                              }));
                              setActiveFile("main.tex");
                              notify(
                                "File removed. Your latest checkpoint is still available.",
                              );
                            }}
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  {newFileName !== null && (
                    <form
                      className="new-file-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        createFile();
                      }}
                    >
                      <input
                        autoFocus
                        aria-label="New file name"
                        placeholder="filename.tex"
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                      />
                      <button type="submit" aria-label="Create file">
                        <Check size={15} />
                      </button>
                    </form>
                  )}
                  {sideTab === "search" && query && (
                    <small className="search-note">
                      Matching files shown. Use Ctrl+F in the editor to find
                      text.
                    </small>
                  )}
                </div>
                <div className="outline-panel">
                  <div className="outline-heading">
                    <ChevronDown size={12} />
                    <strong>Document outline</strong>
                    <List size={14} />
                  </div>
                  <div className="outline-items">
                    {outline.map((o, i) => (
                      <button
                        key={`${o.title}-${i}`}
                        className={o.nested ? "nested" : ""}
                        onClick={() => {
                          setActiveFile(
                            project.files.some((f) => f.name === "main.tex")
                              ? "main.tex"
                              : project.files[0].name,
                          );
                          requestAnimationFrame(() =>
                            window.dispatchEvent(
                              new CustomEvent("leaf-goto-line", {
                                detail: o.line,
                              }),
                            ),
                          );
                        }}
                      >
                        <span className="outline-node" />
                        {o.title}
                      </button>
                    ))}
                    {!outline.length && (
                      <p>Add a \section to see your outline here.</p>
                    )}
                  </div>
                </div>
                <div className="sidebar-foot">
                  <span className="status-dot" />
                  Saved on this device
                  <Cloud size={14} />
                </div>
              </aside>
            )}
            <div
              className={`editing-area layout-${layout}`}
              ref={containerRef}
              style={{ "--source-width": `${split}%` } as CSSProperties}
            >
              {layout !== "pdf" && (
                <section className="source-pane">
                  <div className="source-heading">
                    <div className="source-tabs">
                      <button className="selected">
                        <Braces size={15} />
                        Code editor
                      </button>
                      <button
                        onClick={() => {
                          saveCheckpoint();
                          setModal("history");
                        }}
                        title="Save a checkpoint and view history"
                      >
                        <Clock3 size={14} />
                        Checkpoints
                      </button>
                    </div>
                    <span className="file-label">{file.name}</span>
                  </div>
                  <LatexEditor
                    key={`${project.id}/${file.name}`}
                    value={file.content}
                    onChange={changeSource}
                    onCompile={() => void compile()}
                    fileName={file.name}
                    fontSize={fontSize}
                    wrapLines={wrapLines}
                    onCursorChange={(line, column) =>
                      setCursor({ line, column })
                    }
                  />
                  <div className="editor-status">
                    <span>
                      <span className="status-dot" />
                      {saved ? "Saved" : "Saving…"}
                    </span>
                    <span>
                      Ln {cursor.line}, Col {cursor.column}
                      <span className="status-sep" />
                      UTF-8
                      <span className="status-sep" />
                      LaTeX
                    </span>
                  </div>
                </section>
              )}
              {layout === "split" && (
                <div
                  className="pane-divider"
                  role="separator"
                  aria-label="Resize editor and preview"
                  aria-valuenow={Math.round(split)}
                  aria-valuemin={28}
                  aria-valuemax={72}
                  tabIndex={0}
                  onPointerDown={beginResize}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowLeft") {
                      e.preventDefault();
                      setSplit((s) => Math.max(28, s - 2));
                    }
                    if (e.key === "ArrowRight") {
                      e.preventDefault();
                      setSplit((s) => Math.min(72, s + 2));
                    }
                  }}
                >
                  <GripVertical size={13} />
                </div>
              )}
              {layout !== "editor" && (
                <section className="preview-pane">
                  <div className="compile-toolbar">
                    <div className="compile-controls">
                      <button
                        className={`recompile-button ${compilingCurrentSource ? "is-compiling" : ""}`}
                        onClick={() => void compile()}
                        aria-label={
                          compilingCurrentSource
                            ? "Compiling document"
                            : "Recompile"
                        }
                        disabled={compilingCurrentSource}
                      >
                        <RefreshIcon spinning={compilingCurrentSource} />
                        {compilingCurrentSource
                          ? `Compiling r${buildingRevision}…`
                          : "Recompile"}
                        <kbd>Ctrl ↵</kbd>
                      </button>
                      <label
                        className="auto-compile"
                        title="Recompile 1.8 seconds after editing"
                      >
                        <input
                          type="checkbox"
                          checked={autoCompile}
                          onChange={(e) => setAutoCompile(e.target.checked)}
                        />
                        <span>Auto</span>
                      </label>
                    </div>
                    <div className="compile-options">
                      <span
                        className={`compile-state ${result?.success ? "success" : result && !result.success ? "failure" : ""}`}
                      >
                        {result?.success ? (
                          <CheckCircle2 size={14} />
                        ) : result && !result.success ? (
                          <AlertCircle size={14} />
                        ) : null}
                        {compiling
                          ? `Building r${buildingRevision}`
                          : result?.success
                            ? `${(result.durationMs / 1000).toFixed(1)}s`
                            : result
                              ? "Error"
                              : ""}
                      </span>
                      <IconButton
                        label="Logs and output files"
                        active={logs}
                        onClick={() => setLogs(!logs)}
                      >
                        <FileText size={17} />
                      </IconButton>
                    </div>
                  </div>
                  <PdfPreview
                    key={project.id}
                    pdfUrl={result?.pdfUrl || null}
                    compiling={compiling}
                    sourceRevision={project.sourceRevision}
                    pdfSourceRevision={result?.pdfSourceRevision ?? null}
                    buildingRevision={buildingRevision}
                    error={
                      result && !result.success
                        ? result.errors?.[0]?.message || "Compilation failed"
                        : null
                    }
                    onRecompile={() => void compile()}
                    onOpenLogs={() => setLogs(true)}
                    projectName={project.name}
                  />
                  {logs && (
                    <div className="logs-panel">
                      <div className="logs-heading">
                        <span>
                          {result?.success ? (
                            <CheckCircle2 size={15} />
                          ) : (
                            <AlertCircle size={15} />
                          )}
                          Compiler output
                        </span>
                        <IconButton
                          label="Close logs"
                          onClick={() => setLogs(false)}
                        >
                          <X size={16} />
                        </IconButton>
                      </div>
                      {result?.errors?.map((err, i) => (
                        <div className="error-message" key={i}>
                          {err.line && <strong>Line {err.line} · </strong>}
                          {err.message}
                        </div>
                      ))}
                      <pre>
                        {result?.log ||
                          "Click Recompile to build your document."}
                      </pre>
                    </div>
                  )}
                </section>
              )}
            </div>
          </div>
        </>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {toast}
        </div>
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div
            className={`modal ${modal === "history" ? "wide-modal" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === "new"
                ? "New project"
                : modal === "rename"
                  ? "Rename project"
                  : modal === "history"
                    ? "Project history"
                    : modal === "settings"
                      ? "Workspace settings"
                      : "Help and shortcuts"
            }
          >
            <button
              className="modal-close icon-button"
              aria-label="Close dialog"
              onClick={() => setModal(null)}
            >
              <X size={20} />
            </button>
            {(modal === "new" || modal === "rename") && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (modal === "new") addProject();
                  else {
                    updateProject((p) => ({
                      ...p,
                      name: nameInput.trim() || p.name,
                      updatedAt: Date.now(),
                    }));
                    setModal(null);
                  }
                }}
              >
                <span className="modal-symbol">
                  <Leaf size={25} />
                </span>
                <h2>
                  {modal === "new"
                    ? "Make room for an idea."
                    : "Rename your project"}
                </h2>
                <p>
                  {modal === "new"
                    ? "Start fresh, or give yourself a head start with a template."
                    : "Give your work a name that feels right."}
                </p>
                <label className="field-label">
                  Project name
                  <input
                    autoFocus
                    required
                    maxLength={100}
                    placeholder="e.g. My research paper"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                  />
                </label>
                {modal === "new" && (
                  <>
                    <label className="field-label">Start with</label>
                    <div className="template-options">
                      {[
                        ["blank", "Blank document", "A clean beginning"],
                        [
                          "article",
                          "Research article",
                          "Sections, math & structure",
                        ],
                        ["letter", "Letter", "A thoughtful first impression"],
                      ].map(([id, title, desc]) => (
                        <button
                          type="button"
                          className={template === id ? "selected" : ""}
                          key={id}
                          onClick={() => setTemplate(id)}
                        >
                          <FileText size={23} />
                          <strong>{title}</strong>
                          <small>{desc}</small>
                          {template === id && <Check size={15} />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setModal(null)}
                  >
                    Cancel
                  </button>
                  <button className="primary-button" type="submit">
                    {modal === "new" ? "Create project" : "Save name"}
                    <ArrowUpRight size={16} />
                  </button>
                </div>
              </form>
            )}
            {modal === "settings" && (
              <>
                <span className="modal-symbol">
                  <Settings size={25} />
                </span>
                <h2>A workspace that fits.</h2>
                <p>Small adjustments, a better writing experience.</p>
                <div className="setting-row">
                  <span>
                    <strong>Editor font size</strong>
                    <small>Give your code a little breathing room.</small>
                  </span>
                  <select
                    aria-label="Editor font size"
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                  >
                    {[12, 13, 14, 15, 16, 18, 20].map((n) => (
                      <option key={n} value={n}>
                        {n}px
                      </option>
                    ))}
                  </select>
                </div>
                <label className="setting-row">
                  <span>
                    <strong>Wrap long lines</strong>
                    <small>Keep your source inside the editing pane.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={wrapLines}
                    onChange={(e) => setWrapLines(e.target.checked)}
                  />
                </label>
                <label className="setting-row">
                  <span>
                    <strong>Auto compile</strong>
                    <small>Update the PDF after you pause typing.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={autoCompile}
                    onChange={(e) => setAutoCompile(e.target.checked)}
                  />
                </label>
                <div className="setting-row">
                  <span>
                    <strong>Layout</strong>
                    <small>Focus on writing, reading, or both.</small>
                  </span>
                  <select
                    aria-label="Workspace layout"
                    value={layout}
                    onChange={(e) => setLayout(e.target.value as typeof layout)}
                  >
                    <option value="split">Editor & PDF</option>
                    <option value="editor">Editor only</option>
                    <option value="pdf">PDF only</option>
                  </select>
                </div>
                <div className="settings-note">
                  <CheckCircle2 size={17} />
                  <span>
                    Real LaTeX typesetting with Tectonic. Projects save in this
                    browser; compilation runs on this computer.
                  </span>
                </div>
              </>
            )}
            {modal === "history" && (
              <>
                <span className="modal-symbol">
                  <Clock3 size={25} />
                </span>
                <h2>A place to come back to.</h2>
                <p>Save a checkpoint before exploring a new direction.</p>
                <button className="primary-button" onClick={saveCheckpoint}>
                  <Plus size={16} />
                  Save current checkpoint
                </button>
                <div className="history-list">
                  {checkpoints
                    .filter((c) => c.project.id === project.id)
                    .map((c) => (
                      <div className="history-item" key={c.id}>
                        <span className="history-dot" />
                        <div>
                          <strong>{c.name}</strong>
                          <small>{new Date(c.at).toLocaleString()}</small>
                        </div>
                        <button
                          className="secondary-button"
                          onClick={() => {
                            setCheckpoints((old) =>
                              [
                                {
                                  id: crypto.randomUUID(),
                                  name: `Before restore: ${project.name}`,
                                  at: Date.now(),
                                  project: structuredClone(project),
                                },
                                ...old,
                              ].slice(0, 30),
                            );
                            updateProject(() => ({
                              ...structuredClone(c.project),
                              updatedAt: Date.now(),
                            }));
                            setActiveFile("main.tex");
                            setModal(null);
                            notify(
                              "Checkpoint restored; previous work saved as a checkpoint.",
                            );
                          }}
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  {!checkpoints.some((c) => c.project.id === project.id) && (
                    <div className="empty-history">
                      <Clock3 size={30} />
                      <strong>Your story starts here.</strong>
                      <p>Checkpoints you save will appear here.</p>
                    </div>
                  )}
                </div>
              </>
            )}
            {modal === "help" && (
              <>
                <span className="modal-symbol">
                  <BookOpen size={25} />
                </span>
                <h2>From an idea to a page.</h2>
                <p>
                  Write LaTeX on the left. Recompile to see a real typeset PDF
                  on the right.
                </p>
                <div className="shortcuts">
                  <div>
                    <span>Compile your document</span>
                    <kbd>Ctrl / ⌘ + Enter</kbd>
                  </div>
                  <div>
                    <span>Compile and save</span>
                    <kbd>Ctrl / ⌘ + S</kbd>
                  </div>
                  <div>
                    <span>Find in the source</span>
                    <kbd>Ctrl / ⌘ + F</kbd>
                  </div>
                  <div>
                    <span>Undo / redo</span>
                    <kbd>Ctrl / ⌘ + Z</kbd>
                  </div>
                </div>
                <p className="help-note">
                  Your files save automatically in this browser. Export a
                  project backup to keep a portable copy. Multiple .tex files,
                  sections, equations, citations, and standard packages are
                  supported by the local compiler.
                </p>
                <a
                  className="help-link"
                  href="https://www.overleaf.com/learn/latex/Learn_LaTeX_in_30_minutes"
                  target="_blank"
                  rel="noreferrer"
                >
                  A friendly introduction to LaTeX
                  <ExternalLink size={14} />
                </a>
                <small className="independent-note">
                  Leaf is an independent local workspace inspired by Overleaf.
                  It does not connect to Overleaf accounts.
                </small>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
function LockIcon() {
  return (
    <svg width="11" height="12" viewBox="0 0 12 13" fill="none">
      <rect x="2" y="5.5" width="8" height="6" rx="1.5" stroke="currentColor" />
      <path d="M3.5 5.5V3.5a2.5 2.5 0 015 0v2" stroke="currentColor" />
    </svg>
  );
}
function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      className={spinning ? "spin" : ""}
      width="15"
      height="15"
      viewBox="0 0 20 20"
      fill="none"
    >
      <path
        d="M16 7a6.5 6.5 0 10.4 5M16 3v4h-4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

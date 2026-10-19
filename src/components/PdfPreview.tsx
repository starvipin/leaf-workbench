import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Maximize,
  Minus,
  Plus,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "./preview.css";

GlobalWorkerOptions.workerSrc = pdfWorker;

type PdfPreviewProps = {
  pdfUrl: string | null;
  compiling: boolean;
  error?: string | null;
  onRecompile: () => void;
  onOpenLogs: () => void;
  projectName: string;
  sourceRevision: number;
  pdfSourceRevision: number | null;
  buildingRevision: number | null;
};

export default function PdfPreview({
  pdfUrl,
  compiling,
  error,
  onRecompile,
  onOpenLogs,
  projectName,
  sourceRevision,
  pdfSourceRevision,
  buildingRevision,
}: PdfPreviewProps) {
  const [loadedPdf, setLoadedPdf] = useState<{
    document: PDFDocumentProxy;
    url: string;
    sourceRevision: number;
  } | null>(null);
  const document = loadedPdf?.document ?? null;
  const [renderedPdf, setRenderedPdf] = useState<{
    url: string;
    sourceRevision: number;
  } | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [resolvedScale, setResolvedScale] = useState(1);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [loading, setLoading] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setAvailableWidth(entry.contentRect.width),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pdfUrl || pdfSourceRevision === null) return;
    let alive = true;
    let accepted = false;
    setLoading(true);
    setPreviewError(null);
    const task = getDocument({ url: pdfUrl });
    void task.promise
      .then((nextDocument) => {
        if (!alive) {
          void nextDocument.destroy();
          return;
        }
        accepted = true;
        setPageNumber(1);
        setLoadedPdf({
          document: nextDocument,
          url: pdfUrl,
          sourceRevision: pdfSourceRevision,
        });
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (!alive) return;
        setLoading(false);
        setPreviewError(
          reason instanceof Error
            ? reason.message
            : "Unable to open the compiled PDF.",
        );
      });
    return () => {
      alive = false;
      if (!accepted) void task.destroy();
    };
  }, [pdfUrl, pdfSourceRevision]);

  useEffect(
    () => () => {
      renderTaskRef.current?.cancel();
      if (document) void document.destroy();
    },
    [document],
  );

  useEffect(() => {
    if (!document || !canvasRef.current || !availableWidth) return;
    let alive = true;
    let task: RenderTask | null = null;
    setRendering(true);
    void document
      .getPage(Math.min(pageNumber, document.numPages))
      .then(async (page) => {
        if (!alive || !canvasRef.current) return;
        const naturalSize = page.getViewport({ scale: 1 });
        const scale =
          zoom === "fit"
            ? Math.max(0.15, (availableWidth - 64) / naturalSize.width)
            : zoom;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        setResolvedScale(scale);
        setDimensions({ width: viewport.width, height: viewport.height });
        canvas.width = Math.ceil(viewport.width * pixelRatio);
        canvas.height = Math.ceil(viewport.height * pixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        task = page.render({
          canvas,
          viewport,
          transform:
            pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
          background: "#ffffff",
        });
        renderTaskRef.current = task;
        await task.promise;
        if (alive) {
          if (loadedPdf)
            setRenderedPdf({
              url: loadedPdf.url,
              sourceRevision: loadedPdf.sourceRevision,
            });
          setRendering(false);
          setPreviewError(null);
        }
      })
      .catch((reason: unknown) => {
        if (!alive) return;
        setRendering(false);
        if (
          reason instanceof Error &&
          reason.name === "RenderingCancelledException"
        )
          return;
        setPreviewError(
          reason instanceof Error
            ? reason.message
            : "Unable to render this PDF page.",
        );
      });
    return () => {
      alive = false;
      task?.cancel();
    };
  }, [document, loadedPdf, pageNumber, zoom, availableWidth]);

  const changeZoom = (direction: number) =>
    setZoom(
      Math.min(
        3,
        Math.max(
          0.25,
          Math.round((resolvedScale + direction * 0.15) * 100) / 100,
        ),
      ),
    );
  const changePage = (nextPage: number) => {
    setPageNumber(nextPage);
    viewportRef.current?.scrollTo({ top: 0, left: 0 });
  };
  const busy = compiling || loading;
  const downloadUrl = renderedPdf?.url ?? null;
  const stale =
    renderedPdf !== null && renderedPdf.sourceRevision !== sourceRevision;

  return (
    <section className="pdf-preview" aria-label="PDF preview">
      <div className="pdf-toolbar">
        <span className="pdf-toolbar-label">
          <FileText size={13} />
          PDF preview
        </span>
        <div className="pdf-page-controls">
          <button
            className="pdf-icon-button"
            disabled={!document || pageNumber <= 1}
            onClick={() => changePage(pageNumber - 1)}
            title="Previous page"
            aria-label="Previous PDF page"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="pdf-page-count" aria-live="polite">
            {document ? `${pageNumber} / ${document.numPages}` : "— / —"}
          </span>
          <button
            className="pdf-icon-button"
            disabled={!document || pageNumber >= document.numPages}
            onClick={() => changePage(pageNumber + 1)}
            title="Next page"
            aria-label="Next PDF page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="pdf-zoom-controls">
          <button
            className="pdf-icon-button"
            onClick={() => changeZoom(-1)}
            disabled={!document || resolvedScale <= 0.25}
            title="Zoom out"
            aria-label="Zoom out"
          >
            <Minus size={15} />
          </button>
          <button
            className="pdf-zoom-label"
            onClick={() => setZoom("fit")}
            disabled={!document}
            title="Fit page to width"
          >
            {document ? `${Math.round(resolvedScale * 100)}%` : "100%"}
          </button>
          <button
            className="pdf-icon-button"
            onClick={() => changeZoom(1)}
            disabled={!document || resolvedScale >= 3}
            title="Zoom in"
            aria-label="Zoom in"
          >
            <Plus size={15} />
          </button>
          <button
            className={`pdf-icon-button pdf-fit-button ${zoom === "fit" ? "is-active" : ""}`}
            onClick={() => setZoom("fit")}
            disabled={!document}
            title="Fit to width"
            aria-label="Fit PDF to width"
          >
            <Maximize size={14} />
          </button>
        </div>
        <div className="pdf-toolbar-divider" />
        {downloadUrl && document ? (
          <a
            className="pdf-icon-button pdf-download-button"
            href={downloadUrl}
            download={`${projectName.replace(/[^a-zA-Z0-9_ -]/g, "") || "document"}.pdf`}
            title="Download PDF"
            aria-label="Download compiled PDF"
          >
            <Download size={16} />
          </a>
        ) : (
          <button
            className="pdf-icon-button pdf-download-button"
            disabled
            aria-label="Download compiled PDF"
          >
            <Download size={16} />
          </button>
        )}
      </div>

      <div
        className={`pdf-provenance ${stale ? "is-stale" : ""}`}
        role="status"
        aria-label="Preview source revision"
        data-source-revision={sourceRevision}
        data-preview-revision={renderedPdf?.sourceRevision ?? ""}
        data-stale={stale}
      >
        <span title="Source revision used to produce the visible PDF">
          PDF {renderedPdf ? `r${renderedPdf.sourceRevision}` : "not compiled"}
        </span>
        <span>Source r{sourceRevision}</span>
        <strong>
          {compiling
            ? `Building r${buildingRevision}`
            : loading || rendering
              ? "Updating preview"
              : stale
                ? "Uncompiled changes"
                : renderedPdf
                  ? "Up to date"
                  : "Not compiled"}
        </strong>
      </div>

      {(error || previewError) && (
        <div className="pdf-error-banner" role="alert">
          <TriangleAlert size={15} />
          <span>
            {previewError
              ? "The PDF preview could not be loaded."
              : "Compilation failed. Check the logs to see what needs fixing."}
          </span>
          <button onClick={onOpenLogs}>View logs</button>
        </div>
      )}

      <div
        className={`pdf-viewport ${!document ? "pdf-viewport-empty" : ""}`}
        ref={viewportRef}
        aria-busy={busy || rendering}
      >
        {document ? (
          <div className="pdf-pages">
            <div
              className="pdf-paper"
              style={{
                width: dimensions.width || undefined,
                minHeight: dimensions.height || undefined,
              }}
            >
              <canvas
                ref={canvasRef}
                role="img"
                aria-label={`Page ${pageNumber} of ${document.numPages} of ${projectName}`}
              />
            </div>
            <div className="pdf-paper-caption">
              PAGE {pageNumber} OF {document.numPages}
            </div>
          </div>
        ) : (
          <div className="pdf-empty-state">
            <div className="pdf-empty-document">
              <FileText size={35} strokeWidth={1.25} />
              <span />
              <span />
              <span />
            </div>
            <span className="pdf-empty-eyebrow">
              A LITTLE LATEX. A LOT OF POSSIBILITY.
            </span>
            <h2>Your document, brought to life</h2>
            <p>
              Write on the left. Recompile to see your
              <br />
              beautifully typeset document here.
            </p>
            <button
              className="pdf-empty-compile"
              onClick={onRecompile}
              disabled={compiling}
            >
              <RefreshCw size={15} className={busy ? "pdf-spin" : ""} />
              {busy
                ? "Bringing your document to life…"
                : "Compile your document"}
            </button>
            <span className="pdf-keyboard-hint">
              or press <kbd>Ctrl</kbd> + <kbd>Enter</kbd>
            </span>
          </div>
        )}
        {document && busy && (
          <div className="pdf-loading-badge" role="status">
            <RefreshCw size={13} className="pdf-spin" />
            {compiling ? "Compiling your document…" : "Loading your PDF…"}
          </div>
        )}
      </div>
      <div className="pdf-statusbar">
        <span
          className={`pdf-status-dot ${error || previewError || stale ? "has-error" : ""} ${busy ? "is-busy" : ""}`}
        />
        <span>
          {busy
            ? "Updating preview"
            : error || previewError
              ? "Compilation needs attention"
              : stale
                ? "Uncompiled changes — recompile to update the PDF"
                : renderedPdf
                  ? "PDF preview is up to date"
                  : "Ready when you are"}
        </span>
        <span className="pdf-status-type">PDF PREVIEW</span>
      </div>
    </section>
  );
}

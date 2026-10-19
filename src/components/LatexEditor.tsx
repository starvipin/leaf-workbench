import { useEffect, useRef } from 'react';
import { Annotation, Compartment, EditorSelection, EditorState, Transaction } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab, redo, toggleComment, undo } from '@codemirror/commands';
import { bracketMatching, HighlightStyle, indentOnInput, StreamLanguage, syntaxHighlighting } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { highlightSelectionMatches, openSearchPanel, search, searchKeymap } from '@codemirror/search';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { tags } from '@lezer/highlight';
import { Bold, Heading2, Italic, MessageSquare, Redo2, Search, Sigma, Undo2 } from 'lucide-react';
import './editor.css';

export interface LatexEditorProps {
  value: string;
  onChange: (value: string) => void;
  onCompile: () => void;
  fileName: string;
  onCursorChange?: (line: number, column: number) => void;
  fontSize?: number;
  wrapLines?: boolean;
}

const externalChange = Annotation.define<boolean>();
const latexHighlight = HighlightStyle.define([
  { tag: [tags.tagName, tags.function(tags.variableName)], color: '#167350' },
  { tag: [tags.keyword, tags.operator], color: '#9155b1' },
  { tag: tags.special(tags.variableName), color: '#9155b1', fontStyle: 'italic' },
  { tag: tags.comment, color: '#8b8294', fontStyle: 'italic' },
  { tag: [tags.atom, tags.number, tags.bool], color: '#b46d37' },
  { tag: [tags.string, tags.special(tags.string)], color: '#526e98' },
  { tag: [tags.bracket, tags.punctuation], color: '#7d8590' },
  { tag: tags.invalid, color: '#c15252' },
]);

const editorTheme = EditorView.theme({
  '&': { height: '100%', color: '#39434a', backgroundColor: '#fdfdfb' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { overflow: 'auto', fontFamily: '"JetBrains Mono", "Cascadia Code", Consolas, monospace', lineHeight: '1.8' },
  '.cm-content': { padding: '20px 0 100px', caretColor: '#16815d' },
  '.cm-line': { padding: '0 24px 0 14px' },
  '.cm-gutters': { backgroundColor: '#fdfdfb', border: 'none', color: '#afb4b3', padding: '20px 0 100px', minWidth: '46px' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 12px' },
  '.cm-activeLine': { backgroundColor: '#eff5f088' },
  '.cm-activeLineGutter': { color: '#4c7861', backgroundColor: '#eff5f0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#16815d', borderLeftWidth: '2px' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: '#d8e9df' },
  '.cm-matchingBracket': { backgroundColor: '#d7eadf', color: '#175e40' },
  '.cm-searchMatch': { backgroundColor: '#fff0ba', outline: '1px solid #e4cb7a' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: '#e0d08d' },
  '.cm-selectionMatch': { backgroundColor: '#dceee3' },
  '.cm-panels': { backgroundColor: '#f5f7f3', color: '#465348', borderColor: '#e1e6df' },
  '.cm-panels.cm-panels-top': { borderBottom: '1px solid #e1e6df' },
  '.cm-search': { padding: '10px 12px', fontFamily: 'inherit', fontSize: '12px' },
  '.cm-textfield': { border: '1px solid #d4dcd3', borderRadius: '4px', backgroundColor: '#fff', padding: '4px 6px' },
  '.cm-button': { border: '1px solid #d4dcd3', borderRadius: '4px', backgroundImage: 'none', backgroundColor: '#fff' },
});

export default function LatexEditor({ value, onChange, onCompile, fileName, onCursorChange, fontSize = 13, wrapLines = true }: LatexEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const callbacks = useRef({ onChange, onCompile, onCursorChange });
  const currentFile = useRef(fileName);
  const fileStates = useRef(new Map<string, EditorState>());
  const createFileState = useRef<((document: string) => EditorState) | null>(null);
  const settings = useRef(new Compartment());
  const initial = useRef({ value, fontSize, wrapLines });
  callbacks.current = { onChange, onCompile, onCursorChange };

  useEffect(() => {
    if (!hostRef.current) return;
    const compile = () => { callbacks.current.onCompile(); return true; };
    const extensions: Extension[] = [
        lineNumbers(), highlightActiveLineGutter(), highlightActiveLine(), drawSelection(),
        history(), indentOnInput(), bracketMatching(), closeBrackets(),
        StreamLanguage.define(stex), syntaxHighlighting(latexHighlight),
        search({ top: true }), highlightSelectionMatches(),
        EditorView.contentAttributes.of({ 'aria-label': 'LaTeX source editor', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off' }),
        keymap.of([
          { key: 'Mod-Enter', run: compile }, { key: 'Mod-s', run: compile },
          { key: 'Mod-b', run: () => wrapSelection('\\textbf{', '}', 'bold text') },
          { key: 'Mod-i', run: () => wrapSelection('\\textit{', '}', 'italic text') },
          ...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !update.transactions.some((transaction) => transaction.annotation(externalChange))) {
            callbacks.current.onChange(update.state.doc.toString());
          }
          if (update.selectionSet || update.docChanged) reportCursor(update.state);
        }),
        editorTheme,
        settings.current.of([
          EditorView.theme({ '&': { fontSize: `${initial.current.fontSize}px` } }),
          ...(initial.current.wrapLines ? [EditorView.lineWrapping] : []),
        ]),
      ];
    createFileState.current = (document: string) => EditorState.create({ doc: document, extensions });
    const state = createFileState.current(initial.current.value);
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    reportCursor(state);
    const goToLine = (event: Event) => {
      const requestedLine: unknown = (event as CustomEvent<unknown>).detail;
      if (typeof requestedLine !== 'number' || !Number.isFinite(requestedLine)) return;
      const lineNumber = Math.min(view.state.doc.lines, Math.max(1, Math.floor(requestedLine)));
      const line = view.state.doc.line(lineNumber);
      view.dispatch({
        selection: { anchor: line.from, head: line.to },
        effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
      });
      view.focus();
    };
    window.addEventListener('leaf-goto-line', goToLine);
    return () => {
      window.removeEventListener('leaf-goto-line', goToLine);
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (currentFile.current !== fileName) {
      fileStates.current.set(currentFile.current, view.state);
      currentFile.current = fileName;
      const savedState = fileStates.current.get(fileName);
      if (savedState) view.setState(savedState);
      else if (createFileState.current) view.setState(createFileState.current(value));
    }
    if (view.state.doc.toString() !== value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value }, annotations: [externalChange.of(true), Transaction.addToHistory.of(false)] });
    }
    reportCursor(view.state);
  }, [fileName, value]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: settings.current.reconfigure([
      EditorView.theme({ '&': { fontSize: `${fontSize}px` } }),
      ...(wrapLines ? [EditorView.lineWrapping] : []),
    ]) });
  }, [fontSize, wrapLines, fileName]);

  function reportCursor(state: EditorState) {
    const position = state.selection.main.head;
    const line = state.doc.lineAt(position);
    callbacks.current.onCursorChange?.(line.number, position - line.from + 1);
  }

  function wrapSelection(before: string, after: string, placeholder: string) {
    const view = viewRef.current;
    if (!view) return false;
    view.dispatch(view.state.changeByRange((range) => {
      const content = view.state.sliceDoc(range.from, range.to) || placeholder;
      return {
        changes: { from: range.from, to: range.to, insert: `${before}${content}${after}` },
        range: EditorSelection.range(range.from + before.length, range.from + before.length + content.length),
      };
    }));
    view.focus();
    return true;
  }

  function run(command: (view: EditorView) => boolean) {
    const view = viewRef.current;
    if (view) { command(view); view.focus(); }
  }

  return (
    <div className="latex-editor-shell">
      <div className="latex-format-toolbar" role="toolbar" aria-label="LaTeX formatting">
        <button type="button" title="Bold (Ctrl+B)" aria-label="Bold" onMouseDown={(event) => event.preventDefault()} onClick={() => wrapSelection('\\textbf{', '}', 'bold text')}><Bold size={15} strokeWidth={2.2} /></button>
        <button type="button" title="Italic (Ctrl+I)" aria-label="Italic" onMouseDown={(event) => event.preventDefault()} onClick={() => wrapSelection('\\textit{', '}', 'italic text')}><Italic size={15} /></button>
        <button type="button" title="Insert section" aria-label="Insert section" onMouseDown={(event) => event.preventDefault()} onClick={() => wrapSelection('\\section{', '}\n', 'Section title')}><Heading2 size={17} /></button>
        <span className="latex-toolbar-divider" />
        <button type="button" title="Insert inline math" aria-label="Insert inline math" onMouseDown={(event) => event.preventDefault()} onClick={() => wrapSelection('$', '$', 'x^2')}><Sigma size={16} /></button>
        <button type="button" title="Toggle comment (Ctrl+/)" aria-label="Toggle comment" onMouseDown={(event) => event.preventDefault()} onClick={() => run(toggleComment)}><MessageSquare size={14} /></button>
        <span className="latex-toolbar-divider" />
        <button type="button" title="Undo (Ctrl+Z)" aria-label="Undo" onMouseDown={(event) => event.preventDefault()} onClick={() => run(undo)}><Undo2 size={15} /></button>
        <button type="button" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" onMouseDown={(event) => event.preventDefault()} onClick={() => run(redo)}><Redo2 size={15} /></button>
        <span className="latex-toolbar-spacer" />
        <button type="button" title="Find in source (Ctrl+F)" aria-label="Find in source" onMouseDown={(event) => event.preventDefault()} onClick={() => { if (viewRef.current) openSearchPanel(viewRef.current); }}><Search size={15} /></button>
      </div>
      <div className="latex-editor-mount" ref={hostRef} />
    </div>
  );
}

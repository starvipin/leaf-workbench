import type { Project, ProjectFile } from "./types";

export const articleSource = String.raw`\documentclass[11pt,a4paper]{article}

% A little space to think.
\usepackage[margin=1in]{geometry}
\usepackage{amsmath,amssymb}
\usepackage{graphicx}
\usepackage{xcolor}
\usepackage{hyperref}
\definecolor{forest}{HTML}{277458}
\hypersetup{colorlinks=true,linkcolor=forest,urlcolor=forest}

\title{The Art of Clear Thinking}
\author{Alex Morgan}
\date{October 2026}

\begin{document}
\maketitle

\begin{abstract}
Good ideas deserve a little room to grow. This document explores
the relationship between curiosity, careful observation, and the
simple act of putting pen to paper.
\end{abstract}

\section{Introduction}
Every great discovery begins with a question. From the smallest
observation to the most ambitious theory, the process of understanding
is one of making connections---and then making them clear.

This is your space to write, experiment, and bring ideas to life.
Edit the source on the left, then click \textbf{Recompile} to see
your changes beautifully typeset on the right.

\section{A beautiful equation}
Mathematics gives us a language for expressing ideas precisely.
One of its most elegant relationships is Euler's identity:
\begin{equation}
  e^{i\pi} + 1 = 0
\end{equation}
Five fundamental constants, connected in a single line.

\subsection{From questions to understanding}
A useful approach to any new problem is to:
\begin{enumerate}
  \item Observe carefully and question your assumptions.
  \item Break complex ideas into smaller, simpler parts.
  \item Write down what you know---and what you do not.
\end{enumerate}

\section{Looking ahead}
Clarity is not the absence of complexity. It is the thoughtful
organization of it. Keep asking questions. Keep making connections.
And, above all, keep writing.

\end{document}
`;

const blankSource = String.raw`\documentclass[11pt]{article}
\usepackage[margin=1in]{geometry}
\usepackage{amsmath}
\title{Untitled Project}
\author{Your name}
\date{\today}

\begin{document}
\maketitle

\section{Introduction}
Your next great idea starts here.

\end{document}
`;

const letterSource = String.raw`\documentclass[11pt]{letter}
\usepackage[margin=1in]{geometry}
\signature{Your name}
\address{123 Research Lane \\ Your city}
\begin{document}
\begin{letter}{The Editorial Team \\ Journal of New Ideas}
\opening{Dear Editors,}
I am pleased to submit our manuscript for your consideration.

Thank you for your time and thoughtful consideration.
\closing{Kind regards,}
\end{letter}
\end{document}
`;

export function createProject(
  name = "Untitled Project",
  template = "blank",
): Project {
  const source =
    template === "article"
      ? articleSource
      : template === "letter"
        ? letterSource
        : blankSource;
  return {
    id: crypto.randomUUID(),
    name,
    files: [{ name: "main.tex", content: source }],
    updatedAt: Date.now(),
    starred: false,
    sourceRevision: 1,
  };
}

export function initialProjects(): Project[] {
  return [
    { ...createProject("The Art of Clear Thinking", "article"), starred: true },
  ];
}

export function outlineFrom(files: ProjectFile[]) {
  const source =
    files.find((f) => f.name === "main.tex")?.content ??
    files[0]?.content ??
    "";
  return [...source.matchAll(/\\(sub)*section\*?\{([^}]+)\}/g)].map((m) => ({
    title: m[2],
    nested: !!m[1],
    line: source.slice(0, m.index).split("\n").length,
  }));
}

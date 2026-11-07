import { WorkspaceLeaf, MarkdownRenderer, Component, Notice, TFile, App } from "obsidian";
import { useEffect, useRef, useState } from "preact/hooks";
import { PreactItemView } from "./PreactItemView";
import { VIEW_LESSON } from "./viewTypes";
import { Services } from "../context";
import { LessonFrontmatter, ExerciseResult, ProgressFrontmatter } from "../types";
import { parseLessonBody, LessonSegment, ExerciseSpec } from "../data/lessonContent";
import * as paths from "../data/paths";
import { AssembledContext } from "../retrieval/context";
import { openLessonInWorkspace } from "./navigation";

interface ChatLine {
  role: "user" | "assistant";
  text: string;
  context?: AssembledContext;
  pending?: boolean;
}

const QUICK_ACTIONS = [
  "Explain this more simply",
  "Give me another example",
  "Why does this work?",
  "Quiz me on this",
  "Show a real-world example",
  "I still don't understand",
];

function MarkdownBlock({ text, app, view, sourcePath }: { text: string; app: App; view: Component; sourcePath: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.replaceChildren();
    void MarkdownRenderer.render(app, text, ref.current, sourcePath, view);
  }, [text]);
  return <div ref={ref} />;
}

function ExerciseWidget({
  spec,
  topicId,
  lessonId,
  lessonObjective,
  services,
  onResult,
}: {
  spec: ExerciseSpec;
  topicId: string;
  lessonId: string;
  lessonObjective: string;
  services: Services;
  onResult: (correct: boolean) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [grading, setGrading] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string; misconception?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  const submit = async () => {
    if (!answer.trim() || grading) return;
    setGrading(true);
    try {
      const grade = await services.tutorEngine().gradeExercise({
        exercisePrompt: spec.prompt,
        learnerAnswer: answer,
        lessonObjective,
      });
      setFeedback({ correct: grade.correct, text: grade.feedback, misconception: grade.misconception });
      setAttempt((a) => a + 1);
      const result: ExerciseResult = {
        exerciseId: spec.id,
        lessonId,
        attempt: attempt + 1,
        correct: grade.correct,
        timestamp: new Date().toISOString(),
        misconception: grade.misconception || undefined,
      };
      onResult(grade.correct);
      await recordAndSchedule(services, topicId, lessonId, result);
    } catch (e) {
      new Notice(`Couldn't grade this answer: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setGrading(false);
    }
  };

  return (
    <div className="lp-exercise">
      <div>
        <strong>Exercise:</strong> {spec.prompt}
      </div>
      {spec.type === "multiple-choice" && spec.choices ? (
        <select value={answer} onChange={(e: Event) => setAnswer((e.target as HTMLSelectElement).value)}>
          <option value="">Choose...</option>
          {spec.choices.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      ) : (
        <textarea
          value={answer}
          placeholder="Your answer..."
          onInput={(e: Event) => setAnswer((e.target as HTMLTextAreaElement).value)}
        />
      )}
      <div className="lp-row" style={{ marginTop: "8px" }}>
        <button className="lp-btn lp-btn-primary" disabled={grading || !answer.trim()} onClick={() => void submit()}>
          {grading ? "Checking..." : "Check answer"}
        </button>
        {feedback && !feedback.correct && (
          <button
            className="lp-btn"
            onClick={() => {
              setAnswer("");
              setFeedback(null);
            }}
          >
            Try again
          </button>
        )}
      </div>
      {feedback && (
        <div style={{ marginTop: "8px" }}>
          <span className={feedback.correct ? "lp-feedback-ok" : "lp-feedback-bad"}>
            {feedback.correct ? "Correct" : "Not quite"}
          </span>
          <div className="lp-muted">{feedback.text}</div>
        </div>
      )}
    </div>
  );
}

async function recordAndSchedule(services: Services, topicId: string, lessonId: string, result: ExerciseResult): Promise<void> {
  // Appends to the exercise's durable Markdown log (Exercises/<lesson>-<id>.md)
  // and decides mastery/review from the *full* cross-session history, not
  // just this one attempt -- see reviewScheduler.shouldMarkMastered.
  await services.learningService().recordExerciseOutcome(topicId, lessonId, lessonId, result);
  services.appState.bumpVersion();
}

function LessonReaderAndChat({ services, topicId, lessonId }: { services: Services; topicId: string; lessonId: string }) {
  const [frontmatter, setFrontmatter] = useState<LessonFrontmatter | null>(null);
  const [segments, setSegments] = useState<LessonSegment[] | null>(null);
  const [allLessons, setAllLessons] = useState<LessonFrontmatter[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [showInspector, setShowInspector] = useState(services.getSettings().showContextInspectorByDefault);
  const [progress, setProgress] = useState<ProgressFrontmatter | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<Component>();
  if (!viewRef.current) viewRef.current = new Component();
  useEffect(() => () => viewRef.current?.unload(), []);

  const load = async () => {
    try {
      const result = await services.learningService().openLesson(topicId, lessonId);
      setFrontmatter(result.frontmatter);
      setSegments(parseLessonBody(result.body));
      setAllLessons(await services.repo.listLessons(topicId));
      setProgress(await services.repo.getProgress(topicId));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    void load();
    setChat([]);
    const handler = () => {
      const el = contentRef.current;
      if (!el) return;
      const sel = window.getSelection();
      if (sel && sel.toString().trim() && el.contains(sel.anchorNode)) {
        setSelectedText(sel.toString().trim());
      }
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, [topicId, lessonId]);

  const send = async (message: string) => {
    if (!message.trim() || sending || !frontmatter) return;
    setSending(true);
    const controller = new AbortController();
    abortRef.current = controller;
    setChat((c) => [...c, { role: "user", text: message }, { role: "assistant", text: "", pending: true }]);
    setInput("");
    try {
      const subjectKind = (await services.repo.getTopic(topicId))?.topic.subjectKind ?? "other";
      const result = await services.tutorEngine().ask(
        message,
        {
          topicId,
          lessonId,
          lessonTitle: frontmatter.title,
          objective: frontmatter.objective,
          moduleId: frontmatter.moduleId,
          selectedText: selectedText || undefined,
        },
        subjectKind,
        progress,
        (delta) => {
          setChat((c) => {
            const next = [...c];
            const last = next[next.length - 1];
            if (last && last.role === "assistant") next[next.length - 1] = { ...last, text: last.text + delta };
            return next;
          });
        },
        controller.signal
      );
      setChat((c) => {
        const next = [...c];
        const last = next[next.length - 1];
        if (last && last.role === "assistant") {
          next[next.length - 1] = { role: "assistant", text: result.aborted ? `${last.text}\n\n_(stopped)_` : result.text, context: result.context };
        }
        return next;
      });
      setSelectedText("");
    } catch (e) {
      setChat((c) => {
        const next = [...c];
        next[next.length - 1] = { role: "assistant", text: `Error: ${e instanceof Error ? e.message : String(e)}` };
        return next;
      });
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  const retry = () => {
    const lastUser = [...chat].reverse().find((m) => m.role === "user");
    if (lastUser) void send(lastUser.text);
  };

  if (loadError) return <div className="lp-view lp-error-banner">Couldn't open this lesson: {loadError}</div>;
  if (!frontmatter || !segments) return <div className="lp-view lp-muted">Loading lesson...</div>;

  const idx = allLessons.findIndex((l) => l.id === lessonId);
  const prev = idx > 0 ? allLessons[idx - 1] : null;
  const next = idx >= 0 && idx < allLessons.length - 1 ? allLessons[idx + 1] : null;

  return (
    <div className="lp-lesson-layout">
      <div className="lp-lesson-main" ref={contentRef}>
        <div className="lp-row-between">
          <h1 className="lp-h1">{frontmatter.title}</h1>
          <span className={`lp-badge lp-badge-${frontmatter.status}`}>{frontmatter.status}</span>
        </div>
        <div className="lp-muted">{frontmatter.objective}</div>

        <div className="lp-toolbar" style={{ marginTop: "10px" }}>
          <button
            className="lp-btn"
            onClick={() => {
              const file = services.app.vault.getAbstractFileByPath(paths.lessonPath(topicId, lessonId));
              if (file instanceof TFile) void services.app.workspace.getLeaf("tab").openFile(file);
            }}
          >
            Open Markdown Source
          </button>
        </div>

        {segments.map((seg, i) =>
          seg.kind === "markdown" ? (
            <MarkdownBlock key={i} text={seg.text} app={services.app} view={viewRef.current!} sourcePath={paths.lessonPath(topicId, lessonId)} />
          ) : (
            <ExerciseWidget
              key={i}
              spec={seg.spec}
              topicId={topicId}
              lessonId={lessonId}
              lessonObjective={frontmatter.objective}
              services={services}
              onResult={() => void load()}
            />
          )
        )}

        <div className="lp-toolbar" style={{ marginTop: "20px" }}>
          <button
            className="lp-btn lp-btn-primary"
            onClick={async () => {
              await services.learningService().completeLesson(topicId, lessonId);
              services.appState.bumpVersion();
              new Notice("Marked as understood.");
              void load();
            }}
          >
            Mark Understood
          </button>
          <button
            className="lp-btn"
            onClick={async () => {
              await services.repo.setLessonStatus(topicId, lessonId, "review-needed");
              await services.repo.recordLessonStatus(topicId, lessonId, "review-needed");
              services.appState.bumpVersion();
              new Notice("Flagged for more practice -- it'll show up as Review Needed.");
              void load();
            }}
          >
            Need More Practice
          </button>
        </div>

        <div className="lp-row-between" style={{ marginTop: "16px" }}>
          <button className="lp-btn" disabled={!prev} onClick={() => prev && void openLessonInWorkspace(services, topicId, prev.id)}>
            ← {prev?.title ?? "Previous"}
          </button>
          <button className="lp-btn" disabled={!next} onClick={() => next && void openLessonInWorkspace(services, topicId, next.id)}>
            {next?.title ?? "Next"} →
          </button>
        </div>
      </div>

      <div className="lp-lesson-chat">
        <div className="lp-row-between" style={{ padding: "8px 12px" }}>
          <strong>AI Teacher</strong>
          <button className="lp-btn" onClick={() => setShowInspector((v) => !v)}>
            {showInspector ? "Hide" : "Show"} Context
          </button>
        </div>
        {selectedText && (
          <div className="lp-muted" style={{ padding: "0 12px 8px 12px" }}>
            Selected: "{selectedText.slice(0, 80)}{selectedText.length > 80 ? "..." : ""}"{" "}
            <button className="lp-btn" onClick={() => setSelectedText("")}>
              Clear
            </button>
          </div>
        )}
        <div className="lp-chat-messages">
          {chat.length === 0 && <div className="lp-muted">Ask about this lesson, or try a quick action below.</div>}
          {chat.map((m, i) => (
            <div key={i} className={`lp-chat-msg ${m.role}`}>
              <div className="lp-chat-bubble">{m.pending && !m.text ? "..." : m.text}</div>
              {showInspector && m.context && (
                <div className="lp-inspector">
                  <div>Intent: {m.context.intent} · ~{m.context.totalTokens}/{m.context.budget} tokens</div>
                  {m.context.items.map((it, j) => (
                    <div key={j} className="lp-inspector-item">
                      [{it.priorityTier}] {it.source} ({it.estTokens}t) — {it.reason}
                    </div>
                  ))}
                  {m.context.dropped.map((d, j) => (
                    <div key={j} className="lp-inspector-item lp-muted">
                      dropped: {d.source} ({d.reason})
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="lp-chat-quick-actions">
          {QUICK_ACTIONS.map((a) => (
            <button key={a} className="lp-btn" disabled={sending} onClick={() => void send(a)}>
              {a}
            </button>
          ))}
        </div>
        <div className="lp-chat-input-row">
          <textarea
            value={input}
            placeholder="Ask the AI teacher..."
            onInput={(e: Event) => setInput((e.target as HTMLTextAreaElement).value)}
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
          />
          {sending ? (
            <button className="lp-btn" onClick={stop}>
              Stop
            </button>
          ) : (
            <>
              <button className="lp-btn lp-btn-primary" onClick={() => void send(input)}>
                Send
              </button>
              {chat.some((m) => m.role === "assistant" && m.text.startsWith("Error:")) && (
                <button className="lp-btn" onClick={retry}>
                  Retry
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export class LessonView extends PreactItemView {
  constructor(leaf: WorkspaceLeaf, private services: Services) {
    super(leaf);
  }
  getViewType(): string {
    return VIEW_LESSON;
  }
  getDisplayText(): string {
    const s = this.services.appState.get();
    return s.activeLessonId ? `Lesson: ${s.activeLessonId}` : "Lesson";
  }
  getIcon(): string {
    return "book-open";
  }
  component() {
    const s = this.services.appState.get();
    if (!s.activeTopicId || !s.activeLessonId) {
      return <div className="lp-view lp-empty">No lesson selected.</div>;
    }
    return <LessonReaderAndChat services={this.services} topicId={s.activeTopicId} lessonId={s.activeLessonId} />;
  }
  async onOpen(): Promise<void> {
    await super.onOpen();
    this.register(this.services.appState.subscribe(() => this.rerender()));
  }
}

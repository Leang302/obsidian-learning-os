import { WorkspaceLeaf } from "obsidian";
import { useEffect, useState } from "preact/hooks";
import { PreactItemView } from "./PreactItemView";
import { VIEW_ROADMAP } from "./viewTypes";
import { Services } from "../context";
import { RoadmapFrontmatter, LessonFrontmatter, LessonStatus, TopicFrontmatter } from "../types";
import { openLessonInWorkspace, openProgressView } from "./navigation";

const STATUS_LABEL: Record<LessonStatus, string> = {
  "not-started": "Not Started",
  "in-progress": "In Progress",
  completed: "Completed",
  "review-needed": "Review Needed",
  mastered: "Mastered",
};

function Badge({ status, locked }: { status: LessonStatus; locked?: boolean }) {
  const cls = locked ? "lp-badge lp-badge-locked" : `lp-badge lp-badge-${status}`;
  return <span className={cls}>{locked ? "Locked" : STATUS_LABEL[status]}</span>;
}

function Roadmap({ services }: { services: Services }) {
  const [topicId, setTopicId] = useState<string | null>(services.appState.get().activeTopicId);
  const [topic, setTopic] = useState<TopicFrontmatter | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapFrontmatter | null>(null);
  const [lessons, setLessons] = useState<LessonFrontmatter[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = async (id: string) => {
    try {
      const bundle = await services.repo.getTopic(id);
      const rm = await services.repo.getRoadmap(id);
      const ls = await services.repo.listLessons(id);
      setTopic(bundle?.topic ?? null);
      setRoadmap(rm);
      setLessons(ls);
      setError(null);
      if (rm?.modules.length) setExpanded(new Set([rm.modules.find((m) => m.status !== "completed" && m.status !== "mastered")?.id ?? rm.modules[0].id]));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    const unsub = services.appState.subscribe((s) => {
      setTopicId(s.activeTopicId);
      if (s.activeTopicId) void load(s.activeTopicId);
    });
    if (topicId) void load(topicId);
    return unsub;
  }, []);

  if (!topicId) return <div className="lp-view lp-empty">No topic selected. Open one from the Dashboard.</div>;
  if (error) return <div className="lp-view lp-error-banner">Couldn't load this roadmap: {error}</div>;
  if (!topic || !roadmap) return <div className="lp-view lp-muted">Loading...</div>;

  const doneOrMastered = new Set(lessons.filter((l) => l.status === "completed" || l.status === "mastered").map((l) => l.id));
  const moduleDoneOrMastered = new Set(roadmap.modules.filter((m) => m.status === "completed" || m.status === "mastered").map((m) => m.id));

  return (
    <div className="lp-view">
      <div className="lp-row-between">
        <h1 className="lp-h1">{topic.title}</h1>
        <button className="lp-btn" onClick={() => openProgressView(services, topicId)}>
          View Progress
        </button>
      </div>
      <div className="lp-muted">Goal: {topic.goal} · Level: {topic.level}</div>

      {roadmap.modules.map((mod) => {
        const moduleLessons = lessons.filter((l) => l.moduleId === mod.id);
        const locked = (mod.prerequisites ?? []).some((p) => !moduleDoneOrMastered.has(p));
        const isOpen = expanded.has(mod.id);
        return (
          <div className="lp-module" key={mod.id}>
            <div
              className="lp-module-header"
              onClick={() => {
                const next = new Set(expanded);
                if (next.has(mod.id)) next.delete(mod.id);
                else next.add(mod.id);
                setExpanded(next);
              }}
            >
              <div>
                <strong>{mod.title}</strong>
                <span className="lp-muted"> · {moduleLessons.length} lessons{mod.estMinutes ? ` · ~${mod.estMinutes}min` : ""}</span>
              </div>
              <Badge status={mod.status} locked={locked} />
            </div>
            {isOpen && (
              <div className="lp-module-lessons">
                {moduleLessons.map((lesson) => {
                  const lessonLocked = locked || (lesson.prerequisites ?? []).some((p) => !doneOrMastered.has(p));
                  return (
                    <div
                      key={lesson.id}
                      className={`lp-lesson-row ${lessonLocked ? "locked" : ""}`}
                      onClick={() => !lessonLocked && topicId && void openLessonInWorkspace(services, topicId, lesson.id)}
                    >
                      <span>{lesson.title}{lesson.estMinutes ? <span className="lp-muted"> · ~{lesson.estMinutes}min</span> : null}</span>
                      <Badge status={lesson.status} locked={lessonLocked} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export class RoadmapView extends PreactItemView {
  constructor(leaf: WorkspaceLeaf, private services: Services) {
    super(leaf);
  }
  getViewType(): string {
    return VIEW_ROADMAP;
  }
  getDisplayText(): string {
    return "Learning Roadmap";
  }
  getIcon(): string {
    return "map";
  }
  component() {
    return <Roadmap services={this.services} />;
  }
}

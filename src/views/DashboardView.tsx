import { WorkspaceLeaf } from "obsidian";
import { useEffect, useState } from "preact/hooks";
import { PreactItemView } from "./PreactItemView";
import { VIEW_DASHBOARD } from "./viewTypes";
import { Services } from "../context";
import { TopicFrontmatter, ProgressFrontmatter, LessonFrontmatter, RecommendedNext } from "../types";
import { openLessonInWorkspace, openRoadmapInWorkspace, openStartTopicModal } from "./navigation";

interface TopicSummary {
  topic: TopicFrontmatter;
  progress: ProgressFrontmatter | null;
  lessons: LessonFrontmatter[];
  next: RecommendedNext | null;
}

function pctComplete(lessons: LessonFrontmatter[]): number {
  if (!lessons.length) return 0;
  const done = lessons.filter((l) => l.status === "completed" || l.status === "mastered").length;
  return Math.round((done / lessons.length) * 100);
}

function Dashboard({ services }: { services: Services }) {
  const [summaries, setSummaries] = useState<TopicSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const ids = await services.repo.listTopicIds();
      const result: TopicSummary[] = [];
      for (const id of ids) {
        const bundle = await services.repo.getTopic(id);
        if (!bundle) continue;
        const progress = await services.repo.getProgress(id);
        const lessons = await services.repo.listLessons(id);
        const next = await services.learningService().recommendNext(id).catch(() => null);
        result.push({ topic: bundle.topic, progress, lessons, next });
      }
      setSummaries(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    void load();
    return services.appState.subscribe(() => void load());
  }, []);

  if (error) return <div className="lp-error-banner">Couldn't load the dashboard: {error}</div>;
  if (summaries === null) return <div className="lp-muted">Loading...</div>;

  const activeTopics = summaries.filter((s) => s.topic.status === "active");
  const weakTopics = activeTopics.filter((s) => (s.progress?.weakConcepts.length ?? 0) > 0);
  const mostRecent = [...activeTopics].sort((a, b) => b.topic.updatedAt.localeCompare(a.topic.updatedAt))[0];

  return (
    <div className="lp-view">
      <div className="lp-row-between">
        <h1 className="lp-h1">Learning Dashboard</h1>
        <button className="lp-btn lp-btn-primary" onClick={() => openStartTopicModal(services)}>
          + Start New Topic
        </button>
      </div>

      {activeTopics.length === 0 && (
        <div className="lp-empty">
          <p>No active learning topics yet.</p>
          <button className="lp-btn lp-btn-primary" onClick={() => openStartTopicModal(services)}>
            Start your first topic
          </button>
        </div>
      )}

      {mostRecent && (
        <div className="lp-card" style={{ borderColor: "var(--interactive-accent)" }} onClick={() => continueLearning(services, mostRecent)}>
          <div className="lp-row-between">
            <span className="lp-card-title">Continue Learning: {mostRecent.topic.title}</span>
            <button className="lp-btn lp-btn-primary" onClick={(e: Event) => { e.stopPropagation(); void continueLearning(services, mostRecent); }}>
              Continue
            </button>
          </div>
          <div className="lp-muted">{mostRecent.next ? mostRecent.next.reason : "All caught up for now."}</div>
        </div>
      )}

      {activeTopics.length > 0 && (
        <>
          <h2 className="lp-h2">Active topics</h2>
          {activeTopics.map((s) => (
            <div key={s.topic.id} className="lp-card" onClick={() => openRoadmapInWorkspace(services, s.topic.id)}>
              <div className="lp-row-between">
                <span className="lp-card-title">{s.topic.title}</span>
                <span className="lp-muted">{pctComplete(s.lessons)}%</span>
              </div>
              <div className="lp-muted">Level: {s.topic.level} · {s.lessons.length} lessons</div>
              <div className="lp-progress-bar">
                <div className="lp-progress-fill" style={{ width: `${pctComplete(s.lessons)}%` }} />
              </div>
            </div>
          ))}
        </>
      )}

      {weakTopics.length > 0 && (
        <>
          <h2 className="lp-h2">Weak areas needing review</h2>
          {weakTopics.map((s) => (
            <div key={s.topic.id} className="lp-card" onClick={() => openRoadmapInWorkspace(services, s.topic.id)}>
              <div className="lp-card-title">{s.topic.title}</div>
              <div className="lp-muted">{s.progress?.weakConcepts.join(", ")}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

async function continueLearning(services: Services, summary: TopicSummary): Promise<void> {
  const next = summary.next ?? (await services.learningService().recommendNext(summary.topic.id));
  if (next) {
    await openLessonInWorkspace(services, next.topicId, next.lessonId);
  } else {
    await openRoadmapInWorkspace(services, summary.topic.id);
  }
}

export class DashboardView extends PreactItemView {
  constructor(leaf: WorkspaceLeaf, private services: Services) {
    super(leaf);
  }
  getViewType(): string {
    return VIEW_DASHBOARD;
  }
  getDisplayText(): string {
    return "Learning Dashboard";
  }
  getIcon(): string {
    return "graduation-cap";
  }
  component() {
    return <Dashboard services={this.services} />;
  }
}

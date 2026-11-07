import { WorkspaceLeaf } from "obsidian";
import { useEffect, useState } from "preact/hooks";
import { PreactItemView } from "./PreactItemView";
import { VIEW_PROGRESS } from "./viewTypes";
import { Services } from "../context";
import { TopicFrontmatter, ProgressFrontmatter, LessonFrontmatter } from "../types";
import { openLessonInWorkspace, openRoadmapInWorkspace } from "./navigation";

interface TopicProgress {
  topic: TopicFrontmatter;
  progress: ProgressFrontmatter | null;
  lessons: LessonFrontmatter[];
}

function Progress({ services }: { services: Services }) {
  const [selected, setSelected] = useState<string | null>(services.appState.get().activeTopicId);
  const [data, setData] = useState<TopicProgress[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const ids = await services.repo.listTopicIds();
      const out: TopicProgress[] = [];
      for (const id of ids) {
        const bundle = await services.repo.getTopic(id);
        if (!bundle) continue;
        out.push({ topic: bundle.topic, progress: await services.repo.getProgress(id), lessons: await services.repo.listLessons(id) });
      }
      setData(out);
      if (!selected && out.length) setSelected(out[0].topic.id);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    void load();
    return services.appState.subscribe((s) => {
      if (s.activeTopicId) setSelected(s.activeTopicId);
    });
  }, []);

  if (error) return <div className="lp-view lp-error-banner">{error}</div>;
  if (data === null) return <div className="lp-view lp-muted">Loading...</div>;
  if (!data.length) return <div className="lp-view lp-empty">No topics yet.</div>;

  const current = data.find((d) => d.topic.id === selected) ?? data[0];
  const completed = current.lessons.filter((l) => l.status === "completed");
  const mastered = current.lessons.filter((l) => l.status === "mastered");
  const reviewNeeded = current.lessons.filter((l) => l.status === "review-needed");
  const upcoming = current.lessons.filter((l) => l.status === "not-started").slice(0, 5);

  return (
    <div className="lp-view">
      <h1 className="lp-h1">Progress & Review</h1>
      <div className="lp-toolbar">
        {data.map((d) => (
          <button
            key={d.topic.id}
            className={d.topic.id === current.topic.id ? "lp-btn lp-btn-primary" : "lp-btn"}
            onClick={() => setSelected(d.topic.id)}
          >
            {d.topic.title}
          </button>
        ))}
      </div>

      <h2 className="lp-h2">Completion</h2>
      <div className="lp-card" style={{ cursor: "default" }}>
        <div>{current.lessons.length} lessons · {completed.length} completed · {mastered.length} mastered</div>
        <div className="lp-progress-bar">
          <div
            className="lp-progress-fill"
            style={{ width: `${current.lessons.length ? Math.round(((completed.length + mastered.length) / current.lessons.length) * 100) : 0}%` }}
          />
        </div>
      </div>

      <h2 className="lp-h2">Mastered concepts</h2>
      {current.progress?.masteredConcepts.length ? (
        <div className="lp-row" style={{ flexWrap: "wrap" }}>
          {current.progress.masteredConcepts.map((c) => (
            <span key={c} className="lp-badge lp-badge-mastered">
              {c}
            </span>
          ))}
        </div>
      ) : (
        <div className="lp-muted">None yet.</div>
      )}

      <h2 className="lp-h2">Weak concepts / review needed</h2>
      {reviewNeeded.length || current.progress?.weakConcepts.length ? (
        <>
          {reviewNeeded.map((l) => (
            <div key={l.id} className="lp-card" onClick={() => void openLessonInWorkspace(services, current.topic.id, l.id)}>
              <div className="lp-card-title">{l.title}</div>
              <div className="lp-muted">Flagged review-needed after a recent exercise miss.</div>
            </div>
          ))}
          {current.progress?.weakConcepts
            .filter((c) => !reviewNeeded.some((l) => l.id === c))
            .map((c) => (
              <div key={c} className="lp-card" style={{ cursor: "default" }}>
                <span className="lp-badge lp-badge-review-needed">{c}</span>
              </div>
            ))}
        </>
      ) : (
        <div className="lp-muted">No weak areas flagged right now.</div>
      )}

      <h2 className="lp-h2">Upcoming lessons</h2>
      {upcoming.length ? (
        upcoming.map((l) => (
          <div key={l.id} className="lp-card" onClick={() => void openLessonInWorkspace(services, current.topic.id, l.id)}>
            <div className="lp-card-title">{l.title}</div>
            <div className="lp-muted">{l.objective}</div>
          </div>
        ))
      ) : (
        <div className="lp-muted">Nothing left in this topic, or everything remaining is locked behind prerequisites.</div>
      )}

      <div className="lp-toolbar" style={{ marginTop: "16px" }}>
        <button className="lp-btn" onClick={() => void openRoadmapInWorkspace(services, current.topic.id)}>
          View Roadmap
        </button>
      </div>
    </div>
  );
}

export class ProgressView extends PreactItemView {
  constructor(leaf: WorkspaceLeaf, private services: Services) {
    super(leaf);
  }
  getViewType(): string {
    return VIEW_PROGRESS;
  }
  getDisplayText(): string {
    return "Progress & Review";
  }
  getIcon(): string {
    return "bar-chart-2";
  }
  component() {
    return <Progress services={this.services} />;
  }
}

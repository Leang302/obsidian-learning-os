/** Minimal shared state + pub/sub so separate Obsidian workspace leaves
 * (Dashboard, Roadmap, Lesson, Progress) can stay in sync on "what topic
 * / lesson is active" without a heavier state library. */
export interface NavState {
  activeTopicId: string | null;
  activeLessonId: string | null;
}

type Listener = (s: NavState) => void;

export class AppState {
  private state: NavState = { activeTopicId: null, activeLessonId: null };
  private listeners = new Set<Listener>();
  /** Bumped whenever vault content under LearningOS/ changes, so views can
   * cheaply decide "do I need to re-read from disk" without each view
   * wiring its own vault listener. */
  private _version = 0;

  get(): NavState {
    return this.state;
  }

  get version(): number {
    return this._version;
  }

  setActiveLesson(topicId: string, lessonId: string): void {
    this.state = { activeTopicId: topicId, activeLessonId: lessonId };
    this.notify();
  }

  setActiveTopic(topicId: string | null): void {
    this.state = { activeTopicId: topicId, activeLessonId: null };
    this.notify();
  }

  bumpVersion(): void {
    this._version++;
    this.notify();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const l of this.listeners) l(this.state);
  }
}

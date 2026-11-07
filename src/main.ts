import { Plugin, WorkspaceLeaf } from "obsidian";
import { Services } from "./context";
import { DEFAULT_SETTINGS, LearningOSSettings, LearningOSSettingTab } from "./settings";
import { VIEW_DASHBOARD, VIEW_ROADMAP, VIEW_LESSON, VIEW_PROGRESS } from "./views/viewTypes";
import { DashboardView } from "./views/DashboardView";
import { RoadmapView } from "./views/RoadmapView";
import { LessonView } from "./views/LessonView";
import { ProgressView } from "./views/ProgressView";
import { openDashboard, openStartTopicModal } from "./views/navigation";

export default class LearningOSPlugin extends Plugin {
  settings: LearningOSSettings = DEFAULT_SETTINGS;
  services!: Services;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.services = new Services(this.app, () => this.settings);

    this.registerView(VIEW_DASHBOARD, (leaf: WorkspaceLeaf) => new DashboardView(leaf, this.services));
    this.registerView(VIEW_ROADMAP, (leaf: WorkspaceLeaf) => new RoadmapView(leaf, this.services));
    this.registerView(VIEW_LESSON, (leaf: WorkspaceLeaf) => new LessonView(leaf, this.services));
    this.registerView(VIEW_PROGRESS, (leaf: WorkspaceLeaf) => new ProgressView(leaf, this.services));

    this.addRibbonIcon("graduation-cap", "Learning OS", () => void openDashboard(this.services));

    this.addCommand({
      id: "open-dashboard",
      name: "Open Learning Dashboard",
      callback: () => void openDashboard(this.services),
    });
    this.addCommand({
      id: "start-new-topic",
      name: "Start New Topic",
      callback: () => openStartTopicModal(this.services),
    });

    this.addSettingTab(new LearningOSSettingTab(this.app, this));

    // Build the retrieval index once the vault is ready, then keep it
    // updated incrementally as LearningOS/ files change -- never a full
    // vault scan, and never re-indexing everything on each change.
    this.app.workspace.onLayoutReady(() => {
      void this.services.indexer.buildInitial().then(() => this.services.indexer.watch());
    });
  }

  onunload(): void {
    this.services?.indexer.stopWatching();
  }

  async loadSettings(): Promise<void> {
    const data = (await this.loadData()) as Partial<LearningOSSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...data };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}

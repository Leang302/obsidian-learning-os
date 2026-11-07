import { Modal, Notice, Setting } from "obsidian";
import { Services } from "../context";
import { slugify } from "../data/paths";
import { SubjectKind } from "../types";
import { openRoadmapInWorkspace } from "./navigation";

/** "Start a new topic" flow (spec section 3). Asks only the essentials
 * that can't be inferred: the goal, a rough subject kind (so the tutor
 * can adapt its teaching style), and current level. Checks for an
 * existing topic with the same goal first rather than silently creating
 * a duplicate curriculum. */
export class StartTopicModal extends Modal {
  private goal = "";
  private subjectKind: SubjectKind = "other";
  private level = "complete beginner";

  constructor(private services: Services) {
    super(services.app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Start a new topic" });

    if (!this.services.hasApiKey()) {
      contentEl.createEl("p", {
        text: "No AI provider API key is configured yet. Set one in Settings → Learning OS before starting a topic.",
        cls: "lp-error-banner",
      });
      return;
    }

    new Setting(contentEl).setName("What do you want to learn?").addText((t) =>
      t.setPlaceholder("e.g. System Design, Korean, Linear Algebra").onChange((v) => (this.goal = v))
    );

    new Setting(contentEl).setName("What kind of subject is this?").addDropdown((d) =>
      d
        .addOptions({ language: "Language learning", programming: "Programming", math: "Mathematics", other: "Other" })
        .setValue(this.subjectKind)
        .onChange((v) => (this.subjectKind = v as SubjectKind))
    );

    new Setting(contentEl).setName("Your current level").addDropdown((d) =>
      d
        .addOptions({
          "complete beginner": "Complete beginner",
          "some familiarity": "Some familiarity",
          intermediate: "Intermediate",
          advanced: "Advanced, looking to go deeper",
        })
        .setValue(this.level)
        .onChange((v) => (this.level = v))
    );

    new Setting(contentEl).addButton((b) =>
      b
        .setButtonText("Create roadmap")
        .setCta()
        .onClick(() => void this.submit())
    );
  }

  private async submit(): Promise<void> {
    const goal = this.goal.trim();
    if (!goal) {
      new Notice("Enter what you want to learn first.");
      return;
    }
    const candidateId = slugify(goal);
    const existingIds = new Set(await this.services.repo.listTopicIds());
    if (existingIds.has(candidateId)) {
      new Notice(`You already have a topic that looks like "${goal}" -- opening it instead of creating a duplicate.`);
      this.close();
      await openRoadmapInWorkspace(this.services, candidateId);
      return;
    }

    new Notice("Generating your curriculum...");
    try {
      const topic = await this.services.learningService().startTopic({ goal, subjectKind: this.subjectKind, priorLevel: this.level });
      this.services.appState.bumpVersion();
      new Notice(`Roadmap created for "${topic.title}".`);
      this.close();
      await openRoadmapInWorkspace(this.services, topic.id);
    } catch (e) {
      new Notice(`Couldn't create the roadmap: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

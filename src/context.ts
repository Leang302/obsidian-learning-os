import { App } from "obsidian";
import { Repository } from "./data/repository";
import { VaultStore } from "./data/vaultStore";
import { Indexer } from "./retrieval/indexer";
import { ConversationManager } from "./ai/conversationManager";
import { AppState } from "./state";
import { LearningOSSettings } from "./settings";
import { AIProvider } from "./ai/provider";
import { createProvider } from "./ai/registry";
import { LearningService } from "./curriculum/learningService";
import { TutorEngine } from "./curriculum/tutor";

/** Everything a view needs, bundled once in main.ts and handed to every
 * ItemView/modal. Avoids each view reaching into globals or re-wiring its
 * own copies of the repository/indexer/etc. */
export class Services {
  readonly store: VaultStore;
  readonly repo: Repository;
  readonly indexer: Indexer;
  readonly conversations: ConversationManager;
  readonly appState: AppState;

  constructor(public app: App, public getSettings: () => LearningOSSettings) {
    this.store = new VaultStore(app);
    this.repo = new Repository(this.store);
    this.indexer = new Indexer(this.store);
    this.conversations = new ConversationManager();
    this.appState = new AppState();
  }

  provider(): AIProvider {
    const s = this.getSettings();
    return createProvider(s.providerId, s.openaiBaseUrl);
  }

  apiKey(): string {
    const s = this.getSettings();
    return s.apiKeys[s.providerId] ?? "";
  }

  model(): string {
    const s = this.getSettings();
    return s.model[s.providerId] ?? this.provider().defaultModel;
  }

  hasApiKey(): boolean {
    return this.apiKey().trim().length > 0;
  }

  learningService(): LearningService {
    return new LearningService(this.repo, this.store, this.provider(), this.apiKey(), this.model());
  }

  tutorEngine(): TutorEngine {
    const s = this.getSettings();
    return new TutorEngine(this.provider(), this.apiKey(), this.model(), this.indexer, this.conversations, s.contextTokenBudget);
  }
}

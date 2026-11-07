import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import type LearningOSPlugin from "./main";
import { ProviderId, AVAILABLE_PROVIDERS, createProvider } from "./ai/registry";

export interface LearningOSSettings {
  providerId: ProviderId;
  apiKeys: Record<ProviderId, string>;
  model: Record<ProviderId, string>;
  openaiBaseUrl: string;
  /** Max tokens of retrieved context sent per AI request. Smaller = cheaper,
   * larger = richer context. See reference/security-performance tradeoffs
   * in docs/factory for rationale. */
  contextTokenBudget: number;
  showContextInspectorByDefault: boolean;
  /** Pricing (USD per 1M tokens) for optional cost estimation. User-editable
   * since prices change and we never want to silently assume a stale rate. */
  pricing: Record<ProviderId, { inputPer1M: number; outputPer1M: number }>;
}

export const DEFAULT_SETTINGS: LearningOSSettings = {
  providerId: "anthropic",
  apiKeys: { anthropic: "", "openai-compatible": "" },
  model: { anthropic: "claude-sonnet-4-5", "openai-compatible": "gpt-5.1" },
  openaiBaseUrl: "https://api.openai.com/v1",
  contextTokenBudget: 6000,
  showContextInspectorByDefault: false,
  pricing: {
    anthropic: { inputPer1M: 3, outputPer1M: 15 },
    "openai-compatible": { inputPer1M: 2.5, outputPer1M: 10 },
  },
};

export class LearningOSSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: LearningOSPlugin) {
    super(app, plugin);
  }

  display(): void {
    this.display_();
  }

  // Obsidian calls `display`; kept as a private impl to make testing the
  // logic (none here, it's pure UI wiring) straightforward if ever needed.
  private display_(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Learning OS" });

    containerEl.createEl("p", {
      text:
        "API keys are stored locally in this vault's plugin data (data.json), in plain text. " +
        "This is the only persistence mechanism available to an Obsidian plugin -- it is not an " +
        "OS keychain or secrets vault. Anyone with file access to this vault can read it.",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("AI provider")
      .setDesc("Which backend the AI Teacher uses.")
      .addDropdown((d) => {
        for (const p of AVAILABLE_PROVIDERS) d.addOption(p.id, p.label);
        d.setValue(this.plugin.settings.providerId);
        d.onChange(async (v) => {
          this.plugin.settings.providerId = v as ProviderId;
          await this.plugin.saveSettings();
          this.display_();
        });
      });

    const providerId = this.plugin.settings.providerId;

    new Setting(containerEl)
      .setName(`${providerId} API key`)
      .addText((t) => {
        t.inputEl.type = "password";
        t.setValue(this.plugin.settings.apiKeys[providerId] ?? "");
        t.onChange(async (v) => {
          this.plugin.settings.apiKeys[providerId] = v;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Model")
      .addText((t) => {
        t.setValue(this.plugin.settings.model[providerId] ?? "");
        t.onChange(async (v) => {
          this.plugin.settings.model[providerId] = v;
          await this.plugin.saveSettings();
        });
      });

    if (providerId === "openai-compatible") {
      new Setting(containerEl)
        .setName("Base URL")
        .setDesc("OpenAI's API, or any OpenAI-compatible endpoint.")
        .addText((t) => {
          t.setValue(this.plugin.settings.openaiBaseUrl);
          t.onChange(async (v) => {
            this.plugin.settings.openaiBaseUrl = v;
            await this.plugin.saveSettings();
          });
        });
    }

    new Setting(containerEl)
      .setName("Context token budget")
      .setDesc("Maximum tokens of retrieved context assembled per AI request.")
      .addText((t) => {
        t.setValue(String(this.plugin.settings.contextTokenBudget));
        t.onChange(async (v) => {
          const n = parseInt(v, 10);
          if (!Number.isNaN(n) && n > 0) {
            this.plugin.settings.contextTokenBudget = n;
            await this.plugin.saveSettings();
          }
        });
      });

    new Setting(containerEl)
      .setName("Show AI Context Inspector by default")
      .setDesc("Reveal exactly what was retrieved and sent before each AI call.")
      .addToggle((t) => {
        t.setValue(this.plugin.settings.showContextInspectorByDefault);
        t.onChange(async (v) => {
          this.plugin.settings.showContextInspectorByDefault = v;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl).addButton((b) =>
      b.setButtonText("Test connection").onClick(async () => {
        const settings = this.plugin.settings;
        const provider = createProvider(settings.providerId, settings.openaiBaseUrl);
        const apiKey = settings.apiKeys[settings.providerId];
        if (!apiKey) {
          new Notice("Enter an API key first.");
          return;
        }
        new Notice("Testing...");
        try {
          const res = await provider.complete(
            { model: settings.model[settings.providerId], messages: [{ role: "user", content: "Say OK." }], maxTokens: 10 },
            apiKey
          );
          new Notice(`Connection OK: "${res.text.trim().slice(0, 40)}"`);
        } catch (e) {
          new Notice(`Connection failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      })
    );
  }
}

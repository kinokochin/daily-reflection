import {
  App,
  Plugin,
  PluginSettingTab,
  Setting,
  Notice,
  TFile,
  moment,
  Modal,
  TextAreaComponent,
  TextComponent,
  DropdownComponent,
  ButtonComponent
} from 'obsidian';

/** ---------- settings interface ---------- */
interface Question {
  id: string;              // internal key
  label: string;           // what the user sees
  type: 'text' | 'number' | 'dropdown';
  choices?: string[];      // for dropdown
}

interface ReflectionSettings {
  dailyFolder: string;
  questions: Question[];
}

const DEFAULT_SETTINGS: ReflectionSettings = {
  dailyFolder: "Daily",
  questions: [
    { id: "todo",        label: "✅ What I want to accomplish today",            type: "text" },
    { id: "yesterday",   label: "☑️ Reflections on yesterday’s to-do list & accomplishments", type: "text" },
    { id: "dreams",      label: "😴 Dreams",                                    type: "text" },
    { id: "sleepHours",  label: "🛌 Hours of sleep",                             type: "dropdown", choices: ["4","5","6","7","8","9","10","11","12"] },
    { id: "sleepLowest", label: "Lowest heart rate",                            type: "number" },
    { id: "sleepAvg",    label: "Average heart rate",                           type: "number" },
    { id: "hrv",         label: "HRV",                                           type: "number" },
    { id: "sleepPattern",label: "Sleep pattern",                                type: "dropdown", choices: ["Deep","Interrupted","REM rich","🤷‍♂️"] },
    { id: "food",        label: "🍏 Food",                                       type: "text" },
    { id: "energy",      label: "⚡️ Energy level",                             type: "dropdown", choices: ["High","Medium","Low"] },
    { id: "myday",       label: "📆 My Day",                                     type: "text" },
    { id: "sad",         label: "😔 What am I sad about?",                       type: "dropdown", choices: ["Nothing","Work","Relationships","Health","Other…"] },
    { id: "body",        label: "❤️‍🩹 What does my body want?",                   type: "dropdown", choices: ["Rest","Exercise","Stretch","Hydrate","Healthy food","Other…"] },
    { id: "media",       label: "🎦 Books / Podcasts / Media Reflection",        type: "text" },
    { id: "gratitude",   label: "🙏 What am I grateful for?",                   type: "text" },
    { id: "triggers",    label: "❌ Triggers / Failures",                         type: "text" }
  ]
};

/** ---------- the plugin class ---------- */
export default class DailyReflectionPlugin extends Plugin {
  settings: ReflectionSettings;

  async onload() {
    await this.loadSettings();

    this.addCommand({
      id: "open-daily-reflection",
      name: "Daily Reflection: fill today’s journal",
      callback: () => new ReflectionModal(this.app, this.settings, async (answers) => {
        await this.writeDailyNote(answers);
        new Notice("Journal saved ✔️");
      }).open()
    });

    this.addSettingTab(new ReflectionSettingTab(this.app, this));
  }

  /** write or update daily note */
  async writeDailyNote(answers: Record<string, string>) {
    const fileName = moment().format("YYYY-MM-DD") + ".md";
    const path     = `${this.settings.dailyFolder}/${fileName}`;

    const existing = this.app.vault.getAbstractFileByPath(path) as TFile;
    const file: TFile = existing
      ? existing
      : await this.app.vault.create(path, "");

    // Build markdown template
    let md = `# ${moment().format("dddd, MMMM D YYYY")}\n\n`;
    for (const q of this.settings.questions) {
      const value = answers[q.id] ?? "";
      md += `### ${q.label}\n${value}\n\n`;
    }
    await this.app.vault.modify(file, md);

    // open in editor
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.openFile(file, { active: true });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

/** ---------- modal ---------- */
class ReflectionModal extends Modal {
  constructor(
    app: App,
    private settings: ReflectionSettings,
    private onSubmit: (answers: Record<string, string>) => void
  ) {
    super(app);
  }

  answers: Record<string, string> = {};

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Daily Reflection – " + moment().format("YYYY-MM-DD") });

    this.settings.questions.forEach(q => {
      contentEl.createEl("h3", { text: q.label });

      switch (q.type) {
        case "text": {
          const t = new TextAreaComponent(contentEl);
          t.inputEl.rows = 3;
          t.inputEl.style.width = "100%";
          t.onChange(v => this.answers[q.id] = v);
          break;
        }
        case "number": {
          const n = new TextComponent(contentEl);
          n.inputEl.type = "number";
          n.onChange(v => this.answers[q.id] = v);
          break;
        }
        case "dropdown": {
          const d = new DropdownComponent(contentEl);
          q.choices!.forEach(c => d.addOption(c, c));
          d.onChange(v => this.answers[q.id] = v);
          break;
        }
      }
    });

    new ButtonComponent(contentEl)
      .setButtonText("Save")
      .setCta()
      .onClick(() => {
        this.close();
        this.onSubmit(this.answers);
      });
  }

  onClose() {
    this.contentEl.empty();
  }
}

/** ---------- settings tab ---------- */
class ReflectionSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: DailyReflectionPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Daily Reflection – settings" });

    new Setting(containerEl)
      .setName("Daily notes folder")
      .setDesc("Where to create the daily files")
      .addText(text => text
        .setPlaceholder("Daily")
        .setValue(this.plugin.settings.dailyFolder)
        .onChange(async (value) => {
          this.plugin.settings.dailyFolder = value.trim() || "Daily";
          await this.plugin.saveSettings();
        }));

    containerEl.createEl("p", {
      text: "To customise questions or dropdown choices, edit the plugin’s data-file or modify main.ts and reload."
    });
  }
}
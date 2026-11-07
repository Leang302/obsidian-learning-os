import { ItemView, WorkspaceLeaf } from "obsidian";
import { render, VNode } from "preact";

/** Thin ItemView base that mounts/unmounts a Preact tree into the leaf's
 * content element. Subclasses just implement `component()`. */
export abstract class PreactItemView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  abstract component(): VNode;

  protected mount(): void {
    const el = this.contentEl;
    el.empty();
    el.addClass("lp-view-root");
    render(this.component(), el);
  }

  async onOpen(): Promise<void> {
    this.mount();
  }

  async onClose(): Promise<void> {
    render(null, this.contentEl);
  }

  /** Call after any state change that should re-render this view (e.g. a
   * subscribed AppState update). */
  rerender(): void {
    this.mount();
  }
}

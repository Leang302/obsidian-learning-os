import { App, TAbstractFile, TFile, TFolder } from "obsidian";
import { parseMarkdown, stringifyMarkdown, ParsedMarkdown } from "../util/frontmatter";

export class WriteConflictError extends Error {
  constructor(public path: string) {
    super(`File changed on disk since last read: ${path}`);
  }
}

export class PersistenceError extends Error {
  constructor(public path: string, public cause: unknown) {
    super(`Failed to persist ${path}: ${String(cause)}`);
  }
}

/** Tracks the mtime we last read a file at, so writes can detect that the
 * file changed underneath us (external edit / sync conflict) instead of
 * silently clobbering it. This is intentionally in-memory only -- it's a
 * safety check for the current session, not a durable version history. */
const lastSeenMtime = new Map<string, number>();

/** Thin wrapper around Obsidian's Vault API for everything the Learning OS
 * needs: safe reads, conflict-aware writes, idempotent frontmatter
 * updates, and folder scaffolding. No other module should touch
 * `app.vault` directly for LearningOS content -- this keeps "safe writes /
 * conflict detection / correct paths" enforced in one place. */
export class VaultStore {
  constructor(private app: App) {}

  async ensureFolder(path: string): Promise<void> {
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFolder) return;
    if (existing instanceof TFile) {
      throw new PersistenceError(path, "a file exists where a folder was expected");
    }
    // Create parent folders first (Obsidian's create doesn't recurse reliably
    // across all versions), then the folder itself.
    const parts = path.split("/");
    let cur = "";
    for (const part of parts) {
      cur = cur ? `${cur}/${part}` : part;
      const node = this.app.vault.getAbstractFileByPath(cur);
      if (!node) {
        try {
          await this.app.vault.createFolder(cur);
        } catch (e) {
          // Race: another call may have just created it. Verify before failing.
          if (!(this.app.vault.getAbstractFileByPath(cur) instanceof TFolder)) {
            throw new PersistenceError(cur, e);
          }
        }
      }
    }
  }

  getFile(path: string): TFile | null {
    const f = this.app.vault.getAbstractFileByPath(path);
    return f instanceof TFile ? f : null;
  }

  exists(path: string): boolean {
    return this.getFile(path) !== null;
  }

  async read(path: string): Promise<string | null> {
    const file = this.getFile(path);
    if (!file) return null;
    const content = await this.app.vault.read(file);
    lastSeenMtime.set(path, file.stat.mtime);
    return content;
  }

  async readParsed<T = Record<string, unknown>>(path: string): Promise<ParsedMarkdown<T> | null> {
    const content = await this.read(path);
    if (content === null) return null;
    return parseMarkdown<T>(content);
  }

  /** Creates a new file. Fails loudly (does not silently overwrite) if the
   * path already exists -- the caller must handle the duplicate-title case
   * explicitly (e.g. via paths.dedupeSlug) before calling this. */
  async create(path: string, content: string): Promise<TFile> {
    const parent = path.slice(0, path.lastIndexOf("/"));
    if (parent) await this.ensureFolder(parent);
    if (this.exists(path)) {
      throw new PersistenceError(path, "file already exists");
    }
    try {
      const file = await this.app.vault.create(path, content);
      lastSeenMtime.set(path, file.stat.mtime);
      return file;
    } catch (e) {
      throw new PersistenceError(path, e);
    }
  }

  /** Overwrites a file's full content. Throws WriteConflictError if the
   * file's mtime has moved since we last read it (someone edited it
   * outside our flow) and `force` is not set, per "never overwrite personal
   * notes without explicit approval" / conflict detection requirements. */
  async write(path: string, content: string, opts: { force?: boolean } = {}): Promise<void> {
    const file = this.getFile(path);
    if (!file) {
      await this.create(path, content);
      return;
    }
    const seen = lastSeenMtime.get(path);
    if (!opts.force && seen !== undefined && file.stat.mtime !== seen) {
      throw new WriteConflictError(path);
    }
    try {
      await this.app.vault.modify(file, content);
      lastSeenMtime.set(path, file.stat.mtime);
    } catch (e) {
      throw new PersistenceError(path, e);
    }
  }

  /** Reads, applies `mutate` to the parsed (frontmatter, body), and writes
   * back -- all against the freshest copy, so repeated calls are
   * idempotent rather than compounding stale state. Returns null if the
   * file doesn't exist (caller decides whether that's an error). */
  async updateParsed<T = Record<string, unknown>>(
    path: string,
    mutate: (parsed: ParsedMarkdown<T>) => { frontmatter: Record<string, unknown>; body: string }
  ): Promise<{ ok: true } | { ok: false; reason: "missing" | "invalid-frontmatter" | "conflict"; detail?: unknown }> {
    const file = this.getFile(path);
    if (!file) return { ok: false, reason: "missing" };
    const content = await this.app.vault.read(file);
    const parsed = parseMarkdown<T>(content);
    if (parsed.frontmatterInvalid) return { ok: false, reason: "invalid-frontmatter" };
    const { frontmatter, body } = mutate(parsed);
    const next = stringifyMarkdown(frontmatter, body);
    try {
      await this.app.vault.modify(file, next);
      lastSeenMtime.set(path, file.stat.mtime);
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: "conflict", detail: e };
    }
  }

  async listFiles(folder: string): Promise<TFile[]> {
    const node = this.app.vault.getAbstractFileByPath(folder);
    if (!(node instanceof TFolder)) return [];
    const out: TFile[] = [];
    for (const child of node.children) {
      if (child instanceof TFile && child.extension === "md") out.push(child);
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  async listTopicFolders(): Promise<string[]> {
    const node = this.app.vault.getAbstractFileByPath("LearningOS/Topics");
    if (!(node instanceof TFolder)) return [];
    return node.children.filter((c): c is TFolder => c instanceof TFolder).map((f) => f.name);
  }

  onChange(cb: (path: string) => void): () => void {
    const handler = (file: TAbstractFile) => {
      if (file.path.startsWith("LearningOS/")) cb(file.path);
    };
    const renameHandler = (file: TAbstractFile, oldPath: string) => {
      if (file.path.startsWith("LearningOS/") || oldPath.startsWith("LearningOS/")) {
        cb(oldPath);
        cb(file.path);
      }
    };
    const refs = [
      this.app.vault.on("modify", handler),
      this.app.vault.on("create", handler),
      this.app.vault.on("delete", handler),
      this.app.vault.on("rename", renameHandler),
    ];
    return () => {
      for (const ref of refs) this.app.vault.offref(ref);
    };
  }
}

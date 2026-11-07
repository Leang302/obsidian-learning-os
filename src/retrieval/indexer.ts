import { VaultStore } from "../data/vaultStore";
import { parseMarkdown } from "../util/frontmatter";

export type ChunkKind = "overview" | "roadmap" | "progress" | "lesson" | "exercise" | "review" | "other";

export interface IndexedChunk {
  id: string; // path#headingIndex
  path: string;
  topicId: string | null;
  kind: ChunkKind;
  heading: string;
  text: string;
  updatedAt: number; // mtime, ms
  /** lowercase term -> count, precomputed once per chunk for fast scoring */
  termFreq: Map<string, number>;
  length: number; // token count estimate (words)
}

const MAX_CHUNK_CHARS = 1200;
const STOPWORDS = new Set([
  "the","a","an","and","or","but","is","are","was","were","be","been","to","of","in","on","for",
  "with","as","by","at","from","this","that","it","its","i","you","your","we","they","he","she",
  "what","how","why","do","does","did","can","could","should","would","will","not","no","yes",
]);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9']+/g) ?? []).filter((t) => !STOPWORDS.has(t) && t.length > 1);
}

function termFreqOf(text: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of tokenize(text)) map.set(t, (map.get(t) ?? 0) + 1);
  return map;
}

function kindFromPath(path: string): ChunkKind {
  if (/\/Overview\.md$/.test(path)) return "overview";
  if (/\/Roadmap\.md$/.test(path)) return "roadmap";
  if (/\/Progress\.md$/.test(path)) return "progress";
  if (/\/Lessons\//.test(path)) return "lesson";
  if (/\/Exercises\//.test(path)) return "exercise";
  if (/\/Reviews\//.test(path)) return "review";
  return "other";
}

function topicIdFromPath(path: string): string | null {
  const m = path.match(/^LearningOS\/Topics\/([^/]+)\//);
  return m ? m[1] : null;
}

/** Splits a lesson/note body into heading-bounded chunks, further splitting
 * any chunk that's too long on paragraph breaks. Never splits mid-sentence
 * in a way that would silently change a retrieved passage's meaning --
 * splits only occur at heading or blank-line boundaries. */
function splitIntoChunks(body: string): { heading: string; text: string }[] {
  const lines = body.split("\n");
  const sections: { heading: string; text: string[] }[] = [{ heading: "", text: [] }];
  for (const line of lines) {
    const h = line.match(/^(#{1,6})\s+(.*)/);
    if (h) {
      sections.push({ heading: h[2].trim(), text: [] });
    } else {
      sections[sections.length - 1].text.push(line);
    }
  }
  const out: { heading: string; text: string }[] = [];
  for (const s of sections) {
    const full = s.text.join("\n").trim();
    if (!full) continue;
    if (full.length <= MAX_CHUNK_CHARS) {
      out.push({ heading: s.heading, text: full });
      continue;
    }
    // Too long: split on paragraph breaks, grouping into ~MAX_CHUNK_CHARS pieces.
    const paras = full.split(/\n\s*\n/);
    let buf = "";
    for (const p of paras) {
      if (buf && buf.length + p.length + 2 > MAX_CHUNK_CHARS) {
        out.push({ heading: s.heading, text: buf });
        buf = p;
      } else {
        buf = buf ? `${buf}\n\n${p}` : p;
      }
    }
    if (buf) out.push({ heading: s.heading, text: buf });
  }
  return out.length ? out : [{ heading: "", text: body.trim() }];
}

/** Local-first, incremental index over LearningOS/ only (never the full
 * vault, per the token-efficiency requirement). Rebuilding touches only
 * the file that changed, not the whole index. */
export class Indexer {
  private chunks = new Map<string, IndexedChunk[]>(); // path -> chunks
  private unsubscribe: (() => void) | null = null;

  constructor(private store: VaultStore) {}

  async buildInitial(): Promise<void> {
    const topicIds = await this.store.listTopicFolders();
    const allPaths: string[] = [`LearningOS/Dashboard.md`];
    for (const topicId of topicIds) {
      allPaths.push(
        `LearningOS/Topics/${topicId}/Overview.md`,
        `LearningOS/Topics/${topicId}/Roadmap.md`,
        `LearningOS/Topics/${topicId}/Progress.md`
      );
      for (const sub of ["Lessons", "Exercises", "Reviews"]) {
        const files = await this.store.listFiles(`LearningOS/Topics/${topicId}/${sub}`);
        allPaths.push(...files.map((f) => f.path));
      }
    }
    for (const p of allPaths) {
      if (this.store.exists(p)) await this.indexFile(p);
    }
  }

  watch(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.store.onChange((path) => {
      void this.reindexOrRemove(path);
    });
  }

  stopWatching(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private async reindexOrRemove(path: string): Promise<void> {
    if (!path.endsWith(".md")) return;
    if (this.store.exists(path)) {
      await this.indexFile(path);
    } else {
      this.chunks.delete(path);
    }
  }

  async indexFile(path: string): Promise<void> {
    const content = await this.store.read(path);
    if (content === null) {
      this.chunks.delete(path);
      return;
    }
    const { body } = parseMarkdown(content);
    const file = this.store.getFile(path);
    const updatedAt = file?.stat.mtime ?? Date.now();
    const kind = kindFromPath(path);
    const topicId = topicIdFromPath(path);
    const pieces = splitIntoChunks(body);
    const chunks: IndexedChunk[] = pieces.map((piece, i) => {
      const text = piece.text;
      return {
        id: `${path}#${i}`,
        path,
        topicId,
        kind,
        heading: piece.heading,
        text,
        updatedAt,
        termFreq: termFreqOf(`${piece.heading} ${text}`),
        length: tokenize(text).length,
      };
    });
    this.chunks.set(path, chunks);
  }

  private allChunks(): IndexedChunk[] {
    return [...this.chunks.values()].flat();
  }

  /** Ranked keyword search with simple TF scoring plus topic/recency/kind
   * boosts. No embeddings -- see decisions.md for why that's deferred. */
  query(
    text: string,
    opts: { topicId?: string; kinds?: ChunkKind[]; limit?: number; excludePaths?: string[] } = {}
  ): IndexedChunk[] {
    const qTerms = tokenize(text);
    const limit = opts.limit ?? 8;
    const now = Date.now();
    const candidates = this.allChunks().filter((c) => {
      if (opts.topicId && c.topicId !== opts.topicId) return false;
      if (opts.kinds && !opts.kinds.includes(c.kind)) return false;
      if (opts.excludePaths?.includes(c.path)) return false;
      return true;
    });
    if (qTerms.length === 0) {
      // No query text (e.g. "what should I learn next?" style structural
      // asks) -- just return by recency within the filtered set.
      return candidates.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
    }
    const scored = candidates.map((c) => {
      let score = 0;
      for (const term of qTerms) {
        const tf = c.termFreq.get(term) ?? 0;
        if (tf > 0) score += 1 + Math.log(1 + tf);
      }
      // Recency boost: mild, decays over ~30 days.
      const ageDays = (now - c.updatedAt) / (1000 * 60 * 60 * 24);
      score += Math.max(0, 1 - ageDays / 30) * 0.3;
      // Prefer lesson/overview content over progress/roadmap noise when tied.
      if (c.kind === "lesson") score += 0.1;
      return { c, score };
    });
    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.c);
  }

  getChunksForPath(path: string): IndexedChunk[] {
    return this.chunks.get(path) ?? [];
  }
}

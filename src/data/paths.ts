/** All path construction for the Learning OS vault layout lives here so the
 * folder structure is defined in exactly one place:
 *
 * LearningOS/
 *   Dashboard.md
 *   Topics/<topicId>/
 *     Overview.md
 *     Roadmap.md
 *     Progress.md
 *     Lessons/<lessonId>.md
 *     Exercises/<lessonId>-<exerciseId>.md
 *     Reviews/<conceptId>.md
 */

export const ROOT_FOLDER = "LearningOS";

export function topicFolder(topicId: string): string {
  return `${ROOT_FOLDER}/Topics/${topicId}`;
}

export function dashboardPath(): string {
  return `${ROOT_FOLDER}/Dashboard.md`;
}

export function overviewPath(topicId: string): string {
  return `${topicFolder(topicId)}/Overview.md`;
}

export function roadmapPath(topicId: string): string {
  return `${topicFolder(topicId)}/Roadmap.md`;
}

export function progressPath(topicId: string): string {
  return `${topicFolder(topicId)}/Progress.md`;
}

export function lessonsFolder(topicId: string): string {
  return `${topicFolder(topicId)}/Lessons`;
}

export function lessonPath(topicId: string, lessonId: string): string {
  return `${lessonsFolder(topicId)}/${lessonId}.md`;
}

export function exercisesFolder(topicId: string): string {
  return `${topicFolder(topicId)}/Exercises`;
}

export function exercisePath(topicId: string, lessonId: string, exerciseId: string): string {
  return `${exercisesFolder(topicId)}/${lessonId}-${exerciseId}.md`;
}

export function reviewsFolder(topicId: string): string {
  return `${topicFolder(topicId)}/Reviews`;
}

export function reviewPath(topicId: string, conceptId: string): string {
  return `${reviewsFolder(topicId)}/${conceptId}.md`;
}

/** Slugifies arbitrary user input into a filesystem/id-safe slug. Collapses
 * whitespace, strips path-hostile characters, lowercases. Used for topic
 * and module ids derived from free-text goals ("System Design" -> "system-design"). */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "untitled";
}

/** Appends a numeric suffix if `base` collides with something in `existing`,
 * guaranteeing a unique id (handles duplicate lesson/topic titles). */
export function dedupeSlug(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base;
  let n = 2;
  while (existing.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

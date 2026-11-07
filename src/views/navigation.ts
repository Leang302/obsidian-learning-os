import { WorkspaceLeaf } from "obsidian";
import { Services } from "../context";
import { VIEW_DASHBOARD, VIEW_ROADMAP, VIEW_LESSON, VIEW_PROGRESS } from "./viewTypes";
import { StartTopicModal } from "./StartTopicModal";

async function revealSingletonLeaf(services: Services, viewType: string): Promise<WorkspaceLeaf> {
  const existing = services.app.workspace.getLeavesOfType(viewType);
  const leaf = existing[0] ?? services.app.workspace.getLeaf("tab");
  if (!existing.length) {
    await leaf.setViewState({ type: viewType, active: true });
  }
  await services.app.workspace.revealLeaf(leaf);
  return leaf;
}

export async function openDashboard(services: Services): Promise<void> {
  await revealSingletonLeaf(services, VIEW_DASHBOARD);
}

export async function openRoadmapInWorkspace(services: Services, topicId: string): Promise<void> {
  services.appState.setActiveTopic(topicId);
  await revealSingletonLeaf(services, VIEW_ROADMAP);
}

export async function openLessonInWorkspace(services: Services, topicId: string, lessonId: string): Promise<void> {
  services.appState.setActiveLesson(topicId, lessonId);
  await revealSingletonLeaf(services, VIEW_LESSON);
}

export async function openProgressView(services: Services, topicId?: string): Promise<void> {
  if (topicId) services.appState.setActiveTopic(topicId);
  await revealSingletonLeaf(services, VIEW_PROGRESS);
}

export function openStartTopicModal(services: Services): void {
  new StartTopicModal(services).open();
}

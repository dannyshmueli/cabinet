import { canonicalizeVirtualPagePath } from "@/lib/storage/path-utils";

interface OpenKnowledgeBasePageOptions {
  rawPath: string;
  expandPath: (path: string) => void;
  selectPage: (path: string) => void;
  setPageSection: () => void;
  loadPage: (path: string) => Promise<void> | void;
}

export interface OpenKnowledgeBasePageResult {
  pagePath: string;
  loaded: Promise<void>;
}

export function openKnowledgeBasePage({
  rawPath,
  expandPath,
  selectPage,
  setPageSection,
  loadPage,
}: OpenKnowledgeBasePageOptions): OpenKnowledgeBasePageResult {
  const pagePath = canonicalizeVirtualPagePath(rawPath);
  const parts = pagePath.split("/");

  for (let index = 1; index < parts.length; index += 1) {
    expandPath(parts.slice(0, index).join("/"));
  }

  selectPage(pagePath);
  setPageSection();

  return {
    pagePath,
    loaded: Promise.resolve(loadPage(pagePath)),
  };
}

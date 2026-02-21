"use client";

import { useState } from "react";
import type { EpubStructure, ManifestItem } from "../../lib/editor/types";

interface EditorSidebarProps {
  structure: EpubStructure;
  activeFile: string;
  onFileSelect: (path: string) => void;
  onSpineReorder: (newSpine: string[]) => void;
  onAddChapter: (path: string, content: string, mediaType: string) => void;
  onDeleteFile: (path: string) => void;
}

export function EditorSidebar({
  structure,
  activeFile,
  onFileSelect,
  onSpineReorder,
  onAddChapter,
  onDeleteFile,
}: EditorSidebarProps) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [newChapterName, setNewChapterName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["chapters", "stylesheets"]),
  );

  // Categorize manifest items
  const spineItems = structure.spine
    .map((id) => structure.manifest.find((m) => m.id === id))
    .filter((item): item is ManifestItem => item != null);

  const stylesheets = structure.manifest.filter(
    (m) => m.mediaType === "text/css" && !m.isSpineItem,
  );

  const images = structure.manifest.filter((m) =>
    m.mediaType.startsWith("image/"),
  );

  const otherFiles = structure.manifest.filter(
    (m) =>
      !m.isSpineItem &&
      m.mediaType !== "text/css" &&
      !m.mediaType.startsWith("image/") &&
      !m.isNavDoc,
  );

  // Include nav doc and OPF in "other"
  const specialFiles: { label: string; path: string }[] = [];
  if (structure.navDocPath) {
    specialFiles.push({ label: "Navigation (TOC)", path: structure.navDocPath });
  }
  specialFiles.push({ label: "Package (OPF)", path: structure.opfPath });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  // Drag and drop handlers for chapter reorder
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    setDraggingId(null);

    const draggedId = e.dataTransfer.getData("text/plain");
    if (!draggedId) return;

    const currentIndex = structure.spine.indexOf(draggedId);
    if (currentIndex === -1 || currentIndex === targetIndex) return;

    const newSpine = [...structure.spine];
    newSpine.splice(currentIndex, 1);
    newSpine.splice(targetIndex, 0, draggedId);
    onSpineReorder(newSpine);
  };

  const handleDragEnd = () => {
    setDragOverIndex(null);
    setDraggingId(null);
  };

  const handleAddChapter = () => {
    if (!newChapterName.trim()) return;
    const name = newChapterName.trim().replace(/\s+/g, "-").toLowerCase();
    const filename = name.endsWith(".xhtml") ? name : `${name}.xhtml`;
    const path = `${structure.opfDir}${filename}`;
    const content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${newChapterName.trim()}</title>
</head>
<body>
  <h1>${newChapterName.trim()}</h1>
  <p></p>
</body>
</html>`;
    onAddChapter(path, content, "application/xhtml+xml");
    setNewChapterName("");
    setShowAddChapter(false);
  };

  const handleDeleteConfirm = (path: string) => {
    onDeleteFile(path);
    setConfirmDelete(null);
  };

  return (
    <div className="w-56 shrink-0 border-r border-border bg-surface overflow-y-auto flex flex-col">
      {/* Chapters section */}
      <SidebarSection
        title="Chapters"
        count={spineItems.length}
        expanded={expandedSections.has("chapters")}
        onToggle={() => toggleSection("chapters")}
      >
        {spineItems.map((item, index) => (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => handleDragStart(e, item.id)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`group flex items-center gap-1 px-3 py-1.5 text-xs cursor-pointer transition-colors ${
              activeFile === item.absolutePath
                ? "bg-primary-light text-primary font-medium"
                : "text-foreground hover:bg-background"
            } ${dragOverIndex === index ? "border-t-2 border-primary" : ""} ${
              draggingId === item.id ? "opacity-50" : ""
            }`}
            onClick={() => onFileSelect(item.absolutePath)}
          >
            {/* Drag handle */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="w-3 h-3 opacity-0 group-hover:opacity-40 cursor-grab shrink-0"
            >
              <path
                fillRule="evenodd"
                d="M2 3.75A.75.75 0 0 1 2.75 3h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 3.75Zm0 4A.75.75 0 0 1 2.75 7h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 7.75Zm0 4a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z"
                clipRule="evenodd"
              />
            </svg>
            <span className="truncate flex-1">{item.href.split("/").pop()}</span>
            {/* Delete button */}
            {confirmDelete === item.absolutePath ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteConfirm(item.absolutePath);
                  }}
                  className="text-error text-[10px] font-medium hover:underline"
                >
                  Yes
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete(null);
                  }}
                  className="text-foreground-muted text-[10px] hover:underline"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(item.absolutePath);
                }}
                className="opacity-0 group-hover:opacity-50 hover:!opacity-100 hover:text-error transition-opacity"
                title="Delete chapter"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                  <path
                    fillRule="evenodd"
                    d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5A.75.75 0 0 1 9.95 6Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
          </div>
        ))}
        {/* Add chapter */}
        {showAddChapter ? (
          <div className="px-3 py-2">
            <input
              type="text"
              value={newChapterName}
              onChange={(e) => setNewChapterName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddChapter();
                if (e.key === "Escape") {
                  setShowAddChapter(false);
                  setNewChapterName("");
                }
              }}
              placeholder="Chapter name..."
              className="w-full px-2 py-1 text-xs border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
            <div className="flex gap-1 mt-1">
              <button
                onClick={handleAddChapter}
                className="text-[10px] text-primary hover:underline"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowAddChapter(false);
                  setNewChapterName("");
                }}
                className="text-[10px] text-foreground-muted hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddChapter(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-foreground-muted hover:text-foreground hover:bg-background w-full"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
              <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
            </svg>
            Add chapter
          </button>
        )}
      </SidebarSection>

      {/* Stylesheets section */}
      {stylesheets.length > 0 && (
        <SidebarSection
          title="Stylesheets"
          count={stylesheets.length}
          expanded={expandedSections.has("stylesheets")}
          onToggle={() => toggleSection("stylesheets")}
        >
          {stylesheets.map((item) => (
            <FileItem
              key={item.id}
              item={item}
              isActive={activeFile === item.absolutePath}
              onClick={() => onFileSelect(item.absolutePath)}
            />
          ))}
        </SidebarSection>
      )}

      {/* Images section */}
      {images.length > 0 && (
        <SidebarSection
          title="Images"
          count={images.length}
          expanded={expandedSections.has("images")}
          onToggle={() => toggleSection("images")}
        >
          {images.map((item) => (
            <FileItem
              key={item.id}
              item={item}
              isActive={activeFile === item.absolutePath}
              onClick={() => onFileSelect(item.absolutePath)}
              icon="image"
            />
          ))}
        </SidebarSection>
      )}

      {/* Special / Other files */}
      <SidebarSection
        title="Other"
        count={specialFiles.length + otherFiles.length}
        expanded={expandedSections.has("other")}
        onToggle={() => toggleSection("other")}
      >
        {specialFiles.map((f) => (
          <div
            key={f.path}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs cursor-pointer transition-colors ${
              activeFile === f.path
                ? "bg-primary-light text-primary font-medium"
                : "text-foreground hover:bg-background"
            }`}
            onClick={() => onFileSelect(f.path)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0 text-foreground-muted">
              <path d="M3.5 2A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14h9a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 12.5 5H7.621a1.5 1.5 0 0 1-1.06-.44L5.439 3.44A1.5 1.5 0 0 0 4.378 3H3.5Z" />
            </svg>
            <span className="truncate">{f.label}</span>
          </div>
        ))}
        {otherFiles.map((item) => (
          <FileItem
            key={item.id}
            item={item}
            isActive={activeFile === item.absolutePath}
            onClick={() => onFileSelect(item.absolutePath)}
          />
        ))}
      </SidebarSection>
    </div>
  );
}

function SidebarSection({
  title,
  count,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-foreground-muted hover:text-foreground hover:bg-background"
      >
        <span className="flex items-center gap-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
          >
            <path
              fillRule="evenodd"
              d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z"
              clipRule="evenodd"
            />
          </svg>
          {title}
        </span>
        <span className="text-[10px] text-foreground-muted">{count}</span>
      </button>
      {expanded && <div>{children}</div>}
    </div>
  );
}

function FileItem({
  item,
  isActive,
  onClick,
  icon,
}: {
  item: ManifestItem;
  isActive: boolean;
  onClick: () => void;
  icon?: "image";
}) {
  return (
    <div
      className={`flex items-center gap-1 px-3 py-1.5 text-xs cursor-pointer transition-colors ${
        isActive
          ? "bg-primary-light text-primary font-medium"
          : "text-foreground hover:bg-background"
      }`}
      onClick={onClick}
    >
      {icon === "image" ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0 text-foreground-muted">
          <path
            fillRule="evenodd"
            d="M2 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4Zm10.5 5.707a.5.5 0 0 0-.146-.353l-1-1a.5.5 0 0 0-.708 0L7.793 11.207a.5.5 0 0 1-.708 0l-.646-.647a.5.5 0 0 0-.707 0L3.5 12.793V12a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v-2.293ZM6 6.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0Z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0 text-foreground-muted">
          <path d="M4 2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6.621a2 2 0 0 0-.586-1.414l-2.621-2.621A2 2 0 0 0 9.379 2H4Z" />
        </svg>
      )}
      <span className="truncate">{item.href.split("/").pop()}</span>
    </div>
  );
}

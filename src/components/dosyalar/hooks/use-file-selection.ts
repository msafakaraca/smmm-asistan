/**
 * useFileSelection Hook
 *
 * Dosya seçimi ve selection box yönetimi
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { FileItem, ClipboardState, SelectionRect } from "../types";

interface UseFileSelectionProps {
  items: FileItem[];
  onDeleteItems: (ids: string[]) => Promise<boolean>;
  onMoveItems: (ids: string[], targetFolderId: string | null) => Promise<boolean>;
}

interface UseFileSelectionReturn {
  // Selection state
  selection: Set<string>;
  clipboard: ClipboardState | null;
  isSelecting: boolean;
  selectionRect: SelectionRect | null;
  containerRef: React.RefObject<HTMLDivElement>;

  // Selection actions
  clearSelection: () => void;
  selectAll: () => void;
  toggleSelection: (id: string, ctrlKey: boolean, shiftKey: boolean) => void;
  handleItemClick: (e: React.MouseEvent, item: FileItem) => void;
  handleItemContextMenu: (e: React.MouseEvent, item: FileItem) => void;

  // Clipboard actions
  copySelection: () => void;
  cutSelection: () => void;
  pasteFromClipboard: () => Promise<void>;

  // Selection box handlers
  handleContainerMouseDown: (e: React.MouseEvent) => void;

  // Drag & Drop
  handleDragStart: (e: React.DragEvent, item: FileItem) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, targetFolderId: string | null) => void;

  // Delete
  handleDeleteSelected: () => Promise<boolean>;
}

export function useFileSelection({
  items,
  onDeleteItems,
  onMoveItems,
}: UseFileSelectionProps): UseFileSelectionReturn {
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const lastSelectedIndex = useRef<number>(-1);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelection(new Set());
    lastSelectedIndex.current = -1;
  }, []);

  // Select all
  const selectAll = useCallback(() => {
    setSelection(new Set(items.map(item => item.id)));
  }, [items]);

  // Toggle selection with Ctrl/Shift support
  const toggleSelection = useCallback((id: string, ctrlKey: boolean, shiftKey: boolean) => {
    const itemIndex = items.findIndex(i => i.id === id);

    if (shiftKey && lastSelectedIndex.current !== -1) {
      // Range selection
      const start = Math.min(lastSelectedIndex.current, itemIndex);
      const end = Math.max(lastSelectedIndex.current, itemIndex);
      const rangeIds = items.slice(start, end + 1).map(i => i.id);

      setSelection(prev => {
        const newSelection = new Set(prev);
        rangeIds.forEach(rid => newSelection.add(rid));
        return newSelection;
      });
    } else if (ctrlKey) {
      // Toggle single item
      setSelection(prev => {
        const newSelection = new Set(prev);
        if (newSelection.has(id)) {
          newSelection.delete(id);
        } else {
          newSelection.add(id);
        }
        return newSelection;
      });
      lastSelectedIndex.current = itemIndex;
    } else {
      // Single selection
      setSelection(new Set([id]));
      lastSelectedIndex.current = itemIndex;
    }
  }, [items]);

  // Handle item click
  const handleItemClick = useCallback((e: React.MouseEvent, item: FileItem) => {
    e.stopPropagation();
    toggleSelection(item.id, e.ctrlKey || e.metaKey, e.shiftKey);
  }, [toggleSelection]);

  // Handle item context menu
  const handleItemContextMenu = useCallback((e: React.MouseEvent, item: FileItem) => {
    e.preventDefault();
    e.stopPropagation();

    // If item is not selected, select it
    if (!selection.has(item.id)) {
      setSelection(new Set([item.id]));
      lastSelectedIndex.current = items.findIndex(i => i.id === item.id);
    }
  }, [selection, items]);

  // Copy selection
  const copySelection = useCallback(() => {
    if (selection.size === 0) return;
    const selectedItems = items.filter(item => selection.has(item.id));
    setClipboard({ items: selectedItems, action: "copy" });
  }, [selection, items]);

  // Cut selection
  const cutSelection = useCallback(() => {
    if (selection.size === 0) return;
    const selectedItems = items.filter(item => selection.has(item.id));
    setClipboard({ items: selectedItems, action: "cut" });
  }, [selection, items]);

  // Paste from clipboard
  const pasteFromClipboard = useCallback(async () => {
    if (!clipboard) return;

    const ids = clipboard.items.map(item => item.id);
    const targetFolderId = null; // Current folder

    if (clipboard.action === "cut") {
      await onMoveItems(ids, targetFolderId);
      setClipboard(null);
    } else {
      // Copy operation - would need a separate API endpoint
      // For now, just show a message
      console.log("Copy paste not implemented");
    }
  }, [clipboard, onMoveItems]);

  // Selection box - mouse down
  const handleContainerMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start selection if clicking on empty space (not on a file item)
    const target = e.target as HTMLElement;
    if (target.closest("[data-file-item]")) return;

    // Clear selection when clicking empty space
    if (!e.ctrlKey && !e.shiftKey) {
      clearSelection();
    }

    setIsSelecting(true);
    setSelectionRect({
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
    });
  }, [clearSelection]);

  // Selection box - mouse move & up (global listeners)
  useEffect(() => {
    if (!isSelecting) return;

    const handleMouseMove = (e: MouseEvent) => {
      setSelectionRect(prev => prev ? {
        ...prev,
        currentX: e.clientX,
        currentY: e.clientY,
      } : null);

      // Find items within selection rect
      if (!containerRef.current) return;

      const fileItems = containerRef.current.querySelectorAll("[data-file-item]");
      const newSelection = new Set<string>();

      fileItems.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const id = el.getAttribute("data-file-id");
        if (!id) return;

        const selRect = {
          left: Math.min(selectionRect?.startX || 0, e.clientX),
          top: Math.min(selectionRect?.startY || 0, e.clientY),
          right: Math.max(selectionRect?.startX || 0, e.clientX),
          bottom: Math.max(selectionRect?.startY || 0, e.clientY),
        };

        // Check intersection
        if (
          rect.left < selRect.right &&
          rect.right > selRect.left &&
          rect.top < selRect.bottom &&
          rect.bottom > selRect.top
        ) {
          newSelection.add(id);
        }
      });

      setSelection(newSelection);
    };

    const handleMouseUp = () => {
      setIsSelecting(false);
      setSelectionRect(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isSelecting, selectionRect?.startX, selectionRect?.startY]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+A - Select all
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        selectAll();
      }

      // Ctrl+C - Copy
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        e.preventDefault();
        copySelection();
      }

      // Ctrl+X - Cut
      if ((e.ctrlKey || e.metaKey) && e.key === "x") {
        e.preventDefault();
        cutSelection();
      }

      // Ctrl+V - Paste
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        e.preventDefault();
        pasteFromClipboard();
      }

      // Delete key
      if (e.key === "Delete" && selection.size > 0) {
        e.preventDefault();
        onDeleteItems(Array.from(selection));
      }

      // Escape - Clear selection
      if (e.key === "Escape") {
        clearSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectAll, copySelection, cutSelection, pasteFromClipboard, selection, onDeleteItems, clearSelection]);

  // Drag & Drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, item: FileItem) => {
    // If dragging an unselected item, select it first
    if (!selection.has(item.id)) {
      setSelection(new Set([item.id]));
    }

    const draggedIds = selection.has(item.id) ? Array.from(selection) : [item.id];
    e.dataTransfer.setData("application/json", JSON.stringify(draggedIds));
    e.dataTransfer.effectAllowed = "move";
  }, [selection]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const data = e.dataTransfer.getData("application/json");
      const draggedIds: string[] = JSON.parse(data);

      // Don't drop onto self
      if (targetFolderId && draggedIds.includes(targetFolderId)) {
        return;
      }

      onMoveItems(draggedIds, targetFolderId);
      clearSelection();
    } catch (error) {
      console.error("Drop error:", error);
    }
  }, [onMoveItems, clearSelection]);

  // Delete selected items
  const handleDeleteSelected = useCallback(async (): Promise<boolean> => {
    if (selection.size === 0) return false;
    const result = await onDeleteItems(Array.from(selection));
    if (result) {
      clearSelection();
    }
    return result;
  }, [selection, onDeleteItems, clearSelection]);

  return {
    // Selection state
    selection,
    clipboard,
    isSelecting,
    selectionRect,
    containerRef: containerRef as React.RefObject<HTMLDivElement>,

    // Selection actions
    clearSelection,
    selectAll,
    toggleSelection,
    handleItemClick,
    handleItemContextMenu,

    // Clipboard actions
    copySelection,
    cutSelection,
    pasteFromClipboard,

    // Selection box handlers
    handleContainerMouseDown,

    // Drag & Drop
    handleDragStart,
    handleDragOver,
    handleDrop,

    // Delete
    handleDeleteSelected,
  };
}

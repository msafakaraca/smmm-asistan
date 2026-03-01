"use client";

import { useState, useCallback, useMemo } from "react";

export interface UseRowSelectionReturn {
  selectedIds: Set<string>;
  isSelectionMode: boolean;
  selectedCount: number;
  toggleSelectionMode: () => void;
  toggleRow: (id: string) => void;
  selectAll: (ids: string[]) => void;
  deselectAll: () => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
  exitSelectionMode: () => void;
}

/**
 * Reusable hook for row selection in tables
 * Provides selection mode toggle, row selection, and bulk operations
 */
export function useRowSelection(): UseRowSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const selectedCount = useMemo(() => selectedIds.size, [selectedIds]);

  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode((prev) => {
      if (prev) {
        // Exiting selection mode - clear selections
        setSelectedIds(new Set());
      }
      return !prev;
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  return {
    selectedIds,
    isSelectionMode,
    selectedCount,
    toggleSelectionMode,
    toggleRow,
    selectAll,
    deselectAll,
    clearSelection,
    isSelected,
    exitSelectionMode,
  };
}

import { useState, useCallback, useMemo } from 'react';
import type { BulkSendDocument } from '../types';

export interface UseDocumentSelectionResult {
  selectedIds: string[];
  isAllSelected: boolean;
  isSomeSelected: boolean;
  selectedDocuments: BulkSendDocument[];

  // Actions
  toggleSelection: (id: string) => void;
  toggleAll: () => void;
  selectMultiple: (ids: string[]) => void;
  deselectMultiple: (ids: string[]) => void;
  clearSelection: () => void;

  // Helpers
  isSelected: (id: string) => boolean;
  selectedCount: number;
}

export function useDocumentSelection(documents: BulkSendDocument[]): UseDocumentSelectionResult {
  const [selectedIdSet, setSelectedIdSet] = useState<Set<string>>(new Set());

  // Toggle single selection
  const toggleSelection = useCallback((id: string) => {
    setSelectedIdSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Toggle select all
  const toggleAll = useCallback(() => {
    setSelectedIdSet((prev) => {
      if (prev.size === documents.length) {
        // All selected, deselect all
        return new Set();
      } else {
        // Select all
        return new Set(documents.map((d) => d.id));
      }
    });
  }, [documents]);

  // Select multiple
  const selectMultiple = useCallback((ids: string[]) => {
    setSelectedIdSet((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  // Deselect multiple
  const deselectMultiple = useCallback((ids: string[]) => {
    setSelectedIdSet((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedIdSet(new Set());
  }, []);

  // Check if selected
  const isSelected = useCallback((id: string) => {
    return selectedIdSet.has(id);
  }, [selectedIdSet]);

  // Computed values
  const selectedIds = useMemo(() => Array.from(selectedIdSet), [selectedIdSet]);

  const isAllSelected = useMemo(() => {
    return documents.length > 0 && selectedIdSet.size === documents.length;
  }, [documents.length, selectedIdSet.size]);

  const isSomeSelected = useMemo(() => {
    return selectedIdSet.size > 0 && selectedIdSet.size < documents.length;
  }, [selectedIdSet.size, documents.length]);

  const selectedDocuments = useMemo(() => {
    return documents.filter((d) => selectedIdSet.has(d.id));
  }, [documents, selectedIdSet]);

  const selectedCount = useMemo(() => selectedIdSet.size, [selectedIdSet.size]);

  return {
    selectedIds,
    isAllSelected,
    isSomeSelected,
    selectedDocuments,
    toggleSelection,
    toggleAll,
    selectMultiple,
    deselectMultiple,
    clearSelection,
    isSelected,
    selectedCount,
  };
}

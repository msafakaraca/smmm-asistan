"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";

interface ComposePopupProps {
  isOpen: boolean;
  isMinimized: boolean;
  isExpanded: boolean;
  replyTo?: string;
  subject?: string;
  onClose: () => void;
  onMinimize: () => void;
  onExpand: () => void;
  onSend: (data: { to: string; subject: string; body: string; attachments: File[] }) => Promise<void>;
}

export function ComposePopup({
  isOpen,
  isMinimized,
  isExpanded,
  replyTo = "",
  subject: initialSubject = "",
  onClose,
  onMinimize,
  onExpand,
  onSend,
}: ComposePopupProps) {
  // Form state
  const [to, setTo] = useState(replyTo);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Update form when props change
  useEffect(() => {
    if (replyTo) setTo(replyTo);
    if (initialSubject) setSubject(initialSubject);
  }, [replyTo, initialSubject]);

  // Focus body when opened
  useEffect(() => {
    if (isOpen && !isMinimized && bodyRef.current) {
      setTimeout(() => bodyRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  // File handlers
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) {
      setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
    }
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Send handler
  const handleSend = useCallback(async () => {
    if (!to.trim()) return;

    setIsSending(true);
    try {
      await onSend({ to, subject, body, attachments: files });
      // Reset form
      setTo("");
      setSubject("");
      setBody("");
      setFiles([]);
      onClose();
    } catch (error) {
      console.error("[ComposePopup] Send error:", error);
    } finally {
      setIsSending(false);
    }
  }, [to, subject, body, files, onSend, onClose]);

  // Handle discard
  const handleDiscard = useCallback(() => {
    setTo("");
    setSubject("");
    setBody("");
    setFiles([]);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  // Expanded mode - Full modal
  if (isExpanded) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-2xl w-[800px] max-h-[90vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-800 text-white rounded-t-xl">
            <span className="font-medium">Yeni Mesaj</span>
            <div className="flex items-center gap-1">
              <button
                onClick={onExpand}
                className="p-1.5 hover:bg-white/10 rounded transition-colors"
                title="Küçült"
              >
                <Icon icon="solar:minimize-square-bold" className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-white/10 rounded transition-colors"
                title="Kapat"
              >
                <Icon icon="solar:close-circle-bold" className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Form */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* To */}
            <div className="px-4 py-2 border-b border-gray-200 flex items-center gap-2">
              <label className="text-sm text-gray-500 w-12 shrink-0">Kime:</label>
              <input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="flex-1 text-sm outline-none"
                placeholder="ornek@email.com"
              />
            </div>

            {/* Subject */}
            <div className="px-4 py-2 border-b border-gray-200 flex items-center gap-2">
              <label className="text-sm text-gray-500 w-12 shrink-0">Konu:</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="flex-1 text-sm outline-none"
                placeholder="Konu"
              />
            </div>

            {/* Body */}
            <div
              className={cn(
                "flex-1 p-4 overflow-hidden",
                isDragOver && "bg-blue-50"
              )}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
            >
              <textarea
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full h-full resize-none outline-none text-sm"
                placeholder="Mesajınızı yazın..."
              />
            </div>

            {/* Attachments */}
            {files.length > 0 && (
              <div className="px-4 py-2 border-t border-gray-200 flex flex-wrap gap-2">
                {files.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded text-xs"
                  >
                    <Icon icon="solar:file-bold" className="w-3.5 h-3.5 text-gray-500" />
                    <span className="max-w-[150px] truncate">{file.name}</span>
                    <button
                      onClick={() => removeFile(idx)}
                      className="p-0.5 hover:bg-gray-200 rounded"
                    >
                      <Icon icon="solar:close-circle-bold" className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-1">
              <button
                onClick={handleSend}
                disabled={!to.trim() || isSending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                {isSending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Icon icon="solar:plain-bold" className="w-4 h-4" />
                )}
                Gönder
              </button>

              {/* Toolbar */}
              <div className="flex items-center ml-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                  accept=".pdf,.xml,.zip,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 hover:bg-gray-200 rounded transition-colors text-gray-600"
                  title="Dosya ekle"
                >
                  <Icon icon="solar:paperclip-bold" className="w-5 h-5" />
                </button>
              </div>
            </div>

            <button
              onClick={handleDiscard}
              className="p-2 hover:bg-gray-200 rounded transition-colors text-gray-500"
              title="Sil"
            >
              <Icon icon="solar:trash-bin-trash-bold" className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Minimized mode - Just header bar
  if (isMinimized) {
    return (
      <div className="fixed bottom-0 right-4 z-50 w-[280px] bg-gray-800 rounded-t-lg shadow-lg overflow-hidden">
        <div
          className="flex items-center justify-between px-3 py-2 cursor-pointer"
          onClick={onMinimize}
        >
          <div className="flex items-center gap-2 text-white">
            <Icon icon="solar:pen-new-square-bold" className="w-4 h-4" />
            <span className="text-sm font-medium truncate">
              {subject || to || "Yeni Mesaj"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onExpand(); }}
              className="p-1 hover:bg-white/10 rounded transition-colors text-white"
              title="Genişlet"
            >
              <Icon icon="solar:maximize-square-bold" className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="p-1 hover:bg-white/10 rounded transition-colors text-white"
              title="Kapat"
            >
              <Icon icon="solar:close-circle-bold" className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Normal popup mode
  return (
    <div className="fixed bottom-0 right-4 z-50 w-[480px] bg-white rounded-t-lg shadow-2xl border border-gray-200 flex flex-col h-[600px] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 text-white rounded-t-lg shrink-0">
        <span className="text-sm font-medium">Yeni Mesaj</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onMinimize}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            title="Küçült"
          >
            <Icon icon="solar:minus-circle-bold" className="w-4 h-4" />
          </button>
          <button
            onClick={onExpand}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            title="Genişlet"
          >
            <Icon icon="solar:maximize-square-bold" className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            title="Kapat"
          >
            <Icon icon="solar:close-circle-bold" className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* To */}
        <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 shrink-0">
          <label className="text-xs text-gray-400 w-10 shrink-0">Kime:</label>
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="flex-1 text-sm outline-none bg-transparent"
            placeholder="ornek@email.com"
          />
        </div>

        {/* Subject */}
        <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 shrink-0">
          <label className="text-xs text-gray-400 w-10 shrink-0">Konu:</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="flex-1 text-sm outline-none bg-transparent"
            placeholder="Konu"
          />
        </div>

        {/* Body */}
        <div
          className={cn(
            "flex-1 min-h-[350px] p-3 overflow-hidden",
            isDragOver && "bg-blue-50"
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full h-full resize-none outline-none text-sm"
            placeholder="Mesajınızı yazın..."
          />
        </div>

        {/* Attachments */}
        {files.length > 0 && (
          <div className="px-3 py-2 border-t border-gray-100 flex flex-wrap gap-1.5 shrink-0">
            {files.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded text-[10px]"
              >
                <Icon icon="solar:file-bold" className="w-3 h-3 text-gray-500" />
                <span className="max-w-[100px] truncate">{file.name}</span>
                <button
                  onClick={() => removeFile(idx)}
                  className="p-0.5 hover:bg-gray-200 rounded"
                >
                  <Icon icon="solar:close-circle-bold" className="w-3 h-3 text-gray-400" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-gray-200 flex items-center justify-between bg-gray-50 shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={handleSend}
            disabled={!to.trim() || isSending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium transition-colors"
          >
            {isSending ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Icon icon="solar:plain-bold" className="w-3.5 h-3.5" />
            )}
            Gönder
          </button>

          {/* Toolbar */}
          <div className="flex items-center ml-1">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              accept=".pdf,.xml,.zip,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-500"
              title="Dosya ekle"
            >
              <Icon icon="solar:paperclip-bold" className="w-4 h-4" />
            </button>
          </div>
        </div>

        <button
          onClick={handleDiscard}
          className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-400"
          title="Sil"
        >
          <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

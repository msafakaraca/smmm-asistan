"use client";

import { useState, useCallback, useRef, memo } from "react";
import { Icon } from "@iconify/react";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// ====================
// TYPES
// ====================

interface PdfTool {
    id: string;
    title: string;
    description: string;
    icon: string;
    gradientFrom: string;
    gradientTo: string;
    acceptedTypes: string[];
    multiple: boolean;
}

interface UploadedFile {
    file: File;
    id: string;
    preview?: string;
}

// ====================
// CONSTANTS
// ====================

const PDF_TOOLS: PdfTool[] = [
    {
        id: "merge",
        title: "PDF Birleştir",
        description: "Birden fazla PDF dosyasını tek bir dosyada birleştir",
        icon: "solar:documents-bold",
        gradientFrom: "from-blue-500",
        gradientTo: "to-blue-600",
        acceptedTypes: [".pdf"],
        multiple: true,
    },
    {
        id: "split",
        title: "PDF Ayır",
        description: "PDF dosyasını sayfa sayfa veya aralık olarak ayır",
        icon: "solar:copy-bold",
        gradientFrom: "from-purple-500",
        gradientTo: "to-purple-600",
        acceptedTypes: [".pdf"],
        multiple: false,
    },
    {
        id: "compress",
        title: "PDF Sıkıştır",
        description: "PDF dosya boyutunu küçült, kaliteyi koru",
        icon: "solar:archive-minimalistic-bold",
        gradientFrom: "from-green-500",
        gradientTo: "to-green-600",
        acceptedTypes: [".pdf"],
        multiple: false,
    },
    {
        id: "word-to-pdf",
        title: "Word → PDF",
        description: "Word belgelerini PDF formatına dönüştür",
        icon: "solar:document-text-bold",
        gradientFrom: "from-orange-500",
        gradientTo: "to-orange-600",
        acceptedTypes: [".doc", ".docx"],
        multiple: false,
    },
    {
        id: "pdf-to-word",
        title: "PDF → Word",
        description: "PDF dosyalarını düzenlenebilir Word belgesine dönüştür",
        icon: "solar:file-text-bold",
        gradientFrom: "from-red-500",
        gradientTo: "to-red-600",
        acceptedTypes: [".pdf"],
        multiple: false,
    },
    {
        id: "excel-to-pdf",
        title: "Excel → PDF",
        description: "Excel tablolarını PDF formatına dönüştür",
        icon: "solar:chart-square-bold",
        gradientFrom: "from-emerald-500",
        gradientTo: "to-emerald-600",
        acceptedTypes: [".xls", ".xlsx"],
        multiple: false,
    },
];

const API_ENDPOINTS: Record<string, string> = {
    merge: "/api/pdf-tools/merge",
    split: "/api/pdf-tools/split",
    compress: "/api/pdf-tools/compress",
    "word-to-pdf": "/api/pdf-tools/convert/word-to-pdf",
    "pdf-to-word": "/api/pdf-tools/convert/pdf-to-word",
    "excel-to-pdf": "/api/pdf-tools/convert/excel-to-pdf",
};

// ====================
// HELPER FUNCTIONS
// ====================

function generateId(): string {
    return Math.random().toString(36).substring(2, 11);
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getAcceptString(types: string[]): string {
    return types.join(",");
}

// ====================
// COMPONENTS
// ====================

interface ToolCardProps {
    tool: PdfTool;
    onClick: () => void;
}

const ToolCard = memo(function ToolCard({ tool, onClick }: ToolCardProps) {
    return (
        <Card
            className="hover:shadow-lg transition-all duration-300 cursor-pointer group border-transparent hover:border-primary/20"
            onClick={onClick}
        >
            <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center gap-4">
                    <div
                        className={cn(
                            "p-4 rounded-2xl bg-gradient-to-br text-white shadow-lg",
                            "group-hover:scale-110 transition-transform duration-300",
                            tool.gradientFrom,
                            tool.gradientTo
                        )}
                    >
                        <Icon icon={tool.icon} className="h-8 w-8" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {tool.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {tool.description}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
});

interface FileDropZoneProps {
    files: UploadedFile[];
    onFilesChange: (files: UploadedFile[]) => void;
    acceptedTypes: string[];
    multiple: boolean;
    disabled?: boolean;
}

const FileDropZone = memo(function FileDropZone({
    files,
    onFilesChange,
    acceptedTypes,
    multiple,
    disabled,
}: FileDropZoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const validateFile = useCallback(
        (file: File): boolean => {
            const extension = "." + file.name.split(".").pop()?.toLowerCase();
            if (!acceptedTypes.includes(extension)) {
                toast.error(
                    `Geçersiz dosya tipi: ${file.name}. Kabul edilen tipler: ${acceptedTypes.join(", ")}`
                );
                return false;
            }
            // Max 50MB
            if (file.size > 50 * 1024 * 1024) {
                toast.error(`Dosya çok büyük: ${file.name}. Maksimum 50MB`);
                return false;
            }
            return true;
        },
        [acceptedTypes]
    );

    const handleFiles = useCallback(
        (fileList: FileList) => {
            const validFiles: UploadedFile[] = [];
            const filesArray = Array.from(fileList);

            for (const file of filesArray) {
                if (validateFile(file)) {
                    validFiles.push({
                        file,
                        id: generateId(),
                    });
                }
            }

            if (validFiles.length > 0) {
                if (multiple) {
                    onFilesChange([...files, ...validFiles]);
                } else {
                    onFilesChange(validFiles.slice(0, 1));
                }
            }
        },
        [files, multiple, onFilesChange, validateFile]
    );

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);

            if (disabled) return;

            const { files: droppedFiles } = e.dataTransfer;
            if (droppedFiles?.length > 0) {
                handleFiles(droppedFiles);
            }
        },
        [disabled, handleFiles]
    );

    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const selectedFiles = e.target.files;
            if (selectedFiles && selectedFiles.length > 0) {
                handleFiles(selectedFiles);
            }
            // Reset input
            e.target.value = "";
        },
        [handleFiles]
    );

    const handleRemoveFile = useCallback(
        (fileId: string) => {
            onFilesChange(files.filter((f) => f.id !== fileId));
        },
        [files, onFilesChange]
    );

    const handleClick = useCallback(() => {
        if (!disabled) {
            inputRef.current?.click();
        }
    }, [disabled]);

    return (
        <div className="space-y-4">
            {/* Drop Zone */}
            <div
                onClick={handleClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                    "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200",
                    isDragging
                        ? "border-primary bg-primary/5 scale-[1.01]"
                        : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
                    disabled && "opacity-50 cursor-not-allowed"
                )}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept={getAcceptString(acceptedTypes)}
                    multiple={multiple}
                    onChange={handleInputChange}
                    className="hidden"
                    disabled={disabled}
                />
                <div className="flex flex-col items-center gap-2">
                    <div
                        className={cn(
                            "p-3 rounded-full transition-colors",
                            isDragging ? "bg-primary/10" : "bg-muted"
                        )}
                    >
                        <Icon
                            icon="solar:cloud-upload-bold"
                            className={cn(
                                "h-6 w-6 transition-colors",
                                isDragging
                                    ? "text-primary"
                                    : "text-muted-foreground"
                            )}
                        />
                    </div>
                    <div>
                        <p className="font-medium text-foreground text-sm">
                            Dosyaları sürükle bırak veya tıkla
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {acceptedTypes.join(", ").toUpperCase()} dosyaları kabul edilir (Maks. 50MB)
                        </p>
                    </div>
                </div>
            </div>

            {/* File List */}
            {files.length > 0 && (
                <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs">
                        Yüklenen Dosyalar ({files.length})
                    </Label>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {files.map((uploadedFile, index) => (
                            <div
                                key={uploadedFile.id}
                                className="flex items-center justify-between p-2 rounded-lg border bg-muted/30 group"
                            >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <div className="flex items-center justify-center w-6 h-6 rounded bg-primary/10 text-primary text-xs font-medium shrink-0">
                                        {index + 1}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-medium truncate max-w-[280px]" title={uploadedFile.file.name}>
                                            {uploadedFile.file.name}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {formatFileSize(uploadedFile.file.size)}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoveFile(uploadedFile.id)}
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                    <Icon
                                        icon="solar:trash-bin-trash-bold"
                                        className="h-3.5 w-3.5"
                                    />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});

interface ProgressBarProps {
    progress: number;
    status: string;
}

const ProgressBar = memo(function ProgressBar({ progress, status }: ProgressBarProps) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{status}</span>
                <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
});

interface ToolDialogProps {
    tool: PdfTool | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

function ToolDialog({ tool, open, onOpenChange }: ToolDialogProps) {
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState("");
    const [result, setResult] = useState<string | null>(null);

    // Split options
    const [splitMode, setSplitMode] = useState<"all" | "range">("all");
    const [splitRange, setSplitRange] = useState("");

    // Compress options
    const [compressQuality, setCompressQuality] = useState<
        "low" | "medium" | "high"
    >("medium");

    const resetState = useCallback(() => {
        setFiles([]);
        setLoading(false);
        setProgress(0);
        setStatus("");
        setResult(null);
        setSplitMode("all");
        setSplitRange("");
        setCompressQuality("medium");
    }, []);

    const handleClose = useCallback(
        (open: boolean) => {
            if (!open) {
                resetState();
            }
            onOpenChange(open);
        },
        [onOpenChange, resetState]
    );

    const handleProcess = useCallback(async () => {
        if (!tool || files.length === 0) return;

        setLoading(true);
        setProgress(0);
        setStatus("Dosyalar hazırlanıyor...");
        setResult(null);

        try {
            const formData = new FormData();

            // Add files - backend "fileInput" bekliyor
            files.forEach((f) => {
                formData.append("fileInput", f.file);
            });

            // Add tool-specific options
            if (tool.id === "split") {
                // Backend "pageNumbers" bekliyor
                if (splitMode === "all") {
                    // Tum sayfalar icin ozel deger (backend'de handle edilecek)
                    formData.append("pageNumbers", "all");
                } else {
                    formData.append("pageNumbers", splitRange);
                }
            }

            if (tool.id === "compress") {
                // Backend "optimizeLevel" bekliyor (0=dusuk, 1=orta, 2=yuksek)
                const levelMap = { low: "0", medium: "1", high: "2" };
                formData.append("optimizeLevel", levelMap[compressQuality]);
            }

            setProgress(20);
            setStatus("Sunucuya gönderiliyor...");

            const response = await fetch(API_ENDPOINTS[tool.id], {
                method: "POST",
                body: formData,
            });

            setProgress(60);
            setStatus("İşleniyor...");

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.error || "İşlem sırasında bir hata oluştu"
                );
            }

            setProgress(80);
            setStatus("Sonuç alınıyor...");

            // Get result as blob
            const blob = await response.blob();
            const downloadUrl = URL.createObjectURL(blob);

            setProgress(100);
            setStatus("Tamamlandı!");
            setResult(downloadUrl);

            toast.success("İşlem başarıyla tamamlandı!");
        } catch (error) {
            console.error("[PDF Tools] Error:", error);
            toast.error(
                error instanceof Error
                    ? error.message
                    : "İşlem sırasında bir hata oluştu"
            );
            setProgress(0);
            setStatus("");
        } finally {
            setLoading(false);
        }
    }, [tool, files, splitMode, splitRange, compressQuality]);

    const handleDownload = useCallback(() => {
        if (!result || !tool) return;

        const link = document.createElement("a");
        link.href = result;

        // Generate filename based on tool
        const timestamp = new Date().toISOString().slice(0, 10);
        let filename = "";
        switch (tool.id) {
            case "merge":
                filename = `birleştirilmiş_${timestamp}.pdf`;
                break;
            case "split":
                filename = `ayrılmış_${timestamp}.zip`;
                break;
            case "compress":
                filename = `sıkıştırılmış_${timestamp}.pdf`;
                break;
            case "word-to-pdf":
            case "excel-to-pdf":
                filename = `dönüştürülmüş_${timestamp}.pdf`;
                break;
            case "pdf-to-word":
                filename = `dönüştürülmüş_${timestamp}.docx`;
                break;
            default:
                filename = `sonuç_${timestamp}`;
        }

        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success("Dosya indiriliyor...");
    }, [result, tool]);

    if (!tool) return null;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        <div
                            className={cn(
                                "p-2 rounded-xl bg-gradient-to-br text-white",
                                tool.gradientFrom,
                                tool.gradientTo
                            )}
                        >
                            <Icon icon={tool.icon} className="h-5 w-5" />
                        </div>
                        {tool.title}
                    </DialogTitle>
                    <DialogDescription>{tool.description}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* File Upload */}
                    <FileDropZone
                        files={files}
                        onFilesChange={setFiles}
                        acceptedTypes={tool.acceptedTypes}
                        multiple={tool.multiple}
                        disabled={loading}
                    />

                    {/* Tool-specific Options */}
                    {tool.id === "split" && files.length > 0 && (
                        <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                            <Label className="font-medium text-sm">Ayırma Seçenekleri</Label>
                            <div className="grid gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="splitMode" className="text-xs">Ayırma Modu</Label>
                                    <Select
                                        value={splitMode}
                                        onValueChange={(v) =>
                                            setSplitMode(v as "all" | "range")
                                        }
                                        disabled={loading}
                                    >
                                        <SelectTrigger className="w-full h-9 text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">
                                                Tüm sayfaları ayır (her sayfa ayrı PDF)
                                            </SelectItem>
                                            <SelectItem value="range">
                                                Belirli aralık
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {splitMode === "range" && (
                                    <div className="space-y-1.5">
                                        <Label htmlFor="splitRange" className="text-xs">
                                            Sayfa Aralığı
                                        </Label>
                                        <Input
                                            id="splitRange"
                                            placeholder="örnek: 1-3, 5, 7-10"
                                            value={splitRange}
                                            onChange={(e) =>
                                                setSplitRange(e.target.value)
                                            }
                                            disabled={loading}
                                            className="h-9 text-sm"
                                        />
                                        <p className="text-[10px] text-muted-foreground">
                                            Virgül ile ayırarak birden fazla aralık belirtebilirsiniz
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {tool.id === "compress" && files.length > 0 && (
                        <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                            <Label className="font-medium text-sm">Sıkıştırma Kalitesi</Label>
                            <Select
                                value={compressQuality}
                                onValueChange={(v) =>
                                    setCompressQuality(v as "low" | "medium" | "high")
                                }
                                disabled={loading}
                            >
                                <SelectTrigger className="w-full h-9 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low">
                                        Düşük Kalite (En küçük boyut)
                                    </SelectItem>
                                    <SelectItem value="medium">
                                        Orta Kalite (Dengeli)
                                    </SelectItem>
                                    <SelectItem value="high">
                                        Yüksek Kalite (En iyi görünüm)
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Progress */}
                    {loading && <ProgressBar progress={progress} status={status} />}

                    {/* Result */}
                    {result && (
                        <div className="p-3 rounded-lg border border-green-500/30 bg-green-500/5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-green-500/10 shrink-0">
                                    <Icon
                                        icon="solar:check-read-bold"
                                        className="h-5 w-5 text-green-500"
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm text-green-700 dark:text-green-400">
                                        İşlem Tamamlandı!
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Dosyanız indirmeye hazır
                                    </p>
                                </div>
                                <Button
                                    onClick={handleDownload}
                                    size="sm"
                                    className="bg-green-500 hover:bg-green-600 shrink-0"
                                >
                                    <Icon
                                        icon="solar:download-bold"
                                        className="h-4 w-4 mr-1.5"
                                    />
                                    İndir
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-2 border-t">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleClose(false)}
                            disabled={loading}
                        >
                            {result ? "Kapat" : "İptal"}
                        </Button>
                        {!result && (
                            <Button
                                onClick={handleProcess}
                                size="sm"
                                disabled={loading || files.length === 0}
                                className={cn(
                                    "bg-gradient-to-r",
                                    tool.gradientFrom,
                                    tool.gradientTo,
                                    "text-white border-0"
                                )}
                            >
                                {loading ? (
                                    <>
                                        <Icon
                                            icon="solar:refresh-bold"
                                            className="h-4 w-4 mr-1.5 animate-spin"
                                        />
                                        İşleniyor...
                                    </>
                                ) : (
                                    <>
                                        <Icon
                                            icon="solar:play-bold"
                                            className="h-4 w-4 mr-1.5"
                                        />
                                        Başlat
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ====================
// MAIN COMPONENT
// ====================

export function AraclarModule() {
    const [selectedTool, setSelectedTool] = useState<PdfTool | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    const handleToolClick = useCallback((tool: PdfTool) => {
        setSelectedTool(tool);
        setDialogOpen(true);
    }, []);

    return (
        <div className="flex flex-col h-full p-1">
            <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-border/60 bg-card/50 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b">
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Icon
                            icon="solar:documents-bold"
                            className="h-6 w-6 text-primary"
                        />
                        PDF Araçları
                    </h1>
                    <p className="text-muted-foreground">
                        PDF dosyalarınızı kolayca birleştirin, ayırın, sıkıştırın ve
                        dönüştürün.
                    </p>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6 space-y-6">
                    {/* Tools Grid */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {PDF_TOOLS.map((tool) => (
                            <ToolCard
                                key={tool.id}
                                tool={tool}
                                onClick={() => handleToolClick(tool)}
                            />
                        ))}
                    </div>

                    {/* Info Card */}
                    <Card className="border-primary/20 bg-primary/5">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Icon
                                    icon="solar:info-circle-bold"
                                    className="h-5 w-5 text-primary"
                                />
                                Bilgilendirme
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground space-y-2">
                            <p>
                                <strong>Güvenlik:</strong> Tüm dosyalar sunucuda
                                işlendikten sonra otomatik olarak silinir.
                            </p>
                            <p>
                                <strong>Boyut Limiti:</strong> Maksimum 50MB boyutunda
                                dosya yükleyebilirsiniz.
                            </p>
                            <p>
                                <strong>Desteklenen Formatlar:</strong> PDF, DOC, DOCX,
                                XLS, XLSX
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Tool Dialog */}
            <ToolDialog
                tool={selectedTool}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
            />
        </div>
    );
}

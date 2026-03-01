// Task Management Types

export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "todo" | "in_progress" | "completed";
export type TaskFilterStatus = TaskStatus | "all" | "overdue";

// Basit kullanıcı bilgisi
export interface TaskUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

// Basit müşteri bilgisi
export interface TaskCustomer {
  id: string;
  unvan: string;
  kisaltma?: string | null;
}

// Görev yorumu
export interface TaskComment {
  id: string;
  content: string;
  userId: string;
  user: TaskUser;
  createdAt: string;
  updatedAt: string;
}

// Görev eki
export interface TaskAttachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType?: string | null;
  size: number;
  url: string;
  uploadedById: string;
  createdAt: string;
}

// Atanan kullanıcı
export interface TaskAssignee {
  id: string;
  userId: string;
  user: TaskUser;
  assignedAt: string;
}

// Ana görev tipi
export interface Task {
  id: string;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string | null;
  createdById: string;
  createdBy: TaskUser;
  tenantId: string;
  customerId?: string | null;
  customer?: TaskCustomer | null;
  assignees: TaskAssignee[];
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
  _count?: {
    comments: number;
    attachments: number;
  };
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
}

// Liste görünümü için basitleştirilmiş görev
export interface TaskListItem {
  id: string;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string | null;
  createdById: string;
  createdBy: TaskUser;
  assignees: TaskAssignee[];
  customer?: TaskCustomer | null;
  _count: {
    comments: number;
    attachments: number;
  };
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
}

// Görev oluşturma input'u
export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string;
  assigneeIds?: string[];
  customerId?: string;
}

// Görev güncelleme input'u
export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  status?: TaskStatus;
}

// Filtre state'i
export interface TaskFilterState {
  status: TaskFilterStatus;
  priority: TaskPriority | "all";
  assigneeId: string | "all";
  searchTerm: string;
}

// Dashboard istatistikleri
export interface TaskStats {
  lowPriority: number;
  mediumPriority: number;
  highPriority: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  todoCount: number;
  inProgressCount: number;
}

// API Response tipleri
export interface TasksResponse {
  tasks: TaskListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TaskDetailResponse {
  task: Task;
}

// Yorum oluşturma input'u
export interface CreateCommentInput {
  content: string;
}

// Dosya yükleme response'u
export interface UploadAttachmentResponse {
  attachment: TaskAttachment;
}

// Priority config (UI için)
export const PRIORITY_CONFIG = {
  low: {
    label: "Low",
    labelTr: "Düşük",
    color: "yellow",
    bgClass: "bg-yellow-100",
    textClass: "text-yellow-700",
    borderClass: "border-yellow-300",
    iconColor: "#EAB308",
  },
  medium: {
    label: "Medium",
    labelTr: "Orta",
    color: "orange",
    bgClass: "bg-orange-100",
    textClass: "text-orange-700",
    borderClass: "border-orange-300",
    iconColor: "#F97316",
  },
  high: {
    label: "High",
    labelTr: "Yüksek",
    color: "red",
    bgClass: "bg-red-100",
    textClass: "text-red-700",
    borderClass: "border-red-300",
    iconColor: "#EF4444",
  },
} as const;

// Status config (UI için)
export const STATUS_CONFIG = {
  todo: {
    label: "To do",
    labelTr: "Yapılacak",
    color: "gray",
    bgClass: "bg-gray-100",
    textClass: "text-gray-700",
    borderClass: "border-gray-300",
  },
  in_progress: {
    label: "Doing",
    labelTr: "Devam Ediyor",
    color: "blue",
    bgClass: "bg-blue-100",
    textClass: "text-blue-700",
    borderClass: "border-blue-300",
  },
  completed: {
    label: "Completed",
    labelTr: "Tamamlandı",
    color: "green",
    bgClass: "bg-green-100",
    textClass: "text-green-700",
    borderClass: "border-green-300",
  },
} as const;

// Overdue config (computed status için)
export const OVERDUE_CONFIG = {
  label: "Overdue",
  labelTr: "Gecikmiş",
  color: "red",
  bgClass: "bg-red-100",
  textClass: "text-red-700",
  borderClass: "border-red-300",
} as const;

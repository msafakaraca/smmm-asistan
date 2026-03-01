/**
 * Dashboard Types
 *
 * Dashboard sayfası için kullanılan tüm type tanımları.
 */

// ============================================
// STATS TYPES
// ============================================

/**
 * Müşteri istatistikleri
 */
export interface CustomerStats {
  total: number;
  firma: number;
  sahis: number;
  basitUsul: number;
  active: number;
  passive: number;
  pending: number;
  emailMissing: number;
  telefonMissing: number;
  newThisMonth: number;
  recentCustomers: RecentCustomer[];
  groups: CustomerGroupStat[];
}

/**
 * Son eklenen müşteri
 */
export interface RecentCustomer {
  id: string;
  kisaltma: string | null;
  unvan: string;
  createdAt: string;
}

/**
 * Müşteri grubu istatistiği
 */
export interface CustomerGroupStat {
  id: string;
  name: string;
  color: string;
  count: number;
}

/**
 * Beyanname türü istatistikleri (eski format - beyanname_takip tablosu için)
 */
export interface DeclarationTypeStats {
  code: string;
  name: string;
  verildi: number;
  bekliyor: number;
  verilmeyecek: number;
  bos: number;
  total: number;
}

/**
 * Kontrol çizelgesi beyanname türü istatistikleri (yeni format)
 * KDV, MUHSGK, KDV2 çizelgelerinden gelen gerçek veriler
 */
export interface KontrolDeclarationStats {
  code: string;
  name: string;
  total: number;
  verildi: number;
  eksik: number;
  bekliyor: number;
  verilmeyecek: number;
  route: string;
  hasDetailPage: boolean; // Detay çizelgesi var mı?
}

/**
 * Dashboard beyanname durum paneli verileri
 */
export interface DashboardDeclarationData {
  declarations: KontrolDeclarationStats[];
  summary: {
    total: number;
    verildi: number;
    completionRate: number;
  };
  period: {
    year: number;
    month: number;
  };
}

/**
 * Beyanname istatistikleri
 */
export interface DeclarationStats {
  total: number;
  verildi: number;
  bekliyor: number;
  verilmeyecek: number;
  bos: number;
  completionRate: number;
  byType: DeclarationTypeStats[];
}

/**
 * Görev istatistikleri
 */
export interface TaskStats {
  total: number;
  completed: number;
  overdue: number;
  highPriority: number;
  todoCount: number;
  inProgressCount: number;
}

/**
 * Şifre tamamlanma istatistikleri
 */
export interface CredentialStats {
  totalCustomers: number;
  gibComplete: number;
  sgkComplete: number;
  gibCompletionRate: number;
  sgkCompletionRate: number;
}

/**
 * Dashboard ana istatistikleri
 */
export interface DashboardStats {
  customers: CustomerStats;
  declarations: DeclarationStats;
  tasks: TaskStats;
  credentials: CredentialStats;
  period: {
    year: number;
    month: number;
  };
}

// ============================================
// ALERT TYPES
// ============================================

/**
 * Uyarı türleri
 */
export type AlertType = "warning" | "error" | "info" | "success";

/**
 * Dashboard uyarısı
 */
export interface DashboardAlert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  link?: string;
  linkText?: string;
  createdAt: string;
  count?: number;
}

// ============================================
// ACTIVITY TYPES
// ============================================

/**
 * Aktivite türleri (audit.ts AuditAction ile senkron)
 */
export type ActivityAction =
  | "LOGIN"
  | "LOGOUT"
  | "LOGIN_FAILED"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "VIEW"
  | "VIEW_SENSITIVE"
  | "EXPORT"
  | "IMPORT"
  | "BULK_DELETE"
  | "BULK_UPDATE"
  | "BOT_START"
  | "BOT_COMPLETE"
  | "BOT_ERROR"
  | "SETTINGS_UPDATE"
  | "PASSWORD_CHANGE"
  | "PERMISSION_CHANGE";

/**
 * Zengin açıklama yapısı (Description Builder çıktısı)
 */
export interface ActivityDescription {
  primary: string;
  secondary?: string;
  meta?: {
    entityName?: string;
    changedFields?: string[];
  };
}

/**
 * Aktivite filtresi
 */
export interface ActivityFilter {
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Sayfalanmış aktivite API response
 */
export interface ActivityPageResponse {
  activities: ActivityItem[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Aktivite kaydı
 */
export interface ActivityItem {
  id: string;
  action: ActivityAction;
  resource: string;
  resourceId?: string;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  details?: Record<string, unknown>;
  description?: ActivityDescription;
  timestamp: string;
}

// ============================================
// CHART DATA TYPES
// ============================================

/**
 * Pasta grafik verisi
 */
export interface PieChartData {
  name: string;
  value: number;
  color: string;
}

/**
 * Bar grafik verisi
 */
export interface BarChartData {
  name: string;
  value: number;
  color?: string;
}

// ============================================
// PERIOD TYPES
// ============================================

/**
 * Dönem seçici
 */
export interface PeriodSelection {
  year: number;
  month: number;
}

// ============================================
// UPCOMING REMINDER/NOTE TYPES
// ============================================

/**
 * Yaklaşan anımsatıcı/not için müşteri bilgisi
 */
export interface UpcomingReminderCustomer {
  id: string;
  unvan: string;
  kisaltma?: string | null;
}

/**
 * Yaklaşan anımsatıcı
 */
export interface UpcomingReminder {
  id: string;
  title: string;
  description?: string | null;
  type: "event" | "task"; // event = anımsatıcı, task = not
  date: string;
  isAllDay: boolean;
  startTime?: string | null;
  endTime?: string | null;
  status: "active" | "completed" | "cancelled";
  customer?: UpcomingReminderCustomer | null;
  customers?: UpcomingReminderCustomer[];
  daysUntil: number; // Kalan gün sayısı
}

// ============================================
// TASK SUMMARY TYPES (Dashboard Widget)
// ============================================

/**
 * Görev özeti listesi öğesi
 */
export interface TaskSummaryItem {
  id: string;
  title: string;
  description?: string | null;
  priority: "low" | "medium" | "high";
  status: "todo" | "in_progress" | "completed";
  dueDate: string | null;
  createdAt: string;
  daysOverdue?: number;
  daysUntil?: number;
  customer?: {
    id: string;
    unvan: string;
    kisaltma?: string | null;
  } | null;
  createdBy?: {
    id: string;
    fullName: string;
  } | null;
  assignees: {
    id: string;
    fullName: string;
    image?: string | null;
  }[];
  tags: string[];
}

/**
 * Görev özeti istatistikleri
 */
export interface TaskSummaryStats {
  total: number;
  completed: number;
  inProgress: number;
  todo: number;
  overdue: number;
  highPriority: number;
  mediumPriority: number;
  lowPriority: number;
  // Haftalık karşılaştırma
  weeklyComparison: {
    completedThisWeek: number;
    completedLastWeek: number;
    createdThisWeek: number;
    createdLastWeek: number;
    trend: "up" | "down" | "stable";
    changePercent: number;
  };
  // Bugün bitenler
  dueToday: number;
  dueTomorrow: number;
}

/**
 * Atanan kişi bazlı görev özeti
 */
export interface AssigneeTaskSummary {
  id: string;
  fullName: string;
  image?: string | null;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  completionRate: number;
}

/**
 * Dashboard Görev Özeti Response
 */
export interface TaskSummaryData {
  stats: TaskSummaryStats;
  overdueTasks: TaskSummaryItem[];
  upcomingTasks: TaskSummaryItem[];
  todayTasks: TaskSummaryItem[];
  assigneeSummary: AssigneeTaskSummary[];
  recentlyCompleted: TaskSummaryItem[];
}

// ============================================
// TAKIP CIZELGESI TYPES
// ============================================

/**
 * Takip çizelgesinde tamamlanan/iptal edilen mükellef
 */
export interface TakipCompletedItem {
  id: string;
  isim: string;
  completedAt?: string;
  completedBy?: string; // Tamamlayan kullanıcı adı
  isCancelled?: boolean; // true ise iptal (yapılmayacak)
}

/**
 * Takip çizelgesi istatistikleri
 */
export interface TakipStats {
  total: number; // Toplam mükellef (satır) sayısı
  completed: number; // SONDUR=true olan satır sayısı
  cancelled: number; // SONDUR=false olan satır sayısı (yapılmayacak)
  handled: number; // completed + cancelled (işlenmiş)
  pending: number; // total - handled (gerçek eksik)
  completionRate: number; // handled/total * 100
  period: {
    year: number;
    month: number;
  };
  recentCompleted: TakipCompletedItem[]; // En son işlenen mükellefler
}

/**
 * Takip çizelgesi kolon bazlı istatistik
 */
export interface TakipColumnStat {
  kod: string;
  baslik: string;
  total: number;
  handled: number; // true + false
  pending: number; // null
  trueCount: number; // tamam
  falseCount: number; // iptal
  rate: number; // handled/total * 100
}

/**
 * Takip çizelgesi kolon bazlı istatistikler
 */
export interface TakipColumnStats {
  columns: TakipColumnStat[];
  period: { year: number; month: number };
}

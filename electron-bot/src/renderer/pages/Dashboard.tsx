import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Building2, LogOut, ShieldCheck, Globe, FileText, CreditCard, Mail, Monitor,
  BookOpen, Building, FileSpreadsheet, ChevronDown, Search, FileDigit, Download,
  Briefcase, Bookmark, Users, ClipboardList, ClipboardCheck, UserCog, UserPlus,
  CheckCircle, AlertTriangle, XCircle, Newspaper, Network, Power,
  Activity, Fingerprint, Loader2, X
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface DashboardProps {
  user: { name?: string; email?: string };
  onLogout: () => void;
}

interface CustomerItem {
  id: string;
  unvan: string;
  kisaltma: string | null;
  vknTckn: string;
  sirketTipi: string;
  hasGibCredentials: boolean;
  hasEdevletCredentials: boolean;
  hasTurmobCredentials: boolean;
  hasIskurCredentials: boolean;
}

interface HistoryEntry {
  time: string;
  text: string;
  status: 'success' | 'error' | 'info';
}

// ============================================================================
// LINK DEFINITIONS
// ============================================================================

interface LinkDef {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  credentialType: string;
  application?: string;
  targetPage?: string;
  needsCustomer?: boolean;
  disabled?: boolean;
}

const MM_LINKS: LinkDef[] = [
  { id: 'mm-ivd', title: 'Yeni İnternet Vergi Dairesi', icon: Globe, credentialType: 'gib-mm', application: 'ivd' },
  { id: 'mm-ebeyanname', title: 'E-Beyanname Sistemi', icon: FileText, credentialType: 'gib-mm', application: 'ebeyanname' },
  { id: 'mm-digital-gib', title: 'Digital.gib / Borç Sorgulama', icon: CreditCard, credentialType: 'gib-mm', application: 'ivd', targetPage: 'borc-sorgulama' },
  { id: 'mm-etebligat', title: 'E-Tebligat Sorgulama', icon: Mail, credentialType: 'gib-mm', application: 'ivd', targetPage: 'e-tebligat' },
  { id: 'mm-interaktif-vd', title: 'İnteraktif Vergi Dairesi', icon: Monitor, credentialType: 'gib-mm', application: 'interaktifvd' },
  { id: 'defter-beyan', title: 'Defter Beyan Sistemi', icon: BookOpen, credentialType: 'gib-mm', application: 'defter-beyan' },
  { id: 'edevlet', title: 'E-Devlet Kapısı', icon: Building, credentialType: 'edevlet-mm' },
  { id: 'ebeyan', title: 'E-Beyan Sistemi', icon: FileSpreadsheet, credentialType: 'gib-mm', application: 'ebeyan' },
];

const MUKELLEF_LINKS: LinkDef[] = [
  { id: 'ivd', title: 'Yeni İnternet Vergi Dairesi', icon: Globe, credentialType: 'gib', application: 'ivd', needsCustomer: true },
  { id: 'ebeyanname', title: 'E-Beyanname Sistemi', icon: FileText, credentialType: 'gib', application: 'ebeyanname', needsCustomer: true },
  { id: 'digital-gib', title: 'Digital.gib / Borç Sorgulama', icon: CreditCard, credentialType: 'gib', application: 'ivd', targetPage: 'borc-sorgulama', needsCustomer: true },
  { id: 'etebligat', title: 'E-Tebligat Sorgulama', icon: Mail, credentialType: 'gib', application: 'ivd', targetPage: 'e-tebligat', needsCustomer: true },
  { id: 'edevlet-mukellef', title: 'E-Devlet Kapısı', icon: Building, credentialType: 'edevlet', needsCustomer: true },
  { id: 'gib-5000', title: 'GİB 5000/2000', icon: FileDigit, credentialType: 'gib', needsCustomer: true },
  { id: 'vergi-levhasi', title: 'Vergi Levhası İndir', icon: Download, credentialType: 'gib', application: 'ivd', targetPage: 'vergi-levhasi', needsCustomer: true },
  { id: 'turmob-luca', title: 'TÜRMOB Luca E-Entegratör', icon: Briefcase, credentialType: 'turmob', needsCustomer: true },
  { id: 'edefter', title: 'GİB E-Defter Sistemi', icon: Bookmark, credentialType: 'gib', application: 'edefter', needsCustomer: true },
  { id: 'iskur', title: 'İŞKUR İşveren Sistemi', icon: Users, credentialType: 'iskur', needsCustomer: true },
];

const SGK_LINKS: LinkDef[] = [
  { id: 'ebildirge', title: 'E-Bildirge', icon: ClipboardList, credentialType: 'sgk', disabled: true },
  { id: 'ebildirge-v2', title: 'E-Bildirge V2', icon: ClipboardCheck, credentialType: 'sgk', disabled: true },
  { id: 'isveren', title: 'İşveren Sistemi', icon: UserCog, credentialType: 'sgk', disabled: true },
  { id: 'sigortali-giris-cikis', title: 'Sigortalı İşe Giriş/Çıkış', icon: UserPlus, credentialType: 'sgk', disabled: true },
  { id: 'eborcu-yoktur', title: 'E-Borcu Yoktur', icon: CheckCircle, credentialType: 'sgk', disabled: true },
  { id: 'is-kazasi', title: 'İş Kazası E-Bildirim', icon: AlertTriangle, credentialType: 'sgk', disabled: true },
];

const DIGER_LINKS: LinkDef[] = [
  { id: 'efatura-iptal', title: 'E-Fatura İptal/İtiraz Portalı', icon: XCircle, credentialType: 'diger' },
  { id: 'ticaret-sicil', title: 'Ticaret Sicili Gazetesi', icon: Newspaper, credentialType: 'diger', disabled: true },
  { id: 'turmob-ebirlik', title: 'TÜRMOB E-Birlik Sistemi', icon: Building2, credentialType: 'diger', disabled: true },
];

// ============================================================================
// LOCALSTORAGE HELPERS
// ============================================================================

const HISTORY_KEY = 'dashboard-history';
const MAX_HISTORY = 10;

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

// ============================================================================
// ANA BİLEŞEN
// ============================================================================

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
  const [sgkSelectedCustomer, setSgkSelectedCustomer] = useState<CustomerItem | null>(null);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [launchingLink, setLaunchingLink] = useState<string | null>(null);
  const [launchStatus, setLaunchStatus] = useState<string>('');
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [vergiLevhasiPopup, setVergiLevhasiPopup] = useState<{ link: LinkDef; customer: CustomerItem } | null>(null);
  const mukellefCardRef = useRef<HTMLDivElement>(null);
  const actionsScrollRef = useRef<HTMLDivElement>(null);

  // Müşteri listesini al
  useEffect(() => {
    (async () => {
      try {
        const result = await window.electron?.dashboard?.getCustomers();
        if (result?.success && result.customers) {
          setCustomers(result.customers);
        }
      } catch (e) {
        console.error('Müşteri listesi alınamadı:', e);
      } finally {
        setLoadingCustomers(false);
      }
    })();
  }, []);

  // Launch event listener'ları
  useEffect(() => {
    window.electron?.dashboard?.onLaunchProgress((data: { status: string }) => {
      setLaunchStatus(data.status);
    });
    window.electron?.dashboard?.onLaunchError(() => {
      setLaunchingLink(null);
      setLaunchStatus('');
    });
    window.electron?.dashboard?.onLaunchComplete(() => {
      setLaunchingLink(null);
      setLaunchStatus('');
    });
  }, []);

  const addHistory = useCallback((text: string, status: 'success' | 'error' | 'info') => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setHistory((prev) => {
      const next = [{ time, text, status }, ...prev].slice(0, MAX_HISTORY);
      saveHistory(next);
      return next;
    });
  }, []);

  const handleLinkClick = useCallback(async (link: LinkDef, customer?: CustomerItem | null, extra?: { vergiLevhasiYil?: string; vergiLevhasiDil?: string }) => {
    if (link.disabled) {
      addHistory(`${link.title} — Bu özellik henüz aktif değil, yakında kullanıma açılacak`, 'info');
      return;
    }

    if (link.needsCustomer && !customer) {
      addHistory(`${link.title} — İşleme devam etmek için yukarıdan bir mükellef seçin`, 'info');
      return;
    }

    // Vergi levhası — popup aç
    if (link.id === 'vergi-levhasi' && !extra) {
      if (!customer) return;
      setVergiLevhasiPopup({ link, customer });
      return;
    }

    setLaunchingLink(link.id);
    setLaunchStatus('Başlatılıyor...');

    try {
      const result = await window.electron?.dashboard?.launch({
        linkId: link.id,
        customerId: customer?.id,
        credentialType: link.credentialType,
        application: link.application,
        targetPage: link.targetPage,
        ...extra,
      });

      if (result?.success) {
        addHistory(`${link.title} başarıyla başlatıldı`, 'success');
      } else {
        addHistory(result?.error || `${link.title} açılamadı. Lütfen tekrar deneyin.`, 'error');
      }
    } catch (e: any) {
      addHistory(e.message || `${link.title} — Sunucu ile bağlantı kurulamadı`, 'error');
    } finally {
      setLaunchingLink(null);
      setLaunchStatus('');
    }
  }, [addHistory]);

  // Kullanıcı adı kısaltması
  const userName = user?.name || user?.email || 'Kullanıcı';
  const initials = userName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col h-screen bg-[#e8ecf1] font-sans select-none">
      {/* Uygulama Üst Header Bar */}
      <div style={{ height: '56px', backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px 0 28px', flexShrink: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', zIndex: 10 }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center border border-blue-200">
            <span className="text-xs font-bold text-blue-700">{initials}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold text-slate-800 leading-none">{userName}</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-medium text-emerald-600 uppercase tracking-wide">Sisteme Bağlı</span>
            </div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Çıkış Yap
        </button>
      </div>

      {/* Ana İçerik Alanı (2 Kolon) */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '20px 24px', gap: '20px' }}>
        {/* SOL KOLON (Sidebar — Bot Durumu + Son İşlemler) */}
        <div style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Bot Aktif Kartı */}
          <div style={{
            backgroundColor: '#0f172a',
            borderRadius: '16px',
            padding: '16px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            border: '1px solid #1e293b',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: '-24px', right: '-24px', width: '64px', height: '64px', background: 'rgba(59,130,246,0.2)', filter: 'blur(24px)', borderRadius: '50%' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative', zIndex: 10 }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(96,165,250,0.3)' }}>
                <Power style={{ width: 16, height: 16, color: '#60a5fa' }} />
              </div>
              <div>
                <div style={{ color: '#fff', fontSize: '14px', fontWeight: 700 }}>Bot Aktif</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <span className="animate-pulse" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#34d399' }} />
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                    {launchingLink ? launchStatus || 'İşlem devam ediyor...' : 'İşlem bekleniyor...'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Son İşlem Geçmişi */}
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{ height: '40px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', padding: '0 16px', backgroundColor: 'rgba(248,250,252,0.5)' }}>
              <Activity style={{ width: 16, height: 16, color: '#94a3b8', marginRight: '8px' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Son İşlemler</span>
            </div>
            <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {history.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#94a3b8' }}>
                  Henüz işlem yok
                </div>
              ) : (
                history.map((entry, i) => (
                  <HistoryItem key={`${entry.time}-${i}`} time={entry.time} text={entry.text} status={entry.status} />
                ))
              )}
            </div>
          </div>

        </div>

        {/* SAĞ KOLON (Scrollable — Quick Actions) */}
        <div ref={actionsScrollRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">

          {/* 1. KART: Meslek Mensubu */}
          <SectionCard title="Meslek Mensubu ile Giriş" icon={ShieldCheck} theme="emerald">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {MM_LINKS.map((link) => (
                <ActionLink
                  key={link.id}
                  link={link}
                  theme="emerald"
                  loading={launchingLink === link.id}
                  onClick={() => handleLinkClick(link)}
                />
              ))}
            </div>
          </SectionCard>

          {/* 2. KART: Mükellef ile Giriş */}
          <div ref={mukellefCardRef}>
          <SectionCard
            title="Mükellef ile Giriş"
            icon={Building2}
            theme="blue"
            dropdown={
              <CustomerDropdown
                customers={customers}
                selected={selectedCustomer}
                onSelect={setSelectedCustomer}
                loading={loadingCustomers}
                scrollContainer={actionsScrollRef}
              />
            }
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {MUKELLEF_LINKS.map((link) => (
                <ActionLink
                  key={link.id}
                  link={link}
                  theme="blue"
                  loading={launchingLink === link.id}
                  onClick={() => handleLinkClick(link, selectedCustomer)}
                />
              ))}
            </div>
          </SectionCard>
          </div>

          {/* 3. KART: SGK İşlemleri */}
          <SectionCard
            title="SGK İşlemleri"
            icon={Fingerprint}
            theme="orange"
            dropdown={
              <CustomerDropdown
                customers={customers}
                selected={sgkSelectedCustomer}
                onSelect={setSgkSelectedCustomer}
                loading={loadingCustomers}
                scrollContainer={actionsScrollRef}
              />
            }
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {SGK_LINKS.map((link) => (
                <ActionLink
                  key={link.id}
                  link={link}
                  theme="orange"
                  loading={launchingLink === link.id}
                  onClick={() => handleLinkClick(link)}
                />
              ))}
            </div>
          </SectionCard>

          {/* 4. KART: Diğer İşlemler */}
          <SectionCard title="Diğer İşlemler" icon={Network} theme="purple">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {DIGER_LINKS.map((link) => (
                <ActionLink
                  key={link.id}
                  link={link}
                  theme="purple"
                  loading={launchingLink === link.id}
                  onClick={() => handleLinkClick(link)}
                />
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Vergi Levhası Popup */}
      {vergiLevhasiPopup && (
        <VergiLevhasiPopup
          customer={vergiLevhasiPopup.customer}
          onSelect={(yil, dil) => {
            const { link, customer } = vergiLevhasiPopup;
            setVergiLevhasiPopup(null);
            handleLinkClick(link, customer, { vergiLevhasiYil: yil, vergiLevhasiDil: dil });
          }}
          onClose={() => setVergiLevhasiPopup(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// VERGİ LEVHASI POPUP
// ============================================================================

function VergiLevhasiPopup({
  customer,
  onSelect,
  onClose,
}: {
  customer: CustomerItem;
  onSelect: (yil: string, dil: string) => void;
  onClose: () => void;
}) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 4 }, (_, i) => String(currentYear - i));
  const [selectedDil, setSelectedDil] = useState('tr');
  const [selectedYil, setSelectedYil] = useState(String(currentYear));
  const popupRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Uygulamanın ortasına hizala
  useEffect(() => {
    setPos({
      top: (window.innerHeight - 260) / 2,
      left: (window.innerWidth - 300) / 2,
    });
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  if (!pos) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.2)', zIndex: 100 }}>
      <div ref={popupRef} style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        backgroundColor: '#fff',
        borderRadius: '12px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
        border: '1px solid #e2e8f0',
        width: '300px',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '10px 14px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Download style={{ width: 15, height: 15, color: '#2563eb' }} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>Vergi Levhası İndir</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}>
            <X style={{ width: 14, height: 14, color: '#94a3b8' }} />
          </button>
        </div>

        {/* Mükellef */}
        <div style={{ padding: '8px 14px', backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>{customer.kisaltma || customer.unvan}</span>
          <span style={{ fontSize: '10px', color: '#94a3b8', marginLeft: '6px' }}>{customer.vknTckn}</span>
        </div>

        {/* Dil + Yıl */}
        <div style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dil</div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            {[{ value: 'tr', label: 'Türkçe' }, { value: 'en', label: 'İngilizce' }].map((d) => (
              <button
                key={d.value}
                onClick={() => setSelectedDil(d.value)}
                style={{
                  flex: 1,
                  padding: '5px 0',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: selectedDil === d.value ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                  backgroundColor: selectedDil === d.value ? '#eff6ff' : '#fff',
                  color: selectedDil === d.value ? '#2563eb' : '#64748b',
                  cursor: 'pointer',
                }}
              >
                {d.label}
              </button>
            ))}
          </div>

          <div style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Yıl</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px' }}>
            {years.map((y) => (
              <button
                key={y}
                onClick={() => setSelectedYil(y)}
                style={{
                  padding: '6px 0',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: selectedYil === y ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                  backgroundColor: selectedYil === y ? '#eff6ff' : '#fff',
                  color: selectedYil === y ? '#2563eb' : '#374151',
                  cursor: 'pointer',
                }}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        {/* İndir */}
        <div style={{ padding: '0 14px 12px' }}>
          <button
            onClick={() => onSelect(selectedYil, selectedDil)}
            style={{
              width: '100%',
              padding: '8px 0',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
          >
            <Download style={{ width: 13, height: 13 }} />
            İndir
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ALT BİLEŞENLER
// ============================================================================

const themeStyles = {
  emerald: { headerBg: 'rgba(236,253,245,0.8)', borderColor: '#10b981', textColor: '#065f46', iconColor: '#059669' },
  blue: { headerBg: 'rgba(239,246,255,0.8)', borderColor: '#2563eb', textColor: '#1e40af', iconColor: '#2563eb' },
  orange: { headerBg: 'rgba(255,247,237,0.8)', borderColor: '#f97316', textColor: '#9a3412', iconColor: '#ea580c' },
  purple: { headerBg: 'rgba(250,245,255,0.8)', borderColor: '#8b5cf6', textColor: '#6b21a8', iconColor: '#7c3aed' },
};

function SectionCard({
  title,
  icon: Icon,
  theme,
  dropdown,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  theme: keyof typeof themeStyles;
  dropdown?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = themeStyles[theme];
  return (
    <div data-section-card style={{
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        height: '38px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        borderLeft: `3px solid ${t.borderColor}`,
        borderBottom: '1px solid #f1f5f9',
        backgroundColor: t.headerBg,
        borderTopLeftRadius: '11px',
        borderTopRightRadius: '11px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon style={{ width: 16, height: 16, color: t.iconColor }} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: t.textColor, letterSpacing: '0.025em' }}>{title}</span>
        </div>
        {dropdown}
      </div>
      <div style={{ padding: '12px' }}>
        {children}
      </div>
    </div>
  );
}

const hoverColors: Record<string, { border: string; shadow: string; bg: string; icon: string }> = {
  emerald: { border: '#6ee7b7', shadow: 'rgba(16,185,129,0.18)', bg: '#ecfdf5', icon: '#059669' },
  blue: { border: '#93c5fd', shadow: 'rgba(37,99,235,0.18)', bg: '#eff6ff', icon: '#2563eb' },
  orange: { border: '#fdba74', shadow: 'rgba(249,115,22,0.18)', bg: '#fff7ed', icon: '#ea580c' },
  purple: { border: '#c4b5fd', shadow: 'rgba(139,92,246,0.18)', bg: '#faf5ff', icon: '#7c3aed' },
};

function ActionLink({
  link,
  loading,
  onClick,
  theme,
}: {
  link: LinkDef;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
  theme: string;
}) {
  const Icon = link.icon;
  const h = hoverColors[theme] || hoverColors.blue;

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        backgroundColor: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: '10px',
        paddingLeft: '14px',
        paddingRight: '12px',
        height: '38px',
        textAlign: 'left',
        cursor: 'pointer',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        transition: 'all 0.2s ease',
        transform: 'translateY(0)',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = h.border;
        el.style.boxShadow = `0 4px 12px ${h.shadow}`;
        el.style.backgroundColor = h.bg;
        el.style.transform = 'translateY(-1px)';
        const icon = el.querySelector('[data-link-icon]') as HTMLElement;
        if (icon) icon.style.color = h.icon;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = '#cbd5e1';
        el.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)';
        el.style.backgroundColor = '#ffffff';
        el.style.transform = 'translateY(0)';
        const icon = el.querySelector('[data-link-icon]') as HTMLElement;
        if (icon) icon.style.color = '#94a3b8';
      }}
    >
      <div data-link-icon style={{ flexShrink: 0, color: loading ? '#3b82f6' : '#94a3b8', transition: 'color 0.2s' }}>
        {loading ? (
          <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} />
        ) : (
          <Icon style={{ width: 14, height: 14 }} />
        )}
      </div>
      <span style={{ fontSize: '12px', fontWeight: 500, color: '#374151', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {link.title}
      </span>
    </button>
  );
}

function HistoryItem({ time, text, status }: HistoryEntry) {
  const dotColor = status === 'success' ? 'bg-emerald-400' : status === 'error' ? 'bg-red-400' : 'bg-blue-400';
  return (
    <div className="flex gap-2 p-1.5 hover:bg-slate-50 rounded cursor-default group">
      <div className="flex flex-col items-center pt-1">
        <div className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0`}></div>
        <div className="w-px h-full bg-slate-100 mt-1 group-last:hidden"></div>
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] text-slate-400 font-medium">{time}</span>
        <span className="text-[11px] text-slate-600 leading-snug mt-0.5">{text}</span>
      </div>
    </div>
  );
}

// ============================================================================
// MÜŞTERİ DROPDOWN BİLEŞENİ
// ============================================================================

function CustomerDropdown({
  customers,
  selected,
  onSelect,
  loading,
  scrollContainer,
}: {
  customers: CustomerItem[];
  selected: CustomerItem | null;
  onSelect: (c: CustomerItem | null) => void;
  loading: boolean;
  scrollContainer?: React.RefObject<HTMLDivElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Dışarıya tıklayınca kapat
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Açılınca input'a focusla ve kartı görünür alana kaydır
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      if (ref.current && scrollContainer?.current) {
        setTimeout(() => {
          const card = ref.current!.closest('[data-section-card]') as HTMLElement;
          if (card) {
            const container = scrollContainer.current!;
            const containerHeight = container.clientHeight;
            const cardHeight = card.offsetHeight;
            // Kartı container'ın ortasına hizala
            const targetScroll = card.offsetTop - (containerHeight - cardHeight) / 2;
            container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
          }
        }, 50);
      }
    }
  }, [open, scrollContainer]);

  const filtered = customers
    .filter((c) => {
      const term = search.toLowerCase();
      const matchesSearch =
        c.unvan.toLowerCase().includes(term) ||
        (c.kisaltma && c.kisaltma.toLowerCase().includes(term)) ||
        c.vknTckn.includes(term);
      return matchesSearch;
    })
    .sort((a, b) => {
      if (typeFilter) {
        const aMatch = a.sirketTipi === typeFilter ? 0 : 1;
        const bMatch = b.sirketTipi === typeFilter ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
      }
      return 0;
    });

  const filterButtons: { value: string; label: string }[] = [
    { value: 'sahis', label: 'Şahıs' },
    { value: 'firma', label: 'Şirket' },
    { value: 'basit_usul', label: 'Basit Usul' },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-2.5 py-1 cursor-pointer hover:border-slate-300 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors group"
      >
        <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-500" />
        <span className="text-[12px] font-medium text-slate-500 min-w-[160px] truncate max-w-[220px]">
          {loading ? 'Yükleniyor...' : selected ? (selected.kisaltma || selected.unvan) : 'Mükellef seç...'}
        </span>
        {selected ? (
          <X
            className="w-3 h-3 text-slate-400 hover:text-red-500"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(null);
            }}
          />
        ) : (
          <ChevronDown className="w-3 h-3 text-slate-400" />
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-[320px] bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
          {/* Arama */}
          <div className="p-2 border-b border-slate-100">
            <div className="flex items-center gap-2 bg-slate-50 rounded px-2 py-1.5">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Mükellef ara..."
                className="flex-1 text-[12px] bg-transparent outline-none text-slate-700 placeholder-slate-400"
              />
            </div>
            {/* Tip Filtresi */}
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              {filterButtons.map((fb) => (
                <button
                  key={fb.value}
                  onClick={() => setTypeFilter(typeFilter === fb.value ? null : fb.value)}
                  style={{
                    flex: 1,
                    padding: '4px 0',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: typeFilter === fb.value ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                    backgroundColor: typeFilter === fb.value ? '#eff6ff' : '#fff',
                    color: typeFilter === fb.value ? '#2563eb' : '#64748b',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {fb.label}
                </button>
              ))}
            </div>
          </div>

          {/* Liste */}
          <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-[11px] text-slate-400">
                {search ? 'Sonuç bulunamadı' : 'Mükellef yok'}
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    onSelect(c);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={`w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0 ${
                    selected?.id === c.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="text-[12px] font-medium text-slate-700 truncate">
                    {c.kisaltma || c.unvan}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {c.vknTckn} • {c.sirketTipi === 'sahis' ? 'Şahıs' : c.sirketTipi === 'firma' ? 'Firma' : 'Basit Usul'}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

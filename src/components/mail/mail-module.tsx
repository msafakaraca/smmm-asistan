"use client";

import React, { useState } from "react";
import {
    Search,
    Plus,
    MoreVertical,
    Archive,
    Trash2,
    Reply,
    ReplyAll,
    Forward,
    Bold,
    Italic,
    Underline as UnderlineIcon,
    Link as LinkIcon,
    Image as ImageIcon,
    Paperclip,
    Smile,
    MoreHorizontal,
    Video,
    Phone,
    Star,
    AlertCircle,
    Clock,
    CheckCircle2,
    LayoutGrid,
    Calendar,
    Mail,
    Briefcase,
    ListTodo,
    ChevronDown,
    Pencil,
    Undo,
    Redo,
    AlignLeft,
    AlignCenter,
    AlignRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

// --- Mock Data ---

interface MailItem {
    id: string;
    sender: {
        name: string;
        email: string;
        avatar?: string;
        initials?: string;
        online?: boolean;
    };
    subject: string;
    preview: string;
    time: string;
    unread: boolean;
    label?: string;
    date: string;
}

const EMAILS: MailItem[] = [
    {
        id: "1",
        sender: { name: "Lemon Squeezy", email: "hello@lemonsqueezy.com", initials: "LS" },
        subject: "Satış yaptınız!",
        preview: "Harika! Bir satış gerçekleştirdiniz!",
        time: "7dk önce",
        unread: false,
        date: "Bugün"
    },
    {
        id: "2",
        sender: { name: "Lemon Squeezy", email: "hello@lemonsqueezy.com", initials: "LS" },
        subject: "Satış yaptınız!",
        preview: "Harika! Bir satış gerçekleştirdiniz!",
        time: "12dk önce",
        unread: false,
        date: "Bugün"
    },
    {
        id: "3",
        sender: { name: "Guy Hawkins", email: "guyhawkins@email.com", initials: "GH", online: true },
        subject: "Güncellemeler",
        preview: "Merhaba, toplantı saatimizi kontrol etmek istiyorum...",
        time: "1s önce",
        unread: true, // Selected in mockup
        date: "Bugün"
    },
    {
        id: "4",
        sender: { name: "Jane Cooper", email: "jane@example.com", initials: "JC" },
        subject: "Randevu",
        preview: "Merhaba, randevu saatimizi teyit etmek istiyorum...",
        time: "2g önce",
        unread: false,
        date: "Dün"
    },
    {
        id: "5",
        sender: { name: "Anna Taylor", email: "anna@example.com", initials: "AT" },
        subject: "UX Detayları",
        preview: "Merhaba, konuştuğumuz UX detaylarını kontrol ediyorum...",
        time: "Geçen hafta",
        unread: false,
        date: "Geçen Hafta"
    },
    {
        id: "6",
        sender: { name: "Anna Taylor", email: "anna@example.com", initials: "AT" },
        subject: "Hayır, bu başka bir şey...",
        preview: "Merhaba, toplantı saatimizi kontrol etmek istiyorum...",
        time: "24 Haziran",
        unread: false,
        date: "Geçen Ay"
    }
];

const THREAD = [
    {
        id: "t1",
        sender: { name: "Guy Hawkins", email: "guyhawkins@email.com", initials: "GH", online: true },
        content: "Güncellemeler",
        time: "1s önce",
        type: "received"
    },
    {
        id: "t2",
        sender: { name: "Anna Taylor", email: "anna.t@email.com", initials: "AT" },
        content: "Bunu yarın güncelleyeceğim.",
        time: "55dk önce",
        type: "sent"
    },
    {
        id: "t3",
        sender: { name: "Guy Hawkins", email: "guyhawkins@email.com", initials: "GH", online: true },
        content: "Teşekkürler, belki bana şurada yardımcı olabilirsin:",
        time: "45dk önce",
        type: "received"
    },
    {
        id: "t4",
        sender: { name: "Anna Taylor", email: "anna.t@email.com", initials: "AT" },
        content: "Teşekkürler! \n\nBen de! Umarım uygulamayı kullanmak daha da kolaylaşır.\n\nGörüşmek üzere!\n- Anna",
        time: "30dk önce",
        type: "sent"
    },
    {
        id: "t5",
        sender: { name: "Guy Hawkins", email: "guyhawkins@email.com", initials: "GH", online: true },
        content: "Sorun değil",
        time: "10dk önce",
        type: "received"
    }
];

export default function MailModule() {
    const [selectedEmail, setSelectedEmail] = useState<string>("3");
    const [searchTerm, setSearchTerm] = useState("");

    const currentEmail = EMAILS.find(e => e.id === selectedEmail);

    return (
        <div className="flex h-[calc(100vh-4rem)] w-[calc(100%+2rem)] xl:w-[calc(100%+3rem)] -mx-4 xl:-mx-6 -my-4 xl:-my-6 bg-[#f8f9fc] text-slate-800 font-sans overflow-hidden">
            {/* Sidebar */}
            <div className="w-56 xl:w-64 bg-white border-r flex flex-col shrink-0">
                {/* User Profile */}
                <div className="p-4 flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-slate-200">
                        <AvatarImage src="/avatar-anna.png" />
                        <AvatarFallback className="bg-orange-100 text-orange-600 font-medium">AT</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">Anna Taylor</p>
                        <p className="text-xs text-muted-foreground truncate">anna.t@email.com</p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground cursor-pointer" />
                </div>

                {/* Navigation */}
                <div className="flex-1 px-3 py-4 space-y-1">
                    <NavItem icon={<LayoutGrid size={20} />} label="Panel" />
                    <NavItem icon={<Calendar size={20} />} label="Takvim" />
                    <NavItem icon={<Mail size={20} />} label="E-Posta" active count={3} />
                    <NavItem icon={<Briefcase size={20} />} label="Çalışma Alanı" />
                    <NavItem icon={<ListTodo size={20} />} label="Görevler" />
                </div>

                {/* Storage Widget */}
                <div className="p-4 mt-auto">
                    <Card className="p-4 bg-slate-50 border-slate-100 shadow-sm relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="h-12 w-12 rounded-full border-4 border-blue-500 border-t-transparent flex items-center justify-center mb-3">
                                <span className="text-xs font-bold text-blue-600">82%</span>
                            </div>
                            <h3 className="font-semibold text-sm mb-1">Daha fazla alan lazım mı?</h3>
                            <p className="text-xs text-muted-foreground mb-3">Size özel planlarımız var</p>
                            <div className="flex items-center gap-3 text-xs font-medium">
                                <span className="underline cursor-pointer">Planı Yükselt</span>
                                <span className="text-muted-foreground cursor-pointer">Kapat</span>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <header className="h-16 bg-white border-b flex items-center justify-between px-4 xl:px-6 shrink-0">
                    <h1 className="text-xl font-bold">E-Posta</h1>
                    <Button variant="outline" className="rounded-full border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800 gap-2 px-6">
                        <Star className="h-4 w-4 fill-purple-700" />
                        Planı Yükselt
                    </Button>
                </header>

                <div className="flex-1 flex min-h-0">
                    {/* Mail List */}
                    <div className="w-[320px] xl:w-[400px] border-r bg-white flex flex-col shrink-0">
                        {/* Search & Filter */}
                        <div className="p-4 flex gap-2 border-b border-slate-50">
                            <Select defaultValue="inbox">
                                <SelectTrigger className="w-full bg-slate-50 border-slate-200">
                                    <SelectValue placeholder="Gelen Kutusu" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="inbox">Gelen Kutusu</SelectItem>
                                    <SelectItem value="sent">Gönderilenler</SelectItem>
                                    <SelectItem value="drafts">Taslaklar</SelectItem>
                                    <SelectItem value="trash">Çöp Kutusu</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="ghost" size="icon" className="shrink-0 bg-slate-900 text-white hover:bg-slate-800 rounded-md">
                                <Pencil className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto">
                            {EMAILS.map((email) => (
                                <div
                                    key={email.id}
                                    onClick={() => setSelectedEmail(email.id)}
                                    className={cn(
                                        "p-4 border-b border-slate-50 cursor-pointer transition-colors hover:bg-slate-50",
                                        selectedEmail === email.id ? "bg-slate-50 relative" : "bg-white"
                                    )}
                                >
                                    {selectedEmail === email.id && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-900 rounded-r" />
                                    )}
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={cn("text-sm font-semibold", selectedEmail === email.id ? "text-slate-900" : "text-slate-700")}>
                                            {email.sender.name}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground">{email.time}</span>
                                            {selectedEmail === email.id && <div className="h-2 w-2 rounded-full bg-slate-900" />}
                                        </div>
                                    </div>
                                    <h4 className="text-sm font-medium mb-1 truncate text-slate-800">{email.subject}</h4>
                                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                        {email.preview}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Mail Detail */}
                    <div className="flex-1 flex flex-col bg-white min-w-0">

                        {/* Conversation */}
                        <div className="flex-1 overflow-y-auto p-4 xl:p-6 space-y-6">
                            {/* We could show subject header here, but mockup shows conversation directly */}

                            {THREAD.map((msg) => (
                                <div key={msg.id} className="flex gap-4 group">
                                    <Avatar className="h-10 w-10 border border-slate-100 mt-1 shrink-0">
                                        <AvatarFallback className={cn("font-medium", msg.type === "sent" ? "bg-slate-100 text-slate-600" : "bg-green-100 text-green-700")}>
                                            {msg.sender.initials}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-baseline justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-sm text-slate-900">{msg.sender.name}</span>
                                                {msg.type === "received" && msg.sender.email && (
                                                    <span className="text-xs text-muted-foreground">{msg.sender.email}</span>
                                                )}
                                            </div>
                                            {msg.sender.online && (
                                                <div className="flex text-[10px] items-center text-green-600 font-medium">
                                                    Güncel
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                                            {msg.content}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Reply Box */}
                        <div className="p-4 xl:p-6 pt-2 border-t mt-auto bg-white">
                            <div className="mb-2 text-sm text-muted-foreground">
                                Kime: <span className="text-slate-900">guyhawkins@email.com</span>
                            </div>
                            <div className="border rounded-xl shadow-sm bg-white overflow-hidden focus-within:ring-1 focus-within:ring-slate-200 transition-all">
                                <textarea
                                    className="w-full p-4 min-h-[120px] text-sm resize-none outline-none placeholder:text-slate-400"
                                    placeholder="Mesaj yazın..."
                                />
                                <div className="flex items-center justify-between p-2 px-3 border-t bg-slate-50/50">
                                    <div className="flex items-center gap-1 text-slate-500">
                                        <ToolbarButton icon={<Undo size={16} />} />
                                        <ToolbarButton icon={<Redo size={16} />} />
                                        <div className="w-px h-4 bg-slate-300 mx-1" />
                                        <ToolbarButton icon={<AlignLeft size={16} />} />
                                        <ToolbarButton icon={<AlignCenter size={16} />} />
                                        <ToolbarButton icon={<AlignRight size={16} />} />
                                        <div className="w-px h-4 bg-slate-300 mx-1" />
                                        <ToolbarButton icon={<Bold size={16} />} />
                                        <ToolbarButton icon={<Italic size={16} />} />
                                        <ToolbarButton icon={<UnderlineIcon size={16} />} />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-slate-200">
                                            <Paperclip size={16} className="text-slate-500" />
                                        </Button>
                                        <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800 rounded-lg px-4 h-8 text-xs font-medium">
                                            Gönder
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}

function NavItem({ icon, label, active, count }: { icon: React.ReactNode, label: string, active?: boolean, count?: number }) {
    return (
        <div className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors",
            active ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
        )}>
            <span className={cn(active ? "text-slate-900" : "text-slate-400 group-hover:text-slate-600")}>
                {icon}
            </span>
            <span className="flex-1">{label}</span>
            {count !== undefined && (
                <span className={cn(
                    "text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full",
                    active ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-600"
                )}>
                    {count}
                </span>
            )}
        </div>
    );
}

function ToolbarButton({ icon }: { icon: React.ReactNode }) {
    return (
        <button className="p-1.5 rounded hover:bg-slate-200 text-slate-500 transition-colors">
            {icon}
        </button>
    )
}

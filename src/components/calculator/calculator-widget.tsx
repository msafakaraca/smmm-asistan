"use client";

import React, { useReducer, useRef, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Calculator, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// --- State & Reducer ---

interface CalcState {
    display: string;
    previousValue: number;
    operator: string | null;
    waitingForOperand: boolean;
    history: string;
}

type CalcAction =
    | { type: "DIGIT"; digit: string }
    | { type: "DECIMAL" }
    | { type: "OPERATOR"; operator: string }
    | { type: "EQUALS" }
    | { type: "CLEAR" }
    | { type: "BACKSPACE" }
    | { type: "PERCENT" }
    | { type: "TOGGLE_SIGN" };

const initialState: CalcState = {
    display: "0",
    previousValue: 0,
    operator: null,
    waitingForOperand: false,
    history: "",
};

function calculate(left: number, op: string, right: number): number {
    switch (op) {
        case "+": return left + right;
        case "-": return left - right;
        case "*": return left * right;
        case "/": return right !== 0 ? left / right : NaN;
        default: return right;
    }
}

function formatResult(value: number): string {
    if (!isFinite(value)) return "Hata";
    const rounded = Math.round(value * 1e10) / 1e10;
    const str = String(rounded);
    if (str.length > 15) return rounded.toExponential(6);
    return str;
}

const opSymbols: Record<string, string> = { "+": "+", "-": "−", "*": "×", "/": "÷" };

function calcReducer(state: CalcState, action: CalcAction): CalcState {
    switch (action.type) {
        case "DIGIT": {
            if (state.waitingForOperand) {
                return {
                    ...state,
                    display: action.digit,
                    waitingForOperand: false,
                };
            }
            if (state.display.length >= 15) return state;
            const newDisplay = state.display === "0" ? action.digit : state.display + action.digit;
            return { ...state, display: newDisplay };
        }

        case "DECIMAL": {
            if (state.waitingForOperand) {
                return { ...state, display: "0.", waitingForOperand: false };
            }
            if (state.display.includes(".")) return state;
            return { ...state, display: state.display + "." };
        }

        case "OPERATOR": {
            const current = parseFloat(state.display);
            const sym = opSymbols[action.operator] || action.operator;

            if (state.operator && !state.waitingForOperand) {
                const result = calculate(state.previousValue, state.operator, current);
                const formatted = formatResult(result);
                return {
                    display: formatted,
                    previousValue: parseFloat(formatted) || 0,
                    operator: action.operator,
                    waitingForOperand: true,
                    history: `${formatted} ${sym}`,
                };
            }

            return {
                ...state,
                previousValue: current,
                operator: action.operator,
                waitingForOperand: true,
                history: `${state.display} ${sym}`,
            };
        }

        case "EQUALS": {
            if (!state.operator) return state;
            const current = parseFloat(state.display);
            const result = calculate(state.previousValue, state.operator, current);
            const formatted = formatResult(result);
            const prevSym = opSymbols[state.operator] || state.operator;
            return {
                display: formatted,
                previousValue: 0,
                operator: null,
                waitingForOperand: true,
                history: `${state.previousValue} ${prevSym} ${current} =`,
            };
        }

        case "CLEAR":
            return initialState;

        case "BACKSPACE": {
            if (state.waitingForOperand) return state;
            if (state.display.length === 1 || (state.display.length === 2 && state.display[0] === "-")) {
                return { ...state, display: "0" };
            }
            return { ...state, display: state.display.slice(0, -1) };
        }

        case "PERCENT": {
            const val = parseFloat(state.display) / 100;
            return { ...state, display: formatResult(val) };
        }

        case "TOGGLE_SIGN": {
            if (state.display === "0") return state;
            return {
                ...state,
                display: state.display.startsWith("-") ? state.display.slice(1) : "-" + state.display,
            };
        }

        default:
            return state;
    }
}

// --- Widget Component ---

interface CalculatorWidgetProps {
    open: boolean;
    onClose: () => void;
}

const WIDGET_W = 300;
const WIDGET_H = 420;

export function CalculatorWidget({ open, onClose }: CalculatorWidgetProps) {
    const [state, dispatch] = useReducer(calcReducer, initialState);
    const [mounted, setMounted] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [positioned, setPositioned] = useState(false);
    const dragRef = useRef({ isDragging: false, startX: 0, startY: 0 });

    // SSR guard
    useEffect(() => { setMounted(true); }, []);

    // Her açılışta merkeze konumla
    useEffect(() => {
        if (open && !positioned) {
            setPosition({
                x: Math.round((window.innerWidth - WIDGET_W) / 2),
                y: Math.round((window.innerHeight - WIDGET_H) / 2),
            });
            setPositioned(true);
        }
        if (!open) {
            setPositioned(false);
            dispatch({ type: "CLEAR" });
        }
    }, [open, positioned]);

    // Viewport resize → clamp
    useEffect(() => {
        if (!open) return;
        const handleResize = () => {
            setPosition(prev => ({
                x: Math.min(prev.x, window.innerWidth - WIDGET_W),
                y: Math.min(prev.y, Math.max(0, window.innerHeight - 100)),
            }));
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [open]);

    // Sürükleme
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        dragRef.current = {
            isDragging: true,
            startX: e.clientX - position.x,
            startY: e.clientY - position.y,
        };
        document.body.style.userSelect = "none";

        const handleMouseMove = (ev: MouseEvent) => {
            if (!dragRef.current.isDragging) return;
            const newX = Math.max(0, Math.min(ev.clientX - dragRef.current.startX, window.innerWidth - WIDGET_W));
            const newY = Math.max(0, Math.min(ev.clientY - dragRef.current.startY, window.innerHeight - 100));
            setPosition({ x: newX, y: newY });
        };

        const handleMouseUp = () => {
            dragRef.current.isDragging = false;
            document.body.style.userSelect = "";
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
    }, [position.x, position.y]);

    // Klavye
    useEffect(() => {
        if (!open) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement).tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

            const key = e.key;

            if (key >= "0" && key <= "9") {
                e.preventDefault();
                dispatch({ type: "DIGIT", digit: key });
            } else if (key === ".") {
                e.preventDefault();
                dispatch({ type: "DECIMAL" });
            } else if (key === "+" || key === "-" || key === "*" || key === "/") {
                e.preventDefault();
                dispatch({ type: "OPERATOR", operator: key });
            } else if (key === "Enter" || key === "=") {
                e.preventDefault();
                dispatch({ type: "EQUALS" });
            } else if (key === "Backspace") {
                e.preventDefault();
                dispatch({ type: "BACKSPACE" });
            } else if (key === "Delete") {
                e.preventDefault();
                dispatch({ type: "CLEAR" });
            } else if (key === "Escape") {
                e.preventDefault();
                onClose();
            } else if (key === "%") {
                e.preventDefault();
                dispatch({ type: "PERCENT" });
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [open, onClose]);

    if (!mounted) return null;

    // Buton tanımları
    const buttons: Array<{ label: string; action: () => void; className?: string; colSpan?: number; variant?: "default" | "ghost" }> = [
        { label: "C", action: () => dispatch({ type: "CLEAR" }), className: "text-destructive hover:bg-destructive/10", variant: "ghost" },
        { label: "±", action: () => dispatch({ type: "TOGGLE_SIGN" }), className: "bg-primary/10 text-primary hover:bg-primary/20", variant: "ghost" },
        { label: "%", action: () => dispatch({ type: "PERCENT" }), className: "bg-primary/10 text-primary hover:bg-primary/20", variant: "ghost" },
        { label: "÷", action: () => dispatch({ type: "OPERATOR", operator: "/" }), className: `bg-primary/10 text-primary hover:bg-primary/20 ${state.operator === "/" && state.waitingForOperand ? "ring-2 ring-primary" : ""}`, variant: "ghost" },

        { label: "7", action: () => dispatch({ type: "DIGIT", digit: "7" }), className: "bg-secondary/50 hover:bg-secondary", variant: "ghost" },
        { label: "8", action: () => dispatch({ type: "DIGIT", digit: "8" }), className: "bg-secondary/50 hover:bg-secondary", variant: "ghost" },
        { label: "9", action: () => dispatch({ type: "DIGIT", digit: "9" }), className: "bg-secondary/50 hover:bg-secondary", variant: "ghost" },
        { label: "×", action: () => dispatch({ type: "OPERATOR", operator: "*" }), className: `bg-primary/10 text-primary hover:bg-primary/20 ${state.operator === "*" && state.waitingForOperand ? "ring-2 ring-primary" : ""}`, variant: "ghost" },

        { label: "4", action: () => dispatch({ type: "DIGIT", digit: "4" }), className: "bg-secondary/50 hover:bg-secondary", variant: "ghost" },
        { label: "5", action: () => dispatch({ type: "DIGIT", digit: "5" }), className: "bg-secondary/50 hover:bg-secondary", variant: "ghost" },
        { label: "6", action: () => dispatch({ type: "DIGIT", digit: "6" }), className: "bg-secondary/50 hover:bg-secondary", variant: "ghost" },
        { label: "−", action: () => dispatch({ type: "OPERATOR", operator: "-" }), className: `bg-primary/10 text-primary hover:bg-primary/20 ${state.operator === "-" && state.waitingForOperand ? "ring-2 ring-primary" : ""}`, variant: "ghost" },

        { label: "1", action: () => dispatch({ type: "DIGIT", digit: "1" }), className: "bg-secondary/50 hover:bg-secondary", variant: "ghost" },
        { label: "2", action: () => dispatch({ type: "DIGIT", digit: "2" }), className: "bg-secondary/50 hover:bg-secondary", variant: "ghost" },
        { label: "3", action: () => dispatch({ type: "DIGIT", digit: "3" }), className: "bg-secondary/50 hover:bg-secondary", variant: "ghost" },
        { label: "+", action: () => dispatch({ type: "OPERATOR", operator: "+" }), className: `bg-primary/10 text-primary hover:bg-primary/20 ${state.operator === "+" && state.waitingForOperand ? "ring-2 ring-primary" : ""}`, variant: "ghost" },

        { label: "0", action: () => dispatch({ type: "DIGIT", digit: "0" }), className: "bg-secondary/50 hover:bg-secondary", variant: "ghost", colSpan: 2 },
        { label: ",", action: () => dispatch({ type: "DECIMAL" }), className: "bg-secondary/50 hover:bg-secondary", variant: "ghost" },
        { label: "=", action: () => dispatch({ type: "EQUALS" }), variant: "default" },
    ];

    return createPortal(
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="fixed z-[9999] shadow-2xl border-2 border-border/80 rounded-xl bg-card text-card-foreground overflow-hidden ring-1 ring-black/5 dark:ring-white/10"
                    style={{ left: position.x, top: position.y, width: WIDGET_W }}
                >
                    {/* Başlık çubuğu — sürükleme alanı */}
                    <div
                        className="flex items-center justify-between px-4 py-2.5 bg-primary/5 dark:bg-primary/10 cursor-grab active:cursor-grabbing select-none border-b border-border"
                        onMouseDown={handleMouseDown}
                    >
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <Calculator className="h-4 w-4" />
                            <span>Hesap Makinesi</span>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-6 w-6 rounded-md hover:bg-destructive/10 hover:text-destructive"
                            onClick={onClose}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    </div>

                    {/* Ekran */}
                    <div className="px-4 py-3 bg-muted/50 dark:bg-muted/30">
                        <div className="text-xs text-muted-foreground text-right truncate h-5">
                            {state.history || "\u00A0"}
                        </div>
                        <div className="text-2xl font-semibold text-right tabular-nums tracking-tight truncate">
                            {state.display}
                        </div>
                    </div>

                    {/* Butonlar */}
                    <div className="grid grid-cols-4 gap-1.5 p-3 bg-muted/20 dark:bg-transparent">
                        {buttons.map((btn, i) => (
                            <Button
                                key={i}
                                variant={btn.variant || "ghost"}
                                className={`h-12 text-base font-medium rounded-lg ${btn.colSpan === 2 ? "col-span-2" : ""} ${btn.className || ""}`}
                                onClick={btn.action}
                                onMouseDown={(e) => e.stopPropagation()}
                            >
                                {btn.label}
                            </Button>
                        ))}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}

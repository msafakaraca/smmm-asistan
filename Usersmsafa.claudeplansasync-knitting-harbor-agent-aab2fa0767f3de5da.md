# Draggable Calculator Widget - Implementation Plan

## 1. Component Architecture

### File Structure

Only one new file and one modified file:
- NEW: src/components/calculator/calculator-widget.tsx
- MODIFIED: src/components/dashboard/header.tsx

### Component: CalculatorWidget

Props: open (boolean), onClose (function). All calculator state is internal. Renders via React portal to document.body.

Internal structure: Title bar (drag handle) + Display area + Button grid (5x4).

## 2. State Machine

State: display (string), previousValue (number), operator (string or null), waitingForOperand (boolean), history (string).

Actions: DIGIT, DECIMAL, OPERATOR, EQUALS, CLEAR, BACKSPACE, PERCENT, TOGGLE_SIGN.

## 3. Drag via native mouse events on title bar. Clamp to viewport.

## 4. Global keydown when open. Maps 0-9, dot, operators, Enter, Backspace, Delete, Escape, percent.

## 5. Styling: fixed z-[9999] bg-card w-[320px]. framer-motion animation.

## 6. Header: Calculator icon button with Tooltip before ThemeToggle.

## 7. Edge Cases: division by zero, chained ops, viewport resize, SSR safety, z-index, cleanup.

## 8. Sequence: Create widget file, modify header, test.

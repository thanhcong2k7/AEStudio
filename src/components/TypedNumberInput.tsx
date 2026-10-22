/**
 * AEStudio - Typed Number Input with Tactile Scrubbing & Keyboard Nudging
 *
 * Prioritizes direct typed editing with error-free keystroke handling (decimals,
 * negative values, backspaces) while supporting pro After Effects-style horizontal scrubbing.
 */

import React, { useState, useEffect, useRef } from 'react';
import { store } from '../engine/state';

interface TypedNumberInputProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  unit?: string;
  className?: string;
  widthClass?: string;
  allowDragScrub?: boolean;
  prefix?: string;
}

export const TypedNumberInput: React.FC<TypedNumberInputProps> = ({
  value,
  onChange,
  min,
  max,
  step,
  decimals = 0,
  unit,
  className = '',
  widthClass = 'w-20',
  allowDragScrub = true,
  prefix,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [isScrubbing, setIsScrubbing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync draft when not editing
  useEffect(() => {
    if (!isEditing) {
      const num = Number(value);
      if (isNaN(num)) {
        setDraft('0');
      } else {
        setDraft(decimals > 0 ? num.toFixed(decimals) : String(Math.round(num)));
      }
    }
  }, [value, decimals, isEditing]);

  const commitValue = () => {
    let parsed = parseFloat(draft.trim());
    if (isNaN(parsed)) {
      parsed = value;
    } else {
      if (min !== undefined) parsed = Math.max(min, parsed);
      if (max !== undefined) parsed = Math.min(max, parsed);
      if (decimals !== undefined && decimals >= 0) {
        parsed = Number(parsed.toFixed(decimals));
      }
    }
    setIsEditing(false);
    onChange(parsed);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsEditing(true);
    // Display cleaner string for typing (remove unnecessary trailing zeros if any)
    const num = Number(value);
    setDraft(isNaN(num) ? '0' : String(num));
    // Auto-select text on focus so user can immediately type a replacement
    requestAnimationFrame(() => {
      e.target.select();
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setDraft(decimals > 0 ? value.toFixed(decimals) : String(Math.round(value)));
      e.currentTarget.blur();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const mult = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
      const baseStep = step ?? (decimals > 0 ? Math.pow(10, -decimals) : 1);
      const direction = e.key === 'ArrowUp' ? 1 : -1;
      const current = isEditing && !isNaN(parseFloat(draft)) ? parseFloat(draft) : value;
      let next = current + direction * baseStep * mult;

      if (min !== undefined) next = Math.max(min, next);
      if (max !== undefined) next = Math.min(max, next);
      if (decimals !== undefined && decimals >= 0) {
        next = Number(next.toFixed(decimals));
      }

      setDraft(String(next));
      onChange(next);
    }
  };

  // Tactile Horizontal Drag Scrubbing (After Effects style)
  const handleScrubMouseDown = (e: React.MouseEvent) => {
    if (isEditing || !allowDragScrub || e.button !== 0) return;

    // If clicking directly into the input, only initiate scrub if not already focused
    const startX = e.clientX;
    const initialVal = value;
    let hasMoved = false;

    const baseStep = step ?? (decimals > 0 ? Math.pow(10, -decimals) : 1);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      if (Math.abs(dx) > 2) {
        if (!hasMoved) {
          hasMoved = true;
          setIsScrubbing(true);
          store.beginContinuousAction();
        }

        const mult = moveEvent.shiftKey ? 10 : moveEvent.altKey ? 0.1 : 1;
        let next = initialVal + dx * baseStep * mult * 0.5;

        if (min !== undefined) next = Math.max(min, next);
        if (max !== undefined) next = Math.min(max, next);
        if (decimals !== undefined && decimals >= 0) {
          next = Number(next.toFixed(decimals));
        }

        onChange(next);
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      if (hasMoved) {
        store.commitContinuousAction();
        setIsScrubbing(false);
      } else {
        // Just a simple click without drag: focus input to type!
        inputRef.current?.focus();
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      className={`inline-flex items-center bg-[#131417] border rounded transition-all select-none ${
        isEditing
          ? 'border-[#2d62ea] ring-1 ring-[#2d62ea]/40'
          : isScrubbing
          ? 'border-blue-400 bg-[#1a2030]'
          : 'border-[#2c2f37] hover:border-slate-500'
      } ${className}`}
      onMouseDown={handleScrubMouseDown}
      title={isEditing ? 'Press Enter to commit, Esc to cancel' : 'Click to type, or drag horizontally to scrub value'}
    >
      {prefix && (
        <span className="text-[10px] text-slate-500 pl-1.5 font-mono select-none">
          {prefix}
        </span>
      )}

      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={handleFocus}
        onBlur={commitValue}
        onKeyDown={handleKeyDown}
        className={`${widthClass} bg-transparent py-0.5 px-1.5 text-right font-mono text-[11px] text-slate-100 outline-none select-text ${
          isEditing ? 'cursor-text' : 'cursor-ew-resize'
        }`}
      />

      {unit && (
        <span className="text-[10px] text-slate-500 pr-1.5 pl-0.5 font-mono select-none shrink-0">
          {unit}
        </span>
      )}
    </div>
  );
};

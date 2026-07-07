import { useRef } from "react";

export function useCaretInsert() {
  const elRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const selRef = useRef({ start: 0, end: 0 });

  const bind = {
    inputRef: (el: HTMLTextAreaElement | HTMLInputElement | null) => {
      elRef.current = el;
    },
    onSelect: (
      e: React.SyntheticEvent<HTMLTextAreaElement | HTMLInputElement>
    ) => {
      const t = e.target as HTMLTextAreaElement | HTMLInputElement;
      selRef.current = {
        start: t.selectionStart ?? 0,
        end: t.selectionEnd ?? 0,
      };
    },
    onKeyUp: (e: React.KeyboardEvent) => bind.onSelect(e as any),
    onClick: (e: React.MouseEvent) => bind.onSelect(e as any),
  };

  const insertAtCaret = (
    currentValue: string,
    insert: string,
    setValue: (v: string) => void
  ) => {
    // ðŸ”¥ Always prefer the live DOM caret if we have it
    let start = selRef.current.start;
    let end = selRef.current.end;

    const el = elRef.current;
    if (el && typeof el.selectionStart === "number") {
      start = el.selectionStart ?? start;
      end = el.selectionEnd ?? end;
      selRef.current = { start, end }; // keep in sync
    }

    const before = currentValue.slice(0, start);
    const after = currentValue.slice(end);
    const next = before + insert + after;
    const newPos = (before + insert).length;

    setValue(next);

    // restore caret after React commits
    setTimeout(() => {
      const node = elRef.current;
      if (node) {
        try {
          node.focus();
          node.setSelectionRange(newPos, newPos);
        } catch (e) {
          console.error("[useCaretInsert] restore caret failed:", e);
        }
      }
    }, 0);
  };

  /**
   * Programmatically move caret to a specific position (shell â†’ notepad).
   */
  const setCaretPosition = (pos: number) => {
    const el = elRef.current;
    if (!el) return;

    const len = el.value ? el.value.length : 0;
    const clamped = Math.max(0, Math.min(pos, len));

    selRef.current = { start: clamped, end: clamped };

    setTimeout(() => {
      const node = elRef.current;
      if (!node) return;

      try {
        node.focus();
        node.setSelectionRange(clamped, clamped);
      } catch (e) {
        console.error("[useCaretInsert] setCaretPosition failed:", e);
      }
    }, 0);
  };

  return { bind, insertAtCaret, setCaretPosition };
}

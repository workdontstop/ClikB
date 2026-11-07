import { useCallback, useEffect, useMemo, useRef } from "react";

export function useCaretInsert() {
  const elRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const selRef = useRef({ start: 0, end: 0 });
  const restoreFrameRef = useRef<number | null>(null);

  const inputRef = useCallback((el: HTMLTextAreaElement | HTMLInputElement | null) => {
    elRef.current = el;
  }, []);

  const captureSelection = useCallback((
      e: React.SyntheticEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    const t = e.currentTarget;
    selRef.current = {
      start: t.selectionStart ?? 0,
      end: t.selectionEnd ?? 0,
    };
  }, []);

  const onKeyUp = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    captureSelection(e);
  }, [captureSelection]);

  const onClick = useCallback((e: React.MouseEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    captureSelection(e);
  }, [captureSelection]);

  const bind = useMemo(() => ({
    inputRef,
    onSelect: captureSelection,
    onKeyUp,
    onClick,
  }), [captureSelection, inputRef, onClick, onKeyUp]);

  const restoreSelectionAfterCommit = useCallback((position: number) => {
    if (restoreFrameRef.current !== null) {
      cancelAnimationFrame(restoreFrameRef.current);
    }

    restoreFrameRef.current = requestAnimationFrame(() => {
      restoreFrameRef.current = null;
      const node = elRef.current;
      if (!node) return;

      try {
        const clamped = Math.max(0, Math.min(position, node.value.length));
        selRef.current = { start: clamped, end: clamped };
        node.focus();
        node.setSelectionRange(clamped, clamped);
      } catch (e) {
        console.error("[useCaretInsert] restore caret failed:", e);
      }
    });
  }, []);

  const insertAtCaret = useCallback((
    currentValue: string,
    insert: string,
    setValue: (v: string) => void
  ) => {
    // 🔥 Always prefer the live DOM caret if we have it
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

    // Restore once, on the next paint, after the controlled value has committed.
    restoreSelectionAfterCommit(newPos);
  }, [restoreSelectionAfterCommit]);

  /**
   * Programmatically move caret to a specific position (shell → notepad).
   */
  const setCaretPosition = useCallback((pos: number) => {
    const el = elRef.current;
    if (!el) return;

    const len = el.value ? el.value.length : 0;
    const clamped = Math.max(0, Math.min(pos, len));

    selRef.current = { start: clamped, end: clamped };

    try {
      el.focus();
      el.setSelectionRange(clamped, clamped);
    } catch (e) {
      console.error("[useCaretInsert] setCaretPosition failed:", e);
    }
  }, []);

  const focusInput = useCallback(() => {
    elRef.current?.focus();
  }, []);

  useEffect(() => () => {
    if (restoreFrameRef.current !== null) {
      cancelAnimationFrame(restoreFrameRef.current);
    }
  }, []);

  return { bind, insertAtCaret, setCaretPosition, focusInput };
}

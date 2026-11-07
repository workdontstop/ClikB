/** Quotes delimit spoken/displayed words; reference handles belong outside them. */
type PromptSpan = { text: string; quoted: boolean };

const word = (value: string | undefined) => !!value && /[\p{L}\p{N}_]/u.test(value);
const apostrophe = (text: string, index: number) =>
    word(text[index - 1]) && word(text[index + 1]);
const escaped = (text: string, index: number) => {
    let slashes = 0;
    for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor--) slashes++;
    return slashes % 2 === 1;
};

const promptSpans = (text: string): PromptSpan[] => {
    const spans: PromptSpan[] = [];
    let outsideStart = 0;
    for (let index = 0; index < text.length; index++) {
        const quote = text[index];
        const closing = quote === '“' ? '”' : quote === '‘' ? '’' : quote;
        if (!['"', "'", '“', '‘'].includes(quote)) continue;
        // Apostrophes and a trailing possessive do not open single-quoted text.
        if (quote === "'" && word(text[index - 1])) continue;
        const escapedDelimiter = escaped(text, index);
        let end = index + 1;
        for (; end < text.length; end++) {
            if (text[end] !== closing || escaped(text, end) !== escapedDelimiter) continue;
            if ((closing === "'" || closing === '’') && apostrophe(text, end)) continue;
            break;
        }
        // Only balanced literal spans are changed, so incomplete drafts stay intact.
        if (end === text.length) continue;
        const start = escapedDelimiter ? index - 1 : index;
        if (start > outsideStart) spans.push({ text: text.slice(outsideStart, start), quoted: false });
        spans.push({ text: text.slice(start, end + 1), quoted: true });
        outsideStart = end + 1;
        index = end;
    }
    if (outsideStart < text.length) spans.push({ text: text.slice(outsideStart), quoted: false });
    return spans;
};

export const cleanQuotedAtMentions = (text: string): string => text.includes('@')
    ? promptSpans(text).map(span => span.quoted ? span.text.replace(/@/g, '') : span.text).join('')
    : text;

export const mapUnquotedPromptText = (text: string, transform: (outside: string) => string): string =>
    promptSpans(text).map(span => span.quoted ? span.text : transform(span.text)).join('');

/** Also accepts prompt arrays/objects and serialized Kling prompt arrays. */
export const cleanPromptLiterals = <T>(value: T): T => {
    if (typeof value === 'string') {
        if (!value.includes('@')) return value;
        const fence = value.match(/^(\s*```(?:json)?\s*)([\s\S]*?)(\s*```\s*)$/i);
        const jsonText = fence ? fence[2] : value;
        if (/^\s*[\[{]/.test(jsonText)) {
            try {
                const parsed = JSON.parse(jsonText);
                const cleaned = cleanPromptLiterals(parsed);
                if (JSON.stringify(parsed) === JSON.stringify(cleaned)) return value;
                const serialized = JSON.stringify(cleaned, null, jsonText.includes('\n') ? 2 : undefined);
                return (fence ? `${fence[1]}${serialized}${fence[3]}` : serialized) as T;
            } catch { /* Natural prompts may start with a stage/performance tag. */ }
        }
        return cleanQuotedAtMentions(value) as T;
    }
    if (Array.isArray(value)) {
        const cleaned = value.map(item => cleanPromptLiterals(item));
        return (cleaned.every((item, index) => item === value[index]) ? value : cleaned) as T;
    }
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
        let changed = false;
        const cleaned = Object.entries(value).map(([key, item]) => {
            const next = cleanPromptLiterals(item);
            if (next !== item) changed = true;
            return [key, next];
        });
        return changed ? Object.fromEntries(cleaned) as T : value;
    }
    return value;
};

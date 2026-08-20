/**
 * TipTap HTML helpers + TextMeshPro-friendly conversion for Unity.
 */

/** True when the string looks like HTML / TipTap content. */
export function isHtmlRichText(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

/** Strip tags for plain-text contexts. */
export function richTextToPlain(html: string | null | undefined): string {
  if (!html) return "";
  if (!isHtmlRichText(html)) return html;
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseStyle(style: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!style) return out;
  for (const part of style.split(";")) {
    const [k, ...rest] = part.split(":");
    if (!k || !rest.length) continue;
    out[k.trim().toLowerCase()] = rest.join(":").trim();
  }
  return out;
}

function normalizeColor(raw: string): string | null {
  const c = raw.trim();
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(c)) {
    const r = c[1];
    const g = c[2];
    const b = c[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  const rgb = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    const hex = (n: string) => Number(n).toString(16).padStart(2, "0");
    return `#${hex(rgb[1])}${hex(rgb[2])}${hex(rgb[3])}`.toUpperCase();
  }
  return null;
}

function cssSizeToTmp(px: string): number {
  const map: Record<string, number> = {
    "12px": 24,
    "14px": 28,
    "16px": 32,
    "18px": 36,
    "20px": 40,
    "24px": 48,
    "28px": 56,
    "32px": 64,
  };
  if (map[px]) return map[px];
  const n = parseFloat(px);
  return Number.isFinite(n) ? Math.round(n * 2) : 32;
}

type StackItem = { kind: "mark"; tag: string } | { kind: "span" };

/**
 * Convert TipTap HTML to TextMeshPro rich-text tags for Unity.
 * Plain strings pass through unchanged.
 */
export function htmlToTmpRichText(html: string | null | undefined): string {
  if (!html?.trim()) return "";
  if (!isHtmlRichText(html)) return html;

  const stack: StackItem[] = [];
  let out = "";
  const tokenRe = /([^<]+)|<(\/?)([a-z0-9]+)([^>]*)>/gi;
  let m: RegExpExecArray | null;

  const openMark = (tag: string, attr = "") => {
    stack.push({ kind: "mark", tag });
    if (tag === "color" || tag === "size" || tag === "mark") out += `<${tag}=${attr}>`;
    else if (tag === "font") out += `<font="${attr}">`;
    else out += `<${tag}>`;
  };

  const closeMark = (tag: string) => {
    const idx = [...stack]
      .map((s, i) => ({ s, i }))
      .reverse()
      .find((x) => x.s.kind === "mark" && x.s.tag === tag)?.i;
    if (idx == null) return;
    while (stack.length > idx) {
      const top = stack.pop()!;
      if (top.kind === "mark") out += `</${top.tag}>`;
    }
  };

  const closeSpan = () => {
    const idx = [...stack]
      .map((s, i) => ({ s, i }))
      .reverse()
      .find((x) => x.s.kind === "span")?.i;
    if (idx == null) return;
    while (stack.length > idx) {
      const top = stack.pop()!;
      if (top.kind === "mark") out += `</${top.tag}>`;
    }
  };

  while ((m = tokenRe.exec(html)) !== null) {
    if (m[1]) {
      out += decodeEntities(m[1]);
      continue;
    }
    const closing = Boolean(m[2]);
    const name = (m[3] || "").toLowerCase();
    const attrs = m[4] || "";

    if (name === "br") {
      out += "\n";
      continue;
    }
    if (name === "p" || name === "div") {
      if (closing) out += "\n";
      continue;
    }

    if (name === "strong" || name === "b") {
      if (closing) closeMark("b");
      else openMark("b");
      continue;
    }
    if (name === "em" || name === "i") {
      if (closing) closeMark("i");
      else openMark("i");
      continue;
    }
    if (name === "u") {
      if (closing) closeMark("u");
      else openMark("u");
      continue;
    }
    if (name === "s" || name === "strike" || name === "del") {
      if (closing) closeMark("s");
      else openMark("s");
      continue;
    }
    if (name === "mark") {
      if (closing) closeMark("mark");
      else {
        const colorAttr = attrs.match(/data-color=["']([^"']+)["']/i)?.[1];
        const style = parseStyle(attrs.match(/style=["']([^"']*)["']/i)?.[1]);
        const bg = colorAttr || style["background-color"] || "#FFE566";
        openMark("mark", normalizeColor(bg) ?? "#FFE566");
      }
      continue;
    }
    if (name === "span") {
      if (closing) closeSpan();
      else {
        stack.push({ kind: "span" });
        const style = parseStyle(attrs.match(/style=["']([^"']*)["']/i)?.[1]);
        const color = style.color ? normalizeColor(style.color) : null;
        if (color) openMark("color", color);
        if (style["font-size"]) openMark("size", String(cssSizeToTmp(style["font-size"])));
        if (style["font-family"]) {
          const family = style["font-family"].split(",")[0]?.replace(/['"]/g, "").trim();
          if (family) openMark("font", family);
        }
      }
      continue;
    }
  }

  while (stack.length) {
    const top = stack.pop()!;
    if (top.kind === "mark") out += `</${top.tag}>`;
  }

  return out.replace(/\n{3,}/g, "\n\n").trim();
}

/** Wrap plain legacy text as a TipTap paragraph when loading into the editor. */
export function plainToEditorHtml(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  if (isHtmlRichText(value)) return value;
  const escaped = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
  return `<p>${escaped}</p>`;
}

"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import FontFamily from "@tiptap/extension-font-family";
import Placeholder from "@tiptap/extension-placeholder";
import { Extension } from "@tiptap/core";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Highlighter,
  RemoveFormatting,
  Type,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { plainToEditorHtml } from "@/lib/rich-text";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

const FontSize = Extension.create({
  name: "fontSize",
  addOptions() {
    return { types: ["textStyle"] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

const FONTS = [
  { label: "Default", value: "" },
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Nunito", value: "Nunito, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Comic Sans", value: '"Comic Sans MS", "Chalkboard SE", sans-serif' },
  { label: "Mono", value: "ui-monospace, monospace" },
] as const;

const SIZES = [
  { label: "S", value: "14px" },
  { label: "M", value: "16px" },
  { label: "L", value: "20px" },
  { label: "XL", value: "24px" },
  { label: "2XL", value: "32px" },
] as const;

const TEXT_COLORS = [
  "#0F172A",
  "#DC2626",
  "#EA580C",
  "#CA8A04",
  "#16A34A",
  "#2563EB",
  "#7C3AED",
  "#DB2777",
  "#FFFFFF",
] as const;

const HIGHLIGHT_COLORS = [
  "#FEF08A",
  "#FDE68A",
  "#BBF7D0",
  "#BAE6FD",
  "#E9D5FF",
  "#FBCFE8",
  "#FECACA",
] as const;

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
  /** Compact toolbar for denser forms */
  compact?: boolean;
};

function ToolbarButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors",
        "hover:bg-slate-100 hover:text-slate-900",
        "disabled:pointer-events-none disabled:opacity-35",
        active && "bg-slate-900 text-white hover:bg-slate-800 hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-slate-200" aria-hidden />;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write something…",
  className,
  minHeight = 96,
  compact = false,
}: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      Underline,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: plainToEditorHtml(value),
    editorProps: {
      attributes: {
        class: cn(
          "tiptap max-w-none px-3 py-2.5 text-sm leading-relaxed text-slate-800 outline-none",
          "[&_p]:my-1 focus:outline-none"
        ),
        style: `min-height:${minHeight}px`,
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.isEmpty ? "" : ed.getHTML();
      onChange(html);
    },
  });

  // Sync external value (e.g. form reset) without fighting typing.
  useEffect(() => {
    if (!editor) return;
    const next = plainToEditorHtml(value);
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (next === current) return;
    if (richEqual(next, current)) return;
    editor.commands.setContent(next || "", { emitUpdate: false });
  }, [value, editor]);

  if (!editor) {
    return (
      <div
        className={cn(
          "animate-pulse rounded-xl border border-slate-200 bg-slate-50",
          className
        )}
        style={{ minHeight: minHeight + 48 }}
      />
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm",
        "focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-200",
        className
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-0.5 border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white px-1.5 py-1.5",
          compact && "gap-0 py-1"
        )}
      >
        <label className="sr-only" htmlFor="rte-font">
          Font
        </label>
        <select
          id="rte-font"
          className="h-8 max-w-[7.5rem] rounded-lg border-0 bg-transparent px-1.5 text-xs font-medium text-slate-700 outline-none hover:bg-slate-100"
          value={editor.getAttributes("textStyle").fontFamily || ""}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) editor.chain().focus().unsetFontFamily().run();
            else editor.chain().focus().setFontFamily(v).run();
          }}
        >
          {FONTS.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        <Divider />

        <div className="inline-flex items-center rounded-lg bg-slate-100/80 p-0.5">
          {SIZES.map((s) => {
            const active = editor.getAttributes("textStyle").fontSize === s.value;
            return (
              <button
                key={s.value}
                type="button"
                title={`Size ${s.label}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().setFontSize(s.value).run()}
                className={cn(
                  "rounded-md px-1.5 py-1 text-[10px] font-bold tracking-wide text-slate-600",
                  active && "bg-white text-slate-900 shadow-sm"
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        <Divider />

        <ToolbarButton
          title="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Underline"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Strikethrough"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Divider />

        <div className="flex items-center gap-0.5 px-0.5" title="Text color">
          <Type className="mr-0.5 h-3.5 w-3.5 text-slate-400" />
          {TEXT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().setColor(c).run()}
              className={cn(
                "h-5 w-5 rounded-full border border-black/10 shadow-sm transition-transform hover:scale-110",
                c === "#FFFFFF" && "border-slate-300",
                editor.getAttributes("textStyle").color?.toUpperCase() === c &&
                  "ring-2 ring-slate-400 ring-offset-1"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <Divider />

        <div className="flex items-center gap-0.5 px-0.5" title="Highlight">
          <Highlighter className="mr-0.5 h-3.5 w-3.5 text-slate-400" />
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title={`Highlight ${c}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                editor.chain().focus().toggleHighlight({ color: c }).run()
              }
              className={cn(
                "h-5 w-5 rounded-md border border-black/10 shadow-sm transition-transform hover:scale-110",
                editor.isActive("highlight", { color: c }) &&
                  "ring-2 ring-amber-400 ring-offset-1"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <Divider />

        <ToolbarButton
          title="Clear formatting"
          onClick={() =>
            editor.chain().focus().unsetAllMarks().clearNodes().run()
          }
        >
          <RemoveFormatting className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}

/** Compare HTML loosely so whitespace-only diffs don't reset the caret. */
function richEqual(a: string, b: string) {
  const norm = (s: string) =>
    s.replace(/\s+/g, " ").replace(/<p><\/p>/g, "").trim();
  return norm(a) === norm(b);
}

/** Read-only HTML preview (teacher studio whiteboard). */
export function RichTextPreview({
  html,
  className,
  empty = "Add text…",
}: {
  html?: string | null;
  className?: string;
  empty?: string;
}) {
  const has = Boolean(html?.trim());
  if (!has) {
    return <p className={cn("text-sm italic text-slate-400", className)}>{empty}</p>;
  }
  if (!/<\/?[a-z]/i.test(html!)) {
    return <p className={className}>{html}</p>;
  }
  return (
    <div
      className={cn(
        "max-w-none text-slate-800 [&_p]:my-1 [&_strong]:font-bold [&_em]:italic [&_u]:underline [&_mark]:rounded-sm [&_mark]:px-0.5",
        className
      )}
      dangerouslySetInnerHTML={{ __html: html! }}
    />
  );
}

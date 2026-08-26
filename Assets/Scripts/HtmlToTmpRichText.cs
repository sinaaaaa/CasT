using System.Collections.Generic;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using UnityEngine;

/// <summary>
/// Converts TipTap/HTML rich text from the platform editor into TextMeshPro tags.
/// Plain strings and already-converted TMP markup pass through unchanged.
/// </summary>
public static class HtmlToTmpRichText
{
    static readonly Regex TokenRe = new Regex(
        @"([^<]+)|<(/?)([a-z0-9]+)([^>]*)>",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    static readonly Regex HasHtmlRe = new Regex(
        @"</?[a-z][\s\S]*>",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    // TipTap / HTML tags we translate. Everything else that looks like TMP is preserved.
    static readonly HashSet<string> HtmlTags = new HashSet<string>
    {
        "p", "div", "br", "strong", "b", "em", "i", "u", "s", "strike", "del", "mark", "span"
    };

    static readonly HashSet<string> TmpTags = new HashSet<string>
    {
        "b", "i", "u", "s", "color", "size", "mark", "font", "align", "sprite", "style", "nobr"
    };

    public static bool LooksLikeHtml(string value)
    {
        return !string.IsNullOrWhiteSpace(value) && HasHtmlRe.IsMatch(value);
    }

    /// <summary>
    /// True when the string already contains TMP markup (and not TipTap HTML wrappers).
    /// </summary>
    public static bool LooksLikeTmp(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return false;
        // TipTap always wraps in <p> / <span style=...> — treat those as HTML to convert.
        if (Regex.IsMatch(value, @"</?(?:p|div|span|strong|em)\b", RegexOptions.IgnoreCase))
            return false;
        return Regex.IsMatch(
            value,
            @"</?(?:color|size|mark|font|b|i|u|s)\b",
            RegexOptions.IgnoreCase);
    }

    public static string Convert(string html)
    {
        if (string.IsNullOrEmpty(html)) return "";
        if (!LooksLikeHtml(html)) return html;
        // Already TMP (e.g. converted upstream) — do not strip color/size tags.
        if (LooksLikeTmp(html)) return html;

        var stack = new List<string>(); // "span" sentinel or mark tag name
        var sb = new StringBuilder(html.Length);
        var matches = TokenRe.Matches(html);

        foreach (Match m in matches)
        {
            if (m.Groups[1].Success)
            {
                sb.Append(DecodeEntities(m.Groups[1].Value));
                continue;
            }

            bool closing = m.Groups[2].Value == "/";
            string name = m.Groups[3].Value.ToLowerInvariant();
            string attrs = m.Groups[4].Value;
            string rawTag = m.Value;

            if (name == "br")
            {
                sb.Append('\n');
                continue;
            }
            if (name == "p" || name == "div")
            {
                if (closing) sb.Append('\n');
                continue;
            }

            if (name == "strong" || name == "b")
            {
                if (closing) CloseMark(stack, sb, "b");
                else OpenMark(stack, sb, "b");
                continue;
            }
            if (name == "em" || name == "i")
            {
                if (closing) CloseMark(stack, sb, "i");
                else OpenMark(stack, sb, "i");
                continue;
            }
            if (name == "u")
            {
                if (closing) CloseMark(stack, sb, "u");
                else OpenMark(stack, sb, "u");
                continue;
            }
            if (name == "s" || name == "strike" || name == "del")
            {
                if (closing) CloseMark(stack, sb, "s");
                else OpenMark(stack, sb, "s");
                continue;
            }
            if (name == "mark")
            {
                if (closing) CloseMark(stack, sb, "mark");
                else
                {
                    string color = ExtractMarkColor(attrs) ?? "#FFE566";
                    OpenMark(stack, sb, "mark", color);
                }
                continue;
            }
            if (name == "span")
            {
                if (closing) CloseSpan(stack, sb);
                else
                {
                    stack.Add("span");
                    var style = ParseStyle(ExtractAttr(attrs, "style"));
                    if (style.TryGetValue("color", out string col))
                    {
                        string hex = NormalizeColor(col);
                        if (hex != null) OpenMark(stack, sb, "color", hex);
                    }
                    if (style.TryGetValue("font-size", out string size))
                        OpenMark(stack, sb, "size", CssSizeToTmp(size).ToString(CultureInfo.InvariantCulture));
                    if (style.TryGetValue("font-family", out string fam))
                    {
                        string family = fam.Split(',')[0].Trim().Trim('\'', '"');
                        if (!string.IsNullOrEmpty(family))
                            OpenMark(stack, sb, "font", family);
                    }
                    if (style.TryGetValue("font-weight", out string weight))
                    {
                        string w = weight.ToLowerInvariant();
                        if (w == "bold" || w == "700" || w == "800" || w == "900")
                            OpenMark(stack, sb, "b");
                    }
                    if (style.TryGetValue("font-style", out string fs) &&
                        fs.Trim().ToLowerInvariant() == "italic")
                        OpenMark(stack, sb, "i");
                    if (style.TryGetValue("text-decoration", out string td))
                    {
                        string tdl = td.ToLowerInvariant();
                        if (tdl.Contains("underline")) OpenMark(stack, sb, "u");
                        if (tdl.Contains("line-through")) OpenMark(stack, sb, "s");
                    }
                }
                continue;
            }

            // Preserve TMP / unknown tags so a second Convert pass cannot strip them.
            if (TmpTags.Contains(name) || !HtmlTags.Contains(name))
            {
                sb.Append(rawTag);
                continue;
            }
        }

        while (stack.Count > 0)
        {
            string top = stack[stack.Count - 1];
            stack.RemoveAt(stack.Count - 1);
            if (top != "span") sb.Append("</").Append(top).Append('>');
        }

        return Regex.Replace(sb.ToString(), @"\n{3,}", "\n\n").Trim();
    }

    static void OpenMark(List<string> stack, StringBuilder sb, string tag, string attr = null)
    {
        stack.Add(tag);
        if (tag == "color" || tag == "size" || tag == "mark")
            sb.Append('<').Append(tag).Append('=').Append(attr).Append('>');
        else if (tag == "font")
            sb.Append("<font=\"").Append(attr).Append("\">");
        else
            sb.Append('<').Append(tag).Append('>');
    }

    static void CloseMark(List<string> stack, StringBuilder sb, string tag)
    {
        int idx = -1;
        for (int i = stack.Count - 1; i >= 0; i--)
        {
            if (stack[i] == tag) { idx = i; break; }
        }
        if (idx < 0) return;
        while (stack.Count > idx)
        {
            string top = stack[stack.Count - 1];
            stack.RemoveAt(stack.Count - 1);
            if (top != "span") sb.Append("</").Append(top).Append('>');
        }
    }

    static void CloseSpan(List<string> stack, StringBuilder sb)
    {
        int idx = -1;
        for (int i = stack.Count - 1; i >= 0; i--)
        {
            if (stack[i] == "span") { idx = i; break; }
        }
        if (idx < 0) return;
        while (stack.Count > idx)
        {
            string top = stack[stack.Count - 1];
            stack.RemoveAt(stack.Count - 1);
            if (top != "span") sb.Append("</").Append(top).Append('>');
        }
    }

    static string ExtractMarkColor(string attrs)
    {
        var data = Regex.Match(attrs, @"data-color=[""']([^""']+)[""']", RegexOptions.IgnoreCase);
        if (data.Success) return NormalizeColor(data.Groups[1].Value);
        var style = ParseStyle(ExtractAttr(attrs, "style"));
        if (style.TryGetValue("background-color", out string bg))
            return NormalizeColor(bg);
        return null;
    }

    static string ExtractAttr(string attrs, string name)
    {
        var m = Regex.Match(attrs, name + @"=[""']([^""']*)[""']", RegexOptions.IgnoreCase);
        return m.Success ? m.Groups[1].Value : null;
    }

    static Dictionary<string, string> ParseStyle(string style)
    {
        var dict = new Dictionary<string, string>();
        if (string.IsNullOrEmpty(style)) return dict;
        foreach (var part in style.Split(';'))
        {
            int colon = part.IndexOf(':');
            if (colon <= 0) continue;
            string k = part.Substring(0, colon).Trim().ToLowerInvariant();
            string v = part.Substring(colon + 1).Trim();
            if (k.Length > 0 && v.Length > 0) dict[k] = v;
        }
        return dict;
    }

    static string NormalizeColor(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        string c = raw.Trim();
        if (Regex.IsMatch(c, @"^#[0-9a-fA-F]{6}$")) return c.ToUpperInvariant();
        if (Regex.IsMatch(c, @"^#[0-9a-fA-F]{3}$"))
        {
            char r = c[1], g = c[2], b = c[3];
            return $"#{r}{r}{g}{g}{b}{b}".ToUpperInvariant();
        }
        var rgb = Regex.Match(c, @"rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)", RegexOptions.IgnoreCase);
        if (rgb.Success)
        {
            int R = int.Parse(rgb.Groups[1].Value);
            int G = int.Parse(rgb.Groups[2].Value);
            int B = int.Parse(rgb.Groups[3].Value);
            return $"#{R:X2}{G:X2}{B:X2}";
        }
        return null;
    }

    static int CssSizeToTmp(string px)
    {
        switch (px.Trim())
        {
            case "12px": return 24;
            case "14px": return 28;
            case "16px": return 32;
            case "18px": return 36;
            case "20px": return 40;
            case "24px": return 48;
            case "28px": return 56;
            case "32px": return 64;
        }
        if (float.TryParse(px.Replace("px", ""), NumberStyles.Float, CultureInfo.InvariantCulture, out float n))
            return Mathf.RoundToInt(n * 2f);
        return 32;
    }

    static string DecodeEntities(string s)
    {
        return s
            .Replace("&nbsp;", " ")
            .Replace("&amp;", "&")
            .Replace("&lt;", "<")
            .Replace("&gt;", ">")
            .Replace("&quot;", "\"")
            .Replace("&#39;", "'");
    }
}

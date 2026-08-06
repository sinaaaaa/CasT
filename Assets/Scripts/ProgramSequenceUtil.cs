using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Expand / compare program token sequences that may include repeat blocks.
/// Tokens: forward, backward, left, right, turn left, turn right,
///         repeat:N (or repeat_start:N), repeat-end (or repeat_end).
/// Nested repeats are not supported (inner repeat tokens are ignored safely).
/// </summary>
public static class ProgramSequenceUtil
{
    public const int MinRepeatCount = 1;
    public const int MaxRepeatCount = 9;

    public static int ClampRepeatCount(int count) =>
        Mathf.Clamp(count, MinRepeatCount, MaxRepeatCount);

    public static bool IsRepeatStartToken(string token, out int count)
    {
        count = 2;
        if (string.IsNullOrWhiteSpace(token)) return false;
        string t = token.Trim().ToLowerInvariant().Replace('_', '-');
        if (t == "repeat" || t == "repeat-start" || t == "repeat_start")
        {
            count = 1;
            return true;
        }
        if (t.StartsWith("repeat:") || t.StartsWith("repeat-start:") || t.StartsWith("repeat_start:"))
        {
            int colon = t.LastIndexOf(':');
            if (colon >= 0 && int.TryParse(t.Substring(colon + 1), out int n))
                count = ClampRepeatCount(n);
            return true;
        }
        return false;
    }

    public static bool IsRepeatEndToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token)) return false;
        string t = token.Trim().ToLowerInvariant().Replace('_', '-');
        return t == "repeat-end" || t == "repeat_end" || t == "end-repeat";
    }

    public static bool IsMotionToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token)) return false;
        string t = NormalizeMotion(token);
        return t == "forward" || t == "backward" || t == "left" || t == "right";
    }

    public static string NormalizeMotion(string token)
    {
        string t = token.Trim().ToLowerInvariant().Replace('_', ' ');
        if (t == "turn left" || t == "rotate left") return "left";
        if (t == "turn right" || t == "rotate right") return "right";
        return t;
    }

    public static string FormatRepeatStart(int count) =>
        "repeat:" + ClampRepeatCount(count);

    /// <summary>Expand nested-looking sequences (non-nested only) to a flat motion list.</summary>
    public static List<string> Expand(IList<string> tokens)
    {
        var result = new List<string>();
        if (tokens == null || tokens.Count == 0) return result;

        int i = 0;
        while (i < tokens.Count)
        {
            string tok = tokens[i];
            if (IsRepeatStartToken(tok, out int count))
            {
                var body = new List<string>();
                i++;
                while (i < tokens.Count && !IsRepeatEndToken(tokens[i]))
                {
                    if (IsRepeatStartToken(tokens[i], out _))
                    {
                        // Skip nested repeat pair if present.
                        i++;
                        while (i < tokens.Count && !IsRepeatEndToken(tokens[i])) i++;
                        if (i < tokens.Count) i++;
                        continue;
                    }
                    if (IsMotionToken(tokens[i]))
                        body.Add(NormalizeMotion(tokens[i]));
                    i++;
                }
                if (i < tokens.Count && IsRepeatEndToken(tokens[i]))
                    i++; // consume end
                for (int r = 0; r < count; r++)
                    result.AddRange(body);
                continue;
            }

            if (IsRepeatEndToken(tok))
            {
                i++;
                continue;
            }

            if (IsMotionToken(tok))
                result.Add(NormalizeMotion(tok));
            i++;
        }

        return result;
    }

    public static bool ExpandedSequencesEqual(IList<string> a, IList<string> b)
    {
        var ea = Expand(a);
        var eb = Expand(b);
        if (ea.Count != eb.Count) return false;
        for (int i = 0; i < ea.Count; i++)
        {
            if (ea[i] != eb[i]) return false;
        }
        return true;
    }

    public static bool MatchesAnyProgram(IList<string> studentTokens, IList<string> acceptedProgramsJoined)
    {
        if (acceptedProgramsJoined == null || acceptedProgramsJoined.Count == 0)
            return false;
        foreach (var prog in acceptedProgramsJoined)
        {
            if (string.IsNullOrWhiteSpace(prog)) continue;
            var tokens = SplitProgram(prog);
            if (ExpandedSequencesEqual(studentTokens, tokens))
                return true;
        }
        return false;
    }

    public static List<string> SplitProgram(string joined)
    {
        var list = new List<string>();
        if (string.IsNullOrWhiteSpace(joined)) return list;
        foreach (var part in joined.Split(new[] { ';', ',' }, System.StringSplitOptions.RemoveEmptyEntries))
        {
            string p = part.Trim();
            if (p.Length > 0) list.Add(p);
        }
        return list;
    }

    public static string JoinProgram(IList<string> tokens)
    {
        if (tokens == null || tokens.Count == 0) return "";
        return string.Join(";", tokens);
    }
}

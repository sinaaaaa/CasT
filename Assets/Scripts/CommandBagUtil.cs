using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Resolve Command Bag / Chunk macro tokens (bag:id, chunk:id) into motion/repeat tokens
/// before <see cref="ProgramSequenceUtil.Expand"/>.
/// </summary>
public static class CommandBagUtil
{
    public const string BagPrefix = "bag:";
    public const string ChunkPrefix = "chunk:";

    public static bool IsBagToken(string token, out string bagId)
    {
        bagId = null;
        if (string.IsNullOrWhiteSpace(token)) return false;
        string t = token.Trim();
        if (!t.StartsWith(BagPrefix)) return false;
        bagId = t.Substring(BagPrefix.Length).Trim();
        return !string.IsNullOrEmpty(bagId);
    }

    public static bool IsChunkToken(string token, out string chunkId)
    {
        chunkId = null;
        if (string.IsNullOrWhiteSpace(token)) return false;
        string t = token.Trim();
        if (!t.StartsWith(ChunkPrefix)) return false;
        chunkId = t.Substring(ChunkPrefix.Length).Trim();
        return !string.IsNullOrEmpty(chunkId);
    }

    public static string FormatBagToken(string bagId) => BagPrefix + bagId;
    public static string FormatChunkToken(string chunkId) => ChunkPrefix + chunkId;

    public static CommandBagData FindBag(LevelData level, string bagId)
    {
        if (level?.commandBags == null || string.IsNullOrEmpty(bagId)) return null;
        for (int i = 0; i < level.commandBags.Count; i++)
        {
            var b = level.commandBags[i];
            if (b != null && b.id == bagId) return b;
        }
        return null;
    }

    public static CommandChunkData FindChunk(LevelData level, string chunkId)
    {
        if (level?.commandBags == null || string.IsNullOrEmpty(chunkId)) return null;
        for (int i = 0; i < level.commandBags.Count; i++)
        {
            var bag = level.commandBags[i];
            if (bag?.chunks == null) continue;
            for (int j = 0; j < bag.chunks.Count; j++)
            {
                var c = bag.chunks[j];
                if (c != null && c.id == chunkId) return c;
            }
        }
        return null;
    }

    public static CommandBagData FindBagContainingChunk(LevelData level, string chunkId)
    {
        if (level?.commandBags == null || string.IsNullOrEmpty(chunkId)) return null;
        for (int i = 0; i < level.commandBags.Count; i++)
        {
            var bag = level.commandBags[i];
            if (bag?.chunks == null) continue;
            for (int j = 0; j < bag.chunks.Count; j++)
            {
                if (bag.chunks[j] != null && bag.chunks[j].id == chunkId)
                    return bag;
            }
        }
        return null;
    }

    /// <summary>Replace bag:/chunk: macros with nested program tokens (does not expand repeats).</summary>
    public static List<string> ResolveProgramTokens(IList<string> tokens, LevelData level)
    {
        var result = new List<string>();
        if (tokens == null || tokens.Count == 0) return result;

        for (int i = 0; i < tokens.Count; i++)
        {
            string tok = tokens[i];
            if (IsBagToken(tok, out string bagId))
            {
                var bag = FindBag(level, bagId);
                if (bag?.chunks == null) continue;
                for (int c = 0; c < bag.chunks.Count; c++)
                {
                    var chunk = bag.chunks[c];
                    if (chunk?.tokens == null) continue;
                    result.AddRange(chunk.tokens);
                }
                continue;
            }
            if (IsChunkToken(tok, out string chunkId))
            {
                var chunk = FindChunk(level, chunkId);
                if (chunk?.tokens != null)
                    result.AddRange(chunk.tokens);
                continue;
            }
            result.Add(tok);
        }
        return result;
    }
}

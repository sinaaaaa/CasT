using System;
using System.Collections;
using System.Collections.Generic;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.Networking;

/// <summary>
/// Fetches published levels from the teacher dashboard API and converts them to <see cref="LevelData"/>.
/// </summary>
public class PlatformLevelLoader : MonoBehaviour
{
    public static PlatformLevelLoader Instance { get; private set; }

    [Tooltip("If true, CharacterMove loads levels from the platform instead of hardcoded InitializeLevelData.")]
    public bool usePlatformLevels = true;

    public bool LoadSucceeded { get; private set; }
    public string LastError { get; private set; }
    public bool AssignmentRestricted { get; private set; }

    private void Awake()
    {
        if (Instance == null)
        {
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }
        else if (Instance != this)
        {
            Destroy(gameObject);
        }
    }

    public IEnumerator LoadLevelsCoroutine(Action<List<LevelData>> onComplete)
    {
        LoadSucceeded = false;
        LastError = null;
        AssignmentRestricted = false;

        if (!usePlatformLevels)
        {
            onComplete?.Invoke(null);
            yield break;
        }

        var comm = PlatformCommunication.Instance;
        string url = comm.PlatformUrl.TrimEnd('/') + "/api/game/levels";
        string studentId = PlayerPrefs.GetString("UserId", "").Trim();
        if (!string.IsNullOrEmpty(studentId))
            url += "?studentId=" + UnityWebRequest.EscapeURL(studentId);

        using (var req = UnityWebRequest.Get(url))
        {
            req.SetRequestHeader("X-Game-Api-Key", GetApiKey());
            req.downloadHandler = new DownloadHandlerBuffer();
            yield return req.SendWebRequest();

            if (req.result != UnityWebRequest.Result.Success)
            {
                LastError = $"HTTP {req.responseCode}: {req.error}";
                Debug.LogWarning("[PlatformLevelLoader] " + LastError);
                onComplete?.Invoke(null);
                yield break;
            }

            try
            {
                var root = JObject.Parse(req.downloadHandler.text);
                AssignmentRestricted = root["assignmentRestricted"]?.Value<bool>() ?? false;
                bool filteredForStudent = root["filteredForStudent"]?.Value<bool>() ?? false;
                var levelsToken = root["levels"] as JArray;
                if (levelsToken == null || levelsToken.Count == 0)
                {
                    LastError = "No published levels returned.";
                    onComplete?.Invoke(null);
                    yield break;
                }

                if (AssignmentRestricted && !string.IsNullOrEmpty(studentId))
                {
                    Debug.Log(
                        $"[PlatformLevelLoader] Student '{studentId}' has {levelsToken.Count} assigned item(s) from the dashboard.");
                }

                var result = new List<LevelData>();
                foreach (var item in levelsToken)
                {
                    string levelKey = item["levelKey"]?.ToString();
                    string levelType = item["levelType"]?.ToString();
                    var configToken = item["config"];
                    if (configToken == null) continue;

                    var dto = configToken.ToObject<LevelConfigDto>();
                    if (dto == null) continue;

                    string layoutFromJson = configToken["layoutMode"]?.ToString();
                    if (!string.IsNullOrEmpty(layoutFromJson))
                        dto.layoutMode = layoutFromJson;
                    if (configToken["numberLine"] != null && dto.numberLine == null)
                        dto.numberLine = configToken["numberLine"].ToObject<NumberLineConfigDto>();

                    LevelData ld = LevelConfigMapper.ToLevelData(dto, levelType);
                    if (ld == null) continue;
                    ld.levelKey = levelKey;
                    ld.visible = item["visible"]?.Value<bool>() ?? dto.visible;
                    ld.orderIndex = item["orderIndex"]?.Value<int>() ?? result.Count;
                    if (!string.IsNullOrEmpty(layoutFromJson))
                        ld.layoutMode = layoutFromJson;
                    if (string.IsNullOrEmpty(ld.layoutMode) && dto.numberLine != null)
                        ld.layoutMode = "NUMBER_LINE";
                    if (string.IsNullOrEmpty(ld.levelName))
                        ld.levelName = item["name"]?.ToString() ?? levelKey;
                    string program = ld.guidedActions != null ? string.Join(", ", ld.guidedActions) : "";
                    Debug.Log($"[PlatformLevelLoader] {levelKey} type={levelType} layout={ld.layoutMode} " +
                              $"ticks={ld.numberLine?.tickCount ?? 0} orderIndex={ld.orderIndex} " +
                              $"maxAttempts={ld.maxAttempts} commandHistory={ld.showCommandHistory} " +
                              $"animateRobot={ld.runRobotOnSubmit} program=[{program}] blanks={ld.blanks?.Count ?? 0}");
                    result.Add(ld);
                }

                if (result.Count == 0)
                {
                    LastError = "Could not parse any level configs.";
                    onComplete?.Invoke(null);
                    yield break;
                }

                result.Sort((a, b) =>
                {
                    int cmp = a.orderIndex.CompareTo(b.orderIndex);
                    if (cmp != 0) return cmp;
                    return string.Compare(a.levelKey, b.levelKey, StringComparison.Ordinal);
                });

                LoadSucceeded = true;
                Debug.Log($"[PlatformLevelLoader] Loaded {result.Count} level(s) from platform.");
                onComplete?.Invoke(result);
            }
            catch (Exception ex)
            {
                LastError = ex.Message;
                Debug.LogWarning("[PlatformLevelLoader] Parse error: " + ex.Message);
                onComplete?.Invoke(null);
            }
        }
    }

    private static string GetApiKey()
    {
        var bootstrap = FindObjectOfType<PlatformBootstrap>();
        if (bootstrap != null) return bootstrap.GameApiKeyForLoader;
        return "sparc-game-dev-key-change-in-production";
    }
}

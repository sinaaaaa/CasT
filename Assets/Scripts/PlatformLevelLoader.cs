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
    public string ResumeLevelKey { get; private set; }
    public int ResumeSlot { get; private set; }
    public bool HasServerResume { get; private set; }
    /// <summary>True when the student picked a specific item on the web dashboard.</summary>
    public bool ForceSelectedItem { get; private set; }

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
        ResumeLevelKey = null;
        ResumeSlot = 0;
        HasServerResume = false;
        ForceSelectedItem = false;

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

        var webSession = StudentWebConfig.Load();
        if (webSession != null && !string.IsNullOrWhiteSpace(webSession.resumeLevelKey))
            url += (url.Contains("?") ? "&" : "?") + "item=" + UnityWebRequest.EscapeURL(webSession.resumeLevelKey.Trim());

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

            string responseText = req.downloadHandler.text;
            JObject root;
            JArray levelsToken;
            try
            {
                root = JObject.Parse(responseText);
                AssignmentRestricted = root["assignmentRestricted"]?.Value<bool>() ?? false;
                ResumeLevelKey = root["resumeLevelKey"]?.ToString();
                ResumeSlot = root["resumeSlot"]?.Value<int>() ?? 0;

                if (webSession != null && !string.IsNullOrWhiteSpace(webSession.resumeLevelKey))
                {
                    ResumeLevelKey = webSession.resumeLevelKey.Trim();
                    if (webSession.resumeSlot > 0)
                        ResumeSlot = webSession.resumeSlot;
                    ForceSelectedItem = true;
                }

                HasServerResume = !string.IsNullOrEmpty(ResumeLevelKey) && ResumeSlot > 0;
                levelsToken = root["levels"] as JArray;
            }
            catch (Exception ex)
            {
                LastError = ex.Message;
                Debug.LogWarning("[PlatformLevelLoader] Parse error: " + ex.Message);
                onComplete?.Invoke(null);
                yield break;
            }

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
            // Parse across frames on constrained WebGL so Safari does not kill the tab.
            int parsed = 0;
            foreach (var item in levelsToken)
            {
                try
                {
                    LevelData ld = ParseLevelToken(item, result.Count);
                    if (ld != null) result.Add(ld);
                }
                catch (Exception ex)
                {
                    Debug.LogWarning("[PlatformLevelLoader] Skipped item: " + ex.Message);
                }

                parsed++;
                if (WebGLDeviceGuard.IsConstrainedWebDevice && (parsed % 2) == 0)
                    yield return null;
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
    }

    static LevelData ParseLevelToken(JToken item, int fallbackOrder)
    {
        string levelKey = item["levelKey"]?.ToString();
        string levelType = item["levelType"]?.ToString();
        var configToken = item["config"];
        if (configToken == null) return null;

        var dto = configToken.ToObject<LevelConfigDto>();
        if (dto == null) return null;

        string layoutFromJson = configToken["layoutMode"]?.ToString();
        if (!string.IsNullOrEmpty(layoutFromJson))
            dto.layoutMode = layoutFromJson;
        if (configToken["numberLine"] != null && dto.numberLine == null)
            dto.numberLine = configToken["numberLine"].ToObject<NumberLineConfigDto>();
        if (configToken["geometryPath"] != null)
            dto.geometryPath = configToken["geometryPath"].ToObject<GeometryPathConfigDto>();

        LevelData ld = LevelConfigMapper.ToLevelData(dto, levelType);
        if (ld == null) return null;
        ld.levelKey = levelKey;
        ld.visible = item["visible"]?.Value<bool>() ?? dto.visible;
        ld.orderIndex = item["orderIndex"]?.Value<int>() ?? fallbackOrder;
        if (!string.IsNullOrEmpty(layoutFromJson))
            ld.layoutMode = layoutFromJson;

        var correctProgramsToken = configToken["assessment"]?["correctPrograms"] as JArray;
        if (correctProgramsToken != null && correctProgramsToken.Count > 0)
        {
            ld.correctPrograms = new List<string>();
            foreach (var prog in correctProgramsToken)
            {
                if (prog is JArray arr)
                {
                    var parts = new List<string>();
                    foreach (var t in arr)
                    {
                        string s = t?.ToString();
                        if (!string.IsNullOrWhiteSpace(s)) parts.Add(s.Trim());
                    }
                    if (parts.Count > 0)
                        ld.correctPrograms.Add(string.Join(";", parts));
                }
                else if (prog != null && prog.Type == JTokenType.String)
                {
                    string s = prog.ToString();
                    if (!string.IsNullOrWhiteSpace(s))
                        ld.correctPrograms.Add(s.Trim());
                }
            }
        }
        if (string.IsNullOrEmpty(ld.layoutMode) && dto.numberLine != null)
            ld.layoutMode = "NUMBER_LINE";
        if (string.IsNullOrEmpty(ld.levelName))
            ld.levelName = item["name"]?.ToString() ?? levelKey;

        string program = ld.guidedActions != null ? string.Join(", ", ld.guidedActions) : "";
        Debug.Log($"[PlatformLevelLoader] {levelKey} type={levelType} layout={ld.layoutMode} " +
                  $"ticks={ld.numberLine?.tickCount ?? 0} orderIndex={ld.orderIndex} " +
                  $"maxAttempts={ld.maxAttempts} commandHistory={ld.showCommandHistory} " +
                  $"animateRobot={ld.runRobotOnSubmit} program=[{program}] blanks={ld.blanks?.Count ?? 0}");
        if (ld.geometryPath != null)
        {
            Debug.Log(
                $"[PlatformLevelLoader] {levelKey} geometryPath colors target={ld.geometryPath.targetColor} " +
                $"trail={ld.geometryPath.trailColor} segments={ld.geometryPath.segments?.Count ?? 0}");
        }
        return ld;
    }

    private static string GetApiKey()
    {
        var bootstrap = FindObjectOfType<PlatformBootstrap>();
        if (bootstrap != null) return bootstrap.GameApiKeyForLoader;
        return "sparc-game-dev-key-change-in-production";
    }
}

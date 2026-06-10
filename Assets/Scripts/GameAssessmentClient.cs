using System;
using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

/// <summary>
/// Sends level assessment telemetry to the Next.js platform (localhost:3000).
/// Attach to a persistent GameObject; configure base URL, API key, and student id.
/// </summary>
public class GameAssessmentClient : MonoBehaviour
{
    public static GameAssessmentClient Instance
    {
        get
        {
            if (InstanceField == null)
            {
                var existing = FindObjectOfType<GameAssessmentClient>();
                if (existing != null)
                    InstanceField = existing;
                else
                {
                    var go = new GameObject("GameAssessmentClient");
                    InstanceField = go.AddComponent<GameAssessmentClient>();
                    DontDestroyOnLoad(go);
                }
            }
            return InstanceField;
        }
        private set => InstanceField = value;
    }

    private static GameAssessmentClient InstanceField;

    [Header("API")]
    [SerializeField] private string apiBaseUrl = "http://localhost:3000";
    [SerializeField] private string gameApiKey = "sparc-game-dev-key-change-in-production";

    [Header("Session")]
    [SerializeField] private string studentId = "STU-1001";
    [SerializeField] private string classId = "";
    [SerializeField] private string sessionToken = "";

    private string _currentAttemptId;
    private string _currentLevelId;

    private void Awake()
    {
        if (InstanceField != null && InstanceField != this)
        {
            Destroy(gameObject);
            return;
        }
        InstanceField = this;
        DontDestroyOnLoad(gameObject);
        SyncStudentFromPlayerPrefs();
    }

    public void SetStudent(string externalStudentId) => studentId = externalStudentId;

    public void SetSessionToken(string token) => sessionToken = token ?? "";

    public string SessionToken => sessionToken;

    private void SyncStudentFromPlayerPrefs()
    {
        if (PlayerPrefs.HasKey("UserId"))
        {
            studentId = PlayerPrefs.GetString("UserId");
        }
    }

    public void Configure(string url, string apiKey)
    {
        if (!string.IsNullOrWhiteSpace(url)) apiBaseUrl = url.TrimEnd('/');
        if (!string.IsNullOrWhiteSpace(apiKey)) gameApiKey = apiKey;
    }

    public string CurrentAttemptId => _currentAttemptId;

    public void StartLevel(string levelIdOrKey, string initialCommand = null, Action<bool> onComplete = null)
    {
        _currentLevelId = levelIdOrKey;
        SyncStudentFromPlayerPrefs();
        var payload = new LevelStartPayload
        {
            studentId = studentId,
            levelId = levelIdOrKey,
            initialCommand = initialCommand ?? ""
        };
        StartCoroutine(PostJson("/api/game/level-start", payload, (ok, body, code) =>
        {
            if (ok)
            {
                var res = JsonUtility.FromJson<LevelStartResponse>(body);
                _currentAttemptId = res.attemptId;
                Debug.Log($"[Assessment] Level started attempt={_currentAttemptId}");
            }
            else
            {
                Debug.LogError($"[Assessment] level-start failed (HTTP {code}): {body}");
            }
            onComplete?.Invoke(ok);
        }));
    }

    public void SaveCommandEvent(string command, string action, Action<bool> onComplete = null)
    {
        if (string.IsNullOrEmpty(_currentAttemptId)) return;
        var payload = new CommandEventPayload
        {
            attemptId = _currentAttemptId,
            command = command,
            action = action,
            timestamp = DateTime.UtcNow.ToString("o")
        };
        StartCoroutine(PostJson("/api/game/save-command-event", payload, (ok, body, _) => onComplete?.Invoke(ok)));
    }

    public void SaveActionButtonEvent(string buttonName, string eventType, Action<bool> onComplete = null)
    {
        if (string.IsNullOrEmpty(_currentAttemptId)) return;
        var payload = new ActionButtonPayload
        {
            attemptId = _currentAttemptId,
            buttonName = buttonName,
            eventType = eventType,
            timestamp = DateTime.UtcNow.ToString("o")
        };
        StartCoroutine(PostJson("/api/game/save-action-button-event", payload, (ok, body, _) => onComplete?.Invoke(ok)));
    }

    public void RecordStudentReset(Action<bool> onComplete = null)
    {
        if (string.IsNullOrEmpty(_currentAttemptId)) return;
        var payload = new ResetEventPayload { attemptId = _currentAttemptId };
        StartCoroutine(PostJson("/api/game/save-reset-event", payload, (ok, _, __) => onComplete?.Invoke(ok)));
    }

    public void SaveRobotTouchEvent(string eventType, float? durationSeconds = null, Action<bool> onComplete = null)
    {
        if (string.IsNullOrEmpty(_currentAttemptId)) return;
        var payload = new RobotTouchPayload
        {
            attemptId = _currentAttemptId,
            eventType = eventType,
            timestamp = DateTime.UtcNow.ToString("o"),
            durationSeconds = durationSeconds
        };
        StartCoroutine(PostJson("/api/game/save-robot-touch-event", payload, (ok, body, _) => onComplete?.Invoke(ok)));
    }

    /// <summary>Start attempt if needed, then send level-end (for level complete / next level).</summary>
    public void ReportLevelComplete(
        string levelKey,
        string externalStudentId,
        string initialCommand,
        string finalCommand,
        int score,
        float totalTimeSeconds,
        bool passed = true,
        string status = "correct",
        ObjectVisitPayload objectVisit = null,
        bool robotTouched = false,
        int robotTouchCount = 0,
        float robotTouchDurationSeconds = 0f,
        int resetCount = 0,
        AssessmentExtrasPayload assessmentExtras = null)
    {
        SetStudent(externalStudentId);
        if (string.IsNullOrEmpty(_currentAttemptId))
        {
            StartLevel(levelKey, initialCommand, ok =>
            {
                if (ok)
                    EndLevel(status, passed, score, finalCommand, totalTimeSeconds, null, null, objectVisit,
                        robotTouched, robotTouchCount, robotTouchDurationSeconds, resetCount, null, assessmentExtras);
            });
        }
        else
        {
            EndLevel(status, passed, score, finalCommand, totalTimeSeconds, null, null, objectVisit,
                robotTouched, robotTouchCount, robotTouchDurationSeconds, resetCount, null, assessmentExtras);
        }
    }

    public void EndLevel(
        string status,
        bool passed,
        int score,
        string finalCommand,
        float totalTimeSeconds,
        string[] mistakes = null,
        string feedback = null,
        ObjectVisitPayload objectVisit = null,
        bool robotTouched = false,
        int robotTouchCount = 0,
        float robotTouchDurationSeconds = 0f,
        int resetCount = 0,
        Action<bool> onComplete = null,
        AssessmentExtrasPayload assessmentExtras = null)
    {
        if (string.IsNullOrEmpty(_currentAttemptId)) return;
        var payload = new LevelEndPayload
        {
            attemptId = _currentAttemptId,
            status = status,
            passed = passed,
            score = score,
            finalCommand = finalCommand,
            totalTimeSeconds = totalTimeSeconds,
            mistakes = mistakes ?? Array.Empty<string>(),
            feedback = feedback,
            objectVisit = objectVisit,
            robotTouched = robotTouched,
            robotTouchCount = robotTouchCount,
            robotTouchDurationSeconds = robotTouchDurationSeconds,
            resetCount = resetCount,
            assessmentExtras = assessmentExtras
        };
        StartCoroutine(PostJson("/api/game/level-end", payload, (ok, body, code) =>
        {
            if (ok) Debug.Log("[Assessment] Level ended successfully");
            else Debug.LogError($"[Assessment] level-end failed (HTTP {code}): {body}");
            onComplete?.Invoke(ok);
        }));
    }

    private IEnumerator PostJson(string path, object payload, Action<bool, string, long> callback)
    {
        var json = JsonUtility.ToJson(payload);
        var url = apiBaseUrl.TrimEnd('/') + path;
        using var req = new UnityWebRequest(url, "POST");
        var bodyRaw = Encoding.UTF8.GetBytes(json);
        req.uploadHandler = new UploadHandlerRaw(bodyRaw);
        req.downloadHandler = new DownloadHandlerBuffer();
        req.SetRequestHeader("Content-Type", "application/json");
        req.SetRequestHeader("X-Game-Api-Key", gameApiKey);

        yield return req.SendWebRequest();

        var responseText = req.downloadHandler?.text;
        if (string.IsNullOrEmpty(responseText) && !string.IsNullOrEmpty(req.error))
        {
            responseText = req.error;
        }

        var success = req.result == UnityWebRequest.Result.Success;
        callback?.Invoke(success, responseText ?? "", req.responseCode);
    }

    [Serializable]
    private class LevelStartPayload
    {
        public string studentId;
        public string levelId;
        public string initialCommand;
    }

    [Serializable]
    private class LevelStartResponse
    {
        public string attemptId;
        public int attemptNumber;
        public string levelKey;
    }

    [Serializable]
    private class CommandEventPayload
    {
        public string attemptId;
        public string command;
        public string action;
        public string timestamp;
    }

    [Serializable]
    private class ActionButtonPayload
    {
        public string attemptId;
        public string buttonName;
        public string eventType;
        public string timestamp;
    }

    [Serializable]
    private class ResetEventPayload
    {
        public string attemptId;
    }

    [Serializable]
    private class RobotTouchPayload
    {
        public string attemptId;
        public string eventType;
        public string timestamp;
        public float? durationSeconds;
    }

    [Serializable]
    public class ObjectVisitPayload
    {
        public string startObjectType;
        public string endObjectType;
        public bool reachedStart;
        public bool reachedEnd;
        /// <summary>both | start_only | end_only | neither</summary>
        public string visitPattern;
    }

    /// <summary>Structured assessment fields for flag prediction and choose-action levels.</summary>
    [Serializable]
    public class AssessmentExtrasPayload
    {
        public int flagCellX = -1;
        public int flagCellY = -1;
        public int expectedCellX = -1;
        public int expectedCellY = -1;
        public bool flagPredictionCorrect;
        public string[] blankAnswers;
        public string[] correctBlankAnswers;
        public bool blankAnswersCorrect;
    }

    [Serializable]
    private class LevelEndPayload
    {
        public string attemptId;
        public string status;
        public bool passed;
        public int score;
        public string finalCommand;
        public float totalTimeSeconds;
        public string[] mistakes;
        public string feedback;
        public ObjectVisitPayload objectVisit;
        public bool robotTouched;
        public int robotTouchCount;
        public float robotTouchDurationSeconds;
        public int resetCount;
        public AssessmentExtrasPayload assessmentExtras;
    }
}

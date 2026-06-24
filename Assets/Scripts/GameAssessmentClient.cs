using System;
using System.Collections;
using System.Collections.Generic;
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
    private int _startRequestGeneration;
    private bool _startInFlight;
    private readonly Queue<LevelEndRequest> _endQueue = new Queue<LevelEndRequest>();
    private bool _processingEndQueue;
    private int _endPostInFlight;

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
    public string CurrentLevelId => _currentLevelId;

    public bool HasPendingReports =>
        _processingEndQueue || _endQueue.Count > 0 || _endPostInFlight > 0;

    public bool StartInFlight => _startInFlight;

    /// <summary>Wait until queued level-end calls finish (call before advancing to the next item).</summary>
    public IEnumerator WaitForPendingReports(float timeoutSeconds = 25f)
    {
        float elapsed = 0f;
        while (HasPendingReports && elapsed < timeoutSeconds)
        {
            elapsed += Time.unscaledDeltaTime;
            yield return null;
        }
    }

    /// <summary>Wait until RUN's level-start has assigned an attempt for this item.</summary>
    public IEnumerator WaitForAttemptReady(string levelKey, float timeoutSeconds = 15f)
    {
        float elapsed = 0f;
        while (elapsed < timeoutSeconds)
        {
            if (!string.IsNullOrEmpty(_currentAttemptId) &&
                (string.IsNullOrEmpty(levelKey) || _currentLevelId == levelKey))
                yield break;

            if (!_startInFlight && string.IsNullOrEmpty(_currentAttemptId) && elapsed > 1f)
                yield break;

            elapsed += Time.unscaledDeltaTime;
            yield return null;
        }
    }

    /// <summary>Clears the active attempt when loading a new item (prevents cross-item telemetry).</summary>
    public void ClearCurrentAttempt()
    {
        _currentAttemptId = null;
        _currentLevelId = null;
        _startRequestGeneration++;
        _startInFlight = false;
    }

    /// <summary>
    /// Drops the local attempt handle after level-end is queued (end payload keeps the captured id).
    /// Does not cancel in-flight level-start requests.
    /// </summary>
    private void ReleaseAttemptAfterQueuedEnd()
    {
        _currentAttemptId = null;
    }

    public void StartLevel(string levelIdOrKey, string initialCommand = null, int slotNumber = 0, Action<bool> onComplete = null)
    {
        _currentLevelId = levelIdOrKey;
        SyncStudentFromPlayerPrefs();
        int generation = ++_startRequestGeneration;
        _startInFlight = true;
        var payload = new LevelStartPayload
        {
            studentId = studentId,
            levelId = levelIdOrKey,
            initialCommand = initialCommand ?? "",
            slotNumber = slotNumber > 0 ? slotNumber : 0
        };
        StartCoroutine(PostJson("/api/game/level-start", payload, (ok, body, code) =>
        {
            _startInFlight = false;
            if (generation != _startRequestGeneration)
            {
                onComplete?.Invoke(false);
                return;
            }

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
        }, retries: 2));
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

    /// <summary>Wait for RUN's level-start, then send level-end (for level complete / next level).</summary>
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
        _currentLevelId = levelKey;
        var capturedAttemptId = _currentAttemptId;
        var playSlot = assessmentExtras != null && assessmentExtras.playSlot > 0
            ? assessmentExtras.playSlot
            : 0;
        EnqueueEnd(new LevelEndRequest
        {
            attemptId = capturedAttemptId,
            status = status,
            passed = passed,
            score = score,
            finalCommand = finalCommand,
            totalTimeSeconds = totalTimeSeconds,
            mistakes = null,
            feedback = null,
            objectVisit = objectVisit,
            robotTouched = robotTouched,
            robotTouchCount = robotTouchCount,
            robotTouchDurationSeconds = robotTouchDurationSeconds,
            resetCount = resetCount,
            assessmentExtras = assessmentExtras,
            initialCommand = initialCommand,
            levelKey = levelKey,
            playSlot = playSlot,
            waitForAttemptStart = string.IsNullOrEmpty(capturedAttemptId)
        });
        if (!string.IsNullOrEmpty(capturedAttemptId))
            ReleaseAttemptAfterQueuedEnd();
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
        var capturedAttemptId = _currentAttemptId;
        EnqueueEnd(new LevelEndRequest
        {
            attemptId = capturedAttemptId,
            status = status,
            passed = passed,
            score = score,
            finalCommand = finalCommand,
            totalTimeSeconds = totalTimeSeconds,
            mistakes = mistakes,
            feedback = feedback,
            objectVisit = objectVisit,
            robotTouched = robotTouched,
            robotTouchCount = robotTouchCount,
            robotTouchDurationSeconds = robotTouchDurationSeconds,
            resetCount = resetCount,
            assessmentExtras = assessmentExtras,
            onComplete = onComplete,
            waitForAttemptStart = string.IsNullOrEmpty(capturedAttemptId)
        });
        if (!string.IsNullOrEmpty(capturedAttemptId))
            ReleaseAttemptAfterQueuedEnd();
    }

    private void EnqueueEnd(LevelEndRequest request)
    {
        _endQueue.Enqueue(request);
        if (!_processingEndQueue)
            StartCoroutine(ProcessEndQueue());
    }

    private IEnumerator ProcessEndQueue()
    {
        _processingEndQueue = true;
        while (_endQueue.Count > 0)
        {
            var request = _endQueue.Dequeue();
            yield return EndLevelWhenReady(request);
        }
        _processingEndQueue = false;
    }

    private IEnumerator EndLevelWhenReady(LevelEndRequest request)
    {
        var attemptId = request.attemptId;

        if (request.waitForAttemptStart && string.IsNullOrEmpty(attemptId))
        {
            yield return WaitForAttemptReady(request.levelKey);

            attemptId = !string.IsNullOrEmpty(request.attemptId)
                ? request.attemptId
                : _currentAttemptId;

            if (!string.IsNullOrEmpty(attemptId) &&
                !string.IsNullOrEmpty(request.levelKey) &&
                _currentLevelId != request.levelKey)
            {
                Debug.LogWarning(
                    $"[Assessment] Active attempt is for {_currentLevelId}, not {request.levelKey} — starting level before end.");
                attemptId = null;
            }

            if (string.IsNullOrEmpty(attemptId))
            {
                Debug.LogWarning("[Assessment] No attempt id after waiting — starting level before end.");
                bool started = false;
                bool startOk = false;
                StartLevel(request.levelKey, request.initialCommand, request.playSlot, ok =>
                {
                    startOk = ok;
                    started = true;
                });
                float elapsed = 0f;
                while (!started && elapsed < 15f)
                {
                    elapsed += Time.unscaledDeltaTime;
                    yield return null;
                }
                yield return WaitForAttemptReady(request.levelKey);
                attemptId = _currentAttemptId;
                if (!startOk || string.IsNullOrEmpty(attemptId))
                {
                    Debug.LogError("[Assessment] level-end aborted: could not obtain attempt id.");
                    request.onComplete?.Invoke(false);
                    yield break;
                }
            }
        }

        if (string.IsNullOrEmpty(attemptId))
            attemptId = _currentAttemptId;

        if (string.IsNullOrEmpty(attemptId))
        {
            Debug.LogWarning("[Assessment] level-end skipped: no active attempt.");
            request.onComplete?.Invoke(false);
            yield break;
        }
        var payload = new LevelEndPayload
        {
            attemptId = attemptId,
            status = request.status,
            passed = request.passed,
            score = request.score,
            finalCommand = request.finalCommand,
            totalTimeSeconds = request.totalTimeSeconds,
            mistakes = request.mistakes ?? Array.Empty<string>(),
            feedback = request.feedback,
            objectVisit = request.objectVisit,
            robotTouched = request.robotTouched,
            robotTouchCount = request.robotTouchCount,
            robotTouchDurationSeconds = request.robotTouchDurationSeconds,
            resetCount = request.resetCount,
            assessmentExtras = request.assessmentExtras
        };

        bool done = false;
        bool success = false;
        _endPostInFlight++;
        StartCoroutine(PostJson("/api/game/level-end", payload, (ok, body, code) =>
        {
            _endPostInFlight = Math.Max(0, _endPostInFlight - 1);
            success = ok;
            if (ok)
            {
                Debug.Log("[Assessment] Level ended successfully");
                if (_currentAttemptId == attemptId)
                    _currentAttemptId = null;
                _startRequestGeneration++;
            }
            else Debug.LogError($"[Assessment] level-end failed (HTTP {code}): {body}");
            done = true;
        }, retries: 2));

        float wait = 0f;
        while (!done && wait < 20f)
        {
            wait += Time.unscaledDeltaTime;
            yield return null;
        }

        request.onComplete?.Invoke(success);
    }

    private IEnumerator PostJson(string path, object payload, Action<bool, string, long> callback, int retries = 1)
    {
        var attempt = 0;
        while (true)
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
            if (success || attempt >= retries)
            {
                callback?.Invoke(success, responseText ?? "", req.responseCode);
                yield break;
            }

            attempt++;
            yield return new WaitForSecondsRealtime(0.6f);
        }
    }

    private class LevelEndRequest
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
        public Action<bool> onComplete;
        public bool waitForAttemptStart;
        public string levelKey;
        public string initialCommand;
        public int playSlot;
    }

    [Serializable]
    private class LevelStartPayload
    {
        public string studentId;
        public string levelId;
        public string initialCommand;
        public int slotNumber;
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
        /// <summary>Which in-level RUN this row represents (1 = first try, 2 = second try, …).</summary>
        public int inLevelRunNumber;
        /// <summary>maxAttempts configured for this level.</summary>
        public int maxLevelRuns;
        /// <summary>1-based slot in the student's assigned item list (for accurate reporting).</summary>
        public int playSlot;
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

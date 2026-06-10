using System;
using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

/// <summary>
/// Connects Unity (main menu + gameplay) to the Next.js assessment platform.
/// </summary>
public class PlatformCommunication : MonoBehaviour
{
    private static PlatformCommunication instance;

    public static PlatformCommunication Instance
    {
        get
        {
            if (instance == null)
            {
                var go = new GameObject("PlatformCommunication");
                instance = go.AddComponent<PlatformCommunication>();
                DontDestroyOnLoad(go);
            }
            return instance;
        }
    }

    [Header("Platform API")]
    [SerializeField] private string platformUrl = "http://localhost:3000";
    [SerializeField] private string gameApiKey = "sparc-game-dev-key-change-in-production";

    [Header("Session")]
    [SerializeField] private string currentStudentExternalId = "";

    private bool _signInInProgress;

    public string PlatformUrl => platformUrl;
    public string CurrentStudentExternalId => currentStudentExternalId;

    public void Configure(string url, string apiKey)
    {
        if (!string.IsNullOrWhiteSpace(url)) platformUrl = url.TrimEnd('/');
        if (!string.IsNullOrWhiteSpace(apiKey)) gameApiKey = apiKey;
    }

    private void Awake()
    {
        if (instance == null)
        {
            instance = this;
            DontDestroyOnLoad(gameObject);
        }
        else if (instance != this)
        {
            Destroy(gameObject);
        }
    }

    /// <summary>
    /// Main-menu login: verifies student or creates a new one (Flask-compatible callback).
    /// </summary>
    public void CheckOrCreateStudent(string studentId, Action<bool, string> callback)
    {
        StartCoroutine(StudentSignIn(studentId, null, callback));
    }

    public void RegisterStudent(string studentId, string displayName, Action<bool, string> callback)
    {
        StartCoroutine(StudentSignIn(studentId, displayName, callback));
    }

    private IEnumerator StudentSignIn(string studentId, string displayName, Action<bool, string> callback)
    {
        if (_signInInProgress)
        {
            callback?.Invoke(false, "Sign-in already in progress. Please wait.");
            yield break;
        }
        _signInInProgress = true;

        var url = platformUrl.TrimEnd('/') + "/api/game/student-signin";
        var payload = new StudentSignInRequest
        {
            studentId = studentId,
            displayName = displayName ?? ""
        };
        var json = JsonUtility.ToJson(payload);

        using var req = new UnityWebRequest(url, "POST");
        req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(json));
        req.downloadHandler = new DownloadHandlerBuffer();
        req.SetRequestHeader("Content-Type", "application/json");
        req.SetRequestHeader("X-Game-Api-Key", gameApiKey);

        yield return req.SendWebRequest();

        _signInInProgress = false;

        var body = req.downloadHandler?.text;
        var errorDetail = string.IsNullOrEmpty(body) ? req.error : body;

        if (req.result == UnityWebRequest.Result.Success)
        {
            currentStudentExternalId = studentId;
            if (GameAssessmentClient.Instance != null)
            {
                GameAssessmentClient.Instance.SetStudent(NormalizeExternalId(studentId));
            }
            callback?.Invoke(true, body);
        }
        else
        {
            Debug.LogError(
                $"[PlatformCommunication] student-signin failed (HTTP {req.responseCode}): {errorDetail}"
            );
            callback?.Invoke(false, errorDetail ?? "Unknown network error");
        }
    }

    public static string NormalizeExternalId(string studentId)
    {
        var id = studentId.Trim();
        return id.StartsWith("STU-", StringComparison.OrdinalIgnoreCase) ? id.ToUpperInvariant() : "STU-" + id;
    }

    public void SendGameProgress(string userId, string level, int score, string actions)
    {
        if (GameAssessmentClient.Instance == null)
        {
            Debug.LogWarning("[PlatformCommunication] GameAssessmentClient not in scene.");
            return;
        }
        StartCoroutine(SendProgress(userId, level, score, actions));
    }

    private IEnumerator SendProgress(string userId, string level, int score, string actions)
    {
        if (string.IsNullOrEmpty(GameAssessmentClient.Instance.CurrentAttemptId))
        {
            Debug.LogWarning("[PlatformCommunication] No active attempt. Call StartLevel first.");
            yield break;
        }

        var url = platformUrl.TrimEnd('/') + "/api/game/save-progress";
        var payload = new SaveProgressRequest
        {
            attemptId = GameAssessmentClient.Instance.CurrentAttemptId,
            score = score,
            finalCommand = actions,
            feedback = level
        };
        var json = JsonUtility.ToJson(payload);

        using var req = new UnityWebRequest(url, "POST");
        req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(json));
        req.downloadHandler = new DownloadHandlerBuffer();
        req.SetRequestHeader("Content-Type", "application/json");
        req.SetRequestHeader("X-Game-Api-Key", gameApiKey);

        yield return req.SendWebRequest();

        if (req.result != UnityWebRequest.Result.Success)
        {
            Debug.LogError($"[PlatformCommunication] save-progress failed: {req.error}");
        }
    }

    [Serializable]
    private class StudentSignInRequest
    {
        public string studentId;
        public string displayName;
    }

    [Serializable]
    private class SaveProgressRequest
    {
        public string attemptId;
        public int score;
        public string finalCommand;
        public string feedback;
    }
}

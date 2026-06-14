using UnityEngine;

/// <summary>
/// Add this ONCE to your Main Menu scene (same GameObject as LoginManager is fine).
/// Ensures platform connection is configured before the player taps Login.
/// </summary>
[DefaultExecutionOrder(-100)]
public class PlatformBootstrap : MonoBehaviour
{
    [Header("Platform (must match platform/.env)")]
    [SerializeField] private string platformUrl = "http://localhost:3000";
    [SerializeField] private string gameApiKey = "sparc-game-dev-key-change-in-production";

    public string GameApiKeyForLoader => gameApiKey;

    [Header("Optional — also on LoginManager")]
    [SerializeField] private bool logReadyMessage = true;

    private void Awake()
    {
        var comm = PlatformCommunication.Instance;
        comm.Configure(platformUrl, gameApiKey);

        GameAssessmentClient assessment = FindObjectOfType<GameAssessmentClient>();
        if (assessment == null)
        {
            assessment = comm.gameObject.AddComponent<GameAssessmentClient>();
        }
        assessment.Configure(platformUrl, gameApiKey);
        DontDestroyOnLoad(assessment.gameObject);

        EnsureStudentDataManager();
        LandscapeOrientationLock.ApplyLandscapeOnly();
        LandscapeOrientationLock.RequestBrowserLandscapeLock();
    }

    private void Start()
    {
        if (!StudentWebConfig.TryApplyToGame())
        {
            if (logReadyMessage)
            {
                Debug.Log($"[PlatformBootstrap] Ready — {platformUrl} (enter Student ID on login screen)");
            }
            return;
        }

        if (logReadyMessage)
        {
            Debug.Log($"[PlatformBootstrap] Web student session applied — {platformUrl}");
        }

        StudentWebConfig.EnterGameFromWebSession();
    }

    private static void EnsureStudentDataManager()
    {
        if (StudentDataManager.Instance != null) return;
        var go = new GameObject("StudentDataManager");
        go.AddComponent<StudentDataManager>();
    }
}

using System;
using System.Collections;
using UnityEngine;

/// <summary>
/// Legacy name kept for existing scenes. All calls forward to the Next.js platform (port 3000).
/// </summary>
[Obsolete("Use PlatformCommunication instead. This class only forwards calls.")]
public class FlaskCommunication : MonoBehaviour
{
    private static FlaskCommunication instance;

    public static FlaskCommunication Instance
    {
        get
        {
            if (instance == null)
            {
                var go = new GameObject("FlaskCommunication");
                instance = go.AddComponent<FlaskCommunication>();
                DontDestroyOnLoad(go);
            }
            return instance;
        }
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

    public void SendGameProgress(string userId, string level, int score, string actions)
    {
        PlatformCommunication.Instance.SendGameProgress(userId, level, score, actions);
    }

    public void GetUserLogs(string userId, Action<string> callback)
    {
        Debug.LogWarning("[FlaskCommunication] GetUserLogs is not implemented on the platform yet.");
        callback?.Invoke(null);
    }

    public void CheckOrCreateStudent(string studentId, Action<bool, string> callback)
    {
        PlatformCommunication.Instance.CheckOrCreateStudent(studentId, callback);
    }
}

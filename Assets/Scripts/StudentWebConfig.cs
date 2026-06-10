using System;
using System.Collections;
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.Networking;

/// <summary>
/// Reads student session config injected by the Next.js /student/play page (WebGL).
/// Supports window.StudentGameConfig and URL query parameters.
/// </summary>
public static class StudentWebConfig
{
    [Serializable]
    public class Payload
    {
        public string studentId;
        public string studentCode;
        public string sessionToken;
        public string apiBaseUrl;
        public string gameApiKey;
    }

#if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")]
    private static extern string StudentWebBridge_GetConfigJson();
#endif

    public static bool TryApplyToGame()
    {
        var payload = Load();
        if (payload == null || string.IsNullOrWhiteSpace(payload.studentCode))
            return false;

        var studentCode = PlatformCommunication.NormalizeExternalId(payload.studentCode.Trim());
        PlayerPrefs.SetString("UserId", studentCode);
        PlayerPrefs.Save();

        var comm = PlatformCommunication.Instance;
        if (!string.IsNullOrWhiteSpace(payload.apiBaseUrl))
        {
            comm.Configure(payload.apiBaseUrl, payload.gameApiKey);
        }

        if (GameAssessmentClient.Instance != null)
        {
            GameAssessmentClient.Instance.SetStudent(studentCode);
            if (!string.IsNullOrWhiteSpace(payload.sessionToken))
            {
                GameAssessmentClient.Instance.SetSessionToken(payload.sessionToken);
            }
        }

        if (StudentDataManager.Instance != null)
        {
            var studentData = new StudentData();
            studentData.id = studentCode.GetHashCode();
            studentData.username = studentCode;
            StudentDataManager.Instance.SetCurrentStudent(studentData);
        }

        Debug.Log($"[StudentWebConfig] Applied Web session for {studentCode}");
        return true;
    }

    public static Payload Load()
    {
        var fromJs = LoadFromJsBridge();
        if (fromJs != null && !string.IsNullOrWhiteSpace(fromJs.studentCode))
            return fromJs;

        return LoadFromQueryString();
    }

    private static Payload LoadFromJsBridge()
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        try
        {
            var json = StudentWebBridge_GetConfigJson();
            if (!string.IsNullOrWhiteSpace(json))
                return JsonUtility.FromJson<Payload>(json);
        }
        catch (Exception e)
        {
            Debug.LogWarning($"[StudentWebConfig] JS bridge read failed: {e.Message}");
        }
#endif
        return null;
    }

    private static Payload LoadFromQueryString()
    {
        var absolute = Application.absoluteURL;
        if (string.IsNullOrWhiteSpace(absolute))
            return null;

        try
        {
            var uri = new Uri(absolute);
            var query = uri.Query;
            if (string.IsNullOrWhiteSpace(query))
                return null;

            var payload = new Payload();
            foreach (var part in query.TrimStart('?').Split('&'))
            {
                var kv = part.Split('=');
                if (kv.Length != 2) continue;
                var key = Uri.UnescapeDataString(kv[0]);
                var value = Uri.UnescapeDataString(kv[1]);
                switch (key)
                {
                    case "studentId": payload.studentId = value; break;
                    case "studentCode": payload.studentCode = value; break;
                    case "token": payload.sessionToken = value; break;
                    case "apiBaseUrl": payload.apiBaseUrl = value; break;
                    case "gameApiKey": payload.gameApiKey = value; break;
                }
            }

            if (string.IsNullOrWhiteSpace(payload.studentCode) && !string.IsNullOrWhiteSpace(payload.studentId))
                payload.studentCode = payload.studentId;

            return payload;
        }
        catch (Exception e)
        {
            Debug.LogWarning($"[StudentWebConfig] Query parse failed: {e.Message}");
            return null;
        }
    }
}

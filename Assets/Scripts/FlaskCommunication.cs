using UnityEngine;
using UnityEngine.Networking;
using System.Collections;
using System;

public class FlaskCommunication : MonoBehaviour
{
    private const string FLASK_URL = "http://127.0.0.1:5000";
    private static FlaskCommunication instance;

    public static FlaskCommunication Instance
    {
        get
        {
            if (instance == null)
            {
                GameObject go = new GameObject("FlaskCommunication");
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
        else
        {
            Destroy(gameObject);
        }
    }

    public void SendGameProgress(string userId, string level, int score, string actions)
    {
        StartCoroutine(SendProgressToFlask(userId, level, score, actions));
    }

    private IEnumerator SendProgressToFlask(string userId, string level, int score, string actions)
    {
        WWWForm form = new WWWForm();
        form.AddField("user_id", userId);
        form.AddField("level", level);
        form.AddField("score", score.ToString());
        form.AddField("actions", actions);

        using (UnityWebRequest www = UnityWebRequest.Post(FLASK_URL + "/api/game_progress", form))
        {
            yield return www.SendWebRequest();

            if (www.result == UnityWebRequest.Result.Success)
            {
                Debug.Log("Progress sent successfully to Flask");
            }
            else
            {
                Debug.LogError("Error sending progress to Flask: " + www.error);
            }
        }
    }

    public void GetUserLogs(string userId, Action<string> callback)
    {
        StartCoroutine(GetLogsFromFlask(userId, callback));
    }

    private IEnumerator GetLogsFromFlask(string userId, Action<string> callback)
    {
        using (UnityWebRequest www = UnityWebRequest.Get(FLASK_URL + $"/api/get_user_logs/{userId}"))
        {
            yield return www.SendWebRequest();

            if (www.result == UnityWebRequest.Result.Success)
            {
                callback?.Invoke(www.downloadHandler.text);
            }
            else
            {
                Debug.LogError("Error getting logs from Flask: " + www.error);
                callback?.Invoke(null);
            }
        }
    }
} 
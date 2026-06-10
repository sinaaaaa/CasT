using UnityEngine;
using UnityEngine.UI;
using System.Collections;
using System.Collections.Generic;
using TMPro;
using UnityEngine.Networking;
using System;

public class GameLogViewer : MonoBehaviour
{
    [SerializeField] private Transform logContainer;
    [SerializeField] private GameObject logEntryPrefab;
    [SerializeField] private TextMeshProUGUI statusText;
    [SerializeField] private Button refreshButton;

    private const string FLASK_URL = "http://localhost:5000"; // Change this to your Flask server URL
    private string userId;

    private void Start()
    {
        // Get user ID from PlayerPrefs
        userId = PlayerPrefs.GetString("UserId");
        if (string.IsNullOrEmpty(userId))
        {
            Debug.LogError("No user ID found!");
            statusText.text = "Error: Not logged in";
            return;
        }

        // Set up refresh button
        if (refreshButton != null)
        {
            refreshButton.onClick.AddListener(LoadGameLogs);
        }

        // Initial load of game logs
        LoadGameLogs();
    }

    public void LoadGameLogs()
    {
        StartCoroutine(FetchGameLogs());
    }

    private IEnumerator FetchGameLogs()
    {
        if (string.IsNullOrEmpty(userId))
        {
            statusText.text = "Error: Not logged in";
            yield break;
        }

        statusText.text = "Loading game logs...";

        string url = $"{FLASK_URL}/api/get_user_logs/{userId}";
        using (UnityWebRequest www = UnityWebRequest.Get(url))
        {
            yield return www.SendWebRequest();

            if (www.result == UnityWebRequest.Result.Success)
            {
                try
                {
                    GameLogResponse response = JsonUtility.FromJson<GameLogResponse>(www.downloadHandler.text);
                    if (response.status == "success")
                    {
                        DisplayGameLogs(response.logs);
                        statusText.text = "Game logs loaded successfully";
                    }
                    else
                    {
                        statusText.text = "Error: " + response.message;
                    }
                }
                catch (Exception e)
                {
                    Debug.LogError($"Error parsing response: {e.Message}");
                    statusText.text = "Error parsing server response";
                }
            }
            else
            {
                Debug.LogError($"Error fetching game logs: {www.error}");
                statusText.text = "Error loading game logs";
            }
        }
    }

    private void DisplayGameLogs(List<GameLog> logs)
    {
        // Clear existing logs
        foreach (Transform child in logContainer)
        {
            Destroy(child.gameObject);
        }

        if (logs == null || logs.Count == 0)
        {
            statusText.text = "No game logs found";
            return;
        }

        // Display each log
        foreach (GameLog log in logs)
        {
            GameObject logEntry = Instantiate(logEntryPrefab, logContainer);
            LogEntryUI logEntryUI = logEntry.GetComponent<LogEntryUI>();
            
            if (logEntryUI != null)
            {
                logEntryUI.SetLogData(log);
            }
        }
    }
}

[Serializable]
public class GameLogResponse
{
    public string status;
    public string message;
    public List<GameLog> logs;
}

[Serializable]
public class GameLog
{
    public string level;
    public int score;
    public string actions;
    public string timestamp;
}

public class LogEntryUI : MonoBehaviour
{
    [SerializeField] private TextMeshProUGUI levelText;
    [SerializeField] private TextMeshProUGUI scoreText;
    [SerializeField] private TextMeshProUGUI actionsText;
    [SerializeField] private TextMeshProUGUI timestampText;

    public void SetLogData(GameLog log)
    {
        if (levelText != null)
        {
            string displayLevel = string.IsNullOrEmpty(log.level)
                ? log.level
                : log.level.Replace("Level", "Item").Replace("level", "item");
            levelText.text = $"Item: {displayLevel}";
        }
        if (scoreText != null) scoreText.text = $"Score: {log.score}";
        if (actionsText != null) actionsText.text = $"Actions: {log.actions}";
        if (timestampText != null) timestampText.text = $"Time: {log.timestamp}";
    }
} 
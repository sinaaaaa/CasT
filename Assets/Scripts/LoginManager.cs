using UnityEngine;
using UnityEngine.UI;
using TMPro;
using UnityEngine.Networking;
using System.Collections;
using System;

public class LoginManager : MonoBehaviour
{
    [SerializeField] private TMP_InputField studentIdInput;
    [SerializeField] private Button loginButton;
    [SerializeField] private TextMeshProUGUI statusText;
    [SerializeField] private string flaskUrl = "http://localhost:5000";

    private void Start()
    {
        if (loginButton != null)
        {
            loginButton.onClick.AddListener(OnLoginButtonClicked);
        }
        else
        {
            Debug.LogError("Login button not assigned!");
        }
    }

    public void OnLoginButtonClicked()
    {
        if (string.IsNullOrEmpty(studentIdInput.text))
        {
            ShowError("Please enter your student ID");
            return;
        }

        StartCoroutine(LoginStudent(studentIdInput.text));
    }

    private IEnumerator LoginStudent(string studentId)
    {
        string url = $"{flaskUrl}/api/check_student/{studentId}";
        Debug.Log($"Checking student at URL: {url}");

        using (UnityWebRequest www = UnityWebRequest.Get(url))
        {
            yield return www.SendWebRequest();

            if (www.result == UnityWebRequest.Result.Success)
            {
                string response = www.downloadHandler.text;
                Debug.Log($"Server response: {response}");

                try
                {
                    StudentResponse studentResponse = JsonUtility.FromJson<StudentResponse>(response);
                    
                    if (studentResponse.status == "success")
                    {
                        // Create a new StudentData instance using the global StudentData class
                        var studentData = new StudentData();
                        studentData.id = int.Parse(studentResponse.student.id);
                        studentData.username = studentResponse.student.username;

                        // Save the user ID to PlayerPrefs
                        PlayerPrefs.SetString("UserId", studentResponse.student.id);
                        // Only set to 1 if this is a new user (no saved level yet)
                        string levelKey = studentResponse.student.id + "_currentLevel";
                        if (!PlayerPrefs.HasKey(levelKey)) {
                            PlayerPrefs.SetInt(levelKey, 1);
                            Debug.Log($"[LoginManager] New user: Set {levelKey} to 1 at login.");
                        } else {
                            Debug.Log($"[LoginManager] Existing user: {levelKey} already set to {PlayerPrefs.GetInt(levelKey)}");
                        }
                        PlayerPrefs.Save();

                        // Set the current student in StudentDataManager
                        if (StudentDataManager.Instance != null)
                        {
                            StudentDataManager.Instance.SetCurrentStudent(studentData);
                            ShowSuccess("Login successful!");
                            // Load the game scene
                            // UnityEngine.SceneManagement.SceneManager.LoadScene("Level1");

                            // Set the target scene for the loading screen
                            PlayerPrefs.SetString("SceneToLoadAfterLoading", "Level1");
                            PlayerPrefs.Save();
                            
                            // Load the loading scene
                            UnityEngine.SceneManagement.SceneManager.LoadScene("LoadingScene"); // Assuming your loading scene is named "LoadingScene"
                        }
                        else
                        {
                            ShowError("StudentDataManager not found!");
                        }
                    }
                    else
                    {
                        ShowError(studentResponse.message);
                    }
                }
                catch (Exception e)
                {
                    Debug.LogError($"Error parsing response: {e.Message}");
                    ShowError("Error processing server response");
                }
            }
            else
            {
                Debug.LogError($"Error: {www.error}");
                ShowError("Connection error. Please try again.");
            }
        }
    }

    private void ShowError(string message)
    {
        if (statusText != null)
        {
            statusText.text = message;
            statusText.color = Color.red;
        }
        Debug.LogError($"Login Error: {message}");
    }

    private void ShowSuccess(string message)
    {
        if (statusText != null)
        {
            statusText.text = message;
            statusText.color = Color.green;
        }
        Debug.Log($"Login Success: {message}");
    }

    [Serializable]
    private class StudentResponse
    {
        public string status;
        public string message;
        public ServerStudentData student;
    }

    [Serializable]
    private class ServerStudentData
    {
        public string id;
        public string username;
        public string password;
    }

    [Serializable]
    private class GameProgressData
    {
        public string user_id;
        public string level;
        public int score;
        public string actions;
    }
} 
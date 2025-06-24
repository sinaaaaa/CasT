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
    [SerializeField] private string flaskUrl = "https://web-production-db15b.up.railway.app";

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
        // Ensure keyboard shows on touch devices
        if (studentIdInput != null)
        {
            studentIdInput.onSelect.AddListener(OnInputFieldSelected);
        }
    }

    private void OnInputFieldSelected(string text)
    {
        studentIdInput.ActivateInputField();
    }

    public void OnLoginButtonClicked()
    {
        if (string.IsNullOrEmpty(studentIdInput.text))
        {
            ShowError("Please enter your student ID");
            return;
        }

        // Unlock audio for WebGL on first user interaction
        AudioInitializer.EnsureAudioUnlocked();

        // Use FlaskCommunication singleton instead of direct API call
        if (FlaskCommunication.Instance != null)
        {
            FlaskCommunication.Instance.CheckOrCreateStudent(studentIdInput.text, OnStudentCheckComplete);
        }
        else
        {
            ShowError("FlaskCommunication not available");
        }
    }

    private void OnStudentCheckComplete(bool success, string response)
    {
        if (success)
        {
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
            Debug.LogError($"Error: {response}");
            ShowError("Connection error. Please try again.");
        }
    }

    private IEnumerator LoginStudent(string studentId)
    {
        // This method is now deprecated - using OnStudentCheckComplete instead
        yield return null;
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
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.Networking;
using System.Collections;
using System;
using UnityEngine.EventSystems;

public class LoginManager : MonoBehaviour
{
    [SerializeField] private InputField studentIdInput;
    [SerializeField] private Button loginButton;
    [SerializeField] private Text statusText;
    [SerializeField] private string platformUrl = "http://localhost:3000";

    private TouchScreenKeyboard mobileKeyboard;
    private bool isKeyboardOpen = false;
    private bool wasFocused = false;

    private void Start()
    {
        if (StudentWebConfig.HasWebSessionPayload())
        {
            HideLoginUi();
            return;
        }

        if (loginButton != null)
        {
            loginButton.onClick.AddListener(OnLoginButtonClicked);
        }
        else
        {
            Debug.LogError("[LoginManager] Login button not assigned!");
        }
        
        // Diagnostic check for EventSystem
        if (FindObjectOfType<EventSystem>() == null)
        {
            Debug.LogError("[LoginManager] CRITICAL: No EventSystem found in the scene. UI input will not work!");
        }

        if (studentIdInput != null)
        {
            // The Update loop now handles focus detection, so onSelect is not needed.
        }
    }

    private void HideLoginUi()
    {
        if (studentIdInput != null)
            studentIdInput.gameObject.SetActive(false);
        if (loginButton != null)
            loginButton.gameObject.SetActive(false);
        if (statusText != null)
        {
            statusText.text = "Loading your game…";
            statusText.color = Color.white;
        }
    }

    private void OnInputFieldSelected(string currentText)
    {
        // This is a more reliable entry point for mobile
        #if (UNITY_ANDROID || UNITY_IOS) && !UNITY_EDITOR
        if (!isKeyboardOpen)
        {
            mobileKeyboard = TouchScreenKeyboard.Open(currentText, TouchScreenKeyboardType.NumberPad, false, false, false, false, "Enter Student ID");
            isKeyboardOpen = true;
            Debug.Log("[LoginManager] TouchScreenKeyboard opened via onSelect event.");
        }
        #endif
    }

    private void Update()
    {
        // This update loop handles both opening the keyboard and syncing the text
        if (studentIdInput != null && studentIdInput.isFocused && !wasFocused)
        {
            // The input field just gained focus.
            wasFocused = true;
            OnInputFieldSelected(studentIdInput.text);
        }

        if (studentIdInput != null && !studentIdInput.isFocused && wasFocused)
        {
            // The input field just lost focus.
            wasFocused = false;
        }

        // Sync keyboard text to input field
        if (isKeyboardOpen && mobileKeyboard != null)
        {
            if (mobileKeyboard.status == TouchScreenKeyboard.Status.Done)
            {
                studentIdInput.text = mobileKeyboard.text;
                isKeyboardOpen = false;
                mobileKeyboard = null;
                Debug.Log("[LoginManager] Keyboard Done.");
            }
            else if (mobileKeyboard.status == TouchScreenKeyboard.Status.Canceled)
            {
                isKeyboardOpen = false;
                mobileKeyboard = null;
                Debug.Log("[LoginManager] Keyboard Canceled.");
            }
            else
            {
                // While visible, keep text in sync
                studentIdInput.text = mobileKeyboard.text;
            }
        }
    }

    public void OnLoginButtonClicked()
    {
        if (studentIdInput == null || string.IsNullOrWhiteSpace(studentIdInput.text))
        {
            ShowError("Please enter your student ID");
            return;
        }

        if (loginButton != null) loginButton.interactable = false;
        ShowSuccess("Logging in…");

        AudioInitializer.EnsureAudioUnlocked();

        var comm = PlatformCommunication.Instance;
        if (!string.IsNullOrWhiteSpace(platformUrl))
        {
            comm.Configure(platformUrl, null);
        }

        comm.CheckOrCreateStudent(studentIdInput.text.Trim(), OnStudentCheckComplete);
    }

    private void OnStudentCheckComplete(bool success, string response)
    {
        if (loginButton != null) loginButton.interactable = true;

        if (success)
        {
            Debug.Log($"Server response: {response}");

            try
            {
                StudentResponse studentResponse = JsonUtility.FromJson<StudentResponse>(response);
                
                if (studentResponse.status == "success")
                {
                    ProceedAfterSuccessfulLogin(studentResponse);
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
            Debug.LogError($"[LoginManager] Platform error: {response}");
            if (response != null && (response.Contains("database") || response.Contains("503")))
            {
                ShowError("Platform database is offline. Start PostgreSQL, then npm run db:push && npm run db:seed");
            }
            else if (response != null && response.Contains("401"))
            {
                ShowError("Invalid API key. Match Game Api Key with GAME_API_KEY in platform/.env");
            }
            else
            {
                ShowError("Cannot reach platform. Is npm run dev running on http://localhost:3000 ?");
            }
        }
    }

    private void ProceedAfterSuccessfulLogin(StudentResponse studentResponse)
    {
        var studentData = new StudentData();
        var externalId = studentResponse.student.id;
        studentData.id = int.TryParse(externalId.Replace("STU-", ""), out var numericId)
            ? numericId
            : externalId.GetHashCode();
        studentData.username = string.IsNullOrEmpty(studentResponse.student.username)
            ? externalId
            : studentResponse.student.username;

        PlayerPrefs.SetString("UserId", externalId);

        string levelSlotKey = externalId + "_currentLevel";
        string levelIdKey = externalId + "_currentLevelKey";
        if (!PlayerPrefs.HasKey(levelSlotKey))
        {
            PlayerPrefs.SetInt(levelSlotKey, 1);
            PlayerPrefs.DeleteKey(levelIdKey);
            Debug.Log($"[LoginManager] New user: will load first assigned item from dashboard.");
        }
        else
        {
            Debug.Log($"[LoginManager] Returning user: slot={PlayerPrefs.GetInt(levelSlotKey)}, " +
                      $"key='{PlayerPrefs.GetString(levelIdKey, "")}'");
        }

        PlayerPrefs.SetString("SceneToLoadAfterLoading", "level1");
        PlayerPrefs.Save();

        if (StudentDataManager.Instance == null)
        {
            var go = new GameObject("StudentDataManager");
            go.AddComponent<StudentDataManager>();
        }
        StudentDataManager.Instance?.SetCurrentStudent(studentData);

        ShowSuccess("Login successful!");
        UnityEngine.SceneManagement.SceneManager.LoadScene("LoadingScene");
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
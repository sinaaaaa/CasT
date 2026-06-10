using UnityEngine;
using UnityEngine.UI;
using TMPro;
using UnityEngine.SceneManagement;
using System;
using System.Collections;
using UnityEngine.Networking;

public class LoginSceneManager : MonoBehaviour
{
    [Header("UI References")]
    public GameObject teacherLoginPanel;
    public Button teacherLoginButton;
    public Button backToMainButton;
    public Button startGameButton;

    [Header("Teacher Login")]
    public TMP_InputField teacherIdInput;
    public TMP_InputField teacherPasswordInput;
    public Button teacherSubmitButton;

    [SerializeField] private TMP_Text errorText;
    [SerializeField] private GameObject loadingPanel;

    private const string FLASK_URL = "http://localhost:5000"; // Your Flask server URL

    private void Start()
    {
        // Main menu buttons
        teacherLoginButton.onClick.AddListener(() => ShowPanel(teacherLoginPanel));
        backToMainButton.onClick.AddListener(ShowMainMenu);
        startGameButton.onClick.AddListener(StartGame);

        // Teacher login
        teacherSubmitButton.onClick.AddListener(OnTeacherLogin);

        errorText.text = "";
        loadingPanel.SetActive(false);

        // Show main menu initially
        ShowMainMenu();
    }

    private void ShowMainMenu()
    {
        teacherLoginPanel.SetActive(false);
    }

    private void ShowPanel(GameObject panel)
    {
        teacherLoginPanel.SetActive(false);
        panel.SetActive(true);
    }

    private void OnTeacherLogin()
    {
        string teacherId = teacherIdInput.text;
        string password = teacherPasswordInput.text;

        if (teacherId == "teacher" && password == "password123")
        {
            SceneController.Instance.LoadTeacherScene();
        }
        else
        {
            Debug.LogWarning("Invalid teacher credentials");
        }
    }

    private void StartGame()
    {
        // First open the Flask student panel
        Application.OpenURL(FLASK_URL + "/student");
        
        // Set the target scene for the loading screen
        PlayerPrefs.SetString("SceneToLoadAfterLoading", "Level1");
        PlayerPrefs.Save();
        
        // Load the loading scene
        SceneManager.LoadScene("LoadingScene"); // Assuming your loading scene is named "LoadingScene"
    }

    private void LoadMainScene()
    {
        SceneManager.LoadScene("LevelManager");
    }
} 
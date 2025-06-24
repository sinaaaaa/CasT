using UnityEngine;
using UnityEngine.SceneManagement;

public class SceneController : MonoBehaviour
{
    public static SceneController Instance { get; private set; }
    
    private void Awake()
    {
        if (Instance == null)
        {
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }
        else
        {
            Destroy(gameObject);
        }
    }

    public void LoadStudentScene()
    {
        if (StudentDataManager.Instance.GetCurrentStudent() != null)
        {
            SceneManager.LoadScene("StudentScene");
        }
        else
        {
            Debug.LogWarning("No student is logged in!");
        }
    }

    public void LoadTeacherScene()
    {
        SceneManager.LoadScene("TeacherScene");
    }

    public void LoadLoginScene()
    {
        SceneManager.LoadScene("LoginScene");
    }

    public void QuitGame()
    {
        #if UNITY_EDITOR
            UnityEditor.EditorApplication.isPlaying = false;
        #else
            Application.Quit();
        #endif
    }
} 
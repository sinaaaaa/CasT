using UnityEngine;
using UnityEngine.UI;

public class LoginUI : MonoBehaviour
{
    [SerializeField] private GameObject loginPanel;
    [SerializeField] private InputField studentIdInput;
    [SerializeField] private Button loginButton;
    [SerializeField] private Text statusText;
    [SerializeField] private LoginManager loginManager;

    private void Start()
    {
        // Set up the login button
        if (loginButton != null)
        {
            loginButton.onClick.AddListener(() => {
                if (loginManager != null)
                {
                    loginManager.OnLoginButtonClicked();
                }
            });
        }

        // Set up the input field
        if (studentIdInput != null)
        {
            studentIdInput.onValueChanged.AddListener((value) => {
                // Only allow numbers
                if (!string.IsNullOrEmpty(value) && !int.TryParse(value, out _))
                {
                    studentIdInput.text = value.Substring(0, value.Length - 1);
                }
            });
        }
    }

    public void ShowError(string message)
    {
        if (statusText != null)
        {
            statusText.text = message;
            statusText.color = Color.red;
        }
    }

    public void ShowSuccess(string message)
    {
        if (statusText != null)
        {
            statusText.text = message;
            statusText.color = Color.green;
        }
    }
} 
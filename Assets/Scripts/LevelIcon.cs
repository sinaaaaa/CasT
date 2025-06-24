using UnityEngine;
using UnityEngine.UI;

public class LevelIcon : MonoBehaviour
{
    public string levelName; // The name of the level this icon represents

    private void Start()
    {
        Button button = GetComponent<Button>();
        if (button == null)
        {
            Debug.LogError("Button component not found on the GameObject. Make sure LevelIcon is attached to a UI Button.", this);
            return;
        }

        button.onClick.AddListener(LoadLevel);
    }

    private void LoadLevel()
    {
        LevelManager levelManager = FindObjectOfType<LevelManager>();
        if (levelManager == null)
        {
            Debug.LogError("LevelManager not found in the scene.", this);
            return;
        }

        levelManager.LoadLevel(levelName);
    }
}

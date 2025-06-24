using UnityEngine;
using UnityEngine.UI;
using TMPro;

public class UIPrefabManager : MonoBehaviour
{
    public static UIPrefabManager Instance { get; private set; }

    [Header("Prefab References")]
    public GameObject scoreEntryPrefab;
    public GameObject studentEntryPrefab;
    public GameObject mainMenuButtonPrefab;

    private void Awake()
    {
        if (Instance == null)
        {
            Instance = this;
            DontDestroyOnLoad(gameObject);
            CreatePrefabs();
        }
        else
        {
            Destroy(gameObject);
        }
    }

    private void CreatePrefabs()
    {
        // Create Score Entry Prefab
        if (scoreEntryPrefab == null)
        {
            GameObject scoreEntry = new GameObject("ScoreEntry");
            scoreEntry.AddComponent<RectTransform>();
            scoreEntry.AddComponent<Image>().color = new Color(0.2f, 0.2f, 0.2f, 0.9f);
            
            GameObject textObj = new GameObject("ScoreText");
            textObj.transform.SetParent(scoreEntry.transform, false);
            TextMeshProUGUI text = textObj.AddComponent<TextMeshProUGUI>();
            text.color = Color.white;
            text.fontSize = 14;
            text.alignment = TextAlignmentOptions.Left;
            
            RectTransform textRect = textObj.GetComponent<RectTransform>();
            textRect.anchorMin = new Vector2(0.05f, 0.05f);
            textRect.anchorMax = new Vector2(0.95f, 0.95f);
            textRect.offsetMin = Vector2.zero;
            textRect.offsetMax = Vector2.zero;

            scoreEntryPrefab = scoreEntry;
        }

        // Create Student Entry Prefab
        if (studentEntryPrefab == null)
        {
            GameObject studentEntry = new GameObject("StudentEntry");
            studentEntry.AddComponent<RectTransform>();
            studentEntry.AddComponent<Image>().color = new Color(0.2f, 0.2f, 0.2f, 0.9f);
            
            GameObject textObj = new GameObject("StudentText");
            textObj.transform.SetParent(studentEntry.transform, false);
            TextMeshProUGUI text = textObj.AddComponent<TextMeshProUGUI>();
            text.color = Color.white;
            text.fontSize = 14;
            text.alignment = TextAlignmentOptions.Left;
            
            RectTransform textRect = textObj.GetComponent<RectTransform>();
            textRect.anchorMin = new Vector2(0.05f, 0.05f);
            textRect.anchorMax = new Vector2(0.95f, 0.95f);
            textRect.offsetMin = Vector2.zero;
            textRect.offsetMax = Vector2.zero;

            studentEntryPrefab = studentEntry;
        }

        // Create Main Menu Button Prefab
        if (mainMenuButtonPrefab == null)
        {
            GameObject button = new GameObject("MainMenuButton");
            button.AddComponent<RectTransform>();
            Image buttonImage = button.AddComponent<Image>();
            buttonImage.color = new Color(0.2f, 0.6f, 1f, 1f);
            Button buttonComponent = button.AddComponent<Button>();
            
            GameObject textObj = new GameObject("ButtonText");
            textObj.transform.SetParent(button.transform, false);
            TextMeshProUGUI text = textObj.AddComponent<TextMeshProUGUI>();
            text.text = "Main Menu";
            text.color = Color.white;
            text.fontSize = 16;
            text.alignment = TextAlignmentOptions.Center;
            
            RectTransform textRect = textObj.GetComponent<RectTransform>();
            textRect.anchorMin = Vector2.zero;
            textRect.anchorMax = Vector2.one;
            textRect.offsetMin = Vector2.zero;
            textRect.offsetMax = Vector2.zero;

            mainMenuButtonPrefab = button;
        }
    }
} 
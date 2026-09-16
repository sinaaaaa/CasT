using System.Collections;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

/// <summary>
/// Fast loader that respects the authored LoadingScene art (logo + bar).
/// Keeps a solid white brand screen until the next scene activates — never
/// flashes the default Unity skybox/ground underneath.
/// </summary>
public class LoadingSceneController : MonoBehaviour
{
    [Header("Scene progress targets (optional — auto-found)")]
    public ClassicProgressBar progressBar;
    public Slider legacySlider;
    public Image fillImage;

    [Header("Timing")]
    [Tooltip("Short polish hold only. Scene activates when load is ready.")]
    [Range(0.25f, 2f)]
    public float minimumLoadingTime = 0.85f;

    [Header("Brand screen")]
    public Color backdropColor = Color.white;

    CanvasGroup _canvasGroup;
    float _displayProgress;

    void Awake()
    {
        if (minimumLoadingTime > 2f)
            minimumLoadingTime = 0.85f;

        HideWorldBehindUi();
        ResolveProgressTargets();

        var canvas = FindObjectOfType<Canvas>();
        if (canvas != null)
        {
            _canvasGroup = canvas.GetComponent<CanvasGroup>();
            if (_canvasGroup == null)
                _canvasGroup = canvas.gameObject.AddComponent<CanvasGroup>();
            _canvasGroup.alpha = 1f;
            _canvasGroup.blocksRaycasts = true;
            EnsureOpaqueBackdrop(canvas.transform);
        }

        // Remove leftover runtime overlays from older loader builds (status / tips / dark cover).
        StripInjectedOverlays(canvas != null ? canvas.transform : null);

        SetProgress(0f);
    }

    void Start()
    {
        StartCoroutine(LoadSceneAsync());
    }

    /// <summary>
    /// LoadingScene has a default Main Camera + skybox. Force solid white so nothing
    /// from the 3D environment leaks around/through UI.
    /// </summary>
    void HideWorldBehindUi()
    {
        var cams = FindObjectsOfType<Camera>(true);
        for (int i = 0; i < cams.Length; i++)
        {
            var cam = cams[i];
            if (cam == null) continue;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = backdropColor;
            // Keep one camera for clear; hide extras that could flash geometry.
            if (!cam.CompareTag("MainCamera") && cams.Length > 1)
                cam.enabled = cam.CompareTag("MainCamera");
        }

        var lights = FindObjectsOfType<Light>(true);
        for (int i = 0; i < lights.Length; i++)
        {
            if (lights[i] != null && lights[i].type == LightType.Directional)
                lights[i].enabled = false;
        }
    }

    void EnsureOpaqueBackdrop(Transform canvasRoot)
    {
        if (canvasRoot == null) return;

        Transform panelT = canvasRoot.Find("Panel");
        Image panelImg = null;
        if (panelT != null)
            panelImg = panelT.GetComponent<Image>();

        if (panelImg == null)
        {
            var go = new GameObject("BrandBackdrop", typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
            go.transform.SetParent(canvasRoot, false);
            go.transform.SetAsFirstSibling();
            var rt = go.GetComponent<RectTransform>();
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = Vector2.zero;
            rt.offsetMax = Vector2.zero;
            panelImg = go.GetComponent<Image>();
        }
        else
        {
            panelT.SetAsFirstSibling();
        }

        panelImg.color = backdropColor;
        panelImg.raycastTarget = true;
        // Built-in white sprite; Type Simple avoids sliced-border transparency quirks.
        if (panelImg.sprite == null || panelImg.type == Image.Type.Sliced)
        {
            panelImg.sprite = null;
            panelImg.type = Image.Type.Simple;
        }
    }

    void ResolveProgressTargets()
    {
        if (progressBar != null && !progressBar.gameObject.scene.IsValid())
            progressBar = null;
        if (progressBar == null)
            progressBar = FindObjectOfType<ClassicProgressBar>();

        if (fillImage == null && progressBar == null)
        {
            var images = FindObjectsOfType<Image>(true);
            for (int i = 0; i < images.Length; i++)
            {
                var img = images[i];
                if (img == null || img.type != Image.Type.Filled) continue;
                string n = img.gameObject.name.ToLowerInvariant();
                if (n.Contains("fill") || n.Contains("progress") || n.Contains("bar"))
                {
                    fillImage = img;
                    break;
                }
            }
        }
    }

    static void StripInjectedOverlays(Transform canvasRoot)
    {
        if (canvasRoot == null) return;
        string[] junk =
        {
            "BootCover",
            "AccentLine",
            "StatusText",
            "TipText",
            "PercentText",
            "ProgressTrack",
        };
        for (int i = 0; i < junk.Length; i++)
        {
            var t = canvasRoot.Find(junk[i]);
            if (t != null)
                Destroy(t.gameObject);
        }
    }

    IEnumerator LoadSceneAsync()
    {
        string sceneToLoad = PlayerPrefs.GetString("SceneToLoadAfterLoading", "level1");
        if (string.IsNullOrWhiteSpace(sceneToLoad))
            sceneToLoad = "level1";
        if (sceneToLoad.Equals("Level1", System.StringComparison.OrdinalIgnoreCase))
            sceneToLoad = "level1";

        AsyncOperation asyncLoad = SceneManager.LoadSceneAsync(sceneToLoad);
        if (asyncLoad == null)
        {
            Debug.LogError("[LoadingScene] Failed to start load for '" + sceneToLoad + "'");
            yield break;
        }

        asyncLoad.allowSceneActivation = false;
        float timer = 0f;
        _displayProgress = 0f;

        while (!asyncLoad.isDone)
        {
            // Stay fully opaque for the whole wait — never fade UI over the skybox.
            if (_canvasGroup != null)
                _canvasGroup.alpha = 1f;

            timer += Time.unscaledDeltaTime;

            float real = Mathf.Clamp01(asyncLoad.progress / 0.9f);
            float easedTime = EaseOutCubic(Mathf.Clamp01(timer / Mathf.Max(0.35f, minimumLoadingTime)));
            float target = Mathf.Max(real, easedTime * 0.55f);
            if (real >= 0.999f)
                target = Mathf.Max(target, easedTime);

            _displayProgress = Mathf.MoveTowards(_displayProgress, target, Time.unscaledDeltaTime * 1.4f);
            SetProgress(_displayProgress);

            if (asyncLoad.progress >= 0.9f && timer >= minimumLoadingTime)
            {
                SetProgress(1f);
                // Activate while the white brand screen is still fully opaque.
                // The next scene replaces this one — no transparent flash.
                asyncLoad.allowSceneActivation = true;
                while (!asyncLoad.isDone)
                    yield return null;
                yield break;
            }

            yield return null;
        }
    }

    void SetProgress(float amount)
    {
        amount = Mathf.Clamp01(amount);
        _displayProgress = amount;

        if (progressBar != null)
            progressBar.SetFillAmount(amount);
        if (legacySlider != null)
            legacySlider.value = amount;
        if (fillImage != null)
            fillImage.fillAmount = amount;
    }

    static float EaseOutCubic(float t)
    {
        float u = 1f - t;
        return 1f - u * u * u;
    }
}

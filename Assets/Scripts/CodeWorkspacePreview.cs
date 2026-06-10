using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// Scratch-style PiP: copies action-queue icons to sandbox sprites, renders with a tiny
/// orthographic camera into a RenderTexture, shows on a HUD <see cref="RawImage"/>.
///
/// Setup:
/// - Add user layer 8 to 31 (e.g. "CodePreview"). Set <see cref="previewLayer"/>.
/// - Main Camera: culling mask EXCLUDE that layer.
/// - <see cref="previewCamera"/>: culling mask ONLY that layer.
/// - Assign <see cref="picture"/> on your Canvas (e.g. top-right).
/// - Optional: enable <see cref="bootstrapIfEmpty"/> to auto-create camera / RT / mirror parent.
/// Reads <see cref="CharacterMove.actionQueueTransform"/> each frame.
/// </summary>
public class CodeWorkspacePreview : MonoBehaviour
{
    public CharacterMove characterProgram;

    [Header("Sandbox (far from level)")]
    public Vector3 sandboxAnchor = new Vector3(10000f, 100f, 10000f);
    public float rowZOffset = 2f;

    [Header("Layer")]
    [Tooltip("User layer for mirror sprites only (8 to 31).")]
    [Range(8, 31)] public int previewLayer = 31;

    [Header("Render output")]
    public Camera previewCamera;
    public RenderTexture renderTexture;
    public RawImage picture;
    public Color clearColor = Color.clear;

    [Header("Sizing")]
    public float baseOrthoSize = 3f;
    public float iconSpacing = 1.1f;
    public float iconWorldScale = 0.42f;

    [Header("Objects")]
    public Transform mirrorRoot;
    public bool bootstrapIfEmpty = true;

    readonly List<GameObject> _pool = new List<GameObject>(24);
    readonly List<Sprite> _sprites = new List<Sprite>(24);

    void Awake()
    {
        previewLayer = Mathf.Clamp(previewLayer, 8, 31);

        if (bootstrapIfEmpty)
        {
            if (mirrorRoot == null)
            {
                var go = new GameObject("CodePreviewRow");
                go.transform.SetParent(transform, false);
                mirrorRoot = go.transform;
            }

            if (previewCamera == null)
            {
                var camGo = new GameObject("CodePreviewCamera");
                camGo.transform.SetParent(transform, false);
                previewCamera = camGo.AddComponent<Camera>();
            }

            if (renderTexture == null)
            {
                renderTexture = new RenderTexture(688, 176, 16, RenderTextureFormat.ARGB32)
                {
                    useMipMap = false,
                    filterMode = FilterMode.Bilinear
                };
                renderTexture.Create();
            }
        }

        if (previewCamera != null)
        {
            ApplyPreviewCameraSettings(previewCamera, renderTexture, previewLayer, clearColor);
            previewCamera.enabled = false;
        }

        if (mirrorRoot != null)
            SetLayerRecursively(mirrorRoot.gameObject, previewLayer);

        if (picture != null && renderTexture != null)
        {
            picture.texture = renderTexture;
            picture.color = Color.white;
            picture.raycastTarget = false;
            // RawImage has no preserveAspect (unlike Image). Add an AspectRatioFitter on the
            // RawImage or parent if you want letterboxing to match the RT aspect.
        }

        ResolveCharacterProgram();
    }

    void OnDestroy()
    {
        if (renderTexture != null)
        {
            renderTexture.Release();
            Destroy(renderTexture);
            renderTexture = null;
        }
    }

    void LateUpdate()
    {
        if (!isActiveAndEnabled || previewCamera == null || renderTexture == null ||
            picture == null || mirrorRoot == null)
            return;

        if (!picture.isActiveAndEnabled)
            return;

        ResolveCharacterProgram();
        CollectSprites();
        int n = _sprites.Count;

        EnsurePool(n);
        LayOutRow(n);

        float aspect = Mathf.Max(0.05f, (float)renderTexture.width / Mathf.Max(renderTexture.height, 1));

        ApplyPreviewCameraSettings(previewCamera, renderTexture, previewLayer, clearColor);
        previewCamera.aspect = aspect;
        previewCamera.orthographicSize = ComputeOrthoHalfSize(aspect, n);

        PositionRowAndCamera(n);

        FaceMirrorsToCamera();

        previewCamera.Render();

        _sprites.Clear();
    }

    void ResolveCharacterProgram()
    {
        if (characterProgram != null)
            return;
#if UNITY_2023_1_OR_NEWER
        characterProgram = FindFirstObjectByType<CharacterMove>(FindObjectsInactive.Exclude);
#else
        characterProgram = FindObjectOfType<CharacterMove>();
#endif
    }

    void CollectSprites()
    {
        _sprites.Clear();
        if (characterProgram == null || characterProgram.actionQueueTransform == null)
            return;

        Transform q = characterProgram.actionQueueTransform;
        foreach (Transform child in q)
        {
            if (!child.gameObject.activeInHierarchy)
                continue;
            if (child.GetComponent<QueueInsertionPlaceholder>() != null)
                continue;

            Sprite sp = PickPrimarySprite(child);
            if (sp != null)
                _sprites.Add(sp);
        }
    }

    static Sprite PickPrimarySprite(Transform block)
    {
        Image best = null;
        float bestArea = 0f;

        foreach (Image img in block.GetComponentsInChildren<Image>(true))
        {
            if (img == null || img.sprite == null || !img.enabled || img.color.a < 0.1f)
                continue;
            if (NameStartsWithNoCase(img.name, "CloseButton"))
                continue;
            if (img.name == "XLine")
                continue;
            if (img.transform.parent != block &&
                NameStartsWithNoCase(img.transform.parent != null ? img.transform.parent.name : string.Empty, "CloseButton"))
                continue;

            float a = Mathf.Abs(img.rectTransform.rect.width * img.rectTransform.rect.height);
            if (best == null || a > bestArea)
            {
                best = img;
                bestArea = a;
            }
        }

        if (best != null)
            return best.sprite;

        Image rootImg = block.GetComponent<Image>();
        return rootImg != null ? rootImg.sprite : null;
    }

    static bool NameStartsWithNoCase(string value, string prefix)
    {
        return !string.IsNullOrEmpty(value) && value.StartsWith(prefix, System.StringComparison.OrdinalIgnoreCase);
    }

    void EnsurePool(int need)
    {
        while (_pool.Count < need)
        {
            GameObject go = new GameObject("codeMirror_" + _pool.Count);
            go.transform.SetParent(mirrorRoot, false);
            SpriteRenderer sr = go.AddComponent<SpriteRenderer>();
            sr.spriteSortPoint = SpriteSortPoint.Pivot;
            sr.sortingOrder = 800;
            SetLayerRecursively(go, previewLayer);
            _pool.Add(go);
        }

        for (int i = 0; i < _pool.Count; i++)
        {
            bool on = i < need;
            GameObject g = _pool[i];
            SpriteRenderer r = g.GetComponent<SpriteRenderer>();

            g.SetActive(on);
            r.enabled = on;
            if (!on)
            {
                r.sprite = null;
                continue;
            }

            r.sprite = _sprites[i];
            r.color = Color.white;
            SetLayerRecursively(g, previewLayer);
            g.transform.localScale = Vector3.one * Mathf.Max(iconWorldScale, 0.04f);
            g.transform.localRotation = Quaternion.identity;
        }
    }

    void LayOutRow(int active)
    {
        if (active <= 0)
            return;

        float step = Mathf.Max(iconSpacing * iconWorldScale, 0.08f);
        float start = -((active - 1) * step * 0.5f);

        for (int i = 0; i < active; i++)
        {
            _pool[i].transform.localPosition = new Vector3(start + i * step, 0f, 0f);
        }
    }

    void PositionRowAndCamera(int iconCount)
    {
        Vector3 rowWorld = sandboxAnchor + Vector3.forward * rowZOffset;
        mirrorRoot.position = rowWorld;

        float dist = Mathf.Clamp(baseOrthoSize * 6.5f + iconCount * 2.2f + 12f, 16f, 200f);
        previewCamera.transform.position = rowWorld - Vector3.forward * dist;
        previewCamera.transform.LookAt(rowWorld, Vector3.up);
    }

    void FaceMirrorsToCamera()
    {
        Vector3 camPos = previewCamera.transform.position;
        foreach (GameObject g in _pool)
        {
            if (!g.activeSelf)
                continue;
            Vector3 d = camPos - g.transform.position;
            if (d.sqrMagnitude < 1e-8f)
                continue;
            g.transform.rotation = Quaternion.LookRotation(-d.normalized, Vector3.up);
        }
    }

    float ComputeOrthoHalfSize(float aspectRatio, int iconCount)
    {
        if (iconCount <= 0)
            return Mathf.Max(0.85f, baseOrthoSize * 0.4f);

        if (iconCount == 1)
            return Mathf.Max(baseOrthoSize * 0.55f, iconWorldScale * 1.2f);

        float step = Mathf.Max(iconSpacing * iconWorldScale, 0.08f);
        float rowWidth = Mathf.Max(iconCount - 1, 1) * step + iconWorldScale * 2.25f;
        float neededForWidth = (rowWidth * 0.5f) / Mathf.Max(aspectRatio, 0.05f);
        float neededForHeight = iconWorldScale * 1.8f + baseOrthoSize * 0.35f;

        return Mathf.Clamp(
            Mathf.Max(neededForWidth, neededForHeight, baseOrthoSize * 0.5f),
            0.9f,
            baseOrthoSize + 18f);
    }

    static void ApplyPreviewCameraSettings(Camera cam, RenderTexture target, int layer, Color backgroundClear)
    {
        if (cam == null)
            return;

        cam.targetTexture = target;
        cam.orthographic = true;
        cam.clearFlags = CameraClearFlags.SolidColor;
        cam.backgroundColor = backgroundClear;
        cam.nearClipPlane = 0.05f;
        cam.farClipPlane = 200f;
        cam.depth = -100;
        cam.allowHDR = false;
        cam.allowMSAA = false;
        cam.cullingMask = 1 << Mathf.Clamp(layer, 8, 31);
    }

    static void SetLayerRecursively(GameObject go, int layer)
    {
        go.layer = Mathf.Clamp(layer, 8, 31);
        foreach (Transform t in go.transform)
            SetLayerRecursively(t.gameObject, layer);
    }
}

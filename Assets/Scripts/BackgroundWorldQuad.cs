using UnityEngine;

/// <summary>
/// Bulletproof background that lives in 3D world space, attached to (and following)
/// the target camera at a fixed distance. Because it's a real 3D quad placed FAR
/// behind everything else, no Canvas / overlay tricks can hide your gameplay objects.
///
/// USAGE
///  1. Create empty GameObject "WorldBackground" at scene root.
///  2. Add this script.
///  3. Drag your Main Camera into "targetCamera" (auto-finds Camera.main otherwise).
///  4. Drop your background Sprite (or Texture) into the fields.
///  5. Hit Play. The quad parents to the camera, fills its view, and follows it.
///
/// PROS
///  - Works in Built-in, URP and HDRP without any pipeline changes.
///  - Works for orthographic AND perspective cameras.
///  - You don't have to touch your Canvas at all.
///  - Grid / robot / obstacles always render in front (they're closer to the camera).
/// </summary>
[ExecuteAlways]
public class BackgroundWorldQuad : MonoBehaviour
{
    [Header("Camera")]
    [Tooltip("Camera the background follows. Leave empty to auto-pick Camera.main.")]
    public Camera targetCamera;

    [Header("Image")]
    public Sprite  sprite;
    public Texture texture;
    public Color   tint = Color.white;

    [Header("Layout")]
    [Tooltip("Distance from the camera to place the quad. Should be < camera Far Clip.")]
    public float distance = 80f;
    [Tooltip("Extra zoom (1 = exactly fills the screen).")]
    [Range(0.5f, 5f)] public float scale = 1f;
    [Tooltip("Cover = fill, may crop. Contain = fit, may letterbox.")]
    public FitMode fitMode = FitMode.Cover;
    public Color letterboxColor = new Color(0f, 0f, 0f, 0f);

    public enum FitMode { Cover, Contain, Stretch }

    [Header("Behaviour")]
    [Tooltip("Recreate the quad if missing and keep parented to camera each frame.")]
    public bool autoFollowCamera = true;
    [Tooltip("Render queue for the background (keep below gameplay / number line, default 1000).")]
    [Range(500, 1999)] public int backgroundRenderQueue = 1000;

    private GameObject _quad;
    private MeshRenderer _renderer;
    private Material _material;
    private GameObject _letterbox;
    private MeshRenderer _letterboxRenderer;
    private Material _letterboxMaterial;

    private void OnEnable()  { Rebuild(); }
    private void LateUpdate() { Apply(); }
    // No OnValidate by design — LateUpdate picks up Inspector changes within one frame
    // and avoids the "ArgumentNullException: Value cannot be null. Parameter name: _unity_self"
    // window that comes from mutating serialized objects during Inspector binding.

    [ContextMenu("Rebuild Background")]
    public void Rebuild()
    {
        if (targetCamera == null) targetCamera = Camera.main;
        if (targetCamera == null)
        {
            Debug.LogWarning("[BackgroundWorldQuad] No target camera assigned and Camera.main is null.");
            return;
        }

        Shader unlit = FindUnlitShader();

        if (_quad == null)
        {
            _quad = BuildBareQuad("_BackgroundQuad");
            _renderer = _quad.GetComponent<MeshRenderer>();
            _material = new Material(unlit) { name = "_BackgroundQuadMat (instance)" };
            // Use the per-instance "material" setter so we never disturb a default material that
            // happens to be shared by other 3D objects in the scene (which can tint the robot).
            _renderer.material = _material;
        }
        if (_letterbox == null)
        {
            _letterbox = BuildBareQuad("_BackgroundLetterbox");
            _letterboxRenderer = _letterbox.GetComponent<MeshRenderer>();
            _letterboxMaterial = new Material(unlit) { name = "_BackgroundLetterboxMat (instance)" };
            _letterboxRenderer.material = _letterboxMaterial;
        }

        _quad.transform.SetParent(targetCamera.transform, false);
        _letterbox.transform.SetParent(targetCamera.transform, false);

        Apply();
    }

    public void Apply()
    {
        if (_quad == null || targetCamera == null)
        {
            // Only attempt to (re)create objects when it's safe — never during editor
            // serialization binding / compile cycles.
#if UNITY_EDITOR
            if (UnityEditor.EditorApplication.isCompiling) return;
            if (UnityEditor.EditorApplication.isUpdating)  return;
#endif
            if (autoFollowCamera) Rebuild();
            return;
        }

        if (autoFollowCamera && _quad.transform.parent != targetCamera.transform)
        {
            _quad.transform.SetParent(targetCamera.transform, false);
            _letterbox.transform.SetParent(targetCamera.transform, false);
        }

        float dist = Mathf.Max(0.1f, distance);

        // Compute how big the quad must be to fill the camera at this distance.
        float viewH, viewW;
        if (targetCamera.orthographic)
        {
            viewH = targetCamera.orthographicSize * 2f;
            viewW = viewH * targetCamera.aspect;
        }
        else
        {
            viewH = 2f * dist * Mathf.Tan(targetCamera.fieldOfView * 0.5f * Mathf.Deg2Rad);
            viewW = viewH * targetCamera.aspect;
        }

        // Letterbox quad always fills the entire view.
        _letterbox.transform.localPosition = new Vector3(0f, 0f, dist + 0.01f);
        _letterbox.transform.localRotation = Quaternion.identity;
        _letterbox.transform.localScale    = new Vector3(viewW * 1.001f, viewH * 1.001f, 1f);
        if (_letterboxMaterial != null)
        {
            ApplyColorToMaterial(_letterboxMaterial, letterboxColor);
        }

        // Image quad sized by fit mode.
        float srcW = 1f, srcH = 1f;
        Texture sourceTex = null;
        Vector4 uv = new Vector4(0f, 0f, 1f, 1f); // x,y = offset ; z,w = scale
        if (sprite != null)
        {
            sourceTex = sprite.texture;
            Rect r = sprite.rect;
            srcW = r.width; srcH = r.height;
            float tw = sprite.texture.width;
            float th = sprite.texture.height;
            uv = new Vector4(r.x / tw, r.y / th, r.width / tw, r.height / th);
        }
        else if (texture != null)
        {
            sourceTex = texture;
            srcW = texture.width;
            srcH = texture.height;
        }

        float qW = viewW * scale;
        float qH = viewH * scale;
        if (sourceTex != null && fitMode != FitMode.Stretch && srcW > 0f && srcH > 0f)
        {
            float srcAspect    = srcW / srcH;
            float screenAspect = viewW / Mathf.Max(0.001f, viewH);
            bool widerThanScreen = srcAspect > screenAspect;
            bool useWidth = (fitMode == FitMode.Cover) ? !widerThanScreen : widerThanScreen;
            if (useWidth) { qW = viewW * scale;          qH = qW / srcAspect; }
            else          { qH = viewH * scale;          qW = qH * srcAspect; }
        }

        _quad.transform.localPosition = new Vector3(0f, 0f, dist);
        _quad.transform.localRotation = Quaternion.identity;
        _quad.transform.localScale    = new Vector3(qW, qH, 1f);

        if (_material != null)
        {
            if (sourceTex != null) _material.mainTexture = sourceTex;
            _material.mainTextureOffset = new Vector2(uv.x, uv.y);
            _material.mainTextureScale  = new Vector2(uv.z, uv.w);
            ApplyColorToMaterial(_material, tint);
        }
    }

    private void ApplyColorToMaterial(Material m, Color c)
    {
        if (m == null) return;
        if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", c);   // URP / HDRP unlit
        if (m.HasProperty("_Color"))     m.SetColor("_Color", c);       // Built-in unlit
        m.renderQueue = Mathf.Clamp(backgroundRenderQueue, 500, 1999);
    }

    private static Shader FindUnlitShader()
    {
        Shader s = Shader.Find("Universal Render Pipeline/Unlit");
        if (s != null) return s;
        s = Shader.Find("HDRP/Unlit");
        if (s != null) return s;
        s = Shader.Find("Unlit/Texture");
        if (s != null) return s;
        return Shader.Find("Sprites/Default");
    }

    /// <summary>
    /// Build a "fresh" quad GameObject that does NOT share the default Unity material
    /// (the default-shared material can also be on other 3D objects and assigning to it
    /// would tint them). Builds a MeshFilter+MeshRenderer with a plain 1x1 quad mesh.
    /// </summary>
    private static GameObject BuildBareQuad(string name)
    {
        GameObject go = new GameObject(name);
        MeshFilter mf = go.AddComponent<MeshFilter>();
        MeshRenderer mr = go.AddComponent<MeshRenderer>();
        mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        mr.receiveShadows = false;
        mr.lightProbeUsage = UnityEngine.Rendering.LightProbeUsage.Off;
        mr.reflectionProbeUsage = UnityEngine.Rendering.ReflectionProbeUsage.Off;
        mr.allowOcclusionWhenDynamic = false;

        Mesh mesh = new Mesh { name = "_BgQuadMesh" };
        mesh.vertices = new Vector3[]
        {
            new Vector3(-0.5f, -0.5f, 0f),
            new Vector3( 0.5f, -0.5f, 0f),
            new Vector3( 0.5f,  0.5f, 0f),
            new Vector3(-0.5f,  0.5f, 0f),
        };
        mesh.uv = new Vector2[]
        {
            new Vector2(0f, 0f),
            new Vector2(1f, 0f),
            new Vector2(1f, 1f),
            new Vector2(0f, 1f),
        };
        // Two-sided so the quad shows no matter which way the camera faces it.
        mesh.triangles = new int[] { 0, 2, 1, 0, 3, 2, 0, 1, 2, 0, 2, 3 };
        mesh.RecalculateNormals();
        mesh.RecalculateBounds();
        mf.sharedMesh = mesh;
        return go;
    }

    private static void DestroyImmediateSafe(Object o)
    {
        if (o == null) return;
        if (Application.isPlaying) Destroy(o);
        else DestroyImmediate(o);
    }

    private void OnDisable()
    {
        // Keep the quad in the scene when disabled in the Editor so we don't churn.
        if (Application.isPlaying)
        {
            if (_quad != null) Destroy(_quad);
            if (_letterbox != null) Destroy(_letterbox);
        }
    }
}

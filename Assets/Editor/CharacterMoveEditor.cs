#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

[CustomEditor(typeof(CharacterMove))]
public class CharacterMoveEditor : Editor
{
    public override void OnInspectorGUI()
    {
        DrawDefaultInspector();

        var cm = (CharacterMove)target;
        EditorGUILayout.Space(8);
        EditorGUILayout.LabelField("Grid layout tools", EditorStyles.boldLabel);

        if (GUILayout.Button("Create Grid Origin Anchor (drag in Scene)"))
            CreateGridOriginAnchor(cm);

        if (GUILayout.Button("Refresh Grid Image (after moving grid)"))
        {
            cm.CreateOrRefreshGridImage();
            EditorUtility.SetDirty(cm);
        }

        EditorGUILayout.HelpBox(
            "Move the grid: assign Grid Origin Transform (or click Create above), then drag that object in the Scene. " +
            "Fine-tune with Grid World Offset. Enable Draw Grid Gizmos to verify tile centers.",
            MessageType.Info);

        EditorGUILayout.Space(12);
        EditorGUILayout.LabelField("Level reset (Play Mode)", EditorStyles.boldLabel);

        if (!Application.isPlaying)
        {
            EditorGUILayout.HelpBox(
                "Enter Play Mode to load levels from the dashboard, then use the buttons below to reset any level slot.",
                MessageType.Warning);
            return;
        }

        int count = cm.LoadedLevelCount;
        if (count == 0)
        {
            EditorGUILayout.HelpBox("No levels loaded yet. Wait for platform bootstrap to finish.", MessageType.Info);
            return;
        }

        EditorGUILayout.LabelField($"Loaded levels: {count}", EditorStyles.miniLabel);

        for (int slot = 1; slot <= count; slot++)
        {
            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.LabelField(cm.GetLoadedLevelLabel(slot), GUILayout.ExpandWidth(true));
            if (GUILayout.Button("Reset", GUILayout.Width(64)))
                cm.EditorReloadLevelSlot(slot);
            EditorGUILayout.EndHorizontal();
        }

        EditorGUILayout.Space(4);
        if (GUILayout.Button("Reset current level slot"))
            cm.EditorReloadLevelSlot(cm.CurrentPlaySlot);

        EditorGUILayout.HelpBox(
            "Reset reloads objects, robot start, attempts, and command history for that slot. " +
            "Hidden levels (visible=false in dashboard) are not sent to the game API — publish + visible to test live.",
            MessageType.None);
    }

    private void OnSceneGUI()
    {
        var cm = (CharacterMove)target;
        Vector3 origin = cm.GetGridOriginWorld();
        if (origin == Vector3.zero && cm.gridOriginTransform == null)
            origin = cm.transform.position + cm.gridWorldOffset;

        EditorGUI.BeginChangeCheck();
        Vector3 newOrigin = Handles.PositionHandle(origin, Quaternion.identity);
        if (EditorGUI.EndChangeCheck())
        {
            Undo.RecordObject(cm, "Move Grid Origin");
            if (cm.gridOriginTransform != null)
            {
                Undo.RecordObject(cm.gridOriginTransform, "Move Grid Origin");
                Vector3 delta = newOrigin - cm.GetGridOriginWorld();
                cm.gridOriginTransform.position += delta;
            }
            else
            {
                cm.gridWorldOffset += newOrigin - origin;
            }
            cm.SyncGridOriginCache();
            cm.drawGridGizmos = true;
            EditorUtility.SetDirty(cm);
        }

        Handles.Label(origin + Vector3.up * 0.3f, "Grid origin (0,0)");
    }

    [MenuItem("CONTEXT/CharacterMove/Create Grid Origin Anchor")]
    private static void CreateFromContext(MenuCommand cmd)
    {
        CreateGridOriginAnchor((CharacterMove)cmd.context);
    }

    [MenuItem("SPARC/Reset Current Level (Play Mode)")]
    private static void MenuResetCurrentLevel()
    {
        if (!Application.isPlaying)
        {
            Debug.LogWarning("[CharacterMove] Enter Play Mode first.");
            return;
        }
        var cm = Object.FindObjectOfType<CharacterMove>();
        if (cm == null)
        {
            Debug.LogError("[CharacterMove] No CharacterMove in scene.");
            return;
        }
        cm.EditorReloadLevelSlot(cm.CurrentPlaySlot);
    }

    private static void CreateGridOriginAnchor(CharacterMove cm)
    {
        if (cm == null) return;

        Transform existing = cm.gridOriginTransform;
        if (existing != null && existing.GetComponent<GridOriginAnchor>() != null)
        {
            Selection.activeTransform = existing;
            EditorGUIUtility.PingObject(existing.gameObject);
            return;
        }

        var go = new GameObject("GridOrigin (cell 0,0)");
        Vector3 start = cm.GetGridOriginWorld();
        if (start == Vector3.zero)
            start = cm.transform.position;
        go.transform.position = start;
        go.transform.rotation = Quaternion.identity;
        go.transform.localScale = Vector3.one;

        var anchor = go.AddComponent<GridOriginAnchor>();
        anchor.characterMove = cm;

        Undo.RegisterCreatedObjectUndo(go, "Create Grid Origin Anchor");
        cm.AssignGridOriginTransform(go.transform);
        cm.drawGridGizmos = true;

        Selection.activeGameObject = go;
        EditorGUIUtility.PingObject(go);
        Debug.Log("[CharacterMove] Grid Origin Anchor created — select it and move in the Scene view.");
    }
}
#endif

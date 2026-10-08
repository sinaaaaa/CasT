#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

[CustomEditor(typeof(LevelCornerHintPanel))]
public class LevelCornerHintPanelEditor : Editor
{
    public override void OnInspectorGUI()
    {
        serializedObject.Update();

        EditorGUI.BeginChangeCheck();
        DrawDefaultInspector();
        bool changed = EditorGUI.EndChangeCheck();
        serializedObject.ApplyModifiedProperties();

        var panel = (LevelCornerHintPanel)target;

        EditorGUILayout.Space(8);
        EditorGUILayout.LabelField("Corner hint UI", EditorStyles.boldLabel);

        EditorGUILayout.HelpBox(
            "Show Layout Preview: live updates in Scene view while you edit (no Play Mode).\n" +
            "Typography: assign Default Font (TMP Font Asset) plus Title/Body/Badge/Button styles (size, bold, alignment, spacing).\n" +
            "Panel Background sprite only — no white box unless Use Solid Fallback is enabled.\n" +
            "Images (background, speaker, skip): with Scene Controls Layout on, the sprite on the scene Image wins; " +
            "with it off, Default Layout wins. Resources/CornerHint is the last fallback.",
            MessageType.Info);

        EditorGUILayout.HelpBox(
            panel.sceneControlsLayout
                ? "Scene Controls Layout is ON: move, resize and restyle the title, body, image, speaker and Skip " +
                  "button directly in the Scene — the game keeps them as they are, including the background, speaker " +
                  "and Skip sprites on those Images. Default Layout is only used for an Image that has no sprite."
                : "Scene Controls Layout is OFF: Default Layout is applied every time a hint shows. Arranged things " +
                  "in the Scene? Press the button below to save them into Default Layout.",
            MessageType.None);
        if (GUILayout.Button("Save scene layout (text, buttons, images) into Default Layout"))
        {
            Undo.RecordObject(panel, "Save corner hint scene layout");
            panel.CaptureLayoutFromScene();
            changed = true;
        }

        if (GUILayout.Button("Load default sprites from Resources/CornerHint"))
        {
            Undo.RecordObject(panel, "Load corner hint resources");
            panel.defaultLayout.panelBackground = null;
            panel.defaultLayout.listenButtonSprite = null;
            panel.defaultLayout.ApplyResourcesFallback();
            changed = true;
        }

        if (panel.defaultLayout != null && panel.defaultLayout.skipButtonSprite != null)
        {
            if (GUILayout.Button("Auto-size Skip button to sprite"))
            {
                Undo.RecordObject(panel, "Auto-size skip button");
                panel.defaultLayout.ApplySkipSizeFromSprite(100f);
                // If manual layout is on, keep the layout size in sync.
                panel.defaultLayout.skipButtonLayout.sizeDelta = new Vector2(
                    panel.defaultLayout.skipButtonSpriteWidth,
                    panel.defaultLayout.skipButtonSpriteHeight
                );
                changed = true;
            }
        }

        if (GUILayout.Button("Refresh preview now"))
            changed = true;

        if (changed && !Application.isPlaying)
        {
            panel.RefreshLayoutPreview();
            EditorUtility.SetDirty(panel);
        }
        else if (changed && Application.isPlaying)
        {
            panel.RefreshLayoutPreview();
        }
    }
}
#endif

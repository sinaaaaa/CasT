#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

[CustomPropertyDrawer(typeof(LevelCornerHint))]
public class LevelCornerHintDrawer : PropertyDrawer
{
    public override void OnGUI(Rect position, SerializedProperty property, GUIContent label)
    {
        EditorGUI.BeginProperty(position, label, property);
        float y = position.y;
        float w = position.width;
        float line = EditorGUIUtility.singleLineHeight;
        float gap = EditorGUIUtility.standardVerticalSpacing;

        var enabled = property.FindPropertyRelative("enabled");
        var title = property.FindPropertyRelative("title");
        var body = property.FindPropertyRelative("body");
        var image = property.FindPropertyRelative("image");
        var imageUrl = property.FindPropertyRelative("imageUrl");
        var audioUrl = property.FindPropertyRelative("audioUrl");
        var playAuto = property.FindPropertyRelative("playAudioAutomatically");
        var useCustom = property.FindPropertyRelative("useCustomLayout");
        var layout = property.FindPropertyRelative("layout");

        Rect Row(float h)
        {
            var r = new Rect(position.x, y, w, h);
            y += h + gap;
            return r;
        }

        EditorGUI.LabelField(Row(line), label, EditorStyles.boldLabel);
        EditorGUI.PropertyField(Row(line), enabled);
        EditorGUI.PropertyField(Row(line), title);
        EditorGUI.PropertyField(Row(EditorGUI.GetPropertyHeight(body, true)), body, true);
        EditorGUI.PropertyField(Row(line), image);
        EditorGUI.PropertyField(Row(line), imageUrl);
        EditorGUI.PropertyField(Row(line), audioUrl);
        EditorGUI.PropertyField(Row(line), playAuto);

        y += 4;
        EditorGUI.LabelField(Row(line), "Panel UI (game)", EditorStyles.miniBoldLabel);
        EditorGUI.PropertyField(Row(line), useCustom, new GUIContent("Use custom layout"));

        if (useCustom.boolValue)
        {
            EditorGUI.indentLevel++;
            float layoutH = EditorGUI.GetPropertyHeight(layout, true);
            EditorGUI.PropertyField(new Rect(position.x, y, w, layoutH), layout, new GUIContent("Layout"), true);
            y += layoutH + gap;
            EditorGUI.indentLevel--;
        }
        else
        {
            EditorGUI.HelpBox(
                new Rect(position.x, y, w, line * 2.2f),
                "Uses default layout on LevelCornerHintPanel in the scene.",
                MessageType.None);
            y += line * 2.2f + gap;
        }

        EditorGUI.EndProperty();
    }

    public override float GetPropertyHeight(SerializedProperty property, GUIContent label)
    {
        float h = EditorGUIUtility.singleLineHeight * 8f + EditorGUIUtility.standardVerticalSpacing * 10f;
        h += EditorGUI.GetPropertyHeight(property.FindPropertyRelative("body"), true)
            - EditorGUIUtility.singleLineHeight;
        h += EditorGUIUtility.singleLineHeight * 2.5f;

        if (property.FindPropertyRelative("useCustomLayout").boolValue)
            h += EditorGUI.GetPropertyHeight(property.FindPropertyRelative("layout"), true);
        return h;
    }
}
#endif

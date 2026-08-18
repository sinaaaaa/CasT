using TMPro;
using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// Yellow-strip counter for COUNT_ANSWER canvas lessons — [ − ] [ N ] [ + ] like Repeat.
/// </summary>
public class CanvasCountAnswerBlock : MonoBehaviour
{
    private CharacterMove _characterMove;
    private QueuedActionRef _ref;
    private TextMeshProUGUI _countLabel;
    private int _min;
    private int _max;

    public static GameObject Create(
        Transform parent,
        CharacterMove characterMove,
        int initial,
        int min,
        int max)
    {
        min = ProgramSequenceUtil.ClampCountAnswer(min);
        max = Mathf.Max(min, ProgramSequenceUtil.ClampCountAnswer(max));
        initial = Mathf.Clamp(initial, min, max);

        var root = new GameObject("CountAnswerBlock", typeof(RectTransform), typeof(LayoutElement), typeof(CanvasCountAnswerBlock));
        root.transform.SetParent(parent, false);

        var rt = root.GetComponent<RectTransform>();
        rt.anchorMin = new Vector2(0f, 0.5f);
        rt.anchorMax = new Vector2(0f, 0.5f);
        rt.pivot = new Vector2(0f, 0.5f);

        const float btnSize = 52f;
        const float countW = 60f;
        const float countH = 52f;
        const float gap = 6f;
        float totalW = btnSize + gap + countW + gap + btnSize;

        var le = root.GetComponent<LayoutElement>();
        le.preferredWidth = totalW;
        le.minWidth = totalW;
        le.preferredHeight = countH;
        le.minHeight = countH;
        le.flexibleWidth = 0f;
        le.flexibleHeight = 0f;
        rt.sizeDelta = new Vector2(totalW, countH);

        var block = root.GetComponent<CanvasCountAnswerBlock>();
        block._characterMove = characterMove;
        block._min = min;
        block._max = max;

        var refComp = root.AddComponent<QueuedActionRef>();
        refComp.deletable = false;
        refComp.isCountAnswer = true;
        refComp.countValue = initial;
        refComp.actionLabel = ProgramSequenceUtil.FormatCountToken(initial);
        block._ref = refComp;

        Sprite minusSprite = characterMove != null ? characterMove.repeatMinusSprite : null;
        Sprite plusSprite = characterMove != null ? characterMove.repeatPlusSprite : null;
        Sprite countBoxSprite = characterMove != null ? characterMove.repeatCountBoxSprite : null;

        var row = new GameObject("Row", typeof(RectTransform));
        row.transform.SetParent(root.transform, false);
        var rowRt = row.GetComponent<RectTransform>();
        rowRt.anchorMin = Vector2.zero;
        rowRt.anchorMax = Vector2.one;
        rowRt.offsetMin = Vector2.zero;
        rowRt.offsetMax = Vector2.zero;

        float x = 0f;
        block.CreateButton(row.transform, "Minus", "-", new Vector2(x, 0f), btnSize, () => block.ChangeCount(-1), minusSprite);
        x += btnSize + gap;

        block.CreateCountBox(row.transform, new Vector2(x + countW * 0.5f, 0f), countW, countH, initial, countBoxSprite);
        x += countW + gap;

        block.CreateButton(row.transform, "Plus", "+", new Vector2(x, 0f), btnSize, () => block.ChangeCount(1), plusSprite);

        return root;
    }

    private void ChangeCount(int delta)
    {
        if (_ref == null) return;
        _ref.countValue = Mathf.Clamp(_ref.countValue + delta, _min, _max);
        _ref.actionLabel = ProgramSequenceUtil.FormatCountToken(_ref.countValue);
        if (_countLabel != null)
            _countLabel.text = _ref.countValue.ToString();
    }

    private void CreateCountBox(Transform parent, Vector2 pos, float w, float h, int value, Sprite boxSprite)
    {
        var countBox = new GameObject("CountBox", typeof(RectTransform), typeof(Image));
        countBox.transform.SetParent(parent, false);
        var cbrt = countBox.GetComponent<RectTransform>();
        cbrt.anchorMin = cbrt.anchorMax = new Vector2(0f, 0.5f);
        cbrt.pivot = new Vector2(0.5f, 0.5f);
        cbrt.anchoredPosition = pos;
        cbrt.sizeDelta = new Vector2(w, h);
        var cbImg = countBox.GetComponent<Image>();
        if (boxSprite != null)
        {
            cbImg.sprite = boxSprite;
            cbImg.type = Image.Type.Simple;
            cbImg.preserveAspect = false;
            cbImg.color = Color.white;
        }
        else
        {
            cbImg.color = Color.white;
        }
        cbImg.raycastTarget = false;

        var countGo = new GameObject("Count", typeof(RectTransform), typeof(TextMeshProUGUI));
        countGo.transform.SetParent(countBox.transform, false);
        var crt = countGo.GetComponent<RectTransform>();
        crt.anchorMin = Vector2.zero;
        crt.anchorMax = Vector2.one;
        crt.offsetMin = new Vector2(2f, 2f);
        crt.offsetMax = new Vector2(-2f, -2f);
        _countLabel = countGo.GetComponent<TextMeshProUGUI>();
        _countLabel.text = value.ToString();
        _countLabel.fontSize = 32f;
        _countLabel.fontStyle = FontStyles.Bold;
        _countLabel.alignment = TextAlignmentOptions.Center;
        _countLabel.color = new Color(0.12f, 0.12f, 0.16f, 1f);
        _countLabel.enableAutoSizing = true;
        _countLabel.fontSizeMin = 22f;
        _countLabel.fontSizeMax = 34f;
        _countLabel.enableWordWrapping = false;
        _countLabel.overflowMode = TextOverflowModes.Overflow;
        _countLabel.raycastTarget = false;
    }

    private void CreateButton(
        Transform parent,
        string name,
        string label,
        Vector2 pos,
        float size,
        UnityEngine.Events.UnityAction onClick,
        Sprite customSprite)
    {
        var go = new GameObject(name, typeof(RectTransform), typeof(Image), typeof(Button));
        go.transform.SetParent(parent, false);
        var rt = go.GetComponent<RectTransform>();
        rt.anchorMin = rt.anchorMax = new Vector2(0f, 0.5f);
        rt.pivot = new Vector2(0f, 0.5f);
        rt.anchoredPosition = pos;
        rt.sizeDelta = new Vector2(size, size);
        var img = go.GetComponent<Image>();
        bool useCustom = customSprite != null;
        img.sprite = useCustom ? customSprite : RepeatQueueVisualizer.GetCircleSprite();
        img.color = useCustom ? Color.white : new Color(1f, 1f, 1f, 0.95f);
        img.preserveAspect = false;
        img.raycastTarget = true;
        var btn = go.GetComponent<Button>();
        btn.targetGraphic = img;
        btn.onClick.AddListener(onClick);

        if (useCustom) return;

        var textGo = new GameObject("L", typeof(RectTransform), typeof(TextMeshProUGUI));
        textGo.transform.SetParent(go.transform, false);
        var trt = textGo.GetComponent<RectTransform>();
        trt.anchorMin = Vector2.zero;
        trt.anchorMax = Vector2.one;
        trt.offsetMin = Vector2.zero;
        trt.offsetMax = Vector2.zero;
        var tmp = textGo.GetComponent<TextMeshProUGUI>();
        tmp.text = label;
        tmp.fontSize = 28f;
        tmp.fontStyle = FontStyles.Bold;
        tmp.alignment = TextAlignmentOptions.Center;
        tmp.color = new Color(0.25f, 0.25f, 0.3f, 1f);
        tmp.raycastTarget = false;
    }
}

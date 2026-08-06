using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

/// <summary>
/// Yellow-strip Repeat visuals matching the SPARC mockup:
/// purple puzzle START · green body (only between) · orange puzzle END with − N +.
/// </summary>
[DisallowMultipleComponent]
public class RepeatQueueVisualizer : MonoBehaviour
{
    public CharacterMove characterMove;

    public Color bodyColor = new Color(0.55f, 0.88f, 0.42f, 0.95f);
    public Color startColor = new Color(0.55f, 0.35f, 0.88f, 1f);
    public Color endColor = new Color(1f, 0.55f, 0.18f, 1f);

    private Image _bodyImage;
    private RectTransform _bodyRt;
    private readonly List<Image> _bodyImages = new List<Image>();
    private readonly List<RectTransform> _bodyRts = new List<RectTransform>();

    private static Sprite _startPuzzleSprite;
    private static Sprite _endPuzzleSprite;
    private static Sprite _roundedSprite;
    private static Sprite _circleSprite;
    private static Sprite _loopSprite;

    private void LateUpdate()
    {
        if (characterMove == null) characterMove = FindObjectOfType<CharacterMove>();
        if (characterMove == null || characterMove.actionQueueTransform == null) return;
        Refresh();
    }

    public void Refresh()
    {
        var queue = characterMove.actionQueueTransform as RectTransform;
        if (queue == null) return;

        var pairs = new List<(RectTransform start, RectTransform end, QueuedActionRef endRef)>();
        RectTransform openStart = null;

        for (int i = 0; i < queue.childCount; i++)
        {
            var child = queue.GetChild(i) as RectTransform;
            if (child == null) continue;
            if (child.name != null && child.name.StartsWith("_RepeatBodyBg")) continue;
            if (child.GetComponent<QueueInsertionPlaceholder>() != null) continue;
            var r = child.GetComponent<QueuedActionRef>();
            if (r == null) continue;

            if (r.isRepeatStart)
            {
                openStart = child;
                StyleStart(child);
            }
            else if (r.isRepeatEnd && openStart != null)
            {
                StyleEnd(child, r);
                pairs.Add((openStart, child, r));
                openStart = null;
            }
        }

        if (pairs.Count == 0)
        {
            HideAllBodies();
            RestoreQueueSpacing(queue);
            return;
        }

        ApplyRepeatQueueSpacing(queue);
        // Re-assert strip binding in case something moved the queue.
        if (characterMove != null)
            characterMove.EnsureActionQueueLeftAligned();
        EnsureBodyPool(pairs.Count);
        for (int p = 0; p < pairs.Count; p++)
            LayoutGreenBodyBetweenCaps(queue, pairs[p].start, pairs[p].end, p);
        for (int p = pairs.Count; p < _bodyImages.Count; p++)
        {
            if (_bodyImages[p] != null) _bodyImages[p].enabled = false;
        }
    }

    private void HideAllBodies()
    {
        for (int i = 0; i < _bodyImages.Count; i++)
        {
            if (_bodyImages[i] != null) _bodyImages[i].enabled = false;
        }
        if (_bodyImage != null) _bodyImage.enabled = false;
    }

    private void EnsureBodyPool(int count)
    {
        while (_bodyImages.Count < count)
        {
            int idx = _bodyImages.Count;
            var go = new GameObject($"_RepeatBodyBg_{idx}", typeof(RectTransform), typeof(Image), typeof(LayoutElement));
            var rt = go.GetComponent<RectTransform>();
            var img = go.GetComponent<Image>();
            go.GetComponent<LayoutElement>().ignoreLayout = true;
            img.raycastTarget = false;
            img.enabled = false;
            _bodyRts.Add(rt);
            _bodyImages.Add(img);
            if (idx == 0)
            {
                _bodyRt = rt;
                _bodyImage = img;
                go.name = "_RepeatBodyBg";
            }
        }
    }

    private float? _savedQueueSpacing;

    private void ApplyRepeatQueueSpacing(RectTransform queue)
    {
        var hlg = queue.GetComponent<HorizontalLayoutGroup>();
        if (hlg == null) return;
        if (_savedQueueSpacing == null) _savedQueueSpacing = hlg.spacing;
        float spacing = characterMove != null ? characterMove.repeatQueueSpacing : 8f;
        hlg.spacing = spacing;
        // Keep strip left-aligned even when Repeat spacing is applied.
        hlg.childAlignment = TextAnchor.MiddleLeft;
        hlg.childForceExpandWidth = false;
        hlg.reverseArrangement = false;
    }

    private void RestoreQueueSpacing(RectTransform queue)
    {
        if (_savedQueueSpacing == null) return;
        var hlg = queue != null ? queue.GetComponent<HorizontalLayoutGroup>() : null;
        if (hlg != null) hlg.spacing = _savedQueueSpacing.Value;
    }

    /// <summary>
    /// Green sleeve fills the yellow lane from Start → End (behind any blocks in between),
    /// tucked slightly under the puzzle tabs, matching Start/End height.
    /// </summary>
    private void LayoutGreenBodyBetweenCaps(RectTransform queue, RectTransform startRt, RectTransform endRt, int bodyIndex)
    {
        Canvas.ForceUpdateCanvases();
        if (bodyIndex < 0 || bodyIndex >= _bodyRts.Count) return;
        var bodyRt = _bodyRts[bodyIndex];
        var bodyImage = _bodyImages[bodyIndex];
        if (bodyRt == null || bodyImage == null) return;

        Vector3[] sc = new Vector3[4];
        Vector3[] ec = new Vector3[4];
        startRt.GetWorldCorners(sc); // 0=BL 1=TL 2=TR 3=BR
        endRt.GetWorldCorners(ec);

        // Convert each corner into queue local space.
        Vector3 sBL = queue.InverseTransformPoint(sc[0]);
        Vector3 sTL = queue.InverseTransformPoint(sc[1]);
        Vector3 sTR = queue.InverseTransformPoint(sc[2]);
        Vector3 sBR = queue.InverseTransformPoint(sc[3]);
        Vector3 eBL = queue.InverseTransformPoint(ec[0]);
        Vector3 eTL = queue.InverseTransformPoint(ec[1]);
        Vector3 eTR = queue.InverseTransformPoint(ec[2]);
        Vector3 eBR = queue.InverseTransformPoint(ec[3]);

        float startLeft = Mathf.Min(sBL.x, sTL.x);
        float startRight = Mathf.Max(sTR.x, sBR.x);
        float endLeft = Mathf.Min(eBL.x, eTL.x);
        float endRight = Mathf.Max(eTR.x, eBR.x);

        float underlapL = characterMove != null ? characterMove.repeatBodyUnderlapLeft : 22f;
        float underlapR = characterMove != null ? characterMove.repeatBodyUnderlapRight : 40f;
        float xOffset = characterMove != null ? characterMove.repeatBodyXOffset : 0f;
        float heightScale = characterMove != null ? characterMove.repeatBodyHeightScale : 1f;
        float yInset = characterMove != null ? characterMove.repeatBodyYInset : 0f;

        // Span Start → End, then tuck under each tab independently.
        float left = startRight - underlapL + xOffset;
        float right = endLeft + underlapR + xOffset;
        left = Mathf.Max(left, startLeft + 1f);
        right = Mathf.Min(right, endRight - 1f);

        float bottom = Mathf.Max(sBL.y, eBL.y);
        float top = Mathf.Min(sTL.y, eTL.y);

        float midY = (bottom + top) * 0.5f;
        float fullH = Mathf.Abs(top - bottom);
        float h = Mathf.Max(4f, fullH * Mathf.Clamp(heightScale, 0.3f, 1.2f) - yInset * 2f);
        float w = right - left;

        if (w < 4f || fullH < 4f)
        {
            bodyImage.enabled = false;
            return;
        }

        Rect qr = queue.rect;
        bodyRt.SetParent(queue, false);
        bodyRt.SetAsFirstSibling();
        bodyRt.localScale = Vector3.one;
        bodyRt.localRotation = Quaternion.identity;
        bodyRt.anchorMin = Vector2.zero;
        bodyRt.anchorMax = Vector2.one;
        bodyRt.pivot = new Vector2(0.5f, 0.5f);
        bodyRt.offsetMin = new Vector2(left - qr.xMin, (midY - h * 0.5f) - qr.yMin);
        bodyRt.offsetMax = new Vector2(right - qr.xMax, (midY + h * 0.5f) - qr.yMax);

        bodyImage.sprite = (characterMove != null && characterMove.repeatBodySprite != null)
            ? characterMove.repeatBodySprite
            : GetRoundedSprite();
        bodyImage.type = Image.Type.Sliced;
        bodyImage.color = (characterMove != null && characterMove.repeatBodySprite != null)
            ? Color.white
            : bodyColor;
        bodyImage.enabled = true;
        bodyImage.raycastTarget = false;
    }

    private void StyleStart(RectTransform block)
    {
        // For the Repeat UI, we only show the close/X on the END block
        // (one button is enough to remove the whole repeat pair).

        // Close button is created active by default; explicitly hide it on Start.
        var close = block.Find("CloseButton");
        if (close != null) close.gameObject.SetActive(false);

        var img = block.GetComponent<Image>();
        bool customArt = characterMove != null && characterMove.repeatStartSprite != null;
        if (img != null)
        {
            if (customArt)
            {
                img.sprite = characterMove.repeatStartSprite;
                img.type = Image.Type.Simple;
                // Fill the layout slot (no letterbox gaps beside the art).
                img.preserveAspect = false;
                img.color = Color.white;
            }
            else
            {
                img.sprite = GetStartPuzzleSprite();
                img.type = Image.Type.Simple;
                img.preserveAspect = false;
                img.color = startColor;
            }
        }

        // Size to sprite aspect, then overlap into the next arrow.
        Vector2 baseSize = GetQueueActionBlockSize(isEnd: false, sprite: customArt ? characterMove.repeatStartSprite : null);
        float overlap = characterMove != null ? Mathf.Max(0f, characterMove.repeatStartEndArrowOverlap) : 0f;
        baseSize.x = Mathf.Max(24f, baseSize.x - overlap);
        var le = block.GetComponent<LayoutElement>() ?? block.gameObject.AddComponent<LayoutElement>();
        le.preferredWidth = baseSize.x;
        le.minWidth = baseSize.x;
        le.preferredHeight = baseSize.y;
        le.minHeight = baseSize.y;
        le.flexibleWidth = 0f;
        le.flexibleHeight = 0f;
        block.sizeDelta = baseSize;

        if (customArt)
        {
            // Custom Start art is the full design — no extra loop overlay.
            DestroyIfExists(block, "RepeatStartContent");
            DestroyIfExists(block, "CustomLoopOverlay");
        }
        else
        {
            EnsureStartContent(block);
        }

        ApplyBlockScale(block, characterMove != null ? characterMove.repeatStartScale : 1f);
        ApplyBlockYOffset(block, characterMove != null ? characterMove.repeatStartYOffset : 0f);
    }

    private void StyleEnd(RectTransform block, QueuedActionRef r)
    {
        if (characterMove == null || characterMove.showCloseButtonOnRepeatBlocks)
            ShowCloseButton(block);

        var img = block.GetComponent<Image>();
        bool customArt = characterMove != null && characterMove.repeatEndSprite != null;
        if (img != null)
        {
            if (customArt)
            {
                img.sprite = characterMove.repeatEndSprite;
                img.type = Image.Type.Simple;
                img.preserveAspect = false;
                img.color = Color.white;
            }
            else
            {
                img.sprite = GetEndPuzzleSprite();
                img.type = Image.Type.Simple;
                img.preserveAspect = false;
                img.color = endColor;
            }
        }

        Vector2 baseSize = GetQueueActionBlockSize(isEnd: true, sprite: customArt ? characterMove.repeatEndSprite : null);
        float overlap = characterMove != null ? Mathf.Max(0f, characterMove.repeatStartEndArrowOverlap) : 0f;
        baseSize.x = Mathf.Max(28f, baseSize.x - overlap);
        var le = block.GetComponent<LayoutElement>() ?? block.gameObject.AddComponent<LayoutElement>();
        le.preferredWidth = baseSize.x;
        le.minWidth = baseSize.x;
        le.preferredHeight = baseSize.y;
        le.minHeight = baseSize.y;
        le.flexibleWidth = 0f;
        le.flexibleHeight = 0f;
        block.sizeDelta = baseSize;

        DestroyIfExists(block, "RepeatStartLabel");
        DestroyIfExists(block, "RepeatEndLabel");
        DestroyIfExists(block, "RepeatStartContent");
        DestroyIfExists(block, "RepeatCounter");
        DestroyIfExists(block, "CustomLoopOverlay");

        Transform existing = block.Find("RepeatEndContent");
        if (existing == null)
            EnsureEndContent(block, r, hideTitle: customArt);
        else
            UpdateEndCountLabel(existing, r);

        ApplyBlockScale(block, characterMove != null ? characterMove.repeatEndScale : 1f);
        ApplyBlockYOffset(block, characterMove != null ? characterMove.repeatEndYOffset : 0f);
        ApplyEndControlLayoutAndScales(block);
        ApplyRepeatCloseButtonLayout(block);
    }

    private void ApplyRepeatCloseButtonLayout(RectTransform block)
    {
        var close = block.Find("CloseButton") as RectTransform;
        if (close == null || characterMove == null) return;

        float size = Mathf.Clamp(characterMove.repeatCloseButtonSize, 16f, 80f);
        close.sizeDelta = new Vector2(size, size);

        var le = close.GetComponent<LayoutElement>();
        if (le != null)
        {
            le.ignoreLayout = true;
            le.preferredWidth = size;
            le.preferredHeight = size;
            le.minWidth = size;
            le.minHeight = size;
        }

        Vector2 offset = characterMove.repeatCloseButtonOffset;
        if (characterMove.repeatCloseButtonOverhang)
        {
            offset = new Vector2(
                Mathf.Abs(offset.x) + Mathf.Max(0f, characterMove.repeatCloseButtonPushOutX),
                Mathf.Abs(offset.y));
        }
        else
        {
            offset = new Vector2(-Mathf.Abs(offset.x), -Mathf.Abs(offset.y));
        }
        close.anchoredPosition = offset;
        // Keep X size independent of End block scale.
        float parentScale = Mathf.Max(0.01f, block.localScale.x);
        close.localScale = Vector3.one * (1f / parentScale);
        close.SetAsLastSibling();
    }

    private Vector2 GetQueueActionBlockSize(bool isEnd, Sprite sprite = null)
    {
        float h = 64f;
        float w = isEnd ? 72f : 64f;
        if (characterMove != null && characterMove.actionImagePrefab != null)
        {
            var prefabLe = characterMove.actionImagePrefab.GetComponent<LayoutElement>();
            var prefabRt = characterMove.actionImagePrefab.GetComponent<RectTransform>();
            if (prefabLe != null && prefabLe.preferredHeight > 1f) h = prefabLe.preferredHeight;
            else if (prefabRt != null && prefabRt.sizeDelta.y > 1f) h = prefabRt.sizeDelta.y;

            float pw = 64f;
            if (prefabLe != null && prefabLe.preferredWidth > 1f) pw = prefabLe.preferredWidth;
            else if (prefabRt != null && prefabRt.sizeDelta.x > 1f) pw = prefabRt.sizeDelta.x;
            w = isEnd ? pw * 1.1f : pw;
        }

        // Match layout width to sprite aspect so we don't leave empty side padding.
        if (sprite != null && sprite.rect.height > 1f)
        {
            float aspect = sprite.rect.width / sprite.rect.height;
            w = Mathf.Max(24f, h * aspect);
        }
        return new Vector2(w, h);
    }

    private static void ApplyBlockScale(RectTransform block, float scale)
    {
        float s = Mathf.Clamp(scale, 0.15f, 2.5f);
        block.localScale = new Vector3(s, s, 1f);
    }

    private static void ApplyBlockYOffset(RectTransform block, float yOffset)
    {
        Vector2 p = block.anchoredPosition;
        block.anchoredPosition = new Vector2(p.x, yOffset);
    }

    private void ApplyEndControlLayoutAndScales(RectTransform block)
    {
        Transform root = block.Find("RepeatEndContent");
        if (root == null) return;

        float minusS = characterMove != null ? characterMove.repeatMinusScale : 1f;
        float plusS = characterMove != null ? characterMove.repeatPlusScale : 1f;
        float countS = characterMove != null ? characterMove.repeatCountScale : 1f;
        float minusXOff = characterMove != null ? characterMove.repeatMinusXOffset : 0f;
        float plusXOff = characterMove != null ? characterMove.repeatPlusXOffset : 0f;
        float countXOff = characterMove != null ? characterMove.repeatCountXOffset : 0f;
        float minusY = characterMove != null ? characterMove.repeatMinusYOffset : 0f;
        float plusY = characterMove != null ? characterMove.repeatPlusYOffset : 0f;
        float countY = characterMove != null ? characterMove.repeatCountYOffset : 0f;

        const float btnSize = 48f;
        const float countW = 56f;
        const float gap = 4f;
        float totalW = btnSize + gap + countW + gap + btnSize;
        float baseMinusX = -totalW * 0.5f + btnSize * 0.5f;
        float basePlusX = totalW * 0.5f - btnSize * 0.5f;

        Transform minus = root.Find("Minus");
        if (minus != null)
        {
            minus.localScale = Vector3.one * Mathf.Clamp(minusS, 0.15f, 6f);
            var rt = minus as RectTransform;
            if (rt != null) rt.anchoredPosition = new Vector2(baseMinusX + minusXOff, minusY);
        }

        Transform plus = root.Find("Plus");
        if (plus != null)
        {
            plus.localScale = Vector3.one * Mathf.Clamp(plusS, 0.15f, 6f);
            var rt = plus as RectTransform;
            if (rt != null) rt.anchoredPosition = new Vector2(basePlusX + plusXOff, plusY);
        }

        Transform countBox = root.Find("CountBox");
        if (countBox != null)
        {
            countBox.localScale = Vector3.one * Mathf.Clamp(countS, 0.15f, 6f);
            var rt = countBox as RectTransform;
            if (rt != null) rt.anchoredPosition = new Vector2(countXOff, countY);
        }
    }

    private static void UpdateEndCountLabel(Transform endContent, QueuedActionRef r)
    {
        var countLabel = endContent.Find("CountBox/Count")?.GetComponent<TextMeshProUGUI>();
        if (countLabel != null)
            countLabel.text = Mathf.Max(1, r.repeatCount).ToString();
    }

    private static void ShowCloseButton(RectTransform block)
    {
        var close = block.Find("CloseButton");
        if (close != null) close.gameObject.SetActive(true);
    }

    private void EnsureCustomLoopOverlay(RectTransform block, Sprite icon)
    {
        if (block.Find("CustomLoopOverlay") != null) return;
        var go = new GameObject("CustomLoopOverlay", typeof(RectTransform), typeof(Image));
        go.transform.SetParent(block, false);
        var rt = go.GetComponent<RectTransform>();
        rt.anchorMin = new Vector2(0.5f, 0.55f);
        rt.anchorMax = new Vector2(0.5f, 0.55f);
        rt.pivot = new Vector2(0.5f, 0.5f);
        rt.sizeDelta = new Vector2(36f, 36f);
        var img = go.GetComponent<Image>();
        img.sprite = icon;
        img.color = Color.white;
        img.raycastTarget = false;
        img.preserveAspect = true;
    }

    private static void DestroyIfExists(Transform parent, string name)
    {
        var t = parent.Find(name);
        if (t != null) Destroy(t.gameObject);
    }

    private void EnsureStartContent(RectTransform block)
    {
        if (block.Find("RepeatStartContent") != null) return;

        var root = new GameObject("RepeatStartContent", typeof(RectTransform));
        root.transform.SetParent(block, false);
        var rt = root.GetComponent<RectTransform>();
        // Keep content left of the puzzle tab (~18% on the right).
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = new Vector2(0.82f, 1f);
        rt.offsetMin = new Vector2(6f, 6f);
        rt.offsetMax = new Vector2(-4f, -6f);

        var iconGo = new GameObject("LoopIcon", typeof(RectTransform), typeof(Image));
        iconGo.transform.SetParent(root.transform, false);
        var iconRt = iconGo.GetComponent<RectTransform>();
        iconRt.anchorMin = new Vector2(0.5f, 0.48f);
        iconRt.anchorMax = new Vector2(0.5f, 0.48f);
        iconRt.pivot = new Vector2(0.5f, 0.5f);
        iconRt.sizeDelta = new Vector2(34f, 34f);
        var iconImg = iconGo.GetComponent<Image>();
        iconImg.sprite = (characterMove != null && characterMove.repeatLoopIconSprite != null)
            ? characterMove.repeatLoopIconSprite
            : GetLoopSprite();
        iconImg.color = Color.white;
        iconImg.raycastTarget = false;
        iconImg.preserveAspect = true;

        var labelGo = new GameObject("Label", typeof(RectTransform), typeof(TextMeshProUGUI));
        labelGo.transform.SetParent(root.transform, false);
        var lrt = labelGo.GetComponent<RectTransform>();
        lrt.anchorMin = new Vector2(0f, 0f);
        lrt.anchorMax = new Vector2(1f, 0.36f);
        lrt.offsetMin = Vector2.zero;
        lrt.offsetMax = Vector2.zero;
        var tmp = labelGo.GetComponent<TextMeshProUGUI>();
        tmp.text = "REPEAT START";
        tmp.fontSize = 10.5f;
        tmp.fontStyle = FontStyles.Bold;
        tmp.alignment = TextAlignmentOptions.Center;
        tmp.color = Color.white;
        tmp.enableWordWrapping = true;
        tmp.raycastTarget = false;
    }

    private void EnsureEndContent(RectTransform block, QueuedActionRef r, bool hideTitle = false)
    {
        var root = new GameObject("RepeatEndContent", typeof(RectTransform));
        root.transform.SetParent(block, false);
        var rt = root.GetComponent<RectTransform>();
        // Leave the left puzzle-tab clear; fill the rest of the end block.
        rt.anchorMin = new Vector2(0.16f, 0f);
        rt.anchorMax = Vector2.one;
        rt.offsetMin = new Vector2(2f, 2f);
        rt.offsetMax = new Vector2(-4f, -2f);

        if (!hideTitle)
        {
            var titleGo = new GameObject("Title", typeof(RectTransform), typeof(TextMeshProUGUI));
            titleGo.transform.SetParent(root.transform, false);
            var titleRt = titleGo.GetComponent<RectTransform>();
            titleRt.anchorMin = new Vector2(0f, 0.68f);
            titleRt.anchorMax = new Vector2(1f, 1f);
            titleRt.offsetMin = Vector2.zero;
            titleRt.offsetMax = Vector2.zero;
            var titleTmp = titleGo.GetComponent<TextMeshProUGUI>();
            titleTmp.text = "REPEAT END";
            titleTmp.fontSize = 10f;
            titleTmp.fontStyle = FontStyles.Bold;
            titleTmp.alignment = TextAlignmentOptions.Center;
            titleTmp.color = Color.white;
            titleTmp.raycastTarget = false;
        }

        // Fixed-size row: [ − ] [ N ] [ + ]  (minus left, plus right)
        const float btnSize = 48f;
        const float countW = 56f;
        const float countH = 50f;
        const float gap = 4f;
        float rowCenterY = hideTitle ? 0.50f : 0.34f;

        Sprite minusSprite = characterMove != null ? characterMove.repeatMinusSprite : null;
        Sprite plusSprite = characterMove != null ? characterMove.repeatPlusSprite : null;
        Sprite countBoxSprite = characterMove != null ? characterMove.repeatCountBoxSprite : null;

        float totalW = btnSize + gap + countW + gap + btnSize;
        float minusX = -totalW * 0.5f + btnSize * 0.5f;
        float countX = 0f;
        float plusX = totalW * 0.5f - btnSize * 0.5f;

        CreateSizedBtn(root.transform, "Minus", "-",
            new Vector2(minusX, 0f), new Vector2(0.5f, rowCenterY), btnSize,
            new Color(1f, 1f, 1f, 0.95f), new Color(0.25f, 0.25f, 0.3f, 1f),
            () => ChangeCount(r, -1),
            minusSprite);

        var countBox = new GameObject("CountBox", typeof(RectTransform), typeof(Image));
        countBox.transform.SetParent(root.transform, false);
        var cbrt = countBox.GetComponent<RectTransform>();
        cbrt.anchorMin = cbrt.anchorMax = new Vector2(0.5f, rowCenterY);
        cbrt.pivot = new Vector2(0.5f, 0.5f);
        cbrt.anchoredPosition = new Vector2(countX, 0f);
        cbrt.sizeDelta = new Vector2(countW, countH);
        var cbImg = countBox.GetComponent<Image>();
        if (countBoxSprite != null)
        {
            cbImg.sprite = countBoxSprite;
            cbImg.type = Image.Type.Simple;
            cbImg.preserveAspect = false;
            cbImg.color = Color.white;
        }
        else
        {
            cbImg.sprite = GetRoundedSprite();
            cbImg.type = Image.Type.Sliced;
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
        var countTmp = countGo.GetComponent<TextMeshProUGUI>();
        countTmp.text = Mathf.Max(1, r.repeatCount).ToString();
        countTmp.fontSize = 32f;
        countTmp.fontStyle = FontStyles.Bold;
        countTmp.alignment = TextAlignmentOptions.Center;
        countTmp.color = new Color(0.12f, 0.12f, 0.16f, 1f);
        countTmp.enableAutoSizing = true;
        countTmp.fontSizeMin = 22f;
        countTmp.fontSizeMax = 34f;
        countTmp.enableWordWrapping = false;
        countTmp.overflowMode = TextOverflowModes.Overflow;
        countTmp.raycastTarget = false;
        countTmp.ForceMeshUpdate();

        CreateSizedBtn(root.transform, "Plus", "+",
            new Vector2(plusX, 0f), new Vector2(0.5f, rowCenterY), btnSize,
            new Color(1f, 1f, 1f, 0.95f), new Color(0.25f, 0.25f, 0.3f, 1f),
            () => ChangeCount(r, +1),
            plusSprite);
    }

    private void ChangeCount(QueuedActionRef endRef, int delta)
    {
        endRef.repeatCount = ProgramSequenceUtil.ClampRepeatCount(endRef.repeatCount + delta);
        if (endRef.action is RepeatBoundaryAction ba) ba.repeatCount = endRef.repeatCount;

        // Sync only the paired Start (nearest Start to the left of this End).
        if (characterMove?.actionQueueTransform != null && endRef != null)
        {
            int endIdx = endRef.transform.GetSiblingIndex();
            for (int i = endIdx - 1; i >= 0; i--)
            {
                var r = characterMove.actionQueueTransform.GetChild(i).GetComponent<QueuedActionRef>();
                if (r == null) continue;
                if (r.isRepeatEnd) break;
                if (!r.isRepeatStart) continue;
                r.repeatCount = endRef.repeatCount;
                if (r.action is RepeatBoundaryAction sba) sba.repeatCount = endRef.repeatCount;
                r.actionLabel = ProgramSequenceUtil.FormatRepeatStart(endRef.repeatCount);
                break;
            }
        }
        Refresh();
    }

    private static void CreateSizedBtn(
        Transform parent, string name, string label,
        Vector2 anchoredPos, Vector2 anchor, float size,
        Color bg, Color fg,
        UnityEngine.Events.UnityAction onClick,
        Sprite customSprite = null)
    {
        var go = new GameObject(name, typeof(RectTransform), typeof(Image), typeof(Button));
        go.transform.SetParent(parent, false);
        var rt = go.GetComponent<RectTransform>();
        rt.anchorMin = rt.anchorMax = anchor;
        rt.pivot = new Vector2(0.5f, 0.5f);
        rt.anchoredPosition = anchoredPos;
        rt.sizeDelta = new Vector2(size, size);
        var img = go.GetComponent<Image>();
        bool useCustom = customSprite != null;
        img.sprite = useCustom ? customSprite : GetCircleSprite();
        img.color = useCustom ? Color.white : bg;
        // Fill the hit box so padded PNGs don't look tiny.
        img.preserveAspect = false;
        img.raycastTarget = true;
        var btn = go.GetComponent<Button>();
        btn.targetGraphic = img;
        btn.onClick.AddListener(onClick);

        // Custom art that already includes − / + does not need a text overlay.
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
        tmp.color = fg;
        tmp.raycastTarget = false;
    }

    // --- Sprites ---

    public static Sprite GetRoundedSprite()
    {
        if (_roundedSprite != null) return _roundedSprite;
        _roundedSprite = CreateRoundedRect(64, 64, 12);
        return _roundedSprite;
    }

    public static Sprite GetCircleSprite()
    {
        if (_circleSprite != null) return _circleSprite;
        _circleSprite = CreateCircle(64);
        return _circleSprite;
    }

    public static Sprite GetLoopSprite()
    {
        if (_loopSprite != null) return _loopSprite;
        _loopSprite = CreateLoopIcon(96);
        return _loopSprite;
    }

    public static Sprite GetStartPuzzleSprite()
    {
        if (_startPuzzleSprite != null) return _startPuzzleSprite;
        _startPuzzleSprite = CreatePuzzleBlock(128, 96, tabOnRight: true, notchOnLeft: false);
        return _startPuzzleSprite;
    }

    public static Sprite GetEndPuzzleSprite()
    {
        if (_endPuzzleSprite != null) return _endPuzzleSprite;
        _endPuzzleSprite = CreatePuzzleBlock(128, 96, tabOnRight: false, notchOnLeft: true);
        return _endPuzzleSprite;
    }

    private static Sprite CreatePuzzleBlock(int w, int h, bool tabOnRight, bool notchOnLeft)
    {
        var tex = new Texture2D(w, h, TextureFormat.RGBA32, false);
        tex.filterMode = FilterMode.Bilinear;
        var pixels = new Color[w * h];
        float radius = 10f;
        float tabR = h * 0.22f;
        float bodyRight = tabOnRight ? w - tabR - 2f : w - 2f;
        float bodyLeft = notchOnLeft ? tabR + 2f : 2f;

        Vector2 tabCenter = new Vector2(bodyRight, h * 0.5f);
        Vector2 notchCenter = new Vector2(bodyLeft, h * 0.5f);

        for (int y = 0; y < h; y++)
        {
            for (int x = 0; x < w; x++)
            {
                float a = 0f;
                // Main rounded body
                a = Mathf.Max(a, SoftRoundedRect(x, y, bodyLeft, 2f, bodyRight, h - 2f, radius));

                if (tabOnRight)
                {
                    float d = Vector2.Distance(new Vector2(x, y), tabCenter);
                    if (d <= tabR) a = Mathf.Max(a, SoftEdge(tabR - d, 1.5f));
                }

                if (notchOnLeft)
                {
                    float d = Vector2.Distance(new Vector2(x, y), notchCenter);
                    // Cut a semicircle notch from the left of the body.
                    if (x < bodyLeft + 1f && d < tabR - 1f)
                        a = 0f;
                }

                pixels[y * w + x] = new Color(1f, 1f, 1f, Mathf.Clamp01(a));
            }
        }
        tex.SetPixels(pixels);
        tex.Apply();
        return Sprite.Create(tex, new Rect(0, 0, w, h), new Vector2(0.5f, 0.5f), 100f);
    }

    private static float SoftRoundedRect(float x, float y, float l, float b, float r, float t, float rad)
    {
        if (x < l || x > r || y < b || y > t) return 0f;
        // Corner checks
        Vector2 c;
        if (x < l + rad && y < b + rad) c = new Vector2(l + rad, b + rad);
        else if (x > r - rad && y < b + rad) c = new Vector2(r - rad, b + rad);
        else if (x < l + rad && y > t - rad) c = new Vector2(l + rad, t - rad);
        else if (x > r - rad && y > t - rad) c = new Vector2(r - rad, t - rad);
        else return 1f;
        float d = Vector2.Distance(new Vector2(x, y), c);
        return SoftEdge(rad - d, 1.4f);
    }

    private static float SoftEdge(float inside, float soft)
    {
        if (inside >= soft) return 1f;
        if (inside <= 0f) return 0f;
        return inside / soft;
    }

    private static Sprite CreateRoundedRect(int w, int h, int rad)
    {
        var tex = new Texture2D(w, h, TextureFormat.RGBA32, false);
        tex.filterMode = FilterMode.Bilinear;
        var pixels = new Color[w * h];
        for (int y = 0; y < h; y++)
            for (int x = 0; x < w; x++)
                pixels[y * w + x] = new Color(1f, 1f, 1f, SoftRoundedRect(x, y, 0, 0, w - 1, h - 1, rad));
        tex.SetPixels(pixels);
        tex.Apply();
        return Sprite.Create(tex, new Rect(0, 0, w, h), new Vector2(0.5f, 0.5f), 100f, 0,
            SpriteMeshType.FullRect, new Vector4(rad, rad, rad, rad));
    }

    private static Sprite CreateCircle(int size)
    {
        var tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
        tex.filterMode = FilterMode.Bilinear;
        var pixels = new Color[size * size];
        Vector2 c = new Vector2((size - 1) * 0.5f, (size - 1) * 0.5f);
        float r = size * 0.48f;
        for (int y = 0; y < size; y++)
            for (int x = 0; x < size; x++)
            {
                float d = Vector2.Distance(new Vector2(x, y), c);
                pixels[y * size + x] = new Color(1f, 1f, 1f, SoftEdge(r - d, 1.5f));
            }
        tex.SetPixels(pixels);
        tex.Apply();
        return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f);
    }

    private static Sprite CreateLoopIcon(int size)
    {
        var tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
        tex.filterMode = FilterMode.Bilinear;
        var pixels = new Color[size * size];
        Vector2 c = new Vector2((size - 1) * 0.5f, (size - 1) * 0.5f);
        float outer = size * 0.36f;
        float inner = size * 0.22f;
        for (int y = 0; y < size; y++)
        {
            for (int x = 0; x < size; x++)
            {
                Vector2 p = new Vector2(x, y);
                float d = Vector2.Distance(p, c);
                Vector2 dir = (p - c).normalized;
                float ang = Mathf.Atan2(dir.y, dir.x);
                bool gap = ang > -0.5f && ang < 0.5f;
                float a = 0f;
                if (!gap && d <= outer && d >= inner)
                    a = Mathf.Min(SoftEdge(outer - d, 2f), SoftEdge(d - inner, 2f));
                // Arrow tip
                Vector2 tip = c + new Vector2(outer * 0.92f, 0f);
                if (PointInTri(p, tip, tip + new Vector2(-11f, 10f), tip + new Vector2(-11f, -10f)))
                    a = 1f;
                pixels[y * size + x] = new Color(1f, 1f, 1f, a);
            }
        }
        tex.SetPixels(pixels);
        tex.Apply();
        return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f);
    }

    private static bool PointInTri(Vector2 p, Vector2 a, Vector2 b, Vector2 c)
    {
        float s = a.y * c.x - a.x * c.y + (c.y - a.y) * p.x + (a.x - c.x) * p.y;
        float t = a.x * b.y - a.y * b.x + (a.y - b.y) * p.x + (b.x - a.x) * p.y;
        if ((s < 0) != (t < 0)) return false;
        float A = -b.y * c.x + a.y * (c.x - b.x) + a.x * (b.y - c.y) + b.x * c.y;
        return A < 0 ? (s <= 0 && s + t >= A) : (s >= 0 && s + t <= A);
    }
}

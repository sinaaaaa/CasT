using UnityEngine;
using UnityEngine.UI;
using System.Collections.Generic;

/// <summary>
/// Segmented progress bar. Driven externally via <see cref="SetFillAmount"/> —
/// does not fake its own animation (that competed with the loading scene).
/// </summary>
public class ClassicProgressBar : MonoBehaviour
{
    [Header("Colors")]
    [SerializeField] private Color mainColor = Color.white;
    [SerializeField] private Color fillColor = new Color(0.35f, 0.78f, 1f, 1f);

    [Header("General")]
    [SerializeField] private int numberOfSegments = 5;
    [SerializeField] private float sizeOfNotch = 5f;
    [Range(0, 1f)] [SerializeField] private float fillAmount = 0f;

    readonly List<Image> progressSegments = new List<Image>();
    Image segmentTemplate;
    bool built;

    void Awake()
    {
        BuildSegmentsIfNeeded();
    }

    void BuildSegmentsIfNeeded()
    {
        if (built) return;

        segmentTemplate = GetComponentInChildren<Image>(true);
        if (segmentTemplate == null)
        {
            built = true;
            return;
        }

        segmentTemplate.color = mainColor;
        segmentTemplate.gameObject.SetActive(false);

        var rootRt = GetComponent<RectTransform>();
        float width = rootRt != null ? rootRt.sizeDelta.x : 400f;
        if (width < 10f) width = 400f;

        float segmentWidth = (width - sizeOfNotch * (numberOfSegments - 1)) / Mathf.Max(1, numberOfSegments);

        for (int i = 0; i < numberOfSegments; i++)
        {
            Image newSegment = Instantiate(segmentTemplate, transform);
            newSegment.gameObject.SetActive(true);

            RectTransform rectTransform = newSegment.GetComponent<RectTransform>();
            rectTransform.sizeDelta = new Vector2(segmentWidth, rectTransform.sizeDelta.y);
            rectTransform.anchoredPosition = new Vector2(i * (segmentWidth + sizeOfNotch), 0);

            if (newSegment.transform.childCount > 0)
            {
                Image fillImage = newSegment.transform.GetChild(0).GetComponent<Image>();
                if (fillImage != null)
                {
                    fillImage.color = fillColor;
                    fillImage.fillAmount = 0f;
                    progressSegments.Add(fillImage);
                }
            }
        }

        built = true;
        ApplyFill(fillAmount);
    }

    public void SetFillAmount(float amount)
    {
        BuildSegmentsIfNeeded();
        fillAmount = Mathf.Clamp01(amount);
        ApplyFill(fillAmount);
    }

    void ApplyFill(float amount)
    {
        for (int i = 0; i < progressSegments.Count; i++)
        {
            if (progressSegments[i] != null)
                progressSegments[i].fillAmount = amount;
        }
    }
}

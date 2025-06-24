using UnityEngine;
using UnityEngine.UI;
using System.Collections.Generic;
using System.Collections;

public class ClassicProgressBar : MonoBehaviour
{
    IEnumerator SimulateProgress()
    {
        float progress = 0f;
        while (progress < 1f)
        {
            progress += Time.deltaTime * 0.1f; // Adjust the rate as needed
            SetFillAmount(progress);
            yield return null;
        }
    }

    void Start()
    {
        StartCoroutine(SimulateProgress());
    }

    [Header("Colors")]
    [SerializeField] private Color mainColor = Color.white;
    [SerializeField] private Color fillColor = Color.red;

    [Header("General")]
    [SerializeField] private int numberOfSegments = 5;
    [SerializeField] private float sizeOfNotch = 5f;
    [Range(0, 1f)] [SerializeField] private float fillAmount = 0f;

    private List<Image> progressSegments = new List<Image>();
    private Image segmentTemplate;

    void Awake()
    {
        segmentTemplate = GetComponentInChildren<Image>();
        segmentTemplate.color = mainColor;
        segmentTemplate.gameObject.SetActive(false);

        float segmentWidth = (GetComponent<RectTransform>().sizeDelta.x - sizeOfNotch * (numberOfSegments - 1)) / numberOfSegments;

        for (int i = 0; i < numberOfSegments; i++)
        {
            Image newSegment = Instantiate(segmentTemplate, transform);
            newSegment.gameObject.SetActive(true);

            RectTransform rectTransform = newSegment.GetComponent<RectTransform>();
            rectTransform.sizeDelta = new Vector2(segmentWidth, rectTransform.sizeDelta.y);
            rectTransform.anchoredPosition = new Vector2(i * (segmentWidth + sizeOfNotch), 0);

            Image fillImage = newSegment.transform.GetChild(0).GetComponent<Image>();
            fillImage.color = fillColor;
            fillImage.fillAmount = 0.6f;
            progressSegments.Add(fillImage);
        }
    }

    void Update()
    {
        UpdateProgressBar(fillAmount);
    }

    public void UpdateProgressBar(float value)
    {
        Debug.Log("Updating progress bar to " + value);
        SetFillAmount(value);
    }


    public void SetFillAmount(float amount)
    {
        fillAmount = Mathf.Clamp(amount, 0.0f, 1.0f);
        foreach (Image segment in progressSegments)
        {
            segment.fillAmount = fillAmount;
        }
    }

}

using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

/// <summary>
/// Shared close (X) for yellow-strip items (arrows and Command Bags).
/// Removes on pointer-down so parent <see cref="DraggableQueuedBlock"/> cannot
/// steal the interaction as a reorder drag before Button.onClick fires.
/// </summary>
[RequireComponent(typeof(RectTransform))]
[RequireComponent(typeof(Image))]
public class QueuedBlockCloseButton : MonoBehaviour,
    IPointerDownHandler,
    IPointerUpHandler,
    IPointerClickHandler,
    IInitializePotentialDragHandler,
    IBeginDragHandler,
    IDragHandler,
    IEndDragHandler
{
    public CharacterMove characterMove;
    public GameObject targetBlock;

    bool _removed;
    // Pointer-down, click and Button.onClick all fire for one tap: report a refusal once.
    float _refusedAt = -10f;

    void Awake()
    {
        var button = GetComponent<Button>();
        if (button != null)
        {
            button.onClick.RemoveListener(OnButtonClick);
            button.onClick.AddListener(OnButtonClick);
        }
    }

    void OnDestroy()
    {
        var button = GetComponent<Button>();
        if (button != null)
            button.onClick.RemoveListener(OnButtonClick);
    }

    void OnButtonClick() => TryRemove();

    public void OnPointerDown(PointerEventData eventData)
    {
        if (eventData == null || eventData.button != PointerEventData.InputButton.Left)
            return;
        // Claim drag so the parent bag/arrow never begins a reorder from the X.
        eventData.pointerDrag = gameObject;
        eventData.dragging = false;
        TryRemove();
    }

    public void OnPointerUp(PointerEventData eventData)
    {
        // Keep claiming the gesture so EndDrag cannot land on the parent block.
        if (eventData != null)
            eventData.pointerDrag = gameObject;
    }

    public void OnPointerClick(PointerEventData eventData)
    {
        if (eventData == null || eventData.button != PointerEventData.InputButton.Left)
            return;
        TryRemove();
    }

    public void OnInitializePotentialDrag(PointerEventData eventData)
    {
        if (eventData != null)
            eventData.pointerDrag = gameObject;
    }

    public void OnBeginDrag(PointerEventData eventData)
    {
        if (eventData != null)
            eventData.pointerDrag = gameObject;
    }

    public void OnDrag(PointerEventData eventData) { }
    public void OnEndDrag(PointerEventData eventData) { }

    public void TryRemove()
    {
        if (_removed) return;
        if (characterMove == null || targetBlock == null)
        {
            Debug.LogWarning("[QueuedBlockCloseButton] Missing characterMove or targetBlock.");
            return;
        }
        if (Time.unscaledTime - _refusedAt < 0.4f) return;
        _removed = true;
        Debug.Log($"[QueuedBlockCloseButton] Removing '{targetBlock.name}'");
        if (!characterMove.RemoveQueuedBlock(targetBlock))
        {
            _removed = false;
            _refusedAt = Time.unscaledTime;
        }
    }
}

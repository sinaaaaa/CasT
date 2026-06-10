using System;
using UnityEngine;



public class AppleCluster : MonoBehaviour
{
    public int applesInCluster; // The number of apples in this cluster
    public bool allowDrag = false; // Enable/disable dragging for this apple

    private Vector3 offset;
    private float zCoord;
    private CharacterMove characterMove;

    private void Start()
    {
        characterMove = FindObjectOfType<CharacterMove>();
    }

    void OnMouseDown()
    {
        if (!allowDrag) return;
        zCoord = Camera.main.WorldToScreenPoint(transform.position).z;
        offset = transform.position - GetMouseWorldPos();
    }

    void OnMouseDrag()
    {
        if (!allowDrag) return;
        Vector3 newPos = GetMouseWorldPos() + offset;
        // Optionally clamp to grid bounds here
        transform.position = new Vector3(newPos.x, transform.position.y, newPos.z);
    }

    void OnMouseUp()
    {
        if (!allowDrag) return;
        // Snap to nearest grid cell
        if (characterMove != null)
        {
            Vector2Int cell = characterMove.WorldToGridCell(transform.position);
            Vector3 snapped = characterMove.GridCellToWorld(cell);
            transform.position = new Vector3(snapped.x, transform.position.y, snapped.z);
            // Update logical apple position in CharacterMove
            characterMove.UpdateDraggedGridObjectPosition(transform.position, gameObject);
        }
    }

    private Vector3 GetMouseWorldPos()
    {
        Vector3 mousePoint = Input.mousePosition;
        mousePoint.z = zCoord;
        return Camera.main.ScreenToWorldPoint(mousePoint);
    }

    // Method to collect apples from this cluster
    public int CollectApples()
    {
        int collectedApples = applesInCluster;
        if (gameObject.activeInHierarchy) // Only log if it was active
        {
            Debug.Log($"[AppleCluster] Deactivating apple {gameObject.name} during collection. Apples in cluster before collection: {applesInCluster}");
        }
        gameObject.SetActive(false); // Only deactivate this apple
        applesInCluster = 0; // Explicitly set to 0 after collection
        return collectedApples;
    }
}





using UnityEngine;
using System.Collections;

public class GridObjectCluster : MonoBehaviour
{
    public bool allowDrag = false;
    public CharacterMove characterMove;
    
    private bool isDragging = false;
    private Vector3 offset;
    private Camera mainCamera;
    private Vector3 originalPosition;
    private SpriteRenderer spriteRenderer;
    private Color originalColor;
    
    void Start()
    {
        mainCamera = characterMove != null && characterMove.gridInteractionCamera != null
            ? characterMove.gridInteractionCamera
            : Camera.main;
        originalPosition = transform.position;
        spriteRenderer = GetComponent<SpriteRenderer>();
        if (spriteRenderer != null)
        {
            originalColor = spriteRenderer.color;
        }
        
        // Ensure this object can receive pointer events (3D collider for mouse events)
        Collider collider = GetComponent<Collider>();
        if (collider == null)
        {
            Debug.LogWarning($"[GridObjectCluster] {gameObject.name} needs a Collider (3D) for drag to work properly!");
        }
        else
        {
            // Ensure the collider is properly configured
            collider.isTrigger = false; // Should not be a trigger for mouse events
            Debug.Log($"[GridObjectCluster] {gameObject.name} collider (3D) configured - isTrigger={collider.isTrigger}");
            
            // Additional debugging - check collider bounds
            Debug.Log($"[GridObjectCluster] {gameObject.name} collider bounds: {collider.bounds}");
            Debug.Log($"[GridObjectCluster] {gameObject.name} collider size: {collider.bounds.size}");
        }
        
        Debug.Log($"[GridObjectCluster] {gameObject.name} initialized with allowDrag={allowDrag}, hasCollider={collider != null}");
        
        // Test if we can detect mouse events
        StartCoroutine(TestMouseDetection());
        
        // For world objects, we use legacy mouse events (OnMouseDown, OnMouseDrag, OnMouseUp)
        // These don't require Canvas or EventSystem
        Debug.Log($"[GridObjectCluster] {gameObject.name} - Using legacy mouse events for world object dragging");
    }
    
    private IEnumerator TestMouseDetection()
    {
        yield return new WaitForSeconds(1f); // Wait a bit for everything to settle
        
        // Check if we're in the camera's view
        if (mainCamera != null)
        {
            Vector3 viewportPoint = mainCamera.WorldToViewportPoint(transform.position);
            bool inView = viewportPoint.x >= 0 && viewportPoint.x <= 1 && 
                         viewportPoint.y >= 0 && viewportPoint.y <= 1 && 
                         viewportPoint.z > 0;
            
            Debug.Log($"[GridObjectCluster] {gameObject.name} viewport position: {viewportPoint}, inView: {inView}");
        }
    }
    
    // Note: Pointer events (OnPointerDown, OnPointerEnter, etc.) only work for UI elements under Canvas
    // Since these are world objects, we use legacy mouse events (OnMouseDown, OnMouseDrag, OnMouseUp)
    // These methods are intentionally left empty for world objects
    
    // Legacy mouse support (for backward compatibility)
    void OnMouseDown()
    {
        Debug.Log($"[GridObjectCluster] OnMouseDown called on {gameObject.name} - allowDrag={allowDrag}");
        
        if (!allowDrag) 
        {
            Debug.Log($"[GridObjectCluster] Drag not allowed for {gameObject.name}");
            return;
        }
        
        // Start dragging immediately
        isDragging = true;
        Vector3 worldPos = GetMouseWorldPosition();
        offset = transform.position - worldPos;
        originalPosition = transform.position;
        
        // Make rigidbody non-kinematic during drag for smooth movement
        Rigidbody rb = GetComponent<Rigidbody>();
        if (rb != null)
        {
            rb.isKinematic = false;
            Debug.Log($"[GridObjectCluster] Made {gameObject.name} rigidbody non-kinematic for dragging");
        }
        
        // Visual feedback - highlight the object being dragged
        if (spriteRenderer != null)
        {
            spriteRenderer.color = new Color(1f, 1f, 0.5f, 1f); // Light yellow highlight
            Debug.Log($"[GridObjectCluster] Applied yellow highlight to {gameObject.name}");
        }
        
        // Bring object to front while dragging
        if (spriteRenderer != null)
        {
            spriteRenderer.sortingOrder = 10;
            Debug.Log($"[GridObjectCluster] Brought {gameObject.name} to front (sortingOrder=10)");
        }
        
        Debug.Log($"[GridObjectCluster] Started dragging {gameObject.name} (mouse) - isDragging={isDragging}");
    }
    
    // Mouse drag support (for world objects)
    void OnMouseDrag()
    {
        Debug.Log($"[GridObjectCluster] OnMouseDrag called on {gameObject.name} - allowDrag={allowDrag}, isDragging={isDragging}");
        
        if (!allowDrag || !isDragging) 
        {
            Debug.Log($"[GridObjectCluster] Drag blocked for {gameObject.name} - allowDrag={allowDrag}, isDragging={isDragging}");
            return;
        }
        
        Vector3 worldPos = GetMouseWorldPosition();
        Vector3 newPosition = worldPos + offset;
        Vector3 oldPosition = transform.position;
        transform.position = newPosition;
        
        Debug.Log($"[GridObjectCluster] Dragging {gameObject.name} - old pos: {oldPosition}, new pos: {newPosition}");
    }
    
    // Mouse up support (for world objects)
    void OnMouseUp()
    {
        if (!allowDrag || !isDragging) return;
        
        EndDragging();
    }
    
    private void EndDragging()
    {
        isDragging = false;
        
        // Make rigidbody kinematic again to prevent unwanted movement
        Rigidbody rb = GetComponent<Rigidbody>();
        if (rb != null)
        {
            rb.isKinematic = true;
            rb.velocity = Vector3.zero; // Stop any momentum
            rb.angularVelocity = Vector3.zero; // Stop any rotation
            Debug.Log($"[GridObjectCluster] Made {gameObject.name} rigidbody kinematic and stopped movement");
        }
        
        // Remove highlight and restore original sorting order
        if (spriteRenderer != null)
        {
            spriteRenderer.color = originalColor;
            spriteRenderer.sortingOrder = 1; // Restore original sorting order
        }
        
        // Snap to grid
        Vector3 snappedPosition = SnapToGrid(transform.position);
        transform.position = snappedPosition;
        
        // Update the position in CharacterMove
        if (characterMove != null)
        {
            characterMove.UpdateDraggedGridObjectPosition(snappedPosition, gameObject);
        }
        
        Debug.Log($"[GridObjectCluster] {gameObject.name} dragged to {snappedPosition}");
    }
    
    // Note: Pointer event methods removed - using legacy mouse events for world objects
    
    // Get world position from mouse position (legacy support)
    private Vector3 GetMouseWorldPosition()
    {
        if (mainCamera == null) return Vector3.zero;
        
        Vector3 mousePos = Input.mousePosition;
        
        // Create a ray from the camera through the mouse point
        Ray ray = mainCamera.ScreenPointToRay(mousePos);
        
        // Create a plane at the object's Y level
        Plane plane = new Plane(Vector3.up, new Vector3(0, transform.position.y, 0));
        
        float distance;
        if (plane.Raycast(ray, out distance))
        {
            return ray.GetPoint(distance);
        }
        
        // Fallback: use the old method if raycast fails
        mousePos.z = Mathf.Abs(mainCamera.transform.position.z - transform.position.z);
        return mainCamera.ScreenToWorldPoint(mousePos);
    }
    
    private Vector3 SnapToGrid(Vector3 worldPosition)
    {
        if (characterMove == null) return worldPosition;

        Vector2Int cell = characterMove.WorldToGridCell(worldPosition);
        Vector3 snapped = characterMove.GridCellToWorld(cell);
        snapped.y = worldPosition.y;
        return snapped;
    }
    
    // Note: Legacy mouse events are used for world objects instead of pointer events
    
    // Test method to verify the component is working
    void OnMouseEnter()
    {
        Debug.Log($"[GridObjectCluster] *** MOUSE ENTERED {gameObject.name} *** - allowDrag={allowDrag}");
        
        // Additional debugging - check collider state
        Collider collider = GetComponent<Collider>();
        if (collider != null)
        {
            Debug.Log($"[GridObjectCluster] {gameObject.name} collider (3D) - isTrigger={collider.isTrigger}, enabled={collider.enabled}");
            Debug.Log($"[GridObjectCluster] {gameObject.name} collider bounds: {collider.bounds}");
        }
        
        // Visual feedback when mouse enters
        if (spriteRenderer != null)
        {
            spriteRenderer.color = new Color(0.9f, 0.9f, 1f, 1f); // Light blue tint
        }
    }
    
    void OnMouseExit()
    {
        Debug.Log($"[GridObjectCluster] *** MOUSE EXITED {gameObject.name} ***");
        
        // Reset visual feedback when mouse exits
        if (spriteRenderer != null && !isDragging)
        {
            spriteRenderer.color = originalColor;
        }
    }
    
    void OnMouseOver()
    {
        // This will fire continuously while mouse is over the object
        if (allowDrag && Input.GetMouseButtonDown(0))
        {
            Debug.Log($"[GridObjectCluster] Mouse click detected on {gameObject.name} via OnMouseOver");
        }
    }
    
    // Note: OnMouseDown is already handled by the existing drag system above
    
    // Additional debugging - check if mouse events are being received at all
    void Update()
    {
        // Check for mouse button press anywhere on screen for debugging
        if (Input.GetMouseButtonDown(0))
        {
            Vector3 mouseWorldPos = GetMouseWorldPosition();
            float distanceToObject = Vector3.Distance(mouseWorldPos, transform.position);
            Debug.Log($"[GridObjectCluster] Mouse clicked at world pos {mouseWorldPos}, distance to {gameObject.name}: {distanceToObject}");
        }
    }
    
    // Note: OnMouseDown and OnMouseUp are already handled by the existing drag system above
}

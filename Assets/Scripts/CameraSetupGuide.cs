using UnityEngine;

public class CameraSetupGuide : MonoBehaviour
{
    [Header("Setup Instructions")]
    [TextArea(10, 20)]
    public string setupInstructions = @"
CAMERA SETUP GUIDE:

1. CAMERA COMPONENT SETUP:
   • Add the MultiTargetCamera script to your Main Camera
   • Make sure the camera has a Camera component
   • Set the camera's Clear Flags to 'Solid Color' for best grid visibility

2. GRID SETTINGS:
   • Set Grid Size to match your grid cell size (default: 21)
   • Set Grid Rows and Grid Cols to match your grid dimensions
   • Set Robot Start World Pos to your grid's origin point

3. CAMERA MODES:
   • TopDown: Perfect for grid-based games (default)
   • Isometric: 3D perspective view
   • Follow: Follows the robot around
   • Strategic: Shows entire grid with perspective

4. CONTROLS:
   • Press 1-4 to switch camera modes
   • Press R to reset camera position
   • Mouse wheel to zoom in/out
   • Right-click + drag to pan
   • WASD to move camera
   • Q/E to move camera up/down

5. OPTIMAL SETTINGS FOR GRID GAMES:
   • TopDown Mode: Height 15, FOV 45
   • Isometric Mode: Offset (8,8,-8), FOV 60
   • Follow Mode: Offset (0,5,-5), FOV 50
   • Strategic Mode: Offset (0,12,-8), FOV 55

6. TARGETS:
   • Add your robot and important objects to the targets list
   • The camera will automatically track these objects
   • For Follow mode, the robot should be the primary target

7. UI INTEGRATION:
   • Add CameraControllerUI script to a UI GameObject
   • Assign buttons for each camera mode
   • Add toggles for mouse zoom and pan controls

8. CODE WORKSPACE PREVIEW (Picture-in-Picture strip of blocks — optional):
   • Add empty GameObject, attach CodeWorkspacePreview.cs
   • Project Settings → Tags and Layers → add user layer ""CodePreview"" (remember its index)
   • Set Preview Layer on CodeWorkspacePreview to that index
   • Main Camera → Culling Mask: turn OFF that layer so preview sprites cannot appear on the island
   • CodePreview Camera (auto-created or assigned) → Culling Mask: ONLY that layer
   • Add a HUD RawImage (e.g. top-right), assign to Picture — child can use Preserve Aspect / fixed width
   • Enable Bootstrap If Empty unless you prefab-assign mirror root, RT, and preview camera manually

TROUBLESHOOTING:
• If camera doesn't move: Check if targets list is empty
• If grid looks wrong: Verify grid size and position settings
• If controls don't work: Check if input is enabled
• If camera clips through objects: Adjust min/max zoom values
";

    [Header("Auto Setup")]
    public bool autoSetupOnStart = true;
    public bool showSetupInstructions = true;

    private void Start()
    {
        if (autoSetupOnStart)
        {
            AutoSetupCamera();
        }
        
        if (showSetupInstructions)
        {
            Debug.Log(setupInstructions);
        }
    }

    void AutoSetupCamera()
    {
        // Find or create camera
        Camera mainCamera = Camera.main;
        if (mainCamera == null)
        {
            mainCamera = FindObjectOfType<Camera>();
        }
        
        if (mainCamera == null)
        {
            Debug.LogError("No camera found! Please add a camera to your scene.");
            return;
        }

        // Add MultiTargetCamera script if not present
        MultiTargetCamera multiTargetCamera = mainCamera.GetComponent<MultiTargetCamera>();
        if (multiTargetCamera == null)
        {
            multiTargetCamera = mainCamera.gameObject.AddComponent<MultiTargetCamera>();
            Debug.Log("Added MultiTargetCamera script to camera.");
        }

        // Find CharacterMove to get grid settings
        CharacterMove characterMove = FindObjectOfType<CharacterMove>();
        if (characterMove != null)
        {
            // Auto-configure grid settings
            multiTargetCamera.gridSize = characterMove.gridSize;
            multiTargetCamera.gridRows = characterMove.gridRows;
            multiTargetCamera.gridCols = characterMove.gridCols;
            multiTargetCamera.robotStartWorldPos = characterMove.robotStartWorldPos;
            
            // Add robot as target
            multiTargetCamera.AddTarget(characterMove.transform);
            
            Debug.Log("Auto-configured camera with CharacterMove settings.");
        }

        // Set optimal camera settings for grid games
        multiTargetCamera.topDownHeight = 100f;  // Much lower height for better grid visibility
        multiTargetCamera.topDownFOV = 60f;      // Wider FOV to see more of the grid
        multiTargetCamera.isometricOffset = new Vector3(8, 8, -8);
        multiTargetCamera.isometricFOV = 60f;
        multiTargetCamera.followOffset = new Vector3(0, 5, -5);
        multiTargetCamera.followFOV = 50f;
        multiTargetCamera.strategicOffset = new Vector3(0, 12, -8);
        multiTargetCamera.strategicFOV = 55f;

        // Enable controls
        multiTargetCamera.enableMouseZoom = true;
        multiTargetCamera.enableMousePan = true;
        multiTargetCamera.mouseZoomSpeed = 2f;
        multiTargetCamera.mousePanSpeed = 5f;
        multiTargetCamera.keyboardPanSpeed = 10f;

        Debug.Log("Camera auto-setup complete! Press 1-4 to switch modes, R to reset.");
    }

    [ContextMenu("Auto Setup Camera")]
    public void AutoSetupCameraManual()
    {
        AutoSetupCamera();
    }

    [ContextMenu("Show Setup Instructions")]
    public void ShowInstructions()
    {
        Debug.Log(setupInstructions);
    }

    // Helper method to find and configure targets
    public void FindAndAddTargets()
    {
        MultiTargetCamera multiTargetCamera = FindObjectOfType<MultiTargetCamera>();
        if (multiTargetCamera == null)
        {
            Debug.LogError("No MultiTargetCamera found!");
            return;
        }

        // Find robot
        CharacterMove robot = FindObjectOfType<CharacterMove>();
        if (robot != null)
        {
            multiTargetCamera.AddTarget(robot.transform);
            Debug.Log("Added robot as camera target.");
        }

        // Find apple clusters
        AppleCluster[] appleClusters = FindObjectsOfType<AppleCluster>();
        foreach (AppleCluster cluster in appleClusters)
        {
            multiTargetCamera.AddTarget(cluster.transform);
        }
        Debug.Log($"Added {appleClusters.Length} apple clusters as camera targets.");

        // Find other important objects (you can customize this)
        GameObject[] importantObjects = GameObject.FindGameObjectsWithTag("Important");
        foreach (GameObject obj in importantObjects)
        {
            multiTargetCamera.AddTarget(obj.transform);
        }
        Debug.Log($"Added {importantObjects.Length} important objects as camera targets.");
    }

    [ContextMenu("Find and Add Targets")]
    public void FindAndAddTargetsManual()
    {
        FindAndAddTargets();
    }
}

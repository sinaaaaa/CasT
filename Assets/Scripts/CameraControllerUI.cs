using UnityEngine;
using UnityEngine.UI;
using TMPro;

public class CameraControllerUI : MonoBehaviour
{
    [Header("Camera Reference")]
    public MultiTargetCamera multiTargetCamera;
    
    [Header("UI Elements")]
    public Button topDownButton;
    public Button isometricButton;
    public Button followButton;
    public Button strategicButton;
    public Button resetButton;
    
    [Header("Mode Display")]
    public TextMeshProUGUI currentModeText;
    public TextMeshProUGUI controlsText;
    
    [Header("Control Toggles")]
    public Toggle mouseZoomToggle;
    public Toggle mousePanToggle;
    
    private void Start()
    {
        // Find camera if not assigned
        if (multiTargetCamera == null)
        {
            multiTargetCamera = FindObjectOfType<MultiTargetCamera>();
        }
        
        // Setup button listeners
        if (topDownButton != null)
            topDownButton.onClick.AddListener(() => SetCameraMode(MultiTargetCamera.CameraMode.TopDown));
        
        if (isometricButton != null)
            isometricButton.onClick.AddListener(() => SetCameraMode(MultiTargetCamera.CameraMode.Isometric));
        
        if (followButton != null)
            followButton.onClick.AddListener(() => SetCameraMode(MultiTargetCamera.CameraMode.Follow));
        
        if (strategicButton != null)
            strategicButton.onClick.AddListener(() => SetCameraMode(MultiTargetCamera.CameraMode.Strategic));
        
        if (resetButton != null)
            resetButton.onClick.AddListener(ResetCamera);
        
        // Setup toggles
        if (mouseZoomToggle != null)
        {
            mouseZoomToggle.isOn = multiTargetCamera.enableMouseZoom;
            mouseZoomToggle.onValueChanged.AddListener(SetMouseZoom);
        }
        
        if (mousePanToggle != null)
        {
            mousePanToggle.isOn = multiTargetCamera.enableMousePan;
            mousePanToggle.onValueChanged.AddListener(SetMousePan);
        }
        
        // Update UI
        UpdateModeDisplay();
    }
    
    private void Update()
    {
        // Update mode display
        UpdateModeDisplay();
        
        // Handle keyboard shortcuts
        HandleKeyboardShortcuts();
    }
    
    void HandleKeyboardShortcuts()
    {
        if (Input.GetKeyDown(KeyCode.Alpha1))
            SetCameraMode(MultiTargetCamera.CameraMode.TopDown);
        else if (Input.GetKeyDown(KeyCode.Alpha2))
            SetCameraMode(MultiTargetCamera.CameraMode.Isometric);
        else if (Input.GetKeyDown(KeyCode.Alpha3))
            SetCameraMode(MultiTargetCamera.CameraMode.Follow);
        else if (Input.GetKeyDown(KeyCode.Alpha4))
            SetCameraMode(MultiTargetCamera.CameraMode.Strategic);
        else if (Input.GetKeyDown(KeyCode.Alpha5))
            SetCameraMode(MultiTargetCamera.CameraMode.ChessCorner);
        else if (Input.GetKeyDown(KeyCode.R))
            ResetCamera();
    }
    
    void SetCameraMode(MultiTargetCamera.CameraMode mode)
    {
        if (multiTargetCamera != null)
        {
            multiTargetCamera.SetCameraMode(mode);
            UpdateModeDisplay();
        }
    }
    
    void ResetCamera()
    {
        if (multiTargetCamera != null)
        {
            multiTargetCamera.ResetCameraToGrid();
        }
    }
    
    void SetMouseZoom(bool enabled)
    {
        if (multiTargetCamera != null)
        {
            multiTargetCamera.enableMouseZoom = enabled;
        }
    }
    
    void SetMousePan(bool enabled)
    {
        if (multiTargetCamera != null)
        {
            multiTargetCamera.enableMousePan = enabled;
        }
    }
    
    void UpdateModeDisplay()
    {
        if (multiTargetCamera != null && currentModeText != null)
        {
            string modeName = multiTargetCamera.currentMode.ToString();
            currentModeText.text = $"Camera Mode: {modeName}";
            
            // Update button colors to show active mode
            UpdateButtonColors();
        }
        
        if (controlsText != null)
        {
            controlsText.text = GetControlsText();
        }
    }
    
    void UpdateButtonColors()
    {
        Color activeColor = Color.green;
        Color normalColor = Color.white;
        
        if (topDownButton != null)
            topDownButton.GetComponent<Image>().color = 
                multiTargetCamera.currentMode == MultiTargetCamera.CameraMode.TopDown ? activeColor : normalColor;
        
        if (isometricButton != null)
            isometricButton.GetComponent<Image>().color = 
                multiTargetCamera.currentMode == MultiTargetCamera.CameraMode.Isometric ? activeColor : normalColor;
        
        if (followButton != null)
            followButton.GetComponent<Image>().color = 
                multiTargetCamera.currentMode == MultiTargetCamera.CameraMode.Follow ? activeColor : normalColor;
        
        if (strategicButton != null)
            strategicButton.GetComponent<Image>().color = 
                multiTargetCamera.currentMode == MultiTargetCamera.CameraMode.Strategic ? activeColor : normalColor;
    }
    
    string GetControlsText()
    {
        return @"Watch & build
• When you press Play, the camera moves to help you see the robot act out each block.
• Code blocks stay on the bottom — you see the grid and the program at the same time.

Camera
• 1–4: Change view (top / isometric / follow / overview)
• 5: Chess-style 3D corner view
• R: Reset camera
• Mouse wheel: Zoom in or out
• Two fingers: Pinch to zoom (tablet / phone)
• Right-drag or WASD: Pan (optional)

Tip: Use Follow or Top view while building, then press Play — the camera can switch for you.";
    }
    
    // Public methods for external control
    public void SetTopDownMode() => SetCameraMode(MultiTargetCamera.CameraMode.TopDown);
    public void SetIsometricMode() => SetCameraMode(MultiTargetCamera.CameraMode.Isometric);
    public void SetFollowMode() => SetCameraMode(MultiTargetCamera.CameraMode.Follow);
    public void SetStrategicMode() => SetCameraMode(MultiTargetCamera.CameraMode.Strategic);
    public void SetChessCornerMode() => SetCameraMode(MultiTargetCamera.CameraMode.ChessCorner);
}

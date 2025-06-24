using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System.Collections;
using System.Collections.Generic;
using UnityEngine.SceneManagement;
using CharacterActions; // Add this to use MoveAction and RotateAction

public class TutorialManager : MonoBehaviour
{
    [Header("Robot & UI")]
    public GameObject robot; // Assign your robot GameObject here
    public Button forwardButton;
    public Button backwardButton;
    public Button turnLeftButton;
    public Button turnRightButton;
    public Button runButton;
    public TextMeshProUGUI instructionText;
    public GameObject targetMarker; // Optional: a marker to show the target position
    public Button skipButton; // Assign in Inspector
    public string mainMenuSceneName = "MainMenu"; // Set to your main menu scene name

    [Header("Movement Settings")]
    public float moveDistance = 1f;
    public float moveDuration = 0.5f;
    public float rotationAngle = 90f;

    private int tutorialStep = 0;
    private bool isMoving = false;

    // Store original button colors
    private ColorBlock forwardOriginal, backwardOriginal, leftOriginal, rightOriginal, runOriginal;
    public Color highlightColor = Color.white; // Or any color you want

    private Coroutine highlightCoroutine = null;
    private Coroutine runHighlightCoroutine = null; // Track Run button animation
    private Button currentlyHighlightedButton = null;
    private bool buttonClickedDuringAnimation = false;

    // Audio for instructions and celebration
    [Header("Audio")]
    public AudioClip introAudio; // Introduction story audio
    public AudioClip forwardAudio;
    public AudioClip backwardAudio;
    public AudioClip turnRightAudio;
    public AudioClip turnLeftAudio;
    public AudioClip celebrationAudio;
    public AudioClip tapRunButtonAudio; // Audio to say "Tap Play Button"
    private AudioSource audioSource;

    // For celebration animation
    public GameObject confettiPrefab; // (Optional) Assign a confetti prefab in the Inspector

    // For sequence planning (queue of actions to run on Run button)
    private List<CharacterAction> plannedActions = new List<CharacterAction>();
    
    // Get reference to robot's movement component
    private CharacterMove robotCharacterMove;
    private Level1 robotLevel1;

    private Animator animator;

    [Header("Tutorial Complete Popup")]
    public GameObject tutorialCompletePopup; // Assign in Inspector
    public AudioClip goodJobAudio; // Assign in Inspector

    private Dictionary<Button, Vector3> buttonOriginalScales = new Dictionary<Button, Vector3>();

    [Header("Robot Popup UI")]
    public GameObject robotPopupPanel; // Assign in Inspector
    public Image robotPopupImage;      // Assign in Inspector (robot sprite)
    public TextMeshProUGUI robotPopupText; // Assign in Inspector (speech text)
    public GameObject robotPopup3D;    // The 3D robot model for the popup
    public Camera robotPopupCamera;    // The camera rendering the robot to the popup

    void Start()
    {
        // Clear any planned actions from previous runs
        plannedActions.Clear();
        Debug.Log("[Tutorial] Initialized with cleared planned actions");
        
        // Store original colors
        forwardOriginal = forwardButton.colors;
        backwardOriginal = backwardButton.colors;
        leftOriginal = turnLeftButton.colors;
        rightOriginal = turnRightButton.colors;
        runOriginal = runButton.colors;

        // Add and configure AudioSource
        audioSource = gameObject.AddComponent<AudioSource>();
        audioSource.playOnAwake = false;

        // Get reference to robot's movement component
        if (robot != null)
        {
            // Try to get CharacterMove component first, then Level1 as fallback
            robotCharacterMove = robot.GetComponent<CharacterMove>();
            robotLevel1 = robot.GetComponent<Level1>();
            animator = robot.GetComponent<Animator>();
        }

        SetAllButtonsInteractable(false);
        // Show introduction text and play intro audio
        instructionText.text = "This is Robo! Help Robo to move";
        StartCoroutine(PlayIntroAndStartTutorial());

        forwardButton.onClick.AddListener(OnForwardPressed);
        backwardButton.onClick.AddListener(OnBackwardPressed);
        turnLeftButton.onClick.AddListener(OnTurnLeftPressed);
        turnRightButton.onClick.AddListener(OnTurnRightPressed);
        runButton.onClick.AddListener(OnRunPressed);

        if (targetMarker != null)
            targetMarker.SetActive(false);

        if (skipButton != null)
            skipButton.onClick.AddListener(OnSkipButtonPressed);

        if (tutorialCompletePopup != null)
            tutorialCompletePopup.SetActive(false);

        // (Editor) Suggestion: Set button size and icon in the Unity Editor for large, clear buttons

        buttonOriginalScales[forwardButton] = forwardButton.transform.localScale;
        buttonOriginalScales[backwardButton] = backwardButton.transform.localScale;
        buttonOriginalScales[turnLeftButton] = turnLeftButton.transform.localScale;
        buttonOriginalScales[turnRightButton] = turnRightButton.transform.localScale;
        buttonOriginalScales[runButton] = runButton.transform.localScale;
    }

    void SetAllButtonsInteractable(bool state)
    {
        forwardButton.interactable = state;
        backwardButton.interactable = state;
        turnLeftButton.interactable = state;
        turnRightButton.interactable = state;
        runButton.interactable = state;
    }

    void HighlightButton(Button button)
    {
        ResetAllButtonHighlights();

        currentlyHighlightedButton = button;
        if (highlightCoroutine != null)
            StopCoroutine(highlightCoroutine);
        highlightCoroutine = StartCoroutine(PulseButtonColor(button));

        // Enable outline for the highlighted button
        var outline = button.GetComponent<Outline>();
        if (outline != null)
            outline.enabled = true;
    }

    void ResetAllButtonHighlights()
    {
        // Reset all button colors
        forwardButton.colors = forwardOriginal;
        backwardButton.colors = backwardOriginal;
        turnLeftButton.colors = leftOriginal;
        turnRightButton.colors = rightOriginal;
        runButton.colors = runOriginal;

        // Reset all button images to original color
        ResetButtonImageColor(forwardButton);
        ResetButtonImageColor(backwardButton);
        ResetButtonImageColor(turnLeftButton);
        ResetButtonImageColor(turnRightButton);
        ResetButtonImageColor(runButton);

        if (highlightCoroutine != null)
            StopCoroutine(highlightCoroutine);
        highlightCoroutine = null;
        currentlyHighlightedButton = null;
    }

    void ResetButtonImageColor(Button button)
    {
        var img = button.GetComponent<Image>();
        if (img != null)
            img.color = Color.white; // or your default

        var outline = button.GetComponent<Outline>();
        if (outline != null)
            outline.enabled = false;
    }

    IEnumerator PulseButtonColor(Button button)
    {
        var img = button.GetComponent<Image>();
        if (img == null)
            yield break;

        Color baseColor = Color.white; // or your button's default color
        Color pulseColor = highlightColor; // set in Inspector, e.g. Color.yellow or Color.cyan

        float pulseSpeed = 2f;
        float t = 0f;
        while (true)
        {
            t += Time.deltaTime * pulseSpeed;
            float lerp = (Mathf.Sin(t) + 1f) / 2f; // oscillates between 0 and 1
            img.color = Color.Lerp(baseColor, pulseColor, lerp);

            // Force the color even if hovered/pressed
            button.targetGraphic.color = img.color;

            yield return null;
        }
    }

    // Play the audio clip for the current instruction
    void PlayInstructionAudio(AudioClip clip)
    {
        if (clip != null && audioSource != null)
        {
            audioSource.Stop();
            audioSource.clip = clip;
            audioSource.Play();
        }
    }

    // Coroutine to play intro audio, then start the first step
    IEnumerator PlayIntroAndStartTutorial()
    {
        // Show robot popup
        if (robotPopupPanel != null) robotPopupPanel.SetActive(true);
        if (robotPopup3D != null) robotPopup3D.SetActive(true);
        if (robotPopupCamera != null) robotPopupCamera.enabled = true;
        if (robotPopupText != null) robotPopupText.text = "Hello! I'm Robo. Let's learn how to get the apple!";

        PlayInstructionAudio(introAudio);
        if (introAudio != null)
            yield return new WaitForSeconds(introAudio.length + 0.2f);

        // Hide robot popup
        if (robotPopupPanel != null) robotPopupPanel.SetActive(false);
        if (robotPopup3D != null) robotPopup3D.SetActive(false);
        if (robotPopupCamera != null) robotPopupCamera.enabled = false;

        // Start first instruction
        instructionText.text = "Tap Forward!";
        PlayInstructionAudio(forwardAudio);
        StartCoroutine(AnimateAndEnableButton(forwardButton));
        tutorialStep = 0;
    }

    void OnForwardPressed()
    {
        if (isMoving) return;
        
        Debug.Log($"[Tutorial] Forward button pressed - tutorialStep: {tutorialStep}");
        Debug.Log($"[Tutorial] Forward button currentlyHighlighted: {currentlyHighlightedButton == forwardButton}");
        Debug.Log($"[Tutorial] Forward button highlightCoroutine running: {highlightCoroutine != null}");
        Debug.Log($"[Tutorial] Planned actions before clear: {plannedActions.Count}");
        
        // Stop animation if this button is currently highlighted
        if (highlightCoroutine != null && currentlyHighlightedButton == forwardButton)
        {
            Debug.Log("[Tutorial] Stopping Forward button animation");
            StopCoroutine(highlightCoroutine);
            highlightCoroutine = null;
            currentlyHighlightedButton = null;
        }
        
        // Always reset Forward button visual state
        ResetButtonToNormal(forwardButton);
        Debug.Log("[Tutorial] Forward button visual reset complete");
        
        // Always queue action and enable Run button for valid steps
        if (tutorialStep == 0 || tutorialStep == 4)
        {
            // Clear any existing planned actions first
            plannedActions.Clear();
            Debug.Log("[Tutorial] Cleared existing planned actions");
            
            plannedActions.Add(new MoveAction(Vector3.forward));
            Debug.Log($"[Tutorial] Added Forward action. Planned actions count: {plannedActions.Count}");
            instructionText.text = "Now tap the Play button!";
            
            // Stop any existing Run button animation
            if (runHighlightCoroutine != null)
            {
                StopCoroutine(runHighlightCoroutine);
                runHighlightCoroutine = null;
            }
            
            // Immediately make Run button clickable and visible
            SetAllButtonsInteractable(false);
            runButton.interactable = true;
            runButton.gameObject.SetActive(true); // Ensure it's visible

            // Reset Run button visual state first
            ResetButtonToNormal(runButton);

            // Animate the Run button the first time it becomes visible (only for tutorialStep == 0)
            if (tutorialStep == 0)
            {
                StartCoroutine(AnimateAndEnableButton(runButton));
            }
            else
            {
                // Then highlight it (for other steps)
                HighlightButton(runButton);
                // Start Run button animation
                runHighlightCoroutine = StartCoroutine(PulseButtonColor(runButton));
            }
            
            Debug.Log($"[Tutorial] Run button state - interactable: {runButton.interactable}, active: {runButton.gameObject.activeSelf}");
            
            // Play audio
            PlayInstructionAudio(forwardAudio);
            PlayInstructionAudio(tapRunButtonAudio);
            
            Debug.Log("[Tutorial] Forward action queued, Run button enabled and animated");
        }
        else
        {
            Debug.Log($"[Tutorial] Forward button pressed but not valid for step {tutorialStep}");
        }
    }

    void OnBackwardPressed()
    {
        if (isMoving) return;
        
        Debug.Log("[Tutorial] Backward button pressed");
        Debug.Log($"[Tutorial] Planned actions before clear: {plannedActions.Count}");
        
        // Stop animation if this button is currently highlighted
        if (highlightCoroutine != null && currentlyHighlightedButton == backwardButton)
        {
            StopCoroutine(highlightCoroutine);
            highlightCoroutine = null;
            ResetButtonToNormal(backwardButton);
            Debug.Log("[Tutorial] Stopped Backward button animation");
        }
        
        // Always queue action and enable Run button for valid steps
        if (tutorialStep == 1 || tutorialStep == 4)
        {
            // Clear any existing planned actions first
            plannedActions.Clear();
            Debug.Log("[Tutorial] Cleared existing planned actions");
            
            plannedActions.Add(new MoveAction(-Vector3.forward));
            Debug.Log($"[Tutorial] Added Backward action. Planned actions count: {plannedActions.Count}");
            instructionText.text = "Now tap the Play button!";
            
            // Immediately make Run button clickable
            SetAllButtonsInteractable(false);
            runButton.interactable = true;
            HighlightButton(runButton);
            
            // Play audio
            PlayInstructionAudio(backwardAudio);
            PlayInstructionAudio(tapRunButtonAudio);
            
            Debug.Log("[Tutorial] Backward action queued, Run button enabled");
        }
    }

    void OnTurnLeftPressed()
    {
        if (isMoving) return;
        
        Debug.Log("[Tutorial] Turn Left button pressed");
        Debug.Log($"[Tutorial] Planned actions before clear: {plannedActions.Count}");
        
        // Stop animation if this button is currently highlighted
        if (highlightCoroutine != null && currentlyHighlightedButton == turnLeftButton)
        {
            StopCoroutine(highlightCoroutine);
            highlightCoroutine = null;
            ResetButtonToNormal(turnLeftButton);
            Debug.Log("[Tutorial] Stopped Turn Left button animation");
        }
        
        // Always queue action and enable Run button for valid steps
        if (tutorialStep == 3 || tutorialStep == 4)
        {
            // Clear any existing planned actions first
            plannedActions.Clear();
            Debug.Log("[Tutorial] Cleared existing planned actions");
            
            plannedActions.Add(new RotateAction(-rotationAngle));
            Debug.Log($"[Tutorial] Added Turn Left action. Planned actions count: {plannedActions.Count}");
            instructionText.text = "Now tap the Play button!";
            
            // Immediately make Run button clickable
            SetAllButtonsInteractable(false);
            runButton.interactable = true;
            HighlightButton(runButton);
            
            // Play audio
            PlayInstructionAudio(turnLeftAudio);
            PlayInstructionAudio(tapRunButtonAudio);
            
            Debug.Log("[Tutorial] Turn Left action queued, Run button enabled");
        }
    }

    void OnTurnRightPressed()
    {
        if (isMoving) return;
        
        Debug.Log("[Tutorial] Turn Right button pressed");
        Debug.Log($"[Tutorial] Planned actions before clear: {plannedActions.Count}");
        
        // Stop animation if this button is currently highlighted
        if (highlightCoroutine != null && currentlyHighlightedButton == turnRightButton)
        {
            StopCoroutine(highlightCoroutine);
            highlightCoroutine = null;
            ResetButtonToNormal(turnRightButton);
            Debug.Log("[Tutorial] Stopped Turn Right button animation");
        }
        
        // Always queue action and enable Run button for valid steps
        if (tutorialStep == 2 || tutorialStep == 4)
        {
            // Clear any existing planned actions first
            plannedActions.Clear();
            Debug.Log("[Tutorial] Cleared existing planned actions");
            
            plannedActions.Add(new RotateAction(rotationAngle));
            Debug.Log($"[Tutorial] Added Turn Right action. Planned actions count: {plannedActions.Count}");
            instructionText.text = "Now tap the Play button!";
            
            // Immediately make Run button clickable
            SetAllButtonsInteractable(false);
            runButton.interactable = true;
            HighlightButton(runButton);
            
            // Play audio
            PlayInstructionAudio(turnRightAudio);
            PlayInstructionAudio(tapRunButtonAudio);
            
            Debug.Log("[Tutorial] Turn Right action queued, Run button enabled");
        }
    }

    void OnRunPressed()
    {
        Debug.Log("[Tutorial] OnRunPressed called!");
        Debug.Log($"[Tutorial] Run button interactable: {runButton.interactable}");
        Debug.Log($"[Tutorial] Planned actions count: {plannedActions.Count}");
        Debug.Log($"[Tutorial] Is moving: {isMoving}");
        
        if (highlightCoroutine != null && currentlyHighlightedButton == runButton)
        {
            buttonClickedDuringAnimation = true;
            StopCoroutine(highlightCoroutine);
            highlightCoroutine = null;
        }
        if (runHighlightCoroutine != null)
        {
            StopCoroutine(runHighlightCoroutine);
            runHighlightCoroutine = null;
        }
        if (plannedActions.Count > 0 && !isMoving)
        {
            Debug.Log("[Tutorial] Executing planned actions...");
            SetAllButtonsInteractable(false);
            ResetAllButtonHighlights(); // Stop highlighting run button
            instructionText.text = "Watch Robo move!";
            StartCoroutine(ExecutePlannedActionsAndProgress());
        }
        else
        {
            Debug.Log("[Tutorial] Cannot execute - either no actions or robot is moving");
        }
    }

    // Animate and highlight specifically the run button
    IEnumerator AnimateAndEnableRunButton()
    {
        Debug.Log("[Tutorial] AnimateAndEnableRunButton called");
        
        // Stop any current highlight animation for Run button
        if (runHighlightCoroutine != null)
        {
            StopCoroutine(runHighlightCoroutine);
            runHighlightCoroutine = null;
        }
        
        // Stop any other button highlights
        ResetAllButtonHighlights();
        
        // Immediately make ONLY Run button interactable
        SetOnlyButtonInteractable(runButton);
        HighlightButton(runButton);
        
        Debug.Log($"[Tutorial] Run button interactable: {runButton.interactable}");
        Debug.Log($"[Tutorial] Forward button interactable: {forwardButton.interactable}");
        Debug.Log($"[Tutorial] Run button raycastTarget: {runButton.GetComponent<Image>()?.raycastTarget}");
        Debug.Log($"[Tutorial] Run button activeAndEnabled: {runButton.isActiveAndEnabled}");
        Debug.Log($"[Tutorial] All buttons state set");
        
        // Play audio instruction to tap run button
        PlayInstructionAudio(tapRunButtonAudio);
        
        // Start the highlight animation for Run button
        runHighlightCoroutine = StartCoroutine(PulseButtonColor(runButton));
        
        yield return null;
    }

    // Execute planned actions and progress to next tutorial step
    IEnumerator ExecutePlannedActionsAndProgress()
    {
        foreach (var action in plannedActions)
        {
            yield return StartCoroutine(ExecuteAction(action));
            yield return new WaitForSeconds(0.1f);
        }
        plannedActions.Clear();

        // Progress to next step based on current tutorial step
        if (tutorialStep == 0) // After Forward
        {
            instructionText.text = "Tap Back!";
            PlayInstructionAudio(backwardAudio);
            StartCoroutine(AnimateAndEnableButton(backwardButton));
            tutorialStep = 1;
        }
        else if (tutorialStep == 1) // After Backward
        {
            instructionText.text = "Turn Right!";
            PlayInstructionAudio(turnRightAudio);
            StartCoroutine(AnimateAndEnableButton(turnRightButton));
            tutorialStep = 2;
        }
        else if (tutorialStep == 2) // After Turn Right
        {
            instructionText.text = "Turn Left!";
            PlayInstructionAudio(turnLeftAudio);
            StartCoroutine(AnimateAndEnableButton(turnLeftButton));
            tutorialStep = 3;
        }
        else if (tutorialStep == 3) // After Turn Left
        {
            // Show the tutorial complete popup and play good job sound
            ShowTutorialCompletePopup();
            tutorialStep = 4;
        }
        else if (tutorialStep == 4) // Free planning mode (if you want to allow it)
        {
            SetAllButtonsInteractable(true);
            instructionText.text = "Plan again or try more moves!";
            StartCoroutine(AnimateAndEnableButton(forwardButton));
        }
    }

    // Execute a single action using the robot's movement system
    IEnumerator ExecuteAction(CharacterAction action)
    {
        if (robotCharacterMove != null)
        {
            // Execute the action using the CharacterMove component
            yield return StartCoroutine(action.Execute(robotCharacterMove));
        }
        else if (robotLevel1 != null)
        {
            // Use the new Execute(Level1) method
            yield return StartCoroutine(action.Execute(robotLevel1));
        }
        else
        {
            // Fallback: use the simple movement methods if no movement component found
            if (action is MoveAction moveAction)
            {
                yield return StartCoroutine(MoveRobot(moveAction.Direction));
            }
            else if (action is RotateAction rotateAction)
            {
                yield return StartCoroutine(RotateRobot(rotateAction.Angle));
            }
        }
    }

    // Simple fallback movement methods (used if no movement component found)
    IEnumerator MoveRobot(Vector3 direction)
    {
        isMoving = true;
        if (animator != null)
            animator.SetBool("isWalking", true);

        // Move in the direction relative to the robot's current rotation, like CharacterMove
        Vector3 adjustedDirection = Quaternion.Euler(0, robot.transform.eulerAngles.y, 0) * direction * moveDistance;
        Vector3 start = robot.transform.position;
        Vector3 end = start + adjustedDirection;

        float elapsed = 0f;
        while (elapsed < moveDuration)
        {
            robot.transform.position = Vector3.Lerp(start, end, elapsed / moveDuration);
            elapsed += Time.deltaTime;
            yield return null;
        }
        robot.transform.position = end;

        if (animator != null)
            animator.SetBool("isWalking", false);

        isMoving = false;
    }

    IEnumerator RotateRobot(float angle)
    {
        isMoving = true;
        Quaternion startRot = robot.transform.rotation;
        Quaternion endRot = startRot * Quaternion.Euler(0, angle, 0);
        float elapsed = 0f;
        while (elapsed < moveDuration)
        {
            robot.transform.rotation = Quaternion.Slerp(startRot, endRot, elapsed / moveDuration);
            elapsed += Time.deltaTime;
            yield return null;
        }
        robot.transform.rotation = endRot;
        isMoving = false;
    }

    // Helper to set only one button interactable at a time
    void SetOnlyButtonInteractable(Button button)
    {
        forwardButton.interactable = (button == forwardButton);
        backwardButton.interactable = (button == backwardButton);
        turnLeftButton.interactable = (button == turnLeftButton);
        turnRightButton.interactable = (button == turnRightButton);
        runButton.interactable = (button == runButton);
    }

    // Coroutine to animate (smoothly fade) the outline and bounce the button, then enable it for pressing
    IEnumerator AnimateAndEnableButton(Button button, float duration = 1.5f)
    {
        SetAllButtonsInteractable(false);
        // Ensure button starts at its normal scale before any animation
        Vector3 baseScale = buttonOriginalScales.ContainsKey(button) ? buttonOriginalScales[button] : Vector3.one;
        button.transform.localScale = baseScale;

        HighlightButton(button); // This might call ResetAllButtonHighlights, which calls ResetButtonToNormal, which sets scale to one.

        var outline = button.GetComponent<Outline>();
        if (outline == null)
            outline = button.gameObject.AddComponent<Outline>();
        outline.enabled = true;
        Color baseOutlineColor = outline.effectColor;
        Color highlightOutlineColor = highlightColor;
        highlightOutlineColor.a = 1f;
        baseOutlineColor.a = 0f;
        float elapsed = 0f;
        float pulseSpeed = 2f;
        float bounceSpeed = 2.5f;
        // Vector3 originalScale = button.transform.localScale; // We now use baseScale (Vector3.one)
        SetOnlyButtonInteractable(button);
        buttonClickedDuringAnimation = false;

        try // Use try-finally to ensure scale is reset
        {
            while (elapsed < duration)
            {
                if (buttonClickedDuringAnimation)
                {
                    // Scale is reset in the finally block
                    break;
                }
                float t = elapsed * pulseSpeed;
                float lerp = (Mathf.Sin(t) + 1f) / 2f;
                outline.effectColor = Color.Lerp(baseOutlineColor, highlightOutlineColor, lerp);
                float bounceValue = 1f + 0.08f * Mathf.Sin(elapsed * bounceSpeed * Mathf.PI * 2f);
                button.transform.localScale = baseScale * bounceValue;
                elapsed += Time.deltaTime;
                yield return null;
            }
            outline.effectColor = highlightOutlineColor;
        }
        finally
        {
            button.transform.localScale = buttonOriginalScales.ContainsKey(button) ? buttonOriginalScales[button] : Vector3.one;
            // If loop completed naturally (not interrupted by click), and we still want it highlighted:
            if (!buttonClickedDuringAnimation)
            {
                SetOnlyButtonInteractable(button); // Re-enable if it wasn't clicked
                HighlightButton(button); // Keep it highlighted if animation finished naturally
            }
            else
            {
                // If it was clicked, ResetButtonToNormal would have been called by the click handler.
                // However, an explicit reset here after stopping the coroutine is safer.
                ResetButtonToNormal(button); 
            }
        }
    }

    // Helper coroutine: move, then animate and enable next button, then show next instruction
    IEnumerator ShowMoveAndNext(Vector3 direction, string nextInstruction, Button nextButton, int nextStep)
    {
        yield return StartCoroutine(MoveRobot(direction));
        SetAllButtonsInteractable(false);
        // Reset the previously highlighted button to normal color
        if (currentlyHighlightedButton != null)
            ResetButtonImageColor(currentlyHighlightedButton);
        instructionText.text = nextInstruction;
        yield return StartCoroutine(AnimateAndEnableButton(nextButton));
        tutorialStep = nextStep;
    }

    // Helper coroutine: rotate, then animate and enable next button, then show next instruction
    IEnumerator ShowRotateAndNext(float angle, string nextInstruction, Button nextButton, int nextStep, bool showRun = false)
    {
        yield return StartCoroutine(RotateRobot(angle));
        SetAllButtonsInteractable(false);
        // Reset the previously highlighted button to normal color
        if (currentlyHighlightedButton != null)
            ResetButtonImageColor(currentlyHighlightedButton);
        instructionText.text = nextInstruction;
        if (showRun)
        {
            turnRightButton.interactable = false;
            runButton.interactable = false;
            yield return StartCoroutine(AnimateAndEnableButton(forwardButton)); // Start with forward for sequence
            turnRightButton.interactable = true;
            runButton.interactable = true;
        }
        else
        {
            yield return StartCoroutine(AnimateAndEnableButton(nextButton));
        }
        tutorialStep = nextStep;
    }

    void Update()
    {
        if (tutorialStep == 5 && targetMarker != null)
        {
            float dist = Vector3.Distance(robot.transform.position, targetMarker.transform.position);
            if (dist < 0.5f)
            {
                instructionText.text = "Great job!";
                PlayInstructionAudio(celebrationAudio);
                SetAllButtonsInteractable(false);
                tutorialStep = 6;
                ResetAllButtonHighlights();
                // Also reset all button images to normal color
                ResetButtonImageColor(forwardButton);
                ResetButtonImageColor(backwardButton);
                ResetButtonImageColor(turnLeftButton);
                ResetButtonImageColor(turnRightButton);
                ResetButtonImageColor(runButton);
                // Celebration animation: scale up robot and spawn confetti
                StartCoroutine(CelebrationAnimation());
            }
        }
    }

    // Coroutine for celebration animation at the end
    IEnumerator CelebrationAnimation()
    {
        // Scale up robot
        Vector3 originalScale = robot.transform.localScale;
        float t = 0f;
        float duration = 1.0f;
        while (t < duration)
        {
            robot.transform.localScale = originalScale * (1.0f + 0.2f * Mathf.Sin(t * Mathf.PI));
            t += Time.deltaTime;
            yield return null;
        }
        robot.transform.localScale = originalScale;
        // Spawn confetti if prefab assigned
        if (confettiPrefab != null)
        {
            Instantiate(confettiPrefab, robot.transform.position + Vector3.up * 2f, Quaternion.identity);
        }
    }

    void OnSkipButtonPressed()
    {
        // Optionally play a sound or animation here
        SceneManager.LoadScene(mainMenuSceneName);
    }

    // Show the tutorial complete popup and play good job sound
    void ShowTutorialCompletePopup()
    {
        if (tutorialCompletePopup != null)
        {
            tutorialCompletePopup.SetActive(true);
            // Find a button in the popup and assign the OnTutorialCompleteContinue method
            Button continueBtn = tutorialCompletePopup.GetComponentInChildren<Button>();
            if (continueBtn != null)
            {
                continueBtn.onClick.RemoveAllListeners();
                continueBtn.onClick.AddListener(OnTutorialCompleteContinue);
            }
        }
        if (goodJobAudio != null && audioSource != null)
        {
            audioSource.Stop();
            audioSource.clip = goodJobAudio;
            audioSource.Play();
        }
    }

    // Handler for the popup continue button
    void OnTutorialCompleteContinue()
    {
        if (tutorialCompletePopup != null)
            tutorialCompletePopup.SetActive(false);
        SceneManager.LoadScene(mainMenuSceneName);
    }

    // Enhanced ResetButtonToNormal method
    void ResetButtonToNormal(Button button)
    {
        // Reset visual state
        button.transform.localScale = buttonOriginalScales.ContainsKey(button) ? buttonOriginalScales[button] : Vector3.one;
        
        // Reset outline
        var outline = button.GetComponent<Outline>();
        if (outline != null)
            outline.enabled = false;
        
        // Reset image color
        var img = button.GetComponent<Image>();
        if (img != null)
            img.color = Color.white;
        
        // Reset button colors to original
        if (button == forwardButton)
            button.colors = forwardOriginal;
        else if (button == backwardButton)
            button.colors = backwardOriginal;
        else if (button == turnLeftButton)
            button.colors = leftOriginal;
        else if (button == turnRightButton)
            button.colors = rightOriginal;
        else if (button == runButton)
            button.colors = runOriginal;
        
        // Force refresh button state
        button.targetGraphic.color = Color.white;
        
        Debug.Log($"[Tutorial] Reset {button.name} to normal state - scale: {button.transform.localScale}, color: {img?.color}");
    }
}
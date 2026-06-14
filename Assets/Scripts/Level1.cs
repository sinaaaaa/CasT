using UnityEngine;
using UnityEngine.UI;
using System.Collections.Generic;
using CharacterActions;
using System.Collections;
using TMPro;
using UnityEngine.Networking;
using System.Text.RegularExpressions;
using System;
using UnityEngine.EventSystems;

public class Level1 : MonoBehaviour
{
    public Button rotateLeftButton;
    public Button rotateRightButton;
    public Button moveForwardButton;
    public Button moveDownButton;
    public Button runButton;

    public GameObject actionImagePrefab;
    public Transform actionQueueTransform;
    public Sprite forwardSprite;
    public Sprite backwardSprite;
    public Sprite rotateLeftSprite;
    public Sprite rotateRightSprite;

    public float gridSize = 1f;
    public float moveDuration = 0.5f;
    public float rotationAngle = 90f;

    public GameObject footprintPrefab;
    public float footprintLifetime = 5f;

    public LayerMask gridLayer;
    public Transform actionHistoryTransform;
    public Button basketButton; // Reference to the basket button
    public GameObject successPopup;

    private bool isAtAppleCluster = false;
    private int applesAtCurrentCluster = 0;

    private Animator animator;
    private Queue<CharacterAction> actionQueue = new Queue<CharacterAction>();
    private Queue<CharacterAction> actionHistory = new Queue<CharacterAction>();
    private List<CharacterAction> actionHistoryList = new List<CharacterAction>();
    private bool isProcessing = false;
    private Vector3 footprintOffset = new Vector3(0, 0.01f, 0);

    public float collisionBackstep = 1f; // Distance to move back on collision
    private Vector3 lastSafePosition; // To store the character's last safe position

    public Text applesNeededText; // UI Text to display apples needed
    public LayerMask appleLayer;
    public TextMeshProUGUI chatGPTResponseText; // Add this field for ChatGPT responses

    private int totalApplesCollected = 0;
    private int applesNeeded = 1;

    private GameObject currentAppleClusterGameObject;

    private Coroutine currentMoveCoroutine;

    public CanvasGroup imageCanvasGroup_highlight;
    public float duration_highlight = 0.5f; // Duration of the fade
    public int repeatCount_highlight = 10; // How many times to repeat

    public ChatGPTManager chatGPTManager; // Add this field at the top with other public fields

    [Serializable]
    public class PlayerActionLogEntry {
        public string action;
        public float timestamp;
    }
    public List<PlayerActionLogEntry> actionLog = new List<PlayerActionLogEntry>();

    [Serializable]
    public class AssessmentRequest
    {
        public string student_id;
        public string level;
        public List<PlayerActionLogEntry> log;
    }

    private void Start()
    {
        lastSafePosition = transform.position;

        animator = GetComponent<Animator>();

        rotateLeftButton.onClick.AddListener(() => { LogAction("Turn Left"); EnqueueAction(new RotateAction(-rotationAngle), rotateLeftSprite); });
        rotateRightButton.onClick.AddListener(() => { LogAction("Turn Right"); EnqueueAction(new RotateAction(rotationAngle), rotateRightSprite); });
        moveForwardButton.onClick.AddListener(() => { LogAction("Forward"); EnqueueAction(new MoveAction(Vector3.forward), forwardSprite); });
        moveDownButton.onClick.AddListener(() => { LogAction("Backward"); EnqueueAction(new MoveAction(-Vector3.forward), backwardSprite); });
        runButton.onClick.AddListener(StartActionProcessing);
        basketButton.onClick.AddListener(CollectApplesAtCluster);
        basketButton.gameObject.SetActive(false); // Initially hide the button
        successPopup.SetActive(false); // Initially hide the success pop-up
        
        // Set up the success popup properly
        ConfigureSuccessPopup();

        if (PlayerPrefs.HasKey("ServerResponse"))
        {
            string jsonResponse = PlayerPrefs.GetString("ServerResponse");
            HandleServerResponse(jsonResponse);
            PlayerPrefs.DeleteKey("ServerResponse");
        }
        UpdateApplesNeededDisplay();
        StartCoroutine(FadeInAndOut(repeatCount_highlight));

        // Initialize ChatGPT response text
        if (chatGPTResponseText != null)
        {
            chatGPTResponseText.text = "Waiting for ChatGPT response...";
        }
    }
    
    private void ConfigureSuccessPopup()
    {
        // Make sure the popup has a Canvas component for proper rendering
        Canvas popupCanvas = successPopup.GetComponent<Canvas>();
        if (popupCanvas == null)
        {
            Debug.LogWarning("[Level1] Success popup doesn't have a Canvas component! Adding one...");
            popupCanvas = successPopup.AddComponent<Canvas>();
            popupCanvas.renderMode = RenderMode.ScreenSpaceOverlay;
            popupCanvas.sortingOrder = 999; // Make sure it appears on top
            
            // Add GraphicRaycaster to handle UI input
            if (successPopup.GetComponent<GraphicRaycaster>() == null)
            {
                successPopup.AddComponent<GraphicRaycaster>();
            }
        }
        
        // Create a close button if it doesn't exist or configure existing one
        Transform closeButtonTrans = successPopup.transform.Find("CloseButton");
        Button closeButton = null;
        
        if (closeButtonTrans == null)
        {
            Debug.LogWarning("[Level1] Success popup doesn't have a CloseButton! Creating one...");
            
            // Create a panel background first
            GameObject panelObj = new GameObject("Panel");
            panelObj.transform.SetParent(successPopup.transform, false);
            
            RectTransform panelRect = panelObj.AddComponent<RectTransform>();
            panelRect.anchorMin = new Vector2(0.2f, 0.2f);
            panelRect.anchorMax = new Vector2(0.8f, 0.8f);
            panelRect.offsetMin = new Vector2(0, 0);
            panelRect.offsetMax = new Vector2(0, 0);
            
            Image panelImage = panelObj.AddComponent<Image>();
            panelImage.color = new Color(0.2f, 0.2f, 0.2f, 0.9f);
            
            // Create title text
            GameObject titleObj = new GameObject("TitleText");
            titleObj.transform.SetParent(panelObj.transform, false);
            
            RectTransform titleRect = titleObj.AddComponent<RectTransform>();
            titleRect.anchorMin = new Vector2(0.1f, 0.7f);
            titleRect.anchorMax = new Vector2(0.9f, 0.9f);
            titleRect.offsetMin = new Vector2(0, 0);
            titleRect.offsetMax = new Vector2(0, 0);
            
            Text titleText = titleObj.AddComponent<Text>();
            titleText.text = "Success!";
            titleText.font = Resources.GetBuiltinResource<Font>("Arial.ttf");
            titleText.fontSize = 24;
            titleText.alignment = TextAnchor.MiddleCenter;
            titleText.color = Color.white;
            
            // Create close button
            GameObject buttonObj = new GameObject("CloseButton");
            buttonObj.transform.SetParent(panelObj.transform, false);
            
            RectTransform buttonRect = buttonObj.AddComponent<RectTransform>();
            buttonRect.anchorMin = new Vector2(0.3f, 0.2f);
            buttonRect.anchorMax = new Vector2(0.7f, 0.3f);
            buttonRect.offsetMin = new Vector2(0, 0);
            buttonRect.offsetMax = new Vector2(0, 0);
            
            Image buttonImage = buttonObj.AddComponent<Image>();
            buttonImage.color = new Color(0.2f, 0.6f, 1f, 1f);
            
            closeButton = buttonObj.AddComponent<Button>();
            ColorBlock colors = closeButton.colors;
            colors.highlightedColor = new Color(0.3f, 0.7f, 1f, 1f);
            colors.pressedColor = new Color(0.1f, 0.5f, 0.9f, 1f);
            closeButton.colors = colors;
            
            // Add text to the button
            GameObject buttonTextObj = new GameObject("Text");
            buttonTextObj.transform.SetParent(buttonObj.transform, false);
            
            RectTransform textRect = buttonTextObj.AddComponent<RectTransform>();
            textRect.anchorMin = Vector2.zero;
            textRect.anchorMax = Vector2.one;
            textRect.offsetMin = new Vector2(0, 0);
            textRect.offsetMax = new Vector2(0, 0);
            
            Text buttonText = buttonTextObj.AddComponent<Text>();
            buttonText.text = "Continue";
            buttonText.font = Resources.GetBuiltinResource<Font>("Arial.ttf");
            buttonText.fontSize = 18;
            buttonText.alignment = TextAnchor.MiddleCenter;
            buttonText.color = Color.white;
            
            closeButtonTrans = buttonObj.transform;
        }
        else
        {
            closeButton = closeButtonTrans.GetComponent<Button>();
        }
        
        // Set up the close button functionality
        if (closeButton != null)
        {
            closeButton.onClick.RemoveAllListeners();
            closeButton.onClick.AddListener(CloseSuccessPopup);
            Debug.Log("[Level1] Success popup close button configured");
        }
    }

    void Update()
    {
        // Existing code...

        // Update the last safe position if the character is moving
        if (!isProcessing && animator.GetBool("isWalking"))
        {
            lastSafePosition = transform.position;
        }
        
        // Ensure timescale is not affected when popups are showing
        if (successPopup.activeSelf && Time.timeScale != 1.0f)
        {
            Time.timeScale = 1.0f;
        }
    }

    [System.Serializable]
    public class ServerResponse
    {
        public string results;
        public string status;
    }

    public void HandleServerResponse(string jsonResponse)
    {
        Debug.Log("Received JSON: " + jsonResponse);
        ServerResponse serverResponse = JsonUtility.FromJson<ServerResponse>(jsonResponse);

        if (serverResponse.status == "success")
        {
            string[] results = serverResponse.results.Split(',');
            for (int i = 0; i < results.Length; i++)
            {
                results[i] = results[i].Trim();
            }

            foreach (var result in results)
            {
                if (result == "forward")
                {
                    EnqueueAction(new MoveAction(Vector3.forward), forwardSprite);
                }
                else if (result == "left")
                {
                    EnqueueAction(new RotateAction(-rotationAngle), rotateLeftSprite);
                }
                else if (result == "right")
                {
                    EnqueueAction(new RotateAction(rotationAngle), rotateRightSprite);
                }
                else
                {
                    Debug.LogWarning("Unknown result: " + result);
                }
            }
            StartActionProcessing();
        }
    }

    private void EnqueueAction(CharacterAction action, Sprite actionSprite)
    {
        actionQueue.Enqueue(action);
        actionHistory.Enqueue(action);
        actionHistoryList.Add(action);

        GameObject actionImageInstance = Instantiate(actionImagePrefab, actionQueueTransform);
        actionImageInstance.GetComponent<Image>().sprite = actionSprite;
        GameObject historyImageInstance = Instantiate(actionImagePrefab, actionHistoryTransform);
        historyImageInstance.GetComponent<Image>().sprite = actionSprite;
    }

    private void StartActionProcessing()
    {
        if (!isProcessing && actionQueue.Count > 0)
        {
            isProcessing = true;
            currentMoveCoroutine = StartCoroutine(ProcessActions());
        }
    }

    private IEnumerator ProcessActions()
    {
        Queue<CharacterAction> currentActions = new Queue<CharacterAction>(actionQueue);

        isProcessing = true;
        while (actionQueue.Count > 0)
        {
            var action = actionQueue.Dequeue();
            yield return action.Execute(this);
            if (actionQueueTransform.childCount > 0)
            {
                Destroy(actionQueueTransform.GetChild(0).gameObject);
            }
        }
        isProcessing = false;

        AddToActionHistory(currentActions);

        // Trigger assessment after executing all actions (run/execute button)
        string studentId = PlayerPrefs.GetString("UserId");
        Debug.Log($"[Assessment] Sending assessment after execute/run for studentId={studentId}, level=Level 1, log count={actionLog.Count}");
        StartCoroutine(SendAssessmentRequestNonBlocking(studentId, "Level 1"));
    }


    public IEnumerator RotateCoroutine(float angle)
    {
        Quaternion startRotation = transform.rotation;
        Quaternion endRotation = startRotation * Quaternion.Euler(0, angle, 0);
        transform.rotation = endRotation;
        yield return new WaitForSeconds(moveDuration);
    }

    public IEnumerator MoveCoroutine(Vector3 direction)
    {
        Vector3 adjustedDirection = Quaternion.Euler(0, transform.eulerAngles.y, 0) * direction * gridSize;
        Vector3 startPosition = transform.position;
        Vector3 endPosition = startPosition + adjustedDirection;

        float elapsedTime = 0;
        animator.SetBool("isWalking", true);

        while (elapsedTime < moveDuration)
        {
            transform.position = Vector3.Lerp(startPosition, endPosition, elapsedTime / moveDuration);
            elapsedTime += Time.deltaTime;
            yield return null;
        }

        lastSafePosition = endPosition; // Update last safe position after successful move
        transform.position = endPosition;
        animator.SetBool("isWalking", false);

        // Check for apple cluster after moving
        applesAtCurrentCluster = CheckForAppleCluster(endPosition);
        isAtAppleCluster = applesAtCurrentCluster > 0;
        basketButton.gameObject.SetActive(isAtAppleCluster);

        // Check for apples after moving
        while (elapsedTime < moveDuration)
        {
            transform.position = Vector3.Lerp(startPosition, endPosition, elapsedTime / moveDuration);
            if (Mathf.Floor(elapsedTime / (moveDuration / 2)) > Mathf.Floor((elapsedTime - Time.deltaTime) / (moveDuration / 2)))
            {
                AddFootprint();
            }
            elapsedTime += Time.deltaTime;
            yield return null;
        }

        transform.position = endPosition;
        animator.SetBool("isWalking", false);

        var gridCenter = CheckGridBelow();
        if (gridCenter.HasValue)
        {
            transform.position = gridCenter.Value;
        }
        lastSafePosition = transform.position;

    }

    private IEnumerator MoveBackCoroutine()
    {
        float elapsedTime = 0;
        Vector3 startPosition = transform.position;
        Quaternion startRotation = transform.rotation;

        while (elapsedTime < moveDuration)
        {
            transform.position = Vector3.Lerp(startPosition, lastSafePosition, elapsedTime / moveDuration);

            elapsedTime += Time.deltaTime;
            yield return null;
        }

        transform.position = lastSafePosition;

        // Reset any flags or states here if necessary
    }

    private int CheckForAppleCluster(Vector3 position)
    {
        Collider[] hitColliders = Physics.OverlapSphere(position, gridSize / 2, appleLayer);
        foreach (var hitCollider in hitColliders)
        {
            if (hitCollider.CompareTag("AppleCluster"))
            {
                // Access the parent GameObject's AppleCluster component
                AppleCluster cluster = hitCollider.transform.parent.GetComponent<AppleCluster>();
                currentAppleClusterGameObject = hitCollider.gameObject;
                Debug.Log(cluster);
                if (cluster != null)
                {
                    Debug.Log(cluster.applesInCluster);
                    return cluster.applesInCluster;

                }
                else
                {
                    Debug.Log("AppleCluster component not found on the parent object.");
                }
            }
        }
        return 0;
    }








    private void CollectApples(int apples)
    {
        totalApplesCollected += apples;
        UpdateApplesNeededDisplay();

        if (totalApplesCollected == applesNeeded)
        {
            // Trigger victory or level completion
            Debug.Log("Collected all required apples!");
        }
    }
    private void CollectApplesAtCluster()
    {
        Debug.Log("[Level1] ===== Starting Apple Collection Process =====");
        Debug.Log($"[Level1] Is at apple cluster: {isAtAppleCluster}");
        Debug.Log($"[Level1] Current apple cluster object: {(currentAppleClusterGameObject != null ? "Present" : "Null")}");
        
        if (isAtAppleCluster && currentAppleClusterGameObject != null)
        {
            AppleCluster cluster = currentAppleClusterGameObject.GetComponent<AppleCluster>();
            Debug.Log($"[Level1] AppleCluster component found: {(cluster != null ? "Yes" : "No")}");

            if (cluster != null)
            {
                int applesCollected = cluster.CollectApples();
                totalApplesCollected += applesCollected;
                Debug.Log($"[Level1] Collected {applesCollected} apples. Total: {totalApplesCollected}");

                // Update UI to show we're waiting for response
                if (chatGPTResponseText != null)
                {
                    chatGPTResponseText.text = "Sending message to ChatGPT...";
                    Debug.Log("[Level1] Updated UI to show waiting for ChatGPT response");
                }
                else
                {
                    Debug.LogWarning("[Level1] chatGPTResponseText is not assigned!");
                }

                // Create a descriptive message about collecting apples
                string message = $"The robot just collected {applesCollected} apples. " +
                               $"Total apples collected so far: {totalApplesCollected}. " +
                               $"Apples still needed: {applesNeeded - totalApplesCollected}. " +
                               "Please give a short, encouraging response about the robot's progress.";

                Debug.Log($"[Level1] Preparing to send message to ChatGPT: {message}");
                Debug.Log($"[Level1] ChatGPT Manager reference: {(chatGPTManager != null ? "Present" : "Null")}");
                
                if (chatGPTManager != null)
                {
                    Debug.Log("[Level1] Sending message to ChatGPT...");
                    chatGPTManager.SendMessage(message, (response) =>
                    {
                        Debug.Log("[Level1] ===== Received ChatGPT Callback =====");
                        Debug.Log($"[Level1] Response received: {(response != null ? "Yes" : "No")}");
                        
                        if (response != null)
                        {
                            Debug.Log($"[Level1] ChatGPT Response: {response}");
                            // Update UI with the response
                            if (chatGPTResponseText != null)
                            {
                                chatGPTResponseText.text = response;
                                Debug.Log("[Level1] Updated UI with ChatGPT response");
                            }
                            else
                            {
                                Debug.LogWarning("[Level1] chatGPTResponseText is not assigned!");
                            }
                        }
                        else
                        {
                            Debug.LogError("[Level1] Failed to get response from ChatGPT");
                            // Update UI to show error
                            if (chatGPTResponseText != null)
                            {
                                chatGPTResponseText.text = "Failed to get response from ChatGPT";
                                Debug.Log("[Level1] Updated UI to show error");
                            }
                            else
                            {
                                Debug.LogWarning("[Level1] chatGPTResponseText is not assigned!");
                            }
                        }
                        Debug.Log("[Level1] ===== ChatGPT Callback Completed =====");
                    });
                }
                else
                {
                    Debug.LogError("[Level1] ChatGPT Manager is not assigned!");
                }

                UpdateApplesNeededDisplay();
                basketButton.gameObject.SetActive(false);
                Debug.Log("[Level1] Updated UI elements after apple collection");

                if (totalApplesCollected >= applesNeeded)
                {
                    Debug.Log("[Level1] All required apples collected! Showing success popup");
                    ShowSuccessPopup();
                }

                // Send assessment in background, don't wait for it to complete
                string studentId = PlayerPrefs.GetString("UserId");
                Debug.Log($"[Assessment] Sending assessment for studentId={studentId}, level=Level 1, log count={actionLog.Count}");
                StartCoroutine(SendAssessmentRequestNonBlocking(studentId, "Level 1"));
            }
            else
            {
                Debug.LogError("[Level1] AppleCluster component not found on the current object.");
            }
        }
        else
        {
            Debug.LogWarning("[Level1] Not at an apple cluster or currentAppleClusterGameObject is null.");
        }
        
        // Final check to ensure time scale is normal
        Time.timeScale = 1.0f;
        Debug.Log("[Level1] Ensuring time scale is normal (1.0): " + Time.timeScale);
        
        Debug.Log("[Level1] ===== Apple Collection Process Completed =====");
    }

    private void UpdateApplesNeededDisplay()
    {
        applesNeededText.text = "Apples Needed: " + (applesNeeded - totalApplesCollected).ToString();
    }

    private void AddFootprint()
    {
        GameObject footprintInstance = Instantiate(footprintPrefab, transform.position + footprintOffset, Quaternion.Euler(0, transform.eulerAngles.y + 180, 0));
        Destroy(footprintInstance, footprintLifetime);
    }

    private Vector3? CheckGridBelow()
    {
        Ray ray = new Ray(transform.position + Vector3.up, Vector3.down);
        RaycastHit hit;

        if (Physics.Raycast(ray, out hit, 2f, gridLayer))
        {
            Vector3 gridCenter = hit.collider.bounds.center;
            float distanceToGridCenter = Vector3.Distance(new Vector3(gridCenter.x, transform.position.y, gridCenter.z), transform.position);
            if (distanceToGridCenter <= (gridSize / 2))
            {
                return new Vector3(gridCenter.x, transform.position.y, gridCenter.z);
            }
        }
        return null;
    }
    public Queue<CharacterAction> GetActionHistory()
    {
        return new Queue<CharacterAction>(actionHistory);
    }

    public void ClearActionHistory()
    {
        actionHistory.Clear();
        actionHistoryList.Clear();
    }
    private void AddToActionHistory(Queue<CharacterAction> currentActions)
    {
        foreach (var action in currentActions)
        {
            actionHistory.Enqueue(action);

            GameObject historyImageInstance = Instantiate(actionImagePrefab);
            historyImageInstance.GetComponent<Image>().sprite = GetSpriteForAction(action);
        }
    }
    private Sprite GetSpriteForAction(CharacterAction action)
    {
        if (action is MoveAction)
        {
            if ((action as MoveAction).Direction == Vector3.forward)
                return forwardSprite;
            else
                return backwardSprite;
        }
        else if (action is RotateAction)
        {
            if ((action as RotateAction).Angle == rotationAngle)
                return rotateRightSprite;
            else
                return rotateLeftSprite;
        }
        return null;  // default if no match, but you might want to handle this better
    }

    private void OnTriggerEnter(Collider other)
    {
        if (other.CompareTag("tree")) // Ensure trees have the tag "tree"
        {
            Debug.Log("Collided with tree");

            // Stop the current move coroutine
            if (currentMoveCoroutine != null)
            {
                StopCoroutine(currentMoveCoroutine);
            }

            // Reset movement-related states or flags
            isProcessing = false;
            animator.SetBool("isWalking", false);

            // Remove the last action image from the queue
            if (actionQueueTransform.childCount > 0)
            {
                Destroy(actionQueueTransform.GetChild(actionQueueTransform.childCount - 1).gameObject);
            }

            // Optionally, start a coroutine to smoothly move back to the last safe position and rotation
            StartCoroutine(MoveBackCoroutine());
        }
    }
    IEnumerator FadeInAndOut(int count)
    {
        while (count > 0)
        {
            // Fade out
            yield return StartCoroutine(FadeCanvasGroup(imageCanvasGroup_highlight, imageCanvasGroup_highlight.alpha, 0, duration_highlight));
            // Fade in
            yield return StartCoroutine(FadeCanvasGroup(imageCanvasGroup_highlight, imageCanvasGroup_highlight.alpha, 1, duration_highlight));
            count--;
        }
    }

    IEnumerator FadeCanvasGroup(CanvasGroup cg, float start, float end, float lerpTime = 1.0f)
    {
        float _timeStartedLerping = Time.time;
        float timeSinceStarted = Time.time - _timeStartedLerping;
        float percentageComplete = timeSinceStarted / lerpTime;

        while (true)
        {
            timeSinceStarted = Time.time - _timeStartedLerping;
            percentageComplete = timeSinceStarted / lerpTime;

            float currentValue = Mathf.Lerp(start, end, percentageComplete);

            cg.alpha = currentValue;

            if (percentageComplete >= 1) break;

            yield return new WaitForEndOfFrame();
        }
    }

    void LogAction(string actionName) {
        actionLog.Add(new PlayerActionLogEntry {
            action = actionName,
            timestamp = Time.time
        });
    }

    IEnumerator SendAssessmentRequest(string studentId, string level)
    {
        string url = "http://127.0.0.1:5000/api/ct_assessment";
        var payload = new AssessmentRequest
        {
            student_id = studentId,
            level = level,
            log = actionLog
        };
        string json = JsonUtility.ToJson(payload);
        Debug.Log("[Assessment] Payload: " + json);

        using (UnityWebRequest www = new UnityWebRequest(url, "POST"))
        {
            byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(json);
            www.uploadHandler = new UploadHandlerRaw(bodyRaw);
            www.downloadHandler = new DownloadHandlerBuffer();
            www.SetRequestHeader("Content-Type", "application/json");

            Debug.Log("[Assessment] Sending request to: " + url);
            yield return www.SendWebRequest();

            if (www.result == UnityWebRequest.Result.Success)
            {
                Debug.Log("[Assessment] Assessment received successfully!");
                Debug.Log("[Assessment] Response: " + www.downloadHandler.text);
                
                // Try to parse and save the response
                try {
                    var responseJson = JsonUtility.FromJson<AssessmentResponse>(www.downloadHandler.text);
                    Debug.Log("[Assessment] Successfully parsed assessment data");
                    
                    // Display assessment result or store it
                    if (chatGPTResponseText != null) {
                        chatGPTResponseText.text = responseJson.assessment;
                    }
                }
                catch (Exception e) {
                    Debug.LogError("[Assessment] Failed to parse assessment response: " + e.Message);
                }
            }
            else
            {
                Debug.LogError("[Assessment] Assessment request failed!");
                Debug.LogError("[Assessment] Error: " + www.error);
                Debug.LogError("[Assessment] Response Code: " + www.responseCode);
                Debug.LogError("[Assessment] Response Text: " + (www.downloadHandler != null ? www.downloadHandler.text : "No response text"));
            }
        }
    }

    // Public method to close the success popup
    public void CloseSuccessPopup()
    {
        Debug.Log("[Level1] Closing success popup");
        if (successPopup != null)
        {
            successPopup.SetActive(false);
        }
    }

    // Make sure the success popup doesn't pause the game
    private void ShowSuccessPopup()
    {
        Debug.Log("[Level1] Showing success popup without pausing the game");
        
        // Ensure time scale is normal
        Time.timeScale = 1.0f;
        
        // Force the closeButton to be active and interactable
        Transform closeButton = successPopup.transform.Find("CloseButton");
        if (closeButton != null && closeButton.GetComponent<Button>())
        {
            closeButton.GetComponent<Button>().onClick.RemoveAllListeners();
            closeButton.GetComponent<Button>().onClick.AddListener(CloseSuccessPopup);
            closeButton.gameObject.SetActive(true);
            closeButton.GetComponent<Button>().interactable = true;
        }
        
        // Make sure popup is visible and in front
        successPopup.SetActive(true);
        GameInteractionSounds.PlaySuccessPopup();
        Canvas popupCanvas = successPopup.GetComponent<Canvas>();
        if (popupCanvas != null)
        {
            popupCanvas.sortingOrder = 999; // Ensure it's on top
        }
    }
    
    // Non-blocking version of SendAssessmentRequest that won't pause the game
    IEnumerator SendAssessmentRequestNonBlocking(string studentId, string level)
    {
        string url = "http://127.0.0.1:5000/api/ct_assessment";
        var payload = new AssessmentRequest
        {
            student_id = studentId,
            level = level,
            log = actionLog
        };
        string json = JsonUtility.ToJson(payload);
        Debug.Log("[Assessment] Sending assessment payload: " + json);

        using (UnityWebRequest www = new UnityWebRequest(url, "POST"))
        {
            byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(json);
            www.uploadHandler = new UploadHandlerRaw(bodyRaw);
            www.downloadHandler = new DownloadHandlerBuffer();
            www.SetRequestHeader("Content-Type", "application/json");

            Debug.Log("[Assessment] Sending request to: " + url);
            
            // Send the request and continue immediately
            www.SendWebRequest();
            
            // Don't wait for completion here, but we'll check periodically in the background
            while (!www.isDone)
            {
                // Wait a bit before checking again
                yield return new WaitForSeconds(0.1f);
            }

            // Process the result in the background once it's done
            if (www.result == UnityWebRequest.Result.Success)
            {
                Debug.Log("[Assessment] Assessment received successfully!");
                Debug.Log("[Assessment] Response: " + www.downloadHandler.text);
                
                // Try to parse and save the response
                try {
                    var responseJson = JsonUtility.FromJson<AssessmentResponse>(www.downloadHandler.text);
                    Debug.Log("[Assessment] Successfully parsed assessment data");
                    
                    // Update UI on the main thread
                    if (chatGPTResponseText != null) {
                        // Use invoke to safely update UI from background thread
                        chatGPTResponseText.text = "Assessment complete! " + responseJson.assessment.Substring(0, Mathf.Min(50, responseJson.assessment.Length)) + "...";
                    }
                }
                catch (Exception e) {
                    Debug.LogError("[Assessment] Failed to parse assessment response: " + e.Message);
                }
            }
            else
            {
                Debug.LogError("[Assessment] Assessment request failed!");
                Debug.LogError("[Assessment] Error: " + www.error);
                Debug.LogError("[Assessment] Response Code: " + www.responseCode);
                Debug.LogError("[Assessment] Response Text: " + (www.downloadHandler != null ? www.downloadHandler.text : "No response text"));
            }
        }
    }

    [Serializable]
    public class AssessmentResponse
    {
        public string assessment;
    }
}
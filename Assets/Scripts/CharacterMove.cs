using UnityEngine;
using UnityEngine.UI;
using System.Collections.Generic;
using CharacterActions;
using System.Collections;
using UnityEngine.SceneManagement;
using TMPro;
using System.Linq;
using UnityEngine.Networking;
using UnityEngine.EventSystems; // For GraphicRaycaster
using System; // For Dictionary and Exception

// Define these classes at a level where they can be easily used for JSON serialization
[System.Serializable]
public class PlayerActionLogEntry
{
    public string action;
    public float timestamp;
}

[System.Serializable]
public class CTAssessmentRequest
{
    public string student_id;
    public string level; // This will now be more dynamic, e.g., "Level 1", "Level 2"
    public List<PlayerActionLogEntry> log;
    public string robot_position; // Format: "x,y"
    public string apple_position; // Format: "x,y"
    public List<string> unity_chatgpt_feedback_log; // New field
    public int grid_rows; // Added for dynamic grid assessment
    public int grid_cols; // Added for dynamic grid assessment

    // Level 1 Specific Data
    public int level1_starting_position_index; // 0 for (0,2), 1 for (0,5), 2 for (0,7)
    public int actions_before_run;
    public List<float> forward_press_intervals;

    // For Level Summary Assessment
    public bool is_level_summary; 
    public float level_duration_seconds;

    // NEW: Facing direction for optimal path calculation
    public int[] initial_facing;

    // --- NEW FIELDS FOR ADVANCED ASSESSMENT ---
    public int attempt_number;
    public float time_taken;
    public int hints_used;
    public int block_efficiency;
    public int min_blocks;
    public int used_blocks;
    public List<List<PlayerActionLogEntry>> previous_attempts;

    public string robot_start_position; // Format: "x,y"
    public int[] robot_start_facing;    // Format: [x, y]

    public int number_of_attempts;
    public float time_on_task;
    public int persistence_score;
    public int creativity_score;
    public List<string> error_types;
    public List<string> collaboration_events;

   
    public List<string> guidedActions = null; // Optional guided actions for fill-in-the-blank
    public string correctBlankAnswer = null; // e.g., "turn left" or "turn right"
    public List<string> blankEnabledArrows = null; // Which arrows to enable at blank
}

[System.Serializable]
public class ObstacleData
{
    public Vector2Int position;
    public string type; // "tree" or "wood"
}

[System.Serializable]
public class LevelData
{
    public string levelName;
    public List<Vector2Int> applePositions;
    public List<ObstacleData> obstacles = new List<ObstacleData>(); // NEW
    public bool isRandom = false;
    public int numRandomApples = 0; // Only used if isRandom is true
    public Vector2Int robotStartPosition = new Vector2Int(0,0); // Default start position
    public Vector2Int robotStartFacing = Vector2Int.up; // Default facing up
    public List<string> guidedActions = null; // Optional guided actions for fill-in-the-blank
    public string correctBlankAnswer = null; // e.g., "turn left" or "turn right"
    public List<string> blankEnabledArrows = null; // Which arrows to enable at blank
    // --- NEW: Apple Drag Guided Level ---
    public bool isAppleDragGuidedLevel = false; // If true, student must drag apple to correct cell
    public List<Vector2Int> allowedAppleDragPositions = null; // Optionally restrict where apple can be dragged
}

public class CharacterMove : MonoBehaviour
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
    public GameObject successPopup; // General success popup
    public TextMeshProUGUI successPopupText; // Text for the success popup message
    public Button successPopupContinueButton; // Button to proceed from success popup

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

    private int totalApplesCollectedThisSession = 0; // Renamed to avoid confusion with level-specific collection
    // private int applesNeeded = 0; // This will be dynamic based on level

    private GameObject currentAppleClusterGameObject;

    private Coroutine currentMoveCoroutine;
    [SerializeField] private GameObject appleObject; // This might become obsolete or used differently
    public SpriteRenderer spriteRenderer;
    public float fadeDuration = 1.0f; // Duration of fade
    public int repeatCount = 10; // Number of repetitions

    // Task system might be replaced or integrated with the new level system
    // [System.Serializable]
    // public class Task
    // {
    //     public List<CharacterAction> actions;
    //     public string completionMessage;
    //     public bool isCompleted = false; // Flag to indicate task completion
    // }
    // public List<Task> tasks;
    // private int currentTaskIndex = 0;

    private Coroutine fadeCoroutine;
    public AudioClip collectSound; // The sound clip to play
    private AudioSource audioSource; // AudioSource component reference
    public AudioClip footstepsround; // The sound clip to play
    private AudioSource audioSource1; // AudioSource component reference
    private Vector3 initialBasketButtonPosition; // To store the initial position of the basket button

    public ChatGPTManager chatGPTManager;
    public TextMeshProUGUI chatGPTResponseText;
    public GameObject applePrefab;
    public Transform appleParent;

    public int gridRows = 9;
    public int gridCols = 9;
    public Vector3 robotStartWorldPos; // This will be the world equivalent of (0,0) on the grid
    private Vector2Int robotGridPosition; // Current grid position of the robot
    private Vector2Int facingDirection = Vector2Int.up;
    private List<Vector2Int> currentLevelApplePositions = new List<Vector2Int>(); // Apples for the active level
    private int currentAppleTargetIndex = 0; // Index for the currentLevelApplePositions
    private List<PlayerActionLogEntry> actionLog = new List<PlayerActionLogEntry>();
    private List<string> unityFeedbackLog = new List<string>();
    private int applesCollectedThisLevel = 0;

    public TextMeshProUGUI assessmentText; // May need rethinking if assessment is per level end
    private List<string> playerActions = new List<string>();

    // New Level Management Variables
    private int currentLevel = 1;
    private const int MAX_LEVELS = 8; // Updated to 5 levels
    private List<LevelData> allLevelsData;
    private string currentUserId;
    private System.Random randomGenerator = new System.Random();
    private float levelStartTime = -1f; // To track level start time

    private List<PlayerActionLogEntry> currentAttemptActionLog = new List<PlayerActionLogEntry>();

    private HashSet<int> assessedAppleIndices = new HashSet<int>();

    private List<AssessmentResponse> level1AssessmentResults = new List<AssessmentResponse>();

    public GameObject treePrefab; // Assign in inspector
    public GameObject woodPrefab; // Assign in inspector

    // NEW: Track true starting position and facing for each attempt
    private Vector2Int attemptStartGridPos;
    private Vector2Int attemptStartFacing;

    private List<GameObject> activeObstacles = new List<GameObject>();

    // Helper method to get the desired string for actionLog
    private string GetActionLogString(CharacterAction action)
    {
        if (action is MoveAction ma)
        {
            if (ma.Direction == Vector3.forward)
                return "forward";
            else if (ma.Direction == -Vector3.forward)
                return "backward";
        }
        else if (action is RotateAction ra)
        {
            // Assuming rotationAngle is a positive value for right turn
            if (ra.Angle == rotationAngle) // User's rotateRightButton adds new RotateAction(rotationAngle)
                return "turn right";
            else if (ra.Angle == -rotationAngle) // User's rotateLeftButton adds new RotateAction(-rotationAngle)
                return "turn left";
        }
        // Fallback for any other actions or unspecified move/rotate directions
        return action.GetType().Name.ToLower();
    }

    private void InitializeLevelData()
    {
        allLevelsData = new List<LevelData>
        {
            new LevelData 
            {
                levelName = "Level 1",
                applePositions = new List<Vector2Int> { new Vector2Int(1,0)},
                robotStartPosition = new Vector2Int(3,0),
                robotStartFacing = Vector2Int.up // Default
                // guidedActions = null (free play)
            },
            new LevelData 
            {
                levelName = "Level 2",
                guidedActions = new List<string> { "forward", "forward", "forward" },
                robotStartPosition = new Vector2Int(0,0),
                robotStartFacing = Vector2Int.left,
                isAppleDragGuidedLevel = true,
                applePositions = new List<Vector2Int> { new Vector2Int(-3,0) },
            },
            new LevelData 
            {
                levelName = "Level 3",
                applePositions = new List<Vector2Int> { new Vector2Int(2,1) },
                robotStartPosition = new Vector2Int(0,2),
                guidedActions = new List<string> { "forward", "blank", "forward", "forward" },
                correctBlankAnswer = "turn left",
                robotStartFacing = Vector2Int.down, // Start facing up
                blankEnabledArrows = new List<string> { "turn left", "turn right" }, // Only enable left
            },
            new LevelData 
            {
                levelName = "Level 4",
                applePositions = new List<Vector2Int> { new Vector2Int(0,4) },
                robotStartPosition = new Vector2Int(0,7),
                robotStartFacing = Vector2Int.down, // Start facing down
                // guidedActions = null
            },
            new LevelData 
            {
                levelName = "Level 5",
                applePositions = new List<Vector2Int> { new Vector2Int(-1,0)},
                robotStartPosition = new Vector2Int(2,0),
                robotStartFacing = Vector2Int.left, // Default
                obstacles = new List<ObstacleData>
                {
                    new ObstacleData { position = new Vector2Int(2,1), type = "tree" },
                }
            },
            new LevelData 
            {
                levelName = "Level 6",
                applePositions = new List<Vector2Int> { new Vector2Int(2,0) },
                robotStartPosition = new Vector2Int(0,2),
                guidedActions = new List<string> { "forward", "forward", "blank", "forward", "forward" },
                correctBlankAnswer = "turn left",
                robotStartFacing = Vector2Int.down, // Start facing up
                obstacles = new List<ObstacleData>
                {
                    new ObstacleData { position = new Vector2Int(-1,2), type = "tree" },
                    new ObstacleData { position = new Vector2Int(1,2), type = "tree" },
                    new ObstacleData { position = new Vector2Int(-1,1), type = "tree" },
                    new ObstacleData { position = new Vector2Int(1,1), type = "tree" },
                },
                blankEnabledArrows = new List<string> { "turn left", "turn right"}, // Enable both
            },
            new LevelData 
            {
                levelName = "Level 7",
                guidedActions = new List<string> { "forward", "turn left", "forward" },
                robotStartPosition = new Vector2Int(0,2),
                robotStartFacing = Vector2Int.left,
                isAppleDragGuidedLevel = true,
                applePositions = new List<Vector2Int> { new Vector2Int(-1,1) },
            },
            new LevelData 
            {
                levelName = "Level 8",
                applePositions = new List<Vector2Int> { new Vector2Int(-1,0) },
                robotStartPosition = new Vector2Int(0,1),
                guidedActions = new List<string> { "forward", "turn right", "blank" },
                correctBlankAnswer = "forward",
                robotStartFacing = Vector2Int.down, // Start facing up
                obstacles = new List<ObstacleData>
                {
                    new ObstacleData { position = new Vector2Int(0,2), type = "tree" },
                    new ObstacleData { position = new Vector2Int(1,1), type = "tree" },
                    new ObstacleData { position = new Vector2Int(-1,1), type = "tree" },
                    new ObstacleData { position = new Vector2Int(0,2), type = "tree" },
                },
                blankEnabledArrows = new List<string> { "turn left", "turn right","forward"}, // Enable both
            },

           new LevelData 
            {
                levelName = "Level 9",
                guidedActions = new List<string> { "forward", "turn left", "forward" },
                robotStartPosition = new Vector2Int(0,0),
                robotStartFacing = Vector2Int.up,
                isAppleDragGuidedLevel = true,
                applePositions = new List<Vector2Int> { new Vector2Int(1,1) },
            },
                      new LevelData 
            {
                levelName = "Level 10",
                guidedActions = new List<string> { "forward", "turn right", "forward","forward","turn left","forward" },
                robotStartPosition = new Vector2Int(0,0),
                robotStartFacing = Vector2Int.up,
                isAppleDragGuidedLevel = true,
                applePositions = new List<Vector2Int> { new Vector2Int(-2,-2) },
            },
                        new LevelData 
            {
                levelName = "Level 11",
                applePositions = new List<Vector2Int> { new Vector2Int(-2,3) },
                robotStartPosition = new Vector2Int(1,1),
                guidedActions = new List<string> { "forward","forward","forward", "turn right", "blank","blank" },
                correctBlankAnswer = "forward",
                robotStartFacing = Vector2Int.left, // Start facing up
                obstacles = new List<ObstacleData>
                {
                    new ObstacleData { position = new Vector2Int(0,2), type = "tree" },
                    new ObstacleData { position = new Vector2Int(1,1), type = "tree" },
                    new ObstacleData { position = new Vector2Int(-1,1), type = "tree" },
                    new ObstacleData { position = new Vector2Int(0,2), type = "tree" },
                },
                blankEnabledArrows = new List<string> { "turn left", "turn right","forward"}, // Enable both
            },
            new LevelData 
            {
                levelName = "Level 12",
                applePositions = new List<Vector2Int> { new Vector2Int(-2,0)},
                robotStartPosition = new Vector2Int(0,2),
                robotStartFacing = Vector2Int.down, // Default
            },
        };
    }

    private void LoadPlayerLevel()
    {
        currentUserId = PlayerPrefs.GetString("UserId", "UnknownUser");
        currentLevel = PlayerPrefs.GetInt(currentUserId + "_currentLevel", 1);
        if (currentLevel > MAX_LEVELS) currentLevel = 1; // Reset if saved level is too high
        Debug.Log($"[CharacterMove] Loaded level {currentLevel} for user {currentUserId}");
    }

    private void SavePlayerLevel()
    {
        PlayerPrefs.SetInt(currentUserId + "_currentLevel", currentLevel);
        PlayerPrefs.Save();
        Debug.Log($"[CharacterMove] Saved level {currentLevel} for user {currentUserId}");

        // Optionally: Send to Flask server
        if (FlaskCommunication.Instance != null)
        {
            // Assuming game progress endpoint can be adapted or a new one created for level
            // For now, just logging. You might send currentLevel along with other game state.
            Debug.Log($"[CharacterMove] Flask: Would send level {currentLevel} to server for user {currentUserId}");
            // FlaskCommunication.Instance.SendGameProgress(currentUserId, $"Level_{currentLevel}_Progress", 0, "Level_Saved");
        }
    }

    private void SetupLevel(int levelNumber)
    {
        if (levelNumber < 1 || levelNumber > allLevelsData.Count)
        {
            Debug.LogError($"[CharacterMove] Invalid level number: {levelNumber}. Resetting to level 1.");
            levelNumber = 1;
            currentLevel = 1; // Ensure currentLevel is also reset
        }

        LevelData levelData = allLevelsData[levelNumber - 1];
        Debug.Log($"[CharacterMove] Setting up {levelData.levelName}");

        // Record start time when Level 1 is setup for the first time in a session or after reset
        // This condition ensures it's set at the true beginning of Level 1 for a student's playthrough.
        if (levelData.levelName == "Level 1" && currentAppleTargetIndex == 0 && applesCollectedThisLevel == 0) 
        {
            if(levelStartTime < 0f) // Only set if not already set (e.g. by a previous attempt that was reset)
            {
                levelStartTime = Time.time;
                Debug.Log($"[CharacterMove] Level 1 start time recorded: {levelStartTime}");
            }
        }

        // Ensure appleParent is active before using it
        if (appleParent != null)
        {
            appleParent.gameObject.SetActive(true);
            Debug.Log($"[CharacterMove SetupLevel] Ensured appleParent '{appleParent.name}' is active. Current state: {appleParent.gameObject.activeInHierarchy}");
        }
        else
        {
            Debug.LogError("[CharacterMove SetupLevel] CRITICAL: appleParent is NULL before trying to activate it!");
            return; // Cannot proceed without appleParent
        }

        // Clear existing apples from the scene
        for (int i = appleParent.childCount - 1; i >= 0; i--)
        {
            Destroy(appleParent.GetChild(i).gameObject);
        }
        currentLevelApplePositions.Clear();

        // Reset Action Log for the new level attempt
        actionLog.Clear();
        unityFeedbackLog.Clear();
        playerActions.Clear();
        applesCollectedThisLevel = 0;
        currentAppleTargetIndex = 0;

        // Reset robot position and orientation
        robotGridPosition = levelData.robotStartPosition;
        facingDirection = levelData.robotStartFacing;
        // Set the transform.rotation based on facingDirection
        if (facingDirection == Vector2Int.up)
            transform.rotation = Quaternion.identity;
        else if (facingDirection == Vector2Int.right)
            transform.rotation = Quaternion.Euler(0, 90, 0);
        else if (facingDirection == Vector2Int.down)
            transform.rotation = Quaternion.Euler(0, 180, 0);
        else if (facingDirection == Vector2Int.left)
            transform.rotation = Quaternion.Euler(0, 270, 0);
        transform.position = robotStartWorldPos + new Vector3(robotGridPosition.x * gridSize, 0, robotGridPosition.y * gridSize);
        lastSafePosition = transform.position;

        if (levelData.isRandom)
        {
            GenerateRandomApples(levelData.numRandomApples, levelData.robotStartPosition);
        }
        else
        {
            currentLevelApplePositions.AddRange(levelData.applePositions);
        }

        // Instantiate new apples
        for (int i = 0; i < currentLevelApplePositions.Count; i++)
        {
            InstantiateApple(currentLevelApplePositions[i], i);
        }
        // Deactivate all apples, then activate only the first one
        for (int i = 0; i < appleParent.childCount; i++)
        {
            var apple = appleParent.GetChild(i).gameObject;
            apple.SetActive(i == 0); // Only the first apple is active
        }
        // Update camera targets to include character and only the first apple
        if (multiTargetCamera != null)
        {
            multiTargetCamera.targets.Clear();
            multiTargetCamera.targets.Add(this.transform); // Character
            if (appleParent.childCount > 0 && appleParent.GetChild(0).gameObject.activeSelf)
                multiTargetCamera.targets.Add(appleParent.GetChild(0));
        }

        // Activate the first apple (Apple_0) if it exists by referencing the instantiated object directly
        if (appleParent.childCount > 0)
        {
            var firstApple = appleParent.GetChild(0);
            firstApple.gameObject.SetActive(true);
            Debug.Log($"[CharacterMove SetupLevel] Activated Apple_0 by index. Name: {firstApple.name}, activeSelf: {firstApple.gameObject.activeSelf}, activeInHierarchy: {firstApple.gameObject.activeInHierarchy}");
        }
        else
        {
            Debug.LogError("[CharacterMove SetupLevel] No apples found under appleParent after instantiation!");
        }

        UpdateApplesNeededDisplay(); // Update UI for apples needed
        chatGPTResponseText.text = $"Welcome to {levelData.levelName}! Find the apples.";
        successPopup.SetActive(false);

        assessedAppleIndices.Clear(); // Reset at the start of each level

        // Remove old obstacles
        // if (obstacleParent != null)
        // {
        //     foreach (Transform child in obstacleParent)
        //         Destroy(child.gameObject);
        // }
        // Instantiate new obstacles
        foreach (var obstacle in levelData.obstacles)
        {
            GameObject prefab = null;
            if (obstacle.type == "tree") prefab = treePrefab;
            else if (obstacle.type == "wood") prefab = woodPrefab;
            if (prefab != null)
            {
                float raycastOriginX = robotStartWorldPos.x + obstacle.position.x * gridSize;
                float raycastOriginZ = robotStartWorldPos.z + obstacle.position.y * gridSize;
                Vector3 rayOrigin = new Vector3(raycastOriginX, robotStartWorldPos.y + 1.0f, raycastOriginZ);
                Vector3 obstacleFinalWorldPos;
                RaycastHit hit;
                if (Physics.Raycast(rayOrigin, Vector3.down, out hit, 2.0f, gridLayer))
                {
                    obstacleFinalWorldPos = new Vector3(hit.collider.bounds.center.x, robotStartWorldPos.y, hit.collider.bounds.center.z);
                }
                else
                {
                    obstacleFinalWorldPos = new Vector3(raycastOriginX, robotStartWorldPos.y, raycastOriginZ);
                    Debug.LogWarning($"[CharacterMove] Obstacle at grid {obstacle.position} raycast failed. Placed arithmetically. Check gridLayer.");
                }
                obstacleFinalWorldPos.y += 0.5f; // (Optional: adjust as needed for your model base)
                GameObject obj = Instantiate(prefab, obstacleFinalWorldPos, prefab.transform.rotation);
                obj.SetActive(true);
                activeObstacles.Add(obj);
            }
        }

        // Guided actions logic
        guidedBlankIndex = -1;
        waitingForGuidedInput = false;
        userBlankChoice = null;
        blankSlotInstance = null;
        // Hide all blank buttons by default
        if (blankLeftButton != null) blankLeftButton.gameObject.SetActive(false);
        if (blankRightButton != null) blankRightButton.gameObject.SetActive(false);
        if (blankForwardButton != null) blankForwardButton.gameObject.SetActive(false);
        if (blankBackwardButton != null) blankBackwardButton.gameObject.SetActive(false);

        // --- APPLE DRAG GUIDED LEVEL LOGIC ---
        if (levelData.isAppleDragGuidedLevel)
        {
            // Pre-fill guided actions
            if (levelData.guidedActions != null && levelData.guidedActions.Count > 0)
            {
                actionQueue.Clear();
                for (int i = 0; i < levelData.guidedActions.Count; i++)
                {
                    string action = levelData.guidedActions[i];
                    if (action == "forward")
                        EnqueueAction(new MoveAction(Vector3.forward), forwardSprite);
                    else if (action == "backward")
                        EnqueueAction(new MoveAction(-Vector3.forward), backwardSprite);
                    else if (action == "turn left")
                        EnqueueAction(new RotateAction(-rotationAngle), rotateLeftSprite);
                    else if (action == "turn right")
                        EnqueueAction(new RotateAction(rotationAngle), rotateRightSprite);
                }
            }
            // Disable all movement/rotation buttons
            if (moveForwardButton != null) moveForwardButton.interactable = false;
            if (moveDownButton != null) moveDownButton.interactable = false;
            if (rotateLeftButton != null) rotateLeftButton.interactable = false;
            if (rotateRightButton != null) rotateRightButton.interactable = false;
            // Optionally, only enable Run if apple has been moved (for now, always enable)
            if (runButton != null) runButton.interactable = true;
            // Place apple at default (0,0) and allow drag
            currentLevelApplePositions.Clear();
            currentLevelApplePositions.Add(new Vector2Int(0,0));
        }
        // ... existing code ...
        if (moveForwardButton != null) moveForwardButton.interactable = true;
        if (moveDownButton != null) moveDownButton.interactable = true;
        if (runButton != null) runButton.interactable = true;
        if (wrongAnswerPopup != null) wrongAnswerPopup.SetActive(false);
        if (wrongAnswerTryAgainButton != null)
        {
            wrongAnswerTryAgainButton.onClick.RemoveAllListeners();
            wrongAnswerTryAgainButton.onClick.AddListener(() => {
                if (wrongAnswerPopup != null) wrongAnswerPopup.SetActive(false);

                // Reload the current scene to fully restart the level
                SceneManager.LoadScene(SceneManager.GetActiveScene().name);
            });
        }
        if (!levelData.isAppleDragGuidedLevel && levelData.guidedActions != null && levelData.guidedActions.Count > 0)
        {
            actionQueue.Clear();
            for (int i = 0; i < levelData.guidedActions.Count; i++)
            {
                string action = levelData.guidedActions[i];
                if (action == "forward")
                {
                    EnqueueAction(new MoveAction(Vector3.forward), forwardSprite);
                }
                else if (action == "backward")
                {
                    EnqueueAction(new MoveAction(-Vector3.forward), backwardSprite);
                }
                else if (action == "turn left")
                {
                    EnqueueAction(new RotateAction(-rotationAngle), rotateLeftSprite);
                }
                else if (action == "turn right")
                {
                    EnqueueAction(new RotateAction(rotationAngle), rotateRightSprite);
                }
                else if (action == "blank")
                {
                    blankSlotInstance = Instantiate(actionImagePrefab, actionQueueTransform);
                    var img = blankSlotInstance.GetComponent<Image>();
                    if (blankSlotSprite != null) img.sprite = blankSlotSprite;
                    img.color = Color.yellow;
                    guidedBlankIndex = i;
                    waitingForGuidedInput = true;
                    PlayWhichArrowAudio();
                    actionQueue.Enqueue(null);
                    if (blankLeftButton != null)
                    {
                        blankLeftButton.gameObject.SetActive(true);
                        blankLeftButton.onClick.RemoveAllListeners();
                        blankLeftButton.onClick.AddListener(() => OnGuidedBlankFilled("turn left"));
                        blankLeftButton.interactable = false;
                    }
                    if (blankRightButton != null)
                    {
                        blankRightButton.gameObject.SetActive(true);
                        blankRightButton.onClick.RemoveAllListeners();
                        blankRightButton.onClick.AddListener(() => OnGuidedBlankFilled("turn right"));
                        blankRightButton.interactable = false;
                    }
                    if (blankForwardButton != null)
                    {
                        blankForwardButton.gameObject.SetActive(true);
                        blankForwardButton.onClick.RemoveAllListeners();
                        blankForwardButton.onClick.AddListener(() => OnGuidedBlankFilled("forward"));
                        blankForwardButton.interactable = false;
                    }
                    if (blankBackwardButton != null)
                    {
                        blankBackwardButton.gameObject.SetActive(true);
                        blankBackwardButton.onClick.RemoveAllListeners();
                        blankBackwardButton.onClick.AddListener(() => OnGuidedBlankFilled("backward"));
                        blankBackwardButton.interactable = false;
                    }
                    if (moveForwardButton != null) moveForwardButton.interactable = false;
                    if (moveDownButton != null) moveDownButton.interactable = false;
                    if (runButton != null) runButton.interactable = false;
                    // Enable only those specified in blankEnabledArrows
                    if (levelData.blankEnabledArrows != null)
                    {
                        foreach (var arrow in levelData.blankEnabledArrows)
                        {
                            if (arrow == "turn left" && blankLeftButton != null) blankLeftButton.interactable = true;
                            if (arrow == "turn right" && blankRightButton != null) blankRightButton.interactable = true;
                            if (arrow == "forward" && blankForwardButton != null) blankForwardButton.interactable = true;
                            if (arrow == "backward" && blankBackwardButton != null) blankBackwardButton.interactable = true;
                        }
                    }
                    StartCoroutine(PulseBlankSlot(blankSlotInstance));
                }
            }
        }
        // Update camera targets to include character and all apples
        if (multiTargetCamera != null)
        {
            multiTargetCamera.targets.Clear();
            multiTargetCamera.targets.Add(this.transform); // Character
            for (int i = 0; i < appleParent.childCount; i++)
            {
                var apple = appleParent.GetChild(i);
                if (apple.gameObject.activeSelf)
                    multiTargetCamera.targets.Add(apple);
            }
        }
    }

    private float CalculateDifficultyMultiplier()
    {
        float difficultyMultiplier = 1.0f;
        
        // Get the scores from PlayerPrefs
        string userId = PlayerPrefs.GetString("UserId", "UnknownUser");
        int level1Score = PlayerPrefs.GetInt($"{userId}_Level1_Score", 0);
        int level2Score = PlayerPrefs.GetInt($"{userId}_Level2_Score", 0);
        
        int totalAssessments = 0;
        float avgScore = 0f;

        // Only count levels that have been completed
        if (level1Score > 0)
        {
            avgScore += level1Score;
            totalAssessments++;
        }
        if (level2Score > 0)
        {
            avgScore += level2Score;
            totalAssessments++;
        }

        if (totalAssessments > 0)
        {
            avgScore /= totalAssessments;
            // Scale from 0.5 to 1.5 based on average score (assuming max score is 20)
            // Lower scores mean easier placement (closer to robot)
            difficultyMultiplier = 0.5f + (avgScore / 20f);
        }

        Debug.Log($"[CharacterMove] Calculated difficulty multiplier: {difficultyMultiplier} based on Level1 score: {level1Score}, Level2 score: {level2Score}");
        return difficultyMultiplier;
    }

    private void GenerateRandomApples(int numApples, Vector2Int robotStartPos)
    {
        currentLevelApplePositions.Clear();
        HashSet<Vector2Int> occupiedPositions = new HashSet<Vector2Int> { robotStartPos };
        float difficultyMultiplier = CalculateDifficultyMultiplier();
        int maxDistance = 3; // Base maximum distance

        Debug.Log($"[CharacterMove] Generating {numApples} apples with difficulty multiplier {difficultyMultiplier}");

        for (int i = 0; i < numApples; i++)
        {
            Vector2Int randomPos;
            int attempts = 0;
            bool positionFound = false;

            while (!positionFound && attempts < 100)
            {
                // Calculate adjusted range based on difficulty
                int adjustedRange = Mathf.CeilToInt(maxDistance * difficultyMultiplier);
                // Ensure range doesn't exceed our maximum of 3
                adjustedRange = Mathf.Min(adjustedRange, 3);

                // Generate random position within adjusted range
                int x = randomGenerator.Next(-adjustedRange, adjustedRange + 1);
                int y = randomGenerator.Next(-adjustedRange, adjustedRange + 1);
                randomPos = new Vector2Int(x, y);

                // Check if position is valid (not occupied and within grid bounds)
                if (!occupiedPositions.Contains(randomPos) && 
                    Mathf.Abs(randomPos.x) <= 3 && 
                    Mathf.Abs(randomPos.y) <= 3)
                {
                    // Additional check: ensure minimum distance from robot based on performance
                    float minDistance = 1f; // Minimum distance from robot
                    float actualDistance = Vector2Int.Distance(robotStartPos, randomPos);
                    
                    if (actualDistance >= minDistance)
                    {
                        currentLevelApplePositions.Add(randomPos);
                        occupiedPositions.Add(randomPos);
                        positionFound = true;
                        Debug.Log($"[CharacterMove] Apple {i} placed at position {randomPos}, distance from robot: {actualDistance}");
                    }
                }
                attempts++;
            }

            if (!positionFound)
            {
                Debug.LogWarning($"[CharacterMove] Could not find valid position for apple {i + 1} after {attempts} attempts");
            }
        }

        Debug.Log($"[CharacterMove] Generated {currentLevelApplePositions.Count} random apples for Level 3. Positions: {string.Join(", ", currentLevelApplePositions)}");
    }

    private void InstantiateApple(Vector2Int gridPos, int index)
    {
        if (applePrefab == null) {
            Debug.LogError("[InstantiateApple] applePrefab is NULL!");
            return;
        }
        if (appleParent == null)
        {
            Debug.LogError("[CharacterMove InstantiateApple] CRITICAL: appleParent is NULL! Check assignment in Inspector.");
            return; // Cannot proceed
        }
        Debug.Log($"[CharacterMove InstantiateApple] appleParent: {appleParent.name}, isActiveInHierarchy: {appleParent.gameObject.activeInHierarchy}");

        // Calculate world position (similar to your original Start method logic)
        float raycastOriginX = robotStartWorldPos.x + gridPos.x * gridSize;
        float raycastOriginZ = robotStartWorldPos.z + gridPos.y * gridSize;
        Vector3 rayOrigin = new Vector3(raycastOriginX, robotStartWorldPos.y + 1.0f, raycastOriginZ);
        Vector3 appleFinalWorldPos;
        RaycastHit hit;

        if (Physics.Raycast(rayOrigin, Vector3.down, out hit, 2.0f, gridLayer))
        {
            appleFinalWorldPos = new Vector3(hit.collider.bounds.center.x, robotStartWorldPos.y, hit.collider.bounds.center.z);
        }
        else
        {
            appleFinalWorldPos = new Vector3(raycastOriginX, robotStartWorldPos.y, raycastOriginZ);
            Debug.LogWarning($"[CharacterMove] Apple at grid {gridPos} raycast failed. Placed arithmetically. Check gridLayer.");
        }

        GameObject apple = Instantiate(applePrefab, appleFinalWorldPos, applePrefab.transform.rotation, appleParent);
        apple.name = $"Apple_{index}";
        Debug.Log($"[CharacterMove InstantiateApple] Instantiated: {apple.name}, activeInHierarchy: {apple.gameObject.activeInHierarchy}, parent: {apple.transform.parent?.name}");

        apple.SetActive(false); // Initially deactivate all apples, first one activated in SetupLevel

        AppleCluster cluster = apple.GetComponent<AppleCluster>() ?? apple.AddComponent<AppleCluster>();
        cluster.applesInCluster = 1;
        // Enable drag if this is an apple-drag guided level
        if (allLevelsData != null && currentLevel > 0 && currentLevel <= allLevelsData.Count)
        {
            var levelData = allLevelsData[currentLevel - 1];
            cluster.allowDrag = levelData.isAppleDragGuidedLevel;
        }
        // cluster.ApplesCount = 1; // Assuming ApplesCount is a property that gets set via applesInCluster

        // Ensure the renderer is enabled when an apple is instantiated
        Renderer appleRenderer = apple.GetComponentInChildren<Renderer>(true);
        if (appleRenderer != null)
        {
            appleRenderer.enabled = true;
            Debug.Log($"[CharacterMove InstantiateApple] Found and enabled Renderer for {apple.name}.");
        }
        else
        {
            SpriteRenderer appleSpriteRenderer = apple.GetComponentInChildren<SpriteRenderer>(true);
            if (appleSpriteRenderer != null)
            {
                appleSpriteRenderer.enabled = true;
                Debug.Log($"[CharacterMove InstantiateApple] Found and enabled SpriteRenderer for {apple.name}.");
            }
            else
            {
                Debug.LogWarning($"[CharacterMove InstantiateApple] No Renderer or SpriteRenderer found on apple prefab instance: {apple.name}");
            }
        }
    }

    private void Start()
    {
        // Check if user is logged in
        if (!PlayerPrefs.HasKey("UserId"))
        {
            Debug.LogError("User not logged in!");
            // SceneManager.LoadScene("MainMenu"); // Or your login scene name
            return;
        }
        currentUserId = PlayerPrefs.GetString("UserId");
        Debug.Log($"Logged in with ID: {currentUserId}");

        // Check if this is a new game session
        string sessionKey = currentUserId + "_session_active";
        if (!PlayerPrefs.HasKey(sessionKey))
        {
            // This is a new session, start from Level 1
            currentLevel = 1;
            PlayerPrefs.SetInt(currentUserId + "_currentLevel", currentLevel);
            PlayerPrefs.SetInt(sessionKey, 1); // Mark session as active
            PlayerPrefs.Save();
            Debug.Log($"[CharacterMove] New session: Starting from Level 1");
        }
        else
        {
            // Existing session, load saved level
            currentLevel = PlayerPrefs.GetInt(currentUserId + "_currentLevel", 1);
            Debug.Log($"[CharacterMove] Existing session: Continuing from Level {currentLevel}");
        }

        // Cache the world position of grid cell (0,0)
        robotStartWorldPos = transform.position - new Vector3(robotGridPosition.x * gridSize, 0, robotGridPosition.y * gridSize);

        animator = GetComponent<Animator>();

        rotateLeftButton.onClick.AddListener(() => { EnqueueAction(new RotateAction(-rotationAngle), rotateLeftSprite); playerActions.Add("left"); });
        rotateRightButton.onClick.AddListener(() => { EnqueueAction(new RotateAction(rotationAngle), rotateRightSprite); playerActions.Add("right"); });
        moveForwardButton.onClick.AddListener(() => { EnqueueAction(new MoveAction(Vector3.forward), forwardSprite); playerActions.Add("forward"); });
        moveDownButton.onClick.AddListener(() => { EnqueueAction(new MoveAction(-Vector3.forward), backwardSprite); playerActions.Add("backward"); });
        runButton.onClick.AddListener(StartActionProcessing);
        initialBasketButtonPosition = basketButton.transform.localPosition;

        basketButton.onClick.AddListener(() =>
        {
            CollectApplesAtCluster(); 
            ResetBasketButtonPosition(); 
        });
        basketButton.gameObject.SetActive(false);

        successPopup.SetActive(false); 
        if (successPopupContinueButton != null) 
        {
            successPopupContinueButton.onClick.AddListener(OnSuccessPopupContinue);
        }
        else
        {
            Debug.LogWarning("[CharacterMove] successPopupContinueButton is not assigned in the inspector!");
        }
        // appleObject.SetActive(false); // This might be an old reference

        if (spriteRenderer == null) spriteRenderer = GetComponent<SpriteRenderer>();
        // fadeCoroutine = StartCoroutine(FadeInAndOut(repeatCount)); // Fading might be distracting now
        StopFadingAndResetSpriteColor(); // Ensure sprite is visible

        if (PlayerPrefs.HasKey("ServerResponse"))
        {
            string jsonResponse = PlayerPrefs.GetString("ServerResponse");
            HandleServerResponse(jsonResponse);
            PlayerPrefs.DeleteKey("ServerResponse");
        }
        audioSource = GetComponent<AudioSource>();
        if (audioSource == null) audioSource = gameObject.AddComponent<AudioSource>();
        audioSource1 = GetComponent<AudioSource>();
        if (audioSource1 == null) audioSource1 = gameObject.AddComponent<AudioSource>();

        InitializeLevelData();
        LoadPlayerLevel();
        SetupLevel(currentLevel);
    }

    private void OnSuccessPopupContinue()
    {
        successPopup.SetActive(false);
        // Send game progress to Flask when a level is completed
        if (FlaskCommunication.Instance != null && currentLevel <= allLevelsData.Count)
        {
            string levelName = allLevelsData[currentLevel - 1].levelName;
            int score = 0; // You can update this to use the actual score if available
            string actions = "Level Completed";
            FlaskCommunication.Instance.SendGameProgress(currentUserId, levelName, score, actions);
        }
        currentLevel++;
        if (currentLevel <= MAX_LEVELS && currentLevel <= allLevelsData.Count)
        {
            SavePlayerLevel();
            if (appleParent != null)
            {
                for (int i = appleParent.childCount - 1; i >= 0; i--)
                {
                    Destroy(appleParent.GetChild(i).gameObject);
                }
            }
            StartCoroutine(SetupNextLevel());
        }
        else
        {
            chatGPTResponseText.text = "Congratulations! You have completed all levels!";
            Debug.Log("[CharacterMove] All levels completed!");
            levelStartTime = -1f;
        }
        foreach (var obj in activeObstacles) { if (obj != null) Destroy(obj); }
        activeObstacles.Clear();
    }

    private IEnumerator SetupNextLevel()
    {
        // Wait for end of frame to ensure all cleanup is complete
        yield return new WaitForEndOfFrame();
        
        // Ensure appleParent is ready
        if (appleParent != null)
        {
            appleParent.gameObject.SetActive(true);
            Debug.Log($"[CharacterMove SetupNextLevel] AppleParent active state before setup: {appleParent.gameObject.activeInHierarchy}");
        }
        
        // Setup the new level
        SetupLevel(currentLevel);
        
        // Double check first apple activation
        if (appleParent != null && appleParent.childCount > 0)
        {
            var firstApple = appleParent.GetChild(0);
            if (firstApple != null)
            {
                firstApple.gameObject.SetActive(true);
                Debug.Log($"[CharacterMove SetupNextLevel] Double-checked Apple_0 activation. Name: {firstApple.name}, Active: {firstApple.gameObject.activeInHierarchy}");
            }
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
        
        // Ensure the time scale is normal when the success popup is active
        if (successPopup.activeSelf && Time.timeScale < 1.0f)
        {
            Debug.Log("[CharacterMove] Detected paused game with active popup. Restoring time scale.");
            Time.timeScale = 1.0f;
        }

        var apple = GameObject.Find("Apple_0");
        if (apple == null) {
            Debug.LogWarning("[Update] Apple_0 is missing from the scene!");
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
        // actionHistory.Enqueue(action); // actionHistory is populated after actions are processed.
        // actionHistoryList.Add(action); // Same as above

        // Log for the current attempt (before run is pressed)
        currentAttemptActionLog.Add(new PlayerActionLogEntry { action = GetActionLogString(action), timestamp = Time.time });

        GameObject actionImageInstance = Instantiate(actionImagePrefab, actionQueueTransform);
        actionImageInstance.GetComponent<Image>().sprite = actionSprite;
        // GameObject historyImageInstance = Instantiate(actionImagePrefab, actionHistoryTransform); // History images added after execution
        // historyImageInstance.GetComponent<Image>().sprite = actionSprite;

        actionQueueTransform.gameObject.SetActive(true);
    }

    private void StartActionProcessing()
    {
        StopFadingAndResetSpriteColor();
        // Record robot's starting state for this attempt BEFORE any moves
        attemptStartGridPos = robotGridPosition;
        attemptStartFacing = facingDirection;
        Debug.Log($"[StartActionProcessing] Recording attempt start: pos={attemptStartGridPos}, facing={attemptStartFacing}");
        if (!isProcessing && actionQueue.Count > 0)
        {
            isProcessing = true;
            currentMoveCoroutine = StartCoroutine(ProcessActions());
        }
    }

    private IEnumerator ProcessActions()
    {
        int actionsInThisRun = actionQueue.Count; 
        Queue<CharacterAction> successfullyExecutedActions = new Queue<CharacterAction>();
        isProcessing = true;
        while (actionQueue.Count > 0)
        {
            var action = actionQueue.Dequeue();
            if (action != null)
                yield return action.Execute(this);
            successfullyExecutedActions.Enqueue(action);
            if (actionQueueTransform.childCount > 0) 
                Destroy(actionQueueTransform.GetChild(0).gameObject);
            else
                Debug.LogWarning("[ProcessActions] Tried to destroy child from empty actionQueueTransform.");
        }
        isProcessing = false;
        actionQueueTransform.gameObject.SetActive(false);
        AddToActionHistoryUI(successfullyExecutedActions);
        actionQueue.Clear();
        // Check for wrong blank answer after all actions
        LevelData levelData = allLevelsData[currentLevel - 1];
        if (levelData.guidedActions != null && levelData.guidedActions.Contains("blank"))
        {
            if (!IsBlankAnswerCorrect())
            {
                if (wrongAnswerPopup != null) wrongAnswerPopup.SetActive(true);
                if (runButton != null) runButton.interactable = false;
                yield break;
            }
        }
        // --- APPLE DRAG GUIDED LEVEL LOGIC ---
        if (levelData.isAppleDragGuidedLevel)
        {
            // Only one apple in this mode, at index 0
            Vector2Int robotPos = robotGridPosition;
            Vector2Int applePos = currentLevelApplePositions.Count > 0 ? currentLevelApplePositions[0] : new Vector2Int(999,999);
            if (robotPos == applePos)
            {
                // Success! Show success popup and collect apple
                if (successPopup != null) {
                    successPopupText.text = $"{levelData.levelName} Complete!";
                    successPopup.SetActive(true);
                }
                // Optionally, collect apple
                if (appleParent.childCount > 0)
                {
                    var apple = appleParent.GetChild(0).GetComponent<AppleCluster>();
                    if (apple != null) apple.CollectApples();
                }
            }
            else
            {
                // Try again: show popup and reset level
                if (wrongAnswerPopup != null) wrongAnswerPopup.SetActive(true);
                if (runButton != null) runButton.interactable = false;
                // Optionally, reset after a short delay
                yield break;
            }
            yield break;
        }
        // ... existing code ...
        bool reachedAppleLoc = CheckIfRobotReachedAppleLocation();
        AssessComputationalThinking(false, actionsInThisRun, reachedAppleLoc); 
    }

    private bool CheckIfRobotReachedAppleLocation()
    {
        if (currentAppleTargetIndex < 0 || currentAppleTargetIndex >= currentLevelApplePositions.Count)
        {
            return false; // No valid apple target
        }
        return robotGridPosition == currentLevelApplePositions[currentAppleTargetIndex];
    }

    private void AddToActionHistoryUI(Queue<CharacterAction> executedActions)
    {
        foreach (var action in executedActions)
        {
            actionHistory.Enqueue(action); // Add to the main history data structure
            actionHistoryList.Add(action); // Also to the list form of history

            GameObject historyImageInstance = Instantiate(actionImagePrefab, actionHistoryTransform);
            historyImageInstance.GetComponent<Image>().sprite = GetSpriteForAction(action);
        }
    }

    public IEnumerator RotateCoroutine(float angle)
    {
        Quaternion startRotation = transform.rotation;
        Quaternion endRotation = startRotation * Quaternion.Euler(0, angle, 0);
        transform.rotation = endRotation;
        yield return new WaitForSeconds(moveDuration);

        // Update facingDirection based on rotation
        if (angle == 90f || angle == -270f) // Turn right
        {
            facingDirection = new Vector2Int(facingDirection.y, -facingDirection.x);
        }
        else if (angle == -90f || angle == 270f) // Turn left
        {
            facingDirection = new Vector2Int(-facingDirection.y, facingDirection.x);
        }
        Debug.Log($"[CharacterMove] Robot turned. Now facing: {facingDirection}");
    }

    public IEnumerator MoveCoroutine(Vector3 direction)
    {
        Vector3 adjustedDirection = Quaternion.Euler(0, transform.eulerAngles.y, 0) * direction * gridSize;
        Vector3 startPosition = transform.position;
        Vector3 endPosition = startPosition + adjustedDirection;

        float elapsedTime = 0;
        
        animator.SetBool("isWalking", true);
        if (audioSource1 != null && footstepsround != null && !audioSource1.isPlaying) // Null checks
        {
            audioSource1.PlayOneShot(footstepsround);
        }

        while (elapsedTime < moveDuration)
        {
            transform.position = Vector3.Lerp(startPosition, endPosition, elapsedTime / moveDuration);
            elapsedTime += Time.deltaTime;
            yield return null;
        }

        lastSafePosition = endPosition; // Update last safe position after successful move
        transform.position = endPosition;
        animator.SetBool("isWalking", false);
        if (audioSource1 != null) audioSource1.Stop(); // Null check

        // Check for apple cluster after moving
        applesAtCurrentCluster = CheckForAppleCluster(endPosition);
        isAtAppleCluster = applesAtCurrentCluster > 0;
        
        basketButton.gameObject.SetActive(isAtAppleCluster);
      
        if (isAtAppleCluster)
        {
            ActivateBasketButton();
            StartCoroutine(PlayCollectSound(0.1f)); // Adjust delay as needed
        }
       
        // Duplicated loop for footprints and apple check removed for clarity, assuming one loop handles all
        // Original code had a duplicated while loop here. Consolidating.
        // Ensure footprints are added correctly. The previous logic for footprints was inside a second while loop.
        // For simplicity, adding footprint after move completion.
        AddFootprint(); // Adding footprint once after move. Adjust if multiple needed during move.


        var gridCenter = CheckGridBelow();
        if (gridCenter.HasValue)
        {
            transform.position = gridCenter.Value;
        }
        lastSafePosition = transform.position; // Re-confirm last safe position after potential grid snap

        // Only update grid position if moving forward or backward
        if (direction == Vector3.forward) // Forward
            robotGridPosition += facingDirection;
        else if (direction == -Vector3.forward) // Backward
            robotGridPosition -= facingDirection;

        Debug.Log($"[CharacterMove] Robot is now at grid position: {robotGridPosition}, facing: {facingDirection}");
    }

    private IEnumerator MoveBackCoroutine()
    {
        float elapsedTime = 0;
        Vector3 startPosition = transform.position;
        // Quaternion startRotation = transform.rotation; // Not used

        while (elapsedTime < moveDuration)
        {
            transform.position = Vector3.Lerp(startPosition, lastSafePosition, elapsedTime / moveDuration);
            elapsedTime += Time.deltaTime;
            yield return null;
        }
        transform.position = lastSafePosition;
    }

    private int CheckForAppleCluster(Vector3 position)
    {
        Collider[] hitColliders = Physics.OverlapSphere(position, gridSize / 2, appleLayer);
        foreach (var hitCollider in hitColliders)
        {
            // Check if the hit collider or its parent has the "AppleCluster" tag
            // And that the game object is active (important for when apples are "collected"/deactivated)
            if (hitCollider.gameObject.activeInHierarchy && hitCollider.CompareTag("AppleCluster")) 
            {
                // Try to get AppleCluster from the hit object itself, or its parent
                AppleCluster cluster = hitCollider.GetComponent<AppleCluster>() ?? hitCollider.transform.parent?.GetComponent<AppleCluster>();
                
                if (cluster != null && cluster.gameObject.activeInHierarchy) // Ensure the cluster's game object is active
                {
                    currentAppleClusterGameObject = cluster.gameObject; // Store the GameObject that has the AppleCluster script
                    Debug.Log($"[CheckForAppleCluster] Found active AppleCluster: {currentAppleClusterGameObject.name} with {cluster.applesInCluster} apples.");
                    return cluster.applesInCluster;
                }
                else
                {
                     Debug.LogWarning($"[CheckForAppleCluster] Found object with tag AppleCluster but no active AppleCluster component or its GameObject is inactive: {hitCollider.name}");
                }
            }
        }
        currentAppleClusterGameObject = null; // Reset if no active cluster found
        return 0;
    }

    private void CollectApplesAtCluster()
    {
        Debug.Log("[CharacterMove] ===== Starting Apple Collection Process =====");
        Debug.Log($"[CharacterMove] Is at apple cluster: {isAtAppleCluster}");
        Debug.Log($"[CharacterMove] Current apple cluster object: {(currentAppleClusterGameObject != null ? currentAppleClusterGameObject.name : "Null")}, Active: {(currentAppleClusterGameObject != null ? currentAppleClusterGameObject.activeInHierarchy.ToString() : "N/A")}");
        
        applesAtCurrentCluster = CheckForAppleCluster(transform.position); 
        isAtAppleCluster = applesAtCurrentCluster > 0;
        basketButton.gameObject.SetActive(isAtAppleCluster); // Update basket visibility

        if (isAtAppleCluster && currentAppleClusterGameObject != null && currentAppleClusterGameObject.activeInHierarchy)
        {
            if (currentAppleClusterGameObject == null) // Extra safety check
            {
                Debug.LogError("[CharacterMove CollectApplesAtCluster] Critical: currentAppleClusterGameObject is null despite passing initial checks.");
                return;
            }

            AppleCluster cluster = currentAppleClusterGameObject.GetComponent<AppleCluster>();
            
            if (cluster == null) // Extra safety check
            {
                Debug.LogError($"[CharacterMove CollectApplesAtCluster] Critical: AppleCluster component not found on {currentAppleClusterGameObject.name}.");
                return;
            }

            Debug.Log($"[CharacterMove] AppleCluster component on {currentAppleClusterGameObject.name} found: Yes");

            if (cluster.applesInCluster > 0) // Ensure cluster has apples to give
            {
                int applesCollectedThisTime = cluster.CollectApples(); // CollectApples should now handle its own deactivation logic
                
                if (applesCollectedThisTime > 0)
                {
                    // Log actions in queue before this collection event
                    List<PlayerActionLogEntry> queueActionsToLog = new List<PlayerActionLogEntry>();
                    foreach (CharacterAction actionInQueue in new Queue<CharacterAction>(actionQueue)) 
                    {
                        queueActionsToLog.Add(new PlayerActionLogEntry { action = GetActionLogString(actionInQueue), timestamp = Time.time });
                    }
                    actionLog.AddRange(queueActionsToLog);
                    
                    totalApplesCollectedThisSession += applesCollectedThisTime; // Global count for the entire game session
                    applesCollectedThisLevel += applesCollectedThisTime;
                    UpdateApplesNeededDisplay();

                    actionLog.Add(new PlayerActionLogEntry { action = "collect", timestamp = Time.time });

                    // Generalize per-apple assessment for all levels
                    LevelData levelData = allLevelsData[currentLevel-1];
                    int totalApplesForLevel = levelData.isRandom ? levelData.numRandomApples : levelData.applePositions.Count;
                    bool isLastApple = (applesCollectedThisLevel >= totalApplesForLevel);
                    if (!isLastApple && currentAttemptActionLog.Count > 0 && !assessedAppleIndices.Contains(currentAppleTargetIndex))
                    {
                        Debug.Log($"[Assessment] Sending per-apple assessment for apple index: {currentAppleTargetIndex} (Level: {levelData.levelName})");
                        AssessComputationalThinking(false);
                        assessedAppleIndices.Add(currentAppleTargetIndex);
                        currentAttemptActionLog.Clear();
                    }

                    if (chatGPTResponseText != null)
                    {
                        chatGPTResponseText.text = "Sending encouragement to ChatGPT...";
                    }

                    string encouragementMessage = $"The robot just collected an apple. Progress in {allLevelsData[currentLevel-1].levelName}: {applesCollectedThisLevel} apple(s) collected. Keep going!";

                    Debug.Log($"[CharacterMove] Preparing to send encouragement message to ChatGPT: {encouragementMessage}");
                    
                    if (chatGPTManager != null)
                    {
                        chatGPTManager.SendMessage(encouragementMessage, OnChatGPTFeedback); 
                    }
                    else
                    {
                        Debug.LogError("[CharacterMove] ChatGPT Manager is not assigned for encouragement message!");
                        if (chatGPTResponseText != null) chatGPTResponseText.text = "Great job collecting the apple! (ChatGPT N/A)"; 
                    }

                    if (applesCollectedThisLevel >= totalApplesForLevel)
                    {
                        // Display success popup - OnSuccessPopupContinue will handle level advancement
                        successPopupText.text = $"{levelData.levelName} Complete!";
                        successPopup.SetActive(true);
                    }
                    else
                    {
                        CheckIfRobotReachedApple(true); 
                    }
                }
                else
                {
                    Debug.LogWarning("[CharacterMove] CollectApples returned 0 apples. The apple might have been collected already or an issue in AppleCluster script.");
                }
            }
            else
            {
                Debug.LogWarning($"[CharacterMove] No AppleCluster component found on {currentAppleClusterGameObject.name} or it has no apples during collect attempt.");
            }
        }
        else
        {
            Debug.LogWarning("[CharacterMove] CollectApplesAtCluster called but not at an active apple cluster or currentAppleClusterGameObject is null/inactive.");
        }
        Debug.Log("[CharacterMove] ===== Apple Collection Process Completed =====");
    }

    private void AfterTaskCompletion(int taskIndex) // This method and its calls will be removed
    {
        // This entire method is part of the old task system and will be removed.
    }

    private void ShowCompletionPopup(string message) // This method seems to be for the old task system popup
    {
        // This logic is now handled by the successPopup and OnSuccessPopupContinue
        // Time.timeScale = 1.0f;
        // ConfigureSuccessPopup(); // This was an old name, might be mixed with successPopup setup
        // if (successPopup.GetComponentInChildren<Text>() != null) 
        //     successPopup.GetComponentInChildren<Text>().text = message;
        // else if (successPopup.GetComponentInChildren<TextMeshProUGUI>() != null) 
        //     successPopup.GetComponentInChildren<TextMeshProUGUI>().text = message;
        // successPopup.SetActive(true);
    }

    private void UpdateApplesNeededDisplay()
    {
        if (allLevelsData == null || currentLevel <= 0 || currentLevel > allLevelsData.Count)
        {
            applesNeededText.text = "Loading level data...";
            return;
        }
        LevelData levelData = allLevelsData[currentLevel - 1];
        int totalApplesInLevel = levelData.isRandom ? levelData.numRandomApples : levelData.applePositions.Count;
        int remainingApples = totalApplesInLevel - applesCollectedThisLevel;
        applesNeededText.text = $"{levelData.levelName}: {remainingApples} apple(s) left";
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
        actionLog.Add(new PlayerActionLogEntry { action = "undo", timestamp = Time.time }); // Log undo
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
        if (action is MoveAction ma) // Use pattern matching
        {
            if (ma.Direction == Vector3.forward)
                return forwardSprite;
            else
                return backwardSprite;
        }
        else if (action is RotateAction ra) // Use pattern matching
        {
            if (ra.Angle == rotationAngle)
                return rotateRightSprite;
            else
                return rotateLeftSprite;
        }
        return null;
    }

    private void OnTriggerEnter(Collider other)
    {
        if (other.CompareTag("tree")) 
        {
            Debug.Log("Collided with tree");
            if (currentMoveCoroutine != null)
            {
                StopCoroutine(currentMoveCoroutine);
            }
            isProcessing = false;
            animator.SetBool("isWalking", false);
            if(audioSource1 != null) audioSource1.Stop();

            // Remove the last action image from the UI queue if it was a planned action
            // Check against actionQueue (planned) vs actionHistory (executed)
            // If ProcessActions was running, the action log might be ahead of UI queue.
            // Safest to just clear the UI queue for simplicity upon collision during execution.
            // However, the original logic was to remove the *last child* of actionQueueTransform.
            // This implies it was the last *added* to the UI, not necessarily the one being executed.

            // If actionQueue is not empty, it means these actions were planned but not fully executed.
            // Clearing the UI (actionQueueTransform) is appropriate.
            // The actual actionQueue (data) is cleared by ProcessActions or StartActionProcessing on next run.
            if (actionQueueTransform.childCount > 0 && actionQueue.Count > 0) // Check if there are planned actions in UI and data queue
            {
                // This part is tricky. If a collision happens mid-sequence (ProcessActions),
                // actionQueue (data) is being emptied one by one. actionQueueTransform (UI) is also emptied one by one.
                // If collision stops ProcessActions, actionQueue might still have items.
                // The original line just destroyed the last child of actionQueueTransform.
                // Let's clear all children of actionQueueTransform to reflect a reset of the current attempt.
                foreach (Transform child in actionQueueTransform)
                {
                    Destroy(child.gameObject);
                }
                // The underlying actionQueue (data) should also be cleared to prevent these actions from re-running immediately.
                actionQueue.Clear(); 
            }
            else if (actionQueueTransform.childCount > 0) // If only UI elements but no data queue (e.g. run not pressed yet)
            {
                Destroy(actionQueueTransform.GetChild(actionQueueTransform.childCount - 1).gameObject);
                 // Also remove from the data queue if it exists there
                 if (actionQueue.Count > 0) actionQueue = new Queue<CharacterAction>(actionQueue.ToList().GetRange(0, actionQueue.Count -1));
            }


            StartCoroutine(MoveBackCoroutine());
        }
    }

    private void InitializeTasksForLevel1() // This method and its calls will be removed
    {
        // Part of the old task system
    }

    private void InitializeTask2() // This method and its calls will be removed
    {
        // Part of the old task system
    }

    private void CheckTaskCompletion() // This method and its calls will be removed
    {
        // Part of the old task system
    }

    private void TryEnqueueAction(CharacterAction action, Sprite actionSprite) // This method seems unused.
    {
        // Part of the old task system or an unused helper
    }
    public void ClosePopup() // This is for the general successPopup
    {
        successPopup.SetActive(false);
        Time.timeScale = 1.0f;
    }

    private void ConfigureSuccessPopup()
    {
        Canvas popupCanvas = successPopup.GetComponent<Canvas>();
        if (popupCanvas == null)
        {
            popupCanvas = successPopup.AddComponent<Canvas>();
            popupCanvas.renderMode = RenderMode.ScreenSpaceOverlay;
            popupCanvas.sortingOrder = 999; 
        }
        if (successPopup.GetComponent<GraphicRaycaster>() == null)
        {
            successPopup.AddComponent<GraphicRaycaster>();
        }
        Button closeButton = successPopup.GetComponentInChildren<Button>();
        if (closeButton != null)
        {
            closeButton.onClick.RemoveAllListeners();
            closeButton.onClick.AddListener(ClosePopup);
            closeButton.interactable = true;
        }
        Time.timeScale = 1.0f;
    }

    IEnumerator FadeInAndOut(int count)
    {
        while (count > 0 && spriteRenderer != null) // Null check for spriteRenderer
        {
            yield return StartCoroutine(FadeAlpha(1, 0));
            yield return StartCoroutine(FadeAlpha(0, 1));
            count--;
        }
    }

    IEnumerator FadeAlpha(float startAlpha, float endAlpha)
    {
        if (spriteRenderer == null) yield break; // Guard clause

        float elapsedTime = 0;
        while (elapsedTime < fadeDuration)
        {
            elapsedTime += Time.deltaTime;
            float newAlpha = Mathf.Lerp(startAlpha, endAlpha, elapsedTime / fadeDuration);
            spriteRenderer.color = new Color(spriteRenderer.color.r, spriteRenderer.color.g, spriteRenderer.color.b, newAlpha);
            yield return null;
        }
        // Ensure final alpha is set
        if (spriteRenderer != null) // Check again in case it was destroyed during yield
             spriteRenderer.color = new Color(spriteRenderer.color.r, spriteRenderer.color.g, spriteRenderer.color.b, endAlpha);
    }

    public void StopFadingAndResetSpriteColor()
    {
        if (fadeCoroutine != null)
        {
            StopCoroutine(fadeCoroutine);
            fadeCoroutine = null;
        }
        if (spriteRenderer != null) // Null check
            spriteRenderer.color = new Color(spriteRenderer.color.r, spriteRenderer.color.g, spriteRenderer.color.b, 0);
    }

    IEnumerator PlayCollectSound(float delay)
    {
        Debug.Log("Trying to play collect sound.");
        yield return new WaitForSeconds(delay); 
        if (collectSound != null && audioSource != null) // Null checks
        {
            Debug.Log("Playing collect sound.");
            audioSource.PlayOneShot(collectSound);
        }
        else
        {
            Debug.LogError("CollectSound or AudioSource is null.");
        }
    }

    public void ActivateBasketButton()
    {
        basketButton.gameObject.SetActive(true); 
        StartCoroutine(MoveButtonToLeft(basketButton.transform, 0.5f)); 
    }

    private IEnumerator MoveButtonToLeft(Transform buttonTransform, float duration)
    {
        Vector3 startPosition = buttonTransform.localPosition; 
        Vector3 endPosition = new Vector3(-1f, startPosition.y, startPosition.z); 

        float elapsedTime = 0;
        while (elapsedTime < duration)
        {
            buttonTransform.localPosition = Vector3.Lerp(startPosition, endPosition, elapsedTime / duration);
            elapsedTime += Time.deltaTime;
            yield return null;
        }
        buttonTransform.localPosition = endPosition; 
    }

    private void ResetBasketButtonPosition()
    {
        basketButton.transform.localPosition = initialBasketButtonPosition;
        basketButton.gameObject.SetActive(false);
    }
    private void LoadNextLevel()
    {
        SceneManager.LoadScene("level2");
    }

    private void CheckIfRobotReachedApple(bool dueToCollection = false)
    {
        // This method is called after each move sequence OR after a successful collection
        if (currentAppleTargetIndex >= currentLevelApplePositions.Count)
        {
            // All apples for this level have been targeted/reached (not necessarily collected via basket yet for all)
            // Collection check and level completion is now primarily in CollectApplesAtCluster and OnSuccessPopupContinue
            return; 
        }

        // If called due to collection, the apple at currentAppleTargetIndex (or rather its gameobject) should be inactive.
        // We need to find the *next* active apple to target.
        if (dueToCollection)
        {
            currentAppleTargetIndex++; // Move to the next conceptual target
            // Deactivate all apples, then activate only the next one
            for (int i = 0; i < appleParent.childCount; i++)
            {
                var apple = appleParent.GetChild(i).gameObject;
                apple.SetActive(i == currentAppleTargetIndex);
            }
        }
        else if (robotGridPosition == currentLevelApplePositions[currentAppleTargetIndex])
        {
            // Robot moved to the target apple's location.
            // Basket button should have been made active by MoveCoroutine.
            // No need to deactivate/activate apples here; that's for collection.
            Debug.Log($"[CharacterMove] Robot reached location of Apple_{currentAppleTargetIndex} at {robotGridPosition}. Basket should be active.");
            if (chatGPTResponseText != null)
            {
                 chatGPTResponseText.text = $"You reached apple #{currentAppleTargetIndex + 1}! Press the basket to collect.";
            }
            return; // Wait for player to press basket
        }
        else if (!dueToCollection)
        {
             // Robot moved but didn't reach the current target apple's location
            RequestChatGPTFeedback(); // Ask for hint
            playerActions.Clear(); // Clear player actions for next sequence attempt for this apple
            return;
        }

        // This part is now for activating the NEXT apple after a collection
        if (currentAppleTargetIndex < currentLevelApplePositions.Count)
        {
            if (appleParent != null) 
            {
                Transform nextAppleGO = appleParent.Find($"Apple_{currentAppleTargetIndex}");
                if (nextAppleGO != null)
                {
                    nextAppleGO.gameObject.SetActive(true);
                    // Update camera targets to include character and only the new active apple
                    if (multiTargetCamera != null)
                    {
                        multiTargetCamera.targets.Clear();
                        multiTargetCamera.targets.Add(this.transform);
                        multiTargetCamera.targets.Add(nextAppleGO);
                    }
                }
            }
        }
        else
        {
            // This case means all apples were targeted sequentially after collections.
            // Actual level completion is handled when applesCollectedThisLevel meets total for level in CollectApplesAtCluster.
            Debug.Log("[CharacterMove] All apple positions have been processed for targeting.");
        }

        // playerActions.Clear(); // Clearing actions here might be too soon if it's just after a move.
                                // Moved to after RequestChatGPTFeedback or after processing action queue.
    }


    private void RequestChatGPTFeedback()
    {
        string allAppleLocs = string.Join(", ", currentLevelApplePositions.Select(pos => $"({pos.x},{pos.y})"));
        Vector2Int targetApple = (currentAppleTargetIndex < currentLevelApplePositions.Count) ? currentLevelApplePositions[currentAppleTargetIndex] : new Vector2Int(-1, -1); // Target for next collection
        string currentActionLogStr = string.Join(", ", actionLog.Select(entry => entry.action));


        string prompt = $"The robot is on a {gridRows}x{gridCols} grid at robot position {robotGridPosition}. " +
                        $"There are apples at: {allAppleLocs}. " +
                        $"The current target apple to reach is at {targetApple}. " +
                        $"The player's recent actions were: {currentActionLogStr}. " + // Using the structured actionLog
                        "The robot did not reach the apple. What should the player try next? Give a short, clear tip.";
        
        if (chatGPTManager != null)
            chatGPTManager.SendMessage(prompt, OnChatGPTFeedback);
    }

    private void OnChatGPTFeedback(string response)
    {
        if (chatGPTResponseText != null) // Update text field regardless
        {
            // Provide a fallback if response is empty/null for better UI experience
            chatGPTResponseText.text = !string.IsNullOrEmpty(response) ? response : "Keep up the great work!"; 
        }
        
        if (!string.IsNullOrEmpty(response)) 
        {
            this.unityFeedbackLog.Add(response); // Only log actual feedback from ChatGPT
            Debug.Log($"[CharacterMove] Added to unityFeedbackLog: {response}");
        }
    }
    
    // Modified AssessComputationalThinking to call the new Flask endpoint
    private void AssessComputationalThinking(bool endOfLevel = false, int actionsBeforeRunForThisAttempt = 0, bool reachedAppleForThisAttempt = false)
    {
        string userId = PlayerPrefs.GetString("UserId");
        if (string.IsNullOrEmpty(userId))
        {
            Debug.LogError("UserId not found in PlayerPrefs. Cannot send assessment.");
            return;
        }

        // If it's not an endOfLevel assessment, the currentAttemptActionLog becomes the log for this specific run.
        // If it IS an endOfLevel assessment, currentAttemptActionLog might contain the very last set of actions leading to level completion.
        // The main actionLog should already contain all previous attempts for this level.
        List<PlayerActionLogEntry> logForThisAssessment;
        LevelData levelData = allLevelsData[currentLevel-1]; // Data for the level being assessed

        bool isPerAppleAssessment = !endOfLevel;
        bool isLevelSummaryAssessment = endOfLevel;

        if (isPerAppleAssessment)
        {
            logForThisAssessment = new List<PlayerActionLogEntry>(currentAttemptActionLog);
            actionLog.AddRange(currentAttemptActionLog); // Add attempt to the main level log
        }
        else if (isLevelSummaryAssessment)
        {
            // For a level summary, ensure the last attempt's logs are also in the main actionLog before sending.
            actionLog.AddRange(currentAttemptActionLog); 
            logForThisAssessment = new List<PlayerActionLogEntry>(actionLog); // Send the complete log for the level
        }
        else
        {
            currentAttemptActionLog.Clear();
            return;
        }
        
        Debug.Log($"[AssessComputationalThinking] Called. endOfLevel: {endOfLevel}, isL1Run: {isPerAppleAssessment}, isSummary: {isLevelSummaryAssessment}. Log count: {logForThisAssessment.Count}");

        string robotPosStr = $"{robotGridPosition.x},{robotGridPosition.y}";
        string applePosStr = "unknown"; 

        if (isLevelSummaryAssessment) {
            applePosStr = "all_level_apples_collected";
        } else if (currentAppleTargetIndex >= 0 && currentAppleTargetIndex < currentLevelApplePositions.Count) {
            Vector2Int targetApplePos = currentLevelApplePositions[currentAppleTargetIndex];
            applePosStr = $"{targetApplePos.x},{targetApplePos.y}";
        } else if (currentLevelApplePositions.Count > 0) {
            Vector2Int lastKnownApple = currentLevelApplePositions[currentLevelApplePositions.Count - 1];
            applePosStr = $"{lastKnownApple.x},{lastKnownApple.y}";
        }

        CTAssessmentRequest requestPayload = new CTAssessmentRequest
        {
            student_id = userId,
            level = levelData.levelName,
            log = logForThisAssessment, // Use the determined log
            robot_position = robotPosStr,
            apple_position = applePosStr,
            unity_chatgpt_feedback_log = new List<string>(this.unityFeedbackLog), // Full feedback log for summaries too
            grid_rows = this.gridRows,
            grid_cols = this.gridCols,
            is_level_summary = isLevelSummaryAssessment,
            level_duration_seconds = -1f,
            initial_facing = new int[] { facingDirection.x, facingDirection.y },
            attempt_number = 1, // Assuming a single attempt for now
            time_taken = Time.time - levelStartTime,
            hints_used = 0, // Assuming no hints used for now
            block_efficiency = 100, // Assuming 100% block efficiency for now
            min_blocks = 1, // Assuming minimum blocks used is 1 for now
            used_blocks = 1, // Assuming used blocks is 1 for now
            previous_attempts = new List<List<PlayerActionLogEntry>>(), // Assuming no previous attempts for now
            robot_start_position = $"{attemptStartGridPos.x},{attemptStartGridPos.y}", // TRUE START POSITION
            robot_start_facing = new int[] { attemptStartFacing.x, attemptStartFacing.y }, // TRUE START FACING
            number_of_attempts = 1, // Assuming a single attempt for now
            time_on_task = Time.time - levelStartTime, // Assuming time_on_task is the time taken for the level
            persistence_score = 100, // Assuming 100% persistence score for now
            creativity_score = 100, // Assuming 100% creativity score for now
            error_types = new List<string> { "None" }, // Assuming no errors for now
            collaboration_events = new List<string> { "None" }, // Assuming no collaboration events for now
            // --- New fields for guided/fill-in-the-blank ---
            guidedActions = levelData.guidedActions,
            correctBlankAnswer = levelData.correctBlankAnswer,
            blankEnabledArrows = levelData.blankEnabledArrows
        };

        if (levelData.levelName == "Level 1")
        {
            if (isPerAppleAssessment)
            {
                requestPayload.level1_starting_position_index = currentAppleTargetIndex; 
                requestPayload.actions_before_run = actionsBeforeRunForThisAttempt; 
                requestPayload.forward_press_intervals = CalculateForwardPressIntervals(currentAttemptActionLog); // Use currentAttempt for intervals of this run
                Debug.Log($"[L1 Run Assess] StartPosIndex: {requestPayload.level1_starting_position_index}, ActionsBeforeRun: {requestPayload.actions_before_run}");
            }
            else if (isLevelSummaryAssessment) // Specifically Level 1 Summary
            {
                if (levelStartTime > 0f) {
                    requestPayload.level_duration_seconds = Time.time - levelStartTime;
                    Debug.Log($"[L1 Summary Assess] Level 1 duration: {requestPayload.level_duration_seconds}s");
                }
            }
        }

        StartCoroutine(SubmitCTAssessmentToFlaskCoroutine(requestPayload));
        
        currentAttemptActionLog.Clear(); // Clear attempt log after it has been processed or added to main log

        if (isLevelSummaryAssessment) 
        {
            actionLog.Clear(); // Clear main log for the level just summarized
            unityFeedbackLog.Clear(); // Clear feedback log for the level just summarized
            if (levelData.levelName == "Level 1") { 
                levelStartTime = -1f; // Reset L1 start time after its summary assessment
                Debug.Log("[CharacterMove] Level 1 logs and start time cleared after summary assessment.");
            }
        }
    }

    private List<float> CalculateForwardPressIntervals(List<PlayerActionLogEntry> attemptLog)
    {
        List<float> intervals = new List<float>();
        PlayerActionLogEntry lastForwardAction = null;

        foreach (var entry in attemptLog)
        {
            if (entry.action.ToLower() == "forward")
            {
                if (lastForwardAction != null)
                {
                    intervals.Add(entry.timestamp - lastForwardAction.timestamp);
                }
                lastForwardAction = entry;
            }
        }
        return intervals;
    }

    IEnumerator SubmitCTAssessmentToFlaskCoroutine(CTAssessmentRequest payload)
    {
        string url = "http://127.0.0.1:5000/api/ct_assessment";
        string jsonPayload = JsonUtility.ToJson(payload);

        Debug.Log($"[SubmitCTAssessmentToFlaskCoroutine] Sending JSON: {jsonPayload} to {url}");

        using (UnityWebRequest www = new UnityWebRequest(url, "POST"))
        {
            byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(jsonPayload);
            www.uploadHandler = new UploadHandlerRaw(bodyRaw);
            www.downloadHandler = new DownloadHandlerBuffer();
            www.SetRequestHeader("Content-Type", "application/json");
            
            yield return www.SendWebRequest();
            
            if (www.result == UnityWebRequest.Result.Success)
            {
                Debug.Log($"[SubmitCTAssessmentToFlaskCoroutine] Assessment response received successfully: {www.downloadHandler.text}");
                try
                {
                    var response = JsonUtility.FromJson<AssessmentResponse>(www.downloadHandler.text);
                    if (response != null && response.scores != null)
                    {
                        int totalScore = 0;
                        if (response.scores.ContainsKey("decomposition")) totalScore += response.scores["decomposition"];
                        if (response.scores.ContainsKey("pattern_recognition")) totalScore += response.scores["pattern_recognition"];
                        if (response.scores.ContainsKey("abstraction")) totalScore += response.scores["abstraction"];
                        if (response.scores.ContainsKey("algorithm_design")) totalScore += response.scores["algorithm_design"];
                        if (response.scores.ContainsKey("debugging")) totalScore += response.scores["debugging"];

                        string userId = PlayerPrefs.GetString("UserId", "UnknownUser");
                        PlayerPrefs.SetInt($"{userId}_Level{currentLevel}_Score", totalScore);
                        PlayerPrefs.Save();
                        Debug.Log($"[SubmitCTAssessmentToFlaskCoroutine] Saved score {totalScore} for Level {currentLevel}");
                    }
                    // Store per-apple assessment for Level 1 (not summary)
                    if (payload.level == "Level 1" && !payload.is_level_summary && response != null)
                    {
                        level1AssessmentResults.Add(response);
                    }
                }
                catch (Exception e)
                {
                    Debug.LogError($"[SubmitCTAssessmentToFlaskCoroutine] Error parsing assessment response: {e.Message}");
                }
            }
            else
            {
                Debug.LogError($"[SubmitCTAssessmentToFlaskCoroutine] Assessment request failed: {www.error}");
            }
        }
    }
    
    // Keep SendAssessmentRequestNonBlocking if it's used elsewhere or for a different purpose.
    // For now, it seems replaced by SubmitCTAssessmentToFlaskCoroutine for the CT assessment.
    // If it was specifically for the OLD /api/assessment endpoint, it might be deprecated.
    // For safety, I'm leaving its definition here, but it's not called by the new AssessComputationalThinking.
    IEnumerator SendAssessmentRequestNonBlocking(string studentId, string level) // This seems to be for the old endpoint
    {
        Debug.LogWarning("[CharacterMove] SendAssessmentRequestNonBlocking (for old /api/assessment) was called. This might be deprecated.");
        // Create payload for the old endpoint (if still needed for something)
        var oldPayload = new Dictionary<string, object> {
            { "student_id", studentId },
            { "level", level },
            { "log", actionLog.Select(e => e.action).ToList() } // Old endpoint might expect List<string>
        };
        string jsonPayload = JsonUtility.ToJson(oldPayload); // This won't serialize Dictionary well.
                                                              // For Dictionaries, custom JSON construction or a proper serializable class is needed.
                                                              // Given the shift to /api/ct_assessment, this method is likely obsolete for CT.
        
        using (UnityWebRequest www = new UnityWebRequest("http://127.0.0.1:5000/api/assessment", "POST")) // OLD URL
        {
            // This part needs proper JSON serialization for Dictionary if used.
            // byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(jsonPayload); 
            // www.uploadHandler = new UploadHandlerRaw(bodyRaw);
            // www.downloadHandler = new DownloadHandlerBuffer();
            // www.SetRequestHeader("Content-Type", "application/json");
            // yield return www.SendWebRequest(); // ...
        }
        yield return null; // Placeholder
    }

    [System.Serializable]
    private class AssessmentResponse
    {
        public Dictionary<string, int> scores;
        public string assessment;
    }

    public AudioClip whichArrowAudioClip; // Assign in inspector
    private int guidedBlankIndex = -1; // Index of the blank slot if in guided mode
    private bool waitingForGuidedInput = false;

    // Call this when the user picks left or right for the blank slot
    public void OnGuidedBlankFilled(string userChoice)
    {
        if (blankLeftButton != null) blankLeftButton.gameObject.SetActive(false);
        if (blankRightButton != null) blankRightButton.gameObject.SetActive(false);
        if (blankForwardButton != null) blankForwardButton.gameObject.SetActive(false);
        if (blankBackwardButton != null) blankBackwardButton.gameObject.SetActive(false);
        // Do NOT re-enable main movement buttons here
        if (runButton != null) runButton.interactable = true;
        if (!waitingForGuidedInput || guidedBlankIndex < 0) return;
        userBlankChoice = userChoice;
        // Replace the blank slot UI at the correct index
        if (actionQueueTransform.childCount > guidedBlankIndex)
        {
            Destroy(actionQueueTransform.GetChild(guidedBlankIndex).gameObject);
            GameObject actionImageInstance = Instantiate(actionImagePrefab, actionQueueTransform, false);
            if (userChoice == "turn left")
                actionImageInstance.GetComponent<Image>().sprite = rotateLeftSprite;
            else if (userChoice == "turn right")
                actionImageInstance.GetComponent<Image>().sprite = rotateRightSprite;
            else if (userChoice == "forward")
                actionImageInstance.GetComponent<Image>().sprite = forwardSprite;
            else if (userChoice == "backward")
                actionImageInstance.GetComponent<Image>().sprite = backwardSprite;
            actionImageInstance.transform.SetSiblingIndex(guidedBlankIndex);
        }
        var actions = actionQueue.ToList();
        if (userChoice == "turn left")
            actions[guidedBlankIndex] = new RotateAction(-rotationAngle);
        else if (userChoice == "turn right")
            actions[guidedBlankIndex] = new RotateAction(rotationAngle);
        else if (userChoice == "forward")
            actions[guidedBlankIndex] = new MoveAction(Vector3.forward);
        else if (userChoice == "backward")
            actions[guidedBlankIndex] = new MoveAction(-Vector3.forward);
        actionQueue = new Queue<CharacterAction>(actions);
        waitingForGuidedInput = false;
    }

    private void PlayWhichArrowAudio()
    {
        if (whichArrowAudioClip != null && audioSource != null)
        {
            audioSource.PlayOneShot(whichArrowAudioClip);
        }
        // Optionally, show a text prompt as well
        if (chatGPTResponseText != null)
        {
            chatGPTResponseText.text = "Which arrow belongs here?";
        }
    }

    public Sprite blankSlotSprite; // Assign a question mark or blank icon in inspector
    public Button blankLeftButton; // Assign in inspector, for 'turn left' choice
    public Button blankRightButton; // Assign in inspector, for 'turn right' choice

    private GameObject blankSlotInstance = null; // Track the blank slot for animation/reset
    private string userBlankChoice = null; // Track user's answer for blank

    private void ResetBlankSlotUI()
    {
        // Remove the current slot if present
        if (actionQueueTransform.childCount > guidedBlankIndex)
        {
            Destroy(actionQueueTransform.GetChild(guidedBlankIndex).gameObject);
        }
        // Add a new blank slot
        blankSlotInstance = Instantiate(actionImagePrefab, actionQueueTransform);
        var img = blankSlotInstance.GetComponent<Image>();
        if (blankSlotSprite != null) img.sprite = blankSlotSprite;
        img.color = Color.yellow;
        blankSlotInstance.transform.SetSiblingIndex(guidedBlankIndex);
        StartCoroutine(PulseBlankSlot(blankSlotInstance));
        // Show left/right/forward/backward buttons again
        if (blankLeftButton != null)
        {
            blankLeftButton.gameObject.SetActive(true);
            blankLeftButton.onClick.RemoveAllListeners();
            blankLeftButton.onClick.AddListener(() => OnGuidedBlankFilled("turn left"));
        }
        if (blankRightButton != null)
        {
            blankRightButton.gameObject.SetActive(true);
            blankRightButton.onClick.RemoveAllListeners();
            blankRightButton.onClick.AddListener(() => OnGuidedBlankFilled("turn right"));
        }
        if (blankForwardButton != null)
        {
            blankForwardButton.gameObject.SetActive(true);
            blankForwardButton.onClick.RemoveAllListeners();
            blankForwardButton.onClick.AddListener(() => OnGuidedBlankFilled("forward"));
        }
        if (blankBackwardButton != null)
        {
            blankBackwardButton.gameObject.SetActive(true);
            blankBackwardButton.onClick.RemoveAllListeners();
            blankBackwardButton.onClick.AddListener(() => OnGuidedBlankFilled("backward"));
        }
        // Disable main movement buttons
        if (moveForwardButton != null) moveForwardButton.interactable = false;
        if (moveDownButton != null) moveDownButton.interactable = false;
        waitingForGuidedInput = true;
        userBlankChoice = null;
    }

    private bool IsBlankAnswerCorrect()
    {
        LevelData levelData = allLevelsData[currentLevel - 1];
        return userBlankChoice == levelData.correctBlankAnswer;
    }

    private void ShowTryAgainMessage()
    {
        if (chatGPTResponseText != null)
            chatGPTResponseText.text = "Try again! Which arrow belongs here?";
    }

    private IEnumerator PulseBlankSlot(GameObject slot)
    {
        if (slot == null) yield break;
        Color colorA = Color.blue;
        Color colorB = Color.white;
        float flashSpeed = 2.5f; // Flash speed
        float t = 0f;
        Image img = slot.GetComponent<Image>();
        while (waitingForGuidedInput && slot != null)
        {
            t += Time.deltaTime;
            // Flash
            float flash = (Mathf.Sin(t * flashSpeed) + 1f) / 2f;
            if (img != null)
                img.color = Color.Lerp(colorA, colorB, flash);
            yield return null;
        }
        if (slot != null && img != null)
            img.color = colorA;
    }

    public GameObject wrongAnswerPopup; // Assign in Inspector
    public Button wrongAnswerTryAgainButton; // Assign in Inspector

    public MultiTargetCamera multiTargetCamera; // Assign in Inspector

    public Button blankForwardButton;  // Assign in Inspector, for 'forward' choice
    public Button blankBackwardButton; // Assign in Inspector, for 'backward' choice

    // Add this helper method at the end of CharacterMove:
    // Called by AppleCluster when drag ends (OnMouseUp)
    public void UpdateDraggedApplePosition(Vector3 worldPos)
    {
        if (allLevelsData != null && currentLevel > 0 && currentLevel <= allLevelsData.Count)
        {
            var levelData = allLevelsData[currentLevel - 1];
            if (levelData.isAppleDragGuidedLevel && currentLevelApplePositions.Count > 0)
            {
                float gridSize = this.gridSize;
                Vector3 local = worldPos - robotStartWorldPos;
                int x = Mathf.RoundToInt(local.x / gridSize);
                int y = Mathf.RoundToInt(local.z / gridSize);
                currentLevelApplePositions[0] = new Vector2Int(x, y);
            }
        }
    }
}

// Ensure AppleCluster.cs has ApplesCount and CollectApples() correctly implemented
/*
public class AppleCluster : MonoBehaviour
{
    public int applesInCluster = 1; // Default to 1 if it's a single apple
    public int ApplesCount { get { return applesInCluster; } private set { applesInCluster = value; } }

    public int CollectApples()
    {
        if (gameObject.activeSelf && applesInCluster > 0)
        {
            int collected = applesInCluster; // Or just 1 if it's always one apple per cluster object
            Debug.Log($"Collecting {collected} apples from {gameObject.name}");
            gameObject.SetActive(false); // Deactivate the apple GameObject
            applesInCluster = 0; // Mark as collected
            return collected;
        }
        return 0;
    }
}
*/
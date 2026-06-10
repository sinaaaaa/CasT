using UnityEngine;
using UnityEngine.Serialization;
using System.Collections.Generic;

public class GridObjectSetup : MonoBehaviour
{
    [Header("Grid Object Prefabs")]
    public GameObject bananaPrefab;
    public GameObject binPrefab;
    public GameObject newspaperPrefab;
    public GameObject recyclePrefab;
    public GameObject applePrefab;
    public GameObject boxPrefab;
    public GameObject amazonBoxPrefab;

    [Header("Additional Grid Object Prefabs")]
    public GameObject bagPrefab;
    public GameObject bookPrefab;
    [FormerlySerializedAs("cesarPrefab")]
    public GameObject scissorsPrefab;
    public GameObject crayonsPrefab;
    public GameObject blackCrayonPrefab;
    public GameObject gluePrefab;
    public GameObject homePrefab;
    public GameObject mailPrefab;
    public GameObject packagePrefab;
    public GameObject pencilPrefab;
    public GameObject postPrefab;
    public GameObject schoolPrefab;
    public GameObject greentreePrefab;

    [Header("Level Configuration")]
    public List<LevelData> customLevels = new List<LevelData>();

    [Header("Debug")]
    public bool showDebugInfo = true;

    private void Start()
    {
        // Find CharacterMove and assign prefabs
        CharacterMove characterMove = FindObjectOfType<CharacterMove>();
        if (characterMove != null)
        {
            characterMove.bananaPrefab = bananaPrefab;
            characterMove.binPrefab = binPrefab;
            characterMove.newspaperPrefab = newspaperPrefab;
            characterMove.recyclePrefab = recyclePrefab;
            characterMove.applePrefab = applePrefab;
            characterMove.boxPrefab = boxPrefab;
            characterMove.amazonBoxPrefab = amazonBoxPrefab;
            characterMove.bagPrefab = bagPrefab;
            characterMove.bookPrefab = bookPrefab;
            characterMove.scissorsPrefab = scissorsPrefab;
            characterMove.crayonsPrefab = crayonsPrefab;
            characterMove.blackCrayonPrefab = blackCrayonPrefab;
            characterMove.gluePrefab = gluePrefab;
            characterMove.homePrefab = homePrefab;
            characterMove.mailPrefab = mailPrefab;
            characterMove.packagePrefab = packagePrefab;
            characterMove.pencilPrefab = pencilPrefab;
            characterMove.postPrefab = postPrefab;
            characterMove.schoolPrefab = schoolPrefab;
            characterMove.greentreePrefab = greentreePrefab;

            if (showDebugInfo)
            {
                Debug.Log("[GridObjectSetup] Assigned grid object prefabs to CharacterMove");
            }
        }
        else
        {
            Debug.LogError("[GridObjectSetup] CharacterMove not found in scene!");
        }
    }

    [ContextMenu("Create Sample Level")]
    public void CreateSampleLevel()
    {
        LevelData sampleLevel = new LevelData
        {
            levelName = "Sample Level",
            maxAttempts = 3,
            robotStartPosition = new Vector2Int(0, 0),
            robotStartFacing = Vector2Int.up,
            gridObjects = new List<GridObjectData>
            {
                new GridObjectData { position = new Vector2Int(0, 0), objectType = "newspaper", isStartObject = true },
                new GridObjectData { position = new Vector2Int(2, 2), objectType = "banana", isEndObject = true },
                new GridObjectData { position = new Vector2Int(1, 1), objectType = "box", isStartObject = false, isEndObject = false }
            }
        };

        customLevels.Add(sampleLevel);
        Debug.Log("[GridObjectSetup] Created sample level with newspaper -> banana path");
    }

    [ContextMenu("Validate Prefabs")]
    public void ValidatePrefabs()
    {
        List<string> missingPrefabs = new List<string>();
        
        // Original prefabs
        if (bananaPrefab == null) missingPrefabs.Add("banana");
        if (binPrefab == null) missingPrefabs.Add("bin");
        if (newspaperPrefab == null) missingPrefabs.Add("newspaper");
        if (recyclePrefab == null) missingPrefabs.Add("recycle");
        if (applePrefab == null) missingPrefabs.Add("apple");
        if (boxPrefab == null) missingPrefabs.Add("box");
        if (amazonBoxPrefab == null) missingPrefabs.Add("amazon-box");

        // Additional prefabs
        if (bagPrefab == null) missingPrefabs.Add("bag");
        if (bookPrefab == null) missingPrefabs.Add("book");
        if (scissorsPrefab == null) missingPrefabs.Add("scissors");
        if (crayonsPrefab == null) missingPrefabs.Add("crayon-box");
        if (blackCrayonPrefab == null) missingPrefabs.Add("crayon");
        if (gluePrefab == null) missingPrefabs.Add("glue");
        if (homePrefab == null) missingPrefabs.Add("home");
        if (mailPrefab == null) missingPrefabs.Add("mail");
        if (packagePrefab == null) missingPrefabs.Add("package");
        if (pencilPrefab == null) missingPrefabs.Add("pencil");
        if (postPrefab == null) missingPrefabs.Add("post");
        if (schoolPrefab == null) missingPrefabs.Add("school");
        if (greentreePrefab == null) missingPrefabs.Add("greentree");

        if (missingPrefabs.Count > 0)
        {
            Debug.LogWarning($"[GridObjectSetup] Missing prefabs: {string.Join(", ", missingPrefabs)}");
        }
        else
        {
            Debug.Log("[GridObjectSetup] All grid object prefabs are assigned!");
        }
    }

    [ContextMenu("Test Object Placement")]
    public void TestObjectPlacement()
    {
        if (bananaPrefab != null)
        {
            Vector3 testPosition = new Vector3(0, 0, 0);
            GameObject testObj = Instantiate(bananaPrefab, testPosition, Quaternion.identity);
            Debug.Log($"[GridObjectSetup] Test object placed at {testPosition}");
            
            // Destroy after 3 seconds
            Destroy(testObj, 3f);
        }
        else
        {
            Debug.LogError("[GridObjectSetup] Cannot test placement - banana prefab is null!");
        }
    }
}

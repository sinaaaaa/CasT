using UnityEngine;
using UnityEngine.Networking;
using System.Collections;
using System.Collections.Generic;
using System;
using System.Linq;

public class StudentDataManager : MonoBehaviour
{
    public static StudentDataManager Instance { get; private set; }
    
    private Dictionary<int, StudentData> students = new Dictionary<int, StudentData>();
    private StudentData currentStudent;
    private const string API_BASE_URL = "http://localhost:5000/api";

    private void Awake()
    {
        if (Instance == null)
        {
            Instance = this;
            DontDestroyOnLoad(gameObject);
            LoadStudentData();
        }
        else
        {
            Destroy(gameObject);
        }
    }

    private void LoadStudentData()
    {
        // Load student data from PlayerPrefs
        string jsonData = PlayerPrefs.GetString("StudentData", "{}");
        StudentDataWrapper wrapper = JsonUtility.FromJson<StudentDataWrapper>(jsonData);
        
        if (wrapper != null && wrapper.students != null)
        {
            students = wrapper.students.ToDictionary(s => s.id);
        }
    }

    private void SaveStudentData()
    {
        StudentDataWrapper wrapper = new StudentDataWrapper
        {
            students = students.Values.ToList()
        };
        string jsonData = JsonUtility.ToJson(wrapper);
        PlayerPrefs.SetString("StudentData", jsonData);
        PlayerPrefs.Save();
    }

    public void LoginStudent(string username, string password, Action<bool, string> callback)
    {
        // For demo purposes, accept any username/password
        var student = students.Values.FirstOrDefault(s => s.username == username);
        
        if (student == null)
        {
            // Create new student if doesn't exist
            student = new StudentData
            {
                id = students.Count + 1,
                username = username
            };
            students[student.id] = student;
            SaveStudentData();
        }

        currentStudent = student;
        callback(true, "Login successful");
    }

    public void SaveAssessmentScore(string level, int decomposition, int patternRecognition, 
                                  int algorithmicThinking, int debugging, List<string> actionLog)
    {
        if (currentStudent == null)
        {
            Debug.LogError("Cannot save assessment: No student logged in");
            return;
        }

        StartCoroutine(SendAssessmentToServer(level, decomposition, patternRecognition, 
                                            algorithmicThinking, debugging, actionLog));
    }

    private IEnumerator SendAssessmentToServer(string level, int decomposition, int patternRecognition, 
                                             int algorithmicThinking, int debugging, List<string> actionLog)
    {
        var assessment = new AssessmentData
        {
            student_id = currentStudent.id,
            level = level,
            decomposition_score = decomposition,
            pattern_recognition_score = patternRecognition,
            algorithmic_thinking_score = algorithmicThinking,
            debugging_score = debugging,
            total_score = decomposition + patternRecognition + algorithmicThinking + debugging,
            action_log = string.Join(",", actionLog)
        };

        string jsonData = JsonUtility.ToJson(assessment);

        using (UnityWebRequest www = new UnityWebRequest($"{API_BASE_URL}/assessment", "POST"))
        {
            byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(jsonData);
            www.uploadHandler = new UploadHandlerRaw(bodyRaw);
            www.downloadHandler = new DownloadHandlerBuffer();
            www.SetRequestHeader("Content-Type", "application/json");

            yield return www.SendWebRequest();

            if (www.result != UnityWebRequest.Result.Success)
            {
                Debug.LogError($"Error saving assessment: {www.error}");
            }
            else
            {
                currentStudent.assessments.Add(assessment);
                Debug.Log("Assessment saved successfully!");
            }
        }
    }

    public StudentData GetCurrentStudent()
    {
        return currentStudent;
    }

    public Dictionary<int, StudentData> GetAllStudents()
    {
        return students;
    }

    public bool IsStudentLoggedIn()
    {
        return currentStudent != null;
    }

    public void Logout()
    {
        currentStudent = null;
    }

    public void AddAssessment(AssessmentData assessment)
    {
        if (currentStudent == null) return;

        assessment.student_id = currentStudent.id;
        currentStudent.assessments.Add(assessment);
        SaveStudentData();
    }

    public void SetCurrentStudent(StudentData student)
    {
        currentStudent = student;
        Debug.Log($"[StudentDataManager] Current student set: {student.username} (ID: {student.id})");
    }
}

[Serializable]
public class LoginData
{
    public string username;
    public string password;
}

[Serializable]
public class LoginResponse
{
    public string message;
    public int user_id;
    public string role;
}

[Serializable]
public class StudentDataWrapper
{
    public List<StudentData> students;
} 
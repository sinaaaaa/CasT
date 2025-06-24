using UnityEngine;

public class StudentSceneInitializer : MonoBehaviour
{
    public StudentData student;

    private void Start()
    {
        StudentDataManager.Instance.SetCurrentStudent(student);
    }
} 
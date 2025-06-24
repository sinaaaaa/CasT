using System;
using System.Collections.Generic;

[Serializable]
public class StudentData
{
    public int id;
    public string username;
    public List<AssessmentData> assessments = new List<AssessmentData>();
}

[Serializable]
public class AssessmentData
{
    public int student_id;
    public string level;
    public int decomposition_score;
    public int pattern_recognition_score;
    public int algorithmic_thinking_score;
    public int debugging_score;
    public int total_score;
    public string action_log;
} 
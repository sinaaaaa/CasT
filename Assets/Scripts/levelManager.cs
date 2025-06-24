using UnityEngine;
using UnityEngine.SceneManagement;
using System.Collections;
using UnityEngine.Networking;
using System;

public class LevelManager : MonoBehaviour
{
    private string currentLevelName;
    private string mainMenuSceneName = "LevelManager"; // Adjust this to your Level Manager scene name

    public void LoadLevel(string levelName)
    {
        Debug.Log("Attempting to load level: " + levelName);

        if (SceneManager.GetSceneByName(levelName).isLoaded)
        {
            Debug.LogError("Level already loaded: " + levelName);
            return;
        }

        SceneManager.LoadScene(levelName, LoadSceneMode.Single); // Load the new level
        currentLevelName = levelName;
    }

    public void UnloadCurrentLevel()
    {
        // This method might not be needed if using LoadSceneMode.Single
        Debug.Log("Returning to Level Manager scene.");

        if (currentLevelName != mainMenuSceneName)
        {
            SceneManager.LoadScene(mainMenuSceneName, LoadSceneMode.Single);
            currentLevelName = null;
        }
        else
        {
            Debug.Log("Already in the Level Manager scene.");
        }
    }
}


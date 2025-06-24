using System.Collections;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

public class LoadingSceneController : MonoBehaviour
{
    public ClassicProgressBar progressBar; // Assign this in the inspector
    // public string sceneToLoad; // Name of the scene to load - This will be set from PlayerPrefs
    public float minimumLoadingTime = 50f; // Minimum time in seconds for the loading process

    private void Start()
    {
        StartCoroutine(LoadSceneAsync());
    }

    private IEnumerator LoadSceneAsync()
    {
        string sceneToLoad = PlayerPrefs.GetString("SceneToLoadAfterLoading", "Level1"); // Default to Level1 if not set
        AsyncOperation asyncLoad = SceneManager.LoadSceneAsync(sceneToLoad);
        asyncLoad.allowSceneActivation = false;

        float timer = 0f; // Timer to track the loading time

        while (!asyncLoad.isDone)
        {
            timer += Time.deltaTime; // Increment the timer
            float progress = Mathf.Clamp01(asyncLoad.progress / 0.9f); // Normalize progress to 0-1 range

            // Update progress bar based on either actual progress or the timer, whichever is greater
            progressBar.SetFillAmount(Mathf.Clamp01(System.Math.Max(progress, timer / minimumLoadingTime)));

            // Check if both the actual loading is complete and the timer has reached the minimum time
            if (asyncLoad.progress >= 0.9f && timer >= minimumLoadingTime)
            {
                asyncLoad.allowSceneActivation = true; // Allow scene activation
            }

            yield return null;
        }
    }


}

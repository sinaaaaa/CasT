using UnityEngine;
using UnityEngine.SceneManagement;

public class SceneSwitcher : MonoBehaviour
{
    public void SwitchToCameraFeed()
    {
        SceneManager.LoadScene("CameraFeedScene");
    }

    public void SwitchToMainScene()
    {
        SceneManager.LoadScene("Map_V1");
    }
}

using UnityEngine;
using UnityEngine.UI;
using UnityEngine.SceneManagement;
using System.Collections;
using UnityEngine.Networking;

public class SimpleWebcamDisplay : MonoBehaviour
{
    public RawImage rawImage;
    public Button captureButton;

    private WebCamTexture webcamTexture;
    private void Start()
    {
        webcamTexture = new WebCamTexture(1920,1080);

        if (rawImage)
        {
            rawImage.texture = webcamTexture;
        }

        // Start the camera feed automatically when this scene loads.
        ToggleCamera();
    }

    public void ToggleCamera()
    {
        if (webcamTexture.isPlaying)
        {
            webcamTexture.Stop();
            if (captureButton) captureButton.gameObject.SetActive(false);
        }
        else
        {
            webcamTexture.Play();
            if (captureButton) captureButton.gameObject.SetActive(true);
        }
    }

    public void CaptureImage()
    {
        Texture2D snap = new Texture2D(webcamTexture.width, webcamTexture.height);
        snap.SetPixels(webcamTexture.GetPixels());
        snap.Apply();

        byte[] bytes = snap.EncodeToPNG();
        string path = Application.persistentDataPath + "/capturedImage.png";
        System.IO.File.WriteAllBytes(path, bytes);

        StartCoroutine(SendImageToServer(path));
    }

    public void ReturnToMainScene()
    {
        if (webcamTexture && webcamTexture.isPlaying)
        {
            webcamTexture.Stop();
        }
        SceneManager.LoadScene("Map_V1");
    }

    IEnumerator SendImageToServer(string imagePath)
    {
        WWWForm form = new WWWForm();
        form.AddBinaryData("image", System.IO.File.ReadAllBytes(imagePath), imagePath, "image/png");

        using (UnityWebRequest www = UnityWebRequest.Post("http://127.0.0.1:5000/upload", form))
        {
            yield return www.SendWebRequest();

            if (www.result != UnityWebRequest.Result.Success)
            {
                Debug.Log(www.error);
            }
            else
            {
                // Store the server response in PlayerPrefs to access it in the next scene
                PlayerPrefs.SetString("ServerResponse", www.downloadHandler.text);
                PlayerPrefs.Save();

                // Switch to the other scene where the CharacterMove script is present
                SceneManager.LoadScene("Map_V1");
            }
        }
    }
}

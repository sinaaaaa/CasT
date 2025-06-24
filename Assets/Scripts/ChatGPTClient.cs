using System.Collections;
using UnityEngine;
using UnityEngine.Networking;
using TMPro;

public class ChatGPTClient : MonoBehaviour
{
    public TMP_InputField inputField;
    public TMP_Text responseText;

    private const string URL = "http://127.0.0.1:5000/chat";

    public void SendMessageToServer()
    {
        string userText = inputField.text;
        StartCoroutine(SendPostRequest(userText));
    }

    IEnumerator SendPostRequest(string userText)
    {
        // Create JSON data
        string jsonData = JsonUtility.ToJson(new Payload { text = userText });

        // Setup UnityWebRequest
        using (UnityWebRequest www = new UnityWebRequest(URL, "POST"))
        {
            byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(jsonData);
            www.uploadHandler = new UploadHandlerRaw(bodyRaw);
            www.downloadHandler = new DownloadHandlerBuffer();
            www.SetRequestHeader("Content-Type", "application/json");

            // Send the request and wait for a response
            yield return www.SendWebRequest();

            // Check for errors
            if (www.result != UnityWebRequest.Result.Success)
            {
                Debug.LogError("Error: " + www.error);
            }
            else
            {
                // Get the response text
                string result = www.downloadHandler.text;
                var responseObj = JsonUtility.FromJson<Response>(result);
                responseText.text = responseObj.response;
            }
        }
    }

    [System.Serializable]
    private class Payload
    {
        public string text;
    }

    [System.Serializable]
    private class Response
    {
        public string response;
    }
}

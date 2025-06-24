using UnityEngine;
using UnityEngine.Networking;
using System.Collections;
using System.Collections.Generic;
using System;
using TMPro;
#if UNITY_WEBGL && !UNITY_EDITOR
using System.Runtime.InteropServices;
#endif

public class ChatGPTManager : MonoBehaviour
{
    [SerializeField] private string apiKey = "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";
    [SerializeField] private TMPro.TextMeshProUGUI responseText;
    
    private const string API_URL = "https://api.openai.com/v1/chat/completions";
    private const int MAX_RETRIES = 3;
    private const float RETRY_DELAY = 2f;
    
    private bool isProcessing = false;
    private float lastRequestTime = 0f;
    private const float MIN_REQUEST_INTERVAL = 1f;

    [Serializable]
    private class Message
    {
        public string role;
        public string content;
    }

    [Serializable]
    private class ChatRequest
    {
        public string model = "gpt-4o";
        public Message[] messages;
        public int max_tokens = 150;
    }

    [Serializable]
    private class ChatResponse
    {
        public string id;
        public string model;
        public Choice[] choices;
        public Usage usage;
    }

    [Serializable]
    private class Usage
    {
        public int prompt_tokens;
        public int completion_tokens;
        public int total_tokens;
    }

    [Serializable]
    private class Choice
    {
        public Message message;
    }

    private void Start()
    {
        Debug.Log("[ChatGPT] Initializing ChatGPT Manager...");
        // Load API key from PlayerPrefs if available
        if (PlayerPrefs.HasKey("OpenAI_API_Key"))
        {
            apiKey = PlayerPrefs.GetString("OpenAI_API_Key");
            Debug.Log("[ChatGPT] API Key loaded from PlayerPrefs");
        }
        else
        {
            Debug.LogWarning("[ChatGPT] No API Key found in PlayerPrefs");
        }

        // Test API connection on start
        StartCoroutine(TestApiConnection());
    }

    private IEnumerator TestApiConnection()
    {
        Debug.Log("[ChatGPT] ===== Starting API Connection Test =====");
        Debug.Log("[ChatGPT] Using API Key: " + apiKey.Substring(0, 8) + "...");
        string testMessage = "Hello, this is a connection test.";
        
        var request = new ChatRequest
        {
            messages = new Message[]
            {
                new Message { role = "user", content = testMessage }
            }
        };

        string jsonRequest = JsonUtility.ToJson(request);
        Debug.Log($"[ChatGPT] Test request JSON: {jsonRequest}");

        using (UnityWebRequest webRequest = new UnityWebRequest(API_URL, "POST"))
        {
            byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(jsonRequest);
            webRequest.uploadHandler = new UploadHandlerRaw(bodyRaw);
            webRequest.downloadHandler = new DownloadHandlerBuffer();
            webRequest.SetRequestHeader("Content-Type", "application/json");
            webRequest.SetRequestHeader("Authorization", $"Bearer {apiKey}");

            Debug.Log("[ChatGPT] Sending test request to API...");
            yield return webRequest.SendWebRequest();

            if (webRequest.result == UnityWebRequest.Result.Success)
            {
                Debug.Log("[ChatGPT] ===== API Connection Test Successful! =====");
                Debug.Log($"[ChatGPT] Response Code: {webRequest.responseCode}");
                
                try
                {
                    ChatResponse response = JsonUtility.FromJson<ChatResponse>(webRequest.downloadHandler.text);
                    if (response.choices != null && response.choices.Length > 0)
                    {
                        string responseContent = response.choices[0].message.content.Trim();
                        Debug.Log($"[ChatGPT] Assistant's Response: {responseContent}");
                        Debug.Log($"[ChatGPT] Model Used: {response.model}");
                        Debug.Log($"[ChatGPT] Total Tokens: {response.usage?.total_tokens ?? 0}");
                    }
                }
                catch (Exception e)
                {
                    Debug.LogError($"[ChatGPT] Error parsing response: {e.Message}");
                    Debug.Log($"[ChatGPT] Raw Response: {webRequest.downloadHandler.text}");
                }
                
                Debug.Log("[ChatGPT] ===== API Connection Test Complete =====");
            }
            else
            {
                Debug.LogError("[ChatGPT] ===== API Connection Test Failed! =====");
                Debug.LogError($"[ChatGPT] Error: {webRequest.error}");
                Debug.LogError($"[ChatGPT] Response Code: {webRequest.responseCode}");
                Debug.LogError($"[ChatGPT] Response: {webRequest.downloadHandler.text}");
                Debug.LogError("[ChatGPT] ===== API Connection Test Failed =====");
            }
        }
    }

    public void SendMessage(string message, Action<string> onResponse)
    {
        Debug.Log("[ChatGPT] ===== Starting New Message Request =====");
        Debug.Log($"[ChatGPT] Message to send: {message}");
        Debug.Log($"[ChatGPT] API Key present: {!string.IsNullOrEmpty(apiKey)}");
        Debug.Log($"[ChatGPT] Is processing: {isProcessing}");
        Debug.Log($"[ChatGPT] Time since last request: {Time.time - lastRequestTime:F1} seconds");
        
        if (string.IsNullOrEmpty(apiKey))
        {
            string error = "API key is not set!";
            Debug.LogError("[ChatGPT] " + error);
            UpdateResponseText("Error: " + error);
            onResponse?.Invoke(null);
            return;
        }

        if (isProcessing)
        {
            string error = "Already processing a request. Please wait.";
            Debug.LogWarning("[ChatGPT] " + error);
            UpdateResponseText(error);
            onResponse?.Invoke(null);
            return;
        }

        float timeSinceLastRequest = Time.time - lastRequestTime;
        if (timeSinceLastRequest < MIN_REQUEST_INTERVAL)
        {
            float waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
            string error = $"Please wait {waitTime:F1} seconds before sending another request.";
            Debug.LogWarning("[ChatGPT] " + error);
            UpdateResponseText(error);
            onResponse?.Invoke(null);
            return;
        }

        Debug.Log("[ChatGPT] Starting request coroutine...");
        StartCoroutine(SendRequestCoroutine(message, onResponse));
    }

    private IEnumerator SendRequestCoroutine(string message, Action<string> onResponse)
    {
        isProcessing = true;
        int retryCount = 0;
        bool success = false;
        
        // Add timeout safety
        float startTime = Time.time;
        float timeoutDuration = 5f; // 5 seconds max per attempt

        Debug.Log("[ChatGPT] ===== Starting Request Coroutine =====");
        Debug.Log($"[ChatGPT] Message: {message}");
        Debug.Log($"[ChatGPT] Max retries: {MAX_RETRIES}");

        while (!success && retryCount < MAX_RETRIES)
        {
            // Reset timeout for this attempt
            startTime = Time.time;
            if (retryCount > 0)
            {
                Debug.Log($"[ChatGPT] ===== Retry Attempt {retryCount} of {MAX_RETRIES} =====");
                UpdateResponseText($"Retry attempt {retryCount} of {MAX_RETRIES}");
                yield return new WaitForSeconds(RETRY_DELAY * retryCount);
            }

            var request = new ChatRequest
            {
                messages = new Message[]
                {
                    new Message { role = "user", content = message }
                }
            };

            string jsonRequest = JsonUtility.ToJson(request);
            Debug.Log($"[ChatGPT] Request JSON: {jsonRequest}");

            using (UnityWebRequest webRequest = new UnityWebRequest(API_URL, "POST"))
            {
                byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(jsonRequest);
                webRequest.uploadHandler = new UploadHandlerRaw(bodyRaw);
                webRequest.downloadHandler = new DownloadHandlerBuffer();
                webRequest.SetRequestHeader("Content-Type", "application/json");
                webRequest.SetRequestHeader("Authorization", $"Bearer {apiKey}");

                Debug.Log("[ChatGPT] Sending web request...");
                
                // Send request with timeout check
                webRequest.SendWebRequest();
                while (!webRequest.isDone)
                {
                    // Check for timeout
                    if (Time.time - startTime > timeoutDuration)
                    {
                        Debug.LogWarning("[ChatGPT] Request timed out after " + timeoutDuration + " seconds");
                        break;
                    }
                    yield return null;
                }

                Debug.Log($"[ChatGPT] Request completed with result: {webRequest.result}");
                Debug.Log($"[ChatGPT] Response Code: {webRequest.responseCode}");
                Debug.Log($"[ChatGPT] Response: {(webRequest.downloadHandler != null ? webRequest.downloadHandler.text : "No response")}");

                if (webRequest.result == UnityWebRequest.Result.Success)
                {
                    Debug.Log("[ChatGPT] Request successful!");
                    try
                    {
                        ChatResponse response = JsonUtility.FromJson<ChatResponse>(webRequest.downloadHandler.text);
                        if (response.choices != null && response.choices.Length > 0)
                        {
                            string responseContent = response.choices[0].message.content.Trim();
                            Debug.Log($"[ChatGPT] Response content: {responseContent}");
                            UpdateResponseText(responseContent);
                            onResponse?.Invoke(responseContent);
                            success = true;
                        }
                        else
                        {
                            string error = "Invalid response format";
                            Debug.LogError($"[ChatGPT] {error}: {webRequest.downloadHandler.text}");
                            UpdateResponseText("Error: " + error);
                        }
                    }
                    catch (Exception e)
                    {
                        string error = $"Error parsing response: {e.Message}";
                        Debug.LogError($"[ChatGPT] {error}\nResponse: {webRequest.downloadHandler.text}");
                        UpdateResponseText("Error: " + error);
                    }
                }
                else
                {
                    string errorMessage = $"Error: {webRequest.error}";
                    if (webRequest.responseCode == 429)
                    {
                        errorMessage = "Rate limit exceeded. Please wait before trying again.";
                    }
                    else if (webRequest.responseCode == 401)
                    {
                        errorMessage = "Invalid API key. Please check your API key.";
                    }
                    Debug.LogError($"[ChatGPT] {errorMessage}\nResponse Code: {webRequest.responseCode}\nResponse: {webRequest.downloadHandler.text}");
                    UpdateResponseText(errorMessage);
                }
            }

            retryCount++;
        }

        if (!success)
        {
            string error = "Failed to get response after all retries";
            Debug.LogError("[ChatGPT] " + error);
            UpdateResponseText(error);
            
            // Return a friendly fallback message instead of null
            string fallbackResponse = "I couldn't connect to the AI service right now, but you're doing great!";
            Debug.Log("[ChatGPT] Using fallback response");
            onResponse?.Invoke(fallbackResponse);
        }

        isProcessing = false;
        lastRequestTime = Time.time;
        Debug.Log("[ChatGPT] ===== Request Coroutine Completed =====");
    }

    private void UpdateResponseText(string text)
    {
        if (responseText != null)
        {
            responseText.text = text;
        }
        Speak(text);
    }

    #if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")]
    private static extern void SpeakTTS(string message);
    #endif

    private void Speak(string text)
    {
        #if UNITY_WEBGL && !UNITY_EDITOR
        SpeakTTS(text);
        #endif
        // For other platforms, you can add more TTS support if needed
    }

    public void SetApiKey(string key)
    {
        apiKey = key;
        PlayerPrefs.SetString("OpenAI_API_Key", key);
        PlayerPrefs.Save();
    }
}

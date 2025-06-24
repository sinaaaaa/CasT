using UnityEngine;
using UnityEngine.UI;

public class ChatUIManager : MonoBehaviour
{
    public InputField userInputField;
    public Text chatOutputText;
    public ChatGPTManager chatGPTManager;

    public void OnSendButtonClicked()
    {
        string userInput = userInputField.text;
        chatGPTManager.SendMessage(userInput, OnChatResponseReceived);
    }

    private void OnChatResponseReceived(string response)
    {
        if (!string.IsNullOrEmpty(response))
        {
            chatOutputText.text = response;
        }
        else
        {
            chatOutputText.text = "Error in receiving response";
        }
    }
}

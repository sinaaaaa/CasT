using UnityEngine;
using UnityEngine.UI;
using System.Collections;

public class AudioInitializer : MonoBehaviour
{
    [Header("Audio Settings")]
    [SerializeField] private AudioClip silentClip; // A very short silent audio clip
    [SerializeField] private AudioSource audioSource;
    
    [Header("UI Elements to Trigger Audio")]
    [SerializeField] private Button[] buttonsToMonitor; // Buttons that should trigger audio unlock
    
    private bool audioUnlocked = false;
    
    void Start()
    {
        // Create a silent audio clip if none is assigned
        if (silentClip == null)
        {
            silentClip = AudioClip.Create("Silent", 1, 1, 44100, false);
        }
        
        // Get or create AudioSource
        if (audioSource == null)
        {
            audioSource = GetComponent<AudioSource>();
            if (audioSource == null)
            {
                audioSource = gameObject.AddComponent<AudioSource>();
            }
        }
        
        // Set up button listeners to unlock audio
        SetupButtonListeners();
        
        // Also listen for any UI interaction
        StartCoroutine(MonitorForUserInteraction());
    }
    
    private void SetupButtonListeners()
    {
        if (buttonsToMonitor != null)
        {
            foreach (Button button in buttonsToMonitor)
            {
                if (button != null)
                {
                    button.onClick.AddListener(UnlockAudio);
                }
            }
        }
    }
    
    private IEnumerator MonitorForUserInteraction()
    {
        // Wait for any mouse click or touch
        while (!audioUnlocked)
        {
            if (Input.GetMouseButtonDown(0) || Input.touchCount > 0)
            {
                UnlockAudio();
                break;
            }
            yield return null;
        }
    }
    
    public void UnlockAudio()
    {
        if (!audioUnlocked)
        {
            Debug.Log("[AudioInitializer] Unlocking audio context...");
            
            // Play a silent sound to unlock the audio context
            if (audioSource != null && silentClip != null)
            {
                audioSource.PlayOneShot(silentClip);
            }
            
            // Also try to play any existing audio sources in the scene
            AudioSource[] allAudioSources = FindObjectsOfType<AudioSource>();
            foreach (AudioSource source in allAudioSources)
            {
                if (source.clip != null && !source.isPlaying)
                {
                    source.Play();
                    source.Pause(); // Pause immediately to reset
                }
            }
            
            audioUnlocked = true;
            Debug.Log("[AudioInitializer] Audio context unlocked!");
        }
    }
    
    // Public method to check if audio is unlocked
    public bool IsAudioUnlocked()
    {
        return audioUnlocked;
    }
    
    // Call this from any script that needs to ensure audio is working
    public static void EnsureAudioUnlocked()
    {
        AudioInitializer initializer = FindObjectOfType<AudioInitializer>();
        if (initializer != null)
        {
            initializer.UnlockAudio();
        }
    }
} 
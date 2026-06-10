import requests
import json

def test_flask_server():
    base_url = "http://localhost:5000"
    
    print("Testing Flask server connection...")
    
    # Test 1: Basic connection
    try:
        response = requests.get(f"{base_url}/")
        print(f"✓ Server is running (Status: {response.status_code})")
    except requests.exceptions.ConnectionError:
        print("✗ Cannot connect to server. Make sure Flask is running on port 5000")
        return False
    
    # Test 2: Check student endpoint
    try:
        response = requests.get(f"{base_url}/api/check_student/1")
        print(f"✓ Student check endpoint working (Status: {response.status_code})")
        if response.status_code == 200:
            data = response.json()
            print(f"  Response: {data}")
    except Exception as e:
        print(f"✗ Student check endpoint error: {e}")
    
    # Test 3: Test game progress endpoint
    try:
        test_data = {
            'user_id': '1',
            'level': 'Level 1',
            'score': '100',
            'actions': 'forward,forward'
        }
        response = requests.post(f"{base_url}/api/game_progress", data=test_data)
        print(f"✓ Game progress endpoint working (Status: {response.status_code})")
    except Exception as e:
        print(f"✗ Game progress endpoint error: {e}")
    
    print("\nServer test completed!")
    return True

if __name__ == "__main__":
    test_flask_server()

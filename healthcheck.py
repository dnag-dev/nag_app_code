import requests
import sys
import time

def check_health():
    try:
        # Try to connect to the health endpoint
        response = requests.get('http://localhost:8000/health', timeout=5)
        if response.status_code == 200:
            print("Health check passed: Application is running")
            return True
        else:
            print(f"Health check failed: Status code {response.status_code}")
            return False
    except Exception as e:
        print(f"Health check failed: {str(e)}")
        return False

if __name__ == "__main__":
    # Try multiple times with a delay
    for i in range(3):
        if check_health():
            sys.exit(0)
        print(f"Attempt {i+1} failed, retrying in 5 seconds...")
        time.sleep(5)
    
    print("All health check attempts failed")
    sys.exit(1) 
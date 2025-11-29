"""
Test Script for Video Processing API
Tests all endpoints to verify migration success
"""

import requests
import time
import json
from pathlib import Path

API_BASE_URL = "http://localhost:5001"

def test_health_check():
    """Test health check endpoint"""
    print("\n" + "="*60)
    print("Testing Health Check Endpoint")
    print("="*60)
    
    try:
        response = requests.get(f"{API_BASE_URL}/health")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_list_sessions():
    """Test list sessions endpoint"""
    print("\n" + "="*60)
    print("Testing List Sessions Endpoint")
    print("="*60)
    
    try:
        response = requests.get(f"{API_BASE_URL}/api/list-sessions")
        print(f"Status Code: {response.status_code}")
        data = response.json()
        print(f"Total Sessions: {data.get('total', 0)}")
        if data.get('sessions'):
            print(f"Latest Session: {data['sessions'][0]['name']}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_video_upload_async(video_path):
    """Test async video upload and processing"""
    print("\n" + "="*60)
    print("Testing Async Video Upload")
    print("="*60)
    
    if not Path(video_path).exists():
        print(f"❌ Video file not found: {video_path}")
        return False
    
    try:
        # Upload video
        with open(video_path, 'rb') as video_file:
            files = {'video': video_file}
            data = {
                'unitId': 'TEST_101',
                'sessionId': 'test_session_001',
                'async': 'true'
            }
            
            print(f"Uploading video: {video_path}")
            response = requests.post(
                f"{API_BASE_URL}/api/process-video",
                files=files,
                data=data
            )
            
            print(f"Status Code: {response.status_code}")
            result = response.json()
            print(f"Response: {json.dumps(result, indent=2)}")
            
            if not result.get('success'):
                return False
            
            job_id = result.get('job_id')
            print(f"\n✅ Video uploaded successfully!")
            print(f"Job ID: {job_id}")
            
            # Poll for status
            print("\nPolling for processing status...")
            max_attempts = 60  # 2 minutes max
            for attempt in range(max_attempts):
                time.sleep(2)
                
                status_response = requests.get(f"{API_BASE_URL}/api/status/{job_id}")
                status_data = status_response.json()
                
                status = status_data.get('status')
                message = status_data.get('message', '')
                progress = status_data.get('progress', 0)
                
                print(f"[{attempt+1}] Status: {status} | Progress: {progress}% | {message}")
                
                if status == 'completed':
                    print("\n✅ Processing completed!")
                    print(f"Results: {json.dumps(status_data.get('results', {}), indent=2)}")
                    return True
                elif status == 'error':
                    print(f"\n❌ Processing failed: {message}")
                    return False
            
            print("\n⚠️ Timeout waiting for processing")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_video_upload_sync(video_path):
    """Test synchronous video upload and processing"""
    print("\n" + "="*60)
    print("Testing Sync Video Upload")
    print("="*60)
    
    if not Path(video_path).exists():
        print(f"❌ Video file not found: {video_path}")
        return False
    
    try:
        # Upload video
        with open(video_path, 'rb') as video_file:
            files = {'video': video_file}
            data = {
                'unitId': 'TEST_102',
                'sessionId': 'test_session_002',
                'async': 'false'
            }
            
            print(f"Uploading video: {video_path}")
            print("⏳ This may take several minutes...")
            
            response = requests.post(
                f"{API_BASE_URL}/api/process-video",
                files=files,
                data=data,
                timeout=600  # 10 minutes
            )
            
            print(f"Status Code: {response.status_code}")
            result = response.json()
            
            if result.get('success'):
                print("✅ Processing completed!")
                print(f"Results: {json.dumps(result.get('data', {}), indent=2)}")
                return True
            else:
                print(f"❌ Processing failed: {result.get('error')}")
                return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def run_all_tests(video_path=None):
    """Run all tests"""
    print("\n" + "="*60)
    print("🧪 Video Processing API Test Suite")
    print("="*60)
    
    results = {}
    
    # Test 1: Health Check
    results['health_check'] = test_health_check()
    
    # Test 2: List Sessions
    results['list_sessions'] = test_list_sessions()
    
    # Test 3: Async Upload (if video provided)
    if video_path:
        results['async_upload'] = test_video_upload_async(video_path)
        # Uncomment to test sync upload too
        # results['sync_upload'] = test_video_upload_sync(video_path)
    
    # Print Summary
    print("\n" + "="*60)
    print("📊 Test Results Summary")
    print("="*60)
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{test_name}: {status}")
    
    total = len(results)
    passed = sum(results.values())
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n✅ All tests passed!")
    else:
        print(f"\n⚠️ {total - passed} test(s) failed")

if __name__ == '__main__':
    import sys
    
    print("Starting API tests...")
    print(f"Target: {API_BASE_URL}")
    
    # Check if video path provided
    video_path = None
    if len(sys.argv) > 1:
        video_path = sys.argv[1]
        print(f"Video file: {video_path}")
    else:
        print("No video file provided - skipping upload tests")
        print("Usage: python test_api.py <path_to_video.mp4>")
    
    run_all_tests(video_path)

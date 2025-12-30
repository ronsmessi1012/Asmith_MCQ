from fastapi.testclient import TestClient
from main import app
import os
import pandas as pd
import sys

# Add current directory to path
sys.path.append(os.getcwd())

client = TestClient(app)

def test_delete_flow():
    print("1. Publishing Exam to be deleted...")
    exam_data = {
        "title": "Delete Me Exam",
        "questions": [{"question": "Q1", "options": {"A": "1", "B": "2"}, "answer": "A"}]
    }
    response = client.post("/exam/publish", json=exam_data)
    assert response.status_code == 200
    exam_id = response.json()["exam_id"]
    print(f"Exam created with ID: {exam_id}")

    # Verify in Master
    print("2. Verifying in exams_master.xlsx...")
    df = pd.read_excel("exams_master.xlsx", sheet_name="Exams")
    row = df[df["id"] == exam_id]
    if row.empty:
        print("FAILURE: Exam not found in master file")
        exit(1)
    
    filename = row.iloc[0]["filename"]
    print(f"Exam file: {filename}")
    if not os.path.exists(filename):
        print("FAILURE: Exam file not created")
        exit(1)

    # Delete Exam
    print("3. Deleting Exam...")
    response = client.delete(f"/exam/{exam_id}")
    assert response.status_code == 200
    print("Exam deleted via API")

    # Verify Removed from Master
    print("4. Verifying removal from exams_master.xlsx...")
    df = pd.read_excel("exams_master.xlsx", sheet_name="Exams")
    if not df[df["id"] == exam_id].empty:
        print("FAILURE: Exam ID still exists in master file")
        exit(1)
    print("SUCCESS: Exam removed from master file")

    # Verify File Deleted
    print("5. Verifying file deletion...")
    if os.path.exists(filename):
        print(f"FAILURE: Exam file {filename} still exists")
        exit(1)
    print("SUCCESS: Exam file deleted from filesystem")

if __name__ == "__main__":
    test_delete_flow()

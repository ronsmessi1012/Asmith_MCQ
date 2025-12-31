from fastapi.testclient import TestClient
from main import app
import os
import pandas as pd
import sys

# Add current directory to path so we can import main
sys.path.append(os.getcwd())

client = TestClient(app)

def test_excel_flow():
    print("1. Publishing Exam...")
    exam_data = {
        "title": "Integration Test Exam",
        "questions": [
            {
                "question": "What is the capital of France?",
                "options": {"A": "Berlin", "B": "Madrid", "C": "Paris", "D": "Rome"},
                "answer": "C"
            }
        ]
    }
    response = client.post("/exam/publish", json=exam_data)
    if response.status_code != 200:
        print(f"Failed to publish exam: {response.text}")
        exit(1)
    
    exam_id = response.json()["exam_id"]
    print(f"Exam published with ID: {exam_id}")

    print("2. Listing Exams...")
    response = client.get("/exams")
    assert response.status_code == 200
    exams = response.json()
    found = any(e["id"] == exam_id for e in exams)
    if not found:
        print("Exam not found in list!")
        exit(1)
    print("Exam found in list.")

    print("3. Submitting Result...")
    result_data = {
        "exam_id": exam_id,
        "employee_name": "Test User",
        "score": 1,
        "total_questions": 1,
        "percentage": "100.0"
    }
    response = client.post("/exam/submit", json=result_data)
    if response.status_code != 200:
        print(f"Failed to submit result: {response.text}")
        exit(1)
    
    result_id = response.json()["result_id"]
    print(f"Result submitted with ID: {result_id}")

    print("4. Verifying in Excel File...")
    try:
        # Check Master File
        df_master = pd.read_excel("exams_master.xlsx", sheet_name="Exams")
        exam_row = df_master[df_master["id"] == exam_id]
        if exam_row.empty:
            print("FAILURE: Exam not found in exams_master.xlsx")
            exit(1)
        
        filename = exam_row.iloc[0]["filename"]
        print(f"Exam filename from master: {filename}")
        
        if not os.path.exists(filename):
             print(f"FAILURE: Individual exam file {filename} does not exist")
             exit(1)

        # Check Individual File
        df = pd.read_excel(filename, sheet_name="ExamResults")
        # Check if our result ID exists
        row = df[df["id"] == result_id]
        if not row.empty:
            print("SUCCESS: Result verified in individual Excel file!")
            # Check for exam_title
            if "exam_title" in row.columns and row.iloc[0]["exam_title"] == "Integration Test Exam":
                 print("SUCCESS: exam_title verified!")
            else:
                 print(f"FAILURE: exam_title missing or incorrect. Row data: {row}")
                 exit(1)
        else:
            print("FAILURE: Result ID not found in Excel file.")
            exit(1)
    except Exception as e:
        print(f"FAILURE: Initial verification failed: {e}")
        exit(1)

if __name__ == "__main__":
    # Ensure dependencies are installed and we can run
    test_excel_flow()

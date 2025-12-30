import pandas as pd
import os
import json
import re
from datetime import datetime
from threading import RLock

MASTER_FILE = "exams_master.xlsx"
SHEETS_DIR = "exam_sheets"
_lock = RLock()

def _get_next_id(df):
    if df.empty:
        return 1
    return int(df['id'].max()) + 1

def _sanitize_filename(name):
    """Sanitize string to be safe for filenames"""
    return re.sub(r'[^\w\-_]', '_', name)

def _get_exam_filename(exam_id, title):
    safe_title = _sanitize_filename(title)
    return os.path.join(SHEETS_DIR, f"Exam_{exam_id}_{safe_title}.xlsx")

def init_excel_db():
    # Ensure sheets directory exists
    os.makedirs(SHEETS_DIR, exist_ok=True)
    
    # Init Master File
    if not os.path.exists(MASTER_FILE):
        with pd.ExcelWriter(MASTER_FILE, engine='openpyxl') as writer:
            # Create Exams sheet in master
            df_exams = pd.DataFrame(columns=['id', 'title', 'questions', 'created_at', 'published', 'filename'])
            df_exams.to_excel(writer, sheet_name='Exams', index=False)

def read_exams():
    with _lock:
        try:
            if not os.path.exists(MASTER_FILE):
                return []
            df = pd.read_excel(MASTER_FILE, sheet_name='Exams')
            return df.to_dict('records')
        except Exception as e:
            print(f"Error reading exams: {e}")
            return []

def get_exam_by_id(exam_id):
    exams = read_exams()
    for exam in exams:
        if exam['id'] == exam_id:
            return exam
    return None

def write_exam(title, questions, published=1):
    with _lock:
        try:
            # 1. Update Master File
            df = pd.read_excel(MASTER_FILE, sheet_name='Exams')
            new_id = _get_next_id(df)
            
            # Create individual exam file path
            exam_filename = _get_exam_filename(new_id, title)
            
            new_row = {
                'id': new_id,
                'title': title,
                'questions': json.dumps(questions),
                'created_at': datetime.utcnow().isoformat(),
                'published': published,
                'filename': exam_filename
            }
            df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
            
            with pd.ExcelWriter(MASTER_FILE, engine='openpyxl', mode='a', if_sheet_exists='replace') as writer:
                df.to_excel(writer, sheet_name='Exams', index=False)
            
            # 2. Create Individual Exam File
            # We create it with the ExamResults columns
            df_results = pd.DataFrame(columns=['id', 'exam_id', 'exam_title', 'employee_name', 'score', 'total_questions', 'percentage', 'completed_at'])
            
            # Write to the new file
            with pd.ExcelWriter(exam_filename, engine='openpyxl') as writer:
                 df_results.to_excel(writer, sheet_name='ExamResults', index=False)
                 
            return new_id
        except Exception as e:
            print(f"Error writing exam: {e}")
            raise e

def delete_exam(exam_id):
    with _lock:
        try:
            df = pd.read_excel(MASTER_FILE, sheet_name='Exams')
            
            # Get filename before deleting
            exam_row = df[df['id'] == exam_id]
            if not exam_row.empty:
                filename = exam_row.iloc[0]['filename']
                if filename and os.path.exists(filename):
                    os.remove(filename)
            
            # Delete from master
            df = df[df['id'] != exam_id]
            with pd.ExcelWriter(MASTER_FILE, engine='openpyxl', mode='a', if_sheet_exists='replace') as writer:
                df.to_excel(writer, sheet_name='Exams', index=False)
        except Exception as e:
            print(f"Error deleting exam: {e}")
            raise e

def read_results(exam_id=None):
    with _lock:
        try:
            results = []
            exams = read_exams()
            
            # If exam_id provided, just read that one
            if exam_id is not None:
                exam = next((e for e in exams if e['id'] == exam_id), None)
                if exam and 'filename' in exam and os.path.exists(exam['filename']):
                     df = pd.read_excel(exam['filename'], sheet_name='ExamResults')
                     return df.to_dict('records')
                return []
            
            # If no exam_id, read all (expensive, but okay for MVP)
            for exam in exams:
                if 'filename' in exam and os.path.exists(exam['filename']):
                    try:
                        df = pd.read_excel(exam['filename'], sheet_name='ExamResults')
                        results.extend(df.to_dict('records'))
                    except Exception as ex:
                        print(f"Failed to read results for exam {exam['id']}: {ex}")
            return results
        except Exception as e:
            print(f"Error reading results: {e}")
            return []

def write_result(exam_id, exam_title, employee_name, score, total_questions, percentage, feedback=None):
    with _lock:
        try:
            # 1. Find the exam file
            exam = get_exam_by_id(exam_id)
            if not exam:
                raise Exception(f"Exam {exam_id} not found")
            
            exam_filename = exam.get('filename')
            if not exam_filename or not os.path.exists(exam_filename):
                # Fallback: try to recreate filename if missing (shouldn't happen if logic holds)
                exam_filename = _get_exam_filename(exam_id, exam['title'])
                # If still not exists, we might need to recreate the file (not implementing that edge case now)
                if not os.path.exists(exam_filename):
                     raise Exception(f"Exam file {exam_filename} not found")

            # 2. Append result to that file
            df = pd.read_excel(exam_filename, sheet_name='ExamResults')
            
            new_id = _get_next_id(df)
            new_row = {
                'id': new_id,
                'exam_id': exam_id,
                'exam_title': exam_title,
                'employee_name': employee_name,
                'score': score,
                'total_questions': total_questions,
                'percentage': percentage,
                'feedback': feedback,
                'completed_at': datetime.utcnow().isoformat()
            }
            df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
            
            with pd.ExcelWriter(exam_filename, engine='openpyxl', mode='a', if_sheet_exists='replace') as writer:
                df.to_excel(writer, sheet_name='ExamResults', index=False)
                
            return new_id
        except Exception as e:
            print(f"Error writing result: {e}")
            raise e

def check_result_exists(exam_id, employee_name):
    # This now requires reading the specific exam file
    results = read_results(exam_id)
    for r in results:
        if r['employee_name'] == employee_name:
            return True
    return False

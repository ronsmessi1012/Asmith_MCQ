from fastapi import FastAPI, UploadFile, File, Body, HTTPException, Depends
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
import os
import ollama
import PyPDF2
import re
import json

# Import Excel Utilities
from excel_utils import (
    init_excel_db, write_exam, read_exams, get_exam_by_id, delete_exam,
    write_result, read_results, check_result_exists
)

# ----------------- Database Setup -----------------
DATABASE_URL = "sqlite:///./study_app.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()

# ----------------- Models -----------------
class Material(Base):
    __tablename__ = "materials"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    filename = Column(String)
    filepath = Column(String)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

# Note: Exam and ExamResult are now stored in Excel, so we don't need SQL models for them anymore.
# Keeping Material in SQLite as requested (only exam data in Excel).

Base.metadata.create_all(bind=engine)

# ----------------- FastAPI App -----------------
app = FastAPI(title="Study Material & Exam API")

# Initialize Excel DB
init_excel_db()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_FOLDER = "uploaded_materials"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ----------------- Dependencies -----------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ----------------- Pydantic Models -----------------
class ExamRequest(BaseModel):
    material_ids: List[int]
    num_questions: int = 10

class PublishExamRequest(BaseModel):
    title: str
    questions: List[dict]

class SubmitExamRequest(BaseModel):
    exam_id: int
    employee_name: str
    score: int
    total_questions: int
    percentage: str

# Employer passcode - change this to your desired passcode
EMPLOYER_PASSCODE = "admin123"

# ----------------- Helper Functions -----------------
def extract_text_from_pdf(file_path: str) -> str:
    text = ""
    with open(file_path, "rb") as f:
        reader = PyPDF2.PdfReader(f)
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text

def parse_mcqs_from_text(text: str, num_questions: int = 10) -> List[dict]:
    """
    Parse MCQs from text with improved pattern matching
    """
    mcqs = []
    current_q = {}
    lines = text.splitlines()
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Detect question - More flexible pattern
        question_match = re.match(r"^(?:Question\s*\d*[:.\)]|Q\d*[:.\)]|\d+[:.\)])\s*(.+)", line, re.IGNORECASE)
        if question_match:
            # Save previous question if exists
            if current_q and "question" in current_q:
                mcqs.append(current_q)
            current_q = {"question": question_match.group(1).strip(), "options": {}, "answer": ""}
            
        # Detect options - Support both A) and A.
        elif re.match(r"^[A-D][).]\s*", line):
            opt_match = re.match(r"^([A-D])[).]\s*(.+)", line)
            if opt_match and current_q:
                opt_letter = opt_match.group(1)
                opt_text = opt_match.group(2).strip()
                current_q["options"][opt_letter] = opt_text
                
        # Detect answer - More flexible pattern
        elif re.match(r"^(?:Answer|Correct Answer|Ans)[:.\)]\s*", line, re.IGNORECASE):
            ans_match = re.match(r"^(?:Answer|Correct Answer|Ans)[:.\)]\s*(.+)", line, re.IGNORECASE)
            if ans_match and current_q:
                answer_text = ans_match.group(1).strip()
                # Extract just the letter if it's in format "A)" or "A"
                answer_letter = answer_text[0].upper() if answer_text else ""
                current_q["answer"] = answer_letter
    
    # Don't forget the last question
    if current_q and "question" in current_q:
        mcqs.append(current_q)
    
    # Validate MCQs
    valid_mcqs = []
    for mcq in mcqs:
        if mcq.get("question") and len(mcq.get("options", {})) >= 2:
            valid_mcqs.append(mcq)
    
    if not valid_mcqs:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to parse MCQs from model response. First 500 chars: {text[:500]}..."
        )
    
    return valid_mcqs[:num_questions]

def generate_mcqs(file_paths: List[str], num_questions: int = 10) -> List[dict]:
    combined_text = ""
    for path in file_paths:
        extracted = extract_text_from_pdf(path)
        combined_text += extracted + "\n\n"
    
    # Truncate if too long (ollama has context limits)
    if len(combined_text) > 10000:
        combined_text = combined_text[:10000] + "..."

    # More specific prompt with exact format
    prompt = f"""Create exactly {num_questions} multiple-choice questions from the following study material.

Format each question EXACTLY like this:

Question 1: [Question text here]
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]
Answer: A

Question 2: [Question text here]
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]
Answer: B

IMPORTANT: For the Answer line, only write the letter (A, B, C, or D), nothing else.

Study material:
{combined_text}

Now create {num_questions} questions following the exact format above:"""

    messages = [
        {"role": "system", "content": "You are a helpful assistant that creates multiple-choice questions. Always follow the exact format requested."},
        {"role": "user", "content": prompt}
    ]

    try:
        response = ollama.chat(model="llama3:latest", messages=messages)
        text_output = response['message']['content']
        
        # Debug: Log the raw output
        print("=" * 50)
        print("RAW OLLAMA OUTPUT:")
        print(text_output)
        print("=" * 50)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to call Ollama: {str(e)}")
    
    mcqs = parse_mcqs_from_text(text_output, num_questions)
    return mcqs

@app.get("/")
def home():
    return {"message": "Backend is running!"}

# ----------------- Material Endpoints -----------------
@app.post("/materials/upload")
async def upload_material(title: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    file_location = os.path.join(UPLOAD_FOLDER, file.filename)
    with open(file_location, "wb") as f:
        f.write(await file.read())
    material = Material(title=title, filename=file.filename, filepath=file_location)
    db.add(material)
    db.commit()
    db.refresh(material)
    return {"message": "File uploaded successfully", "material_id": material.id}

@app.get("/materials")
def list_materials(db: Session = Depends(get_db)):
    return db.query(Material).all()

@app.get("/materials/download/{material_id}")
def download_material(material_id: int, db: Session = Depends(get_db)):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    return FileResponse(material.filepath, filename=material.filename)

@app.delete("/materials/{material_id}")
def delete_material_endpoint(material_id: int, db: Session = Depends(get_db)):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    if material.filepath and os.path.exists(material.filepath):
        os.remove(material.filepath)
    db.delete(material)
    db.commit()
    return {"message": "Material and file deleted successfully", "material_id": material_id}

@app.put("/materials/{material_id}")
async def update_material(
    material_id: int,
    title: Optional[str] = None,
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    if title:
        material.title = title
    if file:
        if material.filepath and os.path.exists(material.filepath):
            os.remove(material.filepath)
        new_path = os.path.join(UPLOAD_FOLDER, file.filename)
        with open(new_path, "wb") as f:
            f.write(await file.read())
        material.filename = file.filename
        material.filepath = new_path
    db.commit()
    db.refresh(material)
    return {
        "message": "Material updated successfully",
        "updated_material": {
            "id": material.id,
            "title": material.title,
            "filename": material.filename,
            "filepath": material.filepath
        }
    }

# ----------------- Exam Endpoints -----------------
@app.post("/exam/create")
def create_exam(
    request: ExamRequest,
    db: Session = Depends(get_db)
):
    print(f"Received request: material_ids={request.material_ids}, num_questions={request.num_questions}")
    
    file_paths = []
    for mid in request.material_ids:
        mat = db.query(Material).filter(Material.id == mid).first()
        if mat and os.path.exists(mat.filepath):
            file_paths.append(mat.filepath)
    
    if not file_paths:
        raise HTTPException(status_code=404, detail="No valid materials found")

    mcqs = generate_mcqs(file_paths, num_questions=request.num_questions)
    return {"exam": mcqs}

@app.post("/exam/publish")
def publish_exam(request: PublishExamRequest, db: Session = Depends(get_db)):
    """Publish an exam so employees can take it"""
    try:
        exam_id = write_exam(
            title=request.title,
            questions=request.questions,
            published=1
        )
        return {"message": "Exam published successfully", "exam_id": exam_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to publish exam: {str(e)}")

@app.get("/exams")
def list_exams_endpoint():
    """Get all published exams"""
    exams = read_exams()
    # Filter for published only if we want, but write_exam defaults to published=1 and we don't handle drafts really.
    # The read_exams returns dicts.
    return [{
        "id": exam['id'],
        "title": exam['title'],
        "created_at": exam['created_at'],
        "question_count": len(json.loads(exam['questions']))
    } for exam in exams if exam.get('published', 1) == 1]

@app.get("/exam/{exam_id}")
def get_exam_endpoint(exam_id: int):
    """Get exam questions for taking the exam"""
    exam = get_exam_by_id(exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    return {
        "id": exam['id'],
        "title": exam['title'],
        "questions": json.loads(exam['questions'])
    }

@app.delete("/exam/{exam_id}")
def delete_exam_endpoint(exam_id: int):
    """Delete an exam"""
    exam = get_exam_by_id(exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    try:
        delete_exam(exam_id)
        return {"message": "Exam deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete exam: {str(e)}")

@app.post("/auth/employer")
def verify_employer(passcode: str = Body(...)):
    """Verify employer passcode"""
    if passcode == EMPLOYER_PASSCODE:
        return {"success": True, "message": "Authentication successful"}
    raise HTTPException(status_code=401, detail="Invalid passcode")

def generate_feedback(percentage: float) -> str:
    """Generate honest yet soothing feedback based on score"""
    prompt = (
        f"You are a wise and empathetic educational mentor. A student has scored {percentage}% on an exam. "
        "Provide honest, descriptive, and well-curated feedback. "
        "If the score is low, be soothing but precise about the importance of reviewing the material. "
        "If the score is high, be specific about their mastery. "
        "Avoid generic one-liners. Write a thoughtful paragraph (3-4 sentences) that feels personal and encouraging."
    )
    try:
        response = ollama.chat(model='llama3:latest', messages=[
            {'role': 'user', 'content': prompt}
        ])
        return response['message']['content']
    except Exception as e:
        print(f"Ollama feedback generation failed: {e}")
        return "Great job on completing the exam!"

@app.post("/exam/submit")
def submit_exam_result(request: SubmitExamRequest):
    """Submit exam result"""
    # Check if employee already took this exam
    if check_result_exists(request.exam_id, request.employee_name):
        raise HTTPException(status_code=400, detail="You have already taken this exam")
    
    try:
        exam = get_exam_by_id(request.exam_id)
        if not exam:
             raise HTTPException(status_code=404, detail="Exam not found")
        
        # Generate AI Feedback
        feedback = generate_feedback(float(request.percentage))
             
        result_id = write_result(
            exam_id=request.exam_id,
            exam_title=exam['title'],
            employee_name=request.employee_name,
            score=request.score,
            total_questions=request.total_questions,
            percentage=request.percentage,
            feedback=feedback
        )
        return {
            "message": "Exam submitted successfully", 
            "result_id": result_id,
            "feedback": feedback
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit result: {str(e)}")

@app.get("/exam/{exam_id}/check-attempt/{employee_name}")
def check_exam_attempt(exam_id: int, employee_name: str):
    """Check if employee has already taken the exam"""
    already_taken = check_result_exists(exam_id, employee_name)
    return {"already_taken": already_taken}

@app.get("/exam/{exam_id}/results")
def get_exam_results(exam_id: int):
    """Get all results for a specific exam"""
    results = read_results(exam_id)
    return [{
        "id": r['id'],
        "employee_name": r['employee_name'],
        "score": r['score'],
        "total_questions": r['total_questions'],
        "percentage": r['percentage'],
        "completed_at": r['completed_at']
    } for r in results]

@app.get("/results/all")
def get_all_results():
    """Get all exam results"""
    results = read_results()
    exams = read_exams()
    exam_titles = {e['id']: e['title'] for e in exams}
    
    return [{
        "id": r['id'],
        "exam_id": r['exam_id'],
        "exam_title": exam_titles.get(r['exam_id'], "Unknown"),
        "employee_name": r['employee_name'],
        "score": r['score'],
        "total_questions": r['total_questions'],
        "percentage": r['percentage'],
        "completed_at": r['completed_at']
    } for r in results]
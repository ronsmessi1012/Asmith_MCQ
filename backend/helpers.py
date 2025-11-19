# helpers.py
import os
from typing import List
from PyPDF2 import PdfReader
from sentence_transformers import SentenceTransformer, util
import ollama

# ---------------- PDF Text Extraction ----------------
def extract_text_from_pdf(file_path: str) -> str:
    if not os.path.exists(file_path):
        return ""
    reader = PdfReader(file_path)
    text = ""
    for page in reader.pages:
        text += page.extract_text() + " "
    return text.strip()

# ---------------- AI-based MCQ Generation ----------------
# Initialize SentenceTransformer model once
sentence_model = SentenceTransformer('all-MiniLM-L6-v2')

def generate_mcqs(file_paths: List[str], num_questions: int = 10) -> List[dict]:
    all_texts = ""
    for path in file_paths:
        all_texts += extract_text_from_pdf(path) + " "

    all_texts = all_texts.strip()
    if not all_texts:
        return []

    # Create embeddings for each sentence
    sentences = [s.strip() for s in all_texts.split(".") if s.strip()]
    embeddings = sentence_model.encode(sentences, convert_to_tensor=True)

    # Pick top sentences (just a simple strategy for now)
    top_indices = util.semantic_search(embeddings, embeddings, top_k=1)
    top_sentences = [sentences[i[0]['corpus_id']] for i in top_indices[:num_questions]]

    # Generate MCQs for each selected sentence using Ollama
    mcqs = []
    for sent in top_sentences:
        prompt = f"""
        Generate a single-choice multiple choice question (MCQ) from the following sentence.
        Provide:
        - question: <the question>
        - options: ["opt1", "opt2", "opt3", "opt4"]
        - answer: <correct option>
        Sentence: "{sent}"
        """
        # Replace 'llama2' with your Ollama model if different
        response = ollama.chat(model="llama2", prompt=prompt)
        # The response should ideally return JSON with question/options/answer
        # We'll parse as text for now (improve as needed)
        mcqs.append({"prompt": sent, "response": response})

    return mcqs

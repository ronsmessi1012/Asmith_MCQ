import React, { useState, useEffect } from 'react';
import { Upload, FileText, Download, Trash2, Edit, Eye, BookOpen, LogOut, Users, Briefcase, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <XCircle className="w-5 h-5" />,
    info: <AlertCircle className="w-5 h-5" />
  };

  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500'
  };

  return (
    <div className={`fixed top-4 right-4 ${colors[type]} text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 z-50`}>
      {icons[type]}
      <span>{message}</span>
    </div>
  );
};

export default function StudyApp() {
  const [userType, setUserType] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [selectedMaterials, setSelectedMaterials] = useState([]);
  const [exam, setExam] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [numQuestions, setNumQuestions] = useState(10);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [createdExam, setCreatedExam] = useState(null);
  const [examTitle, setExamTitle] = useState('');
  const [publishedExams, setPublishedExams] = useState([]);
  const [employeeName, setEmployeeName] = useState('');
  const [currentExamId, setCurrentExamId] = useState(null);
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [examResults, setExamResults] = useState([]);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (userType) {
      fetchMaterials();
      if (userType === 'employee') {
        fetchPublishedExams();
      }
      if (userType === 'employer') {
        fetchExamResults();
      }
    }
  }, [userType]);

  const fetchExamResults = async () => {
    try {
      const response = await fetch(`${API_BASE}/results/all`);
      if (!response.ok) throw new Error('Failed to fetch results');
      const data = await response.json();
      setExamResults(data);
    } catch (error) {
      showToast('Error loading results: ' + error.message, 'error');
    }
  };

  const fetchMaterials = async () => {
    try {
      const response = await fetch(`${API_BASE}/materials`);
      if (!response.ok) throw new Error('Failed to fetch materials');
      const data = await response.json();
      setMaterials(data);
    } catch (error) {
      showToast('Error loading materials: ' + error.message, 'error');
    }
  };

  const fetchPublishedExams = async () => {
    try {
      const response = await fetch(`${API_BASE}/exams`);
      if (!response.ok) throw new Error('Failed to fetch exams');
      const data = await response.json();
      setPublishedExams(data);
    } catch (error) {
      showToast('Error loading exams: ' + error.message, 'error');
    }
  };

  const handleUpload = async () => {
    if (!uploadTitle || !uploadFile) {
      showToast('Please provide both title and file', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/materials/upload?title=${encodeURIComponent(uploadTitle)}`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) throw new Error('Upload failed');
      
      showToast('Material uploaded successfully!', 'success');
      setUploadTitle('');
      setUploadFile(null);
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';
      fetchMaterials();
    } catch (error) {
      showToast('Upload failed: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this material?')) return;

    try {
      const response = await fetch(`${API_BASE}/materials/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Delete failed');
      
      showToast('Material deleted successfully!', 'success');
      fetchMaterials();
      setSelectedMaterials(selectedMaterials.filter(mid => mid !== id));
    } catch (error) {
      showToast('Delete failed: ' + error.message, 'error');
    }
  };

  const handleUpdate = async () => {
    const formData = new FormData();
    
    if (editingMaterial.newTitle) {
      formData.append('title', editingMaterial.newTitle);
    }
    if (editingMaterial.newFile) {
      formData.append('file', editingMaterial.newFile);
    }

    if (!editingMaterial.newTitle && !editingMaterial.newFile) {
      showToast('Please provide either a new title or file', 'error');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/materials/${editingMaterial.id}`, {
        method: 'PUT',
        body: formData,
      });
      
      if (!response.ok) throw new Error('Update failed');
      
      showToast('Material updated successfully!', 'success');
      setEditingMaterial(null);
      fetchMaterials();
    } catch (error) {
      showToast('Update failed: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (id, filename) => {
    try {
      const response = await fetch(`${API_BASE}/materials/download/${id}`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast('Download started!', 'success');
    } catch (error) {
      showToast('Download failed: ' + error.message, 'error');
    }
  };

  const handleCreateExam = async () => {
    if (selectedMaterials.length === 0) {
      showToast('Please select at least one material', 'error');
      return;
    }

    try {
      setLoading(true);
      showToast('Creating exam... This may take a moment', 'info');
      
      const requestBody = {
        material_ids: selectedMaterials,
        num_questions: numQuestions
      };
      
      console.log('Sending request:', requestBody);
      
      const response = await fetch(`${API_BASE}/exam/create`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Exam creation failed');
      }
      
      const data = await response.json();
      
      if (!data.exam || data.exam.length === 0) {
        throw new Error('No questions were generated');
      }
      
      if (userType === 'employer') {
        setCreatedExam(data.exam);
        setExamTitle('');
        showToast('Exam created successfully! Now publish it.', 'success');
      } else {
        setExam(data.exam);
        setCurrentQuestion(0);
        setUserAnswers({});
        setShowResults(false);
        showToast('Exam created successfully!', 'success');
      }
    } catch (error) {
      showToast('Exam creation failed: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishExam = async () => {
    if (!examTitle.trim()) {
      showToast('Please enter an exam title', 'error');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/exam/publish`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          title: examTitle,
          questions: createdExam
        }),
      });
      
      if (!response.ok) throw new Error('Failed to publish exam');
      
      showToast('Exam published successfully!', 'success');
      setCreatedExam(null);
      setExamTitle('');
      setSelectedMaterials([]);
    } catch (error) {
      showToast('Failed to publish exam: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTakeExam = async (examId) => {
    if (!employeeName.trim()) {
      showToast('Please enter your name first', 'error');
      return;
    }

    try {
      setLoading(true);
      
      // Check if employee already took this exam
      const checkResponse = await fetch(`${API_BASE}/exam/${examId}/check-attempt/${encodeURIComponent(employeeName)}`);
      const checkData = await checkResponse.json();
      
      if (checkData.already_taken) {
        showToast('You have already taken this exam!', 'error');
        return;
      }
      
      const response = await fetch(`${API_BASE}/exam/${examId}`);
      if (!response.ok) throw new Error('Failed to load exam');
      
      const data = await response.json();
      setExam(data.questions);
      setCurrentExamId(examId);
      setCurrentQuestion(0);
      setUserAnswers({});
      setShowResults(false);
    } catch (error) {
      showToast('Failed to load exam: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExam = async (examId) => {
    if (!window.confirm('Are you sure you want to delete this exam?')) return;

    try {
      const response = await fetch(`${API_BASE}/exam/${examId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Delete failed');
      
      showToast('Exam deleted successfully!', 'success');
      fetchPublishedExams();
    } catch (error) {
      showToast('Delete failed: ' + error.message, 'error');
    }
  };

  const handleAnswerSelect = (answer) => {
    setUserAnswers({ ...userAnswers, [currentQuestion]: answer });
  };

  const handleNextQuestion = () => {
    if (currentQuestion < exam.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleSubmitExam = async () => {
    const unanswered = exam.length - Object.keys(userAnswers).length;
    if (unanswered > 0) {
      if (!window.confirm(`You have ${unanswered} unanswered questions. Submit anyway?`)) {
        return;
      }
    }
    
    const score = calculateScore();
    
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/exam/submit`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          exam_id: currentExamId,
          employee_name: employeeName,
          score: score.correct,
          total_questions: score.total,
          percentage: score.percentage
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to submit exam');
      }
      
      showToast('Exam submitted successfully!', 'success');
      setShowResults(true);
    } catch (error) {
      showToast('Failed to submit exam: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEmployerLogin = async () => {
    if (!passcode.trim()) {
      showToast('Please enter passcode', 'error');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/auth/employer`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(passcode),
      });
      
      if (!response.ok) {
        throw new Error('Invalid passcode');
      }
      
      setUserType('employer');
      setShowPasscodeModal(false);
      setPasscode('');
      showToast('Login successful!', 'success');
    } catch (error) {
      showToast('Invalid passcode', 'error');
    } finally {
      setLoading(false);
    }
  };

  const isCorrectAnswer = (questionAnswer, optionKey) => {
    if (!questionAnswer) return false;
    const ans = questionAnswer.toUpperCase().trim();
    const key = optionKey.toUpperCase().trim();
    return ans === key || ans === key + ')' || ans.startsWith(key);
  };

  const calculateScore = () => {
    let correct = 0;
    exam.forEach((q, idx) => {
      const userAns = userAnswers[idx];
      const correctAns = q.answer;
      if (userAns && correctAns && userAns.toUpperCase() === correctAns.toUpperCase()) {
        correct++;
      }
    });
    return { correct, total: exam.length, percentage: ((correct / exam.length) * 100).toFixed(1) };
  };

  if (!userType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-800 mb-4">Study Portal</h1>
          <p className="text-xl text-gray-600 mb-12">Choose your role to continue</p>
          
          <div className="flex gap-8 justify-center flex-wrap">
            <button
              onClick={() => setShowPasscodeModal(true)}
              className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 w-64"
            >
              <Briefcase className="w-16 h-16 mx-auto mb-4 text-blue-600" />
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">Employer</h2>
              <p className="text-gray-600">Upload materials and create exams</p>
            </button>

            <button
              onClick={() => setUserType('employee')}
              className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 w-64"
            >
              <Users className="w-16 h-16 mx-auto mb-4 text-green-600" />
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">Employee</h2>
              <p className="text-gray-600">View materials and take exams</p>
            </button>
          </div>
        </div>

        {showPasscodeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-semibold mb-4">Employer Authentication</h3>
              <p className="text-gray-600 mb-4">Enter the passcode to access the employer dashboard</p>
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleEmployerLogin()}
                placeholder="Enter passcode"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleEmployerLogin}
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {loading ? 'Verifying...' : 'Login'}
                </button>
                <button
                  onClick={() => {
                    setShowPasscodeModal(false);
                    setPasscode('');
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (userType === 'employer') {
    return (
      <div className="min-h-screen bg-gray-50">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        
        <div className="bg-blue-600 text-white p-6 shadow-lg">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Briefcase className="w-8 h-8" />
              <h1 className="text-3xl font-bold">Employer Dashboard</h1>
            </div>
            <button
              onClick={() => {
                setUserType(null);
                setSelectedMaterials([]);
                setExam(null);
              }}
              className="flex items-center gap-2 bg-blue-700 px-4 py-2 rounded-lg hover:bg-blue-800"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-6">
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-blue-600" />
              Exam Results ({examResults.length} Submissions)
            </h2>
            {examResults.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No exam submissions yet. Employees will see their results here after taking exams.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Employee Name</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Exam Title</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Score</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Percentage</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Completed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {examResults.map((result) => (
                      <tr key={result.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">{result.employee_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-800">{result.exam_title}</td>
                        <td className="px-4 py-3 text-sm text-gray-800">{result.score}/{result.total_questions}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            parseFloat(result.percentage) >= 70 ? 'bg-green-100 text-green-700' :
                            parseFloat(result.percentage) >= 50 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {result.percentage}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(result.completed_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <Upload className="w-6 h-6 text-blue-600" />
              Upload Study Material
            </h2>
            <div className="flex gap-4 items-end flex-wrap">
              <div className="flex-1 min-w-64">
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Chapter 1 - Introduction"
                />
              </div>
              <div className="flex-1 min-w-64">
                <label className="block text-sm font-medium text-gray-700 mb-1">PDF File</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <button
                onClick={handleUpload}
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-600" />
              Study Materials ({materials.length})
            </h2>
            {materials.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No materials uploaded yet. Upload your first material above!</p>
            ) : (
              <div className="space-y-3">
                {materials.map((material) => (
                  <div key={material.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedMaterials.includes(material.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedMaterials([...selectedMaterials, material.id]);
                          } else {
                            setSelectedMaterials(selectedMaterials.filter(id => id !== material.id));
                          }
                        }}
                        className="w-5 h-5 cursor-pointer"
                      />
                      <FileText className="w-5 h-5 text-gray-600" />
                      <div>
                        <p className="font-medium text-gray-800">{material.title}</p>
                        <p className="text-sm text-gray-500">{material.filename}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDownload(material.id, material.filename)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        title="Download"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setEditingMaterial({ id: material.id, title: material.title })}
                        className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(material.id)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-blue-600" />
              Create Exam
            </h2>
            <div className="flex gap-4 items-end flex-wrap">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number of Questions</label>
                <input
                  type="number"
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                  min="1"
                  max="50"
                  className="w-32 px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <button
                onClick={handleCreateExam}
                disabled={loading || selectedMaterials.length === 0}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : `Create Exam (${selectedMaterials.length} selected)`}
              </button>
            </div>
          </div>

          {createdExam && (
            <div className="bg-white rounded-lg shadow-md p-6 mt-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold flex items-center gap-2">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  Exam Preview ({createdExam.length} Questions)
                </h2>
                <button
                  onClick={() => setCreatedExam(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-6">
                {createdExam.map((question, idx) => (
                  <div key={idx} className="border-b pb-6 last:border-b-0">
                    <div className="flex items-start gap-3 mb-4">
                      <span className="bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded-full text-sm">
                        Q{idx + 1}
                      </span>
                      <p className="font-semibold text-gray-800 flex-1 text-lg">
                        {question.question}
                      </p>
                    </div>
                    
                    <div className="space-y-2 ml-12">
                      {Object.entries(question.options).map(([key, value]) => {
                        const isCorrect = isCorrectAnswer(question.answer, key);
                        return (
                          <div
                            key={key}
                            className={`p-3 rounded-lg border-2 ${
                              isCorrect
                                ? 'bg-green-50 border-green-500'
                                : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <span className="font-semibold text-gray-700 mr-3">{key})</span>
                            <span className="text-gray-700">{value}</span>
                            {isCorrect && (
                              <span className="ml-3 text-green-600 font-semibold">
                                ✓ Correct Answer
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Exam Title</label>
                  <input
                    type="text"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    placeholder="e.g., Final Exam - Chapter 1-3"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={handlePublishExam}
                  disabled={loading || !examTitle.trim()}
                  className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  Publish Exam
                </button>
                <button
                  onClick={() => {
                    const examText = createdExam.map((q, idx) => {
                      const optionsText = Object.entries(q.options)
                        .map(([key, value]) => `${key}) ${value}`)
                        .join('\n');
                      return `Question ${idx + 1}: ${q.question}\n${optionsText}\nCorrect Answer: ${q.answer}\n`;
                    }).join('\n---\n\n');
                    
                    const blob = new Blob([examText], { type: 'text/plain' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'exam_questions.txt';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    showToast('Exam downloaded!', 'success');
                  }}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Download
                </button>
                <button
                  onClick={() => setCreatedExam(null)}
                  className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {editingMaterial && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <h3 className="text-xl font-semibold mb-4">Edit Material</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Title (optional)</label>
                    <input
                      type="text"
                      defaultValue={editingMaterial.title}
                      onChange={(e) => setEditingMaterial({ ...editingMaterial, newTitle: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New File (optional)</label>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setEditingMaterial({ ...editingMaterial, newFile: e.target.files[0] })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleUpdate}
                      disabled={loading}
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {loading ? 'Updating...' : 'Update'}
                    </button>
                    <button
                      onClick={() => setEditingMaterial(null)}
                      className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (userType === 'employee' && !exam) {
    return (
      <div className="min-h-screen bg-gray-50">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        
        <div className="bg-green-600 text-white p-6 shadow-lg">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8" />
              <h1 className="text-3xl font-bold">Employee Dashboard</h1>
            </div>
            <button
              onClick={() => {
                setUserType(null);
                setSelectedMaterials([]);
                setExam(null);
              }}
              className="flex items-center gap-2 bg-green-700 px-4 py-2 rounded-lg hover:bg-green-800"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-6">
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <Eye className="w-6 h-6 text-green-600" />
              Available Study Materials ({materials.length})
            </h2>
            {materials.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No materials available yet. Check back later!</p>
            ) : (
              <div className="space-y-3">
                {materials.map((material) => (
                  <div key={material.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3 flex-1">
                      <FileText className="w-5 h-5 text-gray-600" />
                      <div>
                        <p className="font-medium text-gray-800">{material.title}</p>
                        <p className="text-sm text-gray-500">{material.filename}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownload(material.id, material.filename)}
                      className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                      title="Download"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Enter Your Name</label>
              <input
                type="text"
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                placeholder="Your full name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
              <p className="text-sm text-gray-500 mt-1">Required to take exams</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-green-600" />
              Available Exams ({publishedExams.length})
            </h2>
            {publishedExams.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No exams available yet. Check back later!</p>
            ) : (
              <div className="space-y-3">
                {publishedExams.map((exam) => (
                  <div key={exam.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800 text-lg">{exam.title}</p>
                      <p className="text-sm text-gray-500">
                        {exam.question_count} questions • Created {new Date(exam.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleTakeExam(exam.id)}
                      disabled={loading || !employeeName.trim()}
                      className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Loading...' : 'Take Exam'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (exam && !showResults) {
    const question = exam[currentQuestion];
    const answeredCount = Object.keys(userAnswers).length;
    
    return (
      <div className="min-h-screen bg-gray-50">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        
        <div className="bg-indigo-600 text-white p-6 shadow-lg">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold">Exam in Progress</h1>
            <p className="text-indigo-200 mt-1">
              Question {currentQuestion + 1} of {exam.length} • {answeredCount} answered
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-medium text-gray-500">Progress</span>
                <span className="text-sm font-medium text-indigo-600">{Math.round(((currentQuestion + 1) / exam.length) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentQuestion + 1) / exam.length) * 100}%` }}
                ></div>
              </div>
            </div>

            <h2 className="text-2xl font-semibold text-gray-800 mb-6">{question.question}</h2>

            <div className="space-y-3 mb-8">
              {Object.entries(question.options).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => handleAnswerSelect(key)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    userAnswers[currentQuestion] === key
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="font-semibold text-indigo-600 mr-3">{key})</span>
                  <span className="text-gray-700">{value}</span>
                </button>
              ))}
            </div>

            <div className="flex justify-between">
              <button
                onClick={handlePrevQuestion}
                disabled={currentQuestion === 0}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              {currentQuestion === exam.length - 1 ? (
                <button
                  onClick={handleSubmitExam}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Submit Exam
                </button>
              ) : (
                <button
                  onClick={handleNextQuestion}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showResults) {
    const score = calculateScore();
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-indigo-600 text-white p-6 shadow-lg">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold">Exam Results</h1>
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-white rounded-lg shadow-md p-8 mb-6 text-center">
            <h2 className="text-4xl font-bold text-gray-800 mb-2">Your Score</h2>
            <p className="text-6xl font-bold text-indigo-600 mb-4">{score.percentage}%</p>
            <p className="text-xl text-gray-600">
              {score.correct} out of {score.total} correct
            </p>
            {score.percentage >= 70 ? (
              <p className="text-green-600 font-semibold mt-2">Great job! 🎉</p>
            ) : score.percentage >= 50 ? (
              <p className="text-yellow-600 font-semibold mt-2">Good effort! Keep studying 📚</p>
            ) : (
              <p className="text-red-600 font-semibold mt-2">More practice needed 💪</p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-8 space-y-6">
            <h3 className="text-2xl font-semibold mb-4">Review Answers</h3>
            {exam.map((question, idx) => (
              <div key={idx} className="border-b pb-6 last:border-b-0">
                <p className="font-semibold text-gray-800 mb-3">
                  {idx + 1}. {question.question}
                </p>
                <div className="space-y-2 ml-4">
                  {Object.entries(question.options).map(([key, value]) => {
                    const isCorrect = isCorrectAnswer(question.answer, key);
                    const isUserAnswer = key === userAnswers[idx];
                    return (
                      <div
                        key={key}
                        className={`p-3 rounded-lg ${
                          isCorrect
                            ? 'bg-green-100 border-2 border-green-500'
                            : isUserAnswer
                            ? 'bg-red-100 border-2 border-red-500'
                            : 'bg-gray-50'
                        }`}
                      >
                        <span className="font-semibold mr-2">{key})</span>
                        {value}
                        {isCorrect && <span className="ml-2 text-green-600 font-semibold">✓ Correct</span>}
                        {isUserAnswer && !isCorrect && <span className="ml-2 text-red-600 font-semibold">✗ Your answer</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-6">
            <button
              onClick={() => {
                setExam(null);
                setUserAnswers({});
                setShowResults(false);
                setCurrentQuestion(0);
                setSelectedMaterials([]);
              }}
              className="px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-lg"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
}
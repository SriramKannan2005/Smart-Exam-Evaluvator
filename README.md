# 🧠 Smart Exam Evaluator

An intelligent, AI-powered exam evaluation system that automates the process of grading handwritten multiple-choice answer sheets using **Google Gemini AI**, **Flask**, and **OpenCV**.  
It supports automatic answer extraction from scanned images, real-time evaluation, performance analytics, and exportable reports in Excel format.

---

## 🚀 Features

### 🔍 Core Functionalities
- **AI-Based Evaluation:** Uses Google Gemini models to detect and extract marked answers from handwritten answer sheets.
- **Test Setup:** Define tests, total questions, marks per question, and passing criteria.
- **Automatic Grading:** Evaluates student sheets by comparing extracted answers with stored answer keys.
- **Multi-Page Support:** Handles multiple scanned answer sheet pages per student.
- **Excel Report Generation:** Generates detailed, color-coded Excel reports for each test.
- **Consolidated Reporting:** Aggregates all student results into comprehensive dashboards and statistics.
- **Frontend Integration:** Comes with an interactive JavaScript frontend for administrators and evaluators.

---

## ⚙️ Installation

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/your-username/smart-exam-evaluator.git
cd smart-exam-evaluator
```

### 2️⃣ Create a Virtual Environment
```bash
python -m venv venv
source venv/bin/activate  # (Linux/Mac)
venv\Scripts\activate     # (Windows)
```

### 3️⃣ Install Dependencies
```bash
pip install -r requirements.txt
```

---

## 🔑 Configuration

### 1️⃣ Google Gemini API
Open `app.py` and replace the placeholder API key with your own:
```python
API_KEY = "YOUR_GEMINI_API_KEY"
```

### 2️⃣ Directory Setup
The backend automatically creates:
- `uploads/` for incoming answer sheet images.
- `data/` for persistent data and logs.

---

## ▶️ Running the Application

### Start the Flask Backend
```bash
python app.py
```
- The app runs on **http://localhost:5000**
- CORS is enabled for frontend access.

### Frontend Access
Open your browser and visit:
```
http://localhost:5000
```

---

## 🧠 How It Works

1. **Test Setup**
   - Instructor defines test parameters and uploads the answer key.
   - The system stores test metadata in `data/answer_keys.json`.

2. **Student Evaluation**
   - Uploads scanned answer sheet images.
   - The backend uses **Gemini AI** to detect marked answers.
   - Compares with the answer key and calculates marks, grades, and status.

3. **Reports & Export**
   - Individual evaluations are consolidated into reports.
   - Excel reports with charts and color-coded performance indicators can be downloaded.

---

## 🧾 API Endpoints

| Method | Endpoint | Description |
|--------|-----------|-------------|
| `POST` | `/api/test/setup` | Create a new test configuration |
| `GET` | `/api/test/active` | Get the currently active test |
| `POST` | `/api/student/evaluate` | Upload and evaluate student answer sheets |
| `POST` | `/api/reports/consolidated/save` | Save consolidated test reports |
| `GET` | `/api/reports/consolidated` | Retrieve all reports and statistics |
| `GET` | `/api/reports/consolidated/<test_id>/export` | Export report as Excel file |
| `GET` | `/api/reports/consolidated/export-all` | Export all reports as Excel |
| `GET` | `/` | Root page / landing interface |

---

## 📊 Sample Report Output
The generated Excel report includes:
- **Test Summary**: Overview of test details and statistics.
- **Student Results**: Individual performance with grades and pass/fail status.
- **Question Analysis**: Accuracy and difficulty insights for each question.

---

## 🧰 Dependencies

See [`requirements.txt`](./requirements.txt):
```
Flask==2.3.3
flask-cors==4.0.0
opencv-python==4.8.1.78
pandas==2.1.1
google-generativeai==0.3.1
openpyxl==3.1.2
Werkzeug==2.3.7
```

---

## 🧪 Future Enhancements
- Add support for **subjective question grading** using AI reasoning.
- Integration with **cloud storage** (Google Drive, S3).
- Enhanced **dashboard analytics** with charts and insights.
- **User authentication** for staff and admin accounts.

---

## 🧑‍💻 Author
**Sriram Kannan**  
Smart Exam Evaluator © 2025  
📬 Contributions, feedback, and improvements are welcome!

---

## 🛡️ License
This project is licensed under the **MIT License**.

---

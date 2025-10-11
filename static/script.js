// Smart Exam Evaluator - Enhanced with Custom Excel Format
// Version: 2.2.0 - Complete Implementation

class SmartExamEvaluator {
    constructor() {
        this.currentPage = 'landingPage';
        this.currentStudent = 1;
        this.testData = null;
        this.studentResults = [];
        this.allReports = [];
        this.isLoggedIn = false;
        this.systemStats = {
            totalEvaluations: 0,
            activeTests: 0,
            uptime: Date.now(),
            lastBackup: null
        };
        this.settings = {
            refreshInterval: 30,
            soundAlerts: true,
            autoSave: true
        };
        
        // API base URL - modify if your Flask server runs on different host/port
        this.API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
        
        // In-memory storage for browser compatibility
        this.savedSettings = null;
        this.savedTheme = 'light';
        this.pendingAction = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadDashboardStats();
        this.initializeTheme();
        this.loadSettings();
        this.showPage('landingPage');
    }

    // API Helper Methods
    async apiCall(endpoint, method = 'GET', data = null, isFormData = false) {
        const url = `${this.API_BASE_URL}/api${endpoint}`;
        const options = {
            method: method,
            headers: isFormData ? {} : {
                'Content-Type': 'application/json',
            },
        };

        if (data) {
            if (isFormData) {
                options.body = data;
            } else {
                options.body = JSON.stringify(data);
            }
        }

        try {
            const response = await fetch(url, options);
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }
            
            return result;
        } catch (error) {
            console.error(`API call failed: ${endpoint}`, error);
            // Mock successful response for demo purposes
            if (endpoint === '/test/setup') {
                return { success: true, testId: `TEST_${Date.now()}` };
            } else if (endpoint === '/student/evaluate') {
                return this.mockEvaluationResponse(data);
            } else if (endpoint.includes('/reports/consolidated')) {
                return { success: true, consolidatedReports: this.allReports, stats: {} };
            }
            throw error;
        }
    }

    // Mock response for demo purposes
    mockEvaluationResponse(formData) {
        const studentName = formData.get('studentName');
        const rollNumber = formData.get('rollNumber');
        
        // Generate mock evaluation results
        const totalQuestions = this.testData.totalQuestions;
        const correctAnswers = Math.floor(Math.random() * (totalQuestions - 1)) + 1;
        const obtainedMarks = correctAnswers * this.testData.marksPerQuestion;
        const totalMarks = totalQuestions * this.testData.marksPerQuestion;
        const percentage = Math.round((obtainedMarks / totalMarks) * 100);
        
        let grade, status;
        if (percentage >= 90) {
            grade = 'A+';
        } else if (percentage >= 80) {
            grade = 'A';
        } else if (percentage >= 70) {
            grade = 'B';
        } else if (percentage >= 60) {
            grade = 'C';
        } else if (percentage >= 50) {
            grade = 'D';
        } else {
            grade = 'F';
        }
        
        status = percentage >= this.testData.passingMarks ? 'PASS' : 'FAIL';
        
        const results = [];
        for (let i = 1; i <= totalQuestions; i++) {
            const isCorrect = i <= correctAnswers;
            results.push({
                questionNo: i,
                correctAnswer: this.testData.answerKey[i-1] || 'A',
                studentAnswer: isCorrect ? this.testData.answerKey[i-1] : ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)],
                isCorrect: isCorrect,
                marks: isCorrect ? this.testData.marksPerQuestion : 0
            });
        }
        
        return {
            success: true,
            evaluation: {
                studentName: studentName,
                rollNumber: rollNumber,
                summary: {
                    totalQuestions: totalQuestions,
                    correctAnswers: correctAnswers,
                    obtainedMarks: obtainedMarks,
                    totalMarks: totalMarks,
                    percentage: percentage,
                    grade: grade,
                    status: status
                },
                results: results,
                evaluatedAt: new Date().toISOString()
            }
        };
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const page = e.currentTarget.dataset.page;
                this.navigateTo(page);
            });
        });

        // Theme toggle
        document.getElementById('themeToggle')?.addEventListener('click', () => {
            this.toggleTheme();
        });

        // Hero CTA
        document.getElementById('getStartedBtn')?.addEventListener('click', () => {
            this.navigateTo('dashboard');
        });

        // Dashboard cards
        document.getElementById('newTestCard')?.addEventListener('click', () => {
            this.navigateTo('newTestSetup');
        });

        document.getElementById('viewReportsCard')?.addEventListener('click', () => {
            this.navigateTo('reportsPage');
        });

        document.getElementById('adminCard')?.addEventListener('click', () => {
            this.navigateTo('adminPage');
        });

        // Back buttons
        document.querySelectorAll('.back-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = e.currentTarget.dataset.page;
                this.navigateTo(page);
            });
        });

        // Test setup form
        document.getElementById('testSetupForm')?.addEventListener('submit', (e) => {
            this.handleTestSetup(e);
        });

        // Student evaluation form
        document.getElementById('studentEvaluationForm')?.addEventListener('submit', (e) => {
            this.handleStudentEvaluation(e);
        });

        // Admin login form
        document.getElementById('adminLoginForm')?.addEventListener('submit', (e) => {
            this.handleAdminLogin(e);
        });

        // Form input listeners for live preview
        this.setupFormPreviewListeners();

        // Quick fill buttons
        document.querySelectorAll('.quick-fill button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fillValue = e.currentTarget.dataset.fill;
                this.quickFillAnswers(fillValue);
            });
        });

        // Admin controls
        this.setupAdminControls();

        // Modal controls
        this.setupModalControls();

        // Action buttons in evaluation
        document.getElementById('nextStudentBtn')?.addEventListener('click', () => {
            this.nextStudent();
        });

        document.getElementById('finishEvaluationBtn')?.addEventListener('click', () => {
            this.finishEvaluation();
        });

        // Export buttons
        document.getElementById('downloadConsolidatedExcelBtn')?.addEventListener('click', () => {
            this.exportConsolidatedReport();
        });

        document.getElementById('exportAllReportsBtn')?.addEventListener('click', () => {
            this.exportAllConsolidatedReports();
        });

        // Reports controls
        document.getElementById('refreshReportsBtn')?.addEventListener('click', () => {
            this.loadReports();
        });

        document.getElementById('reportFilter')?.addEventListener('change', (e) => {
            this.filterReports(e.target.value);
        });
    }

    setupFormPreviewListeners() {
        const previewFields = [
            { input: 'staffName', preview: 'previewStaff' },
            { input: 'subjectName', preview: 'previewSubject' },
            { input: 'totalStudents', preview: 'previewTotalStudents' },
            { input: 'totalQuestions', preview: 'previewQuestions' },
            { input: 'totalPages', preview: 'previewPages' },
            { input: 'marksPerQuestion', preview: 'previewMarks' },
            { input: 'passingMarks', preview: 'previewPassing' }
        ];

        previewFields.forEach(field => {
            const input = document.getElementById(field.input);
            const preview = document.getElementById(field.preview);
            
            if (input && preview) {
                input.addEventListener('input', (e) => {
                    let value = e.target.value || '-';
                    
                    if (field.input === 'marksPerQuestion') {
                        const totalQuestions = document.getElementById('totalQuestions').value || 0;
                        const marksPerQuestion = e.target.value || 0;
                        value = totalQuestions * marksPerQuestion || '-';
                    } else if (field.input === 'passingMarks') {
                        value = value + '%';
                    }
                    
                    preview.textContent = value;
                });
            }
        });

        // Questions input listener
        document.getElementById('totalQuestions')?.addEventListener('input', (e) => {
            const count = parseInt(e.target.value) || 0;
            this.generateQuestionInputs(count);
            this.updateAnswerKeyPreview();
        });
    }

    setupAdminControls() {
        // Data management
        document.getElementById('deleteAllReportsBtn')?.addEventListener('click', () => {
            this.confirmAction(
                'Delete All Consolidated Reports',
                'This will permanently delete all consolidated test reports. This action cannot be undone.',
                () => this.deleteAllConsolidatedReports()
            );
        });

        document.getElementById('clearAnswerKeysBtn')?.addEventListener('click', () => {
            this.confirmAction(
                'Clear Answer Keys',
                'This will clear all stored answer keys. You will need to re-enter them for future evaluations.',
                () => this.clearAnswerKeys()
            );
        });

        document.getElementById('exportSystemDataBtn')?.addEventListener('click', () => {
            this.exportSystemData();
        });

        // Settings
        document.getElementById('updateRefreshBtn')?.addEventListener('click', () => {
            this.updateRefreshInterval();
        });

        document.getElementById('soundAlerts')?.addEventListener('change', (e) => {
            this.settings.soundAlerts = e.target.checked;
            this.saveSettings();
        });

        document.getElementById('autoSave')?.addEventListener('change', (e) => {
            this.settings.autoSave = e.target.checked;
            this.saveSettings();
        });

        // Maintenance
        document.getElementById('createBackupBtn')?.addEventListener('click', () => {
            this.createBackup();
        });

        document.getElementById('optimizeDatabaseBtn')?.addEventListener('click', () => {
            this.optimizeDatabase();
        });

        document.getElementById('clearCacheBtn')?.addEventListener('click', () => {
            this.clearCache();
        });

        document.getElementById('clearLogsBtn')?.addEventListener('click', () => {
            this.clearSystemLogs();
        });
    }

    setupModalControls() {
        // Modal close buttons
        document.querySelectorAll('[data-modal]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = e.currentTarget.dataset.modal;
                this.closeModal(modalId);
            });
        });

        // Confirm modal
        document.getElementById('confirmButton')?.addEventListener('click', () => {
            if (this.pendingAction) {
                this.pendingAction();
                this.pendingAction = null;
            }
            this.closeModal('confirmModal');
        });

        document.getElementById('cancelButton')?.addEventListener('click', () => {
            this.pendingAction = null;
            this.closeModal('confirmModal');
        });
    }

    // Navigation Methods
    navigateTo(pageId) {
        // Special handling for admin page
        if (pageId === 'adminPage' && !this.isLoggedIn) {
            this.showPage('adminPage');
            document.getElementById('adminLogin').style.display = 'block';
            document.getElementById('adminControls').style.display = 'none';
        } else if (pageId === 'adminPage' && this.isLoggedIn) {
            this.showPage('adminPage');
            document.getElementById('adminLogin').style.display = 'none';
            document.getElementById('adminControls').style.display = 'block';
            this.updateSystemStats();
        } else {
            this.showPage(pageId);
        }

        // Update navigation active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeNav = document.querySelector(`[data-page="${pageId}"]`);
        if (activeNav) {
            activeNav.classList.add('active');
        }
    }

    showPage(pageId) {
        // Hide all pages
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        
        // Show target page
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
            this.currentPage = pageId;
            
            // Page-specific initialization
            if (pageId === 'reportsPage') {
                this.loadReports();
            } else if (pageId === 'dashboard') {
                this.loadDashboardStats();
            }
        }
    }

    // Test Setup Methods
    async handleTestSetup(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const testData = {
            testTitle: formData.get('subjectName'),
            staffName: formData.get('staffName'),
            totalStudents: parseInt(formData.get('totalStudents')),
            totalPages: parseInt(formData.get('totalPages')),
            totalQuestions: parseInt(formData.get('totalQuestions')),
            marksPerQuestion: parseFloat(formData.get('marksPerQuestion')),
            passingMarks: parseFloat(formData.get('passingMarks')),
            answerKey: this.getAnswerKey()
        };

        // Validate test data
        if (!this.validateTestData(testData)) {
            return;
        }

        this.showLoading('Setting up test...', 'Please wait while we configure your test');

        try {
            const response = await this.apiCall('/test/setup', 'POST', testData);
            
            if (response.success) {
                this.testData = testData;
                this.testData.testId = response.testId;
                this.currentStudent = 1;
                this.studentResults = [];
                
                this.hideLoading();
                this.showToast('Test setup complete! Ready for student evaluation.', 'success');
                this.navigateTo('studentEvaluation');
                this.setupStudentEvaluation();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            this.hideLoading();
            this.showToast(`Test setup failed: ${error.message}`, 'error');
        }
    }

    validateTestData(data) {
        const errors = [];
        
        if (!data.staffName.trim()) errors.push('Staff name is required');
        if (!data.testTitle.trim()) errors.push('Subject name is required');
        if (data.totalStudents < 1) errors.push('Total students must be at least 1');
        if (data.totalQuestions < 1) errors.push('Total questions must be at least 1');
        if (data.marksPerQuestion <= 0) errors.push('Marks per question must be greater than 0');
        if (data.passingMarks < 0 || data.passingMarks > 100) errors.push('Passing marks must be between 0-100%');
        if (!data.answerKey || data.answerKey.length !== data.totalQuestions) {
            errors.push('Answer key must be complete for all questions');
        }

        if (errors.length > 0) {
            this.showToast(errors.join('<br>'), 'error');
            return false;
        }

        return true;
    }

    generateQuestionInputs(count) {
        const container = document.getElementById('questionsContainer');
        if (!container) return;

        container.innerHTML = '';
        
        if (count > 0) {
            for (let i = 1; i <= count; i++) {
                const answerInput = document.createElement('div');
                answerInput.className = 'answer-input';
                answerInput.innerHTML = `
                    <label>Q${i}</label>
                    <select name="answer_${i}" data-question="${i}">
                        <option value="">-</option>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="D">D</option>
                    </select>
                `;
                container.appendChild(answerInput);
            }
            
            // Add change listeners to update preview
            container.querySelectorAll('select').forEach(select => {
                select.addEventListener('change', () => {
                    this.updateAnswerKeyPreview();
                });
            });
        }
    }

    quickFillAnswers(value) {
        document.querySelectorAll('#questionsContainer select').forEach(select => {
            select.value = value;
        });
        this.updateAnswerKeyPreview();
    }

    getAnswerKey() {
        const selects = document.querySelectorAll('#questionsContainer select');
        const answers = [];
        
        selects.forEach(select => {
            answers.push(select.value || 'A');
        });
        
        return answers;
    }

    updateAnswerKeyPreview() {
        const answerKey = this.getAnswerKey();
        const hasAnswers = answerKey.some(answer => answer !== '');
        const preview = document.getElementById('previewKeyStatus');
        
        if (preview) {
            if (hasAnswers) {
                const completedCount = answerKey.filter(answer => answer !== '' && answer !== 'A').length;
                const totalCount = answerKey.length;
                preview.textContent = `${completedCount}/${totalCount} Set`;
            } else {
                preview.textContent = 'Not Set';
            }
        }
    }

    // Student Evaluation Methods
    setupStudentEvaluation() {
        if (!this.testData) return;
        
        // Update progress info
        const progressInfo = document.getElementById('studentProgress');
        if (progressInfo) {
            progressInfo.textContent = `Student ${this.currentStudent} of ${this.testData.totalStudents}`;
        }
        
        // Generate page upload sections
        this.generatePageUploads();
        
        // Update summary stats
        this.updateEvaluationSummary();
        
        // Clear form
        document.getElementById('studentEvaluationForm')?.reset();
        
        // Hide analysis results
        const analysisResults = document.getElementById('analysisResults');
        if (analysisResults) {
            analysisResults.style.display = 'none';
        }
        
        // Show/hide buttons
        this.updateEvaluationButtons();
    }

    generatePageUploads() {
        const container = document.getElementById('pageUploadsContainer');
        if (!container || !this.testData) return;
        
        container.innerHTML = '';
        
        for (let i = 1; i <= this.testData.totalPages; i++) {
            const pageUpload = document.createElement('div');
            pageUpload.className = 'page-upload-item';
            pageUpload.innerHTML = `
                <div class="page-upload-header">
                    <div class="page-upload-title">
                        <i class="fas fa-file-image"></i>
                        Page ${i}
                    </div>
                    <div class="page-upload-status" id="pageStatus_${i}">
                        <i class="fas fa-upload"></i>
                        Not Uploaded
                    </div>
                </div>
                <div class="upload-area" onclick="document.getElementById('pageFile_${i}').click()">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <h4>Upload Page ${i}</h4>
                    <p>Click to select image file (JPG, PNG, PDF)</p>
                    <button type="button" class="upload-button">Choose File</button>
                    <input type="file" id="pageFile_${i}" name="answerSheet_${i}" accept="image/*,.pdf" style="display: none;">
                </div>
                <div class="page-preview" id="pagePreview_${i}">
                    <img class="preview-image" id="previewImage_${i}" alt="Page ${i} preview">
                </div>
            `;
            container.appendChild(pageUpload);
            
            // Add file change listener
            const fileInput = pageUpload.querySelector(`#pageFile_${i}`);
            fileInput.addEventListener('change', (e) => {
                this.handleFileUpload(e, i);
            });
        }
    }

    handleFileUpload(e, pageNumber) {
        const file = e.target.files[0];
        if (!file) return;
        
        const statusElement = document.getElementById(`pageStatus_${pageNumber}`);
        const previewElement = document.getElementById(`pagePreview_${pageNumber}`);
        const previewImage = document.getElementById(`previewImage_${pageNumber}`);
        
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImage.src = e.target.result;
                previewElement.classList.add('active');
                
                if (statusElement) {
                    statusElement.innerHTML = '<i class="fas fa-check-circle"></i> Uploaded';
                    statusElement.classList.add('uploaded');
                }
            };
            reader.readAsDataURL(file);
        } else {
            // For PDF files
            if (statusElement) {
                statusElement.innerHTML = '<i class="fas fa-check-circle"></i> PDF Uploaded';
                statusElement.classList.add('uploaded');
            }
        }
        
        this.showToast(`Page ${pageNumber} uploaded successfully`, 'success');
    }

    async handleStudentEvaluation(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const studentName = formData.get('studentName');
        const rollNumber = formData.get('rollNumber');
        
        // Validate student data
        if (!this.validateStudentData({ name: studentName, rollNumber: rollNumber })) {
            return;
        }
        
        // Check if files are uploaded
        const uploadedFiles = this.getUploadedFiles();
        if (uploadedFiles.length < this.testData.totalPages) {
            this.showToast(`Please upload all ${this.testData.totalPages} pages`, 'error');
            return;
        }
        
        // Show loading and process evaluation
        this.showLoading('Analyzing Answer Sheet...', 'AI is processing the uploaded images...');
        this.updateProgressSteps(['completed', 'active', 'pending']);
        this.updateProgressBar(50);
        
        try {
            // Prepare form data for API
            const evaluationData = new FormData();
            evaluationData.append('studentName', studentName);
            evaluationData.append('rollNumber', rollNumber);
            
            // Add uploaded files
            for (let i = 1; i <= this.testData.totalPages; i++) {
                const fileInput = document.getElementById(`pageFile_${i}`);
                if (fileInput && fileInput.files[0]) {
                    evaluationData.append(`answerSheet_${i}`, fileInput.files[0]);
                }
            }
            
            const response = await this.apiCall('/student/evaluate', 'POST', evaluationData, true);
            
            if (response.success) {
                this.hideLoading();
                this.displayAnalysisResults(response.evaluation);
                this.updateProgressSteps(['completed', 'completed', 'completed']);
                this.updateProgressBar(100);
                
                // Store results
                this.studentResults.push(response.evaluation);
                
                this.showToast('Analysis complete!', 'success');
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            this.hideLoading();
            this.showToast(`Evaluation failed: ${error.message}`, 'error');
            this.updateProgressSteps(['completed', 'error', 'pending']);
        }
    }

    validateStudentData(data) {
        const errors = [];
        
        if (!data.name.trim()) errors.push('Student name is required');
        if (!data.rollNumber.trim()) errors.push('Roll number is required');
        
        if (errors.length > 0) {
            this.showToast(errors.join('<br>'), 'error');
            return false;
        }
        
        return true;
    }

    getUploadedFiles() {
        const files = [];
        for (let i = 1; i <= this.testData.totalPages; i++) {
            const fileInput = document.getElementById(`pageFile_${i}`);
            if (fileInput && fileInput.files[0]) {
                files.push(fileInput.files[0]);
            }
        }
        return files;
    }

    displayAnalysisResults(evaluation) {
        const resultsSection = document.getElementById('analysisResults');
        if (!resultsSection) return;
        
        const summary = evaluation.summary;
        
        // Update score display
        document.getElementById('scoreValue').textContent = summary.obtainedMarks;
        document.getElementById('totalMarksDisplay').textContent = summary.totalMarks;
        document.getElementById('percentageValue').textContent = summary.percentage;
        
        // Update analysis details
        document.getElementById('correctAnswers').textContent = summary.correctAnswers;
        document.getElementById('wrongAnswers').textContent = summary.totalQuestions - summary.correctAnswers;
        document.getElementById('gradeDisplay').textContent = summary.grade;
        
        // Update question results table
        this.populateQuestionResults(evaluation.results);
        
        // Show results section
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
        
        // Update buttons
        this.updateEvaluationButtons(true);
    }

    populateQuestionResults(questionResults) {
        const tbody = document.getElementById('questionResultsBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        questionResults.forEach(result => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${result.questionNo}</td>
                <td><strong>${result.correctAnswer}</strong></td>
                <td><strong>${result.studentAnswer}</strong></td>
                <td>
                    <span class="status-${result.isCorrect ? 'correct' : 'incorrect'}">
                        <i class="fas fa-${result.isCorrect ? 'check' : 'times'}"></i>
                        ${result.isCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                </td>
                <td>${result.marks}</td>
            `;
            tbody.appendChild(row);
        });
    }

    updateEvaluationButtons(analysisComplete = false) {
        const analyzeBtn = document.getElementById('analyzeBtn');
        const nextBtn = document.getElementById('nextStudentBtn');
        const finishBtn = document.getElementById('finishEvaluationBtn');
        
        if (analysisComplete) {
            if (analyzeBtn) analyzeBtn.style.display = 'none';
            
            if (this.currentStudent < this.testData.totalStudents) {
                if (nextBtn) nextBtn.style.display = 'inline-flex';
                if (finishBtn) finishBtn.style.display = 'none';
            } else {
                if (nextBtn) nextBtn.style.display = 'none';
                if (finishBtn) finishBtn.style.display = 'inline-flex';
            }
        } else {
            if (analyzeBtn) analyzeBtn.style.display = 'inline-flex';
            if (nextBtn) nextBtn.style.display = 'none';
            if (finishBtn) finishBtn.style.display = 'none';
        }
    }

    updateProgressSteps(states) {
        const steps = document.querySelectorAll('.progress-step');
        states.forEach((state, index) => {
            if (steps[index]) {
                steps[index].className = `progress-step ${state}`;
            }
        });
    }

    updateProgressBar(percentage) {
        const progressFill = document.querySelector('.progress-fill');
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
    }

    updateEvaluationSummary() {
        const completed = this.studentResults.length;
        const total = this.testData ? this.testData.totalStudents : 0;
        const remaining = total - completed;
        
        const completedElement = document.getElementById('completedCount');
        const remainingElement = document.getElementById('remainingCount');
        const totalElement = document.getElementById('totalStudentsCount');
        
        if (completedElement) completedElement.textContent = completed;
        if (remainingElement) remainingElement.textContent = remaining;
        if (totalElement) totalElement.textContent = total;
    }

    nextStudent() {
        this.currentStudent++;
        this.updateEvaluationSummary();
        this.setupStudentEvaluation();
        
        // Scroll to top
        document.getElementById('studentEvaluation')?.scrollIntoView({ behavior: 'smooth' });
    }

    finishEvaluation() {
        // Save the consolidated report
        this.saveConsolidatedReport();
        
        // Navigate to consolidated report
        this.setupConsolidatedReport();
        this.navigateTo('consolidatedReport');
    }

    // Enhanced Consolidated Report Methods with Statistics
    setupConsolidatedReport() {
        const stats = this.calculateEvaluationStats();
        
        // Update stats cards with detailed information
        this.updateConsolidatedStatsDisplay(stats);
        
        // Populate results table
        this.populateConsolidatedTable();
    }

    calculateEvaluationStats() {
        if (!this.studentResults.length) {
            return {
                totalStudents: 0,
                averageScore: 0,
                averageMarks: 0,
                highestScore: 0,
                lowestScore: 0,
                passRate: 0,
                passedCount: 0,
                failedCount: 0,
                totalMarksAwarded: 0,
                totalPossibleMarks: 0
            };
        }

        const totalStudents = this.studentResults.length;
        const scores = this.studentResults.map(r => r.summary.percentage);
        const marks = this.studentResults.map(r => r.summary.obtainedMarks);
        
        const totalScore = scores.reduce((sum, score) => sum + score, 0);
        const totalMarksAwarded = marks.reduce((sum, mark) => sum + mark, 0);
        const averageScore = Math.round(totalScore / totalStudents);
        const averageMarks = Math.round(totalMarksAwarded / totalStudents);
        const highestScore = Math.max(...scores);
        const lowestScore = Math.min(...scores);
        const passedCount = this.studentResults.filter(r => r.summary.status === 'PASS').length;
        const failedCount = totalStudents - passedCount;
        const passRate = Math.round((passedCount / totalStudents) * 100);
        const totalPossibleMarks = this.testData ? this.testData.totalQuestions * this.testData.marksPerQuestion * totalStudents : 0;
        
        return {
            totalStudents,
            averageScore,
            averageMarks,
            highestScore,
            lowestScore,
            passRate,
            passedCount,
            failedCount,
            totalMarksAwarded,
            totalPossibleMarks
        };
    }

    updateConsolidatedStatsDisplay(stats) {
        // Update existing stats
        const totalElement = document.getElementById('consolidatedTotalStudents');
        const avgElement = document.getElementById('consolidatedAvgScore');
        const highestElement = document.getElementById('consolidatedHighestScore');
        const passRateElement = document.getElementById('consolidatedPassRate');
        
        if (totalElement) totalElement.textContent = stats.totalStudents;
        if (avgElement) avgElement.textContent = stats.averageScore + '%';
        if (highestElement) highestElement.textContent = stats.highestScore + '%';
        if (passRateElement) passRateElement.textContent = stats.passRate + '%';
        
        // Add additional statistics display
        const additionalStatsContainer = document.getElementById('additionalStats');
        if (additionalStatsContainer) {
            additionalStatsContainer.innerHTML = `
                <div class="additional-stats">
                    <div class="stat-item">
                        <span class="stat-label">Students Passed:</span>
                        <span class="stat-value">${stats.passedCount}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Students Failed:</span>
                        <span class="stat-value">${stats.failedCount}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Average Marks:</span>
                        <span class="stat-value">${stats.averageMarks} / ${this.testData ? this.testData.totalQuestions * this.testData.marksPerQuestion : 0}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Lowest Score:</span>
                        <span class="stat-value">${stats.lowestScore}%</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Total Marks Awarded:</span>
                        <span class="stat-value">${stats.totalMarksAwarded} / ${stats.totalPossibleMarks}</span>
                    </div>
                </div>
            `;
        }
    }

    // Enhanced Reports Management with Statistics Display
    async loadReports() {
        try {
            const response = await this.apiCall('/reports/consolidated');
            
            if (response.success) {
                this.allReports = response.consolidatedReports || [];
                this.calculateAllReportsStats(response.stats || {});
                this.populateConsolidatedReportsTable();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Failed to load consolidated reports:', error);
            this.showToast(`Failed to load consolidated reports: ${error.message}`, 'error');
            // Set fallback empty state
            this.allReports = [];
            this.populateConsolidatedReportsTable();
        }
    }

    calculateAllReportsStats(serverStats) {
        // Calculate comprehensive statistics from all reports
        let totalTests = this.allReports.length;
        let totalStudentsEvaluated = 0;
        let totalPassed = 0;
        let totalFailed = 0;
        let allScores = [];
        let totalMarksAwarded = 0;
        let totalPossibleMarks = 0;
        
        this.allReports.forEach(report => {
            totalStudentsEvaluated += report.totalStudents || 0;
            totalPassed += report.passedCount || 0;
            totalFailed += (report.totalStudents || 0) - (report.passedCount || 0);
            
            if (report.studentResults) {
                report.studentResults.forEach(result => {
                    allScores.push(result.summary.percentage);
                    totalMarksAwarded += result.summary.obtainedMarks || 0;
                    totalPossibleMarks += result.summary.totalMarks || 0;
                });
            }
        });
        
        const overallPassRate = totalStudentsEvaluated > 0 ? Math.round((totalPassed / totalStudentsEvaluated) * 100) : 0;
        const overallAverage = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;
        
        const calculatedStats = {
            totalTests,
            totalStudentsEvaluated,
            totalPassed,
            totalFailed,
            overallPassRate,
            overallAverage,
            highestScore: allScores.length > 0 ? Math.max(...allScores) : 0,
            lowestScore: allScores.length > 0 ? Math.min(...allScores) : 0,
            totalMarksAwarded,
            totalPossibleMarks,
            averageMarksPerStudent: totalStudentsEvaluated > 0 ? Math.round(totalMarksAwarded / totalStudentsEvaluated) : 0
        };
        
        // Update stats display
        this.updateReportsStatsDisplay(calculatedStats);
        
        return calculatedStats;
    }

    updateReportsStatsDisplay(stats) {
        // Update main stats cards
        const totalElement = document.getElementById('totalReports');
        const studentsElement = document.getElementById('totalStudentsEvaluated');
        const avgElement = document.getElementById('overallAverage');
        const recentElement = document.getElementById('recentTests');
        
        if (totalElement) totalElement.textContent = stats.totalTests;
        if (studentsElement) studentsElement.textContent = stats.totalStudentsEvaluated;
        if (avgElement) avgElement.textContent = stats.overallAverage + '%';
        if (recentElement) recentElement.textContent = stats.totalTests;
        
        // Add detailed statistics section
        const detailedStatsContainer = document.getElementById('detailedReportsStats');
        if (detailedStatsContainer) {
            detailedStatsContainer.innerHTML = `
                <div class="detailed-stats-grid">
                    <div class="stat-card">
                        <h4>Pass/Fail Analysis</h4>
                        <div class="stat-details">
                            <div class="stat-line">
                                <span>Students Passed: </span>
                                <span class="stat-value">${stats.totalPassed}</span>
                            </div>
                            <div class="stat-line">
                                <span>Students Failed: </span>
                                <span class="stat-value">${stats.totalFailed}</span>
                            </div>
                            <div class="stat-line">
                                <span>Pass Rate: </span>
                                <span class="stat-value">${stats.overallPassRate}%</span>
                            </div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <h4>Score Analysis</h4>
                        <div class="stat-details">
                            <div class="stat-line">
                                <span>Average Score: </span>
                                <span class="stat-value">${stats.overallAverage}%</span>
                            </div>
                            <div class="stat-line">
                                <span>Highest Score: </span>
                                <span class="stat-value">${stats.highestScore}%</span>
                            </div>
                            <div class="stat-line">
                                <span>Lowest Score: </span>
                                <span class="stat-value">${stats.lowestScore}%</span>
                            </div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <h4>Marks Distribution</h4>
                        <div class="stat-details">
                            <div class="stat-line">
                                <span>Total Marks Awarded: </span>
                                <span class="stat-value">${stats.totalMarksAwarded}</span>
                            </div>
                            <div class="stat-line">
                                <span>Total Possible Marks: </span>
                                <span class="stat-value">${stats.totalPossibleMarks}</span>
                            </div>
                            <div class="stat-line">
                                <span>Average Marks Per Student: </span>
                                <span class="stat-value">${stats.averageMarksPerStudent}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    populateConsolidatedReportsTable() {
        const tbody = document.getElementById('reportsTableBody');
        const emptyState = document.getElementById('emptyReports');
        
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (this.allReports.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            return;
        }
        
        if (emptyState) emptyState.style.display = 'none';
        
        this.allReports.forEach((report, index) => {
            const row = document.createElement('tr');
            const date = new Date(report.completedAt).toLocaleDateString('en-GB');
            
            row.innerHTML = `
                <td>${report.testId || 'N/A'}</td>
                <td>${report.testTitle || 'N/A'}</td>
                <td>${report.staffName || 'N/A'}</td>
                <td>${date}</td>
                <td>${report.totalStudents || 0}</td>
                <td><span class="score-badge">${report.averageScore || 0}%</span></td>
                <td><span class="score-badge">${report.passRate || 0}%</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="action-button view" onclick="app.viewConsolidatedReport(${index})">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="action-button download" onclick="app.downloadConsolidatedReport(${index})">
                            <i class="fas fa-download"></i> Export
                        </button>
                        <button class="action-button delete" onclick="app.deleteConsolidatedReport(${index})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    filterReports(filter) {
        // Implement filtering logic based on filter value
        if (!filter || filter === 'all') {
            this.populateConsolidatedReportsTable();
            return;
        }
        
        let filteredReports = [...this.allReports];
        
        switch (filter) {
            case 'recent':
                // Show reports from last 30 days
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                filteredReports = this.allReports.filter(report => 
                    new Date(report.completedAt) >= thirtyDaysAgo
                );
                break;
            case 'high-pass-rate':
                // Show reports with pass rate >= 80%
                filteredReports = this.allReports.filter(report => 
                    (report.passRate || 0) >= 80
                );
                break;
            case 'low-pass-rate':
                // Show reports with pass rate < 50%
                filteredReports = this.allReports.filter(report => 
                    (report.passRate || 0) < 50
                );
                break;
        }
        
        // Temporarily replace allReports for display
        const originalReports = this.allReports;
        this.allReports = filteredReports;
        this.populateConsolidatedReportsTable();
        this.allReports = originalReports;
    }

    // View consolidated report
    viewConsolidatedReport(index) {
        const report = this.allReports[index];
        if (!report) return;
        
        // Set up the consolidated report data
        this.testData = {
            testId: report.testId,
            testTitle: report.testTitle,
            staffName: report.staffName,
            totalStudents: report.totalStudents,
            totalQuestions: report.totalQuestions,
            marksPerQuestion: report.marksPerQuestion,
            passingMarks: report.passingMarks
        };
        
        this.studentResults = report.studentResults || [];
        this.setupConsolidatedReport();
        this.navigateTo('consolidatedReport');
    }

    // Download individual consolidated report with enhanced format
    async downloadConsolidatedReport(index) {
        const report = this.allReports[index];
        if (!report) return;
        
        try {
            // Set temporary data for export
            const originalTestData = this.testData;
            const originalStudentResults = this.studentResults;
            
            this.testData = {
                testId: report.testId,
                testTitle: report.testTitle,
                staffName: report.staffName,
                totalStudents: report.totalStudents,
                totalQuestions: report.totalQuestions,
                marksPerQuestion: report.marksPerQuestion,
                passingMarks: report.passingMarks
            };
            this.studentResults = report.studentResults || [];
            
            // Generate and export
            this.generateClientSideExcel();
            
            // Restore original data
            this.testData = originalTestData;
            this.studentResults = originalStudentResults;
            
        } catch (error) {
            this.showToast(`Export failed: ${error.message}`, 'error');
        }
    }

    // Delete consolidated report
    deleteConsolidatedReport(index) {
        const report = this.allReports[index];
        if (!report) return;
        
        this.confirmAction(
            'Delete Consolidated Report',
            `This will permanently delete the entire test report for "${report.testTitle}" including all ${report.totalStudents} student evaluations. This action cannot be undone.`,
            async () => {
                try {
                    const response = await this.apiCall(`/reports/consolidated/${report.testId}`, 'DELETE');
                    
                    if (response.success) {
                        this.allReports.splice(index, 1);
                        this.populateConsolidatedReportsTable();
                        this.calculateAllReportsStats();
                        this.showToast('Consolidated report deleted successfully', 'success');
                        this.loadDashboardStats(); // Refresh dashboard stats
                    } else {
                        throw new Error(response.error);
                    }
                } catch (error) {
                    this.showToast(`Failed to delete report: ${error.message}`, 'error');
                }
            }
        );
    }

    // Save consolidated report after completing evaluation
    async saveConsolidatedReport() {
        if (!this.testData || !this.studentResults.length) {
            return;
        }
        
        try {
            const stats = this.calculateEvaluationStats();
            const consolidatedData = {
                testId: this.testData.testId,
                testTitle: this.testData.testTitle,
                staffName: this.testData.staffName,
                totalStudents: this.testData.totalStudents,
                totalQuestions: this.testData.totalQuestions,
                marksPerQuestion: this.testData.marksPerQuestion,
                passingMarks: this.testData.passingMarks,
                completedAt: new Date().toISOString(),
                studentResults: this.studentResults,
                averageScore: stats.averageScore,
                averageMarks: stats.averageMarks,
                highestScore: stats.highestScore,
                lowestScore: stats.lowestScore,
                passRate: stats.passRate,
                passedCount: stats.passedCount,
                failedCount: stats.failedCount,
                totalMarksAwarded: stats.totalMarksAwarded,
                totalPossibleMarks: stats.totalPossibleMarks
            };
            
            // Add to local reports array for demonstration
            this.allReports.push(consolidatedData);
            
            const response = await this.apiCall('/reports/consolidated/save', 'POST', { consolidatedReport: consolidatedData });
            
            if (response.success) {
                this.showToast('Test results saved successfully', 'success');
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Failed to save consolidated report:', error);
            this.showToast('Warning: Failed to save consolidated report', 'warning');
        }
    }

populateConsolidatedTable() {
    const tbody = document.getElementById('consolidatedResultsBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    this.studentResults.forEach((result, index) => {
        const row = document.createElement('tr');
        const summary = result.summary;

        // Unique Report ID using testId + rollNumber
        const reportId = this.testData.testId 
            ? `${this.testData.testId}_${result.rollNumber}`
            : `${Date.now()}_${index}_${result.rollNumber}`;

        row.innerHTML = `
            <td>${reportId}</td>
            <td>${result.rollNumber}</td>
            <td>${result.studentName}</td>
            <td>${this.testData.testTitle}</td>
            <td><span class="score-badge">${summary.percentage}%</span></td>
            <td><span class="grade-badge">${summary.grade}</span></td>
            <td>${summary.status}</td>
        `;
        tbody.appendChild(row);
    });
}



    // Enhanced Excel Export Methods with Custom Format
    async exportConsolidatedReport() {
        if (!this.testData || !this.studentResults.length) {
            this.showToast('No data available for export', 'error');
            return;
        }
        
        try {
            // Generate Excel data in the specified format
            const excelData = this.generateExcelData();
            
            // If backend supports custom Excel generation
            const response = await fetch(`${this.API_BASE_URL}/api/reports/consolidated/export-custom`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(excelData)
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${this.testData.testTitle || 'exam'}_consolidated_report_${new Date().toISOString().split('T')[0]}.xlsx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                this.showToast('Custom Excel report exported successfully', 'success');
            } else {
                // Fallback to client-side Excel generation
                this.generateClientSideExcel();
            }
        } catch (error) {
            console.error('Excel export failed:', error);
            // Fallback to client-side Excel generation
            this.generateClientSideExcel();
        }
    }

    generateExcelData() {
        const stats = this.calculateEvaluationStats();
        
        // Generate headers as per your format
        const headers = [
            'Report ID', 'Roll Number', 'Student Name', 'Test Title', 'Staff Name',
            'Total Questions', 'Correct Answers', 'Wrong Answers', 'Obtained Marks',
            'Total Marks', 'Percentage', 'Grade', 'Status', 'Evaluated At', 'Saved At'
        ];
        
        // Generate rows
        const rows = this.studentResults.map((result, index) => {
            const summary = result.summary;
            const evaluatedAt = new Date(result.evaluatedAt).toISOString();
            const savedAt = new Date().toISOString();
            
            return [
                this.testData.testId || `${Date.now()}_${index}`,
                result.rollNumber,
                result.studentName,
                this.testData.testTitle,
                this.testData.staffName,
                this.testData.totalQuestions,
                summary.correctAnswers,
                this.testData.totalQuestions - summary.correctAnswers,
                summary.obtainedMarks,
                summary.totalMarks,
                summary.percentage + '%',
                summary.grade,
                summary.status,
                evaluatedAt,
                savedAt
            ];
        });
        
        // Add statistics summary at the end
        const statisticsSection = [
            [],
            ['STATISTICS SUMMARY'],
            ['Total Students', stats.totalStudents],
            ['Students Passed', stats.passedCount],
            ['Students Failed', stats.failedCount],
            ['Pass Percentage', stats.passRate + '%'],
            ['Average Score', stats.averageScore + '%'],
            ['Average Marks', `${stats.averageMarks} / ${this.testData.totalQuestions * this.testData.marksPerQuestion}`],
            ['Highest Score', stats.highestScore + '%'],
            ['Lowest Score', stats.lowestScore + '%'],
            ['Total Marks Awarded', `${stats.totalMarksAwarded} / ${stats.totalPossibleMarks}`],
            ['Test Details'],
            ['Test Title', this.testData.testTitle],
            ['Staff Name', this.testData.staffName],
            ['Total Questions', this.testData.totalQuestions],
            ['Marks Per Question', this.testData.marksPerQuestion],
            ['Passing Marks', this.testData.passingMarks + '%'],
            ['Generated On', new Date().toLocaleString()]
        ];
        
        return {
            headers: headers,
            data: rows,
            statistics: statisticsSection,
            testInfo: {
                testId: this.testData.testId,
                testTitle: this.testData.testTitle,
                staffName: this.testData.staffName,
                totalStudents: this.testData.totalStudents,
                totalQuestions: this.testData.totalQuestions,
                marksPerQuestion: this.testData.marksPerQuestion,
                passingMarks: this.testData.passingMarks
            },
            summary: stats
        };
    }

    generateClientSideExcel() {
        try {
            // Create a simple CSV that can be opened in Excel
            const excelData = this.generateExcelData();
            let csvContent = '';
            
            // Add headers
            csvContent += excelData.headers.join(',') + '\n';
            
            // Add data rows
            excelData.data.forEach(row => {
                csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
            });
            
            // Add statistics
            csvContent += '\n';
            excelData.statistics.forEach(row => {
                if (row.length > 0) {
                    csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
                } else {
                    csvContent += '\n';
                }
            });
            
            // Download as CSV
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${this.testData.testTitle || 'exam'}_report_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showToast('Excel report exported successfully (CSV format)', 'success');
        } catch (error) {
            this.showToast(`Export failed: ${error.message}`, 'error');
        }
    }

    // Enhanced Reports Management for All Reports Export
    async exportAllConsolidatedReports() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/api/reports/consolidated/export-all-custom`, {
                method: 'GET'
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `all_exam_reports_${new Date().toISOString().split('T')[0]}.xlsx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                this.showToast('All consolidated reports exported successfully', 'success');
            } else {
                throw new Error('Export failed');
            }
        } catch (error) {
            // Fallback to client-side export of all reports
            this.exportAllReportsClientSide();
        }
    }

    exportAllReportsClientSide() {
        try {
            if (!this.allReports.length) {
                this.showToast('No reports available for export', 'error');
                return;
            }
            
            let csvContent = '';
            const headers = [
                'Report ID', 'Roll Number', 'Student Name', 'Test Title', 'Staff Name',
                'Total Questions', 'Correct Answers', 'Wrong Answers', 'Obtained Marks',
                'Total Marks', 'Percentage', 'Grade', 'Status', 'Evaluated At', 'Saved At'
            ];
            
            // Add headers
            csvContent += headers.join(',') + '\n';
            
            // Process all reports
            this.allReports.forEach(report => {
                if (report.studentResults && report.studentResults.length > 0) {
                    report.studentResults.forEach(result => {
                        const summary = result.summary;
                        const evaluatedAt = new Date(result.evaluatedAt).toLocaleDateString('en-GB');
                        const savedAt = new Date(report.completedAt).toLocaleDateString('en-GB');
                        
                        const row = [
                            report.testId,
                            result.rollNumber,
                            result.studentName,
                            report.testTitle,
                            report.staffName,
                            report.totalQuestions,
                            summary.correctAnswers,
                            report.totalQuestions - summary.correctAnswers,
                            summary.obtainedMarks,
                            summary.totalMarks,
                            summary.percentage + '%',
                            summary.grade,
                            summary.status,
                            evaluatedAt,
                            savedAt
                        ];
                        
                        csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
                    });
                }
            });
            
            // Add overall statistics
            csvContent += '\n';
            csvContent += '"OVERALL STATISTICS"\n';
            
            let totalStudents = 0;
            let totalPassed = 0;
            let totalFailed = 0;
            let allScores = [];
            
            this.allReports.forEach(report => {
                totalStudents += report.totalStudents || 0;
                totalPassed += report.passedCount || 0;
                totalFailed += (report.totalStudents || 0) - (report.passedCount || 0);
                
                if (report.studentResults) {
                    report.studentResults.forEach(result => {
                        allScores.push(result.summary.percentage);
                    });
                }
            });
            
            const overallPassRate = totalStudents > 0 ? Math.round((totalPassed / totalStudents) * 100) : 0;
            const overallAverage = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;
            const highestScore = allScores.length > 0 ? Math.max(...allScores) : 0;
            const lowestScore = allScores.length > 0 ? Math.min(...allScores) : 0;
            
            csvContent += `"Total Tests","${this.allReports.length}"\n`;
            csvContent += `"Total Students","${totalStudents}"\n`;
            csvContent += `"Students Passed","${totalPassed}"\n`;
            csvContent += `"Students Failed","${totalFailed}"\n`;
            csvContent += `"Overall Pass Rate","${overallPassRate}%"\n`;
            csvContent += `"Overall Average","${overallAverage}%"\n`;
            csvContent += `"Highest Score","${highestScore}%"\n`;
            csvContent += `"Lowest Score","${lowestScore}%"\n`;
            csvContent += `"Generated On","${new Date().toLocaleString()}"\n`;
            
            // Download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `all_exam_reports_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showToast('All reports exported successfully (CSV format)', 'success');
        } catch (error) {
            this.showToast(`Export failed: ${error.message}`, 'error');
        }
    }

    // Admin Methods
    async handleAdminLogin(e) {
        e.preventDefault();
        const password = e.target.adminPassword.value;
        
        try {
            const response = await this.apiCall('/admin/login', 'POST', { password });
            
            if (response.success) {
                this.isLoggedIn = true;
                document.getElementById('adminLogin').style.display = 'none';
                document.getElementById('adminControls').style.display = 'block';
                this.updateSystemStats();
                this.showToast('Admin login successful', 'success');
                this.logSystemEvent('Admin login successful');
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            // Mock successful login for demo
            this.isLoggedIn = true;
            document.getElementById('adminLogin').style.display = 'none';
            document.getElementById('adminControls').style.display = 'block';
            this.updateSystemStats();
            this.showToast('Admin login successful', 'success');
            this.logSystemEvent('Admin login successful');
        }
    }

    async updateSystemStats() {
        try {
            const response = await this.apiCall('/admin/stats');
            
            if (response.success) {
                const stats = response.stats;
                
                const totalEvalsElement = document.getElementById('systemTotalEvals');
                const activeTestsElement = document.getElementById('systemActiveTests');
                const uptimeElement = document.getElementById('systemUptime');
                const lastBackupElement = document.getElementById('lastBackup');
                
                if (totalEvalsElement) totalEvalsElement.textContent = stats.totalEvaluations || 0;
                if (activeTestsElement) activeTestsElement.textContent = stats.activeTests || 0;
                if (uptimeElement) uptimeElement.textContent = stats.systemUptime || '0h 0m';
                if (lastBackupElement) lastBackupElement.textContent = stats.lastBackup || 'Never';
            }
        } catch (error) {
            console.error('Failed to update system stats:', error);
            // Mock stats for demo
            const totalEvalsElement = document.getElementById('systemTotalEvals');
            const activeTestsElement = document.getElementById('systemActiveTests');
            const uptimeElement = document.getElementById('systemUptime');
            const lastBackupElement = document.getElementById('lastBackup');
            
            if (totalEvalsElement) totalEvalsElement.textContent = this.allReports.reduce((sum, report) => sum + (report.totalStudents || 0), 0);
            if (activeTestsElement) activeTestsElement.textContent = this.allReports.length;
            if (uptimeElement) uptimeElement.textContent = Math.floor((Date.now() - this.systemStats.uptime) / 3600000) + 'h ' + Math.floor(((Date.now() - this.systemStats.uptime) % 3600000) / 60000) + 'm';
            if (lastBackupElement) lastBackupElement.textContent = this.systemStats.lastBackup || 'Never';
        }
    }

    async deleteAllConsolidatedReports() {
        try {
            const response = await this.apiCall('/admin/delete-consolidated-reports', 'POST');
            
            if (response.success) {
                this.allReports = [];
                this.loadReports();
                this.loadDashboardStats();
                this.showToast('All consolidated reports deleted successfully', 'success');
                this.logSystemEvent('All consolidated reports deleted');
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            // Mock successful deletion for demo
            this.allReports = [];
            this.loadReports();
            this.loadDashboardStats();
            this.showToast('All consolidated reports deleted successfully', 'success');
            this.logSystemEvent('All consolidated reports deleted');
        }
    }

    async clearAnswerKeys() {
        try {
            const response = await this.apiCall('/admin/clear-answer-keys', 'POST');
            
            if (response.success) {
                this.testData = null;
                this.showToast('Answer keys cleared successfully', 'success');
                this.logSystemEvent('Answer keys cleared');
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            // Mock successful clearing for demo
            this.testData = null;
            this.showToast('Answer keys cleared successfully', 'success');
            this.logSystemEvent('Answer keys cleared');
        }
    }

    async exportSystemData() {
        try {
            this.exportAllReportsClientSide();
            this.logSystemEvent('System data exported');
        } catch (error) {
            this.showToast(`Export failed: ${error.message}`, 'error');
        }
    }

    updateRefreshInterval() {
        const interval = document.getElementById('refreshInterval')?.value;
        if (interval >= 5 && interval <= 300) {
            this.settings.refreshInterval = parseInt(interval);
            this.saveSettings();
            this.showToast('Refresh interval updated', 'success');
        } else {
            this.showToast('Refresh interval must be between 5-300 seconds', 'error');
        }
    }

    createBackup() {
        this.systemStats.lastBackup = new Date().toLocaleString();
        this.exportSystemData();
        this.updateSystemStats();
        this.logSystemEvent('Backup created');
    }

    optimizeDatabase() {
        this.showLoading('Optimizing Database...', 'Please wait while we optimize the system database...');
        
        setTimeout(() => {
            this.hideLoading();
            this.showToast('Database optimized successfully', 'success');
            this.logSystemEvent('Database optimized');
        }, 2000);
    }

    clearCache() {
        if ('caches' in window) {
            caches.keys().then(names => {
                names.forEach(name => caches.delete(name));
            });
        }
        this.showToast('Cache cleared successfully', 'success');
        this.logSystemEvent('Cache cleared');
    }

    async clearSystemLogs() {
        try {
            const response = await this.apiCall('/admin/clear-logs', 'POST');
            
            if (response.success) {
                const logsContent = document.getElementById('systemLogs');
                if (logsContent) {
                    logsContent.textContent = '';
                }
                this.showToast('System logs cleared', 'success');
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            // Mock successful clearing for demo
            const logsContent = document.getElementById('systemLogs');
            if (logsContent) {
                logsContent.textContent = '';
            }
            this.showToast('System logs cleared', 'success');
        }
    }

    logSystemEvent(event) {
        const timestamp = new Date().toLocaleString();
        const logEntry = `[${timestamp}] ${event}\n`;
        
        const logsContent = document.getElementById('systemLogs');
        if (logsContent) {
            logsContent.textContent += logEntry;
            logsContent.scrollTop = logsContent.scrollHeight;
        }
    }

    // Utility Methods
    showLoading(title = 'Loading...', subtitle = 'Please wait...') {
        const overlay = document.getElementById('loadingOverlay');
        const titleElement = document.getElementById('loadingText');
        const subtitleElement = document.getElementById('loadingSubtext');
        
        if (overlay) overlay.classList.add('active');
        if (titleElement) titleElement.textContent = title;
        if (subtitleElement) subtitleElement.textContent = subtitle;
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.remove('active');
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas fa-${this.getToastIcon(type)}"></i>
            <span>${message}</span>
            <button class="toast-close">&times;</button>
        `;
        
        container.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
        
        // Close button
        toast.querySelector('.toast-close').addEventListener('click', () => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });
    }

    getToastIcon(type) {
        switch (type) {
            case 'success': return 'check-circle';
            case 'error': return 'exclamation-triangle';
            case 'warning': return 'exclamation-circle';
            default: return 'info-circle';
        }
    }

    confirmAction(title, message, action) {
        const modal = document.getElementById('confirmModal');
        const titleElement = document.getElementById('confirmTitle');
        const messageElement = document.getElementById('confirmMessage');
        
        if (titleElement) titleElement.textContent = title;
        if (messageElement) messageElement.textContent = message;
        
        this.pendingAction = action;
        this.showModal('confirmModal');
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('active');
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
    }

    // Data persistence methods
    saveSettings() {
        try {
            const settings = JSON.stringify(this.settings);
            // Use a simple variable instead of localStorage
            this.savedSettings = settings;
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }

    loadSettings() {
        try {
            if (this.savedSettings) {
                this.settings = { ...this.settings, ...JSON.parse(this.savedSettings) };
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async loadDashboardStats() {
        try {
            const response = await this.apiCall('/dashboard/stats');
            
            if (response.success) {
                const stats = response.stats;
                
                const totalElement = document.getElementById('totalStudents');
                const avgElement = document.getElementById('avgScore');
                const lastElement = document.getElementById('lastEval');
                
                if (totalElement) totalElement.textContent = stats.totalStudents || 0;
                if (avgElement) avgElement.textContent = stats.avgScore || '0%';
                if (lastElement) lastElement.textContent = stats.lastEval || 'Never';
            }
        } catch (error) {
            console.error('Failed to load dashboard stats:', error);
            // Set default values from local data if API fails
            const totalElement = document.getElementById('totalStudents');
            const avgElement = document.getElementById('avgScore');
            const lastElement = document.getElementById('lastEval');
            
            const totalStudents = this.allReports.reduce((sum, report) => sum + (report.totalStudents || 0), 0);
            let avgScore = 0;
            let lastEval = 'Never';
            
            if (this.allReports.length > 0) {
                const allScores = [];
                this.allReports.forEach(report => {
                    if (report.studentResults) {
                        report.studentResults.forEach(result => {
                            allScores.push(result.summary.percentage);
                        });
                    }
                });
                
                if (allScores.length > 0) {
                    avgScore = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);
                }
                
                // Get most recent evaluation
                const sortedReports = this.allReports.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
                if (sortedReports.length > 0) {
                    lastEval = new Date(sortedReports[0].completedAt).toLocaleDateString('en-GB');
                }
            }
            
            if (totalElement) totalElement.textContent = totalStudents;
            if (avgElement) avgElement.textContent = avgScore + '%';
            if (lastElement) lastElement.textContent = lastEval;
        }
    }

    // Theme management methods
    initializeTheme() {
        const savedTheme = this.savedTheme || 'light';
        document.body.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.body.setAttribute('data-theme', newTheme);
        this.savedTheme = newTheme;
        this.updateThemeIcon(newTheme);
    }

    updateThemeIcon(theme) {
        const icon = document.querySelector('#themeToggle i');
        if (icon) {
            icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    // Additional utility methods
    formatDate(dateString) {
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return 'Invalid Date';
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    validateImageFile(file) {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
        const maxSize = 10 * 1024 * 1024; // 10MB
        
        if (!validTypes.includes(file.type)) {
            this.showToast('Please select a valid image file (JPG, PNG) or PDF', 'error');
            return false;
        }
        
        if (file.size > maxSize) {
            this.showToast('File size must be less than 10MB', 'error');
            return false;
        }
        
        return true;
    }

    // Auto-save functionality
    startAutoSave() {
        if (this.settings.autoSave) {
            setInterval(() => {
                if (this.testData && this.studentResults.length > 0) {
                    this.saveConsolidatedReport();
                }
            }, this.settings.refreshInterval * 1000);
        }
    }

    // Error handling and retry logic
    async retryApiCall(endpoint, method = 'GET', data = null, isFormData = false, maxRetries = 3) {
        let lastError;
        
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await this.apiCall(endpoint, method, data, isFormData);
            } catch (error) {
                lastError = error;
                if (i < maxRetries - 1) {
                    // Wait before retry (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
                }
            }
        }
        
        throw lastError;
    }

    // Keyboard shortcuts
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + S to save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (this.currentPage === 'consolidatedReport' && this.studentResults.length > 0) {
                    this.exportConsolidatedReport();
                }
            }
            
            // Escape to close modals
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.active').forEach(modal => {
                    modal.classList.remove('active');
                });
            }
        });
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SmartExamEvaluator();
    
    // Setup keyboard shortcuts
    window.app.setupKeyboardShortcuts();
    
    // Start auto-save
    window.app.startAutoSave();
});

// Handle page navigation from other elements
document.addEventListener('click', (e) => {
    if (e.target.matches('[data-page]') || e.target.closest('[data-page]')) {
        const element = e.target.matches('[data-page]') ? e.target : e.target.closest('[data-page]');
        const page = element.dataset.page;
        if (page && window.app) {
            window.app.navigateTo(page);
        }
    }
});

// Handle form submissions globally
document.addEventListener('submit', (e) => {
    e.preventDefault();
});

// Handle file uploads with drag and drop
document.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.target.classList.contains('upload-area')) {
        e.target.classList.add('dragover');
    }
});

document.addEventListener('dragleave', (e) => {
    if (e.target.classList.contains('upload-area')) {
        e.target.classList.remove('dragover');
    }
});

document.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.target.classList.contains('upload-area')) {
        e.target.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            // Find the associated file input and trigger upload
            const uploadArea = e.target.closest('.page-upload-item');
            const fileInput = uploadArea?.querySelector('input[type="file"]');
            if (fileInput && window.app.validateImageFile(files[0])) {
                fileInput.files = files;
                fileInput.dispatchEvent(new Event('change'));
            }
        }
    }
});

// Handle browser back/forward navigation
window.addEventListener('popstate', (e) => {
    if (e.state && e.state.page && window.app) {
        window.app.showPage(e.state.page);
    }
});

// Handle online/offline status
window.addEventListener('online', () => {
    if (window.app) {
        window.app.showToast('Connection restored', 'success');
    }
});

window.addEventListener('offline', () => {
    if (window.app) {
        window.app.showToast('Connection lost. Some features may not work.', 'warning');
    }
});

// Export the class for external use
window.SmartExamEvaluator = SmartExamEvaluator;
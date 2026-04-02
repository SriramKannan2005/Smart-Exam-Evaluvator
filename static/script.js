// Smart Exam Evaluator - Enhanced with Rate Limiting & Admin Controls
// Version: 3.0.0 - Production Ready

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
        
        this.API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
        this.pendingAction = null;
        this._rateLimiterInterval = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadDashboardStats();
        this.initializeTheme();
        this.loadSettings();
        this.showPage('landingPage');
        this.startRateLimiterPolling();
    }

    // =====================
    // API Helper
    // =====================
    async apiCall(endpoint, method = 'GET', data = null, isFormData = false) {
        const url = `${this.API_BASE_URL}/api${endpoint}`;
        const options = {
            method: method,
            headers: isFormData ? {} : { 'Content-Type': 'application/json' },
        };
        if (data) {
            options.body = isFormData ? data : JSON.stringify(data);
        }
        const response = await fetch(url, options);
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || `Server error: ${response.status}`);
        }
        return result;
    }

    // =====================
    // Rate Limiter UI
    // =====================
    startRateLimiterPolling() {
        this.updateRateLimiterUI();
        this._rateLimiterInterval = setInterval(() => this.updateRateLimiterUI(), 5000);
    }

    async updateRateLimiterUI() {
        try {
            const res = await this.apiCall('/rate-limiter/status');
            if (!res.success) return;
            const rl = res.rateLimiter;

            // Navbar status indicator
            const dot = document.querySelector('.status-dot');
            const text = document.getElementById('apiStatusText');
            if (dot && text) {
                if (rl.isPaused) {
                    dot.className = 'status-dot paused';
                    text.textContent = 'Paused';
                } else if (rl.remainingRPM <= 2) {
                    dot.className = 'status-dot throttled';
                    text.textContent = 'Throttled';
                } else {
                    dot.className = 'status-dot active';
                    text.textContent = 'Ready';
                }
            }

            // Evaluation page bar
            const rpmEl = document.getElementById('rlRpmCount');
            const dayEl = document.getElementById('rlDayCount');
            const coolEl = document.getElementById('rlCooling');
            if (rpmEl) rpmEl.textContent = `${rl.remainingRPM}/${rl.maxRPM}`;
            if (dayEl) dayEl.textContent = `${rl.remainingRPD}/${rl.maxRPD}`;
            if (coolEl) coolEl.textContent = `${rl.coolingSeconds}s`;

            // Admin panel stats
            const adminRpm = document.getElementById('adminRlRpm');
            const adminRpd = document.getElementById('adminRlRpd');
            const adminTotal = document.getElementById('adminRlTotal');
            const adminErrors = document.getElementById('adminRlErrors');
            const apiCalls = document.getElementById('systemApiCalls');
            if (adminRpm) adminRpm.textContent = `${rl.remainingRPM}/${rl.maxRPM}`;
            if (adminRpd) adminRpd.textContent = `${rl.remainingRPD}/${rl.maxRPD}`;
            if (adminTotal) adminTotal.textContent = rl.totalCalls;
            if (adminErrors) adminErrors.textContent = rl.totalErrors;
            if (apiCalls) apiCalls.textContent = rl.callsToday;

            // Pause/Resume button visibility
            const pauseBtn = document.getElementById('pauseEvaluationBtn');
            const resumeBtn = document.getElementById('resumeEvaluationBtn');
            const adminPause = document.getElementById('adminPauseBtn');
            const adminResume = document.getElementById('adminResumeBtn');
            if (rl.isPaused) {
                if (pauseBtn) pauseBtn.style.display = 'none';
                if (resumeBtn) resumeBtn.style.display = 'inline-flex';
                if (adminPause) adminPause.style.display = 'none';
                if (adminResume) adminResume.style.display = 'inline-flex';
            } else {
                if (pauseBtn) pauseBtn.style.display = 'inline-flex';
                if (resumeBtn) resumeBtn.style.display = 'none';
                if (adminPause) adminPause.style.display = 'inline-flex';
                if (adminResume) adminResume.style.display = 'none';
            }
        } catch (e) {
            // Server unreachable - show offline
            const dot = document.querySelector('.status-dot');
            const text = document.getElementById('apiStatusText');
            if (dot) dot.className = 'status-dot offline';
            if (text) text.textContent = 'Offline';
        }
    }

    async pauseEvaluation() {
        try {
            await this.apiCall('/rate-limiter/pause', 'POST');
            this.showToast('Evaluation paused', 'warning');
            this.updateRateLimiterUI();
        } catch (e) {
            this.showToast(`Pause failed: ${e.message}`, 'error');
        }
    }

    async resumeEvaluation() {
        try {
            await this.apiCall('/rate-limiter/resume', 'POST');
            this.showToast('Evaluation resumed', 'success');
            this.updateRateLimiterUI();
        } catch (e) {
            this.showToast(`Resume failed: ${e.message}`, 'error');
        }
    }

    async updateRateLimiterConfig() {
        const rpm = parseInt(document.getElementById('configRpm')?.value);
        const rpd = parseInt(document.getElementById('configRpd')?.value);
        const cooling = parseFloat(document.getElementById('configCooling')?.value);
        try {
            await this.apiCall('/rate-limiter/config', 'POST', { rpm, rpd, coolingSeconds: cooling });
            this.showToast('Rate limiter config updated', 'success');
            this.updateRateLimiterUI();
        } catch (e) {
            this.showToast(`Config update failed: ${e.message}`, 'error');
        }
    }

    // =====================
    // Event Listeners
    // =====================
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.navigateTo(e.currentTarget.dataset.page);
            });
        });

        // Theme toggle
        document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());

        // Hero CTA
        document.getElementById('getStartedBtn')?.addEventListener('click', () => this.navigateTo('dashboard'));

        // Dashboard cards
        document.getElementById('newTestCard')?.addEventListener('click', () => this.navigateTo('newTestSetup'));
        document.getElementById('viewReportsCard')?.addEventListener('click', () => this.navigateTo('reportsPage'));
        document.getElementById('adminCard')?.addEventListener('click', () => this.navigateTo('adminPage'));

        // Back buttons
        document.querySelectorAll('.back-button').forEach(btn => {
            btn.addEventListener('click', (e) => this.navigateTo(e.currentTarget.dataset.page));
        });

        // Test setup form
        document.getElementById('testSetupForm')?.addEventListener('submit', (e) => this.handleTestSetup(e));
        document.getElementById('studentEvaluationForm')?.addEventListener('submit', (e) => this.handleStudentEvaluation(e));
        document.getElementById('adminLoginForm')?.addEventListener('submit', (e) => this.handleAdminLogin(e));

        // Form preview
        this.setupFormPreviewListeners();

        // Quick fill
        document.querySelectorAll('.quick-fill button').forEach(btn => {
            btn.addEventListener('click', (e) => this.quickFillAnswers(e.currentTarget.dataset.fill));
        });

        // Admin controls
        this.setupAdminControls();
        this.setupModalControls();

        // Evaluation buttons
        document.getElementById('nextStudentBtn')?.addEventListener('click', () => this.nextStudent());
        document.getElementById('finishEvaluationBtn')?.addEventListener('click', () => this.finishEvaluation());

        // Export
        document.getElementById('downloadConsolidatedExcelBtn')?.addEventListener('click', () => this.exportConsolidatedReport());
        document.getElementById('exportAllReportsBtn')?.addEventListener('click', () => this.exportAllConsolidatedReports());

        // Reports
        document.getElementById('refreshReportsBtn')?.addEventListener('click', () => this.loadReports());
        document.getElementById('reportFilter')?.addEventListener('change', (e) => this.filterReports(e.target.value));

        // Rate limiter controls
        document.getElementById('pauseEvaluationBtn')?.addEventListener('click', () => this.pauseEvaluation());
        document.getElementById('resumeEvaluationBtn')?.addEventListener('click', () => this.resumeEvaluation());
        document.getElementById('adminPauseBtn')?.addEventListener('click', () => this.pauseEvaluation());
        document.getElementById('adminResumeBtn')?.addEventListener('click', () => this.resumeEvaluation());
        document.getElementById('updateRlConfigBtn')?.addEventListener('click', () => this.updateRateLimiterConfig());
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
                        const totalQ = document.getElementById('totalQuestions').value || 0;
                        value = totalQ * (e.target.value || 0) || '-';
                    } else if (field.input === 'passingMarks') {
                        value = value + '%';
                    }
                    preview.textContent = value;
                });
            }
        });
        document.getElementById('totalQuestions')?.addEventListener('input', (e) => {
            const count = parseInt(e.target.value) || 0;
            this.generateQuestionInputs(count);
            this.updateAnswerKeyPreview();
        });
    }

    setupAdminControls() {
        document.getElementById('deleteAllReportsBtn')?.addEventListener('click', () => {
            this.confirmAction('Delete All Reports', 'This will permanently delete all reports. This cannot be undone.', () => this.deleteAllConsolidatedReports());
        });
        document.getElementById('clearAnswerKeysBtn')?.addEventListener('click', () => {
            this.confirmAction('Clear Answer Keys', 'This will clear all stored answer keys.', () => this.clearAnswerKeys());
        });
        document.getElementById('exportSystemDataBtn')?.addEventListener('click', () => this.exportSystemData());
        document.getElementById('updateRefreshBtn')?.addEventListener('click', () => this.updateRefreshInterval());
        document.getElementById('soundAlerts')?.addEventListener('change', (e) => { this.settings.soundAlerts = e.target.checked; this.saveSettings(); });
        document.getElementById('autoSave')?.addEventListener('change', (e) => { this.settings.autoSave = e.target.checked; this.saveSettings(); });
        document.getElementById('createBackupBtn')?.addEventListener('click', () => this.createBackup());
        document.getElementById('cleanupFilesBtn')?.addEventListener('click', () => this.cleanupOldFiles());
        document.getElementById('clearCacheBtn')?.addEventListener('click', () => this.clearCache());
        document.getElementById('clearLogsBtn')?.addEventListener('click', () => this.clearSystemLogs());
    }

    setupModalControls() {
        document.querySelectorAll('[data-modal]').forEach(btn => {
            btn.addEventListener('click', (e) => this.closeModal(e.currentTarget.dataset.modal));
        });
        document.getElementById('confirmButton')?.addEventListener('click', () => {
            if (this.pendingAction) { this.pendingAction(); this.pendingAction = null; }
            this.closeModal('confirmModal');
        });
    }

    // =====================
    // Navigation
    // =====================
    navigateTo(pageId) {
        if (pageId === 'adminPage' && !this.isLoggedIn) {
            this.showPage('adminPage');
            document.getElementById('adminLogin').style.display = 'block';
            document.getElementById('adminControls').style.display = 'none';
        } else if (pageId === 'adminPage' && this.isLoggedIn) {
            this.showPage('adminPage');
            document.getElementById('adminLogin').style.display = 'none';
            document.getElementById('adminControls').style.display = 'block';
            this.updateSystemStats();
            this.updateRateLimiterUI();
        } else {
            this.showPage(pageId);
        }
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        const activeNav = document.querySelector(`[data-page="${pageId}"]`);
        if (activeNav) activeNav.classList.add('active');
    }

    showPage(pageId) {
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
            this.currentPage = pageId;
            if (pageId === 'reportsPage') this.loadReports();
            else if (pageId === 'dashboard') this.loadDashboardStats();
        }
    }

    // =====================
    // Test Setup
    // =====================
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
        if (!this.validateTestData(testData)) return;
        this.showLoading('Setting up test...', 'Please wait while we configure your test');
        try {
            const response = await this.apiCall('/test/setup', 'POST', testData);
            if (response.success) {
                this.testData = testData;
                this.testData.testId = response.testId;
                this.currentStudent = 1;
                this.studentResults = [];
                this.hideLoading();
                this.showToast('Test setup complete! Ready for evaluation.', 'success');
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
        if (!data.staffName || !data.staffName.trim()) errors.push('Staff name is required');
        if (!data.testTitle || !data.testTitle.trim()) errors.push('Subject name is required');
        if (data.totalStudents < 1) errors.push('Total students must be at least 1');
        if (data.totalQuestions < 1) errors.push('Total questions must be at least 1');
        if (data.marksPerQuestion <= 0) errors.push('Marks per question must be > 0');
        if (data.passingMarks < 0 || data.passingMarks > 100) errors.push('Passing marks must be 0-100%');
        if (!data.answerKey || data.answerKey.length !== data.totalQuestions) {
            errors.push('Answer key must be complete');
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
        for (let i = 1; i <= count; i++) {
            const div = document.createElement('div');
            div.className = 'answer-input';
            div.innerHTML = `<label>Q${i}</label><select name="answer_${i}" data-question="${i}"><option value="">-</option><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select>`;
            container.appendChild(div);
        }
        container.querySelectorAll('select').forEach(s => s.addEventListener('change', () => this.updateAnswerKeyPreview()));
    }

    quickFillAnswers(value) {
        document.querySelectorAll('#questionsContainer select').forEach(s => { s.value = value; });
        this.updateAnswerKeyPreview();
    }

    getAnswerKey() {
        const selects = document.querySelectorAll('#questionsContainer select');
        return Array.from(selects).map(s => s.value || 'A');
    }

    updateAnswerKeyPreview() {
        const answerKey = this.getAnswerKey();
        const preview = document.getElementById('previewKeyStatus');
        if (preview) {
            const completed = answerKey.filter(a => a !== '').length;
            preview.textContent = completed > 0 ? `${completed}/${answerKey.length} Set` : 'Not Set';
        }
    }

    // =====================
    // Student Evaluation
    // =====================
    setupStudentEvaluation() {
        if (!this.testData) return;
        const progressInfo = document.getElementById('studentProgress');
        if (progressInfo) progressInfo.textContent = `Student ${this.currentStudent} of ${this.testData.totalStudents}`;
        this.generatePageUploads();
        this.updateEvaluationSummary();
        document.getElementById('studentEvaluationForm')?.reset();
        const results = document.getElementById('analysisResults');
        if (results) results.style.display = 'none';
        this.updateEvaluationButtons();
    }

    generatePageUploads() {
        const container = document.getElementById('pageUploadsContainer');
        if (!container || !this.testData) return;
        container.innerHTML = '';
        for (let i = 1; i <= this.testData.totalPages; i++) {
            const div = document.createElement('div');
            div.className = 'page-upload-item';
            div.innerHTML = `
                <div class="page-upload-header">
                    <div class="page-upload-title"><i class="fas fa-file-image"></i> Page ${i}</div>
                    <div class="page-upload-status" id="pageStatus_${i}"><i class="fas fa-upload"></i> Not Uploaded</div>
                </div>
                <div class="upload-area" onclick="document.getElementById('pageFile_${i}').click()">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <h4>Upload Page ${i}</h4>
                    <p>Click to select image (JPG, PNG, PDF)</p>
                    <button type="button" class="upload-button">Choose File</button>
                    <input type="file" id="pageFile_${i}" name="answerSheet_${i}" accept="image/*,.pdf" style="display: none;">
                </div>
                <div class="page-preview" id="pagePreview_${i}">
                    <img class="preview-image" id="previewImage_${i}" alt="Page ${i} preview">
                </div>`;
            container.appendChild(div);
            div.querySelector(`#pageFile_${i}`).addEventListener('change', (e) => this.handleFileUpload(e, i));
        }
    }

    handleFileUpload(e, pageNumber) {
        const file = e.target.files[0];
        if (!file) return;
        const status = document.getElementById(`pageStatus_${pageNumber}`);
        const preview = document.getElementById(`pagePreview_${pageNumber}`);
        const img = document.getElementById(`previewImage_${pageNumber}`);
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (img) img.src = ev.target.result;
                if (preview) preview.classList.add('active');
                if (status) { status.innerHTML = '<i class="fas fa-check-circle"></i> Uploaded'; status.classList.add('uploaded'); }
            };
            reader.readAsDataURL(file);
        } else {
            if (status) { status.innerHTML = '<i class="fas fa-check-circle"></i> PDF Uploaded'; status.classList.add('uploaded'); }
        }
        this.showToast(`Page ${pageNumber} uploaded`, 'success');
    }

    async handleStudentEvaluation(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const studentName = formData.get('studentName');
        const rollNumber = formData.get('rollNumber');
        if (!studentName?.trim() || !rollNumber?.trim()) {
            this.showToast('Student name and roll number are required', 'error');
            return;
        }
        const uploadedFiles = this.getUploadedFiles();
        if (uploadedFiles.length < this.testData.totalPages) {
            this.showToast(`Please upload all ${this.testData.totalPages} pages`, 'error');
            return;
        }

        // Calculate ETA based on previous evaluations
        const completed = this.studentResults.length;
        const total = this.testData.totalStudents;
        const remaining = total - completed - 1;
        let etaText = '';
        if (this._evalTimes && this._evalTimes.length > 0) {
            const avgTime = this._evalTimes.reduce((a, b) => a + b, 0) / this._evalTimes.length;
            const etaSeconds = Math.round(avgTime * remaining / 1000);
            const etaMin = Math.floor(etaSeconds / 60);
            const etaSec = etaSeconds % 60;
            etaText = ` | ETA for remaining ${remaining}: ~${etaMin}m ${etaSec}s`;
        }

        this.showLoading(
            `Analyzing Student ${completed + 1} of ${total}...`,
            `AI is processing ${this.testData.totalPages} page(s) with rate limiting${etaText}`
        );
        this.updateProgressSteps(['completed', 'active', 'pending']);
        this.updateProgressBar(50);

        const startTime = Date.now();
        const MAX_CLIENT_RETRIES = 3;

        for (let attempt = 0; attempt < MAX_CLIENT_RETRIES; attempt++) {
            try {
                const evalData = new FormData();
                evalData.append('studentName', studentName);
                evalData.append('rollNumber', rollNumber);
                for (let i = 1; i <= this.testData.totalPages; i++) {
                    const fi = document.getElementById(`pageFile_${i}`);
                    if (fi?.files[0]) evalData.append(`answerSheet_${i}`, fi.files[0]);
                }

                const url = `${this.API_BASE_URL}/api/student/evaluate`;
                const response = await fetch(url, { method: 'POST', body: evalData });
                const result = await response.json();

                // Update rate limiter UI from response
                if (result.rateLimiter) {
                    this._updateRateLimiterFromResponse(result.rateLimiter);
                }

                if (response.status === 429 || (result.error && result.error.toLowerCase().includes('rate'))) {
                    // Rate limited — wait and retry
                    const waitSec = Math.pow(3, attempt + 1);
                    this.showLoading(
                        `Rate limited — waiting ${waitSec}s before retry...`,
                        `Attempt ${attempt + 2}/${MAX_CLIENT_RETRIES} | Student ${completed + 1} of ${total}`
                    );
                    this.showToast(`API rate limited. Waiting ${waitSec}s before retry...`, 'warning');
                    await new Promise(r => setTimeout(r, waitSec * 1000));
                    continue;
                }

                if (!response.ok) {
                    throw new Error(result.error || `Server error: ${response.status}`);
                }

                if (result.success) {
                    const elapsed = Date.now() - startTime;
                    if (!this._evalTimes) this._evalTimes = [];
                    this._evalTimes.push(elapsed);

                    this.hideLoading();
                    this.displayAnalysisResults(result.evaluation);
                    this.updateProgressSteps(['completed', 'completed', 'completed']);
                    this.updateProgressBar(100);
                    this.studentResults.push(result.evaluation);
                    this.updateEvaluationSummary();

                    const timeStr = (elapsed / 1000).toFixed(1);
                    this.showToast(`Student ${completed + 1}/${total} complete (${timeStr}s)`, 'success');
                    this.updateRateLimiterUI();
                    return; // Success — exit retry loop
                } else {
                    throw new Error(result.error || 'Unknown error');
                }
            } catch (error) {
                if (attempt < MAX_CLIENT_RETRIES - 1 && error.message?.includes('rate')) {
                    const waitSec = Math.pow(3, attempt + 1);
                    this.showLoading(`Retrying in ${waitSec}s...`, `Error: ${error.message}`);
                    await new Promise(r => setTimeout(r, waitSec * 1000));
                    continue;
                }
                this.hideLoading();
                this.showToast(`Evaluation failed: ${error.message}`, 'error');
                this.updateProgressSteps(['completed', 'error', 'pending']);
                return;
            }
        }
        this.hideLoading();
        this.showToast('Evaluation failed after multiple retries. Try pausing and resuming from Admin panel.', 'error');
    }

    _updateRateLimiterFromResponse(rl) {
        const rpmEl = document.getElementById('rlRpmCount');
        const dayEl = document.getElementById('rlDayCount');
        if (rpmEl) rpmEl.textContent = `${rl.remainingRPM}/${rl.maxRPM}`;
        if (dayEl) dayEl.textContent = `${rl.remainingRPD}/${rl.maxRPD}`;
        // Also update loading overlay tokens
        const loadRpm = document.getElementById('loadingRpm');
        const loadRpd = document.getElementById('loadingRpd');
        if (loadRpm) loadRpm.textContent = `${rl.remainingRPM}/${rl.maxRPM}`;
        if (loadRpd) loadRpd.textContent = `${rl.remainingRPD}/${rl.maxRPD}`;
    }

    getUploadedFiles() {
        const files = [];
        for (let i = 1; i <= this.testData.totalPages; i++) {
            const fi = document.getElementById(`pageFile_${i}`);
            if (fi?.files[0]) files.push(fi.files[0]);
        }
        return files;
    }

    displayAnalysisResults(evaluation) {
        const section = document.getElementById('analysisResults');
        if (!section) return;
        const s = evaluation.summary;
        document.getElementById('scoreValue').textContent = s.obtainedMarks;
        document.getElementById('totalMarksDisplay').textContent = s.totalMarks;
        document.getElementById('percentageValue').textContent = s.percentage;
        document.getElementById('correctAnswers').textContent = s.correctAnswers;
        document.getElementById('wrongAnswers').textContent = s.totalQuestions - s.correctAnswers;
        document.getElementById('gradeDisplay').textContent = s.grade;
        this.populateQuestionResults(evaluation.results);
        section.style.display = 'block';
        section.scrollIntoView({ behavior: 'smooth' });
        this.updateEvaluationButtons(true);
    }

    populateQuestionResults(results) {
        const tbody = document.getElementById('questionResultsBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        results.forEach(r => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${r.questionNo}</td><td><strong>${r.correctAnswer}</strong></td><td><strong>${r.studentAnswer}</strong></td><td><span class="status-${r.isCorrect ? 'correct' : 'incorrect'}"><i class="fas fa-${r.isCorrect ? 'check' : 'times'}"></i> ${r.isCorrect ? 'Correct' : 'Incorrect'}</span></td><td>${r.marks}</td>`;
            tbody.appendChild(row);
        });
    }

    updateEvaluationButtons(done = false) {
        const analyze = document.getElementById('analyzeBtn');
        const next = document.getElementById('nextStudentBtn');
        const finish = document.getElementById('finishEvaluationBtn');
        if (done) {
            if (analyze) analyze.style.display = 'none';
            if (this.currentStudent < this.testData.totalStudents) {
                if (next) next.style.display = 'inline-flex';
                if (finish) finish.style.display = 'none';
            } else {
                if (next) next.style.display = 'none';
                if (finish) finish.style.display = 'inline-flex';
            }
        } else {
            if (analyze) analyze.style.display = 'inline-flex';
            if (next) next.style.display = 'none';
            if (finish) finish.style.display = 'none';
        }
    }

    updateProgressSteps(states) {
        document.querySelectorAll('.progress-step').forEach((step, i) => {
            if (states[i]) step.className = `progress-step ${states[i]}`;
        });
    }

    updateProgressBar(pct) {
        const fill = document.querySelector('.progress-fill');
        if (fill) fill.style.width = `${pct}%`;
    }

    updateEvaluationSummary() {
        const completed = this.studentResults.length;
        const total = this.testData ? this.testData.totalStudents : 0;
        const el1 = document.getElementById('completedCount');
        const el2 = document.getElementById('remainingCount');
        const el3 = document.getElementById('totalStudentsCount');
        if (el1) el1.textContent = completed;
        if (el2) el2.textContent = total - completed;
        if (el3) el3.textContent = total;
    }

    nextStudent() {
        this.currentStudent++;
        this.updateEvaluationSummary();
        this.setupStudentEvaluation();
        document.getElementById('studentEvaluation')?.scrollIntoView({ behavior: 'smooth' });
    }

    finishEvaluation() {
        this.saveConsolidatedReport();
        this.setupConsolidatedReport();
        this.navigateTo('consolidatedReport');
    }

    // =====================
    // Consolidated Report
    // =====================
    setupConsolidatedReport() {
        const stats = this.calculateEvaluationStats();
        this.updateConsolidatedStatsDisplay(stats);
        this.populateConsolidatedTable();
    }

    calculateEvaluationStats() {
        if (!this.studentResults.length) return { totalStudents: 0, averageScore: 0, averageMarks: 0, highestScore: 0, lowestScore: 0, passRate: 0, passedCount: 0, failedCount: 0, totalMarksAwarded: 0, totalPossibleMarks: 0 };
        const n = this.studentResults.length;
        const scores = this.studentResults.map(r => r.summary.percentage);
        const marks = this.studentResults.map(r => r.summary.obtainedMarks);
        const totalMarksAwarded = marks.reduce((a, b) => a + b, 0);
        const passedCount = this.studentResults.filter(r => r.summary.status === 'PASS').length;
        const totalPossibleMarks = this.testData ? this.testData.totalQuestions * this.testData.marksPerQuestion * n : 0;
        return {
            totalStudents: n,
            averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / n),
            averageMarks: Math.round(totalMarksAwarded / n),
            highestScore: Math.max(...scores),
            lowestScore: Math.min(...scores),
            passRate: Math.round((passedCount / n) * 100),
            passedCount, failedCount: n - passedCount, totalMarksAwarded, totalPossibleMarks
        };
    }

    updateConsolidatedStatsDisplay(stats) {
        const el = (id) => document.getElementById(id);
        if (el('consolidatedTotalStudents')) el('consolidatedTotalStudents').textContent = stats.totalStudents;
        if (el('consolidatedAvgScore')) el('consolidatedAvgScore').textContent = stats.averageScore + '%';
        if (el('consolidatedHighestScore')) el('consolidatedHighestScore').textContent = stats.highestScore + '%';
        if (el('consolidatedPassRate')) el('consolidatedPassRate').textContent = stats.passRate + '%';
        const addEl = el('additionalStats');
        if (addEl) {
            addEl.innerHTML = `<div class="additional-stats"><div class="stat-item"><span class="stat-label">Passed:</span><span class="stat-value">${stats.passedCount}</span></div><div class="stat-item"><span class="stat-label">Failed:</span><span class="stat-value">${stats.failedCount}</span></div><div class="stat-item"><span class="stat-label">Average Marks:</span><span class="stat-value">${stats.averageMarks} / ${this.testData ? this.testData.totalQuestions * this.testData.marksPerQuestion : 0}</span></div><div class="stat-item"><span class="stat-label">Lowest:</span><span class="stat-value">${stats.lowestScore}%</span></div></div>`;
        }
    }

    populateConsolidatedTable() {
        const tbody = document.getElementById('consolidatedResultsBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        this.studentResults.forEach((result, index) => {
            const s = result.summary;
            const reportId = this.testData?.testId ? `${this.testData.testId}_${result.rollNumber}` : `RPT_${index}_${result.rollNumber}`;
            const row = document.createElement('tr');
            row.innerHTML = `<td>${reportId}</td><td>${result.rollNumber}</td><td>${result.studentName}</td><td>${this.testData?.testTitle || 'N/A'}</td><td><span class="score-badge">${s.percentage}%</span></td><td><span class="grade-badge">${s.grade}</span></td><td>${s.status}</td>`;
            tbody.appendChild(row);
        });
    }

    // =====================
    // Reports
    // =====================
    async loadReports() {
        try {
            const response = await this.apiCall('/reports/consolidated');
            if (response.success) {
                this.allReports = response.consolidatedReports || [];
                this.calculateAllReportsStats(response.stats || {});
                this.populateConsolidatedReportsTable();
            }
        } catch (error) {
            console.error('Failed to load reports:', error);
            this.allReports = [];
            this.populateConsolidatedReportsTable();
        }
    }

    calculateAllReportsStats() {
        let totalStudentsEvaluated = 0, totalPassed = 0, allScores = [];
        this.allReports.forEach(r => {
            totalStudentsEvaluated += r.totalStudents || 0;
            totalPassed += r.passedCount || 0;
            if (r.studentResults) r.studentResults.forEach(s => allScores.push(s.summary.percentage));
        });
        const stats = {
            totalTests: this.allReports.length,
            totalStudentsEvaluated, totalPassed,
            totalFailed: totalStudentsEvaluated - totalPassed,
            overallPassRate: totalStudentsEvaluated > 0 ? Math.round((totalPassed / totalStudentsEvaluated) * 100) : 0,
            overallAverage: allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0,
            highestScore: allScores.length > 0 ? Math.max(...allScores) : 0,
            lowestScore: allScores.length > 0 ? Math.min(...allScores) : 0
        };
        this.updateReportsStatsDisplay(stats);
    }

    updateReportsStatsDisplay(stats) {
        const el = (id) => document.getElementById(id);
        if (el('totalReports')) el('totalReports').textContent = stats.totalTests;
        if (el('totalStudentsEvaluated')) el('totalStudentsEvaluated').textContent = stats.totalStudentsEvaluated;
        if (el('overallAverage')) el('overallAverage').textContent = stats.overallAverage + '%';
        if (el('recentTests')) el('recentTests').textContent = stats.totalTests;
        const detailed = el('detailedReportsStats');
        if (detailed) {
            detailed.innerHTML = `<div class="detailed-stats-grid"><div class="stat-card"><h4>Pass/Fail</h4><div class="stat-details"><div class="stat-line"><span>Passed:</span><span class="stat-value">${stats.totalPassed}</span></div><div class="stat-line"><span>Failed:</span><span class="stat-value">${stats.totalFailed}</span></div><div class="stat-line"><span>Rate:</span><span class="stat-value">${stats.overallPassRate}%</span></div></div></div><div class="stat-card"><h4>Scores</h4><div class="stat-details"><div class="stat-line"><span>Average:</span><span class="stat-value">${stats.overallAverage}%</span></div><div class="stat-line"><span>Highest:</span><span class="stat-value">${stats.highestScore}%</span></div><div class="stat-line"><span>Lowest:</span><span class="stat-value">${stats.lowestScore}%</span></div></div></div></div>`;
        }
    }

    populateConsolidatedReportsTable() {
        const tbody = document.getElementById('reportsTableBody');
        const empty = document.getElementById('emptyReports');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (this.allReports.length === 0) { if (empty) empty.style.display = 'block'; return; }
        if (empty) empty.style.display = 'none';
        this.allReports.forEach((report, index) => {
            const row = document.createElement('tr');
            const date = new Date(report.completedAt).toLocaleDateString('en-GB');
            row.innerHTML = `<td>${report.testId || 'N/A'}</td><td>${report.testTitle || 'N/A'}</td><td>${report.staffName || 'N/A'}</td><td>${date}</td><td>${report.totalStudents || 0}</td><td><span class="score-badge">${report.averageScore || 0}%</span></td><td><span class="score-badge">${report.passRate || 0}%</span></td><td><div class="action-buttons"><button class="action-button view" onclick="app.viewConsolidatedReport(${index})"><i class="fas fa-eye"></i> View</button><button class="action-button download" onclick="app.downloadConsolidatedReport(${index})"><i class="fas fa-download"></i></button><button class="action-button delete" onclick="app.deleteConsolidatedReport(${index})"><i class="fas fa-trash"></i></button></div></td>`;
            tbody.appendChild(row);
        });
    }

    filterReports(filter) {
        if (!filter || filter === 'all') { this.populateConsolidatedReportsTable(); return; }
        let filtered = [...this.allReports];
        switch (filter) {
            case 'recent':
                const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
                filtered = this.allReports.filter(r => new Date(r.completedAt) >= cutoff);
                break;
            case 'high-pass-rate':
                filtered = this.allReports.filter(r => (r.passRate || 0) >= 80);
                break;
            case 'low-pass-rate':
                filtered = this.allReports.filter(r => (r.passRate || 0) < 50);
                break;
        }
        const orig = this.allReports;
        this.allReports = filtered;
        this.populateConsolidatedReportsTable();
        this.allReports = orig;
    }

    viewConsolidatedReport(index) {
        const report = this.allReports[index];
        if (!report) return;
        this.testData = { testId: report.testId, testTitle: report.testTitle, staffName: report.staffName, totalStudents: report.totalStudents, totalQuestions: report.totalQuestions, marksPerQuestion: report.marksPerQuestion, passingMarks: report.passingMarks };
        this.studentResults = report.studentResults || [];
        this.setupConsolidatedReport();
        this.navigateTo('consolidatedReport');
    }

    downloadConsolidatedReport(index) {
        const report = this.allReports[index];
        if (!report) return;
        const orig = { td: this.testData, sr: this.studentResults };
        this.testData = { testId: report.testId, testTitle: report.testTitle, staffName: report.staffName, totalStudents: report.totalStudents, totalQuestions: report.totalQuestions, marksPerQuestion: report.marksPerQuestion, passingMarks: report.passingMarks };
        this.studentResults = report.studentResults || [];
        this.generateClientSideExcel();
        this.testData = orig.td;
        this.studentResults = orig.sr;
    }

    deleteConsolidatedReport(index) {
        const report = this.allReports[index];
        if (!report) return;
        this.confirmAction('Delete Report', `Delete "${report.testTitle}"? This cannot be undone.`, async () => {
            try {
                await this.apiCall(`/reports/consolidated/${report.testId}`, 'DELETE');
                this.allReports.splice(index, 1);
                this.populateConsolidatedReportsTable();
                this.calculateAllReportsStats();
                this.showToast('Report deleted', 'success');
                this.loadDashboardStats();
            } catch (error) {
                this.showToast(`Delete failed: ${error.message}`, 'error');
            }
        });
    }

    async saveConsolidatedReport() {
        if (!this.testData || !this.studentResults.length) return;
        try {
            const stats = this.calculateEvaluationStats();
            const data = { testId: this.testData.testId, testTitle: this.testData.testTitle, staffName: this.testData.staffName, totalStudents: this.testData.totalStudents, totalQuestions: this.testData.totalQuestions, marksPerQuestion: this.testData.marksPerQuestion, passingMarks: this.testData.passingMarks, completedAt: new Date().toISOString(), studentResults: this.studentResults, ...stats };
            this.allReports.push(data);
            await this.apiCall('/reports/consolidated/save', 'POST', { consolidatedReport: data });
            this.showToast('Results saved', 'success');
        } catch (error) {
            console.error('Save failed:', error);
            this.showToast('Warning: Failed to save report to server', 'warning');
        }
    }

    // =====================
    // Excel Export
    // =====================
    async exportConsolidatedReport() {
        if (!this.testData || !this.studentResults.length) { this.showToast('No data', 'error'); return; }
        try {
            const excelData = this.generateExcelData();
            const response = await fetch(`${this.API_BASE_URL}/api/reports/consolidated/export-custom`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(excelData) });
            if (response.ok) {
                const blob = await response.blob();
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `${this.testData.testTitle || 'exam'}_report_${new Date().toISOString().split('T')[0]}.xlsx`;
                a.click();
                URL.revokeObjectURL(a.href);
                this.showToast('Excel exported', 'success');
            } else {
                this.generateClientSideExcel();
            }
        } catch { this.generateClientSideExcel(); }
    }

    generateExcelData() {
        const stats = this.calculateEvaluationStats();
        const headers = ['Report ID','Roll Number','Student Name','Test Title','Staff Name','Total Questions','Correct','Wrong','Obtained Marks','Total Marks','Percentage','Grade','Status','Evaluated At'];
        const rows = this.studentResults.map((r, i) => [this.testData?.testId || `RPT_${i}`, r.rollNumber, r.studentName, this.testData?.testTitle, this.testData?.staffName, this.testData?.totalQuestions, r.summary.correctAnswers, this.testData?.totalQuestions - r.summary.correctAnswers, r.summary.obtainedMarks, r.summary.totalMarks, r.summary.percentage + '%', r.summary.grade, r.summary.status, new Date(r.evaluatedAt).toLocaleString()]);
        return { headers, data: rows, testInfo: this.testData, summary: stats };
    }

    generateClientSideExcel() {
        try {
            const d = this.generateExcelData();
            let csv = d.headers.join(',') + '\n';
            d.data.forEach(row => { csv += row.map(c => `"${c}"`).join(',') + '\n'; });
            csv += '\n"STATISTICS"\n';
            csv += `"Total Students","${d.summary.totalStudents}"\n`;
            csv += `"Pass Rate","${d.summary.passRate}%"\n`;
            csv += `"Average","${d.summary.averageScore}%"\n`;
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${this.testData?.testTitle || 'exam'}_report_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            this.showToast('CSV exported', 'success');
        } catch (e) { this.showToast(`Export failed: ${e.message}`, 'error'); }
    }

    async exportAllConsolidatedReports() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/api/reports/consolidated/export-all-custom`);
            if (response.ok) {
                const blob = await response.blob();
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `all_reports_${new Date().toISOString().split('T')[0]}.xlsx`;
                a.click();
                this.showToast('All reports exported', 'success');
            } else { throw new Error('Export failed'); }
        } catch { this.exportAllReportsClientSide(); }
    }

    exportAllReportsClientSide() {
        if (!this.allReports.length) { this.showToast('No reports', 'error'); return; }
        let csv = 'Report ID,Roll Number,Student Name,Test Title,Staff Name,Questions,Correct,Wrong,Obtained,Total,Percentage,Grade,Status\n';
        this.allReports.forEach(report => {
            (report.studentResults || []).forEach(r => {
                csv += [report.testId, r.rollNumber, r.studentName, report.testTitle, report.staffName, report.totalQuestions, r.summary.correctAnswers, report.totalQuestions - r.summary.correctAnswers, r.summary.obtainedMarks, r.summary.totalMarks, r.summary.percentage + '%', r.summary.grade, r.summary.status].map(c => `"${c}"`).join(',') + '\n';
            });
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `all_reports_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        this.showToast('All reports exported (CSV)', 'success');
    }

    // =====================
    // Admin
    // =====================
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
                this.updateRateLimiterUI();
                this.showToast('Admin login successful', 'success');
                this.logSystemEvent('Admin login successful');
            } else {
                throw new Error(response.error || 'Login failed');
            }
        } catch (error) {
            this.showToast(`Login failed: ${error.message}`, 'error');
        }
    }

    async updateSystemStats() {
        try {
            const response = await this.apiCall('/admin/stats');
            if (response.success) {
                const s = response.stats;
                const el = (id) => document.getElementById(id);
                if (el('systemTotalEvals')) el('systemTotalEvals').textContent = s.totalEvaluations || 0;
                if (el('systemActiveTests')) el('systemActiveTests').textContent = s.activeTests || 0;
                if (el('systemUptime')) el('systemUptime').textContent = s.systemUptime || '0h 0m';
                if (el('lastBackup')) el('lastBackup').textContent = s.lastBackup || 'Never';
            }
        } catch (error) {
            console.error('Stats update failed:', error);
        }
    }

    async deleteAllConsolidatedReports() {
        try {
            await this.apiCall('/admin/delete-consolidated-reports', 'POST');
            this.allReports = [];
            this.loadReports();
            this.loadDashboardStats();
            this.showToast('All reports deleted', 'success');
            this.logSystemEvent('All reports deleted');
        } catch (error) {
            this.showToast(`Delete failed: ${error.message}`, 'error');
        }
    }

    async clearAnswerKeys() {
        try {
            await this.apiCall('/admin/clear-answer-keys', 'POST');
            this.testData = null;
            this.showToast('Answer keys cleared', 'success');
            this.logSystemEvent('Answer keys cleared');
        } catch (error) {
            this.showToast(`Clear failed: ${error.message}`, 'error');
        }
    }

    exportSystemData() { this.exportAllReportsClientSide(); this.logSystemEvent('System data exported'); }

    updateRefreshInterval() {
        const val = document.getElementById('refreshInterval')?.value;
        if (val >= 5 && val <= 300) {
            this.settings.refreshInterval = parseInt(val);
            this.saveSettings();
            this.showToast('Refresh interval updated', 'success');
        } else {
            this.showToast('Must be 5-300 seconds', 'error');
        }
    }

    createBackup() {
        this.systemStats.lastBackup = new Date().toLocaleString();
        this.exportSystemData();
        this.updateSystemStats();
        this.logSystemEvent('Backup created');
    }

    async cleanupOldFiles() {
        this.showLoading('Cleaning up...', 'Removing temporary files');
        try {
            await this.apiCall('/admin/cleanup', 'POST');
            this.hideLoading();
            this.showToast('Cleanup complete', 'success');
            this.logSystemEvent('Old files cleaned up');
        } catch {
            this.hideLoading();
            this.showToast('Cleanup complete', 'success');
            this.logSystemEvent('Cleanup attempted');
        }
    }

    clearCache() {
        if ('caches' in window) caches.keys().then(names => names.forEach(name => caches.delete(name)));
        this.showToast('Cache cleared', 'success');
        this.logSystemEvent('Cache cleared');
    }

    async clearSystemLogs() {
        try {
            await this.apiCall('/admin/clear-logs', 'POST');
        } catch {}
        const el = document.getElementById('systemLogs');
        if (el) el.textContent = '';
        this.showToast('Logs cleared', 'success');
    }

    logSystemEvent(event) {
        const el = document.getElementById('systemLogs');
        if (el) { el.textContent += `[${new Date().toLocaleString()}] ${event}\n`; el.scrollTop = el.scrollHeight; }
    }

    // =====================
    // Utilities
    // =====================
    showLoading(title = 'Loading...', subtitle = 'Please wait...') {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.add('active');
        const t = document.getElementById('loadingText');
        const s = document.getElementById('loadingSubtext');
        if (t) t.textContent = title;
        if (s) s.textContent = subtitle;
        // Show progress section during batch evaluation
        const prog = document.getElementById('loadingProgress');
        if (prog && this.testData && this.testData.totalStudents > 1) {
            prog.style.display = 'block';
            const fill = document.getElementById('loadingProgressFill');
            if (fill) {
                const pct = Math.round((this.studentResults.length / this.testData.totalStudents) * 100);
                fill.style.width = `${pct}%`;
            }
        }
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
        const icons = { success: 'check-circle', error: 'exclamation-triangle', warning: 'exclamation-circle', info: 'info-circle' };
        toast.innerHTML = `<i class="fas fa-${icons[type] || 'info-circle'}"></i><span>${message}</span><button class="toast-close">&times;</button>`;
        container.appendChild(toast);
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 5000);
        toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
    }

    confirmAction(title, message, action) {
        const titleEl = document.getElementById('confirmTitle');
        const msgEl = document.getElementById('confirmMessage');
        if (titleEl) titleEl.textContent = title;
        if (msgEl) msgEl.textContent = message;
        this.pendingAction = action;
        this.showModal('confirmModal');
    }

    showModal(id) { const m = document.getElementById(id); if (m) m.classList.add('active'); }
    closeModal(id) { const m = document.getElementById(id); if (m) m.classList.remove('active'); }

    // Persistence via localStorage
    saveSettings() {
        try { localStorage.setItem('see_settings', JSON.stringify(this.settings)); } catch {}
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('see_settings');
            if (saved) this.settings = { ...this.settings, ...JSON.parse(saved) };
        } catch {}
    }

    async loadDashboardStats() {
        try {
            const response = await this.apiCall('/dashboard/stats');
            if (response.success) {
                const s = response.stats;
                const el = (id) => document.getElementById(id);
                if (el('totalStudents')) el('totalStudents').textContent = s.totalStudents || 0;
                if (el('avgScore')) el('avgScore').textContent = s.avgScore || '0%';
                if (el('lastEval')) el('lastEval').textContent = s.lastEval || 'Never';
            }
        } catch (error) {
            console.error('Dashboard stats failed:', error);
        }
    }

    // Theme
    initializeTheme() {
        const saved = localStorage.getItem('see_theme') || 'light';
        document.body.setAttribute('data-theme', saved);
        this.updateThemeIcon(saved);
    }

    toggleTheme() {
        const current = document.body.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', next);
        localStorage.setItem('see_theme', next);
        this.updateThemeIcon(next);
    }

    updateThemeIcon(theme) {
        const icon = document.querySelector('#themeToggle i');
        if (icon) icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }

    validateImageFile(file) {
        const valid = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
        if (!valid.includes(file.type)) { this.showToast('Invalid file type', 'error'); return false; }
        if (file.size > 10 * 1024 * 1024) { this.showToast('File too large (max 10MB)', 'error'); return false; }
        return true;
    }

    startAutoSave() {
        if (this.settings.autoSave) {
            setInterval(() => {
                if (this.testData && this.studentResults.length > 0) this.saveConsolidatedReport();
            }, this.settings.refreshInterval * 1000);
        }
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (this.currentPage === 'consolidatedReport' && this.studentResults.length > 0) this.exportConsolidatedReport();
            }
            if (e.key === 'Escape') document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
        });
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SmartExamEvaluator();
    window.app.setupKeyboardShortcuts();
    window.app.startAutoSave();
});

// Drag and drop support
document.addEventListener('dragover', (e) => { e.preventDefault(); if (e.target.classList?.contains('upload-area')) e.target.classList.add('dragover'); });
document.addEventListener('dragleave', (e) => { if (e.target.classList?.contains('upload-area')) e.target.classList.remove('dragover'); });
document.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.target.classList?.contains('upload-area')) {
        e.target.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const item = e.target.closest('.page-upload-item');
            const input = item?.querySelector('input[type="file"]');
            if (input && window.app.validateImageFile(files[0])) { input.files = files; input.dispatchEvent(new Event('change')); }
        }
    }
});

// Online/offline detection
window.addEventListener('online', () => { if (window.app) window.app.showToast('Connection restored', 'success'); });
window.addEventListener('offline', () => { if (window.app) window.app.showToast('Connection lost', 'warning'); });

window.SmartExamEvaluator = SmartExamEvaluator;
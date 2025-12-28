const $ = document.querySelector.bind(document);

const app = {
    username: localStorage.getItem('qrgame_username'),
    scanner: null,
    resumeTimer: null,
    resumeTimeoutMs: 10000,
    resumeStartTime: 0,

    init: function() {
        this.updateNavUser();
        
        $('#save-username-btn').addEventListener('click', () => {
            const input = $('#username-input').value.trim();
            if (input) {
                this.username = input;
                localStorage.setItem('qrgame_username', input);
                this.updateNavUser();
                this.showView('scan');
            }
        });

        this.showView('scan'); // Default view
    },

    updateNavUser: function() {
        const info = $('#nav-user-info');
        const nameDisplay = $('#nav-username');
        if (this.username) {
            nameDisplay.innerText = `[OP: ${this.username}]`;
            info.style.display = 'flex';
        } else {
            info.style.display = 'none';
        }
    },

    logout: function() {
        localStorage.removeItem('qrgame_username');
        location.reload();
    },

    initScanner: function() {
        const videoElem = $('video');
        if (!videoElem) return;
        
        // Only init if not already existing
        if (this.scanner) return;

        this.scanner = new QrScanner(
            videoElem,
            result => this.handleScan(result),
            { 
                highlightScanRegion: true,
                highlightCode: true,
                returnDetailedScanResult: true,
            },
        );
        this.scanner.start();
    },
    
    // ... handleScan remains the same ...

    handleScan: async function(result) {
        if (!this.username) {
             // Should not happen with new view logic, but good safety
             this.scanner.stop();
             alert("IDENTITY REQUIRED. PLEASE ENTER USERNAME.");
             this.showView('scan');
             return;
        }

        this.scanner.stop();
        $('#scan-resume-container').style.display = 'none';
        
        const code = result.data;
        $('#scan-result').innerHTML = `TARGET ACQUIRED: <span style="color:white">${code}</span><br>TRANSMITTING...`;
        $('#scan-result').className = '';

        try {
            const response = await fetch('/api/scanned', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: this.username, code: code })
            });

            const data = await response.json();

            if (response.ok) {
                $('#scan-result').innerHTML = `
                    SUCCESS.<br>
                    TARGET SCANNED: <span style="color:white">${code}</span><br>
                    TOTAL SCANS: ${data.count}<br>
                    YOUR RANK: #${data.rank}
                `;
                $('#scan-result').className = '';
            } else if (response.status === 409) {
                $('#scan-result').innerHTML = `
                    CONFLICT.<br>
                    TARGET: <span style="color:white">${code}</span><br>
                    ${data.message}
                `;
                $('#scan-result').className = 'error';
            } else {
                 $('#scan-result').innerText = `ERROR: ${data.message || response.statusText}`;
                 $('#scan-result').className = 'error';
            }

        } catch (e) {
            $('#scan-result').innerText = `TRANSMISSION ERROR: ${e.message}`;
            $('#scan-result').className = 'error';
        }

        this.startResumeTimer();
    },
    
    // ... startResumeTimer / manualResume remain same ...

    startResumeTimer: function() {
        $('#scan-resume-container').style.display = 'block';
        this.resumeStartTime = Date.now();
        
        const updateProgress = () => {
             const elapsed = Date.now() - this.resumeStartTime;
             const pct = Math.min(100, (elapsed / this.resumeTimeoutMs) * 100);
             $('#resume-progress').style.width = `${pct}%`;

             if (elapsed < this.resumeTimeoutMs) {
                 this.resumeTimer = requestAnimationFrame(updateProgress);
             } else {
                 this.manualResume();
             }
        };

        this.resumeTimer = requestAnimationFrame(updateProgress);
    },

    manualResume: function() {
        if (this.resumeTimer) cancelAnimationFrame(this.resumeTimer);
        $('#scan-resume-container').style.display = 'none';
        $('#scan-result').innerText = "WAITING FOR TARGET...";
        $('#scan-result').className = '';
        if ($('#scan-view').classList.contains('active') && this.scanner) {
             this.scanner.start();
        }
    },

    showView: function(viewName) {
        // Hide logic
        $('#username-section').style.display = 'none';
        $('#main-app').style.display = 'none';
        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));

        // Logic for Scan View
        if (viewName === 'scan') {
            if (!this.username) {
                $('#username-section').style.display = 'block';
                if (this.scanner) this.scanner.stop(); // Ensure scanner stops if we go back to username
                return;
            }
            
            $('#main-app').style.display = 'block';
            $('#scan-view').classList.add('active');
            this.initScanner(); // Ensure scanner checks init
            if (this.scanner) this.scanner.start();

        } else {
            // Leaderboards
            $('#main-app').style.display = 'block';
            $(`#${viewName}-view`).classList.add('active');
            
            if (this.scanner) this.scanner.stop();
            // Cancel timer if leaving scan view
            if (this.resumeTimer) cancelAnimationFrame(this.resumeTimer);
            $('#scan-resume-container').style.display = 'none';

            if (viewName === 'players') this.loadPlayersLeaderboard();
            if (viewName === 'codes') this.loadCodesLeaderboard();
        }
    },

    loadPlayersLeaderboard: async function() {
        const tbody = $('#players-table tbody');
        tbody.innerHTML = '<tr><td colspan="2">LOADING_DATA...</td></tr>';
        
        try {
            const res = await fetch('/api/players-leaderboard');
            const data = await res.json();
            tbody.innerHTML = data.map(row => `<tr><td>${row.username}</td><td>${row.count}</td></tr>`).join('');
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="2" class="error">DATA ERROR: ${e.message}</td></tr>`;
        }
    },

    loadCodesLeaderboard: async function() {
        const tbody = $('#codes-table tbody');
        tbody.innerHTML = '<tr><td colspan="2">LOADING_DATA...</td></tr>';
        
        try {
            const res = await fetch('/api/codes-leaderboard');
            const data = await res.json();
            tbody.innerHTML = data.map(row => `<tr><td>${row.code}</td><td>${row.count}</td></tr>`).join('');
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="2" class="error">DATA ERROR: ${e.message}</td></tr>`;
        }
    }
};

app.init();
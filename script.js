// --- VARIABEL GLOBAL ---
let mediaRecorder;
let audioChunks = [];
let startTime;
let timerInterval;
let audioContext, analyser, dataArray, source, animationId;
let recognition;
let fullTranscript = ""; // Menyimpan seluruh teks sesi ini

// DB Setup
const DB_NAME = "RifqyNotesLiveDB";
const DB_VERSION = 1;
let db;

function initDB() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
        db = e.target.result;
        if (!db.objectStoreNames.contains("recordings")) {
            db.createObjectStore("recordings", { keyPath: "id" });
        }
    };
    request.onsuccess = (e) => {
        db = e.target.result;
        loadRecordings();
    };
}

// --- SETUP SPEECH RECOGNITION ---
function setupSpeechRecognition() {
    // Kompatibilitas Browser
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        document.getElementById('placeholderText').innerHTML = 
            "<span class='text-red-400'>Browser ini tidak mendukung Transkripsi Live.<br>Mohon gunakan Google Chrome (Desktop/Android) atau Edge.</span>";
        return null;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;      // Jangan stop saat diam sebentar
    rec.interimResults = true;  // Tampilkan teks saat sedang bicara
    rec.lang = 'id-ID';         // Bahasa Indonesia

    rec.onresult = (event) => {
        let interimTranscript = '';
        let finalSegment = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalSegment += event.results[i][0].transcript + ". ";
                fullTranscript += event.results[i][0].transcript + ". ";
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        // DOM Updates
        document.getElementById('placeholderText').style.display = 'none';
        
        // Update Final Text (Teks yang sudah fix)
        // Kita hanya append segmen baru ke tampilan agar efisien
        if(finalSegment) {
            document.getElementById('finalSpan').innerHTML = fullTranscript; 
        }

        // Update Interim Text (Teks biru yang sedang dipikirkan)
        document.getElementById('interimSpan').innerText = interimTranscript;

        // Auto Scroll: Pastikan selalu melihat teks paling bawah
        const container = document.getElementById('transcriptContainer');
        container.scrollTop = container.scrollHeight;
    };

    rec.onerror = (event) => {
        console.error("Speech Error:", event.error);
        if(event.error === 'not-allowed') {
            alert("Izin Mikrofon ditolak. Mohon izinkan di pengaturan browser.");
            stopRecording();
        }
    };

    rec.onend = () => {
        // Jika recording masih aktif tapi speech engine mati (misal hening lama), nyalakan lagi
        if(isRecording) {
            try { rec.start(); } catch(e) {}
        }
    };

    return rec;
}

// --- CORE LOGIC ---
const recordBtn = document.getElementById('recordBtn');
let isRecording = false;

// Init Engine
recognition = setupSpeechRecognition();

recordBtn.addEventListener('click', async () => {
    if (!isRecording) {
        await startRecording();
    } else {
        stopRecording();
    }
});

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // 1. Visualizer
        setupVisualizer(stream);

        // 2. Audio Recorder
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
        
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            saveRecording(audioBlob, fullTranscript);
            
            // Cleanup Media
            stream.getTracks().forEach(track => track.stop());
            cancelAnimationFrame(animationId);
            const canvas = document.getElementById('visualizerCanvas');
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        };

        // 3. Start Processes
        mediaRecorder.start();
        if (recognition) {
            fullTranscript = ""; // Reset teks
            document.getElementById('finalSpan').innerText = "";
            document.getElementById('interimSpan').innerText = "";
            document.getElementById('placeholderText').style.display = 'block';
            document.getElementById('placeholderText').innerText = "Mendengarkan...";
            try { recognition.start(); } catch(e) {}
        }

        isRecording = true;
        updateUI(true);
        startTimer();

    } catch (err) {
        alert("Gagal akses mikrofon: " + err);
    }
}

function stopRecording() {
    if(!isRecording) return;
    
    mediaRecorder.stop();
    if (recognition) recognition.stop();
    
    isRecording = false;
    updateUI(false);
    clearInterval(timerInterval);
}

// --- VISUALIZER ---
function setupVisualizer(stream) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 256;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    drawVisualizer();
}

function drawVisualizer() {
    const canvas = document.getElementById('visualizerCanvas');
    const ctx = canvas.getContext('2d');
    
    // Auto Resize agar tidak gepeng
    canvas.width = canvas.offsetWidth; 
    canvas.height = canvas.offsetHeight;

    animationId = requestAnimationFrame(drawVisualizer);
    analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const barWidth = (canvas.width / dataArray.length) * 2.5;
    let x = 0;

    for(let i = 0; i < dataArray.length; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        gradient.addColorStop(0, '#3b82f6');
        gradient.addColorStop(1, '#a855f7'); // Gradient ungu-biru

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 2;
    }
}

// --- DATABASE OPERATIONS ---
function saveRecording(blob, text) {
    if(!text) text = "(Tidak ada suara terdeteksi)";
    
    const transaction = db.transaction(["recordings"], "readwrite");
    const store = transaction.objectStore("recordings");
    
    const record = {
        id: Date.now(),
        audio: blob,
        transcript: text,
        date: new Date().toLocaleString()
    };

    store.add(record);
    transaction.oncomplete = () => loadRecordings();
}

function loadRecordings() {
    const list = document.getElementById('historyList');
    list.innerHTML = '';
    const transaction = db.transaction(["recordings"], "readonly");
    const store = transaction.objectStore("recordings");
    const request = store.getAll();

    request.onsuccess = () => {
        const records = request.result.reverse();
        if (records.length === 0) {
            list.innerHTML = '<p class="text-xs text-center text-gray-500 mt-4">Belum ada riwayat.</p>';
            return;
        }

        records.forEach(item => {
            const div = document.createElement('div');
            div.className = "p-3 bg-[#1f2229] hover:bg-[#2a2d36] rounded-xl cursor-pointer transition mb-2 border border-gray-800 hover:border-accent group";
            div.innerHTML = `
                <div class="flex justify-between items-start mb-1">
                    <span class="text-xs text-accent font-bold">${item.date}</span>
                    <button onclick="deleteRecording(${item.id}, event)" class="text-gray-600 hover:text-red-400 p-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
                <p class="text-sm text-gray-300 line-clamp-2">${item.transcript}</p>
            `;
            
            div.onclick = (e) => {
                if(e.target.closest('button')) return;
                
                // Play Audio
                const url = URL.createObjectURL(item.audio);
                const player = document.getElementById('audioPlayer');
                player.src = url;
                document.getElementById('audioPlayerContainer').classList.remove('hidden');
                player.play();
                
                // Tampilkan Teks di Layar Utama (View Mode)
                document.getElementById('finalSpan').innerText = item.transcript;
                document.getElementById('interimSpan').innerText = "";
                document.getElementById('placeholderText').style.display = 'none';

                // Di HP, tutup sidebar otomatis
                if(window.innerWidth < 768) toggleSidebar();
            };
            list.appendChild(div);
        });
    };
}

function deleteRecording(id, e) {
    e.stopPropagation();
    if(confirm("Hapus catatan ini?")) {
        const tx = db.transaction(["recordings"], "readwrite");
        tx.objectStore("recordings").delete(id);
        tx.oncomplete = () => loadRecordings();
    }
}

function clearAllData() {
    if(confirm("Hapus SEMUA riwayat?")) {
        const tx = db.transaction(["recordings"], "readwrite");
        tx.objectStore("recordings").clear();
        tx.oncomplete = () => loadRecordings();
    }
}

// --- UI HELPERS ---
function startTimer() {
    startTime = Date.now();
    timerInterval = setInterval(() => {
        const diff = Date.now() - startTime;
        const date = new Date(diff);
        document.getElementById('timer').innerText = date.toISOString().substr(14, 5);
    }, 1000);
}

function updateUI(recording) {
    const btn = document.getElementById('recordBtn');
    const icon = document.getElementById('micIcon');
    const status = document.getElementById('statusTitle');

    if (recording) {
        btn.classList.replace('bg-accent', 'bg-red-500');
        btn.classList.replace('shadow-blue-500/40', 'shadow-red-500/40');
        btn.classList.add('animate-pulse');
        icon.innerHTML = '<rect x="6" y="6" width="12" height="12" fill="white" />';
        status.innerText = "Mendengarkan...";
        status.classList.add('text-red-400');
        document.getElementById('audioPlayerContainer').classList.add('hidden'); // Sembunyikan player saat rekam
    } else {
        btn.classList.replace('bg-red-500', 'bg-accent');
        btn.classList.replace('shadow-red-500/40', 'shadow-blue-500/40');
        btn.classList.remove('animate-pulse');
        icon.innerHTML = '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>';
        status.innerText = "Siap Merekam";
        status.classList.remove('text-red-400');
    }
}

function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    sb.classList.toggle('-translate-x-full');
}

// Init
initDB();
lucide.createIcons();

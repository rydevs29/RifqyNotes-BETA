// modes.js - Menangani Tab Online & Upload

function switchMode(mode) {
    // Ubah tampilan tombol tab
    ['inperson', 'online', 'upload'].forEach(m => {
        const btn = document.getElementById('tab-' + m);
        const content = document.getElementById('content-' + m);
        
        if (m === mode) {
            btn.classList.remove('text-slate-400', 'bg-transparent');
            btn.classList.add('bg-blue-600', 'text-white', 'shadow');
            content.classList.remove('hidden');
        } else {
            btn.classList.add('text-slate-400', 'bg-transparent');
            btn.classList.remove('bg-blue-600', 'text-white', 'shadow');
            content.classList.add('hidden');
        }
    });

    // Update teks tombol rekam utama agar sesuai konteks
    const btnText = document.getElementById('btnText');
    if(mode === 'online') {
        // Di mode online tombol dihandle terpisah, tapi kita kasih info
        // (Tombol utama disembunyikan atau diubah fungsinya bisa disini)
    } else if (mode === 'upload') {
        // Mode upload punya tombol sendiri
    } else {
        if(!isRecording) btnText.innerText = "Mulai Mencatat";
    }
}

// Logika Mode Online
function openLinkAndRecord() {
    const link = document.getElementById('meetingLink').value;
    if(!link) return alert("Tempel link meeting dulu!");
    
    // Buka link di tab baru
    window.open(link, '_blank');

    // Mulai rekam otomatis setelah jeda 1 detik
    setTimeout(() => {
       alert("Membuka Meeting... Pastikan kembali ke tab ini agar perekaman berjalan!");
       // Memanggil fungsi dari script.js
       if(typeof startRecordingLogic === 'function') {
           startRecordingLogic();
       }
    }, 1000);
}

// Logika Mode Upload (Simulasi)
function startUploadSimulation() {
    const file = document.getElementById('fileInput').files[0];
    if(!file) return alert("Pilih file audio dulu!");

    const progressDiv = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');

    progressDiv.classList.remove('hidden');
    let width = 0;
    const interval = setInterval(() => {
        if (width >= 100) {
            clearInterval(interval);
            alert("⚠️ INFO: Transkripsi file audio membutuhkan Server Backend (Python/NodeJS). Karena ini Web Statis, ini hanya demo UI.");
            progressDiv.classList.add('hidden');
        } else {
            width++;
            progressBar.style.width = width + '%';
            progressPercent.innerText = width + '%';
        }
    }, 50);
}

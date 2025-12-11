from http.server import BaseHTTPRequestHandler
import cgi
import json
import os

# Jika mau pakai OpenAI asli:
# import openai
# openai.api_key = os.getenv("OPENAI_API_KEY")

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # 1. Parse Form Data (File Audio)
        content_type, pdict = cgi.parse_header(self.headers.get('content-type'))
        pdict['boundary'] = bytes(pdict['boundary'], "utf-8")
        
        if content_type == 'multipart/form-data':
            fields = cgi.parse_multipart(self.rfile, pdict)
            # audio_data = fields.get('file')[0] 
            
            # --- LOGIKA TRANSKRIPSI ---
            
            # Opsi A: Jika Punya OpenAI Key (Uncomment ini nanti)
            # transcript = openai.Audio.transcribe("whisper-1", audio_data)
            # text_result = transcript["text"]
            
            # Opsi B: Dummy (Untuk Tes UI tanpa API Key)
            # Karena Vercel Free tidak kuat jalanin Whisper lokal, 
            # kita simulasi respon sukses.
            text_result = "Ini adalah teks simulasi dari audio yang Anda rekam. Sambungkan API Key untuk hasil nyata."

            # --------------------------

            # 2. Kirim Balik JSON
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            response = json.dumps({"text": text_result})
            self.wfile.write(response.encode())
        else:
            self.send_response(400)
            self.end_headers()
      

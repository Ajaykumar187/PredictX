import io

def text_to_speech_bytes(text: str):
    try:
        from gtts import gTTS
    except ImportError:
        return None, "gTTS isn't installed. Run: pip install gTTS"
    try:
        buf = io.BytesIO()
        gTTS(text=text, lang="en").write_to_fp(buf)
        buf.seek(0)
        return buf.read(), None
    except Exception as e:
        return None, f"Text-to-speech failed: {e}"


def speech_to_text_from_file(uploaded_file):
    try:
        import speech_recognition as sr
    except ImportError:
        return None, "SpeechRecognition isn't installed. Run: pip install SpeechRecognition"
    try:
        recognizer = sr.Recognizer()
        with sr.AudioFile(uploaded_file) as source:
            audio = recognizer.record(source)
        text = recognizer.recognize_google(audio)
        return text, None
    except Exception as e:
        return None, f"Speech-to-text failed: {e}. Try a WAV file recorded at 16kHz mono."

# YouTube Downloader & Trimmer (Local Application)

This project is a fully local web application for downloading and trimming YouTube videos.  
It provides a browser-based interface, a modern responsive design, real-time video preview, and accurate trimming using FFmpeg.  
All operations are performed entirely on your machine without uploading data to any external server.

---

## Overview

This application enables you to:

- Download YouTube videos as MP4  
- Download YouTube audio as MP3  
- Choose audio and video quality  
- Preview videos inside the browser  
- Trim audio or video using a dual-handle slider  
- Run everything locally using Python and Flask  

The system does **not** require or support any remote hosting environment.  
It is designed to run only on your local machine.

---

## Requirements

### Python Version

Supports:

- **Python 3.8 – 3.13**

Not supported:

- **Python 3.14**  
  Several dependencies, including yt-dlp and FFmpeg integrations, do not yet support Python 3.14.

### Python Dependencies

Install dependencies with:

```bash
pip install flask yt-dlp flask-cors feedparser
```

### FFmpeg (Required)

FFmpeg must be installed and accessible in your system PATH.  
It is required for trimming, MP3 extraction, and video re-encoding.

Install FFmpeg on Windows using:

```bash
winget install --id Gyan.FFmpeg -e
```

Verify installation:

```bash
ffmpeg -version
```

---

## Running the Application Locally

Start the Flask server:

```bash
python app.py
```

Open a web browser and navigate to:

```
http://localhost:5000
```

The application will run entirely in your browser with no external communication.

---

## Trimming Behavior

The trimming slider outputs timestamps in the following formats:

- MM:SS
- HH:MM:SS

The backend then:

1. Downloads the full media using yt-dlp  
2. Uses FFmpeg to apply start/end trimming  
3. Re-encodes MP4 files when required  
4. Extracts MP3 audio with stream copy when possible  
5. Produces a trimmed output file  
6. Removes the untrimmed original file to save storage  

---

## Project Structure

```
youtube-downloader/
│
├── app.py
├── index.html
├── script.js
├── style.css
├── /downloads
└── /img
```

---

## Legal Notice

This tool must be used only for:

- Your own content  
- Public domain material  
- Creative Commons licensed material  
- Content for which you have explicit download rights  

You are responsible for ensuring compliance with YouTube’s Terms of Service and applicable copyright laws.

---

## Notes

- This project is intended for **local use only**.  
- No server deployment or hosting configuration is included or supported.  
- Python 3.14 is not supported.  
- All downloads and processing occur on the user's machine.

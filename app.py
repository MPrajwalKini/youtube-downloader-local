from flask import Flask, request, jsonify, send_file, send_from_directory
import os
import yt_dlp
import re
import subprocess # Import subprocess module for direct ffmpeg calls
import feedparser
import shutil
print(shutil.which("ffmpeg"))

app = Flask(__name__, static_folder='.', static_url_path='')

@app.route('/')
def home():
    return send_from_directory('.', 'index.html')

def is_valid_time_format(time_str):
    """Check if the time string is in a valid HH:MM:SS or MM:SS format."""
    if not time_str:
        return False
    # This regex matches one or more digits, a colon, and one or more digits.
    # It can be extended for hours, minutes, seconds.
    return re.match(r'^(\d+:)?[0-5]?\d:[0-5]\d$', time_str)

def parse_time_to_seconds(time_str):
    """Parses a time string (HH:MM:SS or MM:SS) into seconds."""
    if not time_str:
        return None
    parts = list(map(int, time_str.split(':')))
    if len(parts) == 3:
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    elif len(parts) == 2:
        return parts[0] * 60 + parts[1]
    return None # Should not happen if is_valid_time_format passes


@app.route('/download', methods=['POST'])
def download():
    data = request.get_json()
    url = data.get('url')
    format_type = data.get('format')
    quality = data.get('quality', 'best')
    start_time_str = data.get('startTime')
    end_time_str = data.get('endTime')

    if not url or format_type not in ['mp3', 'mp4']:
        return jsonify({"error": "Invalid input: URL and format are required."}), 400

    # Convert time strings to seconds if valid
    start_time_sec = None
    if start_time_str and is_valid_time_format(start_time_str):
        start_time_sec = parse_time_to_seconds(start_time_str)
    
    end_time_sec = None
    if end_time_str and is_valid_time_format(end_time_str):
        end_time_sec = parse_time_to_seconds(end_time_str)

    # Base output filename without trimming suffix yet
    output_template = 'downloads/%(title)s.%(ext)s'
    
    ydl_opts = {
        'outtmpl': output_template,
        'postprocessors': [] # No FFmpegPostProcessor for trimming here anymore
    }

    # --- Format-specific options ---
    if format_type == 'mp3':
        ydl_opts['postprocessors'].append({
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': quality,
        })
        ydl_opts['format'] = 'bestaudio/best'
        
    elif format_type == 'mp4':
        if quality != 'best':
            video_fmt = f"bestvideo[height<={quality}][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"
        else:
            video_fmt = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
        ydl_opts['format'] = video_fmt
        # Ensure the final output is mp4
        ydl_opts['postprocessors'].append({
            'key': 'FFmpegVideoConvertor',
            'preferedformat': 'mp4',
        })
        

    # --- Execute download and then trim if needed ---
    original_filename = None
    final_output_filename = None

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            # This gives the path *before* potential trimming by a separate ffmpeg call
            original_filename = ydl.prepare_filename(info)
            
            # Ensure correct extension after yt-dlp's internal conversions
            if format_type == 'mp3' and not original_filename.endswith('.mp3'):
                 base, _ = os.path.splitext(original_filename)
                 original_filename = base + '.mp3'
            elif format_type == 'mp4' and not original_filename.endswith('.mp4'):
                base, _ = os.path.splitext(original_filename)
                original_filename = base + '.mp4'

        if not os.path.exists(original_filename):
             return jsonify({"error": "File not found after initial download. Check logs."}), 500

        # --- Trimming logic using direct FFmpeg subprocess call ---
        if start_time_sec is not None or end_time_sec is not None:
            # Construct the output filename for the trimmed file
            base_name, ext = os.path.splitext(original_filename)
            final_output_filename = f"{base_name}_trimmed{ext}"
            
            ffmpeg_command = ["ffmpeg", "-i", original_filename]

            if start_time_sec is not None:
                ffmpeg_command.extend(["-ss", str(start_time_sec)])
            if end_time_sec is not None:
                # Use -t (duration) if -ss is also used, or -to (end time) if only -to
                if start_time_sec is not None:
                    duration_sec = end_time_sec - start_time_sec
                    ffmpeg_command.extend(["-t", str(duration_sec)])
                else:
                    ffmpeg_command.extend(["-to", str(end_time_sec)])

            # Use -c copy for re-encoding only if necessary, for speed use copy
            # If trimming video, we often need to re-encode to avoid issues with keyframes
            # However, for simple cutting, -c copy can be faster. Let's re-encode for robustness.
            # For mp3, we can often just copy
            if format_type == 'mp3':
                 ffmpeg_command.extend(["-c", "copy"])
            else: # For mp4, re-encode for precise cuts and wide compatibility
                 ffmpeg_command.extend(["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "copy"])

            ffmpeg_command.append(final_output_filename)

            app.logger.info(f"Executing FFmpeg command: {' '.join(ffmpeg_command)}")
            
            # Execute the FFmpeg command
            process = subprocess.run(ffmpeg_command, capture_output=True, text=True, check=True)
            app.logger.info(f"FFmpeg stdout: {process.stdout}")
            app.logger.info(f"FFmpeg stderr: {process.stderr}")

            # Delete the original, untrimmed file to save space
            os.remove(original_filename)
            filename_to_send = final_output_filename
        else:
            filename_to_send = original_filename # No trimming, send the original file

        if not os.path.exists(filename_to_send):
             return jsonify({"error": "Final file not found after processing. Check logs."}), 500

        return send_file(filename_to_send, as_attachment=True)
        
    except yt_dlp.utils.DownloadError as e:
        app.logger.error(f"yt-dlp download error: {e}")
        return jsonify({"error": "Failed to download or process video. Please check the URL and format."}), 500
    except subprocess.CalledProcessError as e:
        app.logger.error(f"FFmpeg error: {e.stderr}")
        return jsonify({"error": f"Failed to trim video: {e.stderr.splitlines()[-1] if e.stderr else 'Unknown FFmpeg error'}"}), 500
    except Exception as e:
        app.logger.error(f"An unexpected error occurred: {e}")
        return jsonify({"error": "An internal server error occurred."}), 500

if __name__ == '__main__':
    os.makedirs("downloads", exist_ok=True)
    app.run(debug=True)
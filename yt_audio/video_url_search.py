from typing import Optional
import random
import urllib.parse
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from dotenv import load_dotenv, find_dotenv
import os
import yt_dlp
from pydub import AudioSegment
import tempfile

class YouTubeVideoSearch:    
    def __init__(self):
        load_dotenv(find_dotenv())
        self.api_key = os.getenv("GOOGLE_YT_API_KEY")
        if not self.api_key:
            raise ValueError("YouTube API key not found in environment variables")
        
        self.youtube = build(
            "youtube", 
            "v3",
            developerKey=self.api_key
        )

    def get_person_video_url(self, person_name: str, suffix: str = " voice sample") -> str:
        try:
            search_query = f"{person_name} {suffix}".strip()
            return self._search_video(search_query)
        except HttpError as e:
            raise RuntimeError(f"YouTube API error: {str(e)}")
    
    def _search_video(self, search_query: str) -> str:
        request = self.youtube.search().list(
            part="snippet",
            q=search_query,
            type="video",
            maxResults=1
        )
        response = request.execute()
        items = response.get("items", [])
        
        if not items:
            raise RuntimeError(f"No video results found for query: {search_query}")
            
        video_id = items[0]["id"]["videoId"]
        return f"https://www.youtube.com/watch?v={urllib.parse.quote(video_id)}"
    
    def download_audio_segment(self, url: str, output_path: str, duration: int = 15) -> str:
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                ydl_opts = {
                    'format': 'bestaudio/best',
                    'outtmpl': f'{temp_dir}/%(id)s.%(ext)s',
                    'postprocessors': [{
                        'key': 'FFmpegExtractAudio',
                        'preferredcodec': 'wav',
                    }],
                    'quiet': True
                }

                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=True)
                    video_id = info['id']
                    temp_path = f'{temp_dir}/{video_id}.wav'

                # Load the audio file
                audio = AudioSegment.from_wav(temp_path)
                
                # Calculate middle segment
                total_duration = len(audio)
                mid_point = total_duration // 2
                start_time = mid_point - (duration * 1000 // 2)  # Convert to milliseconds
                end_time = start_time + (duration * 1000)

                # Extract the segment
                segment = audio[start_time:end_time]
                
                # Export the segment
                segment.export(output_path, format='wav')
                
                return output_path

        except Exception as e:
            raise RuntimeError(f"Failed to download and process audio: {str(e)}")
        

if __name__ == "__main__":
    try:
        searcher = YouTubeVideoSearch()
        person = "Barack Obama"
        url = searcher.get_person_video_url(person)
        print(f"Video URL for {person}:", url)
        
        output_file = f"{person.replace(' ', '_')}_voice.wav"
        audio_path = searcher.download_audio_segment(url, output_file)
        print(f"Audio segment saved to: {audio_path}")
    except Exception as e:
        print(f"Error: {str(e)}")
        

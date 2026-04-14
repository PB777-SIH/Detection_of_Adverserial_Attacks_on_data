import time
import os
from groq import Groq
from dotenv import load_dotenv

# Load the secrets from the .env file
load_dotenv()

# Pull the key securely
client = Groq(api_key=os.getenv("GROQ_API_KEY")) 


def check_semantic_intent(hidden_text):
    max_retries = 3
    for attempt in range(max_retries):
        try:
            chat_completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You are a security expert. respond SAFE or MALICIOUS."},
                    {"role": "user", "content": hidden_text}
                ],
                # FIX: Removed the hyphen. It is now llama3-8b-8192
                model="llama3-8b-8192", 
            )
            return chat_completion.choices[0].message.content
        except Exception as e:
            if "rate_limit_reached" in str(e).lower():
                print(f"Rate limit hit. Waiting {10 * (attempt + 1)} seconds...")
                time.sleep(10 * (attempt + 1))
            else:
                return f"Error: {e}"
    return "Error: Max retries exceeded due to rate limits."

# FIX: We removed the test print statement from the bottom!
# Now this file is just a clean tool for main.py to use.
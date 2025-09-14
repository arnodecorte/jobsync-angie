from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
import time
import json
from dotenv import load_dotenv
import os
import yaml
import sys
import io
import tempfile

# Ensure that the output is in UTF-8

if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Get the absolute path of the directory where the script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Construct absolute paths for config files
SELECTORS_PATH = os.path.join(SCRIPT_DIR, 'selectors.yaml')
COOKIES_PATH = os.path.join(SCRIPT_DIR, 'cookies.json')

# Create a temporary user data directory for Chrome
tempfile_dir = tempfile.TemporaryDirectory()

chrome_options = Options()
chrome_options.add_argument("--headless=new")  # Use new headless mode for Chrome 109+
chrome_options.add_argument("--no-sandbox") # Bypass OS security model
chrome_options.add_argument("--disable-dev-shm-usage") # Overcome limited resource problems
chrome_options.add_argument(f"--user-data-dir={tempfile_dir.name}") # Use temporary user data directory

# Initialize the Browser
driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
driver.maximize_window()

# Load Selectors
with open(SELECTORS_PATH, 'r') as file:
    selectors = yaml.safe_load(file)

# Get URL from command line arguments
if len(sys.argv) > 1:
    job_url = sys.argv[1]
else:
    print(json.dumps({"error": "No URL provided"}))
    sys.exit(1)

driver.get(job_url)

job_data = {}

time.sleep(3) # Wait for page to load

# Close signin popup if it appears
try:
    wait = WebDriverWait(driver, 5)
    close_btn = wait.until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, "#base-contextual-sign-in-modal > div > section > button"))
    )
    close_btn.click()
except Exception as e:
    print(f"Sign-in modal not found or could not be closed: {e}", file=sys.stderr)

# Use selectors to extract relevant information

try:
    job_data['title'] = driver.find_element(By.CSS_SELECTOR, "#main-content h1").text
except Exception as e:
    job_data['title'] = None
    job_data['title_error'] = str(e)

try:
    job_data['company_name'] = driver.find_element(By.CSS_SELECTOR, "a.topcard__org-name-link").text
except Exception as e:
    job_data['company_name'] = None
    job_data['company_name_error'] = str(e)

try:
    job_data['location'] = driver.find_element(By.CSS_SELECTOR, "#main-content h4 > div:nth-child(1) > span.topcard__flavor.topcard__flavor--bullet").text
except Exception as e:
    job_data['location'] = None
    job_data['location_error'] = str(e)

try:
    details_section = driver.find_element(By.CSS_SELECTOR, "#main-content section.core-section-container.my-3.description > div > div")
    job_data['description'] = details_section.text # Use .text to get textContent
except Exception as e:
    job_data['description'] = None
    job_data['description_error'] = str(e)

job_data['link'] = job_url

# Print data as JSON to stdout
print(json.dumps(job_data, ensure_ascii=False, indent=2))

# quit and clean
driver.quit()
tempfile_dir.cleanup()

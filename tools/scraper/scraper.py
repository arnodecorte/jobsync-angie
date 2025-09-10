from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time
import json
from dotenv import load_dotenv
import os
import yaml
import sys
import io

# --- START OF CHANGES ---

if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Get the absolute path of the directory where the script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Construct absolute paths for config files
SELECTORS_PATH = os.path.join(SCRIPT_DIR, 'selectors.yaml')
COOKIES_PATH = os.path.join(SCRIPT_DIR, 'cookies.json')

# --- END OF CHANGES ---

# Initialize the Browser
driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()))
driver.maximize_window()

# Load Selectors
with open(SELECTORS_PATH, 'r') as file:
    selectors = yaml.safe_load(file)

# Check if cookies file exists
if os.path.exists(COOKIES_PATH):
    with open(COOKIES_PATH, 'r') as file:
        cookies = json.load(file)
    
    driver.get("https://www.linkedin.com")
    for cookie in cookies:
        driver.add_cookie(cookie)
    
    driver.refresh()
    print("Loaded cookies and logged in successfully.", file=sys.stderr)
else:
    driver.get("https://www.linkedin.com/login")
    username = driver.find_element(By.ID, "username")
    password = driver.find_element(By.ID, "password")

    # Load environment variables from .env file
    load_dotenv()

    # Retrieve credentials from environment variables
    email = os.getenv("LINKEDIN_EMAIL")
    pwd = os.getenv("LINKEDIN_PASSWORD")

    # Add a check to ensure credentials are not None
    if not email or not pwd:
        print(json.dumps({"error": "LinkedIn credentials (LINKEDIN_EMAIL, LINKEDIN_PASSWORD) not found in .env file."}))
        driver.quit()
        sys.exit(1)

    # Use the credentials
    username.send_keys(email)
    password.send_keys(pwd)

    driver.find_element(By.XPATH, "//button[@type='submit']").click()
    print("Logged in successfully", file=sys.stderr)

    # Save cookies to file
    with open(COOKIES_PATH, 'w') as file:
        json.dump(driver.get_cookies(), file)
    print("Cookies saved for future sessions.", file=sys.stderr)

# Get URL from command line arguments
if len(sys.argv) > 1:
    job_url = sys.argv[1]
else:
    print(json.dumps({"error": "No URL provided"}))
    sys.exit(1)

driver.get(job_url)

job_data = {}

time.sleep(3) # Wait for page to load

try:
    job_data['title'] = driver.find_element(By.CSS_SELECTOR, "h1.t-24").text
except Exception as e:
    job_data['title'] = None
    job_data['title_error'] = str(e)

try:
    job_data['company_name'] = driver.find_element(By.CSS_SELECTOR, ".job-details-jobs-unified-top-card__company-name a").text
except Exception as e:
    job_data['company_name'] = None
    job_data['company_name_error'] = str(e)

try:
    job_data['location'] = driver.find_element(By.CSS_SELECTOR, ".t-black--light.mt2.job-details-jobs-unified-top-card__tertiary-description-container span.tvm__text.tvm__text--low-emphasis:nth-of-type(1)").text
except Exception as e:
    job_data['location'] = None
    job_data['location_error'] = str(e)

try:
    details_section = driver.find_element(By.CSS_SELECTOR, "#job-details")
    job_data['description'] = details_section.text # Use .text to get textContent
except Exception as e:
    job_data['description'] = None
    job_data['description_error'] = str(e)

job_data['link'] = job_url

# Print data as JSON to stdout
print(json.dumps(job_data, ensure_ascii=False, indent=2))

driver.quit()

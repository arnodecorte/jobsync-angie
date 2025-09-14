from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
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

# Construct absolute paths for config files
SELECTORS_PATH = "tools/scraper/selectors.yaml"

# --- END OF CHANGES ---

# Initialize the Browser
driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()))
driver.maximize_window()

# Load Selectors
with open(SELECTORS_PATH, 'r') as file:
    selectors = yaml.safe_load(file)

job_url = "https://www.linkedin.com/jobs/view/4292666793" #test url
driver.get(job_url)

job_data = {}

time.sleep(3) # Wait for page to load

# Close signin popup if it appears
try:
    wait = WebDriverWait(driver, 3)
    close_btn = wait.until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, "#base-contextual-sign-in-modal > div > section > button"))
    )
    close_btn.click()
    print("Sign-in modal closed.")
except Exception as e:
    print(f"Sign-in modal not found or could not be closed: {e}", file=sys.stderr)

# Use selectors to extract relevant information

try:
    job_data['title'] = driver.find_element(By.CSS_SELECTOR, "#main-content h1").text
    print(f"SUCCESS! Job Title: {job_data['title']}")
except Exception as e:
    job_data['title'] = None
    job_data['title_error'] = str(e)

try:
    job_data['company_name'] = driver.find_element(By.CSS_SELECTOR, "a.topcard__org-name-link").text
    print(f"SUCCESS! Company Name: {job_data['company_name']}")
except Exception as e:
    job_data['company_name'] = None
    job_data['company_name_error'] = str(e)

try:
    job_data['location'] = driver.find_element(By.CSS_SELECTOR, "#main-content h4 > div:nth-child(1) > span.topcard__flavor.topcard__flavor--bullet").text
    print(f"SUCCESS! Location: {job_data['location']}")
except Exception as e:
    job_data['location'] = None
    job_data['location_error'] = str(e)

try:
    details_section = driver.find_element(By.CSS_SELECTOR, "#main-content section.core-section-container.my-3.description > div > div")
    job_data['description'] = details_section.text # Use .text to get textContent
    print(f"SUCCESS! Job Description extracted.")
except Exception as e:
    job_data['description'] = None
    job_data['description_error'] = str(e)

job_data['link'] = job_url

# Print data as JSON to stdout
print(json.dumps(job_data, ensure_ascii=False, indent=2))

driver.quit()

# Siri Sarees Backend

This folder contains the initial Flask backend structure for the Siri Sarees admin panel.

## Setup

1. Create a virtual environment:
   ```bash
   python -m venv venv
   ```

2. Activate it:
   ```bash
   venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run the Flask application:
   ```bash
   python app.py
   ```

The app exposes a simple health check at `/` and a placeholder status endpoint at `/api/status`.

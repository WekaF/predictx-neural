import json
import os

def read_file(path):
    if not os.path.exists(path):
        # Fallback for paths that might be relative differently or not exist
        # We try to fix common path issues
        if path.startswith("backend/"):
            local_path = path # Assumes script run from root
            if not os.path.exists(local_path):
                 print(f"Warning: {local_path} found. Trying absolute...")
                 # This is running on user machine, we trust the paths provided in previous step are correct relative to cwd
        return f"# Error: File {path} not found during notebook generation."
        
    with open(path, 'r') as f:
        return f.read()

notebook = {
 "cells": [],
 "metadata": {
  "kernelspec": {
   "display_name": "Python 3",
   "language": "python",
   "name": "python3"
  },
  "language_info": {
   "codemirror_mode": {
    "name": "ipython",
    "version": 3
   },
   "file_extension": ".py",
   "mimetype": "text/x-python",
   "name": "python",
   "nbconvert_exporter": "python",
   "pygments_lexer": "ipython3",
   "version": "3.10.12"
  }
 },
 "nbformat": 4,
 "nbformat_minor": 5
}

def add_code_cell(source):
    if isinstance(source, str):
        source = [line + '\n' for line in source.splitlines()]
        if source and source[-1].endswith('\n'):
            source[-1] = source[-1][:-1]
            
    notebook["cells"].append({
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": source
    })

def add_markdown_cell(source):
    if isinstance(source, str):
        source = [line + '\n' for line in source.splitlines()]
        
    notebook["cells"].append({
        "cell_type": "markdown",
        "metadata": {},
        "source": source
    })

# --- NOTEBOOK CONTENT ---

# 1. Introduction
add_markdown_cell("# 🤖 PredictX: The Trinity Training (Tier 7)\n**Reinforcement Learning (PPO) + CNN Pattern Recognition + LSTM Trend Following**\n\n**⚠️ IMPORTANT: Validate that you have run the SETUP cell below before running any other cells!**")

# 2. Setup (Split for clarity and robustness)
add_markdown_cell("## 1. Environment Setup\nRun this cell first to install dependencies and create the necessary folder structure.")
add_code_cell([
    "# Install dependencies",
    "!pip install torch pandas numpy ccxt scikit-learn stable-baselines3 shimmy gymnasium matplotlib",
    "",
    "# Create Directory Structure (Robust)",
    "import os",
    "dirs = ['backend/services', 'backend/models', 'backend/logs']",
    "for d in dirs:",
    "    os.makedirs(d, exist_ok=True)",
    "    print(f'✅ Created {d}')",
    "",
    "import sys",
    "sys.path.append(os.path.abspath('backend'))"
])

# 3. Write Files (Using a Python Helper to allow self-contained directory creation safety)
add_markdown_cell("## 2. Upload Codebase\nWe write the Python files to the Colab environment.")

# Helper function definition in the notebook
add_code_cell([
    "import os",
    "",
    "def safe_write_file(path, content):",
    "    # Ensure directory exists",
    "    os.makedirs(os.path.dirname(path), exist_ok=True)",
    "    # Write file",
    "    with open(path, 'w') as f:",
    "        f.write(content)",
    "    print(f'📄 Written: {path}')"
])

files_to_sync = [
    ('backend/services/data_service.py', 'backend/services/data_service.py'),
    ('backend/services/lstm_service.py', 'backend/services/lstm_service.py'),
    ('backend/services/cnn_service.py', 'backend/services/cnn_service.py'),
    ('backend/services/chart_generator.py', 'backend/services/chart_generator.py'),
    ('backend/ai_engine.py', 'backend/ai_engine.py'),
    ('backend/rl_trading_env.py', 'backend/rl_trading_env.py'),
    ('backend/train_cnn.py', 'backend/train_cnn.py'),
    ('backend/train_rl_agent.py', 'backend/train_rl_agent.py'),
    ('backend/services/backtest_service.py', 'backend/services/backtest_service.py') # Added backtest service too
]

for src, dest in files_to_sync:
    content = read_file(src)
    
    # Escape triple qoutes if present to avoid syntax errors in the generated python string
    # We use a raw string r'''...''' typically, but if content has ''', we need to be careful.
    # Simple strategy: Use triple double quotes \"\"\" and escape any existing triple double quotes.
    
    safe_content = content.replace('"""', '\\"\\"\\"')
    
    code_block = [
        f"safe_write_file('{dest}', r\"\"\"",
        safe_content,
        "\"\"\")"
    ]
    
    add_code_cell(code_block)

# 4. Run Training
add_markdown_cell("## 3. Start Training\nTrain the models sequentially.")
add_code_cell("!python backend/train_cnn.py")
add_code_cell("!python backend/train_rl_agent.py")

# 5. Download
add_markdown_cell("## 4. Download Trained Models\nZip and download the models to your local machine.")
add_code_cell([
    "!zip -r trained_models.zip backend/models",
    "from google.colab import files",
    "files.download('trained_models.zip')"
])

with open('PredictX_Trinity_Setup.ipynb', 'w') as f:
    json.dump(notebook, f, indent=1)

print("Notebook generated: PredictX_Trinity_Setup.ipynb")

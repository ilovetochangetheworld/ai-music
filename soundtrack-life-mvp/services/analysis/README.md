# Practice analysis service

```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt
PYTHONPATH=. .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8790
PYTHONPATH=. .venv/bin/pytest
```

This first CPU service validates the asynchronous contract and data-quality gates. Pitch and rhythm remain `insufficient_data` until manually corrected note and phrase references are supplied; it intentionally does not manufacture a total score.

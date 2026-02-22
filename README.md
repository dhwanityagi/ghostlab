# GhostLab - Digital Twin of Hostel Room

A futuristic full-stack simulator that predicts room comfort and energy cost.

## Stack
- FastAPI + SQLite backend
- Surreal glassmorphism frontend (HTML/CSS/JS)

## Run Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8004
```

## Run Frontend
Open `frontend/index.html` in browser.

## Resume Value
- Predictive simulation, not just a CRUD app
- Clear product thinking around comfort vs cost tradeoffs

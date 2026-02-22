from __future__ import annotations

import sqlite3
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "ghostlab.db"

app = FastAPI(title="GhostLab API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS simulations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_temp REAL NOT NULL,
                humidity REAL NOT NULL,
                occupancy INTEGER NOT NULL,
                fan_speed INTEGER NOT NULL,
                ac_setpoint REAL NOT NULL,
                lights INTEGER NOT NULL,
                comfort_score REAL NOT NULL,
                predicted_units REAL NOT NULL,
                predicted_cost REAL NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


class Scenario(BaseModel):
    room_temp: float = Field(ge=10, le=50)
    humidity: float = Field(ge=0, le=100)
    occupancy: int = Field(ge=0, le=6)
    fan_speed: int = Field(ge=0, le=5)
    ac_setpoint: float = Field(ge=16, le=30)
    lights: int = Field(ge=0, le=8)


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "service": "ghostlab"}


@app.get("/api/presets")
def presets() -> dict:
    return {
        "presets": [
            {
                "name": "Exam Night",
                "room_temp": 31,
                "humidity": 62,
                "occupancy": 2,
                "fan_speed": 4,
                "ac_setpoint": 23,
                "lights": 3,
            },
            {
                "name": "Sleep Mode",
                "room_temp": 28,
                "humidity": 54,
                "occupancy": 1,
                "fan_speed": 2,
                "ac_setpoint": 25,
                "lights": 1,
            },
            {
                "name": "Group Study",
                "room_temp": 33,
                "humidity": 65,
                "occupancy": 4,
                "fan_speed": 5,
                "ac_setpoint": 22,
                "lights": 5,
            },
        ]
    }


@app.post("/api/predict")
def predict(s: Scenario) -> dict:
    thermal_penalty = abs(s.room_temp - 24) * 2.4 + abs(s.humidity - 50) * 0.35
    airflow_bonus = s.fan_speed * 1.5
    occupancy_penalty = s.occupancy * 1.3

    comfort_score = max(0.0, min(100.0, 92 - thermal_penalty + airflow_bonus - occupancy_penalty))

    ac_load = max(0.0, (s.room_temp - s.ac_setpoint) * 0.16)
    fan_load = s.fan_speed * 0.06
    light_load = s.lights * 0.04
    occupant_load = s.occupancy * 0.03

    predicted_units = round(ac_load + fan_load + light_load + occupant_load, 2)
    predicted_cost = round(predicted_units * 8.4, 2)

    now = datetime.utcnow().isoformat(timespec="seconds") + "Z"

    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO simulations(
                room_temp, humidity, occupancy, fan_speed, ac_setpoint, lights,
                comfort_score, predicted_units, predicted_cost, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                s.room_temp,
                s.humidity,
                s.occupancy,
                s.fan_speed,
                s.ac_setpoint,
                s.lights,
                comfort_score,
                predicted_units,
                predicted_cost,
                now,
            ),
        )
        conn.commit()

    return {
        "comfort_score": round(comfort_score, 1),
        "predicted_units": predicted_units,
        "predicted_cost": predicted_cost,
        "advice": (
            "Reduce AC delta and lights for lower cost."
            if predicted_cost > 10
            else "Comfort-cost balance is healthy."
        ),
    }


@app.get("/api/history")
def history() -> dict:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT comfort_score, predicted_cost, created_at FROM simulations ORDER BY id DESC LIMIT 12"
        ).fetchall()

    return {
        "points": [
            {
                "comfort_score": r["comfort_score"],
                "predicted_cost": r["predicted_cost"],
                "created_at": r["created_at"],
            }
            for r in reversed(rows)
        ]
    }

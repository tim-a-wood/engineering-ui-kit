"""Existing entry point serving the dashboard HTTP API. A migration plan
must wrap/extend this file, never replace it wholesale (CAP-ERA-001 §14.3)."""

from fastapi import FastAPI

app = FastAPI()


@app.get("/api/dashboard")
def get_dashboard() -> dict:
    return {"widgets": []}

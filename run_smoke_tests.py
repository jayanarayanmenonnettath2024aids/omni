import compileall
import os
import subprocess
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
SERVER_URL = "http://127.0.0.1:8000"


def print_result(name: str, passed: bool, detail: str) -> bool:
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {name}: {detail}")
    return passed


def wait_for_server(timeout_seconds: int = 90) -> bool:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            response = requests.get(f"{SERVER_URL}/erp/transactions", timeout=3)
            if response.status_code == 200:
                return True
        except requests.RequestException:
            pass
        time.sleep(1)
    return False


def run_pipeline_check() -> tuple[bool, str]:
    try:
        from main import run_pipeline

        summary = run_pipeline()
        total = int(summary.get("total_records", 0))
        return total > 0, f"total_records={total}"
    except Exception as exc:
        return False, str(exc)


def check_ai_chat() -> tuple[bool, str]:
    payload = {"message": "how many shipments left", "lang": "en-IN"}
    try:
        response = requests.post(
            f"{SERVER_URL}/api/ai/chat",
            json=payload,
            timeout=60,
        )
        if response.status_code != 200:
            return False, f"status={response.status_code}, body={response.text[:180]}"
        data = response.json()
        answer = str(data.get("answer", "")).strip()
        return bool(answer), f"status=200, answer_preview={answer[:100]}"
    except Exception as exc:
        return False, str(exc)


def check_audit_anomalies() -> tuple[bool, str]:
    try:
        response = requests.get(f"{SERVER_URL}/api/audit/report", timeout=180)
        if response.status_code != 200:
            return False, f"status={response.status_code}, body={response.text[:180]}"
        data = response.json()
        anomalies = data.get("anomalies", [])
        summary = data.get("summary", {})
        anomaly_count = len(anomalies)
        summary_count = int(summary.get("anomaly_count", anomaly_count))
        passed = anomaly_count >= 1 and summary_count >= 1
        return passed, f"anomalies={anomaly_count}, summary_anomaly_count={summary_count}"
    except Exception as exc:
        return False, str(exc)


def check_analytics_stats() -> tuple[bool, str]:
    try:
        response = requests.get(f"{SERVER_URL}/api/analytics/stats?role=super", timeout=60)
        if response.status_code != 200:
            return False, f"status={response.status_code}, body={response.text[:180]}"
        data = response.json()
        labels = data.get("labels", [])
        values = data.get("values", [])
        passed = len(labels) > 0 and len(values) > 0
        return passed, f"status=200, labels={len(labels)}, values={len(values)}"
    except Exception as exc:
        return False, str(exc)


def check_tts_via_app() -> tuple[bool, str]:
    payload = {"text": "This is a quick ElevenLabs smoke test.", "lang": "en-IN"}
    try:
        response = requests.post(
            f"{SERVER_URL}/api/tts",
            json=payload,
            headers={"Accept": "audio/mpeg"},
            timeout=60,
        )
        if response.status_code == 200:
            content_type = response.headers.get("content-type", "")
            return (
                "audio" in content_type.lower() and len(response.content) > 0,
                f"status=200, content-type={content_type}, bytes={len(response.content)}",
            )

        detail = response.text[:300].replace("\n", " ")
        return False, f"status={response.status_code}, detail={detail}"
    except requests.RequestException as exc:
        return False, str(exc)


def check_tts_direct() -> tuple[bool, str]:
    load_dotenv(BASE_DIR / ".env")
    api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    voice_id = os.getenv("ELEVENLABS_VOICE_ID", "").strip() or "21m00Tcm4TlvDq8ikWAM"

    if not api_key:
        return False, "ELEVENLABS_API_KEY is missing"

    try:
        response = requests.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
            json={
                "text": "Direct ElevenLabs health check.",
                "model_id": "eleven_multilingual_v2",
                "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
            },
            headers={
                "xi-api-key": api_key,
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",
            },
            timeout=60,
        )
        if response.status_code == 200:
            return True, f"status=200, bytes={len(response.content)}"

        detail = response.text[:300].replace("\n", " ")
        return False, f"status={response.status_code}, detail={detail}"
    except requests.RequestException as exc:
        return False, str(exc)


def main() -> int:
    print("=== Trade-Data Smoke Test Runner ===")
    all_passed = True

    compiled_ok = compileall.compile_dir(str(BASE_DIR), quiet=1)
    all_passed &= print_result("Python compile", compiled_ok, "compileall completed")

    python_exe = sys.executable
    log_path = BASE_DIR / "smoke_uvicorn.log"
    with log_path.open("w", encoding="utf-8") as log_file:
        server_process = subprocess.Popen(
            [
                python_exe,
                "-m",
                "uvicorn",
                "erp_mock:app",
                "--host",
                "127.0.0.1",
                "--port",
                "8000",
            ],
            cwd=str(BASE_DIR),
            stdout=log_file,
            stderr=subprocess.STDOUT,
            env=os.environ.copy(),
        )

    try:
        ready = wait_for_server()
        all_passed &= print_result(
            "API startup", ready, "server ready" if ready else "server did not start in time"
        )
        if not ready:
            print(f"Check {log_path} for startup logs.")
            return 1

        try:
            erp_resp = requests.get(f"{SERVER_URL}/erp/transactions", timeout=20)
            erp_ok = erp_resp.status_code == 200 and isinstance(erp_resp.json(), list)
            all_passed &= print_result(
                "ERP endpoint", erp_ok, f"status={erp_resp.status_code}, items={len(erp_resp.json()) if erp_resp.status_code == 200 else 0}"
            )
        except Exception as exc:
            all_passed &= print_result("ERP endpoint", False, str(exc))

        try:
            portal_resp = requests.get(f"{SERVER_URL}/portal/shipments", timeout=20)
            portal_ok = portal_resp.status_code == 200 and isinstance(portal_resp.json(), list)
            all_passed &= print_result(
                "Portal endpoint", portal_ok, f"status={portal_resp.status_code}, items={len(portal_resp.json()) if portal_resp.status_code == 200 else 0}"
            )
        except Exception as exc:
            all_passed &= print_result("Portal endpoint", False, str(exc))

        pipeline_ok, pipeline_detail = run_pipeline_check()
        all_passed &= print_result("Pipeline", pipeline_ok, pipeline_detail)

        ai_ok, ai_detail = check_ai_chat()
        all_passed &= print_result("AI chat", ai_ok, ai_detail)

        anomaly_ok, anomaly_detail = check_audit_anomalies()
        all_passed &= print_result("Anomaly engine", anomaly_ok, anomaly_detail)

        analytics_ok, analytics_detail = check_analytics_stats()
        all_passed &= print_result("Analytics stats", analytics_ok, analytics_detail)

        app_tts_ok, app_tts_detail = check_tts_via_app()
        all_passed &= print_result("ElevenLabs via app", app_tts_ok, app_tts_detail)

        direct_tts_ok, direct_tts_detail = check_tts_direct()
        all_passed &= print_result("ElevenLabs direct", direct_tts_ok, direct_tts_detail)

    finally:
        server_process.terminate()
        try:
            server_process.wait(timeout=15)
        except subprocess.TimeoutExpired:
            server_process.kill()

    print("=== Summary ===")
    if all_passed:
        print("All checks passed.")
        return 0

    print("One or more checks failed.")
    print(f"See {log_path} for server logs.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

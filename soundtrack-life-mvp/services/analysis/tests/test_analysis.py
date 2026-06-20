from app.main import AnalyzeRequest, analyze_payload


def test_insufficient_data_never_emits_total_score() -> None:
    request = AnalyzeRequest(session={"id": "s1", "songId": "trajectory"}, telemetry=[])
    report = analyze_payload(request)
    assert report["overallScore"] is None
    assert report["status"] == "insufficient_data"
    assert all(item["score"] is None for item in report["metrics"])


def test_reference_pitch_is_not_invented() -> None:
    frames = [
        {"at": index * 0.08, "db": -18, "pitchHz": 440, "clarity": 0.9, "vadProbability": 0.9, "isSinging": True}
        for index in range(100)
    ]
    request = AnalyzeRequest(session={"id": "s2", "songId": "trajectory"}, telemetry=frames)
    report = analyze_payload(request)
    pitch = next(item for item in report["metrics"] if item["key"] == "pitch")
    assert pitch["score"] is None
    assert report["overallScore"] is None

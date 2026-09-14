import json
import re
import urllib.request
from pathlib import Path

SOURCE_URL = "https://www.720yun.com/t/cb4jedemeO2?scene_id=18515089"
OUT = Path(__file__).resolve().parents[1] / "public" / "models" / "must-720-scenes.json"

def main():
    request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "Mozilla/5.0"})
    html = urllib.request.urlopen(request, timeout=60).read().decode("utf-8", "ignore")
    records = []
    pattern = re.compile(r'"panoId":(\d+).*?"thumb":"([^"]*)","name":"([^"]+)","id":(\d+)')
    for match in pattern.finditer(html):
        record = {
            "panoId": match.group(1),
            "thumb": match.group(2),
            "name": match.group(3),
            "sceneId": match.group(4),
            "url": f"https://www.720yun.com/t/cb4jedemeO2?scene_id={match.group(4)}",
        }
        if not any(item["panoId"] == record["panoId"] for item in records):
            records.append(record)
    output = {
        "source": SOURCE_URL,
        "provider": "720云",
        "title": "澳門科技大學全景地圖",
        "scenes": records,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"exported {len(records)} scenes -> {OUT}")

if __name__ == "__main__":
    main()

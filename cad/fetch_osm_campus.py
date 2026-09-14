import json
import math
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "public" / "models" / "must-campus-osm.json"
BASE_BUILDINGS = {
    245055149: {"code": "A", "name": "行政大楼", "floors": 5, "color": "#d7e7ef", "type": "行政"},
    322859440: {"code": "B", "name": "教学楼 B", "floors": 6, "color": "#4b9fd4", "type": "教学"},
    322859441: {"code": "C", "name": "教学楼 C", "floors": 5, "color": "#4b9fd4", "type": "教学"},
    322859444: {"code": "D", "name": "会议厅", "floors": 2, "color": "#d88c4b", "type": "会议"},
    192095972: {"code": "E", "name": "活动中心", "floors": 3, "color": "#42a7a0", "type": "活动"},
    192096093: {"code": "F", "name": "F座宿舍", "floors": 6, "color": "#d3a44b", "type": "宿舍"},
    192095955: {"code": "G", "name": "G座宿舍", "floors": 6, "color": "#d3a44b", "type": "宿舍"},
    192096092: {"code": "H", "name": "科技大楼", "floors": 5, "color": "#4e86c7", "type": "科研"},
    192096037: {"code": "J", "name": "室内体育馆", "floors": 3, "color": "#9b7be5", "type": "体育"},
    192096088: {"code": "L", "name": "公寓式酒店", "floors": 5, "color": "#9e7abf", "type": "住宿"},
    192096073: {"code": "M", "name": "M座宿舍", "floors": 6, "color": "#d3a44b", "type": "宿舍"},
    192096008: {"code": "N", "name": "图书馆", "floors": 4, "color": "#45b7db", "type": "图书馆"},
    468198732: {"code": "O", "name": "教学楼 O", "floors": 9, "color": "#4b9fd4", "type": "教学"},
    402077170: {"code": "P", "name": "P座宿舍", "floors": 6, "color": "#d3a44b", "type": "宿舍"},
    322859402: {"code": "R", "name": "综合教学大楼", "floors": 6, "color": "#d57d4a", "type": "教学"},
    245055148: {"code": "S", "name": "South Wing", "floors": 5, "color": "#a8c1ce", "type": "教学"},
    404569639: {"code": "N", "name": "North Wing", "floors": 5, "color": "#a8c1ce", "type": "教学"},
    192095993: {"code": "HF", "name": "霍英东楼", "floors": 5, "color": "#84a9c7", "type": "教学"},
}

QUERY = """[out:json][timeout:40];
way["building"](22.1503,113.5646,22.1551,113.5713);
out tags geom;"""

def main():
    url = "https://overpass-api.de/api/interpreter?" + urllib.parse.urlencode({"data": QUERY})
    request = urllib.request.Request(url, headers={"User-Agent": "CodexEducational/1.0"})
    payload = json.load(urllib.request.urlopen(request, timeout=60))
    by_id = {element["id"]: element for element in payload["elements"]}
    lat0, lon0 = 22.15265, 113.56765
    meters_per_deg_lat = 110540
    meters_per_deg_lon = 111320 * math.cos(math.radians(lat0))
    buildings = []
    for osm_id, meta in BASE_BUILDINGS.items():
        element = by_id.get(osm_id)
        if not element or not element.get("geometry"):
            continue
        polygon = []
        for point in element["geometry"]:
            x = (point["lon"] - lon0) * meters_per_deg_lon
            z = -(point["lat"] - lat0) * meters_per_deg_lat
            polygon.append([round(x, 2), round(z, 2)])
        tags = element.get("tags", {})
        levels = int(tags.get("building:levels", meta["floors"]))
        buildings.append({
            **meta,
            "osmId": osm_id,
            "nameEn": tags.get("name:en", tags.get("name", meta["name"])),
            "floors": levels,
            "height": round(levels * 3.3 + 1.2, 2),
            "polygon": polygon,
        })
    output = {
        "source": "OpenStreetMap contributors, ODbL 1.0; official map: https://www.must.edu.mo/page/id-13635.html",
        "center": {"lat": lat0, "lon": lon0},
        "buildings": buildings,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"exported {len(buildings)} buildings -> {OUT}")

if __name__ == "__main__":
    main()

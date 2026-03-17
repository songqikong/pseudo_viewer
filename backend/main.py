import sys
import os
import sqlite3
import json
from datetime import datetime
from contextlib import contextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import numpy as np
import yaml

# Add parent directory to path to import generate_pseudo_unified (no MinkowskiEngine)
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(os.path.dirname(current_dir))
sys.path.append(parent_dir)

try:
    from generate_pseudo_unified import process_one as unified_process_one
except ImportError as e:
    print(f"Error importing generate_pseudo_unified: {e}")
    sys.exit(1)

app = FastAPI(title="Pseudo-Label Generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global settings
def _default_config_path():
    """Resolve config path relative to this file so it works regardless of cwd. backend -> ... -> SelfCom/config/semantic-kitti.yaml"""
    _cur = os.path.dirname(os.path.abspath(__file__))
    _root = os.path.abspath(os.path.join(_cur, "..", "..", "..", "..", ".."))
    _path = os.path.join(_root, "config", "semantic-kitti.yaml")
    if os.path.exists(_path):
        return _path
    return "/mnt/drtraining/user/songqikong/code_repos/SelfCom/config/semantic-kitti.yaml"

class AppSettings:
    def __init__(self):
        self.base_dir = "/mnt/drtraining/user/songqikong/tep/se/seq/processed_data"
        self.output_base_dir = "/mnt/drtraining/user/songqikong/code_repos/SelfCom/data"
        self.config_path = _default_config_path()
        self.dataset_type = "semantic_kitti"  # "semantic_kitti" | "semanticposs"

app_settings = AppSettings()

# SQLite database for visualization data (replaces file-based vis storage)
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "visualizations.db")

@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()

def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS visualizations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT NOT NULL,
                label TEXT NOT NULL,
                config_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                pseudo_bev TEXT NOT NULL,
                bev_after_voronoi TEXT NOT NULL,
                bev_after_conv TEXT NOT NULL,
                point_cloud TEXT NOT NULL
            )
        """)

def save_visualization(file_path: str, label: str, config: Dict, pseudo_bev: list, bev_after_voronoi: list, bev_after_conv: list, point_cloud: list) -> int:
    with get_db() as conn:
        cur = conn.execute(
            """INSERT INTO visualizations (file_path, label, config_json, created_at, pseudo_bev, bev_after_voronoi, bev_after_conv, point_cloud)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                file_path,
                label,
                json.dumps(config),
                datetime.utcnow().isoformat() + "Z",
                json.dumps(pseudo_bev),
                json.dumps(bev_after_voronoi),
                json.dumps(bev_after_conv),
                json.dumps(point_cloud),
            ),
        )
        return cur.lastrowid

def list_visualizations() -> List[Dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, label, created_at FROM visualizations ORDER BY id DESC"
        ).fetchall()
        return [{"id": r["id"], "label": r["label"], "created_at": r["created_at"]} for r in rows]

def get_visualization(run_id: int) -> Optional[Dict]:
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, file_path, label, config_json, created_at, pseudo_bev, bev_after_voronoi, bev_after_conv, point_cloud FROM visualizations WHERE id = ?",
            (run_id,),
        ).fetchone()
    if not row:
        return None
    return {
        "id": row["id"],
        "file_path": row["file_path"],
        "label": row["label"],
        "config": json.loads(row["config_json"]),
        "created_at": row["created_at"],
        "pseudo_bev": json.loads(row["pseudo_bev"]),
        "bev_after_voronoi": json.loads(row["bev_after_voronoi"]),
        "bev_after_conv": json.loads(row["bev_after_conv"]),
        "point_cloud": json.loads(row["point_cloud"]),
    }

class ConfigRequest(BaseModel):
    voxel_size: float = 0.25
    point_cloud_range: List[float] = [-40.0, -40.0, -2.0, 40.0, 40.0, 4.0]
    voxel_shape: List[int] = [320, 320, 24]
    coords_norm: List[float] = [160.0, 160.0, 8.0]
    voronoi_max_distance: int = 100
    conv_kernel_size: int = 8
    use_cuda: bool = True
    cuda_device: str = "cuda:0"
    filter_percentage: float = 0.05
    label_weighting: Optional[str] = None
    distance_metric: str = 'euclidean'

class ProcessRequest(BaseModel):
    file_path: str
    config: ConfigRequest
    save_output: bool = False

class SettingsUpdate(BaseModel):
    base_dir: str
    output_base_dir: str
    config_path: str
    dataset_type: str = "semantic_kitti"  # "semantic_kitti" | "semanticposs"

@app.on_event("startup")
async def startup_event():
    init_db()

@app.get("/api/settings")
async def get_settings():
    return {
        "base_dir": app_settings.base_dir,
        "output_base_dir": app_settings.output_base_dir,
        "config_path": app_settings.config_path,
        "dataset_type": app_settings.dataset_type,
    }

@app.post("/api/settings")
async def update_settings(settings: SettingsUpdate):
    app_settings.base_dir = settings.base_dir
    app_settings.output_base_dir = settings.output_base_dir
    if hasattr(settings, "dataset_type") and settings.dataset_type in ("semantic_kitti", "semanticposs"):
        app_settings.dataset_type = settings.dataset_type
    if getattr(settings, "config_path", None) and os.path.exists(settings.config_path) and settings.config_path != app_settings.config_path:
        app_settings.config_path = settings.config_path
    return {"status": "success"}

def _semanticposs_seq_root():
    """SemanticPOSS 序列根目录：若 base_dir 已以 /sequences 结尾则直接用，否则 base_dir/sequences。"""
    base_dir = app_settings.base_dir.rstrip("/")
    if base_dir.endswith("sequences"):
        return base_dir
    return os.path.join(base_dir, "sequences")

@app.get("/api/sequences")
async def get_sequences():
    base_dir = app_settings.base_dir
    if not os.path.exists(base_dir):
        return {"sequences": []}
    if app_settings.dataset_type == "semanticposs":
        seq_root = _semanticposs_seq_root()
        if not os.path.isdir(seq_root):
            return {"sequences": []}
        seqs = [d for d in os.listdir(seq_root) if os.path.isdir(os.path.join(seq_root, d))]
        return {"sequences": sorted(seqs)}
    seqs = [d for d in os.listdir(base_dir) if os.path.isdir(os.path.join(base_dir, d))]
    return {"sequences": sorted(seqs)}

@app.get("/api/sequences/{seq_id}/files")
async def get_files(seq_id: str):
    base_dir = app_settings.base_dir.rstrip("/")
    if app_settings.dataset_type == "semanticposs":
        seq_root = _semanticposs_seq_root()
        velo_dir = os.path.join(seq_root, seq_id, "velodyne")
        if not os.path.isdir(velo_dir):
            raise HTTPException(status_code=404, detail="Sequence not found")
        files = [f for f in os.listdir(velo_dir) if f.endswith(".bin")]
        files = sorted(files)[:100]
        return {"files": files, "dir": velo_dir}
    seq_dir = os.path.join(app_settings.base_dir, seq_id)
    if not os.path.exists(seq_dir):
        raise HTTPException(status_code=404, detail="Sequence not found")
    files = [f for f in os.listdir(seq_dir) if f.endswith(".ply") or f.endswith(".bin")]
    files = sorted(files)[:100]
    return {"files": files, "dir": seq_dir}


@app.get("/api/visualizations")
async def get_visualizations_list():
    """List all saved visualizations (id, label, created_at) for the UI list."""
    return {"items": list_visualizations()}


@app.get("/api/visualizations/{run_id}")
async def get_visualization_by_id(run_id: int):
    """Get full visualization data by run id (for BEV/3D display)."""
    row = get_visualization(run_id)
    if not row:
        raise HTTPException(status_code=404, detail="Visualization not found")
    return {
        "id": row["id"],
        "label": row["label"],
        "created_at": row["created_at"],
        "config": row["config"],
        "pseudo_bev": row["pseudo_bev"],
        "bev_after_voronoi": row["bev_after_voronoi"],
        "bev_after_conv": row["bev_after_conv"],
        "point_cloud": row["point_cloud"],
    }

def encode_bev(bev_array):
    return bev_array.tolist()

def extract_point_cloud(voxel_grid):
    nonzero = np.nonzero(voxel_grid)
    labels = voxel_grid[nonzero]
    points = np.column_stack((nonzero[0], nonzero[1], nonzero[2], labels))
    max_points = 200000
    if len(points) > max_points:
        indices = np.random.choice(len(points), max_points, replace=False)
        points = points[indices]
    return points.tolist()

def _output_paths(file_path: str, dataset_type: str):
    """Return (output_path, vis_path) for the given file and dataset type."""
    parts = file_path.replace("\\", "/").split("/")
    item = parts[-1]
    base_name = os.path.splitext(item)[0]
    if len(base_name) > 6:
        base_name = base_name[:6]
    seq = parts[-2] if len(parts) >= 2 else "00"
    if dataset_type == "semanticposs":
        for i, p in enumerate(parts):
            if p == "velodyne" and i > 0:
                seq = parts[i - 1]
                break
    output_dir = os.path.join(app_settings.output_base_dir, seq)
    v_dir = os.path.join(app_settings.output_base_dir, "bev_vis", seq)
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(v_dir, exist_ok=True)
    return os.path.join(output_dir, base_name + ".label"), os.path.join(v_dir, base_name + ".png")


@app.post("/api/process")
async def process_file(request: ProcessRequest):
    if app_settings.dataset_type == "semanticposs" and request.file_path.rstrip("/").endswith(".ply"):
        raise HTTPException(
            status_code=400,
            detail="SemanticPOSS uses .bin point clouds, not .ply. Switch to SemanticPOSS dataset and reselect a .bin file.",
        )
    if not os.path.exists(request.file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {request.file_path}")

    try:
        output_path, vis_path = (None, None)
        if request.save_output:
            output_path, vis_path = _output_paths(request.file_path, app_settings.dataset_type)

        config_dict = request.config.model_dump() if hasattr(request.config, "model_dump") else request.config.dict()
        result = unified_process_one(
            request.file_path,
            app_settings.dataset_type,
            config_dict,
            config_path=app_settings.config_path,
            output_path=output_path,
            vis_path=vis_path,
        )
        pseudo_bev = encode_bev(result["pseudo_bev"])
        bev_after_voronoi = encode_bev(result["bev_after_voronoi"])
        bev_after_conv = encode_bev(result["bev_after_conv"])
        point_cloud = extract_point_cloud(result["pseudo_voxel"])
        input_point_cloud = result.get("input_point_cloud", [])

        label = f"{request.file_path.split('/')[-2]}/{request.file_path.split('/')[-1]}"
        run_id = save_visualization(
            request.file_path, label, config_dict,
            pseudo_bev, bev_after_voronoi, bev_after_conv, point_cloud,
        )
        return {
            "id": run_id,
            "pseudo_bev": pseudo_bev,
            "bev_after_voronoi": bev_after_voronoi,
            "bev_after_conv": bev_after_conv,
            "point_cloud": point_cloud,
            "input_point_cloud": input_point_cloud,
            "saved": request.save_output,
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

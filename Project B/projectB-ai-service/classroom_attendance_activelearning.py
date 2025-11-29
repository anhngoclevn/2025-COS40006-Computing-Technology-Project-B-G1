# -*- coding: utf-8 -*-
"""
Merged Attendance + Active Learning (ALS) Demo
Torch-only (no ONNXRuntime) • Stable tracking • Per-ID ALS
- Person detector: YOLOv8 (Ultralytics, GPU/FP16)
- Behavior detector: YOLOv8 multi-class (GPU/FP16) + per-class thresholds
- Tracking: ByteTrack (via supervision) => no flicker
- Face engine: facenet-pytorch (MTCNN + InceptionResnetV1) on GPU
- Gallery matching: cosine, adaptive threshold vs blur/size
- ALS per ID: Σ w_k·p_k (time-weighted, stable labels only)
- Attendance: enter/exit intervals + summary CSV
- Outputs:
    • Annotated MP4 (optional)
    • Raw & stable CSVs
    • ALS JSONs
    • 🔴 Violations videos (cropped, zoomed on student) + violations.csv

Tested with:
  python 3.10  • torch 2.2+cu121 • torchvision 0.17+
  ultralytics 8.3.199 • supervision >=0.22.0
  facenet-pytorch >= 2.5.3 • scikit-learn >=1.4
"""

import os, cv2, csv, time, json, argparse, warnings, glob, math, datetime as dt
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Dict, List, Tuple, Optional, Iterable
warnings.filterwarnings("ignore", message=".*weights_only=False.*")
from pathlib import Path
import numpy as np
import torch
from ultralytics import YOLO
import supervision as sv
from sklearn.metrics.pairwise import cosine_similarity

warnings.filterwarnings("ignore", category=UserWarning)

# =============================== BEHAVIOR CONFIG ============================= #

BEHAVIOR_CLASSES = [
    "Using_phone","bend","book","bow_head","hand-raising","phone",
    "raise_head","reading","sleep","turn_head","upright","writing"
]

# Per-class thresholds (can be overridden via --thresholds_json)
DEFAULT_THRESHOLDS = {
    "Using_phone": 0.15,        # ↓ lower → detect phone reliably
    "phone": 0.18,              # ↓ lower → phone is small object

    "bend": 0.35,
    "book": 0.25,
    "bow_head": 0.18,

    "hand-raising": 0.45,
    "raise_head": 0.40,
    "reading": 0.30,            # ↓ reduce false negatives

    "sleep": 0.30,
    "turn_head": 0.30,
    "upright": 0.48,
    "writing": 0.60              # ↓ slightly to catch low-conf writing
}

# Behavior box minimum relative area (b/p) for some classes
MIN_REL_AREA = {
    "phone": 0.006, "Using_phone": 0.006,
    "book": 0.008, "writing": 0.008, "reading": 0.008,
}
REL_MIN_DEFAULT = 0.004

# ALS weights (Sheng et al. 2025): Σ w_k * p_k
BEHAVIOR_WEIGHTS = {
    "hand-raising": +2.0, "writing": +1.5, "reading": +1.0, "upright": +0.5,
    "raise_head": +0.3, "turn_head": 0.0, "book": 0.0,
    "bow_head": -0.2, "bend": -0.5, "phone": -2.0, "Using_phone": -2.0, "sleep": -3.0
}

# =============================== ATTENDANCE CONFIG ========================== #

PERSON_CLASS_ID = 0
SIM_THRESHOLD_DEFAULT = 0.65        # base cosine threshold
MIN_FACE_PX = 60                      # min face box size
MIN_FACE_VAR = 80.0                   # min Laplacian variance (sharpness)
FACE_EVERY_N = 2                      # run face pipeline every N processed frames

# Tracking / timing
TRACK_ACTIVATION_THRESHOLD = 0.25
MIN_MATCHING_THRESHOLD = 0.80
LOST_TRACK_BUFFER = 40
FPS_FALLBACK = 25
GRACE_SECONDS_DEFAULT = 30            # attendance off-tracking grace

# =============================== UTILS ====================================== #

def ensure_dir(p: str): os.makedirs(p, exist_ok=True)

def now_iso():
    return dt.datetime.now().replace(microsecond=0).isoformat()

def sec_to_hms(s: float) -> str:
    s = int(max(0, s)); h = s // 3600; m = (s % 3600) // 60; s2 = s % 60
    return f"{h:02d}:{m:02d}:{s2:02d}"

def iou(a: np.ndarray, b: np.ndarray) -> float:
    x1 = max(a[0], b[0]); y1 = max(a[1], b[1])
    x2 = min(a[2], b[2]); y2 = min(a[3], b[3])
    iw = max(0.0, x2 - x1); ih = max(0.0, y2 - y1)
    inter = iw * ih
    if inter <= 0: return 0.0
    area_a = (a[2]-a[0]) * (a[3]-a[1])
    area_b = (b[2]-b[0]) * (b[3]-b[1])
    return inter / (area_a + area_b - inter + 1e-6)

def ioa(a: np.ndarray, b: np.ndarray) -> float:
    x1 = max(a[0], b[0]); y1 = max(a[1], b[1])
    x2 = min(a[2], b[2]); y2 = min(a[3], b[3])
    iw = max(0.0, x2 - x1); ih = max(0.0, y2 - y1)
    inter = iw * ih; area_b = max(1e-6, (b[2]-b[0]) * (b[3]-b[1]))
    return inter / area_b

def contains(a: np.ndarray, b: np.ndarray) -> bool:
    return (a[0] <= b[0] and a[1] <= b[1] and a[2] >= b[2] and a[3] >= b[3])

def box_area(b: np.ndarray) -> float:
    return max(0.0, (b[2]-b[0])) * max(0.0, (b[3]-b[1]))

def pick_device(requested: str) -> str:
    if requested == "cpu": return "cpu"
    if requested == "cuda": return "cuda" if torch.cuda.is_available() else "cpu"
    return "cuda" if torch.cuda.is_available() else "cpu"

def draw_label(img, text, x1, y1, fg=(0,255,255), bg=(0,0,0)):
    font = cv2.FONT_HERSHEY_SIMPLEX; scale = 0.5; thickness = 1
    (tw, th), _ = cv2.getTextSize(text, font, scale, thickness)
    pad = 2; y1 = max(0, y1 - 5)
    cv2.rectangle(img, (x1, y1 - th - 2*pad), (x1 + tw + 2*pad, y1), bg, -1)
    cv2.putText(img, text, (x1 + pad, y1 - pad), font, scale, fg, thickness, cv2.LINE_AA)

def bbox_iou_xyxy(a: np.ndarray, b: np.ndarray) -> float:
    xA = max(a[0], b[0]); yA = max(a[1], b[1])
    xB = min(a[2], b[2]); yB = min(a[3], b[3])
    inter = max(0, xB-xA) * max(0, yB-yA)
    if inter <= 0: return 0.0
    areaA = max(0, a[2]-a[0]) * max(0, a[3]-a[1])
    areaB = max(0, b[2]-b[0]) * max(0, b[3]-b[1])
    return inter / max(1e-6, (areaA + areaB - inter))

def crop_bbox(img: np.ndarray, box_xyxy) -> Optional[np.ndarray]:
    h, w = img.shape[:2]
    x1, y1, x2, y2 = [int(v) for v in box_xyxy]
    x1 = max(0, min(x1, w-1)); x2 = max(0, min(x2, w-1))
    y1 = max(0, min(y1, h-1)); y2 = max(0, min(y2, h-1))
    if x2 <= x1 or y2 <= y1: return None
    return img[y1:y2, x1:x2]

def lap_var(gray: np.ndarray) -> float:
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())

def expand_box(box: np.ndarray, scale: float, W: int, H: int) -> np.ndarray:
    """Zoom box around center by scale, clamp to image size."""
    x1, y1, x2, y2 = box.astype(float)
    cx = (x1 + x2) / 2.0
    cy = (y1 + y2) / 2.0
    w = (x2 - x1) * scale
    h = (y2 - y1) * scale
    nx1 = max(0, cx - w/2.0)
    ny1 = max(0, cy - h/2.0)
    nx2 = min(W-1, cx + w/2.0)
    ny2 = min(H-1, cy + h/2.0)
    return np.array([nx1, ny1, nx2, ny2], dtype=float)

# =============================== FACE ENGINE (TORCH) ======================== #

class FaceEngineTorch:
    """
    Pure Torch face pipeline using facenet-pytorch:
      - Detector: MTCNN (GPU)
      - Embedder: InceptionResnetV1 (GPU)
    Auto-downloads weights on first use (Torch Hub cache).
    """
    def __init__(self, device: str = "cuda"):
        self.device = "cuda" if (device == "cuda" and torch.cuda.is_available()) else "cpu"
        from facenet_pytorch import MTCNN, InceptionResnetV1

        self.mtcnn = MTCNN(image_size=160, margin=10, keep_all=True, post_process=True, device=self.device)
        self.embedder = InceptionResnetV1(pretrained='vggface2').eval().to(self.device)
        print(f"[FaceEngineTorch] MTCNN + InceptionResnetV1 on {self.device}")

    def detect_and_embed(self, frame_bgr: np.ndarray) -> List[Dict]:
        # BGR -> RGB
        img = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        boxes, probs = self.mtcnn.detect(img)
        out = []
        if boxes is None: return out

        faces_crops = []
        valid_idx = []
        H, W = img.shape[:2]
        for i, (box, p) in enumerate(zip(boxes, probs)):
            if p is None or p < 0.90:  # stricter face confidence
                continue
            x1, y1, x2, y2 = [int(max(0, v)) for v in box]
            x1 = min(x1, W-1); x2 = min(x2, W-1); y1 = min(y1, H-1); y2 = min(y2, H-1)
            if x2 <= x1 or y2 <= y1: continue
            crop = img[y1:y2, x1:x2, :]
            if crop.size == 0: continue
            gray = cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY)
            blur = lap_var(gray)
            if (min(x2-x1, y2-y1) < MIN_FACE_PX) or (blur < MIN_FACE_VAR):
                continue
            faces_crops.append(cv2.resize(crop, (160,160)))
            valid_idx.append((x1,y1,x2,y2,blur))

        if not faces_crops: return out

        tens = torch.tensor(np.stack(faces_crops)).permute(0,3,1,2).float() / 255.0
        tens = (tens - 0.5) / 0.5
        tens = tens.to(self.device)

        with torch.no_grad():
            embs = self.embedder(tens).cpu().numpy()

        # L2 normalize
        embs = embs / np.clip(np.linalg.norm(embs, axis=1, keepdims=True), 1e-9, None)

        for (x1,y1,x2,y2,blur), e in zip(valid_idx, embs):
            out.append({
                "bbox": [int(x1), int(y1), int(x2), int(y2)],
                "emb": e.astype(np.float32),
                "size": min(x2-x1, y2-y1),
                "blur": float(blur),
            })
        return out

# =============================== APPEARANCE (ReID-lite) ===================== #

class AppearanceEncoder:
    def __init__(self, device: str):
        self.enabled = True
        from torchvision import models, transforms
        self.device = device
        self.transforms = transforms.Compose([
            transforms.ToPILImage(),
            transforms.Resize((256, 128)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485,0.456,0.406], std=[0.229,0.224,0.225]),
        ])
        backbone = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V2)
        backbone.fc = torch.nn.Identity(); backbone.eval()
        if device.startswith('cuda'): backbone.to(device)
        self.backbone = backbone
        print("[Appearance] ResNet50 encoder loaded")

    def embed(self, bgr: np.ndarray) -> Optional[np.ndarray]:
        if bgr is None: return None
        import torchvision
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        tens = self.transforms(rgb).unsqueeze(0)
        if self.device.startswith('cuda'): tens = tens.to(self.device)
        with torch.no_grad():
            feat = self.backbone(tens)
        v = feat.detach().cpu().numpy().reshape(-1)
        v = v / max(1e-9, np.linalg.norm(v))
        return v.astype(np.float32)

# =============================== GALLERY ==================================== #

class StudentGallery:
    """
    students/<ID>/*.jpg
    Uses FaceEngineTorch embeddings to build ID templates.
    """
    def __init__(self, face_engine: FaceEngineTorch, students_dir: str, appearance: Optional['AppearanceEncoder']=None):
        self.face_engine = face_engine
        self.students_dir = students_dir
        self.appearance = appearance
        self.face_embs: Dict[str, np.ndarray] = {}
        self.appear_embs: Dict[str, np.ndarray] = {}
        self.load()

    def load(self):
        self.face_embs.clear(); self.appear_embs.clear()
        subdirs = [d for d in glob.glob(os.path.join(self.students_dir, '*')) if os.path.isdir(d)]
        if not subdirs:
            print(f"[Gallery] No student folders in {self.students_dir}")
        for d in sorted(subdirs):
            sid = os.path.basename(d).strip()
            face_vecs, face_weights, app_vecs = [], [], []
            for p in glob.glob(os.path.join(d, '*')):
                img = cv2.imread(p)
                if img is None: continue
                faces = self.face_engine.detect_and_embed(img)
                if faces:
                    f = max(faces, key=lambda x: (x["size"], x["blur"]))
                    face_vecs.append(f["emb"]); face_weights.append(max(1.0, f["blur"]))
                if self.appearance:
                    app = self.appearance.embed(img)
                    if app is not None: app_vecs.append(app)
            if face_vecs:
                w = np.array(face_weights) / max(1e-9, sum(face_weights))
                mean_face = np.average(np.stack(face_vecs, axis=0), axis=0, weights=w)
                mean_face /= max(1e-9, np.linalg.norm(mean_face))
                self.face_embs[sid] = mean_face.astype(np.float32)
            if app_vecs:
                mean_app = np.mean(np.stack(app_vecs, axis=0), axis=0)
                mean_app = mean_app / max(1e-9, np.linalg.norm(mean_app))
                self.appear_embs[sid] = mean_app.astype(np.float32)
            if face_vecs or app_vecs:
                print(f"[Gallery] {sid}: faces={len(face_vecs)} appearance={len(app_vecs)}")
        if not self.face_embs:
            print("[Gallery] WARNING: empty face gallery — using Tracker IDs as provisional IDs")

    def face_match(self, emb: np.ndarray, sim_thr: float) -> Optional[Tuple[str, float]]:
        if not self.face_embs: return None
        keys = list(self.face_embs.keys())
        mats = np.stack([self.face_embs[k] for k in keys], axis=0)
        sims = cosine_similarity(emb.reshape(1,-1), mats).flatten()
        bi = int(np.argmax(sims))
        if float(sims[bi]) >= sim_thr:
            return keys[bi], float(sims[bi])
        return None

# =============================== ATTENDANCE BOOK ============================ #

class AttendanceBook:
    def __init__(self, grace_seconds: int, events_path: str):
        self.grace = grace_seconds
        self.live: Dict[str, Dict] = {}
        self.intervals: Dict[str, List[Tuple[float, float]]] = defaultdict(list)
        self.events_path = events_path
        ensure_dir(os.path.dirname(events_path))
        if not os.path.exists(events_path):
            with open(events_path, 'w', newline='', encoding='utf-8') as f:
                csv.writer(f).writerow(["student_id", "enter_iso", "exit_iso", "duration_sec"])

    def _flush(self, sid: str, start: float, end: float):
        self.intervals[sid].append((start, end))
        with open(self.events_path, 'a', newline='', encoding='utf-8') as f:
            enter_iso = dt.datetime.fromtimestamp(start).isoformat(timespec='seconds')
            exit_iso  = dt.datetime.fromtimestamp(end).isoformat(timespec='seconds')
            csv.writer(f).writerow([sid, enter_iso, exit_iso, round(max(0, end-start), 2)])

    def mark_seen(self, sid: str, t: float):
        if sid not in self.live: self.live[sid] = {"start": t, "last": t}
        else: self.live[sid]["last"] = t

    def tick(self, t: float):
        to_close = []
        for sid, rec in self.live.items():
            if (t - rec["last"]) > self.grace:
                to_close.append(sid)
        for sid in to_close:
            self._flush(sid, self.live[sid]["start"], self.live[sid]["last"])
            del self.live[sid]

    def close_all(self):
        t = time.time()
        for sid, rec in list(self.live.items()):
            self._flush(sid, rec['start'], rec['last'])
            del self.live[sid]

    def write_summary(self, path: str):
        ensure_dir(os.path.dirname(path))
        with open(path, 'w', newline='', encoding='utf-8') as f:
            w = csv.writer(f)
            w.writerow(["student_id", "total_duration_sec", "total_duration_hms", "intervals"])
            for sid, segs in self.intervals.items():
                total = sum(max(0, b-a) for a, b in segs)
                w.writerow([sid, round(total, 2), sec_to_hms(total), len(segs)])

# =============================== BEHAVIOR MODELS ============================ #

class PersonDetector:
    def __init__(self, model_path: str, conf: float, device: str, half: bool, imgsz: int, tta: bool):
        self.model = YOLO(model_path); self.conf = conf
        self.device = device; self.half = half and (device == "cuda")
        self.imgsz = int(imgsz); self.augment = bool(tta)
        self.box_annotator = sv.BoxAnnotator()

    def step(self, frame: np.ndarray) -> sv.Detections:
        r = self.model.predict(frame, conf=self.conf, device=self.device,
                               classes=[0], half=self.half, imgsz=self.imgsz,
                               verbose=False, augment=self.augment)[0]
        if r.boxes is None or len(r.boxes) == 0:
            return sv.Detections.empty()
        return sv.Detections(
            xyxy=r.boxes.xyxy.cpu().numpy(),
            confidence=r.boxes.conf.cpu().numpy(),
            class_id=r.boxes.cls.cpu().numpy().astype(int)
        )

class BehaviorDetector:
    def __init__(self, model_path: str, conf_floor: float, device: str, half: bool, imgsz: int,
                 per_class_conf: Dict[str, float], tta: bool):
        self.model = YOLO(model_path)
        self.device = device; self.half = half and (device == "cuda")
        self.imgsz = int(imgsz); self.augment = bool(tta)
        self.idx2name = (self.model.names if isinstance(self.model.names, dict)
                         else {i: n for i, n in enumerate(self.model.names)})
        self.per_class_conf = per_class_conf or {}; self.conf_floor = conf_floor

    def _th_for_idx(self, cls_idx: int) -> float:
        label = self.idx2name.get(cls_idx)
        if label and label in self.per_class_conf:
            return float(self.per_class_conf[label])
        return float(self.conf_floor)

    def step(self, frame: np.ndarray) -> sv.Detections:
        r = self.model.predict(frame, conf=0.05, device=self.device, half=self.half,
                               imgsz=self.imgsz, verbose=False, augment=self.augment)[0]
        if r.boxes is None or len(r.boxes) == 0:
            return sv.Detections.empty()
        xyxy = r.boxes.xyxy.cpu().numpy()
        conf = r.boxes.conf.cpu().numpy()
        cls  = r.boxes.cls.cpu().numpy().astype(int)
        keep = [i for i in range(len(cls)) if conf[i] >= self._th_for_idx(cls[i])]
        if not keep: return sv.Detections.empty()
        keep = np.array(keep, dtype=int)
        return sv.Detections(xyxy=xyxy[keep], confidence=conf[keep], class_id=cls[keep])

# =============================== PER-TRACK SMOOTHER ========================= #

class TrackLabelSmoother:
    """
    Per-track temporal smoothing with EMA + hysteresis.
    Keeps an EMA per (track_id, label). Outputs stable labels per track.
    """
    def __init__(self, window:int=7, th_on:float=0.60, th_off:float=0.45):
        self.alpha = 2.0 / (max(1, window) + 1.0)
        self.th_on = float(th_on); self.th_off = float(th_off)
        self.ema: Dict[Tuple[int, str], float] = defaultdict(float)
        self.state: Dict[Tuple[int, str], bool] = defaultdict(bool)

    def update(self, track_labels_conf: Dict[int, List[Tuple[str, float]]]) -> Dict[int, List[str]]:
        # choose max conf per label per track for this frame
        per_track_best: Dict[int, Dict[str, float]] = defaultdict(lambda: defaultdict(float))
        for tid, lst in track_labels_conf.items():
            for lbl, conf in lst:
                if conf > per_track_best[tid][lbl]:
                    per_track_best[tid][lbl] = conf

        stable_out: Dict[int, List[str]] = defaultdict(list)
        for tid, d in per_track_best.items():
            for lbl in BEHAVIOR_CLASSES:
                c = d.get(lbl, 0.0)
                key = (tid, lbl)
                prev = self.ema.get(key, 0.0)
                ema = prev + self.alpha * (c - prev)
                self.ema[key] = ema
                st = self.state.get(key, False)
                if not st and ema >= self.th_on:
                    st = True
                elif st and ema < self.th_off:
                    st = False
                self.state[key] = st
                if st: stable_out[tid].append(lbl)
        return stable_out

# =============================== ALS AGGREGATOR ============================= #

class ALSAggregator:
    """
    Maintains per-student, per-class durations (seconds) and computes:
    ALS_student = Σ_k w_k * p_k, where p_k = duration_k / total_duration_with_any_label
    """
    def __init__(self, weights: Dict[str, float]):
        self.weights = weights
        self.per_student_secs: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))
        self.global_secs: Dict[str, float] = defaultdict(float)

    def add_frame_labels(self, fps: float, stride: int, labels_per_student: Dict[str, List[str]]):
        dt = (stride / max(1.0, fps))
        for sid, labels in labels_per_student.items():
            if not labels: continue
            share = dt / len(labels)
            for lbl in labels:
                self.per_student_secs[sid][lbl] += share
                self.global_secs[lbl] += share

    def _score_from_secs(self, secs: Dict[str, float]) -> Tuple[float, Dict[str, float]]:
        total = sum(secs.values())
        if total <= 0: return 0.0, {}
        props = {k: v/total for k, v in secs.items()}
        raw = sum(self.weights.get(k, 0.0)*p for k, p in props.items())
        # Normalize ~(-3..+3) -> 0..100
        score = max(0.0, min(100.0, (raw + 3.0)/6.0*100.0))
        return round(score, 2), props

    def get_global(self) -> Tuple[float, Dict[str, float]]:
        return self._score_from_secs(self.global_secs)

    def get_per_student(self) -> Dict[str, Dict]:
        out = {}
        for sid, secs in self.per_student_secs.items():
            score, props = self._score_from_secs(secs)
            out[sid] = {"ALS": score, "proportions": props, "seconds": secs}
        return out

# =============================== MERGED PIPELINE ============================ #

@dataclass
class PipelineConfig:
    # Behavior
    person_model_path: str = "yolov8n.pt"
    behavior_model_path: str = "student_behaviour_best.pt"
    conf_person: float = 0.35
    conf_behavior_floor: float = 0.35
    device: str = "auto"   # auto|cpu|cuda
    half: bool = True
    imgsz: int = 640
    frame_stride: int = 2
    show_window: bool = True
    output_dir: str = "outputs"
    smooth_window: int = 7
    th_on: float = 0.60
    th_off: float = 0.45
    ioa_min: float = 0.60
    iou_min: float = 0.05
    rel_min_default: float = REL_MIN_DEFAULT
    tta: bool = False
    per_class_conf: Dict[str, float] = field(default_factory=dict)

    # Attendance / Face ID
    students_dir: str = "students"
    sim_threshold: float = SIM_THRESHOLD_DEFAULT
    min_face_px: int = MIN_FACE_PX
    min_face_var: float = MIN_FACE_VAR
    face_every_n: int = FACE_EVERY_N
    appearance: bool = True
    grace: int = GRACE_SECONDS_DEFAULT
    save_video: str = ""  # outputs/merged_annot.mp4

    # 🔴 Violation / low-active video config
    violation_labels: List[str] = field(default_factory=lambda: ["sleep", "phone", "Using_phone", "bend", "bow_head"])
    violation_min_frames: int = 5      # tối thiểu số frame liên tiếp để ghi thành 1 lần vi phạm
    violation_zoom_scale: float = 1.4    # zoom vào học sinh vi phạm
    violation_frame_size: Tuple[int, int] = (480, 480)  # size video crop (w,h)

class MergedPipeline:
    def __init__(self, cfg: PipelineConfig):
        self.cfg = cfg

        # Create unique subfolder per run
        base_name = Path(cfg.save_video).stem if cfg.save_video else Path(cfg.behavior_model_path).stem
        timestamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
        run_name = f"{base_name}_{timestamp}"
        self.run_dir = os.path.join(cfg.output_dir, run_name)
        ensure_dir(self.run_dir)
        print(f"[Session] Run directory: {self.run_dir}")

        # device / precision
        self.device = pick_device(cfg.device)
        self.fp16 = (self.device == "cuda") and bool(cfg.half)
        print(f"[INFO] Device: {self.device} | FP16: {self.fp16} | imgsz: {cfg.imgsz} | stride: {cfg.frame_stride}")

        torch.backends.cudnn.benchmark = True

        # thresholds
        per = DEFAULT_THRESHOLDS.copy()
        per.update(cfg.per_class_conf or {})
        self.per_class_conf = per

        # models
        self.person = PersonDetector(cfg.person_model_path, cfg.conf_person,
                                     self.device, self.fp16, cfg.imgsz, cfg.tta)
        self.behavior = BehaviorDetector(cfg.behavior_model_path, cfg.conf_behavior_floor,
                                         self.device, self.fp16, cfg.imgsz, self.per_class_conf, cfg.tta)

        # tracker
        self.tracker = sv.ByteTrack(
            track_activation_threshold=TRACK_ACTIVATION_THRESHOLD,
            minimum_matching_threshold=MIN_MATCHING_THRESHOLD,
            lost_track_buffer=LOST_TRACK_BUFFER,
            frame_rate=FPS_FALLBACK
        )

        # face & appearance (Torch-based)
        self.face = FaceEngineTorch(device=self.device)
        self.appear = AppearanceEncoder(device=("cuda:0" if self.device=="cuda" else "cpu")) if cfg.appearance else None
        self.gallery = StudentGallery(self.face, cfg.students_dir, appearance=self.appear)

        # attendance & ALS
        self.book = AttendanceBook(
            grace_seconds=cfg.grace,
            events_path=os.path.join(self.run_dir, "attendance_events.csv")
        )

        self.als = ALSAggregator(BEHAVIOR_WEIGHTS)

        # per-track smoother (less flicker)
        self.smoother = TrackLabelSmoother(cfg.smooth_window, cfg.th_on, cfg.th_off)

        # drawing
        self.box_annot = sv.BoxAnnotator()
        try:
            self.lbl_annot = sv.LabelAnnotator(text_scale=0.5, text_thickness=1)
        except Exception:
            from supervision.annotators import LabelAnnotator
            self.lbl_annot = LabelAnnotator(text_scale=0.5, text_thickness=1)

        # video writer (full annotated video)
        self.writer = None

        # CSV paths
        self.beh_csv_path        = os.path.join(self.run_dir, "behaviors_raw.csv")
        self.beh_stable_csv_path = os.path.join(self.run_dir, "behaviors_stable.csv")
        self.summary_csv_path    = os.path.join(self.run_dir, "attendance_summary.csv")

        # init CSVs
        self._init_csvs()

        # state
        self.frame_idx = -1
        self.last_tick = time.time()
        self.fps_for_dt = FPS_FALLBACK

        # 🔴 Violation state
        self.violation_dir = os.path.join(self.run_dir, "violations")
        ensure_dir(self.violation_dir)
        # key: (student_id, label) -> {"active": bool, "start_frame": int}
        self.violation_states: Dict[Tuple[str, str], Dict[str, Optional[int]]] = {}
        # key: (student_id, label) -> cv2.VideoWriter
        self.violation_writers: Dict[Tuple[str, str], cv2.VideoWriter] = {}
        # list of violation segments for CSV logging
        self.violation_records: List[Dict] = []

        # warmup
        if self.device == "cuda":
            dummy = np.zeros((cfg.imgsz, cfg.imgsz, 3), dtype=np.uint8)
            for _ in range(2):
                _ = self.person.model.predict(dummy, device="cuda", half=self.fp16, imgsz=cfg.imgsz, verbose=False)
                _ = self.behavior.model.predict(dummy, device="cuda", half=self.fp16, imgsz=cfg.imgsz, verbose=False)
            torch.cuda.synchronize()

    def _init_csvs(self):
        ensure_dir(self.run_dir)
        if not os.path.exists(self.beh_csv_path):
            with open(self.beh_csv_path, "w", newline="", encoding="utf-8") as f:
                csv.writer(f).writerow(["frame","track_id","student_id","label","confidence","x1","y1","x2","y2"])
        if not os.path.exists(self.beh_stable_csv_path):
            with open(self.beh_stable_csv_path, "w", newline="", encoding="utf-8") as f:
                csv.writer(f).writerow(["frame","track_id","student_id","stable_label"])

    def _adaptive_sim_threshold(self, face_wh_min: int, blur_val: float) -> float:
        base = self.cfg.sim_threshold   # 0.65

        # Small faces in 720p → slight penalty only
        if face_wh_min < 80:
            base += 0.01

        # Slightly blurry → tiny penalty
        if blur_val < 80:
            base += 0.01

        # final threshold stays close to base (0.65 → 0.66–0.67)
        return float(np.clip(base, self.cfg.sim_threshold, 0.90))
    

    def _open_writer(self, w: int, h: int, fps: float, stem: str):
        if not self.cfg.save_video: return
        # Use H.264 codec for browser compatibility
        fourcc = cv2.VideoWriter_fourcc(*"avc1")
        base = Path(self.cfg.save_video).stem or "annotated"
        out_path = os.path.join(self.run_dir, f"{base}.mp4")
        self.writer = cv2.VideoWriter(out_path, fourcc, fps, (w, h))
        print(f"[Video] Recording to {out_path} (H.264 codec)")

    # ======== VIOLATION VIDEO HELPERS ======================================= #

    def _get_violation_writer(self, sid: str, label: str, fps: float) -> cv2.VideoWriter:
        key = (sid, label)
        if key in self.violation_writers:
            return self.violation_writers[key]
        # Use H.264 codec for browser compatibility
        fourcc = cv2.VideoWriter_fourcc(*"avc1")
        w, h = self.cfg.violation_frame_size
        out_path = os.path.join(self.violation_dir, f"{sid}_{label}.mp4")
        writer = cv2.VideoWriter(out_path, fourcc, fps, (w, h))
        self.violation_writers[key] = writer
        print(f"[Violation] Recording {label} for {sid} -> {out_path} (H.264 codec)")
        return writer

    def _record_violation_frame(self, frame: np.ndarray,
                                sid: str,
                                label: str,
                                track_box: np.ndarray,
                                fps: float):
        H, W = frame.shape[:2]
        # zoom box
        zoom_box = expand_box(track_box, self.cfg.violation_zoom_scale, W, H)
        crop = crop_bbox(frame, zoom_box)
        if crop is None or crop.size == 0:
            return
        target_w, target_h = self.cfg.violation_frame_size
        crop_resized = cv2.resize(crop, (target_w, target_h))
        # overlay info (student, label, timestamp)
        t_sec = self.frame_idx / max(1.0, fps)
        cv2.putText(crop_resized, f"{sid} | {label}", (10, 24),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,255), 2, cv2.LINE_AA)
        cv2.putText(crop_resized, f"t={t_sec:6.1f}s", (10, 50),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,255), 2, cv2.LINE_AA)
        writer = self._get_violation_writer(sid, label, fps)
        writer.write(crop_resized)

    def _update_violation_state(self,
                                stable_per_track: Dict[int, List[str]],
                                track_to_sid: Dict[int, str]):
        """
        Cập nhật trạng thái vi phạm (bắt đầu/kết thúc) dựa trên stable_per_track.
        Lưu lại start/end frame vào self.violation_records.
        """
        current_frame = self.frame_idx
        fps = self.fps_for_dt
        for tid, labels in stable_per_track.items():
            sid = track_to_sid.get(tid, f"Track#{tid}")
            for label in self.cfg.violation_labels:
                key = (sid, label)
                has_violation = (label in labels)
                state = self.violation_states.get(key, {"active": False, "start_frame": None})
                active = state["active"]
                start_frame = state["start_frame"]

                # Bắt đầu vi phạm
                if has_violation and not active:
                    state["active"] = True
                    state["start_frame"] = current_frame
                # Kết thúc vi phạm
                elif (not has_violation) and active:
                    dur_frames = current_frame - (start_frame or current_frame)
                    if dur_frames >= self.cfg.violation_min_frames:
                        start_sec = (start_frame or current_frame) / max(1.0, fps)
                        end_sec = current_frame / max(1.0, fps)
                        rel_video = f"{sid}_{label}.mp4"
                        self.violation_records.append({
                            "student_id": sid,
                            "label": label,
                            "start_frame": start_frame,
                            "end_frame": current_frame,
                            "start_sec": round(start_sec, 2),
                            "end_sec": round(end_sec, 2),
                            "video_file": rel_video
                        })
                    state["active"] = False
                    state["start_frame"] = None

                self.violation_states[key] = state

    # ======================================================================== #

    def run(self, source: str):
        cap = cv2.VideoCapture(0 if source.isdigit() else source)
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open source: {source}")
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 2)

        real_fps = cap.get(cv2.CAP_PROP_FPS)
        self.fps_for_dt = real_fps if real_fps and real_fps > 1 else FPS_FALLBACK
        W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        stem = f"session_{int(time.time())}"
        self._open_writer(W, H, self.fps_for_dt, stem)

        print("[INFO] Press 'q' to quit.")

        stride = max(1, self.cfg.frame_stride)
        while True:
            ok, frame = cap.read()
            if not ok: break
            self.frame_idx += 1

            # Skip compute on in-between frames, keep display responsive
            if (self.frame_idx % stride) != 0:
                if self.cfg.show_window:
                    cv2.imshow("Merged Pipeline", frame)
                    if cv2.waitKey(1) & 0xFF == ord('q'): break
                continue

            # 1) People detection -> tracking (ByteTrack)
            persons = self.person.step(frame)
            tracks = self.tracker.update_with_detections(persons)

            # 2) Behavior detection
            beh = self.behavior.step(frame)
            labels_raw = []
            if len(beh) > 0:
                idx2name = self.behavior.idx2name
                for cid, conf, box in zip(beh.class_id, beh.confidence, beh.xyxy):
                    cname = idx2name.get(int(cid), f"cls{int(cid)}")
                    labels_raw.append((cname, float(conf), box))

            # 3) Gate behavior boxes by person IoA/IoU + relative area
            gated = []
            if len(persons) > 0 and labels_raw:
                for cname, conf, b in labels_raw:
                    keep = False
                    min_rel = MIN_REL_AREA.get(cname, self.cfg.rel_min_default)
                    for p in persons.xyxy:
                        if (contains(p, b) or ioa(p, b) >= self.cfg.ioa_min or iou(p, b) >= self.cfg.iou_min):
                            if (box_area(b) / (box_area(p) + 1e-6)) >= min_rel:
                                keep = True; break
                    if keep: gated.append((cname, conf, b))
            else:
                gated = labels_raw

            # 4) Map behaviors to nearest track (IoU)
            track_labels: Dict[int, List[Tuple[str, float]]] = defaultdict(list)
            track_boxes: Dict[int, np.ndarray] = {}
            tr_ids = tracks.tracker_id.tolist() if hasattr(tracks.tracker_id, "tolist") else []
            if tr_ids and tracks.xyxy is not None:
                for i, tid in enumerate(tr_ids):
                    track_boxes[int(tid)] = tracks.xyxy[i].astype(float)
                for cname, conf, b in gated:
                    best_tid, best_iou = None, 0.0
                    for tid, tbox in track_boxes.items():
                        iou_v = iou(b, tbox)
                        if iou_v > best_iou:
                            best_iou = iou_v; best_tid = tid
                    if best_tid is not None and best_iou >= 0.1:
                        track_labels[best_tid].append((cname, conf))

            # 5) Face ID every N processed frames
            track_to_sid: Dict[int, str] = {}
            track_to_sim: Dict[int, float] = {}
            faces = []
            if (self.frame_idx // stride) % self.cfg.face_every_n == 0:
                faces = self.face.detect_and_embed(frame)

            # assign faces to tracks by IoU
            if tr_ids and tracks.xyxy is not None:
                for i, tid in enumerate(tr_ids):
                    tid = int(tid); tbox = tracks.xyxy[i].astype(int)
                    best_face, best_iou = None, 0.0
                    for f in faces:
                        ov = bbox_iou_xyxy(tbox, f['bbox'])
                        if ov > best_iou:
                            best_iou, best_face = ov, f
                    sid, sim = f"Track#{tid}", 0.0      # provisional ID always available
                    if best_face is not None:
                        fx1, fy1, fx2, fy2 = best_face["bbox"]
                        fmin = min(fx2-fx1, fy2-fy1)
                        blurv = best_face["blur"]
                        thr = self._adaptive_sim_threshold(fmin, blurv)
                        match = self.gallery.face_match(best_face["emb"], thr)
                        if match is not None:
                            sid, sim = match
                    track_to_sid[tid] = sid
                    track_to_sim[tid] = sim

            # 6) Per-track smoothing => stable labels per track
            stable_per_track = self.smoother.update(track_labels)

            # 7) Logging + ALS accumulation
            with open(self.beh_csv_path, "a", newline="", encoding="utf-8") as fraw:
                wraw = csv.writer(fraw)
                for cname, conf, b in gated:
                    x1,y1,x2,y2 = map(int, b.tolist())
                    best_tid, best = -1, 0.0
                    for tid, tbox in track_boxes.items():
                        s = iou(b, tbox)
                        if s > best: best, best_tid = s, tid
                    sid = track_to_sid.get(best_tid, f"Track#{best_tid}")
                    wraw.writerow([self.frame_idx, best_tid, sid, cname, f"{conf:.4f}", x1, y1, x2, y2])

            per_student_stable_labels: Dict[str, List[str]] = defaultdict(list)
            with open(self.beh_stable_csv_path, "a", newline="", encoding="utf-8") as fst:
                wst = csv.writer(fst)
                for tid, kept in stable_per_track.items():
                    if not kept: continue
                    sid = track_to_sid.get(tid, f"Track#{tid}")
                    for lbl in kept:
                        wst.writerow([self.frame_idx, tid, sid, lbl])
                    per_student_stable_labels[sid].extend(kept)

            self.als.add_frame_labels(self.fps_for_dt, stride, per_student_stable_labels)

            # 🔴 7b) Violation state update + recording cropped frames
            # - Update start/end timestamp per violation
            self._update_violation_state(stable_per_track, track_to_sid)
            # - For current frame, ghi frame crop cho các track đang vi phạm
            if tr_ids and tracks.xyxy is not None:
                for i, tid in enumerate(tr_ids):
                    tid = int(tid)
                    sid = track_to_sid.get(tid, f"Track#{tid}")
                    labels = stable_per_track.get(tid, [])
                    if not labels:
                        continue
                    track_box = tracks.xyxy[i].astype(float)
                    for label in self.cfg.violation_labels:
                        if label in labels:
                            self._record_violation_frame(frame, sid, label, track_box, self.fps_for_dt)

            # 8) Attendance (seen only for IDs we have)
            tnow = time.time()
            for tid, sid in track_to_sid.items():
                self.book.mark_seen(sid, tnow)
            if (tnow - self.last_tick) >= 1.0:
                self.book.tick(tnow)
                self.last_tick = tnow

            # 9) Draw overlays (tracks + labels)
            annotated = frame.copy()
            try:
                annotated = self.box_annot.annotate(annotated, tracks)
                labels = []
                for i, tid in enumerate(tr_ids):
                    tid = int(tid); sid = track_to_sid.get(tid, f"Track#{tid}")
                    sim = track_to_sim.get(tid, 0.0)
                    # Per-ID live ALS (optional quick peek)
                    id_als = self.als.get_per_student().get(sid, {}).get("ALS", None)
                    lab = f"{sid}"
                    if id_als is not None: lab += f" | ALS:{id_als:.0f}"
                    if sim > 0: lab += f" | sim:{sim:.2f}"
                    labels.append(lab)
                annotated = self.lbl_annot.annotate(annotated, tracks, labels=labels)
            except Exception:
                pass

            # quick HUD
            cv2.rectangle(annotated, (0,0), (640, 86), (0,0,0), -1)
            cv2.putText(annotated, f"Merged Pipeline | {now_iso()}",
                        (10,22), cv2.FONT_HERSHEY_SIMPLEX, 0.6,(255,255,255),1, cv2.LINE_AA)
            cv2.putText(annotated, f"Present: {len(self.book.live)}  Dev:{self.device}  FPS~{self.fps_for_dt:.1f}",
                        (10,48), cv2.FONT_HERSHEY_SIMPLEX, 0.55,(255,255,255),1, cv2.LINE_AA)
            cv2.putText(annotated, f"ALS per ID uses stable labels only (EMA+hysteresis)",
                        (10,72), cv2.FONT_HERSHEY_SIMPLEX, 0.5,(200,200,200),1, cv2.LINE_AA)

            if self.writer is not None:
                self.writer.write(annotated)
            if self.cfg.show_window:
                cv2.imshow("Merged Pipeline", annotated)
                if cv2.waitKey(1) & 0xFF == ord('q'): break

        # finalize
        cap.release()
        if self.writer is not None: self.writer.release()
        cv2.destroyAllWindows()
        self.book.close_all()
        self.book.write_summary(self.summary_csv_path)

        # Đóng tất cả violation writers
        for w in self.violation_writers.values():
            w.release()

        # Ghi CSV các lần vi phạm (kèm timestamp)
        viol_csv = os.path.join(self.run_dir, "violations.csv")
        with open(viol_csv, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["student_id","label","start_frame","end_frame",
                        "start_sec","end_sec","video_file"])
            for rec in self.violation_records:
                w.writerow([
                    rec["student_id"],
                    rec["label"],
                    rec["start_frame"],
                    rec["end_frame"],
                    rec["start_sec"],
                    rec["end_sec"],
                    rec["video_file"]
                ])
        print(f"[DONE] Violations CSV: {viol_csv}")

        # write ALS JSONs
        g_score, g_props = self.als.get_global()
        with open(os.path.join(self.run_dir, "als_global.json"), "w", encoding="utf-8") as f:
            json.dump({
                "ALS": g_score, "global_proportions": g_props,
                "weights": BEHAVIOR_WEIGHTS, "note": "ALS = sum_k w_k * p_k (stable labels, time-weighted)"
            }, f, indent=2)

        per = self.als.get_per_student()
        with open(os.path.join(self.run_dir, "als_per_student.json"), "w", encoding="utf-8") as f:
            json.dump(per, f, indent=2)

        print("[DONE] Attendance events:", self.book.events_path)
        print("[DONE] Attendance summary:", self.summary_csv_path)
        print("[DONE] ALS global / per-student JSON written.")
        print("[DONE] Violation videos saved in:", self.violation_dir)

# =============================== CLI ======================================== #

def load_thresholds(path: str) -> Dict[str, float]:
    if not path: return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        assert isinstance(data, dict)
        return {str(k): float(v) for k, v in data.items()}
    except Exception:
        return {}

def build_argparser():
    p = argparse.ArgumentParser(description="Merged Attendance + Active Learning (ALS) Pipeline — Torch only")
    p.add_argument("--source", type=str, required=True, help="video path or '0' for webcam")
    p.add_argument("--person", type=str, default="yolov8n.pt", help="YOLOv8 model for person")
    p.add_argument("--behavior", type=str, required=True, help="YOLOv8 behavior model")
    p.add_argument("--device", type=str, default="auto", choices=["auto","cpu","cuda"])
    p.add_argument("--half", action="store_true")
    p.add_argument("--imgsz", type=int, default=640)
    p.add_argument("--frame_stride", type=int, default=2)
    p.add_argument("--conf_person", type=float, default=0.35)
    p.add_argument("--conf_behavior_floor", type=float, default=0.35)
    p.add_argument("--thresholds_json", type=str, default="")
    p.add_argument("--smooth_window", type=int, default=7)
    p.add_argument("--th_on", type=float, default=0.60)
    p.add_argument("--th_off", type=float, default=0.45)
    p.add_argument("--ioa_min", type=float, default=0.60)
    p.add_argument("--iou_min", type=float, default=0.05)
    p.add_argument("--rel_min_default", type=float, default=REL_MIN_DEFAULT)
    p.add_argument("--tta", action="store_true")
    p.add_argument("--no_show", action="store_true")
    p.add_argument("--outdir", type=str, default="outputs")

    # attendance / face
    p.add_argument("--students_dir", type=str, default="students")
    p.add_argument("--sim_threshold", type=float, default=SIM_THRESHOLD_DEFAULT)
    p.add_argument("--min_face_px", type=int, default=MIN_FACE_PX)
    p.add_argument("--min_face_var", type=float, default=MIN_FACE_VAR)
    p.add_argument("--face_every_n", type=int, default=FACE_EVERY_N)
    p.add_argument("--appearance", action="store_true")
    p.add_argument("--grace", type=int, default=GRACE_SECONDS_DEFAULT)

    p.add_argument("--save_video", type=str, default="")  # e.g., outputs/merged_annot.mp4

    # (nếu muốn chỉnh behaviour vi phạm từ CLI thì có thể thêm arguments mới ở đây)
    return p

def main():
    args = build_argparser().parse_args()
    cfg = PipelineConfig(
        person_model_path=args.person,
        behavior_model_path=args.behavior,
        conf_person=args.conf_person,
        conf_behavior_floor=args.conf_behavior_floor,
        device=args.device, half=args.half, imgsz=args.imgsz,
        frame_stride=max(1, args.frame_stride),
        show_window=(not args.no_show),
        output_dir=args.outdir, smooth_window=max(1, args.smooth_window),
        th_on=args.th_on, th_off=args.th_off,
        ioa_min=args.ioa_min, iou_min=args.iou_min, rel_min_default=args.rel_min_default,
        tta=args.tta, per_class_conf=load_thresholds(args.thresholds_json),
        students_dir=args.students_dir, sim_threshold=args.sim_threshold,
        min_face_px=args.min_face_px, min_face_var=args.min_face_var,
        face_every_n=args.face_every_n, appearance=args.appearance,
        grace=args.grace,
        save_video=args.save_video
    )
    pipe = MergedPipeline(cfg)
    pipe.run(args.source)

if __name__ == "__main__":
     main()

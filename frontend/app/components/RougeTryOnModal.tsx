"use client";

import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { Camera, ImagePlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type TryOnVariant = {
  id: number;
  name: string;
  color: string;
  image: string;
};

type RougeTryOnModalProps = {
  variants: TryOnVariant[];
  selectedVariant: TryOnVariant;
  onVariant: (variant: TryOnVariant) => void;
  onClose: () => void;
};

type CheekStyle = "apple" | "sculpted";

const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";

function isValidHex(color: string) {
  return /^#(?:[0-9a-f]{3}){1,2}$/i.test(color);
}

function hexToRgb(color: string) {
  const normalized = color.length === 4
    ? color.slice(1).split("").map((part) => `${part}${part}`).join("")
    : color.slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function averageLandmarks(result: FaceLandmarkerResult, indexes: number[]) {
  const landmarks = result.faceLandmarks[0];
  if (!landmarks || indexes.some((index) => !landmarks[index])) return null;
  return indexes.reduce(
    (point, index) => ({ x: point.x + landmarks[index].x / indexes.length, y: point.y + landmarks[index].y / indexes.length }),
    { x: 0, y: 0 },
  );
}

function drawRouge(
  canvas: HTMLCanvasElement,
  result: FaceLandmarkerResult,
  color: string,
  intensity: number,
  style: CheekStyle,
) {
  const context = canvas.getContext("2d");
  if (!context || !result.faceLandmarks[0] || !isValidHex(color)) return;
  const left = averageLandmarks(result, [116, 123, 50]);
  const right = averageLandmarks(result, [345, 352, 280]);
  if (!left || !right) return;

  const scaleX = canvas.width;
  const scaleY = canvas.height;
  const leftX = left.x * scaleX;
  const leftY = left.y * scaleY;
  const rightX = right.x * scaleX;
  const rightY = right.y * scaleY;
  const cheekDistance = Math.hypot(rightX - leftX, rightY - leftY);
  const radius = cheekDistance * 0.32;
  const rgb = hexToRgb(color);
  const opacity = 0.45 * intensity;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = "multiply";
  for (const [x, y, direction] of [[leftX, leftY, -1], [rightX, rightY, 1]] as const) {
    const offsetX = style === "sculpted" ? direction * radius * 0.22 : 0;
    const offsetY = style === "sculpted" ? radius * 0.18 : 0;
    const gradient = context.createRadialGradient(x + offsetX, y + offsetY, 0, x + offsetX, y + offsetY, radius);
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`);
    gradient.addColorStop(0.45, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity * 0.45})`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x + offsetX, y + offsetY, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.globalCompositeOperation = "source-over";
}

export default function RougeTryOnModal({ variants, selectedVariant, onVariant, onClose }: RougeTryOnModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const latestResultRef = useRef<FaceLandmarkerResult | null>(null);
  const [intensity, setIntensity] = useState(45);
  const [style, setStyle] = useState<CheekStyle>("apple");
  const [mode, setMode] = useState<"camera" | "photo">("camera");
  const [status, setStatus] = useState("Đang khởi động camera...");
  const [error, setError] = useState("");
  const colorRef = useRef(selectedVariant.color);
  const intensityRef = useRef(intensity);
  const styleRef = useRef(style);
  const modeRef = useRef(mode);

  useEffect(() => {
    colorRef.current = selectedVariant.color;
    intensityRef.current = intensity;
    styleRef.current = style;
    modeRef.current = mode;
  }, [intensity, mode, selectedVariant.color, style]);

  useEffect(() => {
    let active = true;
    const stopCamera = () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };

    const renderFrame = () => {
      if (!active || !videoRef.current || !canvasRef.current || !landmarkerRef.current) return;
      const video = videoRef.current;
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
        const canvas = canvasRef.current;
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        if (modeRef.current === "camera") {
          const result = landmarkerRef.current.detectForVideo(video, performance.now());
          latestResultRef.current = result;
          drawRouge(canvas, result, colorRef.current, intensityRef.current / 100, styleRef.current);
          setStatus(result.faceLandmarks.length > 0 ? "" : "Đưa khuôn mặt vào giữa khung hình nhé.");
        }
      }
      animationFrameRef.current = requestAnimationFrame(renderFrame);
    };

    const start = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numFaces: 1,
        });
        if (!active) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (!active || !videoRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus("");
        renderFrame();
      } catch (cameraError) {
        console.error("Không thể khởi động Rouge AR.", cameraError);
        setError("Không thể truy cập camera. Bạn có thể cấp quyền camera hoặc tải ảnh chân dung lên để thử màu.");
        setStatus("");
      }
    };
    void start();
    return () => {
      active = false;
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (mode === "photo" && latestResultRef.current && canvasRef.current) {
      drawRouge(canvasRef.current, latestResultRef.current, selectedVariant.color, intensity / 100, style);
    }
  }, [intensity, mode, selectedVariant.color, style]);

  const handlePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !canvasRef.current) return;
    const imageUrl = URL.createObjectURL(file);
    setError("");
    setMode("photo");
    setStatus("Đang nhận diện khuôn mặt...");
    const image = imageRef.current;
    if (!image) return;
    image.onload = async () => {
      URL.revokeObjectURL(imageUrl);
      const canvas = canvasRef.current;
      const landmarker = landmarkerRef.current;
      if (!canvas || !landmarker) {
        setError("Bộ nhận diện chưa sẵn sàng. Vui lòng thử lại sau vài giây.");
        return;
      }
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const result = landmarker.detect(image);
      latestResultRef.current = result;
      if (result.faceLandmarks.length === 0) {
        setStatus("");
        setError("Không tìm thấy khuôn mặt trong ảnh. Vui lòng chọn ảnh chân dung rõ mặt hơn.");
        return;
      }
      drawRouge(canvas, result, selectedVariant.color, intensity / 100, style);
      setStatus("");
    };
    image.src = imageUrl;
  };

  return (
    <div className="overlay try-on-overlay" onClick={onClose}>
      <section className="try-on-modal" onClick={(event) => event.stopPropagation()} aria-label="Thử màu má hồng AR">
        <div className="try-on-heading">
          <div><p className="eyebrow">ROUGE AR</p><h2>Thử màu má hồng</h2></div>
          <button onClick={onClose} aria-label="Đóng thử màu AR"><X /></button>
        </div>
        <div className="try-on-stage">
          <video ref={videoRef} className={mode === "camera" ? "try-on-media active" : "try-on-media"} playsInline muted />
          <img ref={imageRef} className={mode === "photo" ? "try-on-media active" : "try-on-media"} alt="Ảnh chân dung để thử màu" />
          <canvas ref={canvasRef} className="try-on-canvas" />
          {status && <p className="try-on-status">{status}</p>}
        </div>
        <div className="try-on-controls">
          {error && <p className="try-on-error">{error}</p>}
          <div className="try-on-swatches"><strong>Chọn màu</strong><div>{variants.filter((variant) => isValidHex(variant.color)).map((variant) => <button key={variant.id} className={variant.id === selectedVariant.id ? "try-on-swatch active" : "try-on-swatch"} style={{ backgroundColor: variant.color }} onClick={() => onVariant(variant)} aria-label={variant.name} />)}</div></div>
          <label className="intensity-control">Độ đậm <span>{intensity}%</span><input type="range" min="15" max="75" value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} /></label>
          <div className="try-on-style"><strong>Kiểu tán</strong><div><button className={style === "apple" ? "selected" : ""} onClick={() => setStyle("apple")}>Tán tròn tự nhiên</button><button className={style === "sculpted" ? "selected" : ""} onClick={() => setStyle("sculpted")}>Tán xéo nâng gò má</button></div></div>
          <label className="photo-upload"><ImagePlus size={16} /> Tải ảnh chân dung lên<input type="file" accept="image/*" onChange={handlePhoto} /></label>
          {mode === "photo" && <button className="camera-mode-button" onClick={() => { setMode("camera"); setError(""); }}> <Camera size={16} /> Quay lại camera</button>}
        </div>
      </section>
    </div>
  );
}

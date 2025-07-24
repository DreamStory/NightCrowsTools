import { useRef, useState } from 'react';
import Tesseract from 'tesseract.js';

declare const cv: any;

function normalize(str: string) {
  return str
    .replace(/\s+/g, '')               // 去除空格
    .replace(/[‧・．·･·]/g, '・')      // 統一符號
    .replace(/[^\w\u4e00-\u9fff・]/g, '') // 移除非文字符號（保留中日英數）
    .trim();
}

export default function App() {
  const [idList, setIdList] = useState<string[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const expectedList = [
    'Mermaidx', 'SilverSS', '順吉吉', 'T1・Zeus', 'T1・愛夜鴞愛娣美德',
    'T1・Faker', '黎明使者索拉卡', '姐姐也會仰式嗎', '天曈'
  ];

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setPreview(url);

    const img = new Image();
    img.src = url;
    img.onload = async () => {
      // ✅ 使用 OpenCV 讀取圖片
      const src = cv.imread(img);

      // ✅ 裁切左側名字欄位 (手動調整範圍)
      const roi = src.roi(new cv.Rect(10, 0, 350, src.rows));

      // ✅ 轉灰階 + 增強對比
      const gray = new cv.Mat();
      cv.cvtColor(roi, gray, cv.COLOR_RGBA2GRAY);
      // cv.equalizeHist(gray, gray);
      cv.threshold(gray, gray, 120, 255, cv.THRESH_BINARY);

      // cv.threshold(gray, gray, 100, 255, cv.THRESH_BINARY);
      // cv.adaptiveThreshold(gray, gray, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2);
      // cv.equalizeHist(gray, gray);

      // ✅ 顯示處理後的結果在 canvas
      if (canvasRef.current) cv.imshow(canvasRef.current, gray);

      // ✅ 將處理後圖片轉成 blob 給 Tesseract 用
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = gray.cols;
      tempCanvas.height = gray.rows;
      cv.imshow(tempCanvas, gray);

      tempCanvas.toBlob(async (blob) => {
        if (!blob) return;
        const result = await Tesseract.recognize(blob, 'chi_tra+eng', {
          langPath: 'https://tessdata.projectnaptha.com/4.0.0',
        });
        const rawText = result.data.text;
        const lines = rawText.split('\n').map(line => line.trim()).filter(Boolean);
        setIdList(lines);

        // 清理記憶體
        src.delete();
        roi.delete();
        gray.delete();
      });
    };
  };

  const normExpected = expectedList.map(normalize);
  const normActual = idList.map(normalize);

  const matched = expectedList.filter((id, idx) => normActual.includes(normExpected[idx]));
  const notFound = expectedList.filter((id, idx) => !normActual.includes(normExpected[idx]));
  const unexpected = idList.filter((id, idx) => !normExpected.includes(normActual[idx]));

  return (
    <div>
      <h1>📋 擷取遊戲人員 ID（切割 + 灰階 + 中文）</h1>
      <input type="file" accept="image/*" onChange={handleImageUpload} />
      {preview && <img src={preview} alt="preview" style={{ maxWidth: 800 }} />}

      <h2>處理後圖像：</h2>
      <canvas ref={canvasRef} style={{ border: '1px solid #ccc', maxWidth: 800 }} />

      <h2>✔️ 有成功比對的 ID</h2>
      <ul>{matched.map((id, i) => <li key={i}>{id}</li>)}</ul>

      <h2>❌ 缺少的 ID（沒被擷取出來）</h2>
      <ul>{notFound.map((id, i) => <li key={i}>{id}</li>)}</ul>

      <h2>⚠️ 意外出現的 ID（未在清單內）</h2>
      <ul>{unexpected.map((id, i) => <li key={i}>{id}</li>)}</ul>
    </div>
  );
}

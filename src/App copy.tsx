import { useState } from 'react';
import Tesseract from 'tesseract.js';

export default function App() {
  const [idList, setIdList] = useState<string[]>([]);
  const [preview, setPreview] = useState<string | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);

    const result = await Tesseract.recognize(url, 'eng');
    const rawText = result.data.text;
    const lines = rawText.split('\n').map(line => line.trim()).filter(Boolean);
    setIdList(lines);
  };

  return (
    <div>
      <h1>📋 擷取遊戲人員 ID</h1>
      <input type="file" accept="image/*" onChange={handleImageUpload} />
      {preview && <img src={preview} alt="preview" style={{ maxWidth: 400 }} />}
      <h2>擷取結果：</h2>
      <ul>
        {idList.map((id, i) => <li key={i}>{id}</li>)}
      </ul>
    </div>
  );
}

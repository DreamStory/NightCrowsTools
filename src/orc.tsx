// src/ocr.ts
import Tesseract from 'tesseract.js'

export async function ocrImageData(data: ImageData) {
  const canvas = document.createElement('canvas')
  canvas.width = data.width
  canvas.height = data.height
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(data, 0, 0)

  const blob: Blob = await new Promise((resolve) => canvas.toBlob(b => resolve(b!), 'image/png'))

  const options: any = {
    // 這兩個鍵實際有效，但型別未宣告
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_ ',
    psm: 6, // 6: single block, 7: single line, 11: sparse
    // logger: m => console.log(m),
  }

  const { data: { text } } = await Tesseract.recognize(blob, 'eng', options)
  return text
}

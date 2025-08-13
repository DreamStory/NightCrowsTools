// src/utils/ocr.ts
import Tesseract from 'tesseract.js'

/** 將 ImageData 轉成 HTMLCanvasElement（避免 TS 對 ImageLike 的型別抱怨） */
function imageDataToCanvas(img: ImageData): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const ctx = c.getContext('2d')!
  ctx.putImageData(img, 0, 0)
  return c
}

/**
 * OCR：接受 ImageData，但在內部轉 canvas 再丟給 tesseract.js
 * @param img  你裁切/前處理後的 ImageData
 * @param lang 'eng' 或 'eng+chi_tra'
 * @param psm  Page Segmentation Mode (6:單區塊, 7:單行)
 */
export async function ocrImageData(
  img: ImageData,
  lang: 'eng' | 'eng+chi_tra' = 'eng',
  psm: 6 | 7 = 6
): Promise<string> {
  const canvas = imageDataToCanvas(img)

  // tesseract.js 的 option 沒有嚴格的 TS 定義，這裡用 any 讓它吃下去
  const opts: any = {
    tessedit_pageseg_mode: String(psm),
    // 如需白名單可開：tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  }

  const { data } = await Tesseract.recognize(canvas, lang, opts)
  return data?.text || ''
}

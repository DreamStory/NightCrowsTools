import type { Box } from './types.tsx'

// 需要在 index.html 先載入 opencv.js，window.cv 才會存在
declare global { interface Window { cv: any } }

// 前處理：灰階 → 高斯 → 自適應二值 → 反轉(選擇)
export function preprocessWithCV(
    img: ImageData,
    opts: { blur?: number; adaptiveBlock?: number; C?: number; invert?: boolean; clahe?: boolean; morph?: 'none' | 'dilate' | 'erode' } = {}
) {
    const cv = window.cv
    const blur = opts.blur ?? 3
    const blockSize = (opts.adaptiveBlock ?? 21) | 1
    const C = opts.C ?? 5
    const invert = !!opts.invert

    const src = cv.matFromImageData(img)
    const gray = new cv.Mat()
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)

    const blurred = new cv.Mat()
    if (blur > 0) cv.GaussianBlur(gray, blurred, new cv.Size(blur, blur), 0)
    else gray.copyTo(blurred)

    let workGray = blurred
    if (opts.clahe) {
        const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8))
        const enhanced = new cv.Mat()
        clahe.apply(blurred, enhanced)
        workGray = enhanced
        clahe.delete()
    }

    const bin = new cv.Mat()
    cv.adaptiveThreshold(
        workGray, bin, 255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY,
        blockSize, C
    )

    let work = bin
    if (opts.morph && opts.morph !== 'none') {
        const kernel = cv.Mat.ones(2, 2, cv.CV_8U)
        const morphed = new cv.Mat()
        if (opts.morph === 'dilate') cv.dilate(bin, morphed, kernel)
        else cv.erode(bin, morphed, kernel)
        work = morphed
        kernel.delete()
    }

    if (invert) {
        const inv = new cv.Mat()
        cv.bitwise_not(work, inv)
        work.delete()
        work = inv
    }

    // 單通道灰 → RGBA 供 canvas/Tesseract
    const rgba = new cv.Mat()
    cv.cvtColor(work, rgba, cv.COLOR_GRAY2RGBA)
    const out = new ImageData(new Uint8ClampedArray(rgba.data), rgba.cols, rgba.rows)

    src.delete(); gray.delete(); blurred.delete(); workGray !== blurred && workGray.delete?.()
    bin.delete(); work.delete(); rgba.delete()

    return out
}

// 在二值圖上切塊（連通輪廓）
export function segmentBlocks(
    binLikeRGBA: ImageData,
    opts: { minW?: number; minH?: number; minArea?: number } = {}
): Box[] {
    const cv = window.cv
    const minW = opts.minW ?? 16
    const minH = opts.minH ?? 10
    const minArea = opts.minArea ?? 80

    const src = cv.matFromImageData(binLikeRGBA)
    const gray = new cv.Mat()
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
    const thr = new cv.Mat()
    cv.threshold(gray, thr, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU)

    const contours = new cv.MatVector(), hierarchy = new cv.Mat()
    cv.findContours(thr, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

    const rects: Box[] = []
    for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i)
        const r = cv.boundingRect(cnt)
        const area = r.width * r.height
        if (r.width >= minW && r.height >= minH && area >= minArea) {
            rects.push({ x: r.x, y: r.y, w: r.width, h: r.height })
        }
        cnt.delete()
    }
    contours.delete(); hierarchy.delete(); src.delete(); gray.delete(); thr.delete()

    rects.sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y))
    return rects
}

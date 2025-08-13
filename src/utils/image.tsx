declare global { interface Window { cv: any } }

/** 自動偵測極性（白字/黑字） */
function needInvertByMean(gray: any) {
    const cv = window.cv
    const mean = cv.mean(gray)[0]  // 0~255
    // 介面暗底、白字通常 mean < 128；若 mean < 100 就把白字當前景（要反轉成黑字）
    return mean < 120
}

/** 前處理選項 */
export type PreOptions = {
    /** 先放大倍數（1~3） */
    scale?: number
    /** 高斯模糊核（奇數） */
    blur?: number
    /** 自適應 block（奇數） */
    adaptiveBlock?: number
    /** 自適應 C */
    C?: number
    /** 強制反轉（優先於 autoPolarity） */
    invert?: boolean
    /** 自動極性（依灰階平均值決定是否反轉） */
    autoPolarity?: boolean
    /** CLAHE 增強（對灰階再拉對比） */
    clahe?: boolean
    /** 膨脹次數（細字常需要 1~2） */
    dilate?: number
}

export function preprocessRGBA(img: ImageData, opt: PreOptions = {}) {
    const cv = window.cv
    const {
        scale = 2, blur = 3, adaptiveBlock = 31, C = 8,
        invert = false, autoPolarity = true, clahe = false, dilate = 1
    } = opt

    let src = cv.matFromImageData(img)             // RGBA
    const gray = new cv.Mat()
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)

    // 放大（小字很有感）
    let work = gray
    if (scale && scale !== 1) {
        const scaled = new cv.Mat()
        cv.resize(gray, scaled, new cv.Size(0, 0), scale, scale, cv.INTER_CUBIC)
        work = scaled
    }

    // 平滑
    if (blur > 0) {
        const blurred = new cv.Mat()
        cv.GaussianBlur(work, blurred, new cv.Size(blur | 1, blur | 1), 0)
        work !== gray && work.delete()
        work = blurred
    }

    // CLAHE（可讓灰字更跳）
    if (clahe) {
        const claheObj = new cv.CLAHE(2.0, new cv.Size(8, 8))
        const eq = new cv.Mat()
        claheObj.apply(work, eq)
        work.delete()
        work = eq
        claheObj.delete()
    }

    // 自適應二值化
    const bin = new cv.Mat()
    cv.adaptiveThreshold(
        work, bin, 255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY, (adaptiveBlock | 1), C
    )
    work !== gray && work.delete()

    // 反轉（自動/強制）
    let mono = bin
    if (invert || (autoPolarity && needInvertByMean(gray))) {
        const inv = new cv.Mat()
        cv.bitwise_not(bin, inv)
        mono = inv
        bin.delete()
    }

    // 形態學膨脹（讓斷裂筆畫接起來）
    if (dilate > 0) {
        const kernel = cv.Mat.ones(2, 2, cv.CV_8U)
        const mor = new cv.Mat()
        cv.morphologyEx(mono, mor, cv.MORPH_DILATE, kernel, new cv.Point(-1, -1), dilate)
        mono.delete()
        kernel.delete()
        mono = mor
    }

    // 回到 RGBA，給 canvas / OCR
    const rgba = new cv.Mat()
    cv.cvtColor(mono, rgba, cv.COLOR_GRAY2RGBA)
    const out = new ImageData(new Uint8ClampedArray(rgba.data), rgba.cols, rgba.rows)

    // 清理
    src.delete(); gray.delete(); mono.delete(); rgba.delete()

    return out
}

/** 找外部輪廓做切塊（已在處理後圖上操作） */
export function findBlocks(binRGBA: ImageData, opts: { minW?: number, minH?: number, minArea?: number } = {}) {
    const cv = window.cv
    const minW = opts.minW ?? 16
    const minH = opts.minH ?? 12
    const minArea = opts.minArea ?? 100

    const src = cv.matFromImageData(binRGBA)
    const gray = new cv.Mat()
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)

    const thr = new cv.Mat()
    cv.threshold(gray, thr, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU)

    const contours = new cv.MatVector(), hierarchy = new cv.Mat()
    cv.findContours(thr, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

    const rects: { x: number; y: number; w: number; h: number }[] = []
    for (let i = 0; i < contours.size(); i++) {
        const r = cv.boundingRect(contours.get(i))
        const area = r.width * r.height
        if (r.width >= minW && r.height >= minH && area >= minArea) {
            rects.push({ x: r.x, y: r.y, w: r.width, h: r.height })
        }
    }

    rects.sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y))

    // 清理
    contours.delete(); hierarchy.delete(); src.delete(); gray.delete(); thr.delete()

    return rects
}

// 把「容器內 CSS 座標系的框選」換成「影片實際像素座標」
// 會自動處理 letterboxing（寬或高其中一邊貼齊），並考慮 devicePixelRatio。
export function mapCssRectToVideoPixels(params: {
    containerW: number, containerH: number,     // 預覽容器實際 CSS 尺寸
    videoW: number, videoH: number,             // video.videoWidth / video.videoHeight
    rectCss: { x: number; y: number; w: number; h: number } // 在容器上的框選（CSS座標）
}) {
    const { containerW, containerH, videoW, videoH, rectCss } = params
    // 影片比例
    const vAR = videoW / videoH
    const cAR = containerW / containerH

    // 計算影片「實際繪在容器裡」的 CSS 區域（可能有 letterbox）
    let drawW: number, drawH: number, offsetX: number, offsetY: number
    if (cAR > vAR) {
        // 容器較寬 → 高度貼齊
        drawH = containerH
        drawW = Math.round(drawH * vAR)
        offsetX = Math.round((containerW - drawW) / 2)
        offsetY = 0
    } else {
        // 容器較窄 → 寬度貼齊
        drawW = containerW
        drawH = Math.round(drawW / vAR)
        offsetX = 0
        offsetY = Math.round((containerH - drawH) / 2)
    }

    // 框選需先扣掉 letterbox 偏移，再按 drawW/H → videoW/H 等比換算
    const normX = clamp(rectCss.w >= 0 ? rectCss.x : rectCss.x + rectCss.w, offsetX, offsetX + drawW)
    const normY = clamp(rectCss.h >= 0 ? rectCss.y : rectCss.y + rectCss.h, offsetY, offsetY + drawH)
    const normW = clamp(Math.abs(rectCss.w), 0, drawW - (normX - offsetX))
    const normH = clamp(Math.abs(rectCss.h), 0, drawH - (normY - offsetY))

    const relX = (normX - offsetX) / drawW
    const relY = (normY - offsetY) / drawH
    const relW = normW / drawW
    const relH = normH / drawH

    const sx = Math.round(relX * videoW)
    const sy = Math.round(relY * videoH)
    const sw = Math.max(1, Math.round(relW * videoW))
    const sh = Math.max(1, Math.round(relH * videoH))

    return { sx, sy, sw, sh, drawBoxCss: { offsetX, offsetY, drawW, drawH } }
}

function clamp(v: number, a: number, b: number) {
    return Math.min(Math.max(v, a), b)
}

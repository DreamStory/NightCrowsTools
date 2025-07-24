; 延遲開場 3 秒讓你切回遊戲畫面
Sleep, 3000

; 點選公會（根據實際遊戲座標調整）
Click, 1200, 800
Sleep, 1000

; 點選人員名單
Click, 1200, 900
Sleep, 1000

; 創建資料夾儲存圖片
FormatTime, now,, yyyyMMdd_HHmmss
folder := A_ScriptDir . "\captures_" . now
FileCreateDir, %folder%

; 擷取 20 張畫面（你可以調整次數）
Loop, 20 {
    ; 擷取整個畫面
    FormatTime, timestamp,, yyyyMMdd_HHmmss
    File := folder . "\capture_" . A_Index . "_" . timestamp . ".png"
    ; 螢幕截圖
    Send, {PrintScreen}
    Sleep, 200
    RunWait, %ComSpec% /c powershell -command "Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $bmp = New-Object Drawing.Bitmap([System.Windows.Forms.SystemInformation]::VirtualScreen.Width, [System.Windows.Forms.SystemInformation]::VirtualScreen.Height); $graphics = [Drawing.Graphics]::FromImage($bmp); $graphics.CopyFromScreen([System.Windows.Forms.SystemInformation]::VirtualScreen.Location, [Drawing.Point]::Empty, $bmp.Size); $bmp.Save('%File%');",, Hide

    ; 向下滾動（視遊戲而定，可能改為拖動滑鼠）
    MouseMove, 1400, 800
    Sleep, 200
    MouseClickDrag, left, 1400, 800, 1400, 500, 20

    Sleep, 800
}

MsgBox, 完成擷取 %A_Index% 張畫面至 %folder%

export const CONF_MAP: Record<string, string> = {
  '０': '0', 'Ｏ': 'O', 'ｏ': 'o', '１': '1', 'Ｉ': 'I', 'ｌ': 'l', '｜': 'l', '５': '5', 'Ｓ': 'S',
  'ｓ': 's', '６': '6', 'Ｇ': 'G', 'ｇ': 'g', '８': '8', 'Ｂ': 'B', 'ｂ': 'b', '２': '2', 'Ｚ': 'Z',
  'ｚ': 'z', 'Ａ': 'A', 'ａ': 'a', 'Ｅ': 'E', 'ｅ': 'e', '〇': '0', '○': '0', '●': '0'
}
export function toHalfWidth(s: string) {
  let out = ''; for (const ch of s) {
    const c = ch.charCodeAt(0)
    if (c === 0x3000) { out += ' '; continue }
    if (c >= 0xFF01 && c <= 0xFF5E) { out += String.fromCharCode(c - 0xFEE0); continue }
    out += ch
  } return out
}
export function applyConfusions(s: string) {
  s = toHalfWidth(s); let out = ''; for (const ch of s) { out += CONF_MAP[ch] ?? ch } return out
}
export function normalizeName(s: string) {
  return applyConfusions(s).trim().toLowerCase().replace(/[\u200b-\u200d\uFEFF]/g, '')
}

// Levenshtein + 相似度
export function levenshtein(a: string, b: string) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i; for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  } return dp[m][n]
}
export function similarity(a: string, b: string) {
  a = normalizeName(a); b = normalizeName(b)
  if (!a || !b) return 0
  const dist = levenshtein(a, b)
  const maxLen = Math.max(a.length, b.length)
  return maxLen === 0 ? 1 : 1 - dist / maxLen
}

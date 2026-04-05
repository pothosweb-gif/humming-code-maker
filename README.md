# 鼻歌コードメーカー v1

鼻歌を MP3 で録音して、AI がコード進行を推測するアプリ。

監修：rieco

## 技術スタック

- フロントエンド：HTML/CSS/JavaScript (Web Audio API)
- バックエンド：Node.js (Vercel Functions)
- API：Anthropic Claude API

## セットアップ

### 1. npm install
```bash
cd backend
npm install
cp .env.example .env
```

### 2. .env に ANTHROPIC_API_KEY を設定

### 3. ローカル開発サーバー起動
```bash
vercel dev
```

### 4. フロントエンド確認
```bash
# 別ターミナルで
cd frontend
python3 -m http.server 8000
```

ブラウザで http://localhost:8000 を開く

### 5. GitHub プッシュ
```bash
git add humming-code-maker/
git commit -m "feat: 鼻歌コードメーカーv1実装"
git push origin main
```

## v2 改善予定

- librosa による高精度ピッチ検出
- MP3 出力機能
- ギター TAB 譜出力

---

Made with ♥ by Pothos Web

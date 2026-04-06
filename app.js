// API URL
const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3000/api/analyze'
  : `${window.location.origin}/api/analyze`;

const fileInput = document.getElementById('audioFile');
const analyzeBtn = document.getElementById('analyzeBtn');
const copyBtn = document.getElementById('copyBtn');
const loadingDiv = document.getElementById('loading');
const resultContainer = document.getElementById('resultContainer');
const errorContainer = document.getElementById('errorContainer');
const codeResult = document.getElementById('codeResult');
const errorMessage = document.getElementById('errorMessage');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const fileNameText = document.getElementById('fileNameText');
const chordDiagramsEl = document.getElementById('chordDiagrams');

let audioContext = null;

// ファイル選択時にファイル名を表示
fileInput.addEventListener('change', () => {
  if (fileInput.files.length) {
    fileNameText.textContent = fileInput.files[0].name;
    fileNameDisplay.style.display = 'block';
  }
});

function showError(msg) {
  errorMessage.textContent = msg;
  errorContainer.style.display = 'block';
  resultContainer.style.display = 'none';
  loadingDiv.style.display = 'none';
}

function clearError() {
  errorContainer.style.display = 'none';
}

analyzeBtn.addEventListener('click', async () => {
  clearError();

  if (!fileInput.files.length) {
    showError('音声ファイルを選択してください（MP3 / M4A）');
    return;
  }

  analyzeBtn.disabled = true;
  loadingDiv.style.display = 'block';
  resultContainer.style.display = 'none';

  try {
    const file = fileInput.files[0];
    const audioBuffer = await readAudioFile(file);
    const notes = await analyzePitches(audioBuffer);

    if (notes.length === 0) {
      showError('音声を検出できませんでした。別のファイルを試してください。');
      analyzeBtn.disabled = false;
      return;
    }

    const chords = await fetchCodesFromAPI(notes);

    loadingDiv.style.display = 'none';
    codeResult.textContent = chords;
    resultContainer.style.display = 'block';

    // コード図を描画
    renderChordDiagrams(chords);

  } catch (err) {
    console.error('Error:', err);
    showError(`エラーが発生しました: ${err.message}`);
  } finally {
    analyzeBtn.disabled = false;
  }
});

copyBtn.addEventListener('click', () => {
  const text = codeResult.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const original = copyBtn.textContent;
    copyBtn.textContent = '✅ コピーしました！';
    setTimeout(() => { copyBtn.textContent = original; }, 2000);
  });
});

async function readAudioFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        if (!audioContext) {
          audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        const audioBuffer = await audioContext.decodeAudioData(e.target.result);
        resolve(audioBuffer);
      } catch (err) {
        reject(new Error('音声デコードエラー（MP3またはM4A形式を確認してください）'));
      }
    };
    reader.onerror = () => reject(new Error('ファイル読み込みエラー'));
    reader.readAsArrayBuffer(file);
  });
}

async function analyzePitches(audioBuffer) {
  const rawData = audioBuffer.getChannelData(0);
  const windowSize = 4096;
  const hopSize = 2048;
  const pitches = [];

  for (let i = 0; i + windowSize < rawData.length; i += hopSize) {
    const window = rawData.slice(i, i + windowSize);
    const pitch = detectPitchACF(window, audioBuffer.sampleRate);
    if (pitch > 50 && pitch < 2000) pitches.push(pitch);
  }

  const notes = pitches.map(p => pitchToNote(p)).filter(n => n !== null);

  const uniqueNotes = [];
  let lastNote = null;
  for (const note of notes) {
    if (note !== lastNote) {
      uniqueNotes.push(note);
      lastNote = note;
    }
  }

  return uniqueNotes.slice(0, 50);
}

function detectPitchACF(signal, sampleRate) {
  const minPeriod = Math.floor(sampleRate / 2000);
  const maxPeriod = Math.floor(sampleRate / 50);

  let bestPeriod = maxPeriod;
  let bestDiff = Number.MAX_VALUE;

  for (let period = minPeriod; period < maxPeriod; period++) {
    let diff = 0;
    for (let i = 0; i < signal.length - period; i++) {
      diff += Math.abs(signal[i] - signal[i + period]);
    }
    if (diff < bestDiff) {
      bestDiff = diff;
      bestPeriod = period;
    }
  }

  return sampleRate / bestPeriod;
}

function pitchToNote(freq) {
  const A4 = 440;
  const C0 = A4 * Math.pow(2, -4.75);
  const semitones = 12 * Math.log2(freq / C0);
  const noteIndex = Math.round(semitones) % 12;
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return noteNames[((noteIndex % 12) + 12) % 12] || null;
}

async function fetchCodesFromAPI(notes) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(`API error: ${response.status} - ${errData.message || errData.error || 'unknown'}`);
  }

  const data = await response.json();
  return data.chords || '（コード推測に失敗しました）';
}

// =====================
// ギターコード図データ
// =====================
const CHORD_DATA = {
  'C':    { frets: [0, 3, 2, 0, 1, 0], fingers: [0,3,2,0,1,0] },
  'Cm':   { frets: [-1, 3, 5, 5, 4, 3], barre: 3 },
  'D':    { frets: [-1, -1, 0, 2, 3, 2], fingers: [0,0,0,1,3,2] },
  'Dm':   { frets: [-1, -1, 0, 2, 3, 1], fingers: [0,0,0,2,3,1] },
  'E':    { frets: [0, 2, 2, 1, 0, 0], fingers: [0,2,3,1,0,0] },
  'Em':   { frets: [0, 2, 2, 0, 0, 0], fingers: [0,2,3,0,0,0] },
  'F':    { frets: [1, 1, 2, 3, 3, 1], barre: 1 },
  'Fm':   { frets: [1, 1, 1, 3, 3, 1], barre: 1 },
  'G':    { frets: [3, 2, 0, 0, 0, 3], fingers: [3,2,0,0,0,4] },
  'Gm':   { frets: [3, 5, 5, 3, 3, 3], barre: 3 },
  'A':    { frets: [-1, 0, 2, 2, 2, 0], fingers: [0,0,1,2,3,0] },
  'Am':   { frets: [-1, 0, 2, 2, 1, 0], fingers: [0,0,2,3,1,0] },
  'B':    { frets: [-1, 2, 4, 4, 4, 2], barre: 2 },
  'Bm':   { frets: [-1, 2, 4, 4, 3, 2], barre: 2 },
  'A#':   { frets: [-1, 1, 3, 3, 3, 1], barre: 1 },
  'A#m':  { frets: [-1, 1, 3, 3, 2, 1], barre: 1 },
  'Bb':   { frets: [-1, 1, 3, 3, 3, 1], barre: 1 },
  'Bbm':  { frets: [-1, 1, 3, 3, 2, 1], barre: 1 },
  'C#':   { frets: [-1, 4, 3, 1, 2, 1], barre: 1 },
  'C#m':  { frets: [-1, 4, 2, 1, 2, 0] },
  'Db':   { frets: [-1, 4, 3, 1, 2, 1], barre: 1 },
  'D#':   { frets: [-1, -1, 1, 3, 4, 3], barre: 1 },
  'D#m':  { frets: [-1, -1, 1, 3, 4, 2], barre: 1 },
  'Eb':   { frets: [-1, -1, 1, 3, 4, 3], barre: 1 },
  'F#':   { frets: [2, 2, 3, 4, 4, 2], barre: 2 },
  'F#m':  { frets: [2, 2, 2, 4, 4, 2], barre: 2 },
  'G#':   { frets: [4, 6, 6, 5, 4, 4], barre: 4 },
  'G#m':  { frets: [4, 6, 6, 4, 4, 4], barre: 4 },
  'Ab':   { frets: [4, 6, 6, 5, 4, 4], barre: 4 },
};

function renderChordDiagrams(chordsText) {
  chordDiagramsEl.innerHTML = '';

  const chordNames = chordsText.split(/\s*[\|→]\s*/).map(s => s.trim()).filter(Boolean);

  for (const name of chordNames) {
    const data = CHORD_DATA[name];
    const card = document.createElement('div');
    card.className = 'chord-card';

    const nameEl = document.createElement('div');
    nameEl.className = 'chord-card-name';
    nameEl.textContent = name;
    card.appendChild(nameEl);

    if (data) {
      const canvas = drawChordDiagram(name, data);
      card.appendChild(canvas);
    } else {
      const unknown = document.createElement('div');
      unknown.style.cssText = 'font-size:11px;color:#aaa;padding:8px 0;';
      unknown.textContent = '図なし';
      card.appendChild(unknown);
    }

    chordDiagramsEl.appendChild(card);
  }
}

function drawChordDiagram(name, data) {
  const canvas = document.createElement('canvas');
  canvas.className = 'chord-canvas';
  const scale = window.devicePixelRatio || 1;
  const W = 64, H = 76;
  canvas.width = W * scale;
  canvas.height = H * scale;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  const strings = 6;
  const fretCount = 4;
  const left = 10, top = 14;
  const strGap = (W - left * 2) / (strings - 1);
  const fretGap = (H - top - 12) / fretCount;

  const minFret = Math.min(...data.frets.filter(f => f > 0));
  const offset = (data.barre && data.barre > 1) ? data.barre - 1 : (minFret > 4 ? minFret - 1 : 0);

  // ナット or フレット番号
  if (offset === 0) {
    ctx.fillStyle = '#333';
    ctx.fillRect(left - 1, top, (strings - 1) * strGap + 2, 3);
  } else {
    ctx.fillStyle = '#888';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(offset + 1 + 'fr', 0, top + fretGap * 0.6);
  }

  // フレット線
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 1;
  for (let f = 0; f <= fretCount; f++) {
    const y = top + f * fretGap;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(left + (strings - 1) * strGap, y);
    ctx.stroke();
  }

  // 弦
  ctx.strokeStyle = '#bbb';
  ctx.lineWidth = 1;
  for (let s = 0; s < strings; s++) {
    const x = left + s * strGap;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, top + fretCount * fretGap);
    ctx.stroke();
  }

  // バレー
  if (data.barre) {
    const by = top + (data.barre - offset - 0.5) * fretGap;
    ctx.fillStyle = '#7c3aed';
    ctx.beginPath();
    ctx.roundRect(left - 2, by - 6, (strings - 1) * strGap + 4, 12, 6);
    ctx.fill();
  }

  // ドット
  for (let s = 0; s < strings; s++) {
    const fret = data.frets[s];
    const x = left + s * strGap;

    if (fret === -1) {
      // ミュート
      ctx.strokeStyle = '#e11d48';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 4, top - 10);
      ctx.lineTo(x + 4, top - 3);
      ctx.moveTo(x + 4, top - 10);
      ctx.lineTo(x - 4, top - 3);
      ctx.stroke();
    } else if (fret === 0) {
      // 開放弦
      ctx.strokeStyle = '#7c3aed';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, top - 6, 4, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const adjFret = fret - offset;
      if (adjFret > 0 && adjFret <= fretCount) {
        const y = top + (adjFret - 0.5) * fretGap;
        ctx.fillStyle = data.barre && fret === data.barre ? 'rgba(255,255,255,0.0)' : '#7c3aed';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  return canvas;
}

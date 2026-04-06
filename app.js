// API URL
const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3000/api/analyze'
  : `${window.location.origin}/api/analyze`;

const fileInput = document.getElementById('audioFile');
const analyzeBtn = document.getElementById('analyzeBtn');
const demoBtn = document.getElementById('demoBtn');
const copyBtn = document.getElementById('copyBtn');
const loadingDiv = document.getElementById('loading');
const resultContainer = document.getElementById('resultContainer');
const errorContainer = document.getElementById('errorContainer');
const codeResult = document.getElementById('codeResult');
const errorMessage = document.getElementById('errorMessage');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const fileNameText = document.getElementById('fileNameText');
const chordDiagramsEl = document.getElementById('chordDiagrams');

// デモ用ダミーデータ（ポップスによく使われる音符の流れ）
const DEMO_NOTES = [
  'C', 'E', 'G', 'E', 'C', 'D', 'F', 'A', 'F', 'D',
  'G', 'B', 'D', 'B', 'G', 'A', 'C', 'E', 'C', 'A',
  'F', 'A', 'C', 'A', 'F', 'G', 'B', 'D', 'B', 'G'
];

demoBtn.addEventListener('click', async () => {
  clearError();
  demoBtn.disabled = true;
  analyzeBtn.disabled = true;
  loadingDiv.style.display = 'block';
  resultContainer.style.display = 'none';

  // ファイル名表示をデモ表示に
  fileNameText.textContent = 'テストデータ（サンプルメロディ）';
  fileNameDisplay.style.display = 'flex';

  try {
    const chords = await fetchCodesFromAPI(DEMO_NOTES);
    loadingDiv.style.display = 'none';
    codeResult.textContent = chords;
    resultContainer.style.display = 'block';
    renderChordDiagrams(chords);
  } catch (err) {
    console.error('Demo Error:', err);
    showError(`エラーが発生しました: ${err.message}`);
  } finally {
    demoBtn.disabled = false;
    analyzeBtn.disabled = false;
  }
});

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
  errorContainer.style.display = 'flex';
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
    const guitarData = CHORD_DATA[name];
    const pianoNotes = getPianoNotes(name);

    const card = document.createElement('div');
    card.className = 'chord-card';

    const nameEl = document.createElement('div');
    nameEl.className = 'chord-card-name';
    nameEl.textContent = name;
    card.appendChild(nameEl);

    const diagramsRow = document.createElement('div');
    diagramsRow.className = 'chord-diagrams-row';

    // ギター図
    const guitarWrap = document.createElement('div');
    guitarWrap.className = 'diagram-wrap';
    const guitarLabel = document.createElement('div');
    guitarLabel.className = 'diagram-label';
    guitarLabel.textContent = '🎸';
    guitarWrap.appendChild(guitarLabel);
    if (guitarData) {
      guitarWrap.appendChild(drawChordDiagram(name, guitarData));
    } else {
      const n = document.createElement('div');
      n.style.cssText = 'font-size:10px;color:#aaa;padding:4px 0;';
      n.textContent = '図なし';
      guitarWrap.appendChild(n);
    }
    diagramsRow.appendChild(guitarWrap);

    // ピアノ図
    const pianoWrap = document.createElement('div');
    pianoWrap.className = 'diagram-wrap';
    const pianoLabel = document.createElement('div');
    pianoLabel.className = 'diagram-label';
    pianoLabel.textContent = '🎹';
    pianoWrap.appendChild(pianoLabel);
    pianoWrap.appendChild(drawPianoDiagram(pianoNotes));
    diagramsRow.appendChild(pianoWrap);

    card.appendChild(diagramsRow);
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
    ctx.fillStyle = '#c9a84c';
    ctx.fillRect(left - 1, top, (strings - 1) * strGap + 2, 3);
  } else {
    ctx.fillStyle = '#9994a8';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(offset + 1 + 'fr', 0, top + fretGap * 0.6);
  }

  // フレット線
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  for (let f = 0; f <= fretCount; f++) {
    const y = top + f * fretGap;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(left + (strings - 1) * strGap, y);
    ctx.stroke();
  }

  // 弦
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
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
    ctx.fillStyle = '#c9a84c';
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
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 4, top - 10);
      ctx.lineTo(x + 4, top - 3);
      ctx.moveTo(x + 4, top - 10);
      ctx.lineTo(x - 4, top - 3);
      ctx.stroke();
    } else if (fret === 0) {
      // 開放弦
      ctx.strokeStyle = '#c9a84c';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, top - 6, 4, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const adjFret = fret - offset;
      if (adjFret > 0 && adjFret <= fretCount) {
        const y = top + (adjFret - 0.5) * fretGap;
        ctx.fillStyle = data.barre && fret === data.barre ? 'rgba(255,255,255,0.0)' : '#c9a84c';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  return canvas;
}

// =====================
// ピアノコードデータ
// 各コードの構成音（半音インデックス 0=C, 1=C#, ... 11=B）
// =====================
const NOTE_TO_SEMITONE = {
  'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,
  'E':4,'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,
  'A':9,'A#':10,'Bb':10,'B':11
};

const CHORD_INTERVALS = {
  '':    [0, 4, 7],        // Major
  'm':   [0, 3, 7],        // Minor
  '7':   [0, 4, 7, 10],    // Dominant 7th
  'maj7':[0, 4, 7, 11],    // Major 7th
  'm7':  [0, 3, 7, 10],    // Minor 7th
  'sus2':[0, 2, 7],        // Sus2
  'sus4':[0, 5, 7],        // Sus4
  'dim': [0, 3, 6],        // Diminished
  'aug': [0, 4, 8],        // Augmented
  'add9':[0, 4, 7, 14],    // Add9
};

function getPianoNotes(chordName) {
  // コード名をルート音とタイプに分解
  const match = chordName.match(/^([A-G][#b]?)(m7|maj7|sus2|sus4|dim|aug|add9|m|7)?$/);
  if (!match) return [];

  const root = match[1];
  const type = match[2] || '';
  const rootSemitone = NOTE_TO_SEMITONE[root];
  if (rootSemitone === undefined) return [];

  const intervals = CHORD_INTERVALS[type] || CHORD_INTERVALS[''];
  return intervals.map(i => (rootSemitone + i) % 12);
}

function drawPianoDiagram(highlightedSemitones) {
  const canvas = document.createElement('canvas');
  canvas.className = 'chord-canvas';
  const scale = window.devicePixelRatio || 1;
  const W = 80, H = 44;
  canvas.width = W * scale;
  canvas.height = H * scale;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // 1オクターブ分（C〜B）の鍵盤を描画
  const whiteKeys = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
  const blackKeys = [1, 3, -1, 6, 8, 10, -1]; // C# D# - F# G# A# -
  const blackPositions = [0, 1, -1, 3, 4, 5, -1]; // 白鍵のどこに黒鍵があるか

  const wCount = 7;
  const wW = Math.floor(W / wCount);
  const wH = H - 2;
  const bW = Math.floor(wW * 0.6);
  const bH = Math.floor(wH * 0.6);

  const highlightSet = new Set(highlightedSemitones);

  // 白鍵
  for (let i = 0; i < wCount; i++) {
    const semitone = whiteKeys[i];
    const x = i * wW;
    const isHighlight = highlightSet.has(semitone);

    ctx.fillStyle = isHighlight ? '#c9a84c' : '#f0ece0';
    ctx.strokeStyle = '#bbb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x + 1, 1, wW - 2, wH - 2, [0, 0, 4, 4]);
    ctx.fill();
    ctx.stroke();

    if (isHighlight) {
      ctx.fillStyle = 'rgba(26,18,0,0.5)';
      ctx.beginPath();
      ctx.arc(x + wW / 2, wH - 8, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 黒鍵
  for (let i = 0; i < blackPositions.length; i++) {
    if (blackPositions[i] === -1) continue;
    const semitone = blackKeys[i];
    if (semitone === -1) continue;

    const x = blackPositions[i] * wW + wW - Math.floor(bW / 2);
    const isHighlight = highlightSet.has(semitone);

    ctx.fillStyle = isHighlight ? '#e8c97a' : '#1a1a2a';
    ctx.beginPath();
    ctx.roundRect(x, 1, bW, bH, [0, 0, 3, 3]);
    ctx.fill();

    if (isHighlight) {
      ctx.fillStyle = 'rgba(26,18,0,0.4)';
      ctx.beginPath();
      ctx.arc(x + bW / 2, bH - 5, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return canvas;
}

// API URL: ローカルなら localhost:3000、本番なら同じオリジンの /api/analyze を使う
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

let audioContext = null;

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
    showError('MP3ファイルを選択してください');
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
    const originalText = copyBtn.textContent;
    copyBtn.textContent = 'コピーしました！';
    setTimeout(() => {
      copyBtn.textContent = originalText;
    }, 2000);
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
        const arrayBuffer = e.target.result;
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        resolve(audioBuffer);
      } catch (err) {
        reject(new Error('MP3デコードエラー'));
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

    if (pitch > 50 && pitch < 2000) {
      pitches.push(pitch);
    }
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
  return noteNames[noteIndex] || null;
}

async function fetchCodesFromAPI(notes) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notes })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(`API error: ${response.status} - ${errData.message || errData.error || 'unknown'}`);
    }

    const data = await response.json();
    return data.chords || '（コード推測に失敗しました）';

  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
}

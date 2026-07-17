// Minimal typings for the Web Speech API (not in the default TS DOM lib).
interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  0: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function speechSupported(): boolean {
  return getRecognitionCtor() !== null;
}

/**
 * Drives a single speech-recognition session and streams final transcripts to
 * `onResult`. Designed for "tap to dictate" shop-floor capture: each press
 * records one utterance and appends it to the field.
 */
export function createDictation(
  onResult: (text: string) => void,
  onState: (listening: boolean) => void,
  onError?: (msg: string) => void
): { start: () => void; stop: () => void } {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    onError?.("Speech recognition is not supported in this browser.");
    return { start: () => {}, stop: () => {} };
  }

  const rec = new Ctor();
  rec.lang = "en-US";
  rec.continuous = false;
  rec.interimResults = false;

  rec.onresult = (e) => {
    const result = e.results[e.resultIndex];
    if (result && result.isFinal) {
      onResult(result[0].transcript.trim());
    }
  };
  rec.onerror = (e) => {
    onError?.(e.error || "speech-error");
    onState(false);
  };
  rec.onend = () => onState(false);

  return {
    start: () => {
      try {
        rec.start();
        onState(true);
      } catch {
        onState(false);
      }
    },
    stop: () => {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      onState(false);
    },
  };
}

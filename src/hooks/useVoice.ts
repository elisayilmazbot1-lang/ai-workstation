/**
 * Sesli iletişim (şartname §12).
 *
 * STT: Web Speech API (Chromium/Electron motoru) — ek ücret yok, mikrofon
 *      izni olmadan başlamaz.
 * TTS: speechSynthesis — sistem ses motoru.
 *
 * Sağlayıcı mimarisi değiştirilebilir: `sttProvider`/`ttsProvider` ayarı
 * 'off' yapıldığında hiçbir ses işlemi yapılmaz. Whisper gibi bulut
 * sağlayıcıları için aynı arayüz korunur (kayıt → API → metin).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognition(): SpeechRecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export interface VoiceOptions {
  language?: string;
  enabled?: boolean;
}

export function useVoice({ language = 'tr-TR', enabled = true }: VoiceOptions = {}) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef<((text: string) => void) | undefined>();

  useEffect(() => {
    setSupported(Boolean(getRecognition()) && 'speechSynthesis' in window);
  }, []);

  const start = useCallback(
    (onFinal: (text: string) => void) => {
      const Ctor = getRecognition();
      if (!Ctor || !enabled) {
        setError('Sesli giriş bu ortamda desteklenmiyor. Ayarlar → Ses bölümünü kontrol edin.');
        return;
      }
      setError(undefined);
      onFinalRef.current = onFinal;
      const recognition = new Ctor();
      recognition.lang = language;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        let finalText = '';
        let interimText = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          if (!result) continue;
          const alternative = result[0];
          if (!alternative) continue;
          if (result.isFinal) finalText += alternative.transcript;
          else interimText += alternative.transcript;
        }
        if (interimText) setInterim(interimText);
        if (finalText) {
          setTranscript(finalText);
          setInterim('');
          onFinalRef.current?.(finalText.trim());
        }
      };
      recognition.onerror = (event) => {
        const messages: Record<string, string> = {
          'not-allowed': 'Mikrofon izni verilmedi. Windows ayarlarından mikrofon erişimine izin verin.',
          'service-not-allowed': 'Konuşma tanıma servisi bu cihazda kullanılamıyor.',
          'no-speech': 'Ses algılanamadı, tekrar deneyin.',
          network: 'Konuşma tanıma için ağ bağlantısı gerekiyor.',
          aborted: '',
        };
        const message = messages[event.error] ?? `Ses hatası: ${event.error}`;
        if (message) setError(message);
        setListening(false);
      };
      recognition.onend = () => {
        setListening(false);
        setInterim('');
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
        setListening(true);
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [enabled, language],
  );

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!enabled || !('speechSynthesis' in window) || !text.trim()) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.slice(0, 4000));
      utterance.lang = language;
      utterance.rate = 1;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [enabled, language],
  );

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  useEffect(() => () => {
    recognitionRef.current?.abort();
    window.speechSynthesis?.cancel();
  }, []);

  return { listening, transcript, interim, speaking, error, supported, start, stop, speak, stopSpeaking };
}

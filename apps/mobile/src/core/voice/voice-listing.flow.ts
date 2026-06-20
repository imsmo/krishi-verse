// apps/mobile/src/core/voice/voice-listing.flow.ts · the "Speak to Sell" dictation hook. A screen calls
// useVoiceDictation(lang): tap mic → start() (on-device STT in the user's language) → live transcript → stop().
// The transcript is plain text the farmer can use as the listing description/title. Structured extraction
// (crop / quantity / price) is INTENTIONALLY NOT done here:
//   FLAGGED BACKEND GAP — the PRD's voice→structured-listing needs a server STT+LLM extract endpoint (Google
//   Cloud Speech / AI4Bharat + LLM) that isn't built. We never guess money/quantity from speech on-device
//   (Law 2 / correctness). The user confirms structured fields; voice only fills free text for now.
import { useCallback, useEffect, useRef, useState } from 'react';
import { sttLocaleFor } from './locale';
import { startStt, stopStt } from './stt.client';

export interface VoiceDictation {
  listening: boolean;
  transcript: string;
  error: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  reset: () => void;
}

export function useVoiceDictation(langCode: string): VoiceDictation {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(false);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; void stopStt(); }, []);

  const start = useCallback(async () => {
    setError(false); setTranscript('');
    setListening(true);
    await startStt(sttLocaleFor(langCode), {
      onPartial: (t) => { if (mounted.current) setTranscript(t); },
      onFinal: (t) => { if (mounted.current) { setTranscript(t); setListening(false); } },
      onError: () => { if (mounted.current) { setError(true); setListening(false); } },
    });
  }, [langCode]);

  const stop = useCallback(async () => { await stopStt(); if (mounted.current) setListening(false); }, []);
  const reset = useCallback(() => { setTranscript(''); setError(false); }, []);

  return { listening, transcript, error, start, stop, reset };
}

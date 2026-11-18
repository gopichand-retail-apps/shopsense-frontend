"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { speechRecognitionConstructor, type SpeechRecognitionClient } from "@/lib/speech-recognition";

const subscribe = () => () => {};
const getSupport = () => Boolean(speechRecognitionConstructor());
const getServerSupport = () => false;

export function useVoiceInput(options: {
  locale: string;
  maximumCharacters: number;
  onTranscript: (text: string) => void;
}) {
  const supported = useSyncExternalStore(subscribe, getSupport, getServerSupport);
  const recognition = useRef<SpeechRecognitionClient | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => disposeRecognition(recognition.current), []);

  function toggle() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Constructor = speechRecognitionConstructor();
    if (!Constructor) {
      setError("voiceUnsupported");
      return;
    }
    disposeRecognition(recognition.current);
    const client = new Constructor();
    recognition.current = client;
    client.lang = options.locale;
    client.continuous = false;
    client.interimResults = false;
    client.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript.trim();
      if (transcript) options.onTranscript(transcript.slice(0, options.maximumCharacters));
      else setError("voiceNoSpeech");
    };
    client.onerror = (event) => {
      setListening(false);
      setError(
        event.error === "not-allowed" ? "voiceDenied" : event.error === "no-speech" ? "voiceNoSpeech" : "voiceError",
      );
    };
    client.onend = () => setListening(false);
    setError(null);
    setListening(true);
    try {
      client.start();
    } catch {
      setListening(false);
      setError("voiceError");
    }
  }
  return { supported, listening, error, toggle };
}

function disposeRecognition(client: SpeechRecognitionClient | null) {
  if (!client) return;
  client.onresult = null;
  client.onerror = null;
  client.onend = null;
  client.abort();
}

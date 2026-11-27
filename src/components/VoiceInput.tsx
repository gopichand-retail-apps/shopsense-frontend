"use client";

import { Mic, Square } from "lucide-react";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { copy, type PublicModel } from "@/lib/model";

export function VoiceInput({ model, onTranscript }: { model: PublicModel; onTranscript: (text: string) => void }) {
  const voice = useVoiceInput({
    locale: model.app.locale,
    maximumCharacters: model.search.maximumQueryCharacters,
    onTranscript,
  });
  return (
    <div className="voice-control">
      <button
        type="button"
        className="icon-button"
        disabled={!voice.supported}
        onClick={voice.toggle}
        aria-pressed={voice.listening}
        aria-label={copy(model, voice.listening ? "voiceStop" : "voiceStart")}
        aria-describedby="voice-disclosure"
        title={copy(model, voice.supported ? "voiceStart" : "voiceUnsupported")}
      >
        {voice.listening ? <Square size={17} aria-hidden="true" /> : <Mic size={19} aria-hidden="true" />}
      </button>
      {voice.listening && (
        <span className="voice-status" role="status">
          {copy(model, "voiceListening")}
        </span>
      )}
      {voice.error && (
        <span className="voice-status" role="alert">
          {copy(model, voice.error)}
        </span>
      )}
    </div>
  );
}

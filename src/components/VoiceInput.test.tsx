import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { VoiceInput } from "./VoiceInput";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { speechRecognitionConstructor, type SpeechRecognitionClient } from "@/lib/speech-recognition";
import { model } from "../../tests/shopper-fixtures";

const instances: FakeRecognition[] = [];
function latest() {
  const client = instances.at(-1);
  if (!client) throw new Error("Speech client was not created");
  return client;
}
let rejectStart = false;
class FakeRecognition implements SpeechRecognitionClient {
  lang = "";
  continuous = true;
  interimResults = true;
  onresult: SpeechRecognitionClient["onresult"] = null;
  onerror: SpeechRecognitionClient["onerror"] = null;
  onend: SpeechRecognitionClient["onend"] = null;
  abort = vi.fn();
  constructor() {
    instances.push(this);
  }
  start() {
    if (rejectStart) throw new Error("browser microphone unavailable");
  }
  stop() {
    this.onend?.();
  }
}

function enableVoice(webkit = false) {
  Object.defineProperty(window, webkit ? "webkitSpeechRecognition" : "SpeechRecognition", {
    configurable: true,
    value: FakeRecognition,
  });
}
afterEach(() => {
  Reflect.deleteProperty(window, "SpeechRecognition");
  Reflect.deleteProperty(window, "webkitSpeechRecognition");
  rejectStart = false;
});

it("transcribes into editable text, enforces the input bound and stops without submitting a search", async () => {
  enableVoice();
  const user = userEvent.setup();
  const onTranscript = vi.fn();
  const { unmount } = render(<VoiceInput model={model} onTranscript={onTranscript} />);
  await user.click(screen.getByRole("button", { name: String(model.copy.voiceStart) }));
  expect(latest().lang).toBe("en-US");
  expect(latest().continuous).toBe(false);
  expect(screen.getByRole("status")).toHaveTextContent(String(model.copy.voiceListening));
  act(() => latest().onresult?.({ results: [[{ transcript: "x".repeat(300) }]] }));
  expect(onTranscript).toHaveBeenCalledWith("x".repeat(240));
  await user.click(screen.getByRole("button", { name: String(model.copy.voiceStop) }));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  const client = latest();
  unmount();
  expect(client.abort).toHaveBeenCalled();
  expect(client.onresult).toBeNull();
});

it("reports permission denial, missing speech and recognition errors with recovery", async () => {
  enableVoice(true);
  const user = userEvent.setup();
  render(<VoiceInput model={model} onTranscript={vi.fn()} />);
  await user.click(screen.getByRole("button"));
  act(() => latest().onerror?.({ error: "not-allowed" }));
  expect(screen.getByRole("alert")).toHaveTextContent(String(model.copy.voiceDenied));
  await user.click(screen.getByRole("button"));
  act(() => latest().onresult?.({ results: [] }));
  expect(screen.getByRole("alert")).toHaveTextContent(String(model.copy.voiceNoSpeech));
  act(() => latest().onerror?.({ error: "no-speech" }));
  act(() => latest().onerror?.({ error: "network" }));
  expect(screen.getByRole("alert")).toHaveTextContent(String(model.copy.voiceError));
});

it("handles a rejected microphone start and unsupported browsers", async () => {
  enableVoice();
  rejectStart = true;
  render(<VoiceInput model={model} onTranscript={vi.fn()} />);
  await userEvent.click(screen.getByRole("button"));
  expect(screen.getByRole("alert")).toHaveTextContent(String(model.copy.voiceError));
  Reflect.deleteProperty(window, "SpeechRecognition");
  const hook = renderHook(() => useVoiceInput({ locale: "en-US", maximumCharacters: 240, onTranscript: vi.fn() }));
  act(() => hook.result.current.toggle());
  expect(hook.result.current.error).toBe("voiceUnsupported");
});

it("renders safely on the server and detects unavailable browser globals", () => {
  expect(renderToString(<VoiceInput model={model} onTranscript={vi.fn()} />)).toContain("disabled");
  const originalWindow = window;
  vi.stubGlobal("window", undefined);
  expect(speechRecognitionConstructor()).toBeUndefined();
  vi.stubGlobal("window", originalWindow);
});

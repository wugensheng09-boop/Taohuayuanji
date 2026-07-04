"use client";

import { Mic, MicOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type NativeSpeechPayload = {
  requestId?: string;
  text?: string;
  final?: boolean;
  error?: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0?: { transcript?: string };
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionErrorLike = Event & {
  error?: string;
};

type BrowserSpeechRecognition = EventTarget & {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type RokidNativeBridge = {
  startSpeechRecognition?: (requestId: string) => void;
  stopSpeechRecognition?: () => void;
};

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
    RokidNativeBridge?: RokidNativeBridge;
    __TAOHUAYUAN_NATIVE_SPEECH_RESULT__?: (payload: NativeSpeechPayload) => void;
  }
}

type SpeechInputButtonProps = {
  value: string;
  onChange: (nextValue: string) => void;
  disabled?: boolean;
  maxLength?: number;
  className?: string;
  variant?: "label" | "icon";
  idleLabel?: string;
  listeningLabel?: string;
  unavailableLabel?: string;
  "data-testid"?: string;
};

function appendTranscript(baseValue: string, transcript: string, maxLength?: number): string {
  const cleanTranscript = transcript.replace(/\s+/g, "").trim();
  if (!cleanTranscript) return baseValue;

  const cleanBase = baseValue.trim();
  const separator = cleanBase && !/[，。！？；：,.!?;:]$/.test(cleanBase) ? "，" : "";
  const nextValue = `${cleanBase}${separator}${cleanTranscript}`;

  if (!maxLength || Array.from(nextValue).length <= maxLength) return nextValue;
  return Array.from(nextValue).slice(0, maxLength).join("");
}

export function SpeechInputButton({
  value,
  onChange,
  disabled = false,
  maxLength,
  className = "",
  variant = "label",
  idleLabel = "语音输入",
  listeningLabel = "正在听",
  unavailableLabel = "语音不可用",
  "data-testid": dataTestId,
}: SpeechInputButtonProps) {
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState<"idle" | "unsupported" | "error">("idle");
  const [mounted, setMounted] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const requestIdRef = useRef("");
  const baseValueRef = useRef("");

  const hasNativeSpeech =
    mounted && typeof window !== "undefined" && typeof window.RokidNativeBridge?.startSpeechRecognition === "function";
  const browserSpeechCtor =
    mounted && typeof window !== "undefined" ? window.SpeechRecognition ?? window.webkitSpeechRecognition : undefined;
  const supported = hasNativeSpeech || Boolean(browserSpeechCtor);

  useEffect(() => {
    const mountedTimer = window.setTimeout(() => setMounted(true), 0);
    return () => {
      window.clearTimeout(mountedTimer);
      recognitionRef.current?.abort();
      window.RokidNativeBridge?.stopSpeechRecognition?.();
    };
  }, []);

  useEffect(() => {
    if (!listening || !hasNativeSpeech) return;

    const requestId = requestIdRef.current;
    const previousHandler = window.__TAOHUAYUAN_NATIVE_SPEECH_RESULT__;
    const handler = (payload: NativeSpeechPayload) => {
      if (payload.requestId && payload.requestId !== requestId) return;
      if (payload.error) {
        setStatus("error");
        setListening(false);
        return;
      }
      const transcript = payload.text?.trim() ?? "";
      if (transcript) {
        onChange(appendTranscript(baseValueRef.current, transcript, maxLength));
      }
      if (payload.final) {
        setListening(false);
      }
    };
    window.__TAOHUAYUAN_NATIVE_SPEECH_RESULT__ = handler;

    return () => {
      if (window.__TAOHUAYUAN_NATIVE_SPEECH_RESULT__ === handler) {
        window.__TAOHUAYUAN_NATIVE_SPEECH_RESULT__ = previousHandler;
      }
    };
  }, [hasNativeSpeech, listening, maxLength, onChange]);

  const stopListening = () => {
    recognitionRef.current?.stop();
    window.RokidNativeBridge?.stopSpeechRecognition?.();
    setListening(false);
  };

  const startListening = () => {
    if (disabled) return;
    if (!supported) {
      setStatus("unsupported");
      return;
    }

    if (listening) {
      stopListening();
      return;
    }

    setStatus("idle");
    baseValueRef.current = value;
    requestIdRef.current = `speech_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    if (hasNativeSpeech) {
      setListening(true);
      window.RokidNativeBridge?.startSpeechRecognition?.(requestIdRef.current);
      return;
    }

    if (!browserSpeechCtor) {
      setStatus("unsupported");
      return;
    }

    const recognition = new browserSpeechCtor();
    recognitionRef.current = recognition;
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      let transcript = "";
      let finalResult = false;
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        transcript += result?.[0]?.transcript ?? "";
        finalResult = finalResult || Boolean(result?.isFinal);
      }
      if (transcript.trim()) {
        onChange(appendTranscript(baseValueRef.current, transcript, maxLength));
      }
      if (finalResult) setListening(false);
    };
    recognition.onerror = () => {
      setStatus("error");
      setListening(false);
    };
    recognition.onend = () => setListening(false);

    try {
      recognition.start();
      setListening(true);
    } catch {
      setStatus("error");
      setListening(false);
    }
  };

  const label = !supported || status === "unsupported" ? unavailableLabel : listening ? listeningLabel : idleLabel;
  const iconOnly = variant === "icon";
  const iconSize = iconOnly ? 22 : 16;

  return (
    <button
      type="button"
      data-testid={dataTestId}
      onClick={startListening}
      disabled={disabled || !supported}
      aria-pressed={listening}
      aria-label={label}
      title={status === "error" ? "语音识别失败，请重试或改用文字/跳过" : label}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
    >
      {listening ? <MicOff size={iconSize} /> : <Mic size={iconSize} />}
      <span className={iconOnly ? "sr-only" : ""}>{label}</span>
    </button>
  );
}

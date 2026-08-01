"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  CircleStop,
  Mic,
  Play,
  RefreshCw,
} from "lucide-react";

export type VoiceCaptureValue = {
  transcript: string;
  durationMs: number;
  hasRecording: boolean;
};

type VoiceSpeechResultEvent = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
};

type VoiceSpeechErrorEvent = {
  error?: string;
  message?: string;
};

type VoiceRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult:
    | ((event: VoiceSpeechResultEvent) => void)
    | null;
  onerror:
    | ((event: VoiceSpeechErrorEvent) => void)
    | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type VoiceRecognitionConstructor =
  new () => VoiceRecognition;

type VoiceSpeechWindow = {
  SpeechRecognition?:
    VoiceRecognitionConstructor;
  webkitSpeechRecognition?:
    VoiceRecognitionConstructor;
};

function chooseMimeType() {
  if (
    typeof MediaRecorder ===
    "undefined"
  ) {
    return "";
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];

  return (
    candidates.find(
      (candidate) =>
        MediaRecorder
          .isTypeSupported(
            candidate,
          ),
    ) ?? ""
  );
}

export default function VoiceCapturePanel({
  onChange,
}: {
  onChange: (
    value: VoiceCaptureValue,
  ) => void;
}) {
  const [
    recording,
    setRecording,
  ] = useState(false);

  const [
    transcript,
    setTranscript,
  ] = useState("");

  const [
    interim,
    setInterim,
  ] = useState("");

  const [
    audioUrl,
    setAudioUrl,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    durationMs,
    setDurationMs,
  ] = useState(0);

  const streamRef =
    useRef<MediaStream | null>(
      null,
    );

  const recorderRef =
    useRef<MediaRecorder | null>(
      null,
    );

  const recognitionRef =
    useRef<VoiceRecognition | null>(
      null,
    );

  const chunksRef =
    useRef<Blob[]>([]);

  const finalTranscriptRef =
    useRef("");

  const startedAtRef =
    useRef(0);

  useEffect(() => {
    onChange({
      transcript,
      durationMs,
      hasRecording:
        Boolean(audioUrl),
    });
  }, [
    transcript,
    durationMs,
    audioUrl,
    onChange,
  ]);

  useEffect(() => {
    return () => {
      recognitionRef.current
        ?.stop();

      if (
        recorderRef.current &&
        recorderRef.current
          .state !==
          "inactive"
      ) {
        recorderRef.current
          .stop();
      }

      streamRef.current
        ?.getTracks()
        .forEach(
          (track) =>
            track.stop(),
        );

      if (audioUrl) {
        URL.revokeObjectURL(
          audioUrl,
        );
      }
    };
  }, [audioUrl]);

  async function startRecording() {
    setError("");
    setTranscript("");
    setInterim("");
    setDurationMs(0);
    finalTranscriptRef.current =
      "";

    if (
      !navigator.mediaDevices
        ?.getUserMedia ||
      typeof MediaRecorder ===
        "undefined"
    ) {
      setError(
        "Microphone recording is unavailable in this browser.",
      );
      return;
    }

    try {
      if (audioUrl) {
        URL.revokeObjectURL(
          audioUrl,
        );
        setAudioUrl("");
      }

      const stream =
        await navigator
          .mediaDevices
          .getUserMedia({
            audio: {
              echoCancellation:
                true,
              noiseSuppression:
                true,
              autoGainControl:
                true,
            },
          });

      streamRef.current =
        stream;

      const mimeType =
        chooseMimeType();

      const recorder =
        mimeType
          ? new MediaRecorder(
              stream,
              {
                mimeType,
              },
            )
          : new MediaRecorder(
              stream,
            );

      chunksRef.current =
        [];

      recorder.ondataavailable =
        (event) => {
          if (
            event.data.size >
            0
          ) {
            chunksRef.current
              .push(
                event.data,
              );
          }
        };

      recorder.onstop =
        () => {
          const blob =
            new Blob(
              chunksRef.current,
              {
                type:
                  recorder
                    .mimeType ||
                  "audio/webm",
              },
            );

          if (
            blob.size > 0
          ) {
            setAudioUrl(
              URL.createObjectURL(
                blob,
              ),
            );
          }

          stream
            .getTracks()
            .forEach(
              (track) =>
                track.stop(),
            );

          streamRef.current =
            null;
        };

      const voiceWindow =
        window as unknown as VoiceSpeechWindow;

      const RecognitionClass =
        voiceWindow
          .SpeechRecognition ??
        voiceWindow
          .webkitSpeechRecognition;

      if (RecognitionClass) {
        const VoiceRecognition =
          new RecognitionClass();

        VoiceRecognition.lang =
          "en-US";

        VoiceRecognition.interimResults =
          true;

        VoiceRecognition.continuous =
          true;

        VoiceRecognition.maxAlternatives =
          1;

        VoiceRecognition.onresult =
          (event) => {
            let finalAddition =
              "";

            let interimValue =
              "";

            for (
              let index =
                event.resultIndex;
              index <
              event.results
                .length;
              index += 1
            ) {
              const result =
                event.results[
                  index
                ];

              const value =
                result[0]
                  ?.transcript ??
                "";

              if (
                result.isFinal
              ) {
                finalAddition +=
                  `${value} `;
              } else {
                interimValue +=
                  value;
              }
            }

            if (
              finalAddition
            ) {
              finalTranscriptRef.current =
                `${
                  finalTranscriptRef.current
                } ${finalAddition}`
                  .replace(
                    /\s+/g,
                    " ",
                  )
                  .trim();

              setTranscript(
                finalTranscriptRef.current,
              );
            }

            setInterim(
              interimValue
                .replace(
                  /\s+/g,
                  " ",
                )
                .trim(),
            );
          };

        VoiceRecognition.onerror =
          (event) => {
            setError(
              event.message ||
                event.error ||
                "Automatic speech VoiceRecognition stopped. You can type the transcript below after recording.",
            );
          };

        VoiceRecognition.onend =
          () => {
            setInterim("");
          };

        recognitionRef.current =
          VoiceRecognition;
      } else {
        setError(
          "Automatic speech VoiceRecognition is unavailable. Record your voice, play it back, then type the spoken words below.",
        );
      }

      recorderRef.current =
        recorder;

      startedAtRef.current =
        Date.now();

      recorder.start();

      recognitionRef.current
        ?.start();

      setRecording(true);
    } catch (recordingError) {
      streamRef.current
        ?.getTracks()
        .forEach(
          (track) =>
            track.stop(),
        );

      streamRef.current =
        null;

      setRecording(false);

      setError(
        recordingError instanceof
          Error
          ? recordingError.message
          : "Microphone permission was not granted.",
      );
    }
  }

  function stopRecording() {
    if (!recording) {
      return;
    }

    setRecording(false);

    setDurationMs(
      Math.max(
        1,
        Date.now() -
          startedAtRef.current,
      ),
    );

    recognitionRef.current
      ?.stop();

    const recorder =
      recorderRef.current;

    if (
      recorder &&
      recorder.state !==
        "inactive"
    ) {
      recorder.stop();
    }
  }

  function reset() {
    if (recording) {
      stopRecording();
    }

    if (audioUrl) {
      URL.revokeObjectURL(
        audioUrl,
      );
    }

    setAudioUrl("");
    setTranscript("");
    setInterim("");
    setDurationMs(0);
    setError("");
    finalTranscriptRef.current =
      "";
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-black text-slate-950">
            Your voice
          </p>

          <p className="mt-1 text-sm font-semibold text-slate-500">
            The recording stays in this browser and is not uploaded.
          </p>
        </div>

        {!recording ? (
          <button
            type="button"
            onClick={() =>
              void startRecording()
            }
            className="flex items-center gap-2 rounded-2xl bg-red-600 px-5 py-3 font-black text-white"
          >
            <Mic size={19} />
            Start Recording
          </button>
        ) : (
          <button
            type="button"
            onClick={
              stopRecording
            }
            className="flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 font-black text-white"
          >
            <CircleStop size={19} />
            Stop
          </button>
        )}
      </div>

      {recording ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-red-50 p-4 text-red-800">
          <span className="h-3 w-3 animate-pulse rounded-full bg-red-600" />
          <p className="font-black">
            RecordingÃ¢â‚¬Â¦
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          {error}
        </p>
      ) : null}

      {audioUrl ? (
        <div className="mt-4 rounded-2xl bg-white p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-black">
            <Play size={17} />
            Local playback
          </p>

          <audio
            controls
            src={audioUrl}
            className="w-full"
          />
        </div>
      ) : null}

      <label className="mt-4 block">
        <span className="text-xs font-black uppercase tracking-wide text-slate-500">
          Recognized or typed transcript
        </span>

        <textarea
          value={
            transcript ||
            interim
          }
          onChange={(event) => {
            finalTranscriptRef.current =
              event.target.value;

            setTranscript(
              event.target.value,
            );

            setInterim("");
          }}
          placeholder="Your spoken words will appear here. You may correct VoiceRecognition mistakes before checking."
          className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-white p-4 font-semibold leading-7 outline-none focus:border-blue-600"
        />
      </label>

      <button
        type="button"
        onClick={reset}
        className="mt-4 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-700 shadow"
      >
        <RefreshCw size={17} />
        Record Again
      </button>
    </div>
  );
}

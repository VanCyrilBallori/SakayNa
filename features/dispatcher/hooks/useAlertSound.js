import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

// The emergency alert sound on the dispatcher website (Task 3.13b).
// The file is public/sounds/emergency-alert.wav: a soft "ding-dong" and silence, 2 seconds, played on a loop
// (one ding-dong every 2 seconds) while at least one alert rings. Website only: the browser's own Audio player.
const SOUND_URL = "/sounds/emergency-alert.wav";

// ringing = true while the red strip shows at least one alert.
// Returns:
//   muted / toggleMute: "Sound off" for this page only. A reload turns the sound back on (never remembered).
//   blocked: the browser refused to play because nobody has clicked the page yet (its "no sound before a click" rule).
//   startSound: try again; used by the strip's "Sound blocked: click to turn sound on" button.
export default function useAlertSound(ringing) {
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const audioRef = useRef(null);
  const shouldPlay = Platform.OS === "web" && ringing && !muted;

  const startSound = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio
      .play()
      .then(() => setBlocked(false))
      .catch((error) => {
        // NotAllowedError = the browser's "no sound before a click" rule. AbortError = it was stopped while starting
        // (the alert was answered right away): nothing to do. Anything else (for example a missing file) is only
        // logged: the red strip and the tab title still show the alert.
        if (error?.name === "NotAllowedError") setBlocked(true);
        else if (error?.name !== "AbortError") console.log("Alert sound warning:", error?.message ?? error);
      });
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return undefined;
    if (!audioRef.current) {
      audioRef.current = new Audio(SOUND_URL);
      audioRef.current.loop = true;
    }
    const audio = audioRef.current;

    if (!shouldPlay) {
      // Answered, declined, ended, nothing ringing, or muted: stop and rewind.
      audio.pause();
      audio.currentTime = 0;
      setBlocked(false);
      return undefined;
    }

    startSound();
    // Any click or key press on the page counts for the browser, so try again then (harmless if already playing).
    document.addEventListener("pointerdown", startSound);
    document.addEventListener("keydown", startSound);
    return () => {
      document.removeEventListener("pointerdown", startSound);
      document.removeEventListener("keydown", startSound);
      audio.pause();
      audio.currentTime = 0;
    };
  }, [shouldPlay, startSound]);

  const toggleMute = useCallback(() => setMuted((current) => !current), []);

  return { muted, toggleMute, blocked, startSound };
}

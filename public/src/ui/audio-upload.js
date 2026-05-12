import { addSystemMessage } from "./chat.js";
import { ui } from "./dom.js";

const MAX_AUDIO_SIZE = 12 * 1024 * 1024;

export function initAudioUpload() {
  ui.itemAudioFileInput.addEventListener("change", uploadSelectedAudio);
}

async function uploadSelectedAudio() {
  const file = ui.itemAudioFileInput.files?.[0];
  if (!file) return;
  if (file.size > MAX_AUDIO_SIZE) {
    showStatus("12MB 이하 MP3만 올릴 수 있어.");
    return;
  }

  try {
    showStatus("MP3 업로드 중...");
    const response = await fetch("/api/upload-audio", {
      method: "POST",
      headers: { "Content-Type": file.type || "audio/mpeg" },
      body: file
    });
    const result = await response.json();
    if (!response.ok || !result.ok || !result.url) {
      throw new Error("upload failed");
    }
    ui.itemUrlInput.value = new URL(result.url, location.origin).href;
    showStatus("MP3 업로드 완료");
  } catch {
    showStatus("MP3 업로드 실패");
    addSystemMessage("MP3 파일을 서버에 올리지 못했어.");
  }
}

function showStatus(text) {
  ui.itemUploadStatus.textContent = text;
}

import { addSystemMessage } from "./chat.js";
import { ui } from "./dom.js";

let stream = null;

export function initVoiceButton() {
  ui.voiceToggle.addEventListener("click", toggleVoice);
}

async function toggleVoice() {
  if (stream) {
    stopVoice();
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    addSystemMessage("이 브라우저에서는 마이크 권한을 사용할 수 없어.");
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    ui.voiceToggle.classList.add("active");
    addSystemMessage("마이크 테스트가 켜졌어. 방 송출은 다음 WebRTC 단계에서 연결할게.");
  } catch {
    addSystemMessage("마이크 권한을 받지 못했어.");
  }
}

function stopVoice() {
  for (const track of stream.getTracks()) {
    track.stop();
  }
  stream = null;
  ui.voiceToggle.classList.remove("active");
  addSystemMessage("마이크 테스트를 껐어.");
}

"use strict";
const studioAddress = "hello@oddsignal.example";
const byId = id => document.getElementById(id);
const idea = byId("idea");
const direction = byId("direction");
const bandwidth = byId("package");
const briefForm = byId("brief-form");
const briefStatus = byId("brief-status");
const tuner = byId("tuner");
const instrument = byId("instrument");
const canvas = byId("receiver-canvas");
const modeToggle = byId("mode-toggle");
let currentSignal = null;
let scopeIndex = 0;
const scopes = ["Проба сигнала", "Короткая волна", "Полный спектр"];
function setScope(index) {
  scopeIndex = Math.max(0, Math.min(2, index));
  byId("scope-step").textContent = scopes[scopeIndex];
  byId("scope-step").setAttribute("aria-label", "Объём: " + scopes[scopeIndex] + ". Переключить объём проекта.");
  receiver?.refresh();
}
let receiver;
let live = false;
const draftKey = "odd-signal-brief-v1";
const addressLink = byId("studio-email");
addressLink.textContent = studioAddress;
addressLink.href = "mailto:" + studioAddress;
const channels = ["Интерактивный сайт", "Свой инструмент", "Веб-приложение"];
function readTuner() {
  const value = Number(tuner.value);
  return { name: channels[Math.min(2, Math.floor(value / 34))], frequency: (86 + value * .2).toFixed(1).replace(".", ",") + " МГц", scope: scopes[scopeIndex] };
}
function tune() {
  const signal = readTuner();
  byId("channel-name").textContent = signal.name;
  byId("frequency").textContent = signal.frequency;
  tuner.setAttribute("aria-valuetext", signal.frequency + ", " + signal.name);
  receiver?.refresh();
}
function setLive(value) {
  live = value;
  instrument.classList.toggle("live", live);
  canvas.hidden = !live;
  canvas.tabIndex = live ? 0 : -1;
  instrument.querySelector(".tune-controls").hidden = !live;
  modeToggle.setAttribute("aria-pressed", String(live));
  byId("mode-text").textContent = live ? "Фото" : "Живое 3D";
  if (live && !receiver) receiver = window.createReceiver(canvas, tuner, tune, () => scopeIndex, setScope);
  receiver?.setActive(live);
  tune();
}
modeToggle.addEventListener("click", () => setLive(!live));
byId("hero-tune").addEventListener("click", () => {
  setLive(true);
  tuner.focus({preventScroll:true});
  instrument.scrollIntoView({block:"nearest",behavior:"instant"});
});
byId("scope-step").addEventListener("click", () => setScope((scopeIndex + 1) % scopes.length));
tuner.addEventListener("input", tune);
tune();

const inputs = {
  sentence: ["«Радиостанция из звуков по дороге домой.»", "Крошечная звуковая карта. Коснитесь перекрёстка — и услышите улицу, которая там живёт."],
  mood: ["«Чтобы было как в полночь наткнуться на пиратский телеканал.»", "Онлайн-выставка с ручкой переключения каналов. Каждая частота выводит в эфир нового художника."],
  itch: ["«В нашем магазине сменами меняются в общем чате. Никто не знает, кто открывает.»", "Общая доска смен. Предложите смену, заберите свободную — и сразу видно, у кого завтра ключи."]
};
document.querySelectorAll("[data-input]").forEach(button => {
  button.addEventListener("click", () => {
    const [incoming, decoded] = inputs[button.dataset.input];
    document.querySelectorAll("[data-input]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
    byId("incoming").textContent = incoming;
    byId("decoded").textContent = decoded;
  });
});

function saveDraft() {
  const draft = { idea:idea.value, direction:direction.value, bandwidth:bandwidth.value, signal:currentSignal };
  try { localStorage.setItem(draftKey, JSON.stringify(draft)); } catch { /* File origins may disable local storage. */ }
}
function restoreDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey));
    if (!draft || typeof draft !== "object") return;
    if (typeof draft.idea === "string") idea.value = draft.idea.slice(0,3000);
    for (const [select,value] of [[direction,draft.direction],[bandwidth,draft.bandwidth]]) {
      if ([...select.options].some(option => option.value === value)) select.value = value;
    }
    if (draft.signal && channels.includes(draft.signal.name) && draft.signal.name === direction.value &&
        /^\d{2,3},\d МГц$/.test(draft.signal.frequency)) currentSignal = draft.signal;
  } catch { /* An unavailable or obsolete draft leaves the form ready for a new idea. */ }
}
restoreDraft();
function openBrief(message) {
  location.hash = "contact";
  briefStatus.textContent = message;
  idea.focus({preventScroll:true});
  saveDraft();
}
byId("use-signal").addEventListener("click", () => {
  currentSignal = readTuner();
  direction.value = currentSignal.name;
  bandwidth.value = currentSignal.scope;
  openBrief("Настроено на " + currentSignal.frequency + " · " + currentSignal.name + ".");
});
document.querySelectorAll("[data-package]").forEach(button => {
  button.addEventListener("click", () => {
    bandwidth.value = button.dataset.package;
    openBrief("Выбрано: " + bandwidth.value + ".");
  });
});
briefForm.addEventListener("input", () => {
  if (currentSignal && currentSignal.name !== direction.value) currentSignal = null;
  briefStatus.textContent = "";
  idea.setCustomValidity("");
  saveDraft();
});
function validateIdea() {
  idea.setCustomValidity(idea.value.trim() ? "" : "Напишите пару строк о вашей идее.");
  return briefForm.reportValidity();
}
function briefText() {
  return ["ODD SIGNAL / БРИФ ПРОЕКТА", "", idea.value.trim(), "", "Направление: " + direction.value,
    "Полоса: " + bandwidth.value, ...(currentSignal ? ["Приёмник: " + currentSignal.frequency] : [])].join("\n");
}
function download(url, name) {
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
}
briefForm.addEventListener("submit", event => {
  event.preventDefault();
  if (!validateIdea()) return;
  saveDraft();
  briefStatus.textContent = "Продолжите в почтовом приложении или сохраните бриф текстовым файлом.";
  location.href = "mailto:" + studioAddress + "?subject=" + encodeURIComponent("Выход в эфир / " + direction.value) + "&body=" + encodeURIComponent(briefText());
});
byId("save-brief").addEventListener("click", () => {
  if (!validateIdea()) return;
  const url = URL.createObjectURL(new Blob([briefText()+"\n"], {type:"text/plain;charset=utf-8"}));
  download(url, "odd-signal-brief.txt");
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  briefStatus.textContent = "Бриф сохранён в файл odd-signal-brief.txt.";
});

const dialog = byId("demo-dialog");
const content = byId("demo-content");
let stopDemo = () => {};
let previousFocus;
function showSequencer() {
  content.innerHTML = '<p>Включайте и выключайте шаги. Запустите луп, чтобы его услышать.</p><div class="seq-grid" aria-label="Шаги секвенсора"></div><div class="toy-controls"><button type="button" class="primary" id="seq-play">Запустить луп</button><label for="tempo">Темп <input id="tempo" type="range" min="65" max="165" value="100"><output id="bpm">100 BPM</output></label></div><p role="status" id="audio-status"></p>';
  const grid = content.querySelector(".seq-grid");
  const notes = [130.81,164.81,196,261.63,146.83,174.61,220,293.66];
  const pattern = [true,false,true,false,true,true,false,true];
  const buttons = pattern.map((active,index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "step";
    button.textContent = String(index + 1).padStart(2,"0");
    button.setAttribute("aria-label","Шаг " + (index+1));
    button.setAttribute("aria-pressed",String(active));
    button.addEventListener("click", () => {
      pattern[index] = !pattern[index];
      button.setAttribute("aria-pressed",String(pattern[index]));
    });
    grid.append(button);
    return button;
  });
  let audio, timer, index = 0, playing = false, closed = false;
  const play = byId("seq-play");
  const tempo = byId("tempo");
  tempo.oninput = () => { byId("bpm").textContent = tempo.value + " BPM"; };
  function beat() {
    if (!playing) return;
    const duration = 30 / Number(tempo.value);
    buttons.forEach((b,i) => b.classList.toggle("current",i===index));
    if (pattern[index]) {
      const oscillator = audio.createOscillator(), envelope = audio.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = notes[index];
      const now = audio.currentTime;
      envelope.gain.setValueAtTime(.001,now);
      envelope.gain.exponentialRampToValueAtTime(.21,now+.009);
      envelope.gain.exponentialRampToValueAtTime(.001,now+duration*.83);
      oscillator.connect(envelope);envelope.connect(audio.destination);
      oscillator.onended = () => {oscillator.disconnect();envelope.disconnect();};
      oscillator.start(now);oscillator.stop(now+duration*.86);
    }
    index = (index + 1) % 8;
    timer = setTimeout(beat,duration*1000);
  }
  function pause() {
    playing = false;
    clearTimeout(timer);
    index = 0;
    play.textContent = "Запустить луп";
    buttons.forEach(b => b.classList.remove("current"));
  }
  play.onclick = async () => {
    if (playing) {pause(); return;}
    playing = true;
    try {
      const AudioEngine = window.AudioContext || window.webkitAudioContext;
      if (!audio) audio = new AudioEngine();
      await audio.resume();
      if (closed || !playing) return;
      play.textContent = "Остановить луп";
      beat();
    } catch {
      pause();
      byId("audio-status").textContent = "Звук в этом браузере недоступен.";
    }
  };
  stopDemo = () => {closed=true;pause();if(audio && audio.state!=="closed") audio.close().catch(()=>{});};
}
function showPrinter() {
  content.innerHTML = '<p>Дайте принтеру короткую фразу. Оттиск можно сохранить в PNG.</p><form class="poster-form"><input id="print-phrase" aria-label="Фраза для постера" maxlength="32" value="БУДЬ СТРАННЫМ" required><button type="submit" class="primary">Печать</button></form><canvas class="poster-paper" id="poster" width="520" height="640" aria-label="Сгенерированный типографический постер"></canvas><button type="button" class="download-poster">Сохранить оттиск (.png)</button>';
  const poster = byId("poster"), ctx = poster.getContext("2d");
  function printPoster() {
    const phrase = byId("print-phrase").value.trim().toUpperCase() || "БУДЬ СТРАННЫМ";
    const seed = Array.from(phrase).reduce((state,char) => (state * 31 + char.charCodeAt(0)) >>> 0, 77);
    ctx.fillStyle="#f6f5eb";ctx.fillRect(0,0,520,640);
    ctx.fillStyle="#171815";ctx.fillRect(20,23,480,2);
    ctx.font="bold condensed 15px 'Martian Mono', monospace";ctx.fillText("ODD SIGNAL / AFTERIMAGE",22,50);
    const dot=(x,y,r)=>{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();};
    ctx.save();ctx.beginPath();ctx.rect(22,69,476,246);ctx.clip();
    ctx.fillStyle=(seed%2)?"#d1ff38":"#ff542a";ctx.fillRect(22,69,476,246);
    ctx.fillStyle="#171815";
    for(let y=70;y<330;y+=8)for(let x=20;x<510;x+=8){
      const radius=1+3.8*(.5+.5*Math.cos(Math.hypot(x-(130+seed%290),y-(70+seed%165))*.067+Math.sin(y*.023)*2.6));
      dot(x,y,radius);
    }
    ctx.restore();
    const words = phrase.split(/\s+/);
    const rows = []; let line="";
    for(const word of words){if(line && (line+" "+word).length>10){rows.push(line);line=word;}else line=line?line+" "+word:word;}
    if(line)rows.push(line);
    let size=Math.min(116,Math.floor(236/rows.length));
    ctx.font="900 condensed "+size+"px 'Martian Grotesk', Arial, sans-serif";
    const maxWidth=Math.max(...rows.map(row=>ctx.measureText(row).width));
    size=Math.min(size,Math.floor(size*475/maxWidth));
    ctx.font="900 condensed "+size+"px 'Martian Grotesk', Arial, sans-serif";
    ctx.textBaseline="top";
    rows.forEach((line,i)=>ctx.fillText(line,20,337+i*size*.95));
    ctx.textBaseline="alphabetic";
    for(let i=0;i<91;i++){if(((seed >>> (i%24))+i*7)%5>1)ctx.fillRect(22+i*3,577,2,32);}
    ctx.font="bold condensed 14px 'Martian Mono', monospace";ctx.textAlign="right";ctx.fillText("ОТТИСК / "+(seed%10000).toString().padStart(4,"0"),498,603);ctx.textAlign="left";ctx.fillRect(20,620,480,2);
    poster.setAttribute("aria-label","Напечатанный постер с текстом: "+phrase);
  }
  printPoster();
  content.querySelector("form").onsubmit=event=>{event.preventDefault();printPoster();};
  content.querySelector(".download-poster").onclick=()=>download(poster.toDataURL("image/png"),"afterimage-print.png");
}
document.querySelectorAll("[data-demo]").forEach(button => {
  button.addEventListener("click", () => {
    previousFocus = button;
    const patch = button.dataset.demo === "patchbay";
    byId("demo-title").textContent = patch ? "Patchbay" : "Afterimage";
    if (patch) showSequencer(); else showPrinter();
    dialog.showModal();
  });
});
dialog.querySelector(".close-dialog").addEventListener("click",()=>dialog.close());
dialog.addEventListener("click", event => {
  if(event.target !== dialog)return;
  const rect=dialog.getBoundingClientRect();
  if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();
});
dialog.addEventListener("close", () => {
  stopDemo();
  stopDemo=()=>{};
  content.replaceChildren();
  previousFocus?.focus({preventScroll:true});
});

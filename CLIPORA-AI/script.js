const pages = document.querySelectorAll(".page");
const navButtons = document.querySelectorAll(".nav-btn");

let recordings = [
  {
    title: "Project Discussion.mp4",
    type: "VIDEO",
    notes: "Project changes discussed. UI improvements are needed. Next steps include final testing and deployment."
  },
  {
    title: "Class Recording.mp3",
    type: "AUDIO",
    notes: "Class notes and important topics discussed. Review the lesson and prepare for the next class."
  },
  {
    title: "Team Meeting.mp4",
    type: "VIDEO",
    notes: "Team meeting: review design, assign tasks, discuss project timeline and next steps."
  }
];

let historyItems = ["CLIPORA AI workspace initialized."];
let clipCount = 0;
let selectedURL = null;

const $ = id => document.getElementById(id);
let searchUploadedFile = null;
let searchFileURL = null;

$("searchFile").addEventListener("change", function () {
  const file = this.files[0];

  if (!file) return;

  searchUploadedFile = file;

  if (searchFileURL) {
    URL.revokeObjectURL(searchFileURL);
  }

  searchFileURL = URL.createObjectURL(file);

  const preview = $("searchFilePreview");
  preview.replaceChildren();

  const media = document.createElement(
    file.type.startsWith("audio") ? "audio" : "video"
  );

  media.src = searchFileURL;
  media.controls = true;
  media.style.width = "100%";
  media.style.maxHeight = "250px";

  const details = document.createElement("p");
  details.className = "muted";
  details.textContent =
    "Selected: " + file.name;

  preview.append(media, details);

  notify("File selected successfully!");
});
// AI SUMMARY - file selection
const summaryInput = document.getElementById("summaryFile");

if (summaryInput) {
  summaryInput.addEventListener("change", function () {
    const list = document.getElementById("summaryFileList");
    const status = document.getElementById("summaryStatus");
    const output = document.getElementById("summaryOutput");

    list.replaceChildren();
    output.value = "";

    const files = Array.from(this.files);

    if (files.length === 0) return;

    files.forEach(file => {
      const item = document.createElement("p");
      item.textContent = "📄 " + file.name;
      list.appendChild(item);
    });

    status.textContent =
      files.length + " file(s) selected successfully. " +
      "AI processing is not connected yet.";
  });
}
function showPage(pageId, button) {
  pages.forEach(page => page.classList.toggle("active-page", page.id === pageId));

  navButtons.forEach(btn => btn.classList.toggle("active", btn.dataset.page === pageId));

  if (pageId === "projects") renderProjects();
  if (pageId === "history") renderHistory();
if (pageId === 'ai-summary') {
  document.getElementById('summaryOutput').value = '';
}
  window.scrollTo({ top: 0, behavior: "smooth" });
}

navButtons.forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.page, button));
});

document.querySelectorAll("[data-go]").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.go));
});

function notify(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");

  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => toast.classList.add("hidden"), 2500);
}

function logAction(message) {
  historyItems.unshift(new Date().toLocaleTimeString() + " — " + message);
}

function updateCounts() {
  $("recordCount").textContent = recordings.length;
  $("clipCount").textContent = clipCount;
}

function renderProjects() {
  const box = $("projectList");
  box.replaceChildren();

  recordings.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "record";

    const thumb = document.createElement("div");
    thumb.className = "thumb";
    thumb.textContent = item.type === "AUDIO" ? "🎵" : "🎥";

    const info = document.createElement("div");
    info.className = "record-info";

    const title = document.createElement("strong");
    title.textContent = item.title;

    const notes = document.createElement("small");
    notes.textContent = item.notes || "No notes added";

    info.append(title, notes);

    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = item.type;

    const open = document.createElement("button");
    open.className = "outline";
    open.textContent = "Open";
    open.addEventListener("click", () => openEditor(index));

    row.append(thumb, info, pill, open);
    box.appendChild(row);
  });
}

function renderRecent() {
  const box = $("recentList");
  box.replaceChildren();

  recordings.slice(0, 4).forEach(item => {
    const row = document.createElement("div");
    row.className = "record";

    const thumb = document.createElement("div");
    thumb.className = "thumb";
    thumb.textContent = item.type === "AUDIO" ? "🎵" : "🎥";

    const info = document.createElement("div");
    info.className = "record-info";

    const title = document.createElement("strong");
    title.textContent = item.title;

    const small = document.createElement("small");
    small.textContent = "Available in your project library";

    info.append(title, small);

    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = item.type;

    row.append(thumb, info, pill);
    box.appendChild(row);
  });
}

$("mediaFile").addEventListener("change", event => {
  const file = event.target.files[0];
  if (!file) return;

  $("mediaTitle").value = file.name;

  if (selectedURL) URL.revokeObjectURL(selectedURL);
  selectedURL = URL.createObjectURL(file);

  const preview = $("uploadPreview");
  preview.replaceChildren();

  const media = document.createElement(file.type.startsWith("audio") ? "audio" : "video");
  media.src = selectedURL;
  media.controls = true;
  media.style.width = "100%";
  media.style.maxHeight = "350px";

  const details = document.createElement("p");
  details.className = "muted";
  details.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;

  preview.append(media, details);
});

$("addMediaBtn").addEventListener("click", () => {
  const file = $("mediaFile").files[0];

  if (!file) {
    notify("Please select an audio or video file first.");
    return;
  }

  const title = $("mediaTitle").value.trim() || file.name;

  recordings.unshift({
    title,
    type: file.type.startsWith("audio") ? "AUDIO" : "VIDEO",
    notes: $("notes").value.trim(),
    fileURL: selectedURL
  });

  logAction("Added recording: " + title);

  updateCounts();
  renderProjects();
  renderRecent();

  $("mediaTitle").value = "";
  $("notes").value = "";
  $("mediaFile").value = "";

  notify("Recording added to My Projects!");
});

function searchRecordings() {
  const query = $("query").value.trim().toLowerCase();
  const results = $("searchResults");

  results.replaceChildren();

  if (!query && !searchUploadedFile) {
    notify("Upload a file or enter a search keyword.");
    return;
  }

  const matches = recordings.filter(item => {
    const text = (
      item.title + " " + (item.notes || "")
    ).toLowerCase();

    return query && text.includes(query);
  });

  if (searchUploadedFile) {
    const file = searchUploadedFile;

    const box = document.createElement("div");
    box.className = "result";

    const heading = document.createElement("h3");
    heading.className = "cyan";
    heading.textContent = "Uploaded Recording";

    const details = document.createElement("p");
    details.textContent =
      file.name + " (" +
      (file.size / 1024 / 1024).toFixed(2) +
      " MB)";

    const status = document.createElement("p");
    status.textContent = query
      ? "File selected. Keyword search checks saved titles and notes, not the video or audio contents."
      : "File selected successfully. You can preview it above.";

    box.append(heading, details, status);
    results.appendChild(box);
  }

  matches.forEach(item => {
    const box = document.createElement("div");
    box.className = "result";

    const heading = document.createElement("h3");
    heading.className = "cyan";
    heading.textContent = "Matching Recording";

    const details = document.createElement("p");
    details.textContent =
      item.title + " — " + (item.notes || "No notes added");

    box.append(heading, details);
    results.appendChild(box);
  });

  if (!matches.length && !searchUploadedFile) {
    results.textContent = "No matching recording found.";
  }

  logAction("Searched recordings");
}

  if (!matches.length) {
    const message = document.createElement("div");
    message.className = "result";
    message.textContent = "No matching recording found. Try project, meeting, class, or next steps.";
    results.appendChild(message);
  }

  matches.forEach(item => {
    const result = document.createElement("div");
    result.className = "result";

    const heading = document.createElement("h3");
    heading.className = "cyan";
    heading.textContent = "Relevant Recording Found";

    const details = document.createElement("p");
    details.textContent = item.title + " — " + (item.notes || "No notes added.");

    result.append(heading, details);
    results.appendChild(result);
  });

  logAction(`Searched for "${query}"`);


$("searchBtn").addEventListener("click", showSmartSearchResult);

let smartMediaURL = null;

function showSmartSearchResult() {
  const file = $("searchFile").files[0];
  const question = $("query").value.trim();

  if (!file) {
    alert("Please upload a video or audio file.");
    return;
  }

  if (!question) {
    alert("Please ask a question about your recording.");
    return;
  }

  if (smartMediaURL) {
    URL.revokeObjectURL(smartMediaURL);
  }

  smartMediaURL = URL.createObjectURL(file);

  const isVideo = file.type.startsWith("video/");
  const video = $("clipPreview");
  const audio = $("audioPreview");
  const media = isVideo ? video : audio;
  const other = isVideo ? audio : video;

  other.pause();
  other.removeAttribute("src");
  other.style.display = "none";

  media.src = smartMediaURL;
  media.style.display = "block";

  $("smartResult").style.display = "block";
  $("clipDuration").textContent = "Uploaded: " + file.name;

  $("clipSummary").textContent =
    "Your question: " + question;

  $("smartStatus").textContent =
    "Recording loaded. AI matching, timestamp detection and clip extraction will work after backend integration.";

  $("downloadClip").style.display = "none";

  $("smartResult").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

$("markClipBtn").addEventListener("click", () => {
  const start = Number($("clipStart").value);
  const end = Number($("clipEnd").value);

  if (start < 0 || end <= start) {
    notify("End time must be greater than start time.");
    return;
  }

  clipCount++;
  updateCounts();

  $("clipMessage").textContent = `Clip range marked: ${start}s – ${end}s`;
  logAction(`Marked clip range ${start}s–${end}s`);

  notify("Range marked. Actual video export needs backend processing.");
});

$("summaryBtn").addEventListener("click", () => {
  const text = $("summaryInput").value.trim();

  if (!text) {
    notify("Enter notes or transcript text first.");
    return;
  }

  const sentences = text.match(/[^.!?]+[.!?]?/g) || [text];
  $("summaryText").textContent = sentences.slice(0, 3).join(" ").trim();
  $("summaryResult").classList.remove("hidden");

  logAction("Created summary draft");
  notify("Summary draft created!");
});

$("copySummaryBtn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("summaryText").textContent);
    notify("Summary copied!");
  } catch {
    notify("Please select and copy the summary manually.");
  }
});

function renderHistory() {
  const box = $("historyList");
  box.replaceChildren();

  if (!historyItems.length) {
    box.textContent = "No activity recorded yet.";
    return;
  }

  historyItems.forEach(message => {
    const row = document.createElement("div");
    row.className = "record";

    const icon = document.createElement("div");
    icon.className = "thumb";
    icon.textContent = "◷";

    const text = document.createElement("div");
    text.className = "record-info";
    text.textContent = message;

    row.append(icon, text);
    box.appendChild(row);
  });
}

$("clearHistoryBtn").addEventListener("click", () => {
  historyItems = [];
  renderHistory();
  notify("Edit history cleared.");
});

$("saveProfileBtn").addEventListener("click", () => {
  const name = $("userName").value.trim() || "User";
  $("userEmail").value = $("userEmail").value.trim();

  document.querySelector(".user").lastChild.textContent = " Hello, " + name;
  logAction("Profile updated");

  notify("Profile updated in this prototype.");
});

$("demoBtn").addEventListener("click", () => {
  notify("Upload a video to preview your own recording.");
});

updateCounts();
renderProjects();
renderRecent();
/* CLIPORA AI - VIDEO, PHOTO AND COLLAGE STUDIOS */
(() => {
  const $id = id => document.getElementById(id);
  let videoURL = null;
  let photoURL = null;
  let photoImage = null;
  let collageImages = [];

  function status(id, message) {
    const element = $id(id);
    if (element) element.textContent = message;
  }

  function showStudio(name) {
    $id("studioChoices").classList.add("hidden");
    ["videoStudio", "photoStudio", "collageStudio"].forEach(id => {
      $id(id).classList.add("hidden");
    });

    const target = {
      video: "videoStudio",
      photo: "photoStudio",
      collage: "collageStudio"
    }[name];

    if (target) $id(target).classList.remove("hidden");
  }

  document.querySelectorAll("[data-studio]").forEach(button => {
    button.addEventListener("click", () => showStudio(button.dataset.studio));
  });

  document.querySelectorAll("[data-back]").forEach(button => {
    button.addEventListener("click", () => {
      ["videoStudio", "photoStudio", "collageStudio"].forEach(id =>
        $id(id).classList.add("hidden")
      );
      $id("studioChoices").classList.remove("hidden");
    });
  });

  function setupToolSearch(inputId, listId) {
    $id(inputId).addEventListener("input", event => {
      const query = event.target.value.toLowerCase();
      $id(listId).querySelectorAll("button").forEach(button => {
        button.hidden = !button.textContent.toLowerCase().includes(query);
      });
    });
  }

  setupToolSearch("veToolSearch", "veTools");
  setupToolSearch("peToolSearch", "peTools");

  $id("veFile").addEventListener("change", event => {
    const file = event.target.files[0];
    if (!file) return;

    if (videoURL) URL.revokeObjectURL(videoURL);
    videoURL = URL.createObjectURL(file);

    const video = $id("vePreview");
    video.src = videoURL;
    video.style.display = "block";
    video.onloadedmetadata = () => {
      $id("veStart").max = video.duration;
      $id("veEnd").max = video.duration;
      $id("veEnd").value = Math.floor(video.duration);
      $id("vePlayhead").max = video.duration;
      status("veStatus", `Loaded ${file.name} · ${video.duration.toFixed(1)} seconds`);
    };
  });

  $id("veSpeed").addEventListener("change", event => {
    $id("vePreview").playbackRate = Number(event.target.value);
  });

  $id("veVolume").addEventListener("input", event => {
    $id("vePreview").volume = Number(event.target.value);
  });

  $id("vePlayhead").addEventListener("input", event => {
    const video = $id("vePreview");
    if (video.src) video.currentTime = Number(event.target.value);
  });

  $id("veApply").addEventListener("click", () => {
    const video = $id("vePreview");
    video.style.filter = $id("veFilter").value;
    $id("veOverlay").textContent = $id("veText").value;
    status("veStatus", "Preview settings applied. Export still needs media rendering.");
  });

  $id("veTrimPreview").addEventListener("click", () => {
    const video = $id("vePreview");
    const start = Number($id("veStart").value);
    const end = Number($id("veEnd").value);

    if (!video.src) return status("veStatus", "Upload a video first.");
    if (start < 0 || end <= start || end > video.duration) {
      return status("veStatus", "Enter a valid trim range within the video.");
    }

    video.currentTime = start;
    video.play();
    video.ontimeupdate = () => {
      if (video.currentTime >= end) {
        video.pause();
        video.ontimeupdate = null;
      }
    };
    status("veStatus", `Previewing ${start}s to ${end}s. This does not create a separate clip.`);
  });

  $id("veExport").addEventListener("click", () => {
    status("veStatus", "Downloadable edited video export is not implemented yet. It needs media rendering; this button does not export an edited file.");
  });

  $id("veTools").addEventListener("click", event => {
    const button = event.target.closest("[data-ve-tool]");
    if (!button) return;

    const video = $id("vePreview");
    const tool = button.dataset.veTool;

    if (tool === "trim") $id("veStart").focus();
    if (tool === "speed") $id("veSpeed").focus();
    if (tool === "volume") $id("veVolume").focus();
    if (tool === "filter") $id("veFilter").focus();
    if (tool === "text") $id("veText").focus();

    if (tool === "split") {
      status("veStatus", "Split needs a media-processing library to create separate clips.");
    }
  });

  $id("peFiles").addEventListener("change", event => {
    const file = event.target.files[0];
    if (!file) return;
    if (photoURL) URL.revokeObjectURL(photoURL);
    photoURL = URL.createObjectURL(file);

    const image = $id("pePreview");
    image.onload = () => {
      photoImage = image;
      $id("pePlaceholder").style.display = "none";
      status("peStatus", `Loaded ${file.name}`);
    };
    image.src = photoURL;
    image.style.display = "block";
  });

  function photoFilter() {
    $id("pePreview").style.filter =
      `brightness(${$id("peBrightness").value}%) contrast(${$id("peContrast").value}%) ${$id("peFilter").value}`;
  }

  ["peBrightness", "peContrast", "peFilter"].forEach(id => {
    $id(id).addEventListener("input", photoFilter);
  });

  $id("peApply").addEventListener("click", () => {
    if (!photoImage) return status("peStatus", "Upload a photo first.");
    photoFilter();
    status("peStatus", "Preview adjustments applied.");
  });

  $id("peTools").addEventListener("click", event => {
    const button = event.target.closest("[data-pe-tool]");
    if (!button || !photoImage) {
      if (button) status("peStatus", "Upload a photo first.");
      return;
    }
    if (button.dataset.peTool === "rotate") {
      photoImage.style.transform =
        photoImage.style.transform === "rotate(90deg)" ? "" : "rotate(90deg)";
    }
    if (button.dataset.peTool === "grayscale") {
      $id("peFilter").value = "grayscale(1)";
      photoFilter();
    }
    if (button.dataset.peTool === "sepia") {
      $id("peFilter").value = "sepia(1)";
      photoFilter();
    }
    if (button.dataset.peTool === "crop") {
      status("peStatus", "Use your browser's image editor or add a crop library for actual crop selection.");
    }
  });

  $id("peDownload").addEventListener("click", () => {
    if (!photoImage) return status("peStatus", "Upload a photo first.");

    const canvas = document.createElement("canvas");
    canvas.width = photoImage.naturalWidth;
    canvas.height = photoImage.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.filter = `brightness(${$id("peBrightness").value}%) contrast(${$id("peContrast").value}%) ${$id("peFilter").value}`;
    ctx.drawImage(photoImage, 0, 0);

    const caption = $id("peText").value.trim();
    if (caption) {
      ctx.filter = "none";
      ctx.font = `${Math.max(20, canvas.width / 24)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#000";
      ctx.fillStyle = "#fff";
      ctx.strokeText(caption, canvas.width / 2, canvas.height - 30);
      ctx.fillText(caption, canvas.width / 2, canvas.height - 30);
    }

    const link = document.createElement("a");
    link.download = "clipora-edited-photo.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    status("peStatus", "Edited photo downloaded.");
  });

  $id("coFiles").addEventListener("change", event => {
    collageImages.forEach(item => URL.revokeObjectURL(item.url));
    collageImages = Array.from(event.target.files).slice(0, 6).map(file => ({
      url: URL.createObjectURL(file),
      name: file.name
    }));
    renderCollage();
  });

  function renderCollage() {
    const canvas = $id("coCanvas");
    canvas.replaceChildren();
    canvas.style.background = $id("coBg").value;
    canvas.style.gap = `${$id("coGap").value}px`;

    if (!collageImages.length) {
      canvas.textContent = "Choose photos to build your collage.";
      return;
    }

    const columns = Number($id("coLayout").value);
    canvas.style.display = "grid";
    canvas.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;

    collageImages.forEach(item => {
      const img = document.createElement("img");
      img.src = item.url;
      img.alt = item.name;
      img.style.width = "100%";
      img.style.height = "180px";
      canvas.appendChild(img);
    });
    status("coStatus", `${collageImages.length} photo(s) in collage.`);
  }

  ["coLayout", "coGap", "coBg"].forEach(id => {
    $id(id).addEventListener("input", renderCollage);
  });

  $id("coDownload").addEventListener("click", async () => {
    if (!collageImages.length) return status("coStatus", "Upload photos first.");

    const columns = Number($id("coLayout").value);
    const gap = Number($id("coGap").value);
    const cellW = 400;
    const cellH = 300;
    const rows = Math.ceil(collageImages.length / columns);
    const canvas = document.createElement("canvas");
    canvas.width = columns * cellW + (columns + 1) * gap;
    canvas.height = rows * cellH + (rows + 1) * gap;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = $id("coBg").value;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    try {
      for (let i = 0; i < collageImages.length; i++) {
        const img = new Image();
        img.src = collageImages[i].url;
        await img.decode();

        const x = gap + (i % columns) * cellW;
        const y = gap + Math.floor(i / columns) * cellH;
        const scale = Math.max(cellW / img.width, cellH / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, cellW, cellH);
        ctx.clip();
        ctx.drawImage(img, x + (cellW - w) / 2, y + (cellH - h) / 2, w, h);
        ctx.restore();
      }

      const link = document.createElement("a");
      link.download = "clipora-collage.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
      status("coStatus", "Collage downloaded.");
    } catch {
      status("coStatus", "Could not create collage. Try different image files.");
    }
  });
})();
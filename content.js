// Content script for TruthSync AI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "CRAWL_NEWS_METADATA") {
    const selectedText = window.getSelection().toString().stripText() || message.selectionText || "";

    const articleTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') 
      || document.querySelector('.media_end_head_title_text')?.textContent 
      || document.title 
      || "";

    const articleUrl = document.querySelector('meta[property="og:url"]')?.getAttribute('content') 
      || window.location.href;

    const publishedDate = document.querySelector('span.media_end_head_info_datestamp_time')?.getAttribute('data-date-time')
      || document.querySelector('span.media_end_head_info_datestamp_time')?.textContent
      || document.querySelector('meta[property="article:published_time"]')?.getAttribute('content')
      || new Date().toISOString();

    const payload = {
      selected_text: selectedText.trim(),
      article_title: articleTitle.trim(),
      article_url: articleUrl.trim(),
      published_date: publishedDate.trim()
    };

    sendResponse(payload);
  }

  else if (message.action === "SHOW_TOAST") {
    showToast(message.toastType, message.message);
  }

  else if (message.action === "HIDE_TOAST") {
    hideToast();
  }

  else if (message.action === "SHOW_CANDIDATE_MODAL") {
    showCandidateModal(message.hearingName, message.selectedText, message.candidates);
  }
});

String.prototype.stripText = function() {
  return this.replace(/\s+/g, ' ').trim();
};

// Inject UI styles
function injectStyles() {
  if (document.getElementById("truthsync-styles")) return;

  const styleEl = document.createElement("style");
  styleEl.id = "truthsync-styles";
  styleEl.textContent = `
    #truthsync-toast {
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 10000000;
      padding: 16px 24px;
      border-radius: 12px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      font-weight: 500;
      line-height: 1.5;
      color: #ffffff;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.3), 0 4px 12px rgba(15, 23, 42, 0.1);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      transform: translateY(-20px);
      opacity: 0;
      display: flex;
      align-items: center;
      gap: 12px;
      max-width: 380px;
    }

    #truthsync-toast.show {
      transform: translateY(0);
      opacity: 1;
    }

    #truthsync-toast.loading {
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(99, 102, 241, 0.2);
    }

    #truthsync-toast.error {
      background: rgba(220, 38, 38, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .ts-cancel-btn {
      background: rgba(255, 255, 255, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 4px 8px;
      border-radius: 6px;
      color: #cbd5e1;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      margin-left: 8px;
      white-space: nowrap;
    }

    .ts-cancel-btn:hover {
      background: rgba(239, 68, 68, 0.3);
      color: #fca5a5;
      border-color: rgba(239, 68, 68, 0.2);
    }

    #truthsync-modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15, 23, 42, 0.5);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 99999998;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    #truthsync-modal-backdrop.show {
      opacity: 1;
    }

    #truthsync-modal-card {
      width: 100%;
      max-width: 680px;
      background: rgba(15, 23, 42, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.1);
      color: #f8fafc;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 32px;
      box-sizing: border-box;
      transform: scale(0.95) translateY(10px);
      transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    #truthsync-modal-backdrop.show #truthsync-modal-card {
      transform: scale(1) translateY(0);
    }

    .ts-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      padding-bottom: 18px;
    }

    .ts-logo-section h1 {
      font-size: 22px;
      font-weight: 800;
      margin: 0;
      background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.5px;
    }

    .ts-logo-section p {
      font-size: 13px;
      color: #94a3b8;
      margin: 4px 0 0 0;
    }

    .ts-close-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.05);
      width: 28px;
      height: 28px;
      border-radius: 50%;
      color: #94a3b8;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 16px;
      transition: all 0.2s;
    }

    .ts-close-btn:hover {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
      border-color: rgba(239, 68, 68, 0.1);
    }

    .ts-context-box {
      background: rgba(255, 255, 255, 0.03);
      border-left: 4px solid #e11d48;
      border-radius: 4px 10px 10px 4px;
      padding: 14px 18px;
    }

    .ts-context-box h3 {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #fda4af;
      margin: 0 0 6px 0;
      font-weight: 700;
    }

    .ts-context-box blockquote {
      font-size: 13px;
      color: #cbd5e1;
      margin: 0;
      font-style: italic;
      line-height: 1.6;
    }

    .ts-candidates-section h2 {
      font-size: 15px;
      font-weight: 700;
      margin: 0 0 14px 0;
      color: #e2e8f0;
    }

    .ts-candidates-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .ts-candidate-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 16px;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      align-items: center;
      gap: 20px;
      position: relative;
      overflow: hidden;
    }

    .ts-candidate-card:hover {
      background: rgba(225, 29, 72, 0.06);
      border-color: rgba(225, 29, 72, 0.25);
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(225, 29, 72, 0.15);
    }

    .ts-card-left {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 130px;
    }

    .ts-badge-time {
      background: linear-gradient(135deg, #e11d48 0%, #9f1239 100%);
      color: #ffffff;
      font-size: 12px;
      font-weight: 700;
      padding: 6px 12px;
      border-radius: 8px;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }

    .ts-card-right {
      flex: 1;
    }

    .ts-quote-text {
      font-size: 14px;
      color: #e2e8f0;
      line-height: 1.6;
      margin: 0;
    }

    .ts-spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.2);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(styleEl);
}

// Display toast notifications
function showToast(type, message) {
  injectStyles();
  
  let toast = document.getElementById("truthsync-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "truthsync-toast";
    document.body.appendChild(toast);
  }

  toast.className = "";
  toast.innerHTML = "";
  toast.classList.add(type);

  if (type === "loading") {
    const spinner = document.createElement("div");
    spinner.className = "ts-spinner";
    toast.appendChild(spinner);
  }

  const textEl = document.createElement("span");
  textEl.textContent = message;
  toast.appendChild(textEl);

  if (type === "loading") {
    const cancelEl = document.createElement("button");
    cancelEl.className = "ts-cancel-btn";
    cancelEl.textContent = "중단";
    cancelEl.addEventListener("click", () => {
      chrome.runtime.sendMessage({ action: "CANCEL_SEARCH" });
      showToast("error", "🛑 사용자에 의해 분석이 중단되었습니다.");
    });
    toast.appendChild(cancelEl);
  }

  setTimeout(() => {
    toast.classList.add("show");
  }, 10);

  if (type === "error") {
    setTimeout(() => {
      hideToast();
    }, 6000);
  }
}

// Display candidates modal
function showCandidateModal(hearingName, selectedText, candidates) {
  injectStyles();
  removeCandidateModal();

  const backdrop = document.createElement("div");
  backdrop.id = "truthsync-modal-backdrop";
  
  const card = document.createElement("div");
  card.id = "truthsync-modal-card";
  
  const closeModal = () => {
    backdrop.classList.remove("show");
    setTimeout(() => {
      if (backdrop.parentNode) {
        backdrop.parentNode.removeChild(backdrop);
      }
    }, 350);
  };

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });

  card.innerHTML = `
    <div class="ts-header">
      <div class="ts-logo-section">
        <h1>TruthSync: 뉴스 원본 발언 검증</h1>
        <p>🔍 추론된 행사/이벤트: <strong>${hearingName}</strong></p>
      </div>
      <button class="ts-close-btn" title="닫기">✕</button>
    </div>

    <div class="ts-context-box">
      <h3>내가 선택한 뉴스 기사 문장</h3>
      <blockquote>"${selectedText}"</blockquote>
    </div>

    <div class="ts-candidates-section">
      <h2>🎥 일치하는 생중계 발언 후보</h2>
      <div class="ts-candidates-list" id="ts-list-container"></div>
    </div>
  `;

  backdrop.appendChild(card);
  document.body.appendChild(backdrop);

  card.querySelector(".ts-close-btn").addEventListener("click", closeModal);

  const listContainer = card.querySelector("#ts-list-container");
  
  candidates.forEach((cand, idx) => {
    const cardEl = document.createElement("div");
    cardEl.className = "ts-candidate-card";
    
    let highlightedText = cand.matched_text;
    const words = selectedText.split(/\s+/).filter(w => w.length > 1);
    words.forEach(word => {
      try {
        const regex = new RegExp(`(${word})`, 'gi');
        highlightedText = highlightedText.replace(regex, '<strong style="color: #fda4af; font-weight: 700;">$1</strong>');
      } catch(e) {}
    });

    cardEl.innerHTML = `
      <div class="ts-card-left">
        <div class="ts-badge-time">⏱️ ${cand.timestamp_formatted}</div>
      </div>
      <div class="ts-card-right">
        <p class="ts-quote-text">"... ${highlightedText} ..."</p>
      </div>
    `;

    cardEl.addEventListener("click", () => {
      window.open(cand.youtube_url, "_blank");
    });

    listContainer.appendChild(cardEl);
  });

  setTimeout(() => {
    backdrop.classList.add("show");
  }, 30);
}

function hideToast() {
  const toast = document.getElementById("truthsync-toast");
  if (toast) {
    toast.classList.remove("show");
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }
}

function removeCandidateModal() {
  const oldBackdrop = document.getElementById("truthsync-modal-backdrop");
  if (oldBackdrop && oldBackdrop.parentNode) {
    oldBackdrop.parentNode.removeChild(oldBackdrop);
  }
}

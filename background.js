// Background service worker for TruthSync AI
let isSearching = false;
let activeAbortController = null;

// Create context menu on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "truthsync-verify",
    title: "TruthSync: 원본 영상 찾기",
    contexts: ["selection"]
  });
  console.log("TruthSync context menu registered.");
});

// Listen for context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "truthsync-verify") {
    if (!tab || !tab.id) {
      console.error("No active tab.");
      return;
    }

    if (isSearching) {
      chrome.tabs.sendMessage(tab.id, {
        action: "SHOW_TOAST",
        toastType: "error",
        message: "⚠️ 이미 다른 발언 분석이 진행 중입니다. 잠시만 기다려 주세요!"
      });
      return;
    }

    const selectionText = info.selectionText;
    isSearching = true;

    // Request metadata from content script
    chrome.tabs.sendMessage(
      tab.id,
      {
        action: "CRAWL_NEWS_METADATA",
        selectionText: selectionText
      },
      async (response) => {
        if (chrome.runtime.lastError || !response) {
          console.warn("Content script response missing, running fallback.", chrome.runtime.lastError);
          fallbackVerify(selectionText, tab);
          return;
        }
        await verifyAndDisplayCandidates(response, tab.id);
      }
    );
  }
});

// Listen for cancel search request
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "CANCEL_SEARCH") {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    isSearching = false;
  }
});

// Fallback verification when content script fails to load
function fallbackVerify(selectionText, tab) {
  const fallbackPayload = {
    selected_text: selectionText,
    article_title: tab.title || "네이버 뉴스 기사",
    article_url: tab.url || "https://news.naver.com",
    published_date: new Date().toISOString()
  };
  
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"]
  }, () => {
    if (chrome.runtime.lastError) {
      console.error("Failed to inject content.js:", chrome.runtime.lastError);
      isSearching = false;
      return;
    }
    verifyAndDisplayCandidates(fallbackPayload, tab.id);
  });
}

// Call backend API on port 8001 and handle UI toast
async function verifyAndDisplayCandidates(payload, tabId) {
  chrome.tabs.sendMessage(tabId, {
    action: "SHOW_TOAST",
    toastType: "loading",
    message: "🔍 TruthSync가 원본 생중계 자막 데이터와 대조하고 있습니다..."
  });

  activeAbortController = new AbortController();
  const signal = activeAbortController.signal;

  try {
    const response = await fetch("http://localhost:8001/api/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: signal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    chrome.tabs.sendMessage(tabId, { action: "HIDE_TOAST" });

    if (!data.candidates || data.candidates.length === 0) {
      chrome.tabs.sendMessage(tabId, {
        action: "SHOW_TOAST",
        toastType: "error",
        message: "❌ 해당 기사 발언과 일치하는 원본 영상 자막 구절을 찾을 수 없습니다."
      });
      return;
    }

    chrome.tabs.sendMessage(tabId, {
      action: "SHOW_CANDIDATE_MODAL",
      hearingName: data.hearing_name,
      selectedText: payload.selected_text,
      candidates: data.candidates
    });

  } catch (error) {
    console.error("API error:", error);
    if (error.name === "AbortError") {
      console.log("Search request cancelled.");
      return;
    }
    
    chrome.tabs.sendMessage(tabId, { action: "HIDE_TOAST" });
    chrome.tabs.sendMessage(tabId, {
      action: "SHOW_TOAST",
      toastType: "error",
      message: "⚠️ TruthSync AI 백엔드 서버(http://localhost:8001)에 연결하지 못했습니다. 서버가 실행 중인지 확인하세요."
    });
  } finally {
    isSearching = false;
  }
}

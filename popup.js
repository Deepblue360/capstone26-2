document.addEventListener("DOMContentLoaded", async () => {
  const pingDot = document.getElementById("ping-dot");
  const pingText = document.getElementById("ping-text");

  const checkBackendStatus = async () => {
    try {
      const response = await fetch("http://localhost:8001/api/health", {
        method: "GET",
        mode: "cors"
      });

      if (response.ok) {
        pingDot.className = "dot pulsing-green";
        pingText.textContent = "백엔드 연결됨";
      } else {
        throw new Error("API returned error status");
      }
    } catch (err) {
      console.warn("FastAPI status check failed:", err);
      pingDot.className = "dot pulsing-orange";
      pingText.textContent = "백엔드 연결 끊김";
    }
  };

  await checkBackendStatus();
});

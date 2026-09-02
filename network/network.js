const form = document.querySelector("#unlockForm");
const passwordInput = document.querySelector("#password");
const togglePassword = document.querySelector("#togglePassword");
const message = document.querySelector("#message");

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function setMessage(text, type = "") {
  message.textContent = text;
  message.className = `message ${type}`.trim();
}

togglePassword.addEventListener("click", () => {
  const showing = passwordInput.type === "text";
  passwordInput.type = showing ? "password" : "text";
  togglePassword.textContent = showing ? "显示" : "隐藏";
  passwordInput.focus();
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  const password = passwordInput.value;
  if (!password) return;

  const submitButton = form.querySelector("button[type='submit']");
  submitButton.disabled = true;
  setMessage("正在本地验证并生成配置包……");

  try {
    const response = await fetch("config.enc.json", { cache: "no-store" });
    if (!response.ok) throw new Error("配置文件暂时不可用");
    const payload = await response.json();
    const passwordBytes = new TextEncoder().encode(password);
    const material = await crypto.subtle.importKey("raw", passwordBytes, "PBKDF2", false, ["deriveKey"]);
    const keyBits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: base64ToBytes(payload.salt), iterations: payload.iterations, hash: "SHA-256" },
      material,
      512
    );
    const encryptionKeyBytes = keyBits.slice(0, 32);
    const authenticationKeyBytes = keyBits.slice(32, 64);
    const authenticationKey = await crypto.subtle.importKey(
      "raw",
      authenticationKeyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const iv = base64ToBytes(payload.iv);
    const ciphertext = base64ToBytes(payload.ciphertext);
    const authenticatedBytes = new Uint8Array(iv.length + ciphertext.length);
    authenticatedBytes.set(iv, 0);
    authenticatedBytes.set(ciphertext, iv.length);
    const valid = await crypto.subtle.verify(
      "HMAC",
      authenticationKey,
      base64ToBytes(payload.tag),
      authenticatedBytes
    );
    if (!valid) throw new Error("配置口令错误");
    const encryptionKey = await crypto.subtle.importKey(
      "raw",
      encryptionKeyBytes,
      "AES-CBC",
      false,
      ["decrypt"]
    );
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-CBC", iv },
      encryptionKey,
      ciphertext
    );
    const blob = new Blob([decrypted], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = payload.filename || "ZeroTier自动配置包.zip";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    passwordInput.value = "";
    setMessage("验证成功，配置包已经开始下载。", "success");
  } catch (error) {
    console.error(error);
    setMessage("口令不正确，或者配置文件暂时不可用。", "error");
  } finally {
    submitButton.disabled = false;
  }
});

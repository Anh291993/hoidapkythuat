// --- Lấy các element của phần chat ---
const chatSection = document.getElementById('chat-section');
const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const chatListDesktop = document.getElementById('chat-list-desktop');
const chatListMobile = document.getElementById('chat-list-mobile');
const chatTitleDesktop = document.getElementById('chat-title-desktop');
const chatTitleMobile = document.getElementById('chat-title-mobile');
const sidebarOffcanvasElement = document.getElementById('sidebarOffcanvas');
const voiceInputButton = document.getElementById('voice-input-button');

let currentWebhookUrl = '';
let currentSessionId = '';

function generateSessionId() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  } else {
    return 'sid-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
  }
}

// === Giọng nói ===
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        voiceInputButton.classList.add('is-listening');
        voiceInputButton.disabled = true;
    };

    recognition.onend = () => {
        voiceInputButton.classList.remove('is-listening');
        voiceInputButton.disabled = false;
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        userInput.value = transcript;
        setTimeout(() => {
            if (userInput.value.trim() !== "") {
                sendChatMessage();
            }
        }, 300);
    };

    recognition.onerror = (event) => {
        let errorMessage = "Đã xảy ra lỗi khi nhận dạng giọng nói.";
        if (event.error == 'no-speech') {
            errorMessage = "Không phát hiện thấy giọng nói. Vui lòng thử lại.";
        } else if (event.error == 'not-allowed') {
            errorMessage = "Bạn cần cấp quyền truy cập micro.";
        }
        addChatMessage('error', errorMessage);
    };

    voiceInputButton.addEventListener('click', () => {
        try { recognition.start(); }
        catch (e) {
            addChatMessage('error', 'Không thể bắt đầu nhận dạng giọng nói.');
        }
    });

} else {
    voiceInputButton.style.display = 'none';
}

// === Hiển thị tin nhắn ===
function addChatMessage(sender, text) {
    const messageWrapper = document.createElement('div');
    messageWrapper.classList.add('message-bubble-wrapper');
    if (sender === 'user') messageWrapper.classList.add('user-bubble-wrapper');
    else if (sender === 'assistant') messageWrapper.classList.add('assistant-bubble-wrapper');
    else if (sender === 'error') messageWrapper.classList.add('error-bubble-wrapper');

    const messageBubble = document.createElement('div');
    messageBubble.classList.add('message-bubble');

    if (sender === 'assistant') {
        if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
            const correctedMarkdown = preprocessMarkdown(text);
            try {
                messageBubble.innerHTML = marked.parse(correctedMarkdown);
            } catch (e) {
                console.error("Lỗi khi parse markdown:", e);
                messageBubble.innerHTML = correctedMarkdown.replace(/\n/g, '<br>');
            }
        } else {
            console.warn("marked.js chưa được load hoặc không hỗ trợ parse.");
            messageBubble.innerHTML = text.replace(/\n/g, '<br>');
        }
    } else {
        messageBubble.textContent = text;
    }

    if (sender === 'user') messageBubble.classList.add('user-bubble');
    else if (sender === 'assistant') messageBubble.classList.add('assistant-bubble');
    else if (sender === 'error') messageBubble.classList.add('error-bubble');

    messageWrapper.appendChild(messageBubble);
    chatBox.appendChild(messageWrapper);
    chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
}
// === Xử lý Markdown ===
function preprocessMarkdown(text) {
    if (!text) return '';
    let correctedText = text;
    correctedText = correctedText.replace(/^( *)(\*)[ ]*([^\s*])/gm, '$1$2 $3');
    correctedText = correctedText.replace(/\*{3}(.*?)\*{3}/g, '**$1**');
    correctedText = correctedText.replace(/\n(\* \*\*.*?\*\*:\)/g, '\n\n$1');
    correctedText = correctedText.replace(/\* \*\*(.*?)\*\*:/g, '* **$1**:\n');
    return correctedText;
}

function showTypingIndicator() {
    if (document.getElementById('typing-indicator')) return;
    const typingIndicatorWrapper = document.createElement('div');
    typingIndicatorWrapper.id = 'typing-indicator';
    typingIndicatorWrapper.classList.add('message-bubble-wrapper', 'assistant-bubble-wrapper');
    typingIndicatorWrapper.innerHTML = `
        <div class="message-bubble assistant-bubble d-flex align-items-center" style="padding: 0.5rem 1rem;">
            <span class="spinner-grow spinner-grow-sm me-2"></span>
            <span>Đang soạn...</span>
        </div>
    `;
    chatBox.appendChild(typingIndicatorWrapper);
    chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
}

async function sendChatMessage() {
    const question = userInput.value.trim();
    if (!currentWebhookUrl) {
        addChatMessage('error', 'Vui lòng chọn một chủ đề chat từ menu.');
        return;
    }
    if (!currentSessionId) {
        addChatMessage('error', 'Lỗi: Không thể tạo ID phiên chat.');
        return;
    }
    if (!question) return;

    addChatMessage('user', question);
    userInput.value = '';
    sendButton.disabled = true;
    showTypingIndicator();
try {
        const res = await fetch(currentWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, sessionId: currentSessionId })
        });

        removeTypingIndicator();
        const data = await res.json();

        if (!res.ok || !data.answer) {
            throw new Error(data.message || 'Phản hồi không hợp lệ.');
        }
        addChatMessage('assistant', data.answer);
    } catch (error) {
        removeTypingIndicator();
        addChatMessage('error', `Lỗi: ${error.message}`);
    } finally {
        sendButton.disabled = false;
        userInput.focus();
    }
}

function setActiveChat(linkElement) {
    if (!linkElement || linkElement.classList.contains('active')) return;

    const webhookUrl = linkElement.dataset.webhookUrl;
    if (!webhookUrl) {
        addChatMessage('error', 'Chủ đề này chưa được cấu hình Webhook.');
        return;
    }

    const iconElement = linkElement.querySelector('i');
    const topicName = iconElement
        ? linkElement.textContent.replace(iconElement.textContent, '').trim()
        : linkElement.textContent.trim();

    currentSessionId = generateSessionId();
    currentWebhookUrl = webhookUrl;

    chatBox.innerHTML = '';
    addChatMessage('assistant', `Bắt đầu chat về chủ đề: ${topicName}`);
    chatTitleDesktop.textContent = topicName;
    chatTitleMobile.textContent = topicName;

    document.querySelectorAll('.chat-topic-link').forEach(link => link.classList.remove('active'));
    linkElement.classList.add('active');

    if (sidebarOffcanvasElement && bootstrap.Offcanvas) {
        const instance = bootstrap.Offcanvas.getInstance(sidebarOffcanvasElement);
        if (instance) instance.hide();
    }
}

function initializeChatSelection() {
    const allChatLinks = document.querySelectorAll('.chat-topic-link');
    allChatLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            setActiveChat(link);
        });
    });

    const defaultLink = [...allChatLinks].find(link => link.dataset.webhookUrl);
    if (defaultLink) setActiveChat(defaultLink);
    else addChatMessage('error', 'Không có chủ đề nào sẵn sàng.');
}

document.addEventListener('DOMContentLoaded', () => {
    initializeChatSelection();
    sendButton.addEventListener('click', sendChatMessage);
    userInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (!sendButton.disabled) sendChatMessage();
        }
    });
});

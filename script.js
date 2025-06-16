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

// --- Biến lưu trữ trạng thái chat hiện tại ---
let currentWebhookUrl = '';
let currentSessionId = '';

// --- Hàm tạo Session ID duy nhất ---
function generateSessionId() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  } else {
    console.warn("Browser does not support crypto.randomUUID. Using less reliable fallback.");
    return 'sid-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
  }
}

// <<< HÀM ĐƯỢC CẬP NHẬT LẦN CUỐI - BIỂU THỨC REGEX MẠNH HƠN >>>
/**
 * Chuẩn hóa văn bản Markdown không chuẩn trước khi phân tích.
 * @param {string} text - Văn bản thô từ AI.
 * @returns {string} - Văn bản Markdown đã được sửa lỗi.
 */
function preprocessMarkdown(text) {
    if (!text) return '';
    let correctedText = text;

    // QUY TẮC 1 (CẢI TIẾN MẠNH MẼ): Tìm chính xác dòng bắt đầu bằng * mà không có khoảng trắng theo sau, và chèn khoảng trắng vào.
    // Ví dụ: '*Tổng số' -> '* Tổng số'. Nó sẽ không ảnh hưởng đến dòng đã có khoảng trắng sẵn.
    correctedText = correctedText.replace(/^( *)(\*)[ ]*([^\s*])/gm, '$1$2 $3');

    // QUY TẮC 2: Chuyển đổi cú pháp in đậm (nếu AI vẫn dùng ***) thành chuẩn (**)
    correctedText = correctedText.replace(/\*{3}(.*?)\*{3}/g, '**$1**');
    
    console.log("Markdown sau khi được tự động sửa lỗi:", correctedText); // Dòng log để kiểm tra

    return correctedText;
}

// --- Logic xử lý giọng nói ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = function() {
        if (voiceInputButton) { voiceInputButton.classList.add('is-listening'); voiceInputButton.disabled = true; }
    };
    recognition.onend = function() {
        if (voiceInputButton) { voiceInputButton.classList.remove('is-listening'); voiceInputButton.disabled = false; }
    };
    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        if (userInput) userInput.value = transcript;
        setTimeout(() => { if (userInput && userInput.value.trim() !== "") { sendChatMessage(); } }, 300);
    };
    recognition.onerror = function(event) {
        console.error("Speech recognition error", event.error);
        let errorMessage = `Đã xảy ra lỗi: ${event.error}`;
        switch (event.error) {
            case 'no-speech': errorMessage = "Không phát hiện thấy giọng nói."; break;
            case 'not-allowed': case 'service-not-allowed': errorMessage = "Bạn cần cấp quyền truy cập micro."; break;
            case 'network': errorMessage = "Lỗi mạng khi nhận dạng giọng nói."; break;
            case 'audio-capture': errorMessage = "Lỗi micro không thể thu âm."; break;
        }
        addChatMessage('error', errorMessage);
    };
} else {
    console.warn("Web Speech API is not supported.");
    if (voiceInputButton) voiceInputButton.style.display = 'none';
}


// --- Các hàm còn lại giữ nguyên ---

function addChatMessage(sender, text) {
    if (!chatBox) { return; }
    const messageWrapper = document.createElement('div');
    messageWrapper.className = `message-bubble-wrapper ${sender}-bubble-wrapper`;
    const messageBubble = document.createElement('div');
    messageBubble.className = `message-bubble ${sender}-bubble`;

    if (sender === 'assistant') {
        if (typeof marked === 'function') {
            const correctedMarkdown = preprocessMarkdown(text);
            messageBubble.innerHTML = marked.parse(correctedMarkdown);
        } else {
            messageBubble.innerHTML = text.replace(/\n/g, '<br>');
        }
    } else {
        messageBubble.textContent = text;
    }

    messageWrapper.appendChild(messageBubble);
    chatBox.appendChild(messageWrapper);
    chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
}

async function sendChatMessage() {
    if (!userInput || !sendButton) return;
    const question = userInput.value.trim();
    if (!currentWebhookUrl) { addChatMessage('error', 'Vui lòng chọn một chủ đề chat.'); return; }
    if (!currentSessionId) { addChatMessage('error', 'Lỗi: Không tạo được ID phiên chat.'); return; }
    if (!question) return;
    addChatMessage('user', question);
    userInput.value = '';
    sendButton.disabled = true;
    showTypingIndicator();
    const payload = { question: question, sessionId: currentSessionId };
    try {
        const response = await fetch(currentWebhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        removeTypingIndicator();
        let data;
        try { data = await response.json(); } catch (e) { throw new Error(`Lỗi phân tích JSON từ server.`); }
        if (!response.ok) { throw new Error(data.message || `Lỗi HTTP: ${response.status}`); }
        const answer = data.answer;
        if (answer) { addChatMessage('assistant', answer); } 
        else { addChatMessage('error', 'Phản hồi không hợp lệ (thiếu key "answer").'); }
    } catch (error) {
        removeTypingIndicator();
        addChatMessage('error', `Lỗi: ${error.message}`);
    } finally {
        sendButton.disabled = false;
        if (userInput) userInput.focus();
    }
}

function showTypingIndicator() {
    if (!chatBox || document.getElementById("typing-indicator")) return;
    const typingIndicatorWrapper = document.createElement('div');
    typingIndicatorWrapper.id = 'typing-indicator';
    typingIndicatorWrapper.className = 'message-bubble-wrapper assistant-bubble-wrapper';
    typingIndicatorWrapper.innerHTML = `<div class="message-bubble assistant-bubble d-flex align-items-center" style="padding: 0.5rem 1rem;"><span class="spinner-grow spinner-grow-sm me-2"></span><span>Đang soạn...</span></div>`;
    chatBox.appendChild(typingIndicatorWrapper);
    chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
}

function setActiveChat(linkElement) {
    if (!linkElement || linkElement.classList.contains('active')) return;
    const webhookUrl = linkElement.dataset.webhookUrl;
    if (!webhookUrl || webhookUrl.startsWith('<URL_WEBHOOK_') || webhookUrl.trim() === '') {
        addChatMessage('error', 'Chủ đề này chưa được cấu hình Webhook.');
        return;
    }
    const iconElement = linkElement.querySelector('i');
    const topicName = (iconElement ? linkElement.textContent.replace(iconElement.textContent, '').trim() : linkElement.textContent.trim()) || "Chat";
    currentSessionId = generateSessionId();
    currentWebhookUrl = webhookUrl;
    if (chatBox) chatBox.innerHTML = '';
    addChatMessage('assistant', `Bắt đầu chat về chủ đề: ${topicName}.`);
    if (chatTitleDesktop) chatTitleDesktop.textContent = topicName;
    if (chatTitleMobile) chatTitleMobile.textContent = topicName;
    const allChatLinks = document.querySelectorAll('.chat-topic-link');
    allChatLinks.forEach(link => {
        link.classList.remove('active');
        if (link.dataset.webhookUrl === webhookUrl) {
            link.classList.add('active');
        }
    });
    if (sidebarOffcanvasElement && bootstrap.Offcanvas) {
        const offcanvasInstance = bootstrap.Offcanvas.getInstance(sidebarOffcanvasElement);
        if (offcanvasInstance && sidebarOffcanvasElement.classList.contains('show')) {
            offcanvasInstance.hide();
        }
    }
    if (userInput) userInput.focus();
}

function initializeChatSelection() {
    const allChatLinks = document.querySelectorAll('.chat-topic-link');
    if (allChatLinks.length === 0) {
        addChatMessage('error', "Không tìm thấy chủ đề chat nào.");
        return;
    }
    allChatLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            setActiveChat(link);
        });
    });
    let defaultLink = Array.from(allChatLinks).find(link => {
        const url = link.dataset.webhookUrl;
        return url && !url.startsWith('<URL_WEBHOOK_') && url.trim() !== '';
    });
    if (defaultLink) {
        setActiveChat(defaultLink);
    } else {
        addChatMessage('error', "Vui lòng cấu hình URL Webhook hợp lệ trong file HTML.");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (chatSection) initializeChatSelection();
    if (sendButton) sendButton.addEventListener('click', sendChatMessage);
    if (userInput) {
        userInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                if (sendButton && !sendButton.disabled) sendChatMessage();
            }
        });
    }
    if (voiceInputButton && SpeechRecognition) {
        voiceInputButton.addEventListener('click', () => {
            if (recognition && !voiceInputButton.disabled) {
                try { recognition.start(); } catch (e) { console.error("Could not start recognition", e); }
            }
        });
    }
});

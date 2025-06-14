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

// --- Logic cho phần Chat ---

/**
 * Thêm tin nhắn vào giao diện chat.
 * CẬP NHẬT: Sử dụng thư viện marked.js để render Markdown từ AI.
 */
function addChatMessage(sender, text) {
    if (!chatBox) { console.error("Chat box element not found!"); return; }
    const messageWrapper = document.createElement('div');
    messageWrapper.classList.add('message-bubble-wrapper');
    if (sender === 'user') messageWrapper.classList.add('user-bubble-wrapper');
    else if (sender === 'assistant') messageWrapper.classList.add('assistant-bubble-wrapper');
    else if (sender === 'error') messageWrapper.classList.add('error-bubble-wrapper');

    const messageBubble = document.createElement('div');
    messageBubble.classList.add('message-bubble');

    // <<< THAY ĐỔI CHÍNH Ở ĐÂY >>>
    if (sender === 'assistant') {
        // Kiểm tra xem thư viện marked.js đã được tải chưa
        if (typeof marked === 'function') {
            // Chuyển đổi văn bản Markdown từ AI sang HTML
            const htmlContent = marked.parse(text);
            messageBubble.innerHTML = htmlContent; // Dùng innerHTML để render HTML
        } else {
            // Fallback nếu thư viện không tải được
            console.error("marked.js library not found! Displaying raw text with <br>.");
            messageBubble.innerHTML = text.replace(/\n/g, '<br>');
        }
    } else {
        // Đối với tin nhắn của người dùng hoặc lỗi đơn giản, vẫn dùng textContent
        messageBubble.textContent = text;
    }
    // <<< KẾT THÚC THAY ĐỔI >>>

    if (sender === 'user') {
        messageBubble.classList.add('user-bubble');
    } else if (sender === 'assistant') {
        messageBubble.classList.add('assistant-bubble');
    } else if (sender === 'error') {
        messageBubble.classList.add('error-bubble');
    }

    messageWrapper.appendChild(messageBubble);
    chatBox.appendChild(messageWrapper);
    chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
}

/**
 * Hiển thị chỉ báo đang chờ phản hồi (typing indicator).
 */
function showTypingIndicator() {
    if (!chatBox || document.getElementById('typing-indicator')) return;
    const typingIndicatorWrapper = document.createElement('div');
    typingIndicatorWrapper.id = 'typing-indicator';
    typingIndicatorWrapper.classList.add('message-bubble-wrapper', 'assistant-bubble-wrapper');
    typingIndicatorWrapper.innerHTML = `
        <div class="message-bubble assistant-bubble d-flex align-items-center" style="padding: 0.5rem 1rem;">
            <span class="spinner-grow spinner-grow-sm me-2" role="status" aria-hidden="true"></span>
            <span>Đang soạn...</span>
        </div>
    `;
    chatBox.appendChild(typingIndicatorWrapper);
    chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
}

/**
 * Xóa chỉ báo đang chờ.
 */
function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

/**
 * Gửi tin nhắn chat đến webhook hiện tại, bao gồm cả sessionId.
 */
async function sendChatMessage() {
    if (!userInput || !sendButton) { console.error("Input/Send button not found"); return; }

    const question = userInput.value.trim();

    if (!currentWebhookUrl) {
        addChatMessage('error', 'Vui lòng chọn một chủ đề chat từ menu.');
        return;
    }
     if (!currentSessionId) {
         addChatMessage('error', 'Lỗi: Không thể tạo ID phiên chat. Vui lòng thử chọn lại chủ đề.');
         console.error("currentSessionId is missing!");
         return;
     }

    if (!question) return;

    addChatMessage('user', question);
    userInput.value = '';
    sendButton.disabled = true;

    showTypingIndicator();

    const payload = {
        question: question,
        sessionId: currentSessionId
    };
    console.log("Sending payload:", payload);

    try {
        const response = await fetch(currentWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        removeTypingIndicator();

        let data;
        try { data = await response.json(); }
        catch(e) {
             if (!response.ok) throw new Error(`Lỗi HTTP: ${response.status} ${response.statusText}. Phản hồi không phải JSON.`);
             throw new Error(`Phản hồi thành công nhưng không thể phân tích JSON: ${e.message}`);
        }

        if (!response.ok) {
             throw new Error(data.message || `Lỗi HTTP: ${response.status} ${response.statusText}`);
        }

        const answer = data.answer;
        if (answer) {
            // Câu trả lời từ AI (answer) sẽ được xử lý Markdown trong hàm addChatMessage
            addChatMessage('assistant', answer);
        } else {
             addChatMessage('error', 'Phản hồi chat nhận được không hợp lệ (thiếu key "answer").');
             console.warn('Chat received data without expected "answer" key:', data);
        }

    } catch (error) {
        removeTypingIndicator();
        addChatMessage('error', `Lỗi: ${error.message || 'Không thể kết nối đến webhook chat.'}`);
        console.error('Chat fetch error:', error);
    } finally {
        sendButton.disabled = false;
        if (userInput) userInput.focus();
    }
}

/**
 * Xử lý khi người dùng chọn một chủ đề chat mới từ sidebar hoặc offcanvas.
 */
function setActiveChat(linkElement) {
    if (!linkElement || linkElement.classList.contains('active')) {
        return;
    }

    const webhookUrl = linkElement.dataset.webhookUrl;
    if (!webhookUrl || webhookUrl.startsWith('<URL_WEBHOOK_') || webhookUrl.trim() === '') {
        console.warn('Webhook URL chưa được cấu hình cho:', linkElement.textContent.trim());
        addChatMessage('error', 'Chủ đề này chưa được cấu hình Webhook.');
        return;
    }

    const iconElement = linkElement.querySelector('i');
    const topicName = (iconElement ? linkElement.textContent.replace(iconElement.textContent, '').trim() : linkElement.textContent.trim()) || "Chat";

    currentSessionId = generateSessionId();
    currentWebhookUrl = webhookUrl;
    console.log(`New session for topic "${topicName}" started. ID: ${currentSessionId}, URL: ${currentWebhookUrl}`);

    if (chatBox) chatBox.innerHTML = '';
    addChatMessage('assistant', `Bắt đầu chat về chủ đề: ${topicName}.`);

    if (chatTitleDesktop) chatTitleDesktop.textContent = topicName;
    if (chatTitleMobile) chatTitleMobile.textContent = topicName;

    const allChatLinks = document.querySelectorAll('.chat-topic-link');
    allChatLinks.forEach(link => link.classList.remove('active'));
    linkElement.classList.add('active');
    allChatLinks.forEach(otherLink => {
        if (otherLink !== linkElement && otherLink.dataset.webhookUrl === webhookUrl) {
            otherLink.classList.add('active');
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

/**
 * Khởi tạo lựa chọn chat, gán sự kiện và chọn chat mặc định.
 */
function initializeChatSelection() {
    const allChatLinks = document.querySelectorAll('.chat-topic-link');
    if (allChatLinks.length === 0) {
        const initialMsg = "Không tìm thấy chủ đề chat nào.";
        if (chatTitleDesktop) chatTitleDesktop.textContent = initialMsg;
        if (chatTitleMobile) chatTitleMobile.textContent = initialMsg;
        addChatMessage('error', "Vui lòng kiểm tra cấu hình sidebar trong HTML.");
        return;
    }

    allChatLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            setActiveChat(link);
        });
    });

    let defaultLink = null;
    for(let link of allChatLinks) {
        const url = link.dataset.webhookUrl;
        if (url && !url.startsWith('<URL_WEBHOOK_') && url.trim() !== '') {
            if(link.closest('#chat-list-desktop')) {
                 defaultLink = link;
                 break;
            }
            if(!defaultLink) defaultLink = link;
        }
    }
    if (!defaultLink) {
        for(let link of allChatLinks) {
            const url = link.dataset.webhookUrl;
            if (url && !url.startsWith('<URL_WEBHOOK_') && url.trim() !== '') {
                defaultLink = link;
                break;
            }
        }
    }

    if (defaultLink) {
        setActiveChat(defaultLink);
    } else {
         const errorMsg = "Chưa có chủ đề nào sẵn sàng.";
         if (chatTitleDesktop) chatTitleDesktop.textContent = errorMsg;
         if (chatTitleMobile) chatTitleMobile.textContent = errorMsg;
         addChatMessage('error', "Vui lòng cấu hình URL Webhook hợp lệ cho các chủ đề trong file HTML.");
    }
}

// --- Gán sự kiện & Khởi tạo ---
document.addEventListener('DOMContentLoaded', () => {
    if (chatSection) {
        initializeChatSelection();
    } else {
        console.error("Không tìm thấy phần tử #chat-section.");
    }

    if (sendButton) {
        sendButton.addEventListener('click', sendChatMessage);
    } else {
        console.error("Không tìm thấy phần tử #send-button.");
    }

    if (userInput) {
        userInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                if (sendButton && !sendButton.disabled) {
                    sendChatMessage();
                }
            }
        });
        setTimeout(() => userInput.focus(), 100);
    } else {
         console.error("Không tìm thấy phần tử #user-input.");
    }
});

// --- Lấy các element của phần chat ---
// Giả định các ID này tồn tại trong index.html
const chatSection = document.getElementById('chat-section');
const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const chatList = document.getElementById('chat-list'); // Container chứa các link chat trong sidebar
const chatTitle = document.getElementById('chat-title'); // Tiêu đề khu vực chat

// --- Biến lưu trữ trạng thái chat hiện tại ---
let currentWebhookUrl = ''; // URL Webhook của chủ đề đang chọn
let currentSessionId = '';  // ID DUY NHẤT CHO PHIÊN CHAT HIỆN TẠI

// --- Hàm tạo Session ID duy nhất ---
function generateSessionId() {
  // Sử dụng crypto.randomUUID() nếu trình duyệt hỗ trợ (an toàn và chuẩn hơn)
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  } else {
    // Fallback đơn giản cho trình duyệt cũ (ít duy nhất hơn)
    console.warn("Browser does not support crypto.randomUUID. Using less reliable fallback.");
    return 'sid-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
  }
}

// --- Logic cho phần Chat ---

/**
 * Thêm tin nhắn vào giao diện chat.
 */
function addChatMessage(sender, text) {
    if (!chatBox) {
        console.error("Chat box element not found!");
        return;
    }
    const messageWrapper = document.createElement('div');
    messageWrapper.classList.add('message-bubble-wrapper');
    if (sender === 'user') messageWrapper.classList.add('user-bubble-wrapper');
    else if (sender === 'assistant') messageWrapper.classList.add('assistant-bubble-wrapper');
    else if (sender === 'error') messageWrapper.classList.add('error-bubble-wrapper');

    const messageBubble = document.createElement('div');
    messageBubble.classList.add('message-bubble');
    messageBubble.textContent = text; // An toàn hơn innerHTML

    if (sender === 'user') {
        messageBubble.classList.add('user-bubble');
    } else if (sender === 'assistant') {
        messageBubble.classList.add('assistant-bubble');
    } else if (sender === 'error') {
        messageBubble.classList.add('error-bubble');
    }

    messageWrapper.appendChild(messageBubble);
    chatBox.appendChild(messageWrapper);
    // Cuộn xuống tin nhắn mới nhất
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
    if (!userInput || !sendButton) return; // Kiểm tra element tồn tại

    const question = userInput.value.trim();

    // Kiểm tra xem đã chọn chủ đề (và có URL hợp lệ) chưa
    if (!currentWebhookUrl) {
        addChatMessage('error', 'Vui lòng chọn một chủ đề chat từ menu bên trái trước.');
        return;
    }
     if (!currentSessionId) {
         addChatMessage('error', 'Lỗi: Không thể tạo ID phiên chat. Vui lòng thử chọn lại chủ đề.');
         console.error("currentSessionId is missing!");
         return;
     }

    if (!question) return; // Không gửi tin nhắn rỗng

    addChatMessage('user', question);
    userInput.value = ''; // Xóa input sau khi gửi
    sendButton.disabled = true; // Vô hiệu hóa nút gửi

    showTypingIndicator();

    // Tạo payload bao gồm cả sessionId
    const payload = {
        question: question,
        sessionId: currentSessionId
    };

    console.log("Sending payload:", payload); // Log để debug

    try {
        // Sử dụng URL Webhook CHAT hiện tại
        const response = await fetch(currentWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Thêm headers khác nếu cần (vd: Authorization)
            },
            body: JSON.stringify(payload), // Gửi payload mới
        });

        removeTypingIndicator(); // Xóa chỉ báo khi có phản hồi (thành công hoặc lỗi)

        let data;
        try {
             data = await response.json();
        } catch(e) {
             if (!response.ok) throw new Error(`Lỗi HTTP: ${response.status} ${response.statusText}. Phản hồi không phải JSON.`);
             throw new Error(`Phản hồi thành công nhưng không thể phân tích JSON: ${e.message}`);
        }

        if (!response.ok) {
             throw new Error(data.message || `Lỗi HTTP: ${response.status} ${response.statusText}`);
        }

        // Xử lý phản hồi thành công
        const answer = data.answer; // Mong đợi { "answer": "..." } từ webhook chat
        if (answer) {
            addChatMessage('assistant', answer);
        } else {
             addChatMessage('error', 'Phản hồi chat nhận được không hợp lệ (thiếu key "answer").');
             console.warn('Chat received data without expected "answer" key:', data);
        }

    } catch (error) {
         removeTypingIndicator(); // Đảm bảo xóa chỉ báo nếu có lỗi
        addChatMessage('error', `Lỗi: ${error.message || 'Không thể kết nối đến webhook chat.'}`);
        console.error('Chat fetch error:', error);
    } finally {
        sendButton.disabled = false; // Kích hoạt lại nút gửi
        if (userInput) userInput.focus(); // Focus lại ô input
    }
}

/**
 * Xử lý khi người dùng chọn một chủ đề chat mới từ sidebar.
 * Sẽ tạo sessionId mới cho mỗi lần chọn chủ đề.
 */
function setActiveChat(linkElement) {
    if (!linkElement || linkElement.classList.contains('active')) {
        // Không làm gì nếu link không tồn tại hoặc đã active sẵn rồi
        return;
    }

    const webhookUrl = linkElement.dataset.webhookUrl;

    // Kiểm tra xem URL có phải là placeholder không
    if (!webhookUrl || webhookUrl.startsWith('<URL_WEBHOOK_') || webhookUrl.trim() === '') {
        console.warn('Webhook URL chưa được cấu hình cho:', linkElement.textContent.trim());
        // Có thể hiển thị thông báo lỗi tạm thời hoặc không làm gì cả
        return;
    }

    const iconElement = linkElement.querySelector('i');
    const topicName = (iconElement ? linkElement.textContent.replace(iconElement.textContent, '').trim() : linkElement.textContent.trim()) || "Chat";

    // Tạo Session ID mới khi chọn chủ đề mới
    currentSessionId = generateSessionId();
    currentWebhookUrl = webhookUrl;
    console.log(`New session for topic "${topicName}" started. ID: ${currentSessionId}, URL: ${currentWebhookUrl}`);

    if (chatBox) chatBox.innerHTML = ''; // Xóa nội dung chat cũ
    addChatMessage('assistant', `Bắt đầu chat về chủ đề: ${topicName}.`); // Có thể bỏ hiển thị session ID nếu muốn

    if (chatTitle) chatTitle.textContent = topicName; // Cập nhật tiêu đề

    // Cập nhật trạng thái active cho các link trong sidebar
    if (chatList) {
        const allLinks = chatList.querySelectorAll('.chat-topic-link');
        allLinks.forEach(link => link.classList.remove('active')); // Xóa active ở tất cả
        linkElement.classList.add('active'); // Thêm active cho link vừa click
    }

    if (userInput) userInput.focus(); // Focus vào ô nhập liệu
}

/**
 * Khởi tạo lựa chọn chat, gán sự kiện và chọn chat mặc định.
 */
function initializeChatSelection() {
    if (!chatList) {
        console.error("Không tìm thấy phần tử #chat-list để khởi tạo sidebar.");
        if (chatTitle) chatTitle.textContent = "Lỗi: Không tìm thấy danh sách chủ đề.";
        return;
    }

    const chatLinks = chatList.querySelectorAll('.chat-topic-link');

    if (chatLinks.length === 0) {
        if (chatTitle) chatTitle.textContent = "Không có chủ đề nào";
        addChatMessage('error', "Không tìm thấy chủ đề chat nào trong sidebar.");
        return;
    }

    // Gán sự kiện click cho từng link
    chatLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault(); // Ngăn link chuyển trang
            setActiveChat(link); // Gọi hàm xử lý
        });
    });

    // Tự động chọn chủ đề đầu tiên có URL hợp lệ làm mặc định
    let defaultLink = null;
    for(let link of chatLinks) {
        const url = link.dataset.webhookUrl;
        // Kiểm tra URL hợp lệ (không phải placeholder và không rỗng)
        if (url && !url.startsWith('<URL_WEBHOOK_') && url.trim() !== '') {
            defaultLink = link;
            break; // Tìm thấy link hợp lệ đầu tiên
        }
    }

    if (defaultLink) {
        setActiveChat(defaultLink); // Tự động chọn và tạo session ID đầu tiên
    } else {
         // Nếu có link nhưng không link nào có URL hợp lệ
         if (chatTitle) chatTitle.textContent = "Chưa có chủ đề nào sẵn sàng";
         addChatMessage('error', "Vui lòng cấu hình URL Webhook hợp lệ cho các chủ đề trong file HTML.");
    }
}

// --- Gán sự kiện & Khởi tạo ---
document.addEventListener('DOMContentLoaded', () => {
    // Giả định #chat-section luôn hiển thị
    if (chatSection) {
        // Đảm bảo phần chat hiển thị (nếu CSS có thể ẩn nó)
        // chatSection.style.display = 'flex'; // Bỏ comment nếu cần thiết
        initializeChatSelection(); // Khởi tạo sidebar và chọn chủ đề mặc định
    } else {
        console.error("Không tìm thấy phần tử #chat-section.");
    }

    // Gán sự kiện cho nút gửi và ô nhập
    if (sendButton) {
        sendButton.addEventListener('click', sendChatMessage);
    } else {
        console.error("Không tìm thấy phần tử #send-button.");
    }

    if (userInput) {
        userInput.addEventListener('keypress', function(event) {
            // Gửi khi nhấn Enter (và không nhấn Shift)
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault(); // Ngăn xuống dòng trong input
                // Chỉ gửi nếu nút gửi không bị vô hiệu hóa
                if (sendButton && !sendButton.disabled) {
                    sendChatMessage();
                }
            }
        });
        // Focus vào ô input sau khi mọi thứ sẵn sàng
        setTimeout(() => userInput.focus(), 100);
    } else {
         console.error("Không tìm thấy phần tử #user-input.");
    }
});
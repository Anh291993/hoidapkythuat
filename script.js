// --- Lấy các element của phần chat ---
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

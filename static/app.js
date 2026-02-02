document.addEventListener("DOMContentLoaded", () => {
    const historyList = document.getElementById("history-list");
    const messageInput = document.getElementById("message-input");
    const sendBtn = document.getElementById("send-btn");
    const attachFileBtn = document.getElementById("attach-file-btn");
    const fileInput = document.getElementById("file-input");
    const inputContainer = document.querySelector(".input-container");

    const modal = document.getElementById("resource-center-modal");
    const openModalBtn = document.getElementById("open-resource-center");
    const closeModalBtn = document.querySelector(".close-btn");
    const fullHistoryList = document.getElementById("full-history-list");
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    const historyContainer = document.getElementById('history-container');

    let socket;
    let reconnectInterval = 1000; // Initial reconnect interval

    // Pagination state
    let currentOffset = 0;
    let pageSize = 30;
    let totalMessages = 0;
    let isLoading = false;
    let hasMoreMessages = true;
    const loadMoreContainer = document.getElementById('load-more-container');
    const loadMoreBtn = document.getElementById('load-more-btn');

    function connect() {
        socket = new WebSocket(`ws://${window.location.host}/ws`);

        socket.onopen = () => {
            console.log("WebSocket connection established.");
            document.getElementById('status-indicator').style.display = 'none';
            messageInput.disabled = false;
            sendBtn.disabled = false;
            reconnectInterval = 1000; // Reset reconnect interval on successful connection
        };

        socket.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.type === 'clear') {
                historyList.innerHTML = '';
                currentOffset = 0;
                hasMoreMessages = false;
                loadMoreContainer.classList.add('hidden');
                return;
            }
            addMessageToHistory(msg, historyList, true);
            scrollToBottom();
        };

        socket.onclose = () => {
            console.log("WebSocket connection closed. Attempting to reconnect...");
            messageInput.disabled = true;
            sendBtn.disabled = true;
            showStatusIndicator("Connection lost. Reconnecting...", true);
            setTimeout(connect, reconnectInterval);
            reconnectInterval = Math.min(reconnectInterval * 2, 30000); // Exponential backoff up to 30 seconds
        };

        socket.onerror = (error) => {
            console.error("WebSocket error:", error);
            socket.close(); // This will trigger the onclose event and reconnection logic
        };
    }

    function showStatusIndicator(message, show) {
        let indicator = document.getElementById('status-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'status-indicator';
            indicator.className = 'fixed top-0 left-0 w-full bg-claude-accent text-white text-center p-2 z-[60] font-sans font-medium shadow-sm animate-slide-down';
            document.body.prepend(indicator);
        }
        indicator.textContent = message;
        indicator.style.display = show ? 'block' : 'none';
    }

    function addMessageToHistory(msg, listElement, isRecent) {
        const li = document.createElement("li");
        // Claude-style list item: Clean, minimal with hover effect
        li.className = "group relative p-4 rounded-xl border border-transparent bg-claude-surface hover:border-claude-accent/30 hover:shadow-sm transition-all duration-200 animate-fade-in";
        li.dataset.id = msg.timestamp; // Unique ID for the item

        const contentDiv = document.createElement("div");

        const controlsDiv = document.createElement("div");
        // Position controls inside the card for better alignment
        controlsDiv.className = "absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-claude-surface/80 backdrop-blur-sm shadow-sm rounded-md p-1 border border-claude-border";

        const fileExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"];
        const isImage = msg.type === 'file' && fileExtensions.includes(msg.content.split('.').pop().toLowerCase());

        if (msg.type === "text") {
            // Text styling: No wrapping, horizontal scroll for long lines
            contentDiv.className = "text-claude-text text-[15px] leading-7 whitespace-pre font-sans selection:bg-claude-accent/20 overflow-x-auto";
            contentDiv.textContent = msg.content;

            const copyBtn = document.createElement("div");
            copyBtn.className = "p-1.5 rounded hover:bg-claude-sider text-claude-muted hover:text-claude-text cursor-pointer transition-colors";
            copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
            copyBtn.title = "Copy";
            copyBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(msg.content).then(() => {
                    copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-600"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                    setTimeout(() => {
                        copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
                    }, 2000);
                });
            });
            controlsDiv.appendChild(copyBtn);
        } else if (isImage) {
            const a = document.createElement("a");
            a.href = `/uploads/${msg.content}`;
            a.target = "_blank";
            a.className = "block mt-1 transition-transform duration-300 hover:scale-[1.01]";
            const img = document.createElement("img");
            img.src = `/uploads/${msg.content}`;
            img.className = "rounded-lg max-w-full max-h-96 border border-claude-border shadow-sm";
            a.appendChild(img);
            contentDiv.appendChild(a);
        } else if (msg.type === "file") {
            contentDiv.innerHTML = `
                <a href="/uploads/${msg.content}" download="${msg.content}" class="group/file flex items-center gap-4 p-4 bg-claude-surface rounded-lg border border-claude-border hover:border-claude-accent/50 hover:shadow-sm transition-all duration-200 w-full sm:w-fit">
                    <div class="p-3 rounded-lg bg-claude-sider text-claude-muted group-hover/file:text-claude-accent transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-sm font-medium text-claude-text group-hover/file:text-claude-accentHover transition-colors truncate max-w-[200px] sm:max-w-xs">${msg.content}</span>
                        <span class="text-[10px] text-claude-muted uppercase tracking-wider font-bold">Download</span>
                    </div>
                </a>`;
        }

        const timestampSpan = document.createElement("span");
        timestampSpan.className = "text-[10px] text-claude-muted/50 font-mono mt-1 block select-none";
        const date = new Date(msg.timestamp);
        timestampSpan.textContent = date.toLocaleString();

        const mainContent = document.createElement("div");
        mainContent.className = "w-full";

        if (msg.type === 'text') {
            mainContent.appendChild(contentDiv);
            mainContent.appendChild(timestampSpan);
            mainContent.appendChild(controlsDiv);
        } else {
            mainContent.appendChild(contentDiv);
            mainContent.appendChild(timestampSpan);
            // Add controls to file/image types too if needed, but per request keeping simple
            if (msg.type !== 'text') {
                // allow deleting files
                mainContent.appendChild(controlsDiv);
            }
        }

        li.appendChild(mainContent);

        // Reverse order: recent messages go to bottom, history goes to top
        if (isRecent) {
            listElement.appendChild(li);
        } else {
            listElement.prepend(li);
        }
    }

    function scrollToBottom() {
        const container = document.getElementById('history-container');
        if (container) {
            container.scrollTo({
                top: container.scrollHeight,
                behavior: 'smooth'
            });
        }
    }

    sendBtn.addEventListener("click", () => {
        const text = messageInput.value;
        if (text.trim() !== "" && socket.readyState === WebSocket.OPEN) {
            socket.send(text);
            messageInput.value = "";
            messageInput.style.height = "auto"; // Reset height
            // Auto-scroll after sending
            setTimeout(scrollToBottom, 100);
        }
    });

    attachFileBtn.addEventListener("click", () => {
        fileInput.click();
    });

    fileInput.addEventListener("change", () => {
        const file = fileInput.files[0];
        if (file) {
            uploadFile(file);
        }
    });

    // Modal logic
    openModalBtn.addEventListener("click", () => {
        modal.classList.remove("hidden");
        fullHistoryList.innerHTML = ""; // Clear previous list
        fetch("/history?type=file")
            .then(response => response.json())
            .then(data => {
                const messages = data.messages || [];
                messages.forEach(msg => {
                    addMessageToHistory(msg, fullHistoryList, false);
                });
            });
    });

    closeModalBtn.addEventListener("click", () => {
        modal.classList.add("hidden");
    });

    window.addEventListener("click", (event) => {
        if (event.target == modal) {
            modal.classList.add("hidden");
        }
    });

    function deleteHistoryItem(msg, listItem) {
        fetch("/history/delete", {
            method: "DELETE",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(msg)
        })
            .then(response => {
                if (response.ok) {
                    listItem.remove();
                } else {
                    alert("Failed to delete item.");
                }
            });
    }

    // Drag and drop file upload
    inputContainer.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.stopPropagation();
        inputContainer.classList.add("dragover");
    });

    inputContainer.addEventListener("dragleave", (e) => {
        e.preventDefault();
        e.stopPropagation();
        inputContainer.classList.remove("dragover");
    });

    inputContainer.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        inputContainer.classList.remove("dragover");
        const file = e.dataTransfer.files[0];
        if (file) {
            uploadFile(file);
        }
    });

    function uploadFile(file) {
        const formData = new FormData();
        formData.append("file", file);

        fetch("/upload", {
            method: "POST",
            body: formData,
        })
            .then(response => response.text())
            .then(result => {
                console.log(result);
                fileInput.value = ""; // Clear the file input
            })
            .catch(error => {
                console.error("Error uploading file:", error);
            });
    }

    clearHistoryBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (confirm("Are you sure you want to clear all history? This will delete all text and files permanently.")) {
            fetch("/history/clear", {
                method: "DELETE",
            })
                .then(response => {
                    if (!response.ok) {
                        alert("Failed to clear history.");
                    } else {
                        // Reset pagination state locally
                        currentOffset = 0;
                        hasMoreMessages = false;
                        loadMoreContainer.classList.add('hidden');
                    }
                })
                .catch(error => {
                    console.error("Error clearing history:", error);
                    alert("Error clearing history.");
                });
        }
    });

    // Load more history (pagination)
    async function loadMoreHistory() {
        if (isLoading || !hasMoreMessages) return;

        isLoading = true;
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = "Loading...";

        try {
            const response = await fetch(`/history?limit=${pageSize}&offset=${currentOffset}`);
            const data = await response.json();

            totalMessages = data.total;
            const messages = data.messages || [];

            // Server returns newest-first: [M30, M29, ..., M1]
            messages.reverse();

            if (currentOffset === 0) {
                // Initial load: append to list and scroll to bottom
                messages.forEach(msg => {
                    addMessageToHistory(msg, historyList, true);
                });
                setTimeout(scrollToBottom, 50);
            } else {
                // Manual load: prepend to the top and maintain position
                const oldScrollHeight = historyContainer.scrollHeight;
                const oldScrollTop = historyContainer.scrollTop;

                for (let i = messages.length - 1; i >= 0; i--) {
                    addMessageToHistory(messages[i], historyList, false);
                }

                // Maintain scroll position
                setTimeout(() => {
                    const newScrollHeight = historyContainer.scrollHeight;
                    historyContainer.scrollTop = newScrollHeight - oldScrollHeight + oldScrollTop;
                }, 0);
            }

            currentOffset += messages.length;
            hasMoreMessages = currentOffset < totalMessages;

            // Show/Hide load more button
            if (hasMoreMessages) {
                loadMoreContainer.classList.remove('hidden');
            } else {
                loadMoreContainer.classList.add('hidden');
            }

        } catch (error) {
            console.error("Error loading history:", error);
        } finally {
            isLoading = false;
            loadMoreBtn.disabled = false;
            loadMoreBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 13l5-5 5 5M7 6l5-5 5 5"/></svg>
                Load Older Messages`;
        }
    }

    // Manual load on button click
    loadMoreBtn.addEventListener('click', loadMoreHistory);

    // Initial load
    loadMoreHistory();


    connect(); // Initial connection
});
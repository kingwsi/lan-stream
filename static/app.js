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
    const clearHistoryBtn = document.getElementById("clear-history-btn");

    let socket;
    let reconnectInterval = 1000; // Initial reconnect interval

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
                return;
            }
            addMessageToHistory(msg, historyList, true);
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
            // Add styles to the indicator
            Object.assign(indicator.style, {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100%',
                background: '#ffc107',
                color: '#333',
                textAlign: 'center',
                padding: '10px',
                zIndex: '1000',
                fontWeight: 'bold'
            });
            document.body.prepend(indicator);
        }
        indicator.textContent = message;
        indicator.style.display = show ? 'block' : 'none';
    }

    function addMessageToHistory(msg, listElement, isRecent) {
        const li = document.createElement("li");
        li.classList.add("history-item");
        li.dataset.id = msg.timestamp; // Unique ID for the item

        const contentDiv = document.createElement("div");
        contentDiv.className = "content";

        const controlsDiv = document.createElement("div");
        controlsDiv.className = "controls";

        const fileExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"];
        const isImage = msg.type === 'file' && fileExtensions.includes(msg.content.split('.').pop().toLowerCase());

        if (msg.type === "text") {
            li.classList.add("history-item-text");
            contentDiv.textContent = msg.content;
            const copyBtn = document.createElement("div");
            copyBtn.className = "control-btn copy-btn";
            copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
            copyBtn.title = "Copy";
            copyBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(msg.content).then(() => {
                    copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                    setTimeout(() => {
                        copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
                    }, 2000);
                });
            });
            controlsDiv.appendChild(copyBtn);
        } else if (isImage) {
            li.classList.add("history-item-image");
            const a = document.createElement("a");
            a.href = `/uploads/${msg.content}`;
            a.target = "_blank";
            const img = document.createElement("img");
            img.src = `/uploads/${msg.content}`;
            img.className = "preview-img";
            a.appendChild(img);
            contentDiv.appendChild(a);
        } else if (msg.type === "file") {
            li.classList.add("history-item-file");
            contentDiv.innerHTML = `
                <a href="/uploads/${msg.content}" download="${msg.content}" class="file-link">
                    <div class="file-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                    </div>
                    <span class="file-name">${msg.content}</span>
                </a>`;
        }

        const timestampSpan = document.createElement("span");
        timestampSpan.className = "timestamp";
        timestampSpan.textContent = new Date(msg.timestamp).toLocaleString();

        const mainContent = document.createElement("div");
        mainContent.className = "main-content";

        if (msg.type === 'text') {
            const innerContent = document.createElement('div');
            innerContent.className = 'inner-content';
            innerContent.appendChild(contentDiv);
            innerContent.appendChild(timestampSpan);
            mainContent.appendChild(innerContent);
            mainContent.appendChild(controlsDiv);
        } else {
            mainContent.appendChild(contentDiv);
            mainContent.appendChild(timestampSpan);
        }

        li.appendChild(mainContent);

        if (!isRecent) {
            const deleteBtn = document.createElement("div");
            deleteBtn.className = "control-btn delete-btn";
            deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
            deleteBtn.title = "Delete";
            deleteBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                deleteHistoryItem(msg, li);
            });
            controlsDiv.appendChild(deleteBtn);
            if (msg.type !== 'text') {
                li.appendChild(controlsDiv);
            }
        }

        if (isRecent) {
            listElement.prepend(li);
        } else {
            listElement.appendChild(li);
        }
    }

    sendBtn.addEventListener("click", () => {
        const text = messageInput.value;
        if (text.trim() !== "" && socket.readyState === WebSocket.OPEN) {
            socket.send(text);
            messageInput.value = "";
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
        modal.style.display = "block";
        fullHistoryList.innerHTML = ""; // Clear previous list
        fetch("/history?type=file")
            .then(response => response.json())
            .then(history => {
                history.forEach(msg => {
                    addMessageToHistory(msg, fullHistoryList, false);
                });
            });
    });

    closeModalBtn.addEventListener("click", () => {
        modal.style.display = "none";
    });

    window.addEventListener("click", (event) => {
        if (event.target == modal) {
            modal.style.display = "none";
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
                }
            })
            .catch(error => {
                console.error("Error clearing history:", error);
                alert("Error clearing history.");
            });
        }
    });

    connect(); // Initial connection
});
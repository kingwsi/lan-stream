var stompClient = null;

function setConnected(connected) {
    if (connected) {
        $("#status").attr("style", "background-color: green");
        $("#status").text("已连接")
        loadUrlPath()
    } else {
        $("#status").attr("style", "background-color: red");
        $("#status").text("断开连接")
        $("#url-qr").html(`<img src="/reconnect.png" style="width: 100px;height: 100px" alt="重连"/>`)
    }
}

function connect() {
    const socket = new SockJS('/lan-stream');
    stompClient = Stomp.over(socket);
    stompClient.connect({}, function (frame) {
        setConnected(true);
        console.log('Connected: ' + frame);
        stompClient.subscribe('/topic/message', function (greeting) {
            console.log(greeting.body)
            showMessage(JSON.parse(greeting.body));
        });
    }, function (message) {
        console.log(message)
        stompClient.disconnect();
        setConnected(false);
    });
}

function disconnect() {
    if (stompClient !== null) {
        stompClient.disconnect();
    }
    setConnected(false);
    console.log("Disconnected");
}

function sendMessage() {
    const msg = $("#message").val();
    if (!msg) {
        return
    }
    const json = {'type': 'text', 'content': msg}
    stompClient.send("/app/send", {}, JSON.stringify(json));
    $("#message").val("")
}

function sendFile() {
    // 1. 将 jQuery 对象转化为 DOM 对象，并获取选中的文件列表
    const files = $("#uploadFile")[0].files;
    // 2. 判断是否选择了文件
    if (files.length <= 0) {
        return;
    }
    const fileName = files[0].name;
    const fd = new FormData();
    fd.append('file', files[0])
    $.ajax({
        method: 'POST',
        url: "/file-upload",
        data: fd,
        contentType: false,
        processData: false,
        xhr: function() {
            let xhr = new XMLHttpRequest()
            // 添加文件上传的监听
            // onprogress:进度监听事件，只要上传文件的进度发生了变化，就会自动的触发这个事件
            xhr.upload.onprogress = function(e) {
                console.log(e)
                let percent = (e.loaded / e.total) * 100
                const percentStr = (percent).toFixed(2) + '%'
                $('.progress').attr("style", "")
                if (percent < 20) {
                    $('.upload-progress').attr("style", "width: 20%").text('上传中...')
                } else {
                    $('.upload-progress').attr("style", "width: " + percentStr).text('上传中 ' + percentStr)
                }
                $('.upload').hide()
            }
            return xhr
        },
        success: function (data) {
            const json = {
                'type': fileName.substr(fileName.lastIndexOf('.') + 1),
                'fileName': fileName,
                'fileSize': (files[0].size / 1024 / 1024).toFixed(2),
                'content': data
            }
            stompClient.send("/app/send", {}, JSON.stringify(json));
            $("#uploadFile").val("")

            $('.upload-progress').attr("style", "width: 0%").text("0%")
            $('.progress').hide()
            $('.upload').show()
        }
    })

}

function showMessage(data) {
    if (!data) {
        return
    }
    if (isAssetTypeAnImage(data.type)) {
        $("#history").prepend(`<tr><td><span><a href="#" class="thumbnail"><img src="${data.content}" alt=""></a>
        <span class="msg-time">${new Date(data.timestamp).toLocaleString()}</span>
        </span></td></tr>`);
    } else if (data.type === 'text') {
        let content = data.content.replaceAll('<', '&lt')
            .replaceAll('>', '&gt')
        $("#history").prepend(`<tr><td>
        <pre><code>${content}</code></pre>
        <div class="button-content" data-clipboard-snippet>复制</div>
        <span class="msg-time">${new Date(data.timestamp).toLocaleString()}</span>
        </td></tr>`);
    } else {
        $("#history").prepend(`<tr><td onclick="downloadFile('${data.content}')">
        <span class="glyphicon glyphicon-download-alt" aria-hidden="true"></span>
        <p>${data.fileName}</p> <p>${data.fileSize} MB</p><br/>
        <span class="msg-time">${new Date(data.timestamp).toLocaleString()}</span></span>
        </td></tr>`);
    }
}

function showHistoryMsg() {
    $.ajax({
        method: 'get',
        url: "/history",
        success: function (data) {
            data.forEach(e => {
                showMessage(e)
            })
        }
    })
}

window.onload = function () {
    $("form").on('submit', function (e) {
        e.preventDefault();
    });
    $("#url-qr").click(function () {
        connect();
    });
    $("#disconnect").click(function () {
        disconnect();
    });
    $("#send").click(function () {
        sendMessage();
    });
    $("#uploadFile").change(function () {
        sendFile();
    });
    connect();
    showHistoryMsg();
    loadUrlPath();

    /**
     * 剪贴板
     * @type {ClipboardJS}
     */
    let clipboardSnippets = new ClipboardJS('[data-clipboard-snippet]',{
        target: function(trigger) {
            return trigger.previousElementSibling;
        }
    });
    clipboardSnippets.on('success', function(e) {
        e.clearSelection()
        e.trigger.textContent = '已复制';
        setTimeout(function() {
            e.trigger.textContent = '复制';
        }, 2000); // 2 秒后恢复按钮文本
    });
    clipboardSnippets.on('error', function(e) {
        e.trigger.textContent = '复制失败！';
    });
}

function isAssetTypeAnImage(ext) {
    return ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'svg', 'webp'].indexOf(ext.toLowerCase()) !== -1;
}

function downloadFile(url) {
    var $form = $('<form method="GET"></form>');
    $form.attr('action', url);
    $form.appendTo($('body'));
    $form.submit();
}

function loadUrlPath(){
    $("#url-qr").html(`<img src="/qr?content=${window.location.href}" alt="${window.location.href}"/>`)
}
package com.example.lanstream;

import com.example.lanstream.pojo.Message;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ArrayBlockingQueue;

@Slf4j
@Controller
public class StreamController {

	@Autowired
	private ArrayBlockingQueue<Message> arrayBlockingQueue;
	
	@Value("${host.url}")
	private String hostUrl;

	@Value("${max-history}")
	private int maxHistory = 10;

	@Value("${web.upload-path}")
	private String uploadPath;

	@MessageMapping("/send")
	@SendTo("/topic/message")
	public Message greeting(Message message) {
		if (!message.isOld()) {
			if (arrayBlockingQueue.size() >= maxHistory) {
				Message poll = arrayBlockingQueue.poll();
				try {
					// 删除无效文件
					if (poll != null && "text".equals(poll.getType()) && StringUtils.hasText(poll.getContent())) {
						Files.deleteIfExists(Paths.get(uploadPath, poll.getContent()));
					}
				} catch (Exception e) {
					log.error("删除失败：{}, {}", e, poll);
				}
			}
			arrayBlockingQueue.add(message);
		}
		return message;
	}

	@GetMapping("/history")
	@ResponseBody
	public List<Message> greeting() {
		return new ArrayList<>(arrayBlockingQueue);
	}
	
	@GetMapping("/qr")
	public ResponseEntity<byte[]> getQr(@RequestParam(name = "width", defaultValue = "100") int width,
										@RequestParam(value = "height", defaultValue = "100") int height,
										@RequestParam(value = "content") String content) throws IOException, WriterException {
		QRCodeWriter qrCodeWriter = new QRCodeWriter();
		BitMatrix bitMatrix = qrCodeWriter.encode(hostUrl, BarcodeFormat.QR_CODE, width, height);
		ByteArrayOutputStream pngOutputStream = new ByteArrayOutputStream();
		MatrixToImageWriter.writeToStream(bitMatrix, "PNG", pngOutputStream);
		byte[] qrCode = pngOutputStream.toByteArray();
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(MediaType.IMAGE_PNG);
		return new ResponseEntity<>(qrCode, headers, HttpStatus.CREATED);
	}
}

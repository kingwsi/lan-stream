package com.example.lanstream;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ApplicationListener;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.core.env.Environment;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Slf4j
@SpringBootApplication
public class LanStreamApplication implements ApplicationListener<ContextRefreshedEvent> {

    public static void main(String[] args) {
        SpringApplication.run(LanStreamApplication.class, args);
    }


    @Override
    public void onApplicationEvent(ContextRefreshedEvent event) {
        String uploadPath = event.getApplicationContext().getEnvironment().getProperty("web.upload-path");
        if (!StringUtils.hasText(uploadPath)) {
            throw new RuntimeException("未配置文件上传目录！" + uploadPath);
        }
        Path path = Paths.get(uploadPath);
        
        if (!Files.exists(path)) {
            log.warn("创建目录：" + uploadPath);
            try {
                Files.createDirectories(path);
            } catch (IOException e) {
                throw new RuntimeException("创建目录失败！" + uploadPath);
            }
        } else {
            if (!Files.isDirectory(path)) {
                throw new RuntimeException("文件上传目录配置错误， " + uploadPath + " 是文件！");
            }
        }
    }
}

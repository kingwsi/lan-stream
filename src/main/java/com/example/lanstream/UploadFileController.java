package com.example.lanstream;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;

/**
 * description:  <br>
 * date: 2022/11/10 16:23 <br>
 */
@RestController
public class UploadFileController {

    @Value("${web.upload-path}")
    private String uploadPath;
    
    @RequestMapping(value = "/file-upload", method = RequestMethod.POST)
    @ResponseBody
    public String uploadFile(@RequestParam("file") MultipartFile multipartFile) throws IOException {
        multipartFile.transferTo(new File(uploadPath + "/" + multipartFile.getOriginalFilename()));
        return "/" + multipartFile.getOriginalFilename();
    }
}

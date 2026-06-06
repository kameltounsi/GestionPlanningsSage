package com.gestionplanning.user;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class MailExceptionHandler {
    @ExceptionHandler(MailDeliveryException.class)
    public ResponseEntity<String> mailDeliveryError(MailDeliveryException exception) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(exception.getMessage());
    }
}

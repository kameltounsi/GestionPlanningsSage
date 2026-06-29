package com.gestionplanning.penalty;

import javax.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.time.LocalDate;

public class PenaltyDto {
    private Long id;
    private Long requestId;
    private String pilot;

    @NotBlank
    private String delayType;

    private BigDecimal amount = BigDecimal.ZERO;
    private LocalDate date;
    private String comment;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getRequestId() { return requestId; }
    public void setRequestId(Long requestId) { this.requestId = requestId; }
    public String getPilot() { return pilot; }
    public void setPilot(String pilot) { this.pilot = pilot; }
    public String getDelayType() { return delayType; }
    public void setDelayType(String delayType) { this.delayType = delayType; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
}

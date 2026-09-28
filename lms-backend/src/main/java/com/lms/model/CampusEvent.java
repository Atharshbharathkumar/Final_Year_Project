package com.lms.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "campus_events")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CampusEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    private LocalDateTime startsAt;

    /** workshop | competition | seminar | career */
    private String type;

    /** Academic credits awarded for attending. */
    private Integer credits;

    private String location;
}
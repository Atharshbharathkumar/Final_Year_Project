package com.lms.service;

import com.lms.model.*;
import com.lms.repository.*;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AttendanceService {

    private final AttendanceRecordRepository attendanceRepository;
    private final CourseRepository courseRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final AttentionLogRepository attentionLogRepository;
    private final AccessGuard accessGuard;

    /**
     * A student needs at least this many measured attention samples in a session
     * before AUTO marking will call them present. At one sample every 2 seconds,
     * 30 samples is roughly a minute of verified camera presence — enough to
     * distinguish attending from opening the tab and walking away.
     */
    private static final int MIN_SAMPLES_FOR_PRESENT = 30;

    public List<AttendanceRecord> getForStudent(User student, User viewer) {
        accessGuard.requireCanView(viewer, student);
        return attendanceRepository.findByStudentOrderByDateDesc(student);
    }

    public List<AttendanceRecord> getRegister(Long courseId, LocalDate date, User viewer) {
        accessGuard.requireStaff(viewer);
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found"));
        return attendanceRepository.findByCourseAndDateOrderByStudentAsc(course, date);
    }

    @Transactional
    public AttendanceRecord mark(Long studentId, Long courseId, LocalDate date,
                                 AttendanceRecord.Status status, User marker) {
        accessGuard.requireStaff(marker);
        User student = accessGuard.requireStudent(studentId);
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found"));

        AttendanceRecord record = attendanceRepository
                .findByStudentAndCourseAndDate(student, course, date)
                .orElseGet(() -> AttendanceRecord.builder()
                        .student(student).course(course).date(date).build());

        record.setStatus(status);
        // A human overriding an inferred mark makes it a manual mark.
        record.setSource(AttendanceRecord.Source.MANUAL);
        record.setMarkedBy(marker);
        record.setMarkedAt(LocalDateTime.now());
        return attendanceRepository.save(record);
    }

    /**
     * Derives attendance for a live session from the attention samples actually
     * recorded during it.
     *
     * Only students with enough measured samples are marked PRESENT. Everyone
     * else enrolled is left ABSENT — but note this cannot distinguish "did not
     * attend" from "attended with no working camera", so the teacher is expected
     * to review and override. That limitation is surfaced in the response.
     */
    @Transactional
    public AutoMarkResult autoMarkFromSession(Long courseId, Long sessionId, LocalDate date, User marker) {
        accessGuard.requireStaff(marker);
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found"));

        List<Enrollment> enrollments = enrollmentRepository.findByCourse(course);
        List<AttendanceRecord> written = new ArrayList<>();
        int present = 0;
        int absent = 0;

        for (Enrollment enrollment : enrollments) {
            User student = enrollment.getStudent();
            long samples = attentionLogRepository
                    .countByStudentAndSessionIdAndContextTypeAndScoreIsNotNull(student, sessionId, "CLASSROOM");

            AttendanceRecord existing = attendanceRepository
                    .findByStudentAndCourseAndDate(student, course, date)
                    .orElse(null);

            // Never overwrite a mark a teacher made by hand.
            if (existing != null && existing.getSource() == AttendanceRecord.Source.MANUAL) {
                continue;
            }

            AttendanceRecord record = existing != null ? existing : AttendanceRecord.builder()
                    .student(student).course(course).date(date).build();

            boolean wasPresent = samples >= MIN_SAMPLES_FOR_PRESENT;
            record.setStatus(wasPresent ? AttendanceRecord.Status.PRESENT : AttendanceRecord.Status.ABSENT);
            record.setSource(AttendanceRecord.Source.AUTO_SESSION);
            record.setSessionId(sessionId);
            record.setSampleCount((int) samples);
            record.setMarkedBy(marker);
            record.setMarkedAt(LocalDateTime.now());

            written.add(attendanceRepository.save(record));
            if (wasPresent) present++; else absent++;
        }

        return AutoMarkResult.builder()
                .courseId(courseId)
                .sessionId(sessionId)
                .date(date)
                .markedPresent(present)
                .markedAbsent(absent)
                .minSamplesRequired(MIN_SAMPLES_FOR_PRESENT)
                .records(written)
                .caveat("Inferred from recorded camera attention only. A student who attended without a "
                        + "working camera will appear ABSENT — review before treating this as final.")
                .build();
    }

    public AttendanceSummary summarise(User student, User viewer) {
        accessGuard.requireCanView(viewer, student);
        long total = attendanceRepository.countByStudent(student);
        long presentCount = attendanceRepository.countByStudentAndStatus(student, AttendanceRecord.Status.PRESENT);
        long lateCount = attendanceRepository.countByStudentAndStatus(student, AttendanceRecord.Status.LATE);
        long absentCount = attendanceRepository.countByStudentAndStatus(student, AttendanceRecord.Status.ABSENT);

        // Null rather than 0% when nothing has been recorded — those are different.
        Double percentage = total == 0 ? null
                : Math.round(((presentCount + lateCount) * 1000.0 / total)) / 10.0;

        return AttendanceSummary.builder()
                .studentId(student.getId())
                .studentName(student.getFullName())
                .totalRecorded(total)
                .present(presentCount)
                .late(lateCount)
                .absent(absentCount)
                .attendancePercentage(percentage)
                .build();
    }

    @Data
    @Builder
    public static class AutoMarkResult {
        private Long courseId;
        private Long sessionId;
        private LocalDate date;
        private int markedPresent;
        private int markedAbsent;
        private int minSamplesRequired;
        private String caveat;
        private List<AttendanceRecord> records;
    }

    @Data
    @Builder
    public static class AttendanceSummary {
        private Long studentId;
        private String studentName;
        private long totalRecorded;
        private long present;
        private long late;
        private long absent;
        private Double attendancePercentage;
    }
}

package com.lms.service;

import com.lms.dto.AlseDtos;
import com.lms.model.*;
import com.lms.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Adaptive Learning State Engine.
 * <p>
 * Classifies each attention reading into a pedagogical state, stores the
 * transitions with the evidence that caused them, and turns the resulting
 * history into the Digital Twin, intervention queue and what-if simulator.
 */
@Service
@RequiredArgsConstructor
public class AlseService {

    private static final DateTimeFormatter CLOCK = DateTimeFormatter.ofPattern("HH:mm");

    /** Days to wait after resolving an intervention before raising another. */
    private static final int COOLDOWN_DAYS = 7;

    private final LearningStateLogRepository stateRepository;
    private final AttentionLogRepository attentionLogRepository;
    private final InterventionRepository interventionRepository;
    private final UserRepository userRepository;
    private final SubmissionRepository submissionRepository;
    private final ExamAttemptRepository attemptRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final AttendanceRecordRepository attendanceRepository;
    private final AnalyticsService analytics;

    // ───────────────────────────── classification ─────────────────────────────

    /**
     * Maps one attention reading to a learning state. Thresholds mirror the
     * client-side vision pipeline: eyes-off-screen and tab-blur dominate, then
     * the smoothed attention score decides between deep, focused and passive.
     */
    private Classified classify(AttentionLog log, boolean chattingNow, boolean strugglingAcademically) {
        double score = log.getScore() == null ? 0 : log.getScore();
        String eye = log.getEyeStatus() == null ? "CENTER" : log.getEyeStatus();
        boolean tabActive = !Boolean.FALSE.equals(log.getIsTabActive());
        boolean faceOk = !Boolean.FALSE.equals(log.getFaceDetected());

        int confidence = (int) Math.max(60, Math.min(99, Math.round(60 + Math.abs(score - 50) * 0.78)));

        if (chattingNow) {
            return new Classified(LearningStateLog.LearningState.COLLABORATIVE,
                    "Participating in class chat and discussion", Math.max(confidence, 88));
        }
        if (!tabActive) {
            return new Classified(LearningStateLog.LearningState.DISTRACTED,
                    "Non-course tab or window took focus during the session", confidence);
        }
        if (!faceOk || "NO_FACE".equals(eye)) {
            return new Classified(LearningStateLog.LearningState.DISTRACTED,
                    "Student left the camera frame — no face detected", confidence);
        }
        if ("MULTIPLE_FACES".equals(eye)) {
            return new Classified(LearningStateLog.LearningState.DISTRACTED,
                    "More than one face detected in frame", confidence);
        }
        if ("LOOKING_AWAY".equals(eye) || "EYES_CLOSED".equals(eye)) {
            return new Classified(LearningStateLog.LearningState.PASSIVE_LEARNING,
                    "Attention shift observed — gaze " + eye.toLowerCase(Locale.ENGLISH).replace('_', ' '), confidence);
        }
        if (strugglingAcademically && score < 75) {
            return new Classified(LearningStateLog.LearningState.STRUGGLING,
                    "On-screen but repeated low assessment accuracy on current topic", confidence);
        }
        if (score >= 85) {
            return new Classified(LearningStateLog.LearningState.DEEP_LEARNING,
                    "Sustained gaze on course content (attention " + Math.round(score) + "%)", confidence);
        }
        if (score >= 70) {
            return new Classified(LearningStateLog.LearningState.FOCUSED,
                    "Course screen active, gaze centred (attention " + Math.round(score) + "%)", confidence);
        }
        if (score >= 50) {
            return new Classified(LearningStateLog.LearningState.PASSIVE_LEARNING,
                    "Reading detected but low interaction (attention " + Math.round(score) + "%)", confidence);
        }
        return new Classified(LearningStateLog.LearningState.DISTRACTED,
                "Attention fell to " + Math.round(score) + "% for a sustained window", confidence);
    }

    /**
     * Turns any attention readings newer than the last stored state into state
     * transitions. Only genuine changes are recorded, so the timeline stays
     * readable instead of repeating the same state every few seconds.
     */
    @Transactional
    public List<LearningStateLog> syncStates(User student) {
        List<LearningStateLog> stored = stateRepository.findByStudentOrderByTimestampAsc(student);
        LocalDateTime watermark = stored.isEmpty() ? null : stored.get(stored.size() - 1).getTimestamp();

        List<AttentionLog> fresh = attentionLogRepository.findByStudentOrderByTimestampAsc(student).stream()
                .filter(l -> l.getTimestamp() != null)
                .filter(l -> watermark == null || l.getTimestamp().isAfter(watermark))
                .toList();
        if (fresh.isEmpty()) return stored;

        boolean struggling = analytics.quizPerformance(student).orElse(100) < 60;
        List<LocalDateTime> chatTimes = chatMessageRepository.findAll().stream()
                .filter(m -> m.getSender() != null && m.getSender().getId().equals(student.getId()))
                .map(ChatMessage::getTimestamp)
                .filter(Objects::nonNull)
                .toList();

        LearningStateLog.LearningState previous = stored.isEmpty() ? null : stored.get(stored.size() - 1).getState();
        List<LearningStateLog> created = new ArrayList<>();

        for (AttentionLog log : fresh) {
            boolean chattingNow = chatTimes.stream()
                    .anyMatch(t -> Math.abs(java.time.Duration.between(t, log.getTimestamp()).toMinutes()) <= 1);
            Classified c = classify(log, chattingNow, struggling);
            if (c.state == previous) continue;

            created.add(stateRepository.save(LearningStateLog.builder()
                    .student(student)
                    .sessionId(log.getSessionId())
                    .state(c.state)
                    .evidence(c.evidence)
                    .confidence(c.confidence)
                    .timestamp(log.getTimestamp())
                    .build()));
            previous = c.state;
        }

        List<LearningStateLog> all = new ArrayList<>(stored);
        all.addAll(created);
        all.sort(Comparator.comparing(LearningStateLog::getTimestamp));
        return all;
    }

    // ──────────────────────────────── reads ───────────────────────────────────

    public AlseDtos.CurrentState currentState(User student) {
        List<LearningStateLog> states = syncStates(student);
        if (states.isEmpty()) {
            return AlseDtos.CurrentState.builder()
                    .state("No Data").type("slate").confidence(0)
                    .description("No attention readings have been recorded for this student yet.")
                    .build();
        }
        LearningStateLog latest = states.get(states.size() - 1);
        return AlseDtos.CurrentState.builder()
                .state(label(latest.getState()))
                .type(tone(latest.getState()))
                .confidence(latest.getConfidence())
                .description(describe(latest.getState()))
                .build();
    }

    public AlseDtos.LearningStateView learningStateView(User student) {
        List<LearningStateLog> states = syncStates(student);

        List<AlseDtos.StateTimelineEntry> timeline = states.stream()
                .sorted(Comparator.comparing(LearningStateLog::getTimestamp).reversed())
                .limit(12)
                .sorted(Comparator.comparing(LearningStateLog::getTimestamp))
                .map(s -> AlseDtos.StateTimelineEntry.builder()
                        .time(s.getTimestamp().format(CLOCK))
                        .state(label(s.getState()))
                        .type(tone(s.getState()))
                        .evidence(s.getEvidence())
                        .confidence(s.getConfidence())
                        .build())
                .toList();

        return AlseDtos.LearningStateView.builder()
                .studentId(student.getId())
                .studentName(student.getFullName())
                .current(currentState(student))
                .timeline(timeline)
                .explainableScore(explainableScore(student))
                .build();
    }

    /**
     * Breaks the engagement score into the seven weighted factors that produced
     * it, so the UI can show the "why" next to the "what".
     */
    public AlseDtos.ExplainableScore explainableScore(User student) {
        int attendance = analytics.attendanceRate(student).orElse(0);
        int assignments = analytics.assignmentCompletion(student).orElse(0);
        int quiz = analytics.quizPerformance(student).orElse(0);
        int progress = (int) Math.round(analytics.coursesFor(student).stream()
                .mapToInt(c -> analytics.courseProgress(student, c)).average().orElse(0));
        int participation = analytics.participation(student);
        int visual = analytics.meanAttention(student).orElse(0);
        int screen = screenActivityPercent(student);

        List<AlseDtos.ScoreFactor> breakdown = List.of(
                factor("Attendance", attendance, 20),
                factor("Assignment Completion", assignments, 20),
                factor("Quiz Participation", quiz, 15),
                factor("Course Progress", progress, 15),
                factor("Class Participation", participation, 10),
                factor("Visual Engagement", visual, 10),
                factor("Screen Activity", screen, 10)
        );

        int total = breakdown.stream().mapToInt(AlseDtos.ScoreFactor::getImpact).sum();

        String improvementArea = breakdown.stream()
                .sorted(Comparator.comparingDouble(f -> (double) f.getImpact() / f.getMax()))
                .limit(2)
                .map(AlseDtos.ScoreFactor::getFactor)
                .collect(Collectors.joining(" & "));

        return AlseDtos.ExplainableScore.builder()
                .total(total)
                .breakdown(breakdown)
                .improvementArea(improvementArea)
                .build();
    }

    private AlseDtos.ScoreFactor factor(String name, int percent, int max) {
        return AlseDtos.ScoreFactor.builder()
                .factor(name)
                .impact((int) Math.round(AnalyticsService.clamp(percent) / 100.0 * max))
                .max(max)
                .build();
    }

    /** Share of readings where the course tab still had focus. */
    private int screenActivityPercent(User student) {
        List<AttentionLog> logs = attentionLogRepository.findByStudent(student);
        if (logs.isEmpty()) return 0;
        long onTask = logs.stream().filter(l -> !Boolean.FALSE.equals(l.getIsTabActive())).count();
        return (int) Math.round(100.0 * onTask / logs.size());
    }

    public AlseDtos.DigitalTwin digitalTwin(User student) {
        List<LearningStateLog> states = syncStates(student);

        Map<LearningStateLog.LearningState, Long> counts = states.stream()
                .collect(Collectors.groupingBy(LearningStateLog::getState, Collectors.counting()));
        long total = Math.max(1, states.size());

        List<AlseDtos.StateSlice> distribution = Arrays.stream(LearningStateLog.LearningState.values())
                .filter(counts::containsKey)
                .map(s -> AlseDtos.StateSlice.builder()
                        .name(label(s))
                        .value((int) Math.round(100.0 * counts.get(s) / total))
                        .color(color(s))
                        .build())
                .sorted(Comparator.comparing(AlseDtos.StateSlice::getValue).reversed())
                .toList();

        AlseDtos.StateSlice dominant = distribution.isEmpty()
                ? AlseDtos.StateSlice.builder().name("No Data").value(0).color("#64748b").build()
                : distribution.get(0);

        List<Intervention> resolved = interventionRepository.findByStudentOrderByCreatedAtDesc(student).stream()
                .filter(i -> i.getOutcomeScore() != null && i.getBaselineScore() != null)
                .toList();
        int successRate = resolved.isEmpty() ? 0 : (int) Math.round(100.0 * resolved.stream()
                .filter(i -> i.getOutcomeScore() > i.getBaselineScore()).count() / resolved.size());

        return AlseDtos.DigitalTwin.builder()
                .studentId(student.getId())
                .student(student.getFullName())
                .cohort(student.getDepartment() != null ? student.getDepartment().getName() + " Cohort" : "General Cohort")
                .stateDistribution(distribution)
                .dominantState(dominant)
                .characteristics(characteristics(student))
                .explainableScore(explainableScore(student))
                .interventionSuccessRate(successRate)
                .interventionsObserved(resolved.size())
                .build();
    }

    /**
     * Learning habits inferred from where this student actually performs: which
     * assessment format scores higher, which course leads and trails, and the
     * hour band with the strongest measured attention.
     */
    private AlseDtos.Characteristics characteristics(User student) {
        double assignmentMean = submissionRepository.findByStudent(student).stream()
                .filter(s -> s.getStatus() == Submission.Status.GRADED && s.getGrade() != null)
                .filter(s -> s.getAssignment().getPoints() != null && s.getAssignment().getPoints() > 0)
                .mapToDouble(s -> 100.0 * s.getGrade() / s.getAssignment().getPoints())
                .average().orElse(0);

        double examMean = attemptRepository.findByStudent(student).stream()
                .filter(a -> a.getStatus() != ExamAttempt.AttemptStatus.IN_PROGRESS)
                .filter(a -> a.getMaxScore() != null && a.getMaxScore() > 0)
                .mapToDouble(a -> 100.0 * (a.getScore() == null ? 0 : a.getScore()) / a.getMaxScore())
                .average().orElse(0);

        boolean practicalStronger = assignmentMean >= examMean;

        Course best = analytics.coursesFor(student).stream()
                .max(Comparator.comparingInt(c -> analytics.courseScorePercent(student, c))).orElse(null);
        Course worst = analytics.coursesFor(student).stream()
                .min(Comparator.comparingInt(c -> analytics.courseScorePercent(student, c))).orElse(null);

        return AlseDtos.Characteristics.builder()
                .bestPerformance(practicalStronger
                        ? "Practical coursework (avg " + Math.round(assignmentMean) + "%)"
                        : "Timed assessments (avg " + Math.round(examMean) + "%)")
                .difficulty(practicalStronger
                        ? "Timed multiple-choice assessments"
                        : "Long-form practical assignments")
                .strongest(best != null
                        ? best.getTitle() + " (avg " + analytics.courseScorePercent(student, best) + "%)"
                        : "Not enough graded work yet")
                .weakest(worst != null
                        ? worst.getTitle() + " (avg " + analytics.courseScorePercent(student, worst) + "%)"
                        : "Not enough graded work yet")
                .peakLearning(peakLearningWindow(student))
                .build();
    }

    private String peakLearningWindow(User student) {
        List<AttentionLog> logs = attentionLogRepository.findByStudent(student).stream()
                .filter(l -> l.getTimestamp() != null && l.getScore() != null)
                .toList();
        if (logs.isEmpty()) return "Not enough data yet";

        Map<Integer, Double> byHour = logs.stream().collect(Collectors.groupingBy(
                l -> l.getTimestamp().getHour(),
                Collectors.averagingDouble(AttentionLog::getScore)));

        int peak = byHour.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey).orElse(10);
        return String.format("%02d:00 – %02d:30", peak, (peak + 2) % 24);
    }

    // ───────────────────────────── interventions ──────────────────────────────

    /**
     * Raises a pending intervention for every high-risk student that does not
     * already have one open, with the evidence that triggered it.
     */
    @Transactional
    public void refreshInterventions() {
        for (User student : userRepository.findByRole(User.Role.STUDENT)) {
            if (!"high".equals(analytics.riskLevel(student))) continue;

            // Skip students who already have an open action, and give recently
            // resolved ones a cooldown so the queue does not immediately refill.
            LocalDateTime cooldown = LocalDateTime.now().minusDays(COOLDOWN_DAYS);
            boolean suppressed = interventionRepository.findByStudentOrderByCreatedAtDesc(student).stream()
                    .anyMatch(i -> i.getStatus() == Intervention.Status.PENDING
                            || i.getStatus() == Intervention.Status.APPROVED
                            || (i.getResolvedAt() != null && i.getResolvedAt().isAfter(cooldown)));
            if (suppressed) continue;

            List<String> evidence = new ArrayList<>();
            analytics.quizPerformance(student).ifPresent(q -> evidence.add("Mean assessment accuracy: " + q + "%"));
            analytics.assignmentCompletion(student).ifPresent(a -> evidence.add("Assignment completion: " + a + "%"));
            analytics.attendanceRate(student).ifPresent(a -> evidence.add("Attendance: " + a + "%"));
            int attention = analytics.meanAttention(student).orElse(0);
            if (attention > 0) evidence.add("Mean measured attention: " + attention + "%");
            long absences = attendanceRepository.findByStudent(student).stream()
                    .filter(r -> Boolean.FALSE.equals(r.getPresent())).count();
            if (absences > 0) evidence.add("Sessions missed: " + absences);

            LearningStateLog.LearningState trigger = currentStateEnum(student);
            interventionRepository.save(Intervention.builder()
                    .student(student)
                    .triggerState(trigger)
                    .evidence(evidence)
                    .recommendation(recommendationFor(trigger, student))
                    .objective(objectiveFor(trigger))
                    .status(Intervention.Status.PENDING)
                    .baselineScore((double) analytics.engagementScore(student))
                    .build());
        }
    }

    private LearningStateLog.LearningState currentStateEnum(User student) {
        List<LearningStateLog> states = stateRepository.findByStudentOrderByTimestampAsc(student);
        if (states.isEmpty()) return LearningStateLog.LearningState.STRUGGLING;
        return states.get(states.size() - 1).getState();
    }

    private String recommendationFor(LearningStateLog.LearningState state, User student) {
        Course weakest = analytics.coursesFor(student).stream()
                .min(Comparator.comparingInt(c -> analytics.courseScorePercent(student, c)))
                .orElse(null);
        String topic = weakest != null ? weakest.getTitle() : "the current module";

        return switch (state) {
            case DISTRACTED -> "Prompt an interactive pulse-check question to regain focus during the next session.";
            case PASSIVE_LEARNING -> "Share a short practice set for " + topic + " to convert passive reading into active recall.";
            case STRUGGLING -> "Recommend a 5-minute concept recap video on " + topic + " before advancing.";
            default -> "Schedule a brief 1-on-1 virtual check-in to identify blockers.";
        };
    }

    private String objectiveFor(LearningStateLog.LearningState state) {
        return switch (state) {
            case DISTRACTED -> "Re-engage the student interactively without reprimand.";
            case PASSIVE_LEARNING -> "Move the student from passive intake to active practice.";
            case STRUGGLING -> "Bridge the fundamental conceptual gap before advancing.";
            default -> "Identify personal or academic blockers early.";
        };
    }

    public AlseDtos.InterventionSummary interventionSummary() {
        refreshInterventions();

        List<Intervention> all = interventionRepository.findAllByOrderByCreatedAtDesc();
        long atRisk = userRepository.findByRole(User.Role.STUDENT).stream()
                .filter(s -> "high".equals(analytics.riskLevel(s))).count();
        long pending = all.stream().filter(i -> i.getStatus() == Intervention.Status.PENDING).count();

        List<Intervention> measured = all.stream()
                .filter(i -> i.getStatus() == Intervention.Status.DELIVERED && i.getBaselineScore() != null)
                .toList();
        int avgImprovement = measured.isEmpty() ? 0 : (int) Math.round(measured.stream()
                .mapToDouble(i -> analytics.engagementScore(i.getStudent()) - i.getBaselineScore())
                .average().orElse(0));

        return AlseDtos.InterventionSummary.builder()
                .atRisk(atRisk)
                .pending(pending)
                .averageImprovement(avgImprovement)
                .interventions(all.stream().map(this::toView).toList())
                .build();
    }

    private AlseDtos.InterventionView toView(Intervention i) {
        AlseDtos.Outcome outcome = null;
        // The outcome of a delivered action is measured live against the baseline
        // captured when it was raised, so it keeps improving as new data arrives.
        if (i.getStatus() == Intervention.Status.DELIVERED && i.getBaselineScore() != null) {
            double current = analytics.engagementScore(i.getStudent());
            double delta = current - i.getBaselineScore();
            outcome = AlseDtos.Outcome.builder()
                    .status(delta > 2 ? "Positive" : delta < -2 ? "Negative" : "Neutral")
                    .improvement((delta >= 0 ? "+" : "") + Math.round(delta) + "%")
                    .metric("Engagement (" + Math.round(i.getBaselineScore()) + "% → " + Math.round(current) + "%)")
                    .resultingState(i.getResultingState() != null ? label(i.getResultingState()) : "—")
                    .build();
        }

        String status = i.getStatus().name().charAt(0) + i.getStatus().name().substring(1).toLowerCase(Locale.ENGLISH);

        return AlseDtos.InterventionView.builder()
                .id(i.getId())
                .studentId(i.getStudent().getId())
                .student(i.getStudent().getFullName())
                .currentState(i.getTriggerState() != null ? label(i.getTriggerState()) : "Unknown")
                .evidence(i.getEvidence())
                .recommendation(i.getRecommendation())
                .objective(i.getObjective())
                .status(status)
                .outcome(outcome)
                .build();
    }

    /**
     * Approving an intervention marks it delivered and captures the student's
     * engagement at that moment as the measured outcome.
     */
    @Transactional
    public AlseDtos.InterventionView decide(Long interventionId, boolean approve) {
        Intervention intervention = interventionRepository.findById(interventionId)
                .orElseThrow(() -> new IllegalArgumentException("Intervention not found: " + interventionId));

        if (approve) {
            intervention.setStatus(Intervention.Status.DELIVERED);
            intervention.setResolvedAt(LocalDateTime.now());
            intervention.setOutcomeMetric("Engagement score after delivery");
            intervention.setResultingState(currentStateEnum(intervention.getStudent()));
        } else {
            intervention.setStatus(Intervention.Status.REJECTED);
            intervention.setResolvedAt(LocalDateTime.now());
        }
        return toView(interventionRepository.save(intervention));
    }

    // ────────────────────────────── simulator ─────────────────────────────────

    /**
     * What-if forecasting. Each scenario applies a documented uplift model to the
     * cohort's real distribution rather than returning a fixed number.
     */
    public AlseDtos.SimulatorView simulate() {
        List<User> students = userRepository.findByRole(User.Role.STUDENT);
        if (students.isEmpty()) {
            return AlseDtos.SimulatorView.builder()
                    .currentStruggling(0).baselineEngagement(0).scenarios(List.of()).build();
        }

        List<Integer> scores = students.stream().map(analytics::engagementScore).sorted().toList();
        int baseline = (int) Math.round(scores.stream().mapToInt(Integer::intValue).average().orElse(0));
        int struggling = (int) students.stream().filter(s -> analytics.engagementScore(s) < 60).count();

        int meanQuiz = (int) Math.round(students.stream()
                .mapToInt(s -> analytics.quizPerformance(s).orElse(0)).average().orElse(0));
        int meanParticipation = (int) Math.round(students.stream()
                .mapToInt(analytics::participation).average().orElse(0));
        int meanAttention = (int) Math.round(students.stream()
                .mapToInt(s -> analytics.meanAttention(s).orElse(0)).average().orElse(0));

        // Head-room is what an intervention can realistically recover.
        int headroom = Math.max(0, 100 - baseline);

        List<AlseDtos.Scenario> scenarios = List.of(
                scenario("sc1", "Add Revision Video for Struggling Students",
                        (int) Math.round(headroom * 0.35), (int) Math.round((100 - meanQuiz) * 0.30),
                        struggling, 0.40),
                scenario("sc2", "Reduce Quiz Difficulty by 15%",
                        (int) Math.round(headroom * 0.15), (int) Math.round((100 - meanQuiz) * 0.45),
                        struggling, 0.22),
                scenario("sc3", "Introduce Peer-to-Peer Review",
                        (int) Math.round((100 - meanParticipation) * 0.30), (int) Math.round((100 - meanQuiz) * 0.12),
                        struggling, 0.18),
                scenario("sc4", "Schedule 15m Live Q&A Session",
                        (int) Math.round((100 - meanAttention) * 0.40), (int) Math.round((100 - meanQuiz) * 0.20),
                        struggling, 0.30)
        );

        return AlseDtos.SimulatorView.builder()
                .currentStruggling(struggling)
                .baselineEngagement(baseline)
                .scenarios(scenarios)
                .build();
    }

    private AlseDtos.Scenario scenario(String id, String name, int engagementUplift,
                                       int assessmentUplift, int struggling, double recoveryRate) {
        return AlseDtos.Scenario.builder()
                .id(id)
                .name(name)
                .impact("+" + Math.max(1, engagementUplift) + "%")
                .assessment("+" + Math.max(1, assessmentUplift) + "%")
                .target(struggling)
                .result((int) Math.max(0, Math.round(struggling * (1 - recoveryRate))))
                .build();
    }

    // ─────────────────────────────── labelling ────────────────────────────────

    public static String label(LearningStateLog.LearningState state) {
        return switch (state) {
            case DEEP_LEARNING -> "Deep Learning";
            case PASSIVE_LEARNING -> "Passive Learning";
            case COLLABORATIVE -> "Collaborative";
            case DISTRACTED -> "Distracted";
            case STRUGGLING -> "Struggling";
            case FOCUSED -> "Focused";
        };
    }

    private static String tone(LearningStateLog.LearningState state) {
        return switch (state) {
            case DEEP_LEARNING, FOCUSED -> "positive";
            case COLLABORATIVE -> "brand";
            case PASSIVE_LEARNING -> "warning";
            case DISTRACTED, STRUGGLING -> "danger";
        };
    }

    private static String color(LearningStateLog.LearningState state) {
        return switch (state) {
            case DEEP_LEARNING -> "#10b981";
            case FOCUSED -> "#22c55e";
            case COLLABORATIVE -> "#8b5cf6";
            case PASSIVE_LEARNING -> "#f59e0b";
            case STRUGGLING -> "#f43f5e";
            case DISTRACTED -> "#64748b";
        };
    }

    private static String describe(LearningStateLog.LearningState state) {
        return switch (state) {
            case DEEP_LEARNING -> "Student is demonstrating strong conceptual interaction matching the current material.";
            case FOCUSED -> "Student is attending to course content with steady on-screen focus.";
            case COLLABORATIVE -> "Student is actively contributing to class discussion.";
            case PASSIVE_LEARNING -> "Student is present but interaction has dropped — consider an activity change.";
            case DISTRACTED -> "Attention has moved away from course material.";
            case STRUGGLING -> "Student is engaged but assessment accuracy suggests a conceptual gap.";
        };
    }

    /** Classification result: the state plus why the engine chose it. */
    private record Classified(LearningStateLog.LearningState state, String evidence, int confidence) {
    }
}
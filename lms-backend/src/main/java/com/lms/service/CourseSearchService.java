package com.lms.service;

import com.lms.model.Course;
import com.lms.model.Exam;
import com.lms.repository.CourseRepository;
import com.lms.repository.ExamRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Keyword search over the course material stored in this system.
 *
 * This is term-overlap retrieval, not a language model: it ranks the course and
 * exam records already in the database against the words in the question and
 * returns the best matches with their source. It cannot generate an answer that
 * is not present in the corpus, which is the point — every response is traceable
 * to a row a teacher created.
 *
 * Exam questions are deliberately NOT part of the corpus. Indexing them would
 * turn this endpoint into a way to read exam content, including during an
 * active attempt.
 */
@Service
@RequiredArgsConstructor
public class CourseSearchService {

    private final CourseRepository courseRepository;
    private final ExamRepository examRepository;

    private static final int MAX_RESULTS = 3;

    /** Words too common to discriminate between documents. */
    private static final Set<String> STOP_WORDS = new HashSet<>(Arrays.asList(
            "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
            "what", "which", "who", "whom", "how", "why", "when", "where",
            "do", "does", "did", "can", "could", "should", "would", "will",
            "of", "in", "on", "at", "to", "for", "with", "about", "from", "by",
            "and", "or", "but", "if", "then", "than", "this", "that", "these",
            "those", "it", "its", "as", "me", "my", "i", "you", "your", "explain",
            "tell", "describe", "define"
    ));

    public SearchAnswer search(String question) {
        if (question == null || question.trim().length() < 2) {
            return SearchAnswer.builder()
                    .matched(false)
                    .answer("Type a question about one of your courses and I will search the course material for it.")
                    .sources(List.of())
                    .build();
        }

        List<String> terms = tokenize(question);
        if (terms.isEmpty()) {
            return SearchAnswer.builder()
                    .matched(false)
                    .answer("That question was all common words, so there was nothing to search on. Try naming a topic, a course code, or a specific term.")
                    .sources(List.of())
                    .build();
        }

        List<Match> matches = new ArrayList<>();

        for (Course course : courseRepository.findAll()) {
            String body = join(course.getCourseCode(), course.getTitle(), course.getDescription());
            int score = score(body, terms);
            if (score > 0) {
                matches.add(Match.builder()
                        .score(score)
                        .sourceType("COURSE")
                        .sourceLabel(course.getCourseCode() + " — " + course.getTitle())
                        .excerpt(excerpt(course.getDescription(), terms))
                        .build());
            }
        }

        for (Exam exam : examRepository.findAll()) {
            String body = join(exam.getTitle(), exam.getDescription());
            int score = score(body, terms);
            if (score > 0) {
                String courseLabel = exam.getCourse() != null ? exam.getCourse().getCourseCode() : "Exam";
                matches.add(Match.builder()
                        .score(score)
                        .sourceType("EXAM")
                        .sourceLabel(courseLabel + " — " + exam.getTitle())
                        .excerpt(excerpt(exam.getDescription(), terms))
                        .build());
            }
        }

        if (matches.isEmpty()) {
            return SearchAnswer.builder()
                    .matched(false)
                    .answer("Nothing in your course material mentions that. This search only covers course and exam descriptions that teachers have entered — it does not answer from general knowledge.")
                    .sources(List.of())
                    .build();
        }

        List<Match> top = matches.stream()
                .sorted(Comparator.comparingInt(Match::getScore).reversed())
                .limit(MAX_RESULTS)
                .collect(Collectors.toList());

        String answer = "Found " + top.size() + " matching item"
                + (top.size() == 1 ? "" : "s") + " in your course material:";

        return SearchAnswer.builder()
                .matched(true)
                .answer(answer)
                .sources(top)
                .build();
    }

    private List<String> tokenize(String text) {
        return Arrays.stream(text.toLowerCase().split("[^a-z0-9]+"))
                .filter(t -> t.length() > 2)
                .filter(t -> !STOP_WORDS.contains(t))
                .distinct()
                .collect(Collectors.toList());
    }

    /** One point per matching term, plus a bonus for a whole-word hit. */
    private int score(String body, List<String> terms) {
        if (body == null) return 0;
        String lower = body.toLowerCase();
        int total = 0;
        for (String term : terms) {
            if (lower.contains(term)) {
                total += 1;
                if (lower.matches(".*\\b" + java.util.regex.Pattern.quote(term) + "\\b.*")) {
                    total += 2;
                }
            }
        }
        return total;
    }

    /** The sentence around the first matching term, so the hit is visible in context. */
    private String excerpt(String body, List<String> terms) {
        if (body == null || body.isBlank()) return "(no description recorded)";
        String[] sentences = body.split("(?<=\\.)\\s+");
        for (String sentence : sentences) {
            String lower = sentence.toLowerCase();
            for (String term : terms) {
                if (lower.contains(term)) {
                    return sentence.trim();
                }
            }
        }
        return sentences[0].trim();
    }

    private String join(String... parts) {
        return Arrays.stream(parts).filter(p -> p != null).collect(Collectors.joining(" "));
    }

    @Data
    @Builder
    public static class SearchAnswer {
        private boolean matched;
        private String answer;
        private List<Match> sources;
    }

    @Data
    @Builder
    public static class Match {
        private int score;
        private String sourceType;
        private String sourceLabel;
        private String excerpt;
    }
}

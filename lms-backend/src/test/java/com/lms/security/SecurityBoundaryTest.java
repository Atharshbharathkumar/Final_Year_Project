package com.lms.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lms.model.User;
import com.lms.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end checks on who may reach what.
 * <p>
 * These run against the real filter chain with real tokens, because the
 * interesting failures — a student reading another student's record, a guardian
 * reaching past their own child — only appear once authentication, method
 * security and the service-layer scoping are all in play together.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class SecurityBoundaryTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private ObjectMapper objectMapper;

    private static final String PASSWORD = "correct-horse";

    private User studentOne;
    private User studentTwo;
    private String studentOneToken;
    private String studentTwoToken;
    private String teacherToken;
    private String parentToken;
    private String adminToken;

    @BeforeEach
    void createPeople() throws Exception {
        studentOne = save("one@test.edu", "Student One", User.Role.STUDENT, null);
        studentTwo = save("two@test.edu", "Student Two", User.Role.STUDENT, null);
        User teacher = save("teacher@test.edu", "Teacher", User.Role.TEACHER, null);
        User parent = save("parent@test.edu", "Parent", User.Role.PARENT, studentOne);
        User admin = save("admin@test.edu", "Admin", User.Role.ADMIN, null);

        studentOneToken = login(studentOne.getEmail());
        studentTwoToken = login(studentTwo.getEmail());
        teacherToken = login(teacher.getEmail());
        parentToken = login(parent.getEmail());
        adminToken = login(admin.getEmail());
    }

    private User save(String email, String name, User.Role role, User linkedStudent) {
        return userRepository.save(User.builder()
                .email(email).fullName(name).role(role)
                .password(passwordEncoder.encode(PASSWORD))
                .linkedStudent(linkedStudent)
                .build());
    }

    private String login(String email) throws Exception {
        String body = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, PASSWORD)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode node = objectMapper.readTree(body);
        return node.get("accessToken").asText();
    }

    // ───────────────────────────── authentication ────────────────────────────

    @Nested
    @DisplayName("authentication")
    class Authentication {

        @Test
        @DisplayName("an anonymous request is refused with 401, not 403")
        void anonymousIsUnauthorized() throws Exception {
            mockMvc.perform(get("/api/dashboard/student"))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("a forged token is refused")
        void forgedTokenIsUnauthorized() throws Exception {
            mockMvc.perform(get("/api/dashboard/student")
                            .header("Authorization", "Bearer not-a-real-token"))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("the wrong password does not issue a token")
        void wrongPasswordIsRejected() throws Exception {
            mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"one@test.edu\",\"password\":\"guess\"}"))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("the public stats endpoint stays open so the login page can render")
        void publicStatsAreOpen() throws Exception {
            mockMvc.perform(get("/api/public/stats")).andExpect(status().isOk());
        }

        @Test
        @DisplayName("a valid token identifies the caller")
        void validTokenIdentifiesCaller() throws Exception {
            mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + studentOneToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.email").value("one@test.edu"))
                    .andExpect(jsonPath("$.role").value("STUDENT"));
        }

        @Test
        @DisplayName("a password is never returned in a response body")
        void passwordIsNeverSerialised() throws Exception {
            String body = mockMvc.perform(get("/api/auth/me")
                            .header("Authorization", "Bearer " + studentOneToken))
                    .andReturn().getResponse().getContentAsString();

            assertThat(body).doesNotContain("password").doesNotContain(PASSWORD);
        }
    }

    // ────────────────────────────── role gating ──────────────────────────────

    @Nested
    @DisplayName("role gating")
    class RoleGating {

        @Test
        @DisplayName("a student cannot open the teacher dashboard")
        void studentCannotReadTeacherDashboard() throws Exception {
            mockMvc.perform(get("/api/dashboard/teacher")
                            .header("Authorization", "Bearer " + studentOneToken))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("a student cannot open the admin dashboard")
        void studentCannotReadAdminDashboard() throws Exception {
            mockMvc.perform(get("/api/dashboard/admin")
                            .header("Authorization", "Bearer " + studentOneToken))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("a teacher cannot open the admin dashboard")
        void teacherCannotReadAdminDashboard() throws Exception {
            mockMvc.perform(get("/api/dashboard/admin")
                            .header("Authorization", "Bearer " + teacherToken))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("a student cannot read the cohort roster")
        void studentCannotReadRoster() throws Exception {
            mockMvc.perform(get("/api/analytics/roster")
                            .header("Authorization", "Bearer " + studentOneToken))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("a student cannot reach the grading queue")
        void studentCannotReadGradingQueue() throws Exception {
            mockMvc.perform(get("/api/assignments/submissions")
                            .header("Authorization", "Bearer " + studentOneToken))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("a student cannot create an assignment")
        void studentCannotCreateAssignment() throws Exception {
            mockMvc.perform(post("/api/assignments")
                            .header("Authorization", "Bearer " + studentOneToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"courseId\":1,\"title\":\"Mine\",\"dueDate\":\"2026-12-01\"}"))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("a student cannot create a course")
        void studentCannotCreateCourse() throws Exception {
            mockMvc.perform(post("/api/courses")
                            .header("Authorization", "Bearer " + studentOneToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"title\":\"Mine\",\"courseCode\":\"XX1\"}"))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("a student cannot approve an intervention")
        void studentCannotApproveIntervention() throws Exception {
            mockMvc.perform(post("/api/alse/interventions/1/approve")
                            .header("Authorization", "Bearer " + studentOneToken))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("a student cannot read an exam entity, which carries the answer key")
        void studentCannotReadExamEntity() throws Exception {
            mockMvc.perform(get("/api/exams/1")
                            .header("Authorization", "Bearer " + studentOneToken))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("a teacher can read their own dashboard")
        void teacherCanReadTeacherDashboard() throws Exception {
            mockMvc.perform(get("/api/dashboard/teacher")
                            .header("Authorization", "Bearer " + teacherToken))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("an admin can read the admin dashboard")
        void adminCanReadAdminDashboard() throws Exception {
            mockMvc.perform(get("/api/dashboard/admin")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk());
        }
    }

    // ──────────────────────── horizontal access control ──────────────────────

    @Nested
    @DisplayName("one student's data is not another's")
    class HorizontalScoping {

        @Test
        @DisplayName("a student cannot read a peer's dashboard by passing their id")
        void studentCannotReadPeerDashboard() throws Exception {
            mockMvc.perform(get("/api/dashboard/student")
                            .param("studentId", String.valueOf(studentTwo.getId()))
                            .header("Authorization", "Bearer " + studentOneToken))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(
                            org.hamcrest.Matchers.containsString("only view their own")));
        }

        @Test
        @DisplayName("a student cannot read a peer's learning state")
        void studentCannotReadPeerLearningState() throws Exception {
            mockMvc.perform(get("/api/alse/learning-state")
                            .param("studentId", String.valueOf(studentTwo.getId()))
                            .header("Authorization", "Bearer " + studentOneToken))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("a student cannot read a peer's digital twin")
        void studentCannotReadPeerTwin() throws Exception {
            mockMvc.perform(get("/api/alse/digital-twin")
                            .param("studentId", String.valueOf(studentTwo.getId()))
                            .header("Authorization", "Bearer " + studentOneToken))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("a student cannot read a peer's credits")
        void studentCannotReadPeerCredits() throws Exception {
            mockMvc.perform(get("/api/credits/my")
                            .param("studentId", String.valueOf(studentTwo.getId()))
                            .header("Authorization", "Bearer " + studentOneToken))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("a student may of course read their own record")
        void studentCanReadOwnRecord() throws Exception {
            mockMvc.perform(get("/api/dashboard/student")
                            .param("studentId", String.valueOf(studentOne.getId()))
                            .header("Authorization", "Bearer " + studentOneToken))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("student two's token cannot borrow student one's identity")
        void tokensAreNotInterchangeable() throws Exception {
            mockMvc.perform(get("/api/dashboard/student")
                            .param("studentId", String.valueOf(studentOne.getId()))
                            .header("Authorization", "Bearer " + studentTwoToken))
                    .andExpect(status().isBadRequest());
        }
    }

    @Nested
    @DisplayName("guardian scoping")
    class GuardianScoping {

        @Test
        @DisplayName("a guardian sees the student they are linked to")
        void guardianSeesLinkedStudent() throws Exception {
            mockMvc.perform(get("/api/dashboard/parent")
                            .header("Authorization", "Bearer " + parentToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.childName").value("Student One"));
        }

        @Test
        @DisplayName("a guardian's student view resolves to their own child without asking")
        void guardianStudentViewResolvesToChild() throws Exception {
            mockMvc.perform(get("/api/dashboard/student")
                            .header("Authorization", "Bearer " + parentToken))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("a guardian cannot reach a student they are not linked to")
        void guardianCannotReachOtherStudents() throws Exception {
            mockMvc.perform(get("/api/dashboard/student")
                            .param("studentId", String.valueOf(studentTwo.getId()))
                            .header("Authorization", "Bearer " + parentToken))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(
                            org.hamcrest.Matchers.containsString("linked student")));
        }

        @Test
        @DisplayName("a guardian cannot read the cohort roster")
        void guardianCannotReadRoster() throws Exception {
            mockMvc.perform(get("/api/analytics/roster")
                            .header("Authorization", "Bearer " + parentToken))
                    .andExpect(status().isForbidden());
        }
    }
}
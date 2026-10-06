-- 1. 데이터베이스 생성
CREATE DATABASE IF NOT EXISTS seoil_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE seoil_db;

-- 2. 학과 테이블
CREATE TABLE IF NOT EXISTS Departments (
    dept_id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

-- 3. 학생(사용자) 테이블
CREATE TABLE IF NOT EXISTS Users (
    student_id INT PRIMARY KEY,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(50) NOT NULL,
    entry_year INT NOT NULL,
    dept_id VARCHAR(20),
    FOREIGN KEY (dept_id) REFERENCES Departments(dept_id)
);

-- 4. 강의 목록 테이블
CREATE TABLE IF NOT EXISTS Courses (
    course_id VARCHAR(20) PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    credit INT NOT NULL,
    type VARCHAR(20),
    category VARCHAR(20)
);

-- 5. 이수 내역 테이블 (사용자 성적)
CREATE TABLE IF NOT EXISTS User_Grades (
    grade_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT,
    course_id VARCHAR(20),
    semester VARCHAR(10),
    is_pass BOOLEAN DEFAULT TRUE,
    score VARCHAR(5),
    FOREIGN KEY (student_id) REFERENCES Users(student_id),
    FOREIGN KEY (course_id) REFERENCES Courses(course_id)
);

-- 6. 졸업 요건 테이블
CREATE TABLE IF NOT EXISTS Grad_Requirements (
    req_id INT AUTO_INCREMENT PRIMARY KEY,
    dept_id VARCHAR(20),
    entry_year INT,
    total_target INT NOT NULL,
    major_target INT NOT NULL,
    general_target INT NOT NULL,
    FOREIGN KEY (dept_id) REFERENCES Departments(dept_id)
);

-- 7. 교양 상세 기준 테이블
CREATE TABLE IF NOT EXISTS Category_Rules (
    cat_id INT AUTO_INCREMENT PRIMARY KEY,
    req_id INT,
    category_name VARCHAR(50),
    min_credit INT,
    FOREIGN KEY (req_id) REFERENCES Grad_Requirements(req_id)
);

-- 8. 필수 과목 매핑 테이블
CREATE TABLE IF NOT EXISTS Requirement_Courses (
    req_id INT,
    course_id VARCHAR(20),
    PRIMARY KEY (req_id, course_id),
    FOREIGN KEY (req_id) REFERENCES Grad_Requirements(req_id),
    FOREIGN KEY (course_id) REFERENCES Courses(course_id)
);

-- ==========================================
-- 초기 데이터 (Seed Data) 삽입
-- ==========================================

-- 학과 데이터 추가
INSERT INTO Departments (dept_id, name) 
VALUES ('DP_SE', '소프트웨어공학과');

-- 과목 데이터 추가 (서일대 소프트웨어공학과 교과과정)
INSERT INTO Courses (course_id, title, credit, type, category) VALUES 
-- 1학년 과정
('SE101', 'IT기술이해', 3, '전공필수', '전공'),
('SE102', 'C프로그래밍', 3, '전공필수', '전공'),
('SE103', '컴퓨터 시스템 구성', 3, '전공선택', '전공'),
('SE104', '객체지향프로그래밍 (Java)', 3, '전공필수', '전공'),
('SE105', '운영체제', 3, '전공필수', '전공'),
('SE106', '데이터통신', 3, '전공선택', '전공'),

-- 2학년 과정
('SE201', '데이터베이스', 3, '전공필수', '전공'),
('SE202', '클라우드 컴퓨팅', 3, '전공선택', '전공'),
('SE203', '웹 프로그래밍', 3, '전공필수', '전공'),
('SE204', '시스템 분석 및 설계', 3, '전공필수', '전공'),
('SE205', '모바일 컴퓨팅 (안드로이드)', 3, '전공선택', '전공'),
('SE206', 'IT진로설계', 1, '전공선택', '전공'),

-- 3학년 과정
('SE301', '빅데이터 분석', 3, '전공선택', '전공'),
('SE302', '사물인터넷 (IoT)', 3, '전공선택', '전공'),
('SE303', '컴퓨터 보안', 3, '전공필수', '전공'),
('SE304', '소프트웨어 프로젝트 (캡스톤디자인)', 3, '전공필수', '전공'),
('SE305', '포트폴리오 설계', 2, '전공선택', '전공'),
('SE306', '실무 융합 프로젝트', 3, '전공필수', '전공');

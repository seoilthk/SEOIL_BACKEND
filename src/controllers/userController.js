// src/controllers/userController.js

const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// 테스트 로그인 허용 학번
const ALLOWED_STUDENT_IDS = [
    '202103755',
    '202103706'
];

// =============================================
// 로그인
// POST /api/users/login
// =============================================
exports.login = async (req, res) => {
    const { student_id, password } = req.body || {};

    // 1. 학번 및 비밀번호 입력 확인
    if (!student_id || !password) {
        return res.status(400).json({
            message: '학번과 비밀번호를 입력해주세요.'
        });
    }

    // 학번을 문자열로 통일
    const studentId = String(student_id);

    // 2. 허용된 테스트 학번 확인
    if (!ALLOWED_STUDENT_IDS.includes(studentId)) {
        return res.status(403).json({
            message: '시스템 접근이 허용되지 않은 학번입니다.'
        });
    }

    try {
        // 3. MySQL에서 사용자 조회
        const [rows] = await pool.query(
            'SELECT * FROM Users WHERE student_id = ?',
            [studentId]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                message: '등록되지 않은 학번입니다.'
            });
        }

        const user = rows[0];

        // 4. bcrypt 비밀번호 검증
        const isMatch = await bcrypt.compare(
            String(password),
            user.password_hash
        );

        if (!isMatch) {
            return res.status(401).json({
                message: '비밀번호가 일치하지 않습니다.'
            });
        }

        // 5. JWT 토큰 생성
        const secretKey = process.env.JWT_SECRET;

        if (!secretKey) {
            console.error('JWT_SECRET 환경변수가 설정되지 않았습니다.');
            return res.status(500).json({
                message: '로그인 서버 설정 오류가 발생했습니다.'
            });
        }

        const token = jwt.sign(
            { student_id: String(user.student_id) },
            secretKey,
            { expiresIn: '1h' }
        );

        // 6. 로그인 성공
        return res.status(200).json({
            message: '로그인 성공!',
            token
        });

    } catch (error) {
        console.error('로그인 처리 중 에러:', error);

        return res.status(500).json({
            message: '로그인 서버 내부 오류가 발생했습니다.'
        });
    }
};

// =============================================
// 학적정보 조회
// GET /api/users/me
// =============================================
exports.getMe = async (req, res) => {
    const { student_id } = req.user;

    try {
        const [rows] = await pool.query(
            `SELECT
                u.student_id,
                u.name,
                u.entry_year,
                u.academic_status,
                u.transfer,
                d.dept_name,
                d.course_length
            FROM Users u
            LEFT JOIN Departments d
                ON u.dept_id = d.dept_id
            WHERE u.student_id = ?`,
            [student_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                message: '사용자 정보를 찾을 수 없습니다.'
            });
        }

        const user = rows[0];

        return res.status(200).json({
            student_id: user.student_id,
            name: user.name,
            entry_year: user.entry_year,
            academic_status: user.academic_status || '재학',
            dept_name: user.dept_name,
            course_length: user.course_length,
            transfer: user.transfer || '일반입학'
        });

    } catch (error) {
        console.error('사용자 정보 조회 에러:', error);

        return res.status(500).json({
            message: '사용자 정보 조회 중 오류가 발생했습니다.'
        });
    }
};

// =============================================
// 성적 및 이수 과목 조회
// GET /api/users/grades
// =============================================
exports.getGrades = async (req, res) => {
    try {
        const studentId = req.user.student_id;
        
        // 1. 프론트엔드 명세서에 완벽하게 맞춘 컬럼명(Alias) 및 학기(semester) 문자열 조합
        const query = `
            SELECT 
                ug.grade_id,
                ug.course_id AS course_code,
                -- 전공 테이블에 이름이 없으면 교양 테이블에서 이름을 가져옴
                COALESCE(c.course_name, rgc.course_name) AS name,
                
                -- 전공 테이블에 학점이 없으면 교양 테이블에서 학점을 가져옴
                COALESCE(c.credit, rgc.credit) AS credit,
                
                -- DB에 어떤 형태로 들어있든 무조건 프론트가 원하는 2글자로 변환
                CASE 
                    WHEN COALESCE(c.type, rgc.type) IN ('전필', '전공필수') THEN '전필'
                    WHEN COALESCE(c.type, rgc.type) IN ('전선', '전공선택') THEN '전선'
                    WHEN COALESCE(c.type, rgc.type) IN ('교필', '교양필수') THEN '교필'
                ELSE '교선' 
                END AS type,
                
                ug.grade AS score,
                ug.status AS is_pass,
                
                -- 교양 테이블은 학기(year, semester) 정보가 없으므로 예외 처리
                -- 프론트엔드가 조합할 수 있도록 year와 semester를 각각 따로 전달 (교양은 0으로 예외처리)
            COALESCE(s.admission_year + COALESCE(c.year, rgc.year) - 1, 0) AS year,
            COALESCE(c.semester, rgc.semester, 0) AS semester,
            FROM User_Grades ug
            JOIN Students s ON ug.student_id = s.student_id
            
            -- 전공 테이블과 교양 테이블 모두 LEFT JOIN으로 연결
            LEFT JOIN Department_Courses c ON ug.course_id = c.course_code
            LEFT JOIN Recommended_General_Courses rgc ON ug.course_id = rgc.course_code
            
            WHERE ug.student_id = ?
            ORDER BY ug.grade_id ASC
        `;
        
        const [grades] = await pool.query(query, [studentId]);
        
        // 2. 재수강 및 중복 이수 과목 제거 로직 (course_code 기준)
        // - 동일 과목이 여러 학기에 개설(course_id 다름, course_code 같음)되어도 1개만 유지
        // - ORDER BY grade_id ASC 후 덮어쓰므로, 재수강 시 가장 최근 성적이 최종 반영됨
        const courseMap = new Map();
        
        grades.forEach(row => {
            // 이수 완료된 유효한 성적만 필터링
            const isPassed = row.is_pass === '이수완료' || row.is_pass === '1' || row.is_pass === true || row.score !== 'F';
            if (isPassed) {
                // course_code 기준으로 중복 제거 (같은 과목을 다른 학기에 이수해도 1개만 유지)
                courseMap.set(row.course_code, row);
            }
        });
        
        // 중복 제거된 최종 배열
        const uniqueGrades = Array.from(courseMap.values());

        // 3. 프론트엔드가 요구하는 { "grades": 배열 } 형태로 반환
        return res.status(200).json({ 
            success: true, 
            grades: uniqueGrades 
        });

    } catch (error) {
        console.error('성적 목록 조회 에러:', error);
        return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};

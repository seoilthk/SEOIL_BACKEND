// src/controllers/analysisController.js
const pool = require('../config/db');

exports.getGraduationAnalysis = async (req, res) => {
    // authMiddleware를 거쳐서 들어오므로 req.user에서 student_id를 꺼낼 수 있습니다.
    const { student_id } = req.user;

    try {
        // 1. 해당 학생의 입학연도, 학과, 그리고 학과별 졸업 기준 학점 조회 (JOIN 활용)
        const userQuery = `
            SELECT u.entry_year, u.dept_id, r.total_target, r.major_target, r.general_target
            FROM Users u
            JOIN Grad_Requirements r ON u.dept_id = r.dept_id AND u.entry_year = r.entry_year
            WHERE u.student_id = ?
        `;
        const [userRows] = await pool.query(userQuery, [student_id]);
        
        if (userRows.length === 0) {
            return res.status(404).json({ error: '해당 학생의 졸업 요건 정의를 찾을 수 없습니다.' });
        }
        const reqs = userRows[0]; // 졸업 기준 데이터

        // 2. 학생의 전체 성적 및 이수 과목 정보 조회 (JOIN 활용)
        const gradesQuery = `
            SELECT ug.score, ug.is_pass, c.credit, c.type
            FROM User_Grades ug
            JOIN Courses c ON ug.course_id = c.course_id
            WHERE ug.student_id = ?
        `;
        const [gradeRows] = await pool.query(gradesQuery, [student_id]);

        // 3. 학점 및 평점 계산 알고리즘 시작
        let totalEarnedCredits = 0;
        let majorEarnedCredits = 0;
        let generalEarnedCredits = 0;

        let totalGradePoints = 0; // (학점 * 평점)의 총합
        let totalAppliedCreditsForGPA = 0; // P/F 과목을 제외한 평점 계산용 총 학점

        // 성적별 평점 변환 매핑 테이블
        const scoreValues = {
            'A+': 4.5, 'A0': 4.0,
            'B+': 3.5, 'B0': 3.0,
            'C+': 2.5, 'C0': 2.0,
            'D+': 1.5, 'D0': 1.0,
            'F': 0.0
        };

        gradeRows.forEach(row => {
            // F학점이거나 Pass 여부가 false인 경우 이수 학점에서 제외 (예외 처리 완료)
            if (row.score === 'F' || !row.is_pass) return;

            const credit = parseInt(row.credit);
            totalEarnedCredits += credit;

            // 전공 / 교양 및 기타 이수 학점 분류 분기문
            if (row.type === '전필' || row.type === '전선') {
                majorEarnedCredits += credit;
            } else {
                generalEarnedCredits += credit; // 교양 및 일반선택 합산
            }

            // P(Pass) 과목은 평점(GPA) 계산에서 제외하는 예외 처리
            if (row.score !== 'P') {
                const gradePoint = scoreValues[row.score] || 0.0;
                totalGradePoints += (credit * gradePoint);
                totalAppliedCreditsForGPA += credit;
            }
        });

        // 평점 평균(GPA) 산출 (0 나누기 방지 예외 처리)
        const gpa = totalAppliedCreditsForGPA > 0 
            ? (totalGradePoints / totalAppliedCreditsForGPA).toFixed(2) 
            : "0.00";

        // 4. 졸업 요건 대비 부족한 학점 계산 (음수가 나오면 0으로 처리)
        const remainingTotal = Math.max(0, reqs.total_target - totalEarnedCredits);
        const remainingMajor = Math.max(0, reqs.major_target - majorEarnedCredits);
        const remainingGeneral = Math.max(0, reqs.general_target - generalEarnedCredits);

        // 5. 프론트엔드가 바로 사용할 수 있게 가공해서 응답 보냄 (JSON)
        res.json({
            student_id,
            gpa, // 평점 평균
            summary: {
                total_earned: totalEarnedCredits,
                total_target: reqs.total_target,
                remaining_total: remainingTotal
            },
            details: {
                major_earned: majorEarnedCredits,
                major_target: reqs.major_target,
                remaining_major: remainingMajor,
                general_earned: generalEarnedCredits,
                general_target: reqs.general_target,
                remaining_general: remainingGeneral
            }
        });

    } catch (error) {
        console.error('졸업 요건 분석 중 서버 오류 발생:', error);
        res.status(500).json({ error: '학점 분석에 실패했습니다.' });
    }
};
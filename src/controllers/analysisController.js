// controllers/analysisController.js

const db = require('../config/db.js'); // DB 연결 설정

exports.getGraduationAnalysis = async (req, res) => {
    try {
        const studentId = req.params.studentId; // 예: '202103755' (2021학번)

        // 학생의 이수 성적 및 과목 정보 조회 쿼리
        const query = `
            SELECT ug.grade, ug.status, c.credit, c.type, c.course_name, c.semester, c.year 
            FROM User_Grades ug 
            JOIN Department_Courses c ON ug.course_id = c.course_id 
            WHERE ug.student_id = ?
        `;

        const [rows] = await db.query(query, [studentId]);

        let totalCredits = 0;          // 총 취득 학점
        let generalCredits = 0;        // 교양 총학점 (8 ~ 14학점 기준)
        let generalRequiredCredits = 0; // 교양필수 학점 (최소 2학점 이상)
        let majorCredits = 0;          // 전공 총학점

        let grade1Credits = 0;         // 1학년 이수 학점
        let grade2Credits = 0;         // 2학년 이수 학점 (누적)
        let grade3Credits = 0;         // 3학년 이수 학점 (누적)

        rows.forEach(row => {
            if (row.status === '이수완료') {
                const credit = Number(row.credit) || 0;
                totalCredits += credit;

                // 학년별 이수 학점 누적 집계
                if (row.year === 1) grade1Credits += credit;
                if (row.year <= 2) grade2Credits += credit;
                if (row.year <= 3) grade3Credits += credit;

                // 과목 타입별 집계 (교양 / 전공)
                if (row.type.includes('교')) {
                    generalCredits += credit;
                    if (row.type === '교필') {
                        generalRequiredCredits += credit;
                    }
                } else if (row.type.includes('전')) {
                    majorCredits += credit;
                }
            }
        });

        // 서일대학교 3년제(2019학번 이후 / 2021학번) 공식 졸업 및 수료 요건 기준 정의
        const graduationCriteria = {
            minTotalCredits: 110,         // 총 졸업 학점: 110학점 이상[cite: 1]
            minGeneralCredits: 8,         // 교양 최소 학점: 8학점[cite: 2]
            maxGeneralCredits: 14,        // 교양 최대 학점: 14학점 (초과분 미인정)[cite: 2]
            minGeneralRequired: 2,        // 교양필수 최소 학점: 2학점 (1과목)[cite: 3]
            grade1Requirement: 36,        // 1학년 수료: 36학점 이상[cite: 4]
            grade2Requirement: 75,        // 2학년 수료: 75학점 이상[cite: 4]
            grade3Requirement: 110        // 3학년 수료: 110학점 이상[cite: 4]
        };

        // 요건 충족 여부 판정 로직
        const isTotalSatisfied = totalCredits >= graduationCriteria.minTotalCredits;
        const isGeneralSatisfied = generalCredits >= graduationCriteria.minGeneralCredits && generalCredits <= graduationCriteria.maxGeneralCredits;
        const isGeneralRequiredSatisfied = generalRequiredCredits >= graduationCriteria.minGeneralRequired;

        const isGrade1Satisfied = grade1Credits >= graduationCriteria.grade1Requirement;
        const isGrade2Satisfied = grade2Credits >= graduationCriteria.grade2Requirement;
        const isGrade3Satisfied = grade3Credits >= graduationCriteria.grade3Requirement;

        const isGraduated = isTotalSatisfied && isGeneralSatisfied && isGeneralRequiredSatisfied && isGrade3Satisfied;

        return res.status(200).json({
            success: true,
            studentId,
            summary: {
                totalCredits,
                generalCredits,
                generalRequiredCredits,
                majorCredits,
                grade1Credits,
                grade2Credits,
                grade3Credits
            },
            criteria: graduationCriteria,
            results: {
                isTotalSatisfied,
                isGeneralSatisfied,
                isGeneralRequiredSatisfied,
                isGrade1Satisfied,
                isGrade2Satisfied,
                isGrade3Satisfied,
                isGraduated
            },
            courses: rows
        });

    } catch (error) {
        console.error('졸업요건 분석 에러:', error);
        return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};
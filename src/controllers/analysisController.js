// controllers/analysisController.js
const db = require('../config/db.js');

exports.getGraduationAnalysis = async (req, res) => {
    try {
        const studentId = req.user && req.user.student_id;

        if (!studentId) {
            return res.status(401).json({ success: false, message: '인증 정보가 유효하지 않습니다.' });
        }

        // 1. 학생 정보 및 학과별 졸업 기준 조회
        const studentQuery = `
            SELECT s.student_id, s.department_id, s.admission_year, d.department_name,
                   d.min_total_credits, d.min_major_credits, d.min_general_credits, 
                   d.min_general_required, d.max_general_credits
            FROM Students s
            JOIN Departments d ON s.department_id = d.department_id
            WHERE s.student_id = ?
        `;
        
        const [studentRows] = await db.query(studentQuery, [studentId]);

        const defaultCriteria = {
            minTotalCredits: 110,         // 총 졸업 학점
            minMajorCredits: 60,          // 전공 최소 학점
            minGeneralCredits: 8,         // 교양 최소 학점
            maxGeneralCredits: 14,        // 교양 최대 학점
            minGeneralRequired: 2         // 교양필수 최소 학점
        };

        const criteria = studentRows.length > 0 ? {
            minTotalCredits: studentRows[0].min_total_credits || defaultCriteria.minTotalCredits,
            minMajorCredits: studentRows[0].min_major_credits || defaultCriteria.minMajorCredits,
            minGeneralCredits: studentRows[0].min_general_credits || defaultCriteria.minGeneralCredits,
            maxGeneralCredits: studentRows[0].max_general_credits || defaultCriteria.maxGeneralCredits,
            minGeneralRequired: studentRows[0].min_general_required || defaultCriteria.minGeneralRequired
        } : defaultCriteria;

        // 2. 학생의 이수 성적 및 과목 정보 조회
        const gradeQuery = `
            SELECT ug.grade_id, ug.grade, ug.status, c.course_id, c.course_code, c.credit, c.type, c.course_name, c.semester, c.year 
            FROM User_Grades ug 
            JOIN Department_Courses c ON ug.course_id = c.course_id 
            WHERE ug.student_id = ?
        `;

        const [rows] = await db.query(gradeQuery, [studentId]);

        // 3. 재수강 및 중복 이수 처리 (동일 과목 코드나 과목명이 있는 경우 가장 최근 학기 또는 이수한 데이터만 인정)
        const courseMap = new Map();
        
        rows.forEach(row => {
            const isPassed = row.status === '이수완료' || row.status === '1' || row.status === true || row.grade !== 'F';
            if (!isPassed) return; // 미이수/낙제 과목 제외

            const courseKey = row.course_code || row.course_name; // 과목 코드 기준으로 중복 관리
            
            // 동일 과목이 여러 번 등록된 경우, 최신 학기 데이터나 유효한 성적을 우선하도록 처리 가능
            if (!courseMap.has(courseKey)) {
                courseMap.set(courseKey, row);
            } else {
                // 필요시 학기 비교 로직 추가 가능 (현재는 먼저 들어온 유효 과목 유지 또는 덮어쓰기)
                courseMap.set(courseKey, row);
            }
        });

        let totalCredits = 0;          
        let generalCredits = 0;        
        let generalRequiredCredits = 0; 
        let generalRequiredCount = 0;   
        let majorCredits = 0;          

        const uniqueCourses = Array.from(courseMap.values());

        uniqueCourses.forEach(row => {
            const credit = Number(row.credit) || 0;
            totalCredits += credit;

            // 명확한 타입 비교 조건 적용 (전선 과목 누락 방지)
            if (row.type === '전필' || row.type === '전선' || row.type.includes('전공')) {
                majorCredits += credit;
            } else if (row.type === '교필' || row.type === '교선' || row.type.includes('교양')) {
                generalCredits += credit;
                if (row.type === '교필') {
                    generalRequiredCredits += credit;
                    generalRequiredCount += 1;
                }
            }
        });

        // 4. 부족한 학점 상세 계산
        const deficitTotal = Math.max(0, criteria.minTotalCredits - totalCredits);
        const deficitMajor = Math.max(0, criteria.minMajorCredits - majorCredits);
        const deficitGeneral = Math.max(0, criteria.minGeneralCredits - generalCredits);
        const deficitGeneralRequired = Math.max(0, criteria.minGeneralRequired - generalRequiredCredits);

        // 5. 졸업 요건 충족 여부 판정
        const isTotalSatisfied = totalCredits >= criteria.minTotalCredits;
        const isMajorSatisfied = majorCredits >= criteria.minMajorCredits;
        const isGeneralSatisfied = generalCredits >= criteria.minGeneralCredits && generalCredits <= criteria.maxGeneralCredits;
        const isGeneralRequiredSatisfied = generalRequiredCredits >= criteria.minGeneralRequired;

        const isGraduated = isTotalSatisfied && isMajorSatisfied && isGeneralSatisfied && isGeneralRequiredSatisfied;

        return res.status(200).json({
            success: true,
            studentId,
            summary: {
                totalCredits,
                majorCredits,
                generalCredits,
                generalRequiredCredits,
                generalRequiredCount
            },
            deficits: {
                deficitTotal,
                deficitMajor,
                deficitGeneral,
                deficitGeneralRequired
            },
            criteria,
            results: {
                isTotalSatisfied,
                isMajorSatisfied,
                isGeneralSatisfied,
                isGeneralRequiredSatisfied,
                isGraduated
            },
            grades: uniqueCourses // 중복 제거된 이수 과목 목록 반환
        });

    } catch (error) {
        console.error('졸업요건 분석 에러:', error);
        return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};
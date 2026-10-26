const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../config/db'); // MySQL DB 연결 모듈 경로에 맞게 수정

const formatToDateString = (year, dateStr) => {
  if (!dateStr) return null;
  const cleanStr = dateStr.replace(/\s+/g, '').replace(/^\./, '').replace(/\.$/, '');
  const [month, day] = cleanStr.split('.');
  if (month && day) {
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
};

// =============================================
// 다가오는 학사일정 조회 API (/api/academic-schedules/upcoming)
// =============================================
exports.getUpcomingSchedule = async (req, res) => {
  try {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    
    // 1. 학교 서버에서 HTML 데이터 파싱 및 MySQL 저장 (동기화)
    // 실제 서비스에서는 이 부분을 주기적인 배치(Cron) 작업으로 분리하는 것이 이상적입니다.
    const url = 'https://www.seoil.ac.kr/schdulmanage/seoil/7/monthSchdul.do';
    const response = await axios.post(url, `year=${currentYear}&month=${currentMonth}`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const $ = cheerio.load(response.data);
    
    // 파싱한 데이터를 DB에 저장 (중복은 무시됨)
    $('.list > ul > li').each(async (index, element) => {
      const li = $(element);
      const dateRawText = li.find('strong').text().trim();
      
      const clonedLi = li.clone();
      clonedLi.find('strong').remove();
      clonedLi.find('br').replaceWith(' ');
      const title = clonedLi.text().replace(/\s+/g, ' ').trim();

      if (dateRawText && title) {
        const [startRaw, endRaw] = dateRawText.split('~');
        const startDate = formatToDateString(currentYear, startRaw);
        const endDate = formatToDateString(currentYear, endRaw) || startDate;

        // DB에 저장 (UNIQUE 제약조건으로 인해 이미 존재하는 일정은 무시됨)
        const insertQuery = `
          INSERT IGNORE INTO academic_schedule (title, start_date, end_date) 
          VALUES (?, ?, ?)
        `;
        await db.execute(insertQuery, [title, startDate, endDate]);
      }
    });

    // 2. DB에서 오늘 날짜 이후의 가장 가까운 학사일정 1개 조회[cite: 6, 7]
    const selectQuery = `
      SELECT title, start_date, end_date, 
             DATEDIFF(start_date, CURDATE()) AS daysLeft
      FROM academic_schedule
      WHERE end_date >= CURDATE()
      ORDER BY start_date ASC, end_date ASC
      LIMIT 1
    `;
    
    const [rows] = await db.execute(selectQuery);

    if (rows.length === 0) {
      return res.status(200).json({
        success: true,
        message: '예정된 학사일정이 없습니다.',
        data: null
      });
    }

    // 3. React Native 프론트엔드로 반환
    return res.status(200).json({
      success: true,
      data: {
        title: rows[0].title,
        startDate: rows[0].start_date.toISOString().split('T')[0],
        endDate: rows[0].end_date.toISOString().split('T')[0],
        daysLeft: rows[0].daysLeft <= 0 ? 0 : rows[0].daysLeft // 당일 진행중인 일정도 D-0으로 처리
      }
    });

  } catch (error) {
    console.error('학사일정 API 오류:', error);
    return res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
};
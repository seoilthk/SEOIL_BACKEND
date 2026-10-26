const axios = require('axios');
const cheerio = require('cheerio');

// 날짜 문자열 변환 헬퍼 함수 (예: "10 .20" -> "2026-10-20")
const formatToDateString = (year, dateStr) => {
  if (!dateStr) return null;
  // 공백 제거 및 앞뒤 마침표 제거
  const cleanStr = dateStr.replace(/\s+/g, '').replace(/^\./, '').replace(/\.$/, '');
  const [month, day] = cleanStr.split('.');
  
  if (month && day) {
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
};

// =============================================
// 다가오는 학사일정 조회 API
// GET /api/academic-schedules/upcoming
// =============================================
exports.getUpcomingSchedule = async (req, res) => {
  try {
    // 1. 요청할 연도와 월 설정 (기본값은 현재 날짜 기준, 쿼리로 덮어쓰기 가능)
    const today = new Date();
    // 현재 기준: 2026년 10월 26일
    const targetYear = req.query.year || today.getFullYear(); 
    const targetMonth = req.query.month || (today.getMonth() + 1);

    // 2. 서일대학교 학사일정 서버로 POST 요청
    const url = 'https://www.seoil.ac.kr/schdulmanage/seoil/7/monthSchdul.do';
    
    // axios POST 요청 시 Payload 형식을 application/x-www-form-urlencoded로 맞춤
    const response = await axios.post(url, `year=${targetYear}&month=${targetMonth}`, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // 3. Cheerio를 이용한 HTML 파싱
    const $ = cheerio.load(response.data);
    const schedules = [];

    // .list > ul > li 구조 순회
    $('.list > ul > li').each((index, element) => {
      const li = $(element);
      
      // <strong> 태그 안의 날짜 텍스트 추출 (예: "10 .20 ~ .10 .26")
      const dateRawText = li.find('strong').text().trim();
      
      // <li> 안에서 <strong> 태그를 제외한 텍스트만 추출하여 일정명으로 사용
      const clonedLi = li.clone();
      clonedLi.find('strong').remove();
      clonedLi.find('br').replaceWith(' '); // <br> 태그 공백 처리
      const title = clonedLi.text().replace(/\s+/g, ' ').trim(); // "2학기 중간고사 기간(8주차)"

      if (!dateRawText || !title) return;

      // "~" 기준으로 시작일과 종료일 분리
      const [startRaw, endRaw] = dateRawText.split('~');
      
      const startDate = formatToDateString(targetYear, startRaw);
      const endDate = formatToDateString(targetYear, endRaw) || startDate; // 종료일이 없으면 당일 일정으로 처리

      // D-Day 계산
      const startDateTime = new Date(startDate).getTime();
      const todayTime = new Date(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`).getTime();
      
      const diffTime = startDateTime - todayTime;
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      schedules.push({
        title,
        startDate,
        endDate,
        daysLeft
      });
    });

    // 4. 오늘 날짜 이후의 다가오는 일정만 필터링 (daysLeft >= 0)
    const upcomingSchedules = schedules.filter(s => s.daysLeft >= 0);

    // 5. 날짜 임박순으로 정렬
    upcomingSchedules.sort((a, b) => a.daysLeft - b.daysLeft);

    // 6. 가장 가까운 일정 1개 혹은 전체 리스트 반환
    if (upcomingSchedules.length === 0) {
      return res.status(200).json({
        success: true,
        message: '예정된 학사일정이 없습니다.',
        data: null
      });
    }

    // 홈 화면에서 사용할 단일 데이터 반환 (가장 가까운 일정)
    return res.status(200).json({
      success: true,
      data: upcomingSchedules[0] 
    });

  } catch (error) {
    console.error('학사일정 파싱 오류:', error);
    return res.status(500).json({
      success: false,
      message: '학사일정 데이터를 불러오는 중 서버 오류가 발생했습니다.'
    });
  }
};
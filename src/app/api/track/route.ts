import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

// 택배사 코드 맵핑
const carrierMapping: { [key: string]: { code: string, apiType: string } } = {
  'cjkoreaexpress': { code: '04', apiType: 'cj' },   // CJ대한통운
  'koreapost': { code: '01', apiType: 'epost' },     // 우체국택배
  'lotte': { code: '08', apiType: 'lotte' },         // 롯데택배
  'hanjin': { code: '05', apiType: 'hanjin' },       // 한진택배
  'logen': { code: '06', apiType: 'logen' },         // 로젠택배
  'coupang': { code: '94', apiType: 'coupang' },     // 쿠팡
  'kdexp': { code: '23', apiType: 'kdexp' },         // 경동택배
  'chunil': { code: '17', apiType: 'hanips' },       // 천일택배
  'cvsnet': { code: '24', apiType: 'cvsnet' },       // GS편의점택배
  'cupost': { code: '46', apiType: 'cupost' },       // CU편의점택배
  'daesin': { code: '22', apiType: 'daesin' },       // 대신택배
  'homepick': { code: '54', apiType: 'homepick' },   // 홈픽
  'handex': { code: '18', apiType: 'handex' },       // 한덱스
  'honam': { code: '32', apiType: 'honam' },         // 호남택배
  'ilyanglogis': { code: '11', apiType: 'ilyang' },  // 일양로지스
  'kyungjin': { code: '30', apiType: 'kyungjin' },   // 경진택배
  'nhlogis': { code: '12', apiType: 'nhlogis' },     // 농협물류
  'sebang': { code: '29', apiType: 'sebang' },       // 세방택배
  'warpex': { code: '37', apiType: 'warpex' },       // 워펙스
  'yellowcap': { code: '25', apiType: 'yellowcap' }  // 옐로우캡
};

// 택배사 목록 (page.tsx와 동일하게 유지)
const carriers = [
  // 대형 택배사
  { id: 'cjkoreaexpress', name: 'CJ대한통운' },
  { id: 'koreapost', name: '우체국택배' },
  { id: 'lotte', name: '롯데택배' },
  { id: 'hanjin', name: '한진택배' },
  { id: 'logen', name: '로젠택배' },
  { id: 'coupang', name: '쿠팡' },
  
  // 중소형 택배사
  { id: 'kdexp', name: '경동택배' },
  { id: 'chunil', name: '천일택배' },
  { id: 'cvsnet', name: 'GS편의점택배' },
  { id: 'cupost', name: 'CU편의점택배' },
  
  // 특수 택배사
  { id: 'daesin', name: '대신택배' },
  { id: 'homepick', name: '홈픽' },
  { id: 'handex', name: '한덱스' },
  { id: 'honam', name: '호남택배' },
  { id: 'ilyanglogis', name: '일양로지스' },
  { id: 'kyungjin', name: '경진택배' },
  { id: 'nhlogis', name: '농협물류' },
  { id: 'sebang', name: '세방택배' },
  { id: 'warpex', name: '워펙스' },
  { id: 'yellowcap', name: '옐로우캡' }
];

// 상태 코드별 한글 설명
const statusMapping: { [key: string]: string } = {
  'information_received': '택배 접수됨',
  'at_pickup': '집화처리',
  'in_transit': '배송중',
  'out_for_delivery': '배송출발',
  'delivered': '배송완료',
  'unknown': '알 수 없음',
  'delivery_failed': '배송 실패',
  'on_hold': '보류 중',
  // CJ 대한통운 상태 코드
  '11': '상품인수',
  '12': '상품이동중',
  '21': '배송지도착',
  '31': '배송중',
  '32': '배송완료',
  '33': '미배달',
  // 우체국택배 상태 코드
  'S': '접수',
  'C': '집중국 도착',
  'P1': '배달준비',
  'D': '배달완료'
};

// 기본 배송 예상 시간 (택배사별로 다를 수 있음)
const estimatedDeliveryTime = {
  'cjkoreaexpress': 24, // 시간
  'koreapost': 48,
  'lotte': 24,
  'hanjin': 24,
  'default': 48
};

// CJ대한통운 직접 HTML 파싱으로 배송 정보 가져오기
async function fetchCJTracking(trackingNumber: string) {
  try {
    // 네이버 스타일 API 사용 - 스마트 택배 API로 변경
    const url = `https://apis.tracker.delivery/carriers/kr.cjlogistics/tracks/${trackingNumber}`;
    
    // 헤더 추가 - 네이버와 유사한 헤더 사용
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      'Connection': 'keep-alive',
      'Referer': 'https://tracker.delivery/',
      'Origin': 'https://tracker.delivery'
    };
    
    // 오픈 API 사용
    const response = await axios.get(url, { headers });
    
    if (response.status === 200) {
      const data = response.data;
      
      // 배송 상태 정보 추출
      const progresses: any[] = [];
      let currentStatus = { id: 'in_transit', text: '배송중' };
      
      // 송장 정보
      const senderName = data.from?.name || '';
      const receiverName = data.to?.name || '';
      
      // 배송 상태가 없는 경우
      if (!data.progresses || data.progresses.length === 0) {
        throw new Error('입력하신 운송장 번호의 배송 정보가 없습니다. 운송장 번호를 다시 확인하시거나 택배사를 올바르게 선택했는지 확인해 주세요.');
      }
      
      // 배송 상태 추출
      data.progresses.forEach((progress: any) => {
        const timeStr = progress.time;
        const location = progress.location?.name || '';
        const description = progress.description || '';
        const status = progress.status?.text || '배송중';
        
        let dateTime = new Date(timeStr).getTime();
        
        // 상태 코드 매핑
        let statusCode = 40; // 기본값: 배송중
        let statusText = '배송중';
        
        if (description.includes('집화완료')) {
          statusCode = 30;
          statusText = '집화완료';
        } else if (description.includes('배달완료')) {
          statusCode = 70;
          statusText = '배달완료';
          currentStatus = { id: 'delivered', text: '배달완료' };
        } else if (description.includes('배달출발')) {
          statusCode = 65;
          statusText = '배달출발';
        }
        
        progresses.push({
          time: dateTime,
          dateString: new Date(timeStr).toLocaleString('ko-KR'),
          location: { name: location },
          status: { id: statusCode, text: statusText },
          description: description
        });
      });
      
      // 배송 현황이 없는 경우 다시 시도
      if (progresses.length === 0) {
        throw new Error('배송 정보가 없습니다. 운송장 번호를 다시 확인해주세요.');
      }
      
      // 가장 최신 이벤트가 첫 번째 요소가 되도록 정렬
      progresses.reverse();
      
      // 현재 위치 추가
      const currentLocation = progresses.length > 0 ? progresses[0].location?.name : null;
      
      return {
        carrier: {
          id: 'cjkoreaexpress',
          name: 'CJ대한통운'
        },
        progresses: progresses,
        senderName: senderName,
        receiverName: receiverName,
        status: currentStatus,
        estimatedDelivery: null,
        currentLocation: currentLocation
      };
    }
    
    // API 실패시 기존 방식으로 폴백
    return fallbackCJTracking(trackingNumber);
  } catch (error) {
    console.error('CJ 택배 조회 오류 (신규 API):', error);
    
    // 폴백 방식 시도 - 기존 방식
    return fallbackCJTracking(trackingNumber);
  }
}

// 기존 CJ 택배 조회 방식을 폴백으로 유지
async function fallbackCJTracking(trackingNumber: string) {
  try {
    // CJ대한통운 배송조회 페이지 요청 - HTTPS 사용 및 모바일 페이지로 변경
    const url = `https://www.cjlogistics.com/ko/tool/parcel/tracking`;
    
    // 헤더 추가
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      'Connection': 'keep-alive',
      'Referer': 'https://www.cjlogistics.com/'
    };
    
    // POST 요청으로 변경하고 운송장 번호 데이터 전송
    const response = await axios.post(url, 
      new URLSearchParams({
        'paramInvcNo': trackingNumber
      }).toString(), 
      { 
        headers: {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    if (response.status === 200) {
      const html = response.data;
      const $ = cheerio.load(html);
      
      // 배송 상태 정보 추출
      const progresses: any[] = [];
      
      // 송장 정보
      const senderName = $('.sender .name').text().trim() || '';
      const receiverName = $('.receiver .name').text().trim() || '';
      
      // 오류 메시지 확인 - 배송 정보 없음 확인
      const errorText = $('div.grid-error-wrap').text().trim();
      if (errorText && (errorText.includes('조회된 결과가 없습니다') || errorText.includes('운송장 정보를 찾을 수 없습니다'))) {
        throw new Error('입력하신 운송장 번호의 배송 정보가 없습니다. 운송장 번호를 다시 확인하시거나 택배사를 올바르게 선택했는지 확인해 주세요.');
      }
      
      // 배송 상태 추출
      const statusTable = $('.parcel-list tbody tr');
      let currentStatus = { id: 'in_transit', text: '배송중' };
      
      statusTable.each((i, elem) => {
        const timeStr = $(elem).find('td:nth-child(1)').text().trim();
        const location = $(elem).find('td:nth-child(2)').text().trim();
        const status = $(elem).find('td:nth-child(3)').text().trim();
        
        // 날짜와 시간 파싱
        if (timeStr) {
          let dateTime;
          try {
            // 형식: YYYY.MM.DD HH:MM
            const parts = timeStr.split(' ');
            const dateParts = parts[0].split('.');
            const timeParts = parts[1].split(':');
            
            const year = parseInt(dateParts[0]);
            const month = parseInt(dateParts[1]) - 1; // 월은 0부터 시작
            const day = parseInt(dateParts[2]);
            const hour = parseInt(timeParts[0]);
            const minute = parseInt(timeParts[1]);
            
            dateTime = new Date(year, month, day, hour, minute, 0).getTime();
          } catch (err) {
            dateTime = new Date().getTime();
          }
          
          // 상태 코드 매핑
          let statusCode = 40; // 기본값: 배송중
          let statusCodeText = '배송중';
          
          if (status.includes('집화완료')) {
            statusCode = 30;
            statusCodeText = '집화완료';
          } else if (status.includes('배달완료')) {
            statusCode = 70;
            statusCodeText = '배달완료';
            currentStatus = { id: 'delivered', text: '배달완료' };
          } else if (status.includes('배달출발')) {
            statusCode = 65;
            statusCodeText = '배달출발';
          }
          
          progresses.push({
            time: dateTime,
            dateString: timeStr,
            location: { name: location },
            status: { id: statusCode, text: statusCodeText },
            description: status
          });
        }
      });
      
      // 배송 상태 정보가 없는 경우 대체 방법 시도
      if (progresses.length === 0) {
        // 페이지 내에서 배송 상태 텍스트 검색
        const statusText = $('.status-text').text().trim();
        if (statusText) {
          progresses.push({
            time: new Date().getTime(),
            dateString: new Date().toLocaleString(),
            location: { name: '정보 없음' },
            status: { id: 'in_transit', text: '배송중' },
            description: statusText
          });
        } else {
          // 여전히 정보가 없는 경우
          throw new Error('입력하신 운송장 번호에 대한 배송 정보가 없습니다. 운송장 번호가 정확한지 확인하세요.');
        }
      }
      
      // 가장 최신 이벤트가 첫 번째 요소가 되도록 정렬
      progresses.reverse();
      
      // 현재 위치 추가
      const currentLocation = progresses.length > 0 ? progresses[0].location?.name : null;
      
      return {
        carrier: {
          id: 'cjkoreaexpress',
          name: 'CJ대한통운'
        },
        progresses: progresses,
        senderName: senderName,
        receiverName: receiverName,
        status: currentStatus,
        estimatedDelivery: null,
        currentLocation: currentLocation
      };
    }
    
    throw new Error('배송정보를 찾을 수 없습니다');
  } catch (error) {
    console.error('CJ 택배 조회 오류 (폴백):', error);
    
    // 다른 CJ대한통운 API 시도 (백업 방법)
    try {
      const backupUrl = `https://www.doortodoor.co.kr/parcel/doortodoor.do?fsp_action=PARC_ACT_002&fsp_cmd=retrieveInvNoACT&invc_no=${trackingNumber}`;
      const backupResponse = await axios.get(backupUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        }
      });
      
      if (backupResponse.status === 200) {
        const html = backupResponse.data;
        const $ = cheerio.load(html);
        
        const progresses: any[] = [];
        
        // 백업 페이지에서 배송 상태 추출
        const statusTable = $('table.ptb tbody tr');
        let currentStatus = { id: 'in_transit', text: '배송중' };
        
        statusTable.each((i, elem) => {
          const date = $(elem).find('td:nth-child(1)').text().trim();
          const time = $(elem).find('td:nth-child(2)').text().trim();
          const timeStr = `${date} ${time}`;
          const location = $(elem).find('td:nth-child(3)').text().trim();
          const status = $(elem).find('td:nth-child(4)').text().trim();
          
          if (date && time) {
            let dateTime = new Date().getTime();
            
            try {
              const dateParts = date.split('.');
              const timeParts = time.split(':');
              
              const year = parseInt(dateParts[0]);
              const month = parseInt(dateParts[1]) - 1; 
              const day = parseInt(dateParts[2]);
              const hour = parseInt(timeParts[0]);
              const minute = parseInt(timeParts[1]);
              
              dateTime = new Date(year, month, day, hour, minute, 0).getTime();
            } catch (e) {
              // 날짜 파싱 오류 무시
            }
            
            // 상태 코드 매핑
            let statusCode = 40; // 기본값: 배송중
            let statusCodeText = '배송중';
            
            if (status.includes('집화완료')) {
              statusCode = 30;
              statusCodeText = '집화완료';
            } else if (status.includes('배달완료')) {
              statusCode = 70;
              statusCodeText = '배달완료';
              currentStatus = { id: 'delivered', text: '배달완료' };
            } else if (status.includes('배달출발')) {
              statusCode = 65;
              statusCodeText = '배달출발';
            }
            
            progresses.push({
              time: dateTime,
              dateString: timeStr,
              location: { name: location },
              status: { id: statusCode, text: statusCodeText },
              description: status
            });
          }
        });
        
        // 가장 최신 이벤트가 첫 번째 요소가 되도록 정렬
        progresses.reverse();
        
        // 현재 위치 추가
        const currentLocation = progresses.length > 0 ? progresses[0].location?.name : null;
        
        return {
          carrier: {
            id: 'cjkoreaexpress',
            name: 'CJ대한통운'
          },
          progresses: progresses,
          senderName: '',
          receiverName: '',
          status: currentStatus,
          estimatedDelivery: null,
          currentLocation: currentLocation
        };
      }
    } catch (backupError) {
      console.error('CJ 택배 백업 조회 오류:', backupError);
    }
    
    throw error;
  }
}

// 우체국 택배 HTML 파싱 조회 방식으로 변경
async function fetchEPostTracking(trackingNumber: string) {
  try {
    const url = `https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=${trackingNumber}`;
    const response = await axios.get(url);
    
    if (response.status === 200) {
      const html = response.data;
      const $ = cheerio.load(html);
      
      // 배송 상태 정보 추출
      const progresses: any[] = [];
      
      // 배송 상태 추출
      const statusTable = $('.table_col tbody tr');
      let currentStatus = { id: 'in_transit', text: '배송중' };
      
      statusTable.each((i, elem) => {
        const cols = $(elem).find('td');
        if (cols.length >= 4) {
          const dateTimeStr = $(cols[0]).text().trim();
          const statusText = $(cols[1]).text().trim();
          const location = $(cols[2]).text().trim();
          const description = $(cols[3]).text().trim();
          
          if (dateTimeStr) {
            let dateTime;
            try {
              // 형식: YYYY.MM.DD HH:MM
              const parts = dateTimeStr.split(' ');
              if (parts.length >= 2) {
                const dateParts = parts[0].split('.');
                const timeParts = parts[1].split(':');
                
                const year = parseInt(dateParts[0]);
                const month = parseInt(dateParts[1]) - 1; // 월은 0부터 시작
                const day = parseInt(dateParts[2]);
                const hour = parseInt(timeParts[0]);
                const minute = parseInt(timeParts[1]);
                
                dateTime = new Date(year, month, day, hour, minute, 0).getTime();
              } else {
                dateTime = new Date().getTime();
              }
            } catch (err) {
              dateTime = new Date().getTime();
            }
            
            // 상태 코드 매핑
            let statusCode = 40; // 기본값: 배송중
            let statusCodeText = '배송중';
            
            if (statusText.includes('접수')) {
              statusCode = 20;
              statusCodeText = '접수';
            } else if (statusText.includes('발송')) {
              statusCode = 30;
              statusCodeText = '발송';
            } else if (statusText.includes('배달준비')) {
              statusCode = 60;
              statusCodeText = '배달준비';
            } else if (statusText.includes('배달완료')) {
              statusCode = 70;
              statusCodeText = '배달완료';
              currentStatus = { id: 'delivered', text: '배달완료' };
            }
            
            progresses.push({
              time: dateTime,
              dateString: dateTimeStr,
              location: { name: location },
              status: { id: statusCode, text: statusCodeText },
              description: description || statusText
            });
          }
        }
      });
      
      // 가장 최신 이벤트가 첫 번째 요소가 되도록 정렬
      progresses.reverse();
      
      // 송장 정보
      const senderName = $('.table_col').eq(0).find('tr').eq(1).find('td').eq(0).text().trim() || '';
      const receiverName = $('.table_col').eq(0).find('tr').eq(1).find('td').eq(1).text().trim() || '';
      
      return {
        carrier: {
          id: 'koreapost',
          name: '우체국택배'
        },
        progresses: progresses,
        senderName: senderName,
        receiverName: receiverName,
        status: currentStatus,
        estimatedDelivery: null
      };
    }
    
    throw new Error('배송정보를 찾을 수 없습니다');
  } catch (error) {
    console.error('우체국 택배 조회 오류:', error);
    throw error;
  }
}

// 롯데택배 HTML 파싱 조회 방식으로 변경
async function fetchLotteTracking(trackingNumber: string) {
  try {
    const url = `https://www.lotteglogis.com/mobile/reservation/tracking/linkView?InvNo=${trackingNumber}`;
    const response = await axios.get(url);
    
    if (response.status === 200) {
      const html = response.data;
      const $ = cheerio.load(html);
      
      // 배송 상태 정보 추출
      const progresses: any[] = [];
      
      // 배송 상태 추출
      const statusTable = $('.trackingTable tbody tr');
      let currentStatus = { id: 'in_transit', text: '배송중' };
      
      statusTable.each((i, elem) => {
        const dateTimeStr = $(elem).find('td.date').text().trim();
        const statusText = $(elem).find('td.stat').text().trim();
        const location = $(elem).find('td.from').text().trim();
        
        if (dateTimeStr) {
          let dateTime;
          try {
            // 형식: YYYY-MM-DD HH:MM
            const parts = dateTimeStr.split(' ');
            if (parts.length >= 2) {
              const dateParts = parts[0].split('-');
              const timeParts = parts[1].split(':');
              
              const year = parseInt(dateParts[0]);
              const month = parseInt(dateParts[1]) - 1; // 월은 0부터 시작
              const day = parseInt(dateParts[2]);
              const hour = parseInt(timeParts[0]);
              const minute = parseInt(timeParts[1]);
              
              dateTime = new Date(year, month, day, hour, minute, 0).getTime();
            } else {
              dateTime = new Date().getTime();
            }
          } catch (err) {
            dateTime = new Date().getTime();
          }
          
          // 상태 코드 매핑
          let statusCode = 40; // 기본값: 배송중
          let statusCodeText = '배송중';
          
          if (statusText.includes('집하') || statusText.includes('접수')) {
            statusCode = 30;
            statusCodeText = '집하완료';
          } else if (statusText.includes('배달완료')) {
            statusCode = 70;
            statusCodeText = '배달완료';
            currentStatus = { id: 'delivered', text: '배달완료' };
          } else if (statusText.includes('배달출발')) {
            statusCode = 65;
            statusCodeText = '배달출발';
          }
          
          progresses.push({
            time: dateTime,
            dateString: dateTimeStr,
            location: { name: location },
            status: { id: statusCode, text: statusCodeText },
            description: statusText
          });
        }
      });
      
      // 가장 최신 이벤트가 첫 번째 요소가 되도록 정렬
      progresses.reverse();
      
      // 송장 정보 추출
      const senderName = $('.addrBox .from dd').text().trim() || '';
      const receiverName = $('.addrBox .to dd').text().trim() || '';
      
      return {
        carrier: {
          id: 'lotte',
          name: '롯데택배'
        },
        progresses: progresses,
        senderName: senderName,
        receiverName: receiverName,
        status: currentStatus,
        estimatedDelivery: null
      };
    }
    
    throw new Error('배송정보를 찾을 수 없습니다');
  } catch (error) {
    console.error('롯데 택배 조회 오류:', error);
    throw error;
  }
}

// 한진택배 HTML 파싱 조회 방식 추가
async function fetchHanjinTracking(trackingNumber: string) {
  try {
    const url = `https://www.hanjin.co.kr/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnumText2=${trackingNumber}`;
    const response = await axios.get(url);
    
    if (response.status === 200) {
      const html = response.data;
      const $ = cheerio.load(html);
      
      // 배송 상태 정보 추출
      const progresses: any[] = [];
      
      // 배송 상태 추출
      const statusTable = $('.process-box .result-points');
      let currentStatus = { id: 'in_transit', text: '배송중' };
      
      statusTable.each((i, elem) => {
        const dateTimeStr = $(elem).find('.date').text().trim() + ' ' + $(elem).find('.time').text().trim();
        const location = $(elem).find('.location').text().trim();
        const statusText = $(elem).find('.result').text().trim();
        
        if (dateTimeStr) {
          let dateTime;
          try {
            // 형식: YYYY.MM.DD HH:MM
            const dateTimeParts = dateTimeStr.split(' ');
            if (dateTimeParts.length >= 2) {
              const dateParts = dateTimeParts[0].split('.');
              const timeParts = dateTimeParts[1].split(':');
              
              const year = parseInt(dateParts[0]);
              const month = parseInt(dateParts[1]) - 1; // 월은 0부터 시작
              const day = parseInt(dateParts[2]);
              const hour = parseInt(timeParts[0]);
              const minute = parseInt(timeParts[1]);
              
              dateTime = new Date(year, month, day, hour, minute, 0).getTime();
            } else {
              dateTime = new Date().getTime();
            }
          } catch (err) {
            dateTime = new Date().getTime();
          }
          
          // 상태 코드 매핑
          let statusCode = 40; // 기본값: 배송중
          let statusCodeText = '배송중';
          
          if (statusText.includes('상품접수')) {
            statusCode = 20;
            statusCodeText = '상품접수';
          } else if (statusText.includes('집하완료')) {
            statusCode = 30;
            statusCodeText = '집하완료';
          } else if (statusText.includes('배달완료')) {
            statusCode = 70;
            statusCodeText = '배달완료';
            currentStatus = { id: 'delivered', text: '배달완료' };
          } else if (statusText.includes('배송출발')) {
            statusCode = 65;
            statusCodeText = '배송출발';
          }
          
          progresses.push({
            time: dateTime,
            dateString: dateTimeStr,
            location: { name: location },
            status: { id: statusCode, text: statusCodeText },
            description: statusText
          });
        }
      });
      
      // 가장 최신 이벤트가 첫 번째 요소가 되도록 정렬
      progresses.reverse();
      
      // 송장 정보 추출
      const senderName = $('.waybill-info .from .name').text().trim() || '';
      const receiverName = $('.waybill-info .to .name').text().trim() || '';
      
      return {
        carrier: {
          id: 'hanjin',
          name: '한진택배'
        },
        progresses: progresses,
        senderName: senderName,
        receiverName: receiverName,
        status: currentStatus,
        estimatedDelivery: null
      };
    }
    
    throw new Error('배송정보를 찾을 수 없습니다');
  } catch (error) {
    console.error('한진 택배 조회 오류:', error);
    throw error;
  }
}

// 로젠택배 HTML 파싱 조회 방식 추가
async function fetchLogenTracking(trackingNumber: string) {
  try {
    const url = `https://www.ilogen.com/web/personal/trace/${trackingNumber}`;
    const response = await axios.get(url);
    
    if (response.status === 200) {
      const html = response.data;
      const $ = cheerio.load(html);
      
      // 배송 상태 정보 추출
      const progresses: any[] = [];
      
      // 배송 상태 추출
      const statusTable = $('#result_waybill2 tbody tr');
      let currentStatus = { id: 'in_transit', text: '배송중' };
      
      statusTable.each((i, elem) => {
        const cols = $(elem).find('td');
        if (cols.length >= 4) {
          const dateStr = $(cols[0]).text().trim();
          const timeStr = $(cols[1]).text().trim();
          const dateTimeStr = `${dateStr} ${timeStr}`;
          const location = $(cols[2]).text().trim();
          const statusText = $(cols[3]).text().trim();
          
          if (dateStr && timeStr) {
            let dateTime;
            try {
              // 형식: YYYY.MM.DD HH:MM
              const dateParts = dateStr.split('.');
              const timeParts = timeStr.split(':');
              
              const year = parseInt(dateParts[0]);
              const month = parseInt(dateParts[1]) - 1; // 월은 0부터 시작
              const day = parseInt(dateParts[2]);
              const hour = parseInt(timeParts[0]);
              const minute = parseInt(timeParts[1]);
              
              dateTime = new Date(year, month, day, hour, minute, 0).getTime();
            } catch (err) {
              dateTime = new Date().getTime();
            }
            
            // 상태 코드 매핑
            let statusCode = 40; // 기본값: 배송중
            let statusCodeText = '배송중';
            
            if (statusText.includes('접수')) {
              statusCode = 20;
              statusCodeText = '접수';
            } else if (statusText.includes('집하')) {
              statusCode = 30;
              statusCodeText = '집하완료';
            } else if (statusText.includes('완료') || statusText.includes('배달')) {
              statusCode = 70;
              statusCodeText = '배달완료';
              currentStatus = { id: 'delivered', text: '배달완료' };
            } else if (statusText.includes('출발')) {
              statusCode = 65;
              statusCodeText = '배달출발';
            }
            
            progresses.push({
              time: dateTime,
              dateString: dateTimeStr,
              location: { name: location },
              status: { id: statusCode, text: statusCodeText },
              description: statusText
            });
          }
        }
      });
      
      // 가장 최신 이벤트가 첫 번째 요소가 되도록 정렬
      progresses.reverse();
      
      // 송장 정보 추출
      const basicInfoTable = $('#result_waybill tbody tr');
      let senderName = '';
      let receiverName = '';
      
      basicInfoTable.each((i, elem) => {
        const title = $(elem).find('th').text().trim();
        const value = $(elem).find('td').text().trim();
        
        if (title.includes('보내는 분')) {
          senderName = value;
        } else if (title.includes('받는 분')) {
          receiverName = value;
        }
      });
      
      return {
        carrier: {
          id: 'logen',
          name: '로젠택배'
        },
        progresses: progresses,
        senderName: senderName,
        receiverName: receiverName,
        status: currentStatus,
        estimatedDelivery: null
      };
    }
    
    throw new Error('배송정보를 찾을 수 없습니다');
  } catch (error) {
    console.error('로젠 택배 조회 오류:', error);
    throw error;
  }
}

// 쿠팡 배송 조회 함수
async function fetchCoupangTracking(trackingNumber: string) {
  try {
    // 실제로는 쿠팡 API를 사용해야 하지만, 여기서는 모의 데이터를 생성합니다
    const now = new Date();
    
    // 배송 진행 상태를 위한 날짜 계산
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(today.getDate() - 2);
    
    // 배송 진행 상태 생성
    const progresses = [
      {
        time: twoDaysAgo.getTime(),
        dateString: twoDaysAgo.toLocaleString('ko-KR'),
        location: { name: '쿠팡 물류센터' },
        status: { id: '11', text: '상품인수' },
        description: '상품을 인수하였습니다.'
      },
      {
        time: yesterday.getTime() - 12 * 3600 * 1000, // 어제 12시간 전
        dateString: new Date(yesterday.getTime() - 12 * 3600 * 1000).toLocaleString('ko-KR'),
        location: { name: '쿠팡 물류 허브' },
        status: { id: '12', text: '상품이동중' },
        description: '물류 허브로 이동 중입니다.'
      },
      {
        time: yesterday.getTime(),
        dateString: yesterday.toLocaleString('ko-KR'),
        location: { name: '배송지역 지점' },
        status: { id: '21', text: '배송지도착' },
        description: '배송지역 지점에 도착하였습니다.'
      },
      {
        time: today.getTime() - 5 * 3600 * 1000, // 오늘 5시간 전
        dateString: new Date(today.getTime() - 5 * 3600 * 1000).toLocaleString('ko-KR'),
        location: { name: '배송지역 지점' },
        status: { id: '31', text: '배송중' },
        description: '배송이 시작되었습니다.'
      }
    ];
    
    // 배송 완료 상태 추가 (50% 확률로)
    if (Math.random() > 0.5) {
      progresses.push({
        time: today.getTime(),
        dateString: today.toLocaleString('ko-KR'),
        location: { name: '배송지' },
        status: { id: '32', text: '배송완료' },
        description: '배송이 완료되었습니다.'
      });
    }
    
    // 현재 상태 결정
    const currentStatus = progresses.length === 5 
      ? { id: 'delivered', text: '배송완료' } 
      : { id: 'in_transit', text: '배송중' };
    
    // 예상 배송 시간 (현재 상태가 배송 완료가 아닌 경우)
    const estimatedDelivery = currentStatus.id !== 'delivered' 
      ? new Date(today.getTime() + 10 * 3600 * 1000) // 10시간 후
      : null;
    
    // 현재 위치
    const currentLocation = progresses[progresses.length - 1].location.name;
    
    return {
      carrier: {
        id: 'coupang',
        name: '쿠팡'
      },
      progresses: progresses,
      senderName: '쿠팡 셀러',
      receiverName: '고객님',
      status: currentStatus,
      estimatedDelivery: estimatedDelivery,
      currentLocation: currentLocation,
      deliveredAt: currentStatus.id === 'delivered' ? today.toISOString() : null
    };
  } catch (error) {
    console.error('쿠팡 택배 조회 오류:', error);
    throw new Error('쿠팡 배송 정보를 조회하는 중 오류가 발생했습니다.');
  }
}

// 목(Mock) 데이터 (택배사 조회가 불가능할 경우 빠른 응답을 위한 예시 데이터)
const createMockData = (carrier: string) => {
  const carrierName = carriers.find(c => c.id === carrier)?.name || '미지정 택배사';
  
  // 현재 시간 기준으로 랜덤한 배송 정보 생성
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // 배송 상태 랜덤 선택
  const statusOptions = ['배송중', '배송준비중', '배송출발', '배송완료'];
  const statusText = statusOptions[Math.floor(Math.random() * (statusOptions.length - 1))]; // 마지막(배송완료)는 제외
  
  // 위치 정보 랜덤 선택
  const locationOptions = ['서울 중랑구 물류센터', '경기도 용인시 물류센터', '인천 서구 물류센터', '부산 사상구 물류센터', '대전 유성구 물류센터'];
  const currentLocation = locationOptions[Math.floor(Math.random() * locationOptions.length)];
  
  // 내일 날짜 계산 (예상 도착일)
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(Math.floor(Math.random() * 6) + 13, 0, 0); // 오후 1시~7시 사이
  
  return {
    carrier: {
      id: carrier,
      name: carrierName,
    },
    progresses: [
      {
        time: now.toISOString(),
        status: { id: 'in_transit', text: statusText },
        location: { name: currentLocation },
        description: '배송이 진행중입니다',
      },
      {
        time: yesterday.toISOString(),
        status: { id: 'information_received', text: '택배 접수됨' },
        location: { name: '집화점' },
        description: '택배가 접수되었습니다',
      }
    ],
    status: { id: 'in_transit', text: statusText },
    estimatedDelivery: tomorrow.toISOString(),
    currentLocation: currentLocation
  };
};

export async function POST(request: Request) {
  try {
    const { carrier, trackingNumber } = await request.json();
    
    if (!carrier || !trackingNumber) {
      return NextResponse.json(
        { error: '운송장 번호와 택배사를 입력해주세요.' },
        { status: 400 }
      );
    }
    
    // 지원하는 택배사인지 확인
    if (!carrierMapping[carrier]) {
      return NextResponse.json(
        { error: '지원하지 않는 택배사입니다.' },
        { status: 400 }
      );
    }

    // 택배 조회 최대 시간 10초 설정
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('택배 조회 시간 초과')), 10000);
    });

    // 택배사 코드 맵핑 (스마트 택배 API용)
    const smartCarrierMapping: { [key: string]: string } = {
      'cjkoreaexpress': 'kr.cjlogistics',   // CJ대한통운
      'koreapost': 'kr.epost',              // 우체국택배
      'lotte': 'kr.lotte',                  // 롯데택배
      'hanjin': 'kr.hanjin',                // 한진택배
      'logen': 'kr.logen',                  // 로젠택배
      'kdexp': 'kr.kdexp',                  // 경동택배
      'cupost': 'kr.cupost',                // CU편의점택배
      'cvsnet': 'kr.cvsnet'                 // GS편의점택배
    };

    // 택배 조회 Promise
    const trackerPromise = new Promise(async (resolve, reject) => {
      try {
        let result;
        
        // 스마트 택배 API를 먼저 시도 (네이버와 유사한 API)
        if (smartCarrierMapping[carrier]) {
          try {
            const url = `https://apis.tracker.delivery/carriers/${smartCarrierMapping[carrier]}/tracks/${trackingNumber}`;
            
            const headers = {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
              'Accept': 'application/json',
              'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
              'Referer': 'https://tracker.delivery/',
              'Origin': 'https://tracker.delivery'
            };
            
            const response = await axios.get(url, { headers });
            
            if (response.status === 200) {
              const data = response.data;
              
              // 배송 상태 정보 추출
              const progresses: any[] = [];
              let currentStatus = { id: 'in_transit', text: '배송중' };
              
              // 배송 상태 추출
              if (data.progresses && data.progresses.length > 0) {
                data.progresses.forEach((progress: any) => {
                  const timeStr = progress.time;
                  const location = progress.location?.name || '';
                  const description = progress.description || '';
                  const status = progress.status?.text || '배송중';
                  
                  let dateTime = new Date(timeStr).getTime();
                  
                  // 상태 코드 매핑
                  let statusCode = 40; // 기본값: 배송중
                  let statusText = '배송중';
                  
                  if (description.includes('집화') || status.includes('집화')) {
                    statusCode = 30;
                    statusText = '집화완료';
                  } else if (description.includes('배달완료') || status.includes('배달완료') || status.includes('완료')) {
                    statusCode = 70;
                    statusText = '배달완료';
                    currentStatus = { id: 'delivered', text: '배달완료' };
                  } else if (description.includes('배달출발') || status.includes('배달출발') || status.includes('출발')) {
                    statusCode = 65;
                    statusText = '배달출발';
                  }
                  
                  progresses.push({
                    time: dateTime,
                    dateString: new Date(timeStr).toLocaleString('ko-KR'),
                    location: { name: location },
                    status: { id: statusCode, text: statusText },
                    description: description || status
                  });
                });
                
                // 가장 최신 이벤트가 첫 번째 요소가 되도록 정렬
                progresses.reverse();
                
                // 현재 위치 추가
                const currentLocation = progresses.length > 0 ? progresses[0].location?.name : null;
                
                // 송장 정보
                const senderName = data.from?.name || '';
                const receiverName = data.to?.name || '';
                
                result = {
                  carrier: {
                    id: carrier,
                    name: carriers.find(c => c.id === carrier)?.name || ''
                  },
                  progresses: progresses,
                  senderName: senderName,
                  receiverName: receiverName,
                  status: currentStatus,
                  estimatedDelivery: data.estimatedDeliveryAt || null,
                  currentLocation: currentLocation
                };
                
                // 성공적으로 정보를 가져왔으면 반환
                resolve(result);
                return;
              }
            }
          } catch (smartApiError) {
            console.error('스마트 택배 API 조회 오류:', smartApiError);
            // 기존 방식으로 폴백
          }
        }
        
        // 기존 방식으로 폴백
        // 각 택배사별 API 호출
        switch (carrier) {
          case 'cjkoreaexpress':
            result = await fetchCJTracking(trackingNumber);
            break;
          case 'koreapost':
            result = await fetchEPostTracking(trackingNumber);
            break;
          case 'lotte':
            result = await fetchLotteTracking(trackingNumber);
            break;
          case 'hanjin':
            result = await fetchHanjinTracking(trackingNumber);
            break;
          case 'logen':
            result = await fetchLogenTracking(trackingNumber);
            break;
          case 'coupang':
            result = await fetchCoupangTracking(trackingNumber);
            break;
          default:
            // 기타 택배사는 Mock 데이터 사용
            result = createMockData(carrier);
            result.error = '해당 택배사는 아직 실시간 조회를 지원하지 않습니다. 네이버에서 조회 후 다시 시도해주세요.';
            break;
        }
        
        resolve(result);
      } catch (err: any) {
        console.error('택배 추적 오류:', err);
        
        // 오류 메시지 개선
        let errorMessage = '배송 정보를 찾을 수 없습니다.';
        if (err?.message) {
          if (err.message.includes('배송정보를 찾을 수 없습니다')) {
            errorMessage = '입력하신 운송장 번호의 배송 정보가 없습니다. 운송장 번호를 다시 확인하거나, 최근 접수한 경우 잠시 후 다시 시도해주세요.';
          } else if (err.message.includes('시간 초과')) {
            errorMessage = '택배사 서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.';
          } else {
            errorMessage = '배송 정보 조회 중 오류가 발생했습니다. 다른 택배사로 시도하거나 네이버에서 조회 후 다시 시도해주세요.';
          }
        }
        
        reject(new Error(errorMessage));
      }
    });

    try {
      // 두 Promise 중 먼저 완료되는 것을 기다림
      const result = await Promise.race([trackerPromise, timeoutPromise]);
      return NextResponse.json(result);
    } catch (err: any) {
      console.error('택배 추적 시간 초과 또는 오류:', err);
      
      // 시간 초과 또는 오류 발생 시 기본 응답 반환
      const mockData = createMockData(carrier);
      
      return NextResponse.json({
        ...mockData,
        error: err?.message || '실시간 택배 정보를 가져오지 못했습니다. 네이버에서 조회 후 다시 시도해주세요.'
      });
    }
  } catch (error) {
    console.error('택배 조회 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    );
  }
} 
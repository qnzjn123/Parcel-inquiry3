'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from "next/image";

export default function Home() {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('cjkoreaexpress');
  const [isLoading, setIsLoading] = useState(false);
  const [trackingResult, setTrackingResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [updateInterval, setUpdateInterval] = useState<number>(60); // 초 단위
  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  // 국내 택배사만 포함
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

  // 이벤트 없이 조회하는 함수 (자동 갱신용)
  const handleTrackWithoutEvent = useCallback(async () => {
    if (!trackingNumber.trim()) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ carrier, trackingNumber }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setTrackingResult(data);
        setLastUpdated(new Date());
        // 오류 메시지가 있으면 표시
        if (data.error) {
          setError(data.error);
        }
      } else {
        setError(data.error || '택배 조회에 실패했습니다.');
        setTrackingResult(null);
      }
    } catch (error) {
      setError('서버와의 통신에 실패했습니다.');
      setTrackingResult(null);
    } finally {
      setIsLoading(false);
    }
  }, [trackingNumber, carrier]);

  // 자동 갱신 기능 관리
  useEffect(() => {
    // 자동 갱신 타이머 시작/중지
    if (isAutoRefresh && trackingResult && !trackingResult?.status?.id?.includes('delivered')) {
      console.log('자동 갱신 타이머 설정: ', updateInterval, '초');
      // 이미 타이머가 있으면 정리
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
      }
      
      // 새 타이머 설정 (초 -> 밀리초)
      autoRefreshTimerRef.current = setInterval(() => {
        // 배송이 완료되지 않은 경우에만 갱신
        if (trackingNumber && carrier && !isLoading) {
          console.log('자동 갱신 실행');
          handleTrackWithoutEvent();
        }
      }, updateInterval * 1000);
      
      // 컴포넌트 언마운트 시 타이머 정리
      return () => {
        if (autoRefreshTimerRef.current) {
          clearInterval(autoRefreshTimerRef.current);
          autoRefreshTimerRef.current = null;
        }
      };
    } else {
      // 자동 갱신이 꺼져있거나 배송이 완료된 경우 타이머 정리
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
        autoRefreshTimerRef.current = null;
      }
    }
  }, [isAutoRefresh, trackingNumber, carrier, trackingResult, updateInterval, isLoading, handleTrackWithoutEvent]);

  // 택배 조회 결과가 변경될 때마다 자동 갱신 상태 업데이트
  useEffect(() => {
    // 처음 택배 조회 결과가 있고, 배송이 완료되지 않은 경우 자동 갱신 활성화
    if (trackingResult && trackingResult.status && trackingResult.status.id !== 'delivered') {
      console.log('배송 진행 중: 자동 갱신 활성화');
      setIsAutoRefresh(true);
    } else if (trackingResult && trackingResult.status && trackingResult.status.id === 'delivered') {
      // 배송이 완료된 경우 자동 갱신 비활성화
      console.log('배송 완료: 자동 갱신 비활성화');
      setIsAutoRefresh(false);
    }
  }, [trackingResult]);

  // 폼 제출 시 조회 함수
  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!trackingNumber.trim()) {
      setError('운송장 번호를 입력해주세요.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    // 타임아웃 설정 (7초)
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        setError('조회 시간이 초과되었습니다. 다시 시도해주세요.');
        setIsLoading(false);
      }
    }, 7000);
    
    try {
      const response = await fetch('/api/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ carrier, trackingNumber }),
      });
      
      clearTimeout(timeoutId);
      
      const data = await response.json();
      
      if (response.ok) {
        setTrackingResult(data);
        setLastUpdated(new Date());
        // 오류 메시지가 있으면 표시
        if (data.error) {
          setError(data.error);
        }
        // 배송이 완료되지 않은 경우에만 자동 갱신 활성화
        if (data.status && data.status.id !== 'delivered') {
          setIsAutoRefresh(true);
        } else {
          setIsAutoRefresh(false);
        }
      } else {
        setError(data.error || '택배 조회에 실패했습니다.');
        setTrackingResult(null);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      setError('서버와의 통신에 실패했습니다.');
      setTrackingResult(null);
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  // 갱신 간격 변경 처리
  const handleIntervalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setUpdateInterval(Number(e.target.value));
  };

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex flex-col items-center flex-grow p-4 sm:p-8">
        <div className="w-full max-w-4xl mx-auto">
          <div className="w-full mx-auto mb-4 sm:mb-8">
            <form onSubmit={handleTrack} className="bg-white shadow-md rounded p-4 sm:p-6">
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="carrier">
                  택배사 선택
                </label>
                <select
                  id="carrier"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                >
                  <optgroup label="대형 택배사">
                    {carriers
                      .slice(0, 5) // 대형 택배사 인덱스
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="중소형 택배사">
                    {carriers
                      .slice(5, 9) // 중소형 택배사 인덱스
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="기타 택배사">
                    {carriers
                      .slice(9) // 특수 택배사 인덱스
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>
              
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="trackingNumber">
                  운송장 번호
                </label>
                <input
                  id="trackingNumber"
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => {
                    // 숫자와 하이픈만 허용
                    const value = e.target.value.replace(/[^0-9-]/g, '');
                    setTrackingNumber(value);
                  }}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  placeholder="운송장 번호를 입력하세요 (숫자만)"
                />
                <p className="text-xs text-gray-500 mt-1">* 숫자만 입력하세요. 하이픈(-) 포함 여부는 택배사에 따라 다를 수 있습니다.</p>
              </div>
              
              <div className="flex items-center justify-center">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      조회 중...
                    </div>
                  ) : '택배 조회하기'}
                </button>
              </div>
            </form>
          </div>
          
          {error && (
            <div className="w-full mx-auto mb-4 sm:mb-8 bg-red-100 border border-red-400 text-red-700 px-3 py-2 sm:px-4 sm:py-3 rounded">
              <p className="font-bold mb-1">오류 발생</p>
              <p>{error}</p>
              <div className="mt-3 text-sm">
                <p>🔍 <strong>문제 해결 방법</strong></p>
                <ul className="list-disc pl-5 mt-1">
                  <li>운송장 번호가 정확한지 확인해주세요.</li>
                  <li>택배사를 올바르게 선택했는지 확인해주세요.</li>
                  <li>최근 접수된 택배는 시스템에 등록되기까지 시간이 걸릴 수 있습니다.</li>
                  <li>다른 택배사로 다시 시도해보세요.</li>
                  <li><strong>네이버에서 확인된 운송장 번호</strong>로 다시 시도해보세요.</li>
                </ul>
                <p className="mt-2 font-semibold text-blue-700">
                  💡 네이버에서 "택배조회" 검색 후 운송장 번호를 조회하면 정확한 택배사와 번호를 확인할 수 있습니다.
                </p>
              </div>
            </div>
          )}
          
          {trackingResult && !error && (
            <div className="w-full mx-auto bg-white shadow-md rounded p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                <h2 className="text-xl font-bold mb-2 sm:mb-0">조회 결과</h2>
                
                {/* 실시간 업데이트 설정 - 토글 스위치로 변경 */}
                <div className="flex flex-wrap items-center space-x-2">
                  <div className="flex items-center">
                    <span className="text-sm text-gray-700 mr-2">자동 갱신</span>
                    <div className="relative inline-block w-10 mr-2 align-middle select-none">
                      <input 
                        type="checkbox" 
                        id="autoRefresh" 
                        checked={isAutoRefresh} 
                        onChange={(e) => setIsAutoRefresh(e.target.checked)}
                        disabled={trackingResult.status?.id === 'delivered'} 
                        className="sr-only"
                      />
                      <label 
                        htmlFor="autoRefresh" 
                        className={`block overflow-hidden h-5 rounded-full cursor-pointer transition-colors duration-200 ease-in ${isAutoRefresh ? 'bg-blue-500' : 'bg-gray-300'} ${trackingResult.status?.id === 'delivered' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span 
                          className={`block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ease-in ${isAutoRefresh ? 'translate-x-5' : 'translate-x-0'}`} 
                        />
                      </label>
                    </div>
                  </div>
                  
                  {isAutoRefresh && trackingResult.status?.id !== 'delivered' && (
                    <select
                      value={updateInterval}
                      onChange={handleIntervalChange}
                      className="text-xs border rounded px-1 py-0.5"
                    >
                      <option value="30">30초</option>
                      <option value="60">1분</option>
                      <option value="300">5분</option>
                      <option value="600">10분</option>
                    </select>
                  )}
                  
                  {/* 수동 새로고침 버튼 */}
                  <button
                    onClick={handleTrackWithoutEvent}
                    disabled={isLoading}
                    className="text-blue-500 hover:text-blue-700"
                    title="새로고침"
                  >
                    {isLoading ? (
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              
              {/* 마지막 업데이트 시간 표시 */}
              {lastUpdated && (
                <div className="text-xs text-gray-500 mb-3 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  마지막 업데이트: {lastUpdated.toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                  }).replace(/\./g, '-').replace(/\s/g, ' ').replace(/-$/, '')}
                  {isAutoRefresh && !isLoading && trackingResult.status?.id !== 'delivered' && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <span className="animate-pulse mr-1 h-1.5 w-1.5 rounded-full bg-green-500"></span>
                      실시간 자동 갱신 중 ({updateInterval}초)
                    </span>
                  )}
                </div>
              )}
              
              {/* 현재 상태 요약 (상단 안내 박스) */}
              {trackingResult.status && (
                <div className="mb-4 p-3 sm:p-4 bg-blue-50 border border-blue-100 rounded-lg">
                  {/* 상태 뱃지 - 개선된 배송 상태 표시 */}
                  <div className="flex flex-col sm:flex-row sm:items-center mb-3">
                    <span className={`px-3 py-1.5 rounded-full text-sm font-bold flex items-center mb-2 sm:mb-0 max-w-fit ${
                      trackingResult.status.id === 'delivered' 
                        ? 'bg-green-600 text-white' 
                        : trackingResult.status.id === 'out_for_delivery' 
                          ? 'bg-orange-500 text-white'
                          : trackingResult.status.id === 'in_transit'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-600 text-white'
                    }`}>
                      {/* 상태별 아이콘 */}
                      {trackingResult.status.id === 'delivered' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : trackingResult.status.id === 'out_for_delivery' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      ) : trackingResult.status.id === 'in_transit' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l-4-4m4 4l4-4" />
                        </svg>
                      )}
                      {/* 상태 텍스트 명확히 표시 */}
                      {trackingResult.status.id === 'delivered' 
                        ? '배송 완료' 
                        : trackingResult.status.id === 'out_for_delivery' 
                          ? '배송 출발' 
                          : trackingResult.status.id === 'in_transit' 
                            ? '배송 중' 
                            : trackingResult.status.id === 'pending' 
                              ? '배송 준비 중'
                              : trackingResult.status.text}
                    </span>
                    
                    {/* 상세 상태 정보 */}
                    <span className="sm:ml-2 text-sm text-gray-600">
                      {trackingResult.status.id === 'delivered' 
                        ? '물품이 성공적으로 배송되었습니다' 
                        : trackingResult.status.id === 'out_for_delivery' 
                          ? '고객님의 주소지로 배송이 시작되었습니다' 
                          : trackingResult.status.id === 'in_transit' 
                            ? '물품이 다음 집하장소로 이동 중입니다'
                            : trackingResult.status.id === 'pending'
                              ? '배송 준비가 진행 중입니다'
                              : trackingResult.status.text}
                    </span>
                  </div>
                  
                  {/* 배송 상태 진행 바 */}
                  <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                    <div className={`h-2.5 rounded-full ${
                      trackingResult.status.id === 'delivered' 
                        ? 'bg-green-600 w-full' 
                        : trackingResult.status.id === 'out_for_delivery' 
                          ? 'bg-orange-500 w-4/5' 
                          : trackingResult.status.id === 'in_transit' 
                            ? 'bg-blue-600 w-3/5'
                            : trackingResult.status.id === 'pending'
                              ? 'bg-gray-600 w-1/5'
                              : 'bg-blue-600 w-2/5'
                    }`}></div>
                  </div>
                  
                  {/* 배송 상태 단계 */}
                  <div className="flex justify-between text-[10px] sm:text-xs text-gray-600 px-1 sm:px-2">
                    <div className={`${trackingResult.status.id === 'pending' || ['pending', 'at_pickup', 'in_transit', 'out_for_delivery', 'delivered'].includes(trackingResult.status.id) ? 'font-bold text-gray-800' : ''}`}>접수</div>
                    <div className={`${trackingResult.status.id === 'at_pickup' || ['at_pickup', 'in_transit', 'out_for_delivery', 'delivered'].includes(trackingResult.status.id) ? 'font-bold text-gray-800' : ''}`}>집하</div>
                    <div className={`${trackingResult.status.id === 'in_transit' || ['in_transit', 'out_for_delivery', 'delivered'].includes(trackingResult.status.id) ? 'font-bold text-gray-800' : ''}`}>이동중</div>
                    <div className={`${trackingResult.status.id === 'out_for_delivery' || ['out_for_delivery', 'delivered'].includes(trackingResult.status.id) ? 'font-bold text-gray-800' : ''}`}>배송출발</div>
                    <div className={`${trackingResult.status.id === 'delivered' ? 'font-bold text-gray-800' : ''}`}>배송완료</div>
                  </div>
                  
                  {/* 택배사 정보 */}
                  {trackingResult.carrier && (
                    <div className="flex flex-wrap items-start sm:items-center mt-4 mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 mr-2 mt-0.5 sm:mt-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                      </svg>
                      <p className="text-gray-600 text-sm sm:text-base">택배사: <span className="font-semibold">{trackingResult.carrier.name || carrier}</span></p>
                    </div>
                  )}
                  
                  {/* 현재 위치 표시 */}
                  {trackingResult.currentLocation && (
                    <div className="flex flex-wrap items-start sm:items-center mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 mr-2 mt-0.5 sm:mt-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p className="text-gray-600 text-sm sm:text-base">현재 위치: <span className="font-semibold">
                        {typeof trackingResult.currentLocation === 'object' && trackingResult.currentLocation !== null
                          ? trackingResult.currentLocation.name || '위치 정보 없음'
                          : trackingResult.currentLocation}
                      </span></p>
                    </div>
                  )}
                  
                  {/* 예상 도착 시간 표시 */}
                  {trackingResult.estimatedDelivery && trackingResult.status.id !== 'delivered' && (
                    <div className="flex flex-wrap items-start sm:items-center mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 mr-2 mt-0.5 sm:mt-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-gray-600 text-sm sm:text-base">
                        예상 도착: <span className="font-semibold text-green-700">
                          {new Date(trackingResult.estimatedDelivery).toLocaleString('ko-KR', {
                            year: 'numeric',
                            month: '2-digit', 
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                            weekday: 'short'
                          }).replace(/\./g, '-').replace(/\s\s+/g, ' ')}
                        </span>
                      </p>
                    </div>
                  )}
                  
                  {/* 배송 완료 시간 */}
                  {trackingResult.deliveredAt && (
                    <div className="flex flex-wrap items-start sm:items-center mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 mr-2 mt-0.5 sm:mt-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="text-gray-600 text-sm sm:text-base">
                        배송 완료: <span className="font-semibold text-green-700">
                          {new Date(trackingResult.deliveredAt).toLocaleString('ko-KR', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false,
                            weekday: 'short'
                          }).replace(/\./g, '-').replace(/\s\s+/g, ' ')}
                        </span>
                      </p>
                    </div>
                  )}
                  
                  {/* 오류 메시지가 있는 경우 표시 */}
                  {trackingResult.error && (
                    <div className="mt-2 text-xs text-yellow-600 bg-yellow-50 p-2 rounded">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      {trackingResult.error}
                    </div>
                  )}
                </div>
              )}
              
              {/* 배송 현황 타임라인 */}
              {trackingResult.progresses && trackingResult.progresses.length > 0 ? (
                <div>
                  <h3 className="font-bold mb-3 text-gray-700 flex items-center text-base sm:text-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 mr-1 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    배송 현황
                  </h3>
                  
                  <div className="relative pb-8">
                    <div className="absolute left-3 sm:left-4 top-0 h-full w-0.5 bg-gray-200"></div>
                    <ul className="relative">
                      {trackingResult.progresses.map((progress: any, index: number) => (
                        <li key={`timeline-${index}`} className="mb-6 ml-5 sm:ml-6">
                          {/* 상태 아이콘 */}
                          <span className={`absolute flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full -left-3 sm:-left-4 ring-2 ring-white ${
                            index === 0 
                              ? progress.status?.id === 'delivered' 
                                ? 'bg-green-500' 
                                : progress.status?.id === 'out_for_delivery'
                                  ? 'bg-orange-500'
                                  : progress.status?.id === 'in_transit'
                                    ? 'bg-blue-500'
                                    : 'bg-gray-500'
                              : 'bg-gray-300'
                          }`}>
                            {index === 0 ? (
                              progress.status?.id === 'delivered' ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : progress.status?.id === 'out_for_delivery' ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                                </svg>
                              )
                            ) : (
                              <span className="block h-2 w-2 sm:h-3 sm:w-3 rounded-full bg-white"></span>
                            )}
                          </span>
                          
                          {/* 상태 상세 정보 */}
                          <div className="block p-3 sm:p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                            <time className="block mb-1 text-xs sm:text-sm font-normal text-gray-500">
                              {new Date(progress.time).toLocaleString('ko-KR', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: false,
                                weekday: 'short',
                              }).replace(/\./g, '-').replace(/\s\s+/g, ' ')}
                            </time>
                            
                            {/* 상세 메시지 */}
                            <div className="text-sm sm:text-base font-semibold text-gray-900 mb-2">{progress.status?.text || '상태 업데이트'}</div>
                            
                            {/* 위치 정보 */}
                            {progress.location && (
                              <div className="text-xs sm:text-sm text-gray-600 flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4 mr-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {typeof progress.location === 'object' && progress.location !== null
                                  ? progress.location.name || '위치 정보 없음'
                                  : progress.location}
                              </div>
                            )}
                            
                            {/* 설명 텍스트 */}
                            {progress.description && (
                              <div className="mt-2 text-xs sm:text-sm text-gray-500">{progress.description}</div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-yellow-50 border border-yellow-100 rounded text-yellow-800">
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p>배송 정보가 없습니다.</p>
                  </div>
                </div>
              )}
              
              <div className="mt-4 text-xs text-gray-500">
                <p>* 택배사 사정에 따라 정보가 지연되거나 누락될 수 있습니다.</p>
                {trackingResult.estimatedDelivery && trackingResult.status.id !== 'delivered' && (
                  <p className="mt-1">* 예상 도착 시간은 택배사 상황에 따라 변경될 수 있습니다.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
      
      <footer className="p-4 text-center text-sm text-gray-500">
        &copy; {new Date().getFullYear()} 배송콕
      </footer>
    </div>
  );
}
